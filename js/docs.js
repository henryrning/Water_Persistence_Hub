/* Documentation chrome: secondary nav (DOC-01), version + last-updated line (DOC-09),
   save-as-PDF (DOC-11) and help routes (DOC-12). In Django: docs/base.html. */
(function () {
  const pages = [
    ["formats", "docs-formats.html", "Data formats", "file"],
    ["terms", "docs-terms.html", "Terms of use", "scale"],
    ["updates", "docs-updates.html", "Version updates", "bell"],
    ["cautions", "docs-cautions.html", "Cautions & accuracy", "alert"]
  ];
  const doc = document.querySelector(".doc");
  const cur = document.body.dataset.doc;
  const toc = [...doc.querySelectorAll("h2[id]")].map(h => `<li><a href="#${h.id}">${h.textContent}</a></li>`).join("");

  document.querySelector(".docs-nav").innerHTML = `
    <h2>Documentation</h2>
    <ul>${pages.map(([id, href, label, ic]) => `<li><a href="${href}"${id === cur ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}</ul>
    ${toc ? `<h2 class="toc">On this page</h2><ul class="toc">${toc}</ul>` : ""}
    <div class="docs-help">
      <strong>Need help?</strong>
      <a href="about.html#contact">Ask a data question</a>
      <a href="about.html#report">Report a data problem</a>
    </div>`;

  const meta = doc.querySelector(".doc-meta");
  if (meta) {
    meta.innerHTML = `
      <span class="badge">${meta.dataset.version}</span>
      <span>Last updated <time datetime="${meta.dataset.updated}">${HUB.formatDate(meta.dataset.updated)}</time></span>
      <span class="sample-tag">Draft copy — for project-team review</span>
      <span class="spacer"></span>
      <button class="btn btn-secondary btn-sm no-print" type="button" onclick="window.print()">Save as PDF</button>`;
    doc.insertAdjacentHTML("afterbegin", `<p class="print-only small">Water Persistence Hub · ${meta.dataset.version} · last updated ${meta.dataset.updated} · printed ${new Date().toISOString().slice(0, 10)}</p>`);
  }
  hydrateIcons(doc);
  doc.querySelectorAll("table").forEach(table => {
    const wrap = document.createElement("div"); wrap.className = "table-wrap";
    wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", "Scrollable reference table");
    table.before(wrap); wrap.append(table);
  });
})();
