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
    explanation: 'The animation shows the simplest hotspot: many writers, one mutable row. Each view tries to run the same UPDATE against the same counter. The database must serialize those writes because two transactions cannot both own the current value at once. That lock is correctness doing its job. The performance bug is the data shape: a thousand independent events are being forced through one shared cell.',
    invariant: 'Row-level locking serializes writers to the same row: a hot row is a single-file line.',
  };

  const arrive = 1000;
  const serve = 900;
  yield {
    state: plotState({
      axes: { x: { label: 'seconds since going viral' }, y: { label: 'writers waiting in line' } },
      series: [{
        id: 'backlog',
        label: 'queue depth (1,000/s arriving, ~900/s served)',
        points: Array.from({ length: 31 }, (_, t) => ({ x: t, y: (arrive - serve) * t })),
      }],
      markers: [{ id: 'tipping', x: 30, y: 3000, label: '3,000 waiting — timeouts begin' }],
    }),
    highlight: { active: ['backlog'], removed: ['tipping'] },
    explanation: 'This plot is the queueing law in plain view. If the row can complete about 900 locked updates per second and arrivals are 1,000 per second, the backlog grows by 100 every second. It will not settle at "a little slow." It grows until clients time out, retries add more arrivals, and the database spends more time managing the line than doing useful work. Slightly above a serialized resource\'s capacity is an unstable state.',
    invariant: 'Arrivals > service rate means unbounded queue growth: hot-row overload compounds, never stabilizes.',
  };

  yield {
    state: matrixState({
      title: 'And the second bill: the corpse factory (MVCC)',
      rows: [
        { id: 'sec', label: 'per second' },
        { id: 'min', label: 'per minute' },
        { id: 'day', label: 'per day' },
      ],
      columns: [{ id: 'dead', label: 'dead tuples from ONE row' }, { id: 'note', label: '' }],
      values: [[1000, 1], [60000, 2], [86400000, 3]],
      format: (v) => (v >= 1000 ? v.toLocaleString('en-US') : ['', 'every update births a corpse', 'autovacuum already behind', '86 MILLION versions of one number'][v]),
    }),
    highlight: { removed: ['day:dead'] },
    explanation: 'MVCC adds the second bill. Every update creates a newer tuple version and leaves an older one for VACUUM. A hot counter at 1,000 updates per second is also a dead-tuple generator at 1,000 per second. So the row fails two ways: writers queue on the lock, and cleanup chases the corpses. The fix is not just "make the database faster"; it is "stop representing independent events as one constantly rewritten row."',
  };
}

