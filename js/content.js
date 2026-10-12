/* Shared content for the prototype.
   In the Django build these come from the database (publication records,
   documentation entries, eligible-domain list) so the project team can edit
   them without a deploy (DOC-10, NFR-09). Keep the shapes identical.

   Updated 2026-10-07 per Design Feedback v1 (Zhangliang): the raster stores a
   continuous 0–100% "share of usable days under water" per pixel, not three
   separate cutoff files. 70/80/90% survive only as a map *viewing* filter. */

window.HUB = {
  product: "Planting Season Water Persistence layer",
  version: "v1.0-beta",
  termsVersion: "Terms v1.0",
  contactEmail: "waterhub@illinois.edu",
  rmaUrl: "https://www.rma.usda.gov/",
  uiucUrl: "https://illinois.edu/",

  facts: [
    { k: "Service area", v: "Prairie Pothole counties, ND & SD", icon: "pin", note: "Beta — limited to this area for now" },
    { k: "Service year", v: "2025", icon: "calendar", note: "Beta — more years are being added" },
    { k: "Resolution", v: "3 m pixels", icon: "grid" },
    { k: "Detection window", v: "Mar 15 – Jun 30 (108 days)", icon: "clock" }
  ],

  metrics: { precision: 0.948, recall: 0.945, f1: 0.946, accuracy: 0.910, photos: 884, site: "Ramsey County, ND" },

  // 2022–2026: five years shown per the review (H17). Only 2025 has data today.
  years: [
    { y: 2022, status: "progress" },
    { y: 2023, status: "progress" },
    { y: 2024, status: "progress" },
    { y: 2025, status: "available" },
    { y: 2026, status: "progress" }
  ],

  // Planting window choice (H18/D11). Corn/soybean dates genuinely vary by
  // county and need a real agronomic source — ND/SD state-level placeholders
  // below stand in until that list exists; flagged in the UI as examples.
  windows: [
    { id: "default", label: "Default", code: "WDEF", from: "Mar 15", to: "Jun 30", days: 108, varies: false },
    { id: "corn", label: "Corn", code: "WCORN", varies: true,
      example: { ND: "Apr 25 – Jun 5", SD: "Apr 20 – Jun 10" } },
    { id: "soybean", label: "Soybean", code: "WSOY", varies: true,
      example: { ND: "May 5 – Jun 15", SD: "May 1 – Jun 20" } }
  ],

  // Map-viewer thresholds (view-only now — DL no longer forks into separate
  // files). Real Ramsey County, ND 2025 areas, kept for the worked example.
  mapThresholds: [
    { p: 70, label: "≥ 70%", text: "Water in 70% or more of usable days.", ramseyKm2: 510.7, color: "#7eb6e8" },
    { p: 80, label: "≥ 80%", text: "Water in 80% or more of usable days.", ramseyKm2: 501.4, color: "#3680d4" },
    { p: 90, label: "≥ 90%", text: "Water in 90% or more of usable days.", ramseyKm2: 489.0, color: "#0e4092" }
  ],

  // Version Update Notices — reverse chronological. The landing page "What's new"
  // strip reads the first three from here (LAND-11).
  notices: [
    { id: "n-2026-09-25", date: "2026-09-25", type: "release", version: "v1.0-beta",
      title: "Public beta data released",
      what: "Water persistence layer — the percentage of usable days each pixel was under water — for 67 Prairie Pothole counties in North Dakota and South Dakota.",
      affects: "ND and SD Prairie Pothole counties · 2025",
      replace: "Yes — if you hold the v0.9 Ramsey pilot files, replace them with v1.0-beta." },
    { id: "n-2026-09-18", date: "2026-09-18", type: "issue", version: "v1.0-beta",
      title: "Missing data along county edges",
      what: "Some county edges are left blank where no clear-sky observation was available. These pixels are not marked dry.",
      affects: "Field edges in several ND counties · 2025",
      replace: "No — no data values changed." },
    { id: "n-2026-09-10", date: "2026-09-10", type: "retired", version: "v0.9",
      title: "Ramsey County early test version replaced",
      what: "The early test files shared through UIUC Box are superseded by v1.0-beta. v0.9 stays citable; its method note remains in this log.",
      affects: "Ramsey County, ND · 2025",
      replace: "Yes — use v1.0-beta for new work." }
  ],

  // Eligible domain list (AUTH-05). Admin-editable in the real build.
  domains: [
    { d: "*.gov", org: "U.S. government", type: "gov", added: "2026-09-01" },
    { d: "rainhail.com", org: "Rain and Hail", type: "aip", added: "2026-09-02" },
    { d: "nau.com", org: "NAU Country", type: "aip", added: "2026-09-02" },
    { d: "farmersmutualhail.com", org: "Farmers Mutual Hail", type: "aip", added: "2026-09-02" },
    { d: "proag.com", org: "ProAg", type: "aip", added: "2026-09-02" },
    { d: "americanfinancialgroup.com", org: "Great American Insurance", type: "aip", added: "2026-09-03" },
    { d: "ccig.com", org: "Crop Risk Services", type: "aip", added: "2026-09-03" }
  ]
};

/* Check an email against the eligible list. Unknown domains are flagged for
   review — never rejected outright (AUTH-06). */
HUB.checkDomain = function (email) {
  const m = String(email || "").trim().toLowerCase().match(/^[^@\s]+@([^@\s]+\.[a-z]{2,})$/);
  if (!m) return { state: "invalid" };
  const dom = m[1];
  if (dom === "gov" || dom.endsWith(".gov")) return { state: "eligible", dom, org: "U.S. government (.gov)" };
  const hit = HUB.domains.find(x => x.d === dom || dom.endsWith("." + x.d));
  if (hit) return { state: "eligible", dom, org: hit.org };
  return { state: "review", dom };
};

HUB.formatBytes = function (b) {
  if (b == null) return "—";
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  if (b < 1024 ** 3) return (b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0) + " MB";
  return (b / 1024 ** 3).toFixed(2) + " GB";
};

HUB.formatDate = function (iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};
