// Futex wait queues: the kernel-backed parking lot that lets user-space
// synchronization stay fast when uncontended and sleep when contended.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'futex-wait-queue-case-study',
  title: 'Futex Wait Queue Case Study',
  category: 'Systems',
  summary: 'A futex is an address-keyed wait queue: user space owns the fast path, and the kernel parks threads only after an atomic compare-and-block.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['wait/wake handshake', 'lost wake case study'], defaultValue: 'wait/wake handshake' },
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

function futexGraph(title, { word = '1 locked', waiter = 'not queued', wake = 'idle', owner = 'owner' } = {}) {
  return graphState({
    nodes: [
      { id: 'owner', label: owner, x: 0.9, y: 2.1, note: 'holds lock' },
      { id: 'candidate', label: 'thread B', x: 0.9, y: 5.9, note: 'wants lock' },
      { id: 'word', label: 'futex word', x: 2.7, y: 4.0, note: word },
      { id: 'fast', label: 'CAS path', x: 4.7, y: 1.7, note: 'user space' },
      { id: 'syscall', label: 'wait', x: 4.7, y: 6.3, note: 'compare' },
      { id: 'bucket', label: 'bucket', x: 6.9, y: 6.3, note: '&word' },
      { id: 'queue', label: 'sleep', x: 9.0, y: 6.3, note: waiter },
      { id: 'wake', label: 'wake', x: 6.9, y: 1.7, note: wake },
      { id: 'runq', label: 'run q', x: 9.0, y: 1.7, note: 'scheduler' },
    ],
    edges: [
      { id: 'e-owner-word', from: 'owner', to: 'word', weight: 'store' },
      { id: 'e-candidate-word', from: 'candidate', to: 'word', weight: 'load' },
      { id: 'e-word-fast', from: 'word', to: 'fast', weight: '0?' },
      { id: 'e-word-syscall', from: 'word', to: 'syscall', weight: 'still 1?' },
      { id: 'e-syscall-bucket', from: 'syscall', to: 'bucket', weight: 'key' },
      { id: 'e-bucket-queue', from: 'bucket', to: 'queue', weight: 'q' },
      { id: 'e-owner-wake', from: 'owner', to: 'wake', weight: 'unlock' },
      { id: 'e-wake-queue', from: 'wake', to: 'queue', weight: 'wake n' },
      { id: 'e-wake-runq', from: 'wake', to: 'runq', weight: '' },
    ],
  }, { title });
}

function* waitWakeHandshake() {
  yield {
    state: futexGraph('A futex keeps the uncontended path in user space', { word: '0 free', waiter: 'empty', wake: 'unused', owner: 'thread A' }),
    highlight: { active: ['word', 'fast', 'e-word-fast'], compare: ['syscall', 'bucket'] },
    explanation: 'A futex is not a full mutex by itself. It is the primitive underneath one: a shared integer in user memory plus a kernel wait queue keyed by that integer address.',
    invariant: 'If the user-space CAS can acquire the word, there is no syscall.',
  };

  yield {
    state: futexGraph('Contention switches from spinning to compare-and-block', { word: '1 locked', waiter: 'empty', wake: 'idle', owner: 'thread A' }),
    highlight: { active: ['candidate', 'word', 'syscall', 'e-word-syscall'], compare: ['fast'] },
    explanation: 'When thread B sees the word is still locked, it asks the kernel to sleep only if the word still equals the expected locked value. That compare is part of the blocking operation.',
  };

  yield {
    state: futexGraph('The kernel parks waiters by futex address', { word: '1 locked', waiter: 'B asleep', wake: 'idle', owner: 'thread A' }),
    highlight: { active: ['syscall', 'bucket', 'queue', 'e-syscall-bucket', 'e-bucket-queue'], found: ['candidate'] },
    explanation: 'The kernel does not understand the whole lock algorithm. It just maps the futex word address to a wait queue, parks the thread, and later wakes a bounded number of waiters.',
  };

  yield {
    state: futexGraph('Unlock changes the word, then wakes a waiter', { word: '0 free', waiter: 'B queued', wake: 'wake 1', owner: 'thread A' }),
    highlight: { active: ['owner', 'word', 'wake', 'queue', 'runq', 'e-owner-wake', 'e-wake-queue', 'e-wake-runq'] },
    explanation: 'Unlock is split across user space and the kernel: the owner publishes the unlocked state in the futex word, then calls wake so one sleeper can rejoin the scheduler run queue.',
  };

  yield {
    state: futexGraph('Wake is a hint; the awakened thread rechecks in user space', { word: '0 or taken', waiter: 'B woken', wake: 'done', owner: 'thread A' }),
    highlight: { active: ['candidate', 'word', 'fast', 'runq', 'e-candidate-word', 'e-word-fast'], compare: ['queue'] },
    explanation: 'A woken thread must loop and retry the predicate. Another thread may take the word first, or the wake may be spurious. Correct futex code treats wakeup as permission to recheck, not proof that the lock is owned.',
    invariant: 'Always wait in a loop around the user-space predicate.',
  };
}

