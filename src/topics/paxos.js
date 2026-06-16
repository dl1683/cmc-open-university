// Paxos: the original consensus algorithm — no leader, just ballots and
// majorities. Watch a value get chosen, survive a proposer crash, then watch
// two proposers duel forever — the livelock Raft was designed to end.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'paxos',
  title: 'Paxos: Consensus Without a Leader',
  category: 'Systems',
  summary: 'Prepare, promise, accept: how five acceptors choose one value that survives crashes — and the dueling-proposers livelock that explains why Raft exists.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['choosing one value', 'duels & the road to Raft'], defaultValue: 'choosing one value' },
  ],
  run,
};

// Every cell gets a unique index, so the format table can never collide.
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
const ACCEPTORS = [['a1', 'acceptor A1'], ['a2', 'acceptor A2'], ['a3', 'acceptor A3'], ['a4', 'acceptor A4'], ['a5', 'acceptor A5']];
const COLS = [['promised', 'highest ballot promised'], ['accepted', 'accepted (ballot, value)'], ['note', 'what just happened']];

function* chooseValue() {
  yield {
    state: table('The cast: 5 acceptors, 2 proposers, majority = 3', ACCEPTORS, COLS, [
      ['—', '—', 'remembers two things: highest ballot promised, last value accepted'],
      ['—', '—', 'an acceptor never forgets a promise (it survives crashes on disk)'],
      ['—', '—', 'any 3 of 5 form a quorum'],
      ['—', '—', 'currently partitioned away'],
      ['—', '—', 'currently partitioned away'],
    ]),
    highlight: {},
    explanation: 'The problem: five machines must agree on ONE value — which write wins, who holds a lock, what the next config is — even while machines crash and messages vanish. Two-Phase Commit (2PC) can\'t do this: it blocks forever if the coordinator dies at the wrong moment, because no one else is allowed to finish the decision. Paxos\'s answer (Lamport, written 1989, finally published 1998) has no fixed coordinator at all: ANY proposer may try, every attempt carries a unique increasing BALLOT NUMBER, and acceptors enforce the rules. Two of the five acceptors are partitioned away for this whole story — Paxos only ever needs a majority alive.',
    invariant: 'Consensus contract: only one value is ever chosen, and it is only chosen if a majority accepted it.',
  };

  yield {
    state: table('Phase 1 — proposer P1 sends prepare(ballot 1)', ACCEPTORS, COLS, [
      ['1', '—', 'PROMISE: will ignore anything below ballot 1; nothing accepted yet'],
      ['1', '—', 'PROMISE, nothing accepted yet'],
      ['1', '—', 'PROMISE, nothing accepted yet'],
      ['—', '—', 'unreachable'],
      ['—', '—', 'unreachable'],
    ]),
    highlight: { active: ['a1:promised', 'a2:promised', 'a3:promised'] },
    explanation: 'Phase 1 is a permission round that doubles as an interview. P1 picks ballot 1 and sends prepare(1). Each acceptor that hasn\'t promised a higher ballot replies with a PROMISE — "I will never accept anything with a ballot below 1" — and, crucially, reports the last value it ever accepted (here: none). P1 has a majority of promises (A1–A3), so it now knows two things: its ballot is currently the highest in play among a quorum, and no value has been chosen yet, so it is free to propose its own. Note what phase 1 did NOT do: no value was sent. It only froze the past and read it.',
    invariant: 'A promise is a one-way door: an acceptor that promised ballot n is dead to every ballot below n, forever.',
  };

  yield {
    state: table('Phase 2 — P1 sends accept(1, "X") · the value is now CHOSEN', ACCEPTORS, COLS, [
      ['1', '(1, "X")', 'ACCEPTED'],
      ['1', '(1, "X")', 'ACCEPTED'],
      ['1', '(1, "X")', 'ACCEPTED — third accept: a majority now holds "X"'],
      ['—', '—', 'unreachable, and it does not matter'],
      ['—', '—', 'unreachable, and it does not matter'],
    ]),
    highlight: { found: ['a1:accepted', 'a2:accepted', 'a3:accepted'] },
    explanation: 'Phase 2: P1 sends accept(1, "X") to its quorum, and each acceptor — none of which has promised anything higher — records (1, "X"). The instant the THIRD acceptor writes it down, "X" is chosen. Pause on how strange that is: no machine knows yet. P1 hasn\'t collected the acks; A1 doesn\'t know about A3. Chosen-ness is a property of the SYSTEM — a majority of acceptors hold the same (ballot, value) — not a fact in any single memory. Learning that it happened comes later and can fail; the choice itself, once made, is permanent physics.',
    invariant: 'Chosen means: some majority all accepted the same ballot\'s value. No single node\'s knowledge is required.',
  };

  yield {
    state: table('P1 crashes. P2 prepares ballot 2 via {A3, A4, A5}', ACCEPTORS, COLS, [
      ['1', '(1, "X")', 'unreachable to P2 this round'],
      ['1', '(1, "X")', 'unreachable to P2 this round'],
      ['2', '(1, "X")', 'PROMISE — and reports: "I accepted (1, X)"'],
      ['2', '—', 'PROMISE, nothing accepted'],
      ['2', '—', 'PROMISE, nothing accepted'],
    ]),
    highlight: { active: ['a3:note'], compare: ['a4:accepted', 'a5:accepted'] },
    explanation: 'Now the part that makes Paxos PAXOS. P1 crashes before telling anyone. P2 — wanting to propose its own value "Y" — prepares ballot 2 and reaches a different majority: A3, A4, A5 (the partition healed). The promises come back, and one of them is loaded: A3 reports it accepted (1, "X"). Here is the sacred rule: a proposer must adopt the value of the HIGHEST-ballot acceptance reported in its promise quorum. P2 wanted "Y"; it must propose "X". Its ballot wins, but the value survives. P2\'s ambition is reduced to a courier service for history.',
    invariant: 'Adoption rule: propose your own value ONLY if the promise quorum reports no prior acceptance; else carry the highest one forward.',
  };

  yield {
    state: table('Why the rule is airtight: quorums must overlap', [
      ['q1', 'P1\'s phase-2 quorum'],
      ['q2', 'P2\'s phase-1 quorum'],
      ['cut', 'their intersection'],
    ], [['members', 'members'], ['carries', 'what it carries']], [
      ['A1, A2, A3', 'three copies of (1, "X")'],
      ['A3, A4, A5', 'the promises P2 must obey'],
      ['A3 — never empty', 'the history: any 3-of-5 quorums share a member'],
    ]),
    highlight: { found: ['cut:members'] },
    explanation: 'The proof fits in one sentence: any two majorities of five share at least one member, so SOME acceptor in every future prepare-quorum was in the majority that chose "X" — and its promise reply carries the evidence forward. The chosen value rides the quorum intersections into every higher ballot, forever. This is also why acceptors must persist their state to disk before replying (a forgotten promise breaks the chain), and it\'s the same quorum-overlap argument that makes Raft Log Replication safe — Raft inherited the skeleton and gave it a friendlier face, which is the second view\'s story.',
    invariant: 'Any two majorities intersect: once chosen, every higher ballot\'s prepare phase is forced to learn and re-propose the same value.',
  };
}

