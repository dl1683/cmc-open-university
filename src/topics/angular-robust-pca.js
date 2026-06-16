// Angular robust PCA: use directions on a sphere, not raw squared distances,
// so a few large outliers do not drag the principal component.

import { graphState, matrixState, plotState, scatterState, InputError } from '../core/state.js';

export const topic = {
  id: 'angular-robust-pca',
  title: 'Angular Robust PCA',
  category: 'AI & ML',
  summary: 'A robust dimensionality-reduction idea: normalize observations to angular directions, trim outliers, and recover structure that vanilla PCA can lose.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['outlier-resistant direction', 'trimmed angular density'], defaultValue: 'outlier-resistant direction' },
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

const CLEAN_POINTS = [
  { id: 'p0', x: 1.0, y: 1.2 }, { id: 'p1', x: 2.0, y: 1.8 }, { id: 'p2', x: 3.0, y: 2.5 },
  { id: 'p3', x: 4.0, y: 3.1 }, { id: 'p4', x: 5.0, y: 3.8 }, { id: 'p5', x: 6.0, y: 4.4 },
  { id: 'p6', x: 7.0, y: 5.2 }, { id: 'p7', x: 8.0, y: 5.8 },
];

const OUTLIERS = [
  { id: 'o0', x: 2.0, y: 8.4, clusterId: 'out' },
  { id: 'o1', x: 8.7, y: 1.2, clusterId: 'out' },
];

function* outlierResistantDirection() {
  yield {
    state: scatterState({
      axes: { x: { label: 'feature 1', min: 0, max: 10 }, y: { label: 'feature 2', min: 0, max: 9 } },
      points: CLEAN_POINTS,
    }),
    highlight: { active: ['p0', 'p7'] },
    explanation: 'Vanilla PCA is excellent when the main variation is a clean linear direction. With only the inlier cloud, the first principal component follows the diagonal structure.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'feature 1', min: 0, max: 10 }, y: { label: 'feature 2', min: 0, max: 9 } },
      markers: [...CLEAN_POINTS, ...OUTLIERS],
      vectors: [
        { id: 'cleanPc', from: { x: 4.5, y: 3.5 }, to: { x: 7.5, y: 5.5 }, label: 'clean PC' },
        { id: 'badPc', from: { x: 4.8, y: 4.0 }, to: { x: 4.4, y: 7.0 }, label: 'dragged PC' },
      ],
    }),
    highlight: { active: ['o0', 'o1'], compare: ['badPc'], found: ['cleanPc'] },
    explanation: 'A few large outliers can dominate covariance because PCA squares distances from the mean. The principal direction can rotate toward unusual magnitude rather than the inlier pattern.',
    invariant: 'Squared-distance methods let large residuals buy large influence.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'unit direction x', min: -1.1, max: 1.1 }, y: { label: 'unit direction y', min: -1.1, max: 1.1 } },
      series: [
        { id: 'circle', label: 'unit circle', points: [
          { x: 1.0, y: 0.0 }, { x: 0.7, y: 0.7 }, { x: 0.0, y: 1.0 }, { x: -0.7, y: 0.7 },
          { x: -1.0, y: 0.0 }, { x: -0.7, y: -0.7 }, { x: 0.0, y: -1.0 }, { x: 0.7, y: -0.7 }, { x: 1.0, y: 0.0 },
        ] },
      ],
      markers: [
        { id: 'a0', x: 0.77, y: 0.64, label: 'inlier' },
        { id: 'a1', x: 0.80, y: 0.60, label: 'inlier' },
        { id: 'a2', x: 0.73, y: 0.68, label: 'inlier' },
        { id: 'b0', x: -0.1, y: 0.99, label: 'outlier' },
        { id: 'b1', x: 0.98, y: -0.18, label: 'outlier' },
      ],
    }),
    highlight: { found: ['a0', 'a1', 'a2'], compare: ['b0', 'b1'] },
    explanation: 'Angular robust PCA normalizes observations to directions and looks for dense angular agreement. Magnitude no longer gives an outlier unlimited leverage.',
  };

  yield {
    state: labelMatrix(
      'Vanilla PCA vs angular robust PCA',
      [
        { id: 'input', label: 'input' },
        { id: 'influence', label: 'influence' },
        { id: 'fit', label: 'fit target' },
        { id: 'failure', label: 'failure' },
      ],
      [
        { id: 'PCA', label: 'PCA' },
        { id: 'AR-PCA', label: 'AR-PCA' },
      ],
      [
        ['raw centered points', 'unit directions'],
        ['distance squared', 'angular density'],
        ['max variance', 'stable direction'],
        ['large outliers', 'many aligned outliers'],
      ],
    ),
    highlight: { active: ['influence:PCA', 'influence:AR-PCA'], found: ['fit:AR-PCA'] },
    explanation: 'The robust version does not make PCA obsolete. It changes the influence function: a point can vote by direction, but its raw distance cannot hijack the fit.',
  };
}

