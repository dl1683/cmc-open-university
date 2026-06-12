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
      heading: `What it is`,
      paragraphs: [
        `Gradient flow is the learning signal traveling backward through a network. Backpropagation applies the chain rule, so every layer contributes another multiplier. If those multipliers are mostly below 1, the signal vanishes before it reaches early layers. If they are above 1, it explodes into NaN. The demo plots both diseases over ten layers, making the old deep-learning bottleneck arithmetic rather than mysterious: depth turns small scale errors into exponential effects.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A sigmoid derivative is never bigger than 0.25, the saturation fact you also meet in Logistic Regression. After nine such multiplications, the first layer receives 0.25^9, about 0.0000038, so it is effectively frozen. Change the factor to 1.5 and the same chain becomes 1.5^9, about 38; in deeper nets it becomes a numerical explosion. The safe corridor is narrow: per-layer factors need to stay near 1 throughout training.`,
        `The fixes all attack that product. Activation Functions such as ReLU have slope 1 on the active side. Careful initialization keeps variance near constant. Residual connections add an identity path, so d(x + f(x))/dx includes a guaranteed 1. BatchNorm & LayerNorm keep activations out of saturated zones, and gradient clipping caps rare explosions. None changes the chain rule; each keeps the factors survivable.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The backward pass is still O(parameters). The stability tools are cheap: a max for ReLU, one add for a residual branch, O(activations) normalization, and one global norm for clipping. Their value is not speed per step; it is making the step meaningful. Without flow, Gradient Descent has nothing useful to follow, so the cheapest training loop becomes expensive by wasting epochs.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Modern networks stack the whole armor. The Transformer Block uses GELU-like activations, residual streams, LayerNorm, careful initialization, and gradient clipping. Learning-Rate Schedules & Warmup then controls how hard those stable gradients are used. Momentum, RMSProp & Adam helps with direction and scale, but it cannot invent signal that never reached a layer. When a loss curve plateaus early or prints NaN, per-layer gradient norms are one of the first diagnostics to inspect.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Vanishing gradients are not an unavoidable tax of depth; they are usually a bad architecture plus a bad scale. Clipping does not cure an exploding architecture, it limits the damage from a bad batch. A stable gradient is also not automatically useful: if activations are dead, labels are wrong, or the objective is mis-specified, the model may still fail. Look at gradient norms alongside activations and validation behavior before blaming a single component.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `The next step is to connect the math to architecture. Follow the chain rule page for the derivative mechanics, the activation page for slopes, the normalization page for scale control, and the transformer page for the residual stream. Together they explain why stacks that failed in the 1990s train routinely now.`,
        `When debugging, separate a small gradient from a useless gradient. A small but structured signal may learn with a better rate or longer run; a zeroed signal after saturated activations will not. Layerwise norms, activation histograms, and NaN checks tell you which case you are in.`,
        `The same distinction matters in research papers. A method that merely clips a bad spike is different from a method that keeps signal alive throughout the stack. That distinction changes whether you lower the rate or redesign the block.`,
      ],
    },
  ],
};
