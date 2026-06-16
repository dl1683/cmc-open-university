// Byzantine fault tolerance: Paxos and Raft survive nodes that DIE; this is
// the math for nodes that LIE. Three generals provably can't outvote one
// traitor, four can — and the 3f+1 rule runs blockchains and fly-by-wire.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'byzantine-generals',
  title: 'Byzantine Fault Tolerance: When Nodes Lie',
  category: 'Systems',
  summary: 'Why majority voting collapses at N = 3 with one liar, recovers at N = 4, and generalizes to the 3f+1 quorums behind PBFT and proof-of-stake chains.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['the generals & 3f+1', 'PBFT & the real world'], defaultValue: 'the generals & 3f+1' },
  ],
  run,
};

// The N = 4 majority vote, actually computed: each loyal lieutenant decides
// by majority over {what the commander told me} ∪ {what the others relayed}.
const maj = (votes) => {
  const a = votes.filter((v) => v === 'A').length;
  return a > votes.length - a ? 'ATTACK' : 'RETREAT';
};
// Traitor commander sends A, R, A to L1, L2, L3; loyal lieutenants relay
// honestly, so everyone ends up voting on the same multiset {A, R, A}.
const TRAITOR_CMD = { l1: maj(['A', 'R', 'A']), l2: maj(['R', 'A', 'A']), l3: maj(['A', 'A', 'R']) };
// Loyal commander sends A to all; traitor L3 relays "R" to both others.
const TRAITOR_LT = { l1: maj(['A', 'A', 'R']), l2: maj(['A', 'A', 'R']) };

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

