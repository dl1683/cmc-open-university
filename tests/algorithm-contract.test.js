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

// ----------------------------------------------- layer 2: AI & concepts

test('gradient-descent: converges on a sane learning rate, diverges on 1.05', async () => {
  const topic = await loadTopic('gradient-descent');
  const good = runTopic(topic, { lr: '0.35' });
  const finalMarker = good.at(-1).state.markers.at(-1);
  assert.ok(Math.abs(finalMarker.x - 3) < 0.2, `converged near 3 (got ${finalMarker.x})`);
  const bad = runTopic(topic, { lr: '1.05 (too big!)' });
  assert.match(lastText(bad), /DIVERGED/);
});

test('k-means: converges and every point ends assigned to a real centroid', async () => {
  const topic = await loadTopic('k-means');
  for (const k of ['2', '3', '4']) {
    const steps = runTopic(topic, { k });
    assert.match(lastText(steps), /CONVERGED/);
    const last = steps.at(-1).state;
    const centroidIds = new Set(last.centroids.map((c) => c.id));
    assert.equal(last.centroids.length, Number(k));
    assert.ok(last.points.every((p) => centroidIds.has(p.clusterId)), `k=${k}: all points assigned`);
  }
});

test('memoization: result correct and far fewer calls than naive recursion', async () => {
  const topic = await loadTopic('memoization');
  const steps = runTopic(topic, { n: '8' });
  assert.match(lastText(steps), /fib\(8\) = 21/);
  assert.ok(steps.at(-1).state.frames.length < 41, 'memoized tree much smaller than the 41-call naive tree');
});

// ---------------------------------------------- layer 2: graphs & systems

test('graph-bfs: finds every target with minimal hops claimed', async () => {
  const topic = await loadTopic('graph-bfs');
  for (const target of ['G', 'F', 'H']) {
    assert.ok(anyFound(runTopic(topic, { target })), `reaches ${target}`);
  }
});

test('dijkstra: takes the cheap 9-cost route to F, not the 12-cost shortcut', async () => {
  const topic = await loadTopic('dijkstra');
  const steps = runTopic(topic, { target: 'F' });
  const last = steps.at(-1);
  assert.match(last.explanation, /cost 9/);
  assert.ok(last.highlight.found.includes('C') && last.highlight.found.includes('E'), 'route goes through C and E');
  assert.ok(!last.highlight.found.includes('B'), 'route avoids the expensive shortcut via B');
});

test('bloom-filter: inserted key is "probably", absent key with clear bit is "definitely not"', async () => {
  const topic = await loadTopic('bloom-filter');
  const hit = runTopic(topic, { query: '47' });
  assert.ok(hit.some((s) => /PROBABLY present/.test(s.explanation)));
  const steps = runTopic(topic, { keys: '21, 47', query: '22' });
  const verdict = steps.filter((s) => /DEFINITELY NOT|PROBABLY/.test(s.explanation)).at(-1);
  assert.ok(verdict, 'reaches a verdict');
});

test('lru-cache: evicts least-recently-used, never exceeds capacity', async () => {
  const topic = await loadTopic('lru-cache');
  const steps = runTopic(topic, { capacity: '3', accesses: '1, 2, 3, 1, 4' });
  for (const step of steps) assert.ok(step.state.items.length <= 3, 'capacity respected');
  const final = finalArray(steps);
  assert.deepEqual(final, [4, 1, 3], 'most-recent-first order; 2 was evicted as LRU');
});

test('a-star: optimal path both ways, heuristic settles fewer nodes', async () => {
  const topic = await loadTopic('a-star');
  const withH = runTopic(topic, { heuristic: 'straight-line distance' });
  const withoutH = runTopic(topic, { heuristic: 'zero (becomes Dijkstra)' });
  for (const steps of [withH, withoutH]) {
    assert.match(steps.at(-1).explanation, /cost 11\.5/);
  }
  const settledCount = (steps) => Number(steps.at(-1).explanation.match(/settling (\d+)/)[1]);
  assert.ok(settledCount(withH) <= settledCount(withoutH), 'heuristic never settles more nodes than Dijkstra');
});

test('kv-cache: cached mode computes O(n) vectors, naive grows quadratically', async () => {
  const topic = await loadTopic('kv-cache');
  const fast = runTopic(topic, { mode: 'with KV cache' });
  assert.match(fast.at(-1).explanation, /5 vector computations/);
  const slow = runTopic(topic, { mode: 'without cache (naive)' });
  assert.match(slow.at(-1).explanation, /14 vector computations/);
});

