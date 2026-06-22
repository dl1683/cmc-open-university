// Queue: First In, First Out. Enqueue at the back, dequeue from the front.

import { sequenceState, parseNumberList } from '../core/state.js';

export const topic = {
  id: 'queue',
  title: 'Queue',
  category: 'Data Structures',
  summary: 'Enqueue at the back, dequeue from the front — First In, First Out.',
  controls: [
    { id: 'values', label: 'Enqueue these (in order)', type: 'number-list', defaultValue: '5, 12, 3, 8' },
  ],
  run,
};

export function* run(input) {
  const values = parseNumberList(input.values, { max: 8 });
  const queue = []; // Visualization keeps index 0 as the front; production array queues usually use a head index or ring buffer.

  yield {
    state: sequenceState('queue', queue),
    highlight: {},
    explanation: 'A queue starts empty. New items join at the back, and removal happens at the front, so the oldest waiting item is served first.',
  };

  let counter = 0;
  for (const value of values) {
    queue.push({ id: `q${counter++}`, value });
    yield {
      state: sequenceState('queue', queue),
      highlight: { active: [queue[queue.length - 1].id] },
      explanation: `enqueue(${value}): the new value joins at the back. With a tail pointer or ring-buffer tail index, the queue does not need to walk through older items.`,
      invariant: 'Items stand in the exact order they arrived.',
    };
  }

  while (queue.length > 0) {
    const front = queue[0];
    yield {
      state: sequenceState('queue', queue),
      highlight: { removed: [front.id] },
      explanation: `dequeue() removes ${front.value} from the front because it has waited the longest. ${queue.length === 1 ? 'After the last item leaves, both front and back state must represent empty.' : 'The relative order of everyone else stays unchanged.'}`,
    };
    queue.shift();
  }

  yield {
    state: sequenceState('queue', queue),
    highlight: {},
    explanation: `Done. Values left in arrival order (${values.join(', ')}). Queues preserve order; stacks reverse it, and that difference changes the algorithms they support.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows a horizontal row of boxes. The left end is the front; the right end is the rear. When a value is enqueued, a new box appears at the right. When a value is dequeued, the box at the left disappears.',
        { type: 'callout', text: 'A queue is a contract about time: newer work may wait, but it cannot pass older work unless you choose a different structure.' },
        'A highlighted (active) box is the element just added or about to be removed. After dequeue, the removed box briefly flashes red before it vanishes. The remaining boxes keep their left-to-right order, which is the arrival order.',
        'Think of two invisible pointers: front always marks the next item to leave, and rear always marks where the next arrival will land. Every enqueue moves rear one step right. Every dequeue moves front one step right. The items between front and rear are the live contents of the queue.',

        { type: 'image', src: './assets/gifs/queue.gif', alt: 'Animated walkthrough of the queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.' },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems need first come, first served ordering. Print jobs should print in the order they were submitted. Web server requests should be handled in arrival order so no connection starves. BFS needs to finish all nodes at distance d before expanding nodes at distance d+1. The common thread is fairness: old work must not be skipped by new work.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram showing enqueue at the rear and dequeue at the front', caption: 'The FIFO picture is the whole contract: enqueue at the rear, dequeue at the front. Source: Wikimedia Commons, Data Queue.svg, public domain: https://commons.wikimedia.org/wiki/File:Data_Queue.svg' },
        'A queue gives that rule a data structure. It has three operations: enqueue (add to the rear), dequeue (remove from the front), and peek (read the front without removing it). The contract is FIFO -- First In, First Out. Unlike a stack, which reverses arrival order, a queue preserves it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Use a plain array. Enqueue by pushing to the end -- O(1). Dequeue by shifting from the front -- the built-in shift operation removes index 0 and slides every remaining element one position left.',
        'This works correctly. The FIFO order is maintained. For small queues or infrequent dequeues it is fine. The code is simple and easy to reason about.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Array shift is O(n). Every dequeue copies n-1 elements one slot left. A workload that enqueues n items and then dequeues all of them performs n + (n-1) + (n-2) + ... + 1 = n(n-1)/2 element moves. That is O(n^2) total work for a task that should be O(n).',
        'With 1,000 items, the shift-based queue does roughly 500,000 element moves. With 1,000,000 items, it does roughly 500 billion. The structure is correct but the implementation wastes effort proportional to the square of the input size.',
        'The root cause: the front of an array is a fixed position. Removing it leaves a hole that every remaining element must fill. There is no array operation that removes the first element without shifting everything else.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move the front pointer instead of the data. If the array never shifts, dequeuing simply advances a head index to the next slot. The old slot is not erased -- it is simply skipped on future reads. This turns O(n) dequeue into O(1).',
        'The array becomes a ring: when the tail reaches the end, it wraps back to the beginning. Modular arithmetic (tail = (tail + 1) % capacity) implements the wrap automatically. The head and tail chase each other around the circle, and empty slots get reused.',
        'If the ring ever fills completely (tail catches head), allocate a larger array and copy the live elements once. The resize is O(n) but rare -- it doubles capacity, so the next n operations are free. Amortized across all operations, each enqueue and dequeue costs O(1).',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Circular array (ring buffer): allocate an array of fixed capacity. Maintain a head index and a tail index. Enqueue writes the value at arr[tail] and advances tail = (tail + 1) % capacity. Dequeue reads arr[head] and advances head = (head + 1) % capacity. The modular wrap reuses slots freed by earlier dequeues without shifting anything.',
        'The key invariant: the queue is empty when head == tail, and full when (tail + 1) % capacity == head (one slot is always kept empty to distinguish the two states).',
        'Linked list alternative: each node holds a value and a next pointer. Keep a head pointer (front) and a tail pointer (rear). Enqueue creates a new node, sets tail.next to it, and moves tail forward. Dequeue reads head.value, advances head to head.next, and discards the old node. Both operations are O(1) worst-case, but each node carries the memory cost of an extra pointer.',
        'Both implementations preserve FIFO order. The circular array has better cache locality (elements stay contiguous in memory). The linked list never needs to resize and has no capacity limit.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The FIFO invariant: elements leave the queue in the same order they entered. Enqueue always places the new item after every existing item, so it cannot jump ahead of older work. Dequeue always removes the front item, so the oldest remaining element is always the one that leaves next.',
        'Neither the circular array nor the linked list violates this invariant. The circular array advances head and tail independently -- the modular wrap preserves the logical order even though the physical positions cycle through the buffer. The linked list maintains a chain where each node points to the one that arrived after it.',
        'For BFS, this invariant is the correctness proof. The source node enters at distance 0. Its neighbors enter behind it at distance 1. All distance-1 nodes are dequeued before any distance-2 node, because enqueue appends to the rear and can never insert ahead of items already in the queue. Level order is guaranteed by FIFO.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Enqueue: O(1). Dequeue: O(1). Peek: O(1). Space: O(n) for n live elements.',
        'The circular array uses amortized O(1) for enqueue when resizing is needed -- the resize copies n elements, but it doubles the capacity, so the next n enqueues are free. Averaged over a sequence of operations, each enqueue costs O(1). The linked list is O(1) worst-case for both operations but pays a pointer-sized memory overhead per node.',
        'Contrast with the naive array approach: O(1) enqueue but O(n) dequeue. Over n dequeues, the total cost is O(n^2). Doubling the input quadruples the total shift work. The circular array avoids this entirely -- doubling the input merely doubles the total work, not the square of it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'BFS graph traversal: enqueue the source, then repeatedly dequeue a node and enqueue its unvisited neighbors. FIFO order guarantees the shortest-hop path in an unweighted graph.',
        'OS process scheduling: the ready queue holds processes waiting for CPU time. The scheduler dequeues the next process, gives it a time slice, and re-enqueues it at the rear. This is round-robin scheduling -- every process gets CPU time in turn.',
        'Print spoolers: jobs are printed in submission order. The queue absorbs bursts when multiple users submit jobs faster than the printer can finish them.',
        'Web server request queuing: incoming connections wait in a queue until a worker thread is free. The queue decouples the arrival rate from the processing rate so threads do not need to create new connections on demand.',
        'Message brokers (Kafka, RabbitMQ, SQS): producers enqueue messages, consumers dequeue them. The broker buffers bursts so producers and consumers do not have to run at the same speed.',
        'I/O and network buffering: keyboard input, network packets, and disk I/O requests are buffered in FIFO queues so the processor handles them in arrival order without dropping data during speed bursts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'No random access. You cannot read the third element without dequeuing the first two. If you need lookup by key, use a hash table.',
        'No priority ordering. A queue always serves the oldest item, even if a newer item is more urgent. When urgency matters, use a priority queue backed by a binary heap.',
        'Fixed-size circular buffers need a resize strategy. If the buffer is full and you cannot allocate more memory, you must either block the producer, drop the new item, or overwrite the oldest item. Each policy has consequences: blocking risks deadlock, dropping loses data, overwriting loses history.',
        'Head-of-line blocking. If the front item takes a long time to process, every item behind it waits. FIFO is fair by arrival time, but unfair by service time when tasks vary widely in cost.',
        'Unbounded growth. Without backpressure, a queue between a fast producer and a slow consumer grows until memory is exhausted. Production systems need queue-depth limits and rejection policies.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with an empty ring buffer of capacity 4. head = 0, tail = 0. The queue is empty.',
        'enqueue(5): write 5 at arr[0], tail becomes 1. Queue: [5].',
        'enqueue(3): write 3 at arr[1], tail becomes 2. Queue: [5, 3].',
        'enqueue(8): write 8 at arr[2], tail becomes 3. Queue: [5, 3, 8].',
        'enqueue(1): write 1 at arr[3], tail becomes 0 (wrapped). Queue: [5, 3, 8, 1]. Buffer is now full.',
        'dequeue(): read arr[0] = 5, head becomes 1. Queue: [3, 8, 1].',
        'dequeue(): read arr[1] = 3, head becomes 2. Queue: [8, 1].',
        'enqueue(9): write 9 at arr[0] (reused the freed slot), tail becomes 1. Queue: [9, 8, 1].',
        'The slots wrap around without any element copying. head and tail chase each other endlessly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Knuth, The Art of Computer Programming, Vol. 1 Section 2.2.1 -- queues as a fundamental data type. Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 10 -- elementary data structures including queue implementation.',
        'Study Stack for the reversed-order counterpart (LIFO). Study Binary Heap (Priority Queue) for urgency-based dequeuing instead of arrival-based. Study Ring Buffer for the circular array implementation in detail. Study Graph BFS to see how FIFO order drives a shortest-path algorithm. Study Double-Ended Queue (Deque) for the extension that allows insertion and removal at both ends.',
      ],
    },
  ],
};
