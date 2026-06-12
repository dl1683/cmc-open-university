// The Hessian: the loss landscape's second derivative as a 2×2 matrix you
// can actually read. Eigenvalues are ring eccentricity, mixed signs are
// saddles, and Newton's method uses the whole matrix to land in one step.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hessian-curvature',
  title: "The Hessian: Curvature & Newton's Step",
  category: 'Concepts',
  summary: 'The second derivative of a loss surface is a matrix — its eigenvalues are the ring shapes, and inverting it beats gradient descent in one step.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reading curvature', 'Newton vs gradient descent'], defaultValue: 'reading curvature' },
  ],
  run,
};

// Exact contour rings of the quadratic f(w) = ½ wᵀHw for a DIAGONAL Hessian
// diag(l1, l2): at level L the ring is x = √(2L/l1)·cosθ, y = √(2L/l2)·sinθ.
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

// Saddle contours of f = ½(x² − 2y²): the level set x² − 2y² = 2L is a
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
// closed form for 2×2 symmetric matrices — computed here, not assumed.
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

// The race: f = ½(x² + 9y²), condition number κ = 9, start (2.6, 1.2).
// lr = 0.2 is the OPTIMAL fixed learning rate (2 / (λmin + λmax)) — and it
// still zigzags, contracting only (κ−1)/(κ+1) = 0.8 per step.
const KAPPA = 9;
const START = { x: 2.6, y: 1.2 };
function gdRace() {
  let { x, y } = START;
  const path = [{ x, y }];
  while (0.5 * (x * x + KAPPA * y * y) > 1e-4 && path.length < 200) {
    x -= 0.2 * x;            // ∂f/∂x = x
    y -= 0.2 * KAPPA * y;    // ∂f/∂y = 9y
    path.push({ x, y });
  }
  return path;
}
const GD_PATH = gdRace();
const GD_STEPS = GD_PATH.length - 1;
// Newton: w ← w − H⁻¹∇f. For a quadratic, H⁻¹∇f(w) = w exactly, so one
// step lands on the minimum regardless of conditioning.
const NEWTON_PATH = [START, {
  x: START.x - (1 / 1) * START.x,
  y: START.y - (1 / KAPPA) * (KAPPA * START.y),
}];

const RACE_RINGS = [0.5, 2, 5, 9.5].map((L, i) => ellipse(1, KAPPA, L, `ring${i}`, i === 0 ? `loss = ${L}` : ''));
const RACE_AXES = { x: { label: 'w₁', min: -4.6, max: 4.6 }, y: { label: 'w₂', min: -1.7, max: 1.7 } };

