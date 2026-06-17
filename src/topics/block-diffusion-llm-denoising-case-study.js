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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive LLMs are easy to serve because they grow text left to right. The prefix is fixed, the KV cache is reusable, and the model can stop at an end token. The cost is serial generation: one token decision depends on the previous token decision.',
        'Discrete diffusion language models offer a different promise. They can refine several masked tokens in parallel and can revise uncertain positions. The cost is that plain diffusion is awkward for arbitrary-length text, streaming, and cache-based serving. Block diffusion exists to bridge those two worlds.',
      ],
    },
    {
      heading: 'The baseline approach',
      paragraphs: [
        'The first baseline is ordinary autoregressive decoding. It handles length naturally: keep sampling the next token until the model emits EOS or a max-token limit fires. Serving systems are built around this pattern, especially KV-cache reuse.',
        'The second baseline is full-sequence discrete diffusion. It starts with a masked or noisy sequence and repeatedly denoises positions. That can expose parallel token work, but it usually assumes a fixed or preselected sequence length and does not stream prefixes as naturally as autoregressive decoding.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Autoregressive decoding hits a latency wall because the dependency chain is token by token. Even if every forward pass is efficient, the request still waits for many sequential decisions.',
        'Plain diffusion hits a product wall. Text length is not known upfront, users expect streaming, and serving infrastructure wants stable prefixes and cache reuse. A model that denoises a whole fixed-length canvas can be hard to fit into an LLM endpoint.',
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        'Block diffusion decomposes a sequence into blocks. The model is autoregressive across blocks: block 1 conditions block 2, block 2 conditions block 3, and so on. Inside the active block, tokens are generated by masked denoising rather than strict left-to-right decoding.',
        'The runtime state is a block ledger. Each row records the block id, token buffer, mask bitset, denoise step, confidence summary, cache version, sealed or active status, and stop eligibility. Sealed blocks become the fixed prefix for later blocks.',
        'Block size is the interpolation knob. A block size of one behaves close to autoregressive decoding. Larger blocks move toward diffusion-style parallel refinement, but they also make within-block dependencies harder.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The causal boundary between blocks keeps the serving contract readable. Past blocks are fixed. Future blocks do not exist yet. The active block is the only region where uncertainty is being refined.',
        'That boundary allows cache reuse and flexible length. Once a block is sealed, its state can condition later blocks much like an autoregressive prefix. An EOS or stop gate decides whether another block should be opened, so the model is not trapped in a fixed-length canvas.',
        'Inside the active block, parallel denoising can reveal several high-confidence tokens per model evaluation. The speed gain comes only when the system seals useful tokens faster than a token-by-token decoder would.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The block-sampler view is a serving trace, not just a model diagram. Prefix and sealed blocks are stable context. The active block is a controlled uncertainty zone. The gate is the policy that decides when uncertainty is low enough to commit tokens, stream output, reuse cache, or open the next block.',
        'The length-bridge view shows the product reason for the design. Full-sequence diffusion wants a canvas. Chat and code endpoints want a response that can grow, stream, and stop. Blocks make length a sequence of local commitments rather than one global guess made before generation starts.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost variables are block size, denoising steps per block, remasking rate, cache reuse, and batching quality. Larger blocks expose more parallel work, but they can require more refinement steps and create more disagreement among tokens.',
        'A useful serving metric is sealed tokens per forward pass. If a block of eight tokens needs eight denoising passes and frequent repair, it may not beat autoregressive decoding. If a block of four seals in two passes with stable quality, the endpoint has a real latency path.',
        'Batching is harder than it looks. Requests with different block sizes, denoise steps, and stop states can fragment GPU batches. Production systems need buckets, confidence thresholds, and cache-version checks rather than a single global block size.',
      ],
    },
    {
      heading: 'Operational router',
      paragraphs: [
        'A practical service would not use one block policy for every request. The router should choose block size and denoise budget from task shape, latency target, syntax risk, and observed repair rate. Predictable prose can tolerate larger blocks. Code, JSON, SQL, and math often need smaller blocks because one early token can constrain many later tokens.',
        'The router also needs fallback behavior. If confidence stays low, if the EOS gate is unstable, or if the active block keeps being remasked, the system should shrink the block, spend more denoising steps, or route the request to a standard autoregressive decoder. Without that escape path, the method can turn a speed feature into a quality failure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Block diffusion is promising when text has local chunks that can be refined together. Boilerplate, predictable code fragments, structured completions, and some editing tasks can benefit from denoising several slots inside the same block.',
        'It also fits routes that value controllability or revision inside a small span. A code assistant, for example, may want to refine the current expression while keeping the already emitted prefix fixed.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Block diffusion is weak when the active block contains tight left-to-right dependencies. Syntax, quotes, brackets, variable names, and long-range references can make early token commitments expensive to repair.',
        'A weak EOS gate creates hidden fixed-length behavior. The model may stop too early, keep adding low-value blocks, or learn length patterns from training buckets rather than the prompt.',
        'Cache reuse can also become stale. If the active block is revised after a cache was built, the cache needs a version id. Otherwise later blocks may condition on a prefix that is no longer the real prefix.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        'Suppose a code assistant must complete `return user.profile;`. The sealed prefix contains `return user`. The active block starts with masks for `.profile`. Denoising fills several slots, the confidence gate seals the block, and the stop gate decides whether the semicolon finishes the sequence.',
        'The router can use smaller blocks for brittle code or JSON and larger blocks for predictable prose or boilerplate. The block ledger makes that choice inspectable: block size, steps, committed tokens per step, remasks, cache hits, stop decisions, and final quality all live in one record.',
      ],
    },
    {
      heading: 'Evaluation questions',
      paragraphs: [
        'The serious evaluation question is not whether the sampler is more parallel on paper. Ask how many accepted tokens arrive per forward pass at the same quality, how often sealed blocks need repair, how much batching fragmentation appears under live traffic, and whether users see useful streaming latency.',
        'A good benchmark should split tasks by dependency shape. JSON, code, math, long-form prose, and templated boilerplate stress different parts of the design. If one average score hides that block diffusion wins on boilerplate but fails on syntax-heavy completions, the serving router will learn the wrong lesson.',
        'Also measure recovery, not just first-pass output. A block method can look fast until it has to repair bad commitments, undo an early stop, or regenerate a block whose cache version no longer matches the sealed prefix.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Block Diffusion at https://arxiv.org/abs/2503.09573, the project page at https://m-arriola.com/bd3lms/, and the BD3-LMs code at https://github.com/kuleshov-group/bd3lms. Fast-dLLM is a related project at https://nvlabs.github.io/Fast-dLLM/.',
        'Study Discrete Diffusion Language Model Primer, Diffusion Models, KV Cache, Speculative Decoding Runtime Controller, Length-Aware Batching LLM Scheduler, and Diffusion LLM Serving Scheduler next. The key comparison is sealed tokens per forward pass, not whether the diagram contains parallel arrows.',
      ],
    },
  ],
};
