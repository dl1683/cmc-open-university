// Promise jobs and browser microtasks: queue ordering, checkpoints, starvation,
// unhandled rejection reporting, and when to yield to tasks or frames.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'javascript-promise-microtask-queue-case-study',
  title: 'Promise Microtask Queue',
  category: 'Systems',
  summary: 'A JavaScript runtime case study: Promise reactions, queueMicrotask, microtask checkpoints, render starvation, unhandled rejection reporting, and safe yielding.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['checkpoint order', 'starvation trap'], defaultValue: 'checkpoint order' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function loopGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'stack', label: 'stack', x: 0.7, y: 4.0, note: notes.stack ?? 'script' },
      { id: 'promise', label: 'then', x: 2.4, y: 2.4, note: notes.promise ?? 'job' },
      { id: 'microq', label: 'microQ', x: 4.1, y: 2.4, note: notes.microq ?? 'FIFO' },
      { id: 'check', label: 'checkpt', x: 5.8, y: 3.8, note: notes.check ?? 'drain all' },
      { id: 'taskq', label: 'taskQ', x: 4.1, y: 5.6, note: notes.taskq ?? 'timer/click' },
      { id: 'render', label: 'render', x: 7.5, y: 2.5, note: notes.render ?? 'after drain' },
      { id: 'next', label: 'next task', x: 8.8, y: 5.3, note: notes.next ?? 'one task' },
    ],
    edges: [
      { id: 'e-stack-promise', from: 'stack', to: 'promise', weight: '' },
      { id: 'e-promise-microq', from: 'promise', to: 'microq', weight: '' },
      { id: 'e-microq-check', from: 'microq', to: 'check', weight: '' },
      { id: 'e-stack-taskq', from: 'stack', to: 'taskq', weight: '' },
      { id: 'e-check-render', from: 'check', to: 'render', weight: '' },
      { id: 'e-check-next', from: 'check', to: 'next', weight: '' },
      { id: 'e-taskq-next', from: 'taskq', to: 'next', weight: '' },
    ],
  }, { title });
}

function* checkpointOrder() {
  yield {
    state: loopGraph('Promise reactions enter the microtask queue'),
    highlight: { active: ['stack', 'promise', 'microq', 'e-stack-promise', 'e-promise-microq'], compare: ['taskq'] },
    explanation: 'Promise.then, catch, finally, queueMicrotask, and some platform callbacks schedule microtasks. They do not interrupt the running script; they wait until the current JavaScript stack unwinds.',
    invariant: 'Microtasks run after the current stack, before the next task.',
  };

  yield {
    state: labelMatrix(
      'Classic ordering',
      [
        { id: 'syncA', label: 'sync A' },
        { id: 'then', label: 'then' },
        { id: 'timer', label: 'timer' },
        { id: 'syncB', label: 'sync B' },
      ],
      [
        { id: 'queue', label: 'queue' },
        { id: 'prints', label: 'prints' },
      ],
      [
        ['stack', '1st'],
        ['microQ', '3rd'],
        ['taskQ', '4th'],
        ['stack', '2nd'],
      ],
    ),
    highlight: { active: ['syncA:prints', 'syncB:prints', 'then:prints'], compare: ['timer:prints'] },
    explanation: 'Synchronous code runs first. The promise reaction runs during the microtask checkpoint. The zero-delay timer is ready as a task, but it still waits behind the checkpoint.',
  };

  yield {
    state: loopGraph('A checkpoint drains the whole microtask queue', { stack: 'empty', check: 'while nonempty', render: 'waits', next: 'waits' }),
    highlight: { active: ['microq', 'check', 'e-microq-check'], compare: ['render', 'next'] },
    explanation: 'The HTML standard describes a microtask checkpoint as a loop: while the microtask queue is not empty, dequeue and run the oldest microtask. Newly queued microtasks join the same drain.',
  };

  yield {
    state: labelMatrix(
      'Common producers',
      [
        { id: 'promise', label: 'Promise' },
        { id: 'queue', label: 'queueMicro' },
        { id: 'mut', label: 'MutationObs' },
        { id: 'timer', label: 'setTimeout' },
      ],
      [
        { id: 'lane', label: 'lane' },
        { id: 'goodFor', label: 'good for' },
      ],
      [
        ['microQ', 'settle follow'],
        ['microQ', 'same-turn fix'],
        ['microQ', 'DOM observe'],
        ['taskQ', 'yield'],
      ],
    ),
    highlight: { found: ['promise:lane', 'queue:lane', 'timer:goodFor'], compare: ['mut:lane'] },
    explanation: 'Microtasks are for immediate follow-up and consistency after the current call stack. Timers, message events, and input callbacks are tasks; they create a visible yield point for the browser.',
  };

  yield {
    state: labelMatrix(
      'Checkpoint side effects',
      [
        { id: 'reject', label: 'reject' },
        { id: 'idb', label: 'IDB tx' },
        { id: 'weak', label: 'WeakRef' },
        { id: 'paint', label: 'paint' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'why' , label: 'why' },
      ],
      [
        ['after drain', 'report'],
        ['after drain', 'cleanup'],
        ['after drain', 'clear kept'],
        ['after drain', 'frame turn'],
      ],
    ),
    highlight: { active: ['reject:when', 'idb:when'], found: ['paint:when'] },
    explanation: 'The checkpoint is also where the platform performs follow-up work such as rejected-promise notification and IndexedDB transaction cleanup. It is a real phase, not just trivia about Promise ordering.',
  };
}

