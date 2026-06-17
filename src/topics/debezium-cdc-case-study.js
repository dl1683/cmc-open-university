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
      heading: 'Why This Exists',
      paragraphs: [
        `Applications often need downstream search indexes, caches, analytics tables, and services to react to committed database changes. Asking every application path to publish its own event recreates the dual-write problem.`,
        `Debezium is a change data capture platform. It reads committed changes from database logs and publishes them as event streams, commonly through Kafka Connect into Kafka topics.`,
        `The deeper idea is that the database log is already the system of record for committed mutation order. Databases use it for crash recovery and replication. CDC reuses that source instead of asking every business-code path to remember every integration side effect.`,
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        `The obvious approach is application-level event publishing after each write. It works for simple paths but misses bulk updates, manual SQL, backfills, rollbacks, and crashes between commit and publish.`,
        `The wall is that the database log is already the committed truth. If downstream systems need to mirror committed changes, reading the log is more reliable than trusting every writer to remember every side effect.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Use the database replication or recovery log as the source of committed change events. A connector tails the log, decodes row changes, attaches source metadata and schema information, and publishes events with resume offsets.`,
        `CDC shifts reliability from many application call sites into one shared pipeline. The event stream becomes replayable because it carries source position, operation type, key, schema, and row image metadata.`,
        `This does not mean the stream is magically exactly once from database to every side effect. It means the capture side is anchored to committed facts, and the rest of the pipeline can be designed around replay, offsets, idempotency, and explicit contracts.`,
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        `In the log-to-stream view, follow the commit path. The application writes the database, the database appends to its WAL or binlog, the connector tails that log, and Kafka receives decoded change events. The offset store is the recovery anchor: after a crash, the connector resumes from a known log position.`,
        `In the outbox view, the important fact is transaction boundaries. The domain row and the outbox row commit together. Debezium publishes only committed outbox rows, so downstream systems see events derived from database truth instead of a fragile second write from application code.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `A transaction commits to the database. The database appends the change to its log. Debezium tails that log, decodes the change, and publishes an event. It tracks offsets so it can resume after restarts.`,
        `Events need more than row payload. They need stable keys for partitioning and ordering, source positions for debugging, before and after images where supported, operation type, schema history, and delete or tombstone policy.`,
        `A connector also needs a snapshot story. Existing rows may be captured first, then streaming changes continue from a known log position. The handoff between snapshot and streaming must avoid missing rows or duplicating them in a way consumers cannot handle.`,
        `Schema history matters because log records are decoded under table definitions that can change over time. Consumers need a compatible envelope and schema governance, not just a pile of JSON blobs flowing through a topic.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `If the application crashes after commit, the change is still in the log. If the transaction rolls back, there is no committed log record to publish. That is why CDC pairs naturally with Transactional Outbox.`,
        `Offsets make restart possible, but replay remains possible. Consumers must be idempotent because delivery is generally at least once.`,
        `The outbox pattern works because it narrows the atomicity requirement. The service does not need a distributed transaction between the database and Kafka. It needs one local transaction that writes both business state and an event row. CDC then transports that committed row to Kafka after the fact.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `An order service marks order 42 as paid. In the same database transaction, it inserts an outbox row with event_id E7, aggregate_id 42, type OrderPaid, and a payload. The transaction commits, so the WAL contains both the order update and the outbox insert.`,
        `Debezium reads the WAL, sees the committed outbox insert, and the outbox event router maps it to an orders.events topic keyed by order 42. If the connector crashes after Kafka publish but before the offset is safely recorded, it may publish E7 again after restart. A payment-email consumer therefore stores event_id E7 before sending or uses another idempotency mechanism.`,
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        `CDC shifts complexity out of application dual writes and into a pipeline. Connectors can lag, Kafka topics can fill, schema changes can break consumers, and restarts can replay events. Monitoring lag and failure state is part of the architecture.`,
        `Ordering has scope. A database log has commit order, but Kafka partitions, topic routing, and consumer groups define what downstream systems observe. Per-aggregate order requires careful event keys and topic design.`,
        `Backfills are a separate operational problem. Replaying a topic, re-snapshotting a table, and rebuilding a projection all have different blast radii. Good CDC deployments define how consumers distinguish initial loads, live updates, tombstones, and correction events.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `CDC fits search indexing, cache invalidation, audit streams, analytics ingestion, data lake feeds, CQRS projections, and asynchronous service integration. It is strongest when the database log is already the most trustworthy record of committed changes.`,
        `The order-service outbox case is the standard production shape: write order row and outbox row together, let Debezium publish OrderPlaced, and let downstream consumers dedupe by event id.`,
        `It also helps with non-application writers. Bulk SQL updates, maintenance scripts, and backfills can still appear in the change stream if they commit through the database. Application-level event publishing often misses those paths unless every tool is carefully wrapped.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `CDC is not a distributed transaction across every downstream system. It does not remove the need for idempotency, schema governance, topic ownership, lag alerts, or backfill plans.`,
        `It also does not mean every table should become a public API. A CDC stream is a contract and should be treated like one.`,
        `It can be the wrong fit for derived domain events that are not naturally row changes. Raw table CDC can leak internal schemas and force consumers to understand database details. The outbox pattern exists partly to publish intentional events rather than every internal mutation.`,
      ],
    },
    {
      heading: 'Implementation Guidance',
      paragraphs: [
        `Start by deciding whether the stream is raw table replication, an outbox event stream, or both. Raw table topics are useful for projections and analytics, but public integration events should usually be owned by a service and keyed by the aggregate that downstream systems order around.`,
        `Treat offsets, schema history, and consumer idempotency as production state. Back up connector configuration, monitor source-log lag and offset flush failures, alert on schema-history problems, and rehearse re-snapshot or replay before an incident. A CDC pipeline is recoverable only if its recovery procedure has been tested under duplicate delivery and late consumers.`,
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Official sources: Debezium MySQL connector docs at https://debezium.io/documentation/reference/stable/connectors/mysql.html, PostgreSQL connector docs at https://debezium.io/documentation/reference/stable/connectors/postgresql.html, Outbox Event Router docs at https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html, and the Debezium tutorial at https://debezium.io/documentation/reference/stable/tutorial.html. Study Transactional Outbox, Write-Ahead Log, Kafka Log Case Study, Idempotency, Message Queue, and Schema Evolution next.',
      ],
    },
  ],
};