function* readingCurvature() {
  yield {
    state: plotState({
      axes: { x: { label: 'w₁', min: -3.4, max: 3.4 }, y: { label: 'w₂', min: -1.6, max: 1.6 } },
      series: [
        ...[0.3, 0.7, 1.1].map((L, i) => ellipse(2, 2, L, `bowl${i}`, i === 0 ? 'round bowl' : '', -1.7, 0)),
        ...[0.3, 0.7, 1.1].map((L, i) => ellipse(1, 9, L, `rav${i}`, i === 0 ? 'ravine (κ = 9)' : '', 1.7, 0)),
      ],
    }),
    highlight: { compare: ['bowl0', 'rav0'] },
    explanation: 'In one dimension the second derivative is a single number: how fast the slope changes. In two dimensions it becomes a 2×2 MATRIX — the Hessian — because curvature now depends on direction. These two basins have identical minima but different Hessians: the left bowl curves equally everywhere (H = 2I, rings are circles), while the right ravine curves 9× harder vertically than horizontally (H = diag(1, 9)) — and you can READ that 9 straight off the plot, because each ring is exactly √9 = 3× wider than it is tall. The contour eccentricity from Loss Landscapes from Above: Contour Maps was never a metaphor: it is the Hessian, drawn.',
    invariant: 'Ring axis lengths are 1/√λ along each eigendirection: eccentricity² = condition number κ = λmax/λmin.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'w₁', min: -3.4, max: 3.4 }, y: { label: 'w₂', min: -1.6, max: 1.6 } },
      series: [...saddleBranches(0.4), ...saddleBranches(1.2), ...saddleBranches(-0.4), ...saddleBranches(-1.2)],
    }),
    highlight: { active: ['sp0.4_r', 'sp0.4_l'], removed: ['sn0.4_u', 'sn0.4_d'] },
    explanation: 'Make one diagonal entry negative — H = diag(1, −2) for f = ½(x² − 2y²) — and the rings tear open into HYPERBOLAS: this is a saddle point. Along w₁ the surface curves up (walk east or west and loss rises, the positive-level curves); along w₂ it curves DOWN (walk north or south and loss falls forever, the negative-level curves). No closed ring can exist because the point is a minimum in one direction and a maximum in the other. The signs of the Hessian\'s eigenvalues are the complete local story: all positive = bowl, all negative = peak, mixed = saddle — and in million-dimensional loss landscapes, mixed is overwhelmingly what critical points are.',
    invariant: 'Eigenvalue signs classify critical points: det(H) < 0 in 2D means mixed signs — a saddle, no ring closes.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'w₁', min: -2.4, max: 2.4 }, y: { label: 'w₂', min: -1.7, max: 1.7 } },
      series: [
        ...[0.4, 1.0, 1.8].map((L, i) => ellipse(EIG.l1, EIG.l2, L, `tilt${i}`, i === 0 ? 'tilted bowl' : '', 0, 0, TILT_ANGLE)),
        { id: 'v1', label: `v₁ (λ₁ = ${EIG.l1})`, points: [{ x: 0, y: 0 }, { x: EIG.v1[0] * 0.8, y: EIG.v1[1] * 0.8 }] },
        { id: 'v2', label: `v₂ (λ₂ = ${EIG.l2})`, points: [{ x: 0, y: 0 }, { x: EIG.v2[0] * 1.4, y: EIG.v2[1] * 1.4 }] },
      ],
    }),
    highlight: { found: ['v1', 'v2'] },
    explanation: `Real Hessians are not diagonal — cross-derivatives couple the axes. H = [[2.5, 1.5], [1.5, 2.5]] has off-diagonal 1.5, and its rings tilt 45° off the axes. The two arrows are its EIGENVECTORS, computed live from the closed form for 2×2 symmetric matrices: λ₁ = ${EIG.l1} along the short axis, λ₂ = ${EIG.l2} along the long one. This is the deepest fact on the page: every symmetric Hessian is secretly a diagonal one viewed in rotated coordinates — Eigenvalues & Eigenvectors find the rotation. The eigenvectors are the principal axes of every ring; the eigenvalues are the curvatures along them; and the ring is ${Math.sqrt(EIG.l1 / EIG.l2).toFixed(0)}× longer along v₂ because curvature there is ${EIG.l1 / EIG.l2}× gentler.`,
    invariant: 'A symmetric Hessian diagonalizes: H = VΛVᵀ — eigenvectors are ring axes, eigenvalues the curvature along each.',
  };

  yield {
    state: matrixState({
      title: 'The curvature decoder: Hessian → landscape',
      rows: [
        { id: 'bowl', label: 'H = 2I (round bowl)' },
        { id: 'ravine', label: 'H = diag(1, 9)' },
        { id: 'saddle', label: 'H = diag(1, −2)' },
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
        '+1, −2 (mixed)', 'hyperbolas', 'a direction of escape: gradient flows AWAY along v₂',
        '4, 1 at ±45°', 'tilted 2:1 ellipses', 'same ravine, rotated — eigenvectors find it',
      ][v],
    }),
    highlight: { active: ['saddle:verdict'] },
    explanation: 'The decoder card. Every local question about a smooth loss surface — is this a minimum? how eccentric are the rings? which direction escapes the saddle? what learning rate is safe? — is answered by the Hessian\'s eigenvalues at that point. The safe-learning-rate rule from Gradient Descent is exactly lr < 2/λmax; the ravines that motivate Momentum, RMSProp & Adam are exactly κ = λmax/λmin ≫ 1; the saddle-escape direction is exactly the most-negative eigenvector. One matrix, locally, is the whole geometry.',
    invariant: 'Locally, f(w + δ) ≈ f(w) + ∇fᵀδ + ½ δᵀHδ: the Hessian is the entire second-order story.',
  };
}

