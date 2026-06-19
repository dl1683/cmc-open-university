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
  yield {
    state: labelMatrix(
      'Eight points sorted by x',
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
    explanation: 'Sort all n points by x-coordinate. This one-time O(n log n) sort is the foundation. The algorithm will recursively split this sorted array at the midpoint.',
  };

  yield {
    state: pointsGraph('Split at the median x-coordinate'),
    highlight: { active: ['div'], compare: ['p1', 'p2', 'p3', 'p4'], found: ['p5', 'p6', 'p7', 'p8'] },
    explanation: 'Divide the point set at the median x-coordinate. Left half: A, B, C, D. Right half: E, F, G, H. Each half is solved recursively.',
    invariant: 'Each recursive call returns the closest pair within its half.',
  };

  yield {
    state: labelMatrix(
      'Left half: find closest pair among {A, B, C, D}',
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
        ['3.16', 'best left'],
        ['4.12', ''],
        ['3.16', 'tied'],
        ['4.47', ''],
      ],
    ),
    highlight: { active: ['AC:dist'], found: ['AC:status'] },
    explanation: 'Recursion on the left half finds that A(1,2) and C(3,5) are the closest left pair, with distance sqrt((3-1)^2 + (5-2)^2) = sqrt(13) = 3.16.',
  };

  yield {
    state: labelMatrix(
      'Right half: find closest pair among {E, F, G, H}',
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
        ['2.24', 'best right'],
        ['2.24', 'tied'],
        ['3.16', ''],
        ['2.24', 'tied'],
      ],
    ),
    highlight: { active: ['GH:dist'], found: ['GH:status'] },
    explanation: 'Recursion on the right half finds that G(8,6) and H(9,4) are the closest right pair, with distance sqrt((9-8)^2 + (4-6)^2) = sqrt(5) = 2.24.',
  };

  yield {
    state: pointsGraph('d = min(left, right) = 2.24. Now check the strip.'),
    highlight: { active: ['strip', 'div'], found: ['p7', 'p8'], compare: ['p1', 'p3'] },
    explanation: 'Set d = min(3.16, 2.24) = 2.24. The closest overall pair might still cross the dividing line. Check only points within distance d of the midline: this is the strip of width 2d centered on x = 4.',
  };

  yield {
    state: labelMatrix(
      'Strip check: points within d=2.24 of midline x=4',
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
        ['yes: |3-4|=1', 'C-D: 4.47'],
        ['yes: |5-4|=1', 'D-E: 6.08'],
        ['yes: |6-4|=2', 'C-E: 3.61'],
      ],
    ),
    highlight: { active: ['C2:in', 'D2:in', 'E2:in'], compare: ['C2:checks', 'D2:checks', 'E2:checks'] },
    explanation: 'Only C, D, and E fall within the strip. Sort them by y, then compare each point to at most 7 successors in sorted-y order. None beat d = 2.24, so the overall answer remains G-H.',
  };

  yield {
    state: labelMatrix(
      'Result: closest pair is G(8,6) and H(9,4)',
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
        ['2.24', 'winner'],
        ['3.16', 'left half'],
        ['3.61', 'no improvement'],
      ],
    ),
    highlight: { found: ['best:dist', 'best:source'] },
    explanation: 'The closest pair is G(8,6) and H(9,4) at distance 2.24. The strip check found nothing closer, confirming the right-half result. Total work: O(n log n).',
  };
}

