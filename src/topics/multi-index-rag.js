// Multi-index RAG: combine lexical, vector, metadata, and graph retrieval
// before reranking and generation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'multi-index-rag',
  title: 'Multi-Index RAG',
  category: 'AI & ML',
  summary: 'How production RAG systems fuse BM25, vector search, filters, graph edges, and rerankers instead of trusting one index.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['hybrid retrieval', 'fusion and rerank'], defaultValue: 'hybrid retrieval' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function pipeline(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.6, y: 3.6, note: 'user intent' },
      { id: 'bm25', label: 'BM25', x: 2.5, y: 1.1, note: 'terms' },
      { id: 'splade', label: 'SPLADE', x: 2.5, y: 2.5, note: 'sparse' },
      { id: 'vector', label: 'vector ANN', x: 2.5, y: 3.6, note: 'meaning' },
      { id: 'meta', label: 'metadata', x: 2.5, y: 5.8, note: 'filters' },
      { id: 'graph', label: 'graph hop', x: 4.6, y: 5.8, note: 'relations' },
      { id: 'fusion', label: 'fusion', x: 5.3, y: 2.5, note: 'rank merge' },
      { id: 'rerank', label: 'reranker', x: 7.1, y: 2.5, note: 'judge' },
      { id: 'prompt', label: 'prompt', x: 8.8, y: 3.6, note: 'context' },
    ],
    edges: [
      { id: 'e-q-bm25', from: 'query', to: 'bm25', weight: 'keywords' },
      { id: 'e-q-splade', from: 'query', to: 'splade', weight: 'learned terms' },
      { id: 'e-q-vector', from: 'query', to: 'vector', weight: 'embedding' },
      { id: 'e-q-meta', from: 'query', to: 'meta', weight: 'scope' },
      { id: 'e-meta-graph', from: 'meta', to: 'graph', weight: 'entities' },
      { id: 'e-bm25-fusion', from: 'bm25', to: 'fusion', weight: 'ranked list' },
      { id: 'e-splade-fusion', from: 'splade', to: 'fusion', weight: 'ranked list' },
      { id: 'e-vector-fusion', from: 'vector', to: 'fusion', weight: 'ranked list' },
      { id: 'e-graph-fusion', from: 'graph', to: 'fusion', weight: 'neighbors' },
      { id: 'e-fusion-rerank', from: 'fusion', to: 'rerank', weight: 'top candidates' },
      { id: 'e-rerank-prompt', from: 'rerank', to: 'prompt', weight: 'evidence' },
    ],
  }, { title });
}

function* hybridRetrieval() {
  const indexCount = 4;
  yield {
    state: pipeline('Production RAG fans out to multiple indexes'),
    highlight: { active: ['query', 'bm25', 'splade', 'vector', 'meta', 'e-q-bm25', 'e-q-splade', 'e-q-vector', 'e-q-meta'], compare: ['fusion', 'rerank'] },
    explanation: `Read the fanout to ${indexCount} indexes as a refusal to bet the whole answer on one geometry. Terms, embeddings, metadata, and graph links each catch a different kind of evidence, then the system reconciles them.`,
  };

  const queryShapes = 5;
  yield {
    state: labelMatrix(
      'Each index wins on a different query shape',
      [
        { id: 'exact', label: 'policy id' },
        { id: 'sparse', label: 'vocab gap' },
        { id: 'semantic', label: 'paraphrase' },
        { id: 'fresh', label: 'fresh doc' },
        { id: 'entity', label: 'entity rel' },
      ],
      [
        { id: 'best', label: 'best first' },
        { id: 'failure', label: '1-index fail' },
      ],
      [
        ['inverted idx', 'blurs IDs'],
        ['SPLADE terms', 'postings grow'],
        ['HNSW ANN', 'keywords miss'],
        ['metadata', 'stale wins'],
        ['graph hop', 'misses links'],
      ],
    ),
    highlight: { active: ['exact:best', 'sparse:best', 'semantic:best', 'fresh:best', 'entity:best'] },
    explanation: `Across ${queryShapes} query shapes, the right index depends on the question. A support bot asking about "SOC2-CC7.2" needs exact terms. A user asking a paraphrase needs Embeddings & Similarity. A permissions question may need graph context.`,
    invariant: `Retrieval coverage is a union problem across ${queryShapes} failure modes; ranking is a precision problem.`,
  };

  const fusionInputs = 3;
  yield {
    state: pipeline('Candidates are merged before the expensive judge'),
    highlight: { active: ['fusion', 'e-bm25-fusion', 'e-vector-fusion', 'e-graph-fusion'], found: ['rerank', 'prompt'] },
    explanation: `Fusion merges ${fusionInputs} ranked lists and is the handoff between recall and precision. It keeps candidates from several indexes alive long enough for the slower reranker to make a better judgment.`,
  };

  const evalMetrics = 4;
  yield {
    state: labelMatrix(
      'Index composition changes the evaluation plan',
      [
        { id: 'recall', label: 'retr recall' },
        { id: 'precision', label: 'rerank nDCG' },
        { id: 'faith', label: 'faithful?' },
        { id: 'latency', label: 'latency' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'why', label: 'why' },
      ],
      [
        ['found support?', 'missing facts'],
        ['top fit?', 'noise buries'],
        ['used evidence?', 'decor cites'],
        ['time split', 'cost+p95'],
      ],
    ),
    highlight: { found: ['recall:measure', 'precision:measure', 'faith:measure', 'latency:measure'] },
    explanation: `Multi-index RAG must be evaluated across ${evalMetrics} layers. If recall fails, add or fix retrievers. If precision fails, tune fusion and reranking. If faithfulness fails, the generator or prompt contract is broken.`,
  };
}

