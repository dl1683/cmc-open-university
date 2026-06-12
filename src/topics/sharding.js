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
    explanation: 'The users table hits 500 million rows and the vertical-scaling escalator runs out: bigger boxes exist, but prices go exponential while the write ceiling stays stubbornly single-machine — read replicas multiply READS, but every write still funnels through one primary (and one hot primary is the Hot Rows & Append-and-Aggregate story at table scale). The remaining move is HORIZONTAL: cut the table into SHARDS (partitions), each a complete, smaller database on its own machine. The entire design question becomes: cut along WHAT?',
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
    explanation: 'RANGE PARTITIONING: sort by the key, cut into contiguous slices. Its superpower is locality — "every user G through M" is ONE shard, so range scans and sorted pagination stay cheap (this is how B-Tree-style stores think, and how Spanner and CockroachDB actually shard). Its curse is SKEW, twice over: keys are not uniform (N–S carries 185M rows to shard 1\'s 90M), and worse, ACCESS is not uniform — partition by timestamp and the newest shard absorbs literally every insert while the old ones nap. Range gives you meaningful neighborhoods, and neighborhoods have rush hours.',
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
    explanation: 'HASH PARTITIONING: route each row by hash(key) — adjacent keys scatter uniformly, 125M per shard, skew solved by construction. The price is exactly the superpower range had: locality is GONE — "users G through M" now lives everywhere, so range scans become cluster-wide sweeps. And use hash(key) mod N at your peril: adding a fifth machine remaps nearly every row. Consistent Hashing is the production fix — the ring moves only 1/N of keys per node change — which is why Cassandra and DynamoDB shard exactly this way. The strategy choice is really a query-pattern choice: point lookups → hash; scans and sorts → range.',
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
    explanation: 'The failure mode no partitioner fixes alone: hashing spreads KEYS evenly, not TRAFFIC. One celebrity\'s row — their follower feed, their auction item, their flash-sale SKU — can draw 40% of cluster load to whichever unlucky shard holds it. The standard moves: SALT the hot key (split it into key#0…key#15 sub-keys scattered across shards, re-aggregate on read — the sharded-counter trick from Hot Rows & Append-and-Aggregate at cluster scale), put a dedicated cache in front of it, or detect-and-isolate hot keys onto their own hardware. Skew is not a bug you fix once; it is weather you monitor forever.',
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
    explanation: 'Casualty 1 — QUERIES THAT DON\'T NAME THE PARTITION KEY. "Top 10 posts site-wide" cannot route to one shard; it SCATTERS to all of them, waits for every reply, and merges (gathering the per-shard top-10s). The latency is set by the SLOWEST shard — and with 4, 40, or 400 shards, SOMEBODY is always having a garbage-collection pause: at scale, scatter-gather turns every query\'s p50 into the fleet\'s p99 (the tail-at-scale problem). The design consequence is blunt: choose the partition key so your COMMON queries hit exactly one shard, and treat every scatter-gather in the codebase as a budget item.',
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
    explanation: 'Casualty 2 — ATOMICITY. Inside one shard, the database\'s entire transactional arsenal works untouched: Transaction Isolation Levels, instant commit, rollback. The moment a transaction spans shards, you are running a DISTRIBUTED transaction — Two-Phase Commit\'s blocking dance or the Saga Pattern\'s compensating workflow — paying coordinator round-trips and new failure modes for what used to be one fsync. Which is why the partition KEY should follow the transaction boundaries: shard a wallet system by account and transfers hurt; shard by user-pair region, or route both legs through an escrow row on one shard, and they don\'t. Schema design and shard design are the same design.',
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
    explanation: 'Casualty 3 — ELASTICITY. Growth eventually demands more shards, and now data must physically move while the system serves traffic: background-copy each migrating range, DUAL-WRITE to old and new homes during the overlap, verify checksums, flip the routing, hold your breath. Consistent Hashing (or range-split metadata like Spanner\'s) shrinks WHAT moves from 75% to a sliver — but nothing shrinks the operational ceremony. This is why the folk wisdom says over-partition on day one (Cassandra\'s vnodes: hundreds of virtual shards per machine, so "adding a node" just reassigns vnodes) and why "we\'ll shard later" is a famous last sentence: resharding a live system is some of the most delicate work in production engineering.',
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
    explanation: 'The checklist, distilled from every casualty. The deepest line is the first: sharding does not scale YOUR ACCESS PATTERNS — it scales exactly the access patterns that name the partition key, and quietly taxes all others (scatter-gather, cross-shard 2PC, hot spots). So the real design act is choosing what the system will be CHEAP at, knowing everything else gets expensive — the same honest trade as the CAP Theorem, Write-Through vs Write-Back, and every other page in this Systems tour: distribution never adds capability for free; it relocates cost. The craft is putting the cost where your workload isn\'t.',
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
      heading: `What it is`,
      paragraphs: [
        `Sharding is partitioning — cutting a table across multiple machines so no single machine holds all the data. When a table grows beyond one machine's storage or write capacity, you cannot scale faster by buying a bigger box (vertical scaling hits cost exponentials and write ceilings). Instead, you shard: split the table into smaller pieces, each a complete database on its own machine, and route queries to the right shard based on a partition key. Read replicas scale reads by spreading queries to many machines; sharding scales writes and storage by splitting the actual data. Replicas say "read this"; sharding says "this data lives here."`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Two partition strategies compete. RANGE partitioning cuts by sorted key order: users A–F on shard 1, G–M on shard 2. This preserves locality — range scans hit one shard and stay cheap. Spanner and CockroachDB shard this way. The curse is skew: timestamp partitioning concentrates every insert on the newest shard while old shards idle. HASH partitioning routes by hash(key mod N), spreading load evenly — 125M rows per shard. The penalty is total locality loss: "users G through M" scatter across all shards, so range scans become cluster-wide scatter-gather. Cassandra and DynamoDB use Consistent Hashing instead of naive mod-N because the ring moves only 1/N of keys when a node joins, not 75 percent. The choice is a query pattern choice: point lookups thrive on hash; scans and sorts need range.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The base cost is routing: every query must name or compute the partition key to hit the right shard. Point lookups against the key are free; any query that ignores the key costs scatter-gather — fanning out to all shards, collecting results, merging, and returning the slowest shard's answer. At scale (4, 40, or 400 shards), somebody is always experiencing a garbage-collection pause, so scatter-gather turns a query's median into the fleet's p99 tail latency. Transactions suffer: inside one shard they are ordinary ACID transactions; across shards they require Two-Phase Commit or Saga Pattern, paying coordinator round-trips and new failure modes. Finally, hot keys: hashing spreads keys evenly but not traffic. One celebrity's row can draw 40 percent of cluster traffic to one shard. The answer is key salting — split it into sub-keys and re-aggregate on read — but that is operational overhead and code complexity.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Cassandra and DynamoDB partition by hash; Spanner shards by range across zones; Uber shards customer and trip tables by location; payment systems shard by account to keep transfers single-shard. Shard strategy flows from the access pattern: Twitter's feed table (scanned and sorted by time) uses range; ride-matching (queried by location) uses geohash. The folk wisdom is over-partition early: Cassandra's vnodes run hundreds of virtual shards per machine so adding a node reassigns vnodes rather than moving data wholesale. Schema design and shard design are one: choose the partition key so your common queries stay local and your rare queries tolerate scatter-gather.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The trap: choose the wrong partition key and "all users in this region" scatters across every shard. Schema and workload must align at design time; resharding a live system is delicate production work. Range partitioning ambushes you with skew — timestamp ranges concentrate load on the newest shard; name ranges (N–S names are common) create 2× imbalance. Hash partitioning looks safer until one celebrity key draws 40 percent of traffic. Consistent Hashing solves naive mod-N resharding but does not solve starting without enough machines — over-partition on day one or live in resharding hell. A myth: sharding solves CAP Theorem. It does not. Sharding increases network partitioning risk and makes consistency consensus harder because two-phase commit carries latency and deadlock. The deepest lesson: distribution never adds capability for free. Sharding scales writes but taxes every query ignoring the partition key and forces transactions single-shard. The designer's job is honest trade: put cost where your workload is not.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Consistent Hashing is the production algorithm for hash-based sharding — learn why naive mod-N resharding moves 75 percent of data and how the ring fixes it. Hot Rows & Append-and-Aggregate shows the salting strategy for celebrity keys at scale. Two-Phase Commit (2PC) and Saga Pattern are the costs you pay for cross-shard transactions; understand their trade-offs. CAP Theorem is the broader constraint that sharding operates within — you can partition for scale, but you cannot partition away consistency risk. Transaction Isolation Levels matter because different isolation levels change which concurrent behaviors your single-shard transactions can safely ignore.`,
      ],
    },
  ],
};

