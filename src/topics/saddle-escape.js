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
// training plateaus. Contours are hyperbolas, like every saddle's.
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

// Newton's step from anywhere lands ON the saddle: H⁻¹∇f(w) = w for this
// quadratic, so w − H⁻¹∇f = 0 — the saddle is Newton's fixed point.
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
    explanation: 'The counting argument that reshaped how we think about deep learning. At a critical point (gradient = 0), each of the Hessian\'s d eigenvalues is positive or negative — see The Hessian: Curvature & Newton\'s Step for why signs are the whole local story. A minimum needs ALL d positive. If signs were fair coins, that\'s 2⁻ᵈ — and the table shows what that does as d grows. The refined story (Dauphin et al. 2014, drawing on random matrix theory) keeps the conclusion but adds the crucial twist: the coin is biased by HEIGHT. High up the landscape, negative directions abound; only near the floor do critical points become true minima. So the obstacle course of training isn\'t bad minima — it\'s an endless field of saddles.',
    invariant: 'P(all d eigenvalues positive) collapses exponentially in d: generic high-dimensional critical points are saddles.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [...CONTOURS, { id: 'gd', label: 'exact gradient descent — parked', points: GD }],
    }),
    highlight: { removed: ['gd'] },
    explanation: `Here is the failure, live. The surface is f = ½(w₁² − 0.2w₂²): a saddle with one climbing direction (λ = 1) and one gently descending escape route (λ = −0.2, downhill along ±w₂ forever). Exact gradient descent starts at (2.4, 0) — note w₂ = 0, no component along the escape direction — and the update can never create one: the w₂ gradient is proportional to w₂ itself, and 0.2 × 0 is 0. The path slides straight into the saddle and STOPS, gradient norm ${GD_GRADNORM.toExponential(1)} after 40 steps. Every convergence test based on "gradient is small" certifies this as success. The optimizer didn't get trapped by a wall; it got parked by a symmetry.`,
    invariant: 'Exact GD preserves zero components along eigendirections: start on the saddle\'s stable manifold and you stay on it.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [...CONTOURS, { id: 'newton', label: "Newton's step — lands ON the saddle", points: NEWTON }],
    }),
    highlight: { removed: ['newton'] },
    explanation: 'It gets worse before it gets better: Newton\'s method — the curvature-aware hero of The Hessian: Curvature & Newton\'s Step — is actively ATTRACTED to saddles. Newton solves ∇f = 0, and a saddle satisfies that equation just as well as a minimum does; on this quadratic, one Newton step from anywhere lands exactly on the saddle (drawn live: one stride from (2.0, 2.2) to the origin). H⁻¹ divides each direction by its eigenvalue, and dividing by a NEGATIVE eigenvalue flips the descent direction into ascent along that axis. The saddle-free Newton fix (Dauphin et al.): divide by |λ| instead — keep curvature\'s magnitude, never its sign. Pure second-order methods need this surgery before they\'re safe in saddle country.',
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
    explanation: 'The compounding gives escape time a clean form: noise of size ε must grow to distance R, multiplying by (1 + lr·|λneg|) per step, so escape takes roughly log(R/ε) / (lr·|λneg|) steps. Read the table: the SHALLOWER the negative curvature, the LONGER the stall — and that is the anatomy of a training plateau. The loss curve that flatlines for an epoch and then drops sharply wasn\'t "slowly improving"; it was orbiting a gentle saddle while w₂ compounded below the noise floor, then fell off the edge. Theory backs the picture: perturbed gradient descent provably escapes all strict saddles in polynomial time (Jin et al. 2017), where exact GD can take exponential time or, as the previous view showed, never leave at all.',
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
    explanation: 'The toolbox, cheapest first. Minibatch noise needs no code at all — and it isn\'t even isotropic: SGD\'s noise is structured by the data, with more variance along directions where gradients disagree, which tends to align kicks with the very directions that matter (one reason plain SGD generalizes stubbornly well; see Gradient Descent for the baseline mechanics). Momentum, RMSProp & Adam helps differently: velocity accumulated before the plateau coasts THROUGH the flat region rather than re-deriving motion from a vanishing gradient. The lesson that ties the page together: in high dimensions, optimization difficulty is mostly saddle topology — and stochasticity, the thing that looks like sloppiness, is a load-bearing part of why deep learning trains at all.',
    invariant: 'Every practical escape mechanism is the same move: put mass on the negative-curvature direction and let it compound.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'a world made of saddles') yield* saddleWorld();
  else if (view === 'noise is the feature') yield* noiseFeature();
  else throw new InputError('Pick a view.');
}

