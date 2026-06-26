// Closest pair of points: divide-and-conquer in O(n log n).

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'closest-pair-of-points',
  title: 'Closest Pair of Points',
  category: 'Algorithms',
  summary: 'Given n points, find the pair with minimum Euclidean distance using divide and conquer in O(n log n).',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['divide and conquer', 'strip argument'], defaultValue: 'divide and conquer' },
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

function pointsGraph(title, highlights) {
  return graphState({
    nodes: [
      { id: 'p1', label: '(1,2)', x: 0.8, y: 6.4, note: 'A' },
      { id: 'p2', label: '(2,8)', x: 1.6, y: 1.6, note: 'B' },
      { id: 'p3', label: '(3,5)', x: 2.4, y: 4.0, note: 'C' },
      { id: 'p4', label: '(5,1)', x: 4.0, y: 7.2, note: 'D' },
      { id: 'p5', label: '(6,7)', x: 4.8, y: 2.4, note: 'E' },
      { id: 'p6', label: '(7,3)', x: 5.6, y: 5.6, note: 'F' },
      { id: 'p7', label: '(8,6)', x: 6.4, y: 3.2, note: 'G' },
      { id: 'p8', label: '(9,4)', x: 7.2, y: 4.8, note: 'H' },
      { id: 'div', label: '|', x: 3.2, y: 4.0, note: 'split' },
      { id: 'strip', label: 'strip', x: 9.0, y: 4.0, note: '2d wide' },
    ],
    edges: [
      { id: 'e-best-left', from: 'p1', to: 'p3', weight: 'd=3.2' },
      { id: 'e-best-right', from: 'p7', to: 'p8', weight: 'd=2.2' },
      { id: 'e-cross', from: 'p3', to: 'p5', weight: 'd=3.6' },
    ],
  }, { title });
}

function stripGraph(title) {
  return graphState({
    nodes: [
      { id: 'box', label: 'd x 2d', x: 4.5, y: 4.0, note: 'rectangle' },
      { id: 'q1', label: 'q1', x: 2.5, y: 2.0, note: '' },
      { id: 'q2', label: 'q2', x: 3.5, y: 3.0, note: '' },
      { id: 'q3', label: 'q3', x: 5.5, y: 2.5, note: '' },
      { id: 'q4', label: 'q4', x: 6.5, y: 5.0, note: '' },
      { id: 'q5', label: 'q5', x: 3.0, y: 5.5, note: '' },
      { id: 'q6', label: 'q6', x: 5.0, y: 6.0, note: '' },
      { id: 'q7', label: 'q7', x: 6.0, y: 3.5, note: '' },
      { id: 'divline', label: '|', x: 4.5, y: 1.0, note: 'midline' },
      { id: 'limit', label: '7 max', x: 8.5, y: 4.0, note: 'comparisons' },
    ],
    edges: [
      { id: 'e-q1-q2', from: 'q1', to: 'q2', weight: '' },
      { id: 'e-q2-q3', from: 'q2', to: 'q3', weight: '' },
      { id: 'e-q3-q7', from: 'q3', to: 'q7', weight: '' },
      { id: 'e-q5-q6', from: 'q5', to: 'q6', weight: '' },
    ],
  }, { title });
}

