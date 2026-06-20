// RocksDB MANIFEST and VersionSet: durable metadata for which SST files are
// live at each level, updated through version edits and CURRENT pointer swaps.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rocksdb-manifest-version-set-case-study',
  title: 'RocksDB MANIFEST & VersionSet',
  category: 'Systems',
  summary: 'A metadata-log case study: CURRENT points to MANIFEST, MANIFEST replays VersionEdit records, and VersionSet names the live SSTables after crashes and compactions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['version edits', 'crash recovery'], defaultValue: 'version edits' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function manifestGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'current', label: 'CUR', x: 0.65, y: 4.0, note: notes.current ?? 'CURRENT' },
      { id: 'manifest', label: 'MAN', x: 2.3, y: 4.0, note: notes.manifest ?? 'log' },
      { id: 'edit', label: 'edit', x: 4.0, y: 2.5, note: notes.edit ?? '+/- file' },
      { id: 'version', label: 'version', x: 4.0, y: 5.5, note: notes.version ?? 'state' },
      { id: 'l0', label: 'L0', x: 6.2, y: 2.0, note: notes.l0 ?? 'overlap' },
      { id: 'l1', label: 'L1', x: 6.2, y: 4.0, note: notes.l1 ?? 'sorted' },
      { id: 'l2', label: 'L2+', x: 6.2, y: 6.0, note: notes.l2 ?? 'large' },
      { id: 'compact', label: 'compact', x: 8.6, y: 4.0, note: notes.compact ?? 'new edit' },
    ],
    edges: [
      { id: 'e-current-manifest', from: 'current', to: 'manifest', weight: '' },
      { id: 'e-manifest-edit', from: 'manifest', to: 'edit', weight: '' },
      { id: 'e-edit-version', from: 'edit', to: 'version', weight: '' },
      { id: 'e-version-l0', from: 'version', to: 'l0', weight: '' },
      { id: 'e-version-l1', from: 'version', to: 'l1', weight: '' },
      { id: 'e-version-l2', from: 'version', to: 'l2', weight: '' },
      { id: 'e-compact-edit', from: 'compact', to: 'edit', weight: '' },
      { id: 'e-compact-l1', from: 'compact', to: 'l1', weight: '' },
      { id: 'e-compact-l2', from: 'compact', to: 'l2', weight: '' },
    ],
  }, { title });
}

function recoveryGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'open', label: 'open', x: 0.6, y: 4.0, note: notes.open ?? 'restart' },
      { id: 'current', label: 'CUR', x: 2.2, y: 4.0, note: notes.current ?? 'latest' },
      { id: 'manifest', label: 'MAN', x: 3.9, y: 4.0, note: notes.manifest ?? 'replay' },
      { id: 'snapshot', label: 'base', x: 5.6, y: 2.4, note: notes.snapshot ?? 'state' },
      { id: 'edits', label: 'edits', x: 5.6, y: 5.6, note: notes.edits ?? 'delta' },
      { id: 'version', label: 'version', x: 7.5, y: 4.0, note: notes.version ?? 'rebuilt' },
      { id: 'files', label: 'files', x: 9.1, y: 4.0, note: notes.files ?? 'live set' },
    ],
    edges: [
      { id: 'e-open-current', from: 'open', to: 'current', weight: '' },
      { id: 'e-current-manifest', from: 'current', to: 'manifest', weight: '' },
      { id: 'e-manifest-snapshot', from: 'manifest', to: 'snapshot', weight: '' },
      { id: 'e-manifest-edits', from: 'manifest', to: 'edits', weight: '' },
      { id: 'e-snapshot-version', from: 'snapshot', to: 'version', weight: '' },
      { id: 'e-edits-version', from: 'edits', to: 'version', weight: '' },
      { id: 'e-version-files', from: 'version', to: 'files', weight: '' },
    ],
  }, { title });
}

