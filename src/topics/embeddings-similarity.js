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
      heading: 'What it is',
      paragraphs: [
        `An embedding is a mapping from high-dimensional objects (words, documents, images) to points in a lower-dimensional vector space where geometry encodes meaning: things that are semantically similar sit close together. For example, embeddings of "cat" and "dog" are much closer to each other than "cat" and "truck" because cats and dogs are more similar (animals) than cats and trucks. The embedding space is usually learned: a neural network is trained to map words to vectors such that related words are nearby in the space, and unrelated ones are far. Once embeddings are learned, similarity becomes a geometric problem — measure distance between vectors — rather than a linguistic or logical one.`,
        `The core insight is that meaning can be represented as geometry. Instead of storing dictionaries or synonym lists, you train a model to arrange meanings in a high-dimensional space. This scales to millions of concepts and enables operations that are impossible in symbolic systems: queen minus woman plus man is approximately king (the famous word2vec analogy). This geometric representation is the foundation of modern semantic search, retrieval-augmented generation (RAG), and vector databases.`
      ]
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Embeddings are learned through neural networks, typically by predicting one word from nearby words (the Skip-gram model), or by forcing different corruptions of the same text to have similar embeddings (contrastive learning, used in models like CLIP). The loss function encourages semantically similar pairs to have small distance (cosine similarity or Euclidean distance) and dissimilar pairs to have large distance. After training, the embedding layer (usually the hidden state of the neural network) is saved, and inference becomes simple: look up a word, get its embedding vector, measure distances to other vectors.`,
        `In practice, embeddings for sentences or documents are computed by averaging or pooling the embeddings of their constituent words or tokens, or by using a larger model (like BERT or sentence transformers) that directly produces document embeddings. The dimensionality ranges from 50 (small, fast models) to 3000 and up (large, more expressive models). Most commonly, models like OpenAI's text-embedding-3 use 1536-dimensional embeddings. Once embeddings are stored in a vector database (Pinecone, Weaviate, or even a simple in-memory index), querying is fast: embed the query, find nearby vectors, return those results.`
      ]
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Computing the embedding for a single text is O(d squared) where d is the embedding dimension (one forward pass through the encoder network, dominated by matrix multiplications). Storing embeddings requires O(n times d) space for n texts. Querying (finding the top-k nearest neighbors) is O(n times d) with naive search (compute distance to all vectors), or O(log n times d) with approximate methods like LSH or HNSW (hierarchical navigable small world). Modern vector databases like Pinecone or Weaviate use HNSW or similar for sub-second queries on millions of vectors. The embedding model itself (like text-embedding-3-large) runs on GPU servers; inference latency is typically 10-100ms per text.`
      ]
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Embeddings power semantic search everywhere: Google uses them for search ranking; every modern search engine ranks results partly by embedding similarity. Retrieval-augmented generation (RAG) uses embeddings to fetch relevant documents for an LLM to read and reason over — vital for answering questions over proprietary data. Recommendation systems use embeddings to find similar users or items. Duplicate detection: compute embeddings, find near-duplicates by distance. Clustering and anomaly detection use embeddings to group similar items or spot outliers.`,
        `Vector databases like Pinecone, Weaviate, and Milvus are built entirely on embedding search. Multimodal models (CLIP) embed both text and images into the same space, enabling cross-modal search (search images with text, or vice versa). Embeddings have become the lingua franca of ML: any modern system that does similarity, search, or clustering starts by embedding everything into the same vector space.`
      ]
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A major misconception: embedding distance is a perfect proxy for semantic similarity. It is not. Embeddings are trained on specific objectives (predicting nearby words, contrastive pairs, etc.) and generalize imperfectly to other domains. For instance, two documents might be close in embedding space but unrelated in meaning if they share common words. Different embedding models (word2vec, GloVe, BERT, OpenAI's API) disagree on distances; none is universally correct.`,
        `Another pitfall: assuming high-dimensional distance is intuitive. It is not. In high dimensions, distances concentrate: most points are roughly equidistant from any given point (the curse of dimensionality). This means embedding space is highly compressed; two close vectors may still represent quite different meanings. Using cosine similarity (angle between vectors) instead of Euclidean distance helps because it is scale-invariant.`,
        `Finally, embeddings are not human-interpretable. A vector of 1536 dimensions does not offer human intuition about what it means. We can visualize 2D embeddings in demos, but real embeddings live in spaces where individual dimensions have no clear semantic meaning.`
      ]
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Understand how embeddings are learned by studying Gradient Descent — neural networks that produce embeddings are trained the same way all models are trained. Study Tokenization (BPE) to understand how text is converted to tokens before embedding. Explore Attention Mechanism to see how transformers (like BERT) produce contextualized embeddings (the same word can have different embeddings depending on context). For practical work, research vector databases (Pinecone, Weaviate, Milvus) and RAG systems. Dive into contrastive learning (SimCLR, CLIP) to understand how embeddings can be trained without labels. When you are ready, implement nearest-neighbor search using HNSW or locality-sensitive hashing to speed up vector queries on large datasets.`
      ]
    }
  ]
};
