// Segment Tree Beats: range updates such as chmin become cheap when a node
// knows its maximum, second maximum, count of maxima, and sum.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'segment-tree-beats',
  title: 'Segment Tree Beats',
  category: 'Data Structures',
  summary: 'A stronger lazy segment tree: track max, second max, count, and sum so range chmin updates can stop high in the tree.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['chmin update', 'why amortized'], defaultValue: 'chmin update' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function* chminUpdate() {
  yield {
    state: labelMatrix(
      'Node summary before range chmin(6)',
      [
        { id: 'range', label: 'range [0,7]' },
        { id: 'left', label: 'left [0,3]' },
        { id: 'right', label: 'right [4,7]' },
        { id: 'leaf', label: 'leaf example' },
      ],
      [
        { id: 'sum', label: 'sum' },
        { id: 'max1', label: 'max1' },
        { id: 'max2', label: 'max2' },
        { id: 'maxc', label: 'max count' },
      ],
      [
        ['42', '9', '5', '2'],
        ['19', '8', '4', '1'],
        ['23', '9', '5', '2'],
        ['9', '9', '-inf', '1'],
      ],
    ),
    highlight: { active: ['range:max1', 'range:max2', 'range:maxc'], found: ['range:sum'] },
    explanation: 'Segment Tree Beats augments each node with more than sum. For range chmin(x), the decisive fields are maximum, strict second maximum, and count of maximum values.',
  };

  yield {
    state: labelMatrix(
      'Can chmin(6) stop at this node?',
      [
        { id: 'skip', label: 'x >= max1' },
        { id: 'beat', label: 'max2 < x < max1' },
        { id: 'descend', label: 'x <= max2' },
        { id: 'outside', label: 'range outside' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'action', label: 'action' },
      ],
      [
        ['nothing changes', 'return'],
        ['only current maxima change', 'fix node in O(1)'],
        ['multiple value levels change', 'push and recurse'],
        ['not covered', 'return'],
      ],
    ),
    highlight: { active: ['beat:meaning', 'beat:action'], compare: ['descend:action'] },
    explanation: 'If x lies strictly between max1 and max2, only the maximum values are clipped. The sum drops by (max1 - x) * max_count, and the node can be updated without visiting children.',
    invariant: 'Beats wins when a range update affects only the top value layer of a covered node.',
  };

  yield {
    state: labelMatrix(
      'Apply chmin(6) to right node',
      [
        { id: 'before', label: 'before' },
        { id: 'delta', label: 'delta' },
        { id: 'after', label: 'after' },
        { id: 'tag', label: 'lazy tag' },
      ],
      [
        { id: 'sum', label: 'sum' },
        { id: 'max1', label: 'max1' },
        { id: 'max2', label: 'max2' },
        { id: 'maxc', label: 'max count' },
      ],
      [
        ['23', '9', '5', '2'],
        ['-6', '9->6', 'unchanged', '2'],
        ['17', '6', '5', '2'],
        ['cap maxima at 6', 'pending for max children', '', ''],
      ],
    ),
    highlight: { found: ['delta:sum', 'after:sum'], active: ['after:max1', 'tag:sum'] },
    explanation: 'The node update is arithmetic: two maximum values drop from 9 to 6, so the sum drops by 3 * 2 = 6. Children are updated only when a later operation needs to inspect them.',
  };

  yield {
    state: labelMatrix(
      'Beyond chmin',
      [
        { id: 'chmin', label: 'range chmin' },
        { id: 'chmax', label: 'range chmax' },
        { id: 'add', label: 'range add' },
        { id: 'sum', label: 'range sum' },
      ],
      [
        { id: 'metadata', label: 'metadata needed' },
        { id: 'result', label: 'result' },
      ],
      [
        ['max1/max2/max count', 'cap large values'],
        ['min1/min2/min count', 'raise small values'],
        ['lazy add tag', 'shift all summaries'],
        ['sum field', 'answer queries'],
      ],
    ),
    highlight: { found: ['chmin:metadata', 'chmax:metadata'], active: ['sum:result'] },
    explanation: 'Full Segment Tree Beats pairs max-side and min-side summaries. That supports range chmin, range chmax, range add, and range sum in one structure.',
  };
}

