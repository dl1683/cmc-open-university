// What a neural layer DOES to space, watched in 3D: ReLU folds the input
// plane like origami — every neuron one crease — while sigmoid rolls smooth
// hills that flatten into gradient-killing plateaus at the edges.

import { surface3dState, InputError } from '../core/state.js';

export const topic = {
  id: 'activation-geometry-3d',
  title: 'Activations as 3D Origami',
  category: 'AI & ML',
  summary: 'A tiny neural layer rendered as terrain: ReLU creases space like origami, sigmoid rolls saturating hills.',
  controls: [
    { id: 'view', label: 'Fold', type: 'select', options: ['ReLU: the origami', 'sigmoid & GELU: the smooth country'], defaultValue: 'ReLU: the origami' },
  ],
  run,
};

const relu = (z) => Math.max(0, z);
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const gelu = (z) => z * sigmoid(1.702 * z); // the standard fast approximation

// Three hidden neurons; the output mixes them. Same weights for every
// activation so the GEOMETRY difference is purely the activation\'s doing.
const NEURONS = [
  { w: [1, 1], b: 0, out: 0.7 },     // crease along xâ‚ + xâ‚‚ = 0
  { w: [1, -1], b: 0, out: 0.5 },    // crease along xâ‚ âˆ’ xâ‚‚ = 0
  { w: [-1, 0], b: 0.5, out: 0.6 },  // crease along xâ‚ = 0.5
];
const layer = (act) => (x1, x2) =>
  NEURONS.reduce((sum, n) => sum + n.out * act(n.w[0] * x1 + n.w[1] * x2 + n.b), 0);

const RES = 33;
const RANGE = { min: -2, max: 2 };
const grid = (f, neurons = NEURONS) =>
  Array.from({ length: RES }, (_, r) => {
    const x2 = RANGE.min + (r / (RES - 1)) * (RANGE.max - RANGE.min);
    return Array.from({ length: RES }, (_, c) => {
      const x1 = RANGE.min + (c / (RES - 1)) * (RANGE.max - RANGE.min);
      return neurons.reduce((sum, n) => sum + n.out * f(n.w[0] * x1 + n.w[1] * x2 + n.b), 0);
    });
  });
const AXES = { x: { ...RANGE, label: 'input xâ‚' }, y: { ...RANGE, label: 'input xâ‚‚' } };
const terrain = (heights, markers = []) =>
  surface3dState({ axes: { ...AXES, z: { label: 'layer output' } }, heights, markers });

