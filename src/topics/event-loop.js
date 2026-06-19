// The event loop: JavaScript's one thread, two waiting rooms, and the strict
// etiquette deciding who runs next. Why setTimeout(0) is never 0, why
// promises jump the queue, and how "async" code can still freeze a page.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'event-loop',
  title: 'The Event Loop',
  category: 'Systems',
  summary: "One thread, two queues, strict etiquette: why setTimeout(0) isn't 0 and promises jump the line.",
  controls: [
    { id: 'view', label: 'Explain', type: 'select', options: ['why the order is A B C D', 'how microtasks starve rendering'], defaultValue: 'why the order is A B C D' },
  ],
  run,
};

// One snapshot of the runtime: a call stack column, two queue columns, and
// the console output along the bottom — all as positioned graph nodes.
function runtime({ stack = [], micro = [], macro = [], out = [], renderNote = '' }) {
  const nodes = [
    { id: 'hStack', label: 'CALL STACK', x: 1.5, y: 6.4 },
    { id: 'hMicro', label: 'MICROTASKS', x: 5, y: 6.4, note: 'promises' },
    { id: 'hMacro', label: 'TASKS', x: 8.5, y: 6.4, note: 'timers, clicks' },
    ...stack.map((f, i) => ({ id: f.id, label: f.label, x: 1.5, y: 5.3 - i * 1.1, note: f.note ?? '' })),
    ...micro.map((m, i) => ({ id: m.id, label: m.label, x: 5, y: 5.3 - i * 1.1, note: m.note ?? '' })),
    ...macro.map((m, i) => ({ id: m.id, label: m.label, x: 8.5, y: 5.3 - i * 1.1, note: m.note ?? '' })),
    { id: 'console', label: 'console:', x: 1.5, y: 0.6, note: '' },
    ...out.map((o, i) => ({ id: `o${o}`, label: o, x: 3 + i * 1.2, y: 0.6 })),
  ];
  if (renderNote) nodes.push({ id: 'render', label: 'RENDER', x: 8.5, y: 0.6, note: renderNote });
  return graphState({ nodes, edges: [] });
}

function* orderABCD() {
  yield {
    state: runtime({ stack: [{ id: 'fMain', label: 'script()' }] }),
    highlight: { active: ['fMain'] },
    explanation: "The example has four operations: log A, schedule timer D, schedule promise microtask C, log B. The animation separates the call stack from two queues. The whole script starts as one task on the stack, so nothing queued can run until it finishes.",
  };

  yield {
    state: runtime({ stack: [{ id: 'fMain', label: 'script()' }, { id: 'fLog', label: "log('A')" }], out: ['A'] }),
    highlight: { active: ['fLog'], found: ['oA'] },
    explanation: "Line 1: console.log('A') is pushed, prints, pops. Synchronous code is just stack discipline — nothing exotic yet. Output so far: A.",
  };

  yield {
    state: runtime({
      stack: [{ id: 'fMain', label: 'script()' }, { id: 'fSet', label: 'setTimeout(→D, 0)' }],
      macro: [{ id: 'tD', label: "→ log('D')", note: 'timer done' }],
      out: ['A'],
    }),
    highlight: { active: ['fSet'], visited: ['tD'] },
    explanation: "Line 2: setTimeout(..., 0) hands a callback to the host timer system. When the timer is ready, the callback enters the task queue. It still waits for the current stack to empty and for earlier tasks to finish; zero delay means eligible soon, not interrupt now.",
    invariant: 'Queued work never interrupts running code — a task waits for an empty call stack.',
  };

  yield {
    state: runtime({
      stack: [{ id: 'fMain', label: 'script()' }, { id: 'fThen', label: '.then(→C)' }],
      micro: [{ id: 'mC', label: "→ log('C')" }],
      macro: [{ id: 'tD', label: "→ log('D')" }],
      out: ['A'],
    }),
    highlight: { active: ['fThen'], visited: ['mC'] },
    explanation: "Line 3: Promise.then schedules a microtask once the promise is resolved. This callback also cannot interrupt the current script, but it will run before the next task when the stack becomes empty.",
  };

  yield {
    state: runtime({
      stack: [{ id: 'fMain', label: 'script()' }, { id: 'fLogB', label: "log('B')" }],
      micro: [{ id: 'mC', label: "→ log('C')" }],
      macro: [{ id: 'tD', label: "→ log('D')" }],
      out: ['A', 'B'],
    }),
    highlight: { active: ['fLogB'], found: ['oB'] },
    explanation: "Line 4: console.log('B') prints. Note the running tally — A, then B — while both queued callbacks watch from the sidelines. The script is done; script() pops; the stack is about to hit empty. NOW the event loop wakes up.",
  };

  yield {
    state: runtime({
      stack: [{ id: 'fC', label: "log('C')" }],
      macro: [{ id: 'tD', label: "→ log('D')" }],
      out: ['A', 'B', 'C'],
    }),
    highlight: { active: ['fC'], found: ['oC'] },
    explanation: "When the stack empties, the runtime drains microtasks before taking another task. That priority is why C prints before the ready timer D. Microtasks are for immediate consistency work, not for long-running loops.",
    invariant: 'Between tasks, the microtask queue is drained to empty — every microtask, plus any it spawns.',
  };

  yield {
    state: runtime({
      stack: [{ id: 'fD', label: "log('D')" }],
      out: ['A', 'B', 'C', 'D'],
      renderNote: 'got a turn ✓',
    }),
    highlight: { active: ['fD'], found: ['oD'] },
    explanation: "After microtasks drain, the browser may render, then the event loop takes one task. The timer finally runs and prints D. The final order is synchronous work first, microtasks at the checkpoint, then later tasks.",
  };
}

