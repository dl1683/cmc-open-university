// Filesystem extents: logical file ranges map to physical block ranges, and
// delayed allocation waits until writeback to choose better contiguous blocks.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'filesystem-extent-tree-delayed-allocation',
  title: 'Filesystem Extent Tree & Delayed Allocation',
  category: 'Systems',
  summary: 'Extent-based filesystems map logical file ranges to physical block ranges, often delaying allocation until writeback can choose larger contiguous extents.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['extent map lookup', 'delayed allocation writeback'], defaultValue: 'extent map lookup' },
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

function extentGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'file', label: 'file', x: 0.8, y: 4.0, note: notes.file ?? 'logical blocks' },
      { id: 'cache', label: 'cache', x: 2.5, y: 4.0, note: notes.cache ?? 'dirty' },
      { id: 'emap', label: 'extent', x: 4.8, y: 4.0, note: notes.emap ?? 'logical to physical' },
      { id: 'inline', label: 'inline', x: 6.6, y: 2.0, note: notes.inline ?? 'few extents' },
      { id: 'tree', label: 'B+tree', x: 6.6, y: 6.0, note: notes.tree ?? 'many extents' },
      { id: 'free', label: 'free', x: 8.8, y: 2.0, note: notes.free ?? 'allocator' },
      { id: 'disk', label: 'disk', x: 8.8, y: 6.0, note: notes.disk ?? 'ranges' },
    ],
    edges: [
      { id: 'e-file-cache', from: 'file', to: 'cache', weight: '' },
      { id: 'e-cache-emap', from: 'cache', to: 'emap', weight: '' },
      { id: 'e-emap-inline', from: 'emap', to: 'inline', weight: 'small' },
      { id: 'e-emap-tree', from: 'emap', to: 'tree', weight: 'large' },
      { id: 'e-free-inline', from: 'free', to: 'inline', weight: '' },
      { id: 'e-free-tree', from: 'free', to: 'tree', weight: '' },
      { id: 'e-tree-disk', from: 'tree', to: 'disk', weight: '' },
      { id: 'e-inline-disk', from: 'inline', to: 'disk', weight: '' },
    ],
  }, { title });
}

function* extentMapLookup() {
  yield {
    state: extentGraph('Extents compress many block pointers into ranges'),
    highlight: { active: ['file', 'emap', 'inline', 'tree'], found: ['disk'] },
    explanation: 'An extent maps a contiguous logical file range to a contiguous physical block range. Instead of storing one pointer per block, the filesystem stores start, length, and destination.',
    invariant: 'Extent = logical start, physical start, length, plus state flags.',
  };

  yield {
    state: labelMatrix(
      'Logical blocks to physical extents',
      [
        { id: 'e0', label: '0..31' },
        { id: 'e1', label: '32..95' },
        { id: 'hole', label: '96..127' },
        { id: 'e2', label: '128..191' },
      ],
      [
        { id: 'physical', label: 'physical blocks' },
        { id: 'state', label: 'state' },
      ],
      [
        ['8000..8031', 'written'],
        ['12000..12063', 'written'],
        ['none', 'hole'],
        ['19000..19063', 'unwritten'],
      ],
    ),
    highlight: { active: ['e1:physical', 'e2:state'], compare: ['hole:state'] },
    explanation: 'Extent maps naturally represent sparse files, written ranges, and preallocated-but-unwritten ranges. A hole needs no physical blocks until data is written.',
  };

  yield {
    state: extentGraph('Small files can keep extents near the inode; fragmented files need a tree', { inline: 'inode slots', tree: 'extent B+tree', disk: 'many ranges' }),
    highlight: { active: ['inline', 'tree', 'emap'], compare: ['disk'] },
    explanation: 'Filesystems commonly keep a few extent records close to the inode. When a file grows or fragments past that small inline capacity, the mapping becomes a tree so lookup stays logarithmic.',
  };

  yield {
    state: labelMatrix(
      'Extent lookup versus older block maps',
      [
        { id: 'direct', label: 'direct blocks' },
        { id: 'indirect', label: 'indirect blocks' },
        { id: 'extent', label: 'extent map' },
        { id: 'btree', label: 'extent tree' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'best for' , label: 'best for' },
      ],
      [
        ['block pointers', 'tiny files'],
        ['pointer pages', 'old Unix growth'],
        ['ranges', 'contiguous files'],
        ['range index', 'large fragmented files'],
      ],
    ),
    highlight: { active: ['extent:stores', 'btree:stores'], compare: ['direct:stores'] },
    explanation: 'The data-structure move is compression by runs. If a 1 GB file occupies long contiguous ranges, an extent map can describe it with a handful of records instead of hundreds of thousands of block pointers.',
  };

  yield {
    state: extentGraph('fiemap exposes extent-like answers to user space', { file: 'fiemap', emap: 'walk ranges', tree: 'lookup', disk: 'reported extents' }),
    highlight: { active: ['file', 'emap', 'tree', 'disk'], found: ['inline'] },
    explanation: 'Linux fiemap is the user-facing idea: ask a filesystem which physical or logical extents back a file. The answer may include flags such as delayed, unknown, encoded, unwritten, or shared.',
  };
}

