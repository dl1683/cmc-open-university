// Li Chao tree: segment tree over x-coordinates where each node stores the
// line currently best at the midpoint and pushes the loser into one child.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'li-chao-tree',
  title: 'Li Chao Tree',
  category: 'Data Structures',
  summary: 'Maintain a dynamic set of lines and query the minimum value at any x by storing winning lines along a segment-tree path.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['line insertion', 'point query'], defaultValue: 'line insertion' },
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

function y(line, x) {
  return line.m * x + line.b;
}

const lines = [
  { id: 'a', label: 'a: 2x+1', m: 2, b: 1 },
  { id: 'b', label: 'b: -x+9', m: -1, b: 9 },
  { id: 'c', label: 'c: 0.4x+3', m: 0.4, b: 3 },
];

function linePlot(title, markers = []) {
  const xs = [0, 2, 4, 6, 8, 10];
  return plotState({
    axes: { x: { label: 'x', min: 0, max: 10 }, y: { label: 'y', min: 0, max: 15 } },
    series: lines.map((line) => ({
      id: line.id,
      label: line.label,
      points: xs.map((x) => ({ x, y: y(line, x) })),
    })),
    markers,
  }, { title });
}

function* lineInsertion() {
  yield {
    state: linePlot('Each line is a candidate lower envelope', [
      { id: 'mid', x: 5, y: 6, label: 'midpoint' },
    ]),
    highlight: { active: ['a', 'b', 'c'], found: ['mid'] },
    explanation: 'A Li Chao tree stores linear functions and answers minimum-at-x queries. The lower envelope is the visible winner curve, but the structure avoids explicitly maintaining all intersection order.',
  };

  yield {
    state: labelMatrix(
      'Insert line into one segment-tree node',
      [
        { id: 'left', label: 'left endpoint' },
        { id: 'mid', label: 'midpoint' },
        { id: 'right', label: 'right endpoint' },
        { id: 'child', label: 'recurse side' },
      ],
      [
        { id: 'compare', label: 'compare old/new' },
        { id: 'action', label: 'action' },
      ],
      [
        ['which is lower at L?', 'detect side of intersection'],
        ['which is lower at M?', 'keep midpoint winner here'],
        ['which is lower at R?', 'detect side of intersection'],
        ['loser may still win on one half', 'push loser to that child'],
      ],
    ),
    highlight: { active: ['mid:action', 'child:action'], compare: ['left:compare', 'right:compare'] },
    explanation: 'At each node, compare the old and new line at the segment midpoint. Store the line that is lower at the midpoint. The other line can only beat it on one side, so recurse into that half.',
    invariant: 'Along every root-to-leaf path, at least one stored line is the minimum for that x.',
  };

  yield {
    state: labelMatrix(
      'A tiny Li Chao tree over x = 0..7',
      [
        { id: 'root', label: '[0,8)' },
        { id: 'left', label: '[0,4)' },
        { id: 'right', label: '[4,8)' },
        { id: 'leaf', label: '[6,7)' },
      ],
      [
        { id: 'stored', label: 'stored line' },
        { id: 'reason', label: 'why here' },
      ],
      [
        ['c: 0.4x+3', 'wins near midpoint'],
        ['a: 2x+1', 'can win left side'],
        ['b: -x+9', 'can win right side'],
        ['b or c', 'path decides query'],
      ],
    ),
    highlight: { found: ['root:stored', 'left:stored', 'right:stored'], active: ['leaf:reason'] },
    explanation: 'The tree stores a sparse certificate, not the full envelope. A query follows one x-coordinate path and tests all lines stored along that path.',
  };

  yield {
    state: labelMatrix(
      'When Li Chao is the right tool',
      [
        { id: 'online', label: 'online line inserts' },
        { id: 'queries', label: 'point queries' },
        { id: 'domain', label: 'known x-domain' },
        { id: 'segments', label: 'line segments' },
      ],
      [
        { id: 'support', label: 'support' },
        { id: 'note', label: 'note' },
      ],
      [
        ['yes', 'no monotone slope order needed'],
        ['yes', 'min/max at x'],
        ['yes', 'tree spans coordinate range'],
        ['with extension', 'insert only over covered interval'],
      ],
    ),
    highlight: { active: ['online:support', 'queries:support'], found: ['segments:note'] },
    explanation: 'Li Chao shines when lines arrive online and queries ask for the best value at a coordinate. It is a practical alternative when convex-hull-trick assumptions are awkward.',
  };
}

