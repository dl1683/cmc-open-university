// The Hessian: the loss landscape's second derivative as a 2Ã—2 matrix you
// can actually read. Eigenvalues are ring eccentricity, mixed signs are
// saddles, and Newton\'s method uses the whole matrix to land in one step.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hessian-curvature',
  title: "The Hessian: Curvature & Newton\'s Step",
  category: 'Concepts',
  summary: 'The second derivative of a loss surface is a matrix — its eigenvalues are the ring shapes, and inverting it beats gradient descent in one step.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reading curvature', 'Newton vs gradient descent'], defaultValue: 'reading curvature' },
  ],
  run,
};

// Exact contour rings of the quadratic f(w) = Â½ wáµ€Hw for a DIAGONAL Hessian
// diag(l1, l2): at level L the ring is x = âˆš(2L/l1)Â·cosθ, y = âˆš(2L/l2)Â·sinθ.
function ellipse(l1, l2, L, id, label, cx = 0, cy = 0, rot = 0) {
  const points = [];
  for (let t = 0; t <= 64; t++) {
    const th = (t / 64) * 2 * Math.PI;
    const ex = Math.sqrt((2 * L) / l1) * Math.cos(th);
    const ey = Math.sqrt((2 * L) / l2) * Math.sin(th);
    points.push({
      x: cx + ex * Math.cos(rot) - ey * Math.sin(rot),
      y: cy + ex * Math.sin(rot) + ey * Math.cos(rot),
    });
  }
  return { id, label, points };
}

// Saddle contours of f = Â½(x² âˆ’ 2y²): the level set x² âˆ’ 2y² = 2L is a
// hyperbola — open along x for L > 0, open along y for L < 0.
function saddleBranches(L) {
  const series = [];
  if (L > 0) {
    for (const sign of [1, -1]) {
      const pts = [];
      for (let y = -1.5; y <= 1.5001; y += 0.05) pts.push({ x: sign * Math.sqrt(2 * L + 2 * y * y), y });
      series.push({ id: `sp${L}_${sign > 0 ? 'r' : 'l'}`, label: sign > 0 ? `loss = +${L}` : '', points: pts });
    }
  } else {
    for (const sign of [1, -1]) {
      const pts = [];
      for (let x = -2.6; x <= 2.6001; x += 0.05) pts.push({ x, y: sign * Math.sqrt((x * x - 2 * L) / 2) });
      series.push({ id: `sn${-L}_${sign > 0 ? 'u' : 'd'}`, label: sign > 0 ? `loss = ${L}` : '', points: pts });
    }
  }
  return series;
}

// The tilted bowl: H = [[2.5, 1.5], [1.5, 2.5]]. Its eigensystem has a
// closed form for 2Ã—2 symmetric matrices — computed here, not assumed.
const H_TILT = [[2.5, 1.5], [1.5, 2.5]];
function eigen2x2([[a, b], [, c]]) {
  const tr = a + c;
  const disc = Math.sqrt(tr * tr - 4 * (a * c - b * b));
  const l1 = (tr + disc) / 2;
  const l2 = (tr - disc) / 2;
  const v1 = b !== 0 ? [b, l1 - a] : [1, 0];
  const v2 = b !== 0 ? [b, l2 - a] : [0, 1];
  const norm = ([x, y]) => { const n = Math.hypot(x, y); return [x / n, y / n]; };
  return { l1, l2, v1: norm(v1), v2: norm(v2) };
}
const EIG = eigen2x2(H_TILT);
const TILT_ANGLE = Math.atan2(EIG.v1[1], EIG.v1[0]);

