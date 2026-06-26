// Saddle escape: in high dimensions almost every critical point is a saddle,
// exact gradient descent can park on one forever, and the noise in SGD —
// usually cast as a nuisance — is precisely what breaks the spell.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'saddle-escape',
  title: 'Saddle Points & How SGD Escapes Them',
  category: 'AI & ML',
  summary: 'Why high-dimensional landscapes are saddles almost everywhere, why exact gradient descent gets parked, and why minibatch noise is the escape mechanism.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['a world made of saddles', 'noise is the feature'], defaultValue: 'a world made of saddles' },
  ],
  run,
};

// The test surface: f(x, y) = ½(x² − 0.2y²). One up-direction, one gently
// DOWN direction (λ = 1, −0.2) — a shallow saddle, the kind that makes
// training plateaus. Contours are hyperbolas, like every saddle surface.
const LNEG = 0.2;
const f = (x, y) => 0.5 * (x * x - LNEG * y * y);
function saddleContours() {
  const series = [];
  for (const L of [0.4, 1.4]) {
    for (const sign of [1, -1]) {
      const pts = [];
      for (let y = -3.2; y <= 3.2001; y += 0.1) pts.push({ x: sign * Math.sqrt(2 * L + LNEG * y * y), y });
      series.push({ id: `cp${L}_${sign > 0 ? 'r' : 'l'}`, label: sign > 0 && L === 0.4 ? 'loss > 0' : '', points: pts });
    }
  }
  for (const L of [-0.1, -0.4]) {
    for (const sign of [1, -1]) {
      const pts = [];
      for (let x = -2.6; x <= 2.6001; x += 0.1) pts.push({ x, y: sign * Math.sqrt((x * x - 2 * L) / LNEG) });
      series.push({ id: `cn${-L}_${sign > 0 ? 'u' : 'd'}`, label: sign > 0 && L === -0.1 ? 'loss < 0' : '', points: pts });
    }
  }
  return series;
}
const CONTOURS = saddleContours();
const AXES = { x: { label: 'w₁', min: -2.7, max: 2.7 }, y: { label: 'w₂', min: -3.3, max: 3.3 } };

// Exact gradient descent from (2.4, 0): the start has NO component along
// the escape direction, so y stays 0 forever — GD converges to the saddle.
const LR = 0.15;
function exactGd(n) {
  let x = 2.4;
  let y = 0;
  const path = [{ x, y }];
  for (let i = 0; i < n; i++) {
    x -= LR * x;
    y += LR * LNEG * y; // -lr * (-0.2y): the down direction repels — but 0 stays 0
    path.push({ x, y });
  }
  return path;
}
const GD = exactGd(40);
const GD_GRADNORM = Math.hypot(GD.at(-1).x, -LNEG * GD.at(-1).y);

// SGD: identical surface, identical start, plus tiny deterministic minibatch
// noise (an LCG so the page is reproducible). The negative eigenvalue
// AMPLIFIES whatever noise lands on w₂ — escape is exponential compounding.
function* lcg() {
  let s = 12345;
  while (true) {
    s = (s * 1103515245 + 12345) % 2147483648;
    yield s / 1073741824 - 1; // uniform in [-1, 1)
  }
}
function sgd(noiseAmp, cap) {
  const rand = lcg();
  let x = 2.4;
  let y = 0;
  const path = [{ x, y }];
  while (Math.abs(y) < 3 && path.length <= cap) {
    x += -LR * x + noiseAmp * rand.next().value;
    y += LR * LNEG * y + noiseAmp * rand.next().value;
    path.push({ x, y });
  }
  return path;
}
const SGD_PATH = sgd(0.02, 600);
const ESCAPE_STEPS = SGD_PATH.length - 1;
const SGD_FINAL_LOSS = f(SGD_PATH.at(-1).x, SGD_PATH.at(-1).y);

// Newton step from anywhere lands ON the saddle: H⁻¹∇f(w) = w for this
// quadratic, so w − H⁻¹∇f = 0 — the saddle is the Newton fixed point.
const NEWTON = [{ x: 2.0, y: 2.2 }, { x: 0, y: 0 }];

