// Jump consistent hash: constant-memory key placement for numbered buckets.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'jump-consistent-hash-case-study',
  title: 'Jump Consistent Hash Case Study',
  category: 'Systems',
  summary: 'A compact consistent-hashing algorithm: one 64-bit key plus a bucket count chooses a stable bucket with no ring, token table, or node scoring loop.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bucket jumps', 'add one bucket', 'tradeoff map'], defaultValue: 'bucket jumps' },
  ],
  run,
};

function labelMatrix(title, rowLabels, columnLabels, labelsByRow) {
  const labels = [''];
  const byLabel = new Map();
  const code = (label) => {
    if (!byLabel.has(label)) {
      byLabel.set(label, labels.length);
      labels.push(label);
    }
    return byLabel.get(label);
  };
  return matrixState({
    title,
    rows: rowLabels.map(([id, label]) => ({ id, label })),
    columns: columnLabels.map(([id, label]) => ({ id, label })),
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function hash64(text) {
  let hash = 1469598103934665603n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash;
}

function jumpHash(seed, bucketCount) {
  let bucket = -1n;
  let next = 0n;
  let key = BigInt.asUintN(64, seed);
  const limit = BigInt(bucketCount);
  const jumps = [];

  while (next < limit) {
    bucket = next;
    jumps.push(Number(bucket));
    key = BigInt.asUintN(64, key * 2862933555777941757n + 1n);
    next = ((bucket + 1n) * (1n << 31n)) / ((key >> 33n) + 1n);
  }

  return { bucket: Number(bucket), jumps };
}

const SAMPLE_KEYS = ['photo:5', 'photo:7', 'user:18', 'cart:5', 'ad:91', 'tenant:3', 'feed:44', 'clip:12', 'post:32'];

function mappingRows(fromBuckets, toBuckets) {
  return SAMPLE_KEYS.map((key, index) => {
    const before = jumpHash(hash64(key), fromBuckets).bucket;
    const after = jumpHash(hash64(key), toBuckets).bucket;
    return {
      id: `k${index}`,
      key,
      before,
      after,
      moved: before !== after,
    };
  });
}

function* bucketJumps() {
  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'photo:5', x: 0.7, y: 4.0, note: '64-bit key' },
        { id: 'b0', label: '0', x: 2.1, y: 4.0, note: 'first' },
        { id: 'b1', label: '1', x: 3.4, y: 3.0, note: 'jump' },
        { id: 'b4', label: '4', x: 4.9, y: 4.0, note: 'jump' },
        { id: 'b8', label: '8', x: 6.4, y: 3.0, note: 'last valid' },
        { id: 'past', label: 'past N', x: 8.1, y: 4.0, note: 'stop' },
      ],
      edges: [
        { id: 'e-key-b0', from: 'key', to: 'b0' },
        { id: 'e-b0-b1', from: 'b0', to: 'b1', weight: 'next' },
        { id: 'e-b1-b4', from: 'b1', to: 'b4', weight: 'next' },
        { id: 'e-b4-b8', from: 'b4', to: 'b8', weight: 'next' },
        { id: 'e-b8-past', from: 'b8', to: 'past', weight: 'stop' },
      ],
    }, { title: 'The key jumps through candidate buckets' }),
    highlight: { active: ['key', 'b0', 'b1', 'b4'], found: ['b8'], compare: ['past'] },
    explanation: 'Jump consistent hash turns a 64-bit key into a deterministic sequence of bucket numbers. For 9 buckets, photo:5 visits 0, 1, 4, then 8; the next computed jump would pass the bucket count, so 8 is the owner.',
    invariant: 'The chosen owner is the last jump that is still below bucket_count.',
  };

  yield {
    state: labelMatrix(
      'One key under different bucket counts',
      [
        ['n5', '5 buckets'],
        ['n6', '6 buckets'],
        ['n8', '8 buckets'],
        ['n9', '9 buckets'],
      ],
      [
        ['path', 'jump path'],
        ['owner', 'owner'],
        ['memory', 'stored map'],
      ],
      [
        ['0 -> 1 -> 4', '4', 'none'],
        ['0 -> 1 -> 4', '4', 'none'],
        ['0 -> 1 -> 4', '4', 'none'],
        ['0 -> 1 -> 4 -> 8', '8', 'none'],
      ],
    ),
    highlight: { active: ['n9:path', 'n9:owner'], found: ['n5:memory', 'n6:memory', 'n8:memory', 'n9:memory'] },
    explanation: 'The algorithm stores no token ring and no lookup table. It recomputes the jumps from the key and the current bucket count. Adding bucket 8 only changes keys whose next jump lands exactly on that new bucket.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.8, y: 4.0, note: 'hash64' },
        { id: 'count', label: 'bucket N', x: 2.7, y: 2.7, note: 'metadata' },
        { id: 'prng', label: 'PRNG', x: 2.7, y: 5.3, note: 'deterministic' },
        { id: 'jump', label: 'jump loop', x: 4.9, y: 4.0, note: 'log avg' },
        { id: 'owner', label: 'owner id', x: 7.1, y: 4.0, note: '0..N-1' },
      ],
      edges: [
        { id: 'e-key-prng', from: 'key', to: 'prng' },
        { id: 'e-count-jump', from: 'count', to: 'jump' },
        { id: 'e-prng-jump', from: 'prng', to: 'jump' },
        { id: 'e-jump-owner', from: 'jump', to: 'owner' },
      ],
    }, { title: 'Inputs and output' }),
    highlight: { active: ['key', 'count'], found: ['owner'] },
    explanation: 'The bucket ids must be dense integers from 0 to N - 1. That constraint is why Jump is excellent for numbered shards, partitions, or cache buckets, but less natural for arbitrary server membership churn than Rendezvous Hashing or Maglev.',
  };
}