function* lostWakeCaseStudy() {
  yield {
    state: labelMatrix(
      'The race every blocking primitive must close',
      [
        { id: 'bad1', label: 'bad waiter' },
        { id: 'waker', label: 'waker' },
        { id: 'bad2', label: 'bad waiter later' },
        { id: 'futex', label: 'futex waiter' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'state', label: 'state seen' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['checks flag', 'locked', 'about to sleep'],
        ['sets flag', 'unlocked', 'wake sees nobody'],
        ['sleeps anyway', 'missed event', 'can hang'],
        ['compare-and-block', 'kernel rechecks', 'does not miss wake'],
      ],
    ),
    highlight: { compare: ['bad2:outcome'], found: ['futex:outcome'] },
    explanation: 'The classic lost-wake bug is a gap between checking a condition and going to sleep. If the wake happens inside that gap, the waiter can sleep forever after the event already occurred.',
  };

  yield {
    state: futexGraph('FUTEX_WAIT closes the check-then-sleep gap', { word: '0 free', waiter: 'not queued', wake: 'already ran', owner: 'thread A' }),
    highlight: { active: ['syscall', 'word', 'e-word-syscall'], found: ['candidate'], compare: ['queue'] },
    explanation: 'With futex wait, the kernel atomically compares the current word against the expected value before blocking. If unlock already changed 1 to 0, the wait returns instead of enqueueing the thread.',
    invariant: 'The expected value passed to FUTEX_WAIT is part of correctness, not a decoration.',
  };

  yield {
    state: labelMatrix(
      'Wakes are deliberately weaker than ownership',
      [
        { id: 'normal', label: 'normal wake' },
        { id: 'race', label: 'racing wake' },
        { id: 'signal', label: 'signal/EINTR' },
        { id: 'timeout', label: 'timeout' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'handler', label: 'correct code' },
      ],
      [
        ['someone may proceed', 'retry CAS'],
        ['predicate may changed twice', 'reload word'],
        ['sleep interrupted', 'loop or report'],
        ['deadline expired', 'return timeout'],
      ],
    ),
    highlight: { active: ['normal:handler', 'race:handler'], compare: ['signal:handler', 'timeout:handler'] },
    explanation: 'Futexes are intentionally low level. A wake does not transfer a lock, preserve FIFO fairness by itself, or prove the predicate is true. The higher-level primitive supplies those rules.',
  };

  yield {
    state: labelMatrix(
      'What futexes build',
      [
        { id: 'mutex', label: 'mutex' },
        { id: 'cond', label: 'condition variable' },
        { id: 'sem', label: 'semaphore' },
        { id: 'barrier', label: 'barrier' },
      ],
      [
        { id: 'word', label: 'user-space word' },
        { id: 'queue', label: 'kernel queue role' },
        { id: 'link', label: 'study next' },
      ],
      [
        ['owner/count bits', 'park contenders', 'MCS Queue Lock'],
        ['sequence number', 'park until signal', 'Logical Clocks'],
        ['permit count', 'park when zero', 'Semaphore Permit Counter'],
        ['arrival epoch', 'park until cohort complete', 'Backpressure'],
      ],
    ),
    highlight: { active: ['sem:word', 'sem:link'], found: ['mutex:queue', 'cond:queue'] },
    explanation: 'The same address-keyed wait queue pattern sits underneath many synchronization abstractions. The interesting data structure is the split: a tiny user-space word plus a kernel queue used only on the slow path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'wait/wake handshake') yield* waitWakeHandshake();
  else if (view === 'lost wake case study') yield* lostWakeCaseStudy();
  else throw new InputError('Pick a futex view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A futex is a fast user-space synchronization building block. The shared state lives in a normal user-space integer. The kernel only appears when a thread must block or when another thread wakes blocked waiters.',
        'The key data structure is an address-keyed wait queue. User code owns the meaning of the integer: free, locked, waiter-present, sequence number, permit count, or epoch. The kernel only maps the futex word address to sleepers.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A mutex built on a futex first tries a user-space atomic operation. If the word says free, the thread acquires without a syscall. If the word says locked, the thread calls FUTEX_WAIT with the address and the locked value it observed.',
        'FUTEX_WAIT is the crucial operation: compare the current word with the expected value and block only if they still match. That closes the lost-wake race between checking the predicate and sleeping. FUTEX_WAKE later wakes one or more waiters by the same address key.',
      ],
    },
    {
      heading: 'Case study: parking without missing the unlock',
      paragraphs: [
        'Suppose thread B observes a lock word equal to 1 and is about to sleep. Thread A unlocks by storing 0 and waking waiters. In a naive design, B might miss the wake and go to sleep after the unlock. In the futex design, the kernel rechecks the word before sleeping; because it is now 0, B does not enqueue.',
        'This is why futex-based primitives loop around their predicate. Waking is not ownership. The awakened thread must reread the word, retry the CAS, and go back to sleep if a different thread won the race.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The uncontended path is as cheap as user-space atomics. The contended path pays a syscall, a hash-bucket lookup, scheduler work, and later wakeup. Good primitives therefore avoid kernel transitions when possible and avoid waking too many waiters at once.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A futex is not automatically fair, recursive, priority-inheriting, or a complete condition variable. Those rules live in the higher-level primitive. The futex gives the primitive one narrow power: sleep only if a word still has the expected value, and wake sleepers waiting on that word.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux futex man page at https://man7.org/linux/man-pages/man2/futex.2.html, futex overview at https://man7.org/linux/man-pages/man7/futex.7.html, and Ulrich Drepper futex notes at https://akkadia.org/drepper/futex.pdf. Study Semaphore Permit Counter, MCS Queue Lock, Lock-Free Queue, Backpressure & Flow Control, and Logical Clocks next.',
      ],
    },
  ],
};