function* fusionAndRerank() {
  const retrieverCount = 3;
  const rankDepth = 4;
  yield {
    state: labelMatrix(
      `${retrieverCount} retrievers return different ranked lists`,
      [
        { id: 'rank1', label: 'rank 1' },
        { id: 'rank2', label: 'rank 2' },
        { id: 'rank3', label: 'rank 3' },
        { id: 'rank4', label: 'rank 4' },
      ],
      [
        { id: 'bm25', label: 'BM25' },
        { id: 'vector', label: 'vector' },
        { id: 'graph', label: 'graph' },
      ],
      [
        ['policy-17', 'refund guide', 'account owner'],
        ['refund guide', 'policy-17', 'billing team'],
        ['plan table', 'upgrade FAQ', 'refund guide'],
        ['billing FAQ', 'plan table', 'policy-17'],
      ],
    ),
    highlight: { active: ['rank1:bm25', 'rank2:vector', 'rank3:graph'], compare: ['rank4:bm25', 'rank4:vector'] },
    explanation: `Raw scores from ${retrieverCount} indexes are not comparable. BM25 scores, cosine similarities, and graph distances live on different scales. Fusion methods work with ranks so the ${rankDepth}-deep lists can be combined without fragile normalization.`,
  };

  const docCount = 4;
  yield {
    state: labelMatrix(
      'Reciprocal Rank Fusion rewards broad agreement',
      [
        { id: 'policy', label: 'policy-17' },
        { id: 'refund', label: 'refund guide' },
        { id: 'plan', label: 'plan table' },
        { id: 'owner', label: 'account owner' },
      ],
      [
        { id: 'bm25', label: 'BM25 rank' },
        { id: 'vector', label: 'vector rank' },
        { id: 'graph', label: 'graph rank' },
        { id: 'rrf', label: 'fused' },
      ],
      [
        ['1', '2', '4', 'very high'],
        ['2', '1', '3', 'very high'],
        ['3', '4', 'not found', 'medium'],
        ['not found', 'not found', '1', 'medium'],
      ],
    ),
    highlight: { found: ['policy:rrf', 'refund:rrf'], compare: ['owner:rrf'] },
    explanation: `RRF scores ${docCount} candidate documents by adding 1 / (k + rank) for each list position. Documents that appear near the top of several lists rise above documents that are only one retriever's favorite.`,
    invariant: `Fusion creates candidates from ${retrieverCount} sources; reranking decides final context.`,
  };

  const poolSize = 50;
  const contextSize = 5;
  const stages = 4;
  yield {
    state: labelMatrix(
      'A reranker spends more compute on fewer candidates',
      [
        { id: 'top50', label: `top ${poolSize} fused` },
        { id: 'cross', label: 'cross-encoder' },
        { id: 'final', label: `top ${contextSize} context` },
        { id: 'prompt', label: 'answer prompt' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['candidate pool', 'high recall'],
        ['joint score', 'precision'],
        ['fit budget', 'avoid stuffing'],
        ['cite answer', 'grounded'],
      ],
    ),
    highlight: { active: ['top50:action', 'cross:action', 'final:action'], found: ['prompt:reason'] },
    explanation: `The reranker narrows ${poolSize} fused candidates to ${contextSize} across ${stages} stages. It can compare the query and chunk with richer interaction than a vector dot product. That is expensive, so it runs after cheap indexes have narrowed the pool.`,
  };

  const failureModes = 4;
  yield {
    state: labelMatrix(
      'Operational failure modes',
      [
        { id: 'stale', label: 'stale chunks' },
        { id: 'dup', label: 'duplicates' },
        { id: 'acl', label: 'ACL leak' },
        { id: 'budget', label: 'context budget' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['old wins', 'fresh+tomb'],
        ['dup source', 'dedupe doc'],
        ['unauth ev', 'filter first'],
        ['buried', 'diversify'],
      ],
    ),
    highlight: { active: ['stale:fix', 'dup:fix', 'acl:fix', 'budget:fix'] },
    explanation: `The ${failureModes} failure modes are the production lesson: a multi-index stack inherits every upstream data problem. Bad ACLs, stale chunks, duplicate copies, and weak packing can erase the benefit of better retrieval.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'hybrid retrieval') yield* hybridRetrieval();
  else if (view === 'fusion and rerank') yield* fusionAndRerank();
  else throw new InputError('Pick a multi-index RAG view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the hybrid retrieval view as one query split across complementary indexes. Active nodes are retrievers currently running, and found nodes are documents that survive fusion or reranking.',
        'Read the fusion view as rank evidence being combined. Reciprocal Rank Fusion uses rank positions rather than raw scores because BM25, vector similarity, and graph distance do not share a common scale.',
        {type: 'callout', text: 'Multi-index RAG is a recall contract: each index exists only when it rescues a failure mode the others miss.'},
        {type: 'image', src: './assets/gifs/multi-index-rag.gif', alt: 'Animated walkthrough of the multi index rag visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retrieval-augmented generation, or RAG, retrieves documents before a model answers. The generator can only use evidence that retrieval places in the context window.',
        'Real questions need different retrieval signals. Exact identifiers, paraphrases, timestamps, permissions, and relationships are not all preserved by one embedding space.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is dense retrieval only. Embed every chunk, embed the query, retrieve nearest vectors, and place the top chunks in the prompt.',
        'Dense retrieval is a strong first system because it handles paraphrase well and has a simple operational path. One model and one vector index can cover many common questions.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Colored_neural_network.svg', alt: 'Layered neural network diagram with colored nodes', caption: 'Dense retrieval starts with learned embeddings, so the retrieval stack inherits both the strength and the blind spots of neural representation. Source: Wikimedia Commons, Glosser.ca, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when the query depends on information that embeddings blur or omit. A policy id, a revoked document date, a permission boundary, or an ownership edge may be decisive but invisible to cosine similarity.',
        'A single vector index cannot simultaneously be an exact token matcher, semantic matcher, freshness filter, permission gate, and graph engine. The failure is representational, not just a tuning problem.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use multiple indexes because each one protects a specific failure class. BM25 protects exact terms, dense vectors protect paraphrase, metadata protects scope, and graph hops protect relationships.',
        'Fusion then turns several imperfect ranked lists into one candidate pool. Reranking spends heavier compute only after recall has brought enough plausible evidence forward.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline plans the query, runs selected retrievers in parallel, fuses ranked lists, reranks the fused pool, and packs the final context. Each stage has a narrow contract.',
        'Metadata and permissions should filter before retrieval whenever possible. If unauthorized evidence reaches the generator, a later redaction step may be too late.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Graph hops protect relationships that no flat chunk embedding can express, such as person-to-team-to-permission paths. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is coverage by independent failure modes. If an exact id query fails dense retrieval but succeeds in BM25, and a paraphrase query fails BM25 but succeeds in dense retrieval, combining both increases recall for the mixed workload.',
        'More indexes are justified only when they rescue real missed queries. If an index does not add unique recoveries, it adds latency, storage, and debugging surface without improving evidence coverage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each index adds ingestion work, storage, freshness handling, deletion handling, and query latency. A vector index may need embeddings and ANN graph maintenance; BM25 needs tokenization and postings; graph retrieval needs entity resolution.',
        'Runtime cost behaves like the slowest required branch plus fusion and rerank. If BM25 takes 5 ms, vector search 20 ms, graph expansion 40 ms, and reranking 100 ms, the user sees about 140 ms plus orchestration overhead unless branches are skipped or timed out.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Enterprise assistants use multi-index RAG because user questions mix ticket numbers, natural language symptoms, team ownership, document freshness, and access control. No single retrieval surface covers that distribution.',
        'Legal, support, code, and internal knowledge systems have the same shape. They need exact citations, semantic passages, metadata filters, and relationship traversal before the model writes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when extra indexes produce duplicate, stale, or unauthorized candidates. Fusion can make a mediocre document look strong if it appears in many lists for shallow reasons.',
        'It also fails when evaluation looks only at final answers. Retrieval must be scored layer by layer, or the team will blame the generator for evidence the retrievers never supplied.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose BM25 returns [policy-17, refund-guide, plan-table], vector search returns [refund-guide, policy-17, upgrade-faq], and graph returns [account-owner, refund-guide, policy-17]. With RRF k = 60, refund-guide scores 1/62 + 1/61 + 1/62, about 0.0487.',
        'Policy-17 scores 1/61 + 1/62 + 1/63, about 0.0484. Account-owner scores only 1/61, about 0.0164. Agreement across retrievers beats one isolated first-place result, which is exactly the behavior fusion is meant to create.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Reciprocal Rank Fusion by Cormack, Clarke, and Butt; Dense Passage Retrieval by Karpukhin et al.; SPLADE by Formal et al.; and ColBERT by Khattab and Zaharia. Together they explain dense, sparse, fusion, and late-interaction retrieval.',
        'Next study Inverted Index, Embeddings and Similarity, HNSW Search, SPLADE, Cross-Encoder Reranker, Filtered Vector Search, GraphRAG, and RAG Evaluation.',
      ],
    },
  ],
};