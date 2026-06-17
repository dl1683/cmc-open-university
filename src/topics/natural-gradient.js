// Natural gradient: gradient descent measures step size with a ruler laid
// on the PARAMETERS, but what we actually move is a DISTRIBUTION. The Fisher
// information matrix is the right ruler — and F⁻¹∇ is descent that uses it.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'natural-gradient',
  title: 'Natural Gradient & Fisher Information',
  category: 'Concepts',
  summary: 'Why the same parameter step can be a huge or tiny change in distribution space — and the F⁻¹∇ correction that makes optimization coordinate-free.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['distance lies in parameter space', 'the natural gradient'], defaultValue: 'distance lies in parameter space' },
  ],
  run,
};

// The running example: fit a Gaussian N(μ, σ²) to a target N(2, 0.5²) by
// minimizing the expected negative log-likelihood (= KL + constant):
// L(μ, σ) = log σ + (σ*² + (μ − μ*)²) / (2σ²).
const MU = 2;
const SIG = 0.5;
const L = (m, s) => Math.log(s) + (SIG * SIG + (m - MU) ** 2) / (2 * s * s);
const dMu = (m, s) => (m - MU) / (s * s);
const dSig = (m, s) => 1 / s - (SIG * SIG + (m - MU) ** 2) / (s ** 3);
const L_MIN = L(MU, SIG);

