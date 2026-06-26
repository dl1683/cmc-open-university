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
  const stackMain = { id: 'fMain', label: 'script()' };
  yield {
    state: runtime({ stack: [stackMain] }),
    highlight: { active: ['fMain'] },
    explanation: `The example has four operations: log A, schedule timer D, schedule promise microtask C, log B. The animation separates the call stack from two queues. The whole script starts as ${stackMain.label} on the stack, so nothing queued can run until it finishes — both queues are empty.`,
  };

  const logA = { id: 'fLog', label: "log('A')" };
  const out1 = ['A'];
  yield {
    state: runtime({ stack: [stackMain, logA], out: out1 }),
    highlight: { active: ['fLog'], found: ['oA'] },
    explanation: `Line 1: ${logA.label} is pushed, prints, pops. Synchronous code is just stack discipline — nothing exotic yet. Output so far: ${out1.join(', ')}.`,
  };

  const setCall = { id: 'fSet', label: 'setTimeout(→D, 0)' };
  const timerCb = { id: 'tD', label: "→ log('D')", note: 'timer done' };
  const macro2 = [timerCb];
  yield {
    state: runtime({
      stack: [stackMain, setCall],
      macro: macro2,
      out: out1,
    }),
    highlight: { active: ['fSet'], visited: ['tD'] },
    explanation: `Line 2: ${setCall.label} hands a callback to the host timer system. When the timer is ready, the callback ${timerCb.label} enters the task queue (now ${macro2.length} task queued). It still waits for the current stack to empty and for earlier tasks to finish; zero delay means eligible soon, not interrupt now.`,
    invariant: 'Queued work never interrupts running code — a task waits for an empty call stack.',
  };

  const thenCall = { id: 'fThen', label: '.then(→C)' };
  const microC = { id: 'mC', label: "→ log('C')" };
  const micro3 = [microC];
  const macro3 = [{ id: 'tD', label: "→ log('D')" }];
  yield {
    state: runtime({
      stack: [stackMain, thenCall],
      micro: micro3,
      macro: macro3,
      out: out1,
    }),
    highlight: { active: ['fThen'], visited: ['mC'] },
    explanation: `Line 3: ${thenCall.label} schedules a microtask once the promise is resolved. The microtask ${microC.label} enters the microtask queue (${micro3.length} microtask, ${macro3.length} task waiting). This callback also cannot interrupt the current script, but it will run before the next task when the stack becomes empty.`,
  };

  const logB = { id: 'fLogB', label: "log('B')" };
  const micro4 = [{ id: 'mC', label: "→ log('C')" }];
  const macro4 = [{ id: 'tD', label: "→ log('D')" }];
  const out4 = ['A', 'B'];
  yield {
    state: runtime({
      stack: [stackMain, logB],
      micro: micro4,
      macro: macro4,
      out: out4,
    }),
    highlight: { active: ['fLogB'], found: ['oB'] },
    explanation: `Line 4: ${logB.label} prints. Note the running tally — ${out4.join(', ')} — while ${micro4.length} microtask and ${macro4.length} task watch from the sidelines. The script is done; ${stackMain.label} pops; the stack is about to hit empty. NOW the event loop wakes up.`,
  };

  const runC = { id: 'fC', label: "log('C')" };
  const macro5 = [{ id: 'tD', label: "→ log('D')" }];
  const out5 = ['A', 'B', 'C'];
  yield {
    state: runtime({
      stack: [runC],
      macro: macro5,
      out: out5,
    }),
    highlight: { active: ['fC'], found: ['oC'] },
    explanation: `When the stack empties, the runtime drains microtasks before taking another task. ${runC.label} runs now — that priority is why C prints before the ready timer (${macro5.length} task still waiting). Output so far: ${out5.join(', ')}. Microtasks are for immediate consistency work, not for long-running loops.`,
    invariant: 'Between tasks, the microtask queue is drained to empty — every microtask, plus any it spawns.',
  };

  const runD = { id: 'fD', label: "log('D')" };
  const outFinal = ['A', 'B', 'C', 'D'];
  const renderDone = 'got a turn ✓';
  yield {
    state: runtime({
      stack: [runD],
      out: outFinal,
      renderNote: renderDone,
    }),
    highlight: { active: ['fD'], found: ['oD'] },
    explanation: `After microtasks drain, the browser may render, then the event loop takes one task. ${runD.label} finally runs — the final output is ${outFinal.join(', ')}. Render: ${renderDone}. The order is synchronous work first, microtasks at the checkpoint, then later tasks.`,
  };
}