function* stripArgument() {
  yield {
    state: stripGraph('The strip: a band of width 2d centered on the dividing line'),
    highlight: { active: ['divline', 'box'], compare: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'] },
    explanation: 'After recursion, d is the smaller of the two half-results. Any cross-boundary pair closer than d must have both points within distance d of the midline. This strip is 2d wide.',
    invariant: 'Only points inside the strip can form a closer cross-boundary pair.',
  };

  yield {
    state: labelMatrix(
      'Why each point needs at most 7 comparisons',
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
        ['at most 8 in box', '4 per side at corners'],
        ['check 7 neighbors', 'strip is O(n)'],
      ],
    ),
    highlight: { active: ['rect:fact', 'pack:fact'], found: ['count:consequence', 'result:consequence'] },
    explanation: 'Consider a d-by-2d rectangle straddling the dividing line. Every point in this box is at least d apart from every other point on the same side. Pack circles of radius d/2 into a d-by-d square: at most 4 fit. Two such squares make at most 8 points. So each point compares against at most 7 others.',
  };

  yield {
    state: stripGraph('Sort strip points by y, scan 7 neighbors'),
    highlight: { active: ['q1', 'q2', 'q3', 'q7'], found: ['limit'], compare: ['e-q1-q2', 'e-q2-q3', 'e-q3-q7'] },
    explanation: 'Sort the strip points by y-coordinate. For each point, compare only to the next 7 points in y-order. If any pair beats d, update d. This scan is O(n) because the constant 7 does not grow with n.',
  };

  yield {
    state: labelMatrix(
      'Why 8 (not more) points fit in the d x 2d box',
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
        ['4', 'corners of d x d square'],
        ['4', 'corners of d x d square'],
        ['8', 'so check at most 7 others'],
        ['6', 'hexagonal packing (Shamos-Hoey)'],
      ],
    ),
    highlight: { active: ['left:max', 'right:max'], found: ['total:max', 'total:reason'], compare: ['tight:max'] },
    explanation: 'The left d-by-d square holds at most 4 points (placed at corners, each pair is at least d apart). Same for the right square. Total: 8 points in the d-by-2d strip window. A tighter hexagonal-packing analysis by Shamos and Hoey gives 6, reducing comparisons to 5. The constant does not matter for O(n); what matters is that it is constant.',
  };

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
        ['O(n)', 'constant comparisons per point'],
        ['O(n log n)', 'Master Theorem case 2'],
      ],
    ),
    highlight: { active: ['divide:cost', 'recurse:cost', 'strip:cost'], found: ['total:cost', 'total:why'] },
    explanation: 'Splitting is O(1) since points are pre-sorted. Each level does O(n) strip work across all subproblems. There are O(log n) levels. By the Master Theorem, T(n) = O(n log n). The initial sort is also O(n log n), so it does not change the overall bound.',
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
        "Points are positioned by their coordinates. The vertical dividing line shows where the algorithm splits the point set. Edges between points represent distance comparisons being made. The strip region highlights points near the dividing line that need cross-boundary checking.",
        "Active markers show the current decision: which half is being solved, which strip points are being compared. Found markers show the best pair discovered so far. Compare markers show candidates being measured against the current best.",
        "Watch the recursion shrink the problem, then watch the strip merge widen the search just enough to catch cross-boundary pairs without checking all of them.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "Given n points in the plane, find the two points with the smallest Euclidean distance between them. This is the closest pair problem, a fundamental question in computational geometry.",
        "It appears whenever physical or logical proximity matters: collision detection needs to know which objects are nearest, molecular simulation must identify close atoms for force calculations, geographic systems find nearest facilities, and clustering algorithms need pairwise distances as a preprocessing step.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "Check every pair. With n points there are n(n-1)/2 pairs. Compute each distance, keep the minimum. The code is five lines and obviously correct.",
        "For 100 points that is 4,950 distance calculations. Fast enough. For 1,000 points, 499,500. Still fine on modern hardware. The approach works and it is easy to trust.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "For 1,000,000 points there are about 500 billion pairs. Each pair requires a square root (or at least two multiplications and an addition for squared distance). At a billion operations per second, that is 500 seconds per query. Quadratic growth makes the brute-force approach unusable for large point sets.",
        "The missing idea is spatial locality. Most pairs are far apart and cannot possibly be the closest. The algorithm needs a way to rule out distant pairs without computing their distances.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Sort the points by x-coordinate, split at the median, and solve each half recursively. The hard part is combining: the closest pair might cross the dividing line. But the strip of points near the boundary is thin, and a packing argument proves each point in the strip needs at most 7 comparisons.",
        "The packing argument is the insight that makes the algorithm work. A d-by-2d rectangle straddling the dividing line can hold at most 8 points, because on each side every pair of points is at least d apart (otherwise the recursive result would have been smaller than d). That constant bound makes the merge step O(n) instead of O(n^2).",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Sort all n points by x-coordinate. This costs O(n log n) and happens once.",
        "Recurse: split the sorted array at the median into left and right halves. Solve each half. Let d_L and d_R be the closest distances in the left and right halves. Set d = min(d_L, d_R).",
        "Build the strip: collect every point whose x-coordinate is within d of the dividing line. Sort these strip points by y-coordinate (or maintain a pre-sorted y-order across recursive calls to avoid an extra log factor).",
        "Scan the strip: for each strip point, compare it to the next 7 points in y-sorted order. If any pair is closer than d, update d and record the pair. Return the overall closest pair.",
        "The algorithm was published by Michael Shamos and Dan Hoey in 1975. It matches the Omega(n log n) lower bound for this problem in the algebraic decision tree model.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Correctness follows from exhaustive case analysis. The closest pair either lies entirely in the left half, entirely in the right half, or crosses the dividing line. Recursion handles the first two cases. The strip scan handles the third.",
        "The strip scan is correct because of the packing argument. Consider any strip point p. Draw a d-by-2d rectangle with p at one edge. On the left side of the dividing line, points are at least d apart (by the recursive result for the left half). At most 4 such points fit in a d-by-d square (place them at corners). Same for the right side. So at most 8 points total occupy the rectangle, and p needs to check at most 7 of them.",
        "This means no closer cross-boundary pair is missed. If a pair has distance less than d, both points must be in the strip, and they must be among each other's 7 nearest y-neighbors in the strip. The scan checks exactly those pairs.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        "Time: O(n log n). The recurrence is T(n) = 2T(n/2) + O(n). Splitting is O(1) with pre-sorted data. The strip merge is O(n) because each point does at most 7 comparisons. By the Master Theorem, T(n) = O(n log n). The initial x-sort is also O(n log n).",
        "Space: O(n) for the sorted arrays and the strip. The recursion depth is O(log n).",
        "When n doubles, the work roughly doubles plus a logarithmic factor. 1,000 points take about 10,000 operations. 1,000,000 points take about 20,000,000. Compare that to the brute-force 500 billion.",
        "This matches the algebraic decision tree lower bound: no comparison-based algorithm can solve closest pair in less than Omega(n log n).",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        "Collision detection in physics engines and games: find which objects are close enough to interact. The closest pair subroutine feeds broad-phase collision systems.",
        "Molecular dynamics: atoms within a cutoff distance exert forces on each other. Finding close pairs is the bottleneck in force computation for large simulations.",
        "Geographic nearest-neighbor: given a set of facilities (hospitals, fire stations, cell towers), find the two closest. This feeds clustering, coverage analysis, and facility placement.",
        "Clustering preprocessing: algorithms like hierarchical clustering and DBSCAN need nearest-neighbor distances. Closest pair is the first step in single-linkage clustering.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "In high dimensions the strip packing argument weakens. In d dimensions, the number of points that can fit in the strip box grows exponentially with d. The constant 7 becomes impractical. KD-trees or locality-sensitive hashing are better for high-dimensional nearest-neighbor search.",
        "For dynamic point sets (frequent insertions and deletions), rebuilding the sorted order is expensive. A KD-tree or a grid-based spatial hash supports updates more naturally.",
        "When approximate answers suffice, a randomized grid approach is simpler: hash points into grid cells of side length d, and only check neighboring cells. This gives expected O(n) time but requires a good initial estimate of d.",
        "The algorithm assumes Euclidean distance. For other metrics (Manhattan, geodesic, graph distance), the packing argument changes or breaks entirely.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Eight points: A(1,2), B(2,8), C(3,5), D(5,1), E(6,7), F(7,3), G(8,6), H(9,4). Sorted by x, the median splits between D and E at x = 4.",
        "Left half {A, B, C, D}: recursion finds A-C as the closest left pair at distance sqrt(13) = 3.16. (Other candidates: A-B = 6.08, A-D = 4.12, B-C = 3.16, B-D = 7.62, C-D = 4.47.)",
        "Right half {E, F, G, H}: recursion finds G-H as the closest right pair at distance sqrt(5) = 2.24. (Other candidates: E-F = 4.12, E-G = 2.24, F-G = 3.16, F-H = 2.24, E-H = 4.24.)",
        "Set d = min(3.16, 2.24) = 2.24. Build the strip: points within 2.24 of x = 4 are C(3,5), D(5,1), E(6,7). Sort by y: D(5,1), C(3,5), E(6,7). Check pairs in y-order: D-C = 4.47, D-E = 6.08, C-E = 3.61. None beat 2.24.",
        "Result: the closest pair is G(8,6) and H(9,4) at distance 2.24. The strip check confirmed that no cross-boundary pair was closer.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Primary source: Shamos and Hoey, \"Closest-point problems\", Proceedings of the 16th Annual IEEE Symposium on Foundations of Computer Science, 1975, pp. 151-162. The O(n log n) divide-and-conquer algorithm and the algebraic decision tree lower bound both appear here.",
        "Study Convex Hull (Monotone Chain) for another divide-and-conquer geometry algorithm. Study KD-Tree for a spatial index that supports nearest-neighbor queries with dynamic updates. Study Sweep Line Segment Intersection for the sweep paradigm in computational geometry. Study Voronoi Diagram and Delaunay Triangulation for structures that encode all nearest-neighbor relationships at once.",
      ],
    },
  ],
};
