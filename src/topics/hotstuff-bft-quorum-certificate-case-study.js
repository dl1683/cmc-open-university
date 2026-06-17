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
      heading: 'Why this exists',
      paragraphs: [
        'HotStuff exists because replicated services need one ordered history even when some validators lie, crash, stall, or send different messages to different peers. A crash-fault protocol such as Raft or Paxos assumes failed nodes simply stop or lag. A Byzantine protocol must handle validators that equivocate, sign conflicting data, withhold messages, or try to make honest clients believe different histories are final.',
        'The setting is a fixed validator set with 3f + 1 voting power, where at most f voting power is Byzantine. HotStuff is leader-based and partially synchronous: safety must hold even during bad network periods, while liveness returns after the network stabilizes and an honest leader gets a timely round. That split is important. The protocol is not promising that the network is always fast. It is promising that a network delay cannot make honest validators finalize two conflicting prefixes.',
        'The central object is the quorum certificate, or QC. A QC is a compact proof that enough validators signed the same proposal for the same round and vote type. The educational jump from the Byzantine Generals story to HotStuff is that the quorum theorem becomes a real data structure with signer identities, signatures or aggregate signatures, a block id, a round, and sometimes an execution or state authenticator.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple BFT design is to make every validator talk to every other validator in every phase. A leader proposes a value, validators broadcast prepare messages, validators broadcast commit messages, and a view-change protocol collects evidence when the leader fails. This can work, and PBFT proved the shape, but the message pattern is heavy. Many validators times many validators times several phases becomes expensive, especially when the common path is supposed to run for every block.',
        'The second naive move is to treat finality as a majority vote on the latest block. That is unsafe under Byzantine faults. A majority can be split by equivocation, stale views, or conflicting locks. The protocol needs a threshold high enough that two certified histories must share honest voting power, and it needs a rule that prevents that honest voting power from being spent on incompatible histories.',
        'HotStuff keeps the leader-based pipeline but turns each phase into evidence that can be carried forward by later leaders. Instead of reconstructing a view-change transcript from many special messages, the next proposal carries the highest safe certificate the leader knows. The normal path and the recovery path use the same kind of proof.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The safety invariant is quorum intersection plus disciplined voting. In a 3f + 1 committee, a QC needs 2f + 1 votes. Any two 2f + 1 quorums intersect in at least f + 1 voting power. Since at most f can be Byzantine, at least one honest validator is in the overlap. If honest validators refuse to sign conflicting proposals that violate their lock, two conflicting certified commit histories cannot both form.',
        'That invariant is stronger than "the leader said it was safe" and stronger than "most validators seemed happy." The invariant lives in durable local state. A validator remembers the highest QC it has seen, the lock or commit rule required by the protocol version, and the exact message it is signing. A signature is a scarce resource. Once a validator spends it for a round and proposal, the safety module must make it impossible to spend an equivalent signature on a conflicting proposal after a crash, restart, retry, or malicious replay.',
        'A useful way to read HotStuff is therefore not as a collection of messages, but as a rule for moving a certified prefix forward. A block is interesting only when it is tied to parent pointers and certificates. A vote is interesting only when it can become part of a QC. A QC is interesting because it constrains every future quorum that wants to commit a conflicting branch.',
      ],
    },
    {
      heading: 'QC data structure',
      paragraphs: [
        'A QC is a certificate over an exact statement. A practical certificate identifies the chain id or domain, epoch, round, block id, parent id, vote type, signer set, and signature material. If the system uses aggregate signatures, the aggregate must still be tied to a signer bitmap or equivalent proof of voting power. Without signer accountability, clients cannot know whether the threshold was actually met.',
        'Domain separation matters. A timeout signature must not verify as a block vote. A vote from one epoch must not verify in another. A signature over a proposal hash must not leave ambiguity about which fields were included in that hash. These details sound low-level, but they are where consensus safety becomes software safety.',
        'The QC should also be cheap to store and cheap to verify along the hot path. Validators may receive many proposals, sync many ancestors, and serve proofs to clients. A good implementation separates the certificate bytes from derived indexes: block id to block, round to highest QC, parent to children, signer to accountability evidence, and commit point to prunable prefix.',
      ],
    },
    {
      heading: 'Chained commit rule',
      paragraphs: [
        'PBFT exposes separate prepare and commit phases. Chained HotStuff folds those phases into a linked sequence of certified blocks. A certified child acts like the next phase for its parent. In the common 3-chain version, block B1 commits when B1, B2, and B3 form a contiguous certified chain in adjacent rounds. The decision is not "the newest block is final." The decision is "this earlier prefix is final because later certified blocks kept extending it."',
        'This is why parent pointers are as important as signatures. QC3 is not only evidence that validators liked B3. If B3 extends B2 and B2 extends B1, then QC3 is evidence that the protocol kept preserving the B1 prefix through several rounds. A conflicting branch would need to pull quorum votes away from validators whose safety rules are already locked around that certified history.',
        'Client finality should follow the commit rule, not leader optimism. A client should not accept "this block has a QC" as the same thing as "this block is committed" unless the protocol version says so. Wallets, bridges, indexers, and state-sync services should verify the proof chain that commits the prefix they expose. Otherwise a speculative block can leak into a user-facing irreversible action.',
      ],
    },
    {
      heading: 'Leader change',
      paragraphs: [
        'HotStuff is still a leader protocol. Each round has one leader responsible for assembling a proposal and carrying the best known proof forward. If that leader is honest and the network is timely, votes form a QC and the next round extends it. If the leader is faulty or slow, validators eventually timeout and advance to another round.',
        'The pacemaker is the liveness component. It decides when to move rounds and how timeouts grow. A timeout certificate, or TC, is a proof that enough validators gave up on a round and can move together. Safety does not come from the pacemaker being perfectly accurate. Safety comes from the voting rules. The pacemaker can suspect a slow honest leader during a bad network period without creating conflicting commits.',
        'The next leader must not invent history. It should propose from the highest safe certificate it can justify, usually the highest QC or evidence carried through a TC path. That single rule is the clean view-change idea: recovery is not a new protocol with a different kind of truth. Recovery is the normal protocol carrying the strongest known proof into the next round.',
      ],
    },
    {
      heading: 'Worked production case',
      paragraphs: [
        'DiemBFT is the useful production case because it shows the module boundaries. Validators receive transactions through mempool, form blocks, execute proposed blocks speculatively, vote through safety rules, store blocks and QCs, and eventually commit a prefix to the replicated database. The protocol is not just "some validators vote." It is a pipeline of queues, timers, signature checks, graph storage, execution roots, and client proofs.',
        'That split turns the abstract BFT problem into testable components. Mempool is a data-availability and ordering-input problem. Round state is a timer and timeout problem. Safety rules are a small persistent state machine that must prevent double-signing. Block store is a tree or DAG of parent pointers, QCs, missing ancestors, and pruning boundaries. Execution produces a state root that validators can sign so the committed order and resulting state stay tied together.',
        'AptosBFT and Jolteon-style descendants are good follow-up studies because they show that the HotStuff shape is not one frozen protocol. Designers can shorten the happy path, adjust fallback behavior, add quorum-store style data dissemination, or tune timeout handling. Every improvement trades latency, message cost, recovery complexity, and implementation risk against the same safety invariant.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the safety module small and durable. It should own the persistent facts that decide whether the validator may sign: last voted round, preferred or locked QC, epoch, and any protocol-specific commit evidence. It should expose a narrow API such as `construct_and_sign_vote(proposal, evidence)` rather than letting networking code create signatures directly.',
        'Verify before storing trust. Check domain separation, epoch, round monotonicity, signer voting power, duplicate signers, parent availability, and hash binding before accepting a QC into the block store. If ancestors are missing, store the certificate as pending evidence but do not let execution or commit logic run ahead of the available chain. Missing data is not a consensus success.',
        'Make pruning proof-aware. A node can discard old block bodies only after it has retained enough committed-state evidence for clients and enough checkpoint or state-sync material for recovering peers. The pruning boundary should be derived from committed prefixes and state snapshots, not from whatever happens to be old in wall-clock time.',
        'Test the adversarial cases directly: equivocation by the leader, duplicate votes, stale QCs, higher-round proposals that do not extend the lock, timeout races, crash and restart between vote construction and persistence, and state-root mismatch after speculative execution. A BFT implementation is only as strong as the boring tests around its proof objects.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HotStuff-style protocols win when a known validator set needs fast finality under Byzantine assumptions. Permissioned ledgers, validator-based blockchains, replicated databases with adversarial operators, and cross-organization control planes are natural fits. The appeal is the simple proof pipeline: votes become QCs, QCs become a certified chain, and a commit rule turns that chain into finality.',
        'The linear communication story also matters. The leader aggregates votes into one certificate and carries that certificate forward. In a healthy round, validators do not need all-to-all chatter for every phase. That makes the protocol easier to scale than older BFT designs, though data dissemination, signature verification, and networking can still dominate in production.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HotStuff does not solve open membership by itself. The 3f + 1 guarantee assumes a known validator set and a voting-power rule. Sybil resistance, staking, validator admission, slashing, epoch changes, and governance are outside the core consensus proof and must be engineered separately.',
        'It also does not solve data availability by itself. A QC over a block id is not useful to a validator that cannot fetch and execute the block. Production systems add mempools, quorum stores, state sync, checkpointing, and storage rules because ordering proof and data availability are different promises.',
        'Leader-based protocols are exposed to leader denial of service and faulty-leader latency. Rotation, randomization, timeout certificates, and fallback paths reduce the damage, but they do not erase the tradeoff. If many leaders are faulty or the network is unstable, throughput and latency can degrade even while safety remains intact.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Byzantine Fault Tolerance: When Nodes Lie for the failure model, then Paxos and View Changes for the crash-fault lineage that HotStuff simplifies and strengthens. Study Read/Write Quorums to make the quorum-intersection arithmetic automatic. Study Merkle Trees and authenticated state roots to understand why consensus over order often needs consensus over execution results too.',
        'For adjacent case studies, read Narwhal Bullshark DAG Mempool Case Study, Transparency Log Witnessing Case Study, KZG Polynomial Commitments, Ethereum Merkle-Patricia Trie Case Study, Distributed Tracing, and Rate Limiter. For primary sources, read the HotStuff paper, DiemBFT reports, and Jolteon/Ditto after the invariant in this article feels routine.',
      ],
    },
  ],
};
