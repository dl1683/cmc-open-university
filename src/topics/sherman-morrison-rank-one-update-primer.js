// Sherman-Morrison rank-one update: update an inverse after one outer-product
// change instead of recomputing the inverse from scratch.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sherman-morrison-rank-one-update-primer',
  title: 'Sherman-Morrison Rank-One Update Primer',
  category: 'Concepts',
  summary: 'A visual primer on low-rank inverse updates: outer products, the denominator guard, O(n^2) inverse corrections, and online least-squares state.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['inverse update', 'online least squares'], defaultValue: 'inverse update' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function streamGraph(title) {
  return graphState({
    nodes: [
      { id: 'row', label: 'row x', x: 0.6, y: 3.4, note: 'new obs' },
      { id: 'outer', label: 'x xT', x: 2.1, y: 3.4, note: 'rank 1' },
      { id: 'A', label: 'A', x: 3.6, y: 2.0, note: 'normal' },
      { id: 'P', label: 'P', x: 3.6, y: 4.8, note: 'inverse' },
      { id: 'b', label: 'b', x: 5.0, y: 2.0, note: 'r x' },
      { id: 'theta', label: 'theta', x: 6.4, y: 3.4, note: 'P b' },
      { id: 'score', label: 'score', x: 7.8, y: 3.4, note: 'predict' },
      { id: 'guard', label: 'guard', x: 5.0, y: 4.8, note: 'denom' },
      { id: 'refit', label: 'refit', x: 9.0, y: 4.8, note: 'fallback' },
    ],
    edges: [
      { id: 'e-row-outer', from: 'row', to: 'outer' },
      { id: 'e-outer-A', from: 'outer', to: 'A' },
      { id: 'e-outer-P', from: 'outer', to: 'P' },
      { id: 'e-row-b', from: 'row', to: 'b' },
      { id: 'e-P-theta', from: 'P', to: 'theta' },
      { id: 'e-b-theta', from: 'b', to: 'theta' },
      { id: 'e-theta-score', from: 'theta', to: 'score' },
      { id: 'e-P-guard', from: 'P', to: 'guard' },
      { id: 'e-guard-refit', from: 'guard', to: 'refit' },
    ],
  }, { title });
}

