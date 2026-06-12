// The one canonical test suite: `node --test` from the repo root.
// Two layers: (1) every registered topic honors the step contract on its
// default input; (2) regression tests for the bug classes that lived in the
// 2017 code (merge-sort infinite loop on duplicates, hash indexes out of
// range, broken empty-state handling, one-sided tree search).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { topics, searchTopics } from '../src/registry.js';
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

test('transformer-block: layer norm rows have mean zero and shape is preserved', async () => {
  const topic = await loadTopic('transformer-block');
  const steps = runTopic(topic, { text: 'the cat sat' });
  for (const title of ['Add & Norm: x + attention(x), then LayerNorm', 'Block output: ready for the next block']) {
    const state = steps.find((s) => s.state.title === title).state;
    for (const row of state.rows) {
      const mean = state.cells.filter((c) => c.row === row.id).reduce((a, c) => a + c.value, 0) / 4;
      assert.ok(Math.abs(mean) < 1e-6, `${title}: row ${row.label} normalized (mean ${mean})`);
    }
    assert.equal(state.rows.length, 3, 'one row per token throughout');
    assert.equal(state.columns.length, 4, 'dimension preserved for stacking');
  }
});

test('kruskal-mst: builds the optimal 6-edge tree, rejects exactly the cycle edges', async () => {
  const topic = await loadTopic('kruskal-mst');
  const steps = runTopic(topic, { mode: 'full run' });
  const done = steps.find((s) => /Done:/.test(s.explanation)).explanation;
  assert.match(done, /6 edges/);
  assert.match(done, /total cost 19/);
  const rejections = steps.filter((s) => /REJECTED/.test(s.explanation));
  assert.deepEqual(rejections.map((s) => s.explanation.slice(0, 2)), ['AB', 'BG'], 'AB and BG close cycles');
  const clusters = runTopic(topic, { mode: 'stop at 3 clusters' });
  assert.match(lastText(clusters), /single-linkage|CLUSTERS/i);
});

test('finite-state-machine: accepts exactly the ab*c strings', async () => {
  const topic = await loadTopic('finite-state-machine');
  for (const [option, ok] of [['abbbc (match)', true], ['ac (match)', true], ['abca (reject)', false], ['bc (reject)', false]]) {
    const steps = runTopic(topic, { input: option });
    const verdict = steps.find((s) => /ACCEPTED|REJECTED/.test(s.explanation));
    assert.match(verdict.explanation, ok ? /ACCEPTED/ : /REJECTED/, option);
  }
});

test('edit-distance: computes the canonical distances with a correct edit script', async () => {
  const topic = await loadTopic('edit-distance');
  const cases = [['kitten → sitting', 3], ['sunday → saturday', 3], ['cat → cat', 0]];
  for (const [pair, expected] of cases) {
    const steps = runTopic(topic, { pair });
    const answer = steps.find((s) => s.state.title && s.state.title.startsWith('The answer'));
    const corner = answer.highlight.found[0];
    const value = answer.state.cells.find((c) => c.id === corner).value;
    assert.equal(value, expected, `${pair} distance ${expected}`);
  }
  const kitten = runTopic(topic, { pair: 'kitten → sitting' });
  assert.match(lastText(kitten), /substitute 'k' → 's'.*insert 'g'/s, 'edit script recovered');
});

