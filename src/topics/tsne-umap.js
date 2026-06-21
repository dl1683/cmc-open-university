// t-SNE & UMAP: your embeddings live in 768 dimensions; your screen has 2.
// Neighborhood-preserving projection makes the invisible geometry readable —
// and then lies to you about everything except the neighborhoods.

import { scatterState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tsne-umap',
  title: 't-SNE & UMAP: Seeing Embeddings',
  category: 'AI & ML',
  summary: 'Squash 768 dimensions into 2 by preserving neighborhoods — then learn which parts of the picture are lies.',
  controls: [
    { id: 'view', label: 'Project', type: 'select', options: ['squashing 768-D into 2-D', 'how to read (and misread) the map'], defaultValue: 'squashing 768-D into 2-D' },
  ],
  run,
};

// 12 words, 3 true semantic clusters (as their 768-D embeddings would know).
const WORDS = [
  { id: 'cat', label: 'cat', cluster: 'animals', fx: 1.8, fy: 7.2 },
  { id: 'kitten', label: 'kitten', cluster: 'animals', fx: 2.4, fy: 7.6 },
  { id: 'dog', label: 'dog', cluster: 'animals', fx: 1.5, fy: 6.5 },
  { id: 'puppy', label: 'puppy', cluster: 'animals', fx: 2.3, fy: 6.8 },
  { id: 'pizza', label: 'pizza', cluster: 'food', fx: 7.1, fy: 7.3 },
  { id: 'sushi', label: 'sushi', cluster: 'food', fx: 7.8, fy: 6.9 },
  { id: 'pasta', label: 'pasta', cluster: 'food', fx: 7.3, fy: 6.5 },
  { id: 'taco', label: 'taco', cluster: 'food', fx: 7.9, fy: 7.5 },
  { id: 'python', label: 'python', cluster: 'code', fx: 4.3, fy: 1.8 },
  { id: 'java', label: 'java', cluster: 'code', fx: 5.1, fy: 2.2 },
  { id: 'rust', label: 'rust', cluster: 'code', fx: 4.6, fy: 1.3 },
  { id: 'cpp', label: 'c++', cluster: 'code', fx: 5.0, fy: 1.6 },
];
// Fixed "random" starting layout (what iteration 0 of the optimizer sees).
const START = [
  [6.2, 2.1], [1.1, 4.4], [8.3, 6.7], [3.9, 8.1], [2.2, 1.5], [5.5, 5.0],
  [0.8, 7.9], [7.4, 3.3], [8.8, 1.2], [3.1, 3.7], [6.9, 8.6], [1.7, 6.1],
];
const lerp = (t) =>
  WORDS.map((w, i) => ({
    id: w.id,
    label: w.label,
    clusterId: w.cluster,
    x: START[i][0] + (w.fx - START[i][0]) * t,
    y: START[i][1] + (w.fy - START[i][1]) * t,
  }));
const CENTROIDS = [
  { id: 'animals', x: 2, y: 7, label: 'animals' },
  { id: 'food', x: 7.5, y: 7, label: 'food' },
  { id: 'code', x: 4.75, y: 1.7, label: 'code' },
];
const AXES = { x: { label: 't-SNE dim 1 (no meaning!)', min: 0, max: 9.5 }, y: { label: 't-SNE dim 2 (no meaning!)', min: 0, max: 9 } };

