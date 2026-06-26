// Interval tree: a balanced search tree augmented with subtree max endpoints,
// used to answer overlap and stabbing queries quickly.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'interval-tree',
  title: 'Interval Tree',
  category: 'Data Structures',
  summary: 'Store ranges in a balanced tree, augment each node with max end, and skip whole subtrees during overlap queries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['overlap query', 'maintain max endpoint'], defaultValue: 'overlap query' },
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

function intervalGraph(title) {
  return graphState({
    nodes: [
      { id: 'n16', label: '[16,21]', x: 4.8, y: 1.0, note: 'max 30' },
      { id: 'n8', label: '[8,9]', x: 2.5, y: 2.8, note: 'max 23' },
      { id: 'n25', label: '[25,30]', x: 7.2, y: 2.8, note: 'max 30' },
      { id: 'n5', label: '[5,8]', x: 1.2, y: 4.8, note: 'max 10' },
      { id: 'n15', label: '[15,23]', x: 3.6, y: 4.8, note: 'max 23' },
      { id: 'n17', label: '[17,19]', x: 6.2, y: 4.8, note: 'max 19' },
      { id: 'n26', label: '[26,26]', x: 8.4, y: 4.8, note: 'max 26' },
      { id: 'query', label: 'query [22,25]', x: 4.8, y: 6.8, note: 'find overlap' },
    ],
    edges: [
      { id: 'e-16-8', from: 'n16', to: 'n8', weight: 'left' },
      { id: 'e-16-25', from: 'n16', to: 'n25', weight: 'right' },
      { id: 'e-8-5', from: 'n8', to: 'n5', weight: 'left' },
      { id: 'e-8-15', from: 'n8', to: 'n15', weight: 'right' },
      { id: 'e-25-17', from: 'n25', to: 'n17', weight: 'left' },
      { id: 'e-25-26', from: 'n25', to: 'n26', weight: 'right' },
      { id: 'e-query-15', from: 'query', to: 'n15', weight: 'overlap' },
      { id: 'e-query-25', from: 'query', to: 'n25', weight: 'overlap' },
    ],
  }, { title });
}

function* overlapQuery() {
  const nodeCount = 7;
  const queryLow = 22;
  const queryHigh = 25;
  const rootMax = 30;
  const rootInterval = '[16,21]';
  const leftMax = 23;
  const overlapResult1 = '[15,23]';
  const overlapResult2 = '[25,30]';
  const totalOverlaps = 2;

  yield {
    state: intervalGraph('Intervals are ordered by start, augmented by subtree max'),
    highlight: { active: ['n16', 'n8', 'n25'], found: ['query'] },
    explanation: `An interval tree stores ${nodeCount} intervals as a balanced BST ordered by low endpoint. Each node also stores the maximum high endpoint in its subtree — the root's max is ${rootMax}. That extra number is the pruning signal.`,
    invariant: `node.max = max(node.high, left.max, right.max) — here the root's max is ${rootMax}.`,
  };

  yield {
    state: intervalGraph('Query [22,25]: root does not overlap'),
    highlight: { active: ['query', 'n16'], compare: ['n16'], found: ['n8'] },
    explanation: `The root interval ${rootInterval} does not overlap [${queryLow},${queryHigh}]. But the left child has max ${leftMax} >= ${queryLow}, so the left subtree might still contain an interval reaching into the query. The search descends left before discarding it.`,
  };

  yield {
    state: intervalGraph('Left subtree finds [15,23]'),
    highlight: { active: ['n8', 'n15', 'e-8-15'], found: ['n15', 'e-query-15'], removed: ['n5'] },
    explanation: `The [8,9] node does not overlap, and [5,8] cannot reach [${queryLow},${queryHigh}]. The right child ${overlapResult1} does overlap. The max endpoint made the search skip irrelevant intervals without scanning all ${nodeCount} stored intervals.`,
  };

  yield {
    state: intervalGraph('Right subtree can also be explored for all overlaps'),
    highlight: { active: ['n25', 'e-query-25'], found: ['n15', 'n25'], compare: ['n17', 'n26'] },
    explanation: `To find one overlap, the search can stop at ${overlapResult1}. To find all ${totalOverlaps} overlaps (${overlapResult1} and ${overlapResult2}), continue exploring branches whose max endpoints and starts make overlap possible. The same structure powers calendars, genome ranges, and compiler liveness ranges.`,
  };
}