function* saddleWorld() {
  yield {
    state: matrixState({
      title: 'A critical point with random curvature signs: chance all d are positive',
      rows: [
        { id: 'd2', label: 'd = 2 parameters' },
        { id: 'd10', label: 'd = 10' },
        { id: 'd20', label: 'd = 20' },
        { id: 'd50', label: 'd = 50' },
        { id: 'dnn', label: 'd = 10⁶ (a small neural net)' },
      ],
      columns: [{ id: 'p', label: 'P(minimum) = 2⁻ᵈ' }, { id: 'verdict', label: 'verdict' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
      format: (v) => ['', '1 in 4', 'minima still common', '1 in 1,024', 'rare', '1 in 1,048,576', 'one in a million', '1 in 10¹⁵', 'lottery odds', '1 in 2^1,000,000', 'effectively zero'][v],
    }),
    highlight: { removed: ['dnn:verdict'] },
    explanation: `The counting argument that reshaped how we think about deep learning. At a critical point (gradient = 0), each Hessian eigenvalue is positive or negative -- see The Hessian: Curvature & Newton Step for why signs are the whole local story. A minimum needs ALL d positive. If signs were fair coins, that probability is 2^(-d), and the table shows what that does as d grows. The refined story (Dauphin et al. 2014, drawing on random matrix theory) keeps the conclusion but adds the crucial twist: the coin is biased by HEIGHT. High up the landscape, negative directions abound; only near the floor do critical points become true minima. So the obstacle course of training is not bad minima; it is an endless field of saddles.`,
    invariant: 'P(all d eigenvalues positive) collapses exponentially in d: generic high-dimensional critical points are saddles.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [...CONTOURS, { id: 'gd', label: 'exact gradient descent — parked', points: GD }],
    }),
    highlight: { removed: ['gd'] },
    explanation: `Here is the failure, live. The surface is f = 1/2(w1^2 - 0.2w2^2): a saddle with one climbing direction (lambda = 1) and one gently descending escape route (lambda = -0.2, downhill along +/-w2 forever). Exact gradient descent starts at (2.4, 0) with no component along the escape direction, and the update can never create one: the w2 gradient is proportional to w2 itself, and 0.2 * 0 is 0. The path slides straight into the saddle and STOPS, gradient norm ${GD_GRADNORM.toExponential(1)} after 40 steps. Every convergence test based on "gradient is small" certifies this as success. The optimizer did not get trapped by a wall; it got parked by a symmetry.`,
    invariant: `Exact GD preserves zero components along eigendirections: start on the saddle stable manifold and you stay on it.`,
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [...CONTOURS, { id: 'newton', label: 'Newton step -- lands ON the saddle', points: NEWTON }],
    }),
    highlight: { removed: ['newton'] },
    explanation: `It gets worse before it gets better: Newton method is actively ATTRACTED to saddles. Newton solves grad f = 0, and a saddle satisfies that equation just as well as a minimum does; on this quadratic, one Newton step from anywhere lands exactly on the saddle (drawn live: one stride from (2.0, 2.2) to the origin). H inverse divides each direction by its eigenvalue, and dividing by a NEGATIVE eigenvalue flips the descent direction into ascent along that axis. The saddle-free Newton fix from Dauphin et al. is to divide by |lambda| instead: keep curvature magnitude, never its sign. Pure second-order methods need this surgery before they are safe in saddle country.`,
    invariant: 'Newton seeks ∇f = 0, not descent: negative eigenvalues flip its step uphill, making saddles fixed points.',
  };
}

