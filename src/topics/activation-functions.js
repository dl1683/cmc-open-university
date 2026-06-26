// Activation functions: the nonlinearity that lets neural networks learn
// curves instead of lines. Sigmoid, tanh, ReLU: same job, different rules.

import { plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'activation-functions',
  title: 'Activation Functions',
  category: 'AI & ML',
  summary: 'Sigmoid, tanh, and ReLU compared on one chart, and why networks need nonlinearity at all.',
  controls: [
    { id: 'focus', label: 'Spotlight', type: 'select', options: ['tour all three', 'sigmoid', 'tanh', 'relu'], defaultValue: 'tour all three' },
  ],
  run,
};

const FUNCS = [
  {
    id: 'sigmoid', label: 'sigmoid', fn: (x) => 1 / (1 + Math.exp(-x)),
    blurb: 'SIGMOID squashes inputs into (0, 1), so it still fits binary classifier heads where the output is probability-like. Its hidden-layer flaw is saturation: for |x| > 4 the curve is nearly flat, so the derivative is nearly zero. Stack many sigmoid layers and the gradient arriving at early layers can fade before those layers learn.',
  },
  {
    id: 'tanh', label: 'tanh', fn: (x) => Math.tanh(x),
    blurb: 'TANH is sigmoid\'s centered sibling: range (-1, 1), zero in the middle. Zero-centered outputs make optimization smoother, which is why tanh was a strong default in many older recurrent networks. It still has the same disease in the tails: flat regions produce weak gradients.',
  },
  {
    id: 'relu', label: 'ReLU', fn: (x) => Math.max(0, x),
    blurb: 'ReLU is max(0, x). The positive side has slope exactly 1, so gradients can pass through deep stacks without being repeatedly shrunk by a saturating curve. Its flaw is the zero side: a unit stuck on negative inputs outputs 0 with 0 gradient. Leaky ReLU and GELU-like variants soften that dead-zone behavior.',
  },
];

const xs = Array.from({ length: 81 }, (_, i) => -6 + i * 0.15);
const series = (subset) => subset.map((f) => ({
  id: f.id,
  label: f.label,
  points: xs.map((x) => ({ x, y: f.fn(x) })),
}));
const AXES = { x: { label: 'input x' }, y: { label: 'output' } };

const ROUND = 4;
const fmt = (v) => Math.round(v * (10 ** ROUND)) / (10 ** ROUND);
const derivSigmoid = (x) => {
  const s = 1 / (1 + Math.exp(-x));
  return s * (1 - s);
};
const derivTanh = (x) => {
  const t = Math.tanh(x);
  return 1 - t * t;
};
const derivRelu = (x) => (x > 0 ? 1 : 0);

