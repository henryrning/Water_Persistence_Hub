/* Admin console. All numbers here are generated sample data; in Django they come
   from the download/visit event tables via the same queries that feed the CSV export. */
(function () {
  const HUB = window.HUB;
  const s = Session.get();
  if (!s || s.role !== "admin") {
    document.querySelector(".admin-main").innerHTML = `<div class="card card-pad" style="max-width:520px;margin:40px auto;text-align:center">
      <h1 style="font-size:1.5rem">Administrators only</h1><p class="muted">Sign in with an administrator account to see this page.</p>
      <a class="btn btn-primary" href="signin.html?next=admin.html">Sign in</a></div>`;
    document.querySelector(".admin-side").hidden = true;
    return;
  }

  // ---------- Deterministic sample data ----------
  let seed = 7;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pois = m => { let L = Math.exp(-m), k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const weighted = pairs => { let r = rnd() * pairs.reduce((a, p) => a + p[1], 0); for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; };

  const covered = COUNTIES.features.map(f => f.properties).filter(p => p.years.length);
  const hot = ["Ramsey", "Benson", "Stutsman", "Brown", "Towner", "Nelson", "Day", "Spink", "Cavalier", "Barnes"];
  const countyW = covered.map(c => [c, hot.includes(c.name) ? 6 - hot.indexOf(c.name) * 0.4 : 0.6]);
  const orgs = [["Rain and Hail", "rainhail.com"], ["NAU Country", "nau.com"], ["Farmers Mutual Hail", "farmersmutualhail.com"], ["ProAg", "proag.com"],
    ["Great American Insurance", "americanfinancialgroup.com"], ["Crop Risk Services", "ccig.com"], ["USDA RMA — Billings RO", "usda.gov"], ["USDA RMA — St. Paul RO", "usda.gov"], ["USDA RMA — Kansas City", "usda.gov"]];

  const DAYS = 90, today = new Date(); today.setHours(12, 0, 0, 0);
  const dayISO = i => new Date(today - (DAYS - 1 - i) * 864e5).toISOString().slice(0, 10);
  const events = [], visits = [];
  for (let i = 0; i < DAYS; i++) {
    const d = dayISO(i), wd = new Date(d).getDay(), weekend = wd === 0 || wd === 6;
    const ramp = 0.35 + 0.65 * i / DAYS;
    const n = pois((weekend ? 1.2 : 5.5) * ramp);
    for (let k = 0; k < n; k++) {
      const o = pick(orgs), multi = rnd() < 0.18;
      const cs = multi ? Array.from({ length: 2 + Math.floor(rnd() * 6) }, () => weighted(countyW)) : [weighted(countyW)];
      events.push({ date: d, org: o[0], domain: o[1], counties: cs, cutoff: weighted([[80, 5], [90, 3], [70, 2]]), kind: "interactive" });
    }
    if (i > DAYS - 40) events.push({ date: d, org: "NAU Country", domain: "nau.com", counties: [pick(covered)], cutoff: 80, kind: "scripted" });
    const land = Math.round((weekend ? 28 : 70) * ramp + rnd() * 20);
    visits.push({ date: d, landing: land, download: Math.round(land * (0.42 + rnd() * 0.08)), docs: Math.round(land * (0.3 + rnd() * 0.1)), uniq: Math.round(land * 0.8), newv: Math.round(land * 0.45) });
  }
  events.forEach(e => { e.bytes = e.counties.reduce((a, c) => a + c.size[e.cutoff], 24e3); });

  // ---------- Tabs ----------
  const tabs = document.querySelectorAll("[role=tab]");
  const tabNav = document.querySelector(".admin-side");
  tabNav.setAttribute("role", "tablist"); tabNav.setAttribute("aria-orientation", "vertical");
  tabNav.querySelectorAll("ul").forEach(list => { list.removeAttribute("role"); list.removeAttribute("aria-orientation"); });
  tabs.forEach((tab, index) => {
    tab.id = `admin-tab-${tab.dataset.tab}`; tab.tabIndex = index === 0 ? 0 : -1;
    tab.setAttribute("aria-controls", `tab-${tab.dataset.tab}`);
    const panel = document.getElementById(`tab-${tab.dataset.tab}`); panel.setAttribute("aria-labelledby", tab.id); panel.tabIndex = 0;
    tab.addEventListener("keydown", event => {
      let target;
      if (["ArrowDown", "ArrowRight"].includes(event.key)) target = (index + 1) % tabs.length;
      if (["ArrowUp", "ArrowLeft"].includes(event.key)) target = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") target = 0;
      if (event.key === "End") target = tabs.length - 1;
      if (target !== undefined) { event.preventDefault(); tabs[target].click(); tabs[target].focus(); }
    });
  });
  tabs.forEach(t => t.addEventListener("click", () => {
    tabs.forEach(x => { x.setAttribute("aria-selected", x === t); x.tabIndex = x === t ? 0 : -1; });
    document.querySelectorAll("[role=tabpanel]").forEach(p => p.hidden = p.id !== "tab-" + t.dataset.tab);
    if (t.dataset.tab === "analytics") drawAnalytics();
  }));

  // ---------- CSV helper (ANL-05, AUTH-09) ----------
  function csv(name, rows) {
    const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
    const blob = new Blob([rows.map(r => r.map(esc).join(",")).join("\r\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    toast(`Exported ${name}`);
  }

  // ---------- Analytics ----------
  let range = 30;
  document.querySelectorAll("#range button").forEach(b => b.onclick = () => {
    range = +b.dataset.days;
    document.querySelectorAll("#range button").forEach(x => x.setAttribute("aria-pressed", x === b));
    drawAnalytics();
  });

  const inRange = (arr, from, to) => arr.filter(e => e.date >= from && e.date <= to);
  const fmt = n => n >= 1e4 ? (n / 1e3).toFixed(1) + "K" : n.toLocaleString();
  const C1 = "#2a78d6", C2 = "#eb6834";

  function card(el, title, sub, bodyHtml, tableHtml, csvRows, csvName) {
    el.innerHTML = `<div class="card-head"><div><h3>${title}</h3><p>${sub}</p></div>
      <div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm table-toggle" aria-pressed="false">Table</button>
      <button class="btn btn-ghost btn-sm" data-csv>CSV</button></div></div>
      <div class="chart-body">${bodyHtml}</div><div class="table-wrap" hidden>${tableHtml}</div>`;
    const tg = el.querySelector(".table-toggle");
    tg.onclick = () => {
      const on = tg.getAttribute("aria-pressed") !== "true";
      tg.setAttribute("aria-pressed", on); tg.textContent = on ? "Chart" : "Table";
      el.querySelector(".chart-body").hidden = on; el.querySelector(".table-wrap").hidden = !on;
    };
    el.querySelector("[data-csv]").onclick = () => csv(csvName, csvRows);
  }
  const table = (head, rows) => `<table class="data"><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ""}>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ""}>${typeof c === "number" ? c.toLocaleString() : c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  function drawAnalytics() {
    const to = dayISO(DAYS - 1), from = dayISO(DAYS - range);
    const ev = inRange(events, from, to), vi = inRange(visits, from, to);
    const prevEv = range < DAYS ? inRange(events, dayISO(DAYS - 2 * range), dayISO(DAYS - range - 1)) : null;
    const inter = ev.filter(e => e.kind === "interactive"), scripted = ev.length - inter.length;
    const orgsN = new Set(ev.map(e => e.org)).size;
    const uniq = vi.reduce((a, v) => a + v.uniq, 0), newv = vi.reduce((a, v) => a + v.newv, 0);
    const delta = (cur, prev) => {
      if (!prev || range * 2 > DAYS) return `vs previous ${range} days: —`;
      const d = Math.round((cur - prev) / Math.max(prev, 1) * 100);
      return `<b style="color:${d >= 0 ? "" : "var(--bad)"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}%</b> vs previous ${range} days`;
    };
    const registered = 58, downloaded = 41;
    document.getElementById("tiles").innerHTML = `
      <div class="tile hero-tile"><div class="k">Downloads</div><div class="v">${fmt(ev.length)}</div><div class="d">${inter.length} interactive · ${scripted} scripted<br>${delta(ev.length, prevEv && prevEv.length)}</div></div>
      <div class="tile"><div class="k">Downloading organisations</div><div class="v">${orgsN}</div><div class="d">${new Set(ev.map(e => e.domain)).size} email domains</div></div>
      <div class="tile"><div class="k">Accounts that downloaded</div><div class="v">${downloaded} <span style="font-size:1rem;color:var(--ink-3);font-weight:600">of ${registered}</span></div><div class="d">${Math.round(downloaded / registered * 100)}% of registered accounts</div></div>
      <div class="tile"><div class="k">Unique visitors</div><div class="v">${fmt(uniq)}</div><div class="d">${Math.round(newv / uniq * 100)}% new · ${100 - Math.round(newv / uniq * 100)}% returning</div></div>`;

    // Trend (ANL-08: interactive vs scripted as two series on one axis)
    const weekly = range > 30;
    const buckets = [];
    for (let i = DAYS - range; i < DAYS; i += weekly ? 7 : 1) {
      const a = dayISO(i), b = dayISO(Math.min(i + (weekly ? 6 : 0), DAYS - 1));
      const es = inRange(events, a, b);
      buckets.push({ label: a, end: b, i: es.filter(e => e.kind === "interactive").length, s: es.filter(e => e.kind === "scripted").length });
    }
    drawTrend(buckets, weekly);

    // Funnel (ANL-09)
    const fl = [["Home page visits", vi.reduce((a, v) => a + v.landing, 0)], ["Download page visits", vi.reduce((a, v) => a + v.download, 0)], ["Completed downloads", inter.length]];
    const ramp = ["#86b6ef", "#2a78d6", "#104281"];
    card(document.getElementById("c-funnel"), "Visit-to-download funnel", "Interactive downloads only",
      fl.map(([k, v], i) => `<div class="funnel-row"><span>${k}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1.5, v / fl[0][1] * 100)}%;background:${ramp[i]}"></div></div><span class="num">${v.toLocaleString()}</span>
        ${i ? `<span class="drop">${(v / fl[i - 1][1] * 100).toFixed(1)}% of previous step</span>` : ""}</div>`).join(""),
      table(["Step", "Count"], fl), [["step", "count"], ...fl], `funnel_${from}_${to}.csv`);

    // By cutoff
    const byCut = [70, 80, 90].map(p => [p + "%", ev.filter(e => e.cutoff === p).length]);
    card(document.getElementById("c-cutoff"), "Downloads by persistence cutoff", `${from} to ${to}`,
      columns(byCut), table(["Cutoff", "Downloads"], byCut), [["cutoff", "downloads"], ...byCut], `downloads_by_cutoff_${from}_${to}.csv`);

    // By county (multi-county requests count once per county)
    const cc = new Map();
    ev.forEach(e => new Set(e.counties.map(c => c.fips)).forEach(f => cc.set(f, (cc.get(f) || 0) + 1)));
    const byCounty = [...cc].map(([f, n]) => { const c = covered.find(x => x.fips === f); return [`${c.name}, ${c.state}`, n]; }).sort((a, b) => b[1] - a[1]);
    const st = ["ND", "SD"].map(x => [x, byCounty.filter(r => r[0].endsWith(x)).reduce((a, r) => a + r[1], 0)]);
    const top = byCounty.slice(0, 8), mx = top[0] ? top[0][1] : 1;
    card(document.getElementById("c-county"), "Top counties", `ND ${st[0][1]} · SD ${st[1][1]} county downloads`,
      top.map(([k, v]) => `<div class="funnel-row" style="grid-template-columns:130px 1fr 44px;margin-bottom:8px" title="${k}: ${v}"><span>${k}</span><div class="bar-track" style="height:14px;background:none"><div class="bar-fill" style="width:${v / mx * 100}%;background:${C1}"></div></div><span class="num">${v}</span></div>`).join(""),
      table(["County", "Downloads"], byCounty), [["county", "downloads"], ...byCounty], `downloads_by_county_${from}_${to}.csv`);

    // Page views + referrers (ANL-02)
    const pv = [["Home", fl[0][1]], ["Download", fl[1][1]], ["Documentation", vi.reduce((a, v) => a + v.docs, 0)], ["Request access", Math.round(fl[0][1] * 0.06)], ["About / Contact", Math.round(fl[0][1] * 0.09)]];
    const refs = [["Direct / bookmark", 46], ["rma.usda.gov", 27], ["Email links", 15], ["Search engines", 9], ["Other", 3]];
    document.getElementById("c-pages").innerHTML = `<div class="card-head"><div><h3>Page views &amp; referrers</h3><p>${uniq.toLocaleString()} unique visitors · ${Math.round(uniq * 1.35).toLocaleString()} sessions</p></div>
      <button class="btn btn-ghost btn-sm" id="pv-csv">CSV</button></div>
      <div class="grid grid-2" style="gap:0">
        <div>${table(["Page", "Views"], pv)}</div>
        <div style="border-left:1px solid var(--line-2)">${table(["Referrer", "Share"], refs.map(r => [r[0], r[1] + "%"]))}</div>
      </div>`;
    document.getElementById("pv-csv").onclick = () => csv(`page_views_${from}_${to}.csv`, [["page", "views"], ...pv, [], ["referrer", "share_pct"], ...refs]);

    document.getElementById("export-all").onclick = () => csv(`downloads_${from}_${to}.csv`,
      [["date", "organisation", "domain", "counties", "year", "window", "cutoff", "package_bytes", "type"],
        ...ev.map(e => [e.date, e.org, e.domain, e.counties.map(c => c.fips).join(" "), 2025, "full", e.cutoff, e.bytes, e.kind])]);
  }

  // Line chart with crosshair tooltip
  function drawTrend(b, weekly) {
    const el = document.getElementById("c-trend");
    const rows = b.map(x => [weekly ? `Week of ${x.label}` : x.label, x.i, x.s]);
    card(el, `Downloads per ${weekly ? "week" : "day"}`, "Scripted pulls are shown separately so automated jobs don’t read as adoption",
      `<div style="display:flex;gap:18px;font-size:.84rem;color:var(--ink-2);margin-bottom:6px">
        <span style="display:flex;gap:6px;align-items:center"><i style="display:inline-block;width:14px;height:3px;background:${C1};border-radius:2px"></i>Interactive</span>
        <span style="display:flex;gap:6px;align-items:center"><i style="display:inline-block;width:14px;height:3px;background:${C2};border-radius:2px"></i>Scripted</span></div>
       <div class="trend-svg"></div><div class="chart-tip"></div>`,
      table([weekly ? "Week" : "Day", "Interactive", "Scripted"], rows), [["period_start", "interactive", "scripted"], ...rows], "downloads_trend.csv");
    const host = el.querySelector(".trend-svg"), tip = el.querySelector(".chart-tip");
    const W = Math.max(320, host.clientWidth || 800), H = 220, m = { l: 36, r: 12, t: 10, b: 26 };
    const max = Math.max(4, ...b.map(x => Math.max(x.i, x.s)));
    const step = max > 20 ? 10 : max > 8 ? 4 : 2, yMax = Math.ceil(max / step) * step;
    const x = i => m.l + (b.length === 1 ? 0 : i * (W - m.l - m.r) / (b.length - 1));
    const y = v => m.t + (1 - v / yMax) * (H - m.t - m.b);
    const path = k => b.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
    const ticks = []; for (let v = 0; v <= yMax; v += step) ticks.push(v);
    const every = Math.ceil(b.length / 7);
    host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Downloads over time; use the Table button for values">
      ${ticks.map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${v ? "#eceef2" : "#c9ced8"}"/><text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#5f6b7d" style="font-variant-numeric:tabular-nums">${v}</text>`).join("")}
      ${b.map((p, i) => i % every ? "" : `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#5f6b7d">${new Date(p.label + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>`).join("")}
      <path d="${path("i")} L${x(b.length - 1)},${y(0)} L${x(0)},${y(0)}Z" fill="${C1}" opacity=".08"/>
      <path d="${path("i")}" fill="none" stroke="${C1}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${path("s")}" fill="none" stroke="${C2}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <line class="xh" y1="${m.t}" y2="${H - m.b}" stroke="#9aa4b2" visibility="hidden"/>
      <circle class="d1" r="4.5" fill="${C1}" stroke="#fff" stroke-width="2" visibility="hidden"/>
      <circle class="d2" r="4.5" fill="${C2}" stroke="#fff" stroke-width="2" visibility="hidden"/>
      <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" class="hit"/></svg>`;
    const svg = host.querySelector("svg"), hit = svg.querySelector(".hit");
    const show = i => {
      const p = b[i], xs = x(i);
      svg.querySelector(".xh").setAttribute("x1", xs); svg.querySelector(".xh").setAttribute("x2", xs);
      [["d1", "i"], ["d2", "s"]].forEach(([c, k]) => { const d = svg.querySelector("." + c); d.setAttribute("cx", xs); d.setAttribute("cy", y(p[k])); d.setAttribute("visibility", "visible"); });
      svg.querySelector(".xh").setAttribute("visibility", "visible");
      tip.innerHTML = `<b>${weekly ? "Week of " : ""}${new Date(p.label + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b>Interactive ${p.i} · Scripted ${p.s}`;
      const sx = svg.getBoundingClientRect().width / W;
      tip.style.left = Math.min(xs * sx + 30, host.clientWidth - 150) + "px"; tip.style.top = "40px"; tip.style.opacity = 1;
    };
    hit.addEventListener("mousemove", e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      show(Math.max(0, Math.min(b.length - 1, Math.round((px - m.l) / (W - m.l - m.r) * (b.length - 1)))));
    });
    hit.addEventListener("mouseleave", () => { tip.style.opacity = 0; svg.querySelectorAll(".xh,.d1,.d2").forEach(n => n.setAttribute("visibility", "hidden")); });
  }

  // Column chart: ≤24px bars, 4px rounded top, value on the cap
  function columns(data) {
    const W = 360, H = 160, m = { t: 22, b: 28 }, max = Math.max(...data.map(d => d[1]), 1);
    const bw = 24, gap = W / data.length;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${data.map(d => `${d[0]}: ${d[1]}`).join(", ")}">
      <line x1="0" x2="${W}" y1="${H - m.b}" y2="${H - m.b}" stroke="#c9ced8"/>
      ${data.map(([k, v], i) => {
        const h = v / max * (H - m.t - m.b), cx = gap * i + gap / 2, top = H - m.b - h;
        return `<g><title>${k}: ${v} downloads</title>
          <path d="M${cx - bw / 2},${H - m.b} V${top + 4} a4,4 0 0 1 4,-4 h${bw - 8} a4,4 0 0 1 4,4 V${H - m.b}Z" fill="${C1}"/>
          <text x="${cx}" y="${top - 7}" text-anchor="middle" font-size="12" font-weight="700" fill="#16202f">${v}</text>
          <text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="12" fill="#5f6b7d">${k}</text></g>`;
      }).join("")}</svg>`;
  }

  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (!document.getElementById("tab-analytics").hidden) drawAnalytics(); }, 150); });

  // ---------- Access requests ----------
  const baseReq = [
    { name: "Priya Shah", org: "ProAg", email: "pshah@proag.com", role: "GIS / data analysis", use: "Checking spring ponding in Stutsman and Kidder for adjuster planning.", at: new Date(Date.now() - 36e5 * 5).toISOString() },
    { name: "Tom Becker", org: "USDA RMA — Billings RO", email: "tom.becker@usda.gov", role: "RMA regional office", use: "Regional review of 2025 wet-spring counties.", at: new Date(Date.now() - 36e5 * 26).toISOString() },
    { name: "Dana Olson", org: "NDSU Extension", email: "dolson@ndsu.edu", role: "Other", use: "Extension outreach on wetland persistence.", at: new Date(Date.now() - 36e5 * 50).toISOString() }
  ];
  let savedRequests = [];
  try { savedRequests = JSON.parse(localStorage.getItem("wph.requests") || "[]"); if (!Array.isArray(savedRequests)) throw new Error("Invalid queue"); }
  catch { savedRequests = []; toast("Saved requests could not be read. Showing sample requests only."); }
  const reqs = savedRequests.filter(r => r && typeof r.email === "string").concat(baseReq);
  function drawRequests() {
    document.getElementById("req-count").textContent = reqs.length || "";
    document.getElementById("req-body").innerHTML = reqs.length ? reqs.map((r, i) => {
      const d = HUB.checkDomain(r.email);
      return `<tr>
        <td><div class="cell-main">${escapeHTML(r.name)}</div><div class="cell-sub">${escapeHTML(r.org)} · ${escapeHTML(r.email)}</div></td>
        <td>${d.state === "eligible" ? `<span class="badge badge-good">Eligible · ${escapeHTML(d.org)}</span>` : `<span class="badge badge-warn">Not on list — review</span>`}</td>
        <td style="max-width:320px"><div class="cell-main" style="font-weight:600">${escapeHTML(r.role)}</div><div class="cell-sub">${escapeHTML(r.use)}</div></td>
        <td class="cell-sub">${new Date(r.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
        <td class="actions"><button class="btn btn-primary btn-sm" data-ok="${i}">Approve</button> <button class="btn btn-danger btn-sm" data-no="${i}">Decline</button></td></tr>`;
    }).join("") : `<tr><td colspan="5" class="muted" style="text-align:center;padding:40px">No pending requests. New demo requests will appear here.</td></tr>`;
    const done = (i, msg) => {
      const next = reqs.filter((_, index) => i !== index);
      try { localStorage.setItem("wph.requests", JSON.stringify(next.filter(r => !baseReq.includes(r)))); }
      catch { toast("Could not save this decision. The request has been preserved."); return; }
      reqs.splice(i, 1); drawRequests(); toast(msg);
      (document.querySelector("[data-ok]") || document.getElementById("admin-tab-requests")).focus();
    };
    document.querySelectorAll("[data-ok]").forEach(b => b.onclick = () => done(+b.dataset.ok, "Demo approval recorded locally. No activation email was sent."));
    document.querySelectorAll("[data-no]").forEach(b => b.onclick = () => done(+b.dataset.no, "Demo request declined locally. No notification was sent."));
  }

  // ---------- Accounts ----------
  const first = ["Jordan", "Alex", "Sam", "Taylor", "Morgan", "Casey", "Jamie", "Riley", "Avery", "Quinn", "Drew", "Reese", "Kai", "Rowan"];
  const last = ["Miller", "Olson", "Larson", "Nguyen", "Schmidt", "Hanson", "Peterson", "Garcia", "Johnson", "Berg", "Kowalski", "Anderson"];
  const accounts = Array.from({ length: 24 }, (_, i) => {
    const o = orgs[i % orgs.length], f = first[i % first.length], l = last[(i * 5) % last.length];
    const status = i === 7 ? "suspended" : i === 15 ? "invited" : "active";
    return { name: `${f} ${l}`, email: `${f[0].toLowerCase()}${l.toLowerCase()}@${o[1]}`, org: o[0], domain: o[1],
      granted: dayISO(Math.floor(rnd() * 40)), last: status === "invited" ? null : dayISO(40 + Math.floor(rnd() * 50)), dls: status === "invited" ? 0 : pois(6), status };
  });
  const stBadge = { active: '<span class="badge badge-good badge-dot">Active</span>', suspended: '<span class="badge badge-bad badge-dot">Suspended</span>', invited: '<span class="badge badge-warn badge-dot">Invite sent</span>' };
  function drawAccounts() {
    const q = document.getElementById("acct-q").value.toLowerCase();
    const list = accounts.filter(a => !q || (a.name + a.org + a.email).toLowerCase().includes(q));
    document.getElementById("acct-sum").textContent = `${accounts.length} accounts · ${accounts.filter(a => a.status === "active").length} active · ${accounts.filter(a => a.dls > 0).length} have downloaded`;
    document.getElementById("acct-body").innerHTML = list.map(a => {
      const i = accounts.indexOf(a);
      return `<tr>
        <td><div class="cell-main">${a.name}</div><div class="cell-sub">${a.email}</div></td>
        <td>${a.org}</td><td class="cell-sub">${HUB.formatDate(a.granted)}</td>
        <td class="cell-sub">${a.last ? HUB.formatDate(a.last) : "Never"}</td>
        <td class="num">${a.dls}</td><td>${stBadge[a.status]}</td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" data-act="reset" data-i="${i}">Reset access</button>
          <button class="btn btn-ghost btn-sm" data-act="${a.status === "suspended" ? "restore" : "suspend"}" data-i="${i}">${a.status === "suspended" ? "Restore" : "Suspend"}</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--bad)" data-act="delete" data-i="${i}" aria-label="Delete ${a.name}">Delete</button></td></tr>`;
    }).join("");
    document.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
      const a = accounts[+b.dataset.i], act = b.dataset.act;
      if (act === "reset") toast("Demo only: no password reset email was sent.");
      if (act === "suspend") { a.status = "suspended"; toast(`${a.name} marked suspended in this demo only.`); }
      if (act === "restore") { a.status = "active"; toast(`${a.name} restored.`); }
      if (act === "delete") { if (!confirm(`Delete ${a.name}'s account? Their past download records stay in the statistics.`)) return; accounts.splice(+b.dataset.i, 1); toast("Account deleted."); }
      drawAccounts();
      (document.querySelector(`[data-act="${act}"][data-i="${b.dataset.i}"]`) || document.getElementById("acct-q")).focus();
    });
    if (!list.length) {
      document.getElementById("acct-body").innerHTML = '<tr><td colspan="7" class="empty-state"><strong>No matching accounts</strong><p>Try a name, organisation or email address.</p><button class="btn btn-secondary btn-sm" id="clear-account-search">Clear search</button></td></tr>';
      document.getElementById("clear-account-search").onclick = () => { document.getElementById("acct-q").value = ""; drawAccounts(); document.getElementById("acct-q").focus(); };
    }
  }
  document.getElementById("acct-q").addEventListener("input", drawAccounts);
  document.getElementById("export-accts").onclick = () => csv("accounts.csv",
    [["name", "email", "organisation", "domain", "date_granted", "last_sign_in", "downloads", "status"], ...accounts.map(a => [a.name, a.email, a.org, a.domain, a.granted, a.last || "", a.dls, a.status])]);
  document.getElementById("bulk").onclick = () => {
    const inp = Object.assign(document.createElement("input"), { type: "file", accept: ".csv" });
    inp.onchange = () => toast(`Prototype: ${inp.files[0].name} would be checked, then invites sent for each row.`);
    inp.click();
  };

  // ---------- Domains ----------
  function drawDomains() {
    document.getElementById("dom-list").innerHTML = HUB.domains.map((d, i) => `<li>
      <span class="badge ${d.type === "gov" ? "" : "badge-good"}">${d.type === "gov" ? ".gov" : "AIP"}</span>
      <code>${escapeHTML(d.d)}</code><span class="muted">${escapeHTML(d.org)}</span><span class="spacer"></span>
      <span class="small muted">Added ${HUB.formatDate(d.added)}</span>
      ${d.type === "gov" ? '<span style="width:70px"></span>' : `<button class="btn btn-ghost btn-sm" style="color:var(--bad)" data-rmd="${i}" aria-label="Remove ${d.d}">Remove</button>`}</li>`).join("");
    document.querySelectorAll("[data-rmd]").forEach(b => b.onclick = () => { const d = HUB.domains.splice(+b.dataset.rmd, 1)[0]; drawDomains(); toast(`${d.d} removed from the eligible list.`); });
  }
  document.getElementById("dom-form").addEventListener("submit", e => {
    e.preventDefault();
    const d = document.getElementById("dom-in").value.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return toast("Enter a domain like example.com");
    if (HUB.domains.some(item => item.d === d)) return toast("This domain is already listed.");
    HUB.domains.push({ d, org: document.getElementById("dom-org").value.trim(), type: "aip", added: new Date().toISOString().slice(0, 10) });
    e.target.reset(); drawDomains(); drawRequests(); toast(`${d} added. Pending requests from it are now marked eligible.`);
  });

  // ---------- Notices ----------
  const nB = { release: '<span class="badge badge-good badge-dot">Release</span>', issue: '<span class="badge badge-warn badge-dot">Known issue</span>', retired: '<span class="badge badge-muted badge-dot">Retired</span>' };
  function drawNotices() {
    document.getElementById("notice-body").innerHTML = HUB.notices.map((n, i) => `<tr>
      <td class="cell-sub" style="white-space:nowrap">${HUB.formatDate(n.date)}</td><td>${nB[n.type]}</td>
      <td><div class="cell-main">${escapeHTML(n.title)}</div><div class="cell-sub">${escapeHTML(n.affects)}</div></td>
      <td>${i < 3 ? '<span class="badge">On home page</span>' : ""}</td>
      <td class="actions"><button class="btn btn-ghost btn-sm" onclick="toast('Prototype: opens the editor.')">Edit</button></td></tr>`).join("");
  }
  const nm = document.getElementById("notice-modal");
  document.getElementById("new-notice").onclick = () => openModal(nm);
  document.getElementById("nm-cancel").onclick = () => closeModal(nm);
  document.getElementById("notice-form").addEventListener("submit", e => {
    e.preventDefault();
    const g = id => document.getElementById(id).value;
    HUB.notices.unshift({ id: "n-new", date: new Date().toISOString().slice(0, 10), type: g("nm-type"), version: g("nm-ver"), title: g("nm-title-in"), what: g("nm-what"), affects: g("nm-aff"), replace: g("nm-rep") });
    closeModal(nm); e.target.reset(); drawNotices(); toast("Notice added to this demo view. It has not been published to the site.");
  });

  drawAnalytics(); drawRequests(); drawAccounts(); drawDomains(); drawNotices();
})();
