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
  const csvSize = 50;
  const parseTime = 800;
  const frameMs = 16.7;
  const missedFrames = Math.floor(parseTime / frameMs);
  const ramLatency = 0.1;

  yield {
    state: threads({
      main: [{ id: 'parse', label: `parse(${csvSize}MB CSV)`, note: `${parseTime}ms of CPU` }],
      mainQ: [
        { id: 'click1', label: 'click handler', note: 'waiting' },
        { id: 'click2', label: 'click handler', note: 'waiting' },
      ],
      note: 'not hired yet',
      renderNote: `FROZEN — ${missedFrames} frames missed`,
    }),
    highlight: { active: ['parse'], compare: ['click1', 'click2'], removed: ['render'] },
    explanation: `The Event Loop taught the iron rule: a task runs to COMPLETION — nothing interrupts it. Here is the rule's dark side: parsing a ${csvSize}MB CSV takes ${parseTime}ms of pure CPU, and for all ${parseTime}ms the stack is occupied. Clicks pile up in the task queue. The ${frameMs}ms render deadline passes ${missedFrames} times with no paint. The page is frozen — not because anything is wrong, but because the event loop is working exactly as designed. No amount of async/await fixes this: promises slice up WAITING, not COMPUTING.`,
  };

  yield {
    state: threads({
      main: [{ id: 'post', label: 'worker.postMessage(csv)', note: 'returns instantly' }],
      worker: [{ id: 'parse', label: `parse(${csvSize}MB CSV)`, note: `${parseTime}ms — elsewhere` }],
      renderNote: 'smooth 60fps ✓',
    }),
    highlight: { active: ['parse'], found: ['render', 'post'] },
    explanation: `The escape hatch: new Worker("parse.js") starts a genuinely SEPARATE thread — its own call stack, its own event loop, its own memory heap. The main thread mails the data over with postMessage() and returns in ~${ramLatency}ms; the ${parseTime}ms of parsing now burns a different CPU core. Buttons click, animations run, the event loop never notices. The isolation is total: the worker cannot see the DOM, window, or any variable of the page — by design. Two threads sharing the DOM would mean locks, races, and every concurrency bug JavaScript was built to avoid (the same reasons Raft and Two-Phase Commit exist between machines).`,
    invariant: `Worker and page share NOTHING: separate heaps, ${csvSize}MB of CSV crosses only by message, never by reference.`,
  };

  yield {
    state: threads({
      main: [],
      mainQ: [{ id: 'onmsg', label: 'onmessage(rows)', note: 'a normal task' }],
      worker: [{ id: 'reply', label: 'postMessage(rows)', note: 'done' }],
      renderNote: 'still smooth ✓',
    }),
    highlight: { active: ['reply'], visited: ['onmsg'] },
    explanation: `The worker finishes and mails the parsed rows back. Note HOW the reply arrives: as an ordinary task in the main thread's task queue, taking its turn behind pending clicks and renders, obeying every rule of event-loop etiquette. The onmessage handler then updates the DOM — because only the main thread may paint. This is the clean division of labor: WORKERS COMPUTE, MAIN PAINTS. The ${parseTime}ms parse ran on a separate core while the main thread stayed free for the full ${missedFrames} frames it would have missed.`,
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
    explanation: `The capability sheet: workers get the network, storage, and raw compute (they are where WebAssembly modules and ML inference like in-browser transformers usually run); they never get the page itself. So the architecture writes itself — keep the main thread as a thin UI layer, push parsing, compression, image processing, crypto, and model inference into workers. Figma, VS Code in the browser, and Google Sheets all live by this split. One caution before you hire a thread for everything: the mail service between them charges by weight — even our ${csvSize}MB CSV costs postage the other view prices.`,
  };
}

