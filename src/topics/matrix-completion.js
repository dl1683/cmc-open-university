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

// Ground truth: 4 users × 5 movies, generated from hidden rank-2 structure
// (taste axes ≈ "action affinity" and "romance affinity").
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
      format: (v) => (v === 0 ? '·' : v.toFixed(1)),
    }),
    highlight: { removed: HIDDEN.map(([i, j]) => `u${i}:m${j}`) },
    explanation: 'Four users, five movies, thirteen ratings — and seven holes, the cells the business actually cares about: would Alice like Mad Max? Our toy is 65% observed; Netflix-scale matrices are over 99% EMPTY. SVD & Low-Rank Approximation promised that preference matrices are secretly a few "taste" layers — but classical SVD needs every cell filled. MATRIX COMPLETION is the missing-data version of the same bet: assume low rank, fit ONLY the observed cells, and read the predictions out of the holes.',
  };

  yield {
    state: matrixState({
      title: 'The bet: 20 cells explained by 18 numbers (rank 2)',
      rows: [
        { id: 'users', label: '4 users × 2 tastes' },
        { id: 'movies', label: '5 movies × 2 profiles' },
        { id: 'total', label: 'parameters vs cells' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'each user: (action affinity, romance affinity)', 'each movie: (action content, romance content)', '18 numbers must explain 20 cells — and predict 7 more'][v],
    }),
    highlight: { active: ['total:what'] },
    explanation: 'The model: rating(user, movie) ≈ user-taste · movie-profile — a dot product of two tiny vectors, exactly one rank-2 layer stack. Every user compresses to two numbers (how much they like action, how much romance), every movie to two. The compression is the point: with fewer parameters than observations, the model CANNOT memorize the 13 ratings individually — it is forced to find the shared structure that explains them, and that same structure then speaks about the unseen cells. (Sound familiar? It is Regularization\'s logic — constraint forces generalization — built into the architecture.)',
    invariant: 'Fewer parameters than observations: the factorization must generalize because it cannot memorize.',
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
    explanation: 'The fitting trick is ALTERNATING LEAST SQUARES, and this module genuinely runs it: holding the movie profiles fixed, each user\'s best taste vector is a tiny ordinary least-squares solve over just their observed ratings (a 2×2 system — trivial); then hold users fixed and solve every movie the same way; alternate. Each half-step is convex and exact, so the loss only falls — 25 sweeps and it has settled. Read the learned tastes: Alice is the action lover, Bob bleeds romance, Cara likes both, Dev is lukewarm at everything. NOBODY TOLD THE MODEL THESE AXES EXIST — they emerged from thirteen numbers and the low-rank constraint.',
    invariant: 'ALS alternates two exact convex solves: the training loss is monotonically non-increasing.',
  };

  yield {
    state: matrixState({
      title: 'The holes, filled — predictions vs the hidden truth',
      rows: HIDDEN.map(([i, j]) => ({ id: `h${i}${j}`, label: `${USERS[i]} × ${MOVIES[j]}` })),
      columns: [{ id: 'pred', label: 'predicted' }, { id: 'truth', label: 'actual (held out)' }],
      values: HIDDEN.map(([i, j]) => [ALS.predict(i, j), TRUTH[i][j]]),
      format: (v) => v.toFixed(2),
    }),
    highlight: { found: HIDDEN.map(([i, j]) => `h${i}${j}:pred`) },
    explanation: 'The payoff, scored against ratings the model NEVER SAW: the hidden cells come back with a mean error of about a third of a star (worst cell 0.66; on the observed cells, 0.03). The fit-versus-predict gap is honest and instructive — interpolating shared structure is easier than extrapolating it (Learning Curves\' generalization gap, in miniature). This is the algorithm family that won the Netflix Prize era and still beats far fancier models on pure rating prediction: when the signal really is "people are mixtures of a few tastes," eighteen numbers go a very long way.',
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
    explanation: 'Failure mode 1 — COLD START, visible right in the ALS algebra: a user\'s taste vector is solved FROM their observed ratings, so zero ratings means zero equations means no vector at all. Same for a new movie. Pure collaborative filtering literally cannot speak about newcomers — which is why every real system is a hybrid: popularity charts for day-zero users, the "pick three movies you love" onboarding ritual (manufacturing equations), and CONTENT features (genre, cast, description embeddings — see Embeddings & Similarity) that give new items a vector before anyone rates them.',
    invariant: 'Collaborative filtering speaks only of entities with observations: cold entities need a different signal.',
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
    explanation: 'Failure mode 2 — the FEEDBACK LOOP: in production, users mostly rate what the recommender showed them, so the training data for tomorrow is filtered by today\'s model. Popular items accumulate evidence and confidence; obscure-but-excellent items never get the exposure to prove themselves — popularity bias compounds with every retrain. The cure is deliberate EXPLORATION: spend a slice of recommendations on uncertain items to buy information — which is exactly Thompson Sampling\'s explore/exploit trade, running inside every serious recommender. A recommender without exploration is Data Leakage & Contamination\'s cousin: a system quietly grading its own homework.',
    invariant: 'Recommendations gate the data: without exploration, the model only ever learns about what it already liked.',
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
      format: (v) => ['', 'clicks, dwell time, skips — confidence-weighted, not 1–5 stars', 'neural nets EMBED users and items; score = dot product, still', 'entity → small vector; preference → dot product'][v],
    }),
    highlight: { active: ['heart:what'] },
    explanation: 'Where the field went from here: real systems rarely see stars — they see CLICKS and watch-time (implicit feedback, weighted by confidence since an un-click is not a dislike), and the linear factors grew into neural "two-tower" models where deep networks embed users and items. But look at what survived every generation: each entity becomes a small vector, and preference is their DOT PRODUCT — the same shape as Embeddings & Similarity, retrieved at scale by HNSW-style indexes. Matrix completion was the field\'s proof that taste is low-dimensional; everything since is a richer way of learning the same two towers this page fit with 2×2 least squares.',
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
      heading: `What it is`,
      paragraphs: [
        `Matrix completion is the problem of filling in missing entries of a large, mostly-empty matrix. A ratings matrix for Netflix or Spotify has millions of rows (users) and thousands of columns (movies or songs), but each user rates only a tiny fraction — Netflix's matrices are over 99 percent blank. This sparsity is not a bug; it is the entire point of a recommender system: you cannot ask users to rate every item. Matrix completion assumes the underlying preferences are *low-rank*: users are actually just mixtures of a few "tastes," and movies are just profiles of a few "content types," so the user-movie rating equals taste · profile, a simple dot product. If that assumption holds — and in practice it often does for real movie and music data — the missing cells are computable from the observed ones without ever asking the users to fill them in. The family of algorithms that solve this — particularly alternating least squares (ALS) — runs live in this module, filling seven holes from thirteen observations, and revealing taste axes nobody told the model existed. Watch Alice emerge as an action enthusiast, Bob as a romance lover, and the model learn it purely from the structure of the sparse data.`,
        `The key insight is structural compression: if 4 users and 5 movies give us 20 cells to explain, but tastes compress to 4 × 2 + 5 × 2 = 18 parameters, then the model cannot memorize the 13 observed ratings individually — it is forced to find the underlying structure and generalize from it. That generalization is the magic that predicts unseen cells, and this is precisely why the regularization principle works. Here, the constraint is factorization itself — the architecture says "preferences must live in a 2-dimensional taste space" — and that architectural constraint does what 10,000 epochs of weight decay would do, but instantly and exactly. Fewer parameters than observations is the simplest, most direct form of regularization: hard architectural constraint. The model either fits the structure or it fails; there is no soft middle ground, no tuning knob. That rigor is why matrix factorization is so effective: it forces the right generalization, not just any generalization.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with a matrix of observed ratings R (some entries filled, most null) and choose a target rank k — typically very small, like 2 or 4. The goal is to factor R ≈ P × Q^T, where P is n × k (each row is a user's taste vector) and Q is m × k (each row is a movie's profile vector). The rating of user i for movie j is P[i] · Q[j], a dot product. Initialize P and Q with small random values, then run the main loop: alternating least squares. Holding Q fixed, solve for each row of P independently by ordinary least squares, using only the observed ratings for that user. The algebra is tight: form a 2×2 (or k×k) matrix and a 2 (or k) vector from the observed ratings, solve it, done. Then hold P fixed and solve every row of Q the same way. Alternate. Each solve is a global minimum of its subproblem — there is no gradient descent, no approximation — so the overall training loss is monotonically non-increasing. Repeat 20–100 times; convergence is fast and guaranteed because the objective is biconvex.`,
        `This module demonstrates that algebra in real time: watch the learned user tastes emerge in step two (Alice's action vector grows, Bob's romance vector dominates, Cara likes both, Dev is lukewarm) after just 25 ALS sweeps. The algorithm is so simple because it exploits the factorization: instead of a global non-convex optimization over P and Q, you solve tiny independent convex problems for each row. Finally, to predict a missing cell, compute the dot product of the learned vectors. The step four shows the payoff: predictions recover unobserved ratings to within approximately 0.35 stars (mean absolute error), demonstrating that the low-rank assumption captured real structure. Compare this to the fit on observed cells (mean error 0.03) — the gap reveals the interpolation-versus-extrapolation trade-off that Learning Curves & Bias–Variance explains in detail. The model fits the 13 seen ratings tightly but must generalize to 7 unseen ones; that gap is honest and instructive, not a sign of failure.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Training time: each ALS sweep solves one k×k linear system per user and per movie. For n users, m movies, rank k, and s sweeps, this is O(s × (n + m) × k³), which is tiny compared to gradient descent on deep networks: our 4×5 example with k=2 runs 25 sweeps in milliseconds on a laptop. Real Netflix-scale systems (200 million users, 30,000 titles) use distributed ALS over thousands of machines and still converge in minutes to an hour. The reason is that least squares is direct: no backprop, no hyperparameter tuning, no batching tricks, no learning-rate fiddling. Each solve is exact and local, so ALS is embarrassingly parallel — give each machine a chunk of users or movies, solve them locally, synchronize the shared factors, repeat. Storage: keep P (users × k) and Q (movies × k) in memory. For Netflix at k=100, that is 200 million × 100 + 30,000 × 100 = 20 billion floats, roughly 80 GB uncompressed per copy. In practice, systems compress with quantization and sparsity, storing only the learned embeddings on fast SSD or in-memory caches, never touching the original sparse matrix except during training. Prediction: given learned P and Q, rating a single missing cell is one dot product, O(k) — microseconds per lookup. Real systems batch this: compute top-k recommendations for a user by multiplying one row of P (the user vector) against all of Q (all movie profiles), a single matrix-vector product that BLAS libraries (OpenBLAS, MKL) optimize to thousands of lookups per second per CPU core. Serving billions of recommendation requests per day uses the same algebra. Our demo chose k=2 for pedagogical clarity; real systems tune k by cross-validation and typically use k in the range 32–512 depending on the dataset size and tolerance for overfitting.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Matrix completion is the engine of recommendation at scale. Netflix's $1 million modeling prize (2006–2009) validated that low-rank factorization beats content-based and pure collaborative-filtering baselines; the winning solution used SVD variants and factorization machines, proving that taste-space thinking worked at billions of observations. Today, Spotify, YouTube, and Amazon all use matrix factorization as a core signal, mixed with other features (implicit feedback from clicks and watch-time, content features from genre embeddings and metadata, even temporal trends). The mathematics extends beyond star ratings: implicit-feedback matrices (1 if user clicked an item, 0 or null if not shown) train on clicks, watches, skips, and dwell time, each weighted by confidence. A 5-second skip is weaker evidence of dislike than a full watch; a skip in the first second is weaker still. Engineers assign confidence weights per event type, converting behavior into a "signal strength," and ALS works directly on that signal. Modern systems wrap ALS in a two-tower model where deep neural networks embed users and items, replacing manual feature engineering with learned representations, but the dot-product heart survives unchanged: entity → embedding; preference → dot product. Search and recommendation share the same mathematical spine: both use learned embeddings and nearest-neighbor retrieval (Embeddings & Similarity) — the only difference is what you are ranking over (items for recommendation, documents for search, people for social networks). The cold-start problem shown in the second view (using popularity ranking, onboarding questionnaires, or content features) is how every production system handles brand-new users and brand-new items before collaborative signal accumulates. Without cold-start strategies, new users see nothing, new items are never recommended, and the system grinds to a halt; that is why hybrid recommendations (mixing collaborative + content + popularity) are mandatory in practice.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception is that low-rank factorization is "model-free" or purely data-driven discovery. It is not. You are making a structural bet: preferences are low-rank (k=2, k=100, k=your choice), and if the ground truth violates that assumption, the model fails silently and nobody notices. A dataset where users split into distinct, non-overlapping tribes cannot be compressed into 10 dimensions without blurring the boundaries. The second-biggest trap is confusing fit with prediction. ALS minimizes training loss (fit to observed ratings) but that does NOT guarantee good prediction on held-out cells. Underfitting (k too small: model is too rigid) and overfitting (k too large: model memorizes noise in the 13 observed ratings) both happen in practice. Our k=2 works here only because the data truly was generated from a rank-2 ground truth; real data is messier. Choose k by holdout validation: split your data into train and test, fit ALS on train, score on test, tune k to minimize test error — the same Regularization: L1 & L2 logic that reveals when you are overfitting.`,
        `A third trap is deployment bias, the feedback loop: once you push a recommender to production, the training data is no longer independent and identically distributed. Here is why: the system shows recommendations (step 2 in the second view), users rate what was shown to them (step 3), the model retrains on that biased signal (step 4). Popular items accumulate more exposure and more ratings, compounding their perceived dominance. Unpopular items, however good, never get shown, never get rated, and never get the evidence to prove themselves. The model's confidence in its mistakes only grows. Every deployed recommender needs deliberate exploration — spending a fraction of recommendations on uncertain items — to buy information. That is exactly what Thompson Sampling does. A recommender without exploration is Data Leakage & Contamination's cousin: a system quietly training on its own output, grading its own homework, slowly drifting further from ground truth with every retrain.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Matrix completion is the low-rank version of SVD & Low-Rank Approximation — study SVD to understand the eigenvalue decomposition and singular vectors that motivate the factorization, and to see how classical SVD requires a dense matrix (it fills every gap before factoring, destroying the sparsity) while ALS works directly on the sparse data. Embeddings & Similarity are the conceptual siblings: both compress entities to vectors and measure preference as dot product or cosine distance; study embeddings to see how neural networks learn them end-to-end, replacing our hand-tuned linear model with learned nonlinear feature extraction. Thompson Sampling shows how to explore the gaps in your matrix smartly — which users and items you should learn more about — and crucially, how to break the feedback loop by trading off confidence and uncertainty. Spend a fraction of your recommendations on unproven items to gather signal, and Thompson Sampling tells you exactly how much to spend. Regularization: L1 & L2 explains why underfitting (k too small: under-parameterized, model is too rigid to fit the true structure) and overfitting (k too large: over-parameterized, model fits noise in the 13 observed cells) both degrade generalization, and how to tune the rank-selection knob with cross-validation. Finally, Data Leakage & Contamination warns about the training-deployment gap this module hints at in the cold-start view: once recommendations gate exposure, the future training set is biased by today's model's failures and successes, creating a feedback loop that amplifies errors. You must counteract it with deliberate exploration or the system will slowly drift into irrelevance, recommending only popular items, forever.`,
      ],
    },
  ],
};
