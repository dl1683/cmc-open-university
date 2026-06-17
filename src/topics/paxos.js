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
    explanation: 'Phase 1 is a permission round that doubles as an interview. P1 picks ballot 1 and sends prepare(1). Each acceptor that hasn\'t promised a higher ballot replies with a PROMISE — "I will never accept anything with a ballot below 1" — and reports the last value it ever accepted (here: none). P1 has a majority of promises (A1–A3), so it now knows two things: its ballot is currently the highest in play among a quorum, and no value has been chosen yet, so it is free to propose its own. Note what phase 1 did NOT do: no value was sent. It only froze the past and read it.',
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
      heading: `Why This Exists`,
      paragraphs: [
        `Paxos exists because distributed systems need decisions that survive partial failure. A lock service must decide who owns a lock. A replicated database must decide the next log entry. A configuration service must decide which membership change is committed. The hard part is not computing the value on one machine; it is making a group of machines agree even when messages are delayed, duplicated, lost, or delivered out of order, and when some machines crash after writing only part of their local state.`,
        `The basic Paxos problem is single-decree consensus: choose one value exactly once. Multi-Paxos repeats that problem for a sequence of log slots. Production systems usually care about the log, but the single-value algorithm is the proof kernel. If the group can choose one value safely, then a log can be built by choosing slot 1, slot 2, slot 3, and so on under additional leadership and recovery rules.`,
        `The word "consensus" has two separate promises. Safety says two different values are never chosen for the same decision. Liveness says the system eventually chooses something when enough nodes and communication are available. Paxos is famous because its safety proof is strong under very hostile timing. It is also famous because liveness requires extra engineering: in a purely asynchronous model, two proposers can keep outbidding each other forever without violating safety.`,
      ],
    },
    {
      heading: `Why The Obvious Approach Fails`,
      paragraphs: [
        `The easiest design is a single coordinator. Every participant asks the coordinator what value won, and the coordinator writes the answer somewhere durable. That is essentially the shape of Two-Phase Commit. It is simple until the coordinator crashes after some participants have heard the decision and others have not. The survivors cannot safely infer whether the value was committed, because the one machine allowed to decide is gone.`,
        `Another tempting design is majority voting without history. Let each proposer send a value to a majority, and whichever value gets enough acknowledgments wins. That breaks when two proposal attempts overlap. One majority might accept X, another later majority might accept Y, and the two majorities may share a node that forgot or ignored the earlier value. The system needs a rule that forces later attempts to carry earlier accepted history forward.`,
        `The third tempting design is "highest ballot wins" by itself. Ballot numbers do order attempts, but order is not enough. If a higher ballot can freely replace the value from a lower ballot that was already accepted by a majority, safety is lost. Paxos uses ballots for authority and a separate adoption rule for value preservation.`,
      ],
    },
    {
      heading: `Core Insight And Mechanism`,
      paragraphs: [
        `Paxos has proposers, acceptors, and learners. A proposer tries to get a value chosen. An acceptor stores promises and accepted values. A learner eventually finds out what was chosen. These can be separate roles or combined in the same server process; the proof depends on the acceptor state and quorum rules.`,
        `Phase 1 is prepare and promise. A proposer chooses a unique ballot number n and sends prepare(n) to acceptors. An acceptor promises ballot n if it has not already promised a higher ballot. That promise means it will reject future accept requests with ballot numbers lower than n. The acceptor also reports the highest-numbered value it has already accepted, if any.`,
        `Phase 2 is accept and accepted. If the proposer receives promises from a quorum, it may send accept(n, value). If none of the promises reported an already accepted value, the proposer can use its own value. If any promise reported a prior accepted value, the proposer must choose the value from the highest-numbered accepted report. Acceptors that have not promised a higher ballot record the accepted pair. When a quorum has accepted the same ballot's value, the value is chosen.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `The safety proof rests on quorum intersection. In a five-acceptor system, any quorum of three shares at least one acceptor with any other quorum of three. More generally, any two strict majorities intersect. Once a value X is accepted by a quorum, every later prepare quorum must include at least one acceptor from that chosen quorum, assuming acceptors keep their durable state.`,
        `That shared acceptor is the carrier of history. When a later proposer asks for promises, the acceptor reports the accepted value it remembers. The adoption rule then forces the later proposer to continue X rather than replace it with Y. The new ballot can supersede old authority, but it cannot supersede the chosen value. Authority moves forward; value safety is preserved through the overlap.`,
        `The proof is inductive. For the first chosen value, a quorum accepted it. For any higher ballot that reaches phase 2, its phase-1 quorum intersects the earlier chosen quorum or a later quorum that already carried the same value forward. The highest accepted report visible to the proposer therefore leads it back to the chosen value. No future ballot can choose a different value without violating the promise/adoption rule.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Use five acceptors: A1 through A5. A quorum is any three. Proposer P1 wants value X and sends prepare(1) to A1, A2, and A3. None has promised a higher ballot, so they promise ballot 1 and report no accepted value. P1 then sends accept(1, X) to those same acceptors. A1, A2, and A3 write the pair (1, X). At that instant X is chosen, even if P1 crashes before it tells any client.`,
        `Now proposer P2 wants value Y. It uses ballot 2 and reaches A3, A4, and A5. A4 and A5 report no accepted value, but A3 reports (1, X). Because A3 is in the intersection of the old chosen quorum and the new prepare quorum, P2 learns the prior history. P2 must send accept(2, X), not accept(2, Y). If A3, A4, and A5 accept, the system has not chosen a second value; it has re-established X under a newer ballot.`,
        `This example shows why chosen-ness is not the same as notification. A value can be chosen before any learner knows. Clients usually need a leader or learner path that confirms the chosen value before returning success, but the safety property exists as soon as the acceptor quorum has written the accepted pair.`,
      ],
    },
    {
      heading: `Cost And Liveness`,
      paragraphs: [
        `Single-decree Paxos needs two message round trips in the uncontended case: prepare/promise, then accept/accepted. That is expensive if every log entry pays the full cost. Multi-Paxos amortizes phase 1. A stable leader runs prepare once for a ballot and then sends accept messages for many log slots. In steady state, each command usually needs one quorum round trip, plus any client and disk latency around it.`,
        `Paxos does not guarantee progress under arbitrary scheduling. Two proposers can duel: P1 prepares ballot 1, P2 prepares ballot 2, P1's accept for ballot 1 is rejected, P1 prepares ballot 3, P2's accept for ballot 2 is rejected, and so on. Every node may be healthy, and every safety rule may be obeyed, yet no value is chosen. This is the practical face of the FLP result: deterministic consensus cannot guarantee termination in a fully asynchronous system with possible crashes.`,
        `Production protocols add a liveness strategy. They choose a distinguished proposer, often called the leader, and arrange for other nodes not to compete while it appears healthy. Randomized election timeouts, leases, heartbeats, backoff, and failure detectors are engineering tools around the Paxos safety core. The algorithm's safety does not depend on the leader being perfect, but throughput does.`,
      ],
    },
    {
      heading: `Operational Guidance`,
      paragraphs: [
        `Persist acceptor state before replying. The highest promised ballot and highest accepted pair are not cache entries; they are part of the proof. If an acceptor forgets a promise after a crash, it may accept an older ballot that should have been dead. If it forgets an accepted value, a later proposer may fail to carry chosen history forward.`,
        `Use ballot numbers that are globally unique and monotonically ordered. A common pattern is a counter combined with a node id, or a term/epoch assigned by a membership layer. Reusing a ballot number for different attempts is a safety bug. Letting clocks alone define ballots is risky unless the system has a carefully specified clock and fencing model.`,
        `Specify membership and reconfiguration. The simple majority proof assumes a fixed acceptor set. Real systems change replicas, replace disks, move shards, and recover from long outages. Joint consensus, epochs, or carefully staged configuration changes are needed so old and new quorums intersect while the membership changes.`,
        `Instrument both safety and liveness signals. Safety bugs are rare but severe: conflicting accepted values for the same slot, non-monotonic promises, lost durable state, or ballot reuse. Liveness bugs show up as repeated preemption, leader churn, long accept latency, and slots stuck without a chosen value. The operational question is not only "is Paxos correct in a paper?" but "does this deployment preserve the assumptions the proof needs?"`,
      ],
    },
    {
      heading: `Where It Matters`,
      paragraphs: [
        `Paxos matters anywhere a service needs a replicated decision with crash faults rather than Byzantine faults. Lock services, metadata stores, configuration stores, distributed databases, replicated logs, and lease managers all need the same core property: a client should not observe two different committed answers for the same slot just because one replica crashed or a network partition healed.`,
        `Google's Chubby and Spanner made Multi-Paxos a production centerpiece. ZooKeeper's ZAB and Raft-style systems use a closely related leader-and-quorum shape. Even when a system advertises Raft rather than Paxos, the underlying proof vocabulary is often the same: terms or ballots establish epochs, quorums intersect, and log history must be transferred or restricted so two leaders cannot commit conflicting entries.`,
      ],
    },
    {
      heading: `Failure Modes And Misconceptions`,
      paragraphs: [
        `The most dangerous misconception is that a higher ballot can erase a chosen value. It cannot. A higher ballot can preempt lower ballots, but once the proposer hears accepted history from a quorum, it must adopt the highest accepted value reported. If the implementation treats ballot victory as permission to choose any value, it is not Paxos.`,
        `Another misconception is that prepare is a vote on the proposed value. During phase 1, the proposer is not asking acceptors whether they like X or Y. It is asking for authority to run a ballot and for a report of prior accepted values. The value decision is constrained by the history returned in those promises.`,
        `A practical failure is returning success too early. If a leader tells a client that a write committed before an accept quorum is durable, a crash can make the client observe a promise the system did not actually keep. Another failure is ignoring stale leaders. A leader that lost its ballot must be fenced from serving reads or writes that assume it still owns the current epoch.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Two-Phase Commit (2PC) to see the blocking coordinator baseline Paxos avoids. Study Raft Leader Election for the liveness layer that prevents dueling proposers in common deployments. Study Raft Log Replication to see Multi-Paxos expressed as an understandable replicated log. Study Raft Joint Consensus for safe membership change. Study CAP Theorem for the availability consequences of choosing consistency during partitions. Study Byzantine Fault Tolerance: When Nodes Lie when the failure model changes from crash faults to malicious or arbitrary behavior.`,
      ],
    },
  ],
};