function* divideAndConquer() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const points = [
    { name: 'A', x: 1, y: 2 }, { name: 'B', x: 2, y: 8 },
    { name: 'C', x: 3, y: 5 }, { name: 'D', x: 5, y: 1 },
    { name: 'E', x: 6, y: 7 }, { name: 'F', x: 7, y: 3 },
    { name: 'G', x: 8, y: 6 }, { name: 'H', x: 9, y: 4 },
  ];
  const dist = (a, b) => r2(Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2));
  const n = points.length;
  const leftHalf = points.slice(0, 4);
  const rightHalf = points.slice(4);
  const midX = 4;

  yield {
    state: labelMatrix(
      `${n} points sorted by x`,
      [
        { id: 'A', label: 'A (1,2)' },
        { id: 'B', label: 'B (2,8)' },
        { id: 'C', label: 'C (3,5)' },
        { id: 'D', label: 'D (5,1)' },
        { id: 'E', label: 'E (6,7)' },
        { id: 'F', label: 'F (7,3)' },
        { id: 'G', label: 'G (8,6)' },
        { id: 'H', label: 'H (9,4)' },
      ],
      [
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
      ],
      [
        ['1', '2'], ['2', '8'], ['3', '5'], ['5', '1'],
        ['6', '7'], ['7', '3'], ['8', '6'], ['9', '4'],
      ],
    ),
    highlight: { active: ['A:x', 'B:x', 'C:x', 'D:x', 'E:x', 'F:x', 'G:x', 'H:x'] },
    explanation: `Sort all ${n} points by x-coordinate (x ranges from ${points[0].x} to ${points[n - 1].x}). This one-time O(${n} log ${n}) sort is the foundation. The algorithm will recursively split this sorted array at the midpoint. Brute force would check ${n * (n - 1) / 2} pairs.`,
  };

  yield {
    state: pointsGraph('Split at the median x-coordinate'),
    highlight: { active: ['div'], compare: ['p1', 'p2', 'p3', 'p4'], found: ['p5', 'p6', 'p7', 'p8'] },
    explanation: `Divide the ${n} points at the median x-coordinate (x = ${midX}). Left half: ${leftHalf.map(p => p.name).join(', ')} (${leftHalf.length} points). Right half: ${rightHalf.map(p => p.name).join(', ')} (${rightHalf.length} points). Each half is solved recursively.`,
    invariant: `Each recursive call returns the closest pair within its half.`,
  };

  const dAC = dist(points[0], points[2]);
  const dAD = dist(points[0], points[3]);
  const dBC = dist(points[1], points[2]);
  const dCD = dist(points[2], points[3]);
  yield {
    state: labelMatrix(
      `Left half: find closest pair among {${leftHalf.map(p => p.name).join(', ')}}`,
      [
        { id: 'AC', label: 'A-C' },
        { id: 'AD', label: 'A-D' },
        { id: 'BC', label: 'B-C' },
        { id: 'CD', label: 'C-D' },
      ],
      [
        { id: 'dist', label: 'distance' },
        { id: 'status', label: 'status' },
      ],
      [
        [`${dAC}`, 'best left'],
        [`${dAD}`, ''],
        [`${dBC}`, 'tied'],
        [`${dCD}`, ''],
      ],
    ),
    highlight: { active: ['AC:dist'], found: ['AC:status'] },
    explanation: `Recursion on the left half finds that ${points[0].name}(${points[0].x},${points[0].y}) and ${points[2].name}(${points[2].x},${points[2].y}) are the closest left pair, with distance sqrt((${points[2].x}-${points[0].x})^2 + (${points[2].y}-${points[0].y})^2) = sqrt(${(points[2].x - points[0].x) ** 2 + (points[2].y - points[0].y) ** 2}) = ${dAC}.`,
  };

  const dGH = dist(points[6], points[7]);
  const dEG = dist(points[4], points[6]);
  const dFG = dist(points[5], points[6]);
  const dFH = dist(points[5], points[7]);
  yield {
    state: labelMatrix(
      `Right half: find closest pair among {${rightHalf.map(p => p.name).join(', ')}}`,
      [
        { id: 'GH', label: 'G-H' },
        { id: 'EG', label: 'E-G' },
        { id: 'FG', label: 'F-G' },
        { id: 'FH', label: 'F-H' },
      ],
      [
        { id: 'dist', label: 'distance' },
        { id: 'status', label: 'status' },
      ],
      [
        [`${dGH}`, 'best right'],
        [`${dEG}`, 'tied'],
        [`${dFG}`, ''],
        [`${dFH}`, 'tied'],
      ],
    ),
    highlight: { active: ['GH:dist'], found: ['GH:status'] },
    explanation: `Recursion on the right half finds that ${points[6].name}(${points[6].x},${points[6].y}) and ${points[7].name}(${points[7].x},${points[7].y}) are the closest right pair, with distance sqrt((${points[7].x}-${points[6].x})^2 + (${points[7].y}-${points[6].y})^2) = sqrt(${(points[7].x - points[6].x) ** 2 + (points[7].y - points[6].y) ** 2}) = ${dGH}.`,
  };

  const d = Math.min(dAC, dGH);
  const stripWidth = r2(d * 2);
  yield {
    state: pointsGraph(`d = min(left, right) = ${d}. Now check the strip.`),
    highlight: { active: ['strip', 'div'], found: ['p7', 'p8'], compare: ['p1', 'p3'] },
    explanation: `Set d = min(${dAC}, ${dGH}) = ${d}. The closest overall pair might still cross the dividing line. Check only points within distance ${d} of the midline: this is the strip of width ${stripWidth} centered on x = ${midX}.`,
  };

  const stripPoints = points.filter(p => Math.abs(p.x - midX) <= d);
  const stripNames = stripPoints.map(p => p.name);
  const dCD_strip = dist(points[2], points[3]);
  const dDE = dist(points[3], points[4]);
  const dCE = dist(points[2], points[4]);
  const stripBest = Math.min(dCD_strip, dDE, dCE);
  yield {
    state: labelMatrix(
      `Strip check: points within d=${d} of midline x=${midX}`,
      [
        { id: 'C2', label: 'C (3,5)' },
        { id: 'D2', label: 'D (5,1)' },
        { id: 'E2', label: 'E (6,7)' },
      ],
      [
        { id: 'in', label: 'in strip?' },
        { id: 'checks', label: 'pairs checked' },
      ],
      [
        [`yes: |${points[2].x}-${midX}|=${Math.abs(points[2].x - midX)}`, `C-D: ${dCD_strip}`],
        [`yes: |${points[3].x}-${midX}|=${Math.abs(points[3].x - midX)}`, `D-E: ${dDE}`],
        [`yes: |${points[4].x}-${midX}|=${Math.abs(points[4].x - midX)}`, `C-E: ${dCE}`],
      ],
    ),
    highlight: { active: ['C2:in', 'D2:in', 'E2:in'], compare: ['C2:checks', 'D2:checks', 'E2:checks'] },
    explanation: `Only ${stripNames.join(', ')} fall within the strip (${stripNames.length} points). Sort them by y, then compare each point to at most 7 successors in sorted-y order. Best strip distance is ${stripBest}, which does not beat d = ${d}, so the overall answer remains ${points[6].name}-${points[7].name}.`,
  };

  yield {
    state: labelMatrix(
      `Result: closest pair is ${points[6].name}(${points[6].x},${points[6].y}) and ${points[7].name}(${points[7].x},${points[7].y})`,
      [
        { id: 'best', label: 'G-H' },
        { id: 'leftb', label: 'A-C (left best)' },
        { id: 'stripb', label: 'strip best' },
      ],
      [
        { id: 'dist', label: 'distance' },
        { id: 'source', label: 'source' },
      ],
      [
        [`${dGH}`, 'winner'],
        [`${dAC}`, 'left half'],
        [`${stripBest}`, 'no improvement'],
      ],
    ),
    highlight: { found: ['best:dist', 'best:source'] },
    explanation: `The closest pair is ${points[6].name}(${points[6].x},${points[6].y}) and ${points[7].name}(${points[7].x},${points[7].y}) at distance ${dGH}. The strip check found nothing closer (best strip: ${stripBest}), confirming the right-half result. Total work: O(${n} log ${n}) vs brute-force ${n * (n - 1) / 2} pairs.`,
  };
}

