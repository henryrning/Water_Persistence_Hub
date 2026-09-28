/* Download page: one selection state drives the map, the list, the summary and the URL.
   In Django the catalogue (COUNTIES) and package jobs come from the server; the
   selection logic and URL format stay the same. */
(function () {
  const HUB = window.HUB;
  if (!window.COUNTIES?.features) {
    document.querySelector(".dl-steps").innerHTML = '<div class="callout callout-warn" role="alert"><p><strong>County catalogue could not load.</strong> Reload this page to retry. <a href="docs.html">Read the documentation</a>.</p></div>';
    document.getElementById("summary-text").textContent = "County data is unavailable. Reload to retry.";
    return;
  }
  const STATE_NAMES = { ND: "North Dakota", SD: "South Dakota" };
  const README_BYTES = 24 * 1024, EXTRA_FILES = 3; // README.txt, manifest.csv, TERMS.txt

  const features = COUNTIES.features;
  const byFips = new Map(features.map(f => [f.properties.fips, f.properties]));
  const covered = features.filter(f => f.properties.years.length).map(f => f.properties);
  const coveredIn = st => covered.filter(c => c.state === st);

  const sel = { counties: new Set(), year: null, window: "full", cutoff: null };
  const session = Session.get();

  // ---------- URL state (DL-12) ----------
  function readUrl() {
    const q = new URLSearchParams(location.search);
    (q.get("counties") || "").split(",").filter(f => byFips.has(f) && byFips.get(f).years.length).forEach(f => sel.counties.add(f));
    (q.get("state") || "").split(",").forEach(st => coveredIn(st).forEach(c => sel.counties.add(c.fips)));
    const y = +q.get("year"); if (y) sel.year = y;
    const p = +q.get("cutoff"); if ([70, 80, 90].includes(p)) sel.cutoff = p;
  }
  function selectionQuery() {
    const q = new URLSearchParams();
    if (sel.counties.size) q.set("counties", [...sel.counties].join(","));
    if (sel.year) q.set("year", sel.year);
    q.set("window", sel.window);
    if (sel.cutoff) q.set("cutoff", sel.cutoff);
    return q.toString();
  }
  function writeUrl() { try { history.replaceState(null, "", "?" + selectionQuery()); } catch { /* Local file URLs may restrict history updates. */ } }

  // ---------- Derived values ----------
  const availableYears = () => {
    if (!sel.counties.size) return [];
    let ys = null;
    sel.counties.forEach(f => { const y = byFips.get(f).years; ys = ys ? ys.filter(v => y.includes(v)) : y.slice(); });
    return ys;
  };
  const isComplete = () => sel.counties.size && sel.year && sel.window && sel.cutoff;
  function estBytes() {
    const p = String(sel.cutoff || 80);
    let b = README_BYTES;
    sel.counties.forEach(f => { b += byFips.get(f).size[p]; });
    return b;
  }
  function regionWords() {
    const list = [...sel.counties].map(f => byFips.get(f));
    if (!list.length) return "";
    const states = [...new Set(list.map(c => c.state))];
    const whole = states.filter(st => list.filter(c => c.state === st).length === coveredIn(st).length);
    if (whole.length === states.length && list.length > 3)
      return whole.map(st => `All ${coveredIn(st).length} covered counties in ${STATE_NAMES[st]}`).join(" + ");
    if (list.length === 1) return `${list[0].name} County, ${list[0].state}`;
    if (list.length <= 3) {
      const names = list.map(c => c.name);
      const joined = names.length === 2 ? names.join(" and ") : names.slice(0, -1).join(", ") + " and " + names.at(-1);
      return `${joined} counties, ${states.join(" & ")}`;
    }
    return `${list.length} counties in ${states.join(" & ")}`;
  }

  // ---------- Map ----------
  let map = null, fullBounds;
  let layer = { setStyle() {}, eachLayer() {} };
  const styleFor = p => {
    const on = sel.counties.has(p.fips);
    if (!p.years.length) return { color: "#cfd5de", weight: 0.8, fillColor: "url(#hatch)", fillOpacity: 1 };
    const previewing = on && p.sample && previewActive();
    return {
      color: on ? "#ffffff" : "#7eb6e8", weight: on ? 1.4 : 0.9,
      fillColor: on ? "#13294b" : "#cfe2f7", fillOpacity: previewing ? 0.08 : (on ? 0.88 : 1)
    };
  };
  if (window.L) {
  map = L.map("map", { zoomControl: false, attributionControl: false, zoomSnap: 0.25, minZoom: 5, maxZoom: 11 });
  layer = L.geoJSON(COUNTIES, {
    style: f => styleFor(f.properties),
    onEachFeature: (f, lyr) => {
      const p = f.properties;
      const status = p.years.length ? (p.sample ? "2025 · sample preview available" : "2025 available") : "Not yet available";
      lyr.bindTooltip(`<strong>${p.name} County, ${p.state}</strong><span>${status}</span>`, { className: "county-tip", sticky: true, direction: "top", offset: [0, -8] });
      lyr.on("mouseover", () => { if (p.years.length) lyr.setStyle({ color: "#ff5f05", weight: 2.5 }); lyr.bringToFront(); });
      lyr.on("mouseout", () => lyr.setStyle(styleFor(p)));
      lyr.on("click", () => {
        if (!p.years.length) { toast(`${p.name} County, ${p.state} is not published yet.`); return; }
        toggleCounty(p.fips);
        document.getElementById("map-hint").hidden = true;
      });
    }
  }).addTo(map);
  fullBounds = layer.getBounds();
  map.fitBounds(fullBounds, { padding: [30, 30] });

  // Hatch pattern for unavailable counties (injected into Leaflet's SVG).
  const svg = map.getPanes().overlayPane.querySelector("svg");
  svg.insertAdjacentHTML("afterbegin", `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="#f3f4f6"/><rect width="3" height="6" fill="#e6e9ee"/></pattern></defs>`);
  // Leaflet writes fillColor straight into the fill attribute, so re-apply once the pattern exists.
  layer.setStyle(f => styleFor(f.properties));

  // State labels
  [["NORTH DAKOTA", [47.45, -100.4]], ["SOUTH DAKOTA", [44.4, -100.3]]].forEach(([t, ll]) =>
    L.marker(ll, { interactive: false, icon: L.divIcon({ className: "", html: `<div class="state-label" style="transform:translate(-50%,-50%)">${t}</div>` }) }).addTo(map));

  document.getElementById("zoom-in").onclick = () => map.zoomIn();
  document.getElementById("zoom-out").onclick = () => map.zoomOut();
  document.getElementById("zoom-fit").onclick = () => {
    if (!sel.counties.size) return map.fitBounds(fullBounds, { padding: [30, 30] });
    const b = L.latLngBounds([]);
    layer.eachLayer(l => { if (sel.counties.has(l.feature.properties.fips)) b.extend(l.getBounds()); });
    map.fitBounds(b, { padding: [120, 120], maxZoom: 8 });
  };
  } else {
    document.getElementById("map").removeAttribute("role");
    document.getElementById("map").innerHTML = '<div class="map-error" role="status"><h2>Map unavailable</h2><p>You can still select counties using the search panel. Reload the page to retry the map.</p></div>';
    document.querySelectorAll(".map-tools, .map-legend, .map-hint").forEach(el => el.hidden = true);
  }

  // Layer preview (DL-15) — only the Ramsey sample has a rendered preview in the prototype.
  const rb = window.RAMSEY_PREVIEW?.bounds;
  const rBounds = rb ? [[rb[1], rb[0]], [rb[3], rb[2]]] : null;
  let overlay = null, overlayKey = null;
  const imageStatus = document.createElement("div");
  imageStatus.className = "map-card map-image-status"; imageStatus.hidden = true;
  imageStatus.setAttribute("role", "status"); document.querySelector(".dl-map-wrap").append(imageStatus);
  const previewCb = document.getElementById("preview-cb");
  function previewActive() { return !!map && !!rb && sel.cutoff && sel.counties.has("38071") && previewCb.checked; }
  function updatePreview() {
    const show = map && rb && sel.cutoff && sel.counties.has("38071");
    document.getElementById("preview-toggle").hidden = !show;
    const key = previewActive() ? sel.cutoff : null;
    if (key === overlayKey) return;
    overlayKey = key;
    imageStatus.hidden = true;
    if (overlay) { map.removeLayer(overlay); overlay = null; }
    if (previewActive()) {
      imageStatus.hidden = false; imageStatus.textContent = "Loading Ramsey preview…";
      const current = L.imageOverlay(`assets/img/ramsey_${sel.cutoff}.png`, rBounds, { opacity: 1, interactive: false });
      overlay = current;
      current.on("load", () => { if (overlay === current) imageStatus.hidden = true; });
      current.on("error", () => {
        if (overlay !== current) return;
        imageStatus.hidden = false; imageStatus.textContent = "Preview unavailable. Toggle the preview off and on to retry. Your selection is preserved.";
      });
      current.addTo(map);
      document.getElementById("preview-label").textContent = `Ramsey County · ${sel.cutoff}% cutoff`;
    }
  }
  previewCb.addEventListener("change", render);

  // ---------- Combobox (DL-02) ----------
  const input = document.getElementById("county-search");
  const list = document.getElementById("county-list");
  const combo = document.getElementById("combo");
  let options = [], active = -1;

  function buildOptions(q) {
    q = q.trim().toLowerCase();
    const out = [];
    ["ND", "SD"].forEach(st => {
      const stMatch = !q || STATE_NAMES[st].toLowerCase().includes(q) || st.toLowerCase() === q;
      const items = features.map(f => f.properties).filter(c => c.state === st && (stMatch || c.name.toLowerCase().includes(q)));
      if (!items.length && !stMatch) return;
      out.push({ group: STATE_NAMES[st] });
      if (stMatch) out.push({ state: st, label: `All covered counties in ${STATE_NAMES[st]}`, n: coveredIn(st).length });
      items.sort((a, b) => (b.years.length - a.years.length) || a.name.localeCompare(b.name))
        .forEach(c => out.push({ fips: c.fips, label: `${c.name} County`, disabled: !c.years.length }));
    });
    return out;
  }
  function renderList() {
    options = buildOptions(input.value);
    let i = 0;
    list.innerHTML = options.map(o => {
      if (o.group) return `<li class="group" role="presentation">${o.group}</li>`;
      const id = `opt-${i}`; o.idx = i++;
      const on = o.fips ? sel.counties.has(o.fips) : coveredIn(o.state).every(c => sel.counties.has(c.fips));
      const right = o.disabled ? '<span class="badge badge-muted">Not yet</span>' : o.state ? `<span class="badge">${o.n}</span>` : (on ? '<span class="tick">✓</span>' : "");
      return `<li id="${id}" role="option" aria-selected="${on}" ${o.disabled ? 'aria-disabled="true"' : ""} data-i="${o.idx}">${o.state ? `<strong>${o.label}</strong>` : o.label}${right}</li>`;
    }).join("") || `<li role="presentation" class="combo-empty">No matching county. Try a county name, ND or SD.</li>`;
    options = options.filter(o => !o.group);
    highlight(Math.min(active, options.length - 1));
  }
  function highlight(i) {
    active = i;
    list.querySelectorAll("[role=option]").forEach(li => li.classList.toggle("is-active", +li.dataset.i === i));
    const el = list.querySelector(`[data-i="${i}"]`);
    if (el) { el.scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", el.id); }
    else input.removeAttribute("aria-activedescendant");
  }
  function choose(o) {
    if (!o || o.disabled) return;
    if (o.state) toggleState(o.state); else toggleCounty(o.fips);
    renderList();
  }
  const openList = () => { combo.classList.add("open"); input.setAttribute("aria-expanded", "true"); renderList(); };
  const closeList = () => { combo.classList.remove("open"); input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
  combo.addEventListener("focusout", e => { if (!combo.contains(e.relatedTarget)) closeList(); });
  input.addEventListener("focus", openList);
  input.addEventListener("input", () => { active = 0; openList(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!combo.classList.contains("open")) openList(); highlight(Math.min(active + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (!combo.classList.contains("open")) openList(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(options[active]); }
    else if (e.key === "Escape" || e.key === "Tab") { closeList(); }
  });
  list.addEventListener("pointerdown", e => {
    const li = e.target.closest("[role=option]"); if (!li) return;
    e.preventDefault(); choose(options[+li.dataset.i]);
  });
  document.addEventListener("click", e => { if (!combo.contains(e.target)) closeList(); });

  // ---------- Selection changes ----------
  function toggleCounty(f) { sel.counties.has(f) ? sel.counties.delete(f) : sel.counties.add(f); onRegionChange(); }
  function toggleState(st) {
    const all = coveredIn(st), allOn = all.every(c => sel.counties.has(c.fips));
    all.forEach(c => allOn ? sel.counties.delete(c.fips) : sel.counties.add(c.fips));
    onRegionChange();
  }
  function onRegionChange() {
    const ys = availableYears();
    if (sel.year && !ys.includes(sel.year)) sel.year = null;
    if (!sel.year && ys.length === 1) sel.year = ys[0]; // only one published year: pre-select it
    resetJob(); render();
  }
  document.querySelectorAll("[data-state]").forEach(b => b.addEventListener("click", () => toggleState(b.dataset.state)));
  document.getElementById("clear-counties").onclick = () => { sel.counties.clear(); onRegionChange(); };

  // ---------- Render ----------
  let showAllChips = false;
  function render() {
    const focused = document.activeElement;
    const removedId = focused?.dataset.rm;
    const wasMore = focused?.id === "more-chips";
    layer.setStyle(f => styleFor(f.properties));
    updatePreview();

    // Step 1
    const n = sel.counties.size;
    document.getElementById("region-value").textContent = n ? `${n} selected` : "";
    document.querySelectorAll("[data-state]").forEach(b => b.setAttribute("aria-pressed", coveredIn(b.dataset.state).every(c => sel.counties.has(c.fips))));
    const chips = [...sel.counties].map(f => byFips.get(f)).sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
    const shown = showAllChips ? chips : chips.slice(0, 8);
    document.getElementById("chips").innerHTML = n
      ? shown.map(c => `<span class="chip">${c.name}, ${c.state}<button aria-label="Remove ${c.name} County" data-rm="${c.fips}">×</button></span>`).join("")
        + (chips.length > 8 ? `<button class="chips-more" id="more-chips">${showAllChips ? "Show less" : `+${chips.length - 8} more`}</button>` : "")
      : `<p class="chips-empty">Nothing selected yet. Search above or click the map.</p>`;
    document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => toggleCounty(b.dataset.rm));
    const more = document.getElementById("more-chips"); if (more) more.onclick = () => { showAllChips = !showAllChips; render(); };
    if (removedId) (document.querySelector(`[data-rm="${removedId}"]`) || document.querySelector("[data-rm]") || input).focus();
    if (wasMore) (more || input).focus();
    stepState("step-region", n > 0, false);

    // Step 2
    const ys = availableYears();
    const yearHost = document.getElementById("years");
    if (!yearHost.children.length) yearHost.innerHTML = HUB.years.map(({ y }) => `<button type="button" data-year="${y}">${y}<small></small></button>`).join("");
    HUB.years.forEach(({ y, status }) => {
      const ok = ys.includes(y);
      // Before a region is chosen, label years by catalogue status; afterwards by coverage of the selection.
      const lab = (n ? ok : status === "published") ? "Published" : (status === "processing" ? "In progress" : "Not published");
      const button = yearHost.querySelector(`[data-year="${y}"]`);
      button.disabled = !ok; button.setAttribute("aria-pressed", sel.year === y);
      button.setAttribute("aria-label", `${y}, ${lab}`); button.querySelector("small").textContent = lab;
    });
    document.querySelectorAll("[data-year]").forEach(b => b.onclick = () => { sel.year = +b.dataset.year; resetJob(); render(); });
    document.getElementById("year-note").textContent = !n ? "Choose counties to unlock published years." : !ys.length ? "No shared published year. Remove counties or make separate selections." : ys.length === 1 ? `Only ${ys[0]} is published for this selection.` : "Choose a year available for every selected county.";
    document.getElementById("year-value").textContent = sel.year || "";
    stepState("step-year", !!sel.year, !n);

    // Step 3
    document.getElementById("window-value").textContent = sel.year ? "Full window" : "";
    stepState("step-window", !!sel.year, !sel.year);

    // Step 4
    if (!document.getElementById("cutoffs").children.length) document.getElementById("cutoffs").innerHTML = HUB.cutoffs.map(c => `
      <label class="cutoff">
        <input type="radio" name="cutoff" value="${c.p}" ${sel.cutoff === c.p ? "checked" : ""}>
        <span><span class="t">${c.title}${c.p === 80 ? ' <span class="badge">Recommended start</span>' : ""}</span><span class="d">${c.text}</span></span>
        <span class="swatch" style="background:${c.color}" aria-hidden="true"></span>
      </label>`).join("");
    document.querySelectorAll("input[name=cutoff]").forEach(r => {
      r.checked = sel.cutoff === +r.value; r.disabled = !sel.year;
      r.onchange = () => { sel.cutoff = +r.value; resetJob(); render(); };
    });
    document.getElementById("cutoff-value").textContent = sel.cutoff ? sel.cutoff + "%" : "";
    stepState("step-cutoff", !!sel.cutoff, !sel.year);

    // Summary (DL-07)
    const st = document.getElementById("summary-text");
    if (!n) { st.textContent = "Pick at least one county to begin."; st.classList.add("empty"); }
    else {
      st.classList.remove("empty");
      st.textContent = [regionWords(), sel.year || "choose a year", sel.year ? "full planting window" : null,
        sel.cutoff ? `${sel.cutoff}% persistence` : (sel.year ? "choose a cutoff" : null)].filter(Boolean).join(" · ");
    }
    document.getElementById("s-count").textContent = n;
    document.getElementById("s-files").textContent = n ? n + EXTRA_FILES : "—";
    document.getElementById("s-size").textContent = n ? (sel.cutoff ? "" : "~") + HUB.formatBytes(estBytes()) : "—";

    // Download button + delivery route (DL-01, DL-09 as amended: website ZIP only)
    const btn = document.getElementById("dl-btn");
    const note = document.getElementById("route-note");
    btn.disabled = !isComplete() || jobRunning;
    btn.textContent = jobRunning ? "Building your package…" : !session ? "Sign in to download" : "Download ZIP";
    if (!session && isComplete()) btn.disabled = false;
    if (isComplete()) {
      const big = estBytes() > 500 * 1024 * 1024;
      note.hidden = false;
      note.textContent = big
        ? "Large package: built on the server, usually within a few minutes. It stays in My downloads for 7 days."
        : "One ZIP with a GeoTIFF per county, plus README and manifest. Usually ready in under a minute.";
    } else note.hidden = true;

    writeUrl();
    if (!session) document.querySelectorAll('a[href^="signin.html"]').forEach(link => {
      link.href = "signin.html?next=" + encodeURIComponent("download.html?" + selectionQuery());
    });
  }
  const STEP_NUM = { "step-region": 1, "step-year": 2, "step-window": 3, "step-cutoff": 4 };
  function stepState(id, done, locked) {
    const el = document.getElementById(id);
    el.classList.toggle("done", !!done);
    el.classList.toggle("locked", !!locked);
    el.querySelector(".step-num").textContent = done ? "✓" : STEP_NUM[id];
    el.querySelectorAll("button, input").forEach(c => { if (locked) c.setAttribute("tabindex", "-1"); else c.removeAttribute("tabindex"); });
  }

  // Local preview lifecycle. A late result may never overwrite a new selection.
  let jobRunning = false;
  const jobEl = document.getElementById("job");
  const jobStatus = document.getElementById("job-status");
  const task = createLatestTask(state => {
    const activeControl = document.activeElement;
    const shouldMove = jobEl.contains(activeControl) || activeControl?.id === "dl-btn";
    jobRunning = state.phase === "busy";
    jobEl.setAttribute("aria-busy", jobRunning);
    const messages = { idle: "", busy: "Building your package…", ready: "Package ready.", error: "The package could not be built. Your selection is preserved; try again." };
    jobStatus.textContent = messages[state.phase];
    jobEl.innerHTML = state.phase === "idle" ? "" : `<div class="status-card">
      <strong>${state.phase === "busy" ? "Building package" : state.phase === "ready" ? "Package ready" : "Build failed"}</strong>
      ${state.phase === "busy" ? '<progress class="job-progress" aria-label="Building package"></progress><div class="job-actions"><button class="btn btn-secondary btn-sm" id="cancel-job">Cancel</button></div>' : ""}
      ${state.phase === "ready" ? '<button class="btn btn-accent btn-block" style="margin-top:10px" id="save-zip">Save README preview (.txt)</button><p class="prototype-note" style="margin:8px 0 0">Prototype build: this saves the README the ZIP will contain. The full package is produced by the server in the live hub.</p>' : ""}
      ${state.phase === "error" ? '<div class="job-actions"><button class="btn btn-primary btn-sm" id="retry-job">Try again</button></div>' : ""}
    </div>`;
    const cancel = document.getElementById("cancel-job");
    if (cancel) cancel.onclick = () => { resetJob(); render(); jobStatus.textContent = "Cancelled. Your selection is unchanged."; document.getElementById("dl-btn").focus(); };
    const retry = document.getElementById("retry-job"); if (retry) retry.onclick = startJob;
    const save = document.getElementById("save-zip");
    if (save) save.onclick = () => {
      try { saveReadme(state.value); jobStatus.textContent = "Saved README_preview.txt to your browser downloads."; }
      catch { jobStatus.textContent = "The save failed. Your package is still ready; try again."; }
    };
    if (state.phase === "ready") {
      try { recordHistory(state.value); }
      catch { jobStatus.textContent += " History could not be saved in this browser."; }
    }
    render();
    if (shouldMove && state.phase !== "idle") (save || retry || cancel)?.focus();
  });
  function resetJob() {
    const wasRunning = jobRunning;
    task.cancel();
    if (wasRunning) jobStatus.textContent = "Previous build cancelled.";
  }
  function startJob() {
    if (!isComplete() || jobRunning) return;
    const snap = { counties: [...sel.counties], year: sel.year, window: sel.window, cutoff: sel.cutoff, words: regionWords(), bytes: estBytes(), query: selectionQuery(), preview: true };
    task.run(signal => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(snap); }, 0);
      const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
      signal.addEventListener("abort", abort, { once: true });
    }));
  }

  function recordHistory(snap) {
    const h = JSON.parse(localStorage.getItem("wph.history") || "[]");
    if (!Array.isArray(h)) throw new Error("Invalid history");
    h.unshift({ at: new Date().toISOString(), ...snap });
    localStorage.setItem("wph.history", JSON.stringify(h.slice(0, 50)));
  }

  // Prototype only: the real ZIP is streamed by Nginx. Here we save the README it would contain.
  function saveReadme(snap) {
    const names = snap.counties.map(f => byFips.get(f)).map(c =>
      `  WPH_${c.state}_${c.name.replace(/\s+/g, "")}_${c.fips}_${snap.year}_${HUB.window.code}_P${snap.cutoff}_${HUB.version}.tif`);
    const txt = [
      `${HUB.product} — ${HUB.version}`, `Package generated: ${new Date().toISOString().slice(0, 10)}`, "",
      "YOUR SELECTION", `  Region:  ${snap.words}`, `  Year:    ${snap.year}`, `  Window:  Full planting window (Mar 15 – Jun 30)`, `  Cutoff:  ${snap.cutoff}% persistence`, "",
      "FILES", "  README.txt       this file", "  manifest.csv     file list with SHA-256 checksums", "  TERMS.txt        Terms of Use v1.0", ...names, "",
      "RASTER", "  GeoTIFF, DEFLATE, uint8, 3 m, UTM (EPSG:32614 for Ramsey)", "  0 = did not pass cutoff · 1 = standing water · 255 = nodata", "",
      "NOT A PREVENTED-PLANTING ELIGIBILITY DETERMINATION.", "",
      "Cite: Funded by USDA Risk Management Agency; produced by the University of Illinois Urbana-Champaign.",
      `Questions: ${HUB.contactEmail} · Report a data problem: ${HUB.issuesEmail}`
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = "README_preview.txt"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Actions ----------
  const termsModal = document.getElementById("terms-modal");
  document.getElementById("dl-btn").addEventListener("click", () => {
    if (!isComplete() || jobRunning) return;
    if (!session) { location.href = "signin.html?next=" + encodeURIComponent("download.html?" + selectionQuery()); return; }
    if (!session.termsAcceptedAt) { openModal(termsModal); return; }
    startJob();
  });
  const termsCb = document.getElementById("terms-cb"), termsOk = document.getElementById("terms-ok");
  termsCb.onchange = () => termsOk.disabled = !termsCb.checked;
  document.getElementById("terms-cancel").onclick = () => closeModal(termsModal);
  termsOk.onclick = () => {
    if (!termsCb.checked) return;
    session.termsAcceptedAt = new Date().toISOString(); session.termsVersion = HUB.termsVersion;
    try { Session.set(session); }
    catch { toast("Terms could not be saved in this browser. Please try again."); return; }
    closeModal(termsModal); startJob();
  };

  document.getElementById("share-btn").onclick = () => {
    const url = new URL(location.href); url.search = selectionQuery();
    copyText(url.href, "Selection link copied.");
  };
  const apiModal = document.getElementById("api-modal");
  document.getElementById("api-btn").onclick = () => {
    document.getElementById("api-code").innerHTML =
      `<span class="c"># Request a package for this selection</span>\ncurl -X POST \\\n  -H "Authorization: Token $WPH_TOKEN" \\\n  "https://waterhub.illinois.edu/api/v1/packages?${selectionQuery().replace(/&/g, "&amp;")}"\n\n<span class="c"># Poll until status = ready, then fetch download_url</span>\ncurl -H "Authorization: Token $WPH_TOKEN" \\\n  https://waterhub.illinois.edu/api/v1/packages/&lt;id&gt;`;
    openModal(apiModal);
  };
  document.getElementById("api-close").onclick = () => closeModal(apiModal);
  document.getElementById("api-copy").onclick = () => copyText(document.getElementById("api-code").innerText, "Request copied.");

  // ---------- Init ----------
  document.getElementById("signin-note").hidden = !!session;
  readUrl();
  if (sel.counties.size) {
    onRegionChange();
    document.getElementById("map-hint").hidden = true;
    setTimeout(() => document.getElementById("zoom-fit").click(), 50);
  } else render();
})();
