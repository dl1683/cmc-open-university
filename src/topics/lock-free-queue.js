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
    explanation: 'The Michael-Scott queue is a linked FIFO queue. Head points at a dummy node before the first real item; tail points near the last node. Operations use compare-and-swap instead of a mutex.',
  };

  yield {
    state: queueGraph('Producer links a new node with CAS(tail.next, null, C)', 'b', 'dummy'),
    highlight: { active: ['p1', 'b', 'c', 'e-p1-b', 'e-b-c'], compare: ['p2'] },
    explanation: 'Enqueue first tries to link the new node at the observed tail.next. If another producer wins the same CAS, this producer rereads the queue and tries again. No global lock is held.',
    invariant: 'The linearization point for enqueue is the successful CAS that links the new node.',
  };

  yield {
    state: queueGraph('Tail can lag behind the true last node', 'b', 'dummy'),
    highlight: { active: ['b', 'c', 'e-b-c'], compare: ['p2', 'e-p2-c'] },
    explanation: 'After C is linked, tail may still point at B. That is allowed. The queue contents are already correct because B.next points at C. Tail is an optimization pointer, not the source of truth.',
  };

  yield {
    state: queueGraph('Another thread helps by advancing tail', 'c', 'dummy'),
    highlight: { found: ['p2', 'c', 'e-p2-c'], compare: ['b'] },
    explanation: 'If a thread notices tail.next is not null, it helps finish the previous enqueue by moving tail forward. Helping is the progress mechanism: stalled operations leave enough evidence for other threads to complete the shared structure repair.',
  };
}

function* dequeueAndMemory() {
  yield {
    state: queueGraph('Dequeue reads head, next, and tail', 'c', 'dummy'),
    highlight: { active: ['consumer', 'dummy', 'a', 'e-cons-d', 'e-d-a'], compare: ['c'] },
    explanation: 'Dequeue reads head and head.next. If next exists, the first real item is next. The consumer returns A only after a successful CAS that advances head from dummy to A.',
    invariant: 'The linearization point for dequeue is the successful CAS that advances head.',
  };

  yield {
    state: queueGraph('After CAS(head, dummy, A), A becomes the new dummy', 'c', 'a'),
    highlight: { found: ['a'], removed: ['dummy'], active: ['consumer'] },
    explanation: 'The returned value comes from the node after old head, but the queue keeps a dummy-at-head shape. The old dummy can be reclaimed only when no thread can still read it.',
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
    explanation: 'In garbage-collected runtimes, reclamation is much easier. In C or C++, freeing nodes safely is a separate data-structure problem. Lock-free does not mean simple.',
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
    explanation: 'The Michael-Scott queue is lock-free, not wait-free. Under contention, a particular thread can retry many times, but system-wide progress continues.',
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
      heading: 'What it is',
      paragraphs: [
        'A lock-free queue is a concurrent FIFO queue where operations coordinate with atomic compare-and-swap rather than a single mutex. The classic Michael-Scott queue uses a linked list, a dummy head node, and head/tail pointers.',
        'It matters because queues are the connective tissue of runtimes, schedulers, actors, work pools, and message-passing systems. At high contention, the difference between one global lock and helping-based CAS can shape latency and throughput.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Enqueue allocates a new node, reads tail, and tries CAS on tail.next from null to the new node. That successful link is the enqueue linearization point. Tail may lag; later threads can help advance it.',
        'Dequeue reads head and head.next. If the queue is nonempty, it tries CAS on head to move it to next. The returned value is the node after the old dummy. This preserves the dummy-node invariant and keeps empty/nonempty cases manageable.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Successful operations are O(1), but contention can cause retries. The hard engineering problems are ABA avoidance, memory reclamation, and language memory ordering. In garbage-collected languages, safe node reclamation is much easier; in manual-memory languages it requires epochs, hazard pointers, reference counting, or related schemes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Lock-free queues and close relatives appear in Java concurrent collections, actor runtimes, task schedulers, networking paths, telemetry pipelines, and high-throughput producer/consumer systems. Many production designs still shard queues or use bounded ring buffers because allocation and cache traffic can dominate.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Lock-free does not mean wait-free, starvation-free, allocation-free, or faster in every workload. A simple lock can beat a lock-free structure at low contention. The algorithmic proof also assumes the memory model and reclamation strategy are correct.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Michael and Scott paper PDF at https://www.cs.rochester.edu/~scott/papers/1996_PODC_queues.pdf and ACM DOI at https://dl.acm.org/doi/10.1145/248052.248106. Study Linearizability History Checker, ABA Tagged Pointer Stack, Nonblocking Progress Guarantees, Hazard Pointers & Epoch Reclamation, Futex Wait Queue, MCS Queue Lock, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
