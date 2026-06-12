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
      heading: 'What it is',
      paragraphs: [
        `RAG (Retrieval-Augmented Generation) solves a hard limit: LLMs have a training cutoff. Their knowledge is frozen. Ask them something that happened after training or something from your private company wiki, and they guess fluently instead of knowing. RAG trades the illusion of omniscience for honest lookup: embed the question, fetch relevant documents from a vector database, paste them into the prompt, and let the model answer grounded in real facts. No retraining, no fine-tuning—just real-time retrieval.`,
        `The core insight is deceptively simple: an LLM is a reasoning engine, not a memory engine. Give it the facts in context and it reasons clearly. Without them, it hallucinates. RAG externalizes memory entirely, making documents the source of truth and the model the reasoning layer. Systems like OpenAI's enterprise assistants, Pinecone's retrieval API, and pgvector on PostgreSQL are all implementations of this idea: different databases, different embedding choices, same contract.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The pipeline has four steps. First, embed: when a question arrives, encode it with the same embedding model used for your document corpus. Both live in a high-dimensional space (typically 768 to 3072 dimensions). Second, retrieve: a vector database like Pinecone or Weaviate runs approximate-nearest-neighbor (ANN) search using indexes like HNSW or LSH to find the top-k most similar documents without scanning billions. At scale, naive brute-force nearest-neighbor lookup is hopeless; HNSW (Hierarchical Navigable Small World) can find the top 10 matches across 10 million 1536-dimensional vectors in milliseconds.`,
        `Third, augment: stuff the retrieved chunks (typically 200–1000 tokens each) into the prompt ahead of the question. The model now has facts in its context window. Because of KV caching, prefilling that context is not free, but it is cheap. Fourth, generate: the LLM uses attention to read both question and documents together, producing a grounded answer. Citations come for free because you logged which chunks were retrieved. This pipeline is a race: better retrieval wins; if your top-3 documents do not contain the signal, no generation step recovers it.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Embedding time: small models (384 dims) cost < 1ms per query; large ones (3072 dims) cost 10–50ms. Retrieval via HNSW is fast (5–20ms); linear scan across millions kills latency. Storage: one vector per chunk (1536 floats ≈ 12 KB); a million documents fit in 12 GB. End-to-end latency is dominated by LLM generation (1–5s), not lookup. The real complexity: garbage in, garbage out. Bad chunking—breaking facts or bundling too much—breaks retrieval even with perfect indexes.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Enterprise support: support reps ask questions like "how do we handle refunds?" and get answers from runbooks with citations. News chatbots inject today's articles, staying current without retraining. Medical and legal domains rely on RAG because hallucinating medical or legal citations is malpractice. Pinecone, pgvector on Postgres, and systems at Notion and Stripe all run this pattern. Knowledge updates instantly: add a document, embed and index it—done.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Myth: RAG makes a dumb model smart. Reality: it makes a smart model reliable. Bad documents produce bad answers faster. Myth: more chunks is better. Reality: top-3 quality beats top-20 noise. Chunking is hard—split too small and you lose context, too large and you retrieve bloat. Typical size: 256–512 tokens. Embedding mismatch: if the model was trained on finance but your documents are medical, retrieval fails. Retrieval quality bottlenecks everything. Citation hallucination: the model might cite-retrieved-but-unused chunks. Fix: ask it to justify claims with exact phrases from the text.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To build RAG systems, start with Embeddings & Similarity—understand the vector space where retrieval lives. Read about Attention Mechanism to see why LLMs can reason over long context; KV Cache explains why prefilling retrieved documents is efficient. Tokenization (BPE) determines your chunk boundaries and embedding costs. For indexing millions of documents, learn K-Means Clustering, which powers some ANN techniques. At the application level, understand the full generation pipeline and how to design prompts that actually use retrieved facts instead of ignoring them.`,
      ],
    },
  ],
};
