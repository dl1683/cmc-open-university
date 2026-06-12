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
// eigenvectors along (1,1) and (1,−1).
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
    explanation: 'Take the matrix A = [[2,1],[1,2]] and feed it vectors. The x-axis vector (1,0) comes out as (2,1) — longer AND swung upward. The y-axis vector (0,1) comes out as (1,2) — swung the other way. This is what matrices DO: every direction gets some mix of stretching and turning, and SVD & Low-Rank Approximation showed the anatomy (rotate · stretch · rotate). The question this page asks is sharper: is there any direction the matrix refuses to turn — a vector that comes back pointing exactly where it pointed?',
  };

  const e1 = unit([1, 1]);
  const e2 = unit([1, -1]);
  yield {
    state: plotState({
      axes: AXES,
      vectors: [
        vec('eig1', 'v along (1,1)', e1),
        vec('Aeig1', 'Av = 3v — same direction!', apply(e1)),
        vec('eig2', 'v along (1,−1)', e2),
        vec('Aeig2', 'Av = 1v — untouched', apply(e2)),
      ],
    }),
    highlight: { found: ['eig1', 'Aeig1'], compare: ['eig2', 'Aeig2'] },
    explanation: 'Yes — two of them. The diagonal direction (1,1) comes back as exactly 3× itself: no turn, pure stretch. The anti-diagonal (1,−1) comes back as 1× itself — utterly ignored. These are the EIGENVECTORS (German "eigen": own, characteristic — the matrix\'s OWN directions), and the stretch factors 3 and 1 are the EIGENVALUES: Av = λv. Along these axes the matrix is just multiplication by a number — all its complexity is which directions it owns and how hard it stretches each. That pair of facts is the matrix\'s skeleton.',
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
      vectors: path.map((p, k) => vec(`it${k}`, k === 0 ? 'start (1,0)' : `after ×A ${k}: ${p.angle.toFixed(1)}°`, [p.v[0] * (1 + k * 0.12), p.v[1] * (1 + k * 0.12)])),
    }),
    highlight: { visited: ['it0', 'it1', 'it2'], found: ['it5'] },
    explanation: `How do you FIND the skeleton? The dumbest possible idea works: pick any vector and just keep applying A (re-normalizing so it doesn't blow up). Watch the fan — computed live: starting flat at 0°, one application swings to ${path[1].angle.toFixed(1)}°, then ${path[2].angle.toFixed(1)}°, ${path[3].angle.toFixed(1)}°, ${path[4].angle.toFixed(1)}°… homing in on the 45° eigenvector like a compass needle. This is POWER ITERATION — the same loop SVD & Low-Rank Approximation used to peel singular layers, and (spoiler for the next view) the same loop that ranks the web.`,
  };

  yield {
    state: matrixState({
      title: 'Why repetition finds the dominant direction',
      rows: [
        { id: 'decomp', label: 'any v = a·e₁ + b·e₂' },
        { id: 'once', label: 'apply A once' },
        { id: 'ntimes', label: 'apply A n times' },
        { id: 'limit', label: 'n = 10' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v2) => ['', 'every vector is a recipe of eigen-directions', 'A·v = 3a·e₁ + 1b·e₂ — each ingredient scales by ITS λ', 'Aⁿv = 3ⁿa·e₁ + 1ⁿb·e₂', '3¹⁰ = 59,049 vs 1¹⁰ = 1 — e₁ drowns out everything'][v2],
    }),
    highlight: { found: ['limit:what'] },
    explanation: 'The why, in one decomposition: write the starting vector as a mix of the eigen-directions, and each application of A multiplies every ingredient by its own eigenvalue. After n rounds the components stand in ratio λ₁ⁿ : λ₂ⁿ — here 3ⁿ to 1ⁿ — so the dominant eigenvector\'s share grows EXPONENTIALLY and everything else becomes rounding error. Convergence speed is set by the ratio λ₂/λ₁ (the spectral gap): a big gap snaps in a few iterations, a narrow one crawls. You have already lived this theorem twice: it is why Vanishing & Exploding Gradients compounds (a network layer applied repeatedly amplifies along its top direction), and it is the engine inside the next view\'s most famous algorithm.',
    invariant: 'Aⁿv → the dominant eigenvector: components scale as λⁿ, and the largest λ wins exponentially.',
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
      format: (v) => ['', 'covariance matrix\'s eigenvectors = the principal axes; eigenvalues = variance along each', 'singular values = √eigenvalues of AᵀA — the same skeleton for non-square matrices', 'a layer\'s top eigenvalue is its amplification factor: >1 compounds, <1 starves'][v],
    }),
    highlight: { compare: ['pcaRow:eig', 'svdRow:eig'] },
    explanation: 'Fields 2 and 3 — STATISTICS and DEEP LEARNING: PCA: Principal Component Analysis solved a 2×2 eigenproblem on a covariance matrix to find the data\'s natural axes (the eigenvalues WERE the explained variances), and SVD & Low-Rank Approximation generalized the same skeleton to any rectangular matrix. Meanwhile every stability argument on this site is secretly spectral: Vanishing & Exploding Gradients\' narrow corridor is the statement "keep every layer\'s top eigenvalue near 1," and Loss Landscapes & Optimization Geometry\'s sharp-vs-flat minima are described by the Hessian\'s eigenvalues — big λ means a steep, fragile direction.',
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
      heading: `What it is`,
      paragraphs: [
        `An eigenvector is a direction that a matrix refuses to rotate. When you apply the matrix to this special vector, it comes back pointing the same way — just stretched (or shrunk) by a single number called the eigenvalue. The equation Av = λv captures it all: matrix A times vector v equals the eigenvalue λ times that same vector. Most directions spin when a matrix hits them; these few are the matrix's skeleton — the directions it cannot help amplifying or dampening without turning.`,
        `Why call it "eigen"? German for "own" or "characteristic." These are the directions the matrix truly owns — the ones along which it is, mathematically, just multiplication by a number. Watch the demo: A = [[2,1],[1,2]] rotates the x-axis (1,0) into (2,1), spinning it upward. But along the diagonal (1,1), the matrix stretches to 3× without turning — that is an eigenvector with eigenvalue 3. Along the anti-diagonal (1,−1), the matrix leaves it untouched, scaling by 1 — another eigenvector, eigenvalue 1. These two directions contain all the matrix's essence.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Finding eigenvectors by solving det(A − λI) = 0 (the characteristic polynomial) is the textbook route, but for understanding, watch Power Iteration in the demo: pick any vector, apply the matrix repeatedly, and watch the angle converge to the dominant eigenvector. In the visualization, starting from (1,0), one application swings the vector to roughly 26.6°, then 38.7°, 42.9°… homing in on 45° (the (1,1) direction) like a compass needle. Why? Write your starting vector as a blend of the true eigenvectors: v = a·e₁ + b·e₂. Each application scales e₁ by 3 and e₂ by 1. After n iterations, you have 3ⁿa·e₁ + 1ⁿb·e₂. Since 3ⁿ grows and 1ⁿ stays flat, e₁ dominates exponentially — the starting angle dissolves into the dominant eigenvector's direction.`,
        `Convergence speed depends on the ratio λ₁/λ₂ (the spectral gap). Here, 3/1 = 3, so the gap is wide and convergence is quick. A narrow gap (λ₁ = 3, λ₂ = 2.9, ratio ≈ 1.03) crawls toward the answer over hundreds of iterations. This exponential amplification of the top eigenvalue is the engine of Vanishing & Exploding Gradients in neural networks: apply a layer repeatedly, and its top eigenvalue's power compounds, either exploding hidden states or starving them.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computing all eigenvalues and eigenvectors of an n×n matrix naively costs O(n³) using methods like QR iteration. Power iteration to find the dominant eigenvector costs O(n²) per iteration (one matrix–vector multiply) and converges in O(log(λ₁/λ₂)) iterations — very fast if the spectral gap is wide, slow if eigenvalues cluster. For a 1000×1000 matrix with wide gap, finding the top eigenvector typically needs 10–50 iterations, so seconds on a modern machine. Specialized algorithms (Lanczos, randomized SVD) cut this dramatically for large sparse matrices. Storage is O(n²) for the full matrix or O(nnz) for sparse formats.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PageRank IS power iteration: the web's link graph is a matrix, pages are components, links are entries. Running power iteration on the link matrix finds the steady importance distribution — the eigenvector. Importance flows along links, repeated until it stabilizes. The same fixed-point logic governs Markov chains' steady states: any "flow + repeat" system homes toward an eigenvector. PCA: Principal Component Analysis solves an eigenproblem on the data's covariance matrix to find the principal axes — the eigenvectors are directions of maximum variance, eigenvalues ARE the variances along each. SVD & Low-Rank Approximation uses the same idea: singular values are √(eigenvalues of AᵀA), and the economic decomposition peels away layers by spectral rank. In deep learning, a layer's amplification is its top eigenvalue: >1 explodes, <1 starves gradients over depth. Loss Landscapes & Optimization Geometry's sharpness/flatness distinction is the Hessian's spectral profile — sharp minima have large eigenvalues (fragile, steep), flat ones have small eigenvalues (robust, wide). Graph clustering uses the Laplacian matrix's small eigenvectors to partition networks. Vibration modes of bridges and buildings are eigenvectors of the stiffness matrix; resonance occurs when the driving frequency matches an eigenvalue. Quantum mechanics: energy levels are eigenvalues of the Hamiltonian — a postulate, not derived.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is confusing eigenvalues with eigenvectors. λ is a number (the stretch factor); v is a direction. Both matter — you cannot understand a system without both. Another trap: assuming Power Iteration finds the answer in "one iteration." It does not; it converges gradually, and the speed hinges on the spectral gap. A third: thinking all matrices have real eigenvectors. They do not. Complex matrices and even real non-symmetric matrices produce complex eigenvalues and eigenvectors — pure rotations, like a 90° clockwise map, have no real eigenvector at all (rotating any real direction, so nothing stays fixed). Finally, do not assume an eigenvector is unique: if v is an eigenvector, so is any scalar multiple cv. The direction is the thing; the length is free. Normalization (scaling to unit length) is a convention to pin down a canonical representative.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Eigenvectors are the hidden structure inside PCA: Principal Component Analysis, which finds the covariance matrix's eigenvectors to reduce data to its essential axes. They are also the machinery of SVD & Low-Rank Approximation, which generalizes the same skeleton to rectangular matrices. PageRank uses them to rank the web. Vanishing & Exploding Gradients is, mathematically, a warning about layer eigenvalues compounding over depth. Loss Landscapes & Optimization Geometry describes minima by the Hessian's eigenvalues. Together, these five topics are your roadmap to understanding where eigenvectors hide in modern computing.`,
      ],
    },
  ],
};
