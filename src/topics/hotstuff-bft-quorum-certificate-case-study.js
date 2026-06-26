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
        'Read each block as a proposed next entry in a replicated log. A validator is a participant that can vote, and Byzantine means the participant may lie, equivocate, withhold messages, or send different stories to different peers.',
        'Active nodes show the current round, votes, quorum certificate, timeout, or leader change. A safe inference is that a quorum certificate proves enough validators signed one exact statement, but a certified block is not necessarily committed until the commit rule says so.',
        {type:'callout', text:'A quorum certificate turns Byzantine agreement from a message storm into a portable proof that leaders can carry forward.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Replicated services need one ordered history even when some participants are faulty or malicious. Crash-fault protocols assume failed nodes stop or lag, but Byzantine fault tolerance must handle nodes that sign conflicting blocks or hide information.',
        'HotStuff assumes n = 3f + 1 validators, where at most f are Byzantine. Its goal is safety under any network timing and progress after the network becomes timely enough and an honest leader gets a round.',
        'The central data structure is the quorum certificate, or QC. A QC is a compact proof that at least 2f + 1 validators signed the same proposal for the same round and block identity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious BFT approach is all-to-all voting, as in the PBFT family. The leader proposes, validators broadcast prepare messages, validators broadcast commit messages, and a special view-change protocol handles a bad leader.',
        'That is reasonable for small committees. If there are 4 or 10 validators, all-to-all messages are visible and the protocol is easier to explain than a chained certificate pipeline.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is recovery cost. With 100 validators, one all-to-all phase sends about 9,900 peer messages, and a view change can carry many certificates that each contain many signatures.',
        'A faulty leader can exploit that cost. If every failed leader forces quadratic or worse recovery work, the adversary can spend little effort causing the honest network to burn time on proof exchange.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make recovery use the same proof object as normal progress. Instead of a special heavy view-change proof, the next leader carries the highest QC it knows and proposes from that certified point.',
        'Safety comes from quorum intersection plus disciplined voting. Any two sets of 2f + 1 validators from 3f + 1 overlap in at least f + 1 validators, and at least one of those overlap validators is honest.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'HotStuff runs in numbered rounds with one leader per round. The leader proposes a block with a parent pointer and the highest QC it knows, and validators vote only if the proposal satisfies their safety rule.',
        'The leader collects 2f + 1 matching votes and aggregates them into a QC. In chained HotStuff, a block commits when it is the first block in a three-block chain of consecutive certified rounds.',
        'When a leader stalls, validators send timeout votes. A timeout certificate proves that a quorum abandoned the round, allowing the next leader to advance without reconstructing history from many special messages.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Safety follows from quorum intersection. If one block has a committed chain, any conflicting certified chain would need a quorum that overlaps with the first quorum in at least one honest validator.',
        'The honest validator will not vote for a proposal that conflicts with its lock unless the proposal carries a higher-round QC that makes the move safe. That locking rule prevents two conflicting histories from both gathering the certificates needed for commit.',
        'Liveness is separate from safety. Timing cannot create two conflicting commits, but after the network stabilizes, the pacemaker and leader rotation eventually give an honest leader enough time to gather votes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'HotStuff makes normal voting linear in validator count. With n validators, each validator sends one vote to the leader, and the leader broadcasts one proposal or certificate rather than making every validator talk to every other validator.',
        'For n = 100, that means about 100 vote messages in a round instead of about 9,900 all-to-all prepare messages. Doubling the validator set doubles the HotStuff vote traffic, while quadratic protocols roughly quadruple the all-to-all phase.',
        'The cost is latency and protocol machinery. The three-chain commit rule waits for certified descendants, and production systems must handle pacemaker tuning, signature aggregation, durable lock state, data availability, and validator-set changes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HotStuff-style protocols fit known-validator systems that need Byzantine fault tolerance with fast finality. Blockchains, permissioned ledgers, replicated control planes, and settlement systems use this family when validator identity and voting power are explicit.',
        'Production descendants include DiemBFT-style designs and later variants that optimize the happy path. Many systems also pair consensus with separate data availability layers because ordering a block hash is not enough if peers cannot fetch the block body.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HotStuff does not solve open membership by itself. Staking, validator admission, sybil resistance, epoch changes, slashing, and governance are outside the core protocol.',
        'It also does not guarantee data availability. A QC over a block hash is not useful to a joining or lagging node if the block body was withheld.',
        'Leader-based protocols remain exposed to tail latency under faulty or attacked leaders. If several leaders fail in a row, the system waits through timeout periods until an honest leader gets a timely round.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use four validators, V1 through V4, with f = 1 Byzantine validator. The quorum size is 2f + 1 = 3, so any certified block needs three votes.',
        'Round 1 leader V1 proposes B1 and receives votes from V1, V2, and V3, forming QC1. Round 2 leader V2 proposes B2 extending B1 with QC1 and gets three votes, then round 3 leader V3 proposes B3 extending B2 with QC2 and gets three votes.',
        'B1 commits at round 3 because B1, B2, and B3 form a certified three-chain. If Byzantine V4 tries to make a conflicting B2 prime, it can collect at most V4 plus one honest vote in that round after honest validators obey one-vote and lock rules, which is below the threshold of three.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are the HotStuff PODC 2019 paper, the PBFT paper by Castro and Liskov, DiemBFT papers, and later Jolteon and Ditto work. Read them for the exact safety proof, pacemaker design, and production simplifications.',
        'Study Byzantine Fault Tolerance, Read-Write Quorums, Raft, PBFT, Tendermint or CometBFT, Narwhal-Bullshark DAG mempools, Merkle Trees, and Authenticated State Roots next.',
      ],
    },
  ],
};
