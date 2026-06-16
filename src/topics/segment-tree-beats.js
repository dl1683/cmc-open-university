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
      heading: 'What it is',
      paragraphs: [
        'Segment Tree Beats is an advanced lazy segment tree for range updates that are not uniformly lazy. The signature operation is range chmin: for every element in [l, r], set a[i] = min(a[i], x). Ordinary lazy propagation struggles because only values above x change. Segment Tree Beats stores enough metadata to know when a whole node can still be updated in O(1).',
        'The key summary for chmin is sum, maximum value, strict second maximum value, and count of maximum values. USACO Guide describes this setup for range chmin and sum queries: https://usaco.guide/adv/segtree-beats. If x is greater than or equal to max1, nothing changes. If max2 < x < max1, only the maximum values change, so the node sum can be fixed immediately. If x <= max2, the update must descend.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Suppose a node covers values [9, 5, 9, 0]. Its sum is 23, max1 is 9, max2 is 5, and max_count is 2. Apply chmin(6). Since 5 < 6 < 9, only the two 9s are affected. The sum drops by (9 - 6) * 2 = 6, max1 becomes 6, max2 remains 5, and the update can stop at this node with a lazy cap for children. No leaf traversal is needed.',
        'If the cap were chmin(4), both 9 and 5 would change, so max2 < x would be false. The node cannot summarize the effect with only maximum-count arithmetic, so it pushes pending tags and recurses. Full Segment Tree Beats adds symmetric min summaries for range chmax, plus add/set tags when the operation mix requires them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The structure feels like it might be too slow because some updates descend past fully covered nodes. The amortized argument is that hard descents reduce the number of distinct value levels represented inside nodes. The potential decreases when many values collapse under a cap, so a sequence of operations stays near logarithmic for the supported operation families.',
        'Implementation cost is high. Push order matters. Summary merge logic must handle equal maxima, missing second maxima, and interactions between min-side and max-side metadata. It is easy to write code that passes small examples and fails under mixed chmin, chmax, add, and sum operations. Use Segment Tree Beats when its specific power is needed, not as a casual replacement for a normal Segment Tree.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Most direct uses are algorithmic: range cap updates, range floor updates, range add, and range sum/min/max queries under heavy online workloads. The broader lesson appears in systems too: richer node summaries let you stop work higher in a hierarchy. Databases, analytics sketches, and monitoring systems all use this pattern when they store just enough aggregate metadata to avoid opening every child block.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not memorize Segment Tree Beats as magic lazy propagation. The magic is the second extreme. Without max2, you cannot tell whether a cap only affects the current maxima. Without max_count, you cannot update the sum. Without careful push, children become inconsistent with parent caps. Another misconception is that every strange range update can be beaten. The supported operations are special because their failed fast paths still reduce future complexity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: USACO Guide Segment Tree Beats at https://usaco.guide/adv/segtree-beats and the Codeforces introduction at https://codeforces.com/blog/entry/57319. Study Segment Tree, Fenwick Tree, Sparse Table, Disjoint Sparse Table, Li Chao Tree, and Interval Tree next.',
      ],
    },
  ],
};
