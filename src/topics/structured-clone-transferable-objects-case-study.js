// Browser message serialization: structured clone traversal, transfer lists,
// ownership moves, detachment, and the clone-vs-transfer decision.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'structured-clone-transferable-objects-case-study',
  title: 'Structured Clone & Transferables',
  category: 'Systems',
  summary: 'How browser messages copy object graphs, preserve cycles, reject unserializable values, and move ArrayBuffer or MessagePort ownership with transfer lists.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['clone graph', 'transfer list'], defaultValue: 'clone graph' },
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

function cloneGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'sender', label: 'sender', x: 0.7, y: 4.0, note: notes.sender ?? 'page' },
      { id: 'graph', label: 'object', x: 2.1, y: 2.5, note: notes.graph ?? 'refs' },
      { id: 'seen', label: 'seen', x: 3.8, y: 2.5, note: notes.seen ?? 'cycle map' },
      { id: 'bytes', label: 'bytes', x: 3.8, y: 5.4, note: notes.bytes ?? 'copy' },
      { id: 'copy', label: 'copy', x: 5.6, y: 3.8, note: notes.copy ?? 'new graph' },
      { id: 'queue', label: 'task q', x: 7.2, y: 3.8, note: notes.queue ?? 'message' },
      { id: 'worker', label: 'worker', x: 8.9, y: 3.8, note: notes.worker ?? 'receive' },
      { id: 'error', label: 'error', x: 5.6, y: 6.1, note: notes.error ?? 'if bad' },
    ],
    edges: [
      { id: 'e-send-graph', from: 'sender', to: 'graph', weight: '' },
      { id: 'e-graph-seen', from: 'graph', to: 'seen', weight: '' },
      { id: 'e-graph-bytes', from: 'graph', to: 'bytes', weight: '' },
      { id: 'e-seen-copy', from: 'seen', to: 'copy', weight: '' },
      { id: 'e-bytes-copy', from: 'bytes', to: 'copy', weight: '' },
      { id: 'e-copy-queue', from: 'copy', to: 'queue', weight: '' },
      { id: 'e-queue-worker', from: 'queue', to: 'worker', weight: '' },
      { id: 'e-graph-error', from: 'graph', to: 'error', weight: '' },
    ],
  }, { title });
}

function transferGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'page', label: 'page', x: 0.7, y: 4.0, note: notes.page ?? 'owns buf' },
      { id: 'buf', label: 'buffer', x: 2.3, y: 4.0, note: notes.buf ?? '50 MB' },
      { id: 'list', label: 'xfer list', x: 4.0, y: 2.4, note: notes.list ?? '[buffer]' },
      { id: 'detach', label: 'detach', x: 4.0, y: 5.7, note: notes.detach ?? 'sender 0' },
      { id: 'msg', label: 'message', x: 5.8, y: 4.0, note: notes.msg ?? 'metadata' },
      { id: 'worker', label: 'worker', x: 7.5, y: 4.0, note: notes.worker ?? 'new owner' },
      { id: 'result', label: 'result', x: 9.1, y: 4.0, note: notes.result ?? 'post back' },
    ],
    edges: [
      { id: 'e-page-buf', from: 'page', to: 'buf', weight: '' },
      { id: 'e-buf-list', from: 'buf', to: 'list', weight: '' },
      { id: 'e-buf-detach', from: 'buf', to: 'detach', weight: '' },
      { id: 'e-list-msg', from: 'list', to: 'msg', weight: '' },
      { id: 'e-msg-worker', from: 'msg', to: 'worker', weight: '' },
      { id: 'e-worker-result', from: 'worker', to: 'result', weight: '' },
    ],
  }, { title });
}