export function* run(input) {
  const focus = String(input.focus);
  if (!['tour all three', 'sigmoid', 'tanh', 'relu'].includes(focus)) {
    throw new InputError('Pick an activation to focus on.');
  }

  const traceXs = [-6, -4, -2, -1, -0.5, 0, 0.5, 1, 2, 4, 6];

  yield {
    state: plotState({
      axes: AXES,
      title: 'Step 1: linear baseline before activation',
      series: [{ id: 'line', label: 'no activation', points: xs.map((x) => ({ x, y: x / 6 })) }],
    }),
    highlight: { active: ['line'] },
    explanation: `Linear stack would be y = x / 6, slope ${fmt(1 / 6)} everywhere and no bends. At every sampled input, there is no threshold, so stacking stays one line. This is why we need nonlinearity.`,
    invariant: 'Without a nonlinear bend, depth does not add representational classes of function.',
  };

  const chosen = focus === 'tour all three' ? FUNCS : FUNCS.filter((f) => f.id === focus);
  const shown = [];
  for (const f of chosen) {
    shown.push(f);
    const sampled = traceXs.slice(0, 6).map((x) => `${x}->${fmt(f.fn(x))}`).join('; ');
    const derivName = f.id === 'sigmoid' ? 's(1-s)' : f.id === 'tanh' ? '1-tanh²' : '0 or 1';
    const sampleDeriv = traceXs.slice(0, 3).map((x) => `${x}->${fmt(f.id === 'sigmoid' ? derivSigmoid(x) : f.id === 'tanh' ? derivTanh(x) : derivRelu(x))}`).join('; ');
    yield {
      state: plotState({ axes: AXES, series: series(shown), title: `${f.label} values entering` }),
      highlight: { active: [f.id], visited: shown.slice(0, -1).map((s) => s.id), compare: [f.id] },
      explanation: `${f.label} computes these sample outputs: ${sampled}. Example derivatives use ${derivName}: at x=0 it's ${fmt(f.id === 'sigmoid' ? derivSigmoid(0) : f.id === 'tanh' ? derivTanh(0) : derivRelu(0))}. Early samples at x=-6,-4,-2: ${sampleDeriv}.`,
    };
  }

  const pointsAsSamples = traceXs.map((x) => ({
    x,
    sigmoid: fmt(FUNCS[0].fn(x)),
    tanh: fmt(FUNCS[1].fn(x)),
    relu: fmt(FUNCS[2].fn(x)),
    dSig: fmt(derivSigmoid(x)),
    dTan: fmt(derivTanh(x)),
    dRel: fmt(derivRelu(x)),
  }));

  const f = chosen[0];
  const deriv = f.id === 'sigmoid' ? derivSigmoid : f.id === 'tanh' ? derivTanh : derivRelu;
  for (const x of traceXs) {
    const y = f.fn(x);
    const d = deriv(x);
    yield {
      state: plotState({
        axes: AXES,
        title: `${f.label} sample sweep at x=${x}`,
        series: [
          ...series([f]),
          { id: `probe-${f.id}-${x}`, label: `${f.label} @ ${x}`, points: [{ x, y }] },
        ],
      }),
      highlight: { active: [f.id], found: [`probe-${f.id}-${x}`], compare: ['sigmoid', 'tanh', 'relu'] },
      explanation: `${f.label} at x=${x}: value=${fmt(y)}, derivative=${fmt(d)}. Nearby comparison points: sigmoid=${fmt(pointsAsSamples.find((p) => p.x === x)?.sigmoid)}, tanh=${fmt(pointsAsSamples.find((p) => p.x === x)?.tanh)}, relu=${fmt(pointsAsSamples.find((p) => p.x === x)?.relu)}.`,
      invariant: 'A nonlinearity is useful only where this pair (value, derivative) remains informative.',
    };
  }

  const compareText = pointsAsSamples.map(({ x, sigmoid, tanh, relu, dSig, dTan, dRel }) => `x=${x}: s=${sigmoid}/ds=${dSig}, t=${tanh}/dt=${dTan}, r=${relu}/dr=${dRel}`).join(' | ');
  const finalSeries = focus === 'tour all three' ? FUNCS : [f];
  yield {
    state: plotState({ axes: AXES, series: series(finalSeries), title: 'Final comparison and saturation regions' }),
    highlight: { active: finalSeries.map((fnDef) => fnDef.id), compare: ['sigmoid', 'tanh', 'relu'] },
    explanation: `Compare the sampled sweep in one line: ${compareText}. ` +
      'At |x|=6, sigmoid and tanh values are nearly stable and derivatives are tiny, while ReLU is either exactly 0 or linear with derivative 1. The computed sweep is the evidence for where each activation keeps signal and where it discards it.',
    invariant: 'Each activation’s practical behavior is the combination of output magnitude and derivative for the inputs you actually query.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The plot shows input x on the horizontal axis and activation output on the vertical axis. Each curve is one activation function applied element-wise to every neuron\'s output. The active highlight marks the function currently being introduced; visited markers show functions already plotted for comparison.',
        'Watch the slope of each curve, not just its shape. Steep regions are where the derivative is large and gradients flow during training. Flat regions are where the derivative is near zero and gradients vanish. The first frame draws a plain linear function to establish the baseline that activation functions must break.',
        'After all three curves appear, compare them directly: sigmoid saturates at both extremes, tanh saturates at both extremes but is zero-centered, and ReLU has constant slope on the positive side but is exactly zero on the negative side. Across every frame, steeper slope means stronger trainability.',
        {type: "callout", text: "An activation is both a bend in the forward map and a gate for gradient flow during training."},

        {type: 'image', src: './assets/gifs/activation-functions.gif', alt: 'Animated walkthrough of the activation functions visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A neural network layer computes an affine transformation: multiply inputs by a weight matrix, add a bias vector, pass the result onward. An affine transformation is a linear map plus a constant offset, meaning it can only produce hyperplanes, not curves. If every layer did only that, depth would be an illusion. The composition of two affine maps A(x) = Wx + b and C(y) = Vy + d is C(A(x)) = V(Wx + b) + d = (VW)x + (Vb + d), which is itself one affine map. A hundred such layers collapse to a single matrix multiply plus one bias vector. The model may carry millions of parameters, but its input-output relationship is still a flat hyperplane.',
        'Activation functions are the bends inserted between those affine maps. They let a network build curves, thresholds, regions, and piecewise surfaces. A layer creates weighted combinations; the activation decides how those combinations pass forward. Stack that pattern many times and the model can approximate complicated nonlinear functions.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`, alt: `Layered neural network diagram with colored nodes`, caption: `The layer stack shows why nonlinear bends between affine maps are needed for depth to add expressive power. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.`},
        'The activation also controls learning. Backpropagation (the algorithm that computes how each weight should change) sends gradients backward through every operation, multiplying local derivatives at each step. If an activation has useful slope where neurons operate, gradients pass through. If it is flat, gradients shrink toward zero. If it outputs exactly zero with zero derivative, the neuron stops learning entirely. An activation is therefore both a forward modeling choice and a backward optimization choice.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The earliest neural networks used sigmoid as the activation everywhere. Sigmoid, defined as sigma(x) = 1 / (1 + e^(-x)), squashes any real number into the range (0, 1). It is smooth, differentiable, and has an appealing probabilistic interpretation. Tanh, defined as tanh(x) = (e^x - e^(-x)) / (e^x + e^(-x)), is similar but maps to (-1, 1), centering the output around zero.',
        'Both seemed natural. Sigmoid gave outputs between 0 and 1 that could be read as probabilities. Tanh centered those outputs so the next layer received a mix of positive and negative values, which makes weight updates less biased in sign. For shallow networks with one or two hidden layers, both worked well enough.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sigmoid and tanh both saturate: for large positive or negative inputs, the output curve flattens and the derivative drops toward zero. The peak derivative of sigmoid is 0.25, occurring at x = 0. At x = 5, the derivative is about 0.0067. Backpropagation multiplies derivatives across layers. In a 10-layer network where every hidden activation passes through a sigmoid at its peak, the gradient reaching the first layer is at most 0.25^10, which is roughly 10^(-6). In practice, many units are away from the peak, making the product even smaller. This is the vanishing gradient problem: early layers receive almost no learning signal.',
        'There is a second, subtler wall. Sigmoid outputs are always positive. That means the activations arriving at the next layer all share the same sign, which forces weight gradients into correlated directions and causes optimization to zigzag. Tanh fixes the centering issue but still saturates in both tails, so it only solves half the problem.',
        'Modern activation design is a response to both walls: the function must be nonlinear enough to prevent the collapse of stacked linear layers, and it must preserve enough gradient signal that optimization can train all layers, not just the last few.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A useful hidden-layer activation must satisfy two contracts simultaneously. The forward contract: it must break the algebraic collapse of stacked affine maps so that depth adds expressive power. The backward contract: it must keep derivatives large enough across layers that gradient descent can assign credit to early weights. An activation is judged by both its output shape and its derivative shape together.',
        'This is why the same curve can be right in one position and wrong in another. Sigmoid is a sensible final activation for a binary classifier because the output range matches the prediction contract. The same sigmoid is a poor hidden-layer default in a deep network because saturated hidden units block gradient flow. The question is never "which curve is best?" It is which curve fits this layer\'s job.',
        'Elementwise activations also give networks their region structure. ReLU turns each unit on or off depending on the sign of its pre-activation (the value before the activation is applied). One pattern of on/off units selects one linear map through the network; a different pattern selects a different linear map. Deeper networks compose many such binary switches, which is how simple one-dimensional bends create complicated high-dimensional decision surfaces.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sigmoid maps any real input into (0, 1). Its derivative is sigma(x) * (1 - sigma(x)), which peaks at 0.25 when x = 0 and decays toward zero in both tails. For inputs around +6 or -6, the output barely changes when the input changes. In a hidden layer, that means the neuron is saturated and the gradient flowing through it is negligible.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/8/88/Logistic-curve.svg`, alt: `Logistic sigmoid curve`, caption: `The logistic curve shows saturation at both ends, which explains small gradients far from the center. Source: Wikimedia Commons, Qef, public domain.`},
        'Tanh maps inputs into (-1, 1) with derivative 1 - tanh(x)^2, peaking at 1.0 when x = 0. The zero-centered output helps optimization because activations can be positive or negative, avoiding the sign-bias problem of sigmoid. But tanh still saturates in both tails, so it does not solve vanishing gradients in deep stacks.',
        'ReLU is max(0, x): two straight lines joined at a corner. On the positive side the derivative is exactly 1, so gradients pass through deep stacks without being shrunk by a saturating curve. On the negative side the output and derivative are both exactly zero. A unit stuck on negative pre-activations is called a dead ReLU: it contributes nothing and learns nothing.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/6c/Rectifier_and_softplus_functions.svg`, alt: `Rectifier and softplus activation curves`, caption: `ReLU and softplus make the hard gate versus smooth gate tradeoff visible on one axis. Source: Wikimedia Commons, Dan Stowell, CC0 1.0.`},
        'Leaky ReLU gives the negative side a small slope (typically 0.01) instead of zero, preventing dead units. GELU, defined as x * Phi(x) where Phi is the Gaussian CDF, uses a smooth probabilistic gate that keeps small negative signals alive. Swish/SiLU, defined as x * sigma(x), is self-gated and non-monotonic. Modern transformer feed-forward blocks typically use GELU or SwiGLU because they train well at scale without ReLU\'s dead-zone problem.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Nonlinear activations work because they prevent each layer from being algebraically merged into the next. Once a nonlinear bend sits between two affine maps, the second map cannot be folded into the first without losing behavior. The network can build intermediate features, gate them, recombine them, and bend the representation at each layer.',
        'The derivative story explains why some nonlinearities train better than others. Backpropagation computes a chain of local derivatives. If many factors in that chain are near zero, early layers receive little signal. If useful regions keep a derivative near 1, gradient information survives across many layers. ReLU-family activations won deep-network settings because they created large non-saturating regions where the derivative is exactly 1.',
        'This is a necessary mechanism, not a sufficiency guarantee. Nonlinear forward transformations create richer hypothesis spaces, and non-flat derivative regions let optimization navigate those spaces. Whether the network actually learns the right function depends also on data, capacity, initialization, and optimization, but without the activation none of those other factors can help.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Computational cost per activation is O(n) where n is the number of neurons in the layer. ReLU is the cheapest: one comparison with zero. Sigmoid and tanh require computing an exponential, though optimized libraries handle this in a few clock cycles. GELU requires either a polynomial approximation or a CDF lookup, making it roughly 2-3x more expensive than ReLU per element. In practice, the matrix multiplications in each layer (O(n^2) or worse) dominate wall-clock time, so activation cost rarely matters except at extreme scale.',
        'The larger cost is memory. During training, the system must store either the activations themselves or enough information to reconstruct their derivatives for the backward pass. For a model with L layers of width n, this is O(L * n) stored values. Gradient checkpointing can trade memory for recomputation, but the activation function determines what must be saved.',
        'Activation choice interacts with initialization. Xavier initialization (weights drawn from N(0, 1/n)) was designed for symmetric saturating activations like tanh. He initialization (weights drawn from N(0, 2/n)) was designed for ReLU, which zeroes out roughly half the signal. Mismatching initialization and activation can cause a network to start with exploding values or saturated units. Normalization layers (BatchNorm, LayerNorm) help keep pre-activations in useful ranges, but they do not replace nonlinearity: a normalized stack of linear layers is still linear.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Output layers are chosen to match the prediction target. Binary classification uses sigmoid because the output represents a probability in (0, 1). Multiclass classification uses softmax, which generalizes sigmoid to a distribution over k classes. Regression typically uses no activation (identity) or ReLU when the target is nonnegative.',
        'Hidden layers are chosen for trainability. ReLU and its variants are standard in convolutional networks (ResNets, EfficientNets) and multilayer perceptrons. GELU is the default in transformer feed-forward blocks (BERT, GPT, ViT) because its smooth gate avoids dead units. SwiGLU, used in LLaMA and PaLM, combines Swish with a gated linear unit for even better optimization at scale.',
        'In production, activation choice is never tuned alone. It comes bundled with initialization scheme, normalization strategy, optimizer, learning rate, and model depth. Replacing ReLU with GELU may help a large transformer but be irrelevant in a small tabular model. Replacing sigmoid hidden layers with ReLU can make deep training possible, but it requires switching from Xavier to He initialization and adjusting the learning rate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Vanishing gradients are the classic sigmoid and tanh failure. If many hidden units sit in flat tails, early layers receive tiny gradients and stop learning. Diagnostic: plot gradient norms by layer during training. If they decay exponentially from output to input, the activation is saturating.',
        'Dead ReLU is the classic ReLU failure. A unit that receives negative pre-activations for all training examples outputs zero with zero derivative and never recovers through ordinary gradient updates. Diagnostic: measure the fraction of units outputting zero across a batch. If 20-40% of units are dead, the network has less effective capacity than its parameter count suggests. Common causes are too-large learning rates and poor initialization.',
        'A common misconception is that nonlinearity only at the output suffices. It does not. If all hidden layers are linear and only the final layer is nonlinear, the hidden stack never builds nonlinear features. The model is a generalized linear model over the raw input. Another misconception is that smoother is always better. A smooth saturated curve can train worse than a piecewise-linear ReLU that keeps slope at 1 across most of its domain.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take input x = -1 and compute each activation and its derivative.',
        'Sigmoid: output = 1 / (1 + e^1) = 1 / 3.718 = 0.269. Derivative = 0.269 * (1 - 0.269) = 0.269 * 0.731 = 0.197. The gradient is 79% below the peak of 0.25 at x = 0. Not dead, but already weakened.',
        'Tanh: output = tanh(-1) = -0.762. Derivative = 1 - (-0.762)^2 = 1 - 0.580 = 0.420. Better than sigmoid: the peak derivative of tanh is 1.0 (at x = 0), so at x = -1 you still retain 42% of peak gradient.',
        'ReLU: output = max(0, -1) = 0. Derivative = 0. The unit is dead for this input. No gradient flows backward, so the weights feeding this unit do not update. If every training example produces a negative pre-activation here, the unit is permanently dead.',
        'Now try x = 2. Sigmoid: output = 0.881, derivative = 0.881 * 0.119 = 0.105 (already fading). Tanh: output = 0.964, derivative = 1 - 0.929 = 0.071 (nearly saturated). ReLU: output = 2, derivative = 1 (full gradient). This is why ReLU trains deep networks faster: in the active region, the gradient is always exactly 1 regardless of input magnitude.',
        'Chain across 10 layers. Sigmoid at its peak: 0.25^10 = 9.5 * 10^(-7). The gradient arriving at layer 1 is less than one millionth of the gradient at layer 10. ReLU on the positive path: 1^10 = 1. The gradient passes through unchanged. This single comparison explains why ReLU enabled the training of networks with dozens or hundreds of layers.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Nair & Hinton 2010, "Rectified Linear Units Improve Restricted Boltzmann Machines," introduced ReLU to mainstream deep learning. Glorot & Bengio 2010, "Understanding the difficulty of training deep feedforward neural networks," showed how initialization interacts with activation saturation. Hendrycks & Gimpel 2016, "Gaussian Error Linear Units (GELUs)," proposed the smooth probabilistic gate now standard in transformers. Ramachandran et al. 2017, "Searching for Activation Functions," discovered Swish/SiLU through automated search.',
        'Study next: Neural Network Forward Pass to see where activations sit in the computation graph. Backpropagation to see why derivatives matter and how the chain rule propagates them. Vanishing and Exploding Gradients to understand the failure modes of saturation and unbounded growth. BatchNorm and LayerNorm to see how scale is managed around activations. Transformer Block to see GELU in its natural habitat.',
      ],
    },
  ],
};
