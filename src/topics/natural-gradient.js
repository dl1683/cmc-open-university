// Natural gradient: gradient descent measures step size with a ruler laid
// on the PARAMETERS, but what we actually move is a DISTRIBUTION. The Fisher
// information matrix is the right ruler — and F⁻Â¹âˆ‡ is descent that uses it.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'natural-gradient',
  title: 'Natural Gradient & Fisher Information',
  category: 'Concepts',
  summary: 'Why the same parameter step can be a huge or tiny change in distribution space — and the F⁻Â¹âˆ‡ correction that makes optimization coordinate-free.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['distance lies in parameter space', 'the natural gradient'], defaultValue: 'distance lies in parameter space' },
  ],
  run,
};

// The running example: fit a Gaussian N(μ, Ïƒ²) to a target N(2, 0.5²) by
// minimizing the expected negative log-likelihood (= KL + constant):
// L(μ, Ïƒ) = log Ïƒ + (Ïƒ*² + (μ âˆ’ μ*)²) / (2Ïƒ²).
const MU = 2;
const SIG = 0.5;
const L = (m, s) => Math.log(s) + (SIG * SIG + (m - MU) ** 2) / (2 * s * s);
const dMu = (m, s) => (m - MU) / (s * s);
const dSig = (m, s) => 1 / s - (SIG * SIG + (m - MU) ** 2) / (s ** 3);
const L_MIN = L(MU, SIG);

// For a Gaussian, the Fisher information matrix is exactly diag(1/Ïƒ², 2/Ïƒ²):
// the natural gradient F⁻Â¹âˆ‡ multiplies âˆ‚μ by Ïƒ² and âˆ‚Ïƒ by Ïƒ²/2.
function descend(kind, m, s, lr, cap) {
  const path = [{ x: m, y: s }];
  while (L(m, s) - L_MIN > 1e-3 && path.length <= cap) {
    let gm = dMu(m, s);
    let gs = dSig(m, s);
    if (kind === 'natural') { gm *= s * s; gs *= (s * s) / 2; }
    if (kind === 'logsigma') gs *= s * s; // GD in (μ, log Ïƒ), mapped back: chain rule twice
    m -= lr * gm;
    s = Math.max(0.01, s - lr * gs);
    path.push({ x: m, y: s });
  }
  return path;
}
const GD_FAR = descend('plain', 0, 3, 0.2, 400);
const LOG_FAR = descend('logsigma', 0, 3, 0.2, 400);
const NAT_FAR = descend('natural', 0, 3, 0.2, 400);
const GD_SHARP = descend('plain', 2.5, 0.12, 0.2, 400);
const NAT_SHARP = descend('natural', 2.5, 0.12, 0.2, 400);
const steps = (p) => p.length - 1;
const GD_STUCK = L(GD_SHARP.at(-1).x, GD_SHARP.at(-1).y) - L_MIN > 0.01;

// Exact NLL contours: at level c, (μ âˆ’ 2)² = 2Ïƒ²(c âˆ’ log Ïƒ) âˆ’ Ïƒ*², solved
// per Ïƒ — closed curves around the optimum, like a contour map should be.
function lossRing(c, id) {
  const right = [];
  for (let s = 0.05; s <= 3.45; s += 0.01) {
    const r2 = 2 * s * s * (c - Math.log(s)) - SIG * SIG;
    if (r2 >= 0) right.push({ s, d: Math.sqrt(r2) });
  }
  const upper = right.map(({ s, d }) => ({ x: MU + d, y: s }));
  const lower = [...right].reverse().map(({ s, d }) => ({ x: MU - d, y: s }));
  return { id, label: id === 'c0' ? 'equal-loss rings' : '', points: [...upper, ...lower, upper[0]] };
}
const RINGS = [0.1, 0.45, 1.0, 1.8].map((c, i) => lossRing(c, `c${i}`));
const AXES = { x: { label: 'μ', min: -1.2, max: 5.2 }, y: { label: 'Ïƒ', min: 0, max: 3.5 } };

// A ball of FIXED KL radius, drawn in parameter space: for small steps,
// KL(N(μ+δμ, Ïƒ+δÏƒ) ‖ N(μ, Ïƒ)) â‰ˆ (δμ² + 2δÏƒ²) / (2Ïƒ²) — so the ball has
// radius Ïƒâˆš(2c) in μ and Ïƒâˆšc in Ïƒ. It scales with WHERE you stand.
function klBall(m0, s0, c, id, label) {
  const points = [];
  for (let t = 0; t <= 48; t++) {
    const th = (t / 48) * 2 * Math.PI;
    points.push({ x: m0 + s0 * Math.sqrt(2 * c) * Math.cos(th), y: s0 + s0 * Math.sqrt(c) * Math.sin(th) });
  }
  return { id, label, points };
}

