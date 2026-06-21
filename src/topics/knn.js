// K-Nearest Neighbors: classify by majority vote of the k closest training
// points. No training phase, no parameter fitting — the data is the model.

import { scatterState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'knn',
  title: 'K-Nearest Neighbors',
  category: 'AI & ML',
  summary: 'Classify by majority vote of the k closest training points — no training, no assumptions, the data is the model.',
  controls: [
    { id: 'k', label: 'Neighbors (k)', type: 'select', options: ['1', '3', '5'], defaultValue: '3' },
  ],
  run,
};

// Fixed 2D dataset: two clusters (A near bottom-left, B near top-right) and
// a query point in the ambiguous middle. Deterministic so the lesson is the
// algorithm, not the randomness.
const TRAINING = [
  { x: 1.0, y: 1.0, label: 'A' },
  { x: 2.0, y: 1.0, label: 'A' },
  { x: 1.5, y: 2.0, label: 'A' },
  { x: 1.0, y: 2.5, label: 'A' },
  { x: 2.5, y: 1.5, label: 'A' },
  { x: 5.0, y: 5.0, label: 'B' },
  { x: 6.0, y: 5.0, label: 'B' },
  { x: 5.0, y: 6.0, label: 'B' },
  { x: 6.5, y: 6.0, label: 'B' },
  { x: 5.5, y: 5.5, label: 'B' },
];

