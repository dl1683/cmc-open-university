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
      heading: 'What it is',
      paragraphs: [
        'The Promise microtask queue is the high-priority follow-up lane in browser JavaScript. Promise reactions, queueMicrotask callbacks, and some platform callbacks run after the current JavaScript stack empties and before the browser advances to the next ordinary task.',
        'This is the deeper version of The Event Loop page. The core idea is not just "promises beat timers." It is that the browser runs a microtask checkpoint, drains the microtask queue to empty, performs platform cleanup such as rejected-promise notification, and only then proceeds to rendering or another task.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A script starts on the stack. Promise.then schedules a reaction job once the promise is settled. setTimeout schedules a task. When the current stack unwinds, the event loop performs a checkpoint and runs all queued microtasks. If a microtask queues another microtask, the new one runs before the next task too.',
        'The HTML Standard describes this explicitly: a checkpoint keeps dequeuing and running microtasks while the microtask queue is not empty. MDN highlights the two practical differences from tasks: checkpoints can run multiple times per event-loop iteration, and a self-refilling microtask queue can starve the event loop.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Microtasks are useful because they preserve same-turn consistency. A promise library can settle state, then run handlers before timers or input callbacks observe a half-updated world. MutationObserver can report DOM changes after a batch of synchronous mutations. Frameworks can flush small internal queues promptly.',
        'The cost is starvation risk. A chain of microtasks can block input, timers, and rendering without any single callback looking expensive. Work that should let users see progress must eventually yield through a task, requestAnimationFrame, a scheduler API, or a worker.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a data grid that applies 20,000 row updates. If every microtask processes one row and queues the next microtask, the UI may freeze because the checkpoint never empties. A better design processes a bounded batch, commits state, then schedules the next batch as a task or frame callback. The grid remains consistent at boundaries while clicks and paints get time.',
        'If the row processing itself is CPU-heavy, Web Workers: A Second Thread is the stronger tool. If the result is a visual update, How a Browser Paints a Page explains why requestAnimationFrame is the right place to perform frame-bound DOM writes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not teach microtasks as simply "faster setTimeout." They have a different semantic role. They are for immediate consistency after the current stack, not for indefinite background work. Do not assume async means nonblocking: async functions resume through promise jobs and can still run expensive JavaScript when resumed.',
        'Unhandled rejection timing is another subtlety. The platform waits until the checkpoint gives promise handlers a chance to attach before reporting unhandled rejections. That timing is one reason the checkpoint is a platform phase, not only a queue-ordering trick.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN microtask guide at https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide, MDN queueMicrotask at https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask, and the HTML Standard event loop processing model at https://html.spec.whatwg.org/multipage/webappapis.html. Study The Event Loop, Queue, Stack, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, Async Context Propagation, How a Browser Paints a Page, Web Workers, Browser Message Channels & Broadcast Coordination, Backpressure & Flow Control, and React Fiber Scheduler Case Study next.',
      ],
    },
  ],
};
