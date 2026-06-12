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
        `Principal Component Analysis — PCA — is the art of finding which directions your data actually varies in, keeping only the ones that matter, and dropping the rest. You start with high-dimensional data (say, 768-dimensional embeddings from a neural network or pixel measurements from images) and ask: along which straight-line directions do I see real variation? Along others, is everything nearly identical? PCA answers exactly, closes-form, without any optimizer or randomness. Fifty years old and still everywhere because it trades simplicity and interpretability for raw speed — milliseconds on datasets that neural-network dimensionality reduction (t-SNE, UMAP) would need hours on.`,
        `This module shows PCA computed live, in front of you, on twelve correlated 2-D points. The data centers at (5.25, 4.30). The covariance matrix is [[6.81, 5.43], [5.43, 4.43]]. The principal components emerge: PC1 points at 39° with eigenvalue λ₁=11.2 (almost all the variance), PC2 at λ₂=0.06 (crumbs). Project onto just PC1, and you keep 99.4% of the variance while halving storage. The magic is that this exact arithmetic — no guessing — tells you the answer every time.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Step one: center your data. Subtract the mean from every point so the cloud sits at the origin. This washes out absolute position; you now measure only variation around the center.`,
        `Step two: compute the covariance matrix. For 2-D data (feature 1 and feature 2), this is a 2×2 symmetric matrix: diagonal entries are the variance of each feature (how much each bounces around its mean), and off-diagonals are covariance — a measure of whether two features move together. The demo shows covariance 5.43, large and positive, meaning feature 1 and feature 2 climb together; they are correlated. This tiny matrix is the data's complete second-order portrait: it tells you the shape of the cloud in pure arithmetic.`,
        `Step three: find the eigenvectors and eigenvalues of that covariance matrix. Eigenvectors are special directions where the matrix only stretches, never rotates. For a 2×2 covariance matrix this has a closed-form solution — the exact angle θ and the two eigenvalues λ₁, λ₂ pop out of algebra. No iteration, no seed. Eigenvalue λ₁ is the variance along the first eigenvector direction; λ₂ is the variance perpendicular to it. In the demo, λ₁=11.2 and λ₂=0.06 — one direction dominates wildly.`,
        `Step four: rank by eigenvalue and crop. Sort the components by their eigenvalues (biggest first), and decide how many to keep. Each component you drop discards that fraction of variance: drop PC2 (λ₂/(λ₁+λ₂)=0.5%) and keep 99.4% of the total. In 768-D embeddings you might keep the top 50 eigenvalues and drop the bottom 718 — losing 2% of variance but crushing a 15× compute saving for what comes next (like t-SNE on the survivors).`,
        `Step five: project and reconstruct. To compress: multiply each point by the kept eigenvector matrix to get low-D coordinates. To decompress: multiply those coordinates by the transposed matrix to recover an approximation of the original. This invertibility is the beating heart of PCA: it is lossy compression with a knob (how many components to keep), and you get the original reconstruction formula for free.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Computational cost: O(p³) for the eigendecomposition of a p×p covariance matrix (p is your feature count). Computing the covariance itself is O(np), where n is your sample count. In practice: computing PCA on a million points with 768 features takes milliseconds. t-SNE on a million 768-D points takes hours. This is why PCA is the standard preprocessing step before any expensive manifold method — it crushes noise dimensions (eigenvalues that are dust) and leaves the signal for the harder algorithms to bend.`,
        `Storage: the covariance matrix is p×p (for 768 features, that is ~590 KB). The eigenvector matrix is also p×p (it stores all directions, though you keep only a few). Once you project and keep only k components, each data point shrinks from p floats to k floats. Compressing 768-D embeddings to 50-D saves 15× space.`,
        `Interpretability (a hidden advantage): each principal component is a linear recipe over original features. If PC1 = 0.78·feature1 + 0.63·feature2, you can read off what PC1 "means" — it weights the two features almost equally, so it is probably a kind of "magnitude" or "size" axis. These loadings (the weights) let you name your axes and explain what your reduction did. t-SNE cannot do this — its axes are inscrutable.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Eigenfaces (1990s computer vision classic): stack pixels from face images into rows, run PCA, project all faces onto the top 50 components, store only those 50 numbers per face, use cosine distance in that space for face recognition. Tiny footprint, bulletproof linear logic, became a template for a hundred other domains.`,
        `Preprocessing for t-SNE / UMAP: the standard scikit-learn pipeline is PCA 768→50 (5 seconds, deterministic) followed by t-SNE 50→2 (minutes, non-deterministic). PCA kills the noise and speeds up the expensive manifold step. The two are teammates: PCA says "what varies"; t-SNE says "how to draw it."`,
        `Whitening and decorrelation: machine-learning models prefer decorrelated features (covariance = 0 between features). PCA whitening divides each component by √λᵢ, turning the covariance matrix into identity. Models train faster and converge better.`,
        `Scree-plot reading: practitioners plot eigenvalues in descending order and watch for the "elbow" — where the curve flattens. That elbow point is your natural rank, your "true" dimensionality. The demo's data has one huge eigenvalue then a cliff to crumbs: keep 1 component, trash 1. Real data might have 50 large, then a gradual decay — you must choose where to cut.`,
        `Anomaly detection: compute PCA on normal data, project new samples, measure reconstruction error. A point with high error is an outlier — it does not live along the normal directions. Standard industrial anomaly detector.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The ring failure, shown in the demo: data on a circular curve — perfectly 1-dimensional structure, but a curved one. PCA sees equal variance in every direction (the eigenvalues are nearly tied), so no straight axis is better than any other. Project anyway and antipodal points on the ring (opposite sides) land on top of each other. The structure was curved, not straight. This is the exact problem that manifold methods (t-SNE, UMAP) solve by bending space: they can unroll that ring into a clean line. Do not use PCA if your data lives on a manifold.`,
        `Linearity assumption: PCA assumes the interesting structure is along straight lines. If your data is a spiral, a torus, or any curve, PCA fails. Check with a manifold-learning visualization first (UMAP, or even just visual inspection).`,
        `Scaling trap: if feature 1 ranges 0–100 and feature 2 ranges 0–1, feature 1 will dominate the covariance matrix simply because of scale, not because it is more important. Always standardize (subtract mean, divide by standard deviation) before PCA unless there is a reason not to.`,
        `Explained variance as a threshold: the scree plot shows how many components you need to retain, say, 95% of variance. But 95% is not magic. On noisy data (where eigenvalues decay slowly), you might need all 100 components to hit 95%; on clean data, maybe 5. The threshold is a tool, not a rule. Codex and domain knowledge beat thresholds.`,
        `Overshooting with k: choosing too many components defeats compression (you are not reducing much) and makes downstream algorithms slower. Choosing too few loses signal you needed. The elbow point in the scree plot is a heuristic; validate on your actual task (classification accuracy, reconstruction error) to know if you over- or under-reduced.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `t-SNE & UMAP: Seeing Embeddings — PCA is linear and rigid; t-SNE and UMAP bend space to preserve neighborhoods in nonlinear data. Learn when to use PCA's speed versus their flexibility.`,
        `Embeddings & Similarity — PCA projects data into a lower-dimensional space; now you need to measure distance in that space. Cosine similarity is the standard; learn why Euclidean distance works poorly in high-D.`,
        `Gradient Descent — PCA solves by closed form; most modern methods (neural networks, manifold learning) use iterative gradient descent. Learn the two paradigms and when each wins.`,
        `Quantization — once you have compressed embeddings with PCA (768→50), quantize to 8-bit integers to drop storage another 32×. Together they form a production pipeline.`,
        `Convolution — in images, PCA is the linear baseline; convolution adds positional structure. Learn why convolution works where PCA would flatten the image into meaningless vectors.`,
      ],
    },
  ],
};

