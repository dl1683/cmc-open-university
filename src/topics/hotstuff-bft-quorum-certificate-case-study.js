// HotStuff BFT consensus: quorum certificates, chained commits, leader
// rotation, timeout certificates, and the production shape behind DiemBFT.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hotstuff-bft-quorum-certificate-case-study',
  title: 'HotStuff BFT Quorum Certificate Case Study',
  category: 'Systems',
  summary: 'A production BFT consensus case study: 3f+1 validators, signed votes, quorum certificates, chained commit rules, pacemakers, timeout certificates, and Diem/Aptos-style descendants.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['qc chain', 'leader change'], defaultValue: 'qc chain' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function pipelineGraph(title) {
  return graphState({
    nodes: [
      { id: 'client', label: 'client', x: 0.7, y: 4.0, note: 'txs' },
      { id: 'mempool', label: 'mempool', x: 2.2, y: 1.5, note: 'batches' },
      { id: 'leader', label: 'leader', x: 2.2, y: 6.2, note: 'round r' },
      { id: 'v1', label: 'v1', x: 4.2, y: 1.2, note: 'vote' },
      { id: 'v2', label: 'v2', x: 4.6, y: 2.8, note: 'vote' },
      { id: 'v3', label: 'v3', x: 4.6, y: 4.7, note: 'vote' },
      { id: 'v4', label: 'v4', x: 4.2, y: 6.4, note: 'fault?' },
      { id: 'qc', label: 'QC', x: 6.4, y: 4.0, note: '2f+1' },
      { id: 'exec', label: 'exec', x: 8.0, y: 5.8, note: 'spec run' },
      { id: 'state', label: 'state', x: 9.3, y: 4.0, note: 'root' },
    ],
    edges: [
      { id: 'e-client-mempool', from: 'client', to: 'mempool' },
      { id: 'e-mempool-leader', from: 'mempool', to: 'leader' },
      { id: 'e-leader-v1', from: 'leader', to: 'v1' },
      { id: 'e-leader-v2', from: 'leader', to: 'v2' },
      { id: 'e-leader-v3', from: 'leader', to: 'v3' },
      { id: 'e-leader-v4', from: 'leader', to: 'v4' },
      { id: 'e-v1-qc', from: 'v1', to: 'qc', weight: 'sig' },
      { id: 'e-v2-qc', from: 'v2', to: 'qc', weight: 'sig' },
      { id: 'e-v3-qc', from: 'v3', to: 'qc', weight: 'sig' },
      { id: 'e-qc-exec', from: 'qc', to: 'exec' },
      { id: 'e-exec-state', from: 'exec', to: 'state' },
      { id: 'e-qc-state', from: 'qc', to: 'state' },
    ],
  }, { title });
}

function chainGraph(title) {
  return graphState({
    nodes: [
      { id: 'g', label: 'G', x: 0.7, y: 3.8, note: 'genesis' },
      { id: 'b1', label: 'B1', x: 2.0, y: 3.8, note: 'round 1' },
      { id: 'qc1', label: 'QC1', x: 2.7, y: 2.0, note: 'cert' },
      { id: 'b2', label: 'B2', x: 4.0, y: 3.8, note: 'round 2' },
      { id: 'qc2', label: 'QC2', x: 4.7, y: 2.0, note: 'cert' },
      { id: 'b3', label: 'B3', x: 6.0, y: 3.8, note: 'round 3' },
      { id: 'qc3', label: 'QC3', x: 6.7, y: 2.0, note: 'cert' },
      { id: 'b4', label: 'B4', x: 8.0, y: 3.8, note: 'round 4' },
      { id: 'qc4', label: 'QC4', x: 8.7, y: 2.0, note: 'cert' },
      { id: 'commit', label: 'commit', x: 5.0, y: 5.8, note: 'B1 safe' },
    ],
    edges: [
      { id: 'e-g-b1', from: 'g', to: 'b1', weight: 'parent' },
      { id: 'e-b1-qc1', from: 'b1', to: 'qc1', weight: 'votes' },
      { id: 'e-b1-b2', from: 'b1', to: 'b2', weight: 'parent' },
      { id: 'e-b2-qc2', from: 'b2', to: 'qc2', weight: 'votes' },
      { id: 'e-b2-b3', from: 'b2', to: 'b3', weight: 'parent' },
      { id: 'e-b3-qc3', from: 'b3', to: 'qc3', weight: 'votes' },
      { id: 'e-b3-b4', from: 'b3', to: 'b4', weight: 'parent' },
      { id: 'e-b4-qc4', from: 'b4', to: 'qc4', weight: 'votes' },
      { id: 'e-qc1-qc2', from: 'qc1', to: 'qc2' },
      { id: 'e-qc2-qc3', from: 'qc2', to: 'qc3' },
      { id: 'e-qc3-qc4', from: 'qc3', to: 'qc4' },
      { id: 'e-b1-commit', from: 'b1', to: 'commit' },
      { id: 'e-qc3-commit', from: 'qc3', to: 'commit' },
    ],
  }, { title });
}

