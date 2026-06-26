// Lock-free queue: the Michael-Scott linked queue as an animation of CAS,
// helping, dummy nodes, and the gap between lock-free progress and easy code.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'lock-free-queue',
  title: 'Lock-Free Queue',
  category: 'Data Structures',
  summary: 'The Michael-Scott queue: producers and consumers move head/tail with CAS, helping stalled operations finish.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['enqueue race', 'dequeue and memory'], defaultValue: 'enqueue race' },
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

function queueGraph(title, tailAt = 'b', headAt = 'dummy') {
  const tailNote = (id) => (tailAt === id ? 'TAIL' : '');
  const headNote = (id) => (headAt === id ? 'HEAD' : '');
  return graphState({
    nodes: [
      { id: 'dummy', label: 'dummy', x: 1.0, y: 4.0, note: headNote('dummy') },
      { id: 'a', label: 'A', x: 3.1, y: 4.0, note: headNote('a') || tailNote('a') },
      { id: 'b', label: 'B', x: 5.2, y: 4.0, note: tailNote('b') },
      { id: 'c', label: 'C', x: 7.3, y: 4.0, note: tailNote('c') },
      { id: 'p1', label: 'producer 1', x: 4.1, y: 1.3, note: 'CAS next' },
      { id: 'p2', label: 'producer 2', x: 6.2, y: 1.3, note: 'helps tail' },
      { id: 'consumer', label: 'consumer', x: 2.1, y: 6.8, note: 'CAS head' },
    ],
    edges: [
      { id: 'e-d-a', from: 'dummy', to: 'a', weight: 'next' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'next' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: tailAt === 'b' ? 'new next' : 'next' },
      { id: 'e-p1-b', from: 'p1', to: 'b', weight: 'read tail' },
      { id: 'e-p2-c', from: 'p2', to: 'c', weight: 'advance' },
      { id: 'e-cons-d', from: 'consumer', to: 'dummy', weight: 'read head' },
    ],
  }, { title });
}

function* enqueueRace() {
  yield {
    state: queueGraph('A lock-free queue has a dummy node, head, and tail', 'b', 'dummy'),
    highlight: { active: ['dummy', 'b'], found: ['e-d-a', 'e-a-b'] },
    explanation: `The Michael-Scott ${topic.title} is a linked FIFO queue. Head points at a dummy node before the first real item; tail points near the last node. Operations use compare-and-swap instead of a mutex.`,
  };

  yield {
    state: queueGraph('Producer links a new node with CAS(tail.next, null, C)', 'b', 'dummy'),
    highlight: { active: ['p1', 'b', 'c', 'e-p1-b', 'e-b-c'], compare: ['p2'] },
    explanation: `Enqueue first tries to link the new node at the observed tail.next. If another producer wins the same CAS, this producer rereads the ${topic.title} and tries again. No global lock is held.`,
    invariant: `The linearization point for enqueue in a ${topic.category.toLowerCase()} like this is the successful CAS that links the new node.`,
  };

  yield {
    state: queueGraph('Tail can lag behind the true last node', 'b', 'dummy'),
    highlight: { active: ['b', 'c', 'e-b-c'], compare: ['p2', 'e-p2-c'] },
    explanation: `After C is linked, tail may still point at B. That is allowed in the ${topic.title}. The queue contents are already correct because B.next points at C. Tail is an optimization pointer, not the source of truth.`,
  };

  yield {
    state: queueGraph('Another thread helps by advancing tail', 'c', 'dummy'),
    highlight: { found: ['p2', 'c', 'e-p2-c'], compare: ['b'] },
    explanation: `If a thread notices tail.next is not null, it helps finish the previous enqueue by advancing tail to C. Helping is the progress mechanism in a ${topic.title}: stalled operations leave enough evidence for other threads to complete the shared structure repair.`,
  };
}

