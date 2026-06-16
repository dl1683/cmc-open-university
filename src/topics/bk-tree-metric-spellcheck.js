// BK-trees index discrete metric spaces by distance-labeled edges, using the
// triangle inequality to prune fuzzy search candidates.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bk-tree-metric-spellcheck',
  title: 'BK-Tree Metric Spellcheck',
  category: 'Data Structures',
  summary: 'A metric tree for fuzzy lookup: store words under edit-distance edges and prune impossible subtrees with the triangle inequality.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['metric tree', 'radius query', 'spellcheck case study'], defaultValue: 'metric tree' },
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

function bkGraph(title) {
  return graphState({
    nodes: [
      { id: 'book', label: 'book', x: 4.9, y: 6.8, note: 'root' },
      { id: 'books', label: 'books', x: 2.4, y: 4.8, note: 'd=1' },
      { id: 'cake', label: 'cake', x: 7.4, y: 4.8, note: 'd=4' },
      { id: 'boo', label: 'boo', x: 1.5, y: 2.7, note: 'd=2' },
      { id: 'boon', label: 'boon', x: 3.4, y: 2.7, note: 'd=1' },
      { id: 'cook', label: 'cook', x: 5.9, y: 2.7, note: 'd=2' },
      { id: 'cape', label: 'cape', x: 8.6, y: 2.7, note: 'd=1' },
      { id: 'query', label: 'boon?', x: 4.9, y: 0.8, note: 'radius 1' },
    ],
    edges: [
      { id: 'e-book-books', from: 'book', to: 'books', weight: '1' },
      { id: 'e-book-cake', from: 'book', to: 'cake', weight: '4' },
      { id: 'e-books-boo', from: 'books', to: 'boo', weight: '2' },
      { id: 'e-books-boon', from: 'books', to: 'boon', weight: '1' },
      { id: 'e-cake-cook', from: 'cake', to: 'cook', weight: '2' },
      { id: 'e-cake-cape', from: 'cake', to: 'cape', weight: '1' },
      { id: 'e-query-book', from: 'query', to: 'book', weight: '' },
      { id: 'e-query-books', from: 'query', to: 'books', weight: '' },
    ],
  }, { title });
}

