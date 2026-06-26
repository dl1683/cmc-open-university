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
        'The scatter plot shows 10 unlabeled points in two dimensions. Gray means unvisited. When a point lights up with a yellow outline, the algorithm is querying its epsilon-neighborhood — asking "which other points are within distance epsilon of this one?" Points inside the radius get a blue outline.',
        'If enough neighbors exist (at least minPts), the queried point turns into a core point and starts a new cluster, shown by color. The cluster then expands outward: each neighbor is checked, and if it too is a core point, its neighbors join the expansion queue. Border points pick up the cluster color but do not expand further. Points that never reach the minPts threshold turn red — they are noise.',
        'Watch the chain reaction. A single core point seeds a cluster, then each core neighbor extends the frontier, pulling the boundary along curves and irregular shapes. Isolated points get left behind. Try raising epsilon to see two clusters merge into one, or lowering it to see a cluster fragment.',
        {type: 'image', src: './assets/gifs/dbscan.gif', alt: 'Animated walkthrough of the dbscan visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most clustering algorithms force you to decide the number of clusters before you run them. K-means takes a parameter k and always returns exactly k groups, each defined by a centroid. Every point gets assigned to some cluster, even if it is an obvious outlier that belongs to none. The clusters are always convex (roughly blob-shaped) because each point joins the nearest centroid, which carves the space into Voronoi cells.',
        { type: 'callout', text: 'DBSCAN replaces a chosen cluster count with a local density rule, so clusters grow where neighborhoods stay connected.' },
        'Real data breaks these assumptions constantly. GPS traces of taxi pickups form crescents around city blocks. Astronomical surveys contain filaments of galaxies separated by voids. Fraud detection needs to flag isolated transactions as outliers, not force them into a legitimate cluster. DBSCAN (Density-Based Spatial Clustering of Applications with Noise), introduced by Ester, Kriegel, Sander, and Xu at KDD 1996, was designed for exactly this. It discovers clusters of arbitrary shape, determines the number of clusters from the data itself, and explicitly labels outliers as noise.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'K-means is the default starting point: pick k random centroids, assign each point to its nearest centroid, recompute centroids as cluster means, repeat until stable. It runs in O(nk) per iteration, converges fast, and works well when clusters are compact, round, and roughly equal in size. For many practical datasets, it is the right tool.',
        'When shapes get irregular, a natural next step is hierarchical clustering — specifically single-linkage. Start with each point as its own cluster, then repeatedly merge the two closest clusters. The result is a dendrogram (a tree of merges) that you can cut at any height to get flat clusters. Single-linkage can follow elongated and non-convex shapes because it only requires one pair of close points to merge two groups.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'K-means minimizes within-cluster sum of squared distances, which mathematically assumes every cluster is a spherical Gaussian blob. Two concentric rings get split along a diameter. A crescent next to a compact blob gets carved into convex pieces. Clusters with 10x density differences get wrong boundaries because the centroid migrates toward the denser region. And every point must join some cluster — there is no "none of the above," so outliers warp the centroids they are forced into.',
        'Single-linkage handles shape but is fragile to noise. One stray point sitting between two natural clusters acts as a bridge, merging them into one. This is called the chaining effect, and it is nearly impossible to avoid in noisy data. Hierarchical methods also store a full n-by-n distance matrix — O(n^2) memory — which becomes impractical past tens of thousands of points.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Forget centroids and distance matrices. Define a cluster as a region where points are packed densely, separated from other clusters by regions where points are sparse. To make "dense" precise, DBSCAN uses two parameters. Epsilon (written as the Greek letter epsilon, often abbreviated eps) is a distance radius. MinPts is a count threshold. For any point p, its epsilon-neighborhood is the set of all points within distance epsilon of p. If that set contains at least minPts points (including p itself in some formulations, or excluding it — the animation here includes p), then p sits in a dense region.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/DBSCAN-Illustration.svg/500px-DBSCAN-Illustration.svg.png', alt: 'DBSCAN diagram showing core, border, and noise points with epsilon neighborhoods', caption: 'Core points, border points, and noise are defined by the same epsilon-neighborhood rule. Source: https://en.wikipedia.org/wiki/DBSCAN.' },
        'This density test classifies every point into one of three roles. A core point has at least minPts neighbors within epsilon — it anchors a dense region. A border point falls within epsilon of some core point but does not itself have enough neighbors to be core — it sits at the cluster edge. A noise point is not within epsilon of any core point — it is isolated. The critical move is chaining: if core point A is in core point B\'s epsilon-neighborhood, they belong to the same cluster. This chain can follow any shape — rings, crescents, filaments — because membership is decided by local density, never by distance to a single center.',
        'The cluster boundary emerges from where the chain of core points runs out. Wherever a gap in density breaks the chain (no point in the gap has minPts neighbors), a new cluster begins on the other side.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Iterate through every point in the dataset. For each unvisited point p, compute its epsilon-neighborhood by measuring the distance from p to every other point and collecting those within epsilon. If the neighborhood contains fewer than minPts points, label p as noise — provisionally, because a later expansion may reclaim it. If the neighborhood contains at least minPts points, p is a core point: create a new cluster, assign p to it, and initialize a seed queue with all of p\'s neighbors.',
        'Process the seed queue one point at a time. For each point q in the queue: if q was previously labeled noise, reclaim it as a border point in the current cluster (it is reachable from a core point now). If q is unvisited, assign it to the current cluster and compute its own epsilon-neighborhood. If q itself has at least minPts neighbors, it is also a core point — add its neighbors to the seed queue. If q has fewer than minPts neighbors, it becomes a border point and does not expand the queue further.',
        'The queue drains when no more core points remain at the frontier. At that point, the cluster is complete. Return to the main loop and pick the next unvisited point. The algorithm terminates when every point has been visited exactly once as a starting candidate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on a relation called density-reachability. Point q is directly density-reachable from point p if p is a core point and q is in p\'s epsilon-neighborhood. Point q is density-reachable from p if there is a chain of points p = x0, x1, ..., xn = q where each xi+1 is directly density-reachable from xi. Two points p and q are density-connected if there exists some point o from which both p and q are density-reachable. A cluster is a maximal set of density-connected points.',
        'The BFS expansion through the seed queue computes exactly the transitive closure of direct density-reachability from the starting core point. Once a point is assigned to a cluster, it is never reassigned, because assignment only happens to unvisited or noise points — never to points already in another cluster. A density gap (a region where no point has minPts neighbors) breaks the reachability chain, guaranteeing that two natural clusters separated by sparse space are never merged. Core points and noise classification are deterministic for a given epsilon and minPts. Only border points reachable from two different clusters depend on processing order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each of the n points triggers one epsilon-neighborhood query. The naive query scans all n points, computing one distance each, so total time is O(n^2). For 10,000 points that is 100 million distance computations. For 1,000,000 points, one trillion — impractical without acceleration.',
        'A spatial index changes the picture. A k-d tree or ball tree answers each range query in O(log n) average time in low dimensions, bringing total runtime to O(n log n). Scikit-learn uses a ball tree or k-d tree by default. Memory is O(n) for the spatial index plus O(n) for the cluster labels — linear overall.',
        'Dimensionality is the hidden cost driver. In 2 or 3 dimensions, spatial indexes work well. Above roughly 20 dimensions, the curse of dimensionality makes every point roughly equidistant from every other, and range queries degrade to scanning all n points. DBSCAN effectively reverts to O(n^2). The standard workaround is to reduce dimensions first with PCA, UMAP, or t-SNE, then cluster in the reduced space.',
        'Doubling n with a spatial index roughly doubles runtime (O(n log n)). Without one, runtime quadruples (O(n^2)). Increasing epsilon makes each neighborhood query return more points, slowing the expansion phase proportionally, but the asymptotic class does not change.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Geospatial analysis is DBSCAN\'s home turf. Crime hotspot mapping, taxi pickup zone detection, and earthquake epicenter clustering all produce irregularly shaped clusters with genuine outliers. Points are 2D coordinates, distances are geographic, and the density model matches the physics: events concentrate where people concentrate, and isolated events are noise.',
        'Anomaly detection falls out for free. Because DBSCAN explicitly labels noise, any point that fails to join a cluster is an anomaly candidate. Fraud detection pipelines cluster normal transaction patterns and flag noise points for human review. No separate anomaly model is needed.',
        'Image segmentation in color or feature space groups pixels into regions of similar appearance. Unlike k-means, DBSCAN does not assume the number of segments or their shape. A photograph with an irregular shadow boundary gets segmented along the actual edge, not along a Voronoi cell wall.',
        'Astronomy was a motivating application in the original paper. Galaxy surveys contain millions of objects with filamentary cluster shapes and vast empty regions. DBSCAN recovers structures that centroid-based methods cannot represent.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Varying density is the primary failure mode. If one cluster is ten times denser than another, no single epsilon captures both correctly. A small epsilon fragments the sparse cluster into noise. A large epsilon merges the dense cluster into its surroundings. The user is forced to choose which cluster to sacrifice, or to run DBSCAN multiple times at different scales — which HDBSCAN automates (Campello et al. 2013).',
        'High-dimensional data breaks the distance metric itself. In 100 dimensions, the ratio between the nearest and farthest neighbor approaches 1.0, making epsilon neighborhoods either empty or containing everything. Spatial indexes lose their logarithmic advantage, and runtime degrades to O(n^2). Dimension reduction before clustering is not optional in this regime — it is required.',
        'Epsilon sensitivity means a small change in the parameter can split one cluster into two or merge two into one. The k-distance plot (see below) provides guidance, but the elbow is not always sharp, and datasets with multiple density scales have multiple elbows.',
        'Border point assignment is non-deterministic. A border point reachable from two clusters joins whichever cluster\'s expansion reaches it first, which depends on the order points are processed. Core points and noise labels are fully deterministic for a given epsilon and minPts. In practice, border points are rare enough that this non-determinism seldom matters.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Ten 2D points, epsilon = 2.0, minPts = 2. Cluster A region: p0=(1,2), p1=(1.5,2.5), p2=(2,2), p3=(2.5,3), p4=(1.5,1.5). Cluster B region: p5=(7,7.5), p6=(7.5,8), p7=(8,7), p8=(8.5,8.5). Isolated: p9=(5,10).',
        'Start at p0=(1,2). Compute distances to all other points. dist(p0,p1) = sqrt((0.5)^2 + (0.5)^2) = 0.71. dist(p0,p2) = sqrt((1)^2 + (0)^2) = 1.0. dist(p0,p3) = sqrt((1.5)^2 + (1)^2) = 1.80. dist(p0,p4) = sqrt((0.5)^2 + (0.5)^2) = 0.71. All four are within epsilon = 2.0. The remaining points (p5 through p9) are all more than 5 units away. So p0\'s epsilon-neighborhood is {p0, p1, p2, p3, p4} — five points. Since 5 >= minPts = 2, p0 is a core point. Start cluster A. Seed queue: [p1, p2, p3, p4].',
        'Pop p1=(1.5,2.5) from the queue. Its epsilon-neighborhood includes p0 (dist 0.71), p2 (dist 0.71), p3 (dist 1.12), p4 (dist 1.0) — four neighbors within epsilon, so p1 is also core. p0 is already in cluster A. p2, p3, p4 are already in the queue. No new points added. Pop p2=(2,2). Same dense neighborhood, also core. Pop p3, p4 — same. Queue empties. Cluster A = {p0, p1, p2, p3, p4}.',
        'Next unvisited: p5=(7,7.5). dist(p5,p6) = 0.71, dist(p5,p7) = 1.12, dist(p5,p8) = 1.80 — all within epsilon. dist(p5,p9) = sqrt(4 + 6.25) = 3.20 — outside epsilon. Epsilon-neighborhood: {p5, p6, p7, p8}, four points. Since 4 >= 2, p5 is core. Start cluster B. Expand through p6 (core, 3 neighbors), p7 (core, 3 neighbors), p8 (core, 3 neighbors). Cluster B = {p5, p6, p7, p8}.',
        'Next unvisited: p9=(5,10). Nearest point is p8=(8.5,8.5) at distance sqrt(12.25 + 2.25) = 3.81. No point is within epsilon = 2.0. Neighborhood size is 1 (only p9 itself). Since 1 < minPts = 2, p9 is labeled NOISE.',
        'Final result: 2 clusters, 1 noise point. The algorithm discovered both clusters and the outlier without being told how many groups to find. Changing epsilon to 1.0 would fragment cluster A (dist(p0,p3) = 1.80 exceeds 1.0, breaking the chain). Changing epsilon to 6.0 would merge both clusters into one (dist(p4,p5) = 7.43 is still too far, actually — the clusters are separated by about 5.5+ units, so they stay separate even at epsilon = 6.0, but the noise point p9 gets absorbed).',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Ester, M., Kriegel, H.-P., Sander, J., and Xu, X. (1996). "A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise." KDD 1996. The founding paper — defines core/border/noise, proves density-reachability correctness, and benchmarks against CLARANS on synthetic and geographic data.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/DBSCAN-density-data.svg/250px-DBSCAN-density-data.svg.png', alt: 'Nonlinear clusters and noise points that DBSCAN can identify', caption: 'Density-based clustering can recover shapes that centroid methods split or blur. Source: https://en.wikipedia.org/wiki/DBSCAN.' },
        'Campello, R.J.G.B., Moulavi, D., and Sander, J. (2013). "Density-Based Clustering Based on Hierarchical Density Estimates." PAKDD 2013. Introduces HDBSCAN, which sweeps over all epsilon values, builds a cluster hierarchy, and extracts the most stable clusters — eliminating the epsilon parameter entirely. The only tuning knob becomes min_cluster_size.',
        'Study K-Means next to understand the tradeoff: k-means is faster (O(nk) per iteration) and simpler, but it assumes convex, equally sized clusters and cannot flag noise. Study KD-Trees to understand why DBSCAN is fast in low dimensions: the k-d tree turns each epsilon-neighborhood query from O(n) to O(log n). Study PCA or UMAP to understand why dimension reduction is a prerequisite for DBSCAN on high-dimensional data: distance metrics lose discriminative power above ~20 dimensions, and spatial indexes degrade to brute-force scans.',
      ],
    },
  ],
};
