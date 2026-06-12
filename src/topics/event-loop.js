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
    explanation: "The program: console.log('A'); setTimeout(→'D', 0); Promise.resolve().then(→'C'); console.log('B'). Four lines, and the output order is the most asked JavaScript interview question of all time. The machinery: ONE call stack (JavaScript is single-threaded — exactly the Stack structure from this site), and two waiting rooms for the future: the task queue and the microtask queue (both Queues — FIFO, as studied). The script itself runs as one task, pushed on the stack.",
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
    explanation: "Line 2: setTimeout(→'D', 0). Here is the secret: setTimeout is NOT JavaScript — it is a browser API. The runtime hands the callback to the browser's timer system and moves on instantly. The timer (0ms — already done!) deposits the callback into the TASK QUEUE… where it must WAIT, because the rule is: a task runs only when the stack is empty and it is at the front of the line. '0 milliseconds' means 'as soon as politely possible', not 'now'.",
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
    explanation: "Line 3: Promise.resolve().then(→'C'). The promise is already resolved, but the callback STILL cannot run now — it goes to the MICROTASK queue, the VIP room. Two callbacks now wait in two different rooms, and which room you are in decides everything about when you run.",
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
    explanation: "The etiquette, rule 1: when the stack empties, drain the ENTIRE microtask queue before touching any task. The promise callback jumps the line ahead of the timer that finished first — C prints before D, always, in every browser and in Node. This is why promise chains feel 'immediate': microtasks run at the first possible gap, before timers, before clicks, before rendering.",
    invariant: 'Between tasks, the microtask queue is drained to empty — every microtask, plus any it spawns.',
  };

  yield {
    state: runtime({
      stack: [{ id: 'fD', label: "log('D')" }],
      out: ['A', 'B', 'C', 'D'],
      renderNote: 'got a turn ✓',
    }),
    highlight: { active: ['fD'], found: ['oD'] },
    explanation: "Rule 2: after the microtasks (and possibly a render — the browser gets its 16.7ms paint opportunity between tasks, see How a Browser Paints a Page), take ONE task from the task queue: the timer callback finally prints D. Final output: A B C D. Read it as a status hierarchy — synchronous code first, then every pending promise, then a render breath, then one timer/click/IO callback, repeat forever. That repeat-forever is the event loop.",
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
    explanation: "The trap: function chain() { Promise.resolve().then(chain); doWork(); } — each run queues the NEXT run as a microtask before finishing. It looks innocently async: tiny functions, no long loop, promises everywhere. Watch the render slot in the corner.",
  };

  yield {
    state: runtime({
      stack: [{ id: 'c2', label: 'chain() #2' }],
      micro: [{ id: 'c3', label: '→ chain() #3' }],
      renderNote: '1 frame missed',
    }),
    highlight: { active: ['c2'], visited: ['c3'] },
    explanation: "Remember the etiquette: the microtask queue must be EMPTY before the browser may render or run the next task. But this queue refeeds itself — every drain attempt deposits a new microtask. The loop never escapes the VIP room.",
  };

  yield {
    state: runtime({
      stack: [{ id: 'c3', label: 'chain() #3' }],
      micro: [{ id: 'c4', label: '→ chain() #4' }],
      renderNote: 'STARVED — page frozen',
    }),
    highlight: { active: ['c3'], compare: ['render'] },
    explanation: "Three generations in and the pattern is clear: the microtask queue never empties, so rendering NEVER happens — no paints, no click handlers, a frozen page — even though no single function ran long. 'Async' does not mean 'yields'. Microtasks are a priority lane, and a priority lane that never clears starves everyone behind it (the same starvation risk every priority queue carries).",
    invariant: 'Rendering and tasks wait for an empty microtask queue — a self-refilling one blocks them forever.',
  };

  yield {
    state: runtime({
      stack: [{ id: 'c1', label: 'chain() #1' }],
      macro: [{ id: 'c2', label: '→ chain() #2', note: 'timer' }],
      renderNote: 'runs every gap ✓',
    }),
    highlight: { active: ['c1'], found: ['render'] },
    explanation: "The one-line fix: re-queue with setTimeout(chain, 0) instead of .then(chain). Now the next round waits in the TASK queue, and between tasks the loop lets the browser breathe — render, clicks, other timers all interleave. Same total work, zero freezing. For animation-paced work use requestAnimationFrame (a callback timed to each paint); for heavy computation leave the thread entirely with a Web Worker. The skill is not avoiding the queues — it is choosing which waiting room your work belongs in.",
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
      heading: `Cost and complexity`,
      paragraphs: [
        `Scheduling overhead is tiny compared with the work callbacks do, but responsiveness is bounded by task length. At 60 frames per second a page has about 16.7 ms for JavaScript, style, layout, paint, and composite. A 200 ms task misses roughly 12 frames. A self-refilling microtask chain is worse because it can starve every task and every paint indefinitely. The demo's fix, requeueing with setTimeout instead of Promise.then, moves the next chunk into the task queue so rendering can breathe between chunks. Production code often slices long work into batches for exactly this reason.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Promises are right for immediate follow-up work such as resolving dependencies or updating in-memory state. setTimeout is a yield point for chunked work that should let input and paint interleave. requestAnimationFrame is for work tied to the next frame. Web Workers: A Second Thread moves CPU-heavy work off the main thread entirely. Service Workers & Offline-First use a related event-driven model, but their fetch events live in a worker-like context rather than the page's main thread.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The main misconception is that "async" means "nonblocking." Awaiting I/O yields; computing for 800 ms does not. Another trap is thinking microtasks are always better. They are higher priority, which is useful for consistency but dangerous for long or self-scheduling work. Virtual DOM Reconciliation also runs inside tasks; a slow diff blocks clicks just like a slow parser. The browser APIs are host machinery around JavaScript, not magic inside the language.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Stack and Queue for the two basic data structures on screen. Then read How a Browser Paints a Page, Web Workers: A Second Thread, and Service Workers & Offline-First for the browser consequences. Message Queues and Distributed Tracing show the same scheduling problem after callbacks become cross-service messages instead of in-page functions.`,
      ],
    },
  ],
};
