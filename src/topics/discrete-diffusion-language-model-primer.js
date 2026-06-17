// Discrete diffusion language models generate text by masking tokens, then
// repeatedly predicting and committing confident positions in parallel.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'discrete-diffusion-language-model-primer',
  title: 'Discrete Diffusion Language Model Primer',
  category: 'AI & ML',
  summary: 'A masked-diffusion primer for language: corruption schedules, [MASK] states, parallel denoising, remasking, confidence gates, and non-left-to-right generation.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['mask corruption', 'parallel denoise'], defaultValue: 'mask corruption' },
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

const TOKEN_ROWS = [
  { id: 'p1', label: '1' },
  { id: 'p2', label: '2' },
  { id: 'p3', label: '3' },
  { id: 'p4', label: '4' },
  { id: 'p5', label: '5' },
  { id: 'p6', label: '6' },
];

function diffusionGraph(title) {
  return graphState({
    nodes: [
      { id: 'prompt', label: 'prompt', x: 0.6, y: 3.6, note: 'fixed' },
      { id: 'mask', label: 'mask buf', x: 2.4, y: 2.0, note: 'slots' },
      { id: 'time', label: 't', x: 2.4, y: 5.0, note: 'noise' },
      { id: 'denoise', label: 'denoise', x: 4.6, y: 3.6, note: 'Transformer' },
      { id: 'logits', label: 'logits', x: 6.6, y: 2.2, note: 'per slot' },
      { id: 'gate', label: 'gate', x: 6.6, y: 5.0, note: 'conf' },
      { id: 'commit', label: 'commit', x: 8.4, y: 3.6, note: 'tokens' },
      { id: 'remask', label: 'remask', x: 4.6, y: 1.1, note: 'hard' },
    ],
    edges: [
      { id: 'e-prompt-mask', from: 'prompt', to: 'mask' },
      { id: 'e-mask-denoise', from: 'mask', to: 'denoise' },
      { id: 'e-time-denoise', from: 'time', to: 'denoise' },
      { id: 'e-denoise-logits', from: 'denoise', to: 'logits' },
      { id: 'e-logits-gate', from: 'logits', to: 'gate' },
      { id: 'e-gate-commit', from: 'gate', to: 'commit' },
      { id: 'e-gate-remask', from: 'gate', to: 'remask' },
      { id: 'e-remask-mask', from: 'remask', to: 'mask' },
    ],
  }, { title });
}

function* maskCorruption() {
  yield {
    state: labelMatrix(
      'Forward process: tokens become masks',
      TOKEN_ROWS,
      [
        { id: 'x0', label: 'x0' },
        { id: 't25', label: 't=.25' },
        { id: 't60', label: 't=.60' },
        { id: 't95', label: 't=.95' },
      ],
      [
        ['The', 'The', '[M]', '[M]'],
        ['model', '[M]', '[M]', '[M]'],
        ['fills', 'fills', 'fills', '[M]'],
        ['many', '[M]', '[M]', '[M]'],
        ['slots', 'slots', '[M]', '[M]'],
        ['together', '[M]', '[M]', '[M]'],
      ],
    ),
    highlight: { active: ['p2:t25', 'p4:t25', 'p6:t25'], compare: ['p1:x0', 'p3:x0', 'p5:x0'], found: ['p1:t95', 'p6:t95'] },
    explanation: 'A discrete diffusion language model corrupts text by replacing tokens with a special mask state. The schedule controls how many positions are hidden at each noise level, so training can ask the model to recover tokens from many partial contexts.',
    invariant: 'The forward corruption is fixed; the learned model only parameterizes the reverse denoising distribution.',
  };

  yield {
    state: diffusionGraph('Masked language diffusion is a state machine'),
    highlight: { active: ['prompt', 'mask', 'time', 'denoise', 'e-prompt-mask', 'e-time-denoise'], found: ['logits'] },
    explanation: 'The runtime state is a prompt, a mutable token buffer, a mask bitset, and a timestep or noise level. The Transformer reads bidirectional context over the visible tokens and predicts every masked slot at once.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'reverse step', min: 0, max: 8 }, y: { label: 'fraction', min: 0, max: 1 } },
      series: [
        { id: 'masked', label: 'mask', points: [{ x: 0, y: 1.0 }, { x: 1, y: 0.82 }, { x: 2, y: 0.64 }, { x: 3, y: 0.49 }, { x: 4, y: 0.34 }, { x: 5, y: 0.22 }, { x: 6, y: 0.12 }, { x: 7, y: 0.04 }, { x: 8, y: 0.0 }] },
        { id: 'visible', label: 'visible', points: [{ x: 0, y: 0.0 }, { x: 1, y: 0.18 }, { x: 2, y: 0.36 }, { x: 3, y: 0.51 }, { x: 4, y: 0.66 }, { x: 5, y: 0.78 }, { x: 6, y: 0.88 }, { x: 7, y: 0.96 }, { x: 8, y: 1.0 }] },
      ],
      markers: [
        { id: 'mid', x: 4, y: 0.66, label: 'half' },
      ],
    }),
    highlight: { active: ['masked', 'visible', 'mid'] },
    explanation: 'Sampling gradually trades masked positions for visible tokens. Unlike an autoregressive decoder, the next committed token does not have to be the immediate next position from the left.',
  };

  yield {
    state: labelMatrix(
      'Primer map',
      [
        { id: 'bitset', label: 'mask bits' },
        { id: 'time', label: 'time id' },
        { id: 'logit', label: 'logits' },
        { id: 'conf', label: 'conf' },
        { id: 'carry', label: 'carry' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['hidden slots', 'state'],
        ['noise level', 'schedule'],
        ['vocab dist', 'recover'],
        ['margin', 'commit'],
        ['visible tok', 'stable'],
      ],
    ),
    highlight: { active: ['bitset:stores', 'time:stores', 'conf:why'], found: ['carry:why'] },
    explanation: 'The core data structures are ordinary and important: a mask bitset, a token buffer, a timestep, per-position logits, confidence scores, and a carry-over rule for positions that are already visible.',
  };
}

