// Mamba-2 and structured state space duality: one layer can be read as an
// SSM recurrence or as a structured attention-like matrix.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'mamba2-structured-state-space-duality-case-study',
  title: 'Mamba-2 Structured State Space Duality Case Study',
  category: 'Papers',
  summary: 'Mamba-2 as a duality lesson: semiseparable matrices connect SSM recurrences, attention-like views, chunk scans, and faster long-context kernels.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['SSD duality', 'chunked kernel'], defaultValue: 'SSD duality' },
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

function dualityGraph(title) {
  return graphState({
    nodes: [
      { id: 'tokens', label: 'tokens', x: 0.7, y: 3.5, note: 'sequence' },
      { id: 'ssm', label: 'SSM view', x: 2.7, y: 2.2, note: 'scan' },
      { id: 'attn', label: 'attn view', x: 2.7, y: 4.8, note: 'matrix' },
      { id: 'semi', label: 'semi-sep', x: 4.9, y: 3.5, note: 'structure' },
      { id: 'chunk', label: 'chunk', x: 6.9, y: 2.4, note: 'blocks' },
      { id: 'kernel', label: 'kernel', x: 6.9, y: 4.6, note: 'fast path' },
      { id: 'm2', label: 'Mamba-2', x: 8.8, y: 3.5, note: 'layer' },
    ],
    edges: [
      { id: 'e-tokens-ssm', from: 'tokens', to: 'ssm' },
      { id: 'e-tokens-attn', from: 'tokens', to: 'attn' },
      { id: 'e-ssm-semi', from: 'ssm', to: 'semi' },
      { id: 'e-attn-semi', from: 'attn', to: 'semi' },
      { id: 'e-semi-chunk', from: 'semi', to: 'chunk' },
      { id: 'e-semi-kernel', from: 'semi', to: 'kernel' },
      { id: 'e-chunk-m2', from: 'chunk', to: 'm2' },
      { id: 'e-kernel-m2', from: 'kernel', to: 'm2' },
    ],
  }, { title });
}

function chunkGraph(title) {
  return graphState({
    nodes: [
      { id: 'b1', label: 'block 1', x: 0.8, y: 2.4, note: 'local' },
      { id: 's1', label: 'state 1', x: 2.7, y: 2.4, note: 'summary' },
      { id: 'b2', label: 'block 2', x: 0.8, y: 4.2, note: 'local' },
      { id: 's2', label: 'state 2', x: 2.7, y: 4.2, note: 'summary' },
      { id: 'b3', label: 'block 3', x: 0.8, y: 6.0, note: 'local' },
      { id: 's3', label: 'state 3', x: 2.7, y: 6.0, note: 'summary' },
      { id: 'scan', label: 'state scan', x: 5.0, y: 4.2, note: 'carry' },
      { id: 'fixup', label: 'fixup', x: 7.1, y: 4.2, note: 'cross block' },
      { id: 'out', label: 'outputs', x: 9.0, y: 4.2, note: 'tokens' },
    ],
    edges: [
      { id: 'e-b1-s1', from: 'b1', to: 's1' },
      { id: 'e-b2-s2', from: 'b2', to: 's2' },
      { id: 'e-b3-s3', from: 'b3', to: 's3' },
      { id: 'e-s1-scan', from: 's1', to: 'scan' },
      { id: 'e-s2-scan', from: 's2', to: 'scan' },
      { id: 'e-s3-scan', from: 's3', to: 'scan' },
      { id: 'e-scan-fixup', from: 'scan', to: 'fixup' },
      { id: 'e-fixup-out', from: 'fixup', to: 'out' },
    ],
  }, { title });
}