function* starvation() {
  yield {
    state: runtime({
      stack: [{ id: 'c1', label: 'chain() #1' }],
      micro: [{ id: 'c2', label: '→ chain() #2' }],
      renderNote: 'waiting…',
    }),
    highlight: { active: ['c1'], visited: ['c2'] },
    explanation: "The starvation view shows a common bug: each microtask queues the next microtask before returning. Each callback is small, but the queue never reaches empty, so the browser never gets to rendering or input tasks.",
  };

  yield {
    state: runtime({
      stack: [{ id: 'c2', label: 'chain() #2' }],
      micro: [{ id: 'c3', label: '→ chain() #3' }],
      renderNote: '1 frame missed',
    }),
    highlight: { active: ['c2'], visited: ['c3'] },
    explanation: "The render slot waits because microtask checkpoints must drain to empty. A self-refilling microtask queue keeps the runtime in the same priority lane forever.",
  };

  yield {
    state: runtime({
      stack: [{ id: 'c3', label: 'chain() #3' }],
      micro: [{ id: 'c4', label: '→ chain() #4' }],
      renderNote: 'STARVED — page frozen',
    }),
    highlight: { active: ['c3'], compare: ['render'] },
    explanation: "By the third generation, the page is effectively frozen: no paints, no click handlers, no timer tasks. Async syntax did not create a yield point; it created more high-priority work.",
    invariant: 'Rendering and tasks wait for an empty microtask queue — a self-refilling one blocks them forever.',
  };

  yield {
    state: runtime({
      stack: [{ id: 'c1', label: 'chain() #1' }],
      macro: [{ id: 'c2', label: '→ chain() #2', note: 'timer' }],
      renderNote: 'runs every gap ✓',
    }),
    highlight: { active: ['c1'], found: ['render'] },
    explanation: "Moving the next chunk to setTimeout puts it in the task queue, so rendering and input can interleave between chunks. For visual work use requestAnimationFrame; for CPU-heavy work use a worker. The practical skill is choosing the right queue.",
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why the order is A B C D') yield* orderABCD();
  else if (view === 'how microtasks starve rendering') yield* starvation();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows three columns: the call stack on the left, the microtask queue in the center, and the task queue on the right. Console output appears along the bottom. Watch the call stack first. Anything on the stack is running now; nothing in either queue can interrupt it.',
        'In the A B C D view, follow the stack as it executes the script, then empties. The microtask column drains before the task column gets a turn. That ordering is the entire lesson: synchronous code first, microtasks at the checkpoint, tasks after.',
        'In the starvation view, watch the RENDER note. It never clears because each microtask schedules another before the queue can empty. The bug is not a slow function; it is a scheduling pattern that denies the browser a checkpoint.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript usually runs user code on a single main thread. That thread also handles DOM updates, input events, timers, and rendering. Without a scheduling mechanism, every network request or timer would either block the thread or require the programmer to manage threads and locks manually.',
        'The event loop solves this by splitting work into turns. A piece of code enters the call stack, runs to completion, and returns control. The runtime then decides what runs next: pending microtasks, a rendering step, or the next queued task. Understanding this turn-based model explains UI freezes, promise timing, timer surprises, and why "async" does not mean "parallel."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The intuitive model is that async means concurrent. You call setTimeout or fetch, and the callback runs "later" while other code continues. For simple cases this mental model works: you fire a request, do other things, and eventually the response arrives.',
        'This model is close enough for writing basic async code. It breaks down when you need to predict execution order, diagnose a frozen UI, or understand why a zero-delay timer fires after a promise.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The intuitive model fails because it treats all async callbacks as equivalent. They are not. A promise .then callback and a setTimeout callback sit in different queues with different priority rules.',
        'More critically, the "later" in "runs later" is not a time delay. It means "after the current stack empties and any higher-priority queues drain." A zero-delay setTimeout does not mean zero milliseconds; it means the callback is eligible as soon as the task queue gets a turn, which is after all microtasks finish and the browser may have rendered a frame.',
        'The wall is exposed when a developer writes a promise chain that schedules more promises recursively. Each microtask is small, but the queue never empties, so timers never fire, click handlers never run, and the page freezes. The code looks async but behaves like an infinite synchronous loop.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Run-to-completion: once a JavaScript task starts executing, no other JavaScript code on the same thread can interrupt it. The runtime only makes scheduling decisions when the call stack is empty. This eliminates most data races inside ordinary JavaScript but makes the programmer responsible for keeping each turn short.',
        'Queue priority: the runtime does not treat all waiting callbacks equally. After a task finishes and the stack empties, it drains the entire microtask queue (including any microtasks added during draining) before considering the next task or rendering. This two-tier system is why Promise.then runs before setTimeout(fn, 0), every time.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The call stack tracks currently executing functions. Synchronous calls push frames; returns pop them. The stack is the only place JavaScript actually runs.',
        'The task queue (macrotask queue) holds callbacks from setTimeout, setInterval, I/O completions, DOM events, and MessageChannel. After the current task finishes and microtasks drain, the browser may render, then it dequeues one task and pushes it onto the call stack.',
        'The microtask queue holds promise .then/.catch/.finally callbacks, queueMicrotask callbacks, and MutationObserver notifications. When the call stack empties after any task, the runtime processes every microtask in the queue, including any new microtasks added during processing, before doing anything else. This is the microtask checkpoint.',
        'The browser rendering pipeline runs between tasks when the browser decides a repaint is needed. requestAnimationFrame callbacks fire just before this paint step. requestIdleCallback fires when the browser has spare time after painting. Neither can run while the microtask queue is draining or while a task occupies the call stack.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider this code: console.log("A"); setTimeout(() => console.log("D"), 0); Promise.resolve().then(() => console.log("C")); console.log("B").',
        'Step 1: The entire script is one task. It pushes onto the call stack and begins executing.',
        'Step 2: console.log("A") runs synchronously. Output: A.',
        'Step 3: setTimeout registers a timer with delay 0. The browser starts the timer and will enqueue the callback into the task queue when it expires. The callback is not on the stack; it is waiting.',
        'Step 4: Promise.resolve() creates an already-resolved promise. .then(cb) schedules the callback into the microtask queue. It cannot run yet because the script task is still on the stack.',
        'Step 5: console.log("B") runs synchronously. Output: A B.',
        'Step 6: The script task finishes and the call stack empties. The runtime hits the microtask checkpoint. The microtask queue has one entry: the promise callback logging C. It runs. Output: A B C.',
        'Step 7: The microtask queue is now empty. The browser may render. Then the event loop dequeues the next task: the timer callback. It runs and logs D. Output: A B C D.',
        'The key: C beats D not because it was scheduled first (both were scheduled during the same script), but because microtasks drain before the next task. Even if the timer expired instantly, its callback sits in the lower-priority task queue.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Run-to-completion prevents data races within a single turn. A click handler can read and write DOM state without worrying that another handler will mutate the same nodes mid-execution. This is the cooperative scheduling contract: the runtime never preempts your code, so each turn sees consistent state.',
        'Microtask priority exists for consistency. When a promise resolves, dependent code should observe the settled value before any other task can change the world. Draining all microtasks ensures that chained promise logic completes atomically from the perspective of the task queue.',
        'The invariant the animation makes visible: between any two tasks, the microtask queue is fully drained. Microtasks spawned by microtasks also drain before the next task. This is why recursive microtask scheduling is dangerous: the exit condition is an empty queue, not a time limit.',
      ],
    },
    {
      heading: 'The rendering pipeline',
      paragraphs: [
        'Browsers target roughly 60 frames per second, giving about 16.7 ms per frame. Each frame follows a pipeline: run a task, drain microtasks, then (if the browser decides to repaint) run requestAnimationFrame callbacks, recalculate styles, perform layout, paint, and composite.',
        'requestAnimationFrame is the correct place for visual updates tied to the next frame. Code scheduled here runs once per frame, right before the browser paints. This avoids redundant style recalculations from multiple DOM writes spread across separate tasks.',
        'requestIdleCallback runs during leftover time after painting, if any exists. It is for low-priority background work like analytics or prefetching. It receives a deadline object reporting how much idle time remains and should yield if the deadline is near.',
      ],
    },
    {
      heading: 'Node.js event loop phases',
      paragraphs: [
        'Node.js uses libuv to implement its event loop, which cycles through six phases: timers (setTimeout/setInterval callbacks whose delay has elapsed), pending callbacks (system-level callbacks like TCP errors), idle/prepare (internal), poll (retrieve new I/O events and execute I/O callbacks), check (setImmediate callbacks), and close callbacks (socket.on("close") and similar).',
        'Microtasks (promise callbacks and process.nextTick) run between every phase transition, not just after tasks. process.nextTick callbacks run before promise microtasks, which is a Node-specific ordering detail. This means nextTick can starve I/O just like recursive promise chains can starve rendering in the browser.',
        'setImmediate vs setTimeout(fn, 0): setImmediate runs in the check phase after poll completes, while setTimeout runs in the timers phase. Inside an I/O callback, setImmediate always fires first. Outside I/O, the order depends on system timer granularity and is not guaranteed. Use setImmediate when you want to yield to I/O; use setTimeout when you want a minimum delay.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Scheduling overhead is negligible: pushing a callback reference into a queue is O(1). The real cost is what callbacks do and how long they hold the call stack.',
        'At 60 fps, the frame budget is 16.7 ms. A task that runs for 200 ms blocks roughly 12 frames, causing visible jank. A self-refilling microtask chain is worse: it can starve all tasks, all rendering, and all input handling indefinitely because the microtask checkpoint has no time limit.',
        'The browser Long Tasks API flags any task exceeding 50 ms. In Node, the event loop utilization metric (ELU) measures how much time the loop spends in active callbacks versus waiting for I/O. Both are direct measures of event loop health.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'UI responsiveness: frameworks like React schedule reconciliation work in tasks and use microtasks for batched state updates so that multiple setState calls within one handler produce a single re-render.',
        'Server concurrency: Node.js handles thousands of concurrent connections on one thread because most server work (database queries, file reads, network calls) is I/O-bound. The event loop processes request callbacks between I/O completions without thread-per-request overhead.',
        'Animation: requestAnimationFrame aligns visual updates with the display refresh rate, preventing wasted paints and tearing. Game loops, scroll-linked effects, and canvas animations all use this slot.',
        'Chunked processing: large data transformations (parsing a big JSON file, processing a CSV) can be split into chunks scheduled via setTimeout or postMessage, letting the browser handle input and paint between chunks.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CPU-bound work blocks the loop regardless of async syntax. Awaiting a promise that wraps a synchronous 500 ms computation still freezes the page for 500 ms. The await keyword yields to the microtask queue, not to a parallel thread.',
        'Microtask starvation: a recursive promise chain or an unbounded MutationObserver can prevent the browser from ever reaching the rendering step. The starvation view in the animation demonstrates this: the page freezes even though each individual callback is tiny.',
        'Timer coalescing and clamping: browsers clamp nested setTimeout to a minimum of 4 ms after five nesting levels. Background tabs may throttle timers to once per second or less. Code that assumes precise timer resolution will behave differently across environments.',
        'The event loop cannot replace parallelism. Web Workers and worker_threads in Node exist because some workloads (image processing, cryptography, physics simulations) need real concurrent execution, not cooperative interleaving.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: the HTML Living Standard section 8.1.7 defines the browser event loop processing model, including the microtask checkpoint and rendering steps. The Node.js documentation on the event loop describes libuv phases and nextTick/microtask ordering.',
        'Prerequisites: study Stack and Queue to understand the data structures the event loop uses internally. Study Promises to understand why .then creates microtasks.',
        'Extensions: requestAnimationFrame Frame Budget for render-aligned scheduling. Web Workers for moving CPU work off the main thread. Browser Scheduler postTask for prioritized task scheduling. Async Context Propagation for tracking request-local state across await boundaries.',
        'Contrasting alternatives: Erlang and Go use preemptive lightweight threads. Rust Tokio and Python asyncio use cooperative async runtimes similar to JavaScript but with different queue structures. Understanding JavaScript\'s event loop makes these alternatives easier to compare.',
      ],
    },
  ],
};
