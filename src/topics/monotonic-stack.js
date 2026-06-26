// Monotonic stack: keep unresolved candidates ordered while scanning once.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'monotonic-stack',
  title: 'Monotonic Stack',
  category: 'Data Structures',
  summary: 'A stack that keeps candidates in sorted order so nearest-greater, nearest-smaller, span, and histogram problems collapse to one pass.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['next greater', 'histogram area'], defaultValue: 'next greater' },
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

function stackGraph(title) {
  return graphState({
    nodes: [
      { id: 'scan', label: 'scan left to right', x: 0.8, y: 3.6, note: 'array values' },
      { id: 'cur', label: 'current value', x: 2.7, y: 3.6, note: 'new evidence' },
      { id: 'top', label: 'stack top', x: 4.7, y: 2.1, note: 'most recent unresolved' },
      { id: 'older', label: 'older entries', x: 4.7, y: 5.1, note: 'ordered candidates' },
      { id: 'pop', label: 'pop resolved', x: 6.8, y: 2.1, note: 'answer found' },
      { id: 'push', label: 'push current', x: 6.8, y: 5.1, note: 'unresolved now' },
      { id: 'answer', label: 'answers', x: 8.7, y: 3.6, note: 'nearest greater/smaller' },
    ],
    edges: [
      { id: 'e-scan-cur', from: 'scan', to: 'cur', weight: 'next item' },
      { id: 'e-cur-top', from: 'cur', to: 'top', weight: 'compare' },
      { id: 'e-top-pop', from: 'top', to: 'pop', weight: 'violates order' },
      { id: 'e-pop-answer', from: 'pop', to: 'answer', weight: 'write result' },
      { id: 'e-cur-push', from: 'cur', to: 'push', weight: 'store index' },
      { id: 'e-push-older', from: 'push', to: 'older', weight: 'maintain order' },
    ],
  }, { title });
}

