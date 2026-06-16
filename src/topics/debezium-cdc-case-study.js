// Debezium CDC case study: database commit logs become ordered change streams
// for Kafka consumers, outbox relays, and eventually consistent projections.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'debezium-cdc-case-study',
  title: 'Debezium CDC Case Study',
  category: 'Systems',
  summary: 'Change data capture as a production pipeline: tail database logs, publish ordered row changes, preserve offsets, and feed idempotent consumers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['log to stream', 'outbox reliability'], defaultValue: 'log to stream' },
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

function cdcGraph(title) {
  return graphState({
    nodes: [
      { id: 'app', label: 'application', x: 0.7, y: 2.4, note: 'local transaction' },
      { id: 'db', label: 'database', x: 2.4, y: 2.4, note: 'tables' },
      { id: 'log', label: 'commit log', x: 4.2, y: 2.4, note: 'WAL/binlog' },
      { id: 'connector', label: 'Debezium connector', x: 5.9, y: 2.4, note: 'reads changes' },
      { id: 'schema', label: 'schema/history', x: 5.9, y: 5.2, note: 'DDL + envelope' },
      { id: 'kafka', label: 'Kafka topics', x: 7.7, y: 2.4, note: 'ordered partitions' },
      { id: 'consumer', label: 'consumers', x: 9.3, y: 2.4, note: 'projections' },
      { id: 'offsets', label: 'offset store', x: 7.7, y: 5.2, note: 'resume point' },
    ],
    edges: [
      { id: 'e-app-db', from: 'app', to: 'db', weight: 'commit' },
      { id: 'e-db-log', from: 'db', to: 'log', weight: 'append' },
      { id: 'e-log-connector', from: 'log', to: 'connector', weight: 'tail' },
      { id: 'e-schema-connector', from: 'schema', to: 'connector', weight: 'decode' },
      { id: 'e-connector-kafka', from: 'connector', to: 'kafka', weight: 'events' },
      { id: 'e-kafka-consumer', from: 'kafka', to: 'consumer', weight: 'consume' },
      { id: 'e-connector-offsets', from: 'connector', to: 'offsets', weight: 'checkpoint' },
      { id: 'e-offsets-connector', from: 'offsets', to: 'connector', weight: 'restart' },
    ],
  }, { title });
}

function* logToStream() {
  yield {
    state: cdcGraph('A committed database change first lands in the log'),
    highlight: { active: ['app', 'db', 'log', 'e-app-db', 'e-db-log'], compare: ['connector'] },
    explanation: 'Change data capture starts with the database commit path. MySQL binlog and PostgreSQL WAL already contain the ordered facts needed for replication and recovery.',
  };

  yield {
    state: cdcGraph('The connector tails the log and emits change events'),
    highlight: { active: ['log', 'connector', 'kafka', 'e-log-connector', 'e-connector-kafka'], found: ['schema'] },
    explanation: 'Debezium reads the database log through a connector, decodes row-level changes, wraps them in an event envelope, and publishes them to Kafka topics.',
    invariant: 'CDC should preserve committed order for the scope the connector and database log can define.',
  };

  yield {
    state: labelMatrix(
      'Change-event anatomy',
      [
        { id: 'key', label: 'event key' },
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
        { id: 'source', label: 'source metadata' },
        { id: 'op', label: 'operation' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'example', label: 'example' },
      ],
      [
        ['partitioning and identity', 'order_id=42'],
        ['previous row image', 'status=pending'],
        ['new row image', 'status=paid'],
        ['where it came from', 'lsn/binlog position'],
        ['insert/update/delete', 'u'],
      ],
    ),
    highlight: { active: ['key:job', 'source:example'], found: ['before:example', 'after:example'] },
    explanation: 'A useful CDC event carries enough identity, row image, and source position to make downstream consumers replayable and debuggable.',
  };

  yield {
    state: cdcGraph('Offsets make restarts replay from a known point'),
    highlight: { active: ['connector', 'offsets', 'e-connector-offsets', 'e-offsets-connector'], compare: ['consumer'] },
    explanation: 'The connector must checkpoint its log position. After a crash it resumes from a known offset, so consumers must still handle at-least-once delivery and duplicates.',
  };
}

