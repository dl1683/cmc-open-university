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
      heading: 'Why this exists',
      paragraphs: [
        'gRPC exists because distributed systems need something more disciplined than hand-written HTTP calls with loosely shaped JSON. Services need typed contracts, generated clients, streaming, deadlines, cancellation, status codes, metadata, load balancing, tracing, and backpressure.',
        'HTTP/2 matters because it lets many logical streams share one connection. A client can run many calls without opening a new TCP connection for each one, and a single call can carry a sequence of messages instead of just one request and one response.',
        'The case study is useful because gRPC is not just an interface definition. It is a live state machine: channels, streams, protobuf frames, flow-control windows, deadlines, cancellation handles, application queues, and final status trailers all have to agree.',
        {type:'callout', text:'gRPC is a stream lifecycle discipline: contracts, frames, windows, deadlines, cancellation, and status must remain consistent across one shared transport.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to expose REST endpoints and let every client hand-write request and response code. That works for many public APIs, but internal service meshes often need stricter contracts, streaming methods, and generated code across several languages.',
        'Another shortcut is to treat a stream as a socket and buffer freely until the application catches up. That defeats HTTP/2 flow control. A slow consumer should push pressure back through the stream, not convert protocol credit into unbounded process memory.',
        'A third mistake is to ignore deadlines and cancellation. If the caller has gone away, server work should stop. Otherwise failed calls leave zombie work in queues, CPU pools, database transactions, and model-serving batches.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is that every call is a stream with explicit lifecycle state. A generated stub hides the transport, but the runtime still tracks method, metadata, serialized protobuf messages, per-stream window, connection window, deadline, cancellation, compression, inbound queue, outbound queue, and final status.',
        'HTTP/2 multiplexing separates logical stream order from connection order. Frames from different streams can share one connection, while each stream preserves its own message sequence. That gives efficient connection reuse without erasing per-call state.',
        'Flow control is credit accounting. Receivers grant credit as they consume bytes. Senders must stop when credit runs out. This is the bridge between protocol mechanics and application backpressure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A proto file defines services and messages. Code generation creates a client stub and server interface. The client stub serializes protobuf messages, attaches metadata, sends them over a channel, and receives messages or final status from the server.',
        'At the transport layer, gRPC over HTTP/2 maps the call onto headers, data frames, and trailers. Request metadata starts the stream. Serialized messages travel in data frames. Final status normally returns in trailers. The application sees a method call, but the runtime sees a framed stream.',
        'Streaming methods change the lifecycle. Unary RPC is one request and one response. Server streaming is one request and many responses. Client streaming is many requests and one response. Bidirectional streaming lets both sides send sequences, so handlers must coordinate reads, writes, cancellation, deadlines, and flow-control readiness.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The RPC-stream view proves the split between contract and runtime. The proto contract gives a typed method. The stub hides serialization. The channel carries many calls. HTTP/2 frames each stream. The server handler runs application logic. Final status comes back as part of the stream lifecycle.',
        'The flow-control view proves that counters and queues are the real data structures. Connection windows, stream windows, inbound queues, outbound queues, deadline timers, and cancellation handles decide whether the service remains stable under load.',
        'The telemetry-uploader case proves why this matters. A fleet agent sending log batches should respect flow-control readiness, message-size limits, retry budgets, idempotent batch ids, tenant quotas, and deadlines. Otherwise a recovery event becomes a retry storm.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Typed contracts work because client and server agree on service shape before runtime. Generated code reduces drift between languages and makes breaking changes visible. Protobuf gives compact binary messages and schema evolution rules when fields are managed carefully.',
        'Multiplexing works because streams share a connection without sharing one queue of application work. A slow stream should not force every other stream to wait behind it at the application layer, though TCP-level head-of-line effects can still exist below HTTP/2.',
        'Deadlines and cancellation work when they propagate. A client deadline should become a server timer, queue admission signal, downstream RPC deadline, and cleanup trigger. A status code is only useful if the system stops spending resources after failure is known.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'gRPC adds tooling and operational complexity. Teams need proto design discipline, generated-code pipelines, compatibility rules, observability, load-balancer support, gateway behavior, and language runtime understanding. It is not automatically simpler than HTTP JSON.',
        'Binary protocols are harder to inspect casually. Proxies, browser clients, debugging tools, and public API consumers may prefer JSON over HTTP. Many organizations expose JSON externally while using gRPC internally where typed contracts and streaming are worth the cost.',
        'Flow control is necessary but not sufficient. If application code reads from the network into an unbounded queue, the protocol has already granted credit and memory is now the limiter. Backpressure must reach the producer before queues, memory, or downstream services saturate.',
        'A useful design review asks four questions for every method: what is the deadline, what is the retry policy, what makes a request idempotent, and what happens when the receiver stops reading. If the proto contract cannot answer those questions, the service is underspecified even if the message fields compile.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'gRPC wins in internal service-to-service calls, typed control planes, model-serving APIs, telemetry uploaders, database gateways, streaming inference, watch APIs, and systems where deadlines and generated clients matter.',
        'It is especially useful when the method shape is not simple request/response. Server streaming fits feeds and watches. Client streaming fits uploads and telemetry. Bidirectional streaming fits synchronization, chat-like flows, and interactive inference where both sides produce messages over time.',
        'It connects naturally to distributed tracing, circuit breakers, rate limiters, retry budgets, load balancing, and service mesh policy. The RPC abstraction is useful only when the surrounding reliability controls understand the stream lifecycle.',
        'It also wins when APIs are owned by several teams. The proto file becomes a shared contract, code generation removes a class of manual client drift, and compatibility review can focus on field evolution, method shape, status behavior, and deadline expectations instead of reverse-engineering ad hoc payloads.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'gRPC is not automatically faster in every setting. It shines when typed contracts, binary messages, streaming, deadlines, and generated clients solve real problems. Browser support, human debugging, gateway translation, load-balancer behavior, and organizational familiarity still matter.',
        'Retries can be dangerous. UNAVAILABLE may be retryable, but only within a deadline, with idempotency, backoff, jitter, and a retry budget. Otherwise an outage creates more traffic exactly when the service is weakest.',
        'A final failure is forgetting final status. Application success is not just receiving some bytes. The call is complete when the stream closes with status, and callers need to distinguish OK, DEADLINE_EXCEEDED, CANCELLED, UNAVAILABLE, INTERNAL, and domain-level errors.',
        'Also watch version drift. Removing fields, changing meanings, or reusing field numbers can break clients silently.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: gRPC core concepts at https://grpc.io/docs/what-is-grpc/core-concepts/, the gRPC introduction at https://grpc.io/docs/what-is-grpc/introduction/, and the official gRPC over HTTP/2 protocol notes at https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md. Study Protobuf Wire Format for payload encoding, HPACK Dynamic Table HTTP/2 for header compression, HTTP/3 QUIC Stream Multiplexing for the next transport generation, Backpressure for pressure propagation, Circuit Breakers for failure isolation, Rate Limiter for quotas, Message Queue for buffering, and Distributed Tracing for end-to-end RPC visibility.',
      ],
    },
  ],
};
