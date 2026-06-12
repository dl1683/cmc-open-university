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
        `Consistent hashing places servers AND keys on a ring (a circle with angles from 0° to 360°). Each key belongs to the first server walking clockwise from it. When you add a server, only keys between the new server and the previous server on the ring need to move—not all keys like in naive modulo hashing. When you remove a server, its keys walk to the next server; everything else stays put.`,
        `This is how Cassandra, DynamoDB, Memcached, and Redis Cluster decide which replica holds which data without a central coordinator. The ring is deterministic: any client with the server list can compute ownership instantly.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Hash each physical server to a position on the ring—say S1 to 20°, S2 to 140°, S3 to 260°. Hash each key the same way: key 17 lands at 65°. Apply the ownership rule: walk clockwise from the key until you hit a server. Key 17 → S2 (first server at 140° or higher).`,
        `To add server S4 at 320°: keys between S3 (260°) and S4 (320°) now walk to S4 instead of wrapping to S1. Everything else is unaffected. To remove S2: its keys simply continue to the next server (S3). The cost scales: adding 1 server to N servers moves only K/N keys on average (the theoretical minimum).`,
        `A refinement: each physical server gets 100–300 virtual ring positions. Instead of one unlucky gap causing imbalance, gaps smooth out and load stays even. Cassandra and DynamoDB use this by default.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Lookup (finding a key's owner): O(log S) with a sorted server list and binary search, or O(1) with a hash table if S is small. Adding/removing a server: O(1) to update the ring, O(K/N) to move keys. Building the ring initially: O(S log S) to sort server positions.`,
        `Memory for ring metadata: O(S × V) where V is virtual nodes per server (typically 100–300). Negligible compared to the data.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Cassandra assigns each node a token range (a slice of the ring). Data hashes to a token, and the replica set is the N clockwise servers from that token. Failures are handled by replication: the next server in the ring already has the data. DynamoDB uses the same ring logic for its shard distribution.`,
        `Memcached client libraries (like python-memcached) run consistent hashing in the client—no central coordinator, cache misses are local, not cluster-wide. Redis Cluster, HAProxy, load balancers, and CDN request routers all lean on the same ring idea.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `"The ring is deterministic, so two clients always agree." — True, ONLY if they see the same server list. A stale client with an old ring can route to the wrong server and trigger a forwarding cascade. Consistency requires all clients to learn server changes quickly.`,
        `"Without virtual nodes, the ring is unfair." — Correct. If S1 is at 20° and S2 is at 21°, S2 owns 360°; S1 owns 1°. Virtual nodes (same server at many angles) smooth this out—modern systems use 100+.`,
        `"Consistent hashing guarantees equal load." — Wrong. Load depends on access patterns (some keys are hot) and ring distribution (bad luck with server positions). Virtual nodes help, but monitoring and rebalancing during failures are still needed.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Learn Hash Table to understand hashing fundamentals. Then explore LSM Trees to see how Cassandra actually stores the data (once you know WHICH server owns it). Study Load Balancer to see how ring ideas apply to spreading requests. Finally, examine Bloom Filter, because consistent hashing nodes use bloom filters to avoid scanning every SSTable on a read miss.`,
      ],
    },
  ],
};

