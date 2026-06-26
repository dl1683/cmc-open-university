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
        'Read the animation as a request path through retrieval-augmented generation, or RAG. A user query is converted into a search representation, matched against indexed documents, packed into context, and then used by a generator.',
        {type: 'image', src: './assets/gifs/rag-pipeline.gif', alt: 'Animated walkthrough of the rag pipeline visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is that the generator can only ground itself in context it actually receives. If the needed fact is absent from the retrieved chunks, a fluent answer is still unsupported.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        { type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg", alt: "Layered neural network diagram with colored nodes", caption: "The generator is still a neural model, but RAG moves changing facts into external context instead of model weights. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0." },
        'RAG exists because a trained model has fixed parameters, while the world and private documents keep changing. Instead of retraining for every policy update, the system retrieves relevant text at answer time and gives it to the model as evidence.',
        'This separates memory into two parts. Model weights provide language and reasoning patterns, while the external index provides current or private facts that can be inspected and replaced.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to put all needed knowledge into the prompt. That works for a small manual answer because a person can paste the relevant paragraph beside the question.',
        'Another approach is to fine-tune the model on the documents. Fine-tuning can change style and task behavior, but it is a poor database because updates are slow, provenance is weak, and forgotten details are hard to audit.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is context and freshness. A model with a 128,000-token window still cannot carry every policy, ticket, contract, and code file for every request, and a larger window raises latency and cost.',
        'Fine-tuning hits a governance wall. If a price changes from 19 to 29 dollars, the team needs to replace one fact and prove which source was used, not run a new training job and hope the model internalized it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to turn answering into a join between a question and a source collection. The system retrieves a small set of candidate chunks, and the generator must answer from that bounded evidence.',
        'A chunk is a stored passage, an embedding is a numeric vector used for similarity search, and top-k means the k best matches returned by the retriever. These terms matter because each one creates a tunable failure point.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Offline, documents are cleaned, split into chunks, embedded, and written into a vector index with metadata. Online, the query is embedded, the index returns nearby chunks, optional reranking reorders them, and the prompt builder inserts selected context beside the question.',
        { type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg", alt: "Directed graph with nodes connected by arrows", caption: "A production RAG system is a directed data flow: ingest, chunk, embed, retrieve, rerank, pack context, generate, and verify. Source: Wikimedia Commons, David W., public domain." },
        'The generator then produces an answer and often citations. A production pipeline logs the query, retrieved chunk ids, scores, prompt, answer, and feedback so failures can be traced back to retrieval or generation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is conditional: if the needed evidence is indexed, retrieved, passed into the prompt, and followed by the generator, then the answer can be grounded in inspectable sources. RAG does not prove truth by itself; it creates a path that can be checked.',
        'The invariant is source availability at generation time. Once the prompt contains the relevant chunk, an evaluator can compare each answer claim against the chunk instead of guessing what the model remembered.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost comes from indexing, storage, retrieval latency, reranking, and extra prompt tokens. If top-k rises from 4 to 12 and each chunk is 300 tokens, the prompt grows by 2,400 tokens before the model writes a single word.',
        'When the document set doubles, index storage and embedding work roughly double, while query latency depends on the search structure and reranker size. The dominant cost in production is often the context passed to the generator, not the vector lookup.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RAG fits internal search assistants, customer support, legal and compliance research, documentation copilots, and codebase question answering. The common pattern is that sources change faster than models can be retrained and answers need provenance.',
        'It is also useful when access control matters. Retrieval can filter documents by user permissions before the model sees them, which is safer than training every user permission state into one model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RAG fails when the index contains bad chunks, stale documents, weak metadata, or embeddings that miss the user intent. The generator cannot recover evidence that retrieval never supplied.',
        'It also fails under prompt injection and conflicting sources. Retrieved text can contain instructions or obsolete claims, so the system needs source ranking, policy checks, and refusal behavior rather than blind context stuffing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a support bot has 50,000 help-center chunks and a user asks, "Can I export audit logs on the Pro plan?" The retriever returns 6 chunks, but only chunk 17 says exports require Enterprise, while chunk 42 is an old Pro-plan page from last year.',
        'If the reranker moves chunk 17 above chunk 42 and the prompt includes dates, the answer can say Pro does not include export and cite the current policy. If top-k is only 1 and returns the stale chunk, the same model may answer incorrectly with confidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Lewis et al. on Retrieval-Augmented Generation, Karpukhin et al. on dense passage retrieval, and current vector-database documentation for indexing and filtering behavior. Treat product claims about retrieval quality as implementation details to test, not as guarantees.',
        'Study embeddings, approximate nearest neighbor search, reranking, prompt injection, citation evaluation, chunking strategy, and RAG evaluation next. Those topics explain the actual levers inside the pipeline.',
      ],
    },
  ],
};
