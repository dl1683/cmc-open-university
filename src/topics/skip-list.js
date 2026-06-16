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
    nodes.push({ id: `h${level}`, label: '−∞', x: 0.3, y, note: `L${level}` });
    const lane = ['HEAD', ...vals];
    lane.slice(1).forEach((v, i) => {
      nodes.push({ id: `n${v}_${level}`, label: String(v), x: xOf(v), y });
      const fromId = i === 0 ? `h${level}` : `n${vals[i - 1]}_${level}`;
      edges.push({ id: `e${level}_${v}`, from: fromId, to: `n${v}_${level}` });
    });
  }
  // down-links between a value's appearances on adjacent levels
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
          : `Level ${level}: the next node is ${next} ≤ ${target}, so ride this lane forward. One hop here skips ${level === 0 ? 'no one' : `every unpromoted node beneath it`}.`,
        invariant: 'The target, if present, is always at or to the right of the current node.',
      };
      if (next === target) {
        yield {
          state: snapshot(),
          highlight: { found: [nodeId()], visited: path.slice(0, -1) },
          explanation: `Found ${target} after ${comparisons} comparisons — versus up to ${VALUES.indexOf(target) + 1} in a plain sorted list. Expected search cost is O(log n), delivered not by careful rebalancing (compare the Binary Search Tree's fragility) but by PROBABILITY: the coin flips keep the lanes balanced on average, with no rotation code at all.`,
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
      heading: 'What it is',
      paragraphs: [
        `A skip list is a Linked List with probabilistic express lanes. Every value appears on the bottom level in sorted order. Then coin flips promote some values to higher levels: with probability 1/2 a node appears one level up, with probability 1/4 two levels up, and so on. The top is sparse, the bottom is complete. The demo shows exactly that shape with eight values, a -infinity sentinel at each level, and promoted nodes such as 7, 19, and 42 acting as shortcuts.`,
        `William Pugh introduced skip lists in 1990 as a simpler alternative to balanced trees. The structure chases the same goal as Binary Search and Binary Search Tree lookup: discard large parts of the search space quickly. The difference is maintenance. AVL Tree Rotations enforce balance by pointer surgery; a skip list gets expected balance from random promotion. No rotations, no color rules, just forward pointers and levels.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Search starts at the highest lane. If the next value is less than or equal to the target, move right. If the next value would overshoot, drop down one level at the same position. You never move left. In the visualization, searching for 31 rides across coarse lanes, drops when a lane would overshoot, and finally lands on the bottom level only when the range is narrow. Searching for absent 30 proves absence when the bottom-level next value has passed the target.`,
        `Insertion first finds the predecessor path, inserts the node on level 0, flips coins for its height, and splices it into each promoted lane. Deletion uses the same predecessor path and removes the node from every level. The expected number of forward pointers per item is constant: with promotion probability p = 1/2, the expected tower height is 1/(1-p) = 2 levels. That is why total space is expected O(n), not O(n log n).`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Search, insert, and delete are expected O(log n). The absolute worst case is O(n), because random choices could leave too few useful express lanes or create awkward towers. That possibility is usually acceptable because the probability falls exponentially with height. Space is expected O(n). Big-O Growth Rates helps explain the bargain: a logarithmic search path with constant expected pointer overhead is close to a balanced tree's performance, but the code is often shorter and friendlier to concurrent updates.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Redis sorted sets combine a Hash Table for direct member lookup with a skip list for ordered score ranges and leaderboards. LevelDB uses a skip-list memtable before flushing sorted data into LSM Trees (How Cassandra Writes). Java's ConcurrentSkipListMap is a standard-library example where predictable sorted maps and concurrent access matter. HNSW (Vector Search at Scale) borrows the same hierarchy idea for approximate nearest-neighbor search: sparse upper layers navigate broadly, dense lower layers refine locally.`,
        `Complete Redis case study: Redis Sorted Set Dict & Skiplist shows why a sorted set needs two access paths at once. The hash table answers "what is this member's score?" quickly, while the skip list keeps members ordered by score so ZRANGE, ZREVRANGE, rank, and score-window queries can start near the target and then traverse forward. That is why the sorted-set page is not just "a skip list"; it is a dual data structure. Complete LevelDB case study: the memtable accepts writes in memory, keeps keys sorted for reads and iteration, and later flushes that sorted order into SSTables for the LSM Tree. The skip list is the mutable front door before immutable storage takes over.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The main misconception is that randomness means unreliability. Skip lists are probabilistic, but their expected behavior is mathematically tight and easy to test. Another mistake is saying they are always faster than trees. They can be simpler and more concurrent, but cache layout, allocator behavior, and key distribution decide real performance. A practical pitfall is level bookkeeping: insertion needs the predecessor at every level, and off-by-one errors silently lose nodes. The sentinel head shown as -infinity in the demo is not decoration; it keeps every lane's search loop uniform.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: William Pugh, "Skip Lists: A Probabilistic Alternative to Balanced Trees" at https://15721.courses.cs.cmu.edu/spring2018/papers/08-oltpindexes1/pugh-skiplists-cacm1990.pdf and ACM DOI https://dl.acm.org/doi/10.1145/78973.78977. Systems references: Redis sorted-set docs at https://redis.io/docs/latest/develop/data-types/sorted-sets/ and LevelDB skip-list implementation at https://github.com/google/leveldb/blob/main/db/skiplist.h.`,
        `Read Linked List for the pointer foundation, then Binary Search for the range-halving intuition. Compare Skip List with Binary Search Tree and AVL Tree Rotations to see probabilistic balance versus deterministic repair. For systems context, study Redis Sorted Set Dict & Skiplist, LSM Trees (How Cassandra Writes), Hash Table, and HNSW (Vector Search at Scale). For integer predecessor search, compare with van Emde Boas Tree and X-Fast & Y-Fast Tries. For the math tradeoff, revisit Big-O Growth Rates and ask why expected O(log n) is often good enough.`,
      ],
    },
  ],
};
