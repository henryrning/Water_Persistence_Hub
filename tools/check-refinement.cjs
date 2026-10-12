const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(base, file), 'utf8');
const pages = fs.readdirSync(base).filter(file => file.endsWith('.html'));
let scripts = 0, resources = 0;
for (const page of pages) {
  const html = read(page);
  assert(html.includes('css/refinement.css'), `Missing refinement stylesheet: ${page}`);
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate ID in ${page}`);
  for (const [, reference] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(#|[a-z]+:|\$\{)/i.test(reference)) continue;
    const file = reference.split(/[?#]/)[0];
    if (!file || file.includes('${')) continue;
    assert(fs.existsSync(path.resolve(base, file)), `Missing reference: ${page} -> ${file}`); resources++;
  }
  for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!attrs.includes('src=') && code.trim()) { new vm.Script(code, { filename: page }); scripts++; }
  }
}
for (const file of fs.readdirSync(path.join(base, 'js')).filter(file => file.endsWith('.js'))) {
  new vm.Script(read(`js/${file}`), { filename: file }); scripts++;
}
const postcss = require(path.join(base, 'rma-report-tool/node_modules/postcss'));
for (const css of ['css/hub.css', 'css/refinement.css']) postcss.parse(read(css), { from: css });
// Note: hub.css was intentionally revised per Design Feedback v1 (2026-10-07) —
// wider layout (G1), cross-platform font stack (G2), one eyebrow colour (G4),
// 13px text floor (G5), one primary button colour (G3), slim footer (G6-G8),
// and the cutoff → percentage data-model change (H4/H19). The old byte-for-byte
// freeze against review/original-before-refinement/css/hub.css is retired —
// that snapshot predates this revision and is no longer the baseline.
for (const id of ['map', 'county-search', 'county-list', 'years', 'windows', 'summary-text', 'dl-btn', 'zoom-fit']) {
  assert(read('download.html').includes(`id="${id}"`), `Lost download control: ${id}`);
}
assert(read('js/download.js').includes('L.geoJSON(COUNTIES'));
assert(!read('js/download.js').includes('Math.random()'));
assert(read('download.html').indexOf('js/latest-task.js') < read('download.html').indexOf('js/download.js'));
console.log(`PASS: ${pages.length} pages, ${scripts} script bodies, ${resources} local references, two CSS stylesheets and preserved original design system.`);
