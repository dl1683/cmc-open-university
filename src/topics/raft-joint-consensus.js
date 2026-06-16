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
  yield {
    state: raftGraph('The leader starts in the old membership configuration'),
    highlight: { active: ['leader', 'oldA', 'oldB', 'oldC'], found: ['e-leader-oldA', 'e-leader-oldB', 'e-leader-oldC'] },
    explanation: 'A Raft cluster cannot casually swap voters. Quorum math depends on the membership set, so membership changes themselves must be replicated through the log.',
  };

  yield {
    state: raftGraph('Joint consensus logs a transitional old+new configuration'),
    highlight: { active: ['joint', 'oldA', 'oldB', 'oldC', 'newD', 'newE'], found: ['e-oldB-joint', 'e-joint-newD', 'e-joint-newE'] },
    explanation: 'The leader appends a joint configuration containing both old and new server sets. While this entry is active, decisions must satisfy both configurations.',
    invariant: 'Committed entries must be seen by an overlapping quorum across the membership transition.',
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
    explanation: 'The key trick is not simultaneous agreement by every node. It is overlapping majorities, so two leaders cannot each commit conflicting histories through different configurations.',
  };

  yield {
    state: raftGraph('After the final config commits, only the new set votes'),
    highlight: { active: ['joint', 'final', 'e-joint-final'], found: ['newD', 'newE'], compare: ['oldA'] },
    explanation: 'Once the final new configuration is committed, the old-only voters that were removed stop participating in future quorum decisions.',
  };
}

function* quorumSafety() {
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
    explanation: 'The danger in reconfiguration is split quorum knowledge. If valid old and new quorums do not overlap, committed histories can diverge.',
  };

  yield {
    state: raftGraph('Joint consensus forces old and new majorities to overlap'),
    highlight: { active: ['oldA', 'oldB', 'oldC', 'joint', 'newD', 'newE'], found: ['leader'] },
    explanation: 'Joint consensus requires a majority from the old configuration and a majority from the new configuration. That creates a shared witness for committed log entries.',
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
    explanation: 'Implementations need operational guardrails. Membership changes are rare, dangerous writes to the control plane.',
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
    explanation: 'Any replicated control plane has to treat voter changes as consensus operations, not as an external admin side effect.',
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
      heading: 'What it is',
      paragraphs: [
        'Raft joint consensus is the membership-change mechanism described in the Raft paper. It lets a replicated log move from one voting configuration to another without losing the overlapping-quorum property that makes consensus safe. Instead of jumping directly from old voters to new voters, Raft first enters a joint configuration containing both sets.',
        'The Raft paper describes membership changes as using a joint consensus approach where majorities of two different configurations overlap during transitions: https://raft.github.io/raft.pdf. etcd documents runtime reconfiguration as a safety-sensitive operation for adding, removing, and updating members: https://etcd.io/docs/v3.6/op-guide/runtime-reconf-design/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The leader appends a configuration entry for C_old,new, the joint configuration. While that entry is active, a log entry is committed only when it is stored on a majority of the old configuration and a majority of the new configuration. After the joint entry is committed, the leader appends C_new. When C_new commits, only the new configuration controls future quorums.',
        'This two-step path keeps a committed history from disappearing during membership changes. Every committed decision crosses a quorum that overlaps with the next decision. That shared witness is the safety argument.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Membership changes are rare but high risk. New voters should catch up before they are expected to carry quorum. Removing nodes from an unhealthy cluster can strand the system. Multiple simultaneous changes make reasoning harder. Implementations often add strict checks that reject reconfiguration requests likely to cause quorum loss.',
        'etcd documentation describes two-phase runtime reconfiguration and warns that the cluster must first agree on new configuration before a new member starts as part of that configuration: https://etcd.io/docs/v3.6/op-guide/runtime-reconf-design/. etcd FAQ material also discusses strict reconfiguration checks that reject quorum-losing changes: https://etcd.io/docs/v3.3/faq/.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A three-node etcd cluster A, B, C needs to become A, B, C, D, E. The operator first adds D and E so they can receive data, but they should not immediately decide quorum alone. The leader commits a joint configuration requiring majorities from both A/B/C and A/B/C/D/E. After the cluster safely commits through the joint stage, it commits the final five-node configuration. Later, if C is removed, that too is a logged membership change.',
        'The lesson is that membership is not external metadata. It is replicated state. Treating it as an ordinary log entry is how Raft keeps administrative actions inside the same safety model as application writes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The common misconception is that adding a node makes the cluster safer immediately. A new node that has not caught up can make quorum harder, not easier. Another trap is trying to fix quorum loss by adding members after the cluster is already unhealthy. Reconfiguration cannot bypass consensus without risking split-brain behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Raft paper at https://raft.github.io/raft.pdf, etcd runtime reconfiguration design at https://etcd.io/docs/v3.6/op-guide/runtime-reconf-design/, etcd runtime configuration guide at https://etcd.io/docs/v3.3/op-guide/runtime-configuration/, and etcd FAQ at https://etcd.io/docs/v3.3/faq/. Study Raft Election, Raft Log Replication, Raft Snapshots, etcd Raft Case Study, and Kubernetes Reconciliation Case Study next.',
      ],
    },
  ],
};
