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
      heading: `What it is`,
      paragraphs: [
        `Web Workers: A Second Thread is the browser's escape hatch when The Event Loop has too much CPU work on the main thread. The visualization starts with a 50 MB CSV parse that takes 800 ms. On the main thread, that blocks clicks and misses about 48 render deadlines at 60 fps. In a worker, the computation runs on a separate JavaScript thread, so How a Browser Paints a Page can keep rendering while the parse continues elsewhere.`,
        `Workers are isolated by design. They have their own call stack, event loop, and memory heap. They cannot touch the DOM, window, or variables from the page. Communication happens through postMessage, and the result returns to the main thread as an ordinary task in a Queue, preserving UI ownership cleanly throughout.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Create one with new Worker("parse.js"). The page sends data with postMessage. The worker receives it in onmessage, parses, compresses, filters, or runs inference, then posts a result back. That reply is not a magical direct DOM update. It waits in the main task queue until the page can handle it, and only the main thread updates the interface. This is why the demo's parsed rows still appear through an onmessage handler on the page side.`,
        `The second view shows the postage. By default, postMessage uses the structured-clone algorithm, which deep-copies supported values. The demo prices this at about 5 ms per MB, so copying 50 MB can cost around 250 ms on the sending thread. Transferable ArrayBuffers avoid that copy by moving ownership. SharedArrayBuffer allows true shared memory, but requires cross-origin isolation headers and careful Atomics use.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A worker does not make an O(n squared) algorithm become O(n); it moves work off the UI thread and may run in parallel if a core is available. Startup and memory are nonzero, and message cost scales with payload size. Workers win when computation dwarfs communication: tens or hundreds of milliseconds of CPU, chunky data, and few messages. They lose when the task is tiny, chatty, or DOM-bound. The practical design move is batching: send one large job, transfer large buffers when ownership can move, and report progress at human-visible intervals instead of per record.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Spreadsheets, browser IDEs, design tools, and map apps use workers to keep interaction smooth while formulas, syntax analysis, geometry, or tiles are computed. Tokenization (BPE) and Attention Mechanism are examples of ML-adjacent work that can be pushed into a worker for in-browser demos. Service Workers & Offline-First are related but different: they intercept fetches and cache responses, while web workers are usually hired for computation.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not pass DOM nodes, functions, or event listeners; structured clone cannot carry them. Do not post a message every frame unless the payload is tiny and measured. Do not assume worker order is free from race bugs just because the DOM is protected. Once multiple executors coordinate, you are in the same design family as Message Queues and consensus protocols: isolation helps, but messages still need protocol discipline.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study The Event Loop first, then How a Browser Paints a Page to see why the main thread is precious. Service Workers & Offline-First explains the worker-like proxy used for networking. Message Queues and Distributed Tracing show the same messaging and observability problems once the boundary is between services instead of browser threads.`,
      ],
    },
  ],
};
