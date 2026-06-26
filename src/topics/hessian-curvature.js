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
        'Contours are equal-loss curves. Round contours mean similar curvature in every direction, while long ellipses mean one direction is steep and another is flat. The Hessian is the matrix of second derivatives that gives those curvatures numerically.',
        {type: 'callout', text: 'The Hessian turns local geometry into algebra: eigenvalue signs classify the point, and eigenvalue ratios set optimizer pain.'},
        {type: 'image', src: './assets/gifs/hessian-curvature.gif', alt: 'Animated walkthrough of the hessian curvature visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The gradient tells which way decreases a function, but not how sharply the function bends. Optimizers need curvature to choose step sizes, detect saddles, and avoid zigzagging through ravines. The Hessian exists to describe that local bending.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Gradient_descent.svg/250px-Gradient_descent.svg.png', alt: 'Contour plot showing gradient descent steps toward a minimum', caption: 'Gradient descent uses slope, while Hessian-aware methods also read local curvature. Source: Wikimedia Commons, Gradient descent.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious optimizer is gradient descent with a fixed learning rate. It works on a round bowl because every direction has similar curvature. On f(x,y)=0.5*(x^2+y^2), learning rate 0.5 halves both coordinates each step.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is uneven curvature. On f(x,y)=0.5*(x^2+100*y^2), the y direction is 100 times steeper than x. A learning rate safe for y crawls along x, while a learning rate useful for x overshoots y.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Saddle_point.svg/330px-Saddle_point.svg.png', alt: 'Three-dimensional surface with a saddle point', caption: 'Mixed curvature around a saddle explains why a small gradient can still hide an escape direction. Source: Wikimedia Commons, Saddle point.'},
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Near a point, a smooth function behaves like a quadratic: f(w+d) is about f(w)+grad^T d+0.5*d^T H*d. Eigenvectors of H give the principal curvature directions. Eigenvalues say whether those directions curve up, down, or almost flat.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For two variables, the Hessian contains f_xx, f_xy, f_yx, and f_yy. Smooth Hessians are symmetric, so they have real eigenvalues and orthogonal eigenvectors. Newton solves H*d = -grad and steps by d.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/Finite_element_sparse_matrix.png', alt: 'Sparse matrix pattern from a finite element computation', caption: 'Large Hessians are often handled through sparse or implicit matrix structure rather than dense storage. Source: Wikimedia Commons, finite element sparse matrix.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'On a true quadratic, Newton is exact. If grad = H*w + b and H*d = -grad, then the next point has gradient zero. Eigenvalue signs classify critical points: all positive means local minimum, all negative means maximum, and mixed signs mean saddle.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For d parameters, the full Hessian has d^2 entries and exact inversion costs about O(d^3). At d=1,000,000, storage alone is 10^12 numbers, about 8 terabytes in float64. Hessian-vector products avoid storage but still cost extra derivative work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Newton, quasi-Newton, and trust-region methods are standard for many medium-size optimization problems. Deep learning often uses Hessian ideas indirectly through learning-rate bounds, sharpness analysis, K-FAC, L-BFGS, and Hessian-free methods.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The Hessian is local, so one step away the quadratic model can be wrong. It can also be indefinite at saddles or too large to store. Practical methods use damping, trust regions, low-rank sketches, diagonal approximations, or Hessian-vector products.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For f(x,y)=0.5*(x^2+100*y^2), H=[[1,0],[0,100]]. At (10,1), grad=(10,100). Gradient descent with learning rate 0.01 moves to (9.9,0), fixing y but barely moving x.',
        'Newton solves H*d=-grad, so d=(-10,-1). The next point is (0,0), the exact minimum. The example shows why curvature can remove zigzagging, and why computing curvature is the expensive part.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Nocedal and Wright for Newton and quasi-Newton methods, Martens for Hessian-free optimization, and Dauphin et al. for saddle points in high-dimensional learning. Study gradients, eigenvalues, quadratic forms, condition numbers, L-BFGS, and automatic differentiation next.',
      ],
    },
  ],
};