function* generals() {
  yield {
    state: table('Two kinds of broken machine', [
      ['crash', 'crash fault'],
      ['byz', 'Byzantine fault'],
      ['examples', 'where Byzantine behavior comes from'],
      ['cost', 'replicas needed to tolerate f'],
    ], [['detail', '']], [
      ['the node STOPS: silent, absent, honest to the end — the only failure Paxos: Consensus Without a Leader and Raft Leader Election defend against'],
      ['the node does ANYTHING: sends wrong values, different answers to different peers, valid-looking garbage — and keeps participating'],
      ['cosmic-ray bit flips, buggy firmware acking unwritten data, a compromised server, an operator with an agenda'],
      ['crash: 2f + 1 (a majority outvotes silence) · Byzantine: 3f + 1 (a majority can be DECEIVED)'],
    ]),
    highlight: { compare: ['crash:detail', 'byz:detail'], active: ['cost:detail'] },
    explanation: 'Every consensus page so far assumed a polite failure model: nodes crash, meaning they stop and stay stopped. A Byzantine node — named for Lamport, Shostak & Pease\'s 1982 generals parable — violates the one assumption majority voting secretly leans on: that every node tells everyone the SAME thing. A liar can tell A "yes" and B "no" simultaneously (equivocation), and suddenly two honest nodes disagree about what the vote even was. The repair is not cleverer voting; it is MORE voters: tolerating f liars takes 3f + 1 participants, a third more hardware than the 2f + 1 that suffices for crashes. The next two steps prove both numbers with armies you can count on one hand.',
    invariant: 'Crash faults subtract votes; Byzantine faults FORGE them: the defense budget rises from 2f+1 to 3f+1.',
  };

  yield {
    state: table('N = 3, one traitor: two different worlds, one identical view', [
      ['w1', 'world 1 · the COMMANDER is the traitor'],
      ['w2', 'world 2 · lieutenant L2 is the traitor'],
      ['view', 'what L1 observes in BOTH worlds'],
      ['doom', 'the contradiction'],
    ], [['story', '']], [
      ['he tells L1 "attack" and L2 "retreat" — both lieutenants are loyal and must end up AGREEING anyway'],
      ['the loyal commander told everyone "attack" — but L2 relays "the commander told me retreat"'],
      ['direct order: "attack" · L2\'s relay: "he said retreat" — byte-for-byte the same evidence in world 1 and world 2'],
      ['world 2 demands L1 obey the loyal commander (attack); world 1 demands L1 agree with loyal L2 — and no rule satisfies both'],
    ]),
    highlight: { removed: ['doom:story'], compare: ['w1:story', 'w2:story'] },
    explanation: 'The famous impossibility, small enough to hold in your head. With three participants and unsigned ("oral") messages, lieutenant L1 receives contradictory testimony — "attack" from the commander, "he said retreat" from L2 — and CANNOT tell which of two worlds produced it: a traitor commander equivocating, or a traitor lieutenant slandering a loyal one. The two worlds require L1 to act differently (follow the commander in one, side with the lieutenant in the other), yet they generate identical observations, so no decision rule can be right in both. Three nodes cannot tolerate one liar. Notice the proof never mentions networks or timing: it is information-theoretic — the evidence itself is ambiguous.',
    invariant: 'With N = 3f oral messages, a liar can make distinct worlds observationally identical: no algorithm can decide correctly in both.',
  };

  yield {
    state: table('N = 4: one round of cross-checking defeats the liar (computed live)', [
      ['setup', 'round 1 · the orders'],
      ['relay', 'round 2 · lieutenants swap what they heard'],
      ['decide', 'each loyal lieutenant takes the majority'],
      ['flip', 'now make a LIEUTENANT the traitor instead'],
    ], [['story', '']], [
      ['traitor commander splits the army: tells L1 "A", L2 "R", L3 "A"'],
      ['everyone now holds the same three claims {A, R, A} — the traitor\'s inconsistency has been pooled into shared evidence'],
      [`L1 → ${TRAITOR_CMD.l1} · L2 → ${TRAITOR_CMD.l2} · L3 → ${TRAITOR_CMD.l3}: unanimous, despite three different original orders`],
      [`loyal commander says "A" to all; traitor L3 whispers "R" everywhere — but each loyal lieutenant holds {A, A, R}: majority ${TRAITOR_LT.l1}, the TRUE order wins 2-to-1`],
    ]),
    highlight: { found: ['decide:story', 'flip:story'] },
    explanation: `Add one general and run the same attack — every verdict above is computed live by the majority function. A traitor commander can still split his orders three ways, but the second round is fatal to him: when lieutenants exchange what they heard, his contradictions assemble into one shared multiset {A, R, A}, and every loyal lieutenant applies majority to the SAME evidence — unanimity (${TRAITOR_CMD.l1}), which is all that was required (loyal nodes agree; a traitor commander forfeits the right to a particular answer). Flip the traitor to a lieutenant and his lie "R" is simply outvoted 2-to-1 by honest relays of the true order. One liar among four is powerless; the cross-check round turned private contradictions into public arithmetic.`,
    invariant: 'The relay round pools every node\'s testimony: with N ≥ 3f + 1, majorities over shared evidence agree despite f liars.',
  };

  yield {
    state: table('Why exactly 3f + 1: the quorum arithmetic', [
      ['q', 'quorum size: 2f + 1 of 3f + 1'],
      ['wait', 'why you can\'t wait for more'],
      ['cut', 'two quorums overlap in ≥ f + 1 nodes'],
      ['win', 'the punchline'],
    ], [['why', '']], [
      ['proceed once 2f + 1 reply — the other f might be crashed liars who will never speak'],
      ['waiting for 2f + 2 can deadlock forever: only 2f + 1 honest responses are guaranteed to exist'],
      ['(2f+1) + (2f+1) − (3f+1) = f + 1 — and at most f of those overlapping nodes are liars'],
      ['every pair of quorums shares AT LEAST ONE honest node: the same intersection that carried Paxos\'s history now carries the truth past the liars'],
    ]),
    highlight: { active: ['cut:why', 'win:why'] },
    explanation: 'The general rule, derived in four lines. You can only ever wait for 2f + 1 replies (the f faulty nodes may stay silent, and you cannot tell silence from slowness). For two such quorums to be trustworthy, their intersection must contain at least one honest node — an honest witness common to any two decisions. With N = 3f + 1, two quorums of 2f + 1 overlap in f + 1 nodes, and since liars number at most f, at least one overlap member is honest. With N = 3f, the overlap can be all liars and agreement splits. Compare Read/Write Quorums & Tunable Consistency: same pigeonhole, but where Dynamo\'s overlap carries freshness and Paxos\'s carries history, Byzantine overlap must carry HONESTY — the strictest cargo, hence the biggest quorums.',
    invariant: 'N = 3f + 1 is the minimum where any two (2f+1)-quorums must share an honest node: intersection beats equivocation.',
  };
}

