// Deque: push and pop at both ends, often implemented by a circular buffer or
// block list so front and back operations stay O(1).

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'double-ended-queue-deque',
  title: 'Double-Ended Queue (Deque)',
  category: 'Data Structures',
  summary: 'A deque supports push and pop at both front and back, making it the primitive behind monotonic queues, work stealing, and sliding windows.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['two-ended operations', 'sliding window case study'], defaultValue: 'two-ended operations' },
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

function dequeGraph(title, slots, notes = {}) {
  const nodes = slots.map((slot, index) => ({
    id: `s${index}`,
    label: slot ?? '_',
    x: 1.1 + index * 1.45,
    y: 3.8,
    note: notes[`s${index}`] ?? '',
  }));
  return graphState({
    nodes: [
      ...nodes,
      { id: 'front', label: 'front', x: notes.frontX ?? 1.1, y: 1.4, note: notes.front ?? 'read/pop' },
      { id: 'back', label: 'back', x: notes.backX ?? 6.9, y: 6.2, note: notes.back ?? 'push/read' },
      { id: 'cap', label: 'cap', x: 9.2, y: 3.8, note: notes.cap ?? String(slots.length) },
    ],
    edges: [
      { id: 'e-front-s', from: 'front', to: notes.frontSlot ?? 's0', weight: 'front' },
      { id: 'e-back-s', from: 'back', to: notes.backSlot ?? 's4', weight: 'back' },
      { id: 'e-cap-s', from: 'cap', to: notes.backSlot ?? 's4', weight: 'wrap' },
    ],
  }, { title });
}

function* twoEndedOperations() {
  yield {
    state: dequeGraph('A deque exposes both ends of the sequence', ['A', 'B', 'C', '_', '_', '_'], {
      s0: 'first',
      s2: 'last',
      frontSlot: 's0',
      backSlot: 's2',
      frontX: 1.1,
      backX: 4.0,
      cap: 'ring slots',
    }),
    highlight: { active: ['front', 'back', 's0', 's2'], compare: ['cap'] },
    explanation: 'A double-ended queue supports insertion and removal at both ends. It keeps queue order, but unlike a plain FIFO queue it lets algorithms treat the back as a stack-like editing point.',
    invariant: 'pushFront, popFront, pushBack, and popBack should be O(1) amortized.',
  };

  yield {
    state: dequeGraph('pushBack appends after the current back', ['A', 'B', 'C', 'D', '_', '_'], {
      s0: 'first',
      s3: 'new last',
      frontSlot: 's0',
      backSlot: 's3',
      frontX: 1.1,
      backX: 5.45,
      cap: 'ring slots',
    }),
    highlight: { active: ['back', 's3', 'e-back-s'], found: ['s0', 's1', 's2'] },
    explanation: 'pushBack writes into the free slot after the old last element and moves the back pointer. This is the familiar queue enqueue direction.',
  };

  yield {
    state: dequeGraph('pushFront prepends before the current front', ['A', 'B', 'C', 'D', '_', 'Z'], {
      s5: 'new first',
      s3: 'last',
      frontSlot: 's5',
      backSlot: 's3',
      frontX: 8.35,
      backX: 5.45,
      cap: 'wrap',
    }),
    highlight: { active: ['front', 's5', 'e-front-s', 'cap'], compare: ['s0'] },
    explanation: 'In a circular-buffer implementation, pushing at the front can wrap to the physical end of the array. Logical order is Z, A, B, C, D even though the storage wraps.',
  };

  yield {
    state: dequeGraph('popFront and popBack remove from opposite ends', ['_', 'B', 'C', '_', '_', 'Z'], {
      s5: 'first',
      s2: 'last',
      frontSlot: 's5',
      backSlot: 's2',
      frontX: 8.35,
      backX: 4.0,
      cap: 'holes ok',
    }),
    highlight: { active: ['front', 'back', 's5', 's2'], removed: ['s0', 's3'] },
    explanation: 'Removing from either side only advances one pointer and optionally clears a slot. The implementation does not shift the middle elements.',
  };
}

