// Read/write quorums: Dynamo-style replication doesn't wait for everyone —
// it waits for enough. R + W > N makes every read set overlap every write
// set by pigeonhole, and the overlap is where freshness lives.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'quorums',
  title: 'Read/Write Quorums & Tunable Consistency',
  category: 'Systems',
  summary: 'Write to W of N replicas, read from R: if R + W > N the sets must overlap and the newest version is always in view — a consistency dial, not a switch.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['R + W > N', 'the dial & the fine print'], defaultValue: 'R + W > N' },
  ],
  run,
};

// Five replicas, actually simulated: each holds (version, value). A write
// updates only its write set; a read returns the highest version it sees.
const NAMES = ['A', 'B', 'C', 'D', 'E'];
function cluster() {
  return Object.fromEntries(NAMES.map((n) => [n, { ver: 1, val: 'cart: 1 item' }]));
}
function write(reps, set, ver, val) {
  for (const n of set) reps[n] = { ver, val };
}
function read(reps, set) {
  let best = { ver: -1, val: '' };
  for (const n of set) if (reps[n].ver > best.ver) best = reps[n];
  return best;
}
// Scenario one: W = 3, R = 3 (3 + 3 > 5).
const GOOD = cluster();
write(GOOD, ['A', 'B', 'C'], 2, 'cart: 2 items');
const GOOD_READ = read(GOOD, ['C', 'D', 'E']);
// Scenario two: W = 2, R = 2 (2 + 2 ≤ 5).
const BAD = cluster();
write(BAD, ['A', 'B'], 2, 'cart: 2 items');
const BAD_READ = read(BAD, ['D', 'E']);

function table(title, rowDefs, colDefs, cellText) {
  let k = 0;
  const flat = [''];
  const values = rowDefs.map((_, r) => colDefs.map((__, c) => { flat.push(cellText[r][c]); k++; return k; }));
  return matrixState({
    title,
    rows: rowDefs.map(([id, label]) => ({ id, label })),
    columns: colDefs.map(([id, label]) => ({ id, label })),
    values,
    format: (v) => flat[v],
  });
}
const replicaRows = NAMES.map((n) => [n.toLowerCase(), `replica ${n}`]);
const stateCols = [['ver', 'version'], ['val', 'value'], ['note', 'note']];
const replicaCells = (reps, notes) => NAMES.map((n, i) => [`v${reps[n].ver}`, reps[n].val, notes[i]]);

