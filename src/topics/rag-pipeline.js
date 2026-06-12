// Retrieval-Augmented Generation: don't make the model remember everything —
// let it look things up. Embed the question, fetch the nearest documents,
// stuff them into the prompt, generate a grounded answer.

import { scatterState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'rag-pipeline',
  title: 'RAG Pipeline',
  category: 'AI & ML',
  summary: 'The full retrieval-augmented loop: embed the question, find nearby documents, ground the answer.',
  controls: [
    { id: 'question', label: 'Ask', type: 'select', options: ['what do cats eat?', 'how much light do plants need?', 'what is a transformer?'], defaultValue: 'what do cats eat?' },
  ],
  run,
};

// A tiny document store, already embedded into 2D (real systems: ~1000 dims).
const DOCS = [
  { id: 'd0', label: 'cat diets', x: 2.0, y: 7.5, text: 'Cats are obligate carnivores; they need meat protein.' },
  { id: 'd1', label: 'cat naps', x: 2.7, y: 8.2, text: 'Cats sleep 12 to 16 hours a day.' },
  { id: 'd2', label: 'dog training', x: 1.3, y: 6.6, text: 'Dogs respond best to reward-based training.' },
  { id: 'd3', label: 'plant light', x: 7.5, y: 7.9, text: 'Most houseplants need 6 hours of indirect light.' },
  { id: 'd4', label: 'watering', x: 6.8, y: 8.5, text: 'Overwatering kills more plants than drought.' },
  { id: 'd5', label: 'soil tips', x: 8.3, y: 7.1, text: 'Well-draining soil prevents root rot.' },
  { id: 'd6', label: 'transformers', x: 4.9, y: 1.8, text: 'Transformers process all tokens in parallel with attention.' },
  { id: 'd7', label: 'attention', x: 5.7, y: 2.5, text: 'Attention lets each token weigh every other token.' },
  { id: 'd8', label: 'gpu guide', x: 4.1, y: 2.7, text: 'Training large models requires many GPUs.' },
];

