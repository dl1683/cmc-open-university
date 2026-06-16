// Redis Streams: append-only IDs, consumer groups, pending entries, and trimming.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'redis-streams-case-study',
  title: 'Redis Streams Case Study',
  category: 'Systems',
  summary: 'A log-like Redis data type: append entries with ordered IDs, fan them to consumer groups, track pending deliveries, and trim old history.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stream append', 'consumer groups'], defaultValue: 'stream append' },
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

function redisGraph(title) {
  return graphState({
    nodes: [
      { id: 'producer', label: 'producer', x: 0.8, y: 3.5, note: 'XADD' },
      { id: 'stream', label: 'stream key', x: 2.8, y: 3.5, note: 'ordered entries' },
      { id: 'radix', label: 'radix/listpack', x: 4.8, y: 2.0, note: 'compact storage' },
      { id: 'trim', label: 'trim policy', x: 4.8, y: 5.0, note: 'MAXLEN/MINID' },
      { id: 'group', label: 'consumer group', x: 7.0, y: 3.5, note: 'last delivered id' },
      { id: 'pel', label: 'pending list', x: 8.8, y: 2.0, note: 'unacked entries' },
      { id: 'consumer', label: 'consumer', x: 8.8, y: 5.0, note: 'XREADGROUP' },
    ],
    edges: [
      { id: 'e-prod-stream', from: 'producer', to: 'stream', weight: 'XADD id fields' },
      { id: 'e-stream-radix', from: 'stream', to: 'radix', weight: 'store compactly' },
      { id: 'e-stream-trim', from: 'stream', to: 'trim', weight: 'delete old entries' },
      { id: 'e-stream-group', from: 'stream', to: 'group', weight: 'deliver new ids' },
      { id: 'e-group-consumer', from: 'group', to: 'consumer', weight: 'claim work' },
      { id: 'e-group-pel', from: 'group', to: 'pel', weight: 'track pending' },
      { id: 'e-consumer-pel', from: 'consumer', to: 'pel', weight: 'XACK clears' },
    ],
  }, { title });
}

