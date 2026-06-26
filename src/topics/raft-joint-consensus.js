// Raft joint consensus: safely change cluster membership by committing a
// transitional configuration that requires majorities from old and new sets.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-joint-consensus',
  title: 'Raft Joint Consensus',
  category: 'Systems',
  summary: 'Change a Raft cluster safely: enter a joint old+new configuration, require overlapping quorums, then commit the final membership.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['membership change', 'quorum safety'], defaultValue: 'membership change' },
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

function raftGraph(title) {
  return graphState({
    nodes: [
      { id: 'leader', label: 'leader', x: 0.8, y: 3.6, note: 'old config' },
      { id: 'oldA', label: 'old A', x: 2.8, y: 1.4, note: 'voter' },
      { id: 'oldB', label: 'old B', x: 2.8, y: 3.6, note: 'voter' },
      { id: 'oldC', label: 'old C', x: 2.8, y: 5.8, note: 'voter' },
      { id: 'joint', label: 'C_old,new', x: 5.2, y: 3.6, note: 'joint log entry' },
      { id: 'newD', label: 'new D', x: 7.4, y: 2.2, note: 'catch up' },
      { id: 'newE', label: 'new E', x: 7.4, y: 5.0, note: 'catch up' },
      { id: 'final', label: 'C_new', x: 9.2, y: 3.6, note: 'final config' },
    ],
    edges: [
      { id: 'e-leader-oldA', from: 'leader', to: 'oldA', weight: 'append' },
      { id: 'e-leader-oldB', from: 'leader', to: 'oldB', weight: 'append' },
      { id: 'e-leader-oldC', from: 'leader', to: 'oldC', weight: 'append' },
      { id: 'e-oldB-joint', from: 'oldB', to: 'joint', weight: 'commit joint' },
      { id: 'e-joint-newD', from: 'joint', to: 'newD', weight: 'replicate' },
      { id: 'e-joint-newE', from: 'joint', to: 'newE', weight: 'replicate' },
      { id: 'e-joint-final', from: 'joint', to: 'final', weight: 'commit final' },
    ],
  }, { title });
}

