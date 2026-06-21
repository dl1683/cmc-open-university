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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view draws three ellipses in parameter space (mu, sigma). Each ellipse is the set of Gaussians exactly KL = 0.08 away from the Gaussian at its center. The ellipses have the same KL radius but wildly different coordinate sizes -- the one at sigma = 2.4 is nearly five times wider than the one at sigma = 0.5. That size difference is the entire problem: a fixed parameter step means a huge distribution change near small sigma and a tiny one near large sigma.',
        'The second view overlays loss contours and two descent paths from the same start with the same learning rate -- one using ordinary gradient descent, one using reparameterized (log sigma) gradient descent. They follow different paths to different step counts, proving that GD is coordinate-dependent. Switch to "the natural gradient" view to see natural gradient plotted against plain GD, including a sharp-start case where GD explodes and natural gradient converges calmly.',
        {
          type: 'diagram',
          text: 'Parameter space (mu, sigma)\n  sigma\n  3.0 |   (--------)        <-- KL ball at sigma=2.4: wide\n      |  (----------)\n  2.0 |\n      |     (-----)          <-- KL ball at sigma=1.2: medium\n  1.0 |\n      |       (--)           <-- KL ball at sigma=0.5: tiny\n  0.5 |\n      +---+---+---+----> mu\n     -2   0   2   4\n\nSame KL radius, different coordinate footprint.\nThe "ruler" on parameters lies about distribution distance.',
          label: 'KL balls shrink in coordinates as sigma shrinks',
        },
        '"Found" markers highlight the natural gradient path. "Visited" markers highlight the plain GD path. The matrix view shows the Fisher information entries and their interpretation. At each frame, ask: how much did the distribution actually change, and does the step size reflect that?',
        {type: 'callout', text: 'Natural gradient changes the ruler: the step is measured by distribution distance, not by raw coordinate movement.'},
      
        {type: 'image', src: './assets/gifs/natural-gradient.gif', alt: 'Animated walkthrough of the natural gradient visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Gradient descent computes the steepest direction for a loss function -- but "steepest" requires a definition of distance. Ordinary GD silently uses Euclidean distance in parameter coordinates: the direction that decreases the loss most per unit of coordinate displacement. When the parameters represent a probability distribution, coordinate displacement is the wrong unit. A step of 0.3 in mu at sigma = 0.1 reshapes the entire distribution; the same step at sigma = 10 is invisible. The optimizer treats both as the same size move.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg', alt: 'Normal distribution probability density functions with different means and variances', caption: 'Gaussian curves make the coordinate problem visible: the same parameter move can be tiny or huge depending on local distribution shape. Source: Wikimedia Commons, Inductiveload, public domain.'},
        {
          type: 'quote',
          text: 'The ordinary gradient of a function depends on the coordinate system used, while the natural gradient is coordinate-invariant. The space of probability distributions has a Riemannian structure given by the Fisher information matrix, and the steepest descent direction in this space is the natural gradient.',
          attribution: 'Shun-ichi Amari, "Natural Gradient Works Efficiently in Learning", Neural Computation, 1998',
        },
        'Amari recognized that the set of all parameterized distributions is not a flat Euclidean space. It is a Riemannian manifold whose local metric is the Fisher information matrix. The natural gradient replaces the Euclidean ruler with this intrinsic metric, so the optimizer measures how much the distribution changed rather than how far the parameters moved. The result is an update direction that does not depend on whether you wrote sigma or log sigma, logits or probabilities, or any other arbitrary coordinate choice.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is plain gradient descent on whatever parameters you chose. Compute the loss gradient, scale by a learning rate, subtract, repeat. For a Gaussian with parameters (mu, sigma) fitting a target, the gradient of the negative log-likelihood is straightforward: dL/dmu = (mu - mu*) / sigma^2 and dL/dsigma = 1/sigma - (sigma*^2 + (mu - mu*)^2) / sigma^3. Multiply each by a learning rate, step, and iterate.',
        'This works when all parameters have roughly equal sensitivity -- when a unit step in any direction produces a comparable change in model behavior. For many simple regressions or well-conditioned problems, Euclidean GD converges without incident. The trouble begins when parameter sensitivity varies by orders of magnitude across the space, which is the norm for distributions, not the exception.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coordinate dependence. Run gradient descent on the same Gaussian fitting problem twice, once parameterized by (mu, sigma) and once by (mu, log sigma), with the same learning rate and the same start. You get two different paths with different step counts. Nothing about the distributions changed -- only the notation. An optimizer whose answer depends on how you write the model is broken in a way that no learning rate schedule can fix.',
        'The deeper failure is explosive sensitivity near sharp distributions. At sigma = 0.12, the gradient dL/dmu = (mu - mu*) / sigma^2 amplifies a small mean error by a factor of nearly 70. A learning rate that was safe at sigma = 3 catapults mu to an absurd value and blows the distribution apart. The animation shows this live: from start (2.5, 0.12), GD with lr = 0.2 launches mu past 9 on the first step and never recovers. No single learning rate can be simultaneously safe for sigma = 0.12 and efficient for sigma = 3, because the Euclidean metric treats both regimes identically.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Rosenbrock_function.svg', alt: 'Rosenbrock function surface with curved valley', caption: 'Curved loss geometry exposes why a coordinate ruler can send descent across the valley instead of along the stable direction. Source: Wikimedia Commons, Oleg Alexandrov, public domain.'},
        {
          type: 'note',
          text: 'This is not a quirk of Gaussians. Any parameterized distribution family has regions where Fisher information entries span orders of magnitude. Neural network policies in RL hit this wall routinely: a small logit change near a near-deterministic policy flips the action distribution entirely, while the same logit change near a uniform policy does almost nothing.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The natural gradient replaces the Euclidean steepest-descent direction with the steepest direction on the Riemannian manifold of distributions. The update rule is: theta <- theta - lr * F^{-1} * grad(L), where F is the Fisher information matrix at the current parameters. F^{-1} rescales the raw gradient so that a step of size epsilon moves the distribution by approximately epsilon in KL divergence, regardless of which coordinates you chose.',
        'The Fisher information matrix F is the expected outer product of the score function: F = E[grad(log p(x|theta)) * grad(log p(x|theta))^T]. Equivalently, it is the Hessian of KL divergence at zero displacement: KL(p(theta + delta) || p(theta)) is approximately (1/2) * delta^T * F * delta for small delta. This second characterization is why F is the right metric -- it measures local distributional distance directly.',
        {
          type: 'code',
          language: 'python',
          text: '# Fisher information matrix via score outer product\n# For a model p(x | theta), sample data x_1..x_n from p:\nimport torch\n\ndef fisher_information(model, data, params):\n    """Estimate Fisher via score outer product."""\n    d = len(params)\n    F = torch.zeros(d, d)\n    for x in data:\n        log_p = model.log_prob(x)          # scalar\n        score = torch.autograd.grad(\n            log_p, params, create_graph=False\n        )                                   # tuple of grads\n        s = torch.cat([g.flatten() for g in score])  # (d,)\n        F += s.outer(s)                     # rank-1 update\n    F /= len(data)\n    return F  # (d, d) -- invert for natural gradient\n\n# Natural gradient step:\n# F_inv = torch.linalg.inv(F + damping * I)\n# nat_grad = F_inv @ vanilla_grad\n# params -= lr * nat_grad',
        },
        'For the Gaussian in this animation, the Fisher matrix is diagonal: F = diag(1/sigma^2, 2/sigma^2). The natural gradient multiplies the mean gradient by sigma^2 and the sigma gradient by sigma^2/2. The mean update collapses to mu <- mu - lr * (mu - mu*) -- a constant-rate pull toward the target, independent of sigma. From the sharp start at sigma = 0.12, F^{-1} multiplies the explosive gradient by sigma^2 = 0.0144, taming it to a gentle step. From the wide start at sigma = 3, F^{-1} multiplies the timid gradient by sigma^2 = 9, giving it the boldness the geometry warrants. One learning rate, both regimes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Steepest descent always depends on a norm. The ordinary gradient is the steepest direction under the L2 norm on parameters: it solves "which unit-ball direction decreases L the most?" with the ball defined by ||delta||^2 = delta^T * I * delta. The natural gradient solves the same problem with the ball defined by delta^T * F * delta -- the KL ball. Since KL is invariant to reparameterization (KL between two distributions does not care how you name their parameters), the resulting direction is also invariant.',
        'Formally, if you reparameterize theta = h(phi), the Fisher matrix transforms as F_phi = J^T * F_theta * J where J is the Jacobian of h. The natural gradient F_phi^{-1} * grad_phi(L) = J^{-1} * F_theta^{-1} * grad_theta(L), which maps back to the same direction in distribution space. The coordinate system cancels out. This is the defining property of a Riemannian gradient: the update direction lives on the manifold, not in any particular chart.',
        {
          type: 'diagram',
          text: 'Euclidean space               Riemannian manifold of distributions\n(flat, coordinates matter)     (curved, only KL distance matters)\n\n   grad L                         F^{-1} grad L\n     |                               |\n     v                               v\n  +------+                      +---------+\n  | unit |  = circle in         | unit KL |  = ellipse in\n  | ball |    all directions    |  ball   |    coordinates,\n  +------+                      +---------+   but circle in\n                                               distribution space\n\nSame step SIZE means           Same step SIZE means\nsame parameter distance.       same distribution distance.\nBreaks when sensitivity         Works regardless of\nvaries across directions.       parameterization.',
          label: 'Euclidean vs Riemannian steepest descent',
        },
        'The connection to KL divergence also explains why natural gradient surfaces in trust-region methods. TRPO constrains each policy update to KL(new || old) < epsilon. The first-order solution to "minimize L subject to KL < epsilon" is a step along F^{-1} * grad(L), scaled to touch the trust-region boundary. Natural gradient is trust-region policy optimization in its purest form.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The exact natural gradient requires forming F (d x d), storing it (d^2 memory), and inverting it (O(d^3) time). For a model with d = 100M parameters, that is 10^16 entries and an inversion no hardware can touch. This is the same wall that full Newton methods face, and the reason natural gradient is never used exactly in deep learning.',
        {
          type: 'table',
          headers: ['Method', 'Per-step cost', 'Memory overhead', 'Convergence (steps)', 'Coord-invariant?'],
          rows: [
            ['SGD', 'O(d)', 'O(d)', 'Slow, sensitive to lr & parameterization', 'No'],
            ['Natural gradient (exact)', 'O(d^3)', 'O(d^2)', 'Fast, invariant steps', 'Yes'],
            ['Adam', 'O(d)', 'O(d) -- two moment buffers', 'Good practice, diagonal only', 'No (diagonal approx)'],
            ['K-FAC', 'O(d) per layer, periodic O(k^3) inversions', 'O(k^2) per layer (k = layer width)', 'Near-natural-gradient convergence', 'Approx (block Kronecker)'],
            ['Diagonal Fisher', 'O(d)', 'O(d)', 'Better than SGD, worse than K-FAC', 'No (diagonal approx)'],
          ],
        },
        'K-FAC (Kronecker-Factored Approximate Curvature) is the most successful production approximation. For a layer with input dimension m and output dimension n, the exact Fisher block is mn x mn. K-FAC approximates it as a Kronecker product of an m x m input covariance and an n x n gradient covariance, reducing inversion from O(m^3 n^3) to O(m^3 + n^3). The factors are estimated as running averages and inverted every few steps, amortizing the cubic cost.',
        'Adam divides each gradient coordinate by the square root of its exponential moving average. This is a diagonal rescaling -- structurally similar to a diagonal Fisher inverse. The connection is real but loose: Adam uses the empirical Fisher diagonal (squared gradients of the loss), not the true Fisher (squared gradients of the log-likelihood). For many losses they coincide, but for others they diverge. Adam is the cheapest echo of the natural gradient idea, not a faithful implementation of it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Reinforcement learning is the flagship application. A policy maps states to action distributions. Small logit changes near a near-deterministic policy can flip the entire action distribution -- exactly the sensitivity mismatch that natural gradient corrects. TRPO constrains policy updates inside a KL trust region; the natural gradient is the first-order solution. PPO approximates the same constraint with probability-ratio clipping, trading geometric precision for implementation simplicity.',
        'Variational inference is a natural fit. When the variational family is an exponential family, the Fisher matrix of the variational parameters has a closed form, and natural-gradient VI updates reduce to moment-matching steps that are simpler and more stable than ordinary-gradient updates. This is the backbone of scalable Bayesian methods like natural-gradient stochastic variational inference (Hoffman et al., 2013).',
        'K-FAC has shown wall-clock speedups over Adam in large-scale supervised training (ImageNet, language modeling) when the per-step overhead of maintaining Kronecker factors is offset by fewer total steps. The tradeoff depends on model size, hardware, and implementation quality -- K-FAC wins when convergence speed matters more than per-step cost, which is increasingly true as models grow.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The main failure is trusting a bad Fisher approximation. The true Fisher, the empirical Fisher (score outer product computed on minibatches of the loss gradient rather than the log-likelihood gradient), and the generalized Gauss-Newton matrix are three different objects that coincide only for specific loss functions. Using the wrong one introduces a systematic bias in the preconditioner. Kunstner et al. (2019) showed that the empirical Fisher can point in a worse direction than the raw gradient for some models.',
        'Damping is mandatory and fragile. The raw F^{-1} can amplify noise in low-curvature directions. Every practical implementation adds a damping term: (F + lambda * I)^{-1}. Too little damping and the step explodes; too much and the method collapses back to plain GD. Tuning lambda is a second hyperparameter that partially defeats the "one learning rate" promise.',
        'Natural gradient corrects the local ruler, not the global landscape. Nonconvex loss surfaces, saddle points, bad architectures, poor data, and distribution shift are not geometry problems -- they are objective problems. Natural gradient will walk efficiently toward a local minimum that may still be terrible. It is a coordinate correction, not an oracle.',
        {
          type: 'bullets',
          items: [
            'Empirical Fisher != true Fisher: the cheap estimate can be worse than no preconditioning.',
            'Damping sensitivity: lambda too small amplifies noise; lambda too large kills the curvature correction.',
            'Stale factors: K-FAC recomputes Kronecker factors periodically; stale factors in rapidly changing regions degrade the approximation.',
            'Memory cost: even K-FAC stores O(k^2) per layer; for very wide layers this can rival the model itself.',
            'Not a convergence guarantee: natural gradient finds the steepest local direction on the manifold, not the global optimum.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Amari, "Natural Gradient Works Efficiently in Learning", Neural Computation 1998 -- the founding paper. Defines the Fisher metric on parameter space and derives the natural gradient update.',
            'Martens and Grosse, "Optimizing Neural Networks with Kronecker-Factored Approximate Curvature", ICML 2015 -- K-FAC: the practical bridge between exact natural gradient and scalable deep learning.',
            'Schulman et al., "Trust Region Policy Optimization", ICML 2015 -- TRPO: natural gradient applied to policy optimization with KL trust regions.',
            'Kunstner, Balles, Hennig, "Limitations of the Empirical Fisher Approximation for Natural Gradient Descent", NeurIPS 2019 -- why the cheap Fisher estimate can mislead.',
            'Hoffman et al., "Stochastic Variational Inference", JMLR 2013 -- natural gradient in variational inference at scale.',
          ],
        },
        'Prerequisite: study Gradient Descent to see the Euclidean steepest-descent assumption this topic replaces, and Entropy and Information for KL divergence, which is the distance notion behind the Fisher metric. Related: The Hessian and Newton\'s Step covers loss-surface curvature preconditioning -- the same matrix-times-gradient idea, but the matrix comes from the loss Hessian rather than the distribution metric. Eigenvalues and Eigenvectors explains why ill-conditioned matrices make raw gradients zigzag. Extension: connect to TRPO/PPO in reinforcement learning, K-FAC in deep learning, and natural-gradient variational inference in Bayesian methods.',
      ],
    },
  ],
};
