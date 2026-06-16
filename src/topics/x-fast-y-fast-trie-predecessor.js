// X-fast and Y-fast tries: hash bit-prefixes to beat comparison-tree
// predecessor bounds, then use indirection to keep the space linear.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'x-fast-y-fast-trie-predecessor',
  title: 'X-Fast & Y-Fast Tries',
  category: 'Data Structures',
  summary: 'Integer predecessor search with bit prefixes: X-fast hashes every level, while Y-fast keeps sampled representatives plus small balanced buckets.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['x-fast level search', 'y-fast indirection', 'predecessor case study'], defaultValue: 'x-fast level search' },
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

function xFastGraph(title) {
  return graphState({
    nodes: [
      { id: 'q', label: 'q', x: 0.8, y: 4.2, note: '1010' },
      { id: 'l0', label: 'L0', x: 2.6, y: 1.0 },
      { id: 'l1', label: 'L1', x: 2.6, y: 2.7 },
      { id: 'l2', label: 'L2', x: 2.6, y: 4.4 },
      { id: 'l3', label: 'L3', x: 2.6, y: 6.1 },
      { id: 'miss', label: 'gap', x: 4.9, y: 6.1, note: 'ptrs' },
      { id: 'pred', label: '1001', x: 7.1, y: 6.8, note: 'pred' },
      { id: 'succ', label: '1100', x: 7.1, y: 2.0, note: 'succ' },
      { id: 'leaves', label: 'list', x: 9.1, y: 4.5, note: 'sorted' },
    ],
    edges: [
      { id: 'e-q-l2', from: 'q', to: 'l2', weight: '' },
      { id: 'e-l0-l1', from: 'l0', to: 'l1', weight: '' },
      { id: 'e-l1-l2', from: 'l1', to: 'l2', weight: '' },
      { id: 'e-l2-l3', from: 'l2', to: 'l3', weight: '' },
      { id: 'e-l3-miss', from: 'l3', to: 'miss', weight: '' },
      { id: 'e-miss-pred', from: 'miss', to: 'pred', weight: '' },
      { id: 'e-miss-succ', from: 'miss', to: 'succ', weight: '' },
      { id: 'e-pred-leaves', from: 'pred', to: 'leaves', weight: '' },
      { id: 'e-succ-leaves', from: 'succ', to: 'leaves', weight: '' },
    ],
  }, { title });
}

function yFastGraph(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'query 53', x: 0.8, y: 4.0, note: 'integer key' },
      { id: 'top', label: 'x-fast reps', x: 3.0, y: 2.0, note: '16, 48, 80' },
      { id: 'rep48', label: 'rep 48', x: 5.1, y: 2.0, note: 'chosen' },
      { id: 'b0', label: 'bucket A', x: 5.1, y: 4.1, note: '16..47' },
      { id: 'b1', label: 'bucket B', x: 7.2, y: 4.1, note: '48..79' },
      { id: 'bst', label: 'small BST', x: 8.9, y: 4.1, note: 'O(log log U)' },
      { id: 'ans', label: '56', x: 8.9, y: 2.0, note: 'successor' },
    ],
    edges: [
      { id: 'e-query-top', from: 'query', to: 'top', weight: 'succ rep' },
      { id: 'e-top-rep48', from: 'top', to: 'rep48', weight: 'x-fast' },
      { id: 'e-rep48-b0', from: 'rep48', to: 'b0', weight: 'neighbor' },
      { id: 'e-rep48-b1', from: 'rep48', to: 'b1', weight: 'owner' },
      { id: 'e-b1-bst', from: 'b1', to: 'bst', weight: 'search' },
      { id: 'e-bst-ans', from: 'bst', to: 'ans', weight: 'return' },
    ],
  }, { title });
}

