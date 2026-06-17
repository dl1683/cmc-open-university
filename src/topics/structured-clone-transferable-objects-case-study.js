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
      heading: 'Why this exists',
      paragraphs: [
        'Browser programs constantly cross realm boundaries. A page sends data to a worker. A worker sends a result back. IndexedDB stores a value for later. A service worker talks to a client. These boundaries are useful because they isolate work, but they also require a clear rule for what it means to pass a JavaScript value from one realm to another.',
        'JSON was never enough for that job. It loses Maps, Sets, Dates, typed arrays, ArrayBuffers, cycles, repeated references, errors, blobs, and many platform objects. It also pretends every message is text-shaped. Structured clone exists as the platform serialization mechanism for supported data graphs. Transferable objects exist for the cases where copying a resource is wasteful or where ownership should move instead of duplicate.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is JSON.stringify on the sender side and JSON.parse on the receiver side. That works for small plain data and is still a useful wire format when the boundary is a server, a log file, or a language-neutral API. It also makes the copy obvious: the receiver gets data, not live behavior.',
        'The wall appears as soon as the message is a real browser value instead of a plain object tree. Cycles throw. Repeated references become separate objects. Dates become strings unless handled manually. Binary data becomes slow and bulky. A Map becomes an object only after a custom conversion that may lose key identity. JSON is a text codec, not the browser object-passing algorithm.',
      ],
    },
    {
      heading: 'The data boundary',
      paragraphs: [
        'Structured clone is broader than JSON, but it is still a data boundary. It can clone many built-in values, including Maps, Sets, Dates, ArrayBuffers, typed arrays, Blobs, and many Error objects. It does not clone functions or DOM nodes. It does not preserve property descriptors, accessors, class private elements, or prototype-chain behavior as live semantics.',
        'That boundary is a feature. A message between a page and a worker should be a contract made of data. If the receiver could keep closures, DOM identity, getters, or prototype behavior from the sender realm, the boundary would stop being a boundary. DataCloneError is the platform saying that the value belongs to a running realm, not to a portable message.',
      ],
    },
    {
      heading: 'Core clone algorithm',
      paragraphs: [
        'The structured clone algorithm walks the reachable object graph and builds a new graph in the target realm. The key structure is a visited-reference map from source objects to destination objects. When the traversal sees an object for the first time, it creates the corresponding destination object. When it sees the same source object again, it reuses the destination object already recorded in the map.',
        'That map solves two problems at once. It prevents infinite recursion on cycles, and it preserves sharing. If two fields point to the same Map before cloning, the receiver should see two fields pointing to the same cloned Map. Without the map, a cyclic graph would never finish and a shared graph would silently become a tree.',
      ],
    },
    {
      heading: 'Transfer changes ownership',
      paragraphs: [
        'Cloning copies supported data. Transfer moves ownership of a transferable resource. An ArrayBuffer is the clean example: the receiving realm gets the backing memory, and the sender side is detached. Its byteLength becomes zero, and old typed-array views can no longer use the moved bytes.',
        'The transfer list is a separate part of the operation. Including a transferable object somewhere inside the message payload does not automatically move it. The transfer list tells the platform which resources should move rather than be cloned. The resource also has to be attached to the data being sent, or the receiver has no path to use it.',
      ],
    },
    {
      heading: 'How it works in a pipeline',
      paragraphs: [
        'A worker message often combines both ideas. The metadata is cloned: file name, parse options, schema version, counters, and offsets. The large ArrayBuffer is transferred so the worker owns the bytes. The worker parses the buffer into typed columns, creates a compact result buffer, and transfers that result back to the main thread with cloned metadata describing it.',
        'This pattern keeps the UI responsive for two separate reasons. CPU parsing happens off the main thread, and the big binary payload does not bounce through repeated deep copies. The sender must drop or replace references after transfer, because the old buffer no longer owns the resource.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Structured clone is correct because serialization and deserialization agree on a graph shape, not on object identity across realms. The receiver gets distinct objects in its own realm, but the relationships inside the cloned graph match the relationships that were serializable in the sender graph.',
        'Transfer is correct because it changes the ownership invariant. After transfer, there is one active owner of the moved resource. That prevents two independent agents from mutating the same ArrayBuffer through ordinary non-atomic views. If both agents truly need shared access, the right tool is SharedArrayBuffer plus an explicit synchronization protocol.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The clone view makes the visited map visible. The algorithm is not doing naive recursive copying. It records which source objects already have destination counterparts, reconnects repeated references to those counterparts, and rejects values that cannot cross the data boundary.',
        'The transfer view makes detachment visible. The ArrayBuffer can be present in the message payload, but the transfer list is what moves the backing store. After transfer, the worker has the usable bytes and the sender side has an empty shell. That is not a bug; it is the ownership rule.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Clone cost is proportional to the reachable graph and copied bytes. A deep object graph with many row objects can be expensive even if each row is small, because the algorithm must allocate and recreate the structure. A large typed array can be expensive because the bytes must be copied unless its buffer is transferred.',
        'Transfer reduces copy cost for the moved resource, but it adds a lifecycle cost. The sender has to treat the transferred object as gone. APIs must make ownership clear, avoid accidental reuse after detachment, and define who sends a result or returns ownership later. For small messages, that ceremony is often not worth it.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Structured clone wins for ordinary cross-realm data: worker messages, IndexedDB values, service-worker client messages, BroadcastChannel payloads, and local deep copies where object identity should not cross the boundary. It is especially useful when the data contains cycles or supported built-ins that JSON would distort.',
        'Transfer wins for staged binary and graphics pipelines. A file importer can transfer an input buffer to a worker. An image pipeline can transfer an ImageBitmap or OffscreenCanvas-related resource where supported. MessagePort transfer can hand a private reply channel to another context, turning a broad connection into a narrow endpoint with clear ownership.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Structured clone fails when the real need is behavior, DOM identity, live prototypes, accessors, or shared mutable state. Trying to send a rich class instance with important prototype methods usually means the message contract is wrong. Send plain data plus a type tag, then reconstruct behavior intentionally in the receiver.',
        'It also fails as a performance strategy when code posts giant arrays of object records. Typed buffers, offsets, dictionaries, and a small schema are often better. Transfer fails when both sides expect to keep using the same resource. SharedArrayBuffer is the separate shared-memory tool, and it requires Atomics or another synchronization protocol.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN structured clone algorithm at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm, MDN structuredClone at https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone, MDN Transferable Objects at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects, and the HTML structured-data standard at https://html.spec.whatwg.org/multipage/structured-data.html.',
        'Study Web Workers: A Second Thread first, then OffscreenCanvas Worker Renderer for a concrete transferable rendering resource. SharedArrayBuffer & Atomics Wait/Notify covers the shared-memory alternative. Browser Message Channels & Broadcast Coordination shows how MessagePort transfer becomes a reply pipe. IndexedDB Object Store Case Study, Apache Arrow Columnar Memory Case Study, WebAssembly Linear Memory Case Study, Message Queue, and Backpressure show the same serialization boundary in storage and distributed systems.',
      ],
    },
  ],
};
