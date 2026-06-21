// MCS queue locks: a scalable spin lock where contenders form a linked queue
// and each thread spins on its own node instead of hammering one shared word.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'mcs-queue-lock-scalable-spinlock',
  title: 'MCS Queue Lock',
  category: 'Data Structures',
  summary: 'A fair queued spin lock: each contender swaps itself onto a tail pointer, links behind its predecessor, and spins on a local flag until handoff.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['queue handoff', 'contention scalability'], defaultValue: 'queue handoff' },
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

function mcsGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'tail', label: 'tail ptr', x: 5.0, y: 1.0, note: notes.tail ?? 'to C' },
      { id: 'a', label: 'node A', x: 1.1, y: 4.0, note: notes.a ?? 'owner' },
      { id: 'b', label: 'node B', x: 4.0, y: 4.0, note: notes.b ?? 'locked=true' },
      { id: 'c', label: 'node C', x: 6.8, y: 4.0, note: notes.c ?? 'locked=true' },
      { id: 'coreA', label: 'core A', x: 1.2, y: 6.4, note: notes.coreA ?? 'critical' },
      { id: 'coreB', label: 'core B', x: 4.0, y: 6.4, note: notes.coreB ?? 'spins local' },
      { id: 'coreC', label: 'core C', x: 6.8, y: 6.4, note: notes.coreC ?? 'spins local' },
      { id: 'shared', label: 'shared', x: 9.1, y: 2.4, note: notes.shared ?? 'quiet' },
    ],
    edges: [
      { id: 'e-tail-c', from: 'tail', to: 'c', weight: 'tail' },
      { id: 'e-a-b', from: 'a', to: 'b', weight: 'next' },
      { id: 'e-b-c', from: 'b', to: 'c', weight: 'next' },
      { id: 'e-coreA-a', from: 'coreA', to: 'a', weight: 'owns' },
      { id: 'e-coreB-b', from: 'coreB', to: 'b', weight: 'poll' },
      { id: 'e-coreC-c', from: 'coreC', to: 'c', weight: 'poll' },
      { id: 'e-b-shared', from: 'b', to: 'shared', weight: '' },
      { id: 'e-c-shared', from: 'c', to: 'shared', weight: '' },
    ],
  }, { title });
}

function trafficPlot(title) {
  const cores = [1, 2, 4, 8, 16, 32];
  return plotState({
    axes: { x: { label: 'contending cores', min: 1, max: 32 }, y: { label: 'remote invalidations per release', min: 0, max: 34 } },
    series: [
      { id: 'tas', label: 'test-and-set style', points: cores.map((x) => ({ x, y: Math.max(1, x - 1) })) },
      { id: 'ticket', label: 'ticket lock readers', points: cores.map((x) => ({ x, y: Math.max(1, x * 0.8) })) },
      { id: 'mcs', label: 'MCS local spin', points: cores.map((x) => ({ x, y: x === 1 ? 0 : 1 })) },
    ],
    markers: [
      { id: 'hot', x: 32, y: 31, label: 'shared-line storm' },
      { id: 'flat', x: 32, y: 1, label: 'one successor touched' },
    ],
  }, { title });
}

