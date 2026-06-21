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
    explanation: 'Model knowledge is frozen at training time, and when the model does not know something it tends to guess fluently — hallucination. RAG (Retrieval-Augmented Generation) fixes both at once: keep your documents OUTSIDE the model, look up the relevant ones per question, and hand them to the model as context. Here is our document store, already embedded — notice pets, plants, and ML form natural neighborhoods (see Embeddings & Similarity).',
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
      heading: 'How to read the animation',
      paragraphs: [
        { type: "callout", text: "RAG is a retrieval contract before it is a generation trick: the answer can be grounded only if the pipeline first chooses the right evidence." },
        "The scatter plot is an embedding space. Each dot is a document chunk whose position encodes its meaning — documents about similar topics land near each other. The clusters you see (pets, plants, ML) form because the embedding model maps semantically related text to nearby vectors.",
        "When a question appears (active marker), watch where it lands. Its position is computed by the same embedding model, so it falls near documents that share its meaning. The found markers are the top-k nearest neighbors — the chunks the system judges most relevant. Visited markers are the remaining documents, passed over because they are too far in embedding space.",
        "The view then switches to the prompt assembly: retrieved chunks stacked above the question. This is the context window the language model will read. The generation step treats these chunks as ground truth, producing an answer that cites them. If the wrong chunks were retrieved, the model would generate a confident answer from the wrong facts — that failure mode is the core design tension in every RAG system.",
      
        {type: 'image', src: './assets/gifs/rag-pipeline.gif', alt: 'Animated walkthrough of the rag pipeline visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        { type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg", alt: "Layered neural network diagram with colored nodes", caption: "The generator is still a neural model, but RAG moves changing facts into external context instead of model weights. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0." },
        "A language model can write fluently without knowing the current, private, or exact facts a user needs. A company handbook, support queue, product catalog, codebase, or legal repository changes faster than model pretraining. Retrieval-augmented generation exists to keep those facts outside the model and bring the right ones into the prompt at answer time.",
        "The contract is simple but demanding: documents remain the source of truth, retrieval chooses evidence, and the model reads that evidence to produce the answer. RAG is not fine-tuning. Fine-tuning changes behavior and style; retrieval changes context. A good system needs both strong retrieval and a model that obeys the retrieved evidence.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The naive approach is to paste a large pile of documents into the prompt. That works for toy examples, but it burns tokens, raises latency, and hides the relevant paragraph among noise. The model may answer from the wrong passage simply because the context is crowded.",
        "Another naive approach is to fine-tune the model on the documents. That can teach tone or domain vocabulary, but it is a poor fit for fast-changing facts. Every document update becomes a training problem, and the model still cannot cite the exact source unless the system keeps provenance separately.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is evidence selection. Most RAG failures are retrieval failures first: the answer passage was not indexed, was chunked badly, was filtered out by metadata, was ranked too low, or was buried below irrelevant matches. A perfect generator cannot quote a paragraph that never reached the context window.",
        "The second wall is faithfulness. Supplying evidence does not force the model to use it. The model can overgeneralize, combine incompatible chunks, cite a chunk that merely sounds related, or answer from prior knowledge when the retrieved documents disagree. A RAG system needs controls around both retrieval and generation.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Turn the corpus into an index that can answer a narrower question than generation: which passages should the model read right now? Embeddings, lexical search, metadata filters, rerankers, and context packing all serve that selection step.",
        "This makes RAG a data system as much as an AI feature. The user sees one answer, but the system has already made decisions about ingestion, chunk boundaries, vector representation, index refresh, filtering, ranking, deduplication, source attribution, and prompt assembly.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "The animation shows the basic loop: embed the question, retrieve nearby document chunks, place evidence in the prompt, and generate an answer. The important thing to watch is not just which dot is nearest. It is whether the retrieved evidence actually contains the answer the user asked for.",
        "When the question changes from cats to plants to transformers, the retrieval set should change. If the nearest chunks are off-topic, the model is being asked to write from the wrong facts. In RAG, retrieval quality is not a preprocessing detail; it is the product surface.",
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        { type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg", alt: "Directed graph with nodes connected by arrows", caption: "A production RAG system is a directed data flow: ingest, chunk, embed, retrieve, rerank, pack context, generate, and verify. Source: Wikimedia Commons, David W., public domain." },
        "Offline, documents are cleaned, split into chunks, embedded, and stored with metadata. Chunk sizes often land between 200 and 800 tokens, but tables, code, legal sections, and API references need structure-aware splitting. The system should preserve source IDs, section headings, timestamps, permissions, and canonical URLs because those fields become retrieval filters and citations later.",
        "At query time, the question is normalized and embedded with a compatible model. A vector index such as HNSW, FAISS, ScaNN, Milvus, pgvector, Elasticsearch vector search, or another ANN backend returns candidates. Many systems combine vector retrieval with BM25 or keyword search because exact names, error codes, and policy numbers are often lexical.",
        "A reranker may rescore the top candidates before context is built. Then the prompt contains the user question, selected passages, source IDs, and instructions about grounded answers. The model generates from that context, ideally citing the source spans that support each material claim.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "A support assistant gets the question: `Can enterprise customers export audit logs for the last year?` The retriever should find the audit-log retention policy, the enterprise-plan feature matrix, and perhaps the export API reference. It should not fill the prompt with generic security marketing pages just because they mention audit logs.",
        "The final answer should say what the policy allows, name the plan boundary, mention any export limits, and cite the exact documents. If the relevant policy changed yesterday, the correct answer depends on index freshness. If the chunk split separated the retention period from the export instructions, retrieval may find only half of the answer.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "RAG works when the retrieval step has higher recall for the needed evidence than the model's parametric memory, and when the context window is clean enough for the model to use that evidence. Dense embeddings help find semantically similar passages. Lexical search catches exact terms. Reranking improves precision. Metadata filters enforce tenant, permission, date, language, or product boundaries.",
        "It also works because knowledge becomes updateable. Add a document, re-embed it, and the system can use it without retraining the generator. Delete or expire a document, and a well-built index should stop retrieving it. That separation is the practical reason RAG became a default pattern for enterprise AI.",
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Index storage is roughly vectors plus text plus metadata plus ANN overhead. One million 1,536-dimensional float32 vectors require about 6.1 GB before graph or metadata overhead; float16 cuts the vector payload roughly in half. Product systems also pay for embeddings, indexing, reranking, prompt tokens, generation latency, and monitoring.",
        "Operational complexity lives in refresh. Documents move, permissions change, pages are duplicated, chunks become stale, and source links break. A serious RAG system needs ingestion jobs, deletion handling, alias swaps or incremental updates, versioned indexes, evaluation sets, and rollback for bad retrieval changes.",
      ],
    },
    {
      heading: 'Evaluation',
      paragraphs: [
        "Evaluate retrieval and generation separately. Retrieval recall asks whether the gold evidence appears in the candidate set. Ranking quality asks whether that evidence appears high enough to reach the final prompt. Answer quality asks whether the response is correct. Citation faithfulness asks whether the cited source actually supports the claim.",
        "A useful test set contains real questions, expected source documents, answer rubrics, permission boundaries, stale-document traps, and unanswerable questions. The unanswerable cases matter because a RAG system should know when the corpus does not contain the answer. Refusing from missing evidence is often better than confident synthesis.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        "RAG wins for private knowledge, fast-changing facts, large document collections, citation-heavy workflows, and systems where the answer should be traceable to a source. It is a natural fit for enterprise search, support assistants, policy assistants, legal document review, codebase Q&A, research notebooks, and product documentation.",
        "It is also useful as a teaching pattern because it joins data structures and model behavior. Embeddings map text to vectors, ANN indexes trade exactness for speed, rerankers refine candidate order, context packing is a constrained selection problem, and the language model becomes the final reader.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "RAG fails when the corpus is bad, the answer requires computation rather than lookup, permissions are loose, documents contradict each other without precedence rules, or the relevant evidence is hidden in tables, images, code, tickets, or logs the chunker did not preserve. It also fails when teams use vector search alone for exact identifiers.",
        "The biggest myth is that RAG prevents hallucination by itself. It only supplies evidence. The generator can still ignore evidence, overgeneralize it, cite weakly related chunks, or answer from prior knowledge. Grounded generation requires prompt discipline, refusal rules, citation checks, and evaluation.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Primary sources: Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks at https://arxiv.org/abs/2005.11401, Dense Passage Retrieval at https://arxiv.org/abs/2004.04906, FAISS documentation at https://faiss.ai/index.html, and Azure AI Search RAG overview at https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview.",
        "Study Embeddings and Similarity, HNSW Vector Search at Scale, Tokenization BPE, Attention Mechanism, KV Cache, Multi-Index RAG, RAG Context Packing Token Budget, RAG Index Lifecycle and Alias Swap, RAG Citation Span Index, RAG Dedup MinHash and Chunk Canonicalization, Filtered Vector Search and Bitset Gates, and RAG Evaluation.",
      ],
    },
    {
      heading: 'Lewis et al. 2020 and the RAG lineage',
      paragraphs: [
        "The RAG paper (Lewis et al., 2020, \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\") introduced two variants: RAG-Sequence, which retrieves once and generates the full answer from one fixed set of documents, and RAG-Token, which can retrieve different documents for each output token. Both use a pretrained BART generator and a Dense Passage Retriever (DPR) whose index is a FAISS flat search over Wikipedia passages. The key result: RAG matched or beat pure parametric models on open-domain QA, fact verification, and knowledge-grounded dialogue without storing all facts in model weights.",
        "The practical lineage runs from DrQA (2017, TF-IDF retrieval + neural reader) through DPR (2020, learned dense retrieval replacing sparse) to RAG (2020, end-to-end retrieval + generation). Each step replaced a hand-engineered component with a learned one. Modern production RAG rarely uses the exact Lewis et al. architecture, but the retrieve-then-generate contract — and the insight that retrieval quality bounds answer quality — remains the foundation.",
      ],
    },
    {
      heading: 'Dense retrieval vs. sparse (BM25)',
      paragraphs: [
        "BM25 ranks documents by weighted term frequency: if the query word appears often in a short document, that document scores high. It is fast, interpretable, and needs no training data. It fails on semantic gaps — \"automobile\" vs. \"car,\" paraphrases, or questions whose answer uses different vocabulary than the question.",
        "Dense retrieval (DPR, Contriever, E5, BGE) encodes query and document into fixed-size vectors and retrieves by cosine or dot-product similarity. It handles paraphrases and meaning-level matches but can miss exact identifiers, error codes, policy numbers, and product SKUs that BM25 catches trivially. The embedding model must also be trained or fine-tuned on domain-relevant pairs to work well.",
        "Production systems almost always use hybrid retrieval: BM25 for lexical precision, dense vectors for semantic recall, and a learned reranker (cross-encoder) to merge and rescore the combined candidate set. The reranker sees the full query-document pair and can model fine-grained relevance that bi-encoder dot products miss.",
      ],
    },
    {
      heading: 'Vector databases and ANN indexes',
      paragraphs: [
        "A vector database stores embeddings and supports approximate nearest neighbor (ANN) search. Exact brute-force search is O(n d) per query — fine for thousands of vectors, unusable at millions. ANN indexes trade a small recall loss for orders-of-magnitude speedup.",
        "HNSW (Hierarchical Navigable Small World) builds a multi-layer proximity graph. Search starts at the top layer (few nodes, long jumps) and descends to the bottom (all nodes, short jumps), greedy-walking toward the query at each level. Typical recall at 95-99% with sub-millisecond latency on millions of vectors. IVF (Inverted File) partitions vectors into Voronoi cells with k-means, then searches only the nearest cells. Product Quantization (PQ) compresses vectors by splitting dimensions into subvectors and quantizing each, trading accuracy for 10-50x memory reduction.",
        "Engines like FAISS, Milvus, Qdrant, Weaviate, Pinecone, and pgvector each combine these primitives differently. The choice depends on scale, update frequency, filtering needs, and whether you need the index to live inside an existing database (pgvector) or as a standalone service.",
      ],
    },
    {
      heading: 'Chunking strategies',
      paragraphs: [
        "Chunking decides what unit of text gets its own embedding and becomes a retrievable item. The chunk is the atom of RAG — too large and the embedding averages over unrelated ideas, too small and it lacks the context to answer a question.",
        "Fixed-size chunking (e.g., 512 tokens with 50-token overlap) is simple and predictable but cuts through sentences, paragraphs, and logical sections. Recursive character splitting tries paragraph, then sentence, then word boundaries. Structure-aware chunking respects headings, code blocks, table rows, list items, or legal section numbers — critical for documents where structure carries meaning.",
        "Parent-document retrieval is a common fix for the size tradeoff: embed small chunks for precise matching, but retrieve the larger parent section for generation context. Sentence-window retrieval embeds individual sentences but expands the context window around matched sentences at retrieval time. Both strategies let the retrieval target be narrow while the generation context is rich.",
      ],
    },
    {
      heading: 'RAG vs. fine-tuning',
      paragraphs: [
        "Fine-tuning changes the model weights. It is the right tool for teaching style, tone, format, domain vocabulary, or reasoning patterns that the base model lacks. It is a poor tool for memorizing facts: facts change, training is expensive, and the model cannot cite which training example produced an answer.",
        "RAG keeps facts external and retrievable. It handles fast-changing knowledge, per-user or per-tenant data, access control, citation, and rollback (delete or update the document, and the system forgets it). But RAG cannot change how the model reasons or writes — it can only change what the model reads before generating.",
        "In practice, the best systems combine both: fine-tune for domain style and instruction-following, then use RAG for factual grounding. The fine-tuned model is better at following retrieval instructions, extracting answers from long contexts, and refusing when evidence is absent. RAG without any fine-tuning works, but the generator may ignore or misuse retrieved evidence more often.",
      ],
    },
    {
      heading: 'Hallucination reduction',
      paragraphs: [
        "RAG reduces hallucination by shifting the model from recall (generating facts from weights) to reading comprehension (extracting facts from provided text). When the context contains the answer and the model is instructed to use it, factual accuracy rises substantially — Lewis et al. showed this on knowledge-intensive benchmarks, and production deployments confirm it.",
        "But RAG does not eliminate hallucination. The model can still fabricate details not in any retrieved chunk, combine facts from incompatible chunks, answer from parametric memory when retrieved evidence is ambiguous, or hallucinate a citation span that sounds right but does not exist in the source. Mitigation requires prompt engineering (\"answer only from the provided documents, say 'I do not know' otherwise\"), citation verification (check that each claim maps to a retrieved span), and evaluation pipelines that measure faithfulness separately from relevance.",
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        "Run each of the three questions in the animation and watch where the query point lands relative to the document clusters. For \"what is a transformer?\", notice that the nearest neighbors are the ML cluster — but \"gpu guide\" is nearby too. Ask yourself: does the GPU training document help answer the question, or does it dilute the context with irrelevant information? That judgment is what rerankers automate.",
        "Then imagine adding a new document: \"Transformer toys are popular collectibles.\" Where would it embed? Would it interfere with the ML query? This is the polysemy problem — same word, different meaning — and it is why metadata filters, domain-specific embeddings, and hybrid retrieval exist.",
      ],
    },
],
};
