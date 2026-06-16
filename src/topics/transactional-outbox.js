// Transactional outbox: write business state and event intent in one database
// transaction, then publish asynchronously via CDC or a relay.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'transactional-outbox',
  title: 'Transactional Outbox',
  category: 'Systems',
  summary: 'Avoid dual-write bugs by committing business rows and event rows together, then publishing events with CDC and idempotent consumers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['dual-write failure', 'outbox CDC'], defaultValue: 'dual-write failure' },
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

function outboxGraph(title) {
  return graphState({
    nodes: [
      { id: 'service', label: 'order service', x: 0.7, y: 3.8, note: 'handles command' },
      { id: 'db', label: 'database tx', x: 2.8, y: 3.8, note: 'atomic write' },
      { id: 'order', label: 'orders table', x: 4.7, y: 2.4, note: 'business state' },
      { id: 'outbox', label: 'outbox table', x: 4.7, y: 5.2, note: 'event intent' },
      { id: 'cdc', label: 'CDC relay', x: 6.7, y: 5.2, note: 'Debezium/poller' },
      { id: 'broker', label: 'Kafka topic', x: 8.4, y: 5.2, note: 'event stream' },
      { id: 'consumer', label: 'consumer', x: 9.4, y: 3.2, note: 'idempotent' },
    ],
    edges: [
      { id: 'e-service-db', from: 'service', to: 'db', weight: 'begin tx' },
      { id: 'e-db-order', from: 'db', to: 'order', weight: 'insert/update' },
      { id: 'e-db-outbox', from: 'db', to: 'outbox', weight: 'insert event row' },
      { id: 'e-outbox-cdc', from: 'outbox', to: 'cdc', weight: 'change capture' },
      { id: 'e-cdc-broker', from: 'cdc', to: 'broker', weight: 'publish' },
      { id: 'e-broker-consumer', from: 'broker', to: 'consumer', weight: 'consume' },
    ],
  }, { title });
}

function* dualWriteFailure() {
  yield {
    state: labelMatrix(
      'The dual-write trap',
      [
        { id: 'dbfirst', label: 'DB commit succeeds' },
        { id: 'publishfail', label: 'publish fails' },
        { id: 'publishfirst', label: 'publish succeeds' },
        { id: 'dbfail', label: 'DB commit fails' },
      ],
      [
        { id: 'state', label: 'business state' },
        { id: 'event', label: 'event stream' },
      ],
      [
        ['order exists', 'no event'],
        ['order exists', 'downstream blind'],
        ['event exists', 'order missing'],
        ['rollback', 'downstream lied to'],
      ],
    ),
    highlight: { active: ['dbfirst:event', 'publishfirst:state'], removed: ['publishfail:event', 'dbfail:state'] },
    explanation: 'A service often needs to update its database and publish an event. If those are two independent writes, every crash point can create inconsistency.',
  };

  yield {
    state: outboxGraph('Put business change and event intent in one transaction'),
    highlight: { active: ['service', 'db', 'order', 'outbox', 'e-service-db', 'e-db-order', 'e-db-outbox'], compare: ['broker'] },
    explanation: 'The outbox pattern moves the event publish intent into the same database transaction as the business change. Commit once: either both order row and event row exist, or neither exists.',
    invariant: 'Atomicity is borrowed from the local database transaction.',
  };

  yield {
    state: labelMatrix(
      'What the outbox row contains',
      [
        { id: 'id', label: 'event id' },
        { id: 'aggregate', label: 'aggregate id' },
        { id: 'type', label: 'event type' },
        { id: 'payload', label: 'payload' },
      ],
      [
        { id: 'purpose', label: 'purpose' },
        { id: 'consumer', label: 'consumer use' },
      ],
      [
        ['dedupe key', 'idempotency'],
        ['ordering key', 'partitioning'],
        ['routing', 'topic or handler'],
        ['business facts', 'state update'],
      ],
    ),
    highlight: { found: ['id:consumer', 'aggregate:consumer', 'type:purpose'] },
    explanation: 'The event row is a durable message envelope. It should carry an idempotency key, aggregate identity, type, timestamp, and payload so downstream consumers can process safely.',
  };

  yield {
    state: labelMatrix(
      'What this does and does not solve',
      [
        { id: 'atomic', label: 'atomic local write' },
        { id: 'publish', label: 'eventual publish' },
        { id: 'exactly', label: 'exactly-once effects' },
        { id: 'schema', label: 'schema evolution' },
      ],
      [
        { id: 'status', label: 'status' },
        { id: 'requirement', label: 'requirement' },
      ],
      [
        ['solved', 'same DB transaction'],
        ['solved eventually', 'relay or CDC'],
        ['not automatic', 'idempotent consumers'],
        ['not automatic', 'versioned payloads'],
      ],
    ),
    highlight: { found: ['atomic:status', 'publish:status'], compare: ['exactly:requirement', 'schema:requirement'] },
    explanation: 'The outbox fixes the dual-write gap. It does not remove at-least-once delivery, consumer deduplication, ordering decisions, or schema compatibility work.',
  };
}

