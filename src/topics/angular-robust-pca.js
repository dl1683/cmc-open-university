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
  const numClean = CLEAN_POINTS.length;
  yield {
    state: scatterState({
      axes: { x: { label: 'feature 1', min: 0, max: 10 }, y: { label: 'feature 2', min: 0, max: 9 } },
      points: CLEAN_POINTS,
    }),
    highlight: { active: ['p0', 'p7'] },
    explanation: `Use these ${numClean} points as the clean baseline. The inlier cloud has one obvious diagonal direction from (${CLEAN_POINTS[0].x},${CLEAN_POINTS[0].y}) to (${CLEAN_POINTS[numClean - 1].x},${CLEAN_POINTS[numClean - 1].y}), so ordinary PCA does the right thing: it finds the line where the real data varies and ignores only small perpendicular noise.`,
  };

  const allPoints = [...CLEAN_POINTS, ...OUTLIERS];
  const numOutliers = OUTLIERS.length;
  yield {
    state: plotState({
      axes: { x: { label: 'feature 1', min: 0, max: 10 }, y: { label: 'feature 2', min: 0, max: 9 } },
      markers: allPoints,
      vectors: [
        { id: 'cleanPc', from: { x: 4.5, y: 3.5 }, to: { x: 7.5, y: 5.5 }, label: 'clean PC' },
        { id: 'badPc', from: { x: 4.8, y: 4.0 }, to: { x: 4.4, y: 7.0 }, label: 'dragged PC' },
      ],
    }),
    highlight: { active: ['o0', 'o1'], compare: ['badPc'], found: ['cleanPc'] },
    explanation: `Now add ${numOutliers} far points to the ${numClean} inliers (${allPoints.length} total) and read the arrows as influence. PCA squares distance from the mean, so a small number of large residuals can buy enough leverage to rotate the principal direction away from the inlier pattern.`,
    invariant: `Squared-distance methods let ${numOutliers} large residuals buy disproportionate influence over ${numClean} inliers.`,
  };

  const inlierMarkers = [
    { id: 'a0', x: 0.77, y: 0.64, label: 'inlier' },
    { id: 'a1', x: 0.80, y: 0.60, label: 'inlier' },
    { id: 'a2', x: 0.73, y: 0.68, label: 'inlier' },
  ];
  const outlierMarkers = [
    { id: 'b0', x: -0.1, y: 0.99, label: 'outlier' },
    { id: 'b1', x: 0.98, y: -0.18, label: 'outlier' },
  ];
  yield {
    state: plotState({
      axes: { x: { label: 'unit direction x', min: -1.1, max: 1.1 }, y: { label: 'unit direction y', min: -1.1, max: 1.1 } },
      series: [
        { id: 'circle', label: 'unit circle', points: [
          { x: 1.0, y: 0.0 }, { x: 0.7, y: 0.7 }, { x: 0.0, y: 1.0 }, { x: -0.7, y: 0.7 },
          { x: -1.0, y: 0.0 }, { x: -0.7, y: -0.7 }, { x: 0.0, y: -1.0 }, { x: 0.7, y: -0.7 }, { x: 1.0, y: 0.0 },
        ] },
      ],
      markers: [...inlierMarkers, ...outlierMarkers],
    }),
    highlight: { found: inlierMarkers.map(m => m.id), compare: outlierMarkers.map(m => m.id) },
    explanation: `After normalization, all ${inlierMarkers.length + outlierMarkers.length} points live on the unit circle. The ${inlierMarkers.length} inliers still agree on direction, but raw distance is gone, so the ${outlierMarkers.length} outliers can no longer dominate just by being far away.`,
  };

  const methods = [
    { id: 'PCA', label: 'PCA' },
    { id: 'AR-PCA', label: 'AR-PCA' },
  ];
  yield {
    state: labelMatrix(
      'Vanilla PCA vs angular robust PCA',
      [
        { id: 'input', label: 'input' },
        { id: 'influence', label: 'influence' },
        { id: 'fit', label: 'fit target' },
        { id: 'failure', label: 'failure' },
      ],
      methods,
      [
        ['raw centered points', 'unit directions'],
        ['distance squared', 'angular density'],
        ['max variance', 'stable direction'],
        ['large outliers', 'many aligned outliers'],
      ],
    ),
    highlight: { active: ['influence:PCA', 'influence:AR-PCA'], found: ['fit:AR-PCA'] },
    explanation: `The robust version (${methods[1].label}) does not make ${methods[0].label} obsolete. It changes the influence function: a point can vote by direction, but its raw distance cannot hijack the fit.`,
  };
}

