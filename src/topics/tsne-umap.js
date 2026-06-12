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
    explanation: 'Converged: three clean islands — animals, food, languages — recovered from 768-D with no labels, no supervision, just neighborhood preservation. This picture is the standard first diagnostic for any embedding model: train embeddings, project, look. Clusters where meaning clusters = the model learned something; your "cat" floating among the pastas = something is broken upstream. UMAP earns its popularity doing the same neighborhoods-first job with a graph-based construction — typically 10–100× faster, slightly better at keeping the big-picture arrangement, the default at scale today.',
  };

  yield {
    state: matrixState({
      title: 't-SNE vs UMAP, practically',
      rows: [{ id: 'tsne', label: 't-SNE' }, { id: 'umap', label: 'UMAP' }],
      columns: [{ id: 'speed', label: 'speed' }, { id: 'global', label: 'global structure' }, { id: 'knob', label: 'main knob' }],
      values: [[1, 2, 3], [4, 5, 6]],
      format: (v) => ['', 'slow (O(n²)-ish; Barnes-Hut helps)', 'weak — trust islands, not oceans', 'perplexity (~5–50)', '10–100× faster', 'somewhat better', 'n_neighbors (~15)'][v],
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
      heading: `What it is`,
      paragraphs: [
        `t-SNE and UMAP are projection tools: they take high-dimensional embeddings (your 768-D word vectors from Embeddings & Similarity) and squeeze them into 2-D so your eye can see them. The magic lies not in the squashing itself — that is trivial — but in which 2-D arrangement they choose. Both algorithms preserve something precious: neighborhood structure. If kitten and cat are neighbors in 768-D, they stay neighbors in 2-D. This neighborhood preservation is what makes the projection readable: semantic clusters that scattered across 768 dimensions crystallize into visual islands on your screen. The cost of this readability is a harsh contract: almost everything else on the map is a lie, and this visualization will teach you the difference between what you can actually trust and the beautiful phantoms your brain will find.`,
        `t-SNE (t-Distributed Stochastic Neighbor Embedding) is the older, slower classic that made projections famous; UMAP (Uniform Manifold Approximation and Projection) arrived later with a faster algorithm, better global structure, and gentler knobs. Both show you the same fundamental truth — the neighborhood map of your embeddings — but at different speeds and with different tradeoffs in what else they preserve.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with your 768-D embeddings and an idea of "neighborhood": the perplexity parameter (t-SNE) or n_neighbors parameter (UMAP) sets roughly how many points count as neighbors. For each word, compute neighbor probabilities in the original space: "given that we sampled a point at random, how likely is it that random point would be this word's neighbor?" Now place all words randomly on a 2-D plane. The algorithm will judge the layout by a single criterion: do the same neighbor probabilities hold in 2-D? Measure the mismatch with KL divergence — the divergence tool from Entropy & Information that quantifies how different two probability distributions are.`,
        `The optimization is gradient descent: compute the mismatch, backpropagate, take steps to minimize it. Here is the critical design choice: t-SNE uses a heavy-tailed t-distribution for the 2-D neighbor probabilities, which means far-apart points still have some (small) attraction to each other. This repulsion prevents all points from collapsing into one blob and allows clusters to separate cleanly. Gradient descent iterates: points feel a strong pull toward their true high-D neighbors and a weaker but nonzero push from everyone else. Watch the animation in the first view — you will see islands emerge from chaos, unrelated clusters drift apart, and within a few hundred iterations the three semantic clusters (animals, food, code) crystallize into distinct regions.`,
        `UMAP uses a graph-based approach instead: build a neighbor graph in the original space (typically much faster), then optimize a similar loss in 2-D with fewer iterations. The result is 10 to 100 times faster than t-SNE while keeping neighborhoods intact, and the global layout often captures larger-scale structure better. The tradeoff is a parameter called n_neighbors (~15 by default) that controls the neighborhood size — tune it up for more global structure, down for more local detail.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `t-SNE's biggest weakness is speed. For N points, computing all pairwise neighbor probabilities is O(N²) in the naive case, though the Barnes-Hut approximation brings it down to O(N log N). Optimization itself requires hundreds or thousands of iterations; on 10,000 points you might wait minutes. Storage is O(N) for the 2-D coordinates plus O(N²) if you precompute distances, but most implementations stream and discard intermediate data. UMAP is the practical default: building the graph is O(N log N), optimization is O(N) per iteration, and wall-clock time on 100,000 points drops from an hour to minutes. The perplexity knob (t-SNE) typically lives in 5 to 50; the n_neighbors knob (UMAP) in 5 to 200. Both are compute-cheap to set; the real cost is thinking about what you are measuring (answered in the Pitfalls section below).`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every ML researcher's first projection is the gold standard diagnostic: train an embedding model, project with t-SNE or UMAP, look at the plot. If the training is working, semantic clusters appear. If your embeddings are broken — mislabeled data, corrupted features, overfit on noise — the projection will be a soup or scattered chaos instead of islands. This instant visual feedback has made projection the most valuable 30-second debugging tool in deep learning. Production systems use projection to audit embeddings: does a new word embedding model cluster language families correctly? Do two embedding training regimes produce visually similar structures? The projection is also how papers explain what their model learned: a beautiful t-SNE plot convinces readers the representation is sensible and interpretable. In industry, embedding retrieval systems (e-commerce product search, recommendation engines) use UMAP for interactive exploration — users can click on an embedding and see similar items cloud around it. The speed of UMAP makes this interactive experience feasible at scale.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The three classic lies are baked into the visualization and shown in the second view of the animation. Lie #1: cluster size on the map means something about cluster size in the data. False — t-SNE and UMAP equalize local density as they optimize, so a tight cluster in 768-D expands on the 2-D map, and a loose cluster shrinks. Area is an artifact of the algorithm, not a property of your data. Lie #2: the gaps between islands encode distance. False — once two neighborhoods are far enough apart that they do not interact, the repulsion treats all other clusters as "far away," and the actual on-screen gap is a random side effect of initialization and iteration count. A different random seed produces the same neighborhoods but a different galaxy map. Lie #3: islands in the projection are real clusters. Cruelly false — the algorithm will happily compress random noise into islands at low perplexity (see the third frame of the second view, which projects pure noise and draws phantom structure). This is the "Rorschach effect": humans are magicians at finding constellations in randomness.`,
        `The defense against these lies is procedural, not visual. Run multiple random seeds and multiple perplexity or n_neighbors settings; real structure persists across all of them, while phantom structure reshuffles. Then confirm any cluster with statistics computed in the original embedding space: verify that within-cluster cosine distances are small and between-cluster distances are large. Never trust a single map as truth; treat it as a hypothesis to be verified in the original space. The axes of the plot (labeled "t-SNE dim 1," etc.) are completely meaningless — they are the directions the optimizer happened to unfold the clusters along. Do not ever interpret the axes as features; they are numerical artifacts. The one promise the visualization keeps is neighborhoods: who is near whom. Everything else is decoration or danger.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Projection depends on embeddings: go back to Embeddings & Similarity to understand how cosine distance defines neighborhood in the first place, and to learn the tool for verifying clusters in the original space. K-Means Clustering uses similar neighborhood intuition to create discrete clusters (rather than looking at a map). When embeddings are too large to project, HNSW: Approximate Nearest Neighbors builds a graph structure to query neighborhoods at scale, without visualization. Entropy & Information is where KL divergence comes from — the loss function that shapes the projection. Finally, Gradient Descent is the optimizer under the hood, and understanding its mechanics will make the animation in the first view (attraction/repulsion pulling clusters into place) intuitive. For the deeper theory, read "How to Use t-SNE Effectively" by Wattenberg, Viégas, and Johnson on distill.pub (2016) — the canonical reference that grounds all three lies and explains every parameter.`,
      ],
    },
  ],
};

