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
      heading: 'Why this exists',
      paragraphs: [
        `A Raft log grows with every command the cluster commits. That append-only history is the backbone of the replicated state machine: every server applies the same committed commands in the same order and reaches the same state. The problem is that a correct log can become too large to keep forever. Disk use grows, restart replay slows down, and a follower that falls far behind may need old entries the leader no longer wants to retain.`,
        `Snapshots exist to replace an old committed prefix with a compact image of the applied state. The cluster keeps the same state-machine result without storing every command that produced it. Instead of remembering command 1 through command 7 as separate log entries, a server can store a snapshot that says: after applying entries through index 7 in term 3, the state machine looked like this.`,
        `This matters most in long-running control planes. A healthy database, scheduler, metadata store, or service registry should not need to replay every membership change, lease refresh, key-value write, or placement decision since cluster creation just to restart tomorrow. Raft snapshots let the system keep consensus safety while bounding the storage and recovery cost of old committed history.`,
      ],
    },
    {
      heading: 'The naive baseline and the wall',
      paragraphs: [
        `The naive baseline is to keep the whole log forever and replay from index 1 whenever a server restarts or a follower catches up. It is easy to reason about because the log remains the complete history. If a node needs to rebuild state, it starts at the beginning and applies entries until it reaches the end.`,
        `The wall is unbounded history. A control-plane database may run for years. Replaying millions of old entries after a restart turns recovery into a long outage. Retaining old entries for one slow follower turns the leader into an archive system. Disk and memory pressure then come from ancient decisions that every healthy node has already applied.`,
        `Another tempting baseline is to delete old entries once every current node has applied them. That is unsafe as a complete plan. A node can be restored from an old disk, a new node can join, or an offline follower can return after the leader has compacted the entries it needs. The cluster needs a way to bring such a server to a valid committed prefix without replaying entries the leader no longer stores.`,
        `A snapshot is that bridge. It says: here is the state after a committed prefix, and here is the exact log boundary that connects that compacted prefix to later entries.`,
      ],
    },
    {
      heading: 'The core invariant',
      paragraphs: [
        `The invariant is simple and strict: only committed and applied entries may be folded into a snapshot, and the snapshot must remember the last included index and term. The state machine data alone is not enough. The boundary metadata is what connects the compacted prefix to the remaining log suffix.`,
        `lastIncludedIndex names the final log index represented inside the snapshot. lastIncludedTerm records the term of the entry at that index. Together they let later AppendEntries checks reason about continuity across the compaction boundary. The leader and follower can still ask whether their histories agree at the boundary even though the old prefix no longer exists as individual log entries.`,
        `After the snapshot and its boundary are durable, older committed entries can be discarded locally. New commands still replicate as log entries after the snapshot point. Compaction changes local storage form; it does not change what the cluster agreed to.`,
        `The state machine must also be deterministic with respect to the committed log. If two servers apply the same committed prefix, their snapshots should represent the same logical state even if bytes differ due to encoding or file layout. Snapshotting does not rescue a nondeterministic state machine.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The compact-committed-prefix view shows each row as one server's local storage. Before compaction, entries 6 and 7 are present as log cells on every server. They are highlighted because they have been committed and applied. After compaction, those cells become discarded, but the decision is not lost. It is represented by the snapshot cell that records state at index 7, term 3.`,
        `The snapshot label is part of the data structure. Index and term are not decoration. They are the continuity proof between the compacted prefix and the remaining suffix. The visual model places them in the snapshot cell because a snapshot without its boundary cannot safely stand in for a log prefix.`,
        `The graph view teaches a second distinction: compaction is local storage cleanup, not a new consensus decision. The cluster already agreed on the prefix. Each server changes how it stores that prefix: durable state image plus recent log suffix instead of an ever-growing log.`,
        `The install-snapshot view shows the catch-up case. S3 is not merely missing one recent entry. It is missing history that the leader no longer has as individual log entries. That is why the leader switches protocol shape. It sends the snapshot first, then resumes normal AppendEntries for the suffix after the snapshot boundary.`,
      ],
    },
    {
      heading: 'Mechanics of local compaction',
      paragraphs: [
        `A server first chooses a snapshot index that is known to be committed and applied. It must not snapshot speculative entries, because uncommitted entries may be overwritten by a later leader. The state machine is advanced through the chosen index before the snapshot is taken.`,
        `The server writes a durable snapshot of the state machine and records lastIncludedIndex and lastIncludedTerm. The write must be crash-safe. A common pattern is to write snapshot data to a temporary file or directory, fsync the data and metadata as required by the platform, verify a checksum, then atomically publish the new snapshot. Only after the snapshot is safely durable should the server discard covered log entries.`,
        `The remaining log suffix continues to accept new commands. If the snapshot includes entries through index 7, the log may still contain entries 8 and onward. The server's persistent state now has two pieces: a snapshot for the old prefix and a write-ahead log suffix for recent commands.`,
        `Compaction is local. Different servers may snapshot at different times. One follower may still store entries 1 through 7 while another has compacted them. That is fine as long as each server preserves committed state and boundary metadata. Consensus safety comes from the replicated log rules; compaction changes how each node stores a prefix it has already applied.`,
      ],
    },
    {
      heading: 'Mechanics of InstallSnapshot',
      paragraphs: [
        `If a follower is only slightly behind, the leader catches it up with AppendEntries. The leader sends the missing suffix, the follower checks the previous log index and term, and normal replication continues. InstallSnapshot is used when the follower needs entries that the leader has already compacted.`,
        `The leader sends the snapshot state plus the boundary index and term. Large snapshots are usually streamed in chunks so a transfer can fit memory limits and resume or retry after interruption. The follower writes the incoming snapshot safely without destroying its current usable state until the new snapshot is complete and verified.`,
        `After installing the snapshot, the follower discards log entries covered by the snapshot. If it has later entries that extend beyond the snapshot boundary and are consistent with that boundary, it may keep them. If they conflict, it discards the conflicting suffix and lets the leader send the correct entries. Then normal AppendEntries resumes after lastIncludedIndex.`,
        `The ordering matters: snapshot first, suffix second. Later log entries make sense only after the follower has a valid committed prefix. A follower that appends suffix entries without the prefix would have a log tail attached to no trustworthy state.`,
      ],
    },
    {
      heading: 'Correctness',
      paragraphs: [
        `Raft safety depends on committed prefixes being stable. Once an entry is committed, future leaders must contain it. If a deterministic state machine has applied a committed prefix into state, a snapshot of that state is an equivalent local representation of the prefix for recovery and catch-up.`,
        `The boundary index and term keep the snapshot anchored in the log. AppendEntries normally checks whether the follower has a previous log entry with a matching index and term. After compaction, the previous entry may live inside the snapshot rather than the log. lastIncludedIndex and lastIncludedTerm preserve the check at the boundary.`,
        `Installing a snapshot on a lagging follower is safe because the snapshot represents committed state, not a guess. After installation, entries after the boundary are replicated and checked normally. The follower does not get to invent state; it accepts a committed prefix from the leader and then follows the same suffix replication rules as everyone else.`,
        `Correctness also depends on crash behavior. A server must not acknowledge or rely on a snapshot that can disappear or be partially installed after a crash. A partially written snapshot should be ignored or cleaned up on restart. The previous durable state should remain usable until the new snapshot is complete.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a three-node cluster has committed commands through index 7, term 3. Those commands set x and y in the state machine. Each server has applied them. The leader and followers may still have log entries 8 and 9 for newer work.`,
        `A server decides to compact through index 7. It writes a snapshot containing the state after applying entries 1 through 7 and labels it lastIncludedIndex=7 and lastIncludedTerm=3. Once that snapshot is durable, it can delete log entries 1 through 7. It keeps entries 8 and 9 as the suffix.`,
        `Now S3 has been offline for long enough that it still lacks entries through 7. When it returns, it asks the leader for old entries. The leader no longer has them in the log. Instead, the leader sends InstallSnapshot for index 7, term 3. S3 installs the snapshot, records the boundary, discards covered local log entries, and then receives entries 8 and 9 through normal replication.`,
        `S3 did not replay from cluster birth, and the leader did not keep old log entries forever. The snapshot carried the committed prefix; the suffix caught S3 up to the current log tail.`,
      ],
    },
    {
      heading: 'Cost and tuning',
      paragraphs: [
        `Compaction trades disk space and replay time for snapshot write cost. Snapshot too often and the cluster burns I/O writing large state images. Snapshot too rarely and logs grow, crash recovery slows, and lagging followers need huge replay windows.`,
        `Snapshot size depends on the state machine, not just the number of log entries. A small key-value store may snapshot quickly. A large metadata store may need incremental snapshots, copy-on-write files, careful file reuse, or background checkpointing. Two clusters with the same Raft log length can have very different snapshot costs.`,
        `InstallSnapshot trades network bandwidth and follower downtime against replay cost. Sending a large snapshot can saturate disks or networks, especially if several followers are catching up at once. Production systems throttle transfer, prioritize live replication, and expose progress so operators can tell whether catch-up is moving or stuck.`,
        `The snapshot threshold is a policy choice. Some systems snapshot after the log reaches a byte limit. Others use entry count, elapsed time, or replay-time estimates. The right threshold depends on disk speed, state size, expected restart time, and how often followers fall behind.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Snapshots fit long-running replicated state machines: metadata stores, configuration services, lease managers, distributed schedulers, embedded Raft libraries, and storage systems that replicate per-range state. They keep restart and catch-up bounded while preserving committed state.`,
        `They are especially valuable for nodes that disappear and return. A follower that missed hours of traffic can install a bounded snapshot plus a recent suffix instead of replaying every command since the cluster was created. A newly added replica can join from a snapshot rather than forcing the leader to retain ancient history.`,
        `Snapshots also support operational maintenance. They reduce log disk usage, shorten crash recovery, and give operators a predictable way to reason about how much history a node must replay. In systems with many Raft groups, compaction may be the difference between a manageable fleet and a storage leak.`,
        `The same pattern appears outside Raft. A write-ahead log plus checkpoint, LSM compaction, and MVCC cleanup all turn old history into a smaller representation after it becomes safe to do so. Raft snapshots are the consensus-specific version of that storage pattern.`,
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        `Snapshots fail when treated as a shortcut around Raft safety. Do not compact uncommitted entries. They may still be overwritten by a future leader. Do not omit lastIncludedTerm. Without it, a follower cannot prove how the snapshot connects to later log entries.`,
        `A snapshot is not a backup strategy by itself. It may faithfully preserve corrupted application state if the state machine accepted bad commands. It may also preserve a bad membership configuration. Restoring a cluster from snapshots still has to handle cluster identity, membership, log suffixes, and operator intent safely.`,
        `Snapshot installation can fail halfway. The follower may crash during transfer, run out of disk, receive corrupted chunks, or install bytes that fail checksum verification. The implementation must keep the old usable state until the new snapshot is complete. On restart, it must detect and discard incomplete snapshot files.`,
        `Compaction can harm availability if it is too aggressive. If leaders compact entries before slow followers can catch up, those followers will need full snapshots more often. That may be acceptable, but it increases bandwidth, disk, and recovery load. Keeping a reasonable suffix window can reduce snapshot churn.`,
        `Snapshots can also hide application bugs. If the state machine is nondeterministic, two servers can apply the same log and produce different snapshots. If snapshot serialization drops a field, recovery may silently produce wrong state. If restore code fails to rebuild secondary indexes, the node may boot with state that looks current but behaves incorrectly.`,
        `Security and access control matter too. A snapshot may contain the entire replicated state: keys, tokens, metadata, or user data. It needs the same encryption, permission, deletion, and audit treatment as the live database files it represents.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Treat snapshot code as a first-class recovery path, not as background cleanup. Test crash points while writing a snapshot, while publishing it, while deleting covered log entries, while receiving chunks, and while installing on a follower. The hard bugs usually live in these boundary states.`,
        `Record and monitor snapshot index, snapshot term, snapshot size, log start index, log end index, replay time, install duration, transfer rate, checksum failures, and follower lag. These metrics tell you whether compaction is keeping recovery bounded or creating catch-up storms.`,
        `Keep snapshot and log suffix handling together in recovery tests. Restart from snapshot only. Restart from snapshot plus suffix. Install a snapshot on a follower that has conflicting later entries. Install a snapshot on a follower that has useful later entries. Verify that the state machine and boundary metadata are correct after each case.`,
        `Be careful with membership changes. A snapshot may include cluster configuration state. Restore and bootstrap procedures must not accidentally create two clusters with the same identity or bring back removed members as if they were current voters.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary source: Ongaro and Ousterhout, In Search of an Understandable Consensus Algorithm, available at https://raft.github.io/raft.pdf. Focus on log compaction, InstallSnapshot, the log-matching property, and the state-machine safety discussion.`,
        `Study Raft Leader Election for terms and leadership, Raft Log Replication for the log-matching property, Write-Ahead Log for durable append-first recovery, LSM Trees (How Cassandra Writes) for compaction as a storage pattern, MVCC Internals & VACUUM for safe cleanup of old versions, and Leader Replacement for why committed history must survive leadership changes.`,
      ],
    },
  ],
};