function* duels() {
  yield {
    state: table('Two proposers, no coordination: the duel', [
      ['t1', 't1 · P1 prepare(1)'],
      ['t2', 't2 · P2 prepare(2)'],
      ['t3', 't3 · P1 accept(1, "X")'],
      ['t4', 't4 · P1 prepare(3)'],
      ['t5', 't5 · P2 accept(2, "Y")'],
      ['t6', 't6 · P2 prepare(4) …'],
    ], [['result', 'what the acceptors say']], [
      ['promised: majority promises ballot 1'],
      ['promised: the same majority now promises 2 — ballot 1 is dead'],
      ['REJECTED — "we promised 2, you are 1"'],
      ['promised: 3 outbids 2 — ballot 2 is dead'],
      ['REJECTED — "we promised 3, you are 2"'],
      ['…and 4 kills 3. Forever. No value is ever chosen.'],
    ]),
    highlight: { removed: ['t3:result', 't5:result'] },
    explanation: 'Paxos\'s safety is perfect; its LIVENESS is not. Watch two well-behaved proposers destroy each other: each one\'s prepare outbids the other\'s pending ballot, so every accept arrives to find its ballot already obsolete. Prepare, outbid, reject, re-prepare — a livelock that can spin forever with every machine healthy and every message delivered. This isn\'t a Paxos bug to be patched; it\'s the FLP theorem (1985) showing through: no deterministic algorithm can guarantee consensus termination in an asynchronous system with even one possible crash. Paxos chose to keep safety unconditional and let liveness depend on luck — or on a referee.',
    invariant: 'Safety holds even mid-duel — nothing wrong is ever chosen. What\'s sacrificed is progress: liveness needs the duel to end.',
  };

  yield {
    state: table('The referee: one distinguished proposer (and suddenly it looks familiar)', [
      ['lead', 'pick ONE proposer to run ballots'],
      ['how', 'how to pick it'],
      ['multi', 'Multi-Paxos: amortize phase 1'],
      ['cost', 'steady-state cost'],
    ], [['idea', 'the move']], [
      ['no duel: a single ballot-runner never outbids itself'],
      ['randomized timeouts — whoever times out first proposes; collisions retry with fresh random delays'],
      ['run prepare ONCE for an infinite sequence of slots, then stream accepts: one round-trip per command'],
      ['leader + heartbeats + per-command accept round — exactly the shape of Raft Leader Election'],
    ]),
    highlight: { active: ['multi:idea'] },
    explanation: 'The fix everyone converges on: elect a DISTINGUISHED proposer and let only it run ballots — no second bidder, no duel. Choose it with randomized timeouts so two candidates rarely collide (and a collision just retries with fresh dice). Then the big optimization, MULTI-PAXOS: since consensus is now run for a SEQUENCE of commands (slot 1, slot 2, …), the leader runs phase 1 once for all future slots and afterwards streams phase-2 accepts — one round-trip per command. Now read back what we built: a leader chosen by randomized timeouts, holding authority over a stream of slots, replicating each entry to a majority. That is Raft Leader Election, derived from first principles.',
    invariant: 'Multi-Paxos = Paxos with phase 1 hoisted out of the loop: a stable leader pays the prepare cost once, then one round-trip per command.',
  };

  yield {
    state: table('The Rosetta stone: Paxos ↔ Raft', [
      ['ballot', 'ballot number'],
      ['prep', 'prepare / promise'],
      ['acc', 'accept / accepted'],
      ['dist', 'distinguished proposer'],
      ['diff', 'the real difference'],
    ], [['raft', 'in Raft']], [
      ['the TERM — same monotonic tiebreaker, same role as the Lamport clocks in Clocks & Ordering: Lamport to TrueTime'],
      ['RequestVote / vote granted — phase 1 run once per term, for every future slot at once'],
      ['AppendEntries / ack — phase 2, streamed per log entry'],
      ['the leader'],
      ['where history transfers: Paxos pulls old values FORWARD via promises; Raft refuses to elect anyone whose log isn\'t up to date — push vs pull, same quorum-overlap proof'],
    ]),
    highlight: { active: ['diff:raft'] },
    explanation: 'Put the two vocabularies side by side and Raft reveals itself as Multi-Paxos with better ergonomics. Terms are ballots; RequestVote is prepare; AppendEntries is accept. The one structural difference is WHERE chosen history gets transferred: Paxos lets anyone win and forces the winner to adopt old values out of the promises (pull), while Raft makes up-to-dateness an eligibility requirement for leadership, so history never needs adopting (push). Both reduce to the same quorum-intersection argument. Raft\'s 2014 paper made understandability the explicit design goal — and proved the point with a user study in which students scored measurably higher on Raft questions than Paxos ones.',
    invariant: 'Same safety theorem, different transfer of history: Paxos adopts values after winning; Raft restricts who may win.',
  };

  yield {
    state: table('Forty years of consensus in production', [
      ['vr', 'Viewstamped Replication · 1988'],
      ['paxos', 'Paxos · 1989/1998'],
      ['zab', 'ZAB · 2008'],
      ['raft', 'Raft · 2014'],
      ['today', 'who runs what today'],
    ], [['legacy', 'place in the story']], [
      ['leader-based consensus BEFORE Paxos was published — rediscovered as the field caught up'],
      ['the safety argument everything else borrows; Google Chubby and Spanner run Multi-Paxos'],
      ['ZooKeeper\'s protocol — Multi-Paxos-shaped, powering Kafka and Hadoop coordination for a decade'],
      ['consensus made teachable: etcd (Kubernetes), Consul, CockroachDB, TiDB'],
      ['Multi-Paxos: Chubby, Spanner. Raft: etcd, Consul, CockroachDB. Same theorem underneath'],
    ]),
    highlight: { active: ['today:legacy'] },
    explanation: 'The lineage, honestly told. Viewstamped Replication had leader-based consensus in 1988, before Paxos\'s tangled publication saga even ended. Lamport\'s "Part-Time Parliament" (written 1989, deemed too weird to publish until 1998, then re-explained in 2001\'s "Paxos Made Simple") supplied the proof everyone reuses. ZooKeeper\'s ZAB quietly ran Multi-Paxos\'s shape under half of big data. Raft\'s contribution was pedagogical engineering — and it conquered the open-source world for exactly that reason: etcd sits under every Kubernetes cluster. Meanwhile inside Google, Spanner still runs a Paxos group per shard (the same machinery behind its TrueTime commits). Forty years, one theorem, two vocabularies.',
    invariant: 'Every production consensus system is the same quorum-overlap proof wearing different engineering: pick the vocabulary your team can hold.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'choosing one value') yield* chooseValue();
  else if (view === 'duels & the road to Raft') yield* duels();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Paxos is a consensus algorithm that solves a fundamental problem in distributed systems: how can a group of machines agree on a single value (a log entry, a committed transaction, a lock holder) when machines crash and messages are lost, yet no one machine is trusted to coordinate? Unlike Two-Phase Commit (2PC), which blocks forever if its coordinator dies at the wrong moment, Paxos has no fixed coordinator. ANY proposer can try to get agreement using monotonically increasing ballot numbers, and a simple majority of machines suffices. Once a value is chosen (accepted by a majority), it survives future crashes. The algorithm, written by Leslie Lamport in 1989 but not published until 1998, is the safety argument every modern consensus system borrows — from Google's Chubby and Spanner to etcd and Raft.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Paxos runs in two phases. Phase 1 (prepare): a proposer picks a unique increasing ballot number and sends it to a quorum of acceptors. Each acceptor that hasn't promised a higher ballot replies with a PROMISE — "I will never accept anything lower than your ballot" — and reports the last value it ever accepted (if any). This is not a value vote; it's permission to proceed plus a historical interview. Phase 2 (accept): if the proposer has a majority of promises and the promises reported no prior acceptance, the proposer may propose its own value. If one promise reported a prior acceptance, the proposer MUST adopt that value (the adoption rule). Acceptors record the (ballot, value) pair. The instant a majority accepts it, that value is CHOSEN — even if no proposer knows yet. Chosen-ness is a system property (a quorum all agree), not a fact in any single machine.`,
        `The crash story: When proposer P1 crashes after a value "X" is chosen, proposer P2 can prepare with a higher ballot via a different majority (the partition heals). Some member of P2's prepare-quorum was in P1's accept-quorum and will report (ballot₁, "X"). The adoption rule forces P2 to propose "X", not its own "Y". Any two majorities of five share at least one member — so history rides the quorum intersections forward forever. Acceptors persist their promises to disk before replying; a forgotten promise breaks the chain.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Basic Paxos requires two round-trips: prepare then accept. In a network with latency L, consensus takes 2L. The real cost surfaces in the duel scenario: two uncoordinated proposers can enter a livelock where each prepare outbids the other's pending accept, forever making progress but never choosing a value. This is not a Paxos bug; it's the FLP theorem (Fischer, Lynch, Paterson, 1985) showing through — no deterministic async algorithm guarantees both safety and liveness when even one crash is possible. Paxos chose to keep safety unconditional and accept that livelock can happen. Multi-Paxos solves this: elect ONE distinguished proposer (via randomized timeouts) and run prepare once for all future slots, then stream accepts — one round-trip per command. That hoisting is where Paxos becomes teachable and Raft emerges.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Google Chubby and Spanner run Multi-Paxos: each data shard holds a consensus group over replicas, with the leader chosen to run for a lease period. ZooKeeper (and Kafka, Hadoop) runs ZAB, a Multi-Paxos-shaped protocol, managing cluster coordination for billions of operations a day. Raft (2014) reimplemented the same quorum-intersection theorem with better pedagogy — the RequestVote / AppendEntries split is clearer than prepare / accept, and the up-to-dateness eligibility rule (push history) is easier to reason about than adoption (pull history). Raft conquered the open-source world: etcd powers Kubernetes, Consul runs service discovery, CockroachDB uses Raft for distributed transactions. At Google, Spanner still uses Paxos; at everyone else, Raft.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap: thinking chosen-ness requires a proposer to announce it. It doesn't. The instant a majority records (ballot, value), it's chosen, whether any proposer ever hears back. Learning that it happened — and telling clients — is a separate concern and can fail gracefully. Second trap: confusing phase 1 (which gathers promises, not votes) with a vote. The promise quorum is interviewed about the past, not consulted about the future. Third: assuming a higher ballot number can "undo" a choice. It can't. The adoption rule ensures every higher ballot MUST propose the same value, so safety is monotonic. Finally, don't assume Paxos guarantees livelock-free progress with two proposers — it doesn't. The duel is real and deterministic algorithms can't avoid it. That's why all production systems elect a leader.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "Raft Leader Election" to see how term election (randomized timeouts) eliminates the duel. Study "Raft Log Replication" to see Multi-Paxos recast as a log machine. Continue into "Byzantine Fault Tolerance: When Nodes Lie" and "HotStuff BFT Quorum Certificate Case Study" to see how the quorum-intersection proof changes when nodes can lie instead of merely crash. Explore "Two-Phase Commit (2PC)" to understand why 2PC blocks forever on coordinator failure while Paxos doesn't. Understand "Clocks & Ordering: Lamport to TrueTime" to see ballot numbers as Lamport clocks enforcing a happens-before order. Finally, learn "CAP Theorem" to understand why Paxos safety (consistency + availability) trades off partition tolerance with live-leader requirement — and why leased leaders (Chubby, Spanner, Raft with lease) form the bridge to practical systems.`,
      ],
    },
  ],
};
