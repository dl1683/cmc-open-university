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
      heading: 'The problem: one small matrix change, one expensive inverse',
      paragraphs: [
        'Many numerical systems maintain a matrix that changes a little at a time. A recommender receives one new user interaction. A recursive least-squares model receives one new training row. A sensitivity analysis changes one component of a linear system. The matrix is not rebuilt from nothing; it is the old matrix plus a structured edit.',
        'The expensive object is often the inverse or, more carefully, the ability to solve systems with the matrix. If a dense `n by n` matrix changes and the program recomputes a fresh inverse, the work is cubic. That may be acceptable for an occasional offline refit. It is a poor hot-path design when updates arrive continuously and the matrix dimension is moderate.',
        'Sherman-Morrison answers a narrow question: if `A` is invertible, `A^-1` is already known, and the update is one outer product `u v^T`, can the inverse of `A + u v^T` be obtained by correcting the old inverse? Yes, as long as the scalar denominator `1 + v^T A^-1 u` is not zero. The formula does not make all inverse maintenance wise, but it explains why many online algorithms can update state in quadratic time instead of cubic time.',
      ],
    },
    {
      heading: 'The naive approach and its wall',
      paragraphs: [
        'The simplest implementation is to store `A`, apply the update, and recompute `A^-1` after every change. This is easy to reason about. It is also wasteful. A single outer product changes the matrix in only one direction, but a fresh dense inverse treats the entire matrix as unknown again.',
        'A better implementation often avoids explicit inverses entirely and keeps a factorization such as Cholesky, QR, or LU. That is usually the right default for numerical linear algebra. Sherman-Morrison is still important because it exposes the structure of the update and gives a cheap inverse-state correction when the algorithm specifically needs repeated inverse-vector products or uncertainty scores such as `x^T A^-1 x`.',
        'The wall is not only asymptotic cost. Long-running services need predictable latency, auditability, and fallback behavior. A model that stalls for a full refactor on every event cannot serve a high-rate stream. A model that blindly applies an unstable inverse update can drift until scores are wrong. The practical design problem is to use cheap updates when they are healthy and rebuild from a stable representation when they are not.',
      ],
    },
    {
      heading: 'Core insight: the inverse can be repaired',
      paragraphs: [
        'The identity is `(A + u v^T)^-1 = A^-1 - (A^-1 u v^T A^-1) / (1 + v^T A^-1 u)`. The old inverse appears on both sides of the correction. The vector `A^-1 u` is the updated column direction as seen through the old system. The row `v^T A^-1` is the updated row direction as seen through the old system. Their outer product forms a rank-one correction to the inverse.',
        'The denominator is the guardrail. If `1 + v^T A^-1 u = 0`, the updated matrix is singular and the inverse does not exist. If the denominator is merely tiny, the inverse exists in exact algebra but the numerical correction can be huge. That is why serious implementations monitor the denominator and do not treat the formula as a magic incantation.',
        'For symmetric positive-definite updates in ridge regression, the common case is `u = x` and `v = x`, so the matrix changes by `x x^T`. If `P = A^-1`, the update becomes `P <- P - (P x x^T P) / (1 + x^T P x)`. The scalar `x^T P x` also has meaning: it measures how uncertain or under-covered the current matrix is in direction `x`. A row in a well-known direction changes the inverse less than a row in a poorly covered direction.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The rank-one update changes the matrix in only one outer-product direction. Sherman-Morrison exploits that narrow change: it asks how the old inverse responds to u and v, then rescales the correction by the scalar amount of feedback between those directions.',
        'The denominator is the safety check. If one plus v^T A^{-1} u is near zero, the update is close to making the new matrix singular. In that case the cheap correction is not a harmless shortcut; the system needs a more stable solve or a full refactorization.',
      ],
    },
    {
      heading: 'A small worked example',
      paragraphs: [
        'Take `A = [[3, 1], [1, 2]]`. Its inverse is `(1 / 5) [[2, -1], [-1, 3]]`, or `[[0.4, -0.2], [-0.2, 0.6]]`. Let `u = [1, 2]^T` and `v = [2, 1]^T`. The update `u v^T` is `[[2, 1], [4, 2]]`, so the new matrix is `[[5, 2], [5, 4]]`.',
        'Sherman-Morrison reuses the old inverse. Compute `P u = [0, 1]^T`. Compute `v^T P = [0.6, 0.2]`. The denominator is `1 + v^T P u = 1 + 0.2 = 1.2`, not zero. The correction is `(P u)(v^T P) / 1.2`, a rank-one matrix. Subtract that correction from `P` and the result is the inverse of the updated matrix.',
        'The exact arithmetic is less important than the shape of the work. The update uses matrix-vector products, an outer product, and one scalar division. It does not perform a full elimination or factorization from scratch. For dimension two the difference is tiny. For dimension one thousand, repeated rank-one updates can be the difference between a viable online method and an offline batch method.',
      ],
    },
    {
      heading: 'Online least squares and bandits',
      paragraphs: [
        'Recursive least squares maintains `A = lambda I + sum x x^T` and `b = sum r x`, where `x` is a feature vector and `r` is an observed reward or target. The coefficient vector is `theta = A^-1 b`. When a new example arrives, `A` receives one new outer product and `b` receives one new vector. If `P = A^-1` is maintained with Sherman-Morrison, `theta = P b` can be refreshed without solving the normal equations from scratch.',
        'This is useful in systems where the model must adapt while serving traffic: calibration, pricing, online ranking, small contextual bandits, and control systems with slowly changing observations. The dimension must still be reasonable because storing a dense inverse costs `O(n^2)` memory. Sherman-Morrison is not a solution for million-feature sparse text models unless the surrounding algorithm has a low-dimensional representation.',
        'LinUCB is a good mental model. Each action can keep its own matrix `A_a`, inverse `P_a`, and reward vector `b_a`. The predicted mean for a context `x` uses `x^T P_a b_a`. The exploration bonus uses `sqrt(x^T P_a x)`. That bonus is cheap only if the inverse state or a comparable solve path is readily available. The same update that learns from the reward also shrinks uncertainty in the observed direction.',
      ],
    },
    {
      heading: 'Where it wins, where it fails',
      paragraphs: [
        'Sherman-Morrison wins when updates are truly rank one, matrices are small or medium dense objects, the old inverse is already maintained for a reason, and the hot path needs low latency. It is especially attractive when many updates arrive between full refits and the application can tolerate a controlled approximation window before the next stable rebuild.',
        'It fails when the update is not low rank, when many rows arrive as a batch, when the matrix is ill-conditioned, when the denominator approaches zero, or when sparsity matters more than inverse access. A sparse matrix can have a dense inverse; explicitly storing `A^-1` may destroy the memory advantage that made the original problem tractable. On modern hardware, a batched factorized solve can also outperform a chain of small scalar-heavy updates.',
        'The most common misconception is that maintaining an inverse is the same as solving a numerical problem well. In many production systems, the correct design is to maintain a factorization, apply rank-one updates to that factorization, and compute solves as needed. Sherman-Morrison remains valuable as algebra, as a performance tool in selected designs, and as the conceptual basis for several online-learning updates.',
      ],
    },
    {
      heading: 'Operational checks and what to study next',
      paragraphs: [
        'A robust implementation tracks more than the formula. Monitor the denominator, the condition estimate of `A`, the norm of the correction, symmetry drift when the matrix should remain symmetric, and residual checks such as the distance between `A P` and the identity. Keep a replayable log or an accumulated matrix so a background job can rebuild the inverse from a stable factorization. Decide in advance what threshold triggers a refit.',
        'Also watch product-level signals. If a bandit policy changes abruptly after a single observation, the update may be too large or the regularization too weak. If confidence bonuses stop shrinking in frequently observed directions, the inverse state may be stale or corrupted. If latency spikes during refits, the hybrid schedule needs work.',
        'Study matrix-vector multiplication, outer products, Cholesky factorization, QR factorization, ridge regression, recursive least squares, Kalman filters, Gaussian-process updates, contextual bandits, and the Woodbury matrix identity. Woodbury is the natural next step: it generalizes Sherman-Morrison from rank-one updates to low-rank updates, which is exactly what appears when a small batch of rows arrives at once.',
      ],
    },
  ],
};
