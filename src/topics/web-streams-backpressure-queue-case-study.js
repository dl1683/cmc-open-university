// Web Streams: internal queues, high-water marks, desiredSize, pipe chains,
// readable/writable locking, and backpressure propagation.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'web-streams-backpressure-queue-case-study',
  title: 'Web Streams Backpressure Queues',
  category: 'Systems',
  summary: 'How Web Streams use internal queues, highWaterMark, desiredSize, readers, writers, pipe chains, and backpressure to keep producers honest.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['pipe chain', 'queue strategy'], defaultValue: 'pipe chain' },
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

function streamGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'source', label: 'source', x: 0.7, y: 4.0, note: notes.source ?? 'chunks' },
      { id: 'readQ', label: 'readQ', x: 2.4, y: 4.0, note: notes.readQ ?? 'internal' },
      { id: 'transform', label: 'xform', x: 4.2, y: 4.0, note: notes.transform ?? 'decode' },
      { id: 'writeQ', label: 'writeQ', x: 6.0, y: 4.0, note: notes.writeQ ?? 'internal' },
      { id: 'sink', label: 'sink', x: 7.8, y: 4.0, note: notes.sink ?? 'consumer' },
      { id: 'pressure', label: 'pressure', x: 4.2, y: 2.1, note: notes.pressure ?? 'backward' },
      { id: 'lock', label: 'lock', x: 4.2, y: 6.0, note: notes.lock ?? 'reader/writer' },
    ],
    edges: [
      { id: 'e-source-readQ', from: 'source', to: 'readQ', weight: '' },
      { id: 'e-readQ-transform', from: 'readQ', to: 'transform', weight: '' },
      { id: 'e-transform-writeQ', from: 'transform', to: 'writeQ', weight: '' },
      { id: 'e-writeQ-sink', from: 'writeQ', to: 'sink', weight: '' },
      { id: 'e-sink-pressure', from: 'sink', to: 'pressure', weight: '' },
      { id: 'e-pressure-transform', from: 'pressure', to: 'transform', weight: '' },
      { id: 'e-pressure-source', from: 'pressure', to: 'source', weight: '' },
      { id: 'e-transform-lock', from: 'transform', to: 'lock', weight: '' },
    ],
  }, { title });
}

