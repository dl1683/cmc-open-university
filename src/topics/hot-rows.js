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
      heading: `Why this exists`,
      paragraphs: [
        `A hot row is a single database row that receives more writes than one row lock can serve. The clean example is a viral counter. Every view wants to increment the same row, so every writer asks the database for exclusive access to the same small piece of state. The row is tiny, but the contention is huge.`,
        `The database is not being foolish when it serializes those writes. If two transactions both read the old count and both write back count plus one, one increment can disappear. The row lock protects correctness. The design mistake is representing thousands of independent events as immediate rewrites of one mutable value.`,
        `This pattern shows up anywhere many actors converge on one record: likes on a post, inventory for a popular item, unread counts, job progress rows, tenant quota rows, auction bids, rate-limit buckets, or a last_seen field updated on every request. The outage may look like lock waits, slow commits, dead tuples, retry storms, or a saturated connection pool. The underlying shape is the same: one serialized write lane is carrying work that could have been spread out.`,
      ],
    },
    {
      heading: `The baseline and the wall`,
      paragraphs: [
        `The obvious design is a counter column. It is easy to understand, exact at read time, transactional, and small. For normal traffic, it is also the right design. A few updates per second against one row are not a crisis.`,
        `The wall appears when arrival rate exceeds the service rate of the serialized row. If the row can complete 900 locked updates per second and the application sends 1,000 increments per second, the backlog grows by 100 waiting writers every second. That is not a mild slowdown. It is an unstable queue that grows until clients time out and retries add more load.`,
        `MVCC storage engines add a second cost. An update usually creates a new tuple version and leaves the old version for cleanup. A counter updated 1,000 times per second also creates 1,000 dead versions per second. Cleanup may eventually recover the space, but indexes, vacuum workers, cache, and scans pay while the churn is happening.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The fix is to stop making every event rewrite the same cell at the same moment. Most counter increments are independent facts. A view happened. A like happened. A request consumed one token. Those facts do not need to compete for the current total if the system can combine them later.`,
        `Three common repairs use the same move at different levels. Sharded counters split one logical value across several rows and sum them on read. Append-and-aggregate writes each event as an insert and folds events into a summary in batches. A RAM accumulator absorbs increments in memory and flushes a batch to durable storage. Each design turns many contended updates into parallel writes plus a later combine step.`,
        `The invariant changes from "the row always contains the exact newest total" to "the system can derive an acceptable total from independently recorded contributions." That is the key engineering decision. If the business rule needs exact, instant visibility, you have less room. If it can tolerate staleness, approximation, or reconciliation, the write path can breathe.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `A sharded counter keeps the counter inside the database but gives it many write lanes. Instead of one row for video 42, store rows such as video 42 shard 0 through video 42 shard 15. Each increment chooses a shard, often by hashing request id, user id, or a random number. The write updates one shard row, and the read sums all shard counts.`,
        `This reduces contention by the shard count when writes are balanced. Sixteen shards turn 1,000 writes per second into about 62 writes per second per shard. Reads become more expensive because they must read and add the shards, but that is usually cheap compared with unbounded write contention. The shard count is a capacity knob, not a moral victory. Too few shards leave hot lanes. Too many shards make reads, migrations, and maintenance noisier.`,
        `Append-and-aggregate changes the shape more deeply. Each event becomes a new row in an append-only table or a message in a log. Inserts do not fight over one existing tuple, so the hot path becomes wide. A background worker periodically groups events by key, applies a batched update to a summary table, records a high-water mark, and deletes or archives processed events.`,
        `A RAM accumulator moves the first combine step out of the durable database. Redis INCR, an in-process striped counter, or a local aggregation buffer can absorb high write rates and flush every few seconds. This is write-back caching for counters. It is fast because it reduces durable writes, but it has a crash window unless paired with a log, replication, or idempotent replay.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Sharding works because addition is associative and commutative. If the final value is the sum of independent increments, the system can add lane totals in any order and get the same result. That algebra is what makes the split safe. It would not be safe for a state transition where order matters, such as spending from a balance without reservations.`,
        `Append-and-aggregate works because the event log preserves the facts that were previously collapsed into a single counter. The summary is a derived value. If the worker crashes after processing some events, the high-water mark or idempotency key tells it where to resume. If the summary is corrupted, the system can rebuild it from the event table as long as the source events are retained.`,
        `RAM accumulation works when the allowed loss or replay policy is explicit. A best-effort view counter can lose a few seconds of increments and remain useful. A quota, inventory count, entitlement, or bank balance cannot silently lose writes. The same shape can be technically fast and semantically wrong if the number carries authority.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `Suppose a video usually receives 30 views per second, then appears on a home page and jumps to 8,000 views per second. The old table has one row: video_id, view_count, updated_at. Each request runs an update against that row. The row lock becomes the queue, and every timeout retry increases the pressure.`,
        `A sharded repair creates 128 counter rows for that video. The application chooses a shard and increments that shard. The read path computes the total as the sum of the 128 rows, possibly cached for a short time. The total is exact at the moment of the read transaction, but reads now do more work and the application must maintain shard rows.`,
        `An append-and-aggregate repair inserts view events with video_id, event_id, created_at, and maybe user or session evidence. A worker consumes events in order, groups by video, updates a summary every ten seconds, and records the last processed event id. The public counter may be ten seconds stale, but the write path no longer melts the row. A reconciliation job can rescan recent events and compare the derived summary with the published value.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `The single-row design has the best semantics and the worst overload behavior. Reads are trivial and fresh. Writes are exact. Operations are simple. The cost is a hard serialized ceiling. A larger database can raise the ceiling, but it does not remove the single lane.`,
        `Sharded counters keep durable transactional writes while reducing contention. They cost more read work, more rows, more initialization logic, and harder migration. Resharding is not free because old and new shard layouts must both be understood during the transition. Skew also matters. If shard choice is based on a low-cardinality field, one shard can become hot again.`,
        `Append-and-aggregate gives the cleanest high-throughput write path but adds a pipeline. The worker needs idempotency, checkpoints, backpressure, lag monitoring, and a replay story. The summary is stale by design. The event table can grow quickly, so retention and compaction are part of the design, not cleanup chores for later.`,
        `RAM accumulation is the fastest and most dangerous option. It removes durable write pressure, but crash semantics move into the application. Replicated Redis, local write-ahead logs, frequent flushes, and idempotent event ids can reduce risk. They do not erase the need to state how much data may be lost and how operators will reconcile after a failure.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Detect hot rows by looking for lock wait time, update frequency by primary key, dead tuple churn, autovacuum lag, row-level contention events, and retry bursts. Averages hide the problem. The question is not whether the table is busy; it is whether one key receives a disproportionate share of writes.`,
        `Protect the database before redesign work lands. Add retry budgets, exponential backoff with jitter, request coalescing, and circuit breakers around the hot path. If clients retry without a cap, they can turn a 10 percent overload into a full outage. Idempotency keys matter because the system may process a request after the caller has already timed out.`,
        `Choose the repair from the invariant. If the value is advisory, use append-and-aggregate or RAM accumulation with clear staleness. If the value is exact but additive, use sharded counters. If the value enforces rights or money, model reservations, escrow, or serializable transactions instead of pretending a counter trick is enough.`,
        `Make reconciliation normal. Store enough evidence to recompute totals, compare summaries with source events, and explain differences. A counter system that cannot be audited will eventually drift silently, and silent drift is harder to fix than visible lag.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The common mistake is treating a faster machine as a fix. Better hardware may postpone the incident, but the shape remains serialized. Once the new arrival rate crosses the new service rate, the same queueing behavior returns.`,
        `Another mistake is moving contention without noticing. A sharded counter can move the hot spot to a cache key used for every read. An append pipeline can move the hot spot to one aggregator partition. A RAM accumulator can move the hot spot to a single Redis key. The design should split the actual hot operation, not just rename it.`,
        `The subtle failure is losing the business meaning of exactness. Public display counters, analytics, and telemetry often tolerate stale or approximate values. Inventory, balances, security quotas, and access entitlements usually do not. The data structure is only correct relative to that contract.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Sharding and Consistent Hashing for spreading write pressure, Write-Ahead Log and Transactional Outbox for durable event capture, LSM Tree for append-first storage, and Retries with Jitter for preventing overload amplification. PostgreSQL HOT Update Heap-Only Tuple is a narrower database optimization that helps some update-heavy rows but does not remove logical contention.`,
        `The broader lesson is shared with LongAdder, log-structured storage, message queues, and event sourcing. When many independent facts converge on one mutable location, ask whether the system needs to rewrite the total immediately or can record the facts first and combine them later.`,
      ],
    },
  ],
};
