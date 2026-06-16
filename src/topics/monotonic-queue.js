// Monotonic queue: keep only candidates that can still become the window max.

import { sequenceState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'monotonic-queue',
  title: 'Monotonic Queue',
  category: 'Data Structures',
  summary: 'A deque that keeps candidates in decreasing order so every sliding-window maximum is O(1) after amortized O(1) updates.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sliding maximum', 'amortized proof'], defaultValue: 'sliding maximum' },
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

function qState(items, title) {
  return sequenceState('queue', items.map(({ i, v }) => ({ id: `i${i}`, value: `${v}@${i}` })), { title });
}

function* slidingMaximum() {
  yield {
    state: qState([{ i: 0, v: 1 }], 'Window starts at [1]'),
    highlight: { active: ['i0'] },
    explanation: 'A monotonic queue stores candidates for the maximum, not every item. Each entry carries value and index. The queue is decreasing by value from front to back, so the front is always the current maximum.',
  };

  yield {
    state: qState([{ i: 1, v: 3 }], 'Push 3: smaller tail values are removed'),
    highlight: { found: ['i1'] },
    explanation: 'When 3 arrives, the old 1 can never be a future maximum while 3 is newer and larger. Pop dominated tail values, then push 3. This is the key rule.',
    invariant: 'If a newer value is greater, the older smaller value is permanently dominated.',
  };

  yield {
    state: qState([{ i: 1, v: 3 }, { i: 2, v: 2 }, { i: 3, v: 5 }], 'Before cleaning, 5 dominates the tail'),
    highlight: { active: ['i3'], removed: ['i1', 'i2'] },
    explanation: 'At value 5, both 3 and 2 are popped from the back. They are inside the current window, but they no longer matter for any future maximum that also contains 5.',
  };

  yield {
    state: labelMatrix(
      'Sliding window maximums for [1, 3, 2, 5, 4, 8, 7], k=3',
      [
        { id: 'w0', label: '[1,3,2]' },
        { id: 'w1', label: '[3,2,5]' },
        { id: 'w2', label: '[2,5,4]' },
        { id: 'w3', label: '[5,4,8]' },
        { id: 'w4', label: '[4,8,7]' },
      ],
      [
        { id: 'front', label: 'queue front' },
        { id: 'max', label: 'maximum' },
      ],
      [
        ['3@1', '3'],
        ['5@3', '5'],
        ['5@3', '5'],
        ['8@5', '8'],
        ['8@5', '8'],
      ],
    ),
    highlight: { found: ['w0:max', 'w1:max', 'w2:max', 'w3:max', 'w4:max'] },
    explanation: 'After the queue is maintained, each window maximum is just the front value. Expired indices leave from the front; dominated values leave from the back.',
  };
}

