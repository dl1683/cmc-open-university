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
        "Read the animation as the execution trace for Web Streams Backpressure Queues. How Web Streams use internal queues, highWaterMark, desiredSize, readers, writers, pipe chains, and backpressure to keep producers honest..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
        {type:"callout", text:"Backpressure makes a stream a feedback loop: data moves toward the sink while overload signals move back toward the source."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Web Streams exist because modern pages rarely receive data as one neat value. Fetch bodies, compression, decoders, file reads, generated media, and UI renderers all move chunks. If every layer buffers everything before handing work to the next layer, latency rises and memory becomes the hidden bottleneck.',
        'The useful constraint is not just "process chunks." It is "process chunks without letting a fast producer drown a slow consumer." That is the problem backpressure solves.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is to append chunks into an array and let downstream code drain it whenever it can. That feels reasonable for small responses, and it is easy to debug because the buffer is just data waiting in order.',
        'The wall arrives when the sink is slower than the source. A queue with no pressure signal is not a pipeline; it is an unbounded memory commitment. The UI can jank, the tab can grow until it is killed, and the producer never learns that its output is no longer useful at that speed.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A stream is a chain of bounded queues with a meter on each queue. The meter is desiredSize: highWaterMark minus the queued size. Positive desiredSize means there is room. Zero or negative desiredSize means the producer should pause or await readiness.',
        'That single number turns a push problem into a feedback loop. Data still moves forward, but overload information moves backward.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "In the pipe-chain view, watch chunks and pressure move in opposite directions. Chunks move from source to transform to sink. Backpressure moves from the slow sink back toward the producer through desiredSize and readiness promises.",
        "In the queue-strategy view, read highWaterMark as a budget and desiredSize as the remaining budget. A positive desiredSize invites more chunks. Zero or negative desiredSize tells the upstream stage to wait.",
        "The important animation state is not simply a queue filling. It is the moment the producer changes behavior because the consumer is behind. That feedback loop is the difference between streaming and unbounded buffering.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A fetch response delivers compressed bytes. A decompression transform expands them, a text decoder turns bytes into strings, a line splitter emits records, and a UI renderer appends visible rows. If the renderer can only handle 500 records per frame, the line splitter cannot keep pushing indefinitely without growing memory. Backpressure gives the renderer a way to slow the upstream chain.',
        'The same pipeline without backpressure looks fine in a demo and fails on real data. The browser downloads quickly, transforms quickly, queues millions of records, and then the UI spends seconds catching up. Streams make the slow stage visible so the whole pipeline can operate at the sustainable rate.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'ReadableStream, TransformStream, and WritableStream each keep internal state: queued chunks, close/error state, and reader or writer locks. A queuing strategy decides how each chunk counts against the high water mark. Count strategies treat each chunk as one unit; byte strategies count bytes; custom strategies assign a weight.',
        'pipeThrough connects a readable side to a transform. pipeTo connects a readable side to a writable side. While piping is active, the stream is locked so two consumers cannot race over the same queue state. On the writable side, writer.ready is the promise-shaped pressure signal.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backpressure works because every queue boundary has a local invariant: do not keep accepting work once queued size reaches the high water mark. If every stage respects its own boundary, pressure can travel upstream until the original source slows down.',
        'The guarantee is not magic throughput. It is bounded behavior. The pipeline can still be slow, fail, or cancel, but it does not need to hide that failure by accumulating arbitrary data in memory.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is bookkeeping and coordination. Each chunk is enqueued, measured, transferred, transformed, and possibly awaited. Small chunks reduce latency but increase per-chunk overhead. Large chunks reduce overhead but make cancellation, UI updates, and memory spikes coarser.',
        'When the consumer slows down, a correct stream trades throughput for memory safety. The important behavior is that the queue reaches a limit and then pushes waiting back toward the source.',
        'Queuing strategy changes the meaning of "full." A count strategy treats every chunk equally, which is fine for similar-sized records. A byte strategy is better when chunk sizes vary widely. A custom size function can model domain cost, such as decoded image memory rather than compressed byte length.',
      ],
    },
    {
      heading: 'Cancellation and errors',
      paragraphs: [
        'Backpressure is only one control signal. Cancellation says downstream no longer needs the data. Error propagation says one stage cannot continue safely. A correct pipeline should close, cancel, or abort upstream work instead of leaving fetches, readers, or transforms alive after the user navigates away.',
        'AbortController often belongs beside Streams. If a search result stream is no longer relevant because the query changed, the app should cancel the reader and abort the underlying request. Otherwise the stream may be memory-safe but still waste network and CPU on useless data.',
      ],
    },
    {
      heading: 'Design guidance',
      paragraphs: [
        'Choose chunk boundaries that match the work. Bytes are natural for network and file IO. Lines are natural for logs and JSONL. Domain records are natural once parsing is complete. Do not force every stage to understand every other stage; transforms should narrow the data shape as it moves through the chain.',
        'Keep UI work batched. A stream that appends one DOM node per chunk can still jank even when memory is bounded. For visible interfaces, collect a small batch, render on an animation frame, then let backpressure decide when more chunks should arrive.',
        'Use Workers when parsing or compression is heavy. Streams protect memory, but they do not make CPU work disappear. A clean pipeline often combines streams, transferables, workers, and cancellation into one control surface the developer can reason about.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Streams work well for fetch bodies, large files, media pipelines, compression, logs, JSON-lines feeds, and UI lists where the user can start seeing useful data before the whole response arrives.',
        'The fit is strongest when the application can process records incrementally and when upstream work can actually pause, cancel, or slow down.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Streams do not help if the application immediately buffers the whole output, ignores writer.ready, or converts every chunk into a synchronous DOM update. They also do not remove the need for protocol-level flow control; HTTP, TCP, and the source itself still matter.',
        'tee is a common trap. The slow branch can keep pressure alive even if the fast branch is draining quickly. A branch that is no longer needed should be canceled.',
        'They also fail as a teaching tool when examples hide the slow consumer. Real pipelines should show the sink, the queue budget, and the cancellation path; otherwise the reader learns syntax without learning the control problem.',
      ],
    },
    {
      heading: 'Worked example (2)',
      paragraphs: [
        'A log viewer loads a 2 GB server log. The fetch response produces bytes, TextDecoderStream produces text, a line splitter emits complete lines, a parser emits records, and the UI batches records into animation-frame updates. If rendering falls behind, desiredSize drops and pressure moves back toward fetch instead of building a 2 GB array.',
        'This is the same lesson as Backpressure & Flow Control and Message Queue: bounded queues are not an implementation detail. They are the control surface that keeps producers from outrunning consumers.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: MDN Streams concepts at https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts, Streams Standard at https://streams.spec.whatwg.org/, and web.dev Streams guide at https://web.dev/articles/streams. Study Backpressure & Flow Control, Queue, Ring Buffer, Message Queue, Web Workers, Structured Clone & Transferables, AbortController Cancellation Graph, and Browser Message Channels & Broadcast Coordination next.',
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Web Streams Backpressure Queues moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};

