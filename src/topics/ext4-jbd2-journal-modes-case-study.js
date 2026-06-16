// ext4/JBD2 journaling: metadata transactions, ordered data writeout,
// writeback mode, journal mode, commit records, and recovery replay.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'ext4-jbd2-journal-modes-case-study',
  title: 'ext4 JBD2 Journal Modes',
  category: 'Systems',
  summary: 'How ext4 groups metadata transactions through JBD2, orders data writes, commits journal records, and trades speed against crash-consistency guarantees.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ordered commit', 'mode tradeoffs'], defaultValue: 'ordered commit' },
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

function journalGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 4.8, note: notes.app ?? 'write' },
      { id: 'cache', label: 'cache', x: 2.2, y: 4.8, note: notes.cache ?? 'dirty data' },
      { id: 'data', label: 'data', x: 3.9, y: 6.4, note: notes.data ?? 'file blocks' },
      { id: 'meta', label: 'meta', x: 3.9, y: 3.0, note: notes.meta ?? 'inode/extents' },
      { id: 'jbd2', label: 'JBD2', x: 5.6, y: 3.0, note: notes.jbd2 ?? 'txn' },
      { id: 'journal', label: 'log', x: 7.1, y: 3.0, note: notes.journal ?? 'commit' },
      { id: 'home', label: 'home', x: 7.1, y: 6.4, note: notes.home ?? 'final place' },
      { id: 'replay', label: 'replay', x: 8.8, y: 4.8, note: notes.replay ?? 'after crash' },
    ],
    edges: [
      { id: 'e-app-cache', from: 'app', to: 'cache', weight: '' },
      { id: 'e-cache-data', from: 'cache', to: 'data', weight: '' },
      { id: 'e-cache-meta', from: 'cache', to: 'meta', weight: '' },
      { id: 'e-meta-jbd2', from: 'meta', to: 'jbd2', weight: '' },
      { id: 'e-jbd2-journal', from: 'jbd2', to: 'journal', weight: '' },
      { id: 'e-data-home', from: 'data', to: 'home', weight: '' },
      { id: 'e-journal-home', from: 'journal', to: 'home', weight: '' },
      { id: 'e-journal-replay', from: 'journal', to: 'replay', weight: '' },
    ],
  }, { title });
}

function* orderedCommit() {
  yield {
    state: journalGraph('Buffered writes dirty file data and metadata'),
    highlight: { active: ['app', 'cache', 'data', 'meta', 'e-app-cache', 'e-cache-data', 'e-cache-meta'], compare: ['journal'] },
    explanation: 'A file update can dirty data blocks plus metadata such as inode size, extent records, directory entries, allocation bitmaps, and timestamps.',
    invariant: 'The journal mainly protects filesystem metadata consistency.',
  };

  yield {
    state: journalGraph('JBD2 groups metadata into a transaction', { jbd2: 'txn N', meta: 'metadata set', journal: 'descriptor' }),
    highlight: { active: ['meta', 'jbd2', 'journal', 'e-meta-jbd2', 'e-jbd2-journal'], compare: ['data'] },
    explanation: 'JBD2 is the journaling layer ext4 uses for metadata transactions. It writes enough journal information that recovery can complete or discard a transaction consistently.',
  };

  yield {
    state: journalGraph('data=ordered writes data before committing metadata', { data: 'write first', journal: 'commit after', home: 'safe order' }),
    highlight: { active: ['data', 'home', 'journal', 'e-data-home', 'e-jbd2-journal'], found: ['jbd2'] },
    explanation: 'In the common ordered mode, ext4 journals metadata, but it writes associated data blocks before the metadata commit reaches the journal. That avoids metadata pointing at uninitialized old contents after recovery.',
  };

  yield {
    state: journalGraph('Recovery replays committed metadata transactions', { journal: 'committed', replay: 'redo meta', home: 'consistent fs' }),
    highlight: { active: ['journal', 'replay', 'home', 'e-journal-replay', 'e-journal-home'], compare: ['app'] },
    explanation: 'After a crash, committed transactions can be replayed so the filesystem metadata returns to a consistent state. Uncommitted partial transactions are ignored.',
  };

  yield {
    state: labelMatrix(
      'What ordered mode gives',
      [
        { id: 'meta', label: 'metadata' },
        { id: 'data', label: 'data' },
        { id: 'name', label: 'rename' },
        { id: 'fsync', label: 'fsync' },
      ],
      [
        { id: 'promise', label: 'promise' },
        { id: 'gap', label: 'gap' },
      ],
      [
        ['consistent', 'not app txn'],
        ['before meta', 'not fsynced'],
        ['atomic op', 'dir fsync'],
        ['force path', 'latency'],
      ],
    ),
    highlight: { active: ['meta:promise', 'data:promise', 'fsync:promise'], compare: ['name:gap'] },
    explanation: 'Journaling keeps the filesystem structure consistent. Application-level durability still depends on fsync, directory fsync, database WAL, or another explicit protocol.',
  };
}