function* maintainMaxEndpoint() {
  const newInterval = '[6,14]';
  const newLow = 6;
  const newHigh = 14;
  const pathLength = 3;
  const useCaseCount = 4;
  const neighborCount = 4;
  const maxRotations = 3;

  yield {
    state: labelMatrix(
      'Insert a new interval [6,14]',
      [
        { id: 'root', label: '[16,21]' },
        { id: 'left', label: '[8,9]' },
        { id: 'child', label: '[5,8]' },
        { id: 'new', label: '[6,14]' },
      ],
      [
        { id: 'compare', label: 'BST compare' },
        { id: 'oldmax', label: 'old max' },
        { id: 'newmax', label: 'new max' },
      ],
      [
        ['6 < 16 go left', '30', '30'],
        ['6 < 8 go left', '23', '23'],
        ['6 > 5 go right', '10', '14'],
        ['insert as child', '-', '14'],
      ],
    ),
    highlight: { active: ['root:compare', 'left:compare', 'child:compare'], found: ['child:newmax', 'new:newmax'] },
    explanation: `Insertion of ${newInterval} follows the ordinary BST rule on low endpoints — ${newLow} is compared at ${pathLength} nodes along the path. Then the walk back to the root recomputes max endpoints; [5,8]'s max updates from 10 to ${newHigh}. The augmentation is local, which is why the structure stays efficient.`,
  };

  yield {
    state: intervalGraph('Rotations preserve order but require max recomputation'),
    highlight: { active: ['n16', 'n8', 'e-16-8'], compare: ['n15', 'n5'] },
    explanation: `Most implementations use a Red-Black or AVL tree underneath. Rotations keep intervals ordered by start, but max endpoints must be recomputed for rotated nodes — at most ${maxRotations} rotations per insert or delete — before queries remain correct.`,
  };

  yield {
    state: labelMatrix(
      'What max endpoints buy',
      [
        { id: 'calendar', label: 'calendar booking' },
        { id: 'genome', label: 'genome feature' },
        { id: 'compiler', label: 'register allocation' },
        { id: 'observability', label: 'trace spans' },
      ],
      [
        { id: 'query', label: 'query' },
        { id: 'why', label: 'why interval tree helps' },
      ],
      [
        ['does new meeting overlap?', 'skip finished branches'],
        ['which genes cover this coordinate?', 'range overlap'],
        ['which live ranges interfere?', 'all overlaps'],
        ['which spans cover this timestamp?', 'stabbing query'],
      ],
    ),
    highlight: { found: ['calendar:why', 'compiler:why', 'observability:why'], active: ['genome:query'] },
    explanation: `Across ${useCaseCount} domains — calendar, genome, compiler, observability — interval trees show the same pattern: augment a familiar tree with exactly one summary value (max endpoint) that unlocks a new query pattern.`,
  };

  yield {
    state: labelMatrix(
      'Interval tree versus neighboring structures',
      [
        { id: 'segment', label: 'Segment Tree' },
        { id: 'interval', label: 'Interval Tree' },
        { id: 'btree', label: 'B-tree' },
        { id: 'rtree', label: 'R-tree' },
      ],
      [
        { id: 'best', label: 'best at' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['range aggregates', 'fixed coordinate decomposition'],
        ['dynamic overlap search', 'BST plus max endpoint'],
        ['ordered scalar keys', 'disk page tree'],
        ['spatial boxes', 'bounding rectangle tree'],
      ],
    ),
    highlight: { active: ['interval:best', 'interval:shape'], compare: ['segment:best', 'rtree:shape'] },
    explanation: `Among ${neighborCount} neighboring structures, the right choice depends on the question. Segment trees aggregate over coordinates. Interval trees find overlapping intervals. R-trees handle multidimensional rectangles. B-trees index scalar keys on disk.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'overlap query') yield* overlapQuery();
  else if (view === 'maintain max endpoint') yield* maintainMaxEndpoint();
  else throw new InputError('Pick an interval-tree view.');
}

export const article = {
  sections: [
    {heading: 'How to read the animation', paragraphs: ['Each node stores one interval and a max value: the largest high endpoint in its subtree. Active nodes are checked, found nodes overlap, and dimmed branches are skipped.', {type: 'callout', text: 'The max endpoint is a pruning certificate: it proves an entire subtree ends before the query begins.'}, {type: 'image', src: './assets/gifs/interval-tree.gif', alt: 'Animated walkthrough of the interval tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['An interval is a range with a start and an end, such as a meeting, gene span, or memory region. Systems need to find overlaps without scanning every stored range.']},
    {heading: 'The obvious approach', paragraphs: ['The obvious approach is to scan all intervals and test overlap directly. It is correct, but every query costs work proportional to the whole collection.']},
    {heading: 'The wall', paragraphs: ['Sorting by start point does not prove enough, because an early interval can extend far right. To beat scanning, the search needs a certificate that an entire branch cannot overlap.']},
    {heading: 'The core insight', paragraphs: ['Store intervals in a balanced search tree ordered by low endpoint, and add subtree max endpoint to each node. A subtree whose max endpoint is before the query start cannot contain a match.', {type: 'image', src: 'https://liujunming.top/images/2018/9/7.png', alt: 'Example interval tree nodes with low endpoint and subtree max endpoint labels', caption: 'The diagram labels the two fields that matter: each interval low endpoint orders the BST, and subtree max decides pruning. Source: liujunming.top, Interval Tree.'}]},
    {heading: 'How it works', paragraphs: ['Insert by low endpoint as in a red-black or AVL tree, then recompute max while returning to the root. Query by testing the current interval and descending only into branches whose start order and max endpoint still allow overlap.']},
    {heading: 'Why it works', paragraphs: ['The exact overlap test is still applied before reporting a result. Pruning is sound because subtree max is an upper bound on every interval end inside that subtree.']},
    {heading: 'Cost and complexity', paragraphs: ['Balanced insert and delete cost O(log n), and one-overlap search costs O(log n). Reporting k overlaps costs O(log n + k), and memory is O(n) plus one max field per node.']},
    {heading: 'Real-world uses', paragraphs: ['Calendars use interval trees for conflict checks, and genome tools use them for coordinate lookup. Debuggers, temporal databases, profilers, and collision systems use the same overlap query shape.']},
    {heading: 'Where it fails', paragraphs: ['It is the wrong tool for aggregate range sums or minimums; use a segment tree or Fenwick tree there. For tiny static sets, a flat array scan can be faster because it stays in cache.']},
    {heading: 'Worked example', paragraphs: ['Store [5, 12], [10, 30], [15, 20], [17, 19], and [25, 35], then query point 18. The search reports [15, 20] and [10, 30], while [5, 12] is skipped because its max endpoint is 12.']},
    {heading: 'Sources and study next', paragraphs: ['Read CLRS on augmenting data structures and interval trees. Then study Binary Search Tree, AVL Tree, Red-Black Tree, Segment Tree, Fenwick Tree, Sweep Line, R-Tree, and Order-Statistics Tree.']},
  ],
};
