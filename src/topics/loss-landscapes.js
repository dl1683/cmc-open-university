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
  const r2 = (v) => Math.round(v * 100) / 100;
  const deepLoss = r2(well(-2.12));
  const shallowLoss = r2(well(1.86));
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
    explanation: `Gradient Descent was introduced on a friendly bowl — one valley, one bottom, convergence guaranteed (Logistic Regression's convex luxury). A neural network's loss is nothing like that bowl. Here is a 1-D slice through a realistic terrain: TWO valleys, the left genuinely better (loss ${deepLoss}) than the right (${shallowLoss}), separated by a ridge — a ${r2(shallowLoss / deepLoss)}x difference. The full landscape of a modern network has millions of dimensions and unimaginably many such features — this slice is a core sample, and it already breaks the convex guarantees.`,
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
        { id: 'path', label: 'GD from wâ‚€ = 3', points: path },
      ],
      markers: [{ id: 'stuck', x: path.at(-1).x, y: path.at(-1).y, label: `settled at ${path.at(-1).x.toFixed(2)}` }],
    }),
    highlight: { active: ['path'], removed: ['stuck'] },
    explanation: `Watch actual gradient descent (computed live, lr = 0.4) released from wâ‚€ = 3: it rolls downhill, brakes, and settles at w â‰ˆ ${path.at(-1).x.toFixed(2)} — the SHALLOW basin, loss 1.48. The better valley sits a short walk away, but reaching it means going UPHILL over the ridge, and pure gradient descent never goes uphill. Where you START decides where you END: that is non-convexity\'s tax, and why initialization (the He/Xavier schemes from Vanishing Gradients) is not bookkeeping but destiny.`,
    invariant: 'Plain gradient descent is strictly downhill: it converges to the basin of whatever slope it starts on.',
  };

  const saddleLoss = 2;
  const saddleCurve = 0.3;
  const nAxes = 2;
  const nEscapeTools = 3;
  yield {
    state: plotState({
      axes: { x: { label: 'distance from the critical point' }, y: { label: 'loss along each axis' } },
      series: [
        { id: 'axisUp', label: 'along axis 1: minimum', points: WS.map((v) => ({ x: v, y: saddleLoss + saddleCurve * v * v })) },
        { id: 'axisDown', label: 'along axis 2: MAXIMUM', points: WS.map((v) => ({ x: v, y: saddleLoss - saddleCurve * v * v })) },
      ],
      markers: [{ id: 'saddle', x: 0, y: saddleLoss, label: 'gradient = 0 here' }],
    }),
    highlight: { compare: ['axisUp', 'axisDown'], active: ['saddle'] },
    explanation: `Now the high-dimensional twist that makes the trap story misleading: the SADDLE POINT. At loss = ${saddleLoss} the gradient is exactly zero — but it is a minimum along ${nAxes - 1} axis and a MAXIMUM along the other (curvature ±${saddleCurve}): a mountain pass, not a valley floor. Count what randomness demands: a true local minimum needs the surface to curve upward along ALL d directions; if each direction's curvature were a coin flip, that is 2^(-d) — and d is in the millions. Random zero-gradient points in high dimension are saddles, essentially always.`,
    invariant: 'A random critical point in d dimensions is a minimum with probability ~2?áµˆ: high-D is saddles all the way.',
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
      format: (v) => ['', 'gradient â‰ˆ 0 for long stretches — GD crawls', 'accumulated velocity coasts across flats', 'random kicks knock you off the pass', 'scales up steps along quiet directions'][v],
    }),
    highlight: { removed: ['saddleRow:role'], found: ['noise:role'] },
    explanation: `Why saddles still matter: near loss = ${saddleLoss} the gradient is nearly zero in every direction, so vanilla GD slows to a geological crawl — the plateau on your loss curve that LOOKS like convergence and is actually a saddle's waiting room. The escape kit has ${nEscapeTools} tools: MOMENTUM carries speed across the flat; the NOISE in minibatch gradients — long treated as a defect — randomly perturbs the trajectory off the unstable direction (SGD's sloppiness is a feature); adaptive methods amplify steps where gradients run quiet. And the empirical surprise that buried the old pessimism: for big networks, nearly all the minima these methods reach are roughly equally good, and often connected by low-loss tunnels (mode connectivity). The landscape is not a minefield; it is a vast, navigable river delta.`,
  };
}