function* dequeueAndMemory() {
  yield {
    state: queueGraph('Dequeue reads head, next, and tail', 'c', 'dummy'),
    highlight: { active: ['consumer', 'dummy', 'a', 'e-cons-d', 'e-d-a'], compare: ['c'] },
    explanation: `Dequeue reads head and head.next in the ${topic.title}. If next exists, the first real item is next. The consumer returns A only after a successful CAS that advances head from dummy to A.`,
    invariant: `The linearization point for dequeue is the successful CAS that advances head â€” this is the ${topic.category.toLowerCase()} correctness anchor.`,
  };

  yield {
    state: queueGraph('After CAS(head, dummy, A), A becomes the new dummy', 'c', 'a'),
    highlight: { found: ['a'], removed: ['dummy'], active: ['consumer'] },
    explanation: `The returned value comes from the node after old head, but the ${topic.title} keeps a dummy-at-head shape. The old dummy can be reclaimed only when no thread can still read it.`,
  };

  yield {
    state: labelMatrix(
      'The queue algorithm is not the whole implementation',
      [
        { id: 'cas', label: 'CAS loops' },
        { id: 'aba', label: 'ABA problem' },
        { id: 'reclaim', label: 'memory reclamation' },
        { id: 'ordering', label: 'memory ordering' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['retry under contention', 'backoff or better sharding'],
        ['pointer value reused', 'tags/hazard discipline'],
        ['node freed too early', 'GC, epochs, hazard pointers'],
        ['writes seen out of order', 'acquire/release rules'],
      ],
    ),
    highlight: { active: ['reclaim:risk', 'ordering:risk'], compare: ['cas:risk'] },
    explanation: `In garbage-collected runtimes, reclamation for a ${topic.title} is much easier. In C or C++, freeing nodes safely is a separate ${topic.category.toLowerCase()} problem. Lock-free does not mean simple.`,
  };

  yield {
    state: labelMatrix(
      'Progress guarantees',
      [
        { id: 'blocking', label: 'blocking lock' },
        { id: 'lockfree', label: 'lock-free' },
        { id: 'waitfree', label: 'wait-free' },
        { id: 'single', label: 'single-thread queue' },
      ],
      [
        { id: 'promise', label: 'promise' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['owner can block everyone', 'simple critical section'],
        ['some thread completes', 'CAS retries'],
        ['every thread completes in bound', 'harder algorithm'],
        ['no contention', 'fast but unsafe shared'],
      ],
    ),
    highlight: { found: ['lockfree:promise'], compare: ['blocking:promise', 'waitfree:cost'] },
    explanation: `The Michael-Scott ${topic.title} is lock-free, not wait-free. Under contention, a particular thread can retry many times, but system-wide progress continues â€” that is the ${topic.id} guarantee.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'enqueue race') yield* enqueueRace();
  else if (view === 'dequeue and memory') yield* dequeueAndMemory();
  else throw new InputError('Pick a lock-free queue view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read nodes as linked-list cells and arrows as next pointers. Head points to a dummy node, while tail points near the append end and may temporarily lag behind. Active highlight marks the pointer a thread is trying to change with compare-and-swap, also called CAS.',
        {type: 'callout', text: "A lock-free queue publishes progress through one winning CAS, then leaves enough structure for other threads to help cleanup."},
        {type: 'image', src: './assets/gifs/lock-free-queue.gif', alt: 'Animated walkthrough of the lock free queue visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Concurrent queues are handoff points between producers and consumers. Schedulers, work pools, actor runtimes, networking paths, and telemetry pipelines all need many threads to add and remove work safely. A lock-free queue exists for cases where one paused lock holder should not stop the whole handoff path.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Singly linked list diagram with nodes pointing to the next node', caption: 'The Michael-Scott queue is a linked structure; FIFO correctness comes from the next chain, not from the tail shortcut. Source: Wikimedia Commons, Lasindi, public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a queue protected by one mutex. Enqueue locks, appends, unlocks; dequeue locks, removes, unlocks. The proof is easy because one thread owns the structure during each mutation.',
        'That approach is often correct in production. It is readable, testable, and pairs well with condition variables when consumers should sleep. The problem appears only when contention, pauses, or scheduler behavior make lock ownership itself the bottleneck.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the lock owner. If a thread is descheduled while holding the mutex, every other producer and consumer waits even if the remaining work is one pointer update. Under heavy contention, the cache line holding the lock can bounce across cores and dominate latency.',
        'Removing the lock does not remove coordination. It moves coordination into atomic CAS operations and invariants that remain readable during half-finished operations. Other threads must be able to see what happened and help complete shared cleanup.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Each queue operation has one pointer change that makes it logically happen. Enqueue becomes real when CAS changes the old tail next pointer from null to the new node. Dequeue becomes real when CAS advances head from the old dummy node to the first real node.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die showing compute regions', caption: 'CAS is a hardware-backed coordination primitive; the data-structure proof depends on which atomic write wins at the cache-coherence boundary. Source: Wikimedia Commons, KL and Intel, public domain.'},
        'The invariant is reachability through next pointers. Starting at head and following next gives the FIFO contents. Tail can lag because it is a shortcut, not the source of truth.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Enqueue allocates a node with next set to null, reads tail, and reads tail.next. If tail.next is null, it tries CAS(tail.next, null, node). If that CAS wins, the node is in the queue, even if tail still points at the old node.',
        'If tail.next is not null, another enqueue already linked a node and left tail behind. The current thread tries to advance tail and loops. Dequeue reads head and head.next, returns the value in head.next only after CAS moves head forward, and keeps the new head as the dummy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof uses linearizability, which means each operation appears to take effect at one instant between call and return. For enqueue, that instant is the successful CAS linking the new node into the next chain. For dequeue, it is the successful CAS advancing head.',
        'FIFO order follows from the next chain. Producers can only attach a new node after an observed last node whose next is null, so later nodes appear after earlier nodes. Consumers remove from head.next, and only one CAS from the same old head can win, so two consumers cannot return the same item.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'In the uncontended case, enqueue and dequeue are O(1). Under contention, a particular thread may retry many times, but a failed CAS usually means another thread made progress. That is lock-free progress: system-wide completion continues, but individual operations are not bounded like wait-free algorithms.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state diagram with transitions', caption: 'Thread pauses and state transitions are exactly why lock-free progress is valuable: a stalled participant should not own the whole queue. Source: Wikimedia Commons, CC BY-SA 3.0.'},
        'The real complexity is memory safety. Native implementations need ABA protection, safe reclamation, and acquire-release memory ordering. In a garbage-collected runtime, reclamation is easier, but atomic visibility rules still matter.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lock-free queues are useful in thread pools, actor mailboxes, runtime schedulers, packet processing, telemetry ingestion, and concurrent libraries. They fit hot handoff paths where operations are short and a paused participant should not hold everyone else hostage. They are most attractive when contention is measured rather than assumed.',
        'They also appear as building blocks under higher-level queues. A runtime may wrap a lock-free queue with backpressure, sleeping, metrics, or bounded capacity. The queue solves the shared FIFO mutation, not the whole flow-control problem.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Lock-free does not automatically mean faster. At low contention, a mutex can beat CAS loops because it does less bookkeeping. A bounded ring buffer can beat a linked queue when capacity is known and cache locality matters.',
        'It fails badly when memory reclamation is wrong. A node freed while another thread still holds a pointer can corrupt the structure, and ABA can make CAS accept a reused pointer value. The algorithm proof assumes the memory model and reclamation discipline preserve the objects being compared.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with dummy -> A -> B, head at dummy, and tail at B. Producer P wants to enqueue C, reads tail = B, sees B.next = null, and wins CAS(B.next, null, C). At that instant, the FIFO order is A, B, C even if tail still says B.',
        'Producer Q arrives before P moves tail. Q reads tail = B and sees B.next = C, so it tries CAS(tail, B, C) to help cleanup. A consumer reads head = dummy and next = A, then wins CAS(head, dummy, A) and returns A; if another consumer had won first, this CAS would fail and force a reread.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Michael and Scott, Simple, Fast, and Practical Non-Blocking and Blocking Concurrent Queue Algorithms. Then study a production implementation in the language you use, because memory reclamation and memory ordering are where many bugs live.',
        'Study linearizability for the proof method, ABA tagged pointers for pointer reuse, hazard pointers and epochs for reclamation, MCS locks for a blocking contrast, and backpressure for queue systems. The next exercise is to mark the exact linearization point in one enqueue and one dequeue trace.',
      ],
    },
  ],
};
