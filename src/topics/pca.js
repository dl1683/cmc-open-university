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
      heading: 'How to read the animation',
      paragraphs: [
        'The first view computes PCA live on twelve correlated 2-D points. Faded points are the original data. The covariance matrix step shows the second-order summary: variances on the diagonal, co-movement off it. The arrow labeled PC1 is the direction of maximum variance; PC2 is the perpendicular remainder. Arrow length scales with the square root of the eigenvalue, so a long arrow means a loud direction. Projected points (highlighted) show the 2-D-to-1-D compression: each original point drops perpendicularly onto the PC1 line and becomes a single coordinate.',
        { type: 'callout', text: 'PCA is the best linear shadow of centered data: rotate to the loud axes, then keep the coordinates that carry variance.' },
        'The second view shows PCA on a ring -- the honest failure case. The shadow row below the ring is the PC1 projection. When opposite points on the ring land on the same shadow position, you are watching a collision caused by PCA\'s linearity assumption. The comparison table and pipeline step spell out how PCA and t-SNE/UMAP divide labor in practice.',
      
        {type: 'image', src: './assets/gifs/pca.gif', alt: 'Animated walkthrough of the pca visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'High-dimensional data often contains fewer real degrees of freedom than its column count suggests. Two features may rise and fall together. Hundreds of embedding dimensions may encode a handful of dominant variation patterns. Sensor channels may repeat the same signal buried in noise. Working with all the raw dimensions wastes storage, slows models, amplifies noise, and makes visualization impossible -- humans cannot see past three dimensions.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/GaussianScatterPCA.svg',
          alt: 'Point cloud with principal component eigenvectors drawn from the mean',
          caption: 'The long eigenvector shows the direction of maximum variance; the short one shows the quiet orthogonal remainder. Source: Wikimedia Commons, Nicoguaro, CC BY 4.0.',
        },
        'Karl Pearson posed the core question in 1901: given a cloud of points, what is the line (or plane) of closest fit? Harold Hotelling formalized the answer in 1933 as Principal Component Analysis -- find the orthogonal directions along which the centered data varies the most, rank them by how much variance each captures, and keep the top few. The quiet directions, where the data barely moves, are discarded. What remains is the best low-dimensional linear summary of the original data, in a precise least-squares sense.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A dataset has 1,000 features per sample. The first instinct is to pick features by hand: drop columns that look redundant, keep columns that seem important. This works when the domain expert knows which measurements matter, but it scales poorly. With 1,000 columns, manual selection is slow, error-prone, and fragile -- correlated features hide information in their relationship, not in either column alone.',
        'A second instinct is to keep every feature and let the model sort it out. That works until the curse of dimensionality bites: distances become less meaningful in high dimensions, models overfit to noise, and training slows down. The learner needs a way to compress without expert feature selection and without throwing away the patterns that matter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Manual feature selection breaks because the important signal often lives in combinations of features, not in any single column. Height and weight individually are noisy predictors of body frame, but their correlated pattern -- taller people tend to weigh more -- captures a dominant axis of variation that neither feature alone represents.',
        'The second wall is scale. PCA reads variance. If one feature is measured in dollars (range 0--100,000) and another in fractions (range 0--1), the dollar feature will dominate every component regardless of meaning. Standardization (subtract mean, divide by standard deviation) is usually required unless the original units are commensurate and their relative scales carry intentional meaning.',
        'The third wall is curvature. PCA can only find straight directions. Data arranged on a ring, a Swiss roll, or a curved manifold has low-dimensional structure that no straight projection can unfold. PCA will project opposite sides of a ring onto the same point. The animation shows this failure directly.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The covariance matrix of centered data is a compact summary of all pairwise linear relationships among features. Its eigenvectors are the directions the matrix merely stretches without rotating -- the data\'s natural axes. Its eigenvalues are the variance captured along each of those axes. Sorting eigenvectors by descending eigenvalue ranks directions from loudest to quietest.',
        'Keeping the top k eigenvectors and projecting every data point onto them gives the best rank-k linear approximation to the data in the least-squares sense. This is not a heuristic; it is the solution to a precise optimization problem: minimize the total squared reconstruction error over all possible k-dimensional linear subspaces. That optimality, plus the fact that the solution has a closed form (no iterations, no randomness), is why PCA has survived 125 years of competition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Step 1: Center the data. Subtract the mean of each feature so the cloud sits at the origin. Without centering, PCA confuses position with variation -- a cloud shifted far from zero would have a first component pointing at the offset, not at the spread.',
        'Step 2: Build the covariance matrix. For d features, this is a d-by-d symmetric matrix. Entry (i, j) is the average product of centered feature i and centered feature j. The diagonal holds each feature\'s variance; the off-diagonal holds co-movement. A large positive entry means two features rise and fall together. A large negative entry means one falls when the other rises.',
        'Step 3: Eigendecompose. For a symmetric matrix, the eigenvectors are orthogonal and the eigenvalues are real. Each eigenvector is a principal component direction; each eigenvalue is the variance the data has along that direction. For a 2-by-2 covariance matrix, the eigenvalues solve a quadratic and the eigenvector angle has a closed-form arctangent -- the visualization computes this exactly.',
        'Step 4: Project and compress. Multiply each centered data point by the matrix of top-k eigenvectors to get k coordinates. The explained variance ratio for each component is its eigenvalue divided by the sum of all eigenvalues. The scree plot -- eigenvalues sorted in a bar chart -- shows where variance drops off. Cut where the bars go quiet.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Among all unit vectors u, the one that maximizes the variance of the data projected onto it is the eigenvector with the largest eigenvalue. This can be shown by writing the projected variance as u-transpose times the covariance matrix times u, subject to the constraint that u has unit length. The Lagrange multiplier condition reduces to the eigenvector equation. The maximum variance equals the eigenvalue.',
        'Once PC1 is fixed, PC2 maximizes variance in the orthogonal complement -- the subspace perpendicular to PC1. By induction, each successive component captures the most remaining variance among all directions orthogonal to those already chosen. Components never duplicate information because eigenvectors of a symmetric matrix are orthogonal.',
        'The connection to SVD makes PCA practical at scale. If the centered data matrix is X (n-by-d), then the covariance matrix is proportional to X-transpose X. The right singular vectors of X are the eigenvectors of X-transpose X, and the squared singular values are proportional to the eigenvalues. Truncated SVD finds the top k components without forming the full covariance matrix, making PCA feasible even when d is in the thousands.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Five 2-D points: (1, 2), (3, 6), (5, 8), (7, 12), (9, 14). These roughly follow the pattern y = 1.5x + noise.',
        'Step 1 -- Center. Mean = (5, 8.4). Subtract: (-4, -6.4), (-2, -2.4), (0, -0.4), (2, 3.6), (4, 5.6).',
        'Step 2 -- Covariance matrix. Var(x) = (16+4+0+4+16)/5 = 8. Var(y) = (40.96+5.76+0.16+12.96+31.36)/5 = 18.24. Cov(x,y) = (25.6+4.8+0+7.2+22.4)/5 = 12. The covariance matrix is [[8, 12], [12, 18.24]]. The large positive off-diagonal confirms x and y move together.',
        'Step 3 -- Eigendecompose. Trace = 26.24, determinant = 8*18.24 - 144 = 1.92. Eigenvalues: 26.24/2 +/- sqrt(26.24^2/4 - 1.92) = 13.12 +/- 13.05. So lambda_1 = 26.17, lambda_2 = 0.07. PC1 captures 26.17/26.24 = 99.7% of total variance. The eigenvector for lambda_1 points along the cloud\'s spine (roughly 56 degrees from horizontal). PC2, perpendicular, gets the crumbs.',
        'Step 4 -- Project onto PC1. Each centered point drops perpendicularly onto the PC1 line, becoming a single coordinate. Five 2-D points become five 1-D numbers. We discarded half the storage and kept 99.7% of the linear information. Reconstruction from 1-D back to 2-D (by multiplying the coordinate by the PC1 direction vector and adding the mean) recovers points within a tiny perpendicular offset -- the 0.3% that was noise.',
        'Scree plot for choosing k: plot the eigenvalues as bars in descending order. Here, bar 1 is 26.17 and bar 2 is 0.07 -- a sharp elbow after the first component. The elbow says one component is enough. In practice, MNIST digits in 784-D show an elbow around 50 components (capturing roughly 95% of variance), suggesting 50-D compression with minimal loss.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For n samples and d features, forming the full covariance matrix costs O(n * d^2) operations and the dense eigendecomposition costs O(d^3). When d is large and only k components are needed, truncated or randomized SVD reduces the cost to approximately O(n * d * k). scikit-learn\'s PCA uses this by default when k is much smaller than d.',
        'After fitting, transforming a new sample costs O(d * k): subtract the stored mean, multiply by the k-by-d component matrix. Storage drops from d numbers per sample to k numbers per sample. Reconstruction (inverse transform) costs O(d * k) to expand back, plus adding the mean. The reconstruction error is controlled entirely by the discarded eigenvalues -- their sum is the total squared error.',
        'Doubling the number of samples doubles the covariance-building cost but does not change eigendecomposition cost (which depends on d, not n). Doubling the number of features quadruples the covariance cost and cubes the eigendecomposition cost -- this is why truncated SVD matters for high-dimensional data. PCA is deterministic: same data, same preprocessing, same components. No random seeds, no hyperparameter sensitivity, no convergence worries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Noise reduction: small eigenvalues correspond to noise directions. Projecting onto the top components and reconstructing filters out high-frequency noise. Image denoising, signal processing, and sensor fusion all use this. Eigenfaces (Turk and Pentland, 1991) projected face images onto the top principal components to build a compact representation for recognition -- the first practical face recognition system.',
        'Compression and preprocessing: PCA reduces 768-D transformer embeddings to 50-D before feeding them to t-SNE, UMAP, or a downstream classifier. The compression is lossless for the dominant linear structure and removes noise dimensions that would otherwise slow or confuse later steps. scikit-learn\'s t-SNE implementation recommends PCA preprocessing for exactly this reason.',
        'Whitening: after PCA, dividing each component by the square root of its eigenvalue decorrelates the features and equalizes their variance. Many classical models (logistic regression, SVMs, k-nearest neighbors) benefit from whitened inputs because distance metrics become meaningful across all directions.',
        'Anomaly detection: fit PCA on normal data, then measure reconstruction error on new samples. A sample that does not project well onto the learned components -- high reconstruction error -- is likely anomalous. This works because anomalies tend to have energy in directions the normal data does not use.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Nonlinear structure: PCA cannot unroll a Swiss roll, separate concentric rings, or flatten a curved manifold. The animation demonstrates this with a ring -- antipodal points collapse onto the same shadow. Use kernel PCA, t-SNE, UMAP, or autoencoders when the structure is curved.',
        'Scale sensitivity: a feature measured in kilometers will dominate one measured in meters, regardless of which is more informative. Always standardize (z-score) before PCA unless the raw scales carry intentional physical meaning.',
        'Task-critical quiet directions: PCA ranks directions by variance, not by predictive importance. A fraud indicator with tiny variance but strong class separation will be dropped. Supervised methods (LDA, partial least squares) use labels to find directions that matter for the task, not just directions with high variance.',
        'Data leakage: fitting PCA on the entire dataset (train + test) before splitting lets test-set statistics influence the components. Always fit on training data only, then apply the learned mean and eigenvectors to validation and test sets. This is a common mistake in machine learning pipelines.',
        'Overinterpretation: each component is a loading vector over original features, and it is tempting to name them ("size factor," "contrast factor"). Interpretations must be earned from the loadings and domain knowledge. A component that mixes 20 features with similar weights has no clean single-word name.',
      ],
    },
    {
      heading: 'PCA vs t-SNE vs UMAP',
      paragraphs: [
        'PCA is a linear, global, deterministic transformation. It preserves large-scale variance structure, produces interpretable axes (loadings), runs in closed form, and has an inverse map -- you can reconstruct the original from the components with quantifiable error. It is fast (seconds on millions of samples) and has no hyperparameters beyond the number of components to keep.',
        't-SNE is a nonlinear, local, stochastic method. It converts pairwise distances to probabilities, then minimizes KL divergence between high-dimensional and low-dimensional probability distributions. It excels at preserving local neighborhood structure for 2-D visualization but distorts global distances, has no inverse map, depends on perplexity and learning rate, and runs slowly on large datasets. Cluster separations and sizes in a t-SNE plot are not meaningful.',
        'UMAP is also nonlinear and local but faster than t-SNE, better at preserving some global structure, and based on topological arguments rather than probability divergence. Like t-SNE, it has hyperparameters (n_neighbors, min_dist) that change the output, no stable inverse, and axes that carry no interpretable meaning.',
        'The practical pipeline uses them together: PCA first to crush noise dimensions cheaply (768-D to 50-D), then t-SNE or UMAP on the survivors for the human-readable 2-D map. PCA answers "what varies enough to keep" -- a question with an exact linear answer. The manifold methods answer "how to draw it" -- a question that requires bending space.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Pearson 1901, "On Lines and Planes of Closest Fit to Systems of Points in Space." Hotelling 1933, "Analysis of a Complex of Statistical Variables into Principal Components." Turk and Pentland 1991, "Eigenfaces for Recognition." Jolliffe 2002, Principal Component Analysis (2nd ed). Halko, Martinsson, and Tropp 2011, "Finding Structure with Randomness: Probabilistic Algorithms for Constructing Approximate Matrix Decompositions" (the paper behind randomized SVD in scikit-learn).',
        'Prerequisite: Eigenvalues & Eigenvectors -- the algebraic skeleton PCA is built on. Extension: SVD & Low-Rank Approximation -- PCA is SVD of centered data; understanding SVD reveals why truncated decomposition works and connects to matrix completion and recommender systems. Nonlinear alternatives: t-SNE and UMAP for curved manifold visualization. Downstream: K-Means Clustering, which is often applied after PCA-compressed data to find groups in the reduced space.',
      ],
    },
  ],
};
