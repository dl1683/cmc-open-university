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
      heading: `What it is`,
      paragraphs: [
        `A queue is a First-In, First-Out container: the earliest item added is the earliest item removed. The coffee-shop line is the everyday model. New customers join the back, service happens at the front, and nobody cuts ahead unless you change the rules into a priority system. That arrival-order guarantee is the whole abstraction.`,
        `The core operations are enqueue, which adds at the back, dequeue, which removes from the front, and peek, which reads the front item without removing it. Compared with Stack, this structure preserves time order instead of reversing it. Compared with a hash table, it is not about finding an arbitrary key. It is about fair, predictable sequencing: work comes in, waits its turn, and leaves in the same order.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A linked implementation keeps two references: head for the front and tail for the back. Enqueue attaches a new node after tail and moves tail. Dequeue removes head and moves head to the next node. If the last element leaves, both references become null. Linked List makes that pointer story explicit, and it is the reason both operations can be constant time.`,
        `An array implementation needs a little more care. If you store the front at index 0 and call shift on every dequeue, JavaScript must move every remaining element down one slot. That turns dequeue into O(n). A production queue usually stores a head index, or uses a circular buffer where the head and tail wrap around the array. The array may resize occasionally, but ordinary enqueue and dequeue touch only one slot.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `With head and tail tracking, enqueue, dequeue, peek, and isEmpty are O(1). Space is O(n) for n waiting items. A circular buffer often keeps extra capacity, so its physical array may be larger than the number of live elements, but still proportional to n. The important Big-O Growth Rates lesson is that one wrong primitive changes the whole behavior: repeated shift calls can turn a linear workload of n dequeues into O(n^2) element movement.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Graph BFS is the textbook algorithm: visit a node, enqueue its unvisited neighbors, then dequeue the next node at the frontier. That is why breadth-first search finds the fewest-hop path in an unweighted graph. The Event Loop also relies on queue-like scheduling: callbacks, timers, and microtasks wait until the current call stack clears, then run in a defined order. Operating systems use ready queues for processes, printer systems queue jobs, and network servers queue accepted connections before workers handle them.`,
        `In distributed systems, Message Queues turn this idea into infrastructure. A producer adds work, a consumer removes work, and the broker absorbs bursts so services do not have to run at the same speed. Load Balancer designs often put requests into per-worker queues or use queue length as a signal. When strict arrival order is not enough, Binary Heap (Priority Queue) changes the rule so the most urgent item leaves first.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most common bug is accidental O(n) dequeue from array shift. The second is mixing up FIFO with LIFO: if the newest item must run first, you wanted Stack. The third is pretending a queue gives random access. If you scan the waiting line over and over to find a specific item, your design probably wants a hash table plus a separate ordering structure.`,
        `Real systems add policy around the simple abstraction. A queue can grow without bound and exhaust memory if producers outrun consumers. It can also create head-of-line blocking: one slow item at the front delays everything behind it. Production queues usually need backpressure, retries, dead-letter handling, or priorities; the data structure gives order, not a complete reliability protocol.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Stack for the reversed access rule, then Graph BFS to see FIFO order drive an algorithm. Double-Ended Queue (Deque) extends the interface to both ends. The Event Loop, Linux Fair Scheduler Run Queue, and Message Queues show the same scheduling idea in runtimes, operating systems, and distributed systems. Binary Heap (Priority Queue) explains priority scheduling, while the sliding-window technique shows another two-ended pattern where old items leave as new items arrive.`,
      ],
    },
  ],
};