function* origami() {
  yield {
    state: terrain(grid(relu, [NEURONS[0]]), [
      { id: 'crease', x: 0, y: 0, z: 0, label: 'the crease: xâ‚ + xâ‚‚ = 0' },
    ]),
    highlight: { active: ['crease'] },
    explanation: `One neuron, watched in 3D over a ${RES}×${RES} grid from ${RANGE.min} to ${RANGE.max}. The neuron computes ReLU(xâ‚ + xâ‚‚): a weighted sum (a flat tilted plane, as Neural Network Forward Pass built it) passed through ReLU, which clamps negatives to zero. The geometric result is the entire story of modern deep learning in one shape: HALF the input plane is dead flat at zero, the other half rises as an untouched plane, and between them runs a perfectly straight CREASE — the line xâ‚ + xâ‚‚ = 0 where the neuron switches on. One neuron = one fold in space. Hold that exchange rate; we are about to spend ${NEURONS.length - 1} more neurons.`,
    invariant: `A ReLU neuron with weights [${NEURONS[0].w}] and bias ${NEURONS[0].b} is flat where its input is negative and linear where positive: one neuron, one crease.`,
  };

  yield {
    state: terrain(grid(relu, NEURONS.slice(0, 2)), [
      { id: 'c1', x: -1, y: 1, z: 0, label: 'crease 1' },
      { id: 'c2', x: 1, y: 1, z: layer(relu)(1, 1) - 0.6 * relu(-1 + 0.5), label: 'crease 2' },
    ]),
    highlight: { compare: ['c1', 'c2'] },
    explanation: `Add the second neuron — ReLU(xâ‚ âˆ’ xâ‚‚), creased along the other diagonal — and SUM the ${NEURONS.slice(0, 2).length}. The terrain now has TWO creases crossing at the origin, dividing the plane into four sectors, each a flat facet with its own tilt: one sector where neither neuron fires (the dead floor), two where exactly one fires, one where both do. The layer's output is piecewise-linear EVERYWHERE — planes joined at folds — because sums of folded planes are folded planes. This is what "neural networks are piecewise-linear functions" actually looks like.`,
    invariant: `Summing ${NEURONS.slice(0, 2).length} ReLU neurons (output weights ${NEURONS[0].out} and ${NEURONS[1].out}) superimposes their creases: n neurons partition the input into convex linear regions.`,
  };

  yield {
    state: terrain(grid(relu), [
      { id: 'c3', x: 0.5, y: -1.2, z: layer(relu)(0.5, -1.2), label: 'crease 3: xâ‚ = 0.5' },
    ]),
    highlight: { found: ['c3'] },
    explanation: `The ${NEURONS.length}rd neuron (bias ${NEURONS[2].b}, weights [${NEURONS[2].w}]) adds a vertical crease at xâ‚ = 0.5, and the origami now has SIX facets. Here is the result that makes depth special: a single layer of n neurons makes O(n) creases and polynomially many regions — but STACK layers, and each new layer folds the already-folded paper, multiplying regions toward EXPONENTIAL in depth (Montúfar et al., 2014). A 50-layer network is a sheet of paper folded fifty times: the creases of late layers are themselves bent by every fold beneath them. That compounding origami — not any single neuron's cleverness — is where deep networks get their expressive power.`,
    invariant: `Width adds creases (${NEURONS.length} here); depth folds existing folds: region count grows exponentially with depth.`,
  };

  yield {
    state: terrain(grid(relu), [
      { id: 'level', x: -0.4, y: 0.9, z: 1.0, label: 'decision contour: output = 1.0' },
    ]),
    highlight: { active: ['level'] },
    explanation: `Why a CLASSIFIER cares about origami: a decision boundary is a horizontal slice through this ${RES}×${RES} terrain — "predict spam where output > 1.0". Slice a piecewise-linear surface and you get a POLYGONAL path: straight segments that turn exactly at the creases. Every ReLU network's decision boundary, however curvy it looks zoomed out, is a polygon with astronomically many sides — each side inherited from some neuron's crease. Logistic Regression drew ONE straight boundary; this ${NEURONS.length}-neuron layer already draws a boundary with several bends. Depth buys bends, and bends are exactly what separating real data requires.`,
  };
}