function* trimmedAngularDensity() {
  yield {
    state: labelMatrix(
      'Angular robust pipeline',
      [
        { id: 'center', label: 'center' },
        { id: 'normalize', label: 'normalize' },
        { id: 'density', label: 'density' },
        { id: 'trim', label: 'trim' },
        { id: 'fit', label: 'fit' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['subtract location', 'remove offset'],
        ['project to sphere', 'remove scale'],
        ['find dense angles', 'find consensus'],
        ['drop weak votes', 'resist outliers'],
        ['recover subspace', 'compress data'],
      ],
    ),
    highlight: { active: ['normalize:operation', 'density:operation', 'trim:operation'] },
    explanation: 'The robust recipe is simple to remember: remove offset, remove magnitude, find angular consensus, trim bad votes, then fit the low-dimensional subspace.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'outlier fraction', min: 0, max: 45 }, y: { label: 'subspace error', min: 0, max: 1.0 } },
      series: [
        { id: 'pca', label: 'PCA', points: [
          { x: 0, y: 0.06 }, { x: 10, y: 0.18 }, { x: 20, y: 0.45 }, { x: 30, y: 0.72 }, { x: 40, y: 0.92 },
        ] },
        { id: 'angular', label: 'trimmed angular', points: [
          { x: 0, y: 0.08 }, { x: 10, y: 0.11 }, { x: 20, y: 0.16 }, { x: 30, y: 0.26 }, { x: 40, y: 0.48 },
        ] },
      ],
    }),
    highlight: { active: ['angular'], compare: ['pca'] },
    explanation: 'The toy curve shows the expected shape: robust methods may pay a small cost on perfectly clean data, then degrade more slowly when outliers increase. The real paper validates this on synthetic and image outlier settings.',
    invariant: 'Robustness is a trade: slightly less efficient when clean, much less fragile when contaminated.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'raw', label: 'raw matrix', x: 0.8, y: 3.8, note: 'samples' },
        { id: 'pca', label: 'PCA', x: 3.0, y: 2.4, note: 'fast baseline' },
        { id: 'angular', label: 'angular RPCA', x: 3.0, y: 5.2, note: 'robust path' },
        { id: 'audit', label: 'outlier audit', x: 5.4, y: 5.2, note: 'trimmed rows' },
        { id: 'embed', label: 'low-rank reps', x: 7.6, y: 3.8, note: 'features' },
      ],
      edges: [
        { id: 'e-raw-pca', from: 'raw', to: 'pca', weight: '' },
        { id: 'e-raw-angular', from: 'raw', to: 'angular', weight: '' },
        { id: 'e-angular-audit', from: 'angular', to: 'audit', weight: '' },
        { id: 'e-pca-embed', from: 'pca', to: 'embed', weight: '' },
        { id: 'e-audit-embed', from: 'audit', to: 'embed', weight: '' },
      ],
    }, { title: 'Robust PCA belongs beside the baseline, not instead of it' }),
    highlight: { active: ['pca', 'angular'], found: ['embed'] },
    explanation: 'A practical workflow runs ordinary PCA and a robust alternative. If they agree, the data is probably clean enough. If they disagree, the disagreement is a diagnostic gift.',
  };

  yield {
    state: labelMatrix(
      'Where angular robustness helps',
      [
        { id: 'vision', label: 'vision' },
        { id: 'sensors', label: 'sensors' },
        { id: 'finance', label: 'finance' },
        { id: 'embeddings', label: 'embeddings' },
      ],
      [
        { id: 'outlier type', label: 'outlier' },
        { id: 'next topic', label: 'read next' },
      ],
      [
        ['corrupt pixels', 'Convolution'],
        ['bad device', 'Anomaly Detection'],
        ['shock days', 'Bootstrap CI'],
        ['bad clusters', 't-SNE/UMAP'],
      ],
    ),
    highlight: { found: ['vision:outlier type', 'sensors:outlier type', 'embeddings:outlier type'] },
    explanation: 'Angular robust PCA is a good bridge between linear algebra and practical data cleaning. It makes the influence of outliers visible instead of burying it inside a covariance matrix.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'outlier-resistant direction') yield* outlierResistantDirection();
  else if (view === 'trimmed angular density') yield* trimmedAngularDensity();
  else throw new InputError('Pick an angular robust PCA view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Angular robust PCA is a family of robust dimensionality-reduction ideas that protect principal components from large outliers by emphasizing direction rather than raw squared distance. Ordinary PCA finds directions of maximum variance through covariance. That is fast, interpretable, and useful, but covariance gives very large residuals very large influence. A few corrupted samples can rotate the first component away from the real inlier structure.',
        'The angular move is to normalize observations onto a sphere and look for dense agreement in direction. The 2020 paper "A New Angular Robust Principal Component Analysis" uses Angular Embedding and a trimmed variant to handle high-dimensional data and large outliers. The older "Angular Embedding: A Robust Quadratic Criterion" paper also frames local ordering information through angular geometry. The shared lesson is that angles can carry robust structure when magnitudes are untrustworthy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start by centering the data, or using a robust location estimate when the center itself may be contaminated. Normalize observations so each sample contributes a direction rather than an unbounded length. Estimate angular density or angular agreement to find the dominant subspace. Trim observations with weak or inconsistent angular support. Then recover a low-dimensional representation from the consensus structure.',
        'This differs from vanilla PCA in its influence behavior. PCA asks which direction maximizes total squared projection. Angular robust PCA asks which direction has stable directional support. A far-away corrupted image, sensor spike, or bad embedding can still vote, but it cannot buy unlimited influence merely by being far from the mean.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Robust methods usually cost more than ordinary PCA and can introduce extra knobs such as trimming percentage or neighborhood density. That is the price of not letting outliers dominate. In clean data, ordinary PCA may be more statistically efficient and simpler to explain. In contaminated data, robust PCA can recover a useful subspace where ordinary PCA mostly explains the corruption.',
        'A practical system should compare both. Fit PCA and robust PCA on training data only, inspect how much the components disagree, and look at the trimmed or downweighted points. If the robust path improves downstream validation, keep it. If it mainly removes legitimate minority structure, the trimming rule is too aggressive or the task needs a supervised model instead.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Angular robust PCA is relevant to image denoising, corrupted pixel detection, sensor fault analysis, finance shock filtering, embedding outlier audits, anomaly detection, and preprocessing before clustering or visualization. It connects directly to PCA: Principal Component Analysis, SVD & Low-Rank Approximation, Eigenvalues & Eigenvectors, t-SNE & UMAP: Seeing Embeddings, and Data Leakage & Contamination.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Robust does not mean correct under all contamination. If outliers form a dense aligned group, angular density can treat them as a legitimate direction. If rare but meaningful subpopulations are trimmed away, the method can hide exactly the cases the product or science cares about. Robust PCA is a diagnostic and preprocessing tool, not a substitute for understanding the data-generating process.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: A New Angular Robust Principal Component Analysis at https://arxiv.org/abs/2011.11013 and Angular Embedding: A Robust Quadratic Criterion at https://pubmed.ncbi.nlm.nih.gov/21576735/. Study PCA: Principal Component Analysis, SVD & Low-Rank Approximation, Eigenvalues & Eigenvectors, Embeddings & Similarity, Bootstrap Confidence Intervals, and Data Leakage & Contamination next.',
      ],
    },
  ],
};