function lockGraph(title) {
  return graphState({
    nodes: [
      { id: 'lock', label: 'lock', x: 1.0, y: 4.0, note: 'QC2' },
      { id: 'safe', label: 'safe', x: 3.0, y: 2.2, note: 'extends' },
      { id: 'fork', label: 'fork', x: 3.0, y: 5.8, note: 'conflict' },
      { id: 'high', label: 'highQC', x: 5.0, y: 2.2, note: 'newer' },
      { id: 'vote', label: 'vote', x: 6.8, y: 2.2, note: 'yes' },
      { id: 'reject', label: 'reject', x: 6.8, y: 5.8, note: 'no' },
      { id: 'qc', label: 'QC', x: 8.3, y: 2.2, note: 'formed' },
    ],
    edges: [
      { id: 'e-lock-safe', from: 'lock', to: 'safe', weight: 'parent' },
      { id: 'e-lock-fork', from: 'lock', to: 'fork', weight: 'fork' },
      { id: 'e-safe-high', from: 'safe', to: 'high' },
      { id: 'e-high-vote', from: 'high', to: 'vote' },
      { id: 'e-vote-qc', from: 'vote', to: 'qc' },
      { id: 'e-fork-reject', from: 'fork', to: 'reject' },
    ],
  }, { title });
}

function roundGraph(title) {
  return graphState({
    nodes: [
      { id: 'r10', label: 'r10', x: 0.8, y: 3.6, note: 'leader A' },
      { id: 'prop', label: 'prop', x: 2.4, y: 2.0, note: 'block' },
      { id: 'votes', label: 'votes', x: 4.1, y: 2.0, note: 'sig set' },
      { id: 'qc', label: 'QC', x: 5.6, y: 2.0, note: '2f+1' },
      { id: 'timer', label: 'timer', x: 2.4, y: 5.2, note: 'expires' },
      { id: 'tc', label: 'TC', x: 4.1, y: 5.2, note: 'timeouts' },
      { id: 'r11', label: 'r11', x: 7.3, y: 3.6, note: 'leader B' },
      { id: 'safe', label: 'safe', x: 9.0, y: 3.6, note: 'high QC' },
    ],
    edges: [
      { id: 'e-r10-prop', from: 'r10', to: 'prop' },
      { id: 'e-prop-votes', from: 'prop', to: 'votes' },
      { id: 'e-votes-qc', from: 'votes', to: 'qc' },
      { id: 'e-r10-timer', from: 'r10', to: 'timer' },
      { id: 'e-timer-tc', from: 'timer', to: 'tc' },
      { id: 'e-qc-r11', from: 'qc', to: 'r11' },
      { id: 'e-tc-r11', from: 'tc', to: 'r11' },
      { id: 'e-r11-safe', from: 'r11', to: 'safe' },
    ],
  }, { title });
}