function* newtonRace() {
  yield {
    state: plotState({
      axes: RACE_AXES,
      series: [...RACE_RINGS, { id: 'gd', label: `gradient descent (${GD_STEPS} steps)`, points: GD_PATH }],
    }),
    highlight: { active: ['gd'] },
    explanation: `The ravine f = ½(w₁² + 9w₂²), condition number κ = 9, starting at (2.6, 1.2). This gradient-descent run uses lr = 0.2 — provably the OPTIMAL fixed learning rate for this surface (2/(λmin + λmax)) — and still takes ${GD_STEPS} steps to drive the loss below 0.0001, computed live. Watch the path: it zigzags across the narrow axis (the y-step multiplies by 1 − 0.2·9 = −0.8, overshooting every time) while inching along the flat one (the x-step multiplies by 0.8). Best case, the error contracts by only (κ−1)/(κ+1) = 0.8 per step. The Hessian's spread is not an inconvenience — it is the precise, provable speed limit of first-order optimization.`,
    invariant: 'Optimal fixed-lr gradient descent contracts error by (κ−1)/(κ+1) per step: κ = 9 means 0.8 — geometry sets the speed limit.',
  };

  yield {
    state: plotState({
      axes: RACE_AXES,
      series: [...RACE_RINGS, { id: 'newton', label: 'Newton (1 step)', points: NEWTON_PATH }],
    }),
    highlight: { found: ['newton'] },
    explanation: `Now use the curvature instead of fighting it. Newton's step is w ← w − H⁻¹∇f: multiply the gradient by the INVERSE Hessian before stepping. H⁻¹ divides each eigendirection by its own curvature — the steep axis gets a small careful step, the flat axis a huge confident one — which un-stretches the ravine back into a perfect circle and points the corrected step straight at the center. On any quadratic the result is exact: one step from (2.6, 1.2) to (${+NEWTON_PATH[1].x.toFixed(12)}, ${+NEWTON_PATH[1].y.toFixed(12)}), computed live, no zigzag, regardless of κ. Newton doesn't descend the slope; it solves the local model.`,
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
    explanation: `Side by side: ${GD_STEPS} zigzag steps versus one straight line. So why does every large model train with first-order methods? Price. For d parameters the Hessian has d² entries and inverting it costs O(d³): at GPT scale (d ≈ 10¹¹) the matrix alone would need ~10²² numbers — more than every hard drive on Earth. Newton wins per step but loses per FLOP. The entire modern optimizer toolbox is a bargain hunt along this trade-off: how much curvature can you exploit without ever materializing H?`,
    invariant: 'Newton trades iteration count for per-step cost: O(d³) algebra per step versus O(d) — at d ≫ 10⁶ the trade collapses.',
  };

  yield {
    state: matrixState({
      title: 'The curvature bargain bin: approximating H⁻¹∇f',
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
        'everything', 'O(d²) memory, O(d³) solve', 'classic stats, d ≤ ~10⁴',
        'low-rank sketch from last ~10 gradients', 'O(10d)', 'scipy.optimize default, classical ML',
        'diagonal only, from squared gradients', 'O(d)', 'nearly every deep network since 2015',
        'H·v products via double backprop, never H itself', 'O(d) per CG iteration', 'research; deep autoencoders (Martens 2010)',
        'per-layer Kronecker factorization', 'O(d) + per-layer inverses', 'large-batch research training',
      ][v],
    }),
    highlight: { active: ['adam:keeps'] },
    explanation: 'The bargain bin, sorted by how much curvature survives. The punchline hiding in row three: Momentum, RMSProp & Adam — the optimizer training nearly everything — is a DIAGONAL Hessian approximation, estimating per-coordinate curvature from squared gradients and dividing by it, exactly Newton\'s recipe restricted to the diagonal. It un-stretches axis-aligned ravines (this page\'s race) but is blind to tilted ones, because a diagonal can\'t rotate. Every optimizer you will ever use sits somewhere on this shelf: the whole field is one question — how much of H⁻¹ can you afford?',
    invariant: 'Adam ≈ diagonal Newton: per-coordinate curvature from gradient statistics — powerful on axis-aligned ravines, blind to rotated ones.',
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
      heading: `What it is`,
      paragraphs: [
        `The Hessian is the matrix of second partial derivatives of a loss function. In two dimensions it is a 2×2 matrix that tells you how the slope itself is changing — the curvature in every direction. Just as the gradient points downhill, the Hessian says "HOW STEEP is the slope at this point?" — and in multiple directions at once. Its eigenvalues are the principal curvatures; you can read them straight off a contour map as ring eccentricity. Its eigenvectors point along the principal axes of the rings. For a symmetric Hessian like the ones we encounter in machine learning, this matrix is the complete local second-order description of the loss landscape.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with a smooth scalar loss f(w) where w is a parameter vector. The gradient ∇f is the vector of first partial derivatives — it points downhill. The Hessian H is the matrix of second partial derivatives: entry H[i,j] = ∂²f / ∂wᵢ∂wⱼ. Because mixed partials commute (Schwarz's theorem), the Hessian is symmetric: H = Hᵀ. A symmetric matrix has real eigenvalues and orthogonal eigenvectors — this is the crucial fact. The eigendecomposition H = VΛVᵀ rotates the landscape into a coordinate system where curvature along each axis is a single number (the eigenvalue). On a contour map, the eigenvectors point along the principal axes of each ring, and the eigenvalues measure how curved the ring is along those axes. A large eigenvalue means tight, steep curvature; a small eigenvalue means gently sloping terrain. If all eigenvalues are positive the point is a local minimum (a bowl of rings). If all are negative it is a local maximum (an inverted bowl). If they have mixed signs — some positive, some negative — the point is a saddle, and the contours tear open into hyperbolas: you can escape to lower loss by stepping along the most-negative eigenvector's direction.`,
        `Newton's method exploits the Hessian directly. The update rule is w ← w − H⁻¹∇f. This is not gradient descent with a learning rate — it is solving the local quadratic approximation f(w + δ) ≈ f(w) + ∇fᵀδ + ½δᵀHδ for the optimal step δ. On any true quadratic, this lands at the minimum in ONE step, regardless of how eccentric the rings are. On the ravine f = ½(x² + 9y²) with condition number κ = 9, gradient descent with the optimal learning rate still zigzags for 26 steps. Newton solves it in one. The cost? Inverting the Hessian requires O(d³) algebra, where d is the number of parameters. At GPT scale (d ≈ 10¹¹) you would need ~10²² numbers to store H. So while Newton wins on iterations, it loses catastrophically on compute.`,
        `Modern optimizers are all bargains in the same game: exploit curvature without computing the full Hessian. Adam uses only the diagonal entries of the Hessian (estimated from squared gradient history), which costs O(d) and works well on axis-aligned ravines but is blind to tilted ones. L-BFGS keeps a low-rank sketch of the last 10 or so gradients. Hessian-free CG uses double-backprop to compute H·v products without ever writing down H. K-FAC factors the Hessian layer-wise as a Kronecker product. They are all on the same spectrum: how much of H⁻¹ can you afford to approximate?`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For a 2×2 Hessian like [[2.5, 1.5], [1.5, 2.5]], computing eigenvalues and eigenvectors is instant — closed-form formulas exist for 2×2 matrices. For d parameters the Hessian has O(d²) entries. Computing its eigendecomposition naively costs O(d³) via QR iteration or Jacobi rotations. Inverting it costs O(d³). At d = 10⁴ (medium ML problem) you are doing ~10¹² operations; at d = 10⁶ (large network) ~10¹⁸; at d = 10¹¹ (GPT) ~10³³. Meanwhile, gradient computation for backprop is O(d), and so is matrix-vector multiplication. This is the fundamental asymmetry that pushed the entire field toward first-order methods in the 1980s and 90s. For research on small problems (≤10⁴ params) or special structures (Kronecker factorization, diagonal approximations) curvature methods remain competitive. For training modern networks they are luxuries.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `The Hessian is central to understanding optimization geometry. Li et al. (2018) used Hessian eigenvalues to show that skip connections in neural networks reduce the condition number (eccentricity), which is why they train faster. Practitioners use the safe learning rate rule lr < 2/λmax (the largest eigenvalue) to avoid instability. The condition number κ = λmax/λmin appears everywhere in optimization theory — it predicts how many steps gradient descent must take, and it motivates adaptive methods. In second-order optimization (rare in deep learning but common in classical statistics and control), you compute the Hessian or approximations to it. Bayesian neural networks use approximate Hessians for posterior uncertainty. Natural gradient descent replaces the identity learning-rate matrix with the Fisher information matrix (related to the Hessian). In robotics and trajectory optimization, where d is small (≤1000) and real-time is crucial, local quadratic models and Newton steps dominate. Any competent optimization textbook (Boyd & Vandenberghe, Nesterov, Nocedal) builds around the Hessian as the fundamental curvature object.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `First trap: "Saddle points are rare in high dimensions" is WRONG. In 1000 dimensions a random critical point has positive curvature in ~500 directions and negative in ~500, which is a saddle. As dimension grows, saddles are overwhelmingly common and minima are vanishingly rare. The Hessian's eigenvalue signs tell you which. Second trap: confusing the Hessian with the loss landscape's shape globally. The Hessian is LOCAL — it describes the landscape in a small neighborhood around the current point. Off that neighborhood the quadratic approximation f(w + δ) ≈ f(w) + ∇fᵀδ + ½δᵀHδ breaks down. A point can have a negative-definite Hessian (bowl shape locally) but be a saddle globally. Third trap: assuming a diagonal approximation (like Adam's per-coordinate scaling) captures all the geometry. If the true ravine is rotated 45° (the tilted bowl H = [[2.5, 1.5], [1.5, 2.5]]) a diagonal Hessian cannot see it — the eigenvectors are at ±45° but a diagonal matrix has eigenvectors along the axes. Fourth: "Newton's method is just steepest descent with a weird learning rate" is dangerously false. Newton solves the local quadratic model exactly; steepest descent is a pessimistic walk along the gradient. On a true quadratic Newton IS exact; on a nonlinear loss it is not exact but still quadratically convergent near the optimum (fast). Steepest descent is linear. Finally: Newton's Achilles heel is the computation of H and its inverse. Modern approximate-Newton methods sidestep this by never materializing H, but you must know the price you are paying in lost geometry.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with "Loss Landscapes from Above: Contour Maps" to see how contour rings encode the Hessian's eigenvalues and eigenvectors directly. Then read "Eigenvalues & Eigenvectors" to understand how to diagonalize a symmetric matrix and what the decomposition H = VΛVᵀ means geometrically. Review "Gradient Descent" and the safe learning rate rule lr < 2/λmax. Study "Momentum, RMSProp & Adam" to see how modern optimizers approximate the Hessian's inverse — Adam is a diagonal Newton, and that knowledge unlocks why certain landscapes trip it up. Finally, read "The Loss Landscape, in 3D" to see how Hessian geometry extends to realistic loss surfaces, which are rarely quadratic but are well-approximated by quadratics locally. These five topics together form the complete picture: the gradient tells you downhill; the Hessian tells you how steep the downhill is in every direction; and every optimizer is a strategy for trading Hessian information against computational cost.`,
      ],
    },
  ],
};

