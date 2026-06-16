// Convex hull by Andrew's monotone chain: sort points, scan with a turn test.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'convex-hull-monotone-chain',
  title: 'Convex Hull: Monotone Chain',
  category: 'Algorithms',
  summary: 'Sort points lexicographically, build lower and upper hull stacks, and pop every non-left turn until only the outer fence remains.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stack scan', 'geometry uses'], defaultValue: 'stack scan' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function pointsGraph(title) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 0.8, y: 5.8, note: 'left' },
      { id: 'b', label: 'B', x: 2.0, y: 3.0, note: 'low' },
      { id: 'c', label: 'C', x: 3.0, y: 4.8, note: 'inside' },
      { id: 'd', label: 'D', x: 4.4, y: 1.7, note: 'bottom' },
      { id: 'e', label: 'E', x: 5.8, y: 4.1, note: 'inside' },
      { id: 'f', label: 'F', x: 7.2, y: 2.5, note: 'right' },
      { id: 'g', label: 'G', x: 6.4, y: 6.8, note: 'top' },
      { id: 'h', label: 'H', x: 3.5, y: 7.2, note: 'top' },
    ],
    edges: [
      { id: 'e-a-b', from: 'a', to: 'b', weight: '' },
      { id: 'e-b-d', from: 'b', to: 'd', weight: '' },
      { id: 'e-d-f', from: 'd', to: 'f', weight: '' },
      { id: 'e-f-g', from: 'f', to: 'g', weight: '' },
      { id: 'e-g-h', from: 'g', to: 'h', weight: '' },
      { id: 'e-h-a', from: 'h', to: 'a', weight: '' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: '' },
      { id: 'e-c-e', from: 'c', to: 'e', weight: '' },
      { id: 'e-e-f', from: 'e', to: 'f', weight: '' },
    ],
  }, { title });
}

function* stackScan() {
  yield {
    state: pointsGraph('Sort by x, then scan from left to right'),
    highlight: { active: ['a', 'b', 'c', 'd', 'e', 'f'], compare: ['g', 'h'] },
    explanation: 'Andrew monotone chain starts by sorting points lexicographically: x first, y as tie-breaker. The sort costs O(n log n); each later stack pass is linear.',
    invariant: 'After sorting, the hull can be built by local turn tests on a stack.',
  };

  yield {
    state: labelMatrix(
      'Lower hull stack scan',
      [
        { id: 'pushA', label: 'push A' },
        { id: 'pushB', label: 'push B' },
        { id: 'testC', label: 'test C' },
        { id: 'popC', label: 'pop inside' },
        { id: 'pushD', label: 'push D' },
      ],
      [
        { id: 'stack', label: 'stack' },
        { id: 'turn', label: 'turn test' },
      ],
      [
        ['A', 'start'],
        ['A B', 'need 2 points'],
        ['A B C', 'not left enough'],
        ['A B', 'remove middle'],
        ['A B D', 'left turn kept'],
      ],
    ),
    highlight: { active: ['testC:turn', 'popC:stack'], found: ['pushD:turn'] },
    explanation: 'For each new point, look at the last two stack points plus the candidate. If they make a clockwise or collinear turn under the chosen policy, pop the middle point. It cannot be part of the lower outer fence.',
  };

  yield {
    state: pointsGraph('The lower chain keeps only the bottom fence'),
    highlight: { active: ['a', 'b', 'd', 'f', 'e-a-b', 'e-b-d', 'e-d-f'], removed: ['c', 'e'], compare: ['g', 'h'] },
    explanation: 'Interior points disappear because a later edge bypasses them. The monotonic x order means a popped point will never become useful for the lower chain again.',
  };

  yield {
    state: pointsGraph('Run the same scan backward for the upper chain'),
    highlight: { active: ['f', 'g', 'h', 'a', 'e-f-g', 'e-g-h', 'e-h-a'], removed: ['c', 'e'], found: ['b', 'd'] },
    explanation: 'The upper chain is the same stack rule in reverse sorted order. Concatenate lower and upper chains, omitting duplicate endpoints, and the convex hull is complete.',
  };

  yield {
    state: labelMatrix(
      'Turn predicate',
      [
        { id: 'cross', label: 'cross product' },
        { id: 'left', label: 'left turn' },
        { id: 'right', label: 'right turn' },
        { id: 'col', label: 'collinear' },
      ],
      [
        { id: 'test', label: 'test' },
        { id: 'action', label: 'action' },
      ],
      [
        ['(b-a) x (c-a)', 'orientation'],
        ['positive', 'keep for CCW hull'],
        ['negative', 'pop middle'],
        ['zero', 'policy decides'],
      ],
    ),
    highlight: { active: ['cross:test', 'right:action'], found: ['left:action'], compare: ['col:action'] },
    explanation: 'The algorithm is mostly a data-structure loop around one geometric primitive: orientation. Robust production geometry spends real effort making that predicate reliable under floating-point or integer overflow.',
  };
}