function* qcChain() {
  yield {
    state: pipelineGraph('A round turns signed votes into one quorum certificate'),
    highlight: { active: ['client', 'mempool', 'leader', 'v1', 'v2', 'v3', 'qc', 'e-client-mempool', 'e-mempool-leader', 'e-leader-v1', 'e-leader-v2', 'e-leader-v3', 'e-v1-qc', 'e-v2-qc', 'e-v3-qc'], compare: ['v4'], found: ['state'] },
    explanation: 'For f = 1, HotStuff needs 3f + 1 = 4 validators and a quorum certificate from n - f = 3 signed votes. A leader proposes a block, validators check safety rules, and signed votes compress into a QC that later leaders can carry.',
    invariant: 'A QC is a portable proof that at least one honest validator is in every future quorum intersection.',
  };

  yield {
    state: labelMatrix(
      'Four validators, one QC threshold',
      [
        { id: 'v1', label: 'v1' },
        { id: 'v2', label: 'v2' },
        { id: 'v3', label: 'v3' },
        { id: 'v4', label: 'v4' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'vote', label: 'vote' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['honest', 'signed', 'QC member'],
        ['honest', 'signed', 'QC member'],
        ['honest', 'signed', 'QC member'],
        ['faulty', 'silent', 'ignored'],
      ],
    ),
    highlight: { active: ['v1:vote', 'v2:vote', 'v3:vote'], found: ['v1:effect', 'v2:effect', 'v3:effect'], removed: ['v4:vote'] },
    explanation: 'The threshold is not a majority habit; it is the Byzantine quorum formula. With 4 validators, 3 signatures certify the proposal even if the fourth is slow, crashed, or malicious. The certificate is data: signer identities, signature bytes, round, block id, and often an execution or state authenticator.',
  };

  yield {
    state: chainGraph('A 3-chain commit rule turns certificates into finality'),
    highlight: { active: ['b1', 'qc1', 'b2', 'qc2', 'b3', 'qc3', 'e-b1-qc1', 'e-b1-b2', 'e-b2-qc2', 'e-b2-b3', 'e-b3-qc3'], found: ['commit', 'e-b1-commit', 'e-qc3-commit'], compare: ['b4', 'qc4'] },
    explanation: 'In chained HotStuff, each new certified block extends a parent. A block becomes committed when it is the first block in a contiguous 3-chain of certified blocks. B1 is committed when B1, B2, and B3 all have QCs in adjacent rounds.',
    invariant: 'The commit decision is about a certified prefix, not just the latest block.',
  };

  yield {
    state: labelMatrix(
      'Classic phases folded into a chain',
      [
        { id: 'p1', label: 'phase 1' },
        { id: 'p2', label: 'phase 2' },
        { id: 'p3', label: 'phase 3' },
        { id: 'decide', label: 'decide' },
      ],
      [
        { id: 'object', label: 'object' },
        { id: 'proof', label: 'proof' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['B1', 'QC1', 'prepared'],
        ['B2', 'QC2', 'locked'],
        ['B3', 'QC3', 'commit'],
        ['prefix', '3-chain', 'final'],
      ],
    ),
    highlight: { active: ['p1:proof', 'p2:proof', 'p3:proof'], found: ['decide:meaning'] },
    explanation: 'PBFT names separate message phases. Chained HotStuff makes each certified child serve as the next phase for its parent. That is why the graph matters: parent pointers and QCs replace a pile of special-case view-change messages.',
  };

  yield {
    state: pipelineGraph('Votes can certify execution and state, not only ordering'),
    highlight: { active: ['leader', 'v1', 'v2', 'v3', 'qc', 'exec', 'state', 'e-v1-qc', 'e-v2-qc', 'e-v3-qc', 'e-qc-exec', 'e-exec-state', 'e-qc-state'], compare: ['mempool'] },
    explanation: 'DiemBFT had validators execute the proposed block speculatively and sign an authenticator for the resulting database state. That keeps nondeterministic execution from forking the system: the QC can authenticate both order and the execution result.',
    invariant: 'Consensus on order is incomplete if honest validators can compute different state roots.',
  };

  yield {
    state: labelMatrix(
      'Why HotStuff mattered',
      [
        { id: 'pbft', label: 'PBFT' },
        { id: 'hot', label: 'HotStuff' },
        { id: 'diem', label: 'DiemBFT' },
        { id: 'aptos', label: 'AptosBFT' },
      ],
      [
        { id: 'happy', label: 'happy' },
        { id: 'fail', label: 'fail' },
        { id: 'shape', label: 'shape' },
      ],
      [
        ['O(n^2)', 'view msgs', 'all to all'],
        ['O(n)', 'linear VC', '3-chain QC'],
        ['O(n)', 'TC path', '2-chain mix'],
        ['Jolteon', 'fallbacks', 'low delay'],
      ],
    ),
    highlight: { compare: ['pbft:happy'], active: ['hot:happy', 'hot:shape'], found: ['diem:shape', 'aptos:happy'] },
    explanation: 'HotStuff was important because it combined linear communication, responsiveness after the network stabilizes, and a simple chained proof structure. Production descendants then trade between latency and faulty-leader cost: DiemBFT and Jolteon-style protocols shorten the happy path while paying more during view synchronization.',
  };
}

function* leaderChange() {
  yield {
    state: roundGraph('A pacemaker advances rounds by QC or timeout certificate'),
    highlight: { active: ['r10', 'prop', 'votes', 'qc', 'r11', 'safe', 'e-r10-prop', 'e-prop-votes', 'e-votes-qc', 'e-qc-r11', 'e-r11-safe'], compare: ['timer', 'tc'] },
    explanation: 'HotStuff is leader-based, but the leader rotates by round. If the leader is honest and timely, votes form a QC and the next round extends it. If the leader stalls, timeout votes can form a timeout certificate that moves honest validators together.',
    invariant: 'Safety comes from voting rules; liveness comes from the pacemaker eventually giving an honest leader a timely round.',
  };

  yield {
    state: lockGraph('Voting rules protect the locked certified prefix'),
    highlight: { active: ['lock', 'safe', 'high', 'vote', 'qc', 'e-lock-safe', 'e-safe-high', 'e-high-vote', 'e-vote-qc'], removed: ['fork', 'reject', 'e-lock-fork', 'e-fork-reject'] },
    explanation: 'A validator does not simply vote for any block a leader proposes. It remembers locked and highest QCs. A proposal that extends the locked chain, or carries a sufficiently newer QC, can receive a vote. A conflicting fork is rejected.',
    invariant: 'The local safety state is small, but it decides whether a signature may be spent.',
  };

  yield {
    state: labelMatrix(
      'Equivocation cannot make two QCs',
      [
        { id: 'a', label: 'fork X' },
        { id: 'b', label: 'fork Y' },
        { id: 'cut', label: 'overlap' },
        { id: 'rule', label: 'rule' },
      ],
      [
        { id: 'need', label: 'needs' },
        { id: 'has', label: 'has' },
        { id: 'why', label: 'why safe' },
      ],
      [
        ['3 votes', 'maybe 2', 'not enough'],
        ['3 votes', 'maybe 2', 'not enough'],
        ['1 honest', 'shared', 'no double'],
        ['one round', 'one vote', 'no fork QC'],
      ],
    ),
    highlight: { active: ['cut:has', 'rule:has'], removed: ['a:has', 'b:has'] },
    explanation: 'A Byzantine leader may send different blocks to different validators. It still needs 3 signatures for a QC in this f = 1 example. Any two 3-of-4 quorums overlap in at least two validators, and at least one overlap member is honest. The honest validator will not sign both forks in the same round.',
  };

  yield {
    state: roundGraph('View change is data carried into the next leader'),
    highlight: { active: ['timer', 'tc', 'r11', 'safe', 'e-timer-tc', 'e-tc-r11', 'e-r11-safe'], found: ['qc'], compare: ['prop', 'votes'] },
    explanation: 'HotStuff made view change less special by making certificates part of the normal chain. The next leader proposes from the highest safe certificate it learns. DiemBFT added explicit timeout certificates so validators advance rounds without relying on synchronized clocks.',
    invariant: 'A new leader must carry the highest safe proof forward; it cannot invent history.',
  };

  yield {
    state: labelMatrix(
      'Production module split',
      [
        { id: 'mempool', label: 'mempool' },
        { id: 'round', label: 'round' },
        { id: 'safety', label: 'safety' },
        { id: 'store', label: 'store' },
        { id: 'exec', label: 'exec' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'risk', label: 'risk' },
        { id: 'link', label: 'linked ds' },
      ],
      [
        ['batches', 'withhold', 'queue'],
        ['timeouts', 'slow net', 'timer heap'],
        ['votes', 'double sign', 'state cell'],
        ['blocks/QC', 'prune bug', 'DAG/tree'],
        ['state root', 'nondet', 'Merkle'],
      ],
    ),
    highlight: { active: ['safety:owns', 'store:owns', 'exec:owns'], compare: ['mempool:risk', 'round:risk'] },
    explanation: 'The clean production design separates data dissemination, round advancement, safety rules, block/QC storage, and execution. Diem emphasized that safety rules can be cleanly separated and audited; that is exactly the data-structure lesson.',
  };

  yield {
    state: labelMatrix(
      'What still hurts',
      [
        { id: 'leader', label: 'leader' },
        { id: 'data', label: 'data' },
        { id: 'timeout', label: 'timeout' },
        { id: 'crypto', label: 'crypto' },
        { id: 'client', label: 'client' },
      ],
      [
        { id: 'failure', label: 'failure' },
        { id: 'control', label: 'control' },
      ],
      [
        ['DoS', 'rotate/VRF'],
        ['withheld', 'quorum store'],
        ['false view', 'TC rules'],
        ['bad sig', 'verify set'],
        ['false final', 'proof check'],
      ],
    ),
    highlight: { active: ['leader:control', 'data:control', 'timeout:control', 'crypto:control'], compare: ['client:failure'] },
    explanation: 'HotStuff simplifies the core protocol, but production systems still need leader-DoS defenses, data availability, careful timeout tuning, signature verification, state sync, pruning discipline, and client-side proof checks. Consensus is a control plane, not a complete blockchain by itself.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'qc chain') yield* qcChain();
  else if (view === 'leader change') yield* leaderChange();
  else throw new InputError('Pick a HotStuff BFT view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'HotStuff is a leader-based Byzantine fault-tolerant state-machine replication protocol designed for the partially synchronous model. It assumes a validator set with 3f + 1 voting power and tolerates up to f Byzantine votes. Its central data structure is the quorum certificate: a compact, portable proof that a proposal received n - f votes.',
        'The important educational jump from Byzantine Generals to HotStuff is this: the 3f + 1 arithmetic becomes an engineered object. Instead of saying "a quorum agreed," a validator stores and forwards a QC with signer identities, signatures or aggregate signatures, a round, a block id, and sometimes an execution authenticator. The proof travels with the next proposal.',
      ],
    },
    {
      heading: 'Quorum certificates as data structures',
      paragraphs: [
        'A QC is a certificate over a block, round, and vote type. In a 4-validator, f = 1 committee, three signatures are enough. In a larger committee, n - f equals 2f + 1 when n = 3f + 1. Two such quorums must overlap in f + 1 validators, which means at least one honest signer connects any two certified histories. That is the same quorum-intersection theorem from Paxos and Read/Write Quorums, but spent on honesty rather than crash tolerance or freshness.',
        'The certificate shape matters operationally. It must be cheap to verify, unambiguous about the thing being signed, bound to the round/view, and replay-safe across forks. A good implementation treats each vote as a scarce resource: a validator signs at most one conflicting proposal under the local safety rules. The safety module should persist the minimum state needed to prevent equivocation after crashes and restarts.',
      ],
    },
    {
      heading: 'Chained commit rule',
      paragraphs: [
        'PBFT exposes separate prepare and commit message phases. Chained HotStuff folds these phases into a linked block chain: each certified child acts as the next phase for its parent. In the common 3-chain form, block B1 commits when there is a contiguous certified chain B1 <- B2 <- B3. The decision is not "the newest block is final"; it is "a certified prefix is final because enough later certified blocks preserved it."',
        'This is why parent pointers and QCs are the real data structures. If B2 extends B1 and B3 extends B2, then QC3 is not only evidence about B3. It is evidence that a sequence of leaders and voters kept extending the same prefix. That makes view change simpler: the next leader carries the highest safe certificate forward instead of reconstructing a special PBFT view-change transcript from scratch.',
      ],
    },
    {
      heading: 'Leader change and liveness',
      paragraphs: [
        'HotStuff remains leader-based. Each round has a leader, and progress depends on an honest leader getting a timely round after the network stabilizes. The pacemaker is the liveness component: it advances rounds using QCs or timeout certificates. Safety does not depend on clocks being synchronized; liveness depends on the partial synchrony assumption that eventually messages between honest validators are delivered within a bounded delay.',
        'The voting rule is the safety core. A validator tracks locked and highest QCs and rejects proposals that would violate the locked certified prefix unless a newer safe certificate justifies the vote. A Byzantine leader can equivocate by sending forked blocks, but it cannot form two conflicting QCs without an honest validator in the quorum intersection double-signing. That is why local safety state and durable signing rules deserve the same respect as the network protocol.',
      ],
    },
    {
      heading: 'Complete case study: DiemBFT and AptosBFT lineage',
      paragraphs: [
        'DiemBFT adapted HotStuff for a production blockchain. Validators shared transactions through mempool, advanced through rounds, voted on blocks, executed proposed blocks speculatively, and signed authenticators for the resulting database state. The Diem README describes the key module split: round state for liveness, safety rules for voting and commit rules, block store for blocks and QCs, and execution/state roots for the replicated database.',
        'That split is the case-study lesson. Mempool is a queue and availability problem. Round state is a timer and timeout-certificate problem. Safety rules are a tiny persistent state machine. Block store is a graph of blocks, parent pointers, QCs, and pruning boundaries. Execution produces a Merkle-style state root that validators sign. You cannot debug this system as "consensus" in the abstract; you debug the data structures and their invariants.',
        'AptosBFT later moved through Jolteon-style designs. The official Aptos glossary describes AptosBFT as the Aptos protocol BFT algorithm and notes that AptosBFT is based on Jolteon. Jolteon is useful to study after HotStuff because it shows a deliberate trade: reduce happy-path latency with a 2-chain design while accepting more expensive view-change or fallback machinery when the network is faulty.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not say HotStuff "solves Byzantine consensus" without naming the model. It is a partially synchronous BFT protocol: safety holds through asynchrony, while liveness is recovered after the network stabilizes and an honest leader gets a timely round. That assumption is not a footnote; it is the reason timeouts and pacemakers exist.',
        'Do not confuse data availability with consensus ordering. A QC can certify metadata for a block, but validators and clients still need the block data and ancestors. This is why production systems add shared mempools, quorum stores, state sync, and pruning rules. If block data disappears before honest validators can execute or state-sync, the certificate alone is not a complete user experience.',
        'Do not treat aggregate signatures as magic. They reduce certificate size, but the system still needs signer accountability, domain-separated messages, replay protection, key rotation, slashing or incident evidence, and client proof verification. A tiny crypto bug can turn an elegant quorum proof into a fork factory.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: HotStuff paper at https://arxiv.org/abs/1803.05069, Diem consensus README at https://github.com/diem/diem/blob/latest/consensus/README.md, DiemBFT v4 technical report at https://developers.diem.com/papers/diem-consensus-state-machine-replication-in-the-diem-blockchain/2021-08-17.pdf, Aptos glossary at https://aptos.dev/network/glossary, and Jolteon and Ditto at https://arxiv.org/abs/2106.10362.',
        'Study Narwhal Bullshark DAG Mempool Case Study, Byzantine Fault Tolerance: When Nodes Lie, Paxos: Consensus Without a Leader, Read/Write Quorums & Tunable Consistency, View Changes: Replacing a Failed Leader, Merkle Tree, Transparency Log Witnessing Case Study, KZG Polynomial Commitments, Ethereum Merkle-Patricia Trie Case Study, Distributed Tracing, and Rate Limiter next.',
      ],
    },
  ],
};