function* queueHandoff() {
  yield {
    state: mcsGraph('MCS turns a lock into a linked queue of qnodes', {
      tail: 'points to C',
      a: 'owner',
      b: 'locked=true',
      c: 'locked=true',
      shared: 'tail only',
    }),
    highlight: { active: ['tail', 'a', 'b', 'c', 'e-a-b', 'e-b-c'], compare: ['shared'] },
    explanation: 'An MCS lock stores one shared tail pointer. Each contender brings a queue node with a next pointer and a locked flag. The waiters form a linked list behind the current owner.',
    invariant: 'Every waiting thread spins on its own qnode.locked flag.',
  };

  yield {
    state: mcsGraph('Acquire swaps the caller onto the tail', {
      tail: 'old tail B',
      a: 'owner',
      b: 'predecessor',
      c: 'new tail',
      coreC: 'swap tail',
    }),
    highlight: { active: ['c', 'tail', 'b', 'e-tail-c'], found: ['coreC'] },
    explanation: "To acquire, thread C atomically swaps the lock tail with its own qnode. The old tail is C's predecessor. If there was no predecessor, C owns the lock immediately.",
  };

  yield {
    state: mcsGraph('The predecessor links to the new waiter', {
      tail: 'points to C',
      a: 'owner',
      b: 'pred.next=C',
      c: 'locked=true',
      coreC: 'waiting',
    }),
    highlight: { active: ['b', 'c', 'e-b-c'], compare: ['tail'] },
    explanation: 'If a predecessor exists, C sets C.locked = true and stores C into predecessor.next. That single link makes the queue explicit and gives the predecessor a precise successor to wake.',
  };

  yield {
    state: mcsGraph('Waiters spin locally instead of on one shared lock word', {
      tail: 'points to C',
      a: 'owner',
      b: 'locked=true',
      c: 'locked=true',
      coreB: 'poll B.locked',
      coreC: 'poll C.locked',
      shared: 'quiet',
    }),
    highlight: { active: ['coreB', 'b', 'e-coreB-b', 'coreC', 'c', 'e-coreC-c'], compare: ['shared'] },
    explanation: 'The scalability win is cache behavior. B repeatedly reads B.locked, and C repeatedly reads C.locked. They do not all pound one shared cache line while waiting.',
  };

  yield {
    state: mcsGraph('Release clears only the successor local flag', {
      tail: 'points to C',
      a: 'handoff',
      b: 'locked=false',
      c: 'locked=true',
      coreA: 'store to B',
      coreB: 'enters',
    }),
    highlight: { active: ['a', 'b', 'coreA', 'coreB', 'e-a-b', 'e-coreB-b'], found: ['c'] },
    explanation: 'On release, A checks its next pointer. If B is present, A clears B.locked. That one remote store hands the lock to the exact successor and preserves FIFO order.',
    invariant: 'The unlock path wakes one successor, not every contender.',
  };
}

