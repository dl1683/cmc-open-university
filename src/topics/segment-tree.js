// Segment tree with lazy propagation: every range is the union of O(log n)
// canonical nodes, so range queries AND range updates both finish in
// logarithmic time — updates by leaving sticky notes instead of doing work.

import { treeState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'segment-tree',
  title: 'Segment Tree & Lazy Propagation',
  category: 'Data Structures',
  summary: 'Any range is O(log n) canonical nodes: query by collecting them, range-update by tagging them — the lazy tags do the work only when someone looks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build & range query', 'lazy range updates'], defaultValue: 'build & range query' },
  ],
  run,
};

// The same numbers as the Fenwick page, deliberately: [3, 2, -1, 6, 5, 4, -3, 3].
const VALUES = [3, 2, -1, 6, 5, 4, -3, 3];
const N = VALUES.length;
const nid = (lo, hi) => `n${lo}_${hi}`;

// A real segment tree with lazy add-tags, instrumented so each operation
// reports exactly which nodes it touched.
function makeTree() {
  const nodes = new Map();
  function build(lo, hi) {
    const node = { id: nid(lo, hi), lo, hi, sum: 0, lazy: 0, left: null, right: null };
    if (lo === hi) {
      node.sum = VALUES[lo - 1];
    } else {
      const mid = (lo + hi) >> 1;
      node.left = build(lo, mid);
      node.right = build(mid + 1, hi);
      node.sum = node.left.sum + node.right.sum;
    }
    nodes.set(node.id, node);
    return node;
  }
  const root = build(1, N);

  const push = (node, pushed) => {
    if (node.lazy === 0 || !node.left) return;
    for (const child of [node.left, node.right]) {
      child.lazy += node.lazy;
      child.sum += node.lazy * (child.hi - child.lo + 1);
      pushed?.push(child.id);
    }
    node.lazy = 0;
  };
  function query(node, lo, hi, trace) {
    if (hi < node.lo || node.hi < lo) return 0;
    if (lo <= node.lo && node.hi <= hi) {
      trace.canonical.push(node.id);
      return node.sum;
    }
    push(node, trace.pushed);
    trace.visited.push(node.id);
    return query(node.left, lo, hi, trace) + query(node.right, lo, hi, trace);
  }
  function update(node, lo, hi, delta, trace) {
    if (hi < node.lo || node.hi < lo) return;
    if (lo <= node.lo && node.hi <= hi) {
      node.sum += delta * (node.hi - node.lo + 1);
      node.lazy += delta;
      trace.canonical.push(node.id);
      return;
    }
    push(node, trace.pushed);
    trace.visited.push(node.id);
    update(node.left, lo, hi, delta, trace);
    update(node.right, lo, hi, delta, trace);
    node.sum = node.left.sum + node.right.sum;
  }
  const snapshot = () => {
    const list = [];
    (function walk(node) {
      if (!node) return;
      list.push({ id: node.id, value: node.sum, left: node.left?.id ?? null, right: node.right?.id ?? null });
      walk(node.left);
      walk(node.right);
    })(root);
    return list;
  };
  const tagged = () => [...nodes.values()].filter((x) => x.lazy !== 0).map((x) => x.id);
  return {
    root,
    snapshot,
    tagged,
    query(lo, hi) {
      const trace = { canonical: [], visited: [], pushed: [] };
      const sum = query(root, lo, hi, trace);
      return { sum, ...trace };
    },
    update(lo, hi, delta) {
      const trace = { canonical: [], visited: [], pushed: [] };
      update(root, lo, hi, delta, trace);
      return trace;
    },
  };
}
const seg = (id) => id.replace('n', '[').replace('_', '…') + ']';

