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
  const capacity = slots.length;

  {
    const head = 0, tail = 0, count = 0;
    yield {
      state: buffer('Empty ring: head and tail start together', ['', '', '', '', '', '', '', ''], head, tail, count),
      highlight: { active: ['role:s0'], found: ['state:s0', 'state:s1', 'state:s2', 'state:s3'] },
      explanation: `A ring buffer is a fixed array of ${capacity} slots plus head, tail, and usually a count or full flag. Head=${head} and tail=${tail} are equal when empty, so metadata must say what that equality means.`,
    };
  }

  {
    const head = 0, tail = 3, count = 3;
    yield {
      state: buffer('Enqueue writes at tail, then advances tail', ['A', 'B', 'C', '', '', '', '', ''], head, tail, count),
      highlight: { active: ['value:s0', 'value:s1', 'value:s2'], found: ['role:s3'] },
      explanation: `Enqueue stores at tail=${tail} and moves tail = (${tail} + 1) mod ${capacity}. Nothing shifts. The oldest item stays at head=${head}, and the next free slot is tail. ${count} items are now live.`,
      invariant: `All movement is index movement; the ${capacity}-slot array contents stay in place.`,
    };
  }

  {
    const head = 2, tail = 3, count = 1;
    yield {
      state: buffer('Dequeue reads at head, then advances head', ['A', 'B', 'C', '', '', '', '', ''], head, tail, count),
      highlight: { removed: ['value:s0', 'value:s1'], active: ['role:s2'], found: ['role:s3'] },
      explanation: `Dequeue reads from head=${head} and moves head forward. Only ${count} item remains between head=${head} and tail=${tail}. The old bytes may still sit in memory, but they are outside the logical queue.`,
    };
  }

  {
    const head = 2, tail = 2, count = 6;
    const freeSlots = capacity - count;
    yield {
      state: buffer('Wraparound reuses the front of the array', ['G', 'H', 'C', 'D', 'E', 'F', '', ''], head, tail, count),
      highlight: { active: ['value:s3', 'value:s4', 'value:s5', 'value:s0', 'value:s1'], found: ['role:s2'] },
      explanation: `When tail reaches slot ${capacity - 1}, it wraps to slot 0. ${count} of ${capacity} slots are occupied (${freeSlots} free). Logical order crosses the array boundary; the queue is C, D, E, F, G, H even though the bytes sit in two chunks.`,
    };
  }
}

