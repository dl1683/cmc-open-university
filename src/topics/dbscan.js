// DBSCAN: Density-Based Spatial Clustering of Applications with Noise.
// Ester, Kriegel, Sander, Xu (KDD 1996). Finds arbitrarily shaped clusters
// by expanding dense neighborhoods, classifying every point as core, border,
// or noise — no k required.

import { scatterState } from '../core/state.js';

export const topic = {
  id: 'dbscan',
  title: 'DBSCAN',
  category: 'AI & ML',
  summary: 'Find clusters of any shape by expanding dense neighborhoods — no k needed, outliers detected for free.',
  controls: [
    { id: 'eps', label: 'Epsilon (ε)', type: 'select', options: ['1.5', '2.0', '2.5'], defaultValue: '2.0' },
    { id: 'minPts', label: 'MinPts', type: 'select', options: ['2', '3'], defaultValue: '2' },
  ],
  run,
};

// 10 deterministic 2D points: two dense blobs + one isolated outlier.
// Cluster A ~ (1,2)-(3,3) region, Cluster B ~ (7,7)-(9,9) region, noise at (5,10).
const DATA = [
  // Cluster A (dense blob, lower-left)
  [1.0, 2.0],  // p0
  [1.5, 2.5],  // p1
  [2.0, 2.0],  // p2
  [2.5, 3.0],  // p3
  [1.5, 1.5],  // p4
  // Cluster B (dense blob, upper-right)
  [7.0, 7.5],  // p5
  [7.5, 8.0],  // p6
  [8.0, 7.0],  // p7
  [8.5, 8.5],  // p8
  // Noise
  [5.0, 10.0], // p9 — isolated
];

const LABELS = DATA.map((_, i) => `p${i}`);

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function regionQuery(data, idx, eps) {
  const neighbors = [];
  for (let j = 0; j < data.length; j++) {
    if (dist(data[idx], data[j]) <= eps) neighbors.push(j);
  }
  return neighbors;
}

