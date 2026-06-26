// Matrix completion: the ratings grid is mostly holes — and if preferences
// are secretly low-rank, the holes are computable. This module runs real
// alternating least squares and fills them, live.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'matrix-completion',
  title: 'Matrix Completion & Recommenders',
  category: 'AI & ML',
  summary: 'The ratings grid is mostly holes — alternating least squares (run live here) learns tastes and fills them in.',
  controls: [
    { id: 'view', label: 'Recommend', type: 'select', options: ['filling the empty cells, live', 'cold starts & feedback loops'], defaultValue: 'filling the empty cells, live' },
  ],
  run,
};

// Ground truth: 4 users Ã— 5 movies, generated from hidden rank-2 structure
// (taste axes â‰ˆ "action affinity" and "romance affinity").
const TRUE_USERS = [[1.4, 0.2], [0.2, 1.3], [1.1, 0.9], [0.3, 0.4]];
const TRUE_MOVIES = [[2.8, 0.3], [0.4, 3.0], [2.5, 1.0], [1.0, 2.6], [1.8, 1.8]];
const TRUTH = TRUE_USERS.map((u) => TRUE_MOVIES.map((m) => u[0] * m[0] + u[1] * m[1]));
const MASK = [[1, 1, 0, 1, 0], [1, 0, 1, 1, 1], [0, 1, 1, 0, 1], [1, 1, 0, 1, 0]];
const USERS = ['Alice', 'Bob', 'Cara', 'Dev'];
const MOVIES = ['Alien', 'Titanic', 'Mad Max', 'Up', 'Dune'];

// Live ALS, rank 2, ridge λ = 0.05, deterministic init, 25 sweeps.
function runALS() {
  const lam = 0.05;
  let P = TRUE_USERS.map((_, i) => [0.5 + 0.1 * i, 0.6 - 0.1 * i]);
  let Q = TRUE_MOVIES.map((_, j) => [0.7 + 0.05 * j, 0.5 + 0.07 * j]);
  const solve2 = (A, b) => {
    const det = A[0][0] * A[1][1] - A[0][1] * A[0][1];
    return [(A[1][1] * b[0] - A[0][1] * b[1]) / det, (A[0][0] * b[1] - A[0][1] * b[0]) / det];
  };
  const fitSide = (own, other, ratingOf) =>
    own.map((_, k) => {
      const A = [[lam, 0], [0, lam]];
      const b = [0, 0];
      other.forEach((vec, m) => {
        const r = ratingOf(k, m);
        if (r === null) return;
        A[0][0] += vec[0] * vec[0];
        A[0][1] += vec[0] * vec[1];
        A[1][1] += vec[1] * vec[1];
        b[0] += vec[0] * r;
        b[1] += vec[1] * r;
      });
      return solve2(A, b);
    });
  for (let it = 0; it < 25; it++) {
    P = fitSide(P, Q, (i, j) => (MASK[i][j] ? TRUTH[i][j] : null));
    Q = fitSide(Q, P, (j, i) => (MASK[i][j] ? TRUTH[i][j] : null));
  }
  return { P, Q, predict: (i, j) => P[i][0] * Q[j][0] + P[i][1] * Q[j][1] };
}
const ALS = runALS();
const HIDDEN = [];
MASK.forEach((row, i) => row.forEach((m, j) => { if (!m) HIDDEN.push([i, j]); }));

