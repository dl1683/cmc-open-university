// Skip lists: a sorted linked list with express lanes. Coin flips build the
// lanes, greedy descent searches them — binary-search speed, linked-list
// simplicity. Redis sorted sets run on exactly this.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'skip-list',
  title: 'Skip List',
  category: 'Data Structures',
  summary: 'A linked list with probabilistic express lanes — O(log n) search without any rebalancing.',
  controls: [
    { id: 'target', label: 'Search for', type: 'select', options: ['31', '12', '56', '30 (absent)'], defaultValue: '31' },
  ],
  run,
};

// The list: every value lives on level 0; coin flips promoted some upward.
const VALUES = [3, 7, 12, 19, 25, 31, 42, 56];
const LEVELS = {
  2: [19],
  1: [7, 19, 42],
  0: VALUES,
};

function buildGraph(levels) {
  const nodes = [];
  const edges = [];
  const xOf = (v) => VALUES.indexOf(v) * 1.15 + 1.6;
  for (const [level, vals] of Object.entries(levels)) {
    const y = (2 - Number(level)) * 2.6 + 1;
    nodes.push({ id: `h${level}`, label: 'âˆ’âˆž', x: 0.3, y, note: `L${level}` });
    const lane = ['HEAD', ...vals];
    lane.slice(1).forEach((v, i) => {
      nodes.push({ id: `n${v}_${level}`, label: String(v), x: xOf(v), y });
      const fromId = i === 0 ? `h${level}` : `n${vals[i - 1]}_${level}`;
      edges.push({ id: `e${level}_${v}`, from: fromId, to: `n${v}_${level}` });
    });
  }
  // down-links between a value\'s appearances on adjacent levels
  for (const [level, vals] of Object.entries(levels)) {
    const below = levels[Number(level) - 1];
    if (!below) continue;
    for (const v of vals) {
      edges.push({ id: `d${level}_${v}`, from: `n${v}_${level}`, to: `n${v}_${Number(level) - 1}` });
    }
    edges.push({ id: `dh${level}`, from: `h${level}`, to: `h${Number(level) - 1}` });
  }
  return graphState({ nodes, edges });
}

