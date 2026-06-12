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
// activation so the GEOMETRY difference is purely the activation's doing.
const NEURONS = [
  { w: [1, 1], b: 0, out: 0.7 },     // crease along x₁ + x₂ = 0
  { w: [1, -1], b: 0, out: 0.5 },    // crease along x₁ − x₂ = 0
  { w: [-1, 0], b: 0.5, out: 0.6 },  // crease along x₁ = 0.5
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
const AXES = { x: { ...RANGE, label: 'input x₁' }, y: { ...RANGE, label: 'input x₂' } };
const terrain = (heights, markers = []) =>
  surface3dState({ axes: { ...AXES, z: { label: 'layer output' } }, heights, markers });

function* origami() {
  yield {
    state: terrain(grid(relu, [NEURONS[0]]), [
      { id: 'crease', x: 0, y: 0, z: 0, label: 'the crease: x₁ + x₂ = 0' },
    ]),
    highlight: { active: ['crease'] },
    explanation: 'One neuron, watched in 3D. The neuron computes ReLU(x₁ + x₂): a weighted sum (a flat tilted plane, as Neural Network Forward Pass built it) passed through ReLU, which clamps negatives to zero. The geometric result is the entire story of modern deep learning in one shape: HALF the input plane is dead flat at zero, the other half rises as an untouched plane, and between them runs a perfectly straight CREASE — the line x₁ + x₂ = 0 where the neuron switches on. One neuron = one fold in space. Hold that exchange rate; we are about to spend more neurons.',
    invariant: 'A ReLU neuron is flat where its input is negative and linear where positive: one neuron, one crease.',
  };

  yield {
    state: terrain(grid(relu, NEURONS.slice(0, 2)), [
      { id: 'c1', x: -1, y: 1, z: 0, label: 'crease 1' },
      { id: 'c2', x: 1, y: 1, z: layer(relu)(1, 1) - 0.6 * relu(-1 + 0.5), label: 'crease 2' },
    ]),
    highlight: { compare: ['c1', 'c2'] },
    explanation: 'Add the second neuron — ReLU(x₁ − x₂), creased along the other diagonal — and SUM the two. The terrain now has TWO creases crossing at the origin, dividing the plane into four sectors, each a flat facet with its own tilt: one sector where neither neuron fires (the dead floor), two where exactly one fires, one where both do. The layer\'s output is piecewise-linear EVERYWHERE — planes joined at folds — because sums of folded planes are folded planes. This is what "neural networks are piecewise-linear functions" actually looks like.',
    invariant: 'Summing ReLU neurons superimposes their creases: n neurons partition the input into convex linear regions.',
  };

  yield {
    state: terrain(grid(relu), [
      { id: 'c3', x: 0.5, y: -1.2, z: layer(relu)(0.5, -1.2), label: 'crease 3: x₁ = 0.5' },
    ]),
    highlight: { found: ['c3'] },
    explanation: 'The third neuron adds a vertical crease at x₁ = 0.5, and the origami now has SIX facets. Here is the result that makes depth special: a single layer of n neurons makes O(n) creases and polynomially many regions — but STACK layers, and each new layer folds the already-folded paper, multiplying regions toward EXPONENTIAL in depth (Montúfar et al., 2014). A 50-layer network is a sheet of paper folded fifty times: the creases of late layers are themselves bent by every fold beneath them. That compounding origami — not any single neuron\'s cleverness — is where deep networks get their expressive power.',
    invariant: 'Width adds creases; depth folds existing folds: region count grows exponentially with depth.',
  };

  yield {
    state: terrain(grid(relu), [
      { id: 'level', x: -0.4, y: 0.9, z: 1.0, label: 'decision contour: output = 1.0' },
    ]),
    highlight: { active: ['level'] },
    explanation: 'Why a CLASSIFIER cares about origami: a decision boundary is a horizontal slice through this terrain — "predict spam where output > 1.0". Slice a piecewise-linear surface and you get a POLYGONAL path: straight segments that turn exactly at the creases. Every ReLU network\'s decision boundary, however curvy it looks zoomed out, is a polygon with astronomically many sides — each side inherited from some neuron\'s crease. Logistic Regression drew ONE straight boundary; this three-neuron layer already draws a boundary with several bends. Depth buys bends, and bends are exactly what separating real data requires.',
  };
}

function* smoothCountry() {
  yield {
    state: terrain(grid(sigmoid), [
      { id: 'plateau', x: -1.7, y: -1.7, z: layer(sigmoid)(-1.7, -1.7), label: 'the saturation plateau' },
    ]),
    highlight: { removed: ['plateau'] },
    explanation: 'Same three neurons, same weights — swap ReLU for SIGMOID and the origami melts into rolling hills: no creases, smooth everywhere, gentle S-curved slopes. Beautiful — and look at the corners of the map: far from the creases\' old locations the terrain goes utterly FLAT, because sigmoid saturates at 0 and 1. Flat terrain means zero gradient, and zero gradient means nothing to learn from: this plateau is the literal landscape of Vanishing & Exploding Gradients — a neuron stuck out here receives no teaching signal no matter how wrong it is. The hills are lovely; the plateaus are where learning goes to die.',
    invariant: 'Sigmoid saturation = flat terrain at the edges: gradients vanish exactly where corrections are largest.',
  };

  yield {
    state: terrain(grid(gelu), [
      { id: 'soft', x: 0, y: 0, z: layer(gelu)(0, 0), label: 'the rounded crease' },
    ]),
    highlight: { active: ['soft'] },
    explanation: 'The modern compromise: GELU — the default inside every Transformer Block. Watch its terrain: from a distance it is ReLU\'s origami (linear growth, no saturation ceiling, regions clearly visible), but zoom toward any crease and the fold is ROUNDED — a smooth fillet instead of a sharp edge, and even a slight dip below zero near the crease. The rounding keeps gradients well-defined and non-zero through the transition zone (no abrupt dead-switch like ReLU\'s, which can strand "dead neurons" permanently off), while inheriting ReLU\'s open-ended slope. Origami with sanded edges: the geometry explains the empirical win.',
    invariant: 'GELU ≈ ReLU with a smooth crease: linear wings, differentiable fold, no saturation ceiling.',
  };

  yield {
    state: terrain(grid(relu)),
    highlight: {},
    explanation: 'The closing map, one activation per geometry: SIGMOID/TANH — smooth hills with deadly plateaus (historic, now mostly gates and output layers); RELU — sharp origami, cheap to compute, gradients alive everywhere it is active, at the price of dead-flat zero regions that can permanently silence a neuron; GELU/SiLU — rounded origami, the transformer era\'s default. Every choice is the same trade read off the terrain: where is the surface FLAT (no learning), where is it STEEP (fast learning), and how violently does it bend (how hard is the function to optimize — Loss Landscapes & Optimization Geometry\'s smoothness story, one level down). Activation functions are usually taught as 1-D squiggles; they are better understood as what they do to the whole sheet of space — and now you have watched all three fold it.',
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
      heading: `What it is`,
      paragraphs: [
        `An activation function is not a squiggle on a 1-D graph; it is a geometric force that reshapes the entire input space. When you pass data through a neural layer — a weighted sum followed by an activation — you are literally folding, rolling, or stretching the 2-D plane into 3-D terrain. One tiny ReLU neuron carves one crease into the landscape: half the space goes dead flat (where the input is negative, the neuron outputs zero), the other half rises as a clean plane. Stack three neurons and their creases superimpose into a piecewise-linear origami of flat facets and sharp folds. Swap ReLU for sigmoid and the creases soften into rolling hills with saturation plateaus at the edges — the exact terrain where gradients vanish and learning stops. This visualization shows the shape that activation functions actually make, watched in real 3-D space.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Every activation function is a pointwise nonlinearity: for each neuron's pre-activation z (a weighted sum from Neural Network Forward Pass), apply the activation to get the output. In 3-D, you are plotting the layer's output height as a function of the two input coordinates x₁ and x₂. A ReLU neuron computes ReLU(w₁·x₁ + w₂·x₂ + b), which clamps all negative values to zero. Geometrically: the plane tilts according to the weights w₁ and w₂; the bias b shifts it; then ReLU "cuts" the plane at height zero, folding the negative half down to a flat dead zone. The crease — the line where the plane crosses zero — is a perfectly straight edge in space, exactly the decision boundary that separates the "on" region from the "off" region.`,
        `When you add two neurons, their creases cross. The two lines divide the plane into four sectors; each sector has its own output height because in each region, a different subset of neurons is "on." The layer is piecewise-linear: flat planes joined at creases, with no curves inside any piece. Depth compounds this. Stack another layer atop this one and each new neuron's weights no longer point through flat space — they thread through the already-folded origami, so their activation patterns are bent by every fold beneath them. This folding-of-folds is why depth multiplies regions exponentially (Montúfar et al., 2014) and why deep networks can express vastly more functions than shallow ones.`,
        `Now swap the activation: sigmoid smooths the creases into rolling hills with an S-curve shape. The terrain is no longer piecewise-linear; it is differentiable and smooth everywhere. But watch the edges: far from zero, sigmoid flattens into plateaus at the top and bottom. Flat terrain means zero slope, zero gradient, and zero feedback to learn from — Vanishing & Exploding Gradients is the literal landscape of these plateaus. GELU splits the difference: it keeps ReLU's linear wings (the open-ended slope) but rounds the crease instead of cutting it sharp, inheriting ReLU's learnable slopes while avoiding the dead-switch discontinuity that can permanently silence a neuron. The terrain is the function; the function's geometry determines what the network can optimize.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A single layer evaluation is one matrix-vector multiply (the Neural Network Forward Pass) followed by element-wise activation: O(n_hidden) multiply-adds for n_hidden neurons. ReLU costs almost nothing — one comparison per neuron, a constant factor slower than the multiply itself. Sigmoid and GELU call transcendental functions (exponential, polynomial approximation) and cost 10–20× more per evaluation, which is why production systems prefer ReLU in hidden layers and save sigmoid for the final binary classification head. Storage: an activation function is a formula, not a parameter. No weights, no gradients, no memory beyond the neurons' pre-activations that you compute anyway. Backward pass: all three activations are differentiable, so the chain rule works. ReLU's derivative is a step function (1 where active, 0 where dead), making backprop fast; sigmoid's derivative is sigmoid(z) · (1 − sigmoid(z)), a smooth curve that is always positive but very small near saturation (where learning slows); GELU's derivative is smooth everywhere. In short: ReLU is cheap and fast; sigmoid is smooth but expensive; GELU is a modern compromise, cheap almost as ReLU while keeping sigmoid's smoothness (minus the saturation).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `ReLU dominates hidden layers in nearly every modern network — convolutional, recurrent, transformer — because it is dirt cheap, it never saturates, and its piecewise-linear geometry is expressive enough for any learnable representation. Logistic Regression with sigmoid remains the gold standard for binary classification: the sigmoid output is already a valid probability, so no additional loss function is needed. Sigmoid also gates information in LSTMs and GRUs, where controlled saturation is a feature. GELU is the default activation inside every Transformer Block and the reason transformer models train so stably compared to their ReLU ancestors — the rounded crease means gradients stay alive through the transition zone, allowing deeper models to train without desperate tricks like batch normalization. Tanh (which is sigmoid's zero-centered cousin) was popular before ReLU but has fallen out of favor because it saturates just as hard and costs slightly more. The choice of activation — ReLU vs GELU vs sigmoid — is pure geometric intuition: you are choosing what shape the layer imprints on the data space.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest mistake is treating activations as "the thing that makes a network nonlinear" without visualizing what nonlinearity means. A linear layer (no activation) would be a single tilted plane — boring, expressively useless. An activation folds that plane into a piecewise-linear origami (ReLU) or rolls it into smooth hills (sigmoid), which is what buys expressiveness. But piecewise-linear is not magic; Logistic Regression shows that even a single sigmoid curve (a 1-layer network) can separate simple data with a smooth decision boundary, a single curved line. Many practitioners mistakenly think ReLU is "better" universally: it is faster and avoids saturation, but its sharp creases and dead-zone pathology (a neuron can become permanently stuck at zero if its weights slip into a region where it never activates) are real costs. GELU emerged because of those costs, not because ReLU was wrong.`,
        `A second pitfall: ignoring the loss landscape implications. The terrain you have just watched is the function's surface — literally what the network computes. But the optimization landscape (Loss Landscapes & Optimization Geometry) is the high-dimensional space of loss values as a function of weights. The activation function's choice propagates into that loss landscape in subtle ways: sharp creases in the activation make the loss landscape spiky and hard to navigate; smooth saturation makes the landscape flat (gradient-starved); rounded creases like GELU smooth the landscape while keeping slopes alive. When your model trains slowly or gets stuck, the cause often lies in this interplay, not in the learning rate alone.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Dive deeper into Activation Functions to see the 1-D curves of sigmoid, tanh, ReLU, and GELU side by side, and understand the tradeoffs in closed form. Then move to Neural Network Forward Pass to see how the weighted sum flows into the activation, building the complete picture of one layer. Read Vanishing & Exploding Gradients to understand why sigmoid's saturation is not just a geometric curiosity but a concrete training disaster — how the backward pass is starved by flat terrain. Explore Transformer Block to see how GELU's rounded geometry enabled the deep, stable models that transformed NLP. For classifiers, study Logistic Regression to see a single-neuron network using sigmoid (one smooth curve instead of many ReLU folds). Finally, when you are ready to think about the high-dimensional geometry where networks actually live, read The Loss Landscape, in 3D to understand how activation choice shapes the terrain you optimize on.`,
      ],
    },
  ],
};
