/* Download page: one selection state drives the map, the list, the summary and the URL.
   Rebuilt per Design Feedback v1 (2026-10-07): the raster stores a continuous
   percentage, so there is no cutoff *selection* step any more — only
   counties, years and a planting window. 70/80/90% survive only as a
   *viewing* filter on the results-viewer map (D13).
   In Django the catalogue (COUNTIES) and package jobs come from the server;
   the selection logic and URL format stay the same. */
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

  const sel = { counties: new Set(), years: new Set(), window: null };
  const session = Session.get();

  // ---------- URL state (DL-12) ----------
  function readUrl() {
    const q = new URLSearchParams(location.search);
    (q.get("counties") || "").split(",").filter(f => byFips.has(f) && byFips.get(f).years.length).forEach(f => sel.counties.add(f));
    (q.get("state") || "").split(",").forEach(st => coveredIn(st).forEach(c => sel.counties.add(c.fips)));
    (q.get("years") || "").split(",").map(Number).filter(y => HUB.years.some(hy => hy.y === y && hy.status === "available")).forEach(y => sel.years.add(y));
    const w = q.get("window"); if (HUB.windows.some(x => x.id === w)) sel.window = w;
  }
  function selectionQuery() {
    const q = new URLSearchParams();
    if (sel.counties.size) q.set("counties", [...sel.counties].join(","));
    if (sel.years.size) q.set("years", [...sel.years].sort().join(","));
    if (sel.window) q.set("window", sel.window);
    return q.toString();
  }
  function writeUrl() { try { history.replaceState(null, "", "?" + selectionQuery()); } catch { /* Local file URLs may restrict history updates. */ } }

  // ---------- Derived values ----------
  const isComplete = () => sel.counties.size && sel.years.size && sel.window;
  function estBytes() {
    // One percentage file per county per year (not one per cutoff). The 80%
    // sample size stands in for "the" file size until real per-year sizes exist.
    let b = README_BYTES;
    sel.counties.forEach(f => { b += byFips.get(f).size["80"] * Math.max(1, sel.years.size); });
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
  function windowPhrase(id) {
    const w = HUB.windows.find(x => x.id === id);
    if (!w) return "";
    if (!w.varies) return `${w.label} window (${w.from} – ${w.to})`;
    return `${w.label} window (varies by county)`;
  }
  function selectedList() {
    return [...sel.counties].map(f => byFips.get(f)).sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
  }

  // ---------- Map ----------
  let map = null, fullBounds;
  let layer = { setStyle() {}, eachLayer() {} };
  const styleFor = p => {
    const on = sel.counties.has(p.fips);
    if (!p.years.length) return { color: "#cfd5de", weight: 0.8, fillColor: "url(#hatch)", fillOpacity: 1 };
    const previewing = on && overlayVisible && p.fips === currentViewerFips();
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
      const status = p.years.length ? "2025 available" : "Not yet available";
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
    document.querySelectorAll(".map-tools, .map-legend, .map-hint, .viewer-bar").forEach(el => el.hidden = true);
  }

  // ---------- Results viewer (D13) ----------
  // Only Ramsey County, ND 2025 has a real rendered preview in this prototype
  // (see REFINEMENT notes on feasibility). Every other county shows an honest
  // "not available yet" status instead of a fabricated preview.
  const rb = window.RAMSEY_PREVIEW?.bounds;
  const rBounds = rb ? [[rb[1], rb[0]], [rb[3], rb[2]]] : null;
  let overlay = null, overlayKey = "__init__", overlayVisible = false; // sentinel so the first render always evaluates the status message, even when there is no overlay to show (key would otherwise start equal to null)
  const viewerBar = document.getElementById("viewer-bar");
  const imageStatus = document.getElementById("map-image-status");
  const viewer = { idx: 0, year: null, threshold: 80 };
  function currentViewerFips() { const l = selectedList(); return l[viewer.idx]?.fips; }

  function renderViewer() {
    const list = selectedList();
    viewerBar.hidden = list.length === 0;
    if (!list.length) { if (overlay) { map.removeLayer(overlay); overlay = null; } overlayVisible = false; imageStatus.hidden = true; return; }
    viewer.idx = Math.min(viewer.idx, list.length - 1);
    if (!sel.years.has(viewer.year)) viewer.year = [...sel.years].sort().pop() || 2025;
    const c = list[viewer.idx];

    document.getElementById("viewer-county").textContent = `${c.name} County, ${c.state}`;
    document.getElementById("viewer-county-n").textContent = list.length > 1 ? `(${viewer.idx + 1} of ${list.length})` : "";
    document.getElementById("county-prev").disabled = list.length < 2;
    document.getElementById("county-next").disabled = list.length < 2;

    const yearSel = document.getElementById("viewer-year");
    const years = sel.years.size ? [...sel.years].sort((a, b) => b - a) : [2025];
    yearSel.innerHTML = years.map(y => `<option value="${y}" ${y === viewer.year ? "selected" : ""}>${y}</option>`).join("");

    document.querySelectorAll("#viewer-threshold button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.p === viewer.threshold));

    // Overlay: real image only for Ramsey, 2025.
    const canPreview = map && rb && c.fips === "38071" && viewer.year === 2025;
    const key = canPreview ? viewer.threshold : null;
    overlayVisible = canPreview;
    if (key !== overlayKey) {
      overlayKey = key;
      imageStatus.hidden = true;
      if (overlay) { map.removeLayer(overlay); overlay = null; }
      if (canPreview) {
        imageStatus.hidden = false; imageStatus.textContent = "Loading preview…";
        const current = L.imageOverlay(`assets/img/ramsey_${viewer.threshold}.png`, rBounds, { opacity: 1, interactive: false });
        overlay = current;
        current.on("load", () => { if (overlay === current) imageStatus.hidden = true; });
        current.on("error", () => { if (overlay === current) { imageStatus.hidden = false; imageStatus.textContent = "Preview image failed to load. Your selection is preserved."; } });
        current.addTo(map);
      } else {
        imageStatus.hidden = false;
        imageStatus.textContent = `Preview not available yet for ${c.name} County — only Ramsey County, ND has a rendered preview in this beta. Your download will still include the full data.`;
      }
    }
    layer.setStyle(f => styleFor(f.properties));
  }
  document.getElementById("county-prev").onclick = () => { viewer.idx = (viewer.idx - 1 + selectedList().length) % selectedList().length; overlayKey = undefined; renderViewer(); };
  document.getElementById("county-next").onclick = () => { viewer.idx = (viewer.idx + 1) % selectedList().length; overlayKey = undefined; renderViewer(); };
  document.getElementById("viewer-year").onchange = e => { viewer.year = +e.target.value; overlayKey = undefined; renderViewer(); };
  document.getElementById("viewer-threshold").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    viewer.threshold = +b.dataset.p; overlayKey = undefined; renderViewer();
  });

  // ---------- Combobox (DL-02) ----------
  const input = document.getElementById("county-search");
  const list = document.getElementById("county-list");
  const combo = document.getElementById("combo");
  let options = [], active = -1;

  // H15: rank "starts with" above "contains"; ND counties always listed before SD.
  function buildOptions(q) {
    q = q.trim().toLowerCase();
    const out = [];
    ["ND", "SD"].forEach(st => {
      const stateMatch = STATE_NAMES[st].toLowerCase().startsWith(q) || st.toLowerCase() === q;
      const scored = features.map(f => f.properties).filter(c => c.state === st).map(c => {
        const name = c.name.toLowerCase();
        let rank = -1;
        if (!q || stateMatch) rank = name.startsWith(q) ? 3 : 2;
        else if (name.startsWith(q)) rank = 3;
        else if (name.includes(q)) rank = 1;
        return { c, rank };
      }).filter(x => x.rank >= 0);
      if (!scored.length) return;
      scored.sort((a, b) => b.rank - a.rank || a.c.name.localeCompare(b.c.name));
      out.push({ group: STATE_NAMES[st] });
      scored.forEach(({ c }) => out.push({ fips: c.fips, label: `${c.name} County, ${c.state}`, disabled: !c.years.length }));
    });
    return out;
  }
  function renderList() {
    options = buildOptions(input.value);
    let i = 0;
    list.innerHTML = options.map(o => {
      if (o.group) return `<li class="group" role="presentation">${o.group}</li>`;
      const id = `opt-${i}`; o.idx = i++;
      const on = sel.counties.has(o.fips);
      const right = o.disabled ? '<span class="badge badge-muted">Not yet</span>' : (on ? '<span class="tick">✓</span>' : "");
      return `<li id="${id}" role="option" aria-selected="${on}" ${o.disabled ? 'aria-disabled="true"' : ""} data-i="${o.idx}">${o.label}${right}</li>`;
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
    toggleCounty(o.fips);
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
    // One real published year today — pre-check it the first time a county is
    // picked, the way a single-option year used to auto-select (H17 keeps the
    // full 2022–2026 grid visible, but there is still only one real choice).
    if (sel.counties.size && sel.years.size === 0) sel.years.add(2025);
    if (sel.years.size && !sel.window) sel.window = "default";
    resetJob(); render();
  }
  document.querySelectorAll("[data-state]").forEach(b => b.addEventListener("click", () => toggleState(b.dataset.state)));
  document.getElementById("clear-counties").onclick = () => { sel.counties.clear(); viewer.idx = 0; onRegionChange(); };

  // ---------- Render ----------
  let showAllChips = false;
  function render() {
    const focused = document.activeElement;
    const removedId = focused?.dataset.rm;
    const wasMore = focused?.id === "more-chips";

    // Step 1: counties
    const n = sel.counties.size;
    document.querySelectorAll("[data-state]").forEach(b => b.setAttribute("aria-pressed", coveredIn(b.dataset.state).every(c => sel.counties.has(c.fips))));
    document.getElementById("selected-panel").hidden = n === 0;
    document.getElementById("selected-count").textContent = n === 1 ? "1 selected" : `${n} selected`;
    const chips = selectedList();
    const shown = showAllChips ? chips : chips.slice(0, 8);
    document.getElementById("chips").innerHTML = shown.map(c => `<span class="chip"><span class="chip-t" title="${c.name} County, ${c.state}">${c.name}, ${c.state}</span><button aria-label="Remove ${c.name} County" data-rm="${c.fips}">×</button></span>`).join("")
      + (chips.length > 8 ? `<button type="button" class="chips-more" id="more-chips">${showAllChips ? "Show less" : `+${chips.length - 8} more`}</button>` : "");
    document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => toggleCounty(b.dataset.rm));
    const more = document.getElementById("more-chips"); if (more) more.onclick = () => { showAllChips = !showAllChips; render(); };
    if (removedId) (document.querySelector(`[data-rm="${removedId}"]`) || document.querySelector("[data-rm]") || input).focus();
    if (wasMore) (more || input).focus();
    stepState("step-region", n > 0, false);

    // Step 2: years (multi-select checkboxes)
    const yearHost = document.getElementById("years");
    if (!yearHost.children.length) {
      yearHost.innerHTML = HUB.years.map(({ y, status }) => `
        <label class="year-opt ${status !== "available" ? "is-disabled" : ""}">
          <input type="checkbox" value="${y}" ${status !== "available" ? "disabled" : ""}>
          <span class="year-opt-y">${y}</span>
          <span class="year-opt-s">${status === "available" ? "Available" : "In progress"}</span>
        </label>`).join("");
      yearHost.querySelectorAll("input").forEach(cb => cb.onchange = () => {
        const y = +cb.value;
        cb.checked ? sel.years.add(y) : sel.years.delete(y);
        resetJob(); render();
      });
    }
    yearHost.querySelectorAll("input").forEach(cb => { cb.checked = sel.years.has(+cb.value); cb.disabled = !n || cb.disabled; });
    stepState("step-year", sel.years.size > 0, !n);

    // Step 3: planting window
    const winHost = document.getElementById("windows");
    if (!winHost.children.length) {
      winHost.innerHTML = HUB.windows.map(w => `
        <label class="window-opt">
          <input type="radio" name="window" value="${w.id}">
          <span class="window-opt-body">
            <span class="window-opt-t">${w.label}${w.id === "default" ? ` <span class="badge">${w.from} – ${w.to}</span>` : ""}</span>
            <span class="window-opt-d" id="win-hint-${w.id}"></span>
          </span>
        </label>`).join("");
      winHost.querySelectorAll("input").forEach(r => r.onchange = () => { sel.window = r.value; resetJob(); render(); });
    }
    winHost.querySelectorAll("input").forEach(r => { r.checked = sel.window === r.value; r.disabled = !sel.years.size; });
    const states = [...new Set(chips.map(c => c.state))];
    HUB.windows.forEach(w => {
      const hint = document.getElementById(`win-hint-${w.id}`);
      if (!w.varies) { hint.textContent = "Same dates for every county."; return; }
      hint.textContent = states.length
        ? states.map(st => `${st}: ${w.example[st]} (example)`).join(" · ") + " — exact dates by county in the README"
        : "Dates vary by county — shown once counties are selected";
    });
    stepState("step-window", !!sel.window, !sel.years.size);

    // Summary
    const st = document.getElementById("summary-text");
    if (!n) { st.textContent = "Pick at least one county to begin."; st.classList.add("empty"); }
    else {
      st.classList.remove("empty");
      const yearsTxt = sel.years.size ? [...sel.years].sort().join(", ") : "choose a year";
      st.textContent = [regionWords(), yearsTxt, sel.window ? windowPhrase(sel.window) : (sel.years.size ? "choose a planting window" : null), n ? HUB.formatBytes(estBytes()) : null].filter(Boolean).join(" · ");
    }
    document.getElementById("s-count").textContent = n;
    document.getElementById("s-years").textContent = sel.years.size ? [...sel.years].sort().join(", ") : "—";
    document.getElementById("s-size").textContent = n ? HUB.formatBytes(estBytes()) : "—";

    // Download button — active even when signed out (it routes to sign-in, D7).
    const btn = document.getElementById("dl-btn");
    const note = document.getElementById("route-note");
    const ready = isComplete();
    btn.disabled = jobRunning || (ready ? false : true);
    if (!session && ready) btn.disabled = false;
    btn.textContent = jobRunning ? "Building your package…" : !session ? "Sign in to download" : "Download ZIP";
    if (ready) {
      const big = estBytes() > 500 * 1024 * 1024;
      note.hidden = false;
      note.textContent = big
        ? "Large package: built on the server, usually within a few minutes. It stays in My downloads for 7 days."
        : "One ZIP with a GeoTIFF per county and year, plus README and manifest. Usually ready in under a minute.";
    } else note.hidden = true;

    renderViewer();
    writeUrl();
  }
  const STEP_NUM = { "step-region": 1, "step-year": 2, "step-window": 3 };
  function stepState(id, done, locked) {
    const el = document.getElementById(id);
    el.classList.toggle("done", !!done);
    el.classList.toggle("locked", !!locked);
    el.querySelector(".step-num").textContent = done ? "✓" : STEP_NUM[id];
    el.querySelectorAll("button, input, select").forEach(c => { if (locked) c.setAttribute("tabindex", "-1"); else c.removeAttribute("tabindex"); });
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
      ${state.phase === "ready" ? '<button class="btn btn-primary btn-block" style="margin-top:10px" id="save-zip">Save README preview (.txt)</button><p class="prototype-note" style="margin:8px 0 0">Prototype build: this saves the README the ZIP will contain. The full package is produced by the server in the live hub.</p>' : ""}
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
    const snap = { counties: [...sel.counties], years: [...sel.years].sort(), window: sel.window, words: regionWords(), bytes: estBytes(), query: selectionQuery() };
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
    const w = HUB.windows.find(x => x.id === snap.window);
    const names = [];
    snap.counties.map(f => byFips.get(f)).forEach(c => snap.years.forEach(y =>
      names.push(`  WPH_${c.state}_${c.name.replace(/\s+/g, "")}_${c.fips}_${y}_${w.code}_${HUB.version}.tif`)));
    const txt = [
      `${HUB.product} — ${HUB.version}`, `Package generated: ${new Date().toISOString().slice(0, 10)}`, "",
      "YOUR SELECTION", `  Region:   ${snap.words}`, `  Years:    ${snap.years.join(", ")}`,
      `  Window:   ${w.label}${w.varies ? " (dates vary by county — see per-county table below)" : ` (${w.from} – ${w.to})`}`, "",
      "FILES", "  README.txt       this file", "  manifest.csv     file list with SHA-256 checksums", "  TERMS.txt        Terms of Use v1.0", ...names, "",
      "RASTER", "  GeoTIFF, DEFLATE, uint8, 3 m, UTM (EPSG:32614 for Ramsey)",
      "  0–100 = percentage of usable days the pixel was labelled water · 255 = no data", "",
      "NOT A PREVENTED-PLANTING ELIGIBILITY DETERMINATION.", "",
      "Cite: Funded by USDA Risk Management Agency; produced by the University of Illinois Urbana-Champaign.",
      `Questions and data problems: ${HUB.contactEmail}`
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
  // Scripted access (API): marked "coming soon" and disabled (H13) — no handler needed.

  // ---------- Init ----------
  readUrl();
  if (sel.counties.size) {
    if (sel.years.size === 0) sel.years.add(2025);
    if (!sel.window) sel.window = "default";
    document.getElementById("map-hint").hidden = true;
    setTimeout(() => document.getElementById("zoom-fit")?.click(), 50);
  }
  render();
})();
