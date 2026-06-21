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
  const majority = Math.ceil(ACCEPTORS.length / 2);
  const partitioned = ACCEPTORS.length - majority;

  yield {
    state: table(`The cast: ${ACCEPTORS.length} acceptors, 2 proposers, majority = ${majority}`, ACCEPTORS, COLS, [
      ['—', '—', 'remembers two things: highest ballot promised, last value accepted'],
      ['—', '—', 'an acceptor never forgets a promise (it survives crashes on disk)'],
      ['—', '—', `any ${majority} of ${ACCEPTORS.length} form a quorum`],
      ['—', '—', 'currently partitioned away'],
      ['—', '—', 'currently partitioned away'],
    ]),
    highlight: {},
    explanation: `The problem: ${ACCEPTORS.length} machines must agree on ONE value — which write wins, who holds a lock, what the next config is — even while machines crash and messages vanish. Two-Phase Commit (2PC) can\'t do this: it blocks forever if the coordinator dies at the wrong moment, because no one else is allowed to finish the decision. Paxos\'s answer (Lamport, written 1989, finally published 1998) has no fixed coordinator at all: ANY proposer may try, every attempt carries a unique increasing BALLOT NUMBER, and acceptors enforce the rules. ${partitioned} of the ${ACCEPTORS.length} acceptors are partitioned away for this whole story — Paxos only ever needs a majority of ${majority} alive.`,
    invariant: `Consensus contract: only one value is ever chosen, and it is only chosen if a majority (${majority} of ${ACCEPTORS.length}) accepted it.`,
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
    explanation: `Phase 1 is a permission round that doubles as an interview. P1 picks ballot 1 and sends prepare(1). Each acceptor that hasn\'t promised a higher ballot replies with a PROMISE — "I will never accept anything with a ballot below 1" — and reports the last value it ever accepted (here: none). P1 has ${majority} promises (A1–A3) — a majority of ${ACCEPTORS.length} — so it now knows two things: its ballot is currently the highest in play among a quorum, and no value has been chosen yet, so it is free to propose its own. Note what phase 1 did NOT do: no value was sent. It only froze the past and read it.`,
    invariant: `A promise is a one-way door: an acceptor that promised ballot n is dead to every ballot below n, forever.`,
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
    explanation: `Phase 2: P1 sends accept(1, "X") to its quorum, and each acceptor — none of which has promised anything higher — records (1, "X"). The instant the ${majority}rd acceptor writes it down, "X" is chosen. Pause on how strange that is: no machine knows yet. P1 hasn\'t collected the acks; A1 doesn\'t know about A3. Chosen-ness is a property of the SYSTEM — ${majority} of ${ACCEPTORS.length} acceptors hold the same (ballot, value) — not a fact in any single memory. Learning that it happened comes later and can fail; the choice itself, once made, is permanent physics.`,
    invariant: `Chosen means: some majority (${majority} of ${ACCEPTORS.length}) all accepted the same ballot\'s value. No single node\'s knowledge is required.`,
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
    explanation: `Now the part that makes Paxos PAXOS. P1 crashes before telling anyone. P2 — wanting to propose its own value "Y" — prepares ballot 2 and reaches a different majority of ${majority}: A3, A4, A5 (the partition healed). The promises come back, and one of them is loaded: A3 reports it accepted (1, "X"). Here is the sacred rule: a proposer must adopt the value of the HIGHEST-ballot acceptance reported in its promise quorum. P2 wanted "Y"; it must propose "X". Its ballot wins, but the value survives. P2\'s ambition is reduced to a courier service for history.`,
    invariant: `Adoption rule: propose your own value ONLY if the promise quorum (${majority} of ${ACCEPTORS.length}) reports no prior acceptance; else carry the highest one forward.`,
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
    explanation: `The proof fits in one sentence: any two majorities of ${ACCEPTORS.length} share at least ${2 * majority - ACCEPTORS.length} member, so SOME acceptor in every future prepare-quorum was in the majority that chose "X" — and its promise reply carries the evidence forward. The chosen value rides the quorum intersections into every higher ballot, forever. This is also why acceptors must persist their state to disk before replying (a forgotten promise breaks the chain), and it\'s the same quorum-overlap argument that makes Raft Log Replication safe — Raft inherited the skeleton and gave it a friendlier face, which is the second view\'s story.`,
    invariant: `Any two majorities of ${ACCEPTORS.length} (quorum ${majority}) intersect: once chosen, every higher ballot\'s prepare phase is forced to learn and re-propose the same value.`,
  };
}