const QUERIES = {
  'what do cats eat?': { x: 2.2, y: 7.3, answer: 'Cats are obligate carnivores — their diet must be meat-based protein [cat diets].' },
  'how much light do plants need?': { x: 7.4, y: 7.7, answer: 'Most houseplants need about 6 hours of indirect light a day [plant light].' },
  'what is a transformer?': { x: 5.1, y: 2.1, answer: 'A transformer is an architecture that processes all tokens in parallel, using attention to let each token weigh every other [transformers; attention].' },
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function* run(input) {
  const question = String(input.question);
  const query = QUERIES[question];
  if (!query) throw new InputError('Pick one of the listed questions.');

  const axes = { x: { label: 'embedding dim 1' }, y: { label: 'embedding dim 2' } };
  const docPoints = DOCS.map((d) => ({ id: d.id, label: d.label, x: d.x, y: d.y }));

  yield {
    state: scatterState({ points: docPoints, axes }),
    highlight: {},
    explanation: 'An LLM\'s knowledge is frozen at training time, and when it doesn\'t know something it tends to guess fluently — hallucination. RAG (Retrieval-Augmented Generation) fixes both at once: keep your documents OUTSIDE the model, look up the relevant ones per question, and hand them to the model as context. Here is our document store, already embedded — notice pets, plants, and ML form natural neighborhoods (see Embeddings & Similarity).',
  };

  const qPoint = { id: 'query', label: '? ' + question.replace('?', ''), x: query.x, y: query.y };
  yield {
    state: scatterState({ points: [...docPoints, qPoint], axes }),
    highlight: { active: ['query'] },
    explanation: `Step 1 — EMBED the question "${question}" with the same embedding model used for the documents. It lands as a point in the same space — right in the neighborhood of documents that mean similar things, even if they share no exact keywords.`,
  };

  const ranked = DOCS.map((d) => ({ ...d, d: dist(d, query) })).sort((a, b) => a.d - b.d);
  const top = ranked.slice(0, 3);
  yield {
    state: scatterState({ points: [...docPoints, qPoint], axes }),
    highlight: { active: ['query'], found: top.map((t) => t.id), visited: ranked.slice(3).map((r) => r.id) },
    explanation: `Step 2 — RETRIEVE: a vector database finds the nearest neighbors (top 3 here: ${top.map((t) => `"${t.label}"`).join(', ')}). At millions of documents this uses approximate-nearest-neighbor indexes rather than checking every point — but the idea is exactly this picture.`,
    invariant: 'Retrieval quality bounds answer quality: the model can only be as grounded as what was fetched.',
  };

  const contextRows = [...top.map((t) => `[${t.label}]`), '? question'];
  yield {
    state: arrayState(contextRows),
    highlight: { active: contextRows.map((_, i) => `i${i}`).slice(0, 3), found: [`i${contextRows.length - 1}`] },
    explanation: `Step 3 — AUGMENT: the retrieved chunks are pasted into the prompt, ahead of the question: "Answer using these documents: ${top.map((t) => t.text).join(' ')} Question: ${question}". The model doesn't need to remember anything — the facts are sitting in its context window (and the KV Cache prefills them once).`,
  };

  yield {
    state: arrayState(contextRows),
    highlight: { sorted: contextRows.map((_, i) => `i${i}`) },
    explanation: `Step 4 — GENERATE: attention reads the question AND the retrieved text together, so the answer comes out grounded: "${query.answer}" — with citations possible for free, because we know exactly which chunks were retrieved.`,
  };

  yield {
    state: scatterState({ points: [...docPoints, qPoint], axes }),
    highlight: { active: ['query'], found: top.map((t) => t.id) },
    explanation: 'That is the entire pipeline: embed → retrieve → augment → generate. It is how enterprise AI assistants answer from private wikis, how chatbots cite sources, and how models stay current without retraining. Its failure mode is just as instructive: ask about plants and retrieve cat documents, and the model will confidently answer from the wrong facts — in RAG, retrieval IS the product. Update the documents and the "knowledge" updates instantly; no Gradient Descent required.',
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A RAG system, short for retrieval-augmented generation, gives a language model a searchable memory. Instead of hoping the model memorized the right fact during pretraining, the system retrieves relevant documents at question time and places them in the prompt. Lewis et al. named the pattern in the 2020 RAG paper, building on dense retrieval work such as DPR. The contract is simple: documents remain the source of truth; the model becomes the reader and writer.`,
        `The pattern is especially useful when facts are private, fresh, or too numerous to fit in model weights: company policies, product catalogs, legal memos, support tickets, research notes, and codebases. It is not fine-tuning. Fine-tuning changes behavior; retrieval changes context. A good answer depends on both retrieval quality and the model's ability to use the retrieved evidence.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Offline, documents are cleaned, split into chunks, embedded, and stored with metadata. Chunk sizes commonly land between 200 and 800 tokens, but tables, code, and legal sections often need structure-aware splitting. At query time, the question is embedded with the same model, Embeddings & Similarity scores candidate chunks, and HNSW (Vector Search at Scale) or another ANN index returns the top matches. A reranker may then rescore the top 50 or 100 candidates before the final prompt is built.`,
        `The prompt usually contains the user question, retrieved passages, source IDs, and instructions to cite only supported claims. Attention Mechanism lets the model compare the question against the evidence token by token. KV Cache makes repeated prefill cheaper during generation, but long contexts still cost money and latency. The hard part is not wiring APIs together; it is making sure the right evidence reaches the context window.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Index storage is roughly vectors plus text. One million 1,536-dimensional float32 vectors require about 6.1 GB before graph or metadata overhead; float16 cuts vectors to about 3.1 GB. Retrieval can be 5 to 50 ms with a warm ANN index, while reranking and generation often dominate latency. Ingest is O(number of chunks) embedding calls plus index construction. The expensive operational work is refresh: deleting stale chunks, preserving citations, rebuilding or incrementally updating indexes, and evaluating whether retrieval actually improved answer quality.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `RAG powers enterprise assistants over Confluence, Google Drive, Slack, GitHub, Zendesk, and internal databases. Legal and medical products use it to ground answers in source documents. Search systems use it to synthesize over retrieved web pages. Developer tools use it to answer questions over repositories. Common stacks include pgvector, Pinecone, Weaviate, Milvus, Elasticsearch vector search, LanceDB, and FAISS. K-Means Clustering appears in some vector indexes and compression schemes, while graph-based HNSW dominates many low-latency deployments.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest myth is that RAG prevents hallucination by itself. It only supplies evidence; the generator can still ignore it, overgeneralize it, or cite chunks it did not truly use. Another mistake is retrieving too much. Top-20 noisy chunks can bury the one useful passage, especially when the answer needs an exact policy sentence. Chunking also fails quietly: split too small and definitions separate from conditions; split too large and retrieval returns bloated context.`,
        `Evaluation must test the whole pipeline. Measure retrieval recall, citation faithfulness, answer correctness, and latency separately. Tokenization (BPE) matters because chunk size and context budget are token budgets, not word counts. Cross-Validation & Honest Evaluation is the right discipline: build a held-out question set and resist tuning on examples you report.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Start with Embeddings & Similarity, then HNSW (Vector Search at Scale) for retrieval at scale. Tokenization (BPE) explains chunk budgets, Attention Mechanism explains evidence reading, and KV Cache explains context serving cost. K-Means Clustering gives another indexing intuition, especially for partitioning large vector collections before exact or approximate search.`,
      ],
    },
  ],
};