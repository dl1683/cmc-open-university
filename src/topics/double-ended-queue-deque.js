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
      heading: 'How to read the animation',
      paragraphs: [
        'The two-ended view shows a circular buffer as a flat row of slots. Two pointers, front and back, mark which slots hold live data. Watch how push and pop operations move only these pointers -- the middle slots never shift. When pushFront decrements front past slot 0, it wraps to the physical end of the array; the logical sequence stays continuous.',
        'Active highlights mark the slot and pointer involved in the current operation. Found highlights mark slots whose contents are confirmed unchanged. Removed highlights mark slots freed by a pop. The cap node shows the buffer capacity and signals when wrapping occurs.',
        'In the sliding-window view, the deque stores candidate values. The front holds the current maximum; the back is the editing surface where new arrivals evict weaker candidates. Watch how the monotone invariant -- every value decreases from front to back -- is preserved after each insertion.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A stack gives O(1) push and pop at one end. A queue gives O(1) enqueue at the back and dequeue at the front. Some algorithms need O(1) insertion and removal at both ends of the same sequence.',
        'Sliding-window maximum is the clearest motivating case. New values arrive at the back. Expired values leave from the front as the window advances. Dominated candidates also get removed from the back -- a queue cannot do that, and a stack cannot expire the front. The algorithm needs a structure that treats both ends as first-class editing points.',
        'A deque (double-ended queue) provides exactly this contract: pushFront, pushBack, popFront, popBack, peekFront, and peekBack, all in O(1) amortized time.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a dynamic array. pushBack appends in O(1) amortized. popBack removes the last element in O(1). These are cheap because no other element moves.',
        'Front operations are the problem. pushFront must insert at index 0, which shifts every existing element one position right -- O(n) work. popFront removes index 0, shifting everything left -- also O(n). In JavaScript, Array.unshift and Array.shift have this cost.',
        'For a workload that mixes front and back operations, the array approach is O(n) per front operation. A sliding-window pass over n elements with a window of size k could perform up to n front removals, each costing O(k). The total work becomes O(nk) instead of O(n).',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the assumption that logical position 0 must live at physical index 0. That assumption forces every front operation to shift the entire contents of the array. With n elements, each shift costs O(n), and a workload of m front operations costs O(mn).',
        'The deeper issue is conceptual: the front of a logical sequence has no reason to be pinned to a physical memory address. Pinning it there buys nothing and costs a shift on every front edit.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate logical order from physical layout. Use a circular buffer: a fixed-size array with a head index and a tail index. The first logical element lives wherever head points, not necessarily at physical slot 0.',
        'pushFront decrements head modulo the capacity: head = (head - 1 + capacity) % capacity. pushBack increments tail: tail = (tail + 1) % capacity. Both operations write one slot and update one index. No elements shift.',
        'When the buffer fills, allocate a larger array and re-copy the live elements in logical order. If capacity grows geometrically (double each time), the amortized cost of resizing is O(1) per operation -- the same analysis as dynamic array push_back.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A circular buffer deque maintains four values: buf (the underlying array), head (index of the first logical element), tail (index one past the last logical element), and capacity (the array length). The number of live elements is (tail - head + capacity) % capacity.',
        'pushFront: decrement head modulo capacity, write the new value at buf[head]. pushBack: write the new value at buf[tail], increment tail modulo capacity. popFront: read buf[head], increment head. popBack: decrement tail, read buf[tail]. Each operation touches exactly one slot and one pointer.',
        'When the buffer is full (size equals capacity), allocate a new array of double the capacity. Copy elements starting from head, wrapping around the old array, into positions 0 through size-1 of the new array. Set head to 0 and tail to size. The logical order is preserved even though the physical layout changes completely.',
        'The alternative implementation is a doubly-linked list. Each node holds a value, a prev pointer, and a next pointer. pushFront and popFront operate on the head node; pushBack and popBack operate on the tail node. All four are O(1) with no resizing. The tradeoff: each node requires two extra pointers (16 bytes on 64-bit systems), and pointer chasing destroys cache locality. In practice, circular buffers dominate for general-purpose deques. Python collections.deque uses a hybrid: a doubly-linked list of fixed-size blocks, combining the cache friendliness of contiguous storage with flexible growth at both ends.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: the live elements are buf[head], buf[(head+1) % cap], ..., buf[(tail-1+cap) % cap], in that order. Every operation preserves this.',
        'pushFront places a new element at (head-1+cap) % cap and updates head. The old elements remain at their positions, and the new head is now the first in the logical walk. pushBack places a new element at tail and advances tail. The old elements are unchanged, and the new element is now last.',
        'popFront advances head, logically removing the first element without touching any other slot. popBack retreats tail, removing the last element. Neither operation moves the middle.',
        'Resize preserves the invariant by copying elements in logical order into a fresh array and resetting head to 0. The logical sequence is identical before and after; only the physical addresses change.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'pushFront, pushBack, popFront, and popBack are each O(1) amortized. Without a resize, each is O(1) worst-case: one modular arithmetic step, one array write or read, one pointer update. Resizing costs O(n) but happens only when the buffer doubles, so the amortized cost per operation is O(1) by the same geometric-series argument as dynamic arrays.',
        'Random access is O(1) in a circular buffer: element at logical index k lives at buf[(head + k) % capacity]. This is not true for linked-list or block-based implementations.',
        'Space is at most twice the number of live elements, since the buffer doubles when full and the load factor stays between 25% and 100%. A doubly-linked list uses exactly n nodes but each node carries two pointer fields, so the constant factor is higher.',
        'When n doubles, no operation changes its asymptotic cost. The dominant practical cost is the resize copy, which happens O(log n) times across n insertions. Between resizes, every operation is a single array access.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sliding window maximum and minimum: a monotonic deque maintains candidates in decreasing (or increasing) order. New values enter at the back after evicting dominated candidates. Expired indices leave from the front. The result is O(n) for the entire pass, versus O(n log k) with a heap.',
        '0-1 BFS: when edge weights are only 0 or 1, a deque replaces a priority queue. Zero-cost neighbors go to the front (same distance layer); unit-cost neighbors go to the back (next layer). The deque maintains distance ordering at O(V+E) total cost, compared to O((V+E) log V) for Dijkstra.',
        'Work-stealing schedulers (Chase-Lev deque): each worker thread pushes and pops tasks at one end of its own deque -- keeping hot work local with no contention. Idle workers steal from the opposite end of a busy worker\'s deque. The two-ended contract makes owner operations lock-free and theft operations low-contention.',
        'Undo/redo stacks: recent actions are pushed and popped at the back. When the history buffer is full, the oldest action is dropped from the front. A deque handles both ends without shifting.',
        'Palindrome checking: compare characters from the front and back simultaneously, popping both ends inward. A deque makes this O(n) with constant-factor simplicity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A deque does not support O(1) insertion or deletion in the middle. If you need to insert at arbitrary positions, use a linked list or a balanced tree.',
        'For single-ended workloads, a deque works but adds unnecessary conceptual weight. A stack (push/pop at one end) or a queue (enqueue at back, dequeue at front) communicates intent more clearly and may optimize better in specialized implementations.',
        'A deque is not inherently thread-safe. The Chase-Lev work-stealing deque achieves safe concurrent access through careful use of atomic operations and a restricted access pattern (one owner, multiple stealers). A general-purpose concurrent deque with arbitrary multi-producer multi-consumer access is substantially harder to implement correctly.',
        'The classic implementation bug is confusing empty and full states. In a circular buffer where head == tail, this could mean the buffer is empty or completely full. Solutions: store a separate count, or reserve one slot so the buffer is full when (tail + 1) % capacity == head. Getting this wrong causes silent data loss or phantom reads.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Circular buffer with capacity 4. Slots: [_, _, _, _]. head = 0, tail = 0, size = 0.',
        'push_back(1): write 1 at buf[0], tail becomes 1. Slots: [1, _, _, _]. head=0, tail=1, size=1.',
        'push_back(2): write 2 at buf[1], tail becomes 2. Slots: [1, 2, _, _]. head=0, tail=2, size=2.',
        'push_front(0): head becomes (0-1+4)%4 = 3, write 0 at buf[3]. Slots: [1, 2, _, 0]. head=3, tail=2, size=3. Logical order: 0, 1, 2 (starting at slot 3, wrapping to slots 0 and 1).',
        'push_back(3): write 3 at buf[2], tail becomes 3. Slots: [1, 2, 3, 0]. head=3, tail=3, size=4. Buffer is full. Logical order: 0, 1, 2, 3.',
        'pop_front(): read buf[3] = 0, head becomes 0. Slots: [1, 2, 3, _]. head=0, tail=3, size=3. Logical order: 1, 2, 3.',
        'push_front(5): head becomes (0-1+4)%4 = 3, write 5 at buf[3]. Slots: [1, 2, 3, 5]. head=3, tail=3, size=4. Buffer is full again. Logical order: 5, 1, 2, 3.',
        'At every step, the middle elements never moved. Only head and tail changed. The physical layout wraps, but walking from head for size steps always recovers the correct logical sequence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Vol. 1, Section 2.2.1 (1968): formalized the deque as an abstract data type, including input-restricted and output-restricted variants. Chase and Lev, "Dynamic Circular Work-Stealing Deque" (2005): the lock-free work-stealing deque used in modern task schedulers.',
        'Prerequisites: study Queue and Stack first so the single-ended access contracts are clear. Study Ring Buffer for the circular-array mechanics that underlie most deque implementations. Study Dynamic Array for the geometric-growth amortization argument.',
        'Extensions: Monotonic Queue applies a value-ordering invariant on top of a deque to solve sliding-window problems in O(n). 0-1 BFS uses a deque to achieve Dijkstra-equivalent shortest paths in O(V+E) when all edge weights are 0 or 1. Work-Stealing Deque Scheduler shows how the two-ended contract becomes a concurrency primitive.',
      ],
    },
  ],
};
