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
      heading: `Why this exists`,
      paragraphs: [
        `Queues exist for work that must keep arrival order. Requests, tasks, packets, print jobs, and graph-frontier nodes often need the oldest waiting item handled next. The structure gives that rule a name: First In, First Out.`,
        `The core operations are enqueue, which adds at the back, dequeue, which removes from the front, and peek, which reads the front without removing it. Compared with Stack, a queue preserves time order instead of reversing it. Compared with Hash Table, it is not about finding an arbitrary key. It is about sequencing.`,
        `That makes queues a fairness primitive as much as a storage primitive. If work arrives over time and the system must not let new work cut in front of old work, FIFO order is the simplest contract you can offer.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The obvious approach is an array where you push new items at the end and shift old items from the front. That matches the idea, but it can be slow in JavaScript because shift may move every remaining element down one index.`,
        `The wall is repeated removal. A workload with n enqueues and n dequeues should be linear, but repeated front-shifting can turn it into O(n^2) element movement. A real queue keeps a front pointer, a head index, or a circular buffer so dequeue does not move the rest of the line.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The core insight is that order and storage position are different. The oldest item is "front" because the queue's metadata says so, not because every removal physically shifts memory. Move the front pointer instead of moving the data.`,
        `FIFO is also a correctness rule. In Graph BFS, all nodes at distance d must leave the queue before nodes at distance d + 1. If you replace the queue with a stack, the traversal order changes and the shortest-path guarantee disappears.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `Watch the front and back as two different jobs. The back accepts new work. The front serves old work. Nothing in the middle moves because the queue's metadata, not the physical array index, decides which item is next.`,
        `The animation is small, but it is teaching the same rule that makes breadth-first search correct. Newer items wait behind older items. When an item leaves, the relative order of every remaining item is unchanged.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A linked implementation keeps two references: head for the front and tail for the back. Enqueue attaches a new node after tail and moves tail. Dequeue removes head and moves head to the next node. If the last item leaves, both references become null. Linked List makes that pointer story explicit.`,
        `An array implementation usually stores a head index or uses a Ring Buffer. Enqueue writes at tail. Dequeue reads at head and advances head. The array may resize occasionally, but ordinary enqueue and dequeue touch only one slot.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Correctness comes from the FIFO invariant: items in the queue appear in the same relative order they were enqueued. Enqueue adds after every existing item, so it cannot pass older work. Dequeue removes only the front, so the oldest remaining item leaves next.`,
        `For BFS, that invariant becomes a proof. The start node enters first at distance 0. Its neighbors enter behind it at distance 1. Nodes at distance 1 are all dequeued before nodes they enqueue at distance 2. Level order is preserved because the queue never lets newer, deeper work jump ahead.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `With head and tail tracking, enqueue, dequeue, peek, and isEmpty are O(1). Space is O(n) for n waiting items. A circular buffer often keeps extra capacity, so its physical array may be larger than the number of live elements, but still proportional to n.`,
        `The important Big-O Growth Rates lesson is that one wrong primitive changes the whole behavior: repeated shift calls can turn a linear workload of n dequeues into O(n^2) element movement. The systems tradeoff is capacity policy. An unbounded queue can absorb bursts but can also exhaust memory. A bounded queue needs rejection, blocking, or backpressure.`,
        `There is also a latency tradeoff. A queue smooths bursts by letting producers keep working while consumers catch up, but queued work waits. If the queue grows, average response time grows even when throughput looks fine. That is why production dashboards track queue depth and age, not only requests per second.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Graph BFS is the textbook algorithm: visit a node, enqueue its unvisited neighbors, then dequeue the next node at the frontier. That is why breadth-first search finds the fewest-hop path in an unweighted graph. The Event Loop also relies on queue-like scheduling: callbacks, timers, and microtasks wait until the current call stack clears, then run in a defined order. Operating systems use ready queues for processes, printer systems queue jobs, and network servers queue accepted connections before workers handle them.`,
        `In distributed systems, Message Queues turn this idea into infrastructure. A producer adds work, a consumer removes work, and the broker absorbs bursts so services do not have to run at the same speed. Load Balancer designs often put requests into per-worker queues or use queue length as a signal. When strict arrival order is not enough, Binary Heap (Priority Queue) changes the rule so the most urgent item leaves first.`,
        `Queues are especially strong at boundaries. They separate a fast producer from a slow consumer, a network interrupt from application code, or a UI event from the function that handles it. The boundary makes behavior easier to reason about because work crosses it in one direction and leaves in a known order.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Queues fail when the newest item must run first, which is Stack territory, or when the highest-priority item must run first, which points to Binary Heap (Priority Queue). They also fail as lookup structures. If you scan the waiting line over and over to find a specific item, your design probably wants a hash table plus a separate ordering structure.`,
        `Real systems add policy around the simple abstraction. A queue can grow without bound and exhaust memory if producers outrun consumers. It can also create head-of-line blocking: one slow item at the front delays everything behind it. Production queues usually need backpressure, retries, dead-letter handling, or priorities; the data structure gives order, not a complete reliability protocol.`,
        `FIFO can also be unfair when work sizes vary. A tiny task behind a huge task waits even if it could finish quickly. Schedulers often move beyond pure FIFO because real workloads care about deadlines, priorities, throughput, tail latency, and starvation. Queue is the baseline; scheduler policy decides whether FIFO is enough.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `Graph BFS is the cleanest complete case. Start with the source node in the queue. Dequeue a node, visit each unvisited neighbor, mark it, and enqueue it behind the current frontier. Because the queue preserves arrival order, every distance-1 node finishes before any distance-2 node expands.`,
        `A stack would chase one path deeply and might reach a far node before a near node. A priority queue would be useful for weighted shortest paths, but BFS on an unweighted graph only needs FIFO. The queue is exactly the structure that matches the proof.`,
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
