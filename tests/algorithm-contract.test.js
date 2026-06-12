// The one canonical test suite: `node --test` from the repo root.
// Two layers: (1) every registered topic honors the step contract on its
// default input; (2) regression tests for the bug classes that lived in the
// 2017 code (merge-sort infinite loop on duplicates, hash indexes out of
// range, broken empty-state handling, one-sided tree search).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { topics } from '../src/registry.js';
import { validateSteps, InputError } from '../src/core/state.js';
import { hashIndex } from '../src/topics/hash-table.js';

const MAX_STEPS = 5000;

async function loadTopic(id) {
  const entry = topics.find((t) => t.id === id);
  assert.ok(entry, `registry has ${id}`);
  return (await entry.module()).topic;
}

function inputFor(topic, overrides = {}) {
  const input = {};
  for (const control of topic.controls) {
    input[control.id] = overrides[control.id]
      ?? control.defaultValue
      ?? (control.options ? control.options[0] : '');
  }
  return input;
}

// Collects steps while snapshotting each state's JSON, so we can prove the
// algorithm never mutated an already-yielded step. Also enforces termination.
function runTopic(topic, overrides = {}) {
  const collected = [];
  for (const step of topic.run(inputFor(topic, overrides))) {
    collected.push({ step, frozen: JSON.stringify(step.state) });
    assert.ok(collected.length <= MAX_STEPS, `${topic.id}: generator did not terminate`);
  }
  for (const { step, frozen } of collected) {
    assert.equal(JSON.stringify(step.state), frozen,
      `${topic.id}: a yielded state was mutated by a later step`);
  }
  return validateSteps(collected.map((c) => c.step), topic.id);
}

const finalArray = (steps) => steps.at(-1).state.items.map((item) => item.value);
const lastText = (steps) => steps.at(-1).explanation;
const anyFound = (steps) => steps.some((s) => (s.highlight?.found ?? []).length > 0);

// ----------------------------------------------- layer 1: the contract

const visualizations = topics.filter((t) => t.type === 'visualization');

test('registry entries are complete and unique', () => {
  const ids = new Set();
  for (const entry of topics) {
    assert.ok(entry.id && entry.title && entry.summary && entry.category, `${entry.id}: metadata complete`);
    assert.ok(!ids.has(entry.id), `${entry.id}: unique`);
    ids.add(entry.id);
  }
});

for (const entry of visualizations) {
  test(`${entry.id}: default input honors the step contract`, async () => {
    const topic = await loadTopic(entry.id);
    assert.equal(topic.id, entry.id, 'module id matches registry id');
    const steps = runTopic(topic);
    assert.ok(steps.length >= 3, 'produces a meaningful number of steps');
  });
}

// ------------------------------------------ layer 2: sorting correctness

const SORTS = ['bubble-sort', 'merge-sort', 'quick-sort', 'heap-sort', 'insertion-sort', 'selection-sort'];
const HOSTILE_INPUTS = {
  'duplicates': '5, 3, 5, 1, 3, 5',
  'all equal (2017 merge-sort hung here)': '4, 4, 4, 4',
  'already sorted': '1, 2, 3, 4, 5',
  'reverse sorted': '9, 7, 5, 3, 1',
  'negatives and zero': '-3, 10, 0, -3, 2',
};

for (const id of SORTS) {
  for (const [name, values] of Object.entries(HOSTILE_INPUTS)) {
    test(`${id}: sorts correctly with ${name}`, async () => {
      const topic = await loadTopic(id);
      const steps = runTopic(topic, { values });
      const expected = values.split(',').map(Number).sort((a, b) => a - b);
      assert.deepEqual(finalArray(steps), expected);
    });
  }
}

// --------------------------------------------------- layer 2: searching

test('linear-search: finds present target, reports absent target', async () => {
  const topic = await loadTopic('linear-search');
  assert.ok(anyFound(runTopic(topic, { target: '9' })));
  const missing = runTopic(topic, { target: '999' });
  assert.ok(!anyFound(missing));
  assert.match(lastText(missing), /not here/);
});

test('binary-search: finds target, proves absence, survives duplicates', async () => {
  const topic = await loadTopic('binary-search');
  assert.ok(anyFound(runTopic(topic, { target: '16' })));
  const missing = runTopic(topic, { target: '999' });
  assert.ok(!anyFound(missing));
  assert.match(lastText(missing), /not in the array/);
  assert.ok(anyFound(runTopic(topic, { values: '7, 7, 7, 2, 2', target: '7' })));
});

// ----------------------------------------- layer 2: stack, queue, list

