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
  const shardCount = 4;
  const totalUsers = 500; // millions
  const perShardHash = totalUsers / shardCount; // 125M

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
    explanation: `This is the moment sharding exists for. Read replicas can spread reads, but a single primary still owns the writes and the storage. When the table, index, or write rate no longer fits one machine, the remaining move is to partition the data across ${shardCount} or more machines. The hard part is not "add shards"; it is choosing the key that decides which queries, writes, and transactions stay local.`,
    invariant: `Replicas scale reads; only partitioning (here into ${shardCount} shards) scales writes and storage.`,
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
    explanation: `Range partitioning preserves order across ${shardCount} shards. That makes range scans, sorted pagination, and locality-friendly workloads cheap because adjacent keys live together. The price is skew: with ${totalUsers}M users split into ${shardCount} ranges, names, timestamps, tenants, and regions are rarely uniform, and access is often more skewed than data. A timestamp range can put every new write on the newest shard. Range gives useful neighborhoods, but neighborhoods have rush hours.`,
    invariant: `Range partitioning preserves order — and therefore concentrates both data skew and temporal hot spots across ${shardCount} shards.`,
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
    explanation: `Hash partitioning scrambles adjacent keys so each of the ${shardCount} shards holds exactly ${perShardHash}M rows. Point lookups become simple and balanced. Locality disappears: a query for users G through M now touches every shard. A naive hash modulo ${shardCount} also makes resharding brutal, because changing N changes most placements. Consistent hashing and virtual shards reduce movement, but they do not bring range locality back. Hash is a point-lookup bet.`,
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
    explanation: `Even perfect key balance across ${shardCount} shards is not traffic balance. A celebrity account, flash-sale SKU, or viral post can send a huge share of requests to one key and therefore one shard. The usual repair is to split the hot key itself: salt it into key#0 through key#15, cache it aggressively, or move it to special handling. With ${totalUsers}M users perfectly balanced at ${perShardHash}M each, one hot key still re-concentrates everything.`,
    invariant: `Uniform key distribution across ${shardCount} shards does not imply uniform load: one hot key re-concentrates everything.`,
  };
}

