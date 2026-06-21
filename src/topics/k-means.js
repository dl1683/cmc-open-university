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
        "Each frame shows 18 points on a two-feature scatter plot and k centroid markers (stars). Colors encode cluster membership: a point takes the color of the centroid it is currently assigned to. Unassigned points at the start are gray.",
        { type: "callout", text: "K-means is alternating minimization: assignments are optimal for fixed centroids, and centroids are optimal for fixed assignments." },
        "The animation alternates two moves per round. In the ASSIGN frame, every point snaps to the color of its nearest centroid — watch border points that switch color; those are the ones whose assignment changed. In the RECENTER frame, each centroid jumps to the geometric mean of its cluster's members — the star slides to a new position.",
        "When no point changes color during an assign step, the loop has converged: assignments and centroids agree, and the algorithm stops. Try k=2 and k=4 on the same data to see the algorithm forced to merge or split the three natural blobs.",
      ],
    },
    {
      heading: `What K-Means is`,
      paragraphs: [
        `K-means is an unsupervised clustering algorithm: it groups n vectors into k clusters without any labels. The algorithm receives points in a feature space and summarizes them with k centroids. Each point belongs to the cluster of its nearest centroid. Each centroid is the mean of its assigned points. The loop repeats until assignments stop changing.`,
        { type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/e/ea/K-means_convergence.gif`, alt: `Animated k-means convergence from poor initial centroids`, caption: `The GIF shows the assign and recenter loop converging even from a poor start, while the Voronoi cells shift as centroids move. Source: https://commons.wikimedia.org/wiki/File:K-means_convergence.gif.` },
        `The objective is the within-cluster sum of squared distances (WCSS, also called inertia). K-means wants each point close to its cluster center. That objective makes the algorithm simple, fast, and inspectable, but it also constrains the answer: k-means prefers compact, roughly spherical clusters under Euclidean distance. It always returns exactly k clusters, even when the data has fewer real groups or when the true groups are not round.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `A reasonable first attempt at clustering is to compute all pairwise distances and group nearby points together. For n points, that requires n*(n-1)/2 distance computations and O(n^2) memory for the distance matrix. With 10,000 points, you store 50 million distances. With 1,000,000 points, you need 500 billion. The approach works for small datasets but becomes physically impossible at scale.`,
        `A second attempt is exhaustive search: try every possible assignment of n points to k clusters and keep the one with the lowest cost. But the number of possible assignments is k^n. For n=100, k=3, that is 3^100, roughly 5 times 10^47 configurations. Checking one per nanosecond would take longer than the age of the universe. Neither brute-force approach scales.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is that optimal clustering is NP-hard. No known algorithm can guarantee the globally best k-means assignment in polynomial time for arbitrary inputs. Exhaustive search is impossible, pairwise methods are too expensive, and greedy one-shot heuristics have no guarantee of quality.`,
        `K-means sidesteps this wall with an iterative trick: instead of solving the whole problem at once, it alternates two simple steps that each solve half the problem exactly. Neither step alone finds the global optimum, but each step decreases or preserves the objective. The loop converges to a local optimum that is often good enough, especially with smart initialization.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is alternating minimization, the same idea behind expectation-maximization (EM). If centroids are fixed, the best assignment for each point is obvious: choose the nearest centroid. If assignments are fixed, the best centroid for each cluster is also obvious: the coordinate-wise mean minimizes squared distance to the assigned points (set the derivative of WCSS to zero and the mean falls out). Neither step solves the full problem, but each step improves or preserves the objective while holding the other half fixed.`,
        `This is why k-means feels mechanical. The assign step creates a Voronoi partition of space: every region belongs to the closest centroid. The recenter step moves each centroid to the mean of its region's points. New centroids change the nearest-centroid boundaries, so some points may switch clusters. The loop stops at a fixed point where assignments and centroids agree. That fixed point is a local minimum, not necessarily the global optimum.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Store the dataset as an n-by-d matrix (n points, d features), centroids as a k-by-d matrix, and an assignment array of length n. Stuart Lloyd conceived this procedure at Bell Labs in 1957 for pulse-code modulation (published 1982). James MacQueen independently described and named it "k-means" in 1967.`,
        `Step 1 (assign): for each point, compute the Euclidean distance to every centroid and assign the point to the nearest one. Squared Euclidean distance avoids the square root since ordering by squared distance is the same as ordering by distance. Step 2 (recenter): for each centroid, compute the coordinate-wise mean of all points assigned to it and move the centroid there. Repeat until no point changes assignment.`,
        `Initialization determines which local minimum the algorithm finds. Randomly chosen centroids can start too close together, leaving one natural group split and another ignored. K-means++ (Arthur and Vassilvitskii, 2007) fixes this: pick the first centroid uniformly at random, then pick each subsequent centroid with probability proportional to the squared distance from the nearest existing centroid. This spreads initial centers apart. The expected WCSS under k-means++ is within O(log k) of optimal. Production systems typically run k-means++ 10 times and keep the result with the lowest cost.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `K-means works because the mean minimizes squared distance to a set of points — so the recenter step is exactly optimal for the WCSS objective when assignments are fixed. The assign step is also exactly optimal when centroids are fixed: moving each point to the nearest centroid cannot increase WCSS. Each half-step is trivially correct because the other half is temporarily treated as constant. This is the same alternating-minimization pattern that drives EM for Gaussian mixture models.`,
        `The algorithm also works as compression: it replaces n points with k prototypes. Those prototypes can be inspected, stored, compared, and used for routing. A centroid summarizing a group of similar customers, colors, or embedding vectors becomes a useful unit of analysis. The practical value depends on whether Euclidean distance captures meaningful similarity in the domain.`,
      ],
    },
    {
      heading: `Choosing k`,
      paragraphs: [
        `K-means requires k as input and always returns exactly k clusters. Choosing k is the practitioner's responsibility, not the algorithm's. Inertia (WCSS) always decreases as k increases — more centroids means shorter distances — so raw cost cannot select k. Three common approaches help.`,
        `The elbow method plots WCSS against k. As k grows from 1, WCSS drops steeply at first and then flattens. The "elbow" — the value of k where returns diminish sharply — is a reasonable pick. The elbow is a heuristic; sometimes there is no clear bend. The silhouette score measures how much closer each point is to its own centroid than to the nearest foreign centroid. Values range from -1 to +1; higher is better. The gap statistic compares WCSS to a null reference distribution. Each method offers a different lens; none is definitive.`,
        `Domain knowledge often matters more than any metric. In customer segmentation, the question is whether the segments support different actions. In image compression, k is the palette size, chosen by quality constraints. In vector search indexes, k controls the recall-latency tradeoff. Connect cluster quality to the job the clusters do.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `K-means is useful for customer segmentation, color quantization, document exploration, image compression, anomaly screening, feature construction, and coarse routing in vector search. The color-quantization example is especially clear: treat each pixel as a point in RGB space, cluster pixels into k centroids, and replace each pixel by the nearest centroid color. The image now uses only k colors while preserving much of the original structure.`,
        `In retrieval systems, k-means appears in inverted-file vector indexes. A query is compared with coarse centroids, routed to the nearest partitions, and then compared with vectors inside those partitions. This reduces search cost at the price of possible recall loss. In data analysis, k-means can provide a first pass over embeddings before a human inspects representative items from each cluster. It is often a starting point, not the final explanation.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `K-means fails when the assumptions behind its objective are false. It struggles with long curved clusters, rings, nested groups, unequal densities, heavy outliers, and clusters of very different sizes. It is sensitive to feature scaling because Euclidean distance treats a one-unit change in each feature as comparable. A feature measured in dollars can dominate a feature measured in percentages unless data is standardized or transformed. It also does not handle categorical variables directly without a representation that makes distance meaningful.`,
        `High-dimensional spaces create another problem. Distances can become less informative as dimensions grow, especially with sparse text features or noisy embeddings. Dimensionality reduction may help, but it can also distort structure. K-means can also create false confidence because it always returns labels. A dataset with no natural clusters still gets k colored groups. The right response is to compare against baselines, inspect stability, test downstream value, and be willing to conclude that clustering is not supported.`,
      ],
    },
    {
      heading: `Convergence guarantee`,
      paragraphs: [
        `K-means always converges. The within-cluster sum of squares (WCSS) is bounded below by zero and decreases or stays the same on every step. The assign step cannot increase WCSS because each point moves to a closer centroid or stays put. The recenter step cannot increase WCSS because the mean minimizes squared distance to a fixed set of points (a property provable by setting the derivative to zero). Since there are finitely many possible assignments (k^n), and WCSS strictly decreases whenever an assignment changes, the loop must terminate.`,
        `Convergence does not mean optimality. The algorithm finds a local minimum that depends on initialization. Running k-means 10 times with different random starts and keeping the lowest-cost result is standard practice. K-means++ (Arthur and Vassilvitskii, 2007) improves initialization by choosing centroids that are spread apart, reducing the chance of a poor local minimum. The expected cost under k-means++ initialization is within O(log k) of optimal.`,
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "You have n data points and no labels. Nobody told you which points belong together, or even how many groups exist. You need to discover structure — segment customers, compress a color palette, route search queries to the right index partition — but exhaustive search over all possible groupings is combinatorially impossible.",
        "K-means exists because it replaces that impossible search with a two-step loop that converges in minutes. Stuart Lloyd conceived the algorithm at Bell Labs in 1957 for pulse-code modulation (published 1982). James MacQueen independently described and named it 'k-means' in 1967. The idea is old, simple, and still the default first pass for unsupervised grouping in production systems from ad targeting to vector search indexes.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "One iteration costs O(n * k * d): for each of n points, compute distance to each of k centroids across d dimensions. If the algorithm runs for I iterations, total cost is O(I * n * k * d). In practice, I is typically 10 to 30. Doubling the number of points doubles iteration cost linearly. Doubling k also doubles it. Doubling dimensionality doubles again. Memory is O(n * d) for the dataset plus O(k * d) for centroids plus O(n) for assignments.",
        "Worked example: 100,000 points, 128 dimensions, k=256, 20 iterations. Per iteration: 100,000 * 256 * 128 = 3.28 billion distance operations. Over 20 iterations: about 65 billion. On a modern CPU doing roughly 10 billion FLOPs per second, that finishes in single-digit seconds. This is why k-means scales to millions of vectors in practice — each operation is a simple multiply-add, highly vectorizable.",
        "Mini-batch k-means (Sculley, 2010) reduces per-iteration cost by sampling a small batch of points (say 1,000) instead of the full dataset. Each centroid updates as a running mean. Precision drops slightly, but training on 10 million points becomes practical on a laptop. Scikit-learn's MiniBatchKMeans uses this approach.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Six 2D points: A=(1,1), B=(1.5,2), C=(2,1.5), D=(8,8), E=(9,7.5), F=(8.5,9). k=2. Initialize centroids at C1=A=(1,1) and C2=F=(8.5,9) (spread apart, mimicking k-means++).",
        "Iteration 1 ASSIGN: compute Euclidean distance from each point to each centroid. A to C1: 0, to C2: sqrt(56.25+64)=10.97 -> C1. B to C1: sqrt(0.25+1)=1.12, to C2: sqrt(49+49)=9.90 -> C1. C to C1: sqrt(1+0.25)=1.12, to C2: sqrt(42.25+56.25)=9.92 -> C1. D to C1: sqrt(49+49)=9.90, to C2: sqrt(0.25+1)=1.12 -> C2. E to C1: sqrt(64+42.25)=10.31, to C2: sqrt(0.25+2.25)=1.58 -> C2. F to C1: sqrt(56.25+64)=10.97, to C2: 0 -> C2. Clusters: {A,B,C} and {D,E,F}. 6 points changed assignment.",
        "Iteration 1 RECENTER: C1 = mean of {(1,1),(1.5,2),(2,1.5)} = (1.5, 1.5). C2 = mean of {(8,8),(9,7.5),(8.5,9)} = (8.5, 8.17).",
        "Iteration 2 ASSIGN: recompute all distances with new centroids. Every point is still closer to its current centroid than to the other. Zero points changed. CONVERGED in 2 iterations.",
        "Final WCSS: cluster 1: (1-1.5)^2+(1-1.5)^2 + (1.5-1.5)^2+(2-1.5)^2 + (2-1.5)^2+(1.5-1.5)^2 = 0.25+0.25+0+0.25+0.25+0 = 1.0. Cluster 2: (8-8.5)^2+(8-8.17)^2 + (9-8.5)^2+(7.5-8.17)^2 + (8.5-8.5)^2+(9-8.17)^2 = 0.25+0.03+0.25+0.45+0+0.69 = 1.67. Total WCSS = 2.67. The two natural blobs were recovered exactly.",
        "Bad initialization test: start both centroids at (1,1) and (1.5,2). Iteration 1 assigns nearly everything to C2. By iteration 3, the algorithm self-corrects to the same two-cluster solution. K-means is robust to bad starts when clusters are well-separated; it is fragile when clusters overlap. K-means++ avoids pathological starts by construction.",
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Frame 1 (initialization): 18 gray points, k colored centroids placed at spread-out positions. Invariant: no assignments yet — cost is undefined. Notice the centroids are far apart; this is the k-means++ idea in miniature.',
            'Assign frames: each point takes the color of its nearest centroid. The key number is how many points changed cluster. If zero changed, the algorithm will converge on this round. Border points — those equidistant from two centroids — are the ones that flip most often.',
            'Recenter frames: each centroid slides to the mean of its members. The star markers move. The distance they travel shrinks each round because the assignments are stabilizing. Watch for centroids that barely move — their cluster is already tight.',
            'Convergence frame: zero points changed. The within-cluster sum of squares has reached a local minimum. With k=3, the three natural blobs are recovered. With k=2, two blobs are merged. With k=4, one blob is split. The algorithm cannot tell you which k is right.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        "Points: (1,1), (1.5,2), (3,4), (5,7), (3.5,5), (4.5,5), (3.5,4.5). k=2. Initial centroids: C1=(1,1), C2=(5,7).",
        "Assign: (1,1)→C1, (1.5,2)→C1, (3,4)→C2 (dist to C1=√13≈3.6, dist to C2=√13≈3.6 — tie, say C2), (5,7)→C2, (3.5,5)→C2, (4.5,5)→C2, (3.5,4.5)→C2. New C1=(1.25, 1.5). New C2=mean of 5 points≈(3.9, 5.1). Re-assign: now (3,4) is closer to C2 (dist≈1.4) than C1 (dist≈3.2). Converges after about 3 iterations.",
        "Can you explain why k-means fails on non-convex clusters (e.g., two concentric circles)?",
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          "Lloyd, S.P. (1982). 'Least Squares Quantization in PCM.' IEEE Transactions on Information Theory, 28(2), 129-137. Algorithm conceived at Bell Labs in 1957, published 25 years later. MacQueen, J. (1967). 'Some methods for classification and analysis of multivariate observations.' Proc. 5th Berkeley Symposium — coined the name 'k-means.' Arthur, D. and Vassilvitskii, S. (2007). 'K-means++: The Advantages of Careful Seeding.' SODA — proved O(log k)-competitive initialization. Sculley, D. (2010). 'Web-scale k-means clustering.' WWW — mini-batch variant for large-scale data.",
          "Prerequisites: Euclidean distance (the measure k-means optimizes), coordinate-wise mean (the operation behind recentering), and basic iteration. If distance metrics are unfamiliar, start there — k-means is only as good as its distance function.",
          "Density-based alternative: DBSCAN defines clusters as dense regions separated by sparse gaps. It finds arbitrary shapes, handles noise as first-class outliers, and does not require choosing k. Study it when k-means fails on non-convex or unequal-density data.",
          "Soft clustering: Gaussian mixture models (GMMs) generalize k-means from hard assignment to soft probabilistic membership. Each point gets a probability of belonging to each cluster. GMMs also model cluster shape via covariance matrices, handling elliptical clusters that k-means distorts into spheres.",
          "Multi-scale structure: hierarchical clustering (agglomerative or divisive) builds a dendrogram of merges or splits so you can pick granularity after the fact, without rerunning the algorithm for each k.",
          "Dimension reduction before clustering: PCA projects high-dimensional data onto its principal axes, reducing noise and making Euclidean distance more meaningful. t-SNE and UMAP are useful for 2D visualization of cluster output but distort distances too much for clustering directly.",
          "In production: k-means is the routing layer inside inverted-file (IVF) vector indexes used by FAISS and similar libraries. Understanding how centroid quality affects recall and latency connects this topic directly to search infrastructure.",
        ],
      },
],
};