function* smoothCountry() {
  yield {
    state: terrain(grid(sigmoid), [
      { id: 'plateau', x: -1.7, y: -1.7, z: layer(sigmoid)(-1.7, -1.7), label: 'the saturation plateau' },
    ]),
    highlight: { removed: ['plateau'] },
    explanation: `Same ${NEURONS.length} neurons, same weights — swap ReLU for SIGMOID and the origami melts into rolling hills: no creases, smooth everywhere, gentle S-curved slopes. Beautiful — and look at the corners of the [${RANGE.min}, ${RANGE.max}] map: far from the creases' old locations the terrain goes utterly FLAT, because sigmoid saturates at 0 and 1. Flat terrain means zero gradient, and zero gradient means nothing to learn from: this plateau at (${-1.7}, ${-1.7}) is the literal landscape of Vanishing & Exploding Gradients — a neuron stuck out here receives no teaching signal no matter how wrong it is. The hills are lovely; the plateaus are where learning goes to die.`,
    invariant: `Sigmoid saturation = flat terrain at the edges of the ${RES}×${RES} grid: gradients vanish exactly where corrections are largest.`,
  };

  yield {
    state: terrain(grid(gelu), [
      { id: 'soft', x: 0, y: 0, z: layer(gelu)(0, 0), label: 'the rounded crease' },
    ]),
    highlight: { active: ['soft'] },
    explanation: `The modern compromise: GELU — the default inside every Transformer Block. Watch its ${NEURONS.length}-neuron terrain over the [${RANGE.min}, ${RANGE.max}] grid: from a distance it is ReLU's origami (linear growth, no saturation ceiling, regions clearly visible), but zoom toward any crease and the fold is ROUNDED — a smooth fillet instead of a sharp edge (the raw GELU curve itself even dips slightly below zero just before its fold, though the dips wash out in this summed terrain). The rounding keeps gradients well-defined and non-zero through the transition zone (no abrupt dead-switch like ReLU's, which can strand "dead neurons" permanently off), while inheriting ReLU's open-ended slope. Origami with sanded edges: the geometry explains the empirical win.`,
    invariant: `GELU (approximation coefficient ${1.702}) ≈ ReLU with a smooth crease: linear wings, differentiable fold, no saturation ceiling.`,
  };

  yield {
    state: terrain(grid(relu)),
    highlight: {},
    explanation: `The closing map, one activation per geometry across all ${NEURONS.length} neurons on a ${RES}×${RES} grid: SIGMOID/TANH — smooth hills with deadly plateaus (historic, now mostly gates and output layers); RELU — sharp origami, cheap to compute, gradients alive everywhere it is active, at the price of dead-flat zero regions that can permanently silence a neuron; GELU/SiLU — rounded origami, the transformer era's default. Every choice is the same trade read off the terrain: where is the surface FLAT (no learning), where is it STEEP (fast learning), and how violently does it bend (how hard is the function to optimize — Loss Landscapes & Optimization Geometry's smoothness story, one level down). Activation functions are usually taught as 1-D squiggles; they are better understood as what they do to the whole sheet of space — and now you have watched all ${['relu', 'sigmoid', 'gelu'].length} fold it.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ReLU: the origami') yield* origami();
  else if (view === 'sigmoid & GELU: the smooth country') yield* smoothCountry();
  else throw new InputError('Pick a view.');
}


export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The 3D terrain is the function a three-neuron layer computes, plotted over a 33x33 grid of two input values. Height at any point equals the layer\'s output for that (x1, x2) pair. The horizontal axes are input space; the vertical axis is output magnitude.',
        'In the ReLU view, look for straight creases -- sharp bends where the surface changes slope. Each crease is one neuron\'s on/off boundary. Markers labeled "crease" sit on these fold lines. When two markers appear together, the step is comparing how two folds interact to carve space into regions.',
        {
          type: 'note',
          text: 'The surface is NOT a loss landscape. It is the function the layer computes. The loss landscape lives in weight space; this terrain lives in input space. Confusing the two is a common mistake.',
        },
        'In the sigmoid/GELU view, watch the same structure melt into smooth hills. The folds are still present as slope transitions, but they are rounded instead of sharp. Pay attention to the edges of the grid: flat terrain there means the activation has saturated, and gradients have died.',
        'At each frame, count the distinct flat regions, trace the boundaries between them, and ask whether the gradient (slope) is alive or dead in each zone. That question -- alive or dead -- is the entire practical story of activation choice.',
        {type: 'callout', text: 'Activation geometry is input-space folding: each nonlinear unit creates regions where different linear maps become active.'},
        {type: 'image', src: './assets/gifs/activation-geometry-3d.gif', alt: 'Animated walkthrough of the activation geometry 3d visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Activation functions are taught as 1-D curves: sigmoid is an S, ReLU is a bent line, GELU is a smooth bent line. That framing hides the real story. An activation does not operate on a single scalar -- it operates on every neuron in a layer simultaneously, and the combined effect reshapes the entire input space. A 1-D graph cannot show you that reshaping.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'The network diagram grounds the 3D terrain in ordinary layers: inputs feed hidden units whose activations reshape the represented function. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
        'A single ReLU neuron with two inputs computes max(0, w1*x1 + w2*x2 + b). Plotted in 3D, this is a tilted plane clamped to zero on one side -- one fold in the sheet of input space. Three neurons produce three crossing folds that carve the plane into distinct flat-sided regions, each with its own slope determined by which neurons are active. That piecewise-linear origami is what a ReLU layer actually computes, and it is invisible on a 1-D graph.',
        'Swap to sigmoid and the folds soften into hills whose edges flatten to plateaus. Swap to GELU and the creases round off while the wings stay linear. The geometry is not decoration. It determines what decision boundaries the network can draw, where gradients flow, and where learning stalls.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is no activation at all. Stack linear layers and let the matrix multiplications compose. An affine transformation (a matrix multiply plus a bias) maps inputs to outputs as a tilted plane. The composition of two affine maps is still an affine map. In the 3D view, the output is always a single tilted plane no matter how many layers you stack. It can tilt and shift but it cannot bend.',
        'For linearly separable data, this works. A single hyperplane splits the classes, and deeper stacks just find fancier parameterizations of the same hyperplane. Logistic regression (one linear layer plus sigmoid at the output) succeeds here.',
        'The approach breaks the moment the decision boundary needs a bend. XOR is the textbook case: no single line through 2D space separates the points (0,0) and (1,1) from (0,1) and (1,0). You need at least one kink in the boundary, and a purely linear network cannot produce one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not just XOR. Without activations, the representation capacity of the network -- the set of functions it can express -- is stuck at affine functions regardless of depth or width. A hundred linear layers collapse to a single matrix multiply. Depth buys zero additional expressiveness.',
        'Activations break this by letting each neuron introduce a local change in slope. But the choice of activation creates a secondary wall. Sigmoid introduces smooth bends, and its output is bounded between 0 and 1. Far from the decision boundary, the surface flattens into plateaus where the derivative approaches zero. Chain many sigmoid layers and gradients shrink exponentially during backpropagation -- the vanishing gradient problem (a gradient is the partial derivative of the loss with respect to a weight; it tells the optimizer which direction to adjust that weight). This wall blocked deep learning from roughly 1990 to 2010.',
        {
          type: 'quote',
          text: 'The number of linear regions of a deep ReLU network grows exponentially with depth.',
          attribution: 'Montufar, Pascanu, Cho, Bengio (2014)',
        },
        'ReLU solved the saturation wall: its gradient is exactly 1 for positive inputs, so signals pass through without shrinking. But ReLU introduced its own wall -- the dying neuron problem. If a neuron\'s pre-activation (the value before applying the activation) drifts permanently negative, its output is zero, its gradient is zero, and its weights never update again. The neuron is dead. In large networks, 10-40% of ReLU neurons can die during training, silently reducing the network\'s effective width.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Each nonlinear activation partitions the input space into regions where different linear functions apply. A ReLU neuron creates exactly two regions: one where it passes input unchanged (active) and one where it outputs zero (dead). The boundary between them is a hyperplane -- a crease in the surface. Multiple neurons produce multiple creases that cross each other, and each intersection polygon gets its own linear map determined by which subset of neurons is active there.',
        'Depth compounds this: the second layer folds an already-folded surface. Its creases bend along the existing folds, so the region count can grow exponentially with depth rather than linearly with width. This exponential folding is the geometric reason deep networks are more expressive than wide shallow ones with the same parameter count.',
        'Smooth activations (sigmoid, GELU) create the same regional structure, but the boundaries are soft transitions instead of sharp creases. The tradeoff is that smooth boundaries provide nonzero gradients everywhere (no dead neurons), at the cost of potential saturation (sigmoid) or higher compute (GELU).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with one neuron computing z = w1*x1 + w2*x2 + b. Before activation, this is a flat tilted plane in 3D. Apply ReLU: max(0, z). Every point where z < 0 is clamped to zero, creating a flat dead zone. The boundary between dead and active is a straight crease along the line w1*x1 + w2*x2 + b = 0.',
        'Add a second neuron with different weights. Its crease runs along a different line. The layer output sums both neurons (each scaled by an output weight), so the terrain now has two creases crossing the plane. The space divides into four regions: both neurons dead (flat floor), only neuron 1 active, only neuron 2 active, and both active. Each region is a flat facet with a distinct slope. The three-neuron layer in this animation produces six such facets.',
        {
          type: 'diagram',
          label: 'Piecewise-linear regions from ReLU neurons',
          text: '       crease 1 (x1+x2=0)\n          /\n    R2   /   R3\n  (n1)  /  (n1+n2)\n       / \n------X--------  crease 2 (x1-x2=0)\n     / \\\n    /   \\\n   R1    R4\n (dead) (n2)\n\nEach region Ri is a convex polygon.\nInside each region, the output is a\ndifferent linear function of (x1, x2).',
        },
        'Depth multiplies this partitioning. A second layer receives the already-folded surface and folds it again. Each new crease bends along the folds beneath it rather than running straight. Two layers of n neurons can produce O(2^n) linear regions, compared to O(n) for one layer. Fifty layers of 100 neurons can theoretically partition input space into more regions than atoms in the universe.',
        'Sigmoid replaces the sharp crease with a smooth S-curve transition. The surface becomes differentiable everywhere, but it saturates at the extremes -- output locks near 0 or 1. GELU keeps ReLU\'s linear wings (slope never flattens for large positive inputs) while rounding the crease, giving no dead zones, no saturation ceiling, and differentiability everywhere.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'ReLU\'s correctness comes from a simple property: inside each linear region, the function is an ordinary affine map, so gradients are exact and constant. The neuron either passes its input through unchanged (gradient = 1) or blocks it (gradient = 0). There is no gray zone where the gradient decays to 0.003 and training crawls. This binary on/off behavior lets gradients propagate cleanly through hundreds of layers -- the reason deep ReLU networks became practical in 2012 while deep sigmoid networks had stalled for two decades.',
        'The piecewise-linear geometry also explains representation capacity. The universal approximation theorem proves a single wide layer can approximate any continuous function, but it may need exponentially many neurons to do so. Depth changes the accounting: each layer folds the previous layer\'s output, so the region count grows exponentially with depth. A deep narrow network can represent the same number of decision regions as a shallow wide one using far fewer parameters.',
        'Smooth activations like GELU work for a different reason. Their gradients are never exactly zero (except in the limit), so no neuron is permanently dead. The smooth crease also makes the loss landscape smoother -- the Hessian (the matrix of second derivatives that describes curvature) has a smaller eigenvalue spread -- which lets optimizers like Adam take larger, more stable steps. This matters most in transformers, where 96+ layers of residual connections carry gradients across many folds.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The activation itself is nearly free. A forward pass through a layer costs O(n_in * n_out) for the matrix multiply; the activation adds O(n_out) element-wise operations. ReLU is a single comparison -- one clock cycle on modern hardware. Sigmoid requires computing an exponential; GELU uses a polynomial approximation. In practice, the activation accounts for less than 1% of a layer\'s compute budget.',
        {
          type: 'table',
          headers: ['Activation', 'Formula', 'Derivative at 0', 'Saturates?', 'Dead neurons?', 'Typical use'],
          rows: [
            ['ReLU', 'max(0, z)', '0.5 (undefined, convention)', 'No (positive side)', 'Yes -- 10-40% can die', 'CNNs, default hidden layers'],
            ['GELU', 'z * Phi(z)', '0.5', 'No', 'No', 'Transformers (BERT, GPT)'],
            ['SiLU / Swish', 'z * sigmoid(z)', '0.5', 'No', 'No', 'EfficientNet, vision models'],
            ['Mish', 'z * tanh(softplus(z))', '~0.6', 'No', 'No', 'YOLOv4, some vision'],
            ['Sigmoid', '1/(1+exp(-z))', '0.25', 'Yes, both tails', 'No (but vanishing grad)', 'Output gates, binary output'],
            ['Tanh', '(exp(z)-exp(-z))/(exp(z)+exp(-z))', '1.0', 'Yes, both tails', 'No (but vanishing grad)', 'RNN hidden states, legacy'],
          ],
        },
        'The real cost difference is in the backward pass. ReLU\'s gradient is 0 or 1, so backpropagation through a ReLU layer is a masked copy -- extremely fast on GPUs. GELU\'s gradient requires a Gaussian CDF evaluation, roughly 4-5x more expensive per element. For a 175-billion-parameter model doing trillions of activations per training run, that multiplier adds up, but it remains small compared to the attention and matrix-multiply costs that dominate wall-clock time.',
        'Memory cost is the same across activations: during training, you store one float per neuron per sample (the pre-activation value) for the backward pass. Activation checkpointing trades compute for memory by discarding these stored values and recomputing them during backpropagation, cutting memory roughly in half at the cost of one extra forward pass.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ReLU dominates convolutional networks for vision (ResNet, VGG) and fully connected classifiers. Its piecewise-linear geometry makes ReLU networks amenable to formal verification -- you can reason about each linear region independently, which matters in safety-critical systems like autonomous driving perception stacks.',
        'GELU is the default activation in transformer feed-forward blocks. Every major language model from BERT (2018) onward uses it. The smooth crease avoids the dead-neuron lottery, which is critical at 96+ layers where losing 30% of neurons to dying ReLU would be catastrophic. SiLU (also called Swish) fills the same role in vision transformers and EfficientNet.',
        'Sigmoid and tanh survive in gating mechanisms. LSTMs use sigmoid gates because saturation is a feature there: a gate should be fully open or fully closed, and the flat plateaus enforce that binary behavior. Tanh normalizes hidden states to [-1, 1], preventing unbounded growth across time steps in recurrent networks.',
        'Mish found a niche in real-time object detection (YOLOv4). Its slight dip below zero for small negative inputs provides a self-regularizing effect, and the extra compute cost is acceptable for models that are small enough to run on edge hardware.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The dying ReLU problem is the most common practical failure. A neuron whose pre-activation is always negative outputs zero, receives zero gradient, and never recovers. High learning rates accelerate this: a single large gradient update can push weights into the dead zone permanently. Leaky ReLU (output = 0.01*z for z < 0) was designed to prevent this by keeping a tiny nonzero gradient in the negative region, but it introduces a hyperparameter (the leak slope) and its benefits are inconsistent across tasks.',
        'Sigmoid and tanh fail in deep networks. The maximum derivative of sigmoid is 0.25 (at z = 0). Chain 50 sigmoid layers and the gradient shrinks by 0.25 per layer: the signal reaching the first layer is 0.25^50, roughly 10^-30. No optimizer can learn from a signal that small. This is not a theoretical curiosity -- it is why deep networks did not train successfully before ReLU (Glorot and Bengio, 2010).',
        'GELU is not free of problems either. Its non-monotonic region (a slight dip below zero for small negative inputs) can create spurious local structure in the output. Its higher computational cost adds up at scale. For latency-sensitive inference on edge devices, ReLU\'s single comparison instruction remains unbeatable.',
        {
          type: 'note',
          text: 'No activation function is universally best. The choice is always a tradeoff between gradient health (sigmoid fails), dead neuron risk (ReLU fails), computational cost (GELU/Mish are more expensive), and the specific architecture\'s needs (gates want saturation, hidden layers want linearity).',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider the three neurons in this animation: neuron 1 has weights [1, 1], bias 0, output weight 0.7; neuron 2 has weights [1, -1], bias 0, output weight 0.5; neuron 3 has weights [-1, 0], bias 0.5, output weight 0.6. The layer output is the weighted sum of their activations.',
        'Pick the input point (x1, x2) = (1.0, -0.5). Neuron 1 computes z1 = 1*1.0 + 1*(-0.5) + 0 = 0.5. Since 0.5 > 0, ReLU(0.5) = 0.5, contributing 0.7 * 0.5 = 0.35. Neuron 2 computes z2 = 1*1.0 + (-1)*(-0.5) + 0 = 1.5. ReLU(1.5) = 1.5, contributing 0.5 * 1.5 = 0.75. Neuron 3 computes z3 = (-1)*1.0 + 0*(-0.5) + 0.5 = -0.5. Since -0.5 < 0, ReLU(-0.5) = 0, contributing nothing. Layer output: 0.35 + 0.75 + 0 = 1.1.',
        'Now apply sigmoid instead. Neuron 1: sigmoid(0.5) = 1/(1 + exp(-0.5)) = 0.622, contributing 0.7 * 0.622 = 0.436. Neuron 2: sigmoid(1.5) = 1/(1 + exp(-1.5)) = 0.818, contributing 0.5 * 0.818 = 0.409. Neuron 3: sigmoid(-0.5) = 1/(1 + exp(0.5)) = 0.378, contributing 0.6 * 0.378 = 0.227. Layer output: 0.436 + 0.409 + 0.227 = 1.072. Notice that neuron 3 is alive under sigmoid (output 0.378) but completely dead under ReLU (output 0). That is the dying neuron problem in one concrete number.',
        'For the gradient at this point under ReLU: neurons 1 and 2 are active, so their gradients with respect to x1 are simply their x1-weights (1 and 1) scaled by output weights (0.7 and 0.5), giving d(output)/d(x1) = 0.7*1 + 0.5*1 + 0 = 1.2. Under sigmoid, the gradient of neuron 1 with respect to x1 is 0.7 * sigmoid(0.5) * (1 - sigmoid(0.5)) * 1 = 0.7 * 0.622 * 0.378 * 1 = 0.165. Already much smaller than 0.7. Stack 50 layers and that shrinkage compounds to near-zero -- the vanishing gradient, computed from first principles.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Montufar, Pascanu, Cho, Bengio. "On the Number of Linear Regions of Deep Neural Networks." NeurIPS 2014. The foundational paper proving that depth creates exponentially more linear regions than width for ReLU networks.',
            'Glorot and Bengio. "Understanding the difficulty of training deep feedforward neural networks." AISTATS 2010. Documents the vanishing gradient problem with sigmoid/tanh and motivates ReLU.',
            'Hendrycks and Gimpel. "Gaussian Error Linear Units (GELUs)." 2016. Introduces GELU and the probabilistic motivation behind it.',
            'Ramachandran, Zoph, Le. "Searching for Activation Functions." 2017. Discovers SiLU/Swish through automated search over activation function space.',
          ],
        },
        'Start with Activation Functions on this site to see the 1-D curves side by side and understand each formula in closed form. Then read Neural Network Forward Pass to see how the weighted sum feeds into the activation, building the full picture of one layer. Study Vanishing & Exploding Gradients to see why sigmoid\'s flat plateaus are a training disaster, not just a geometric curiosity.',
        'For the optimization side, read Loss Landscapes & Optimization Geometry to understand how activation choice propagates into the terrain the optimizer navigates -- the loss landscape in weight space, a different surface from the input-space terrain shown here. For the architecture that made GELU dominant, see Transformer Block.',
      ],
    },
  ],
};