function* versionEdits() {
  yield {
    state: manifestGraph('MANIFEST is the metadata log for live SST files'),
    highlight: { active: ['current', 'manifest', 'edit', 'version', 'e-current-manifest', 'e-manifest-edit', 'e-edit-version'], found: ['l0', 'l1', 'l2'] },
    explanation: 'The graph starts with the recovery problem: directory contents alone are not a trustworthy database state. CURRENT names the latest MANIFEST, and the MANIFEST records file-set changes as VersionEdit records.',
    invariant: 'Data files hold user data; MANIFEST holds the durable map of which data files count.',
  };

  yield {
    state: labelMatrix(
      'VersionEdit record roles',
      [
        { id: 'add', label: 'AddFile' },
        { id: 'delete', label: 'DelFile' },
        { id: 'seq', label: 'seq nums' },
        { id: 'cf', label: 'col fam' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'why', label: 'why' },
      ],
      [
        ['new SST', 'include file'],
        ['old SST', 'drop file'],
        ['bounds', 'replay order'],
        ['scope', 'many trees'],
      ],
    ),
    highlight: { active: ['add:meaning', 'delete:meaning'], found: ['seq:why'] },
    explanation: 'The VersionEdit table shows that metadata is the commit point for files. AddFile, DelFile, sequence bounds, and column-family state are enough to replay a consistent VersionSet.',
  };

  yield {
    state: manifestGraph('A compaction installs a new version', { edit: '+new -old', version: 'next', l0: 'old', l1: 'new', compact: 'merge' }),
    highlight: { active: ['compact', 'edit', 'version', 'e-compact-edit', 'e-edit-version'], found: ['l1'], removed: ['l0'] },
    explanation: 'The compaction graph separates file creation from file membership. New SSTables may exist on disk, but they become database state only when the manifest edit installs the next version.',
  };

  yield {
    state: labelMatrix(
      'Why versions are immutable',
      [
        { id: 'reader', label: 'reader' },
        { id: 'iter', label: 'iterator' },
        { id: 'compact', label: 'compact' },
        { id: 'cleanup', label: 'cleanup' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'rule', label: 'rule' },
      ],
      [
        ['stable view', 'pin version'],
        ['range scan', 'keep files'],
        ['new output', 'new version'],
        ['delete files', 'after pins'],
      ],
    ),
    highlight: { found: ['reader:rule', 'iter:rule'], active: ['cleanup:rule'] },
    explanation: 'The immutable-version table explains safe deletion. Readers and iterators can pin an older version while compaction installs a new one, so obsolete files wait until no live view can still reference them.',
  };

  yield {
    state: labelMatrix(
      'Metadata is not optional',
      [
        { id: 'dir', label: 'dir scan' },
        { id: 'current', label: 'CURRENT' },
        { id: 'manifest', label: 'MANIFEST' },
        { id: 'version', label: 'VersionSet' },
      ],
      [
        { id: 'promise', label: 'promise' },
        { id: 'failure', label: 'failure' },
      ],
      [
        ['all files?', 'stale output'],
        ['one pointer', 'bad update'],
        ['edit log', 'corrupt log'],
        ['live files', 'pinned old'],
      ],
    ),
    highlight: { active: ['current:promise', 'manifest:promise'], compare: ['dir:failure'] },
    explanation: 'The metadata table is the core analogy. WAL records user-data changes; MANIFEST records storage-engine state changes. Both turn crash-prone operations into replayable logs.',
  };
}