function* contentionScalability() {
  yield {
    state: trafficPlot('Why local spinning matters under contention'),
    highlight: { active: ['mcs', 'flat'], compare: ['tas', 'ticket', 'hot'] },
    explanation: 'A simple test-and-set lock can make every waiter repeatedly invalidate the same cache line. MCS keeps the shared tail mostly out of the spin path, so release traffic stays close to one successor handoff.',
  };

  yield {
    state: labelMatrix(
      'Lock shape comparison',
      [
        { id: 'tas', label: 'test-and-set' },
        { id: 'ticket', label: 'ticket lock' },
        { id: 'mcs', label: 'MCS lock' },
        { id: 'mutex', label: 'futex mutex' },
      ],
      [
        { id: 'fair', label: 'fairness' },
        { id: 'spin', label: 'spin location' },
        { id: 'best', label: 'best fit' },
      ],
      [
        ['weak', 'shared word', 'short low contention'],
        ['FIFO', 'shared owner counter', 'moderate contention'],
        ['FIFO', 'local qnode flag', 'high contention SMP/NUMA'],
        ['scheduler', 'usually parks', 'long waits'],
      ],
    ),
    highlight: { active: ['mcs:fair', 'mcs:spin', 'mcs:best'], compare: ['tas:spin', 'mutex:best'] },
    explanation: 'MCS is not just a faster boolean. It changes the data structure from one contended word into a queue, then makes each waiter observe its own node.',
  };

  yield {
    state: mcsGraph('The queue node is caller-owned state', {
      tail: 'points to C',
      a: 'reusable node',
      b: 'per thread',
      c: 'per acquire',
      coreB: 'owns node B',
      coreC: 'owns node C',
      shared: 'tail pointer',
    }),
    highlight: { active: ['b', 'c', 'coreB', 'coreC'], compare: ['shared'] },
    explanation: 'The algorithm needs a qnode per waiting acquisition. That is why MCS APIs often require caller-provided node storage or keep per-thread lock context.',
  };

  yield {
    state: labelMatrix(
      'Where MCS helps and where it hurts',
      [
        { id: 'short', label: 'short critical section' },
        { id: 'many', label: 'many cores' },
        { id: 'preempt', label: 'owner preempted' },
        { id: 'io', label: 'blocking I/O inside lock' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'choice', label: 'choice' },
      ],
      [
        ['handoff cheap', 'spin lock can fit'],
        ['shared-line storm avoided', 'MCS shines'],
        ['successors still wait', 'consider parking'],
        ['CPU wasted', 'use mutex/semaphore'],
      ],
    ),
    highlight: { active: ['many:effect', 'many:choice'], compare: ['io:choice', 'preempt:choice'] },
    explanation: 'Queue locks are excellent when the lock is hot but held briefly. If the holder can sleep, block on I/O, or be descheduled for long periods, a parking primitive may be better.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'queue handoff') yield* queueHandoff();
  else if (view === 'contention scalability') yield* contentionScalability();
  else throw new InputError('Pick an MCS lock view.');
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'A spin lock is the smallest synchronization tool that can protect a short critical section: keep trying to acquire a word, run the protected code, then release the word. For one or two contenders, that directness is hard to beat. There is no scheduler handoff, no sleeping path, and no heavy queue in the uncontended case.',
        'MCS exists for the moment when that one lock word becomes the busiest object in the machine. On a many-core system, every waiter repeatedly reading or writing the same cache line can generate more coherence traffic than useful work. The algorithm keeps the spin-lock style, but changes what each thread spins on.',
        {type: 'callout', text: 'MCS scales by moving waiting from one shared cache line into per-thread queue nodes with one-successor handoff.'},
      ],
    },
    {
      heading: 'Naive Baseline and Wall',
      paragraphs: [
        'The naive baseline is a test-and-set lock. Everyone tries to flip the same shared bit, and losers loop until the bit changes. A test-test-and-set variant reduces some writes by reading first, and ticket locks improve fairness by giving each thread a number. These are useful tools, but waiters still orbit shared lock state.',
        'The wall is the memory system. A release can wake many observers of one shared cache line, and each failed attempt can invalidate or reload that line. As contention rises, a lock that looks O(1) in pseudocode can become a coherence storm. The CPU cores spend time moving ownership of a lock word instead of doing useful work.',
      ],
    },
    {
      heading: 'Core Insight and Invariant',
      paragraphs: [
        'MCS turns contention into an explicit FIFO queue. A contender atomically appends its queue node to the shared tail, learns its predecessor, links itself after that predecessor, and then spins on a flag in its own node. The shared lock object is mostly a tail pointer, not the hot polling location for every core.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Singly linked list diagram with nodes connected by next pointers', caption: 'An MCS lock is a linked queue at heart: each node points to the successor that will be woken next. Source: Wikimedia Commons, Lasindi, public domain.'},
        'The key invariant is local waiting: every non-owner waits for exactly one predecessor, and every predecessor wakes exactly one successor. The shared tail orders arrivals, but the waiting loop reads a per-waiter flag instead of the global lock word. That is the data-structure move that makes the lock scalable.',
      ],
    },
    {
      heading: 'How the Visual Model Teaches It',
      paragraphs: [
        'The queue-handoff view teaches the shape of ownership. The tail pointer identifies the most recent arrival. The next pointers link waiters in order. The locked flags are the local waiting points. The important transition is not repeated retry against one word; it is the predecessor discovering a precise successor to wake.',
        'The contention-scalability view teaches cache behavior. Test-and-set and ticket-style locks keep many waiters interested in shared state. The MCS curve stays flat because a release normally writes one successor flag. The comparison matrix separates three ideas that are easy to blur: fairness, spin location, and workload fit.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Acquire starts with caller-owned qnode storage. The thread clears qnode.next, prepares qnode.locked, and atomically swaps the lock tail with its node. The old tail is the predecessor. If the old tail was null, the thread owns the lock immediately because no one was ahead of it.',
        'If there is a predecessor, the thread stores itself into predecessor.next and waits until its own locked flag becomes false. Release checks the owner node next pointer. If a successor is present, release stores false to successor.locked. If no successor is visible, release tries to compare-and-swap the tail back to null; if that fails, a successor is in the middle of linking and the owner waits for next to appear before handing off.',
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        'Mutual exclusion follows from the queue order. A thread either observes no predecessor and becomes the sole owner, or it cannot enter until its predecessor clears its local flag. No unrelated thread clears that flag. The unlock operation grants the critical section to the exact successor in the linked queue.',
        'FIFO fairness comes from the atomic tail swap: each arriving node is placed after the previous tail. The subtle correctness case is the acquire-release race. A new waiter may have swapped the tail but not yet written predecessor.next. The releasing owner must not declare the lock free unless the tail compare-and-swap proves no such successor exists.',
      ],
    },
    {
      heading: 'Memory Ordering',
      paragraphs: [
        'A real MCS implementation depends on memory ordering. The entering thread must not run critical-section loads and stores before the acquire is complete. The releasing thread must publish critical-section writes before it clears the successor flag. That is why implementations use acquire and release barriers or the equivalent atomic operations for the target language and CPU.',
        'The queue links also need ordering. A waiter must initialize its node before publishing it, and a predecessor must see a valid successor before writing the handoff flag. These details are easy to skip in high-level pseudocode, but they are part of the algorithm, not an optimization afterthought.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Suppose A owns the lock, B is already waiting, and C arrives. C swaps the tail and receives B as predecessor. C sets C.locked to true, writes B.next = C, and spins on C.locked. It does not poll the lock tail, and it does not ask A directly for the lock.',
        'When A releases, it sees A.next = B and clears B.locked. B enters the critical section. Later B releases and clears C.locked. The handoff path is A to B to C, matching arrival order, and each release wakes one waiter. The rest of the queue stays quiet.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'The contended path uses O(1) remote synchronization steps per acquire and release, and the waiting loop is local. The shared tail is touched when a thread joins and sometimes when the owner releases with no visible successor. Waiting itself happens on the caller node. That is why MCS scales on SMP and NUMA machines better than locks whose waiters share one polling word.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die photograph showing compute regions and cache structures', caption: 'Spin-lock scalability is a hardware story: cache-line ownership moves across cores on real silicon, not in abstract pseudocode. Source: Wikimedia Commons, KL and Intel, public domain.'},
        'The tradeoff is machinery. Every acquisition needs a qnode with stable lifetime, the release code has a race to handle, and correct implementations require careful memory ordering. There is also pointer chasing and extra state compared with a tiny test-and-set lock. Under light contention, that extra work can lose.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'MCS wins when the critical section is short, contention is real, and the platform makes shared cache-line traffic expensive. Kernels, runtimes, memory allocators, and low-level synchronization libraries use queue locks for exactly that shape. It is especially attractive on large SMP and NUMA systems where remote cache-line movement is costly.',
        'It is also a useful mental model. Scalability can come from moving waiters away from a shared object, not from making the critical section disappear. The linked queue is the data-structure move that creates that separation. The lock remains a lock, but the waiting pattern no longer punishes every core for every release.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'Under light contention, a simple test-and-set lock, test-test-and-set lock, or ticket lock may be faster because it avoids qnode setup and pointer chasing. If the protected operation blocks, performs I/O, waits on another service, or can sleep for a long time, spinning burns CPU while making no progress.',
        'For long waits, a futex-backed mutex, semaphore, condition variable, or parking lock is usually the better primitive. If the owner is preempted, the MCS queue still waits in order. MCS is fair and scalable under contention, but it does not provide lock-free progress and it does not make a sleeping owner run.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Use MCS when profiling shows a hot short-held lock and coherence traffic is part of the cost. Do not choose it only because it is more sophisticated. Measure uncontended latency, contended throughput, fairness, CPU burn, cache misses, and behavior when the owner is preempted. The right primitive depends on the wait length and scheduling environment.',
        'Make qnode lifetime explicit. Many APIs require caller-provided node storage or per-thread lock context because a waiter spins on its own node and a predecessor writes that node during handoff. Reusing or freeing the node too early is a correctness bug. Pair the lock with clear ownership rules and memory-ordering tests.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Lock-Free Queue for a nonblocking contrast, Futex Wait Queue for park-and-wake synchronization, Sequence Locks for reader-heavy shared state, Hazard Pointers & Epoch Reclamation for safe node lifetime, Linked List for the queue shape, Compare-and-Swap, Memory Barriers, and Cache Coherence concepts before implementing this in a systems language.',
      ],
    },
  ],
};
