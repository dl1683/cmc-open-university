// NATS JetStream: streams, consumers, retention, acks, and replay.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'nats-jetstream-case-study',
  title: 'NATS JetStream Case Study',
  category: 'Systems',
  summary: 'JetStream adds persistence to NATS: streams store subject-matched messages, consumers track delivery and acknowledgments, and retention bounds replay history.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['streams consumers', 'retention replay'], defaultValue: 'streams consumers' },
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

function jetGraph(title) {
  return graphState({
    nodes: [
      { id: 'publisher', label: 'publisher', x: 0.8, y: 3.6, note: 'subject events.orders' },
      { id: 'stream', label: 'stream', x: 2.8, y: 3.6, note: 'message store' },
      { id: 'storage', label: 'file/memory storage', x: 4.7, y: 2.0, note: 'limits and replicas' },
      { id: 'retention', label: 'retention policy', x: 4.7, y: 5.2, note: 'limits/work/interest' },
      { id: 'consumerA', label: 'durable consumer', x: 7.0, y: 2.0, note: 'ack state' },
      { id: 'consumerB', label: 'pull consumer', x: 7.0, y: 5.2, note: 'fetch batches' },
      { id: 'worker', label: 'application worker', x: 9.0, y: 3.6, note: 'process and ack' },
    ],
    edges: [
      { id: 'e-pub-stream', from: 'publisher', to: 'stream', weight: 'publish ack' },
      { id: 'e-stream-storage', from: 'stream', to: 'storage', weight: 'persist' },
      { id: 'e-stream-retention', from: 'stream', to: 'retention', weight: 'expire' },
      { id: 'e-stream-a', from: 'stream', to: 'consumerA', weight: 'deliver view' },
      { id: 'e-stream-b', from: 'stream', to: 'consumerB', weight: 'deliver view' },
      { id: 'e-a-worker', from: 'consumerA', to: 'worker', weight: 'messages' },
      { id: 'e-b-worker', from: 'consumerB', to: 'worker', weight: 'fetch' },
    ],
  }, { title });
}

function* streamsConsumers() {
  yield {
    state: jetGraph('JetStream stores selected NATS subjects in streams'),
    highlight: { active: ['publisher', 'stream', 'storage', 'e-pub-stream', 'e-stream-storage'], compare: ['consumerA'] },
    explanation: 'JetStream is the persistence layer for NATS. A stream captures messages on configured subjects, stores them, and acknowledges durable publication to the producer.',
  };

  yield {
    state: labelMatrix(
      'Stream configuration knobs',
      [
        { id: 'subjects', label: 'subjects' },
        { id: 'storage', label: 'storage' },
        { id: 'replicas', label: 'replicas' },
        { id: 'limits', label: 'limits' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'effect' },
      ],
      [
        ['events.orders.*', 'captures matching publishes'],
        ['file or memory', 'durability versus latency'],
        ['1, 3, 5', 'availability and quorum cost'],
        ['age/bytes/messages', 'bounds history'],
      ],
    ),
    highlight: { found: ['subjects:effect', 'limits:effect'], active: ['replicas:effect'] },
    explanation: 'A stream is not just a topic name. It defines what subjects are captured, where messages live, how much history is retained, and how many replicas protect it.',
    invariant: 'Consumers are views over stream data; they do not own the stream itself.',
  };

  yield {
    state: jetGraph('Consumers track delivery and acknowledgments'),
    highlight: { active: ['consumerA', 'consumerB', 'worker', 'e-a-worker', 'e-b-worker'], found: ['stream'] },
    explanation: 'Consumers are durable or ephemeral views on a stream. They track delivery policy, acknowledgment policy, pending messages, redelivery, and filtering.',
  };

  yield {
    state: labelMatrix(
      'Consumer choices',
      [
        { id: 'push', label: 'push' },
        { id: 'pull', label: 'pull' },
        { id: 'durable', label: 'durable' },
        { id: 'ordered', label: 'ordered' },
      ],
      [
        { id: 'delivery', label: 'delivery' },
        { id: 'fit' },
      ],
      [
        ['server pushes', 'low-latency subscription'],
        ['client fetches', 'worker-controlled backpressure'],
        ['state survives reconnect', 'service processing'],
        ['gap detection', 'replay/read-only use'],
      ],
    ),
    highlight: { active: ['pull:fit', 'durable:fit'], compare: ['push:delivery'] },
    explanation: 'A worker pool usually wants pull or durable consumers so processing rate and redelivery behavior are explicit instead of hidden in subscriber callbacks.',
  };
}

