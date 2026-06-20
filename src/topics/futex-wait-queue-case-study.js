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
      heading: 'Why This Exists',
      paragraphs: [
        'Most lock operations are uncontended. Paying for a syscall, scheduler decision, and kernel lock queue on every successful acquire would make ordinary synchronization far too expensive.',
        'At the same time, pure spinning is not enough. If the owner is descheduled, blocked on I/O, or running a long critical section, waiters can burn whole CPU cores doing nothing useful. A real mutex needs a cheap user-space fast path and a way to sleep under contention.',
        'A futex is the narrow primitive that makes that split possible. User space owns the synchronization state. The kernel only provides an address-keyed place to park and wake threads when user-space atomics are no longer enough.',
        {type:'callout', text:'A futex is the kernel parking lot for a user-space predicate, closing the check-then-sleep race without charging every uncontended lock a syscall.'},
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        'The obvious first design is a spin lock: repeatedly load a shared word until it says free, then use compare-and-swap to take it. That keeps the uncontended path in user space, but it wastes CPU when the wait is long.',
        'The obvious second design is to check the word and then sleep if it is still locked. That creates the lost-wake race. A waiter can observe locked, get delayed before actually sleeping, and then miss the owner changing the word to free and sending a wake. The waiter can sleep forever after the event it needed has already happened.',
        'The wall is the gap between check and sleep. A correct blocking primitive needs one atomic operation that means: put this thread to sleep only if the futex word still equals the value I just observed.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'A futex splits the abstraction in two. The shared integer in user memory is the predicate: free or locked, count zero or nonzero, sequence number unchanged, barrier epoch not complete. The kernel wait queue is only the parking lot for threads waiting on that address.',
        'The kernel does not need to understand the whole mutex, semaphore, condition variable, or barrier. It only needs to compare the integer with an expected value before blocking, remember sleepers by the futex address, and wake some number of them later.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the wait/wake handshake view, follow the futex word first. If the word says free, the CAS path succeeds without the kernel. If it says locked, the waiter enters FUTEX_WAIT with the address and the locked value it observed.',
        'In the lost wake case study view, focus on the moment between checking the word and sleeping. The bad waiter sleeps after the wake already happened. The futex waiter gives the expected value to the kernel, so the kernel can refuse to enqueue it if the word has already changed.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'A futex-backed mutex starts with a user-space atomic operation. A thread tries to change the word from free to locked. If that succeeds, there is no syscall and no scheduler involvement.',
        'If the word is already locked, the thread may mark that waiters exist and then call FUTEX_WAIT with two important pieces of data: the address of the futex word and the value that should still be present if sleeping is safe. The kernel checks the current value. If it differs, the call returns instead of blocking.',
        'If the value still matches, the kernel queues the thread in a wait bucket derived from the futex address and parks it. Later, the owner publishes the unlocked state in user space and calls FUTEX_WAKE on the same address. The kernel moves one or more waiters back to the run queue.',
        'The awakened thread does not own the lock yet. It returns to user space, reloads the word, and tries the atomic acquire again. Correct futex users wait in a loop around the predicate.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The compare-and-block step closes the lost-wake gap. If unlock already changed the word, the expected value no longer matches and the waiter does not sleep. If the word is still locked, the kernel queues the waiter before it sleeps, so a later wake can find it.',
        'The retry loop handles everything futex wake deliberately does not promise. A wake may be racing with another acquire. More than one waiter may wake. A signal may interrupt the wait. A timeout may expire. The only safe rule is to recheck the user-space predicate after every return from the kernel.',
        'Memory ordering is part of the higher-level primitive. The futex syscall parks and wakes threads; it does not automatically publish protected data. The lock implementation still needs acquire and release ordering around the user-space word.',
      ],
    },
    {
      heading: 'Worked Case Study',
      paragraphs: [
        'Thread A owns a lock, so the futex word is 1. Thread B reads 1 and plans to sleep. Before B reaches the kernel, A stores 0 and calls wake. In a naive design, wake sees no sleepers, B sleeps afterward, and the program can hang.',
        'With FUTEX_WAIT, B passes expected value 1 to the kernel. The kernel rereads the word as part of the wait operation. Because A already changed the word to 0, the value does not match and B is not queued. B returns to user space, sees the lock is free, and competes to acquire it.',
        'If A had not unlocked yet, the word would still be 1. In that case the kernel would queue B before sleeping it, and A later waking the futex address would make B runnable again. Both sides of the race are covered by the same expected-value check.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'The uncontended path is extremely cheap: a few user-space atomic instructions. The contended path is much more expensive: syscall entry, futex hash-bucket lookup, queue manipulation, scheduler work, and a later wakeup.',
        'Futexes are intentionally weak. They do not guarantee fairness by themselves. They do not transfer ownership. They do not prevent priority inversion unless the higher-level primitive uses priority-inheritance variants. They do not decide whether to wake one waiter, many waiters, or all waiters.',
        'The address-keyed design also has sharp edges. Shared mappings, process-private versus process-shared futexes, timeouts, signals, cancellation, robust mutex cleanup, and spurious wakeups all have to be handled by the code that builds the real synchronization primitive.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Futexes win under mutexes, condition variables, semaphores, barriers, and runtime parking lots where the common case should never enter the kernel but the contended case must stop burning CPU.',
        'They are especially strong when contention is occasional and wait duration is unpredictable. Short waits can spin briefly; longer waits can park; uncontended operations remain cheap.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'A futex fails as an abstraction if the programmer treats it as a complete lock. It is only a wait queue tied to a memory word. Fairness, recursion, ownership tracking, condition-variable semantics, and priority behavior must be designed above it.',
        'It also fails when code waits without a loop, ignores interrupted waits, uses the wrong expected value, or forgets the atomic memory-ordering rules around the protected data. Those bugs are hard because the fast path may work for a long time before one unlucky interleaving exposes the race.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: Linux futex man page at https://man7.org/linux/man-pages/man2/futex.2.html, futex overview at https://man7.org/linux/man-pages/man7/futex.7.html, and Ulrich Drepper futex notes at https://akkadia.org/drepper/futex.pdf. Study Semaphore Permit Counter, MCS Queue Lock, Lock-Free Queue, Backpressure & Flow Control, and Logical Clocks next.',
      ],
    },
  ],
};