function* whyAmortized() {
  yield {
    state: labelMatrix(
      'Why ordinary lazy propagation is not enough',
      [
        { id: 'add', label: 'range add' },
        { id: 'assign', label: 'range assign' },
        { id: 'chmin', label: 'range chmin' },
        { id: 'mod', label: 'range modulo' },
      ],
      [
        { id: 'lazy', label: 'simple lazy?' },
        { id: 'why', label: 'why' },
      ],
      [
        ['yes', 'sum shifts uniformly'],
        ['yes', 'whole segment becomes one value'],
        ['not always', 'only values above cap change'],
        ['not always', 'different values shrink differently'],
      ],
    ),
    highlight: { active: ['chmin:lazy', 'chmin:why'], compare: ['add:lazy', 'assign:lazy'] },
    explanation: 'A plain lazy tag works when every element in a segment changes the same way. chmin is conditional: values above x change, values below x do not.',
  };

  yield {
    state: labelMatrix(
      'The beats potential argument',
      [
        { id: 'easy', label: 'easy node' },
        { id: 'hard', label: 'hard descent' },
        { id: 'drop', label: 'value levels drop' },
        { id: 'budget', label: 'amortized budget' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['max2 < x < max1', 'O(1) update'],
        ['x <= max2', 'must visit children'],
        ['distinct top values collapse', 'future work decreases'],
        ['bounded by value-level changes', 'near-logarithmic in practice'],
      ],
    ),
    highlight: { active: ['hard:event', 'drop:effect'], found: ['budget:effect'] },
    explanation: 'The reason it works is amortization. Expensive descents happen when the cap crosses multiple value levels, but that collapse reduces future diversity inside the tree.',
  };

  yield {
    state: labelMatrix(
      'Implementation hazards',
      [
        { id: 'push', label: 'push order' },
        { id: 'merge', label: 'merge summaries' },
        { id: 'edge', label: 'equal max/min' },
        { id: 'proof', label: 'complexity proof' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'discipline', label: 'discipline' },
      ],
      [
        ['stale child max', 'push caps before descent'],
        ['wrong second max', 'recompute carefully'],
        ['min/max summaries collide', 'handle degenerates'],
        ['hand-wave O(log n)', 'track amortized potential'],
      ],
    ),
    highlight: { active: ['push:risk', 'merge:risk'], compare: ['proof:discipline'] },
    explanation: 'Segment Tree Beats is powerful but brittle. The code is mostly about maintaining summary invariants across pushes, caps, adds, and merges.',
  };

  yield {
    state: labelMatrix(
      'Choose the right interval structure',
      [
        { id: 'fenwick', label: 'Fenwick tree' },
        { id: 'lazy', label: 'lazy segment tree' },
        { id: 'beats', label: 'segment tree beats' },
        { id: 'sparse', label: 'sparse table' },
      ],
      [
        { id: 'best', label: 'best for' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['prefix sums and point updates', 'smallest code'],
        ['uniform range updates', 'clean lazy algebra'],
        ['conditional caps with sums', 'hard invariants'],
        ['static idempotent queries', 'no updates'],
      ],
    ),
    highlight: { found: ['beats:best'], compare: ['fenwick:tradeoff', 'lazy:tradeoff'] },
    explanation: 'Segment Tree Beats is not the default. It is the tool you reach for when ordinary lazy propagation cannot summarize a conditional range update.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'chmin update') yield* chminUpdate();
  else if (view === 'why amortized') yield* whyAmortized();
  else throw new InputError('Pick a Segment Tree Beats view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A normal lazy segment tree is excellent when a whole covered interval receives the same transformation. Add 5 to every element. Assign every element to 0. Flip every bit. The parent can store a small lazy tag because the operation does not need to inspect the children.',
        'Range chmin is different. The update chmin(x) means replace each value a[i] with min(a[i], x). Values already at or below x do not move. Values above x do move. Inside one covered interval, some leaves may change and some may not.',
        'Segment Tree Beats exists for this gap. It keeps enough information at each node to recognize when a conditional update only affects the current top layer of values, so the tree can stop high instead of descending to every leaf.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest correct implementation descends to every leaf in the update range and clamps each value. That is easy to trust, but it can turn one range update into O(k) work for k covered elements. With many large updates, it degenerates into scanning the array again and again.',
        'The next attempt is ordinary lazy propagation: attach a pending cap tag to a covered node and push it later. The tag sounds plausible, but it is incomplete. A node cannot apply "cap at 6" to its sum unless it knows how many values are above 6 and by how much.',
        'You can store the maximum, but maximum alone is still not enough. If the maximum is 9 and the cap is 6, the node must know whether the next value below 9 is 5 or 8. Those two cases have different consequences.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is selectivity. In [9, 5, 9, 0], chmin(6) changes only the two 9s. The sum drops by 3 + 3. In the same interval, chmin(4) changes the two 9s and the 5. The parent cannot summarize that second update as one layer change because two different value levels are affected.',
        'That means every covered node has three possible outcomes: no-op, apply locally, or descend. Ordinary lazy propagation tries to make every fully covered node local. Segment Tree Beats accepts that some nodes must descend, then proves those descents cannot stay expensive forever for the supported operations.',
        'This is why Beats feels unusual. The worst-looking operation may open many nodes, but the operation also collapses value structure inside those nodes. Future operations have less distinct high-value structure to fight through.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For range chmin, store four fields at each node: the maximum value max1, the strict second maximum max2, the number of elements equal to max1, and the sum. The strict second maximum is the field that ordinary segment trees do not keep.',
        'If x >= max1, the update does nothing. If max2 < x < max1, only the elements currently equal to max1 are affected. The node can reduce its sum by (max1 - x) * maxCount and replace max1 with x without seeing the children.',
        'If x <= max2, the cap crosses more than the top layer. The node must push pending state and recurse. Beats is the discipline of making the easy case very cheap and making the hard case pay for itself over time.',
      ],
    },
    {
      heading: 'Reading the chmin update view',
      paragraphs: [
        'In the chmin update view, read each node label as a certificate. The pair max1 and max2 says whether the cap can be applied at this node. maxCount says how many leaves sit on the top layer. sum is the aggregate query value that must stay correct without opening every child.',
        'When the cap lies strictly between max1 and max2, the node is allowed to stop. That is the central moment in the animation: the update is selective at the leaf level, but uniform over the maximum layer. If the cap is below or equal to max2, the highlight moves downward because the parent no longer has enough information to update safely.',
        'Do not read a stopped node as skipped work. It is real work compressed into the node summary. The sum changes, max1 changes, and a later push will make children consistent if another operation needs to inspect them.',
      ],
    },
    {
      heading: 'Reading the amortized view',
      paragraphs: [
        'The amortized view is about why occasional descents do not destroy the data structure. A descent happens when the cap cuts through multiple value layers in a node. That is the bad case locally, but it also merges or lowers layers that used to be distinct.',
        'Watch for nodes whose second maximum changes after a hard update. The expensive work is reducing disorder: high values are being brought closer to the rest of the interval. A later cap often hits only the new top layer and stops higher.',
        'The proof is not the same as the simple segment-tree proof. It uses a potential argument over value changes and node structure. The practical takeaway is narrower but important: Beats is fast for specific operations whose failed fast paths reduce future complexity.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node is built from two children. Its sum is left.sum + right.sum. Its maximum is the larger child maximum. Its maxCount is the count of maximum values across children that share that maximum. Its second maximum is the largest value strictly below the maximum, drawn from the two child summaries.',
        'To apply chmin(x) to a node, first handle the no-op case x >= max1. Then handle the local case max2 < x < max1 by reducing sum and setting max1 to x. Otherwise push pending maximum caps to the children and recurse into the parts of the query range.',
        'The push step is delicate. If a parent has already lowered its max1, a child whose max1 is too high must receive that cap before the child is inspected. Without this, children can keep stale maxima and later merges will rebuild incorrect summaries.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The local update is correct because max2 < x < max1 proves exactly which elements change: all and only the elements equal to max1. No lower value reaches the cap. So the node can update count * difference in the sum and keep every non-maximum value untouched.',
        'The merge is correct because the parent fields are complete for the next decision. To answer a sum query, sum is enough. To decide a future chmin, max1, max2, and maxCount are enough to classify no-op, local update, or descent.',
        'The amortized behavior follows from the hard case. When the update descends, it is because the cap crosses a second maximum somewhere. That operation lowers maxima and collapses value levels in child nodes. Over many operations, those collapses can be charged against the number of meaningful maximum changes rather than against the full interval size every time.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take the interval [9, 5, 9, 0]. Its summary is sum = 23, max1 = 9, max2 = 5, maxCount = 2. Apply chmin(6). Since 5 < 6 < 9, only the two maximum values change. The sum drops by (9 - 6) * 2 = 6, so the new sum is 17 and the logical interval is [6, 5, 6, 0].',
        'Now apply chmin(4) to that same interval. The summary has max1 = 6 and max2 = 5. Since 4 <= 5, the cap affects both the 6s and the 5. The node cannot update locally. It must push to children and find smaller nodes where the cap crosses only one layer or reaches leaves.',
        'This example is the whole method in miniature. chmin(6) is cheap because it only cuts the top layer. chmin(4) is expensive because it crosses multiple layers, but it also crushes the interval down to [4, 4, 4, 0], making many future caps trivial.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'A Segment Tree Beats implementation keeps the O(n) space shape of a segment tree but stores heavier summaries. For supported operation sets, range updates and queries are usually near-logarithmic amortized rather than worst-case logarithmic in the simple lazy-propagation sense.',
        'The constants and bug surface are real. You must handle duplicate maxima, absent second maxima, negative values, push order, merge order, and interactions between chmin, chmax, add, min, max, and sum if your variant supports all of them.',
        'The tradeoff is only worth it when the operation mix needs this expressiveness. If ordinary range add and range sum are enough, a lazy segment tree is smaller, easier to debug, and easier to prove.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins for online range cap and floor operations such as chmin and chmax, especially when paired with sum, min, or max queries. These appear in competitive programming, constraint tightening, simulation bounds, and any workload where values are repeatedly clipped by interval constraints.',
        'It also teaches a reusable design pattern: store the exact extra summary that proves a whole block can be updated safely. Many systems use the same idea when block metadata lets them avoid opening the block.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails as a default range-query structure. Fenwick trees, sparse tables, square-root decomposition, and ordinary lazy segment trees cover many workloads with less code and less risk.',
        'It also fails for arbitrary conditional updates. The supported operations work because their hard cases reduce future value diversity. If an operation can force repeated hard descents without simplifying the node summaries, the Beats argument does not apply.',
        'Finally, it is a poor fit when you need persistence, easy concurrency, or simple auditability. The lazy state is subtle enough that a brute-force checker over small arrays is almost mandatory during implementation.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study ordinary Segment Tree and lazy propagation first, then Fenwick Tree, Sparse Table, Square-Root Decomposition, and Li Chao Tree. Segment Tree Beats should feel like a specialized extension of lazy propagation, not a replacement for simpler range structures.',
      ],
    },
  ],
};
