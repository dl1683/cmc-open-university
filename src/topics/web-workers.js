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
        `A web worker is a second thread running JavaScript on your machine, completely isolated from the main thread that owns your web page. When the event loop on the main thread is blocked by CPU-heavy work — parsing a 50 MB CSV file, compressing an image, running a neural network inference — the page freezes: buttons do not respond, animations stutter, the browser misses 48 render deadlines in a row. A worker solves this by doing the heavy lifting in parallel, on a separate CPU core, leaving the main thread free to paint and handle clicks. You hire a worker with new Worker("script.js"), send it data with postMessage(), and it mails results back the same way.`,
        `The catch is isolation: workers live in a completely separate apartment. They have their own call stack, their own event loop, their own memory heap — they cannot touch the DOM, the window object, or any variable from your page. This extreme isolation is not a limitation; it is the whole point. Shared memory between threads breeds race conditions and deadlocks, the very concurrency bugs JavaScript was designed to avoid. Instead, everything travels by mail: you copy data into a message, the worker processes it, and results come back as an ordinary task in the main thread's queue.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization shows two threads: the MAIN THREAD, which owns the DOM, and a WORKER, which owns nothing but a CPU and an event loop. Imagine you have a 50 MB CSV file to parse. Without a worker, you call parse(csv) on the main thread. The function runs to completion — the iron rule of the event loop is that a task never interrupts mid-flight. For 800 milliseconds, the stack is occupied, the queue backs up with pending clicks and animations, the render deadline comes and goes 48 times without a paint. The page is dead in the water.`,
        `With a worker, you send the CSV across with postMessage(csv). This returns instantly — your main thread loses no time. The worker receives the data in its own onmessage handler, parses it in its own event loop on a separate CPU core, and when it finishes, posts the results back with postMessage(rows). This arrival is key: the results show up as an ordinary task in the main thread's task queue, waiting its turn like any click or timeout. While that task queue drains, the main thread is still running: animations render, clicks execute, the page stays smooth. The synchronization happens only when the worker is done and the main thread gets a chance to process the result — which may be microseconds later, or seconds later if the page is busy. This is the restaurant metaphor: the kitchen (worker) cooks; the waiter (main thread) takes the order and serves the plates. They work in parallel; the kitchen does not touch the customer.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Starting a worker is cheap: new Worker(url) takes microseconds and boots a fresh OS thread. But the mail service has a price: postMessage uses the structured-clone algorithm to copy data (a deep copy that handles objects, arrays, maps, cycles). Copying costs roughly 5 milliseconds per megabyte, and the cost is paid on the sending thread. Mail a 50 MB dataset to a worker, and you pay 250 milliseconds on the main thread to avoid 800 milliseconds of parsing — a net win, but not as clean as it first appears. If you chat between threads often, the postage bill quickly exceeds the work.`,
        `Three ways exist to move large data: structured clone (safe, slow: ~250 ms for 50 MB), transfer (ownership moves, sender gets neutered copy: ~0 ms, great for pipelines), and SharedArrayBuffer (genuine shared memory: ~0 ms, but reintroduces locks and races and requires special security headers). For most use cases, clone works fine; transfer is the win when data flows one direction; shared memory is the last resort. Storage cost is minimal: a worker thread adds a separate heap per worker (baseline ~10 MB per thread), so do not spawn 10,000 workers. A handful, or perhaps hundreds, is sensible.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Google Sheets, VS Code in the browser, Figma, and all heavy web applications rely on workers for their responsiveness. Sheets offloads formula recalculation to a worker, so the UI stays snappy as you edit thousands of cells. Figma moves rendering and geometry computation to workers, so the canvas can paint every frame while complex shapes are being tessellated in the background. VS Code's language server and syntax highlighting run in workers.`,
        `The typical patterns: parsing (JSON, CSV, images), compression (gzip, brotli), cryptography (hashing, encryption), image processing (filters, resizing), and machine learning inference (neural networks, transformers). Any task that burns CPU for more than 50 milliseconds is a candidate. Conversely, if your work is tiny (2 milliseconds) and called very often, or if it needs to touch the DOM every frame, a worker is overhead — the postage exceeds the work, or the worker cannot do the job at all.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is overestimating parallelism. A worker does not make your code faster; it makes your page more responsive. If your algorithm takes 800 milliseconds and the page has a single CPU core, a worker still takes 800 milliseconds — it just burns that time in a separate thread so the page does not freeze. On a multi-core machine, you get a genuine speedup; on a single core, you get smoothness instead, which is sometimes worth more.`,
        `The second trap is chatty communication. If a worker finishes a tiny piece of work and postMessages back every 10 milliseconds for a user interaction that expects 60 frames per second, the clone cost balloons, and you lose the parallelism win. Batch your messages: do 100 milliseconds of work, then post back once. The third trap is forgetting that workers are isolated: you cannot pass a DOM element, a function, or a listener to a worker; you can only send JSON-serializable data, ArrayBuffers, and a few special types. Finally, do not assume the worker result updates the DOM automatically — it returns to the main thread as an ordinary task that you must handle in onmessage, and THEN you update the page.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Workers are a distribution pattern: you split work across threads, pay a messaging cost, and gain responsiveness in return. This is the same shape you see everywhere: The Event Loop (which explains why this freezing happens in the first place), How a Browser Paints a Page (which shows when the main thread must run), Message Queue (which is how workers post results back — as ordinary tasks), Two-Phase Commit (the same isolation principle across database replicas), and Raft Leader Election (the same message-driven consensus on servers). Learn Tokenization to handle the large inputs that often go to workers, or explore Attention Mechanisms to see a real neural network operation that worker threads commonly run in production.`,
      ],
    },
  ],
};