function* tax() {
  const cloneRate = 5;
  const payloadMB = 50;
  const cloneCost = cloneRate * payloadMB;
  const kbCost = 0.005;
  const tinyTaskMs = 2;

  yield {
    state: matrixState({
      title: `postMessage copies — the structured-clone bill (~${cloneRate}ms per MB)`,
      rows: [
        { id: 'kb', label: '1 KB of JSON' },
        { id: 'mb', label: '1 MB of rows' },
        { id: 'mb50', label: `${payloadMB} MB of rows` },
      ],
      columns: [{ id: 'clone', label: 'clone cost' }, { id: 'where', label: 'paid on which thread?' }],
      values: [[kbCost, 1], [cloneRate, 1], [cloneCost, 1]],
      format: (v) => (v === 1 ? 'MAIN (blocking!)' : v < 1 ? `~${kbCost} ms` : `~${v} ms`),
    }),
    highlight: { removed: ['mb50:clone', 'mb50:where'] },
    explanation: `The fine print: postMessage does not SHARE data — separate heaps, remember — it COPIES it, via the structured-clone algorithm (a deep copy that handles objects, arrays, maps, dates, cycles). Cloning costs roughly ${cloneRate}ms per MB, and the outbound copy is paid ON THE MAIN THREAD — the very thread you were protecting. Mail ${payloadMB}MB to the worker and you just froze the page for ~${cloneCost}ms to avoid freezing it for 800ms. A win, but an embarrassing one; mail results back and forth chattily and the postage exceeds the work.`,
    invariant: `Structured clone at ~${cloneRate}ms/MB means a ${payloadMB}MB payload costs ~${cloneCost}ms — paid by the sending thread.`,
  };

  yield {
    state: matrixState({
      title: `Three ways to move ${payloadMB} MB`,
      rows: [
        { id: 'clone', label: 'structured clone' },
        { id: 'transfer', label: 'transfer ArrayBuffer' },
        { id: 'shared', label: 'SharedArrayBuffer' },
      ],
      columns: [{ id: 'cost', label: 'cost' }, { id: 'catch', label: 'the catch' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', `~${cloneCost} ms copy`, 'none — just slow', '~0 ms', 'sender loses it (neutered)', '~0 ms, both see it', 'real shared memory: Atomics, locks, races'][v],
    }),
    highlight: { found: ['transfer:cost'], compare: ['shared:catch'] },
    explanation: `The upgrades: TRANSFER an ArrayBuffer and ownership MOVES instead of copying — near-zero cost, but the sender's copy is neutered (length 0, unusable); perfect for pipelines where data flows one way: postMessage(buf, [buf]). SharedArrayBuffer goes further — one block of memory both threads genuinely see — but it reintroduces everything workers were designed to avoid: Atomics, locks, data races (and it requires special security headers, since Spectre). The ladder: clone for small things, transfer for big one-way things like our ${payloadMB}MB buffer, shared memory only when you truly need both threads in the same bytes.`,
  };

  yield {
    state: matrixState({
      title: 'Should this work leave the main thread?',
      rows: [
        { id: 'big', label: 'CPU > 50ms, chunky data' },
        { id: 'dom', label: 'touches the DOM' },
        { id: 'tiny', label: `${tinyTaskMs}ms task, called often` },
        { id: 'chat', label: 'needs replies every frame' },
      ],
      columns: [{ id: 'verdict', label: 'verdict' }],
      values: [[1], [0], [0], [2]],
      format: (v) => ['main thread — postage > work', 'WORKER — clear win', 'borderline: transfer, batch messages'][v],
    }),
    highlight: { found: ['big:verdict'], removed: ['dom:verdict', 'tiny:verdict'] },
    explanation: `The decision table. Workers win when the computation dwarfs the postage: parsing, compressing, image filters, model inference. They lose on DOM work (cannot touch it), tiny frequent tasks (clone overhead at ${cloneRate}ms/MB swamps a ${tinyTaskMs}ms job), and chatty per-frame conversations (unless you batch or transfer). The deeper pattern is one you have seen all over this site: moving work to another executor is never free — the messaging cost is the price of isolation, whether between browser threads, microservices behind a Message Queue, or replicas in Raft. Distribution is a trade, and the postage is the receipt.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as two event loops. The main thread owns the document object model, or DOM, which is the browser tree representing the page. The worker thread owns separate compute state. Active highlights show where CPU time is running, found highlights show smooth rendering or completed transfers, and removed highlights show a frozen render slot or an expensive copy.',
        {type: "callout", text: "A worker is useful only when isolation saves more interaction budget than the message boundary costs."},
        {type: 'image', src: './assets/gifs/web-workers.gif', alt: 'Animated walkthrough of the web workers visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is queue isolation. Work that occupies the worker queue does not occupy the main queue, so input and paint can continue unless message copying, result merging, or DOM updates become the new bottleneck.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browsers have a tight interaction budget. At 60 frames per second, one frame is about 16.7 milliseconds. If JavaScript spends 800 milliseconds parsing a file on the main thread, input waits and many paint opportunities are missed.',
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/6/61/HTML5_logo_and_wordmark.svg`, alt: `HTML5 logo and wordmark`, caption: `Web Workers arrived with the HTML5 application era, when browser pages became long-running software instead of mostly static documents. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:HTML5_logo_and_wordmark.svg.`},
        'Web Workers exist so CPU-heavy JavaScript can run in another execution context. A worker has its own event loop and global scope, communicates by messages, and cannot directly mutate the DOM.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is async code on the main thread. async and await help when a task waits for input/output, such as a network response, because the event loop can run other work while waiting. They do not make a long CPU loop stop consuming the current JavaScript task.',
        'Another approach is to split the work into small chunks and yield between chunks. That can preserve responsiveness for divisible work, but it complicates every algorithm and still spends main-thread time.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is single-threaded ownership of the visible page. A long calculation on the main thread blocks input handling, style calculation, layout, and paint. The browser cannot render between two statements inside one long-running task.',
        'Workers move the calculation, but they introduce a boundary. Every useful input and output must be cloned, transferred, or shared. The boundary cost can erase the benefit if payloads are huge or messages are too frequent.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is isolate compute from presentation. The main thread should coordinate user interaction and DOM changes, while the worker performs long-running parsing, compression, image processing, search indexing, or WebAssembly computation.',
        'The boundary is also a safety feature. Because ordinary workers do not share page objects directly, the browser avoids locks around every DOM node. The price is that the program must design a message protocol instead of calling functions across threads.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A page creates a dedicated worker with the Worker constructor, often using a URL resolved by the bundler. The page sends data with postMessage, the worker receives a message event, computes, and posts a result back. The main thread handles that result later as another queued task.',
        'Data normally crosses by the structured-clone algorithm, which copies supported values. Transferable objects such as ArrayBuffer can move ownership without copying. SharedArrayBuffer allows shared memory, but then the program needs Atomics and cross-origin isolation headers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Workers work because the main queue and worker queue are separate. If a parse occupies the worker for 800 milliseconds, the main queue can still process clicks and paint frames. When the worker replies, the reply waits its turn on the main queue.',
        'The correctness invariant is ownership. The worker owns private compute state, and the main thread owns DOM state. Messages carry explicit snapshots, transferred buffers, or synchronized shared memory; hidden shared mutable page state is not part of the ordinary worker model.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Creating a worker has startup cost, and every message has serialization, transfer, scheduling, and merge cost. O(n) parsing remains O(n); a worker changes where the time is spent and may use another core. Doubling payload size roughly doubles clone cost unless ownership transfer avoids the copy.',
        'The dominant operation is often not computation but postage. A 50 MB ArrayBuffer transfer can be cheap because ownership moves; a 50 MB object graph clone can stall the sender. Progress messages every row can cost more than the parse itself.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Workers fit CSV parsing, syntax highlighting, image filters, compression, cryptography, geometry, search indexing, WebAssembly modules, and in-browser machine-learning preprocessing. The access pattern is long compute with compact inputs and outputs.',
        'They also fit pipelines where the worker can keep state across requests, such as a search index or parser cache. Service workers and shared workers solve different lifecycle and sharing problems, so choose the worker family by ownership and lifetime.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Workers fail when the task is small, DOM-heavy, or dominated by message traffic. Moving a 2 millisecond function to a worker usually adds overhead. Moving DOM manipulation is impossible because ordinary workers cannot touch the DOM directly.',
        'Shared memory can fail by making the program harder to reason about. Once SharedArrayBuffer enters the design, data races and ordering bugs become possible unless every access follows a clear Atomics protocol.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A page imports a 50 MB CSV. On the main thread, a parser that handles 60 MB/s blocks for about 833 milliseconds, so roughly 50 frames are missed at 60 fps. If the page transfers the raw ArrayBuffer to a worker, the main thread returns quickly and the worker spends the 833 milliseconds parsing off-thread.',
        'The protocol still matters. If the worker posts one message per row for 500,000 rows, the browser handles 500,000 tasks and the UI suffers again. Posting batches every 100 milliseconds, plus a final compact result, keeps the main thread in control.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Using Web Workers at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers, MDN structured clone at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm, and MDN SharedArrayBuffer at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.',
        'Study Event Loop, Structured Clone, Transferable Objects, SharedArrayBuffer and Atomics, Service Workers, OffscreenCanvas, and WebAssembly next. The core question is always whether isolation saves more time than the boundary costs.',
      ],
    },
  ],
};