function* pointQuery() {
  yield {
    state: linePlot('Query x = 7: evaluate candidates on one path', [
      { id: 'query', x: 7, y: 2, label: 'x=7' },
      { id: 'best', x: 7, y: y(lines[1], 7), label: 'best' },
    ]),
    highlight: { active: ['b', 'query', 'best'], compare: ['a', 'c'] },
    explanation: 'A query does not scan every line. It descends to the leaf for x and evaluates only the lines stored on that path, taking the minimum value seen.',
  };

  yield {
    state: labelMatrix(
      'Path evaluation',
      [
        { id: 'root', label: 'root [0,8)' },
        { id: 'right', label: 'right [4,8)' },
        { id: 'leaf', label: 'leaf [7,8)' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'line', label: 'line checked' },
        { id: 'value', label: 'value at x=7' },
      ],
      [
        ['c: 0.4x+3', '5.8'],
        ['b: -x+9', '2'],
        ['empty or local line', 'ignore or compare'],
        ['minimum on path', '2'],
      ],
    ),
    highlight: { active: ['root:value', 'right:value'], found: ['answer:value'] },
    explanation: 'The answer is the minimum among path candidates. Correctness comes from insertion preserving the invariant that the true best line for any x is somewhere on that path.',
  };

  yield {
    state: labelMatrix(
      'Complexity and variants',
      [
        { id: 'static', label: 'fixed integer domain' },
        { id: 'dynamic', label: 'dynamic nodes' },
        { id: 'minmax', label: 'min or max' },
        { id: 'delete', label: 'deletions' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['O(log C)', 'C is coordinate range'],
        ['O(log C)', 'allocate touched nodes'],
        ['same idea', 'flip comparisons'],
        ['not natural', 'use rollback/offline or other hull'],
      ],
    ),
    highlight: { found: ['static:cost', 'dynamic:cost'], compare: ['delete:caveat'] },
    explanation: 'Insertion and query are logarithmic in the coordinate domain. Deletion is not native because lines are woven into path invariants; offline rollback is a separate trick.',
  };

  yield {
    state: labelMatrix(
      'DP optimization pattern',
      [
        { id: 'formula', label: 'dp[i] = min_j(m_j x_i + b_j)' },
        { id: 'line', label: 'each j creates a line' },
        { id: 'query', label: 'each i queries x_i' },
        { id: 'insert', label: 'then insert new line' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'structure', label: 'Li Chao role' },
      ],
      [
        ['min over previous states', 'point query'],
        ['slope/intercept from state j', 'insert line'],
        ['current coordinate', 'get minimum'],
        ['future candidate', 'update structure'],
      ],
    ),
    highlight: { active: ['formula:structure', 'line:structure', 'query:structure'], found: ['insert:structure'] },
    explanation: 'Many dynamic programs become fast once you see every old state as a line and every new state as an x-query. Li Chao tree is the online engine for that pattern.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'line insertion') yield* lineInsertion();
  else if (view === 'point query') yield* pointQuery();
  else throw new InputError('Pick a Li Chao tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Li Chao tree maintains a dynamic set of linear functions and answers minimum or maximum value queries at a point x. It is usually taught as a convex-hull-trick data structure, but its internal shape is a segment tree over the x-coordinate domain. Each node stores one line that is best at that node midpoint, and insertion pushes the line that loses at the midpoint into the half where it can still win.',
        'CP-Algorithms reduces the motivating dynamic-programming problem to adding linear functions k*x+b and querying the minimum at x, then explains Li Chao insertion by comparing old and new lines at segment endpoints and midpoint: https://cp-algorithms.com/geometry/convex_hull_trick.html.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Consider one node representing interval [l, r). It already stores an old line. A new line arrives. Compare both lines at the midpoint m. The line with lower value at m stays in the node because it is the best local representative for the center of this interval. If the other line can beat it at the left endpoint, recurse left with that other line. If it can beat it at the right endpoint, recurse right. Because two lines intersect at most once, only one side can matter.',
        'A query for x follows the segment-tree path from root to the leaf containing x. It evaluates every stored line along that path and returns the minimum. The invariant from insertion guarantees that the globally best line at x appears somewhere on that path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For an integer coordinate domain of size C, insertion and query are O(log C). A fixed array segment tree works when the coordinate range is small and known. A dynamic Li Chao tree allocates nodes only where lines are inserted, which is useful for very large coordinate ranges. Line segments can be supported by inserting a line only into the interval where it is valid.',
        'The main limitation is deletion. A line is not stored in one clean bucket; insertion may push it into several structural decisions, and removing it would require repairing invariants. If deletions matter, use offline divide-and-conquer with rollback, rebuild periodically, or choose a different dynamic hull structure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The classic use is dynamic programming optimization: dp[i] = min over j of m_j*x_i + b_j. Each previous state j defines a line. Each new state i queries at x_i. After computing dp[i], it may insert a new line for future states. This appears in route planning, scheduling, cost optimization, and competitive-programming problems where transitions are linear in the query coordinate.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use Li Chao tree when a simpler monotone convex hull trick fits. If slopes are inserted in sorted order and queries are monotone, a deque hull may be smaller and faster. Do not forget coordinate-domain assumptions. A Li Chao tree is logarithmic in coordinate range, not in number of lines, unless coordinates are compressed or dynamically bounded.',
        'Also remember the one-intersection assumption. Ordinary lines satisfy it. Arbitrary functions do not. The midpoint swap proof relies on knowing that the loser can only become relevant on one side.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Source: CP-Algorithms Convex Hull Trick and Li Chao Tree at https://cp-algorithms.com/geometry/convex_hull_trick.html. Study Segment Tree, Dynamic Programming, Binary Search, Contour Maps, Slope Descent: Gradient Descent, and Segment Tree Beats next.',
      ],
    },
  ],
};