function* overlap() {
  yield {
    state: table('Write "cart: 2 items" with W = 3 — succeed after THREE acks', replicaRows, stateCols, replicaCells(GOOD, [
      'acked the write',
      'acked the write',
      'acked the write — third ack: client told SUCCESS',
      'never heard about it (slow? partitioned? fine)',
      'never heard about it',
    ])),
    highlight: { active: ['a:ver', 'b:ver', 'c:ver'], removed: ['d:ver', 'e:ver'] },
    explanation: 'Dynamo-style replication (Cassandra, Riak, Voldemort — the lineage of Amazon\'s 2007 Dynamo paper) refuses to make writes wait for every replica: with N = 5 copies and W = 3, the client\'s write returns as soon as ANY three replicas ack it, simulated live above. Look at the resulting cluster state and absorb the uncomfortable part: a SUCCESSFUL write left two replicas stale. That isn\'t a failure mode — it is the design. D and E will catch up eventually, but "eventually" might be after the next read arrives. So how can any read be trusted? Not by asking one replica. By asking enough.',
    invariant: 'A W-of-N write guarantees only that W replicas are fresh: success and full replication are different events.',
  };

  yield {
    state: table(`Read with R = 3 from {C, D, E}: versions seen → take the highest`, replicaRows, stateCols, replicaCells(GOOD, [
      'not consulted this read',
      'not consulted this read',
      'IN THE READ SET — reports version 2',
      'in the read set — reports version 1, outvoted',
      'in the read set — reports version 1, outvoted',
    ])),
    highlight: { found: ['c:ver'], compare: ['d:ver', 'e:ver'] },
    explanation: `The read fans out to R = 3 replicas — deliberately including the two stale ones — and gets versions 2, 1, 1 back. The client keeps the highest: "${GOOD_READ.val}", version ${GOOD_READ.ver}, computed live from the simulation. Why was a fresh copy GUARANTEED to be in the read set? Pigeonhole: the write touched 3 replicas, the read touched 3, and 3 + 3 = 6 > 5 — two sets that together exceed the cluster must share at least one member (here, C). That shared member always carries the newest version, and version numbers let it win the vote. Any write set, any read set, any 3-and-3: the overlap is arithmetic, not luck — the same intersection argument that powers Paxos: Consensus Without a Leader, spent on freshness instead of agreement.`,
    invariant: 'R + W > N ⇒ |read set ∩ write set| ≥ R + W − N ≥ 1: every read must touch at least one fresh replica.',
  };

  yield {
    state: table('Break the inequality: W = 2, R = 2 (2 + 2 ≤ 5)', replicaRows, stateCols, replicaCells(BAD, [
      'has version 2',
      'has version 2',
      'stale — never written',
      'IN THE READ SET — version 1',
      'IN THE READ SET — version 1',
    ])),
    highlight: { removed: ['d:ver', 'e:ver'], active: ['a:ver', 'b:ver'] },
    explanation: `Same cluster, faster settings: the write succeeds with W = 2 acks ({A, B}) and the read asks R = 2 replicas ({D, E}). Now 2 + 2 = 4 ≤ 5 — the pigeonhole has room, the sets CAN miss each other, and in this run they do: the read sees versions 1 and 1, takes the max, and confidently returns "${BAD_READ.val}" — the OLD cart, version ${BAD_READ.ver}, with no error and no warning. Nothing crashed; the math just stopped promising overlap. This is what "eventual consistency" looks like from the inside: a read that is correct about what it saw and wrong about the world.`,
    invariant: 'R + W ≤ N permits disjoint read and write sets: stale reads become possible silently — no failure required.',
  };

  yield {
    state: table('The configuration space of N = 5', [
      ['w3r3', 'W = 3, R = 3'],
      ['w5r1', 'W = 5, R = 1'],
      ['w1r5', 'W = 1, R = 5'],
      ['w1r1', 'W = 1, R = 1'],
    ], [['fresh', 'overlap?'], ['trade', 'the trade']], [
      ['guaranteed (6 > 5)', 'balanced: tolerate 2 down for both reads and writes'],
      ['guaranteed (6 > 5)', 'read ANY single replica fast — but one dead node blocks ALL writes'],
      ['guaranteed (6 > 5)', 'writes never wait — every read polls the world'],
      ['none (2 ≤ 5)', 'fastest possible, stale reads on the menu — fine for view counters, not for carts'],
    ]),
    highlight: { active: ['w3r3:trade'], removed: ['w1r1:fresh'] },
    explanation: 'The inequality is a budget, not a rule: you choose where to spend latency. W = 5, R = 1 makes reads instant but lets one crashed replica freeze every write — durability bought at availability\'s expense. W = 1, R = 5 inverts it. W = 1, R = 1 abandons the guarantee entirely and is still the right answer for data where staleness is cheap (page views, presence dots, like counts). The deep shift from Paxos: Consensus Without a Leader: there is no single "consistent" switch — Dynamo-style systems hand every individual operation a dial, and the application decides, request by request, what its data is worth.',
    invariant: 'Quorum tuning is per-operation economics: latency, availability, and freshness — pick which two a given request pays for.',
  };
}

