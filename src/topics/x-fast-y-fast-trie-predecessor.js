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
  const queryKey = '1010';
  const w = queryKey.length;
  const levels = w + 1;
  const predKey = '1001';
  const succKey = '1100';
  const prefixes = ['""', '"1"', '"10"', '"101"', '"1010"'];

  yield {
    state: xFastGraph('X-fast stores every trie level in hash tables'),
    highlight: { active: ['q', 'l1', 'l2'], found: ['pred', 'succ'] },
    explanation: `An X-fast trie is a binary trie over fixed-width integer keys, but every level (${levels} levels for ${w}-bit keys) has a hash table of prefixes. A query binary-searches the levels to find the deepest prefix that exists.`,
    invariant: `Every real leaf has all ${levels} of its prefixes registered in the level-search structure.`,
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
    explanation: `The level search is the trick. Instead of walking all ${w} bits of query ${queryKey}, it probes ${levels} prefix lengths (${prefixes.join(', ')}) by binary search. That gives O(log ${w}), which is O(log log U) when U = 2^${w}.`,
  };

  yield {
    state: xFastGraph('Descendant pointers turn the boundary into an answer'),
    highlight: { active: ['l2', 'miss', 'e-l3-miss'], found: ['pred', 'succ', 'leaves'] },
    explanation: `Once the lowest existing ancestor is known, the missing side tells where query ${queryKey} would have gone. Descendant pointers and the leaf linked list recover predecessor ${predKey} or successor ${succKey} in constant additional time.`,
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
    explanation: `X-fast tries show how ${w}-bit integer keys beat comparison trees, but the space bill is high because every key contributes ${w} prefixes. Y-fast tries keep the O(log log U) query idea and fix the space to O(n).`,
  };
}

function* yFastIndirection() {
  const queryVal = 53;
  const reps = [16, 48, 80];
  const chosenRep = reps[1];
  const answerKey = 56;
  const numReps = reps.length;
  const bucketTarget = 'O(log U)';

  yield {
    state: yFastGraph('Y-fast adds indirection: representatives above, buckets below'),
    highlight: { active: ['query', 'top', 'rep48'], found: ['b1', 'bst'] },
    explanation: `A Y-fast trie samples ${numReps} representatives (${reps.join(', ')}) into an X-fast trie. The actual keys live in small balanced buckets of consecutive values. This is indirection: a sparse top index points to dense local structures.`,
    invariant: `Each bucket is kept around ${bucketTarget} keys, so searching inside a bucket costs O(log log U).`,
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
    explanation: `The representative found by the top index (rep ${chosenRep} for query ${queryVal}) is enough to identify one or two candidate buckets. Because buckets hold at most ${bucketTarget} keys, ordinary balanced-tree search inside them preserves the log-log bound.`,
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
    explanation: `Y-fast tries pay update work only when buckets drift too far from their target size of ${bucketTarget}. The top X-fast index has only ${numReps} representatives (one per bucket), so total space becomes O(n).`,
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
    explanation: `The important comparison is not only speed. X-fast/Y-fast tries require bounded integer keys and careful hashing. Balanced trees and skip lists (both O(log n)) work for arbitrary comparable keys without a universe bound.`,
  };
}

