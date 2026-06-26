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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a data boundary between JavaScript realms. A realm is an execution environment such as a window, worker, or iframe. Structured clone is the browser algorithm that serializes supported JavaScript values across that boundary, and a transferable is an object whose ownership can move instead of being copied.',
        'Active nodes show the value or buffer currently crossing the boundary. Removed nodes show ownership loss after transfer, usually a detached ArrayBuffer at the sender. The safe inference is that clone preserves an independent value, while transfer preserves bytes by moving who owns them.',
        {type:'callout', text:'Structured clone makes realm crossing a data contract, while transferables move ownership when copying bytes would waste time or memory.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Web workers let JavaScript move CPU work off the main thread. That only helps if the main thread and worker can exchange data without sharing unsafe object graphs. The platform needs a way to send maps, arrays, typed arrays, blobs, and other supported values across realms.',
        'Structured clone exists for that boundary. It creates a deep copy of supported data while preserving graph shape where allowed. Transferables exist for large binary ownership moves, where copying the bytes would erase much of the worker benefit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is JSON. Convert the value to a string, post it, and parse it on the other side. That works for small plain objects with strings, numbers, booleans, arrays, and null.',
        'JSON fails for richer values and large binary data. It loses Map, Set, Date, RegExp details, typed arrays, cycles, undefined, and object identity relationships. For a 100 MB ArrayBuffer, JSON is not just awkward; it can be impossible or much slower than the computation the worker was supposed to save.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that JavaScript objects can contain references, cycles, prototypes, host objects, and backing stores. A naive recursive copy can loop forever, duplicate shared references incorrectly, or expose mutable state across threads. A boundary crossing needs precise rules.',
        'Binary buffers add a second wall. Copying a buffer preserves sender ownership but costs memory bandwidth and temporary memory. Sharing it unsafely would create races. Transfer solves a narrower problem by making ownership single again after the move.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate value cloning from ownership transfer. Structured clone walks the supported object graph, records already-seen objects to preserve cycles and repeated references, and creates an equivalent graph in the target realm. Transfer detaches selected source objects and attaches their backing resources to the receiver.',
        'The invariant is that after the operation, each reachable cloned value in the receiver is independent from the sender, except for explicitly shared types such as SharedArrayBuffer. For transferables, the sender no longer owns the moved resource, so there is no hidden double-writer problem.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When postMessage or structuredClone runs, the algorithm checks whether each value is supported. Plain objects, arrays, maps, sets, dates, blobs, typed arrays, ArrayBuffers, and many platform objects have defined behavior. Functions, DOM nodes, and unsupported host objects fail with a DataCloneError.',
        'If a transfer list is provided, the algorithm validates that each listed object is transferable and reachable as required. An ArrayBuffer in the transfer list has its bytes moved to the receiver and becomes detached at the sender. Typed arrays that viewed that buffer now see a detached backing store.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Clone correctness comes from the visited-map invariant. When the algorithm first sees an object, it creates the corresponding target object and records the mapping. If the same source object appears again, the algorithm reuses the same target object instead of copying it twice.',
        'Transfer correctness comes from exclusive ownership. The moved resource has one live owner after the operation. Since the sender buffer is detached, sender code cannot mutate bytes that the receiver believes it owns. That is why transfer is faster without becoming implicit shared memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Structured clone is O(size of the reachable supported graph) in time and memory. If a 50 MB typed array is cloned, the browser must allocate and copy about 50 MB of backing data. Doubling the buffer size roughly doubles copy time and temporary memory pressure.',
        'Transfer is O(1) for the backing bytes in the useful mental model, though validation and bookkeeping still cost something. The complexity cost is lifecycle management: sender code must not expect the buffer to remain usable after transfer, and APIs must document who owns the data after each message.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Structured clone is used by postMessage, Web Workers, IndexedDB, BroadcastChannel, history state, and structuredClone. It fits messages that are data, not behavior, and it keeps main-thread code isolated from worker internals.',
        'Transferables fit image processing, audio buffers, WebAssembly input and output, file chunks, and ML preprocessing. The access pattern is producer hands off a large buffer to consumer, then stops using it. That is different from shared-memory coordination, which needs SharedArrayBuffer and Atomics.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when developers expect all JavaScript values to cross. Functions, closures, DOM nodes, WeakMaps, and many host resources cannot be cloned because their meaning depends on a realm, identity, or hidden capability. The boundary is data-oriented by design.',
        'It also fails when ownership is unclear. Accidentally transferring a buffer that the sender still needs causes detached-buffer bugs. Accidentally cloning a huge buffer can freeze a thread or double memory use. The choice must be part of the API contract.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the main thread captures a 1920 by 1080 RGBA frame in an ArrayBuffer. That is 1920 * 1080 * 4 = 8,294,400 bytes, about 7.9 MiB. Cloning 60 frames per second would copy about 474 MiB per second before the worker performs any image analysis.',
        'If the buffer is transferred to a worker, the receiver gets the same backing bytes and the sender buffer is detached. The main thread must allocate or receive a new buffer for the next frame. The cost changes from repeated byte copying to explicit buffer ownership rotation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with MDN structured clone algorithm at https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm. Then read MDN structuredClone at https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone and the HTML Standard structured-data section at https://html.spec.whatwg.org/multipage/structured-data.html.',
        'Study Web Workers Message Passing for realm boundaries and SharedArrayBuffer and Atomics for shared memory. Then use Transferable Streams, IndexedDB, and Ownership Types to separate copied data, moved resources, and shared state.',
      ],
    },
  ],
};
