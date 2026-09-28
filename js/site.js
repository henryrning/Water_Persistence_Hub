/* Site chrome shared by every page: beta bar, header, footer, demo session.
   In Django this is base.html; the session comes from request.user. */
(function () {
  const HUB = window.HUB;
  window.escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- Icons (24px stroke set) ----------
  const P = {
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    grid: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    file: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 17h5"/>',
    scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.1"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.5 9.4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14a6.5 6.5 0 0 1 3 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.3-4.3"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="m7.5 14.5 3.5-4 3 2.5 5-6"/>',
    inbox: '<path d="M3 13.5 5.5 5h13l2.5 8.5V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    logout: '<path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 4v4.5H8M12 8v4l3 2"/>',
    upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    printer: '<path d="M7 8V3.5h10V8M7 17H4.5V9.5A1.5 1.5 0 0 1 6 8h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><rect x="7" y="14" width="10" height="7"/>',
    eye: '<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3l1.7-1.8M20 20v-4.5h-4.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    cursor: '<path d="m5 3 14 7-6 2-2 6z"/>'
  };
  window.icon = function (name, cls) {
    return ``;
  };
  // Replace placeholders.
  function hydrateIcons(root) {
    (root || document).querySelectorAll("i[data-icon]").forEach(el => {
      const st = el.getAttribute("style");
      el.outerHTML = icon(el.dataset.icon, el.className || "").replace("<svg ", `<svg ${st ? `style="${st};flex-shrink:0" ` : ""}`);
    });
  }
  window.hydrateIcons = hydrateIcons;

  // Official Illinois Block I. The reverse (white-outline) version is for dark backgrounds.
  const BLOCK_I = `<img class="block-i" src="assets/img/illinois_block_i_reverse.png" width="243" height="351" alt="University of Illinois Block I logo">`;

  // ---------- Demo session (replaced by Django auth) ----------
  const KEY = "wph.session";
  const Session = {
    get() {
      try {
        const s = JSON.parse(localStorage.getItem(KEY));
        if (!s || typeof s.name !== "string" || typeof s.email !== "string" || !["user", "admin"].includes(s.role)) return null;
        // Update existing demo sessions without resetting their role or accepted terms.
        if ((s.name === "Zhangliang Chen" && s.email === "zchen@illinois.edu") ||
            (s.name === "Jordan Miller" && s.email === "jmiller@rainhail.com")) {
          s.name = "Henry Ning";
          try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* Still show the updated name for this visit. */ }
        }
        return s;
      } catch { return null; }
    },
    set(s) { localStorage.setItem(KEY, JSON.stringify(s)); },
    clear() { localStorage.removeItem(KEY); },
    demo(role) {
      const s = role === "admin"
        ? { role: "admin", name: "Henry Ning", email: "zchen@illinois.edu", org: "UIUC project team", termsAcceptedAt: null }
        : { role: "user", name: "Henry Ning", email: "jmiller@rainhail.com", org: "Rain and Hail", termsAcceptedAt: null };
      Session.set(s);
      return s;
    }
  };
  window.Session = Session;

  // Prototype shortcut for reviewers: ?demo=user or ?demo=admin signs in a demo account.
  const demo = new URLSearchParams(location.search).get("demo");
  let demoStorageFailed = false;
  if (demo === "user" || demo === "admin") {
    try { Session.demo(demo); } catch { demoStorageFailed = true; }
  }

  const page = document.body.dataset.page || "";
  const s = Session.get();
  
  const navItems = [
    ["home", "index.html", "Home"],
    ["download", "download.html", "Download"],
    ["docs", "docs.html", "Documentation"],
    ["about", "about.html", "About / Contact"]
  ];

  const header = `
  <a class="skip-link" href="#main">Skip to main content</a>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="index.html">
        ${BLOCK_I}
        <span class="brand-text">
          <span class="brand-school">University of Illinois Urbana-Champaign</span>
          <span class="brand-name">Water Persistence Hub</span>
        </span>
      </a>
      <span class="beta-tag">Beta</span>
      <button class="nav-btn nav-toggle" aria-expanded="false" aria-controls="main-nav">Menu</button>
      <nav class="main-nav" id="main-nav" aria-label="Main">
        <ul>
          ${navItems.map(([id, href, label]) => `<li><a href="${href}"${page === id ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}
          <li>${s ? `
            <div class="user-menu">
              <button class="nav-btn" aria-expanded="false" aria-controls="account-menu">${escapeHTML(s.name)} ▾</button>
              <div class="menu" id="account-menu" hidden>
                <div class="menu-head"><strong>${escapeHTML(s.name)}</strong>${escapeHTML(s.email)}</div>
                <a href="account.html">My downloads</a>
                ${s.role === "admin" ? `<a href="admin.html">Admin console</a>` : ""}
                <button class="nav-btn" data-signout>Sign out</button>
              </div>
            </div>` : `<a class="nav-signin" href="signin.html"${page === "signin" ? ' aria-current="page"' : ""}>Sign in</a>`}
          </li>
        </ul>
      </nav>
    </div>
  </header>
  <div class="beta-bar" role="region" aria-label="Beta notice">
    <div class="wrap">Public beta · for Approved Insurance Providers and RMA offices. Data and pages may change. <a href="about.html#feedback">Send feedback</a></div>
  </div>`;

  const footer = `
  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-top">
        <div>
          <a class="brand" href="index.html">${BLOCK_I}<span class="brand-text"><span class="brand-school">University of Illinois Urbana-Champaign</span><span class="brand-name">Water Persistence Hub</span></span></a>
          <p style="margin-top:16px;max-width:360px">Funded by the <a href="${HUB.rmaUrl}" target="_blank" rel="noopener">USDA Risk Management Agency</a>.
          Developed by the <a href="${HUB.uiucUrl}" target="_blank" rel="noopener">University of Illinois Urbana-Champaign</a>.</p>
        </div>
        <div><h4>Data</h4><ul>
          <li><a href="download.html">Download data</a></li>
          <li><a href="docs-updates.html">Version updates</a></li>
          <li><a href="docs-formats.html#api">Scripted access</a></li>
        </ul></div>
        <div><h4>Documentation</h4><ul>
          <li><a href="docs-formats.html">Data formats</a></li>
          <li><a href="docs-terms.html">Terms of use</a></li>
          <li><a href="docs-cautions.html">Cautions &amp; accuracy</a></li>
        </ul></div>
        <div><h4>Help</h4><ul>
          <li><a href="request-access.html">Request access</a></li>
          <li><a href="about.html#contact">Contact us</a></li>
          <li><a href="about.html#report">Report a data problem</a></li>
        </ul></div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 University of Illinois Board of Trustees · USDA Risk Management Agency</span>
        <span>${HUB.version} · Not a prevented-planting eligibility determination.</span>
      </div>
    </div>
  </footer>
  <div class="toast" role="status" aria-live="polite"></div>`;

  document.body.insertAdjacentHTML("afterbegin", header);
  document.body.insertAdjacentHTML("beforeend", footer);
  hydrateIcons();

  // Mobile nav
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("main-nav");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });
  function closeNav(restore = false) {
    nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false");
    if (restore) toggle.focus();
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && nav.classList.contains("open") && !document.querySelector("dialog[open]")) closeNav(true);
  });
  document.addEventListener("click", e => { if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav(); });
  document.querySelector(".site-header").addEventListener("focusout", e => {
    if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) closeNav();
  });
  // User menu
  const um = document.querySelector(".user-menu");
  if (um) {
    const b = um.querySelector("button");
    const menu = um.querySelector(".menu");
    const setOpen = open => { um.classList.toggle("open", open); b.setAttribute("aria-expanded", open); menu.hidden = !open; };
    b.addEventListener("click", () => setOpen(menu.hidden));
    document.addEventListener("click", e => { if (!um.contains(e.target)) setOpen(false); });
    um.addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) { e.stopPropagation(); setOpen(false); b.focus(); } });
    um.addEventListener("focusout", e => { if (e.relatedTarget && !um.contains(e.relatedTarget)) setOpen(false); });
  }
  document.querySelectorAll("[data-signout]").forEach(b => b.addEventListener("click", () => {
    try { Session.clear(); location.href = "index.html"; }
    catch { toast("The demo session could not be cleared. Check this browser's site storage settings."); }
  }));

  // Toast
  let tt;
  window.toast = function (msg) {
    const t = document.querySelector(".toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 6500);
  };
  if (demoStorageFailed) toast("Demo sign-in could not be saved. You can still browse the site.");

  // Upgrade existing dialog markup before page-specific scripts bind listeners.
  function upgradeModal(old) {
    if (old.tagName === "DIALOG") return old;
    const dialog = document.createElement("dialog");
    for (const attr of old.attributes) if (attr.name !== "role") dialog.setAttribute(attr.name, attr.value);
    dialog.append(...old.childNodes); old.replaceWith(dialog);
    dialog.addEventListener("close", () => {
      dialog.classList.remove("open");
      document.body.classList.toggle("has-modal", !!document.querySelector("dialog[open]"));
      // Native dialog restores focus. Avoid stealing it from a following task.
      if (document.activeElement === document.body && dialog._ret?.isConnected && !dialog._ret.disabled) dialog._ret.focus();
    });
    return dialog;
  }
  document.querySelectorAll(".modal-backdrop").forEach(upgradeModal);
  window.openModal = function (el) {
    if (el.open) return;
    el._ret = document.activeElement;
    el.showModal(); el.classList.add("open"); document.body.classList.add("has-modal");
    const heading = el.querySelector("h2");
    if (heading) { heading.tabIndex = -1; heading.focus(); }
  };
  window.closeModal = el => { if (el.open) el.close(); };
  const copyHost = document.createElement("div");
  copyHost.className = "modal-backdrop copy-dialog";
  copyHost.setAttribute("aria-labelledby", "copy-title");
  copyHost.innerHTML = `<div class="modal"><div class="modal-head"><h2 id="copy-title">Copy manually</h2></div>
    <div class="modal-body"><p id="copy-help">Automatic copying is unavailable. Select the text below and copy it.</p>
    <label class="sr-only" for="copy-text">Text to copy</label><textarea class="input" id="copy-text" readonly aria-describedby="copy-help"></textarea></div>
    <div class="modal-foot"><button class="btn btn-primary" type="button">Done</button></div></div>`;
  document.body.append(copyHost);
  const copyDialog = upgradeModal(copyHost);
  copyDialog.querySelector("button").onclick = () => closeModal(copyDialog);
  window.copyText = async function (value, message = "Copied.") {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value); toast(message); return true;
    } catch {
      const input = copyDialog.querySelector("textarea"); input.value = value;
      openModal(copyDialog); input.focus(); input.select(); return false;
    }
  };
  // Make wide data tables navigable without making the whole page overflow.
  document.querySelectorAll(".table-wrap").forEach(wrap => {
    wrap.tabIndex = 0; wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", "Scrollable data table");
  });
  // Real image loading only: the layout is reserved while the asset arrives.
  document.querySelectorAll(".sample-img > img").forEach(img => {
    const host = img.parentElement;
    const finish = () => { host.classList.remove("media-loading"); host.removeAttribute("aria-busy"); };
    const fail = () => {
      finish();
      if (host.querySelector(".media-error")) return;
      const message = document.createElement("p"); message.className = "media-error";
      message.setAttribute("role", "status"); message.textContent = "Sample image could not load. Reload the page to try again."; host.append(message);
    };
    img.addEventListener("load", finish); img.addEventListener("error", fail);
    if (!img.complete) { host.classList.add("media-loading"); host.setAttribute("aria-busy", "true"); }
    else if (!img.naturalWidth) fail();
  });
})();
