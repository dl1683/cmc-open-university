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
      heading: 'What it is',
      paragraphs: [
        'Filtered vector search combines semantic nearest-neighbor search with hard metadata predicates. A query might need the nearest contract clause only within tenant A, visible to user U, in English, created after 2024, not tombstoned, and tagged as a motion. The vector distance is soft ranking; the filter is correctness.',
        'The data-structure problem is that approximate nearest-neighbor graphs are built for geometry, while filters are sets. If the system searches the global vector graph and filters only the first few results afterward, recall can collapse. If it ignores filters, it can leak data. A practical design brings compressed bitsets, metadata indexes, ANN traversal, and reranking into the same retrieval plan.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A metadata filter is compiled into an allowed-id set. For simple fields this can be a posting list or Roaring bitmap. The engine intersects tenant, ACL, type, freshness, language, and deletion bitmaps to create a candidate set. During ANN traversal, vector candidates are tested against that set before entering the result heap. The search may continue past the usual stopping point until enough allowed candidates are found.',
        'Filter-aware systems go further. Filtered-DiskANN-style approaches build graphs that account for labels and use search procedures that respect filters natively. Other systems use adaptive beam widths, exact fallback for tiny candidate sets, partitioned indexes for common tenants, or hybrid retrieval that fuses BM25, vector, and metadata constraints.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Post-filtering is cheap but can be wrong. Pre-filtering is safe but can starve the graph if the allowed set is tiny or fragmented. Native filtered ANN can improve recall and latency for repeated labels, but it adds index-build complexity, update complexity, and memory overhead. The right design depends on filter selectivity, label distribution, update rate, and whether filters are security-critical.',
        'Compressed bitsets make the metadata side practical. A Roaring bitmap can represent millions of allowed ids compactly and intersect filters quickly. But the vector side still needs careful stopping rules; returning five allowed neighbors after visiting only five global neighbors is not enough.',
      ],
    },
    {
      heading: 'Complete case study: matter-scoped legal RAG',
      paragraphs: [
        'A legal RAG assistant searches a firm-wide corpus. The best semantic match to a user question belongs to a different matter and is sealed. A naive vector search retrieves it at rank 1 and drops it after top-k filtering, leaving a weak answer. A worse system accidentally includes it in the prompt. Both designs fail.',
        'A filtered design first intersects matter id, user ACL, document type, date, and tombstone bitmaps. ANN traversal then searches with membership checks and continues until it has enough allowed candidates for a cross-encoder reranker. The final prompt receives only matter-scoped, visible documents, and the evaluator can report recall under the same filters the product enforces.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest trap is treating filters as cosmetic UI facets. Tenant, ACL, legal hold, deletion, and freshness filters are part of the security and correctness model. Another trap is measuring unfiltered ANN recall on a benchmark and assuming filtered product recall will match. Filter selectivity changes the search problem.',
        'Do not assume one index layout handles every predicate. Common coarse filters may deserve partitions. Rare filters may need bitset-gated search or exact fallback. Range filters may need segment trees, sorted indexes, or specialized ANN research. Filtered vector search is where database indexing and vector indexing stop being separate subjects.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Filtered-DiskANN at https://dl.acm.org/doi/10.1145/3543507.3583552 and https://harsha-simhadri.org/pubs/Filtered-DiskANN23.pdf, HNSW at https://arxiv.org/abs/1603.09320, DiskANN at https://papers.nips.cc/paper/9527-rand-nsg-fast-accurate-billion-point-nearest-neighbor-search-on-a-single-node, and Roaring bitmaps at https://arxiv.org/abs/1603.06549. Study Roaring Bitmaps, HNSW Search, DiskANN SSD Vector Search, Database Indexing, Zanzibar Authorization, RAG Pipeline, Multi-Index RAG, ANN Recall-Latency Pareto Ledger, and Citation Span Index next.',
      ],
    },
  ],
};
