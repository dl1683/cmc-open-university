// gRPC over HTTP/2: protobuf service contracts, streams, metadata, flow
// control windows, deadlines, status trailers, and backpressure.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'grpc-http2-stream-multiplexing-case-study',
  title: 'gRPC HTTP/2 Stream Multiplexing Case Study',
  category: 'Systems',
  summary: 'A gRPC systems primer: protobuf service definitions, generated stubs, HTTP/2 streams, metadata, flow-control windows, deadlines, and status trailers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rpc stream', 'flow control'], defaultValue: 'rpc stream' },
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

function grpcGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'proto', label: 'proto', x: 0.7, y: 3.9, note: notes.proto ?? 'service' },
      { id: 'stub', label: 'stub', x: 2.15, y: 2.2, note: notes.stub ?? 'client' },
      { id: 'chan', label: 'chan', x: 2.15, y: 5.45, note: notes.chan ?? 'conn pool' },
      { id: 'h2', label: 'HTTP/2', x: 4.1, y: 3.9, note: notes.h2 ?? 'frames' },
      { id: 'stream', label: 'stream', x: 5.85, y: 2.2, note: notes.stream ?? 'id' },
      { id: 'server', label: 'server', x: 5.85, y: 5.45, note: notes.server ?? 'dispatch' },
      { id: 'handler', label: 'handle', x: 7.75, y: 3.9, note: notes.handler ?? 'method' },
      { id: 'status', label: 'status', x: 9.25, y: 3.9, note: notes.status ?? 'trailers' },
    ],
    edges: [
      { id: 'e-proto-stub', from: 'proto', to: 'stub', weight: '' },
      { id: 'e-stub-chan', from: 'stub', to: 'chan', weight: '' },
      { id: 'e-chan-h2', from: 'chan', to: 'h2', weight: '' },
      { id: 'e-h2-stream', from: 'h2', to: 'stream', weight: '' },
      { id: 'e-h2-server', from: 'h2', to: 'server', weight: '' },
      { id: 'e-stream-handler', from: 'stream', to: 'handler', weight: '' },
      { id: 'e-server-handler', from: 'server', to: 'handler', weight: '' },
      { id: 'e-handler-status', from: 'handler', to: 'status', weight: '' },
    ],
  }, { title });
}