// The race: f = Â½(x² + 9y²), condition number κ = 9, start (2.6, 1.2).
// lr = 0.2 is the OPTIMAL fixed learning rate (2 / (λmin + λmax)) — and it
// still zigzags, contracting only (κâˆ’1)/(κ+1) = 0.8 per step.
const KAPPA = 9;
const START = { x: 2.6, y: 1.2 };
function gdRace() {
  let { x, y } = START;
  const path = [{ x, y }];
  while (0.5 * (x * x + KAPPA * y * y) > 1e-4 && path.length < 200) {
    x -= 0.2 * x;            // âˆ‚f/âˆ‚x = x
    y -= 0.2 * KAPPA * y;    // âˆ‚f/âˆ‚y = 9y
    path.push({ x, y });
  }
  return path;
}
const GD_PATH = gdRace();
const GD_STEPS = GD_PATH.length - 1;
// Newton: w â† w âˆ’ H⁻Â¹âˆ‡f. For a quadratic, H⁻Â¹âˆ‡f(w) = w exactly, so one
// step lands on the minimum regardless of conditioning.
const NEWTON_PATH = [START, {
  x: START.x - (1 / 1) * START.x,
  y: START.y - (1 / KAPPA) * (KAPPA * START.y),
}];

const RACE_RINGS = [0.5, 2, 5, 9.5].map((L, i) => ellipse(1, KAPPA, L, `ring${i}`, i === 0 ? `loss = ${L}` : ''));
const RACE_AXES = { x: { label: 'wâ‚', min: -4.6, max: 4.6 }, y: { label: 'wâ‚‚', min: -1.7, max: 1.7 } };

