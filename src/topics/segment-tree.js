// Segment tree with lazy propagation: decompose ranges into canonical nodes,
// and defer range-update work with tags that are pushed only when needed.

import { treeState, arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'segment-tree',
  title: 'Segment Tree & Lazy Propagation',
  category: 'Data Structures',
  summary: 'Every query range is a small union of canonical nodes; lazy tags make range updates fast too.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build & range query', 'lazy range updates'], defaultValue: 'build & range query' },
  ],
  run,
};

const VALUES = [3, 2, -1, 6, 5, 4, -3, 3];
const N = VALUES.length;
const nid = (lo, hi) => `n${lo}_${hi}`;
const seg = (id) => id.replace('n', '[').replace('_', '..') + ']';

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

  return {
    root,
    snapshot,
    tagged: () => [...nodes.values()].filter((x) => x.lazy !== 0).map((x) => x.id),
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

function* buildAndQuery() {
  yield {
    state: arrayState(VALUES),
    highlight: {},
    explanation: 'A segment tree stores answers for fixed ranges. Leaves store individual values. Each internal node stores the combined answer for its two child ranges. The payoff is that any query range can be decomposed into a small set of canonical nodes.',
  };

  const t = makeTree();
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { active: [t.root.id], compare: [nid(1, 4), nid(5, 8)] },
    explanation: `The root owns 1..8 and stores total ${t.root.sum}. Its children own 1..4 and 5..8. The split continues until single positions. The data structure is fixed by index ranges, not by values.`,
    invariant: 'Each node aggregate equals the combine of its two child aggregates.',
  };

  const q = t.query(3, 6);
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { visited: q.visited, found: q.canonical },
    explanation: `Query 3..6 decomposes into canonical nodes ${q.canonical.map(seg).join(', ')}. Their sums combine to ${q.sum}. The query descends only where the requested range straddles a split.`,
    invariant: 'A range query collects O(log n) canonical nodes and combines them.',
  };

  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { found: [nid(3, 4), nid(5, 6)] },
    explanation: 'This works for any associative combine: sum, min, max, gcd, or a custom node record. Unlike Fenwick prefix subtraction, the query never needs an inverse operation. It only combines canonical pieces.',
  };
}