function* breaks() {
  const shardCount = 4;
  const newShardCount = 8;

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
    explanation: `The first thing sharding breaks is any query that cannot name the partition key. "Top posts site-wide" must fan out to all ${shardCount} shards, wait for the slowest reply, and merge partial results. That means one unlucky shard pause becomes user-visible latency. Scatter-gather is sometimes necessary, but it should be budgeted like an expensive operation, not treated as an ordinary select.`,
    invariant: `Scatter-gather latency = max over ${shardCount} shards: fan-out converts one query's median into the fleet's tail.`,
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
    explanation: `The second casualty is transaction simplicity. Inside one of the ${shardCount} shards, ACID is ordinary database machinery. Across shards, you need Two-Phase Commit, a saga, escrow, or some other distributed protocol. That adds latency and new failure states. A good partition key follows the transaction boundary, not just the lookup boundary. If transfers frequently touch two accounts, sharding purely by account across ${shardCount} shards makes the hardest path distributed by default.`,
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
    explanation: `The third casualty is easy growth. Doubling from ${shardCount} to ${newShardCount} shards means data movement while the system is live: copy, dual-write or catch up changes, verify, switch routing, and monitor the fallout. Consistent hashing or range-split metadata reduces how much data moves (from ~75% with mod-${shardCount} to ~1/${newShardCount} each), but not the need for a careful migration. This is why mature systems over-partition into virtual shards early; moving virtual ownership is easier than inventing partitioning during an emergency.`,
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
    explanation: `The checklist is the whole topic: pick the key by common queries, keep important transactions single-shard, over-partition before you need ${newShardCount} real shards, and monitor skew continuously. Sharding across ${shardCount} or more nodes does not make every workload faster. It makes the workloads aligned with the partition key cheaper, and makes the others pay with fan-out, distributed transactions, or special hot-key handling.`,
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
        'Read the animation as a routing problem. A shard is one database partition that owns part of the data, and the partition key is the value used to decide which shard owns a row.',
        {
          type: 'callout',
          text: 'Sharding only stays cheap when the request names the partition key and the router can reduce the cluster to one shard.',
        },
        'Each row in the matrix is a shard. Green means the request stayed local or balanced; red means one shard is overloaded, one query has fanned out, or one transaction crossed the partition boundary.',
        'The safe inference rule is key alignment. If the request names the partition key, the router can pick one shard; if it does not, the system must scatter, coordinate, or reject the operation.',
      
        {type: 'image', src: './assets/gifs/sharding.gif', alt: 'Animated walkthrough of the sharding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A single database machine has finite disk, memory, write throughput, and maintenance capacity. When a table grows from 500 GB to 8 TB, indexes stop fitting in memory and backups stop being quick operations.',
        'Replication helps read traffic but not total storage or primary write capacity. Every replica still stores the full data set, and one primary may still accept every write.',
        'Sharding exists when the data itself must be split. Each shard owns a subset of rows, so storage, indexes, writes, compaction, and maintenance are divided across machines.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is vertical scaling: buy a larger server with more RAM, faster storage, and more CPU. This is simple, and it can be the right move for years.',
        'The next approach is read replication. Replicas genuinely help dashboards, search feeders, and read-heavy services whose write rate is still manageable.',
        'A tempting third approach is to shard by the easiest ID to hash. That can balance row counts while making the hottest query scatter to every shard.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Vertical scaling hits a physical and economic ceiling. The largest box still has one failure domain and one maintenance surface for the whole data set.',
        'Read replication hits the write wall. If one primary can handle 40,000 writes per second and the application needs 60,000, adding read replicas does not increase primary write throughput.',
        'The deeper wall is workload shape. A shard key that does not match the common access path turns local database work into distributed fan-out.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sharding is a bet that most important operations can name the partition key. When that bet is true, a distributed database collapses to one local database operation.',
        'The same boundary creates the cost. Queries, joins, and transactions that cross the key boundary need scatter-gather, two-phase commit, denormalization, or a different data model.',
        'The partition key is therefore a product decision as much as a storage decision. It encodes which questions will stay cheap.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A sharded system has a partition function, a shard map, and a router. The partition function maps keys to logical partitions, the shard map maps partitions to machines, and the router sends each request to the owner.',
        {
          type: 'image',
          src: 'https://quickchart.io/graphviz?format=png&graph=digraph%20G%20%7Brankdir%3DLR%3Bnode%5Bshape%3Dbox%2Cstyle%3Drounded%5D%3BClient-%3ERouter%3BRouter-%3EShardA%5Blabel%3D%22key%20range%200-33%22%5D%3BRouter-%3EShardB%5Blabel%3D%22key%20range%2034-66%22%5D%3BRouter-%3EShardC%5Blabel%3D%22key%20range%2067-99%22%5D%3B%7D',
          alt: 'Client request routed through a shard router to one of three key ranges',
          caption: 'A sharded request goes through a routing layer that maps the partition key to an owning shard. Source: QuickChart Graphviz renderer https://quickchart.io/graphviz.',
        },
        'Range partitioning assigns contiguous key intervals to shards. It preserves locality for range scans but can create hot ranges, especially for timestamps or popular prefixes.',
        'Hash partitioning spreads keys by hash value. It balances row counts well for point lookups but destroys range locality and makes naive mod-N resharding move many rows.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is exclusive ownership: every key belongs to exactly one shard at a given shard-map version. A point lookup that includes the key can be routed to that owner and handled with ordinary single-node database rules.',
        'If four shards split a table evenly, each shard stores about one quarter of the rows and maintains indexes over that quarter. Key-aligned writes also distribute across four primaries instead of one.',
        'Correctness becomes harder only when an operation touches multiple owners or ownership changes. Then the system needs a protocol for coordination, migration, or temporary dual routing.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'For key-aligned point operations, sharding gives near O(1) routing plus one shard operation. Doubling shard count can roughly halve per-shard storage and write load if the key distribution is balanced.',
        'Scatter-gather cost grows with shard count. A query across 16 shards waits for the slowest relevant shard, so tail latency can dominate even if average shard latency looks healthy.',
        'Resharding is operationally expensive. The system must copy data, catch up writes during the copy, verify consistency, switch routing, and monitor stale reads or missed writes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MongoDB shards collections by a chosen shard key and routes through mongos with config servers holding chunk metadata. The fit is operational partitioning of large collections under a declared key.',
        'Vitess shards MySQL using vindexes and a vtgate routing layer. It fits applications that want MySQL semantics while splitting storage and writes horizontally.',
        'Cassandra-style systems hash partition keys across token ranges, while range-based systems split sorted key space into movable ranges. Both designs use shard ownership to turn one large data set into many smaller ownership units.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the shard key and workload disagree. If orders are sharded by order_id but the hot query asks for all orders for merchant_id, every merchant query may fan out.',
        'It fails on hot keys. A celebrity user, flash-sale item, or viral post can send a large share of traffic to one shard even when row counts are balanced.',
        'It fails when teams treat resharding as a setting change. Moving live data safely is a migration project with correctness checks, rollback planning, and capacity headroom.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A service has 400 million user rows and 4 TB of data on one primary. It shards by user_id mod 4 into four shards, so each shard holds about 100 million rows and 1 TB.',
        'A lookup for user_id 4812 goes to shard 0 because 4812 mod 4 = 0. A lookup for user_id 4813 goes to shard 1, so single-user reads and writes stay local.',
        'Later the team adds a fifth shard and naively changes to mod 5. User 4812 now maps to shard 2 because 4812 mod 5 = 2, and most rows move, which is why production systems use virtual shards or consistent hashing to reduce movement.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary study sources: the MongoDB sharding manual at https://www.mongodb.com/docs/manual/sharding/, Vitess documentation at https://vitess.io/docs/, Cassandra architecture notes at https://cassandra.apache.org/doc/latest/cassandra/architecture/, and DynamoDB partition-key documentation at https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.Partitions.html.',
        'Study consistent hashing, rendezvous hashing, two-phase commit, tail latency, hot rows, replication, CAP theorem, and distributed transactions next. Those topics explain the costs created by the shard boundary.',
      ],
    },
  ],
};
