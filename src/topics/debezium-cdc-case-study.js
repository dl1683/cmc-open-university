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
        'The log-to-stream view traces a database commit through the full CDC pipeline. Active nodes show where data is moving right now. Found markers show state that is guaranteed true: a committed WAL record, a published Kafka event, a stored offset.',
        'The outbox view focuses on transaction boundaries. Watch for the moment when the domain row and the outbox row commit together -- that atomic pair is the safety property CDC relies on.',
        'At each frame, ask: what committed, what got published, and what happens if the connector crashes between those two events.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Applications rarely write to a single database and stop. Orders need search indexes updated, caches invalidated, analytics tables fed, and downstream services notified. Every one of those side effects must follow the committed database state -- not precede it, not duplicate it, not miss it.',
        'The straightforward solution is for every code path that writes the database to also publish an event. This is the dual-write pattern: one transaction to the database, one publish to Kafka or a queue, hope they both succeed. It works in the happy path. It breaks under crashes, rollbacks, bulk SQL, and maintenance scripts.',
        'CDC exists because the database already records committed changes in a durable, ordered log. PostgreSQL calls it the WAL (write-ahead log). MySQL calls it the binlog. These logs exist for crash recovery and replication. CDC reuses that same source to feed downstream systems, replacing fragile dual writes with a single pipeline anchored to committed truth.',
        {type:'callout', text:'Debezium is reliable because it moves the event boundary to the database commit log, leaving consumers to handle replay, schema evolution, and idempotency explicitly.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is application-level event publishing. After inserting an order, the service publishes an OrderCreated event to Kafka. This works for a single service with a few write paths. Teams reach for it because it is simple, direct, and requires no new infrastructure.',
        'The approach holds as long as every writer remembers to publish, every publish succeeds, and no crash lands between the database commit and the event send. In practice, that set of conditions breaks quickly. A DBA runs an UPDATE across 10,000 rows. A migration script backfills a column. A transaction rolls back after the event was already sent. A deploy crashes between commit and publish, and the event is silently lost.',
        'Application-level publishing fails because it distributes the responsibility for event emission across every code path that touches the database. Miss one path and downstream systems silently diverge.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between "the database committed" and "the event was sent." No amount of careful coding closes that gap entirely, because the database and the message broker are two separate systems. A crash between the two operations either loses the event (data loss) or sends an event for a rolled-back transaction (phantom event).',
        'Dual writes also cannot capture changes made outside the application: bulk SQL, manual fixes, migration scripts, and replication followers all modify rows without hitting the application event-publishing code. The database log captures all of them because every committed transaction passes through it, regardless of what initiated the write.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The database log is already the ordered, durable, complete record of every committed change. CDC treats the log as a stream source: a connector tails the log, decodes each row-level change, and publishes it as an event with enough metadata for downstream systems to process, deduplicate, and resume.',
        'This shifts the reliability boundary. Instead of trusting N application write paths to each remember to publish, one connector reads one log. Missed events are structurally impossible as long as the connector keeps up with the log and records its position.',
        'CDC does not deliver exactly-once semantics end-to-end. It anchors the capture side to committed facts. The rest of the pipeline -- delivery, ordering scope, consumer idempotency -- still needs deliberate design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A transaction commits to the database. The database engine appends the change to its WAL (PostgreSQL) or binlog (MySQL). Debezium, running as a Kafka Connect connector, connects to the database using its native replication protocol -- the same protocol a read replica would use.',
        'The connector reads the log, decodes each change using the current table schema, and wraps it in a change-event envelope. The envelope contains the event key (typically the primary key, used for Kafka partitioning), the before image (the row before the change, where the database supports it), the after image (the row after the change), the operation type (c for create, u for update, d for delete, r for snapshot read), and source metadata including the database name, table, log position (LSN or binlog file/offset), and server timestamp.',
        'Debezium publishes each event to a Kafka topic named by convention: server.schema.table. The connector periodically flushes its current log position to an offset store (a Kafka topic or file). After a crash, it resumes from the last committed offset.',
        'Initial data capture works through snapshotting. The connector locks the table briefly (or uses a consistent snapshot), reads all existing rows as "r" (read) events, records the log position at snapshot time, then switches to streaming mode from that position. The handoff must be gapless: no row missed, no row duplicated in a way consumers cannot handle.',
        'Schema history is tracked separately. As tables evolve (columns added, types changed), the connector records DDL changes so it can decode log records written under older schemas. Without schema history, a column rename or type change silently corrupts decoded events.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'CDC correctness rests on a single property: the database log contains exactly the committed changes, in commit order. If a transaction commits, the log has it. If a transaction rolls back, the log does not. This makes the log a reliable event source that no application-level dual write can match.',
        'Offset tracking makes the pipeline recoverable. After a crash, the connector resumes from its last checkpointed position. It may re-read and re-publish some events (at-least-once delivery), but it will not skip committed changes. Consumers handle duplicates through idempotency keys, typically the event key plus the source log position.',
        'The transactional outbox pattern strengthens this further. Instead of publishing raw table changes, the application writes an intentional event row into an outbox table within the same database transaction as the business change. Debezium captures the committed outbox row and routes it to the appropriate Kafka topic. The atomicity guarantee comes from the local database transaction -- no distributed transaction needed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CDC adds infrastructure: a Kafka Connect cluster, connector configuration, offset storage, schema history storage, and monitoring for lag and failures. The connector consumes database replication slots, which hold WAL segments on disk until the connector catches up. A stalled connector can cause WAL bloat and eventually disk pressure on the database.',
        'Ordering scope is narrower than it appears. The database log has global commit order, but Kafka partitions events by key. Two events for different keys may land on different partitions and arrive at consumers in a different order than they committed. Per-aggregate ordering requires routing all events for one aggregate to the same partition key.',
        'Latency is typically sub-second for streaming mode, but snapshot mode can take hours for large tables. Backfills, re-snapshots, and topic replays are separate operational procedures with different blast radii. Each must be planned before an incident, not during one.',
        'Schema changes are the most common production incident. Adding a column is safe. Renaming or removing a column breaks consumers that depend on the old name. Schema governance -- compatibility checks, versioned subjects in a schema registry -- is not optional for any CDC pipeline that outlives its first quarter.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Search indexing: an Elasticsearch consumer reads CDC events from the orders table and updates the search index. Every committed row change, including bulk SQL updates, appears in the stream. The consumer re-indexes idempotently by primary key.',
        'Cache invalidation: a Redis consumer reads CDC events and deletes the corresponding cache entry on every update or delete. This replaces TTL-based expiration with commit-driven invalidation, closing the window where stale cached data serves requests.',
        'Microservice integration via the outbox pattern: an order service writes an OrderPlaced event to its outbox table in the same transaction as the order insert. Debezium publishes the outbox row to an orders.events topic. A shipping service consumes the event and creates a shipment. The outbox pattern is the standard production shape for reliable cross-service events.',
        'Analytics and data lake feeds: a data pipeline consumes CDC events and appends them as facts to a data lake. Because CDC captures every committed change including deletes, the lake can reconstruct point-in-time state without polling the source database.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'CDC does not remove the need for consumer idempotency. At-least-once delivery means every consumer must tolerate replayed events. If your consumer sends an email on every OrderPaid event without deduplication, connector restarts will send duplicate emails.',
        'Raw table CDC leaks internal schema. If you publish the customers table as-is, every downstream consumer now depends on your column names, types, and nullability. Adding a column is fine; renaming one breaks consumers. The outbox pattern exists partly to publish intentional, versioned events rather than internal table structure.',
        'CDC is the wrong tool for derived domain events that do not map to row changes. "Customer became high-value" is a computed fact that spans multiple tables and business rules. Publishing it as a CDC event from a single table either misrepresents it or requires contorting the schema to fit.',
        'Replication slot management is an operational hazard. A stalled or deleted connector leaves a replication slot active, preventing the database from reclaiming WAL segments. On PostgreSQL, this can fill the disk and crash the primary. Monitoring replication slot lag is as important as monitoring the application itself.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An order service receives a payment confirmation for order 42. In a single database transaction, it executes two SQL statements: UPDATE orders SET status = \'paid\' WHERE id = 42, and INSERT INTO outbox (event_id, aggregate_type, aggregate_id, type, payload) VALUES (\'E7\', \'Order\', 42, \'OrderPaid\', \'{"orderId":42,"amount":99.00}\').',
        'The database commits both statements atomically. PostgreSQL appends both changes to the WAL at LSN 0/1A3B4C0.',
        'Debezium, connected as a logical replication client, reads the WAL. It sees the outbox insert for event_id E7. The outbox event router transformation extracts the aggregate_type ("Order"), aggregate_id (42), and event type ("OrderPaid"), then publishes the payload to a Kafka topic named orders.events, keyed by aggregate_id 42. The connector flushes its offset: LSN 0/1A3B4C0.',
        'A payment-notification consumer reads the event from orders.events. Before sending the confirmation email, it checks its processed-events table for event_id E7. The ID is absent, so it inserts E7, sends the email, and commits. If the connector had crashed before flushing its offset and replayed E7, the consumer would find E7 already in its processed-events table and skip the duplicate.',
        'The key safety chain: database transaction guarantees atomicity of the order update and outbox insert. The WAL guarantees durability and ordering. The connector guarantees eventual delivery. The consumer idempotency key guarantees no duplicate side effects. Each link handles one failure mode.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Debezium architecture overview at debezium.io/documentation/reference/stable/architecture.html describes the connector-Kafka Connect-Kafka pipeline. The MySQL connector docs (debezium.io/documentation/reference/stable/connectors/mysql.html) and PostgreSQL connector docs (debezium.io/documentation/reference/stable/connectors/postgresql.html) cover log-reading mechanics, snapshot modes, and offset management. The Outbox Event Router docs (debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) cover the outbox pattern integration.',
        'Prerequisite: study Write-Ahead Log to understand why the database log is durable and ordered. Study Kafka Log Case Study to understand how Kafka partitions, offsets, and consumer groups work downstream of CDC.',
        'Extensions: study Transactional Outbox for the pattern that makes CDC events intentional rather than raw table leaks. Study Idempotency for the consumer-side contract that makes at-least-once delivery safe. Study Message Queue for the broader family of asynchronous messaging patterns that CDC feeds into.',
        'Contrasting alternative: polling-based CDC (query the database on a timer for changed rows) avoids replication protocol complexity but misses deletes, reorders concurrent updates, and adds load to the source database. Log-based CDC is strictly more reliable when the database supports it.',
      ],
    },
  ],
};
