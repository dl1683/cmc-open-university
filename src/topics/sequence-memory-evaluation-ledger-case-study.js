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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each ledger row as one memory claim under one serving path. Active cells are the current slice being evaluated, visited cells are completed measurements, and failed cells preserve the shape of the miss. The safe inference is that a long context window is not the same as useful memory.',
        {type:"callout", text:"A sequence-memory ledger makes long context measurable by preserving the shape of failures instead of averaging them away."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sequence memory is the ability to keep and use information across a long token sequence. A model may accept 128,000 tokens and still fail when evidence sits in the middle, must be joined with another fact, or is overwritten later. A ledger records which kind of memory was tested and how it behaved in the real runtime.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to report maximum context length and one average long-context score. That is easy to compare, but it hides where the model failed. A product team cannot decide from one number whether the issue is retrieval, overwrite handling, latency, or memory cost.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that memory is not one skill. Exact lookup, multi-hop binding, lost-in-the-middle behavior, recency, aggregation, and code-trace fidelity can diverge. Deployment adds another wall: a memory layer can pass offline tasks while missing p99 latency, the latency under which 99 percent of requests finish, or falling back to a hidden full-attention route.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Evaluate memory as rows of narrow claims. A slice says what evidence was placed, where it was placed, what task used it, which model and runtime handled it, and what rule scored the answer. The result is a frontier of quality, latency, and state cost rather than a champion label.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each row stores architecture id, model revision, tokenizer, context length, evidence position, task type, expected answer, scorer, runtime, kernel path, fallback rate, p50, p99, and state bytes per user. The same candidate is tested on recall slices and serving gates. Rows link to prompts, generated data, code, and hardware so the result can be rerun.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from preserving claim boundaries. A pass on single-needle lookup cannot erase a fail on overwrite, and a quality pass cannot erase a p99 miss. The ledger is trustworthy when every row names its setup, scorer, artifact, and route, so a later regression can be traced to a changed input or system path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The ledger costs benchmark generation, artifact storage, reruns, and scorer maintenance. If 40 slices run at 3 context lengths on 5 model revisions, the team already has 600 quality rows before serving sweeps. The payoff is that one expensive failed rollout can be replaced by a precise fix list.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits long-context model selection, architecture research, RAG evaluation, coding assistants, legal or medical assistants, and runtime planning. It is useful whenever a missed fact, stale correction, or tail-latency spike changes whether the product can ship.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A ledger fails when slices are too easy, prompts are not versioned, or the report collapses back into one average. It also fails when synthetic rows never connect to user traffic. Good ledgers keep synthetic probes, curated domain tasks, and canary telemetry linked.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A team compares full attention with a compressed memory layer at 64K tokens. State bytes per user fall from 16 GB to 4 GB, but middle-position invoice lookup drops from 94 percent to 71 percent and p99 improves from 9 seconds to 5 seconds. The ledger says this is not a general win: kernel work is less urgent than fixing the middle-position slice for invoice workflows.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Lost in the Middle, RULER, LongBench, KV cache capacity models, linear attention, state-space models such as Mamba, fast-weight memory, neural memory, retrieval evaluation, and benchmark variance. Then study serving traces, because memory quality without the runtime path is only a lab result.',
      ],
    },
  ],
};