function* pbft() {
  yield {
    state: table('PBFT (1999): the generals go into production', [
      ['pre', '1 · PRE-PREPARE'],
      ['prep', '2 · PREPARE (all-to-all)'],
      ['commit', '3 · COMMIT (all-to-all)'],
      ['view', 'view change'],
    ], [['does', '']], [
      ['a primary proposes the next request and its sequence number — one node sets the agenda, like a Raft leader'],
      ['every replica re-broadcasts the proposal it saw; collect 2f + 1 matching ⇒ no equivocation slipped through — the generals\' relay round, verbatim'],
      ['every replica announces "I hold a prepare certificate"; 2f + 1 of those ⇒ safe to execute, because the certificate is now guaranteed to survive into any future view'],
      ['if the primary stalls or lies, replicas time out and elect the next one — carrying prepared certificates forward, exactly as Paxos promises carry accepted values'],
    ]),
    highlight: { active: ['prep:does', 'commit:does'] },
    explanation: 'Castro & Liskov\'s Practical Byzantine Fault Tolerance turned the parable into a server protocol fast enough to argue about. The structure is the generals\' algorithm wearing Multi-Paxos clothes: a primary proposes (pre-prepare), the relay round becomes PREPARE — all-to-all re-broadcast so any equivocation by the primary is caught by comparison — and a second all-to-all round, COMMIT, ensures that once anyone executes, a quorum can PROVE a quorum prepared it, so the decision survives primary replacement. Two all-to-all rounds is the price of distrust: O(n²) messages per decision, which is why classical PBFT lives at small n (4, 7, 10 replicas), and why a generation of successors — notably HotStuff — re-engineered it to linear communication.',
    invariant: 'PREPARE catches equivocation by cross-comparison; COMMIT makes the decision provable across view changes: two rounds, two guarantees.',
  };

  yield {
    state: table('Signatures change the arithmetic', [
      ['oral', 'oral messages (the proofs above)'],
      ['signed', 'signed messages'],
      ['why', 'what a signature kills'],
      ['still', 'what it does NOT kill'],
    ], [['effect', '']], [
      ['a relayed lie is just hearsay — "he said retreat" cannot be checked, so tolerance caps at f < N/3'],
      ['a forwarded order carries the commander\'s unforgeable signature: misquoting becomes IMPOSSIBLE, and two signed contradictory orders are portable PROOF of treason'],
      ['the slander from the N = 3 proof — L2 cannot fake "the commander said retreat" without the commander\'s key'],
      ['equivocation games against ASYNCHRONY: with no timing assumptions, even signed protocols need 3f + 1 — signatures buy simpler protocols and provable guilt, not smaller quorums'],
    ]),
    highlight: { active: ['signed:effect'], removed: ['still:effect'] },
    explanation: 'Cryptography rewrites one clause of the parable. With unforgeable signatures, the N = 3 impossibility dissolves in its original synchronous setting — a lieutenant can no longer misquote the commander, and a commander who signs two different orders has manufactured the evidence of his own treason (Lamport\'s signed-messages algorithm tolerates any number of traitors for agreement among the loyal). The fine print matters though: in the ASYNCHRONOUS world real networks live in, where slow and silent are indistinguishable, 3f + 1 stands even with signatures. What signatures buy in practice is leaner protocols, accountable misbehavior — slashing in proof-of-stake is literally "two signed contradictory votes = lose your deposit" — and Merkle Tree commitments that let light clients verify state without trusting anyone.',
    invariant: 'Signatures convert "he said" into evidence: misquoting dies, equivocation becomes provable — but async still demands 3f+1.',
  };

  yield {
    state: table('Where Byzantine tolerance actually runs', [
      ['chain', 'proof-of-stake blockchains'],
      ['btc', 'Bitcoin (the sidestep)'],
      ['air', 'fly-by-wire & spacecraft'],
      ['db', 'your database (probably not)'],
    ], [['how', '']], [
      ['Tendermint/Cosmos and HotStuff descendants are PBFT-shaped: 2f + 1 of 3f + 1 weighted by stake, equivocation slashed — BFT consensus among parties who are the threat model'],
      ['no fixed membership, so quorums are impossible: proof-of-work substitutes economics for arithmetic — probabilistic finality, not a BFT quorum protocol'],
      ['Boeing 777/787 flight computers vote across redundant dissimilar channels: here the "traitor" is a bit flip or a design bug, and 3f + 1-grade redundancy is certified, not optional'],
      ['etcd, Spanner, CockroachDB are CRASH-fault only: inside one org, machines are authenticated and trusted, and the 3× hardware + O(n²) messages buy protection against an enemy you don\'t have'],
    ]),
    highlight: { active: ['chain:how', 'air:how'], removed: ['db:how'] },
    explanation: 'The deployment map follows one question: CAN THE PARTICIPANTS TRUST EACH OTHER? Public blockchains answer "absolutely not" — anonymous validators with money at stake are the Byzantine threat model made flesh, so Tendermint, HotStuff (born at Facebook\'s Libra, now in Aptos and Sui), and friends run PBFT descendants with stake-weighted quorums. Avionics answers "not even our own hardware" — at 35,000 feet a bit flip IS a traitor, so flight computers vote across dissimilar redundant channels. And the deliberately boring row: ordinary distributed databases answer "yes, we trust our machines," which is why Raft Leader Election runs your infrastructure with f + 1 fewer replicas per fault and no n² gossip. Choosing crash-fault tolerance when you control the hardware isn\'t naivety — it\'s engineering.',
    invariant: 'BFT is bought where trust is absent: blockchains (adversaries by design), avionics (physics as adversary) — not trusted datacenters.',
  };

  yield {
    state: table('The complete fault-tolerance ladder', [
      ['none', 'no replication'],
      ['crash', 'crash fault tolerant'],
      ['byz', 'Byzantine fault tolerant'],
      ['async', 'the universal tax'],
    ], [['budget', 'replicas for f = 1'], ['runs', 'example']], [
      ['1 — and one bad disk ends the story', 'a laptop'],
      ['3 (2f + 1)', 'etcd, ZooKeeper, Spanner groups — Raft Leader Election and Multi-Paxos'],
      ['4 (3f + 1), two all-to-all rounds', 'PBFT, Tendermint, HotStuff'],
      ['no level escapes FLP: deterministic async consensus can always be delayed — every protocol above buys liveness with timeouts or randomness', 'all of them'],
    ]),
    highlight: { active: ['byz:budget'] },
    explanation: 'The ladder, assembled. Each rung pays for a darker failure model: one replica trusts everything; 2f + 1 survives silence; 3f + 1 survives deceit. And the bottom row is the humbling constant from Paxos: Consensus Without a Leader — the FLP impossibility taxes every rung equally, because no amount of redundancy makes an asynchronous network promise to deliver a message on time. Safety can be absolute; liveness is always rented. Read the ladder bottom-up when you design: start from the failures you actually face, climb only as far as your threat model forces you, and remember that every step up costs hardware, messages, and latency that the step below spends on throughput instead.',
    invariant: 'Each failure model has a price: 1, then 2f+1, then 3f+1 — and FLP\'s liveness tax applies on every floor.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the generals & 3f+1') yield* generals();
  else if (view === 'PBFT & the real world') yield* pbft();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Byzantine Fault Tolerance is the mathematics of consensus when participants can lie — not just crash. Named for Lamport, Shostak, and Pease's 1982 parable: three generals must coordinate an attack, but one might betray the others, sending contradictory orders to different peers. The puzzle is information-theoretic: if you receive "attack" from the commander and "he said retreat" from a lieutenant, you cannot tell which world you live in — and the two worlds demand opposite actions. The payoff is the 3f+1 rule: with N = 3f + 1 participants, you can tolerate up to f liars and still reach unanimous consensus. Blockchains, fly-by-wire aircraft, and Practical Byzantine Fault Tolerance (PBFT) protocols all rest on this arithmetic.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization shows two attack strategies. First: N = 3 with one traitor is impossible. A loyal commander sends "attack" to L1 and a traitor lieutenant L2 relays "the commander said retreat" — both statements are byte-for-byte identical to L1. No decision rule can be right in both worlds: world 1 (traitor commander) requires L1 to ignore the commander; world 2 (traitor lieutenant) requires L1 to trust him. The evidence is ambiguous by design.`,
        `Second: N = 4 with one traitor succeeds. A traitor commander tells L1 "attack," L2 "retreat," L3 "attack." Each loyal lieutenant collects three claims (one from the commander, two relayed), then takes the majority. All three lieutenants end up voting on the same multiset {A, R, A} — the contradiction is pooled into shared evidence — so all compute the same majority result. If the traitor is a lieutenant instead, the honest commander's order is simply outvoted 2-to-1 by honest relays. One liar cannot dominate a majority.`,
        `The 3f+1 rule emerges from the quorum arithmetic: you can only wait for 2f+1 replies (the f faulty nodes may be silent forever), and two quorums of 2f+1 must overlap in at least f+1 nodes. Since at most f are liars, at least one overlap is honest — that witness carries the truth across any pair of decisions. This is the same pigeonhole principle that keeps Paxos honest: the intersection that carried history now must carry honesty, requiring one-third more hardware.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Crash faults (nodes stop) cost 2f+1 replicas and O(f) messages per decision via Paxos: Consensus Without a Leader or Raft Leader Election. Byzantine faults (nodes lie) cost 3f+1 replicas — 50% more machines. The relay rounds (all-to-all cross-checks) cost O(n²) messages: Practical Byzantine Fault Tolerance in 1999 standardized two rounds of gossip (prepare, commit), each node broadcasting to all others. Modern successors like HotStuff linearized the communication to O(n), making BFT viable at larger scale. Blockchains pay the full O(n²) for small consensus committees (22–100 validators) where it is acceptable; datacenters skip it entirely because hardware is trusted and Paxos scales further.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Proof-of-stake blockchains — Tendermint, Cosmos, HotStuff descendants (Aptos, Sui) — use BFT quorums weighted by stake. Validators with money at stake are the threat model; signatures let you prove equivocation (two contradictory orders, same validator) and slash the deposit. Bitcoin sidesteps classical BFT entirely via proof-of-work: no fixed membership, probabilistic finality, economics substitutes for voting arithmetic. Avionics trusts no component: Boeing 777 and 787 fly-by-wire systems vote across dissimilar redundant computers on three independent channels; a bit flip IS a traitor. Ordinary databases — etcd, Spanner, CockroachDB — are crash-fault only (Raft or Paxos) because they run inside trusted datacenters where authentication and hardware reliability are givens. BFT is bought where trust is absent: untrusted networks and adversarial physics.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The most dangerous misconception: majority voting solves Byzantine faults. It does not — three honest nodes and one liar can still deadlock at N = 4 if they cannot cross-check their observations. The relay round is not optional; it is the entire fix. Another trap: N = 3 is impossible only for *unsigned* (oral) messages. With cryptographic signatures, a commander cannot misquote himself, and the N = 3 problem dissolves in synchronous networks. But asynchronous networks (the real internet) still need 3f+1 with signatures, because slow and silent are indistinguishable — timing cannot help you tell an honest delayed node from a malicious one. Finally, BFT does not escape the FLP impossibility: no deterministic async consensus can guarantee liveness when messages can be delayed arbitrarily. Every protocol buys liveness with timeouts or randomness — the safety/liveness tradeoff applies on every floor.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read "Paxos: Consensus Without a Leader" to understand the crash-fault quorum that inspired the Byzantine overlap. Continue into "HotStuff BFT Quorum Certificate Case Study" for the production data structures: quorum certificates, chained commits, timeout certificates, and Diem/Aptos-style descendants. Then study "Narwhal Bullshark DAG Mempool Case Study" to see how DAG-based BFT separates data availability from ordering. Study "Raft Leader Election" for the same ideas in a leader-based protocol. Explore "Read/Write Quorums & Tunable Consistency" to see the pigeonhole principle applied to freshness instead of honesty. Learn "Merkle Tree" for the cryptographic commitments that let light clients verify state without trusting validators. Trace "Two-Phase Commit (2PC)" to see the synchronous ancestor of PBFT's prepare/commit structure. Together, these form the consensus family: crash-fault (Paxos, Raft), Byzantine-fault (PBFT, HotStuff), and the quorum invariants that connect them all.`,
      ],
    },
  ],
};
