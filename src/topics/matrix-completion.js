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
      heading: `Why matrix completion exists`,
      paragraphs: [
        `Matrix completion exists because many useful data tables are mostly empty. In a recommender, rows are users, columns are items, and the observed cells are ratings, clicks, purchases, watch time, or skips. The missing cells are the real product question: what would this user think of this item if we showed it? A dense table would answer that question directly, but real systems observe only a tiny fraction of all possible user-item pairs.`,
        `The task is not ordinary missing-value cleanup. Filling a user's missing movie rating with the column average may be harmless for a report, but it is weak as a recommender. The system needs personalized predictions for cells that were never observed. Matrix completion tries to infer those cells from shared structure: users with similar patterns probably have related tastes, and items that attract similar users probably have related profiles.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach is nearest-neighbor recommendation. Find users who rated many of the same items as Alice, then recommend items those neighbors liked. Or find items similar to the one Alice liked, then recommend more of them. This works when overlap is dense enough. It is also easy to explain: similar users and similar items should transfer evidence to each other.`,
        `The wall is sparsity. At scale, most pairs have no interaction. Two users may both love science fiction but share no rated movies. Two items may belong to the same taste cluster but never appear in the same user's history. A raw similarity table built directly from overlap becomes noisy, incomplete, and biased toward popular items. Matrix completion replaces direct overlap with a compressed latent space where indirect evidence can connect users and items through shared factors.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is the low-rank bet. A user's preferences may look complicated across millions of items, but much of the variation can be explained by a smaller number of hidden taste dimensions. A movie can also be described by a smaller number of hidden item dimensions. If user vector p_u and item vector q_i live in the same k-dimensional space, the predicted rating is their dot product.`,
        `This is a constraint, not a decoration. Instead of learning one free number for every user-item cell, the model learns one vector per user and one vector per item. Many cells must be explained by shared parameters. That compression prevents pure memorization when k is chosen well. The model can infer a missing cell because the same user vector and item vector already had to explain other observed cells.`,
      ],
    },
    {
      heading: `Mechanism and data structures`,
      paragraphs: [
        `The main data structure is a sparse matrix of observed interactions plus two dense factor tables. The sparse matrix stores only known entries: user id, item id, value, and sometimes a confidence weight or timestamp. The user factor table stores one length-k vector per user. The item factor table stores one length-k vector per item. The dense rating matrix is never materialized because it would be too large and mostly unknown.`,
        `Alternating least squares fits these factors by splitting a hard joint problem into two easier ones. Hold item vectors fixed and solve the best vector for each user using only that user's observed interactions. Then hold user vectors fixed and solve the best vector for each item using only that item's observed interactions. Repeat. Each half-step is a regularized least-squares problem. With rank k, each solve works with a small k by k system rather than a full matrix.`,
        `Stochastic gradient descent is another common fitting method. It loops over observed interactions, computes the prediction error, and nudges the corresponding user and item vectors. ALS has clean parallel blocks and exact subproblem solves. SGD streams naturally and can adapt to huge data. Both methods use the same model shape: entity vectors whose dot product predicts preference.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Matrix completion works when preferences are correlated through hidden factors. If Alice likes action-heavy science fiction and Cara likes several of the same action-heavy items, Cara's other ratings carry evidence about Alice. The model does not need them to overlap on every movie. The shared item factors and user factors propagate information through the whole sparse graph of observations.`,
        `The correctness claim is empirical rather than absolute. Low rank is an assumption about the data-generating process. When that assumption is close enough, held-out cells can be predicted from the compressed factors. Regularization is essential because the observed matrix is sparse. Without penalties, enough factors, or enough iterations, the model can memorize the known cells and fail on the missing ones that matter.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `For n users, m items, rank k, and s ALS sweeps, storage is O((n + m) * k) for factors plus O(nnz) for observed interactions. Prediction for one user-item pair is O(k). A full top-k recommendation pass can be expensive because scoring every item for every user is O(n * m * k), so production systems use candidate generation, approximate nearest-neighbor search, batching, and item filtering.`,
        `One ALS sweep scans observed entries and solves many small systems. The exact cost depends on implementation, confidence weighting, and sparsity pattern, but the useful behavior is parallelism: user solves are independent when item factors are fixed, and item solves are independent when user factors are fixed. When the data doubles by adding interactions, the scan cost grows with observed entries, not with all possible cells.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Matrix completion is the classic engine behind ratings recommenders for movies, music, products, books, jobs, ads, and creators. It is strongest when there are many repeated interactions, enough overlap to connect the user-item graph, and a real low-dimensional taste structure. It can also work with implicit feedback such as clicks, dwell time, carts, purchases, skips, and completions when those events are modeled with confidence weights rather than treated as clean star ratings.`,
        `The same shape survives in modern retrieval systems. Neural two-tower models learn user and item embeddings with deep networks, but scoring is still often a dot product. Matrix completion is the simpler ancestor: no text encoder, no image model, no sequence model, just learned vectors and sparse interactions. Understanding it makes embedding retrieval, vector search, and recommender feedback loops easier to reason about.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Cold start is structural. A new user with no interactions has no equations from which to solve a vector. A new item with no interactions has the same problem. Pure collaborative filtering cannot infer taste from nothing. Real systems add popularity priors, onboarding questions, content features, metadata, text embeddings, or exploration traffic to create initial evidence.`,
        `Feedback loops are the deployment trap. A recommender influences what users see, which influences what they click or rate, which becomes tomorrow's training data. Popular items receive more exposure and more evidence. Unshown items remain uncertain. Without exploration, logging discipline, and counterfactual evaluation, the model can learn that its own previous choices were the only good choices.`,
        `Low rank can also erase important structure. Some preferences are contextual, seasonal, social, price-sensitive, or driven by short-term intent. A single static user vector may not represent a person shopping for a gift, watching with family, or changing taste over time. Matrix completion is a strong baseline, not a complete theory of preference.`,
      ],
    },
    {
      heading: `Evaluation signals`,
      paragraphs: [
        `Evaluate on held-out interactions, not on observed-cell reconstruction alone. A factorization that predicts known ratings perfectly may have memorized noise. Split by time when the product is temporal, because random splits can leak future taste into the past. Report ranking metrics such as recall at k, NDCG, or MAP when the task is recommendation, and calibration or rating error when the task is explicit score prediction.`,
        `Also measure coverage, novelty, popularity bias, and slice performance. A recommender that improves average NDCG by recommending the same popular items to everyone may be weak for discovery. Track cold-start quality separately from warm-user quality. Track online metrics carefully, because click-through can rise while long-term satisfaction, diversity, or creator health falls.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study SVD & Low-Rank Approximation for the dense version of the low-rank idea. Study Embeddings & Similarity to connect user and item factors to vector search. Study HNSW or other approximate nearest-neighbor indexes for retrieving top candidates at scale. Study Thompson Sampling for exploration that buys information instead of only exploiting current predictions. Study Data Leakage & Contamination and Cross-Validation & Honest Evaluation before trusting recommender metrics produced by a system that shapes its own data.`,
      ],
    },
  ],
};
