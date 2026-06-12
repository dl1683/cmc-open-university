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
      heading: 'What it is',
      paragraphs: [
        `K-means is an unsupervised learning algorithm that partitions a set of unlabeled points into exactly k clusters by repeatedly assigning each point to its nearest cluster center (centroid) and moving each centroid to the mean of its assigned points. The algorithm is unsupervised because nobody tells it what the clusters are or even that they exist — it discovers them purely from the point positions and the number k (which you choose). Once converged, each point belongs to exactly one cluster, and the centroid is the geometric center of its cluster.`,
        `The elegance of k-means is its simplicity: two moves, repeated in a loop, until convergence. Assign points to nearest centroids. Recenter each centroid at the mean of its points. Repeat. Both operations are fast (linear in the number of points or clusters), and the algorithm always converges to a local minimum of the within-cluster variance — the sum of squared distances from points to their centroids.`
      ]
    },
    {
      heading: 'How it works',
      paragraphs: [
        `K-means begins with an initialization step: pick k starting centroids, either randomly or via k-means++ (spreading them out in a weighted-random fashion to avoid poor local minima). Then enter the main loop: (1) Assign: for each point, find the nearest centroid (Euclidean distance is standard) and label it with that centroid's cluster ID. (2) Recenter: for each centroid, compute the mean of all points assigned to it, and move the centroid to that mean. (3) Check convergence: if no points changed clusters in step 1, stop; otherwise repeat from step 1.`,
        `The algorithm converges because each step either reduces or maintains the objective function (sum of squared within-cluster distances), and the objective is bounded below by zero. In practice k-means converges in 10-100 iterations on real data. The final clusters are a Voronoi partition of the space — each region belongs to whichever centroid is closest. This partition minimizes the sum of squared distances from points to their assigned centroids.`
      ]
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Each iteration of k-means costs O(nkd) where n is the number of points, k is the number of clusters, and d is the dimensionality. Computing distances from all n points to all k centroids takes O(nkd); recomputing the k means takes O(nd). Most datasets converge in O(log n) or fewer iterations, so total time is typically O(n k d log n). This is fast enough for millions of points in moderate dimensions. However, k-means does not scale well to very high dimensions: in high-dimensional spaces, distances become less meaningful (the curse of dimensionality), and k-means may converge to poor local minima. For high-dimensional data, using dimensionality reduction first (PCA) or a distance metric designed for the domain (not Euclidean) is common.`
      ]
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `K-means is ubiquitous in machine learning and data science. It powers image compression: cluster pixel colors and replace each pixel with its centroid color. Customer segmentation: cluster users by browsing behavior, purchase history, and engagement, then personalize content for each segment. Vector-database indexing: cluster high-dimensional embeddings to speed up nearest-neighbor search (e.g., in semantic search or recommendation systems). Outlier detection: points far from all centroids are anomalies. Data exploration: visualizing the k=2 or k=3 solution of high-dimensional data reveals natural groupings.`,
        `K-means++ (seeding) and variants like mini-batch k-means (processing data in small batches, for streaming data) improve scalability and stability. Hierarchical clustering and DBSCAN are alternatives when you don't want to specify k in advance.`
      ]
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The biggest pitfall is assuming k-means discovers the true clusters in the data. It does not. K-means always produces exactly k clusters, regardless of the true underlying structure. If the data has 3 natural groups and you run k-means with k=5, it will split one of the groups unnecessarily. If you use k=2, it will merge groups that should be separate. Choosing k requires external knowledge, domain intuition, or techniques like the elbow method (plot objective value vs. k and look for where the curve flattens).`,
        `Another misconception: k-means finds the data's natural structure in an unsupervised way. It is unsupervised in that it does not use labels, but it is supervised by your choice of k and the Euclidean distance metric. In high-dimensional spaces where Euclidean distance is unreliable, k-means can give meaningless results. Using a domain-aware distance metric or projecting the data to a lower-dimensional space first is essential.`,
        `Finally, k-means can converge to poor local minima (not the global optimum) depending on initialization. Running the algorithm multiple times with different random seeds and keeping the best result (lowest objective value) is standard practice.`
      ]
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Explore Embeddings & Similarity to understand how to represent high-dimensional data in vector spaces where k-means actually works well — the algorithm shines on learned embeddings, not raw pixels. Study Activation Functions and Gradient Descent to understand how neural networks learn to produce those good embeddings. If you want to understand alternatives to k-means, research hierarchical clustering and DBSCAN. For a deeper dive into the mathematics, look up Lloyd's algorithm (the formal name) and the connection to Voronoi partitions. When you are ready for practical applications, explore vector databases (Pinecone, Weaviate) which use k-means-like indexing for semantic search, and study real customer segmentation pipelines to see how practitioners choose k.`
      ]
    }
  ]
};
