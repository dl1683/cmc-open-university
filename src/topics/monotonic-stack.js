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
    explanation: 'For next greater element, keep a decreasing stack of unresolved indexes. A larger incoming value is the first greater value for every smaller entry it pops.',
    invariant: 'The unresolved stack is monotone decreasing by value from bottom to top.',
  };

  yield {
    state: stackGraph('Current value resolves a run of smaller stack entries'),
    highlight: { active: ['cur', 'top', 'pop', 'answer', 'e-cur-top', 'e-top-pop', 'e-pop-answer'], compare: ['older'] },
    explanation: 'The current value is new information from the right. If it beats the stack top, that top has found the nearest greater value to its right and can leave forever.',
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
    explanation: 'The same template solves many nearest-neighbor problems. The choices are scan direction, comparison operator, duplicate handling, and whether answers are written when popping or before pushing.',
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
    explanation: 'Largest rectangle in a histogram uses an increasing stack. A shorter bar proves taller bars on the stack cannot extend farther right, so their maximal rectangles can be scored now.',
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
    explanation: 'The complete pattern is one-pass boundary discovery: keep only candidates that have not yet met the first value capable of resolving them.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Monotonic stacks exist for nearest-boundary questions: next greater value, next smaller value, stock span, daily temperatures, and histogram rectangles. The naive solution compares each item with many neighbors until it finds the first value that defeats it.',
        'That nested scan can become O(n^2). A monotonic stack keeps only unresolved candidates while scanning once. It is just Stack plus an ordering invariant, but that invariant deletes candidates that can no longer matter.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach for next greater element is to start at each index and scan right until a larger value appears. That is easy to understand, but an increasing array makes each item scan many positions. The same waste appears in histogram area if every bar expands left and right one step at a time.',
        'The wall is repeated boundary discovery. Many elements are waiting for the same future value to resolve them. A monotonic stack lets that future value resolve a whole run of waiting candidates at once.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to keep only candidates that have not yet found the first value capable of resolving them. For next greater element, the stack is decreasing. If a larger value arrives, smaller stack entries are resolved immediately because this is the first larger value to their right.',
        'For histogram area, the stack is increasing. A shorter incoming bar becomes the first right boundary for taller bars on the stack. After popping, the new stack top gives the previous smaller boundary on the left.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect the stack as a list of unresolved candidates, not as a sorted copy of the input. Every value on the stack is waiting for the first future value that can resolve its boundary question. Popping means the current value has proved something final about that candidate.',
        'The useful question at every step is: which candidates can never matter again? If the current value dominates the stack top under the problem comparison, the top is resolved and removed. If it does not dominate, the current value becomes a new unresolved candidate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For next greater element, scan left to right and keep a decreasing stack of indexes. Compare the current value with the stack top. While the current value is larger, pop the top and record the current value as its next greater neighbor. When order is restored, push the current index as unresolved.',
        'For largest rectangle in a histogram, keep an increasing stack of bar indexes. When a shorter bar arrives, pop taller bars and compute their rectangle area. The current index is the right boundary. The new stack top after popping is the previous smaller boundary, so width is currentIndex - previousSmallerIndex - 1.',
        'A sentinel value often appears at the end. For next greater, a final pass may mark unresolved entries as none. For histograms, a final height 0 flushes every remaining bar so all candidate rectangles are scored.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the monotonic invariant. In next greater element, the stack is decreasing from bottom to top. If current is greater than the top, every value between the popped index and current has already failed to be greater; otherwise the popped index would have been resolved earlier. So current is the nearest greater value.',
        'In histogram area, a bar stays on the increasing stack until the first shorter bar on the right appears. The previous smaller bar is below it on the stack. Those two smaller bars define the widest rectangle where the popped height is the limiting height, so scoring it at pop time is safe.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Every index is pushed once and popped at most once, so the total work is O(n) even though one iteration can pop many items. Space is O(n) in the worst case when many entries remain unresolved. This is amortized analysis in its cleanest interview-problem form.',
        'The tradeoff is specialization. A monotonic stack is excellent for one-pass nearest-boundary discovery, but it is not a general range-query structure. If the data changes or queries arrive out of order, Segment Tree, Fenwick Tree, Sparse Table, or Binary Heap may fit better.',
        'The main implementation traps are off-by-one boundaries, choosing strict versus non-strict comparisons for duplicates, and forgetting a sentinel value when a final flush is needed.',
        'Duplicate handling is not cosmetic. For example, using greater-than versus greater-than-or-equal decides whether equal bars merge into one wider rectangle or whether the earlier equal bar is resolved first. The comparison must match the exact boundary definition.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Monotonic stacks solve next greater element, next smaller element, stock span, daily temperatures, rainwater boundaries, histogram rectangles, visibility counts, and many span-compaction problems in compilers or layout engines.',
        'They win when each item needs the first later or earlier item that crosses one comparison boundary. The access pattern is a single scan plus a stack of unresolved candidates. That is why the pattern appears in coding interviews, parsers, layout engines, chart analysis, and span compaction.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The stack is not sorting the input. It is preserving only unresolved candidates in an order that makes future resolution cheap. If the question requires arbitrary range updates, repeated online queries, or a rolling fixed-size window, a Segment Tree, Fenwick Tree, Sparse Table, or Monotonic Queue may be a better fit.',
        'It also fails when the comparison does not create a one-direction boundary. If a candidate can become useful again after being dominated, popping it would lose information. The delete-forever rule is valid only when the dominance argument is valid.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Largest rectangle in a histogram is the complete case. The naive approach chooses each bar and expands left and right until a shorter bar stops it. That can take O(n^2) across all bars. The monotonic stack computes the same boundaries in one scan.',
        'Keep bar indexes in increasing height order. When a shorter bar arrives, pop taller bars. For each popped bar, the shorter current bar is the right boundary and the new stack top is the previous smaller left boundary. The area is height times width. A final sentinel height 0 flushes bars that never found a shorter right boundary.',
      ],
    },
    {
      heading: 'Worked example: daily temperatures',
      paragraphs: [
        'Daily temperatures is the gentlest way to see the pattern. The question is: for each day, how many days until a warmer temperature? Keep a decreasing stack of day indexes. When today is warmer than the day on top of the stack, today is the first warmer day for that unresolved index, so pop it and record the distance.',
        'The delete-forever argument is the lesson. If day 7 resolves day 3, no day between 4 and 6 was warm enough, or day 3 would already have been popped. Day 7 is therefore not merely a warmer day; it is the nearest warmer day. That is why the stack gives exact boundaries without scanning from every index.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Choose whether the stack stores indexes or values. Indexes are usually better because they preserve distance and allow duplicate values. Decide whether equal values should pop or remain, and write that comparison into the problem statement before coding.',
        'Add a sentinel when the algorithm needs to flush unresolved candidates. For histograms the sentinel height 0 is a common way to force all remaining bars to compute their areas. Without that final flush, the right boundary for trailing bars never arrives.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'A monotonic stack is a proof device. The invariant says which unresolved candidates are still possible. The pop operation says the first valid boundary has arrived. The amortized O(n) cost follows because each candidate can enter and leave the unresolved set only once.',
        'For teaching, emphasize the delete-forever argument before code templates. Students often memorize while-pop-push without knowing why information is not lost. The method is safe only when a popped candidate has been permanently resolved or permanently dominated for the question being asked.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study references: monotonic-stack pattern overview at https://www.hellointerview.com/learn/code/stack/monotonic-stack and CP-style nearest-boundary templates at https://leetcode.com/discuss/post/2347639/a-comprehensive-guide-and-template-for-m-irii/. Study Stack first, then Monotonic Queue for rolling windows, Sliding Window for moving boundaries, Cartesian Tree for the tree view of histogram minima, and Segment Tree for repeated range queries.',
      ],
    },
  ],
};
