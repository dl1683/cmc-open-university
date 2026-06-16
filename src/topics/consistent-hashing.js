// Consistent hashing: how Cassandra, DynamoDB, and every distributed cache
// decide which server owns which key — on a ring, so that adding a server
// moves almost nothing.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'consistent-hashing',
  title: 'Consistent Hashing',
  category: 'Systems',
  summary: 'Hash servers AND keys onto a ring — adding a server moves only its neighbors\' keys, not everything.',
  controls: [
    { id: 'event', label: 'Then', type: 'select', options: ['add a server', 'remove a server'], defaultValue: 'add a server' },
  ],
  run,
};

// Ring positions in degrees (0–360). Deterministic stand-ins for hash values.
const SERVERS = [
  { id: 'S1', label: 'S1', angle: 20 },
  { id: 'S2', label: 'S2', angle: 140 },
  { id: 'S3', label: 'S3', angle: 260 },
];
const NEW_SERVER = { id: 'S4', label: 'S4', angle: 320 };
const KEYS = [
  { id: 'k17', label: '17', angle: 65 }, { id: 'k42', label: '42', angle: 110 },
  { id: 'k58', label: '58', angle: 180 }, { id: 'k73', label: '73', angle: 235 },
  { id: 'k86', label: '86', angle: 295 }, { id: 'k91', label: '91', angle: 345 },
];

// place on a circle, 12 o'clock = 0°, clockwise
const place = (angle) => ({
  x: 5 + 4.2 * Math.sin((angle * Math.PI) / 180),
  y: 5 + 4.2 * Math.cos((angle * Math.PI) / 180),
});

const ownerOf = (keyAngle, servers) => {
  const sorted = [...servers].sort((a, b) => a.angle - b.angle);
  return sorted.find((s) => s.angle >= keyAngle) ?? sorted[0];
};

