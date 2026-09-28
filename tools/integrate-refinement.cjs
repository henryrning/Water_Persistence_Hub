/* One-time integration of the reviewed modules into the original static site.
   Original files are backed up in review/original-before-refinement. */
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(base, name), 'utf8');
const staged = new Map();
function edit(name, from, to) {
  const source = staged.get(name) ?? read(name);
  if (!source.includes(from)) throw new Error(`Cannot locate replacement in ${name}: ${from.slice(0, 60)}`);
  staged.set(name, source.replace(from, to));
}
for (const name of fs.readdirSync(base).filter(name => name.endsWith('.html'))) {
  edit(name, '<link rel="stylesheet" href="css/hub.css">', '<link rel="stylesheet" href="css/hub.css">\n  <link rel="stylesheet" href="css/refinement.css">');
}
edit('index.html', 'See where water stood on fields through the planting season — <em>mapped every 3&nbsp;metres.</em>', 'Standing water.<br><em>Seen over time.</em>');
edit('index.html', 'Download satellite-derived standing-water maps for Prairie Pothole counties in North and South Dakota.', 'Follow the water through the planting season. Explore satellite-derived maps at 3-metre resolution, across Prairie Pothole counties in North and South Dakota.');
edit('index.html', '>Download data</a>', '>Explore the data</a>');
edit('index.html', 'Checked against 884 field photos', 'A field-tested perspective');
edit('index.html', '<div class="metric-row" id="metrics">', '<p class="muted">Validation against 884 field photos in Ramsey County, ND. Results may vary by location.</p>\n      <div class="metric-row" id="metrics">');
edit('download.html', '<p>Four choices, then one ZIP. No file names to learn.</p>', '<p>Choose counties, a year and a persistence cutoff.</p>\n      <p class="prototype-note">Prototype: prepare a README preview. Full ZIP delivery is not connected.</p>');
edit('download.html', '<div class="dl-summary" aria-live="polite">', '<div class="dl-summary">');
edit('download.html', '<div id="job"></div>', '<p id="job-status" class="inline-status" role="status" aria-atomic="true"></p>\n      <div id="job"></div>');
edit('download.html', '<script src="js/download.js"></script>', '<script src="js/latest-task.js"></script>\n<script src="js/download.js"></script>');
edit('download.html', '<p>The same selection as an API request.', '<p class="prototype-note">Example request only. This prototype is not connected to the API endpoint below.</p><p>The same selection as an API request.');
edit('download.html', 'role="application"', 'role="region"');
edit('download.html', '<div class="summary-text empty" id="summary-text">', '<div class="summary-text empty" id="summary-text" role="status" aria-atomic="true">');
edit('download.html', '<p class="small muted" style="margin:10px 0 0">Not sure?', '<p class="small muted" style="margin:10px 0 0">Choose counties and a published year first. Not sure?');
edit('request-access.html', 'Use your company or .gov address — personal addresses can’t be approved.', 'Use your company or .gov address. Other domains can be reviewed case by case.');
edit('request-access.html', '<h1>Request an account</h1>', '<span class="eyebrow">Access to the field atlas</span><h1>Request an account</h1>');
edit('request-access.html', '<form class="card-pad" id="req-form" novalidate>', '<form class="card-pad" id="req-form" novalidate>\n        <p class="prototype-note">Demo request: saved only in this browser. No email or real application is sent.</p>');
edit('request-access.html', '>Submit request</button>', '>Save demo request</button>');
edit('about.html', '<h1>About the hub</h1>', '<span class="eyebrow">The people behind the pixels</span><h1>Science, with a field perspective.</h1>');
edit('about.html', '<div class="wrap" style="padding-bottom:80px">', '<div class="wrap" style="padding-bottom:80px">\n    <p class="prototype-note">These forms save drafts on this device. To send a question or data report, use the team email links.</p>');
edit('about.html', '<form class="card-pad" data-form="report">', '<form class="card-pad" data-form="report">\n          <p class="small">Email a report to <a href="mailto:waterhub-issues@illinois.edu">waterhub-issues@illinois.edu</a>.</p>');
edit('docs.html', '<h1>Documentation</h1>', '<span class="eyebrow">A guide to the data</span><h1>Read the landscape correctly.</h1>');
edit('signin.html', '<h1>Sign in</h1>', '<span class="eyebrow">Your data workspace</span><h1>Welcome to the hub.</h1>');
edit('signin.html', '<p class="muted">Use the work email your account was issued to.</p>', '<p class="muted">Explore the selection workflow with a demo account.</p>');
{
  const source = staged.get('signin.html');
  const start = source.indexOf('<form id="signin-form">'), end = source.indexOf('</form>', start) + 7;
  staged.set('signin.html', source.slice(0, start) + '<form id="signin-form"><p class="prototype-note">No password needed. This is a local demonstration, not a live account service.</p><button class="btn btn-primary btn-block btn-lg" type="submit">Continue as demo data user</button></form>' + source.slice(end));
}
for (const name of ['signin.html', 'request-access.html', 'about.html', 'account.html']) {
  const source = staged.get(name);
  const start = source.lastIndexOf('<script>'), end = source.indexOf('</script>', start) + 9;
  if (start < 0 || end < start) throw new Error(`Missing inline page script: ${name}`);
  staged.set(name, source.slice(0, start) + `<script src="js/${name === 'account.html' ? 'account' : 'forms'}.js"></script>` + source.slice(end));
}
edit('account.html', 'Packages stay ready for 7 days. Re-open any selection to build it again.', 'Selections prepared in this browser. Reopen a selection to create its README preview.');
edit('account.html', '<div class="table-wrap">', '<div class="empty-state" id="history-empty" hidden><span class="eyebrow">Your first selection</span><h2>A fresh start.</h2><p>Prepare a download preview and your selection will appear here.</p><a class="btn btn-primary" href="download.html">Explore counties</a></div>\n      <p class="callout callout-warn" id="history-error" role="alert" hidden>History could not be read. Your stored data has not been changed. <a href="download.html">Start a new selection</a>.</p>\n      <div class="table-wrap" id="history-table">');
edit('account.html', '<th class="num">Size</th>', '<th class="num">Est. ZIP size</th>');
{
  let source = staged.get('account.html');
  const start = source.indexOf('<button class="btn btn-secondary btn-sm" onclick='), end = source.indexOf('</button>', start) + 9;
  source = source.slice(0, start) + '<p class="small muted">This is a demo account. Password changes are available only in the live account service.</p>' + source.slice(end);
  const api = source.indexOf('<h3 style="display:flex;gap:8px;align-items:center">API token</h3>');
  const endAside = source.indexOf('\n    </aside>', api);
  source = source.slice(0, api) + '<h3>Scripted access</h3><p class="small muted">Personal API tokens will be issued by the live account service. No active token is available in this prototype.</p><a class="link-arrow" href="docs-formats.html#api">Read the API guide</a>\n      </div>' + source.slice(endAside);
  staged.set('account.html', source);
}
for (const [name, content] of staged) fs.writeFileSync(path.join(base, name), content);
fs.copyFileSync(path.join(base, 'review/preview-task.js'), path.join(base, 'js/latest-task.js'));
console.log(`Integrated refinement into ${staged.size} pages; shared scripts use existing local assets.`);
