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

const legacyArticle = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'X-fast and Y-fast tries are predecessor-search structures for bounded integer keys. They answer questions such as "what is the largest stored key at or below x?" and "what is the smallest stored key at or above x?" faster than ordinary comparison trees when the key universe U is fixed.',
        'The naive move is a balanced search tree: compare whole keys and walk O(log n) levels. The wall is that integer keys have bit prefixes that comparisons treat as opaque. X-fast tries index those prefixes directly. Y-fast tries keep the prefix index sparse enough that the space bill stops dominating the idea.',
        'An X-fast trie starts with a binary trie over the bits of each key, then stores every trie level in hash tables so a query can binary-search prefix lengths. A Y-fast trie uses the X-fast idea only on sampled representatives, while the real keys live in small balanced buckets. The result preserves O(log log U) expected operations while reducing space to linear.',
      ],
    },
    {
      heading: 'How X-fast works',
      paragraphs: [
        'In a bitwise trie, the path for key 1010 contains prefixes "", 1, 10, 101, and 1010. X-fast tries hash the existing prefixes at every depth. To search for a predecessor, probe prefix tables by binary search to find the deepest prefix shared with the query. That lowest existing ancestor identifies the missing branch where the query would have continued.',
        'Each missing child has a descendant pointer to the nearest leaf on the populated side, and leaves are linked in sorted order. After the prefix search finds the boundary, predecessor or successor can be returned with only a constant amount of extra navigation. The price is space: every stored key contributes O(log U) prefixes.',
        'Why it works: prefixes are ordered commitments. If the query shares a prefix down to one level and then the next branch is missing, the answer must lie next to that missing branch in the sorted leaf list. Descendant pointers are the bridge from trie geometry back to predecessor order.',
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
      heading: 'Legacy visual note',
      paragraphs: [
        'In the X-fast view, follow prefix length rather than whole-key comparison. The structure asks which bit prefixes of the query already exist, then uses the deepest shared prefix to find the boundary where the predecessor or successor must live.',
        'In the Y-fast view, read the top trie as a guide over representatives and the bucket as the local finish. The reusable insight is indirection: a smaller fast index gets you close, then a simpler structure completes the exact search. That is the core pattern to carry into B-trees, skip lists, learned indexes, and storage indexes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The most common mistake is treating X-fast/Y-fast tries as general sorted maps. They are integer-universe structures, not arbitrary comparator structures. A string key must first be mapped into an order-preserving integer universe, and hashing that destroys order is not acceptable for predecessor search.',
        'Another mistake is reading O(log log U) as automatically faster in production. Hash tables, pointer chasing, bucket trees, allocator behavior, and cache misses can erase the asymptotic advantage. For many practical ordered maps, B-Trees, Adaptive Radix Trees, Skip Lists, or ordinary balanced trees are easier and faster.',
        'Updates are another tax. X-fast updates touch every prefix level for an inserted key. Y-fast reduces the top-level work, but bucket splits and representative changes still make the implementation harder than the asymptotic line suggests.',
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

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'X-fast and Y-fast tries exist for predecessor search over bounded integer keys. The query is simple: given x, find the largest stored key less than or equal to x, or the smallest stored key greater than or equal to x.',
        {type: 'callout', text: 'X-fast and Y-fast tries are word-RAM predecessor indexes: they turn integer prefixes into hashable evidence.'},
        'Balanced search trees solve this in O(log n) comparisons, which is excellent for arbitrary ordered keys. But fixed-width integers have more structure. Their bits define prefixes, and those prefixes can be hashed. X-fast and Y-fast tries exploit that word-RAM structure to get O(log log U) expected predecessor queries, where U is the integer universe size.',
        'These structures matter because predecessor search appears in timestamp indexes, routing tables, memory allocators, range indexes, event logs, and ordered maps. They are also a good lesson in when asymptotic wins are bought with strong assumptions.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a balanced binary search tree. It works for any comparable key, gives predictable O(log n) operations, and is usually the right engineering default.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg',
          alt: 'Binary tree diagram with parent and child nodes',
          caption: 'The comparison-tree baseline pays one branch decision per level. X-fast tries ask a different question: which bit prefixes of the key already exist? Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.',
        },
        'The wall appears when predecessor latency dominates, keys are fixed-width integers, and the universe bound is real. A comparison tree treats a 64-bit integer as an opaque comparable object. X-fast tries treat the same integer as a path of prefixes that can be searched by hash.',
        'A second shortcut is a full binary trie. That can answer predecessor by walking bits, but it takes O(w) time for w-bit keys. X-fast tries reduce that by binary-searching prefix length rather than scanning every bit.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The X-fast insight is to store every trie level in a hash table. For a query key, check which prefixes of the query exist. Binary search over prefix length finds the deepest existing prefix in O(log w), which is O(log log U).',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg',
          alt: 'Trie diagram with words sharing prefix paths',
          caption: 'A trie makes prefix sharing visible. X-fast keeps the prefix geometry but replaces level walks with hash probes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.',
        },
        'The Y-fast insight is indirection. X-fast is fast but bulky because every key contributes many prefixes. Y-fast stores only sampled representatives in the X-fast top index, then stores actual keys in small balanced buckets. The top index gets you close; the bucket gives the exact answer.',
        'Together, the structures show a recurring data-structure pattern: use a small fast guide over representatives, then finish locally in a compact structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An X-fast trie is based on a binary trie over fixed-width keys. Each stored key has prefixes at every depth. The structure stores those prefixes in level hash tables and keeps leaves in sorted linked order.',
        'To query predecessor or successor, binary-search the prefix levels to find the deepest query prefix that exists. The next bit tells which child branch is missing. Descendant pointers from missing branches and the sorted leaf list then identify the predecessor or successor boundary.',
        'The cost is O(log log U) expected query time with hashing, but O(n log U) space because every key contributes O(log U) prefixes. Updates also touch many prefix tables.',
        'A Y-fast trie fixes space by storing one representative per bucket in the X-fast structure. Each bucket holds O(log U) consecutive keys in a balanced tree. Query the top structure for the nearby representative, inspect the relevant bucket or neighbor bucket, and finish with O(log log U) local search. Splits and merges keep buckets near target size.',
        'The representative can be chosen randomly or by bucket policy, depending on the variant. What matters for the teaching model is that the top structure indexes bucket boundaries, not every key.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The X-fast level-search view proves that the algorithm searches prefix length, not key order by comparison. It asks how much of the query path already exists in the trie.',
        'The descendant-pointer view proves how a missing branch becomes an answer. Once the query path falls off the trie, the nearest leaves around that gap are the predecessor and successor candidates.',
        'The Y-fast view proves indirection. A sparse top index over representatives narrows the search to one or two small buckets. The exact answer comes from the local bucket tree.',
        'The comparison table proves the engineering tradeoff: X-fast and Y-fast exploit integer universes; balanced trees and skip lists work for arbitrary comparable keys.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because integer prefixes are ordered evidence. If a query shares a prefix with existing keys down to some depth and then the next branch is absent, no key on that absent path exists. The answer must be adjacent to that gap in leaf order.',
        'Binary search over prefix depth works because prefix existence is monotone along a query path. If a long prefix exists, all shorter prefixes on that path exist. If a prefix is missing, longer prefixes below it are missing too.',
        'Y-fast works because bucket size is controlled. Searching inside a bucket of O(log U) keys costs O(log log U), and the top representative index has only enough samples to keep total space linear.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is implementation complexity, hashing assumptions, pointer-heavy memory layout, and update bookkeeping. The asymptotic bound can be undermined by cache misses and allocator behavior.',
        'X-fast space is too large for many practical uses: O(n log U) prefixes. Y-fast brings expected linear space but adds bucket split and merge discipline, representative maintenance, and randomized analysis.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: 'Small B-tree diagram with grouped sorted keys in internal nodes',
          caption: 'A B-tree spends more comparisons but buys locality with wide nodes. Y-fast spends hashing and indirection to buy a stronger integer predecessor bound. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.',
        },
        'The key tradeoff is generality versus exploiting word structure. Balanced trees are simple and universal. X-fast and Y-fast are specialized tools for bounded integer universes where predecessor latency is worth the complexity.',
        'There is also an operational tradeoff around iteration. A linked leaf order can support neighbor walks, but range scans over many keys may still prefer cache-friendly blocks or B-tree pages over pointer-rich theoretical structures.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'These structures are most relevant for theory, word-RAM algorithms, and specialized in-memory indexes where keys are fixed-width integers and predecessor is hot.',
        'A timestamp index is a useful case. Events are keyed by integer microsecond time. Queries ask for the last event before t, then scan forward. A Y-fast trie can find the predecessor boundary quickly if the universe and workload justify the machinery.',
        'The pattern also teaches practical index design. Sampling representatives plus local buckets appears in skip-list towers, B-tree pages, storage indexes, and learned-index layouts.',
        'They are also useful as a benchmark for thinking: if a simpler tree wins in production, you should be able to explain which assumption, constant, or locality issue erased the theoretical advantage.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not treat X-fast or Y-fast tries as general-purpose sorted maps. They require bounded integer keys. If your keys are strings, objects, or arbitrary comparators, the assumptions are gone unless you can map them into an order-preserving integer universe.',
        'Do not ignore constants. Hash tables at many levels, pointer chasing, bucket trees, and split logic can lose to simpler B-trees or balanced trees on real hardware.',
        'Do not use them when the workload mostly needs range scans, bulk loading, persistence, or disk locality. A B-tree or LSM-style index may be a better match even with a weaker predecessor bound.',
        'Another failure is confusing the universe bound U with the current number of keys n. The log-log guarantee depends on fixed key width; it does not mean performance improves automatically when the set is sparse.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Dan Willard, "Log-Logarithmic Worst-Case Range Queries are Possible in Space O(N)", PDF mirror at https://khoury.northeastern.edu/home/pandey/courses/cs7800/spring26/papers/yfast.pdf. Clear lecture reference: Stanford CS166 X-Fast and Y-Fast Tries at https://web.stanford.edu/class/archive/cs/cs166/cs166.1166/lectures/15/Small15.pdf. Study van Emde Boas Tree, Fusion Tree Word-RAM Predecessor, PATRICIA Trie, Hash Table, Skip List, B-Tree, Binary Search Tree, and Data Structure Design Patterns Primer next.',
      ],
    },
  ],
};
