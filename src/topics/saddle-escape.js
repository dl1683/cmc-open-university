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
        'The contour plot shows the loss surface f = 1/2(w1^2 - 0.2*w2^2). Hyperbolas curving left-right are positive-loss contours (the bowl direction along w1). Hyperbolas curving up-down are negative-loss contours (the escape direction along w2). The origin is the saddle point where both gradients vanish.',
        {type: 'callout', text: 'A saddle is dangerous because zero gradient can coexist with a downhill direction that the optimizer has not activated yet.'},
        'In the "a world made of saddles" view, the table shows why high-dimensional critical points are almost never minima. The contour plot shows exact gradient descent parking at the saddle, then Newton jumping directly onto it. In the "noise is the feature" view, the SGD path is overlaid on the same contours alongside the parked GD path. Watch for the long hesitation near the origin followed by the sudden peel-off -- that is exponential compounding becoming visible.',
        'Active markers (the moving dot) show the current optimizer position. The trail behind it shows the full path history. When the trail stops moving, the optimizer is stuck -- either parked at the saddle or escaped to a region of lower loss.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The prevalence of saddle points, not local minima, provides a much more daunting challenge to optimization in high-dimensional spaces.',
          attribution: 'Yann Dauphin, Razvan Pascanu, Caglar Gulcehre, Kyunghyun Cho, Surya Ganguli, Yoshua Bengio -- "Identifying and attacking the saddle point problem in high-dimensional non-convex optimization" (2014)',
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Saddle_point.svg/330px-Saddle_point.svg.png', alt: 'Saddle point on a hyperbolic paraboloid surface with one red critical point', caption: 'The saddle point has zero local slope at the red point, but the surface bends up in one direction and down in another. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Saddle_point.svg.'},
        'For decades the default story about neural-network training was "beware bad local minima." Dauphin et al. (2014) overturned that story with a counting argument grounded in random matrix theory. At a critical point where the gradient is zero, the Hessian has d eigenvalues, one per parameter direction. A true minimum needs all d to be positive. If signs were fair coins, the probability is 2^(-d). For a small neural network with d = 10^6 parameters that is 2^(-1,000,000) -- effectively zero. The refined version, drawing on results from the Gaussian Orthogonal Ensemble (GOE) in random matrix theory, shows that eigenvalue signs are not independent coins but are correlated with the loss value: high up the landscape, negative eigenvalues dominate; only near the floor do critical points become genuine minima.',
        'The practical consequence is that training plateaus -- epochs where the loss flatlines before suddenly dropping -- are usually not evidence of a wall around a bad minimum. They are neighborhoods of a saddle point where the gradient is tiny, a descent direction exists along the negative-curvature eigenvector, but that direction has not yet been activated by the optimizer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is full-batch gradient descent. Compute the gradient of the entire loss, step proportional to the negative gradient, stop when the gradient norm is small. On a convex loss surface this works perfectly: the only zero-gradient point is the global minimum, so "gradient is small" is a reliable certificate. Full-batch gradients are deterministic, reproducible, and easy to debug.',
        `The natural second attempt is Newton method. If the gradient is small because curvature is steep, use the Hessian to jump directly to the critical point. Newton converges quadratically on well-behaved problems and uses curvature information that first-order methods ignore.`,
        'Both approaches implicitly assume the loss surface is a bowl. Both become dangerous when the surface is a saddle.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A small gradient is not proof of a useful minimum. At a saddle point the gradient is exactly zero even though a descent direction exists. The Hessian eigenvectors partition local space into directions of positive curvature (uphill from the saddle) and negative curvature (downhill forever). If the optimizer starts with zero component along a negative-curvature eigenvector, exact gradient descent will never create one: the gradient update in that direction is proportional to the current coordinate, and the product of any learning rate with zero is still zero.',
        {
          type: 'diagram',
          text: '                    w1 (positive curvature, lambda = +1)\n                     ^\n                     |   loss INCREASES\n                     |   along this axis\n           ----------+---------->\n          loss       |          loss\n          DECREASES  * saddle   DECREASES\n          along w2   |          along w2\n                     |\n                     v\n                    w2 (negative curvature, lambda = -0.2)',
          label: 'Saddle point geometry: the Hessian has eigenvalue +1 along w1 (stable, attracts) and -0.2 along w2 (unstable, repels). Gradient descent approaching along the w1 axis never discovers the w2 escape.',
        },
        `Newton method is worse. Newton solves for any zero of the gradient, and a saddle satisfies that equation exactly. On the quadratic f = 1/2(w1^2 - 0.2*w2^2), one Newton step from any starting point lands on the saddle at the origin. The Hessian inverse divides each component by its eigenvalue; dividing by a negative eigenvalue flips the step direction, turning descent into ascent along the escape axis. The saddle is the Newton fixed point.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The escape mechanism has three ingredients: a strict saddle (at least one negative Hessian eigenvalue), a source of noise, and time for compounding.',
        'A strict saddle is a critical point where the Hessian has at least one strictly negative eigenvalue. The "strict" matters: it guarantees exponential amplification rather than mere drift. At such a point, any nonzero displacement along the negative-curvature eigenvector grows geometrically under gradient descent. Concretely, the w2 coordinate updates as w2 <- w2 * (1 + lr * |lambda_neg|) + noise. Each step multiplies the escape coordinate by a factor greater than one and adds a fresh noise term.',
        'Minibatch SGD supplies the noise for free. Each minibatch computes the gradient on a random subset of the data, producing a slightly different gradient estimate than the full loss. The error is not isotropic: SGD noise is structured by the data, with higher variance along directions where per-sample gradients disagree. This structured noise tends to deposit mass precisely on the directions that matter for escape.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/HyperbolicParaboloid.svg/250px-HyperbolicParaboloid.svg.png', alt: 'Colorful hyperbolic paraboloid saddle surface', caption: 'The hyperbolic paraboloid makes the Hessian sign split visible: one axis curves upward while the other curves downward. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:HyperbolicParaboloid.svg.'},
        'The escape timeline has a characteristic shape: invisible compounding for many steps (the plateau), then a sudden visible departure (the drop). Escape time scales as log(R/epsilon) / (lr * |lambda_neg|), where epsilon is the noise amplitude and R is the distance at which the quadratic approximation gives way to the broader landscape. The shallower the negative eigenvalue, the longer the plateau -- and this is exactly the anatomy of the flatline-then-drop pattern seen in real training curves.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on the strict saddle property. Near a strict saddle, the loss function is locally quadratic with at least one negative Hessian eigenvalue. In any positive-curvature direction, gradient descent contracts the coordinate toward the saddle -- these are stable directions. In any negative-curvature direction, gradient descent does the opposite: it amplifies the coordinate away from the saddle, because subtracting a negative gradient component pushes the iterate further from zero.',
        `Exact gradient descent can miss the escape route only if the iterate lives exactly on the saddle stable manifold -- the subspace spanned by positive-curvature eigenvectors, where the negative-curvature components are precisely zero. This stable manifold has measure zero in the full parameter space. Any random perturbation almost surely displaces the iterate off this set. Once displaced, repeated multiplication by (1 + lr * |lambda_neg|) > 1 makes escape inevitable.`,
        'Jin et al. (2017) formalized this: perturbed gradient descent -- which adds a small random perturbation whenever the gradient norm drops below a threshold -- escapes all strict saddles in polynomial time, whereas deterministic gradient descent can require exponential time or may never escape at all. The key insight from random matrix theory (Bray and Dean, 2007) is that high-dimensional random functions have a specific eigenvalue structure at critical points: the fraction of negative eigenvalues increases with the loss value. Near the global minimum, critical points tend to have all-positive eigenvalues (true minima). High up the landscape, most eigenvalues are negative (high-index saddles). This means the optimizer encounters an obstacle course of saddles on the way down, but the saddles near the bottom -- the dangerous ones -- are also the easiest to escape because they have few negative directions and those directions tend to be steep.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'SGD with minibatches: batch noise deposits mass on escape directions. Escape speed depends on noise amplitude and |lambda_neg|. Per step, it costs O(batch_size * d), and the escape mechanism is already present in ordinary training.',
            'SGD plus momentum: velocity from before the plateau can carry the iterate across the stable manifold. The extra cost is O(d) for the velocity buffer, and the risk is overshooting narrow basins.',
            'Adam and RMSProp: per-coordinate scaling amplifies small gradients in flat directions. The extra cost is O(d) moment buffers, and the adaptive denominator acts like a cheap curvature proxy.',
            'Saddle-free Newton: divide by |lambda| instead of lambda so negative curvature does not flip the step uphill. It is clean in theory, but exact Hessian work costs O(d^2) to O(d^3), so modern systems need approximations.',
          ],
        },
        'Escape via minibatch noise is free in compute -- you are already paying for SGD. The cost is indirect: more noise helps escape but raises gradient variance, which slows convergence near a good basin. Larger batch sizes reduce noise and slow escape but give more stable convergence. This is one reason practitioners use learning-rate warmup (small lr at the start lets the optimizer settle, then larger lr amplifies escape) and batch-size schedules (small batches early for exploration, large batches late for precision).',
        'Perturbed gradient descent (Jin et al.) adds explicit detection: when ||gradient|| < epsilon, inject a random perturbation of radius r and run for a fixed number of steps. If the loss does not drop, the point is an approximate local minimum. The theoretical escape time is polynomial in d, 1/epsilon, and 1/|lambda_neg|. In practice, nobody runs the explicit perturbation protocol -- the inherent noise of minibatch training handles it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Saddle escape theory explains the flatline-then-drop signature of training curves. When loss stalls for an epoch and then suddenly drops, the optimizer was likely orbiting a shallow saddle while the escape coordinate compounded below the noise floor. Recognizing this pattern prevents premature early stopping.',
        'It explains why small-batch SGD often generalizes better than full-batch training. The noise is not just an approximation error -- it is the mechanism that finds descent directions a deterministic optimizer would miss. It explains why full-batch training with the same total gradient computation can converge to worse solutions: less noise means slower escape from saddles that sit above better basins.',
        `In optimizer design, saddle geometry motivates adaptive methods. Adam per-coordinate second-moment scaling effectively estimates local curvature: coordinates with consistently small gradients (flat directions near a saddle) get amplified learning rates. This is implicit saddle detection. It motivates momentum: velocity accumulated in the descent phase before a plateau carries the iterate through the flat region rather than requiring the optimizer to rebuild motion from a vanishing gradient.`,
        'In research, explicit saddle surfaces are useful test problems for new optimizers. An optimizer that only minimizes gradient norm can certify a saddle as a success. Testing on known saddle landscapes reveals whether the optimizer has a real escape mechanism or just an early stopping criterion.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The strict saddle theory requires at least one eigenvalue to be bounded away from zero in the negative direction. Non-strict saddles -- critical points where the Hessian has eigenvalues very close to zero but not clearly negative -- break the exponential escape story. The multiplier (1 + lr * |lambda_neg|) is barely above one, so escape takes an impractical number of steps. Real loss landscapes have regions of near-zero curvature that are neither clean saddles nor clean minima.',
        'Noise helps escape but hurts convergence. Near a narrow optimum late in training, the same minibatch noise that escaped saddles earlier now bounces the iterate around the basin floor. This is why learning-rate decay works: reducing lr shrinks both the step size and the effective noise, trading exploration for precision. The saddle story does not tell you when to stop exploring.',
        'The theory is local. It describes behavior in a neighborhood where the quadratic Taylor approximation holds. Real loss surfaces are not quadratic, and the basin structure far from the saddle determines where the escaping iterate actually lands. Escaping a saddle is necessary but not sufficient -- the optimizer still needs to find a good basin, and nothing in the saddle escape mechanism guarantees that.',
        'Second-order fixes (saddle-free Newton, cubic regularization) are theoretically clean but computationally impractical at modern scale. Computing or approximating the Hessian for a model with millions or billions of parameters costs O(d^2) memory or requires careful Hessian-vector product tricks. In practice, the field has settled on first-order methods with implicit curvature estimation (Adam, LAMB, Shampoo) rather than explicit Hessian computation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Dauphin, Pascanu, Gulcehre, Cho, Ganguli, Bengio. "Identifying and attacking the saddle point problem in high-dimensional non-convex optimization." NeurIPS 2014. The paper that reframed deep learning optimization from "bad local minima" to "proliferating saddle points." Introduced saddle-free Newton.',
            'Bray and Dean. "Statistics of critical points of Gaussian random fields on large-dimensional spaces." Physical Review Letters, 2007. The random matrix theory result connecting critical point index to loss value.',
            'Jin, Ge, Netrapalli, Kakade, Jordan. "How to escape saddle points efficiently." ICML 2017. Proved that perturbed gradient descent escapes all strict saddles in polynomial time.',
            'Ge, Huang, Jin, Yuan. "Escaping from saddle points -- online stochastic gradient for tensor decomposition." COLT 2015. Early formal result on SGD escaping saddle points.',
            'Li, Tai, E. "Stochastic modified equations and adaptive stochastic gradient algorithms." ICML 2017. Connects SGD noise structure to the modified loss landscape the optimizer implicitly follows.',
          ],
        },
        `Study Gradient Descent first if the update rule w <- w - lr * gradient still feels mechanical. Then study The Hessian: Curvature & Newton Step to understand eigenvalues, local quadratic shape, and why Newton is attracted to saddles. Loss Landscapes & Optimization Geometry gives the larger map: basins, barriers, sharpness measures, and why 2D contour plots are both useful and misleading.`,
        'For the practical escape toolbox, study Momentum, RMSProp & Adam -- those topics explain the velocity and adaptive-scaling mechanisms that make real training work. For the mathematical underpinning, random matrix theory (Wigner semicircle law, GOE eigenvalue distribution) explains why eigenvalue sign statistics follow the pattern Dauphin et al. observed.',
      ],
    },
  ],
};