function* fourDesigns() {
  yield {
    state: matrixState({
      title: 'Design B — sharded counters: split the line 16 ways',
      rows: Array.from({ length: 4 }, (_, i) => ({ id: `sh${i}`, label: `views_shard_${i} (of 16)` })),
      columns: [{ id: 'count', label: 'count' }, { id: 'load', label: 'write load' }],
      values: [[65537, 62], [65520, 63], [65541, 62], [65498, 63]],
      format: (v) => (v > 1000 ? v.toLocaleString('en-US') : `~${v}/s`),
    }),
    highlight: { compare: ['sh0:load', 'sh1:load'] },
    explanation: 'Sharded counters keep the same logical value but split the write path. Sixteen counter rows turn 1,000 writes per second into roughly 62 writes per shard. Reads now sum the shards, so the design trades one cheap aggregation for lower lock contention and lower MVCC pressure per row. This is the same instinct as Consistent Hashing and LongAdder: split a contended value into independent lanes, then combine when you read.',
    invariant: 'N shards divide both the contention and the bloat by N; reads pay one aggregation.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'app', label: 'APP ×1000/s', x: 1, y: 3.5, note: 'INSERT view_event' },
        { id: 'events', label: 'EVENTS TABLE', x: 4.2, y: 3.5, note: 'append-only — no lock fights' },
        { id: 'agg', label: 'AGGREGATOR', x: 7, y: 5.5, note: 'every 10s: SUM + prune' },
        { id: 'summary', label: 'SUMMARY ROW', x: 7, y: 1.5, note: 'views = 1,048,572 @ 10s ago' },
      ],
      edges: [
        { id: 'toEvents', from: 'app', to: 'events' },
        { id: 'toAgg', from: 'events', to: 'agg' },
        { id: 'toSum', from: 'agg', to: 'summary' },
      ],
    }),
    highlight: { found: ['toEvents', 'events'], active: ['toAgg', 'toSum'] },
    explanation: 'Append-and-aggregate changes the shape more deeply. Each view becomes an INSERT into an event table, so writers no longer fight over a shared row. A background job periodically folds those events into a summary. You pay with staleness and an aggregation pipeline, but you turn many contended updates into many independent appends plus one batched update. LSM trees, write-back caches, and message queues all use the same absorb-now, consolidate-later move.',
    invariant: 'Inserts parallelize where updates serialize: append-and-aggregate converts 10,000 contended writes into one.',
  };

  yield {
    state: matrixState({
      title: 'Design D — RAM accumulator: speed with a crash window',
      rows: [
        { id: 'incr', label: 'Redis INCR (in memory)' },
        { id: 'flush', label: 'flush job: every 10s → DB' },
        { id: 'crash', label: '⚡ crash between flushes' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '~100,000/s, no row, no corpse, no lock', 'one UPDATE carries 10s of counts', 'up to 10s of views vanish — acceptable?'][v],
    }),
    highlight: { found: ['incr:what'], removed: ['crash:what'] },
    explanation: 'A RAM accumulator moves the hot write path out of the durable database. Redis INCR or an in-process counter can absorb far higher write rates, then flush a batch later. That is write-back caching: fast and simple, with an explicit loss window. The decision depends on the value of exactness. A view counter can lose a few seconds. A bank balance cannot.',
  };

  yield {
    state: matrixState({
      title: 'The scorecard: one counter, four designs',
      rows: [
        { id: 'naive', label: 'A: single row' },
        { id: 'shard', label: 'B: 16 shards' },
        { id: 'append', label: 'C: append + aggregate' },
        { id: 'ram', label: 'D: RAM + flush' },
      ],
      columns: [{ id: 'tput', label: 'sustainable writes/s' }, { id: 'fresh', label: 'read freshness' }, { id: 'loss', label: 'crash loss' }],
      values: [[900, 1, 2], [14000, 1, 2], [50000, 3, 2], [100000, 3, 4]],
      format: (v) => (v >= 900 ? `~${v.toLocaleString('en-US')}` : ['', 'exact, instant', 'none (transactional)', 'seconds stale', 'the unflushed window'][v]),
    }),
    highlight: { removed: ['naive:tput'], found: ['append:tput', 'ram:tput'] },
    explanation: 'The scorecard makes the trade visible. The farther you move from the single row, the more write throughput you get, and the more you manage freshness, durability, or aggregation complexity. The reusable lesson is broad: when many writers converge on one piece of state, ask whether they really need to rewrite it immediately. Often the better shape is independent events first, consolidation later.',
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
        'The first view shows the hot row melting. Three visible writers and a queue of 997 more all point at a single counter row. Active edges mark the writer currently holding the lock. Compared nodes are waiting for it. The removed node represents the invisible tail of the queue. The plot that follows graphs queue depth over time: arrivals minus service rate, compounding every second. The matrix frame counts dead tuples generated by MVCC under the same write load.',
        'The second view walks four designs side by side. Each frame shows one approach to the same counter: sharded rows, append-and-aggregate, RAM accumulator, and a final scorecard comparing throughput, freshness, and crash semantics. Found highlights mark the fast path. Removed highlights mark the risk.',
        'At each frame, read the explanation for the mechanism, then check the invariant line beneath it. The invariant states what the design guarantees. If a later design relaxes that guarantee, the explanation says so and names the tradeoff.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A hot row is a single database row that receives more concurrent writes than one row lock can serve. The canonical case is a viral counter: a video gets 10,000 views per second, and each view runs UPDATE videos SET views = views + 1 WHERE id = 42. The database serializes those writes because two transactions cannot both own the current value at once. The lock is correctness doing its job. The performance problem is the data shape: thousands of independent events forced through one shared cell.',
        'This pattern appears wherever many actors converge on one record. Social media like counts, e-commerce inventory rows, unread-message counters, rate-limit buckets, auction bid columns, tenant quota rows, and last_seen timestamps updated on every request all share the shape. The symptoms vary -- lock waits, slow commits, dead-tuple bloat, retry storms, connection pool exhaustion -- but the cause is the same: a serialized write lane carrying work that could have been parallel.',
        'The problem is not academic. Instagram famously had to replace naive counter updates on popular posts. Any inventory system selling a flash-sale item at thousands of requests per second hits the same wall. CockroachDB and Google Spanner both document hot-key mitigations specifically because range-partitioned stores concentrate writes on the node that owns the key.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural design is a counter column: one row, one integer, one UPDATE per event. It is easy to implement, exact at read time, transactional, and small. For normal traffic it is also the right design. A few updates per second against one row are cheap.',
        'Teams reach for this because it matches the mental model. There is one count. It lives in one place. Every reader sees the latest value. The schema is a single column, the query is a single statement, and the transaction boundary is obvious. No pipeline, no staleness, no aggregation step.',
        {
          type: 'code',
          language: 'sql',
          text: '-- The obvious counter update\nBEGIN;\n  UPDATE videos SET views = views + 1 WHERE id = 42;\nCOMMIT;\n-- Simple, correct, and fatal at 10,000 writes/sec.',
        },
        'The approach works until the row goes viral. At that point, every virtue becomes a liability: exactness requires a lock, one row means one lock, and one lock means a single-file line of writers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is queueing theory. If the row can complete about 900 locked updates per second and arrivals hit 1,000 per second, the backlog grows by 100 writers every second. This is not a mild slowdown. It is an unstable queue: the line grows until clients time out, retries add more arrivals, and the database spends more time managing the queue than doing useful work.',
        'MVCC storage engines add a second bill. In PostgreSQL, every UPDATE creates a new tuple version and leaves the old one for VACUUM. A counter updated 1,000 times per second generates 1,000 dead tuples per second -- 86 million per day from one integer. Autovacuum falls behind, table bloat grows, index scans slow down, and the hot row fails on two axes simultaneously: lock contention and storage churn.',
        'Write skew is a subtler variant of the same problem. Two transactions read the same row, compute different updates based on that read, and both commit. Neither saw the other. In a counter this loses an increment. In inventory, two buyers can each see "1 remaining" and both succeed, overselling the item. Phantom reads compound this: a transaction counts qualifying rows, another transaction inserts a new qualifying row, and the first transaction acts on a stale count. These are not exotic edge cases. They are the default behavior under concurrent writes to shared state.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'All fixes share one move: stop making every event rewrite the same cell at the same moment. The approaches differ in where they split the write path and what freshness guarantee they give up.',
        {
          type: 'diagram',
          label: 'Lock contention on a hot counter row',
          text: 'Writer A ──lock──> [ views = 1,048,572 ] <──blocked── Writer B\n                          ^                       <──blocked── Writer C\n                          |                        <──blocked── Writer D\n                     (one lock,                    <──blocked── ...\n                      one queue,                   <──blocked── Writer N\n                      N-1 waiting)',
        },
        'Sharded counters keep the value inside the database but give it many write lanes. Instead of one row for video 42, store rows video_42_shard_0 through video_42_shard_15. Each increment picks a shard (by hashing request ID, user ID, or a random number) and updates only that shard. Reads sum all shards. Sixteen shards turn 1,000 writes/sec into roughly 62 writes per shard. The read path pays one aggregation query, which is cheap compared to unbounded lock contention.',
        'Append-and-aggregate changes the shape more deeply. Each event becomes an INSERT into an event table. Inserts do not fight over one existing tuple, so the write path becomes wide. A background worker periodically groups events by key, applies a batched UPDATE to a summary table, records a high-water mark, and prunes processed events. The summary is stale by design -- seconds behind reality -- but the write path no longer melts.',
        'A RAM accumulator (Redis INCR, an in-process AtomicLong, a local aggregation buffer) absorbs increments in memory and flushes a batch to durable storage every few seconds. This is write-back caching for counters. It handles the highest write rates but introduces a crash window: unflushed increments vanish if the process dies.',
        {
          type: 'code',
          language: 'python',
          text: '# Atomic increment with retry (sharded counter)\nimport random, psycopg2\nfrom psycopg2 import OperationalError\n\ndef increment_view(conn, video_id, num_shards=16, max_retries=5):\n    shard = random.randint(0, num_shards - 1)\n    for attempt in range(max_retries):\n        try:\n            with conn.cursor() as cur:\n                cur.execute(\n                    "UPDATE view_shards SET count = count + 1 "\n                    "WHERE video_id = %s AND shard_id = %s",\n                    (video_id, shard)\n                )\n                conn.commit()\n                return\n        except OperationalError:  # lock timeout or deadlock\n            conn.rollback()\n            shard = random.randint(0, num_shards - 1)  # pick new shard\n    raise RuntimeError("increment failed after retries")',
        },
        'A queue-based approach is a variation of append-and-aggregate: events go into Kafka, SQS, or a similar message broker. A consumer reads batches and applies them to the database in bulk. The database sees one large UPDATE every few seconds instead of thousands of individual ones. This moves the hot path out of the database entirely and into infrastructure designed for high-throughput appends.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sharding works because addition is associative and commutative. If the final value is a sum of independent increments, the system can add lane totals in any order and get the same result. That algebra is what makes the split safe. It would not be safe for a state transition where order matters, such as spending from a balance without reservations.',
        'Append-and-aggregate works because the event log preserves the facts that a single counter collapsed. The summary is a derived value. If the worker crashes mid-batch, the high-water mark tells it where to resume. If the summary is corrupted, the system can rebuild it from the event table. The source-of-truth is the event stream, not the summary row.',
        'RAM accumulation works when the allowed loss window is explicit. A best-effort view counter can tolerate losing a few seconds of increments. A bank balance cannot. The same technique can be technically fast and semantically wrong if the number carries financial or security authority.',
        'All three exploit the same principle: independent events do not need to compete for the current total if the system can combine them later. The invariant shifts from "the row always holds the exact latest total" to "the system can derive an acceptable total from independently recorded contributions."',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Approach', 'Writes/sec', 'Read freshness', 'Crash loss', 'Complexity'],
          rows: [
            ['Single row (naive)', '~900', 'Exact, instant', 'None (txn)', 'Trivial'],
            ['Sharded counters (N=16)', '~14,000', 'Exact (sum N rows)', 'None (txn)', 'Low: shard init + sum query'],
            ['Row-level locking + SELECT FOR UPDATE', '~900', 'Exact, instant', 'None (txn)', 'Trivial but serialized'],
            ['MVCC (snapshot isolation)', '~900 effective', 'Snapshot-stale', 'None (txn)', 'Low, but dead-tuple cost'],
            ['Append-and-aggregate', '~50,000+', 'Seconds stale', 'None (events durable)', 'Medium: worker + checkpointing'],
            ['Queue-based (Kafka/SQS)', '~100,000+', 'Seconds to minutes stale', 'Broker durability', 'High: infra + consumer'],
            ['RAM accumulator (Redis)', '~100,000+', 'Seconds stale', 'Unflushed window lost', 'Medium: flush logic + crash plan'],
          ],
        },
        'The single-row design has the best semantics and the worst overload behavior. Reads are trivial, writes are exact, but the ceiling is hard. A bigger machine raises the ceiling without removing the single lane.',
        'Sharded counters preserve transactional durability while dividing contention by N. They cost more read work, more rows, and harder resharding. If shard choice has low cardinality, one shard can become hot again.',
        'Append-and-aggregate gives the highest durable throughput but adds a pipeline: the worker needs idempotency, checkpoints, backpressure, lag monitoring, and a retention policy. The event table grows fast, so compaction is part of the design.',
        'RAM accumulation is the fastest and most dangerous. It removes durable write pressure entirely, but crash semantics move into the application. Replicated Redis, write-ahead logs, and idempotent event IDs reduce risk but do not eliminate the need to declare how much data can be lost.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Social media counters are the textbook case. Instagram, YouTube, and Twitter all moved away from naive counter updates on popular content. Like counts, view counts, retweet counts, and follower counts are additive, tolerant of brief staleness, and hit by extreme write skew on viral posts. Sharded counters or append-and-aggregate fit perfectly.',
        'E-commerce inventory during flash sales is the high-stakes variant. A popular item at 5,000 purchase attempts per second creates the same hot-row shape, but the counter carries authority: overselling is a real cost. The mitigation here is often a hybrid -- a RAM-level reservation system backed by a durable ledger with reconciliation. Shopify and Amazon have both published descriptions of this pattern.',
        'CockroachDB documents a "hot key" problem where range-partitioned data concentrates writes on the leaseholder for a given key range. Their mitigation splits the range automatically when write rate exceeds a threshold. Google Spanner similarly documents best practices for avoiding hot splits on monotonically increasing keys. Both systems solve the distributed version of the same single-row contention.',
        'Rate-limit buckets, tenant quota rows, and job-progress counters all share the shape: many writers, one row, and a business rule about how fresh the value must be. The fix always starts with the same question -- does this value need to be exact and instant, or can it be derived from independent contributions?',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Treating a faster machine as a fix is the most common mistake. Better hardware may postpone the incident, but the shape stays serialized. Once arrivals cross the new service rate, the same queueing collapse returns. Vertical scaling buys time, not architecture.',
        'Moving contention without noticing is the second mistake. A sharded counter can relocate the hot spot to a cache key that every read touches. An append pipeline can move it to one aggregator partition. A RAM accumulator can move it to a single Redis key. The design must split the actual hot operation, not just rename the bottleneck.',
        'Losing the business meaning of exactness is the subtle failure. Display counters and analytics tolerate staleness. Inventory, financial balances, security quotas, and access entitlements do not. A sharded counter on a bank balance, without reservations or escrow, is a data-loss bug disguised as a performance optimization. The data structure is only correct relative to the consistency contract the business requires.',
        {
          type: 'note',
          text: 'Write skew cannot be fixed by sharding alone. If two transactions must both read and conditionally write the same logical value (e.g., "sell the last item only if stock > 0"), the serialization point is the read-then-write dependency, not just the write. Serializable isolation or explicit locking is required.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Martin Kleppmann, "Designing Data-Intensive Applications" (2017), Chapter 7 (Transactions) -- the clearest treatment of write skew, phantom reads, and isolation levels that make hot rows dangerous.',
            'CockroachDB docs: "Hot Ranges" and automatic range splitting -- production mitigation for hot keys in a distributed SQL database.',
            'Google Cloud Spanner: "Schema Design Best Practices" -- monotonic key avoidance and split management for distributed counters.',
            'PostgreSQL docs: MVCC, VACUUM, and HOT (Heap-Only Tuple) updates -- the storage-engine mechanics behind dead-tuple churn.',
            'Pat Helland, "Life beyond Distributed Transactions" (2007) -- the theoretical case for why single-row serialization does not scale and how to design around it.',
          ],
        },
        'Prerequisite: study row-level locking, MVCC, and transaction isolation levels (READ COMMITTED vs SERIALIZABLE) to understand why the naive approach breaks. Extension: study consistent hashing and range partitioning to understand how distributed databases spread write load across nodes. Case study: study event sourcing and CQRS, which generalize append-and-aggregate into a full architectural pattern where the event log is the source of truth and all read models are derived projections.',
      ],
    },
  ],
};
