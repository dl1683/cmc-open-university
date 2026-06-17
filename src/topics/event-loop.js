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

const legacyArticle = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `The Event Loop is the rulebook that lets one JavaScript thread feel asynchronous. There is one call Stack, where currently running functions live, and waiting work sits in queues. Promise reactions go to the microtask queue. Timers, clicks, network callbacks, and messages go to the task Queue. When the stack empties, the browser drains all microtasks, may give rendering a chance, then runs one task and repeats.`,
        `That rule explains the demo's famous output: A and B print synchronously, C prints from a promise microtask, and D prints later from a zero-delay timer task. "Zero" means the timer is ready, not that it can interrupt running code already on the stack at all.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Synchronous function calls push and pop on the stack immediately. setTimeout is provided by the host environment; it starts a timer and later places the callback in the task queue. Promise.then places its callback in the microtask queue once the promise settles. The current script keeps running until it finishes. Only then can queued callbacks move onto the stack. Browser and Node.js event loops have different host phases, but this promise-before-timer intuition is the core behavior students need first.`,
        `The visualization lays out those three buckets side by side. In the starvation view, a microtask schedules another microtask before finishing. Because the runtime must drain microtasks to empty before moving on, the queue never clears. How a Browser Paints a Page shows the damage: no render slot, no click handling, no visible progress, even though each individual callback is small.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `Track the call stack first. Anything on the stack is running now, and queued callbacks cannot interrupt it. Then look at the microtask column and the task column. Their order matters more than the order in which the callbacks became ready.`,
        `For the A B C D view, the story is stack, microtask checkpoint, task. A and B come from the original script. C runs when microtasks drain. D waits for the later task turn even though the timer delay was zero.`,
        `For the starvation view, watch the render note. It never gets a real gap because each microtask schedules the next one. The bug is not one slow function; it is a scheduling pattern that denies the browser a checkpoint for paint and input.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Scheduling overhead is tiny compared with the work callbacks do, but responsiveness is bounded by task length. At 60 frames per second a page has about 16.7 ms for JavaScript, style, layout, paint, and composite. A 200 ms task misses roughly 12 frames. A self-refilling microtask chain is worse because it can starve every task and every paint indefinitely. The demo's fix, requeueing with setTimeout instead of Promise.then, moves the next chunk into the task queue so rendering can breathe between chunks. Production code often slices long work into batches for exactly this reason.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Promises are right for immediate follow-up work such as resolving dependencies or updating in-memory state. setTimeout is a yield point for chunked work that should let input and paint interleave. requestAnimationFrame Frame Budget shows the frame-aligned path for work tied to the next repaint. Web Workers: A Second Thread moves CPU-heavy work off the main thread entirely. Service Workers & Offline-First use a related event-driven model, but their fetch events live in a worker-like context rather than the page's main thread.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The main misconception is that "async" means "nonblocking." Awaiting I/O yields; computing for 800 ms does not. Another trap is thinking microtasks are always better. They are higher priority, which is useful for consistency but dangerous for long or self-scheduling work. Virtual DOM Reconciliation also runs inside tasks; a slow diff blocks clicks just like a slow parser. The browser APIs are host machinery around JavaScript, not magic inside the language.`,
      ],
    },
    {
      heading: `Practical guidance`,
      paragraphs: [
        `Use microtasks for short follow-up work that must happen before the next task observes state. Use tasks when a chunk of work should let input and rendering interleave. Use requestAnimationFrame when the work exists to produce the next visual frame.`,
        `If a page feels frozen, inspect long tasks and self-scheduling microtasks before blaming rendering. Breaking work into chunks only helps if the chunks yield to the right queue.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Stack and Queue for the two basic data structures on screen. Promise Microtask Queue goes deeper on Promise reactions, queueMicrotask, checkpoints, and starvation. Browser Scheduler postTask Priority Queue shows the native priority layer for app-owned tasks, while requestIdleCallback Idle Deadline Queue shows the low-priority leftover-time lane. requestAnimationFrame Frame Budget shows the render-aligned slot that follows those queues. Async Context Propagation shows how request-local values survive promise, timer, and callback hops. React Suspense Resource Cache shows how pending promises become UI boundaries, while UI State Machine Workflow shows how DOM events, promise completions, timers, and cancellations become explicit workflow events. Then read How a Browser Paints a Page, DOM Event Propagation & Path, Web Workers: A Second Thread, Service Workers & Offline-First, epoll Interest & Ready Lists, and io_uring Submission & Completion Rings for host-level evented I/O. Message Queues, Backpressure & Flow Control, and Distributed Tracing show the same scheduling problem after callbacks become cross-service messages instead of in-page functions.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'The event loop exists because JavaScript usually runs user code on one main thread while still needing responsive I/O, timers, rendering, user input, and promises. The runtime cannot block the whole interface every time a network request starts.',
        'Instead, JavaScript code runs in turns. A task enters the call stack, runs to completion, and then the runtime chooses what to do next. Understanding those turns explains UI freezes, promise timing, timer surprises, and why async code is not the same thing as parallel code.',
      ],
    },
    {
      heading: 'The obvious model',
      paragraphs: [
        'The obvious model is that async means code runs at the same time. In browser JavaScript, that is usually false for the main thread. Async APIs let work wait outside the stack and schedule callbacks later, but your JavaScript callback still runs when the event loop gives it a turn.',
        'Another misleading model is that setTimeout with zero delay runs immediately. It does not. It schedules a future task. Microtasks such as promise reactions can run before that task, and rendering has its own place in the browser loop.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is run-to-completion. Once a JavaScript task starts, no other JavaScript task interrupts it on the same thread. That makes local reasoning simpler, but it also means long CPU work blocks input, rendering, timers, and promise continuations.',
        'The second insight is queue priority. Macrotasks, microtasks, rendering, and host-specific queues do not all behave the same. Promise callbacks usually run in the microtask checkpoint after the current task, before the browser takes the next task.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Synchronous code enters the call stack and runs until the stack is empty. APIs such as timers, fetch, DOM events, and message channels arrange for future work to be queued. When the current task finishes, the runtime drains microtasks, may render, and then picks another task.',
        'Promise then handlers and async-await continuations are microtasks. A chain of microtasks can run before timers or input tasks get another turn. That is useful for consistency after a promise settles, but it can starve the page if code recursively schedules more microtasks.',
        'Browsers and Node have different host details. Browsers integrate rendering, input, and DOM tasks. Node integrates phases for timers, pending callbacks, poll, check, and close callbacks, plus microtask handling. The teaching invariant is still turn-based execution.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The stack view proves that JavaScript does not pause one function halfway through to run another callback. The current task must return. If it performs a long loop, the event loop cannot rescue responsiveness until that loop yields.',
        'The microtask view proves why promise callbacks can beat timers. A timer callback may already be ready, but the runtime drains the microtask queue first. This explains many order-of-logging puzzles and real UI starvation bugs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Run-to-completion avoids many shared-memory races inside ordinary JavaScript. A callback can assume that its local synchronous block will not be interrupted by another DOM event handler mutating the same state halfway through.',
        'The cost is cooperative scheduling. The runtime can schedule between turns, not inside your long turn. Code that needs responsiveness must yield with tasks, animation frames, workers, streams, or chunked processing.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The event loop is cheap when tasks are short. The expensive part is misuse: long CPU tasks block rendering and input; unbounded microtask chains starve timers; excessive timers create scheduling overhead; too many DOM changes can force layout work around the loop.',
        'Choosing the right queue matters. requestAnimationFrame is for visual updates before paint. requestIdleCallback is for best-effort background work. Web Workers are for CPU work off the main thread. Promises are for sequencing async results, not for making CPU loops parallel.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The event loop wins for UI programming, network-heavy applications, server request handling, and any workload dominated by waiting on external events. A single thread can keep many operations in flight because it does not block while each operation waits.',
        'It is also a useful architecture pattern. Message queues, actors, GUI loops, and async runtimes all rely on short units of work processed by a scheduler. JavaScript makes that model visible because the main thread is shared with the user interface.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The main failure is blocking the loop. JSON parsing a huge payload, rendering too much DOM, running a synchronous compression routine, or looping over millions of items can freeze the page. The fix is to move work off-thread or split it into chunks.',
        'Another failure is microtask starvation. A promise callback that schedules another promise callback forever can prevent timers and rendering from running. Microtasks are powerful because they run soon; that also makes them dangerous when unbounded.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider console.log("A"), setTimeout(() => log("B"), 0), Promise.resolve().then(() => log("C")), and console.log("D"). The synchronous logs run first, so A and D appear before callbacks. Then the promise microtask runs, so C appears before the timer task B.',
        'That ordering is not trivia. It explains why promise-heavy code can update state before a timer observes it. It also explains why a timer is not a reliable way to run before promise continuations queued by the current task.',
        'Now add a long while loop after scheduling both callbacks. Neither callback runs until the loop ends. Async scheduling does not preempt CPU work. The event loop can only choose the next item after the current turn returns control.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Keep main-thread tasks short. For UI code, anything above a frame budget can cause visible jank. Split long work into chunks, use requestAnimationFrame for visual updates, or move CPU-heavy work to a worker.',
        'Use microtasks for immediate follow-up after the current call stack, not for long-running loops. Use task queues or animation frames when the browser needs a chance to handle input and paint between chunks.',
        'Measure with real tools. Long-task observers, performance marks, browser devtools, and frame-rate traces show whether a page is blocked. Guessing from code structure is often wrong because layout, parsing, and rendering add host work around JavaScript.',
      ],
    },
    {
      heading: 'How to choose the queue',
      paragraphs: [
        'Use a promise or queueMicrotask when follow-up work must run after the current stack but before the next task. Use setTimeout or postMessage-style task scheduling when other events deserve a chance to run first. Use requestAnimationFrame when the work prepares the next paint.',
        'Use requestIdleCallback only for work that can be delayed or skipped. It is not a reliable deadline for important user-visible work. Use a Web Worker when CPU cost is large enough that chunking on the main thread would still hurt responsiveness.',
        'The practical rule is to pick the queue that matches the user promise. Visual work should align with frames. Background cleanup should yield to input. State consistency work can use microtasks, but only if it stays bounded.',
        'In server-side JavaScript, the same principle applies with different host queues. A CPU-heavy request handler can block unrelated clients even though file and network I/O are asynchronous. Worker threads, streaming, backpressure, and bounded per-request work are the server version of keeping the UI responsive.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study JavaScript Promise Microtask Queue Case Study, requestAnimationFrame, requestIdleCallback, Web Workers, SharedArrayBuffer, Message Queue, Backpressure, and Tail Latency. A useful exercise is to predict the log order for sync code, promises, queueMicrotask, setTimeout, and requestAnimationFrame, then test it in the browser.',
        'Then add a CPU-heavy loop and repeat the experiment after moving that work into a worker. Seeing input and timers recover is the clearest way to understand that the event loop is cooperative, not preemptive.',
      ],
    },
  ],
};
