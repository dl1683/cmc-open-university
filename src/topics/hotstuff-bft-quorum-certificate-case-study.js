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
      heading: 'How to read the animation',
      paragraphs: [
        'The "qc chain" view traces a single round from client transaction through leader proposal, validator votes, quorum certificate formation, and the 3-chain commit rule. Active nodes are the current stage of the consensus pipeline. Found nodes are certified or committed state. Compare nodes mark the faulty validator whose silence does not prevent progress.',
        'The "leader change" view traces what happens when a leader stalls: timeout expiry, timeout certificate formation, leader rotation, and the voting safety rules that prevent forks. Active nodes are the liveness path. Removed nodes are rejected forks.',
        {type:'callout', text:'A quorum certificate turns Byzantine agreement from a message storm into a portable proof that leaders can carry forward.'},
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and an edge leads into it, that stage has produced or received a cryptographic artifact. If a downstream node is not yet active, no honest validator has acted on that artifact yet. The QC node turning active means the threshold was met -- not that the block is committed.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Yin, Malkhi, Reiter, Gueta, Abraham (2019)',
          text: 'We present HotStuff, a leader-based Byzantine fault-tolerant replication protocol for the partially synchronous model. Once network communication becomes synchronous, HotStuff enables a correct leader to drive the protocol to consensus at the pace of actual network delays.',
        },
        'Replicated services need one ordered history even when some participants lie, crash, stall, or send different messages to different peers. A crash-fault protocol like Raft or Paxos assumes failed nodes simply stop or lag. A Byzantine protocol must handle validators that equivocate -- signing conflicting blocks, withholding votes, or trying to convince different clients that different histories are final.',
        'The setting is a fixed validator set of n = 3f + 1 nodes, where at most f are Byzantine. HotStuff is leader-based and partially synchronous: safety holds even during bad network periods, while liveness returns after the network stabilizes and an honest leader gets a timely round. The protocol does not promise the network is always fast. It promises that network delay cannot make honest validators finalize two conflicting prefixes.',
        'The central data structure is the quorum certificate, or QC. A QC is a compact proof that at least 2f + 1 validators signed the same proposal for the same round. The educational jump from the Byzantine Generals thought experiment to HotStuff is that the quorum theorem becomes a real data structure: signer identities, signature bytes, block id, round number, and sometimes an execution-state authenticator.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The classic BFT design, proven by PBFT (Castro and Liskov, 1999), makes every validator talk to every other validator in every phase. A leader proposes a value, validators broadcast prepare messages to all peers, validators broadcast commit messages to all peers, and a view-change protocol collects evidence when the leader fails.',
        {
          type: 'table',
          headers: ['Phase', 'PBFT message pattern', 'Messages sent'],
          rows: [
            ['Pre-prepare', 'Leader to all', 'n - 1'],
            ['Prepare', 'All to all', 'n(n - 1)'],
            ['Commit', 'All to all', 'n(n - 1)'],
            ['View change', 'All to new leader', 'n - 1 (each carrying O(n) proofs)'],
            ['Total per block', '', 'O(n^2) normal, O(n^3) view change'],
          ],
        },
        'With 100 validators, the prepare phase alone sends about 9,900 messages. The view-change protocol is worse: each validator must send its proof set to the new leader, and each proof set can carry O(n) prepare certificates. That O(n^3) view-change cost is the real bottleneck. Networks with frequent leader failures spend more time recovering than committing.',
        'The second naive move is to treat finality as a simple majority vote on the latest block. That is unsafe under Byzantine faults. With 4 validators and 1 Byzantine, a majority of 3 is needed -- but the Byzantine node can vote for two conflicting blocks, giving each fork 2 votes. Without a threshold tied to the quorum intersection formula, equivocation breaks safety.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not consensus itself -- PBFT solved that. The wall is the cost of recovering from a faulty leader.',
        'In PBFT, when a leader fails, every validator must convince the new leader that it has a consistent view of committed state. Each validator sends a view-change message containing its prepare certificates. The new leader collects these, validates them, and proposes a new-view message containing the proof. The new-view message is O(n) prepare certificates, each containing O(n) signatures, yielding O(n^2) data that must be verified.',
        {
          type: 'code',
          language: 'text',
          body: 'PBFT view-change cost for n = 100:\n  View-change messages: 99 validators x O(100) prepare certs = ~9,900 certs\n  New-view verification: new leader verifies ~9,900 certs x 100 sigs each\n  Total signature verifications: ~990,000\n  Wall-clock time at 1ms/verify: ~16 minutes just for crypto\n\nHotStuff view-change cost for n = 100:\n  Each validator sends: 1 timeout vote (1 signature)\n  New leader carries: highest QC seen (1 aggregate cert)\n  Total signature verifications: ~100\n  Wall-clock time at 1ms/verify: 0.1 seconds',
        },
        'That gap is the reason HotStuff exists. If the happy path is cheap but every leader failure costs O(n^3) messages and O(n^2) verification work, then adversarial leaders can deny service simply by failing. The protocol must make recovery as structurally simple as the normal path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace the special view-change protocol with the same kind of certificate used on the happy path. A QC already proves that 2f + 1 validators agreed on a proposal. Instead of sending an entirely different message type during recovery, the next leader simply carries the highest QC it knows and proposes from there.',
        {
          type: 'diagram',
          alt: 'HotStuff linear view change versus PBFT quadratic view change',
          label: 'View change: PBFT versus HotStuff',
          body: 'PBFT view change (O(n^2) data to new leader):\n\n  v1 --[prepare-certs]--> new leader\n  v2 --[prepare-certs]--> new leader\n  v3 --[prepare-certs]--> new leader\n  ...each cert set is O(n) items...\n  new leader broadcasts new-view with O(n^2) proof\n\nHotStuff view change (O(n) data to new leader):\n\n  v1 --[timeout-vote + highQC]--> new leader\n  v2 --[timeout-vote + highQC]--> new leader\n  v3 --[timeout-vote + highQC]--> new leader\n  new leader picks highest QC, proposes normally',
          text: 'PBFT view change (O(n^2) data to new leader):\n\n  v1 --[prepare-certs]--> new leader\n  v2 --[prepare-certs]--> new leader\n  v3 --[prepare-certs]--> new leader\n  ...each cert set is O(n) items...\n  new leader broadcasts new-view with O(n^2) proof\n\nHotStuff view change (O(n) data to new leader):\n\n  v1 --[timeout-vote + highQC]--> new leader\n  v2 --[timeout-vote + highQC]--> new leader\n  v3 --[timeout-vote + highQC]--> new leader\n  new leader picks highest QC, proposes normally',
        },
        'The safety invariant is quorum intersection plus disciplined voting. In a committee of 3f + 1, a QC needs 2f + 1 votes. Any two quorums of size 2f + 1 overlap in at least f + 1 members. Since at most f are Byzantine, at least one honest validator appears in the intersection. If honest validators refuse to sign conflicting proposals that violate their lock, two conflicting certified histories cannot both form.',
        {
          type: 'note',
          text: 'The insight is architectural, not just algorithmic. PBFT uses different message types for normal operation and recovery. HotStuff uses one proof object -- the QC -- for both. That uniformity is what makes the view-change linear: the new leader does not need to reconstruct history from many special messages. It just needs the highest QC.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'HotStuff operates in numbered rounds. Each round has one designated leader chosen by a deterministic rotation (or, in production variants, by VRF-based randomization). A round proceeds through proposal, vote, and certification.',
        {
          type: 'table',
          headers: ['Step', 'Who acts', 'What happens', 'What is produced'],
          rows: [
            ['1. Propose', 'Leader', 'Packages transactions into a block, attaches parent pointer and highest known QC', 'Block proposal message'],
            ['2. Safety check', 'Each validator', 'Checks: does this extend my locked QC? Or does it carry a QC from a higher round than my lock?', 'Decision: vote or reject'],
            ['3. Vote', 'Each honest validator', 'Signs (round, block_id, vote_type) and sends signature to leader', 'Signed vote message'],
            ['4. Aggregate', 'Leader (or next leader)', 'Collects 2f + 1 matching signatures', 'Quorum certificate (QC)'],
            ['5. Advance', 'All validators', 'Update highQC if the new QC is from a higher round', 'State transition to next round'],
          ],
        },
        'The commit rule in chained HotStuff uses a 3-chain: block B commits when B, its child B\', and its grandchild B\'\' all have QCs in three consecutive rounds. Each certified child serves as the next phase for its parent, folding PBFT\'s separate prepare-commit-decide phases into a linked chain of certified blocks.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Chained HotStuff commit rule (simplified)\nfunction tryCommit(blockStore, latestQC) {\n  const b3 = blockStore.get(latestQC.blockId);       // round r\n  const b2 = blockStore.get(b3.parentId);             // round r-1\n  const b1 = blockStore.get(b2.parentId);             // round r-2\n\n  // 3-chain: three consecutive certified rounds\n  if (b3.round === b2.round + 1 &&\n      b2.round === b1.round + 1 &&\n      b3.hasQC && b2.hasQC && b1.hasQC) {\n    commit(b1);  // b1 is now final\n  }\n  // If rounds are not consecutive, the chain broke.\n  // No commit, but safety is preserved.\n}',
        },
        'When a leader fails, validators do not wait forever. Each validator runs a local timer. If the timer expires before a QC forms, the validator broadcasts a timeout vote for the current round. When 2f + 1 timeout votes accumulate, they form a timeout certificate (TC). The TC proves the round was abandoned by a quorum, and the next leader can safely advance.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Safety follows from two properties: quorum intersection and the locking rule.',
        {
          type: 'bullets',
          items: [
            'Quorum intersection: any two sets of 2f + 1 from 3f + 1 share at least f + 1 members. Since at most f are Byzantine, at least one shared member is honest.',
            'Locking rule: an honest validator locks on the QC of the second block in a 2-chain. It will not vote for a proposal that conflicts with its lock unless the proposal carries a QC from a strictly higher round.',
            'Consequence: if block B has a 3-chain commit, then every quorum that could certify a conflicting block B\' must include an honest validator locked on B\'s chain. That validator will reject B\' because B\' does not extend the lock and does not carry a higher-round QC.',
          ],
        },
        'Liveness follows from the pacemaker. After GST (global stabilization time), the network delivers messages within a known bound. The pacemaker ensures an honest leader eventually gets a round where all honest validators receive the proposal, vote before timeout, and the QC forms. The timeout mechanism prevents validators from being stuck in a round with a faulty leader indefinitely.',
        {
          type: 'note',
          text: 'The separation is clean: safety never depends on timing assumptions. A network partition cannot cause two conflicting commits. It can only stall progress. Liveness depends on the network eventually stabilizing and the rotation eventually selecting an honest leader with a timely round.',
        },
        'Crash recovery is also safe. A validator that crashes and restarts reads its persisted last-voted-round and locked QC from durable storage. It will not sign any proposal from a round it has already voted in, and it will not abandon its lock without seeing a higher-round QC. The persistent state is small -- two integers and one QC -- but it is the entire safety guarantee.',
      ],
    },
    {
      heading: 'QC data structure',
      paragraphs: [
        'A QC is a certificate over an exact statement. In production, the certified statement binds multiple fields to prevent cross-domain attacks.',
        {
          type: 'code',
          language: 'javascript',
          body: '// Anatomy of a quorum certificate\nconst qc = {\n  // What was certified\n  chainId:    "mainnet-epoch-42",   // domain separation\n  epoch:      42,                    // prevents cross-epoch replay\n  round:      1087,                  // monotonic round number\n  blockId:    "0xa3f8...",           // hash of the proposed block\n  parentId:   "0x7c21...",           // hash of the parent block\n  voteType:   "block",              // distinguishes from timeout votes\n  stateRoot:  "0xef01...",           // execution result (DiemBFT)\n\n  // Who certified it\n  signerBitmap: 0b1110,             // which validators signed (v1,v2,v3)\n  signature:    "0xabc1...",        // aggregate BLS signature\n  votingPower:  75,                 // total voting power of signers\n  threshold:    67,                 // minimum required (2f+1)\n};',
        },
        {
          type: 'table',
          headers: ['Field', 'Purpose', 'Attack prevented'],
          rows: [
            ['chainId', 'Domain separation', 'A testnet QC cannot verify on mainnet'],
            ['epoch', 'Temporal scoping', 'A QC from a retired validator set cannot commit new blocks'],
            ['round', 'Progress ordering', 'A stale QC cannot override a newer lock'],
            ['blockId', 'Content binding', 'A signature over one block cannot certify a different block'],
            ['voteType', 'Type separation', 'A timeout vote cannot be replayed as a block vote'],
            ['signerBitmap', 'Accountability', 'Clients can verify the threshold was met by specific validators'],
            ['stateRoot', 'Execution binding', 'Nondeterministic execution across validators is detected'],
          ],
        },
        'Without signer accountability, a client receiving a QC cannot verify that the threshold was genuinely met. An aggregate signature alone proves that some set of keys signed, but the bitmap proves which keys. That distinction matters for slashing: if a validator equivocated, the bitmap evidence lets the system prove who is responsible.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a 4-validator network (f = 1) running chained HotStuff. Validator V4 is Byzantine. Trace the commit of block B1 through a clean 3-chain:',
        {
          type: 'table',
          headers: ['Round', 'Leader', 'Block', 'Votes received', 'QC formed', 'Effect'],
          rows: [
            ['1', 'V1', 'B1 (parent: genesis)', 'V1, V2, V3 (V4 silent)', 'QC1 for B1', 'B1 is prepared'],
            ['2', 'V2', 'B2 (parent: B1, carries QC1)', 'V1, V2, V3', 'QC2 for B2', 'B1 is locked (2-chain)'],
            ['3', 'V3', 'B3 (parent: B2, carries QC2)', 'V1, V2, V3', 'QC3 for B3', 'B1 commits (3-chain)'],
            ['4', 'V4', 'B4? (V4 is faulty)', 'V4 proposes conflicting block', 'No QC forms', 'Timeout, advance to round 5'],
          ],
        },
        'B1 commits at round 3, not because B3 is special, but because B1-B2-B3 form a contiguous certified chain in adjacent rounds. The decision is about the prefix, not the tip.',
        'Now consider the attack: V4 tries to fork at round 2 by sending a conflicting block B2\' to V1 and the real B2 to V2 and V3. V1 checks its safety rules: B2\' does not extend V1\'s locked QC (which is QC1 from round 1) -- actually it does extend B1, so V1 might vote for it. But V1 can only vote once per round. If V1 already voted for the real B2, it rejects B2\'. If V1 votes for B2\' instead, the real B2 still gets votes from V2, V3, and the leader V2 itself -- 3 votes, enough for a QC. The fork B2\' gets only V1 + V4 = 2 votes, below the threshold of 3.',
        {
          type: 'note',
          text: 'The arithmetic is tight. With n = 4 and f = 1, the quorum is 3. Any two quorums of size 3 overlap in 2 validators. At least 1 overlap member is honest. That one honest validator will not sign both forks in the same round. Two conflicting QCs for the same round are impossible.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'HotStuff', 'PBFT', 'Why it matters'],
          rows: [
            ['Happy-path messages', 'O(n) per round', 'O(n^2) per phase', 'Each validator sends one vote to the leader, not to all peers'],
            ['View-change messages', 'O(n)', 'O(n^2) to O(n^3)', 'Each validator sends one timeout vote, not a full proof set'],
            ['Commit latency', '3 rounds (3-chain rule)', '2 phases + view change', 'The 3-chain trades one extra round for simpler recovery'],
            ['Crypto per round', 'n signature creates, 1 aggregation, 1 verify', 'n^2 signature verifies', 'Aggregate signatures compress verification to O(1)'],
            ['Persistent state per validator', '~100 bytes (round, lock QC)', '~100 bytes + view-change logs', 'Small state means fast crash recovery'],
            ['Block store', 'O(chain length) until pruned', 'O(chain length) until pruned', 'Both need pruning discipline; neither is free'],
          ],
        },
        'The concrete cost: with 100 validators, a HotStuff round sends about 100 vote messages to the leader and 1 proposal broadcast. PBFT sends about 10,000 prepare messages and 10,000 commit messages. When the leader fails, HotStuff sends 100 timeout votes; PBFT sends 100 view-change messages each carrying up to 100 prepare certificates.',
        'The 3-chain rule is the latency tax. A block is not committed until two more certified blocks extend it. In a network with 200ms round-trip times, that means roughly 600ms to commit under the happy path. DiemBFT v4 and Jolteon reduce this to a 2-chain commit on the happy path, paying higher cost only during leader failures. That tradeoff -- lower normal-case latency versus more complex fallback -- is the design space that HotStuff opened.',
        {
          type: 'note',
          text: 'Doubling the validator set from 50 to 100 doubles the vote messages per round (linear). In PBFT, the same doubling quadruples the prepare and commit messages (quadratic). At 1,000 validators, PBFT sends about 1,000,000 messages per phase. HotStuff sends 1,000.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HotStuff-style protocols win when a known validator set needs fast finality under Byzantine assumptions and the validator count is large enough that O(n^2) communication becomes painful.',
        {
          type: 'bullets',
          items: [
            'Diem (formerly Libra): Facebook\'s blockchain project used DiemBFT, a direct descendant of HotStuff with 2-chain commit on the happy path, speculative execution, and quorum-store data dissemination. The codebase (now open-source as aptos-core) is the most complete production implementation of the HotStuff family.',
            'Aptos: forked from Diem, runs AptosBFT (Jolteon variant) with linear fast-path commits and quadratic fallback. Processes thousands of transactions per second with sub-second finality on a 100+ validator set.',
            'Flow blockchain: uses a HotStuff variant for its consensus committee, separating consensus from execution and verification into different node roles.',
            'Cypherium: permissioned enterprise blockchain using HotStuff for validator consensus with deterministic finality.',
            'Permissioned enterprise ledgers: any system where 10-200 known organizations need BFT consensus benefits from HotStuff\'s linear message complexity over PBFT.',
          ],
        },
        'The linear communication story matters most at scale. With 20 validators, PBFT works fine. With 100, the O(n^2) phases become a real bottleneck. HotStuff made large BFT committees practical.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HotStuff does not solve open membership. The 3f + 1 guarantee assumes a known validator set and a voting-power rule. Sybil resistance, staking, validator admission, slashing, epoch changes, and governance are outside the core consensus proof.',
        {
          type: 'table',
          headers: ['Limitation', 'Why it hurts', 'What production systems add'],
          rows: [
            ['No data availability guarantee', 'A QC over a block hash is useless if the block body is withheld', 'Mempool protocols (Narwhal), quorum stores, erasure coding'],
            ['Leader DoS exposure', 'A known leader can be targeted; network-level attack stalls progress', 'Leader randomization via VRF, reputation scoring, reputation-weighted rotation'],
            ['3-chain latency overhead', 'Three rounds to commit adds ~400-600ms over a 2-phase protocol', 'DiemBFT 2-chain, Jolteon fast path, pipelining'],
            ['No open membership', 'Cannot add validators without a separate governance mechanism', 'Staking, epoch transitions, validator admission protocols'],
            ['Aggregate signature assumptions', 'Linear communication relies on BLS or threshold signatures', 'Fallback to individual signature collection if aggregate crypto is unavailable'],
            ['Timeout tuning fragility', 'Too-short timeouts cause unnecessary leader changes; too-long timeouts stall', 'Adaptive timeout with exponential backoff and pacemaker protocol'],
          ],
        },
        'The most subtle failure is data availability. A Byzantine leader can propose a block, collect votes for a QC, and then withhold the block body. Validators voted on a hash they executed, but other validators or joining nodes cannot verify the block without its contents. This is why Narwhal-style mempool protocols separate data dissemination from ordering -- they guarantee block availability before consensus runs.',
        'Leader-based protocols also suffer from tail latency under adversarial conditions. If f consecutive leaders are faulty, the system stalls for f timeout periods before an honest leader gets a round. With f = 33 and a 2-second timeout, that is over a minute of downtime. Reputation-based rotation and VRF-based leader selection reduce but do not eliminate this exposure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: "HotStuff: BFT Consensus with Linearity and Responsiveness" (Yin, Malkhi, Reiter, Gueta, Abraham, PODC 2019) introduced the protocol. "DiemBFT v4: State Machine Replication in the Diem Blockchain" (Baudet et al., 2021) describes the production variant with 2-chain commit, pacemaker protocol, and speculative execution. "Jolteon and Ditto: Network-Adaptive Efficient Consensus with Asynchronous Fallback" (Gelashvili et al., 2022) shows how to combine linear happy-path latency with quadratic fallback.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Byzantine Fault Tolerance -- the failure model, the 3f + 1 bound, and why crash-fault protocols are insufficient.',
            'Prerequisite: read/write quorums -- the intersection arithmetic that makes QC safety work.',
            'Extension: Narwhal-Bullshark DAG mempool -- separating data availability from ordering, which solves HotStuff\'s data withholding problem.',
            'Extension: Merkle trees and authenticated state roots -- why consensus over order often needs consensus over execution results too.',
            'Contrast: Tendermint/CometBFT -- a different BFT protocol with O(n^2) communication but instant finality in 2 rounds.',
            'Contrast: PBFT -- the original practical BFT protocol that HotStuff improves upon.',
            'Case study: Ethereum Merkle-Patricia Trie -- how a different blockchain handles authenticated state.',
          ],
        },
        'The engineering question for HotStuff is not whether BFT consensus is possible -- PBFT proved that in 1999. The question is whether the view-change protocol can be as simple as the normal path. HotStuff showed it can, and every production BFT system since has built on that insight.',
      ],
    },
  ],
};

