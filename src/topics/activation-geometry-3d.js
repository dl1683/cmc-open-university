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
        'The terrain you see is the output of a three-neuron layer plotted over two input dimensions. Height is the layer\'s output value; the horizontal plane is the input space. In the ReLU view, watch for straight creases where the surface bends sharply -- each crease is one neuron switching on or off. In the sigmoid/GELU view, watch for the same structure softened into rolling hills.',
        'Markers labeled "crease" sit on the fold lines. Active markers highlight the geometric feature being discussed in that step. When two markers appear together, the animation is comparing their joint effect -- how two folds interact to partition space into regions.',
        {
          type: 'note',
          text: 'The surface is NOT a loss landscape. It is the function the layer computes. The loss landscape lives in weight space; this terrain lives in input space. Confusing the two is a common mistake.',
        },
        'At each frame, ask: how many flat regions exist, where are the boundaries between them, and what happens to gradient flow on the flat parts versus the sloped parts.',
        {type: 'callout', text: 'Activation geometry is input-space folding: each nonlinear unit creates regions where different linear maps become active.'},
      
        {type: 'image', src: './assets/gifs/activation-geometry-3d.gif', alt: 'Animated walkthrough of the activation geometry 3d visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Activation functions are almost always taught as 1-D curves: sigmoid is an S, ReLU is a bent line, GELU is a smooth bent line. That framing hides the real story. An activation does not operate on a single number in isolation -- it operates on every neuron in a layer, and the combined effect reshapes the entire input space. The question is not "what does the curve look like" but "what does the layer do to geometry."',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'The network diagram grounds the 3D terrain in ordinary layers: inputs feed hidden units whose activations reshape the represented function. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},,
        'A single ReLU neuron receiving two inputs computes ReLU(w1*x1 + w2*x2 + b). Plotted in 3D, this is a tilted plane clamped to zero on one side -- a single fold in the input space. Three neurons produce three folds that cross each other, carving the plane into distinct flat-sided regions. Each region has its own slope because a different subset of neurons is active there. That piecewise-linear origami is what a ReLU layer actually computes, and it is invisible on a 1-D graph.',
        'Swap to sigmoid and the folds melt into smooth hills -- but the far edges go flat, which means gradients die there. Swap to GELU and you get ReLU\'s origami with sanded creases. The geometry is not decoration. It determines what boundaries the network can draw, where gradients flow, and where learning stalls.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is no activation at all. Stack linear layers and let the matrix multiplications compose. Each layer is an affine transformation -- rotation, scaling, translation -- and the composition of affine maps is another affine map. In the 3D view, that means the output is always a single tilted plane, no matter how many layers you stack. It can tilt and shift but it cannot bend.',
        'For linearly separable data, this works. A single hyperplane splits the classes cleanly, and a deeper stack of linear layers just finds a fancier way to express the same hyperplane. Logistic regression (one linear layer plus sigmoid at the output) succeeds precisely here.',
        'The approach breaks the moment you need the decision boundary to curve. XOR is the textbook case: no single line through 2D space separates (0,0) and (1,1) from (0,1) and (1,0). You need at least one bend in the boundary, and a purely linear network cannot produce one. The activation function is the tool that introduces bends.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not merely "linear layers cannot separate XOR." The wall is that representation capacity -- the set of functions a network can express -- is stuck at the set of affine functions without activations, regardless of depth or width. A hundred linear layers collapse to one matrix multiply. Depth buys nothing.',
        'Activations break this by letting each neuron introduce a local change in slope. But the choice of activation creates a secondary wall. Sigmoid introduces bends everywhere, and its output is bounded between 0 and 1 -- which means far from the decision boundary, the surface flattens into plateaus. Train a deep sigmoid network, and gradients shrink exponentially as they propagate backward through those plateaus. This is the vanishing gradient problem, and it blocked deep learning for two decades.',
        {
          type: 'quote',
          text: 'The number of linear regions of a deep ReLU network grows exponentially with depth.',
          attribution: 'Montufar, Pascanu, Cho, Bengio (2014)',
        },
        'ReLU solved the saturation wall but introduced its own: the dying ReLU problem. If a neuron\'s weights drift so that its pre-activation is always negative, the neuron outputs zero forever. Zero output means zero gradient, which means the weights never update. The neuron is dead. In large networks, 10-40% of ReLU neurons can die during training, silently reducing effective width.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with one neuron computing z = w1*x1 + w2*x2 + b. Before activation, this is a flat tilted plane in 3D -- height equals the pre-activation value. Apply ReLU: max(0, z). Every point where z < 0 is clamped to zero, creating a flat dead zone. The boundary between the dead zone and the active zone is a straight crease -- the line w1*x1 + w2*x2 + b = 0.',
        'Add a second neuron with different weights. Its crease runs along a different line. The layer output sums both neurons (weighted), so the terrain now has two creases crossing the plane. The space is divided into four regions: both neurons dead (flat floor), only neuron 1 active, only neuron 2 active, both active. Each region is a flat facet with its own slope. The three-neuron layer in this animation produces six such facets.',
        {
          type: 'diagram',
          label: 'Piecewise-linear regions from ReLU neurons',
          text: '       crease 1 (x1+x2=0)\n          /\n    R2   /   R3\n  (n1)  /  (n1+n2)\n       / \n------X--------  crease 2 (x1-x2=0)\n     / \\\n    /   \\\n   R1    R4\n (dead) (n2)\n\nEach region Ri is a convex polygon.\nInside each region, the output is a\ndifferent linear function of (x1, x2).',
        },
        'Depth multiplies this partitioning. A second layer receives the already-folded surface and folds it again. Each new neuron\'s crease is no longer a straight line in input space -- it bends along the folds of the previous layer. Two layers of n neurons can produce O(2^n) linear regions, compared to O(n) for one layer. Fifty layers of 100 neurons can theoretically partition input space into more regions than atoms in the universe.',
        'Sigmoid replaces the sharp crease with a smooth S-curve transition. The surface becomes differentiable everywhere -- no edges, no flat dead zones at the crease -- but it saturates at the extremes (output locked near 0 or 1). GELU keeps ReLU\'s linear wings (the slope never flattens for large positive inputs) while rounding the crease into a smooth curve, giving the best of both: no dead zones, no saturation, differentiable everywhere.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'ReLU\'s power comes from a simple property: inside each linear region, the function is an ordinary linear map, so gradients are exact and nonzero. The neuron either passes its input through unchanged (gradient = 1) or kills it (gradient = 0). There is no gray zone where the gradient shrinks to 0.003 and training crawls. This binary on/off behavior lets gradients propagate cleanly through hundreds of layers, which is why deep ReLU networks became practical in 2012 while deep sigmoid networks had failed for two decades.',
        'The piecewise-linear geometry also explains representation capacity. The universal approximation theorem says a single wide layer can approximate any continuous function -- but it may need exponentially many neurons. Depth changes the game: because each layer folds the previous layer\'s output, the number of linear regions grows exponentially with depth. A deep narrow network can carve the same number of decision regions as a shallow wide one using far fewer parameters.',
        'Smooth activations like GELU work for a different reason. Their gradients are never exactly zero (except asymptotically), so no neuron is permanently dead. The smooth crease also makes the loss landscape smoother -- the Hessian has smaller eigenvalue spread -- which lets optimizers like Adam take larger, more stable steps. This matters most in transformer architectures, where layers are very deep and residual connections carry gradients across many folds.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The activation itself is nearly free. A forward pass through a layer costs O(n_in * n_out) for the matrix multiply; the activation adds O(n_out) element-wise operations on top. ReLU is a single comparison (one clock cycle on modern hardware). Sigmoid requires an exponential; GELU requires a polynomial approximation. In practice, the activation is less than 1% of a layer\'s compute.',
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
        'The real cost differences are in the backward pass. ReLU\'s gradient is 0 or 1, so backprop through a ReLU layer is a masked copy -- extremely fast on GPUs. GELU\'s gradient involves a Gaussian CDF evaluation, roughly 4-5x more expensive per element. For a 175-billion-parameter model doing trillions of activations per training run, that multiplier matters, but it is still dwarfed by the attention and matrix-multiply costs.',
        'Memory cost: during training, you must store the pre-activation values (or recompute them) for the backward pass. This is the same for all activations -- one float per neuron per sample. Activation checkpointing trades compute for memory by recomputing activations during backprop instead of storing them.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'ReLU wins wherever compute efficiency matters and dead neurons are tolerable: convolutional networks for vision (ResNet, VGG), fully connected classifiers, and any architecture where batch normalization or residual connections mitigate the dying neuron problem. Its piecewise-linear geometry also makes ReLU networks amenable to formal verification -- you can reason about each linear region independently, which matters for safety-critical applications.',
        'GELU and SiLU win in transformer architectures. Every major language model since BERT (2018) uses GELU in its feed-forward blocks. The smooth crease means gradients flow through the transition zone without the dead-neuron lottery, which is critical when you are training a model with 96+ layers and cannot afford to lose 30% of neurons to the dying ReLU problem. SiLU (also called Swish) fills the same role in vision transformers and EfficientNet.',
        'Sigmoid and tanh survive in gating mechanisms. LSTMs use sigmoid gates specifically because saturation is a feature there: a gate should be fully open or fully closed, and the flat plateaus enforce that binary behavior. Tanh normalizes hidden states to [-1, 1], preventing unbounded growth across time steps.',
        'Mish found a niche in real-time object detection (YOLOv4) where its slightly negative region for small negative inputs provides a self-regularizing effect, and the extra compute cost is acceptable given the model\'s small size.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The dying ReLU problem is the most common practical failure. A neuron whose pre-activation is always negative across the training set outputs zero, receives zero gradient, and never recovers. High learning rates accelerate this -- a single large gradient update can push weights into the dead zone permanently. Leaky ReLU (output = 0.01*z when z < 0) was designed specifically to prevent this by keeping a tiny nonzero gradient in the negative region, but it introduces a hyperparameter and its benefits are inconsistent across tasks.',
        'Sigmoid and tanh fail in deep networks because of gradient vanishing. The maximum derivative of sigmoid is 0.25 (at z = 0). Chain 50 layers of sigmoid, and the gradient shrinks by a factor of 0.25 per layer: after 50 layers, the gradient reaching the first layer is 0.25^50, which is roughly 10^-30. No optimizer can learn from a signal that small. This is not a theoretical concern -- it is why deep networks did not work before ReLU (Glorot and Bengio, 2010).',
        'Smooth activations like GELU are not free of problems. Their non-monotonic region (GELU dips slightly below zero for small negative inputs) can create spurious local structure in the output, and their higher computational cost adds up at scale. For latency-sensitive inference on edge devices, ReLU\'s single comparison instruction remains unbeatable.',
        {
          type: 'note',
          text: 'No activation function is universally best. The choice is always a tradeoff between gradient health (sigmoid fails), dead neuron risk (ReLU fails), computational cost (GELU/Mish are more expensive), and the specific architecture\'s needs (gates want saturation, hidden layers want linearity).',
        },
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
        'For the optimization side, read Loss Landscapes & Optimization Geometry to understand how activation choice propagates into the terrain you optimize on -- the loss landscape in weight space, which is a different surface from the input-space terrain shown here. For the architecture that made GELU dominant, see Transformer Block.',
      ],
    },
  ],
};
