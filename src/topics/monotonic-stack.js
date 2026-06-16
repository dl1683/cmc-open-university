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
  yield {
    state: labelMatrix(
      'Array [2, 1, 5, 3, 4]',
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
    explanation: 'For next greater element, keep a decreasing stack of unresolved indexes. When a larger value arrives, it is the first greater value for every smaller entry popped before it.',
    invariant: 'The unresolved stack is monotone decreasing by value from bottom to top.',
  };

  yield {
    state: stackGraph('Current value resolves a run of smaller stack entries'),
    highlight: { active: ['cur', 'top', 'pop', 'answer', 'e-cur-top', 'e-top-pop', 'e-pop-answer'], compare: ['older'] },
    explanation: 'The current value is new information from the right. If it is greater than the stack top, the top has finally found its nearest greater neighbor and can leave forever.',
  };

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
    explanation: 'The while loop can pop many items at one position, but each item is popped only once. That is the same amortized shape as Monotonic Queue and Stack-backed parsing.',
  };

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
    explanation: 'The same template solves many nearest-neighbor problems. The only choices are scan direction, comparison operator, and whether answers are written when popping or before pushing.',
  };
}

function* histogramArea() {
  yield {
    state: labelMatrix(
      'Histogram [2, 1, 5, 6, 2, 3]',
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
    explanation: 'Largest rectangle in a histogram uses an increasing stack. A shorter bar proves that taller bars on the stack cannot extend any farther right, so their maximal rectangle is known.',
  };

  yield {
    state: stackGraph('A shorter bar closes rectangles for taller bars'),
    highlight: { active: ['cur', 'top', 'pop', 'answer', 'e-top-pop'], found: ['older'], compare: ['push'] },
    explanation: 'When height 2 arrives after 5 and 6, it becomes the right boundary for both taller bars. The new stack top after popping gives the left boundary.',
    invariant: 'The stack is increasing by height; indexes between stack entries have already been resolved.',
  };

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
    explanation: 'The width is currentIndex - previousSmallerIndex - 1. A sentinel height 0 at the end flushes all remaining bars so every candidate rectangle is scored.',
  };

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
    explanation: 'The complete pattern is one-pass boundary discovery: keep only candidates that have not yet found the first value capable of resolving them.',
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
      heading: 'What it is',
      paragraphs: [
        'A monotonic stack is a stack kept in increasing or decreasing order as an array is scanned. It stores unresolved candidates: indexes whose nearest greater, nearest smaller, span boundary, or rectangle boundary has not yet been discovered.',
        'The structure is deceptively simple. It is just Stack plus an invariant. The invariant removes useless candidates, which is why problems that look like nested scanning often become O(n).',
        'The useful way to recognize the pattern is to ask whether each element needs the first later or earlier element that defeats it under one comparison. If yes, a monotonic stack can often preserve exactly the candidates that remain undefeated.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For next greater element, scan left to right and keep a decreasing stack. When the current value is larger than the top, pop the top and record the current value as its next greater neighbor. Repeat until order is restored, then push the current index.',
        'For largest rectangle in a histogram, keep an increasing stack of bar heights. When a shorter bar arrives, it closes rectangles for taller bars. The current index is the right boundary, and the new stack top after popping is the previous smaller boundary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Every index is pushed once and popped at most once, so the total work is O(n) even though one iteration can pop many items. This is amortized analysis in its cleanest interview-problem form.',
        'The main implementation traps are off-by-one boundaries, choosing strict versus non-strict comparisons for duplicates, and forgetting a sentinel value when a final flush is needed.',
        'Duplicate handling is not cosmetic. For example, using greater-than versus greater-than-or-equal decides whether equal bars merge into one wider rectangle or whether the earlier equal bar is resolved first. The comparison must match the exact boundary definition.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Monotonic stacks solve next greater element, next smaller element, stock span, daily temperatures, rainwater boundaries, histogram rectangles, visibility counts, and many span-compaction problems in compilers or layout engines.',
        'A complete case study is a metrics dashboard that needs the longest sustained period before a higher latency spike. A monotonic stack can compute the nearest higher value on each side of every point, turning a naive window scan into a single pass.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The stack is not sorting the input. It is preserving only unresolved candidates in an order that makes future resolution cheap. If the question requires arbitrary range updates or repeated online queries, a Segment Tree, Fenwick Tree, or Monotonic Queue may be a better fit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study references: monotonic-stack pattern overview at https://www.hellointerview.com/learn/code/stack/monotonic-stack and CP-style nearest-boundary templates at https://leetcode.com/discuss/post/2347639/a-comprehensive-guide-and-template-for-m-irii/. Study Stack, Monotonic Queue, Sliding Window, Cartesian Tree, and Segment Tree next.',
      ],
    },
  ],
};
