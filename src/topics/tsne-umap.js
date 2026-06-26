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
    explanation: `Embeddings & Similarity gave every word a coordinate in ~768-dimensional space, where cosine distance means meaning. The catch: nobody can LOOK at 768 dimensions. We want a 2-D picture — but naive squashing (just keep dims 1 and 2, or even the two best PCA directions) overlays unrelated ${CENTROIDS.length} clusters like shadows of a sculpture from one angle. The question t-SNE and UMAP answer: which 2-D arrangement best preserves the part of the geometry humans actually use — WHO IS NEAR WHOM?`,
  };

  yield {
    state: scatterState({ axes: AXES, points: lerp(0) }),
    highlight: {},
    explanation: `The algorithm's honest starting point: throw all ${WORDS.length} words onto the plane at RANDOM (${START.length} initial positions, iteration 0, faithfully scripted here). Now define the goal precisely. In the original 768-D space, compute each point's NEIGHBOR PROBABILITIES — for "${WORDS[0].label}", the embedding metric says kitten/dog/puppy are near, pizza is far (the "perplexity" knob sets roughly how many neighbors count). The 2-D layout will be judged by one score: do the SAME neighbor probabilities hold down here? The mismatch (a KL divergence — the comparison tool from Entropy & Information) is the loss.`,
  };

  yield {
    state: scatterState({ axes: AXES, points: lerp(0.45) }),
    highlight: { active: ['cat', 'kitten', 'dog', 'puppy'] },
    explanation: `Then minimize that mismatch by — what else — Gradient Descent: every point feels a pull toward its true high-D neighbors and a push from everyone else (t-SNE's heavy-tailed t-distribution does the pushing, which is what stops everything collapsing into one blob — the "t" earns its place in the name). Mid-optimization, the structure is emerging: the ${CENTROIDS[0].label} are drifting together, ${CENTROIDS[1].label} is coalescing top-right, and points that started as accidental neighbors are being torn apart.`,
    invariant: `Attraction between true high-D neighbors, repulsion from the other ${WORDS.length - 1} points — layout by force.`,
  };

  yield {
    state: scatterState({ axes: AXES, points: lerp(1), centroids: CENTROIDS }),
    highlight: { found: ['cat', 'kitten', 'dog', 'puppy'] },
    explanation: `Converged: ${CENTROIDS.length} clean islands — ${CENTROIDS.map(c => c.label).join(', ')} — recovered from 768-D with no labels, no supervision, just neighborhood preservation. This picture is the standard first diagnostic for any embedding model: train embeddings, project, look. Clusters where meaning clusters = the model learned something; your "${WORDS[0].label}" floating among the pastas = something is broken upstream. UMAP earns its popularity doing the same neighborhoods-first job with a graph-based construction — typically 10–100× faster, slightly better at keeping the big-picture arrangement, the default at scale today.`,
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
    explanation: `The practical comparison card. Both are NEIGHBORHOOD-FIRST by construction — that is the family trait and the contract: local relationships among ${WORDS.length} points are what they promise to keep, and (as the other view demonstrates) very nearly the ONLY thing. Both have a knob that means "how many neighbors define a neighborhood," and both will draw a different — equally valid — map of ${CENTROIDS.length} clusters every run unless you fix the random seed. Which raises the question the second view answers: if the map changes per run and per knob, what in it can you actually trust?`,
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
    explanation: `Lie #1 — CLUSTER SIZE. Same ${WORDS.length} words, different perplexity: the ${CENTROIDS[0].label} cluster now sprawls across triple the area. Did animal words get more diverse? No — t-SNE EQUALIZES local densities: tight high-D clusters get inflated, diffuse ones get compacted, and the on-screen area of a cluster carries almost no information. Measuring "spread" off a t-SNE plot is reading tea leaves. (Every claim in this view is demonstrated interactively in Wattenberg, Viégas & Johnson's "How to Use t-SNE Effectively" — distill.pub, 2016 — the canonical reference.)`,
    invariant: `t-SNE equalizes densities: cluster area on the map does not measure cluster spread among the ${CENTROIDS.length} clusters in the data.`,
  };

  yield {
    state: scatterState({
      axes: AXES,
      points: lerp(1).map((p) => (p.clusterId === 'food' ? { ...p, x: p.x - 3, y: p.y - 2.2 } : p)),
      centroids: [CENTROIDS[0], { ...CENTROIDS[1], x: 4.5, y: 4.8 }, CENTROIDS[2]],
    }),
    highlight: { compare: ['pizza', 'cat'] },
    explanation: `Lie #2 — DISTANCES BETWEEN CLUSTERS. Another run, another seed: ${CENTROIDS[1].label} now sits beside the ${CENTROIDS[0].label} instead of across the map. Which arrangement is "true"? NEITHER — once ${CENTROIDS.length} clusters are far enough apart to be separate neighborhoods, the algorithm's repulsion treats them interchangeably, and the gaps between islands are layout accidents. "Cluster A is closer to B than to C" is exactly the kind of sentence a t-SNE plot cannot support — verify it with real cosine distances in the original space (Embeddings & Similarity has the tool).`,
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
    explanation: `Lie #3 — the cruelest: STRUCTURE FROM NOTHING. These ${WORDS.length} points are a projection of PURE random noise — no clusters exist in the source data — yet at low perplexity the map draws ${CENTROIDS.length} confident islands anyway. The forces that compress real neighborhoods will happily compress coincidental ones; humans then do the rest, the same instinct that drew constellations on randomly scattered stars. The defense is procedural, not visual: run multiple perplexities and seeds (real structure persists, phantoms reshuffle), and confirm any discovered cluster with statistics computed in the ORIGINAL space.`,
    invariant: `A clustered-looking map is not evidence of clusters: noise from ${WORDS.length} points projects into islands too.`,
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
    explanation: `The contract, on one card: these maps promise NEIGHBORHOODS among ${WORDS.length} points and nothing else. Sizes are equalization artifacts, gaps are repulsion accidents, and the axes are meaningless directions the optimizer happened to settle into (label them "${AXES.x.label.split(' (')[0]}/${AXES.y.label.split(' (')[0]}" and never interpret them — they are not features). Used within the contract, projection is among the most valuable debugging tools in ML — it finds mislabeled clusters, dataset bleed, embedding collapse in minutes. Used outside it, it is a generator of beautiful, publishable, wrong conclusions. The map is not the territory; here the map is specifically a NEIGHBORHOOD map, and everything else on it is decoration.`,
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
        'Read the animation as a neighborhood-preservation test, not as a map with meaningful compass directions. A point is active when the layout is deciding where it should sit, and nearby points are useful only when they were also near in the original embedding space.',
        {
          type: 'callout',
          text: 'Projection maps are neighborhood diagnostics, not geometry certificates; trust local neighbors and verify every global claim back in the source space.',
        },
        'Visited regions show relationships the optimizer has already arranged; found clusters show local neighborhoods that survived the squeeze into two dimensions. The safe inference rule is narrow: if two labels land close together, inspect whether they were nearest neighbors before projection.',
        {
          type: 'image',
          src: './assets/gifs/tsne-umap.gif',
          alt: 'Animated walkthrough of the tsne umap visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An embedding is a list of numbers that places an object inside a mathematical space. A sentence embedding might have 768 coordinates, which a model can compare but a person cannot inspect directly.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/T-SNE_Embedding_of_MNIST.png',
          alt: 't-SNE projection of MNIST digits into colored two-dimensional clusters',
          caption: 'A t-SNE map can reveal local grouping, but the visual cluster area and axis direction are layout artifacts rather than measured facts. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:T-SNE_Embedding_of_MNIST.png.',
        },
        't-SNE and UMAP exist to turn those high-dimensional neighborhoods into a two-dimensional inspection surface. They help a reader see whether images, words, cells, customers, or documents that should be similar actually land near one another.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to choose two coordinates and plot them, or to use PCA, which means principal component analysis. PCA finds directions that preserve as much overall variance as possible, so it is sensible when the structure is mostly flat.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the interesting structure is local and curved. A handwritten digit manifold, a language embedding space, or a biological cell-state space can have neighborhoods that matter even though no single pair of raw axes carries the pattern.',
        'Preserving every pairwise distance is also too expensive and too strict for many datasets. With 100,000 points, all pair distances mean about 5 billion relationships, most of which are far-away pairs that do not help the viewer understand local similarity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to preserve neighborhoods instead of preserving the whole geometry. t-SNE converts distances into probabilities that say which points are likely neighbors, while UMAP builds a nearest-neighbor graph that says which local connections should remain visible.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        't-SNE measures distances in the original space and turns them into neighbor probabilities. It then places points on a plane and moves them by gradient descent until the low-dimensional neighbor probabilities resemble the original ones.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/9/94/T-SNE_visualisation_of_word_embeddings_generated_using_19th_century_literature.png',
          alt: 't-SNE visualization of word embeddings with annotated local clusters',
          caption: 'This word-embedding projection is useful as an inspection surface: close labels invite source-space checks, while long-range distances should not be treated as semantic measurements. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:T-SNE_visualisation_of_word_embeddings_generated_using_19th_century_literature.png.',
        },
        'UMAP starts from a nearest-neighbor graph, which connects each point to its closest source-space neighbors. It optimizes a two-dimensional graph layout that keeps those edges likely while pushing unrelated points apart enough to make the view readable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is about the objective, not about preserving every fact. If source points are strong neighbors, the loss charges the layout when they separate; if source points are not neighbors, the loss resists collapsing them into the same spot.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Exact neighbor computation can cost O(n^2), because n points can require comparing each point with every other point. Practical UMAP and large t-SNE pipelines use approximate nearest-neighbor indexes, trading a little neighbor accuracy for much lower runtime.',
        'Cost behaves like a pipeline. More points make neighbor search and layout optimization heavier, more dimensions make each distance computation heavier, and more iterations make the map cleaner but slower.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Embedding evaluation is the common use. Teams project document, image, product, or cell embeddings to inspect duplicate clusters, mislabeled samples, outliers, and regions where categories mix.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The map fails when readers treat it as geography. Cluster size, empty space, rotation, and distance between islands can change with parameters, random seed, initialization, or sampling.',
        'It also fails as a benchmark by itself. A pretty projection can hide bad nearest-neighbor quality, and a messy projection can come from a hard dataset rather than a bad model.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose four 3D embeddings are A = [1, 1, 0], B = [1.1, 1, 0], C = [8, 8, 0], and D = [8.2, 8.1, 0]. The distance from A to B is 0.1, while the distance from A to C is about 9.9, so A and B are strong neighbors and A and C are not.',
        'A projection that places A at [0, 0], B at [0.2, 0.1], C at [5, 5], and D at [5.1, 4.9] preserves the two local pairs. If another run places the C-D island at [-3, 7], the local story is still similar; the global island position is layout artifact.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study van der Maaten and Hinton, Visualizing Data using t-SNE (2008), and McInnes, Healy, and Melville, UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction (2018). Study PCA first for linear projection, nearest-neighbor search for graph building, and clustering metrics for checking the picture against measurable structure.',
      ],
    },
  ],
};
