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
    explanation: 'HTTP/2 multiplexing means many logical RPC streams can share one TCP connection. Header metadata, message DATA frames, END_STREAM markers, and status trailers form the per-call state machine.',
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
    explanation: 'Streaming RPCs need backpressure. HTTP/2 has flow-control windows at both connection and stream levels. Receivers grant credit as they consume data; senders must stop when credit is exhausted.',
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
      heading: 'What it is',
      paragraphs: [
        'gRPC is an RPC framework built around explicit service definitions. By default those definitions use Protocol Buffers for messages and service methods. A generated client stub turns a local method call into metadata, serialized messages, HTTP/2 frames, and a status result.',
        'Primary sources: gRPC core concepts at https://grpc.io/docs/what-is-grpc/core-concepts/, the gRPC introduction at https://grpc.io/docs/what-is-grpc/introduction/, and the official gRPC over HTTP/2 protocol notes at https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md.',
      ],
    },
    {
      heading: 'The stream data structure',
      paragraphs: [
        'A gRPC channel owns long-lived transport state. A call owns stream state: method name, metadata, protobuf messages, flow-control counters, deadlines, cancellation, compression flags, and final status. HTTP/2 multiplexing lets many streams share a connection, but each stream still needs its own lifecycle.',
        'This connects directly to HPACK Dynamic Table HTTP/2 Case Study, Protobuf Wire Format Case Study, Message Queue, Backpressure, Circuit Breakers, and Distributed Tracing. gRPC is a useful bridge topic because it is both an interface contract and a live transport state machine.',
      ],
    },
    {
      heading: 'RPC shapes',
      paragraphs: [
        'Unary RPC is one request and one response. Server streaming is one request and many responses. Client streaming is many requests and one response. Bidirectional streaming lets both sides send sequences. The method shape should match the workflow: lookup, feed, upload, chat, telemetry, inference, sync, or control-plane watch.',
        'Streaming introduces more data structures than unary calls: inbound queues, outbound queues, stream windows, connection windows, timers, and application-level sequence state. A correct handler consumes messages deliberately and stops work when the deadline or cancellation fires.',
      ],
    },
    {
      heading: 'Complete case study: telemetry uploader',
      paragraphs: [
        'A fleet agent uploads logs with a client-streaming RPC. The proto file defines Upload(stream LogBatch) returns UploadSummary. The client opens a stream, sends compressed batches, observes flow-control readiness, and closes its send side. The server reads batches, validates tenant quota, writes to a durable Message Queue, updates Distributed Tracing spans, and returns a final status trailer.',
        'The important safeguards are max message size, deadline, retry budget, idempotent batch IDs, and backpressure. Without them, one regional outage can cause agents to reconnect, resend, fill buffers, and overwhelm the collector just as it recovers.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'gRPC is not automatically faster in every setting. It shines when typed contracts, binary messages, streaming, deadlines, and generated clients solve real problems. Browser support, human debugging, gateway translation, load balancer behavior, and organizational familiarity still matter.',
        'Flow control is not a complete memory policy. If an application reads from the network into an unbounded queue, HTTP/2 credit has already been converted into process memory. Similarly, retries need budgets and idempotency. A status code of UNAVAILABLE can mean retry, but only with a policy that respects deadlines and load.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Protobuf Wire Format for payload encoding, HPACK Dynamic Table HTTP/2 for header compression, HTTP/3 QUIC Stream Multiplexing for the next transport generation, Backpressure for pressure propagation, Circuit Breakers for failure isolation, Rate Limiter for quotas, and Distributed Tracing for end-to-end RPC visibility.',
      ],
    },
  ],
};