function* lazyUpdates() {
  const t = makeTree();
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { active: [t.root.id] },
    explanation: 'Now add 5 to every position in 2..7. Without lazy propagation, a range update might touch many leaves. Lazy propagation updates canonical nodes immediately and leaves tags that say what their descendants still owe.',
    invariant: 'A lazy tag records a deferred operation for the whole node range.',
  };

  const u = t.update(2, 7, 5);
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { found: u.canonical, visited: u.visited },
    explanation: `The update range decomposes into ${u.canonical.map(seg).join(', ')}. Each canonical node adjusts its sum by delta times range length and stores a tag instead of descending to every leaf.`,
    invariant: 'Tagged node sums are correct; descendants may be stale by exactly the recorded tag.',
  };

  const q2 = t.query(4, 5);
  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { found: q2.canonical, active: q2.pushed, visited: q2.visited },
    explanation: `Query 4..5 enters tagged territory. Before descending, the algorithm pushes each tag one level down so the child sums are honest. The answer is ${q2.sum}.`,
    invariant: 'Push before descending: no query reads stale child state.',
  };

  yield {
    state: treeState(t.snapshot(), t.root.id),
    highlight: { active: t.tagged() },
    explanation: 'Some tags may remain unsettled because nobody has asked about those descendants yet. That is the point: lazy propagation pays only when a later operation needs the deeper state.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Each node in the tree shows a range [lo..hi] and the aggregate (sum) for that slice of the array. The root covers the full array. Leaves cover single positions. Internal nodes split their range in half between two children.',
        'Highlighted nodes mark the recursion path. Found nodes are the canonical pieces the query collects. Visited nodes are ancestors the algorithm passed through without fully matching. Nodes the query skips entirely never appear highlighted at all; that skipped majority is where logarithmic cost comes from.',
        'In the lazy-propagation view, pushed nodes show a deferred tag being forced one level down because a later query needs honest child values. Remaining tagged nodes are intentionally stale: no operation has needed their descendants, so the tree saves the work.',
        {type: 'callout', text: 'A segment tree is fast because every range becomes a small exact cover of stored intervals instead of a fresh scan.'},
      
        {type: 'image', src: './assets/gifs/segment-tree.gif', alt: 'Animated walkthrough of the segment tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Arrays change. Sensor readings arrive, bookings get added, prices update. At the same time, systems need fast answers to range questions: total sales between two dates, minimum temperature in a time window, maximum load across a server rack. The data structure must handle both arbitrary range queries and updates without rescanning.',
        'Scanning a raw array answers any range query, but costs O(n) per query. With thousands of queries on a million-element array, that is the bottleneck. Prefix sums answer range-sum in O(1), but they break the moment the array changes. A segment tree gives O(log n) for both queries and updates.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Prefix sums precompute running totals: prefix[i] = a[0] + a[1] + ... + a[i]. Then sum(l, r) = prefix[r] - prefix[l-1]. For array [2, 1, 5, 3, 4], the prefix array is [2, 3, 8, 11, 15]. Sum of indices 1 through 3 is prefix[3] - prefix[0] = 11 - 2 = 9. One subtraction, no scanning, no tree.',
        'This is O(n) to build and O(1) per query. If the array never changes, prefix sums are hard to beat.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Change a[2] from 5 to 7. Every prefix from index 2 onward must be recomputed: prefix[2] jumps from 8 to 10, prefix[3] from 11 to 13, prefix[4] from 15 to 17. That is O(n) work for a single point update.',
        'With interleaved queries and updates, prefix sums cost O(1) on the query side but O(n) on the update side. Brute-force scanning is the reverse: O(1) updates, O(n) queries. No flat array layout delivers O(log n) for both. The problem demands a structure that decomposes ranges hierarchically so that one change only touches a small number of stored answers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Build a balanced binary tree over the array positions. Each leaf stores one element. Each internal node stores the aggregate of its two children. The root stores the aggregate of the entire array.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Segment_tree.svg', alt: 'Segment tree diagram with nested interval ranges stored in a binary tree', caption: 'The tree stores aggregates for nested intervals, so a query can collect whole covered nodes. Source: Wikimedia Commons, Cafce25, CC BY-SA 4.0.'},
        'The key property: any contiguous range [l, r] can be decomposed into O(log n) non-overlapping node ranges that tile it exactly. A query visits only those nodes and combines their stored values. An update changes one leaf and recomputes only the O(log n) ancestors on the path to the root. Both operations touch a thin slice of the tree, not the whole structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build: construct the tree bottom-up. Each leaf stores one array value. Each parent stores combine(left, right). For sums, combine is addition; for minimums, min; for maximums, max. Build visits every node once: O(n).',
        'Query: at each node, check three cases. (1) Node range is entirely outside [l, r]: return the identity (0 for sum, +infinity for min). (2) Node range is entirely inside [l, r]: this is a canonical node, return its stored aggregate. (3) Partial overlap: recurse into both children and combine results. At most two nodes per tree level can partially overlap the query range, so total work is O(log n).',
        'Point update: change the leaf, then walk up to the root recomputing each ancestor as combine(left, right). The path has length log n.',
        'Lazy range update: decompose the update range into canonical nodes the same way a query does. Each fully covered node adjusts its aggregate immediately (for range-add of delta over k positions: newSum = oldSum + delta * k) and stores a lazy tag recording the deferred work. Partially overlapping nodes push any existing tag to their children before recursing deeper. Push transfers the tag one level down so child aggregates become honest before any query reads them. Amortized cost: O(log n) per range update.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The tree halves the index range at every level, producing O(log n) levels. A query range [l, r] can fully contain many internal nodes, but it can only partially straddle nodes along two paths: the left boundary and the right boundary. Each path has at most log n nodes. So any contiguous range decomposes into at most 2 log n canonical, non-overlapping pieces. This decomposition is the engine behind every segment tree operation.',
        'The invariant: every node aggregate equals combine(left_child, right_child). Build establishes it bottom-up. Point update restores it by recomputing every ancestor of the changed leaf. The invariant never breaks because the update touches every affected node on the root path.',
        'Lazy tags are exact debt. A node tagged +5 over 4 positions knows its true sum is oldSum + 20 without visiting any descendant. Tags compose: carrying +3 and receiving +5 gives +8. Push distributes the tag downward only when a later operation descends into the children, so every query reads correct state and no unnecessary work is done.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build: O(n) time. The tree has exactly 2n - 1 nodes (n leaves, n - 1 internal nodes). A flat array layout allocates up to 4n slots to handle rounding to the next power of two. Space is O(n) either way.',
        'Query: O(log n). Update (point or lazy range): O(log n). Lazy range update is O(log n) amortized because each push does constant work and each tag is pushed at most once per operation that needs it.',
        'Doubling the array adds one tree level, adding one step to every query and update. For n = 1,000,000, log2(n) is about 20, so a query visits at most 40 nodes. For n = 1,000,000,000, that rises to about 60 nodes. The growth is barely noticeable.',
        'The constant factor is larger than a Fenwick tree for simple sums because each segment tree node stores more metadata and the recursion branches more. But a Fenwick tree cannot do range-min, range-max, or range-gcd; those need a segment tree.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Competitive programming: the segment tree is the most popular data structure for range query problems. Range-sum with point updates, range-min/max queries, lazy range-add, and range-assign cover most interval problems in contests.',
        'Computational geometry: sweep-line algorithms use segment trees for stabbing queries (which intervals contain a given point), rectangle union area, and interval scheduling. Bentley\'s 1977 paper introduced the segment tree precisely for computing the measure of a union of rectangles.',
        'Database range indices: aggregate indexes over mutable rows. A segment tree over a column gives fast windowed aggregation (total revenue between two dates) while accepting inserts and updates. Time-series databases use segment-tree-like structures internally for sliding-window aggregates.',
        'Interval scheduling and capacity systems: booking engines that track how many reservations overlap at any moment, rate-limit windows that count events in a sliding time range, and live dashboards that maintain running aggregates over changing data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Static arrays with idempotent queries. A sparse table answers range-min in O(1) after O(n log n) preprocessing. If the array never changes, the segment tree pays O(log n) per query for nothing.',
        'Simple prefix-sum workloads. If updates are rare and you only need range sums, prefix sums are simpler and faster. A Fenwick tree is better when updates are frequent but the combine is invertible (sum, xor), because it uses half the space and has smaller constants.',
        'High dimensions. A 2D segment tree costs O(log^2 n) per query and O(n^2) space. In three or more dimensions, the constants explode. K-d trees or range trees with fractional cascading may be better choices.',
        'Persistent segment trees use O(n log n) space because each update creates log n new nodes instead of modifying in place. For version-heavy workloads, this space cost adds up.',
        'Not all range operations compose cleanly under lazy propagation. Range-add and range-assign are straightforward. Mixed operations (assign then add, or conditional updates like "cap values above x") require careful tag ordering or specialized variants like Segment Tree Beats.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Array: [2, 1, 5, 3, 4], using 0-based indexing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Segment_tree_instance.gif', alt: 'Small segment tree instance showing array intervals as tree nodes', caption: 'A concrete segment tree instance makes the interval-cover proof easier to trace on one small array. Source: Wikimedia Commons, Alfredo J. Herrera Lago, public domain.'},
        'Build the tree bottom-up. Leaves: node[0]=2, node[1]=1, node[2]=5, node[3]=3, node[4]=4. Internal nodes: [0..1] = 2+1 = 3, [2..3] = 5+3 = 8, [3..4] = 3+4 = 7 (only needed if the tree is built differently; in a standard layout, [0..2] covers the left half). Using a clean binary split: [0..2] has children [0..1]=3 and [2..2]=5, so [0..2]=8. [3..4]=7. Root [0..4] = 8+7 = 15. The root stores the total sum of the array.',
        'Query sum(1, 3): we want a[1] + a[2] + a[3] = 1 + 5 + 3 = 9. Start at root [0..4]. Partial overlap, recurse into both children. Left child [0..2]: partial overlap (we need indices 1 and 2 but not 0). Recurse: [0..1] partially overlaps, so recurse again. [0..0] is outside the range, return 0. [1..1] is fully inside, return 1. Back at [0..1]: result is 1. [2..2] is fully inside, return 5. [0..2] returns 1 + 5 = 6. Right child [3..4]: partial overlap. [3..3] is fully inside, return 3. [4..4] is outside, return 0. [3..4] returns 3. Total: 6 + 3 = 9. The query collected three canonical nodes: [1..1], [2..2], [3..3].',
        'Point update: change a[2] from 5 to 7 (delta = +2). Update leaf [2..2] to 7. Walk up: [0..2] = 3 + 7 = 10 (was 8). Root [0..4] = 10 + 7 = 17 (was 15). Two ancestor updates, O(log n).',
        'Re-query sum(1, 3): now a[1] + a[2] + a[3] = 1 + 7 + 3 = 11. The tree decomposes the range the same way, but the affected nodes carry updated aggregates. The answer changed from 9 to 11 because only the nodes on the path from leaf [2..2] to the root were recomputed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bentley, "Solutions to Klee\'s Rectangle Problems" (1977) introduced the segment tree for computing the measure of a union of rectangles. The competitive programming community extended the structure with lazy propagation for range updates, persistent nodes for version queries, and Segment Tree Beats (Ji, 2016) for conditional range operations.',
        'Prerequisites if anything above was unclear: binary trees, recursion, prefix sums. Natural extensions: lazy propagation (range updates in O(log n)), persistent segment tree (answer queries about past versions of the array), Segment Tree Beats (conditional range updates like "set all values above x to x"). Alternatives worth comparing: Fenwick tree (binary indexed tree) for invertible operations with smaller constants, sparse table for O(1) static range-min/max, interval tree for overlapping interval queries rather than array range queries.',
      ],
    },
  ],
};
