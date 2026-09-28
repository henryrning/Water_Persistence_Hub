/* Shared content for the prototype.
   In the Django build these come from the database (publication records,
   documentation entries, eligible-domain list) so the project team can edit
   them without a deploy (DOC-10, NFR-09). Keep the shapes identical. */

window.HUB = {
  product: "Planting Season Water Persistence layer",
  version: "v1.0-beta",
  termsVersion: "Terms v1.0",
  contactEmail: "waterhub@illinois.edu",
  issuesEmail: "waterhub-issues@illinois.edu",
  rmaUrl: "https://www.rma.usda.gov/",
  uiucUrl: "https://illinois.edu/",

  facts: [
    { k: "Service area", v: "Prairie Pothole counties, ND & SD", icon: "pin" },
    { k: "Service year", v: "2025", icon: "calendar" },
    { k: "Resolution", v: "3 m pixels", icon: "grid" },
    { k: "Detection window", v: "Mid-Mar – late Jun", icon: "clock" },
    { k: "Cutoffs", v: "70% · 80% · 90%", icon: "layers" }
  ],

  metrics: { precision: 0.948, recall: 0.945, f1: 0.946, accuracy: 0.910, photos: 884, site: "Ramsey County, ND" },

  years: [
    { y: 2023, status: "planned" },
    { y: 2024, status: "planned" },
    { y: 2025, status: "published" },
    { y: 2026, status: "processing" }
  ],

  window: { id: "full", label: "Full planting window", from: "Mar 15", to: "Jun 30", code: "W0315-0630" },

  // Real Ramsey County, ND 2025 statistics (from the supplied GeoTIFFs).
  cutoffs: [
    { p: 70, title: "70% — Inclusive", tag: "Most water",
      text: "A pixel is water (1) if it was under water in more than 70% of clear observations. Captures shorter-lived ponding.",
      ramseyKm2: 510.7, color: "#7eb6e8" },
    { p: 80, title: "80% — Balanced", tag: "Recommended start",
      text: "Water in more than 80% of clear observations. A middle ground between coverage and confidence.",
      ramseyKm2: 501.4, color: "#3680d4" },
    { p: 90, title: "90% — Conservative", tag: "Highest confidence",
      text: "Water in more than 90% of clear observations. Only water that stood almost the whole window.",
      ramseyKm2: 489.0, color: "#0e4092" }
  ],

  // Version Update Notices — reverse chronological. The landing page "What's new"
  // strip reads the first three from here (LAND-11).
  notices: [
    { id: "n-2026-09-25", date: "2026-09-25", type: "release", version: "v1.0-beta",
      title: "Public beta catalogue published",
      what: "Water persistence masks at 70%, 80% and 90% cutoffs for 67 Prairie Pothole counties in North Dakota and South Dakota.",
      affects: "ND and SD Prairie Pothole counties · 2025",
      replace: "Yes — if you hold the v0.9 Ramsey pilot files, replace them with v1.0-beta." },
    { id: "n-2026-09-18", date: "2026-09-18", type: "issue", version: "v1.0-beta",
      title: "Known issue: nodata gaps along county edges",
      what: "Some county edges show nodata (255) where no clear-sky observation was available. Values are withheld, not set to dry.",
      affects: "Border pixels in several ND counties · 2025",
      replace: "No — no data values changed." },
    { id: "n-2026-09-10", date: "2026-09-10", type: "retired", version: "v0.9",
      title: "Ramsey County pilot (v0.9) retired",
      what: "The pilot masks shared through UIUC Box are superseded by v1.0-beta. v0.9 stays citable; its method note remains in this log.",
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
