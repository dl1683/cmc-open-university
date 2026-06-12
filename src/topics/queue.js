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
  const queue = []; // index 0 = front

  yield {
    state: sequenceState('queue', queue),
    highlight: {},
    explanation: 'A queue starts empty. New items join at the BACK; items leave from the FRONT — exactly like a line at a store. First come, first served.',
  };

  let counter = 0;
  for (const value of values) {
    queue.push({ id: `q${counter++}`, value });
    yield {
      state: sequenceState('queue', queue),
      highlight: { active: [queue[queue.length - 1].id] },
      explanation: `enqueue(${value}): the new value joins at the back. With a pointer to the tail this is O(1) — no walking required.`,
      invariant: 'Items stand in the exact order they arrived.',
    };
  }

  while (queue.length > 0) {
    const front = queue[0];
    yield {
      state: sequenceState('queue', queue),
      highlight: { removed: [front.id] },
      explanation: `dequeue() removes ${front.value} from the front — it has waited the longest, so it goes first. ${queue.length === 1 ? 'After this the queue is empty, so front and back must both be reset — forgetting that is a classic bug.' : 'Everyone else moves one step closer to the front.'}`,
    };
    queue.shift();
  }

  yield {
    state: sequenceState('queue', queue),
    highlight: {},
    explanation: `Done — values left in the same order they arrived (${values.join(', ')}). Queues preserve order; stacks reverse it. That single difference decides which one you need.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        `A queue is a First-In-First-Out (FIFO) data structure where elements are added at the back and removed from the front. Think of a line at a coffee shop: customers arrive and join the back of the line; the cashier serves whoever is at the front. The first person in line is the first person served. Unlike a stack, a queue respects arrival order.`,
        `A queue has two endpoints: the front (where dequeue happens) and the back (where enqueue happens). All insertion and removal occur at these two fixed points, never in the middle. This constraint makes queues perfect for any system that needs to process requests or tasks in the order they arrive.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Enqueue adds an element to the back of the queue. If you maintain a pointer to the tail, this is a single append operation in O(1) time. Dequeue removes and returns the element at the front. If you track the front pointer, this is also O(1) — just remove the first element.`,
        `A queue is often implemented as a linked list where the head is the front and the tail is the back, or as an array where index 0 is the front and the end is the back. The key is maintaining both front and back pointers so that neither operation requires scanning or shifting. A circular array can optimize space by reusing slots after elements are dequeued, though the basic concept stays the same.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `Enqueue and dequeue are both O(1) operations if you maintain tail and front pointers. Checking if the queue is empty is O(1). Space complexity is O(n) for n elements. As with stacks, there is no searching, no sorting, and no scanning — just front and back access. This makes queues extremely efficient and predictable. However, if you implement a queue naively using an array and repeatedly shift the front element, you will accidentally make dequeue O(n), which defeats the purpose.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Queues model real-world scenarios directly: printer job queues (print jobs are served in order), operating system task scheduling (processes wait for CPU time), breadth-first search in graphs (visit all neighbors before moving deeper), and message brokers like RabbitMQ or Redis that pass messages between services. JavaScript event loops use a queue (microtask queue, macrotask queue) to process callbacks and timers in order. Load balancers use queues to distribute incoming requests to workers. Any system that needs fairness or order preservation uses a queue.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `The most dangerous mistake is implementing dequeue with a shift on an array without also maintaining a front pointer, turning it into O(n). Another error is confusing a queue with a stack — if you need to reverse order, use a stack; if you need to preserve order, use a queue. Be careful with empty queues: forgetting to check if the queue is empty before dequeue can cause crashes or undefined behavior. A subtle bug arises when using an array-based queue with naive shift: performance degrades linearly as the queue grows because you are constantly re-indexing. Using a proper circular buffer or linked list avoids this.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Stack to understand the opposite access pattern (LIFO vs. FIFO). Explore Graph BFS, which uses a queue as its core data structure for level-order traversal. Learn about the JavaScript Event Loop to see queues in action for callback scheduling. Understanding Binary Heap (Priority Queue) will show you how to extend the queue concept with priority ordering, allowing urgent items to move ahead of others.`,
      ],
    },
  ],
};

