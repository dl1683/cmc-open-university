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
    explanation: 'A Flight client first discovers what streams exist. Metadata calls such as ListFlights and GetFlightInfo return schemas, endpoints, byte counts, and tickets before the client starts moving data.',
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
    explanation: 'The ticket is deliberately opaque to the client. The server can encode a dataset id, partition, authorization decision, or cached plan without making it a public protocol contract.',
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
    explanation: 'A complete read is a sequence: discover streams, get a ticket and endpoints, call DoGet, and receive Arrow IPC record batches without row-oriented serialization.',
  };
}

function* columnarStreaming() {
  yield {
    state: streamGraph('DoPut uploads Arrow record batches'),
    highlight: { active: ['producer', 'doput', 'schema', 'batch1', 'batch2'], found: ['server'] },
    explanation: 'DoPut streams Arrow record batches from a client to a server. The stream starts with schema information and then sends batches with column buffers, validity bitmaps, offsets, and values.',
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
    explanation: 'A production Flight service is more than a fast pipe. Tickets need authorization, endpoints need load placement, streams need backpressure, and schema changes need compatibility rules.',
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
        'Apache Arrow Flight is an RPC framework for high-performance data services built around Arrow data. It combines metadata methods for discovery with streaming methods that move Arrow record batches through the Arrow IPC format.',
        'This case study extends Apache Arrow Columnar Memory Case Study, Parquet Columnar Format Case Study, Backpressure, Load Balancer, and Distributed Tracing. The key lesson is separating the catalog/control-plane question, "what data stream should I read?", from the data-plane operation, "move these columnar batches now."',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client can describe a desired dataset with a FlightDescriptor, call GetFlightInfo, and receive a FlightInfo object with schema, endpoints, and Tickets. A Ticket is an opaque server-defined token that identifies exactly what the client should fetch. The client then calls DoGet with a Ticket and receives a stream of Arrow record batches.',
        'Writes use DoPut. A client streams schema and record batches to the server, and the server can respond with application metadata. That response channel is useful for progress, resumable writes, accepted-row counts, or commit metadata.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Flight avoids much row-wise serialization overhead, but it does not remove distributed-systems work. A service still needs authorization around tickets, endpoint placement, backpressure, retry semantics, schema compatibility, and observability. The speed of the columnar pipe makes control-plane mistakes more expensive because clients can move large batches quickly.',
        'Another design choice is endpoint topology. FlightInfo can point clients to data endpoints that differ from the metadata service. That is powerful for locality and scale, but it means load balancing and data placement become part of the API contract.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A feature platform exposes training data through Flight. The client asks for features for a date range. GetFlightInfo returns the Arrow schema, estimated rows, and endpoints close to the relevant partitions. Each endpoint receives a Ticket and streams record batches. The trainer can consume Arrow buffers directly instead of decoding JSON or row objects.',
        'For online ingestion, the platform accepts DoPut streams from feature builders. The server returns progress metadata every few batches, so a failed client can resume from a known committed row count rather than restarting a huge upload.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Flight is not just "gRPC for tables." The point is Arrow-native columnar transfer plus discovery. If a service converts everything to rows internally, it gives away much of the benefit. Another trap is treating Tickets as harmless ids. Tickets are capabilities; they must be scoped, authorized, logged, and expired appropriately.',
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