function* outboxReliability() {
  yield {
    state: labelMatrix(
      'Outbox CDC flow',
      [
        { id: 'domain', label: 'domain row' },
        { id: 'outbox', label: 'outbox row' },
        { id: 'commit', label: 'commit' },
        { id: 'router', label: 'event router' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'safety', label: 'safety property' },
      ],
      [
        ['update order', 'same transaction'],
        ['insert OrderPlaced', 'same transaction'],
        ['append WAL/binlog', 'all or nothing'],
        ['route to Kafka topic', 'after commit only'],
      ],
    ),
    highlight: { found: ['domain:safety', 'outbox:safety', 'commit:safety'], active: ['router:step'] },
    explanation: 'The transactional outbox pattern pairs naturally with CDC. Business rows and event rows commit together; Debezium publishes only committed outbox events.',
  };

  yield {
    state: cdcGraph('Outbox routing turns rows into integration events'),
    highlight: { active: ['db', 'log', 'connector', 'kafka', 'e-db-log', 'e-log-connector', 'e-connector-kafka'], found: ['consumer'] },
    explanation: 'An outbox event router can transform a generic outbox table into routed Kafka events, using fields such as aggregate type, aggregate id, event type, and payload.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'schema', label: 'schema drift' },
        { id: 'lag', label: 'connector lag' },
        { id: 'duplicate', label: 'duplicate delivery' },
        { id: 'delete', label: 'deletes/tombstones' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'response', label: 'response' },
      ],
      [
        ['consumer decode errors', 'schema governance'],
        ['events arrive late', 'lag alerts and capacity'],
        ['consumer repeats work', 'idempotency key'],
        ['state does not compact', 'explicit tombstone policy'],
      ],
    ),
    highlight: { active: ['lag:response', 'duplicate:response'], compare: ['schema:symptom'] },
    explanation: 'CDC is not magic consistency. It moves committed facts reliably only if schema, offsets, lag, tombstones, and idempotency are handled deliberately.',
  };

  yield {
    state: labelMatrix(
      'Where CDC fits',
      [
        { id: 'search', label: 'search indexing' },
        { id: 'analytics', label: 'analytics lake' },
        { id: 'micro', label: 'microservice events' },
        { id: 'cache', label: 'cache invalidation' },
      ],
      [
        { id: 'why', label: 'why useful' },
        { id: 'watch', label: 'watch item' },
      ],
      [
        ['near-real-time row changes', 'reindex idempotently'],
        ['append facts downstream', 'late and reordered consumers'],
        ['publish outbox events', 'dedupe side effects'],
        ['invalidate on commit', 'avoid stale reads'],
      ],
    ),
    highlight: { found: ['search:why', 'micro:why'], active: ['cache:watch'] },
    explanation: 'Debezium is most valuable when other systems need to react to committed database changes without every application implementing a fragile dual-write path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'log to stream') yield* logToStream();
  else if (view === 'outbox reliability') yield* outboxReliability();
  else throw new InputError('Pick a Debezium CDC view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Debezium is a change data capture platform. It reads committed changes from database logs and publishes them as event streams, commonly through Kafka Connect into Kafka topics. Instead of asking every service to dual-write to both a database and a broker, CDC uses the database log as the source of committed truth.',
        'The official Debezium documentation describes the MySQL connector as reading the binlog, producing row-level insert, update, and delete events, and emitting them to Kafka topics: https://debezium.io/documentation/reference/stable/connectors/mysql.html. The PostgreSQL connector captures row-level changes from PostgreSQL schemas: https://debezium.io/documentation/reference/stable/connectors/postgresql.html.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A transaction commits to the database. The database appends the change to its replication or recovery log. A Debezium connector tails that log, decodes the change, attaches source metadata and schema information, and publishes an event. The connector also tracks offsets so it can resume after restarts. Downstream consumers read events and update projections, search indexes, caches, analytics tables, or other services.',
        'Events need more than a row payload. They need a stable key for partitioning and ordering, source position for debugging, before and after images where supported, operation type, schema history, and a clear delete or tombstone policy. Without that metadata, replay and incident investigation become guesswork.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CDC shifts complexity out of application dual writes and into a shared data pipeline. That is usually a good trade, but it is still a trade. Connectors can lag. Kafka topics can fill. Schema changes can break consumers. Restarts can replay events. Consumers must be idempotent because delivery is generally at least once. Monitoring connector lag and failure state is part of the architecture, not an afterthought.',
        'Ordering also has scope. A database log has a commit order, but Kafka partitions, topic routing, and consumer groups define what downstream systems actually observe. If a projection requires per-aggregate order, the event key and topic design must preserve it.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an order service. When checkout succeeds, the service writes the order row and an outbox row in the same database transaction. The outbox row contains event id, aggregate id, aggregate type, event type, and payload. Debezium tails the commit log, sees the outbox row, applies the outbox event router, and publishes OrderPlaced to a Kafka topic. Inventory, email, billing, and analytics consumers process the event with idempotency keys.',
        'If the service crashes after commit, the event is still in the database log. If the transaction rolls back, no event is published. If Debezium restarts, it resumes from an offset and may replay, so consumers dedupe by event id. This is the practical reason CDC and Transactional Outbox are usually studied together.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'CDC is not a distributed transaction across every downstream system. It is a reliable way to publish committed changes for asynchronous consumers. It does not remove the need for idempotency, schema governance, topic ownership, lag alerts, or backfill plans. It also does not mean every table should become a public API. A CDC stream is a contract and should be treated like one.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Official sources: Debezium MySQL connector docs at https://debezium.io/documentation/reference/stable/connectors/mysql.html, PostgreSQL connector docs at https://debezium.io/documentation/reference/stable/connectors/postgresql.html, Outbox Event Router docs at https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html, and the Debezium tutorial at https://debezium.io/documentation/reference/stable/tutorial.html. Study Transactional Outbox, Write-Ahead Log, Kafka Log Case Study, Idempotency, Message Queue, and Schema Evolution next.',
      ],
    },
  ],
};
