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
        "Read the animation as the execution trace for Monotonic Queue. A deque that keeps candidates in decreasing order so every sliding-window maximum is O(1) after amortized O(1) updates..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/monotonic-queue.gif', alt: 'Animated walkthrough of the monotonic queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram with input and output ends', caption: 'The queue baseline explains the time boundary: items arrive in order, and the window advances in the same direction. Source: Wikimedia Commons, Everaldo Coelho and YellowIcon, LGPL.'},
        'A monotonic queue exists for questions where the best value must be maintained while a window moves forward. The standard example is the sliding-window maximum: given a stream of numbers and a window size k, report the maximum after every step. The same shape appears in monitoring, rate limiting, image processing, and dynamic programming. The data arrives in order, old values expire, and the answer is always the best live candidate.',
        'The important word is live. A value may be large, but once its index falls outside the window it can no longer answer the query. Another value may still be inside the window, but if a newer and larger value has arrived, the older smaller value can never be the maximum again. A monotonic queue stores only the values that are both live enough and competitive enough to matter.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct solution keeps the last k items and scans all of them whenever the window moves. For the array [1, 3, 2, 5, 4, 8, 7] with k = 3, it scans [1, 3, 2] to get 3, then [3, 2, 5] to get 5, then [2, 5, 4] to get 5, and so on. This is easy to write and easy to trust.',
        'The wall is repeated work. Adjacent windows overlap almost completely, but the naive algorithm throws away the previous comparisons and starts again. Its cost is O(k) per window and O(nk) over n items. That may be acceptable when k is tiny. It becomes wasteful when a service computes many rolling metrics, when k is large, or when the stream is long.',
      ],
    },
    {
      heading: 'Why a heap is not the final answer',
      paragraphs: [
        'A binary heap can do better than rescanning. Insert each value, lazily discard expired indexes, and read the maximum at the heap root. That gives O(n log k) behavior and works well for many priority problems. It is also more general than this problem needs. The heap does not naturally delete every dominated candidate, so it may keep values that are provably unable to win.',
        'The monotonic queue is sharper because it uses the fact that windows move only forward. If a newer value is greater than an older value, the older one is dominated. Any future window containing the older value also contains the newer value until the older one expires first. The older value is not just currently worse; it is permanently unable to become the maximum.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The structure is a deque of pairs: value and index. For a sliding maximum, values in the deque are kept in decreasing order from front to back. The front is the largest live candidate. The back contains smaller candidates that may matter later after the larger values in front expire.',
        'On each new item, the queue performs two kinds of cleanup. It removes expired indexes from the front because those values are no longer in the window. It removes dominated values from the back because the new value is larger and will expire later. Then it appends the new value. After that, the answer is simply the value at the front.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Take [1, 3, 2, 5, 4, 8, 7] with k = 3. Start with 1@0. When 3@1 arrives, 1@0 is removed from the back because 3 is newer and larger. The queue becomes [3@1]. When 2@2 arrives, it is smaller than 3, so it is appended: [3@1, 2@2]. The first full window has maximum 3.',
        'When 5@3 arrives, both 2@2 and 3@1 are removed from the back. They are still in or near the current window, but neither can beat 5 while 5 is present, and 5 will expire after them. The queue becomes [5@3]. The next windows report 5 until 8@5 arrives and clears 4@4 and 5@3 in the same way.',
        'For a sliding minimum, reverse the comparison. Keep values increasing from front to back, remove larger values from the back, and read the minimum at the front. The index logic is unchanged. Indexes are mandatory because expiration is about position or time, not about the numeric value itself.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two invariants. First, every value in the deque is a candidate for some current or future window; expired values have been removed. Second, values are monotone from front to back; for maximum, every value behind the front is less than or equal to the front. If both are true, the front is the maximum among live candidates.',
        'The back-pop rule preserves the invariants. Suppose a new value x arrives at index i, and the deque back has value y at older index j. If x is greater than y, then y cannot be the answer for any later window that includes both values. Since i is newer than j, y expires no later than x. Removing y cannot delete a future maximum.',
        'The front-pop rule handles the moving boundary. When the left edge of the window passes an index, that value must leave even if it is large. This is why implementations store indexes instead of values alone. Without indexes, duplicate values and expiration become ambiguous.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'One update may remove many items from the back, which can make the loop look expensive. The amortized argument is simple: every item is pushed exactly once. After it is pushed, it can be removed from the back at most once, or from the front at most once. It cannot return to the queue after removal.',
        'Across the entire input, there are n pushes and at most n pops. That makes the total work O(n), even though a single step can do several pops. The current maximum query is O(1) after cleanup because it reads the front. Space is O(k), and often smaller, because dominated values are not retained.',
      ],
    },
    {
      heading: 'Cost and behavior (2)',
      paragraphs: [
        'The main tradeoff is specialization. A monotonic queue is excellent for one-pass sliding max or min, but it is not a general range-query engine. If queries ask for arbitrary intervals, use a segment tree, sparse table, Fenwick tree variant, or another structure that matches the update pattern. The monotonic queue earns its speed by assuming the boundary moves forward.',
        'Tie handling is also a design choice. If equal values should keep the oldest representative, remove only strictly smaller values from the back. If equal values should keep the newest representative, remove smaller-or-equal values. Both choices can be correct. The important part is that the implementation and proof agree.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern appears in time-series alerting, rolling high-water marks, rate-limit dashboards, image dilation and erosion filters, streaming analytics, and several dynamic-programming optimizations. In each case the system asks for the best value over a recent horizon. The horizon moves forward, and most old candidates become dominated before they expire naturally.',
        'Dynamic programming is the less obvious use. Some recurrences ask for the best previous state inside a bounded distance. If the candidate expression can be ordered and the window moves forward, a monotonic queue can turn an O(nk) recurrence into O(n). The structure is not only a trick for LeetCode style windows; it is a reusable dominance filter.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the query is not monotone under dominance. Median, mode, sum, distinct count, and top several values need different structures. It also fails when old values can be edited after insertion, when queries jump backward, or when the window is not a single forward-moving interval.',
        'A common implementation failure is mixing value order with time order. The deque is monotone by value, but expiration is by index. Another failure is reading the front before removing expired items. That can return a maximum from the previous window, which is often hard to notice in tests unless the largest value sits exactly on the outgoing boundary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a metrics service that evaluates the highest CPU usage over the last 60 scrapes for every container. The naive version scans 60 samples per scrape per time series. That sounds small until there are hundreds of thousands of series and many rolling rules. A heap reduces the comparison cost but adds lazy deletion and still does not exploit full dominance.',
        'A monotonic queue per series stores CPU value and scrape index. On each scrape, the service first removes front entries older than 60 samples. Then it removes smaller values from the back until the queue is decreasing. Then it appends the new sample. The alert reads the front value and compares it to the threshold. The answer is exact, online, and linear in the number of received samples.',
        'This design also makes operational behavior predictable. Memory is bounded by the window size. Work over a long stream is linear. A sudden spike may clear many old candidates in one update, but that cost is paid only once because those candidates never return. That is the practical value of the amortized proof.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study queues and deques first, then the sliding-window pattern. After that, compare monotonic queues with binary heaps, segment trees, and sparse tables. The heap teaches lazy deletion and general priority queues. The segment tree teaches mutable range queries. The sparse table teaches static range maximum queries. The monotonic queue sits in the narrow but powerful case where a forward-moving window and a dominance rule make everything linear.',
        'Good practice problems include sliding-window maximum, shortest subarray variants that use a monotonic deque over prefix sums, and dynamic-programming problems where the transition asks for a max over a bounded recent range. In every case, ask the same question: when a new candidate arrives, which older candidates can never win again?',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Monotonic Queue moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

