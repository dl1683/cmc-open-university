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
      heading: 'Why this exists',
      paragraphs: [
        'A service often has to change local state and tell the rest of the system what happened. An order service creates an order and inventory needs to reserve stock. A billing service records a charge and email needs to send a receipt. The database update and the message are part of one business fact, but they usually live in two different systems.',
        'The transactional outbox exists because that split creates a crash window. If the service commits the database row and dies before publishing the event, downstream systems never hear about a real change. If it publishes first and the database transaction rolls back, downstream systems react to a change that never existed.',
        'The pattern is not mainly about cleaner code. It is about choosing one durable source of truth for the decision that an event should exist. Once the event intent is a database row, a later worker can retry publication without asking the original request handler to still be alive.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The obvious approach is a dual write: update the database, then publish to Kafka, RabbitMQ, SNS, or another broker. Retrying the publish makes the happy path more reliable, but it does not remove the moment between database commit and broker acknowledgement.',
        'Publishing before the commit has the opposite bug. A consumer can observe an event for a transaction that later aborts. Wrapping the database and broker in a distributed transaction is often unavailable, operationally heavy, or not worth the coupling. The wall is simple: there is no single durable decision record shared by the database and the broker.',
        'Timeouts make the wall worse. The service may not know whether a broker publish succeeded, whether the broker accepted the event but the acknowledgement was lost, or whether the database commit completed after the client disconnected. Without a durable outbox row, retries can create either missing events or duplicates with no stable dedupe key.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Put the message intent in the same database transaction as the business change. The service writes the order row and an outbox row together. If the transaction commits, both records are durable. If it rolls back, neither record exists.',
        'The broker publish becomes a consequence of committed state, not a second decision made in the request path. A relay or CDC connector can publish later, retry after crashes, and resume from durable database state. The pattern does not create global exactly-once delivery. It makes the event recoverable from the same commit that made the business fact true.',
        'The invariant is local atomicity: for every committed business change that should emit an event, a committed outbox row exists in the same database. Publication may lag, repeat, or fail temporarily, but it is no longer lost when the request process dies.',
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'In the dual-write failure view, the matrix shows the four crash windows a service creates when it treats database state and event publication as separate effects. The broken cells are not rare corner cases. They are exactly what happens when a process dies, a network call times out, or a broker acknowledgement is lost.',
        'In the outbox CDC view, the graph shows the durable handoff: command handler, database transaction, domain table, outbox table, relay, broker, consumer. The important boundary is the database commit. Everything before that is atomic local state. Everything after that is asynchronous delivery that must tolerate retries.',
        'The consumer node is marked idempotent for a reason. The outbox removes the lost-event gap, but the relay can still publish the same event more than once after a retry or restart. Safe consumers are part of the design.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A command handler starts a database transaction, validates the command, updates domain tables, inserts an outbox row, and commits. The outbox row is a message envelope: event id, aggregate type, aggregate id, event type, schema version, payload, creation time, and often a sequence number.',
        'A relay publishes committed rows. It can be a polling worker that selects unpublished rows in batches, or a CDC pipeline that reads the database log and turns outbox inserts into broker records. The aggregate id is commonly used as the broker key so all events for one order, account, or invoice land in the same partition.',
        'Consumers must assume at-least-once delivery. They dedupe by event id, use idempotent writes, and keep enough state to recover from repeated messages. The outbox prevents lost events; it does not make every downstream side effect magically safe.',
        'Polling relays usually mark rows as published, reserve rows with skip-locked queries, or move rows through states such as pending, publishing, published, and failed. CDC relays usually avoid polling locks by reading the database log, but they add connector operations, offset management, and transformation rules.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The database is already good at one thing this problem needs: making a local transaction durable or making it disappear. By storing event intent inside that transaction, the outbox borrows the database commit protocol instead of inventing a new one.',
        'Crash cases become recoverable. If the service dies before commit, there is no order and no outbox row. If it dies after commit, the relay can still find the outbox row. If the relay publishes and crashes before marking the row complete, it may publish again, which is why consumer idempotency is part of the pattern rather than an optional polish.',
        'Ordering also becomes reasoned rather than hoped for. If rows carry an aggregate id and sequence number, consumers can detect gaps, ignore older duplicates, and apply updates in the order that matters for that aggregate. The pattern does not promise one total order for the entire company.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'Treat the outbox as a production queue that happens to live in the service database. Monitor oldest unpublished row age, publish lag, row growth, retry counts, dead-letter volume, connector offsets, and consumer dedupe hits.',
        'Keep retention explicit. Rows may be deleted after a safe publish window, archived for audit, or compacted into a separate history table. Leaving every published row forever can turn an integration pattern into a database bloat problem.',
        'Make event schemas boring and versioned. Include an event id, event type, aggregate id, schema version, and creation time. Prefer facts that consumers need over leaking internal table shapes that will make future migrations harder.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A checkout request creates order 721. Inside one transaction, the service inserts the order, records the initial payment state, and inserts an outbox row with event id evt-991, aggregate id order-721, type OrderPlaced, schema version 3, and a payload containing the order facts consumers need.',
        'The request can return once the transaction commits. A Debezium connector or relay sees the committed outbox row and publishes OrderPlaced to the broker with order-721 as the key. Inventory reserves stock, email sends a confirmation, billing starts payment capture, and analytics updates a projection. If email receives evt-991 twice, it records that event id and avoids sending a duplicate receipt.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The pattern adds a table, relay, retry policy, retention policy, schema contract, monitoring, and consumer dedupe. It also adds latency: downstream work happens after the local commit, not inside the request transaction.',
        'Ordering is scoped. Per-aggregate ordering is practical with aggregate ids, sequence numbers, and broker partitions. Global ordering across every event is usually unnecessary and expensive. Backpressure also moves: if the broker is down, the outbox grows and the database now carries a queue-like workload.',
        'The payload design has a cost as well. A small event that only carries ids forces consumers to call back into the service, which can create coupling and thundering herds. A large event can become stale or expose data that subscribers should not need. The right envelope depends on the read models and privacy boundaries.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Transactional outbox wins when one service owns a local database but other services need to react after commit. It fits order management, payments, inventory, audit streams, CQRS projections, cache invalidation, search indexing, and Saga Pattern steps.',
        'It is especially useful when the database is the authoritative record and the broker is the distribution mechanism. The service does not need to block on every downstream system, and downstream systems can rebuild state by replaying events.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat it as exactly-once magic. Non-idempotent consumers can still charge twice, send duplicate emails, or corrupt projections. Bad schema evolution can still break subscribers. A relay with no lag alerts can silently stop publishing.',
        'It is also the wrong shape for a synchronous invariant that must be confirmed before commit. If the order cannot be accepted unless an external service has already guaranteed stock, the outbox is not a substitute for that reservation protocol. It is a reliable notification pattern, not a universal distributed transaction.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Debezium Outbox Event Router documentation at https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html and Confluent EventRouter SMT docs at https://docs.confluent.io/kafka-connectors/transforms/current/eventrouter.html. Study Idempotency Keys, Saga Pattern, Kafka Log Case Study, Message Queue, and Write-Ahead Log next.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Transactional Outbox moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
