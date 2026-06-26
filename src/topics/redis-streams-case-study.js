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
      heading: 'How to read the animation',
      paragraphs: [
        'The stream view shows one Redis key acting as an append log. Active means a producer, consumer, or server command is touching an entry; visited means an entry already has an ID and position; found means Redis can prove the entry is available, pending, acknowledged, or trimmed.',
        'The consumer-group view shows delivery state beside the log. The safe inference is that an acknowledged entry left the pending-entry list, while an unacknowledged entry can later be inspected or claimed by another consumer.',
        {type:"callout", text:"Redis Streams turn a Redis key into a compact append log plus server-side delivery state, so retry and replay live beside the data instead of inside each worker."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many applications need more than a queue and less than a full streaming platform. They need to append jobs, let workers share them, retry abandoned entries, inspect recent history, and cap memory growth.',
        'Redis Streams exist for that middle ground. A stream stores ordered entries under one Redis key, and consumer groups add server-side progress and pending-delivery state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious Redis queue is a List. Producers push items, workers pop items, and the structure is simple enough to understand in one minute.',
        'A List becomes fragile when a worker crashes after popping but before finishing the side effect. Pub/Sub has the opposite problem: live subscribers see messages, but disconnected consumers cannot replay what they missed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is ownership of delivery state. If the worker owns all progress state, a crash can hide whether work was never received, received but unfinished, or completed but not recorded.',
        'A heavier log system can solve this, but it may be too much for a small Redis-backed job pipeline. The application wants replay and retry without operating a separate broker cluster.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the append log from delivery bookkeeping. The stream stores entries in ID order, while a consumer group stores last delivery and the pending-entry list for work handed to consumers.',
        'That gives an at-least-once contract, not exactly-once effects. Redis can remember that an entry was delivered and not acknowledged, but the application must make side effects safe if that entry is retried.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A producer appends with XADD. Redis assigns or validates an ID, stores field-value pairs, and keeps the entry in a compact radix-tree and listpack representation.',
        'A consumer can read ranges with XRANGE or block for new entries with XREAD. A consumer group uses XREADGROUP, records delivered entries as pending, and removes them from pending state when XACK arrives.',
        'Recovery uses the same state. XPENDING shows old unacknowledged entries, while XCLAIM or XAUTOCLAIM transfers stale work to another consumer that can retry it.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The stream ID is the ordering and resume handle. Because every entry has a monotonic position, consumers can ask for entries after a known ID or inspect a bounded range.',
        'The pending-entry list is the correctness hook for worker failure. If a consumer dies before XACK, Redis still has evidence that the entry was delivered but unfinished.',
        'Correct business behavior still depends on idempotency. If a worker charged a card and died before XACK, the retry must detect the earlier charge or use an idempotency key.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is memory. A stream that is never trimmed keeps entries, IDs, fields, and group bookkeeping, so MAXLEN or MINID must match the replay window the product needs.',
        'The second cost is retry semantics. A system processing 1,000 jobs per second with a 0.1 percent crash-after-side-effect rate can create one duplicate-risk job per second unless effects are deduplicated.',
        'Range and pending scans also have behavior costs. Reading 100,000 entries is expensive even if the lookup is efficient, because Redis must walk, allocate replies, serialize data, and send it over the network.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Redis Streams fit background jobs, small event pipelines, telemetry buffers, cache invalidation, notification fanout with replay, and service-local audit trails. They are especially useful when Redis is already deployed and the stream is bounded.',
        'Image processing is a clean case. A web server appends a job, workers read through a group, write the output path, and acknowledge only after storage succeeds.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Streams fail when teams treat consumer groups as exactly-once execution. Duplicate effects are possible whenever a worker completes external work and fails before XACK.',
        'They also fail under unsafe trimming. If old entries disappear before a slow consumer reads or claims them, Redis cannot reconstruct the missing history from the group metadata.',
        'A stream is not Kafka. Long retention, partitioned replay, large fanout ecosystems, and cross-region log durability usually belong in a dedicated log platform.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A thumbnail service receives 10,000 image jobs per hour. XADD appends each job with an ID such as 1719000000000-42, and eight workers read from one consumer group.',
        'Worker A reads job 500 and writes thumbnail thumb/500.jpg in 80 ms, but crashes before XACK. After a 60 second idle threshold, Worker B runs XAUTOCLAIM, sees job 500 pending, checks that thumb/500.jpg already exists, records success, and sends XACK.',
        'If the stream keeps a MAXLEN near 200,000 entries, it retains about 20 hours at 10,000 jobs per hour. A consumer down for longer than that may lose replay history, so the trim cap must be tied to recovery time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Redis Streams documentation at https://redis.io/docs/latest/develop/data-types/streams/, XADD at https://redis.io/docs/latest/commands/xadd/, XREADGROUP at https://redis.io/docs/latest/commands/xreadgroup/, XPENDING at https://redis.io/docs/latest/commands/xpending/, XACK at https://redis.io/docs/latest/commands/xack/, and Redis stream source code in t_stream.c. These define the commands, IDs, consumer groups, and storage representation.',
        'Study Message Queues, Kafka Log Case Study, Redis Sorted Set Dict and Skiplist, Idempotency and Exactly-Once Delivery, Transactional Outbox, Backpressure, and Write-Ahead Log. The key transfer is knowing where progress state lives.',
      ],
    },
  ],
};
