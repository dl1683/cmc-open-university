// Sharding: when the table outgrows the machine, split it across many —
// by range or by hash — and discover what the split costs: range scans,
// transactions, and the day you have to re-split everything.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'sharding',
  title: 'Sharding & Partitioning',
  category: 'Systems',
  summary: 'Split the table across machines by range or by hash — and learn exactly which superpowers stop working at the seams.',
  controls: [
    { id: 'view', label: 'Split', type: 'select', options: ['splitting the table', 'what sharding breaks'], defaultValue: 'splitting the table' },
  ],
  run,
};

function* splitting() {
  yield {
    state: matrixState({
      title: 'The wall: one machine, 500M users, write volume climbing',
      rows: [
        { id: 'disk', label: 'storage' },
        { id: 'writes', label: 'write throughput' },
        { id: 'mem', label: 'working set vs RAM' },
      ],
      columns: [{ id: 'status', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', '4 TB table on a 6 TB disk — months left', 'one primary takes EVERY write (replicas only help reads)', 'index no longer fits in memory — every lookup hits disk'][v],
    }),
    highlight: { removed: ['writes:status'] },
    explanation: 'This is the moment sharding exists for. Read replicas can spread reads, but a single primary still owns the writes and the storage. When the table, index, or write rate no longer fits one machine, the remaining move is to partition the data across machines. The hard part is not "add shards"; it is choosing the key that decides which queries, writes, and transactions stay local.',
    invariant: 'Replicas scale reads; only partitioning scales writes and storage.',
  };

  yield {
    state: matrixState({
      title: 'Strategy 1 — RANGE: cut along sorted key order',
      rows: [
        { id: 'sh1', label: 'shard 1: A–F' },
        { id: 'sh2', label: 'shard 2: G–M' },
        { id: 'sh3', label: 'shard 3: N–S' },
        { id: 'sh4', label: 'shard 4: T–Z' },
      ],
      columns: [{ id: 'rows', label: 'rows (millions)' }, { id: 'note', label: '' }],
      values: [[90, 1], [135, 1], [185, 2], [90, 1]],
      format: (v) => (v > 10 ? `${v}M` : ['', '', '⚠ S-names are common — 2× the load'][v]),
    }),
    highlight: { compare: ['sh3:rows', 'sh1:rows'] },
    explanation: 'Range partitioning preserves order. That makes range scans, sorted pagination, and locality-friendly workloads cheap because adjacent keys live together. The price is skew. Names, timestamps, tenants, and regions are rarely uniform, and access is often more skewed than data. A timestamp range can put every new write on the newest shard. Range gives useful neighborhoods, but neighborhoods have rush hours.',
    invariant: 'Range partitioning preserves order — and therefore concentrates both data skew and temporal hot spots.',
  };

  yield {
    state: matrixState({
      title: 'Strategy 2 — HASH: cut by scrambling the key',
      rows: [
        { id: 'h1', label: 'shard 1' },
        { id: 'h2', label: 'shard 2' },
        { id: 'h3', label: 'shard 3' },
        { id: 'h4', label: 'shard 4' },
      ],
      columns: [{ id: 'rows', label: 'rows (millions)' }, { id: 'range', label: '"users G–M" lives…' }],
      values: [[125, 1], [125, 1], [125, 1], [125, 1]],
      format: (v) => (v > 10 ? `${v}M` : 'scattered across ALL shards'),
    }),
    highlight: { found: ['h1:rows', 'h2:rows', 'h3:rows', 'h4:rows'], removed: ['h1:range'] },
    explanation: 'Hash partitioning scrambles adjacent keys so the row count evens out. Point lookups become simple and balanced. Locality disappears: a query for users G through M now touches every shard. A naive hash modulo shard count also makes resharding brutal, because changing N changes most placements. Consistent hashing and virtual shards reduce movement, but they do not bring range locality back. Hash is a point-lookup bet.',
  };

  yield {
    state: matrixState({
      title: 'The celebrity problem: even perfect hashing has one key too famous',
      rows: [
        { id: 'normal', label: '499,999,999 users' },
        { id: 'celeb', label: '@celebrity (1 row)' },
        { id: 'salt', label: 'fix: salt the key 16 ways' },
      ],
      columns: [{ id: 'load', label: 'load on its shard' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'spread evenly — fine', '40% of CLUSTER traffic on one shard ⚠', 'celebrity#0…#15 → 16 shards share the fire'][v],
    }),
    highlight: { removed: ['celeb:load'], found: ['salt:load'] },
    explanation: 'Even perfect key balance is not traffic balance. A celebrity account, flash-sale SKU, or viral post can send a huge share of requests to one key and therefore one shard. The usual repair is to split the hot key itself: salt it into key#0 through key#15, cache it aggressively, or move it to special handling. This is Hot Rows & Append-and-Aggregate at cluster scale. Sharding solves average distribution; hot keys are workload distribution.',
    invariant: 'Uniform key distribution does not imply uniform load: one hot key re-concentrates everything.',
  };
}

function* breaks() {
  yield {
    state: graphState({
      nodes: [
        { id: 'router', label: 'QUERY ROUTER', x: 1.2, y: 3.5, note: '"top 10 posts site-wide"' },
        { id: 's1', label: 'shard 1', x: 6, y: 6, note: 'top 10 in 12ms' },
        { id: 's2', label: 'shard 2', x: 7.5, y: 4.3, note: 'top 10 in 9ms' },
        { id: 's3', label: 'shard 3', x: 7.5, y: 2.5, note: 'top 10 in 11ms' },
        { id: 's4', label: 'shard 4', x: 6, y: 0.9, note: 'top 10 in 94ms ⚠ (GC pause)' },
      ],
      edges: [
        { id: 'e1', from: 'router', to: 's1' },
        { id: 'e2', from: 'router', to: 's2' },
        { id: 'e3', from: 'router', to: 's3' },
        { id: 'e4', from: 'router', to: 's4' },
      ],
    }),
    highlight: { active: ['e1', 'e2', 'e3'], removed: ['s4', 'e4'] },
    explanation: 'The first thing sharding breaks is any query that cannot name the partition key. "Top posts site-wide" must fan out, ask every shard, wait for the slowest reply, and merge partial results. That means one unlucky shard pause becomes user-visible latency. Scatter-gather is sometimes necessary, but it should be budgeted like an expensive operation, not treated as an ordinary select.',
    invariant: 'Scatter-gather latency = max over shards: fan-out converts one query\'s median into the fleet\'s tail.',
  };

  yield {
    state: matrixState({
      title: 'Casualty 2 — transactions stop at the shard boundary',
      rows: [
        { id: 'same', label: 'both users on shard 2' },
        { id: 'cross', label: 'users on shards 1 and 3' },
      ],
      columns: [{ id: 'tx', label: 'moving $50 between them' }],
      values: [[1], [2]],
      format: (v) => ['', 'ordinary ACID transaction — free, instant, atomic', 'needs Two-Phase Commit (2PC) or a Saga — slow, complex, can wedge'][v],
    }),
    highlight: { found: ['same:tx'], removed: ['cross:tx'] },
    explanation: 'The second casualty is transaction simplicity. Inside one shard, ACID is ordinary database machinery. Across shards, you need Two-Phase Commit, a saga, escrow, or some other distributed protocol. That adds latency and new failure states. A good partition key follows the transaction boundary, not just the lookup boundary. If transfers frequently touch two accounts, sharding purely by account makes the hardest path distributed by default.',
  };

  yield {
    state: matrixState({
      title: 'Casualty 3 — resharding day (4 → 8 shards)',
      rows: [
        { id: 'naive', label: 'hash mod 4 → mod 8' },
        { id: 'ring', label: 'consistent hashing' },
        { id: 'either', label: 'either way' },
      ],
      columns: [{ id: 'moves', label: 'data that must move' }, { id: 'how', label: 'the migration' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', '~75% of ALL rows', 'effectively a full re-import', 'only the split ranges (~1/8 each)', 'background copy + dual-write + cutover', 'weeks of careful work', 'still: copy, verify, dual-write, flip, watch'][v],
    }),
    highlight: { removed: ['naive:moves'], compare: ['ring:moves'] },
    explanation: 'The third casualty is easy growth. Adding shards means data movement while the system is live: copy, dual-write or catch up changes, verify, switch routing, and monitor the fallout. Consistent hashing or range-split metadata reduces how much data moves, but not the need for a careful migration. This is why mature systems over-partition into virtual shards early; moving virtual ownership is easier than inventing partitioning during an emergency.',
  };

  yield {
    state: matrixState({
      title: 'The shard designer\'s checklist',
      rows: [
        { id: 'key', label: 'pick the partition key by QUERY pattern' },
        { id: 'tx', label: 'keep transactions single-shard' },
        { id: 'over', label: 'over-partition early (vnodes)' },
        { id: 'skew', label: 'monitor skew like weather' },
      ],
      columns: [{ id: 'why', label: 'because' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'common queries must name it and hit ONE shard', '2PC/Sagas are the tax on crossing the seam', 'reassigning virtual shards beats moving real ones', 'celebrities, time ranges, and growth re-skew everything'][v],
    }),
    highlight: { active: ['key:why'] },
    explanation: 'The checklist is the whole topic: pick the key by common queries, keep important transactions single-shard, over-partition before you need it, and monitor skew continuously. Sharding does not make every workload faster. It makes the workloads aligned with the partition key cheaper, and makes the others pay with fan-out, distributed transactions, or special hot-key handling.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'splitting the table') yield* splitting();
  else if (view === 'what sharding breaks') yield* breaks();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sharding is splitting one logical dataset across multiple machines. It exists when one machine no longer has enough storage, write throughput, memory, or maintenance headroom to own the whole table. Replication helps read throughput and availability, but a single primary still has to accept the writes and store the full primary copy. When the table, index, or write stream outgrows that primary, the system needs partitioning.',
        'A shard owns a subset of the data. A router, client library, coordinator, or database layer uses a partition key to decide where each row and each request belongs. The partition key is the central design choice. It decides which reads are one-hop, which writes spread evenly, which transactions stay local, and which queries become distributed work.',
        'This is why sharding is not a generic "make the database bigger" button. It is a bet about the workload. The system becomes cheaper for operations aligned with the partition key and more expensive for operations that ignore it. A good design makes the common, correctness-sensitive paths local and leaves rare global paths to pay the distributed cost.',
      ],
    },
    {
      heading: 'Why obvious scaling fails',
      paragraphs: [
        'The first obvious answer is to buy a larger machine. Vertical scaling is useful, but it eventually hits cost, availability, and operational limits. Larger machines also make failures larger. Backups, restores, index rebuilds, vacuuming, compaction, and schema migrations all become slower when the whole dataset lives in one place.',
        'The second obvious answer is to add read replicas. Replicas are valuable, but they do not remove the write ceiling. A single primary still serializes writes for the shard it owns, and every replica still needs the full dataset or full replicated shard. Replicas multiply read capacity. They do not split storage ownership or make one hot write key less hot.',
        'The third tempting answer is to shard by whatever key is easiest to compute. That can be worse than not sharding. If the common query is "all orders for this merchant" and the data is sharded by order ID, the common query must scatter to many shards and merge the answers. The easy key was not the workload key.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'A sharded system needs three things: a partitioning function, a shard map, and a routing path. The partitioning function maps a logical key to a partition. The shard map records which machine or replica group owns each partition. The routing path sends reads and writes to the owner, handles retries, and updates its view when ownership changes.',
        'Range partitioning assigns contiguous key ranges to shards: users A through F, users G through M, timestamps from one month, or order IDs from one interval. Range partitioning preserves order, so scans, sorted pagination, time windows, and locality-sensitive storage can be efficient. The cost is skew. Names, tenants, regions, and timestamps are rarely uniform. New writes against a timestamp key often land on the newest range and create a hot shard.',
        'Hash partitioning hashes the partition key and assigns the hash space to shards. This usually balances row counts and makes point lookups simple. The cost is lost locality. A query for users G through M no longer maps to one range; it scatters across the hash space. Production systems also avoid naive hash(key) modulo N because changing N remaps too many rows. Consistent hashing, rendezvous hashing, jump consistent hashing, and virtual shards reduce movement when capacity changes.',
        'Virtual shards are an important implementation pattern. Instead of mapping each key directly to a physical machine, the system maps keys to many small logical partitions, then maps those partitions to machines. Rebalancing can move virtual shard ownership without redefining the whole key space. This gives operators a smaller unit for growth, repair, and hot-spot isolation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sharding works because it changes ownership. If four shards each own one quarter of the key space, then storage, indexes, compaction, cache pressure, write load, and backup work can be spread across four primary owners. A point lookup that includes the partition key can go directly to one shard. A write whose key maps to one shard can be accepted by that shard without coordinating with every other shard.',
        'The benefit is locality by design. A user-profile service that shards by user ID can route getUser(123), updateUser(123), and many user-local settings operations to one place. A multi-tenant SaaS system that shards by tenant ID can keep tenant-local queries, quotas, and billing updates together. A time-series system that range-shards by time can make recent-window scans efficient, if it also handles the newest-range hot spot.',
        'The proof idea is simple: if the operation names one partition and all required data lives in that partition, the distributed system collapses to a local operation for that request. The cost appears only when the request needs data owned by multiple partitions or when ownership itself changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a social application has 500 million users on one primary database. The user table is 4 TB, indexes no longer fit cleanly in memory, and write volume keeps climbing. Read replicas help feed timelines and profile reads, but the primary still owns every profile update, every follow edge write, and every storage maintenance task.',
        'The team first considers range sharding by username. That preserves alphabetical scans and can make some admin tasks easy, but it creates uneven ranges. Some letters and prefixes have many more users than others, and popular names can concentrate traffic. A timestamp range would be worse for writes because every new account lands on the newest range.',
        'The team then considers hash sharding by user ID. Point reads and writes spread well, and user-local profile updates become one-hop. The tradeoff is that alphabetical scans and some global queries now scatter. For a user-profile service, that is acceptable because the main path is "load this user ID" rather than "scan users G through M." For a reporting job, the system can use batch scatter-gather or a separate analytics store.',
        'A new problem appears after launch: one celebrity user receives a huge share of traffic. Hashing distributed rows evenly, but it did not distribute requests for that one key. The repair is not merely adding more shards. The team salts the hottest derived data, caches aggressively, precomputes fanout where possible, and routes certain celebrity paths through special handling. Average balance and hot-key balance are different problems.',
      ],
    },
    {
      heading: 'What sharding breaks',
      paragraphs: [
        'The first broken assumption is that every query remains cheap. A query that cannot name the partition key must fan out. "Top 10 posts site-wide" may ask every shard for its local top 10, wait for the slowest shard, and merge the results. Scatter-gather latency is dominated by the tail. One paused, overloaded, or garbage-collecting shard can become the user-visible latency of the whole request.',
        'The second broken assumption is that transactions stay simple. Inside one shard, the database can use its ordinary commit, rollback, locking, and isolation machinery. Across shards, the system needs Two-Phase Commit, a saga, escrow, reservation logic, idempotent retries, or application-level reconciliation. That adds latency and new failure states. A good partition key follows the transaction boundary whenever correctness matters.',
        'The third broken assumption is that growth is easy. Adding shards requires data movement while the system is live. The migration usually needs copy, verification, change capture or dual-write, routing cutover, monitoring, and rollback planning. Consistent hashing and virtual shards reduce movement, but they do not remove the operational risk. Resharding is a project, not a configuration toggle.',
        'The fourth broken assumption is that hash balance means load balance. A single hot key, hot tenant, flash-sale product, or viral post can dominate one shard. A range partition can also become hot when all new writes target the newest range. Skew is not a one-time design problem; it is a condition to monitor continuously.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'Sharding appears in user databases, payment ledgers, inventory systems, message stores, time-series databases, search indexes, analytics systems, queues, and object metadata services. The right key depends on the access pattern. User-facing profile systems often shard by user ID. Multi-tenant systems often shard by tenant when most operations are tenant-local. Location systems may shard by geospatial cells. Time-series systems often combine time ranges with hashing or bucketing to avoid a single hot newest partition.',
        'Different database families make different tradeoffs. Dynamo-style systems and Cassandra-style systems lean toward hash distribution because even spread and key-value access are central. Range-split systems such as Spanner-like and CockroachDB-like designs preserve order and locality because scans, locality, and ordered keys matter. Search and analytics systems tolerate more scatter-gather because distributed merge is already part of their query model.',
        'The common rule is stable: choose the partition key by the access paths and correctness boundaries that cannot afford to be slow. If a payment transfer, inventory reservation, entitlement check, or tenant quota update must be correct and fast, design to keep the critical data local or explicitly budget the distributed protocol.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Start by listing the top reads, top writes, top transactions, top maintenance jobs, and top global queries. For each one, mark whether it contains the candidate partition key. If the hot path cannot name the key, the design will route the hot path through scatter-gather. If the critical transaction crosses keys, the design will route correctness through a distributed protocol.',
        'Over-partition earlier than physical capacity requires. Many virtual shards mapped onto fewer machines give the system room to rebalance later. Track per-shard storage, write rate, read rate, p95 and p99 latency, queue depth, compaction pressure, cache hit rate, hot keys, and failed routing attempts. Averages hide the problems that sharding creates.',
        'Design resharding before the emergency. The migration plan should cover snapshot copy, incremental catch-up, dual-read or dual-write strategy, idempotency, verification, routing metadata updates, backpressure, rollback, and observability. The shard map is critical metadata, so it needs versioning, safe rollout, and clear failure behavior.',
        'Make cross-shard operations explicit in the API. Some systems reject them on hot paths. Some route them to asynchronous workflows. Some use Two-Phase Commit only for rare admin paths. Some maintain derived global indexes or analytics projections. The important engineering habit is to name the distributed cost instead of hiding it behind a method that looks local.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study next: Consistent Hashing, Rendezvous Hashing HRW, and Jump Consistent Hash Case Study for placement that moves less data during growth. Hot Rows and Append-and-Aggregate explains salting and aggregation for celebrity keys. Tail Latency explains why scatter-gather waits on the slowest shard.',
        'For correctness costs, study Transaction Isolation Levels, Two-Phase Commit, Saga Pattern, Idempotency, Distributed Locks, and Quorums. For storage and query design, study Cassandra Repair Case Study, Dynamo Case Study, Bigtable Case Study, Spanner Case Study, Range Tree Orthogonal Range Search, B-Tree, LSM Trees, and Message Queue. The same partitioning lesson shows up in each system: the key decides what stays local.',
      ],
    },
  ],
};
