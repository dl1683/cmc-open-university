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
        'A queue stores work in arrival order. The rule is FIFO, which means First In, First Out: the oldest item leaves before newer items.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'FIFO queue diagram showing enqueue at the rear and dequeue at the front', caption: 'The FIFO picture is the whole contract: enqueue at the rear, dequeue at the front. Source: Wikimedia Commons, Data Queue.svg, public domain: https://commons.wikimedia.org/wiki/File:Data_Queue.svg' },
        'This exists because many systems need fairness by time. Print jobs, server requests, keyboard events, message brokers, and breadth-first search all need older work to be served before newer work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach in JavaScript is an array. Enqueue with push, dequeue with shift, and the visible order is correct.',
        'This is fine for small queues. It is also easy to teach because the front is index 0 and the rear is the last index.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the shift operation. Removing index 0 forces every remaining element to move left by one slot.',
        'If a queue holds 1,000,000 items and you dequeue all of them with shift, the total movement is about 500 billion element copies. The FIFO behavior is right, but the implementation pays too much.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to move the front pointer instead of moving the data. Dequeue can advance a head index and leave the old slot behind.',
        'A circular array, also called a ring buffer, reuses freed slots when the tail wraps around. The physical array may wrap, but the logical queue order stays FIFO.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A ring buffer keeps an array, a head index, a tail index, and a size or a reserved empty slot. Enqueue writes at tail, then advances tail modulo capacity.',
        'Dequeue reads at head, clears or ignores that slot, then advances head modulo capacity. A linked-list queue uses head and tail pointers instead of indexes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is arrival order. Enqueue places the new item after every live item, and dequeue removes only the oldest live item.',
        'For breadth-first search, this proves level order. Nodes at distance d enter before nodes at distance d + 1, so every shorter path is processed first.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With a ring buffer, enqueue, dequeue, and peek are O(1). Space is O(n) for n live elements, plus unused capacity in the array.',
        'Resizing costs O(n) when it happens, but doubling capacity makes the average enqueue O(1) over a long sequence. A linked list gives O(1) worst-case operations but pays one pointer per node and loses cache locality.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Queues power breadth-first search, event loops, request buffers, print spoolers, network packet buffers, task schedulers, and message brokers. The common access pattern is a producer adding work and a consumer serving the oldest work.',
        'They also decouple bursty systems. A producer can enqueue faster than a consumer briefly, as long as the queue has capacity and backpressure rules.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A plain queue has no random access and no priority. If urgent work must jump ahead, use a priority queue; if lookup by id matters, use a hash table beside the queue.',
        'Queues also fail without backpressure. A fast producer and slow consumer can grow an unbounded queue until memory is exhausted.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use a ring buffer of capacity 4 with head = 0 and tail = 0. Enqueue 5 writes arr[0] and moves tail to 1; enqueue 3 writes arr[1] and moves tail to 2.',
        'Dequeue reads arr[0] = 5 and moves head to 1. Enqueue 9 later can reuse arr[0] after tail wraps modulo 4.',
        'No element shifts. The live logical order after those operations is 3, then 9, even if their physical slots are arr[1] and arr[0].',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Knuth, The Art of Computer Programming, Volume 1, and CLRS Chapter 10 for elementary queue implementations. Then study stacks, deques, ring buffers, binary heaps, BFS, event loops, and backpressure.',
      ],
    },
  ],
};