function* inverseUpdate() {
  yield {
    state: labelMatrix(
      'The identity in four pieces',
      [
        { id: 'old', label: 'old inverse' },
        { id: 'change', label: 'change' },
        { id: 'guard', label: 'guard' },
        { id: 'new', label: 'new inverse' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['A^-1 known', 'saved work'],
        ['u vT', 'rank 1'],
        ['1+vT A^-1 u', 'nonzero'],
        ['A^-1-corr', 'O(n^2)'],
      ],
    ),
    highlight: { active: ['change:meaning', 'guard:meaning', 'new:cost'] },
    explanation: 'Sherman-Morrison answers a narrow but powerful question: if you already know A inverse, and A changes by one outer product u vT, can you update the inverse without doing a fresh O(n^3) inversion? Yes, if the denominator 1 + vT A^-1 u is not zero.',
    invariant: '(A + u vT)^-1 = A^-1 - (A^-1 u vT A^-1) / (1 + vT A^-1 u).',
  };

  yield {
    state: labelMatrix(
      'Why u vT is rank one',
      [
        { id: 'u1', label: 'row 1' },
        { id: 'u2', label: 'row 2' },
        { id: 'u3', label: 'row 3' },
      ],
      [
        { id: 'c1', label: 'col 1' },
        { id: 'c2', label: 'col 2' },
        { id: 'c3', label: 'col 3' },
      ],
      [
        ['u1 v1', 'u1 v2', 'u1 v3'],
        ['u2 v1', 'u2 v2', 'u2 v3'],
        ['u3 v1', 'u3 v2', 'u3 v3'],
      ],
    ),
    highlight: { active: ['u1:c1', 'u2:c2', 'u3:c3'], compare: ['u2:c1', 'u3:c2'] },
    explanation: 'An outer product makes every row a scaled copy of the same vector v. That means the change has only one direction of new information. Sherman-Morrison exploits exactly that: do not recompute a full inverse when the update only bends the matrix in one direction.',
  };

  yield {
    state: labelMatrix(
      'Worked 2 by 2 update',
      [
        { id: 'old', label: 'A^-1' },
        { id: 'left', label: 'A^-1 u' },
        { id: 'right', label: 'vT A^-1' },
        { id: 'denom', label: 'denom' },
        { id: 'final', label: 'new inv' },
      ],
      [
        { id: 'part1', label: 'part 1' },
        { id: 'part2', label: 'part 2' },
      ],
      [
        ['[.4,-.2]', '[-.2,.6]'],
        ['[0,1]', 'column'],
        ['[.6,.2]', 'row'],
        ['1+1', '=2'],
        ['[.4,-.2]', '[-.5,.5]'],
      ],
    ),
    highlight: { active: ['left:part1', 'right:part1', 'denom:part1', 'final:part2'] },
    explanation: 'Example: A = [[3,1],[1,2]], u = [1,2], v = [2,1]. The old inverse is known. The formula builds one correction from A^-1 u, vT A^-1, and the scalar denominator. The result matches the direct inverse of A + u vT = [[5,2],[5,4]], but it reuses the old inverse.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'matrix dimension n', min: 0, max: 1000 }, y: { label: 'relative work', min: 0, max: 1000 } },
      series: [
        { id: 'fresh', label: 'fresh inv', points: [{ x: 10, y: 0.001 }, { x: 100, y: 1 }, { x: 500, y: 125 }, { x: 1000, y: 1000 }] },
        { id: 'update', label: 'rank update', points: [{ x: 10, y: 0.001 }, { x: 100, y: 0.01 }, { x: 500, y: 0.25 }, { x: 1000, y: 1 }] },
      ],
      markers: [
        { id: 'gap', x: 1000, y: 1, label: 'O(n^2)' },
      ],
    }),
    highlight: { active: ['update', 'gap'], compare: ['fresh'] },
    explanation: 'The reason this identity matters is the exponent. A fresh dense inverse is cubic. A rank-one inverse correction is quadratic once the old inverse is already available. For streaming or repeated small edits, that difference is the whole system design.',
  };

  yield {
    state: labelMatrix(
      'Denominator guard',
      [
        { id: 'healthy', label: 'healthy' },
        { id: 'small', label: 'small' },
        { id: 'zero', label: 'zero' },
        { id: 'drift', label: 'drift' },
      ],
      [
        { id: 'denom', label: 'denom' },
        { id: 'action', label: 'action' },
      ],
      [
        ['far from 0', 'update'],
        ['near 0', 'warn'],
        ['= 0', 'singular'],
        ['roundoff', 'refactor'],
      ],
    ),
    highlight: { active: ['healthy:action'], compare: ['small:action'], removed: ['zero:action'] },
    explanation: 'The formula is algebraically exact, but numerics still matter. A tiny denominator creates a huge correction. Long streams can accumulate roundoff. Serious systems monitor the denominator and condition number, then periodically rebuild the inverse with a stable factorization such as Cholesky or QR.',
  };

  yield {
    state: labelMatrix(
      'Where it shows up',
      [
        { id: 'rls', label: 'RLS' },
        { id: 'bandit', label: 'LinUCB' },
        { id: 'kalman', label: 'Kalman' },
        { id: 'gp', label: 'GP' },
        { id: 'sens', label: 'sensitivity' },
      ],
      [
        { id: 'matrix', label: 'matrix' },
        { id: 'update', label: 'update' },
      ],
      [
        ['XTX', 'new row'],
        ['A_a', 'x xT'],
        ['covariance', 'obs'],
        ['kernel', 'new point'],
        ['system A', 'small edit'],
      ],
    ),
    highlight: { active: ['rls:update', 'bandit:update'], compare: ['kalman:update', 'gp:update'] },
    explanation: 'The same low-rank inverse trick appears anywhere evidence arrives incrementally: recursive least squares, LinUCB, Kalman-style covariance updates, Gaussian process updates, and sensitivity analysis for systems with small matrix changes.',
  };
}

