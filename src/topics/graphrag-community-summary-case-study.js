// GraphRAG: build an entity graph from text, cluster it into communities,
// precompute community summaries, then query globally, locally, or with DRIFT.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'graphrag-community-summary-case-study',
  title: 'GraphRAG Community Summary Case Study',
  category: 'Papers',
  summary: 'Microsoft GraphRAG as a retrieval-systems lesson: extract entity graphs, detect communities, precompute summaries, and query global or local structure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['index graph', 'query modes'], defaultValue: 'index graph' },
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

function indexGraph(title) {
  return graphState({
    nodes: [
      { id: 'docs', label: 'docs', x: 0.6, y: 4.1, note: 'corpus' },
      { id: 'chunks', label: 'chunks', x: 2.4, y: 2.5, note: 'text' },
      { id: 'extract', label: 'extract', x: 4.1, y: 4.0, note: 'LLM pass' },
      { id: 'entities', label: 'nodes', x: 5.8, y: 1.2, note: 'entities' },
      { id: 'edges', label: 'edges', x: 5.8, y: 3.5, note: 'relations' },
      { id: 'claims', label: 'claims', x: 5.8, y: 5.8, note: 'facts' },
      { id: 'cluster', label: 'cluster', x: 7.7, y: 2.5, note: 'groups' },
      { id: 'summaries', label: 'reports', x: 9.2, y: 4.8, note: 'summaries' },
    ],
    edges: [
      { id: 'e-docs-chunks', from: 'docs', to: 'chunks', weight: 'split' },
      { id: 'e-chunks-extract', from: 'chunks', to: 'extract', weight: 'prompt' },
      { id: 'e-extract-entities', from: 'extract', to: 'entities', weight: 'names' },
      { id: 'e-extract-edges', from: 'extract', to: 'edges', weight: 'relations' },
      { id: 'e-extract-claims', from: 'extract', to: 'claims', weight: 'claims' },
      { id: 'e-entities-cluster', from: 'entities', to: 'cluster', weight: 'graph' },
      { id: 'e-edges-cluster', from: 'edges', to: 'cluster', weight: 'weights' },
      { id: 'e-cluster-summaries', from: 'cluster', to: 'summaries', weight: 'reports' },
      { id: 'e-claims-summaries', from: 'claims', to: 'summaries', weight: 'evidence' },
    ],
  }, { title });
}

function queryGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.6, note: 'user task' },
      { id: 'global', label: 'global', x: 2.5, y: 1.5, note: 'themes' },
      { id: 'local', label: 'local', x: 2.5, y: 3.6, note: 'entity' },
      { id: 'drift', label: 'DRIFT', x: 2.5, y: 5.8, note: 'hybrid' },
      { id: 'communities', label: 'reports', x: 5.0, y: 1.5, note: 'summaries' },
      { id: 'neighborhood', label: 'neighborhood', x: 5.0, y: 4.0, note: 'graph + text' },
      { id: 'followups', label: 'followups', x: 5.0, y: 6.1, note: 'subqueries' },
      { id: 'reduce', label: 'reduce', x: 7.4, y: 3.6, note: 'merge answers' },
      { id: 'answer', label: 'answer', x: 9.1, y: 3.6, note: 'cited' },
    ],
    edges: [
      { id: 'e-q-global', from: 'query', to: 'global' },
      { id: 'e-q-local', from: 'query', to: 'local' },
      { id: 'e-q-drift', from: 'query', to: 'drift' },
      { id: 'e-global-communities', from: 'global', to: 'communities', weight: 'map' },
      { id: 'e-local-neighborhood', from: 'local', to: 'neighborhood', weight: 'expand' },
      { id: 'e-drift-followups', from: 'drift', to: 'followups', weight: 'ask' },
      { id: 'e-followups-neighborhood', from: 'followups', to: 'neighborhood', weight: 'search' },
      { id: 'e-communities-reduce', from: 'communities', to: 'reduce', weight: 'partial answers' },
      { id: 'e-neighborhood-reduce', from: 'neighborhood', to: 'reduce', weight: 'facts' },
      { id: 'e-reduce-answer', from: 'reduce', to: 'answer', weight: 'synthesize' },
    ],
  }, { title });
}