function* streamAppend() {
  yield {
    state: redisGraph('Redis Streams append ordered entries under one key'),
    highlight: { active: ['producer', 'stream', 'e-prod-stream'], compare: ['group'] },
    explanation: 'Redis Streams are append-oriented. A producer calls XADD with field-value pairs, and Redis assigns or accepts an ordered ID such as milliseconds-sequence.',
  };

  yield {
    state: labelMatrix(
      'Stream entry anatomy',
      [
        { id: 'id', label: '1718300000-0' },
        { id: 'field1', label: 'user=42' },
        { id: 'field2', label: 'event=click' },
        { id: 'field3', label: 'page=/pricing' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'query', label: 'read impact' },
      ],
      [
        ['ordered position', 'range and resume'],
        ['payload field', 'client interprets'],
        ['payload field', 'message data'],
        ['payload field', 'message data'],
      ],
    ),
    highlight: { found: ['id:query'], active: ['field1:role', 'field2:role'] },
    explanation: 'The ID is the ordering and resume handle. The field-value payload is not a relational schema; consumers decide how to interpret it.',
    invariant: 'IDs in one stream are strictly ordered.',
  };

  yield {
    state: redisGraph('Internally, entries are compacted in radix/listpack form'),
    highlight: { active: ['stream', 'radix', 'e-stream-radix'], found: ['trim'] },
    explanation: 'Redis stores stream entries compactly. Conceptually it is a log; physically Redis uses a radix-tree-like index over compressed listpack nodes to keep memory overhead lower than one object per message.',
  };

  yield {
    state: labelMatrix(
      'Trim and retention choices',
      [
        { id: 'maxlen', label: 'MAXLEN' },
        { id: 'minid', label: 'MINID' },
        { id: 'approx', label: 'approx trim' },
        { id: 'exact', label: 'exact trim' },
      ],
      [
        { id: 'keeps', label: 'keeps' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['recent N entries', 'simple cap'],
        ['entries after ID', 'time-like retention'],
        ['near target', 'faster deletion'],
        ['precise target', 'more work'],
      ],
    ),
    highlight: { active: ['maxlen:tradeoff', 'minid:keeps'], compare: ['exact:tradeoff'] },
    explanation: 'A stream can grow forever unless you trim it. Retention is part of the data structure contract because readers may resume from old IDs.',
  };
}

function* consumerGroups() {
  yield {
    state: redisGraph('Consumer groups distribute stream entries'),
    highlight: { active: ['stream', 'group', 'consumer', 'e-stream-group', 'e-group-consumer'], found: ['pel'] },
    explanation: 'A consumer group lets multiple consumers share one stream. Each entry is delivered to one consumer in the group, while Redis tracks what has been delivered but not acknowledged.',
  };

  yield {
    state: labelMatrix(
      'Consumer-group state',
      [
        { id: 'last', label: 'last delivered id' },
        { id: 'pel', label: 'pending entries' },
        { id: 'ack', label: 'XACK' },
        { id: 'claim', label: 'XCLAIM/AUTOCLAIM' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'failureUse', label: 'failure use' },
      ],
      [
        ['group progress', 'resume new work'],
        ['delivered not done', 'detect stalled consumers'],
        ['mark complete', 'remove from pending'],
        ['transfer ownership', 'recover abandoned work'],
      ],
    ),
    highlight: { active: ['pel:failureUse', 'ack:meaning', 'claim:failureUse'], compare: ['last:meaning'] },
    explanation: 'The pending-entry list is the reliability hook. If a consumer dies after receiving work, another consumer can claim the stale pending entry instead of losing it.',
    invariant: 'Delivery plus pending tracking is not the same as exactly-once side effects.',
  };

  yield {
    state: redisGraph('Acknowledgment clears pending work after the side effect'),
    highlight: { active: ['consumer', 'pel', 'e-consumer-pel'], compare: ['trim'] },
    explanation: 'Consumers should usually perform their side effect first and then XACK. If they crash before the ack, the entry can be retried; if they ack first, the work may disappear.',
  };

  yield {
    state: labelMatrix(
      'Redis Streams versus neighboring tools',
      [
        { id: 'list', label: 'Redis List' },
        { id: 'stream', label: 'Redis Stream' },
        { id: 'kafka', label: 'Kafka log' },
        { id: 'queue', label: 'Message Queue' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['simple queue', 'few replay features'],
        ['in-memory log-like stream', 'IDs and consumer groups'],
        ['partitioned durable log', 'stronger replay ecosystem'],
        ['work distribution', 'semantics vary by broker'],
      ],
    ),
    highlight: { found: ['stream:lesson', 'kafka:lesson'], compare: ['list:lesson'] },
    explanation: 'A complete case study is a background job stream: producers append work, a consumer group claims jobs, pending entries recover crashed workers, and trimming prevents unbounded memory growth.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stream append') yield* streamAppend();
  else if (view === 'consumer groups') yield* consumerGroups();
  else throw new InputError('Pick a Redis Streams view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Redis Streams are a Redis data type for append-only, ordered messages. Entries live under a key, have IDs, and contain field-value pairs. The API supports range reads, blocking reads, consumer groups, acknowledgments, claiming stale work, and trimming.',
        'The structure is useful because it sits between a simple queue and a full distributed log. It gives Redis users replayable IDs and group-based work distribution without operating a Kafka cluster.',
        'The clean mental model is a named in-memory log with server-side delivery bookkeeping. Producers care about ordered append. Consumers care about resume points, ownership, and retry. Operators care about memory growth, persistence policy, replication, and how old history can be removed safely.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Producers append with XADD. Readers use IDs to read ranges or resume from a point. Consumer groups keep a last-delivered ID and a pending-entry list. XREADGROUP delivers new entries to consumers; XACK removes completed entries from pending state.',
        'Internally, Redis stores stream entries compactly with radix-tree/listpack machinery rather than one large object per entry. Trimming by MAXLEN or MINID bounds history, either exactly or approximately. Retention and pending-entry recovery must be designed together.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Streams are fast and ergonomic, but they are not free durable workflow semantics. A consumer can crash after doing a side effect and before XACK, so downstream operations must be idempotent or guarded by deduplication. Pending entries can also accumulate if consumers die or stop acknowledging.',
        'Memory pressure is the main operational concern. Trimming too aggressively can break slow consumers. Trimming too loosely turns Redis into an unbounded log. Persistence settings, replication, and failover determine how much data survives process or node failure.',
        'Consumer groups add another state surface to monitor. A stream may look healthy because entries are being appended, while the pending list quietly grows behind one stuck consumer. Useful dashboards track lag, pending age, claim rate, acknowledgment rate, and trim behavior together.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Redis Streams are used for background jobs, lightweight event ingestion, activity feeds, telemetry buffers, cache invalidation, and small service pipelines where Redis is already part of the stack. Redis Sorted Set Dict & Skiplist is the nearby structure when the primary need is score order, rank, due time, or sliding-window membership rather than replayable event delivery.',
        'A complete case study is image-processing jobs. The web tier XADDs a job. Workers read through a consumer group, write the processed image, and XACK only after storage succeeds. If a worker dies, another worker claims the stale pending entry and retries idempotently.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A Redis Stream is not Kafka with smaller syntax. Kafka has partitioned retention, consumer offsets, replication protocols, and a broader ecosystem. Redis Streams are excellent for compact operational pipelines, but exactly-once business effects still require idempotency, fencing, or transactional outbox patterns.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Redis Streams documentation at https://redis.io/docs/latest/develop/data-types/streams/, command documentation for XREADGROUP at https://redis.io/docs/latest/commands/xreadgroup/, and XAUTOCLAIM at https://redis.io/docs/latest/commands/xautoclaim/. Study Message Queues, Kafka Log Case Study, Redis Sorted Set Dict & Skiplist, Idempotency & Exactly-Once Delivery, Transactional Outbox, and Backpressure next.',
      ],
    },
  ],
};
