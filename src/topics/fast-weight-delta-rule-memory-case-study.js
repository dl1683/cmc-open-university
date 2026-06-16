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
    {
      heading: 'What it is',
      paragraphs: [
        'Fast weight memory is a way to understand linear attention as a temporary, sequence-programmed memory. A slow network emits keys, values, gates, and update rules; those updates write into a fast weight matrix that later queries can read.',
        'The delta-rule version matters because pure additive memory can struggle with conflicts. If the same key receives a new value later, simply adding another outer product may blur the mapping. A delta update uses the current prediction error to correct the memory.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The core objects are key vectors, value vectors, a fast weight matrix, a query vector, a predicted value, a delta error, erase gates, update rates, chunk summaries, and retrieval test records. This is a mutable key-value store inside the model, not an external database.',
        'The comparison to data structures is direct. Additive writes are append-only. Delta writes are corrective updates. Gates are deletion or decay policy. Chunkwise algorithms are batch execution plans. The hard part is making all of those learned, differentiable, and fast.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In additive linear attention, a token writes an outer product between key and value into memory. A later query multiplies by that memory to retrieve a value. In delta-rule memory, the write can subtract the current wrong prediction and move the mapping toward the new target. Gating adds erase and retention control.',
        'Gated DeltaNet combines the Mamba-2 style gating idea with delta-rule correction. Its paper frames gating and delta updates as complementary: gates rapidly erase or retain memory, while delta updates make targeted corrections. The resulting recurrent layer still needs a parallel training algorithm to avoid slow token-by-token training.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A model reads a long repository trace. Early in the trace, API A maps to version 1. Later, a migration changes API A to version 2. A purely additive memory may carry both associations. A delta-rule memory can use the prediction error under the same key to correct the mapping, while gates reduce stale state.',
        'A serious evaluation does not stop at language modeling loss. It tests key-value overwrites, multi-hop retrieval, long-context mutation traces, code migrations, and serving latency. If correction helps only in synthetic tasks but slows kernels too much, the production tradeoff may still fail.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not treat fast weights as magic unlimited memory. Matrix state has finite capacity and can collide. Do not forget that delta corrections can amplify noise if the current prediction is unreliable. Do not compare Gated DeltaNet to Mamba-2 without matching training data, model size, kernel maturity, and evaluation slices.',
        'Primary sources: Linear Transformers Are Secretly Fast Weight Programmers at https://arxiv.org/abs/2102.11174, Gated Delta Networks: Improving Mamba2 with Delta Rule at https://arxiv.org/abs/2412.06464 and https://openreview.net/forum?id=r8H7xhYPwz, the NVLabs implementation at https://github.com/NVlabs/GatedDeltaNet, and Mamba-2 SSD at https://arxiv.org/abs/2405.21060. Study Linear Attention Prefix-State Primer, Mamba-2 Structured State Space Duality Case Study, Kimi Linear Attention, RetNet Retention State Case Study, and Hybrid Attention State Budget Case Study next.',
      ],
    },
  ],
};
