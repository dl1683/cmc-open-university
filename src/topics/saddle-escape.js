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

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A saddle point is a critical point (where the gradient is zero) that looks like a minimum from some directions and a maximum from others — like a horse saddle curving up at front and back, down on the sides. In high dimensions, saddles are everywhere. The counting argument is brutal: a random critical point with d parameters has probability 2⁻ᵈ of being a true minimum (all d eigenvalues of the Hessian positive). At d = 10⁶ (a small neural net), that is 1 in 2^1,000,000 — so a minimum is not the obstacle. The real training difficulty is the endless field of saddles, and the weird news is that minibatch noise — the imprecision everyone tries to tune away — is the mechanism that breaks free.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization shows a concrete example: the surface f = ½(w₁² − 0.2w₂²), a shallow saddle with one climbing direction (eigenvalue 1) and one gentle escape route (eigenvalue −0.2). Exact gradient descent starting at (2.4, 0) has no component along the escape direction (w₂ = 0), and the w₂ gradient is proportional to w₂ itself, so zero stays zero — GD is parked forever, even though the escape route exists and descends. Newton's method is worse: it is attracted to saddles. One Newton step from anywhere lands exactly on this saddle (H⁻¹ divides by eigenvalues, and dividing by a negative eigenvalue flips the descent direction into ascent). But add tiny minibatch noise (amplitude 0.02) and the same start escapes in 165 steps. Why? The negative curvature pays compound interest: each step multiplies the w₂ component by (1 + lr·0.2) and adds noise. Invisible exponential growth, then suddenly the path peels away. The escape time formula ≈ log(R/ε) / (lr·|λneg|) shows why: the shallower the negative curvature (smaller |λneg|), the longer the plateau — and that flatline-then-drop pattern is the signature of training curves in practice.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Finding and escaping a saddle during training is cheap: the noise comes free (every minibatch is a different surface; the gradient never exactly vanishes at the full-loss saddle). Detecting that you are in a saddle is harder — a vanishing gradient looks identical to convergence. In practice, practitioners rely on intuition (loss plateaus for epochs, then drops) or perturbed gradient descent (Jin et al. 2017): if the gradient norm is small, inject a random kick and restart the compounding clock. Provably escapes all strict saddles in polynomial time, but in practice, minibatch noise and momentum do the job automatically. Theory backs the observation: the noise in SGD is not isotropic — it is structured by the data, with more variance along directions where gradients disagree, which tends to align kicks with the very directions that matter for escape.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Understanding saddles reshapes how you read optimization. A training curve with a long flatline (thousands of steps with no loss improvement) is not convergence — it is a shallow saddle. The sudden drop is the escape. "Loss Landscapes & Optimization Geometry" develops this intuition further. When a loss plateau hits, momentum, RMSProp & Adam help: velocity built before the plateau carries the iterate across the stable manifold (the set of directions where the gradient is zero). Saddle-free Newton (divide by |λ| instead of λ) also works, but it is rarely deployed because SGD is cheaper and already escapes. Researchers working on second-order methods or noisy optimization often verify their algorithms on explicit saddle-point problems to confirm they have real escape mechanisms, not just stumbling by luck.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception: "Saddles trap training because they are minima." No. Saddles are not minima — they have negative curvature, which is a descent route. They trap exact gradient descent because of alignment: if you start with zero component on the escape direction, that zero is preserved. This is a geometry problem, not a curvature problem. A second trap: confusing "small gradient" with "stuck." A saddle has zero gradient, but so does a minimum. The difference is in the Hessian — see "The Hessian: Curvature & Newton's Step" for how negative eigenvalues reveal escape routes. Newton's method escaping saddles is counter-intuitive until you remember: Newton solves ∇f = 0, not "go downhill," so it treats saddles and minima the same. The fix (dividing by |λ|) is a hack that makes Newton descent-seeking again.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with "The Hessian: Curvature & Newton's Step" to understand eigenvalues, eigenvectors, and why negative curvature spells escape. Then read "Loss Landscapes & Optimization Geometry" to see how saddle topology shapes training. "Gradient Descent" covers the mechanics that keep exact GD parked; "Momentum, RMSProp & Adam" shows the tools that escape. Finally, "Loss Landscapes from Above: Contour Maps" teaches you to decode real 2D slices of neural-network loss landscapes and spot saddles and escape routes on paper.`,
      ],
    },
  ],
};

