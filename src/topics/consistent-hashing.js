// Consistent hashing: place servers and keys on one hash ring so membership
// changes move only affected token ranges instead of the whole keyspace.

import { graphState } from '../core/state.js';

export const topic = {
  id: 'consistent-hashing',
  title: 'Consistent Hashing',
  category: 'Systems',
  summary: 'Hash servers and keys onto a ring so adding or removing a server moves only the neighboring key range, not the whole keyspace.',
  controls: [
    { id: 'event', label: 'Then', type: 'select', options: ['add a server', 'remove a server'], defaultValue: 'add a server' },
  ],
  run,
};

// Ring positions in degrees. These are deterministic stand-ins for hash values.
const SERVERS = [
  { id: 'S1', label: 'S1', angle: 20 },
  { id: 'S2', label: 'S2', angle: 140 },
  { id: 'S3', label: 'S3', angle: 260 },
];
const NEW_SERVER = { id: 'S4', label: 'S4', angle: 320 };
const KEYS = [
  { id: 'k17', label: '17', angle: 65 },
  { id: 'k42', label: '42', angle: 110 },
  { id: 'k58', label: '58', angle: 180 },
  { id: 'k73', label: '73', angle: 235 },
  { id: 'k86', label: '86', angle: 295 },
  { id: 'k91', label: '91', angle: 345 },
];

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

  const angleOf = (node, servers, keys) =>
    (servers.find((s) => s.id === node.id) ?? keys.find((k) => k.id === node.id)).angle;

  const ringNodes = (servers, keys) => {
    const all = [
      ...servers.map((s) => ({ id: s.id, label: s.label, ...place(s.angle), note: 'server' })),
      ...keys.map((k) => ({ id: k.id, label: k.label, ...place(k.angle), note: `to ${ownerOf(k.angle, servers).id}` })),
    ].sort((a, b) => angleOf(a, servers, keys) - angleOf(b, servers, keys));
    const edges = all.map((n, i) => ({
      id: `e${i}`,
      from: n.id,
      to: all[(i + 1) % all.length].id,
    }));
    return graphState({ nodes: all, edges });
  };

  yield {
    state: ringNodes(SERVERS, []),
    highlight: {},
    explanation: 'Modulo hashing spreads keys evenly only while the server count is fixed. When the count changes, most keys get a new remainder. Consistent hashing instead places servers on a stable ring. S1, S2, and S3 occupy fixed token positions, so ownership is expressed as ranges on the ring.',
  };

  yield {
    state: ringNodes(SERVERS, KEYS),
    highlight: { active: KEYS.map((k) => k.id) },
    explanation: 'Now hash each key onto the same ring. The ownership rule is first server clockwise from the key. Key 17 walks to S2. Key 86 wraps around the end of the ring and lands on S1. Any client with the same token list can compute the same owner locally.',
    invariant: 'owner(key) = first server clockwise from hash(key) on the ring.',
  };

  if (addMode) {
    const grown = [...SERVERS, NEW_SERVER];
    const moved = KEYS.filter((k) => ownerOf(k.angle, grown).id !== ownerOf(k.angle, SERVERS).id);
    yield {
      state: ringNodes(grown, KEYS),
      highlight: { active: [NEW_SERVER.id], swap: moved.map((k) => k.id) },
      explanation: `Add server S4 at token 320. Only ${moved.map((k) => `key ${k.label}`).join(' and ')} move: the keys in the range that now reaches S4 before the old successor. Every other key still finds the same first-clockwise server. The algorithm localizes movement to the new server's predecessor range.`,
    };
    yield {
      state: ringNodes(grown, KEYS),
      highlight: {},
      explanation: 'Adding or losing a server disturbs only neighboring token ranges. Production systems add virtual nodes so each physical server owns many smaller ranges, smoothing out unlucky gaps and enabling capacity weighting.',
    };
  } else {
    const remaining = SERVERS.filter((s) => s.id !== 'S2');
    const orphans = KEYS.filter((k) => ownerOf(k.angle, SERVERS).id === 'S2');
    yield {
      state: ringNodes(remaining, KEYS),
      highlight: { swap: orphans.map((k) => k.id) },
      explanation: `If S2 disappears, only keys that previously belonged to S2 move. Those keys continue their clockwise walk to the next live server, ${ownerOf(141, remaining).id}. Keys owned by other servers keep the same first-clockwise owner.`,
    };
    yield {
      state: ringNodes(remaining, KEYS),
      highlight: {},
      explanation: 'Replication usually follows the same ring order: store the key on the owner and the next distinct nodes clockwise. Then a successor can serve data when the primary is unavailable, assuming replication and repair have kept copies current.',
    };
  }
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The circle is the hash ring -- a continuous space from 0 to 2^32 (shown here as 0 to 359 degrees for clarity). Server nodes sit at fixed positions on the ring. Keys also hash onto the ring, and each key belongs to the first server found by walking clockwise from the key\'s position. The label on each key shows its current owner.',
        {type: 'callout', text: 'Consistent hashing makes membership churn local by naming ownership as clockwise intervals on a stable ring.'},
        'When a server is added, watch which keys change labels. Only keys sitting between the new server and its counter-clockwise neighbor move. Every other key still finds the same first-clockwise server. When a server is removed, only that server\'s keys continue clockwise to the next live node. The animation makes the local-movement property visible: ring changes are neighborhood events, not global reshuffles.',
      
        {type: 'image', src: './assets/gifs/consistent-hashing.gif', alt: 'Animated walkthrough of the consistent hashing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed caches and storage clusters need a deterministic rule for "which server owns this key?" The rule must survive topology changes -- servers join, crash, and scale out routinely. Karger, Lehman, Leighton, and colleagues at MIT introduced consistent hashing in 1997 to solve this for Akamai\'s web caching layer. The core guarantee: when a server joins or leaves, only K/N keys need to move (K total keys, N servers), not all of them.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Consistent_Hashing_Sample_Illustration.png/250px-Consistent_Hashing_Sample_Illustration.png', alt: 'Consistent hashing ring with servers placed around a circle and a key assigned clockwise', caption: 'The ring turns key ownership into a clockwise successor query instead of a modulo bucket number. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Consistent_Hashing_Sample_Illustration.png.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Modulo hashing: compute hash(key) % N, where N is the server count. Simple, stateless, and perfectly balanced when N is fixed. No ring, no metadata, no coordination -- just arithmetic.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'N is baked into every assignment. Change 3 servers to 2, and nearly every key gets a new remainder. Concrete example: with 3 servers, key 17 maps to server 17 % 3 = 2, key 42 to 42 % 3 = 0, key 58 to 58 % 3 = 1, key 73 to 73 % 3 = 1, key 86 to 86 % 3 = 2, key 91 to 91 % 3 = 1. Remove one server (N = 2) and recompute: 17 % 2 = 1, 42 % 2 = 0, 58 % 2 = 0, 73 % 2 = 1, 86 % 2 = 0, 91 % 2 = 1. Five of six keys changed owners. In a cache cluster, every remapped key is a cache miss. The backend absorbs a spike of requests for data that was cached seconds ago. At scale, this miss storm can cascade into a full outage -- and it happens precisely when the system is already under stress from a server failure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Hash both keys and servers onto a circular space [0, 2^32). Each key walks clockwise until it hits a server; that server is the owner. The ring is stored as a sorted array of server tokens, so finding the owner is a binary search for the first token >= hash(key), wrapping to the first token if the hash exceeds the maximum.',
        'Virtual nodes (vnodes) solve load balance. Instead of one ring position per physical server, each server claims many positions -- typically 100 to 200 -- computed as hash(server_id + "-" + i) for i from 0 to v-1. With enough vnodes the central limit theorem kicks in: each server\'s share of the ring converges toward 1/N. Capacity weighting is straightforward -- give a stronger machine more vnodes.',
        'Adding a server places new tokens on the ring. Each new token steals a slice of keyspace from its clockwise successor and nothing else. Removing a server deletes its tokens; each slice merges into the next live successor. Replication follows the same ring: store copies on the next distinct physical nodes clockwise, giving a deterministic failover list without a per-key replica table.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every point on the ring has exactly one first-clockwise token, so every key has a deterministic owner given the same membership list. When a new token is inserted, only points between the new token and its predecessor see a different first-clockwise answer. When a token is removed, only its owned interval moves -- to the next live token. All other keys are unaffected.',
        'The K/N bound follows from symmetry: with N servers each owning roughly 1/N of the ring, a new server\'s tokens collectively cover about 1/N of the total keyspace, so roughly K/N keys move. Virtual nodes make this bound tight by smoothing interval sizes, turning the expected K/N from an average-case claim into a near-certain outcome.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup costs O(log T) via binary search over T sorted tokens. With vnodes, T = N * v. For 50 servers with 150 vnodes each, that is log2(7500) -- about 13 comparisons. The token array is small enough to sit in L1 cache, so each comparison takes nanoseconds.',
        'Membership changes move O(K/N) keys. The algorithm decides which keys move; it does not make moving bytes free. Each migration still involves network transfer, cache warming, compaction, and replica repair.',
        'Space is O(T) for the token ring metadata -- proportional to virtual node count, not to key count. 7,500 tokens at 8 bytes each is 60 KB. The tradeoff for vnodes is more metadata and more ranges to track, but without them three physical servers can produce wildly uneven arcs (one server owning 50% of the ring while another owns 15%).',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Amazon Dynamo (2007) built its key-value storage on consistent hashing with vnodes. The ring determines primary ownership and replica placement; adding capacity means assigning new token ranges, not reshuffling the cluster. Apache Cassandra adopted the same model -- each node owns a token range and replicates to the next N-1 distinct clockwise nodes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Chord_network.png/250px-Chord_network.png', alt: 'Chord distributed hash table ring with nodes and shortcut links', caption: 'Chord shows the same circular identifier-space idea extended into a peer-to-peer lookup overlay. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Chord_network.png.'},
        'Memcached client libraries use the ketama algorithm (from Last.fm): each server gets 100-200 points on a 32-bit ring, and clients binary-search locally to route keys. Adding a server to a 10-node pool moves roughly 10% of keys, not 90%. CDN edge routing works the same way -- Akamai, co-founded by Karger, used consistent hashing from the start to assign URLs to edge caches.',
        'The pattern fits any system where clients can compute ownership locally given shared ring metadata: load balancers, distributed locks, sharded queues, and Chord-style DHTs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ring is deterministic only when participants see the same membership list. A stale client routes to the wrong server. Systems need gossip, a control plane, or a consistent metadata store to propagate ring changes -- the ring does not solve its own coordination.',
        'Even key counts are not even load. A single hot key (celebrity user, viral product page, tenant batch job) can saturate one shard. Virtual nodes smooth ownership shares, not request popularity. Hot-key mitigation requires splitting, caching, or application-level routing above the ring.',
        'Physical constraints break pure hashing. Rack awareness, region affinity, disk class, tenant isolation, and compliance boundaries all require a placement policy layered on top. The ring provides a candidate list; the policy filters it.',
        'For static server sets where membership never changes, jump consistent hashing (Lamping and Veach, 2014) is simpler: O(1) memory, O(ln N) time, perfect balance, no ring or vnodes. The tradeoff is that it only supports appending or removing the last server, not arbitrary membership changes.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Three servers on a ring: S1 at token 20, S2 at 140, S3 at 260. Six keys: key 17 at position 65, key 42 at 110, key 58 at 180, key 73 at 235, key 86 at 295, key 91 at 345. The first-clockwise rule gives: S2 owns keys 17 and 42 (arc 21-140), S3 owns keys 58 and 73 (arc 141-260), S1 owns keys 86 and 91 (arc 261-20, wrapping).',
        'Add S4 at token 320. S4 takes the arc from 261 to 320, which previously belonged to S1. Key 86 (position 295) now hits S4 before S1. Key 91 (position 345) is past 320, so it still reaches S1. One key moved. The other five are untouched -- each still finds the same first-clockwise server.',
        'Instead, suppose S2 dies. Its arc (21-140) merges into S3\'s range, because S3 is the next live server clockwise. Keys 17 and 42 move to S3. Keys 58, 73, 86, and 91 stay put. Two keys migrated out of six, compared to five of six under modulo hashing. That is the K/N property: with 3 servers and 6 keys, removing one server moves about 6/3 = 2 keys.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Karger, D., Lehman, E., Leighton, T., Panigrahy, R., Levine, M., and Lewin, D. "Consistent Hashing and Random Trees: Distributed Caching Protocols for Relieving Hot Spots on the World Wide Web." ACM STOC, 1997. DeCandia, G. et al. "Dynamo: Amazon\'s Highly Available Key-Value Store." ACM SOSP, 2007. Lamping, J. and Veach, E. "A Fast, Minimal Memory, Consistent Hash Algorithm." arXiv:1406.2294, 2014.',
        'Prerequisite: Hash Table -- the hash function mechanics that consistent hashing builds on. Extensions: Distributed Hash Table (Chord) for the full peer-to-peer protocol layering routing, replication, and membership atop a ring. Alternatives: Jump Consistent Hashing for static server sets. Related problems: Load Balancing for the broader work-distribution problem; Bloom Filter for the probabilistic membership test often paired with distributed caches.',
      ],
    },
  ],
};
