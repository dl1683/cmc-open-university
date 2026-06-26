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
  const rootWord = 'book';
  const children = ['books', 'cake'];
  const distanceType = 'Edit Distance';
  yield {
    state: bkGraph('BK-tree edges are distances from the parent word'),
    highlight: { active: [rootWord, children[0], children[1]], found: ['e-book-books', 'e-book-cake'] },
    explanation: `A BK-tree stores objects from a metric space. Each child edge out of a node is labeled by the distance from the parent object — ${rootWord} has children ${children.join(' and ')}. For words, the distance is often ${distanceType}.`,
    invariant: `All descendants behind an edge labeled k are exactly distance k from that edge's parent.`,
  };

  const newWord = 'boon';
  const insertDistRoot = 2;
  const insertDistChild = 1;
  yield {
    state: labelMatrix(
      'Insertion by distance',
      [
        { id: 'start', label: `new word ${newWord}` },
        { id: 'root', label: `compare ${rootWord}` },
        { id: 'child', label: `compare ${children[0]}` },
        { id: 'place', label: 'place' },
      ],
      [
        { id: 'distance', label: 'distance' },
        { id: 'action', label: 'action' },
      ],
      [
        [`d=${insertDistRoot}`, `follow edge ${insertDistRoot}?`],
        [`no edge ${insertDistRoot}? maybe create`, 'or continue'],
        [`d=${insertDistChild}`, `follow/create edge ${insertDistChild}`],
        [`child under ${children[0]}`, `store ${newWord}`],
      ],
    ),
    highlight: { active: ['root:distance', 'child:distance'], found: ['place:action'] },
    explanation: `Insertion is simple: compute distance to the current node (${rootWord} gives d=${insertDistRoot}), then follow the child with that exact distance. If no such child exists, attach ${newWord} there.`,
  };

  const axioms = ['nonnegative', 'zero iff same', 'symmetric', 'triangle'];
  yield {
    state: labelMatrix(
      'Metric requirements',
      [
        { id: 'nonneg', label: axioms[0] },
        { id: 'zero', label: axioms[1] },
        { id: 'sym', label: axioms[2] },
        { id: 'tri', label: axioms[3] },
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
    explanation: `The ${axioms[3]} inequality is the whole pruning proof — ${axioms.length} axioms are required in total. If a distance function violates it, a BK-tree can skip a subtree that actually contains a valid answer.`,
  };
}

function* radiusQuery() {
  const queryWord = 'boon';
  const radius = 1;
  const dQueryRoot = 2;
  const bandLow = dQueryRoot - radius;
  const bandHigh = dQueryRoot + radius;
  yield {
    state: bkGraph(`Query "${queryWord}" within edit distance ${radius}`),
    highlight: { active: ['query', 'book'], found: [queryWord], compare: ['books', 'boo', 'cook'] },
    explanation: `For query q and radius r, compute d(q,node). If d=${dQueryRoot} and r=${radius}, only child edges in [${bandLow},${bandHigh}] can possibly contain answers. Every other distance bucket is impossible by triangle inequality.`,
    invariant: `Visit only child edges k where d(q,node)-${radius} <= k <= d(q,node)+${radius}.`,
  };

  const cakeEdge = 4;
  const booksEdge = 1;
  yield {
    state: labelMatrix(
      'Prune by distance band',
      [
        { id: 'root', label: 'at book' },
        { id: 'edge1', label: `edge ${booksEdge}` },
        { id: 'edge4', label: `edge ${cakeEdge}` },
        { id: 'answer', label: queryWord },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'decision', label: 'decision' },
      ],
      [
        [`d(query,book)=${dQueryRoot}`, `keep edges ${bandLow}..${bandHigh}`],
        [`${booksEdge} inside band`, 'visit books'],
        [`${cakeEdge} outside band`, 'prune cake'],
        ['d=0', 'report'],
      ],
    ),
    highlight: { active: ['root:decision', 'edge1:decision'], removed: ['edge4:decision'], found: ['answer:decision'] },
    explanation: `If the edge to cake is distance ${cakeEdge} from book, no descendant behind that edge can be within radius ${radius} of a query that is distance ${dQueryRoot} from book. The subtree is safely skipped.`,
  };

  const visitedNodes = ['book', 'books', queryWord];
  const prunedNodes = ['cake', 'cape', 'cook'];
  yield {
    state: bkGraph('Triangle inequality turns a tree walk into a filter'),
    highlight: { active: visitedNodes, removed: prunedNodes, found: [queryWord] },
    explanation: `The search visits ${visitedNodes.length} nodes and prunes ${prunedNodes.length} — it still computes real edit distances for visited nodes. The tree only reduces the number of candidates that need those expensive dynamic-programming computations.`,
  };

  const scenarios = ['small radius', 'large radius', 'bad metric', 'same distances'];
  yield {
    state: labelMatrix(
      'Performance shape',
      [
        { id: 'smallr', label: scenarios[0] },
        { id: 'larger', label: scenarios[1] },
        { id: 'badmetric', label: scenarios[2] },
        { id: 'cluster', label: scenarios[3] },
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
    explanation: `BK-trees are workload-sensitive — ${scenarios.length} scenarios shape performance. They shine with ${scenarios[0]} and discrete distances that distribute words across useful buckets.`,
  };
}

function* spellcheckCaseStudy() {
  const pipelineStages = ['dictionary', 'edit distance', 'mispelling', 'rank results'];
  const radiusRange = '1..2';
  const rankers = ['frequency', 'context'];
  yield {
    state: labelMatrix(
      'Spellcheck pipeline',
      [
        { id: 'dict', label: pipelineStages[0] },
        { id: 'metric', label: pipelineStages[1] },
        { id: 'query', label: pipelineStages[2] },
        { id: 'rank', label: pipelineStages[3] },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'data', label: 'data' },
      ],
      [
        ['build BK-tree', 'known words'],
        ['Levenshtein', `radius ${radiusRange}`],
        ['fuzzy lookup', 'candidates'],
        [`${rankers.join('/')}/keyboard`, 'best correction'],
      ],
    ),
    highlight: { active: ['query:role', 'metric:data'], found: ['rank:data'] },
    explanation: `A complete spellcheck pipeline has ${pipelineStages.length} stages and does not stop at nearest ${pipelineStages[1]}. The BK-tree produces candidates; language ${rankers.join(', ')}, keyboard model choose the suggestion.`,
  };

  const candidates = ['book', 'books', 'boon'];
  const queryTypo = 'boon?';
  yield {
    state: bkGraph('BK-tree narrows candidates before ranking'),
    highlight: { active: ['query', ...candidates], found: ['boon', 'books'], compare: ['cake'] },
    explanation: `For a typo like ${queryTypo}, the tree can return ${candidates.join(', ')} within the radius. A real system then ranks by word ${rankers[0]} and ${rankers[1]} rather than blindly taking the first hit.`,
  };

  const domains = [
    { id: 'spell', label: 'spellcheck', fit: 'strong' },
    { id: 'dedupe', label: 'dedupe names', fit: 'often useful' },
    { id: 'vectors', label: 'vectors', fit: 'usually no' },
    { id: 'substring', label: 'substring', fit: 'not direct' },
  ];
  yield {
    state: labelMatrix(
      'Where it fits',
      domains.map(d => ({ id: d.id, label: d.label })),
      [
        { id: 'fit', label: 'fit' },
        { id: 'neighbor' },
      ],
      [
        [domains[0].fit, 'Edit Distance'],
        [domains[1].fit, 'custom metric'],
        [domains[2].fit, 'HNSW/k-d/ANN'],
        [domains[3].fit, 'Suffix/Trie'],
      ],
    ),
    highlight: { found: ['spell:fit', 'dedupe:fit'], compare: ['vectors:neighbor', 'substring:neighbor'] },
    explanation: `BK-trees are for metric lookup — ${domains[0].label} is ${domains[0].fit}, ${domains[1].label} is ${domains[1].fit}. The distance function and query radius decide whether the pruning will be useful.`,
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
        'The visualization has three views, each isolating a different part of the BK-tree story. Switch between them to see how the tree is built, how queries prune it, and how spellcheck uses the results.',
        'In the metric tree view, every edge label is the Levenshtein distance (edit distance) from the parent word to the child word. This is not an alphabetical tree -- the shape is determined entirely by distances and insertion order. The word "boon" ends up under "books" because d("book", "boon") = 2 routes it to the "books" subtree first, and then d("books", "boon") = 1 places it as a child there.',
        'In the radius query view, blue nodes are actively being tested, red subtrees have been pruned by the triangle inequality, and green nodes are confirmed matches within the query radius. Watch for the pruning moment: when d(query, pivot) = 2 and radius = 1, only child edges labeled 1 through 3 survive. An edge labeled 4 (to "cake") is provably impossible and gets cut without computing any distances inside that subtree.',
        'In the spellcheck case-study view, the tree outputs a candidate set, not a final correction. The animation deliberately separates candidate generation from ranking, because picking the best correction depends on word frequency, keyboard layout, and sentence context -- none of which live inside the metric tree.',
        {type: 'callout', text: 'A BK-tree is useful when distance labels plus the triangle inequality let one expensive comparison rule out whole metric subtrees.'},
        {type: 'image', src: './assets/gifs/bk-tree-metric-spellcheck.gif', alt: 'Animated walkthrough of the bk tree metric spellcheck visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Spellcheckers, name-deduplication systems, typo-tolerant search engines, and perceptual-hash matchers all face the same problem: given a query and a large dictionary, find every entry whose distance to the query is at most some threshold r. The distance function is expensive -- Levenshtein distance between two words of length m and n fills an m-by-n dynamic-programming table -- and the vast majority of dictionary entries are nowhere near the query.',
        'A BK-tree exists to skip those irrelevant distance computations. It organizes a dictionary into a tree where each edge is labeled with the distance from the parent word to the child word. When a query arrives, the tree uses a single distance computation at each visited node to rule out entire subtrees that cannot contain any answer. The mechanism behind this pruning is the triangle inequality, a basic property of any true metric.',
        'The structure was introduced by W.A. Burkhard and R.M. Keller in their 1973 paper "Some approaches to best-match file searching." Their key observation was that if the distance function satisfies the metric axioms, you can partition a set of items by their distance from a pivot and then use the triangle inequality to skip partitions that are provably too far from any future query.',
        'The practical payoff is completeness with speed. A spellchecker that promises "all dictionary words within edit distance 2" needs either an exhaustive scan or a data structure with a mathematical guarantee that nothing is missed. BK-trees provide that guarantee. Every word within the radius is found; the tree only skips words it can prove are outside.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest solution is a linear scan: for a query q and radius r, compute distance(q, w) for every dictionary word w and keep those where the result is at most r. This is correct, trivial to implement, and perfectly adequate for small dictionaries.',
        'Consider the concrete cost. A 50,000-word English dictionary with an average word length of 6 characters means each Levenshtein call fills a 6-by-6 table (36 cell operations). The full scan performs 50,000 of these calls, totaling about 1.8 million cell fills per query. On a modern CPU that runs in a few milliseconds -- fast enough for a desktop app.',
        'Now scale up. A 500,000-word dictionary serving a web application at 1,000 queries per second means 18 billion cell fills per second. That is no longer a rounding error. The linear scan does not degrade gracefully -- its cost is strictly proportional to dictionary size regardless of how many words actually match.',
        'A trie can help with prefix lookup, but it does not directly answer "all words within edit distance 2 of this whole word." Pairing a trie with Levenshtein automata is one powerful solution, but it is significantly more complex to implement. The BK-tree attacks the problem from a different angle: partition by distance, prune by metric law, and keep the implementation simple enough to fit in a few dozen lines of code.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The linear scan computes a full distance for every word even though most words are irrelevant. For radius 1 against a 200,000-word English dictionary, typically fewer than 30 words match -- but the scan still computes all 200,000 distances to find them. That is a ratio of roughly 6,700 wasted computations per useful result.',
        'The bottleneck is not memory or I/O. It is pure arithmetic: O(n * m * k) cell fills per query, where n is dictionary size, m is query length, and k is average word length. Every word pays the full price of a dynamic-programming table whether it is edit distance 1 or edit distance 15 from the query.',
        'The scan has no mechanism to skip a word without first computing its distance. You cannot look at a word and say "this is obviously too far" without doing the work. What we need is a way to use one distance computation against a representative pivot to rule out an entire group of words at once, rather than checking them individually.',
        'This is the structural gap that the BK-tree fills. It turns a single distance computation at a pivot node into a proof that every word routed through certain edges is too far away to matter. The groups that are skipped never pay any arithmetic cost at all.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The triangle inequality is the engine behind all BK-tree pruning. It says: for any three points a, b, c in a metric space, d(a, c) is at least |d(a, b) - d(b, c)|. In plain terms, the distance from a to c cannot be less than the absolute difference of the distances from a to b and from b to c. This is the same principle that tells you the third side of a triangle cannot be shorter than the difference of the other two sides.',
        'Here is how the BK-tree exploits this. Suppose the search is at a pivot node p, the query is q, and there is a subtree hanging off edge k. Every word x in that subtree was routed there during insertion because d(p, x) = k. The search computes d(q, p) = d. Now apply the triangle inequality: d(q, x) >= |d(q, p) - d(p, x)| = |d - k|.',
        'If |d - k| > r (the search radius), then d(q, x) > r for every single word x behind that edge. No word in that subtree can possibly be within the radius. The entire subtree is pruned with zero additional distance computations.',
        'If |d - k| <= r, the subtree might contain answers, so the search descends into it and checks further. The key guarantee is one-sided: pruning never discards a valid answer, but it may visit nodes that turn out to be outside the radius. There are no false negatives, only false positives that get filtered by actual distance computation.',
        'The pruning band is [d - r, d + r]. For small radii this band is narrow. With d = 3 and r = 1, only edges labeled 2, 3, or 4 survive. If a node has children at edges 1, 2, 3, 5, and 7, only edges 2 and 3 are visited -- the other three subtrees are provably irrelevant. The smaller the radius relative to the spread of edge labels, the more aggressively the tree prunes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A BK-tree is a rooted tree where each node stores one word from the dictionary. Each outgoing edge from a node is labeled with the exact distance from that node\'s word to the child node\'s word. A critical invariant: each node can have at most one child per distinct distance value. If two words are both distance 3 from a pivot, the first one becomes the child at edge 3, and the second one recurses into that child to find its own position deeper in the tree.',
        {type: 'image', src: 'https://signal-to-noise.xyz/static/images/bk-tree-2.png', alt: 'BK-tree of words with edit-distance edge labels.', caption: 'BK-tree edges are metric distances from each pivot word, not character choices. (Source: signal-to-noise.xyz)'},
        'Insertion works by walking from the root. Compute d = distance(new_word, current_node.word). If current_node has no child at edge d, attach new_word there. If a child already exists at edge d, recurse into that child and repeat the process. Each word finds a unique slot by following the chain of distance computations until it reaches an empty edge.',
        'Consider building a tree from the words "book", "books", "cake", "boo", "boon", "cook", "cape" in that insertion order. "book" becomes the root. "books" has d("book", "books") = 1, so it attaches at edge 1. "cake" has d("book", "cake") = 4, attaching at edge 4. "boo" has d("book", "boo") = 1, but edge 1 is taken by "books", so we recurse into "books" and compute d("books", "boo") = 2 -- edge 2 is free, so "boo" attaches there. "boon" similarly recurses to "books" (d = 2, edge taken by "boo"), then to "boo" where d("boo", "boon") = 1 and attaches. "cook" goes to "cake" (d("book","cook")=1 is taken, recurse to "books", d("books","cook")=2 is taken by "boo", recurse there, d("boo","cook")=2) and finds its spot. "cape" attaches under "cake" at d("cake","cape")=1.',
        'Querying with radius r works recursively from the root. At each node, compute d = distance(query, node.word). If d <= r, add the word to the result set. Then, for every child edge labeled k, check whether |d - k| <= r. If yes, recurse into that child. If no, skip the entire subtree. This is the only decision -- and it is the triangle inequality doing the work.',
        'The child map at each node is keyed by integer distance values. For Levenshtein distance, edges are typically labeled with small integers (1, 2, 3, ...). The map is usually sparse because most pivots do not have children at every possible distance value. A practical optimization is to use a banded edit-distance routine that aborts computation once the running distance exceeds radius + max_edge_label, since any result beyond that threshold is useless for both matching and pruning decisions.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness proof is a single application of the triangle inequality, applied at every visited node. Let p be the current pivot, q the query, and x any word in the subtree behind edge k. By the routing invariant (how insertion placed x), we know d(p, x) = k exactly. The search computes d(q, p) = d.',
        'The triangle inequality states d(q, x) >= |d(q, p) - d(p, x)| = |d - k|. This is a lower bound on the true distance from the query to every word in that subtree. If this lower bound already exceeds r, the true distance must also exceed r, so every word behind that edge is outside the search radius. Pruning is safe.',
        'When |d - k| <= r, the lower bound does not rule out the subtree, so the search descends and computes actual distances. Some of these words may still be outside the radius -- the lower bound is not tight. But critically, no word inside the radius is ever skipped. The tree has perfect recall: zero false negatives.',
        'This guarantee depends entirely on the distance function being a true metric. A metric must satisfy four axioms: d(a, b) >= 0 (non-negativity), d(a, b) = 0 if and only if a = b (identity of indiscernibles), d(a, b) = d(b, a) (symmetry), and d(a, c) <= d(a, b) + d(b, c) (triangle inequality). Standard Levenshtein distance satisfies all four. Hamming distance satisfies all four. But some weighted or asymmetric edit costs do not.',
        'If the distance function violates the triangle inequality, the lower bound |d - k| can be wrong. The tree will prune subtrees that actually contain valid answers, and no error is raised. The failure is silent. This is the single most important implementation caveat: verify that your distance function is a true metric before building a BK-tree on top of it.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'There is no universal O(log n) guarantee for BK-tree queries. Performance depends on the search radius, the distribution of distances in the dictionary, the insertion order (which determines the root pivot and tree shape), and how evenly the distance values spread the data across child edges.',
        'The worst case is O(n) visited nodes. Each visit pays the full cost of a distance computation, which is O(m * k) for Levenshtein distance on words of length m and k. The total worst case is therefore O(n * m * k), identical to the linear scan. This worst case occurs when the radius is large or the data is clustered so that most edge labels fall within the pruning band.',
        'With a small radius (r = 1), the pruning band is [d - 1, d + 1] -- only three possible edge labels survive at each node. For English dictionaries, empirical studies consistently report that radius-1 queries visit 5-15% of nodes. At radius 2, the band widens to [d - 2, d + 2] (five labels), and visited nodes rise to 10-25%. By radius 4, the band is so wide that 40-80% of nodes are visited, approaching linear-scan cost.',
        {type: 'image', src: 'https://seekstorm.com/blog/assets/images/bktree_benchmark12.png', alt: 'Benchmark chart of Levenshtein calculations per fuzzy search.', caption: 'Radius and algorithm choice determine how many edit-distance computations survive pruning. (Source: seekstorm.com)'},
        'Scaling behavior is sub-linear in practice. Doubling the dictionary roughly doubles the tree size but does not double the number of visited nodes, because the tree grows deeper and each additional level provides another pruning opportunity. For a 100,000-word English dictionary at radius 1, expect roughly 5,000-15,000 distance computations per query instead of 100,000.',
        'Memory cost is one node per word plus a sparse child map (hash map or sorted array of integer-to-pointer pairs) per node. This is modest compared to n-gram indexes or finite-state transducers. The main structural weakness is that the tree has no rebalancing operation. A poor first-insertion word becomes the root pivot, and if that word happens to be equidistant to most of the dictionary, the top-level pruning is weak for every future query.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Spellcheck candidate generation is the textbook application. A spellchecker receives a misspelled word, queries the BK-tree with radius 1 or 2, and gets back every dictionary word within that edit distance. This candidate set is then ranked by word frequency, keyboard adjacency, and language-model context to pick the best correction. The BK-tree handles the recall guarantee; the ranker handles precision.',
        'Fuzzy name deduplication in databases uses the same pattern. Customer records contain variant spellings ("Catherine" vs. "Katherine" vs. "Katharine"), and a BK-tree over the name column with radius 2 finds all plausible duplicates without scanning every pair. The metric is well-defined, the radius is small, and the dictionary (the existing name set) changes slowly.',
        'Perceptual hash matching is another clean fit. Image fingerprinting algorithms like pHash and dHash produce fixed-length binary strings. Hamming distance between these strings is a true metric with small integer values (typically 0-64 for a 64-bit hash). A BK-tree indexed by Hamming distance finds all near-duplicate images within a given bit-flip threshold.',
        'Command-line tools and chatbots use BK-trees for approximate command matching. The dictionary is tiny (a few hundred valid commands), so even modest pruning helps latency. More importantly, the guarantee of finding all commands within edit distance 1 means the "did you mean...?" suggestion never misses a close match.',
        'BK-trees also serve well as teaching tools for metric-space search. The pruning proof is local and auditable at every node -- you can verify by hand that each pruning decision is correct. This makes the BK-tree a good stepping stone before studying more complex structures like vantage-point trees or locality-sensitive hashing.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The distance function must be a true metric satisfying all four axioms: non-negativity (d(a,b) >= 0), identity of indiscernibles (d(a,b) = 0 iff a = b), symmetry (d(a,b) = d(b,a)), and the triangle inequality (d(a,c) <= d(a,b) + d(b,c)). Standard Levenshtein distance satisfies these. But some weighted edit distances with asymmetric costs (e.g., keyboard-adjacency weights where inserting "a" costs differently from inserting "s") violate symmetry or the triangle inequality. Using a non-metric distance with a BK-tree produces silent recall failures -- the tree prunes subtrees that actually contain valid answers, and no error is raised.',
        'Large radii destroy the pruning benefit. At radius 4 with d = 7, the pruning band is [3, 11] -- nearly every child edge at every node survives. The search degenerates into a near-complete tree traversal, paying the overhead of recursive descent with almost no pruning payoff. If your application needs radius 4 or more, a linear scan may actually be faster due to simpler memory-access patterns.',
        'The tree has no rebalancing operation. The first word inserted becomes the root, and the root\'s distance distribution to the rest of the dictionary determines how well the top level prunes. A poor root choice (a word equidistant from most others) weakens every subsequent query. Some implementations mitigate this by choosing the root deliberately -- picking a word near the median of pairwise distances -- but this requires a preprocessing pass.',
        'BK-trees are designed for static dictionaries. Deletion is not naturally supported because removing a node requires re-inserting all of its descendants. Most implementations either rebuild the tree or use soft-delete markers and periodic reconstruction. If your dictionary changes frequently, the maintenance cost may exceed the query savings.',
        'High-dimensional continuous metrics produce distance values so densely packed that bucket pruning becomes worthless. Cosine distance on 768-dimensional embeddings, for example, produces distance values that cluster in a narrow range, and nearly every edge label falls within any reasonable pruning band. For these spaces, use approximate nearest-neighbor indexes like HNSW or locality-sensitive hashing instead.',
        'Finally, BK-trees answer exactly one question: "all items within radius r." They do not support prefix search, wildcard matching, substring lookup, or ranked retrieval by relevance. For prefix completion, use a trie. For full-text search, use an inverted index. The BK-tree is a specialist, not a general-purpose search structure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Build a BK-tree from these seven words in order: "book", "books", "cake", "boo", "boon", "cook", "cape". The distance function is standard Levenshtein (edit distance). "book" becomes the root.',
        '"books" is inserted: d("book", "books") = 1 (one insertion). Edge 1 from the root is empty, so "books" attaches there. "cake" is inserted: d("book", "cake") = 4 (substitute b->c, substitute o->a, substitute o->k, substitute k->e). Edge 4 is empty, so "cake" attaches at edge 4 from the root.',
        '"boo" is inserted: d("book", "boo") = 1. Edge 1 from root is taken by "books", so recurse into "books". d("books", "boo") = 2 (delete k, delete s). Edge 2 from "books" is empty, so "boo" attaches there. "boon" is inserted: d("book", "boon") = 2. Edge 2 from root is empty, so "boon" attaches at edge 2 from root.',
        '"cook" is inserted: d("book", "cook") = 1. Edge 1 from root is taken, recurse into "books". d("books", "cook") = 3. Edge 3 from "books" is empty, so "cook" attaches there. "cape" is inserted: d("book", "cape") = 4. Edge 4 from root is taken by "cake", recurse into "cake". d("cake", "cape") = 1. Edge 1 from "cake" is empty, so "cape" attaches there.',
        'Now query: find all words within radius r = 1 of the query "coke". Start at root "book". Compute d("coke", "book") = 2 (substitute c->b, substitute k->o... actually let us be precise: "coke" -> "book" requires substitute c->b, keep o, substitute k->o, substitute e->k = 3 edits. Wait -- let us use the standard DP table). The DP table for "coke" vs "book": row 0 = [0,1,2,3,4], row 1 (c): [1,1,2,3,4], row 2 (o): [2,2,1,2,3], row 3 (k): [3,3,2,2,3], row 4 (e): [4,4,3,3,3]. So d("coke","book") = 3.',
        'With d = 3 and r = 1, the pruning band is [3 - 1, 3 + 1] = [2, 4]. The root "book" has children at edges 1 ("books"), 2 ("boon"), and 4 ("cake"). Edge 1 is outside [2, 4], so the entire "books" subtree (which contains "boo" and "cook") is pruned -- three words skipped with zero distance computations. Edge 2 and edge 4 survive.',
        'Recurse into "boon" (edge 2). d("coke", "boon") = 3 (DP table: c->b, o->o, k->o, e->n gives 3). Since 3 > 1, "boon" is not a match. "boon" has no children, so backtrack.',
        'Recurse into "cake" (edge 4). d("coke", "cake") = 1 (substitute o->a). Since 1 <= 1, "cake" is a match. The pruning band at "cake" is [1 - 1, 1 + 1] = [0, 2]. "cake" has one child at edge 1 ("cape"). Edge 1 is inside [0, 2], so recurse. d("coke", "cape") = 2 (substitute o->a, substitute k->p). Since 2 > 1, "cape" is not a match. No more children.',
        'Final result: the query "coke" with radius 1 returns {"cake"}. The tree computed 4 distances (book, boon, cake, cape) instead of 7 (the full dictionary). The "books" subtree with 3 words was pruned entirely by the triangle inequality at the root, saving 3 expensive Levenshtein computations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original paper is W.A. Burkhard and R.M. Keller, "Some approaches to best-match file searching," Communications of the ACM 16(4), 1973. It introduces the distance-partitioning idea and proves the triangle-inequality pruning guarantee. Available at https://dl.acm.org/doi/10.1145/362003.362025.',
        'For a broader survey of metric-space search structures (including vantage-point trees, which use the same triangle-inequality principle with a different partitioning strategy), see S. Brin, "Near Neighbor Search in Large Metric Spaces," VLDB 1995. Available at https://www.vldb.org/conf/1995/P574.PDF.',
        'P. Yianilos, "Data Structures and Algorithms for Nearest Neighbor Search in General Metric Spaces," SODA 1993, covers the theoretical foundations of metric indexing more broadly. Available at https://algorithmics.lsi.upc.edu/docs/practicas/p311-yianilos.pdf.',
        'Study Edit Distance before this topic if you have not already -- it is the metric function that BK-trees most commonly index, and understanding the O(m*n) dynamic-programming table is essential before you start optimizing how many times you call it. Study Tries as a contrast: tries solve prefix lookup, BK-trees solve radius lookup, and the two are often confused even though they answer fundamentally different questions.',
        'For scaling beyond BK-trees, study Levenshtein Automata, which avoid per-node dynamic programming entirely by building a finite automaton that accepts all strings within edit distance r. For approximate nearest neighbor in continuous high-dimensional spaces (where BK-trees fail), study HNSW (Hierarchical Navigable Small World) graphs. For production full-text search, study Inverted Indexes -- search engines use them for candidate retrieval, not metric trees.',
      ],
    },
  ],
};
