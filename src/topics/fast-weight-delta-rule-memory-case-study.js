// Fast weight delta-rule memory: linear attention as a writable key-value
// memory whose updates can correct old associations instead of only adding.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'fast-weight-delta-rule-memory-case-study',
  title: 'Fast Weight Delta-Rule Memory Case Study',
  category: 'AI & ML',
  summary: 'A sequence-memory case study: linear attention as fast weights, additive outer-product writes, delta-rule corrections, gates, chunkwise training, and retrieval audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fast weight writes', 'delta and gates'], defaultValue: 'fast weight writes' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function memoryGraph(title) {
  return graphState({
    nodes: [
      { id: 'key', label: 'key', x: 0.8, y: 2.3, note: 'addr' },
      { id: 'val', label: 'value', x: 0.8, y: 4.8, note: 'data' },
      { id: 'write', label: 'write', x: 2.8, y: 3.5, note: 'outer' },
      { id: 'mem', label: 'W fast', x: 4.8, y: 3.5, note: 'memory' },
      { id: 'query', label: 'query', x: 6.7, y: 2.3, note: 'read' },
      { id: 'pred', label: 'pred', x: 6.7, y: 4.8, note: 'current' },
      { id: 'err', label: 'error', x: 8.4, y: 4.8, note: 'delta' },
      { id: 'out', label: 'out', x: 8.4, y: 2.3, note: 'answer' },
    ],
    edges: [
      { id: 'e-key-write', from: 'key', to: 'write' },
      { id: 'e-val-write', from: 'val', to: 'write' },
      { id: 'e-write-mem', from: 'write', to: 'mem' },
      { id: 'e-query-mem', from: 'query', to: 'mem' },
      { id: 'e-mem-pred', from: 'mem', to: 'pred' },
      { id: 'e-pred-err', from: 'pred', to: 'err' },
      { id: 'e-err-write', from: 'err', to: 'write' },
      { id: 'e-mem-out', from: 'mem', to: 'out' },
    ],
  }, { title });
}

function gateGraph(title) {
  return graphState({
    nodes: [
      { id: 'x', label: 'x_t', x: 0.7, y: 3.5, note: 'token' },
      { id: 'erase', label: 'erase', x: 2.5, y: 2.2, note: 'gate' },
      { id: 'delta', label: 'delta', x: 2.5, y: 4.8, note: 'error' },
      { id: 'mem', label: 'memory', x: 4.7, y: 3.5, note: 'state' },
      { id: 'chunk', label: 'chunk', x: 6.7, y: 2.2, note: 'parallel' },
      { id: 'hybrid', label: 'hybrid', x: 6.7, y: 4.8, note: 'attn/SSM' },
      { id: 'eval', label: 'eval', x: 8.7, y: 3.5, note: 'recall' },
    ],
    edges: [
      { id: 'e-x-erase', from: 'x', to: 'erase' },
      { id: 'e-x-delta', from: 'x', to: 'delta' },
      { id: 'e-erase-mem', from: 'erase', to: 'mem' },
      { id: 'e-delta-mem', from: 'delta', to: 'mem' },
      { id: 'e-mem-chunk', from: 'mem', to: 'chunk' },
      { id: 'e-mem-hybrid', from: 'mem', to: 'hybrid' },
      { id: 'e-chunk-eval', from: 'chunk', to: 'eval' },
      { id: 'e-hybrid-eval', from: 'hybrid', to: 'eval' },
    ],
  }, { title });
}