function* amortizedProof() {
  yield {
    state: labelMatrix(
      'Every element has only two possible removals',
      [
        { id: 'push', label: 'push once' },
        { id: 'tail', label: 'pop from back' },
        { id: 'front', label: 'pop from front' },
        { id: 'total', label: 'total work' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'bound', label: 'bound' },
      ],
      [
        ['on arrival', 'n pushes'],
        ['dominated by newer larger value', 'at most n'],
        ['index expires from window', 'at most n'],
        ['all operations', 'O(n)'],
      ],
    ),
    highlight: { found: ['push:bound', 'tail:bound', 'front:bound', 'total:bound'] },
    explanation: 'The queue can pop several items on one step, which looks scary. Amortization removes the fear: each element is pushed once and popped at most once.',
    invariant: 'No element can be popped twice.',
  };

  yield {
    state: qState([{ i: 3, v: 5 }, { i: 4, v: 4 }, { i: 5, v: 8 }], 'A big value pays for old candidates once'),
    highlight: { active: ['i5'], removed: ['i3', 'i4'] },
    explanation: 'A large incoming value can clear the back of the queue, but that cost is paid by elements that will never return. The next operations are cheaper because those dominated values are gone.',
  };

  yield {
    state: labelMatrix(
      'Monotonic queue versus nearby tools',
      [
        { id: 'heap', label: 'binary heap' },
        { id: 'deque', label: 'monotonic queue' },
        { id: 'scan', label: 'rescan each window' },
        { id: 'segment', label: 'segment tree' },
      ],
      [
        { id: 'time', label: 'time' },
        { id: 'fit', label: 'best fit' },
      ],
      [
        ['O(n log k)', 'dynamic priorities'],
        ['O(n)', 'fixed-size sliding max/min'],
        ['O(nk)', 'tiny inputs only'],
        ['O(n log n)', 'arbitrary range queries'],
      ],
    ),
    highlight: { active: ['deque:time', 'deque:fit'], compare: ['heap:time', 'segment:fit'] },
    explanation: 'A heap can solve sliding maximum with lazy deletion, but the monotonic queue is sharper for fixed windows. Segment trees are more general; monotonic queues are specialized and linear.',
  };

  yield {
    state: labelMatrix(
      'Where the pattern appears',
      [
        { id: 'max', label: 'sliding max/min' },
        { id: 'dp', label: 'DP optimization' },
        { id: 'rate', label: 'rolling limits' },
        { id: 'signals', label: 'time-series alarms' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'why', label: 'why queue works' },
      ],
      [
        ['best value in window', 'front is best'],
        ['max over recent states', 'dominated states vanish'],
        ['peak over last N requests', 'expire by index'],
        ['rolling high watermark', 'linear streaming update'],
      ],
    ),
    highlight: { found: ['max:why', 'dp:why', 'signals:why'] },
    explanation: 'The deeper idea is dominance under a moving boundary. If an older candidate is worse than a newer one, it can be deleted forever.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sliding maximum') yield* slidingMaximum();
  else if (view === 'amortized proof') yield* amortizedProof();
  else throw new InputError('Pick a monotonic-queue view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A monotonic queue is a deque maintained in sorted order, usually decreasing for sliding maximum or increasing for sliding minimum. It stores only candidates that can still become the answer. The front is the best candidate for the current window.',
        'This is the data-structure refinement of Sliding Window. A plain window tracks membership. A monotonic queue tracks membership plus dominance, deleting values that cannot win any future window.',
        'The structure is easiest to understand as a dominance certificate. If value 8 arrives after value 5, the older 5 is useless for every future window that contains both of them, because 8 is larger and expires later. That single observation is what turns repeated window rescans into a linear stream algorithm.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a new value arrives, remove smaller values from the back because the new value is newer and at least as good for every future window. Push the new value with its index. When the window moves, remove the front if its index expired. The maximum is then the front value.',
        'The amortized proof is the whole trick. One step can pop many values, but each value enters once and leaves once. Across n inputs, total pushes and pops are O(n), so every operation is amortized O(1).',
        'Tie handling is a design choice. If equal values should keep the oldest representative, pop only strictly smaller values. If equal values should keep the newest representative, pop smaller-or-equal values. Both variants are valid as long as expiration uses indices and the invariant is written down.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The structure uses O(k) space for window size k and O(n) total time for n inputs. It is less general than a Segment Tree or Binary Heap, but it is optimal for one-pass fixed-window maximums and minimums. Store indices, not only values, because expiration depends on position.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Monotonic queues appear in time-series alerts, rolling high-water marks, rate-limit dashboards, dynamic-programming optimizations, image filters, and streaming analytics. Any system asking for a max or min over a recent moving horizon should consider this before reaching for a heap.',
        'A concrete case study is a monitoring rule that asks for the highest CPU usage over the last 60 scrapes. Recomputing the maximum from all 60 points on every scrape wastes work. A monotonic queue keeps only the surviving candidates, so the alert can update online while preserving the exact answer.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The queue is monotonic by value, not by time. Time order is preserved by indices and expiration. Another trap is using it for arbitrary range queries; if windows are not moving one step at a time, a Segment Tree, Sparse Table, or heap may fit better.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Practical references: USACO Guide sliding window at https://usaco.guide/gold/sliding-window and the sliding-window maximum problem statement at https://leetcode.com/problems/sliding-window-maximum/. Study Queue, Sliding Window, Binary Heap, Segment Tree, and Sparse Table next.',
      ],
    },
  ],
};
