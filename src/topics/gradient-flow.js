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
        `Gradient flow is the learning signal flowing backward through a neural network. When you train, you compute a loss, then ask: which weight changes lower it? Backpropagation finds the answer by walking backward through every layer, multiplying local derivatives using the chain rule. The problem: a chain of multiplications over many layers can collapse to near-zero (vanishing) or explode to infinity, halting learning. This visualization shows why deep networks seemed impossible for decades — and the three fixes that unlocked them.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The chain rule: if f(g(h(x))) is your composition, then the derivative is f′ × g′ × h′ — a product of local derivatives. A neural network is exactly that: each layer contributes one factor. A sigmoid derivative σ′(z) is at most 0.25. Multiply it by itself nine times: 0.25⁹ ≈ 0.0000038. Layer 1 receives nearly zero signal — it learns almost nothing. This is vanishing. Flip it: make the per-layer factor 1.5, and 1.5⁹ ≈ 38 — explosive growth to NaN. The safe corridor is razor-thin: each factor must hug 1.0 precisely, across all layers, through all training. Three fixes hold it there: ReLU (derivative exactly 1) plus He/Xavier initialization (0.95⁹ ≈ 0.63, alive), residual connections (d(x + f(x))/dx = 1 + f′, identity highway), LayerNorm/BatchNorm (re-center activations), and gradient clipping (cap the norm). Each works on the same theorem: keep the product near 1.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Backward pass is O(n_params), same as forward. The cost is numerical stability, not compute: vanishing means no learning signal reaches early layers, exploding means loss becomes NaN. The fixes cost nearly nothing — ReLU is one max, initialization is one-time, residuals are one add, normalization is O(n), clipping is one norm — yet buy the ability to train 100× deeper networks.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every network you have trained depends on these fixes. ReLU with He init (post-2012) enabled the deep-learning breakout. Residual connections (2015) jumped VGG (19 layers, straining) to ResNet (152, stable). Transformers wrap skip connections around every sublayer, allowing 100-layer LLMs where a plain stack would vanish. Batch and Layer normalization keep activations on steep, healthy nonlinearity slopes. Gradient clipping runs in every LLM training loop — inelegant, but one clipped step prevents NaN and saves millions in compute.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Misconception: vanishing/exploding gradients are inherent to depth. False. They are design failures. Sigmoid + random init + no residuals produces vanishing; that is not depth's fault, it is the architecture's. A properly designed ReLU network or ResNet has alive gradients at 152 layers. Another trap: gradient clipping does not fix explosion, it suppresses symptoms. Good architecture (right activation, initialization, residuals, normalization) should not explode; clipping is a safety net. Finally: a stable gradient is not necessarily useful — a layer with zero updates learns nothing, even if the gradient is alive.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Gradient flow comes directly from Backpropagation; learn that first. The signal you flow with is used by Gradient Descent to step downhill. Study Transformer Block to see skip connections, LayerNorm, and attention working together for stable 96+ layer depth. Dropout and Regularization reshape gradient flow too. And when your training plateaus mysteriously, understanding gradient flow — checking per-layer norms — is the first debugging move a real researcher makes.`,
      ],
    },
  ],
};
