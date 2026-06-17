// Gradient flow: the chain rule is a chain of multiplications, and a long
// product of numbers below one is zero in disguise. Why deep nets were
// untrainable for decades — and the three fixes that ended it.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gradient-flow',
  title: 'Vanishing & Exploding Gradients',
  category: 'AI & ML',
  summary: 'Backprop multiplies a factor per layer — below 1 the signal starves, above 1 it detonates. Depth was unusable until three fixes.',
  controls: [
    { id: 'view', label: 'Follow', type: 'select', options: ['the signal dying layer by layer', 'the fixes that made depth possible'], defaultValue: 'the signal dying layer by layer' },
  ],
  run,
};

const DEPTHS = Array.from({ length: 10 }, (_, i) => i + 1);
// Gradient magnitude reaching layer (10 − k): one multiplicative factor per layer.
const chain = (factor) => DEPTHS.map((d) => ({ x: d, y: factor ** (10 - d) }));

function* dying() {
  yield {
    state: matrixState({
      title: 'Backprop through 10 sigmoid layers: one multiplication each',
      rows: [{ id: 'rule', label: 'chain rule' }],
      columns: [{ id: 'formula', label: '' }],
      values: [[1]],
      format: () => 'grad(layer 1) = grad(loss) × f₁₀′ × f₉′ × … × f₂′',
    }),
    highlight: { active: ['rule:formula'] },
    explanation: 'Backpropagation\'s engine is the chain rule, and the chain rule is a PRODUCT: the gradient reaching layer 1 is the loss gradient multiplied by one local derivative per layer passed through. Each sigmoid contributes σ′(z) — at very best 0.25, usually less (the saturation flats of the S-curve from Logistic Regression give nearly 0). A product of ten numbers each ≤ 0.25 — multiply it out before scrolling on. This arithmetic, not a lack of ideas, is why neural networks stalled at 2–3 layers for twenty years.',
    invariant: 'A product of per-layer factors below 1 shrinks exponentially with depth.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [{ id: 'vanish', label: 'sigmoid chain (×0.25/layer)', points: chain(0.25) }],
      markers: [{ id: 'dead', x: 1, y: 0.25 ** 9, label: '0.0000038' }],
    }),
    highlight: { removed: ['dead'], active: ['vanish'] },
    explanation: 'The product, plotted. The output layer gets gradient 1; nine multiplications later, layer 1 receives 0.25⁹ ≈ 0.0000038 — four MILLIONTHS of the signal. Layer 1 is not learning slowly; on any practical clock it is frozen, while the layers nearest the loss race ahead. This is the VANISHING GRADIENT: the early layers — the ones that must learn the basic features everything else builds on — are precisely the ones the learning signal cannot reach. The same disease killed early RNNs along the time axis: by 30 timesteps back, the gradient is archaeology.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [
        { id: 'vanish', label: '×0.25 → starves', points: chain(0.25) },
        { id: 'explode', label: '×1.5 → detonates', points: chain(1.5) },
      ],
      markers: [{ id: 'boom', x: 1, y: 1.5 ** 9, label: '≈38' }],
    }),
    highlight: { compare: ['vanish', 'explode'], removed: ['boom'] },
    explanation: 'The evil twin: make the per-layer factor 1.5 — large weights do it — and the same arithmetic runs in reverse: 1.5⁹ ≈ 38× amplification, and in a 50-layer net, 1.5⁴⁹ ≈ 600 million. Weights take a single enormous step, the loss prints NaN, training is dead. EXPLODING gradients are vanishing\'s mirror — both are the same theorem about long products, and notice how absurdly narrow the safe corridor is: the per-layer factor must hug 1.0 almost exactly, across every layer, for the whole of training. Depth is a tightrope.',
    invariant: 'Stable depth requires the per-layer gradient factor to stay near 1 — above explodes, below starves.',
  };

  yield {
    state: matrixState({
      title: 'The two diseases at the bedside',
      rows: [{ id: 'van', label: 'vanishing' }, { id: 'exp', label: 'exploding' }],
      columns: [{ id: 'sym', label: 'symptom' }, { id: 'cause', label: 'mechanism' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'early layers frozen, loss plateaus', 'product of factors < 1', 'loss spikes to NaN', 'product of factors > 1'][v],
    }),
    highlight: { compare: ['van:sym', 'exp:sym'] },
    explanation: 'The diagnostic table — and both rows were considered fatal. The 1991 diagnosis (Hochreiter\'s thesis, later the LSTM motivation) made it look structural: depth multiplies factors, multiplication is unforgiving, therefore deep networks cannot train. Every modern architecture you have studied on this site is, at its core, a scheme for smuggling gradient past this product. The next view shows the three smuggling routes.',
  };
}