function* ssdDuality() {
  yield {
    state: dualityGraph('Structured state space duality'),
    highlight: { active: ['ssm', 'attn', 'semi', 'e-ssm-semi', 'e-attn-semi'], found: ['m2'] },
    explanation: 'Mamba-2 is best taught as a dual representation. The same layer can be viewed as a state-space recurrence or as a structured attention-like matrix, with semiseparable structure connecting the two.',
    invariant: 'The data structure is the structured matrix, not just the recurrence.',
  };

  yield {
    state: labelMatrix(
      'SSD layer views',
      [
        { id: 'ssm', label: 'SSM' },
        { id: 'attn', label: 'attn' },
        { id: 'ssd', label: 'SSD' },
        { id: 'm2', label: 'M2' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'wins', label: 'wins' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['state', 'scan', 'cap'],
        ['matrix', 'global', 'cache'],
        ['semi', 'dual', 'proof'],
        ['blocks', 'kernel', 'impl'],
      ],
    ),
    highlight: { active: ['ssd:keeps', 'ssd:wins'], compare: ['ssm:risk', 'attn:risk'], found: ['m2:wins'] },
    explanation: 'The SSD frame says attention-like and recurrent models are not separate islands. They are different factorizations of structured sequence transformations.',
  };

  yield {
    state: labelMatrix(
      'Semiseparable memory',
      [
        { id: 'diag', label: 'diag' },
        { id: 'near', label: 'near' },
        { id: 'far', label: 'far' },
        { id: 'state', label: 'state' },
      ],
      [
        { id: 'meaning', label: 'role' },
        { id: 'storage', label: 'store' },
      ],
      [
        ['now', 'direct'],
        ['local', 'block'],
        ['old', 'factor'],
        ['carry', 'small'],
      ],
    ),
    highlight: { active: ['far:storage', 'state:storage'], compare: ['diag:storage'] },
    explanation: 'A full attention matrix stores every interaction. A structured semiseparable matrix stores far interactions through compact factors, which is why the recurrence and matrix views can agree.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'sequence length', min: 0, max: 8192 }, y: { label: 'relative work', min: 0, max: 100 } },
      series: [
        { id: 'full', label: 'full attention', points: [{ x: 512, y: 1 }, { x: 2048, y: 6 }, { x: 4096, y: 25 }, { x: 8192, y: 100 }] },
        { id: 'ssd', label: 'SSD scan', points: [{ x: 512, y: 4 }, { x: 2048, y: 12 }, { x: 4096, y: 23 }, { x: 8192, y: 46 }] },
      ],
      markers: [
        { id: 'long', x: 8192, y: 46, label: 'linear-ish' },
      ],
    }),
    highlight: { active: ['ssd', 'long'], compare: ['full'] },
    explanation: 'This is a conceptual scaling chart. The Mamba-2 paper reports a faster SSD core than earlier Mamba-style selective scans; the useful point is how structure changes the long-context work curve.',
  };
}

