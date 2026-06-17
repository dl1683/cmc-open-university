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
      explanation: `Nearest neighbor #${i + 1}: "${hit.label}" at distance ${hit.d.toFixed(2)}. ${i === 0 ? 'No dictionary or synonym list is being consulted; proximity in the learned space is the similarity signal.' : 'The next closest point is still semantically related, but the larger distance shows a weaker match.'}`,
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
      heading: 'The problem',
      paragraphs: [
        `Computers need a usable representation before they can compare messy objects. A word, sentence, image, song, product, source file, user profile, or support ticket is not naturally a point on a ruler. Exact string matching can say whether two strings are identical, but it cannot say that "kitten" is closer to "cat" than to "truck." Keyword search can count shared tokens, but it misses paraphrase, synonyms, and visual or behavioral similarity.`,
        `Embeddings solve that representation problem by mapping each item to a vector: an ordered list of numbers. The important promise is geometric. Items that should behave similarly for the task should land near each other under a chosen metric. The vector does not have to be human-readable coordinate by coordinate. It has to be useful when compared, clustered, indexed, averaged, or passed into another model.`,
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        `The naive approach is to compare surface features. For text, you might lowercase words, remove punctuation, count tokens, and rank documents by overlap. For products, you might match category labels and tags. For images, you might compare filenames, captions, or hand-written features such as color histograms. These methods can be useful baselines because they are cheap, inspectable, and easy to debug.`,
        `The wall appears when the surface representation is not the meaning. "Car" and "automobile" may share no letters. "How do I reset my password?" and "I cannot sign in" may require the same answer while using different words. A picture of a red sneaker and the caption "running shoe" are not even in the same raw format. Hand-built feature lists also become brittle: every domain shift, new slang term, product category, or language variant requires manual repair.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is distributional: objects that appear in similar contexts, receive similar feedback, or match similar paired examples can be placed near each other. word2vec trained word vectors by predicting nearby words. GloVe factorized global word co-occurrence statistics. Contrastive systems such as CLIP trained an image encoder and text encoder so a real image-caption pair receives a high score while mismatched pairs are pushed apart.`,
        `Transformer encoders add context. The token "bank" near "river" should not have exactly the same representation as "bank" near "loan." A sentence embedding model pools contextual token states into one vector for a phrase, paragraph, or document chunk. The result is not a dictionary definition. It is a coordinate system learned from training objectives, data distribution, and model architecture.`,
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        `A retrieval system usually has two phases. Offline or at ingestion time, it embeds every item and stores the vector with metadata. At query time, it embeds the query in the same vector space, computes similarity to stored vectors, and returns the nearest candidates. A vector database adds filtering, batching, index maintenance, deletion handling, monitoring, and recall measurement around this basic loop.`,
        `The metric matters. Cosine similarity compares direction after normalization, which is common for text embeddings because the angle often captures semantic match better than raw length. Dot product is common when vectors are already normalized or when magnitude carries useful confidence. Euclidean distance can work, especially in small toy spaces, but high-dimensional geometry makes raw distance less intuitive. Whatever metric is used for search should match how the model was trained or calibrated.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `The animation uses a hand-built two-dimensional space so the idea is visible. Animals occupy one region, foods another, and vehicles another. If the selected query is "cat," the system measures from the cat point to every other point. "Kitten" and "dog" are nearby because their coordinates are close. "Pizza" and "bus" sit farther away because they live in different neighborhoods of the space.`,
        `A real embedding has hundreds or thousands of dimensions, so you cannot inspect it axis by axis. The same ranking idea still applies. The model turns the query into a vector, the index finds nearby vectors, and the application interprets those neighbors as candidates for semantic match. The small picture is a map; the production version is the same geometry at much larger scale and with approximate indexes.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Embeddings work when the training signal captures the relationship the application needs. In language, words and passages used in similar contexts often have related meanings. In recommendations, users who click or buy similar items often share latent preferences. In multimodal training, captions and images that appear together teach a shared space across formats. The vector is useful because many weak statistical signals are compressed into a representation that supports comparison.`,
        `The method also works because nearest-neighbor search changes an open-ended reasoning problem into a constrained candidate-generation problem. A system does not need to understand every possible document in full at query time. It needs to retrieve a small set of plausible neighbors, then rerank, filter, cite, answer, or cluster them. This is why embeddings sit underneath semantic search, retrieval-augmented generation, duplicate detection, and recommendation pipelines.`,
      ],
    },
    {
      heading: 'Costs',
      paragraphs: [
        `Storage is O(Nd): N items times d dimensions. One million 1,536-dimensional float32 vectors require about 6.1 GB before index overhead; float16 halves the raw vector storage. Naive exact search is O(Nd) per query, which is fine for thousands of vectors and painful for millions. Batch embedding also costs money and latency, especially when documents must be chunked, deduplicated, and re-embedded after every content change.`,
        `Production systems use approximate nearest-neighbor indexes such as HNSW, IVF, product quantization, or ScaNN-style partitioning and compression. These trade exactness for speed and memory. The engineering question is not simply whether a neighbor exists. It is whether recall is high enough, latency is stable enough, metadata filters are honored, stale vectors are removed, and index rebuilds do not break the product during updates.`,
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        `Dense embeddings are powerful, but sparse lexical methods still matter. A rare product code, legal citation, error string, or exact name may be more important than broad semantic match. Hybrid search combines vector similarity with keyword scoring so exact terms do not disappear. Rerankers can then inspect the top candidates more carefully, often using a cross-encoder or language model that sees the query and candidate together.`,
        `Chunking is another major tradeoff. Small chunks improve pinpoint retrieval but can lose context. Large chunks preserve context but may bury the relevant sentence inside unrelated text. Metadata filters help with permissions, tenant boundaries, dates, languages, and product categories, but filters also change recall. Good embedding systems are evaluated with real queries, labeled relevance, negative examples, and adversarial cases rather than only with pretty clusters.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Embeddings win when similarity is fuzzy, cross-lingual, multimodal, behavioral, or too expensive to encode by hand. A support bot can find policy chunks that answer a paraphrased question. A marketplace can recommend visually similar products. A code assistant can retrieve examples that solve the same programming task under different names. A fraud system can embed transactions and look for points that fall outside normal neighborhoods.`,
        `They are also useful as intermediate features. Clustering can reveal topic families. Dimensionality reduction can visualize a corpus. Anomaly detection can find isolated points. Retrieval-augmented generation can ground an answer in nearby documents. In each case, the embedding is not the final decision by itself; it is a compact representation that makes the next decision cheaper and better informed.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Embedding distance is not truth. It reflects the model, data, pooling method, task objective, and metric. A legal contract and a blog post can appear close if both contain boilerplate. Two short texts can appear far apart because one uses rare wording. Domain shift can break assumptions: a model trained mostly on general web text may mishandle medical abbreviations, internal acronyms, or fresh product names.`,
        `Bias and leakage also become geometry. If training data contains social stereotypes, spurious correlations, or duplicated benchmark examples, the space can preserve those patterns. Dimensionality-reduction plots such as t-SNE or UMAP are useful for exploration but can invent visual separation that is not present in the original space. Treat every retrieval result as evidence to inspect, not as a proof that the neighbor is correct.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Tokenization (BPE) to understand the units that enter text models. Neural Network Forward Pass and Gradient Descent explain how representations are computed and trained. Attention Mechanism explains contextual embeddings. The Embedding Space, in 3D builds geometric intuition, while t-SNE & UMAP: Seeing Embeddings explains projection artifacts. SVD & Low-Rank Approximation gives a matrix-compression ancestor of representation learning.`,
        `For retrieval systems, study HNSW (Vector Search at Scale), ScaNN Vector Search Case Study, and Vector Database Metadata Filtering. For model behavior, study Contrastive Learning, CLIP, Sparse Autoencoder Feature Dictionary Case Study, and Data Leakage & Contamination. Primary starting points include word2vec at https://arxiv.org/abs/1301.3781, GloVe at https://aclanthology.org/D14-1162/, CLIP at https://arxiv.org/abs/2103.00020, and FAISS at https://faiss.ai/index.html.`,
      ],
    },
  ]
};