function* squash() {
  yield {
    state: matrixState({
      title: 'The problem: 12 words, 768 numbers each',
      rows: WORDS.slice(0, 4).map(({ id, label }) => ({ id, label })),
      columns: [{ id: 'd1', label: 'dim 1' }, { id: 'd2', label: 'dim 2' }, { id: 'd3', label: '…' }, { id: 'd768', label: 'dim 768' }],
      values: [[0.12, -0.4, 0, 0.31], [0.14, -0.38, 0, 0.29], [0.09, -0.41, 0, 0.33], [0.11, -0.37, 0, 0.3]],
      format: (v) => (v === 0 ? '…' : v.toFixed(2)),
    }),
    highlight: { compare: ['cat:d1', 'kitten:d1'] },
    explanation: 'Embeddings & Similarity gave every word a coordinate in ~768-dimensional space, where cosine distance means meaning. The catch: nobody can LOOK at 768 dimensions. We want a 2-D picture — but naive squashing (just keep dims 1 and 2, or even the two best PCA directions) overlays unrelated clusters like shadows of a sculpture from one angle. The question t-SNE and UMAP answer: which 2-D arrangement best preserves the part of the geometry humans actually use — WHO IS NEAR WHOM?',
  };

  yield {
    state: scatterState({ axes: AXES, points: lerp(0) }),
    highlight: {},
    explanation: 'The algorithm\'s honest starting point: throw all 12 words onto the plane at RANDOM (iteration 0, faithfully scripted here). Now define the goal precisely. In the original 768-D space, compute each point\'s NEIGHBOR PROBABILITIES — for "cat", the embedding metric says kitten/dog/puppy are near, pizza is far (the "perplexity" knob sets roughly how many neighbors count). The 2-D layout will be judged by one score: do the SAME neighbor probabilities hold down here? The mismatch (a KL divergence — the comparison tool from Entropy & Information) is the loss.',
  };

  yield {
    state: scatterState({ axes: AXES, points: lerp(0.45) }),
    highlight: { active: ['cat', 'kitten', 'dog', 'puppy'] },
    explanation: 'Then minimize that mismatch by — what else — Gradient Descent: every point feels a pull toward its true high-D neighbors and a push from everyone else (t-SNE\'s heavy-tailed t-distribution does the pushing, which is what stops everything collapsing into one blob — the "t" earns its place in the name). Mid-optimization, the structure is emerging: the animals are drifting together, food is coalescing top-right, and points that started as accidental neighbors are being torn apart.',
    invariant: 'Attraction between true high-D neighbors, repulsion between everyone else — layout by force.',
  };

  yield {
    state: scatterState({ axes: AXES, points: lerp(1), centroids: CENTROIDS }),
    highlight: { found: ['cat', 'kitten', 'dog', 'puppy'] },
    explanation: 'Converged: three clean islands — animals, food, languages — recovered from 768-D with no labels, no supervision, just neighborhood preservation. This picture is the standard first diagnostic for any embedding model: train embeddings, project, look. Clusters where meaning clusters = the model learned something; your "cat" floating among the pastas = something is broken upstream. UMAP earns its popularity doing the same neighborhoods-first job with a graph-based construction — typically 10–100Ã— faster, slightly better at keeping the big-picture arrangement, the default at scale today.',
  };

  yield {
    state: matrixState({
      title: 't-SNE vs UMAP, practically',
      rows: [{ id: 'tsne', label: 't-SNE' }, { id: 'umap', label: 'UMAP' }],
      columns: [{ id: 'speed', label: 'speed' }, { id: 'global', label: 'global structure' }, { id: 'knob', label: 'main knob' }],
      values: [[1, 2, 3], [4, 5, 6]],
      format: (v) => ['', 'slow (O(n²)-ish; Barnes-Hut helps)', 'weak — trust islands, not oceans', 'perplexity (~5–50)', '10–100Ã— faster', 'somewhat better', 'n_neighbors (~15)'][v],
    }),
    highlight: { compare: ['tsne:speed', 'umap:speed'] },
    explanation: 'The practical comparison card. Both are NEIGHBORHOOD-FIRST by construction — that is the family trait and the contract: local relationships are what they promise to keep, and (as the other view demonstrates) very nearly the ONLY thing. Both have a knob that means "how many neighbors define a neighborhood," and both will draw a different — equally valid — map every run unless you fix the random seed. Which raises the question the second view answers: if the map changes per run and per knob, what in it can you actually trust?',
  };
}