function* buildAndQuery() {
  yield {
    state: arrayState(VALUES),
    highlight: {},
    explanation: `The same eight numbers as the Fenwick Tree (Binary Indexed Tree) page, and a bigger ambition. Fenwick handles prefix SUMS because addition has an inverse (range = prefix minus prefix). But ask for the MINIMUM of positions 3…6 and subtraction is useless — min has no inverse. The segment tree handles any ASSOCIATIVE combine — sum, min, max, gcd — by storing the answer for a fixed set of ranges and assembling every other range from them. It costs more than Fenwick (about 2n nodes versus n slots) and answers strictly more questions.`,
  };

  const t = makeTree();
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { active: [t.root.id], compare: [nid(1, 4), nid(5, 8)] },
    explanation: `The tree, built in O(n): leaves are the eight values; every internal node stores the sum of its two children; the root holds the total (${t.root.sum}). Each node OWNS one range — the root owns 1…8, its children split it 1…4 / 5…8, and so on down to single positions. There are ${2 * N - 1} nodes, and the crucial property is what this halving buys: ANY range you can ask about decomposes into at most 2·log₂(n) of these canonical ranges. The whole data structure is that one guarantee, drawn as a tree.`,
    invariant: 'Node(lo…hi) = combine of its children: 2n − 1 nodes, height log₂ n, every node\'s range split exactly in half.',
  };

  const q = t.query(3, 6);
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { visited: q.visited, found: q.canonical },
    explanation: `Query: sum of positions 3…6 — a range that is NOT any single node. The recursion descends from the root: 3…6 straddles both halves, so it visits 1…4 and 5…8 (amber). Inside 1…4, the overlap is exactly 3…4 — a canonical node: take its sum (${5}) whole, descend no further. Inside 5…8, the overlap is exactly 5…6: take ${9}. Answer: 5 + 9 = ${q.sum}, touching ${q.canonical.length} canonical nodes (green) and ${q.visited.length} waypoints instead of 4 leaves — and for n = 1,000,000 the same walk touches ~40 nodes, not a million.`,
    invariant: 'A query [lo…hi] collects ≤ 2·log₂(n) canonical nodes: descend only where the range straddles a split.',
  };

  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { found: [nid(3, 4), nid(5, 6)] },
    explanation: `Why this generalizes where Fenwick Tree (Binary Indexed Tree) cannot: the query never SUBTRACTED anything — it only combined the canonical pieces 3…4 and 5…6. Swap "+" for "min" in every node and the identical walk answers range-minimum queries; swap in max, gcd, or even "longest run of equal values" (with a slightly fatter node) and nothing about the structure changes. Associativity is the only requirement: the pieces must combine in order, but never un-combine. That is the segment tree's contract — and the reason it is the workhorse behind interval problems in competitive programming, database range statistics, and time-series rollups.`,
    invariant: 'Only associativity is required: the canonical decomposition never needs an inverse, so min/max/gcd ride the same tree.',
  };
}

