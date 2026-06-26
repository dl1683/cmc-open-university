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
    explanation: `A ${topic.title} stores ${lines.length} linear functions (${lines.map(l => l.label).join(', ')}) and answers minimum-at-x queries. The lower envelope is the visible winner curve, but the structure avoids explicitly maintaining all intersection order.`,
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
    explanation: `At each node, compare the old and new line at the segment midpoint (x = 5 for ${lines[0].label} gives ${y(lines[0], 5)}). Store the line that is lower at the midpoint. The other line can only beat it on one side, so recurse into that half.`,
    invariant: `Along every root-to-leaf path in the ${topic.title}, at least one of the ${lines.length} stored lines is the minimum for that x.`,
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
    explanation: `The ${topic.title} stores a sparse certificate, not the full envelope. A query follows one x-coordinate path and tests all ${lines.length} lines (${lines.map(l => l.id).join(', ')}) stored along that path.`,
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
    explanation: `${topic.title} shines when lines arrive online and queries ask for the best value at a coordinate. With ${lines.length} lines like ${lines[0].label}, it is a practical alternative when convex-hull-trick assumptions are awkward.`,
  };
}

function* pointQuery() {
  yield {
    state: linePlot('Query x = 7: evaluate candidates on one path', [
      { id: 'query', x: 7, y: 2, label: 'x=7' },
      { id: 'best', x: 7, y: y(lines[1], 7), label: 'best' },
    ]),
    highlight: { active: ['b', 'query', 'best'], compare: ['a', 'c'] },
    explanation: `A query does not scan every line. It descends to the leaf for x = 7 and evaluates only the lines stored on that path, taking the minimum value seen (${lines[1].label} yields ${y(lines[1], 7)}).`,
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
    explanation: `The answer is the minimum among path candidates: ${lines[2].label} gives ${y(lines[2], 7)} while ${lines[1].label} gives ${y(lines[1], 7)}. Correctness comes from insertion preserving the invariant that the true best line for any x is somewhere on that path.`,
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
    explanation: `Insertion and query are O(log C) in the coordinate domain. With ${lines.length} lines, deletion is not native because lines like ${lines[0].label} are woven into path invariants; offline rollback is a separate trick.`,
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
    explanation: `Many dynamic programs become fast once you see every old state as a line (e.g. ${lines[0].label}) and every new state as an x-query. ${topic.title} is the online engine for that pattern.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The tree is a segment tree over x-coordinates. Each node owns an interval and stores at most one line as local evidence. A query for x follows one root-to-leaf path and evaluates the stored lines on that path.',
        'The active midpoint decides which line stays in the current node. If a line loses at the midpoint, it is not thrown away; it is routed into the only side where it might still beat the winner. That rule is safe because two straight lines cross at most once.',
        {type: 'image', src: './assets/gifs/li-chao-tree.gif', alt: 'Animated walkthrough of the li chao tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many dynamic programs ask for the minimum value of many linear formulas. A previous state j may contribute a line y = m_j x + b_j, and a new state i asks for the smallest value at x_i. Lines arrive online, and queries are interleaved with inserts.',
        'A Li Chao tree exists for the case where slopes and query coordinates are not sorted. It avoids maintaining the full lower envelope, which is the piecewise curve formed by the best line at every x. The tree stores just enough evidence along each coordinate path to answer point queries.',
        {type: 'callout', text: 'A Li Chao tree stores enough line evidence on one root-to-leaf path to answer each x, instead of maintaining the whole lower envelope.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach stores every line in an array. To answer a query at x, evaluate all lines and take the minimum. This is exact and simple, and it is often best when there are only a few lines.',
        'A faster first improvement is the convex hull trick with sorted slopes or monotone query x values. Under those assumptions, a deque of candidate lines can answer queries quickly. The problem is that many online workloads do not provide either order.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The array scan costs O(k) per query after k lines have been inserted. If a dynamic program has 100000 states and each state inserts one line and asks one query, the scan can do about 10000000000 line evaluations. The arithmetic is simple, but the behavior is quadratic.',
        'The monotone hull wall is its precondition. If slopes arrive in arbitrary order or x queries jump backward and forward, the deque invariant breaks. A fully dynamic hull can solve more cases, but its intersection bookkeeping is harder than necessary for point queries over lines.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Build a segment tree over the x-domain and keep one locally best line per interval. The line stored at a node is best at that interval midpoint among the lines routed through the node. A losing line can matter only on one side, so insertion descends into at most one child per level.',
        'The invariant is path coverage: for every coordinate x, the true best inserted line is stored somewhere on the root-to-leaf path for x. A query does not need the full envelope. It evaluates the small set of lines on its path and takes the minimum.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows.', caption: 'A Li Chao query follows one root-to-leaf path through interval decisions; only the line records on that path need evaluation. Source: Wikimedia Commons, David W., public domain.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Insertion starts at the root interval. If the node is empty, store the new line. If not, compare the old line and the new line at the midpoint, keep the lower one at the node, and call the other line the loser for this midpoint.',
        'Then compare the two lines at an endpoint. If the loser is better on the left endpoint, recurse into the left child. If it is better on the right endpoint, recurse into the right child. If it is better nowhere in the interval, stop.',
        'A query for x descends through the segment tree. At each visited node, evaluate the stored line at x if one exists. The minimum value seen along the path is the answer.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Convex_polygon_illustration2.svg', alt: 'Line segment crossing a polygon, illustrating a single crossing over an interval.', caption: 'The one-crossing intuition is geometric: with lines, a loser at the midpoint can only become relevant on one side. Source: Wikimedia Commons, CheCheDaWaff and contributors, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Two distinct lines can cross once. After the midpoint comparison, the line that loses at the midpoint can beat the winner only on one side of the midpoint. Routing it to that side preserves every x where it may still be the best line.',
        'Inductively, before insertion every x has the best line on its path. The insertion either stores the new line at the current node or pushes it into the only child interval where it can matter. Existing path evidence is not removed unless a better midpoint line replaces it and the displaced line is routed where it can still win.',
        'Query correctness follows from the path-coverage invariant. Since the best line for x is stored somewhere on the path, evaluating every stored path line and taking the minimum must return the correct value.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With a fixed integer coordinate domain of size C, insert and query cost O(log C). A static implementation stores an array segment tree and pays O(C) memory. A dynamic implementation allocates only touched nodes and uses O(number of inserted path nodes) memory.',
        'When the coordinate range doubles, the height grows by one for a power-of-two domain. That adds about one comparison level per operation. The dominant hidden cost is line evaluation and pointer allocation in dynamic trees, not the Big-O expression alone.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Li Chao trees are common in competitive programming and optimization-heavy dynamic programming. They fit recurrences like dp[i] = min_j(m_j * x_i + b_j) when candidate lines arrive online and query x values are arbitrary. The structure turns repeated full scans into logarithmic path checks.',
        'They also fit geometric and cost-model problems where each candidate is linear over a known coordinate range. Segment-limited lines can be inserted only over the intervals where they are valid. That makes the tree useful when each formula applies to only part of the domain.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'If functions can intersect many times, the midpoint routing proof breaks. Standard Li Chao trees are for lines, or for function families with the same one-crossing property. They are also awkward with deletions because one line may have influenced many local choices.',
        'Poor coordinate handling causes bugs. Real-valued domains need precision discipline or enough recursion depth to be meaningful. Coordinate compression is safe only when all query x values are known and the implementation compares on those discrete points rather than assuming continuous behavior between them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use x = 0..7 and minimum queries. Insert line a(x) = 2x + 1, then b(x) = -x + 9. At midpoint x = 3, a gives 7 and b gives 6, so b is lower at the root midpoint and stays at the root.',
        'Compare at the left endpoint x = 0: a gives 1 and b gives 9, so a can still win on the left side. Insert a into the left child interval 0..3. Query x = 1 checks root b for 8 and left-child a for 3, so the answer is 3 from a.',
        'Query x = 7 checks root b for 2 and follows the right path. If no better right-side line exists, the answer is 2 from b. The query did not evaluate every inserted line; it evaluated only the evidence on the x = 7 path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study CP-Algorithms on Convex Hull Trick and Li Chao Tree, then compare with deque-based convex hull trick. The key source idea is that lines have one crossing, so a segment tree can route losers by interval.',
        'Study next by prerequisite. Segment trees explain the coordinate tree. Dynamic programming explains why lines arise. Convex hull trick explains the envelope view. Divide-and-conquer over time and rollback data structures explain common deletion workarounds.',
      ],
    },
  ],
};