function* trimmedAngularDensity() {
  const pipelineSteps = [
    { id: 'center', label: 'center' },
    { id: 'normalize', label: 'normalize' },
    { id: 'density', label: 'density' },
    { id: 'trim', label: 'trim' },
    { id: 'fit', label: 'fit' },
  ];
  yield {
    state: labelMatrix(
      'Angular robust pipeline',
      pipelineSteps,
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
    explanation: `The robust recipe has ${pipelineSteps.length} steps: ${pipelineSteps.map(s => s.label).join(', ')}. Remove offset, remove magnitude, find angular consensus, trim bad votes, then fit the low-dimensional subspace.`,
  };

  const pcaCleanError = 0.06;
  const angularCleanError = 0.08;
  const pcaMaxError = 0.92;
  const angularMaxError = 0.48;
  yield {
    state: plotState({
      axes: { x: { label: 'outlier fraction', min: 0, max: 45 }, y: { label: 'subspace error', min: 0, max: 1.0 } },
      series: [
        { id: 'pca', label: 'PCA', points: [
          { x: 0, y: pcaCleanError }, { x: 10, y: 0.18 }, { x: 20, y: 0.45 }, { x: 30, y: 0.72 }, { x: 40, y: pcaMaxError },
        ] },
        { id: 'angular', label: 'trimmed angular', points: [
          { x: 0, y: angularCleanError }, { x: 10, y: 0.11 }, { x: 20, y: 0.16 }, { x: 30, y: 0.26 }, { x: 40, y: angularMaxError },
        ] },
      ],
    }),
    highlight: { active: ['angular'], compare: ['pca'] },
    explanation: `The toy curve shows the expected shape: at 0% outliers PCA error is ${pcaCleanError} vs angular ${angularCleanError}, but at 40% outliers PCA degrades to ${pcaMaxError} while angular stays at ${angularMaxError}. Robust methods pay a small clean-data cost and degrade more slowly under contamination.`,
    invariant: `Robustness is a trade: the clean-data gap is only ${(angularCleanError - pcaCleanError).toFixed(2)} but the contaminated gap is ${(pcaMaxError - angularMaxError).toFixed(2)}.`,
  };

  const paths = ['pca', 'angular'];
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
    highlight: { active: paths, found: ['embed'] },
    explanation: `A practical workflow runs ${paths.length} paths — ordinary ${paths[0].toUpperCase()} and a robust ${paths[1]} alternative. If they agree, the data is probably clean enough. If they disagree, the disagreement is a diagnostic gift.`,
  };

  const domains = [
    { id: 'vision', label: 'vision' },
    { id: 'sensors', label: 'sensors' },
    { id: 'finance', label: 'finance' },
    { id: 'embeddings', label: 'embeddings' },
  ];
  yield {
    state: labelMatrix(
      'Where angular robustness helps',
      domains,
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
    explanation: `Angular robust PCA applies across ${domains.length} domains — ${domains.map(d => d.label).join(', ')} — bridging linear algebra and practical data cleaning. It makes the influence of outliers visible instead of burying it inside a covariance matrix.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The first view shows 8 clean points on a diagonal, then adds 2 outliers so you can watch the principal component rotate away from the true pattern. A unit-circle frame strips magnitude and shows the same points as pure directions. The second view walks through the 5-step pipeline (center, normalize, density, trim, fit) and plots subspace error against outlier fraction so you can see the robustness gap grow.',
        {type: 'image', src: './assets/gifs/angular-robust-pca.gif', alt: 'Animated walkthrough of the angular robust pca visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Green highlights mark inlier structure. Red marks outlier influence or the dragged component. The comparison curve at the end is the key deliverable: it shows how fast each method degrades as contamination increases.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'PCA finds directions of maximum variance by computing the covariance matrix, which is a sum of outer products. Each outer product scales with the square of the observation\'s distance from the mean. A point 10x farther out contributes roughly 100x more to that sum. When the data is clean, this is fine. When a sensor spikes, a frame corrupts, or a transaction vector contains a one-off error, a handful of large residuals can rotate the first principal component away from the structure shared by 95% of the rows.',
        'Angular robust PCA exists because the standard fix (manually removing outliers) does not scale and introduces its own bias. The method asks a different question: do the observations agree in direction after we strip away magnitude? That question is naturally resistant to the specific failure mode that makes vanilla PCA fragile.',
        {type: 'callout', text: 'Angular robust PCA limits outlier leverage by letting each centered row vote by direction before magnitude can dominate.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is ordinary PCA. Center the data, compute the covariance matrix (or take the SVD), keep the top eigenvectors. It is fast, deterministic, widely optimized, and easy to explain: the first component is the direction of maximum variance. On roughly Gaussian data with moderate noise, PCA gives you the best linear subspace in a least-squares sense.',
        'You can also try simple outlier removal before PCA: delete rows beyond some threshold. But the threshold depends on the distribution you haven\'t estimated yet, and cutting too aggressively can remove legitimate rare structure. In high dimensions, almost every point looks far from the mean, so a fixed distance cutoff becomes unreliable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'PCA does not distinguish between a large residual that is meaningful signal and one that is a broken measurement. Both contribute the same squared outer product to the covariance matrix. Two outliers among 8 inliers can rotate the first component by tens of degrees, and PCA has no mechanism to notice or correct this. The animation shows exactly this: the "dragged PC" arrow points in a visibly wrong direction.',
        'Manual cleaning does not scale to millions of rows, and automated z-score filtering is circular (you need the PCA subspace to identify outliers, but you need clean data to compute the subspace). The squared-distance influence function is the root of the problem, and no amount of careful preprocessing within the standard PCA framework can fix it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate direction from magnitude. After centering, divide each observation by its norm to project it onto the unit sphere. Now a point that was 10x farther away sits on the same sphere as every other point. It still votes with a direction, but it cannot amplify that vote by being large. The question shifts from "where is the variance?" to "where do the directions agree?"',
        {type: 'image', src: 'https://arxiv.org/html/2011.11013/x1.png', alt: 'Angular robust PCA figure showing direction-based robustness against outliers.', caption: 'Angular normalization changes the outlier problem from raw distance to directional agreement. (Source: arxiv.org)'},
        'This is the key change in the influence function. In standard PCA, influence grows quadratically with distance. After angular normalization, influence is bounded. A corrupted observation can still disagree with the majority, but it cannot buy disproportionate weight by being far away. The method then looks for angular density: which directions have many observations pointing at them?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline has 5 steps. First, center the data by subtracting a location estimate (if the mean itself might be contaminated, use a robust location like the geometric median). Second, normalize each centered row to unit length, projecting everything onto the unit sphere. Third, estimate angular density to find which directions have strong support from many observations. Fourth, trim or downweight the directions with low angular density, since those are the candidate outliers. Fifth, fit the subspace from the surviving high-density directions.',
        'The exact density estimator varies by implementation. Some use kernel density on the sphere, others use angular neighborhoods or robust quadratic criteria. The shared principle is the same: offset removal, scale removal, directional consensus, trimming, then subspace recovery. The output is still a set of principal directions, but they come from a robust angular objective rather than raw covariance.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The covariance matrix is an average of rank-1 outer products x*x^T. Each product scales with ||x||^2, so extreme observations dominate the sum. Angular normalization caps ||x|| at 1 for every observation. A point can change the angular density landscape, but it cannot increase its contribution by moving farther along the same ray. This is why the angular method recovers the inlier direction even when vanilla PCA has rotated away from it.',
        'Trimming adds a second defense. Even on the unit sphere, a few outlier directions might disagree with the majority. Density-based trimming identifies and removes these sparse directions before fitting. The method assumes that inliers form a coherent angular cluster and outliers are relatively sparse. Under that assumption, directional consensus plus trimming is a more reliable guide than unbounded squared error.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Ordinary PCA on an n-by-d matrix costs O(nd*min(n,d)) via SVD. Angular robust PCA adds normalization (O(nd), cheap), angular density estimation (varies; kernel methods can cost O(n^2*d) naively, though approximate methods reduce this), and trimming (O(n log n) for sorting). The total is typically dominated by the density step. For large datasets, approximate nearest-neighbor density estimators or subsampled kernels bring cost back toward practical.',
        'There is also a statistical cost. On perfectly clean Gaussian data, PCA is more efficient because it uses all magnitude information. Angular robust PCA intentionally discards that information to gain contamination resistance. The clean-data penalty is small (the animation shows error 0.08 vs 0.06), but it is real. You also pick up tuning parameters: trim fraction, density bandwidth, and number of components. Each is a decision that affects both accuracy and interpretability.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Computer vision: corrupt frames, occluded regions, or sensor noise create large outliers in image matrices. Angular robust PCA recovers the background subspace without letting a few bad frames dominate. Sensor networks: a malfunctioning device produces spikes that vanilla PCA treats as signal. Finance: shock days (flash crashes, earnings surprises) can rotate the market-factor subspace if PCA is refit naively.',
        'Embedding spaces: after training a language or vision model, the embedding matrix often contains bad clusters from noisy training data. Robust PCA before downstream clustering or retrieval prevents these bad clusters from distorting the low-rank approximation. Angular robust PCA also works as a diagnostic: if it and vanilla PCA agree, your data is probably clean enough. If they disagree sharply, the disagreement points to specific rows, features, or time windows that deserve inspection.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If outliers form their own dense angular cluster, the method can mistake them for a real component. Ten corrupted rows all pointing the same way look like legitimate structure on the unit sphere. The method also fails when magnitude is the actual signal of interest (some applications care about how far, not just which direction) or when the inlier structure is not well described by a linear subspace.',
        'Misuse is a common failure mode. Running robust PCA on the full dataset before train-test splitting leaks information. Trimming based on the entire corpus can remove test-distribution examples in a way that flatters evaluation. If trimmed rows share a real demographic, device type, or time period, the algorithm is silently removing a subpopulation rather than measurement errors. Always inspect what was trimmed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The animation starts with 8 clean points along a diagonal from (1.0, 1.2) to (8.0, 5.8). Ordinary PCA finds the correct direction. Now add 2 outliers at (2.0, 8.4) and (8.7, 1.2), making 10 total points with 20% contamination. The first principal component visibly rotates away from the inlier cloud because those 2 points contribute large squared residuals to the covariance sum.',
        'Next, normalize all 10 centered points to unit length. The 8 inliers cluster tightly around a shared direction on the unit circle (roughly 0.77, 0.64). The 2 outliers land elsewhere (approximately -0.1, 0.99 and 0.98, -0.18) but now have exactly the same norm as every inlier. Angular density estimation finds the dense cluster, trims the 2 sparse directions, and fits the subspace from the remaining 8. The recovered direction matches the clean PCA direction.',
        'The degradation curve makes the payoff concrete. At 0% outliers, PCA error is 0.06 and angular error is 0.08, a gap of 0.02 that is the cost of discarding magnitude. At 40% outliers, PCA error explodes to 0.92 while angular error is only 0.48, a gap of 0.44 in favor of the robust method. The crossover happens quickly: even at 10% contamination, PCA is already at 0.18 while angular is at 0.11. The small clean-data tax buys large contamination insurance.',
        {type: 'image', src: 'https://arxiv.org/html/2011.11013/x2.png', alt: 'Angular robust PCA comparison figure for contaminated data.', caption: 'Robust PCA should be judged by how the recovered subspace changes under contamination. (Source: arxiv.org)'},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: A New Angular Robust Principal Component Analysis (https://arxiv.org/abs/2011.11013) introduces the angular normalization framework. Angular Embedding: A Robust Quadratic Criterion (https://pubmed.ncbi.nlm.nih.gov/21576735/) provides the quadratic angular formulation. Both papers reward careful reading of the centering rule, normalization rule, and trimming criterion, since those details determine whether the method actually achieves robustness or is just another opaque preprocessing step.',
        'Study PCA: Principal Component Analysis first for the baseline. SVD & Low-Rank Approximation and Eigenvalues & Eigenvectors cover the linear algebra foundations. Bootstrap Confidence Intervals helps measure component stability. Anomaly Detection gives the broader outlier framing. t-SNE & UMAP: Seeing Embeddings covers visualization cautions. Embeddings & Similarity is a natural companion since high-dimensional embedding matrices often need outlier audits before clustering or retrieval.',
      ],
    },
  ],
};
