// Sequence-memory evaluation ledger: compare exact attention, KV variants,
// linear state, SSMs, fast weights, and neural memory with task and serving slices.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sequence-memory-evaluation-ledger-case-study',
  title: 'Sequence Memory Evaluation Ledger Case Study',
  category: 'AI & ML',
  summary: 'An evaluation playbook for long-context memory forms: recall slices, overwrite tests, RULER-style tasks, p99 serving metrics, state bytes, and rollout gates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['recall slices', 'serving gate'], defaultValue: 'recall slices' },
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

function evalGraph(title) {
  return graphState({
    nodes: [
      { id: 'arch', label: 'arch', x: 0.7, y: 3.5, note: 'memory form' },
      { id: 'tasks', label: 'tasks', x: 2.2, y: 2.1, note: 'RULER' },
      { id: 'pos', label: 'position', x: 2.2, y: 3.5, note: 'middle' },
      { id: 'mut', label: 'overwrite', x: 2.2, y: 4.9, note: 'delta' },
      { id: 'serve', label: 'serving', x: 4.3, y: 2.1, note: 'p99' },
      { id: 'state', label: 'state bytes', x: 4.3, y: 4.9, note: 'memory' },
      { id: 'ledger', label: 'ledger', x: 6.4, y: 3.5, note: 'slices' },
      { id: 'gate', label: 'gate', x: 8.4, y: 3.5, note: 'ship?' },
    ],
    edges: [
      { id: 'e-arch-tasks', from: 'arch', to: 'tasks' },
      { id: 'e-arch-pos', from: 'arch', to: 'pos' },
      { id: 'e-arch-mut', from: 'arch', to: 'mut' },
      { id: 'e-arch-serve', from: 'arch', to: 'serve' },
      { id: 'e-arch-state', from: 'arch', to: 'state' },
      { id: 'e-tasks-ledger', from: 'tasks', to: 'ledger' },
      { id: 'e-pos-ledger', from: 'pos', to: 'ledger' },
      { id: 'e-mut-ledger', from: 'mut', to: 'ledger' },
      { id: 'e-serve-ledger', from: 'serve', to: 'ledger' },
      { id: 'e-state-ledger', from: 'state', to: 'ledger' },
      { id: 'e-ledger-gate', from: 'ledger', to: 'gate' },
    ],
  }, { title });
}

