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
      heading: 'Why this exists',
      paragraphs: [
        "Redis Streams exist because many applications need more than a simple queue but less than a full distributed log platform. A web service may need to append jobs, let several workers share the work, retry entries abandoned by crashed workers, inspect recent history, and cap memory growth. Redis Lists can push and pop, but they do not provide a rich replay and consumer-group model.",
        "A stream is a named, append-oriented sequence of entries. Each entry has an ordered ID and field-value pairs. Producers append. Consumers read by ID, block waiting for new entries, or participate in a consumer group. Redis tracks group progress and pending deliveries on the server side.",
        "The topic matters because Redis Streams sit in a useful middle zone. They are not Kafka. They are not a relational table. They are not a durable workflow engine. They are a compact operational log inside Redis, with enough delivery bookkeeping to build lightweight pipelines when Redis is already part of the architecture.",
        {type:"callout", text:"Redis Streams turn a Redis key into a compact append log plus server-side delivery state, so retry and replay live beside the data instead of inside each worker."},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        "The naive approach is a Redis List. Producers LPUSH or RPUSH work, and workers pop items. This is simple and fast, but a popped item is no longer in the list. If the worker crashes after popping and before finishing the side effect, the work can disappear unless the application builds its own processing list and recovery protocol.",
        "Another naive approach is Pub/Sub. Producers publish events, and subscribers receive them while connected. That is useful for live fanout, but it is not a replayable log. A disconnected consumer does not later ask for the messages it missed. There is no stream ID to resume from and no pending-entry list to inspect.",
        "A third approach is to install a heavier log system. That may be the right decision for high-throughput, partitioned, long-retention event streams. But many teams only need a small in-memory pipeline, background job stream, or service-local event buffer. Redis Streams are for that space."
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is to separate the append log from the delivery bookkeeping. The stream stores entries in order. Consumer groups store progress over that stream. A group can deliver each entry to one consumer, remember that it was delivered, and later remove it from pending state when the consumer acknowledges completion.",
        "This is not exactly-once execution. It is a practical at-least-once contract. If a worker receives an entry and dies before XACK, the entry remains pending. Another worker can inspect or claim it after it becomes stale. If the first worker performed the side effect before dying, the retry may perform it again unless the side effect is idempotent.",
        "That distinction is the main lesson. Redis can remember delivery state, but the application must make business effects safe under retry."
      ],
    },
    {
      heading: 'The mechanism',
      paragraphs: [
        "A producer appends with XADD. Redis assigns an ID, commonly based on milliseconds plus a sequence number, or accepts a valid caller-supplied ID. The ID is the ordering and resume handle. The payload is a list of field-value pairs, not a fixed relational schema. Consumers decide what fields mean.",
        "A plain reader can use XRANGE to inspect a range or XREAD to block for new entries after an ID. A consumer group adds shared progress. XGROUP creates the group. XREADGROUP reads as a named consumer inside the group. Redis records delivered-but-unacknowledged entries in the pending-entry list. XACK removes completed entries from that pending state.",
        "Recovery uses the same bookkeeping. XPENDING shows stuck work. XCLAIM or XAUTOCLAIM can transfer ownership of old pending entries to another consumer. Trimming uses MAXLEN or MINID to remove old history, either exactly or approximately. Internally, Redis stores stream entries compactly with radix-tree and listpack-style machinery so the structure does not behave like one large object per message."
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        "The first visual proves the shape of the data structure. A producer appends to one stream key. Redis stores ordered entries compactly. A trim policy may delete old history. Consumer groups sit beside the stream rather than replacing it. That separation is why the same stream can be read by ranges, direct consumers, or groups.",
        "The entry anatomy view proves the role of the ID. The ID is not just a timestamp decoration. It is how range scans, blocking reads, and resume points work. The payload fields carry application data, but the stream contract is organized around ordered IDs.",
        "The consumer-group visual proves the reliability hook. The group has a last-delivered ID and a pending-entry list. Delivery moves an entry into pending state. Acknowledgment removes it. Claiming moves stale pending work to a new consumer. The pending list is the place to look when workers crash or stop acknowledging."
      ],
    },
    {
      heading: 'Why the method works',
      paragraphs: [
        "Redis Streams work because the server owns the small amount of coordination state that a plain queue leaves to the application. The stream keeps ordered history. The group keeps shared delivery progress. The pending-entry list keeps evidence that a message was handed to a worker but not finished.",
        "This gives the application enough structure to recover common failures. If a consumer disconnects before reading, it can resume from an ID. If it receives work and dies before acknowledgment, another consumer can reclaim the pending entry. If old entries are no longer useful, trimming bounds the log.",
        "The method is also fast because the structure is still Redis-shaped. It is in memory, command-driven, and compact. It does not try to provide every feature of a large broker. The limited contract is part of the appeal."
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        "The first cost is memory. A stream can grow forever if nobody trims it. MAXLEN gives a count-like cap. MINID gives an ID-based retention boundary. Approximate trimming is faster but less exact. Exact trimming gives tighter control but can do more work. The right policy depends on how far consumers may need to replay.",
        "The second cost is semantic responsibility. Redis can redeliver pending work, but it cannot know whether sending an email, charging a card, writing a file, or calling another API already happened. Consumers should usually do the side effect first and XACK after success. That creates retry safety only if the side effect itself is idempotent or deduplicated.",
        "The third cost is observability. A stream may receive new entries normally while one consumer quietly builds a huge pending list. Operators need lag, pending count, pending age, claim rate, acknowledgment rate, memory use, trim behavior, persistence settings, and replication health."
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        "Redis Streams fit background jobs, lightweight event ingestion, activity feeds, telemetry buffers, cache invalidation, notification pipelines, and service-local workflows. They are especially attractive when Redis is already deployed and the workload needs replay and consumer groups without a separate broker cluster.",
        "Image processing is a clean example. The web tier appends a job with XADD. Workers read through a consumer group. A worker downloads the image, writes the processed result, records an idempotency key or output path, and XACKs only after storage succeeds. If it dies before the acknowledgment, another worker claims the pending entry and checks whether the output already exists before retrying.",
        "Streams are also useful for small audit trails or recent event history. XRANGE can inspect what happened. XREAD can tail new entries. Trimming keeps the history bounded once old entries are no longer needed."
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "The biggest misconception is that consumer groups create exactly-once effects. They do not. They create tracked delivery and acknowledgment. Duplicate processing is still possible whenever a consumer completes the business action but fails before XACK.",
        "The second failure mode is unsafe trimming. If old entries are trimmed before a slow consumer reads or claims them, recovery may lose the history it needed. Retention must be set with consumer lag and failure recovery in mind.",
        "The third failure mode is using Streams where a different Redis structure is clearer. Sorted sets are better for score order, due times, leaderboards, and sliding windows. Lists are better for very simple queues. Pub/Sub is better for ephemeral live broadcast. Kafka-style logs are better for long retention, partitioned replay, and a broader streaming ecosystem."
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study XADD, XRANGE, XREAD, XGROUP, XREADGROUP, XPENDING, XACK, XCLAIM, XAUTOCLAIM, MAXLEN, MINID, Redis persistence, and Redis replication next. Nearby curriculum topics include Message Queues, Kafka Log Case Study, Redis Sorted Set Dict and Skiplist, Idempotency and Exactly-Once Delivery, Transactional Outbox, Backpressure, and Write-Ahead Log.",
        "The transferable lesson is to ask where the ownership state lives. A plain queue hides it in the worker. A stream with consumer groups stores it beside the log. That one design choice determines what happens when workers crash."
      ],
    },
  ],
};
