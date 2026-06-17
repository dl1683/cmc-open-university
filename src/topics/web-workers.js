// Web workers: when the work is too heavy for the event loop's one thread,
// hire a second thread — but it lives in another apartment, and everything
// you send it travels by mail. The postage is the whole design problem.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'web-workers',
  title: 'Web Workers: A Second Thread',
  category: 'Systems',
  summary: "The event loop's escape hatch: a second thread for heavy work — and the postMessage postage you pay to use it.",
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['offloading an 800ms job', 'the postMessage tax'], defaultValue: 'offloading an 800ms job' },
  ],
  run,
};

// Two threads, two queues, one frozen-or-smooth render slot — graph nodes.
function threads({ main = [], mainQ = [], worker = [], note = '', renderNote = '' }) {
  const nodes = [
    { id: 'hMain', label: 'MAIN THREAD', x: 1.5, y: 6.4, note: 'owns the DOM' },
    { id: 'hQueue', label: 'MAIN TASKS', x: 4.5, y: 6.4 },
    { id: 'hWorker', label: 'WORKER', x: 8, y: 6.4, note: note || 'no DOM, own loop' },
    ...main.map((f, i) => ({ id: f.id, label: f.label, x: 1.5, y: 5.3 - i * 1.1, note: f.note ?? '' })),
    ...mainQ.map((m, i) => ({ id: m.id, label: m.label, x: 4.5, y: 5.3 - i * 1.1, note: m.note ?? '' })),
    ...worker.map((w, i) => ({ id: w.id, label: w.label, x: 8, y: 5.3 - i * 1.1, note: w.note ?? '' })),
    { id: 'render', label: 'RENDER', x: 1.5, y: 0.6, note: renderNote },
  ];
  return graphState({ nodes, edges: [] });
}

function* offload() {
  yield {
    state: threads({
      main: [{ id: 'parse', label: 'parse(50MB CSV)', note: '800ms of CPU' }],
      mainQ: [
        { id: 'click1', label: 'click handler', note: 'waiting' },
        { id: 'click2', label: 'click handler', note: 'waiting' },
      ],
      note: 'not hired yet',
      renderNote: 'FROZEN — 48 frames missed',
    }),
    highlight: { active: ['parse'], compare: ['click1', 'click2'], removed: ['render'] },
    explanation: 'The Event Loop taught the iron rule: a task runs to COMPLETION — nothing interrupts it. Here is the rule\'s dark side: parsing a 50MB CSV takes 800ms of pure CPU, and for all 800ms the stack is occupied. Clicks pile up in the task queue. The 16.7ms render deadline passes 48 times with no paint. The page is frozen — not because anything is wrong, but because the event loop is working exactly as designed. No amount of async/await fixes this: promises slice up WAITING, not COMPUTING.',
  };

  yield {
    state: threads({
      main: [{ id: 'post', label: 'worker.postMessage(csv)', note: 'returns instantly' }],
      worker: [{ id: 'parse', label: 'parse(50MB CSV)', note: '800ms — elsewhere' }],
      renderNote: 'smooth 60fps ✓',
    }),
    highlight: { active: ['parse'], found: ['render', 'post'] },
    explanation: 'The escape hatch: new Worker("parse.js") starts a genuinely SEPARATE thread — its own call stack, its own event loop, its own memory heap. The main thread mails the data over with postMessage() and returns in microseconds; the 800ms of parsing now burns a different CPU core. Buttons click, animations run, the event loop never notices. The isolation is total: the worker cannot see the DOM, window, or any variable of the page — by design. Two threads sharing the DOM would mean locks, races, and every concurrency bug JavaScript was built to avoid (the same reasons Raft and Two-Phase Commit exist between machines).',
    invariant: 'Worker and page share NOTHING: separate heaps, communicating only by message.',
  };

  yield {
    state: threads({
      main: [],
      mainQ: [{ id: 'onmsg', label: 'onmessage(rows)', note: 'a normal task' }],
      worker: [{ id: 'reply', label: 'postMessage(rows)', note: 'done' }],
      renderNote: 'still smooth ✓',
    }),
    highlight: { active: ['reply'], visited: ['onmsg'] },
    explanation: 'The worker finishes and mails the parsed rows back. Note HOW the reply arrives: as an ordinary task in the main thread\'s task queue, taking its turn behind pending clicks and renders, obeying every rule of event-loop etiquette. The onmessage handler then updates the DOM — because only the main thread may paint. This is the clean division of labor: WORKERS COMPUTE, MAIN PAINTS. The same shape as a restaurant: the kitchen (worker) cooks, the waiter (main thread) is the only one who touches the tables.',
  };

  yield {
    state: matrixState({
      title: 'What a worker can and cannot touch',
      rows: [
        { id: 'dom', label: 'DOM / window' },
        { id: 'fetch', label: 'fetch / WebSocket' },
        { id: 'wasm', label: 'WASM / heavy compute' },
        { id: 'storage', label: 'IndexedDB / caches' },
      ],
      columns: [{ id: 'ok', label: 'available in worker?' }],
      values: [[0], [1], [1], [1]],
      format: (v) => (v ? 'yes ✓' : 'NO — main only'),
    }),
    highlight: { removed: ['dom:ok'], found: ['wasm:ok'] },
    explanation: 'The capability sheet: workers get the network, storage, and raw compute (they are where WebAssembly modules and ML inference like in-browser transformers usually run); they never get the page itself. So the architecture writes itself — keep the main thread as a thin UI layer, push parsing, compression, image processing, crypto, and model inference into workers. Figma, VS Code in the browser, and Google Sheets all live by this split. One caution before you hire a thread for everything: the mail service between them charges by weight — the other view prices it.',
  };
}

