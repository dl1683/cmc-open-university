// Apache Arrow Flight: metadata discovery plus columnar record-batch streams.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'apache-arrow-flight-rpc-case-study',
  title: 'Apache Arrow Flight RPC Case Study',
  category: 'Systems',
  summary: 'Arrow Flight as a columnar transport lesson: discover streams with FlightInfo, pass opaque Tickets, and move Arrow record batches through DoGet and DoPut.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['flight discovery', 'columnar streaming'], defaultValue: 'flight discovery' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function flightGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 3.6, note: 'consumer' },
      { id: 'list', label: 'ListFlights', x: 2.4, y: 1.6, note: 'discover' },
      { id: 'info', label: 'FlightInfo', x: 4.3, y: 2.3, note: 'schema + endpoints' },
      { id: 'ticket', label: 'Ticket', x: 4.3, y: 5.0, note: 'opaque handle' },
      { id: 'serverA', label: 'server A', x: 6.3, y: 1.8, note: 'endpoint' },
      { id: 'serverB', label: 'server B', x: 6.3, y: 5.2, note: 'endpoint' },
      { id: 'doget', label: 'DoGet', x: 8.1, y: 2.8, note: 'download' },
      { id: 'batches', label: 'record batches', x: 9.2, y: 4.7, note: 'Arrow IPC' },
    ],
    edges: [
      { id: 'e-client-list', from: 'client', to: 'list', weight: 'ask' },
      { id: 'e-list-info', from: 'list', to: 'info', weight: 'metadata' },
      { id: 'e-info-ticket', from: 'info', to: 'ticket', weight: 'handle' },
      { id: 'e-info-a', from: 'info', to: 'serverA', weight: 'endpoint' },
      { id: 'e-info-b', from: 'info', to: 'serverB', weight: 'endpoint' },
      { id: 'e-ticket-doget', from: 'ticket', to: 'doget', weight: 'present' },
      { id: 'e-a-doget', from: 'serverA', to: 'doget', weight: 'stream' },
      { id: 'e-doget-batches', from: 'doget', to: 'batches', weight: 'IPC' },
    ],
  }, { title });
}

function streamGraph(title) {
  return graphState({
    nodes: [
      { id: 'producer', label: 'producer', x: 0.7, y: 3.4, note: 'writer' },
      { id: 'doput', label: 'DoPut', x: 2.7, y: 3.4, note: 'upload stream' },
      { id: 'schema', label: 'schema', x: 4.5, y: 1.7, note: 'Arrow fields' },
      { id: 'batch1', label: 'batch 1', x: 4.5, y: 3.4, note: 'columns' },
      { id: 'batch2', label: 'batch 2', x: 4.5, y: 5.1, note: 'columns' },
      { id: 'server', label: 'server', x: 6.8, y: 3.4, note: 'service' },
      { id: 'ack', label: 'ack metadata', x: 8.8, y: 3.4, note: 'progress' },
    ],
    edges: [
      { id: 'e-producer-doput', from: 'producer', to: 'doput', weight: 'write' },
      { id: 'e-doput-schema', from: 'doput', to: 'schema', weight: 'schema' },
      { id: 'e-doput-b1', from: 'doput', to: 'batch1', weight: 'batch' },
      { id: 'e-doput-b2', from: 'doput', to: 'batch2', weight: 'batch' },
      { id: 'e-b1-server', from: 'batch1', to: 'server', weight: 'IPC' },
      { id: 'e-b2-server', from: 'batch2', to: 'server', weight: 'IPC' },
      { id: 'e-server-ack', from: 'server', to: 'ack', weight: 'status' },
      { id: 'e-ack-producer', from: 'ack', to: 'producer', weight: 'back' },
    ],
  }, { title });
}

