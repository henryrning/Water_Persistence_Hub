/* My downloads (DL-14). Real rows come from selections built in this browser;
   two sample rows show the design when history is empty and are labelled as such. */
(() => {
  const s = Session.get(), $ = id => document.getElementById(id);
  if (!s) { location.replace("signin.html?next=account.html"); return; }
  $("who").textContent = `${s.name} · ${s.org}`;

  const acct = $("acct");
  const add = (label, node) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.append(node); acct.append(dt, dd); };
  add("Email", document.createTextNode(s.email));
  add("Organisation", document.createTextNode(s.org));
  add("Role", document.createTextNode(s.role === "admin" ? "Administrator" : "Data user"));
  const terms = document.createElement("span");
  if (s.termsAcceptedAt) {
    terms.innerHTML = `<span class="badge badge-good">${HUB.termsVersion} accepted</span><br><span class="small muted"></span>`;
    terms.querySelector(".small").textContent = new Date(s.termsAcceptedAt).toLocaleString();
  } else terms.innerHTML = '<span class="badge badge-warn">Not yet accepted</span><br><span class="small muted">You’ll be asked at your first download.</span>';
  add("Terms", terms);

  $("pw-reset").onclick = () => { const st = $("pw-status"); st.classList.add("good"); st.textContent = "A one-time reset link is emailed to your address. (No email is sent in this prototype.)"; };
  $("token-copy").onclick = () => copyText($("token").value, "Sample token copied.");

  let history;
  try { history = JSON.parse(localStorage.getItem("wph.history") || "[]"); if (!Array.isArray(history)) throw new Error("Invalid history"); }
  catch { $("history-error").hidden = false; $("history-table").hidden = true; return; }
  const valid = history.filter(h => h && typeof h.words === "string" && Number.isFinite(h.year) && [70, 80, 90].includes(h.cutoff) && Array.isArray(h.counties) && !Number.isNaN(Date.parse(h.at)));

  const days = d => new Date(Date.now() - d * 864e5).toISOString();
  const samples = [
    { sample: true, at: days(2), words: "All 33 covered counties in North Dakota", year: 2025, cutoff: 80, bytes: 172e6, query: "state=ND&year=2025&window=full&cutoff=80", counties: new Array(33) },
    { sample: true, at: days(21), words: "Ramsey County, ND", year: 2025, cutoff: 90, bytes: 1.97e6, query: "counties=38071&year=2025&window=full&cutoff=90", counties: ["38071"] }
  ];
  const rows = valid.concat(samples);
  $("history-note").hidden = false;

  for (const h of rows) {
    const live = (Date.now() - new Date(h.at)) / 864e5 < 7;
    const tr = document.createElement("tr");
    const selection = document.createElement("td");
    const title = document.createElement("div"); title.className = "cell-main"; title.textContent = h.words;
    const detail = document.createElement("div"); detail.className = "cell-sub";
    detail.textContent = `${h.year} · full planting window · ${h.cutoff}% persistence · ${h.counties.length} GeoTIFF${h.counties.length > 1 ? "s" : ""}`;
    selection.append(title, detail);
    const date = document.createElement("td"); date.textContent = new Date(h.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const size = document.createElement("td"); size.className = "num"; size.textContent = Number.isFinite(h.bytes) ? HUB.formatBytes(h.bytes) : "—";
    const status = document.createElement("td");
    status.innerHTML = live ? '<span class="badge badge-good badge-dot">Ready</span>' : '<span class="badge badge-muted">Expired</span>';
    if (h.sample) status.insertAdjacentHTML("beforeend", ' <span class="badge badge-muted">Sample</span>');
    const actions = document.createElement("td"); actions.className = "actions";
    if (live) {
      const save = document.createElement("button"); save.className = "btn btn-secondary btn-sm"; save.type = "button"; save.textContent = "Save ZIP";
      save.onclick = () => toast("Prototype: in the live hub this streams the ZIP from the server.");
      actions.append(save, document.createTextNode(" "));
    }
    const reopen = document.createElement("a"); reopen.className = "btn btn-ghost btn-sm"; reopen.textContent = "Re-open";
    const q = h.query || new URLSearchParams({ counties: h.counties.filter(id => /^\d{5}$/.test(id)).join(","), year: String(h.year), window: "full", cutoff: String(h.cutoff) }).toString();
    reopen.href = `download.html?${q}`;
    actions.append(reopen);
    tr.append(selection, date, size, status, actions);
    $("hist").append(tr);
  }
})();