function* pipeChain() {
  yield {
    state: streamGraph('A pipe chain moves chunks toward a sink'),
    highlight: { active: ['source', 'readQ', 'transform', 'writeQ', 'sink', 'e-source-readQ', 'e-readQ-transform', 'e-transform-writeQ', 'e-writeQ-sink'] },
    explanation: 'ReadableStream, TransformStream, and WritableStream form pipe chains. The original source produces chunks, transforms modify chunks, and the ultimate sink consumes them.',
    invariant: 'A stream pipeline is a bounded queue chain, not an infinite hose.',
  };

  yield {
    state: streamGraph('A slow sink sends pressure backward', { sink: 'busy', writeQ: 'filling', pressure: 'slow down', source: 'pause' }),
    highlight: { active: ['sink', 'writeQ', 'pressure', 'source', 'e-sink-pressure', 'e-pressure-transform', 'e-pressure-source'], compare: ['readQ'] },
    explanation: 'Backpressure is the feedback signal that says downstream is not ready for more chunks. A correct source slows production instead of hiding overload in unbounded buffers.',
  };

  yield {
    state: labelMatrix(
      'Pipe operations',
      [
        { id: 'pipeTo', label: 'pipeTo' },
        { id: 'pipeThru', label: 'pipeThrough' },
        { id: 'tee', label: 'tee' },
        { id: 'cancel', label: 'cancel' },
      ],
      [
        { id: 'connects', label: 'connects' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['read->write', 'locks'],
        ['via xform', 'errors'],
        ['2 branches', 'slow branch'],
        ['source stop', 'lost work'],
      ],
    ),
    highlight: { found: ['pipeTo:connects', 'pipeThru:connects'], compare: ['tee:risk'] },
    explanation: 'Piping locks streams while the pipe is active. tee creates two readable branches, and the original source sees combined backpressure from those branches.',
  };

  yield {
    state: streamGraph('Readers and writers lock streams while in use', { lock: 'exclusive', readQ: 'reader', writeQ: 'writer' }),
    highlight: { active: ['readQ', 'writeQ', 'lock', 'e-transform-lock'], compare: ['source', 'sink'] },
    explanation: 'A reader or writer is an exclusive handle. Locking prevents competing consumers from simultaneously pulling chunks from the same stream state.',
  };

  yield {
    state: labelMatrix(
      'Pipeline design',
      [
        { id: 'bytes', label: 'bytes' },
        { id: 'text', label: 'text' },
        { id: 'json', label: 'JSON lines' },
        { id: 'ui', label: 'UI list' },
      ],
      [
        { id: 'stage', label: 'stage' },
        { id: 'control', label: 'control' },
      ],
      [
        ['source', 'pull'],
        ['decode', 'pipeThrough'],
        ['parse', 'bounded'],
        ['render', 'batch'],
      ],
    ),
    highlight: { found: ['bytes:control', 'json:control', 'ui:control'] },
    explanation: 'A production streaming UI often fetches bytes, decodes text, parses records, and batches DOM updates. Backpressure should reach the fetch or source, not stop at a giant in-memory array.',
  };
}

function* queueStrategy() {
  yield {
    state: labelMatrix(
      'desiredSize formula',
      [
        { id: 'hwm', label: 'HWM' },
        { id: 'queued', label: 'queued' },
        { id: 'desired', label: 'desired' },
        { id: 'pressure', label: 'pressure' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['target cap', 'limit'],
        ['sum sizes', 'load'],
        ['HWM-load', 'room left'],
        ['<= 0', 'slow source'],
      ],
    ),
    highlight: { active: ['desired:value', 'pressure:value'], found: ['hwm:meaning'] },
    explanation: 'The Streams Standard defines desired size as high water mark minus queued chunk size. When desiredSize reaches zero or below, the stream is applying backpressure.',
    invariant: 'desiredSize is the queue meter producers should respect.',
  };

  yield {
    state: streamGraph('A readable controller exposes desiredSize', { readQ: '3 chunks', pressure: 'desired 0', source: 'stop pull' }),
    highlight: { active: ['readQ', 'pressure', 'source', 'e-pressure-source'], compare: ['sink'] },
    explanation: 'An underlying source can inspect controller.desiredSize. If the consumer is behind, the source can stop enqueuing until pull is called again.',
  };

  yield {
    state: labelMatrix(
      'Queuing strategy',
      [
        { id: 'count', label: 'count' },
        { id: 'byte', label: 'byte' },
        { id: 'custom', label: 'custom' },
        { id: 'none', label: 'ignored' },
      ],
      [
        { id: 'size', label: 'size' },
        { id: 'bestFor', label: 'best for' },
      ],
      [
        ['1/chunk', 'records'],
        ['bytes', 'binary'],
        ['size()', 'weighted'],
        ['unbounded', 'risk'],
      ],
    ),
    highlight: { found: ['count:bestFor', 'byte:bestFor', 'custom:bestFor'], removed: ['none:size'] },
    explanation: 'The strategy decides how chunks count against the high water mark: count chunks, count bytes, or compute a custom weight.',
  };

  yield {
    state: streamGraph('writer.ready is the writable-side pressure signal', { writeQ: 'full', pressure: 'ready later', source: 'await' }),
    highlight: { active: ['writeQ', 'pressure', 'source', 'e-sink-pressure', 'e-pressure-source'], found: ['sink'] },
    explanation: 'On the writable side, producers should pay attention to ready/desiredSize instead of writing forever. Ignoring the signal turns a stream into an ordinary memory leak.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'buffer', label: 'buffer all' },
        { id: 'ignore', label: 'ignore HWM' },
        { id: 'tee', label: 'tee slow' },
        { id: 'dom', label: 'DOM chunk' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['memory spike', 'stream'],
        ['queue grows', 'await ready'],
        ['branch stalls', 'cancel/read'],
        ['jank', 'batch frame'],
      ],
    ),
    highlight: { removed: ['buffer:symptom', 'ignore:symptom'], found: ['ignore:fix', 'dom:fix'] },
    explanation: 'Streaming only helps when the application honors the flow-control signals. Otherwise chunks just accumulate in a different place.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'pipe chain') yield* pipeChain();
  else if (view === 'queue strategy') yield* queueStrategy();
  else throw new InputError('Pick a Web Streams view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the pipe chain as data and pressure moving in opposite directions. Chunks move from source to transform to sink. Backpressure moves from the slow sink back toward the producer through queue size, desiredSize, and readiness promises.',
        'The safe inference is about behavior, not color. If desiredSize is positive, the next stage has queue budget. If desiredSize is zero or negative, a correct producer should pause, wait, or stop pulling more data until downstream catches up.',
        {type:"callout", text:"Backpressure makes a stream a feedback loop: data moves toward the sink while overload signals move back toward the source."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern pages rarely receive one neat value. Fetch bodies, compression, decoders, files, generated media, and UI renderers move chunks. A chunk is one piece of data in a stream, such as a byte buffer, text fragment, or decoded record.',
        'The constraint is not only process chunks. The constraint is process chunks without letting a fast producer bury a slow consumer in memory. Backpressure is the feedback signal that tells upstream code to slow down before the queue becomes an unbounded buffer.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is an array queue. Push chunks into an array as they arrive, and let downstream code shift or read them whenever it can. This is reasonable for small files and demos because the buffer is visible and ordered.',
        'It also feels safe because no data is dropped. The producer can run at network speed, and the consumer can catch up later. That assumption breaks as soon as later becomes thousands or millions of chunks.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that an unbounded queue is an unbounded memory promise. If a source produces 20 MB/s and a UI sink renders 5 MB/s, the queue grows by 15 MB every second. After 60 seconds, the tab is carrying about 900 MB of backlog.',
        'The failure is not only memory. Latency grows too, because the newest useful data sits behind old queued data. Cancellation becomes coarse, the UI can jank, and the producer never learns that its current rate is not useful.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A stream is a chain of bounded queues with a meter on each queue. The meter is desiredSize, which is highWaterMark minus queued size. highWaterMark is the queue budget chosen by the queuing strategy.',
        'That one number changes the system from blind pushing to feedback control. Data still moves forward, but overload information moves backward. A stream is correct only if each stage respects its local queue boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ReadableStream, TransformStream, and WritableStream each keep internal state: queued chunks, close or error state, and reader or writer locks. A queuing strategy decides how each chunk counts. Count strategies treat each chunk as one unit, byte strategies count bytes, and custom strategies can model domain cost.',
        'pipeThrough connects a readable side to a transform, and pipeTo connects a readable side to a writable sink. While a stream is locked to a reader or writer, another consumer cannot race over the same queue. On the writable side, writer.ready is the promise-shaped signal that waits until more data can be accepted.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is local-to-global. Each boundary enforces the rule that queued size should not keep growing past the high water mark. If every stage follows that rule, pressure can propagate to the original source.',
        'This does not guarantee high throughput. It guarantees bounded behavior under a slow consumer. The pipeline may still be slow, fail, or cancel, but it does not hide the problem by accumulating arbitrary data in memory.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Backpressure costs bookkeeping and coordination. Each chunk is enqueued, measured, transferred, transformed, and sometimes awaited. Small chunks reduce latency but increase per-chunk overhead. Large chunks reduce overhead but make cancellation and UI updates coarser.',
        'Numbers make the behavior clear. With a highWaterMark of 16 chunks and 64 KB chunks, one queue tries to stay near 1 MB. If a three-stage pipeline has three such queues, the intended queued data is about 3 MB, not the full 2 GB file being streamed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Streams fit fetch bodies, large files, compression, logs, JSON-lines feeds, media transforms, and UI lists where the user can see partial output before the whole response arrives. The access pattern is incremental processing with a source that can pause, pull, or cancel.',
        'They also fit service workers and edge-style transforms. A response can be decoded, filtered, compressed, cached, or forwarded without materializing the whole body. The win comes from bounded memory and early work, not from avoiding all overhead.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Streams fail when the application immediately buffers the whole output, ignores writer.ready, or performs synchronous DOM work for every chunk. A memory-safe stream can still produce a janky page if each chunk creates layout work. Batch visible updates on animation frames.',
        'tee is another trap. Splitting a stream creates two branches, and a slow branch can keep pressure alive while the fast branch drains. Cancel branches that are no longer needed, and treat cancellation as part of the design.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A log viewer loads a 2 GB server log. Fetch produces 64 KB byte chunks, TextDecoderStream turns them into text, a line splitter emits records, and the UI renders batches of 500 records per frame. Without backpressure, a fast network can queue millions of lines while the UI catches up.',
        'Set the byte queue budget to 1 MB and the record queue budget to 2,000 lines. If rendering falls behind, desiredSize drops to zero, writer.ready stops resolving quickly, and pressure moves upstream. The viewer may take the same total time to process the file, but it avoids turning the whole log into hidden tab memory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Streams API concepts at https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts, the WHATWG Streams Standard at https://streams.spec.whatwg.org/, and the web.dev Streams guide at https://web.dev/articles/streams.',
        'Study next by role: Queue for FIFO ordering, Ring Buffer for bounded storage, Backpressure and Flow Control for the general systems pattern, AbortController Cancellation for stopping stale work, and Web Workers for moving expensive parsing off the main thread.',
      ],
    },
  ],
};

