// Ring buffer: a fixed-size array whose head and tail wrap around, giving a
// queue-like stream without shifting memory.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ring-buffer',
  title: 'Ring Buffer',
  category: 'Data Structures',
  summary: 'A fixed-capacity circular queue: head and tail indices wrap with modulo arithmetic so streaming data never shifts the array.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['head tail wrap', 'streaming policy'], defaultValue: 'head tail wrap' },
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

const slots = Array.from({ length: 8 }, (_, index) => ({ id: `s${index}`, label: String(index) }));

function buffer(title, slotLabels, head, tail, count) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  const live = new Set(Array.from({ length: count }, (_, offset) => (head + offset) % slots.length));
  return matrixState({
    title,
    rows: [
      { id: 'value', label: 'slot value' },
      { id: 'role', label: 'index role' },
      { id: 'state', label: 'state' },
    ],
    columns: slots,
    values: [
      slotLabels,
      slots.map((slot, index) => (index === head && index === tail ? 'H/T' : index === head ? 'H' : index === tail ? 'T' : '')),
      slots.map((_, index) => (live.has(index) ? 'occupied' : slotLabels[index] ? 'stale' : 'free')),
    ].map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function* headTailWrap() {
  yield {
    state: buffer('Empty ring: head and tail start together', ['', '', '', '', '', '', '', ''], 0, 0, 0),
    highlight: { active: ['role:s0'], found: ['state:s0', 'state:s1', 'state:s2', 'state:s3'] },
    explanation: 'A ring buffer is a fixed array plus head, tail, and usually a count or full flag. Head and tail can be equal when empty, so metadata must say what that equality means.',
  };

  yield {
    state: buffer('Enqueue writes at tail, then advances tail', ['A', 'B', 'C', '', '', '', '', ''], 0, 3, 3),
    highlight: { active: ['value:s0', 'value:s1', 'value:s2'], found: ['role:s3'] },
    explanation: 'Enqueue stores at tail and moves tail = (tail + 1) mod capacity. Nothing shifts. The oldest item stays at head, and the next free slot is tail.',
    invariant: 'All movement is index movement; the array contents stay in place.',
  };

  yield {
    state: buffer('Dequeue reads at head, then advances head', ['A', 'B', 'C', '', '', '', '', ''], 2, 3, 1),
    highlight: { removed: ['value:s0', 'value:s1'], active: ['role:s2'], found: ['role:s3'] },
    explanation: 'Dequeue reads from head and moves head forward. The old bytes may still sit in memory, but they are outside the logical queue. The indices define the data, not clearing cells.',
  };

  yield {
    state: buffer('Wraparound reuses the front of the array', ['G', 'H', 'C', 'D', 'E', 'F', '', ''], 2, 2, 6),
    highlight: { active: ['value:s3', 'value:s4', 'value:s5', 'value:s0', 'value:s1'], found: ['role:s2'] },
    explanation: 'When tail reaches the physical end, it wraps to slot 0. Logical order can cross the array boundary; the queue is C, D, E, F, G, H even though the bytes sit in two chunks.',
  };
}

function* streamingPolicy() {
  yield {
    state: labelMatrix(
      'Full-buffer policies',
      [
        { id: 'reject', label: 'reject write' },
        { id: 'overwrite', label: 'overwrite oldest' },
        { id: 'block', label: 'block producer' },
        { id: 'grow', label: 'grow buffer' },
      ],
      [
        { id: 'behavior', label: 'behavior' },
        { id: 'use', label: 'use when' },
      ],
      [
        ['return short write/error', 'data loss is unacceptable'],
        ['advance head too', 'latest samples matter most'],
        ['wait for space', 'backpressure is available'],
        ['allocate more memory', 'capacity is not fixed'],
      ],
    ),
    highlight: { active: ['reject:behavior', 'overwrite:behavior'], found: ['block:use'] },
    explanation: 'A full ring buffer forces a policy decision. You can reject, overwrite, block, or grow, but each choice means something different for data loss, latency, and memory.',
  };

  yield {
    state: labelMatrix(
      'Copy versus claim API',
      [
        { id: 'copyput', label: 'put copy' },
        { id: 'claimput', label: 'put claim' },
        { id: 'copyget', label: 'get copy' },
        { id: 'claimget', label: 'get claim' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['simple memcpy', 'may copy twice'],
        ['producer writes in place', 'region may stop at wrap boundary'],
        ['simple memcpy out', 'consumer copies data'],
        ['consumer reads in place', 'must finish consumed count'],
      ],
    ),
    highlight: { found: ['claimput:cost', 'claimget:cost'], compare: ['claimput:caveat'] },
    explanation: 'Zero-copy claim APIs let a producer or consumer use the internal array directly. Near the physical end, one logical write may need two claims because no single contiguous slice crosses the wrap.',
  };

  yield {
    state: labelMatrix(
      'Concurrency shape',
      [
        { id: 'spsc', label: 'single producer/consumer' },
        { id: 'mpmc', label: 'multi producer/consumer' },
        { id: 'isr', label: 'interrupt producer' },
        { id: 'dma', label: 'DMA producer' },
      ],
      [
        { id: 'index', label: 'index ownership' },
        { id: 'guard', label: 'guardrail' },
      ],
      [
        ['producer writes tail, consumer writes head', 'memory barriers'],
        ['shared index writes', 'lock or atomic protocol'],
        ['producer can preempt consumer', 'short critical sections'],
        ['device writes bytes', 'publish only after data visible'],
      ],
    ),
    highlight: { active: ['spsc:index', 'spsc:guard'], compare: ['mpmc:guard'] },
    explanation: 'The easy concurrency case is one producer and one consumer because they mostly update different indices. Multiple producers or consumers share index writes, so they need locks or a careful atomic protocol.',
  };

  yield {
    state: buffer('Final frame: bounded memory, moving indices', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 3, 3, 8),
    highlight: { active: ['role:s3'], found: ['value:s0', 'value:s7'] },
    explanation: 'A ring buffer is best understood as bounded memory plus moving ownership. The bytes do not march; head and tail redefine which bytes are live.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'head tail wrap') yield* headTailWrap();
  else if (view === 'streaming policy') yield* streamingPolicy();
  else throw new InputError('Pick a ring buffer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a fixed-size array with two moving pointers: head (where the next read happens) and tail (where the next write happens). Slots between head and tail are occupied; the rest are free or stale. The “H” and “T” markers in the index-role row track which slot each pointer names.',
        {type: 'callout', text: 'A ring buffer makes queue motion cheap by moving ownership indexes instead of moving stored bytes.'},
        'Watch for the wraparound frame. When tail reaches the physical end of the array, it jumps back to slot 0. The logical queue order is still head-to-tail, even though the physical bytes now sit in two separate chunks. That single frame is the entire trick.',
        'Active markers highlight the slot being read or written right now. Found markers show slots that hold live data. Stale slots still contain old values in memory, but they are outside the live range and logically dead. The state row makes this distinction explicit.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Streaming data needs a buffer: audio samples arrive from hardware, network packets land from a NIC, log events fire from application code. The producer writes; the consumer reads. Both need O(1) operations, bounded memory, and no coordination beyond “is there space?” and “is there data?”',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Circular_buffer.svg/250px-Circular_buffer.svg.png', alt: 'Circular buffer shown as a ring of slots', caption: 'The ring drawing captures the logical idea: a fixed array behaves as if its ends connect. Source: https://commons.wikimedia.org/wiki/File:Circular_buffer.svg.'},
        'A ring buffer solves this by allocating one array at startup and never moving the stored values. Head and tail slide forward as items are consumed and produced. When an index reaches the end, modular arithmetic wraps it to zero. The array acts as if its ends are glued together into a circle, so a steady stream reuses the same fixed memory forever.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest queue uses a plain array. Enqueue appends to the end. Dequeue removes from the front. Appending is cheap, but removing from the front forces every remaining element to shift left by one position so that the first logical item stays at index 0.',
        'For a buffer holding n items, that shift costs O(n) work per dequeue. In a streaming workload where every item eventually leaves the front, total shift cost is quadratic in the number of items processed. A 10,000-item audio buffer would shift up to 10,000 elements on every sample consumed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The shift cost is the wall. An array insists that logical index 0 lives at physical slot 0. Removing the front item means every other item must physically move one slot left to maintain that mapping. The data has not changed, only the ownership boundary moved, yet the array does O(n) work to keep physical and logical order aligned.',
        'A linked-list queue avoids shifting by using pointers, but pays a different price: one heap allocation per enqueue, pointer-chasing on every access, 16 bytes of overhead per node on a 64-bit system, and poor cache locality because nodes scatter across memory. For high-throughput paths like audio callbacks, interrupt handlers, or network receive loops, neither shifting nor per-item allocation is acceptable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Logical order does not have to match physical layout. The oldest item does not need to sit at slot 0. It sits wherever head says it sits. If head is at slot 5 in an eight-slot buffer and the queue holds three items, the live data is at slots 5, 6, 7. If head is at slot 6 and the queue holds four items, the live data wraps: slots 6, 7, 0, 1.',
        'Modular arithmetic makes this work: next_index = (index + 1) % capacity. One line of code turns a flat array into a circle. The array never grows, items never shift, and both head and tail advance by a single increment per operation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The buffer stores an array of fixed capacity, a head index, a tail index, and a size counter (or uses a one-slot-wasted convention to distinguish full from empty).',
        'Enqueue (push_back): write the item at buf[tail], then advance tail = (tail + 1) % capacity. Increment the size counter. If the buffer is already full, apply the overflow policy (reject, overwrite oldest, or block).',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Circular_buffer_-_XX123XX_with_pointers.svg/250px-Circular_buffer_-_XX123XX_with_pointers.svg.png', alt: 'Linear view of a circular buffer with read and write pointers', caption: 'The physical view is still linear memory; read and write pointers provide the circular interpretation. Source: https://commons.wikimedia.org/wiki/File:Circular_buffer_-_XX123XX_with_pointers.svg.'},
        'Dequeue (pop_front): read the item at buf[head], then advance head = (head + 1) % capacity. Decrement the size counter. The old value may remain in the physical slot, but it is outside the live range and logically dead.',
        'Full vs. empty: if head == tail, is the buffer empty or completely full? Without extra state, these two cases are indistinguishable. The two standard solutions: (1) keep a separate size counter, or (2) waste one slot so the buffer is full when (tail + 1) % capacity == head. Many high-performance implementations use power-of-two capacity so that index % capacity becomes index & (capacity - 1), replacing division with a single bitwise AND.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: the live queue is the size items starting at buf[head], read in order head, head+1, ..., wrapping modulo capacity. Enqueue extends the live range by one at the tail end. Dequeue shrinks the live range by one at the head end. Both operations touch exactly one slot and advance exactly one index. FIFO order is preserved because items always enter at tail and leave at head.',
        'The modular arithmetic is what makes the array appear infinite. After capacity enqueue-dequeue cycles, head and tail have both wrapped all the way around and reuse the same slots. No memory was allocated, no data was shifted, and the logical sequence was never interrupted.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Enqueue and dequeue are O(1) each, always. There is no amortized caveat because the buffer never resizes. Memory is O(capacity), allocated once.',
        'When capacity must grow, the buffer copies all live items into a larger array, costing O(n). If capacity doubles each time, the amortized cost per operation stays O(1), the same tradeoff as a dynamic array. But many ring buffer use cases choose a fixed capacity specifically to avoid this: real-time audio, kernel drivers, and interrupt-safe code cannot tolerate an unpredictable copy.',
        'The hidden constant is small. Each operation is an array write, an integer increment, and a modulo (or bitmask). No pointer chasing, no allocation, no branch-heavy logic. Cache locality is excellent because the data is contiguous.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'BFS queues: breadth-first search enqueues discovered nodes and dequeues the next node to expand. A ring buffer gives O(1) at both ends without linked-list overhead.',
        'Producer-consumer handoff: the Linux kernel kfifo is a ring buffer. One thread produces, another consumes, and the bounded capacity applies natural backpressure. The single-producer single-consumer (SPSC) case needs only atomic index reads and memory barriers, no locks.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation through a small network', caption: 'Network and device queues are natural ring-buffer workloads: packets arrive steadily and consumers drain bounded slots. Source: https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.'},
        'Sliding window algorithms: a fixed-size window over a data stream is a ring buffer by nature. Samples enter at the tail as new data arrives, and old samples fall off the head as the window advances.',
        'Logging and telemetry: a ring buffer keeps the most recent N events in bounded memory. When the buffer fills, the oldest record is overwritten. After a crash, the newest records are the most useful, and no allocation failure can prevent logging.',
        'Network packet buffers: NIC receive rings, DPDK descriptor rings, and io_uring submission and completion rings are all ring buffers. The hardware writes at the tail, the driver reads at the head, and the fixed slot count bounds DMA memory.',
        'Undo/redo: an editor with a bounded undo history pushes actions at the tail and pops them from the head when the history limit is reached. The ring buffer enforces the limit without shifting the remaining history.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fixed capacity is a commitment, not a convenience. If the workload has unpredictable bursts and dropping data is unacceptable, a growable queue or backpressure protocol is a better fit.',
        'Random access is O(1) by index arithmetic, but ring buffers are not a replacement for arrays when arbitrary insertion or deletion in the middle is needed. Those operations still cost O(n) because other elements must move.',
        'Cache behavior degrades when the live range wraps: a single logical scan crosses the end of the array and jumps back to slot 0, touching two cache lines that may not be adjacent in physical memory. For small buffers this is negligible; for very large buffers with frequent wraps, a plain linear array may scan faster.',
        'The full/empty ambiguity is the most common implementation bug. Forgetting the extra state (size counter or wasted slot) produces a buffer that silently treats full as empty or empty as full. The second most common bug is concurrent access without proper memory ordering in the SPSC case or without locks in the MPMC case.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Capacity 5, using a size counter. Start empty: buf = [_, _, _, _, _], head = 0, tail = 0, size = 0.',
        'push_back(A): buf[0] = A, tail = (0+1)%5 = 1, size = 1. State: [A, _, _, _, _], head=0, tail=1.',
        'push_back(B): buf[1] = B, tail = 2, size = 2. push_back(C): buf[2] = C, tail = 3, size = 3. State: [A, B, C, _, _], head=0, tail=3.',
        'pop_front(): read buf[0] = A, head = (0+1)%5 = 1, size = 2. pop_front(): read buf[1] = B, head = 2, size = 1. State: [_, _, C, _, _], head=2, tail=3. (Slots 0 and 1 are stale.)',
        'push_back(D): buf[3] = D, tail = 4, size = 2. push_back(E): buf[4] = E, tail = (4+1)%5 = 0, size = 3. Tail just wrapped to slot 0. push_back(F): buf[0] = F, tail = 1, size = 4. State: [F, _, C, D, E], head=2, tail=1.',
        'The logical order is C, D, E, F. Read starting at head=2: slot 2 (C), slot 3 (D), slot 4 (E), slot 0 (F). The physical layout is split across the array boundary, but the logical sequence is intact. That wraparound is what makes a ring buffer circular.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Ring buffers emerged from hardware FIFO designs in the 1960s. Lamport 1983 described the lock-free single-producer single-consumer protocol using shared indices and memory ordering. The Linux kfifo (include/linux/kfifo.h) is a clean kernel-space example with power-of-two sizing.',
        'Study Queue next for the abstract interface a ring buffer implements. Study Double-Ended Queue (Deque) for the two-ended generalization. Study Dynamic Array for the resize-and-copy tradeoff. Study Sliding Window Maximum for the algorithmic use case. Study Backpressure and Flow Control for the policy decisions a full buffer forces. Study Lock-Free Queue for the concurrent extension.',
      ],
    },
  ],
};
