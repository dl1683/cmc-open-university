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
    explanation: 'Raft Log Replication gives every server the same committed command history, but the history cannot grow forever. Once a prefix has been committed and applied to the state machine, the server can fold that prefix into a durable snapshot. The log keeps the recent suffix; the snapshot carries the old state.',
    invariant: 'Only committed and applied entries are eligible for compaction.',
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
    explanation: 'Each server writes a snapshot containing the state machine after log index 7, plus the last included index and term. Those two numbers are not decoration: they let future AppendEntries consistency checks connect the compacted prefix to the remaining suffix.',
    invariant: 'A snapshot must record lastIncludedIndex and lastIncludedTerm, or the log has lost its continuity proof.',
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
    explanation: 'Compaction does not change the consensus decision. The cluster already agreed on the prefix. Compaction changes how a server stores that prefix locally: snapshot plus suffix instead of an infinite log. This is the same deferred-cleanup family as LSM Trees (How Cassandra Writes), MVCC Internals & VACUUM, and Git Internals.',
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
    explanation: 'Now S3 returns after a long outage. The leader wants to send entries starting near index 1, but those entries were compacted away. Raft cannot replay what it no longer stores, so it switches from AppendEntries to InstallSnapshot.',
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
    explanation: 'The leader streams the snapshot to S3. The follower writes it safely, discards any older covered log entries, updates its last included index and term, and then resumes normal log replication from the suffix after the snapshot.',
    invariant: 'Snapshot first, suffix second: a follower needs a valid prefix before later log entries make sense.',
  };

  yield {
    state: matrix('After install: S3 is compacted and caught up', [
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
      ['idx7/t3: x,y', 'discarded', 'discarded', 't3:set z', 't3:set q'],
    ]),
    highlight: { found: ['s3:snap', 's3:l8', 's3:l9'] },
    explanation: 'S3 is now useful again without downloading the entire history. Production systems depend on this path: a node that was offline for hours, a newly added replica, or a restored disk can catch up from a bounded snapshot plus a recent log suffix instead of replaying every command since cluster birth.',
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
      heading: `What it is`,
      paragraphs: [
        `Raft Snapshots & Log Compaction is the maintenance layer that keeps a Raft cluster from storing an infinite replicated log. Raft Log Replication orders commands. The state machine applies those commands. Once a committed prefix has been applied, each server can write a snapshot of the resulting state and discard the covered log entries.`,
        `The snapshot is not just a backup file. It is part of the protocol surface. It records the state machine data plus the last included log index and term, so the compacted prefix still participates in Raft's log-matching checks.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `A server chooses a committed index, applies all entries through that index, writes a durable snapshot, then discards log entries up to that point. The remaining log suffix still handles new commands. If a follower is only slightly behind, the leader uses AppendEntries as usual. If the follower is so far behind that the leader has already compacted the needed prefix, the leader sends InstallSnapshot.`,
        `InstallSnapshot transfers the snapshot, often in chunks. The follower writes it safely, updates lastIncludedIndex and lastIncludedTerm, discards log entries covered by the snapshot, and then receives ordinary log entries after the snapshot boundary. The effect is catch-up by state transfer instead of catch-up by replaying the whole historical log.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Compaction trades disk space and replay time for snapshot write cost. Snapshot too often and the cluster burns I/O writing large state images. Snapshot too rarely and logs grow, crash recovery slows, and lagging followers need huge replay windows. Production systems also need atomic snapshot installation, checksums, throttling, and monitoring so snapshot traffic does not starve live Raft traffic.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `etcd, Consul, TiKV, CockroachDB-style replicated ranges, and many embedded Raft libraries use snapshots or checkpoints. In Kubernetes, etcd snapshot hygiene is operationally important because the control plane's durable state lives in Raft. The same shape appears outside Raft too: Write-Ahead Log (WAL) plus checkpoint, LSM Trees (How Cassandra Writes) plus compaction, and MVCC Internals & VACUUM plus cleanup of old versions.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not compact uncommitted entries. They may still be overwritten by a future leader. Do not omit the last included term; without it, a follower cannot prove how the snapshot connects to later log entries. Do not treat snapshots as replacing backups. A snapshot can faithfully preserve corrupted application state if the state machine accepted bad commands. Finally, compaction is local: servers can snapshot at different times and still agree on the same replicated state.`,
      ],
    },
    {
      heading: `Sources and study next`,
      paragraphs: [
        `Primary source: Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" at https://raft.github.io/raft.pdf. Study Raft Leader Election, Raft Log Replication, Write-Ahead Log (WAL), LSM Trees (How Cassandra Writes), MVCC Internals & VACUUM, and Leader Replacement to see how state, logs, terms, and cleanup fit together.`,
      ],
    },
  ],
};
