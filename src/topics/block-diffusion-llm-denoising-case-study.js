// Block diffusion bridges autoregressive generation and diffusion refinement:
// decode blocks in order, denoise several tokens inside each block in parallel.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'block-diffusion-llm-denoising-case-study',
  title: 'Block Diffusion LLM Denoising Case Study',
  category: 'AI & ML',
  summary: 'A case study for block diffusion language models: autoregressive block order, masked denoising inside each block, flexible length, KV reuse, and speed-quality routing.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['block sampler', 'length bridge'], defaultValue: 'block sampler' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function blockGraph(title) {
  return graphState({
    nodes: [
      { id: 'prefix', label: 'prefix', x: 0.6, y: 3.6, note: 'fixed' },
      { id: 'b1', label: 'B1', x: 2.4, y: 2.0, note: 'done' },
      { id: 'b2', label: 'B2', x: 4.3, y: 3.6, note: 'denoise' },
      { id: 'b3', label: 'B3', x: 6.2, y: 5.1, note: 'future' },
      { id: 'kv', label: 'KV', x: 4.3, y: 1.2, note: 'block' },
      { id: 'gate', label: 'gate', x: 6.6, y: 2.7, note: 'commit' },
      { id: 'eos', label: 'EOS', x: 7.2, y: 3.7, note: '' },
      { id: 'score', label: 'score', x: 7.7, y: 5.5, note: 'qual' },
    ],
    edges: [
      { id: 'e-prefix-b1', from: 'prefix', to: 'b1', weight: 'AR' },
      { id: 'e-b1-b2', from: 'b1', to: 'b2', weight: 'next block' },
      { id: 'e-b2-b3', from: 'b2', to: 'b3', weight: 'advance' },
      { id: 'e-b1-kv', from: 'b1', to: 'kv', weight: 'cache' },
      { id: 'e-kv-b2', from: 'kv', to: 'b2', weight: 'reuse' },
      { id: 'e-b2-gate', from: 'b2', to: 'gate', weight: 'slots' },
      { id: 'e-gate-eos', from: 'gate', to: 'eos', weight: 'stop' },
      { id: 'e-b3-score', from: 'b3', to: 'score', weight: 'eval' },
      { id: 'e-gate-score', from: 'gate', to: 'score', weight: 'ledger' },
    ],
  }, { title });
}

