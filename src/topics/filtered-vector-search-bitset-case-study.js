// Filtered vector search: combine metadata bitsets with ANN search so ACL,
// tenant, date, and type filters do not destroy recall or leak documents.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'filtered-vector-search-bitset-case-study',
  title: 'Filtered Vector Search and Bitset Gates',
  category: 'AI & ML',
  summary: 'Use compressed metadata bitsets with ANN traversal so semantic search respects tenant, ACL, type, and freshness filters.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pre vs post filter', 'bitset search'], defaultValue: 'pre vs post filter' },
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

function filteredGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query', x: 0.75, y: 3.2, note: 'vector' },
      { id: 'meta', label: 'filter', x: 2.2, y: 1.9, note: 'tenant' },
      { id: 'bitset', label: 'bitset', x: 3.7, y: 1.9, note: 'ids' },
      { id: 'ann', label: 'ANN', x: 2.2, y: 4.55, note: 'graph' },
      { id: 'beam', label: 'beam', x: 4.05, y: 4.55, note: 'cands' },
      { id: 'gate', label: 'gate', x: 5.75, y: 3.2, note: 'allow?' },
      { id: 'rerank', label: 'rerank', x: 7.35, y: 3.2, note: 'exact' },
      { id: 'topk', label: 'top-k', x: 8.85, y: 3.2, note: 'safe' },
    ],
    edges: [
      { id: 'e-query-ann', from: 'query', to: 'ann' },
      { id: 'e-query-meta', from: 'query', to: 'meta' },
      { id: 'e-meta-bitset', from: 'meta', to: 'bitset' },
      { id: 'e-ann-beam', from: 'ann', to: 'beam' },
      { id: 'e-bitset-gate', from: 'bitset', to: 'gate' },
      { id: 'e-beam-gate', from: 'beam', to: 'gate' },
      { id: 'e-gate-rerank', from: 'gate', to: 'rerank' },
      { id: 'e-rerank-topk', from: 'rerank', to: 'topk' },
    ],
  }, { title });
}

function* preVsPostFilter() {
  yield {
    state: filteredGraph('A vector query often has hard metadata filters'),
    highlight: { active: ['query', 'meta'], found: ['bitset'] },
    explanation: 'A user rarely asks for nearest vectors across the whole world. They ask within one tenant, permission set, document type, language, region, freshness window, or legal matter. Those filters are correctness constraints, not optional ranking hints.',
  };

  yield {
    state: labelMatrix(
      'Post-filtering can lose recall',
      [
        { id: 'r1', label: 'rank 1' },
        { id: 'r2', label: 'rank 2' },
        { id: 'r3', label: 'rank 3' },
        { id: 'r4', label: 'rank 4' },
        { id: 'r5', label: 'rank 5' },
      ],
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'dist', label: 'dist' },
        { id: 'post', label: 'post filt' },
      ],
      [
        ['B', '0.10', 'drop'],
        ['B', '0.12', 'drop'],
        ['C', '0.15', 'drop'],
        ['A', '0.20', 'keep'],
        ['B', '0.21', 'drop'],
      ],
    ),
    highlight: { removed: ['r1:post', 'r2:post', 'r3:post', 'r5:post'], found: ['r4:post'] },
    explanation: 'If the ANN engine first finds global nearest neighbors and only filters after top-k, the returned list may be empty or thin. The nearest allowed document might be rank 80 globally, so it never reaches the post-filter stage.',
    invariant: 'Filtering after a tiny top-k is a recall bug.',
  };

  yield {
    state: filteredGraph('Pre-filtering restricts candidates before scoring'),
    highlight: { active: ['meta', 'bitset', 'gate'], compare: ['ann', 'beam'], found: ['topk'] },
    explanation: 'A metadata index can build a candidate bitset first: tenant A AND visible_to_user AND doc_type:contract AND not tombstoned. ANN traversal then checks membership while expanding or uses a filter-aware graph built for those labels.',
  };

  yield {
    state: labelMatrix(
      'Filtering strategies',
      [
        { id: 'post', label: 'post filt' },
        { id: 'pre', label: 'pre filt' },
        { id: 'native', label: 'native ANN' },
        { id: 'hybrid', label: 'hybrid' },
      ],
      [
        { id: 'move', label: 'main move' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['filter top-k', 'low recall'],
        ['bitset gate', 'small sets'],
        ['filter graph', 'build cost'],
        ['adapt beam', 'complexity'],
      ],
    ),
    highlight: { removed: ['post:risk'], active: ['pre:move', 'native:move', 'hybrid:move'] },
    explanation: 'There is no single universal plan. Small filters may need exact fallback. Large filters may work well with a bitset gate. Repeated labels can justify native filtered ANN indexes such as Filtered-DiskANN-style graphs.',
  };

  yield {
    state: filteredGraph('Correctness and retrieval quality meet at the gate'),
    highlight: { active: ['gate', 'rerank', 'topk'], found: ['bitset'], compare: ['beam'] },
    explanation: 'The gate must be both safe and recall-aware. It blocks disallowed candidates, but the search policy must keep exploring until it finds enough allowed candidates for reranking.',
  };
}

