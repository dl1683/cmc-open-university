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
  const capValue = 6;
  const max1 = 9;
  const max2 = 5;
  const maxCount = 2;
  const rootSum = 42;
  const delta = (max1 - capValue) * maxCount;
  const rightSumBefore = 23;
  const rightSumAfter = rightSumBefore - delta;
  const perElementDrop = max1 - capValue;
  const fieldCount = 4;
  const operationCount = 4;

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
    explanation: `Segment Tree Beats augments each node with ${fieldCount} fields. For range chmin(${capValue}), the decisive fields are max1=${max1}, strict second maximum max2=${max2}, and maxCount=${maxCount}.`,
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
    explanation: `Since ${max2} < ${capValue} < ${max1}, only the ${maxCount} maximum values are clipped. The sum drops by (${max1} - ${capValue}) * ${maxCount} = ${delta}, and the node can be updated without visiting children.`,
    invariant: `Beats wins when max2 < x < max1: here ${max2} < ${capValue} < ${max1}, so the update affects only the top value layer.`,
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
    explanation: `The node update is arithmetic: ${maxCount} maximum values drop from ${max1} to ${capValue}, so the sum drops by ${perElementDrop} * ${maxCount} = ${delta}. The right node sum goes from ${rightSumBefore} to ${rightSumAfter}.`,
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
    explanation: `Full Segment Tree Beats pairs max-side and min-side summaries across ${operationCount} operations: range chmin, range chmax, range add, and range sum in one structure.`,
  };
}

