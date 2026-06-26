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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as one replica, meaning one machine that stores a copy of the same logical value. A write quorum is the set of replicas that acknowledged a write, and a read quorum is the set of replicas asked during a read.',
        {type: 'image', src: './assets/gifs/quorums.gif', alt: 'Animated walkthrough of the quorums visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference is set overlap. When R + W > N, where R is read count, W is write count, and N is replica count, every read quorum must share at least one replica with every successful write quorum.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Replicated storage keeps several copies of data so the system can survive crashes and slow machines. Waiting for every copy on every request makes the system fragile because one bad replica slows the whole cluster.',
        { type: 'callout', text: 'Quorum freshness is not magic replication; it is set intersection with a version rule attached.' },
        'Quorums let each request choose how many replicas are enough. The system can trade latency and availability against freshness instead of treating consistency as one global switch.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious safe approach is write all replicas and read one. Reads are cheap, but every write waits for the slowest replica and fails when any required replica is unavailable.',
        'The opposite approach is write one replica and read all replicas. Writes are fast, but reads become expensive and a single write target can lose freshness until repair catches up.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Replication creates a timing gap between success and universal visibility. A client can receive a successful write response while some replicas still hold the old version.',
        'If a later read asks only stale replicas, it can return old data without any machine crashing. The wall is not storage loss; it is a read set and a write set that failed to intersect.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is the pigeonhole principle. If the write touches W replicas and the read touches R replicas, and R + W is larger than N, the two sets cannot be disjoint.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Venn_A_intersect_B.svg/640px-Venn_A_intersect_B.svg.png', alt: 'Venn diagram showing the intersection of two sets', caption: 'The shaded overlap is the quorum proof: when read and write sets cannot be disjoint, one replica carries fresh version evidence. Source: Wikimedia Commons, Venn A intersect B.svg, public domain: https://commons.wikimedia.org/wiki/File:Venn_A_intersect_B.svg' },
        'The overlap replica gives the read evidence of the newest acknowledged version, assuming versions are compared correctly. The quorum rule proves visibility of a version; it does not prove a total order for concurrent writes.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For N = 5, choose W = 3 and R = 3. A write can succeed after any three replicas acknowledge, and a later read asks any three replicas and returns the value with the highest version number.',
        'Because 3 + 3 = 6, the read set and write set share at least one replica. If the write stored version 2 on A, B, and C, then a read from C, D, and E sees C carrying version 2 and can ignore stale version 1 replies.',
        'Repair is the cleanup path. Read repair updates stale replicas touched by a read, hinted handoff returns writes from temporary stand-ins, and anti-entropy compares replicas in the background.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness for fresh reads follows from intersection plus version choice. The overlap replica stores the successful write, and the coordinator chooses the highest version among the read replies.',
        'The proof breaks when R + W <= N because the sets can be disjoint. It also breaks for sloppy quorums if writes go to stand-in replicas outside the home replica set, because the count no longer implies the same intersection.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Higher R increases read fanout and tail latency because the coordinator waits for more replies. Higher W increases write latency and makes writes less available during failures.',
        'For N = 5, W = 3, R = 3 tolerates two unavailable replicas for reads or writes, as long as a quorum remains reachable. W = 5, R = 1 makes reads fast but lets one slow replica block writes.',
        'The hidden cost is conflict handling. Quorums can reveal concurrent writes, but last-write-wins, vector clocks, siblings, or CRDT merges decide what the application does with them.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Dynamo-inspired systems use quorum settings for shopping carts, user preferences, feeds, metrics, and similar data where availability matters and conflicts can be repaired or merged.',
        'Cassandra exposes consistency levels such as ONE, QUORUM, LOCAL_QUORUM, and ALL. LOCAL_QUORUM is common in multi-datacenter deployments because it keeps the quorum round trip inside one region.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Quorums do not provide serializable transactions. Two clients can write different values at the same time, both can reach quorums, and the system still needs a conflict rule.',
        'They are a poor fit for ledgers, unique usernames, inventory decrements, and other invariants that require one agreed order. Those workloads usually need consensus or transactions above the storage replicas.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use N = 5 replicas A, B, C, D, and E. A write of cart = 2 items reaches A, B, and C, so W = 3 succeeds while D and E still store cart = 1 item.',
        'A read asks C, D, and E, so R = 3. The replies are version 2 from C and version 1 from D and E. The coordinator returns version 2 because it is the highest version it saw.',
        'Now change the settings to W = 2 and R = 2. A write reaches A and B, while a read asks D and E. Since 2 + 2 = 4 <= 5, the sets can miss each other and the read returns the stale version.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: DeCandia et al., Dynamo: Amazon\'s Highly Available Key-value Store, 2007; Lakshman and Malik, Cassandra: A Decentralized Structured Storage System, 2010.',
        'Study the pigeonhole principle, consistent hashing, vector clocks, read repair, hinted handoff, CRDTs, Paxos, Raft, and tail latency. The key distinction to keep is visibility through overlap versus ordering through consensus.',
      ],
    },
  ],
};