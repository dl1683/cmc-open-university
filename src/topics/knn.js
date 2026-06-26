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
        'Blue and orange points are labeled training examples, and the query point starts unlabeled. Active marks the query, compare marks the training point currently being measured, and found marks the k nearest voters.',
        { type: 'callout', text: 'KNN is lazy supervised learning: the training set stays as the model, and prediction is local voting around the query.' },
        'The safe inference rule is majority vote among the nearest labeled points. Changing k changes the voting neighborhood, so the same query can move from noisy local behavior to smoother global behavior.',
        {type: 'image', src: './assets/gifs/knn.gif', alt: 'Animated walkthrough of the knn visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Supervised classification means predicting a label from labeled examples. A medical record, image, or customer profile arrives, and the system must assign a known class.',
        'K-nearest neighbors exists because sometimes local similarity is enough. Instead of fitting parameters, it keeps the training set and asks which known examples sit closest to the new one.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The usual machine-learning approach is to train a compact model, such as a line, tree, or neural network. Training compresses examples into parameters, and prediction reads those parameters quickly.',
        'KNN takes the opposite obvious baseline: store the data and delay computation until query time. That makes training almost free, but prediction must search the stored examples.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is query cost. A naive KNN query compares the new point with every training point, so one million examples and 100 features means 100 million feature differences per query.',
        'The second wall is distance quality. In high-dimensional spaces, nearest and farthest distances often become close, so the word nearest stops carrying much information.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'KNN assumes labels are locally smooth. If two points are close under a meaningful distance metric, their labels are likely to match or at least vote in the same direction.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/KnnClassification.svg', alt: 'K nearest neighbors classification diagram with two classes and a query point', caption: 'The query changes class as k changes because the vote boundary is determined by local neighbors, not a learned global equation. Source: https://commons.wikimedia.org/wiki/File:KnnClassification.svg.' },
        'The decision boundary is not stored directly. It emerges from the training points, the distance metric, and the chosen k.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Store every training point with its label. For a query, compute its distance to every stored point, select the k smallest distances, and count the labels among those neighbors.',
        'The most common distance is Euclidean distance, but Manhattan distance and cosine distance are common when the feature geometry calls for them. Feature scaling matters because a large numeric range can dominate all other features.',
        'Ties can be broken by smaller distance, odd k in binary classification, or distance-weighted voting. Regression uses the same neighbor set but averages numeric target values instead of counting labels.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is statistical, not exact. If the training sample becomes dense around the query and the distance metric reflects the true feature geometry, nearby labels estimate the local class probabilities.',
        'The classic result from Cover and Hart says 1-nearest-neighbor has asymptotic error at most twice the Bayes optimal error. With k growing while k/n shrinks, KNN can converge to the Bayes classifier under broad conditions.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Training cost is O(n * d) storage and almost no computation because the model is the dataset. Naive prediction costs O(n * d) to compute distances plus selection of the k smallest distances.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Kdtree_2d.svg', alt: 'Two-dimensional k-d tree partition used for nearest neighbor search', caption: 'Low-dimensional neighbor search can use k-d tree region pruning, but the advantage fades as dimension rises. Source: https://commons.wikimedia.org/wiki/File:Kdtree_2d.svg.' },
        'Doubling training examples doubles query work, and doubling features doubles each distance calculation. K-d trees and ball trees help in low dimensions, while approximate indexes trade exactness for speed at scale.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'KNN is useful for small or medium datasets where local examples are meaningful and training time should be near zero. It appears in baseline classifiers, recommendation by neighbor similarity, anomaly scoring, and missing-value imputation.',
        'It is also a teaching and diagnostic tool. If KNN performs well after proper scaling, the feature space already contains local class structure that a more compact model may be able to learn.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'KNN fails when distance is not meaningful. Unscaled features, sparse high-dimensional vectors, irrelevant features, and mixed categorical encodings can make nearest neighbors misleading.',
        'It also fails operationally on very large datasets without an index. At that point, teams usually move to approximate nearest-neighbor structures or train a model that compresses the training signal into fast parameters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use query Q=(3,3). Training points include A at (2.5,1.5), A at (1.5,2.0), A at (2.0,1.0), B at (5.0,5.0), and B at (5.5,5.5).',
        'Distances from Q are 1.58, 1.80, 2.24, 2.83, and 3.54. With k=3, the three nearest neighbors are all class A, so the prediction is A by a 3-0 vote.',
        'With k=1, only (2.5,1.5) votes, so the prediction is still A but more sensitive to noise. If a mislabeled B point were inserted at (3.1,3.0), k=1 would flip while k=3 might not.',
        'Move Q to (4.5,4.5), and the nearest neighbors become mostly B points. The decision boundary is the region where the local vote changes, even though no boundary equation was trained.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Fix and Hodges, Discriminatory Analysis, 1951; Cover and Hart, Nearest Neighbor Pattern Classification, 1967. Friedman, Bentley, and Finkel, 1977, gives the classic low-dimensional nearest-neighbor tree acceleration.',
        'Study k-means next to separate supervised neighbor voting from unsupervised centroid clustering. Then study k-d trees, ball trees, locality-sensitive hashing, HNSW, and the curse of dimensionality.',
      ],
    },
  ],
};