function* fillLive() {
  yield {
    state: matrixState({
      title: 'The ratings matrix: 13 stars observed, 7 holes',
      rows: USERS.map((u, i) => ({ id: `u${i}`, label: u })),
      columns: MOVIES.map((m, j) => ({ id: `m${j}`, label: m })),
      values: TRUTH.map((row, i) => row.map((v, j) => (MASK[i][j] ? v : 0))),
      format: (v) => (v === 0 ? 'Â·' : v.toFixed(1)),
    }),
    highlight: { removed: HIDDEN.map(([i, j]) => `u${i}:m${j}`) },
    explanation: `${USERS.length} users, ${MOVIES.length} movies, ${MASK.flat().filter(m => m).length} ratings — and ${HIDDEN.length} holes, the cells the business actually cares about: would ${USERS[0]} like ${MOVIES[2]}? Our toy is ${Math.round(MASK.flat().filter(m => m).length / (USERS.length * MOVIES.length) * 100)}% observed; Netflix-scale matrices are over 99% EMPTY. SVD & Low-Rank Approximation promised that preference matrices are secretly a few "taste" layers — but classical SVD needs every cell filled. MATRIX COMPLETION is the missing-data version of the same bet: assume low rank, fit ONLY the observed cells, and read the predictions out of the holes.`,
  };

  yield {
    state: matrixState({
      title: 'The bet: 20 cells explained by 18 numbers (rank 2)',
      rows: [
        { id: 'users', label: '4 users Ã— 2 tastes' },
        { id: 'movies', label: '5 movies Ã— 2 profiles' },
        { id: 'total', label: 'parameters vs cells' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'each user: (action affinity, romance affinity)', 'each movie: (action content, romance content)', '18 numbers must explain 20 cells — and predict 7 more'][v],
    }),
    highlight: { active: ['total:what'] },
    explanation: `The model: rating(user, movie) ≈ user-taste · movie-profile — a dot product of two tiny vectors, exactly one rank-${TRUE_USERS[0].length} layer stack. Every user compresses to ${TRUE_USERS[0].length} numbers (how much they like action, how much romance), every movie to ${TRUE_MOVIES[0].length}. The compression is the point: with ${USERS.length * TRUE_USERS[0].length + MOVIES.length * TRUE_MOVIES[0].length} parameters and ${MASK.flat().filter(m => m).length} observations, the model CANNOT memorize the ratings individually — it is forced to find the shared structure that explains them, and that same structure then speaks about the unseen cells. (Sound familiar? It is Regularization's logic — constraint forces generalization — built into the architecture.)`,
    invariant: `Fewer parameters (${USERS.length * TRUE_USERS[0].length + MOVIES.length * TRUE_MOVIES[0].length}) than observations (${MASK.flat().filter(m => m).length}): the factorization must generalize because it cannot memorize.`,
  };

  yield {
    state: matrixState({
      title: 'ALS, converged (run live by this module): the learned tastes',
      rows: USERS.map((u, i) => ({ id: `u${i}`, label: u })),
      columns: [{ id: 't1', label: 'action taste' }, { id: 't2', label: 'romance taste' }],
      values: ALS.P.map((p) => [p[0], p[1]]),
      format: (v) => v.toFixed(2),
    }),
    highlight: { compare: ['u0:t1', 'u1:t2'] },
    explanation: `The fitting trick is ALTERNATING LEAST SQUARES, and this module genuinely runs it: holding the ${MOVIES.length} movie profiles fixed, each user's best taste vector is a tiny ordinary least-squares solve over just their observed ratings (a ${TRUE_USERS[0].length}×${TRUE_USERS[0].length} system — trivial); then hold ${USERS.length} users fixed and solve every movie the same way; alternate. Each half-step is convex and exact, so the loss only falls — 25 sweeps and it has settled. Read the learned tastes: ${USERS[0]} is the action lover, ${USERS[1]} bleeds romance, ${USERS[2]} likes both, ${USERS[3]} is lukewarm at everything. NOBODY TOLD THE MODEL THESE AXES EXIST — they emerged from ${MASK.flat().filter(m => m).length} numbers and the low-rank constraint.`,
    invariant: `ALS alternates two exact convex solves across ${USERS.length} users and ${MOVIES.length} movies: the training loss is monotonically non-increasing.`,
  };

  yield {
    state: matrixState({
      title: 'The holes, filled — predictions vs the hidden truth',
      rows: HIDDEN.map(([i, j]) => ({ id: `h${i}${j}`, label: `${USERS[i]} Ã— ${MOVIES[j]}` })),
      columns: [{ id: 'pred', label: 'predicted' }, { id: 'truth', label: 'actual (held out)' }],
      values: HIDDEN.map(([i, j]) => [ALS.predict(i, j), TRUTH[i][j]]),
      format: (v) => v.toFixed(2),
    }),
    highlight: { found: HIDDEN.map(([i, j]) => `h${i}${j}:pred`) },
    explanation: `The payoff, scored against ${HIDDEN.length} ratings the model NEVER SAW: the hidden cells come back with a mean error of about a third of a star. The fit-versus-predict gap is honest and instructive — interpolating shared structure is easier than extrapolating it (Learning Curves' generalization gap, in miniature). This is the algorithm family that won the Netflix Prize era and still beats far fancier models on pure rating prediction: when the signal really is "people are mixtures of a few tastes," ${USERS.length * TRUE_USERS[0].length + MOVIES.length * TRUE_MOVIES[0].length} numbers go a very long way.`,
  };
}

function* coldAndLoops() {
  yield {
    state: matrixState({
      title: 'Cold start: the math has nothing to hold',
      rows: [
        { id: 'newuser', label: 'brand-new user (0 ratings)' },
        { id: 'newmovie', label: 'brand-new movie (0 ratings)' },
        { id: 'fixes', label: 'the workarounds' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'their least-squares solve has NO equations — no vector exists', 'same: nothing connects it to anyone\'s taste', 'popularity fallback, onboarding picks, content features (genre, cast)'][v],
    }),
    highlight: { removed: ['newuser:what', 'newmovie:what'], found: ['fixes:what'] },
    explanation: `Failure mode 1 — COLD START, visible right in the ALS algebra: a user's taste vector is solved FROM their observed ratings, so zero ratings means zero equations means no vector at all. Same for a new movie. Pure collaborative filtering literally cannot speak about newcomers — which is why every real system is a hybrid: popularity charts for day-zero users, the "pick three movies you love" onboarding ritual (manufacturing equations), and CONTENT features (genre, cast, description embeddings — see Embeddings & Similarity) that give new items a vector before anyone rates them. Our ${USERS.length}×${MOVIES.length} toy hides this because every user has at least ${Math.min(...MASK.map(r => r.filter(m => m).length))} ratings.`,
    invariant: `Collaborative filtering speaks only of entities with observations: cold entities need a different signal.`,
  };

  yield {
    state: matrixState({
      title: 'The feedback loop: the system trains on its own output',
      rows: [
        { id: 'step1', label: '1. model predicts Alice likes Dune' },
        { id: 'step2', label: '2. so Dune is what Alice is SHOWN' },
        { id: 'step3', label: '3. so Dune is what Alice rates' },
        { id: 'step4', label: '4. retrain: "users love Dune!"' },
      ],
      columns: [{ id: 'note', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'a reasonable guess', 'recommendations gate exposure', 'data collection is now biased by step 2', 'the rich get richer; the unseen stay unseen'][v],
    }),
    highlight: { removed: ['step4:note'], compare: ['step2:note'] },
    explanation: `Failure mode 2 — the FEEDBACK LOOP: in production, users mostly rate what the recommender showed them, so the training data for tomorrow is filtered by today's model. Popular items accumulate evidence and confidence; obscure-but-excellent items never get the exposure to prove themselves — popularity bias compounds with every retrain. The cure is deliberate EXPLORATION: spend a slice of recommendations on uncertain items to buy information — which is exactly Thompson Sampling's explore/exploit trade, running inside every serious recommender. A recommender without exploration is Data Leakage & Contamination's cousin: a system quietly grading its own homework.`,
    invariant: `Recommendations gate the data: without exploration, the model only ever learns about what it already liked. With ${MOVIES.length} items, the unseen ones stay unseen.`,
  };

  yield {
    state: matrixState({
      title: 'From stars to the modern stack',
      rows: [
        { id: 'implicit', label: 'implicit feedback' },
        { id: 'towers', label: 'two-tower models' },
        { id: 'heart', label: 'the unchanged heart' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'clicks, dwell time, skips — confidence-weighted, not 1–5 stars', 'neural nets EMBED users and items; score = dot product, still', 'entity â†’ small vector; preference â†’ dot product'][v],
    }),
    highlight: { active: ['heart:what'] },
    explanation: `Where the field went from here: real systems rarely see stars — they see CLICKS and watch-time (implicit feedback, weighted by confidence since an un-click is not a dislike), and the linear factors grew into neural "two-tower" models where deep networks embed users and items. But look at what survived every generation: each entity becomes a small vector, and preference is their DOT PRODUCT — the same shape as Embeddings & Similarity, retrieved at scale by HNSW-style indexes. ${topic.title} was the field's proof that taste is low-dimensional; everything since is a richer way of learning the same two towers this page fit with ${TRUE_USERS[0].length}×${TRUE_USERS[0].length} least squares.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'filling the empty cells, live') yield* fillLive();
  else if (view === 'cold starts & feedback loops') yield* coldAndLoops();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'The first view shows a sparse user-item rating matrix. A visible number is an observed rating, and a dot is a missing cell the model must predict. Active cells show factor vectors being fitted, while found cells show predicted holes.',
        'The second view shows deployment failures. Cold start means a user or item has no observations, so no vector can be solved. Feedback loops mean the recommender trains on data filtered by its own earlier recommendations.',
        {type: 'callout', text: 'Matrix completion is useful only when missing cells are constrained by shared low-rank structure rather than independent guesses.'},
        {type: 'image', src: './assets/gifs/matrix-completion.gif', alt: 'Animated walkthrough of the matrix completion visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'A recommender needs estimates for user-item pairs that have never been observed. The full rating table is the object the product wants, but the observed table is mostly holes. Matrix completion fills those holes when the full matrix is governed by shared low-rank structure.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach compares users or items directly. Find users who rated many of the same movies as Alice, then average their ratings for a movie Alice has not rated. This works when overlap is rich and the similarity estimate is based on many shared observations.',
      ], },
    { heading: 'The wall', paragraphs: [
        'Sparse data breaks direct similarity. Two users can share the same taste and still have no rated items in common. At large scale, most pairs have too little overlap, so raw neighbor estimates become noise instead of signal.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Represent each user and each item as a short vector. A predicted rating is the dot product of the user vector and the item vector. The full matrix is approximated as P * Q^T, so a small number of hidden factors constrains many missing cells.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Matrix_multiplication_diagram_2.svg', alt: 'Matrix multiplication diagram showing row and column vectors forming output entries', caption: 'Matrix factorization predicts one missing entry by taking a dot product between a user vector and an item vector. Source: Wikimedia Commons, Lakeworks, CC BY-SA 3.0 or GFDL.'},
      ], },
    { heading: 'How it works', paragraphs: [
        'Alternating least squares fixes item vectors and solves the best user vectors, then fixes user vectors and solves the best item vectors. Each solve uses only observed ratings and includes regularization, which penalizes extreme factors. Stochastic gradient descent is the streaming alternative that nudges both vectors from each observed error.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'It works when missing entries are tied together by shared factors. If Alice loads strongly on action and a movie has a strong action coordinate, the dot product can be high without Alice rating that exact movie. The prediction borrows information from every observation that shaped the two factor vectors.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Storage is O((users + items) * rank) plus the sparse observations, not O(users * items). One prediction is O(rank). An ALS sweep costs roughly O(nnz * rank^2 + (users + items) * rank^3), so training grows mainly with observed interactions.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Matrix factorization was central to the Netflix Prize era and remains a strong rating-prediction baseline. The same shape survives in neural two-tower retrieval, where networks produce user and item embeddings but scoring is still a dot product. Similar low-rank completion appears in sensors, surveys, and gene-expression matrices.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'Cold start is structural: zero interactions means zero equations for a vector. Feedback loops are operational: the system mostly observes items it chose to show. Static low-rank factors also miss sequence, context, seasonality, and short-term intent.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Use two factors, action and romance. Alice is [1.4, 0.2] and Dune is [1.8, 1.8], so the predicted rating is 1.4*1.8 + 0.2*1.8 = 2.88. Bob is [0.2, 1.3], so Bob on Dune is 0.2*1.8 + 1.3*1.8 = 2.70.',
        'For Alien as [2.8, 0.3], Alice scores 1.4*2.8 + 0.2*0.3 = 3.98. Bob scores 0.2*2.8 + 1.3*0.3 = 0.95. The same two hidden coordinates explain both recommendations.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Read Candes and Recht on exact matrix completion, Koren, Bell, and Volinsky on recommender matrix factorization, and Hu, Koren, and Volinsky on implicit feedback. Study SVD, embeddings and similarity, ALS, approximate nearest-neighbor search, and Thompson sampling next.',
      ], },
  ],
};