function* geometryUses() {
  yield {
    state: pointsGraph('Convex hull is the smallest fence around a point set'),
    highlight: { found: ['a', 'b', 'd', 'f', 'g', 'h', 'e-a-b', 'e-b-d', 'e-d-f', 'e-f-g', 'e-g-h', 'e-h-a'], removed: ['c', 'e'] },
    explanation: 'The hull throws away interior detail and keeps the extreme boundary. That boundary is useful as a cheap approximation before more expensive geometry work.',
  };

  yield {
    state: labelMatrix(
      'Where hulls appear',
      [
        { id: 'collision', label: 'collision' },
        { id: 'gis', label: 'GIS' },
        { id: 'vision', label: 'vision' },
        { id: 'mesh', label: 'meshing' },
      ],
      [
        { id: 'use', label: 'use' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['broad outline', 'quick reject'],
        ['region envelope', 'summarize points'],
        ['object silhouette', 'ignore interior'],
        ['outer boundary', 'feed triangulation'],
      ],
    ),
    highlight: { active: ['collision:use', 'gis:use'], found: ['mesh:lesson'] },
    explanation: 'Convex hulls often serve as a first-pass summary. They simplify a cloud of points into a boundary, then downstream algorithms decide whether the approximation is enough.',
  };

  yield {
    state: labelMatrix(
      'Algorithm comparisons',
      [
        { id: 'gift', label: 'gift wrap' },
        { id: 'graham', label: 'Graham scan' },
        { id: 'andrew', label: 'monotone chain' },
        { id: 'chan', label: 'Chan' },
      ],
      [
        { id: 'time', label: 'time' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['O(nh)', 'small hull output'],
        ['O(n log n)', 'angle sort'],
        ['O(n log n)', 'lexicographic sort'],
        ['O(n log h)', 'output-sensitive'],
      ],
    ),
    highlight: { active: ['andrew:time', 'andrew:fit'], compare: ['gift:time'], found: ['chan:time'] },
    explanation: 'Monotone chain is popular because the implementation is short, deterministic, and easy to pair with ordinary sorting. Output-sensitive algorithms can beat it when the hull has few vertices.',
  };

  yield {
    state: pointsGraph('Complete case: precompute a safe navigation boundary'),
    highlight: { found: ['a', 'b', 'd', 'f', 'g', 'h'], compare: ['c', 'e'] },
    explanation: 'A game tool can take obstacle vertices, compute hulls as coarse blockers, and use the hull edges for visibility, collision broad phase, or navigation preprocessing before exact polygon checks.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stack scan') yield* stackScan();
  else if (view === 'geometry uses') yield* geometryUses();
  else throw new InputError('Pick a convex-hull view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'The convex hull of a set of planar points is the smallest convex polygon that contains all of them. Andrew monotone chain is a compact O(n log n) algorithm for computing it: sort the points, scan once to build the lower chain, scan again to build the upper chain, and concatenate.',
      'The data-structure heart is a stack. Each new point tests the turn made by the last two stack points and the candidate. If the turn bends inward, pop the middle point because it cannot be on that chain of the hull.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Sort points by x coordinate, breaking ties by y. For the lower hull, walk left to right. While the stack has at least two points and the last two plus the candidate do not make the desired left turn, pop. Then push the candidate. For the upper hull, do the same scan in reverse order.',
      'The turn test is the sign of a cross product. Positive, negative, and zero encode orientation. The zero case is a policy choice: keep or remove collinear boundary points depending on whether the output should include every boundary sample or only polygon corners.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Sorting dominates at O(n log n). The scans are O(n) because each point is pushed and popped at most once per chain. Space is O(n) for the sorted points and hull stack. If input is already sorted, the hull construction itself is linear.',
      'Robustness is the real production issue. Floating-point roundoff can flip an orientation test near collinearity. Integer coordinates can overflow if the cross product is computed in too-small a type.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A mapping service receives many GPS points around a delivery zone. The convex hull gives a quick envelope for display, indexing, or first-pass containment. Interior points can still be needed for exact analytics, but the hull makes the outer extent obvious and cheap to compare.',
      'A game engine can similarly use hulls as coarse collision or visibility boundaries around cluttered obstacle vertices. The hull is not the exact shape, but it is a fast conservative wrapper.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: A. M. Andrew, "Another Efficient Algorithm for Convex Hulls in Two Dimensions", DOI https://doi.org/10.1016/0020-0190(79)90072-3; Isabelle AFP formalization of Andrew monotone chain, https://isa-afp.org/entries/Andrew_Monotone_Chain.html; and Wikibooks monotone-chain implementation notes, https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain. Study Monotonic Stack, Merge Sort, Sweep Line Segment Intersection, and Delaunay Triangulation & Voronoi Dual next.',
    ] },
  ],
};