function* nextGreater() {
  const arr = [2, 1, 5, 3, 4];
  const n = arr.length;
  yield {
    state: labelMatrix(
      `Array [${arr}]`,
      [
        { id: 'i0', label: '0:2' },
        { id: 'i1', label: '1:1' },
        { id: 'i2', label: '2:5' },
        { id: 'i3', label: '3:3' },
        { id: 'i4', label: '4:4' },
      ],
      [
        { id: 'stack', label: 'stack after scan' },
        { id: 'answer', label: 'next greater' },
      ],
      [
        ['[2]', '?'],
        ['[2,1]', '?'],
        ['[5]', '2->5, 1->5'],
        ['[5,3]', '?'],
        ['[5,4]', '3->4'],
      ],
    ),
    highlight: { active: ['i2:stack', 'i2:answer'], found: ['i4:answer'], compare: ['i3:stack'] },
    explanation: `For ${n} elements, keep a decreasing stack of unresolved indexes. A larger incoming value is the first greater value for every smaller entry it pops.`,
    invariant: `The unresolved stack is monotone decreasing by value from bottom to top across all ${n} positions.`,
  };

  yield {
    state: stackGraph('Current value resolves a run of smaller stack entries'),
    highlight: { active: ['cur', 'top', 'pop', 'answer', 'e-cur-top', 'e-top-pop', 'e-pop-answer'], compare: ['older'] },
    explanation: `The current value is new information from the right. If it beats the stack top, that top has found the nearest greater value to its right and can leave forever.`,
  };

  const accountingRows = 4;
  yield {
    state: labelMatrix(
      'Amortized accounting',
      [
        { id: 'push', label: 'push index' },
        { id: 'pop', label: 'pop index' },
        { id: 'compare', label: 'compare top' },
        { id: 'total', label: 'full scan' },
      ],
      [
        { id: 'count', label: 'how often' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['once per element', 'enters unresolved set'],
        ['at most once per element', 'answer found or discarded'],
        ['charged to push/pop', 'no repeated scanning'],
        ['O(n)', 'each index enters and exits once'],
      ],
    ),
    highlight: { found: ['total:count', 'total:reason'], active: ['push:count', 'pop:count'] },
    explanation: `The while loop can pop many items at one position, but each of the ${n} items is popped only once. That is the same amortized shape as Monotonic Queue and Stack-backed parsing.`,
  };

  const variantCount = 4;
  yield {
    state: labelMatrix(
      'Pattern variants',
      [
        { id: 'greater', label: 'next greater' },
        { id: 'smaller', label: 'next smaller' },
        { id: 'previous', label: 'previous greater/smaller' },
        { id: 'circular', label: 'circular array' },
      ],
      [
        { id: 'scan', label: 'scan rule' },
        { id: 'stackOrder', label: 'stack order' },
      ],
      [
        ['left to right', 'decreasing'],
        ['left to right', 'increasing'],
        ['answer before push', 'opposite comparison'],
        ['scan twice', 'same unresolved stack'],
      ],
    ),
    highlight: { active: ['greater:stackOrder', 'smaller:stackOrder'], compare: ['circular:scan'] },
    explanation: `The same template solves ${variantCount} nearest-neighbor variants. The choices are scan direction, comparison operator, duplicate handling, and whether answers are written when popping or before pushing.`,
  };
}

function* histogramArea() {
  const histogram = [2, 1, 5, 6, 2, 3];
  const barCount = histogram.length;
  yield {
    state: labelMatrix(
      `Histogram [${histogram}]`,
      [
        { id: 'b0', label: '0:2' },
        { id: 'b1', label: '1:1' },
        { id: 'b2', label: '2:5' },
        { id: 'b3', label: '3:6' },
        { id: 'b4', label: '4:2' },
        { id: 'b5', label: '5:3' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'area', label: 'area event' },
      ],
      [
        ['bar', 'wait'],
        ['left boundary reset', 'pop 2 area=2'],
        ['increasing stack', 'wait'],
        ['increasing stack', 'wait'],
        ['right boundary', 'pop 6 and 5'],
        ['new higher bar', 'wait'],
      ],
    ),
    highlight: { active: ['b4:role', 'b4:area'], found: ['b3:area', 'b2:area'] },
    explanation: `Largest rectangle across ${barCount} bars uses an increasing stack. A shorter bar proves taller bars on the stack cannot extend farther right, so their maximal rectangles can be scored now.`,
  };

  const shortHeight = 2;
  const tallHeights = [5, 6];
  yield {
    state: stackGraph('A shorter bar closes rectangles for taller bars'),
    highlight: { active: ['cur', 'top', 'pop', 'answer', 'e-top-pop'], found: ['older'], compare: ['push'] },
    explanation: `When height ${shortHeight} arrives after ${tallHeights[0]} and ${tallHeights[1]}, it becomes the right boundary for both taller bars. The new stack top after popping gives the left boundary.`,
    invariant: `The stack is increasing by height; indexes between stack entries have already been resolved.`,
  };

  const maxArea = 10;
  yield {
    state: labelMatrix(
      'Rectangle width after pop',
      [
        { id: 'pop6', label: 'pop height 6' },
        { id: 'pop5', label: 'pop height 5' },
        { id: 'sentinel', label: 'final sentinel' },
        { id: 'max', label: 'max area' },
      ],
      [
        { id: 'width', label: 'width' },
        { id: 'area', label: 'area' },
      ],
      [
        ['1', '6'],
        ['2', '10'],
        ['flush remaining', 'compute all'],
        ['height 5 width 2', '10'],
      ],
    ),
    highlight: { found: ['pop5:area', 'max:area'], compare: ['pop6:area'] },
    explanation: `The width is currentIndex - previousSmallerIndex - 1. The maximum rectangle has area ${maxArea}. A sentinel height 0 at the end flushes all remaining bars so every candidate rectangle is scored.`,
  };

  const caseCount = 4;
  yield {
    state: labelMatrix(
      'Case-study uses',
      [
        { id: 'stock', label: 'stock span' },
        { id: 'temperatures', label: 'daily temperatures' },
        { id: 'histogram', label: 'histogram area' },
        { id: 'parser', label: 'syntax spans' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'whyStack', label: 'why stack fits' },
      ],
      [
        ['how far back until greater?', 'previous greater'],
        ['days until warmer?', 'next greater'],
        ['largest rectangle?', 'previous/next smaller'],
        ['nearest unmatched token?', 'ordered unresolved contexts'],
      ],
    ),
    highlight: { found: ['histogram:whyStack', 'temperatures:whyStack'], compare: ['parser:question'] },
    explanation: `Across ${caseCount} use cases, the complete pattern is one-pass boundary discovery: keep only candidates that have not yet met the first value capable of resolving them.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'next greater') yield* nextGreater();
  else if (view === 'histogram area') yield* histogramArea();
  else throw new InputError('Pick a monotonic-stack view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'A monotonic stack keeps unresolved boundaries in order so one future value can settle many earlier questions at once.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Lifo_stack.svg/500px-Lifo_stack.svg.png', alt: 'LIFO stack diagram showing push and pop order', caption: 'The stack discipline matters because only the most recent unresolved candidate can be settled before older candidates below it. Source: Wikimedia Commons, Maxtremus, CC BY-SA 4.0.'},
        'Read the stack as unresolved questions. Active marks the current value, and found marks a candidate whose nearest boundary has just become known.',
        'The safe inference rule is first-boundary resolution. If the current value pops an older index, then every value between them already failed to resolve that index, so the current value is the nearest valid boundary.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Stack_UML_class_diagram.svg/250px-Stack_UML_class_diagram.svg.png', alt: 'UML class diagram for a stack interface', caption: 'A monotonic stack keeps the ordinary stack interface, then adds one invariant about value order. Source: Wikimedia Commons, Rfc1394, public domain.'},
        {type: 'image', src: './assets/gifs/monotonic-stack.gif', alt: 'Animated walkthrough of the monotonic stack visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A monotonic stack solves nearest greater, nearest smaller, span, and histogram-boundary problems. These problems ask for the first later or earlier value that crosses a comparison threshold.',
        'The difficulty is that many positions wait for the same future value. A stack keeps only candidates whose boundary has not yet arrived.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach starts at each index and scans right until it finds a larger value. For daily temperatures, day i checks day i + 1, then i + 2, and keeps going until a warmer day appears.',
        'That is easy to trust because it mirrors the definition. It repeats boundary search for many indexes that a single future value could settle at once.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is quadratic work on inputs that force repeated scans. For largest rectangle in a histogram, expanding left and right from every bar can re-check the same taller run many times.',
        'The repeated work is unnecessary because a shorter bar can close many taller bars at once. The problem needs a structure for unresolved boundaries, not a fresh scan from every index.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep a stack whose order makes unresolved candidates comparable. For next greater element, the stack is decreasing; a larger incoming value resolves all smaller values on top.',
        'For largest histogram rectangle, the stack is increasing. A shorter incoming bar supplies the first right boundary for taller bars that must now be scored.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Scan once and store indexes, not just values. While the current value resolves the stack top, pop the top and write its answer using the current index.',
        'After popping stops, push the current index as unresolved. A sentinel value is often added at the end when remaining candidates need a final boundary, such as height 0 for histograms.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the stack contains exactly the unresolved candidates in monotone order. If a candidate had already found a valid boundary, it would have been popped when that boundary arrived.',
        'When the current value pops a candidate, no intervening value was valid, because any such value would have popped it earlier. The current value is therefore not merely a valid boundary; it is the nearest one.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every index is pushed once and popped at most once, so the scan is O(n). Space is O(n) in the worst case when no candidate resolves until the end.',
        'The cost behaves like a ledger. A frame that pops five entries looks expensive, but those five entries are gone forever, so later frames do not pay for them again.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern appears in stock span, daily temperatures, next greater element, largest rectangle in a histogram, rainwater boundaries, and visibility counts. The access pattern is one pass plus nearest-boundary answers.',
        'It also appears in parsers, layout engines, and compaction passes where nested or ordered spans close when a boundary token arrives. The stack is useful when unresolved local structure must be closed by a later event.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when a popped candidate might become useful later. That means the dominance or boundary argument is false, and deleting the candidate loses information.',
        'It also fails for arbitrary online range queries, mutable data, and rolling windows with expiration by time. Use a segment tree, Fenwick tree, sparse table, or monotonic queue when those constraints dominate.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For temperatures [73, 74, 75, 71, 69, 72], keep a decreasing stack of day indexes. Day 0 with 73 is pushed, day 1 with 74 pops day 0 and records distance 1, then day 1 is pushed.',
        'Day 2 with 75 pops day 1 and records distance 1. Days 3 and 4 push because 71 and 69 are cooler, then day 5 with 72 pops day 4 with distance 1 and day 3 with distance 2. Each recorded answer is nearest because no earlier warmer day appeared while the index sat on the stack.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study stack discipline, amortized analysis, nearest greater element, and largest rectangle in a histogram. The key proof to practice is why a popped item never needs to return.',
        'Next study Monotonic Queue for moving-window extrema, Cartesian Tree for the tree view of histogram minima, and Segment Tree for repeated range queries where a one-pass stack is not enough.',
      ],
    },
  ],
};