function* tax() {
  yield {
    state: matrixState({
      title: 'postMessage copies — the structured-clone bill (~5ms per MB)',
      rows: [
        { id: 'kb', label: '1 KB of JSON' },
        { id: 'mb', label: '1 MB of rows' },
        { id: 'mb50', label: '50 MB of rows' },
      ],
      columns: [{ id: 'clone', label: 'clone cost' }, { id: 'where', label: 'paid on which thread?' }],
      values: [[0.005, 1], [5, 1], [250, 1]],
      format: (v) => (v === 1 ? 'MAIN (blocking!)' : v < 1 ? '~0.005 ms' : `~${v} ms`),
    }),
    highlight: { removed: ['mb50:clone', 'mb50:where'] },
    explanation: 'The fine print: postMessage does not SHARE data — separate heaps, remember — it COPIES it, via the structured-clone algorithm (a deep copy that handles objects, arrays, maps, dates, cycles). Cloning costs roughly 5ms per MB, and the outbound copy is paid ON THE MAIN THREAD — the very thread you were protecting. Mail 50MB to the worker and you just froze the page for ~250ms to avoid freezing it for 800ms. A win, but an embarrassing one; mail results back and forth chattily and the postage exceeds the work.',
    invariant: 'Structured clone cost scales with payload size and is paid by the sending thread.',
  };

  yield {
    state: matrixState({
      title: 'Three ways to move 50 MB',
      rows: [
        { id: 'clone', label: 'structured clone' },
        { id: 'transfer', label: 'transfer ArrayBuffer' },
        { id: 'shared', label: 'SharedArrayBuffer' },
      ],
      columns: [{ id: 'cost', label: 'cost' }, { id: 'catch', label: 'the catch' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', '~250 ms copy', 'none — just slow', '~0 ms', 'sender loses it (neutered)', '~0 ms, both see it', 'real shared memory: Atomics, locks, races'][v],
    }),
    highlight: { found: ['transfer:cost'], compare: ['shared:catch'] },
    explanation: 'The upgrades: TRANSFER an ArrayBuffer and ownership MOVES instead of copying — near-zero cost, but the sender\'s copy is neutered (length 0, unusable); perfect for pipelines where data flows one way: postMessage(buf, [buf]). SharedArrayBuffer goes further — one block of memory both threads genuinely see — but it reintroduces everything workers were designed to avoid: Atomics, locks, data races (and it requires special security headers, since Spectre). The ladder: clone for small things, transfer for big one-way things, shared memory only when you truly need both threads in the same bytes.',
  };

  yield {
    state: matrixState({
      title: 'Should this work leave the main thread?',
      rows: [
        { id: 'big', label: 'CPU > 50ms, chunky data' },
        { id: 'dom', label: 'touches the DOM' },
        { id: 'tiny', label: '2ms task, called often' },
        { id: 'chat', label: 'needs replies every frame' },
      ],
      columns: [{ id: 'verdict', label: 'verdict' }],
      values: [[1], [0], [0], [2]],
      format: (v) => ['main thread — postage > work', 'WORKER — clear win', 'borderline: transfer, batch messages'][v],
    }),
    highlight: { found: ['big:verdict'], removed: ['dom:verdict', 'tiny:verdict'] },
    explanation: 'The decision table. Workers win when the computation dwarfs the postage: parsing, compressing, image filters, model inference. They lose on DOM work (cannot touch it), tiny frequent tasks (clone overhead swamps 2ms of work), and chatty per-frame conversations (unless you batch or transfer). The deeper pattern is one you have seen all over this site: moving work to another executor is never free — the messaging cost is the price of isolation, whether between browser threads, microservices behind a Message Queue, or replicas in Raft. Distribution is a trade, and the postage is the receipt.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'offloading an 800ms job') yield* offload();
  else if (view === 'the postMessage tax') yield* tax();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `Why Web Workers exist`,
      paragraphs: [
        `The browser main thread owns the user experience. It runs JavaScript tasks, handles input events, updates the DOM, calculates style and layout, and gives the rendering engine chances to paint. At 60 frames per second, a frame budget is about 16.7 ms. A single 800 ms CSV parse is not merely a slow function. It is almost a full second during which clicks wait, animations freeze, timers slip, and dozens of paint opportunities are missed.`,
        `Web Workers exist because some JavaScript work is real CPU work. Parsing, compression, syntax analysis, image processing, geometry, search indexing, cryptography, WebAssembly, and in-browser model inference can all take longer than a frame. The browser needs a way to run that work without letting it monopolize the thread that owns the DOM. A worker is that escape hatch: another JavaScript execution context with its own event loop and no direct access to the page.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The common mistake is to reach for async and await. That helps when the program is waiting for I/O. A fetch can yield while the network responds. A timer can yield until its deadline. A promise callback can be scheduled later. None of that makes a long calculation stop consuming the current JavaScript task. Once a task begins running on the main thread, it runs until it returns.`,
        `Breaking a calculation into tiny chunks can help if the work is divisible and latency is acceptable. The program can parse a few thousand rows, yield to the event loop, then continue. That is cooperative scheduling, and it is sometimes the right answer. But it still spends main-thread time and adds complexity to every algorithm. Workers solve a different problem: put the long calculation on another executor so the main thread remains primarily a UI thread.`,
      ],
    },
    {
      heading: `Core insight and mechanism`,
      paragraphs: [
        `A dedicated worker is created with new Worker("worker.js") or with a module worker. The worker runs in a separate global scope, has its own call stack, task queue, event loop, and heap, and communicates with the page through postMessage and message events. The main thread sends input. The worker computes. The worker posts a result. The main thread receives that result as a normal task and updates the DOM if needed.`,
        `The separation is deliberate. A worker can use many web APIs, including fetch, timers, WebSocket in many environments, IndexedDB, crypto APIs, and WebAssembly. It cannot directly read or mutate the DOM, call document.querySelector, or touch arbitrary variables from the page. That restriction is what keeps the browser from needing locks around every DOM node. The price of safety is that all useful interaction between page and worker must cross a message boundary.`,
      ],
    },
    {
      heading: `The message boundary`,
      paragraphs: [
        `postMessage is not a normal function call. It queues a message for another event loop. The sender continues after posting, and the receiver handles the message later. That means every worker API should be designed like a small protocol: request id, operation name, payload, progress events, success result, error result, cancellation, and sometimes backpressure.`,
        `The default payload mechanism is the structured-clone algorithm. It can copy many JavaScript values, including objects, arrays, maps, sets, dates, ArrayBuffers, typed arrays, and cyclic structures. It does not copy functions, DOM nodes, accessors, prototypes in the way many developers expect, or live object identity across the boundary. Structured clone is convenient, but it is still a copy. Large payloads can block the sending side long enough to defeat the purpose of using a worker.`,
      ],
    },
    {
      heading: `Clone, transfer, share`,
      paragraphs: [
        `There are three main ways to move data. Structured clone copies the value. That is simplest and safest for small control messages, settings objects, and compact results. Transferable objects move ownership instead of copying. ArrayBuffer, MessagePort, ImageBitmap, OffscreenCanvas, and some other objects can be transferred. After an ArrayBuffer is transferred, the sender's buffer is detached; the bytes now belong to the receiver. That is usually the right path for large one-way data flow.`,
        `SharedArrayBuffer is the third option. It lets two threads observe the same memory at the same time. That is powerful and dangerous. Once memory is truly shared, the program needs Atomics, ordering discipline, and a clear synchronization protocol. Browsers also require cross-origin isolation headers for SharedArrayBuffer because of side-channel security concerns. Use it when the application really needs shared memory, not merely because copying feels inelegant.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `A spreadsheet imports a 50 MB CSV. On the main thread, parsing blocks input and paint. With a worker, the page reads the file as bytes, transfers the ArrayBuffer to parse-worker.js, and immediately returns control to the event loop. The worker tokenizes rows, validates fields, builds typed intermediate structures, and posts compact batches back to the page. The main thread receives each batch and updates visible rows during normal rendering opportunities.`,
        `The same example shows the main design trap. If the page first turns the file into millions of JavaScript row objects and structured-clones that object graph into the worker, the sender pays a large copy cost on the main thread. If the worker posts one progress message per row, message overhead can swamp the parse itself. A better protocol transfers raw bytes, parses off-thread, sends progress at human-visible intervals such as every 50 or 100 ms, returns compact batches, and supports cancellation if the user closes the file.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The key invariant is ownership separation. The main thread owns the DOM and visual responsiveness. The worker owns private computation state. The only ordinary connection is a message. Queue isolation is the proof idea: an 800 ms parse can occupy the worker queue while the main queue continues to receive input and rendering tasks. When the worker replies, the reply waits its turn on the main queue like any other task.`,
        `This is also why workers do not automatically make a program faster. They protect responsiveness and may use another CPU core, but they do not improve algorithmic complexity. O(n squared) work remains O(n squared). If the application spends more time cloning, transferring, synchronizing, or merging results than it saves by moving compute, the worker is the wrong boundary or the protocol is too chatty.`,
      ],
    },
    {
      heading: `Decision guide`,
      paragraphs: [
        `Use a worker when the computation is CPU-heavy, can run without touching the DOM, has a clear input and output, and does enough work to outweigh startup and messaging costs. Parsing a large file, compressing a payload, resizing an image, running a search index, compiling a document, or invoking a WebAssembly module is usually a good candidate. UI event handlers, layout reads, small formatting functions, and DOM-bound operations are not.`,
        `The postMessage tax should shape the design. Clone small objects. Transfer large buffers. Batch frequent updates. Keep messages coarse enough that the queue does not become the bottleneck. Prefer immutable request and response payloads unless SharedArrayBuffer is truly needed. If the worker must stream results, design a backpressure signal so the worker does not produce faster than the main thread can render or store.`,
      ],
    },
    {
      heading: `Worker families`,
      paragraphs: [
        `Dedicated workers are owned by one page or script and are the usual choice for offloading computation. Shared workers can be reached by multiple browsing contexts from the same origin, which makes them useful for shared coordination but less common. Service workers are different: they sit between pages and the network, receive lifecycle events, and power offline-first behavior, caching, push, and background sync. Worklets are smaller specialized execution contexts for audio, animation, layout, or paint hooks.`,
        `OffscreenCanvas is an important worker-adjacent feature. It can transfer canvas rendering work away from the main thread, which matters for design tools, maps, games, and data visualization. OPFS synchronous access handles are another worker-only pattern: the browser permits synchronous file-like operations there because the blocking happens off the main thread. These APIs share the same lesson: isolate expensive work, then make the boundary explicit.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Treat a worker as a service inside the browser. Define a message schema. Include request ids so out-of-order replies do not corrupt state. Represent errors as structured responses. Support cancellation with AbortController, a cancel message, or a shared cancellation flag. Decide what happens if the worker crashes or is terminated. Limit concurrent jobs so a page does not create a local denial of service by starting too many CPU-bound workers.`,
        `Measure on real devices. A desktop with many cores can hide worker overhead; a low-end mobile device may struggle with memory, startup, and thermal limits. Measure main-thread blocking time, input delay, task duration, worker CPU time, message size, clone time, transfer count, and dropped frames. The goal is not to move every expensive-looking function. The goal is to protect the interaction budget with the simplest boundary that works.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The common failure is sending too much data. A worker that receives a giant cloned object graph can freeze the page before the worker even starts useful work. Another failure is chatty progress: one message per row, pixel, or token can create more overhead than computation. A third failure is pretending workers remove concurrency concerns. They remove shared DOM races, but they introduce protocol races: duplicate requests, late replies, cancellation after completion, stale results, and errors that arrive after the UI has moved on.`,
        `Shared memory raises the difficulty further. With SharedArrayBuffer, both sides can read and write the same bytes, so the program must reason about ordering, atomic updates, waiting, notification, and deadlock. Use ring buffers, single-producer/single-consumer rules, or well-tested synchronization patterns rather than ad hoc flags. If the application does not need shared memory, transfer ownership instead.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Official sources: MDN Using Web Workers at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers, MDN Transferable Objects at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects, MDN Structured Clone at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm, MDN SharedArrayBuffer at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer, and the HTML structured-data section at https://html.spec.whatwg.org/multipage/structured-data.html.`,
        `Study The Event Loop first, then How a Browser Paints a Page and requestAnimationFrame Frame Budget to understand why main-thread time is scarce. Continue with Structured Clone & Transferables, OffscreenCanvas Worker Renderer, OPFS Origin Private File System, SharedArrayBuffer & Atomics, Browser Message Channels & Broadcast Coordination, CSV Parser State Machine Case Study, WebAssembly Linear Memory Case Study, Work-Stealing Deque Scheduler, Message Queue, Backpressure, and Distributed Tracing.`,
      ],
    },
  ],
};