function* dialAndFinePrint() {
  yield {
    state: table('Cassandra\'s dial, as requests actually speak it', [
      ['one', 'ONE'],
      ['quorum', 'QUORUM'],
      ['local', 'LOCAL_QUORUM'],
      ['all', 'ALL'],
    ], [['means', 'means'], ['when', 'reach for it when']], [
      ['1 replica acks', 'speed beats freshness: metrics, feeds, anything refetched soon'],
      ['⌈(N+1)/2⌉ acks — with QUORUM writes, R + W > N holds', 'the default for data that must read-your-write'],
      ['quorum within ONE datacenter', 'cross-DC round trips cost 100ms+; keep the overlap local, replicate async beyond'],
      ['every replica, every time', 'almost never — one slow node taxes every request (see Tail Latency & p99 Thinking)'],
    ]),
    highlight: { active: ['local:when'] },
    explanation: 'Production systems expose the dial verbatim: every Cassandra query names its consistency level, so one application freely mixes ONE for its activity feed and QUORUM for its checkout. LOCAL_QUORUM is the workhorse nobody teaches in theory class: a quorum confined to one datacenter keeps the overlap guarantee where latency is sub-millisecond and lets geography replicate asynchronously — because a Virginia-to-Tokyo ack inside your write path turns every save into an intercontinental round trip. ALL exists and is almost always a mistake: it converts your slowest replica\'s p99 into everyone\'s p50.',
    invariant: 'Consistency levels are per-query, not per-database: each request re-decides the R/W trade with full knowledge of what it needs.',
  };

  yield {
    state: table('Sloppy quorums: when the home replicas are down, write ANYWHERE', [
      ['strict', 'strict quorum'],
      ['sloppy', 'sloppy quorum'],
      ['hint', 'hinted handoff'],
      ['cost', 'the cost'],
    ], [['does', 'what happens']], [
      ['home set {A, B, C} unreachable ⇒ the write FAILS — overlap preserved by refusing'],
      ['write lands on stand-ins {D, E, F} with a note: "this belongs to A" — availability preserved by improvising'],
      ['when A returns, D forwards the hinted write home and deletes its copy'],
      ['until handoff completes, a quorum READ of {A, B, C} can MISS the write: R + W > N quietly stopped being a theorem'],
    ]),
    highlight: { removed: ['cost:does'] },
    explanation: 'Dynamo\'s famous availability trick, and its honest price. A strict quorum treats the write set as sacred: if the home replicas (chosen by Consistent Hashing) are unreachable, the write fails — correct and unavailable. A sloppy quorum says the shopping cart must NEVER fail: write to any W healthy nodes, attach a hint naming the true owner, and repatriate when it recovers. Amazon chose sloppy for the cart on purpose — but understand what was spent: the overlap proof assumed reads and writes draw from the SAME pool of N. Stand-ins are outside the pool, so a read quorum can miss a sloppy write entirely until handoff lands. Availability was bought with the theorem.',
    invariant: 'Sloppy quorums trade the overlap guarantee for availability: W acks from the wrong replicas satisfy the count, not the intersection.',
  };

  yield {
    state: table('How stale replicas heal', [
      ['repair', 'read repair'],
      ['merkle', 'anti-entropy'],
      ['handoff', 'hinted handoff'],
    ], [['how', 'mechanism']], [
      ['the R = 3 read that saw versions 2, 1, 1 writes version 2 back to the stale pair on its way out — readers fix what they touch'],
      ['background process compares replicas via Merkle Tree hashes and syncs only differing ranges — fixes what nobody reads'],
      ['stand-ins repatriate hinted writes when owners recover — fixes what failure displaced'],
    ]),
    highlight: { active: ['repair:how'] },
    explanation: 'Quorums make staleness invisible to readers; these three mechanisms make it temporary. READ REPAIR rides the request path: the coordinator that just collected versions 2, 1, 1 already knows exactly who is behind, so it pushes the fresh version to the stragglers before moving on — hot data heals at the speed it is read. Cold data needs ANTI-ENTROPY: replicas periodically exchange Merkle Tree fingerprints and ship only the key ranges whose hashes disagree, the same trick Git and BitTorrent use to diff cheaply. The division of labor is elegant: reads heal what matters now, Merkle sweeps heal what nobody asked about, handoff heals what failure scattered.',
    invariant: 'Convergence has three speeds: read-repair (per access), handoff (per recovery), anti-entropy (per sweep) — together: eventual means actual.',
  };

  yield {
    state: table('What quorums do NOT give you: an order', [
      ['race', 'two clients, same instant'],
      ['after', 'cluster state after both "succeed"'],
      ['tie', 'who wins?'],
      ['paxos', 'what consensus adds'],
    ], [['story', 'the story']], [
      ['client 1 writes "add socks" to {A, B, C}; client 2 writes "add shoes" to {C, D, E} — both get W = 3 acks'],
      ['A, B say socks · D, E say shoes · C saw both, kept whichever arrived last — three opinions, all version 2'],
      ['nobody: equal versions, different values. The system needs a tiebreak — LWW timestamps (the silent data loss from Clocks & Ordering: Lamport to TrueTime) or sibling values merged by the app (the OR-set from CRDTs: Conflict-Free Replicated Data Types)'],
      ['Paxos: Consensus Without a Leader runs a round per slot so concurrent proposals get ORDERED, not merged — that is the service quorum reads alone never provide'],
    ]),
    highlight: { removed: ['tie:story'], active: ['paxos:story'] },
    explanation: 'The boundary of the whole technique, drawn precisely. Overlap guarantees VISIBILITY — every read sees the highest version — but versions only order writes that happened one-after-another. Two genuinely concurrent writes both earn version 2, both collect W = 3 acks, and the overlap dutifully delivers the conflict to every reader without saying who won. Quorum systems must then choose a resolution philosophy: Cassandra picks last-write-wins timestamps (fast, and silently discards one write — the exact incident the clock pages dissected), Riak surfaces both as siblings for a CRDT merge. If your data needs concurrent operations to happen in ONE agreed sequence — counters with invariants, unique usernames, ledgers — that is ordering, and ordering is consensus work. Overlap is cheap; order is not. Know which one you\'re paying for.',
    invariant: 'R + W > N orders only sequential writes: concurrency yields equal versions, and resolving them needs clocks, CRDTs, or consensus.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'R + W > N') yield* overlap();
  else if (view === 'the dial & the fine print') yield* dialAndFinePrint();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Read/write quorums exist because replicated systems want a tunable middle ground between fast but stale reads and fully coordinated consensus. If data lives on N replicas, a write can wait for W acknowledgements and a read can ask R replicas. The choice of R and W decides how much latency, availability, and freshness each request buys.',
        'Dynamo-style systems expose this as a per-operation dial. Some data can tolerate staleness, such as counters, presence, feeds, or cached views. Other data needs stronger read-your-write behavior. A single database may need both, depending on the request.',
        'The topic matters because quorum arithmetic is often oversold. It can guarantee overlap between read and write sets when R + W > N, but it does not by itself give a total order for concurrent writes, serializable transactions, or magic conflict resolution.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write every replica and read one. That gives simple reads, but one slow or unavailable replica can make every write slow or unavailable. It spends availability to make reads cheap.',
        'The opposite shortcut is to write one replica and read every replica. That makes writes fast but turns reads into fanout and still needs conflict logic. If the one write target dies before replication, durability and freshness suffer.',
        'A third shortcut is to say majority and stop thinking. Majority quorums are common, but the useful idea is the inequality and the workload. W = 3, R = 3 on N = 5 is different from W = 5, R = 1 or W = 1, R = 5. Each request is spending latency and failure tolerance differently.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is set intersection. If R + W > N, every read set of size R must overlap every write set of size W. The overlapping replica can carry the newest version into the read response, assuming version comparison and replica selection behave as expected.',
        'This is not consensus. A quorum read can see the freshest visible version among the replicas it contacted, but it does not force all writers into one agreed sequence. Concurrent writes can both succeed and later appear as conflicting versions.',
        'The inequality is a budget, not a law of nature. It assumes reads and writes draw from the same home replica set. Sloppy quorums, hinted handoff, multi-datacenter locality, clock skew, and conflict resolution all add fine print.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For N = 5, a write with W = 3 succeeds when three replicas acknowledge. The other two may be stale for a while. A read with R = 3 asks three replicas, compares versions, and returns the newest value it can justify. Because 3 + 3 = 6 > 5, the read and write sets must overlap.',
        'If the system uses W = 2 and R = 2 on N = 5, the sets can miss each other. A write may land on A and B while a read asks C and D. The read can confidently return stale data because the math no longer forces overlap.',
        'Repair mechanisms make staleness temporary. Read repair fixes stale replicas touched by a read. Anti-entropy compares replica ranges in the background, often using Merkle-tree summaries. Hinted handoff forwards writes from temporary stand-ins back to home replicas after recovery.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first view proves the overlap guarantee. The highlighted replica is not special by identity; it is special because arithmetic forced at least one replica to be in both the write acknowledgement set and the read set.',
        'The dial view proves that consistency levels are request economics. ONE, QUORUM, LOCAL_QUORUM, and ALL are not moral categories. They are latency, availability, and freshness choices.',
        'The sloppy-quorum view proves the fine print. If home replicas are down and the system writes to stand-ins, the count may be satisfied while the overlap theorem no longer applies to the home set. Availability was bought by weakening the proof until handoff completes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because of the pigeonhole principle. If two subsets of a set are large enough that their sizes sum to more than the whole set, they cannot be disjoint. Quorum systems turn that simple fact into a freshness control.',
        'It also works operationally because the dial is per request. A feed read can use ONE. A checkout write can use QUORUM. A multi-region application can use LOCAL_QUORUM to avoid cross-ocean latency while replicating asynchronously beyond the local datacenter.',
        'Repair works because the coordinator often sees version disagreement directly. If a read observes versions 2, 1, and 1, it can return 2 and push 2 back to stale replicas. Background anti-entropy handles cold data that nobody reads.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The cost is network fanout and tail latency. A read with R = 3 sends more requests than R = 1 and often waits longer. A write with W = 5 waits for the slowest replica. ALL turns one slow node into everyone\'s latency problem.',
        'The availability tradeoff is direct. Higher W makes writes more durable and fresher but less available during replica failures. Higher R makes reads fresher but slower. LOCAL_QUORUM reduces geographic latency but narrows the overlap to one datacenter.',
        'The complexity is conflict resolution. Quorums can surface concurrent writes; they do not decide which one wins. Last-write-wins is fast but can lose data under clock skew. Sibling values or CRDTs preserve conflicts but push merge logic into the application.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Quorums win in systems that prefer availability and tunable freshness over a single global order for every operation. Shopping carts, user preferences, feeds, metrics, presence, session-adjacent state, and eventually consistent stores can all benefit when conflicts are acceptable or mergeable.',
        'Amazon Dynamo popularized the pattern. Cassandra, Riak, Voldemort-style systems, and Dynamo-inspired stores expose consistency dials in different forms. The exact APIs vary, but the reasoning remains read set, write set, replica count, and repair.',
        'Quorums are less suitable for unique constraints, ledgers, counters with strict invariants, or workflows where concurrent operations must be ordered. Those problems usually need consensus, transactions, or an application-specific merge model.',
        'They pair well with session guarantees. A client-side high-water mark can preserve read-your-writes for one user even when the wider system remains eventually consistent.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Do not confuse overlap with serializability. R + W > N can make stale reads harder, but it does not create a single global order for concurrent writes. Two clients can write different values at the same time and both succeed.',
        'Do not forget sloppy quorum fine print. If a write lands on stand-ins outside the home replica set, a later read of the home set may miss it until hinted handoff completes. The count is not the same as the theorem.',
        'Do not hide conflict policy. Last-write-wins, vector clocks, siblings, CRDT merge, and application reconciliation are different product choices. If the application cannot tolerate losing one concurrent write, it should not rely on silent timestamp wins.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Session Guarantees & Replica Lag for client-side high-water marks, Paxos: Consensus Without a Leader for ordering, Byzantine Fault Tolerance and HotStuff BFT Quorum Certificate Case Study for honest-overlap reasoning, CRDTs for merge semantics, Consistent Hashing for home replica placement, Merkle Tree for anti-entropy, Hinted Handoff Replica Queue and Read Repair Digest Quorum for repair paths, Clocks & Ordering for last-write-wins risk, and Tail Latency & p99 Thinking for why LOCAL_QUORUM exists.',
      ],
    },
  ],
};
