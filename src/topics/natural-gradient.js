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
      heading: `What it is`,
      paragraphs: [
        `The natural gradient is a fix for a scandal in optimization: a parameter step that looks small and safe can shatter your model if you're not watching the right ruler. Gradient descent measures step size in parameter space — but what you actually care about is how much your model changed. When your model is a distribution (or a neural network policy, or a variational posterior), that change lives in a different geometry than the parameters themselves. The Fisher information matrix is the right metric, and the natural gradient F⁻¹∇ is the descent direction that uses it. It is the first-order cousin of Newton's method, but for distribution-valued objectives where the Hessian of the loss doesn't tell the full story.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with a concrete problem: fit a Gaussian N(μ, σ²) to a target by minimizing the KL divergence (or equivalently, negative log-likelihood). In parameter space (μ, σ), the gradient is ∇L = (∂L/∂μ, ∂L/∂σ). The catch: ∂μ and ∂σ measure completely different things. The partial ∂L/∂μ scales with 1/σ², so when σ is tiny the gradient explodes; ∂L/∂σ scales separately. Reparameterize the same model as (μ, log σ) and the gradients point somewhere different — the same optimization problem, same learning rate, and yet the descent paths diverge (38 steps versus 26 steps in the visualization, both computed live). This coordinate-dependence is the disease.`,
        `The Fisher information matrix cures it. For a Gaussian, it is diag(1/σ², 2/σ²) — exactly the matrix that converts a parameter displacement (δμ, δσ) into KL divergence: KL ≈ ½(δμ²/σ² + 2δσ²/σ²). This is the Hessian of KL around the current distribution, the true local metric on the space of distributions. The natural gradient is F⁻¹∇L: multiply ∂μ by σ² and ∂σ by σ²/2 before stepping. After this rescaling, the μ-update becomes μ ← μ − lr·(μ − μ*), a constant-rate pull toward the target, independent of σ. The optimization becomes coordinate-free: reparameterize and the descent path stays the same (up to numerical precision).`,
        `The payoff appears when your distribution is sharp or flat. Start at (2.5, 0.12) where σ is tiny. Plain gradient descent reads ∂μ ≈ 35, steps with learning rate 0.2, and catapults μ to −4.4 while σ explodes to 56 — one stride from "almost correct" to "marooned." The natural gradient multiplies that ferocious gradient by σ² = 0.0144, shrinks the step to fit the geometry, and converges in 15 steps using the exact same learning rate. No hand-tuning, no adaptive lr schedule — the Fisher metric handles both the sharp and flat regimes from a single lr.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The natural gradient requires the Fisher information matrix F and its inverse F⁻¹. For a distribution with d parameters, F is d×d, and computing F⁻¹ costs O(d³). This is the same cost wall that Newton's method hits — expensive for high-dimensional models. In practice, approximate solutions dominate: use a diagonal Fisher (drop off-diagonal terms, invert in O(d)), use Kronecker factorization K-FAC to decompose F layer-wise, or use empirical Fisher estimates from mini-batch Hessians. Adam's per-coordinate RMS division is the cheapest shadow: it divides gradients by an estimate of the diagonal Fisher, buying you 90% of the benefit at O(d) cost. The trade-off between precision and speed is real, and production systems navigate it carefully.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Trust Region Policy Optimization (TRPO) and its successor PPO, the modern policy-gradient algorithms in reinforcement learning, constrain every parameter update to stay within a fixed KL divergence trust region from the old policy. This is natural-gradient descent in disguise: the first-order term of the KL constraint is exactly F⁻¹∇. PPO replaces the KL bound with gradient clipping, approximating the same geometry. K-FAC (Kronecker-factored approximate curvature) factorizes the Fisher per neural-network layer, scaling natural-gradient updates to deep models. Variational inference uses natural gradients on exponential-family distributions (Gaussians, Poissons, etc.), where the update on the sufficient statistics becomes closed-form — a rare win where theory and computation align. Amari's 1998 paper laid the foundation; the field has been quietly converging on it ever since.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `One tempting mistake: conflating the natural gradient with Newton's method. Newton uses the Hessian of the LOSS, dividing ∇L by ∇²L to get a step. The natural gradient divides ∇L by the Fisher, the Hessian of KL divergence (or cross-entropy), a different object. They coincide only when the Fisher equals the Hessian — which holds for some loss functions but not all. Another trap: the Fisher matrix you compute matters. The empirical Fisher (expected Hessian of the loss on samples) differs from the true Fisher (expected Hessian of the log-likelihood), and that difference can mislead you at scale. Finally, computing F⁻¹ explicitly is unstable; always use factorizations, regularization, or iterative solvers to stay numerically sound.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "The Hessian: Curvature & Newton's Step" to understand why Newton's method works and how it differs from natural gradient (they rhyme, but live on different geometric objects). Study "Entropy & Information" to see how KL divergence measures distribution distance and why Fisher is its Hessian. Explore "Eigenvalues & Eigenvectors" to understand when F is ill-conditioned and why K-FAC works (Kronecker factors decouple the geometry). Revisit "Gradient Descent" to confirm that plain descent is coordinate-dependent — it measures steepness per parameter unit, not per model change. Together, these pieces show why optimization on distributions (or policies, or variational posteriors) demands a ruler that knows what "distance" means.`,
      ],
    },
  ],
};