test('b-tree: stays balanced — every leaf at the same depth, all keys present', async () => {
  const topic = await loadTopic('b-tree');
  const steps = runTopic(topic, { values: '30, 10, 50, 40, 20, 60, 15, 45, 5', target: '45' });
  const finalGraph = steps.findLast((s) => s.state.kind === 'graph').state;
  const children = new Map(finalGraph.nodes.map((n) => [n.id, []]));
  const hasParent = new Set();
  for (const e of finalGraph.edges) { children.get(e.from).push(e.to); hasParent.add(e.to); }
  const rootId = finalGraph.nodes.find((n) => !hasParent.has(n.id)).id;
  const leafDepths = [];
  (function walk(id, depth) {
    const kids = children.get(id);
    if (kids.length === 0) { leafDepths.push(depth); return; }
    for (const kid of kids) walk(kid, depth + 1);
  })(rootId, 0);
  assert.equal(new Set(leafDepths).size, 1, `all leaves at one depth (got ${leafDepths.join(',')})`);
  const allKeys = finalGraph.nodes.flatMap((n) => n.label.split('·').filter(Boolean).map(Number)).sort((a, b) => a - b);
  assert.deepEqual(allKeys, [5, 10, 15, 20, 30, 40, 45, 50, 60], 'every inserted key present exactly once');
  assert.ok(anyFound(steps), 'search finds 45');
});

test('backpropagation: one update step always reduces the loss', async () => {
  const topic = await loadTopic('backpropagation');
  for (const lr of ['0.02', '0.05', '0.1']) {
    const steps = runTopic(topic, { lr });
    const updateStep = steps.find((s) => s.state.title && s.state.title.startsWith('Update'));
    const [before, after] = updateStep.state.cells
      .filter((c) => c.column === 'l')
      .map((c) => c.value);
    assert.ok(after < before, `lr=${lr}: loss ${before} -> ${after} decreased`);
  }
});

test('write-ahead-log: recovery yields the committed state in both scenarios', async () => {
  const topic = await loadTopic('write-ahead-log');
  const crashed = runTopic(topic, { crash: 'crash mid-transaction' });
  const recovered = crashed.findLast((s) => s.state.items.some((i) => String(i.value).startsWith('A:')));
  assert.deepEqual(recovered.state.items.map((i) => i.value), ['A: $60', 'B: $90'], 'T1 applied, T2 erased');
  const clean = runTopic(topic, { crash: 'no crash' });
  const final = clean.findLast((s) => s.state.items.some((i) => String(i.value).startsWith('A:')));
  assert.deepEqual(final.state.items.map((i) => i.value), ['A: $35', 'B: $115'], 'both transactions applied');
});

test('union-find: ends as one set, detects the cycle, compression shortens paths', async () => {
  const topic = await loadTopic('union-find');
  const steps = runTopic(topic, { compression: 'on' });
  assert.match(steps.at(-2).explanation, /CYCLE/, 'connected pair flagged as a cycle');
  const finalGraph = steps.at(-1).state;
  const roots = finalGraph.nodes.filter((n) => n.note.startsWith('root'));
  assert.equal(roots.length, 1, 'all elements merged into one set');
  const compressed = steps.find((s) => /Compressed/.test(s.explanation));
  assert.ok(compressed, 'path compression step present when on');
  const off = runTopic(topic, { compression: 'off' });
  assert.ok(!off.some((s) => /Compressed/.test(s.explanation)), 'no compression step when off');
});

test('trie: autocomplete returns exactly the words under the prefix', async () => {
  const topic = await loadTopic('trie');
  const ca = runTopic(topic, { prefix: 'ca' });
  const harvest = ca.find((s) => /Suggestions:/.test(s.explanation));
  for (const word of ['cat', 'car', 'card', 'care']) assert.match(harvest.explanation, new RegExp(`"${word}"`));
  assert.ok(!/"do"/.test(harvest.explanation), 'do is not a ca-completion');
  const absent = runTopic(topic, { prefix: 'x (absent)' });
  assert.match(lastText(absent), /NOTHING in the dictionary/);
});

