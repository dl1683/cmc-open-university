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
      heading: 'Why this exists',
      paragraphs: [
        'Principal Component Analysis exists because high-dimensional data often contains fewer real degrees of freedom than its raw feature count suggests. Two features may move together. Hundreds of embedding dimensions may contain a smaller number of dominant variation directions. Sensor channels may repeat the same signal with noise.',
        'PCA asks a disciplined question: along which straight directions does this centered data vary the most? It then keeps the loud directions and drops the quiet ones. That makes it useful for compression, denoising, visualization preprocessing, whitening, anomaly detection, and basic exploratory analysis.',
        'The key word is straight. PCA does not bend space like t-SNE or UMAP. It rotates the coordinate system to the data\'s natural linear axes, then crops the axes with low variance. That rigidity is both its strength and its limit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach to dimensionality reduction is to choose features by hand or keep the features with the largest individual variance. That misses the point when features are correlated. Two moderate-variance features together may define one strong diagonal direction and one weak noise direction.',
        'Another obvious approach is to jump straight to a nonlinear map for visualization. That can produce beautiful plots, but it may hide global structure, depend on random seeds and hyperparameters, and make axes meaningless. PCA gives a deterministic linear baseline before you reach for more flexible tools.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is redundancy. A dataset can have many columns but only a few dominant patterns of variation. If two features mostly move together, storing both at full weight may waste space and amplify noise.',
        'The second wall is scale. PCA reads variance. If one feature is measured in dollars and another in fractions, the larger-scale feature can dominate the components even when it is not more meaningful. Standardization is often necessary unless the units and scales intentionally carry meaning.',
        'The third wall is curvature. A ring is one-dimensional, but not line-shaped. PCA cannot unroll it. Any straight projection collapses parts of the ring that are far apart along the manifold. That is the honest failure the animation shows.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Center the data, compute how features vary together, and find the directions that maximize variance. Those directions are the eigenvectors of the covariance matrix. Their eigenvalues say how much variance each direction captures.',
        'Keeping the top k components gives the best k-dimensional linear approximation in the least-squares sense. That is why PCA is connected to SVD and low-rank approximation. It is not guessing pretty axes; it is solving a precise optimization problem.',
        'The output is also interpretable. Each component is a loading vector over the original features. A component can sometimes be read as a combination such as "size," "wealth," "brightness," or "activity," but that interpretation must be earned from the loadings and the domain.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'In the first view, read the scatter before reading the equations. The cloud is long in one direction and thin in the other. The covariance matrix gives that shape numbers: variances on the diagonal, co-movement off the diagonal.',
        'The long PC1 arrow is the direction PCA keeps. The tiny PC2 arrow is the direction PCA can discard with little loss. The projected points on the PC1 line show the compression bargain directly: two-dimensional points become one-dimensional coordinates.',
        'In the failure view, the ring is the warning label. The shadow row is not a better representation; it is a collision map. Opposite points on the curved structure land together because PCA only knows straight projections.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step one is centering. Subtract the mean feature vector so the cloud is centered at the origin. Without centering, PCA can confuse position with variation.',
        'Step two is covariance. The covariance matrix records how features vary and co-vary. Large positive off-diagonal entries mean two features tend to rise together. Large negative entries mean one tends to fall when the other rises. The covariance matrix is a compact second-order summary of the data.',
        'Step three is eigendecomposition or SVD. The eigenvectors of the covariance matrix are the principal directions. The eigenvalues are the variance captured along those directions. Sort them descending, keep the top k, and project each centered point onto those axes.',
        'Step four is reading the explained-variance ledger. If the first ten components capture most of the variance, the data may be compressible. If variance is spread flatly across many components, a small linear projection will lose more information.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The visualization uses twelve correlated two-dimensional points. After centering, the covariance matrix has a large positive off-diagonal entry, which means the two features move together. The first principal component points down the spine of the point cloud. The second component is perpendicular and captures only a thin wobble.',
        'Projecting onto PC1 turns each point into one coordinate along that diagonal. In the demo, PC1 keeps almost all the variance. That is a clean compression: half the coordinates are removed while most of the linear structure is preserved.',
        'Now compare the ring. The ring is also low-dimensional in a loose sense because position around the circle is one variable. But the structure is curved. PCA has no way to cut the circle open and unroll it. A straight projection maps opposite sides onto the same shadow. The failure is not a bug; it is the contract.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'PCA works because variance along a direction is a measurable objective. Among all one-dimensional lines through the centered data, PC1 captures the most variance. PC2 captures the most remaining variance subject to being orthogonal to PC1. The pattern continues for later components.',
        'The orthogonality matters. Components do not duplicate the same direction. Each new component explains a different independent axis of linear variation. That makes the explained-variance ratio easy to audit.',
        'The connection to SVD makes PCA practical at scale. Instead of explicitly forming and decomposing a huge covariance matrix, many systems use truncated or randomized SVD to find the top components efficiently.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'For n samples and p features, forming a full covariance matrix costs O(n p^2), and dense eigendecomposition costs O(p^3). When p is large and only k components are needed, truncated or randomized SVD is usually preferred.',
        'After fitting, transformation is cheap: center the point and multiply by the component matrix. Storage drops from p numbers per sample to k numbers per sample. Reconstruction expands back through the kept components and adds the mean, with error controlled by discarded components.',
        'PCA is deterministic for a fixed dataset and preprocessing choice. That makes it useful as a baseline and as a preprocessing step before algorithms whose behavior is more sensitive to hyperparameters.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'PCA wins when the important structure is approximately linear. It compresses embeddings before expensive visualization, removes noise dimensions, decorrelates features through whitening, builds low-dimensional anomaly detectors from reconstruction error, and gives fast exploratory views of high-dimensional data.',
        'It is often used before t-SNE or UMAP. PCA first reduces a 768-dimensional embedding to a smaller, less noisy space such as 50 dimensions. The nonlinear method then works on the survivors. That division of labor is practical: PCA removes quiet linear directions cheaply; neighborhood methods draw the remaining structure for human eyes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'PCA fails when the structure is nonlinear, when feature scale dominates meaning, when low-variance directions are task-critical, or when components are overinterpreted without domain evidence. A fraud signal may live in a quiet direction. A rare disease feature may have low variance and high importance.',
        'It can also cause data leakage. Fit PCA only on training data, then apply the learned mean and components to validation, test, and production data. Fitting PCA on all data before splitting lets information from the test set influence preprocessing.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'PCA is a rotation and crop. Center the data, find variance-maximizing orthogonal axes, keep the top ones, and track how much variance they explain.',
        'It is not a universal visualization method and not a guarantee of task relevance. It is a clean linear baseline with an honest variance ledger.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read Eigenvalues & Eigenvectors for the covariance skeleton, SVD & Low-Rank Approximation for the matrix version, and t-SNE & UMAP: Seeing Embeddings for nonlinear neighborhood maps. Then connect PCA-compressed vectors to Embeddings & Similarity, Sparse Autoencoder Feature Dictionary Case Study, HNSW Vector Search at Scale, Quantization, K-Means Clustering, and Data Leakage & Contamination.',
      ],
    },
  ],
};
