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
  const firstVal = 1;
  yield {
    state: qState([{ i: 0, v: firstVal }], 'Window starts at [1]'),
    highlight: { active: ['i0'] },
    explanation: `A monotonic queue stores candidates for the maximum, not every item. The first entry is ${firstVal}@0, and the front is always the best live candidate.`,
  };

  const newVal = 3;
  const oldVal = 1;
  yield {
    state: qState([{ i: 1, v: newVal }], 'Push 3: smaller tail values are removed'),
    highlight: { found: ['i1'] },
    explanation: `When ${newVal} arrives, the old ${oldVal} can never be a future maximum while ${newVal} is newer and larger. Pop dominated tail values, then push the new candidate.`,
    invariant: `If a newer value is greater (${newVal} > ${oldVal}), the older smaller value is permanently dominated.`,
  };

  const dominant = 5;
  const poppedCount = 2;
  yield {
    state: qState([{ i: 1, v: 3 }, { i: 2, v: 2 }, { i: 3, v: dominant }], 'Before cleaning, 5 dominates the tail'),
    highlight: { active: ['i3'], removed: ['i1', 'i2'] },
    explanation: `At value ${dominant}, both 3 and 2 are popped from the back (${poppedCount} removals). They are inside the current window, but they no longer matter for any future maximum that also contains ${dominant}.`,
  };

  const arr = [1, 3, 2, 5, 4, 8, 7];
  const k = 3;
  const windowCount = arr.length - k + 1;
  yield {
    state: labelMatrix(
      `Sliding window maximums for [${arr}], k=${k}`,
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
    explanation: `After the queue is maintained across ${windowCount} windows of size ${k}, each window maximum is the front value. Expired indices leave from the front; dominated values leave from the back.`,
  };
}

function* amortizedProof() {
  const operationRows = 4;
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
    explanation: `The queue can pop several items on one step, which looks scary. Amortization across ${operationRows - 1} operation types removes the fear: each element is pushed once and popped at most once.`,
    invariant: `No element can be popped twice — each of the ${operationRows - 1} removal paths fires at most once per element.`,
  };

  const incoming = 8;
  const clearedCount = 2;
  yield {
    state: qState([{ i: 3, v: 5 }, { i: 4, v: 4 }, { i: 5, v: incoming }], 'A big value pays for old candidates once'),
    highlight: { active: ['i5'], removed: ['i3', 'i4'] },
    explanation: `A large incoming value (${incoming}) can clear ${clearedCount} items from the back of the queue, but that cost is paid by elements that will never return. The next operations are cheaper because those dominated values are gone.`,
  };

  const toolCount = 4;
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
    explanation: `Among ${toolCount} alternatives, a heap can solve sliding maximum with lazy deletion, but the monotonic queue is sharper for fixed windows. Segment trees are more general; monotonic queues are specialized and linear.`,
  };

  const useCaseCount = 4;
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
    explanation: `Across ${useCaseCount} application areas, the deeper idea is dominance under a moving boundary. If an older candidate is worse than a newer one that expires later, it can be deleted forever.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        {type: 'callout', text: 'A monotonic queue is a moving dominance proof: expired candidates leave the front, and permanently dominated candidates leave the back.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Deque-01.svg/250px-Deque-01.svg.png', alt: 'Double-ended queue diagram with input and output at both ends', caption: 'A monotonic queue relies on deque access: expire old candidates from the front and remove dominated candidates from the back. Source: Wikimedia Commons, David Eppstein, public domain.'},
        'Read the queue as a list of candidates, not as the whole window. Active marks the new value or the boundary check, and found marks the maximum that is now guaranteed by the front of the deque.',
        'The safe inference rule is deletion by dominance. If a newer value is larger than an older value, the older value can never be a future maximum while both are alive, because the newer one is better and expires later.',
        {type: 'image', src: './assets/gifs/monotonic-queue.gif', alt: 'Animated walkthrough of the monotonic queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram with input and output ends', caption: 'The queue baseline explains the time boundary: items arrive in order, and the window advances in the same direction. Source: Wikimedia Commons, Everaldo Coelho and YellowIcon, LGPL.'},
        'A sliding-window maximum asks for the largest value among the last k items as the window moves forward. The stream may be CPU samples, prices, pixels, or dynamic-programming states.',
        'The hard part is that values expire by time or index, while the answer depends on value. A monotonic queue keeps both facts together by storing value-index pairs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach keeps the last k values and scans them after every step. For k = 3 and values [1, 3, 2, 5], it scans [1, 3, 2] to report 3, then [3, 2, 5] to report 5.',
        'This is simple and exact. It is also O(k) work per output, even though adjacent windows share almost all their values.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated comparison. If n = 1,000,000 and k = 1,000, rescanning costs about one billion value checks.',
        'A heap improves the maximum lookup but still carries stale or dominated entries until they reach the top. The moving-window structure contains a stronger fact: many older values are permanently unable to win.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For a maximum, keep a deque whose values decrease from front to back. The front is the largest live candidate, and the back holds smaller values that may matter after larger values expire.',
        'Each new value first removes expired indexes from the front, then removes smaller values from the back, then appends itself. The queue is monotone by value and valid by index.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Store pairs like 5@3, meaning value 5 at index 3. Before reading the answer for window ending at i, remove front pairs with index <= i - k because they are outside the window.',
        'Then compare the new value with the back. While the back value is smaller, pop it; the new value dominates it for every future window that contains both. After insertion, the front value is the answer.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from two invariants. First, every deque entry is live for the current or a future window. Second, values decrease from front to back, so no value behind the front can exceed it.',
        'The back-pop rule is safe because of time order. A newer larger value expires after the older smaller value, so there is no future window where the older value is present and the newer larger value is absent before the older one expires.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Each item is pushed once and popped at most once. A single update may pop several values, but over the whole stream there are at most n pushes and n pops, so total time is O(n).',
        'Space is O(k) because no live window can contribute more than k indexes. When k doubles, memory can double, but total work over n items stays linear instead of becoming O(nk).',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Monotonic queues fit rolling high-water marks, alerting windows, image dilation filters, and streaming analytics. The common access pattern is a forward-moving window with a max or min query at every step.',
        'They also optimize dynamic programming recurrences that need the best previous state inside a bounded distance. If the candidate expression can be ordered and the boundary moves forward, the queue turns an O(nk) recurrence into O(n).',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails for statistics that cannot delete dominated values, such as median, sum, mode, or distinct count. Those need different state because a value that is not maximum may still affect the answer.',
        'It also fails when queries jump backward, old values are edited, or windows are arbitrary intervals. The proof depends on one-direction time and a dominance relation that never becomes false later.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use values [1, 3, 2, 5, 4] with k = 3. Insert 1@0, then 3@1 pops 1@0 because 3 is newer and larger, then 2@2 appends behind 3, so the first answer is 3.',
        'At index 3, value 5 arrives and pops 2@2 and 3@1, leaving 5@3 as the only candidate and answer. At index 4, value 4 appends behind 5, and the answer remains 5. No removed value can later beat the value that removed it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study deque operations, amortized analysis, and the sliding-window maximum problem. Then compare this structure with binary heaps, sparse tables, and segment trees to see how query order changes the right tool.',
        'Next study Monotonic Stack for nearest-boundary problems, Sliding Window for two-pointer movement, and Segment Tree for arbitrary range queries that do not arrive in forward order.',
      ],
    },
  ],
};