function* indexGraphView() {
  yield {
    state: indexGraph('GraphRAG turns a corpus into graph-shaped memory'),
    highlight: { active: ['docs', 'chunks', 'extract', 'e-docs-chunks', 'e-chunks-extract'], compare: ['cluster', 'summaries'] },
    explanation: 'Read this as moving structure into the index. Naive RAG stores chunks; GraphRAG also extracts entities, relationships, claims, communities, and reports before query time.',
  };

  yield {
    state: indexGraph('Entities and relationships become a weighted graph'),
    highlight: { active: ['extract', 'entities', 'edges', 'claims', 'e-extract-entities', 'e-extract-edges', 'e-extract-claims'], found: ['chunks'] },
    explanation: 'The graph is only useful if its records stay source-backed. Entity nodes, relationship edges, and claims need provenance because later community summaries depend on them.',
    invariant: 'GraphRAG is only as trustworthy as its extraction and source-traceability pipeline.',
  };

  yield {
    state: labelMatrix(
      'Index artifacts',
      [
        { id: 'text', label: 'text units' },
        { id: 'entity', label: 'entities' },
        { id: 'rel', label: 'relations' },
        { id: 'comm', label: 'communities' },
        { id: 'report', label: 'reports' },
      ],
      [
        { id: 'stored as', label: 'stored as' },
        { id: 'query value', label: 'query value' },
      ],
      [
        ['chunks', 'source evidence'],
        ['nodes', 'local search anchors'],
        ['edges', 'neighborhood expansion'],
        ['clusters', 'global structure'],
        ['summaries', 'global context'],
      ],
    ),
    highlight: { active: ['entity:query value', 'rel:query value', 'comm:query value', 'report:query value'], found: ['text:query value'] },
    explanation: 'The index is not one vector table. It is a family of linked artifacts: chunks, entity nodes, relationship edges, community assignments, and community summaries.',
  };

  yield {
    state: indexGraph('Community detection compresses graph structure'),
    highlight: { active: ['entities', 'edges', 'cluster', 'summaries', 'e-entities-cluster', 'e-edges-cluster', 'e-cluster-summaries'], compare: ['chunks'] },
    explanation: 'Community detection groups densely related entities. GraphRAG then precomputes natural-language reports for those communities, creating a summary hierarchy that can answer corpus-level questions without stuffing all raw chunks into context.',
  };

  yield {
    state: labelMatrix(
      'Offline cost and quality gates',
      [
        { id: 'extract', label: 'extract' },
        { id: 'resolve', label: 'resolve' },
        { id: 'cluster', label: 'cluster' },
        { id: 'summarize', label: 'summarize' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'cost driver', label: 'cost driver' },
        { id: 'failure mode', label: 'failure mode' },
      ],
      [
        ['LLM calls per chunk', 'missed or invented entities'],
        ['entity merge rules', 'duplicate nodes'],
        ['graph algorithm', 'bad community boundaries'],
        ['LLM report generation', 'unsupported claims'],
        ['source links', 'no provenance path'],
      ],
    ),
    highlight: { active: ['extract:cost driver', 'summarize:cost driver'], removed: ['audit:failure mode'] },
    explanation: 'GraphRAG moves work from query time to indexing time. That can improve global questions, but it creates a serious offline pipeline: extraction quality, entity resolution, clustering, summarization, and provenance all need gates.',
  };
}

