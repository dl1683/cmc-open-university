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
      heading: 'Why this exists',
      paragraphs: [
        'Many optimization problems reduce to one question: among all lines seen so far, which line has the smallest value at this x? Dynamic programming transitions, route costs, pricing formulas, and scheduling penalties often have exactly this shape.',
        'A Li Chao tree exists for the online version of that question. Lines arrive over time, queries are interleaved with inserts, slopes may be unsorted, and query coordinates may jump around. The structure avoids maintaining the full lower envelope explicitly.',
      ],
    },
    {
      heading: 'Baseline and wall',
      paragraphs: [
        'The naive baseline stores every line and evaluates all of them for every query. That is simple and exact, but it costs O(number of lines) per query. In a dynamic program with one insert and one query per state, that can turn a near-linear plan into quadratic work.',
        'A monotone convex hull trick can do better when slopes arrive sorted or query x values move in one direction. The wall is that many problems do not give those promises. Maintaining exact intersection order dynamically is possible but more complex than the problem should require when all functions are just lines.',
        'Li Chao has a different wall: it needs an x-domain. Its costs are logarithmic in the coordinate range or compressed coordinate set, so coordinate bounds, integer versus real x, and dynamic node allocation matter.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'Build a segment tree over x-coordinates. Each node owns an interval and stores one line: the line currently best at that interval midpoint among the lines that have been routed through the node.',
        'The invariant is path coverage. For every coordinate x, the true best line among inserted lines appears in at least one node on the root-to-leaf path for x. A query therefore evaluates only the lines on that path and takes the minimum.',
        'The reason one stored line is enough per node is geometric: two distinct lines intersect at most once. If the new line loses at the midpoint, it can only beat the midpoint winner on one side of the midpoint, so the loser is pushed into only that child interval.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the line insertion view, the midpoint marker is the key decision point. The line that is lower at the midpoint stays in the current segment-tree node. The other line is not discarded; endpoint comparisons decide whether it can still win on the left half or the right half.',
        'In the tiny tree table, read each stored line as a certificate for some interval, not as the whole lower envelope. The root line is checked for every query. A child line is checked only for x values that pass through that child.',
        'In the point query view, x = 7 follows one segment-tree path. The answer is not chosen by looking at neighboring x values or scanning all lines. It is chosen by evaluating the sparse list of lines stored along that one path.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Insertion starts at the root interval. If the node is empty, store the new line there. Otherwise compare the old line and new line at the interval midpoint. Keep the lower line at the midpoint in the node and call the other one the loser for this midpoint.',
        'Next compare the two lines at an endpoint. If the loser is better on the left side, recurse into the left child with the loser. If it is better on the right side, recurse into the right child. If it is not better on either side, insertion stops because the stored line dominates it on this interval.',
        'A query for coordinate x descends from root to leaf. At each visited node, evaluate the stored line at x if there is one. The minimum value seen on that path is the answer. A max Li Chao tree is the same structure with comparisons flipped.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'The proof is a preservation argument. Before insertion, every x has its true best line somewhere on its path. During insertion at one interval, the line stored at the node is made best at the midpoint. The line that loses at the midpoint can only cross the winner once, so if it is still relevant, it is relevant in only one child interval.',
        'Pushing the loser into that child preserves the path-coverage invariant for the coordinates where the loser may matter. Coordinates on the other side already have the midpoint winner or some existing path line that is no worse. Recursing until a leaf or dominance case finishes the update.',
        'Query correctness follows immediately from the invariant. Since the best line for x is stored somewhere on the path for x, evaluating every stored path line and taking the minimum must find it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the domain is x = 0..7 and the current root stores c: 0.4x + 3 because it is good near the root midpoint. Insert a: 2x + 1. At the midpoint, c may still be lower, but a is lower on the far left. The root keeps c and routes a into the left child.',
        'Insert b: -x + 9. It is poor on the left but good on the right. Endpoint comparisons send it toward the right child. The tree now has a root candidate, a left-side candidate, and a right-side candidate instead of an explicit list of all pairwise intersections.',
        'Query x = 7. The path checks the root line c, then the right child line b, then any local leaf line. b gives value 2, c gives 5.8, and a is not on the path. The minimum among path candidates is therefore b at 2.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'For an integer coordinate domain of size C, insertion and query are O(log C). A fixed array segment tree is straightforward when C is small and known. A dynamic Li Chao tree allocates only touched nodes and is better for large sparse domains.',
        'The structure handles online insertion and point queries well, but deletion is not native because a line may have been swapped into several local decisions. Common workarounds are offline rollback, divide-and-conquer over time, periodic rebuilds, or using a different dynamic hull.',
        'Line segments are supported by inserting a line only into the segment-tree intervals covered by its valid x-range. Coordinate compression works for a known set of query x values, but then the implementation should compare only on those compressed coordinates, not assume continuous behavior between them.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Li Chao wins for online dynamic programming of the form dp[i] = min_j(m_j * x_i + b_j), where each old state j contributes one line and each new state i asks for the best value at x_i. It is also useful in geometry and cost-model problems where candidates are linear and arrive in arbitrary order.',
        'It is especially strong when slopes are unsorted, query x values are not monotone, and a simple deque hull would be invalid. It gives a predictable logarithmic update/query interface without maintaining the full envelope.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If a monotone convex hull trick fits the input, that version is usually smaller and faster. If the functions are not lines, or if two functions can intersect many times, the one-intersection argument breaks and the standard Li Chao invariant no longer applies.',
        'It also becomes awkward with deletions, poorly bounded coordinate domains, precision-sensitive real coordinates, or workloads where memory allocation dominates. In those cases, consider a different hull, an offline transformation, or a simpler scan if the line count is small.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Source: CP-Algorithms Convex Hull Trick and Li Chao Tree at https://cp-algorithms.com/geometry/convex_hull_trick.html. Study Segment Tree, Dynamic Programming, Binary Search, Convex Hull Trick, Divide and Conquer DP Optimization, and Segment Tree Beats next.',
        'A useful practice path is to first implement the naive line scan, then a monotone deque hull, then a fixed-domain Li Chao tree, then a dynamic-node Li Chao tree with line-segment insertion. The differences make the assumptions of each optimization visible.',
      ],
    },
  ],
};
