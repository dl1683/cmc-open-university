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
        'The animation has two views. "Membership change" traces the three-phase lifecycle: old configuration, joint configuration, final new configuration. "Quorum safety" shows why skipping the joint phase is unsafe.',
        {
          type: 'callout',
          text: 'Joint consensus is safe because the old voter set and the new voter set must both witness the transition before either one can act alone.',
        },
        {
          type: 'bullets',
          items: [
            'Active markers show nodes or entries currently participating in the quorum decision.',
            'Found markers show state now committed: the cluster has agreed and cannot roll back.',
            'Compare markers show nodes that have lost voting rights after the final config commits.',
          ],
        },
        'In the membership change view, watch for the moment the joint configuration entry commits. That is the instant quorum rules change from "majority of old" to "majority of old AND majority of new." The graph edges show replication flow; the matrix view shows the commit rule in force at each phase.',
        {
          type: 'note',
          text: 'The interesting frame is never when a new node appears. It is when the log entry that changes quorum math commits. That is where safety lives or dies.',
        },
      
        {type: 'image', src: './assets/gifs/raft-joint-consensus.gif', alt: 'Animated walkthrough of the raft joint consensus visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Raft cluster runs on a fixed set of voters. Hardware fails, zones get rebalanced, disks fill, and operators need to swap machines without downtime. The voter set cannot stay frozen forever.',
        'Membership is not ordinary configuration. The voter set defines what "majority" means, and Raft proves safety by guaranteeing that any two majorities overlap. If the voter set changes without preserving that overlap, two groups can each believe they hold authority to elect leaders and commit entries.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a data center', caption: 'Consensus membership changes are ordinary hardware operations promoted into replicated decisions. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        {
          type: 'quote',
          text: 'The challenge of reconfiguration is that changes to the membership can allow two independent majorities to form.',
          attribution: 'Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" (2014), Section 6',
        },
        'Joint consensus exists so a cluster can migrate from one voter set to another while the overlap invariant holds at every intermediate step.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural instinct is a direct swap: tell every node "the voters are now {A, B, D, E}" in a single admin command. This is how most configuration changes work in non-distributed systems, and it feels clean.',
        'The approach works if every node learns the new set at exactly the same logical instant. In a single-machine system that instant exists. In a distributed system it does not.',
        {
          type: 'diagram',
          label: 'Direct swap -- the dangerous window',
          text: 'Time ---->\n\nNode A:  [ old config {A,B,C} ]----->[ new config {A,B,D,E} ]\nNode B:  [ old config {A,B,C} ]----------->[ new config {A,B,D,E} ]\nNode C:  [ old config {A,B,C} ]--------------------->[ learns too late ]\nNode D:  [ ??? ]----->[ new config {A,B,D,E} ]\nNode E:  [ ??? ]--------->[ new config {A,B,D,E} ]\n\n         ^                ^\n         |                |\n     A+B form old      A+D form new\n     majority here     majority here\n                           \n     Two leaders can exist simultaneously.',
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map with many connected nodes', caption: 'Distributed systems do not receive configuration changes at one global instant, so quorum overlap must be enforced by the log. Source: Wikimedia Commons, The Opte Project, CC BY 2.5.'},
        'Some nodes still count the old majority while others count the new one. During that window, two non-overlapping groups can each claim quorum. The direct swap is not stupid -- it just assumes an atomicity guarantee that networks cannot provide.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the pigeonhole argument for quorum overlap. Raft safety requires that any two committed entries share at least one voter who saw both. That works when every quorum is drawn from the same set: two majorities of the same N members must overlap by at least one member.',
        'When the set itself changes, the overlap guarantee vanishes. A majority of {A, B, C} is any two of three. A majority of {A, B, D, E} is any three of four. The sets {A, B} and {D, E, ...} can both be valid majorities under their respective configurations while sharing zero members.',
        {
          type: 'code',
          language: 'text',
          text: 'Old voters: {A, B, C}     Majority = 2\nNew voters: {A, B, D, E}  Majority = 3\n\nPossible old quorum: {A, B}      -- valid, 2 of 3\nPossible new quorum: {B, D, E}   -- valid, 3 of 4\n\nOverlap: {B} -- safe (B witnessed both decisions)\n\nBut also possible:\nOld quorum: {A, C}      -- valid, 2 of 3\nNew quorum: {B, D, E}   -- valid, 3 of 4\n\nOverlap: {} -- UNSAFE. No shared witness.\nTwo conflicting committed histories can coexist.',
        },
        'Without a protocol that forces overlap during the transition, membership change is a safety violation waiting for a partition.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Joint consensus replaces the instant swap with a two-phase commit through the replicated log itself. Membership becomes data, not metadata.',
        {
          type: 'diagram',
          label: 'Two-phase configuration transition',
          text: 'Log index:   ... | i-1 | i          | i+1 | ... | j          | j+1 | ...\nEntry:       ... | cmd | C_old,new  | cmd | ... | C_new      | cmd | ...\nCommit rule: ... | old | joint      | joint     | joint      | new | ...\n\n  Phase 1 (old):   majority of {A,B,C}\n  Phase 2 (joint): majority of {A,B,C} AND majority of {A,B,D,E}\n  Phase 3 (new):   majority of {A,B,D,E}',
        },
        {
          type: 'bullets',
          items: [
            'Step 1: The leader appends a joint configuration entry C_old,new containing both voter sets. From this point, every commit (including this entry itself) requires a majority from the old set AND a majority from the new set.',
            'Step 2: While C_old,new is active, normal log entries, elections, and heartbeats all obey the joint quorum rule. A candidate must win votes from both majorities to become leader.',
            'Step 3: After C_old,new commits, the leader appends C_new. When C_new commits, the old-only voters stop participating in future quorum decisions.',
            'Step 4: Removed voters may be shut down, kept as non-voting learners, or decommissioned. They no longer affect cluster progress.',
          ],
        },
        'Leader election during the joint phase follows the same double-majority rule. A node cannot become leader by convincing only the new side while the old side still operates under old rules. Election safety and replication safety stay aligned.',
        {
          type: 'note',
          text: 'Production systems (etcd, CockroachDB) require new servers to catch up on the log before they become voting members. A lagging voter makes quorum harder to reach and can turn a planned maintenance action into an availability incident.',
        },
        {
          type: 'code',
          language: 'text',
          text: '// Pseudocode: joint consensus commit check\nfunction isCommitted(entry, config) {\n  if (config.phase === "old") {\n    return hasAcked(entry, config.old) >= majority(config.old);\n  }\n  if (config.phase === "joint") {\n    return hasAcked(entry, config.old) >= majority(config.old)\n        && hasAcked(entry, config.new) >= majority(config.new);\n  }\n  if (config.phase === "new") {\n    return hasAcked(entry, config.new) >= majority(config.new);\n  }\n}',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Raft safety rests on one property: if an entry is committed, every future leader must have that entry in its log. This holds because any two majorities of the same set overlap, so at least one voter in the future leader majority witnessed the commit.',
        'Joint consensus preserves that property across a changing voter set. During the joint phase, a commit needs a majority from the old set AND a majority from the new set. Any future leader also needs both majorities. The intersection is guaranteed in both directions.',
        {
          type: 'bullets',
          items: [
            'C_old -> C_old,new: the joint entry still needs an old majority, so it overlaps the old-only phase through the same voter set.',
            'C_old,new -> C_new: the final entry needs a new majority, and the joint phase already required a new majority, so the transition overlaps through the new voter set.',
          ],
        },
        'The key insight: there is no adjacent pair of phases where a quorum in one phase can avoid sharing a member with a quorum in the other. The joint phase acts as a bridge that forces overlap in both directions.',
        'Because configuration entries are ordinary log entries, membership changes have a well-defined position relative to application commands. Every node knows which quorum rule applies to each log index. Administrative action never lives outside the safety model.',
        {
          type: 'quote',
          text: 'The joint consensus approach allows the cluster to continue servicing client requests throughout configuration changes.',
          attribution: 'Ongaro, "Consensus: Bridging Theory and Practice" (2014), Chapter 4',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Membership changes are rare events with outsized risk. The protocol adds exactly two extra log entries (C_old,new and C_new) and temporarily raises the quorum bar.',
        {
          type: 'bullets',
          items: [
            'Quorum size: during the joint phase, commits must satisfy both old and new majorities. After C_new commits, the rule returns to majority of the new set only.',
            'Latency per commit: the leader may wait for the slower side of the transition. After the final config commits, normal replication latency returns.',
            'Leader election: candidates need votes from both voter sets during the joint phase. Afterward, only the new voter set matters.',
            'Availability risk: losing quorum in either voter set can block progress while joint consensus is active.',
            'Log entries added: the protocol spends two configuration entries, C_old,new and C_new, to keep the quorum rule explicit.',
          ],
        },
        'The joint phase is intentionally uncomfortable. Stricter quorum requirements during transition are a feature, not a cost: they are the mechanism that prevents split-brain.',
        {
          type: 'note',
          text: 'For a 3-node cluster expanding to 5 nodes, the joint phase requires at least 2 of 3 old voters AND at least 3 of 5 new voters for every commit. If either the old or new side loses quorum, the cluster stalls until enough voters recover.',
        },
        'Operationally, the hard cost is preparation. New voters must catch up on the log before entering the joint phase. Removing a voter from a cluster that is already degraded can make quorum impossible. Implementations add pre-flight checks that reject reconfiguration requests likely to strand the cluster.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Planned hardware replacement: swap a failing machine for a fresh one without downtime. The old node stays in the voter set until the new node catches up and the joint phase commits.',
            'Zone rebalancing: move replicas across availability zones by adding new-zone voters and removing old-zone voters through sequential membership changes.',
            'Capacity scaling: expand a 3-node cluster to 5 nodes to improve fault tolerance (tolerate 2 failures instead of 1). The joint phase ensures the cluster never enters a state where 5-node quorum math applies to a half-replicated log.',
            'Control-plane stores (etcd, Consul, ZooKeeper successors): a mistaken membership change in the metadata store can take the entire platform offline. Joint consensus keeps operator actions inside the safety proof.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'etcd exposes runtime member add and remove operations, with learner promotion only after catch-up. The lesson: membership is data in the Raft log, not an external config file.',
            'CockroachDB applies joint consensus to range replica changes. The lesson: each range is its own Raft group with independent membership.',
            'Consul autopilot checks server health before promoting voters. The lesson: catch-up before voting prevents availability loss.',
            'TiKV records region peer changes as configuration-change entries in Raft. The lesson: membership changes happen per region, not only cluster-wide.',
          ],
        },
        'The teaching rule is clean: if a decision changes who is allowed to decide, that decision must itself be decided safely. Joint consensus is how Raft keeps that rule.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Quorum already lost: if the current voters cannot form a majority, the cluster cannot safely agree to a new voter set. Recovery requires an unsafe manual override (etcd calls this "disaster recovery" and treats it as a break-glass operation).',
            'Lagging voters added too eagerly: a new voter that has not caught up on the log makes quorum harder, not easier. Adding capacity can reduce availability if the new node is too far behind.',
            'Simultaneous membership changes: joint consensus is designed for one configuration change at a time. Batching unrelated membership edits obscures which quorum relationship protects the transition.',
            'Network partitions during the joint phase: the double-majority requirement means a partition that splits old and new voters can stall the entire cluster. The joint phase should be kept as short as possible.',
          ],
        },
        {
          type: 'diagram',
          label: 'Quorum-loss trap: adding a lagging voter',
          text: 'Before: {A, B, C}  majority = 2  (can tolerate 1 failure)\n\nAdd D (lagging, has no log entries):\n  Joint: need majority of {A,B,C} AND majority of {A,B,C,D}\n  D cannot ack anything yet -> effectively need 2 of 3 AND 2 of 3\n  Still works, but D adds no resilience.\n\nAdd D and E simultaneously (both lagging):\n  Joint: need 2 of {A,B,C} AND 3 of {A,B,C,D,E}\n  D and E cannot ack -> need all 3 of {A,B,C} to reach 3/5\n  Losing ANY original node now blocks the cluster.\n  The "expansion" reduced fault tolerance from 1 to 0.',
        },
        'The common thread: joint consensus protects against split-brain during transitions, but it cannot protect against operators who make the transition itself unsafe.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" (2014), raft.github.io/raft.pdf: Section 6 defines joint consensus and the two-phase membership change protocol.',
            'Ongaro, "Consensus: Bridging Theory and Practice" (2014), Chapter 4: extended treatment of membership change, including single-server changes and the bug they can cause.',
            'etcd runtime reconfiguration design, etcd.io/docs/v3.6/op-guide/runtime-reconf-design/: production rationale for learner nodes, pre-flight health checks, and safe member add/remove.',
            'etcd runtime configuration guide, etcd.io/docs/v3.3/op-guide/runtime-configuration/: operator procedures for adding, removing, and updating etcd members.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Raft Election -- understand leader election and term numbers before studying how membership changes interact with elections.',
            'Prerequisite: Raft Log Replication -- the commit rule and log matching property are the foundation that joint consensus extends.',
            'Extension: Raft Snapshots -- snapshotting interacts with membership change because a new voter may need a snapshot instead of replaying the entire log.',
            'Case study: etcd Raft Case Study -- see joint consensus applied in the system that runs Kubernetes metadata.',
            'Contrast: Kubernetes Reconciliation Case Study -- reconciliation loops operate above the consensus layer but depend on it for consistent reads.',
          ],
        },
      ],
    },
  ],
};
