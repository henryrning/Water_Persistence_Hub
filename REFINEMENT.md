# Design review — 2026-09-28

Baseline: the original download page (`review/original-before-refinement/download.html`).
Reviewed: the Codex refactor (`css/refinement.css`, new `js/*.js`, copy changes).
Outcome: engineering fixes kept; the visual/copy layer reverted to the download page's design language.

## Kept from the refactor (real defects, correctly fixed)

| Area | Fix |
|---|---|
| `js/site.js` | Native `<dialog>` for every modal (background inert, focus contained, Esc cancels). Clipboard fallback dialog. `escapeHTML` for user-entered content. |
| `js/download.js` | Year and cutoff controls are created once and updated in place, so keyboard focus survives a re-render. Removing a county chip hands focus to a neighbour. |
| `js/latest-task.js` | Package job uses AbortController + generation counter — changing the selection can never be overwritten by a stale result. |
| `js/forms.js` | Access request snapshots and saves *before* replacing the form (the original read fields after deleting them). Validation focuses the first invalid field. |
| `js/admin.js` | Roving tabindex + arrow keys on the section tabs; empty search state; saved-queue validation. |
| `css/refinement.css` | Locked steps keep readable text and only disable the controls (was 55 % opacity → 2.2:1 contrast). `[hidden]` always wins. Touch targets ≥ 40 px. Focus rings on dark surfaces. Short-viewport handling on the download page. |

## Reverted (aesthetic regressions / template patterns)

- Serif display type (Iowan/Palatino/Georgia) on every page except Download — split the site into two personalities; the "editorial serif + UI sans" pairing is itself a stock pattern.
- Paper background `#f8f7f3`, greenish fact strip `#ecefe9`, teal sign-in panel `#19323b` — three new tints outside the Illinois palette.
- Numbered `01 / ↗` documentation index; aphoristic headlines ("Standing water. Seen over time.", "Read the landscape correctly.", "Science, with a field perspective.", "A fresh start.").
  These also broke URD LAND-01 (headline must say what the hub delivers) and LAND-05 (primary CTA leads to download).
- Prototype disclaimers as banners on the download panel, admin console, request form, and as button labels ("Prepare download preview", "Save draft locally", "Continue as demo data user").
  Controls now carry product labels; the prototype boundary is stated once, at the point of action (the ready-state card, the form result, the sign-in demo box).
- Sign-in page without an email/password form (AUTH-08 must be reviewable). Account page without sample history (DL-14 must be reviewable) — sample rows are now labelled **Sample**.
- Download page at viewport heights < 820 px: the refactor let the page scroll and hid the primary action below the fold. The summary is pinned again; the panel tightens instead.

## Not changed

- `css/hub.css` is byte-identical to the original (checked by `tools/check-refinement.cjs`).
- Map, catalogue, colours, URL state, cutoff cards — the parts of the download page the review was anchored to.

## Verification

- `node tools/check-refinement.cjs` — 12 pages, 119 local references, no duplicate IDs, hub.css intact.
- `node --test tools/refinement.test.cjs` — 7/7.
- Edge headless screenshots at 1440×900, 1440×700 and 390 px wide for home, download, docs, sign-in, request, about, account, admin.
- Not done: real-browser keyboard and screen-reader pass, Safari/Firefox, 200 % zoom.

`Water-Persistence-Hub-refined.zip` in the repository root is the Codex deliverable and predates this review; the `frontend/` folder is current.

---

# Design review — 2026-10-07

Source: "Water Persistence Hub — Design Feedback (v1)", Zhangliang + Claude, Oct 3 2026
(`Water Persistence Hub - Design Feedback v1.docx (1).pdf` in the repo root).
IDs below match that document's labels: H = Zhangliang, G/P/D/C/A = Claude (site-wide/
Home/Download/Documentation/About).

## Adopted as specified

- **Data model**: the raster now stores a 0–100% "share of usable days under water"
  per pixel, not three cutoff files. 70/80/90% survive only as a *view* filter on the
  Download page's results-viewer map. (H4, H19, D9, C5–C10, A3)
- **Download page rebuilt** to "pick and preview": counties → years (2022–2026,
  multi-select, only 2025 real) → planting window (Default / Corn / Soybean). The map
  becomes a results viewer once ≥1 county is selected: county stepper, year select,
  70/80/90% view toggle, "Preview only" badge. (H10–H19, D1, D7, D10–D13)