function* streamingPolicy() {
  const capacity = slots.length;
  const policyCount = 4;

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
    explanation: `When all ${capacity} slots are occupied, a full ring buffer forces a policy decision. ${policyCount} options exist: reject, overwrite, block, or grow, but each choice means something different for data loss, latency, and memory.`,
  };

  {
    const apiStyles = 2;
    const directions = 2;
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
      explanation: `Zero-copy claim APIs let a producer or consumer use the ${capacity}-slot internal array directly. ${apiStyles} styles (copy vs claim) times ${directions} directions (put vs get) gives ${apiStyles * directions} combinations. Near the physical end, one logical write may need two claims because no contiguous slice crosses the wrap.`,
    };
  }

  {
    const concurrencyShapes = 4;
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
      explanation: `${concurrencyShapes} concurrency shapes are shown. The easy case is SPSC: one producer and one consumer update different indices, needing only memory barriers. Multiple producers or consumers share index writes, so they need locks or a careful atomic protocol.`,
    };
  }

  {
    const head = 3, tail = 3, count = capacity;
    yield {
      state: buffer('Final frame: bounded memory, moving indices', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], head, tail, count),
      highlight: { active: ['role:s3'], found: ['value:s0', 'value:s7'] },
      explanation: `A ring buffer is best understood as ${capacity} slots of bounded memory plus moving ownership. Here head=${head} and tail=${tail} with ${count} items live: the buffer is completely full. The bytes do not march; head and tail redefine which bytes are live.`,
    };
  }
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
        'The animation shows a fixed-size array with two indexes. Head names the slot that will be read next, tail names the slot that will be written next, and size tells how many slots are live.',
        {type: 'callout', text: 'A ring buffer makes queue motion cheap by moving ownership indexes instead of moving stored bytes.'},
        'Active cells show the slot being read or written. Found cells hold live data, while stale cells may still contain old bytes but are outside the logical queue.',
        'The safe inference is that logical order follows head, not physical slot zero. When tail wraps from the last slot to slot zero, the queue did not move; only the next write position changed.',
        {type: 'image', src: './assets/gifs/ring-buffer.gif', alt: 'Animated walkthrough of the ring buffer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A buffer is temporary storage between a producer and a consumer. Audio hardware produces samples, network cards produce packets, and logging systems produce events that another part of the system must drain.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Circular_buffer.svg/250px-Circular_buffer.svg.png', alt: 'Circular buffer shown as a ring of slots', caption: 'The ring drawing captures the logical idea: a fixed array behaves as if its ends connect. Source: https://commons.wikimedia.org/wiki/File:Circular_buffer.svg.'},
        'The constraint is steady motion under bounded memory. A ring buffer allocates once, reuses the same slots, and makes each push or pop change indexes instead of moving stored values.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A plain array queue is the first idea. Append new items at the end, remove old items from the front, and keep the oldest item at index zero.',
        'That works for small queues because the code is simple and the logical order is visible. The cost is hidden in removal: after removing the front item, every remaining item shifts left.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that front removal does work proportional to the queue length. If 10,000 samples are waiting, one dequeue can copy 9,999 values even though only one sample was consumed.',
        'A linked list avoids shifting but pays for allocation and pointer chasing. On a hot producer-consumer path, scattered nodes waste cache locality and make throughput depend on the allocator.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Logical order is a contract, not a memory address. The oldest item is wherever head points, and the newest item is before tail in circular order.',
        'Modulo arithmetic turns a fixed array into a cycle. Advancing an index means (index + 1) % capacity, so the slot after the physical end is slot zero.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The structure stores an array, a head index, a tail index, and either a size counter or one deliberately unused slot. Enqueue writes at tail, advances tail, and increases size; dequeue reads at head, advances head, and decreases size.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Circular_buffer_-_XX123XX_with_pointers.svg/250px-Circular_buffer_-_XX123XX_with_pointers.svg.png', alt: 'Linear view of a circular buffer with read and write pointers', caption: 'The physical view is still linear memory; read and write pointers provide the circular interpretation. Source: https://commons.wikimedia.org/wiki/File:Circular_buffer_-_XX123XX_with_pointers.svg.'},
        'Full and empty need a separate rule because head can equal tail in both states. A size counter distinguishes them directly, while the one-empty-slot convention declares full when advancing tail would hit head.',
        'Many implementations choose a power-of-two capacity. Then wrapping can use index & (capacity - 1) instead of division, which matters in very tight loops.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the live queue is exactly size slots starting at head in circular order. Enqueue adds one item at the first free slot after the live range, and dequeue removes the first live slot.',
        'Because neither operation changes the relative order of the remaining live slots, the structure implements first-in, first-out behavior. Stale memory does not matter because membership in the queue is decided by head, tail, and size, not by old bytes left in an array cell.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Push and pop are O(1). Doubling the number of processed items doubles the number of index updates, but it does not increase the work per operation.',
        'Space is O(capacity), fixed at allocation time. If capacity is 1,024 slots and each item is 16 bytes, the data area is 16 KB plus a few indexes.',
        'The behavior cost is overflow policy. A full ring must reject new data, overwrite old data, block the producer, or grow into a different structure, and each choice changes system behavior under load.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Ring buffers are common in audio callbacks because allocation and shifting are too expensive while samples arrive at a fixed rate. The producer writes incoming samples and the consumer reads blocks for processing.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation through a small network', caption: 'Network and device queues are natural ring-buffer workloads: packets arrive steadily and consumers drain bounded slots. Source: https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.'},
        'Network drivers use descriptor rings for receive and transmit queues. Kernel FIFOs, telemetry buffers, bounded undo histories, and sliding-window algorithms use the same idea when recent items matter more than unbounded history.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A ring buffer is poor when the required capacity is unknown and overflow cannot be tolerated. A dynamically growing deque may be better when memory can grow with demand.',
        'Concurrency is another failure point. Single-producer single-consumer rings can be lock-free with careful memory ordering, but multiple producers or consumers need stronger coordination.',
        'It also does not support cheap insertion or deletion in the middle. The structure is a queue-shaped buffer, not a general sequence container.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use capacity 5, head 0, tail 0, size 0. Enqueue A, B, C writes slots 0, 1, 2, then tail becomes 3 and size becomes 3.',
        'Dequeue twice reads A at slot 0 and B at slot 1. Head becomes 2, tail stays 3, and C is now the oldest item even though it is physically at slot 2.',
        'Enqueue D, E, F writes slots 3, 4, then wraps tail to slot 0 and writes F there. The logical order is C, D, E, F, but the physical array is F, old B, C, D, E; head and size define the truth.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: classic circular-buffer descriptions in operating-system and embedded-systems texts; Linux kfifo documentation and source; io_uring documentation for submission and completion ring design.',
        'Study next by workload. Read Queue for the abstract contract, Deque for growable two-ended queues, Lock-Free Queue for concurrency, and Sliding Window for algorithms that use a ring-shaped recent history.',
      ],
    },
  ],
};