function* sharpFlat() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const sharpTrainLoss = r2(trainLoss(2));
  const flatTrainLoss = r2(trainLoss(-2));
  const sharpTestLoss = r2(testLoss(2));
  const flatTestLoss = r2(testLoss(-2));
  const nHerdingForces = 4;
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
    explanation: `Two minima, IDENTICAL training loss — ${sharpTrainLoss} each. To the training set they are indistinguishable; an optimizer hunting low loss has no reason to prefer either. But look at their shapes: the right one is a needle-thin slot canyon, the left a wide, lazy basin. Hold that picture and ask the only question that matters: what happens when the data shifts — when test data differs slightly from training data, as it always does?`,
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
    explanation: `Test data is the same terrain nudged sideways — the distribution shifted a little, so the whole curve slides. Now read the bill at each minimum: the FLAT basin barely notices (0.50 â†’ ${testLoss(-2).toFixed(2)}) because a wide floor forgives a sideways nudge; the SHARP canyon is catastrophic (0.50 â†’ ${testLoss(2).toFixed(2)}) — one step left of a needle and you are climbing its wall. Same training performance, ${(testLoss(2) / testLoss(-2)).toFixed(1)}Ã— different generalization. Flatness is robustness to being slightly wrong about the world — which is the entire job description of generalization (the variance story of Learning Curves, drawn as geometry).`,
    invariant: 'A flat minimum tolerates trainâ†’test shift; a sharp one converts the same shift into large loss.',
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
      format: (v) => ['', 'noise can\'t sit in a needle â†’ lands flat', 'precise steps settle anywhere — often sharp', 'big steps overshoot narrow slots', 'explicitly seeks low-loss NEIGHBORHOODS'][v],
    }),
    highlight: { found: ['smallbatch:effect'], removed: ['bigbatch:effect'] },
    explanation: `The ${nHerdingForces} herding forces. A noisy optimizer is a ball being jiggled while it rolls: it cannot REST in a needle-thin canyon — the jiggle bounces it out — but a wide basin holds it easily, so SGD's noise acts as a flatness filter. The sharp basin paid ${sharpTestLoss} on test vs the flat basin's ${flatTestLoss} — a ${r2(sharpTestLoss / flatTestLoss)}x penalty for the same ${sharpTrainLoss} training loss. Large learning rates overshoot slots narrower than the step size. SAM (sharpness-aware minimization) optimizes the worst loss in a neighborhood rather than at a point, and stochastic weight averaging centers you in the basin you found. None of it is convex; all of it is geometry.`,
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
    {heading: 'How to read the animation', paragraphs: ['Read the curve and surface as loss values over possible parameter settings. The active point is the optimizer state, and its movement follows local gradient information rather than a map of the whole terrain.', {type: "callout", text: "A loss landscape turns training symptoms into geometry: path, slope, curvature, basin width, and final robustness all become inspectable."}, 'Visited path segments show where training has already spent steps. A found minimum is a local outcome of that path, so compare basin shape as well as final height.', {type: 'image', src: './assets/gifs/loss-landscapes.gif', alt: 'Animated walkthrough of the loss landscapes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A loss function assigns a penalty to model parameters on data. A loss landscape is the geometry you get when every parameter setting becomes a point and its loss becomes height.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock function surface with a narrow curved valley', caption: 'The Rosenbrock valley is a classic optimization surface where curvature, direction, and step size interact. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'}, 'A scalar loss curve hides path, curvature, and basin width. Two runs can reach the same training loss while one is fragile under small shifts and the other sits in a broad low-loss region.']},
    {heading: 'The obvious approach', paragraphs: ['The obvious approach is to watch training loss and validation loss. If loss falls, the run seems healthy; if it stalls or spikes, the run seems broken.', 'That view is necessary but incomplete. It says what happened to the objective, not whether the optimizer crossed a ravine, stalled near a saddle, or bounced inside sharp curvature.']},
    {heading: 'The wall', paragraphs: ['Neural-network surfaces are high-dimensional and non-convex. A million parameters mean a million axes, so any 2D picture is a slice rather than the whole object.', 'Diagnosis is the wall. A plateau can mean convergence, a saddle, bad scaling, too small a learning rate, saturated activations, or weak gradient flow.']},
    {heading: 'The core insight', paragraphs: ['Optimization is geometry plus dynamics. Initialization, learning rate, batch noise, momentum, adaptive scaling, and schedules change the path through the same surface.', 'Generalization also has a geometric side. A wide low-loss basin means nearby parameters still work, while a sharp basin means tiny perturbations can raise loss quickly.']},
    {heading: 'How it works', paragraphs: ['Researchers inspect a landscape by choosing one or two directions through parameter space and evaluating loss on a grid. The slice can reveal curvature, barriers, basin width, and path behavior, even though it is not the full landscape.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Gradient_descent.svg/250px-Gradient_descent.svg.png', alt: 'Gradient descent path crossing contour lines toward a minimum', caption: 'Contour lines make local descent visible: each step reads only nearby slope, not the whole terrain. Source: Wikimedia Commons, Gradient descent illustration.'}, 'In practice, pair pictures with measurements. Track gradient norms, update norms, learning rate, seed variance, validation gaps, and checkpoint sensitivity to small weight noise.']},
    {heading: 'Why it works', paragraphs: ['Landscape reasoning is useful when it predicts interventions. If a plateau is a saddle or flat ravine, momentum, noise, or a learning-rate change should alter the path.', 'If a solution is sharp, small weight perturbations should raise loss more than they do around a flat solution. If the prediction fails, the cause may be data, labels, leakage, or architecture rather than landscape geometry.']},
    {heading: 'Cost and complexity', paragraphs: ['Landscape plots cost extra evaluations. A 51 by 51 grid has 2,601 points, and each point may require a model pass over a validation batch.', 'Optimizers pay different state costs as behavior. SGD stores little, momentum stores velocity, Adam stores two moment estimates, and sharpness-aware methods often need an extra pass to prefer flatter neighborhoods.']},
    {heading: 'Real-world uses', paragraphs: ['Landscape thinking helps debug training. Loss spikes suggest sharp curvature or too-large steps, long flat periods suggest saddles or weak gradient flow, and high seed variance suggests small useful basins.', 'It also informs compression and robustness. Quantization, pruning, weight averaging, and sharpness-aware minimization all benefit when nearby parameter settings still perform well.']},
    {heading: 'Where it fails', paragraphs: ['A slice can mislead. A wall in one plane may have a low-loss tunnel in another direction, and a flat slice may miss sharpness along an unplotted axis.', 'Flatness is parameterization-dependent. Rescaling adjacent layers can change apparent sharpness without changing the function, so serious claims need controlled perturbations and held-out evaluation.']},
    {heading: 'Worked example', paragraphs: ['For linear regression y = wx + b on points (1, 2), (2, 4), and (3, 6), mean squared error is zero at w = 2 and b = 0. At w = 1 and b = 1, predictions are 2, 3, and 4, so squared errors are 0, 1, and 4, giving loss 5/3 = 1.67.', 'At w = 3 and b = -1, predictions are 2, 5, and 8, giving the same loss 1.67. The simple model forms a convex bowl, while neural networks replace that bowl with saddles, ridges, and many basins.']},
    {heading: 'Sources and study next', paragraphs: ['Read Li et al. 2018 on visualizing loss landscapes, Goodfellow et al. 2014 on optimization behavior, and Keskar et al. 2017 on sharp minima. Study gradient descent, learning-rate schedules, Adam, Hessian curvature, batch normalization, and regularization next.']},
  ],
};