function* addOneBucket() {
  const rows = mappingRows(8, 9);
  yield {
    state: labelMatrix(
      'Adding bucket 8',
      rows.map((row) => [row.id, row.key]),
      [
        ['before', '8 buckets'],
        ['after', '9 buckets'],
        ['moved', 'movement'],
      ],
      rows.map((row) => [
        `B${row.before}`,
        `B${row.after}`,
        row.moved ? 'move' : 'stay',
      ]),
    ),
    highlight: {
      active: rows.filter((row) => row.moved).map((row) => `${row.id}:moved`),
      found: rows.filter((row) => !row.moved).map((row) => `${row.id}:moved`),
      compare: ['k0:after'],
    },
    explanation: 'This toy cache grows from 8 to 9 buckets. Only photo:5 moves, and it moves to the new bucket B8. The other keys recompute the same owner because their jump sequence did not add a new valid landing point.',
    invariant: 'When adding bucket N, only keys that choose the new bucket N should move.',
  };

  yield {
    state: labelMatrix(
      'Modulo hashing versus Jump',
      [
        ['mod', 'key mod N'],
        ['ring', 'ring hashing'],
        ['jump', 'Jump hash'],
      ],
      [
        ['state', 'metadata'],
        ['grow', 'add 1 bucket'],
        ['ops', 'operator work'],
      ],
      [
        ['none', 'most keys move', 'simple but noisy'],
        ['token ring', 'small slice moves', 'manage tokens'],
        ['none', 'about 1/(N+1)', 'number buckets'],
      ],
    ),
    highlight: { found: ['jump:state', 'jump:grow'], compare: ['mod:grow'], active: ['ring:grow'] },
    explanation: 'Modulo hashing is metadata-free but not stable. Ring hashing is stable but stores token metadata. Jump keeps the stable-growth property while staying metadata-free, provided the physical system can expose a clean bucket-count abstraction.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'same code' },
        { id: 'map', label: 'bucket id', x: 2.5, y: 4.0, note: 'Jump' },
        { id: 'b0', label: 'B0', x: 4.4, y: 2.4, note: 'old' },
        { id: 'b4', label: 'B4', x: 4.4, y: 4.0, note: 'old' },
        { id: 'b8', label: 'B8', x: 4.4, y: 5.6, note: 'new' },
        { id: 'server', label: 'server', x: 6.7, y: 4.0, note: 'indirection' },
      ],
      edges: [
        { id: 'e-client-map', from: 'client', to: 'map' },
        { id: 'e-map-b0', from: 'map', to: 'b0' },
        { id: 'e-map-b4', from: 'map', to: 'b4' },
        { id: 'e-map-b8', from: 'map', to: 'b8', weight: 'new' },
        { id: 'e-b0-server', from: 'b0', to: 'server' },
        { id: 'e-b4-server', from: 'b4', to: 'server' },
        { id: 'e-b8-server', from: 'b8', to: 'server' },
      ],
    }, { title: 'Operational indirection' }),
    highlight: { active: ['b8'], found: ['server'], compare: ['b0', 'b4'] },
    explanation: 'Production systems usually separate logical bucket ids from physical machines. Jump chooses a bucket; a control-plane table maps buckets to servers. That indirection makes replacement and migration possible without pretending the hash function solves operations by itself.',
  };
}

