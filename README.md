# Water Persistence Hub — front-end preview

Static prototype of the Planting Season Water Persistence Data Hub, built from
the URD (v0.1 draft) and development plan for the USDA RMA / UIUC project.

**Live preview:** set after first deploy below.

No backend: accounts, downloads and admin data are local browser demos.
See REFINEMENT.md for the design-review notes.
# Water Persistence Hub — front-end prototype

The pages carry the interaction fixes from the 2026-09-28 review (see `REFINEMENT.md`); the visual system is unchanged from the original.
See [REFINEMENT.md](REFINEMENT.md) for scope, file mapping and verification.
The download page retains its original map, panel layout and scientific colours.
All account actions and download preparation remain local demonstrations.

Static, clickable prototype of the public beta, built from URD v0.1 and the
development plan. Open `index.html` in a browser; no server or build step needed.

## Pages

| File | Covers |
|---|---|
| `index.html` | Landing page — headline, fact strip, Ramsey sample map, explainer video slot, accuracy, what's new (LAND-01…11) |
| `download.html` | Guided download: map + searchable list → year → window → cutoff → summary → ZIP job (DL-01…15) |
| `docs.html`, `docs-*.html` | Documentation: data formats, terms, version updates, cautions & accuracy (DOC-01…12) |
| `about.html` | Funders, question form, separate data-problem report, beta feedback |
| `request-access.html` | Access request with live eligible-domain check (AUTH-04, 06) |
| `signin.html` | Sign in, password reset, demo accounts |
| `account.html` | My downloads history, terms acceptance, API token (DL-14) |
| `admin.html` | Usage statistics + CSV, access requests, accounts, eligible domains, data & notices (ANL, AUTH-05/07/09) |

## Trying it

- Sign in with the **Demo AIP user** or **Demo administrator** buttons, or add
  `?demo=user` / `?demo=admin` to any URL. The session is kept in `localStorage`.
- Example deep link: `download.html?counties=38071&year=2025&window=full&cutoff=80`.

## Structure

- `css/hub.css` — the whole design system (Illinois blue/orange, WCAG AA colours). Header style follows
  the earlier RMA Report Dashboard (`rma-report-tool/`): navy bar, UIUC mark and name, no decorative icons.
- `css/refinement.css` — usability layer only: interaction states, native `<dialog>`, hit targets, responsive fixes. No typefaces or tints of its own.
- `js/site.js` — header, beta bar, footer, demo session, modal + clipboard helpers (→ Django `base.html`).
- `js/content.js` — facts, cutoffs, notices, domains. In Django these become
  database records editable by the project team (DOC-10, NFR-09).
- `js/download.js`, `js/admin.js`, `js/docs.js`, `js/forms.js`, `js/account.js` — page logic; `js/latest-task.js` — cancellable job runner.
- `tools/check-refinement.cjs`, `tools/refinement.test.cjs` — structural checks and logic tests (`node tools/check-refinement.cjs && node --test tools/refinement.test.cjs`).
- `review/` — pre-refactor backup and the Codex audit; `REFINEMENT.md` — what was kept and reverted.
- `assets/` — Leaflet (self-hosted), county outlines, Ramsey previews.

## Rebuilding the data assets

`tools/prepare_assets.py` renders the previews from the real Ramsey GeoTIFFs and
builds `counties.geojson`. It expects the extracted TIFs in `../_data/Ramsey_ND_2025/`
and US county outlines in `../_data/counties.json`.

## Placeholders to replace

- Header and credits use the official Illinois Block I (`assets/img/illinois_block_i.png`, from illinois.edu).
  `illinois_block_i_reverse.png` is a white-outline copy made for the navy header — replace it with the
  official reverse file from brand.illinois.edu before launch. USDA RMA is credited in text (no logo file yet).
- Coverage list (which counties are "covered") is approximate; the real catalogue comes from publication records.
- Version notices, docs copy, analytics numbers and accounts are sample content.
- Explainer video: set `data-video-src` and `data-captions-src` on `#explainer` in `index.html`. Until then
  `js/explainer.js` + `css/explainer.css` run a canvas animation built from `assets/data/explainer_grid.js`
  (a 48×48 cell grid cut from the real Ramsey masks; regenerate with the snippet in `tools/prepare_assets.py`).
  Append `?t=<seconds>` to the home URL to freeze it at a timestamp for review.
