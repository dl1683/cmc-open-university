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
    { heading: 'How to read the animation', paragraphs: [
        'Read the first view as post-filtering versus filter-aware search. A vector is a numeric representation of a document, and approximate nearest-neighbor search, or ANN, finds nearby vectors without scoring every vector exactly. Active rows are vector candidates; found rows are candidates that also pass metadata.',
        'The second view shows the bitset gate. A bitset is a compact set where bit i says whether document id i is allowed. The safe rule is: a node may help graph navigation, but it cannot become an answer unless its id is in the allowed set.',
        {type:'callout', text:'Filtered vector search is a two-index contract: geometry ranks candidates only after metadata defines the legal answer set.'},
      ] },
    { heading: 'Why this exists', paragraphs: [
        'Vector search in products usually happens inside a hard slice of data: one tenant, access-control boundary, document type, date range, or catalog category. Similarity ranks documents, but the filter defines which documents are legal to return. A close document from the wrong tenant is a leak, not a better match.',
      ] },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is post-filtering. Ask the ANN index for the global top k, then discard candidates that fail tenant, access-control, date, type, or deletion filters. This works when allowed documents are common near the query, and it is easy to bolt onto an existing vector endpoint.',
      ] },
    { heading: 'The wall', paragraphs: [
        'The wall is selectivity. If the nearest allowed document is rank 80 globally and the service fetches only 10 global candidates, post-filtering returns nothing even though a good legal answer exists. Raising k helps until latency rises or rare filters still miss.',
      ] },
    { heading: 'The core insight', paragraphs: [
        'Turn metadata predicates into an allowed-id set before accepting vector results. Tenant A AND visible_to_user AND doc_type:contract can become a compressed bitmap, posting list, or similar set. The ANN search may still navigate the graph, but answer eligibility is checked against that set.',
      ] },
    { heading: 'How it works', paragraphs: [
        'The metadata planner intersects predicate sets into one candidate mask. The vector search visits graph candidates by distance and checks the mask before adding an id to the result heap. If the mask is tiny, the planner can skip ANN and score the allowed ids exactly.',
      ] },
    { heading: 'Why it works', paragraphs: [
        'Correctness separates filtering from ranking. The set intersection is exact for the predicates it represents, so an id missing from tenant, permission, or not_tombstoned cannot appear in the allowed set. The result heap only admits ids that pass that test, even if the ANN path is approximate.',
      ] },
    { heading: 'Cost and complexity', paragraphs: [
        'Post-filtering is cheap to implement and bad under selective filters. Bitset-gated ANN adds metadata-index memory and a membership check for each visited candidate. Cost depends on selectivity: 500 allowed ids may be cheaper to score exactly, while 7,000,000 allowed ids make the gate almost free.',
      ] },
    { heading: 'Real-world uses', paragraphs: [
        'The pattern fits multi-tenant search, enterprise RAG, legal discovery, support knowledge bases, product catalogs, recommendation systems, and personal document assistants. The shared shape is semantic ranking inside a hard eligibility boundary. Evaluation should report filtered recall at k, latency under real predicates, and leak rate.',
      ] },
    { heading: 'Where it fails', paragraphs: [
        'It fails when metadata is stale or applied inconsistently. A perfect bitset cannot save a system where access-control updates lag indexing or tombstoned ids remain searchable. It is also overkill when the allowed set has 20 documents and exact scoring is simpler.',
      ] },
    { heading: 'Worked example', paragraphs: [
        'A corpus has 1,000,000 vectors. Tenant A owns 10,000, the user may see 2,000, and only 600 visible Tenant A documents are contracts. The planner intersects three bitsets and gets 600 ids. Post-filtering top 20 expects about 20 times 600 divided by 1,000,000, or 0.012 allowed hits under a uniform model. Exact scoring 600 vectors with 768 dimensions costs 460,800 coordinate products and gives perfect filtered recall.',
      ] },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources: Filtered-DiskANN at https://dl.acm.org/doi/10.1145/3543507.3583552 and https://harsha-simhadri.org/pubs/Filtered-DiskANN23.pdf, HNSW at https://arxiv.org/abs/1603.09320, DiskANN at https://papers.nips.cc/paper/9527-rand-nsg-fast-accurate-billion-point-nearest-neighbor-search-on-a-single-node, and Roaring bitmaps at https://arxiv.org/abs/1603.06549.',
        'Study Roaring Bitmaps, HNSW Search, DiskANN SSD Vector Search, Database Indexing, Zanzibar Authorization, RAG Pipeline, Multi-Index RAG, ANN Recall-Latency Pareto Ledger, and Citation Span Index next.',
      ] },
  ],
};
