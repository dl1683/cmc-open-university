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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as one committed database change moving through a capture pipeline. CDC means change data capture: recording database changes as events for downstream systems. Active nodes show the current handoff, found nodes show committed facts such as a WAL record, Kafka event, or stored offset, and failure frames show where replay must be safe.',
        'The safe inference rule is commit before publish. A row change is eligible for downstream event processing only after the database commit log records it. If the connector crashes after reading but before flushing its offset, replay may duplicate the event, so consumers must be idempotent.',
        {type:'callout', text:'Debezium is reliable because it moves the event boundary to the database commit log, leaving consumers to handle replay, schema evolution, and idempotency explicitly.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Applications rarely write a database and stop. Orders need search indexes updated, caches invalidated, analytics fed, and other services notified. Those side effects must follow committed database truth, not a hopeful application path.',
        'Debezium exists because databases already maintain durable ordered logs for recovery and replication. PostgreSQL has the WAL, or write-ahead log, and MySQL has the binlog. Log-based CDC reuses that commit record as the source of events.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a dual write. After inserting or updating a row, the application publishes an event to Kafka or another broker. For one service and one write path, this feels direct and easy to reason about.',
        'Teams often patch dual writes with retries. If the publish fails, retry it; if the database write fails, do not publish. The patch still leaves a gap because the database and broker are separate systems with separate failure points.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the crash window between commit and publish. If the database commits and the process dies before sending the event, downstream systems miss a real change. If the event is sent before the transaction rolls back, downstream systems see a phantom change.',
        'Dual writes also miss changes outside the application. A bulk SQL update, migration script, manual fix, or maintenance job can change rows without running event-publishing code. The database log captures those changes because every committed transaction passes through it.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Move the event boundary to the database commit log. A Debezium connector tails the log through the database replication protocol, decodes committed row changes, and publishes change events with source metadata. One connector reading one durable log replaces many application code paths that might forget to publish.',
        'This does not create end-to-end exactly-once behavior. It gives the capture side a reliable source of committed facts. Delivery, partition ordering, schema compatibility, and side-effect deduplication remain explicit downstream responsibilities.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A transaction commits, and the database appends its row changes to the WAL or binlog. Debezium runs as a Kafka Connect connector and reads that log using native replication mechanisms. It tracks a log position such as a PostgreSQL LSN or a MySQL binlog file and offset.',
        'For each row change, Debezium emits an envelope with a key, operation type, before image when available, after image, source database, table, timestamp, and log position. Kafka partitions events by key, which usually means primary key or aggregate id. The connector periodically stores offsets so it can resume after a crash.',
        'Initial capture uses a snapshot. The connector reads existing rows at a consistent point, records the log position for that point, and then streams changes from that position. Schema history is stored separately so old log records can be decoded even after table definitions change.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument starts with the database log. If a transaction commits, the log contains it; if it rolls back, the committed-change stream does not expose it as a committed row change. That makes the log a stronger event source than application callbacks.',
        'Offset tracking gives recoverability. After a crash, the connector resumes from the last flushed position and may re-emit events near the boundary. At-least-once delivery is safe only when consumers use idempotency keys such as event id, primary key plus log position, or outbox event id.',
        'The transactional outbox pattern strengthens semantics. The application writes an intentional event row into an outbox table in the same database transaction as the business change. Debezium then publishes the committed outbox row, so local database atomicity replaces a distributed transaction.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CDC adds Kafka Connect workers, connector configuration, offset storage, schema history storage, monitoring, and replay procedures. A stalled PostgreSQL connector can hold a replication slot open and prevent WAL cleanup. That can fill disk on the primary, so connector lag is a database safety metric, not just a pipeline metric.',
        'Ordering cost is subtle. The database log has commit order, but Kafka preserves order only within a partition. Events for different keys can be processed in different orders, so any invariant that spans keys needs a separate design.',
        'Snapshot cost can dominate startup. A 1 TB table may take hours to snapshot, and the connector must bridge from snapshot to streaming without missing changes. Backfills, re-snapshots, topic replays, and schema changes need runbooks before production incidents.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Search indexing is a common fit. A consumer reads order or product changes and updates Elasticsearch or OpenSearch by primary key. Bulk SQL updates are captured because the database log, not application event code, is the source.',
        'Cache invalidation is another fit. A consumer reads update and delete events and removes Redis entries keyed by the changed row. This closes the stale-cache window faster than waiting for time-to-live expiration.',
        'The outbox pattern is the production shape for cross-service domain events. An order service writes OrderPaid to an outbox row, Debezium routes it to an orders.events topic, and downstream services process it with deduplication. Analytics and lakehouse pipelines also use CDC to reconstruct point-in-time table state.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CDC fails when consumers are not idempotent. Connector restarts, offset flush timing, and broker retries can replay events. A consumer that sends an email for every OrderPaid event without a processed-event table will send duplicates.',
        'Raw table CDC also leaks internal schema. Downstream consumers become tied to column names, nullability, and table shape. Intentional outbox events reduce that coupling by publishing a versioned domain event instead of every internal row change.',
        'CDC is the wrong tool for derived facts that do not map to one row change. CustomerBecameHighValue may depend on multiple tables, time windows, and business rules. That event should be computed intentionally rather than inferred from one table log record.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An order service marks order 42 as paid and writes an outbox row in the same transaction. The outbox row has event_id E7, aggregate_id 42, type OrderPaid, and amount 99.00. PostgreSQL commits both changes at log sequence number 0/1A3B4C0.',
        'Debezium reads the WAL and sees the outbox insert. The outbox router publishes the payload to orders.events with Kafka key 42 and stores the latest flushed LSN. If the connector crashes before the flush, it may publish E7 again after restart.',
        'The email consumer checks a processed_events table before sending. E7 is absent, so it inserts E7, sends the email, and commits. On replay, E7 is present and the consumer skips the side effect, so at-least-once delivery does not become duplicate email.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the Debezium architecture overview at https://debezium.io/documentation/reference/stable/architecture.html, PostgreSQL connector docs at https://debezium.io/documentation/reference/stable/connectors/postgresql.html, MySQL connector docs at https://debezium.io/documentation/reference/stable/connectors/mysql.html, and Outbox Event Router docs at https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html. Then study write-ahead logs, Kafka logs and partitions, idempotency, transactional outbox, schema registry compatibility, and polling-based CDC as a contrast.',
      ],
    },
  ],
};
