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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first view as a delivery pipeline. A subject is the address that a publisher uses, a stream is the stored log that captures matching subjects, and a consumer is a cursor that decides which stored messages a worker sees.',
        'The highlighted step is the layer currently making a promise. When the stream is active, the promise is durable storage; when the consumer is active, the promise is delivery state; when the worker is active, the promise is only application behavior.',
        {type:'callout', text:'JetStream works by separating subject routing, stored stream history, consumer cursors, and business side effects into different ownership layers.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Core NATS is a subject-based messaging system. A subject is a name such as orders.created, and subscribers receive messages sent to matching names while they are online.',
        'That live model is fast because the server does not need to keep history. It becomes unsafe when a payment worker restarts, a batch job wants replay, or a support engineer needs the events from the last hour.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is fire-and-forget publish-subscribe. The publisher sends an event, online subscribers receive it, and the system stays simple while every consumer is healthy.',
        'A second approach is a do-it-yourself outbox table beside NATS. That gives storage, but the team now owns ordering, cursor positions, retries, retention, and duplicate handling.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Persistence is not one feature. A durable message system must define how long messages stay, who has seen each message, when a failed worker should receive it again, and what happens when storage limits remove old history.',
        'The hardest wall is the gap between ack and business effect. If a worker writes an order row and crashes before acking, JetStream sees an unacked message and redelivers it, while the database may already contain the side effect.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'JetStream separates four responsibilities that are easy to confuse. Subjects route messages, streams store matching messages, consumers track delivery position, and applications own idempotent side effects.',
        'That separation is the data structure lesson. One stored stream can feed a live alert consumer, a batch replay consumer, and a debug consumer without copying the message log for each reader.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A stream is configured with subject filters, storage type, replica count, retention limits, and discard policy. When a published subject matches the stream, the server stores the message and assigns a stream sequence number.',
        'A durable consumer is a named view over that stream. It records delivered sequence, ack floor, pending messages, redelivery timers, and optional subject filters so workers can restart without losing their place.',
        'Pull consumers make backpressure explicit. A worker asks for at most N messages, processes them, acks after the side effect is safe, and fetches more only when it has capacity.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is a boundary argument. If the stream stores every captured message before acknowledging publish, and the durable consumer advances only after ack, then the server can resume delivery from recorded state after a crash.',
        'That does not prove exactly-once business behavior. JetStream can prove message storage and redelivery rules; the application must prove that repeating the same message id does not repeat an unsafe side effect.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Storage cost behaves as rate times size times retention times replicas. A stream receiving 1,000 messages per second at 1 KB each for seven days stores about 604 GB before replication, and three replicas make the cluster hold about 1.8 TB.',
        'Latency also changes behavior. File storage, fsync policy, and Raft quorum replication add work to publish acknowledgments, while many consumers add cursor state, pending sets, and timers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'JetStream fits job queues where workers pull at their own pace and failed work should be retried. It also fits event replay, audit streams, IoT telemetry, and edge deployments that already use NATS for low-latency subject routing.',
        'The common access pattern is append once and read through many views. That is why the stream-consumer split matters more than the API surface.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'JetStream fails when teams treat retention as infinite history. A consumer whose cursor points before the stream first sequence has already lost data, even though the durable consumer still exists.',
        'It also fails when duplicate delivery is treated as a bug rather than a contract. Publish dedup windows and consumer acks reduce duplicates, but application idempotency remains the boundary for business correctness.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A factory publishes 500 sensor events per second at 800 bytes each into a TELEMETRY stream with 24 hours of retention and three replicas. One day of raw messages is 500 * 800 * 86,400 = 34,560,000,000 bytes, so the replicated cluster holds about 103.7 GB for that stream.',
        'A durable consumer last acked sequence 9,000,000 and the stream first sequence is 8,500,000. The consumer can resume; if retention advances first sequence to 9,200,000 before it catches up, the gap is real and replay cannot recover those 200,000 missing messages.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the NATS JetStream concepts, stream configuration, consumer configuration, and model deep-dive documentation at docs.nats.io. Read the retention policy and acknowledgement sections before tuning a production stream.',
        'Study log-structured storage, Raft replication, idempotency keys, backpressure, Kafka consumer groups, and work queues next. The useful comparison is not which broker is fashionable, but which durability and delivery contract your workload needs.',
      ],
    },
  ],
};