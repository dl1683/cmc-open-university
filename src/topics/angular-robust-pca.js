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
    explanation: 'Use this as the clean baseline. The inlier cloud has one obvious diagonal direction, so ordinary PCA does the right thing: it finds the line where the real data varies and ignores only small perpendicular noise.',
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
    explanation: 'Now add two far points and read the arrows as influence. PCA squares distance from the mean, so a small number of large residuals can buy enough leverage to rotate the principal direction away from the inlier pattern.',
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
    explanation: 'After normalization, every point lives on the unit circle. The inliers still agree on direction, but raw distance is gone, so an outlier can no longer dominate just by being far away.',
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
      heading: 'The problem',
      paragraphs: [
        `Principal Component Analysis finds low-dimensional structure by looking for directions of high variance. When the data is mostly clean, this is one of the best tools in applied linear algebra: it compresses correlated features, reveals dominant directions, denoises measurements, and gives a simple basis for downstream models. The problem is that PCA trusts squared distance from the mean. A point that is ten times farther away can have roughly one hundred times the influence on the covariance objective.`,
        `That influence is dangerous when a data set contains corrupted images, sensor spikes, bad rows, mislabeled examples, adversarial points, or rare ingestion failures. A few large outliers can rotate the first principal component away from the structure shared by most observations. Angular robust PCA is a response to that outlier-influence problem. It asks whether the data agree in direction after scale has been removed, then uses that directional consensus to recover a more stable subspace.`,
        {type: 'callout', text: 'Angular robust PCA limits outlier leverage by letting each centered row vote by direction before magnitude can dominate.'},
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        `The naive approach is ordinary PCA. Center the data, compute the covariance matrix or an SVD, and keep the top eigenvectors or singular vectors. This is fast, deterministic, and widely optimized. If the noise is roughly symmetric and not too heavy-tailed, PCA gives a useful best-fit linear subspace. It is also easy to explain: the first component is the direction where the centered data varies most.`,
        `The wall is outlier influence. PCA does not know whether a large residual is a meaningful signal or a broken measurement. It only sees that the residual contributes a large squared term. If a camera frame contains a corrupt block, a sensor reports an impossible value, or a transaction vector contains a one-off spike, vanilla PCA may spend its first component explaining the error. Removing rows by hand is possible, but manual deletion does not scale and can introduce its own bias.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The angular insight is to separate direction from magnitude. After centering, each observation can be projected onto the unit sphere by dividing by its norm. Once that happens, a far-away point no longer gets unlimited voting power merely because it is far away. It still contributes a direction, but it does not dominate the objective through raw length. The method then looks for angular density: many observations pointing in compatible directions.`,
        {type: 'image', src: 'https://arxiv.org/html/2011.11013/x1.png', alt: 'Angular robust PCA figure showing direction-based robustness against outliers.', caption: 'Angular normalization changes the outlier problem from raw distance to directional agreement. (Source: arxiv.org)'},
        `This does not mean magnitude is always noise. In many applications, length is meaningful. But when the main threat is gross contamination, directional agreement can be more trustworthy than squared residual size. The robust method changes the influence function. A corrupted sample can disagree, and a cluster of corrupted samples can still cause trouble, but a single large point has less ability to hijack the first component.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `A robust angular pipeline usually begins with centering. If the mean itself is contaminated, a robust location estimate may be needed, because subtracting a bad center can pollute every direction. Next, each centered observation is normalized onto the unit sphere. The algorithm estimates which directions are dense or mutually consistent. Points with weak support, unusual angles, or low density can be trimmed or downweighted. The final subspace is fit from the supported directions rather than from all raw squared distances.`,
        `The exact method can vary. Some approaches use angular embeddings, local angular neighborhoods, robust quadratic criteria, or trimmed estimators. The shared pattern is the same: remove offset, remove scale, find directional consensus, reduce outlier influence, then recover a low-rank representation. The result can still be represented as principal directions, but those directions came from a robust objective rather than ordinary covariance alone.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `The first animation view starts with clean points along a diagonal. Ordinary PCA is appropriate there: the first component runs through the inlier cloud and captures the main direction of variation. Then two far points are added. The clean component still describes the majority pattern, but the covariance component rotates because the outliers have outsized influence. The picture is deliberately small so the failure is visible.`,
        `The unit-circle frame shows the angular move. Every point is converted to a direction with length one. The inliers still cluster around a shared direction, while the outliers point elsewhere. They can still be noticed, but they cannot dominate merely through distance. The second view turns that intuition into a recipe: center, normalize, estimate angular density, trim weak votes, and fit the subspace. The comparison curve shows the usual trade: a small cost on clean data, slower degradation under contamination.`,
        {type: 'image', src: 'https://arxiv.org/html/2011.11013/x2.png', alt: 'Angular robust PCA comparison figure for contaminated data.', caption: 'Robust PCA should be judged by how the recovered subspace changes under contamination. (Source: arxiv.org)'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `PCA is fragile because the covariance matrix is an average of outer products. Outer products grow with magnitude, so extreme observations can dominate. Angular normalization bounds that particular route of influence. A point can change the angular density, but it cannot increase its vote by moving farther away along the same ray. This is why robust angular methods can recover the inlier direction in settings where vanilla PCA spends its capacity on large residuals.`,
        `Trimming adds another layer. If most points support a direction and a few points do not, a trimmed fit can ignore the weakly supported points when estimating the final subspace. The method is not magic; it relies on the assumption that inliers form a coherent angular pattern and outliers are not the majority. Under that assumption, directional consensus is a better guide than unbounded squared error.`,
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        `Robust PCA methods usually cost more than ordinary PCA. Normalization is cheap, but angular density estimation, neighborhood construction, trimming, repeated fitting, or robust location estimation can add runtime and memory. There are also tuning choices: trim fraction, density bandwidth, number of components, stopping criteria, and whether to run a baseline PCA beside the robust method. These choices affect both accuracy and interpretability.`,
        `The statistical cost is also real. On perfectly clean Gaussian-like data, ordinary PCA can be more efficient because it uses all magnitude information. Angular robust PCA intentionally throws away or downweights some of that information to gain resistance to contamination. The engineering decision is therefore empirical: compare validation error, reconstruction quality, downstream task performance, and the identity of trimmed points before declaring the robust method better.`,
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        `The largest tradeoff is between robustness and sensitivity to rare legitimate structure. If a rare disease subgroup, fraud pattern, machine state, or product category points in a different direction, aggressive trimming may label it as an outlier. That can make the main reconstruction cleaner while hiding the cases the analyst cares about. Robust preprocessing should therefore produce an audit trail of trimmed rows, not just a cleaned matrix.`,
        `Another tradeoff is interpretability. Ordinary PCA has a clean covariance story. Angular robust PCA has a more complex pipeline, especially when density estimation and trimming are involved. That complexity is acceptable when outliers are common and costly, but it should be justified. A good workflow fits both PCA and angular robust PCA, compares the subspaces, inspects disagreements, and checks whether the robust path improves a concrete downstream objective.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Angular robust PCA is useful for image data with corrupt frames or occlusions, sensor arrays with malfunctioning devices, finance data with shock days, industrial telemetry with spikes, embedding spaces with bad clusters, and preprocessing before clustering or visualization. It is especially attractive when the expected signal is a low-dimensional direction shared by many observations, while contamination is large in magnitude and relatively sparse.`,
        `It is also useful as a diagnostic. If ordinary PCA and angular robust PCA agree, the dominant subspace is probably not being driven by a few gross outliers. If they disagree sharply, the disagreement points to rows, features, or collection windows that deserve inspection. In production analytics, that diagnostic role can be as valuable as the final components because it tells the team where the data pipeline may be lying.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The method can fail when outliers form their own dense angular group. If many corrupted observations share a direction, angular density may treat them as a real component. It can also fail when the inlier structure is not well described by a linear subspace, when magnitude is the signal of interest, or when the chosen center is badly contaminated. Robustness at the direction stage does not repair every upstream data problem.`,
        `It can also fail through misuse. Running robust PCA on the full dataset before train-test splitting can leak information. Trimming based on the entire corpus can remove examples from the test distribution in a way that flatters evaluation. Using the method without inspecting removed rows can encode a business or scientific bias: the algorithm may be deleting inconvenient minority cases rather than measurement errors.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Watch for unstable components across random seeds, trim fractions, or bootstrap samples. If a tiny change in trimming moves the first component dramatically, the data may not contain a stable low-dimensional structure. Watch for trimmed rows that share a real label, geography, demographic group, device type, or time period. That pattern suggests the method is removing a subpopulation, not random corruption.`,
        `Also watch for preprocessing mistakes. Scaling features incorrectly can change directions. Centering with a contaminated mean can put every normalized point on the wrong sphere. Treating sparse high-dimensional data as dense Euclidean observations can create misleading angles. In embedding applications, two-dimensional projections can make a robust result look cleaner than it is. Always validate in the original feature space and in the downstream task.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Study PCA: Principal Component Analysis first, then SVD & Low-Rank Approximation and Eigenvalues & Eigenvectors for the linear algebra. Study Bootstrap Confidence Intervals to measure component stability, Anomaly Detection for outlier framing, t-SNE & UMAP: Seeing Embeddings for visualization cautions, and Data Leakage & Contamination for evaluation risks. Embeddings & Similarity is a useful companion because high-dimensional embeddings often need outlier audits before clustering or retrieval.`,
        `Primary sources include A New Angular Robust Principal Component Analysis at https://arxiv.org/abs/2011.11013 and Angular Embedding: A Robust Quadratic Criterion at https://pubmed.ncbi.nlm.nih.gov/21576735/. When reading papers or implementations, look for the exact centering rule, normalization rule, trimming criterion, and validation setup. Those details decide whether the method is robust to corruption or merely another opaque preprocessing step.`,
      ],
    },
  ],
};
