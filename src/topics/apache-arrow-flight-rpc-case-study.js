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
      heading: 'What it is',
      paragraphs: [
        {type:'callout', text:'The deep lesson of Arrow Flight: match the interface to the physical data shape. Row-shaped APIs are pleasant for small objects, but they burn CPU converting values into service-specific objects and make large transfers hard to parallelize. Flight keeps analytical data in batch-columnar form across the network boundary, then adds the missing service pieces: discovery, endpoint placement, Tickets, streaming, and backpressure.'},
        'Apache Arrow Flight is an RPC framework for Arrow-native data services. It combines metadata calls for discovery with streaming calls that move Arrow record batches through the Arrow IPC format.',
        'The naive approach is to expose analytical data through row-shaped REST or generic RPC payloads. That works for small responses, but it burns CPU converting values into service-specific objects and makes large transfers hard to parallelize. Flight keeps the catalog question, "what should I read?", separate from the data-plane question, "move these columnar batches now."',
      ],
    },
    {
      heading: 'Core idea',
      paragraphs: [
        'A client describes a dataset with a FlightDescriptor, calls GetFlightInfo, and receives schema, endpoints, and Tickets. The Ticket is an opaque server-defined token. The client then calls DoGet with that Ticket and receives a stream of Arrow record batches.',
        'Writes use DoPut. The client streams schema and batches to the server, and the server can send response metadata for progress, resumable writes, accepted-row counts, partition ids, or commit information.',
        'The important split is control plane versus data plane. Discovery calls answer what exists, what schema it has, and where it can be read. Streaming calls move columnar batches. That split lets a catalog or coordinator stay light while data endpoints move the heavy payloads.',
      ],
    },
    {
      heading: 'How the protocol is structured',
      paragraphs: [
        'In the discovery view, follow the client to ListFlights and FlightInfo before any data moves. The important objects are schema, endpoints, and Tickets. Multiple endpoints show that the metadata service and the data servers do not have to be the same machine.',
        'In the streaming view, follow schema then batches through DoPut. The acknowledgement metadata is not decoration; it is the control channel for progress, checkpoints, and write coordination.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'A feature platform can expose training data through Flight. The client asks for features for a date range. GetFlightInfo returns the schema, estimated rows, endpoints near the relevant partitions, and Tickets. Each endpoint streams Arrow batches that the trainer can consume without decoding JSON.',
        'For ingestion, feature builders can use DoPut. The server can acknowledge committed batches, so a failed upload resumes from a known point instead of restarting a huge transfer.',
      ],
    },
    {
      heading: 'Tradeoffs and failure modes',
      paragraphs: [
        'Flight is not just "gRPC for tables." The point is Arrow-native columnar transfer plus discovery. If a service converts everything to rows internally, it gives away much of the benefit.',
        'Tickets are not harmless ids. They are capabilities and need scoping, authorization, logging, expiration, and replay protection. Endpoints also become part of the contract: bad placement, missing backpressure, schema drift, or weak observability can make a fast pipe fail loudly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Arrow Flight works because the payload shape matches analytic execution. Columnar engines want batches of typed columns, not one JSON object per row. Keeping data in Arrow format reduces conversion, preserves vectorized execution, and makes the transfer boundary look like the memory layout used by downstream processing.',
        'It also works because discovery and transfer are separated. A client can ask for a dataset, receive several endpoints, and read partitions in parallel. The server can move metadata through one path and high-volume record batches through another. This is the same architectural principle seen in storage systems: keep the control plane expressive and the data plane efficient.',
      ],
    },
    {
      heading: 'A worked example',
      paragraphs: [
        'Suppose a training job needs feature rows for one week. The client sends a FlightDescriptor describing the feature set and time range. GetFlightInfo returns the schema plus endpoints for partitions in three regions. The client opens DoGet streams to those endpoints and consumes Arrow batches directly into the training pipeline.',
        'If one endpoint is slow, the client can observe that stream separately from the metadata call. If the schema changed, the failure happens before the job silently decodes the wrong row shape. If the Ticket expires, the authorization boundary is explicit rather than hidden in a URL or ad hoc token.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'A Flight service should track metadata-call latency, stream throughput, endpoint skew, batch size distribution, backpressure time, schema mismatch errors, Ticket rejection reasons, retries, and conversion cost at the edges. These metrics distinguish a slow catalog from a slow data stream.',
        'The most common mistake is to keep the wire protocol columnar while doing row-wise work before or after the transfer. That preserves the API name but loses the performance model. Arrow-native means the hot path should stay columnar across service boundaries.',
      ],
    },
    {
      heading: 'Security and governance',
      paragraphs: [
        'Tickets deserve special attention because they are opaque authority tokens. A Ticket may encode a partition, query, user scope, snapshot, or server-side handle. If it is too broad or long-lived, it becomes a confused-deputy risk. If it is not logged, a data movement event becomes hard to audit. If it is replayable without constraints, a client can reuse access beyond the intended window.',
        'A serious Flight service treats Tickets like capabilities. Scope them to a dataset, user, operation, and time window. Bind them to authorization checks. Log their creation and use. Decide whether they can be shared across endpoints. Make expiration and error behavior explicit so clients can retry safely without silently broadening access.',
        'Governance also includes schema evolution. A client reading Arrow batches needs to know whether a field was added, renamed, widened, or made nullable. Flight can carry schema information, but the service still needs compatibility rules. Columnar transfer is fast only when both sides agree on meaning, not just bytes.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Apache Arrow Flight is a data-plane RPC pattern for analytic batches. Descriptors and FlightInfo discover data. Tickets authorize specific reads. DoGet and DoPut move Arrow record batches. The design is valuable because it keeps columnar data columnar while still giving clients a service protocol.',
        'The deep lesson is to match the interface to the physical data shape. Row-shaped APIs are pleasant for small objects. Columnar batch APIs are better for analytic scans, feature transfer, and vectorized engines.',
        'For course design, place Arrow Flight after Arrow columnar memory and before feature stores or lakehouse serving. Students should see how an in-memory format becomes a service boundary once discovery, authorization, and streaming are added.',
        'The wrong tool is a generic REST endpoint that serializes analytic data row by row. It may be easy to implement, but it discards the layout that made the engine fast. Flight keeps the physical representation visible across the network boundary, then adds the missing service pieces: discovery, endpoint placement, Tickets, streaming, and backpressure.',
        'If students remember one diagnostic question, make it this: does the API preserve the shape the engine wants to process? If the answer is no, the service boundary has become a tax. Arrow Flight exists to keep analytical data in batch-columnar form across that boundary.',
        'The practical contrast is simple. A row API is good for one object, one form submission, or one small command. A Flight stream is good when the natural unit is a table fragment, feature batch, query result partition, or columnar scan.',
        'The comparison to Parquet is useful. Parquet is a durable columnar file format. Arrow is an in-memory columnar format. Flight is one way to move Arrow-shaped data between services without pretending the data is row-shaped.',
        'A mature Flight deployment documents schema guarantees, Ticket lifetime, endpoint placement, and retry behavior as part of the API contract.',
        'That contract is what separates a fast demo from an educational system design. The fast path moves batches; the full design explains who may read them, which schema they follow, how retries behave, and what the client can assume after partial failure.',
      ],
    },
    {
      heading: 'Practical guidance',
      paragraphs: [
        'Use Flight when the natural payload is batches of analytical data, not small request-response objects. Keep Arrow all the way through the hot path, make Tickets explicit security objects, and expose enough metadata for clients to parallelize without guessing.',
        'When debugging Flight performance, separate metadata latency from stream throughput. A slow ListFlights path, overloaded endpoint, backpressured DoGet stream, and expensive Arrow-to-row conversion are different problems.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Arrow Flight documentation at https://arrow.apache.org/docs/format/Flight.html and Apache Arrow Flight source docs at https://github.com/apache/arrow/blob/main/docs/source/format/Flight.rst. Study Apache Arrow Columnar Memory Case Study, Parquet Columnar Format Case Study, Backpressure, Distributed Tracing, and Schema Registry Case Study next.',
      ],
    },
  ],
};