export function* run(input) {
  const eps = parseFloat(input.eps) || 2.0;
  const minPts = parseInt(input.minPts, 10) || 2;

  const n = DATA.length;
  const clusterId = new Array(n).fill(null);   // null = unvisited
  const pointType = new Array(n).fill('unvisited'); // 'core', 'border', 'noise'
  let currentCluster = 0;

  const clusterColors = ['cluster-a', 'cluster-b', 'cluster-c', 'cluster-d'];

  const points = () => DATA.map(([x, y], i) => ({
    id: LABELS[i],
    x,
    y,
    clusterId: clusterId[i],
  }));

  const snapshot = () => scatterState({
    points: points(),
    centroids: [],
    axes: { x: { label: 'x' }, y: { label: 'y' } },
  });

  // --- Initial state ---
  yield {
    state: snapshot(),
    highlight: {},
    explanation: `${n} unlabeled points. DBSCAN will find clusters using two parameters: ε=${eps} (neighborhood radius) and minPts=${minPts} (minimum neighbors to qualify as dense). Unlike k-means, we never choose the number of clusters — the density of the data decides.`,
  };

  // --- Main DBSCAN loop ---
  for (let i = 0; i < n; i++) {
    if (clusterId[i] !== null) continue; // already processed

    const neighbors = regionQuery(DATA, i, eps);

    yield {
      state: snapshot(),
      highlight: { active: [LABELS[i]], visited: neighbors.map((j) => LABELS[j]) },
      explanation: `Query ε-neighborhood of ${LABELS[i]} at (${DATA[i][0]}, ${DATA[i][1]}). Found ${neighbors.length} point${neighbors.length === 1 ? '' : 's'} within ε=${eps}. Need ≥${minPts} to be a core point.`,
    };

    if (neighbors.length < minPts) {
      // Mark as noise (may be reclaimed as border later)
      pointType[i] = 'noise';
      clusterId[i] = 'noise';

      yield {
        state: snapshot(),
        highlight: { removed: [LABELS[i]] },
        explanation: `${LABELS[i]} has only ${neighbors.length} neighbor${neighbors.length === 1 ? '' : 's'} — fewer than minPts=${minPts}. Marked as NOISE. If a later cluster expansion reaches it, it becomes a border point instead.`,
      };
      continue;
    }

    // Core point — start a new cluster
    const label = clusterColors[currentCluster % clusterColors.length];
    currentCluster++;
    pointType[i] = 'core';
    clusterId[i] = label;

    yield {
      state: snapshot(),
      highlight: { active: [LABELS[i]] },
      explanation: `${LABELS[i]} has ${neighbors.length} neighbors ≥ minPts=${minPts} — it is a CORE point. Start cluster "${label}". Now expand: every neighbor joins this cluster, and every neighbor that is itself a core point adds its own neighbors to the expansion queue.`,
    };

    // Seed set: neighbors to expand (excluding i itself, already assigned)
    const seeds = neighbors.filter((j) => j !== i);
    let s = 0;

    while (s < seeds.length) {
      const j = seeds[s];
      s++;

      if (pointType[j] === 'noise') {
        // Reclaim noise as border
        pointType[j] = 'border';
        clusterId[j] = label;

        yield {
          state: snapshot(),
          highlight: { active: [LABELS[j]], found: [LABELS[i]] },
          explanation: `${LABELS[j]} was noise, but the expansion from ${LABELS[i]}'s cluster reached it. Reclaimed as a BORDER point — it belongs to the cluster but is not dense enough to expand further.`,
        };
        continue;
      }

      if (clusterId[j] !== null) continue; // already in a cluster

      clusterId[j] = label;
      const jNeighbors = regionQuery(DATA, j, eps);

      if (jNeighbors.length >= minPts) {
        pointType[j] = 'core';
        // Add new reachable points to the seed set
        for (const k of jNeighbors) {
          if (!seeds.includes(k) && k !== i) seeds.push(k);
        }

        yield {
          state: snapshot(),
          highlight: { active: [LABELS[j]], visited: jNeighbors.map((k) => LABELS[k]) },
          explanation: `${LABELS[j]} joins cluster "${label}" and has ${jNeighbors.length} neighbors ≥ minPts=${minPts} — also a CORE point. Its neighbors are added to the expansion queue. The cluster grows by density-reachability: core points chain together, pulling the cluster boundary outward.`,
        };
      } else {
        pointType[j] = 'border';

        yield {
          state: snapshot(),
          highlight: { active: [LABELS[j]] },
          explanation: `${LABELS[j]} joins cluster "${label}" but has only ${jNeighbors.length} neighbor${jNeighbors.length === 1 ? '' : 's'} — a BORDER point. It belongs to the cluster but cannot expand it further. Border points sit at the edge of dense regions.`,
        };
      }
    }
  }

  // --- Final summary ---
  const clusters = [...new Set(Object.values(clusterId).filter((c) => c !== 'noise'))];
  const noiseCount = clusterId.filter((c) => c === 'noise').length;
  const coreCount = pointType.filter((t) => t === 'core').length;
  const borderCount = pointType.filter((t) => t === 'border').length;

  yield {
    state: snapshot(),
    highlight: {},
    explanation: `DBSCAN complete. Found ${clusters.length} cluster${clusters.length === 1 ? '' : 's'} and ${noiseCount} noise point${noiseCount === 1 ? '' : 's'}. ${coreCount} core points (dense enough to expand), ${borderCount} border points (reachable but not dense). No k was chosen — the algorithm discovered the cluster count from the data's density structure.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each frame shows 10 points on a 2D scatter plot. Colors encode cluster membership: gray means unvisited, colored means assigned to a cluster, and red-highlighted points are noise. The active point (yellow outline) is the one currently being queried.',
        'During an epsilon-neighborhood query, visited points (blue outline) show which points fall within the radius. When a core point is found, the cluster expands outward through density-reachable chains. Watch how core points pull their neighbors into the cluster, and how border points join but do not expand further.',
        'The key inference: if a point has enough neighbors within epsilon, it is dense, and all those neighbors are reachable from the same cluster. Isolated points become noise. Try different epsilon values to see clusters merge (large epsilon) or fragment (small epsilon).',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'K-means requires you to choose k and always returns exactly k convex clusters. Real data contains rings, arcs, unequal densities, and outliers that k-means cannot represent. A customer dataset might have one dense urban segment, one sprawling rural segment, and scattered fraudulent accounts that belong to no group at all.',
        { type: 'callout', text: 'DBSCAN replaces a chosen cluster count with a local density rule, so clusters grow where neighborhoods stay connected.' },
        "DBSCAN (Density-Based Spatial Clustering of Applications with Noise) was introduced by Ester, Kriegel, Sander, and Xu at KDD 1996 to solve this. It defines clusters as connected regions of high point density, separated by low-density gaps. Cluster shape is unconstrained. Outliers are labeled as noise rather than forced into a group. The number of clusters emerges from the data — the user never specifies k.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A reasonable first attempt is k-means: pick k centroids, assign each point to its nearest centroid, recenter, repeat. It converges fast and scales well. For compact, round, equally sized clusters, it works.',
        'Another attempt is single-linkage hierarchical clustering: merge the two closest points (or clusters) repeatedly and cut the dendrogram at some height. This can find non-convex shapes, but it is O(n^2) in time and memory, and is fragile to noise — one stray point between two clusters can chain them together (the single-link problem).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "K-means fails because its objective (within-cluster sum of squares) assumes clusters are convex blobs of similar size. Two concentric rings, a crescent beside a blob, or clusters with 10x density differences all produce wrong answers. K-means also has no concept of noise — every point must belong to a cluster, so outliers warp the centroids they are forced into.",
        'Single-linkage fails on noise because one bridge point between two natural clusters merges them. And hierarchical methods store the full distance matrix — O(n^2) memory — making them impractical beyond tens of thousands of points.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A cluster is a region where points are packed tightly together, separated from other clusters by regions where points are sparse. DBSCAN operationalizes this with two parameters: epsilon (a neighborhood radius) and minPts (the minimum number of points that must fall within that radius for the region to count as dense).',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/DBSCAN-Illustration.svg/500px-DBSCAN-Illustration.svg.png', alt: 'DBSCAN diagram showing core, border, and noise points with epsilon neighborhoods', caption: 'Core points, border points, and noise are defined by the same epsilon-neighborhood rule. Source: https://en.wikipedia.org/wiki/DBSCAN.' },
        "A point with at least minPts neighbors within epsilon is a CORE point — it sits in a dense region. A point reachable from a core point but without enough neighbors of its own is a BORDER point — it sits at the cluster's edge. A point reachable from no core point is NOISE. Clusters form by chaining core points together: if core point A is in core point B's neighborhood, they belong to the same cluster, and the cluster boundary is the set of border points reachable from any core in the chain.",
        'This chaining is the key move. It lets DBSCAN follow any shape — rings, crescents, filaments — because the cluster boundary is defined by local density, not by distance to a single center.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each unvisited point p: (1) compute its epsilon-neighborhood — every point within distance epsilon. (2) If the neighborhood has fewer than minPts points, label p as noise (provisionally — a later expansion may reclaim it as a border point). (3) If the neighborhood has at least minPts points, p is a core point: start a new cluster, assign p to it, and put all of p\'s neighbors in a seed queue. (4) For each point q in the seed queue: if q was noise, reclaim it as a border point in this cluster; if q is unvisited, assign it to this cluster, query its own epsilon-neighborhood, and if q is also a core point, add its neighbors to the seed queue. The cluster is complete when the seed queue is empty.',
        'The seed-queue expansion is a breadth-first traversal through core-point chains. It guarantees that every point density-reachable from the first core point ends up in the same cluster.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the density-reachability relation. Two core points p and q are density-connected if there exists a chain of core points from p to q where each consecutive pair is within epsilon of each other. DBSCAN assigns all density-connected core points to the same cluster and attaches border points to the cluster of the core point that reached them first.',
        'The algorithm visits each point exactly once as a seed. Each neighborhood query returns a fixed set of neighbors for given epsilon. Once a point is assigned to a cluster, it is never reassigned. The BFS expansion guarantees that the transitive closure of density-reachability is fully explored before moving to the next unvisited point. No cluster can be split, and no two clusters can be merged, because a gap in density (a region where no point has minPts neighbors) breaks the reachability chain.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Ten 2D points. Cluster A: p0=(1,2), p1=(1.5,2.5), p2=(2,2), p3=(2.5,3), p4=(1.5,1.5). Cluster B: p5=(7,7.5), p6=(7.5,8), p7=(8,7), p8=(8.5,8.5). Noise: p9=(5,10). Parameters: epsilon=2.0, minPts=2.',
        'Start at p0. Epsilon-neighborhood: p1 is distance 0.71, p2 is 0.5 (note: distance from (1,2) to (2,2) is 1.0), p4 is 0.71 — all within epsilon=2.0. p3 is distance 1.80, also within. p0 has 4 neighbors (itself + 3 others, or just counting others: at least 4 within ε). Since 4 ≥ minPts=2, p0 is a core point. Start cluster A. Add p1, p2, p3, p4 to the seed queue.',
        'Expand p1: neighbors include p0, p2, p3, p4 — all within epsilon. p1 is core (≥2 neighbors). p0 is already in cluster A; p2, p3, p4 added. Expand p2: same dense neighborhood, also core. Continue until the seed queue is empty. All five points in cluster A.',
        'Move to p5 (next unvisited). Epsilon-neighborhood: p6 (dist 0.71), p7 (dist 1.12), p8 (dist 1.80) — all within epsilon=2.0. p5 is core. Start cluster B. Expand through p6, p7, p8. All four points in cluster B.',
        'Move to p9 at (5,10). Nearest other point is p6 at (7.5,8) — distance 2.92, which exceeds epsilon=2.0. p9 has 0 neighbors within ε (besides itself). Since 0 < minPts=2, p9 is labeled NOISE.',
        'Result: 2 clusters (A with 5 points, B with 4 points) and 1 noise point. No k was specified. The algorithm discovered two groups from the density structure alone.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The naive implementation runs a range query for each of the n points, and each range query scans all n points: O(n^2) total time. For 10,000 points, that is 100 million distance computations. For 1,000,000 points, one trillion — impractical.',
        'With a spatial index (k-d tree or R-tree), each range query costs O(log n) on average in low dimensions. Total time drops to O(n log n). This is the standard implementation in production libraries like scikit-learn (which uses a ball tree or k-d tree). Memory is O(n) for the index plus O(n) for labels.',
        'The practical cost depends on dimensionality. In 2-3 dimensions, spatial indexes work well. Above ~20 dimensions, the curse of dimensionality makes range queries degrade toward O(n) per query, and DBSCAN reverts to O(n^2). For high-dimensional embeddings, consider running PCA or UMAP first to reduce dimensions before clustering.',
        'Doubling the number of points: with a spatial index, cost roughly doubles (O(n log n)); without one, cost quadruples (O(n^2)). Doubling epsilon increases the average neighborhood size, making each query return more points and slowing expansion — but total work is still bounded by the same asymptotic class.',
      ],
    },
    {
      heading: 'Choosing epsilon and minPts',
      paragraphs: [
        'DBSCAN has two parameters instead of k-means\' one, but they are more interpretable. Epsilon defines the physical scale of density: "how close must points be to count as neighbors?" MinPts defines the density threshold: "how many neighbors make a region dense?"',
        'The k-distance plot is the standard tool for choosing epsilon. For each point, compute the distance to its k-th nearest neighbor (where k = minPts). Sort these distances and plot them. The curve rises slowly through the dense regions and then sharply at the transition to noise. The elbow of this curve is a good epsilon. Below the elbow, too many points are noise; above it, clusters merge.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/DBSCAN-density-data.svg/250px-DBSCAN-density-data.svg.png', alt: 'Nonlinear clusters and noise points that DBSCAN can identify', caption: 'Density-based clustering can recover shapes that centroid methods split or blur. Source: https://en.wikipedia.org/wiki/DBSCAN.' },
        'MinPts controls sensitivity to noise. The original paper recommends minPts ≥ dimensionality + 1. For 2D data, minPts = 3 or 4 is common. Larger minPts makes the algorithm more conservative — small clumps become noise. Smaller minPts lets small groups form clusters but risks treating noise as structure. In practice, minPts = 5-10 works for most datasets.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Geospatial analysis: DBSCAN excels at finding clusters of events on a map — crime hotspots, taxi pickup zones, earthquake epicenters — where clusters are irregular shapes and isolated points are genuinely noise, not members of a distant centroid.',
        'Anomaly detection: because DBSCAN explicitly labels noise, it doubles as an outlier detector. Points that do not belong to any dense region are flagged automatically. Fraud detection pipelines use this: cluster normal transactions, and anything labeled noise gets flagged for review.',
        "Image segmentation: in color space or feature space, DBSCAN groups pixels with similar attributes into regions without assuming the number of segments. It handles arbitrary region shapes that k-means' Voronoi boundaries cannot represent.",
        'Astronomy: the original DBSCAN paper cited galaxy cluster detection as a motivating application. Star catalogs contain millions of points with irregular cluster shapes and vast empty regions — exactly the setting DBSCAN was designed for.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Varying density is DBSCAN\'s main weakness. If one cluster is ten times denser than another, no single epsilon captures both — the dense cluster needs a small epsilon, the sparse one needs a large epsilon. With one epsilon, either the sparse cluster fragments or the dense cluster bleeds into its surroundings.',
        'High dimensions degrade DBSCAN because distances become less meaningful (the "curse of dimensionality") and spatial indexes lose their advantage. With 100-dimensional embeddings, every point is roughly equidistant from every other, making the epsilon neighborhood either empty or containing everything.',
        'The algorithm is sensitive to the epsilon parameter. A small change in epsilon can split a cluster into two or merge two clusters into one. There is no built-in stability guarantee. The k-distance plot helps, but the elbow is not always sharp.',
        'Border points are non-deterministic: if a border point is reachable from two different clusters, it joins whichever cluster\'s expansion reaches it first. Different point orderings can assign the same border point to different clusters. Core points and noise are deterministic.',
      ],
    },
    {
      heading: 'HDBSCAN: the parameter-free successor',
      paragraphs: [
        "HDBSCAN (Hierarchical DBSCAN, Campello et al. 2013) eliminates the epsilon parameter entirely. It builds a hierarchy of DBSCAN clusterings across all possible epsilon values, extracts the most persistent clusters from the hierarchy, and returns a flat clustering plus outlier scores. The only parameter is minPts (renamed min_cluster_size), which controls the minimum group size.",
        'HDBSCAN handles varying density because it does not commit to a single epsilon. A dense cluster that would fragment at a large epsilon is captured at a small epsilon within the hierarchy, and HDBSCAN selects the most stable level for each cluster independently. In practice, HDBSCAN with min_cluster_size = 5-15 works well across a wide range of datasets without tuning.',
        'The cost is O(n^2) in the worst case (building the mutual reachability graph), but optimized implementations achieve O(n log n) for low-dimensional data. The Python hdbscan library and scikit-learn 1.3+ include production-quality implementations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Ester, M., Kriegel, H.-P., Sander, J., and Xu, X. (1996). 'A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise.' KDD 1996. The original paper that introduced DBSCAN — defines core/border/noise, epsilon-neighborhood expansion, and proves density-reachability correctness.",
        "Campello, R.J.G.B., Moulavi, D., and Sander, J. (2013). 'Density-Based Clustering Based on Hierarchical Density Estimates.' PAKDD 2013. Introduces HDBSCAN, which builds a cluster hierarchy over all epsilon values and extracts stable clusters without requiring a fixed epsilon.",
        "Centroid-based alternative: K-Means assigns every point to one of k centroids using Euclidean distance. Fast and simple, but assumes convex, equally sized clusters and has no noise concept. Study it to understand the tradeoff between simplicity and shape flexibility.",
        "Multi-scale structure: Hierarchical Clustering (agglomerative or divisive) builds a dendrogram of merges or splits. Unlike DBSCAN, it shows cluster structure at every granularity. Single-linkage hierarchical clustering is the closest relative — both use local connectivity — but hierarchical methods store O(n^2) distances.",
        "Spatial acceleration: KD-Tree provides O(log n) range queries in low dimensions, which is exactly what DBSCAN needs for its epsilon-neighborhood lookups. Understanding k-d trees explains why DBSCAN is fast in 2-3 dimensions but degrades in high dimensions.",
        "Dimension reduction before clustering: PCA projects high-dimensional data onto principal axes, making distance metrics more meaningful and spatial indexes effective. Run PCA or UMAP before DBSCAN when working with embeddings or high-dimensional features.",
      ],
    },
  ],
};
