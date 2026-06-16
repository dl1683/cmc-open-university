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
      heading: 'What it is',
      paragraphs: [
        'NATS JetStream is the persistence and streaming layer for NATS. Core NATS is a fast messaging fabric; JetStream adds stored streams, consumer state, acknowledgments, replay, retention, replication, and key-value or object-store features.',
        'A stream captures messages from subjects into a message store. Consumers are views over that stored stream, tracking delivery positions, acknowledgment state, filtering, and redelivery behavior.',
        'This case study belongs beside Message Queues, Kafka Log Case Study, Redis Streams Case Study, Backpressure, Idempotency, and Transactional Outbox.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A publisher sends to a NATS subject. If a stream is configured for that subject, JetStream stores the message and can acknowledge that it was persisted. The stream has storage, retention, discard, max-age, max-bytes, and replica settings.',
        'Consumers deliver messages to applications. Push consumers send messages to subscribers. Pull consumers let workers fetch batches, which makes backpressure explicit. Durable consumers keep state across reconnects and restarts.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'JetStream is lighter than running a large distributed log, but it still has persistent storage, replica, retention, and redelivery semantics to operate. Slow consumers can fall behind retained history. Work-queue retention changes how many consumers may receive one message.',
        'Acknowledgments are not the same as exactly-once business effects. If a worker writes to a database and crashes before acking, JetStream can redeliver the message. The database write must be idempotent or fenced by an application key.',
        'Replication and storage choice also change the failure model. Memory storage is fast but less durable. File storage and replicas improve survival, but write acknowledgment now includes storage and quorum costs that should be visible in latency budgets.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'JetStream is used for service events, IoT telemetry, background work queues, event replay, microservice integration, edge messaging, command streams, and lightweight persistent workflows where NATS is already the connectivity layer.',
        'A complete case study is telemetry ingestion. Sensors publish by subject. One stream captures all telemetry. A real-time consumer computes alerts, while a separate durable consumer archives batches to object storage.',
        'A second case is command processing for edge services. The command stream stores intended actions, a durable consumer tracks which device worker has acknowledged each command, and redelivery handles disconnects without inventing a custom retry log.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A stream is not a consumer, and JetStream is not just a queue. Retention policy, acknowledgment policy, delivery policy, and consumer durability define the actual semantics. Confusing those layers leads to lost replay history or duplicate side effects.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NATS JetStream overview at https://docs.nats.io/nats-concepts/jetstream, streams documentation at https://docs.nats.io/nats-concepts/jetstream/streams, and consumers documentation at https://docs.nats.io/nats-concepts/jetstream/consumers. Study Kafka Log Case Study, Redis Streams Case Study, Message Queues, Backpressure, and Idempotency next.',
      ],
    },
  ],
};