function* slidingWindowCaseStudy() {
  yield {
    state: labelMatrix(
      'Sliding-window maximum uses a deque of candidates',
      [
        { id: 'step1', label: 'read 8' },
        { id: 'step2', label: 'read 3' },
        { id: 'step3', label: 'read 9' },
        { id: 'step4', label: 'slide' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'deque', label: 'deque' },
        { id: 'max', label: 'max' },
      ],
      [
        ['push back', '[8]', '8'],
        ['keep smaller behind', '[8,3]', '8'],
        ['pop smaller back, push 9', '[9]', '9'],
        ['drop expired front', '[9,...]', '9'],
      ],
    ),
    highlight: { active: ['step3:operation', 'step3:deque'], found: ['step3:max', 'step4:max'] },
    explanation: 'Monotonic Queue is built from deque operations. New values enter at the back, dominated candidates are popped from the back, and expired indices leave from the front.',
  };

  yield {
    state: dequeGraph('The front is the answer; the back is the editing surface', ['9', '7', '4', '_', '_', '_'], {
      s0: 'max',
      s2: 'weakest',
      frontSlot: 's0',
      backSlot: 's2',
      frontX: 1.1,
      backX: 4.0,
      cap: 'window',
    }),
    highlight: { active: ['front', 's0'], compare: ['back', 's2'] },
    explanation: 'The front holds the current best candidate. The back is where new arrivals remove weaker candidates before joining. That is why both ends matter.',
  };

  yield {
    state: labelMatrix(
      'Implementation choices',
      [
        { id: 'ring', label: 'ring buffer' },
        { id: 'blocks', label: 'block deque' },
        { id: 'list', label: 'linked list' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['cache friendly', 'resize/wrap logic'],
        ['grows both ways', 'more pointers'],
        ['simple splicing', 'poor locality'],
      ],
    ),
    highlight: { active: ['ring:strength', 'blocks:strength'], compare: ['list:cost'] },
    explanation: 'A deque is an interface, not one storage layout. Circular buffers are common for bounded queues; block deques avoid moving everything when growth happens at both ends.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'two-ended operations') yield* twoEndedOperations();
  else if (view === 'sliding window case study') yield* slidingWindowCaseStudy();
  else throw new InputError('Pick a deque view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A deque exists for ordered work where both ends matter. A normal queue is excellent when new work always enters at the back and old work always leaves from the front. A stack is excellent when the newest item is always next. Some algorithms need both abilities in the same structure.',
        'Sliding-window maximum is the clean example. Old values expire from the front as the window moves. New values arrive at the back. Weak candidates also get removed from the back before they ever reach the front. A queue cannot edit the back. A stack cannot expire the front. A deque gives the algorithm the exact two-ended contract it needs.',
        'The interface is small: pushFront, pushBack, popFront, popBack, peekFront, and peekBack. The implementation is where the lesson lives. A good deque changes an end pointer and one adjacent slot. It does not shift the middle of the sequence.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is an array where the first logical item lives at index 0. Push at the back with push. Pop at the back with pop. That part is cheap.',
        'The wall is the front. In JavaScript arrays, unshift and shift may move every remaining element because the array is trying to keep logical index 0 at physical index 0. One front operation can become O(n), and a workload with many front operations can quietly turn into quadratic element movement.',
        'The deeper wall is conceptual. The logical front of a sequence does not have to be physical slot 0. If you force those two ideas to be the same, you pay with unnecessary movement.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to separate logical order from physical layout. Store front and back as moving positions over a ring buffer, block map, or linked chunks. The first logical element is wherever the front pointer says it is.',
        'The invariant is simple: the live sequence is found by walking from front for count elements. pushFront writes just before front. pushBack writes just after back. popFront and popBack remove from those same ends. The middle elements do not move.',
        'That invariant is what makes the structure useful. The algorithm using the deque can reason in logical order, while the implementation keeps physical edits local.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the two-ended view, watch the front and back markers instead of the physical array positions. When pushFront wraps to the physical end of the array, the logical order is still correct because the front marker moved. The storage looks split, but the sequence is continuous in deque logic.',
        'In the sliding-window view, the front has a different role from the back. The front holds the current answer, usually the maximum or minimum candidate. The back is the editing surface where new arrivals remove weaker candidates before joining. That asymmetry is why the structure is more than "a queue with extra methods."',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A bounded deque is often a circular buffer with front, back, count, and capacity. Moving either end is arithmetic modulo capacity. If front is 0 and you push at the front, front can become capacity - 1. The logical sequence wraps around the physical array.',
        'A growing deque has several choices. It can resize the circular array and copy live elements into a larger one. It can use a block map, where the deque is a sequence of fixed-size chunks. It can link nodes or chunks. Each choice trades cache locality, resize cost, pointer overhead, and implementation complexity.',
        'The animation shows both the simple operation contract and the algorithmic case study. pushBack behaves like enqueue. pushFront behaves like prepending without shifting. popFront and popBack only advance an end. In the sliding-window case, the deque stores candidates, not just values. Expired indices leave from the front. Dominated candidates leave from the back.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The data-structure proof is an invariant proof. Before each operation, the live elements appear in logical order from front for count steps. pushFront writes a new item at the position immediately before the old front, so the new item becomes first and the old order follows it. pushBack writes immediately after the old back, so the old order remains and the new item becomes last.',
        'The two pop operations are the reverse. popFront removes the first logical item and advances front. popBack removes the last logical item and retreats back. No operation needs to preserve physical slot 0 as the front, so no operation shifts the middle.',
        'The monotonic-queue proof uses a second invariant. For a sliding-window maximum, store candidates in decreasing value order. If a new value is larger than the back candidate, the back candidate can never become the maximum while the new value remains in the window: it is older and smaller. Popping it from the back is safe. The front is then always the best live candidate.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'pushFront, pushBack, popFront, and popBack are O(1) amortized in a well-designed deque. A resize can cost O(n), but if capacity grows geometrically, those copies are rare enough that the average end operation stays constant time.',
        'Space is O(n) plus unused capacity or block overhead. Circular arrays are cache-friendly and compact, but they need wrap and resize logic. Linked chunks grow flexibly at both ends, but they add pointer chasing and poorer locality. A plain linked list gives easy end operations only if it stores both ends and the links needed for removal.',
        'Random access depends on the implementation. A ring buffer can compute a physical slot for index k, but a linked-chunk deque may need extra arithmetic or pointer traversal. Do not assume a deque is an array replacement. It is an end-operation structure first.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Deque wins when both ends are active. Monotonic Queue uses the front as the answer and the back as the place to delete dominated candidates. Sliding-window algorithms use the front for expiry and the back for arrivals. Undo buffers and browser histories often need near-end edits without shifting an entire list.',
        'Work-stealing schedulers use a stricter version of the idea. A worker usually pushes and pops its own tasks at one end, which keeps its hot work local. Other workers steal older tasks from the opposite end when they run out. The two-ended contract reduces contention because owner and thieves usually touch different ends.',
        'Deque also shows up in graph algorithms. 0-1 BFS uses a deque instead of a priority queue when edge weights are only 0 or 1. A zero-cost edge pushes to the front. A one-cost edge pushes to the back. The deque preserves the same distance ordering a heavier priority queue would provide for that special case.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A deque is not automatically thread-safe. Work-stealing deques rely on a narrow contract: usually one owning worker mutates one end, while other workers steal from the other end with carefully designed atomic operations. A general concurrent deque is much harder.',
        'A deque is also the wrong tool when sorted lookup, key lookup, or random indexed access is the main operation. Use Binary Heap for priority order, Hash Table for exact-key lookup, and arrays or vectors when indexed access dominates.',
        'The common implementation bug is an off-by-one in the empty/full state. In a ring buffer, front equal to back can mean empty or full unless the implementation stores count or reserves one slot. Resize code is another risk: copying wrapped elements in the wrong order breaks the logical sequence even though every value is still present.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Suppose the stream is [8, 3, 9, 7, 4] and the window size is 3. Read 8: the deque is [8], so the maximum is 8. Read 3: 3 is smaller, so it sits behind 8. The maximum is still the front, 8. Read 9: 9 is larger than 3 and 8, so both are removed from the back before 9 enters. The old candidates are dominated because they are older and smaller. The deque becomes [9].',
        'When the window slides, expired indices leave from the front. New values enter at the back after removing anything they dominate. Each value is pushed once and popped at most once, so the whole sliding-window maximum algorithm is O(n), not O(n log n) and not O(nk). The deque is the reason the proof is that clean.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Queue and Stack first so the two access rules are clear. Then study Ring Buffer for the physical layout, Monotonic Queue for the sliding-window maximum proof, and 0-1 BFS for the graph-algorithm version. Work-Stealing Deque Scheduler shows how the same interface becomes a concurrency primitive. For implementation references, compare Java ArrayDeque at https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html and CPython collections.deque at https://docs.python.org/3/library/collections.html#collections.deque.',
      ],
    },
  ],
};