function* starvation() {
  const s1stack = { id: 'c1', label: 'chain() #1' };
  const s1micro = { id: 'c2', label: '→ chain() #2' };
  const s1render = 'waiting…';
  yield {
    state: runtime({
      stack: [s1stack],
      micro: [s1micro],
      renderNote: s1render,
    }),
    highlight: { active: ['c1'], visited: ['c2'] },
    explanation: `The starvation view shows a common bug: ${s1stack.label} is on the stack and queues ${s1micro.label} as a microtask before returning. Each callback is small, but the queue never reaches empty — render status: ${s1render}. The browser never gets to rendering or input tasks.`,
  };

  const s2stack = { id: 'c2', label: 'chain() #2' };
  const s2micro = { id: 'c3', label: '→ chain() #3' };
  const s2render = '1 frame missed';
  yield {
    state: runtime({
      stack: [s2stack],
      micro: [s2micro],
      renderNote: s2render,
    }),
    highlight: { active: ['c2'], visited: ['c3'] },
    explanation: `Now ${s2stack.label} runs and queues ${s2micro.label} — the render slot reports ${s2render} because microtask checkpoints must drain to empty. A self-refilling microtask queue keeps the runtime in the same priority lane forever.`,
  };

  const s3stack = { id: 'c3', label: 'chain() #3' };
  const s3micro = { id: 'c4', label: '→ chain() #4' };
  const s3render = 'STARVED — page frozen';
  yield {
    state: runtime({
      stack: [s3stack],
      micro: [s3micro],
      renderNote: s3render,
    }),
    highlight: { active: ['c3'], compare: ['render'] },
    explanation: `${s3stack.label} runs, ${s3micro.label} is queued — render status: ${s3render}. The page is effectively frozen: no paints, no click handlers, no timer tasks. Async syntax did not create a yield point; it created more high-priority work.`,
    invariant: 'Rendering and tasks wait for an empty microtask queue — a self-refilling one blocks them forever.',
  };

  const s4stack = { id: 'c1', label: 'chain() #1' };
  const s4macro = { id: 'c2', label: '→ chain() #2', note: 'timer' };
  const s4render = 'runs every gap ✓';
  yield {
    state: runtime({
      stack: [s4stack],
      macro: [s4macro],
      renderNote: s4render,
    }),
    highlight: { active: ['c1'], found: ['render'] },
    explanation: `The fix: ${s4stack.label} schedules ${s4macro.label} into the task queue (via ${s4macro.note}) instead of as a microtask. Render status: ${s4render}. Rendering and input can interleave between chunks. For visual work use requestAnimationFrame; for CPU-heavy work use a worker. The practical skill is choosing the right queue.`,
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
        'The animation draws three columns: the call stack on the left, the microtask queue in the center, and the task queue on the right. Console output appears along the bottom. The call stack is the only column where code actually executes. Anything sitting in a queue is waiting for the stack to empty.',
        {
          type: 'callout',
          text: 'The event loop is a cooperative scheduler: JavaScript runs one stack to completion, then the runtime drains higher-priority queues before admitting the next task.',
        },
        'The "A B C D" view walks through a four-line script. Watch the stack execute synchronous code, then empty. At that checkpoint the microtask column drains completely before the task column gets a single turn. The ordering -- synchronous first, microtasks at the checkpoint, tasks after -- is the entire lesson.',
        'Switch to the starvation view and watch the RENDER note in the corner. It never clears. Each microtask schedules another before the queue reaches empty, so the browser never gets the checkpoint it needs to paint or process clicks. The bug is not a slow function; it is a scheduling pattern that denies the runtime a gap.',
        {type: 'image', src: './assets/gifs/event-loop.gif', alt: 'Animated walkthrough of the event loop visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript runs user code on a single main thread. That same thread handles DOM updates, input events, timers, and rendering. Without a scheduler, every network request or timer would either block the thread or force the programmer to manage threads and locks manually.',
        'The event loop splits work into turns. A piece of code enters the call stack (a LIFO structure tracking which function called which), runs to completion, and returns control. The runtime then decides what runs next: pending microtasks, a rendering step, or the next queued task. This turn-based model explains UI freezes, promise timing, timer surprises, and why "async" does not mean "parallel."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The intuitive mental model is that "async" means "concurrent." You call setTimeout or fetch, the callback runs "later," and other code continues in the meantime. For simple cases this works: you fire a request, do other things, the response eventually arrives.',
        'This model is adequate for writing basic async code. It breaks down the moment you need to predict execution order, diagnose a frozen UI, or explain why a zero-delay timer fires after a promise callback.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The intuitive model fails because it treats all async callbacks as interchangeable. They are not. A promise .then callback and a setTimeout callback sit in different queues with different priority rules, and the runtime enforces a strict draining order between them.',
        'The word "later" does not mean a time delay. It means "after the current stack empties and any higher-priority queues drain." A zero-delay setTimeout does not fire in zero milliseconds; it means the callback becomes eligible once the task queue gets a turn, which happens only after all microtasks finish and the browser may have rendered a frame.',
        'The wall is fully exposed when a developer writes a promise chain that schedules more promises recursively. Each microtask is small, but the queue never empties, so timers never fire, click handlers never run, and the page freezes. The code looks async but behaves like an infinite synchronous loop.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Two rules govern everything. First, run-to-completion: once a JavaScript function starts executing on the call stack, no other JavaScript on the same thread can interrupt it. The runtime only makes scheduling decisions when the stack is empty. This eliminates most data races but makes the programmer responsible for keeping each turn short.',
        'Second, queue priority: the runtime does not treat all waiting callbacks equally. After a task finishes and the stack empties, it drains the entire microtask queue -- including any microtasks added during draining -- before considering the next task or a rendering step. This two-tier system is why Promise.then runs before setTimeout(fn, 0), every time, regardless of registration order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The call stack is a last-in-first-out structure tracking executing functions. Calling a function pushes a frame; returning pops it. The stack is the only place JavaScript code actually runs. The heap is unstructured memory where objects live; it matters for garbage collection but not for scheduling.',
        {
          type: 'image',
          src: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model/runtime-environment-diagram.svg',
          alt: 'MDN diagram of JavaScript agents with stack, heap, and job queue',
          caption: 'MDN shows each JavaScript agent as a stack, heap, and job queue, which is the local machinery the event loop schedules. Source: MDN, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model',
        },
        'The task queue (also called the macrotask queue) holds callbacks from setTimeout, setInterval, I/O completions, DOM events, and MessageChannel. After the current task finishes and microtasks drain, the browser may render, then it dequeues exactly one task and pushes it onto the call stack. One task per loop iteration is the rule.',
        'The microtask queue holds promise .then/.catch/.finally callbacks, queueMicrotask callbacks, and MutationObserver notifications. When the call stack empties after any task, the runtime enters the microtask checkpoint: it processes every microtask in the queue, including any new microtasks added during processing, before doing anything else. The checkpoint has no time limit -- it runs until the queue is empty.',
        'The browser rendering pipeline sits between tasks. Browsers target roughly 60 frames per second (16.7 ms per frame). Each frame follows a sequence: run a task, drain microtasks, then (if the browser decides to repaint) run requestAnimationFrame callbacks, recalculate styles, perform layout, paint, and composite. requestIdleCallback runs during leftover time after painting, if any. Neither rendering nor idle callbacks can fire while the microtask queue is draining or while a task occupies the call stack.',
        'Node.js uses libuv instead of a browser rendering pipeline, cycling through six phases: timers, pending callbacks, idle/prepare, poll (I/O), check (setImmediate), and close callbacks. Microtasks run between every phase transition. process.nextTick callbacks run before promise microtasks, which is a Node-specific detail. This means nextTick can starve I/O just as recursive promise chains starve rendering in the browser.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Run-to-completion prevents data races within a single turn. A click handler can read and write DOM state without worrying that another handler will mutate the same nodes mid-execution. The cooperative contract is: the runtime never preempts your code, so each turn sees consistent state. In exchange, your code must not hold the stack for too long.',
        'Microtask priority exists for consistency. When a promise resolves, dependent code should observe the settled value before any other task changes the world. Draining all microtasks ensures that chained promise logic completes atomically from the perspective of the task queue. If a .then handler attaches another .then, that second handler also runs before the next task -- the chain stays coherent.',
        'The invariant the animation makes visible: between any two tasks, the microtask queue is fully drained. This guarantee is what makes promise-based code predictable. It is also what makes recursive microtask scheduling dangerous, because the exit condition is an empty queue, not a time budget.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Scheduling overhead is negligible. Pushing a callback reference into a queue is O(1). Dequeuing is O(1). The real cost is what the callbacks do and how long they hold the call stack.',
        'At 60 fps the frame budget is 16.7 ms. A task that runs for 200 ms blocks 200 / 16.7 = roughly 12 frames, causing visible jank. A 50 ms task costs 3 frames. The browser Long Tasks API flags any task exceeding 50 ms for exactly this reason.',
        'A self-refilling microtask chain is worse than a long task. A long task eventually returns; a recursive microtask chain never does. It starves all tasks, all rendering, and all input handling indefinitely because the microtask checkpoint has no time limit. In Node.js, the event loop utilization metric (ELU) measures the fraction of time the loop spends in active callbacks versus waiting for I/O. An ELU near 1.0 means the loop is saturated and latency is climbing.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'UI responsiveness: React schedules reconciliation work in tasks and uses microtasks for batched state updates. Multiple setState calls within one handler produce a single re-render because React defers the reconciliation to a later task while collecting state changes as microtasks.',
        'Server concurrency: Node.js handles thousands of concurrent connections on one thread because most server work (database queries, file reads, network calls) is I/O-bound. The event loop processes request callbacks between I/O completions without thread-per-request overhead. A Node server spending 2 ms of CPU per request and 50 ms waiting on a database can handle roughly 500 concurrent requests on a single thread -- the loop is idle during the 50 ms waits.',
        'Animation: requestAnimationFrame aligns visual updates with the display refresh rate. It runs once per frame, right before the browser paints, preventing wasted style recalculations from DOM writes spread across separate tasks. Game loops, scroll-linked effects, and canvas animations all use this scheduling slot.',
        'Chunked processing: large data transformations (parsing a 10 MB JSON string, processing a million-row CSV) can be split into chunks of 1,000 rows each, scheduled via setTimeout(nextChunk, 0). Between chunks the browser processes input events and paints. The total work takes longer wall-clock time but the page stays responsive.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CPU-bound work blocks the loop regardless of async syntax. Awaiting a promise that wraps a synchronous 500 ms computation still freezes the page for 500 ms. The await keyword yields to the microtask queue, not to a parallel thread. The only remedy is moving the computation to a Web Worker (browser) or a worker_thread (Node).',
        'Microtask starvation: a recursive promise chain or an unbounded MutationObserver can prevent the browser from ever reaching the rendering step. The starvation view in the animation demonstrates this. The fix is to schedule continuation work into the task queue (setTimeout or postMessage) instead of the microtask queue.',
        'Timer coalescing and clamping: browsers clamp nested setTimeout to a minimum of 4 ms after five nesting levels. Background tabs may throttle timers to once per second or less. Code that assumes precise timer resolution will behave differently across environments. For sub-millisecond scheduling, postMessage channels avoid the 4 ms clamp.',
        'The event loop cannot replace parallelism. Web Workers and worker_threads exist because some workloads -- image processing, cryptography, physics simulations, large matrix multiplications -- need real concurrent execution on separate threads, not cooperative interleaving on one.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace this code line by line: console.log(\'A\'); setTimeout(() => console.log(\'D\'), 0); Promise.resolve().then(() => { console.log(\'C1\'); return Promise.resolve(); }).then(() => console.log(\'C2\')); console.log(\'B\');',
        'The script itself is one task. It enters the call stack. Nothing else can run until this task finishes.',
        'Line 1: console.log(\'A\') pushes onto the stack, prints A, pops. Output: A. Stack: [script]. Microtask queue: empty. Task queue: empty.',
        'Line 2: setTimeout registers a timer with the browser. The browser notes "0 ms delay" and immediately marks the callback as eligible. It enqueues () => console.log(\'D\') into the task queue. Stack: [script]. Microtask queue: empty. Task queue: [cb-D].',
        'Line 3: Promise.resolve() creates an already-resolved promise. .then(cb) sees the promise is settled, so it schedules cb into the microtask queue. The second .then is chained but its callback is not yet scheduled because the first .then has not returned. Stack: [script]. Microtask queue: [cb-C1]. Task queue: [cb-D].',
        'Line 4: console.log(\'B\') pushes, prints B, pops. Output: A B. The script finishes. The stack empties.',
        'Microtask checkpoint begins. The runtime dequeues cb-C1. It pushes onto the stack and runs: prints C1, then returns Promise.resolve(). Output: A B C1. That return value is a resolved promise, so the chained .then(cb-C2) schedules cb-C2 into the microtask queue. Microtask queue: [cb-C2].',
        'The checkpoint is not done -- the queue is not empty. The runtime dequeues cb-C2. It pushes, prints C2, pops. Output: A B C1 C2. Microtask queue: empty. Checkpoint ends.',
        'The browser may now render (style, layout, paint). After rendering, the event loop dequeues the next task: cb-D. It pushes, prints D, pops. Final output: A B C1 C2 D.',
        'Two things to notice. First, C1 and C2 both print before D even though D was registered first, because microtasks drain before the next task. Second, C2 prints in the same checkpoint as C1 because a microtask spawned during draining is itself drained before the checkpoint ends. The queue must reach empty, not just "process what was there when we started."',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: the HTML Living Standard section 8.1.7 defines the browser event loop processing model, including the microtask checkpoint and rendering steps. The Node.js documentation on the event loop describes libuv phases and nextTick/microtask ordering.',
        'Prerequisites: study Stack and Queue to understand the data structures underlying the call stack and task queues. Study Promises to see why .then creates microtasks and how chaining works.',
        'Extensions: requestAnimationFrame and frame budgets for render-aligned scheduling. Web Workers for moving CPU work off the main thread. The Scheduler.postTask API for browser-native prioritized task scheduling. Async Context Propagation (TC39 proposal) for tracking request-local state across await boundaries.',
        'Contrasting models: Erlang and Go use preemptive lightweight threads that the runtime can suspend mid-function. Rust\'s Tokio and Python\'s asyncio use cooperative async runtimes similar to JavaScript but with different queue structures and explicit yield points. Understanding JavaScript\'s event loop makes these alternatives easier to compare because the tradeoffs -- cooperative vs. preemptive, single-queue vs. multi-phase -- are the same tradeoffs every runtime must resolve.',
      ],
    },
  ],
};
