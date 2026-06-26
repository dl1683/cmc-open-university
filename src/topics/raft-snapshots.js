// Raft snapshots and log compaction: the committed prefix is folded into a
// durable state-machine snapshot, and only the suffix needed for new commands
// stays in the replicated log.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'raft-snapshots',
  title: 'Raft Snapshots & Log Compaction',
  category: 'Systems',
  summary: 'Raft cannot keep every log entry forever: snapshot committed state, discard old prefixes, and install snapshots on lagging followers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compact committed prefix', 'install snapshot on lagging follower'], defaultValue: 'compact committed prefix' },
  ],
  run,
};

const SERVERS = [
  { id: 's1', label: 'S1 leader' },
  { id: 's2', label: 'S2 follower' },
  { id: 's3', label: 'S3 follower' },
];
const COLUMNS = [
  { id: 'snap', label: 'snapshot' },
  { id: 'l6', label: 'log 6' },
  { id: 'l7', label: 'log 7' },
  { id: 'l8', label: 'log 8' },
  { id: 'l9', label: 'log 9' },
];

function matrix(title, rows) {
  const labels = [''];
  const codeByLabel = new Map();
  const code = (label) => {
    if (!codeByLabel.has(label)) {
      codeByLabel.set(label, labels.length);
      labels.push(label);
    }
    return codeByLabel.get(label);
  };
  return matrixState({
    title,
    rows: SERVERS,
    columns: COLUMNS,
    values: rows.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function* compactCommittedPrefix() {
  yield {
    state: matrix('Before compaction: committed through index 7', [
      ['none', 't3:set x', 't3:set y', 't3:set z', 'empty'],
      ['none', 't3:set x', 't3:set y', 't3:set z', 'empty'],
      ['none', 't3:set x', 't3:set y', 't3:set z', 'empty'],
    ]),
    highlight: {
      found: ['s1:l6', 's1:l7', 's2:l6', 's2:l7', 's3:l6', 's3:l7'],
      active: ['s1:l8', 's2:l8', 's3:l8'],
    },
    explanation: `Raft Log Replication gives every server the same committed command history, but the history cannot grow forever. Once a prefix has been committed and applied to the state machine, the server can fold that prefix into a durable snapshot. All ${SERVERS.length} servers share the same committed prefix; the log keeps the recent suffix while the snapshot carries the old state.`,
    invariant: `Only committed and applied entries are eligible for compaction — each of the ${SERVERS.length} servers must independently verify this before snapshotting.`,
  };

  yield {
    state: matrix('Snapshot at index 7, term 3', [
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 'empty'],
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 'empty'],
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 'empty'],
    ]),
    highlight: {
      active: ['s1:snap', 's2:snap', 's3:snap'],
      removed: ['s1:l6', 's1:l7', 's2:l6', 's2:l7', 's3:l6', 's3:l7'],
    },
    explanation: `Each of the ${SERVERS.length} servers writes a snapshot containing the state machine after log index 7, plus the last included index and term. Those two numbers are not decoration: they let future AppendEntries consistency checks connect the compacted prefix to the remaining ${COLUMNS.length - 1} log columns worth of suffix.`,
    invariant: `A snapshot must record lastIncludedIndex and lastIncludedTerm — without them the ${COLUMNS[0].label} cell has lost its continuity proof to the log suffix.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'wal', label: 'WAL', x: 1.2, y: 5.2, note: 'recent suffix' },
        { id: 'snap', label: 'snapshot', x: 3.6, y: 2.5, note: 'state at idx 7' },
        { id: 'fsm', label: 'state machine', x: 5.8, y: 4.2, note: 'x,y applied' },
        { id: 'gc', label: 'old log prefix', x: 3.6, y: 7.0, note: 'safe to delete' },
        { id: 'rep', label: 'replication', x: 8.0, y: 4.2, note: 'new entries continue' },
      ],
      edges: [
        { id: 'e-wal-fsm', from: 'wal', to: 'fsm', weight: 'apply' },
        { id: 'e-fsm-snap', from: 'fsm', to: 'snap', weight: 'persist' },
        { id: 'e-snap-gc', from: 'snap', to: 'gc', weight: 'covers' },
        { id: 'e-wal-rep', from: 'wal', to: 'rep', weight: 'append idx 8+' },
      ],
    }, { title: 'Compaction is local storage cleanup, not consensus' }),
    highlight: { active: ['snap'], removed: ['gc'], found: ['rep'] },
    explanation: `Compaction does not change the consensus decision. The ${SERVERS.length}-node cluster already agreed on the prefix. Compaction changes how a server stores that prefix locally: ${COLUMNS[0].label} plus suffix instead of an infinite log. This is the same deferred-cleanup family as LSM Trees (How Cassandra Writes), MVCC Internals & VACUUM, and Git Internals.`,
  };
}

function* installSnapshot() {
  yield {
    state: matrix('S3 is far behind: leader no longer has entries 1-7', [
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
      ['none', 'missing', 'missing', 'missing', 'missing'],
    ]),
    highlight: { active: ['s3:l6', 's3:l7', 's3:l8', 's3:l9'], compare: ['s1:snap'] },
    explanation: `Now ${SERVERS[2].label} returns after a long outage. The ${SERVERS[0].label} wants to send entries starting near index 1, but those entries were compacted away. Raft cannot replay what it no longer stores, so it switches from AppendEntries to InstallSnapshot.`,
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'leader', label: 'leader', x: 1.2, y: 4.0, note: 'has idx7 snapshot' },
        { id: 'chunk1', label: 'chunk 1', x: 3.2, y: 2.8, note: 'snapshot bytes' },
        { id: 'chunk2', label: 'chunk 2', x: 5.0, y: 2.8, note: 'more bytes' },
        { id: 'follower', label: 'S3', x: 7.2, y: 4.0, note: 'installs atomically' },
        { id: 'suffix', label: 'log 8+', x: 5.0, y: 6.1, note: 'sent after snapshot' },
      ],
      edges: [
        { id: 'e-l-c1', from: 'leader', to: 'chunk1', weight: 'InstallSnapshot' },
        { id: 'e-c1-c2', from: 'chunk1', to: 'chunk2', weight: 'stream chunks' },
        { id: 'e-c2-f', from: 'chunk2', to: 'follower', weight: 'commit snapshot' },
        { id: 'e-l-suffix', from: 'leader', to: 'suffix', weight: 'then AppendEntries' },
        { id: 'e-suffix-f', from: 'suffix', to: 'follower', weight: 'catch up suffix' },
      ],
    }, { title: 'InstallSnapshot catches up a lagging follower' }),
    highlight: { active: ['chunk1', 'chunk2'], found: ['follower'], compare: ['suffix'] },
    explanation: `The ${SERVERS[0].label} streams the ${COLUMNS[0].label} to ${SERVERS[2].label}. The follower writes it safely, discards any older covered log entries, updates its last included index and term, and then resumes normal log replication from the suffix after the snapshot.`,
    invariant: `Snapshot first, suffix second: a follower like ${SERVERS[2].label} needs a valid prefix before the remaining ${COLUMNS.length - 1} log slots make sense.`,
  };

  yield {
    state: matrix('After install: S3 is compacted and caught up', [
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
    ]),
    highlight: { found: ['s3:snap', 's3:l8', 's3:l9'] },
    explanation: `${SERVERS[2].label} is now useful again without downloading the entire history. All ${SERVERS.length} servers match: each holds a ${COLUMNS[0].label} plus the same log suffix. A node that was offline for hours, a newly added replica, or a restored disk can catch up from a bounded snapshot instead of replaying every command since cluster birth.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compact committed prefix') yield* compactCommittedPrefix();
  else if (view === 'install snapshot on lagging follower') yield* installSnapshot();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a storage boundary inside a Raft cluster. A Raft cluster is a group of servers that replicate the same ordered log, and the highlighted prefix is the part already committed and applied to the state machine.',
        {type: 'image', src: './assets/gifs/raft-snapshots.gif', alt: 'Animated walkthrough of the raft snapshots visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is local but strict: a log prefix can become a snapshot only after the cluster has committed it and the server has applied it. The snapshot label is part of the proof because lastIncludedIndex and lastIncludedTerm connect old state to later log entries.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Raft log is an ordered record of commands that a replicated state machine must apply in the same order on every server. If the log grows forever, a restart must replay more history each month even though old commands have already become durable application state.',
        {type: 'callout', text: 'A Raft snapshot is not a shortcut around consensus; it is the committed prefix stored in a smaller recovery form.'},
        'Snapshots exist to replace that old committed prefix with a compact state image plus a boundary. They keep recovery bounded without changing the decision the cluster already made.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to keep every log entry forever. It is easy to trust because a recovering server can rebuild state by applying entry 1, then entry 2, and so on until it reaches the current tail.',
        'A second approach is to delete old entries once every current server has applied them. That sounds cheaper, but it forgets that a restored disk, new replica, or long-offline follower may need a valid starting point after the leader has compacted the old prefix.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Hdd_and_ssd.JPG', alt: 'Hard disk drive and solid state drive hardware', caption: 'Compaction is a storage decision: keep enough history for recovery without letting old committed entries dominate disk and replay cost. Source: Wikimedia Commons, Evan-Amos, public domain.'},
        'The wall is unbounded replay and unbounded retention. If a cluster commits 10,000 commands per minute, one day adds 14.4 million entries, so replaying from the beginning becomes an outage path rather than a recovery path.',
        'Blind deletion hits the opposite wall: the leader may no longer have the entries a follower needs. The system needs a compact object that is both state and evidence of where that state sits in the log.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that a committed prefix can be represented by the state it produces, not only by the commands that produced it. The representation is safe only if it carries the last included log index and term, which are the coordinates of the compaction boundary.',
        'Compaction changes storage form, not consensus history. New commands still append after the snapshot point, and followers still use normal log-matching checks on the remaining suffix.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A server first chooses an index that is committed and already applied. It writes the state machine image and records lastIncludedIndex and lastIncludedTerm, then makes that snapshot durable before discarding covered log entries.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation across a network', caption: 'Large snapshots are transferred as network data, often in chunks, before normal log replication resumes from the suffix. Source: Wikimedia Commons, Oddbodz, public domain.'},
        'When a follower is too far behind, the leader sends InstallSnapshot instead of old AppendEntries messages. The follower installs the snapshot, discards covered local entries, keeps any consistent later suffix, and then resumes normal replication after the boundary.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from Raft state-machine safety: committed entries survive future leaders, and deterministic state machines reach the same state after the same committed prefix. A durable snapshot of that state is therefore equivalent to replaying the covered prefix for recovery purposes.',
        'The boundary metadata preserves the log-matching argument across compaction. If a later entry says its previous entry is at index 7 in term 3, a snapshot with lastIncludedIndex 7 and lastIncludedTerm 3 can satisfy that continuity check even though entries 1 through 7 are no longer stored as individual records.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Snapshotting trades replay time and disk growth for write amplification and transfer cost. If a 4 GB state machine snapshots every minute, the disk and network may spend more time moving checkpoints than serving traffic; if it snapshots once a week, restart may require millions of suffix entries.',
        'When the command rate doubles, log growth between snapshots doubles unless the policy changes. The dominant cost is often not the O(number of entries) replay formula, but the behavior of large state images under fsync, checksum, chunk transfer, and follower catch-up pressure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Raft snapshots fit replicated control planes such as metadata stores, schedulers, lease managers, and distributed configuration systems. These systems run for months or years, so old committed decisions must stop dominating restart and catch-up time.',
        'The same pattern appears in write-ahead-log systems and database checkpoints. A durable checkpoint stores the old effect, while a shorter log suffix stores recent change.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Snapshots fail if they include uncommitted entries, omit the boundary term, or are published before the bytes are durable. Each error breaks a different safety link: agreement, continuity, or crash recovery.',
        'They also fail as backups. A snapshot may faithfully preserve corrupted application state, stale membership, or leaked secrets, so it needs restore tests, checksums, encryption, and access control like any other database file.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a three-node cluster has committed entries 1 through 7, and entry 7 was written in term 3. The state machine after those entries is x=12 and y=4, while entries 8 and 9 remain in the live log suffix.',
        'Server S1 writes a snapshot labeled lastIncludedIndex=7 and lastIncludedTerm=3, then deletes entries 1 through 7 after the snapshot is durable. Later S3 returns from downtime with only entries through 4, so the leader sends the snapshot for index 7 term 3 and then sends entries 8 and 9 normally.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, with attention to log compaction and InstallSnapshot. Then read the Raft dissertation sections on snapshots and membership because those details expose the recovery edge cases.',
        'Study Raft leader election, Raft log replication, write-ahead logging, checkpointing, LSM compaction, and MVCC cleanup next. The shared question is when old history can be replaced without losing the proof needed for recovery.',
      ],
    },
  ],
};