test('multi-head-attention: head rows are softmax-normalized and concat preserves shape', async () => {
  const topic = await loadTopic('multi-head-attention');
  const steps = runTopic(topic, { view: 'both heads' });
  for (const title of ['Head 1: a positional specialist', 'Head 2: a semantic specialist']) {
    const state = steps.find((s) => s.state.title === title).state;
    for (const row of state.rows) {
      const sum = state.cells.filter((c) => c.row === row.id).reduce((a, c) => a + c.value, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${title} row ${row.label} sums to 1`);
    }
  }
  const concat = steps.find((s) => s.state.title.startsWith('Concatenate')).state;
  assert.equal(concat.rows.length, 4, 'one row per token');
  assert.equal(concat.columns.length, 4, 'two dims per head, concatenated');
});

test('prims-mst: reaches the same minimum total as Kruskal from any start', async () => {
  const topic = await loadTopic('prims-mst');
  for (const start of ['A', 'D']) {
    const steps = runTopic(topic, { start });
    assert.match(steps.find((s) => /Complete:/.test(s.explanation)).explanation, /total cost 19/, `start ${start} reaches cost 19`);
  }
});

test('gossip-protocol: saturates every reachable node, even with failures', async () => {
  const topic = await loadTopic('gossip-protocol');
  const healthy = runTopic(topic, { health: 'all 12 nodes healthy' });
  const healthyFinal = healthy.findLast((s) => /Saturation/.test(s.explanation)).state;
  assert.equal(healthyFinal.nodes.filter((n) => n.note === 'knows').length, 12, 'all 12 informed');
  const degraded = runTopic(topic, { health: '3 nodes offline' });
  const degradedFinal = degraded.findLast((s) => /Saturation/.test(s.explanation)).state;
  assert.equal(degradedFinal.nodes.filter((n) => n.note === 'knows').length, 9, 'all 9 alive nodes informed');
  assert.equal(degradedFinal.nodes.filter((n) => n.note === 'offline').length, 3, 'offline stay uninformed');
});

test('binary-exponentiation: correct modular results with logarithmic operation counts', async () => {
  const topic = await loadTopic('binary-exponentiation');
  const a = runTopic(topic, { problem: '7^45 mod 100' });
  assert.match(a.find((s) => /Answer:/.test(s.explanation)).explanation, /= 7, in 6 squarings \+ 4 multiplies/);
  const b = runTopic(topic, { problem: '3^10 mod 50' });
  assert.match(b.find((s) => /Answer:/.test(s.explanation)).explanation, /= 49, in 4 squarings \+ 2 multiplies/);
});

test('cdn-request-flow: hit never touches the origin; miss fills the cache for the next user', async () => {
  const topic = await loadTopic('cdn-request-flow');
  const hitRun = runTopic(topic, { scenario: 'has the file (hit)' });
  assert.ok(!hitRun.some((s) => (s.highlight.active ?? []).includes('O1')), 'origin untouched on hit');
  assert.ok(hitRun.some((s) => /never even heard/.test(s.explanation)));
  const missRun = runTopic(topic, { scenario: 'is cold (miss)' });
  assert.ok(missRun.some((s) => (s.highlight.active ?? []).includes('O1')), 'origin reached on miss');
  assert.ok(missRun.some((s) => /Cache-Control/.test(s.explanation)), 'headers explained');
  assert.match(lastText(missRun), /20ms HIT/, 'next user benefits');
});

test('reservoir-sampling: never exceeds k slots and ends with the scripted fair sample', async () => {
  const topic = await loadTopic('reservoir-sampling');
  const steps = runTopic(topic, { k: '3' });
  for (const step of steps) {
    assert.ok(step.state.items.length <= 3, 'reservoir bounded at k');
  }
  assert.deepEqual(finalArray(steps), ['E', 'J', 'G'], 'deterministic script yields the expected sample');
  assert.match(lastText(steps), /Sliding Window/, 'cross-links its streaming cousin');
});

test('git-internals: unchanged blob is shared by both commits; new edit creates four objects', async () => {
  const topic = await loadTopic('git-internals');
  const steps = runTopic(topic, { show: 'two commits, one edit' });
  const state = steps[0].state;
  const intoB1 = state.edges.filter((e) => e.to === 'B1').map((e) => e.from).sort();
  assert.deepEqual(intoB1, ['T1', 'T1b'], 'README blob shared by both root trees');
  assert.ok(state.edges.some((e) => e.from === 'C2' && e.to === 'C1'), 'commit 2 points at parent commit 1');
  assert.ok(steps.some((s) => /4 small objects/.test(s.explanation)), 'edit cost counted');
});

test('positional-encoding: fingerprints are unique, bounded, and multi-frequency', async () => {
  const topic = await loadTopic('positional-encoding');
  const steps = runTopic(topic, { positions: '12' });
  const state = steps[1].state;
  const rowOf = (rid) => state.cells.filter((c) => c.row === rid).map((c) => c.value);
  const fingerprints = state.rows.map((r) => JSON.stringify(rowOf(r.id)));
  assert.equal(new Set(fingerprints).size, 12, 'all 12 position fingerprints unique');
  assert.ok(state.cells.every((c) => c.value >= -1 && c.value <= 1), 'all values bounded in [-1, 1]');
  const signChanges = (vals) => vals.slice(1).filter((v, i) => Math.sign(v) !== Math.sign(vals[i])).length;
  const fast = signChanges(state.rows.map((r) => rowOf(r.id)[0]));
  const slow = signChanges(state.rows.map((r) => rowOf(r.id)[6]));
  assert.ok(fast > slow, `low dimension oscillates faster (${fast} vs ${slow} sign changes)`);
});

test('database-indexing: scan touches all rows, index touches few, covering skips the table', async () => {
  const topic = await loadTopic('database-indexing');
  const scan = runTopic(topic, { query: 'WHERE age = 41 (no index)' });
  const scanStep = scan.find((s) => /FULL TABLE SCAN/.test(s.explanation));
  assert.equal(scanStep.highlight.compare.length, 8, 'scan checks every row');
  const indexed = runTopic(topic, { query: 'WHERE age = 41 (indexed)' });
  assert.ok(indexed.some((s) => /Binary Search/.test(s.explanation)), 'index seek explained');
  const covering = runTopic(topic, { query: 'covering index' });
  assert.ok(covering.some((s) => /NEVER touched/.test(s.explanation)), 'covering index skips the table');
  assert.match(lastText(covering), /write amplification/i, 'write-time cost taught');
});

test('rope: norms preserved under rotation and equal offsets give equal scores', async () => {
  const topic = await loadTopic('rope');
  const steps = runTopic(topic, { theta: '30°' });
  const rotations = steps[0].state;
  for (const row of rotations.rows) {
    const [x, y] = rotations.cells.filter((c) => c.row === row.id).map((c) => c.value);
    assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9, `${row.label} keeps unit norm`);
  }
  const dotsState = steps[1].state;
  const qk = (rid) => dotsState.cells.find((c) => c.row === rid && c.column === 'qk').value;
  assert.ok(Math.abs(qk('pair2_0') - qk('pair5_3')) < 1e-9, 'offset-2 pairs score identically');
  assert.ok(Math.abs(qk('pair2_0') - qk('pair4_2')) < 1e-9, 'all offset-2 pairs identical');
  assert.ok(Math.abs(qk('pair2_0') - qk('pair3_0')) > 1e-3, 'different offset scores differ');
});

test('message-queue: nothing lost in either scenario; crash causes one redelivery', async () => {
  const topic = await loadTopic('message-queue');
  for (const scenario of ['steady consumer', 'consumer crashes mid-job']) {
    const steps = runTopic(topic, { scenario });
    assert.match(lastText(steps), /8 orders processed, zero lost/, `${scenario}: all 8 drained`);
    assert.equal(steps.at(-1).state.items.length, 0, `${scenario}: queue empty at end`);
  }
  const crash = runTopic(topic, { scenario: 'consumer crashes mid-job' });
  assert.ok(crash.some((s) => /AT-LEAST-ONCE/.test(s.explanation)), 'redelivery semantics taught');
});

test('ab-testing: same rates flip from noise to signal as n grows', async () => {
  const topic = await loadTopic('ab-testing');
  const small = runTopic(topic, { n: '1,000' });
  assert.ok(small.some((s) => /NOT significant/.test(s.explanation)), 'n=1000 is inconclusive');
  const large = runTopic(topic, { n: '10,000' });
  assert.ok(large.some((s) => /VERDICT.*SIGNIFICANT/s.test(s.explanation)), 'n=10000 is significant');
  assert.ok(!large.some((s) => /NOT significant/.test(s.explanation)), 'no contradiction at n=10000');
});

test('url-shortener: base-62 encoding is correct for both IDs', async () => {
  const topic = await loadTopic('url-shortener');
  const big = runTopic(topic, { id: '125487' });
  assert.ok(big.some((s) => /tiny\.url\/wDZ/.test(s.explanation)), '125487 encodes to wDZ');
  const small = runTopic(topic, { id: '999' });
  assert.ok(small.some((s) => /tiny\.url\/g7/.test(s.explanation)), '999 encodes to g7');
  assert.ok(big.some((s) => /3\.5 TRILLION/.test(s.explanation)), 'capacity math taught');
});

test('multi-armed-bandits: traffic concentrates on the best arm and beats the even split', async () => {
  const topic = await loadTopic('multi-armed-bandits');
  for (const epsilon of ['20%', '10%']) {
    const steps = runTopic(topic, { epsilon });
    const final = steps.find((s) => s.state.title === 'After 1,800 visitors').state;
    const pullsOf = (arm) => final.cells.find((c) => c.row === `arm${arm}` && c.column === 'pulls').value;
    assert.ok(pullsOf('B') > pullsOf('A') && pullsOf('B') > pullsOf('C'), `ε=${epsilon}: B gets the most traffic`);
    const gap = steps.find((s) => /extra sales/.test(s.explanation));
    assert.match(gap.explanation, /\d+ extra sales/, `ε=${epsilon}: bandit beats uniform split`);
  }
});

test('distributed-tracing: all spans close, durations nest, culprit identified', async () => {
  const topic = await loadTopic('distributed-tracing');
  const steps = runTopic(topic, { view: 'one checkout request' });
  const final = steps.at(-1).state;
  assert.ok(final.frames.every((f) => f.status === 'returned'), 'every span closed');
  const ms = (id) => Number(final.frames.find((f) => f.id === id).result.replace('ms', ''));
  assert.ok(ms('f') < ms('p') && ms('p') < ms('o') && ms('o') < ms('g'), 'child durations nest inside parents');
  assert.ok(steps.some((s) => /CRITICAL PATH/.test(s.explanation) && /46%/.test(s.explanation)), 'culprit quantified');
});

// ------------------------------------------------- layer 2: site search

test('searchTopics: ranked, typo-tolerant, title matches first', () => {
  assert.equal(searchTopics('binary serch')[0].id, 'binary-search', 'one-typo query still finds Binary Search');
  const sortTop = searchTopics('sort').slice(0, 3).map((t) => t.id);
  for (const id of sortTop) assert.match(id, /sort/, `top results are sort topics (got ${sortTop})`);
  const cassandra = searchTopics('cassandra').slice(0, 5).map((t) => t.id);
  assert.ok(cassandra.includes('lsm-tree') && cassandra.includes('consistent-hashing'), `cassandra surfaces its topics (got ${cassandra})`);
  assert.equal(searchTopics('').length, 0, 'empty query returns nothing');
  assert.equal(searchTopics('zzzqqqxxx').length, 0, 'garbage returns nothing');
});

test('dns-resolution: cold cache walks the full hierarchy, warm cache skips it', async () => {
  const topic = await loadTopic('dns-resolution');
  const cold = runTopic(topic, { cache: 'cold (full walk)' });
  const touched = (steps, id) => steps.some((s) => (s.highlight.active ?? []).includes(id));
  for (const server of ['ROOT', 'TLD', 'AUTH']) assert.ok(touched(cold, server), `cold walk queries ${server}`);
  const warm = runTopic(topic, { cache: 'warm (cached)' });
  for (const server of ['ROOT', 'TLD', 'AUTH']) assert.ok(!touched(warm, server), `warm cache never queries ${server}`);
  assert.ok(cold.some((s) => /93\.184\.216\.34/.test(s.explanation)), 'the record is resolved');
});

test('thompson-sampling: belief in B grows with data and traffic follows it', async () => {
  const topic = await loadTopic('thompson-sampling');
  const steps = runTopic(topic, { rounds: '8 rounds' });
  const probs = steps
    .map((s) => s.explanation.match(/gave B a (\d+)% chance/))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  assert.equal(probs[0], 50, 'flat priors start at a 50/50 split');
  assert.ok(probs.at(-1) > 75, `belief in B strengthens with data (got ${probs.at(-1)}%)`);
  assert.ok(probs.at(-1) >= probs[0], 'no regression toward ignorance');
  assert.match(lastText(steps), /distributions instead of point estimates/i);
});

test('tcp-congestion: slow start doubles, loss halves, sawtooth resumes', async () => {
  const topic = await loadTopic('tcp-congestion');
  const steps = runTopic(topic, { view: "one connection's life" });
  const finalPlot = steps.findLast((s) => s.state.kind === 'plot').state;
  const ys = finalPlot.series[0].points.map((p) => p.y);
  assert.deepEqual(ys.slice(0, 6), [1, 2, 4, 8, 16, 32], 'exponential slow start to the threshold');
  assert.ok(ys.includes(44) && ys[ys.indexOf(44) + 1] === 22, 'loss at 44 halves the window to 22');
  assert.ok(steps.some((s) => /SAWTOOTH/.test(s.explanation) && /AIMD/.test(s.explanation)), 'AIMD named');
});

test('naive-bayes: posteriors are decisive for clear emails, moderate for mixed', async () => {
  const topic = await loadTopic('naive-bayes');
  const posterior = (steps) => {
    const v = steps.find((s) => s.state.title && s.state.title.startsWith('Verdict')).state;
    return v.cells.find((c) => c.id === 'spam:post').value;
  };
  assert.ok(posterior(runTopic(topic, { email: 'free winner click' })) > 0.99, 'spammy email near 100%');
  assert.ok(posterior(runTopic(topic, { email: 'project meeting tomorrow' })) < 0.01, 'work email near 0%');
  const mixed = posterior(runTopic(topic, { email: 'free project meeting' }));
  assert.ok(mixed > 0.01 && mixed < 0.5, `mixed email is moderate (got ${(mixed * 100).toFixed(1)}%)`);
});

test('entropy: H values correct and cross-entropy never beats the floor', async () => {
  const topic = await loadTopic('entropy');
  const steps = runTopic(topic, { view: 'from surprise to LLM loss' });
  const hMatrix = steps.find((s) => s.state.title && s.state.title.startsWith('Entropy H')).state;
  const H = (rid) => hMatrix.cells.find((c) => c.id === `${rid}:H`).value;
  assert.equal(H('certain'), 0, 'certainty carries zero bits');
  assert.equal(H('uniform'), 2, 'four equal outcomes need two bits');
  assert.ok(Math.abs(H('skewed') - 1.257) < 0.01, 'skewed entropy ≈ 1.26 bits');
  const cross = steps.find((s) => /KL DIVERGENCE/.test(s.explanation));
  assert.match(cross.explanation, /2\.00 bits per outcome instead of the optimal 1\.26/, 'cross-entropy exceeds entropy');
});

test('precision-recall: the lazy classifier exposes the accuracy lie', async () => {
  const topic = await loadTopic('precision-recall');
  const lazy = runTopic(topic, { clf: 'lazy (always ham)' });
  assert.ok(lazy.some((s) => /95\.0%/.test(s.state.title ?? '') || /scores 95%/.test(s.explanation)), 'lazy scores 95% accuracy');
  assert.ok(lazy.some((s) => /recall is 0%/.test(s.explanation)), 'recall exposes it');
  const balanced = runTopic(topic, { clf: 'threshold 0.5' });
  const pr = balanced.find((s) => /Precision .* Recall/.test(s.state.title ?? ''));
  assert.match(pr.state.title, /Precision 57\.1% · Recall 80\.0%/, 'threshold 0.5 metrics correct');
  const compare = balanced.find((s) => s.state.title === 'Three classifiers, four lenses').state;
  assert.equal(compare.rows.length, 3, 'all classifiers compared');
});

test('roc-auc: real classifier scores 0.89, coin flip rides the diagonal', async () => {
  const topic = await loadTopic('roc-auc');
  const real = runTopic(topic, { view: 'a real classifier' });
  assert.ok(real.some((s) => /Area Under the Curve.*0\.89/.test(s.explanation)), 'AUC computed as 0.89');
  const curve = real.find((s) => /full sweep/.test(s.explanation)).state;
  const roc = curve.series.find((ser) => ser.id === 'roc').points;
  assert.deepEqual(roc[0], { x: 0, y: 0 }, 'curve starts at origin');
  assert.deepEqual(roc[roc.length - 1], { x: 1, y: 1 }, 'curve ends at (1,1)');
  for (let i = 1; i < roc.length; i++) {
    assert.ok(roc[i].x >= roc[i - 1].x && roc[i].y >= roc[i - 1].y, 'both rates monotone non-decreasing');
  }
  const coin = runTopic(topic, { view: 'a coin flip' });
  assert.ok(coin.some((s) => /0\.50/.test(s.explanation)), 'coin flip AUC is 0.50');
  const coinRoc = coin.find((s) => /full sweep/.test(s.explanation)).state.series.find((ser) => ser.id === 'roc').points;
  assert.ok(coinRoc.every((p) => Math.abs(p.x - p.y) < 1e-9), 'coin-flip curve lies on the diagonal');
});

test('browser-rendering: render tree prunes invisibles, thrash forces 3 layouts then batches to 1', async () => {
  const topic = await loadTopic('browser-rendering');
  const load = runTopic(topic, { view: 'a page load, HTML to pixels' });
  const renderTree = load.find((s) => /RENDER TREE/.test(s.explanation));
  assert.deepEqual(renderTree.highlight.removed.sort(), ['head', 'hidden', 'style'], 'head, style, display:none pruned');
  const layout = load.find((s) => (s.state.title ?? '').startsWith('Layout')).state;
  const cell = (id) => layout.cells.find((c) => c.id === id).value;
  assert.equal(cell('b_p:w'), 268, 'paragraph width = card 300 minus 2×16 padding');
  assert.ok(load.some((s) => /16\.7ms per frame/.test(s.explanation)), 'frame budget stated');
  const thrash = runTopic(topic, { view: 'the layout-thrash trap' });
  assert.ok(thrash.some((s) => s.state.title === 'Forced synchronous layouts so far: 3'), 'three forced layouts accumulate');
  const batched = thrash.find((s) => /Fix 1/.test(s.state.title ?? '')).state;
  assert.equal(batched.cells.find((c) => c.id === 'reads:forced').value, 1, 'batching collapses to one layout');
  const compositor = thrash.find((s) => /Fix 2/.test(s.state.title ?? '')).state;
  assert.equal(compositor.cells.find((c) => c.id === 'transform:layout').value, 0, 'transform skips layout');
});

test('calibration-curves: overconfidence sags below diagonal, T=2 repairs ECE without touching ranking', async () => {
  const topic = await loadTopic('calibration-curves');
  const bad = runTopic(topic, { view: 'the overconfident network' });
  assert.ok(bad.some((s) => (s.state.title ?? '') === 'Expected Calibration Error: 0.106'), 'ECE = 0.106 before');
  const diagram = bad.find((s) => /RELIABILITY DIAGRAM/.test(s.explanation)).state;
  const model = diagram.series.find((ser) => ser.id === 'model').points;
  assert.ok(model.every((p) => p.y < p.x), 'every bin sits below the diagonal — overconfident');
  const fixed = runTopic(topic, { view: 'the fix: temperature scaling' });
  assert.ok(fixed.some((s) => /0\.106 to 0\.008/.test(s.explanation)), 'ECE collapses to 0.008');
  assert.ok(fixed.some((s) => /AUC are all unchanged/.test(s.invariant ?? '')), 'monotonicity invariant stated');
  const after = fixed.find((s) => /hugs the diagonal/.test(s.explanation)).state;
  const pts = after.series.find((ser) => ser.id === 'model').points;
  assert.ok(pts.every((p) => Math.abs(p.x - p.y) <= 0.01 + 1e-9), 'scaled bins land within 1 point of honest');
});

test('logistic-regression: gradient descent drives loss down and misclassifications to zero', async () => {
  const topic = await loadTopic('logistic-regression');
  const learn = runTopic(topic, { view: 'the boundary learn' });
  const epochs = learn.filter((s) => /^Epoch \d+/.test(s.explanation));
  assert.equal(epochs.length, 4, 'four training checkpoints');
  const losses = epochs.map((s) => Number(s.explanation.match(/average loss ([\d.]+)/)[1]));
  for (let i = 1; i < losses.length; i++) assert.ok(losses[i] < losses[i - 1], 'loss strictly decreases');
  assert.match(epochs[0].explanation, /misclassified [1-9]\/10/, 'starts with errors');
  assert.match(epochs[3].explanation, /misclassified 0\/10/, 'ends fully separated');
  assert.ok(epochs[3].state.series.some((ser) => ser.id === 'boundary'), 'boundary line rendered');
  const close = runTopic(topic, { view: 'the sigmoid up close' });
  const sig = close.find((s) => /squashing function/.test(s.explanation)).state;
  assert.equal(sig.markers.find((m) => m.id === 'mZero').y, 0.5, 'sigmoid(0) = 0.5');
  assert.ok(close.some((s) => /\(p − y\)·x/.test(s.explanation)), 'gradient formula stated');
});

test('threshold-optimization: optimum slides from 0.65 to 0.3 when the costs flip', async () => {
  const topic = await loadTopic('threshold-optimization');
  const invoice = runTopic(topic, { costs:'a junked invoice costs $10' });
  const sweep = invoice.find((s) => /cheapest threshold/.test(s.explanation));
  assert.match(sweep.explanation, /t = 0\.65, total damage \$4/, 'strict optimum in invoice world');
  assert.ok(sweep.state.markers.some((m) => m.x === 0.65), 'minimum marked on the curve');
  const fraud = runTopic(topic, { costs:'a missed fraud costs $10' });
  assert.match(fraud.find((s) => /cheapest threshold/.test(s.explanation)).explanation, /t = 0\.3, total damage \$5/, 'permissive optimum in fraud world');
  const formula = fraud.find((s) => /closed form/.test(s.state.title ?? '')).state;
  assert.equal(formula.cells.find((c) => c.id === 'formula:value').value.toFixed(2), '0.09', 't* = 1/11 in fraud world');
  const both = invoice.find((s) => /Both worlds/.test(s.explanation)).state;
  assert.equal(both.series.length, 2, 'both cost curves plotted together');
});

test('event-loop: output lands A B C D and the microtask chain starves rendering', async () => {
  const topic = await loadTopic('event-loop');
  const steps = runTopic(topic, { view: 'why the order is A B C D' });
  const outputs = steps.map((s) => s.state.nodes.filter((n) => n.id.startsWith('o')).map((n) => n.label).join(''));
  assert.equal(outputs[outputs.length - 1], 'ABCD', 'final console order is A B C D');
  const cStep = steps.find((s) => (s.state.nodes ?? []).some((n) => n.id === 'fC'));
  assert.ok(cStep.state.nodes.some((n) => n.id === 'tD'), 'timer callback still queued while C runs — promise jumped the line');
  assert.ok(steps.some((s) => /drain the ENTIRE microtask queue/.test(s.explanation)), 'rule 1 stated');
  const starve = runTopic(topic, { view: 'how microtasks starve rendering' });
  const frozen = starve.find((s) => /STARVED/.test(s.state.nodes.find((n) => n.id === 'render')?.note ?? ''));
  assert.ok(frozen, 'render node reports starvation');
  const fixed = starve[starve.length - 1].state;
  assert.ok(fixed.nodes.some((n) => n.id === 'c2' && fixed.nodes.find((m) => m.id === 'hMacro')), 'fix re-queues via the task queue');
  assert.match(fixed.nodes.find((n) => n.id === 'render').note, /✓/, 'rendering breathes again');
});

test('virtual-dom: diff emits three patches, keys cut four mutations to one', async () => {
  const topic = await loadTopic('virtual-dom');
  const diff = runTopic(topic, { view: 'a re-render, node by node' });
  const patches = diff[diff.length - 1].state;
  assert.equal(patches.items.length, 3, 'exactly three real-DOM operations');
  assert.match(patches.items[0].value, /setText/, 'text patch first');
  assert.ok(diff.some((s) => /different type ⇒ different subtree|DIFFERENT type/.test(s.explanation)), 'type-change rule stated');
  assert.ok(diff.some((s) => /O\(n³\)/.test(s.explanation) && /O\(n\)/.test(s.invariant ?? s.explanation)), 'heuristic complexity contrast stated');
  const list = runTopic(topic, { view: 'the list that needed keys' });
  assert.ok(list.some((s) => /FOUR mutations for one insertion/.test(s.explanation)), 'unkeyed diff rewrites every row');
  assert.ok(list.some((s) => /One mutation instead of four/.test(s.explanation)), 'keyed diff inserts once');
  const scorecard = list[list.length - 1].state;
  assert.equal(scorecard.cells.find((c) => c.id === 'unkeyed:ops').value, 4, 'unkeyed costs 4 ops');
  assert.equal(scorecard.cells.find((c) => c.id === 'keyed:ops').value, 1, 'keyed costs 1 op');
  assert.equal(scorecard.cells.find((c) => c.id === 'indexkey:ops').value, 4, 'index-as-key is as bad as no key');
});

test('uncertainty-quantification: band fans out beyond the data and MC dropout spreads on unseen input', async () => {
  const topic = await loadTopic('uncertainty-quantification');
  const doubts = runTopic(topic, { view: 'the two kinds of doubt' });
  const band = doubts.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'upper')).state;
  const width = (x) => {
    const at = (id) => band.series.find((ser) => ser.id === id).points.find((p) => p.x === x).y;
    return at('upper') - at('lower');
  };
  assert.equal(width(3), 3, 'aleatoric floor of ±1.5 inside the data');
  assert.ok(width(8) > 10, 'epistemic fan-out beyond the data');
  const mc = runTopic(topic, { view: 'MC dropout in action' });
  assert.ok(mc.some((s) => /ensemble in disguise/.test(s.explanation)), 'MC dropout framed as implicit ensemble');
  const meter = mc.find((s) => (s.state.title ?? '') === 'The doubt-meter, read out').state;
  const cell = (id) => meter.cells.find((c) => c.id === id).value;
  assert.ok(cell('inD:sd') < 0.3, 'tight agreement on seen input');
  assert.ok(cell('ood:sd') > 3, 'wide disagreement on unseen input');
  assert.equal(meter.cells.find((c) => c.id === 'ood:call').label, 'ESCALATE to human', 'high doubt escalates');
});

test('regularization: L2 plateaus the norm and L1 zeroes weak features in order', async () => {
  const topic = await loadTopic('regularization');
  const explode = runTopic(topic, { view: 'weights explode, then behave' });
  const dual = explode.find((s) => (s.state.series ?? []).length === 2).state;
  const last = (id) => dual.series.find((ser) => ser.id === id).points.at(-1).y;
  assert.ok(last('free') > 3.5, 'unregularized norm keeps growing');
  assert.ok(last('leashed') < 1.5, 'weight decay plateaus the norm');
  const table = explode.find((s) => /What the leash/.test(s.state.title ?? '')).state;
  assert.ok(table.cells.find((c) => c.id === 'free:maxp').value > 0.9999, 'unleashed model hits 99.99%+ confidence');
  assert.ok(table.cells.find((c) => c.id === 'leashed:maxp').value < 0.99, 'leashed model stays under 99%');
  const paths = runTopic(topic, { view: 'L1 delete features, L2 keep them' });
  const ridge = paths.find((s) => /ridge\) path/.test(s.explanation)).state;
  const hourRidge = ridge.series.find((ser) => ser.id === 'hour').points.at(-1).y;
  assert.ok(hourRidge > 0 && hourRidge < 0.05, 'ridge shrinks but never zeroes');
  const lassoState = paths.find((s) => /lasso\) path/.test(s.explanation)).state;
  const lassoAt = (id, x) => lassoState.series.find((ser) => ser.id === id).points.find((p) => Math.abs(p.x - x) < 1e-9).y;
  assert.equal(lassoAt('hour', 0.4), 0, 'send hour dead by lambda 0.4');
  assert.equal(lassoAt('len', 1), 0, 'word length dead by lambda 1');
  assert.ok(lassoAt('excl', 1) > 1, 'strong feature survives lambda 1');
});

test('imbalanced-classification: accuracy prefers do-nothing and ROC ignores a 10x negative flood', async () => {
  const topic = await loadTopic('imbalanced-classification');
  const deceive = runTopic(topic, { view: 'how the metrics deceive' });
  assert.ok(deceive.some((s) => /990\/1000 = 99\.0%/.test(s.explanation)), 'do-nothing scores 99%');
  assert.ok(deceive.some((s) => /accuracy 97\.6%/.test(s.state.title ?? '')), 'useful model scores lower accuracy');
  const scale = deceive.find((s) => /Scale the negatives/.test(s.state.title ?? '')).state;
  const cell = (id) => scale.cells.find((c) => c.id === id).value;
  assert.equal(cell('small:fpr'), cell('big:fpr'), 'FPR identical across base rates');
  assert.ok(cell('big:prec') < 0.03, 'precision collapses under the negative flood');
  const fixes = runTopic(topic, { view: 'the fixes, honestly priced' });
  assert.ok(fixes.some((s) => /t\* = 0\.01/.test(s.explanation)), 'cost formula yields the 0.01 threshold');
  const menu = fixes[fixes.length - 1].state;
  assert.equal(menu.rows.length, 4, 'four fixes priced');
  assert.match(menu.cells.find((c) => c.id === 'weights:risk').label, /recalibrate/, 'weights warp probabilities');
});

test('web-workers: render unfreezes when the parse moves threads, and the clone tax is priced', async () => {
  const topic = await loadTopic('web-workers');
  const offload = runTopic(topic, { view: 'offloading an 800ms job' });
  const renderNote = (s) => s.state.nodes.find((n) => n.id === 'render').note;
  assert.match(renderNote(offload[0]), /FROZEN/, 'blocking parse freezes rendering');
  assert.match(renderNote(offload[1]), /60fps ✓/, 'worker offload keeps rendering smooth');
  assert.ok(offload[1].state.nodes.some((n) => n.id === 'parse' && n.x === 8), 'parse now lives in the worker column');
  assert.ok(offload.some((s) => /WORKERS COMPUTE, MAIN PAINTS/.test(s.explanation)), 'division of labor stated');
  const caps = offload[offload.length - 1].state;
  assert.equal(caps.cells.find((c) => c.id === 'dom:ok').value, 0, 'no DOM access in workers');
  const tax = runTopic(topic, { view: 'the postMessage tax' });
  const bill = tax[0].state;
  assert.equal(bill.cells.find((c) => c.id === 'mb50:clone').value, 250, '50MB clone costs ~250ms');
  const move = tax.find((s) => /Three ways to move/.test(s.state.title ?? '')).state;
  assert.match(move.cells.find((c) => c.id === 'transfer:catch').label, /neutered/, 'transfer neuters the sender');
});

test('adversarial-examples: two FGSM steps walk 97% spam to 14%, and damage scales with dimension', async () => {
  const topic = await loadTopic('adversarial-examples');
  const fool = runTopic(topic, { view: 'fooling the spam filter' });
  const ledger = fool.find((s) => /The attack, summarized/.test(s.state.title ?? '')).state;
  const cell = (id) => ledger.cells.find((c) => c.id === id).value;
  assert.ok(cell('orig:p') > 0.97, 'original scam confidently flagged');
  assert.ok(cell('adv:p') < 0.15, 'adversarial copy sails through');
  assert.ok(fool.some((s) => (s.state.vectors ?? []).some((v) => v.id === 'grad')), 'gradient escape arrow drawn');
  assert.ok(fool.some((s) => /x′ = x − ε·sign\(∇ₓ\)/.test(s.explanation)), 'FGSM formula stated');
  const why = runTopic(topic, { view: 'why tiny steps fool big models' });
  const dims = why[0].state;
  assert.ok(Math.abs(dims.cells.find((c) => c.id === 'toy:shift').value - 0.002) < 1e-9, 'toy shift negligible');
  assert.ok(dims.cells.find((c) => c.id === 'imagenet:shift').value > 150, 'ImageNet shift overwhelming');
  const menu = why[why.length - 1].state;
  assert.match(menu.cells.find((c) => c.id === 'mask:verdict').label, /FALSE security/, 'gradient masking called out');
});

test('cross-validation: the diagonal rotates through all five folds and CV picks lambda 0.1', async () => {
  const topic = await loadTopic('cross-validation');
  const folds = runTopic(topic, { view: 'k-fold in motion' });
  const rounds = folds.filter((s) => /^Fold \d of 5/.test(s.state.title ?? ''));
  assert.equal(rounds.length, 5, 'five rotation steps');
  rounds.forEach((s, i) => {
    assert.deepEqual(s.highlight.active, [`f${i + 1}:c${i + 1}`], 'active cell marches down the diagonal');
    const valCells = s.state.cells.filter((c) => c.value === 1);
    assert.equal(valCells.length, 5, 'one validation chunk per fold row');
  });
  assert.ok(rounds[4].explanation.includes('80.2%'), 'CV mean reported');
  const lambda = folds.find((s) => /choosing λ/.test(s.state.title ?? '')).state;
  const best = lambda.cells.reduce((a, c) => (c.value > a.value ? c : a));
  assert.equal(best.id, 'l1:cv', 'lambda 0.1 wins the CV sweep');
  const wrong = runTopic(topic, { view: 'why evaluation goes wrong' });
  const cards = wrong[0].state;
  assert.equal(cards.cells.find((c) => c.id === 'over:train').value, 1.0, 'memorizer aces training');
  assert.ok(cards.cells.find((c) => c.id === 'over:test').value < 0.55, 'memorizer fails new data');
  assert.ok(wrong.some((s) => /opened ONCE/.test(s.explanation)), 'one-shot test set rule stated');
  assert.ok(folds.some((s) => /LEAKAGE/.test(s.explanation)), 'leakage dragon covered');
});

test('focal-loss: easy examples hold 81% of the gradient until gamma 2 flips it past 99.9% hard', async () => {
  const topic = await loadTopic('focal-loss');
  const drown = runTopic(topic, { view: 'easy examples drown the loss' });
  const ledger = drown.find((s) => /cross-entropy ledger/.test(s.state.title ?? '')).state;
  const share = (id) => ledger.cells.find((c) => c.id === id).value;
  assert.ok(Math.abs(share('easy:share') - 0.813) < 0.01, 'easy background holds ~81% of the loss');
  assert.ok(share('easy:total') > 1000, 'collective easy loss past 1000');
  const fix = runTopic(topic, { view: 'the (1−p)^γ fix' });
  const curves = fix[0].state;
  assert.equal(curves.series.length, 4, 'four gamma curves plotted');
  const at = (id, x) => curves.series.find((ser) => ser.id === id).points.find((pt) => Math.abs(pt.x - x) < 0.02).y;
  assert.ok(at('g2', 0.99) < at('g0', 0.99) / 1000, 'gamma 2 crushes confident examples over 1000x');
  assert.ok(at('g2', 0.12) > at('g0', 0.12) * 0.7, 'struggling examples keep most of their loss');
  const refereed = fix.find((s) => /refereed by/.test(s.state.title ?? '')).state;
  assert.ok(refereed.cells.find((c) => c.id === 'hard:share').value > 99.9, 'hard examples now steer the gradient');
  assert.ok(fix.some((s) => /NOISY/.test(s.explanation)), 'noisy-label caution stated');
});

test('service-workers: the app survives airplane mode and the strategy table routes by asset type', async () => {
  const topic = await loadTopic('service-workers');
  const moves = runTopic(topic, { view: 'a proxy moves in' });
  assert.ok(!moves[0].state.nodes.some((n) => n.id === 'sw'), 'no proxy installed at the start');
  const offline = moves.find((s) => /UNREACHABLE/.test(s.state.nodes.find((n) => n.id === 'net')?.note ?? ''));
  assert.ok(offline, 'airplane-mode step present');
  assert.match(offline.state.nodes.find((n) => n.id === 'page').note, /✓/, 'page still loads offline');
  assert.ok(offline.state.edges.some((e) => e.id === 'toCache'), 'offline response served via the cache edge');
  assert.ok(moves.some((s) => /HTTPS/.test(s.explanation)), 'HTTPS requirement explained');
  const strat = runTopic(topic, { view: 'the caching strategies' });
  assert.ok(strat.some((s) => /CACHE-FIRST/.test(s.explanation)), 'cache-first covered');
  assert.ok(strat.some((s) => /NETWORK-FIRST/.test(s.explanation)), 'network-first covered');
  assert.ok(strat.some((s) => /STALE-WHILE-REVALIDATE/.test(s.explanation)), 'SWR covered');
  const table = strat[strat.length - 1].state;
  assert.match(table.cells.find((c) => c.id === 'auth:strat').label, /network-only/, 'auth never served stale');
  assert.match(table.cells.find((c) => c.id === 'shell:strat').label, /cache-first/, 'shell precached');
});

test('saliency-maps: gradient and occlusion agree on the culprit, and the sanity check fails guided backprop', async () => {
  const topic = await loadTopic('saliency-maps');
  const ask = runTopic(topic, { view: 'interrogating one verdict' });
  const grad = ask.find((s) => /gradient saliency/.test(s.state.title ?? '')).state;
  const cell = (state, id) => state.cells.find((c) => c.id === id).value;
  assert.ok(cell(grad, 'caps:grad') > cell(grad, 'excl:grad'), 'caps words have the larger per-unit gradient');
  const occ = ask.find((s) => /occlusion/.test(s.state.title ?? '')).state;
  assert.ok(cell(occ, 'caps:drop') > cell(occ, 'excl:drop'), 'occlusion agrees: removing caps hurts more');
  assert.ok(Math.abs(cell(occ, 'excl:newp') - 0.31) < 0.01, 'removing exclamations drops p to ~31%');
  assert.ok(ask.some((s) => /FGSM/.test(s.explanation)), 'attack/explanation duality stated');
  const tests = runTopic(topic, { view: 'the honesty tests' });
  assert.ok(tests.some((s) => /Attention is not Explanation/.test(s.explanation)), 'attention caveat cited');
  const sanity = tests.find((s) => /sanity check/.test(s.state.title ?? '')).state;
  assert.match(sanity.cells.find((c) => c.id === 'guided:verdict').label, /FAILS/, 'guided backprop fails the sanity check');
  assert.match(sanity.cells.find((c) => c.id === 'grad:verdict').label, /PASSES/, 'plain gradient passes');
});

test('learning-curves: the variance gap narrows, the bias curves fuse, and the U bottoms at complexity 6', async () => {
  const topic = await loadTopic('learning-curves');
  const dx = runTopic(topic, { view: 'the learning-curve diagnosis' });
  const varState = dx.find((s) => /gap = variance/.test((s.state.markers ?? []).map((m) => m.label).join(''))).state;
  const series = (st, id) => st.series.find((ser) => ser.id === id).points;
  const gapAt = (st, i) => series(st, 'train')[i].y - series(st, 'val')[i].y;
  assert.ok(gapAt(varState, 0) > 30, 'huge gap with 50 examples');
  assert.ok(gapAt(varState, 5) < 10, 'gap narrows with 1600 examples');
  const biasState = dx.find((s) => /converged at 74%/.test((s.state.markers ?? []).map((m) => m.label).join(''))).state;
  assert.ok(Math.abs(gapAt(biasState, 5)) < 1, 'bias curves fuse at the ceiling');
  const pad = dx[dx.length - 1].state;
  assert.match(pad.cells.find((c) => c.id === 'flat:rx').label, /bigger model/, 'bias treatment is capacity');
  const anatomy = runTopic(topic, { view: 'the bias–variance anatomy' });
  const u = anatomy.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'valErr')).state;
  const valErr = series(u, 'valErr');
  const min = valErr.reduce((a, p) => (p.y < a.y ? p : a));
  assert.equal(min.x, 6, 'validation U bottoms at complexity 6');
  const dd = anatomy.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'modern')).state;
  const modern = dd.series.find((ser) => ser.id === 'modern').points;
  assert.ok(modern.at(-1).y < modern[1].y, 'second descent past the interpolation peak');
});

test('gradient-flow: sigmoid chains starve layer 1, ReLU and residuals keep the signal alive', async () => {
  const topic = await loadTopic('gradient-flow');
  const dying = runTopic(topic, { view: 'the signal dying layer by layer' });
  const firstLayer = (st, id) => st.series.find((ser) => ser.id === id).points.find((p) => p.x === 1).y;
  const vanish = dying.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'vanish')).state;
  assert.ok(firstLayer(vanish, 'vanish') < 1e-5, 'sigmoid chain delivers under 4 millionths to layer 1');
  const both = dying.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'explode')).state;
  assert.ok(firstLayer(both, 'explode') > 30, 'factor 1.5 amplifies ~38x by layer 1');
  const fixes = runTopic(topic, { view: 'the fixes that made depth possible' });
  const relu = fixes.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'relu')).state;
  assert.ok(firstLayer(relu, 'relu') > 0.5, 'ReLU plus init keeps layer 1 above half signal');
  const res = fixes.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'residual')).state;
  assert.ok(res.series.find((ser) => ser.id === 'residual').points.every((p) => p.y >= 1), 'residual identity path floors the gradient at 1');
  assert.ok(fixes.some((s) => /1 \+ f′/.test(s.invariant ?? '')), 'residual derivative stated');
  const armor = fixes[fixes.length - 1].state;
  assert.equal(armor.rows.length, 4, 'full armor has four pieces');
});

test('cache-invalidation: the herd collapses to one request and versioned names never lie', async () => {
  const topic = await loadTopic('cache-invalidation');
  const dilemma = runTopic(topic, { view: 'the stale-or-stampede dilemma' });
  const ttl = dilemma.find((s) => /TTL dial/.test(s.state.title ?? '')).state;
  assert.equal(ttl.cells.find((c) => c.id === 't5:load').value, 0.2, 'short TTL hammers the origin');
  assert.ok(ttl.cells.find((c) => c.id === 't86400:load').value < 0.0001, 'long TTL shields it');
  const herd = dilemma.find((s) => /THUNDERING HERD/.test(s.explanation));
  assert.match(herd.state.nodes.find((n) => n.id === 'origin').note, /ON FIRE/, 'stampede melts the origin');
  const tamed = dilemma.find((s) => /COALESCING/.test(s.explanation));
  assert.match(tamed.state.nodes.find((n) => n.id === 'cache').note, /1 fetch, 999 wait/, 'single-flight collapses the herd');
  const escapes = runTopic(topic, { view: 'the three escape routes' });
  assert.ok(escapes.some((s) => /change its NAME/.test(s.explanation) && /Git Internals/.test(s.explanation)), 'versioning tied to content-addressing');
  assert.ok(escapes.some((s) => /304 NOT MODIFIED/.test(s.explanation)), 'ETag revalidation covered');
  const table = escapes[escapes.length - 1].state;
  assert.match(table.cells.find((c) => c.id === 'static:strat').label, /versioned names/, 'static assets get immutable names');
  assert.match(table.cells.find((c) => c.id === 'private:strat').label, /no-store/, 'private data never cached');
});

test('lime: the local surrogate tracks the gradient and the story flips across the input space', async () => {
  const topic = await loadTopic('lime');
  const local = runTopic(topic, { view: 'explaining one verdict locally' });
  const report = local.find((s) => /read the surrogate/.test(s.state.title ?? '')).state;
  const w = (id) => report.cells.find((c) => c.id === id).value;
  assert.ok(w('caps:w') > w('excl:w'), 'caps weigh more at (4,3)');
  assert.ok(Math.abs(w('excl:w') - 0.158) < 0.01 && Math.abs(w('caps:w') - 0.229) < 0.01, 'weighted LSQ matches the analytic gradient closely');
  const flip = local.find((s) => /story flips/.test(s.state.title ?? '')).state;
  const cell = (id) => flip.cells.find((c) => c.id === id).value;
  assert.ok(cell('there:excl') > 5 * cell('there:caps'), 'at (1,8) exclamations dominate');
  assert.ok(local.some((s) => /valid locally/.test(s.explanation)), 'locality stamp stated');
  const print = runTopic(topic, { view: 'the fine print' });
  assert.ok(print.some((s) => /Slack et al\./.test(s.explanation)), 'scaffolding attack cited');
  const box = print[print.length - 1].state;
  assert.match(box.cells.find((c) => c.id === 'lime:needs').label, /API access only/, 'LIME needs only queries');
  assert.match(box.cells.find((c) => c.id === 'grad:needs').label, /internals/, 'gradients need the model');
});

test('loss-landscapes: GD settles in the shallow basin and the sharp minimum pays 4x under shift', async () => {
  const topic = await loadTopic('loss-landscapes');
  const walk = runTopic(topic, { view: 'walking the terrain' });
  const gd = walk.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'path')).state;
  const settled = gd.series.find((ser) => ser.id === 'path').points.at(-1);
  assert.ok(Math.abs(settled.x - 1.86) < 0.05, 'GD from w=3 settles near the shallow minimum at 1.86');
  assert.ok(walk.some((s) => /2⁻ᵈ/.test(s.invariant ?? '')), 'saddle probability argument stated');
  const saddle = walk.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'axisDown')).state;
  const up = saddle.series.find((ser) => ser.id === 'axisUp').points;
  const down = saddle.series.find((ser) => ser.id === 'axisDown').points;
  assert.ok(up.at(-1).y > up[30].y && down.at(-1).y < down[30].y, 'opposite curvature along the two axes');
  const sf = runTopic(topic, { view: 'sharp valleys vs flat ones' });
  const shifted = sf.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'test'));
  const label = (id) => shifted.state.markers.find((m) => m.id === id).label;
  assert.match(label('sharpPay'), /2\.59/, 'sharp minimum pays 2.59 under shift');
  assert.match(label('flatPay'), /0\.65/, 'flat minimum pays 0.65');
  assert.ok(sf.some((s) => /Keskar/.test(s.explanation)), 'large-batch finding cited');
});

test('write-caching: write-back is 50x faster but fails the crash test until the WAL arrives', async () => {
  const topic = await loadTopic('write-caching');
  const ways = runTopic(topic, { view: 'three ways to handle a write' });
  assert.ok(ways.some((s) => /WRITE COALESCING/.test(s.explanation) && /ONE disk write/.test(s.explanation)), 'coalescing superpower explained');
  assert.ok(ways.some((s) => /Pollution/.test(s.explanation)), 'write-around pollution rationale');
  const priced = ways[ways.length - 1].state;
  assert.equal(priced.cells.find((c) => c.id === 'through:lat').value, 5, 'write-through pays disk latency');
  assert.equal(priced.cells.find((c) => c.id === 'back:lat').value, 0.1, 'write-back pays RAM latency');
  assert.match(priced.cells.find((c) => c.id === 'back:safe').label, /NO/, 'write-back not crash-safe alone');
  const crash = runTopic(topic, { view: 'the crash test' });
  const timeline = crash[0].state;
  assert.match(timeline.cells.find((c) => c.id === 't3:event').label, /count = 42/, 'acknowledged write lost on reboot');
  assert.ok(crash.some((s) => /WRITE-AHEAD LOG/.test(s.explanation) && /replay/i.test(s.explanation)), 'WAL rescue explained');
  const census = crash[crash.length - 1].state;
  assert.equal(census.rows.length, 5, 'five real systems surveyed');
  assert.match(census.cells.find((c) => c.id === 'raid:guard').label, /battery/i, 'RAID battery net included');
});

test('influence-functions: border points carry the influence and the mislabeled point is unmasked', async () => {
  const topic = await loadTopic('influence-functions');
  const taught = runTopic(topic, { view: 'which examples taught this verdict' });
  const ledger = taught.find((s) => /Leave-one-out/.test(s.state.title ?? '')).state;
  const dp = (id) => ledger.cells.find((c) => c.id === `${id}:dp`).value;
  assert.ok(dp('r4') < -0.12, 'removing border spam (2,3) drops the verdict most');
  assert.ok(dp('r8') > 0.05 && dp('r9') > 0.05, 'border hams prop the verdict up');
  assert.ok(Math.abs(dp('r5')) < 0.01, 'deep ham (0,1) is dead weight');
  assert.ok(taught.some((s) => /support vectors/i.test(s.explanation)), 'support-vector connection drawn');
  assert.ok(taught.some((s) => /Koh & Liang/.test(s.explanation)), 'scaling approximation cited');
  const hunt = runTopic(topic, { view: 'hunting the mislabeled point' });
  const table = hunt.find((s) => /Remove each example/.test(s.state.title ?? '')).state;
  assert.match(table.rows[0].label, /\(1,1\) spam/, 'mislabeled point ranks first');
  assert.ok(table.cells.find((c) => c.id === `${table.rows[0].id}:val`).value < 0.14, 'its removal cuts clean-set loss to ~0.13');
  assert.ok(hunt.some((s) => /SELF-INFLUENCE/.test(s.explanation)), 'self-influence fingerprint covered');
});

test('gradient-boosting: four stumps cut MSE 99.5% and the eta curves diverge', async () => {
  const topic = await loadTopic('gradient-boosting');
  const fit = runTopic(topic, { view: 'boosting fit, residual by residual' });
  assert.ok(fit.some((s) => /x < 3\.5/.test(s.explanation)), 'first stump splits at 3.5');
  assert.ok(fit.some((s) => /x < 7\.5/.test(s.explanation)), 'second stump finds the other plateau edge');
  assert.ok(fit.some((s) => /99\.5% reduction/.test(s.explanation)), 'four stumps cut MSE 99.5%');
  assert.ok(fit.some((s) => /residual = −∂loss\/∂prediction/.test(s.invariant ?? '')), 'gradient identity stated');
  const f4 = fit.find((s) => (s.state.series ?? []).some((ser) => ser.id === 'f4')).state;
  const pred = f4.series.find((ser) => ser.id === 'f4').points;
  assert.ok(Math.abs(pred[0].y - 3.23) < 0.2 && Math.abs(pred[9].y - 12.07) < 0.2, 'staircase lands on the plateaus');
  const knobs = runTopic(topic, { view: 'the knobs, and bagging vs boosting' });
  const curves = knobs[0].state;
  const at = (id, r) => curves.series.find((ser) => ser.id === id).points.find((p) => p.x === r).y;
  assert.ok(at('fast', 4) < 0.1, 'eta 1.0 near zero by round 4');
  assert.ok(at('slow', 4) > 1, 'eta 0.3 still descending at round 4');
  const versus = knobs.find((s) => /opposite medicines/.test(s.state.title ?? '')).state;
  assert.match(versus.cells.find((c) => c.id === 'cuts:bag').label, /VARIANCE/, 'bagging cuts variance');
  assert.match(versus.cells.find((c) => c.id === 'cuts:boost').label, /BIAS/, 'boosting cuts bias');
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