function* fixes() {
  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [
        { id: 'sigmoid', label: 'sigmoid chain', points: chain(0.25) },
        { id: 'relu', label: 'ReLU + good init', points: chain(0.95) },
      ],
      markers: [{ id: 'alive', x: 1, y: 0.95 ** 9, label: '0.63 — alive!' }],
    }),
    highlight: { found: ['relu', 'alive'], visited: ['sigmoid'] },
    explanation: 'Fix 1 — CHANGE THE FACTOR: ReLU, max(0, z). Its derivative is exactly 1 for every active unit — not 0.25, not a saturating curve: 1. The per-layer factor becomes the weight scale alone, and proper initialization (He/Xavier — draw starting weights so each layer preserves signal variance) pins that near 1. The product 0.95⁹ ≈ 0.63: layer 1 hears the loss loud and clear. This pairing — ReLU plus principled init — is a quiet hero of the 2012 deep-learning breakout: the difference between 0.25 and 0.95 per layer is the difference between 4 millionths and two-thirds.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'layer (1 = earliest)' }, y: { label: 'gradient magnitude arriving' } },
      series: [
        { id: 'plain', label: 'plain chain', points: chain(0.25) },
        { id: 'residual', label: 'residual: identity floor', points: DEPTHS.map((d) => ({ x: d, y: 1 + 0.25 ** (10 - d) })) },
      ],
    }),
    highlight: { found: ['residual'], removed: ['plain'] },
    explanation: 'Fix 2 — BUILD A BYPASS: residual connections. A ResNet block computes x + f(x) instead of f(x), and differentiate that: the gradient factor is 1 + f′ — there is ALWAYS a 1, an identity highway the gradient rides untouched, with f′ as a bonus lane. The product of (1 + small) terms never collapses to zero no matter the depth. This single plus sign took networks from 19 layers (VGG, straining) to 152 (ResNet, 2015) overnight, and it is the same skip connection you saw wrapping every sublayer of the Transformer Block — no residual stream, no 100-layer LLMs.',
    invariant: 'd(x + f(x))/dx = 1 + f′: the identity path guarantees a gradient floor at every depth.',
  };

  yield {
    state: matrixState({
      title: 'Fix 3 — keep every layer in the comfortable zone',
      rows: [{ id: 'norm', label: 'normalization (LayerNorm/BatchNorm)' }, { id: 'clip', label: 'gradient clipping' }],
      columns: [{ id: 'does', label: 'what it does' }, { id: 'guards', label: 'guards against' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 're-centers activations to mean 0, var 1 each layer', 'saturation → vanishing', 'caps gradient norm at a ceiling (e.g. 1.0)', 'explosion → NaN'][v],
    }),
    highlight: { active: ['norm:does'], compare: ['clip:does'] },
    explanation: 'Fix 3 — POLICE THE SCALE: normalization layers re-standardize activations at every layer (mean 0, variance 1), so inputs stay on the steep, healthy part of every nonlinearity instead of drifting into saturated flats as training shifts the distributions. And for the exploding side, the bluntest tool in the kit: GRADIENT CLIPPING — if the gradient norm exceeds a ceiling, rescale it down. Inelegant, unprincipled, and it is in the training loop of essentially every LLM, because one detonated batch otherwise erases a million dollars of progress.',
  };

  yield {
    state: matrixState({
      title: 'Why your 100-layer transformer trains at all',
      rows: [
        { id: 'relu', label: 'ReLU-family activations' },
        { id: 'init', label: 'He/Xavier init' },
        { id: 'res', label: 'residual connections' },
        { id: 'norm', label: 'LayerNorm + clipping' },
      ],
      columns: [{ id: 'where', label: 'where you have seen it' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'every hidden layer since 2012 (GELU in transformers)', 'the silent default in every framework', 'Transformer Block, ResNet — the + in x + f(x)', 'twice per transformer layer; every LLM training loop'][v],
    }),
    highlight: { found: ['res:where'] },
    explanation: 'The full armor, assembled. A modern transformer stacks ALL of these — GELU activations, scaled initialization, a residual highway past every sublayer, LayerNorm twice per block, clipping at the optimizer — and that is why "just stack 96 layers" works in 2026 when 5 layers failed in 1996. The arithmetic never changed; a product of 96 factors is as merciless as ever. Engineering changed: every factor is now held so close to 1 that the product survives. When a training run of yours plateaus mysteriously or NaNs at 3 a.m., check the gradient norms per layer first — this page is the chart the doctors read.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the signal dying layer by layer') yield* dying();
  else if (view === 'the fixes that made depth possible') yield* fixes();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `Why gradient flow matters`,
      paragraphs: [
        `Gradient flow is the question of whether the learning signal can travel from the loss back to the early layers of a neural network without being destroyed. A model can have the right data, the right labels, and enough parameters, but if the first layers receive almost no gradient, they do not learn the basic features that every later layer depends on. If the gradient becomes enormous instead, the optimizer takes a destructive step and training can jump to infinity or NaN. Depth is useful only if the backward signal survives the trip.`,
        `This topic exists because early neural networks did not fail mainly from lack of imagination. They failed because the arithmetic of backpropagation punished depth. Backprop applies the chain rule. The chain rule multiplies one local derivative after another. A long product of numbers slightly below one shrinks exponentially. A long product of numbers slightly above one grows exponentially. That is the whole disease in one sentence. Modern deep learning is partly the story of keeping that product in a narrow healthy range.`,
      ],
    },
    {
      heading: `The naive deep-network plan`,
      paragraphs: [
        `The naive plan is simple: stack many nonlinear layers, run backpropagation, and let gradient descent discover useful features at every level. The plan works on paper because every layer is differentiable. It fails in practice when those derivatives have the wrong scale. A sigmoid unit, for example, has derivative at most 0.25, and it is much smaller when the unit is saturated near 0 or 1. Ten layers of sigmoids do not pass back one derivative. They pass back a product of ten derivatives.`,
        `The demo's first plot uses the generous case where every sigmoid contributes 0.25. By the time the signal reaches the earliest layer, it has been multiplied by 0.25 nine times. That is about 0.0000038 of the original signal. The early layer is not merely learning slowly. It is effectively disconnected from the objective. The loss may keep changing because the last layers are learning, but the feature extractor at the front is frozen. The same logic appears in recurrent networks across time, where gradients must travel through many repeated steps to assign credit to events far in the past.`,
      ],
    },
    {
      heading: `The opposite failure`,
      paragraphs: [
        `Vanishing gradients are only half the problem. If the effective factor per layer is above one, the same product runs in reverse. A factor of 1.5 looks harmless in isolation. Over nine multiplications it becomes about 38. Over dozens of layers it can become millions or billions. Then one backward pass produces a step so large that parameters leave any useful region of the loss surface. The run may show a sudden loss spike, overflow, or NaN.`,
        `This is why "just use bigger gradients" is not a solution. Deep training needs a stable flow, not maximum force. The per-layer factors must remain close enough to one that useful information reaches the early layers without turning into a numerical blast. The corridor is narrow because depth compounds small scale errors. A factor of 0.95 can survive ten layers. A factor of 0.25 cannot. A factor of 1.05 may be tolerable for a short stack and dangerous for a very deep one.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is that depth is a scale-management problem. Backpropagation is not broken; the chain rule is doing exactly what it should do. The question is whether the architecture and initialization make each local Jacobian preserve, shrink, or amplify signal. For a scalar toy chain, this looks like multiplying numbers. For a real network, it is a product of matrices, but the same idea survives: singular values far below one erase directions in gradient space, and singular values far above one amplify them.`,
        `Once you see gradient flow as a product, the major inventions line up. ReLU-like activations avoid the always-small slope of sigmoids on their active side. Careful initialization tries to preserve variance forward and backward before training starts. Residual connections create an identity path so the gradient has a route around a difficult transformation. Normalization keeps activations in ranges where derivatives are usable. Clipping limits rare explosions. These are not unrelated tricks. They are different ways to keep the chain-rule product alive.`,
      ],
    },
    {
      heading: `What the visual is proving`,
      paragraphs: [
        `The first view proves that a vanishing gradient is not a vague complaint about deep networks. It is a plotted product. The output layer begins with a normal signal. Each step backward multiplies that signal by another local derivative. The curve collapses toward zero as it approaches the first layer. The important feature is the shape, not the exact number. Exponential shrinkage means the earliest layers are always hit hardest, even though they often need the most guidance because they learn the primitive representation.`,
        `The comparison with an exploding factor proves the symmetry. The same chain-rule machinery that can starve early layers can also overfeed them. In a real training log, these two diseases look different: vanishing gradients produce plateaus, dead features, and layers whose weights barely move; exploding gradients produce unstable loss, huge parameter updates, and NaNs. The visual joins them under one cause. A deep network is trainable only when its backward scale stays controlled across many layers and many optimization steps.`,
      ],
    },
    {
      heading: `How modern architectures keep signal alive`,
      paragraphs: [
        `A residual block changes the derivative in a decisive way. Instead of learning only f(x), the block returns x + f(x). Differentiate that expression and the backward path contains an identity term. Even if f has a weak or badly scaled derivative, the x path gives the gradient a clean route through the block. This is why residual streams are central in ResNets and transformers. They turn a long chain of transformations into a long chain with bypasses.`,
        `Normalization and initialization solve a different part of the problem. Activations can drift during training. If they drift into saturated regions, gradients shrink even if the architecture looked safe at initialization. BatchNorm and LayerNorm re-center and rescale intermediate values so layers keep operating in useful ranges. He and Xavier initialization choose starting weight scales so signals do not explode or disappear before training has even begun. Gradient clipping is the emergency brake. It does not make a bad architecture good, but it can stop one extreme batch from destroying the run.`,
      ],
    },
    {
      heading: `Costs, tradeoffs, and diagnostics`,
      paragraphs: [
        `Most gradient-flow fixes are cheap compared with the matrix multiplications in a neural network. ReLU is just a threshold. A residual connection adds tensors. LayerNorm costs a pass over activations to compute mean and variance. Clipping computes a norm and rescales when needed. The tradeoff is usually not raw complexity; it is behavior. Normalization can interact with batch size or sequence layout. Clipping can hide an overly aggressive learning rate. Residual paths can let very deep models train while making it harder to reason about exactly where computation happens.`,
        `The practical diagnostic is to measure by layer. A single global gradient norm can look healthy while early layers are silent. Inspect per-layer gradient norms, activation statistics, parameter update sizes, and the first step that produces NaN. If gradients vanish, look for saturated activations, bad initialization, missing residuals, or a loss signal that is too weak. If they explode, look at learning rate, initialization scale, normalization placement, and whether clipping is active. Good debugging separates "no signal arrived" from "a signal arrived but the objective is wrong."`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study the chain rule first, because it is the mechanical source of the product. Then study activation functions to understand why sigmoid saturation was so damaging and why ReLU-family activations changed the default. Study initialization to see how signal variance is preserved before the first update. Study residual connections and the transformer block to see how identity paths made hundred-layer networks ordinary. Study normalization to understand why scale must be managed during training, not only at step zero.`,
        `After that, connect gradient flow to optimization. Momentum, RMSProp, and Adam can shape a gradient that exists, but they cannot recover information that never reached a layer. Learning-rate warmup can prevent early explosions, but it cannot fix a saturated stack by itself. Loss landscapes explain where the optimizer is trying to go; gradient flow explains whether the optimizer can even feel the slope from the layers that matter. A stable deep model needs both a navigable landscape and a surviving backward signal.`,
      ],
    },
  ],
};
