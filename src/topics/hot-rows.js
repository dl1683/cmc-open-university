// Hot rows: one viral video, one counter row, a thousand increments per
// second — and suddenly the database's politest feature (one writer at a
// time per row) is the bottleneck. The fix is always the same trick:
// turn contended UPDATEs into parallel INSERTs.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hot-rows',
  title: 'Hot Rows & Append-and-Aggregate',
  category: 'Systems',
  summary: 'A viral counter at 1,000 writes/sec melts a single row — four designs, from sharded counters to append-and-aggregate.',
  controls: [
    { id: 'view', label: 'Cool', type: 'select', options: ['the hot row, melting', 'four designs, one counter'], defaultValue: 'the hot row, melting' },
  ],
  run,
};

function* melting() {
  const visibleWriters = 3;
  const queuedWriters = 997;
  const totalWriters = visibleWriters + queuedWriters;
  const edgeCount = 3;
  const viewCount = '1,048,572';

  yield {
    state: graphState({
      nodes: [
        { id: 'w1', label: 'writer', x: 1, y: 5.5, note: 'UPDATE … count+1' },
        { id: 'w2', label: 'writer', x: 1, y: 3.5, note: 'waiting on lock' },
        { id: 'w3', label: 'writer', x: 1, y: 1.5, note: 'waiting on lock' },
        { id: 'row', label: 'views = 1,048,572', x: 5.5, y: 3.5, note: 'ONE row, ONE lock' },
        { id: 'queue', label: '…997 more writers', x: 8.8, y: 3.5, note: 'queued behind it' },
      ],
      edges: [
        { id: 'e1', from: 'w1', to: 'row' },
        { id: 'e2', from: 'w2', to: 'row' },
        { id: 'e3', from: 'w3', to: 'row' },
      ],
    }),
    highlight: { active: ['e1'], compare: ['w2', 'w3'], removed: ['queue'] },
    explanation: `The animation shows the simplest hotspot: ${visibleWriters} visible writers plus ${queuedWriters} queued — ${totalWriters} total — all pointing at one mutable row. Each view tries to run the same UPDATE against the same counter. The database must serialize those writes because two transactions cannot both own the current value at once. That lock is correctness doing its job. The performance bug is the data shape: a thousand independent events are being forced through one shared cell.`,
    invariant: `Row-level locking serializes all ${totalWriters} writers to the same row: a hot row is a single-file line through ${edgeCount} edges.`,
  };

  const arrive = 1000;
  const serve = 900;
  const surplus = arrive - serve;
  const plotPoints = 31;
  const tippingTime = 30;
  const tippingDepth = surplus * tippingTime;
  yield {
    state: plotState({
      axes: { x: { label: 'seconds since going viral' }, y: { label: 'writers waiting in line' } },
      series: [{
        id: 'backlog',
        label: 'queue depth (1,000/s arriving, ~900/s served)',
        points: Array.from({ length: plotPoints }, (_, t) => ({ x: t, y: surplus * t })),
      }],
      markers: [{ id: 'tipping', x: tippingTime, y: tippingDepth, label: `${tippingDepth.toLocaleString('en-US')} waiting — timeouts begin` }],
    }),
    highlight: { active: ['backlog'], removed: ['tipping'] },
    explanation: `This plot is the queueing law in plain view. If the row can complete about ${serve} locked updates per second and arrivals are ${arrive.toLocaleString('en-US')} per second, the backlog grows by ${surplus} every second. It will not settle at "a little slow." It grows until clients time out, retries add more arrivals, and the database spends more time managing the line than doing useful work. Slightly above a serialized resource's capacity is an unstable state.`,
    invariant: `Arrivals (${arrive.toLocaleString('en-US')}/s) > service rate (${serve}/s) means unbounded queue growth: ${surplus} extra writers per second compound, never stabilize.`,
  };

  const deadPerSec = 1000;
  const deadPerMin = deadPerSec * 60;
  const deadPerDay = deadPerSec * 86400;
  const deadPerDayMillions = Math.round(deadPerDay / 1_000_000);
  yield {
    state: matrixState({
      title: 'And the second bill: the corpse factory (MVCC)',
      rows: [
        { id: 'sec', label: 'per second' },
        { id: 'min', label: 'per minute' },
        { id: 'day', label: 'per day' },
      ],
      columns: [{ id: 'dead', label: 'dead tuples from ONE row' }, { id: 'note', label: '' }],
      values: [[deadPerSec, 1], [deadPerMin, 2], [deadPerDay, 3]],
      format: (v) => (v >= 1000 ? v.toLocaleString('en-US') : ['', 'every update births a corpse', 'autovacuum already behind', `${deadPerDayMillions} MILLION versions of one number`][v]),
    }),
    highlight: { removed: ['day:dead'] },
    explanation: `MVCC adds the second bill. Every update creates a newer tuple version and leaves an older one for VACUUM. A hot counter at ${deadPerSec.toLocaleString('en-US')} updates per second is also a dead-tuple generator at ${deadPerSec.toLocaleString('en-US')} per second — ${deadPerDay.toLocaleString('en-US')} per day. So the row fails two ways: writers queue on the lock, and cleanup chases the corpses. The fix is not just "make the database faster"; it is "stop representing independent events as one constantly rewritten row."`,
  };
}