function* readingCurvature() {
  yield {
    state: plotState({
      axes: { x: { label: 'wâ‚', min: -3.4, max: 3.4 }, y: { label: 'wâ‚‚', min: -1.6, max: 1.6 } },
      series: [
        ...[0.3, 0.7, 1.1].map((L, i) => ellipse(2, 2, L, `bowl${i}`, i === 0 ? 'round bowl' : '', -1.7, 0)),
        ...[0.3, 0.7, 1.1].map((L, i) => ellipse(1, 9, L, `rav${i}`, i === 0 ? 'ravine (κ = 9)' : '', 1.7, 0)),
      ],
    }),
    highlight: { compare: ['bowl0', 'rav0'] },
    explanation: 'In one dimension the second derivative is a single number: how fast the slope changes. In two dimensions it becomes a 2Ã—2 MATRIX — the Hessian — because curvature now depends on direction. These two basins have identical minima but different Hessians: the left bowl curves equally everywhere (H = 2I, rings are circles), while the right ravine curves 9Ã— harder vertically than horizontally (H = diag(1, 9)) — and you can READ that 9 straight off the plot, because each ring is exactly âˆš9 = 3Ã— wider than it is tall. The contour eccentricity from Loss Landscapes from Above: Contour Maps was never a metaphor: it is the Hessian, drawn.',
    invariant: 'Ring axis lengths are 1/âˆšλ along each eigendirection: eccentricity² = condition number κ = λmax/λmin.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'wâ‚', min: -3.4, max: 3.4 }, y: { label: 'wâ‚‚', min: -1.6, max: 1.6 } },
      series: [...saddleBranches(0.4), ...saddleBranches(1.2), ...saddleBranches(-0.4), ...saddleBranches(-1.2)],
    }),
    highlight: { active: ['sp0.4_r', 'sp0.4_l'], removed: ['sn0.4_u', 'sn0.4_d'] },
    explanation: 'Make one diagonal entry negative — H = diag(1, âˆ’2) for f = Â½(x² âˆ’ 2y²) — and the rings tear open into HYPERBOLAS: this is a saddle point. Along wâ‚ the surface curves up (walk east or west and loss rises, the positive-level curves); along wâ‚‚ it curves DOWN (walk north or south and loss falls forever, the negative-level curves). No closed ring can exist because the point is a minimum in one direction and a maximum in the other. The signs of the Hessian\'s eigenvalues are the complete local story: all positive = bowl, all negative = peak, mixed = saddle — and in million-dimensional loss landscapes, mixed is overwhelmingly what critical points are.',
    invariant: 'Eigenvalue signs classify critical points: det(H) < 0 in 2D means mixed signs — a saddle, no ring closes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'wâ‚', min: -2.4, max: 2.4 }, y: { label: 'wâ‚‚', min: -1.7, max: 1.7 } },
      series: [
        ...[0.4, 1.0, 1.8].map((L, i) => ellipse(EIG.l1, EIG.l2, L, `tilt${i}`, i === 0 ? 'tilted bowl' : '', 0, 0, TILT_ANGLE)),
        { id: 'v1', label: `vâ‚ (λâ‚ = ${EIG.l1})`, points: [{ x: 0, y: 0 }, { x: EIG.v1[0] * 0.8, y: EIG.v1[1] * 0.8 }] },
        { id: 'v2', label: `vâ‚‚ (λâ‚‚ = ${EIG.l2})`, points: [{ x: 0, y: 0 }, { x: EIG.v2[0] * 1.4, y: EIG.v2[1] * 1.4 }] },
      ],
    }),
    highlight: { found: ['v1', 'v2'] },
    explanation: `Real Hessians are not diagonal — cross-derivatives couple the axes. H = [[2.5, 1.5], [1.5, 2.5]] has off-diagonal 1.5, and its rings tilt 45° off the axes. The two arrows are its EIGENVECTORS, computed live from the closed form for 2Ã—2 symmetric matrices: λâ‚ = ${EIG.l1} along the short axis, λâ‚‚ = ${EIG.l2} along the long one. This is the deepest fact on the page: every symmetric Hessian is secretly a diagonal one viewed in rotated coordinates — Eigenvalues & Eigenvectors find the rotation. The eigenvectors are the principal axes of every ring; the eigenvalues are the curvatures along them; and the ring is ${Math.sqrt(EIG.l1 / EIG.l2).toFixed(0)}Ã— longer along vâ‚‚ because curvature there is ${EIG.l1 / EIG.l2}Ã— gentler.`,
    invariant: 'A symmetric Hessian diagonalizes: H = VÎ›Váµ€ — eigenvectors are ring axes, eigenvalues the curvature along each.',
  };

  yield {
    state: matrixState({
      title: 'The curvature decoder: Hessian â†’ landscape',
      rows: [
        { id: 'bowl', label: 'H = 2I (round bowl)' },
        { id: 'ravine', label: 'H = diag(1, 9)' },
        { id: 'saddle', label: 'H = diag(1, âˆ’2)' },
        { id: 'tilted', label: 'H = [[2.5, 1.5], [1.5, 2.5]]' },
      ],
      columns: [
        { id: 'eig', label: 'eigenvalues' },
        { id: 'shape', label: 'contour shape' },
        { id: 'verdict', label: 'what an optimizer feels' },
      ],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
      format: (v) => ['',
        '2, 2', 'circles', 'any lr works: one curvature everywhere',
        '1, 9 (κ = 9)', '3:1 ellipses', 'zigzag: lr capped by the steep axis, crawl on the flat one',
        '+1, âˆ’2 (mixed)', 'hyperbolas', 'a direction of escape: gradient flows AWAY along vâ‚‚',
        '4, 1 at ±45°', 'tilted 2:1 ellipses', 'same ravine, rotated — eigenvectors find it',
      ][v],
    }),
    highlight: { active: ['saddle:verdict'] },
    explanation: 'The decoder card. Every local question about a smooth loss surface — is this a minimum? how eccentric are the rings? which direction escapes the saddle? what learning rate is safe? — is answered by the Hessian\'s eigenvalues at that point. The safe-learning-rate rule from Gradient Descent is exactly lr < 2/λmax; the ravines that motivate Momentum, RMSProp & Adam are exactly κ = λmax/λmin >> 1; the saddle-escape direction is exactly the most-negative eigenvector. One matrix, locally, is the whole geometry.',
    invariant: 'Locally, f(w + δ) â‰ˆ f(w) + âˆ‡fáµ€δ + Â½ δáµ€Hδ: the Hessian is the entire second-order story.',
  };
}