function* delayedAllocationWriteback() {
  yield {
    state: extentGraph('Buffered write dirties cache before physical blocks are chosen', { file: 'append 64 MB', cache: 'dirty', emap: 'delayed', free: 'not chosen', disk: 'old layout' }),
    highlight: { active: ['file', 'cache', 'emap'], compare: ['free', 'disk'] },
    explanation: 'Delayed allocation means the filesystem can accept dirty page-cache data without immediately assigning exact physical blocks. The logical range exists, but placement is postponed.',
    invariant: 'Delayed extents reserve intent before physical placement is final.',
  };

  yield {
    state: extentGraph('Writeback sees the full dirty range and asks for contiguous space', { cache: '64 MB batch', emap: 'convert', free: 'choose run', inline: 'new extent', disk: 'contiguous' }),
    highlight: { active: ['cache', 'emap', 'free', 'inline', 'disk', 'e-free-inline', 'e-inline-disk'] },
    explanation: 'At writeback time, the allocator has more context. Instead of allocating tiny chunks as each write arrives, it can choose a larger contiguous physical run and then convert the delayed extent into a real one.',
  };

  yield {
    state: labelMatrix(
      'Delayed allocation tradeoff',
      [
        { id: 'contiguity', label: 'contiguity' },
        { id: 'metadata', label: 'metadata' },
        { id: 'crash', label: 'crash window' },
        { id: 'fsync', label: 'fsync' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['larger extents', 'placement later'],
        ['fewer records', 'conversion work'],
        ['batching', 'must force data when needed'],
        ['explicit boundary', 'latency spike'],
      ],
    ),
    highlight: { active: ['contiguity:benefit', 'metadata:benefit'], compare: ['crash:cost', 'fsync:cost'] },
    explanation: 'Delayed allocation improves layout and reduces metadata churn, but it moves important work later. fsync, sync, memory pressure, or writeback can turn the postponed allocation into foreground latency.',
  };

  yield {
    state: extentGraph('Journaling protects metadata; fsync protects the user contract', { cache: 'dirty data', emap: 'extent update', tree: 'metadata', disk: 'data+metadata' }),
    highlight: { active: ['cache', 'emap', 'tree', 'disk'], found: ['free'] },
    explanation: 'Extent insertion, free-space updates, and inode size changes are metadata changes that journaling or logging protects. Applications still need fsync or a higher-level durability protocol when the file contents matter after a crash.',
  };

  yield {
    state: labelMatrix(
      'Filesystem examples',
      [
        { id: 'ext4', label: 'ext4' },
        { id: 'xfs', label: 'XFS' },
        { id: 'f2fs', label: 'F2FS' },
        { id: 'db', label: 'database file' },
      ],
      [
        { id: 'extent idea', label: 'extent idea' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['extents + delayed alloc', 'batch placement'],
        ['extent based + Btrees', 'scale metadata'],
        ['extent cache option', 'cache mappings'],
        ['preallocate carefully', 'avoid surprise stalls'],
      ],
    ),
    highlight: { active: ['ext4:lesson', 'xfs:lesson'], compare: ['db:lesson'] },
    explanation: 'The same pattern appears across filesystems: represent runs compactly, index them when needed, and delay decisions until the system has enough context to pick a better layout.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'extent map lookup') yield* extentMapLookup();
  else if (view === 'delayed allocation writeback') yield* delayedAllocationWriteback();
  else throw new InputError('Pick an extent-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An extent is a compact record for a contiguous run: logical file start, physical block start, length, and state. Extent-based filesystems use these records to map file offsets to disk blocks without storing one pointer per block.',
        'Delayed allocation postpones the exact physical block choice until writeback. The page cache can hold dirty data first, and the filesystem can later allocate larger contiguous extents with better global context.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Small files can keep a few extents close to the inode. Larger or fragmented files use an extent tree, often a B+tree-style structure, so logical block lookup stays efficient. Sparse holes require no physical blocks; unwritten extents can reserve space without exposing old disk contents as file data.',
        'During buffered writes, data becomes dirty in the page cache. With delayed allocation, the filesystem records that a logical range needs blocks but waits to choose physical placement. At writeback or fsync, it allocates physical extents, updates extent metadata, writes data, and journals or logs the metadata changes required for crash recovery.',
      ],
    },
    {
      heading: 'Case study: append-heavy file',
      paragraphs: [
        'An append-heavy workload that writes many small chunks can become one large dirty range. Immediate allocation might scatter blocks as chunks arrive. Delayed allocation lets writeback allocate a larger contiguous run, reducing extent count and improving later sequential reads. The cost is that allocation and metadata work may appear later as fsync or writeback latency.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Extent lookup is logarithmic when a tree is needed, and tiny when extents fit inline. The hard parts are fragmentation, crash consistency, free-space search, unwritten extent conversion, copy-on-write or shared extents, and making fsync mean what applications expect. Readahead & Dirty Writeback explains the page-cache pressure that often triggers this machinery.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'An extent map is not automatically durable user data. Filesystem journaling often protects metadata consistency, while application-visible durability still depends on fsync or an equivalent protocol. Another trap is assuming delayed allocation only improves performance; it can also move work into unlucky foreground operations if the dirty set grows too large.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ext4 block and inode allocator docs at https://docs.kernel.org/filesystems/ext4/allocators.html, fiemap extent flags at https://docs.kernel.org/filesystems/fiemap.html, XFS overview at https://docs.kernel.org/admin-guide/xfs.html, and XFS delayed logging design at https://docs.kernel.org/filesystems/xfs-delayed-logging-design.html. Study B-Trees, Interval Tree, Linux Page Cache XArray, Readahead & Dirty Writeback, fsync Rename Crash Consistency, ext4 JBD2 Journal Modes, Write-Ahead Log, and SQLite B-Tree & Pager next.',
      ],
    },
  ],
};
