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
  const noiseLevels = [
    { id: 'x0', label: 'x0' },
    { id: 't25', label: 't=.25' },
    { id: 't60', label: 't=.60' },
    { id: 't95', label: 't=.95' },
  ];
  yield {
    state: labelMatrix(
      'Forward process: tokens become masks',
      TOKEN_ROWS,
      noiseLevels,
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
    explanation: `A discrete diffusion language model corrupts ${TOKEN_ROWS.length} tokens across ${noiseLevels.length} noise levels (${noiseLevels.map(n => n.label).join(', ')}) by replacing tokens with a special mask state. The schedule controls how many positions are hidden at each noise level.`,
    invariant: `The forward corruption across ${noiseLevels.length} levels is fixed; the learned model only parameterizes the reverse denoising distribution.`,
  };

  const graphInputNodes = ['prompt', 'mask', 'time', 'denoise'];
  yield {
    state: diffusionGraph('Masked language diffusion is a state machine'),
    highlight: { active: [...graphInputNodes, 'e-prompt-mask', 'e-time-denoise'], found: ['logits'] },
    explanation: `The runtime state across ${graphInputNodes.length} input nodes ("${graphInputNodes.join('", "')}") is a prompt, a mutable token buffer of ${TOKEN_ROWS.length} slots, a mask bitset, and a timestep or noise level. The Transformer reads bidirectional context over the visible tokens and predicts every masked slot at once.`,
  };

  const reverseSteps = 8;
  const maskPoints = [{ x: 0, y: 1.0 }, { x: 1, y: 0.82 }, { x: 2, y: 0.64 }, { x: 3, y: 0.49 }, { x: 4, y: 0.34 }, { x: 5, y: 0.22 }, { x: 6, y: 0.12 }, { x: 7, y: 0.04 }, { x: 8, y: 0.0 }];
  const midStep = 4;
  const midVisible = 0.66;
  yield {
    state: plotState({
      axes: { x: { label: 'reverse step', min: 0, max: reverseSteps }, y: { label: 'fraction', min: 0, max: 1 } },
      series: [
        { id: 'masked', label: 'mask', points: maskPoints },
        { id: 'visible', label: 'visible', points: [{ x: 0, y: 0.0 }, { x: 1, y: 0.18 }, { x: 2, y: 0.36 }, { x: 3, y: 0.51 }, { x: 4, y: midVisible }, { x: 5, y: 0.78 }, { x: 6, y: 0.88 }, { x: 7, y: 0.96 }, { x: 8, y: 1.0 }] },
      ],
      markers: [
        { id: 'mid', x: midStep, y: midVisible, label: 'half' },
      ],
    }),
    highlight: { active: ['masked', 'visible', 'mid'] },
    explanation: `Sampling over ${reverseSteps} reverse steps gradually trades masked positions for visible tokens. By step ${midStep}, ${(midVisible * 100).toFixed(0)}% of ${TOKEN_ROWS.length} slots are visible. Unlike an autoregressive decoder, the next committed token does not have to be the immediate next position from the left.`,
  };

  const primerRows = [
    { id: 'bitset', label: 'mask bits' },
    { id: 'time', label: 'time id' },
    { id: 'logit', label: 'logits' },
    { id: 'conf', label: 'conf' },
    { id: 'carry', label: 'carry' },
  ];
  yield {
    state: labelMatrix(
      'Primer map',
      primerRows,
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
    explanation: `The ${primerRows.length} core data structures (${primerRows.map(r => r.label).join(', ')}) are ordinary and important: a mask bitset over ${TOKEN_ROWS.length} slots, a token buffer, a timestep, per-position logits, confidence scores, and a carry-over rule for positions that are already visible.`,
  };
}

function* parallelDenoise() {
  const denoiseSteps = [
    { id: 's0', label: 'step0' },
    { id: 's1', label: 'step1' },
    { id: 's2', label: 'step2' },
    { id: 's3', label: 'step3' },
  ];
  const step1Commits = 3;
  const step2Commits = 2;
  yield {
    state: labelMatrix(
      'Reverse denoising commits confident slots',
      TOKEN_ROWS,
      denoiseSteps,
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
    explanation: `A diffusion sampler can reveal ${step1Commits} positions in ${denoiseSteps[1].label} when their confidence is high, then ${step2Commits} more in ${denoiseSteps[2].label}. Harder positions remain masked across ${TOKEN_ROWS.length} slots until later context makes them easier to recover.`,
    invariant: `Parallel commitment of up to ${step1Commits} tokens per step is useful only when the committed tokens remain mutually consistent.`,
  };

  const confSlots = [
    { id: 'p1', label: 'slot1' },
    { id: 'p2', label: 'slot2' },
    { id: 'p3', label: 'slot3' },
    { id: 'p4', label: 'slot4' },
    { id: 'p5', label: 'slot5' },
    { id: 'p6', label: 'slot6' },
  ];
  const margins = [0.42, 0.08, 0.37, 0.05, 0.33, 0.16];
  const committed = margins.filter(m => m > 0.30).length;
  const masked = margins.filter(m => m <= 0.30).length;
  yield {
    state: labelMatrix(
      'Confidence ledger',
      confSlots,
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
    explanation: `The gate is usually a confidence or rank rule over ${confSlots.length} position-wise logits. ${committed} high-margin positions are committed while ${masked} uncertain positions stay masked, because over-eager parallel decoding can break token dependencies.`,
  };

  const remaskPath = ['logits', 'gate', 'commit', 'remask'];
  yield {
    state: diffusionGraph('Remasking repairs low-confidence guesses'),
    highlight: { active: [...remaskPath, 'e-logits-gate', 'e-gate-commit', 'e-gate-remask'], compare: ['denoise'] },
    explanation: `Some samplers keep a remasking loop through ${remaskPath.length} nodes ("${remaskPath.join('" to "')}"):  predict candidates, keep the confident ones, and remask positions that look inconsistent. The loop is the language analogue of iterative image denoising.`,
  };

  const compareRows = [
    { id: 'order', label: 'order' },
    { id: 'ctx', label: 'context' },
    { id: 'cache', label: 'cache' },
    { id: 'latency', label: 'latency' },
    { id: 'control', label: 'control' },
  ];
  yield {
    state: labelMatrix(
      'AR vs diffusion',
      compareRows,
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
    explanation: `The tradeoff spans ${compareRows.length} dimensions (${compareRows.map(r => r.label).join(', ')}). Autoregressive models have a simple KV-cache path and exact left-to-right factorization. Masked diffusion models get parallel slot refinement, bidirectional context, and natural infilling, but serving needs different caches and schedulers.`,
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
    { title: 'Structured Denoising Diffusion Models in Discrete State-Spaces (D3PM)', url: 'https://arxiv.org/abs/2107.03006' },
    { title: 'Simple and Effective Masked Diffusion Language Models (MDLM)', url: 'https://arxiv.org/abs/2406.07524' },
    { title: 'Large Language Diffusion Models (LLaDA)', url: 'https://arxiv.org/abs/2502.09992' },
    { title: 'Score Entropy Discrete Diffusion (SEDD)', url: 'https://arxiv.org/abs/2310.16834' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The mask-corruption view shows the forward process. A clean sentence starts on the left. Each column moves rightward in time, and tokens are replaced by [M] (mask) according to a corruption schedule -- a function that maps timestep t to masking probability. Watch which positions vanish first and which survive longest. That ordering is determined by the schedule, not by randomness in the animation. Positions with high schedule weight at low t disappear early; positions with low weight persist until late timesteps.',
        {
          type: 'callout',
          text: 'Masked diffusion treats generation as a mutable slot buffer, not a left-to-right append log.',
        },
        'The parallel-denoise view shows the reverse process. A fully masked buffer appears at step 0 -- every position is [M]. Each column reveals the tokens the model commits at that step. Active highlights mark positions being committed now; found highlights mark positions that remain masked because the model\'s confidence fell below the gate threshold. The confidence ledger makes the gate explicit: it displays the margin score (gap between the top-1 and top-2 predicted probabilities) for each masked position, and only positions above the threshold get committed.',
        'The graph view connects the two processes into a single loop. Follow the edges from the prompt and mask buffer through the Transformer denoiser to logits, then through the confidence gate to either commit or remask. That loop is the entire sampler. Every frame in both views corresponds to one pass through this graph. If you pause on any frame, you can read off exactly which positions are visible, which are masked, and what the model predicted for each masked slot.',
        {type: 'image', src: './assets/gifs/discrete-diffusion-language-model-primer.gif', alt: 'Animated walkthrough of the discrete diffusion language model primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive language models generate one token at a time, strictly left to right. Token 1 is sampled, appended to the prefix, then token 2 is sampled conditioned on token 1, and so on. This factorization -- P(x) = P(x_1) * P(x_2|x_1) * P(x_3|x_1,x_2) * ... -- is clean and well understood. The KV cache makes it efficient: each new token reuses all previously computed key-value pairs, so the cost per token is one forward pass over a single position plus a cache lookup. But the order is locked. The model cannot fill three scattered blanks at once, revise a word in the middle without regenerating everything after it, or spend one forward pass resolving ten easy positions while deferring two hard ones.',
        'Discrete diffusion language models break that lock. Instead of committing tokens in index order, the model starts from a fully corrupted sequence -- typically every position set to a special [MASK] token -- and learns to reverse the corruption. The reverse model is a standard Transformer, but it sees bidirectional context: tokens on both sides of every gap, not just the prefix. It can reveal positions in any order, chosen by how confident the model is about each prediction rather than by position index. The goal is not to replace autoregressive decoding for every task. It is to provide a fundamentally different generation contract -- refinement over a mutable buffer -- where parallelism and flexible ordering are first-class properties.',
        {
          type: 'quote',
          text: 'Autoregressive models choose WHICH token next. Discrete diffusion models choose WHERE to commit next.',
          attribution: 'The core shift in generation contract',
        },
        'This matters practically because many real tasks are not pure left-to-right continuation. Code repair requires filling a gap with context on both sides. Template completion has scattered blanks. Document editing revises interior spans. Machine translation can benefit from resolving function words (which are highly predictable) before content words (which carry more uncertainty). Any task where the generation order should be adaptive rather than fixed is a candidate for discrete diffusion.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first obvious approach is to keep using autoregressive generation. Predict token 1, append it, predict token 2, continue. The serving path is mature. The KV cache is well understood. Streaming output is trivial because every new token extends the sequence by exactly one position. For chat, long-form continuation, and any task where left-to-right order matches the natural structure, this is hard to beat. The engineering infrastructure -- speculative decoding, quantized serving, batched prefill -- has years of optimization behind it.',
        'A second obvious attempt is a BERT-style masked language model. Hide 15% of tokens, train the model to recover them, done. This works well for learning representations and for single-shot infilling, but it is not a generative sampler. BERT can score candidates for masked positions given the surrounding context, but it does not define a forward corruption schedule that degrades text from clean to fully masked, a reverse denoising objective that operates over many noise levels, or a sampling policy that decides which predictions become permanent state and which get another chance. The gap between "predict some masked tokens in one shot" and "generate arbitrary text from a blank slate" is exactly where discrete diffusion lives.',
        'A third attempt is continuous diffusion applied to language. Map each token to its embedding vector, add Gaussian noise forward and remove it in reverse, then round the denoised embedding back to the nearest vocabulary entry. This works in principle -- Analog Bits (Chen et al. 2023) and Diffusion-LM (Li et al. 2022) explore this path -- but introduces a lossy rounding step. Every reverse pass produces a continuous vector that must snap to a discrete token, and small errors in embedding space can map to entirely wrong tokens. "cat" and "car" might be close in embedding space but are different words. Discrete diffusion avoids rounding entirely by staying in token space throughout the whole process.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is token dependency. Predicting many masked positions simultaneously is tempting, but language tokens are not independent pixels. Committing "happy" at position 2 can change what belongs at position 5 from "joyful" to "today." If the sampler commits too many positions per step, later denoising steps inherit contradictory context -- two synonyms where only one fits, a verb tense that clashes with an already-committed adverb -- and spend compute repairing mistakes instead of making progress. If it commits too few positions per step, it loses the parallelism advantage and becomes a serial decoder that is strictly worse than autoregressive generation because it lacks the KV cache.',
        'The second wall is serving infrastructure. Autoregressive decoding has a simple cache invariant: each new token appends to the prefix, the KV cache grows by one entry, and nothing previously computed changes. A masked diffusion sampler revisits a buffer whose visible positions can appear anywhere and in any order. The mask pattern changes at every step. There is no append-only cache. Either the full sequence is recomputed from scratch each step (expensive but simple) or a complex cache invalidation scheme tracks which positions changed and recomputes only the affected attention entries (cheaper but intricate to implement correctly).',
        'The third wall is the gap between training and sampling. During training, the model sees partially corrupted versions of real text and predicts the original tokens. During sampling, it sees its own previous predictions -- which may be wrong -- and must build on them anyway. This train-sample mismatch is analogous to exposure bias in autoregressive models, but the geometry is different. In autoregressive generation, errors accumulate at the end of a growing prefix. In masked diffusion, errors can appear at any position, and a wrong commitment at position 3 propagates bidirectionally to both earlier and later positions in subsequent steps.',
        'A fourth wall is evaluation. Autoregressive models have a clean perplexity metric: the negative log-likelihood under the left-to-right factorization. Discrete diffusion models optimize a variational bound that is not directly comparable to autoregressive perplexity. Converting between the two requires importance-weighted estimates or surrogate metrics, making fair apples-to-apples comparison with autoregressive baselines harder than it should be.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that generation does not require a fixed ordering. If you define a corruption process that gradually destroys a clean sequence, and you train a model to reverse any single step of that corruption, then you can chain those reversals to generate from scratch -- starting from pure noise (all masks) and ending at a clean sequence. The generation order emerges from the model\'s own confidence, not from an externally imposed left-to-right sweep. Easy positions get committed first because the model is confident about them; hard positions wait for more context, which the easy commitments provide.',
        'This is the same insight that powers continuous diffusion for images, translated to the discrete domain. In image diffusion, Gaussian noise is added to pixel values and a neural network learns to predict the clean image from the noisy one. In discrete diffusion, the "noise" is token masking (or token replacement), and the neural network learns to predict the original tokens from the corrupted sequence. The mathematical machinery -- forward Markov chain, reverse Markov chain, variational bound on log-likelihood -- transfers directly, but the state space changes from continuous (real-valued pixel intensities) to discrete (token IDs from a finite vocabulary).',
        'What makes this insight non-obvious is the confidence gate. Without it, you would just predict all tokens at once from the fully masked input, which is what a single-shot BERT-style model does. The gate converts a single noisy prediction into a multi-step refinement process: commit what you are sure about, observe the result, re-predict the rest with the newly committed tokens as additional context, repeat. Each commitment changes the conditioning for every remaining position, so the model\'s predictions improve as the buffer fills in. The gate is what bridges the gap between a masked language model (one-shot predictor) and a generative model (iterative sampler).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The framework has two halves: a fixed forward process that corrupts text, and a learned reverse process that recovers it. Austin et al. (2021) formalized this as D3PM -- Discrete Denoising Diffusion Probabilistic Models. The forward process is a Markov chain over a discrete state space: the token vocabulary V (say |V| = 32,000) plus a special absorbing state [MASK]. At each timestep t, each token independently transitions according to a transition matrix Q_t of size (|V|+1) x (|V|+1). The absorbing-state variant sets Q_t so that every non-mask token has probability beta_t of jumping to [MASK] and probability 1-beta_t of staying unchanged. As t increases from 0 to T, beta_t increases, so more and more positions become masked. By the final timestep t=T, nearly every position is [MASK].',
        {
          type: 'image',
          src: 'https://lilianweng.github.io/posts/2021-07-11-diffusion-models/DDPM.png',
          alt: 'Diffusion reverse process diagram showing noisy state xT denoised step by step toward x0',
          caption: 'The learned reverse process turns a high-noise state into data through repeated denoising steps. Source: Lilian Weng diffusion models post, https://lilianweng.github.io/posts/2021-07-11-diffusion-models/.',
        },
        {
          type: 'diagram',
          label: 'Forward corruption and reverse denoising on a token sequence',
          text: [
            'FORWARD (fixed, not learned):',
            '',
            '  t=0        t=0.3       t=0.6       t=1.0',
            '  The        The         [M]         [M]',
            '  model  --> [M]     --> [M]     --> [M]',
            '  fills      fills       fills       [M]',
            '  many       [M]         [M]         [M]',
            '  slots      slots       [M]         [M]',
            '  well       [M]         [M]         [M]',
            '',
            'REVERSE (learned Transformer):',
            '',
            '  t=1.0      step 1      step 2      step 3',
            '  [M]        [M]         The         The',
            '  [M]    --> [M]     --> model   --> model',
            '  [M]        fills       fills       fills',
            '  [M]        [M]         [M]         many',
            '  [M]        slots       slots       slots',
            '  [M]        [M]         [M]         well',
            '',
            '  (high-confidence positions committed first)',
          ].join('\n'),
        },
        'Training works as follows. Take a clean sequence x_0 of N tokens. Sample a random timestep t uniformly from {1, ..., T}. Apply the forward transition matrices to produce x_t, where some fraction of tokens are replaced by [MASK]. The fraction depends on t: at t=1 almost nothing is masked, at t=T almost everything is. Feed x_t along with the timestep t into a Transformer. The model outputs a distribution over the vocabulary at every masked position. The loss is cross-entropy between the predicted distributions and the true tokens from x_0, summed over all masked positions. This is structurally identical to BERT\'s masked-language-modeling objective, but the mask rate varies with t, covering the full range from near-zero to near-total masking. The model must learn to denoise at every corruption level, not just at 15%.',
        'Sampling starts from a buffer of N [MASK] tokens. At each reverse step s (counting down from T to 0), the Transformer takes the current buffer and timestep as input and predicts a token distribution for every masked position. A confidence gate then decides which positions to commit. The simplest gate uses the top-1 probability: if the model assigns probability > threshold to its best prediction, commit that token. A more robust gate uses the margin -- the gap between the top-1 and top-2 probabilities -- because a high top-1 probability is less informative when the second-best candidate is nearly as likely. High-confidence positions become visible tokens in the buffer. Low-confidence positions stay [MASK] for the next round. Some samplers (MDLM, Sahoo et al. 2024) also support remasking: a previously committed token can be returned to [MASK] if subsequent context makes it look inconsistent. The process terminates when no masked positions remain or the step budget is exhausted.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because each committed token provides bidirectional evidence for the remaining masked positions. In an autoregressive model, position 5 can only see positions 1 through 4 (the causal mask blocks the future). In a masked diffusion model, position 5 sees every currently visible position -- including positions 6, 7, 8 if they were committed in an earlier step. This bidirectional conditioning means the model has strictly more information when predicting hard positions, which is exactly when more information matters most. A function word like "the" is easy to predict from the prefix alone, but a technical noun like "eigenvalue" benefits enormously from seeing both the verb before it and the clause after it.',
        'The confidence gate is what makes parallel commitment safe. Without it, committing all predictions simultaneously would be rolling a die at every position and hoping the results are jointly coherent -- a single-shot BERT prediction, which often produces grammatical but semantically inconsistent text across positions. The gate converts parallel prediction into selective commitment: easy positions (function words, determiners, predictable tokens) get locked in early, providing scaffolding. Harder positions (rare nouns, ambiguous verbs, long-range agreement targets) wait for later steps when they have more committed neighbors to condition on. The invariant is that the set of visible tokens at any step represents the sampler\'s best current belief about the final sequence, and the gate ensures that belief only solidifies when confidence warrants it.',
        {
          type: 'note',
          text: 'The connection to BERT is real but incomplete. BERT trains with a fixed 15% mask rate and no notion of timesteps. Discrete diffusion trains across all mask rates (0% to 100%) so the model learns to denoise from any corruption level. BERT predicts independently per position. Discrete diffusion adds a multi-step sampling loop with a confidence gate. BERT is a snapshot of the training objective; discrete diffusion is the full generative framework built on top of it.',
        },
        'D3PM justifies the framework by deriving a variational lower bound on the data log-likelihood, analogous to the ELBO in continuous diffusion (and in VAEs more broadly). The forward and reverse Markov chains define a latent-variable model where the intermediate corrupted states are the latents. The training loss decomposes into a sum of per-timestep KL divergences between the true reverse transition (computable via Bayes\' rule given x_0 and x_t) and the learned reverse transition (the Transformer\'s output). Minimizing this sum tightens the bound on the negative log-likelihood. This gives discrete diffusion a principled probabilistic footing: the model is maximizing a lower bound on log P(data), not just optimizing a heuristic masking recipe.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is the number of reverse steps T multiplied by the cost of one full-sequence Transformer forward pass. Each step processes the entire N-token buffer, not just one position. If T = 64 steps and N = 512 tokens, the sampler runs 64 forward passes over 512 tokens each, for a total of 64 * 512 = 32,768 token-passes. An autoregressive model generating the same 512 tokens runs 512 forward passes, but each pass is cheaper on average because the KV cache avoids recomputing attention for previous positions. The net result depends on T versus N and on cache efficiency, but in practice discrete diffusion is often 2-10x slower than autoregressive generation for the same sequence length and model size.',
        {
          type: 'table',
          headers: ['Property', 'Autoregressive', 'Continuous diffusion', 'Discrete diffusion', 'Masked LM (BERT)'],
          rows: [
            ['State space', 'Discrete tokens', 'Continuous embeddings', 'Discrete tokens', 'Discrete tokens'],
            ['Generation order', 'Left to right', 'All positions (continuous)', 'Any order (by confidence)', 'Single-shot (not generative)'],
            ['Context direction', 'Prefix only (causal)', 'Bidirectional', 'Bidirectional', 'Bidirectional'],
            ['Forward process', 'N/A', 'Gaussian noise on embeddings', 'Token masking or multinomial noise', 'Fixed 15% masking'],
            ['Reverse steps', '1 per token (N total)', '~50-1000 denoising steps', '~10-256 denoising steps', 'N/A'],
            ['KV cache', 'Simple append-only', 'Recompute each step', 'Recompute or invalidate per step', 'Single pass'],
            ['Rounding needed', 'No', 'Yes (embedding to token)', 'No (stays discrete)', 'No'],
            ['Natural infilling', 'No (needs special tokens)', 'Yes', 'Yes', 'Yes (but single-shot)'],
          ],
        },
        'The confidence threshold creates a throughput-quality tradeoff with direct numerical consequences. Suppose you have 100 masked positions and set the threshold so that 20 positions are committed per step. You need 5 steps to clear the buffer (100 / 20). Lower the threshold to commit 50 per step: you finish in 2 steps, but the 30 extra commitments per step were below the original confidence bar, so some are likely wrong and may degrade output quality. Raise the threshold to commit 5 per step: you need 20 steps, quality improves because every commitment is high-confidence, but you used 4x the compute of autoregressive generation (20 full-sequence passes vs. 100 single-token passes with KV cache). The useful metrics are: steps per output sequence, tokens committed per step, remask count, and quality on the target task. Tokens per second alone hides the repair loop.',
        'Memory cost per step is roughly the same as one full-sequence autoregressive forward pass (the entire model processes all N positions). But total memory across sampling is higher because there is no KV cache to amortize past computation. Each step recomputes attention from scratch over the full buffer. Some recent work (MDLM, LLaDA) explores partial caching strategies for masked diffusion -- caching KV pairs for positions whose tokens did not change between steps -- but the infrastructure is less mature than autoregressive serving stacks, and the invalidation logic adds engineering complexity.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Discrete diffusion is strongest when the task is not pure left-to-right continuation. Infilling -- filling in blanks where context exists on both sides -- is the most natural fit. Code repair (fix a bug in the middle of a function while keeping the surrounding code intact), constrained editing (revise a paragraph while preserving the opening and closing sentences), template completion (fill scattered slots in a form letter), and bidirectional revision (rewrite an interior clause to match a changed ending) all benefit from a model that conditions on both sides of every gap rather than only on the prefix.',
        'Flexible generation order is valuable for adaptive compute allocation. Consider generating a 20-token sentence where 12 tokens are function words (the, a, is, of, ...) and 8 are content words (eigenvalue, convergence, matrix, ...). An autoregressive model spends equal compute per token regardless of difficulty. A discrete diffusion model can resolve the 12 easy tokens in the first 1-2 steps, spending minimal deliberation on them, and then focus its remaining step budget on the 8 hard tokens with the benefit of seeing the full scaffolding. This is a form of inference-time compute routing that autoregressive models lack.',
        'The research frontier is inference-time compute scaling. Autoregressive models scale inference compute by generating more tokens (chain-of-thought, best-of-N sampling) or by using larger models. Discrete diffusion models scale by adding more denoising steps, remasking and re-predicting uncertain positions, or varying the confidence gate threshold. These are structurally different knobs. LLaDA (Nie et al. 2025) demonstrates that adding denoising steps can improve quality on reasoning benchmarks in ways that simply sampling more autoregressive candidates does not, because each additional step refines the same sequence rather than starting a new one from scratch.',
        {
          type: 'note',
          text: 'D3PM defines three noise types: absorbing (tokens go to [MASK]), uniform multinomial (tokens jump to random vocabulary entries), and discretized Gaussian (tokens shift to nearby entries in an ordered vocabulary). Absorbing-state diffusion dominates in practice because the [MASK] token cleanly separates "unknown" from "committed," making the confidence gate straightforward. Multinomial noise is harder to work with because a corrupted token looks like a real token, and the model must learn to distrust its own input.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The method is the wrong tool when the production constraint is streaming latency and the autoregressive KV cache already dominates. A user watching tokens appear one by one in a chat interface does not benefit from parallel slot commitment -- the bottleneck is per-token model speed, not generation order. Discrete diffusion adds three sources of complexity (mask scheduling, confidence gating, multi-step sampling) without improving the user-visible metric, which is time-to-first-token and tokens-per-second in the stream.',
        'It also fails when token dependencies are tightly sequential. Mathematical derivations, formal proofs, code with strict syntax constraints (matching brackets, type signatures), and long-range narrative arcs all have the property that an early wrong token poisons many later positions. If the sampler commits "for" at position 10 when the correct token is "while," every token inside the loop body that depends on the loop construct becomes harder to predict correctly. The confidence gate can delay commitment, but it cannot fix the fundamental problem: some sequences have a natural causal order, and ignoring that order makes the prediction task harder, not easier.',
        'Weak confidence gates make the system brittle in a specific way. If the gate commits too aggressively, the visible buffer accumulates errors that later steps cannot repair because committed tokens are treated as ground truth by subsequent forward passes. If the gate is too conservative, the sampler degenerates into a slow serial decoder that commits one token per step -- strictly worse than autoregressive generation because it lacks the KV cache and must recompute the full sequence every step. The sweet spot depends on the distribution of token difficulty in the target domain, which varies between tasks and is not easy to predict in advance.',
        'Finally, the infrastructure gap is real and measurable. Autoregressive serving has years of engineering behind KV caches, speculative decoding, continuous batching, quantization-aware serving, and paged attention. Discrete diffusion serving is young. Claims about speed advantages should be scrutinized: check whether they report wall-clock time including all denoising steps, whether quality is measured on the same benchmarks at the same model scale, and whether the comparison accounts for the maturity difference in serving stacks. A 2x theoretical speedup from parallelism can easily be eaten by a 3x overhead from missing infrastructure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose we want to generate a 6-token sentence using a discrete diffusion model with T = 3 reverse steps, a vocabulary of size 32,000, and a confidence gate threshold of 0.7 (the top-1 probability must exceed 0.7 to commit). The target sentence is "The model fills many slots well." We start from the buffer: [M] [M] [M] [M] [M] [M].',
        'Step 1: the Transformer sees six [MASK] tokens and the timestep t=3. It outputs a probability distribution over 32,000 tokens at each position. Suppose the predictions and their top-1 probabilities are: position 0: "The" (0.92), position 1: "system" (0.31), position 2: "runs" (0.25), position 3: "many" (0.40), position 4: "tasks" (0.28), position 5: "well" (0.85). The gate checks each top-1 probability against the threshold of 0.7. Positions 0 and 5 pass (0.92 > 0.7, 0.85 > 0.7). The buffer becomes: "The" [M] [M] [M] [M] "well". Two tokens committed, four remain masked.',
        'Step 2: the Transformer now sees "The [M] [M] [M] [M] well" with t=2. The committed tokens provide bidirectional context -- position 1 now knows the sentence starts with "The" and ends with "well." Updated predictions: position 1: "model" (0.78), position 2: "fills" (0.73), position 3: "many" (0.55), position 4: "slots" (0.62). Positions 1 and 2 pass the gate (0.78 > 0.7, 0.73 > 0.7). Buffer: "The model fills [M] [M] well". Four committed, two remain.',
        'Step 3: the Transformer sees "The model fills [M] [M] well" with t=1. Now position 3 predicts "many" (0.88) and position 4 predicts "slots" (0.91). Both pass the gate. Final buffer: "The model fills many slots well." The mask set is empty, sampling terminates. Total cost: 3 full-sequence forward passes. An autoregressive model would have taken 6 single-token passes (with KV cache reuse). The discrete diffusion sampler used fewer steps but each step processed the full 6-token sequence, so total compute was 3 * 6 = 18 position-evaluations versus the autoregressive model\'s 1 + 2 + 3 + 4 + 5 + 6 = 21 position-evaluations (without KV cache) or effectively 6 (with perfect KV cache). The tradeoff: fewer steps, more work per step, but flexible ordering and bidirectional context.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Austin et al. 2021, "Structured Denoising Diffusion Models in Discrete State-Spaces" (D3PM) -- the foundational paper defining forward transition matrices (absorbing, uniform, discretized Gaussian) and the variational bound for discrete diffusion.',
            'Sahoo et al. 2024, "Simple and Effective Masked Diffusion Language Models" (MDLM) -- simplifies D3PM for language with absorbing-state masking, shows competitive perplexity with efficient training.',
            'Nie et al. 2025, "Large Language Diffusion Models" (LLaDA) -- scales discrete diffusion to large language model sizes, demonstrating that the approach can compete with autoregressive models at scale.',
            'Lou et al. 2024, "Discrete Diffusion Modeling by Estimating the Ratios of the Data Distribution" (SEDD) -- formulates discrete diffusion through score entropy, providing an alternative training objective.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Diffusion Models -- the continuous forward/reverse framework. Understand Gaussian diffusion before studying the discrete variant.',
            'Prerequisite: Tokenization (BPE) -- every discrete diffusion model operates over token IDs, not raw text. The vocabulary defines the state space.',
            'Prerequisite: Softmax and Temperature -- how logits become categorical distributions and how temperature controls the sharpness of predictions at each denoising step.',
            'Extension: Block Diffusion LLM Denoising -- denoising at chunk granularity rather than individual tokens, bridging discrete diffusion and autoregressive generation.',
            'Extension: KV Cache -- why autoregressive serving is fast and why discrete diffusion serving needs different state management.',
            'Extension: Constrained Decoding -- why a sampler may need legality checks beyond confidence, especially for structured outputs like code or JSON.',
          ],
        },
      ],
    },
  ],
};
