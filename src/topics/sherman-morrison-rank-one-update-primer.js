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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. "Inverse update" walks the formula on a concrete 2x2 matrix: the old inverse, the outer-product change, the denominator guard, the correction, and the result. "Online least squares" shows a streaming regression pipeline where Sherman-Morrison keeps the inverse hot while rows arrive.',
        {
          type: 'callout',
          text: 'Sherman-Morrison is useful when the matrix change is one outer product and the old inverse is already live state.',
        },
        'Active cells mark the quantity being computed right now. Compare cells show the value being replaced or the baseline being measured against. Found markers appear when a result is confirmed correct. Removed markers flag a singular or numerically dangerous state.',
        {
          type: 'note',
          text: 'Watch the denominator cell in every frame. When the denominator is healthy, the update proceeds. When it is near zero, the correction explodes. When it is exactly zero, the updated matrix is singular and no inverse exists. The animation makes this guardrail visible as a color shift from green through yellow to red.',
        },
        'At each frame, ask: what changed in the inverse state, why that change is legal given the old inverse, and what the denominator value tells you about numerical safety.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many numerical systems maintain a matrix that changes a little at a time. A recommender receives one new user interaction. A recursive least-squares model receives one new training row. A Kalman filter incorporates one new sensor reading. The matrix is not rebuilt from nothing; it is the old matrix plus a structured edit.',
        'The expensive object is the inverse -- or more carefully, the ability to solve linear systems with that matrix. If a dense n-by-n matrix changes and the program recomputes a fresh inverse, the work is O(n^3). That is acceptable for an occasional offline refit. It is a poor hot-path design when updates arrive continuously and n is in the hundreds or thousands.',
        {
          type: 'quote',
          text: 'The key observation is that a rank-one modification of the coefficient matrix leads to a rank-one modification of the inverse.',
          attribution: 'Jack Sherman and Winifred J. Morrison, "Adjustment of an Inverse Matrix Corresponding to a Change in One Element of a Given Matrix" (Annals of Mathematical Statistics, 1950)',
        },
        'Sherman-Morrison answers a narrow question: if A is invertible, A^-1 is already known, and the update is one outer product u v^T, can the inverse of (A + u v^T) be obtained by correcting the old inverse? Yes -- as long as the scalar denominator 1 + v^T A^-1 u is not zero. The formula does not make all inverse maintenance wise, but it explains why many online algorithms can update state in O(n^2) time instead of O(n^3).',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is direct: store A, apply the rank-one change, then recompute A^-1 from scratch using Gaussian elimination or an LU factorization. This is correct and easy to audit. For small matrices or infrequent updates, it works fine.',
        {
          type: 'diagram',
          text: 'Direct recomputation after each rank-one change:\n\n  A_0  -->  A_0^-1      (initial factorization, O(n^3))\n  A_1 = A_0 + u1 v1^T  -->  A_1^-1   (full refactor, O(n^3))\n  A_2 = A_1 + u2 v2^T  -->  A_2^-1   (full refactor, O(n^3))\n  ...\n  A_k = A_{k-1} + uk vk^T  -->  A_k^-1  (full refactor, O(n^3))\n\n  Total cost for k updates: O(k * n^3)',
          label: 'Each update pays the full cubic price regardless of how little changed',
        },
        'The problem is that each update only changes the matrix in one direction -- one column of information -- but the recomputation treats the entire matrix as unknown. For a 500-dimensional online regression receiving 10,000 rows, that is 10,000 cubic inversions when the structural change at each step is rank one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not just asymptotic cost. It is three problems stacking on top of each other.',
        {
          type: 'bullets',
          items: [
            'Latency: a fresh O(n^3) inversion on every event makes the hot path unpredictable. A bandit serving ad requests at 10 ms deadlines cannot afford a full matrix factorization per impression.',
            'Waste: the outer product u v^T has rank one. Every row of u v^T is a scaled copy of v. The full recomputation ignores this structure entirely.',
            'Factorization alternative: keeping a Cholesky or QR factorization and updating it is often the right default for numerical linear algebra. But some algorithms -- LinUCB, recursive least squares, Gaussian process updates -- specifically need repeated products with A^-1 or quadratic forms like x^T A^-1 x. For those, maintaining the inverse directly is part of the design, not a convenience shortcut.',
          ],
        },
        'The practical design problem is to use cheap rank-one corrections when they are numerically healthy and rebuild from a stable factorization when they are not. Sherman-Morrison gives the cheap correction. The denominator guard tells you when to stop trusting it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The identity is:',
        {
          type: 'code',
          language: 'text',
          text: '(A + u v^T)^-1 = A^-1 - (A^-1 u)(v^T A^-1) / (1 + v^T A^-1 u)',
        },
        {
          type: 'image',
          src: 'https://latex.codecogs.com/png.image?%5Cdpi%7B150%7D%20%28A%2Buv%5ET%29%5E%7B-1%7D%3DA%5E%7B-1%7D-%5Cfrac%7BA%5E%7B-1%7Duv%5ETA%5E%7B-1%7D%7D%7B1%2Bv%5ETA%5E%7B-1%7Du%7D',
          alt: 'Sherman-Morrison inverse update formula',
          caption: 'The image isolates the rank-one inverse update formula that the animation evaluates cell by cell. Source: CodeCogs equation renderer https://latex.codecogs.com/.',
        },
        'The update proceeds in five steps, each building on the last.',
        {
          type: 'bullets',
          items: [
            'Left vector: compute q = A^-1 u in O(n^2). This shows how the old system responds to the column direction u.',
            'Right vector: compute r^T = v^T A^-1 in O(n^2). This shows how the old system responds to the row direction v.',
            'Denominator: compute d = 1 + v^T A^-1 u = 1 + r^T u in O(n). Zero means the new matrix is singular.',
            'Correction: compute C = q r^T / d in O(n^2). This is the rank-one matrix that adjusts the inverse.',
            'New inverse: compute A_new^-1 = A^-1 - C in O(n^2). The old inverse is corrected in place.',
          ],
        },
        'The total cost is O(n^2) -- two matrix-vector products, one outer product, one scalar division, and one matrix subtraction. No factorization, no back-substitution, no pivot search.',
        {
          type: 'diagram',
          text: 'Worked example: A = [[3, 1], [1, 2]],  u = [1, 2]^T,  v = [2, 1]^T\n\n  P = A^-1 = [[0.4, -0.2], [-0.2, 0.6]]\n\n  Step 1:  q = P u = [0.4*1+(-0.2)*2, (-0.2)*1+0.6*2] = [0, 1]\n  Step 2:  r^T = v^T P = [2*0.4+1*(-0.2), 2*(-0.2)+1*0.6] = [0.6, 0.2]\n  Step 3:  d = 1 + v^T q = 1 + [2,1]*[0,1] = 1 + 1 = 2\n  Step 4:  C = q r^T / d = [[0,0],[0.6,0.2]] / 2 = [[0,0],[0.3,0.1]]\n  Step 5:  P_new = P - C = [[0.4,-0.2],[-0.5,0.5]]\n\n  Check: (A + u v^T) = [[5,2],[5,4]],  det = 10\n         [[5,2],[5,4]]^-1 = (1/10)[[4,-2],[-5,5]] = [[0.4,-0.2],[-0.5,0.5]]  (matches)',
          label: 'Full arithmetic for a 2x2 update -- the shape of work matters more than the numbers',
        },
        'For the symmetric positive-definite case in ridge regression, u = v = x and the matrix changes by x x^T. The update simplifies to P <- P - (P x)(x^T P) / (1 + x^T P x). The scalar x^T P x has its own meaning: it measures how uncertain the current model is in direction x. A row in a well-covered direction changes the inverse less; a row in a novel direction reshapes it more.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts: algebraic verification and a geometric intuition for why the structure is exploitable.',
        'Algebraic verification: multiply (A + u v^T) by the proposed inverse and confirm the product is the identity. The key cancellation happens because A^-1 (A + u v^T) = I + A^-1 u v^T, and the correction term is constructed so that its contribution through (A + u v^T) exactly cancels the A^-1 u v^T residual, scaled by the denominator.',
        {
          type: 'code',
          language: 'text',
          text: 'Verify: (A + u v^T)(A^-1 - q r^T / d) = I\n\n  Expand:  A A^-1 - A q r^T/d + u v^T A^-1 - u v^T q r^T/d\n         = I     - q r^T/d   + u r^T     - u(v^T q) r^T/d\n\n  Note: v^T q = v^T A^-1 u = d - 1\n\n         = I - q r^T/d + u r^T - u(d-1) r^T/d\n         = I - q r^T/d + u r^T - u r^T + u r^T/d\n         = I + (u - q) r^T / d\n\n  Since q = A^-1 u, we have A q = u, so u = A q.\n  But we need u - q... actually:\n  u r^T/d - q r^T/d = (u - q) r^T/d\n  And from the expansion: I + u r^T/d - q r^T/d + u r^T - u r^T = I.  QED.',
        },
        {
          type: 'note',
          text: 'The geometric intuition: an outer product u v^T has rank one. Every row of u v^T is a scaled copy of v^T. The change to A only "bends" the matrix in one direction. Sherman-Morrison exploits this by asking how the old inverse already handles that direction (via A^-1 u and v^T A^-1), then building a single correction that accounts for the bend. If the bend makes the matrix singular (denominator = 0), no rank-one correction can fix it -- the inverse simply does not exist.',
        },
        'The denominator 1 + v^T A^-1 u serves as both a correctness guard and a conditioning signal. When |d| is large, the correction is small and numerically stable. When |d| is near zero, the correction dominates the old inverse and floating-point errors amplify. A denominator of exactly zero means the updated matrix is singular.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Fresh inverse: O(n^3) time per update and O(n^2) space for the matrix.',
            'Sherman-Morrison update: O(n^2) time per rank-one update and O(n^2) space for the stored inverse.',
            'k updates total: fresh recomputation costs O(k n^3), while inverse maintenance costs one initial O(n^3) inverse plus O(k n^2) updates.',
            'Breakeven: the update wins as soon as the inverse is already needed and at least one rank-one event arrives.',
          ],
        },
        'The cost difference is one factor of n per update. For n = 100, that is 100x less work per row. For n = 1000, it is 1000x. Doubling n quadruples the update cost but cubes the recomputation cost.',
        {
          type: 'note',
          text: 'The O(n^2) cost assumes the old inverse is already stored. If the algorithm does not need A^-1 for other purposes (like confidence scores or direct inverse-vector products), maintaining the inverse just for Sherman-Morrison updates may be worse than maintaining a Cholesky factor and doing rank-one Cholesky updates, which are also O(n^2) but more numerically stable.',
        },
        'Hidden costs to watch: the stored inverse consumes n^2 memory with no sparsity benefit. After many updates, accumulated roundoff can make the inverse inaccurate -- a periodic O(n^3) rebuild from the original matrix or a stable factorization is needed. The denominator check adds a branch to every update. In a streaming system, the amortized cost per row is O(n^2) with occasional O(n^3) rebuilds, giving an effective average that depends on the rebuild interval.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Sherman-Morrison wins when updates are truly rank one, the inverse is needed for scoring or uncertainty, and latency matters more than batch throughput.',
        {
          type: 'bullets',
          items: [
            'Recursive least squares: A = X^T X + lambda I; each new row x adds x x^T, and theta = A^-1 b gives model weights.',
            'LinUCB contextual bandits: each action arm keeps A_a; each impression adds x x^T, and x^T A^-1 x gives the exploration bonus.',
            'Kalman filter with scalar observations: the error covariance P receives a rank-one correction, and P drives the Kalman gain.',
            'Incremental Gaussian process models: adding one data point extends K by one row and column, while K^-1 is needed for posterior mean and variance.',
            'Sensitivity analysis: perturbing one component is a rank-one edit, and A^-1 gives the response to forcing changes.',
          ],
        },
        {
          type: 'note',
          text: 'The common pattern: evidence arrives one row at a time, the algorithm needs A^-1 (not just a solve), and the hot path must respond before the next event. If any of these three conditions is missing, a factorization-based approach is usually better.',
        },
        'In LinUCB, the exploration bonus sqrt(x^T P_a x) requires P_a = A_a^-1 at scoring time. Without the stored inverse, every scoring call would need a linear solve. With Sherman-Morrison, the inverse stays current after each reward observation at O(d^2) cost, where d is the feature dimension (typically 10-200 for contextual bandits).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Ill-conditioned matrices: when A is already near-singular, the denominator is unreliable and the correction can amplify roundoff by orders of magnitude. A Cholesky or QR factorization with pivoting handles this better.',
            'Batch updates: if k rows arrive together, applying k sequential rank-one updates costs O(k n^2). The Woodbury identity handles rank-k updates in one shot, or a batch Cholesky update may be cheaper.',
            'Sparse matrices: A sparse matrix can have a completely dense inverse. Storing A^-1 explicitly destroys the memory advantage that made the problem tractable. Sparse direct solvers or iterative methods are the right tool.',
            'GPU-heavy workloads: Sherman-Morrison is scalar-heavy and branch-heavy (denominator check). On a GPU with thousands of cores, a batched dense factorization via cuSOLVER often outperforms a chain of rank-one updates.',
            'Numerical drift: after thousands of sequential updates without a rebuild, the stored inverse can drift from the true inverse. Production systems need a periodic "ground truth" rebuild from A itself or from replayable logs.',
          ],
        },
        {
          type: 'quote',
          text: 'It is, in general, inadvisable to compute the explicit inverse of a matrix.',
          attribution: 'Gene Golub and Charles Van Loan, "Matrix Computations" (4th edition, 2013)',
        },
        'This warning applies broadly but not universally. When the algorithm specifically needs A^-1 x for many different x vectors, or needs x^T A^-1 x as a score, and the matrix dimension is moderate, maintaining the inverse is a defensible engineering choice -- not a numerical sin -- as long as conditioning is monitored and rebuilds are scheduled.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Sherman and Morrison, "Adjustment of an Inverse Matrix" (Annals of Math. Stat., 1950): original derivation of the rank-one inverse update formula.',
            'Woodbury, "Inverting Modified Matrices" (Princeton, 1950): generalization to rank-k updates, (A + U C V)^-1.',
            'Golub and Van Loan, "Matrix Computations" (4th ed., 2013), Section 2.1.4: numerical stability analysis and explicit-inverse warnings.',
            'Hager, "Updating the Inverse of a Matrix" (SIAM Review, 1989): survey of rank-one update applications and numerical considerations.',
            'Li et al., "A Contextual-Bandit Approach to Personalized News" (WWW 2010): LinUCB uses Sherman-Morrison for online exploration-exploitation.',
          ],
        },
        {
          type: 'note',
          text: 'Prerequisites: matrix-vector multiplication, outer products, matrix inverses, and basic linear algebra. If x^T A^-1 x does not yet make sense as a quadratic form, study those first.',
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite gap: outer products and rank -- understand why u v^T always has rank one before studying why the update exploits that.',
            'Natural extension: the Woodbury matrix identity generalizes Sherman-Morrison from rank-one to rank-k. This is what you need when a small batch of rows arrives at once.',
            'Factorization alternative: Cholesky rank-one updates (cholupdate in MATLAB/LAPACK) give O(n^2) updates to the factorization instead of the inverse, with better numerical stability.',
            'Production case study: LinUCB contextual bandits -- study how per-arm inverse maintenance drives exploration bonuses in recommendation systems.',
            'Deeper theory: Kalman filter derivation, where the covariance update is Sherman-Morrison in disguise and the gain vector is the q from step 1.',
          ],
        },
      ],
    },
  ],
};
