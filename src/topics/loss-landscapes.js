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
        `A loss landscape is the terrain that gradient descent actually walks — a high-dimensional surface where each axis is a weight in your neural network and the height at each point is the loss (error) at those weights. For a network with millions of parameters, this landscape has millions of dimensions and a bewildering complexity: valleys that trap, saddle points that plateau, sharp minima and flat ones that generalize at entirely different rates. The visualization shows a 1-D slice — a core sample through the terrain — but that slice reveals the core shapes that matter: basins separated by ridges, flat floors that forgive small shifts in the world, and the hidden rule that explains modern deep learning: flatness, not depth, is where generalization lives.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A gradient descent step is downhill walking: you measure the slope (gradient) in every direction, step downhill by learning rate times gradient, and repeat. In a convex landscape (Logistic Regression's friendly single bowl), this always reaches the global optimum. In a neural network's landscape, it is less kind. Starting from w₀ = 3 in the visualization, pure gradient descent rolls downhill and settles at w ≈ 1.48 — the shallow basin to the right. The better valley (loss 0.49) sits across the ridge to the left. Pure GD never goes uphill, so it is trapped: where you start decides where you end. This is the non-convexity's core tax — initialization is not tuning but destiny.`,
        `High-dimensional landscapes introduce the saddle point: a location where the gradient is zero but the surface curves upward along some directions and downward along others — a mountain pass, not a valley floor. A zero-gradient point is a critical point, and the 1990s feared millions of bad local minima. The surprise: in d dimensions, a random critical point is a true local minimum with probability roughly 2⁻ᵈ. Since d is in the millions, essentially all critical points are saddles. The real enemy is not traps but slowness: near a saddle the gradient is nearly zero in every direction, so vanilla gradient descent crawls — the plateau you see on loss curves that looks like convergence but is actually a waiting room. Modern optimizers escape via three mechanisms shown in the visualization: momentum accumulates speed to coast across flats; minibatch noise (SGD's sloppiness) perturbs the trajectory off the unstable direction; adaptive methods amplify steps where gradients run quiet. And the empirical reassurance: for large networks, nearly all minima these methods reach are roughly equally good and often connected by low-loss tunnels (mode connectivity), so the landscape is not a minefield but a navigable river delta.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Understanding loss landscapes costs nothing computationally — you compute gradients and steps during normal training, so the insight is free. Visualizing them in dimensions you can see (2-D or 3-D slices) requires scanning along directions and storing the loss at each point: O(grid points × forward pass cost), which is expensive for large networks but tractable for small ones and worth the insight. The actual optimization cost is governed by the descent method: vanilla gradient descent is O(iterations × gradient computation); momentum and adaptive methods (Adam, RMSprop) add per-parameter state and a bit of arithmetic per step but are nearly always worth it in wall-clock time because they navigate the landscape far more effectively. The memory cost of understanding — storing the landscape itself — is negligible; storing what you learned about flatness vs sharpness is a number per weight or per network layer, O(parameters), which is always available.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Loss landscape visualization is a research and debugging tool, not something users run in production. When your network trains slowly, landscape analysis can reveal whether you are crawling up a saddle plateau (needs momentum or noise) or stuck in a sharp minimum (needs regularization to flatten). When two optimization methods give different loss values at convergence, the landscape explains why: the sharp-vs-flat visualization shows identical training loss (0.50 at both minima) but when test data shifts sideways (distribution shift), the flat minimum holds at 0.65 while the sharp one jumps to 2.59 — a 4× penalty for sharpness. This is why small-batch training (noisy SGD) usually beats huge batches: the noise is a flatness filter. Production systems use this insight implicitly: SAM (sharpness-aware minimization) optimizes not the loss at a point but the worst loss in a small neighborhood, explicitly seeking flat minima; weight averaging centers you in the basin you found; dropout and L1/L2 regularization flatten the landscape. The Learning Curves topic shows variance as geometry; this topic shows why flatness is variance control.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is the 1990s terror of local minima — that neural networks get stuck in bad local optima. The visualization shows the real shape of high-dimensional critical points (saddles, not bad minima), and decades of empirical work shows that for large networks, the minima you reach via modern optimizers are nearly always comparable in loss and connected by low-loss paths. Seeing a loss plateau on your training curve does not mean you are trapped; it usually means you are sliding across a saddle (gradient near zero but not quite). Adding momentum or noise fixes this — you do not need to change the architecture. Another trap: confusing a 1-D visualization slice with the full landscape. Real landscapes are high-dimensional; a 1-D slice can miss features — paths that exist in full space but not along one axis. The sharpness-vs-flatness story is robust across many slices and is causal for generalization (variance is fundamentally geometric), but slices can be misleading about reachability. Finally, do not assume the landscape is static: it changes as you train (weight updates shift the terrain), especially in the early phases. The geometry that matters most is the landscape near the weights you actually use, not the landscape at initialization.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `This topic is the geometry of Gradient Descent — go there to see the calculus of stepping downhill. When your gradient descent gets stuck on a plateau, Vanishing & Exploding Gradients explains why the signal dies and how architectural choices prevent it. The flatness story is the Learning Curves & Bias–Variance topic drawn as geometry: variance is the responsiveness of your loss surface to small shifts in data, and flatness minimizes that responsiveness. Regularization: L1 & L2 actively flattens the loss landscape by penalizing large weights that create sharp features. Backpropagation is how you compute the gradients that drive every step of descent. Once you understand the landscape, you understand why modern optimization works: architecture shapes the landscape, the optimizer's noise chooses which valleys are inhabitable, and regularization flattens them.`,
      ],
    },
  ],
};
