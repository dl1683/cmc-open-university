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
        'ext4 uses JBD2, the Journaling Block Device layer, to make filesystem metadata recoverable after a crash. File operations do not change one isolated record. Creating, extending, truncating, linking, or renaming a file can touch directory entries, inode fields, extent trees, allocation bitmaps, block group descriptors, timestamps, and quota state. If power fails halfway through those updates, the disk can contain a mixture that no longer describes a valid filesystem.',
        'The journal is a redo log for those related metadata changes. ext4 can write a transaction to the journal, mark it committed, and later checkpoint the same changes to their normal home locations. On restart, recovery replays committed transactions and ignores incomplete ones. The result is not that every application write is durable. The result is that the filesystem structure can return to a coherent state quickly.',
      ],
    },
    {
      heading: 'The real problem',
      paragraphs: [
        'The naive filesystem would update metadata in place: allocate blocks, edit the bitmap, update the inode size and extent tree, insert the directory entry, and write everything to its final disk location. That is simple until failure lands in the middle. A directory entry can point at an inode whose initialization did not finish. An inode can claim blocks that the allocation bitmap still thinks are free. A file size can expose blocks whose new contents were never written.',
        'A crash-consistency mechanism must answer two questions after reboot. Which groups of metadata changes were complete enough to keep? Which partial groups must be ignored? ext4 also needs a data-ordering rule for the common case where metadata points at newly written file data. Otherwise recovery could leave a structurally valid filesystem whose metadata points at stale or uninitialized block contents.',
      ],
    },
    {
      heading: 'Core insight and mechanism',
      paragraphs: [
        'JBD2 groups dirty metadata buffers into transactions. A transaction is written to the journal with records that describe the modified blocks and a commit record that marks the transaction complete. After the commit is durable, checkpointing can copy the metadata from the journal to the normal filesystem locations. If the system crashes before checkpointing, replay can redo the committed transaction. If it crashes before the commit record is complete, recovery drops the partial transaction.',
        'The common ext4 mode is data=ordered. In that mode ext4 journals metadata but does not journal normal file data. Instead, it orders the associated data blocks so they reach disk before the metadata commit that could expose them. That rule prevents a recovered inode or extent from pointing at old garbage for a newly written block. It is a filesystem ordering guarantee, not a promise that the application transaction reached durable storage unless the application used fsync or an equivalent protocol.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the ordered-commit view, follow one buffered file update as it splits into file data and metadata. The data blocks go toward their home location. The metadata buffers enter a JBD2 transaction and then the journal. The important highlighted transition is the ordering gate: in data=ordered mode, associated data must be written before the metadata commit can make those new references recoverable.',
        'In the mode-tradeoffs view, read the table as three different contracts. data=ordered journals metadata and orders data before metadata commit. data=writeback journals metadata but does not provide the same data-before-metadata ordering. data=journal sends both data and metadata through the journal, increasing write amplification while changing crash behavior. The fast-commit frame shows a newer optimization: when eligible, ext4 can log a compact metadata delta instead of a full traditional transaction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Consider an append. The new bytes are dirty in the page cache. The inode size may change. An extent may be added. Allocation bitmaps may be updated. ext4 attaches the metadata buffers to the running journal transaction. When the transaction closes, JBD2 writes descriptor information and metadata contents to the journal, then writes the commit record. Later, checkpointing writes the committed metadata to its home locations so journal space can be reused.',
        'Recovery is intentionally mechanical. Scan the journal. Find transactions with valid commit records. Replay their metadata updates to the home filesystem. Ignore incomplete transactions. Because replay is based on journaled metadata blocks, the filesystem can repair its own structure without running a full fsck over every relationship. The Linux kernel ext4 docs describe the data modes, and the journal docs describe JBD2 transaction structure and fast commits: https://docs.kernel.org/admin-guide/ext4.html and https://docs.kernel.org/filesystems/ext4/journal.html.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The journal works because it converts many in-place metadata writes into one recoverable decision. The commit record is the decision boundary. If the commit record made it, recovery has enough information to redo the transaction. If it did not, recovery has a clear reason to discard it. That avoids guessing from a half-updated inode, bitmap, or directory entry.',
        'Ordered mode adds the missing dependency between data and metadata. Metadata that exposes new blocks should not commit before those blocks have been written. This avoids a common stale-data exposure after recovery. It still does not make a user-level operation atomic. A database, editor, package manager, or mail server must use fsync, directory fsync after rename when needed, write-ahead logging, or a higher-level transaction protocol to define its own durable boundary.',
      ],
    },
    {
      heading: 'Mode tradeoffs',
      paragraphs: [
        'data=ordered is the normal compromise. It journals metadata, orders associated data before metadata commit, and avoids writing every data block through the journal. That gives good metadata recovery with less write amplification than full data journaling. The cost is commit latency when dirty data must be forced out before metadata can safely commit.',
        'data=writeback loosens the data-ordering rule. It can reduce ordering pressure but permits weaker post-crash data contents for recently written files. data=journal writes both data and metadata to the journal before checkpointing, which can improve some crash semantics but increases journal traffic and changes performance behavior. Fast commits reduce latency for eligible metadata-only deltas, but they are an optimization inside the same correctness story, not a replacement for the journal.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A service appends one line to a log file. The bytes enter the page cache. ext4 may allocate a new block and update the inode size or extent tree. In data=ordered mode, the data block associated with that metadata must be written before the metadata transaction commits. JBD2 commits the metadata transaction to the journal. Later, checkpointing moves those metadata updates into their home locations.',
        'Now crash the machine at three different times. If the crash happens before commit, recovery ignores the incomplete metadata transaction. If it happens after commit but before checkpoint, recovery replays the metadata. If the application returned "saved" before calling fsync, the filesystem can still recover cleanly while the last application-level record is missing. That distinction is the central lesson: ext4 journaling protects filesystem consistency; application durability is a separate protocol.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most common mistake is believing that journaling means recent file contents are safely durable. It means the filesystem can recover its own metadata. Applications that need "save means durable" still need to flush the file and, for rename-based replacement patterns, often the containing directory. Databases still need WAL or another transaction log because their invariants live above the filesystem metadata layer.',
        'Another mistake is assuming the strongest-looking mode is always best. data=journal increases write amplification and can interact badly with workload shape. data=writeback may be acceptable for some workloads but weakens data exposure guarantees. Mount options, barriers, storage write-cache behavior, and whether the device honestly reports flush completion all matter. A journal cannot compensate for storage that lies about durability.',
      ],
    },
    {
      heading: 'Useful contexts',
      paragraphs: [
        'JBD2 journaling matters for ordinary filesystem operations: file creation, unlink, rename, append, truncate, chmod, directory updates, extent allocation, and mount-time recovery after sudden power loss. General-purpose systems need the filesystem to come back mountable quickly without asking every application to repair inode and directory structure by hand.',
        'It also teaches the same pattern used in databases and storage systems: write intent to a recoverable log, mark a clear commit point, replay committed work, and ignore partial work. The details differ from PostgreSQL WAL or SQLite journaling, but the core idea is the same. Crash recovery needs an authoritative history that is safer than scattered in-place updates.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ext4 admin guide at https://docs.kernel.org/admin-guide/ext4.html, ext4 journal docs at https://docs.kernel.org/filesystems/ext4/journal.html, JBD2 API docs at https://docs.kernel.org/filesystems/journalling.html, and ext4 allocators at https://docs.kernel.org/filesystems/ext4/allocators.html.',
        'Study fsync Rename Crash Consistency, Filesystem Extent Tree & Delayed Allocation, Readahead & Dirty Writeback, Linux Page Cache XArray, Write-Ahead Log, SQLite B-Tree & Pager, PostgreSQL WAL Checkpoint & Recovery, and Transaction Savepoint Stack next.',
      ],
    },
  ],
};
