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
    explanation: 'RocksDB cannot recover the latest consistent file set by scanning random directory state alone. CURRENT points to the latest MANIFEST, and the MANIFEST records state changes as VersionEdit records.',
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
    explanation: 'A version edit is small metadata: add this file to a level, delete that file, advance sequence numbers, or change column-family metadata. Replaying edits constructs the VersionSet.',
  };

  yield {
    state: manifestGraph('A compaction installs a new version', { edit: '+new -old', version: 'next', l0: 'old', l1: 'new', compact: 'merge' }),
    highlight: { active: ['compact', 'edit', 'version', 'e-compact-edit', 'e-edit-version'], found: ['l1'], removed: ['l0'] },
    explanation: 'A compaction reads input SSTables and writes new output SSTables. The storage engine then appends a version edit that adds the new files and removes the old inputs from the live set.',
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
    explanation: 'Readers and iterators may still need an older version while compaction creates the next one. That is why file deletion waits until no pinned version can reference the old files.',
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
    explanation: 'The manifest layer turns messy filesystem operations into a recoverable metadata log. That is the same durability idea as WAL, applied to database state rather than row updates.',
  };
}

function* crashRecovery() {
  yield {
    state: recoveryGraph('Recovery starts with CURRENT'),
    highlight: { active: ['open', 'current', 'manifest', 'e-open-current', 'e-current-manifest'], compare: ['files'] },
    explanation: 'On restart, RocksDB reads CURRENT to find the latest MANIFEST file. The manifest contains a snapshot and subsequent edits sufficient to rebuild the latest known consistent state.',
    invariant: 'Recovery follows the pointer first; random leftover files are not automatically live.',
  };

  yield {
    state: recoveryGraph('Replay turns snapshot plus edits into VersionSet', { snapshot: 'base V', edits: 'edits', version: 'current' }),
    highlight: { active: ['manifest', 'snapshot', 'edits', 'version', 'e-manifest-snapshot', 'e-manifest-edits', 'e-snapshot-version', 'e-edits-version'], found: ['files'] },
    explanation: 'A rolling manifest may begin with a complete snapshot of the state, then append version edits. Replaying that sequence reconstructs levels, file metadata, sequence numbers, and column-family state.',
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
    explanation: 'The order matters. New data files can exist before they are named in the manifest. Old manifest logs are removed only after CURRENT safely points to the new manifest.',
  };

  yield {
    state: manifestGraph('Compaction output becomes live only through metadata', { current: 'ptr', manifest: 'append', edit: 'atomic', version: 'swap', compact: 'done' }),
    highlight: { active: ['compact', 'edit', 'manifest', 'version', 'e-compact-edit', 'e-manifest-edit'], found: ['l1', 'l2'] },
    explanation: 'The durable step is not the mere existence of an output file. The durable step is the manifest edit that makes that output file part of the current version and removes obsolete input files.',
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
    explanation: 'MANIFEST connects local files to engine correctness. It is the bridge between immutable SSTables, compaction scheduling, reader snapshots, and safe deletion of obsolete files.',
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
      heading: 'What it is',
      paragraphs: [
        'RocksDB MANIFEST is a transactional metadata log for database state. User data lives in SST files and logs. The manifest records which SST files are live, which levels they belong to, which files were removed by compaction, and enough metadata to rebuild a consistent VersionSet after a crash.',
        'This matters because filesystem operations are not a database transaction. A crash can leave new files, old files, partial work, and stale directory contents. The manifest gives the engine one durable story about what state should be trusted.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'CURRENT is a small pointer file naming the latest MANIFEST log. A manifest log contains VersionEdit records. Each edit mutates a logical Version: add this SST file to a level, delete that SST file, advance sequence metadata, or update column-family state. Replaying edits reconstructs the current version.',
        'During compaction, RocksDB writes new SST output files and then appends a version edit that makes those files live while removing the old inputs. Existing readers can pin an older version, so obsolete files are physically deleted only after no live reader can still reference them.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'MANIFEST adds metadata I/O, log validation, rolling manifest management, CURRENT pointer updates, and cleanup rules. That complexity buys crash recovery: the engine does not need to infer correctness from whatever files happen to be in the directory after an unclean restart.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The RocksDB MANIFEST documentation frames the manifest as the mechanism for overcoming non-atomic filesystem state changes. When a manifest grows, RocksDB can create a new manifest containing a snapshot of current state, update CURRENT to point at it, sync the update, and then purge redundant manifest logs.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse WAL with MANIFEST. WAL protects recent user writes. MANIFEST protects storage-engine metadata: file membership, levels, and versions. Also do not assume any SST file in the directory is live; a file becomes part of the database only when the current version names it.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: RocksDB MANIFEST documentation at https://github.com/facebook/rocksdb/wiki/MANIFEST. Study Write-Ahead Log, SSTable Block Index & Filter, RocksDB LSM Case Study, LSM Compaction Strategies Primer, RocksDB Write Stalls & Compaction Debt, and LSM Tombstones & Range Deletes next.',
      ],
    },
  ],
};
