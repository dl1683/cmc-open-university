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
        `JavaScript is single-threaded: one call stack, one line of execution at a time. But the browser keeps promises, timers, and user input waiting in two separate holding areas — the microtask queue and the task queue (also called the macrotask queue). The event loop is the simple rule that decides who goes next: when the stack empties, drain all microtasks, allow one render window if the browser needs it, then run one task, and repeat forever. This rule, implemented in every JavaScript runtime (browsers, Node.js, Deno), is why setTimeout(callback, 0) does not run immediately, why promises jump ahead of timers, and how a tiny function can freeze a page if misused.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Synchronous code — a console.log, arithmetic, function calls — executes straight away on the stack. When a callback is scheduled by setTimeout, the browser takes it (setTimeout is a browser API, not JavaScript), sets a timer, and parks the callback in the task queue. When a promise resolves, its .then callback goes to the microtask queue. The stack keeps running until the current script ends. Then comes the event loop's two rules: (1) drain the entire microtask queue, including any microtasks those microtasks spawn, until it is empty; (2) run one task from the task queue, let the browser render if needed, and loop. This is why A B C D is the output every time: the synchronous logs (A and B) print first, then the promise (C, a microtask) before the timer (D, a task).`,
        `The visualization shows all three buckets side by side: the call stack in the middle-left, the microtask queue above middle, and the task queue above right. Watch how synchronous code builds the stack, watch setTimeout and promise.then deposit callbacks into their respective queues, and watch the event loop drain the microtask queue the moment the stack hits empty — before the task queue gets a turn.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The event loop itself has no cost — it is a scheduling rule, not a data structure. But the queuing itself is real: promises create microtask overhead (small but nonzero per callback), timers incur browser timer machinery (also small). The key risk is starvation: if you queue a microtask that queues another microtask from within itself (like Promise.then(chain) that calls Promise.then(chain) again), the microtask queue never empties, rendering never gets a turn, and the page freezes. The second view of this visualization shows exactly this: the page says "STARVED" while chain() functions accumulate in the microtask queue. The one-line fix is setTimeout(chain, 0) instead of .then(chain), which switches waiting rooms and lets rendering breathe between tasks.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Timers (setTimeout, setInterval) belong in the task queue because they can be slow (long animations, polling) and should not starve rendering. Promises, being fast (promise chains are typically a few microseconds), go to the microtask queue so they complete as soon as possible. requestAnimationFrame is custom — it does not queue; the browser syncs it to the next paint, so use it for animation-paced logic. Web Workers handle long computations by running them off the main thread entirely, avoiding blocking altogether. In practice: use .then() for immediate reactions (updating state, resolving dependencies), setTimeout(cb, 0) for batched work that should yield to rendering and user input, and requestAnimationFrame for anything tied to a paint. Heavy lifting goes to workers.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest myth is that setTimeout(cb, 0) executes immediately — it does not; it goes to the task queue and waits. The second myth is that async/await code is somehow immune to the queues — it is not; async functions rely on promises, which use microtasks, so the same starvation risk exists. The starvation trap is real and subtle: a single developer writing Promise.resolve().then(chain) that calls itself looks innocent (no busy loop, tiny functions), but it starves rendering and freezes the page. Another misconception is that microtasks are "better" — they are only better for fast, urgent operations; for long work they starve everything else. Finally, note that the browser is not part of JavaScript — setTimeout, the timer, and the browser's rendering are all outsideJS. The JavaScript runtime talks to them, but does not control them.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `The event loop is about scheduling, so study Queue (the FIFO data structure it uses for both queues) and Stack (the call stack side). To understand how the browser paints, read How a Browser Paints a Page, which explains the render window the event loop opens up between tasks. For distributed systems that use event loops, study Message Queue and how messages flow between processes. Finally, in production systems that trace async work across many hops (promises, timers, workers), study Distributed Tracing to see how the event loop's queuing becomes visible in logs and metrics.`,
      ],
    },
  ],
};

