// Loss landscapes: the terrain gradient descent actually walks — basins
// that trap, saddles that stall, and the surprising rule that FLAT valleys,
// not deep ones, are where generalization lives.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'loss-landscapes',
  title: 'Loss Landscapes & Optimization Geometry',
  category: 'AI & ML',
  summary: 'The terrain under gradient descent: trapping basins, stalling saddles, and why flat minima generalize.',
  controls: [
    { id: 'view', label: 'Survey', type: 'select', options: ['walking the terrain', 'sharp valleys vs flat ones'], defaultValue: 'walking the terrain' },
  ],
  run,
};

// A 1-D slice of a non-convex loss: double well, left basin deeper.
const well = (w) => ((w * w - 4) ** 2) / 16 + w / 4 + 1;
const wellGrad = (w) => (w * (w * w - 4)) / 4 + 0.25;
const WS = Array.from({ length: 61 }, (_, i) => -3.5 + i * (7 / 60));

// Sharp-vs-flat: two minima of EQUAL training depth, different widths.
const trainLoss = (w) => 3 - 2.5 * Math.exp(-((w - 2) ** 2) / 0.05) - 2.5 * Math.exp(-((w + 2) ** 2) / 1.5);
const testLoss = (w) => trainLoss(w - 0.3);

function* terrain() {
  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'loss' } },
      series: [{ id: 'well', label: 'loss(w)', points: WS.map((w) => ({ x: w, y: well(w) })) }],
      markers: [
        { id: 'good', x: -2.12, y: well(-2.12), label: 'deep basin: 0.49' },
        { id: 'meh', x: 1.86, y: well(1.86), label: 'shallow basin: 1.48' },
      ],
    }),
    highlight: { found: ['good'], compare: ['meh'] },
    explanation: 'Gradient Descent was introduced on a friendly bowl — one valley, one bottom, convergence guaranteed (Logistic Regression\'s convex luxury). A neural network\'s loss is nothing like that bowl. Here is a 1-D slice through a realistic terrain: TWO valleys, the left genuinely better (loss 0.49) than the right (1.48), separated by a ridge. The full landscape of a modern network has millions of dimensions and unimaginably many such features — this slice is a core sample, and it already breaks the convex guarantees.',
  };

  const path = [];
  let w = 3;
  for (let i = 0; i < 12; i++) {
    path.push({ x: w, y: well(w) });
    w -= 0.4 * wellGrad(w);
  }
  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'loss' } },
      series: [
        { id: 'well', label: 'loss(w)', points: WS.map((v) => ({ x: v, y: well(v) })) },
        { id: 'path', label: 'GD from w₀ = 3', points: path },
      ],
      markers: [{ id: 'stuck', x: path.at(-1).x, y: path.at(-1).y, label: `settled at ${path.at(-1).x.toFixed(2)}` }],
    }),
    highlight: { active: ['path'], removed: ['stuck'] },
    explanation: `Watch actual gradient descent (computed live, lr = 0.4) released from w₀ = 3: it rolls downhill, brakes, and settles at w ≈ ${path.at(-1).x.toFixed(2)} — the SHALLOW basin, loss 1.48. The better valley sits a short walk away, but reaching it means going UPHILL over the ridge, and pure gradient descent never goes uphill. Where you START decides where you END: that is non-convexity\'s tax, and why initialization (the He/Xavier schemes from Vanishing Gradients) is not bookkeeping but destiny.`,
    invariant: 'Plain gradient descent is strictly downhill: it converges to the basin of whatever slope it starts on.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'distance from the critical point' }, y: { label: 'loss along each axis' } },
      series: [
        { id: 'axisUp', label: 'along axis 1: minimum', points: WS.map((v) => ({ x: v, y: 2 + 0.3 * v * v })) },
        { id: 'axisDown', label: 'along axis 2: MAXIMUM', points: WS.map((v) => ({ x: v, y: 2 - 0.3 * v * v })) },
      ],
      markers: [{ id: 'saddle', x: 0, y: 2, label: 'gradient = 0 here' }],
    }),
    highlight: { compare: ['axisUp', 'axisDown'], active: ['saddle'] },
    explanation: 'Now the high-dimensional twist that makes the trap story misleading: the SADDLE POINT. At this spot the gradient is exactly zero — but it is a minimum along one axis and a MAXIMUM along the other: a mountain pass, not a valley floor. Count what randomness demands: a true local minimum needs the surface to curve upward along ALL d directions; if each direction\'s curvature were a coin flip, that is 2⁻ᵈ — and d is in the millions. Random zero-gradient points in high dimension are saddles, essentially always. The 1990s fear of "millions of bad local minima" had the wrong villain.',
    invariant: 'A random critical point in d dimensions is a minimum with probability ~2⁻ᵈ: high-D is saddles all the way.',
  };

  yield {
    state: matrixState({
      title: 'The real enemy is slowness, not traps — and the escape kit',
      rows: [
        { id: 'saddleRow', label: 'saddle plateaus' },
        { id: 'momentum', label: 'momentum' },
        { id: 'noise', label: 'minibatch noise (SGD)' },
        { id: 'adaptive', label: 'Adam-style scaling' },
      ],
      columns: [{ id: 'role', label: 'what it does' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'gradient ≈ 0 for long stretches — GD crawls', 'accumulated velocity coasts across flats', 'random kicks knock you off the pass', 'scales up steps along quiet directions'][v],
    }),
    highlight: { removed: ['saddleRow:role'], found: ['noise:role'] },
    explanation: 'Why saddles still matter: near the pass the gradient is nearly zero in every direction, so vanilla GD slows to a geological crawl — the plateau on your loss curve that LOOKS like convergence and is actually a saddle\'s waiting room. The escape kit is the modern optimizer\'s standard equipment: MOMENTUM carries speed across the flat; the NOISE in minibatch gradients — long treated as a defect — randomly perturbs the trajectory off the unstable direction (SGD\'s sloppiness is a feature); adaptive methods amplify steps where gradients run quiet. And the empirical surprise that buried the old pessimism: for big networks, nearly all the minima these methods reach are roughly equally good, and often connected by low-loss tunnels (mode connectivity). The landscape is not a minefield; it is a vast, navigable river delta.',
  };
}

