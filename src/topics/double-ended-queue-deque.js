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
  const initSlots = ['A', 'B', 'C', '_', '_', '_'];
  const initSize = initSlots.filter(s => s !== '_').length;
  const capacity = initSlots.length;
  const numOps = 4;

  yield {
    state: dequeGraph('A deque exposes both ends of the sequence', initSlots, {
      s0: 'first',
      s2: 'last',
      frontSlot: 's0',
      backSlot: 's2',
      frontX: 1.1,
      backX: 4.0,
      cap: 'ring slots',
    }),
    highlight: { active: ['front', 'back', 's0', 's2'], compare: ['cap'] },
    explanation: `A double-ended queue with ${initSize} elements in ${capacity} slots supports insertion and removal at both ends. It keeps queue order, but unlike a plain FIFO queue it lets algorithms treat the back as a stack-like editing point. All ${numOps} operations (pushFront, popFront, pushBack, popBack) are O(1) amortized.`,
    invariant: `pushFront, popFront, pushBack, and popBack should be O(1) amortized.`,
  };

  const afterPushBack = ['A', 'B', 'C', 'D', '_', '_'];
  const pushBackSize = afterPushBack.filter(s => s !== '_').length;
  const pushBackVal = 'D';

  yield {
    state: dequeGraph('pushBack appends after the current back', afterPushBack, {
      s0: 'first',
      s3: 'new last',
      frontSlot: 's0',
      backSlot: 's3',
      frontX: 1.1,
      backX: 5.45,
      cap: 'ring slots',
    }),
    highlight: { active: ['back', 's3', 'e-back-s'], found: ['s0', 's1', 's2'] },
    explanation: `pushBack writes "${pushBackVal}" into slot 3, the free slot after the old last element, and moves the back pointer. Size grows from ${initSize} to ${pushBackSize}. This is the familiar queue enqueue direction.`,
  };

  const afterPushFront = ['A', 'B', 'C', 'D', '_', 'Z'];
  const pushFrontVal = 'Z';
  const pushFrontSize = afterPushFront.filter(s => s !== '_').length;
  const logicalOrder = ['Z', 'A', 'B', 'C', 'D'];

  yield {
    state: dequeGraph('pushFront prepends before the current front', afterPushFront, {
      s5: 'new first',
      s3: 'last',
      frontSlot: 's5',
      backSlot: 's3',
      frontX: 8.35,
      backX: 5.45,
      cap: 'wrap',
    }),
    highlight: { active: ['front', 's5', 'e-front-s', 'cap'], compare: ['s0'] },
    explanation: `In a circular-buffer implementation, pushFront("${pushFrontVal}") wraps front from slot 0 to slot ${capacity - 1} (the physical end of the ${capacity}-slot array). Size is now ${pushFrontSize}. Logical order is ${logicalOrder.join(', ')} even though the storage wraps.`,
  };

  const afterPops = ['_', 'B', 'C', '_', '_', 'Z'];
  const popsSize = afterPops.filter(s => s !== '_').length;
  const removedCount = pushFrontSize - popsSize;

  yield {
    state: dequeGraph('popFront and popBack remove from opposite ends', afterPops, {
      s5: 'first',
      s2: 'last',
      frontSlot: 's5',
      backSlot: 's2',
      frontX: 8.35,
      backX: 4.0,
      cap: 'holes ok',
    }),
    highlight: { active: ['front', 'back', 's5', 's2'], removed: ['s0', 's3'] },
    explanation: `Removing from either side only advances one pointer and optionally clears a slot. ${removedCount} elements removed, ${popsSize} remain (${afterPops.filter(s => s !== '_').join(', ')}). The implementation does not shift the middle elements.`,
  };
}