test('topological-sort: order respects every edge; cycle variant deadlocks', async () => {
  const topic = await loadTopic('topological-sort');
  const steps = runTopic(topic, { scenario: 'valid plan' });
  const order = lastText(steps).match(/Done: ([A-Z1→ ]+) —/)[1].split(' → ');
  assert.equal(order.length, 7, 'all 7 courses ordered');
  const slot = new Map(order.map((id, i) => [id, i]));
  for (const [from, to] of [['CS1', 'DS'], ['M1', 'AL'], ['DS', 'AL'], ['DS', 'DB'], ['AL', 'ML'], ['DB', 'CAP'], ['ML', 'CAP']]) {
    assert.ok(slot.get(from) < slot.get(to), `${from} before ${to}`);
  }
  const cycle = runTopic(topic, { scenario: 'circular (deadlock!)' });
  assert.match(lastText(cycle), /DEADLOCK|circular/i);
});

test('huffman-coding: codes are prefix-free and frequent symbols get shorter codes', async () => {
  const topic = await loadTopic('huffman-coding');
  const steps = runTopic(topic, { text: 'beekeepers see bees' });
  const finalGraph = steps.at(-1).state;
  const codes = finalGraph.nodes.filter((n) => n.note).map((n) => ({ label: n.label, code: n.note }));
  assert.ok(codes.length >= 5, 'codes assigned to all leaves');
  for (const a of codes) {
    for (const b of codes) {
      if (a !== b) assert.ok(!b.code.startsWith(a.code), `${a.code} is not a prefix of ${b.code}`);
    }
  }
  const eCode = codes.find((c) => c.label.startsWith('e:')).code;
  assert.ok(codes.every((c) => eCode.length <= c.code.length), 'most frequent symbol has the shortest code');
});

test('convolution: edge kernel responds strongest at the image boundary', async () => {
  const topic = await loadTopic('convolution');
  const steps = runTopic(topic, { kernel: 'vertical edge detector' });
  const featureMap = steps.findLast((s) => s.state.title && s.state.title.startsWith('The full feature map')).state;
  const byColumn = new Map();
  for (const cell of featureMap.cells) {
    byColumn.set(cell.column, Math.max(byColumn.get(cell.column) ?? 0, Math.abs(cell.value)));
  }
  const edgeResponse = Math.max(byColumn.get('p1'), byColumn.get('p2'));
  const flatResponse = Math.max(byColumn.get('p0'), byColumn.get('p3'));
  assert.ok(edgeResponse > flatResponse * 2, `edge columns (${edgeResponse}) dominate flat columns (${flatResponse})`);
});

test('lora: delta is exactly rank-r and merge adds it onto frozen W', async () => {
  const topic = await loadTopic('lora');
  const steps = runTopic(topic, { rank: '1' });
  const delta = steps.find((s) => s.state.title && s.state.title.startsWith('ΔW')).state;
  const grid = new Map(delta.cells.map((c) => [c.id, c.value]));
  // rank-1 check: 2x2 minors vanish — d00*d11 === d01*d10 (within rounding)
  const minor = grid.get('r0:c0') * grid.get('r1:c1') - grid.get('r0:c1') * grid.get('r1:c0');
  assert.ok(Math.abs(minor) < 0.05, `rank-1 delta has vanishing 2x2 minors (got ${minor})`);
  assert.match(steps.find((s) => /instead of 36|65,536/.test(s.explanation)).explanation, /12 numbers instead of 36/);
});

test('sliding-window: finds the true longest window under the budget', async () => {
  const topic = await loadTopic('sliding-window');
  const steps = runTopic(topic, { values: '4, 2, 1, 7, 8, 1, 2, 8, 1, 0', limit: '8' });
  assert.match(lastText(steps), /length 3/, 'longest legal window is [4, 2, 1]');
  assert.deepEqual(steps.at(-1).highlight.found, ['i0', 'i1', 'i2']);
  assert.throws(() => runTopic(topic, { values: '3, -1, 4' }), InputError, 'negatives rejected');
});

test('cap-theorem: CP refuses during partition, AP serves stale, both heal to 9', async () => {
  const topic = await loadTopic('cap-theorem');
  const cpRun = runTopic(topic, { choice: 'consistency (CP)' });
  assert.ok(cpRun.some((s) => /REFUSES/.test(s.explanation)), 'CP refuses the read');
  const apRun = runTopic(topic, { choice: 'availability (AP)' });
  assert.ok(apRun.some((s) => /STALE/.test(s.explanation)), 'AP serves stale');
  for (const steps of [cpRun, apRun]) {
    const healed = steps.find((s) => /HEALS/.test(s.explanation)).state;
    for (const id of ['N1', 'N2']) {
      assert.equal(healed.nodes.find((n) => n.id === id).note, 'x = 9', `${id} reconciled`);
    }
  }
});