function* rpcStream() {
  yield {
    state: grpcGraph('A gRPC call starts from a protobuf service contract'),
    highlight: { active: ['proto', 'stub', 'chan', 'e-proto-stub', 'e-stub-chan'], compare: ['h2', 'stream'] },
    explanation: 'gRPC begins with a service definition. Generated stubs turn method calls into serialized protobuf messages, metadata, deadlines, and HTTP/2 streams. The client calls a local API; the transport carries framed messages.',
    invariant: 'The service contract is explicit even when the transport is long lived.',
  };

  yield {
    state: labelMatrix(
      'RPC',
      [
        { id: 'unary', label: 'unary' },
        { id: 'server', label: 'srv str' },
        { id: 'client', label: 'cli str' },
        { id: 'bidi', label: 'bidi' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['1 -> 1', 'lookup'],
        ['1 -> N', 'feed'],
        ['N -> 1', 'upload'],
        ['N -> N', 'chat'],
      ],
    ),
    highlight: { active: ['unary:shape', 'server:shape', 'client:shape', 'bidi:shape'], found: ['bidi:fit'] },
    explanation: 'gRPC has four interaction shapes: unary, server streaming, client streaming, and bidirectional streaming. Each shape has different buffering, cancellation, and backpressure behavior.',
  };

  yield {
    state: grpcGraph('HTTP/2 lets many RPC streams share one connection', { h2: 'mux', stream: 'stream id', chan: 'channel', server: 'method tbl', status: 'trail' }),
    highlight: { active: ['chan', 'h2', 'stream', 'server', 'handler', 'status', 'e-chan-h2', 'e-h2-stream', 'e-h2-server', 'e-handler-status'], compare: ['proto'] },
    explanation: 'The channel is shared transport; the stream is per-call state. HTTP/2 multiplexing lets many RPCs share one connection while each stream keeps its own metadata, messages, END_STREAM markers, deadlines, and status trailers.',
  };

  yield {
    state: labelMatrix(
      'Code',
      [
        { id: 'ok', label: 'OK' },
        { id: 'deadline', label: 'DEAD' },
        { id: 'cancel', label: 'CANC' },
        { id: 'unavail', label: 'UNAV' },
        { id: 'internal', label: 'INT' },
      ],
      [
        { id: 'sent', label: 'sent' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['trail', 'done'],
        ['trail', 'cap'],
        ['trail', 'stop'],
        ['trail', 'retry'],
        ['trail', 'bug'],
      ],
    ),
    highlight: { active: ['ok:sent', 'deadline:lesson', 'cancel:lesson'], compare: ['unavail:lesson', 'internal:lesson'] },
    explanation: 'gRPC status is carried at the end of the call, normally in trailers. Deadlines and cancellation are not just client hints; they should stop server work and free stream, queue, and memory resources.',
  };
}

function* flowControl() {
  yield {
    state: grpcGraph('Flow control prevents one fast side from flooding another', { h2: 'windows', stream: 'credit', handler: 'read loop', status: 'close' }),
    highlight: { active: ['h2', 'stream', 'handler', 'e-h2-stream', 'e-stream-handler'], compare: ['stub', 'server'] },
    explanation: 'Read windows as credit counters. Receivers grant more credit only as the application consumes data; senders must stop when credit runs out. That is how the protocol pushes back instead of turning slow consumers into unbounded memory growth.',
    invariant: 'A stream is live state: bytes, windows, deadlines, cancellation, and handler work all have to agree.',
  };

  yield {
    state: labelMatrix(
      'Flow',
      [
        { id: 'conn', label: 'conn' },
        { id: 'stream', label: 'stream' },
        { id: 'recv', label: 'recv' },
        { id: 'send', label: 'send' },
        { id: 'dead', label: 'dead' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['shared win', 'head block'],
        ['per win', 'stall'],
        ['grant', 'slow app'],
        ['queue', 'OOM'],
        ['timer', 'zombie'],
      ],
    ),
    highlight: { active: ['conn:state', 'stream:state', 'recv:state'], compare: ['send:risk', 'dead:risk'] },
    explanation: 'The data structures are counters and queues: connection window, per-stream window, inbound message queue, outbound queue, deadline timer, and cancellation handle. Bugs show up as stalls, memory growth, or work that continues after the caller left.',
  };

  yield {
    state: grpcGraph('A slow consumer should push pressure back through the stream', { stub: 'producer', chan: 'queue', h2: 'no credit', stream: 'pause', server: 'reader', handler: 'consume', status: 'finish' }),
    highlight: { active: ['stub', 'chan', 'h2', 'stream', 'server', 'handler', 'e-stub-chan', 'e-chan-h2', 'e-h2-stream', 'e-stream-handler'], found: ['status'] },
    explanation: 'In a bidirectional stream, a slow handler should reduce reads, stop granting window credit, and eventually slow the sender. If the application ignores flow control and buffers everything, the protocol cannot save memory.',
  };

  yield {
    state: labelMatrix(
      'Case',
      [
        { id: 'logs', label: 'logs' },
        { id: 'infer', label: 'infer' },
        { id: 'sync', label: 'sync' },
        { id: 'mesh', label: 'mesh' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['cli', 'cap'],
        ['srv', 'dead'],
        ['bidi', 'window'],
        ['1-1', 'retry'],
      ],
    ),
    highlight: { active: ['logs:guard', 'infer:guard', 'sync:guard', 'mesh:guard'], compare: ['sync:shape'] },
    explanation: 'Complete case study: a telemetry uploader uses client streaming. The client sends many compressed log batches, the server reads with flow-control credit, validates tenant quotas, writes to a queue, and returns a final status. Deadline, max message size, and retry policy prevent a retry storm.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rpc stream') yield* rpcStream();
  else if (view === 'flow control') yield* flowControl();
  else throw new InputError('Pick a gRPC view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each moving request as an RPC, or remote procedure call: one program asks another program to run a named method. The visual separates the generated client stub, the HTTP/2 connection, the per-call stream, the server handler, and the final status so you can see which layer owns each decision.',
        'Active streams are calls that still have frames, messages, deadlines, or flow-control credit in play. A safe inference is that one TCP connection can carry many logical calls, but each stream keeps its own order, metadata, message sequence, and final status.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'gRPC exists because service-to-service calls need more structure than ad hoc JSON over HTTP. A large system wants typed method contracts, generated clients, streaming calls, deadlines, cancellation, metadata, status codes, and backpressure to behave the same way across languages.',
        'HTTP/2 is the transport reason this works well. It splits one connection into numbered streams, then sends headers and data as frames so several calls can share the same socket without opening a new TCP connection for each request.',
        {type:'callout', text:'gRPC is a stream lifecycle discipline: contracts, frames, windows, deadlines, cancellation, and status must remain consistent across one shared transport.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to expose REST endpoints and let every client hand-write request and response code. That is reasonable for many public APIs because plain HTTP and JSON are easy to inspect, cache, proxy, and debug.',
        'A second simple approach is to treat a long interaction as a raw socket. The application writes bytes when it wants and reads bytes when they arrive, with custom rules for message boundaries, retries, timeouts, and errors.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is contract drift and uncontrolled queues. If every team writes its own client shape, then field meanings, retry rules, status handling, and timeout behavior drift until failures become hard to reproduce.',
        'Streaming adds another wall: a fast sender can overwhelm a slow receiver. If the runtime reads from the network into an unbounded application queue, protocol flow control has already lost, because memory becomes the real buffer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that each call is a stream with explicit lifecycle state. The runtime tracks method name, request metadata, serialized protobuf messages, per-stream window, connection window, deadline, cancellation handle, inbound queue, outbound queue, and final status.',
        'HTTP/2 multiplexing separates connection sharing from call identity. Frames from many streams can interleave on one connection, while each stream preserves the order of its own messages and trailers.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A proto file defines service methods and message fields. Code generation creates a client stub and a server interface, so the caller sees a method call while the runtime serializes protobuf messages and writes HTTP/2 frames.',
        'A unary RPC sends one request message and receives one response message. Server streaming sends one request and many responses, client streaming sends many requests and one response, and bidirectional streaming lets both sides send ordered message sequences until the call ends.',
        'Flow control is credit accounting. The receiver grants byte credit as it consumes data, and the sender must stop when stream or connection credit reaches zero.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Typed contracts work because the client and server agree on method and message shape before runtime. Generated code reduces manual drift, and protobuf field rules let old and new clients coexist when fields are added carefully.',
        'Multiplexing works because the connection scheduler does not erase stream identity. A slow stream can run out of credit without changing the order or status of another stream, although TCP-level loss can still affect the whole connection below HTTP/2.',
        'Deadlines and cancellation work only when they propagate through the full call graph. A client deadline should become a server timer, a queue admission limit, a downstream RPC deadline, and a cleanup trigger.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is not just CPU for serialization. Teams pay for proto design, compatibility review, generated-code pipelines, gateway behavior, load-balancer support, observability, and runtime-specific debugging.',
        'For behavior, consider 100 concurrent unary calls. Opening 100 separate TLS connections repeats handshakes, socket buffers, congestion windows, and load-balancer state; multiplexing can keep those calls on one warm connection while preserving 100 stream ids.',
        'The dominant cost changes with payload size. For tiny control-plane calls, header compression, connection reuse, and generated code matter; for large streaming uploads, flow-control windows, receiver memory, and backpressure dominate.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'gRPC fits internal service meshes, typed control planes, model-serving APIs, telemetry uploaders, database gateways, watch APIs, and streaming inference. The common pattern is a closed ecosystem where typed contracts and deadlines are worth more than casual browser inspection.',
        'It is especially useful when one request/one response is too narrow. A fleet agent can stream batches, a watch API can stream changes, and an inference service can stream partial outputs while still returning one final status.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'gRPC is a poor default when the audience is browsers, partners, or humans using command-line tools. JSON over HTTP may be easier to inspect, cache, document, and debug when streaming and generated clients are not central requirements.',
        'Retries can make outages worse. A retryable status is safe only with a deadline, idempotency, backoff, jitter, and a budget, because otherwise clients add traffic while the service is already failing.',
        'It also fails when final status is ignored. Receiving bytes is not the same as success; the call is complete only when the stream closes with an OK status or a precise error such as CANCELLED, DEADLINE_EXCEEDED, UNAVAILABLE, or INTERNAL.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a telemetry agent has one HTTP/2 connection with a 65,535-byte stream window and sends 4 KB protobuf batches. The receiver consumes 32 KB and sends WINDOW_UPDATE, so the sender earns eight more 4 KB messages of credit without opening another connection.',
        'Now place three calls on the connection: stream 1 uploads logs, stream 3 checks configuration, and stream 5 sends metrics. If stream 1 stalls because the server is slow to read logs, stream 3 can still finish its small response as long as connection-level credit and scheduler fairness remain available.',
        'The correctness rule is local to each stream. Frames may interleave as 1, 3, 1, 5, 1, but messages for stream 1 still arrive in stream-1 order, and the final status for stream 1 does not complete stream 3 or stream 5.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the gRPC core concepts guide, the gRPC introduction, the gRPC over HTTP/2 protocol notes, the Protocol Buffers language guide, and RFC 9113 for HTTP/2. Read them to separate the RPC model from the transport details.',
        'Study Protobuf Wire Format for payload encoding, HPACK Dynamic Table HTTP/2 for header compression, HTTP/3 QUIC Stream Multiplexing for the next transport layer, Backpressure for pressure propagation, and Distributed Tracing for visibility across RPC chains.',
      ],
    },
  ],
};