function* onlineLeastSquares() {
  yield {
    state: streamGraph('Streaming ridge state'),
    highlight: { active: ['row', 'outer', 'A', 'P', 'b', 'theta', 'score'], compare: ['guard', 'refit'] },
    explanation: 'Online least squares keeps A = lambda I + sum x xT, b = sum r x, and P = A inverse. Each new row adds one outer product to A and one reward-weighted vector to b. Sherman-Morrison updates P in place so theta = P b stays cheap.',
    invariant: 'A new training row is a rank-one change to the normal matrix.',
  };

  yield {
    state: labelMatrix(
      'Recursive least-squares update',
      [
        { id: 'observe', label: 'observe' },
        { id: 'gain', label: 'gain' },
        { id: 'inv', label: 'P update' },
        { id: 'target', label: 'b update' },
        { id: 'coef', label: 'theta' },
      ],
      [
        { id: 'formula', label: 'formula' },
        { id: 'role', label: 'role' },
      ],
      [
        ['x,r', 'new row'],
        ['P x / denom', 'trust'],
        ['P - gain xT P', 'shrink'],
        ['b + r x', 'reward'],
        ['P b', 'weights'],
      ],
    ),
    highlight: { active: ['gain:formula', 'inv:formula', 'coef:formula'] },
    explanation: 'Recursive least squares is Sherman-Morrison wearing regression clothing. The gain vector says how strongly the new row should change the inverse state. Directions already well covered get small updates; genuinely new directions reshape P more.',
  };

  yield {
    state: labelMatrix(
      'LinUCB connection',
      [
        { id: 'A', label: 'A_a' },
        { id: 'P', label: 'P_a' },
        { id: 'b', label: 'b_a' },
        { id: 'mean', label: 'mean' },
        { id: 'bonus', label: 'bonus' },
      ],
      [
        { id: 'what', label: 'what' },
        { id: 'why', label: 'why' },
      ],
      [
        ['sum x xT', 'evidence'],
        ['A^-1', 'fast score'],
        ['sum r x', 'reward'],
        ['xT P b', 'exploit'],
        ['sqrt xT P x', 'explore'],
      ],
    ),
    highlight: { active: ['P:what', 'mean:what', 'bonus:what'], compare: ['A:why'] },
    explanation: 'LinUCB Personalized News Case Study uses exactly this state per action. Updating P_a with a rank-one correction keeps both the mean estimate and the confidence bonus available without solving a fresh linear system for every request.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'stream rows processed', min: 0, max: 100000 }, y: { label: 'cost per row', min: 0, max: 100 } },
      series: [
        { id: 'solve', label: 'fresh solve', points: [{ x: 0, y: 80 }, { x: 1000, y: 80 }, { x: 10000, y: 80 }, { x: 100000, y: 80 }] },
        { id: 'sm', label: 'SM update', points: [{ x: 0, y: 5 }, { x: 1000, y: 5 }, { x: 10000, y: 5 }, { x: 100000, y: 5 }] },
        { id: 'refit', label: 'refactor', points: [{ x: 0, y: 20 }, { x: 1000, y: 5 }, { x: 10000, y: 5 }, { x: 100000, y: 20 }] },
      ],
      markers: [
        { id: 'audit', x: 100000, y: 20, label: 'audit' },
      ],
    }),
    highlight: { active: ['sm'], compare: ['solve', 'refit', 'audit'] },
    explanation: 'A practical system usually mixes fast updates with periodic refactors. Use Sherman-Morrison for the hot path, then rebuild from a stable factorization on a schedule or when numerical guards look bad. That gives speed without trusting an infinite chain of floating-point corrections.',
  };

  yield {
    state: labelMatrix(
      'When not to use it blindly',
      [
        { id: 'ill', label: 'ill-cond' },
        { id: 'many', label: 'many ranks' },
        { id: 'sparse', label: 'sparse A' },
        { id: 'gpu', label: 'GPU batch' },
        { id: 'audit', label: 'audits' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'move', label: 'move' },
      ],
      [
        ['roundoff', 'factorize'],
        ['rank k', 'Woodbury'],
        ['fill-in', 'sparse sol'],
        ['tiny batch', 'BLAS solve'],
        ['silent drift', 'residual'],
      ],
    ),
    highlight: { active: ['ill:move', 'audit:move'], compare: ['many:move', 'sparse:move'] },
    explanation: 'The identity is not a blanket instruction to maintain explicit inverses forever. Sparse matrices may lose sparsity. Large rank-k changes belong to Woodbury or a refactor. Batched hardware can make a direct solve cheaper. Always check residuals and conditioning.',
  };

  yield {
    state: streamGraph('Case study: online regression service'),
    highlight: { active: ['row', 'P', 'theta', 'score', 'guard', 'refit'], found: ['refit'] },
    explanation: 'A pricing or calibration service can keep a ridge model fresh as examples stream in. The hot path updates the inverse in O(n^2), predictions use the current theta, and a background job periodically reconstructs A and P from replayable logs to catch drift.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'inverse update') yield* inverseUpdate();
  else if (view === 'online least squares') yield* onlineLeastSquares();
  else throw new InputError('Pick a Sherman-Morrison view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Sherman-Morrison is the rank-one inverse update formula. If a square matrix A is invertible and you already know A inverse, then after changing A by an outer product u vT, the new inverse can be computed by correcting the old inverse. The denominator 1 + vT A^-1 u must be nonzero.',
        'The point is not that inverses are good API design. The point is that many streaming algorithms maintain a matrix of accumulated evidence, and each new observation adds one outer product. The update lets them avoid recomputing a dense inverse from scratch after every row.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The formula is (A + u vT)^-1 = A^-1 - (A^-1 u vT A^-1) / (1 + vT A^-1 u). Read it as a correction. A^-1 u is how the old inverse sees the new column direction. vT A^-1 is how the old inverse sees the new row direction. The denominator says whether the update preserves invertibility and how large the correction must be.',
        'For the common ridge-regression update, u and v are both the new feature vector x, so A <- A + x xT. The inverse update becomes P <- P - (P x xT P) / (1 + xT P x). That is the algebra behind recursive least squares and the confidence state in LinUCB.',
      ],
    },
    {
      heading: 'Cost and data structures',
      paragraphs: [
        'A fresh dense inverse is O(n^3). A rank-one correction is O(n^2) after the old inverse is available, because it is built from matrix-vector products and an outer product. The data structures are the old inverse P, the update vectors u and v, the scalar denominator, and the correction matrix.',
        'In an online model, keep A for auditability, P = A^-1 for fast scoring, b for reward-weighted feature sums, and theta = P b for the current coefficients. In practice you also keep residual checks, condition estimates, and a replay path that can rebuild P from A or from logs.',
      ],
    },
    {
      heading: 'Complete case study: online least squares',
      paragraphs: [
        'A streaming regression service receives examples (x, r). It maintains A = lambda I + sum x xT and b = sum r x. Each new row adds x xT to A and r x to b. Sherman-Morrison updates P = A^-1 in place, and theta = P b gives the latest ridge estimate. This is useful when the model must adapt quickly and n is small enough that storing P is reasonable.',
        'LinUCB Personalized News Case Study is the recommender version. Each article or action carries its own A, P, and b. The mean score uses xT P b, while the exploration bonus uses sqrt(xT P x). Without the inverse update, scoring and updating many actions under heavy traffic would require repeated solves or expensive refactors.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The formula is exact algebra, not automatic numerical safety. If the denominator is near zero, the correction can explode. If the matrix is ill-conditioned, repeated updates accumulate roundoff. If the matrix is sparse, storing the full inverse may destroy sparsity. If updates arrive in large batches, a direct factorized solve may be simpler and faster on modern hardware.',
        'The professional pattern is hybrid: fast rank-one updates on the hot path, periodic Cholesky or QR rebuilds in the background, and residual audits that compare A P against the identity. Sherman-Morrison is a tool for controlled small changes, not a license to ignore numerical linear algebra.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Sherman and Morrison, Adjustment of an Inverse Matrix Corresponding to a Change in One Element of a Given Matrix, Project Euclid record at https://projecteuclid.org/journals/annals-of-mathematical-statistics/volume-21/issue-1/Adjustment-of-an-Inverse-Matrix-Corresponding-to-a-Change-in/10.1214/aoms/1177729893.short; Hager, Updating the Inverse of a Matrix, SIAM Review at https://epubs.siam.org/doi/10.1137/1031049; MIT OCW lecture on low-rank changes at https://ocw.mit.edu/courses/18-065-matrix-methods-in-data-analysis-signal-processing-and-machine-learning-spring-2018/resources/lecture-14-low-rank-changes-in-a-and-its-inverse/; and Georgia Tech recursive least-squares notes at https://mdav.ece.gatech.edu/ece-6250-fall2019/notes/21-notes-6250-f19.pdf.',
        'Study next: LinUCB Personalized News Case Study, Kalman Filter Sensor Fusion Case Study, Gaussian Process Bayesian Optimization Primer, Regularization, Matrix Completion & Recommenders, SVD & Low-Rank Approximation, Eigenvalues & Eigenvectors, and any online-learning topic where one new row should update a model without a full retrain.',
      ],
    },
  ],
};
