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
  const extentNodes = ['file', 'cache', 'emap', 'inline', 'tree', 'free', 'disk'];
  const extentEdges = ['e-file-cache', 'e-cache-emap', 'e-emap-inline', 'e-emap-tree', 'e-free-inline', 'e-free-tree', 'e-tree-disk', 'e-inline-disk'];
  yield {
    state: extentGraph('Extents compress many block pointers into ranges'),
    highlight: { active: ['file', 'emap', 'inline', 'tree'], found: ['disk'] },
    explanation: `An extent maps a contiguous logical file range to a contiguous physical block range. The ${extentNodes.length}-node graph shows how, instead of storing one pointer per block, the filesystem stores start, length, and destination across ${extentEdges.length} edges.`,
    invariant: `Each extent record among the ${extentNodes.length} nodes encodes: logical start, physical start, length, plus state flags.`,
  };

  const extents = [
    { id: 'e0', label: '0..31', state: 'written' },
    { id: 'e1', label: '32..95', state: 'written' },
    { id: 'hole', label: '96..127', state: 'hole' },
    { id: 'e2', label: '128..191', state: 'unwritten' },
  ];
  const holes = extents.filter(e => e.state === 'hole');
  const written = extents.filter(e => e.state === 'written');
  yield {
    state: labelMatrix(
      'Logical blocks to physical extents',
      extents.map(({ id, label }) => ({ id, label })),
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
    explanation: `${extents.length} extent records describe the file: ${written.length} written, ${holes.length} hole, and ${extents.length - written.length - holes.length} unwritten. Holes need no physical blocks until data is written.`,
  };

  yield {
    state: extentGraph('Small files can keep extents near the inode; fragmented files need a tree', { inline: 'inode slots', tree: 'extent B+tree', disk: 'many ranges' }),
    highlight: { active: ['inline', 'tree', 'emap'], compare: ['disk'] },
    explanation: `Filesystems commonly keep a few extent records close to the inode (the '${extentNodes[3]}' path). When a file grows past that capacity — like our ${extents.length} extents — the mapping becomes a tree (the '${extentNodes[4]}' path) so lookup stays logarithmic.`,
  };

  const mapStyles = [
    { id: 'direct', label: 'direct blocks' },
    { id: 'indirect', label: 'indirect blocks' },
    { id: 'extent', label: 'extent map' },
    { id: 'btree', label: 'extent tree' },
  ];
  yield {
    state: labelMatrix(
      'Extent lookup versus older block maps',
      mapStyles,
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
    explanation: `Across ${mapStyles.length} mapping styles, the data-structure move is compression by runs. If a 1 GB file occupies long contiguous ranges, an extent map can describe it with a handful of records instead of hundreds of thousands of block pointers.`,
  };

  yield {
    state: extentGraph('fiemap exposes extent-like answers to user space', { file: 'fiemap', emap: 'walk ranges', tree: 'lookup', disk: 'reported extents' }),
    highlight: { active: ['file', 'emap', 'tree', 'disk'], found: ['inline'] },
    explanation: `Linux fiemap is the user-facing idea: ask a filesystem which physical or logical extents back a file. The ${extentNodes.length}-node model maps to answers that may include flags such as delayed, unknown, encoded, unwritten, or shared.`,
  };
}

function* delayedAllocationWriteback() {
  const writeSize = '64 MB';
  const pipelineStages = ['file', 'cache', 'emap', 'free', 'disk'];
  yield {
    state: extentGraph('Buffered write dirties cache before physical blocks are chosen', { file: `append ${writeSize}`, cache: 'dirty', emap: 'delayed', free: 'not chosen', disk: 'old layout' }),
    highlight: { active: ['file', 'cache', 'emap'], compare: ['free', 'disk'] },
    explanation: `Delayed allocation means the filesystem can accept ${writeSize} of dirty page-cache data without immediately assigning physical blocks. Only ${3} of ${pipelineStages.length} stages are active — the logical range exists, but placement is postponed.`,
    invariant: `Delayed extents reserve intent across ${pipelineStages.length} stages before physical placement is final.`,
  };

  yield {
    state: extentGraph('Writeback sees the full dirty range and asks for contiguous space', { cache: '64 MB batch', emap: 'convert', free: 'choose run', inline: 'new extent', disk: 'contiguous' }),
    highlight: { active: ['cache', 'emap', 'free', 'inline', 'disk', 'e-free-inline', 'e-inline-disk'] },
    explanation: `At writeback time, all ${pipelineStages.length} stages become active. Instead of allocating tiny chunks as each write arrives, the allocator can choose a larger contiguous physical run for the full ${writeSize} batch and convert the delayed extent into a real one.`,
  };

  const tradeoffs = [
    { id: 'contiguity', label: 'contiguity' },
    { id: 'metadata', label: 'metadata' },
    { id: 'crash', label: 'crash window' },
    { id: 'fsync', label: 'fsync' },
  ];
  yield {
    state: labelMatrix(
      'Delayed allocation tradeoff',
      tradeoffs,
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
    explanation: `Delayed allocation has ${tradeoffs.length} tradeoffs: ${tradeoffs.map(t => t.label).join(', ')}. It improves layout and reduces metadata churn, but moves important work later — fsync, sync, memory pressure, or writeback can turn the postponed allocation into foreground latency.`,
  };

  yield {
    state: extentGraph('Journaling protects metadata; fsync protects the user contract', { cache: 'dirty data', emap: 'extent update', tree: 'metadata', disk: 'data+metadata' }),
    highlight: { active: ['cache', 'emap', 'tree', 'disk'], found: ['free'] },
    explanation: `Extent insertion, free-space updates, and inode size changes are metadata changes across ${pipelineStages.length} pipeline stages that journaling or logging protects. Applications still need fsync or a higher-level durability protocol when the file contents matter after a crash.`,
  };

  const fsExamples = [
    { id: 'ext4', label: 'ext4' },
    { id: 'xfs', label: 'XFS' },
    { id: 'f2fs', label: 'F2FS' },
    { id: 'db', label: 'database file' },
  ];
  yield {
    state: labelMatrix(
      'Filesystem examples',
      fsExamples,
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
    explanation: `The same pattern appears across ${fsExamples.length} examples (${fsExamples.map(f => f.label).join(', ')}): represent runs compactly, index them when needed, and delay decisions until the system has enough context to pick a better layout.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. "Extent map lookup" shows a file\'s logical block range being resolved to physical disk blocks through an extent tree. "Delayed allocation writeback" shows dirty pages sitting in the page cache, then being flushed to disk as the allocator picks contiguous physical runs. Watch the extent records: each one maps a logical start to a physical start plus a length, replacing many individual block pointers with a single range description.',
        {type: 'image', src: './assets/gifs/filesystem-extent-tree-delayed-allocation.gif', alt: 'Animated walkthrough of the filesystem extent tree delayed allocation visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Color changes mark state transitions. When a range moves from "delayed" to "written," the allocator has committed physical blocks. When a range shows as "unwritten," space is reserved but no user data has been flushed there yet, so reads return zeros.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every filesystem must answer one question fast: given byte offset N in this file, which physical block on disk holds that byte? The oldest answer is a flat list of block pointers stored in the file\'s inode (the on-disk record that describes one file). A 1 GB file using 4 KB blocks needs 262,144 pointers. If those blocks happen to sit in three contiguous runs on disk, 262,144 pointers are saying the same thing over and over: "next block is one higher."',
        {type: 'callout', text: 'Extents compress the common case: long logical file ranges that already live in long physical storage runs.'},
        'An extent replaces that repetition with a single record: logical start, physical start, length, and a state flag. Three extents can describe the same 1 GB file that previously needed a quarter-million pointers. Delayed allocation is the companion idea. Instead of picking physical blocks the instant an application calls write(), the filesystem keeps dirty data in RAM and waits until writeback. By the time writeback runs, the filesystem sees a larger picture of the file and can request bigger contiguous runs from the allocator.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest design gives each file a flat array of block pointers. Block 0 of the file maps to pointer slot 0, block 1 maps to slot 1, and so on. When the array overflows the inode, you add indirect blocks: a pointer in the inode points to a block full of pointers, and for very large files you add double- and triple-indirect blocks. Unix FFS, ext2, and ext3 all used this scheme.',
        'For writes, the obvious approach allocates a physical block immediately when write() is called. The allocator picks whatever free block is handy, records the pointer, and returns. This means every write gets a permanent home right away, which is simple to reason about for crash recovery.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Flat pointer lists hit a metadata wall. A 10 GB database file at 4 KB block size requires 2,621,440 pointers. Reading them sequentially to plan readahead is slow. Updating them during defragmentation is expensive. Storing them takes significant inode and indirect-block space. Worse, the structure cannot distinguish between a hole (a region of the file that was never written and should return zeros), an unwritten reservation (space the filesystem pre-reserved but has not filled), and a written range. Every case looks like "pointer or no pointer."',
        'Immediate allocation hits a placement wall. When ten processes each append to their own log file, their write() calls interleave. The allocator sees one-block requests from each file in round-robin order and sprinkles each file\'s blocks across the disk. A file that the application wrote sequentially ends up physically fragmented. Later sequential reads must seek back and forth instead of streaming through a contiguous run.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'An extent is run-length encoding applied to block maps. Instead of listing every block pointer, you store ranges. The record (logical_start=0, physical_start=8000, length=1024) replaces 1,024 separate pointers with one 12-byte tuple. Holes, unwritten reservations, and written data are all just ranges with different state flags in the same sorted map. No separate structure is needed for any of them.',
        {type: 'image', src: 'https://teaching.csse.uwa.edu.au/units/CITS2002/lectures/lecture15/images/f12.11.png', alt: 'Indexed file allocation diagram with multilevel block portions', caption: 'Indexed allocation shows the older pointer-heavy shape that extent trees try to compress for long runs. Source: CITS2002 Systems Programming, University of Western Australia, https://teaching.csse.uwa.edu.au/units/CITS2002/lectures/lecture15/singlepage.html.'},
        'Delayed allocation adds a second insight: the best time to choose physical placement is not when write() is called, but when writeback flushes dirty pages. At write time the filesystem sees a single small request. At writeback time it sees the full dirty range, knows the current free-space map, and can ask the allocator for a large contiguous run. The write() call still succeeds immediately because data lives in the page cache (an in-RAM copy of file pages). Physical placement is deferred, not lost.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each file\'s extent map is sorted by logical block number. A small file might need only 3-4 extents, which fit directly in the inode\'s inline storage (ext4 stores up to 4 extents inline). When the file grows or fragments beyond that, the extents spill into a B-tree keyed by logical block number. Lookup is a standard tree search: find the leaf whose key range contains the target logical block, then read the extent record to get the physical block.',
        'On a buffered write, the kernel copies user data into the page cache and marks those pages dirty. With delayed allocation enabled, the filesystem notes that logical blocks N through N+K need space but does not call the block allocator yet. It reserves enough free blocks to guarantee the write can eventually succeed, but the exact physical location stays undecided.',
        'Writeback is triggered by one of four events: the periodic flush daemon (every 30 seconds by default on Linux), an explicit fsync() or sync() call, memory pressure reclaiming pages, or the dirty-page ratio exceeding a threshold. At that point the allocator receives a request for the full dirty range. It searches the free-space bitmap or tree, picks the best contiguous run it can find, writes the data, and records the extent as "written." If the run could not be fully contiguous, it creates multiple extents.',
        'Unwritten extents handle preallocation. When an application calls fallocate() to reserve 500 MB, the filesystem allocates physical blocks and records them as "unwritten." Any read to that range returns zeros. Once the application writes real data and that data is flushed, the extent state flips to "written." This prevents stale data exposure: without the unwritten flag, a reader could see whatever old data happened to be on those physical blocks.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Extents work because real files have spatial locality. A video file written sequentially lands in a few long physical runs. A database segment preallocated with fallocate() is one giant extent. Even a log file that grows by appending tends to get contiguous blocks when the disk is not nearly full. The ratio of extents to blocks is typically 1:hundreds or 1:thousands, so the metadata shrinks by orders of magnitude compared to pointer-per-block maps.',
        'Delayed allocation works because batching reveals structure. A process writing 64 MB through small write() calls generates thousands of individual requests. If the allocator sees them one at a time, it makes thousands of independent placement decisions. If it sees them as one 64 MB dirty range at writeback, it makes one decision and gets a single contiguous extent. The filesystem also avoids allocating blocks for data that is overwritten or truncated before writeback ever runs, saving both I/O and metadata updates.',
        'The B-tree shape keeps lookup at O(log N) in the number of extents. Since the number of extents is far smaller than the number of blocks, this is fast even for large fragmented files. A file with 10,000 extents (representing millions of blocks) needs a tree only 3-4 levels deep.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup costs O(log E) where E is the number of extents. For a perfectly contiguous file, E = 1 and lookup is O(1). For a badly fragmented file with millions of extents, the tree grows, but E is still far less than the block count B, so O(log E) beats O(log B) by a wide margin.',
        'Insertion of a new extent is also O(log E) for the tree update. If the new extent is adjacent to an existing one with the same state, the filesystem merges them by extending the length field, keeping E small. Splitting an extent (e.g., when a write punches into the middle of an unwritten range) creates at most two new extent records.',
        'The main cost is deferred complexity. fsync() after delayed-allocation writes must do three things that were postponed: allocate physical blocks, flush dirty pages, and commit a journal transaction. A workload that calls write() a thousand times and then fsync() once pays the full allocation and I/O cost in that single fsync(). If the application needs low-latency durability guarantees, delayed allocation moves work to the worst possible moment.',
        'Memory cost during the delay window is the dirty page cache itself. A process writing 1 GB before any writeback holds 1 GB of dirty pages in RAM. The kernel\'s dirty-page limits (dirty_ratio, dirty_background_ratio) bound this, but a burst of writes can still cause memory pressure and force synchronous writeback, converting a background optimization into a foreground stall.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ext4 uses an extent tree with up to 4 inline extents per inode and a B-tree for overflow. Delayed allocation is enabled by default. XFS has used extent-based allocation since its creation in the early 1990s and pioneered delayed allocation on Linux. Btrfs uses extents within its copy-on-write B-tree, adding reference counting so that cloned files share extents until one side is modified.',
        'The fiemap ioctl lets user-space tools query a file\'s extent map. Tools like filefrag and e4defrag use it to report fragmentation or plan defragmentation. Database engines (PostgreSQL, MySQL/InnoDB) care about extent layout because their write-ahead log and tablespace files benefit from sequential physical layout. Some databases call fallocate() to pre-reserve extents, then write into unwritten space, converting it to written on flush.',
        'Flash storage (SSDs) adds a twist: the device\'s flash translation layer (FTL) remaps physical addresses internally, so "contiguous on disk" does not always mean "contiguous on flash." Even so, extent-based allocation reduces metadata overhead and simplifies readahead decisions regardless of the underlying media.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Delayed allocation can lose data on crash. If a process calls write(), the data enters the page cache but has no physical home yet. If the machine crashes before writeback, that data is gone. This is correct behavior (POSIX does not guarantee durability without fsync), but it surprised application developers who assumed that a successful write() meant data was safe. The ext4 "zero-length file" bug in 2008-2009 was exactly this: applications that renamed a new file over an old one without calling fsync() lost both files on crash because delayed allocation had not flushed the new file\'s data.',
        'High fragmentation defeats extents. A filesystem at 95% capacity has little contiguous free space. The allocator breaks writes into many small runs, creating many extents per file. The metadata savings disappear, and the extent tree grows large. Defragmentation tools can rewrite files into contiguous runs, but they need free space to do so, creating a chicken-and-egg problem on nearly full disks.',
        'Thin-provisioned or network-backed storage adds another failure mode. The filesystem thinks it has reserved blocks, but the underlying storage pool may be overcommitted. A write that the filesystem accepted can fail at flush time with an I/O error because the pool ran out of real space. The filesystem must propagate this error to the application, but the write() call returned success long ago.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A process creates a new file and writes 16 MB sequentially in 4 KB write() calls (4,096 calls total). With immediate allocation, each call triggers a block-allocator request. If other processes are also writing, the allocator interleaves their blocks. The file might end up with 200 extents averaging 80 KB each. Its extent tree needs multiple leaf nodes.',
        'With delayed allocation, all 4,096 pages land in the page cache as dirty. The filesystem reserves 4,096 free blocks but picks no physical locations. When writeback runs, it sees a single 16 MB dirty range. The allocator searches the free-space bitmap and finds a 16 MB contiguous hole starting at physical block 500,000. It writes all 4,096 pages in one streaming I/O and creates one extent: (logical=0, physical=500000, length=4096, state=written). The extent tree is a single inline record in the inode.',
        'Now the process calls fallocate() to preallocate another 16 MB. The allocator picks physical blocks 504,096 through 508,191 and records the extent as (logical=4096, physical=504096, length=4096, state=unwritten). The file now has two extents, both inline. Any read to the preallocated region returns zeros. When the process later writes 8 MB into the middle of that preallocated range (logical blocks 6144 through 8191), writeback splits the unwritten extent into three pieces: unwritten (4096-6143), written (6144-8191), unwritten (8192-8191). The file now has four extents, still fitting inline in the inode.',
        'The total metadata for this 32 MB file is four extent records of 12 bytes each: 48 bytes. Under pointer-per-block allocation, the same file would need 8,192 pointers of 4 bytes each: 32,768 bytes, plus indirect blocks to hold them. The extent approach uses 0.15% of the metadata space.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The ext4 extent tree design is documented in the kernel source at fs/ext4/extents.c and in the ext4 disk layout documentation on kernel.org. The XFS delayed allocation design is described in Dave Chinner\'s XFS delayed logging design document. The 2008-2009 ext4 data loss discussion is archived on the linux-kernel and ext4 mailing lists, with Ted Ts\'o\'s analysis of the rename/fsync interaction.',
        'Study B-Trees next for the tree structure that indexes extents when there are too many for inline storage. Study Interval Trees for the general range-map data structure. For the write path, study the Linux Page Cache and dirty writeback mechanism. For crash consistency, study journaling (ext4 JBD2) and the fsync contract. For a database perspective on owning the block map directly, study SQLite\'s B-Tree and Pager layer.',
      ],
    },
  ],
};