function* parallelDenoise() {
  yield {
    state: labelMatrix(
      'Reverse denoising commits confident slots',
      TOKEN_ROWS,
      [
        { id: 's0', label: 'step0' },
        { id: 's1', label: 'step1' },
        { id: 's2', label: 'step2' },
        { id: 's3', label: 'step3' },
      ],
      [
        ['[M]', 'The', 'The', 'The'],
        ['[M]', '[M]', 'model', 'model'],
        ['[M]', 'fills', 'fills', 'fills'],
        ['[M]', '[M]', '[M]', 'many'],
        ['[M]', 'slots', 'slots', 'slots'],
        ['[M]', '[M]', 'together', 'together'],
      ],
    ),
    highlight: { active: ['p1:s1', 'p3:s1', 'p5:s1'], found: ['p2:s2', 'p6:s2'], compare: ['p4:s3'] },
    explanation: 'A diffusion sampler can reveal several positions in one pass when their confidence is high. Harder positions remain masked until later context makes them easier to recover.',
    invariant: 'Parallel commitment is useful only when the committed tokens remain mutually consistent.',
  };

  yield {
    state: labelMatrix(
      'Confidence ledger',
      [
        { id: 'p1', label: 'slot1' },
        { id: 'p2', label: 'slot2' },
        { id: 'p3', label: 'slot3' },
        { id: 'p4', label: 'slot4' },
        { id: 'p5', label: 'slot5' },
        { id: 'p6', label: 'slot6' },
      ],
      [
        { id: 'top', label: 'top' },
        { id: 'margin', label: 'margin' },
        { id: 'act', label: 'act' },
      ],
      [
        ['The', '.42', 'commit'],
        ['model', '.08', 'mask'],
        ['fills', '.37', 'commit'],
        ['many', '.05', 'mask'],
        ['slots', '.33', 'commit'],
        ['together', '.16', 'mask'],
      ],
    ),
    highlight: { active: ['p1:act', 'p3:act', 'p5:act'], compare: ['p2:act', 'p4:act', 'p6:act'] },
    explanation: 'The gate is usually a confidence or rank rule over position-wise logits. It should commit high-margin positions and leave uncertain positions masked, because over-eager parallel decoding can break token dependencies.',
  };

  yield {
    state: diffusionGraph('Remasking repairs low-confidence guesses'),
    highlight: { active: ['logits', 'gate', 'commit', 'remask', 'e-logits-gate', 'e-gate-commit', 'e-gate-remask'], compare: ['denoise'] },
    explanation: 'Some samplers keep a remasking loop: predict candidates, keep the confident ones, and remask positions that look inconsistent. The loop is the language analogue of iterative image denoising.',
  };

  yield {
    state: labelMatrix(
      'AR vs diffusion',
      [
        { id: 'order', label: 'order' },
        { id: 'ctx', label: 'context' },
        { id: 'cache', label: 'cache' },
        { id: 'latency', label: 'latency' },
        { id: 'control', label: 'control' },
      ],
      [
        { id: 'arm', label: 'AR' },
        { id: 'diff', label: 'diffusion' },
      ],
      [
        ['left->right', 'any slots'],
        ['prefix only', 'bidirectional'],
        ['KV natural', 'harder'],
        ['serial token', 'step batches'],
        ['prefix prompt', 'infilling'],
      ],
    ),
    highlight: { active: ['order:diff', 'ctx:diff', 'control:diff'], compare: ['cache:arm', 'latency:arm'] },
    explanation: 'The tradeoff is structural. Autoregressive models have a simple KV-cache path and exact left-to-right factorization. Masked diffusion models get parallel slot refinement, bidirectional context, and natural infilling, but serving needs different caches and schedulers.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'mask corruption') yield* maskCorruption();
  else if (view === 'parallel denoise') yield* parallelDenoise();
  else throw new InputError('Pick a discrete diffusion language-model view.');
}

const discreteDiffusionArticleSections = [
  {
    heading: 'Why This Exists',
    paragraphs: [
      'Autoregressive language models generate one token after another. That gives a clean probability rule: the next token depends on the prefix, and the KV cache makes repeated prefix reuse efficient. The cost is order. A left-to-right model cannot naturally fill three missing spans at once, revise the middle of a sentence without rebuilding later context, or spend one model call on several easy positions. Discrete diffusion language models explore a different schedule. They start from corrupted text, usually a buffer full of mask tokens, and learn to reverse the corruption. The goal is not to replace every autoregressive decoder immediately. The goal is to make language generation a refinement process over slots, so the model can use bidirectional context and reveal positions in an order chosen by uncertainty rather than by index.',
    ],
  },
  {
    heading: 'The Obvious Approach',
    paragraphs: [
      'The obvious approach is to keep using the autoregressive recipe. If you need text, ask for token 1, append it, ask for token 2, and continue. That is hard to beat for streaming chat because the serving path is mature and every generated token extends the cache. Another reasonable first attempt is a BERT-style masked language model: hide some words and train the model to recover them. That works well for representation learning and infilling tasks, but it is not automatically a full generative sampler. A masked model can score missing tokens; a diffusion language model also needs a forward corruption schedule, a reverse denoising objective, and a sampling policy that decides which predictions become part of the next state.',
    ],
  },
  {
    heading: 'The Wall',
    paragraphs: [
      'The wall is consistency. Predicting many masked positions in parallel is tempting, but language tokens are not independent pixels. A choice in slot 2 can change what belongs in slot 5. If the sampler commits too aggressively, later denoising steps inherit a bad context and may spend work repairing it. If the sampler commits too cautiously, it loses the hoped-for parallelism and becomes an expensive iterative decoder. Serving adds another wall. Autoregressive decoding has a simple cache because each new token only extends the prefix. A masked diffusion sampler repeatedly revisits a buffer whose visible positions can be anywhere. The state is a token array plus a mask bitset, a time or noise level, per-position logits, confidence scores, and rules for carrying or remasking positions.',
    ],
  },
  {
    heading: 'Core Insight',
    paragraphs: [
      'The core insight is to treat language generation as denoising a discrete state. The forward process is fixed: choose a noise level and replace some tokens with a mask or other corrupted state. The reverse model learns to predict clean tokens from the partially visible sequence and the current noise level. During sampling, the system does not have to reveal the next leftmost token. It can reveal the positions whose predictions are easiest, keep difficult positions masked, and run another denoising pass with more context. The important invariant is that visible tokens are the sampler\'s current claims about the final sequence. The confidence gate is therefore not a UI detail. It is the control system that decides when a claim is stable enough to carry forward.',
    ],
  },
  {
    heading: 'How It Works',
    paragraphs: [
      'Training begins with clean text x0. For a sampled timestep, the forward process masks a fraction of positions according to a schedule. The Transformer receives the corrupted sequence, often with a time embedding or noise-level signal, and predicts the original token distribution at masked positions. Sampling runs the process backward. Start with a prompt and a buffer of masked slots. Run the denoiser to produce logits for every slot. Convert logits into confidence scores, such as top-token probability or margin over the runner-up. Commit high-confidence positions, carry already visible positions forward, and leave low-confidence positions masked. Some samplers also remask guesses that later look inconsistent. Stop when the mask bitset is empty, the step budget is exhausted, or a quality gate says the sequence is stable enough.',
    ],
  },
  {
    heading: 'What The Visual Proves',
    paragraphs: [
      'The mask-corruption matrix shows that the forward process is not learned. It is a controlled way to create partial-context training examples at many noise levels. The graph view turns the sampler into a state machine: prompt, mask buffer, time, denoiser, logits, confidence gate, commit path, and remask path. The reverse-step plot shows the schedule the learner should remember. Generation gradually trades masked positions for visible tokens, but the order does not need to be left to right. The confidence ledger proves the central engineering problem. Positions 1, 3, and 5 can be safe to reveal while positions 2, 4, and 6 remain masked. The visual is not claiming that parallel token prediction is always faster. It is showing the condition under which it can be useful: safe parallel commitment.',
    ],
  },
  {
    heading: 'Why It Works',
    paragraphs: [
      'The method works when the learned reverse distribution can use visible context to reduce uncertainty at the remaining masked slots. A committed token is useful because it becomes evidence for later predictions. A remasked token is useful because the sampler admits that an earlier guess should not constrain the rest of the sequence. The invariant is consistency between the visible buffer and the final text the model is trying to approach. Confidence gating protects that invariant by delaying positions whose logits are flat or whose top choices conflict with visible context. This is the language analogue of image diffusion in one narrow sense: the model repeatedly maps a noisy state toward a cleaner state. The difference is that language is discrete, so the sampler must decide when a categorical choice is stable enough to become state.',
    ],
  },
  {
    heading: 'Cost And Tradeoffs',
    paragraphs: [
      'The main cost is reverse steps. If a sampler needs twenty denoising passes to produce a sequence that an autoregressive model would emit in twenty token steps, the win depends on how many tokens each pass resolves, how well batches run, and whether the serving stack avoids wasted recomputation. Cache design is harder because the visible set changes by position, not by appending to a prefix. Quality also depends on the confidence rule. A low threshold gives more parallelism and more risk. A high threshold preserves consistency but may behave like slow serial decoding. The useful metrics are steps per output, committed tokens per step, remask count, rejected positions, p50 and p99 latency, and quality by task slice. Tokens per second alone hides the repair loop.',
    ],
  },
  {
    heading: 'Where It Wins',
    paragraphs: [
      'Discrete diffusion is most natural when the task is not pure left-to-right continuation. Infilling, constrained editing, code repair, noncontiguous blanks, and bidirectional revision all benefit from a model that can condition on both sides of a gap. It is also a useful research path for inference scaling because it exposes a different compute schedule: repeated wide passes instead of a long chain of single-token steps. In a batch setting, the sampler may resolve many easy slots across many requests at once. It can also expose controllable knobs that autoregressive decoding hides, such as the number of reverse steps, the mask schedule, the confidence threshold, and the remasking policy. Those knobs are useful only if they are measured against quality, not just latency.',
    ],
  },
  {
    heading: 'Where It Fails',
    paragraphs: [
      'The method is the wrong tool when the production constraint is simple streaming latency and the autoregressive cache already dominates. It can also fail when dependencies are tight, such as mathematical derivations, code syntax, or long-range narrative commitments where an early wrong token poisons many later choices. Weak confidence gates make the system brittle; overly conservative gates make it slow. A BERT-style masked objective is not enough by itself, because generation needs a reverse-process semantics and a sampler. Claims about speed should be treated carefully until they include the number of model evaluations, hardware utilization, cache behavior, repair steps, and quality regressions. The field is moving quickly, so paper results should be read as evidence for a design family, not as proof that every masked sampler is production-ready.',
    ],
  },
  {
    heading: 'Study Next',
    paragraphs: [
      'Study Diffusion Models first for the forward/reverse-process pattern, then Tokenization BPE because every discrete sampler operates over token ids rather than words. Softmax & Temperature explains how logits become categorical choices, and Constrained Decoding explains why a sampler may need legality checks beyond confidence. KV Cache shows why autoregressive serving is so efficient and why diffusion-style serving needs different state. Block Diffusion LLM Denoising is the natural extension after this primer because it studies denoising at chunk granularity. The primary papers listed on this page are also worth reading: LLaDA for a large language diffusion model, Score Entropy Discrete Diffusion for a discrete diffusion objective, and Masked Diffusion Language Models for a practical masked-denoising family.',
    ],
  },
];

export const article = {
  references: [
    { title: 'Large Language Diffusion Models', url: 'https://arxiv.org/abs/2502.09992' },
    { title: 'LLaDA Project Page', url: 'https://ml-gsai.github.io/LLaDA-demo/' },
    { title: 'Score Entropy Discrete Diffusion', url: 'https://arxiv.org/abs/2310.16834' },
    { title: 'Simple and Effective Masked Diffusion Language Models', url: 'https://s-sahoo.com/mdlm/' },
  ],
  sections: discreteDiffusionArticleSections,
};