function* crashRecovery() {
  yield {
    state: recoveryGraph('Recovery starts with CURRENT'),
    highlight: { active: ['open', 'current', 'manifest', 'e-open-current', 'e-current-manifest'], compare: ['files'] },
    explanation: 'Recovery follows the pointer first. RocksDB reads CURRENT, opens the named MANIFEST, and replays the snapshot plus edits needed to rebuild the latest consistent version.',
    invariant: 'Recovery follows the pointer first; random leftover files are not automatically live.',
  };

  yield {
    state: recoveryGraph('Replay turns snapshot plus edits into VersionSet', { snapshot: 'base V', edits: 'edits', version: 'current' }),
    highlight: { active: ['manifest', 'snapshot', 'edits', 'version', 'e-manifest-snapshot', 'e-manifest-edits', 'e-snapshot-version', 'e-edits-version'], found: ['files'] },
    explanation: 'The replay graph shows why a manifest can roll forward efficiently. A base snapshot plus later edits reconstructs levels, file metadata, sequence numbers, and column-family state without scanning random files.',
  };

  yield {
    state: labelMatrix(
      'Crash windows',
      [
        { id: 'newfile', label: 'new SST' },
        { id: 'edit', label: 'edit append' },
        { id: 'current', label: 'CURRENT' },
        { id: 'purge', label: 'purge old' },
      ],
      [
        { id: 'ifCrash', label: 'if crash' },
        { id: 'safeRule', label: 'safe rule' },
      ],
      [
        ['orphan file', 'not live yet'],
        ['partial edit', 'checksum/log'],
        ['old pointer', 'use old MAN'],
        ['after sync', 'then delete'],
      ],
    ),
    highlight: { active: ['newfile:safeRule', 'current:safeRule'], compare: ['purge:ifCrash'] },
    explanation: 'The crash-window table is about ordering. A new SST can be an orphan until named; a partial edit can be rejected; an old CURRENT pointer can keep the old manifest valid; purging happens only after the new pointer is safe.',
  };

  yield {
    state: manifestGraph('Compaction output becomes live only through metadata', { current: 'ptr', manifest: 'append', edit: 'atomic', version: 'swap', compact: 'done' }),
    highlight: { active: ['compact', 'edit', 'manifest', 'version', 'e-compact-edit', 'e-manifest-edit'], found: ['l1', 'l2'] },
    explanation: 'This view repeats the most important rule: the durable step is not file existence. The durable step is the manifest edit that makes new files live and removes old files from the current version.',
  };

  yield {
    state: labelMatrix(
      'Study links',
      [
        { id: 'wal', label: 'WAL' },
        { id: 'sst', label: 'SSTable' },
        { id: 'lsm', label: 'LSM' },
        { id: 'tomb', label: 'tombstones' },
      ],
      [
        { id: 'shared', label: 'shared idea' },
        { id: 'next', label: 'next link' },
      ],
      [
        ['durable log', 'commit data'],
        ['file handles', 'data layout'],
        ['levels', 'compaction'],
        ['drop safety', 'range delete'],
      ],
    ),
    highlight: { found: ['wal:shared', 'sst:next', 'tomb:next'], active: ['lsm:next'] },
    explanation: 'The study links show why MANIFEST sits between many topics. It ties WAL-style logging, SSTable layout, LSM compaction, tombstone cleanup, reader snapshots, and obsolete-file deletion into one correctness layer.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'version edits') yield* versionEdits();
  else if (view === 'crash recovery') yield* crashRecovery();
  else throw new InputError('Pick a MANIFEST view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `RocksDB is an LSM-tree storage engine. It does not update one large file in place. It writes memtables to new SSTables, compacts overlapping files into replacement files, moves data between levels, and eventually deletes obsolete files. At any moment the database directory can contain current files, old files still pinned by readers, newly written compaction outputs, log files, metadata files, and leftovers from interrupted work.`,
        `The engine therefore needs a durable answer to a deceptively simple question: which SSTables are part of the current database state? The answer cannot be guessed from filenames alone. It has to include levels, key ranges, sequence number bounds, column families, compaction results, and reader-visible snapshots. The MANIFEST and VersionSet are the mechanism that turns a messy directory into a coherent logical database.`,
        `This is a metadata problem, not a user-data problem. SSTables hold keys and values. The write-ahead log protects recent writes that have not yet reached stable SSTables. The MANIFEST protects the storage engine's map of live files. Without that map, recovery would not know which immutable files are committed, which are obsolete, and which were never installed.`,
        {type:'callout', text:`RocksDB recovery works because MANIFEST records version edits as the durable source of truth, while VersionSet reconstructs the logical database from committed metadata.`},
      ],
    },
    {
      heading: 'Why a directory scan fails',
      paragraphs: [
        `The obvious recovery idea is to list the directory, find every SSTable, and rebuild the tree from whatever exists. That is unsafe. A compaction can create output files before the metadata edit that installs them. If a crash happens in that window, the output files may exist but should not be visible to readers. Directory existence is not the same as commit.`,
        `The opposite case also matters. A file can be logically obsolete in the newest version but still physically present because an old iterator has pinned a previous version. Deleting it immediately would break the reader. A directory scan sees the file but cannot know whether it is current, pinned, orphaned, or safe to remove.`,
        `Partial metadata writes create another problem. Filesystems do not make an arbitrary set of SSTable creations, deletions, and metadata updates atomic as one database operation. RocksDB needs a small ordered log that can be replayed, checked, and ignored safely when incomplete. The MANIFEST exists to encode those storage-engine decisions explicitly.`,
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        `CURRENT is a small pointer file. It names the active MANIFEST. The MANIFEST is an append-only metadata log. Its records are VersionEdits: add this file to this level, delete that file from that level, record sequence-number state, record column-family state, and carry enough file metadata to reconstruct a consistent view.`,
        `A Version is an immutable in-memory view of the live files at each level. VersionSet owns the chain of versions and the bookkeeping needed to install a new current version while older versions may remain pinned. On open, RocksDB reads CURRENT, opens the named MANIFEST, replays the stored snapshot and edits, and rebuilds the VersionSet.`,
        `The commit point for file membership is the manifest edit, not the creation of the file. A new SSTable written by compaction is just a file until a VersionEdit adds it. An old SSTable is no longer part of the current version only after a VersionEdit removes it. Physical deletion comes later, after the engine knows no pinned version still needs the file.`,
      ],
    },
    {
      heading: 'Version edits as commits',
      paragraphs: [
        `A VersionEdit is small compared with the SSTables it names, but it is the durable metadata transaction. During flush, it can add a newly created L0 file. During compaction, it can add replacement files and delete input files from the current version. During column-family changes, it can record metadata needed to scope later file membership correctly.`,
        `This split is what lets RocksDB perform expensive work outside the commit point. A compaction can spend time reading old SSTables and writing new ones. Only after the outputs are complete does the engine append the edit that installs them. If the process crashes before the edit is durable, recovery should not treat those output files as part of the database.`,
        `The same idea protects deletion. Removing a file from the current version is a metadata decision. Physically unlinking the file is a separate cleanup decision. That separation is essential because old versions can remain visible to readers, backups, or iterators even after a new current version has been installed.`,
      ],
    },
    {
      heading: 'Immutable versions and readers',
      paragraphs: [
        `Readers need stable views. If a range scan begins while one set of files is current, compaction cannot rewrite the world underneath that iterator and delete the old files immediately. RocksDB solves this by making versions immutable. A reader pins the Version it is using. Compaction creates a new Version and installs it as current, but the old Version can remain alive until the reader releases it.`,
        `This is similar in spirit to multi-version concurrency control. The current version moves forward, but older versions are retained long enough to satisfy promises already made to readers. File deletion is therefore a garbage-collection problem. A file removed from the newest version becomes physically deletable only when no live version references it.`,
        `The VersionSet is the structure that makes this lifecycle manageable. It tracks the current version, older pinned versions, file reference counts, compaction inputs and outputs, and metadata needed for recovery. The MANIFEST records enough of those transitions to rebuild the important state after a restart.`,
      ],
    },
    {
      heading: 'Crash recovery',
      paragraphs: [
        `Recovery starts with CURRENT. The pointer tells RocksDB which MANIFEST is authoritative. The engine does not treat the newest-looking file or the largest manifest number as automatically correct. It follows the pointer, because the pointer is the durable choice of metadata log.`,
        `The MANIFEST can contain a snapshot of a version plus later edits. Replaying it reconstructs the current file set, level layout, sequence metadata, and column-family state. Checksums and record framing let recovery stop or reject partial records rather than accepting torn metadata as a real database state.`,
        `The crash windows are intentionally ordered. A new SSTable can be created before it is live. A manifest edit can be appended before obsolete files are deleted. CURRENT can continue pointing to an older manifest if a manifest switch did not complete. Cleanup happens after the metadata path is safe. This ordering turns many crash cases into either old state or new state, not a guessed mixture.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose the current version has L0 files 10 and 11. A compaction reads those files and writes a new L1 file 20. While compaction is writing, file 20 may already exist in the database directory. It is still not part of the database's logical state. The old version with files 10 and 11 remains current.`,
        `When the compaction finishes, RocksDB appends a VersionEdit that says add file 20 to L1 and delete files 10 and 11 from their previous membership. Once that edit is durable and installed, a new Version becomes current. New readers should use file 20 instead of the old inputs. Old readers that pinned the old Version may still need files 10 and 11.`,
        `If a crash happens before the edit, recovery follows the MANIFEST and ignores file 20 as orphaned output. If a crash happens after the edit is durable, recovery includes file 20 in the rebuilt VersionSet. If cleanup had not yet deleted files 10 and 11, they may still be physically present, but they are not part of the recovered current version unless some recovered state names them.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `When diagnosing a RocksDB directory, separate physical existence from logical membership. A file can exist and be orphaned. A file can be obsolete but not yet deleted. A file can be required by a pinned version even if it is not in the newest version. The authoritative question is whether the file is named by the recovered VersionSet or by another protected engine mechanism.`,
        `Check the metadata path before drawing conclusions from file counts. Inspect CURRENT, the named MANIFEST, replay status, column-family metadata, live-file listings, pending compactions, snapshots, iterators, backups, and obsolete-file deletion state. A sudden increase in files might be compaction debt, a long-lived snapshot, disabled cleanup, or real leakage. The MANIFEST helps distinguish those cases.`,
        `Watch manifest size and rotation. An append-only metadata log can grow. RocksDB can create a new manifest containing a compacted snapshot of the current metadata and then update CURRENT. That process itself has crash windows, so the same pointer-and-log discipline applies. A large manifest may slow open time; an incorrect manifest can threaten correctness.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The most serious failures involve disagreement between metadata and files. If a live Version names an SSTable that is missing or corrupted, reads can fail. If cleanup deletes a file that is still pinned by a reader, an iterator can break. If recovery accepts a partial or corrupt manifest record, the rebuilt file set can be wrong. These are correctness failures, not ordinary performance issues.`,
        `Another class of failures comes from confusing WAL and MANIFEST responsibilities. The WAL is about recent user writes and memtable recovery. The MANIFEST is about file membership and storage-engine structure. A healthy WAL does not tell the engine which compaction outputs were installed. A healthy MANIFEST does not contain every recent user write that was still only in the WAL.`,
        `Operationally, the common symptoms are slow open from a huge manifest, disk growth from obsolete files that cannot be deleted, missing-file errors after manual directory cleanup, confusion around column-family metadata, and compaction outputs mistaken for committed files. Manual repair actions should be conservative because deleting the wrong physical file can destroy a version that is still logically required.`,
      ],
    },
    {
      heading: 'Why the design works',
      paragraphs: [
        `The design works by making metadata changes replayable and by making file views immutable. A VersionEdit is small enough to log durably. A Version is stable enough for readers. CURRENT is small enough to act as an authoritative pointer. Together, they replace filesystem guesswork with a sequence of storage-engine decisions that can be rebuilt after a crash.`,
        `The proof idea is durable indirection. User data is stored in immutable files, but membership is stored in a log. A file becomes live when the metadata names it. A file becomes obsolete when a later version stops naming it. A file becomes physically removable only when no protected version can still observe it. Each state transition has a different meaning, and the system preserves those distinctions.`,
        `This is why MANIFEST belongs beside WAL in the mental model of an LSM database. WAL gives the engine a path to recover recent writes. MANIFEST gives the engine a path to recover its own file map. Both are logs, but they log different facts at different layers.`,
      ],
    },
    {
      heading: 'Where the pattern matters',
      paragraphs: [
        `The same idea appears in many systems that coordinate immutable data files through mutable metadata. Lakehouse table formats commit snapshots that name data files. Search indexes build new segments and then publish metadata. Backup catalogs name chunks. Object-store systems often commit manifests because object creation and deletion are not one atomic database transaction.`,
        `The lesson is broad: never infer committed state only from leftover files when the system has a manifest, catalog, or metadata log. The durable manifest is the source of truth. Physical files are ingredients. The versioned metadata decides which ingredients form the current view and which are old, orphaned, or waiting for cleanup.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary source: RocksDB MANIFEST documentation at https://github.com/facebook/rocksdb/wiki/MANIFEST. The useful framing is that MANIFEST records metadata edits because filesystem operations across many files are not one atomic database transaction, and CURRENT names the manifest that recovery should trust.`,
        `Within this curriculum, study Write-Ahead Log to separate user-data durability from metadata durability, SSTable Block Index and Filter to understand what the live files contain, RocksDB LSM Case Study for the broader write path, LSM Compaction Strategies Primer for why files are constantly replaced, RocksDB Write Stalls and Compaction Debt for operational pressure, and LSM Tombstones and Range Deletes for deletion semantics inside the files that VersionSet names.`,
      ],
    },
  ],
};
