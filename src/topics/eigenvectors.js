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
        `An eigenvector is a direction a matrix does not turn. Apply the matrix and the vector comes back on the same line, only scaled by an eigenvalue: Av = lambda v. The visualization uses A = [[2,1],[1,2]]. The x-axis and y-axis rotate, but the diagonal (1,1) stretches by 3 and the anti-diagonal (1,-1) stretches by 1. Those two directions are the matrix's skeleton.`,
        `SVD & Low-Rank Approximation gives every matrix a rotate-stretch-rotate anatomy. Eigenvalues & Eigenvectors is the square-matrix version where some directions are preserved exactly.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The demo finds the dominant eigenvector by power iteration. Start with (1,0), apply A, normalize, and repeat. The angle moves from 0 degrees toward 45 degrees: roughly 26.6, 38.7, 42.9, and then closer. The reason is decomposition. Any starting vector is a mix of eigen-directions; each multiplication scales each ingredient by its eigenvalue, so the lambda = 3 component overwhelms the lambda = 1 component exponentially.`,
        `Convergence speed depends on the ratio |lambda2/lambda1|, often called the spectral gap story. A small ratio converges fast; a ratio near 1 crawls. This is the same compounding intuition behind Vanishing & Exploding Gradients, where repeated layers amplify or damp directions.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Dense all-eigenvalue algorithms such as QR are O(n^3). Power iteration for one dominant direction costs one matrix-vector multiply per step: O(n^2) for dense matrices and O(nnz) for sparse ones. It needs a unique dominant eigenvalue and a starting vector with some component in that direction; ties or near-ties make convergence ambiguous or slow.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PageRank is power iteration on the web graph: importance flows until it reaches a steady eigenvector. Markov Chains & Steady States uses the same fixed-point idea for probabilities. PCA: Principal Component Analysis finds eigenvectors of a covariance matrix; the eigenvalues are variances. The Hessian: Curvature & Newton's Step reads eigenvalues as curvature directions, and Natural Gradient & Fisher Information changes the metric when Euclidean directions mislead.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Eigenvalues are numbers; eigenvectors are directions. Scaling an eigenvector does not make a new direction, so normalizing is just a convention. Not every real matrix has real eigenvectors: a pure 90-degree rotation has complex eigenvalues because every real direction turns. Also, "dominant" means largest magnitude, not largest signed value; a negative eigenvalue flips direction while scaling.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study PCA: Principal Component Analysis for covariance eigenvectors, SVD & Low-Rank Approximation for rectangular matrices, and PageRank for the billion-node power-iteration story. Then read Loss Landscapes & Optimization Geometry and The Hessian: Curvature & Newton's Step to see eigenvalues become the language of sharp and flat directions.`,
      ],
    },
  ],
};
