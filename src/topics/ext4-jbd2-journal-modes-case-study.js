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
    { heading: 'How to read the animation', paragraphs: [
      'The animation follows a filesystem transaction through ext4 and JBD2. ext4 is a Linux filesystem, and JBD2 is its journaling layer: a journal is a log used to recover after a crash. Active nodes are blocks being written, found nodes are committed journal records, and compare nodes are home-location writes waiting to be checkpointed.',
      'The safe inference rule is commit-boundary recovery. If a transaction has a valid commit block, recovery can replay it; if the commit block is missing or invalid, recovery ignores it. File data durability is a separate promise from metadata consistency.',
        {type:'callout', text:'JBD2 makes crash recovery a commit-boundary problem: replay complete metadata transactions, ignore partial ones, and keep data ordering separate from application durability.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/65/Simplified_Structure_of_the_Linux_Kernel.svg', alt:'Diagram of Linux kernel layers showing file systems between the virtual file system and block device layer.', caption:'Simplified Linux kernel structure, showing where file systems sit between VFS and the block layer; ScotXW, Wikimedia Commons, CC BY-SA 4.0/GFDL.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'A filesystem update usually changes several metadata blocks. Creating a file can touch a directory entry, an inode, allocation bitmaps, timestamps, and quota records. If power fails after some of those writes reach disk and others do not, the disk can describe an impossible filesystem.',
      'JBD2 exists so ext4 can recover quickly to a coherent metadata state. Instead of scanning the whole disk for every possible inconsistency, recovery reads the journal and replays complete transactions. The goal is structural consistency after a crash, not a guarantee that every application write reached disk.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is in-place metadata updates. When a file grows, write the changed inode, extent tree, bitmap, and directory information directly to their home blocks. This avoids the extra journal write and is easy to reason about when the machine never crashes.',
      'Another obvious approach is full data journaling. Write both file data and metadata through the journal before anything reaches its final location. That is safer for crash behavior, but it doubles write traffic for file data and can be too slow for ordinary workloads.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is torn multi-block state. A single logical operation can be split across many physical disk writes, and storage may reorder or cache them. After a crash, ext4 cannot assume that related metadata blocks all reached disk together.',
      'The wall also includes write amplification. Journaling every byte of file data would make sequential writes pay for the journal write and the later checkpoint write. ext4 therefore needs modes that separate metadata recovery from file-data durability.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Make metadata changes transactional. A transaction records enough information in the journal to redo the metadata update, then writes a commit block as the recovery boundary. Later checkpointing copies the same metadata to its home location.',
      'The key distinction is metadata versus data. Metadata describes the filesystem shape; data is the file content. ext4 can keep metadata consistent while offering different data-ordering modes for different performance and safety needs.',
    ] },
    { heading: 'How it works', paragraphs: [
      'A JBD2 transaction begins with descriptor information that identifies affected blocks, followed by journaled metadata blocks or revocation records. A commit block marks the transaction complete. On mount after a crash, recovery replays complete transactions in order and ignores incomplete tails.',
      'In data=ordered mode, ext4 writes dirty file data blocks before committing metadata that points to them. In data=writeback mode, metadata can commit before related file data reaches disk, so old or uninitialized data exposure is the trade. In data=journal mode, both data and metadata pass through the journal before checkpointing.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'Correctness depends on the commit block. Recovery scans transactions and replays only those whose commit record and checksums are valid. That makes each metadata transaction atomic from the recovery point of view: it is either replayed as a unit or ignored.',
      'The ordering modes change what the filesystem promises about file contents. In ordered mode, metadata will not point to newly allocated blocks before the file data is sent to disk. That protects against some stale-data exposure but still does not replace fsync when the application needs its own data durable before acknowledging success.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Journaling cost behaves like extra writes plus flushes. If a rename changes 6 metadata blocks, those blocks are written to the journal and later checkpointed to their home locations. A storage flush around commit can dominate latency because the system must know the commit reached stable storage.',
      'The mode changes the write budget. For a 64 MB file write, data=journal can write roughly 64 MB through the journal and then 64 MB again to home locations, before metadata overhead. data=ordered journals metadata while ordering data writes, so it saves journal bandwidth but gives a weaker data guarantee.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'ext4 with JBD2 is common on Linux servers, laptops, embedded devices, and virtual machines. It fits general-purpose filesystems where fast crash recovery and metadata consistency matter more than full transactional file contents. The access pattern is ordinary file operations with occasional crashes or power loss.',
      'The modes let operators choose behavior. ordered is the default balance for many systems. journal can suit small critical files where safety beats throughput, while writeback can suit workloads that accept weaker post-crash data ordering for speed.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'JBD2 does not make application protocols correct. If a database writes a page and forgets fsync, ext4 may recover metadata while the database page itself is stale or partially updated. Applications that need transactions still need their own write-ahead log and flush discipline.',
      'It also fails to hide bad storage. Drives that lie about flush completion or lose volatile caches during power loss can break the assumptions behind commit records. Journaling is only as strong as the storage ordering and durability primitives underneath it.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Suppose creating a file touches 5 metadata blocks: one directory block, one inode table block, one block bitmap, one group descriptor, and one quota block. JBD2 writes those block images into a transaction and then writes a commit block. If the machine crashes after the commit block, recovery replays all 5 metadata changes.',
      'If the crash happens after only 3 of the 5 journaled blocks and no valid commit block exists, recovery ignores the transaction. The filesystem returns to the previous coherent state. That may lose the just-created file, but it should not leave a directory entry pointing to an uninitialized inode.',
      'Now add a 1 MB file data write in ordered mode. ext4 sends the data blocks toward disk before committing metadata that exposes the file size and block mapping. The application still calls fsync if it must know the 1 MB reached durable storage before reporting success.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Linux kernel documentation for ext4 JBD2 journaling, the ext4 man pages, and filesystem recovery discussions in kernel documentation. Read the sections on descriptor blocks, commit blocks, revocation blocks, and data modes.',
      'Study next: write-ahead logging, fsync, copy-on-write filesystems, database WAL design, block-layer flushes, and crash consistency testing. The durable lesson is that recovery guarantees come from explicit boundaries, not from hoping related writes land together.',
    ] },
  ],
};