function* noiseFeature() {
  yield {
    state: plotState({
      axes: AXES,
      series: [...CONTOURS,
        { id: 'gd', label: 'exact GD — parked forever', points: GD },
        { id: 'sgd', label: `SGD — escapes in ${ESCAPE_STEPS} steps`, points: SGD_PATH }],
    }),
    highlight: { found: ['sgd'], removed: ['gd'] },
    explanation: `Same surface, same start, same learning rate — plus one ingredient: a tiny random kick each step (amplitude 0.02, a stand-in for minibatch noise, generated deterministically so this page always draws the same picture). Exact GD is still parked at the origin. SGD wanders near the saddle for a long time, looking equally stuck — but every kick deposits a little w₂, and the negative curvature pays COMPOUND INTEREST on it: each step multiplies w₂ by (1 + lr·0.2). Invisible exponential growth, then suddenly the path peels away down the escape direction, reaching loss ${SGD_FINAL_LOSS.toFixed(2)} after ${ESCAPE_STEPS} steps, computed live. The noise everyone tunes AWAY for clean convergence is exactly what found the exit.`,
    invariant: 'Negative curvature amplifies noise exponentially: w₂ ← w₂(1 + lr·|λneg|) + ε compounds until escape.',
  };

  yield {
    state: matrixState({
      title: `Escape time ≈ log(R/ε) / (lr·|λneg|) — why plateaus happen`,
      rows: [
        { id: 'sharp', label: 'sharp escape: λneg = −1' },
        { id: 'ours', label: `this page: λneg = −0.2` },
        { id: 'shallow', label: 'shallow plateau: λneg = −0.01' },
      ],
      columns: [{ id: 'time', label: 'steps to escape (same noise, lr)' }],
      values: [[1], [2], [3]],
      format: (v) => ['', `~${Math.ceil(Math.log(150) / (LR * 1))} steps — barely noticeable`, `~${ESCAPE_STEPS} observed live — a visible pause`, `~${Math.ceil(Math.log(150) / (LR * 0.01))} steps — looks like convergence for thousands of iterations`][v],
    }),
    highlight: { active: ['shallow:time'] },
    explanation: `The compounding gives escape time a clean form: noise of size epsilon must grow to distance R, multiplying by (1 + lr * |lambda_neg|) per step, so escape takes roughly log(R/epsilon) / (lr * |lambda_neg|) steps. Read the table: the SHALLOWER the negative curvature, the LONGER the stall -- and that is the anatomy of a training plateau. The loss curve that flatlines for an epoch and then drops sharply was not slowly improving; it was orbiting a gentle saddle while w2 compounded below the noise floor, then fell off the edge. Theory backs the picture: perturbed gradient descent provably escapes all strict saddles in polynomial time (Jin et al. 2017), where exact GD can take exponential time or, as the previous view showed, never leave at all.`,
    invariant: 'Escape time scales as 1/|λneg|: gentle saddles make long plateaus — the flatline-then-drop signature of training curves.',
  };

  yield {
    state: matrixState({
      title: 'The saddle-escape toolbox',
      rows: [
        { id: 'sgd', label: 'minibatch noise (free)' },
        { id: 'mom', label: 'momentum' },
        { id: 'pgd', label: 'explicit perturbation' },
        { id: 'sfn', label: 'saddle-free Newton' },
      ],
      columns: [{ id: 'how', label: 'how it breaks the spell' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'every batch is a different surface: its gradient never exactly vanishes at the full-loss saddle', 'velocity built before the plateau carries the iterate across the stable manifold', 'detect a small gradient, inject a random kick, restart the compounding clock (provable: Jin et al.)', 'divide the step by |λ|, not λ: curvature magnitude without the sign-flip trap'][v],
    }),
    highlight: { active: ['sgd:how'] },
    explanation: `The toolbox, cheapest first. Minibatch noise needs no code at all, and it is not even isotropic: SGD noise is structured by the data, with more variance along directions where gradients disagree, which tends to align kicks with the directions that matter. Momentum, RMSProp & Adam help differently: velocity accumulated before the plateau coasts THROUGH the flat region rather than re-deriving motion from a vanishing gradient. The lesson that ties the page together: in high dimensions, optimization difficulty is mostly saddle topology, and stochasticity is a load-bearing part of why deep learning trains at all.`,
    invariant: 'Every practical escape mechanism is the same move: put mass on the negative-curvature direction and let it compound.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'a world made of saddles') yield* saddleWorld();
  else if (view === 'noise is the feature') yield* noiseFeature();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The plot shows a loss surface, which is a function the optimizer tries to minimize. The point at the origin is a saddle: the gradient is zero, one direction curves upward, and another direction curves downward. Active paths show optimizer motion, and removed or stalled paths show methods that treat the saddle as a stopping point.',
        {type: 'callout', text: 'A saddle is dangerous because zero gradient can coexist with a downhill direction that the optimizer has not activated yet.'},
        'In the SGD view, the small random minibatch perturbations put mass on the downhill direction. At first the path looks stuck because the displacement is tiny. The safe inference rule is that negative curvature multiplies any nonzero escape component, so noise can turn a flat-looking plateau into a sudden drop.',
        {type: 'image', src: './assets/gifs/saddle-escape.gif', alt: 'Animated walkthrough of the saddle escape visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Optimization in deep learning is not only about finding a low point. In high-dimensional spaces, many zero-gradient points are saddles rather than minima. A saddle has at least one downhill direction even though the local slope is zero at the point itself.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Saddle_point.svg/330px-Saddle_point.svg.png', alt: 'Saddle point on a hyperbolic paraboloid surface with one red critical point', caption: 'The saddle point has zero local slope at the red point, but the surface bends up in one direction and down in another. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Saddle_point.svg.'},
        'This matters because a training run can look converged while it is only parked near a saddle. The loss flattens, the gradient norm shrinks, and a naive stopping rule says success. The model may still be above a better basin that can be reached by moving along a negative-curvature direction.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious optimizer is full-batch gradient descent. Compute the exact gradient over all data, step downhill, and stop when the gradient norm is small. On a convex bowl this is sensible because the only zero-gradient point is the minimum.',
        'A second obvious tool is Newton method, which uses the Hessian. The Hessian is the matrix of second derivatives, and its eigenvalues describe curvature directions. Newton can move quickly on bowl-shaped problems because it rescales the gradient by curvature.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A saddle breaks the rule that small gradient means good solution. On f(w1, w2) = 0.5 * (w1^2 - 0.2 * w2^2), the origin has zero gradient. Along w1 the surface rises away from the origin, but along w2 the surface falls.',
        'Exact gradient descent can preserve the wrong zero. If it starts with w2 = 0, the w2 gradient is proportional to w2, so the update never creates an escape component. Newton is worse on this quadratic because solving for zero gradient lands directly on the saddle.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Negative curvature turns tiny displacement into growing displacement. If the negative Hessian eigenvalue has magnitude |lambda|, gradient descent updates the escape coordinate by roughly multiplying it by 1 + learning_rate * |lambda|. Zero stays zero, but any nonzero perturbation compounds.',
        'Minibatch SGD supplies that perturbation. A minibatch gradient is an estimate of the full gradient, so it contains noise from the sampled data. Near a strict saddle, that noise can push the parameters off the stable manifold, and negative curvature then amplifies the escape direction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A strict saddle is a critical point where the Hessian has at least one negative eigenvalue. Around that point, the loss is well approximated by a quadratic. Positive-curvature directions pull the iterate toward the saddle, and negative-curvature directions push it away once the coordinate is nonzero.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/HyperbolicParaboloid.svg/250px-HyperbolicParaboloid.svg.png', alt: 'Colorful hyperbolic paraboloid saddle surface', caption: 'The hyperbolic paraboloid makes the Hessian sign split visible: one axis curves upward while the other curves downward. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:HyperbolicParaboloid.svg.'},
        'SGD repeats two actions: add a noisy gradient step and let curvature transform the result. If the noise puts epsilon into the escape coordinate, repeated multiplication grows it until the path leaves the saddle neighborhood. The plateau length depends on the noise size, learning rate, and the magnitude of the negative eigenvalue.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is local geometry. Near a strict saddle, the stable set that never escapes has lower dimension than the full parameter space. Random perturbation almost surely moves the iterate off that set, because hitting the exact zero escape coordinate has probability zero under continuous noise.',
        'Once off the stable set, negative curvature gives monotone growth in the escape coordinate until the local quadratic approximation no longer applies. Perturbed gradient descent results formalize this for strict saddles: with appropriate perturbations, the method escapes in polynomial time rather than accepting a zero-gradient saddle as a solution.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'SGD escape uses work the optimizer is already doing. A step costs O(batch_size * d) for d parameters, and the noise comes from minibatch sampling. Smaller batches increase noise and can escape faster, but they also increase variance near a good solution.',
        'Second-order saddle fixes require curvature information. Exact Hessians cost O(d^2) memory and can require O(d^3) factorization, which is not practical for large neural networks. Hessian-vector products and adaptive optimizers approximate pieces of this behavior at lower cost, but they do not remove the exploration-versus-precision tradeoff.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Saddle escape explains flatline-then-drop training curves. A loss curve can stay almost unchanged while a hidden escape coordinate grows below visible scale, then fall quickly once the path leaves the saddle. This helps diagnose plateaus without treating every stall as convergence.',
        'It also explains why noisy first-order methods work well in deep learning. Momentum can carry motion through a flat region, and Adam or RMSProp can amplify small coordinates through adaptive scaling. The common theme is not magic optimizer branding; it is putting mass on directions that exact gradient descent might never activate.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The clean theory assumes strict negative curvature. If the Hessian eigenvalue is nearly zero, the multiplier is barely above one and escape may take too long to matter. Real loss landscapes also contain flat regions that are not well described by one clean quadratic saddle.',
        'Noise is useful early but costly late. The same variance that helps escape saddles can prevent precise convergence inside a good basin. Learning-rate decay and batch-size schedules exist because the optimizer needs exploration first and precision later.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use f(w1, w2) = 0.5 * (w1^2 - 0.2 * w2^2) with learning rate 0.15. The w2 update near the saddle is w2 <- w2 * (1 + 0.15 * 0.2) + noise, so the multiplier is 1.03. If exact gradient descent starts with w2 = 0 and no noise, w2 remains 0 forever.',
        'Now add a tiny noise kick of 0.02 into w2. After 100 steps, the amplified component is about 0.02 * 1.03^100, which is roughly 0.38 before later noise terms are counted. After 200 steps it is about 7.4, large enough to leave the local saddle region. The plateau is the period when this compounding is real but not yet visible in the loss curve.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Dauphin et al., Identifying and attacking the saddle point problem in high-dimensional non-convex optimization, 2014; Jin et al., How to escape saddle points efficiently, 2017. Study Hessian eigenvalues and gradient descent before reading the proofs.',
        'Next, study momentum, Adam, stochastic gradient noise, loss landscapes, and random matrix intuition for high-dimensional critical points. The transfer lesson is that a small gradient is a measurement, not a certificate of a good minimum.',
      ],
    },
  ],
};