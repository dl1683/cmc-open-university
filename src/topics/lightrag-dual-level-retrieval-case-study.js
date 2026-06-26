// LightRAG: graph-enhanced text indexing with vector retrieval over chunks,
// entities, and relationships, plus local/global/hybrid query modes.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'lightrag-dual-level-retrieval-case-study',
  title: 'LightRAG Dual-Level Retrieval Case Study',
  category: 'Papers',
  summary: 'A graph-plus-vector RAG architecture: extract entities and relationships, store chunks, vectors, and graph records, then retrieve local and global context efficiently.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['index and storage', 'query modes'], defaultValue: 'index and storage' },
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
      { id: 'docs', label: 'docs', x: 0.7, y: 3.6, note: 'corpus' },
      { id: 'chunks', label: 'chunks', x: 2.2, y: 2.0, note: 'text' },
      { id: 'extract', label: 'extract', x: 2.2, y: 5.2, note: 'LLM' },
      { id: 'entities', label: 'entities', x: 4.0, y: 4.3, note: 'nodes' },
      { id: 'relations', label: 'relations', x: 4.0, y: 6.0, note: 'edges' },
      { id: 'vectors', label: 'vectors', x: 5.8, y: 2.0, note: 'semantic' },
      { id: 'graph', label: 'graph DB', x: 5.8, y: 5.1, note: 'structure' },
      { id: 'kv', label: 'KV', x: 7.3, y: 3.0, note: 'artifacts' },
      { id: 'query', label: 'query', x: 9.2, y: 4.2, note: 'modes' },
    ],
    edges: [
      { id: 'e-docs-chunks', from: 'docs', to: 'chunks', weight: 'split' },
      { id: 'e-docs-extract', from: 'docs', to: 'extract', weight: 'parse' },
      { id: 'e-extract-entities', from: 'extract', to: 'entities', weight: 'names' },
      { id: 'e-extract-relations', from: 'extract', to: 'relations', weight: 'links' },
      { id: 'e-chunks-vectors', from: 'chunks', to: 'vectors', weight: 'embed' },
      { id: 'e-entities-vectors', from: 'entities', to: 'vectors', weight: 'embed' },
      { id: 'e-relations-vectors', from: 'relations', to: 'vectors', weight: 'embed' },
      { id: 'e-entities-graph', from: 'entities', to: 'graph', weight: 'upsert' },
      { id: 'e-relations-graph', from: 'relations', to: 'graph', weight: 'upsert' },
      { id: 'e-vectors-kv', from: 'vectors', to: 'kv', weight: 'ids' },
      { id: 'e-graph-kv', from: 'graph', to: 'kv', weight: 'records' },
      { id: 'e-kv-query', from: 'kv', to: 'query' },
    ],
  }, { title });
}

function queryGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.7, y: 3.5, note: 'intent' },
      { id: 'local', label: 'local', x: 2.5, y: 1.7, note: 'entity' },
      { id: 'global', label: 'global', x: 2.5, y: 3.5, note: 'theme' },
      { id: 'naive', label: 'naive', x: 2.5, y: 5.3, note: 'chunks' },
      { id: 'graphctx', label: 'graph ctx', x: 4.8, y: 2.4, note: 'entities + rels' },
      { id: 'chunkctx', label: 'chunk ctx', x: 4.8, y: 5.0, note: 'text' },
      { id: 'merge', label: 'mix', x: 7.0, y: 3.6, note: 'dedupe' },
      { id: 'answer', label: 'answer', x: 9.0, y: 3.6, note: 'cited' },
    ],
    edges: [
      { id: 'e-query-local', from: 'query', to: 'local' },
      { id: 'e-query-global', from: 'query', to: 'global' },
      { id: 'e-query-naive', from: 'query', to: 'naive' },
      { id: 'e-local-graphctx', from: 'local', to: 'graphctx', weight: 'nearby facts' },
      { id: 'e-global-graphctx', from: 'global', to: 'graphctx', weight: 'themes' },
      { id: 'e-naive-chunkctx', from: 'naive', to: 'chunkctx', weight: 'vector chunks' },
      { id: 'e-graphctx-merge', from: 'graphctx', to: 'merge' },
      { id: 'e-chunkctx-merge', from: 'chunkctx', to: 'merge' },
      { id: 'e-merge-answer', from: 'merge', to: 'answer' },
    ],
  }, { title });
}

