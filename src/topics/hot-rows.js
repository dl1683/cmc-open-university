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
    explanation: 'A video goes viral: 1,000 views per second, each one running UPDATE views SET count = count + 1 on the SAME row. Transaction Isolation Levels explained why this must serialize: two transactions cannot both rewrite a row, so the database takes a per-row lock and forms a queue. One writer writes; nine hundred ninety-nine wait. The row is "hot" — and notice the cruelty: the database is doing nothing wrong. Correct, isolated, durable… one at a time. Politeness IS the bottleneck.',
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
    explanation: 'The arithmetic of melting: each locked update costs ~1.1ms (lock, write, WAL flush — the Write-Ahead Logging toll), so the row services ~900/s. Arrivals: 1,000/s. The line grows by 100 writers EVERY SECOND, forever — queueing theory\'s simplest and harshest law: when arrivals exceed service, the queue does not find a new equilibrium, it grows without bound. Thirty seconds in: 3,000 waiting connections, client timeouts firing, retries ADDING to the arrival rate (the Message Queue death spiral). A system at 111% of one row\'s capacity is not 11% degraded — it is failing.',
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
    explanation: 'Even if the locks held up, MVCC Internals presents the second invoice: every UPDATE is secretly an INSERT-plus-corpse, so this one logical row manufactures a thousand dead tuples per second — 86 million per day — bloating pages, indexes, and caches while VACUUM sprints to keep up. One row, two independent failure modes (contention and bloat), one root cause: we designed a write-hot singleton in a system whose unit of concurrency is the row. The fix is not a faster database. It is to stop having a hot row — four ways, next view.',
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
    explanation: 'Design B — SHARDED COUNTERS: replace the one row with 16, and each increment picks one (round-robin or hash of the connection). Per-row load drops to ~62/s — far under the ~900/s melting point — and the corpses spread across 16 rows that autovacuum can actually service. Reading the total now costs a SUM over 16 rows: microseconds, who cares. This is Consistent Hashing\'s instinct applied to a single value, and it is exactly how distributed counters work in Cassandra and how Java\'s LongAdder beats AtomicLong under contention. Trade: a fixed shard count to choose, and reads see a value that is the sum of 16 slightly-skewed moments.',
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
    explanation: 'Design C — APPEND-AND-AGGREGATE, the structural cure: stop UPDATING anything. Each view INSERTS a tiny event row — and inserts to the END of a table do not contend with each other (every write gets its own fresh row; there is no shared lock to fight over). A background aggregator wakes every ten seconds, sums the new events into the summary row — ONE update per ten seconds instead of ten thousand — and prunes the processed events. Reads hit the summary (plus, if they care, the recent tail). You have seen this exact shape three times: the LSM Tree (append memtable, compact later), Write-Back caching (absorb now, flush batched), and the Message Queue (producers append, consumers process at their own pace).',
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
    explanation: 'Design D — move the hot spot OUT of the database entirely: a RAM counter (Redis INCR does ~100k/s without blinking — single-threaded, no locks needed) absorbing the storm, with a flush job writing one consolidated UPDATE per interval. This is Write-Through vs Write-Back\'s exact bargain wearing application clothes: blazing absorption, and a crash window — die between flushes and ten seconds of views are gone. For a VIEW COUNTER, obviously acceptable (nobody audits view counts to the unit). For a BANK BALANCE, obviously not — which is the entire decision procedure: price the lost window, not the architecture.',
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
    explanation: 'The scorecard, with the diagonal trade in plain sight: every row down gains throughput and pays in freshness or durability. The unifying lesson reaches well past counters: WHENEVER many writers converge on one piece of state — a counter, an inventory level, a leaderboard, a "last_seen" timestamp — the design move is always the same: turn the UPDATE everyone fights over into INSERTS nobody fights over, and let a single consolidator pay the update cost once per batch. Event sourcing is this idea promoted to an architecture; WAL, LSM, write-back, and message queues are it at every layer below. Databases are excellent at many things; sharing one mutable cell among a thousand writers was never going to be one of them.',
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
      heading: `What it is`,
      paragraphs: [
        `A hot row is one database row receiving thousands of writes per second — a single cell everyone tries to modify at once. A viral counter is the archetype: one video goes viral, each view runs UPDATE views SET count = count + 1 on the SAME row, and the database's core guarantee (one writer at a time per row, for correctness) becomes the bottleneck. Row-level locking enforces serialization, which means a queue: one thousand writers per second become one writer executing, nine hundred ninety-nine waiting. The queue grows forever, clients time out, retries arrive. This is not a bug — it is a misalignment between what you asked (share one mutable cell) and what databases were designed for (concurrent reads and writes to different rows).`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Each UPDATE costs roughly 1.1 milliseconds: lock, write, flush the Write-Ahead Log, unlock. Service rate: ~900/s. Arrivals: 1,000/s. The queue grows by 100 writers every second, forever. Queueing theory: arrivals exceed service, no equilibrium, unbounded growth. In sixty seconds, 6,000 clients waiting. Timeouts fire, retries compound the problem.`,
        `The second bill is MVCC: every UPDATE births a corpse. One row, 1,000 dead tuples per second, 86 million per day. VACUUM races to clean them but cannot keep up; tables and indexes bloat. A hot row fails twice: contention (clients wait) and bloat (the database chokes).`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A single row: ~900 writes/s, unlimited garbage. The four designs show the trade-off spectrum. Design B (sharded counters): split 16 ways, ~14,000/s, trades read freshness (SUM aggregation). Design C (append-and-aggregate): inserts do not contend, background aggregator sums every 10s, ~50,000/s, ten-second staleness. Design D (RAM accumulator): counter in Redis, ~100,000/s, crashes lose the unflushed window. The scorecard diagonal is clear: throughput grows, freshness and durability fade.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Social-media counters (views, likes on viral posts), game leaderboards, real-time inventory, activity feeds, auction systems — all encounter this. The lesson generalizes: when many writers contend for one piece of state (a balance, a timestamp, an engagement metric), the naive UPDATE approach hits a ceiling. Pinterest and Twitter scaled using sharding. Cassandra and DynamoDB default to sharded patterns because the problem is universal.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Faster hardware does not solve this — it raises the ceiling, then arrivals exceed it again. You cannot have unlimited throughput, instant freshness, and complete durability; choose two. Sharding requires picking a shard count upfront. Append-and-aggregate introduces staleness. RAM caching risks the crash window. The real trap: thinking one row can efficiently serve one thousand writers. It cannot. Databases excel at many things; sharing a mutable cell among a thousand writers was never one of them.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Learn MVCC Internals & VACUUM to understand why one hot row becomes a corpse factory. Study Message Queue and Consistent Hashing: the former shows the append-and-consolidate shape (producers, consumers); the latter shows how sharding distributes a hot value. LSM Tree reveals how write-optimized databases internalize the append pattern. Write-Through vs Write-Back explains the RAM cache trade-off.`,
      ],
    },
  ],
};
