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
        `A skip list is a sorted linked list that borrows the divide-and-conquer speed of binary search without needing rotations or tree rebalancing. Every node lives on the bottom level; a coin flip (50% chance at each level) promotes it upward into faster lanes. Level 1 has roughly half the nodes, level 2 a quarter, and so on — exponentially sparse the higher you climb. Think of it as a highway with express lanes: all traffic travels the same route at ground level, but some cars are on ramps that skip entire sections.`,
        `The skip list was invented in 1990 (William Pugh) as a simpler alternative to balanced binary search trees. Instead of rebalancing operations that require rotations and color swaps, skip lists rely on randomness: the coin flips keep the structure balanced *on average*, which turns out to be good enough. This shift from deterministic structure to probabilistic balance is the core insight.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Search starts at the topmost level and greedy-descends: check if the next node in the current lane is ≤ your target; if yes, jump forward; if no, drop down one level at your current position. This is exactly what binary search does—halving the remaining range—but expressed in pointer hops instead of array indices. You never backtrack: the sorted invariant guarantees your target is ahead or at the current position.`,
        `Insertion slots the new node at level 0, flips coins to decide how many levels it rises through, and links it into each level's lane. Deletion splices it out. Both are O(log n) on average and require no rebalancing code whatsoever: if a coin flip happened to promote the last 10 insertions all to level 3, that is bad luck but not a crisis—the structure degrades to a linked list, which is the worst case, but the expected case remains O(log n). Balanced trees, by contrast, guarantee O(log n) in the worst case because they must actively prevent imbalance; skip lists accept imbalance gracefully and bet on probability.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Search, insert, and delete are all O(log n) on average—the same as a balanced binary search tree—but O(n) in the absolute worst case (e.g., if the coin flip gods decide to leave every coin heads, creating a single-level structure). Space is O(n) expected because each node is promoted E[log n] levels on average. Why accept the worst case? Because it is vanishingly unlikely: the coin flip would have to go the same way billions of times in a row. Balanced trees trade implementation complexity for a deterministic guarantee; skip lists trade a small worst-case risk for simplicity and concurrency.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Redis uses skip lists internally for sorted sets (ZSET), the data structure that powers leaderboards, priority queues, and scored membership. Google's LevelDB (and RocksDB) use skip lists for the in-memory memtable, the initial write buffer before data is compacted into the LSM tree. The concurrency advantage is decisive here: multiple threads can insert into a skip list with minimal locking because each level is independent, whereas balancing a tree requires global synchronization. ConcurrentSkipListMap is part of the Java standard library for this exact reason.`,
        `HNSW (Hierarchical Navigable Small-World), the vector search algorithm behind Pinecone and Milvus, borrowed the layered structure directly from skip lists. HNSW adds distance-based navigation on top of the hierarchy, but the topology—sparse upper levels, dense lower levels—is the same insight: you navigate the coarse structure first, then refine.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Misconception 1: "Skip lists are slower than balanced trees because they use probabilistic structure." False—in practice they are faster: no rotation overhead, better cache locality, and locks are shorter. Misconception 2: "The worst case O(n) is a show-stopper." Not in real systems: with 8 levels (one million nodes), the probability of all coins landing the same way is 2^−20, about one in a million—far less likely than a hardware error. Misconception 3: "You need careful tuning of the promotion probability." Skip lists are robust: 50% is standard and works well; even 25% or 75% would still be O(log n) on average.`,
        `Pitfall: blind insertion into a skip list without understanding the code. The pointer-chasing and level-based indexing are easy to get wrong. Most real implementations use a sentinel node (a HEAD pointer at all levels) and careful bookkeeping of which level you are on. The visualization here shows that sentinel as −∞; it simplifies the loop invariant.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To deepen your intuition: (1) study Binary Search to see how halving ranges works in arrays, then return here and notice that skip lists do the same thing in a linked structure. (2) Read about Linked List basics to ground the pointer manipulation. (3) Explore Binary Search Tree and its balance challenges (rotations, color invariants) to understand why skip lists' probabilistic approach is so attractive. (4) Dive into HNSW (Vector Search at Scale) to see how the layered idea scales to nearest-neighbor problems. (5) Study LSM Trees (How Cassandra Writes) to see skip lists in a production compaction pipeline.`,
      ],
    },
  ],
};

