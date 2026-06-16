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
    { heading: 'How it works', paragraphs: [
      'Choose a variable order such as x, y, z. For each relation, use an index that can seek within that order or a compatible projection. At variable x, intersect all relation iterators that constrain x. For each surviving x, open child iterators and repeat for y, then z. When all variables are bound, emit a result tuple.',
      'The leapfrog part is synchronized intersection. Sorted iterators advance the smallest current value until every iterator agrees or one iterator is exhausted. This is the same spirit as merge intersection, but nested inside trie levels.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Worst-case optimal join algorithms are designed to match theoretical output-size bounds for conjunctive queries, avoiding some pathological intermediates produced by binary plans. The practical cost is index availability, variable-order choice, and integration with an optimizer that already has hash, merge, and nested-loop joins.',
      'They are especially interesting for cyclic joins such as triangle queries, RDF/SPARQL graph patterns, Datalog rules, and graph motif search. Ordinary selective SQL joins may still be served well by traditional binary joins.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A social-graph triangle query asks for x, y, z where edge(x,y), edge(y,z), and edge(x,z) all hold. A binary plan can first build all two-hop paths, then filter by the third edge. If the graph has many two-hop paths but few triangles, that intermediate is wasteful. Triejoin intersects adjacency indexes as it binds variables and rejects impossible candidates earlier.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Veldhuizen, "Leapfrog Triejoin: A Simple, Worst-Case Optimal Join Algorithm", https://www.openproceedings.org/2014/conf/icdt/Veldhuizen14.pdf; arXiv version, https://arxiv.org/abs/1210.0481; and index-structure discussion for worst-case optimal joins, https://db.in.tum.de/~schmidt/papers/bachelor-thesis.pdf?lang=de. Study SQL Join Algorithms Primer, Selinger DP Join Order Optimizer, Cascades Memo Query Optimizer, Inverted Index, and Trie next.',
    ] },
  ],
};
