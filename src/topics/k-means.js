// K-means clustering: assign each point to its nearest centroid, move each
// centroid to the middle of its points, repeat until nothing changes.
// Unsupervised learning in its purest, most watchable form.

import { scatterState, parseIntegerInRange } from '../core/state.js';

export const topic = {
  id: 'k-means',
  title: 'K-Means Clustering',
  category: 'AI & ML',
  summary: 'Group unlabeled points by repeating two moves: assign to nearest centroid, recenter the centroid.',
  controls: [
    { id: 'k', label: 'Clusters (k)', type: 'select', options: ['2', '3', '4'], defaultValue: '3' },
  ],
  run,
};

// A fixed dataset of three natural blobs (deterministic on purpose: the
// lesson is the algorithm, not the dice). Try k=2 and k=4 on the same data
// to see what choosing the "wrong" k does.
const DATA = [
  [1.0, 1.2], [1.6, 2.0], [2.2, 1.0], [1.3, 2.6], [2.6, 2.2], [2.0, 3.0],
  [7.0, 1.5], [7.8, 2.3], [8.5, 1.2], [7.3, 2.9], [8.9, 2.6], [8.1, 3.2],
  [4.2, 6.8], [5.0, 7.6], [5.8, 6.6], [4.6, 8.2], [5.5, 8.0], [6.2, 7.4],
];

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function* run(input) {
  const k = parseIntegerInRange(input.k, { min: 2, max: 4, label: 'k' });

  const points = DATA.map(([x, y], i) => ({ id: `p${i}`, x, y, clusterId: null }));
  // Deterministic spread-out initialization (real k-means++ does this with
  // weighted randomness; the idea — start far apart — is the same).
  const initIndexes = [0, 8, 14, 4].slice(0, k);
  const centroids = initIndexes.map((pi, c) => ({
    id: `c${c}`, x: DATA[pi][0], y: DATA[pi][1], label: `C${c + 1}`,
  }));
  const snapshot = () => scatterState({
    points,
    centroids,
    axes: { x: { label: 'feature 1' }, y: { label: 'feature 2' } },
  });

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `${DATA.length} unlabeled points — nobody tells the algorithm what the groups are, or even that groups exist. That's UNSUPERVISED learning. We chose k=${k}, dropped ${k} centroids (✚) far apart, and now we loop two moves until nothing changes.`,
  };

  for (let round = 1; round <= 8; round += 1) {
    // Move 1: assign every point to its nearest centroid.
    let changed = 0;
    for (const p of points) {
      let best = null;
      let bestDistance = Infinity;
      for (const c of centroids) {
        const d = dist([p.x, p.y], [c.x, c.y]);
        if (d < bestDistance) { bestDistance = d; best = c.id; }
      }
      if (p.clusterId !== best) changed += 1;
      p.clusterId = best;
    }
    yield {
      state: snapshot(),
      highlight: {},
      explanation: `Round ${round}, move 1 — ASSIGN: every point joins its NEAREST centroid (plain Euclidean distance, nothing fancier). ${changed === 0 ? 'No point changed cluster.' : `${changed} point${changed === 1 ? '' : 's'} changed cluster.`}`,
      invariant: 'Every point always belongs to its nearest centroid (as of the last assignment).',
    };

    if (changed === 0) {
      yield {
        state: snapshot(),
        highlight: {},
        explanation: `CONVERGED after ${round} rounds: assignments stopped changing, so the centroids won't move either — the loop is a fixed point. K-means always converges like this${k === 3 ? ', and with k=3 it found the three natural blobs.' : `. But look critically: with k=${k} it ${k < 3 ? 'was forced to MERGE real groups' : 'had to SPLIT a real group'} — k-means always produces exactly k clusters, whether or not the data agrees. Choosing k is your job, not the algorithm's.`} The same idea compresses images (cluster colors), segments customers, and builds vector-search indexes.`,
      };
      return;
    }

    // Move 2: move each centroid to the mean of its assigned points.
    for (const c of centroids) {
      const mine = points.filter((p) => p.clusterId === c.id);
      if (mine.length === 0) continue; // an empty cluster keeps its spot
      c.x = mine.reduce((s, p) => s + p.x, 0) / mine.length;
      c.y = mine.reduce((s, p) => s + p.y, 0) / mine.length;
    }
    yield {
      state: snapshot(),
      highlight: { active: centroids.map((c) => c.id) },
      explanation: `Round ${round}, move 2 — RECENTER: each centroid jumps to the MEAN of its members; it stops being a guess and starts being a summary. New centroids may flip the nearest-centroid math for border points, so we assign again.`,
    };
  }
}