function* lazyUpdates() {
  const t = makeTree();
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { active: [t.root.id] },
    explanation: `New demand: "add +5 to EVERY position in 2…7" — six positions. Updating six leaves and fixing their ancestors costs O(n log n) per operation; a million such updates and the structure is pointless. The lazy idea: the update visits the same ≤ 2·log₂(n) canonical nodes a QUERY would, fixes each one's sum wholesale (+5 × range length), and instead of descending further, sticks a note on the node: "everything below me still owes +5." The note — the LAZY TAG — postpones work until someone actually needs to look underneath.`,
    invariant: 'Range update = the query walk + sticky notes: fix canonical sums now, owe the descendants a correction.',
  };

  const u = t.update(2, 7, 5);
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { found: u.canonical, visited: u.visited },
    explanation: `The update, live: 2…7 decomposes into the canonical nodes ${u.canonical.map(seg).join(', ')} — ${u.canonical.length} nodes for 6 positions. Each gets its sum corrected in one stroke (3…4 jumps by +10, 5…6 by +10, the singletons by +5) and the two internal ones now carry a lazy "+5" tag for their children, who have NOT been told. The waypoints on the walk (amber) recompute from their children, so the root correctly reads ${t.root.sum} = 19 + 5·6. Total work: ${u.canonical.length + u.visited.length} nodes touched. The leaves under 3…4 and 5…6 are now WRONG — deliberately, harmlessly, until visited.`,
    invariant: 'Tagged nodes are correct; their descendants are stale by exactly the tag: the debt is recorded where the walk stopped.',
  };

  const q2 = t.query(4, 5);
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { found: q2.canonical, active: q2.pushed, visited: q2.visited },
    explanation: `Now query positions 4…5 — straight into the stale zone. As the recursion passes each tagged node, it PUSHES the tag down one level first (the green-adjacent flash): 3…4 hands "+5" to leaves 3 and 4, 5…6 hands it to leaves 5 and 6, and only then does the walk read the now-honest values. Answer: ${q2.sum} (the original 6 + 5 plus the two owed +5s). This is the whole protocol: tags flow downward exactly one step ahead of any reader, so no one ever reads a stale value, and work deferred is only ever done once — by whoever shows up first.`,
    invariant: 'Push-on-pass: every walk settles a node\'s debt to its children before descending — readers always see honest values.',
  };

  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { active: t.tagged() },
    explanation: `The closing scorecard. Some tags still sit unsettled (highlighted) — positions nobody asked about, debts that may never come due; that's the efficiency, not a bug. Both range update and range query are O(log n) now, the combination Fenwick Tree (Binary Indexed Tree) cannot reach (it does point-update/range-query in less memory and less code — still the right tool when that's all you need). The general recipe: store answers for canonical ranges, decompose every request into O(log n) of them, and defer bulk work as tags that travel one step ahead of readers. Lazy propagation is memoization's mirror image: instead of caching answers after computing them, it postpones computations until their answers are demanded.`,
    invariant: 'Segment tree + lazy tags: range update AND range query in O(log n) — pay 2× memory and the push protocol for the upgrade.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build & range query') yield* buildAndQuery();
  else if (view === 'lazy range updates') yield* lazyUpdates();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A segment tree is a binary tree where every node answers a range question about the array it owns: "What is the sum (or minimum, or maximum) of elements in positions 3 through 6?" The trick is that ANY range you ask about decomposes into at most 2·log₂(n) of these pre-stored ranges — called canonical nodes — so every query finishes in O(log n) time. A Fenwick Tree (Binary Indexed Tree) does the same for prefix sums with less code and half the memory, but a segment tree handles any associative combine (sum, min, max, gcd) and scales to range UPDATES too, not just point updates. The cost: 2n−1 nodes instead of n slots, and a push protocol to defer range-update work until it is needed. This is the workhorse for competitive programming interval queries and database rollup statistics.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Build a balanced binary tree bottom-up: the leaves are the eight array values [3, 2, −1, 6, 5, 4, −3, 3]; every internal node stores the sum of its two children. The root holds the total (19). Each node owns one contiguous range: the root owns 1…8, its left child owns 1…4, its right owns 5…8, and the halving continues down to single-element leaves. There are 2·8−1 = 15 nodes total, and the height is log₂ 8 = 3. Query a range like [3…6]? Start at the root. The range straddles both halves (1…4 and 5…8), so descend into both. On the left, 3…6 overlaps exactly 3…4 (a canonical node with sum 5), so take it whole and stop. On the right, 3…6 overlaps exactly 5…6 (sum 9). Answer: 5 + 9 = 14, touching only 2 canonical nodes instead of scanning 4 leaves. For n = 1,000,000, the same walk touches ~40 nodes. This is the guarantee: every range is a union of ≤ 2·log₂(n) canonical pieces, collected in one recursive descent.`,
        `Why Fenwick Tree (Binary Indexed Tree) cannot answer range-minimum queries: the tree subtracts the prefix before the range from the prefix at the end. Subtraction has an inverse (negate), so addition works. But min has NO inverse — you cannot "un-min" two numbers. A segment tree never subtracts; it only combines the canonical pieces with the combine operator itself. Swap "+" for "min" everywhere (root = min of children, canonical collect by min instead of sum) and the walk works identically. The same invariant holds for max, gcd, longest-run, or any operator where a·(b·c) = (a·b)·c — associativity is the only rule. Non-invertible combines ride the segment tree; invertible ones often use Fenwick because it is simpler and smaller.`,
        `Lazy propagation tackles range updates: "add 5 to every position in 2…7." Instead of walking to six leaves and fixing each, the update walk follows the same O(log n) path a query would, collects the canonical nodes [3…4, 5…6, and the singletons 2…2, 7…7], and on each node it sticks a LAZY TAG ("owe +5 to my children") and fixes the sum wholesale (+5 × range length). Later, a query pushing into these nodes settles the debt one level down, just ahead of reading: it hands +5 to the children of [3…4], reads the now-honest values, and continues. Unsettled tags (for ranges nobody asked about) may never flow to leaves — that is the efficiency. Both range-update and range-query run in O(log n), the combo Fenwick cannot match.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Build: O(n) — one pass filling leaves, then one pass back up fixing sums. Space: 2n−1 nodes ≈ 2n, roughly double an array. Query a range [lo…hi]: O(log n) canonical nodes collected, visiting ≤ 2·log n waypoints. Update a range [lo…hi] by delta: O(log n) canonical nodes tagged and fixed, visiting ≤ 2·log n waypoints. Push (settling one lazy tag): O(1) per tag per descent. For millions of mixed updates and queries, the segment tree + lazy propagation scales cleanly; a naive scan would be O(n) per operation. Compare to Fenwick Tree (Binary Indexed Tree): O(log n) for point-update/prefix-sum with O(n) space and less code — Fenwick wins when that is all you need. The memory cost and bookkeeping of lazy propagation matter only when the query power (non-invertible combines or range updates) justifies it.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Range-minimum queries on sliding windows: find the maximum (or minimum) element in every contiguous subarray of size k in O(n log n) instead of O(n·k). Competitive programming: CSES and LeetCode hard problems on interval scheduling, matrix statistics, and dynamic rectangle problems all reduce to segment-tree queries. Time-series rollups: a database query "what is the minimum latency in this 1-hour range?" maps to a query on the segment tree of logged latencies. Interval scheduling: given N calendar events, "how many are active at time t?" and "add an event to 2…7" both hit the tree in O(log n). Lazy propagation makes mass-update + query-later efficient: a batch of 1,000 bookings (each a range) lands as 1,000·log n pushes instead of O(1,000·n). The data structure is so fundamental to competitive programming that any problem hinting "range updates + range queries" immediately screams "segment tree."`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The tree is NOT a search structure: nodes do NOT hold keys and values; they own fixed ranges (1…4, 5…8, etc.) determined entirely by the halving descent. This makes building deterministic (no balancing needed) but means range membership is by index, not by value. Another trap: lazy tags only delay work; they do NOT skip it. An unsettled tag owed to 1,000 descendants still owed to everyone of those — if a query reads even one of them, the tag must settle. The trick is that the tag settles only one level at a time (push-on-pass), deferring deeper pushes until needed. This is Memoization (Dynamic Programming) in reverse: instead of caching answers after computing them, postpone the computation (the tag) until the answer is demanded. Both are deferred-action tricks; lazy propagation just stores the action instead of the result. Finally, not all problems need lazy propagation: if you only read ranges (no updates) or only update single points, Fenwick or a simpler data structure may be faster and cleaner.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Sources: CP-Algorithms Segment Tree at https://cp-algorithms.com/data_structures/segment_tree.html, HackerEarth Segment Tree and Lazy Propagation notes at https://www.hackerearth.com/practice/notes/segment-tree-and-lazy-propagation/, and Cornell segment-tree lecture notes at https://raunakkmr.github.io/files/2019_10_cornell_cs5199_segment_trees.pdf. Return to Fenwick Tree (Binary Indexed Tree) to see why it works for invertible combines and how its smaller code trades off range-query power. Study Binary Heap (Priority Queue) to understand how other tree-based structures manage order. Explore Merge Sort to solidify divide-and-conquer thinking and see where the 2·log₂(n) bound comes from. Master Memoization (Dynamic Programming) to contrast deferred computation (lazy tags) against cached results (memoization) — they are mirrors. Review Binary Search Tree for tree-structure intuition and range ownership. Then connect Segment Tree to Interval Tree and Peritext Rich-Text CRDT Case Study, where range ownership appears as formatting and annotation spans rather than numeric sums. Together, these topics unlock the full toolkit for interval queries, range updates, and the algebra of associative operations that power databases, compilers, and every system doing statistics at scale.`,
      ],
    },
  ],
};
