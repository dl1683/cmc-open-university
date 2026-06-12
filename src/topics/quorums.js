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
      heading: `What it is`,
      paragraphs: [
        `Read/write quorums are the consistency dial that Dynamo-style databases expose to every application. Write to W replicas, read from R replicas, and choose W and R so that R + W > N. This inequality guarantees overlap: any fresh data a writer left behind, any reader must touch it (pigeonhole principle). No consensus protocol. No leader. Just arithmetic.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `N = 5 replicas. Write W = 3 succeeds when three ack; the other two stay stale. Success ≠ full replication. Read R = 3 asks three replicas for versions, takes the max, and returns it. Since 3 + 3 = 6 > 5, the sets must overlap. In the simulation: write W = 3 to {A, B, C}, read R = 3 from {C, D, E} — overlap is C. If you break the inequality (W = 2, R = 2), the sets can miss each other, and a reader confidently returns stale data with no warning.`,
        `Config space: W = 3, R = 3 balances both; W = 5, R = 1 makes reads instant but freezes on one node failure; W = 1, R = 5 inverts it. Each trades latency for availability. Cassandra exposes the dial per query: QUORUM (arithmetic default), ONE (fastest), LOCAL_QUORUM (one datacenter), and ALL (almost never — one slow replica's p99 taxes everyone's p50).`,
        `Sloppy quorums write to ANY W healthy nodes if home replicas are down (hinted handoff), buying availability but breaking the overlap proof until handoff completes. Healing happens at three speeds: read repair (per access), anti-entropy via Merkle Tree diffs (background), and hinted handoff (per recovery).`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Network is the cost: every read/write fans out and waits for the R-th or W-th response. LOCAL_QUORUM keeps the overlap sub-millisecond within one datacenter while replicating async elsewhere. Conflict resolution is the complexity: two concurrent writes both earn version 2, creating a tie. Quorums guarantee visibility, not order. Cassandra uses last-write-wins timestamps (silent data loss on clock skew). Riak surfaces siblings for CRDT merges. Choose your conflict resolution before choosing your R and W.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Amazon's Dynamo (2007) is the blueprint. Cassandra, Riak, Voldemort, DynamoDB all expose per-query R and W dials. Netflix runs LOCAL_QUORUM on writes (tight DC overlap) and ONE on view data, QUORUM on checkouts. Amazon's shopping cart writes W = 3, reads QUORUM, betting that availability and eventual-consistency healing outweigh stale reads.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Quorums do NOT give consistency; they give visibility and overlap, not order. Concurrent writes collide at equal versions — your app resolves the conflict. Do not confuse overlap with serializability. Sloppy quorums break the proof — hinted writes can be invisible until handoff lands. Last-write-wins is a choice, not a law; clock skew makes it a silent data-loss trap. QUORUM is correct for freshness, not for ordering.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `"Paxos: Consensus Without a Leader" shows how ordering adds structure quorums lack. "CRDTs: Conflict-Free Replicated Data Types" shows application-level merge semantics. "Consistent Hashing" shows how home replicas are chosen. "Merkle Tree" shows anti-entropy. "Clocks & Ordering: Lamport to TrueTime" shows why last-write-wins is dangerous. "Tail Latency & p99 Thinking" shows why LOCAL_QUORUM exists.`,
      ],
    },
  ],
};
