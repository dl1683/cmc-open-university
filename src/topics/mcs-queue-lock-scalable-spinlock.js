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
  const threadCount = 3; // A, B, C in this demo
  const qnodeFields = 2; // next pointer + locked flag per node
  const handoffWrites = 1; // release writes exactly one successor flag

  yield {
    state: mcsGraph('MCS turns a lock into a linked queue of qnodes', {
      tail: 'points to C',
      a: 'owner',
      b: 'locked=true',
      c: 'locked=true',
      shared: 'tail only',
    }),
    highlight: { active: ['tail', 'a', 'b', 'c', 'e-a-b', 'e-b-c'], compare: ['shared'] },
    explanation: `An MCS lock stores one shared tail pointer. Each of the ${threadCount} contenders brings a queue node with ${qnodeFields} fields (next pointer and locked flag). The waiters form a linked list behind the current owner.`,
    invariant: `Every waiting thread spins on its own qnode.locked flag — ${threadCount - 1} waiters poll ${threadCount - 1} separate cache lines.`,
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
    explanation: `To acquire, thread C atomically swaps the lock tail with its own qnode. The old tail is C's predecessor. If there was no predecessor, C owns the lock immediately — ${handoffWrites} atomic swap is all it takes.`,
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
    explanation: `If a predecessor exists, C sets C.locked = true and stores C into predecessor.next. That ${handoffWrites} link makes the queue explicit and gives the predecessor a precise successor to wake among ${threadCount} threads.`,
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
    explanation: `The scalability win is cache behavior. Each of the ${threadCount - 1} waiters repeatedly reads its own .locked flag — B polls B.locked, C polls C.locked. They do not all pound ${handoffWrites} shared cache line while waiting.`,
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
    explanation: `On release, A checks its next pointer. If B is present, A clears B.locked with ${handoffWrites} remote store — handing the lock to the exact successor and preserving FIFO order across all ${threadCount} threads.`,
    invariant: `The unlock path wakes exactly ${handoffWrites} successor, not all ${threadCount - 1} contenders.`,
  };
}

function* contentionScalability() {
  const lockStyles = 3; // test-and-set, ticket, MCS in the plot
  const maxCores = 32; // largest core count on the x-axis
  const lockTypes = 4; // lock types in the comparison matrix
  const scenarioCount = 4; // rows in the tradeoff matrix

  yield {
    state: trafficPlot('Why local spinning matters under contention'),
    highlight: { active: ['mcs', 'flat'], compare: ['tas', 'ticket', 'hot'] },
    explanation: `A simple test-and-set lock can make every waiter repeatedly invalidate the same cache line. Across all ${lockStyles} styles plotted up to ${maxCores} cores, MCS keeps the shared tail mostly out of the spin path so release traffic stays close to one successor handoff.`,
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
    explanation: `MCS is not just a faster boolean. Among the ${lockTypes} lock types compared, it changes the data structure from one contended word into a queue, then makes each waiter observe its own node — ${lockStyles - 1} of the ${lockStyles} plotted styles still poll shared state.`,
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
    explanation: `The algorithm needs a qnode per waiting acquisition — with ${maxCores} cores contending, that means up to ${maxCores} nodes. That is why MCS APIs often require caller-provided node storage or keep per-thread lock context.`,
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
    explanation: `Queue locks are excellent when the lock is hot but held briefly. Across the ${scenarioCount} scenarios above, if the holder can sleep, block on I/O, or be descheduled for long periods, a parking primitive may be better — MCS shines in only ${scenarioCount - 2} of the ${scenarioCount} cases.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'The queue-handoff view shows a lock as a linked list of waiting nodes. The tail pointer is the newest arrival, each next pointer links a successor, and each waiter spins on its own locked flag. The contention view shows why local spinning avoids a shared cache-line storm.',
        {type: 'image', src: './assets/gifs/mcs-queue-lock-scalable-spinlock.gif', alt: 'Animated walkthrough of the mcs queue lock scalable spinlock visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'A spin lock is attractive for very short critical sections because it avoids scheduler handoff. Under contention, a simple spin lock can make every core hammer one shared word. MCS exists to keep the spin-lock style while moving wait traffic into per-thread nodes.',
        {type: 'callout', text: 'MCS scales by moving waiting from one shared cache line into per-thread queue nodes with one-successor handoff.'},
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious lock is test-and-set: every contender tries to flip one shared bit. Ticket locks improve fairness by giving each thread a number. Both approaches still make waiters observe shared state during contention.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is cache coherence. A lock word is stored in a cache line, and ownership of that line moves among cores. With many waiters, the machine can spend more time moving the line than running the protected code.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Turn contenders into a FIFO linked queue. Each thread provides a queue node with a next pointer and a locked flag. The shared lock stores a tail pointer, while each waiter spins on its own node.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Linked_list.svg', alt: 'Singly linked list diagram with nodes connected by next pointers', caption: 'An MCS lock is a linked queue at heart: each node points to the successor that will be woken next. Source: Wikimedia Commons, Lasindi, public domain.'},
      ], },
    { heading: 'How it works', paragraphs: [
        'Acquire initializes the caller node and atomically swaps it into the tail. The old tail is the predecessor. If there is no predecessor, the caller owns the lock; otherwise it links itself after the predecessor and waits on its own flag.',
        'Release checks the owner node next pointer. If a successor is present, it clears successor.locked. If no successor is visible, it uses a compare-and-swap on the tail or waits for a linking successor so no arrival is lost.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'Mutual exclusion follows because only the predecessor clears a waiter flag. FIFO order follows from the atomic tail swap, which appends each arrival after the previous tail. Acquire and release memory ordering are required so protected writes become visible before the successor enters.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Under contention, each release normally wakes one successor and waiting is local polling. If waiters double, the release still touches one successor flag instead of waking every core on one shared word. The cost is a caller-owned node, pointer chasing, race handling, and careful memory ordering.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel processor die photograph showing compute regions and cache structures', caption: 'Spin-lock scalability is a hardware story: cache-line ownership moves across cores on real silicon, not in abstract pseudocode. Source: Wikimedia Commons, KL and Intel, public domain.'},
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'MCS locks fit kernels, runtimes, allocators, and synchronization libraries on many-core or NUMA systems. The critical section should be short and hot enough that coherence traffic appears in profiles. The lesson generalizes: scalable waiting often means moving observers away from one shared object.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'MCS is wrong for long waits, blocking I/O, or owners that may sleep. Spinning wastes CPU when the owner is not running. Under low contention, simpler locks can be faster because they avoid queue-node setup.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Suppose A owns the lock, B waits, and C arrives. C swaps the tail and gets B as predecessor, sets C.locked, writes B.next = C, and spins on C.locked. A releases to B by clearing B.locked, then B later releases to C by clearing C.locked.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Start with Mellor-Crummey and Scott, Algorithms for Scalable Synchronization on Shared-Memory Multiprocessors, 1991. Study compare-and-swap, cache coherence, memory barriers, ticket locks, futexes, lock-free queues, and hazard pointers next.',
      ], },
  ],
};