function* cloneGraphView() {
  yield {
    state: cloneGraph('Structured clone walks an object graph'),
    highlight: { active: ['sender', 'graph', 'e-send-graph'], found: ['seen'] },
    explanation: 'postMessage, IndexedDB, and structuredClone use structured serialization instead of JSON. The algorithm walks the object graph and prepares a new graph for the receiving realm.',
    invariant: 'Clone copies; transfer moves; SAB shares.',
  };

  yield {
    state: cloneGraph('A seen map preserves cycles and shared references', { seen: 'visited ids', copy: 'same shape' }),
    highlight: { active: ['graph', 'seen', 'copy', 'e-graph-seen', 'e-seen-copy'], compare: ['error'] },
    explanation: 'The algorithm maintains a map of already visited references. That prevents infinite recursion and lets cyclic structures survive the trip as cycles, not as JSON strings or broken trees.',
  };

  yield {
    state: labelMatrix(
      'Clone support map',
      [
        { id: 'plain', label: 'object' },
        { id: 'map', label: 'Map/Set' },
        { id: 'date', label: 'Date' },
        { id: 'typed', label: 'typed arr' },
        { id: 'error', label: 'Error' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'note', label: 'note' },
      ],
      [
        ['clone', 'plain data'],
        ['clone', 'entries'],
        ['clone', 'time value'],
        ['clone', 'bytes copied'],
        ['clone', 'name/msg'],
      ],
    ),
    highlight: { found: ['map:result', 'typed:result'], compare: ['error:note'] },
    explanation: 'Structured clone supports far more platform values than JSON: Maps, Sets, Dates, ArrayBuffers, typed arrays, Blobs, and many error objects. Some details, such as prototypes and property descriptors, are not preserved.',
  };

  yield {
    state: labelMatrix(
      'What fails or changes',
      [
        { id: 'fn', label: 'function' },
        { id: 'dom', label: 'DOM node' },
        { id: 'getter', label: 'getter' },
        { id: 'proto', label: 'prototype' },
      ],
      [
        { id: 'outcome', label: 'outcome' },
        { id: 'why', label: 'why' },
      ],
      [
        ['DataCloneErr', 'code stays'],
        ['DataCloneErr', 'live DOM'],
        ['value only', 'no accessor'],
        ['not walked', 'data graph'],
      ],
    ),
    highlight: { removed: ['fn:outcome', 'dom:outcome'], active: ['getter:outcome', 'proto:outcome'] },
    explanation: 'DataCloneError is a design boundary, not a random browser annoyance. A message should be data. Function closures, DOM identity, property descriptors, and prototype behavior belong to a running realm.',
  };

  yield {
    state: labelMatrix(
      'Clone decision table',
      [
        { id: 'small', label: 'small obj' },
        { id: 'cyclic', label: 'cyclic' },
        { id: 'large', label: 'large buf' },
        { id: 'shared', label: 'both need' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['clone', 'simple'],
        ['clone', 'keeps refs'],
        ['transfer', 'no copy'],
        ['SAB', 'same bytes'],
      ],
    ),
    highlight: { found: ['small:tool', 'cyclic:tool'], compare: ['large:tool', 'shared:tool'] },
    explanation: 'The design ladder is clone for ordinary data, transfer for big one-way buffers or ports, and SharedArrayBuffer only when two agents genuinely need shared bytes with explicit synchronization.',
  };
}

function* transferListView() {
  yield {
    state: transferGraph('A transfer list moves ownership instead of copying'),
    highlight: { active: ['page', 'buf', 'list', 'e-page-buf', 'e-buf-list'], found: ['worker'] },
    explanation: 'Transferable objects are listed separately from the message payload. The browser moves ownership of the resource to the destination, so large binary payloads avoid the structured-clone copy cost.',
    invariant: 'Transfer is a move. After ownership leaves, the sender must not keep using the old object.',
  };

  yield {
    state: transferGraph('ArrayBuffer transfer detaches the sender side', { detach: 'byteLen 0', worker: 'owns bytes', msg: 'no 50MB copy' }),
    highlight: { active: ['buf', 'list', 'detach', 'msg', 'worker', 'e-buf-detach', 'e-list-msg', 'e-msg-worker'], removed: ['page'] },
    explanation: 'When an ArrayBuffer is transferred, the original buffer is detached. Its byteLength becomes zero and typed-array views over it can no longer be used for the old bytes. The worker receives the backing store.',
  };

  yield {
    state: labelMatrix(
      'Transferable objects',
      [
        { id: 'arraybuf', label: 'ArrayBuf' },
        { id: 'port', label: 'MsgPort' },
        { id: 'bitmap', label: 'ImageBmp' },
        { id: 'canvas', label: 'Offscreen' },
      ],
      [
        { id: 'moves', label: 'moves' },
        { id: 'bestFor', label: 'best for' },
      ],
      [
        ['bytes', 'big data'],
        ['endpoint', 'reply pipe'],
        ['pixels', 'render work'],
        ['canvas', 'worker draw'],
      ],
    ),
    highlight: { found: ['arraybuf:moves', 'port:moves'], compare: ['bitmap:bestFor', 'canvas:bestFor'] },
    explanation: 'Transfer is not only for ArrayBuffers. MessagePort transfer is how a page hands a private reply pipe to a worker or iframe. Graphics APIs also use transfer to move pixel-oriented resources across threads.',
  };

  yield {
    state: transferGraph('One-way binary pipelines should transfer both directions', { page: 'load file', buf: 'input', worker: 'parse', result: 'out buf' }),
    highlight: { active: ['page', 'buf', 'list', 'worker', 'result', 'e-page-buf', 'e-buf-list', 'e-msg-worker', 'e-worker-result'], found: ['result'] },
    explanation: 'A practical parser pipeline sends an input ArrayBuffer to a worker, lets the worker produce a compact output buffer, and transfers that output back. The UI gets responsiveness without paying two huge copies.',
  };

  yield {
    state: labelMatrix(
      'Transfer pitfalls',
      [
        { id: 'forgot', label: 'not listed' },
        { id: 'reuse', label: 'reuse old' },
        { id: 'port', label: 'lost port' },
        { id: 'sab', label: 'SAB' },
      ],
      [
        { id: 'result', label: 'result' },
        { id: 'control', label: 'control' },
      ],
      [
        ['copied', 'add list'],
        ['detached', 'drop refs'],
        ['no reply', 'track owner'],
        ['not move', 'Atomics'],
      ],
    ),
    highlight: { removed: ['forgot:result', 'reuse:result'], active: ['sab:control'] },
    explanation: 'The common bug is assuming a transferable inside the payload automatically moves. It does not; include it in the transfer list. SharedArrayBuffer is different: it is shared, not transferred, and needs Atomics for coordination.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'clone graph') yield* cloneGraphView();
  else if (view === 'transfer list') yield* transferListView();
  else throw new InputError('Pick a structured clone view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Structured clone is the browser platform mechanism for copying rich JavaScript data between realms and APIs. Workers use it for postMessage. IndexedDB uses it for stored values. The standalone structuredClone function exposes the same family of behavior directly.',
        'Transferable objects are the escape hatch for resources that should move instead of copy. An ArrayBuffer in a transfer list gives its backing store to the receiver and detaches the sender. A MessagePort in a transfer list hands one endpoint of a channel to another execution context.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The structured clone algorithm recursively walks the input and keeps a map of already visited references. That is why cycles and repeated references can be preserved without JSON serialization. The result is a fresh object graph in the receiving realm, with supported built-in values reconstructed as data.',
        'The algorithm rejects values that are not serializable, including functions and DOM nodes. It also does not preserve every JavaScript object feature. MDN notes that property descriptors, setters, getters, private class elements, and prototype chains are not duplicated. Treat messages as data contracts, not as object identity teleportation.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cloning is proportional to the reachable graph and the bytes that must be copied. That cost is often paid by the sending agent before the message can leave. Small configuration objects are fine. Large ArrayBuffers, images, decoded columns, and model tensors should usually move by transfer or use shared memory when both sides truly need the same bytes.',
        'Transfer reduces copy cost but adds ownership discipline. After transfer, the sender cannot keep using the moved resource. That makes transfer ideal for staged pipelines and dangerous for code that assumes both sides keep mutable access.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a browser CSV importer. The page receives a File, reads it into an ArrayBuffer, and posts the buffer to a worker with postMessage({ name, buffer }, [buffer]). The page keeps metadata but loses ownership of the bytes. The worker parses the file, builds typed columns, and transfers a compact result buffer back. The main thread remains responsive because it avoided both CPU parsing and large deep copies.',
        'If the importer instead posted a giant array of row objects after parsing on the worker, the return path would pay a heavy structured-clone bill. A better design sends typed buffers, offsets, and a small schema object. Apache Arrow Columnar Memory Case Study and WebAssembly Linear Memory Case Study show the same byte-buffer discipline in other runtimes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use JSON.stringify as your mental model. Structured clone supports values JSON cannot express, but it also has platform-specific exclusions and metadata loss. Do not include a transferable only in the message payload and expect it to move; it must appear in the transfer list. Do not reuse a transferred ArrayBuffer on the sender side.',
        'SharedArrayBuffer is not a faster transfer. It is shared memory. The underlying data block remains visible to multiple agents, and coordination must happen through Atomics or a higher-level protocol.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN structured clone algorithm at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm, MDN structuredClone at https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone, MDN Transferable Objects at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects, and the HTML structured-data standard at https://html.spec.whatwg.org/multipage/structured-data.html.',
        'Study Web Workers: A Second Thread first, then OffscreenCanvas Worker Renderer for a concrete transferable rendering resource. SharedArrayBuffer & Atomics Wait/Notify covers the shared-memory alternative. Browser Message Channels & Broadcast Coordination shows how MessagePort transfer becomes a reply pipe. IndexedDB Object Store Case Study, Apache Arrow Columnar Memory Case Study, WebAssembly Linear Memory Case Study, Message Queue, and Backpressure show the same serialization boundary in storage and distributed systems.',
      ],
    },
  ],
};
