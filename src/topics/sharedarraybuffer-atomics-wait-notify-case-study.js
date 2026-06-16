// SharedArrayBuffer and Atomics: shared browser memory, typed-array views,
// ring-buffer coordination, wait/notify, and isolation requirements.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sharedarraybuffer-atomics-wait-notify-case-study',
  title: 'SharedArrayBuffer & Atomics',
  category: 'Systems',
  summary: 'A browser shared-memory primer: SharedArrayBuffer, typed-array views, cross-origin isolation, Atomics operations, wait/notify, and ring-buffer backpressure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shared memory', 'wait notify'], defaultValue: 'shared memory' },
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

function sharedGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'main', label: 'main', x: 0.8, y: 2.7, note: notes.main ?? 'UI' },
      { id: 'worker', label: 'worker', x: 0.8, y: 5.3, note: notes.worker ?? 'compute' },
      { id: 'sab', label: 'SAB', x: 3.0, y: 4.0, note: notes.sab ?? 'same bytes' },
      { id: 'i32', label: 'Int32', x: 4.9, y: 2.7, note: notes.i32 ?? 'control' },
      { id: 'u8', label: 'Uint8', x: 4.9, y: 5.3, note: notes.u8 ?? 'payload' },
      { id: 'atomics', label: 'Atomics', x: 7.0, y: 4.0, note: notes.atomics ?? 'sync' },
      { id: 'rules', label: 'headers', x: 8.9, y: 4.0, note: notes.rules ?? 'isolation' },
    ],
    edges: [
      { id: 'e-main-sab', from: 'main', to: 'sab', weight: '' },
      { id: 'e-worker-sab', from: 'worker', to: 'sab', weight: '' },
      { id: 'e-sab-i32', from: 'sab', to: 'i32', weight: '' },
      { id: 'e-sab-u8', from: 'sab', to: 'u8', weight: '' },
      { id: 'e-i32-atomics', from: 'i32', to: 'atomics', weight: '' },
      { id: 'e-atomics-rules', from: 'atomics', to: 'rules', weight: '' },
    ],
  }, { title });
}

function ringGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'prod', label: 'prod', x: 0.7, y: 4.0, note: notes.prod ?? 'writes' },
      { id: 'head', label: 'head', x: 2.5, y: 2.3, note: notes.head ?? 'read idx' },
      { id: 'tail', label: 'tail', x: 2.5, y: 5.7, note: notes.tail ?? 'write idx' },
      { id: 'ring', label: 'ring', x: 4.7, y: 4.0, note: notes.ring ?? 'slots' },
      { id: 'wait', label: 'wait', x: 6.7, y: 5.7, note: notes.wait ?? 'empty?' },
      { id: 'notify', label: 'notify', x: 6.7, y: 2.3, note: notes.notify ?? 'wake' },
      { id: 'cons', label: 'cons', x: 8.8, y: 4.0, note: notes.cons ?? 'reads' },
    ],
    edges: [
      { id: 'e-prod-tail', from: 'prod', to: 'tail', weight: '' },
      { id: 'e-tail-ring', from: 'tail', to: 'ring', weight: '' },
      { id: 'e-ring-head', from: 'ring', to: 'head', weight: '' },
      { id: 'e-head-cons', from: 'head', to: 'cons', weight: '' },
      { id: 'e-ring-notify', from: 'ring', to: 'notify', weight: '' },
      { id: 'e-notify-cons', from: 'notify', to: 'cons', weight: '' },
      { id: 'e-cons-wait', from: 'cons', to: 'wait', weight: '' },
      { id: 'e-wait-head', from: 'wait', to: 'head', weight: '' },
    ],
  }, { title });
}