function* blockSampler() {
  yield {
    state: blockGraph('Autoregressive across blocks, diffusion inside a block'),
    highlight: { active: ['prefix', 'b1', 'b2', 'e-prefix-b1', 'e-b1-b2'], found: ['kv', 'gate'], compare: ['b3'] },
    explanation: 'Block diffusion keeps an ordered sequence of blocks, but each active block is denoised with masked diffusion. That gives the model a bridge between flexible-length autoregressive generation and parallel token refinement.',
    invariant: 'Block order is causal; token order inside the current block can be denoising-based.',
  };

  yield {
    state: labelMatrix(
      'Active block denoising schedule',
      [
        { id: 'tok1', label: 'b2.1' },
        { id: 'tok2', label: 'b2.2' },
        { id: 'tok3', label: 'b2.3' },
        { id: 'tok4', label: 'b2.4' },
      ],
      [
        { id: 's0', label: 's0' },
        { id: 's1', label: 's1' },
        { id: 's2', label: 's2' },
        { id: 's3', label: 's3' },
      ],
      [
        ['[M]', 'return', 'return', 'return'],
        ['[M]', '[M]', 'user', 'user'],
        ['[M]', 'profile', 'profile', 'profile'],
        ['[M]', '[M]', '[M]', ';'],
      ],
    ),
    highlight: { active: ['tok1:s1', 'tok3:s1'], found: ['tok2:s2'], compare: ['tok4:s3'] },
    explanation: 'Within the active block, the sampler can reveal several high-confidence tokens before the entire block is complete. The block is not released downstream until its policy says the remaining uncertainty is acceptable.',
  };

  yield {
    state: labelMatrix(
      'Block ledger',
      [
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' },
        { id: 'b3', label: 'B3' },
        { id: 'b4', label: 'B4' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'kv', label: 'KV' },
        { id: 'stop', label: 'stop' },
      ],
      [
        ['sealed', 'reuse', 'no'],
        ['active', 'approx', 'check'],
        ['future', 'none', 'no'],
        ['future', 'none', 'maybe'],
      ],
    ),
    highlight: { active: ['b1:kv', 'b2:state', 'b2:kv'], found: ['b2:stop'], compare: ['b3:state', 'b4:stop'] },
    explanation: 'A production implementation needs a block ledger: which blocks are sealed, which block is active, whether its cache can be reused, and whether an end-of-sequence decision is allowed.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'block size', min: 1, max: 20 }, y: { label: 'relative score', min: 0, max: 100 } },
      series: [
        { id: 'parallel', label: 'par', points: [{ x: 1, y: 10 }, { x: 2, y: 24 }, { x: 4, y: 48 }, { x: 8, y: 76 }, { x: 16, y: 92 }] },
        { id: 'quality', label: 'quality', points: [{ x: 1, y: 95 }, { x: 2, y: 93 }, { x: 4, y: 90 }, { x: 8, y: 82 }, { x: 16, y: 68 }] },
        { id: 'cache', label: 'cache', points: [{ x: 1, y: 96 }, { x: 2, y: 90 }, { x: 4, y: 78 }, { x: 8, y: 60 }, { x: 16, y: 42 }] },
      ],
      markers: [
        { id: 'knee', x: 4, y: 90, label: 'knee' },
      ],
    }),
    highlight: { active: ['parallel', 'quality', 'knee'], compare: ['cache'] },
    explanation: 'Block size is the main knob. Larger blocks expose more parallel token work but make dependency errors and cache reuse harder. The useful operating point is usually a measured knee, not the largest block possible.',
  };
}

function* lengthBridge() {
  yield {
    state: labelMatrix(
      'Why blocks help length',
      [
        { id: 'fixed', label: 'fixed seq' },
        { id: 'semi', label: 'semi-AR' },
        { id: 'eos', label: 'EOS gate' },
        { id: 'stream', label: 'stream' },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'block', label: 'block fix' },
      ],
      [
        ['preset length', 'add blocks'],
        ['too serial', 'slot denoise'],
        ['late stop', 'block stop'],
        ['wait all', 'seal blocks'],
      ],
    ),
    highlight: { active: ['semi:block', 'eos:block', 'stream:block'], compare: ['fixed:problem'] },
    explanation: 'Plain sequence-level diffusion can be awkward for arbitrary-length generation. Blocks let the system grow the sequence one chunk at a time while still using diffusion inside each chunk.',
  };

  yield {
    state: blockGraph('Sealed blocks can be streamed while future blocks denoise'),
    highlight: { active: ['b1', 'kv', 'b2', 'gate', 'e-b1-kv', 'e-kv-b2'], found: ['eos'], compare: ['b3'] },
    explanation: 'Once a block is sealed, the runtime can stream it or reuse its state while the next block is being denoised. This is the serving bridge that makes block diffusion less like fixed-length offline generation.',
  };

  yield {
    state: labelMatrix(
      'Code edit case',
      [
        { id: 'ctx', label: 'ctx' },
        { id: 'b2', label: 'B2' },
        { id: 'gate', label: 'G' },
      ],
      [
        { id: 'payload', label: 'payload' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['function sig', 'fixed'],
        ['.profile', 'active'],
        ['EOS prob', 'length'],
      ],
    ),
    highlight: { active: ['ctx:payload', 'b2:risk'], found: ['gate:risk'], compare: ['gate:payload'] },
    explanation: 'For a code edit, the prefix is fixed, the first generated block is sealed, the second block is actively denoised, and the stop gate decides whether another block is needed. The ledger makes the length decision inspectable.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'deps', label: 'deps' },
        { id: 'cache', label: 'cache' },
        { id: 'eos', label: 'EOS' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['bad agreement', 'smaller block'],
        ['stale state', 'version id'],
        ['early stop', 'threshold'],
        ['step skew', 'bucket'],
      ],
    ),
    highlight: { active: ['deps:fix', 'cache:fix', 'batch:fix'], compare: ['eos:symptom'] },
    explanation: 'Block diffusion needs operational guardrails. Dependency breaks want smaller blocks or stricter confidence gates. Cache reuse needs versioned block state. Batching needs requests grouped by similar denoise step and block size.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'block sampler') yield* blockSampler();
  else if (view === 'length bridge') yield* lengthBridge();
  else throw new InputError('Pick a block diffusion view.');
}

