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
    explanation: 'A ring buffer is a fixed array plus head, tail, and usually a count or full flag. Empty means there is no item to read; head and tail may point to the same slot.',
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
    explanation: 'When tail reaches the physical end, it wraps to slot 0. The logical order crosses the array boundary: C, D, E, F, G, H. That wrap is the whole trick.',
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
    explanation: 'A full ring buffer forces a policy decision. Embedded logs may overwrite oldest entries; network queues usually reject or apply backpressure; dynamic queues grow only if bounded memory is not required.',
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
    explanation: 'Zero-copy claim APIs expose the internal contiguous region. Near the physical end, a logical write may need two claims because no single contiguous slice crosses the wrap.',
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
    explanation: 'The easy concurrency case is one producer and one consumer because they update different indices. Multiple producers or consumers need external serialization or a carefully designed lock-free protocol.',
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
      heading: 'What it is',
      paragraphs: [
        'A ring buffer, also called a circular buffer, is a fixed-size array used as a FIFO stream. Instead of removing from the front by shifting every remaining item, it keeps head and tail indices. Enqueue writes at tail and advances tail modulo capacity. Dequeue reads at head and advances head modulo capacity. The physical array never moves; only the meaning of positions changes.',
        'Zephyr describes a ring buffer as a circular buffer whose contents are stored in first-in-first-out order and used for asynchronous streaming copies: https://docs.zephyrproject.org/latest/kernel/data_structures/ring_buffers.html. Boost describes a circular buffer as fixed-capacity storage where new data can wrap to the beginning and overwrite old data depending on policy: https://www.boost.org/libs/circular_buffer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The implementation stores an array, capacity, head, tail, and either count or a full flag. Empty and full are otherwise ambiguous because head can equal tail in both cases. Enqueue checks space, writes the item at tail, then tail = (tail + 1) mod capacity. Dequeue checks nonempty, reads the item at head, then head = (head + 1) mod capacity. Logical order can cross the physical end of the array.',
        'Full-buffer behavior is a design choice. Some buffers reject writes. Some overwrite the oldest item by advancing head when tail wraps. Some block the producer until the consumer catches up. This choice ties directly to Backpressure & Flow Control: a ring buffer can be a bounded queue that protects memory, or it can be a lossy latest-value window.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Operations are O(1), memory is O(capacity), and allocation can be done once. That predictability is why ring buffers appear in kernels, device drivers, audio pipelines, network receive queues, telemetry, logging, and embedded systems. The main complexity is boundary handling. A logical contiguous write may be physically split at the wrap, which is why high-performance APIs sometimes expose claim/finish calls for zero-copy operation.',
        'Concurrency is simple only in the single-producer single-consumer case. The producer can own the tail index and the consumer can own the head index, with memory barriers to publish bytes before publishing the tail. Multiple producers or consumers require locks, atomic compare-and-swap protocols, or another queue design such as a Lock-Free Queue.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ring buffers are the natural storage for streams: UART input, audio samples, packet descriptors, tracing spans, log events, telemetry windows, and producer-consumer handoff between interrupt and thread contexts. They also appear inside runtimes where fixed memory and predictable latency matter more than unbounded growth. eBPF Ring Buffer Telemetry Case Study shows the same circular-buffer idea inside a production kernel-to-user observability path.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not forget the full/empty ambiguity. If head == tail can mean both empty and full, you need a count, a full flag, or one unused slot. Do not assume overwriting oldest data is safe; it is correct for latest-sample telemetry but wrong for payments, messages, and protocol bytes. Do not expose the internal buffer without a finish protocol, or producers and consumers will disagree about which bytes are valid.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and implementation sources: Zephyr ring buffer docs at https://docs.zephyrproject.org/latest/kernel/data_structures/ring_buffers.html and Boost circular_buffer docs at https://www.boost.org/libs/circular_buffer. Study Queue, Double-Ended Queue (Deque), Lock-Free Queue, NIC RX Ring & NAPI Poll Case Study, io_uring Submission & Completion Rings, eBPF Ring Buffer Telemetry Case Study, Work-Stealing Deque Scheduler, Backpressure & Flow Control, Sliding Window, LRU Cache, and Web Workers next.',
      ],
    },
  ],
};