function* chunkedKernel() {
  yield {
    state: chunkGraph('Chunked SSD computation'),
    highlight: { active: ['b1', 'b2', 'b3', 's1', 's2', 's3'], found: ['scan'] },
    explanation: 'A chunked SSD kernel computes local block work in parallel, summarizes each block, scans the summaries, then applies cross-block state corrections.',
  };

  yield {
    state: labelMatrix(
      'Kernel responsibilities',
      [
        { id: 'local', label: 'local' },
        { id: 'scan', label: 'scan' },
        { id: 'fixup', label: 'fixup' },
        { id: 'back', label: 'backprop' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'shape', label: 'shape' },
        { id: 'bug', label: 'bug' },
      ],
      [
        ['tile', 'matmul', 'shape'],
        ['carry', 'prefix', 'order'],
        ['xblock', 'update', 'drift'],
        ['grad', 'reverse', 'memory'],
      ],
    ),
    highlight: { active: ['local:job', 'scan:job', 'fixup:job'], found: ['back:job'] },
    explanation: 'The algorithm is a systems object. Local tiles, prefix scans, cross-block updates, and backward state all need the same mathematical contract.',
  };

  yield {
    state: chunkGraph('State summaries stitch blocks together'),
    highlight: { active: ['s1', 's2', 's3', 'scan', 'fixup', 'e-s1-scan', 'e-s2-scan', 'e-s3-scan', 'e-scan-fixup'], found: ['out'] },
    explanation: 'Block summaries are the bridge between parallel training and recurrent interpretation. They let the kernel recover long-range state without materializing every pairwise token interaction.',
    invariant: 'A fast sequence layer is usually a scheduling plan plus a memory form.',
  };

  yield {
    state: labelMatrix(
      'Layer adoption audit',
      [
        { id: 'math', label: 'math' },
        { id: 'impl', label: 'impl' },
        { id: 'quality', label: 'quality' },
        { id: 'serve', label: 'serve' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['equiv', 'unit'],
        ['kernel', 'bench'],
        ['LM', 'slice'],
        ['p99', 'canary'],
      ],
    ),
    highlight: { active: ['math:gate', 'impl:gate', 'quality:gate', 'serve:gate'] },
    explanation: 'A production adoption packet needs mathematical equivalence tests, kernel benchmarks, quality slices, and serving p99. Missing any one turns an elegant layer into an unverified claim.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'SSD duality') yield* ssdDuality();
  else if (view === 'chunked kernel') yield* chunkedKernel();
  else throw new InputError('Pick a Mamba-2 SSD view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Mamba-2 is a sequence-model architecture built from structured state space duality, or SSD. The teaching move is that state-space recurrences and attention-like sequence matrices can be understood through the same structured matrix family. Instead of treating attention and recurrence as unrelated choices, SSD asks which factorization of the sequence transformation gives the best quality and hardware behavior.',
        'The Mamba-2 paper describes SSD as a framework connecting SSMs and attention variants through semiseparable matrices, then uses it to design a Mamba-2 layer that refines Mamba selective SSMs and runs faster. This belongs directly after Selective State Space Models: Mamba because it explains the next layer of abstraction.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main data structures are the recurrent state, the structured semiseparable matrix, block summaries, prefix-scan carries, tile buffers, and backward-pass state. The semiseparable view is the educational key: far token interactions can be represented through compact factors rather than a dense all-pairs matrix.',
        'This puts Mamba-2 beside Linear Attention Prefix-State Primer and RetNet Retention State Case Study. All three ask the same question in different notation: what summary of the past is rich enough to replace full token-level attention for this workload?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In the recurrent view, tokens update state and carry it forward. In the matrix view, the whole sequence transformation looks like a structured attention-like map. The chunked algorithm computes local block work, summarizes blocks, scans state across blocks, and applies cross-block corrections. That is why the layer can be reasoned about mathematically and scheduled efficiently.',
        'A useful mental model is a database execution plan. The math defines the logical operator; the kernel chooses a physical plan with blocking, tiling, prefix scans, and memory reuse. The logical equivalence is necessary but not sufficient; the physical plan decides whether the idea is actually fast.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A team wants to replace some full-attention layers in a long-context model. They test Mamba-2 SSD layers. First they validate recurrence-versus-matrix equivalence on short sequences. Then they benchmark the chunked kernel at several context lengths. Then they run long-context retrieval, code, reasoning, and perplexity slices. Finally they canary serving p50, p95, p99, cache bytes, and output-token throughput.',
        'The adoption decision should not be made from asymptotic complexity alone. It should be made from a ledger: mathematical equivalence, kernel route, quality preservation, training stability, serving latency, and debugging visibility.',
      ],
    },
    {
      heading: 'Pitfalls and sources',
      paragraphs: [
        'Do not say Mamba-2 proves attention is obsolete. SSD shows a relationship between model families and offers a faster layer design, but exact recall, data scale, task mix, and kernels still matter. Do not compare a mature full-attention implementation against an immature SSD kernel and call it an architecture result. Do not evaluate only perplexity if the product needs long-context retrieval or tool traces.',
        'Primary sources: Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality at https://arxiv.org/abs/2405.21060, the state-spaces Mamba repository at https://github.com/state-spaces/mamba, and Tri Dao SSD notes at https://tridao.me/blog/2024/mamba2-part1-model/. Study Selective State Space Models: Mamba, Linear Attention Prefix-State Primer, Fast Weight Delta-Rule Memory Case Study, RetNet Retention State Case Study, Kimi Linear Attention, Hybrid Attention State Budget Case Study, and Transformer Inference Roofline next.',
      ],
    },
  ],
};
