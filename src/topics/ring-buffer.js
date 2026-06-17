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
      heading: 'What a ring buffer is',
      paragraphs: [
        `A ring buffer is a fixed-size array used as a queue by making the indices wrap around. Head names the next item to read. Tail names the next slot to write. When either index reaches the physical end of the array, it returns to zero. The bytes do not move; ownership moves.`,
        `This structure is also called a circular buffer. It is common anywhere data arrives as a stream: audio samples, serial input, network descriptors, log records, tracing events, packets between interrupt and thread context, and producer-consumer handoff in runtimes. The point is not novelty. The point is bounded memory and predictable constant-time movement.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious queue uses an array, appends new items at the end, and removes old items from the front. That works for small examples, but it hits a wall in steady streams. Removing from the front can shift every remaining item. The system pays to move data that has not changed, and the worst case grows with queue length.`,
        `A linked queue avoids shifting, but it pays a different cost: allocation, pointer chasing, memory fragmentation, and poorer cache locality. Those costs matter in drivers, audio callbacks, telemetry paths, embedded systems, and hot request loops. A ring buffer keeps storage contiguous, allocates once, and turns queue progress into index arithmetic.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that logical order does not have to match physical layout. If head is at slot 6 in an eight-slot buffer and the queue holds four items, the logical order may be slots 6, 7, 0, 1. The live sequence crosses the array boundary, but the consumer still sees a normal FIFO stream.`,
        `Modulo arithmetic turns the array into a circle: next = (index + 1) mod capacity. Many implementations use a power-of-two capacity and a bit mask instead of division, but the idea is the same. The array stores cells. The metadata says which cells are live, which are free, and where the next read or write should occur.`,
      ],
    },
    {
      heading: 'The mechanism',
      paragraphs: [
        `A basic implementation stores an array, capacity, head, tail, and enough extra state to distinguish empty from full. That extra state is usually a count, a full flag, or one deliberately unused slot. Without it, head == tail is ambiguous because it can mean no items or all slots occupied.`,
        `Enqueue checks that space exists, writes the item at tail, and advances tail. Dequeue checks that an item exists, reads from head, and advances head. The old value may remain in the array after dequeue, but it is stale. It is outside the logical live range. Clearing the cell can help debugging or garbage collection, but clearing is not what makes the structure correct.`,
        `For byte streams, high-performance APIs often avoid extra copies. A producer can claim the currently writable contiguous slice, write directly into it, and then finish by publishing the number of bytes produced. A consumer can claim the readable contiguous slice and later release the number of bytes consumed. Near the physical end of the array, one logical operation may be split into two physical slices.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Correctness comes from one invariant: the queue contents are the count live items starting at head, wrapping modulo capacity. Enqueue writes immediately after that live range and extends the range by one. Dequeue reads the first item in the live range and shrinks the range by one. FIFO order follows from always reading at head and always writing at tail.`,
        `The structure works because moving indices is cheaper than moving stored values. A normal array queue preserves physical order by shifting cells. A ring buffer preserves logical order by changing the interpretation of cells. The consumer does not need the oldest item to sit at slot zero. It only needs head to identify the oldest item correctly.`,
      ],
    },
    {
      heading: 'Full-buffer policy',
      paragraphs: [
        `A ring buffer makes capacity explicit. When the buffer is full, the implementation must choose a policy. Rejecting a write preserves existing data and tells the producer it failed. Overwriting the oldest data keeps the newest samples and sacrifices history. Blocking the producer applies backpressure. Growing the buffer abandons the fixed-capacity promise and becomes a different design.`,
        `There is no universally correct policy. Audio capture may prefer dropping old samples to keep time moving. A payment queue must not overwrite old messages silently. A kernel tracing buffer may intentionally keep the latest records because the newest context is most useful after a crash. A network protocol receive buffer may apply backpressure or drop packets depending on protocol semantics.`,
      ],
    },
    {
      heading: 'Concurrency shape',
      paragraphs: [
        `The easiest concurrent ring buffer has one producer and one consumer. The producer owns tail, the consumer owns head, and both read enough shared state to detect empty or full. This can be implemented with atomics and memory-order rules: data must become visible before the producer publishes the new tail, and the consumer must read data only after observing that published tail.`,
        `Multiple producers or multiple consumers are harder because more than one thread may try to claim the same slot or advance the same index. Those designs need locks, sequence numbers, compare-and-swap loops, per-slot state, or another queue structure. The name ring buffer does not automatically mean lock-free, wait-free, or safe across threads. The concurrency contract is separate from the circular layout.`,
      ],
    },
    {
      heading: 'Cost and signals',
      paragraphs: [
        `Enqueue and dequeue are O(1). Memory is O(capacity). Allocation can happen once at initialization. The predictable cost is the main advantage. The important runtime signals are occupancy, high-water mark, failed writes, overwritten records, producer stalls, consumer lag, average and tail residence time, wrap count, and copy count. For real-time systems, the worst-case path matters more than the average path.`,
        `Boundary bugs are common. Test empty, one item, full, wrap after many operations, reads that end exactly at capacity, writes that split across the boundary, and transitions where head catches tail. If the implementation exposes claim/finish slices, test partial finish and cancellation. If it is concurrent, test memory visibility and index publication, not just single-threaded order.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `Ring buffers are useful when data has stream order, bounded buffering is acceptable, and predictable cost matters. They fit UART input, audio playback, packet descriptor rings, NIC receive queues, DMA handoff, tracing buffers, telemetry windows, log ingestion, job handoff between fixed stages, and recent-history storage for diagnostics. They are also a useful teaching bridge from Queue to Backpressure because they make capacity visible and measurable under load.`,
        `A typical audio case shows the tradeoff. The device callback writes samples into the buffer at a steady rate. The application reads samples on another thread. The callback cannot allocate or shift memory without risking an audible glitch. The ring buffer gives it a bounded place to publish samples quickly. The product requirement decides whether overflow drops old samples, drops new samples, blocks, or reports an error.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A ring buffer is wrong when the queue must grow without a practical bound, when arbitrary deletion or random lookup is central, when every item must be preserved but producers cannot be slowed, or when the full policy is politically hidden instead of explicit. It is also wrong when callers need a stable pointer to an item after later writes may reuse the same slot.`,
        `The most damaging mistakes are treating stale cells as live data, forgetting the full/empty ambiguity, assuming modulo arithmetic is free in every hot path, exposing internal slices without a publication protocol, and using a single-producer design with multiple producers. The data structure is small, but the contract around capacity and ownership must be written down.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Queue and Double-Ended Queue first, then Backpressure & Flow Control for the policy side of bounded buffering. After that, compare Lock-Free Queue, Semaphore Permit Counter, NIC RX Ring & NAPI Poll Case Study, io_uring Submission & Completion Rings, eBPF Ring Buffer Telemetry Case Study, and RTP Jitter Buffer. Each topic reuses the same base idea: fixed slots, moving ownership, and explicit rules for what happens when producers outrun consumers.`,
      ],
    },
  ],
};