function* duels() {
  const majority = Math.ceil(ACCEPTORS.length / 2);

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
    explanation: `Paxos\'s safety is perfect; its LIVENESS is not. Watch two well-behaved proposers destroy each other across ${ACCEPTORS.length} acceptors: each one\'s prepare outbids the other\'s pending ballot, so every accept arrives to find its ballot already obsolete. Prepare, outbid, reject, re-prepare — a livelock that can spin forever with every machine healthy and every message delivered. This isn\'t a Paxos bug to be patched; it\'s the FLP theorem (1985) showing through: no deterministic algorithm can guarantee consensus termination in an asynchronous system with even one possible crash. Paxos chose to keep safety unconditional and let liveness depend on luck — or on a referee.`,
    invariant: `Safety holds even mid-duel — no wrong value is ever chosen by the ${ACCEPTORS.length} acceptors. What\'s sacrificed is progress: liveness needs the duel to end.`,
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
    explanation: `The fix everyone converges on: elect a DISTINGUISHED proposer and let only it run ballots among the ${ACCEPTORS.length} acceptors — no second bidder, no duel. Choose it with randomized timeouts so two candidates rarely collide (and a collision just retries with fresh dice). Then the big optimization, MULTI-PAXOS: since consensus is now run for a SEQUENCE of commands (slot 1, slot 2, …), the leader runs phase 1 once for all future slots and afterwards streams phase-2 accepts — one round-trip per command, each needing ${majority} acks. Now read back what we built: a leader chosen by randomized timeouts, holding authority over a stream of slots, replicating each entry to a majority. That is Raft Leader Election, derived from first principles.`,
    invariant: `Multi-Paxos = Paxos with phase 1 hoisted out of the loop: a stable leader pays the prepare cost once across ${ACCEPTORS.length} acceptors, then one round-trip per command.`,
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
    explanation: `Put the two vocabularies side by side and Raft reveals itself as Multi-Paxos with better ergonomics. Terms are ballots; RequestVote is prepare; AppendEntries is accept. The one structural difference is WHERE chosen history gets transferred: Paxos lets anyone win among ${ACCEPTORS.length} acceptors and forces the winner to adopt old values out of the promises (pull), while Raft makes up-to-dateness an eligibility requirement for leadership, so history never needs adopting (push). Both reduce to the same quorum-intersection argument (majority = ${majority}). Raft\'s 2014 paper made understandability the explicit design goal — and proved the point with a user study in which students scored measurably higher on Raft questions than Paxos ones.`,
    invariant: `Same safety theorem, different transfer of history: Paxos adopts values after winning; Raft restricts who may win.`,
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
    explanation: `The lineage, honestly told. Viewstamped Replication had leader-based consensus in 1988, before Paxos\'s tangled publication saga even ended. Lamport\'s "Part-Time Parliament" (written 1989, deemed too weird to publish until 1998, then re-explained in 2001\'s "Paxos Made Simple") supplied the proof everyone reuses. ZooKeeper\'s ZAB quietly ran Multi-Paxos\'s shape under half of big data. Raft\'s contribution was pedagogical engineering — and it conquered the open-source world for exactly that reason: etcd sits under every Kubernetes cluster. Meanwhile inside Google, Spanner still runs a Paxos group per shard (the same machinery behind its TrueTime commits). Forty years, one theorem, two vocabularies.`,
    invariant: `Every production consensus system is the same quorum-overlap proof (majority of ${ACCEPTORS.length} = ${majority}) wearing different engineering: pick the vocabulary your team can hold.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        "The first view ('choosing one value') shows five acceptors as a table. Each acceptor tracks two fields: its highest promised ballot and its last accepted (ballot, value) pair. Proposers P1 and P2 run the two-phase protocol against this group. Active cells mark fields changing during the current phase. Found cells mark values accepted by a majority -- the instant that third acceptor writes the pair, the value is chosen, even though no single machine knows it yet.",
        { type: "callout", text: "Paxos separates who may speak next from which value history forces that speaker to carry." },
        "The second view ('duels & the road to Raft') replays two proposers outbidding each other in alternating prepares. Removed cells mark rejected accept attempts: ballots that arrived after acceptors had already promised something higher. Every rejection obeys the safety rules, yet no value is ever chosen. The view then derives Multi-Paxos and the Raft mapping as the engineering fix.",
        "Under each frame, the invariant line states the property that keeps the step safe. If the invariant holds, two different values cannot both be chosen. If an acceptor loses its durable state, the invariant breaks.",
      
        {type: 'image', src: './assets/gifs/paxos.gif', alt: 'Animated walkthrough of the paxos visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "Distributed systems need decisions that survive partial failure. A lock service must decide who holds a lock. A replicated database must decide which write occupies log slot 7. A configuration store must decide which membership change is committed. The computation is trivial on one machine; the hard part is making a group agree when messages are delayed, reordered, duplicated, or lost, and when machines crash mid-write.",
        "Lamport wrote the Paxos algorithm around 1989 and published it as 'The Part-Time Parliament' in 1998. It proved that consensus is possible despite crash failures in an asynchronous network -- a question the 1985 FLP impossibility result had shown cannot be solved deterministically with guaranteed termination. Paxos chose unconditional safety and conditional liveness: no wrong answer ever, but progress requires enough cooperation.",
        "The basic problem is single-decree consensus: a group of acceptors must choose exactly one value. Multi-Paxos repeats that for a sequence of log slots. Production systems care about the log, but the single-decree algorithm is the proof kernel that everything else builds on.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "The natural first attempt is a single coordinator. Every participant asks one designated machine what value won, and the coordinator writes it somewhere durable. This is Two-Phase Commit (2PC): the coordinator sends prepare to all participants, collects votes, then sends commit or abort. It works until the coordinator crashes after sending commit to some participants but not others. The survivors cannot safely guess whether the value was committed, because the one machine authorized to decide is gone. Recovery means waiting for the coordinator to come back -- unbounded blocking.",
        "A second attempt is pure majority voting: send a value to a majority of nodes, and if enough acknowledge, declare it chosen. This breaks when two proposals overlap. One majority accepts X, a later majority accepts Y, and if the shared node forgot or ignored the earlier value, the system has committed two conflicting answers. Majority agreement is necessary but not sufficient.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "2PC blocks because it concentrates all authority in one coordinator. Lose that coordinator at the wrong moment and the entire system hangs -- no other node is allowed to finish the decision. This is not a recoverable timeout; it is a fundamental single point of failure.",
        "Pure majority voting fails because it has no rule to carry history forward. Two overlapping majorities share at least one member, but unless that member forces the later proposal to respect the earlier acceptance, conflicting values can both reach quorum. The system needs order (to tell which attempt is newer) and adoption (to force newer attempts to preserve older chosen values).",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Any two majorities of the same set must share at least one member. Paxos exploits this overlap with two rules. First, each proposal carries a unique, increasing ballot number; acceptors promise to ignore anything with a lower number. Second, when a proposer collects promises, each acceptor reports whatever value it previously accepted. The proposer must adopt the highest-ballot accepted value from the responses -- it cannot substitute its own.",
        {
          type: "image",
          src: "https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg",
          alt: "Directed graph with nodes connected by arrows",
          caption: "Consensus protocols are graph protocols over unreliable message paths; the safety proof comes from quorum overlap, not from reliable delivery. Source: Wikimedia Commons, David W., public domain.",
        },
        "Later ballots can supersede authority (which proposer runs the round) but never the chosen value. Phase 1 freezes the past and reads it. Phase 2 writes only what the past allows. This separation of authority transfer from value preservation is exactly what 2PC lacks: 2PC merges both into one coordinator, so losing the coordinator loses everything.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Three roles: a proposer tries to get a value chosen, an acceptor stores promises and accepted values on durable storage, and a learner discovers what was chosen. These roles can live on the same server; the proof depends only on acceptor state and quorum rules.",
        "Phase 1 (Prepare): the proposer picks a unique ballot number n and sends Prepare(n) to acceptors. An acceptor that has not already promised a higher ballot replies with a promise -- a guarantee that it will reject any future Accept request with a ballot below n. The reply also includes the highest-ballot (ballot, value) pair the acceptor has previously accepted, if any. Phase 1 sends no value. It only freezes the past and reads it.",
        "Phase 2 (Accept): if the proposer collects promises from a majority, it sends Accept(n, v). The value v is the highest-ballot accepted value reported in the promises, or the proposer's own value if no acceptor reported a prior acceptance. Each acceptor that has not promised a higher ballot records (n, v). When a majority of acceptors have accepted the same ballot's value, that value is chosen.",
        "Chosen-ness is a system property, not a notification. No single machine needs to know the value is chosen for it to be chosen. Learning happens later, through a separate learner protocol or by the proposer collecting Accept acknowledgments.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Safety rests on quorum intersection. With five acceptors and quorums of three, any two quorums share at least one member. Once value X is accepted by a quorum Q1, every future Phase 1 quorum Q2 includes at least one member of Q1. That shared acceptor reports (ballot, X) in its promise. The adoption rule forces the new proposer to carry X forward rather than replace it.",
        "The proof is inductive. Base case: the first chosen value X was accepted by a majority. Inductive step: for any higher ballot that reaches Phase 2, its Phase 1 quorum intersected the chosen quorum (or a later quorum that already carried X forward). The highest accepted report visible to the proposer leads back to X. No future ballot can choose a different value without violating the promise or adoption rule.",
        "The chain depends on acceptors persisting state before replying. If an acceptor forgets a promise after a crash, it might accept an older ballot that should be dead. If it forgets an accepted value, a later proposer might fail to discover the chosen history. The durable write-ahead log is part of the proof, not an optimization.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        "Single-decree Paxos needs two network round trips in the uncontended case: Prepare/Promise, then Accept/Accepted. Each round sends O(n) messages where n is the number of acceptors. For a single decision this is fine; for a replicated log where every entry pays the full cost, it doubles the latency budget.",
        "Multi-Paxos amortizes Phase 1. A stable leader runs Prepare once for a ballot that covers all future log slots, then streams Accept messages -- one round trip per command in steady state. This is the shape every production system actually deploys.",
        "Livelock is possible. Two proposers can duel: P1 prepares ballot 1, P2 prepares ballot 2 (killing ballot 1), P1 prepares ballot 3 (killing ballot 2), forever. Every safety rule is obeyed, every machine is healthy, yet no value is chosen. This is the FLP impossibility theorem made visible: no deterministic algorithm can guarantee consensus termination in an asynchronous system with even one possible crash. Multi-Paxos fixes this by electing a stable leader with randomized timeouts so competing proposers rarely collide.",
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        "Google's Chubby lock service runs Multi-Paxos internally; Spanner runs a Paxos group per data shard, using it to replicate writes across datacenters before TrueTime-stamped commits. Azure Storage uses Paxos-based replication for its stream layer.",
        "The protocol's shape reappears under different names. ZooKeeper's ZAB is Multi-Paxos-shaped and powered Kafka and Hadoop coordination for over a decade. Raft is Multi-Paxos re-engineered for understandability: terms are ballots, RequestVote is Prepare, AppendEntries is Accept. etcd (under every Kubernetes cluster), Consul, CockroachDB, and TiDB all run Raft. The underlying quorum-overlap proof is the same.",
        "Paxos fits anywhere a service needs a replicated decision under crash faults: lock services, metadata stores, configuration stores, distributed databases, and lease managers. The core property is that a client never observes two different committed answers for the same slot, even across crashes and partition healing.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Single-decree Paxos is impractical alone. Real systems need a replicated log, which means Multi-Paxos with leadership, log compaction, snapshotting, membership changes, and read leases. The gap between the paper algorithm and a production implementation is large enough that Raft was created specifically because Paxos is hard to implement correctly. Ongaro and Ousterhout's 2014 Raft paper included a user study showing students scored measurably higher on Raft questions than Paxos ones.",
        "Implementation traps are subtle. Returning success to a client before an Accept quorum is durable means a crash can break a promise the client thinks was kept. Letting a stale leader serve reads after losing its ballot can return values that were never committed. Treating ballot victory as permission to choose any value -- ignoring the adoption rule -- is the single most dangerous bug: it breaks safety silently.",
        "The fixed-membership assumption is another gap. The quorum intersection proof assumes a known, stable set of acceptors. Real systems add and remove replicas, replace failed disks, and recover from long outages. Joint consensus, configuration epochs, or staged membership changes are needed so old and new quorums continue to overlap during transitions.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Three-node cluster: acceptors A1, A2, A3. A quorum is any two.",
        "Proposer P1 wants value \"X\". It sends Prepare(1) to all three. None has promised a higher ballot, so all three promise ballot 1 and report no prior acceptance. P1 now has a majority of promises with no accepted history, so it is free to propose its own value. It sends Accept(1, \"X\") to A1 and A2. Both accept. Two of three is a majority: \"X\" is chosen.",
        "Proposer P2 wants value \"Y\". It sends Prepare(2) to A2 and A3. A3 has no prior state and promises freely. A2 has accepted (1, \"X\") and reports it in the promise reply. P2 collects its majority of promises, but the adoption rule forces it to use the highest-ballot accepted value from the responses: (1, \"X\"). P2 must send Accept(2, \"X\"), not Accept(2, \"Y\"). A2 is in both quorums -- that overlap is what carried the chosen value forward.",
        "If P2 had reached A1 and A3 instead, A1 would have reported (1, \"X\") and the outcome would be the same. Every possible majority of three includes at least one member of the original chosen majority. The value survives any combination of proposer crashes and quorum selections.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Lamport, 'The Part-Time Parliament' (1998) -- the original publication, delayed nearly a decade because reviewers found the Greek-parliament allegory confusing. Lamport, 'Paxos Made Simple' (2001) -- the same algorithm restated in plain pseudocode; the best single-paper introduction. Lamport, Shostak, and Pease, 'The Byzantine Generals Problem' (1982) -- the harder fault model where nodes can lie, not just crash.",
        {
          type: 'bullets',
          items: [
            "Raft -- Multi-Paxos re-engineered for teachability. Same quorum-overlap proof, but leadership eligibility replaces the adoption rule: only up-to-date nodes can win elections, so chosen history never needs to be pulled forward out of promises.",
            "Two-Phase Commit -- the blocking coordinator protocol Paxos was designed to replace. Understanding 2PC's coordinator-crash failure mode makes Paxos's leaderless Phase 1 feel inevitable.",
            "Distributed locks -- a direct consumer of consensus: the lock service uses Paxos or Raft to agree on who holds the lock, so the grant survives crashes.",
            "Write-Ahead Log -- the durable-state mechanism acceptors depend on. If the promised ballot or accepted value is not on disk before the promise reply leaves, a crash can break the quorum-intersection proof.",
            "Byzantine Fault Tolerance -- what changes when the failure model moves from crash faults (nodes stop) to arbitrary faults (nodes lie or equivocate). Paxos assumes honest crashes; BFT protocols like PBFT pay higher message complexity for safety against malicious participants.",
          ],
        },
      ],
    },
  ],
};