const saddleEscapeArticleSections = [
  {
    heading: `Why This Exists`,
    paragraphs: [
      `Deep-learning optimization is not hard only because the loss surface has many bad minima. In a high-dimensional model, a point where the gradient is zero is usually not a bowl. It is usually a saddle: uphill in some directions, downhill in others, and flat enough near the center that a first-order optimizer can look finished. A minimum needs every Hessian eigenvalue to be positive. If those signs were even roughly balanced, the chance of all positive signs would shrink like 2 to the minus d. The visual starts with that counting pressure because it changes the story. Training plateaus are often not walls around bad minima. They are neighborhoods where the gradient is tiny while a descent direction exists but has not been activated.`,
    ],
  },
  {
    heading: `The Obvious Approach`,
    paragraphs: [
      `The reasonable first attempt is exact gradient descent. Compute the gradient of the whole loss, step downhill, and stop when the gradient norm becomes small. That rule is correct on a convex bowl because the only zero-gradient point is the minimum. It is also attractive in engineering terms: full-batch gradients are deterministic, easy to debug, and make convergence tests look clean. A second reasonable attempt is Newton's method. If the gradient is small because the surface is curved, use curvature to jump to the critical point faster. Both approaches are natural if the mental model is a bowl. Both become dangerous when the surface contains many directions with mixed curvature.`,
    ],
  },
  {
    heading: `The Wall`,
    paragraphs: [
      `The wall is that a small gradient is not a certificate of a useful minimum. At a saddle, the gradient can be exactly zero even though there is a downhill direction. The local quadratic picture is controlled by Hessian eigenvectors. Positive eigenvalues pull the iterate toward the critical point along stable directions. Negative eigenvalues push away along escape directions. If the current point has no component along a negative-curvature eigenvector, exact gradient descent may never create one. It can preserve the symmetry that keeps the escape coordinate at zero. The optimizer did not fail because it could not find a downhill route. It failed because its deterministic update stayed on the saddle's stable manifold.`,
    ],
  },
  {
    heading: `Core Insight`,
    paragraphs: [
      `The core insight is that negative curvature is both the problem and the exit. Near a strict saddle, any nonzero displacement in a negative-curvature direction grows under gradient descent instead of shrinking. Stochastic gradient descent supplies that displacement for free because each minibatch gives a slightly different gradient estimate. The noise is not just dirt on a clean deterministic process. It is the seed that lets negative curvature amplify an escape coordinate. Once a tiny component exists, the saddle multiplies it step after step until the path visibly leaves the plateau. In this setting, randomness is not a decoration around optimization. It is part of the mechanism that makes high-dimensional training move.`,
    ],
  },
  {
    heading: `How It Works`,
    paragraphs: [
      `The plotted surface is deliberately small: f(w1, w2) = 1/2(w1^2 - 0.2w2^2). Along w1, curvature is positive, so gradient descent contracts the coordinate toward zero. Along w2, curvature is negative, so any nonzero coordinate is pushed away from zero and down the loss surface. Exact gradient descent starts at (2.4, 0). The w2 gradient is proportional to w2, so the update keeps w2 at zero forever. The path slides into the origin and satisfies a gradient-norm stop test even though the vertical direction descends. Newton's method shows a different failure. It solves for a zero gradient, and this saddle is a zero-gradient point. On this quadratic, a Newton step lands directly on the origin because the Hessian inverse cancels the gradient rather than asking whether the critical point is a minimum.`,
    ],
  },
  {
    heading: `What The Visual Proves`,
    paragraphs: [
      `The first table proves the dimensionality problem. As the parameter count rises, the chance that every local curvature direction points upward collapses. The contour plot then proves the deterministic failure: exact gradient descent can approach a saddle and stop because the escape coordinate never appears. The SGD path proves the opposite behavior with the same surface, start, and learning rate. A tiny random kick places a small amount of mass on w2. Negative curvature then compounds that mass until the path peels away. The escape-time table explains why a plateau can last long enough to look like convergence. If the negative eigenvalue is shallow, the multiplier is only slightly larger than one, so the hidden coordinate needs many steps before it becomes visible in the loss curve.`,
    ],
  },
  {
    heading: `Why It Works`,
    paragraphs: [
      `The correctness argument is local. Around a strict saddle, the Taylor approximation is a quadratic whose Hessian has at least one negative eigenvalue. In a positive-curvature direction, gradient descent subtracts a vector that points away from the coordinate's sign, so the coordinate shrinks. In a negative-curvature direction, the sign flips: subtracting the gradient pushes the coordinate farther from zero. Exact gradient descent can miss this route only on a special stable set where the negative-curvature component is exactly absent. Random perturbations almost surely leave that set. Once they do, repeated multiplication by a factor above one makes escape inevitable unless the learning rate is too small, too large, or the local quadratic model stops applying before the iterate reaches a descending route.`,
    ],
  },
  {
    heading: `Cost And Tradeoffs`,
    paragraphs: [
      `Saddle escape is cheap when it comes from ordinary minibatch noise, but it is not free in every sense. More noise can help exploration and escape, yet too much noise raises gradient variance and can slow convergence near a good basin. A larger learning rate amplifies escape coordinates faster, but it can overshoot sharp valleys or destabilize training. Momentum helps because velocity built before the plateau can carry the iterate across a stable manifold, but momentum can also make bad hyperparameters more violent. Explicit perturbed-gradient methods add a detection rule: when the gradient norm is small, inject noise and test whether the loss drops. That gives cleaner theory, but production training usually relies on SGD, batch size, learning-rate schedules, and adaptive optimizers instead of explicit saddle detectors.`,
    ],
  },
  {
    heading: `Where It Wins`,
    paragraphs: [
      `This idea is useful whenever a training curve stalls and then drops. The stall may be a shallow saddle, not proof that the model has learned all it can. It also explains why full-batch deterministic training can be less practical than noisy minibatch training even when the full gradient is more accurate. In research, explicit saddle examples are good tests for optimizers: an optimizer that only reduces gradient norm can look successful while landing on a bad critical point. In practice, saddle geometry informs choices about batch size, momentum, warmup, learning-rate decay, and second-order methods. It gives a concrete reason to treat stochasticity as a resource to tune, not only an error source to remove.`,
    ],
  },
  {
    heading: `Where It Fails`,
    paragraphs: [
      `Saddle escape is not a complete theory of neural-network training. Some plateaus come from bad scaling, saturated activations, data issues, optimizer bugs, or learning rates that are already too low. Some critical regions are non-strict saddles with very flat directions rather than clean negative eigenvalues, so the simple exponential escape story weakens. Noise can also damage late-stage convergence, especially when the model is near a narrow optimum or when the objective is already dominated by sampling error. Newton-style fixes are expensive because reliable curvature information is hard to compute at modern model sizes. The lesson is not "add random noise forever." The lesson is to read small gradients together with curvature, stochasticity, and loss movement.`,
    ],
  },
  {
    heading: `Study Next`,
    paragraphs: [
      `Study Gradient Descent first if the update rule still feels mechanical. Then read The Hessian: Curvature & Newton's Step to connect eigenvalues with local shape and to see why Newton can mistake a saddle for success. Loss Landscapes & Optimization Geometry gives the larger map: basins, barriers, sharpness, and why two-dimensional plots can both help and mislead. Momentum, RMSProp & Adam explains the practical escape tools used in real training loops. Perturbed gradient descent is the theory path: it formalizes the idea that small random kicks let first-order methods escape strict saddles in polynomial time. Contour-map topics are useful too, because they train the eye to separate a true basin from a saddle plateau.`,
    ],
  },
];

export const article = {
  sections: saddleEscapeArticleSections,
};