function* metricTree() {
  yield {
    state: bkGraph('BK-tree edges are distances from the parent word'),
    highlight: { active: ['book', 'books', 'cake'], found: ['e-book-books', 'e-book-cake'] },
    explanation: 'A BK-tree stores objects from a metric space. Each child edge out of a node is labeled by the distance from the parent object. For words, the distance is often Edit Distance.',
    invariant: 'All descendants behind an edge labeled k are exactly distance k from that edge parent.',
  };

  yield {
    state: labelMatrix(
      'Insertion by distance',
      [
        { id: 'start', label: 'new word boon' },
        { id: 'root', label: 'compare book' },
        { id: 'child', label: 'compare books' },
        { id: 'place', label: 'place' },
      ],
      [
        { id: 'distance', label: 'distance' },
        { id: 'action', label: 'action' },
      ],
      [
        ['d=2', 'follow edge 2?'],
        ['no edge 2? maybe create', 'or continue'],
        ['d=1', 'follow/create edge 1'],
        ['child under books', 'store boon'],
      ],
    ),
    highlight: { active: ['root:distance', 'child:distance'], found: ['place:action'] },
    explanation: 'Insertion is simple: compute distance to the current node, then follow the child with that exact distance. If no such child exists, attach the new item there.',
  };

  yield {
    state: labelMatrix(
      'Metric requirements',
      [
        { id: 'nonneg', label: 'nonnegative' },
        { id: 'zero', label: 'zero iff same' },
        { id: 'sym', label: 'symmetric' },
        { id: 'tri', label: 'triangle' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['d>=0', 'distance labels'],
        ['d=0 same item', 'dedupe'],
        ['d(a,b)=d(b,a)', 'query symmetry'],
        ['d(a,c)<=d(a,b)+d(b,c)', 'pruning'],
      ],
    ),
    highlight: { found: ['tri:why'], active: ['sym:why', 'zero:why'] },
    explanation: 'The triangle inequality is the whole pruning proof. If a distance function violates it, a BK-tree can skip a subtree that actually contains a valid answer.',
  };
}

function* radiusQuery() {
  yield {
    state: bkGraph('Query "boon" within edit distance 1'),
    highlight: { active: ['query', 'book'], found: ['boon'], compare: ['books', 'boo', 'cook'] },
    explanation: 'For query q and radius r, compute d(q,node). If d=2 and r=1, only child edges in [1,3] can possibly contain answers. Every other distance bucket is impossible by triangle inequality.',
    invariant: 'Visit only child edges k where d(q,node)-r <= k <= d(q,node)+r.',
  };

  yield {
    state: labelMatrix(
      'Prune by distance band',
      [
        { id: 'root', label: 'at book' },
        { id: 'edge1', label: 'edge 1' },
        { id: 'edge4', label: 'edge 4' },
        { id: 'answer', label: 'boon' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'decision', label: 'decision' },
      ],
      [
        ['d(query,book)=2', 'keep edges 1..3'],
        ['1 inside band', 'visit books'],
        ['4 outside band', 'prune cake'],
        ['d=0', 'report'],
      ],
    ),
    highlight: { active: ['root:decision', 'edge1:decision'], removed: ['edge4:decision'], found: ['answer:decision'] },
    explanation: 'If the edge to cake is distance 4 from book, no descendant behind that edge can be within radius 1 of a query that is distance 2 from book. The subtree is safely skipped.',
  };

  yield {
    state: bkGraph('Triangle inequality turns a tree walk into a filter'),
    highlight: { active: ['book', 'books', 'boon'], removed: ['cake', 'cape', 'cook'], found: ['boon'] },
    explanation: 'The search still computes real edit distances for visited nodes. The tree only reduces the number of candidates that need those expensive dynamic-programming computations.',
  };

  yield {
    state: labelMatrix(
      'Performance shape',
      [
        { id: 'smallr', label: 'small radius' },
        { id: 'larger', label: 'large radius' },
        { id: 'badmetric', label: 'bad metric' },
        { id: 'cluster', label: 'same distances' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['strong pruning', 'fast'],
        ['wide band', 'more visits'],
        ['invalid prune', 'wrong'],
        ['flat tree', 'near linear'],
      ],
    ),
    highlight: { found: ['smallr:effect'], compare: ['larger:risk', 'cluster:risk'] },
    explanation: 'BK-trees are workload-sensitive. They shine with small radii and discrete distances that distribute words across useful buckets.',
  };
}

function* spellcheckCaseStudy() {
  yield {
    state: labelMatrix(
      'Spellcheck pipeline',
      [
        { id: 'dict', label: 'dictionary' },
        { id: 'metric', label: 'edit distance' },
        { id: 'query', label: 'mispelling' },
        { id: 'rank', label: 'rank results' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'data', label: 'data' },
      ],
      [
        ['build BK-tree', 'known words'],
        ['Levenshtein', 'radius 1..2'],
        ['fuzzy lookup', 'candidates'],
        ['frequency/context', 'best correction'],
      ],
    ),
    highlight: { active: ['query:role', 'metric:data'], found: ['rank:data'] },
    explanation: 'A complete spellcheck case study does not stop at nearest edit distance. The BK-tree produces candidates; language frequency, keyboard model, and context choose the suggestion.',
  };

  yield {
    state: bkGraph('BK-tree narrows candidates before ranking'),
    highlight: { active: ['query', 'book', 'books', 'boon'], found: ['boon', 'books'], compare: ['cake'] },
    explanation: 'For a typo like boon?, the tree can return book, books, or boon within the radius. A real system then ranks exact word frequency and context rather than blindly taking the first hit.',
  };

  yield {
    state: labelMatrix(
      'Where it fits',
      [
        { id: 'spell', label: 'spellcheck' },
        { id: 'dedupe', label: 'dedupe names' },
        { id: 'vectors', label: 'vectors' },
        { id: 'substring', label: 'substring' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'neighbor' },
      ],
      [
        ['strong', 'Edit Distance'],
        ['often useful', 'custom metric'],
        ['usually no', 'HNSW/k-d/ANN'],
        ['not direct', 'Suffix/Trie'],
      ],
    ),
    highlight: { found: ['spell:fit', 'dedupe:fit'], compare: ['vectors:neighbor', 'substring:neighbor'] },
    explanation: 'BK-trees are for metric lookup, not substring search and not high-dimensional vector search. The distance function and query radius decide whether the pruning will be useful.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'metric tree') yield* metricTree();
  else if (view === 'radius query') yield* radiusQuery();
  else if (view === 'spellcheck case study') yield* spellcheckCaseStudy();
  else throw new InputError('Pick a BK-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A BK-tree, short for Burkhard-Keller tree, indexes objects in a discrete metric space. Each node stores one object, and each outgoing edge is labeled with the distance from the parent object to the child object. For fuzzy word lookup, the metric is usually Levenshtein edit distance.',
        'The goal is not to make edit distance cheaper. Edit Distance still computes the true distance between two visited strings. The BK-tree reduces how many dictionary words need that expensive dynamic-programming comparison.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion starts at the root. Compute the distance from the new item to the current node. If a child edge with that exact distance exists, follow it. Otherwise create a child under that distance. The same rule applies recursively, so every node partitions descendants by distance from itself.',
        'Querying with radius r uses the triangle inequality. If the query is distance d from the current node, only children whose edge distance k lies between d-r and d+r can contain answers. Any edge outside that band is too close or too far to reach a valid match, so the whole subtree can be pruned.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A complete spellcheck system builds a BK-tree over dictionary words. A user types a misspelling. The system queries the tree with radius 1 or 2, depending on word length and latency budget. Returned candidates are then ranked by edit distance, word frequency, keyboard-neighbor typo likelihood, and language context.',
        'That second ranking stage matters. A BK-tree only says which words are within a metric radius. It does not know that "form" is more likely than "from" in one sentence and less likely in another. The data structure is a candidate generator, not the whole product.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'BK-tree performance depends on the metric distribution and search radius. With small radii and well-spread discrete distances, it can prune heavily. With a large radius or a metric where many items have similar distances, it may visit most of the tree. Worst case is linear.',
        'The structure is easy to update incrementally, but tree shape depends on insertion order and root choice. It is often good enough for medium dictionaries and small edit-distance radii. Large-scale fuzzy search systems may use SymSpell-style deletes, finite-state transducers, n-gram indexes, or specialized Levenshtein automata instead.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The most important pitfall is using a distance that is not a metric. BK-tree pruning relies on the triangle inequality. Some typo costs, weighted edits, or transposition variants may not satisfy the exact property unless defined carefully. If the metric law fails, pruning can drop true answers.',
        'Another misconception is that BK-trees are tries. A Trie follows characters or bytes. A BK-tree follows distance buckets. It can store words, names, hashes under Hamming distance, shapes, or any object with a valid discrete metric.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Burkhard and Keller, "Some approaches to best-match file searching", Communications of the ACM DOI page at https://dl.acm.org/doi/10.1145/362003.362025. Metric-search context: Brin, "Near Neighbor Search in Large Metric Spaces", VLDB PDF at https://www.vldb.org/conf/1995/P574.PDF, and Yianilos, "Data Structures and Algorithms for Nearest Neighbor Search in General Metric Spaces", https://algorithmics.lsi.upc.edu/docs/practicas/p311-yianilos.pdf. Study Edit Distance, Trie, Aho-Corasick Automaton, Finite-State Transducer Static Map, k-d Tree, HNSW Search, and Inverted Index next.',
      ],
    },
  ],
};
