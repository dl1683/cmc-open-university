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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a race between a shared memory word and a kernel wait queue. A futex is a fast userspace mutex primitive: user code owns the integer state, and the kernel only parks threads when waiting is necessary. Active threads are executing the current lock or wait operation, visited states have already been observed, and found states are safe wakeups.',
        'The safe inference rule is compare before sleep. A thread may sleep only if the futex word still equals the value it observed, because otherwise it could miss the unlock that should have woken it.',
        {type:'callout', text:'A futex is the kernel parking lot for a user-space predicate, closing the check-then-sleep race without charging every uncontended lock a syscall.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most lock acquisitions are uncontended. For those cases, a mutex should cost a few user-space atomic instructions, not a syscall, scheduler decision, and kernel queue operation.',
        'Contention still needs blocking. If a lock owner is descheduled or performs I/O, pure spinning burns CPU while making no progress. Futexes split the fast path from the blocking path.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious first design is a spin lock. A thread repeatedly reads a word and uses compare-and-swap to change it from free to locked.',
        'The obvious second design is check then sleep. If the word is locked, the thread asks the operating system to block it until another thread wakes it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the lost-wake race. A waiter can observe locked, get delayed before sleeping, and then miss the owner storing free and sending a wake.',
        'After that interleaving, the waiter sleeps even though the event it needed already happened. Correct blocking needs one atomic kernel-side decision: sleep only if the word still has the expected value.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A futex ties a kernel wait queue to a user-space address and expected value. The integer at that address is the predicate, such as locked, sequence unchanged, or count zero.',
        'The kernel does not understand the whole mutex or condition variable. It only checks whether the word equals the expected value, queues the thread if it still matches, and wakes queued threads for the same address later.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A mutex first tries to acquire with a user-space atomic compare-and-swap. If the word changes from 0 to 1, the thread owns the lock and no syscall occurs.',
        'If the word is already 1, the thread calls FUTEX_WAIT with the word address and expected value 1. The kernel rereads the word; if it is no longer 1, the call returns without sleeping.',
        'If the value still matches, the kernel places the thread on a wait queue keyed by the address and parks it. The owner later stores 0 with release ordering and calls FUTEX_WAKE, which makes one or more waiters runnable.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The compare-and-block operation closes the lost-wake gap. If unlock already happened, the expected value no longer matches and the waiter cannot be queued behind an event that has passed.',
        'The wait loop handles weak wake semantics. A wake can be interrupted, can wake more than one thread, or can race with another acquire, so the returned thread must recheck the predicate before assuming success.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The uncontended path costs one or a few atomic operations. When contention appears, the cost jumps to syscall entry, futex hash-bucket lookup, queue manipulation, scheduler work, and a later context switch.',
        'When the number of waiting threads doubles, wake storms and cache-line bouncing can dominate more than the futex syscall itself. Fairness, priority inheritance, timeout handling, and cancellation add complexity above the primitive.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Futexes sit under pthread mutexes, condition variables, semaphores, barriers, language runtime parking lots, and many custom synchronization primitives on Linux. They are useful when uncontended operations should stay in user space but long waits should stop burning CPU.',
        'The pattern also teaches a broader systems idea. Keep the common-case state in shared memory, and call the kernel only at the boundary where scheduling is required.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A futex fails when treated as a complete lock. It does not by itself provide ownership, fairness, recursion, condition-variable semantics, or memory ordering for protected data.',
        'It also fails when code waits without a loop, uses the wrong expected value, ignores interrupted waits, or forgets release and acquire ordering around the shared word. These bugs can hide for a long time because the uncontended path still appears correct.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Thread A owns a lock, so the futex word is 1. Thread B reads 1 and is about to sleep. A stores 0 and calls wake before B enters the kernel.',
        'In a naive design, wake finds no sleepers and B sleeps forever. With FUTEX_WAIT, B passes expected value 1, the kernel rereads 0, and B returns immediately instead of sleeping. B then retries the atomic acquire on the now-free word.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the Linux futex(2) and futex(7) man pages, Ulrich Drepper futex notes, and pthread mutex implementation discussions. The important source-level detail is the exact compare-and-block contract around FUTEX_WAIT.',
        'Next study compare-and-swap, memory ordering, condition variables, MCS locks, semaphores, priority inversion, and scheduler run queues. Futexes make sense after the reader separates state ownership from thread parking.',
      ],
    },
  ],
};
