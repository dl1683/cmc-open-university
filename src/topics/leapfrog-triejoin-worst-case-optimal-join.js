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
  const relations = ['R', 'S', 'T'];
  const variables = ['x', 'y', 'z'];
  const activeStep1 = ['vars', 'R', 'S', 'T', 'x', 'e-R-x', 'e-T-x'];

  yield {
    state: trieGraph('Leapfrog Triejoin intersects variable domains level by level'),
    highlight: { active: activeStep1, found: ['emit'] },
    explanation: `Instead of joining ${relations.length} relations (${relations.join(', ')}) pairwise, Leapfrog Triejoin chooses a variable order over ${variables.length} variables (${variables.join(', ')}) and asks every relevant relation index for possible values at the current prefix. This step highlights ${activeStep1.length} active elements in the trie graph.`,
    invariant: `At each of the ${variables.length} variables, candidate values are the intersection of sorted iterators constrained by the current prefix.`,
  };

  const trieRows = [
    { id: 'R', label: 'R(x,y)' },
    { id: 'S', label: 'S(y,z)' },
    { id: 'T', label: 'T(x,z)' },
    { id: 'prefix', label: 'prefix' },
  ];
  const trieCols = [
    { id: 'level1', label: 'level 1' },
    { id: 'level2', label: 'level 2' },
    { id: 'operation', label: 'operation' },
  ];

  yield {
    state: labelMatrix(
      'Trie view of relations',
      trieRows,
      trieCols,
      [
        ['x values', 'y per x', 'seek'],
        ['y values', 'z per y', 'seek'],
        ['x values', 'z per x', 'seek'],
        ['x=7', 'restrict children', 'open'],
      ],
    ),
    highlight: { active: ['R:operation', 'S:operation', 'T:operation'], found: ['prefix:level2'] },
    explanation: `This ${trieRows.length}-row by ${trieCols.length}-column matrix maps each of the ${relations.length} relations to its trie levels. A trie index lets the algorithm open a prefix and then iterate the values of the next variable under that prefix. B-trees or sorted column indexes can supply the same seek/next interface.`,
  };

  const intersectVars = ['x', 'y', 'z'];
  yield {
    state: trieGraph('Leapfrog intersection advances the lagging iterator'),
    highlight: { active: intersectVars, found: ['emit'], compare: relations },
    explanation: `For each of the ${intersectVars.length} variables (${intersectVars.join(', ')}), each of the ${relations.length} participating relations has a sorted iterator of legal values. The algorithm advances the iterator with the smallest value until all ${relations.length} iterators agree or one is exhausted.`,
  };

  const comparisonRows = [
    { id: 'binary', label: 'binary plan' },
    { id: 'trie', label: 'trie join' },
    { id: 'index', label: 'index need' },
    { id: 'output', label: 'output bound' },
  ];
  const comparisonCols = [
    { id: 'shape', label: 'shape' },
    { id: 'risk', label: 'risk' },
  ];

  yield {
    state: labelMatrix(
      'Binary joins versus trie join',
      comparisonRows,
      comparisonCols,
      [
        ['pairwise joins', 'huge intermediate'],
        ['multiway search', 'index order'],
        ['tries per order', 'storage/build'],
        ['AGM aware', 'still output-heavy'],
      ],
    ),
    highlight: { active: ['trie:shape', 'output:shape'], compare: ['binary:risk'] },
    explanation: `This ${comparisonRows.length}-row by ${comparisonCols.length}-column comparison shows why worst-case optimal join algorithms matter: binary joins create intermediate results much larger than the final output or theoretical bound, while trie join performs a ${relations.length}-way multiway search.`,
  };

  const fullActiveNodes = ['R', 'S', 'T', 'x', 'y', 'z', 'emit'];
  yield {
    state: trieGraph('Complete case: Datalog rule evaluation'),
    highlight: { active: fullActiveNodes, found: ['bound'] },
    explanation: `Logic and graph workloads often evaluate multiway predicates across ${relations.length} relations and ${variables.length} variables. With all ${fullActiveNodes.length} nodes active, Triejoin treats a rule body as one multiway search rather than a fixed chain of binary joins.`,
  };
}