function* sharpFlat() {
  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'training loss' } },
      series: [{ id: 'train', label: 'training loss', points: WS.map((w) => ({ x: w, y: trainLoss(w) })) }],
      markers: [
        { id: 'sharp', x: 2, y: trainLoss(2), label: 'sharp: 0.50' },
        { id: 'flat', x: -2, y: trainLoss(-2), label: 'flat: 0.50' },
      ],
    }),
    highlight: { compare: ['sharp', 'flat'] },
    explanation: 'Two minima, IDENTICAL training loss — 0.50 each. To the training set they are indistinguishable; an optimizer hunting low loss has no reason to prefer either. But look at their shapes: the right one is a needle-thin slot canyon, the left a wide, lazy basin. Hold that picture and ask the only question that matters: what happens when the data shifts — when test data differs slightly from training data, as it always does?',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'a weight w (1-D slice)' }, y: { label: 'loss' } },
      series: [
        { id: 'train', label: 'training loss', points: WS.map((w) => ({ x: w, y: trainLoss(w) })) },
        { id: 'test', label: 'test loss (shifted world)', points: WS.map((w) => ({ x: w, y: testLoss(w) })) },
      ],
      markers: [
        { id: 'sharpPay', x: 2, y: testLoss(2), label: `sharp pays: ${testLoss(2).toFixed(2)}` },
        { id: 'flatPay', x: -2, y: testLoss(-2), label: `flat pays: ${testLoss(-2).toFixed(2)}` },
      ],
    }),
    highlight: { removed: ['sharpPay'], found: ['flatPay'] },
    explanation: `Test data is the same terrain nudged sideways — the distribution shifted a little, so the whole curve slides. Now read the bill at each minimum: the FLAT basin barely notices (0.50 → ${testLoss(-2).toFixed(2)}) because a wide floor forgives a sideways nudge; the SHARP canyon is catastrophic (0.50 → ${testLoss(2).toFixed(2)}) — one step left of a needle and you are climbing its wall. Same training performance, ${(testLoss(2) / testLoss(-2)).toFixed(1)}× different generalization. Flatness is robustness to being slightly wrong about the world — which is the entire job description of generalization (the variance story of Learning Curves, drawn as geometry).`,
    invariant: 'A flat minimum tolerates train→test shift; a sharp one converts the same shift into large loss.',
  };

  yield {
    state: matrixState({
      title: 'What herds the optimizer toward flat minima?',
      rows: [
        { id: 'smallbatch', label: 'small batches (noisy SGD)' },
        { id: 'bigbatch', label: 'huge batches' },
        { id: 'lr', label: 'large learning rate' },
        { id: 'sam', label: 'SAM / weight averaging' },
      ],
      columns: [{ id: 'effect', label: 'effect on where you land' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'noise can\'t sit in a needle → lands flat', 'precise steps settle anywhere — often sharp', 'big steps overshoot narrow slots', 'explicitly seeks low-loss NEIGHBORHOODS'][v],
    }),
    highlight: { found: ['smallbatch:effect'], removed: ['bigbatch:effect'] },
    explanation: 'The herding forces. A noisy optimizer is a ball being jiggled while it rolls: it cannot REST in a needle-thin canyon — the jiggle bounces it out — but a wide basin holds it easily, so SGD\'s noise acts as a flatness filter (the famous observation that very large batches, with their precise quiet gradients, generalize WORSE — Keskar et al. 2016). Large learning rates do the same by overshooting slots narrower than the step size. And once the principle was understood, it became a design target: SAM (sharpness-aware minimization) optimizes the worst loss in a neighborhood rather than at a point, and stochastic weight averaging centers you in the basin you found. The dial-vs-terrain summary of all of deep learning practice: architecture shapes the landscape; the optimizer\'s noise chooses which valleys are inhabitable; regularization (Regularization, Dropout) flattens them further. None of it is convex; all of it is geometry.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'walking the terrain') yield* terrain();
  else if (view === 'sharp valleys vs flat ones') yield* sharpFlat();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A loss landscape is the surface that optimization walks: each weight is an axis, and height is loss. The demo shows only 1-D slices, but the slice is enough to break the friendly story from Gradient Descent. Logistic Regression gets a convex bowl; neural networks get ridges, basins, flat plateaus, and sharp canyons. The point of the visualization is not that real networks are one-dimensional. It is that even a thin core sample already contains the shapes that govern training behavior.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `In the first slice, plain descent starts at w0 = 3 with lr = 0.4. It rolls downhill into the right basin around w = 1.86, whose loss is about 1.48, even though the left basin reaches about 0.49. The better answer is across a ridge, and pure downhill motion never climbs a ridge. Initialization is therefore not clerical; it chooses the basin of attraction.`,
        `High dimensions change the villain. A point with zero gradient is usually not a bad local minimum but a saddle: uphill in some directions, downhill in others. Saddle Points & How SGD Escapes Them expands that story. The Hessian: Curvature & Newton's Step reads those directions through curvature, while Natural Gradient & Fisher Information changes the geometry used to measure a step. This is why "the gradient is small" is not enough evidence that training is finished.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training already computes gradients; drawing the landscape costs extra forward passes over a grid, O(grid points times model cost). That is research tooling, not production inference. Optimizers add their own costs: Momentum, RMSProp & Adam stores state to move through ravines and plateaus faster, while plain descent pays less memory but wastes steps. The landscape itself is rarely stored; what matters is the local geometry near the weights you actually deploy.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The sharp-vs-flat view gives the practical reason to care. Two minima have equal training loss, 0.50, but when the test curve shifts slightly, the flat basin barely worsens while the sharp one jumps much higher. Learning-Rate Schedules & Warmup, small-batch noise, weight averaging, and SAM all exploit this: they make narrow minima harder to inhabit and broad minima easier to keep. Flatness is robustness to being slightly wrong about the world.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not overread a 1-D slice; real networks can move around barriers in directions the slice hides. Do not assume every plateau is convergence; it may be a saddle waiting room. Do not equate the lowest training loss with best generalization. Regularization: L1 & L2 and ordinary dropout are useful partly because they change which regions are flat enough to survive. Also remember that the landscape changes as weights move; the geometry near initialization is not the whole story.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `After this, study saddles, curvature, and preconditioning as different languages for the same terrain. The lasting habit is geometric skepticism: whenever an optimizer behaves strangely, ask whether the problem is a basin choice, a saddle plateau, a ravine, or a sharp minimum that looks good only on training data.`,
        `That question also protects you from overclaiming. A lower training loss is one coordinate on the map, not the whole map. The shape around the solution determines whether the model survives new data, new seeds, and small implementation changes.`,
        `When two runs tie on validation loss, prefer the one that is stable across seeds and perturbations; that is often the flatter solution in practice.`,
      ],
    },
  ],
};
