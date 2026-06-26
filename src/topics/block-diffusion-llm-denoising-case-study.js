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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as generation by repair instead of generation by one-token extension. A token is a small text unit, and a block is a group of token positions decoded together. The active block contains masked or noisy positions, and each denoising step makes those positions more certain.',
        'The safe inference rule is that a token should become fixed only when the model and schedule agree that it is confident enough. Earlier positions are not automatically more important than later positions. The animation is showing certainty spreading through a block, not a cursor moving left to right.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Standard large language models usually generate text autoregressively, meaning each new token depends on all previous tokens and is produced one at a time. That gives a clean probability factorization, but it makes long output latency grow with the number of generated tokens. A 200-token answer requires about 200 sequential decoding steps.',
        'Block diffusion exists to reduce that strict sequence. It asks whether a model can fill or refine several positions in a block through denoising, which means removing uncertainty from a noisy or masked state. If enough positions can be decided per step, the system can trade more computation per step for fewer sequential steps.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep autoregressive decoding and optimize it. Use key-value cache reuse, batching, faster attention kernels, speculative decoding, or better serving hardware. That approach is strong because it preserves the training and inference contract used by most deployed LLMs.',
        'It still has a serial wall. Even if each step is fast, token 120 cannot be finalized before token 119 exists. Hardware likes parallel work, but the decoding dependency chain exposes only a small amount of work at each position.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is sequential latency. If one decode step takes 20 ms, then 200 generated tokens take about 4 seconds before batching overhead and queueing. Cutting the step to 10 ms still leaves 2 seconds because the number of dependent steps did not change.',
        'A second wall is error control. Filling many positions at once can create inconsistent text if later positions assume a word that earlier positions change. The model needs a schedule for which positions are tentative, which are fixed, and when a block is ready to emit.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace the single moving frontier with a block-level uncertainty state. Instead of asking for exactly the next token, the model predicts or refines many masked positions and then commits the most reliable ones. The core object is no longer just a prefix; it is a partially resolved block.',
        'This borrows the diffusion idea from generative modeling. Start with noise or masks, apply a learned denoising function repeatedly, and move toward a clean sample. For text, the hard part is that tokens are discrete, so confidence and commitment policy matter as much as the neural network.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The decoder chooses a block size, masks or initializes unresolved positions, and runs a denoising model over the block with context from the prompt and already accepted text. Each pass produces token distributions, which are probability scores over vocabulary items. A scheduler decides which positions to lock and which positions to revisit.',
        'The system repeats until the block is complete, then emits the block or a safe prefix of it. Some designs use confidence thresholds, some use a fixed number of denoising rounds, and some remask low-confidence positions. The serving problem is to keep quality close to autoregressive decoding while reducing the number of sequential barriers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is not exact equality with autoregressive sampling. It is an invariant over commitment: once a position is emitted to the user, later denoising rounds cannot require changing it. If the model only commits positions whose local and contextual scores pass the policy, the output stream remains consistent with its own committed prefix.',
        'Within an uncommitted block, revision is allowed. That is why the method can exploit parallelism: uncertain positions can influence each other across denoising rounds before any of them become public. The algorithm is safe only to the extent that the confidence rule separates stable choices from guesses.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'If autoregressive decoding emits 128 tokens with one model pass per token, it needs 128 sequential passes. A block method with block size 16 and 4 denoising rounds per block needs 8 blocks times 4 rounds, or 32 sequential passes. Each pass may be heavier because it predicts many positions, but the latency chain is shorter.',
        'The memory cost includes activations and attention over unresolved block positions, plus ordinary key-value cache for accepted context if the architecture uses it. Doubling block size can expose more parallel work, but it can also increase per-pass compute and make confidence harder. The practical cost is tuning the block size, denoising rounds, and commit rule for each quality target.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The idea fits low-latency text generation research, assisted drafting, batch offline generation, and systems that can tolerate a different sampling contract for speed. It is also useful as a mental model for masked language modeling, edit-based generation, and non-autoregressive translation. The access pattern is refine a group, commit the stable part, then continue.',
        'It is less natural for APIs that require exact compatibility with a deployed autoregressive model. Many production stacks depend on token-by-token streaming, logprob semantics, tool-call boundaries, and cache behavior. A block diffusion model changes those contracts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when confidence is badly calibrated. Locking weak tokens early can force later text into awkward repairs, while revising too much can erase the latency benefit. The method needs a commit policy that is conservative enough for quality and aggressive enough for speed.',
        'It also fails when the task has tight left-to-right constraints. Code, JSON, tool calls, citations, and exact arithmetic often punish one wrong early token. For those tasks, autoregressive decoding or constrained decoding may be easier to validate.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a 64-token response and a baseline decode cost of 18 ms per token. Autoregressive latency is about 64 times 18 ms, or 1,152 ms before queueing. A block method uses block size 8 and 3 denoising rounds, so it needs 8 blocks times 3 rounds, or 24 sequential passes.',
        'If each block pass costs 28 ms because it predicts 8 positions, total model latency is about 672 ms. That is a 480 ms improvement, but only if the commit policy preserves quality. If the system needs 6 rounds per block to avoid bad tokens, latency rises to 1,344 ms and the method loses to the baseline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources to study next are diffusion model papers, masked language modeling work, non-autoregressive translation papers, and current block-diffusion language-model papers. Compare their training objective, sampling schedule, and commitment rule. Do not treat the word diffusion as enough; the mechanism depends on how discrete tokens are noised and denoised.',
        'Study next by role: autoregressive decoding for the baseline, speculative decoding for another latency trade, KV cache for prefix reuse, masked language models for bidirectional prediction, and constrained decoding for correctness-sensitive outputs. The transfer lesson is that latency is shaped by dependency depth, not only by raw FLOPs.',
      ],
    },
  ],
};
