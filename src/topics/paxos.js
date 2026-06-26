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
        'Read each row as one acceptor with durable memory. The promised column is the highest ballot the acceptor has promised not to go below, and the accepted column is the last value it wrote for some ballot.',
        { type: "callout", text: "Paxos separates who may speak next from which value history forces that speaker to carry." },
        'Active cells show promises or accepts being written. Found cells show a majority holding the same accepted value, which means the value is chosen even if no single machine has yet learned that fact.',
        {type: 'image', src: './assets/gifs/paxos.gif', alt: 'Animated walkthrough of the paxos visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Consensus means a group chooses one value and never later chooses a conflicting value. Distributed systems need this for replicated log entries, lock ownership, configuration changes, and metadata updates that must survive crashes.',
        'The hard part is not choosing on a healthy network. The hard part is choosing safely when messages can be delayed or lost, proposers can crash mid-round, and different majorities can be contacted at different times.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a coordinator. Every participant asks one designated machine which value won, and the coordinator records the decision on durable storage before telling others.',
        'Two-Phase Commit follows this shape: participants vote, then the coordinator sends commit or abort. It works for atomic commit, but it blocks if the coordinator dies at the wrong moment because no other node is allowed to finish the decision.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A fixed coordinator is a single point of liveness failure. If it crashes after some participants hear commit and others do not, the survivors cannot safely infer the decision without waiting for coordinator recovery.',
        'Pure majority voting also fails. Two different proposers can each contact a majority, and the overlap is only useful if the shared acceptor carries old accepted history into the later round.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Any two majorities of the same acceptor set intersect. Paxos turns that overlap into a safety mechanism by forcing each newer ballot to ask a majority what it already accepted before proposing a value.',
        {
          type: "image",
          src: "https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg",
          alt: "Directed graph with nodes connected by arrows",
          caption: "Consensus protocols are graph protocols over unreliable message paths; the safety proof comes from quorum overlap, not from reliable delivery. Source: Wikimedia Commons, David W., public domain.",
        },
        'Ballots order attempts, and adoption preserves history. A proposer may win authority with a higher ballot, but if its promise quorum reports an accepted value, it must carry the highest-ballot accepted value forward.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phase 1 is prepare and promise. A proposer chooses ballot n, sends Prepare(n), and each acceptor that has not promised a higher ballot promises to reject lower ballots and reports its highest accepted pair if it has one.',
        'Phase 2 is accept. If the proposer gets promises from a majority, it sends Accept(n, value), where value is the highest-ballot accepted value reported by the quorum or its own value if the quorum reported none.',
        'A value is chosen when a majority accepts the same ballot value. Learners may discover that later, but chosen-ness is already true as a property of the acceptor set.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Suppose value X was chosen by a majority Q1. Any later proposer that reaches Phase 2 must first have collected promises from another majority Q2, and Q1 and Q2 share at least one acceptor.',
        'That shared acceptor reports its accepted value unless an even higher accepted value has already carried X forward. The adoption rule therefore forces the later proposer to propose X, so a different value cannot be chosen in a higher ballot.',
        'Durability is part of the proof. If an acceptor forgets a promise or an accepted value after a crash, the overlap no longer reliably carries history, and the safety argument can fail.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Single-decree Paxos costs two network round trips in the normal uncontended case: prepare/promise and accept/accepted. Each round sends messages to enough acceptors to obtain a majority, so the message pattern is O(n) per round for n acceptors.',
        'Multi-Paxos reduces steady-state cost by electing a stable distinguished proposer. That leader performs Phase 1 once for a ballot and then appends log entries with Phase 2 only, giving one round trip per command while the leader remains stable.',
        'The behavioral cost is liveness under contention. Two proposers can keep outbidding each other so every accept arrives after a higher promise, which preserves safety but prevents progress until a leader or randomized backoff ends the duel.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Paxos and Multi-Paxos are used for replicated metadata and logs. Google Chubby and Spanner are well-known systems built around Paxos groups for lock service and data-shard replication.',
        'Many systems use protocols with the same quorum-overlap skeleton. ZooKeeper ZAB and Raft organize the machinery around a leader, but they still rely on majority intersections to preserve committed history.',
        'The fit is strongest when the system must survive crash faults and partitions without ever exposing two committed answers for one log slot. Databases, configuration stores, lock services, and lease managers all have that shape.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Basic Paxos is not a complete production replication system. Real deployments need logs, snapshots, membership changes, leader leases, read rules, disk recovery, compaction, metrics, and careful client retry semantics.',
        'It also fails as an implementation exercise when the adoption rule is treated as optional. A proposer that wins a higher ballot but ignores prior accepted values can break safety while every individual message still looks plausible.',
        'Paxos assumes crash faults, not Byzantine faults. If acceptors can lie, equivocate, or forge messages, the majority-overlap proof is insufficient and Byzantine fault tolerant protocols are needed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use three acceptors A1, A2, and A3, where a majority is any two. P1 sends Prepare(1), receives promises from A1 and A2 with no prior accepted values, then sends Accept(1, X) to A1 and A2.',
        'A1 and A2 accept (1, X), so X is chosen by two of three acceptors. P1 crashes before telling anyone, so the system has a chosen value that may not yet be known to a learner.',
        'P2 later sends Prepare(2) to A2 and A3 because it wants Y. A2 reports that it accepted (1, X), so P2 must send Accept(2, X), not Accept(2, Y); the overlap at A2 carries the chosen value into the higher ballot.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Leslie Lamport, The Part-Time Parliament, 1998, and Paxos Made Simple, 2001. Also read Fischer, Lynch, and Paterson on the FLP impossibility result to understand why safety and guaranteed termination cannot both be unconditional in the asynchronous crash model.',
        'Study Two-Phase Commit for the blocking coordinator baseline, Raft for the leader-oriented teaching version, Write-Ahead Log for the durable acceptor state, Distributed Locks for an application, and Byzantine Fault Tolerance for the stronger failure model.',
      ],
    },
  ],
};
