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
        'Each tree node shows a range [lo..hi] and the aggregate for that slice of the array. A leaf stores one array value; an internal node stores the combined value of its children.',
        'Active nodes are recursion paths, found nodes are whole intervals collected by the query, and skipped nodes are intervals proven irrelevant. The safe inference is: if a node range is fully inside the query range, its stored value can be used without opening its children.',
        'In the lazy-propagation view, a tag is deferred work. A tagged node may have stale children, but its own aggregate is honest, and the tag is pushed only when a later operation needs child-level truth.',
        {type: 'callout', text: 'A segment tree is fast because every range becomes a small exact cover of stored intervals instead of a fresh scan.'},
      
        {type: 'image', src: './assets/gifs/segment-tree.gif', alt: 'Animated walkthrough of the segment tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A range query asks for one value over a contiguous part of an array, such as a sum from index 10 to 40 or a minimum from index 200 to 500. Real systems ask these questions while the underlying values keep changing.',
        'A raw array gives O(1) point updates but O(n) range queries. Prefix sums give O(1) range-sum queries but O(n) updates, because one changed element alters every later prefix.',
        'A segment tree exists to balance those two needs. It stores enough intermediate aggregates that both range queries and point updates touch only O(log n) nodes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'For sums, the obvious approach is prefix sums. Build prefix[i] as the total from index 0 through i, then answer sum(l, r) with prefix[r] - prefix[l - 1].',
        'For [2, 1, 5, 3, 4], the prefix array is [2, 3, 8, 11, 15]. The sum from index 1 through 3 is 11 - 2 = 9, which is excellent when the array is static.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears when values change. If a[2] changes from 5 to 7, every prefix entry at index 2 or later must increase by 2.',
        'That means one point update costs O(n). Brute-force scanning has the opposite problem: updates are cheap, but every query scans the whole requested range.',
        'The missing structure is a hierarchy. One changed leaf should update only its ancestors, and one query range should decompose into a small set of already-stored intervals.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store aggregates for nested intervals in a balanced binary tree over array positions. Each parent is exactly the combination of its two children.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Segment_tree.svg', alt: 'Segment tree diagram with nested interval ranges stored in a binary tree', caption: 'The tree stores aggregates for nested intervals, so a query can collect whole covered nodes. Source: Wikimedia Commons, Cafce25, CC BY-SA 4.0.'},
        'Any query interval can be covered by a small number of these stored intervals. Any point update changes one leaf and the ancestors whose aggregates depend on it.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build visits leaves first, then fills each parent with combine(left, right). The combine function can be sum, min, max, gcd, or any associative operation with a suitable identity for empty overlap.',
        'A query has three cases at each node. If the node range is outside the query, return the identity; if it is fully inside, return the stored aggregate; if it partially overlaps, recurse into both children and combine their answers.',
        'A point update changes one leaf, then recomputes every ancestor on the path back to the root. A lazy range update marks fully covered nodes with a deferred tag and pushes that tag only when a later operation descends into children.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every node aggregate equals the combine of the exact array values in that node\'s range. Build establishes the invariant from the leaves upward.',
        'A query is correct because the returned nodes are non-overlapping and tile the requested range exactly. Outside nodes contribute the identity, fully covered nodes contribute their stored aggregate, and partial nodes are split until one of those cases applies.',
        'A point update is correct because only ancestors of the changed leaf can change. Recomputing that root path restores the invariant everywhere else without touching unrelated subtrees.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build is O(n) because the tree has O(n) nodes. A common flat-array implementation reserves up to 4n slots, so the memory cost is linear even when n is not a power of two.',
        'A query or point update is O(log n). Doubling n adds one tree level, so a million-element array needs about 20 levels and a billion-element array needs about 30.',
        'Lazy range updates are O(log n) amortized for operations whose tags compose cleanly, such as range add with range sum. The constant factor is higher than a Fenwick tree, but the segment tree supports a broader family of range aggregates.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Segment trees fit mutable time series, booking calendars, leaderboards, dashboards, and interval capacity systems. The access pattern is repeated range aggregation mixed with updates.',
        'Computational geometry uses segment-tree ideas in sweep-line algorithms, including rectangle union area and interval stabbing queries. Competitive programming uses them for range sum, range min, range max, lazy range add, and persistent version queries.',
        'They are also useful as a design pattern: store summaries over blocks, answer large requests from block summaries, and drill down only where the request boundary cuts through a block.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If the array never changes, a sparse table or prefix array can be faster and simpler. Range-min on static data can be O(1) after preprocessing, while a segment tree still pays O(log n).',
        'For simple invertible operations like sum with point updates, a Fenwick tree is usually smaller and faster. Segment trees earn their complexity when the operation or update pattern needs the extra structure.',
        'High-dimensional segment trees grow quickly in space and code complexity. A two-dimensional version already costs much more, and three dimensions often push engineers toward different spatial indexes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use [2, 1, 5, 3, 4] and sum queries. The root stores 15, the total of the whole array.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Segment_tree_instance.gif', alt: 'Small segment tree instance showing array intervals as tree nodes', caption: 'A concrete segment tree instance makes the interval-cover proof easier to trace on one small array. Source: Wikimedia Commons, Alfredo J. Herrera Lago, public domain.'},
        'Query sum(1, 3). The answer is a[1] + a[2] + a[3] = 1 + 5 + 3 = 9, and the tree obtains it by collecting only intervals that fit inside [1..3].',
        'Now update a[2] from 5 to 7. The leaf for index 2 changes by +2, its ancestors change by +2, and the root becomes 17; the same query now returns 1 + 7 + 3 = 11.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bentley\'s 1977 work on Klee\'s rectangle problems introduced the segment tree in computational geometry. Modern programming texts and competitive-programming references cover lazy propagation and persistent variants.',
        'Study binary trees, recursion, prefix sums, and associative operations first. Then compare Fenwick trees, sparse tables, persistent segment trees, and Segment Tree Beats for conditional range updates.',
      ],
    },
  ],
};