function* fastWeightWrites() {
  yield {
    state: memoryGraph('Linear attention as fast weight memory'),
    highlight: { active: ['key', 'val', 'write', 'mem', 'e-key-write', 'e-val-write', 'e-write-mem'], found: ['query', 'out'] },
    explanation: 'Fast weight memory reads linear attention as a writable key-value map. Each token programs a temporary weight matrix with an outer-product write.',
    invariant: 'The memory is changed by the sequence itself.',
  };

  yield {
    state: labelMatrix(
      'Fast-weight operations',
      [
        { id: 'addr', label: 'addr' },
        { id: 'write', label: 'write' },
        { id: 'read', label: 'read' },
        { id: 'decay', label: 'decay' },
        { id: 'reset', label: 'reset' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['key', 'locate', 'clash'],
        ['k x v', 'store', 'stale'],
        ['qW', 'lookup', 'blur'],
        ['gate', 'forget', 'loss'],
        ['state', 'bound', 'cut'],
      ],
    ),
    highlight: { active: ['write:job', 'read:job', 'decay:job'], compare: ['addr:risk', 'read:risk'] },
    explanation: 'The memory has database-like operations: address, write, read, decay, and reset. The challenge is that all of them are learned and compressed.',
  };

  yield {
    state: memoryGraph('Additive writes cannot easily correct stale mappings'),
    highlight: { active: ['pred', 'err', 'write', 'e-pred-err', 'e-err-write'], compare: ['val'], found: ['mem'] },
    explanation: 'Pure additive outer-product writes can pile up conflicting associations. A delta-style update uses the current prediction error to modify the mapping more precisely.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'conflicting writes to same key', min: 0, max: 8 }, y: { label: 'retrieval quality, conceptual', min: 0, max: 1 } },
      series: [
        { id: 'add', label: 'additive', points: [{ x: 0, y: 0.95 }, { x: 2, y: 0.80 }, { x: 4, y: 0.58 }, { x: 6, y: 0.42 }, { x: 8, y: 0.32 }] },
        { id: 'delta', label: 'delta rule', points: [{ x: 0, y: 0.95 }, { x: 2, y: 0.86 }, { x: 4, y: 0.75 }, { x: 6, y: 0.64 }, { x: 8, y: 0.55 }] },
      ],
      markers: [
        { id: 'conflict', x: 4, y: 0.75, label: 'correct' },
      ],
    }),
    highlight: { active: ['delta', 'conflict'], compare: ['add'] },
    explanation: 'This is an intuition chart. The delta rule is valuable when the memory must revise an old key-value mapping instead of only accumulating another write.',
  };
}

