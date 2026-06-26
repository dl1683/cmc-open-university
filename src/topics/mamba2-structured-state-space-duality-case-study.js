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
      heading: 'How to read the animation',
      paragraphs: [
        'The SSD-duality view shows one sequence layer in two forms. A state-space model carries a compact hidden state from token to token, while the matrix view shows the same causal transformation over the whole sequence. Active nodes are the representation being used now, found nodes are equivalent results, and compare nodes test where the two views must agree.',
        'The chunked-kernel view shows the parallel schedule. A chunk is a contiguous block of tokens processed together. The safe inference is that local block work plus a prefix scan over block summaries must produce the same outputs as the serial recurrence, within numerical tolerance.',
        {type:'callout', text:'Mamba-2 is a data-structure lesson: the useful object is the semiseparable matrix that unifies compact recurrence with parallel block execution.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Long-context models pay heavily for exact attention. Full causal attention lets each token inspect earlier tokens, but the pairwise table grows with sequence length squared during prefill and the key-value cache grows with context during decoding. A million-token workload turns memory layout into the limiting resource.',
        'State-space models offer a different memory shape. They update a compact state as the sequence advances, so decoding can avoid storing every old token as a separate key and value row. Mamba-2 exists because that compact recurrence also needs a training schedule that uses accelerators well.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep using dense Transformer attention. It is expressive, well studied, and backed by mature kernels. It also gives the model direct access to exact prior token representations, which helps copying, retrieval, and code-like tasks.',
        'Another approach is a simple recurrent neural network. It keeps fixed-size state and streams naturally, but older recurrent designs often train poorly on long dependencies and underuse parallel hardware. The problem is not choosing attention or recurrence by slogan; it is finding a memory form that trains fast and serves cheaply.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Attention hits the quadratic wall in prefill and the cache wall in decode. If a layer attends over 8,192 tokens, the attention score matrix has about 67 million causal pair positions before heads and batches are counted. Longer context makes bandwidth and memory movement dominate arithmetic.',
        'A naive recurrence hits the serial wall. If token 5,000 cannot be processed until token 4,999 has updated state, training loses the parallelism that GPUs need. A useful design must keep the recurrence view for streaming while exposing a matrix or block view for parallel training.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Structured state space duality says that a selective state-space recurrence can be represented as a structured causal matrix. The recurrence view explains compact streaming state. The matrix view explains how a whole sequence transformation can be scheduled in blocks.',
        'The key structure is semiseparable. Far interactions are not stored as independent pairwise entries; they pass through compact factors and state summaries. That gives the model a controlled way to represent long-range influence without materializing the full attention table.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In recurrent form, each token reads the current state, updates it using input-dependent parameters, and emits an output. In matrix form, the full output sequence is the input sequence multiplied by a causal structured matrix. Mamba-2 uses the shared algebra to move between these views.',
        'For training, the sequence is split into chunks. Each chunk computes local work, emits a summary of how it transforms incoming state, and participates in a prefix scan across chunks. A fixup step injects the scanned incoming state back into each chunk so the final output matches the recurrence.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is equivalence of two execution orders for the same associative state update. Local chunks summarize their effect on incoming state, and the prefix scan composes those summaries in sequence order. Once each chunk receives the correct prefix state, its local outputs match the serial recurrence.',
        'The semiseparable matrix is the proof object. It states which parts of the full causal matrix are local and which parts can be represented by factors. If the implementation builds the same structured transformation in both paths, recurrent decoding and chunked training are two schedules for one layer, not two different models.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Full attention over length L has O(L squared) pair interactions per layer, while the structured recurrence targets near-linear sequence work plus chunk scan overhead. Doubling L from 4,096 to 8,192 roughly quadruples the attention score positions, but it roughly doubles the number of tokens and chunks for the structured path. That is the behavior the architecture is trying to buy.',
        'The hidden costs are kernel quality, state size, saved activations, scan synchronization, and numerical stability. A small asymptotic curve can still lose if gather, scan, or backward-pass memory traffic dominates. Mamba-2 is therefore a math claim and a systems claim at the same time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Mamba-2 style layers are candidates for long documents, audio, genomics, time series, and high-concurrency generation where exact attention cache bytes are expensive. The access pattern is long sequential context where compressed state may preserve enough information. Hybrid models can keep attention in some layers while using state-space layers for cheaper long-range memory.',
        'The idea is also useful as a teaching bridge. It connects linear algebra, recurrences, prefix scans, GPU kernels, and model-serving budgets. A reader who understands the duality can evaluate new efficient-attention claims without relying only on benchmark headlines.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Compressed state can lose exact information. Tasks that need verbatim copying, rare-token retrieval, citation to a distant line, or precise code-span reuse may need attention or retrieval paths. A model can have good average perplexity and still fail the slice that requires exact old tokens.',
        'Implementation risk is also real. The recurrent path and chunked path must agree, gradients must stay stable under mixed precision, and kernels must win on the target hardware. A custom result on one GPU shape does not prove a production serving win.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a sequence of 8,192 tokens and chunks of 256 tokens. There are 32 chunks. A dense attention layer considers about 8,192 times 8,192, or 67,108,864, pair positions before causal masking, heads, and batches are counted.',
        'The chunked SSD path does local work inside each 256-token chunk, creates 32 summaries, scans those summaries, and applies a fixup to each chunk. If the state summary has 128 numbers, the cross-chunk carry stores thousands of numbers rather than tens of millions of pair scores. The price is that old context must fit through the structured state, not remain available as exact rows.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are "Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality" at https://arxiv.org/abs/2405.21060, the state-spaces Mamba repository at https://github.com/state-spaces/mamba, and Tri Dao notes at https://tridao.me/blog/2024/mamba2-part1-model/. Use these sources for mechanism claims before relying on secondary summaries.',
        'Study Selective State Space Models, Attention Mechanism, KV Cache, Parallel Prefix Scan, Linear Attention Prefix-State Primer, RetNet Retention State, Hybrid Attention State Budget, and Transformer Inference Roofline next. Start with the topic that explains the data shape, then move to the production system.',
      ],
    },
  ],
};