function* tradeoffMap() {
  yield {
    state: labelMatrix(
      'Placement algorithm tradeoffs',
      [
        ['mod', 'mod N'],
        ['ring', 'ring hash'],
        ['hrw', 'HRW'],
        ['jump', 'Jump'],
        ['maglev', 'Maglev'],
      ],
      [
        ['metadata', 'metadata'],
        ['lookup', 'lookup'],
        ['best', 'best fit'],
        ['caveat', 'caveat'],
      ],
      [
        ['none', 'O(1)', 'fixed count', 'reshuffles'],
        ['tokens', 'O(log T)', 'storage rings', 'token ops'],
        ['node list', 'O(nodes)', 'top-k owners', 'large sets'],
        ['none', 'log avg', 'numbered buckets', 'removals'],
        ['table', 'O(1)', 'packet flows', 'rebuild table'],
      ],
    ),
    highlight: { active: ['jump:metadata', 'jump:best'], compare: ['hrw:lookup', 'maglev:metadata'] },
    explanation: 'Jump is not the new universal winner. It occupies a precise point in the design space: no placement metadata, fast lookup, good balance, and minimal movement when the bucket count increases. It pays for that elegance with numbered-bucket assumptions.',
  };

  yield {
    state: labelMatrix(
      'Where Jump fits',
      [
        ['cache', 'cache shards'],
        ['partition', 'table partitions'],
        ['worker', 'worker buckets'],
        ['replica', 'replica top-k'],
        ['packet', 'packet LB'],
      ],
      [
        ['fit', 'fit'],
        ['reason', 'reason'],
      ],
      [
        ['strong', 'dense bucket ids'],
        ['strong', 'logical partitions'],
        ['strong', 'add capacity'],
        ['weaker', 'needs ranking'],
        ['weaker', 'table better'],
      ],
    ),
    highlight: { found: ['cache:fit', 'partition:fit', 'worker:fit'], compare: ['replica:fit', 'packet:fit'] },
    explanation: 'Use Jump when the domain naturally has logical bucket numbers. Use HRW when the node set is arbitrary and top-k order matters. Use Maglev when the hot path is packet-speed lookup and a rebuilt table is acceptable.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'membership', label: 'members', x: 0.8, y: 4.0, note: 'truth' },
        { id: 'bucketCount', label: 'count', x: 2.6, y: 2.7, note: 'N' },
        { id: 'bucketMap', label: 'bucket map', x: 2.6, y: 5.3, note: 'owner table' },
        { id: 'jump', label: 'Jump', x: 4.7, y: 4.0, note: 'placement' },
        { id: 'routing', label: 'routing', x: 6.8, y: 4.0, note: 'serve' },
      ],
      edges: [
        { id: 'e-members-count', from: 'membership', to: 'bucketCount' },
        { id: 'e-members-map', from: 'membership', to: 'bucketMap' },
        { id: 'e-count-jump', from: 'bucketCount', to: 'jump' },
        { id: 'e-map-routing', from: 'bucketMap', to: 'routing' },
        { id: 'e-jump-routing', from: 'jump', to: 'routing' },
      ],
    }, { title: 'Hashing still needs a control plane' }),
    highlight: { active: ['membership'], found: ['jump', 'routing'], compare: ['bucketMap'] },
    explanation: 'The hash function answers only one question: which logical bucket owns this key? A real system still needs membership truth, migration throttling, health checks, observability, and a way to map bucket ids to physical servers.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bucket jumps') yield* bucketJumps();
  else if (view === 'add one bucket') yield* addOneBucket();
  else if (view === 'tradeoff map') yield* tradeoffMap();
  else throw new InputError('Pick a jump consistent hash view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the bucket-jumps view as one key moving through possible owners as the bucket count grows. The owner for the current count N is the last jump value below N. The first jump at or beyond N is the stopping proof.',
        'In the add-one-bucket view, watch which keys move when N changes to N + 1. A correct Jump placement either keeps a key on its old bucket or moves it to the new bucket. It should not move from one old bucket to another old bucket during pure growth.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems often need to place a key on one of N buckets: cache shards, table partitions, worker slots, or storage tablets. The placement should be deterministic, balanced, cheap to compute, and stable when capacity grows.',
        'Modulo hashing is cheap and balanced, but changing N reshuffles many keys among old buckets. Jump consistent hash targets the narrower case where buckets are dense integers from 0 through N - 1 and growth usually means adding the next bucket.',
        {type:'callout', text:'Jump consistent hash narrows the problem on purpose: dense bucket numbers make growth stable without storing a ring or per-bucket metadata.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/71/Consistent_Hashing_Sample_Illustration.png', alt:'A circular hash ring with server icons and a request hash value.', caption:'Consistent hashing sample illustration, WikiLinuz, CC BY-SA 4.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is hash(key) mod N. It needs no placement table and gives a good spread when the hash is uniform. For a fixed bucket count, it is hard to beat for simplicity.',
        'The next obvious approach is a hash ring with virtual nodes. That improves stability under membership changes but adds ring metadata, token management, and lookup complexity. Rendezvous hashing avoids the ring but scores every candidate bucket.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Modulo fails on growth because the divisor changes. A key with hash 123 maps to 3 when N = 10 and to 2 when N = 11. It did not move into the new bucket 10; it moved between old buckets, which creates avoidable cache misses or data migration.',
        'Rings and rendezvous hashing solve broader membership problems, but they pay metadata or per-node scoring costs. Jump asks a narrower question: can a client compute stable placement from only a key and a dense bucket count?',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'For each key, generate a deterministic increasing sequence of bucket numbers where the key would jump to a new owner as N grows. For a current count N, choose the last generated bucket below N.',
        'The invariant is monotonic ownership by bucket count. A key keeps the same owner between jumps and changes owner only when N reaches the next jump. During growth from N to N + 1, moved keys go to the new bucket N.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The published algorithm uses a 64-bit recurrence to produce the next jump without storing the whole sequence. It keeps the current bucket b, computes the next candidate j from a pseudo-random state derived from the key, and stops when j is at least the bucket count.',
        'The result is a logical bucket id. A production system usually keeps a separate bucket-to-server map, so Jump chooses B17 and the control plane decides which machine owns B17, whether it is migrating, and how stale clients are handled.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The minimal-movement argument follows from the jump sequence. If the next jump is 8, then counts 5 through 8 keep the same last valid owner until bucket 8 becomes available at count 9. No old bucket is reconsidered during that interval.',
        'For uniform 64-bit keys, the algorithm is designed so each bucket receives about the same fraction of keys and growth from N to N + 1 moves about 1 / (N + 1) of keys. That is the movement shape consistent hashing wants for pure bucket-count growth.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup uses constant placement memory and a short loop with average work that grows logarithmically with bucket count. Doubling the bucket count adds a small number of expected loop iterations, not a placement table. The operational memory for placement is O(1) inside the hash function.',
        'The real complexity is correctness across implementations. The algorithm depends on 64-bit arithmetic. JavaScript Number cannot exactly represent all 64-bit integer operations, so production code should use BigInt or a tested 64-bit helper with cross-language vectors.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Jump fits cache buckets, partition ids, worker slots, tenant shards, feature-store partitions, and storage systems where clients can compute a logical bucket locally. It is strongest when capacity grows by appending logical buckets.',
        'A common pattern is controlled scale-out. Create bucket N, prepare capacity, publish bucket count N + 1, and move only keys that now jump to N. For a cache, those keys can refill lazily; for durable storage, migration needs ownership state and read repair.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Jump alone is not enough for arbitrary physical membership changes, unequal weights, removing a middle bucket, replica top-k selection, or health-aware routing. Those require an indirection layer or a different algorithm such as rendezvous hashing.',
        'It also fails when clients disagree about N or the bucket-to-server map. The hash remains deterministic, but stale metadata deterministically sends traffic to the wrong owner. Rollout discipline is part of the placement system.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose key photo:5 has jump sequence 0, 1, 4, 8, 19. With N = 5 buckets, the valid jumps below 5 are 0, 1, and 4, so the owner is bucket 4. With N = 8, 8 is not below N, so the owner is still 4.',
        'When the system grows to N = 9, bucket 8 becomes valid, so photo:5 moves from bucket 4 to bucket 8. It does not move to bucket 2 or bucket 6. If 1,000,000 uniform keys grow from 8 to 9 buckets, the expected moved set is about 1 / 9, or roughly 111,111 keys, all to bucket 8.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Lamping and Veach, "A Fast, Minimal Memory, Consistent Hash Algorithm," plus Karger et al. on consistent hashing and the Dynamo paper for ring-based partitioning context. Study consistent hashing rings, rendezvous hashing, Maglev load balancing, sharding, partition maps, and hash tables next.',
        'A useful exercise is to test movement from N to N + 1 over 100,000 keys. Count how many stay, how many move to the new bucket, and whether any key moves from one old bucket to another. The last count should be zero for pure Jump growth.',
      ],
    },
  ],
};