function* bitsetSearch() {
  yield {
    state: labelMatrix(
      'Metadata filters become set algebra',
      [
        { id: 'tenant', label: 'tenant A' },
        { id: 'acl', label: 'ACL ok' },
        { id: 'fresh', label: 'fresh' },
        { id: 'type', label: 'contract' },
      ],
      [
        { id: 'set', label: 'set ids' },
        { id: 'op', label: 'op' },
      ],
      [
        ['{1,4,7,9}', 'AND'],
        ['{4,5,7,8}', 'AND'],
        ['{2,4,7,9}', 'AND'],
        ['{3,4,7}', 'AND'],
      ],
    ),
    highlight: { active: ['tenant:op', 'acl:op', 'fresh:op', 'type:op'], found: ['acl:set'] },
    explanation: 'Before vector scoring, metadata filters can be compiled into compressed integer sets. Roaring bitmaps are a natural fit because intersection is fast and the result remains compressed.',
  };

  yield {
    state: labelMatrix(
      'Intersected candidate bitset',
      [
        { id: 'id1', label: 'doc 1' },
        { id: 'id4', label: 'doc 4' },
        { id: 'id7', label: 'doc 7' },
        { id: 'id9', label: 'doc 9' },
      ],
      [
        { id: 'tenant', label: 'tenant' },
        { id: 'acl', label: 'ACL' },
        { id: 'fresh', label: 'fresh' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['yes', 'no', 'no', 'drop'],
        ['yes', 'yes', 'yes', 'keep'],
        ['yes', 'yes', 'yes', 'keep'],
        ['yes', 'no', 'yes', 'drop'],
      ],
    ),
    highlight: { found: ['id4:keep', 'id7:keep'], removed: ['id1:keep', 'id9:keep'] },
    explanation: 'The filter result is an allowed-id set. ANN traversal can test whether a visited vector id is allowed, prioritize allowed candidates, or fall back to exact search if the allowed set is tiny.',
  };

  yield {
    state: filteredGraph('ANN search probes with bitset membership checks'),
    highlight: { active: ['ann', 'beam', 'gate', 'bitset'], found: ['rerank'] },
    explanation: 'During graph search, the engine expands neighbors by vector distance but only admits ids that pass the bitset gate into the result set. Some systems also let disallowed nodes act as routing bridges while preventing them from being returned.',
    invariant: 'A disallowed node may be useful for navigation, but it cannot be an answer.',
  };

  yield {
    state: labelMatrix(
      'Complete case: legal matter search',
      [
        { id: 'scope', label: 'matter' },
        { id: 'acl', label: 'priv' },
        { id: 'date', label: 'date' },
        { id: 'kind', label: 'kind' },
      ],
      [
        { id: 'filter', label: 'filter' },
        { id: 'why', label: 'why' },
      ],
      [
        ['M-204', 'right case'],
        ['not sealed', 'no leak'],
        ['2024+', 'fresh law'],
        ['motion', 'task fit'],
      ],
    ),
    highlight: { active: ['scope:filter', 'acl:filter', 'date:filter', 'kind:filter'], found: ['acl:why'] },
    explanation: 'Case study: a legal assistant searches motions for one matter. The vector nearest neighbor from another matter may be semantically perfect, but returning it would be a data leak. Filtered vector search makes access control part of retrieval, not an afterthought.',
  };

  yield {
    state: filteredGraph('Filtered retrieval feeds RAG and reranking safely'),
    highlight: { active: ['bitset', 'gate', 'rerank', 'topk'], found: ['query'], compare: ['ann'] },
    explanation: 'The final reranker should see only allowed candidates, with enough recall to be useful. That requires the vector index, metadata index, and security model to cooperate as one data structure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pre vs post filter') yield* preVsPostFilter();
  else if (view === 'bitset search') yield* bitsetSearch();
  else throw new InputError('Pick a filtered vector search view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Vector search rarely means search the whole corpus. A user asks for the closest passage inside one tenant, one legal matter, one permission boundary, one language, one document type, one date range, or one product catalog slice. The vector distance is a ranking signal. The filter is often a correctness rule. If a RAG system retrieves a semantically perfect document from the wrong tenant, the result is not a better answer. It is a data leak.',
        'Filtered vector search exists because semantic indexes and database predicates solve different parts of the problem. Approximate nearest-neighbor indexes organize points by geometry. Metadata filters organize ids by set membership. A production query needs both: find near vectors, but only among documents the user is allowed to see and the task actually wants. The design problem is to combine those structures without destroying recall, latency, or security.',
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The tempting design is post-filtering. Ask the ANN index for the global top-k nearest vectors, then discard results that do not match tenant, ACL, date, type, or deletion filters. It is simple, it is easy to add after an existing vector search endpoint, and it works when the allowed documents are common near the query. Many prototypes start here because it separates the vector engine from the metadata database.',
        'The wall is selectivity. If the nearest allowed document is rank 80 globally and the system only fetches 10 global candidates, post-filtering can return nothing even though good allowed matches exist. Increasing global k helps until it becomes slow or still misses rare filters. Worse, if access control is applied after retrieval but before prompt construction by loosely connected code, a bug can expose disallowed text. Filtering after a tiny top-k is a recall bug; filtering after an unsafe boundary is a security bug.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is to turn metadata predicates into an allowed-id set and make ANN search aware of that set. Tenant A AND visible_to_user AND doc_type:contract AND not_tombstoned can become a compressed bitmap, posting list, or other set representation. The vector engine then treats membership in that set as a gate: an id outside the set may not be returned, no matter how close it is in embedding space.',
        'That gate is not enough by itself. Approximate search uses routing structure, such as an HNSW graph or DiskANN-style graph, to reach promising neighborhoods without scanning every vector. Strict filters can leave the allowed nodes sparse or disconnected in that routing structure. A good filtered system must decide whether disallowed nodes can be used for navigation, how long to keep exploring, when to widen the beam, and when to abandon ANN for exact search over the allowed set.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'The metadata side starts with set algebra. Each indexed predicate maps to a set of document ids. Tenant, ACL, freshness, language, document type, deletion status, and legal hold can each produce a bitmap. The query planner intersects those sets to produce a candidate mask. Roaring bitmaps are common for this role because they compress long id ranges and still support fast AND operations.',
        'The vector side searches by distance. During graph traversal, the engine visits candidate vector ids. The bitset gate decides which visited ids may enter the result heap. Some systems still allow disallowed nodes to act as routing bridges because blocking them completely can strand the search far from the allowed neighborhood. The invariant is simple: a disallowed node may help navigation, but it cannot be an answer.',
        'After the ANN stage, an exact distance pass or reranker should run only on allowed candidates. In RAG, that may feed a cross-encoder, a citation span selector, or a context packer. The final prompt should never be the first place where access control is enforced. The retrieval trace should record the filters, candidate count, visited count, allowed count, fallback choice, and final ids so recall and security can be audited under the same constraints the product used.',
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        'The first visual contrasts post-filtering with filter-aware search. The post-filter table shows close global neighbors being dropped because they belong to the wrong tenant. The result looks thin because the ANN engine never searched deeply enough inside the allowed set. The point is not that post-filtering is always invalid; it is that its recall depends on allowed items appearing early in the global ranking.',
        'The bitset visual shows the safer contract. Metadata filters become set intersections before scoring. ANN traversal then probes vectors while checking membership at the gate. The visual also shows why selectivity is the hard case. A large allowed bitset is easy to search through. A tiny, scattered allowed bitset can make the graph do a lot of work before it finds enough legal answers.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The correctness argument has two parts. First, the set intersection is exact for the metadata predicates it represents. If a document id is absent from tenant A, ACL ok, or not_tombstoned, it cannot appear in the final allowed set. Second, the answer heap only admits ids that pass that set test. That gives a hard guarantee about filter compliance even when vector ranking is approximate.',
        'Approximate recall is separate. The ANN search may still miss the nearest allowed vector if it stops too early or if the routing graph is poor under the filter. This is why filtered search has to measure filtered recall, not only unfiltered recall. A system can be correct about permissions and still weak at retrieval quality. The engineering target is both: no disallowed returns, and enough search effort to find high-quality allowed neighbors.',
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        'Post-filtering has low implementation cost and poor worst-case behavior under selective filters. Bitset-gated ANN adds memory for metadata indexes and adds membership checks during search, but it avoids wasting the final top-k on disallowed documents. Native filtered ANN designs, such as label-aware graph construction, can improve filtered recall for common labels, but they make builds, updates, and memory accounting harder.',
        'When the allowed set is tiny, exact search over the bitset may beat graph traversal. When the allowed set is huge, the filter may be almost free. The expensive middle is fragmented selectivity: enough allowed documents to matter, but scattered across the graph so the search needs a wider beam or more visits. Range filters add another cost because date or price predicates may need sorted indexes, segment trees, partitions, or precomputed buckets before they become a useful bitmap.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Filtered vector search wins in multi-tenant search, enterprise RAG, legal discovery, support knowledge bases, product catalogs, recommendation systems, and personal document assistants. The shared pattern is soft semantic matching inside a hard slice of the corpus. A legal assistant should search one matter and one privilege boundary. A shopping query should search items that are in stock, shippable to the user, and in the requested category. A support bot should not retrieve internal notes for a customer-facing answer.',
        'It also helps evaluation. A benchmark that only reports unfiltered ANN recall can hide the failure users feel. The product query is filtered, so the metric should be filtered recall at k, latency under the actual predicate distribution, and leak rate under adversarial permissions. The retrieval system should be tested with common filters, rare filters, and filters that make the answer set empty.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'The technique fails when metadata is stale or inconsistent with the documents. A perfect bitset gate cannot save a system where ACL updates lag behind indexing, tombstoned ids remain searchable, or duplicated documents carry different permissions. It also fails when the filter is applied differently in retrieval, reranking, context packing, and citation display. Access control has to be one contract, not a series of best-effort checks.',
        'It can also be the wrong tool for queries where the filter is more selective and more meaningful than the vector distance. If the allowed set has 20 documents, exact scoring may be simpler and more reliable. If the query is a structured database question, a normal index may answer it better than embeddings. Filtered vector search is strongest when semantic similarity matters after the hard slice has already been defined.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: Filtered-DiskANN at https://dl.acm.org/doi/10.1145/3543507.3583552 and https://harsha-simhadri.org/pubs/Filtered-DiskANN23.pdf, HNSW at https://arxiv.org/abs/1603.09320, DiskANN at https://papers.nips.cc/paper/9527-rand-nsg-fast-accurate-billion-point-nearest-neighbor-search-on-a-single-node, and Roaring bitmaps at https://arxiv.org/abs/1603.06549.',
        'Study Roaring Bitmaps for compressed set algebra, HNSW Search for graph-based ANN, DiskANN SSD Vector Search for large-vector storage, Database Indexing for predicate planning, Zanzibar Authorization for relationship-based access control, RAG Pipeline for retrieval-to-generation flow, Multi-Index RAG for fused retrievers, ANN Recall-Latency Pareto Ledger for measurement, and Citation Span Index for carrying retrieval evidence into the answer.',
      ],
    },
  ],
};
