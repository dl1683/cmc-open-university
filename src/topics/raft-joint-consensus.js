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
      heading: 'Why It Exists',
      paragraphs: [
        `A Raft cluster sometimes needs to add, remove, or replace voting members. Hardware fails, zones change, disks fill up, and operators need a way to move the cluster without taking the system offline.`,
        `Membership is not ordinary configuration. The voter set defines what a majority means, and majority overlap is part of Raft's safety proof. If the voter set changes unsafely, two different groups can both believe they have authority to elect leaders or commit log entries.`,
        `Joint consensus exists so a cluster can move from one voting configuration to another while preserving quorum overlap at every step.`,
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        `The obvious approach is to edit the membership list directly: one moment the voters are A, B, C; the next moment they are A, B, C, D, E. That assumes every node learns the change at the same instant.`,
        `Distributed systems do not have that instant. Some nodes may still count old majorities while others count new majorities. During a partition or leadership change, that split view can turn into split authority.`,
        `The wall is quorum math. A majority of the old set and a majority of the new set may not share a member if the transition is done carelessly. Without overlap, two leaders or two committed histories can appear.`,
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        `Make membership itself a replicated log entry. The cluster does not switch voter sets as external admin metadata; it commits the change through the same log that orders application commands.`,
        `The safe transition has two steps. First, commit a joint configuration, often written C_old,new, that includes both the old and new voter sets. While that configuration is active, entries must be accepted by a majority of the old set and a majority of the new set. Second, commit the final configuration C_new.`,
        `The invariant is quorum overlap across the transition. A committed decision in the old configuration, the joint configuration, and the new configuration must share enough witnesses that a conflicting history cannot sneak through.`,
      ],
    },
    {
      heading: 'Reading the Membership Trace',
      paragraphs: [
        `Use the "membership change" view to follow the three stages: old configuration, joint configuration, and final new configuration. The important moment is not when a new server appears in the diagram; it is when the log commits the configuration entry that changes quorum rules.`,
        `Use the "quorum safety" view to compare which voters are required in each stage. During the joint phase, a candidate or log entry has to satisfy both old-majority and new-majority rules. That double requirement is the safety feature, not extra ceremony.`,
        `Read the trace as an administrative operation being forced through consensus. Adding a member, removing a member, and replacing a failed machine are only safe when the cluster can still agree on the change.`,
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        `The current leader first appends a log entry for the joint configuration C_old,new. Once that entry is committed and applied, the cluster counts quorums against both configurations. A normal command is committed only when enough old voters and enough new voters have stored it.`,
        `Leader election follows the active configuration rules too. A node cannot safely become leader by convincing only the new side while the old side is still operating under the old rules. The transition keeps election and replication safety aligned.`,
        `After the joint configuration is committed, the leader appends a second configuration entry for C_new. When C_new commits, the old-only voters no longer count for future quorums. They may remain as learners, be removed, or be shut down according to the system's procedure.`,
        `Production systems often require a new server to catch up before it becomes a voting member. A lagging voter makes quorum harder to reach and can turn a maintenance action into an outage.`,
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        `Raft's normal safety story relies on majorities overlapping. If one majority committed an entry, a later leader elected by another majority must have some path to learn about that committed history.`,
        `Joint consensus preserves that story while the definition of majority changes. Requiring a majority of old voters and a majority of new voters means the transition cannot be completed by a group that is invisible to the other side.`,
        `Because configuration entries are log entries, membership changes have a clear order relative to application commands. A node can know which quorum rules apply to a given log index. That is what prevents administrative action from living outside the safety model.`,
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        `Start with a three-node cluster A, B, C. A majority is two. The operator wants to expand to A, B, C, D, E. If D and E immediately count as voters before they have caught up, the cluster may need three votes while two of the five are still empty or slow.`,
        `A safer flow first adds D and E in a way that lets them receive the log and catch up. Then the leader commits the joint configuration C_old,new. During this phase, a log entry needs a majority of A, B, C and a majority of A, B, C, D, E.`,
        `After that joint entry is safely committed, the leader commits C_new. Now the five-node cluster can make future decisions with a majority of any three voters. If C is later removed, that removal is another logged membership change, not a side edit to a config file.`,
      ],
    },
    {
      heading: 'Cost and tradeoff',
      paragraphs: [
        `Membership changes are rare but high risk. The protocol adds at least two configuration commits, and the joint phase can make quorum requirements stricter while the transition is active.`,
        `Operationally, the hard part is timing the change. New voters should catch up before they carry quorum. Removed voters should not be needed for the next decision. A cluster that is already unhealthy may not be able to reconfigure itself safely.`,
        `Implementations often add strict checks that reject reconfiguration requests likely to cause quorum loss. etcd documents runtime reconfiguration as a safety-sensitive operation for adding, removing, and updating members: https://etcd.io/docs/v3.6/op-guide/runtime-reconf-design/.`,
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        `Joint consensus wins for planned membership changes: replacing hardware, adding capacity, rotating nodes across zones, or shrinking after maintenance while the cluster remains available.`,
        `It is especially important for control-plane stores such as etcd, where a mistaken membership change can take the whole platform offline. The method keeps operator actions inside Raft's normal proof structure.`,
        `It also gives a clean teaching rule: if a decision changes who is allowed to decide, that decision must itself be decided safely.`,
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        `It fails as a rescue tool after quorum is already gone. If the current voters cannot agree, the cluster cannot safely agree to a new voter set without an explicit recovery procedure outside normal operation.`,
        `It fails when operators add lagging voters and assume more nodes automatically means more safety. A voter that cannot participate in quorum makes progress harder, not easier.`,
        `It also fails when systems allow too many simultaneous changes. The point of joint consensus is to keep the proof understandable. Batching unrelated membership edits can hide which quorum relationship is actually protecting the transition.`,
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: Raft paper at https://raft.github.io/raft.pdf, etcd runtime reconfiguration design at https://etcd.io/docs/v3.6/op-guide/runtime-reconf-design/, etcd runtime configuration guide at https://etcd.io/docs/v3.3/op-guide/runtime-configuration/, and etcd FAQ at https://etcd.io/docs/v3.3/faq/. Study Raft Election, Raft Log Replication, Raft Snapshots, etcd Raft Case Study, and Kubernetes Reconciliation Case Study next.',
      ],
    },
  ],
};