function* recallSlices() {
  yield {
    state: evalGraph('Long-context memory must pass slice tests'),
    highlight: { active: ['arch', 'tasks', 'pos', 'mut', 'ledger', 'e-arch-tasks', 'e-arch-pos', 'e-arch-mut'], found: ['gate'] },
    explanation: 'A sequence-memory architecture is not proven by a context-length number. The ledger must test retrieval, position sensitivity, overwrites, multi-hop tracing, and aggregation.',
    invariant: 'Context length is capacity advertised; slice scores are capacity used.',
  };

  yield {
    state: labelMatrix(
      'Recall slices',
      [
        { id: 'needle', label: 'needle' },
        { id: 'multi', label: 'multi' },
        { id: 'middle', label: 'middle' },
        { id: 'overwrite', label: 'fresh' },
        { id: 'agg', label: 'agg' },
      ],
      [
        { id: 'tests', label: 'tests' },
        { id: 'catches', label: 'catches' },
        { id: 'next', label: 'next' },
      ],
      [
        ['find', 'lookup', 'easy'],
        ['2facts', 'bind', 'hard'],
        ['mid', 'lost', 'must'],
        ['new', 'stale', 'must'],
        ['sum', 'state', 'must'],
      ],
    ),
    highlight: { active: ['middle:catches', 'overwrite:catches', 'agg:catches'], compare: ['needle:next'] },
    explanation: 'Vanilla needle-in-haystack can be too shallow. RULER-style suites add multiple needles, multi-hop tracing, aggregation, and length scaling to expose brittle memory.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'relative position of evidence', min: 0, max: 100 }, y: { label: 'accuracy, conceptual percent', min: 0, max: 100 } },
      series: [
        { id: 'edge', label: 'edge-biased model', points: [{ x: 0, y: 88 }, { x: 20, y: 70 }, { x: 50, y: 46 }, { x: 80, y: 70 }, { x: 100, y: 89 }] },
        { id: 'flat', label: 'robust target', points: [{ x: 0, y: 86 }, { x: 20, y: 84 }, { x: 50, y: 82 }, { x: 80, y: 84 }, { x: 100, y: 86 }] },
      ],
      markers: [
        { id: 'mid', x: 50, y: 46, label: 'middle dip' },
      ],
    }),
    highlight: { active: ['edge', 'mid'], compare: ['flat'] },
    explanation: 'Lost-in-the-middle behavior is a required slice for any long-context claim. If relevant evidence in the middle disappears, a larger context window is not enough.',
  };

  yield {
    state: labelMatrix(
      'Architecture-specific probes',
      [
        { id: 'kv', label: 'KV' },
        { id: 'lin', label: 'linear' },
        { id: 'ssm', label: 'SSM' },
        { id: 'delta', label: 'delta' },
        { id: 'neural', label: 'neural' },
      ],
      [
        { id: 'probe', label: 'probe' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['exact', 'cache'],
        ['collide', 'blur'],
        ['carry', 'forget'],
        ['update', 'noise'],
        ['surprise', 'drift'],
      ],
    ),
    highlight: { active: ['lin:probe', 'ssm:probe', 'delta:probe', 'neural:probe'], compare: ['kv:risk'] },
    explanation: 'Different memory forms need different stress tests. A delta-rule model needs overwrite tasks; an SSM needs long carry tasks; a neural-memory model needs surprise and drift probes.',
  };
}

