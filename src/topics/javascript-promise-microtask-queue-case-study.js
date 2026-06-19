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
        "Read the animation as the execution trace for Promise Microtask Queue. A JavaScript runtime case study: Promise reactions, queueMicrotask, microtask checkpoints, render starvation, unhandled rejection reporting, and safe yielding..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript needs a way to finish same-turn cleanup after the current call stack but before timers, input callbacks, or rendering observe the next state. Promise reactions, queueMicrotask callbacks, MutationObserver delivery, and some platform cleanup use the microtask queue for that follow-up lane.',
        'This is why promise handlers can run before a zero-delay timer. The useful idea is not speed. It is consistency: the platform gets a checkpoint where settled promises, mutation records, rejected-promise reporting, and small framework flushes can complete before the browser moves to the next ordinary task.',
        'The danger is that a high-priority lane can become a starvation lane. If microtasks keep enqueuing more microtasks, the browser cannot proceed to the next task or render opportunity. The page can feel frozen even though no single callback is large.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first mistake is treating a microtask as a faster setTimeout. That model works for tiny ordering demos, then breaks as soon as code chains work through Promise.then and wonders why clicks, timers, and paint stopped moving.',
        'A task yields the event loop after it finishes. A microtask checkpoint does not yield until the microtask queue is empty. Replacing chunked tasks with a self-refilling microtask chain removes the visible gap the browser needs for input and rendering.',
        'Another shortcut is assuming async means off-thread. An async function continuation still runs on the JavaScript thread. If the continuation performs expensive work, it blocks input and rendering just like ordinary synchronous JavaScript.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The invariant is simple: after the stack empties, the browser keeps running the oldest queued microtask until the microtask queue is empty. If a running microtask queues another microtask, that new job joins the same drain before the next task.',
        'That rule makes same-turn state reliable, but it also makes starvation possible. Total cost is the sum of every microtask in the checkpoint, not the cost of one callback. Long chains need an explicit yield through a task, requestAnimationFrame, scheduler.postTask where available, or a worker.',
        'The decision is not "microtask or timeout" in the abstract. It is which boundary the work needs. Promise consistency wants a microtask. User input, rendering, and CPU-heavy chunks need a real yield.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A task begins when the event loop runs script, a timer callback, an input callback, a network callback, or another task source. That task runs JavaScript until the stack is empty. During the task, promises can settle and queue reactions as microtasks.',
        'At the microtask checkpoint, the runtime drains the microtask queue in FIFO order. Promise reactions and queueMicrotask callbacks run there. If one callback queues another microtask, the new callback is added to the same queue and runs before the browser advances.',
        'Only after the checkpoint can the event loop move toward rendering or the next task. That is why a zero-delay timer waits behind a resolved Promise reaction. It is also why endless promise chains can starve timers, clicks, and frames.',
        'The platform also uses the checkpoint for follow-up duties such as rejected-promise reporting and some cleanup work. Treat it as a phase in the event loop, not just a trivia answer about Promise ordering.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'Watch the task, stack, and microtask queue as separate lanes. Synchronous code runs first. Promise reactions wait until the stack unwinds. The timer may already be ready, but it cannot run until the checkpoint drains.',
        'The starvation scene is the important one. Nothing in it is a single giant callback. The freeze comes from the invariant being obeyed too well: each microtask refills the queue before the browser can advance to a task or render opportunity.',
        'The scheduling table proves that the right primitive depends on what you are protecting. Promise consistency belongs in the microtask lane. Visual writes belong near requestAnimationFrame. Long CPU work belongs in a worker or a bounded task scheduler.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Microtasks work because they create a deterministic cleanup boundary. Libraries can batch state changes during a task, then flush after the call stack unwinds but before outside tasks observe partially updated state.',
        'They also work because Promise continuation ordering becomes predictable. Code after a synchronous call finishes before then callbacks, and then callbacks finish before timers. That gives JavaScript a reliable way to settle async reactions without interrupting the current stack.',
        'The same rule explains the failure mode. A tool that is ideal for small consistency work is harmful when used as an infinite or large work queue.',
        'The model is small enough to use during code review. Ask which queue the callback enters, when the current stack unwinds, whether new callbacks join the same checkpoint, and where the browser gets a chance to paint or handle input.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is responsiveness risk. Microtasks have priority over tasks and rendering, so a long chain can block the very browser work that users care about. The code may be split into many small callbacks and still create one large checkpoint.',
        'There is also observability complexity. A trace may show one task containing many promise reactions rather than one obvious long function. Debugging requires distinguishing a long callback from a self-refilling microtask chain.',
        'The tradeoff is precision versus yielding. Microtasks give same-turn consistency. Tasks, rAF, postTask, idle callbacks, and workers give the browser room to process input, frames, and background work.',
        'That tradeoff should be encoded in APIs. A helper named flushNow can reasonably use a microtask; a helper named processAllRows should probably include a task or worker boundary.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Use microtasks for short consistency work: promise continuation, cleanup after a synchronous mutation batch, internal framework flushes, and APIs that must run after the current stack but before outside observers see another task.',
        'A data grid can use a microtask to settle one batch boundary, then schedule the next visible slice as a task or frame callback. That keeps state coherent without hiding all progress behind the checkpoint.',
        'Frameworks use this idea to batch updates and avoid exposing half-finished internal state. The key word is short: microtasks are for completing a turn, not for doing the work of an entire feature.',
        'It also fits error and rejection handling. Promise rejection reporting waits until the checkpoint can see whether a handler was attached, which is another example of same-turn cleanup needing a precise boundary.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Microtasks fail as a background-work scheduler. Applying 20,000 row updates by queuing one microtask per row can freeze the page because input and paint wait behind the same never-empty checkpoint. CPU-heavy work belongs in bounded tasks or a worker; visual DOM writes belong near requestAnimationFrame.',
        'Async code is not automatically nonblocking. An async function resumes through promise jobs, and expensive JavaScript inside that continuation still occupies the main thread. Unhandled rejection timing is another reason to think of the checkpoint as a platform phase, not only queue trivia.',
        'A practical review question is simple: does this chain have a guaranteed yield point? If not, it can starve the browser under larger inputs even when the demo looks fine.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN microtask guide at https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide, MDN queueMicrotask at https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask, and the HTML Standard event loop processing model at https://html.spec.whatwg.org/multipage/webappapis.html. Study The Event Loop, Queue, Stack, Browser Scheduler postTask Priority Queue, requestIdleCallback Idle Deadline Queue, Async Context Propagation, How a Browser Paints a Page, Web Workers, Browser Message Channels & Broadcast Coordination, Backpressure & Flow Control, and React Fiber Scheduler Case Study next.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
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
        'Use this topic as a checkpoint: if you can explain why Promise Microtask Queue moves from input to output in the animation and where it fails, you are ready for the next topic.',
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

