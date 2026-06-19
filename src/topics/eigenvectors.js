// Eigenvectors: most directions get rotated when a matrix hits them — a
// special few only get STRETCHED. Those directions are the matrix's
// skeleton, and half of applied math is the art of finding them.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'eigenvectors',
  title: 'Eigenvalues & Eigenvectors',
  category: 'Concepts',
  summary: 'The directions a matrix refuses to rotate — found live by power iteration, and the skeleton under PageRank, PCA, and SVD.',
  controls: [
    { id: 'view', label: 'Find', type: 'select', options: ['the directions a matrix keeps', 'one equation, five fields'], defaultValue: 'the directions a matrix keeps' },
  ],
  run,
};

// A = [[2,1],[1,2]] — symmetric, eigenvalues 3 and 1,
// eigenvectors along (1,1) and (1,âˆ’1).
const A = [[2, 1], [1, 2]];
const apply = ([x, y]) => [A[0][0] * x + A[0][1] * y, A[1][0] * x + A[1][1] * y];
const norm = ([x, y]) => Math.hypot(x, y);
const unit = (v) => v.map((c) => c / norm(v));
const AXES = { x: { label: '', min: -0.5, max: 3.4 }, y: { label: '', min: -1.6, max: 3.2 } };
const vec = (id, label, to, from = { x: 0, y: 0 }) => ({ id, label, from, to: { x: to[0], y: to[1] } });

