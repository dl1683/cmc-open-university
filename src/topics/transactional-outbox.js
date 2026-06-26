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
  const crashScenarios = 4;
  const dualWriteColumns = 2;
  const outboxFields = 4;
  const solvedCount = 2;
  const unsolvedCount = 2;
  const graphNodeCount = 7;
  const graphEdgeCount = 6;

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
    explanation: `A service often needs to update its database and publish an event. If those are ${dualWriteColumns} independent writes, every crash point across ${crashScenarios} scenarios can create inconsistency.`,
  };

  yield {
    state: outboxGraph('Put business change and event intent in one transaction'),
    highlight: { active: ['service', 'db', 'order', 'outbox', 'e-service-db', 'e-db-order', 'e-db-outbox'], compare: ['broker'] },
    explanation: `The outbox pattern moves the event publish intent into the same database transaction as the business change. Across ${graphNodeCount} components linked by ${graphEdgeCount} edges, commit once: either both order row and event row exist, or neither exists.`,
    invariant: `Atomicity is borrowed from the local database transaction — ${dualWriteColumns} writes collapsed into 1 commit.`,
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
    explanation: `The event row is a durable message envelope with ${outboxFields} fields. It should carry an idempotency key, aggregate identity, type, timestamp, and payload so downstream consumers can process safely.`,
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
    explanation: `The outbox fixes the dual-write gap: ${solvedCount} concerns solved, ${unsolvedCount} remain. It does not remove at-least-once delivery, consumer deduplication, ordering decisions, or schema compatibility work.`,
  };
}