function* predecessorCaseStudy() {
  const queryVal = 53;
  const reps = [16, 48, 80];
  const chosenRep = reps[1];
  const answerKey = 56;
  const numOps = 4;
  const numChecklist = 4;
  const numPatterns = 4;

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
    explanation: `Imagine an in-memory event index keyed by integer microsecond timestamps. ${numOps} operations are needed: append, point lookup, predecessor, and range scan. Queries often ask for the last event before t (floor(t) via Y-fast), then scan forward. That is a predecessor problem first and an iteration problem second.`,
  };

  yield {
    state: yFastGraph('The top index narrows to one timestamp bucket'),
    highlight: { active: ['query', 'top', 'rep48', 'b1'], found: ['bst', 'ans'] },
    explanation: `The top X-fast index does not store every timestamp prefix. It stores ${reps.length} bucket representatives (${reps.join(', ')}). A predecessor query for ${queryVal} finds rep ${chosenRep}, narrows to its bucket, then the small local tree gives the exact answer ${answerKey}.`,
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
    explanation: `${numChecklist} engineering checks before choosing this structure: universe bound, hash stability, cache locality, and whether a simpler BST/skip list suffices. Use it when integer predecessor latency dominates and the universe bound is real enough to exploit.`,
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
    explanation: `The reusable idea across all ${numPatterns} rows is indirection. Store a smaller guide structure over representatives, then finish locally. X-fast hashes all prefixes; Y-fast samples ${reps.length} reps plus buckets for linear space. That same pattern appears in B-trees, skip-list towers, and storage indexes.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/x-fast-y-fast-trie-predecessor.gif', alt: 'Animated walkthrough of the x fast y fast trie predecessor visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as predecessor search over fixed-width integers. A predecessor of x is the largest stored key less than or equal to x. Active highlights show prefix checks or bucket searches, and found highlights show the nearest stored boundary.',
        'The safe inference rule is prefix monotonicity. If a long prefix of the query exists in the trie, all shorter prefixes on that query path exist. If a prefix is missing, every longer prefix below it is missing too.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Predecessor queries appear when an index needs the nearest key, not just exact membership. Examples include last timestamp before t, route prefix before an address, memory block before an address, and event boundary before a cursor.',
        {type: 'callout', text: 'X-fast and Y-fast tries are word-RAM predecessor indexes: they turn integer prefixes into hashable evidence.'},
        'Balanced trees solve predecessor for arbitrary comparable keys in O(log n). X-fast and Y-fast tries exist because bounded integers have bit prefixes that can be hashed, allowing expected O(log log U) search where U is the key universe.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a balanced binary search tree. It stores keys in order, compares whole keys, and walks O(log n) levels to find the predecessor. It is simple, general, and usually the engineering default.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg',
          alt: 'Binary tree diagram with parent and child nodes',
          caption: 'The comparison-tree baseline pays one branch decision per level. X-fast tries ask a different question: which bit prefixes of the key already exist? Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Binary_tree.svg.',
        },
        'A full binary trie is another natural attempt. It follows one bit at a time, but that costs O(w) for w-bit keys. For 64-bit integers, that is 64 levels even if the set is small.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is treating integer keys as opaque values. A comparison tree asks whether x is less than a stored key, but it does not exploit the shared bit prefixes among all keys. A full trie exploits prefixes but scans too many levels.',
        'X-fast fixes query time by hashing all prefixes, but it creates a space wall. Every stored key contributes one prefix at every bit length, so the structure can take O(n log U) space.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'X-fast stores every trie level in hash tables, then binary-searches the prefix length of the query. The deepest existing prefix identifies where the query path leaves the stored trie. Neighbor pointers at leaves reveal the predecessor and successor around that gap.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg',
          alt: 'Trie diagram with words sharing prefix paths',
          caption: 'A trie makes prefix sharing visible. X-fast keeps the prefix geometry but replaces level walks with hash probes. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.',
        },
        'Y-fast keeps the fast guide but stores only sampled representatives in it. The real keys live in small balanced buckets, so the top index gets close and the bucket search finishes exactly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An X-fast trie begins as a binary trie over fixed-width keys. For each depth, it stores the prefixes that exist at that depth in a hash table. A query binary-searches depths to find the deepest existing query prefix.',
        'A Y-fast trie stores one representative per bucket in the X-fast top index. Each bucket contains O(log U) consecutive keys in a balanced tree. Query the top index for the nearby representative, inspect that bucket and possibly a neighbor, and return the exact predecessor.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'X-fast works because prefix existence is monotone along the query path. Binary search over depths is valid: existing at depth d implies existing at all smaller depths, and missing at depth d implies missing below d on that path.',
        'Y-fast works because bucket size is controlled. The top search gets to the right neighborhood in O(log log U), and searching a bucket of O(log U) keys costs O(log log U). The representative index stays sparse enough for expected linear space.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'X-fast predecessor query time is expected O(log log U) with hashing, but space is O(n log U). Updates also touch many prefix tables. Doubling key count doubles leaves and all associated prefixes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: 'Small B-tree diagram with grouped sorted keys in internal nodes',
          caption: 'A B-tree spends more comparisons but buys locality with wide nodes. Y-fast spends hashing and indirection to buy a stronger integer predecessor bound. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.',
        },
        'Y-fast reduces expected space to O(n) by storing representatives plus buckets, while keeping expected O(log log U) operations. The hidden costs are hashing, pointer chasing, bucket splits, representative maintenance, and poorer locality than wide-node trees.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'These structures are mostly useful in theory, word-RAM algorithms, and specialized in-memory indexes with fixed-width integer keys. They fit timestamp indexes, predecessor-heavy ordered maps, memory allocators, routing-like integer domains, and event logs when nearest-neighbor queries dominate.',
        'They also teach a practical pattern: sparse guide plus local bucket. Similar thinking appears in skip lists, B-tree pages, storage indexes, and learned indexes, even when the exact X-fast or Y-fast structure is not used.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'They fail as general-purpose sorted maps. Strings, objects, and arbitrary comparators do not automatically have a bounded order-preserving integer universe. A mapping step may destroy the assumptions.',
        'They also fail when constants and locality dominate. Hash tables at many levels, pointers, random memory access, and bucket maintenance can lose to a B-tree or balanced tree despite the stronger asymptotic bound.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use 4-bit keys and store {2, 4, 7, 12}. Query predecessor(10), whose binary form is 1010. In X-fast, prefix 1 exists because 12 is 1100, but prefix 10 may not exist because no stored key begins 10.',
        'The deepest existing prefix points to the gap between keys beginning below 10xx and above it. Leaf links identify 7 as the largest key below 10 and 12 as the successor. In Y-fast, the top representative search finds the bucket around 10, and a local tree search returns 7.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Dan Willard, Log-Logarithmic Worst-Case Range Queries are Possible in Space O(N), with lecture notes such as Stanford CS166 X-fast and Y-fast tries at https://web.stanford.edu/class/archive/cs/cs166/cs166.1166/lectures/15/Small15.pdf. Use the lecture notes for the clearest operational walkthrough.',
        'Study Binary Search Tree, Trie, Hash Table, van Emde Boas Tree, Fusion Tree, Skip List, B-Tree, and Word-RAM Model next. The central issue is when bounded integer structure is worth giving up simplicity and locality.',
      ],
    },
  ],
};
