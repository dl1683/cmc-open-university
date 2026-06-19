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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has three views. Each one isolates a different part of the BK-tree story.',
        'In the metric tree view, every edge label is the Levenshtein distance from parent to child -- not an alphabetical comparison. The word "boon" lands under "books" because d(book, boon) = 2 routes it to "books" first, and d(books, boon) = 1 places it there. The tree shape is determined by insertion order and metric values, not spelling order.',
        'In the radius query view, active (blue) nodes are being tested, removed (red) subtrees are pruned by the triangle inequality, and found (green) nodes satisfy the radius constraint. The key inference: if d(query, pivot) = 2 and radius = 1, only child edges in [1, 3] survive. Edge 4 to "cake" is provably impossible.',
        'In the spellcheck case-study view, the tree outputs a candidate set, not a final answer. The animation separates generation from ranking because real correction quality depends on word frequency, keyboard adjacency, and context -- none of which are metric-space operations.',
        {type: 'note', text: 'Edge labels are distances, not characters. Two words that are alphabetically adjacent (e.g. "book" and "boo") may live far apart in the tree if their distances to earlier pivots differ.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Spellcheck, name deduplication, typo-tolerant search, and hash matching all ask the same question: return every stored item within distance r of a query. The distance is expensive to compute -- Levenshtein distance between two words of length m and n costs O(m * n) dynamic programming -- and most stored items are irrelevant.',
        'A BK-tree exists to skip those irrelevant distance computations. It organizes a dictionary by distance from pivot words so that whole subtrees can be proved impossible before any dynamic programming runs against them.',
        {type: 'quote', text: 'Some approaches to best-match file searching.', attribution: 'W.A. Burkhard and R.M. Keller, Communications of the ACM, 1973'},
        'The structure is useful when the application demands guaranteed recall within a stated distance. A spellchecker that promises "all dictionary words within edit distance 2" needs an exact method or a candidate generator with a completeness proof. BK-trees provide that proof through the triangle inequality.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest method is a linear scan. For query q and radius r, compute distance(q, w) for every dictionary word w and keep the words where the result is at most r. This is correct, trivial to implement, and works fine for small dictionaries.',
        {type: 'code', text: 'function linearFuzzySearch(query, dictionary, radius) {\n  const results = [];\n  for (const word of dictionary) {\n    if (levenshtein(query, word) <= radius) {\n      results.push(word);\n    }\n  }\n  return results;\n}', language: 'javascript'},
        'For a 50,000-word dictionary and 6-character words, each Levenshtein call costs roughly 36 operations. The scan runs about 1.8 million cell fills per query. For a desktop application this is tolerable. For a server handling thousands of concurrent requests against a 500,000-word dictionary, it is not.',
        'A trie helps with prefix lookup but does not directly answer "all words near this whole word." Pairing a trie with dynamic programming over trie states (Levenshtein automata) works, but it is a different and more complex solution. The BK-tree attacks a simpler shape: bucket by distance, prune by metric law.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The linear scan pays the full distance computation for every word even though most words are nowhere near the query. For radius 1 against a 200,000-word English dictionary, typically fewer than 30 words match -- but the scan computes 200,000 distances to find them.',
        'The problem is not memory or I/O. It is arithmetic: O(n * m * k) cell fills per query, where n is dictionary size, m is query length, and k is average word length. The scan has no way to skip a word without first computing its distance.',
        {type: 'note', text: 'The wall is specifically about wasted distance computations. A BK-tree does not eliminate distance calls -- it reduces how many are needed by proving that entire groups of words cannot possibly be within radius r.'},
        'What is needed is a way to rule out groups of words using a single distance computation against a representative pivot, rather than computing distance against every individual word.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A BK-tree is a rooted tree where each node stores one word from the dictionary. Each outgoing edge is labeled with the exact distance from the parent word to the child word. A node can have at most one child per distinct distance value.',
        {type: 'diagram', text: '              book (root)\n             /    \\\n        d=1 /      \\ d=4\n           /        \\\n        books      cake\n        /   \\        /  \\\n   d=2/  d=1\\   d=2/  d=1\\\n     /      \\    /      \\\n   boo    boon cook    cape', label: 'BK-tree built from: book, books, cake, boo, boon, cook, cape'},
        'Insertion: compute d = distance(new_word, current_node). If no child exists at edge d, attach new_word there. If a child exists at edge d, recurse into that child and repeat.',
        'Query with radius r: at each node, compute d = distance(query, node.word). If d <= r, report the node as a match. Then visit only child edges k where d - r <= k <= d + r. Skip every other child edge entirely.',
        {type: 'code', text: 'function bkSearch(node, query, radius, results) {\n  const d = levenshtein(query, node.word);\n  if (d <= radius) results.push(node.word);\n  for (const [k, child] of node.children) {\n    if (k >= d - radius && k <= d + radius) {\n      bkSearch(child, query, radius, results);\n    }\n  }\n}', language: 'javascript'},
        'The child map is keyed by integer distance. For Levenshtein distance, a node might have children at distances 1, 2, 3, and so on. The map is usually sparse -- most pivots do not have children at every possible distance value.',
        'An implementation optimization: use a banded edit-distance routine that aborts once the distance exceeds the current radius plus the maximum useful edge label. This early cutoff often matters as much as the tree structure itself.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness proof is a single application of the triangle inequality. Let p be the current pivot, q the query, and x any word in the subtree behind edge k.',
        'By the routing invariant, d(p, x) = k. The query computes d(q, p) = d. The triangle inequality gives: d(q, x) >= |d(q, p) - d(p, x)| = |d - k|.',
        'If |d - k| > r, then d(q, x) > r for every x in that subtree. No word behind edge k can be within radius r of the query, so pruning is safe.',
        {type: 'diagram', text: '  Triangle inequality applied at pivot p:\n\n       q (query)\n      / \\\n  d  /   \\ d(q,x) >= |d - k|\n    /     \\\n   p -----> x\n      k        (routed through edge k)\n\n  Prune edge k when |d - k| > r\n  Visit edge k when |d - k| <= r', label: 'The pruning proof: one inequality, applied at every visited node'},
        'If |d - k| <= r, the subtree might contain answers, so the search descends and computes real distances there. The tree never gives false negatives. It may visit nodes that turn out to be outside the radius, but it never skips a node that is inside.',
        {type: 'note', text: 'The entire pruning guarantee depends on the distance function satisfying all four metric axioms. If the distance is not a true metric -- for example, if it violates symmetry or the triangle inequality -- the tree can silently skip subtrees that contain valid answers.'},
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'There is no universal O(log n) guarantee. BK-tree performance depends on radius, metric distribution, insertion order, alphabet size, word-length variance, and how evenly the distance buckets spread the data.',
        {type: 'table', headers: ['Parameter', 'Effect on query cost', 'Typical behavior'], rows: [
          ['Small radius (r=1)', 'Narrow band [d-1, d+1] prunes most edges', 'Visits 5-15% of nodes for English dictionaries'],
          ['Large radius (r=4)', 'Wide band [d-4, d+4] keeps most edges', 'Visits 40-80% of nodes; approaches linear scan'],
          ['Clustered data', 'Many words at same distance from pivots', 'Flat tree, poor branching, near-linear'],
          ['Well-spread distances', 'Children distributed across many buckets', 'Good branching factor, strong pruning'],
          ['Poor root choice', 'Root that is equidistant to most words', 'Shallow pruning at top level'],
        ]},
        'The worst case is O(n) visited nodes. Each visit pays the full cost of a distance computation -- O(m * k) for Levenshtein on words of length m and k. The total worst case is O(n * m * k), identical to the linear scan.',
        'In practice, for English spellcheck with radius 1-2 over a 100,000-word dictionary, empirical studies report visiting 2-15% of nodes. Doubling the dictionary roughly doubles the tree size but does not double the visited set, because the tree depth grows and each level prunes more branches.',
        'Memory is one node per word plus a sparse child map per node. Overhead is modest compared to n-gram indexes, finite-state transducers, or deletion dictionaries, but the tree can become unbalanced. Insertion order determines root quality, and there is no rebalancing operation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {type: 'bullets', items: [
          'Spellcheck candidate generation: radius 1-2 over a medium dictionary (10k-500k words) with Levenshtein distance. The BK-tree narrows candidates before a frequency/context ranker picks the best correction.',
          'Fuzzy name deduplication: finding all name variants within edit distance 2 in a customer database. The metric is well-defined and the radius is small.',
          'Hamming-distance hash lookup: perceptual hashing (pHash, dHash) produces fixed-length binary strings. Hamming distance is a clean integer metric with small typical radii.',
          'Approximate command matching: CLI tools or chatbots that accept misspelled commands. Dictionary is tiny (hundreds of entries), so even modest pruning helps latency.',
          'Teaching metric-space search: the pruning proof is local and auditable at every node, unlike learned similarity indexes or locality-sensitive hashing.',
        ]},
        'The common thread: a true metric, a small radius, discrete integer distances, and a dictionary that changes infrequently. When all four hold, BK-trees give exact recall with significant speedup over linear scan and far less implementation complexity than Levenshtein automata.',
        'In spellcheck, the BK-tree is a candidate generator, not a complete solution. A production system still ranks candidates by word frequency, keyboard adjacency model, morphological rules, and sentence context. The closest edit distance is not always the best correction.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The distance function must be a true metric. Four axioms must hold:',
        {type: 'table', headers: ['Axiom', 'Rule', 'Violation consequence'], rows: [
          ['Nonnegativity', 'd(a, b) >= 0', 'Distance labels become meaningless'],
          ['Identity', 'd(a, b) = 0 iff a = b', 'Duplicates misrouted or missed'],
          ['Symmetry', 'd(a, b) = d(b, a)', 'Query direction changes results'],
          ['Triangle inequality', 'd(a, c) <= d(a, b) + d(b, c)', 'Pruning skips valid answers -- silent data loss'],
        ]},
        'Some weighted edit costs (asymmetric keyboard distance, phonetic similarity) and learned embedding distances violate the triangle inequality. Using them with a BK-tree produces silent recall failures -- the tree prunes a subtree that actually contains an answer, and no error is raised.',
        'BK-trees do not support prefix search, wildcard matching, substring lookup, or ranked retrieval. They answer one question: "all items within radius r." For full-text search, use an inverted index. For prefix completion, use a trie. For approximate nearest neighbor in high dimensions, use HNSW or locality-sensitive hashing.',
        {type: 'bullets', items: [
          'Large radii erase the pruning benefit. At radius 4 with d=7, the band is [3, 11] -- nearly every child edge survives.',
          'No rebalancing. A bad insertion order puts a poor pivot at the root, degrading every subsequent query.',
          'Static dictionaries only. Deletion is not naturally supported; most implementations rebuild.',
          'High-dimensional continuous metrics (e.g. cosine distance on 768-dim embeddings) produce distance values so dense that bucket pruning is worthless. Use approximate nearest-neighbor indexes instead.',
        ]},
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: W.A. Burkhard and R.M. Keller, "Some approaches to best-match file searching," Communications of the ACM 16(4), 1973. https://dl.acm.org/doi/10.1145/362003.362025',
        'Metric-space search survey: S. Brin, "Near Neighbor Search in Large Metric Spaces," VLDB 1995. https://www.vldb.org/conf/1995/P574.PDF',
        'General metric indexing: P. Yianilos, "Data Structures and Algorithms for Nearest Neighbor Search in General Metric Spaces," SODA 1993. https://algorithmics.lsi.upc.edu/docs/practicas/p311-yianilos.pdf',
        {type: 'table', headers: ['Role', 'Topic', 'Why'], rows: [
          ['Prerequisite', 'Edit Distance', 'The metric that BK-trees most commonly index. Understand the O(m*n) DP table before optimizing how many times you call it.'],
          ['Contrast', 'Trie', 'Tries solve prefix lookup; BK-trees solve radius lookup. Different question shapes, often confused.'],
          ['Extension', 'Levenshtein Automaton', 'For very large dictionaries, a Levenshtein automaton over a trie can be faster than a BK-tree by avoiding per-node DP entirely.'],
          ['Alternative', 'HNSW Search', 'For approximate nearest neighbor in continuous high-dimensional spaces where BK-trees fail.'],
          ['Production', 'Inverted Index', 'Full-text search engines use inverted indexes for candidate retrieval, not metric trees. Understand when each tool fits.'],
        ]},
      ],
    },
  ],
};