function* outboxCdc() {
  const relayDesigns = 4;
  const consumerReqs = 4;
  const neighborPatterns = 4;
  const cdcPipelineSteps = 3;
  const neighborColumns = 2;

  yield {
    state: outboxGraph('CDC turns committed outbox rows into broker events'),
    highlight: { active: ['outbox', 'cdc', 'broker', 'e-outbox-cdc', 'e-cdc-broker'], found: ['consumer'] },
    explanation: `A CDC connector such as Debezium tails the database log across ${cdcPipelineSteps} pipeline stages (outbox, relay, broker), sees committed outbox rows, transforms them into event records, and publishes them to Kafka.`,
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
    explanation: `Among ${relayDesigns} relay designs, CDC is popular because the database log already records committed order. Pollers can work too, but need careful locking, batching, and retry behavior.`,
    invariant: `Publish order should follow committed database order for the aggregate — ${relayDesigns} designs each handle this differently when consumers rely on ordering.`,
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
    explanation: `Outbox events are normally delivered at least once. Downstream services must satisfy ${consumerReqs} requirements — dedupe by event id and design handlers so repeated delivery is safe.`,
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
    explanation: `The transactional outbox is a small pattern with large consequences: ${neighborPatterns} related patterns across ${neighborColumns} dimensions show it replaces hope between services with a durable, replayable handoff.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The dual-write view shows two effects that a service wants to treat as one business fact: a database change and a message publish. Broken cells mark crash windows where one effect happened and the other did not.',
        'The outbox view moves the event intent into the same database transaction as the business row. The database commit is the boundary: before it, the change is local and atomic; after it, publication is asynchronous and must tolerate retries.',
        'Read the consumer node as part of the design, not an afterthought. The outbox prevents lost events, but relays can publish duplicates, so consumers still need idempotency, which means repeated delivery has the same final effect as one delivery.',
        {type: 'image', src: './assets/gifs/transactional-outbox.gif', alt: 'Animated walkthrough of the transactional outbox visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A service often has to update its own database and tell other services what happened. An order service creates an order, then inventory, email, billing, search, and analytics need the fact.',
        {
          type: 'callout',
          text: 'The outbox turns a two-system promise into one durable local commit plus retryable delivery.',
        },
        'The problem is that the database and the broker do not share a normal local transaction. If the database commits but the publish is lost, downstream systems stay blind; if the publish succeeds but the database rolls back, downstream systems react to a lie.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a dual write: commit the database change, then publish to Kafka, RabbitMQ, SNS, or another broker. Retrying the publish seems enough because the happy path succeeds most of the time.',
        'Publishing before the commit only moves the bug. A consumer can observe an event for a transaction that later aborts, and a timeout may leave the service unsure whether the broker accepted the message.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between two durable systems. There is no single record that says both the business state and the event intent became true together.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching diagram showing packets moving through a network', caption: 'A broker publish is a network effect, so the service must survive lost acknowledgements, retries, and reordered delivery. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.' },
        'Distributed transactions can close the gap in theory, but many brokers and databases do not support the required protocol in the needed shape. Even when they do, coupling every business write to a cross-system commit can be too expensive and fragile.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Store event intent as a row in the same database transaction as the business change. If the transaction commits, both the order row and the outbox row exist; if it rolls back, neither exists.',
        'The broker publish becomes a retryable consequence of committed state rather than a second decision made while the request handler is alive. A relay can crash, restart, scan or tail committed rows, and continue publishing from the database.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The command handler begins a transaction, validates the command, updates domain tables, inserts an outbox row, and commits. The outbox row usually stores event id, aggregate id, event type, schema version, creation time, payload, and sometimes a sequence number.',
        'A relay publishes committed rows. It may poll pending rows with locking, or a change data capture connector may read the database log and convert outbox inserts into broker records.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is local atomicity: every committed business change that should emit an event has a committed outbox row in the same database. A crash before commit leaves neither row; a crash after commit leaves enough durable state for the relay to recover.',
        'The pattern does not prove exactly-once side effects. If the relay publishes and crashes before marking the row complete, it may publish again, so correctness depends on consumers deduping by event id or making repeated processing harmless.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The outbox adds a table, a relay or CDC connector, retry policy, retention policy, schema contract, lag monitoring, and consumer dedupe. It also adds delivery latency because downstream work happens after the local commit.',
        'Cost shows up as behavior under failure. If the broker is down for 30 minutes and the service writes 10,000 events per minute, the outbox grows by 300,000 rows and the relay must later drain that backlog without crushing the database.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The pattern fits event-driven services where one database owns the truth and other systems need to react after commit. Order management, payments, audit streams, CQRS projections, cache invalidation, and Saga steps commonly use it.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Apache_Kafka_logo.svg/120px-Apache_Kafka_logo.svg.png', alt: 'Apache Kafka project logo', caption: 'Kafka is a common destination for outbox relays because it provides durable partitioned event streams. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Apache_Kafka_logo.svg.' },
        'It is strongest when the broker is a distribution mechanism, not the source of truth. Consumers can rebuild projections from events, and the service can return to the user without waiting for every downstream system.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat it as exactly-once magic. Non-idempotent consumers can still charge twice, send duplicate emails, or corrupt read models after duplicate delivery.',
        'It is also wrong for a synchronous invariant that must be confirmed before commit. If an order cannot be accepted unless an external inventory service has already reserved stock, the outbox is a notification pattern, not a reservation protocol.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout request creates order 721. In one transaction, the service inserts order 721, inserts payment state pending, and inserts outbox event evt-991 with aggregate id order-721 and type OrderPlaced.',
        'The request returns after commit. A CDC relay publishes evt-991 to Kafka with key order-721; inventory, email, and analytics consume it. If email receives evt-991 twice after a relay retry, it records the event id and sends one receipt.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Debezium Outbox Event Router documentation and Confluent EventRouter SMT documentation for production CDC forms. The pattern also appears in microservice design texts under transactional outbox, reliable publication, and event-driven consistency.',
        'Study idempotency keys, Saga pattern, Kafka log, write-ahead log, and change data capture next. Those topics explain the consumer, workflow, durable log, and replay pieces that make the outbox safe in practice.',
      ],
    },
  ],
};