- One date range stated exactly: Mar 15 – Jun 30 (108 days), everywhere. (H3, H6, C7)
- Removed: Home's field-validation section (H7), the "Browse freely" note (H10), the
  standalone beta-feedback box (H22) — folded into "Ask a question" instead (H23, A8).
  Footer rebuilt as a slim 2-row bar (G6–G8).
- Clearer map title/legend/sample label on Home; continuous 0–100% legend bar
  replaces the three swatches (H5, P1).
- "Why 3 m matters": a real 3-crop comparison (30 m / 10 m / 3 m) rendered from the
  actual Ramsey raster, not a mockup — picked a scattered-pothole area so small ponds
  visibly disappear at 30 m. Addresses H1/P10 (option 2, Claude's own pick in the doc)
  plus a parking-space caption for H1's literal scale-comparison ask.
  See `tools/prepare_assets.py` → the compare_*.png generation block.
- Explainer animation: list now matches its 4 phases; "Day 01 of 8" → "Day N of 108"
  (real position in the window, not an implied 8-day total); tick-label font and
  colour fixed for readability. (H6, P5, P6)
- Site-wide: wider content (1180→1220px, G1), cross-platform font stack for the Home
  headline (Georgia leads, not Mac-only Iowan Old Style, G2), one eyebrow colour
  (muted navy, not orange, G4), no text under 13px anywhere (G5), one primary button
  colour (navy; orange reserved for the one CTA on a colored band, G3).
- Documentation: "Draft copy" badge removed everywhere (C3); Data formats rewritten
  throughout for the percentage model, exact dates, API "coming soon" badge + fixed
  code-block overflow (C4–C13); Cautions wording fixed (C14, C15); doc-cards hub gets
  a "Start here" badge and a visually distinct "Need help?" block (C1, C2).
  Version-updates copy rewritten to drop cutoff language (C16).
- About: 3 cards renamed exactly to H20's wording; project-background paragraph added
  (A1, names the team by role, not individuals — see "Modified" below); Report-a-
  problem form's Cutoff dropdown replaced with Year + Planting window (A3); County
  field is now a `<select>` sharing the same county list as Download (A4, simplified —
  see below); both contact emails consolidated to one, since the second couldn't be
  confirmed to exist (A5).
- Plain-language swaps applied: nodata→missing data, Border pixels→Field edges,
  catalogue published→data released, pilot (v0.9) retired→early test version
  replaced, Ingest/Detect/Stack/Output kept (already plain) with a 4th "Result" step
  added. Category label now leads each update ("Release — …", H8); side badges
  shrank to a dot (P8).

## Modified, not adopted literally

- **A4 (county field)**: implemented as a `<select>` grouped ND/SD sharing the same
  county list as Download — not a full port of Download's live-search combobox.
  Gets the stated goal (consistent county names in reports) without duplicating a
  second interactive combobox component. Revisit if that's not enough.
- **A2/H20 ("give all three About cards a matching logo, or none")**: picked *none* —
  removed the Illinois Block I image that had been sitting in the second card, so
  all three are plain text headings. Adding a new icon to the third card would have
  reintroduced the decorative icons removed earlier this project at your request.
- **A1 (project background)**: written at the team/role level ("the UIUC project
  team"), not with named individuals — the URD names specific people, but putting
  personal names on a public page is a bigger call than this pass should make alone.
- **D13 (map as results viewer, "many counties")**: built the full toolbar UI, but
  only Ramsey County, ND 2025 has a real rendered preview image, exactly as before
  this round. Every other county shows an honest "preview not available yet" status
  instead of a fabricated overlay. This is the direct, previously-given answer to
  the "is this feasible for many counties" question: not at full resolution without
  a tile service; a flat per-county preview image (Ramsey's approach) is the
  realistic path for more counties, and that's what's implemented, just not
  generated for all 67 yet.

## Rejected

- **P3 (add an audience line — "for AIPs/RMA offices" — back into the Home hero
  lede)**: this is Claude's own earlier suggestion in the doc, but it directly
  contradicts your explicit instruction earlier in this project to remove that exact
  line from the hero. The beta bar (site-wide, every page) already states the
  audience, so the information isn't lost — just not duplicated in the hero copy.

## Still open (genuinely needs Henry/RMA, not a design choice)

- **C17 / "final site address"**: unchanged — still a placeholder
  (`waterhub.illinois.edu`), not something resolvable from the front end.
- **C6/D11 corn & soybean dates**: state-level *placeholder* examples are now wired
  through `HUB.windows[...].example` and shown on Download, the About report form,
  and Data formats — clearly labelled as provisional. Needs the real per-county
  agronomic source before launch.
- **"67 Prairie Pothole counties" (C16)**: the Download map and this count are the
  same list by construction (both read `assets/data/counties.geojson`), so they
  cannot disagree with each other — but neither has been checked against an official
  source. Same caveat as the previous review round.

## Verification

- `node tools/check-refinement.cjs` — 12 pages, 120 local references, no duplicate
  IDs, both stylesheets parse. The script's old byte-for-byte freeze on `hub.css`
  was retired (see the comment at that line) — it predated this deliberate revision.
- Edge headless screenshots: Home, Download (empty / 3-county / Ramsey-only /
  non-Ramsey county), Documentation hub, Data formats, About — checked visually.
- Found and fixed one real bug while screenshotting: the results-viewer's
  "preview not available" status never appeared on a page's first paint for a
  non-Ramsey county, because its change-detection key started equal to its first
  computed value (`null === null`). Fixed with a sentinel initial value.
- Not done: phone/tablet layouts and Sign in/Request access were explicitly marked
  "Not covered" in the feedback doc, so left as they were from the previous round.
  No real-browser keyboard/screen-reader pass this round either.

---

# Polish pass — 2026-10-11

Phase 1 (feedback closure): Admin "Downloads by planting window" chart replaces the
cutoff chart; docs TOC no longer repeats badge text; Version updates shows an empty
state per filter; Home inset links to the map through a marked spot (P2).

Phase 2 (self-critique), in `css/refinement.css` → "Polish pass" block and `hub.css` tokens:
- Shadows reduced to tight 1–2 layer tokens; hero radial glows removed; access band flat.
- One motion spec: 160ms `cubic-bezier(.2,.7,.2,1)`, explicit transition properties
  (no `transition: all`), pressed states on buttons/toggles.
- 8px spacing rhythm on cards, news items, legend.
- Download results bar fits on one line (wraps below 1180px); preview status moved
  under the toolbar so it no longer covers the legend.
- Overflow guards: chip names ellipsis, news titles clamp to 2 lines, long words wrap,
  selected-county list scrolls past 132px.

Verification: `check-refinement.cjs` PASS, `refinement.test.cjs` 7/7, Edge screenshots
of Home, Download (2 counties), Version updates.

2026-10-12 — About: the two contact forms merged into one with a "What's this about?"
type (question / data problem / account / beta / other); county, year and window
appear only for data problems. Old `#report` and `?topic=beta` links preset the type.
Also fixed `.wrap.section-tight` losing its side gutters (About and Docs hub were 24px
out of line with the header).

2026-10-12 — Home 3 m inset: three 44px thumbnails (indistinguishable at that size)
replaced by one image with a 30 m / 10 m / 3 m toggle; cycles once on load unless
reduced motion is set.

2026-10-12 — Removed the Home 3 m comparison inset entirely (map marker, toggle,
script, CSS): the difference was not readable at inset size. Kept the scale cue as
one sentence in the sample-card caption. assets/img/compare_*.png are now unused.

2026-10-13 — Download results viewer moved to lightweight per-county previews: one
~1,000 px PNG per county × year × view threshold in `assets/previews/`, listed in
`manifest.js`. `tools/build_previews.py <fips>_<year>.tif …` builds them from the
0–100% percentage rasters. Only Ramsey 2025 exists so far (from the old cutoff masks);
the script was tested on a synthetic raster only. Also: Admin release table shows
planting windows not cutoffs, API token marked coming soon, "Scripted access" →
"Download with code (API)", "nodata" → "missing data" on Cautions, explainer no longer
mentions 8 days. Footer: credit line under the logo, links level with the logo.

2026-10-13 — Results viewer finished per D13 / sketch part 3: the map zooms to the
county on view (outlined, light fill); legend gains a "Water on ≥ N% of usable days"
row while a preview shows; a corner "Change county" minimap (selection + neighbours,
hidden under 900px) switches or adds counties. Clicking the viewed county on the main
map no longer removes it. Fixed: county search list could not reopen after Esc or
after picking a result; "preview not available" message kept the previous county's name.