function* distanceLies() {
  yield {
    state: plotState({
      axes: { x: { label: 'μ', min: -3.2, max: 3.2 }, y: { label: 'Ïƒ', min: 0, max: 3.4 } },
      series: [
        klBall(0, 2.4, 0.08, 'big', 'KL = 0.08 at Ïƒ = 2.4'),
        klBall(0, 1.2, 0.08, 'mid', ''),
        klBall(0, 0.5, 0.08, 'small', 'KL = 0.08 at Ïƒ = 0.5'),
      ],
    }),
    highlight: { compare: ['big', 'small'] },
    explanation: 'Three rings, one meaning: every point on a ring is a Gaussian exactly KL = 0.08 away from the Gaussian at its center. The rings are wildly different SIZES in parameter space — the one at Ïƒ = 2.4 is nearly 5Ã— wider than the one at Ïƒ = 0.5 (radius scales with Ïƒ, drawn live from the small-step KL formula). Read it as a warning: a parameter step of 0.3 down at Ïƒ = 0.5 tears the distribution apart, while the same 0.3 up at Ïƒ = 2.4 barely moves it. Euclidean distance on parameters is a LIE about how much the model changed — and gradient descent\'s "small step" is defined in exactly that lying ruler.',
    invariant: 'Locally KL â‰ˆ Â½ δáµ€Fδ: the same parameter displacement means more distribution change wherever Fisher information is large.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [...RINGS,
        { id: 'gd', label: `GD on (μ, Ïƒ) — ${steps(GD_FAR)} steps`, points: GD_FAR },
        { id: 'log', label: `GD on (μ, log Ïƒ) — ${steps(LOG_FAR)} steps`, points: LOG_FAR }],
    }),
    highlight: { compare: ['gd', 'log'] },
    explanation: `Here is the scandal that motivates everything: run plain gradient descent twice on the SAME objective from the SAME start (0, 3) with the SAME learning rate — once parameterizing the Gaussian by (μ, Ïƒ), once by (μ, log Ïƒ) — and you get two DIFFERENT paths (${steps(GD_FAR)} versus ${steps(LOG_FAR)} steps, computed live). Nothing about the problem changed; only the coordinates did. Gradient descent is coordinate-DEPENDENT: rewrite the same model with different variables and "steepest descent" points somewhere else, because steepest-per-unit-of-parameter depends on what a unit of parameter means. An optimizer whose answer depends on notation should bother you.`,
    invariant: 'The gradient direction changes under reparameterization: âˆ‡ descent answers "steepest per parameter unit," not "steepest per model change."',
  };

  yield {
    state: matrixState({
      title: 'The Fisher information matrix of N(μ, Ïƒ²) — the true local ruler',
      rows: [
        { id: 'fmu', label: 'F[μ, μ] = 1/Ïƒ²' },
        { id: 'fsig', label: 'F[Ïƒ, Ïƒ] = 2/Ïƒ²' },
        { id: 'kl', label: 'KL(θ + δ ‖ θ) â‰ˆ Â½ δáµ€Fδ' },
      ],
      columns: [{ id: 'reads', label: 'what it says' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'small Ïƒ â‡’ huge entry: μ-steps are dangerous near sharp distributions', 'Ïƒ is twice as sensitive as μ at the same scale', 'F is the metric: it converts parameter steps into distribution distance'][v],
    }),
    highlight: { active: ['kl:reads'] },
    explanation: 'The fix starts by naming the right ruler. The FISHER INFORMATION MATRIX is the curvature of KL divergence around the current distribution — the Hessian of "how different is the model" rather than "how high is the loss" (compare The Hessian: Curvature & Newton\'s Step, where the matrix lived on the loss; this one lives on the distribution itself, the same KL geometry that Entropy & Information builds). For our Gaussian it has a closed form, diag(1/Ïƒ², 2/Ïƒ²): exactly the 1/Ïƒ² blow-up that made the KL rings shrink at small Ïƒ. Measure every step with F and "step size" finally means "amount the model changed" — the quantity that was invariant all along.',
    invariant: 'F is the Hessian of KL at zero displacement: the unique local metric on distributions, independent of parameterization.',
  };
}

