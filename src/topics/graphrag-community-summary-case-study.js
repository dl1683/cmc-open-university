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
      heading: 'Why this exists',
      paragraphs: [
        `Ordinary vector RAG is good at finding passages similar to a question. It is weaker when the question asks for structure across a whole corpus: main themes, recurring risks, common actors, hidden clusters, or relationships that appear across many documents. There may be no single nearest chunk that answers the question.`,
        `GraphRAG exists to move more organization into the index before the user asks. It extracts entities, relationships, and claims from text, builds a graph, detects communities, writes community reports, and then uses those reports and graph neighborhoods during retrieval. The goal is not to replace source evidence. The goal is to create a retrieval surface for broad questions that chunk search alone handles poorly.`,
        {type:`callout`, text:`GraphRAG moves structure into the index: entities, relationships, communities, and summaries become retrieval artifacts before the query arrives.`},
        {type:`image`, src:`https://upload.wikimedia.org/wikipedia/commons/8/82/Louvain_Step2.png`, alt:`Network graph with nodes grouped into colored communities.`, caption:`Louvain community detection step. Wikimedia Commons, Louvain_Step2.png.`},
      ],
    },
    {
      heading: 'The naive approach and why it fails',
      paragraphs: [
        `The obvious approach is to split documents into chunks, embed the chunks, retrieve the top k, and ask the model to answer. That works for narrow factual questions when the needed passage is close to the query in embedding space. It breaks down for global questions because the answer is distributed. Ten relevant passages may each contain one small piece, and the most representative passage may not exist.`,
        `Another naive fix is to increase k and stuff more chunks into context. That raises cost and still gives the model an unordered pile. It may miss cross-document patterns, overweight repeated wording, or produce a summary from whichever chunks happen to fit. GraphRAG pays indexing cost so query time can use graph structure instead of raw proximity alone.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `GraphRAG treats the corpus as a graph-shaped memory, not just a bag of chunks. Entities become nodes. Relationships become edges. Claims and source spans preserve evidence. Community detection groups related parts of the graph. Community summaries compress those groups into natural-language reports that can answer broad questions more directly than raw chunks can.`,
        `This is a data-structure choice. RAPTOR builds a hierarchy of chunk summaries. LightRAG keeps graph and vector retrieval paths active together. GraphRAG builds an entity graph and a community-report hierarchy. All three designs move some reasoning into indexing, but GraphRAG makes relationships and communities first-class artifacts.`,
      ],
    },
    {
      heading: 'How the index is built',
      paragraphs: [
        `Indexing starts with documents and text units, just like a normal RAG pipeline. The next step is extraction. An LLM or extraction system identifies entities, relationships, and claims from each text unit. Those records should keep source ids, spans, document metadata, and confidence or quality signals, because later summaries will depend on them.`,
        `The extracted records are assembled into a graph. Entity resolution merges aliases and duplicate nodes. Edge weights may represent co-occurrence, extracted relationship strength, or repeated evidence. Community detection, often with algorithms such as Leiden or Louvain, groups densely connected entities. Then another generation pass writes reports for each community, ideally with citations back to the text units that support the claims.`,
      ],
    },
    {
      heading: 'Community summaries',
      paragraphs: [
        `Community summaries are the compression layer. A community report might describe a group of entities, the recurring relationships among them, major claims, internal contradictions, and source-backed examples. That report gives global search a useful unit of retrieval: not one raw passage, but a synthesized view of a related subgraph.`,
        `The danger is summary drift. If extraction misses an entity, entity resolution merges the wrong names, community detection cuts through the wrong boundary, or the report invents unsupported claims, every query using that report inherits the error. A production GraphRAG index needs provenance and audit paths from report sentence to source text.`,
      ],
    },
    {
      heading: 'Query modes',
      paragraphs: [
        `Global search is the signature mode. It selects relevant community reports, asks each report for a partial answer, and reduces those partial answers into a final response. This map-reduce shape is useful for questions such as "What are the main risks across these documents?" because the system already has a summary hierarchy.`,
        `Local search starts from entities. For a question about a person, project, product, or incident, the system retrieves the entity record, neighboring relationships, source text, and related community context. DRIFT combines the two styles: use broader community context to generate focused follow-up questions, then run local retrieval for those subquestions before synthesizing.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The indexing visual proves that GraphRAG is not a single vector table. Documents become chunks, chunks feed extraction, extraction creates nodes, edges, and claims, and communities produce reports. Each layer adds retrieval power and also adds a place where errors can enter.`,
        `The query visual proves that the right retrieval path depends on the question. Broad synthesis should not be forced through one nearest passage. Entity lookup should not rely only on community summaries. DRIFT exists because many questions need both: enough global context to know what to ask next, and enough local evidence to stay grounded.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `GraphRAG works when graph structure is more informative than text similarity alone. If a corpus contains recurring actors, organizations, incidents, dependencies, or themes, community detection can reveal groups that a raw embedding search may not surface. Community reports then turn those groups into compact retrieval units.`,
        `It also works because it shifts repeated synthesis out of the hot path. Instead of asking every query to rediscover the corpus structure from chunks, the system precomputes some of that structure during indexing. Query time can spend more budget comparing relevant reports, traversing neighborhoods, and checking source evidence.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The cost is real. GraphRAG performs extraction, entity resolution, graph construction, community detection, report generation, and quality checks before query time. That may be worth it for stable corpora and global analysis, but it is expensive for tiny corpora, frequently changing documents, or workloads dominated by exact lookup.`,
        `GraphRAG also has operational tradeoffs. Updates can invalidate reports. Access control has to apply to text units, graph records, and summaries. Prompt injection defenses still matter because retrieved source text may contain hostile instructions. Evaluation has to score extraction, retrieval, summary support, final answer faithfulness, latency, and cost separately.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `GraphRAG is useful for enterprise knowledge bases, incident archives, investigative document sets, policy libraries, support ticket corpora, legal discovery, market research, and scientific literature review. These are settings where users often ask for patterns across many records, not only facts from one page.`,
        `For example, an engineering organization may have years of incident reports, Slack exports, deployment notes, and service documents. Vector RAG can answer "what happened in incident INC-742?" if it retrieves that report. GraphRAG is better suited to "what recurring coordination failures appear across payment incidents?" because the graph can surface communities around ownership, dependencies, alerts, rollout controls, and mitigation patterns.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Do not treat the graph as objective truth. It is an extracted index, often built with LLM calls. It can contain duplicate entities, hallucinated relationships, missing claims, stale communities, unsupported reports, and broken source links. A fluent community summary can be less reliable than a dull raw passage if it lacks provenance.`,
        `The worst production mistake is to answer audit-heavy questions from summaries alone. Community reports are good for orientation and synthesis, but exact claims need source text. A second mistake is to benchmark only final answer style. A proper evaluation set should check whether the right entities were extracted, whether relationships are supported, whether retrieval found the needed evidence, and whether the final answer cites what it says.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Microsoft GraphRAG paper at https://arxiv.org/abs/2404.16130, GraphRAG docs at https://microsoft.github.io/graphrag/, Microsoft GraphRAG GitHub repository at https://github.com/microsoft/graphrag, Microsoft Research project page at https://www.microsoft.com/en-us/research/project/graphrag/, GraphRAG overview blog at https://www.microsoft.com/en-us/research/blog/graphrag-new-tool-for-complex-data-discovery-now-on-github/, DRIFT blog at https://www.microsoft.com/en-us/research/blog/introducing-drift-search-combining-global-and-local-search-methods-to-improve-quality-and-efficiency/, local search docs at https://microsoft.github.io/graphrag/query/local_search/, and DRIFT docs at https://microsoft.github.io/graphrag/query/drift_search/.`,
        `Study RAG Pipeline, Multi-Index RAG, Leiden & Louvain Community Detection, GraphBLAS Sparse Matrix Graph Case Study, Compressed Sparse Row Graph, Embeddings & Similarity, HNSW, LightRAG Dual-Level Retrieval Case Study, Prompt Injection Threat Model, Zanzibar Authorization Case Study, and LLM Evaluation Golden Sets next.`,
      ],
    },
  ],
};
