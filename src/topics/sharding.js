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
      format: (v) => (v > 10 ? `${v}M` : ['', '', 'âš  S-names are common — 2Ã— the load'][v]),
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
      format: (v) => ['', 'spread evenly — fine', '40% of CLUSTER traffic on one shard âš ', 'celebrity#0…#15 â†’ 16 shards share the fire'][v],
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
        { id: 's4', label: 'shard 4', x: 6, y: 0.9, note: 'top 10 in 94ms âš  (GC pause)' },
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
      title: 'Casualty 3 — resharding day (4 â†’ 8 shards)',
      rows: [
        { id: 'naive', label: 'hash mod 4 â†’ mod 8' },
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
      heading: 'How to read the animation',
      paragraphs: [
        'The "splitting the table" view walks through partitioning strategies. Each shard is a row in the matrix. Row counts show data distribution; highlighted cells mark skew or imbalance. When a cell turns red, that shard is overloaded. Green cells mark balanced or repaired placements. The celebrity-problem frame shows how a single hot key can re-concentrate traffic even when row counts are perfectly even.',
        {
          type: 'callout',
          text: 'Sharding only stays cheap when the request names the partition key and the router can reduce the cluster to one shard.',
        },
        'The "what sharding breaks" view shows the costs. The graph frame draws a query router fanning out to four shards; the red shard and edge mark the straggler whose latency becomes the entire query\'s latency. Matrix frames compare single-shard transactions (green, fast) against cross-shard transactions (red, slow). The resharding frame contrasts naive mod-N remapping against consistent hashing by how much data must move.',
        'Watch for the contrast between highlighted and unhighlighted cells in each frame. The animation is designed so the highlighted state answers: "where is the pain right now?"',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single database server has finite storage, finite memory, and finite write throughput. A 4 TB table on a 6 TB disk has months of runway. An index that no longer fits in RAM turns every lookup into a disk seek. A single primary that must accept every write serializes the entire application\'s mutation rate through one machine.',
        'Replication does not solve this. Read replicas spread read traffic, but every replica still needs the full dataset, and one primary still owns every write. When the bottleneck is writes or storage, adding replicas adds cost without adding capacity where it matters.',
        'Sharding splits the data itself across machines. Each shard owns a subset of rows, handles its own reads and writes, maintains its own indexes, and runs its own maintenance. The result is not a bigger database; it is N independent databases that together cover the full key space. The partition key is the central design decision: it determines which operations stay cheap and local, and which become expensive distributed work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first move is vertical scaling: buy a bigger server with more RAM, faster disks, more cores. This works until it does not. The largest available machine has a price ceiling, a single point of failure, and maintenance windows that affect the entire dataset. Backups, restores, index rebuilds, and schema migrations all scale with the full table size.',
        'The second move is read replicas. They genuinely help when the bottleneck is read throughput: a reporting dashboard, a search index feeder, or a cache-miss path. Replicas are a proven, well-understood tool. But they do not split writes or storage.',
        'The third tempting move is to shard by whatever key is easiest to hash. If the application shards an orders table by order_id but the dominant query is "all orders for merchant X," every merchant query must scatter to every shard. The easy key was not the workload key, and the system pays fan-out on its hottest path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Vertical scaling hits a hard ceiling: the largest commercially available machine has a fixed amount of RAM, a fixed number of disk spindles or NVMe lanes, and a fixed write throughput. Beyond that ceiling, no amount of money buys a single bigger box.',
        'Read replicas hit a different ceiling: write throughput. One primary still serializes every insert, update, and delete. If the application writes 50,000 rows per second and the primary can sustain 40,000, adding ten read replicas changes nothing about the write path. The replication lag may even get worse under higher write load because each replica must replay the same write stream.',
        'The wall is: replicas scale reads; only partitioning scales writes and storage. Once the write rate or data volume exceeds what one machine can handle, the data must be split.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sharding is a bet on the partition key. If the operation names the key, the distributed system collapses to a local operation on one shard. If the operation cannot name the key, it becomes a scatter-gather across all shards, paying fan-out latency and coordination overhead.',
        'Every benefit of sharding flows from this: storage splits because each shard owns 1/N of the rows, write throughput splits because each shard accepts only its own writes, and index size shrinks because each shard indexes only its own data. Every cost of sharding also flows from this: cross-shard queries, cross-shard transactions, and resharding all exist because the partition key created a boundary.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A sharded system has three components: a partitioning function that maps a key to a partition, a shard map that records which machine owns each partition, and a routing layer that sends each request to the right owner.',
        {
          type: 'image',
          src: 'https://quickchart.io/graphviz?format=png&graph=digraph%20G%20%7Brankdir%3DLR%3Bnode%5Bshape%3Dbox%2Cstyle%3Drounded%5D%3BClient-%3ERouter%3BRouter-%3EShardA%5Blabel%3D%22key%20range%200-33%22%5D%3BRouter-%3EShardB%5Blabel%3D%22key%20range%2034-66%22%5D%3BRouter-%3EShardC%5Blabel%3D%22key%20range%2067-99%22%5D%3B%7D',
          alt: 'Client request routed through a shard router to one of three key ranges',
          caption: 'A sharded request goes through a routing layer that maps the partition key to an owning shard. Source: QuickChart Graphviz renderer https://quickchart.io/graphviz.',
        },
        'Range partitioning assigns contiguous key intervals to shards: users A-F on shard 1, G-M on shard 2. This preserves sort order, so range scans, sorted pagination, and time-window queries can stay on one shard. The cost is skew. Names starting with S are far more common than names starting with X. Timestamps concentrate all new writes on the newest range. Range partitioning gives useful neighborhoods, but neighborhoods have rush hours.',
        'Hash partitioning hashes the key and assigns hash-space segments to shards. Row counts balance well and point lookups become simple. The cost is lost locality: a query for users G through M now scatters across every shard. Naive hash(key) mod N also makes resharding brutal because changing N remaps most rows. Consistent hashing, rendezvous hashing, and jump consistent hashing reduce movement when shards are added or removed, but they do not restore range locality.',
        'Directory-based partitioning uses an explicit lookup table: key X lives on shard Y. This is the most flexible scheme because any key can be moved to any shard without changing the function. The cost is that the directory itself becomes a dependency on every request, so it must be fast, replicated, and cached. Vitess uses a VSchema (a directory mapping vindex keys to shards). MongoDB\'s config servers maintain chunk-to-shard mappings.',
        'Virtual shards decouple the logical partition from the physical machine. Instead of mapping keys directly to four machines, the system maps keys to 256 virtual shards, then maps those virtual shards to four machines. Rebalancing moves virtual shard ownership rather than redefining the key space. When a fifth machine arrives, 51 virtual shards migrate to it; the other 205 stay put.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'If four shards each own one quarter of the key space, storage is split four ways, each shard\'s index covers one quarter of the rows, compaction and vacuum run on one quarter of the data, and write throughput is distributed across four independent primaries. A point lookup that includes the partition key goes to exactly one shard, with the same latency as a single-node database.',
        'The correctness argument is straightforward: if the partition key fully determines shard ownership, and the operation touches only data within one partition, then no cross-shard coordination is needed. The operation is atomic, isolated, and durable on one machine using ordinary single-node ACID. The distributed cost appears only when a request crosses the partition boundary or when ownership changes.',
        'Scaling is roughly linear for key-aligned operations. Doubling the shard count halves per-shard storage and per-shard write rate, assuming the key distribution is reasonably uniform. The system does not get faster for any single query; it gets wider, handling more concurrent queries without contention.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cross-shard joins are expensive or impossible. A join between a users table sharded by user_id and an orders table sharded by order_id requires a full scatter to one table, then a lookup to the other for each matching row. Most sharded systems either co-locate related tables on the same shard key (Spanner interleaved tables, CockroachDB locality-optimized tables) or push joins to an analytics layer that can tolerate scatter-gather.',
        'Resharding is disruptive. Adding a shard means copying data, catching up changes that arrive during the copy, verifying consistency, switching routing, and monitoring for regressions. With naive mod-N hashing, doubling from 4 to 8 shards moves roughly 75% of all rows. Consistent hashing reduces movement to about 1/N per new shard, but the operational machinery (copy, verify, dual-write, cutover) remains.',
        'Hotspots appear when key distribution is skewed. Even perfect hash balance distributes rows, not requests. A celebrity account, a flash-sale product, or a viral post can send 40% of the cluster\'s traffic to one key and therefore one shard. Salting the hot key into key#0 through key#15 spreads the load across shards but complicates reads, which must now gather and merge the salted fragments.',
        'Operational complexity compounds. The system now has N databases to monitor, back up, upgrade, and fail over. Schema migrations must coordinate across all shards. Capacity planning must track per-shard skew, not just aggregate throughput. The shard map itself is critical metadata that needs versioning, replication, and careful rollout.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MongoDB auto-shards collections by a chosen shard key using either hash or range partitioning. The config servers maintain a chunk-to-shard directory, and the mongos router handles query routing and scatter-gather. Adding shards triggers automatic chunk migration.',
        'Vitess, built at YouTube, shards MySQL horizontally. A VSchema maps each table\'s vindex (partition key) to a set of shards. The vtgate proxy routes queries, rewrites cross-shard queries into scatter-gather, and supports resharding workflows that split or merge shards with minimal downtime.',
        'CockroachDB uses range-based partitioning. The key space is divided into ranges (default 512 MB each), and ranges are distributed across nodes using the Raft consensus protocol. Range splits and merges happen automatically based on size and load. Cross-range transactions use a parallel-commit protocol to minimize latency.',
        'DynamoDB partitions tables by hash of the partition key. Each partition handles up to 3,000 read capacity units, 1,000 write capacity units, and 10 GB of storage. When a partition exceeds these limits, DynamoDB splits it automatically. Adaptive capacity moves throughput from underused partitions to hot ones.',
        'Cassandra uses consistent hashing with virtual nodes (vnodes). Each physical node owns multiple token ranges, and the partition key\'s Murmur3 hash determines which token range (and therefore which node) owns the data. Adding a node redistributes vnodes, moving roughly 1/(node count) of the data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cross-shard transactions require Two-Phase Commit or an equivalent distributed protocol. 2PC adds a prepare round-trip, a coordinator that can fail, and blocking if the coordinator crashes between prepare and commit. Spanner uses TrueTime and 2PC together; CockroachDB uses hybrid-logical clocks and parallel commits. Both pay real latency for cross-range transactions compared to single-range ones.',
        'The celebrity problem defeats hash balance. A single key that receives a disproportionate share of traffic creates a hot shard that no amount of rebalancing can fix, because the key cannot be split further by the partition function alone. The fix is application-level: salt the key, cache aggressively, precompute derived data, or route celebrity traffic through dedicated infrastructure.',
        'Resharding under load is an engineering project, not a configuration change. Even with consistent hashing, the migration involves copying data, catching up the write stream, verifying correctness, switching routing atomically, and monitoring for data loss or stale reads. MongoDB, Vitess, and CockroachDB each have multi-step resharding workflows that take hours to days for large datasets.',
        'Operational complexity grows with shard count. Each shard needs monitoring, alerting, backup, restore testing, failover testing, and capacity planning. A schema migration that takes 10 minutes on one shard takes 10 minutes times N if run sequentially, or requires parallel coordination. Teams that shard prematurely often spend more engineering time managing the shard infrastructure than they saved by distributing the load.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A social application has 500 million users on one PostgreSQL primary. The users table is 4 TB. The team decides to shard by user_id mod 4, creating four shards.',
        'Shard 0 gets user_ids 0, 4, 8, 12, ... Shard 1 gets 1, 5, 9, 13, ... Shard 2 gets 2, 6, 10, 14, ... Shard 3 gets 3, 7, 11, 15, ... Each shard holds roughly 125 million users and 1 TB of data. Point lookups like getUser(id=4812) hash to shard 4812 mod 4 = 0 and go directly there. Profile updates for a single user stay on one shard. Storage, indexes, and compaction all shrink to one quarter.',
        'Six months later, growth requires a fifth shard. With mod-4 hashing, switching to mod-5 remaps roughly 80% of all user_ids to different shards. User 4812 was on shard 0 (4812 mod 4 = 0) but now belongs on shard 2 (4812 mod 5 = 2). The migration must copy 400 million user records while the application continues serving traffic. This is why production systems use consistent hashing or virtual shards from the start: adding a fifth node to a 256-vnode ring moves only about 51 vnodes (20% of data) instead of 80%.',
        'Another problem emerges: user_id 7 is a celebrity with 200 million followers. Queries for their profile, feed, and follower list generate 30% of the cluster\'s read traffic, all routed to shard 3 (7 mod 4 = 3). Shard 3\'s CPU saturates while shards 0, 1, and 2 sit at 25% utilization. The fix is not more shards. The team caches the celebrity\'s profile at the routing layer, precomputes their feed into a separate hot-key store, and salts follower-list lookups into celebrity_7_shard_0 through celebrity_7_shard_3 so the fan-out spreads across all shards.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'For placement algorithms that reduce data movement during resharding, study Consistent Hashing, Rendezvous Hashing (HRW), and Jump Consistent Hash. These are the tools that make adding or removing shards less painful than mod-N remapping.',
        'For the costs that sharding creates, study Two-Phase Commit and Saga Pattern for cross-shard transactions, Hot Rows for celebrity-key handling, and Tail Latency for why scatter-gather waits on the slowest shard.',
        'For production implementations, study the Spanner Case Study (range-based, TrueTime, cross-range 2PC), Bigtable Case Study (tablet splitting), Dynamo Case Study (consistent hashing with virtual nodes), and Cassandra Repair Case Study (anti-entropy in a hash-partitioned ring).',
        'The CAP theorem and Replication are prerequisites: sharding splits data, replication copies it, and CAP constrains what guarantees the combination can offer during network partitions. Distributed Transactions complete the picture of what coordination costs when operations cross shard boundaries.',
      ],
    },
  ],
};