function* modeTradeoffs() {
  yield {
    state: labelMatrix(
      'ext4 data modes',
      [
        { id: 'ordered', label: 'ordered' },
        { id: 'writeback', label: 'writeback' },
        { id: 'journal', label: 'journal' },
        { id: 'fast', label: 'fast commit' },
      ],
      [
        { id: 'logs', label: 'logs' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['metadata', 'data first'],
        ['metadata', 'less ordering'],
        ['data+meta', 'more I/O'],
        ['delta meta', 'lower latency'],
      ],
    ),
    highlight: { active: ['ordered:tradeoff', 'journal:logs'], compare: ['writeback:tradeoff'] },
    explanation: 'The mode changes how data blocks relate to metadata commits. ordered is the common middle ground; writeback loosens ordering; journal writes data through the journal too.',
    invariant: 'Journal mode choice changes crash semantics and write amplification.',
  };

  yield {
    state: journalGraph('data=writeback can commit metadata without the same data ordering', { data: 'later', journal: 'metadata commit', home: 'riskier view' }),
    highlight: { active: ['meta', 'jbd2', 'journal', 'e-meta-jbd2', 'e-jbd2-journal'], compare: ['data', 'home'] },
    explanation: 'writeback mode can be faster in some cases, but it gives up the ordered-mode rule that associated data blocks reach disk before metadata commit.',
  };

  yield {
    state: journalGraph('data=journal writes data and metadata through the journal', { data: 'journaled', meta: 'journaled', journal: 'data+meta', home: 'checkpoint later' }),
    highlight: { active: ['data', 'meta', 'jbd2', 'journal', 'home', 'e-jbd2-journal', 'e-journal-home'], found: ['cache'] },
    explanation: 'journal mode logs both data and metadata, improving some crash semantics at the cost of more journal traffic and different performance constraints.',
  };

  yield {
    state: journalGraph('Fast commits log a compact metadata delta when possible', { jbd2: 'fast delta', journal: 'small commit', replay: 'apply delta' }),
    highlight: { active: ['meta', 'jbd2', 'journal', 'replay', 'e-meta-jbd2', 'e-jbd2-journal', 'e-journal-replay'], compare: ['data'] },
    explanation: 'Recent ext4 can use fast commits in ordered mode for eligible metadata changes, storing a compact delta rather than forcing a full traditional transaction every time.',
  };

  yield {
    state: journalGraph('The complete case is appending to a log file', { app: 'append', cache: 'dirty', data: 'new bytes', meta: 'size+extent', journal: 'commit', replay: 'recover' }),
    highlight: { active: ['app', 'cache', 'data', 'meta', 'jbd2', 'journal', 'home', 'replay'], found: ['e-data-home'] },
    explanation: 'A log append changes data and inode metadata. ext4 keeps filesystem metadata recoverable, while the application still decides whether each append needs fsync or can rely on periodic durability.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ordered commit') yield* orderedCommit();
  else if (view === 'mode tradeoffs') yield* modeTradeoffs();
  else throw new InputError('Pick an ext4 journal view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'ext4 uses the JBD2 journaling layer to make filesystem metadata updates crash-consistent. A transaction can include inode, extent, bitmap, directory, and other metadata changes. Recovery replays committed transactions and ignores incomplete ones.',
        'The Linux kernel ext4 docs describe data=ordered as journaling metadata while writing associated data blocks before metadata commit, and the JBD2 docs explain journal structure and fast commits: https://docs.kernel.org/admin-guide/ext4.html and https://docs.kernel.org/filesystems/ext4/journal.html.',
      ],
    },
    {
      heading: 'Core data structure',
      paragraphs: [
        'A journal transaction has descriptor records, metadata buffers, a commit record, and later checkpointing into home locations. Ordered mode ties data writeout to the metadata transaction so newly committed metadata does not expose stale block contents.',
        'The journal is not the same as a database WAL for user transactions. It protects filesystem structures. Applications that need their own transaction semantics still use fsync, directory fsync, SQLite journals, PostgreSQL WAL, or another higher-level protocol.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A process appends to a file. The data blocks become dirty in the page cache, and inode size or extent metadata changes join a JBD2 transaction. In ordered mode, ext4 writes the data blocks before committing the metadata transaction. After a crash, committed metadata can be replayed into a consistent filesystem.',
        'If the application prints saved before fsync, that is still an application-level durability decision. ext4 may keep the filesystem coherent while the last user-level write is absent after crash recovery.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Filesystem journaling is not a substitute for application fsync. It is possible for the filesystem to be consistent while the application-level latest state is not durable. Atomic rename also needs directory fsync when the name update itself is part of the durable contract.',
        'data=journal is not simply better. It changes write amplification, feature interactions, and latency. data=ordered is the common balance because it protects metadata consistency while avoiding full data journaling for every write.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ext4 admin guide at https://docs.kernel.org/admin-guide/ext4.html, ext4 journal docs at https://docs.kernel.org/filesystems/ext4/journal.html, JBD2 API docs at https://docs.kernel.org/filesystems/journalling.html, and ext4 allocators at https://docs.kernel.org/filesystems/ext4/allocators.html. Study fsync Rename Crash Consistency, Filesystem Extent Tree & Delayed Allocation, Readahead & Dirty Writeback, Linux Page Cache XArray, Write-Ahead Log, and SQLite B-Tree & Pager next.',
      ],
    },
  ],
};