function* deltaAndGates() {
  yield {
    state: gateGraph('Gated DeltaNet combines erase and delta updates'),
    highlight: { active: ['erase', 'delta', 'mem', 'e-erase-mem', 'e-delta-mem'], found: ['eval'] },
    explanation: 'Gated DeltaNet combines two complementary controls: a gate that can erase or retain memory, and a delta update that corrects the current key-value prediction.',
    invariant: 'Good memory needs both write precision and forgetting control.',
  };

  yield {
    state: labelMatrix(
      'Update mechanisms',
      [
        { id: 'add', label: 'add' },
        { id: 'delta', label: 'delta' },
        { id: 'gate', label: 'gate' },
        { id: 'gdn', label: 'GDN' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'best', label: 'best' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['append', 'simple', 'clash'],
        ['correct', 'updates', 'noise'],
        ['erase', 'forget', 'loss'],
        ['both', 'recall', 'hard'],
      ],
    ),
    highlight: { active: ['delta:does', 'gate:does', 'gdn:best'], compare: ['add:risk'] },
    explanation: 'The useful comparison is operational. Additive writes store evidence, delta writes correct evidence, gates remove stale evidence, and Gated DeltaNet combines both controls.',
  };

  yield {
    state: gateGraph('Chunkwise training preserves hardware efficiency'),
    highlight: { active: ['mem', 'chunk', 'e-mem-chunk'], compare: ['erase', 'delta'], found: ['eval'] },
    explanation: 'Delta-style memory is only practical if training can be scheduled efficiently. Modern versions use chunkwise parallel algorithms so the recurrence does not become a slow serial loop.',
  };

  yield {
    state: labelMatrix(
      'Mutable fact trace',
      [
        { id: 'old', label: 'old' },
        { id: 'new', label: 'new' },
        { id: 'fix', label: 'fix' },
        { id: 'test', label: 'test' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['A->1', 'write'],
        ['A->2', 'clash'],
        ['delta', 'correct'],
        ['ask A', 'pass'],
      ],
    ),
    highlight: { active: ['new:proof', 'fix:proof', 'test:proof'], removed: ['old:state'] },
    explanation: 'A long trace says an API changed from version 1 to version 2. Additive memory may blur both facts. Delta memory has an explicit correction path and the recall test checks the latest mapping.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fast weight writes') yield* fastWeightWrites();
  else if (view === 'delta and gates') yield* deltaAndGates();
  else throw new InputError('Pick a fast-weight memory view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'The animation shows a recurrent memory matrix being edited token by token. A fast weight is a temporary weight matrix produced during inference, not a learned parameter stored after training. Active nodes are the current key, value, gate, or memory update; found nodes are associations stored in memory; compare nodes show the current read before correction.',
      'The safe inference rule is error-driven writing. A plain outer-product write adds a new key-value association. A delta-rule write first reads what the memory already returns for that key, then writes the difference between the desired value and the current value.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Standard attention stores a key and value for every token, then compares each later query with all earlier keys. That gives strong recall but costs memory proportional to sequence length. A long-context model serving 128,000 tokens has to carry a large key-value cache.',
      'Fast-weight memory exists as a fixed-size alternative. Instead of storing every past token, the model updates a matrix that summarizes associations between keys and values. The challenge is editing that matrix without overwriting useful older associations.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious fast-weight write is additive. Given key k and value v, add an outer product k v^T to the memory matrix. Later, a query similar to k reads back a value similar to v.',
      'This is reasonable because it is simple and parallel-friendly. It resembles linear attention, where sequence history is compressed into sums of key-value products. The problem is that adding more associations can blur or collide with earlier ones.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is interference. If key k already maps to value old_v and the model adds another full write for new_v, the memory may return a mixture rather than the intended new value. Repeated writes to similar keys accumulate error.',
      'Fixed-size memory also has finite capacity. If the memory matrix has 64 by 64 entries, it has 4,096 scalar slots no matter whether the sequence has 1,000 tokens or 100,000 tokens. The model must decide what to preserve, correct, and forget.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Use the delta rule: write the residual error, not the full target again. The model reads current = M k, computes error = v - current, and updates M by adding a gated outer product of error and key. The write says how to change the current answer for this key.',
      'A gate controls write strength. A gate near 0 preserves old memory, while a gate near 1 makes a stronger correction. This turns memory update into a learned edit rather than blind accumulation.',
    ] },
    { heading: 'How it works', paragraphs: [
      'At step t, the model produces a key k_t, a value v_t, and a gate beta_t. It reads the memory with k_t to get the current prediction. It then computes the difference between desired value and current prediction.',
      'The update has the form M_t = M_{t-1} + beta_t * (v_t - M_{t-1} k_t) k_t^T, depending on convention for row or column layout. The important point is residual correction. If memory already returns v_t, the error is near zero and the write is small.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is local least-squares correction. For a normalized key k, the update moves M k toward v by a fraction beta of the current error. If beta is 1 and k has unit norm, the next read for the same key returns the target under the simplified single-key model.',
      'With many keys, the guarantee weakens because keys are not perfectly orthogonal. The update for one key can affect reads for nearby keys. Gating and learned key geometry are therefore part of correctness, not cosmetic additions.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The recurrent state has fixed memory O(d_k * d_v), where d_k is key size and d_v is value size. If both are 128, the memory matrix has 16,384 numbers. That state size does not grow when the sequence grows from 4,000 to 64,000 tokens.',
      'Per-token work is matrix-vector read plus outer-product update, roughly O(d_k * d_v). Softmax attention decode reads an ever-growing cache, while fast-weight decode keeps constant state. The cost is compression error: the model cannot recover every past token exactly from one fixed matrix.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Fast-weight delta memory appears in linear attention research and DeltaNet-style sequence models. It fits long-context or streaming settings where constant-size state is more attractive than a full key-value cache. The access pattern is sequential updates with many later reads from compressed memory.',
      'It also helps explain the connection between attention and associative memory. Attention stores explicit examples and searches them. Fast weights store a learned map that tries to answer from compressed associations.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when exact episodic recall is required. A fixed matrix cannot store an unlimited number of unrelated facts without interference. If a task needs verbatim retrieval of one token from 100,000 distractors, full attention or an external retrieval structure may be safer.',
      'It also fails when gates learn poor overwrite behavior. Too much writing erases useful associations, while too little writing leaves stale memory. Training has to teach both what to write and how aggressively to edit.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Use a 2-dimensional key and value memory with M initially all zeros. Let k = [1, 0] and v = [3, 5]. The current read M k is [0, 0], so the error is [3, 5].',
      'With beta = 1, the update writes error times k^T, producing M = [[3, 0], [5, 0]] in column-vector layout. Reading the same key gives M k = [3, 5], so the association is correct. If beta = 0.5, the read becomes [1.5, 2.5], halfway corrected.',
      'Now write a nearby key k2 = [1, 0.2] with value [4, 5]. The update affects the first association because k2 overlaps k. That numerical interference is the real tax behind the memory compression.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: "Linear Transformers Are Secretly Fast Weight Programmers" by Schlag, Irie, and Schmidhuber, and "Gated Delta Networks: Improving Mamba2 with Delta Rule" by Yang, Kautz, and Hatamizadeh. Read the update equations before reading benchmark claims.',
      'Study next: linear attention, associative memory, outer products, recurrent neural networks, Mamba-style state space models, and key-value cache cost. The main lesson is that constant memory buys speed by replacing exact storage with learned edits.',
    ] },
  ],
};
