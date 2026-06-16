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
      heading: 'What it is',
      paragraphs: [
        'Web Streams are the browser platform abstraction for chunked data. ReadableStream represents a source, WritableStream represents a sink, and TransformStream connects the two. The data-structure core is an internal queue plus a queuing strategy.',
        'Backpressure is the reason streams are not just callbacks. When the downstream queue fills, the pressure signal moves backward through the chain so the source can slow down.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each readable or writable stream maintains an internal queue. A queuing strategy assigns a size to each chunk and compares total queued size against a highWaterMark. The difference is desiredSize. If desiredSize is zero or negative, the stream is telling the producer to stop or slow down.',
        'pipeThrough connects a readable to a transform. pipeTo connects a readable to a writable. Piping locks the streams while the operation is active, which prevents competing readers or writers from corrupting the stream state.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a log viewer loading a 2 GB server log. A fetch response body produces bytes. TextDecoderStream turns bytes into text. A line splitter emits complete lines. A parser emits records. The UI batches records into animation-frame updates. If the UI falls behind, desiredSize drops and pressure travels back toward the source instead of building a 2 GB array in memory.',
        'The same lesson appears in Backpressure & Flow Control and Message Queue: bounded queues are not an implementation detail. They are the control surface that keeps producers from outrunning consumers.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not read an entire response into memory and call it streaming. Do not ignore writer.ready or controller.desiredSize. Do not tee a stream and forget that the slow branch matters. Do not update the DOM once per chunk if chunks arrive faster than frames.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Streams concepts at https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts, Streams Standard at https://streams.spec.whatwg.org/, and web.dev Streams guide at https://web.dev/articles/streams. Study Backpressure & Flow Control, Queue, Ring Buffer, Message Queue, Web Workers, Structured Clone & Transferables, AbortController Cancellation Graph, and Browser Message Channels & Broadcast Coordination next.',
      ],
    },
  ],
};