function* misread() {
  yield {
    state: scatterState({
      axes: AXES,
      points: [
        ...lerp(1).map((p) => (p.clusterId === 'animals' ? { ...p, x: 2 + (p.x - 2) * 2.2, y: 7 + (p.y - 7) * 2.2 } : p)),
      ],
      centroids: CENTROIDS,
    }),
    highlight: { compare: ['cat', 'kitten', 'dog', 'puppy'] },
    explanation: 'Lie #1 — CLUSTER SIZE. Same data, different perplexity: the animals cluster now sprawls across triple the area. Did animal words get more diverse? No — t-SNE EQUALIZES local densities: tight high-D clusters get inflated, diffuse ones get compacted, and the on-screen area of a cluster carries almost no information. Measuring "spread" off a t-SNE plot is reading tea leaves. (Every claim in this view is demonstrated interactively in Wattenberg, Viégas & Johnson\'s "How to Use t-SNE Effectively" — distill.pub, 2016 — the canonical reference.)',
    invariant: 't-SNE equalizes densities: cluster area on the map does not measure cluster spread in the data.',
  };

  yield {
    state: scatterState({
      axes: AXES,
      points: lerp(1).map((p) => (p.clusterId === 'food' ? { ...p, x: p.x - 3, y: p.y - 2.2 } : p)),
      centroids: [CENTROIDS[0], { ...CENTROIDS[1], x: 4.5, y: 4.8 }, CENTROIDS[2]],
    }),
    highlight: { compare: ['pizza', 'cat'] },
    explanation: 'Lie #2 — DISTANCES BETWEEN CLUSTERS. Another run, another seed: food now sits beside the animals instead of across the map. Which arrangement is "true"? NEITHER — once clusters are far enough apart to be separate neighborhoods, the algorithm\'s repulsion treats them interchangeably, and the gaps between islands are layout accidents. "Cluster A is closer to B than to C" is exactly the kind of sentence a t-SNE plot cannot support — verify it with real cosine distances in the original space (Embeddings & Similarity has the tool).',
  };

  yield {
    state: scatterState({
      axes: { x: { label: 'projection of PURE NOISE', min: 0, max: 9.5 }, y: { label: '', min: 0, max: 9 } },
      points: [
        [1.2, 7.0], [1.8, 7.5], [1.4, 6.6], [2.1, 7.1],
        [7.2, 6.8], [7.7, 7.4], [7.4, 6.4],
        [4.4, 1.6], [4.9, 2.1], [5.2, 1.4], [4.1, 1.9], [4.8, 1.1],
      ].map(([x, y], i) => ({ id: `n${i}`, x, y, label: '' })),
    }),
    highlight: { removed: ['n0', 'n4', 'n7'] },
    explanation: 'Lie #3 — the cruelest: STRUCTURE FROM NOTHING. These twelve points are a projection of PURE random noise — no clusters exist in the source data — yet at low perplexity the map draws confident islands anyway. The forces that compress real neighborhoods will happily compress coincidental ones; humans then do the rest, the same instinct that drew constellations on randomly scattered stars. The defense is procedural, not visual: run multiple perplexities and seeds (real structure persists, phantoms reshuffle), and confirm any discovered cluster with statistics computed in the ORIGINAL space.',
    invariant: 'A clustered-looking map is not evidence of clusters: noise projects into islands too.',
  };

  yield {
    state: matrixState({
      title: 'The reading contract',
      rows: [
        { id: 'neighbors', label: 'who neighbors whom' },
        { id: 'size', label: 'cluster sizes' },
        { id: 'gaps', label: 'gaps between clusters' },
        { id: 'axes', label: 'the axes themselves' },
      ],
      columns: [{ id: 'trust', label: 'trustworthy?' }],
      values: [[1], [0], [0], [0]],
      format: (v) => (v ? 'YES — the one promise' : 'no — layout artifact'),
    }),
    highlight: { found: ['neighbors:trust'], removed: ['size:trust', 'gaps:trust', 'axes:trust'] },
    explanation: 'The contract, on one card: these maps promise NEIGHBORHOODS and nothing else. Sizes are equalization artifacts, gaps are repulsion accidents, and the axes are meaningless directions the optimizer happened to settle into (label them "dim 1/dim 2" and never interpret them — they are not features). Used within the contract, projection is among the most valuable debugging tools in ML — it finds mislabeled clusters, dataset bleed, embedding collapse in minutes. Used outside it, it is a generator of beautiful, publishable, wrong conclusions. The map is not the territory; here the map is specifically a NEIGHBORHOOD map, and everything else on it is decoration.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'squashing 768-D into 2-D') yield* squash();
  else if (view === 'how to read (and misread) the map') yield* misread();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for t-SNE & UMAP: Seeing Embeddings. Squash 768 dimensions into 2 by preserving neighborhoods — then learn which parts of the picture are lies..",
        {type: "callout", text: "Projection maps are neighborhood diagnostics, not geometry certificates; trust local neighbors and verify every global claim back in the source space."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Embeddings often live in hundreds or thousands of dimensions, while humans inspect data on a two-dimensional screen. t-SNE and UMAP exist because we need a diagnostic view of high-dimensional neighborhoods: which points sit near one another, which labels look mixed, and which regions look suspicious enough to investigate.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/T-SNE_Embedding_of_MNIST.png', alt: 't-SNE projection of MNIST digits into colored two-dimensional clusters', caption: 'A t-SNE map can reveal local grouping, but the visual cluster area and axis direction are layout artifacts rather than measured facts. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:T-SNE_Embedding_of_MNIST.png.'},
        'This is not a compression method for preserving every geometric fact. It is a visualization method with a narrow contract. The map is useful for local neighborhood structure and cluster debugging. It is dangerous when readers treat island size, axis direction, or gaps between islands as literal measurements.',
        'The practical setting is usually messy. You may have millions of text chunks, product embeddings, image features, cells, customers, or failures, and a nearest-neighbor metric that only becomes meaningful after a model has converted raw objects into vectors. Projection gives you a first pass over that invisible geometry. It does not certify the model, but it can quickly show whether the model is worth deeper evaluation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Visualize high-dimensional data. PCA projects onto the top-k principal components. It preserves global linear structure but cannot capture nonlinear manifolds: a curved surface in 100D squashed flat looks like a blob in 2D.',
        'MDS (multidimensional scaling) preserves all pairwise distances. O(n^2) computation, and distant points dominate, distorting local neighborhoods.',
        't-SNE (van der Maaten & Hinton, 2008) focuses on preserving LOCAL neighborhoods. Step 1: in high-D, compute pairwise similarities using Gaussian kernels -- nearby points have high similarity. Step 2: in low-D (2D or 3D), use Student\'s t-distribution (heavy tails) for similarities. Step 3: minimize KL divergence between high-D and low-D similarity distributions via gradient descent.',
        'The t-distribution\'s heavy tails prevent crowding: in high-D, moderate-distance points can spread out more in low-D. Result: clusters and neighborhoods are faithfully preserved, but global distances between clusters are NOT meaningful.',
        'The perplexity parameter (~5-50) controls the effective number of neighbors considered. Low perplexity produces tight clusters. High perplexity reveals more global structure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is neighborhood preservation. Instead of asking the two-dimensional map to preserve every distance, t-SNE and UMAP ask it to preserve who is near whom. If cat, kitten, dog, and puppy are close in embedding space, the optimizer tries to place them close on the screen. If pizza and rust are far, it tries not to make them accidental neighbors.',
        'This local focus is the strength and the limitation. Local neighborhoods can reveal mislabeled samples, embedding collapse, duplicate data, or unexpected semantic mixing. Global geometry is much less trustworthy. The map can rotate, stretch, split, or move islands without changing the local relationships the algorithm cared about.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        't-SNE converts high-dimensional distances into neighbor probabilities. The perplexity parameter roughly controls how many neighbors matter. It then initializes points on a plane and uses gradient descent to make low-dimensional neighbor probabilities resemble high-dimensional ones. Nearby source points attract; other points repel. The heavy-tailed low-dimensional distribution helps separate groups that would otherwise crowd together.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/9/94/T-SNE_visualisation_of_word_embeddings_generated_using_19th_century_literature.png', alt: 't-SNE visualization of word embeddings with annotated local clusters', caption: 'This word-embedding projection is useful as an inspection surface: close labels invite source-space checks, while long-range distances should not be treated as semantic measurements. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:T-SNE_visualisation_of_word_embeddings_generated_using_19th_century_literature.png.'},
        'UMAP starts by building a nearest-neighbor graph. It treats the high-dimensional data as a fuzzy topological structure, then optimizes a low-dimensional graph layout. Its n_neighbors parameter controls the local-versus-global tradeoff: smaller values focus on very local neighborhoods, while larger values preserve broader structure at the cost of local sharpness.',
        'Many workflows run PCA first to reduce noise and dimensionality before t-SNE or UMAP. At larger scale, approximate nearest-neighbor methods such as HNSW may supply the neighbor graph. That makes projection a pipeline: clean vectors, find neighborhoods, optimize a layout, then validate claims back in the source space.',
      ],
    }
  ],
};
