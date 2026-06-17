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
      heading: 'Why this exists',
      paragraphs: [
        'A filesystem has to answer a simple question quickly: for this byte range in a file, which physical storage blocks contain the data? Old block-map designs answered with one pointer per block or with layers of indirect pointer blocks. That works, but it wastes metadata when a large file is mostly contiguous. A one gigabyte file with four kilobyte blocks has more than two hundred thousand blocks. If those blocks sit in a few long runs, storing every pointer separately repeats information the system already knows.',
        'Extents exist to compress that repeated structure. An extent says that a logical run of file blocks maps to a physical run of disk blocks. The record stores a logical start, a physical start, a length, and state. Delayed allocation is the companion idea for writes. Instead of choosing physical blocks immediately for every buffered write, the filesystem can keep dirty data in memory and wait until writeback has enough context to pick larger contiguous runs.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The naive write path allocates blocks as soon as each write arrives. A process appends a few pages, the filesystem asks the allocator for blocks, records the block pointers, and moves on. This is easy to understand because every write gets a final home immediately. It fails under real workload pressure. Small appends from many files interleave, free space becomes chopped into small pieces, and the final layout of each file reflects scheduling accidents rather than file structure.',
        'The naive metadata structure is equally expensive. A pointer-per-block map treats a contiguous movie file, a sparse virtual disk image, and a badly fragmented log as if they need the same kind of description. Sparse files become awkward because missing ranges need special handling. Preallocation becomes awkward because blocks may be reserved before data exists. Large sequential reads spend extra work walking metadata that could have been described as a few runs.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is run-length compression for storage layout. Files are indexed by logical offsets, but storage devices allocate physical ranges. If logical blocks 0 through 1023 live at physical blocks 8000 through 9023, one extent can replace 1024 separate pointers. If the file later has a hole, an unwritten reservation, or a shared copy-on-write range, the same ordered range map can represent that state without inventing a separate structure for each case.',
        'Delayed allocation adds a timing insight. The first write is often the worst moment to choose placement because the filesystem sees only a tiny piece of the future file. During writeback it may see a much larger dirty range, current free-space state, neighboring allocations, and pressure from other files. Waiting does not make allocation free, but it often makes allocation better. The invariant is that the logical file state must remain correct even while physical placement is still pending.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'An extent map for a file is ordered by logical block number. Lookup begins with the requested logical offset. If the file has only a few extents, those records may fit near the inode. If the file grows or fragments, the mapping moves into a tree so lookup stays efficient. Filesystems such as ext4 and XFS use extent-based metadata because the common case is not random blocks everywhere. The common case is many runs, some written, some holes, some reserved, and some waiting for conversion.',
        'During a buffered write, data first lands in the page cache and the relevant pages become dirty. With delayed allocation, the filesystem records that the logical range has dirty data but may not assign exact physical blocks yet. Later, writeback, fsync, sync, or memory pressure forces the decision. The allocator searches free space, chooses a run or several runs, writes data, and converts delayed or unwritten extent state into written extent state. Metadata updates then record the new map.',
        'Crash consistency requires more than the extent lookup algorithm. The filesystem must update extent records, free-space accounting, inode size, timestamps, and sometimes journal or log entries. It must also avoid exposing stale old disk contents through preallocated but unwritten ranges. That is why many filesystems distinguish written extents from unwritten extents. An unwritten extent reserves space, but reads should return zeros until real data has been committed into that range.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The extent-map view proves that a file layout is a range map. Written data, holes, and unwritten reservations are not separate stories; they are states attached to logical intervals. The reason a tree appears is scale. A tiny file can keep a few records inline, but a large fragmented file needs indexed range lookup. The data structure changes shape while the contract stays the same: map a logical interval to a state and, when present, to physical storage.',
        'The delayed-allocation view proves that allocation time is a design choice. The dirty page-cache range exists before physical blocks are chosen. The important transition is conversion: delayed logical state becomes physical extents during writeback. That transition is where the allocator can improve contiguity, but it is also where latency and durability questions become visible.',
      ],
    },
    {
      heading: 'Why it works and what it costs',
      paragraphs: [
        'Extents work because many storage layouts have locality. Sequential writes, large media files, database segment files, package archives, VM images, and object-store cache files often occupy runs. Even when a file is not perfectly contiguous, it may still have far fewer extents than blocks. Fewer metadata records means smaller inode metadata, cheaper scans, simpler readahead decisions, and less pointer chasing during sequential I/O.',
        'Delayed allocation works because batching improves placement. If an application writes sixty-four megabytes through the page cache, allocating one page at a time gives the allocator a narrow view. Allocating during writeback lets the filesystem request a larger run. It can also merge adjacent dirty ranges, reduce metadata churn, and avoid allocating blocks for data that is overwritten or truncated before writeback.',
        'The cost is complexity moved later. fsync can become slower because it must force allocation, data writeout, and metadata durability that earlier writes postponed. Memory pressure can turn background decisions into foreground stalls. Free-space fragmentation still exists, especially on full filesystems. Copy-on-write filesystems add shared extent references and reference counting. Thin provisioning and network storage can add another layer where physical placement is not fully under the filesystem control.',
      ],
    },
    {
      heading: 'Real uses and failure modes',
      paragraphs: [
        'Extents are used in mainstream filesystems such as ext4 and XFS, and related extent ideas appear in copy-on-write filesystems, flash filesystems, and user-space tools that inspect layout. fiemap exposes extent-like answers to user space so tools can ask what ranges back a file and whether those ranges are delayed, unwritten, shared, encoded, or unknown. Databases care about these details when they preallocate files, manage fsync latency, or try to avoid fragmentation in write-ahead logs and table files.',
        'The common failure is misunderstanding durability. Metadata journaling can protect the extent tree and allocator state, but that does not automatically mean recently written user data survives a crash unless the application uses the right sync protocol. Another failure is assuming delayed allocation always improves performance. It improves layout when there is room and workload locality. It can hurt latency when a critical fsync must do all postponed work. It can also surprise applications that infer disk allocation from file size rather than from sync and allocation calls.',
        'Space exhaustion is another edge case. Delayed allocation lets a write appear accepted while exact blocks are not chosen yet, so the filesystem must reserve enough space or report errors at sync and close boundaries in a disciplined way. Full disks, quotas, thin devices, and overcommit policies make that accounting part of the correctness story, not just a performance detail.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study B-Trees for the indexed extent shape, Interval Tree for range maps, Linux Page Cache XArray for dirty page tracking, Readahead and Dirty Writeback for the flush path, ext4 JBD2 Journal Modes for crash behavior, fsync Rename Crash Consistency for the application contract, Write-Ahead Log for a database view of durability, and SQLite B-Tree and Pager for a storage engine that owns its page map directly. Primary references include the Linux ext4 allocator documentation, Linux fiemap documentation, XFS administration documentation, and the XFS delayed logging design notes.',
      ],
    },
  ],
};
