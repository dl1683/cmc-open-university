// Leapfrog Triejoin: trie indexes plus synchronized intersection for joins.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'leapfrog-triejoin-worst-case-optimal-join',
  title: 'Leapfrog Triejoin Worst-Case Optimal Join',
  category: 'Systems',
  summary: 'Represent relations as trie-like indexes over variable orders, intersect candidate values level by level, and avoid large binary-join intermediates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trie intersection', 'triangle query case'], defaultValue: 'trie intersection' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function trieGraph(title) {
  return graphState({
    nodes: [
      { id: 'vars', label: 'x,y,z', x: 0.8, y: 3.5, note: 'order' },
      { id: 'R', label: 'R(x,y)', x: 2.8, y: 1.6, note: 'trie' },
      { id: 'S', label: 'S(y,z)', x: 2.8, y: 3.6, note: 'trie' },
      { id: 'T', label: 'T(x,z)', x: 2.8, y: 5.6, note: 'trie' },
      { id: 'x', label: 'seek x', x: 5.0, y: 2.2, note: 'intersect' },
      { id: 'y', label: 'seek y', x: 5.0, y: 4.0, note: 'intersect' },
      { id: 'z', label: 'seek z', x: 5.0, y: 5.8, note: 'intersect' },
      { id: 'emit', label: 'emit', x: 7.4, y: 4.0, note: 'tuple' },
      { id: 'bound', label: 'AGM', x: 9.0, y: 4.0, note: 'worst case' },
    ],
    edges: [
      { id: 'e-vars-R', from: 'vars', to: 'R', weight: '' },
      { id: 'e-vars-S', from: 'vars', to: 'S', weight: '' },
      { id: 'e-vars-T', from: 'vars', to: 'T', weight: '' },
      { id: 'e-R-x', from: 'R', to: 'x', weight: '' },
      { id: 'e-T-x', from: 'T', to: 'x', weight: '' },
      { id: 'e-R-y', from: 'R', to: 'y', weight: '' },
      { id: 'e-S-y', from: 'S', to: 'y', weight: '' },
      { id: 'e-S-z', from: 'S', to: 'z', weight: '' },
      { id: 'e-T-z', from: 'T', to: 'z', weight: '' },
      { id: 'e-y-emit', from: 'y', to: 'emit', weight: '' },
      { id: 'e-z-emit', from: 'z', to: 'emit', weight: '' },
      { id: 'e-emit-bound', from: 'emit', to: 'bound', weight: '' },
    ],
  }, { title });
}