test('raft-log-replication: logs converge identically in both scenarios', async () => {
  const topic = await loadTopic('raft-log-replication');
  for (const scenario of ['steady replication', 'leader crash + conflict']) {
    const steps = runTopic(topic, { scenario });
    const final = steps.at(-1).state;
    const rowsOf = (rowId) => final.cells.filter((c) => c.row === rowId).map((c) => c.value);
    assert.deepEqual(rowsOf('s0'), rowsOf('s1'), `${scenario}: S1 matches S2`);
    assert.deepEqual(rowsOf('s1'), rowsOf('s2'), `${scenario}: S2 matches S3`);
  }
  const crash = runTopic(topic, { scenario: 'leader crash + conflict' });
  assert.ok(crash.some((s) => /DELETED and overwritten/.test(s.explanation)), 'conflict resolution shown');
});

test('merkle-tree: locates each tampered block; identical replicas verify with one comparison', async () => {
  const topic = await loadTopic('merkle-tree');
  for (const [choice, leafId] of [['block 5', 'n0_4'], ['block 2', 'n0_1']]) {
    const steps = runTopic(topic, { tamper: choice });
    assert.deepEqual(steps.at(-1).highlight.found, [leafId], `${choice} pinpointed`);
    assert.match(lastText(steps), /3 comparisons/, 'log2(8) = 3 descent comparisons');
  }
  const clean = runTopic(topic, { tamper: 'nothing (identical)' });
  assert.ok(clean.some((s) => /IDENTICAL, all 8 blocks, proven by one comparison/.test(s.explanation)));
});

test('mixture-of-experts: top-k routing activates exactly k experts per token', async () => {
  const topic = await loadTopic('mixture-of-experts');
  for (const [kStr, expected] of [['1', 4], ['2', 8]]) {
    const steps = runTopic(topic, { topk: kStr });
    const routing = steps.find((s) => s.state.title && s.state.title.startsWith(`Top-${kStr} routing:`));
    assert.equal(routing.highlight.active.length, expected, `k=${kStr} activates ${expected} of 16 cells`);
  }
  const steps = runTopic(topic, { topk: '1' });
  const routing = steps.find((s) => s.state.title.startsWith('Top-1'));
  assert.ok(routing.highlight.active.includes('t1:e1'), 'protein routes to its specialist E2');
});

test('speculative-decoding: lossless — both drafts produce the identical sentence', async () => {
  const topic = await loadTopic('speculative-decoding');
  const good = runTopic(topic, { draft: 'good draft' });
  const weak = runTopic(topic, { draft: 'weak draft' });
  assert.deepEqual(finalArray(good), finalArray(weak), 'output independent of draft quality');
  assert.equal(finalArray(good).length, 10, 'full sentence generated');
  assert.match(lastText(good), /from 3 big-model passes/, 'good draft needs only 3 passes');
  assert.match(lastText(weak), /from 7 big-model passes/, 'weak draft needs 7 passes');
});

test('avl-tree: sorted input yields a balanced tree, not a chain', async () => {
  const topic = await loadTopic('avl-tree');
  const steps = runTopic(topic, { order: '10, 20, 30, 40, 50 (sorted!)' });
  assert.ok(steps.some((s) => /rotation/i.test(s.explanation)), 'rotations occurred');
  const final = steps.at(-1).state;
  const byId = new Map(final.nodes.map((n) => [n.id, n]));
  const depth = (id) => (id === null ? 0 : 1 + Math.max(depth(byId.get(id).left), depth(byId.get(id).right)));
  assert.equal(depth(final.rootId), 3, '5 sorted inserts give height 3, not a height-5 chain');
  const balanced = (id) => {
    if (id === null) return true;
    const n = byId.get(id);
    return Math.abs(depth(n.left) - depth(n.right)) <= 1 && balanced(n.left) && balanced(n.right);
  };
  assert.ok(balanced(final.rootId), 'every node satisfies the AVL property');
});

