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
    explanation: `${DATA.length} unlabeled points — nobody tells the algorithm what the groups are, or even that groups exist. That's UNSUPERVISED learning. We chose k=${k}, dropped ${k} centroids (âœš) far apart, and now we loop two moves until nothing changes.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each frame shows unlabeled points in a two-feature space and k star-shaped centroids. A centroid is the current representative point for a cluster, and a point color means that point is assigned to that centroid.',
        { type: 'callout', text: 'K-means is alternating minimization: assignments are optimal for fixed centroids, and centroids are optimal for fixed assignments.' },
        'The safe inference rule is local: in an assign frame, each point moves to its nearest centroid under Euclidean distance. In a recenter frame, each centroid moves to the coordinate-wise mean of the points assigned to it.',
        {type: 'image', src: './assets/gifs/k-means.gif', alt: 'Animated walkthrough of the k means visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Clustering means grouping data without labels. You may have customers, pixels, documents, or embedding vectors and need a first pass that says which examples are near one another.',
        'K-means exists because exact grouping is combinatorial, but many practical datasets have compact groups. It replaces a huge search over assignments with a repeated two-step update that is cheap, understandable, and often useful.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'One obvious approach is to compare every point with every other point and group nearby pairs. That builds an n by n distance story, which means about 50 million distances for 10,000 points and about 500 billion for one million points.',
        'Another obvious approach is exhaustive assignment. With n points and k clusters, there are k^n possible labelings, so 100 points and 3 clusters already create about 5e47 assignments.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that global optimum search is too expensive. The k-means objective, the within-cluster sum of squared distances, is hard to minimize exactly over all assignments.',
        'A greedy one-shot rule also fails because assignment and center position depend on each other. Bad initial centers can split one natural group, ignore another, or trap the loop in a local minimum.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Hold half the problem fixed and solve the other half exactly. If centroids are fixed, the best assignment is nearest centroid; if assignments are fixed, the best centroid is the mean of its assigned points.',
        'Each step cannot increase the squared-distance cost. The algorithm is therefore a cost-reducing loop, not a proof that the final clustering is globally best.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose k initial centroids, often with k-means++ so they start spread apart. Assign every point to the nearest centroid using squared Euclidean distance, which avoids square roots while preserving ordering.',
        'Recenter each centroid by averaging each coordinate of its assigned points. Repeat assignment and recentering until no point changes cluster or until the centroid movement is below a chosen threshold.',
        'The cost being minimized is WCSS, the within-cluster sum of squared distances. Lower WCSS means points sit closer to their assigned centroids, but WCSS always falls as k increases, so it cannot choose k by itself.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For fixed centroids, assigning a point to any non-nearest centroid would add unnecessary squared distance. The assign step is therefore optimal for the current centers.',
        'For fixed assignments, the mean minimizes squared distance to the assigned points. Because the objective is bounded below by zero and every step decreases or preserves it, the loop converges to a fixed point after finitely many assignments.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'One iteration costs O(n * k * d), where n is point count, k is cluster count, and d is feature count. If the loop runs I iterations, total cost is O(I * n * k * d) and memory is O(n * d + k * d + n).',
        'Cost behaves linearly in the visible knobs. Doubling points doubles distance work, doubling k doubles centroid comparisons, and doubling features doubles each distance calculation.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Image compression clusters pixels in RGB space and replaces each pixel with its nearest centroid color. The access pattern is many simple distance calculations, and the result is a small palette.',
        'Vector search systems use k-means in inverted-file indexes. A query first chooses nearby coarse centroids, then scans only vectors inside those partitions, trading exact recall for lower latency.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'K-means assumes clusters are compact under the chosen distance metric. It struggles with rings, long curves, unequal densities, outliers, unscaled features, and categorical variables without a meaningful numeric representation.',
        'It also always returns exactly k clusters. A dataset with no real cluster structure still gets colored groups, so the output must be validated by downstream usefulness, stability, and inspection.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use six 2D points: A=(1,1), B=(1.5,2), C=(2,1.5), D=(8,8), E=(9,7.5), and F=(8.5,9). Set k=2 and initialize centroids at C1=(1,1) and C2=(8.5,9).',
        'Assignment gives A, B, and C to C1 because their distances to C1 are 0, 1.12, and 1.12, while their distances to C2 are about 10.97, 9.90, and 9.92. D, E, and F go to C2 because their distances to C2 are 1.12, 1.58, and 0.',
        'Recenter C1 to the mean of A, B, C: ((1+1.5+2)/3, (1+2+1.5)/3) = (1.5, 1.5). Recenter C2 to ((8+9+8.5)/3, (8+7.5+9)/3) = (8.5, 8.17).',
        'The second assignment does not change any point, so the algorithm stops. The final WCSS is about 1.00 for the first cluster plus 1.67 for the second, for total 2.67.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lloyd, Least Squares Quantization in PCM, 1982; MacQueen, Some Methods for Classification and Analysis of Multivariate Observations, 1967; Arthur and Vassilvitskii, K-means++: The Advantages of Careful Seeding, 2007. Sculley, Web-scale k-means clustering, 2010, covers mini-batch updates for large data.',
        'Study Euclidean distance and coordinate-wise means first because they define the objective. Then study DBSCAN for non-round clusters, Gaussian mixture models for soft membership, and PCA because distance often improves after reducing noisy dimensions.',
      ],
    },
  ],
};
