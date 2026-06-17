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
      heading: 'Why consistent hashing exists',
      paragraphs: [
        'Distributed caches and storage systems need a deterministic answer to one question: which node owns this key? The answer must keep working while nodes are added, removed, replaced, or temporarily unreachable.',
        'The constraint is movement. Reassigning every key after one node change is not just expensive; it can destroy cache hit rate, flood the network with migration traffic, and make recovery slower than the original failure.',
        'Consistent hashing is the classic ring-based answer: put both nodes and keys in the same hash space, then assign each key to the first node clockwise from the key.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is modulo hashing: `owner = hash(key) % server_count`. It is simple, stateless, and balanced when the server count is fixed.',
        'The wall is that the divisor is part of the answer. Change 10 servers to 11 and most remainders change. A scale-out event becomes a near-total reshuffle, exactly when the system is already under operational pressure.',
        'A ring separates placement from the raw number of servers. Membership changes alter token ranges rather than changing the arithmetic for every key.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A node owns an interval on the ring. Adding a node splits one existing interval. Removing a node hands one interval to the next live node. The invariant is local movement: membership changes disturb neighbors, not the whole cluster.',
        'The system does not need a central lookup table for every key. It needs agreement on the much smaller token list and on the hash function.',
        'That is the conceptual shift from modulo hashing. The keyspace stays stable while membership changes. Nodes enter and leave by claiming or releasing ranges inside that stable keyspace.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the first frame, read the server positions as token ownership boundaries. A key belongs to the first server clockwise from its hash position. The note on each key shows the owner produced by that rule.',
        'In the add-server view, S4 splits the range that previously flowed to S1. Only keys inside that range move. In the remove-server view, only keys owned by the removed server continue to the next live token.',
        'The animation is showing why ring movement is local. It is not proving load balance by itself; virtual nodes and capacity weighting are the production mechanisms that smooth uneven gaps.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A client hashes the key onto a ring, finds the first token clockwise, and sends the request to the physical node that owns that token. The token list is sorted, so lookup is a binary search over ring positions.',
        'Real deployments use virtual nodes, also called tokens. One physical node appears at many ring positions so random gaps smooth out. Capacity weighting becomes a metadata problem: give a larger machine more tokens or larger ranges. Replication usually walks clockwise to the next distinct physical nodes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is interval ownership. Every point on the ring has exactly one first clockwise token, so every key has a deterministic owner when membership is known. When a token is inserted, only points between the previous token and the new token see a different first-clockwise answer.',
        'When a token is removed, only the points in its old interval need a new owner. They move to the next live token. All other points still find the same first-clockwise server as before.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose S1, S2, and S3 own token ranges on a ring. Key 86 hashes into the range before S1, so S1 owns it. Adding S4 at token 320 splits the old S1 range. Keys between S3 and S4 now move to S4; keys elsewhere do not move.',
        'If S2 fails, only S2-owned keys move to S3, its clockwise successor. Replicated systems usually store copies on successors already, so failover is a matter of routing plus consistency repair rather than inventing a new placement rule.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Lookup is O(log T) with binary search over T sorted tokens, or effectively constant when T is small and cached. Ring metadata is O(T), where T is the number of virtual tokens, not the number of keys.',
        'Rebalancing is the real cost. Adding one equal-capacity node to N nodes moves roughly K / (N + 1) keys, plus network transfer, compaction, cache warming, and replica repair. The algorithm minimizes which keys move; it does not make moving bytes free.',
        'Virtual nodes add another cost: more metadata and more ranges to track. That is usually worth it because a few physical nodes placed randomly on a ring can have very uneven interval sizes. Many tokens per node turn one unlucky large interval into many smaller independent intervals.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Consistent hashing fits caches, Dynamo-style storage, Cassandra-style token ranges, CDN routing, and any key-owned service where membership changes are routine. Clients can compute ownership locally as long as they share the same ring metadata.',
        'It also pairs naturally with storage engines: the ring decides which node owns a row, and the local storage engine decides how that node writes, indexes, compacts, and repairs the row.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The ring is deterministic only if participants see the same membership list. A stale client can route to the wrong owner. Systems need gossip, a control plane, or a strongly consistent metadata store to distribute ring changes.',
        'Even key counts are not even work. One celebrity user, hot product, or tenant batch job can dominate a shard. Virtual nodes smooth ownership, not popularity. Hot-key mitigation needs splitting, caching, batching, or application-level aggregation.',
        'It also fails when placement must follow physical constraints the hash does not know about. Rack, region, disk class, tenant isolation, and compliance boundaries often require a placement policy layered above the ring.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Version the ring metadata and make clients report which version they used for each routed request. During membership changes, this makes stale-routing errors diagnosable instead of mysterious cache misses or misplaced writes.',
        'Keep token ownership, replica ownership, and data movement as separate records. The ring can say who should own a range; a migration controller still has to copy bytes, verify repair, shift traffic, and retire the old owner safely.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A distributed cache adds a new node during a traffic spike. With modulo hashing, most keys remap and the cache suffers a broad miss storm. With consistent hashing, the new node takes only the ranges that fall between its tokens and their predecessors.',
        'The cache still has work to do. It must warm those ranges, route clients through a consistent membership view, and avoid overloading the new node while it fills. Consistent hashing limits the blast radius; operational rollout decides whether the change is smooth.',
      ],
    },
    {
      heading: 'Replica placement',
      paragraphs: [
        'Replication usually follows the same ring order but skips duplicate physical nodes. The primary owner is the first clockwise token. The next replicas are the next distinct nodes clockwise. That gives the system a deterministic failover list without storing a per-key replica table.',
        'Production systems often add placement constraints so replicas do not land on the same rack, zone, or failure domain. The ring gives an ordered candidate list; the placement policy filters that list until it finds acceptable distinct owners.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Karger et al. on consistent hashing at https://dl.acm.org/doi/10.1145/258533.258660 and the Dynamo paper at https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf.',
        'Study Hash Table, Sharding & Partitioning, Jump Consistent Hash Case Study, Rendezvous Hashing, Maglev Load Balancer Case Study, CAP Theorem, Gossip Protocol, LSM Trees, Bloom Filter, and Hot Rows & Append-and-Aggregate next.',
      ],
    },
  ],
};