function* triangleQueryCase() {
  const relations = ['R', 'S', 'T'];
  const variables = ['x', 'y', 'z'];
  const edgeSpecs = ['R(x,y)', 'S(y,z)', 'T(x,z)'];

  yield {
    state: trieGraph(`Triangle query: ${edgeSpecs.join(', ')}`),
    highlight: { active: relations, found: variables, compare: ['emit'] },
    explanation: `The triangle query is the canonical example with ${relations.length} relations (${edgeSpecs.join(', ')}) over ${variables.length} variables (${variables.join(', ')}). Pairwise joining ${relations[0]} and ${relations[1]} may produce many ${variables.join(',')} candidates that ${relations[2]} later rejects. Multiway search checks all ${relations.length} constraints as it binds variables.`,
    invariant: `A partial assignment across ${variables.length} variables survives only if every relation that mentions its bound variables can still match.`,
  };

  const traceRows = [
    { id: 'x', label: 'bind x' },
    { id: 'y', label: 'bind y' },
    { id: 'z', label: 'bind z' },
    { id: 'emit', label: 'emit' },
  ];
  const traceCols = [
    { id: 'candidate', label: 'candidate source' },
    { id: 'constraint', label: 'constraints checked' },
  ];
  const traceData = [
    ['R.x intersect T.x', 'x exists in both'],
    ['R.y intersect S.y', 'given x where needed'],
    ['S.z intersect T.z', 'given y and x'],
    ['(x,y,z)', 'all three edges'],
  ];

  yield {
    state: labelMatrix(
      'Triangle trace',
      traceRows,
      traceCols,
      traceData,
    ),
    highlight: { active: ['x:candidate', 'y:candidate', 'z:candidate'], found: ['emit:constraint'] },
    explanation: `This ${traceRows.length}-row by ${traceCols.length}-column trace shows the variable-oriented order. Each of the ${variables.length} bound prefixes (${variables.join(', ')}) narrows the next trie iterators, so impossible candidates die before they become large materialized tables.`,
  };

  const indexActiveNodes = ['R', 'S', 'T', 'x', 'y', 'z'];
  yield {
    state: trieGraph('Indexes make seek and next cheap'),
    highlight: { active: indexActiveNodes, compare: ['bound'], found: ['emit'] },
    explanation: `The algorithm assumes each of the ${relations.length} relations can be viewed through sorted indexes compatible with the ${variables.length}-variable order. With ${indexActiveNodes.length} nodes active, index selection is therefore part of the physical plan.`,
  };

  const fitRows = [
    { id: 'datalog', label: 'Datalog' },
    { id: 'rdf', label: 'RDF/SPARQL' },
    { id: 'graph', label: 'graph motifs' },
    { id: 'sql', label: 'ordinary SQL' },
  ];
  const fitCols = [
    { id: 'fit', label: 'fit' },
    { id: 'watch', label: 'watch out' },
  ];
  const strongFitDomains = ['Datalog', 'RDF/SPARQL', 'graph motifs'];

  yield {
    state: labelMatrix(
      'Where it fits',
      fitRows,
      fitCols,
      [
        ['strong', 'many rules'],
        ['strong', 'many triple patterns'],
        ['strong', 'cyclic joins'],
        ['mixed', 'optimizer integration'],
      ],
    ),
    highlight: { active: ['datalog:fit', 'rdf:fit', 'graph:fit'], compare: ['sql:watch'] },
    explanation: `This ${fitRows.length}-row by ${fitCols.length}-column matrix shows that Triejoin is not a universal replacement for hash join. It is strongest for ${strongFitDomains.length} domain types (${strongFitDomains.join(', ')}), plus cyclic queries where binary plans create bad intermediates.`,
  };

  const emitActiveNodes = ['R', 'S', 'T', 'emit'];
  const compareVars = ['x', 'y', 'z'];
  yield {
    state: trieGraph('Complete case: find triangles in a social graph'),
    highlight: { active: emitActiveNodes, found: ['bound'], compare: compareVars },
    explanation: `Triangle enumeration in a graph can be written as a ${relations.length}-relation query over edges. With ${emitActiveNodes.length} active nodes and ${compareVars.length} compared variables, a worst-case optimal plan intersects adjacency tries instead of materializing every two-hop path first.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The trie-intersection view binds variables one level at a time. Active nodes show the current variable and the relations whose sorted iterators must agree on its value.',
        {type: 'image', src: './assets/gifs/leapfrog-triejoin-worst-case-optimal-join.gif', alt: 'Animated walkthrough of the leapfrog triejoin worst case optimal join visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The triangle-query view is the canonical case: R(x,y), S(y,z), and T(x,z). A candidate tuple is emitted only after x, y, and z survive all relation constraints.',
      ], },
    { heading: 'Why this exists', paragraphs: [
        'Relational joins combine rows that agree on shared variables. Binary join plans combine two relations at a time, but cyclic queries can create huge intermediate tables that mostly disappear when later constraints are checked.',
        {
        type: 'callout',
        text: 'Triejoin treats a join result as a variable assignment that survives all constraints at the same time.',
      },
        'Leapfrog Triejoin exists to evaluate the whole conjunctive query as a multiway search. It tries to stay near the worst-case output bound of the query instead of the accidental size of a bad binary intermediate.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a left-deep binary plan. Join R with S, materialize the result, then join that intermediate with T.',
        'This is a good plan shape for many ordinary SQL queries because hash joins and merge joins are fast and mature. It becomes expensive when the first intermediate is much larger than the final answer.',
      ], },
    { heading: 'The wall', paragraphs: [
        'In a triangle query, joining R(x,y) with S(y,z) can materialize every two-hop path x-y-z. If only a small fraction have the closing edge T(x,z), most of that intermediate was doomed work.',
        'The wall is commitment. Once the plan materializes a binary intermediate, it has paid for candidates before all constraints had a chance to reject them.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'A join tuple is a satisfying assignment to variables. Instead of making tables bigger and then filtering them, bind variables in an order and keep every relevant relation constraint active at each level.',
        'The data structure is a trie-like index over relation attributes. Open a prefix, enumerate compatible next values, and intersect those sorted iterators across all relations that mention the variable.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Choose a variable order such as x, y, z. For x, intersect the sorted x-values from relations that contain x; for each surviving x, open child iterators for y; for each surviving x,y prefix, do the same for z.',
        {
        type: 'image',
        src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg',
        alt: 'Trie storing words by shared prefixes',
        caption: 'A trie makes prefix-constrained lookup visible: open a prefix, then enumerate only compatible children. Source: Wikimedia Commons, Booyabazooka, public domain.',
      },
        'Leapfrog intersection advances the iterator with the smallest current value up to the largest current value. Agreement means the value satisfies every participating relation under the current prefix.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Correctness is by exhaustive but pruned search over assignments. Every emitted tuple has passed every relation constraint, and every valid tuple can be reached because the trie iterators enumerate all values compatible with each surviving prefix.',
        'The worst-case optimal argument comes from evaluating the query hypergraph as a whole. The algorithm avoids binary intermediates whose size can exceed the AGM-style bound for the full conjunctive query.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Asymptotically, worst-case optimal joins target the query output bound rather than the size of chosen binary intermediates. Practically, the cost is iterator seeks, prefix opens, index storage, variable-order choice, and optimizer integration.',
        'When input sizes double, a good variable order keeps failed candidates from becoming rows. A bad order can still perform many seeks before emitting little, so counters by variable level matter.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Leapfrog Triejoin fits Datalog engines, RDF/SPARQL systems, graph motif search, and cyclic SQL queries. These workloads often express many simultaneous constraints over a small set of variables.',
        {
        type: 'image',
        src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg',
        alt: 'Directed graph with connected vertices and arrows',
        caption: 'Graph-pattern joins are simultaneous constraints over edges, which is the shape worst-case optimal joins are built to exploit. Source: Wikimedia Commons, David W., public domain.',
      },
        'Triangle enumeration is the teaching case, but the same idea appears in rule evaluation where many predicates share variables and binary plans can explode.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It fails when the right indexes are unavailable or too expensive to maintain. A row store with no compatible order may spend more building trie views than it saves during the join.',
        'It is also not a universal replacement for traditional joins. Selective key lookups, star joins, small joins, and ordinary reporting queries may be faster with a mature hash or merge plan.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Let R(x,y) = {(1,2), (1,3), (2,3)}, S(y,z) = {(2,5), (3,5), (3,6)}, and T(x,z) = {(1,5), (2,6)}. The query asks for triples satisfying all three relations.',
        'Bind x first: R and T agree on x values {1,2}. For x = 1 and y = 2, S gives z {5}, and T under x = 1 has z {5}, so emit (1,2,5).',
        'For x = 1 and y = 3, emit (1,3,5); for x = 2 and y = 3, emit (2,3,6). No two-hop table had to be materialized before the closing edge was checked.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: Todd Veldhuizen, "Leapfrog Triejoin: A Simple, Worst-Case Optimal Join Algorithm"; Atserias, Grohe, and Marx on query-size bounds; and database work on generic join and trie indexes.',
        'Study SQL join algorithms, merge intersection, tries, Datalog, RDF/SPARQL, Cascades optimizers, and graph motif search. Some joins are simultaneous constraints, not a chain of pairwise tables.',
      ], },
  ],
};
