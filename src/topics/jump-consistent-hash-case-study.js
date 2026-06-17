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
      heading: 'Problem',
      paragraphs: [
        'Distributed systems often need to place a key on one of N buckets: cache shards, table partitions, work queues, or logical tablets. The placement should be balanced, deterministic, and stable when capacity grows.',
        'Modulo hashing gives deterministic balance with no metadata, but it is unstable under growth. Changing N changes most remainders. Jump consistent hash targets the narrower and very useful case where buckets are dense integers 0 through N - 1 and capacity is usually added by increasing N.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A token ring gives stable movement by storing many virtual-node positions. Rendezvous hashing avoids a ring but scores every candidate node. Maglev precomputes a table for very fast packet lookup. Those are good tools, but each adds metadata, per-node scoring, or table rebuilds.',
        'Jump asks a sharper question: if the only public input is a key and a bucket count, can a client compute a stable bucket without carrying a placement table? The answer is yes, as long as the system can preserve the dense logical-bucket abstraction.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'For each key, generate a deterministic increasing sequence of bucket numbers. Interpret each number as a bucket count threshold where that key would jump to a new owner. For a current bucket count N, the owner is the last generated bucket id that is still below N.',
        'The published algorithm implements that idea with a small 64-bit recurrence. It keeps the current bucket b, computes the next jump j from the pseudo-random state, and stops when j >= N. No token ring, virtual-node table, or node list is needed on the lookup path.',
      ],
    },
    {
      heading: 'Invariant and proof idea',
      paragraphs: [
        'The invariant is monotonic ownership by bucket count: a key keeps the same owner while N lies between two consecutive jumps, and it changes owner only when N reaches the next jump. Therefore increasing N cannot reshuffle existing buckets among themselves.',
        'For uniform 64-bit keys, the algorithm is designed so each bucket receives about the same fraction of keys and growth from N to N + 1 moves about 1 / (N + 1) of keys, all to the new bucket. That is the minimal-movement shape wanted from consistent hashing under pure bucket-count growth.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'The animation uses the key photo:5. With 5, 6, or 8 buckets, its jump path is 0 -> 1 -> 4, so bucket 4 owns the key. With 9 buckets, the next jump, 8, becomes valid, so ownership moves to bucket 8.',
        'That example shows the whole contract. Adding bucket 8 does not cause photo:5 to choose a different old bucket. It either keeps bucket 4 or moves to the newly valid bucket 8.',
      ],
    },
    {
      heading: 'Animation guide',
      paragraphs: [
        'In the bucket-jumps view, follow the last valid node, not the first node after the key. The past-N node is the stopping proof: once the next jump is outside the current count, the previous bucket is final.',
        'In the add-one-bucket view, read the movement column as an operations bill. Only rows marked move require migration or cache refill. In the tradeoff-map view, compare Jump against ring hashing, HRW, and Maglev by metadata and membership assumptions, not by a vague idea of "consistent hashing".',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Lookup uses constant placement memory and a short loop whose average work grows logarithmically with the bucket count. The implementation still needs careful 64-bit arithmetic; JavaScript versions should use BigInt or a tested 64-bit helper instead of normal Number multiplication.',
        'The operational cost is outside the hash function. A real system still needs a source of truth for N, a bucket-to-server map, migration state, health checks, cache warming, and a stale-client plan.',
      ],
    },
    {
      heading: 'Tradeoffs',
      paragraphs: [
        'Compared with modulo hashing, Jump keeps the no-metadata lookup shape but avoids mass reshuffling on growth. Compared with ring hashing, it removes token management. Compared with HRW, it avoids scoring every node. Compared with Maglev, it avoids a precomputed lookup table.',
        'The trade is flexibility. Jump is cleanest for logical buckets, not arbitrary physical membership. It handles adding one bucket naturally, but removals, weights, heterogeneous capacity, and replica ordering need another layer or another algorithm.',
      ],
    },
    {
      heading: 'Useful contexts',
      paragraphs: [
        'Jump fits cache buckets, partition ids, worker slots, tenant shards, feature-store partitions, and storage systems where clients can compute a logical bucket locally before consulting a small control-plane map.',
        'A common pattern is controlled scale-out: create bucket N, prepare capacity for it, publish N + 1 to clients, then migrate only the keys that now jump to the new bucket.',
      ],
    },
    {
      heading: 'Limits',
      paragraphs: [
        'Do not use Jump alone when physical nodes appear and disappear by arbitrary ids, when replicas need a ranked top-k list, when buckets have unequal weights, or when a middle bucket must be removed without a logical indirection table.',
        'Also do not confuse minimal movement with complete operational safety. If clients disagree about N or about the bucket-to-server map, the deterministic hash will deterministically send traffic to different places.',
      ],
    },
    {
      heading: 'Why modulo fails',
      paragraphs: [
        'Modulo hashing looks like the perfect baseline: hash the key, take hash mod N, and use the result as the bucket id. It is fast, balanced for good hashes, and stores no placement metadata. Its failure appears when N changes.',
        'When a system grows from 8 to 9 buckets, the remainder for most keys changes because the divisor changed. The key is not moving only into the new bucket. It is being reassigned across old buckets as well. For caches, that means avoidable cold misses. For storage, it means a migration storm.',
        'Consistent hashing is the family of techniques that tries to preserve most assignments as membership changes. Jump is the unusually small member of that family for the case where membership can be represented as a dense bucket count.',
      ],
    },
    {
      heading: 'Implementation details',
      paragraphs: [
        'The published Jump algorithm depends on 64-bit unsigned arithmetic. In JavaScript, ordinary Number multiplication cannot represent every 64-bit integer exactly. Use BigInt, a tested unsigned 64-bit helper, or a library implementation that has known cross-language test vectors.',
        'Every client must use the same hash-to-64-bit function, byte encoding, bucket count, and integer arithmetic. A signed overflow difference between languages is enough to split traffic. This matters when one service is written in Go, another in JavaScript, and another in Rust.',
        'The bucket ids are logical ids. A production system usually keeps a separate bucket-to-server table. Jump chooses B17; the control plane decides which machine currently owns B17, whether B17 is migrating, and what to do if that owner is unhealthy.',
      ],
    },
    {
      heading: 'Adding capacity',
      paragraphs: [
        'The clean growth path is deliberate. Create the new logical bucket, prepare its physical capacity, publish the new bucket count, and migrate only keys that now map to the new bucket. The hash function gives the target set, but the control plane still schedules the work.',
        'For a cache, migration may be lazy. Keys that jump to the new bucket miss and refill. For durable storage, migration needs ownership state, copy progress, read repair, write routing, and a moment when the new bucket becomes authoritative.',
        'Minimal movement is valuable because it bounds the blast radius of a scale-out event. It does not remove the need for backpressure, throttling, observability, or rollback when the new capacity is slower than expected.',
      ],
    },
    {
      heading: 'Removals and weights',
      paragraphs: [
        'Jump is most natural when buckets are added at the end. Removing bucket N - 1 can be modeled by decreasing the count, but removing bucket 3 from a 100-bucket system is not clean unless a logical indirection layer absorbs the change.',
        'Unequal capacity is also outside the basic algorithm. If one server is twice as large as another, you can represent that with more logical buckets assigned to the larger server, but then the bucket map becomes part of the design. At that point Jump is still useful, but it is no longer the whole placement system.',
        'Replica placement is another separate requirement. Jump returns one bucket. If the application needs a ranked list of independent owners, Rendezvous Hashing or another top-k placement method may be a better match.',
      ],
    },
    {
      heading: 'Testing the contract',
      paragraphs: [
        'Test determinism first. Fixed keys and bucket counts should produce fixed owners across every implementation language. Include edge cases such as bucket count 1, large bucket counts, empty keys, Unicode input after encoding, and maximum 64-bit hash values.',
        'Test movement second. When growing from N to N + 1, keys should either stay where they are or move to the new bucket N. They should not move from one old bucket to another. A sampled movement rate close to 1 / (N + 1) is a useful sanity check.',
        'Test operational disagreement too. Simulate clients with stale N and stale bucket maps. The hash function cannot protect you from split-brain metadata, so the system needs a rollout plan that tolerates mixed versions during deployment.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Lamping and Veach, "A Fast, Minimal Memory, Consistent Hash Algorithm" at https://arxiv.org/abs/1406.2294 and https://arxiv.org/pdf/1406.2294. For the older ring family, see Karger et al. at https://dl.acm.org/doi/10.1145/258533.258660 and Dynamo at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf.',
        'Study Consistent Hashing for token rings, Rendezvous Hashing for node scoring and top-k placement, Maglev Load Balancer Case Study for table-based packet routing, Sharding and Partitioning for logical ownership, and Hash Table for deterministic key placement.',
      ],
    },
  ],
};