function* sharedMemoryView() {
  yield {
    state: sharedGraph('SharedArrayBuffer gives two agents the same bytes'),
    highlight: { active: ['main', 'worker', 'sab', 'e-main-sab', 'e-worker-sab'], found: ['i32', 'u8'] },
    explanation: 'ArrayBuffer transfer moves ownership. SharedArrayBuffer keeps a shared data block visible to multiple agents, such as the page and a worker. Each side creates typed-array views over the same bytes.',
    invariant: 'Shared bytes need Atomics discipline.',
  };

  yield {
    state: labelMatrix(
      'Security gate',
      [
        { id: 'secure', label: 'HTTPS' },
        { id: 'coop', label: 'COOP' },
        { id: 'coep', label: 'COEP' },
        { id: 'check', label: 'check' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['safe ctx', 'API hidden'],
        ['isolate top', 'not iso'],
        ['isolate deps', 'blocked deps'],
        ['xOriginIso', 'fallback'],
      ],
    ),
    highlight: { found: ['coop:job', 'coep:job', 'check:job'], removed: ['secure:failure'] },
    explanation: 'Browsers gate SharedArrayBuffer sharing behind secure context and cross-origin isolation because shared memory and high-resolution timing affect side-channel risk. Robust code checks crossOriginIsolated and falls back when needed.',
  };

  yield {
    state: sharedGraph('Typed-array views split control words from payload bytes', { i32: 'head/tail', u8: 'records', atomics: 'ordered ops' }),
    highlight: { active: ['sab', 'i32', 'u8', 'atomics', 'e-sab-i32', 'e-sab-u8', 'e-i32-atomics'], compare: ['main', 'worker'] },
    explanation: 'The same SharedArrayBuffer can have an Int32Array view for synchronization fields and a Uint8Array view for raw payload. Atomics operate on typed-array elements so both sides agree on control state.',
  };

  yield {
    state: labelMatrix(
      'Atomics toolbox',
      [
        { id: 'load', label: 'load' },
        { id: 'store', label: 'store' },
        { id: 'add', label: 'add' },
        { id: 'cas', label: 'CAS' },
        { id: 'wait', label: 'wait' },
      ],
      [
        { id: 'does', label: 'does' },
        { id: 'use', label: 'use' },
      ],
      [
        ['read order', 'flags'],
        ['write order', 'publish'],
        ['atomic inc', 'counters'],
        ['if equals', 'locks'],
        ['sleep', 'blocking'],
      ],
    ),
    highlight: { found: ['load:does', 'store:does', 'cas:use'], active: ['wait:does'] },
    explanation: 'Ordinary reads and writes can race. Atomics provide ordered operations on shared typed arrays. compareExchange is the usual lock primitive; wait and notify turn a spin loop into a sleep-and-wake protocol.',
  };

  yield {
    state: labelMatrix(
      'When to use shared memory',
      [
        { id: 'stream', label: 'stream' },
        { id: 'wasm', label: 'Wasm' },
        { id: 'small', label: 'small msg' },
        { id: 'ui', label: 'UI state' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['SAB ring', 'many chunks'],
        ['SAB memory', 'threads'],
        ['postMsg', 'simple'],
        ['main only', 'DOM rules'],
      ],
    ),
    highlight: { found: ['stream:choice', 'wasm:choice'], compare: ['small:choice', 'ui:choice'] },
    explanation: 'Shared memory is for high-throughput streams, WebAssembly threads, audio/video/ML pipelines, and worker pools where copy or message overhead dominates. Ordinary UI state should stay in message-passing land.',
  };
}

function* waitNotifyView() {
  yield {
    state: ringGraph('A shared ring buffer needs head and tail control words'),
    highlight: { active: ['prod', 'tail', 'ring', 'head', 'cons', 'e-prod-tail', 'e-tail-ring', 'e-ring-head', 'e-head-cons'] },
    explanation: 'A producer-consumer ring buffer uses payload slots plus control words. The producer advances tail after writing. The consumer advances head after reading. Both words live in a shared Int32Array.',
    invariant: 'The data slots are not enough; the protocol lives in the metadata.',
  };

  yield {
    state: ringGraph('The consumer sleeps when the ring is empty', { head: 'h == t', wait: 'sleep', cons: 'blocked' }),
    highlight: { active: ['cons', 'wait', 'head', 'e-cons-wait', 'e-wait-head'], compare: ['prod'] },
    explanation: 'Atomics.wait(view, index, expected) checks that the shared location still has the expected value. If it does, the worker sleeps instead of burning CPU in a spin loop.',
  };

  yield {
    state: ringGraph('The producer publishes data and wakes a waiter', { tail: 'store t+1', notify: 'wake 1', cons: 'ready' }),
    highlight: { active: ['prod', 'tail', 'ring', 'notify', 'cons', 'e-prod-tail', 'e-tail-ring', 'e-ring-notify', 'e-notify-cons'], found: ['cons'] },
    explanation: 'The producer writes payload bytes, stores the new tail with Atomics.store, then calls Atomics.notify on the control word. A waiting worker wakes and rechecks the shared state.',
  };

  yield {
    state: labelMatrix(
      'wait/notify contract',
      [
        { id: 'view', label: 'view type' },
        { id: 'expected', label: 'expected' },
        { id: 'returns', label: 'returns' },
        { id: 'main', label: 'main thrd' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['Int32/Big64', 'shared only'],
        ['must match', 'avoid lost'],
        ['ok/not/tmo', 'branch'],
        ['no block', 'use async'],
      ],
    ),
    highlight: { active: ['view:rule', 'expected:rule', 'returns:rule'], removed: ['main:rule'] },
    explanation: 'Atomics.wait only works on Int32Array or BigInt64Array views backed by SharedArrayBuffer. It returns not-equal, ok, or timed-out. Browser main threads cannot use blocking wait; use worker-side waits or waitAsync-style designs.',
  };

  yield {
    state: labelMatrix(
      'Ring failure modes',
      [
        { id: 'lost', label: 'lost wake' },
        { id: 'spin', label: 'spin loop' },
        { id: 'full', label: 'full ring' },
        { id: 'stale', label: 'stale read' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['stuck', 'wait value'],
        ['hot CPU', 'sleep'],
        ['overwrite', 'backpress'],
        ['bad bytes', 'Atomics'],
      ],
    ),
    highlight: { removed: ['lost:symptom', 'full:symptom'], found: ['lost:fix', 'stale:fix'] },
    explanation: 'The hard parts are the same as systems programming: lost wakeups, memory ordering, full-buffer backpressure, and shutdown. Keep the protocol tiny, documented, and wrapped behind an API.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shared memory') yield* sharedMemoryView();
  else if (view === 'wait notify') yield* waitNotifyView();
  else throw new InputError('Pick a SharedArrayBuffer view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'SharedArrayBuffer is JavaScript shared memory. Instead of copying data between a page and a worker or transferring ownership away from the sender, both agents receive objects that reference the same shared data block. Typed arrays then interpret that block as control words, counters, records, pixels, or raw bytes.',
        'Atomics is the synchronization layer for shared typed arrays. It gives ordered loads and stores, atomic increments, compare-and-swap, and wait/notify primitives. Without a protocol built on those operations, shared memory is just a fast way to create race bugs.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A page creates a SharedArrayBuffer and posts it to a worker. The receiving agent gets a different SharedArrayBuffer object, but both objects reference the same shared data block. A side effect in one agent eventually becomes visible in the other. MDN explicitly calls out that Atomics are needed to synchronize this shared visibility.',
        'A common layout reserves the first few Int32 values for metadata such as head, tail, length, state, and shutdown flag. The rest of the buffer holds payload bytes through a Uint8Array view. Atomics.load, Atomics.store, Atomics.add, and Atomics.compareExchange keep the control words coherent. Atomics.wait and Atomics.notify let workers sleep until a value changes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The win is avoiding repeated copies and transfers. A worker can stream bytes through a shared ring buffer, a WebAssembly module can use shared memory for threads, and a renderer can hand off large binary work without allocating new buffers for every chunk.',
        'The cost is security setup and concurrency discipline. Browser sharing requires secure context and cross-origin isolation headers. The constructor or postMessage path may be unavailable when those requirements are not met. Blocking Atomics.wait is not available on the browser main thread, so UI code must use messages, nonblocking designs, or worker-side waits.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a real-time audio feature. The main thread or audio-facing code writes encoded frames into a SharedArrayBuffer ring. A worker reads from the ring, decodes or analyzes frames, and writes results into another shared region. The producer updates tail and notifies. The consumer waits when empty and advances head after reading. A full ring applies backpressure instead of overwriting unread frames.',
        'The same architecture appears in WebAssembly threads. WebAssembly.Memory can be created as shared, making its buffer a SharedArrayBuffer. That connects WebAssembly Linear Memory Case Study to this page: the byte array is still the abstraction, but now multiple agents can coordinate around the same bytes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use SharedArrayBuffer as a casual faster postMessage. Use structured clone for small data and transfer for one-way big buffers. Reach for SharedArrayBuffer when the data stream is hot enough that ownership moves or copies become the bottleneck.',
        'Do not treat Atomics.notify as data delivery. It wakes waiters; it does not carry payload. The payload must already be published in shared memory with the correct ordering. Do not block the main thread; use workers for blocking waits and keep the UI event loop free.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN SharedArrayBuffer at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer, MDN Atomics.wait at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait, MDN Atomics.notify at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/notify, and V8 Atomics.wait/notify/waitAsync at https://v8.dev/features/atomics.',
        'Study Structured Clone & Transferables first for the clone and ownership-transfer alternatives. Then study Ring Buffer, Lock-Free Queue, Sequence Lock, Futex Wait Queue Case Study, WebAssembly Linear Memory Case Study, Web Workers: A Second Thread, Backpressure, and Work-Stealing Deque Scheduler.',
        'For the browser-security prerequisite behind SharedArrayBuffer, study Cross-Origin Isolation: COOP, COEP & CORP next. It explains why the shared-memory feature is gated by opener and embedder policy rather than exposed as a generic performance switch.',
      ],
    },
  ],
};