export function* run(input) {
  const raw = String(input.target);
  const target = parseInt(raw, 10);
  if (!Number.isFinite(target)) throw new InputError('Pick a search target.');

  const snapshot = () => buildGraph(LEVELS);

  yield {
    state: snapshot(),
    highlight: {},
    explanation: 'A sorted Linked List searches in O(n) — pointers only go forward, one node at a time. The skip list\'s fix: EXPRESS LANES. Every value lives on level 0; each was promoted upward by coin flips (50% chance per level), so level 1 has ~half the nodes and level 2 ~a quarter. Sparse on top, dense below — the same picture as HNSW, because HNSW borrowed it from here.',
  };

  let level = 2;
  let atValue = null; // null = the head sentinel
  let comparisons = 0;
  const path = [];
  const nodeId = () => (atValue === null ? `h${level}` : `n${atValue}_${level}`);
  path.push(nodeId());

  while (level >= 0) {
    const lane = LEVELS[level];
    const fromIndex = atValue === null ? -1 : lane.indexOf(atValue);
    const next = lane[fromIndex + 1];

    if (next !== undefined && next <= target) {
      comparisons += 1;
      atValue = next;
      path.push(nodeId());
      yield {
        state: snapshot(),
        highlight: { active: [nodeId()], visited: path.slice(0, -1) },
        explanation: next === target
          ? `Level ${level}: the next node is ${next} — equal to the target!`
          : `Level ${level}: the next node is ${next} â‰¤ ${target}, so ride this lane forward. One hop here skips ${level === 0 ? 'no one' : `every unpromoted node beneath it`}.`,
        invariant: 'The target, if present, is always at or to the right of the current node.',
      };
      if (next === target) {
        yield {
          state: snapshot(),
          highlight: { found: [nodeId()], visited: path.slice(0, -1) },
          explanation: `Found ${target} after ${comparisons} comparisons — versus up to ${VALUES.indexOf(target) + 1} in a plain sorted list. Expected search cost is O(log n), delivered not by careful rebalancing (compare the Binary Search Tree\'s fragility) but by PROBABILITY: the coin flips keep the lanes balanced on average, with no rotation code at all.`,
        };
        return;
      }
    } else {
      comparisons += next === undefined ? 0 : 1;
      level -= 1;
      if (level >= 0) {
        path.push(nodeId());
        yield {
          state: snapshot(),
          highlight: { active: [nodeId()], visited: path.slice(0, -1) },
          explanation: `${next === undefined ? 'The lane ends' : `The next node (${next}) overshoots ${target}`} — drop DOWN one level at the current position. Same spot, finer lane: exactly the half-the-range move that Binary Search makes, expressed in pointers.`,
        };
      }
    }
  }

  yield {
    state: snapshot(),
    highlight: { visited: path },
    explanation: `Hit level 0 with the next node past ${target} — so ${target} is NOT in the list, proven in ${comparisons} comparisons. Bonus fact: this is the moment an INSERT would happen — splice the new node here, flip coins for its height, link each level. No rebalancing, ever. That simplicity (plus easy lock-free concurrency) is why Redis sorted sets and LevelDB memtables choose skip lists over balanced trees.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Three horizontal lanes sit on screen. Level 0 (bottom) holds all eight values in sorted order. Level 1 holds a promoted subset. Level 2 holds an even sparser subset. Each lane starts at a head sentinel marked -∞.',
        {type: 'callout', text: 'A skip list is fast because each downward move keeps the same predecessor while revealing a denser lane.'},
        'Forward pointers connect consecutive nodes on the same lane. Vertical pointers link copies of the same value across levels. The highlighted node is the current search position. Visited nodes mark the path already taken. Found marks the target.',
        'The search always moves in two directions: right along a lane while the next value does not overshoot, and down one level when the next value is too large or the lane ends. The path never moves left. Each rightward hop on a high lane skips every unpromoted node below it. Each drop refines position on a denser lane.',
      
        {type: 'image', src: './assets/gifs/skip-list.gif', alt: 'Animated walkthrough of the skip list visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A sorted linked list is easy to update but slow to search. A balanced tree searches quickly but pays for that speed with rotations, color rules, or height rules after mutation.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Linked list nodes connected by next pointers', caption: 'A skip list starts from this simple pointer chain, then adds sparse upper lanes so search can skip long stretches. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Linked_list.svg.'},
        'William Pugh introduced the skip list in 1990 as a probabilistic alternative. It keeps the bottom linked list complete, adds sparse express lanes above it, and uses random promotion so updates stay local.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A sorted linked list handles insertion and deletion cleanly. Find the predecessor, splice in or out. No restructuring. The code is short and hard to get wrong.',
        'Search is O(n). Each node knows only its immediate successor, so finding a value means walking forward one comparison at a time. A million sorted records still cost up to a million comparisons. The sorted order is present but unexploitable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Binary search needs random access to the middle element. A linked list provides only sequential access. There is no way to jump over a block of values known to be too small.',
        'Balanced trees solve this by branching: each node splits the search space, and a height or color invariant keeps the tree shallow. But maintaining that invariant after every mutation is the source of all the rotation complexity. The skip list asks: what if balance came from randomness instead of invariant enforcement?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Add a vertical dimension. Every value lives on level 0. On insertion, flip a fair coin repeatedly: each heads promotes the value one level higher. With promotion probability p = 1/2, level 1 holds roughly half the values, level 2 roughly a quarter, level k roughly n/2^k. The top levels are sparse express lanes; the bottom is the complete sorted list.',
        'Searching from the top down mimics binary search. Each drop from a sparse lane to a denser one roughly halves the remaining search window, just as each comparison in binary search halves the remaining array. The difference: no insert ever moves an existing node. The new value is spliced into each promoted level, and that is the entire mutation. Randomness replaces the balance invariant.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Search: start at the head sentinel on the highest level. Compare the next node on the current lane to the target. If the next value is at most the target, move right. If it overshoots or the lane ends, drop down one level. Repeat until the target is found or level 0 is exhausted.',
        {type: 'image', src: 'https://media.geeksforgeeks.org/wp-content/uploads/Skip-List-3-4.jpg', alt: 'Skip list insertion trace with update array and multi-level forward pointers', caption: 'Insertion records one predecessor per lane, then redirects only local forward pointers. Source: GeeksforGeeks, https://www.geeksforgeeks.org/dsa/skip-list-set-2-insertion/.'},
        'Insert: run the search but record the predecessor at every level (the last node visited before each drop). Splice the new value into level 0 after its predecessor. Flip coins for height. For each promoted level, splice the value into that lane using the recorded predecessor. The predecessor array is critical: without it, you would re-search from the top for every promoted level.',
        'Delete: find the value at each level and unlink it. Update the predecessor pointers at every lane where the value appears. If the top lane becomes empty, reduce the maximum level.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from a descent invariant: at every step, the target (if present) is at or to the right of the current position. Moving right is safe because every skipped node is smaller. Dropping down is safe because the next node on the current lane is larger than the target, and so are all nodes beyond it. If level 0 is exhausted without a match, the value is absent.',
        'The expected search cost is O(log n). Pugh\'s backward analysis traces the search path in reverse from the found node. At each step, the reverse path either climbs up (probability p, the node was promoted) or moves left (probability 1 - p). The expected number of left moves before climbing is (1 - p)/p. With O(log_{1/p} n) expected levels, the total expected moves are (1/p) * log_{1/p} n. For p = 1/2 this is 2 log_2 n. For p = 1/4 (Redis), it is (4/3) log_4 n, which is about (2/3) log_2 n comparisons per level but with more levels.',
        'No mutation touches a distant node. Splicing into each promoted level updates only the immediate predecessor. This locality makes lock-free concurrency straightforward: each splice is a single compare-and-swap, with no rotation reaching up to a grandparent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Search, insert, and delete: expected O(log n). The worst case is O(n) if every coin flip produces tails and all nodes sit on level 0. The probability of this for n nodes is (1 - p)^n, which for p = 1/2 and n = 1000 is roughly 10^{-301}. Practitioners ignore it.',
        'Space: expected O(n). Each node appears on 1 + p + p^2 + ... = 1/(1 - p) levels on average. For p = 1/2 that is 2 levels per node, so about 2n total forward pointers. For p = 1/4 it is 4/3 levels per node. Lower p saves space at the cost of slightly longer search paths.',
        'Doubling n adds one expected level, which adds a small constant number of pointer hops. The hidden cost is cache behavior: each hop chases a pointer to a separately allocated node. A sorted array with binary search wins on cache lines. A skip list wins when the data changes often and you need sorted iteration, range scans, or concurrent mutation.',
        'Versus a balanced BST: same expected time, similar space. The BST guarantees O(log n) worst case; the skip list only expects it. The skip list trades that guarantee for simpler code and easier concurrency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Redis sorted sets (ZSET) pair a hash table for O(1) member-to-score lookup with a skip list for ordered operations. ZRANGEBYSCORE, ZREVRANGE, and ZRANK all ride the skip list\'s lanes. Redis uses p = 1/4 and a maximum of 32 levels, enough for billions of members.',
        'LevelDB and RocksDB use a skip-list memtable as the mutable write buffer in their LSM-tree architecture. Incoming writes land in the skip list, which keeps keys sorted for efficient reads and range scans. When the memtable fills, it flushes to an immutable SSTable on disk. The skip list is the fast, mutable front door.',
        'Java\'s ConcurrentSkipListMap provides a standard-library concurrent sorted map. Herlihy, Lev, Luchangco, and Shavit (2006) proved a lock-free concurrent skip list correct. No balanced-tree equivalent achieves comparable simplicity. Apache Lucene also uses skip lists in its postings format to jump over blocks of document IDs during query evaluation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No worst-case guarantee. Deterministic skip lists (Munro, Papadakis, Sedgewick, 1992) restore the guarantee but lose the simplicity that justified choosing a skip list in the first place. If your application needs hard O(log n), use a balanced BST.',
        'Cache-unfriendly. Each forward pointer hop may land on a different cache line. B-trees and sorted arrays pack many keys per line. For read-heavy workloads on static data, a sorted array with binary search dominates.',
        'Space overhead. With p = 1/2, total forward pointers are about 2n versus n for a BST. With p = 1/4 the overhead drops to (4/3)n, but lanes become less effective.',
        'Implementation trap: the predecessor array. Insertion must record the predecessor at every level during search, not just at level 0. Off-by-one errors in this array silently lose nodes from upper lanes. The head sentinel (the -∞ column in the animation) is not decoration; it guarantees every lane has a uniform entry point.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert 3, 7, 12, 5 into an empty skip list with p = 1/2.',
        'Insert 3: place on L0. Flip: tails. Height 1. State: L0: head → 3.',
        'Insert 7: 7 > 3, so place after 3 on L0. Flip: heads, promote to L1. Flip: heads, promote to L2. Flip: tails. Height 3. State: L0: head → 3 → 7. L1: head → 7. L2: head → 7.',
        'Insert 12: 12 > 7, so place after 7 on L0. Flip: heads, promote to L1 after 7. Flip: tails. Height 2. State: L0: head → 3 → 7 → 12. L1: head → 7 → 12. L2: head → 7.',
        'Insert 5: search for position. L2 head: next is 7, which overshoots 5, drop to L1. L1 head: next is 7, overshoots, drop to L0. L0 head: next is 3, 3 ≤ 5, move right. Next is 7, 7 > 5, so 5 goes between 3 and 7. Flip: tails. Height 1. State: L0: head → 3 → 5 → 7 → 12. L1: head → 7 → 12. L2: head → 7.',
        'Search for 5: L2 head, next is 7, overshoots, drop to L1. L1 head, next is 7, overshoots, drop to L0. L0 head, next is 3, 3 ≤ 5, move right. Next is 5, found. Total: 3 comparisons (7, 7, 3 then match). A plain sorted list would check 3, 5 and find it in 2 comparisons here, but as the list grows the express lanes increasingly dominate: with n = 1000 sorted values, the skip list expects about 20 comparisons versus 1000 worst case for scanning.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'William Pugh, "Skip Lists: A Probabilistic Alternative to Balanced Trees," Communications of the ACM, 1990. Herlihy, Lev, Luchangco, and Shavit, "A Provably Correct Scalable Concurrent Skip List," 2006. Redis sorted-set internals: redis.io/docs/latest/develop/data-types/sorted-sets/. LevelDB skip-list source: github.com/google/leveldb/blob/main/db/skiplist.h.',
        'Prerequisites: Linked List (pointer traversal, splice mechanics), Binary Search (range-halving intuition that descent mirrors), basic probability (coin flips, geometric distribution for promotion heights).',
        'Extensions: Binary Search Tree and AVL Tree for deterministic balance. Red-Black Tree for the other major balanced alternative. Treap for another randomized sorted structure. B-Tree for the disk-friendly contrast. For systems context: Redis sorted sets for the dual hash-plus-skip-list design, and LSM Trees for how skip-list memtables feed into on-disk storage.',
      ],
    },
  ],
};