function* membershipChange() {
  const oldVoters = 3; // A, B, C
  const newVoters = 2; // D, E
  const configPhases = 3; // old, joint, new

  yield {
    state: raftGraph('The leader starts in the old membership configuration'),
    highlight: { active: ['leader', 'oldA', 'oldB', 'oldC'], found: ['e-leader-oldA', 'e-leader-oldB', 'e-leader-oldC'] },
    explanation: `A Raft cluster with ${oldVoters} voters cannot casually swap members. Quorum math depends on the membership set, so membership changes themselves must be replicated through the log.`,
  };

  yield {
    state: raftGraph('Joint consensus logs a transitional old+new configuration'),
    highlight: { active: ['joint', 'oldA', 'oldB', 'oldC', 'newD', 'newE'], found: ['e-oldB-joint', 'e-joint-newD', 'e-joint-newE'] },
    explanation: `The leader appends a joint configuration containing both ${oldVoters} old and ${newVoters} new server sets. While this entry is active, decisions must satisfy both configurations.`,
    invariant: `Committed entries must be seen by an overlapping quorum across all ${configPhases} phases of the membership transition.`,
  };

  yield {
    state: labelMatrix(
      'Two-step config change',
      [
        { id: 'old', label: 'C_old' },
        { id: 'joint', label: 'C_old,new' },
        { id: 'new', label: 'C_new' },
        { id: 'remove', label: 'removed nodes' },
      ],
      [
        { id: 'rule', label: 'commit rule' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['majority of old', 'normal operation'],
        ['majority old and majority new', 'safe overlap'],
        ['majority of new', 'finish transition'],
        ['no longer voters', 'stop affecting quorum'],
      ],
    ),
    highlight: { active: ['joint:rule', 'joint:purpose'], found: ['new:rule'] },
    explanation: `The key trick is not simultaneous agreement by every node. It is overlapping majorities across ${configPhases} phases, so two leaders cannot each commit conflicting histories through different configurations.`,
  };

  yield {
    state: raftGraph('After the final config commits, only the new set votes'),
    highlight: { active: ['joint', 'final', 'e-joint-final'], found: ['newD', 'newE'], compare: ['oldA'] },
    explanation: `Once the final new configuration is committed, the ${oldVoters} old-only voters that were removed stop participating in future quorum decisions, leaving ${newVoters} new voters in control.`,
  };
}

function* quorumSafety() {
  const oldVoters = 3;
  const newVoters = 2;
  const totalVoters = oldVoters + newVoters;
  const operationalChecks = 4;

  yield {
    state: labelMatrix(
      'Unsafe one-step intuition',
      [
        { id: 'oldq', label: 'old majority' },
        { id: 'newq', label: 'new majority' },
        { id: 'split', label: 'no overlap' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'what', label: 'what happens' },
        { id: 'whybad', label: 'why bad' },
      ],
      [
        ['A+B commit old entry', 'valid in old config'],
        ['D+E commit new entry', 'valid in new config'],
        ['quorums miss each other', 'no shared witness'],
        ['two histories can survive', 'safety violation'],
      ],
    ),
    highlight: { active: ['split:whybad', 'risk:whybad'], compare: ['oldq:what', 'newq:what'] },
    explanation: `The danger in reconfiguration is split quorum knowledge. With ${oldVoters} old and ${newVoters} new voters, valid quorums from each set can avoid overlapping, so committed histories can diverge.`,
  };

  yield {
    state: raftGraph('Joint consensus forces old and new majorities to overlap'),
    highlight: { active: ['oldA', 'oldB', 'oldC', 'joint', 'newD', 'newE'], found: ['leader'] },
    explanation: `Joint consensus requires a majority from the ${oldVoters} old voters and a majority from the ${newVoters} new voters. That creates a shared witness across all ${totalVoters} participants for committed log entries.`,
  };

  yield {
    state: labelMatrix(
      'Operational checks',
      [
        { id: 'catchup', label: 'catch up new node' },
        { id: 'health', label: 'cluster health' },
        { id: 'one', label: 'one change at a time' },
        { id: 'strict', label: 'strict reconfig' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'failure', label: 'failure if skipped' },
      ],
      [
        ['has it replicated logs?', 'new voter immediately lags'],
        ['is quorum healthy?', 'change can strand cluster'],
        ['is previous change done?', 'ambiguous config state'],
        ['will quorum be lost?', 'unsafe admission'],
      ],
    ),
    highlight: { active: ['health:question', 'strict:failure'], found: ['catchup:failure'] },
    explanation: `Implementations need ${operationalChecks} operational guardrails before admitting voters. Membership changes are rare, dangerous writes to the control plane.`,
  };

  yield {
    state: labelMatrix(
      'Where it shows up',
      [
        { id: 'etcd', label: 'etcd' },
        { id: 'db', label: 'distributed DB' },
        { id: 'queue', label: 'replicated log' },
        { id: 'control', label: 'control plane' },
      ],
      [
        { id: 'change', label: 'change' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['add/remove member', 'membership is data'],
        ['replace failed replica', 'catch-up before voting'],
        ['scale consensus group', 'quorum math first'],
        ['Kubernetes metadata', 'do not improvise recovery'],
      ],
    ),
    highlight: { found: ['etcd:change', 'db:lesson'], active: ['control:lesson'] },
    explanation: `Any replicated control plane managing ${totalVoters} or more voters has to treat voter changes as consensus operations, not as an external admin side effect.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'membership change') yield* membershipChange();
  else if (view === 'quorum safety') yield* quorumSafety();
  else throw new InputError('Pick a Raft joint consensus view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a membership change inside a Raft log. Old voters are the servers that currently define majority, new voters are the target membership, and the joint entry is the transition record.',
        {
          type: 'callout',
          text: 'Joint consensus is safe because the old voter set and the new voter set must both witness the transition before either one can act alone.',
        },
        'Active markers show which nodes participate in the current quorum rule. Found markers show committed configuration entries, which means the cluster has agreed which voting rule applies.',
        'The safe inference is adjacent overlap. The old phase overlaps the joint phase through an old majority, and the joint phase overlaps the new phase through a new majority.',
      
        {type: 'image', src: './assets/gifs/raft-joint-consensus.gif', alt: 'Animated walkthrough of the raft joint consensus visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Raft majority math depends on the membership set. Adding or removing a voter changes what counts as a majority, so membership cannot be changed as an external side effect.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a data center', caption: 'Consensus membership changes are ordinary hardware operations promoted into replicated decisions. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        'Joint consensus exists so operators can replace machines, rebalance zones, or resize a cluster while Raft still preserves one committed log history.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a direct swap from old membership to new membership. An admin command says the voters are now the new set, and each server updates its config when it receives the command.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected nodes', caption: 'Distributed systems do not receive configuration changes at one global instant, so quorum overlap must be enforced by the log. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.'},
        'That assumes all servers learn the new rule at one logical instant. Real networks deliver messages at different times, so some servers can still count old quorums while others count new quorums.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is split quorum knowledge. A majority of the old set and a majority of the new set do not necessarily share a voter.',
        'If those two quorums can be disjoint, two leaders can each commit entries under different membership rules. The safety proof for committed log entries no longer has a shared witness.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Insert a joint configuration into the replicated log. While it is active, any commit must satisfy a majority of the old set and a majority of the new set.',
        'This double-majority rule is stricter than either final rule, but it bridges them. It prevents the cluster from jumping across a gap where old and new quorums can miss each other.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Phase one is the old configuration, where ordinary commits need an old majority. The leader appends C_old,new, a log entry containing both old and new voter sets.',
        'Phase two is joint consensus. Commits and elections require both old-majority agreement and new-majority agreement, so neither side can act alone.',
        'Phase three starts when the leader appends and commits C_new. After that point, only the new voter set counts, and removed old-only nodes stop affecting quorum.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows by preserving overlap at each transition boundary. The old phase and joint phase overlap because joint commits include an old majority.',
        'The joint phase and new phase overlap because joint commits include a new majority. Therefore a committed entry cannot pass from old authority to new authority without some voter carrying the history across.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The protocol adds two configuration entries and a temporary double-majority requirement. During the joint phase, the leader may wait for the slower side of the transition.',
        'For a 3-node old set moving to a 5-node new set, the joint phase needs 2 of 3 old voters and 3 of 5 new voters. Adding lagging voters too early can reduce availability because they count toward the new majority before they can help reliably.',
        'Membership changes are rare, but their operational risk is high. Implementations usually require catch-up, health checks, and one change at a time.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'etcd uses Raft membership changes for Kubernetes metadata clusters, with learner promotion to avoid making lagging nodes voters too soon. CockroachDB and TiKV apply similar ideas at the range or region level.',
        'The broader pattern is control-plane safety. Any system whose own membership controls future decisions must treat membership as replicated data, not as a side file on each server.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Joint consensus cannot recover a cluster that has already lost quorum. If the old set cannot agree, it cannot safely agree to a new set without a manual break-glass recovery.',
        'It also cannot make careless operations safe. Adding multiple lagging voters, changing membership during a partition, or batching unrelated changes can strand the cluster even though the protocol preserves safety.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Old voters are A, B, and C, so majority is 2. New voters are A, B, D, and E, so majority is 3.',
        'A direct swap is unsafe because old quorum {A, C} and new quorum {B, D, E} share no voter. Each can believe it has authority under a different rule.',
        'Joint consensus requires 2 of {A, B, C} and 3 of {A, B, D, E}. A commit with A, B, and D satisfies both rules: A and B are the old majority, and A, B, D are the new majority. The transition has a shared witness set.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, 2014, Section 6. Also see Ongaro, Consensus: Bridging Theory and Practice, 2014, for the dissertation treatment.',
        'Study Raft election and Raft log replication first. Then study etcd runtime reconfiguration, learner nodes, Raft snapshots, CAP theorem, and disaster recovery procedures for quorum loss.',
      ],
    },
  ],
};