function* retentionReplay() {
  yield {
    state: labelMatrix(
      'Retention policies',
      [
        { id: 'limits', label: 'limits' },
        { id: 'interest', label: 'interest' },
        { id: 'workqueue', label: 'work queue' },
        { id: 'discard', label: 'discard policy' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'risk' },
      ],
      [
        ['until size/age/count limit', 'slow consumers can miss old data'],
        ['while consumers need it', 'consumer state matters'],
        ['until one worker acks', 'load distribution semantics'],
        ['old or new messages', 'backpressure decision'],
      ],
    ),
    highlight: { found: ['limits:keeps', 'workqueue:keeps'], compare: ['discard:risk'] },
    explanation: 'Retention chooses what replay means. A stream can behave like a bounded event log, interest-retained feed, or work queue depending on policy.',
  };

  yield {
    state: jetGraph('Replay depends on stream history and consumer cursor'),
    highlight: { active: ['stream', 'retention', 'consumerA', 'worker', 'e-stream-retention', 'e-a-worker'], compare: ['publisher'] },
    explanation: 'A durable consumer can resume from its stored position as long as the stream still retains the needed messages. Retention and consumer lag must be monitored together.',
    invariant: 'Acknowledgment confirms processing to the consumer; retention determines whether old messages remain replayable.',
  };

  yield {
    state: labelMatrix(
      'Failure handling',
      [
        { id: 'publish', label: 'publish ack lost' },
        { id: 'worker', label: 'worker crash' },
        { id: 'redeliver', label: 'redelivery' },
        { id: 'dedupe', label: 'dedupe/idempotency' },
      ],
      [
        { id: 'mechanism', label: 'mechanism' },
        { id: 'lesson' },
      ],
      [
        ['producer may retry', 'use message IDs if needed'],
        ['message remains pending', 'ack after side effect'],
        ['consumer policy', 'duplicates possible'],
        ['application key', 'exact business effect needs design'],
      ],
    ),
    highlight: { active: ['worker:lesson', 'redeliver:lesson'], found: ['dedupe:lesson'] },
    explanation: 'JetStream gives persistence and redelivery tools, but the final business operation still needs idempotency or deduplication when retries happen.',
  };

  yield {
    state: labelMatrix(
      'Complete IoT telemetry case study',
      [
        { id: 'sensor', label: 'sensor publish' },
        { id: 'stream', label: 'telemetry stream' },
        { id: 'consumer', label: 'analytics consumer' },
        { id: 'archive', label: 'archive worker' },
      ],
      [
        { id: 'jetMove', label: 'JetStream move' },
        { id: 'lesson' },
      ],
      [
        ['subject telemetry.site.device', 'subject capture'],
        ['file storage plus age limit', 'bounded replay'],
        ['pull batches', 'backpressure controlled'],
        ['separate durable consumer', 'fan-out from one stream'],
      ],
    ),
    highlight: { found: ['stream:lesson', 'consumer:lesson', 'archive:lesson'], compare: ['sensor:jetMove'] },
    explanation: 'A single stream can support multiple consumer views: one real-time processor, one archiver, and one troubleshooting replay path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'streams consumers') yield* streamsConsumers();
  else if (view === 'retention replay') yield* retentionReplay();
  else throw new InputError('Pick a NATS JetStream view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Core NATS is a fast subject-based messaging system. It is excellent when services need low-latency publish/subscribe, request/reply, and simple message routing. But many systems need more than live delivery. They need persistence, replay, durable progress tracking, redelivery after worker crashes, bounded history, and a way to decouple publishers from slow consumers.',
        'JetStream adds that persistent layer. A stream captures messages published to configured subjects and stores them. Consumers are views over a stream: they track delivery position, acknowledgment state, filtering, redelivery policy, and whether that state survives reconnects.',
        'The educational value is that JetStream separates message address, stored history, consumer cursor, and business side effect. Confusing those layers leads to duplicate work, lost replay, slow-consumer incidents, or a system that behaves like a queue when the team expected a log.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to treat pub/sub as enough. A publisher emits an event, subscribers receive it, and the system moves on. That works only when subscribers are online, fast, and able to tolerate missed messages. It fails when consumers disconnect, workers crash after partial side effects, or teams need replay for debugging and backfills.',
        'Another obvious approach is to bolt a database table onto the side. That can work for simple outboxes, but it recreates a message broker poorly unless it handles ordering, retention, cursor state, redelivery, backpressure, filtering, and retention limits. JetStream gives those concerns explicit names and operational knobs.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that persistence is not one feature. It is a set of semantics. How long should messages be retained? Should a message disappear after one worker acknowledges it, after all interested consumers no longer need it, or only after age and size limits expire? Should the server push messages or should workers pull at their own rate?',
        'The second wall is failure timing. A worker may receive a message, perform a database write, and crash before acknowledging. JetStream can redeliver the message, but it cannot know whether the database side effect already happened unless the application uses idempotency, deduplication, or a transactional outbox pattern.',
        'The third wall is lag. A durable consumer can resume from its stored position only if the stream still retains the needed messages. Retention and consumer lag must be monitored together. A replay system without retained history is just a comforting name.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A stream owns stored message history. A consumer owns a delivery view over that history. The stream decides what subjects are captured, where messages live, how much history exists, and how many replicas protect it. The consumer decides where a particular application is in that history and what counts as successful processing.',
        'This separation lets one stream serve several purposes. One durable consumer can run real-time processing. Another can archive batches. A temporary ordered consumer can replay for debugging. Each consumer has its own cursor and delivery policy without duplicating the underlying stream data.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The streams-and-consumers view shows the main split. Publishers send to subject names. Stream configuration decides which messages are captured and how they are stored. Consumers are not the stream; they are delivery views with cursor and acknowledgment state.',
        'The retention-replay view shows why a stream can behave like different systems. Limits retention makes it resemble a bounded event log. Work-queue retention makes messages disappear after successful work. Interest retention keeps messages while consumers still need them. The configuration decides whether replay is a real capability or a short-lived buffer.',
        'The failure-handling view teaches the final boundary: an ack is a message-processing signal, not proof that an external business effect happened exactly once. JetStream can redeliver; your application must make retries safe.',
      ],
    },
    {
      heading: 'How streams work',
      paragraphs: [
        'A stream is configured with one or more subject patterns, such as events.orders.* or telemetry.site.*. When a matching message is published, JetStream stores it according to the stream configuration. That configuration includes file or memory storage, replicas, retention policy, discard policy, max age, max bytes, max message count, and sometimes deduplication windows.',
        'Storage choice changes the contract. Memory storage is fast but less durable. File storage gives persistence. Replicas improve availability but add quorum and write-latency cost. Limits bound history so one slow or forgotten consumer cannot grow storage forever.',
        'The stream is the shared source of truth for retained messages. Consumers do not own copies of the whole stream. They own positions and delivery state. This is the key mental model for avoiding accidental fan-out or accidental work-queue semantics.',
      ],
    },
    {
      heading: 'How consumers work',
      paragraphs: [
        'A consumer defines how messages are delivered from a stream. Push consumers let the server deliver to subscribers. Pull consumers let workers fetch batches, which makes backpressure explicit and usually fits worker pools better. Durable consumers keep state across restarts; ephemeral consumers are temporary views.',
        'Consumers track pending messages, acknowledgments, redelivery timers, maximum deliveries, filters, starting positions, and replay policy. An ordered consumer is useful for read-only replay because it can detect gaps and recreate itself, but it is not the same as a durable work-processing consumer.',
        'Acknowledgment policy determines what the server considers processed. With explicit acks, the application should ack only after its side effect is safe. If it acks before writing to a database, a crash can lose the work. If it writes and crashes before acking, it can see the message again. That is why idempotency keys belong in the application design.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider IoT telemetry. Devices publish messages to subjects such as telemetry.factory42.line7. A stream captures telemetry.* into file storage with an age limit and replicas. One durable pull consumer powers alerting workers. Another durable consumer archives batches to object storage. A temporary ordered consumer lets an engineer replay the last hour during an incident.',
        'Those consumers should not all have the same semantics. The alerting consumer cares about low lag and redelivery after worker crashes. The archive consumer cares about complete batch transfer. The debugging consumer cares about ordered replay but may not need durable state after the session ends.',
        'The important design question is retention. If the stream keeps only ten minutes and the archive consumer falls behind for an hour, replay cannot save it. If the stream keeps seven days but the system has no storage budget or monitoring, the cluster may fail under history it cannot afford. Retention is a product decision expressed as infrastructure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'JetStream works because it keeps the fast subject-oriented feel of NATS while adding explicit durable state. Publishers still use subjects. Operators configure streams around subject patterns. Applications choose consumer types that match their processing model.',
        'It also works because it makes backpressure visible. Pull consumers let workers request only as much as they can handle. Durable cursors let services restart without inventing their own offset table. Redelivery gives crash recovery as long as application side effects are retry-safe.',
        'The design is useful precisely because it does not force every workload into one abstraction. A stream can support event replay, worker queues, fan-out, and debugging views, but only when the retention and consumer settings match that intent.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'JetStream is lighter than operating a large distributed log, but it is still persistent infrastructure. Storage, replicas, retention, redelivery, and consumer lag become operational concerns. Write acknowledgments now include persistence and, with replicas, consensus cost.',
        'Slow consumers are the common failure mode. A consumer can be durable and still lose useful replay if stream retention expires the messages it needs. Monitoring should track stream storage, consumer lag, pending counts, redelivery counts, ack latency, and discard behavior.',
        'Duplicate delivery is normal under retry. JetStream can help deduplicate producer retries with message IDs in a window, but exactly-once business effects still require application design. The database, payment API, email sender, or device command handler must be prepared for repeated messages.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'JetStream wins when a system already wants NATS-style subject routing and also needs persistence. It fits service events, edge messaging, IoT telemetry, command streams, lightweight work queues, replayable integration events, and background processing where pull-based backpressure matters.',
        'It is especially useful when one retained stream should support multiple consumers with different positions. That is the difference between a shared event history and a one-off queue. Teams can add a new durable consumer for a new service without changing the publisher.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'JetStream fails when teams assume it removes the need for idempotency. It does not. Acknowledgments and redelivery are message semantics; your business operation still needs safe retry boundaries.',
        'It may also be the wrong fit for huge analytical logs, long-term cheap storage, or ecosystems that already standardize around Kafka-compatible tooling. Kafka, Pulsar, object-storage lake pipelines, and database outboxes all occupy nearby territory. The right choice depends on scale, retention horizon, tooling, ordering needs, and operational ownership.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'Remember the nouns: subject, stream, consumer, ack, retention. A subject is an address. A stream is stored history. A consumer is a delivery view. An ack is consumer progress. Retention decides whether history still exists.',
        'Most JetStream design mistakes come from treating those nouns as interchangeable. Keep them separate and the system becomes much easier to reason about.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NATS JetStream overview at https://docs.nats.io/nats-concepts/jetstream, streams documentation at https://docs.nats.io/nats-concepts/jetstream/streams, and consumers documentation at https://docs.nats.io/nats-concepts/jetstream/consumers. Study Kafka Log Case Study, Redis Streams Case Study, Message Queues, Backpressure, Idempotency, Transactional Outbox, and Rate Limiter next.',
      ],
    },
  ],
};
