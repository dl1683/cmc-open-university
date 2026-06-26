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
    { heading: 'How to read the animation', paragraphs: [
      'Read CURRENT as the pointer to the authoritative metadata log, MANIFEST as the durable log of file-set edits, VersionEdit as one metadata change, and VersionSet as the in-memory view reconstructed from those edits.',
      'Active nodes show the metadata operation being applied. Found nodes are files or versions made logically live, and removed nodes are files no longer part of the current version.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'RocksDB constantly creates and replaces immutable SSTables, or sorted string table files. A database directory can contain current files, old files pinned by readers, new compaction outputs, logs, and leftovers from interrupted work.',
      'The engine needs a durable answer to one question: which files form the current logical database. The MANIFEST answers that question by recording metadata edits, and VersionSet rebuilds the live file map from those committed edits.',
      {type:'callout', text:'RocksDB recovery works because MANIFEST records version edits as the durable source of truth, while VersionSet reconstructs the logical database from committed metadata.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious recovery approach is to list the directory and use every SSTable that exists. That fails because a compaction can create output files before the metadata edit that installs them.',
      'The opposite case also breaks directory scanning. A file may be obsolete in the newest version but still present because an old iterator or snapshot needs it.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is multi-file atomicity. Filesystems do not make a compaction output, several old-file removals, sequence metadata, and a current-version swap atomic as one database operation.',
      'A crash can happen after a new file is written but before it is committed, or after metadata is committed but before old files are deleted. Recovery needs an ordered metadata log so each window maps to an old valid state or a new valid state.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Separate physical files from logical membership. SSTables hold user data, while MANIFEST records which SSTables count at each level and under which metadata.',
      'CURRENT is a small pointer file naming the active MANIFEST. The MANIFEST is an append-only log of VersionEdit records, and VersionSet applies those records into immutable versions for readers and compaction.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A flush writes a new L0 SSTable, then appends a VersionEdit that adds that file. A compaction writes replacement SSTables, then appends a VersionEdit that adds the outputs and removes the inputs from the current version.',
      'On open, RocksDB reads CURRENT, opens the named MANIFEST, replays a base snapshot plus later edits, and rebuilds the current VersionSet. Checksums and record framing let recovery reject partial manifest records.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The design works by durable indirection. A file becomes live when committed metadata names it, becomes obsolete when a later committed version stops naming it, and becomes physically removable only when no pinned version can still observe it.',
      'Immutable versions make readers safe. A range scan can pin the version it started with while compaction installs a new current version.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is metadata logging, replay, and lifecycle bookkeeping. MANIFEST grows as edits are appended, so RocksDB may rotate to a new manifest containing a compacted snapshot of current metadata.',
      'Open time depends on how much manifest state must be replayed. Cleanup requires care because deleting the wrong physical file can destroy a still-pinned version.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'The same pattern appears in systems that publish immutable data through mutable metadata. Lakehouse table formats commit snapshots that name data files, search indexes publish new segment metadata, and backup catalogs name chunks.',
      'The general rule is to trust the manifest, catalog, or snapshot log over leftover files. Physical objects are ingredients; versioned metadata decides which ingredients form the current view.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when metadata and files disagree in ways recovery cannot repair. A live version naming a missing SSTable is a correctness failure, and manual deletion of files can create exactly that state.',
      'It also fails operationally when people confuse WAL and MANIFEST. The write-ahead log protects recent user writes, while MANIFEST protects the storage engine file map.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose the current version contains L0 files 10 and 11. A compaction reads them and writes a new L1 file 20. While file 20 is being written, it may already exist in the directory, but it is not part of the logical database.',
      'When compaction finishes, RocksDB appends a VersionEdit: add file 20 to L1 and delete files 10 and 11 from their current membership. If a crash happens before that edit is durable, recovery ignores file 20; if it happens after the edit, recovery includes file 20 even if files 10 and 11 still exist.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary source: RocksDB MANIFEST documentation at https://github.com/facebook/rocksdb/wiki/MANIFEST.',
      'Study Write-Ahead Log, SSTable Block Index and Filter, RocksDB LSM Case Study, LSM Compaction Strategies Primer, RocksDB Write Stalls and Compaction Debt, LSM Tombstones and Range Deletes, Copy-on-Write Snapshot Trees, and Delta Lake Transaction Log next.',
    ] },
  ],
};