function* indexAndStorage() {
  yield {
    state: indexGraph('LightRAG indexes text as graph plus vectors'),
    highlight: { active: ['docs', 'chunks', 'extract', 'e-docs-chunks', 'e-docs-extract'], compare: ['vectors', 'graph'] },
    explanation: 'LightRAG keeps two retrieval levels alive. It indexes ordinary chunks for semantic lookup, then extracts graph records so entity neighborhoods and relationship context can be retrieved too.',
  };

  yield {
    state: indexGraph('Entities and relationships become searchable objects'),
    highlight: { active: ['extract', 'entities', 'relations', 'graph', 'vectors', 'e-extract-entities', 'e-extract-relations', 'e-entities-graph', 'e-relations-graph', 'e-entities-vectors', 'e-relations-vectors'], found: ['chunks'] },
    explanation: 'The graph records are searchable evidence objects, not decorative metadata. Entity and relationship records can be embedded, ranked, expanded, and traced back to source chunks.',
    invariant: 'Graph records must trace back to source chunks; otherwise graph RAG becomes unsupported synthesis.',
  };

  yield {
    state: labelMatrix(
      'Storage roles in a LightRAG-style deployment',
      [
        { id: 'kv', label: 'KV storage' },
        { id: 'vector', label: 'vector storage' },
        { id: 'graph', label: 'graph storage' },
        { id: 'status', label: 'doc status' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'risk', label: 'risk if weak' },
      ],
      [
        ['chunks and LLM artifacts', 'lost provenance'],
        ['chunk/entity/relation vectors', 'semantic miss'],
        ['nodes and edges', 'broken context'],
        ['ingest progress', 'stale index'],
      ],
    ),
    highlight: { active: ['kv:keeps', 'vector:keeps', 'graph:keeps', 'status:keeps'], removed: ['status:risk'] },
    explanation: 'The reference design separates storage concerns: key-value artifacts, vector indexes, graph storage, and document status. That split keeps provenance, retrieval, graph expansion, and freshness from becoming one hidden blob.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'corpus churn', min: 0, max: 1 }, y: { label: 'operational pressure', min: 0, max: 1 } },
      series: [
        { id: 'rebuild', label: 'full rebuild cost', points: [{ x: 0.1, y: 0.25 }, { x: 0.3, y: 0.45 }, { x: 0.6, y: 0.74 }, { x: 0.9, y: 0.95 }] },
        { id: 'incremental', label: 'incremental update pressure', points: [{ x: 0.1, y: 0.14 }, { x: 0.3, y: 0.27 }, { x: 0.6, y: 0.47 }, { x: 0.9, y: 0.68 }] },
      ],
    }),
    highlight: { active: ['incremental'], compare: ['rebuild'] },
    explanation: 'LightRAG emphasizes incremental updates because graph-enhanced indexes are expensive to rebuild from scratch. The faster the corpus changes, the more index freshness becomes a first-class system problem.',
  };
}

