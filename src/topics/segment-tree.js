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
      heading: 'Why this exists',
      paragraphs: [
        `Many programs ask questions about intervals: sum positions 3 through 6, find the minimum in a time window, count active bookings in a date range, or update every element in a range after a policy change. A plain array answers by scanning the interval, which is too slow when queries and updates repeat.`,
        `The challenge is that intervals overlap in many shapes. A data structure must answer arbitrary ranges without precomputing every possible range, and it must update ranges without touching every affected element each time.`,
      ],
    },
    {
      heading: 'Context',
      paragraphs: [
        `Prefix sums solve static range sums because sum(l..r) can be written as prefix(r) minus prefix(l - 1). Fenwick trees extend that idea to point updates and prefix queries. Sparse tables solve static idempotent queries such as range minimum. Each structure is excellent when its algebra matches the job.`,
        `Segment trees are the general workhorse when the combine operation is associative: sum, min, max, gcd, boolean OR, or a custom record that can be merged from left and right children. Lazy propagation adds efficient range updates by delaying work until a later query or update actually needs the children.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious approach is to scan the requested range every time. That is simple and often fine for a handful of queries. It becomes the wall when the same array receives thousands of range queries or range updates: each operation repeats work that earlier operations already made predictable.`,
        `Precomputing every possible interval runs into a different wall. There are O(n^2) intervals, and a single update can invalidate many of them. A segment tree keeps only O(n) canonical intervals, then assembles arbitrary query ranges from those reusable pieces.`,
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        `Build a balanced binary tree over array positions. Each leaf owns one position. Each internal node owns a contiguous interval and stores the combined value of its two children. The root owns the whole array.`,
        `Every query interval can be decomposed into a small set of canonical nodes whose ranges exactly cover the interval without overlap. The query combines those nodes and ignores everything else. Lazy propagation uses the same canonical cover for updates: update a fully covered node now, and store a tag saying its descendants still owe the same update.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Build is bottom-up. Leaves store the original array values. Each parent stores combine(left, right). For sums, combine is addition. For minimum, combine is min. The invariant is local: every node aggregate equals the merge of its children.`,
        `Query uses three cases. If a node range is outside the requested interval, ignore it. If it is fully inside, return the node aggregate. If it partially overlaps, recurse into both children and combine their answers. Range update follows the same shape, except a fully covered node updates its own aggregate and records a lazy tag instead of descending.`,
      ],
    },
    {
      heading: 'Lazy propagation',
      paragraphs: [
        `A lazy tag is deferred work attached to a whole node range. For range add, the tag can be a pending delta. If node [3..4] receives +5, its stored sum increases by 10 immediately, because the range has length 2. Its children do not need to change until someone descends into them.`,
        `Before a query or update descends through a tagged node, it pushes the tag to the children. Pushing means update each child aggregate, compose the child's lazy tag, and clear the parent tag. This keeps fully covered node answers correct while avoiding unnecessary leaf work.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `The animation array is [3, 2, -1, 6, 5, 4, -3, 3]. The root [1..8] stores 19. Its left child [1..4] stores 10, and its right child [5..8] stores 9. Query 3..6 decomposes into [3..4] and [5..6]. Their sums are 5 and 9, so the answer is 14.`,
        `For the lazy view, add 5 to every position in 2..7. The updated logical array is [3, 7, 4, 11, 10, 9, 2, 3], but the tree does not have to rewrite every leaf immediately. Later, query 4..5 pushes only the tags needed on that path and returns 21 from positions 4 and 5.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The tree halves the index interval at every level. A query range can fully cover many nodes and partially overlap only near its left and right boundaries. That is why the canonical decomposition stays logarithmic for normal segment tree queries.`,
        `Lazy propagation works because the tag is exact debt, not a hint. A fully covered node knows how the update changes its aggregate without visiting descendants. For range add and sum, the formula is newSum = oldSum + delta * length. Other operations need their own correct aggregate update and tag composition rules.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the build and range query view, first read the tree by ownership ranges, not by node values. The root owns [1..8], its children own [1..4] and [5..8], and the split continues to leaves. When the query asks for 3..6, the found nodes are the exact cover. Visited nodes are only the ancestors needed to reach that cover.`,
        `In the lazy range updates view, found nodes are the covered chunks that receive the update directly. Active pushed nodes show deferred work being forced one level lower because a later query needs more detail. Remaining tagged nodes are not mistakes; they are saved work that no later operation has demanded yet.`,
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        `Build time is O(n). Space is O(n), often implemented as about 4n array slots for a recursive heap-style layout. Standard range queries and lazy range updates are O(log n), with larger constants than Fenwick trees.`,
        `The tradeoff is generality for complexity. Segment trees handle many range aggregates and rich node records, but the code is easier to get wrong. Fenwick trees, prefix arrays, sparse tables, and sweep-line offline methods are often better when their assumptions fit.`,
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        `The combine operation must be associative. If merging left and right summaries is not well defined, a segment tree cannot maintain correct aggregates. Some queries also need extra information in each node, such as prefix best, suffix best, count of minimum, or maximum subarray fields.`,
        `Lazy propagation is not universal. Range add and range assign are straightforward. Mixed assign and add require careful tag ordering. Conditional updates such as "cap every value above x" need stronger invariants and lead to Segment Tree Beats or another specialized structure.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The classic bug is reading a stale child. If a parent has a lazy tag and the algorithm descends without pushing it, the child aggregate is behind the logical array. The returned answer may look plausible because some ancestors are correct while deeper nodes are stale.`,
        `Another common bug is composing tags in the wrong order. Assign then add is not the same as add then assign. A production implementation should write tag composition as a small explicit function and test overlapping updates, nested updates, disjoint ranges, single-element ranges, and full-root updates.`,
      ],
    },
    {
      heading: 'Practical use',
      paragraphs: [
        `Segment trees fit live dashboards, booking and capacity systems, rate-limit windows, game stat ranges, compiler source spans, financial time buckets, and competitive-programming problems where intervals change over time. They are especially useful when each node stores a custom summary rather than a single number.`,
        `Use a simple array implementation when the size is fixed and dense. Use a dynamic or implicit segment tree when the coordinate range is huge but touched sparsely. Use coordinate compression when only a finite set of endpoints matters.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Sources: CP-Algorithms Segment Tree at https://cp-algorithms.com/data_structures/segment_tree.html, HackerEarth Segment Tree and Lazy Propagation notes at https://www.hackerearth.com/practice/notes/segment-tree-and-lazy-propagation/, and Cornell segment-tree lecture notes at https://raunakkmr.github.io/files/2019_10_cornell_cs5199_segment_trees.pdf. Study Fenwick Tree, Sparse Table, Segment Tree Beats, Interval Tree, Li Chao Tree, Persistent Segment Tree, Range Tree, and Sweep Line next.`,
      ],
    },
  ],
};