const QUERY = { x: 3.0, y: 3.0 };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function* run(input) {
  const k = parseIntegerInRange(input.k, { min: 1, max: 5, label: 'k' });

  // Assign cluster ids: 0 = class A, 1 = class B.
  const clusterOf = (label) => (label === 'A' ? 0 : 1);
  const points = TRAINING.map((p, i) => ({
    id: `p${i}`, x: p.x, y: p.y, label: p.label, clusterId: clusterOf(p.label),
  }));
  const queryId = 'q0';

  const axes = { x: { label: 'x' }, y: { label: 'y' } };

  const snapshot = (extraPoints = [], centroids = []) => scatterState({
    points: [...points, ...extraPoints],
    centroids,
    axes,
  });

  // Step 1: show training data.
  yield {
    state: snapshot(),
    highlight: {},
    explanation: `${TRAINING.length} labeled training points from two classes. Blue dots (cluster 0) are class A; orange dots (cluster 1) are class B. KNN stores all of them — there is no training phase, no parameters to fit. The data IS the model.`,
  };

  // Step 2: query point appears.
  const queryPoint = { id: queryId, x: QUERY.x, y: QUERY.y, label: '?', clusterId: null };
  yield {
    state: snapshot([queryPoint]),
    highlight: { active: [queryId] },
    explanation: `A new point appears at (${QUERY.x}, ${QUERY.y}) with unknown class. To classify it, KNN will measure how far it is from every training point, find the ${k} closest, and let them vote.`,
  };

  // Step 3: compute distances to all training points.
  const distances = TRAINING.map((p, i) => ({
    index: i,
    id: `p${i}`,
    label: p.label,
    dist: dist(QUERY, p),
  }));

  // Show distance computation — highlight each point as we measure.
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i];
    yield {
      state: snapshot([queryPoint]),
      highlight: { active: [queryId], compare: [d.id] },
      explanation: `Distance from query to ${d.label}-point at (${TRAINING[i].x}, ${TRAINING[i].y}): ${d.dist.toFixed(2)}. Every training point gets measured — KNN's cost is one distance calculation per training point, per query.`,
    };
  }

  // Step 4: sort by distance and highlight the k nearest.
  distances.sort((a, b) => a.dist - b.dist);
  const nearest = distances.slice(0, k);
  const nearestIds = nearest.map((n) => n.id);

  yield {
    state: snapshot([queryPoint]),
    highlight: { active: [queryId], found: nearestIds },
    explanation: `The ${k} nearest neighbors are: ${nearest.map((n) => `${n.label} (d=${n.dist.toFixed(2)})`).join(', ')}. These are the voters. Every other training point is ignored — only local structure matters.`,
  };

  // Step 5: majority vote.
  const votes = { A: 0, B: 0 };
  for (const n of nearest) {
    votes[n.label] += 1;
  }
  const winner = votes.A >= votes.B ? 'A' : 'B';

  yield {
    state: snapshot([queryPoint]),
    highlight: { active: [queryId], found: nearestIds },
    explanation: `Majority vote: ${votes.A} vote${votes.A === 1 ? '' : 's'} for A, ${votes.B} vote${votes.B === 1 ? '' : 's'} for B. Class ${winner} wins. No weights, no learned boundaries — just counting hands among the nearest ${k}.`,
    invariant: 'The predicted class is the most common label among the k nearest training points.',
  };

  // Step 6: classify the query point.
  const classifiedQuery = { id: queryId, x: QUERY.x, y: QUERY.y, label: winner, clusterId: clusterOf(winner) };
  yield {
    state: snapshot([classifiedQuery]),
    highlight: { found: [queryId, ...nearestIds] },
    explanation: `Query classified as ${winner}. The decision boundary was never computed explicitly — it emerges implicitly from the data layout and the choice of k. Change k and the boundary shifts: k=1 follows the single nearest point (noisy), large k smooths but can blur real boundaries.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Blue dots are class A training points; orange dots are class B. The query point appears with a ? label and gets highlighted as active.',
        { type: 'callout', text: 'KNN is lazy supervised learning: the training set stays as the model, and prediction is local voting around the query.' },
        'During distance computation, each training point lights up as compare while its distance to the query is measured. After sorting, the k nearest neighbors are marked found.',
        'The final frame shows the query point colored by its predicted class. Watch how changing k changes which neighbors vote and potentially flips the outcome.',
      
        {type: 'image', src: './assets/gifs/knn.gif', alt: 'Animated walkthrough of the knn visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Classification is one of the oldest problems in statistics and machine learning: given labeled examples, predict the label for a new observation. A doctor sees a tumor\'s measurements and needs to say benign or malignant. A spam filter sees word frequencies and needs to say inbox or junk.',
        'Most classifiers learn a compact model — a set of weights, a tree, a boundary equation — then discard the training data. KNN takes the opposite approach: keep everything, compute at query time. The training data is not summarized into parameters. The training data IS the model.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Classify a new data point. Train a model (logistic regression, neural network, decision tree) — learn parameters from training data, then discard the training data. KNN (Fix & Hodges 1951): don\'t learn anything. Keep all training data. To classify a new point: find the k closest training points, take a majority vote. k=1: assign the label of the nearest neighbor. k=5: the 5 nearest neighbors vote. That\'s the entire algorithm — no training phase, no parameters, no optimization.',
        '"Lazy learning": all computation happens at prediction time. Distance: typically Euclidean (√(Σ(x_i−y_i)²)), but Manhattan, Minkowski, or cosine work too. The decision boundary is a Voronoi diagram — each training point "owns" the region of space closest to it.',
        'Strengths: simple, no assumptions about data distribution, works for any number of classes, naturally handles multi-modal distributions. Weaknesses: prediction is O(n·d) per query (compute distance to every training point), memory-intensive (store all data), and the curse of dimensionality — in high dimensions, all points become equidistant. KD-tree or ball tree accelerate to O(d·log n) in low dimensions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'KNN pays for its simplicity at query time. Every query scans every training point: O(n) distance calculations, each costing O(d) for d-dimensional data. With a million training points and 100 features, that is 100 million floating-point operations per query.',
        'The deeper wall is the curse of dimensionality. In high dimensions, distances concentrate: the farthest point and the nearest point become almost equally far from the query. When all distances are nearly equal, "nearest" loses its meaning and majority vote becomes random. Beyer et al. (1999) proved that under broad conditions, the ratio of max distance to min distance converges to 1 as dimensions grow.',
        'These two walls — linear scan cost and dimensional collapse — are why KNN works beautifully on small, low-dimensional datasets and struggles on the problems where you most want it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Local structure contains classification signal. Points that are close in feature space tend to share labels, because the features encode something real about the underlying phenomenon. A tumor near other benign tumors in size-shape-density space is probably benign too.',
        'This is the smoothness assumption: the label function does not change abruptly between nearby points. KNN does not need the assumption to hold everywhere — only in the local neighborhood of each query. That is why it handles irregular boundaries that trip up global models.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Store all training points with their labels. When a query arrives: (1) compute the distance from the query to every training point, (2) sort or select the k smallest distances, (3) count labels among those k neighbors, (4) return the majority label. Ties can be broken by distance-weighting or by reducing k by one.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/KnnClassification.svg', alt: 'K nearest neighbors classification diagram with two classes and a query point', caption: 'The query changes class as k changes because the vote boundary is determined by local neighbors, not a learned global equation. Source: https://commons.wikimedia.org/wiki/File:KnnClassification.svg.' },
        'The distance metric matters. Euclidean distance is the default, but it weights all features equally. If one feature ranges from 0 to 1000 and another from 0 to 1, the first feature dominates. Normalizing features (z-score or min-max) is almost always necessary. Manhattan distance, Minkowski distance, and cosine similarity are alternatives that suit different data shapes.',
        'The choice of k controls the bias-variance tradeoff. k=1 memorizes the training set — zero training error, but every query follows the single nearest point, which may be noise. Large k smooths the boundary but can merge distinct classes. Odd k avoids ties in two-class problems. Cross-validation on held-out data is the standard way to pick k.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Cover and Hart (1967) proved the foundational result: as the number of training points goes to infinity, the error rate of 1-nearest-neighbor is at most twice the Bayes optimal error rate. The Bayes rate is the theoretical minimum — the best any classifier can achieve given the noise in the data. So even the simplest version of KNN (k=1) gets within a factor of two of perfection, with no model design at all.',
        'The proof relies on the smoothness assumption: in a dense enough sample, the nearest neighbor\'s label distribution converges to the true class probabilities at the query point. As k grows (but k/n shrinks to zero), the k-nearest-neighbor vote converges to the Bayes optimal classifier itself. The algorithm is universally consistent — it learns any measurable decision boundary given enough data.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training: O(1) — just store the data. There is nothing to compute upfront, which is why KNN is called a lazy learner.',
        'Query: O(n * d) where n is the number of training points and d is the number of features. You can avoid the full sort with a partial-select algorithm (quickselect) to find the k-th smallest in O(n) average time, but you still scan every point.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Kdtree_2d.svg', alt: 'Two-dimensional k-d tree partition used for nearest neighbor search', caption: 'Low-dimensional neighbor search can use k-d tree region pruning, but the advantage fades as dimension rises. Source: https://commons.wikimedia.org/wiki/File:Kdtree_2d.svg.' },
        'Memory: O(n * d) — the entire training set lives in memory. A million points with 100 features at 8 bytes each is 800 MB. This is the opposite of a neural network, which compresses training data into a fixed-size weight matrix.',
        'When n doubles, query time doubles. When d doubles, each distance calculation doubles. KD-trees reduce average query time to O(d * log n) in low dimensions, but degrade to O(n) as d grows past about 20. Approximate methods like locality-sensitive hashing (LSH) trade exact answers for sublinear query time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Recommendation systems use KNN on user-item similarity: find the k users most similar to you, recommend what they liked. Collaborative filtering is KNN in disguise.',
        'Anomaly detection: if a point\'s k nearest neighbors are all far away, or if it is far from the average of its neighborhood, flag it. This works without labeled anomaly examples.',
        'Missing-value imputation: replace a missing feature with the average of that feature among the k nearest complete neighbors. This preserves local structure better than global mean imputation.',
        'Image classification on small datasets: before deep learning, KNN on pixel features (or extracted features) was a competitive baseline. The MNIST digit dataset can reach ~97% accuracy with KNN and no learned features at all.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'High dimensions: distance concentration makes neighbors uninformative. With 1000 features and moderate sample size, KNN performs no better than random guessing unless you first reduce dimensionality (PCA, autoencoders, feature selection).',
        'Imbalanced classes: if 95% of training points are class A, the k nearest neighbors of any query are likely to include mostly A regardless of the query\'s true class. Remedies include distance-weighted voting, resampling the minority class, or adjusting the decision threshold.',
        'Large datasets: scanning a billion points per query is impractical. Approximate nearest neighbor structures (KD-tree, ball tree, LSH, HNSW) help, but each adds complexity and approximation error. At scale, most practitioners switch to learned models that compress the training signal into fast-to-evaluate parameters.',
        'Feature scaling: unnormalized features silently break KNN. A single feature with a large numeric range can dominate the distance metric, making all other features irrelevant. This is not a failure of the algorithm — it is a failure of preprocessing that the algorithm cannot correct.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Training data: five class-A points near (1-2, 1-2) and five class-B points near (5-6, 5-6). Query point: (3, 3). With k=3:',
        'Distances: the three closest points are A at (2.5, 1.5) with d=1.58, A at (1.5, 2.0) with d=1.80, and A at (2.0, 1.0) with d=2.24. All three are class A. Vote: 3-0 for A. The query is classified as A.',
        'Now try k=1: only the single nearest point votes — A at (2.5, 1.5). Still A, but the classification is fragile: one noisy point near the query could flip it. Try k=5: the five nearest points are the same three plus A at (1.0, 2.5) and A at (1.0, 1.0). Still unanimously A — the query at (3, 3) is firmly in A territory because B\'s cluster is too far away.',
        'Move the query to (4, 4) and the story changes. The nearest neighbors now include points from both classes, and the vote outcome depends on k. That transition zone is the implicit decision boundary — never computed, always present.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Fix & Hodges 1951 (Discriminatory Analysis — original KNN paper). Cover & Hart 1967 (Nearest Neighbor Pattern Classification — proved error bound ≤ 2× Bayes optimal as n→∞). Friedman, Bentley & Finkel 1977 (KD-trees for efficient NN search).',
        'Study next: K-Means (unsupervised clustering, commonly confused with KNN), Decision Tree (another interpretable classifier), KD-Tree (efficient nearest neighbor search), Voronoi Diagram (the geometric structure KNN creates), Curse of Dimensionality (why KNN fails in high dims).',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Prerequisites: you should understand Linear Search (KNN\'s query phase is a linear scan) and basic distance calculation (Pythagorean theorem in 2D). Familiarity with Big-O notation helps for cost discussions.',
        'After this topic: K-Means Clustering uses the same distance-to-centroid idea but for unsupervised grouping instead of supervised classification. KD-Tree and Ball Tree accelerate the neighbor search that dominates KNN\'s cost. PCA and dimensionality reduction techniques address the curse of dimensionality that limits KNN in high-dimensional spaces.',
        'The deeper unlock is understanding the bias-variance tradeoff through k: k=1 has zero bias and maximum variance (overfitting); large k has high bias and low variance (underfitting). This tradeoff governs every machine learning algorithm, and KNN makes it visible by letting you literally count the voters.',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        '2D training data: A(1,1,red), B(2,2,red), C(5,5,blue), D(6,6,blue), E(3,4,blue). Classify point Q(3,3). Distances: d(Q,A)=√8≈2.83, d(Q,B)=√2≈1.41, d(Q,C)=√8≈2.83, d(Q,D)=√18≈4.24, d(Q,E)=√1=1.0.',
        'k=1: nearest is E(blue) → predict blue. k=3: nearest are E(blue,1.0), B(red,1.41), A(red,2.83) or C(blue,2.83). Tie-breaking: if C chosen → 2 blue, 1 red → blue. If A chosen → 2 red, 1 blue → red. k=3 gives different answers depending on tie-breaking! k=5: 3 blue, 2 red → blue. Larger k smooths out noise but blurs boundaries.',
        'Can you explain why k should be odd for binary classification? [Avoids ties in the majority vote.]',
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Effect of k: 1D data, train: [1(A), 2(A), 3(A), 7(B), 8(B), 9(B)], classify x=5. k=1: nearest is 3(A), dist=2. Predict A. k=3: nearest are 3(A,2), 7(B,2), 8(B,3). Predict B (2 vs 1). k=5: 2(A,3), 3(A,2), 7(B,2), 8(B,3), 9(B,4). Predict B (3 vs 2). k=6: 3A, 3B — tie!',
        'Different k values give different boundaries. The decision boundary at k=1 is exactly 5.0 (midpoint of 3 and 7). At k=3, it shifts toward 4.5. Choosing k: cross-validation. Rule of thumb: k=√n. Too small k: overfits (noisy boundaries). Too large k: underfits (boundary approaches global majority).',
      ],
    },
  ],
};