test('stack and queue: drain to empty without crashing (2017 NaN checks)', async () => {
  for (const id of ['stack', 'queue']) {
    const topic = await loadTopic(id);
    const steps = runTopic(topic, { values: '1, 2, 3' });
    assert.equal(steps.at(-1).state.items.length, 0, `${id} ends empty`);
  }
});

test('linked-list: removes head, removes middle, handles missing value', async () => {
  const topic = await loadTopic('linked-list');
  const removeHead = runTopic(topic, { values: '7, 3, 9', target: '7' });
  assert.deepEqual(finalArray(removeHead), [3, 9]);
  const removeMid = runTopic(topic, { values: '7, 3, 9', target: '3' });
  assert.deepEqual(finalArray(removeMid), [7, 9]);
  const missing = runTopic(topic, { values: '7, 3, 9', target: '42' });
  assert.deepEqual(finalArray(missing), [7, 3, 9]);
  assert.match(lastText(missing), /nothing to remove/);
});

// ------------------------------------------------- layer 2: hash table

test('hashIndex is always in range (2017 version wrote past the buckets)', () => {
  for (const key of [0, 1, 7, 8, 23, 1009, -1, -8, -23]) {
    for (const capacity of [4, 8, 16]) {
      const index = hashIndex(key, capacity);
      assert.ok(index >= 0 && index < capacity, `hashIndex(${key}, ${capacity}) = ${index}`);
    }
  }
});

test('hash-table: every state stays within capacity, rehash doubles, lookup works', async () => {
  const topic = await loadTopic('hash-table');
  const steps = runTopic(topic);
  for (const step of steps) {
    assert.equal(step.state.buckets.length, step.state.meta.capacity);
  }
  assert.equal(steps.at(-1).state.meta.capacity, 16, 'default 6 keys trigger one rehash');
  assert.ok(anyFound(steps.slice(-1)), 'default lookup is found');
  const missing = runTopic(topic, { lookup: '999' });
  assert.match(lastText(missing), /absent/);
});

// -------------------------------------------------------- layer 2: BST

test('binary-search-tree: finds values in BOTH subtrees (2017 bug searched left only)', async () => {
  const topic = await loadTopic('binary-search-tree');
  // 16 and 12 live in the right subtree of the default input; 2 in the left.
  for (const target of ['12', '16', '2', '10']) {
    assert.ok(anyFound(runTopic(topic, { target })), `finds ${target}`);
  }
  const missing = runTopic(topic, { target: '999' });
  assert.ok(!anyFound(missing));
  assert.match(lastText(missing), /not in the tree/);
});

// -------------------------------------------------- layer 2: recursion

test('recursion: fibonacci and factorial return correct results', async () => {
  const topic = await loadTopic('recursion');
  const fib = runTopic(topic, { fn: 'fibonacci', n: '6' });
  const fibRoot = fib.at(-1).state.frames.find((f) => f.parentId === null);
  assert.equal(fibRoot.result, 8, 'fib(6) = 8');
  const fact = runTopic(topic, { fn: 'factorial', n: '5' });
  const factRoot = fact.at(-1).state.frames.find((f) => f.parentId === null);
  assert.equal(factRoot.result, 120, 'fact(5) = 120');
  assert.ok(fib.at(-1).state.frames.every((f) => f.status === 'returned'), 'all frames returned');
});

// -------------------------------------------------- layer 2: attention

test('attention: softmax rows sum to 1 and output has token-by-dim shape', async () => {
  const topic = await loadTopic('attention');
  const steps = runTopic(topic, { text: 'the cat sat here' });
  const pattern = steps.findLast((s) => s.state.title === 'The attention pattern').state;
  for (const row of pattern.rows) {
    const sum = pattern.cells.filter((c) => c.row === row.id).reduce((a, c) => a + c.value, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `row ${row.label} sums to 1 (got ${sum})`);
  }
  const output = steps.findLast((s) => s.state.title.startsWith('Output')).state;
  assert.equal(output.rows.length, 4, 'one output row per token');
  assert.equal(output.columns.length, 4, 'embedding dimension preserved');
});

// ------------------------------------------------ layer 2: input guards

test('bad input throws InputError, not garbage steps', async () => {
  const cases = [
    ['linear-search', { values: 'abc, def' }],
    ['linear-search', { values: '1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13' }],
    ['stack', { values: '5' }],
    ['recursion', { n: '99' }],
    ['attention', { text: 'one' }],
  ];
  for (const [id, overrides] of cases) {
    const topic = await loadTopic(id);
    assert.throws(() => runTopic(topic, overrides), InputError, `${id} rejects ${JSON.stringify(overrides)}`);
  }
});