function* fourDesigns() {
  const numShards = 16;
  const totalWrites = 1000;
  const writesPerShard = Math.round(totalWrites / numShards);
  const shardRows = 4;
  const shardCounts = [65537, 65520, 65541, 65498];
  const shardTotal = shardCounts.reduce((a, b) => a + b, 0);

  yield {
    state: matrixState({
      title: `Design B — sharded counters: split the line ${numShards} ways`,
      rows: Array.from({ length: shardRows }, (_, i) => ({ id: `sh${i}`, label: `views_shard_${i} (of ${numShards})` })),
      columns: [{ id: 'count', label: 'count' }, { id: 'load', label: 'write load' }],
      values: [[shardCounts[0], 62], [shardCounts[1], 63], [shardCounts[2], 62], [shardCounts[3], 63]],
      format: (v) => (v > 1000 ? v.toLocaleString('en-US') : `~${v}/s`),
    }),
    highlight: { compare: ['sh0:load', 'sh1:load'] },
    explanation: `Sharded counters keep the same logical value but split the write path. ${numShards} counter rows turn ${totalWrites.toLocaleString('en-US')} writes per second into roughly ${writesPerShard} writes per shard. Reads now sum the ${shardRows} visible shards (total: ${shardTotal.toLocaleString('en-US')}), so the design trades one cheap aggregation for lower lock contention and lower MVCC pressure per row. This is the same instinct as Consistent Hashing and LongAdder: split a contended value into independent lanes, then combine when you read.`,
    invariant: `${numShards} shards divide both the contention and the bloat by ${numShards}; reads pay one aggregation across all shards.`,
  };

  const pipelineNodes = 4;
  const pipelineEdges = 3;
  const aggInterval = 10;
  const contendedWrites = 10000;

  yield {
    state: graphState({
      nodes: [
        { id: 'app', label: `APP ×${totalWrites}/s`, x: 1, y: 3.5, note: 'INSERT view_event' },
        { id: 'events', label: 'EVENTS TABLE', x: 4.2, y: 3.5, note: 'append-only — no lock fights' },
        { id: 'agg', label: 'AGGREGATOR', x: 7, y: 5.5, note: `every ${aggInterval}s: SUM + prune` },
        { id: 'summary', label: 'SUMMARY ROW', x: 7, y: 1.5, note: `views = ${shardTotal.toLocaleString('en-US')} @ ${aggInterval}s ago` },
      ],
      edges: [
        { id: 'toEvents', from: 'app', to: 'events' },
        { id: 'toAgg', from: 'events', to: 'agg' },
        { id: 'toSum', from: 'agg', to: 'summary' },
      ],
    }),
    highlight: { found: ['toEvents', 'events'], active: ['toAgg', 'toSum'] },
    explanation: `Append-and-aggregate changes the shape more deeply. Each view becomes an INSERT into an event table, so ${pipelineNodes} pipeline stages replace one contended row. A background job folds events into a summary every ${aggInterval}s. You pay with staleness and ${pipelineEdges} edges of aggregation pipeline, but you turn many contended updates into many independent appends plus one batched update. LSM trees, write-back caches, and message queues all use the same absorb-now, consolidate-later move.`,
    invariant: `Inserts parallelize where updates serialize: append-and-aggregate converts ${contendedWrites.toLocaleString('en-US')} contended writes into one batched update every ${aggInterval}s.`,
  };

  const ramThroughput = 100000;
  const flushInterval = aggInterval;
  const ramRows = 3;

  yield {
    state: matrixState({
      title: 'Design D — RAM accumulator: speed with a crash window',
      rows: [
        { id: 'incr', label: 'Redis INCR (in memory)' },
        { id: 'flush', label: `flush job: every ${flushInterval}s → DB` },
        { id: 'crash', label: '⚡ crash between flushes' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', `~${ramThroughput.toLocaleString('en-US')}/s, no row, no corpse, no lock`, `one UPDATE carries ${flushInterval}s of counts`, `up to ${flushInterval}s of views vanish — acceptable?`][v],
    }),
    highlight: { found: ['incr:what'], removed: ['crash:what'] },
    explanation: `A RAM accumulator moves the hot write path out of the durable database. Redis INCR or an in-process counter can absorb ~${ramThroughput.toLocaleString('en-US')}/s, then flush a batch every ${flushInterval}s. That is write-back caching: fast and simple, with an explicit ${flushInterval}-second loss window. The decision depends on the value of exactness. A view counter can lose a few seconds. A bank balance cannot.`,
  };

  const designCount = 4;
  const naiveTput = 900;
  const shardTput = numShards * naiveTput;
  const appendTput = 50000;

  yield {
    state: matrixState({
      title: `The scorecard: one counter, ${designCount} designs`,
      rows: [
        { id: 'naive', label: 'A: single row' },
        { id: 'shard', label: `B: ${numShards} shards` },
        { id: 'append', label: 'C: append + aggregate' },
        { id: 'ram', label: 'D: RAM + flush' },
      ],
      columns: [{ id: 'tput', label: 'sustainable writes/s' }, { id: 'fresh', label: 'read freshness' }, { id: 'loss', label: 'crash loss' }],
      values: [[naiveTput, 1, 2], [shardTput, 1, 2], [appendTput, 3, 2], [ramThroughput, 3, 4]],
      format: (v) => (v >= 900 ? `~${v.toLocaleString('en-US')}` : ['', 'exact, instant', 'none (transactional)', 'seconds stale', 'the unflushed window'][v]),
    }),
    highlight: { removed: ['naive:tput'], found: ['append:tput', 'ram:tput'] },
    explanation: `The scorecard makes the trade visible across ${designCount} designs. The naive row caps at ~${naiveTput}/s; ${numShards} shards reach ~${shardTput.toLocaleString('en-US')}/s; append-and-aggregate pushes to ~${appendTput.toLocaleString('en-US')}/s; and RAM accumulation hits ~${ramThroughput.toLocaleString('en-US')}/s. The farther you move from the single row, the more write throughput you get, and the more you manage freshness, durability, or aggregation complexity. The reusable lesson: when many writers converge on one piece of state, ask whether they really need to rewrite it immediately.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the hot row, melting') yield* melting();
  else if (view === 'four designs, one counter') yield* fourDesigns();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view shows many writers aiming at one database row. An active edge is the writer holding the row lock, compared writers are waiting, and the removed node represents the hidden tail of the queue. The plot reads arrivals minus completions, so an upward line means the database is falling behind every second.',
        {type: 'callout', text: 'A hot row is not slow because databases are weak; it is slow because independent events were modeled as one serialized mutation.'},
        'The later views compare four designs for the same counter. Found highlights mark the fast path for a design, and removed highlights mark the guarantee it gives up. The safe inference rule is that additive events can be combined later, but state transitions that depend on current value cannot be split without another correctness rule.',
        'Read the invariant line in each frame before reading the throughput number. The invariant tells you what the design promises: exact now, exact after summing shards, durable after aggregation, or best effort after a memory flush.',
      
        {type: 'image', src: './assets/gifs/hot-rows.gif', alt: 'Animated walkthrough of the hot rows visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A hot row is a single database row that receives more concurrent writes than one row lock can serve. A viral video counter is the clean example: 10,000 views per second all run UPDATE videos SET views = views + 1 WHERE id = 42. The database serializes those updates because two transactions cannot both own the current value.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a data center rack', caption: 'Hot rows appear inside large systems when many application workers converge on one logical key. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg'},
        'The lock is correctness doing its job. The data model is the problem: thousands of independent events were forced through one shared cell. Social likes, inventory rows, tenant quota counters, rate-limit buckets, and last_seen timestamps can all take this shape.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural design is one counter column and one update per event. It is exact at read time, transactional, compact, and easy to reason about. For ordinary traffic, it is also the right design.',
        'Teams reach for it because it matches the business sentence. There is one video, so there is one count; every view increments that count. No background worker, no staleness, and no aggregation query are needed.',
        'This works until arrival rate exceeds service rate for that one row. At that point exactness now means a single-file line of writers, and every retry makes the line longer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is queueing behavior. If one row can complete 900 locked updates per second and traffic reaches 1,000 updates per second, the backlog grows by 100 writers every second. After 60 seconds, 6,000 writers are waiting before you count retries.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ssd-cache-benchmark.png', alt: 'Benchmark chart comparing cached and uncached storage operations', caption: 'Storage benchmarks make the second cost visible: once updates create churn faster than cleanup can absorb it, the bottleneck is no longer just one row lock. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Ssd-cache-benchmark.png'},
        'MVCC engines add storage churn. In PostgreSQL-style update storage, every UPDATE creates a new tuple version and leaves the old one for cleanup. One counter updated 1,000 times per second can create 86.4 million old versions per day from one logical integer.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Do not make every event rewrite the same value at the same moment. If the final value is a sum of independent contributions, the system can record contributions in multiple places and combine them later. The serialized object changes from the current total to a merge rule.',
        'That insight is only valid for operations with safe combination rules. Addition is associative and commutative, so shard totals can be summed in any order. Selling the last unit of inventory is not just addition; it is a conditional state transition that still needs a reservation, lock, escrow, or serializable check.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sharded counters keep the value in the database but create many write lanes. Instead of one row for video 42, store rows video_42_shard_0 through video_42_shard_15. Each increment chooses a shard by hash or randomness, and reads sum all shards.',
        'Append-and-aggregate changes events into inserts. Each view becomes an INSERT into an event table or queue, and a background worker groups events by key before updating a summary table. The summary is stale by design, but the write path is wide and durable.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Animated packet switching diagram with packets moving through shared links', caption: 'Append logs and queues use the same broad-path idea as packet switching: many small facts move through shared infrastructure before aggregation. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Packet_Switching.gif'},
        'A RAM accumulator absorbs increments in memory and flushes batches to durable storage. Redis INCR, local atomic counters, and per-process buffers fit this family. They trade lower write latency for a crash window unless the memory layer is replicated and reconciled.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sharding works because the invariant becomes total = sum(shards). Incrementing any shard by 1 preserves that invariant, and reading all shards reconstructs the exact total. Contention falls because writers touch many rows instead of one row.',
        'Append-and-aggregate works because the event log becomes the source of truth. A summary row is derived state, so a crashed worker can resume from a checkpoint and replay unprocessed events. If the summary is corrupted, the system can rebuild it from durable events.',
        'RAM accumulation works only when the business meaning allows a loss window or when another durable record exists. The correctness argument must name that contract. A view counter can be approximate for a few seconds; a bank balance cannot.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The single-row design has O(1) reads and O(1) writes in syntax, but its behavior is one serialized lane. Doubling traffic doubles the queue pressure on the same lock. Bigger hardware raises the service rate but does not remove the single lane.',
        'A 16-shard counter turns 1,000 writes per second into about 62.5 writes per shard if the hash is even. Writes stay transactional, and reads cost a sum across 16 rows. Doubling shards roughly halves per-shard write pressure and doubles read aggregation work.',
        'Append-and-aggregate moves cost into pipeline operations: worker idempotency, checkpoints, lag monitoring, retention, and compaction. RAM accumulation moves cost into crash semantics and reconciliation. The fastest design is not automatically the right one; the acceptable freshness and loss contract decides.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Social counters fit well because the events are additive and brief staleness is acceptable. View counts, likes, reposts, and follower counts can use sharded counters or append logs, especially for viral objects where traffic is sharply skewed.',
        'Distributed databases hit the same shape as hot keys or hot ranges. If many writes target one partition key, the node owning that key becomes the lock holder for the whole system. Splitting keys, salting writes, or aggregating events spreads the write path.',
        'Inventory uses the pattern only with extra rules. A flash-sale reservation system may use a fast in-memory counter for provisional holds, but the final sale still needs durable reconciliation so the system does not sell more units than exist.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Sharding can move the hot spot instead of removing it. A read path that sums all shards on every page view may create a hot cache key or a hot aggregation query. The design must split the actual bottleneck, not just rename it.',
        'The technique fails when order or conditional state matters. If two buyers both see stock = 1 and both try to decrement, a sharded counter alone cannot decide which buyer wins. That problem needs serialization, escrow, or a compare-and-set style rule.',
        'RAM accumulation fails when lost increments are unacceptable. A process crash between flushes can erase the last few seconds of updates. Replication and write-ahead logs reduce the risk, but the design must still declare the failure semantics.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A video receives 1,000 view events per second. The single-row counter can commit 900 updates per second, so backlog grows by 100 per second and reaches 6,000 waiting writers after one minute. If clients retry after 5 seconds, the arrival rate can rise above 1,000 and the queue grows faster.',
        'With 16 shards, each event chooses one shard. Expected load per shard is 1,000 / 16 = 62.5 updates per second, far below the 900-per-second row limit. A read runs SELECT SUM(count) across 16 rows and returns the exact total at that instant.',
        'With append-and-aggregate, the service inserts 1,000 events per second and a worker flushes every 5 seconds. Each flush groups about 5,000 rows into one summary update for video 42. The count shown to users may lag by 5 seconds, but the database no longer performs 5,000 locked rewrites of the same row.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study PostgreSQL MVCC and VACUUM to understand tuple churn, database row locking to understand serialized updates, and distributed database hot-key documentation from systems such as CockroachDB and Spanner. Pat Helland, Life beyond Distributed Transactions, is useful for the broader design habit of avoiding one global mutation point.',
        'Study transaction isolation before using this for inventory or balances. Study consistent hashing, event sourcing, CQRS, message queues, and idempotency next, because production hot-row fixes usually combine write spreading with durable replay and duplicate suppression.',
      ],
    },
  ],
};
