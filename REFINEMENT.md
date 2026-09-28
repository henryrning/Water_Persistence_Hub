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