function* outboxCdc() {
  yield {
    state: outboxGraph('CDC turns committed outbox rows into broker events'),
    highlight: { active: ['outbox', 'cdc', 'broker', 'e-outbox-cdc', 'e-cdc-broker'], found: ['consumer'] },
    explanation: 'A CDC connector such as Debezium tails the database log, sees committed outbox rows, transforms them into event records, and publishes them to Kafka.',
  };

  yield {
    state: labelMatrix(
      'Relay designs',
      [
        { id: 'poller', label: 'polling relay' },
        { id: 'cdc', label: 'CDC relay' },
        { id: 'trigger', label: 'DB trigger' },
        { id: 'brokerTx', label: 'broker transaction' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['simple app code', 'poll lag and locks'],
        ['uses DB log', 'connector ops'],
        ['near database', 'hidden logic'],
        ['atomic with broker', 'still not DB atomic'],
      ],
    ),
    highlight: { active: ['cdc:benefit'], compare: ['poller:risk', 'brokerTx:risk'] },
    explanation: 'CDC is popular because the database log already records committed order. Pollers can work too, but need careful locking, batching, and retry behavior.',
    invariant: 'Publish order should follow committed database order for the aggregate when consumers rely on ordering.',
  };

  yield {
    state: labelMatrix(
      'Consumer side requirements',
      [
        { id: 'dedupe', label: 'dedupe table' },
        { id: 'idempotent', label: 'idempotent handler' },
        { id: 'ordering', label: 'ordering key' },
        { id: 'replay', label: 'replay support' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'failure', label: 'failure if absent' },
      ],
      [
        ['at-least-once delivery', 'double effects'],
        ['safe retries', 'duplicate charges'],
        ['per aggregate sequence', 'out-of-order state'],
        ['rebuild projections', 'stuck after bug'],
      ],
    ),
    highlight: { found: ['dedupe:why', 'idempotent:why', 'ordering:why'], compare: ['replay:failure'] },
    explanation: 'Outbox events are normally delivered at least once. Downstream services must dedupe by event id and design handlers so repeated delivery is safe.',
  };

  yield {
    state: labelMatrix(
      'Pattern neighbors',
      [
        { id: 'saga', label: 'Saga Pattern' },
        { id: 'idempotency', label: 'Idempotency Keys' },
        { id: 'kafka', label: 'Kafka Log' },
        { id: 'wal', label: 'Write-Ahead Log' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['orchestrate multi-step workflows', 'events drive steps'],
        ['dedupe repeated commands/events', 'keys matter'],
        ['durable ordered stream', 'replayable facts'],
        ['commit before effect', 'crash recovery'],
      ],
    ),
    highlight: { found: ['saga:connection', 'idempotency:lesson', 'kafka:lesson', 'wal:lesson'] },
    explanation: 'The transactional outbox is a small pattern with large consequences: it replaces hope between services with a durable, replayable handoff.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'dual-write failure') yield* dualWriteFailure();
  else if (view === 'outbox CDC') yield* outboxCdc();
  else throw new InputError('Pick a transactional-outbox view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The transactional outbox pattern solves the dual-write problem between a service database and a message broker. Instead of updating business state and publishing an event as two independent operations, the service writes business rows and an outbox event row in the same database transaction.',
        'A relay or CDC connector later publishes the outbox row to Kafka or another broker. If the service crashes after commit, the event is still durable. If the transaction rolls back, no event exists.',
        'The pattern is about moving the reliability boundary. The database transaction becomes the source of truth for both the state change and the intent to publish. The broker is still asynchronous, but the event can no longer disappear in the gap between commit and publish.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A command handler begins a database transaction, updates domain tables, inserts an outbox row with event id and payload, and commits. A poller or CDC system reads committed outbox rows and publishes them. Consumers process events idempotently because delivery is at least once.',
        'Debezium support commonly uses the database transaction log. Its outbox event router can transform outbox rows into routed Kafka events, mapping fields such as aggregate type, aggregate id, event type, and payload.',
        'A robust event row usually carries an event id, aggregate type, aggregate id, event type, payload, schema version, and creation timestamp. The aggregate id often becomes the broker partitioning key so all events for one order, account, or invoice preserve order for that entity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The pattern adds a table, relay, retention policy, event schema, dedupe strategy, and operational monitoring. It guarantees atomic local persistence of event intent, not global exactly-once effects. Ordering must be designed around aggregate ids or broker partitions.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Transactional outbox is used in microservices, payment workflows, order management, inventory updates, audit streams, CQRS projections, and Saga Pattern implementations. It is one of the most practical ways to connect relational transactions to asynchronous event streams.',
        'A complete case study is order checkout. The service stores the order and an OrderPlaced event in one transaction. A CDC relay publishes the event. Inventory, email, billing, and analytics consumers each dedupe by event id. If the relay restarts or Kafka retries delivery, downstream side effects stay controlled.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not delete outbox rows before the relay has durably published them or before retention policy allows replay. Do not assume consumers see each event once. Do not put arbitrary side effects inside the database transaction. The outbox records intent; idempotent consumers complete the reliability story.',
        'The most common misconception is that the outbox gives global exactly-once behavior. It does not. It gives atomic local persistence of a publishable fact. Delivery can repeat, ordering can be per partition rather than global, and schema changes still need compatibility rules.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Debezium Outbox Event Router documentation at https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html and Confluent EventRouter SMT docs at https://docs.confluent.io/kafka-connectors/transforms/current/eventrouter.html. Study Idempotency Keys, Saga Pattern, Kafka Log Case Study, Message Queue, and Write-Ahead Log next.',
      ],
    },
  ],
};