function* naturalDescent() {
  yield {
    state: plotState({
      axes: AXES,
      series: [...RINGS,
        { id: 'gd', label: `gradient descent — ${steps(GD_FAR)} steps`, points: GD_FAR },
        { id: 'nat', label: `natural gradient — ${steps(NAT_FAR)} steps`, points: NAT_FAR }],
    }),
    highlight: { found: ['nat'], visited: ['gd'] },
    explanation: `The natural gradient is F⁻Â¹âˆ‡L: divide the gradient by the Fisher metric before stepping, exactly as Newton divides by the loss Hessian. For the Gaussian that means multiply âˆ‚μ by Ïƒ² and âˆ‚Ïƒ by Ïƒ²/2 — and the μ-update collapses to something beautiful: μ â† μ âˆ’ lrÂ·(μ âˆ’ μ*), a CONSTANT-rate pull toward the target no matter what Ïƒ is. From this gentle start at (0, 3), same lr = 0.2, the two look almost evenly matched — ${steps(GD_FAR)} steps for plain GD, ${steps(NAT_FAR)} for natural, computed live — but look at HOW they move: GD\'s early strides are timid (the raw gradient (μâˆ’μ*)/Ïƒ² is nine times weaker than the geometry deserves at Ïƒ = 3) and only pick up as Ïƒ shrinks, while the natural path pulls μ at the same rate from the first step to the last. The gap in step counts is small here because this start happens to be benign. The next step shows a start that is not.`,
    invariant: 'Natural gradient steps are uniform in KL, not in parameters: each stride moves the distribution the same amount.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'μ', min: -5.2, max: 5.2 }, y: { label: 'Ïƒ', min: 0, max: 3.5 } },
      series: [
        { id: 'gd', label: `GD from Ïƒ = 0.12 (${GD_STUCK ? `lost — still far after ${steps(GD_SHARP)} steps` : 'recovered'})`, points: GD_SHARP.slice(0, 12) },
        { id: 'nat', label: `natural gradient — ${steps(NAT_SHARP)} steps, same lr`, points: NAT_SHARP },
      ],
    }),
    highlight: { removed: ['gd'], found: ['nat'] },
    explanation: `Now start where the distribution is SHARP: (2.5, 0.12), μ almost correct, Ïƒ too confident. Plain GD reads âˆ‚μ = (μâˆ’μ*)/Ïƒ² â‰ˆ 35, takes one lr = 0.2 stride, and CATAPULTS μ to ${GD_SHARP[1].x.toFixed(1)} while Ïƒ rockets to ${GD_SHARP[1].y.toFixed(0)} — the same learning rate that was nine times too timid at Ïƒ = 3 is dozens of times too violent at Ïƒ = 0.12, and after the explosion the optimizer is marooned on the flat plateau (still unconverged after ${steps(GD_SHARP)} capped steps, loss verified far from optimal). The natural gradient, SAME learning rate: F⁻Â¹ multiplies that ferocious gradient by Ïƒ² = 0.0144, the step shrinks to match the geometry, and it converges in ${steps(NAT_SHARP)} steps. One lr, both regimes — because step size is measured where it matters.`,
    invariant: 'No single lr fits a coordinate-dependent gradient: F⁻Â¹ rescales automatically — gentle where sharp, bold where flat.',
  };

  yield {
    state: matrixState({
      title: 'Where the Fisher metric runs in production',
      rows: [
        { id: 'trpo', label: 'TRPO / PPO (reinforcement learning)' },
        { id: 'kfac', label: 'K-FAC' },
        { id: 'adam', label: 'Adam (squint)' },
        { id: 'vi', label: 'variational inference' },
      ],
      columns: [{ id: 'how', label: 'how it uses F' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'policy steps trust-region-bounded in KL — natural gradient is the first-order solution', 'per-layer Kronecker-factored F⁻Â¹ for deep nets', 'divides by RMS gradients â‰ˆ diagonal empirical Fisher — the cheapest echo of the natural gradient', 'natural-gradient VI: the update on exponential-family posteriors becomes closed-form'][v],
    }),
    highlight: { active: ['trpo:how'] },
    explanation: 'Where you have already met this idea wearing other clothes. Policy-gradient RL is the flagship: a policy is a distribution, parameter steps that look small can change behavior catastrophically, so TRPO constrains each update to a KL trust region — the natural gradient direction — and PPO approximates the same constraint with clipping. K-FAC from the Hessian toolbox is a Fisher method (for many losses the Fisher equals the expected Hessian, which is why the two pages rhyme). And Adam\'s division by RMS gradients is a diagonal empirical-Fisher approximation — the production-grade shadow of F⁻Â¹âˆ‡. Amari named the idea in 1998; modern training has been quietly converging on it ever since.',
    invariant: 'Whenever the thing being optimized is a distribution, the principled step is measured in KL — and its first-order form is F⁻Â¹âˆ‡.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'distance lies in parameter space') yield* distanceLies();
  else if (view === 'the natural gradient') yield* naturalDescent();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [

    { heading: 'How to read the animation', paragraphs: ['The first view draws equal-KL balls for Gaussian distributions. KL divergence measures how different two probability distributions are, and equal-KL balls show equal model change rather than equal coordinate movement. The descent views compare ordinary gradient descent with natural gradient, where found paths mark the geometry-aware update.', {type: 'callout', text: 'Natural gradient changes the ruler: the step is measured by distribution distance, not by raw coordinate movement.'}, {type: 'image', src: './assets/gifs/natural-gradient.gif', alt: 'Animated walkthrough of the natural gradient visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    { heading: 'Why this exists', paragraphs: ['Gradient descent needs a definition of step size. Ordinary gradient descent uses Euclidean distance in parameter coordinates, so a step of 0.3 in one coordinate is treated like the same-sized move anywhere else. That ruler is wrong when parameters describe distributions, because moving a Gaussian mean by 0.3 at sigma = 0.1 changes the distribution far more than the same move at sigma = 10.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions with different means and variances', caption: 'Gaussian curves make the coordinate problem visible: the same parameter move can be tiny or huge depending on local distribution shape. Source: Wikimedia Commons, Inductiveload, public domain.'}]},
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is plain gradient descent on the parameters you wrote down. Compute the loss gradient, multiply by a learning rate, subtract, and repeat. That works when coordinate distance is a useful stand-in for behavior change, but it breaks when sigma versus log sigma changes the descent path for the same distribution family.']},
    { heading: 'The wall', paragraphs: ['The wall is coordinate dependence. The same Gaussian fitting problem takes different paths under parameters (mu, sigma) and (mu, log sigma), even with the same starting distribution and learning rate. At small sigma, the derivative with respect to mu is divided by sigma squared, so a safe learning rate in a wide distribution can explode in a sharp one.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock function surface with curved valley', caption: 'Curved loss geometry exposes why a coordinate ruler can send descent across the valley instead of along the stable direction. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'}]},
    { heading: 'The core insight', paragraphs: ['The core insight is that the space of distributions has its own local geometry. The Fisher information matrix is the local ruler that turns a parameter displacement into an approximate KL change. Natural gradient multiplies the ordinary gradient by the inverse Fisher matrix, changing steepest descent from steepest per parameter unit to steepest per distribution change.']},
    { heading: 'How it works', paragraphs: ['Let theta be the parameters, L be the loss, and F be the Fisher information matrix at theta. The natural gradient step is theta minus learning_rate times inverse(F) times grad L. For a Gaussian with parameters (mu, sigma), F = diag(1 / sigma squared, 2 / sigma squared), so the inverse makes steps cautious in sharp distributions and bolder in wide ones.']},
    { heading: 'Why it works', paragraphs: ['Steepest descent always means steepest inside a unit ball. Ordinary gradient uses a round ball in parameter coordinates, while natural gradient uses the KL ball defined by delta transpose F delta. Under reparameterization, the Fisher matrix and gradient transform in opposite ways, so inverse(F) times grad maps back to the same distribution-space direction.']},
    { heading: 'Cost and complexity', paragraphs: ['Exact natural gradient is expensive. A model with d parameters has a d by d Fisher matrix, which costs O(d squared) memory and O(d cubed) time to invert directly. Practical methods use diagonal Fisher, K-FAC, trust regions, damping, or other approximations, so the method wins only when better geometry saves more work than the preconditioner costs.']},
    { heading: 'Real-world uses', paragraphs: ['Reinforcement learning is a natural use because policies are probability distributions over actions. TRPO constrains policy updates by KL distance, and natural gradient appears as the first-order direction. Variational inference also fits because the optimized object is a distribution family, often with useful Fisher geometry.']},
    { heading: 'Where it fails', paragraphs: ['Natural gradient fails when the Fisher approximation is bad. The true Fisher, empirical Fisher, and generalized Gauss-Newton matrix are different objects, and swapping them can harm the direction. Damping is also fragile: too little amplifies noise, while too much erases the geometry and returns the method toward ordinary descent.']},
    { heading: 'Worked example', paragraphs: ['Fit a Gaussian target with mu* = 2 and sigma* = 0.5. Start at mu = 2.5, sigma = 0.12, and learning rate 0.2; the ordinary mean gradient is (2.5 - 2) / 0.12 squared = 34.72, so the mean step is 6.94. Natural gradient multiplies by sigma squared = 0.0144, giving 0.5 and a step of 0.1 instead of an explosion.']},
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Amari on natural gradient, Martens and Grosse on K-FAC, Schulman et al. on TRPO, Hoffman et al. on stochastic variational inference, and Kunstner et al. on empirical Fisher limits. Study KL divergence, Fisher information, Newton method, Hessian preconditioning, policy gradients, K-FAC, and variational inference next.']},
  ],
};