function* directions() {
  yield {
    state: plotState({
      axes: AXES,
      vectors: [
        vec('e1', 'v = (1,0)', [1, 0]),
        vec('Ae1', 'Av = (2,1) — rotated!', apply([1, 0])),
        vec('e2', 'v = (0,1)', [0, 1]),
        vec('Ae2', 'Av = (1,2) — rotated!', apply([0, 1])),
      ],
    }),
    highlight: { visited: ['e1', 'e2'], compare: ['Ae1', 'Ae2'] },
    explanation: 'Take the matrix A = [[2,1],[1,2]] and feed it vectors. The x-axis vector (1,0) comes out as (2,1) — longer AND swung upward. The y-axis vector (0,1) comes out as (1,2) — swung the other way. This is what matrices DO: every direction gets some mix of stretching and turning, and SVD & Low-Rank Approximation showed the anatomy (rotate Â· stretch Â· rotate). The question this page asks is sharper: is there any direction the matrix refuses to turn — a vector that comes back pointing exactly where it pointed?',
  };

  const e1 = unit([1, 1]);
  const e2 = unit([1, -1]);
  yield {
    state: plotState({
      axes: AXES,
      vectors: [
        vec('eig1', 'v along (1,1)', e1),
        vec('Aeig1', 'Av = 3v — same direction!', apply(e1)),
        vec('eig2', 'v along (1,âˆ’1)', e2),
        vec('Aeig2', 'Av = 1v — untouched', apply(e2)),
      ],
    }),
    highlight: { found: ['eig1', 'Aeig1'], compare: ['eig2', 'Aeig2'] },
    explanation: 'Yes — two of them. The diagonal direction (1,1) comes back as exactly 3Ã— itself: no turn, pure stretch. The anti-diagonal (1,âˆ’1) comes back as 1Ã— itself — utterly ignored. These are the EIGENVECTORS (German "eigen": own, characteristic — the matrix\'s OWN directions), and the stretch factors 3 and 1 are the EIGENVALUES: Av = λv. Along these axes the matrix is just multiplication by a number — all its complexity is which directions it owns and how hard it stretches each. That pair of facts is the matrix\'s skeleton.',
    invariant: 'Av = λv: along an eigenvector, a matrix acts as a single number.',
  };

  const path = [];
  let v = [1, 0];
  for (let k = 0; k < 6; k++) {
    path.push({ v: [...v], angle: (Math.atan2(v[1], v[0]) * 180) / Math.PI });
    v = unit(apply(v));
  }
  yield {
    state: plotState({
      axes: AXES,
      vectors: path.map((p, k) => vec(`it${k}`, k === 0 ? 'start (1,0)' : `after Ã—A ${k}: ${p.angle.toFixed(1)}°`, [p.v[0] * (1 + k * 0.12), p.v[1] * (1 + k * 0.12)])),
    }),
    highlight: { visited: ['it0', 'it1', 'it2'], found: ['it5'] },
    explanation: `How do you FIND the skeleton? The dumbest possible idea works: pick any vector and just keep applying A (re-normalizing so it doesn\'t blow up). Watch the fan — computed live: starting flat at 0°, one application swings to ${path[1].angle.toFixed(1)}°, then ${path[2].angle.toFixed(1)}°, ${path[3].angle.toFixed(1)}°, ${path[4].angle.toFixed(1)}°… homing in on the 45° eigenvector like a compass needle. This is POWER ITERATION — the same loop SVD & Low-Rank Approximation used to peel singular layers, and (spoiler for the next view) the same loop that ranks the web.`,
  };

  yield {
    state: matrixState({
      title: 'Why repetition finds the dominant direction',
      rows: [
        { id: 'decomp', label: 'any v = aÂ·eâ‚ + bÂ·eâ‚‚' },
        { id: 'once', label: 'apply A once' },
        { id: 'ntimes', label: 'apply A n times' },
        { id: 'limit', label: 'n = 10' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v2) => ['', 'every vector is a recipe of eigen-directions', 'AÂ·v = 3aÂ·eâ‚ + 1bÂ·eâ‚‚ — each ingredient scales by ITS λ', 'Aⁿv = 3ⁿaÂ·eâ‚ + 1ⁿbÂ·eâ‚‚', '3Â¹⁰ = 59,049 vs 1Â¹⁰ = 1 — eâ‚ drowns out everything'][v2],
    }),
    highlight: { found: ['limit:what'] },
    explanation: 'The why, in one decomposition: write the starting vector as a mix of the eigen-directions, and each application of A multiplies every ingredient by its own eigenvalue. After n rounds the components stand in ratio λâ‚ⁿ : λâ‚‚ⁿ — here 3ⁿ to 1ⁿ — so the dominant eigenvector\'s share grows EXPONENTIALLY and everything else becomes rounding error. Convergence speed is set by the ratio λâ‚‚/λâ‚ (the spectral gap): a big gap snaps in a few iterations, a narrow one crawls. You have already lived this theorem twice: it is why Vanishing & Exploding Gradients compounds (a network layer applied repeatedly amplifies along its top direction), and it is the engine inside the next view\'s most famous algorithm.',
    invariant: 'Aⁿv â†’ the dominant eigenvector: components scale as λⁿ, and the largest λ wins exponentially.',
  };
}

function* fiveFields() {
  yield {
    state: matrixState({
      title: 'PageRank IS power iteration',
      rows: [
        { id: 'matrix', label: 'the matrix' },
        { id: 'vector', label: 'the vector' },
        { id: 'iterate', label: 'the loop' },
        { id: 'answer', label: 'the eigenvector' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'the web\'s link structure (who links to whom)', 'every page\'s current importance score', 'importance flows along links, again and again', 'the steady scores — the ranking itself'][v],
    }),
    highlight: { found: ['answer:what'] },
    explanation: 'Field 1 — SEARCH: PageRank (Google\'s Algorithm) is, mathematically, nothing but the power iteration you just watched, run on a matrix with billions of rows: importance flows along links, the flow is repeated until it stops changing, and the resting distribution — the dominant eigenvector of the link matrix — is the ranking. The same fixed-point logic gives Markov chains their steady states: the long-run behavior of any "flow + repeat" system is an eigenvector wearing a probability costume.',
  };

  yield {
    state: matrixState({
      title: 'Statistics & geometry: the axes data actually uses',
      rows: [
        { id: 'pcaRow', label: 'PCA' },
        { id: 'svdRow', label: 'SVD' },
        { id: 'stab', label: 'stability / gradients' },
      ],
      columns: [{ id: 'eig', label: 'the eigen-story' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'covariance matrix\'s eigenvectors = the principal axes; eigenvalues = variance along each', 'singular values = âˆšeigenvalues of Aáµ€A — the same skeleton for non-square matrices', 'a layer\'s top eigenvalue is its amplification factor: >1 compounds, <1 starves'][v],
    }),
    highlight: { compare: ['pcaRow:eig', 'svdRow:eig'] },
    explanation: 'Fields 2 and 3 — STATISTICS and DEEP LEARNING: PCA: Principal Component Analysis solved a 2Ã—2 eigenproblem on a covariance matrix to find the data\'s natural axes (the eigenvalues WERE the explained variances), and SVD & Low-Rank Approximation generalized the same skeleton to any rectangular matrix. Meanwhile every stability argument on this site is secretly spectral: Vanishing & Exploding Gradients\' narrow corridor is the statement "keep every layer\'s top eigenvalue near 1," and Loss Landscapes & Optimization Geometry\'s sharp-vs-flat minima are described by the Hessian\'s eigenvalues — big λ means a steep, fragile direction.',
  };

  yield {
    state: matrixState({
      title: 'One equation, five fields',
      rows: [
        { id: 'web', label: 'web search' },
        { id: 'stats', label: 'statistics' },
        { id: 'dl', label: 'deep learning' },
        { id: 'graphs', label: 'graph clustering' },
        { id: 'physics', label: 'physics & engineering' },
      ],
      columns: [{ id: 'guise', label: 'Av = λv, in disguise' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'PageRank: the web\'s steady importance flow', 'principal components: directions of variance', 'layer amplification, Hessian curvature, attention spectra', 'graph Laplacian eigenvectors cut communities apart', 'vibration modes, resonance, quantum energy levels'][v],
    }),
    highlight: { active: ['physics:guise'] },
    explanation: 'The census. Spectral graph clustering cuts social networks along the Laplacian\'s small eigenvectors; bridges and buildings are certified safe by computing their vibration modes — eigenvectors of a stiffness matrix — and keeping resonant eigenvalues away from earthquake frequencies; quantum mechanics\' energy levels ARE eigenvalues, by postulate. One equation, five fields, a century of mileage. The unifying intuition to carry out the door: whenever a system FLOWS, REPEATS, or OSCILLATES, its long-run behavior is governed not by everything it could do, but by a handful of directions it cannot help returning to — find the eigenvectors, and you have found the system\'s habits.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the directions a matrix keeps') yield* directions();
  else if (view === 'one equation, five fields') yield* fiveFields();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view shows four arrows: two input vectors and two outputs after multiplying by A = [[2,1],[1,2]]. Visited arrows are directions that got rotated -- they are not eigenvectors. Found arrows are directions that stayed on their original line -- those are eigenvectors, and their stretch factor is the eigenvalue.',
        'The power-iteration view shows a fan of arrows. Each arrow is the result of one more multiply-and-normalize step. The fan converges toward 45 degrees because the dominant eigenvalue (3) amplifies its component faster than the subdominant (1). The final arrow, marked found, is the dominant eigenvector.',
        'The five-fields view shows a table. Each row is the same equation Av = lambda v wearing a different costume: web ranking, statistics, deep learning, graph clustering, physics. Read it as a census of where eigenvectors appear, not as separate algorithms.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A matrix is a rule that moves vectors. It may stretch, rotate, shear, or reflect them. Reading the entries of the matrix does not reveal which directions the transformation cares about. Two matrices with different entries can have the same eigenvectors and differ only in how hard they stretch each one.',
        'Eigenvectors are the directions a matrix refuses to rotate. Along an eigenvector, the matrix acts as multiplication by a single number -- the eigenvalue. The equation is Av = lambda v: input direction equals output direction, scaled by lambda.',
        'Euler studied these invariant directions for rotations of rigid bodies in the 1750s. Cauchy gave the first general theory of the characteristic equation in 1829, proving that every real symmetric matrix has real eigenvalues. Hilbert extended the idea to infinite-dimensional operators in 1904, opening the door to quantum mechanics and functional analysis. The word "eigen" is German for "own" or "characteristic" -- these are the matrix\'s own directions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'To understand what a matrix does, multiply it by several vectors and look at the outputs. Start with the coordinate axes: feed in (1,0) and (0,1). For a diagonal matrix this works immediately -- each axis stays on its line and the diagonal entries are the eigenvalues.',
        'For a general matrix, try random directions. Plot input and output arrows side by side. Some outputs land far from their inputs, some land close. With enough samples you might notice a pattern in which directions get rotated less.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Random vectors get both stretched and rotated, and the mixture obscures the pattern. For A = [[2,1],[1,2]], the x-axis vector (1,0) becomes (2,1) -- longer and swung upward by about 26 degrees. The y-axis vector (0,1) becomes (1,2) -- swung the other way. Neither standard axis survived.',
        'Trying more random vectors does not help systematically. You need directions that experience only scaling, no rotation. Those directions are not obvious from the matrix entries, and there is no shortcut that avoids solving an equation. The question is: which directions v satisfy Av = lambda v for some scalar lambda?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The defining equation Av = lambda v rearranges to (A - lambda I)v = 0. For a nonzero v to exist, the matrix (A - lambda I) must be singular, which means det(A - lambda I) = 0. This is the characteristic equation -- a polynomial of degree n in lambda whose roots are the eigenvalues.',
        'For A = [[2,1],[1,2]]: det([[2-lambda, 1],[1, 2-lambda]]) = (2-lambda)^2 - 1 = lambda^2 - 4lambda + 3 = (lambda-3)(lambda-1) = 0. The eigenvalues are lambda = 3 and lambda = 1.',
        'For each eigenvalue, solve (A - lambda I)v = 0 for the eigenvector. For lambda = 3: (A - 3I) = [[-1,1],[1,-1]], so v = (1,1). For lambda = 1: (A - I) = [[1,1],[1,1]], so v = (1,-1). Check: A(1,1) = (3,3) = 3(1,1). A(1,-1) = (1,-1) = 1(1,-1).',
        'Power iteration finds the dominant eigenvector without solving the polynomial. Start with any nonzero vector, repeatedly multiply by A and normalize. The dominant eigenvalue\'s component grows exponentially relative to all others, so the vector converges to the dominant eigenvector. Each step costs one matrix-vector multiply.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'If the matrix has a full set of eigenvectors, any starting vector v decomposes as v = a1*e1 + a2*e2 + ... + an*en, where each ei is an eigenvector. Multiplying by A scales each component by its eigenvalue: Av = lambda1*a1*e1 + lambda2*a2*e2 + ... After k multiplications, the coefficients become lambda1^k*a1, lambda2^k*a2, and so on.',
        'If |lambda1| > |lambda2| >= ... >= |lambdan|, then lambda1^k dominates all other terms exponentially. After normalization, the vector points along e1. The convergence rate depends on the spectral gap |lambda2/lambda1|: a ratio of 1/3 (as in this demo) means each iteration triples the dominance of e1 over e2. Ten iterations give a ratio of 3^10 = 59,049 to 1.',
        'Eigenvectors of a symmetric matrix are orthogonal. This is not a coincidence -- it follows from the identity (Av)^T w = v^T (A^T w), which for symmetric A gives lambda_i (v_i^T v_j) = lambda_j (v_i^T v_j). When lambda_i differs from lambda_j, the inner product must be zero.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Finding all eigenvalues of a dense n-by-n matrix via the QR algorithm costs O(n^3) time and O(n^2) space. The characteristic polynomial is never solved directly for n > 4 because root-finding on high-degree polynomials is numerically unstable.',
        'Power iteration costs O(n^2) per step for a dense matrix (one matrix-vector multiply) or O(nnz) for a sparse matrix with nnz nonzero entries. The number of iterations depends on the spectral gap: a gap of |lambda2/lambda1| = 0.9 needs about 44 iterations for 4 digits of accuracy (since 0.9^44 is approximately 0.01), while a gap of 1/3 needs only 9.',
        'Lanczos iteration (symmetric) and Arnoldi iteration (general) find the top k eigenvalues in O(k * nnz) time for sparse matrices, making them practical for matrices with millions of rows -- the scale needed for PageRank and spectral graph clustering.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'PCA computes the top k eigenvectors of a data covariance matrix. Each eigenvector is a direction of maximum remaining variance; the eigenvalue is the variance explained. Projecting data onto k eigenvectors compresses n features to k while losing the least information in a squared-error sense.',
        'Google PageRank is the dominant eigenvector of the web\'s link matrix (with damping). Importance flows along links; power iteration runs until the scores stabilize. The stationary distribution of any ergodic Markov chain is an eigenvector of its transition matrix with eigenvalue 1.',
        'Quantum mechanics postulates that measurable quantities (energy, momentum, spin) are eigenvalues of Hermitian operators. The hydrogen atom\'s energy levels are eigenvalues of the Hamiltonian. Measurement collapses the state onto the corresponding eigenvector.',
        'Vibration analysis models a bridge or building as a mass-spring system. The natural frequencies are square roots of the eigenvalues of the stiffness-over-mass matrix. Engineers keep these frequencies away from earthquake or wind frequencies to prevent resonance.',
        'Eigenfaces (Turk and Pentland, 1991) treated face images as high-dimensional vectors, computed the covariance matrix\'s top eigenvectors, and projected faces onto that basis for recognition. This was PCA applied to pixel space -- each eigenface captures a mode of variation across the training set.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Non-symmetric matrices can have complex eigenvalues. A 90-degree rotation matrix [[0,-1],[1,0]] has eigenvalues i and -i -- no real direction stays on its line. Power iteration on such a matrix oscillates instead of converging.',
        'Degenerate eigenvalues (algebraic multiplicity greater than 1) may not have enough independent eigenvectors. The matrix [[1,1],[0,1]] has eigenvalue 1 with multiplicity 2, but only one eigenvector direction. Such defective matrices cannot be diagonalized; they require Jordan normal form.',
        'Numerical instability is a practical hazard. Matrices with eigenvalues very close together make the characteristic polynomial ill-conditioned: small changes in entries produce large changes in eigenvalues. The QR algorithm handles this by never forming the characteristic polynomial, but even QR can struggle with near-singular or highly non-normal matrices.',
        'Eigendecomposition does not exist for all matrices, and even when it does, it may not be the right tool. SVD works for every real matrix (including non-square ones) and decomposes the input-output stretching even when eigenvectors are awkward. For many applications, SVD is the safer default.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Matrix: A = [[2,1],[1,2]]. Characteristic equation: (2-lambda)^2 - 1 = 0, so lambda^2 - 4lambda + 3 = 0. Roots: lambda = 3 and lambda = 1.',
        'Eigenvector for lambda = 3: solve (A - 3I)v = 0. A - 3I = [[-1,1],[1,-1]]. First row gives -v1 + v2 = 0, so v = (1,1). Verify: A(1,1) = (2+1, 1+2) = (3,3) = 3(1,1).',
        'Eigenvector for lambda = 1: solve (A - I)v = 0. A - I = [[1,1],[1,1]]. First row gives v1 + v2 = 0, so v = (1,-1). Verify: A(1,-1) = (2-1, 1-2) = (1,-1) = 1(1,-1).',
        'Power iteration from v0 = (1,0): decompose as 0.5(1,1) + 0.5(1,-1). After one step: A*v0 = (2,1); normalized: (0.894, 0.447), angle 26.6 degrees. After six steps the angle is within 0.1 degrees of 45 degrees. After ten steps the lambda=3 component is 59,049 times larger than the lambda=1 component before normalization.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Gilbert Strang, "Linear Algebra and Its Applications" (4th ed., 2006) -- chapters 5-6 cover eigenvalues, diagonalization, and positive definite matrices with geometric intuition throughout. Gene Golub and Charles Van Loan, "Matrix Computations" (4th ed., 2013) -- the reference for QR, Lanczos, Arnoldi, and all numerical eigenvalue algorithms. Turk and Pentland, "Eigenfaces for Recognition" (Journal of Cognitive Neuroscience, 1991) -- the canonical application of PCA to face recognition.',
        'Prerequisite: study Matrix Multiplication and Linear Transformations if matrix-vector products still feel abstract. Extension: study SVD and Low-Rank Approximation for the generalization that works on non-square and non-symmetric matrices. Applications: study PCA for covariance eigenvectors in statistics, PageRank for power iteration at web scale, and Markov Chains and Steady States for eigenvector fixed points. For eigenvalues in optimization: study Loss Landscapes and Optimization Geometry, The Hessian, Vanishing and Exploding Gradients, and Natural Gradient and Fisher Information.',
      ],
    },
  ],
};