function* trieIntersection() {
  yield {
    state: trieGraph('Leapfrog Triejoin intersects variable domains level by level'),
    highlight: { active: ['vars', 'R', 'S', 'T', 'x', 'e-R-x', 'e-T-x'], found: ['emit'] },
    explanation: 'Instead of joining two relations at a time, Leapfrog Triejoin chooses a variable order and asks every relevant relation index for possible values at the current prefix.',
    invariant: 'At each variable, candidate values are the intersection of sorted iterators constrained by the current prefix.',
  };

  yield {
    state: labelMatrix(
      'Trie view of relations',
      [
        { id: 'R', label: 'R(x,y)' },
        { id: 'S', label: 'S(y,z)' },
        { id: 'T', label: 'T(x,z)' },
        { id: 'prefix', label: 'prefix' },
      ],
      [
        { id: 'level1', label: 'level 1' },
        { id: 'level2', label: 'level 2' },
        { id: 'operation', label: 'operation' },
      ],
      [
        ['x values', 'y per x', 'seek'],
        ['y values', 'z per y', 'seek'],
        ['x values', 'z per x', 'seek'],
        ['x=7', 'restrict children', 'open'],
      ],
    ),
    highlight: { active: ['R:operation', 'S:operation', 'T:operation'], found: ['prefix:level2'] },
    explanation: 'A trie index lets the algorithm open a prefix and then iterate the values of the next variable under that prefix. B-trees or sorted column indexes can supply the same seek/next interface.',
  };

  yield {
    state: trieGraph('Leapfrog intersection advances the lagging iterator'),
    highlight: { active: ['x', 'y', 'z'], found: ['emit'], compare: ['R', 'S', 'T'] },
    explanation: 'For a variable, each participating relation has a sorted iterator of legal values. The algorithm advances the iterator with the smallest value until all iterators agree or one is exhausted.',
  };

  yield {
    state: labelMatrix(
      'Binary joins versus trie join',
      [
        { id: 'binary', label: 'binary plan' },
        { id: 'trie', label: 'trie join' },
        { id: 'index', label: 'index need' },
        { id: 'output', label: 'output bound' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['pairwise joins', 'huge intermediate'],
        ['multiway search', 'index order'],
        ['tries per order', 'storage/build'],
        ['AGM aware', 'still output-heavy'],
      ],
    ),
    highlight: { active: ['trie:shape', 'output:shape'], compare: ['binary:risk'] },
    explanation: 'Worst-case optimal join algorithms matter when binary joins create intermediate results much larger than the final output or theoretical bound.',
  };

  yield {
    state: trieGraph('Complete case: Datalog rule evaluation'),
    highlight: { active: ['R', 'S', 'T', 'x', 'y', 'z', 'emit'], found: ['bound'] },
    explanation: 'Logic and graph workloads often evaluate multiway predicates. Triejoin treats a rule body as one multiway search rather than a fixed chain of binary joins.',
  };
}

function* triangleQueryCase() {
  yield {
    state: trieGraph('Triangle query: R(x,y), S(y,z), T(x,z)'),
    highlight: { active: ['R', 'S', 'T'], found: ['x', 'y', 'z'], compare: ['emit'] },
    explanation: 'The triangle query is the canonical example. Pairwise joining R and S may produce many x,y,z candidates that T later rejects. Multiway search checks all constraints as it binds variables.',
    invariant: 'A partial assignment survives only if every relation that mentions its bound variables can still match.',
  };

  yield {
    state: labelMatrix(
      'Triangle trace',
      [
        { id: 'x', label: 'bind x' },
        { id: 'y', label: 'bind y' },
        { id: 'z', label: 'bind z' },
        { id: 'emit', label: 'emit' },
      ],
      [
        { id: 'candidate', label: 'candidate source' },
        { id: 'constraint', label: 'constraints checked' },
      ],
      [
        ['R.x intersect T.x', 'x exists in both'],
        ['R.y intersect S.y', 'given x where needed'],
        ['S.z intersect T.z', 'given y and x'],
        ['(x,y,z)', 'all three edges'],
      ],
    ),
    highlight: { active: ['x:candidate', 'y:candidate', 'z:candidate'], found: ['emit:constraint'] },
    explanation: 'The order is variable-oriented. Each bound prefix narrows the next trie iterators, so impossible candidates die before they become large materialized tables.',
  };

  yield {
    state: trieGraph('Indexes make seek and next cheap'),
    highlight: { active: ['R', 'S', 'T', 'x', 'y', 'z'], compare: ['bound'], found: ['emit'] },
    explanation: 'The algorithm assumes each relation can be viewed through sorted indexes compatible with the variable order. Index selection is therefore part of the physical plan.',
  };

  yield {
    state: labelMatrix(
      'Where it fits',
      [
        { id: 'datalog', label: 'Datalog' },
        { id: 'rdf', label: 'RDF/SPARQL' },
        { id: 'graph', label: 'graph motifs' },
        { id: 'sql', label: 'ordinary SQL' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'watch', label: 'watch out' },
      ],
      [
        ['strong', 'many rules'],
        ['strong', 'many triple patterns'],
        ['strong', 'cyclic joins'],
        ['mixed', 'optimizer integration'],
      ],
    ),
    highlight: { active: ['datalog:fit', 'rdf:fit', 'graph:fit'], compare: ['sql:watch'] },
    explanation: 'Triejoin is not a universal replacement for hash join. It is strongest for multiway joins, graph patterns, logic rules, and cyclic queries where binary plans create bad intermediates.',
  };

  yield {
    state: trieGraph('Complete case: find triangles in a social graph'),
    highlight: { active: ['R', 'S', 'T', 'emit'], found: ['bound'], compare: ['x', 'y', 'z'] },
    explanation: 'Triangle enumeration in a graph can be written as a three-relation query over edges. A worst-case optimal plan intersects adjacency tries instead of materializing every two-hop path first.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trie intersection') yield* trieIntersection();
  else if (view === 'triangle query case') yield* triangleQueryCase();
  else throw new InputError('Pick a Leapfrog Triejoin view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Leapfrog Triejoin is a worst-case optimal multiway join algorithm. It represents relations through trie-like indexes over variable orders and searches assignments variable by variable, intersecting sorted candidate iterators at each level.',
      'The key shift is from binary joins to multiway constraint search. A binary plan chooses pairwise joins and may materialize large intermediates. Triejoin keeps all relevant constraints active while binding each variable.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Binary join plans are excellent for many SQL workloads, but cyclic joins and graph patterns can create intermediates much larger than the final output. The triangle query is the standard example: materializing two-hop paths can be wasteful when few of them close into triangles.',
      'Worst-case optimal joins exist to respect the theoretical output-size bound of the whole query instead of the accidental size of a chosen pairwise intermediate.',
    ] },
    { heading: 'The obvious approach and its wall', paragraphs: [
      'The obvious approach is to pick two relations, join them, then join the result with the next relation. That creates a simple plan tree but commits early to an intermediate relation.',
      'The wall appears when the intermediate is mostly doomed. Triejoin delays materialization and binds variables only when all relations that mention the variable agree on a candidate value.',
    ] },
    {
      heading: 'Reading the visualization',
      paragraphs: [
        `In the trie-intersection view, each variable level is a synchronized intersection. For x, only relations that mention x participate. For y and z, the current prefix narrows the relevant trie iterators. A candidate survives only when all participating indexes agree.`,
        `In the triangle-query view, compare this with a binary plan. A pairwise join might materialize many two-hop paths before checking the closing edge. Leapfrog Triejoin keeps all three edge constraints active while binding x, y, and z, so impossible candidates die before becoming a large intermediate table.`,
      ],
    },
    { heading: 'How it works', paragraphs: [
      'Choose a variable order such as x, y, z. For each relation, use an index that can seek within that order or a compatible projection. At variable x, intersect all relation iterators that constrain x. For each surviving x, open child iterators and repeat for y, then z. When all variables are bound, emit a result tuple.',
      'The leapfrog part is synchronized intersection. Sorted iterators advance the smallest current value until every iterator agrees or one iterator is exhausted. This is the same spirit as merge intersection, but nested inside trie levels.',
    ] },
    { heading: 'Core insight', paragraphs: [
      'A join tuple is a satisfying assignment to variables. Leapfrog Triejoin treats the query as constraint solving over sorted domains. Each variable assignment must survive every relation that constrains it under the current prefix.',
      'The trie interface is what makes this efficient: open a prefix, seek to a value, advance to the next value, and close the prefix. The algorithm is only as practical as those index operations.',
    ] },
    { heading: 'Index contract', paragraphs: [
      'The algorithm depends on indexes that behave like tries over the chosen variable order. At each level, the engine needs to open the current prefix, seek to a candidate value, advance to the next value, and enumerate children under that prefix.',
      'That contract is why Leapfrog Triejoin is not just a clever loop over ordinary row stores. If relations are not available in compatible orders, the engine must build or maintain the right indexes, and that cost belongs in the plan.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'It works because sorted iterators can be intersected without scanning all combinations. When one iterator lags behind the others, leapfrog seek advances it to the current maximum candidate. Agreement means the value is valid for every relation at that prefix.',
      'The worst-case optimal property comes from respecting the whole query hypergraph instead of committing to one binary intermediate. The algorithm is designed around the AGM-style output bound for conjunctive queries, not around the accident of SQL join order.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Worst-case optimal join algorithms are designed to match theoretical output-size bounds for conjunctive queries, avoiding some pathological intermediates produced by binary plans. The practical cost is index availability, variable-order choice, and integration with an optimizer that already has hash, merge, and nested-loop joins.',
      'They are especially interesting for cyclic joins such as triangle queries, RDF/SPARQL graph patterns, Datalog rules, and graph motif search. Ordinary selective SQL joins may still be served well by traditional binary joins.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A social-graph triangle query asks for x, y, z where edge(x,y), edge(y,z), and edge(x,z) all hold. A binary plan can first build all two-hop paths, then filter by the third edge. If the graph has many two-hop paths but few triangles, that intermediate is wasteful. Triejoin intersects adjacency indexes as it binds variables and rejects impossible candidates earlier.',
      'At level x, all three edge relations restrict which nodes can begin a triangle. After x is fixed, the y iterator is opened under the relevant edge prefixes. After y is fixed, z must satisfy both edge(y,z) and edge(x,z). The closing edge is never an afterthought; it participates during candidate generation.',
    ] },
    { heading: 'Where it wins / Where it fails', paragraphs: [
      'It wins for cyclic joins, RDF/SPARQL patterns, Datalog rules, graph motifs, and workloads where binary joins create large rejected intermediates.',
      'It fails when indexes are unavailable, variable order is poor, or ordinary selective binary joins are already cheap. It is a physical strategy for a particular shape of query, not a universal replacement for the relational optimizer.',
      'It can also lose on engineering overhead. A mature SQL engine already has statistics, join reordering, hash joins, merge joins, spilling, and vectorized execution. A worst-case optimal join operator must earn its place by improving the hard query shapes without slowing the ordinary ones.',
    ] },
    { heading: 'Implementation checklist', paragraphs: [
      'Choose the variable order from the query hypergraph and data distribution, not from surface syntax. Materialize or maintain trie indexes for the relation projections the order requires. Track iterator seeks, prefix opens, candidate counts, and emitted tuples so bad variable orders are visible.',
      'Keep a binary-join fallback. Worst-case optimal joins are a powerful operator for cyclic patterns, but selective star joins, key lookups, and small joins may still be faster through traditional plans.',
    ] },
    { heading: 'Operational guidance', paragraphs: [
      'Use benchmark queries that include both the hard cyclic shape and ordinary joins. A triejoin implementation that wins triangles but slows down selective business queries is an operator, not a replacement planner. The optimizer needs a clear rule for when to consider it.',
      'Expose iterator-level counters. If a variable order causes millions of failed seeks before emitting a few tuples, the plan may be theoretically attractive but practically poor. Candidate counts by level make those mistakes visible to the optimizer and to humans debugging the plan.',
      'Remember that the worst-case guarantee is about asymptotic output bounds, not about all constants. Memory layout, index construction time, cache locality, and integration with existing execution pipelines decide whether the idea wins in a real database.',
      'For learners, the key habit is to stop thinking of a join as a left-deep tree by default. A cyclic query is a set of simultaneous constraints, and sometimes the right execution model is to keep those constraints alive together.',
      'For implementers, the key risk is paying index costs for queries that do not need them. A good system can recognize graph-pattern workloads, reuse indexes across related rules, and avoid rebuilding expensive trie projections for one-off queries in ordinary reporting workloads and dashboards.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Veldhuizen, "Leapfrog Triejoin: A Simple, Worst-Case Optimal Join Algorithm", https://www.openproceedings.org/2014/conf/icdt/Veldhuizen14.pdf; arXiv version, https://arxiv.org/abs/1210.0481; and index-structure discussion for worst-case optimal joins, https://db.in.tum.de/~schmidt/papers/bachelor-thesis.pdf?lang=de. Study SQL Join Algorithms Primer, Selinger DP Join Order Optimizer, Cascades Memo Query Optimizer, Inverted Index, and Trie next.',
    ] },
  ],
};