function* slidingWindowCaseStudy() {
  const windowSteps = 4;
  const windowValues = [8, 3, 9];

  yield {
    state: labelMatrix(
      'Sliding-window maximum uses a deque of candidates',
      [
        { id: 'step1', label: `read ${windowValues[0]}` },
        { id: 'step2', label: `read ${windowValues[1]}` },
        { id: 'step3', label: `read ${windowValues[2]}` },
        { id: 'step4', label: 'slide' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'deque', label: 'deque' },
        { id: 'max', label: 'max' },
      ],
      [
        ['push back', `[${windowValues[0]}]`, `${windowValues[0]}`],
        ['keep smaller behind', `[${windowValues[0]},${windowValues[1]}]`, `${windowValues[0]}`],
        [`pop smaller back, push ${windowValues[2]}`, `[${windowValues[2]}]`, `${windowValues[2]}`],
        ['drop expired front', `[${windowValues[2]},...]`, `${windowValues[2]}`],
      ],
    ),
    highlight: { active: ['step3:operation', 'step3:deque'], found: ['step3:max', 'step4:max'] },
    explanation: `Monotonic Queue is built from deque operations across ${windowSteps} steps. New values (${windowValues.join(', ')}) enter at the back, dominated candidates are popped from the back (${windowValues[1]} < ${windowValues[2]} so ${windowValues[1]} is evicted), and expired indices leave from the front.`,
  };

  const candidates = ['9', '7', '4'];
  const candidateCount = candidates.length;
  const frontVal = candidates[0];
  const backVal = candidates[candidates.length - 1];

  yield {
    state: dequeGraph('The front is the answer; the back is the editing surface', [...candidates, '_', '_', '_'], {
      s0: 'max',
      s2: 'weakest',
      frontSlot: 's0',
      backSlot: 's2',
      frontX: 1.1,
      backX: 4.0,
      cap: 'window',
    }),
    highlight: { active: ['front', 's0'], compare: ['back', 's2'] },
    explanation: `The front holds the current best candidate (${frontVal}). The back (${backVal}, weakest of ${candidateCount} candidates) is where new arrivals remove weaker candidates before joining. That is why both ends matter.`,
  };

  const numImpls = 3;
  const implNames = ['ring buffer', 'block deque', 'linked list'];

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
    explanation: `A deque is an interface, not one storage layout. ${numImpls} common implementations (${implNames.join(', ')}): circular buffers are common for bounded queues; block deques avoid moving everything when growth happens at both ends.`,
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
        'The two-ended view renders a circular buffer as a flat row of fixed slots. Two labeled pointers -- front and back -- bracket the live data. Every push or pop moves exactly one pointer and writes exactly one slot. No element between the pointers ever shifts position. When pushFront decrements front past physical index 0, it wraps to the last physical slot; the logical sequence remains continuous because the buffer is conceptually a ring.',
        {type: 'callout', text: 'A deque wins by making both ends cheap while keeping the middle untouched.'},
        'Color tells you what just happened. An active highlight marks the slot and pointer being modified right now. A found highlight confirms a slot whose value was read without change. A removed highlight marks a slot freed by a pop -- the value is gone, and the pointer has moved past it. The capacity badge in the corner tracks buffer size and flashes when a wraparound occurs, so you can see the modular arithmetic in real time.',
        'The sliding-window view swaps the raw buffer for a monotone deque. The front always holds the current window maximum. The back is the editing surface: each new arrival evicts every back element it dominates before entering. Watch a large value arrive and pop several smaller values off the back in succession. When the window slides forward, the front element expires once its index falls behind the window boundary. Both ends are active editing points -- the entire reason a deque is required.',
        {type: 'image', src: './assets/gifs/double-ended-queue-deque.gif', alt: 'Animated walkthrough of the double ended queue deque visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A stack gives O(1) push and pop at one end. A queue gives O(1) enqueue at the back and O(1) dequeue at the front. Each structure treats one end as read-only. Certain algorithms cannot live with that restriction because they must insert and remove at both ends of the same sequence, and both operations must be constant-time.',
        'The sliding-window maximum problem is the clearest motivating case. You have an array of n numbers and a window of size k sliding one position at a time. At each position you need the window maximum. New values arrive at the back. Expired values leave from the front when the window moves past their index. Dominated values -- smaller than a new arrival -- also get removed from the back. A queue cannot remove from the back. A stack cannot expire from the front. Only a structure with O(1) editing at both ends works.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Circular_buffer.svg/250px-Circular_buffer.svg.png', alt: 'Circular buffer shown as a ring of fixed slots', caption: 'A circular view makes wraparound natural: front and back can move without shifting the stored sequence. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Circular_buffer.svg.'},
        'A deque (double-ended queue, pronounced "deck") provides exactly this contract: pushFront, pushBack, popFront, popBack, peekFront, and peekBack, all in O(1) amortized time. The name describes the interface, not the implementation. The most common implementation is a circular buffer -- a fixed-size array where two index pointers chase each other around the ring.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first attempt is a dynamic array. pushBack appends at the end in O(1) amortized time. popBack removes the last element in O(1). These are cheap because no other element moves -- the operation touches only the last occupied slot.',
        'Front operations break the model. pushFront must insert at index 0, so every existing element shifts one position to the right -- that is O(n) work. popFront removes index 0 and shifts everything left -- also O(n). In JavaScript, Array.unshift and Array.shift carry exactly this cost. V8 internally optimizes some patterns with a backing-store offset, but the worst case is still linear.',
        'For workloads mixing front and back operations, the cost is devastating. A sliding-window pass over n elements with window size k performs up to n front removals. Each removal costs O(k) because of the shift. Total work: O(nk). For n = 1,000,000 and k = 1,000, that is roughly a billion operations instead of a million. The front penalty turns a linear algorithm into a quadratic one.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the assumption that logical position 0 must live at physical index 0. Every front insertion or removal under this assumption forces a bulk shift of all elements. With n elements stored, each front operation costs O(n). A sequence of m front operations costs O(mn) total.',
        'The deeper issue is that pinning the logical front to a fixed physical address buys nothing. No algorithm relies on the first logical element being at memory address base+0 rather than base+37. The pinning is an implementation accident inherited from the simplest possible array layout, and its only consequence is an O(n) tax on every front edit.',
        'This wall cannot be overcome by clever tricks inside the shifting model. Pre-allocating slack at the front only delays the shift; it does not eliminate it. Using a gap buffer moves the cost from the front to wherever the gap fills. The wall is structural: as long as one physical position is privileged, somebody pays O(n) to maintain the privilege.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Decouple logical order from physical layout. A circular buffer is a fixed-size array where the first logical element can live at any physical index. Two integers -- head and tail -- track the boundaries. head is the index of the first logical element. tail is the index one past the last logical element. The physical array is treated as a ring: slot 0 follows slot capacity-1.',
        'pushFront decrements head modulo capacity: head = (head - 1 + capacity) % capacity, then writes the new value at buf[head]. pushBack writes at buf[tail] and increments tail modulo capacity. Both operations perform one modular arithmetic step, one array write, and one index update. Zero elements shift. The cost is O(1) unconditionally -- no element anywhere in the buffer moves.',
        'The only remaining cost is resizing. When the buffer fills, allocate a new array of double the capacity, copy the live elements in logical order starting from head (wrapping around the old ring), and reset head = 0, tail = old_size. The copy costs O(n), but it doubles the capacity, so the next n operations each cost O(1). By the geometric-series argument (1 + 2 + 4 + ... + n = 2n - 1), the total resize cost across n insertions is O(n), giving O(1) amortized per operation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The state of a circular-buffer deque is four values: buf (the array), head (index of the first live element), tail (index one past the last live element), and capacity (the length of buf). The live count is (tail - head + capacity) % capacity. An empty deque has head == tail. A full deque has (tail + 1) % capacity == head when one slot is reserved as a sentinel, or count == capacity when a separate counter is maintained.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Circular_buffer_-_XX123XX_with_pointers.svg/250px-Circular_buffer_-_XX123XX_with_pointers.svg.png', alt: 'Linear circular buffer diagram with read and write pointers around live slots', caption: 'The pointer view shows the implementation contract: move indexes, not elements. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Circular_buffer_-_XX123XX_with_pointers.svg.'},
        'The four core operations each touch one slot and one pointer. pushFront: head = (head - 1 + cap) % cap, then buf[head] = value. pushBack: buf[tail] = value, then tail = (tail + 1) % cap. popFront: read buf[head], then head = (head + 1) % cap. popBack: tail = (tail - 1 + cap) % cap, then read buf[tail]. The modular arithmetic is the entire mechanism. No branch depends on the number of stored elements.',
        'Resizing fires when the buffer is full. Allocate a new array of 2 * capacity. Walk the old ring starting at head, copying elements into positions 0 through size-1 of the new array. Set head = 0, tail = size, capacity = 2 * old_capacity. Every element moves exactly once, and the logical order is perfectly preserved even though all physical addresses change.',
        'An alternative implementation uses a doubly linked list: each node holds a value, a prev pointer, and a next pointer. All four deque operations are O(1) worst-case with no resizing. The cost is 16 bytes of pointer overhead per element on 64-bit systems and poor cache locality from pointer chasing. Python\'s collections.deque uses a hybrid design: a doubly linked list of fixed-size 64-element blocks, combining contiguous storage within blocks with flexible growth between them.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: the live elements are buf[head], buf[(head+1) % cap], ..., buf[(tail-1+cap) % cap], in that logical order, and no operation violates this sequence. Every push extends the sequence at one end. Every pop shrinks it at one end. No operation touches the interior.',
        'pushFront places a new element one step before the current head and moves head backward. The old elements remain at their physical slots. The new head is the first element in any logical walk starting from head. pushBack places a new element at the current tail position and advances tail forward. The old sequence is untouched, and the new element becomes the last in the logical walk.',
        'popFront advances head by one, logically discarding the first element. The value at the old head position may still be physically present, but no logical walk will visit it because head has moved past. popBack retreats tail by one, discarding the last element by the same argument. Neither pop moves any other element in the buffer.',
        'Resize preserves the invariant by construction. It copies elements in their exact logical order into a fresh contiguous layout with head reset to 0. The logical sequence before and after the resize is identical; only the physical addresses and the capacity change. Because the copy visits each element exactly once and the new buffer is twice the old size, the amortization argument ensures this O(n) cost is spread across the n insertions that filled the buffer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'All four core operations -- pushFront, pushBack, popFront, popBack -- are O(1) amortized. Without a resize, each is O(1) worst-case: one modular arithmetic operation, one array read or write, one pointer update. Resizing costs O(n) but occurs only when the buffer doubles, which happens at most log2(n) times across n insertions. The total resize cost across n operations is 1 + 2 + 4 + ... + n = 2n - 1, so the amortized cost per operation approaches 2 -- constant.',
        'Random access is O(1): the element at logical index k lives at buf[(head + k) % capacity]. This property is specific to circular-buffer deques. Linked-list and block-based deques do not offer O(1) random access because they require traversal or block-index arithmetic.',
        'Space usage is at most 2n slots, since the buffer doubles when full. The load factor stays between 50% and 100% (or between 25% and 100% if you shrink when quarter-full). For 32-bit integer payloads, the circular buffer wastes up to 4n bytes on empty slots. A linked-list deque uses exactly n nodes but each carries two 8-byte pointers, costing 16n bytes of overhead -- higher per-element despite the tighter allocation.',
        'Scaling is smooth. Doubling n doubles the worst-case resize copy but does not change the amortized cost of any operation. The practical bottleneck is the resize copy itself, which happens O(log n) times across n insertions. Between resizes, every operation is a single array access with excellent cache behavior -- sequential slots in contiguous memory.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Sliding-window maximum and minimum. A monotone deque stores candidate indices in decreasing value order. Each new element enters at the back after evicting all back elements it dominates (values smaller than itself). Expired indices leave from the front when the window slides past them. The front always holds the index of the current maximum. Because each element enters once and leaves once, the total work across n elements is O(n), compared to O(n log k) with a heap. This pattern solves stock-price monitoring with fixed look-back and moving-average outlier detection.',
        '0-1 BFS. When a graph has edge weights of only 0 and 1, a deque replaces Dijkstra\'s priority queue. Zero-weight neighbors go to the front (same distance layer); weight-1 neighbors go to the back (next distance layer). The deque maintains correct processing order at O(V + E) total cost, versus O((V + E) log V) for Dijkstra with a binary heap. This appears in grid pathfinding where some cells are free and others cost one unit.',
        'Work-stealing schedulers (Chase-Lev deque). Each worker thread owns a deque of tasks. The owner pushes and pops at the bottom (hot end), keeping recently spawned work local for cache efficiency. Idle workers steal from the top (cold end) of a busy worker\'s deque. Owner operations are lock-free; steals use a single CAS (compare-and-swap). Go\'s goroutine scheduler, Tokio (Rust async runtime), and Java\'s ForkJoinPool all use variants of this design.',
        'Bounded undo/redo buffers. Recent edit operations push at the back and pop from the back for undo. When the history exceeds a fixed limit, the oldest entry drops from the front. A deque handles both ends without shifting. A stack alone cannot evict the oldest entry without O(n) traversal.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No O(1) interior operations. A deque supports efficient editing only at the two ends. Inserting or removing an element in the middle requires shifting elements in a circular buffer (O(n)) or splicing nodes in a linked-list variant (O(1) with a pointer, but finding the position is O(n)). If the workload needs frequent mid-sequence edits, a balanced tree or skip list fits better.',
        'Unnecessary complexity for single-ended workloads. If every insertion goes to the back and every removal comes from the front (a plain queue), or if all operations happen at one end (a stack), using a deque works but obscures intent. A named stack or queue communicates the access pattern to code readers and may optimize memory layout or thread safety for the single-ended case.',
        'Concurrency requires careful design. A plain circular-buffer deque is not thread-safe. The Chase-Lev work-stealing deque achieves safety through atomic operations and a restricted pattern: exactly one owner and multiple stealers, operating on opposite ends. A general multi-producer, multi-consumer concurrent deque with arbitrary access from both ends is substantially harder. Most production systems either mutex-guard the deque or avoid shared mutable deques entirely.',
        'The empty-vs-full ambiguity is the classic implementation bug. In a circular buffer, head == tail can mean either empty or completely full. Two standard fixes exist: keep a separate count field, or sacrifice one slot so the buffer is full when (tail + 1) % capacity == head. Getting this wrong causes silent data corruption -- pushes overwrite live data (full mistaken for empty) or pops return garbage (empty mistaken for non-empty).',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with a circular buffer of capacity 4. Slots: [_, _, _, _]. head = 0, tail = 0, size = 0. The buffer is empty because head == tail and the separate count is 0.',
        'pushBack(10): write 10 at buf[0], tail = (0+1)%4 = 1. State: [10, _, _, _], head=0, tail=1, size=1. pushBack(20): write 20 at buf[1], tail = 2. State: [10, 20, _, _], head=0, tail=2, size=2. Two back pushes, two slot writes, zero shifts.',
        'pushFront(5): head = (0-1+4)%4 = 3, write 5 at buf[3]. State: [10, 20, _, 5], head=3, tail=2, size=3. Logical order starting at head: buf[3]=5, buf[0]=10, buf[1]=20. The physical layout wraps, but the logical sequence is 5, 10, 20. pushBack(30): write 30 at buf[2], tail = (2+1)%4 = 3. State: [10, 20, 30, 5], head=3, tail=3, size=4. Buffer is full. Logical order: 5, 10, 20, 30.',
        'popFront(): read buf[3] = 5, head = (3+1)%4 = 0. State: [10, 20, 30, _], head=0, tail=3, size=3. Slot 3 still physically holds 5, but it is logically dead because head has moved past it. Logical order: 10, 20, 30. popBack(): tail = (3-1+4)%4 = 2, read buf[2] = 30. State: [10, 20, _, _], head=0, tail=2, size=2. Logical order: 10, 20.',
        'Resize scenario: starting from [10, 20, _, _] with head=0, tail=2, size=2, cap=4. pushBack three values: 30, 40, 50. After pushBack(30): tail=3, size=3. After pushBack(40): buffer is full at size=4. Resize triggers: allocate new buf of capacity 8, copy logical order [10, 20, 30, 40] into positions 0-3. head=0, tail=4, cap=8. Now pushBack(50): write at buf[4], tail=5, size=5. State: [10, 20, 30, 40, 50, _, _, _]. The resize cost 4 copies for 4 elements. The next 4 pushes are free of resizing, so amortized cost per push is (4 copies + 4 writes) / 4 pushes = 2 operations each.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Vol. 1, Section 2.2.1 (1968) formalized the deque as an abstract data type with four access points, including input-restricted and output-restricted variants. Chase and Lev, "Dynamic Circular Work-Stealing Deque" (2005) defined the lock-free deque used by Go, Tokio, and Java ForkJoinPool. Herlihy and Shavit, The Art of Multiprocessor Programming, Chapter 10, covers the theory of concurrent deques and CAS-based correctness proofs.',
        'Prerequisites: study Queue and Stack first to understand single-ended access contracts. Study Ring Buffer for the circular-array wraparound mechanics. Study Dynamic Array for the geometric-growth amortization proof, which transfers directly to deque resize analysis.',
        'Extensions: Monotonic Queue layers a value-ordering invariant on top of a deque to solve sliding-window max/min in O(n). 0-1 BFS uses a deque to compute shortest paths in O(V+E) when all edge weights are 0 or 1. Work-Stealing Scheduler shows how the two-ended access contract becomes a concurrency primitive for parallel task execution.',
      ],
    },
  ],
};
