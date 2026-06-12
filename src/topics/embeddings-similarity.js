// Embeddings: meaning as geometry. Words become points; similar meanings
// sit close together; "find similar" becomes "find nearest" — the idea
// behind vector databases, semantic search, and RAG.

import { scatterState, InputError } from '../core/state.js';

export const topic = {
  id: 'embeddings-similarity',
  title: 'Embeddings & Similarity',
  category: 'AI & ML',
  summary: 'Meaning as geometry: similar words sit close together, and search becomes "find my neighbors".',
  controls: [
    { id: 'query', label: 'Find words similar to', type: 'select', options: ['cat', 'pizza', 'truck'], defaultValue: 'cat' },
  ],
  run,
};

// A hand-made 2D embedding space. Real embeddings have hundreds or
// thousands of dimensions and are LEARNED — but distance works the same.
const WORDS = [
  { label: 'cat', x: 2.0, y: 7.5 }, { label: 'dog', x: 2.8, y: 8.1 },
  { label: 'kitten', x: 1.4, y: 7.0 }, { label: 'horse', x: 3.6, y: 7.0 },
  { label: 'pizza', x: 7.6, y: 7.8 }, { label: 'burger', x: 8.4, y: 7.2 },
  { label: 'sushi', x: 7.0, y: 8.4 }, { label: 'taco', x: 8.2, y: 8.3 },
  { label: 'truck', x: 5.0, y: 1.6 }, { label: 'car', x: 4.2, y: 2.2 },
  { label: 'bicycle', x: 5.8, y: 2.4 }, { label: 'bus', x: 4.6, y: 1.0 },
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function* run(input) {
  const queryWord = String(input.query);
  const queryPoint = WORDS.find((w) => w.label === queryWord);
  if (!queryPoint) throw new InputError('Pick one of the listed words.');

  const points = WORDS.map((w, i) => ({ id: `e${i}`, ...w }));
  const queryId = points.find((p) => p.label === queryWord).id;
  const snapshot = () => scatterState({
    points,
    axes: { x: { label: 'dimension 1 (of 2 here; thousands in real models)' }, y: { label: 'dimension 2' } },
  });

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'An EMBEDDING turns a word (or sentence, or image) into a list of numbers — a point in space. The magic is in how the points are arranged: models learn to place similar meanings close together. Look: animals cluster top-left, foods top-right, vehicles at the bottom. Nobody labeled these groups — they emerge from how words are used.',
  };

  yield {
    state: snapshot(),
    highlight: { active: [queryId] },
    explanation: `Query: "find things similar to ${queryWord}". With embeddings this stops being a language problem and becomes GEOMETRY: just measure the distance from "${queryWord}" to every other point. (Real systems use cosine similarity — the angle between vectors — but the idea is identical: closer = more similar.)`,
  };

  const ranked = points
    .filter((p) => p.id !== queryId)
    .map((p) => ({ ...p, d: dist(p, queryPoint) }))
    .sort((a, b) => a.d - b.d);

  for (let i = 0; i < 3; i += 1) {
    const hit = ranked[i];
    yield {
      state: snapshot(),
      highlight: { active: [queryId], compare: [hit.id], found: ranked.slice(0, i).map((r) => r.id) },
      explanation: `Nearest neighbor #${i + 1}: "${hit.label}" at distance ${hit.d.toFixed(2)}. ${i === 0 ? 'No dictionary, no synonym list — proximity in the learned space IS similarity.' : ''}`,
      invariant: 'Distance in embedding space ≈ difference in meaning.',
    };
  }

  const farthest = ranked[ranked.length - 1];
  yield {
    state: snapshot(),
    highlight: { active: [queryId], found: ranked.slice(0, 3).map((r) => r.id), visited: [farthest.id] },
    explanation: `Top 3 for "${queryWord}": ${ranked.slice(0, 3).map((r) => `"${r.label}"`).join(', ')} — while "${farthest.label}" sits far away (${farthest.d.toFixed(2)}). This exact loop, scaled to millions of points and thousands of dimensions, is a VECTOR DATABASE. It's how semantic search finds documents "about" your question, and the R in RAG: embed the question, fetch the nearest chunks, hand them to the LLM. Meaning became geometry, so search became math.`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `An embedding maps a discrete or messy object into a dense vector whose geometry is useful. The object might be a token, sentence, product, image, user, or document. Similar things should land near each other under a metric such as cosine similarity or dot product. The space is not necessarily "lower-dimensional" than the raw object; it is a learned coordinate system where distance can stand in for semantic or behavioral relatedness.`,
        `The modern story begins with word2vec (Mikolov et al., 2013): train vectors so words that appear in similar contexts get similar coordinates, and analogies such as king - man + woman roughly point toward queen. Tokenization (BPE) decides the units, Neural Network Forward Pass computes representations, and Gradient Descent moves vectors until the training objective improves. Once trained, meaning becomes searchable geometry.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `There are several training routes. Skip-gram predicts nearby words. Matrix factorization methods such as GloVe compress co-occurrence statistics. Contrastive systems such as CLIP pull matching text-image pairs together and push mismatches apart. Transformer encoders use Attention Mechanism to make contextual embeddings, where "bank" near "river" differs from "bank" near "loan." Sentence embedding models then pool token states into one vector for the whole passage.`,
        `Similarity is usually cosine: normalize vectors, then compare angles. Dot product is common when magnitude is meaningful or already normalized. Euclidean distance can work, but high-dimensional spaces make raw distance less intuitive. The Embedding Space, in 3D visualizes a tiny version; real systems use hundreds to thousands of dimensions and cannot be inspected axis by axis.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Storage is O(Nd): N items times d dimensions. One million 1,536-dimensional float32 vectors need about 6.1 GB before index overhead; float16 cuts that in half. Naive search is O(Nd) per query, which is fine for thousands of vectors and painful for millions. HNSW (Vector Search at Scale), IVF, and product quantization trade exactness for speed and memory, often returning high-recall neighbors in milliseconds. SVD & Low-Rank Approximation and related compression ideas appear when you need smaller vectors or faster indexes.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Embeddings power semantic search, recommendations, duplicate detection, anomaly detection, clustering, and retrieval-augmented generation. A support bot embeds a user question, retrieves nearby policy chunks, and sends those chunks to an LLM. A music app embeds users and songs into compatible spaces. A fraud system embeds transactions and flags points far from normal clusters. CLIP-style multimodal embeddings put image and text in one space, enabling "find images like this caption."`,
        `Vector databases such as FAISS, Milvus, Pinecone, and Weaviate are built around storing vectors plus metadata filters. The hard production problem is not "compute one cosine." It is freshness, filtering, deduplication, index rebuilds, recall measurement, and preventing semantically plausible but factually wrong neighbors from poisoning downstream answers.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Embedding distance is not truth. It reflects the model, data, pooling method, and metric. A legal contract and a blog post can look close if they share boilerplate; two short texts can look far because one uses rare wording. Domain shift matters: a model trained on web text may embed medical abbreviations badly. Bias also matters, because social regularities in training data become geometric regularities in the space.`,
        `Do not over-read dimensions. Individual coordinates usually lack stable human meaning. Dimensionality reduction plots such as t-SNE & UMAP: Seeing Embeddings are useful maps, not the territory. A pretty cluster in 2D can be an artifact of the projection. Always evaluate retrieval with labeled queries and failure cases.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with Tokenization (BPE), then follow vectors through Neural Network Forward Pass and Gradient Descent. Attention Mechanism explains contextual embeddings. The Embedding Space, in 3D builds geometric intuition; t-SNE & UMAP: Seeing Embeddings shows how high-dimensional spaces get visualized; SVD & Low-Rank Approximation gives the matrix-compression ancestor; HNSW (Vector Search at Scale) explains how million-vector search becomes fast enough for real products.`,
      ],
    }
  ]
};
