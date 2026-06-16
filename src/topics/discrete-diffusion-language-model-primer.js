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

export const article = {
  references: [
    { title: 'Large Language Diffusion Models', url: 'https://arxiv.org/abs/2502.09992' },
    { title: 'LLaDA Project Page', url: 'https://ml-gsai.github.io/LLaDA-demo/' },
    { title: 'Score Entropy Discrete Diffusion', url: 'https://arxiv.org/abs/2310.16834' },
    { title: 'Simple and Effective Masked Diffusion Language Models', url: 'https://s-sahoo.com/mdlm/' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['A discrete diffusion language model is a language model that corrupts text by masking or otherwise noising tokens, then learns to reverse that corruption. Instead of generating only the next token from the left, it can iteratively refine many positions in a sequence.', 'The local AI documents emphasize inference scaling and non-autoregressive generation as recurring frontiers. This primer connects those ideas to data structures: mask bitsets, token buffers, timestep schedules, confidence ledgers, and denoising work queues.'] },
    { heading: 'Data structures', paragraphs: ['The sampler keeps a token array, a mask bitset, a timestep or noise level, per-position logits, confidence scores, and a commit/remask ledger. The ledger matters because a position that is visible should usually be carried forward, while uncertain predictions may stay masked.', 'Training also has a structured state. The forward schedule decides which positions are masked at which noise level. The reverse network predicts clean tokens from the partially visible sequence and the noise level.'] },
    { heading: 'How it works', paragraphs: ['During training, clean text is corrupted at random mask ratios or discrete noise levels. The model sees the corrupted sequence and predicts the original tokens for masked positions. During sampling, the process starts from many masked slots and repeatedly predicts, commits, and sometimes remasks positions.', 'The most important mental shift is that the model is not forced to reveal position 1, then position 2, then position 3. It can reveal the easiest slots first and use them as bidirectional context for harder slots.'] },
    { heading: 'Complete case study', paragraphs: ['Suppose a code assistant must fill a six-token completion. A masked diffusion sampler begins with all six slots masked. After one denoising pass, positions 1, 3, and 5 have high confidence and are committed. A second pass uses those visible tokens to recover positions 2 and 6. The final difficult adjective or operator is left for the last step.', 'The implementation is a small state machine: choose a noise level, run the denoiser, compute confidence margins, commit high-confidence tokens, keep or remask low-confidence tokens, and stop when the mask bitset is empty or the step budget expires.'] },
    { heading: 'Costs and tradeoffs', paragraphs: ['Diffusion language models trade the simple serial KV-cache path of autoregressive decoding for parallel slot refinement and better infilling. Practical speed depends on the number of reverse steps, how many tokens are safely committed per step, batching, cache reuse, and whether confidence gates preserve quality.', 'The serving system must log more than tokens per second. It should track steps per output, committed tokens per step, remask count, confidence threshold, rejected positions, latency, and quality regressions by task type.'] },
    { heading: 'Pitfalls', paragraphs: ['The common misconception is that parallel token prediction automatically means faster production inference. It does not. If confidence gating is weak, the system may need many repair steps, or it may emit inconsistent text. If caching is weak, each denoise pass can waste expensive compute.', 'Another pitfall is treating masked diffusion as BERT with a sampling loop. BERT-style masked language modeling is related, but modern masked diffusion work adds generative objectives, schedules, sampling rules, likelihood bounds, and explicit reverse-process semantics.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: LLaDA at https://arxiv.org/abs/2502.09992 and https://ml-gsai.github.io/LLaDA-demo/, Score Entropy Discrete Diffusion at https://arxiv.org/abs/2310.16834, and Masked Diffusion Language Models at https://s-sahoo.com/mdlm/. Study Diffusion Models, Tokenization BPE, Softmax & Temperature, Constrained Decoding, KV Cache, and Block Diffusion LLM Denoising next.'] },
  ],
};