function* starvationTrap() {
  yield {
    state: loopGraph('A microtask can enqueue another microtask', { microq: 'self refill', check: 'never empty', render: 'starved', next: 'starved' }),
    highlight: { active: ['promise', 'microq', 'check', 'e-promise-microq', 'e-microq-check'], removed: ['render', 'next'] },
    explanation: 'If every microtask queues another microtask, the checkpoint never reaches empty. The browser cannot move to the next task or render opportunity until the chain stops.',
    invariant: 'High priority becomes a bug when it never yields.',
  };

  yield {
    state: labelMatrix(
      'Starvation symptoms',
      [
        { id: 'click', label: 'click' },
        { id: 'paint', label: 'paint' },
        { id: 'timer', label: 'timer' },
        { id: 'promise', label: 'promise' },
      ],
      [
        { id: 'status', label: 'status' },
        { id: 'cause', label: 'cause' },
      ],
      [
        ['waiting', 'task blocked'],
        ['missed', 'no frame'],
        ['waiting', 'task blocked'],
        ['running', 'micro drain'],
      ],
    ),
    highlight: { removed: ['click:status', 'paint:status', 'timer:status'], active: ['promise:status'] },
    explanation: 'The page can look frozen even though each callback is short. The problem is not one long function; it is an endless sequence of high-priority callbacks.',
  };

  yield {
    state: loopGraph('Yield by scheduling the next chunk as a task', { promise: 'done', microq: 'empty', taskq: 'chunk N+1', render: 'frame', next: 'later' }),
    highlight: { found: ['render'], active: ['taskq', 'next', 'e-taskq-next'], compare: ['microq'] },
    explanation: 'Chunked work that needs responsiveness should eventually yield through a task, requestAnimationFrame, scheduler.postTask where available, or a worker. That gives input and rendering a chance to run.',
  };

  yield {
    state: labelMatrix(
      'Scheduling choices',
      [
        { id: 'promise', label: 'Promise' },
        { id: 'timer', label: 'timer' },
        { id: 'raf', label: 'rAF' },
        { id: 'worker', label: 'worker' },
      ],
      [
        { id: 'priority', label: 'priority' },
        { id: 'use', label: 'use' },
      ],
      [
        ['high', 'settle state'],
        ['task', 'yield work'],
        ['frame', 'visual write'],
        ['thread', 'CPU heavy'],
      ],
    ),
    highlight: { active: ['promise:priority'], found: ['timer:use', 'raf:use', 'worker:use'] },
    explanation: 'The right primitive depends on what you are protecting: promise consistency, user input, frame timing, or main-thread CPU. Microtasks are not a general background-work scheduler.',
  };

  yield {
    state: labelMatrix(
      'Debug checklist',
      [
        { id: 'long', label: 'long task' },
        { id: 'chain', label: 'chain' },
        { id: 'paint', label: 'paint gap' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'lookFor', label: 'look for' },
        { id: 'action', label: 'action' },
      ],
      [
        ['>50ms JS', 'split'],
        ['many thens', 'cap drain'],
        ['no frames', 'yield'],
        ['task/worker', 'measure'],
      ],
    ),
    highlight: { found: ['chain:lookFor', 'fix:action'], compare: ['long:lookFor'] },
    explanation: 'In traces, distinguish one long task from many microtasks. Both block responsiveness, but they need different fixes: split one function, or stop refilling the checkpoint forever.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'checkpoint order') yield* checkpointOrder();
  else if (view === 'starvation trap') yield* starvationTrap();
  else throw new InputError('Pick a microtask view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows one JavaScript event-loop turn. A task is ordinary work such as script start, a timer callback, input, or network callback. The call stack is the currently running JavaScript. A microtask is follow-up work, such as a Promise reaction or queueMicrotask callback, that runs after the stack clears and before the runtime moves to the next task.',
        'Active items are the current task, stack frame, or microtask being executed. Found markers show ordering that is now guaranteed, such as a Promise handler running before a zero-delay timer. Compare markers show work waiting in another queue. The starvation scene shows the key risk: a microtask that queues another microtask keeps the checkpoint alive.',
        {type:'callout', text:'The microtask queue is a scheduling boundary: stack work finishes first, promise reactions drain before rendering, and that ordering is both a correctness tool and a starvation risk.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript needs a follow-up lane for same-turn cleanup. Promises can settle during a task, but their reactions should not interrupt the current stack. Frameworks may batch state updates during a call and then flush once the stack is empty.',
        'The microtask queue gives the platform a checkpoint. At that checkpoint, Promise reactions, queueMicrotask callbacks, MutationObserver delivery, and rejection bookkeeping can run before timers, input callbacks, or rendering observe the next state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious mental model is that microtasks are faster timers. A developer replaces setTimeout(fn, 0) with Promise.resolve().then(fn) and sees the callback run sooner. For small ordering demos, that seems like the whole story.',
        'Another common mistake is treating async as off-thread. An async function continuation runs as JavaScript work on the same main thread unless it explicitly uses a worker or platform operation. If the continuation burns CPU, it blocks input and paint.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is queue priority. After a task finishes, the runtime drains microtasks until the queue is empty. If a microtask queues another microtask, the new one runs in the same checkpoint before the next task. There is no automatic render or input gap between them.',
        'That means small callbacks can create one large block of work. A page can freeze even when no single callback is huge. The browser is obeying the rule; the program used the wrong boundary for long work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Microtasks are a same-turn consistency boundary, not a background scheduler. They are right when code must run after the current stack but before outside tasks observe state. They are wrong when the work needs to yield for input, rendering, or long CPU processing.',
        'The invariant is drain-to-empty. Once the checkpoint starts, every queued microtask and every microtask queued by those microtasks runs before the next task. Correct code uses that invariant for small cleanup and breaks long work with a real yield.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A task starts when the event loop selects script, timer, input, network, or another task source. JavaScript runs until the call stack is empty. During that task, promises can settle and enqueue reactions as microtasks.',
        'At the checkpoint, the runtime removes the oldest microtask, runs it, and repeats until the queue is empty. Only after that can it move toward rendering or another task. That is why Promise.then runs before setTimeout(fn, 0) scheduled in the same turn.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The rule gives deterministic observation points. Synchronous code completes first. Promise reactions run after that code, not in the middle of it. Timers and input wait until the checkpoint finishes, so they do not observe half-flushed promise state.',
        'The same rule explains starvation. A self-refilling microtask chain keeps the queue nonempty, so the runtime cannot advance. The model is correct, but the program denied the event loop a yield point.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is total checkpoint time. If one microtask costs 0.2 ms and a chain queues 10,000 of them, the checkpoint costs about 2,000 ms. Users experience that as a two-second freeze because rendering and input wait behind the drain.',
        'Debugging is harder because traces may show one ordinary task containing many promise reactions. The fix is to choose the correct boundary: microtask for short state consistency, requestAnimationFrame for visual work, setTimeout or scheduler.postTask for yielding tasks, and workers for CPU-heavy work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Microtasks fit Promise continuations, small cleanup after synchronous mutation, framework flushes, and APIs that must run before another task observes state. The common pattern is finish this turn, not process the whole workload.',
        'They also fit rejection timing. The platform can wait until the checkpoint to see whether a handler was attached before reporting an unhandled rejection. That is another case where same-turn bookkeeping needs a precise phase.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Microtasks fail as a chunking strategy for large CPU work. Applying 20,000 row updates by queueing one microtask per row can freeze the page because all rows can run in one checkpoint. Use tasks, frame callbacks, idle periods, or workers when user responsiveness matters.',
        'They also fail when code assumes promise ordering is the same as render ordering. DOM writes inside microtasks may happen before paint, but too much work can delay that paint. Visual updates should be scheduled around frame boundaries when the user needs to see progress.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Run this order: log A synchronously; queue a Promise reaction that logs B; set a zero-delay timer that logs C; then log D. The stack prints A, schedules the promise reaction, schedules the timer task, then prints D. The stack is now empty, so the microtask checkpoint prints B before the timer task prints C. The output is A, D, B, C.',
        'Now make the microtask refill itself 50,000 times, with each callback costing 0.05 ms. The total checkpoint is about 2,500 ms. The timer is ready almost immediately, but it cannot run until the queue empties. A user click and a paint opportunity also wait, so the page appears stuck even though each individual callback is small.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN microtask guide at https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide, MDN queueMicrotask at https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask, and the HTML Standard event loop processing model at https://html.spec.whatwg.org/multipage/webappapis.html.',
        'Study the event loop, call stack, task queue, Promise jobs, MutationObserver, requestAnimationFrame, scheduler.postTask, requestIdleCallback, Web Workers, rendering pipeline, and backpressure next. The practical review question is whether every long chain has a guaranteed yield point.',
      ],
    },
  ],
};