function* xFastLevelSearch() {
  yield {
    state: xFastGraph('X-fast stores every trie level in hash tables'),
    highlight: { active: ['q', 'l1', 'l2'], found: ['pred', 'succ'] },
    explanation: 'An X-fast trie is a binary trie over fixed-width integer keys, but every level has a hash table of prefixes. A query binary-searches the levels to find the deepest prefix that exists.',
    invariant: 'Every real leaf has all of its prefixes registered in the level-search structure.',
  };

  yield {
    state: labelMatrix(
      'Binary search over prefixes of 1010',
      [
        { id: 'p0', label: 'prefix ""' },
        { id: 'p1', label: 'prefix 1' },
        { id: 'p2', label: 'prefix 10' },
        { id: 'p3', label: 'prefix 101' },
        { id: 'p4', label: 'prefix 1010' },
      ],
      [
        { id: 'hash', label: 'hash?' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['hit', 'root exists'],
        ['hit', 'some 1xxx key'],
        ['hit', 'some 10xx key'],
        ['miss', 'branch absent'],
        ['miss', 'key absent'],
      ],
    ),
    highlight: { active: ['p2:hash', 'p3:hash'], found: ['p2:meaning'], compare: ['p4:meaning'] },
    explanation: 'The level search is the trick. Instead of walking all w bits, it probes prefix lengths by binary search. That gives O(log w), which is O(log log U) when U is the integer universe.',
  };

  yield {
    state: xFastGraph('Descendant pointers turn the boundary into an answer'),
    highlight: { active: ['l2', 'miss', 'e-l3-miss'], found: ['pred', 'succ', 'leaves'] },
    explanation: 'Once the lowest existing ancestor is known, the missing side tells where the query would have gone. Descendant pointers and the leaf linked list recover predecessor or successor in constant additional time.',
  };

  yield {
    state: labelMatrix(
      'X-fast tradeoff',
      [
        { id: 'query', label: 'query' },
        { id: 'update', label: 'update' },
        { id: 'space', label: 'space' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        { id: 'bound', label: 'bound' },
        { id: 'why', label: 'why' },
      ],
      [
        ['O(log log U)', 'level search'],
        ['O(log U)', 'add all prefixes'],
        ['O(n log U)', 'prefix copies'],
        ['fast but bulky', 'sets up Y-fast'],
      ],
    ),
    highlight: { found: ['query:bound', 'lesson:why'], compare: ['space:bound', 'update:bound'] },
    explanation: 'X-fast tries show how integer keys beat comparison trees, but the space bill is high because every key contributes many prefixes. Y-fast tries keep the query idea and fix the space.',
  };
}

function* yFastIndirection() {
  yield {
    state: yFastGraph('Y-fast adds indirection: representatives above, buckets below'),
    highlight: { active: ['query', 'top', 'rep48'], found: ['b1', 'bst'] },
    explanation: 'A Y-fast trie samples representatives into an X-fast trie. The actual keys live in small balanced buckets of consecutive values. This is indirection: a sparse top index points to dense local structures.',
    invariant: 'Each bucket is kept around O(log U) keys, so searching inside a bucket costs O(log log U).',
  };

  yield {
    state: labelMatrix(
      'Where a query looks',
      [
        { id: 'rep', label: 'find rep' },
        { id: 'neighbor', label: 'check neighbor' },
        { id: 'bucket', label: 'search bucket' },
        { id: 'answer', label: 'return bound' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['x-fast successor rep', 'O(log log U)'],
        ['adjacent rep pointer', 'O(1)'],
        ['balanced mini tree', 'O(log log U)'],
        ['pred/succ key', 'O(1)'],
      ],
    ),
    highlight: { active: ['rep:cost', 'bucket:cost'], found: ['answer:work'] },
    explanation: 'The representative found by the top index is enough to identify one or two candidate buckets. Because buckets are small, ordinary balanced-tree search inside them preserves the log-log bound.',
  };

  yield {
    state: labelMatrix(
      'Split and merge discipline',
      [
        { id: 'insert', label: 'insert' },
        { id: 'large', label: 'too large' },
        { id: 'delete', label: 'delete' },
        { id: 'small', label: 'too small' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['add to bucket', 'maybe split'],
        ['> 2 log U', 'new rep'],
        ['remove from bucket', 'maybe merge'],
        ['underfull', 'borrow/merge'],
      ],
    ),
    highlight: { found: ['large:repair', 'small:repair'], active: ['insert:event', 'delete:event'] },
    explanation: 'Y-fast tries pay update work only when buckets drift too far from their target size. The top X-fast index has only one representative per bucket, so total space becomes linear.',
  };

  yield {
    state: labelMatrix(
      'Compared with neighbors',
      [
        { id: 'bst', label: 'balanced BST' },
        { id: 'skip', label: 'skip list' },
        { id: 'veb', label: 'vEB' },
        { id: 'yfast', label: 'Y-fast' },
      ],
      [
        { id: 'query', label: 'pred/succ' },
        { id: 'constraint', label: 'constraint' },
      ],
      [
        ['O(log n)', 'comparison keys'],
        ['expected O(log n)', 'random lanes'],
        ['O(log log U)', 'universe layout'],
        ['O(log log U)', 'integer universe'],
      ],
    ),
    highlight: { found: ['yfast:query', 'veb:query'], compare: ['bst:query', 'skip:query'] },
    explanation: 'The important comparison is not only speed. X-fast/Y-fast tries require bounded integer keys and careful hashing. Balanced trees and skip lists work for arbitrary comparable keys.',
  };
}

function* predecessorCaseStudy() {
  yield {
    state: labelMatrix(
      'Case study: timestamp predecessor index',
      [
        { id: 'append', label: 'append event' },
        { id: 'point', label: 'point lookup' },
        { id: 'pred', label: 'last before t' },
        { id: 'range', label: 'range scan' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'structure', label: 'structure' },
      ],
      [
        ['new integer time', 'bucket insert'],
        ['exact key?', 'hash + bucket'],
        ['floor(t)', 'Y-fast query'],
        ['walk forward', 'leaf order'],
      ],
    ),
    highlight: { active: ['pred:need', 'pred:structure'], found: ['range:structure'] },
    explanation: 'Imagine an in-memory event index keyed by integer microsecond timestamps. Queries often ask for the last event before t, then scan forward. That is a predecessor problem first and an iteration problem second.',
  };

  yield {
    state: yFastGraph('The top index narrows to one timestamp bucket'),
    highlight: { active: ['query', 'top', 'rep48', 'b1'], found: ['bst', 'ans'] },
    explanation: 'The top X-fast index does not store every timestamp prefix. It stores bucket representatives. A predecessor query finds the right bucket, then the small local tree gives the exact timestamp boundary.',
  };

  yield {
    state: labelMatrix(
      'Engineering checklist',
      [
        { id: 'universe', label: 'universe' },
        { id: 'hashing', label: 'hashing' },
        { id: 'locality', label: 'locality' },
        { id: 'fallback', label: 'fallback' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fixed word width?', 'bad if not integer'],
        ['prefix tables stable?', 'rehash cost'],
        ['bucket cache-friendly?', 'pointer chase'],
        ['BST/skip list enough?', 'overengineering'],
      ],
    ),
    highlight: { found: ['universe:question', 'fallback:risk'], compare: ['locality:risk'] },
    explanation: 'This is a theory-powerful structure, not a default map. Use it when integer predecessor latency dominates and the universe bound is real enough to exploit.',
  };

  yield {
    state: labelMatrix(
      'Design pattern',
      [
        { id: 'xfast', label: 'X-fast' },
        { id: 'yfast', label: 'Y-fast' },
        { id: 'btree', label: 'B-tree' },
        { id: 'pinot', label: 'star-tree' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'payoff', label: 'payoff' },
      ],
      [
        ['hash all prefixes', 'fast ancestor'],
        ['sample + buckets', 'linear space'],
        ['wide page nodes', 'IO locality'],
        ['pre-aggregate', 'query speed'],
      ],
    ),
    highlight: { active: ['xfast:move', 'yfast:move'], found: ['yfast:payoff'] },
    explanation: 'The reusable idea is indirection. Store a smaller guide structure over representatives, then finish locally. That pattern appears in Y-fast tries, B-trees, skip-list towers, and storage indexes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'x-fast level search') yield* xFastLevelSearch();
  else if (view === 'y-fast indirection') yield* yFastIndirection();
  else if (view === 'predecessor case study') yield* predecessorCaseStudy();
  else throw new InputError('Pick an X-fast/Y-fast view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'X-fast and Y-fast tries are predecessor-search structures for bounded integer keys. They answer questions such as "what is the largest stored key at or below x?" and "what is the smallest stored key at or above x?" faster than ordinary comparison trees when the key universe U is fixed.',
        'An X-fast trie starts with a binary trie over the bits of each key, then stores every trie level in hash tables so a query can binary-search prefix lengths. A Y-fast trie uses the X-fast idea only on sampled representatives, while the real keys live in small balanced buckets. The result preserves O(log log U) expected operations while reducing space to linear.',
      ],
    },
    {
      heading: 'How X-fast works',
      paragraphs: [
        'In a bitwise trie, the path for key 1010 contains prefixes "", 1, 10, 101, and 1010. X-fast tries hash the existing prefixes at every depth. To search for a predecessor, probe prefix tables by binary search to find the deepest prefix shared with the query. That lowest existing ancestor identifies the missing branch where the query would have continued.',
        'Each missing child has a descendant pointer to the nearest leaf on the populated side, and leaves are linked in sorted order. After the prefix search finds the boundary, predecessor or successor can be returned with only a constant amount of extra navigation. The price is space: every stored key contributes O(log U) prefixes.',
      ],
    },
    {
      heading: 'How Y-fast fixes the space',
      paragraphs: [
        'Y-fast tries use indirection. Instead of indexing every key in the X-fast structure, they index one representative for each bucket of consecutive keys. Each bucket is maintained as a small balanced binary search tree with O(log U) keys. The top index finds the representative near the query, then the local bucket search finds the exact predecessor or successor.',
        'Because there are about n / log U representatives and each representative contributes O(log U) prefixes, the top structure takes O(n) space. Buckets are split when they grow too large and merged or repaired when they become too small. This gives expected amortized O(log log U) updates under the usual randomized choices.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A complete case study is a timestamp index for in-memory event processing. Events arrive with integer microsecond timestamps. Dashboards and recovery tools ask for the last event before a timestamp, then scan forward through a time window. Exact lookup alone is not enough; the hot operation is predecessor followed by ordered iteration.',
        'A balanced tree can solve this with O(log n) predecessor queries and simple iteration. A Y-fast trie is worth considering only if the timestamp universe is fixed, the predecessor path dominates latency, and the implementation can afford prefix hashing plus bucket maintenance. The case study exposes the correct engineering posture: the structure is powerful, but only for workloads whose keys and query shape match its assumptions.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The most common mistake is treating X-fast/Y-fast tries as general sorted maps. They are integer-universe structures, not arbitrary comparator structures. A string key must first be mapped into an order-preserving integer universe, and hashing that destroys order is not acceptable for predecessor search.',
        'Another mistake is reading O(log log U) as automatically faster in production. Hash tables, pointer chasing, bucket trees, allocator behavior, and cache misses can erase the asymptotic advantage. For many practical ordered maps, B-Trees, Adaptive Radix Trees, Skip Lists, or ordinary balanced trees are easier and faster.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Dan Willard, "Log-Logarithmic Worst-Case Range Queries are Possible in Space O(N)", PDF mirror at https://khoury.northeastern.edu/home/pandey/courses/cs7800/spring26/papers/yfast.pdf. Clear lecture reference: Stanford CS166 X-Fast and Y-Fast Tries at https://web.stanford.edu/class/archive/cs/cs166/cs166.1166/lectures/15/Small15.pdf. Open Data Structures covers integer data structures at http://opendatastructures.org/versions/edition-0.1c/ods-java/node64.html. Study van Emde Boas Tree, Fusion Tree Word-RAM Predecessor, PATRICIA Trie, Hash Table, Skip List, Binary Search Tree, and Data Structure Design Patterns Primer next.',
      ],
    },
  ],
};