function* servingGate() {
  yield {
    state: evalGraph('Serving metrics sit beside quality metrics'),
    highlight: { active: ['serve', 'state', 'ledger', 'gate', 'e-serve-ledger', 'e-state-ledger', 'e-ledger-gate'], compare: ['tasks'] },
    explanation: 'Efficient sequence memory is a serving claim as much as a modeling claim. The same ledger should record p50, p95, p99, state bytes, kernel route, and fallback rate.',
  };

  yield {
    state: labelMatrix(
      'Serving gate fields',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'ttft', label: 'TTFT' },
        { id: 'tpot', label: 'TPOT' },
        { id: 'p99', label: 'p99' },
        { id: 'fallback', label: 'fallback' },
        { id: 'quality', label: 'quality' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['state', 'cap'],
        ['pre', 'SLO'],
        ['decode', 'SLO'],
        ['tail', 'must'],
        ['slow', 'alert'],
        ['slice', 'must'],
      ],
    ),
    highlight: { active: ['bytes:gate', 'p99:gate', 'fallback:gate', 'quality:gate'], found: ['tpot:measure'] },
    explanation: 'A memory-efficient layer can still fail production if it falls off the optimized kernel, creates a p99 tail, or silently routes to a full-attention fallback.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'context length', min: 0, max: 128000 }, y: { label: 'ship score, conceptual', min: 0, max: 1 } },
      series: [
        { id: 'quality', label: 'quality', points: [{ x: 8000, y: 0.92 }, { x: 32000, y: 0.84 }, { x: 64000, y: 0.70 }, { x: 128000, y: 0.51 }] },
        { id: 'cost', label: 'cost fitness', points: [{ x: 8000, y: 0.55 }, { x: 32000, y: 0.72 }, { x: 64000, y: 0.83 }, { x: 128000, y: 0.91 }] },
      ],
      markers: [
        { id: 'knee', x: 48000, y: 0.76, label: 'knee' },
      ],
    }),
    highlight: { active: ['quality', 'cost', 'knee'] },
    explanation: 'The decision is a frontier, not a single score. A compressed memory model may become more attractive as context grows, but only until quality drops below the product floor.',
  };

  yield {
    state: labelMatrix(
      'Rollout packet',
      [
        { id: 'base', label: 'base' },
        { id: 'cand', label: 'cand' },
        { id: 'slice', label: 'slice' },
        { id: 'serve', label: 'serve' },
        { id: 'canary', label: 'canary' },
      ],
      [
        { id: 'artifact', label: 'art' },
        { id: 'decision', label: 'gate' },
      ],
      [
        ['attn', 'ref'],
        ['cand', 'test'],
        ['RULER', 'pass'],
        ['p99', 'pass'],
        ['canary', 'ramp'],
      ],
    ),
    highlight: { active: ['base:artifact', 'cand:artifact', 'slice:decision', 'serve:decision', 'canary:decision'] },
    explanation: 'A complete adoption packet compares the candidate against a full-attention baseline, records slice scores, records serving metrics, and canaries real traffic before claiming victory.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'recall slices') yield* recallSlices();
  else if (view === 'serving gate') yield* servingGate();
  else throw new InputError('Pick a sequence-memory evaluation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A sequence memory evaluation ledger is a scorecard for architectures that replace or compress full attention: grouped KV, latent KV, linear attention, SSMs, RetNet, RWKV, Mamba-2, Gated DeltaNet, TTT layers, xLSTM, and neural memory. It records what the memory form can recall, what it forgets, how it behaves as context grows, and what it costs to serve.',
        'This topic is the evaluation companion to Hybrid Attention State Budget Case Study. The budget page explains how memory choices change cache economics. This page explains how to prove the memory still works.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The ledger stores architecture id, context length, evidence position, task category, overwrite pattern, number of needles, multi-hop depth, aggregation rule, state bytes per user, kernel path, p50, p95, p99, fallback rate, and pass or fail reason. Each row should point to exact prompts, seeds, model revision, and serving configuration.',
        'The important move is slice granularity. A model can pass a simple needle task and fail multi-hop tracing. It can pass beginning and end evidence and fail middle evidence. It can pass quality and fail p99. Those are different rows, not one average.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The evaluation begins with a full-attention or current-production baseline. Candidate memory architectures are then tested on retrieval, multi-needle retrieval, position shifts, overwrites, aggregation, code traces, long conversations, and domain tasks. Serving tests run the same candidates under realistic batch, context, and output-token distributions.',
        'The ledger should also contain architecture-specific probes. Linear attention needs collision and normalization tests. SSMs need long-carry tests. Delta-rule memory needs overwrite tests. Neural memory needs surprise-write and drift tests. KV-cache variants need exact recall and cache-capacity tests.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team wants to replace half of the attention layers in a long-context model. The candidate saves state bytes and improves decode throughput at 64K context. The ledger then asks whether it survives middle-position retrieval, two-hop key tracing, late overwrite facts, code migration traces, and aggregation tasks. It also checks p99 decode latency and fallback rate under a real router.',
        'The result is not a single winner. It is a frontier: full attention wins exact recall but costs more cache, compressed memory wins cost but may fail some slices, and hybrid stacks may win the deployment knee. The ledger makes that trade visible.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not evaluate long context with only one easy needle. Do not claim a model uses its context just because it accepts many tokens. Do not average away the middle-position failure. Do not report speed without naming the kernel route, batch shape, output-token count, and fallback behavior.',
        'Primary sources: Lost in the Middle at https://arxiv.org/abs/2307.03172 and https://aclanthology.org/2024.tacl-1.9/, RULER at https://arxiv.org/abs/2404.06654 and https://github.com/NVIDIA/RULER, LongBench at https://arxiv.org/abs/2308.14508, and Transformer Inference Roofline sources in this repo. Study Mamba-2 Structured State Space Duality Case Study, Linear Attention Prefix-State Primer, Fast Weight Delta-Rule Memory Case Study, Kimi Linear Attention, Titans Test-Time Neural Memory Case Study, Lost in the Middle: Long-Context Failure Modes, and Benchmark Variance & Model Selection next.',
      ],
    },
  ],
};