function* queryModes() {
  yield {
    state: queryGraph('LightRAG exposes several retrieval modes'),
    highlight: { active: ['query', 'local', 'global', 'naive', 'e-query-local', 'e-query-global', 'e-query-naive'], compare: ['merge'] },
    explanation: 'The query path chooses a retrieval contract before ranking context. Local mode starts near named entities, global mode searches for broader relation patterns, naive mode keeps flat chunk retrieval, and mixed mode reconciles graph and text evidence.',
  };

  yield {
    state: labelMatrix(
      'Mode selection',
      [
        { id: 'local', label: 'local' },
        { id: 'global', label: 'global' },
        { id: 'hybrid', label: 'hybrid' },
        { id: 'naive', label: 'naive' },
        { id: 'mix', label: 'mix' },
      ],
      [
        { id: 'best for', label: 'best for' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['specific entities', 'entity extraction errors'],
        ['broad themes', 'summary drift'],
        ['both graph levels', 'more context'],
        ['plain chunk RAG', 'missed relations'],
        ['graph plus chunks', 'latency and dedupe'],
      ],
    ),
    highlight: { active: ['local:best for', 'global:best for', 'mix:best for'], compare: ['naive:watch'] },
    explanation: 'The mode labels describe what can fail. Local mode depends on entity extraction, global mode depends on relationship summaries, naive mode can miss structure, and mixed mode pays extra ranking and dedupe cost.',
  };

  yield {
    state: queryGraph('Mixed retrieval reconciles graph context and chunk text'),
    highlight: { active: ['graphctx', 'chunkctx', 'merge', 'answer', 'e-graphctx-merge', 'e-chunkctx-merge', 'e-merge-answer'], found: ['local', 'global', 'naive'] },
    explanation: 'The graph can explain relationships, while raw chunks preserve exact wording and source evidence. A robust answer path merges, dedupes, ranks, and cites both instead of trusting one representation.',
  };

  yield {
    state: labelMatrix(
      'LightRAG versus related RAG structures',
      [
        { id: 'flat', label: 'flat RAG' },
        { id: 'raptor', label: 'RAPTOR' },
        { id: 'graphrag', label: 'GraphRAG' },
        { id: 'lightrag', label: 'LightRAG' },
      ],
      [
        { id: 'index shape', label: 'index shape' },
        { id: 'main cost', label: 'main cost' },
      ],
      [
        ['chunks + vectors', 'context miss'],
        ['summary tree', 'summary rebuilds'],
        ['community graph summaries', 'offline extraction'],
        ['graph + vectors + updates', 'storage orchestration'],
      ],
    ),
    highlight: { active: ['lightrag:index shape'], compare: ['flat:index shape', 'raptor:index shape', 'graphrag:index shape'] },
    explanation: 'LightRAG is best understood as a bridge between ordinary vector RAG and heavier graph-summary systems. It keeps graph structure and vector retrieval active at the same time.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'index and storage') yield* indexAndStorage();
  else if (view === 'query modes') yield* queryModes();
  else throw new InputError('Pick a LightRAG view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as the state machine for LightRAG dual-level retrieval. Active items are the current decision point, found items are committed results, and removed items are paths ruled out by the invariant. The first safe inference is to name what state changed and why that move is legal.',
        {type: 'callout', text: 'LightRAG makes graph facts and vector chunks peer indexes, then forces both layers back to source provenance before evidence reaches the model.'},
        'This topic is a case study, so the visual is not decoration. It shows which records, counters, queues, maps, or gates must agree before the system can return a trustworthy result.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'LightRAG dual-level retrieval exists because a simple implementation works on a small example but fails when scale, latency, privacy, or correctness constraints arrive. The system needs a data structure that keeps the useful fast path without hiding the boundary conditions.',
        'The practical problem is not only speed. Cost, auditability, rollback, freshness, and slice-level behavior all affect whether the design is usable in production.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep one global rule, one score, one cache, one dashboard, or one list. That is easy to build and easy to explain. It often works until traffic shape or correctness requirements become more specific.',
        'The next obvious approach is to add capacity or widen the search. That may improve the average case, but it usually fails to encode the rule that decides which work is allowed, fresh, fair, or safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the missing boundary. A system can look correct globally while a narrow slice is wrong, stale, unfair, or too expensive. Once the boundary is missing, more throughput can make the failure faster.',
        'The concrete failure is usually visible as mixed state: one version reads another version cache, one user receives another user answer, one queue loses priority, or one metric hides a failing slice. The design needs an invariant that prevents that mixture.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make the boundary a first-class data structure in LightRAG dual-level retrieval. Keys, clocks, queues, ledgers, folds, or gates are not metadata; they are the mechanism that preserves correctness.',
        'The invariant should be checkable from stored state. If an operator cannot reconstruct why a result was allowed, denied, filled, scored, or rolled back, the system is relying on memory instead of design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The mechanism starts by normalizing the input into records with stable identities. It then routes those records through the smallest structure that can answer the current decision: a map lookup, ordered queue, version gate, slice table, or witness search.',
        'Each step writes enough state for the next step to be local. Local means a cancel finds one order id, a cache gate checks one record, a rollout query joins one packet id, or a checker advances one legal candidate. That locality is what turns a broad problem into an executable workflow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is preservation. Before a step, the invariant names which records may interact. The step reads only allowed state, writes the result, and leaves the invariant true for the next step.',
        'This is stronger than a dashboard claim. A dashboard can show an average after the fact; the invariant prevents an illegal result from being served in the first place. When the invariant fails, the system should produce a denial, rollback, miss, or counterexample instead of a quiet answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is extra state. Maps, ledgers, clocks, slice tags, fold maps, queues, and audit rows consume memory and engineering time. The payoff is that expensive work becomes targeted instead of global.',
        'Cost behaves with the number of records, versions, slices, or live candidates. Doubling traffic does not only double compute; it can double cache pressure, queue length, audit rows, or search width. The dominant operation is the one on the hot path for the real workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'LightRAG dual-level retrieval fits systems where correctness is operational, not just mathematical. Fraud models, retrieval systems, matching engines, model-serving stacks, evaluation gates, and rollout systems all need stored evidence for why one result was chosen.',
        'The access pattern determines fit. Repeated decisions benefit from maps and caches, ordered fairness needs queues and sequence numbers, release safety needs ledgers, and concurrent correctness needs histories that can be searched.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the boundary is chosen for convenience instead of the product promise. Random folds fail for time-forward prediction, global canaries fail for slice-specific regressions, and similarity search fails when authorization is the real question.',
        'It also fails when evidence is not versioned. A stale record can be more dangerous than a miss because it looks supported. The design needs no-store, deny, rollback, or human-review paths for cases outside the invariant.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a policy corpus has 10000 chunks, 1800 entities, and 5200 edges. A user asks which vendor obligations changed after the new data-retention policy. Flat vector search returns five retention chunks but misses two vendor addenda with different wording.',
        'Mixed retrieval finds the policy node, expands one hop to obligations and vendors, retrieves 35 graph-linked chunks, merges them with 20 vector chunks, and reranks to 8 cited passages. Cost rises from one vector search to vector plus graph expansion, but recall improves because the addenda are reached by relation.',
        'The answer is allowed only if each changed obligation points back to a chunk id. If an edge says Vendor B has a 30-day deletion duty but no source chunk supports it, that edge is excluded or flagged.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: LightRAG paper at https://arxiv.org/abs/2410.05779, official repository at https://github.com/HKUDS/LightRAG, project page at https://lightrag.github.io/, and ACL PDF at https://aclanthology.org/2025.findings-emnlp.568.pdf. Study RAG Pipeline, GraphRAG Community Summary Case Study, RAPTOR Hierarchical Retrieval Case Study, HNSW, Reciprocal Rank Fusion, and RAG Evaluation next.',
      ],
    },
  ],
};