export const article = {
  references: [
    { title: 'Block Diffusion: Interpolating Between Autoregressive and Diffusion Language Models', url: 'https://arxiv.org/abs/2503.09573' },
    { title: 'Discrete Diffusion Language Model Primer', url: '#discrete-diffusion-language-model-primer' },
    { title: 'Fast-dLLM Project', url: 'https://nvlabs.github.io/Fast-dLLM/' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Block diffusion language modeling is a hybrid generation scheme. It is autoregressive across blocks of tokens, but it uses masked diffusion or iterative denoising inside the current block.', 'This makes it a useful bridge between two systems worlds already covered in this curriculum: Diffusion Models explain iterative denoising, while KV Cache and Speculative Decoding explain why ordinary LLM serving is optimized around left-to-right prefixes.'] },
    { heading: 'Data structures', paragraphs: ['The core runtime state is a block ledger. Each row records a block id, token buffer, mask bitset, denoise step, confidence summary, cache version, sealed/unsealed state, and stop eligibility.', 'The model also needs a causal boundary between blocks. Past blocks can condition future blocks, but tokens inside the active block are refined together. That boundary is what makes flexible-length generation and cache reuse possible.'] },
    { heading: 'How it works', paragraphs: ['Generation starts with a prefix and an empty active block. The sampler fills the block with masks, runs several denoising passes, commits confident slots, seals the block, then advances to the next block. An end-of-sequence gate decides whether another block should be opened.', 'The block size controls the tradeoff. A size of one is close to autoregressive decoding. Larger blocks expose more parallel work but increase dependency risk and make cache reuse harder.'] },
    { heading: 'Complete case study', paragraphs: ['A code assistant is completing `return user.profile;`. The first block seals `return user`; the second block denoises `.profile`; the stop gate then decides whether to emit `;` or continue into another block. The system logs block size, steps, committed tokens per step, and final quality.', 'When the same endpoint handles prose, code, and JSON, the router can choose smaller blocks for brittle syntax and larger blocks for predictable boilerplate. The block ledger makes that choice auditable.'] },
    { heading: 'Costs and tradeoffs', paragraphs: ['Block diffusion can improve throughput if multiple tokens per block commit in a few denoise passes. It can lose if dependency violations force remasking, if the cache cannot be reused, or if heterogeneous requests create poor GPU batches.', 'Serving should measure sealed tokens per forward pass, remask rate, block cache hit rate, p99 latency, stop-gate false positives, and quality by task class.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not sell block diffusion as free parallelism. It is a control problem: block size, confidence gates, stop rules, cache versions, and batch buckets all decide whether the theory becomes actual latency improvement.', 'A second pitfall is hidden fixed-length behavior. If the end-of-sequence gate is weak, the system can either stop too early or keep adding low-value blocks. Length control must be explicit.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Block Diffusion at https://arxiv.org/abs/2503.09573 and Fast-dLLM at https://nvlabs.github.io/Fast-dLLM/. Study Discrete Diffusion Language Model Primer, KV Cache, Speculative Decoding Runtime Controller, Length-Aware Batching LLM Scheduler, and Diffusion LLM Serving Scheduler next.'] },
  ],
};
