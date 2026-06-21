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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a 4-user, 5-movie ratings matrix with 13 observed cells and 7 holes. Highlighted cells mark the missing entries the algorithm must predict. The first view runs alternating least squares live in your browser: you watch learned taste vectors converge, then see predictions appear in the empty cells alongside their hidden ground truth.',
        'The second view demonstrates failure modes. Cold-start frames show what happens when a user or item has zero observations: the least-squares system has no equations and produces no vector. Feedback-loop frames trace how recommendations filter tomorrow\'s training data, compounding popularity bias with every retrain cycle.',
        'At each frame, read the explanation text for the invariant being preserved or violated. When predicted values appear next to held-out truth, compare the error: the gap between interpolation (shared structure) and extrapolation (unseen combinations) is the generalization story of matrix completion.',
        {type: 'callout', text: 'Matrix completion is useful only when missing cells are constrained by shared low-rank structure rather than independent guesses.'},
      
        {type: 'image', src: './assets/gifs/matrix-completion.gif', alt: 'Animated walkthrough of the matrix completion visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A recommendation system needs to answer one question per user-item pair: what would this person think of this thing? A dense answer table would solve the problem by lookup, but real systems observe almost nothing. Netflix had 480,000 users, 17,770 movies, and about 100 million ratings -- roughly 1.2% of the full table. The other 98.8% is the product.',
        'Filling blanks with column averages is harmless for reporting but useless for personalization. The system needs predictions that depend on who the user is, not just what the average user thinks. Matrix completion is the formalization of that need: given a sparse matrix of observations and the assumption that the full matrix has low rank, recover the missing entries.',
        {
          type: 'quote',
          text: 'Suppose that one observes a small number of entries selected uniformly at random from a low-rank matrix. When is it possible to complete the matrix and recover the entries that have not been seen?',
          attribution: 'Emmanuel Candes and Benjamin Recht, "Exact Matrix Completion via Convex Optimization" (2009)',
        },
        'Candes and Recht proved that the answer is yes, under surprisingly mild conditions: if the matrix is low-rank and incoherent (its singular vectors are not aligned with coordinate axes), then O(n polylog n) randomly sampled entries suffice for exact recovery. The Netflix Prize (2006-2009) was the industrial proof that this theory works: the winning solution was an ensemble dominated by matrix factorization methods.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable attempt is user-based collaborative filtering. Find the k users whose observed ratings overlap most with Alice, weight them by similarity (cosine or Pearson over shared items), and predict Alice\'s missing ratings as a weighted average of her neighbors\' ratings. Item-based collaborative filtering does the same thing from the other axis: find items similar to ones Alice already rated.',
        'This works when overlap is dense. If Alice and Bob share 50 rated movies, their similarity estimate is stable and the prediction is grounded. The approach is intuitive, explainable, and requires no training -- just a similarity computation over raw data.',
        {
          type: 'diagram',
          text: '         Alien  Titanic  MadMax  Up   Dune\nAlice  [  4.0    0.7      ?     3.4    ? ]\nBob    [  1.4    ?       2.8    3.6   3.2]\nCara   [  ?     3.3      3.6    ?     3.4]\nDev    [  1.1    1.5      ?     1.3    ? ]\n\n?  = missing entry (the cells we must predict)\n4.0 = observed rating',
          label: 'A user-item matrix: 13 observed entries, 7 holes',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sparsity kills neighbor methods. At Netflix scale, two randomly chosen users share on average fewer than two rated movies. A similarity estimate built from one or two shared items is noise, not signal. Two users can both love science fiction and share zero rated titles. Two items can appeal to identical taste profiles but never appear in the same user\'s history.',
        'The similarity matrix itself becomes the problem. Computing all-pairs user similarity is O(n^2) and mostly undefined because most pairs have no overlap. Storing precomputed neighborhoods does not scale. And the method has no generalization mechanism: it cannot infer that Alice would like a movie unless someone similar to Alice has already rated that exact movie. There is no latent structure connecting users and items through shared hidden factors.',
        'Matrix completion replaces direct pairwise overlap with a compressed latent space. Instead of asking "did Alice and Bob rate the same movies?", it asks "do Alice and Bob load on the same hidden taste dimensions?" Two users who share zero movies can still connect through the latent factors, because other users bridge the gap.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The low-rank assumption is the foundation. If the true rating matrix M has rank k, then M = P * Q^T where P is n-by-k (one row per user) and Q is m-by-k (one row per item). Each user compresses to k taste coordinates; each item compresses to k profile coordinates. The predicted rating for user i and item j is the dot product p_i . q_j. For our animation, k=2: two hidden axes that turn out to capture something like "action affinity" and "romance affinity."',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Matrix_multiplication_diagram_2.svg', alt: 'Matrix multiplication diagram showing row and column vectors forming output entries', caption: 'Matrix factorization predicts one missing entry by taking a dot product between a user vector and an item vector. Source: Wikimedia Commons, Lakeworks, CC BY-SA 3.0 or GFDL.'},
        'The theoretical approach from Candes and Recht is nuclear norm minimization: find the matrix X that agrees with all observed entries and has the smallest sum of singular values (the nuclear norm, which is the convex relaxation of rank). This is a semidefinite program -- solvable in polynomial time but impractical for millions of users. The incoherence condition ensures recovery works: the true matrix must spread its energy across many entries rather than concentrating it in a few rows or columns. A matrix where one user accounts for all the variance would need nearly every entry observed to recover.',
        {
          type: 'code',
          language: 'javascript',
          text: '// ALS update: solve for one user vector while item vectors are fixed\n// For user i, collect all items j where rating r_ij is observed.\n// Solve: (Q_obs^T * Q_obs + lambda * I) * p_i = Q_obs^T * r_obs\n//\nfunction solveUserVector(Q, ratings_i, lambda, k) {\n  // Q_obs: rows of Q for items this user rated\n  // r_obs: the corresponding observed ratings\n  const A = identityScaled(k, lambda);  // k x k, starts as lambda * I\n  const b = zeros(k);\n  for (const { itemIdx, rating } of ratings_i) {\n    const q = Q[itemIdx];               // item vector, length k\n    for (let a = 0; a < k; a++) {\n      for (let c = 0; c < k; c++)\n        A[a][c] += q[a] * q[c];         // outer product accumulation\n      b[a] += q[a] * rating;            // right-hand side\n    }\n  }\n  return solve(A, b);                   // k x k linear system\n}',
        },
        'Alternating least squares (ALS) is the practical workhorse. It splits the joint optimization over P and Q into two alternating convex subproblems. Fix Q, solve the best p_i for every user i by ordinary least squares over that user\'s observed ratings -- a k-by-k system per user, trivially parallel. Then fix P, solve the best q_j for every item j the same way. Alternate until convergence. Each half-step only decreases the training loss, so the algorithm is monotonically non-increasing in objective value.',
        'Stochastic gradient descent (SGD) is the other common solver. It streams over observed entries, computes the prediction error e_ij = r_ij - p_i . q_j, and nudges both vectors: p_i += eta * (e_ij * q_j - lambda * p_i). SGD is simpler, adapts to huge data, and integrates naturally with online updates. ALS has exact subproblem solutions and embarrassingly parallel structure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two layers: the theoretical guarantee from convex optimization and the practical success of factorization heuristics.',
        'Candes and Recht proved that if M is an n-by-n matrix of rank r satisfying the incoherence condition, then nuclear norm minimization recovers M exactly from O(r * n * polylog(n)) uniformly random entries with high probability. The nuclear norm is the tightest convex relaxation of the rank function, so minimizing it promotes low-rank solutions without the NP-hard combinatorics of rank minimization. The incoherence condition prevents adversarial structure: it ensures no single row or column dominates the matrix, so random samples carry information about the whole matrix.',
        'In practice, ALS and SGD do not solve the nuclear norm program. They directly minimize the squared error on observed entries plus a Frobenius-norm penalty on P and Q. This is non-convex, so there is no global optimality guarantee. But the factorized objective has benign landscape properties: for exact recovery with sufficient observations, all local minima are global minima (Ge et al., 2016). The regularization term lambda * (||P||^2 + ||Q||^2) prevents the factors from growing without bound to memorize sparse observations. With fewer parameters than observations (our animation: 18 parameters, 13 observed cells), the model is forced to find shared structure rather than memorize individual ratings.',
        {
          type: 'note',
          text: 'The nuclear norm ||M||_* = sum of singular values is to the rank function what the L1 norm is to the L0 norm: a convex envelope that promotes sparsity in the singular value spectrum. This is why nuclear norm minimization recovers low-rank matrices from incomplete observations, just as L1 minimization recovers sparse vectors from underdetermined linear systems (compressed sensing).',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Storage: O((n + m) * k) for the factor matrices plus O(nnz) for the sparse observation matrix, where nnz is the number of observed entries. The full n-by-m matrix is never materialized. One prediction costs O(k) -- a single dot product. Generating top-k recommendations for one user by scoring all items costs O(m * k), which is why production systems use approximate nearest-neighbor indexes (HNSW, ScaNN) to avoid the full scan.',
        {
          type: 'bullets',
          items: [
            'Nuclear norm optimization gives the clean convex recovery story, but it is limited to theory and small problems because the solve is far heavier than factorized training.',
            'ALS costs roughly O(nnz * k^2 + (n + m) * k^3) per sweep. It is attractive in distributed systems because each user solve is independent while item vectors are fixed.',
            'SGD costs O(nnz * k) per pass and streams naturally over huge data, but it follows a noisier path and parallelizes less cleanly than ALS.',
            'Weighted ALS for implicit feedback treats clicks and views as confidence-weighted observations. It scales with observed interactions, but dense confidence terms need careful algebra to avoid an n * m scan.',
          ],
        },
        'ALS sweeps are dominated by the k-by-k system solves. For small k (10-200 in practice), these are cheap. The embarrassingly parallel structure -- every user solve is independent when item factors are fixed -- makes ALS the natural choice for distributed systems (Spark MLlib uses ALS as its primary recommender). SGD has lower per-entry cost but less parallelism; it is the default for single-machine training on huge datasets.',
        'When data doubles by adding interactions, cost grows with nnz, not with n * m. This is the whole point: the algorithm\'s compute scales with what you observed, not with what you could have observed.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Matrix completion won the Netflix Prize era. The $1 million prize, awarded in 2009, went to BellKor\'s Pragmatic Chaos -- an ensemble where matrix factorization models (SVD++, timeSVD++) were the strongest single components, outperforming neighborhood methods, restricted Boltzmann machines, and gradient-boosted trees. The factorization approach remains competitive on pure rating prediction benchmarks two decades later.',
        'The method is strongest when three conditions hold: repeated interactions (each user rates or clicks many items), enough overlap to connect the user-item graph (no isolated subgraphs of users and items), and genuine low-dimensional taste structure (preferences explained by a modest number of hidden factors). It also extends to implicit feedback -- clicks, dwell time, purchases, skips -- by treating each interaction as a confidence-weighted observation rather than a clean star rating (Hu, Koren, Volinsky, 2008).',
        'The same factorized shape survives in modern retrieval stacks. Neural two-tower models learn user and item embeddings through deep networks, but scoring is still a dot product, and the learned vectors are still retrieved via approximate nearest-neighbor indexes. Matrix completion is the ancestor: understanding its strengths and limits makes embedding retrieval, vector search, and feedback-loop diagnostics easier to reason about.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cold start is structural, not a tuning problem. A new user with zero interactions produces zero equations in the ALS solve -- no vector can be computed. A new item has the same problem. Pure collaborative filtering literally cannot speak about entities it has never observed. Every production system is a hybrid: popularity fallback for day-zero users, onboarding questionnaires that manufacture a few equations, and content features (genre, cast, text embeddings) that give new items a vector before anyone interacts with them.',
        'Feedback loops are the deployment trap. In production, users mostly interact with what the recommender shows them. Tomorrow\'s training data is filtered by today\'s model. Popular items accumulate exposure and evidence; obscure items remain uncertain. Without deliberate exploration (Thompson sampling, epsilon-greedy traffic, randomized slates), logging discipline, and counterfactual evaluation, the system grades its own homework and the rich get richer.',
        'Low rank erases important structure. Preferences can be contextual (time of day, mood), seasonal (holiday shopping), social (watching with family), price-sensitive, or driven by short-term intent. A single static user vector cannot represent all of these simultaneously. Sequence-aware models (transformers, RNNs over interaction histories) capture temporal dynamics that a fixed factorization misses. Matrix completion is a strong baseline, not a complete theory of human preference.',
        {
          type: 'bullets',
          items: [
            'Cold start: zero observations = zero equations = no vector. Structural, not fixable by tuning.',
            'Feedback loops: recommendations gate exposure, biasing tomorrow\'s training data toward today\'s predictions.',
            'Incoherence violation: if one user or item dominates the matrix, random samples miss the rest.',
            'Non-stationarity: tastes change over time; a static factorization cannot track drift.',
            'Implicit signal ambiguity: a non-click is not a dislike -- it may be an unseen item.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Candes and Recht, "Exact Matrix Completion via Convex Optimization" (2009) -- the foundational theorem: nuclear norm minimization recovers low-rank matrices from O(n polylog n) random entries under incoherence.',
            'Koren, Bell, and Volinsky, "Matrix Factorization Techniques for Recommender Systems" (IEEE Computer, 2009) -- the practitioner\'s guide, distilling Netflix Prize lessons into ALS, SGD, biases, and SVD++.',
            'Hu, Koren, and Volinsky, "Collaborative Filtering for Implicit Feedback Datasets" (2008) -- extends matrix factorization to clicks and views via confidence-weighted ALS.',
            'Recht, "A Simpler Approach to Matrix Completion" (2011) -- simplified proof of nuclear norm recovery, more accessible than the original.',
            'Ge, Lee, and Ma, "Matrix Completion Has No Spurious Local Minimum" (NeurIPS 2016) -- proves all local minima of the non-convex factorized objective are global, explaining why ALS and SGD work despite non-convexity.',
          ],
        },
        'Prerequisite: study SVD and Low-Rank Approximation for the dense version of the low-rank idea -- matrix completion is SVD adapted to missing data. Study Embeddings and Similarity to connect user and item factor vectors to the broader world of vector representations and dot-product retrieval. Extension: study HNSW or other approximate nearest-neighbor indexes for retrieving top-k candidates at production scale without scoring every item. Study Thompson Sampling for principled exploration that buys information instead of only exploiting current predictions. Study Cross-Validation and Honest Evaluation before trusting recommender metrics produced by a system that shapes its own training data.',
      ],
    },
  ],
};
