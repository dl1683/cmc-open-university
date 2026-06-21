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
    { title: 'Structured Denoising Diffusion Models in Discrete State-Spaces (D3PM)', url: 'https://arxiv.org/abs/2107.03006' },
    { title: 'Simple and Effective Masked Diffusion Language Models (MDLM)', url: 'https://arxiv.org/abs/2406.07524' },
    { title: 'Large Language Diffusion Models (LLaDA)', url: 'https://arxiv.org/abs/2502.09992' },
    { title: 'Score Entropy Discrete Diffusion (SEDD)', url: 'https://arxiv.org/abs/2310.16834' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The mask-corruption view shows the forward process. A clean sentence starts on the left. Each column moves rightward in time, and tokens are replaced by [M] (mask) according to a noise schedule. Watch which positions vanish first and which survive longest -- that is the schedule at work, not randomness in the animation.',
        {
          type: 'callout',
          text: 'Masked diffusion treats generation as a mutable slot buffer, not a left-to-right append log.',
        },
        'The parallel-denoise view shows the reverse process. A fully masked buffer appears at step 0. Each column reveals tokens the model commits at that step. Active highlights mark positions being committed now. Found highlights mark positions that remain masked because confidence is too low. The confidence ledger makes the gate explicit: margin scores determine who gets committed and who waits.',
        'The graph view connects the two. Follow the edges from prompt and mask buffer through the Transformer denoiser to logits, then through the confidence gate to either commit or remask. That loop is the entire sampler. Every frame in both views corresponds to one pass through this graph.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Autoregressive language models generate one token at a time, left to right. The probability factorization is clean: each token conditions on the prefix, and the KV cache makes reuse efficient. But the order is rigid. An autoregressive model cannot naturally fill three scattered blanks at once, revise the middle of a paragraph without regenerating everything after it, or spend a single forward pass resolving several easy positions while deferring hard ones.',
        'Discrete diffusion language models attack that rigidity. Instead of committing tokens in index order, they start from a corrupted sequence -- typically all mask tokens -- and learn to reverse the corruption. The reverse model sees bidirectional context (tokens on both sides of a gap) and can reveal positions in any order, chosen by confidence rather than by position. The goal is not to replace autoregressive decoding everywhere. It is to open a different generation contract: refinement over slots, where parallelism and flexible ordering are first-class.',
        {
          type: 'quote',
          text: 'Autoregressive models choose WHICH token next. Discrete diffusion models choose WHERE to commit next.',
          attribution: 'The core shift in generation contract',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep using autoregressive generation. If you need text, predict token 1, append it, predict token 2, continue. The serving path is mature, the KV cache is well understood, and streaming output is trivial because every new token extends the sequence. For chat and long-form continuation, this is hard to beat.',
        'A second obvious attempt is a BERT-style masked language model: hide 15% of tokens, train the model to recover them, done. That works well for learning representations and for single-shot infilling, but it is not automatically a generative sampler. BERT can score candidates for masked positions. It does not define a forward corruption schedule, a reverse denoising objective over many noise levels, or a sampling policy that decides which predictions become permanent state. The gap between "predict masked tokens" and "generate arbitrary text from scratch" is where discrete diffusion lives.',
        'A third attempt is continuous diffusion applied to language. Map each token to an embedding, run Gaussian noise forward and reverse, then round the denoised embedding back to the nearest token. This works in principle but introduces a lossy rounding step. Every reverse pass produces a continuous vector that must snap to a discrete vocabulary entry, and small errors in embedding space can map to entirely wrong tokens. Discrete diffusion avoids this by staying in token space throughout.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is token dependency. Predicting many masked positions in parallel is tempting, but language tokens are not independent pixels. A commitment at position 2 can change what belongs at position 5. If the sampler commits too aggressively, later denoising steps inherit contradictory context and spend work repairing it. If it commits too cautiously, it loses the hoped-for parallelism and becomes an expensive iterative decoder that is slower than autoregressive generation.',
        'The second wall is serving infrastructure. Autoregressive decoding has a simple cache: each new token appends to the prefix, and the KV cache grows monotonically. A masked diffusion sampler revisits a buffer whose visible positions can appear anywhere. The mask pattern changes every step. There is no simple append-only cache, so either the full sequence is recomputed each step or a more complex cache invalidation scheme is needed.',
        'The third wall is the gap between training and sampling. During training, the model sees partially corrupted text and predicts the original tokens. During sampling, it sees its own previous predictions -- which may be wrong -- and must build on them anyway. This train-sample mismatch is analogous to exposure bias in autoregressive models, but the geometry is different: errors can appear at any position, not just at the end of a growing prefix.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The framework has two halves: a fixed forward process that corrupts text, and a learned reverse process that recovers it. Austin et al. (2021) formalized this as D3PM -- Discrete Denoising Diffusion Probabilistic Models. The forward process is a Markov chain over a discrete state space (the token vocabulary plus a special absorbing state). At each timestep, each token independently transitions according to a noise matrix Q_t. The absorbing-state variant sets one column of Q_t to push every token toward [MASK] with increasing probability as t grows. By the final timestep, nearly every position is [MASK].',
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
        'Training works as follows. Take a clean sequence x_0. Sample a timestep t. Apply the forward noise matrix to produce x_t, where some tokens are replaced by [MASK] (in absorbing-state diffusion) or by random vocabulary tokens (in multinomial diffusion). Feed x_t and t into a Transformer. The model predicts the distribution over original tokens at every masked position. The loss is cross-entropy between the predicted distribution and the true x_0 tokens, summed over masked positions. This is structurally identical to BERT masked language modeling, but the key difference is that the mask rate varies with t, covering the full range from lightly corrupted to fully masked.',
        'Sampling starts from a fully masked buffer. At each reverse step, the Transformer predicts token distributions for all masked positions. A confidence gate -- typically top-token probability or margin between the top two candidates -- decides which positions to commit. High-confidence positions become visible tokens in the buffer. Low-confidence positions stay masked for another round. Some samplers (MDLM, Sahoo et al. 2024) also support remasking: a committed token can be returned to [MASK] if later context makes it look inconsistent. The process terminates when the mask set is empty or the step budget runs out.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because each committed token provides bidirectional evidence for the remaining masked positions. In an autoregressive model, position 5 can only see positions 1-4. In a masked diffusion model, position 5 sees every currently visible position -- including positions 6, 7, 8 if they were committed in an earlier step. This bidirectional conditioning means the model has strictly more information when predicting hard positions, which is exactly when more information matters most.',
        'The confidence gate is what makes parallel commitment safe. Without it, committing all predictions simultaneously would be rolling a die at every position and hoping the results are jointly coherent. The gate converts parallel prediction into selective commitment: easy positions (function words, determiners, predictable tokens) get locked in early, providing scaffolding for harder positions (rare nouns, ambiguous verbs, long-range dependencies) in later steps. The invariant is that visible tokens at any step represent the sampler\'s best current belief about the final sequence, and the gate ensures that belief only solidifies when confidence warrants it.',
        {
          type: 'note',
          text: 'The connection to BERT is real but incomplete. BERT trains with a fixed 15% mask rate and no notion of timesteps. Discrete diffusion trains across all mask rates (0% to 100%) so the model learns to denoise from any corruption level. BERT predicts independently per position. Discrete diffusion adds a multi-step sampling loop with a confidence gate. BERT is a snapshot of the training objective; discrete diffusion is the full generative framework built on top of it.',
        },
        'D3PM further justifies the framework by deriving a variational lower bound on the data log-likelihood, analogous to the ELBO in continuous diffusion. The forward and reverse Markov chains define a latent-variable model, and the training loss is a tractable bound on the negative log-likelihood. This gives discrete diffusion a principled probabilistic footing, not just a heuristic masking recipe.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost is the number of reverse steps times the cost of one Transformer forward pass. If the sampler takes T steps and each pass costs the same as one autoregressive step, the total compute is T times the sequence length (because all positions are processed each step, not just the new one). Autoregressive generation costs N forward passes for N tokens, but each pass only attends to the growing prefix. Discrete diffusion costs T full-sequence passes, where T is typically 10-256 steps.',
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
        'The confidence threshold creates a throughput-quality tradeoff. A low threshold commits more tokens per step, reducing total steps but risking inconsistency. A high threshold preserves quality but may need nearly as many steps as there are tokens, losing the parallelism advantage. The useful metrics are: steps per output sequence, tokens committed per step, remask count, and quality on the target task. Tokens per second alone hides the repair loop.',
        'Memory cost per step is roughly the same as one autoregressive forward pass (the full model processes the full sequence). But the total memory over sampling is higher because there is no simple KV cache to amortize past computation. Some recent work (MDLM, LLaDA) explores caching strategies for masked diffusion, but the infrastructure is less mature than autoregressive serving stacks.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Discrete diffusion is strongest when the task is not pure left-to-right continuation. Infilling -- filling in blanks where context exists on both sides -- is the most natural fit. Code repair, constrained editing, template completion with scattered slots, and bidirectional revision all benefit from a model that conditions on both sides of every gap rather than only on the prefix.',
        'It also wins when flexible generation order matters. A discrete diffusion model can commit easy tokens first and defer ambiguous positions, which is a form of adaptive computation allocation. If some tokens in a sentence are nearly determined by context (articles, prepositions, closing brackets) while others require real deliberation (technical nouns, numerical values), the model can resolve the easy ones in bulk and focus remaining steps on the hard ones.',
        'The research angle is inference-time compute scaling. Autoregressive models scale inference compute by generating more tokens (chain-of-thought, best-of-N sampling). Discrete diffusion models scale by adding more denoising steps, remasking and re-predicting, or running the confidence gate at different thresholds. These are structurally different knobs, and early results (LLaDA, MDLM) suggest they can improve quality in ways that autoregressive scaling does not.',
        {
          type: 'note',
          text: 'D3PM defines three noise types: absorbing (tokens go to [MASK]), uniform multinomial (tokens jump to random vocabulary entries), and discretized Gaussian (tokens shift to nearby entries in an ordered vocabulary). Absorbing-state diffusion dominates in practice because the [MASK] token cleanly separates "unknown" from "committed," making the confidence gate straightforward. Multinomial noise is harder to work with because a corrupted token looks like a real token, and the model must learn to distrust its own input.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The method is the wrong tool when the production constraint is streaming latency and the autoregressive KV cache already dominates. A user watching tokens appear one by one in a chat interface does not benefit from parallel slot commitment -- the bottleneck is model speed, not generation order. Discrete diffusion adds complexity (mask scheduling, confidence gating, multi-step sampling) without improving the user-visible metric.',
        'It also fails when token dependencies are tight and sequential. Mathematical derivations, formal proofs, code with strict syntax constraints, and long-range narrative arcs all have the property that an early wrong token poisons many later positions. The confidence gate can delay commitment, but it cannot fix the fundamental problem: some sequences have a natural causal order, and ignoring that order makes the prediction task harder, not easier.',
        'Weak confidence gates make the system brittle. If the gate commits too early, the visible buffer accumulates errors that later steps cannot repair. If the gate is too conservative, the sampler degenerates into a slow serial decoder that is worse than autoregressive generation because it lacks the efficient KV cache. Tuning the gate threshold, remasking policy, and step budget per task is nontrivial engineering work that the autoregressive path avoids entirely.',
        'Finally, the infrastructure gap is real. Autoregressive serving has years of engineering behind KV caches, speculative decoding, quantization-aware serving, and batching strategies. Discrete diffusion serving is young. Claims about speed advantages should be read carefully: check whether they report wall-clock time including all denoising steps, whether quality is measured on the same benchmarks, and whether the comparison accounts for the maturity difference in serving stacks.',
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
