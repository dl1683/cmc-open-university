// Activation functions: the nonlinearity that lets neural networks learn
// curves instead of lines. Sigmoid, tanh, ReLU: same job, different rules.

import { plotState } from '../core/state.js';

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

export function* run(input) {
  const focus = String(input.focus);

  yield {
    state: plotState({ axes: AXES, series: series([]).concat([{ id: 'line', label: 'no activation (line)', points: xs.map((x) => ({ x, y: x / 6 })) }]) }),
    highlight: { active: ['line'] },
    explanation: 'A neural layer computes weights times inputs plus bias: a linear function. Stack a hundred linear layers and they still collapse into one linear function. The activation function is the bend between layers that gives depth expressive power.',
  };

  const chosen = focus === 'tour all three' ? FUNCS : FUNCS.filter((f) => f.id === focus);
  const shown = [];
  for (const f of chosen) {
    shown.push(f);
    yield {
      state: plotState({ axes: AXES, series: series(focus === 'tour all three' ? shown : chosen) }),
      highlight: { active: [f.id], visited: shown.slice(0, -1).map((s) => s.id) },
      explanation: f.blurb,
      invariant: 'What matters for training is the SLOPE: gradient descent can only learn through regions where the curve isn\'t flat.',
    };
  }

  yield {
    state: plotState({ axes: AXES, series: series(FUNCS) }),
    highlight: {},
    explanation: 'The comparison is a gradient map. Sigmoid and tanh lose slope at the edges; ReLU keeps a full-slope positive side and pays for it with a zero-gradient negative side. The same one-dimensional bend acts coordinate by coordinate inside a high-dimensional layer, so activation choice affects both representation and trainability.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "The plot shows input x on the horizontal axis and activation output on the vertical axis. Each curve is one activation function applied element-wise. The active highlight marks the function currently being introduced; visited markers show functions already plotted for comparison.",
        "Watch the slope of each curve, not just its shape. Steep regions are where the derivative is large and gradients flow well during training. Flat regions are where the derivative is near zero and gradients vanish. The first frame shows a plain linear function to establish the baseline that activation functions must break.",
        "After all three curves appear, compare them side by side: sigmoid saturates at both extremes, tanh saturates at both extremes but is zero-centered, and ReLU has constant slope on the positive side but is exactly zero on the negative side. The invariant across all frames is that slope equals trainability.",
        {type: "callout", text: "An activation is both a bend in the forward map and a gate for gradient flow during training."},
      ],
    },
    {
      heading: `Why they exist`,
      paragraphs: [
        `A neural network layer is mostly an affine transformation: multiply inputs by weights, add biases, pass the result onward. If every layer did only that, depth would be an illusion. The composition of linear or affine functions is still one affine function. A hundred layers without nonlinear activations can be collapsed into a single layer. The model may have many parameters, but its input-output shape is still a plane, hyperplane, or linear decision boundary in transformed coordinates.`,
        `Activation functions are the bends between those linear maps. They let a network build curves, gates, regions, interactions, and piecewise surfaces. A layer creates weighted combinations; the activation decides how those combinations pass forward. Stack that pattern many times and the model can approximate complicated functions rather than only straight-line relationships.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg`, alt: `Layered neural network diagram with colored nodes`, caption: `The layer stack shows why nonlinear bends between affine maps are needed for depth to add expressive power. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.`},
        `The activation also controls learning. Backpropagation sends gradients backward through every operation. If an activation has useful slope in the region where neurons operate, gradients can pass. If it is flat, gradients shrink. If it outputs exactly zero with zero derivative for many units, parts of the network can stop learning. So an activation is both a forward modeling choice and a backward optimization choice.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The naive model builder notices that a linear layer is easy to optimize and asks why not just stack more of them. Algebra blocks that path. If layer one computes A x + b and layer two computes C y + d, then the two together compute C(A x + b) + d, which is just (C A) x + (C b + d). Add more layers and the collapse continues. Depth without nonlinearity buys parameter redundancy, not expressive power.`,
        `The next naive move is to use a smooth squashing function everywhere, such as sigmoid, because probabilities feel intuitive. That created another wall in early deep networks. Sigmoid maps large positive inputs near 1 and large negative inputs near 0. In both tails the curve is almost flat, so the derivative is near zero. Backpropagation multiplies derivatives across layers. Multiply many small numbers and the gradient arriving at early layers becomes tiny. The network is expressive in principle, but hard to train in practice.`,
        `Modern activation design is a response to both walls. The function must be nonlinear enough to break the collapse of linear layers, but it must also preserve enough gradient signal for optimization. The plot in the demo is therefore not just a picture of outputs. It is a map of where learning can travel.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that depth needs two contracts at once. The forward contract must break the collapse of linear layers. The backward contract must keep derivatives large enough that gradient descent can assign credit to earlier weights. A useful hidden activation is therefore judged by both its output shape and its derivative shape.`,
        `This is why the same curve can be good in one position and bad in another. Sigmoid is a sensible final activation for binary probability output because the range matches the prediction contract. The same sigmoid can be a poor hidden-layer default in a deep network because saturated hidden units block gradient flow. The question is not "which curve is best?" The question is which curve fits this layer\'s job.`,
        `Elementwise activations also give networks their region structure. ReLU, for example, turns each unit on or off depending on the sign of its pre-activation. One pattern of active units selects one linear map; another pattern selects another. Deeper networks can compose many such switches, which is how simple one-dimensional bends create complicated high-dimensional decision surfaces.`,
      ],
    },
    {
      heading: `Sigmoid and tanh`,
      paragraphs: [
        `Sigmoid maps any real input into the interval (0, 1). That makes it natural at the end of a binary classifier: the output can be interpreted as a probability after logistic training and calibration checks. Its derivative is largest near zero and shrinks in the tails. For inputs around +6 or -6, the output barely changes when the input changes. In a hidden layer, that means the neuron is saturated and the gradient flowing through it is weak.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/8/88/Logistic-curve.svg`, alt: `Logistic sigmoid curve`, caption: `The logistic curve shows saturation at both ends, which explains small gradients far from the center. Source: Wikimedia Commons, Qef, public domain.`},
        `Sigmoid also has a centering problem. Its outputs are always positive, so the next layer receives activations with a positive mean unless other machinery corrects it. That can make optimization zigzag because weight updates tend to share the same sign structure. This is one reason sigmoid moved out of favor for hidden layers even though it remains useful for binary output heads and gates.`,
        `Tanh maps inputs into (-1, 1). It is essentially a centered sigmoid. The zero-centered output helps optimization because activations can be positive or negative. That made tanh a strong default in older neural networks and recurrent architectures. But tanh still saturates in both tails. It solves the centering problem better than sigmoid, not the vanishing-gradient problem caused by flat extremes.`,
      ],
    },
    {
      heading: `ReLU and its family`,
      paragraphs: [
        `ReLU is max(0, x). It looks crude because it is two straight lines joined at a corner: zero for negative inputs, identity for positive inputs. That simplicity is the reason it works. On the positive side the derivative is 1, so gradients can pass through deep stacks without being repeatedly shrunk by a saturating curve. ReLU helped make very deep convolutional networks practical because it gave optimization a wide non-flat region.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/6c/Rectifier_and_softplus_functions.svg`, alt: `Rectifier and softplus activation curves`, caption: `ReLU and softplus make the hard gate versus smooth gate tradeoff visible on one axis. Source: Wikimedia Commons, Dan Stowell, CC0 1.0.`},
        `The negative side is the price. For x below zero, the output is zero and the derivative is zero. A unit that receives negative pre-activations for all relevant examples contributes nothing and learns nothing through ordinary gradient updates. This is called a dead ReLU. Some dead units are just sparsity; many dead units are wasted capacity. Initialization, learning rate, normalization, and data distribution all influence how often this happens.`,
        `Leaky ReLU gives the negative side a small slope instead of zero. ELU and SELU modify the negative side more smoothly. GELU and Swish use smooth gates that keep small negative signals in a probabilistic or sigmoid-shaped way. Modern transformer feed-forward networks often use GELU or related activations because they train well at scale. These variants are not magic decorations; they are attempts to keep the benefits of ReLU while softening its dead-zone behavior.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visual model compares each activation on two axes: forward range and slope. Sigmoid compresses values into 0 to 1. Tanh compresses values into -1 to 1. ReLU keeps positive values unbounded and clips negative values to zero. This tells you what kind of signal the next layer receives: bounded probability-like values, centered bounded values, or sparse nonnegative values.`,
        `The slope is the local derivative, and backpropagation multiplies that derivative by the upstream gradient. Flat tails mean small derivatives. A long region with slope 1 means gradients can pass cleanly. A hard zero region means no gradient passes through that unit for those inputs. ReLU\'s positive side is a strong training path, not just a line segment on a chart.`,
        `The plot is one-dimensional because an activation function acts element by element. A real layer has many neurons, so the activation bends a high-dimensional representation one coordinate at a time. The combined effect can carve input space into many regions. ReLU networks are piecewise linear: each pattern of active and inactive ReLUs selects a different linear map. Depth increases the number and arrangement of these regions.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Nonlinear activations work because they stop each layer from being algebraically merged into the next. Once a nonlinear bend sits between two affine maps, the second map cannot be folded into the first without losing behavior. The network can build intermediate features, gate them, recombine them, and bend the representation again.`,
        `The derivative story explains why some nonlinearities train better than others. Backpropagation is a chain of local derivatives. If many factors are near zero, early layers receive little signal. If useful regions keep a derivative near 1, gradient information survives across more layers. ReLU-family activations won many deep-network settings because they created large non-saturating regions.`,
        `This is not a formal guarantee that any chosen network will learn the right function. It is the mechanism that makes learning possible: nonlinear forward transformations create richer hypotheses, and non-flat derivative regions let optimization change the weights that created those transformations.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `The computational cost of an activation is usually O(number of activations). ReLU is extremely cheap: compare with zero and keep the maximum. Sigmoid and tanh require exponentials, though optimized libraries make them routine. GELU and Swish are more expensive than ReLU but still small compared with large matrix multiplications in many models. The bigger cost is often memory: training stores activations or enough information to compute their derivatives during backpropagation.`,
        `Activation choice interacts with initialization. If weights are too large, sigmoid and tanh units may start saturated. If weights and learning rates push ReLU units negative, they may die. Initialization schemes such as Xavier and He initialization were designed around activation behavior and variance propagation. Normalization layers also help by keeping pre-activation values in useful ranges, but they do not replace nonlinearity. A normalized stack of linear layers is still linear.`,
        `Regularization and optimization can change the picture. Dropout changes which activations are present during training. Weight decay influences how large pre-activations become. Adaptive optimizers may handle some scale issues differently from plain gradient descent. But none of these remove the central requirement: the activation must give the model expressive bends and the optimizer usable derivatives.`,
      ],
    },
    {
      heading: `Where they are used`,
      paragraphs: [
        `Sigmoid is still used for binary classification heads, multi-label outputs, and gates where a value between 0 and 1 is semantically useful. Tanh remains useful when bounded centered outputs are desired and appears in classic recurrent networks. ReLU and its variants are standard in convolutional networks, multilayer perceptrons, and many tabular or vision models. GELU-like activations are common in transformer feed-forward blocks.`,
        `Output-layer activations should match the prediction target. Binary classification often uses sigmoid. Multiclass classification usually uses softmax. Regression may use no activation, ReLU for nonnegative outputs, or a bounded activation when the target has a known range. Hidden-layer activations are chosen less for interpretation and more for optimization, representation power, and compatibility with the architecture.`,
        `In production, activation choice is rarely tuned alone. It comes with initialization, normalization, optimizer, learning rate, model width, and depth. Replacing ReLU with GELU may help a transformer-style model but be irrelevant in a small tabular network. Replacing sigmoid hidden layers with ReLU may make deep training possible, but it may also require different initialization and learning-rate settings.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Start by separating hidden activations from output activations. Hidden activations are mostly about representation and trainability. Output activations encode the contract of the prediction: probability, class distribution, nonnegative value, bounded value, or unrestricted real number. Many modeling bugs come from mixing those roles, such as putting sigmoid in every hidden layer because the final answer is a probability.`,
        `Match initialization to the activation. Xavier-style initialization was built for symmetric saturating activations such as tanh. He-style initialization was built for ReLU-like activations that zero out about half the signal. If the variance is wrong, the network can begin with exploding ReLU activations or saturated sigmoid and tanh units. Normalization layers can help keep activations in a useful range, but they are not a license to ignore initialization.`,
        `Measure activation behavior during training. Histograms of pre-activations show whether values live near the useful slope or in flat tails. Dead-unit rates show whether ReLU capacity is being wasted. Gradient norms by layer show whether the derivative chain is shrinking or exploding. These checks are cheap compared with guessing from loss curves alone, and they often explain why two networks with the same parameter count train very differently.`,
      ],
    },
    {
      heading: `Choosing between variants`,
      paragraphs: [
        `A small model on simple data usually does not need an exotic activation. ReLU, Leaky ReLU, or tanh may be enough, and the larger gains may come from better features, regularization, or learning-rate schedules. A deep transformer-style network is different. There, smooth gated activations such as GELU or SwiGLU can improve optimization and quality because the feed-forward block is a major part of the model\'s capacity.`,
        `Hardware and inference also matter. ReLU is cheap and easy to fuse. Sigmoid, tanh, GELU, and Swish require more math, though optimized kernels reduce the overhead. In very large models, matrix multiplications dominate, but activation choice can still affect kernel fusion, quantization behavior, numerical range, and calibration. A production choice should be tested on task quality and serving latency, not only on a training curve.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Saturation is the classic sigmoid and tanh failure. If many units sit in flat tails, the model may train slowly or stop improving because early layers receive tiny gradients. Dead units are the classic ReLU failure. If many units output zero for almost all examples, the network has less usable capacity than its parameter count suggests. Exploding activations are the opposite problem: unbounded positive ReLU outputs can grow through layers if initialization, normalization, or learning rates are poor.`,
        `A common misconception is that nonlinear output alone is enough. It is not. If all hidden layers are linear and only the final layer is nonlinear, the model is still mostly a generalized linear model over the original input. The hidden stack never builds nonlinear features. Another misconception is that smoother is always better. Smooth activations can help, but a smooth saturated curve may train worse than a simple piecewise-linear one with strong slope.`,
        `Evaluation signals depend on the failure. For vanishing gradients, inspect gradient norms by layer, training loss curves, and activation histograms. For dead ReLUs, measure the fraction of units that output zero across batches. For saturation, inspect pre-activation distributions and derivative magnitudes. For deployment, compare task metrics, calibration, latency, and numerical stability, not just the elegance of the curve.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Neural Network Forward Pass to see where activations sit, Backpropagation to see why derivatives matter, Vanishing and Exploding Gradients to understand saturation, and BatchNorm or LayerNorm to see how scale is managed near activations. Then sketch each activation and its derivative side by side. The output curve explains representation. The derivative curve explains trainability. Good network design needs both.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A neural network without activation functions is just a linear transformation. Stack 100 linear layers: W₁₀₀·...·W₂·W₁·x = W·x (one big matrix). Can only learn linear functions. Activation functions introduce nonlinearity.',
        'Sigmoid σ(x) = 1/(1+e^(-x)): output ∈ (0,1). Smooth, differentiable. But: vanishing gradient — for |x| > 5, σ\'(x) ≈ 0. Deep networks: gradients shrink exponentially through layers. A 10-layer network: gradient ≈ 0.25^10 ≈ 10^(-6). Tanh: output ∈ (-1,1). Zero-centered (unlike sigmoid). Same vanishing gradient problem.',
        'ReLU (Nair & Hinton 2010): f(x) = max(0,x). Gradient: 1 if x>0, 0 if x≤0. No vanishing gradient for positive inputs. 6× faster to converge than sigmoid on ImageNet (Krizhevsky 2012). But: dying ReLU — if a neuron\'s input is always negative, gradient is always 0, neuron never updates.',
        'Leaky ReLU: f(x) = max(0.01x, x). Small gradient for negatives — no dying neurons. GELU (Hendrycks & Gimpel 2016): x·Φ(x) where Φ is the Gaussian CDF. Smooth approximation of ReLU. Used in GPT, BERT, and most modern transformers. SiLU/Swish (Ramachandran et al. 2017): x·σ(x). Self-gated, smooth, non-monotonic.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take input x = -1 and compute each activation and its derivative.',
        'Sigmoid: output = 1 / (1 + e^1) = 0.269. Derivative = 0.269 * (1 - 0.269) = 0.197. The gradient is about 20% of what it would be at the peak (x = 0). Not dead, but already weakened.',
        'Tanh: output = tanh(-1) = -0.762. Derivative = 1 - (-0.762)^2 = 0.420. Better than sigmoid because the peak derivative of tanh is 1.0 (at x = 0), so at x = -1 you still retain 42% of peak gradient.',
        'ReLU: output = max(0, -1) = 0. Derivative = 0. The unit is dead for this input. No gradient flows backward, so the weights feeding this unit do not update for this example. If every training example produces a negative pre-activation here, the unit is permanently dead.',
        'Now try x = 2. Sigmoid: output = 0.881, derivative = 0.105 (already fading). Tanh: output = 0.964, derivative = 0.071 (nearly saturated). ReLU: output = 2, derivative = 1 (full gradient). This is why ReLU trains deep networks faster: in the active region, the gradient is always 1, no matter how large the input.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Nair & Hinton 2010 (Rectified Linear Units Improve Restricted Boltzmann Machines — ReLU). Hendrycks & Gimpel 2016 (Gaussian Error Linear Units — GELU). Ramachandran et al. 2017 (Searching for Activation Functions — Swish/SiLU). Glorot & Bengio 2010 (Understanding the difficulty of training deep feedforward neural networks — initialization interacts with activations).',
        'Study next: Backpropagation (gradients flow through activations), Gradient Flow / Residual Connections (bypass vanishing gradients architecturally), Batch Normalization (stabilizes activations), Transformer Block (uses GELU), Loss Functions (sigmoid used in BCE loss).',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Prerequisites: basic calculus (the derivative of each activation function matters for backpropagation), and an understanding of neural network architecture (layers, weights, forward pass). You need to know what a gradient is and why training multiplies gradients across layers.',
        'This topic unlocks: understanding why deep networks became trainable (ReLU broke the vanishing gradient barrier), why Transformers use GELU instead of ReLU (smooth gating improves optimization at scale), the dying ReLU problem and why Leaky ReLU and ELU fix it (small negative slope keeps dead units alive), and the connection between activation choice and gradient flow throughout the network.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        'Input x = [-2, -1, 0, 1, 2]. Sigmoid: [0.12, 0.27, 0.5, 0.73, 0.88]. Gradients: [0.10, 0.20, 0.25, 0.20, 0.10]. Max gradient = 0.25 (at x=0). Through 10 layers: 0.25^10 ≈ 10^(-6). Vanishing!',
        'ReLU: [0, 0, 0, 1, 2]. Gradients: [0, 0, 0, 1, 1]. Through 10 layers: 1^10 = 1 for positive path. No vanishing! But x=-2 through ReLU: gradient = 0. Dead forever.',
        'GELU: [-0.05, -0.16, 0, 0.84, 1.95]. Gradients: [0.02, 0.08, 0.5, 0.92, 0.98]. Smooth transition — no hard zero like ReLU. This is why GELU wins in transformers: no dead neurons, smooth optimization landscape.',
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Choosing an activation function (2024 rules of thumb): Hidden layers in CNNs: ReLU (fast, proven). Hidden layers in transformers: GELU or SiLU (smooth, no dead neurons). Output layer for binary classification: sigmoid (outputs probability). Output layer for multi-class: softmax (outputs probability distribution). Output layer for regression: none (linear).',
        'Why not just use GELU everywhere? For CNNs, ReLU is 2-3x faster to compute (one comparison vs. CDF approximation). The computational savings matter when you have millions of activations per layer. For transformers, the layers are fewer and wider — GELU\'s computational cost is negligible relative to the attention mechanism.',
        'Initialization matters: with ReLU, use He initialization (W ~ N(0, 2/n)). With sigmoid/tanh, use Xavier/Glorot (W ~ N(0, 1/n)). Wrong initialization + activation = dying or exploding neurons.',
      ],
    },
  ],
};