function* queryModesView() {
  yield {
    state: queryGraph('GraphRAG has separate query paths'),
    highlight: { active: ['query', 'global', 'local', 'drift', 'e-q-global', 'e-q-local', 'e-q-drift'], compare: ['answer'] },
    explanation: 'The query shape decides the path. Global search uses community reports for broad sensemaking. Local search starts from entities and graph neighborhoods. DRIFT blends global community context with local follow-up searches.',
  };

  yield {
    state: queryGraph('Global search maps over community summaries'),
    highlight: { active: ['global', 'communities', 'reduce', 'answer', 'e-global-communities', 'e-communities-reduce', 'e-reduce-answer'], compare: ['local'] },
    explanation: 'For questions like "What are the main themes?", there may be no single chunk to retrieve. Global search asks community summaries for partial answers, then reduces those partial answers into a final synthesis.',
    invariant: 'Global GraphRAG is query-focused summarization over a precomputed graph summary hierarchy.',
  };

  yield {
    state: queryGraph('Local search follows entities back to facts'),
    highlight: { active: ['local', 'neighborhood', 'reduce', 'answer', 'e-local-neighborhood', 'e-neighborhood-reduce'], found: ['query'] },
    explanation: 'For entity-specific questions, local search retrieves relevant entity records, linked relationships, source chunks, and related community information. This is closer to Multi-Index RAG with a graph-first candidate set.',
  };

  yield {
    state: queryGraph('DRIFT expands local search with community-guided follow-ups'),
    highlight: { active: ['drift', 'followups', 'neighborhood', 'reduce', 'e-drift-followups', 'e-followups-neighborhood', 'e-neighborhood-reduce'], compare: ['global'] },
    explanation: 'DRIFT starts with broader community context, generates focused follow-up questions, then runs local retrieval for those subquestions. It is designed to balance global coverage against local evidence and cost.',
  };

  yield {
    state: labelMatrix(
      'When to use each mode',
      [
        { id: 'themes', label: 'themes' },
        { id: 'actor', label: 'actor' },
        { id: 'why', label: 'why/how' },
        { id: 'audit', label: 'audit' },
      ],
      [
        { id: 'best mode', label: 'best mode' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['global', 'summary drift'],
        ['local', 'entity resolution errors'],
        ['DRIFT', 'cost and subquery noise'],
        ['local + provenance', 'unsupported summaries'],
      ],
    ),
    highlight: { active: ['themes:best mode', 'actor:best mode', 'why:best mode'], removed: ['audit:risk'] },
    explanation: 'The mode view is a routing guide. Global search is for corpus-level synthesis, local search is for entity-specific evidence, and DRIFT tries to combine broad context with focused follow-ups.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'index graph') yield* indexGraphView();
  else if (view === 'query modes') yield* queryModesView();
  else throw new InputError('Pick a GraphRAG view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pipeline as two indexes built from the same corpus. The vector index finds nearby text chunks, while the graph index stores entities, relationships, claims, communities, and generated community summaries.',
        'The safe inference is that broad questions need structure before query time. If no single chunk contains the answer, the system needs graph neighborhoods and community reports to organize evidence before final synthesis.',
        {type:'callout', text:'GraphRAG moves structure into the index: entities, relationships, communities, and summaries become retrieval artifacts before the query arrives.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/82/Louvain_Step2.png', alt:'Network graph with nodes grouped into colored communities.', caption:'Louvain community detection step. Wikimedia Commons, Louvain_Step2.png.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retrieval-augmented generation, or RAG, answers by retrieving evidence and giving it to a language model. Plain vector RAG is strong when a question is close to one or a few chunks in embedding space.',
        'GraphRAG exists for questions whose answers are distributed across a corpus. Themes, recurring risks, common actors, and cross-document patterns may not live in one nearest passage.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach splits documents into chunks, embeds each chunk, retrieves the top k chunks for a question, and asks the model to answer from those chunks. That is often enough for narrow factual lookup.',
        'A second obvious fix is to increase k. More chunks can help recall, but it also raises token cost and gives the model an unordered pile instead of a structured view of the corpus.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is global synthesis. A question such as what recurring risks appear across two years of incident reports may require ten small pieces spread across many documents, with no single representative chunk.',
        'Another wall is repeated work. If every query has to rediscover entities, relationships, and themes from raw chunks, broad analysis becomes slow, expensive, and inconsistent.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move structure into the index before the user asks. Extract entities, relationships, and claims; build a graph; detect communities; and write summaries of those communities with links back to source text.',
        'A community summary is a compressed retrieval artifact. It is not a replacement for evidence, but it gives broad search a unit larger than a chunk and more organized than a raw top-k list.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Indexing starts with documents and text units. An extraction step identifies entities, relationships, claims, source spans, and metadata, then entity resolution merges aliases that refer to the same real object.',
        'The graph stores entities as nodes and relationships or claims as edges or attached records. Community detection groups densely connected parts of the graph, and a generation step writes a report for each community.',
        'At query time, global search retrieves relevant community reports and reduces partial answers. Local search starts from entities and neighborhoods, while DRIFT-style search combines broad community context with focused follow-up retrieval.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'GraphRAG works when graph structure captures information that embedding similarity alone misses. Repeated actors, dependencies, incidents, organizations, and themes become connected objects rather than isolated text chunks.',
        'The correctness argument is provenance. A community report is usable only when its statements can be traced back to extracted claims and source spans, and final answers should cite or check those sources before presenting exact claims.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'GraphRAG pays more at indexing time. Extraction, entity resolution, graph construction, community detection, report generation, and evaluation all add compute and model cost before any query arrives.',
        'The cost can be worth it for stable corpora with repeated global questions. It is often wasteful for tiny corpora, fast-changing documents, or workloads dominated by exact lookup where top-k chunk retrieval already works.',
        'Updates are expensive because one changed document can alter entities, edges, communities, and summaries. Access control is also harder because permissions must apply to raw text, graph records, summaries, and final answers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'GraphRAG fits enterprise knowledge bases, incident archives, investigative document sets, policy libraries, legal discovery, market research, support tickets, and scientific literature review. These corpora often ask for patterns across many records.',
        'An engineering organization can use it to ask which coordination failures recur across payment incidents. Vector RAG may retrieve one incident report, while GraphRAG can surface communities around ownership, rollout controls, alerts, dependencies, and mitigations.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the extracted graph is treated as objective truth. Entity extraction can miss names, merge different people, invent relationships, or produce summaries that sound fluent but lack source support.',
        'It also fails when summaries answer audit-heavy questions without returning to evidence. Community reports are good orientation layers, but exact claims still need source spans and freshness checks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose 1,000 incident reports are split into 20,000 chunks. Plain vector search for recurring payment failures retrieves 20 chunks, of which 8 mention deploys, 5 mention alerts, and 4 mention ownership, but the pattern is left for the model to infer from a small sample.',
        'GraphRAG extracts 6,000 entities and 18,000 relationships, then detects 40 communities. One community report covers payment deploys, alert routing, and rollback ownership across 73 source chunks, so the global answer starts from an organized subgraph instead of a random top-k pile.',
        'If each query would otherwise stuff 20 chunks of 500 tokens, that is 10,000 context tokens per broad query. A 900-token community report plus five cited source chunks may cost fewer tokens while preserving the evidence path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary references are the Microsoft GraphRAG paper at https://arxiv.org/abs/2404.16130, the GraphRAG docs at https://microsoft.github.io/graphrag/, the GraphRAG repository at https://github.com/microsoft/graphrag, the Microsoft Research project page at https://www.microsoft.com/en-us/research/project/graphrag/, and DRIFT search documentation at https://microsoft.github.io/graphrag/query/drift_search/.',
        'Study RAG pipelines, embeddings, HNSW, Leiden and Louvain community detection, GraphBLAS, entity resolution, prompt injection defenses, authorization systems, and evaluation golden sets next. The central habit is to separate retrieval structure from evidence truth.',
      ],
    },
  ],
};
