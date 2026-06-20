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
      heading: 'Why Mamba-2 matters',
      paragraphs: [
        'Long-context sequence models have a basic resource problem. Full attention gives each token a direct path to every earlier token, but the prefill work grows with all pairs and the decode cache grows with context length. Recurrent models keep a compact state, but old recurrent designs often lost too much detail or trained poorly on accelerator hardware. The useful question is not "attention or recurrence". The useful question is what memory form preserves enough information while staying cheap to train and serve.',
        'Mamba-2 matters because it turns that question into a duality lesson. Structured state space duality, or SSD, shows that some state-space recurrences can also be viewed as structured attention-like matrices. The recurrence view explains streaming decode and compact state. The matrix view explains parallel training and relation to attention. The shared object is a structured matrix with semiseparable form. That is the data structure at the center of the topic.',
        {type:'callout', text:'Mamba-2 is a data-structure lesson: the useful object is the semiseparable matrix that unifies compact recurrence with parallel block execution.'},
      ],
    },
    {
      heading: 'The shallow comparison',
      paragraphs: [
        'A shallow comparison says attention is expressive but quadratic, while recurrence is linear but weak. That story is too crude. Attention is not only an algorithm; it is also a memory layout, a cache, a set of mature kernels, and a quality baseline. Recurrence is not only a loop; it can be transformed into scans, block algorithms, and structured matrices. The implementation can change the practical result as much as the equation.',
        'A second shallow comparison looks only at big-O notation. Linear or near-linear work is attractive, but a layer can still lose if its kernels are immature, its backward pass stores too much state, its tile shapes waste memory bandwidth, or its compressed memory fails the task. The right comparison includes algebra, kernel schedule, quality slices, and serving behavior.',
      ],
    },
    {
      heading: 'State space model in plain terms',
      paragraphs: [
        'A state space model carries a hidden state through a sequence. At each token, the layer updates the state and emits an output. In the simplest mental model, the new state is a transformed old state plus a transformed input, and the output reads from the state. Classical SSM research made this stable and efficient for long signals. Mamba added input-dependent selectivity, so the token can influence what the state keeps, forgets, or writes.',
        'The serving appeal is obvious. During autoregressive decode, a Transformer stores key and value rows for many old tokens. An SSM-style layer can carry a fixed or compact state instead. But the cost is also obvious. The old tokens are no longer exactly present as rows that a query can inspect. Their information has been compressed into state. The article is about when that compression has structure strong enough to reason about and kernels fast enough to matter.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The SSD insight is that a sequence transformation can be represented in two equivalent ways. In recurrent form, each token updates a state and reads from it. In matrix form, the output sequence is produced by multiplying the input sequence by a structured lower-triangular matrix. Causal attention also produces a lower-triangular interaction pattern, but full attention usually stores or computes many pairwise interactions. SSD restricts the interaction matrix so far interactions can be represented through compact factors.',
        'That restricted matrix is semiseparable. You do not need to store every old-token to new-token interaction independently. Near interactions can be handled in local blocks. Far interactions can pass through summaries. This is the bridge: the recurrence proves there is a compact state path, and the matrix view gives a way to schedule blocks in parallel.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The SSD duality view shows the same layer through two lenses. The SSM side is the streaming story: tokens update state. The attention-like side is the matrix story: tokens interact through a causal transformation. The semiseparable node is the important one because it explains why these are not disconnected metaphors. The structure is what lets the two views agree.',
        'The chunked-kernel view shows how the math becomes a GPU plan. Local blocks can be processed in parallel. Each block emits a summary. Summaries are scanned to carry state across block boundaries. A fixup step adds cross-block history to local outputs. The lesson is that a fast sequence layer is both a memory representation and a schedule. If either side is weak, the model claim is incomplete.',
      ],
    },
    {
      heading: 'The main data structures',
      paragraphs: [
        'The recurrent state is the compact memory carried from token to token. It is the structure that makes streaming cheap. The semiseparable matrix is the global view of that same transformation over the whole sequence. It exposes which interactions are direct, which are local, and which can pass through factors. Block summaries are the compact records that let chunks communicate without materializing a full all-pairs table.',
        'The kernel adds more concrete structures: tile buffers for local work, prefix-scan carries for block-to-block state, saved tensors for the backward pass, and shape metadata that decides which specialized path runs. These are not minor implementation details. A layer that is elegant on paper can lose if it spills too much state, chooses poor tile sizes, or forces serial work where the GPU wants parallel blocks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a sequence of 8192 tokens and split it into blocks of 256. Inside each block, the kernel can compute local contributions with parallel matrix-like work. That gives fast use of accelerator cores and memory locality. But token 5000 still needs history from token 1000. The block cannot pretend older blocks do not exist.',
        'So each block produces a state summary: a compact description of how it transforms incoming state and what state it contributes. The summaries are combined with a prefix scan. After the scan, each block knows the incoming state produced by all previous blocks. A fixup pass uses that incoming state to correct the local outputs. The result matches the recurrent interpretation while avoiding a naive token-by-token serial loop during training.',
        'This is the same idea as many data-structure decompositions. Do expensive local work in chunks, summarize each chunk, scan the summaries, then repair local answers with the global prefix. Segment trees, parallel prefix sums, and blocked dynamic programs all use the same shape. Mamba-2 applies it to structured sequence memory.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works when the semiseparable structure is expressive enough for the task. The model does not store every pairwise interaction. It stores a structured transformation where far history travels through factors and state. If the needed information can be represented by that state, the layer can capture long-range effects with less memory and less work than full attention.',
        'It also works because the two views can be used where each is strongest. The recurrence view is natural for streaming inference: update state and emit the next output. The matrix and chunk view is natural for training: process many positions in parallel and use scans to carry history. Duality gives one mathematical contract behind both execution modes.',
        'The word "duality" should not be read as magic. It is a proof obligation. Short-sequence tests should show that the recurrent path and the chunked matrix path agree within numerical tolerance. Kernel benchmarks should show that the schedule actually wins at target lengths and batch sizes. Quality tests should show that the compressed memory does not drop information the product needs.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The cost model has several layers. Arithmetic is only one. Memory traffic, tile shape, scan overhead, synchronization, saved backward state, precision policy, and dispatch overhead all matter. Full attention has a large cost, but it also has extremely mature kernels. A new SSD kernel has to beat the real baseline, not a slow straw version of attention.',
        'The memory tradeoff is compressed history. A Transformer KV cache stores exact key and value rows for prior tokens in attention layers. SSD-style state stores a structured summary. That can reduce decode memory and improve long-context economics. It can also fail on tasks that need exact copying, rare-token recall, long code references, or quoting from a distant passage. The compressed state may know the topic but lose the exact string.',
        'Training adds another tradeoff. Scans and chunk fixups must be stable under mixed precision, long sequences, and backpropagation. The backward pass may need saved intermediate values or recomputation. A layer that looks cheap in the forward pass can become expensive once gradients, activation memory, and compiler constraints are included.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Mamba-2 style layers are attractive when sequence length is high, full attention is a major cost, and the task can use structured memory instead of exact access to every prior token. Streaming signals, long documents with broad context, genomics, time series, audio, and long-running generation are natural places to investigate. They are also attractive for edge or high-concurrency serving where cache bytes are the hard limit.',
        'The most practical use may be hybrid architecture. Some layers can preserve exact attention for local and retrieval-sensitive behavior, while other layers carry compressed long-range state. That turns architecture into a budget: how many exact attention layers, how many recurrent or SSD layers, what state size, what context length, and what quality gates. Hybrid Attention State Budget Case Study exists for exactly that reason.',
        'Educationally, Mamba-2 wins because it refuses to separate math from systems. The same topic requires linear algebra, sequence modeling, parallel prefix scans, GPU memory behavior, and evaluation discipline. A reader who understands SSD understands why modern model architecture is also data-structure design.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not read Mamba-2 as proof that attention is obsolete. Attention remains strong because exact token memory is useful and the ecosystem is mature. Tasks that require exact retrieval, precise citation, code-span copying, tool-call trace replay, or rare-token preservation may punish compressed state. Retrieval systems and attention layers can still be the right answer.',
        'It also fails when the evidence is incomplete. A perplexity win does not prove long-context retrieval quality. A throughput win at one batch shape does not prove p99 latency under production traffic. A result from a custom kernel on one GPU does not prove portability. A short-context benchmark does not prove the long-context behavior that motivated the architecture.',
        'Finally, implementation complexity is real. Custom kernels, scan correctness, shape specialization, numerical drift, and backward-pass memory all create maintenance cost. A team should not adopt SSD layers just because the asymptotic curve looks better. It should adopt them when the measured workload needs their memory form and the implementation is trustworthy.',
      ],
    },
    {
      heading: 'Adoption checklist',
      paragraphs: [
        'A serious adoption packet starts with equivalence. Run the recurrent and chunked paths on short sequences where a dense or reference implementation is possible. Check forward outputs and gradients under the precision policy that training and serving will use. Then benchmark the kernel across context lengths, batch sizes, hidden sizes, and hardware targets. Include compile time and fallback paths.',
        'Next comes quality. Test perplexity, long-context retrieval, code, exact copying, summarization, reasoning traces, and any product-specific safety or citation slice. Keep the slices separate. A model can improve average language modeling while getting worse on the one behavior the product sells.',
        'Finally test serving. Measure time to first token, time per output token, p50, p95, p99, memory per active sequence, batch interaction, cache behavior, and route fallback. If the layer is part of a hybrid model, measure the whole stack. The correct decision is a ledger of tradeoffs, not a claim that one architecture family has defeated another.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality at https://arxiv.org/abs/2405.21060, the state-spaces Mamba repository at https://github.com/state-spaces/mamba, and Tri Dao SSD notes at https://tridao.me/blog/2024/mamba2-part1-model/.',
        'Study Selective State Space Models: Mamba for the predecessor idea, Attention Mechanism and KV Cache for the exact-memory baseline, Linear Attention Prefix-State Primer for the prefix-state family, Fast Weight Delta-Rule Memory Case Study for write/update memory, RetNet Retention State Case Study for decay-weighted recurrent state, Kimi Linear Attention for hybrid efficient attention, Hybrid Attention State Budget Case Study for architecture budgeting, Sequence Memory Evaluation Ledger Case Study for benchmark discipline, and Transformer Inference Roofline for the serving bottleneck.',
      ],
    },
  ],
};