function* whyAmortized() {
  const updateTypes = 4;
  const easyCondition = 'max2 < x < max1';
  const hardCondition = 'x <= max2';
  const hazardCount = 4;
  const structureChoices = 4;
  const amortizedBound = 'O(log^2 n)';

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
    explanation: `Of ${updateTypes} update types, a plain lazy tag works for add and assign but not chmin: values above x change, values below x do not.`,
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
    explanation: `Easy nodes satisfy ${easyCondition} and update in O(1). Hard descents occur when ${hardCondition}, but each collapse reduces future diversity, yielding ${amortizedBound} amortized cost.`,
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
    explanation: `Segment Tree Beats is powerful but brittle. Across ${hazardCount} hazard categories, the code is mostly about maintaining summary invariants across pushes, caps, adds, and merges.`,
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
    explanation: `Among ${structureChoices} interval structures, Segment Tree Beats is not the default. It is the tool you reach for when ordinary lazy propagation cannot summarize a conditional range update.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The chmin view shows a range operation that replaces each value a[i] with min(a[i], x). Each node displays sum, max1, max2, and maxCount, where max2 is the strict second maximum.',
        'Active state marks the fields deciding skip, tag, or break. Found state marks a node whose sum remains correct without opening children; compare state marks a node where the cap crosses too many value layers.',
        'The safe inference is local: if max2 < x < max1, then only the values equal to max1 change. The node can lower max1 to x and subtract (oldMax - x) * maxCount from sum without visiting leaves.',
        {type: 'callout', text: 'Beats is lazy propagation with a certificate: max2 proves when a conditional cap only touches the current top value layer.'},
      
        {type: 'image', src: './assets/gifs/segment-tree-beats.gif', alt: 'Animated walkthrough of the segment tree beats visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Ordinary lazy propagation works when a full segment changes uniformly. Range add and range assign fit that model because every value in a covered node receives the same transformation.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Segment_tree.svg', alt: 'Segment tree diagram with interval nodes arranged as a binary tree', caption: 'Beats keeps the segment-tree interval skeleton but adds max and second-max certificates to each node. Source: Wikimedia Commons, Cafce25, CC BY-SA 4.0.'},
        'Range chmin is different. For chmin(6), values above 6 change and values at or below 6 do not, so one covered node may contain both changed and unchanged elements.',
        'Segment Tree Beats exists for that selective update. It adds enough metadata for many covered nodes to prove that only the current maximum layer changes, then handles those nodes locally.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach is to visit every leaf in the update range and clamp the value. It is correct and easy to test, but a large update over k elements costs O(k).',
        'The next attempt is to store a lazy cap tag on a full node. That fails unless the node can also update its sum, max, and future metadata exactly.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is mixed value layers inside one covered segment. In [9, 5, 9, 0], chmin(6) changes only the two 9s, so the sum drops by 6.',
        'The same segment under chmin(4) changes the two 9s and the 5. A single max value cannot tell whether the cap touches one layer or many layers.',
        'A parent can stop only when its metadata proves exactly which elements change. Without that proof, it must push and recurse.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store the maximum value, the strict second maximum, and the count of maximum values in each node. The second maximum is the certificate that separates a one-layer update from a multi-layer update.',
        'For chmin(x), there are three cases. If x >= max1, the update is a no-op; if max2 < x < max1, only max1 values change; if x <= max2, the node lacks enough information and must descend.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each node stores sum, max1, max2, and maxCount. Leaves have max1 equal to their value, max2 equal to negative infinity, maxCount equal to 1, and sum equal to the value.',
        'When chmin(x) reaches a node, skip if x >= max1. Tag locally if the node is fully covered and max2 < x < max1: subtract (max1 - x) * maxCount from sum and set max1 to x.',
        'If x <= max2, push any parent cap to children, recurse into the children that overlap the update range, then pull the four fields back up from the children. Range chmax uses the symmetric min-side metadata.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The local update is correct because max2 is the largest value strictly below max1. If max2 < x < max1, every non-maximum value is already below x, and every maximum value must be lowered to x.',
        'The sum adjustment is therefore exact: maxCount values each lose max1 - x. No child inspection is needed because no hidden middle value can exist between max2 and max1.',
        'The amortized argument is that forced descents reduce value diversity in the subtree. A single operation can be expensive, but across many operations those expensive descents pay down a bounded potential tied to changing maximum layers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space is O(n), but each node stores more fields than a plain segment tree. A full version with chmin, chmax, add, and sum tracks maximum metadata, minimum metadata, sum, and multiple lazy tags.',
        'Range chmin plus sum is O(log^2 n) amortized in the standard analysis. The important behavior is that most updates stop high in the tree, while the rare descents simplify future nodes.',
        'When n doubles, the tree gains one level, but the amortized proof still carries an extra logarithmic factor. For n = 100,000, log2(n) is about 17, so the bound is roughly hundreds of small node operations rather than scanning 100,000 leaves.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Segment Tree Beats is mainly a competitive-programming tool for range chmin, range chmax, range add, range sum, and range max queries. It appears when offline tricks or square-root decomposition are too slow.',
        'The design pattern is broader than contests. Systems that keep block summaries and skip block internals when a certificate proves a local update is safe are using the same idea.',
        'It is also useful as a teaching example of amortized analysis. The data structure allows bad-looking individual descents because it can explain why the sequence of descents is bounded.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is not a replacement for ordinary lazy propagation. If the workload is only range add and range sum, a standard lazy tree is simpler, faster, and easier to verify.',
        'It fails for arbitrary conditional updates when descents do not reduce the metadata potential. If an operation repeatedly forces breaks without collapsing value layers, the amortized story no longer applies.',
        'The implementation is brittle. Strict second maximum, tag order, pushdown, and symmetric min-side logic all create small bugs that only randomized brute-force testing tends to catch.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use one node covering [9, 5, 9, 0]. Its sum is 23, max1 is 9, max2 is 5, and maxCount is 2.',
        'Apply chmin(6). Since 5 < 6 < 9, only the two maximum values change. The sum drops by (9 - 6) * 2 = 6, so the new sum is 17 and max1 becomes 6.',
        'Now apply chmin(4) to the same logical values [6, 5, 6, 0]. The node has max1 = 6 and max2 = 5, and 4 <= 5, so the parent cannot update locally. It must open children because both 6 and 5 will change by different amounts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The primary reference is Ji\'s 2016 Segment Beats writeup and later competitive-programming translations that explain skip, tag, and break cases. HDU 5306 Gorgeous Sequence is the classic practice problem.',
        'Study ordinary segment trees, lazy propagation, and amortized analysis first. Then compare square-root decomposition, Chtholly Tree or ODT for assign-heavy workloads, and Li Chao trees for a different segment-tree variant.',
      ],
    },
  ],
};
