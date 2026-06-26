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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a shared-memory protocol. A SharedArrayBuffer is one block of bytes visible to more than one JavaScript agent, a typed array is a view over those bytes, and Atomics operations are ordered operations over shared control words. Active cells show the control word being read, written, waited on, or notified.',
        {type:"callout", text:"Shared memory is useful only when the bytes have a small explicit protocol for ownership, ordering, sleep, wake, and backpressure."},
        {type:"image", src:"https://upload.wikimedia.org/wikipedia/commons/b/b7/Circular_buffer.svg", alt:"Conceptual circular buffer ring divided into slots.", caption:"Circular buffer conceptual ring, by Cburnett, CC BY-SA 3.0 or GFDL, via Wikimedia Commons."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Browser workers normally communicate by messages that clone a value or transfer ownership of an ArrayBuffer. That default is safe because mutable state stays local. SharedArrayBuffer exists for workloads where both sides must keep touching the same bytes, such as WebAssembly threads, media pipelines, worker pools, and numeric buffers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is postMessage with structured clone, or transfer for a one-way byte payload. It is simple and should remain the default. It fails when a producer and consumer need an ongoing stream over the same storage instead of a new ownership handoff for every chunk.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ownership plus races. Transfer makes the sender give up the buffer, but shared streaming needs producer and consumer alive on the same storage. Once that isolation is removed, payload bytes do not say whether a slot is empty, full, being written, or safe to reuse.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate control words from payload bytes. Control words live in an Int32Array or BigInt64Array view because Atomics.wait and Atomics.notify operate there, while payload can live in a Uint8Array, Float32Array, or WebAssembly memory view. The invariant is publish before notify, then recheck after wake.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A ring buffer stores records in fixed slots. Head points to the next slot the consumer may read, and tail points to the next slot the producer may write. Atomics.wait checks a shared value before sleeping, and Atomics.notify wakes waiters without carrying the data itself.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The ring proof is an ownership proof. The producer alone advances tail after writing a slot, and the consumer alone advances head after reading a slot. The wait proof comes from checking the expected value before sleeping and reloading after wake, so lost and spurious wakeups become ordinary state checks.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Shared memory can remove copy cost, but it adds protocol cost. A 4 MB frame copied 60 times per second moves about 240 MB per second through copy paths; a shared ring can avoid that movement. The price is capacity rules, binary layout, shutdown, timeout, crash handling, isolation headers, and race tests.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SharedArrayBuffer fits WebAssembly threads, audio processing, video pipelines, model inference buffers, and worker pools that process fixed-size records. It is strongest when the same bytes are reused repeatedly and backpressure matters. A full ring slows the producer; an empty ring lets the consumer sleep instead of polling.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the protocol is larger than the performance problem. Ordinary UI state, small occasional messages, and one-way ownership transfer are clearer with postMessage. Blocking Atomics.wait also cannot run on the browser main thread, and SharedArrayBuffer requires secure context plus cross-origin isolation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A ring has 4 slots, each holding 1,024 bytes. Head = 0 and tail = 0 means empty. The producer writes record A into slot 0, stores tail = 1 atomically, and notifies; the consumer sees head = 0 and tail = 1, reads 1,024 bytes, then stores head = 1 to free the slot.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN SharedArrayBuffer, MDN Atomics.wait, MDN Atomics.notify, and the ECMAScript memory model sections for shared memory and atomics. Study structured clone, transferables, ring buffers, lock-free queues, sequence locks, futex-style waits, WebAssembly linear memory, backpressure, and cross-origin isolation.',
      ],
    },
  ],
};