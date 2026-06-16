// PCA: ask the data which directions it actually varies in, keep the loud
// ones, drop the quiet ones. Computed exactly, live, in this file — and
// then shown failing honestly on the one shape it cannot understand.

import { plotState, scatterState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'pca',
  title: 'PCA: Principal Component Analysis',
  category: 'AI & ML',
  summary: 'Find the axes the data actually varies along — computed live — and keep only the loud ones.',
  controls: [
    { id: 'view', label: 'Reduce', type: 'select', options: ['finding the principal axis, live', 'when PCA wins, when it fails'], defaultValue: 'finding the principal axis, live' },
  ],
  run,
};

// Height-ish vs weight-ish: strongly correlated 2-D data.
const PTS = [
  [1, 1.1], [2, 1.4], [2.5, 2.4], [3.5, 2.5], [4, 3.6], [5, 3.7],
  [5.5, 4.8], [6.5, 5.0], [7, 6.1], [8, 6.2], [8.5, 7.3], [9.5, 7.5],
];
// Live PCA: mean → covariance → eigenvalues/vector (exact, 2×2 symmetric).
function pca(points) {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p[0], 0) / n;
  const my = points.reduce((a, p) => a + p[1], 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
    sxy += (x - mx) * (y - my);
  }
  sxx /= n;
  syy /= n;
  sxy /= n;
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const l1 = tr / 2 + Math.sqrt((tr * tr) / 4 - det);
  const l2 = tr / 2 - Math.sqrt((tr * tr) / 4 - det);
  return { mx, my, sxx, syy, sxy, theta, l1, l2 };
}
const P = pca(PTS);
const AXES = { x: { label: 'feature 1', min: 0, max: 10.5 }, y: { label: 'feature 2', min: 0, max: 9 } };

function* findAxis() {
  yield {
    state: scatterState({ axes: AXES, points: PTS.map(([x, y], i) => ({ id: `p${i}`, x, y })) }),
    highlight: { compare: ['p0', 'p11'] },
    explanation: 't-SNE & UMAP bent space to preserve neighborhoods; PCA — fifty years older and still everywhere — asks a more austere question: along which STRAIGHT directions does the data actually vary? Look at these twelve points: they live in 2-D, but barely. Almost all the action runs along one diagonal; the perpendicular wobble is crumbs. The data is essentially 1-dimensional, wearing 2-D clothing. PCA\'s job is to discover that — not by magic, but by arithmetic this module performs live in front of you.',
  };

  yield {
    state: matrixState({
      title: 'Step 1–2: center the data, compute the covariance matrix',
      rows: [{ id: 'f1', label: 'feature 1' }, { id: 'f2', label: 'feature 2' }],
      columns: [{ id: 'c1', label: 'feature 1' }, { id: 'c2', label: 'feature 2' }],
      values: [[P.sxx, P.sxy], [P.sxy, P.syy]],
      format: (v) => v.toFixed(2),
    }),
    highlight: { active: ['f1:c2', 'f2:c1'] },
    explanation: `Subtract the mean (${P.mx.toFixed(2)}, ${P.my.toFixed(2)}) so the cloud is centered, then build the COVARIANCE MATRIX: the diagonal holds each feature's variance (${P.sxx.toFixed(2)} and ${P.syy.toFixed(2)} — feature 1 swings harder), and the off-diagonal holds their covariance, ${P.sxy.toFixed(2)} — large and positive, the algebraic fingerprint of "these two move together." This little symmetric matrix is the data's complete second-order self-portrait, and PCA is nothing more than reading it correctly.`,
    invariant: 'The covariance matrix encodes every linear relationship: variances on the diagonal, co-movement off it.',
  };

  const dir1 = [Math.cos(P.theta), Math.sin(P.theta)];
  const dir2 = [-Math.sin(P.theta), Math.cos(P.theta)];
  yield {
    state: plotState({
      axes: AXES,
      markers: PTS.map(([x, y], i) => ({ id: `p${i}`, x, y })),
      vectors: [
        { id: 'pc1', label: `PC1 (λ₁ = ${P.l1.toFixed(1)})`, from: { x: P.mx, y: P.my }, to: { x: P.mx + dir1[0] * Math.sqrt(P.l1), y: P.my + dir1[1] * Math.sqrt(P.l1) } },
        { id: 'pc2', label: `PC2 (λ₂ = ${P.l2.toFixed(2)})`, from: { x: P.mx, y: P.my }, to: { x: P.mx + dir2[0] * Math.sqrt(P.l2) * 4, y: P.my + dir2[1] * Math.sqrt(P.l2) * 4 } },
      ],
    }),
    highlight: { found: ['pc1'], compare: ['pc2'] },
    explanation: `Step 3: the EIGENVECTORS of that matrix — the directions it merely stretches without rotating — are the data's natural axes, and the module just solved for them exactly: PC1 points along ${(P.theta * 180 / Math.PI).toFixed(0)}°, straight down the cloud's spine, with eigenvalue λ₁ = ${P.l1.toFixed(1)} (the variance along it). PC2, forced perpendicular, gets λ₂ = ${P.l2.toFixed(2)} — the crumbs. The arrows are drawn at √λ scale: one long, one barely visible. No optimizer, no iterations, no randomness — for PCA the best axes have a CLOSED FORM, which is half of why it is everywhere.`,
    invariant: 'Principal components are the covariance matrix\'s eigenvectors; each eigenvalue is the variance captured.',
  };

  const proj = PTS.map(([x, y]) => {
    const t = (x - P.mx) * dir1[0] + (y - P.my) * dir1[1];
    return { t, x: P.mx + t * dir1[0], y: P.my + t * dir1[1] };
  });
  yield {
    state: scatterState({
      axes: AXES,
      points: [
        ...PTS.map(([x, y], i) => ({ id: `p${i}`, x, y })),
        ...proj.map((q, i) => ({ id: `q${i}`, x: q.x, y: q.y, clusterId: 'line' })),
      ],
      centroids: [{ id: 'line', x: P.mx, y: P.my, label: 'PC1 line' }],
    }),
    highlight: { found: proj.map((_, i) => `q${i}`), visited: PTS.map((_, i) => `p${i}`) },
    explanation: `Step 4: PROJECT — drop every point perpendicularly onto PC1 and keep only its coordinate along the line. Twelve 2-D points become twelve 1-D numbers, and the bookkeeping is exact: PC1 retains λ₁/(λ₁+λ₂) = ${(100 * P.l1 / (P.l1 + P.l2)).toFixed(1)}% of the total variance. We threw away half the storage and kept 99.4% of the information — the same bargain, scaled up, that compresses 768-D embeddings to 50-D (keep the top 50 eigenvalues), whitens features for classical models, and built the original "eigenfaces" face recognition. In real pipelines you read the EXPLAINED-VARIANCE ledger (the scree plot) and cut where it goes quiet.`,
  };
}