export function* run(input) {
  const addMode = String(input.event) !== 'remove a server';

  const ringNodes = (servers, keys) => {
    const all = [
      ...servers.map((s) => ({ id: s.id, label: s.label, ...place(s.angle), note: 'server' })),
      ...keys.map((k) => ({ id: k.id, label: k.label, ...place(k.angle), note: `→ ${ownerOf(k.angle, servers).id}` })),
    ].sort((a, b) => angleOf(a, servers, keys) - angleOf(b, servers, keys));
    const edges = all.map((n, i) => ({
      id: `e${i}`, from: n.id, to: all[(i + 1) % all.length].id,
    }));
    return graphState({ nodes: all, edges });
  };
  const angleOf = (node, servers, keys) =>
    (servers.find((s) => s.id === node.id) ?? keys.find((k) => k.id === node.id)).angle;

  yield {
    state: ringNodes(SERVERS, []),
    highlight: {},
    explanation: `The naive way to spread keys over 3 servers is "key mod 3". It works — until you add a 4th server and "mod 4" reshuffles nearly EVERY key to a new owner: a cluster-wide stampede of data movement. Consistent hashing fixes this with one idea: hash the SERVERS onto a circle (0–360), not just the keys. S1, S2, S3 land at 20°, 140°, 260°.`,
  };

  yield {
    state: ringNodes(SERVERS, KEYS),
    highlight: { active: KEYS.map((k) => k.id) },
    explanation: `Now hash each key onto the same circle, and apply the OWNERSHIP RULE: a key belongs to the first server walking CLOCKWISE from it. Key 17 (at 65°) walks to S2 (140°); key 86 (at 295°) wraps past 360° back to S1 (20°). Each node's tag shows its owner. No central table — any client that knows the server list can compute every owner locally.`,
    invariant: 'owner(key) = first server clockwise from hash(key) on the ring.',
  };

  if (addMode) {
    const grown = [...SERVERS, NEW_SERVER];
    const moved = KEYS.filter((k) => ownerOf(k.angle, grown).id !== ownerOf(k.angle, SERVERS).id);
    yield {
      state: ringNodes(grown, KEYS),
      highlight: { active: [NEW_SERVER.id], swap: moved.map((k) => k.id) },
      explanation: `Add server S4 at 320°. Watch what moves: ONLY ${moved.map((k) => `key ${k.label}`).join(' and ')} — the keys between S3 (260°) and S4 (320°), which now hit S4 first on their clockwise walk. Every other key's owner is untouched. With mod-N hashing, ${KEYS.length - 1} of ${KEYS.length} keys would have moved; here it's ${moved.length} of ${KEYS.length}.`,
    };
    yield {
      state: ringNodes(grown, KEYS),
      highlight: {},
      explanation: `That's the whole superpower: adding (or losing) a server disturbs only its ring-neighbors — on average K/N keys, the theoretical minimum. One refinement makes it production-grade: each physical server gets 100–300 VIRTUAL nodes (multiple ring positions), smoothing out lucky/unlucky gaps so load stays even. This exact ring runs inside Cassandra and DynamoDB (each node owns token ranges, data replicated to the next R nodes clockwise), Memcached client libraries, and CDN request routing.`,
    };
  } else {
    const remaining = SERVERS.filter((s) => s.id !== 'S2');
    const orphans = KEYS.filter((k) => ownerOf(k.angle, SERVERS).id === 'S2');
    yield {
      state: ringNodes(remaining, KEYS),
      highlight: { swap: orphans.map((k) => k.id) },
      explanation: `S2 dies (hardware fails; it happens daily at scale). Its keys — ${orphans.map((k) => k.label).join(', ')} — simply continue their clockwise walk to the NEXT server, ${ownerOf(141, remaining).id}. No other key moves at all. Failure handling falls out of the same rule as placement.`,
    };
    yield {
      state: ringNodes(remaining, KEYS),
      highlight: {},
      explanation: `In Cassandra and DynamoDB, each key is also REPLICATED to the next 2–3 servers clockwise — so when S2 dies, its successor already has the data and takes over instantly. Ring + clockwise rule + replication = a database that survives hardware death without a coordinator. One refinement to know: virtual nodes (each server appears 100–300 times on the ring) keep the load even.`,
    };
  }
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Consistent hashing is a placement trick for systems whose server set changes. Ordinary modulo hashing maps key_hash % server_count; add one server, the divisor changes, and nearly every key moves. Consistent hashing maps both keys and servers onto the same circular hash space. A key belongs to the first server clockwise from its position, so adding a server only steals the arc immediately before it. In a 100-node cache, adding one node moves about 1 percent of keys instead of almost 100 percent.`,
        `The idea was formalized by Karger and colleagues in 1997 and became famous through Amazon's Dynamo paper in 2007. It is not just a Hash Table with more servers; it is a way to keep ownership stable while machines fail, scale out, or return from maintenance. That stability is why it appears in Memcached clients, Cassandra-style storage, CDN routing, and cache-aware Load Balancer designs.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Imagine a 0 to 2^32 - 1 ring. Hash server A to position 100, server B to 400, and server C to 800. A key that hashes to 350 walks clockwise to B; a key at 900 wraps around to A. To add server D at 600, only keys in the interval (400, 600] move from C to D. To remove B, its interval moves to C. The invariant is local movement: membership changes affect neighbors, not the whole cluster.`,
        `Real deployments use virtual nodes, also called tokens. One physical server may own 16, 128, or 256 positions on the ring, depending on the system and version. Virtual nodes smooth random gaps and make capacity weighting easy: a server with twice the RAM receives twice as many tokens. Replication is also ring-based: store the key on the next R distinct physical servers clockwise, skipping duplicate virtual nodes for the same machine.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Lookup is O(log T) with binary search over T sorted tokens, or effectively constant when T is small and cached. Ring metadata is O(T), tiny compared with data. Rebalancing is the real cost: adding one equal-capacity node to N nodes moves roughly K / (N + 1) keys, plus network transfer, compaction, cache warming, and replica repair. If each key averages 4 KB and 2 TB must move, the algorithmic win still becomes hours of I/O.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Cassandra partitions rows by token, then stores them in LSM Trees (How Cassandra Writes) on the owning replicas. Riak and the original Dynamo design used the same family of ring ideas. Memcached client libraries often compute the ring locally so losing one cache server invalidates only that server's slice. CDNs use related placement to keep users near edge capacity, while storage systems combine the ring with Sharding & Partitioning so each shard has a clear owner.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The ring is deterministic only if every participant sees the same membership list. A stale client can route to the wrong owner, causing forwarding loops or failed reads. Systems use a Gossip Protocol, a control plane, or a strongly consistent metadata store to spread membership changes.`,
        `The bigger misconception is that even key counts mean even load. One celebrity user's timeline, one viral product page, or one tenant's nightly job can dominate a shard. Virtual nodes smooth ownership, not popularity. Hot Rows & Append-and-Aggregate is the follow-up technique when one logical key is hotter than any single node can handle. Bloom Filter structures help reads avoid unnecessary SSTable probes, but they do not solve hot-key traffic.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary sources: Karger et al. on consistent hashing at https://dl.acm.org/doi/10.1145/258533.258660 and the Dynamo paper at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf. Start with Hash Table for the hashing model, then Sharding & Partitioning for the broader data-placement problem. Jump Consistent Hash Case Study shows the no-ring, constant-memory version for numbered buckets. Rendezvous Hashing (HRW) shows the score-every-node version for top-k placement, while Maglev Load Balancer Case Study shows the precomputed-table version for packet-speed routing. CAP Theorem explains what happens when ring members disagree during a partition. Then connect the storage path through LSM Trees (How Cassandra Writes), Bloom Filter, and Hot Rows & Append-and-Aggregate.`,
      ],
    },
  ],
};
