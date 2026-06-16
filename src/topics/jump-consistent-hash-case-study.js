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
      heading: 'What it is',
      paragraphs: [
        'Jump consistent hash is a compact placement algorithm from John Lamping and Eric Veach. Given a 64-bit key and a bucket count, it returns one bucket id in the range 0..N-1. It is consistent in the practical scale-out sense: when N grows to N + 1, only about 1 / (N + 1) of keys move, and the moved keys go to the new bucket.',
        'That makes it a useful sibling to Consistent Hashing rather than a replacement for every ring. A ring stores token positions and finds the next clockwise owner. Rendezvous Hashing scores every candidate node and can naturally produce a top-k replica order. Maglev builds a table for packet-speed flow balancing. Jump does something narrower and very powerful: stable placement over dense, numbered buckets with essentially no placement metadata.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algorithm imagines each key moving through a pseudo-random sequence of bucket numbers. It starts at bucket 0, computes a jump to a larger bucket, then repeats until the next jump would be outside the current bucket count. The last in-range bucket is the owner. The sequence is deterministic because it is derived from the key, so every client with the same bucket count computes the same owner.',
        'The animation uses photo:5 as a concrete key. With 9 buckets, its jump path is 0 -> 1 -> 4 -> 8, so bucket 8 owns the key. With only 8 buckets, the path stops at 4 because 8 is out of range. That exact behavior explains the low movement during growth: when bucket 8 appears, only keys whose next jump lands at 8 move.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Jump uses constant placement memory. There is no ring array, no virtual-node table, and no per-node scoring loop. The original paper reports very small code and fast lookup, with average work that grows logarithmically with the bucket count. The memory win is especially attractive when many clients need to compute placement locally and shipping token metadata to all of them would be messy.',
        'The main limitation is also simple: buckets must be numbered sequentially. If a server disappears from the middle of a fleet, bucket ids do not naturally close up without moving many keys. Real systems handle this by making buckets logical and mapping those bucket ids to physical servers through a separate control-plane table. Weighted capacity also needs extra design; a larger machine might receive more logical buckets, but that mapping is outside the core hash.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a sharded image-cache service with 8 logical buckets. Clients compute Jump(hash(image_id), 8), then consult a small bucket-to-server map. The team adds one cache node and creates bucket 8. During rollout, clients switch to bucket_count = 9 after the new bucket is ready. Roughly one ninth of image ids move to the new bucket; the rest continue hitting their old buckets, so cache churn is bounded and migration can be throttled.',
        'This is cleaner than key mod N, where changing N tends to reshuffle nearly every key. It is operationally lighter than a token ring if the product already thinks in numbered partitions. The case study becomes stronger when linked to Sharding & Partitioning: Jump chooses the logical partition, while the storage or cache control plane decides where that partition lives today.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use Jump as a blind replacement for Rendezvous Hashing. HRW is better when the candidate set is arbitrary, when nodes frequently leave, or when you need a deterministic top-k list for replicas and failover. Do not use it as a blind replacement for Maglev either. Maglev spends memory on a lookup table because packet balancing wants a tiny hot path and graceful backend churn.',
        'The other trap is confusing the hash function with the distributed system. Jump does not detect failed nodes, agree on membership, warm a cache, drain traffic, throttle migration, or prevent stale clients from routing with the wrong bucket count. Those responsibilities belong to the same operational layer you study in Load Balancer, Circuit Breakers & Deadlines, Gossip Protocol, and Distributed Tracing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Lamping and Veach, "A Fast, Minimal Memory, Consistent Hash Algorithm" at https://arxiv.org/abs/1406.2294 and the PDF at https://arxiv.org/pdf/1406.2294. For the older ring family, see Karger et al. at https://dl.acm.org/doi/10.1145/258533.258660 and the Dynamo paper at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf. Study Consistent Hashing for token rings, Rendezvous Hashing (HRW) for node scoring and top-k placement, Maglev Load Balancer Case Study for table-based packet routing, Sharding & Partitioning for logical bucket ownership, and Hash Table for the underlying deterministic-key idea.',
      ],
    },
  ],
};