function* winsAndFails() {
  yield {
    state: matrixState({
      title: 'PCA vs t-SNE/UMAP: different species, different contracts',
      rows: [
        { id: 'kind', label: 'transformation' },
        { id: 'keeps', label: 'preserves' },
        { id: 'speed', label: 'cost' },
        { id: 'invert', label: 'invertible?' },
        { id: 'axesRow', label: 'axes mean…' },
      ],
      columns: [{ id: 'pcaCol', label: 'PCA' }, { id: 'tsneCol', label: 't-SNE / UMAP' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]],
      format: (v) => ['', 'linear (a rotation + crop)', 'nonlinear (learned bending)', 'global variance', 'local neighborhoods', 'closed form, fast, deterministic', 'iterative, slow, seed-dependent', 'YES — reconstruct from components', 'no — the map is one-way', 'real directions (loadings!)', 'nothing — never interpret'][v],
    }),
    highlight: { compare: ['axesRow:pcaCol', 'axesRow:tsneCol'], found: ['invert:pcaCol'] },
    explanation: 'The two reduction species, side by side. PCA is a RIGID transformation — rotate to the natural axes, crop the quiet ones — and that rigidity buys everything t-SNE lacks: determinism, speed, an inverse map (reconstruct the original from the kept components — this is lossy compression with a knob), and axes that MEAN something: each component is a recipe over original features ("PC1 = 0.78·feature1 + 0.63·feature2"), readable as loadings. The price of rigidity is one assumption baked in: that the interesting structure is LINEAR. The next step shows exactly what breaks when it is not.',
  };

  const circle = Array.from({ length: 12 }, (_, k) => {
    const a = (k * Math.PI) / 6;
    return { id: `c${k}`, x: 5 + 3 * Math.cos(a), y: 4.5 + 3 * Math.sin(a) };
  });
  yield {
    state: scatterState({
      axes: { x: { label: 'feature 1', min: 0, max: 10.5 }, y: { label: 'feature 2', min: 0, max: 9 } },
      points: [
        ...circle,
        ...circle.map((p) => ({ id: `f${p.id}`, x: p.x, y: 0.6, clusterId: 'shadow' })),
      ],
      centroids: [{ id: 'shadow', x: 5, y: 0.6, label: 'PC1 projection' }],
    }),
    highlight: { compare: ['c0', 'c6'], removed: ['fc0', 'fc6'] },
    explanation: 'The honest failure: data on a RING — a perfectly clear 1-dimensional structure (position around the circle), but a CURVED one. PCA\'s covariance matrix sees equal variance in every direction (the eigenvalues tie, ~50% each); no straight axis is better than any other. Project onto the best line anyway — the shadow row below — and antipodal points, maximally far apart on the ring, land ON TOP OF EACH OTHER. The structure was one-dimensional; it just wasn\'t a line. This is precisely the manifold case where the neighborhood-benders earn their complexity: t-SNE would unroll this ring into a clean loop.',
    invariant: 'PCA can only crop along straight lines: curved low-dimensional structure projects into collisions.',
  };

  yield {
    state: matrixState({
      title: 'The working pipeline: they are teammates, not rivals',
      rows: [
        { id: 'step1', label: '1. PCA: 768-D → 50-D' },
        { id: 'step2', label: '2. t-SNE/UMAP: 50-D → 2-D' },
        { id: 'step3', label: '3. verify in the original space' },
      ],
      columns: [{ id: 'why', label: 'why this order' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'kills noise dims cheaply; 15× less work for step 2', 'bends what is left for human eyes', 'cosine distances are the ground truth (always)'][v],
    }),
    highlight: { active: ['step1:why'] },
    explanation: 'How practitioners actually use them: TOGETHER, in this order — PCA first to crush 768 dimensions to ~50 (fast, deterministic, mostly discarding noise directions whose eigenvalues are dust), then t-SNE or UMAP on the survivors for the human-readable map. It is the default preprocessing inside scikit-learn\'s t-SNE for a reason. The division of labor sums up both topics: PCA decides WHAT VARIES ENOUGH TO KEEP — a question with an exact, linear answer — and the manifold methods decide HOW TO DRAW IT — a question that needs bending. Two tools, one ledger of honesty: keep the explained-variance receipt from the first, and the neighborhoods-only contract from the second.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'finding the principal axis, live') yield* findAxis();
  else if (view === 'when PCA wins, when it fails') yield* winsAndFails();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `PCA finds the straight directions where data varies most, then keeps the loud directions and drops the quiet ones. The visualization uses twelve correlated 2-D points. After centering them at about (5.25, 4.30), it computes a covariance matrix with large positive off-diagonal covariance, meaning the two features move together. The first principal component points down the cloud's spine; the second is almost noise.`,
        `This is PCA: Principal Component Analysis in its most transparent form. It is linear, deterministic, and interpretable. Unlike t-SNE & UMAP: Seeing Embeddings, it does not bend space; it rotates and crops it.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Step one is centering. Step two is covariance: variances on the diagonal, co-movement off the diagonal. Step three is Eigenvalues & Eigenvectors. The covariance matrix's eigenvectors are the principal axes, and the eigenvalues are the variances captured along them. In the demo, lambda1 is about 11.2 and lambda2 about 0.06, so projecting onto PC1 keeps 99.4% of total variance.`,
        `Projection turns each 2-D point into one coordinate along PC1. Reconstruction reverses the map approximately by expanding back through the kept component. SVD & Low-Rank Approximation generalizes this view: PCA on centered data can be computed by SVD, with singular values tied to explained variance.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `For n samples and p features, forming a full covariance matrix costs O(n p^2), and dense eigendecomposition costs O(p^3). Truncated or randomized SVD is often used when p is large and only k components are needed. After fitting, storage drops from p numbers per point to k, and reconstruction error is controlled by the discarded eigenvalues.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PCA compresses embeddings before expensive visualization, denoises sensor streams, decorrelates features through whitening, and creates low-dimensional anomaly detectors from reconstruction error. Embeddings & Similarity often uses PCA before HNSW (Vector Search at Scale) or plotting. Quantization can follow PCA for a second compression step. K-Means Clustering sometimes works better after PCA removes noisy dimensions.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The second view shows PCA's honest failure: a ring is one-dimensional but curved. Any straight projection collapses opposite points together. PCA also depends on feature scale; standardize unless units are meaningful. High explained variance is not the same as task usefulness, and a component's loading vector needs domain interpretation. Data Leakage & Contamination applies here too: fit PCA on training data only, then transform validation and test data.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Eigenvalues & Eigenvectors for the covariance skeleton, SVD & Low-Rank Approximation for the general matrix version, and t-SNE & UMAP: Seeing Embeddings for nonlinear neighborhood maps. Then connect PCA-compressed vectors to Embeddings & Similarity, Sparse Autoencoder Feature Dictionary Case Study, HNSW (Vector Search at Scale), Quantization, K-Means Clustering, and Tabular Feature-Basis Orientation Primer for when rotation hurts tree-style tabular models.`,
      ],
    },
  ],
};