function* flightDiscovery() {
  yield {
    state: flightGraph('Flight separates metadata discovery from data transfer'),
    highlight: { active: ['client', 'list', 'info', 'e-client-list', 'e-list-info'], found: ['serverA', 'serverB'] },
    explanation: 'Read this as two planes. Discovery answers what streams exist, what schema they have, and where to fetch them. Data movement waits until the client has a Ticket and endpoint.',
  };

  yield {
    state: labelMatrix(
      'Flight metadata objects',
      [
        { id: 'desc', label: 'D' },
        { id: 'info', label: 'I' },
        { id: 'end', label: 'E' },
        { id: 'ticket', label: 'T' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'use', label: 'use' },
      ],
      [
        ['query/path', 'ask'],
        ['schema', 'plan'],
        ['server', 'route'],
        ['opaque', 'fetch'],
      ],
    ),
    highlight: { active: ['info:holds', 'end:use', 'ticket:use'], compare: ['desc:holds'] },
    explanation: 'The Ticket is a capability, not a friendly row id. The client presents it; the server decides what it means, how long it is valid, and which authorization decision it carries.',
    invariant: 'Discovery returns handles; DoGet uses handles to stream data.',
  };

  yield {
    state: flightGraph('FlightInfo can point to multiple endpoints'),
    highlight: { active: ['info', 'serverA', 'serverB', 'e-info-a', 'e-info-b'], found: ['ticket'] },
    explanation: 'FlightInfo can list endpoints on one or more servers. This lets a service separate catalog metadata from data-plane transfer and lets clients parallelize reads across endpoints.',
  };

  yield {
    state: labelMatrix(
      'Read path',
      [
        { id: 'l', label: 'L' },
        { id: 'g', label: 'G' },
        { id: 'd', label: 'D' },
        { id: 'b', label: 'B' },
      ],
      [
        { id: 'call', label: 'call' },
        { id: 'result', label: 'result' },
      ],
      [
        ['List', 'flights'],
        ['GetInfo', 'ticket'],
        ['DoGet', 'stream'],
        ['IPC', 'batches'],
      ],
    ),
    highlight: { found: ['g:result', 'd:result', 'b:result'], compare: ['l:call'] },
    explanation: 'The read path is: discover, bind to a ticket, call DoGet, then receive Arrow IPC batches. If the service converts to JSON or row objects in the middle, it has lost the main Flight advantage.',
  };
}