// For a Gaussian, the Fisher information matrix is exactly diag(1/σ², 2/σ²):
// the natural gradient F⁻¹∇ multiplies ∂μ by σ² and ∂σ by σ²/2.
function descend(kind, m, s, lr, cap) {
  const path = [{ x: m, y: s }];
  while (L(m, s) - L_MIN > 1e-3 && path.length <= cap) {
    let gm = dMu(m, s);
    let gs = dSig(m, s);
    if (kind === 'natural') { gm *= s * s; gs *= (s * s) / 2; }
    if (kind === 'logsigma') gs *= s * s; // GD in (μ, log σ), mapped back: chain rule twice
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

// Exact NLL contours: at level c, (μ − 2)² = 2σ²(c − log σ) − σ*², solved
// per σ — closed curves around the optimum, like a contour map should be.
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
const AXES = { x: { label: 'μ', min: -1.2, max: 5.2 }, y: { label: 'σ', min: 0, max: 3.5 } };

// A ball of FIXED KL radius, drawn in parameter space: for small steps,
// KL(N(μ+δμ, σ+δσ) ‖ N(μ, σ)) ≈ (δμ² + 2δσ²) / (2σ²) — so the ball has
// radius σ√(2c) in μ and σ√c in σ. It scales with WHERE you stand.
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
      axes: { x: { label: 'μ', min: -3.2, max: 3.2 }, y: { label: 'σ', min: 0, max: 3.4 } },
      series: [
        klBall(0, 2.4, 0.08, 'big', 'KL = 0.08 at σ = 2.4'),
        klBall(0, 1.2, 0.08, 'mid', ''),
        klBall(0, 0.5, 0.08, 'small', 'KL = 0.08 at σ = 0.5'),
      ],
    }),
    highlight: { compare: ['big', 'small'] },
    explanation: 'Three rings, one meaning: every point on a ring is a Gaussian exactly KL = 0.08 away from the Gaussian at its center. The rings are wildly different SIZES in parameter space — the one at σ = 2.4 is nearly 5× wider than the one at σ = 0.5 (radius scales with σ, drawn live from the small-step KL formula). Read it as a warning: a parameter step of 0.3 down at σ = 0.5 tears the distribution apart, while the same 0.3 up at σ = 2.4 barely moves it. Euclidean distance on parameters is a LIE about how much the model changed — and gradient descent\'s "small step" is defined in exactly that lying ruler.',
    invariant: 'Locally KL ≈ ½ δᵀFδ: the same parameter displacement means more distribution change wherever Fisher information is large.',
  };

  yield {
    state: plotState({
      axes: AXES,
      series: [...RINGS,
        { id: 'gd', label: `GD on (μ, σ) — ${steps(GD_FAR)} steps`, points: GD_FAR },
        { id: 'log', label: `GD on (μ, log σ) — ${steps(LOG_FAR)} steps`, points: LOG_FAR }],
    }),
    highlight: { compare: ['gd', 'log'] },
    explanation: `Here is the scandal that motivates everything: run plain gradient descent twice on the SAME objective from the SAME start (0, 3) with the SAME learning rate — once parameterizing the Gaussian by (μ, σ), once by (μ, log σ) — and you get two DIFFERENT paths (${steps(GD_FAR)} versus ${steps(LOG_FAR)} steps, computed live). Nothing about the problem changed; only the coordinates did. Gradient descent is coordinate-DEPENDENT: rewrite the same model with different variables and "steepest descent" points somewhere else, because steepest-per-unit-of-parameter depends on what a unit of parameter means. An optimizer whose answer depends on notation should bother you.`,
    invariant: 'The gradient direction changes under reparameterization: ∇ descent answers "steepest per parameter unit," not "steepest per model change."',
  };

  yield {
    state: matrixState({
      title: 'The Fisher information matrix of N(μ, σ²) — the true local ruler',
      rows: [
        { id: 'fmu', label: 'F[μ, μ] = 1/σ²' },
        { id: 'fsig', label: 'F[σ, σ] = 2/σ²' },
        { id: 'kl', label: 'KL(θ + δ ‖ θ) ≈ ½ δᵀFδ' },
      ],
      columns: [{ id: 'reads', label: 'what it says' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'small σ ⇒ huge entry: μ-steps are dangerous near sharp distributions', 'σ is twice as sensitive as μ at the same scale', 'F is the metric: it converts parameter steps into distribution distance'][v],
    }),
    highlight: { active: ['kl:reads'] },
    explanation: 'The fix starts by naming the right ruler. The FISHER INFORMATION MATRIX is the curvature of KL divergence around the current distribution — the Hessian of "how different is the model" rather than "how high is the loss" (compare The Hessian: Curvature & Newton\'s Step, where the matrix lived on the loss; this one lives on the distribution itself, the same KL geometry that Entropy & Information builds). For our Gaussian it has a closed form, diag(1/σ², 2/σ²): exactly the 1/σ² blow-up that made the KL rings shrink at small σ. Measure every step with F and "step size" finally means "amount the model changed" — the quantity that was invariant all along.',
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
    explanation: `The natural gradient is F⁻¹∇L: divide the gradient by the Fisher metric before stepping, exactly as Newton divides by the loss Hessian. For the Gaussian that means multiply ∂μ by σ² and ∂σ by σ²/2 — and the μ-update collapses to something beautiful: μ ← μ − lr·(μ − μ*), a CONSTANT-rate pull toward the target no matter what σ is. From this gentle start at (0, 3), same lr = 0.2, the two look almost evenly matched — ${steps(GD_FAR)} steps for plain GD, ${steps(NAT_FAR)} for natural, computed live — but look at HOW they move: GD\'s early strides are timid (the raw gradient (μ−μ*)/σ² is nine times weaker than the geometry deserves at σ = 3) and only pick up as σ shrinks, while the natural path pulls μ at the same rate from the first step to the last. The gap in step counts is small here because this start happens to be benign. The next step shows a start that is not.`,
    invariant: 'Natural gradient steps are uniform in KL, not in parameters: each stride moves the distribution the same amount.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'μ', min: -5.2, max: 5.2 }, y: { label: 'σ', min: 0, max: 3.5 } },
      series: [
        { id: 'gd', label: `GD from σ = 0.12 (${GD_STUCK ? `lost — still far after ${steps(GD_SHARP)} steps` : 'recovered'})`, points: GD_SHARP.slice(0, 12) },
        { id: 'nat', label: `natural gradient — ${steps(NAT_SHARP)} steps, same lr`, points: NAT_SHARP },
      ],
    }),
    highlight: { removed: ['gd'], found: ['nat'] },
    explanation: `Now start where the distribution is SHARP: (2.5, 0.12), μ almost correct, σ too confident. Plain GD reads ∂μ = (μ−μ*)/σ² ≈ 35, takes one lr = 0.2 stride, and CATAPULTS μ to ${GD_SHARP[1].x.toFixed(1)} while σ rockets to ${GD_SHARP[1].y.toFixed(0)} — the same learning rate that was nine times too timid at σ = 3 is dozens of times too violent at σ = 0.12, and after the explosion the optimizer is marooned on the flat plateau (still unconverged after ${steps(GD_SHARP)} capped steps, loss verified far from optimal). The natural gradient, SAME learning rate: F⁻¹ multiplies that ferocious gradient by σ² = 0.0144, the step shrinks to match the geometry, and it converges in ${steps(NAT_SHARP)} steps. One lr, both regimes — because step size is measured where it matters.`,
    invariant: 'No single lr fits a coordinate-dependent gradient: F⁻¹ rescales automatically — gentle where sharp, bold where flat.',
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
      format: (v) => ['', 'policy steps trust-region-bounded in KL — natural gradient is the first-order solution', 'per-layer Kronecker-factored F⁻¹ for deep nets', 'divides by RMS gradients ≈ diagonal empirical Fisher — the cheapest echo of the natural gradient', 'natural-gradient VI: the update on exponential-family posteriors becomes closed-form'][v],
    }),
    highlight: { active: ['trpo:how'] },
    explanation: 'Where you have already met this idea wearing other clothes. Policy-gradient RL is the flagship: a policy is a distribution, parameter steps that look small can change behavior catastrophically, so TRPO constrains each update to a KL trust region — the natural gradient direction — and PPO approximates the same constraint with clipping. K-FAC from the Hessian toolbox is a Fisher method (for many losses the Fisher equals the expected Hessian, which is why the two pages rhyme). And Adam\'s division by RMS gradients is a diagonal empirical-Fisher approximation — the production-grade shadow of F⁻¹∇. Amari named the idea in 1998; modern training has been quietly converging on it ever since.',
    invariant: 'Whenever the thing being optimized is a distribution, the principled step is measured in KL — and its first-order form is F⁻¹∇.',
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
    {
      heading: `Why This Exists`,
      paragraphs: [
        `Natural gradient exists because ordinary gradient descent measures the wrong kind of distance for many models. A neural-network policy, a Gaussian variational posterior, or a probabilistic classifier is not just a point in parameter space. It represents a distribution. What matters is how much that distribution changes, not how many raw parameter units were moved.`,
        `Plain gradient descent says a small step is small in coordinates. But coordinates can be arbitrary. The same Gaussian can be parameterized by sigma or by log sigma. The same policy can be written with different logits. If changing notation changes the optimization path, the optimizer is listening to the coordinate system instead of the model. Natural gradient repairs that by measuring steps with the Fisher information matrix.`,
      ],
    },
    {
      heading: `The Naive Approach`,
      paragraphs: [
        `The naive approach is to run gradient descent directly on the chosen parameters. Compute the loss gradient, multiply by a learning rate, subtract, and repeat. That works when the coordinates are a faithful ruler for the thing being changed. It breaks when equal coordinate moves mean very different distribution moves.`,
        `For a Gaussian, moving the mean by 0.3 is mild when sigma is large and violent when sigma is tiny. The narrow Gaussian places most probability mass in a small region, so a sideways shift changes the distribution sharply. Plain gradient descent does not know this. It sees a parameter displacement and treats that displacement as the unit of motion.`,
      ],
    },
    {
      heading: `The Core Insight`,
      paragraphs: [
        `The core insight is that "steepest" is not a complete instruction until a metric says what distance means. Ordinary gradient descent silently uses Euclidean distance in parameter coordinates. Natural gradient uses the local KL distance between model distributions.`,
        `Once distance is measured in distribution space, the update has to compensate for sensitive and insensitive directions. The Fisher information matrix is that local sensitivity map. Multiplying the raw gradient by F^-1 turns a coordinate-level slope into the direction that changes the distribution efficiently without pretending every parameter unit has the same meaning.`,
      ],
    },
    {
      heading: `The Gaussian Example`,
      paragraphs: [
        `The module uses a two-parameter Gaussian with mean mu and standard deviation sigma. The target is another Gaussian. The loss is equivalent to KL divergence plus a constant, so minimizing it means making the model distribution match the target distribution. This keeps the math small while preserving the real problem: parameters are only a representation of a distribution.`,
        `In the ordinary parameterization, the gradient with respect to mu scales like 1 / sigma^2. When sigma is wide, that gradient is small and progress can be timid. When sigma is tiny, the same kind of error can create a huge gradient and an explosive step. Rewriting the model with log sigma changes the raw gradient path again, even though the underlying distributions are the same.`,
      ],
    },
    {
      heading: `The Fisher Metric`,
      paragraphs: [
        `The Fisher information matrix is the local ruler for distributions. Around the current parameters, a small displacement delta changes the distribution by roughly one half times delta transpose F delta. In plain language: F converts a parameter move into an approximate KL-distance move. Large entries mean the distribution is sensitive in that direction.`,
        `For the Gaussian in this topic, the Fisher matrix is diagonal: 1 / sigma^2 for the mean direction and 2 / sigma^2 for the sigma direction. That is exactly the geometry the plots show. Narrow distributions have large Fisher entries, so a small parameter move is a large model change. Wide distributions have smaller entries, so the same coordinate move is less dramatic.`,
      ],
    },
    {
      heading: `The Natural Step`,
      paragraphs: [
        `The natural gradient direction is F^-1 times the ordinary gradient. The inverse Fisher shrinks updates in sensitive directions and stretches updates in insensitive directions. It is similar in spirit to Newton's method, but the matrix comes from distribution geometry, not from the loss surface alone.`,
        `In the Gaussian example, multiplying by F^-1 means multiplying the mean gradient by sigma^2 and the sigma gradient by sigma^2 / 2. The mean update becomes a steady pull toward the target mean rather than a step that is too timid at high sigma and too violent at low sigma. The learning rate now controls approximate distribution change, not raw coordinate change.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The first view proves that a fixed KL radius does not look like a fixed Euclidean radius in parameter space. The rings are wider when sigma is large and tighter when sigma is small. That is the whole problem in one picture: a coordinate step is not a reliable measure of model change.`,
        `The descent views prove the practical consequence. Plain gradient descent can follow different paths under different parameterizations. From a sharp start, it can take a huge raw mean step and blow up the distribution. Natural gradient rescales the same loss gradient with the Fisher metric, so the step is small where the model is sensitive and larger where the model is flat.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `Natural gradient works because steepest descent always depends on a metric. Ordinary gradient descent silently chooses the Euclidean metric on parameters. Natural gradient chooses the local KL metric on distributions. Once that metric is chosen, the steepest direction is no longer the raw gradient; it is the gradient preconditioned by F^-1.`,
        `This also explains the coordinate-free claim. If two parameterizations describe the same distributions, KL distance between nearby distributions is the same object in both descriptions. The Fisher matrix transforms with the coordinates, and the F^-1 gradient transforms back into the same distribution-level direction. The notation changes, but the model move remains consistent.`,
      ],
    },
    {
      heading: `Costs And Approximations`,
      paragraphs: [
        `The exact natural gradient is expensive for large models. With d parameters, the Fisher matrix has d by d entries. Forming it can be costly, storing it can be impossible, and inverting it directly is usually out of the question. That is the same broad cost wall that full Newton methods hit.`,
        `Production methods use approximations. A diagonal Fisher keeps only per-parameter scale and costs O(d). K-FAC uses Kronecker-factored blocks that fit neural-network layers better than a diagonal while staying tractable. Iterative solvers can estimate F^-1 times a vector without explicitly forming the inverse. Adam is not natural gradient, but its RMS normalization is a cheap echo of diagonal curvature or empirical-Fisher scaling.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Natural gradient is most valuable when parameters control a distribution and bad updates change behavior more than the loss value suggests. Reinforcement learning is the classic case. A policy step that looks small in logits can make an agent choose very different actions. TRPO handles this by constraining the policy update inside a KL trust region, and the natural gradient is the first-order solution to that constrained problem.`,
        `Variational inference is another strong fit. Exponential-family posteriors have natural parameters and expectation parameters, and natural-gradient updates often become cleaner than ordinary-gradient updates. The same idea appears in second-order training tools, approximate curvature methods, and any setting where stability is more important than taking the largest raw loss-gradient step.`,
      ],
    },
    {
      heading: `Failure Modes`,
      paragraphs: [
        `The main failure mode is using the wrong Fisher approximation and trusting it too much. The empirical Fisher, the true Fisher, and the generalized Gauss-Newton matrix can differ. Mini-batch estimates can be noisy. A poorly damped inverse can amplify numerical errors. Most implementations add damping, trust-region checks, clipping, or line search to keep the preconditioned step sane.`,
        `A second failure is expecting natural gradient to fix every training problem. It repairs the local ruler, not the whole objective. Nonconvex loss surfaces, bad models, poor data, unstable reward estimates, and implementation bugs still matter. It is a geometry correction, not a guarantee of global convergence.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Gradient Descent first to see what ordinary steepest descent assumes. Then read Entropy and Information for KL divergence, because KL is the distance notion behind the Fisher metric. The Hessian and Newton's Step explains the nearby idea of matrix-scaled optimization, while Eigenvalues and Eigenvectors explains why ill-conditioned matrices make raw gradients behave badly.`,
        `After that, connect this topic to reinforcement learning trust regions, PPO clipping, K-FAC, variational inference, and second-order methods. The useful mental link is simple: whenever the object being optimized is a probability distribution, ask whether the optimizer is measuring parameter motion or distribution motion.`,
      ],
    },
  ],
};