export const article = {
  sections: [
    {
      heading: `What K-Means Is`,
      paragraphs: [
        `K-means is an unsupervised clustering algorithm for grouping vectors into k clusters. Unsupervised means the algorithm is not given labels such as "customer type A" or "defective machine." It receives points in a feature space and tries to summarize them with k centroids. Each point belongs to the cluster represented by its nearest centroid. Each centroid is the mean of the points assigned to it. The loop repeats until assignments stop changing or improvement becomes negligible.`,
        `The objective is within-cluster sum of squared distances. In plain terms, k-means wants each point to be close to the center of its assigned cluster. That objective makes the algorithm simple, fast, and easy to inspect. It also defines the shape of the answer. K-means prefers compact, roughly spherical clusters under Euclidean distance. It always returns exactly k clusters, even when the data has no real cluster structure or when the true groups are not round.`,
      ],
    },
    {
      heading: `The Obvious Approach And The Wall`,
      paragraphs: [
        `The obvious approach to clustering is to look at a scatter plot and draw boundaries by hand. That breaks immediately when the data has many dimensions, many points, or no visual display that preserves the important distances. Another obvious approach is to compare every point with every other point and build clusters from pairwise similarity. That can work, but it becomes expensive and may produce structures that are hard to summarize.`,
        `K-means attacks a narrower problem. Instead of storing all pairwise relationships, it represents each cluster by one centroid. That gives a compact summary: k vectors instead of n points. The wall is that this summary is only appropriate when the mean is a meaningful representative and distance to the mean is a meaningful notion of membership. If the data lives in strange geometry, contains long curved groups, has categorical features, or uses incompatible feature scales, the compact summary can be misleading.`,
      ],
    },
    {
      heading: `The Core Insight`,
      paragraphs: [
        `The core insight is alternating minimization. If the centroids are fixed, the best assignment for each point is obvious: choose the nearest centroid. If the assignments are fixed, the best centroid for each cluster is also obvious: take the coordinate-wise mean of the assigned points. Neither step solves the whole problem globally, but each step improves or preserves the objective while holding the other part fixed.`,
        `This is why k-means feels mechanical. Assignment creates a Voronoi partition of space: every region belongs to the closest centroid. Recenter moves the centroid to the average of its region's points. The new centroids change the nearest-centroid boundaries, so some points may switch clusters. The loop stops at a fixed point where assignments and centroids agree. That fixed point is usually a local optimum, not a guarantee of the best possible clustering.`,
      ],
    },
    {
      heading: `Mechanism And Data Structures`,
      paragraphs: [
        `A typical implementation stores the dataset as an n by d matrix: n points, d numeric features. It stores centroids as a k by d matrix. It stores an assignment array of length n, where assignment i is the centroid id currently owning point i. Many implementations also keep a distance buffer or compute distances on the fly. The essential distance calculation is squared Euclidean distance, which avoids a square root because ordering by squared distance is the same as ordering by distance.`,
        `Initialization matters. Randomly chosen centroids can start too close together, leaving one natural group split and another ignored. K-means++ improves the starting point by choosing the first centroid randomly and then choosing later centroids with probability weighted by squared distance from the nearest existing centroid. The goal is not perfection. It is to spread initial centers so the alternating loop is less likely to get trapped in a poor local optimum. Production runs often use several initializations and keep the result with the lowest objective.`,
        `One iteration costs O(n * k * d) for distance scoring plus O(n * d) to accumulate new means. If the algorithm takes I iterations, practical cost is O(I * n * k * d). Memory is O(n) for assignments and O(k * d) for centroids, plus the dataset. Mini-batch k-means reduces cost by updating centroids from small random batches, trading some precision for scale. For very large vector collections, approximate nearest-centroid search and distributed aggregation may be used.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `K-means works well when the mean is a good summary and clusters are separated by Euclidean distance. The mean is the point that minimizes squared distance to members of a cluster, so the recentering step is exactly right for the objective. The nearest-centroid assignment step is also exactly right for the objective when centroids are fixed. Each half-step is simple because the other half is temporarily treated as known.`,
        `The algorithm also works because it compresses a large dataset into a small set of prototypes. Those prototypes can be inspected, stored, compared, and used for routing. If a centroid summarizes a group of similar customers, colors, documents, images, or embedding vectors, the cluster becomes a useful unit of analysis. The danger is that usefulness comes from the match between geometry and domain meaning, not from the algorithm itself.`,
      ],
    },
    {
      heading: `Evaluation And Operational Signals`,
      paragraphs: [
        `The basic training signal is inertia, the within-cluster sum of squared distances. It should decrease with each iteration. If it increases, there is an implementation bug. Lower inertia is not automatically better across different k values because adding more clusters almost always lowers distance. Elbow plots look for a point where extra clusters give diminishing returns, but the elbow is a heuristic, not evidence that the chosen k is true.`,
        `Other signals include silhouette score, cluster size distribution, stability across random seeds, stability across data samples, centroid interpretability, and downstream usefulness. In a customer segmentation task, the question is not only whether clusters are compact. It is whether segments support decisions such as messaging, risk review, product design, or support routing. In vector search, the signal may be recall and latency after routing through centroids. In image compression, the signal may be visual quality for a fixed palette size. Always connect cluster quality to the job the clusters are supposed to do.`,
      ],
    },
    {
      heading: `Where It Is Useful`,
      paragraphs: [
        `K-means is useful for customer segmentation, color quantization, document exploration, image compression, anomaly screening, feature construction, and coarse routing in vector search. The color-quantization example is especially clear: treat each pixel as a point in RGB space, cluster pixels into k centroids, and replace each pixel by the nearest centroid color. The image now uses only k colors while preserving much of the original structure.`,
        `In retrieval systems, k-means appears in inverted-file vector indexes. A query is compared with coarse centroids, routed to the nearest partitions, and then compared with vectors inside those partitions. This reduces search cost at the price of possible recall loss. In data analysis, k-means can provide a first pass over embeddings before a human inspects representative items from each cluster. It is often a starting point, not the final explanation.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `K-means fails when the assumptions behind its objective are false. It struggles with long curved clusters, rings, nested groups, unequal densities, heavy outliers, and clusters of very different sizes. It is sensitive to feature scaling because Euclidean distance treats a one-unit change in each feature as comparable. A feature measured in dollars can dominate a feature measured in percentages unless data is standardized or transformed. It also does not handle categorical variables directly without a representation that makes distance meaningful.`,
        `High-dimensional spaces create another problem. Distances can become less informative as dimensions grow, especially with sparse text features or noisy embeddings. Dimensionality reduction may help, but it can also distort structure. K-means can also create false confidence because it always returns labels. A dataset with no natural clusters still gets k colored groups. The right response is to compare against baselines, inspect stability, test downstream value, and be willing to conclude that clustering is not supported.`,
      ],
    },
    {
      heading: `What To Study Next`,
      paragraphs: [
        `Study Euclidean distance, cosine similarity, normalization, and embeddings before trusting cluster geometry. Study PCA and SVD for dimensionality reduction, then t-SNE and UMAP for visualization with the warning that two-dimensional plots are not ground truth. Study Gaussian mixture models for soft probabilistic clusters, DBSCAN and HDBSCAN for density-based clusters, and hierarchical clustering for multiscale structure. For production retrieval, study HNSW and inverted-file indexes to see how clustering becomes a routing data structure rather than only an analysis tool.`,
      ],
    },
  ],
};