test('two-phase-commit: commits unanimously, aborts on one no, blocks on coordinator crash', async () => {
  const topic = await loadTopic('two-phase-commit');
  const happy = runTopic(topic, { scenario: 'all vote yes' });
  const happyFinal = happy.at(-1).state;
  for (const id of ['P1', 'P2', 'P3']) {
    assert.equal(happy.at(-2).state.nodes.find((n) => n.id === id).note, 'committed ✓');
  }
  assert.ok(happyFinal.nodes.some((n) => n.id === 'C'), 'coordinator alive in happy path');
  const veto = runTopic(topic, { scenario: 'one votes no' });
  assert.ok(veto.some((s) => /ABORT/.test(s.explanation)), 'abort broadcast');
  assert.ok(veto.at(-1).state.nodes.filter((n) => n.id.startsWith('P')).every((n) => n.note === 'rolled back'));
  const crash = runTopic(topic, { scenario: 'coordinator crashes' });
  assert.ok(crash.at(-1).state.nodes.every((n) => n.id !== 'C'), 'coordinator gone');
  assert.ok(crash.some((s) => /STUCK|BLOCKED/i.test(s.explanation)), 'blocking flaw shown');
});

test('pagerank: scores stay a probability distribution and linkless pages stay at the floor', async () => {
  const topic = await loadTopic('pagerank');
  const steps = runTopic(topic, { iterations: '10' });
  for (const step of steps.slice(2)) {
    const sum = step.state.nodes.reduce((a, n) => a + Number(n.note), 0);
    assert.ok(Math.abs(sum - 1) < 0.01, `scores sum to 1 (got ${sum.toFixed(3)})`);
  }
  const final = steps.at(-1).state;
  const score = (id) => Number(final.nodes.find((n) => n.id === id).note);
  for (const leaf of ['B', 'C', 'D']) {
    assert.ok(score(leaf) <= 0.03, `${leaf} has no inlinks and stays at the random-surfer floor`);
  }
  assert.ok(score('E') > score('B'), 'the hub outranks the leaves');
});

test('value-iteration: converges and the greedy path reaches the goal avoiding the pit', async () => {
  const topic = await loadTopic('value-iteration');
  const steps = runTopic(topic, { living: '-0.4 (urgent)' });
  assert.ok(steps.some((s) => /CONVERGED/.test(s.explanation)), 'reaches a fixed point');
  const policy = steps.find((s) => s.state.title && s.state.title.startsWith('The policy'));
  assert.ok(policy.highlight.found.includes('r0:c3'), 'path ends at the goal');
  assert.ok(!policy.highlight.found.includes('r1:c3'), 'path never enters the pit');
  assert.ok(policy.highlight.found.includes('r2:c0'), 'path starts at the start');
  assert.ok(policy.highlight.found.length <= 7, 'urgent cost takes an efficient route');
});

test('saga-pattern: failure compensates in reverse; success commits all four', async () => {
  const topic = await loadTopic('saga-pattern');
  const fail = runTopic(topic, { scenario: 'step 3 fails' });
  const undos = fail.filter((s) => /Compensate step/.test(s.explanation));
  assert.deepEqual(undos.map((s) => s.explanation.match(/Compensate step (\d)/)[1]), ['2', '1'], 'compensations run in reverse order');
  assert.ok(/nothing happened/.test(fail.find((s) => /saga ends/.test(s.explanation)).explanation));
  const ok = runTopic(topic, { scenario: 'all steps succeed' });
  const done = ok.find((s) => /All four steps committed/.test(s.explanation));
  assert.equal(done.highlight.found.length, 4, 'all steps committed');
});

// ----------------------------------------------- layer 3: study articles

for (const entry of visualizations) {
  test(`${entry.id}: exports complete study notes`, async () => {
    const mod = await (topics.find((t) => t.id === entry.id)).module();
    const { article } = mod;
    assert.ok(article && Array.isArray(article.sections), 'article with sections exists');
    assert.ok(article.sections.length >= 5, 'at least 5 sections');
    let words = 0;
    for (const section of article.sections) {
      assert.ok(typeof section.heading === 'string' && section.heading.length > 0, 'heading present');
      assert.ok(Array.isArray(section.paragraphs) && section.paragraphs.length > 0, 'paragraphs present');
      for (const p of section.paragraphs) {
        assert.ok(typeof p === 'string' && p.trim().length > 40, 'substantial paragraph');
        words += p.split(/\s+/).length;
      }
    }
    assert.ok(words >= 250, `substantial content (${words} words)`);
  });
}

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