function* newtonRace() {
  yield {
    state: plotState({
      axes: RACE_AXES,
      series: [...RACE_RINGS, { id: 'gd', label: `gradient descent (${GD_STEPS} steps)`, points: GD_PATH }],
    }),
    highlight: { active: ['gd'] },
    explanation: `The ravine f = Â½(wâ‚² + 9wâ‚‚²), condition number κ = 9, starting at (2.6, 1.2). This gradient-descent run uses lr = 0.2 — provably the OPTIMAL fixed learning rate for this surface (2/(λmin + λmax)) — and still takes ${GD_STEPS} steps to drive the loss below 0.0001, computed live. Watch the path: it zigzags across the narrow axis (the y-step multiplies by 1 âˆ’ 0.2Â·9 = âˆ’0.8, overshooting every time) while inching along the flat one (the x-step multiplies by 0.8). Best case, the error contracts by only (κâˆ’1)/(κ+1) = 0.8 per step. The Hessian\'s spread is not an inconvenience — it is the precise, provable speed limit of first-order optimization.`,
    invariant: 'Optimal fixed-lr gradient descent contracts error by (κâˆ’1)/(κ+1) per step: κ = 9 means 0.8 — geometry sets the speed limit.',
  };

  yield {
    state: plotState({
      axes: RACE_AXES,
      series: [...RACE_RINGS, { id: 'newton', label: 'Newton (1 step)', points: NEWTON_PATH }],
    }),
    highlight: { found: ['newton'] },
    explanation: `Now use the curvature instead of fighting it. Newton\'s step is w â† w âˆ’ H⁻Â¹âˆ‡f: multiply the gradient by the INVERSE Hessian before stepping. H⁻Â¹ divides each eigendirection by its own curvature — the steep axis gets a small careful step, the flat axis a huge confident one — which un-stretches the ravine back into a perfect circle and points the corrected step straight at the center. On any quadratic the result is exact: one step from (2.6, 1.2) to (${+NEWTON_PATH[1].x.toFixed(12)}, ${+NEWTON_PATH[1].y.toFixed(12)}), computed live, no zigzag, regardless of κ. Newton doesn\'t descend the slope; it solves the local model.`,
    invariant: 'Newton\'s step minimizes the local quadratic model exactly: on a true quadratic, one step suffices for ANY condition number.',
  };

  yield {
    state: plotState({
      axes: RACE_AXES,
      series: [...RACE_RINGS,
        { id: 'gd', label: `gradient descent (${GD_STEPS} steps)`, points: GD_PATH },
        { id: 'newton', label: 'Newton (1 step)', points: NEWTON_PATH }],
    }),
    highlight: { found: ['newton'], visited: ['gd'] },
    explanation: `Side by side: ${GD_STEPS} zigzag steps versus one straight line. So why does every large model train with first-order methods? Price. For d parameters the Hessian has d² entries and inverting it costs O(d³): at GPT scale (d â‰ˆ 10Â¹Â¹) the matrix alone would need ~10²² numbers — more than every hard drive on Earth. Newton wins per step but loses per FLOP. The entire modern optimizer toolbox is a bargain hunt along this trade-off: how much curvature can you exploit without ever materializing H?`,
    invariant: 'Newton trades iteration count for per-step cost: O(d³) algebra per step versus O(d) — at d >> 10⁶ the trade collapses.',
  };

  yield {
    state: matrixState({
      title: 'The curvature bargain bin: approximating H⁻Â¹âˆ‡f',
      rows: [
        { id: 'newton', label: 'exact Newton' },
        { id: 'lbfgs', label: 'L-BFGS' },
        { id: 'adam', label: 'Adam / RMSProp' },
        { id: 'hf', label: 'Hessian-free (CG)' },
        { id: 'kfac', label: 'K-FAC' },
      ],
      columns: [
        { id: 'keeps', label: 'what it keeps of H' },
        { id: 'cost', label: 'extra cost' },
        { id: 'used', label: 'where it lives' },
      ],
      values: [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12], [13, 14, 15]],
      format: (v) => ['',
        'everything', 'O(d²) memory, O(d³) solve', 'classic stats, d â‰¤ ~10⁴',
        'low-rank sketch from last ~10 gradients', 'O(10d)', 'scipy.optimize default, classical ML',
        'diagonal only, from squared gradients', 'O(d)', 'nearly every deep network since 2015',
        'HÂ·v products via double backprop, never H itself', 'O(d) per CG iteration', 'research; deep autoencoders (Martens 2010)',
        'per-layer Kronecker factorization', 'O(d) + per-layer inverses', 'large-batch research training',
      ][v],
    }),
    highlight: { active: ['adam:keeps'] },
    explanation: 'The bargain bin, sorted by how much curvature survives. The punchline hiding in row three: Momentum, RMSProp & Adam — the optimizer training nearly everything — is a DIAGONAL Hessian approximation, estimating per-coordinate curvature from squared gradients and dividing by it, exactly Newton\'s recipe restricted to the diagonal. It un-stretches axis-aligned ravines (this page\'s race) but is blind to tilted ones, because a diagonal can\'t rotate. Every optimizer you will ever use sits somewhere on this shelf: the whole field is one question — how much of H⁻Â¹ can you afford?',
    invariant: 'Adam â‰ˆ diagonal Newton: per-coordinate curvature from gradient statistics — powerful on axis-aligned ravines, blind to rotated ones.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reading curvature') yield* readingCurvature();
  else if (view === 'Newton vs gradient descent') yield* newtonRace();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "reading curvature" view draws contour rings of quadratic loss surfaces. Round rings mean equal curvature in every direction; elongated ellipses mean one direction is steeper. The axis ratio of each ring is the square root of the condition number. Hyperbolas mean a saddle point -- the surface curves up in one direction and down in another.',
        'The "Newton vs gradient descent" view runs both optimizers on the same ravine. The gradient-descent path (active, zigzagging) shows the cost of ignoring curvature. The Newton path (found, one straight line) shows what happens when you invert the Hessian before stepping. Both paths are computed live from the same start point.',
        'Eigenvector arrows in the tilted-bowl frame point along the principal curvature axes. Their lengths are scaled by the corresponding eigenvalue. The matrix card maps Hessian entries to landscape shape: read across each row to connect algebra to geometry.',
        {
          type: 'diagram',
          label: '2D loss surface with curvature ellipses',
          text: '                  w2\n                  ^\n                  |    .---.             steep curvature (large eigenvalue)\n                  | .-/     \\-.\n          ......././           \\.\\.......\n        ./      / /     *       \\ \\      \\.\n       /   .../ /    minimum     \\ \\...   \\\n      |   /   | |                 | |   \\   |\n  ----+--/----+-+--------+--------+-+----\\--+----> w1\n      |   \\   | |                 | |   /   |\n       \\   ...| \\                / /...   /\n        .\\     \\ \\              / /      /.\n          .......\\.\\.          /./........\n                  | .-.     .-.\n                  |    .---.\n                  |\n\n  Outer ellipse: high loss contour (large L)\n  Inner ellipse: low loss contour (small L)\n  Axis ratio = sqrt(lambda_max / lambda_min) = sqrt(kappa)\n  Eigenvectors point along the long and short axes',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Gradient descent knows which way is downhill but not how the floor is shaped. On a round bowl that is enough -- any reasonable learning rate converges. On a narrow ravine, the gradient points mostly across the ravine rather than along it, so the optimizer zigzags. The condition number (ratio of steepest to gentlest curvature) controls how many zigzag steps you waste. At condition number 9, even the optimal fixed learning rate contracts error by only 0.8 per step.',
        {
          type: 'quote',
          text: 'The loss function is a surface in a very high-dimensional space. The geometry of that surface -- its curvature, its saddle points, its flat regions -- determines how easy or hard it is to train a neural network.',
          attribution: 'Yann LeCun, on loss surface geometry and optimization difficulty',
        },
        'The Hessian matrix captures that geometry. It is the matrix of second partial derivatives: H[i,j] = d2f / dw_i dw_j. Its eigenvalues are the principal curvatures at a point, and its eigenvectors are the directions of those curvatures. Every question about local optimization difficulty -- is this a minimum, a saddle, or a plateau? how eccentric are the contours? what learning rate is safe? -- is answered by the Hessian eigenvalues.',
        'This matters because the entire modern optimizer toolbox is a set of strategies for approximating the Hessian cheaply. Adam estimates its diagonal from squared gradients. L-BFGS keeps a low-rank sketch. Understanding the Hessian is understanding what every optimizer is trying to do and where each one cuts corners.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is gradient descent with a fixed learning rate. It works: the gradient points downhill, and small enough steps always reduce the loss on smooth surfaces. For round bowls, convergence is fast and the path is direct.',
        'The approach stops scaling when the loss surface is not round. On f = 0.5*(w1^2 + 9*w2^2), the gradient at (2.6, 1.2) is (2.6, 10.8) -- pointing mostly in the w2 direction because that axis is 9x steeper. But the minimum is along the w1 axis. The gradient misleads: it points toward the nearest wall of the ravine, not toward the bottom of the valley.',
        'Adaptive methods like Adam partially fix this by scaling each coordinate independently. But a diagonal rescaling can only straighten axis-aligned ravines. Rotate the ravine 45 degrees (H = [[2.5, 1.5], [1.5, 2.5]]) and Adam cannot see the tilt. The off-diagonal entries of the Hessian encode cross-coordinate curvature, and any diagonal approximation is blind to them.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hard boundary is the condition number kappa = lambda_max / lambda_min. For gradient descent with fixed learning rate, the error contracts by at most (kappa - 1) / (kappa + 1) per step. At kappa = 9, that is 0.8 -- you need roughly 5*kappa steps to reduce error by a factor of e. At kappa = 1000 (common in deep networks), convergence crawls: each step reduces error by 0.998.',
        'The invariant that breaks: gradient descent assumes a single step size works for all directions. But the safe step size is bounded by 2/lambda_max (the steepest direction), while the efficient step size for the flat direction is 2/lambda_min. When lambda_max >> lambda_min, no single number satisfies both constraints. The steep axis demands tiny steps; the flat axis needs huge ones. This is not a tuning problem -- it is a geometric impossibility.',
        {
          type: 'note',
          text: 'The condition number is visible on the contour plot: it is the square of the axis ratio of the elliptical rings. If the contours are 3x wider than they are tall, kappa = 9. If you cannot see the short axis without zooming, kappa is large enough to cripple first-order methods.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The Hessian H of a scalar loss f(w) is the symmetric matrix of second partial derivatives. Because mixed partials commute (Schwarz theorem), H = H^T, so it has real eigenvalues and orthogonal eigenvectors. The eigendecomposition H = V * Lambda * V^T rotates the landscape into coordinates where each axis has a single curvature number. In these rotated coordinates, the contour rings become axis-aligned ellipses with semi-axes proportional to 1/sqrt(lambda_i).',
        "Newton's method uses the Hessian to solve the local quadratic model exactly. The Taylor expansion f(w + delta) ~ f(w) + grad^T * delta + 0.5 * delta^T * H * delta is minimized by delta = -H^{-1} * grad. On a true quadratic, this lands at the minimum in one step regardless of the condition number. The inverse Hessian rescales each eigendirection by 1/lambda_i, which un-stretches the ravine into a perfect circle and points the corrected step straight at the center.",
        {
          type: 'code',
          language: 'python',
          text: '# Hessian-vector product via forward-over-reverse autodiff\n# Computes H @ v without ever materializing the d x d Hessian matrix\n# Cost: two backward passes ~ 2x the cost of a single gradient\n\nimport torch\n\ndef hessian_vector_product(loss_fn, params, v):\n    """Compute H @ v where H = d2(loss)/d(params)2."""\n    # Step 1: compute gradient g = d(loss)/d(params)\n    params.requires_grad_(True)\n    loss = loss_fn(params)\n    g = torch.autograd.grad(loss, params, create_graph=True)[0]\n\n    # Step 2: differentiate the dot product g^T v w.r.t. params\n    # This gives d(g^T v)/d(params) = H @ v\n    gv = torch.dot(g, v)\n    Hv = torch.autograd.grad(gv, params)[0]\n    return Hv\n\n# Usage: approximate the top eigenvalue via power iteration\nv = torch.randn_like(params)\nfor _ in range(50):\n    Hv = hessian_vector_product(loss_fn, params, v)\n    v = Hv / Hv.norm()  # normalize\nlambda_max = torch.dot(v, hessian_vector_product(loss_fn, params, v))',
        },
        'The code above computes the Hessian-vector product H*v in O(d) memory and O(d) time -- the same cost as two gradient computations. This is the key primitive behind Hessian-free optimization: you never store the d x d matrix, but you can multiply by it. Power iteration on this primitive finds the top eigenvalue (and thus the safe learning rate 2/lambda_max). Conjugate gradient on this primitive solves H*delta = -grad without inversion. The entire second-order toolbox rests on this operation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Newton's method is correct because the quadratic approximation is exact on quadratics. For f(w) = 0.5 * w^T * H * w (no linear term at the minimum), the gradient is H*w and the Newton step is w - H^{-1} * H * w = w - w = 0. One step. The eigenvalue decomposition reveals why: in the eigenbasis, H is diagonal, so each coordinate is an independent 1D quadratic solved independently by its own Newton step.",
        'For non-quadratic losses, Newton converges quadratically near a local minimum -- meaning the number of correct digits roughly doubles each step. The proof relies on the Hessian being Lipschitz continuous: if H does not change too fast, the quadratic model stays accurate within a trust region, and each step cuts the error norm by a factor proportional to the error itself.',
        'The eigenvalue spectrum tells the full local story. All positive eigenvalues: local minimum. All negative: local maximum. Mixed signs: saddle point. The index of a critical point (number of negative eigenvalues) determines its character. In d dimensions, a random critical point of a generic function has roughly d/2 positive and d/2 negative eigenvalues -- overwhelmingly a saddle. True minima require all d eigenvalues positive, which becomes exponentially unlikely as d grows. This is why saddle points, not local minima, are the main obstacle in high-dimensional optimization (Dauphin et al., 2014).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Method', 'Convergence', 'Cost per step', 'Memory'],
          rows: [
            ['SGD (fixed lr)', 'Linear: error *= (kappa-1)/(kappa+1)', 'O(d) -- one gradient', 'O(d)'],
            ['Newton (exact)', 'Quadratic near minimum', 'O(d^3) -- form and invert H', 'O(d^2) -- store full H'],
            ['L-BFGS', 'Superlinear (limited memory)', 'O(md) -- m ~ 10 past gradients', 'O(md) -- m gradient pairs'],
            ['Natural gradient', 'Parameterization-invariant', 'O(d^2) to O(d^3) -- Fisher matrix', 'O(d^2) -- Fisher matrix'],
          ],
        },
        'The table exposes the fundamental tradeoff. SGD pays O(d) per step but needs O(kappa) steps. Newton pays O(d^3) per step but converges in O(1) steps on quadratics. The total work is O(d * kappa) vs O(d^3). When d >> kappa, Newton wins on total compute. When d >> 10^6 (modern deep learning), O(d^3) is physically impossible -- the Hessian alone requires d^2 floats of storage, which at d = 10^8 means 10^16 numbers (tens of petabytes).',
        "Hessian-vector products change the economics. Each H*v costs 2x a gradient (two backward passes). Conjugate gradient solves H*delta = -grad in roughly sqrt(kappa) iterations, each costing one H*v product. Total: O(d * sqrt(kappa)) -- better than SGD's O(d * kappa) by a square root, without ever storing the matrix. This is Martens' Hessian-free method (2010).",
        'The eigenvalue spectrum also matters. Most deep network Hessians have a bulk of near-zero eigenvalues and a small number of large outliers. The effective rank is far below d, which means low-rank approximations (L-BFGS, K-FAC) capture most of the useful curvature with O(md) memory where m << d.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "Classical optimization (d < 10^4): Newton's method and L-BFGS dominate. Scipy's default optimizer is L-BFGS-B. Logistic regression, Gaussian processes, and most convex problems in statistics converge in tens of iterations with quasi-Newton methods that would take thousands with SGD.",
        'Learning rate selection: the safe learning rate rule lr < 2/lambda_max comes directly from the Hessian. Estimating the top eigenvalue via a few power iterations (each costing one Hessian-vector product) gives a principled upper bound on the step size. This is cheaper than grid search and backed by a proof.',
        "Architecture understanding: Li et al. (2018) showed that skip connections reduce the Hessian's condition number, explaining why ResNets train faster than plain networks. The Hessian eigenvalue spectrum is a diagnostic tool: a flat bulk with a few sharp outliers indicates that most parameters are in a plateau while a few directions control the loss. This insight drives gradient clipping (clip the outlier directions) and warmup schedules (let the large eigenvalues stabilize before taking big steps).",
        'Uncertainty quantification: the inverse Hessian at a minimum approximates the posterior covariance in Bayesian inference (Laplace approximation). Bayesian neural networks use Kronecker-factored approximate Hessians (K-FAC) or diagonal approximations to estimate uncertainty without sampling. Robotics and control use exact Newton steps because d is small (< 1000) and real-time constraints demand fast convergence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Scale is the primary failure. At d = 10^8 (a mid-size language model), storing the Hessian requires d^2 = 10^16 floats -- roughly 40 petabytes. Inverting it would cost O(d^3) = O(10^24) operations. No hardware exists that makes this feasible. Every practical second-order method for deep learning is an approximation that discards most of the Hessian.',
        'Indefiniteness is the second failure. At a saddle point, the Hessian has negative eigenvalues, and H^{-1} * grad can point toward a maximum rather than a minimum. Naive Newton maximizes along the negative-curvature directions. Practical fixes include damping (replace H with H + lambda*I to make all eigenvalues positive), trust regions (limit step size so the quadratic model stays accurate), and saddle-free Newton (take the absolute value of eigenvalues before inverting). Each fix adds complexity and hyperparameters.',
        'Locality is the third failure. The Hessian describes curvature at a single point. One step away, the curvature can change sign, the condition number can spike, and the quadratic model can wildly mispredict the actual loss. Deep network loss surfaces are highly non-quadratic globally -- flat plateaus, sharp cliffs, and narrow gorges alternate. A Newton step computed at one point may overshoot into a region where the local model is meaningless.',
        'Diagonal blindness affects Adam and RMSProp, the most widely used approximate second-order methods. They estimate per-coordinate curvature from squared gradient history, which works for axis-aligned ravines but misses rotated structure. The tilted bowl H = [[2.5, 1.5], [1.5, 2.5]] has eigenvectors at 45 degrees -- a diagonal approximation cannot represent this rotation and will zigzag through the tilted ravine exactly as plain SGD would.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Nocedal & Wright, "Numerical Optimization" (2006), chapters 3 and 7 -- the standard reference on Newton\'s method, quasi-Newton methods, and trust regions. The convergence proofs for quadratic and superlinear convergence are here.',
            'Martens, "Deep Learning via Hessian-free Optimization" (ICML 2010) -- introduced conjugate-gradient-based Hessian-free training for deep networks. The key insight: you need H*v products, never H itself.',
            'Dauphin et al., "Identifying and Attacking the Saddle Point Problem in High-Dimensional Non-Convex Optimization" (NeurIPS 2014) -- established that saddle points, not local minima, are the primary obstacle in deep learning, and that the Hessian eigenvalue index determines critical-point character.',
            'Sagun et al., "Eigenvalues of the Hessian in Deep Learning" (2017) -- empirically characterized the Hessian spectrum of deep networks as a bulk of near-zero eigenvalues plus a few large outliers.',
            'Li et al., "Visualizing the Loss Landscape of Neural Nets" (NeurIPS 2018) -- used Hessian-based analysis to show why skip connections smooth the loss surface.',
          ],
        },
        'Prerequisite: "Eigenvalues & Eigenvectors" -- the decomposition H = V * Lambda * V^T is the foundation. Without eigendecomposition, the Hessian is just a matrix of numbers; with it, each number is a curvature along a named direction.',
        'Extension: "Loss Landscapes from Above: Contour Maps" -- contour eccentricity is the Hessian, drawn. That page shows the geometry this page explains algebraically.',
        'Companion: "Gradient Descent" and "Momentum, RMSProp & Adam" -- gradient descent is the first-order baseline; Adam is the diagonal Hessian approximation that trains most deep networks. Understanding the Hessian reveals why Adam works (it un-stretches axis-aligned ravines) and where it fails (tilted ravines, saddle points).',
      ],
    },
  ],
};