function* stripArgument() {
  const maxPerSide = 4;
  const maxInBox = maxPerSide * 2;
  const maxComparisons = maxInBox - 1;
  const tighterMax = 6;
  const tighterComps = tighterMax - 1;
  const stripPoints = 7;

  yield {
    state: stripGraph('The strip: a band of width 2d centered on the dividing line'),
    highlight: { active: ['divline', 'box'], compare: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] },
    explanation: `After recursion, d is the smaller of the two half-results. Any cross-boundary pair closer than d must have both points within distance d of the midline. This strip is 2d wide. ${stripPoints} candidate points shown in this example.`,
    invariant: `Only points inside the strip can form a closer cross-boundary pair. Each point checks at most ${maxComparisons} neighbors.`,
  };

  yield {
    state: labelMatrix(
      `Why each point needs at most ${maxComparisons} comparisons`,
      [
        { id: 'rect', label: 'd x 2d rectangle' },
        { id: 'pack', label: 'packing argument' },
        { id: 'count', label: 'max points' },
        { id: 'result', label: 'comparisons' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'consequence', label: 'consequence' },
      ],
      [
        ['d high, 2d wide', 'centered on dividing line'],
        ['min distance = d', 'points d apart or more'],
        [`at most ${maxInBox} in box`, `${maxPerSide} per side at corners`],
        [`check ${maxComparisons} neighbors`, 'strip is O(n)'],
      ],
    ),
    highlight: { active: ['rect:fact', 'pack:fact'], found: ['count:consequence', 'result:consequence'] },
    explanation: `Consider a d-by-2d rectangle straddling the dividing line. Every point in this box is at least d apart from every other point on the same side. Pack circles of radius d/2 into a d-by-d square: at most ${maxPerSide} fit. Two such squares make at most ${maxInBox} points. So each point compares against at most ${maxComparisons} others.`,
  };

  yield {
    state: stripGraph(`Sort strip points by y, scan ${maxComparisons} neighbors`),
    highlight: { active: ['q1', 'q2', 'q3', 'q7'], found: ['limit'], compare: ['e-q1-q2', 'e-q2-q3', 'e-q3-q7'] },
    explanation: `Sort the strip points by y-coordinate. For each point, compare only to the next ${maxComparisons} points in y-order. If any pair beats d, update d. This scan is O(n) because the constant ${maxComparisons} does not grow with n.`,
  };

  yield {
    state: labelMatrix(
      `Why ${maxInBox} (not more) points fit in the d x 2d box`,
      [
        { id: 'left', label: 'left d x d' },
        { id: 'right', label: 'right d x d' },
        { id: 'total', label: 'total' },
        { id: 'tight', label: 'tighter bound' },
      ],
      [
        { id: 'max', label: 'max points' },
        { id: 'reason', label: 'reason' },
      ],
      [
        [`${maxPerSide}`, 'corners of d x d square'],
        [`${maxPerSide}`, 'corners of d x d square'],
        [`${maxInBox}`, `so check at most ${maxComparisons} others`],
        [`${tighterMax}`, 'hexagonal packing (Shamos-Hoey)'],
      ],
    ),
    highlight: { active: ['left:max', 'right:max'], found: ['total:max', 'total:reason'], compare: ['tight:max'] },
    explanation: `The left d-by-d square holds at most ${maxPerSide} points (placed at corners, each pair is at least d apart). Same for the right square. Total: ${maxInBox} points in the d-by-2d strip window. A tighter hexagonal-packing analysis by Shamos and Hoey gives ${tighterMax}, reducing comparisons to ${tighterComps}. The constant does not matter for O(n); what matters is that it is constant.`,
  };

  const levels = 'log n';
  yield {
    state: labelMatrix(
      'Recurrence: T(n) = 2T(n/2) + O(n)',
      [
        { id: 'divide', label: 'divide' },
        { id: 'recurse', label: 'recurse' },
        { id: 'strip', label: 'strip merge' },
        { id: 'total', label: 'total' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'why', label: 'why' },
      ],
      [
        ['O(1)', 'median is known'],
        ['2T(n/2)', 'two half-size problems'],
        ['O(n)', `${maxComparisons} comparisons per point`],
        ['O(n log n)', 'Master Theorem case 2'],
      ],
    ),
    highlight: { active: ['divide:cost', 'recurse:cost', 'strip:cost'], found: ['total:cost', 'total:why'] },
    explanation: `Splitting is O(1) since points are pre-sorted. Each level does O(n) strip work (at most ${maxComparisons} comparisons per point) across all subproblems. There are O(${levels}) levels. By the Master Theorem, T(n) = O(n log n). The initial sort is also O(n log n), so it does not change the overall bound.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'divide and conquer') yield* divideAndConquer();
  else if (view === 'strip argument') yield* stripArgument();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each dot on the canvas is a point at its (x, y) position. A vertical line appears whenever the algorithm splits the point set at the median x-coordinate. An edge drawn between two dots means the algorithm is measuring that distance right now. A shaded band around the vertical line is the strip -- the narrow region where cross-boundary pairs might beat the current best.',
        {type: 'callout', text: 'Closest pair becomes fast when spatial order proves that almost every pair is too far away to matter.'},
        'Colors encode roles. Active markers (bright) show the subproblem being solved. Found markers show the best pair discovered so far. Compare markers highlight a candidate pair being tested against the current best. Follow the recursion as it breaks the point set into tiny base cases of two or three points, solves each by brute force, then merges results upward -- checking only the strip at each level.',
        {type: 'image', src: './assets/gifs/closest-pair-of-points.gif', alt: 'Animated walkthrough of the closest pair of points visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'You have n points in two-dimensional space. Each point is a pair of numbers (x, y). The Euclidean distance between two points (x1, y1) and (x2, y2) is sqrt((x2 - x1)^2 + (y2 - y1)^2). The closest pair problem asks: which two points have the smallest Euclidean distance?',
        'This comes up constantly. A game engine needs to know which two objects might collide. A molecular dynamics simulation computes forces between atoms only within a cutoff radius, so it must find nearby pairs every timestep. Single-linkage clustering repeatedly merges the two closest points into one cluster. Cell tower planning checks whether two towers sit too close together, wasting coverage. The problem is easy to state and appears deceptively simple, but solving it fast requires a genuinely clever idea.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Check every pair. With n points there are n(n-1)/2 distinct pairs. A nested loop -- for each point i, for each point j > i, compute dist(i, j) and track the minimum -- solves the problem in five lines. It is obviously correct because it exhausts every possibility.',
        'For n = 100 that is 4,950 distance computations, effectively instant. For n = 1,000 it is 499,500 -- still under a millisecond on modern hardware. At these sizes, brute force is the right answer: any fancier algorithm would spend more time on its own bookkeeping than it saves on skipped comparisons.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'At n = 1,000,000 there are roughly 5 * 10^11 pairs. Each distance computation costs two subtractions, two multiplications, an addition, and possibly a square root. At a billion arithmetic operations per second, brute force takes around 500 seconds. Double n to 2,000,000 and the runtime quadruples to about 2,000 seconds. That is the hallmark of O(n^2): doubling the input multiplies the cost by four.',
        'The waste is geometric. A point near the origin and a point at (999, 999) cannot possibly be the closest pair. Computing their distance accomplishes nothing. Brute force treats every pair as equally promising, but the plane has structure -- most points are far from most other points. An efficient algorithm must exploit that structure to skip distant pairs without ever measuring them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sort the points by x-coordinate. Draw a vertical line at the median x-value, splitting the set into a left half and a right half of equal size. Solve each half recursively: the left half yields a closest pair at distance d_L, the right half yields d_R. Set d = min(d_L, d_R). Now every pair that lies entirely on one side has been accounted for. The only remaining danger is a cross-boundary pair -- one point left of the line, one point right -- whose distance is less than d.',
        {type: 'image', src: 'https://www.cs.toronto.edu/~kianoosh/courses/csc209/resources/images/closest_points.png', alt: 'Divide-and-conquer closest pair diagram with vertical split and strip', caption: 'The divide-and-conquer picture shows the whole trick: solve halves first, then inspect only the narrow strip around the split. Source: University of Toronto CSC209 handout, https://www.cs.toronto.edu/~kianoosh/courses/csc209/resources/handouts/a2.html.'},
        'For a cross-boundary pair to beat d, both points must lie within x-distance d of the dividing line -- otherwise the x-component of their distance alone exceeds d. This carves out a vertical strip of width 2d. The critical question: how many pairs inside this strip must we check? The answer comes from a packing argument. Take any point p in the strip and consider the 2d-by-d rectangle centered horizontally on the dividing line and extending d above p. On the left half of this rectangle (a d-by-d square), every pair of points is at least d apart (the recursive solution guarantees this), so at most 4 points fit (pack them at corners for the tightest arrangement). The same holds for the right d-by-d square. That gives at most 8 points total in the rectangle, so p needs to be compared against at most 7 others. Seven is a constant. The merge step costs O(n), not O(n^2).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Presort: sort all n points by x-coordinate in O(n log n) time. Also build a copy sorted by y-coordinate. Both sorts happen once at the top level.',
        'Recurse: split the x-sorted array at the median into two halves of size n/2. Recurse on each half. Base case: when the subproblem has 3 or fewer points, check all pairs by brute force (at most 3 distance computations). Each recursive call returns the closest pair it found and its distance.',
        'Merge: let d = min(d_L, d_R). Walk through the y-sorted array and collect every point whose x-coordinate is within d of the dividing line -- this produces the strip, already sorted by y, in O(n) time. For each point in the strip, compare it against the next 7 points in y-order. If any distance is less than d, update d and record the new best pair.',
        'Unwind: return the best pair found (from the left recursion, the right recursion, or the strip scan). The recursion unwinds level by level until the top call returns the global closest pair. This algorithm was published by Michael Shamos and Dan Hoey in 1975.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from an exhaustive case analysis. The closest pair in the entire set either (a) has both points in the left half, (b) has both points in the right half, or (c) has one point on each side. Cases (a) and (b) are solved by recursion. Case (c) is solved by the strip scan. These three cases cover every possible pair, so nothing is missed.',
        'The strip scan itself is correct because of the packing bound. Assume a cross-boundary pair (p, q) has distance less than d. Then both p and q lie in the strip (their x-coordinates are within d of the dividing line). Point q must also be within d of p in the y-direction, or else dist(p, q) >= d. So q sits inside the 2d-by-d rectangle around p. That rectangle holds at most 8 points (4 per side, packed at corners of d-by-d squares). Therefore q is among p\'s 7 nearest y-neighbors. The algorithm checks exactly those 7, so it finds (p, q).',
        'The bound of 7 is tight. Place 4 points at the corners of a d-by-d square on the left side, and 4 at the corners on the right side. Every within-side pair is exactly d apart, consistent with the recursive guarantee. All 8 points sit in the 2d-by-d box. So a strip point really can have 7 neighbors that need checking -- the algorithm does the minimum necessary work.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The recurrence is T(n) = 2T(n/2) + O(n). Two recursive calls on halves of size n/2, plus O(n) work for building and scanning the strip. The Master Theorem applies: a = 2, b = 2, f(n) = n, log_b(a) = 1, so f(n) = Theta(n^1) and T(n) = O(n log n). The presort is also O(n log n). Total: O(n log n).',
        'Space is O(n): the x-sorted and y-sorted arrays each hold n points, and the strip array is at most n entries. Recursion depth is O(log n), adding that many stack frames. Memory is dominated by the point arrays.',
        'At n = 1,000,000, brute force performs about 5 * 10^11 comparisons. Divide-and-conquer does roughly n * log2(n) = 20,000,000 operations -- a 25,000x speedup. At n = 10^9 the ratio exceeds 10^7.',
        'This bound is optimal. Shamos and Hoey proved an Omega(n log n) lower bound in the algebraic decision tree model. Any algorithm for closest pair that uses only comparisons, additions, and multiplications must do at least n log n work. The divide-and-conquer algorithm matches that lower bound exactly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Collision detection in game engines runs in two phases. The broad phase identifies candidate pairs that might be close enough to collide; the narrow phase tests precise geometry. Closest-pair logic powers the broad phase. Without it, a scene with 10,000 objects would require 50 million pairwise tests every frame.',
        {type: 'image', src: 'https://commons.wikimedia.org/wiki/Special:FilePath/Voronoi_diagram.svg', alt: 'Voronoi diagram partitioning the plane around points', caption: 'Voronoi cells encode nearest-site regions, the geometric structure behind many closest-neighbor problems. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Voronoi_diagram.svg.'},
        'Molecular dynamics packages (LAMMPS, GROMACS) spend most of their runtime on neighbor-finding. Atoms interact only within a cutoff radius, so each timestep builds a neighbor list. The cell-list and Verlet-list methods used for this are descendants of the same spatial-decomposition idea that powers closest pair.',
        'Single-linkage hierarchical clustering finds the globally closest pair of data points, merges them into one cluster, and repeats. The naive loop is O(n^3). A closest-pair data structure that supports deletions reduces this to O(n^2 log n). GIS applications use the same idea for facility siting -- given n candidate hospital locations, find the two closest to avoid redundant coverage.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'In high dimensions the packing argument breaks down. In d dimensions, the strip box can hold up to O(2^d) points, so each point must check an exponential number of neighbors. At d = 20, the constant exceeds a million and the algorithm performs worse than brute force. KD-trees, ball trees, or locality-sensitive hashing handle high-dimensional nearest-neighbor search instead.',
        'Dynamic point sets are another weakness. If points are inserted and deleted frequently, the algorithm must re-sort and rebuild from scratch every time. A KD-tree or grid-based spatial hash can absorb incremental updates at O(log n) per operation, making them better for real-time scenarios where the point set changes every frame.',
        'The algorithm also assumes Euclidean distance in flat 2D space. For geodesic distance on a sphere (finding the two closest cities on Earth), the strip geometry changes because "within distance d" is no longer a rectangle. For graph-based distances, the packing argument has no geometric basis at all. For Manhattan (L1) distance, the packing constant changes because L1 balls are diamonds, not circles, altering how many fit in a box.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take six points: P1(2, 3), P2(12, 30), P3(40, 50), P4(5, 1), P5(12, 10), P6(3, 4). Sort by x-coordinate: P1(2, 3), P6(3, 4), P4(5, 1), P2(12, 30), P5(12, 10), P3(40, 50). The median x falls between P4 (x = 5) and P2 (x = 12), so the dividing line sits at x = 8.5.',
        'Left half: {P1, P6, P4}. Three points, so brute-force all pairs. dist(P1, P6) = sqrt((3 - 2)^2 + (4 - 3)^2) = sqrt(1 + 1) = sqrt(2) = 1.41. dist(P1, P4) = sqrt((5 - 2)^2 + (1 - 3)^2) = sqrt(9 + 4) = sqrt(13) = 3.61. dist(P6, P4) = sqrt((5 - 3)^2 + (1 - 4)^2) = sqrt(4 + 9) = sqrt(13) = 3.61. Best left pair: P1-P6, d_L = 1.41.',
        'Right half: {P2, P5, P3}. dist(P2, P5) = sqrt(0 + 400) = 20. dist(P2, P3) = sqrt(784 + 400) = sqrt(1184) = 34.41. dist(P5, P3) = sqrt(784 + 1600) = sqrt(2384) = 48.84. Best right pair: P2-P5, d_R = 20.',
        'Set d = min(1.41, 20) = 1.41. Build the strip: collect every point with x in [8.5 - 1.41, 8.5 + 1.41] = [7.09, 9.91]. Check each point: P1 (x = 2) no, P6 (x = 3) no, P4 (x = 5) no, P2 (x = 12) no, P5 (x = 12) no, P3 (x = 40) no. The strip is empty. No cross-boundary pair can beat 1.41.',
        'Answer: P1(2, 3) and P6(3, 4) at distance sqrt(2) = 1.41. The algorithm computed 6 distances (3 per base case) and 0 strip comparisons. Brute force would have computed all 15 pairs. At larger n the strip stays narrow -- d is set by the recursive best, which tends to be small -- so the savings grow dramatically.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Shamos, M. I. and Hoey, D., "Closest-point problems," Proceedings of the 16th Annual IEEE Symposium on Foundations of Computer Science (FOCS), 1975, pp. 151-162. This paper presents both the O(n log n) divide-and-conquer algorithm and the matching Omega(n log n) lower bound in the algebraic decision tree model. Cormen, Leiserson, Rivest, and Stein cover the algorithm in Introduction to Algorithms (CLRS), chapter 33.',
        'Related topics to study next: Convex Hull (Graham Scan / Monotone Chain) uses the same divide-and-conquer skeleton for another O(n log n) geometry problem. KD-Tree provides a spatial index that answers nearest-neighbor queries in O(log n) expected time and handles dynamic updates. Sweep Line Segment Intersection demonstrates the sweep-line paradigm in computational geometry. Voronoi Diagram encodes all nearest-neighbor relationships at once -- the closest pair in a point set corresponds to the shortest edge in its Delaunay triangulation.',
      ],
    },
  ],
};
