const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createLatestTask } = require('../js/latest-task.js');
function pending() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }

test('selection change aborts and rejects a stale completion', async () => {
  const states = [], old = pending(); let signal;
  const task = createLatestTask(state => states.push(state));
  const request = task.run(s => { signal = s; return old.promise; });
  task.cancel(); await task.run(async () => 'new county');
  old.resolve('old county'); await request;
  assert(signal.aborted);
  assert.deepEqual(states.at(-1), { phase: 'ready', value: 'new county' });
  assert.equal(states.filter(s => s.phase === 'ready').length, 1);
});
test('failure preserves the ability to retry', async () => {
  const states = [], task = createLatestTask(state => states.push(state));
  await task.run(async () => { throw new Error('unavailable'); });
  assert.equal(states.at(-1).phase, 'error');
  await task.run(async () => 'ready');
  assert.equal(states.at(-1).value, 'ready');
});
test('cancelled late failures cannot replace idle', async () => {
  const states = [], deferred = pending(), task = createLatestTask(s => states.push(s));
  const work = task.run(() => deferred.promise); task.cancel(); deferred.reject(new Error('late')); await work;
  assert.equal(states.at(-1).phase, 'idle');
});

// Small DOM fixture exercises submission order and failures, not browser layout.
function formFixture({ storageError = false, invalid = false, stored = '[]' } = {}) {
  let removed = false, saved, focused, panel;
  function element(tag) {
    return { tagName: tag, children: [], attributes: {}, classList: { add() {}, remove() {} },
      append(...items) { this.children.push(...items); },
      setAttribute(key, value) { this.attributes[key] = String(value); },
      focus() { focused = this; }
    };
  }
  const fields = {};
  for (const [id, value] of Object.entries({ 'f-name': '<strong>Test user</strong>', 'f-org': 'Example', 'f-email': 'tester@example.gov', 'f-role': 'GIS', 'f-use': 'Review ponding' })) {
    fields[id] = Object.assign(element('input'), { value, checkValidity: () => !(invalid && id === 'f-name') });
  }
  const form = element('form'), emailMessage = element('div');
  form.querySelectorAll = () => Object.values(fields);
  form.closest = () => ({ replaceChildren(value) { assert(saved, 'Success UI must follow persistence'); panel = value; removed = true; } });
  const context = { document: {
    getElementById(id) { if (id === 'req-form') return form; if (id === 'email-msg') return emailMessage; if (fields[id]) { assert(!removed, 'Inputs read after removal'); return fields[id]; } return null; },
    createElement: element, querySelectorAll: () => []
  }, HUB: { checkDomain: () => ({ state: 'review' }) }, localStorage: {
    getItem: () => stored,
    setItem(key, value) { if (storageError) throw new Error('quota'); saved = { key, value }; }
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/forms.js'), 'utf8'), context);
  form.onsubmit({ preventDefault() {} });
  return { saved, removed, focused, panel, form, fields };
}
test('request values are captured and saved before the form is replaced', () => {
  const f = formFixture(); assert(f.removed);
  assert.equal(JSON.parse(f.saved.value)[0].name, '<strong>Test user</strong>');
  assert.equal(f.focused.textContent, 'Request received');
  assert(f.panel.children[1].textContent.includes('<strong>Test'));
  assert.equal(f.panel.children[1].innerHTML, undefined, 'User content must not be inserted as HTML');
});
test('storage failure keeps the original editable fields', () => {
  const f = formFixture({ storageError: true });
  assert.equal(f.removed, false); assert.equal(f.saved, undefined);
  assert(f.form.children.at(-1).textContent.includes('entries are preserved'));
});
test('malformed queue is not silently overwritten', () => {
  const f = formFixture({ stored: '{}' }); assert.equal(f.saved, undefined); assert.equal(f.removed, false);
});
test('invalid input retains the form and moves focus to the field', () => {
  const f = formFixture({ invalid: true }); assert.equal(f.saved, undefined); assert.equal(f.focused, f.fields['f-name']);
});
