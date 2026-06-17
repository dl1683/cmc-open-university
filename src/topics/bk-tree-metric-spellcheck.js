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
      heading: `Why This Exists`,
      paragraphs: [
        `A BK-tree exists for exact fuzzy lookup in a discrete metric space. In spellcheck, dedupe, typo-tolerant search, hash matching, and name matching, the question is often: return every stored item within distance r of the query.`,
        `The expensive part is not only scanning memory. Edit distance and similar metrics can require real computation for every candidate. A BK-tree tries to avoid those distance calls by proving that whole subtrees cannot contain an answer.`,
        `The structure is useful when the application needs recall within a stated distance, not merely a good-looking similarity score. A spellchecker that promises "all dictionary words within edit distance two" needs an exact metric search method or a candidate generator with a separate completeness argument.`,
      ],
    },
    {
      heading: `Naive Baseline and Wall`,
      paragraphs: [
        `The baseline is a linear scan. For a query word q, compute Edit Distance(q, word) for every dictionary entry and keep the words with distance at most r. This is exact and often good enough for small dictionaries.`,
        `The wall is that most words are irrelevant, but the scan cannot know that until it pays for the distance computation. For radius 1 or 2, a metric law should be able to rule out large groups before running dynamic programming against every word.`,
        `A trie improves prefix lookup but does not directly answer "near this whole word" unless it is paired with dynamic programming over trie states. A BK-tree attacks a different shape: the query has a radius in a metric space, and the index stores distance buckets that make some branches impossible.`,
      ],
    },
    {
      heading: `Core Insight and Invariant`,
      paragraphs: [
        `Organize objects by their distance from pivots. Each node stores one object. Each outgoing edge is labeled by the exact distance from the parent object to the child object. Insertion follows the edge with the computed distance, creating a new child when that distance bucket is empty.`,
        `The invariant is bucketed distance from each pivot: every item in the subtree behind edge k from node p was routed through that edge because its distance to p was k. During a radius query, the triangle inequality turns the current distance d(q, p) into a safe edge band: only k in [d - r, d + r] can still contain answers.`,
        `The pivot is not a median and the tree is not ordered alphabetically. It is a decision tree over distances. Two words that sort near each other may live far apart if their edit distance to earlier pivots differs, while words with different spellings may share a bucket because they are equally far from a pivot.`,
      ],
    },
    {
      heading: 'Animation Meaning',
      paragraphs: [
        `In the metric tree view, each edge label is an edit-distance bucket from the parent word, not a sorted-order comparison. The path for boon is determined by distances to book and then books, which is why the tree shape depends on insertion order and metric distribution.`,
        `In the radius query view, the main idea is the band test. If the query is distance 2 from book and r=1, only child edges 1 through 3 are possible. The edge 4 subtree is removed because the triangle inequality proves it cannot contain a word within radius 1.`,
        `In the spellcheck case-study view, the output of the tree is a candidate set. The animation separates candidate generation from ranking because real correction quality depends on frequency, keyboard mistakes, morphology, and context after the metric search is finished.`,
      ],
    },
    {
      heading: `Mechanics`,
      paragraphs: [
        `To insert a word, compare it with the current node's word. If the distance is zero, treat it as a duplicate or update the payload. If there is a child edge with that exact distance, recurse into that child. Otherwise attach the new word as a child labeled with that distance.`,
        `To query q with radius r, compute d = distance(q, node.word). Report the node if d <= r. Then visit only child edges k where d - r <= k <= d + r. Every visited node still requires a real distance computation; the tree's job is to reduce how many nodes are visited.`,
        `The child map is usually keyed by integer distance. For Levenshtein distance over words, that means a node can have child buckets 1, 2, 3, and so on. Sparse maps are common because most pivots do not have children at every possible distance.`,
        `Distance evaluation should accept an early cutoff when the query radius is small. A banded edit-distance routine can stop once it proves the distance exceeds the current radius or a pruning threshold. That optimization often matters as much as the tree shape.`,
      ],
    },
    {
      heading: `Correctness`,
      paragraphs: [
        `Let p be the current pivot word, q the query, and x any word in the subtree behind edge k. By the BK-tree routing invariant, d(p, x) = k. The query has d(q, p) = d. The triangle inequality implies d(q, x) >= |d - k|.`,
        `If |d - k| > r, then every x in that subtree is farther than r from q, so pruning the whole subtree is safe. If |d - k| <= r, the subtree might contain answers, so the search must descend and compute real distances there. Correctness depends on the distance function being a true metric.`,
      ],
    },
    {
      heading: `Cost and Tradeoffs`,
      paragraphs: [
        `There is no universal O(log n) guarantee. Performance depends on radius, metric distribution, root choice, insertion order, alphabet, word lengths, and how concentrated the distance buckets are. Small radii over well-spread discrete distances can prune heavily; large radii or clustered data can visit most nodes.`,
        `The worst case is linear visits, and each visited node still pays for the distance function. For Levenshtein distance, that may mean dynamic programming over word lengths unless the implementation uses banded distance, early cutoff at r, caching, or specialized automata.`,
        `Memory overhead is modest compared with structures that store many grams or automaton states, but the tree can become unbalanced. Insertion order can place a poor pivot at the root, and repeated near-duplicates can create long chains in the same few buckets.`,
        `A larger radius also widens every band. If d is 7 and r is 4, the query must consider child buckets 3 through 11. That can erase the pruning benefit, especially when the data is dense in the metric space.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Start with a clean metric contract. The distance function should be deterministic, symmetric, and triangle-inequality respecting. If the product wants asymmetric keyboard costs, pronunciation weights, or learned similarity, use the BK-tree only if those weights still satisfy the metric rules or treat it as a heuristic index that needs recall testing.`,
        `Keep payloads separate from index keys. A node can store the canonical word and a list of document ids, dictionary entries, or normalized forms. For spellcheck, normalize case and Unicode before indexing, but preserve the original surface forms for ranking and display.`,
        `Measure visited nodes, distance calls, candidate count, and final correction accuracy. A BK-tree can look fast in microbenchmarks while producing too many candidates for the ranker or missing product expectations because the chosen radius is wrong for the language and vocabulary.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Use the animation's query boon with radius 1. At root book, Edit Distance(boon, book) = 2, so book is not reported unless the allowed radius were at least 2. The search band is child edges 1 through 3.`,
        `The edge to books has label 1, so it is visited. The edge to cake has label 4, so it is pruned: any word behind cake was routed through distance 4 from book, and |4 - 2| = 2 > 1. Under books, the search can find boon at distance 0 and report it. Nearby candidates such as boo or books may be compared depending on their local edge labels and distances.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `BK-trees win for exact radius search over discrete metrics with small radii: medium-sized dictionaries, typo correction, approximate command lookup, fuzzy user-name dedupe, Hamming-distance hashes, and other cases where insertion is useful and approximate nearest-neighbor indexes would be overkill.`,
        `In spellcheck, the BK-tree should be treated as candidate generation. A production system still needs ranking by word frequency, keyboard adjacency, morphology, domain vocabulary, and sentence context. The closest edit distance is not always the best correction.`,
        `They are also good teaching tools because the pruning proof is local. At each pivot the tree can justify exactly why a bucket is searched or skipped, which makes the algorithm easier to audit than a learned similarity index.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `The distance must be a metric: nonnegative, symmetric, zero only for equal items, and triangle-inequality respecting. Some weighted edit costs, asymmetric typo models, and custom similarity scores violate that contract. If the metric law fails, the tree can prune a subtree that actually contains an answer.`,
        `BK-trees are also not tries or substring indexes. They do not support prefix traversal, wildcard matching, or full-text search. For very large spellcheck systems, n-gram indexes, deletion dictionaries, finite-state transducers, Levenshtein automata, or search-engine candidate generation may be faster and easier to tune.`,
      ],
    },
    {
      heading: `Sources and Study Next`,
      paragraphs: [
        `Primary source: Burkhard and Keller, "Some approaches to best-match file searching", Communications of the ACM DOI page at https://dl.acm.org/doi/10.1145/362003.362025. Metric-search context: Brin, "Near Neighbor Search in Large Metric Spaces", VLDB PDF at https://www.vldb.org/conf/1995/P574.PDF, and Yianilos, "Data Structures and Algorithms for Nearest Neighbor Search in General Metric Spaces", https://algorithmics.lsi.upc.edu/docs/practicas/p311-yianilos.pdf.`,
        `Study Edit Distance for the metric, Trie and Aho-Corasick Automaton for prefix and multi-pattern search contrasts, Finite-State Transducer Static Map for compact dictionaries, k-d Tree for low-dimensional geometry, HNSW Search for approximate vector search, and Inverted Index for full-text candidate retrieval.`,
      ],
    },
  ],
};