function* columnarStreaming() {
  yield {
    state: streamGraph('DoPut uploads Arrow record batches'),
    highlight: { active: ['producer', 'doput', 'schema', 'batch1', 'batch2'], found: ['server'] },
    explanation: 'DoPut is the write-side mirror: send schema first, then stream Arrow record batches. The server can validate schema once and then handle column buffers batch by batch.',
  };

  yield {
    state: labelMatrix(
      'Columnar stream shape',
      [
        { id: 's', label: 'S' },
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' },
        { id: 'm', label: 'M' },
      ],
      [
        { id: 'carries', label: 'carries' },
        { id: 'why', label: 'why' },
      ],
      [
        ['fields', 'types'],
        ['cols', 'zero-copy'],
        ['cols', 'pipe'],
        ['app meta', 'acks'],
      ],
    ),
    highlight: { active: ['b1:carries', 'b2:why'], found: ['m:why'] },
    explanation: 'The payload is Arrow-native. Consumers can often hand column buffers directly to analytical code instead of decoding every value into row objects.',
  };

  yield {
    state: streamGraph('Server metadata can acknowledge resumable writes'),
    highlight: { active: ['server', 'ack', 'e-server-ack', 'e-ack-producer'], compare: ['batch2'] },
    explanation: 'Flight allows server response metadata during DoPut. A service can use that channel for write progress, accepted row counts, partition ids, or resumable-upload checkpoints.',
  };

  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'auth', label: 'A' },
        { id: 'loc', label: 'L' },
        { id: 'flow', label: 'F' },
        { id: 'ver', label: 'V' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['acl', 'leak'],
        ['ep', 'skew'],
        ['bp', 'OOM'],
        ['schema', 'drift'],
      ],
    ),
    highlight: { active: ['auth:need', 'flow:risk'], found: ['ver:need'] },
    explanation: 'The design checklist is where Flight becomes a service rather than a demo. Fast columnar transfer must be wrapped with authorization, endpoint placement, backpressure, schema compatibility, and observability.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'flight discovery') yield* flightDiscovery();
  else if (view === 'columnar streaming') yield* columnarStreaming();
  else throw new InputError('Pick an Arrow Flight view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation separates control plane from data plane. The control plane answers what data exists, what schema it has, and where it can be read. The data plane streams Arrow record batches after the client presents a Ticket.',
        'Active nodes are the current protocol object or call. Found nodes are usable endpoints, Tickets, or batches. Read DoGet as download, DoPut as upload, and Ticket as an opaque server-defined handle rather than a friendly row id.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'The deep lesson of Arrow Flight: match the interface to the physical data shape. Row-shaped APIs are pleasant for small objects, but they burn CPU converting values into service-specific objects and make large transfers hard to parallelize. Flight keeps analytical data in batch-columnar form across the network boundary, then adds the missing service pieces: discovery, endpoint placement, Tickets, streaming, and backpressure.'},
        'Arrow Flight exists because analytical data is naturally batch-columnar, while many service APIs are row-shaped. A row-shaped API sends one object at a time or serializes every row into JSON, protobuf records, or custom structs. That burns CPU before the query engine can do useful work.',
        'Flight keeps Arrow data in Arrow form over an RPC boundary. It adds discovery, endpoints, Tickets, streaming, and backpressure around Arrow IPC batches. The service contract matches the physical shape that analytical engines already want to process.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is REST or generic gRPC with rows. A client asks for a table, and the server returns rows or objects. This is easy for small payloads and application commands.',
        'It is poor for a 20 GB analytical result. The server must convert column buffers into rows, the network sends row messages, and the client reconstructs columns if it wants vectorized execution. Parallel reads also become awkward because endpoint placement is not part of the data contract.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is conversion at the service boundary. If a database already produced Arrow batches, converting them into 10 million row objects and then back into arrays is pure tax. The more data moves, the more the boundary dominates the query.',
        'The second wall is coordination. A client needs schema, partition locations, authorization, retry behavior, and flow control before it can read safely. A bare file URL or ad hoc token does not define enough of that contract.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Flight splits discovery from transfer. FlightDescriptor describes what the client wants. FlightInfo returns schema, endpoints, and Tickets. DoGet presents a Ticket and receives a stream of Arrow record batches. DoPut sends schema and batches to write data.',
        'The Ticket is the key boundary. It can encode a query, partition, snapshot, user scope, or server-side handle, but the client treats it as opaque. The server owns its meaning, lifetime, authorization, and replay rules.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A read starts with ListFlights or GetFlightInfo. The server returns metadata: schema, total size if known, and endpoints. Each endpoint contains a Ticket and a location, so clients can read partitions in parallel or near the data.',
        'A write uses DoPut. The client sends schema first, then streams Arrow record batches. The server can send response metadata for accepted rows, partition ids, checkpoints, or commit state, which lets large writes report progress without inventing a side channel.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the wire payload keeps the same shape as the execution payload. Arrow record batches already contain typed column buffers, validity bitmaps, offsets, and schema. Flight moves those batches instead of translating them into per-row objects.',
        'Correctness comes from explicit schema and handles. A client knows the field names and types before reading, and the Ticket binds the transfer to a server-side decision. If the schema or authorization is wrong, the failure happens at the protocol boundary instead of inside silent row decoding.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Flight reduces per-value CPU cost, but it does not remove network cost. Moving 10 GB still moves 10 GB. The gain is that the sender and receiver avoid millions of object allocations, string parses, and row reconstructions while streaming those bytes.',
        'The complexity cost is service design. Tickets need scope, expiry, logging, and replay protection. Endpoints need placement and load balancing. Streams need backpressure, retry policy, observability, and schema evolution rules.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Flight fits feature platforms, analytical query services, database clients, lakehouse engines, and cross-language data tools. It is strongest when the natural unit is a table fragment or result partition rather than one object.',
        'It also fits ingestion. A feature builder can stream Arrow batches to a service with DoPut, receive checkpoint metadata, and resume after failure from a known accepted batch. The protocol carries both data and progress.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Flight is the wrong tool for tiny command APIs, form submissions, or object-at-a-time application workflows. A simple REST endpoint is easier when the payload is naturally small and row-shaped. Columnar streaming pays off when batch data dominates.',
        'It also fails if the implementation converts to rows internally. A service can expose Flight and still lose the benefit by decoding every value into language objects before sending. The hot path has to stay Arrow-native.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A training job needs one week of feature rows. GetFlightInfo returns a schema with 40 columns and 4 endpoints, each with a Ticket for one partition. The client opens 4 DoGet streams and receives 64,000-row Arrow batches from each endpoint.',
        'If each row is about 400 bytes and the job reads 50 million rows, the transfer is about 20 GB. A row API would allocate 50 million row objects before the trainer converts them again. Flight streams column buffers directly, so the cost behaves like bulk transfer plus batch validation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Arrow Flight documentation and the Arrow Flight protocol source docs. Study Apache Arrow columnar memory first, then Arrow IPC, gRPC streaming, backpressure, schema registries, distributed tracing, and capability-based security.',
        'The useful implementation exercise is to design a Ticket format on paper. Name its dataset, snapshot, user scope, expiration, and replay policy. That exercise reveals whether the service boundary is safe or only fast.',
      ],
    },
  ],
};