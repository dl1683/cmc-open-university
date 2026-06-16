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
      heading: 'What it is',
      paragraphs: [
        'An MCS lock is a queued spin lock designed for high contention on shared-memory multiprocessors. Instead of every waiter spinning on the same shared lock word, each waiter appends a node to a queue and spins on a flag inside its own node.',
        'MCS stands for Mellor-Crummey and Scott. The same Michael Scott behind the Michael-Scott lock-free queue appears here, but the design goal is different: preserve mutual exclusion while making contention scale by changing the waiting data structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The lock contains a shared tail pointer. To acquire, a thread initializes its qnode, atomically swaps itself into the tail, and receives the previous tail as its predecessor. If there is no predecessor, it owns the lock. Otherwise it links itself as predecessor.next and spins on its own locked flag.',
        'To release, the owner checks its next pointer. If a successor is present, it clears that successor locked flag. If no successor is visible, it tries to CAS the tail back to null; if that fails, it waits for the successor link and then performs the handoff.',
      ],
    },
    {
      heading: 'Case study: shared-line storm versus local spin',
      paragraphs: [
        'A naive test-and-set lock makes every waiting core repeatedly read and invalidate the same cache line. As the number of contenders grows, the lock word becomes a coherence hotspot. MCS avoids that storm: the shared tail is touched during enqueue, but each waiter spins on a private qnode flag until its predecessor wakes it.',
        'That is why queue locks are common in low-level runtimes and kernels where critical sections are short and contention can be high. The algorithm turns fairness and scalability into a concrete linked-list shape.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Acquire and release are O(1) remote operations in the contended path, but the code is more delicate than a simple spin flag. The caller needs qnode storage, release has a race with a successor that has swapped the tail but not linked itself yet, and preemption of the current owner can still stall the queue.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'MCS is scalable, not universally faster. Under light contention, a simpler lock may win on lower overhead. If critical sections can block or run for long periods, spinning wastes CPU and a futex-backed mutex or semaphore may be a better fit.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mellor-Crummey and Scott TOCS paper at https://www.cs.rochester.edu/u/scott/papers/1991_TOCS_synch.pdf, synchronization pseudocode at https://www.cs.rochester.edu/research/synchronization/pseudocode/ss.html, and discussion of non-scalable locks at https://people.csail.mit.edu/nickolai/papers/boyd-wickizer-locks.pdf. Study Lock-Free Queue, Futex Wait Queue, Sequence Locks, Hazard Pointers & Epoch Reclamation, and Linked List next.',
      ],
    },
  ],
};
