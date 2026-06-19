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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Lock-Free Queue. The Michael-Scott queue: producers and consumers move head/tail with CAS, helping stalled operations finish..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Concurrent queues are the handoff points inside schedulers, actor runtimes, work pools, networking stacks, telemetry pipelines, and producer-consumer systems. One set of threads produces work. Another set consumes it. The queue has to preserve FIFO order while many participants touch the same head and tail state.',
        'A normal mutex-protected queue is often the right answer. It is small, readable, and easy to test. The Michael-Scott lock-free queue exists for the harder case where a paused lock holder, a slow critical section, or heavy contention should not freeze the entire handoff path. It trades a simple ownership rule for atomic pointer updates and a proof that the shared structure can recover when any one thread stalls.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The baseline queue is a linked list or circular buffer protected by one mutex. Enqueue locks, appends, unlocks. Dequeue locks, removes, unlocks. The proof is clear because one thread owns the whole structure during the mutation. This design also pairs naturally with condition variables when consumers should sleep while the queue is empty.',
        'The wall is the lock owner. If the owner is descheduled inside the critical section, every other thread waits even if the remaining operation is one pointer write. Under high contention, the mutex cache line can bounce across cores. If a lock convoy forms, queue latency starts reflecting scheduler timing more than useful work.',
        'Removing the mutex does not remove coordination. It moves coordination into compare-and-swap loops and data-structure invariants. The queue must be readable while an operation is half-finished, and the evidence left behind by that half-finished operation must be enough for another thread to complete the repair.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make one small pointer change the public truth of each operation. Enqueue publishes a node by changing the observed last node next pointer from null to the new node. Dequeue claims an item by changing head from the old dummy node to the first real node. Those compare-and-swap operations are the moments that make the abstract queue change.',
        'The main invariant is reachability through next pointers. Starting at head and following next links gives the queue contents. Tail is allowed to lag behind the true last node because tail is a performance hint, not the source of truth. If a thread sees a stale tail, it can help advance it and then retry its own operation.',
        'The dummy node keeps the shape stable. Head points to a dummy, and the first real item is at head.next. After a successful dequeue, the returned node becomes the new dummy. That sounds odd at first, but it removes the need to special-case a queue with one item because dequeue is always a head-advance operation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The enqueue race view separates the real publication step from the cleanup step. The edge from B to C is the important event: after the successful CAS on B.next, C is reachable from head and is part of the FIFO order. The tail label may still sit on B for a short time, and that is fine because tail is only a shortcut to the append end.',
        'The helping step shows why the structure remains live after a stalled thread. If one producer links C and pauses before moving tail, another producer can notice that B.next is no longer null and move tail forward. The second producer is not stealing work; it is finishing shared maintenance so the next append has a good starting point.',
        'The dequeue and memory view shows the other half of the lesson. The dummy node is not decoration. It makes the item to return live at head.next while head itself remains a stable pointer for the CAS. The memory table is also part of the model: a lock-free algorithm is not complete until reclamation, ABA defense, and memory ordering are handled.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'Enqueue allocates a node with next set to null. It reads tail and then reads tail.next. If tail.next is null, the thread tries CAS(tail.next, null, node). Success means the item has been inserted. The thread may then try to swing tail to the new node, but the enqueue has already taken effect.',
        'If tail.next is not null, the observed tail is stale. Another enqueue linked a node but did not finish moving the tail pointer. The current thread tries to advance tail, then loops. This is the helping rule. Every thread that finds shared maintenance left behind has permission to perform it.',
        'Dequeue reads head, tail, and head.next. If head.next is null, there is no real node after the dummy, so the queue is empty. Otherwise the consumer reads the value from next and tries CAS(head, oldHead, next). If it succeeds, it returns that value and the next node becomes the new dummy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof is a linearizability proof. Each operation must appear to take effect at one instant between call and return. For enqueue, that instant is the successful CAS that links the new node into the next chain. For dequeue, it is the successful CAS that advances head from the old dummy to the node being returned.',
        'FIFO order follows from the next chain. Producers can only link a new node at an observed last node whose next is null. Once a node is linked, later nodes appear after it. Consumers remove by advancing head to the first real node, so two consumers cannot return the same item because only one CAS from the same old head can win.',
        'The dummy node avoids a two-pointer commit. Without it, an operation on a one-item queue might need to update both head and tail in one indivisible action. With a dummy, the contents are represented by the nodes after head, and tail lag is harmless as long as the next chain remains correct.',
      ],
    },
    {
      heading: 'Progress Guarantee',
      paragraphs: [
        'Lock-free is a progress claim about the system, not a promise that every individual thread finishes quickly. If many threads keep colliding on the same CAS, one unlucky thread can retry many times. Still, failed attempts usually mean some other thread changed the structure, so the system as a whole is moving.',
        'This is weaker than wait-free progress, where every operation completes within a bounded number of its own steps. It is stronger than a blocking lock, where one paused owner can stop everyone. The Michael-Scott queue sits in the middle: harder to implement than a locked queue, easier than a wait-free queue, and strong enough for many shared work queues.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with dummy -> A -> B, with head at dummy and tail at B. Producer P wants to enqueue C. It reads tail = B and tail.next = null, then succeeds at CAS(B.next, null, C). At that instant, C is in the queue even if tail still points at B.',
        'Producer Q arrives before P moves tail. Q reads tail = B and sees B.next = C. That tells Q the previous enqueue already published a node and left only tail cleanup behind. Q tries CAS(tail, B, C). If it wins, the shortcut is repaired. If it loses, some other thread repaired it first.',
        'A consumer then reads head = dummy and next = A. It reads A.value, then tries CAS(head, dummy, A). If that CAS succeeds, the consumer returns A and A becomes the new dummy for future dequeues. If the CAS fails, another consumer got A first, so this consumer rereads the new head and tries again.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The algorithm on paper is not the whole implementation. Removed nodes cannot be freed while another thread might still hold a pointer read earlier. In garbage-collected runtimes, the collector provides much of that safety. In C and C++, the queue needs a reclamation discipline such as hazard pointers, epochs, reference counting, or another scheme that delays reuse until readers are done.',
        'ABA is a related hazard. A pointer can hold value X, change to Y, and later hold X again after memory reuse. A CAS that checks only the pointer value might think nothing changed. Tagged pointers, version counters, hazard discipline, or allocation rules can prevent that mistake.',
        'Memory ordering is also part of correctness. A consumer must not see a node link before the node value is safely published. Producers and consumers need acquire and release rules, or equivalent runtime guarantees, so pointer visibility and value visibility match the logical operation order.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'A lock-free queue wins when many threads need a shared FIFO and a paused participant should not hold the whole data structure hostage. It fits thread pools, actor mailboxes, runtime schedulers, concurrent collections, packet paths, telemetry ingestion, and handoff points where work must keep flowing under contention.',
        'It is most attractive when operations are short, queue operations are frequent, memory management is under control, and system-wide progress matters more than single-operation fairness. It also helps in environments where blocking inside a runtime or signal-sensitive path is expensive.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Lock-free is not a synonym for faster. At low contention, a mutex can win because it does less bookkeeping. A bounded ring buffer can beat a linked queue when capacity is known and cache locality matters. A blocking queue is better when consumers should sleep instead of retrying or polling.',
        'The design also fails when the surrounding engineering is wrong. ABA, premature free, weak memory ordering, publishing a link before publishing a value, or an incorrect empty-queue check can break the proof even if the code uses CAS. The algorithm gives a structure for correctness; it does not forgive unsafe memory management.',
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        'Start with a locked queue unless the workload has a measured contention or progress problem. If a lock-free queue is justified, use a proven implementation before writing one. If you do write one, keep the linearization points explicit in comments and tests: enqueue links a node, dequeue advances head.',
        'Test with stress, randomized scheduling, and a linearizability checker rather than only unit examples. Include cancellation, thread pauses, empty transitions, one-item transitions, high contention, and memory-pressure scenarios. For native code, test with sanitizers and the same memory reclamation strategy used in production.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Linearizability History Checker for the proof method, ABA Tagged Pointer Stack for pointer reuse hazards, Nonblocking Progress Guarantees for lock-free versus wait-free, Hazard Pointers & Epoch Reclamation for memory safety, Futex Wait Queue for blocking contrast, MCS Queue Lock for scalable spinning with mutual exclusion, and Backpressure & Flow Control for systems built around queues.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Lock-Free Queue moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
