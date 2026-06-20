// Linux page cache as a data-structure case study: file offsets map through an
// address_space XArray to cached folios, with dirty/writeback state attached.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'linux-page-cache-xarray-case-study',
  title: 'Linux Page Cache XArray',
  category: 'Systems',
  summary: 'Linux indexes cached file folios by file offset through an address_space XArray, then tracks clean, dirty, writeback, and reclaim states around it.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['file offset lookup', 'dirty tags and reclaim'], defaultValue: 'file offset lookup' },
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

function pageCacheGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'process', label: 'proc', x: 0.7, y: 4.0, note: notes.process ?? 'read/write' },
      { id: 'vfs', label: 'VFS', x: 2.2, y: 4.0, note: notes.vfs ?? 'file ops' },
      { id: 'mapping', label: 'mapping', x: 4.0, y: 4.0, note: notes.mapping ?? 'inode' },
      { id: 'xarray', label: 'XArray', x: 6.0, y: 4.0, note: notes.xarray ?? 'idx to folio' },
      { id: 'f0', label: 'folio 0', x: 8.4, y: 1.7, note: notes.f0 ?? 'clean' },
      { id: 'f1', label: 'folio 1', x: 8.4, y: 3.3, note: notes.f1 ?? 'uptodate' },
      { id: 'f2', label: 'folio 2', x: 8.4, y: 4.9, note: notes.f2 ?? 'missing' },
      { id: 'disk', label: 'disk', x: 8.4, y: 6.5, note: notes.disk ?? 'backing store' },
      { id: 'lru', label: 'LRU', x: 6.0, y: 6.5, note: notes.lru ?? 'reclaim' },
    ],
    edges: [
      { id: 'e-process-vfs', from: 'process', to: 'vfs', weight: '' },
      { id: 'e-vfs-mapping', from: 'vfs', to: 'mapping', weight: '' },
      { id: 'e-mapping-xarray', from: 'mapping', to: 'xarray', weight: '' },
      { id: 'e-xarray-f0', from: 'xarray', to: 'f0', weight: '0' },
      { id: 'e-xarray-f1', from: 'xarray', to: 'f1', weight: '1' },
      { id: 'e-xarray-f2', from: 'xarray', to: 'f2', weight: '2' },
      { id: 'e-disk-f2', from: 'disk', to: 'f2', weight: 'fill' },
      { id: 'e-xarray-lru', from: 'xarray', to: 'lru', weight: 'age' },
      { id: 'e-lru-disk', from: 'lru', to: 'disk', weight: 'evict' },
    ],
  }, { title });
}

function* fileOffsetLookup() {
  yield {
    state: pageCacheGraph('A file maps offsets to cached folios'),
    highlight: { active: ['mapping', 'xarray', 'f0', 'f1'], compare: ['disk'] },
    explanation: 'The Linux page cache is not one global blob. Each cached file has an address_space, and cached file contents are found by looking up the file offset index in that mapping.',
    invariant: 'For file data, the lookup key is mapping plus page-sized file index.',
  };

  yield {
    state: pageCacheGraph('read(fd, offset) becomes an XArray lookup', { process: 'read 8 KB', mapping: 'file inode', xarray: 'idx=128', f1: 'hit' }),
    highlight: { active: ['process', 'vfs', 'mapping', 'xarray', 'f1', 'e-process-vfs', 'e-vfs-mapping', 'e-mapping-xarray', 'e-xarray-f1'], compare: ['disk'] },
    explanation: 'A buffered read calculates which folios cover the requested byte range. If the folio is already present and uptodate, data can be copied from memory without blocking on disk I/O.',
  };

  yield {
    state: pageCacheGraph('A miss allocates a folio and fills it from storage', { xarray: 'idx=130 miss', f2: 'allocate', disk: 'read block' }),
    highlight: { active: ['xarray', 'f2', 'disk', 'e-xarray-f2', 'e-disk-f2'], compare: ['f0', 'f1'] },
    explanation: 'On a cache miss, the kernel allocates a folio, starts I/O to fill it, marks it uptodate when the contents are valid, and keeps the folio reachable from the mapping for later reads or page faults.',
  };

  yield {
    state: labelMatrix(
      'Why XArray fits the page cache',
      [
        { id: 'sparse', label: 'sparse file' },
        { id: 'next', label: 'next entry' },
        { id: 'rcu', label: 'concurrency' },
        { id: 'marks', label: 'marks' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['large indices', 'do not copy array'],
        ['range walks', 'not just hash'],
        ['lookups under RCU', 'read-heavy path'],
        ['dirty/writeback', 'find special folios'],
      ],
    ),
    highlight: { active: ['sparse:lesson', 'next:need', 'marks:lesson'], found: ['rcu:lesson'] },
    explanation: 'The XArray behaves like a very large sparse array of pointers. Unlike a plain hash table, it supports ordered next/previous walks; unlike a resizable array, it can grow without copying all slots.',
  };

  yield {
    state: labelMatrix(
      'Page cache neighbors',
      [
        { id: 'sqlite', label: 'SQLite pager' },
        { id: 'dbbuf', label: 'DB buffer pool' },
        { id: 'os', label: 'OS page cache' },
        { id: 'direct', label: 'direct I/O' },
      ],
      [
        { id: 'owner', label: 'owner' },
        { id: 'indexes', label: 'indexes' },
        { id: 'durability', label: 'durability' },
      ],
      [
        ['SQLite library', 'db pages', 'journal/WAL'],
        ['database server', 'relation blocks', 'WAL/fsync'],
        ['kernel', 'file folios', 'writeback/fsync'],
        ['application', 'bypasses cache', 'app responsibility'],
      ],
    ),
    highlight: { active: ['os:indexes', 'sqlite:indexes'], compare: ['direct:owner'] },
    explanation: 'The same page-sized thinking appears at several layers. SQLite has its own pager, PostgreSQL has a buffer pool, and Linux has a page cache; each layer decides who indexes pages and who owns durability.',
  };
}

function* dirtyTagsAndReclaim() {
  yield {
    state: pageCacheGraph('write() changes cached folios before disk changes', { process: 'write 4 KB', f1: 'DIRTY', disk: 'old data', lru: 'cannot drop' }),
    highlight: { active: ['process', 'vfs', 'mapping', 'xarray', 'f1'], removed: ['disk'], compare: ['lru'] },
    explanation: 'Buffered write() copies user bytes into cached folios and marks them dirty. The syscall can return before the backing storage has the new bytes, which is the OS page-cache version of write-back caching.',
    invariant: 'A dirty cached folio is newer than its backing store.',
  };

  yield {
    state: labelMatrix(
      'Folio state around reclaim',
      [
        { id: 'clean', label: 'clean' },
        { id: 'dirty', label: 'dirty' },
        { id: 'writeback', label: 'writeback' },
        { id: 'mapped', label: 'mapped' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'reclaim', label: 'reclaim rule' },
      ],
      [
        ['matches disk', 'drop if unused'],
        ['newer than disk', 'write first'],
        ['I/O in flight', 'wait or skip'],
        ['mapped by process', 'coordinate faults'],
      ],
    ),
    highlight: { active: ['dirty:reclaim', 'writeback:reclaim'], found: ['clean:reclaim'] },
    explanation: 'Clean cached folios are easy to reclaim. Dirty folios must become clean first, and folios already under writeback need coordination so the kernel does not discard data still in flight.',
  };

  yield {
    state: pageCacheGraph('Writeback cleans folios, then reclaim may free memory', { f1: 'writeback', disk: 'new data', lru: 'reclaimable after clean' }),
    highlight: { active: ['f1', 'lru', 'disk', 'e-lru-disk'], found: ['xarray'] },
    explanation: 'Writeback submits dirty folios to the filesystem and block layer. After I/O completes, the folio can be marked clean; if memory pressure arrives and nobody is using it, reclaim can evict it from the cache.',
  };

  yield {
    state: labelMatrix(
      'What fsync changes',
      [
        { id: 'write', label: 'write()' },
        { id: 'flush', label: 'background writeback' },
        { id: 'fsync', label: 'fsync()' },
        { id: 'crash', label: 'crash before sync' },
      ],
      [
        { id: 'returns', label: 'returns after' },
        { id: 'guarantee', label: 'guarantee' },
      ],
      [
        ['copy to cache', 'not durable'],
        ['I/O started later', 'policy-driven'],
        ['dirty data forced', 'durability boundary'],
        ['dirty folios lost', 'app must tolerate'],
      ],
    ),
    highlight: { active: ['fsync:returns', 'fsync:guarantee'], compare: ['write:guarantee'] },
    explanation: 'fsync asks the kernel to push dirty data and metadata needed for the file to stable storage. That is the boundary database WAL code and careful file formats build around.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'file offset lookup') yield* fileOffsetLookup();
  else if (view === 'dirty tags and reclaim') yield* dirtyTagsAndReclaim();
  else throw new InputError('Pick a page-cache view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation traces two paths through the Linux page cache. The "file offset lookup" view follows a buffered read from process to VFS to the file mapping to the XArray to cached folios. The "dirty tags and reclaim" view follows a buffered write through dirty marking, writeback, and memory reclaim.',
        'Active nodes are the current decision point in the kernel path. Found markers indicate state that is now guaranteed -- a folio that is confirmed uptodate, or a dirty tag that writeback has cleared. Compare markers show the contrasting subsystem: disk when the cache serves a hit, LRU when the XArray handles lookup.',
        {
          type: 'note',
          text: 'Inference rule: if a folio is present in the XArray and its uptodate flag is set, the kernel can serve a read from memory without issuing storage I/O. If the folio is absent, the kernel must allocate, fill from disk, and then set uptodate before the read can complete.',
        },
      ],
    },
    {
      heading: 'Why the page cache exists',
      paragraphs: [
        'Storage is slow. A modern NVMe SSD completes a random 4 KB read in roughly 10-20 microseconds. A DRAM access takes 60-100 nanoseconds -- two orders of magnitude faster. Programs reread the same files constantly: shared libraries on every process start, config files on every request, source headers on every compilation unit, container image layers on every container launch. Without a cache, every read of the same byte range repeats the full storage round trip.',
        {
          type: 'table',
          headers: ['Access path', 'Latency (order of magnitude)', 'Bandwidth'],
          rows: [
            ['L1 cache hit', '1 ns', '~1 TB/s'],
            ['DRAM (page cache hit)', '60-100 ns', '~50 GB/s'],
            ['NVMe SSD random 4 KB', '10-20 us', '~3-7 GB/s sequential'],
            ['SATA SSD random 4 KB', '50-100 us', '~500 MB/s sequential'],
            ['Spinning disk random 4 KB', '5-10 ms', '~150 MB/s sequential'],
          ],
        },
        'Linux keeps file contents in memory in the page cache so that buffered reads, memory-mapped page faults, and even metadata lookups can be satisfied from RAM. The cache is not merely a speed trick. It is the coordination layer between file APIs, mmap, writeback, reclaim, and crash-consistency boundaries like fsync. Every subsystem that touches file data flows through the same cached folios.',
        {
          type: 'note',
          text: 'The page cache is per-file, not global. Each open file has its own address_space (the inode mapping), and cached folios are indexed by file offset within that mapping. Two files with identical content still have separate cache entries.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The reasonable first attempt is a hash table keyed by (inode, page_index). Given a file and a byte offset, divide by page size to get an index, hash the pair, and look up the cached page. This works for exact-match lookups and is how the old Linux page cache (the radix tree predecessor) was sometimes conceptualized.',
        {
          type: 'table',
          headers: ['Approach', 'Strength', 'Where it breaks'],
          rows: [
            ['Hash table (inode, index)', 'O(1) point lookup', 'No ordered traversal; cannot walk neighbors for readahead or find next dirty page'],
            ['Flat array per file', 'Direct index = O(1) lookup', 'Sparse files waste memory; a 1 TB sparse file with 3 pages cached would allocate slots for 268 million entries'],
            ['Linked list of pages', 'Easy insertion, low overhead', 'Random lookup is O(n); readahead planning requires scanning'],
            ['Balanced BST per file', 'O(log n) lookup + ordered walks', 'High per-node overhead; poor cache locality for the hot lookup path'],
          ],
        },
        'A hash table handles the common case -- "is this page cached?" -- but the kernel asks richer questions. Readahead needs to walk neighboring indices. Writeback needs to find dirty pages across a file. Truncate needs to remove a range. Reclaim needs to scan for reclaimable entries. A hash table answers one question well and fails the rest.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The page cache must satisfy five operations simultaneously, and no single simple data structure handles all of them:',
        {
          type: 'bullets',
          items: [
            'Point lookup: given (mapping, index), return the cached folio or NULL. This is the hot path for buffered read and page fault.',
            'Ordered walk: given an index, find the next or previous populated entry. Readahead uses this to prefetch contiguous ranges. Writeback uses it to find the next dirty folio in file order.',
            'Tagged scan: find all entries marked dirty, or all entries marked writeback, without visiting every cached folio in the system. Background writeback and fsync depend on this.',
            'Sparse representation: a file can be terabytes in size with only a few pages cached. The structure must not allocate memory proportional to the file size, only proportional to the number of cached pages.',
            'Range removal: truncate and hole-punch must efficiently remove all entries in an index range.',
          ],
        },
        'A hash table fails ordered walks and tagged scans. A flat array fails sparse representation. A linked list fails point lookup. A balanced BST handles lookup and walks but has high per-node overhead and no native tag support. The kernel needs a structure that combines sparse indexing, ordered traversal, and per-entry tags in a single container.',
        {
          type: 'quote',
          text: 'The XArray is an abstract data type which behaves like a very large array of pointers. It meets many of the same needs as a hash or a conventional resizable array.',
          attribution: 'Linux kernel documentation, Documentation/core-api/xarray.rst',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Each file has an address_space (the inode mapping). Inside that mapping, the i_pages field is an XArray that maps page-sized file indices to cached folios. The key is not a raw byte offset -- it is the offset divided by page size, scoped to one mapping. Index 0 in file A and index 0 in file B are entirely separate lookups in separate XArrays.',
        {
          type: 'diagram',
          alt: 'Page cache lookup path from byte offset to folio',
          label: 'From byte offset to cached folio',
          body: [
            'read(fd, buf, 8192)  at offset 1,048,576',
            '       |',
            '       v',
            'VFS: inode -> address_space (mapping)',
            '       |',
            '       v',
            'index = offset / PAGE_SIZE = 1048576 / 4096 = 256',
            '       |',
            '       v',
            'XArray lookup: mapping->i_pages[256]',
            '       |',
            '   +---+---+',
            '   |       |',
            '   v       v',
            ' HIT:    MISS:',
            ' copy    alloc folio,',
            ' to      submit I/O,',
            ' user    set uptodate,',
            '         then copy',
          ].join('\n'),
        },
        'The value stored is a folio -- the modern Linux abstraction for one or more physically contiguous pages managed as a unit. A folio carries state bits that are as important as the pointer itself: uptodate (contents are valid), dirty (newer than disk), writeback (I/O in flight), locked (exclusive access for I/O), mapped (present in a process page table), and referenced (recently accessed by reclaim).',
        {
          type: 'note',
          text: 'Central invariant: a dirty folio is newer than its backing store. This single bit changes every downstream decision. Clean folios can be evicted freely. Dirty folios must be written back before reclaim can free them. Confusing the two loses data.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The read path converts a byte range into folio indices and walks the XArray. On a hit with the uptodate flag set, the kernel copies bytes to userspace (for read) or maps the folio into the process page table (for mmap fault). No disk I/O occurs. On a miss, the kernel allocates a new folio, inserts it into the XArray, asks the filesystem to map the logical offset to physical blocks, submits I/O to fill the folio, and sets the uptodate flag when I/O completes.',
        {
          type: 'code',
          language: 'c',
          label: 'Simplified page cache lookup (conceptual, not literal kernel code)',
          body: [
            '/* filemap_get_folio -- the core page cache lookup */',
            'struct folio *filemap_get_folio(struct address_space *mapping,',
            '                                pgoff_t index)',
            '{',
            '    struct folio *folio;',
            '',
            '    /* RCU-protected XArray lookup -- no lock for readers */',
            '    rcu_read_lock();',
            '    folio = xa_load(&mapping->i_pages, index);',
            '    if (folio && !folio_test_uptodate(folio))',
            '        folio = NULL;  /* present but not yet valid */',
            '    rcu_read_unlock();',
            '',
            '    return folio;  /* NULL means cache miss */',
            '}',
          ].join('\n'),
        },
        'The write path is where dirty state enters. A buffered write() copies user bytes into a cached folio (allocating one on miss) and marks it dirty. The syscall returns before the backing store changes. The folio now carries data that exists only in memory.',
        {
          type: 'diagram',
          alt: 'Folio lifecycle from allocation through writeback to reclaim',
          label: 'Folio state machine',
          body: [
            '  allocate          I/O complete        write()         writeback start     I/O done',
            '     |                   |                  |                  |                |',
            '     v                   v                  v                  v                v',
            '  [absent] ---------> [uptodate] ------> [dirty] ---------> [writeback] --> [clean]',
            '                        clean                                                  |',
            '                          |                                                    v',
            '                          +------- reclaim can evict <--------------------------+',
            '                                   (if unreferenced)',
          ].join('\n'),
        },
        'Background writeback, memory pressure, or an explicit fsync later finds dirty folios using XArray tag scans, submits I/O through the filesystem, and clears the dirty tag after completion. Only then can reclaim consider the folio for eviction. The XArray is doing double duty: point lookup by index for the read/write path, and tagged iteration for writeback and reclaim coordination.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three invariants maintained across all state transitions:',
        {
          type: 'bullets',
          items: [
            'Lookup consistency: a folio in the XArray at index N corresponds to file offset N * PAGE_SIZE. If the folio is uptodate, its contents match what the file should contain (either the on-disk version or a more recent buffered write). No stale or wrong-offset data is ever served.',
            'Dirty preservation: a folio marked dirty is not evicted from memory until writeback clears the dirty flag. The kernel never discards a folio whose contents are newer than stable storage. This is enforced at the reclaim boundary: the memory reclaim path checks the dirty flag and initiates writeback rather than freeing the folio.',
            'Writeback exclusion: a folio under active writeback (I/O in flight) is not modified by concurrent writes until I/O completes. The writeback flag and folio lock coordinate this. A write to a folio under writeback waits for I/O completion, then re-dirties the folio with the new data.',
          ],
        },
        'The XArray itself preserves index ordering: inserting at index N does not affect entries at other indices, and removing a range does not corrupt neighbors. The radix-tree structure guarantees this structurally -- each internal node covers a fixed range of the index space, and operations on disjoint ranges touch disjoint nodes.',
        {
          type: 'note',
          text: 'Corner case: folio insertion races. Two threads may both discover a cache miss for the same index. The kernel uses xa_lock or find-or-create helpers to ensure exactly one folio is inserted. The loser finds the winner\'s folio already present and uses it instead of inserting a duplicate.',
        },
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The XArray is a radix tree with a branching factor of 64 (6 bits per level on 64-bit systems). Lookup walks from the root through internal nodes to the leaf slot.',
        {
          type: 'table',
          headers: ['Operation', 'Time complexity', 'Practical behavior'],
          rows: [
            ['Point lookup (xa_load)', 'O(log64 n) where n is max index', 'At most 11 levels for 64-bit index space; typically 2-4 pointer chases for realistic file sizes'],
            ['Insert / store', 'O(log64 n) + allocation', 'Same tree walk plus possible node allocation'],
            ['Tagged iteration (find next dirty)', 'O(k * log64 n) for k results', 'Tag bits propagate up the tree; empty subtrees are skipped entirely'],
            ['Range removal (truncate)', 'O(removed entries * log64 n)', 'Each removed entry may free nodes; batch removal amortizes tree walks'],
          ],
        },
        'For a 1 GB file with 4 KB pages, the maximum index is 262,144. log64(262144) is about 3 -- three pointer chases from root to leaf. For a 1 TB file, the max index is ~268 million, which is about 5 levels. The branching factor keeps the tree shallow even for large files.',
        'The dominant cost is rarely the XArray lookup. On a cache miss, disk I/O takes microseconds to milliseconds -- thousands of times longer than the tree walk. On a cache hit, the memory copy from folio to user buffer (or the page-table manipulation for mmap) typically dominates. The XArray lookup matters most in the transition zone: workloads with very high cache-hit rates where the lookup itself becomes a measurable fraction of the hot path. RCU-based lockless reads keep this path fast under concurrency.',
        {
          type: 'note',
          text: 'Memory cost: each XArray internal node is 576 bytes (64 slots of 8 bytes plus metadata). A fully populated file with 256K pages needs roughly 4,100 nodes (~2.3 MB of tree overhead) to index 1 GB of cached data. The overhead is under 0.25% of the cached data itself.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The page cache is the right abstraction when file access is shared, repeated, or unpredictable:',
        {
          type: 'table',
          headers: ['Workload', 'Why the page cache helps', 'Key mechanism'],
          rows: [
            ['Program startup', 'Executable pages and shared libraries stay warm across process launches', 'Shared folios mapped into multiple address spaces without redundant I/O'],
            ['Build systems', 'Header files and source files are reread by every compilation unit', 'Hot folios survive across compiler invocations within the same build'],
            ['Web servers', 'Static assets (HTML, CSS, images) are served repeatedly', 'sendfile() or splice() can transfer directly from page cache to socket without user-space copy'],
            ['grep / find / ripgrep', 'Directory entries and file contents are scanned sequentially', 'Readahead prefetches contiguous folios; sequential scan amortizes I/O'],
            ['Container startup', 'Overlay filesystem layers share base image pages', 'Multiple containers mapping the same base image share the same cached folios'],
          ],
        },
        'Buffered writes benefit because the kernel batches and reorders writeback. A process writing 1,000 small updates to a file does not generate 1,000 disk writes. The dirty folios accumulate, and writeback coalesces them into larger sequential I/O operations. This is the OS-level equivalent of write-back caching in a CPU cache hierarchy.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The page cache becomes the wrong layer when the application already manages its own caching, ordering, or durability:',
        {
          type: 'table',
          headers: ['Scenario', 'Problem with page cache', 'Typical solution'],
          rows: [
            ['Database buffer pool', 'Double caching: data sits in both the DB buffer pool and the kernel page cache, wasting RAM', 'O_DIRECT bypasses the page cache; the database manages its own buffer pool with application-aware eviction'],
            ['Log-structured storage (RocksDB, LevelDB)', 'Compaction reads/writes large files that pollute the cache and evict useful hot data', 'O_DIRECT for compaction I/O; buffered I/O only for small metadata reads'],
            ['Large sequential scans', 'A single scan of a multi-GB file can evict the entire working set of other applications', 'fadvise(POSIX_FADV_DONTNEED) after processing; or O_DIRECT for scan-heavy analytics'],
            ['Real-time / latency-sensitive', 'Background writeback and reclaim cause unpredictable latency spikes', 'mlock() to pin pages; O_DIRECT for deterministic I/O latency'],
          ],
        },
        'The page cache also creates a dangerous illusion around durability. A successful write() syscall means "copied into kernel memory," not "committed to stable storage." If the machine loses power before writeback completes, dirty folios vanish. Applications that promise crash recovery must call fsync() or fdatasync() at explicit boundaries.',
        {
          type: 'quote',
          text: 'PostgreSQL uses buffered I/O on Linux and calls fsync() on WAL segments. The page cache makes writes fast, but the database never considers data durable until fsync returns success. When the kernel reported fsync success despite writeback errors (pre-4.13 kernels), databases silently lost committed transactions.',
          attribution: 'PostgreSQL fsync incident, 2018 -- kernel error-reporting fix in commit bdd4e85',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a read-then-write sequence on a single file to see every state transition:',
        {
          type: 'code',
          language: 'c',
          label: 'User-space sequence triggering page cache operations',
          body: [
            'int fd = open("data.bin", O_RDWR);',
            '',
            '/* Step 1: read 8 KB at offset 1 MB */',
            'char buf[8192];',
            'pread(fd, buf, 8192, 1048576);',
            '',
            '/* Step 2: overwrite 2 KB at the same offset */',
            'pwrite(fd, new_data, 2048, 1048576);',
            '',
            '/* Step 3: force durability */',
            'fsync(fd);',
          ].join('\n'),
        },
        {
          type: 'bullets',
          items: [
            'Step 1 -- read: offset 1,048,576 with 4 KB pages means indices 256 and 257. The kernel looks up both in the XArray. If index 256 hits (folio present + uptodate), that half is a memory copy. If index 257 misses, the kernel allocates a folio, asks the filesystem to fill it from disk, waits for I/O, sets uptodate, then copies to the user buffer.',
            'Step 2 -- write: the kernel looks up index 256 (now cached from step 1), copies 2,048 bytes of new_data into the folio, and marks it dirty. The pwrite() syscall returns immediately. The disk still holds the old data.',
            'Step 3 -- fsync: the kernel scans the XArray for dirty-tagged entries in this mapping, finds index 256, submits writeback I/O, waits for the device to confirm the write is on stable storage, clears the dirty tag, and returns. After fsync returns, a power failure will not lose the step-2 write.',
          ],
        },
        'The folio at index 256 went through: absent -> allocated -> uptodate (after read I/O) -> dirty (after write) -> writeback (during fsync I/O) -> clean (after fsync completes). Each transition changed what reclaim could do with it. At "dirty," reclaim must write it back first. At "writeback," reclaim must wait. At "clean," reclaim can evict it freely.',
      ],
    },
    {
      heading: 'The XArray internally',
      paragraphs: [
        'The XArray replaced the older radix_tree in Linux 4.20 (2018). It is a 64-way radix tree where each internal node has 64 slots and covers 6 bits of the index. The structure is conceptually simple:',
        {
          type: 'diagram',
          alt: 'XArray radix tree structure for page cache indices',
          label: 'XArray internal structure (simplified)',
          body: [
            '  index 0x0103 = 0b 000001 000011 in 6-bit chunks',
            '',
            '  root',
            '   |',
            '   +--[slot 1]---> internal node (level 1)',
            '                     |',
            '                     +--[slot 3]---> folio pointer (leaf)',
            '',
            '  Two pointer chases: root -> node -> folio.',
            '  Empty slots are NULL -- no memory wasted for uncached indices.',
            '  Marks (dirty, writeback) propagate: if any child is dirty,',
            '  the parent node\'s mark bit is set, enabling fast tag scans.',
          ].join('\n'),
        },
        'Three features make the XArray specifically suited to page cache work. First, marks: each entry can carry up to three mark bits (XA_MARK_0 through XA_MARK_2, used for dirty and writeback tags). Mark bits propagate upward -- if any entry in a subtree is marked, the parent node carries the mark. This lets tagged iteration skip entire subtrees with no marked entries, making "find the next dirty folio" fast even across large sparse files.',
        'Second, multi-order entries: a single XArray slot can represent a range of indices, which is how large folios (compound pages spanning 2^n base pages) are stored without inserting duplicate pointers at every covered index.',
        'Third, RCU-safe reads: the tree structure allows lockless lookup under RCU. Readers do not take the xa_lock. Only writers (insert, remove, tag changes) take the lock. Since page cache reads vastly outnumber writes on most workloads, this asymmetry is critical for scalability.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'When building software on top of the page cache, the first decision is who owns caching policy:',
        {
          type: 'table',
          headers: ['Application type', 'Recommended I/O mode', 'Rationale'],
          rows: [
            ['CLI tools, web servers, build systems', 'Buffered I/O (default)', 'The kernel shares hot data across processes and reclaims under pressure; no benefit to managing your own cache'],
            ['Databases (Postgres, MySQL)', 'Buffered I/O + explicit fsync', 'Let the page cache handle reads; use fsync for durability boundaries; accept double-caching cost for simpler code'],
            ['Storage engines (RocksDB, WiredTiger)', 'O_DIRECT for data files', 'Avoid double caching; the engine knows its access pattern better than the kernel LRU'],
            ['Large analytics scans', 'Buffered + POSIX_FADV_DONTNEED', 'Use the page cache for sequential prefetch but release pages after processing to avoid polluting the cache'],
          ],
        },
        {
          type: 'code',
          language: 'c',
          label: 'Advising the kernel after a sequential scan to avoid cache pollution',
          body: [
            '/* After processing a large file, release its pages */',
            'int fd = open("big_log.bin", O_RDONLY);',
            '/* ... read and process the file ... */',
            'posix_fadvise(fd, 0, 0, POSIX_FADV_DONTNEED);',
            '/* Tells the kernel: I will not reread this data. */',
            '/* The kernel may evict these clean folios promptly. */',
          ].join('\n'),
        },
        'Be explicit about durability. The page cache makes writes visible to subsequent reads before they are durable on stable storage. That gap is a feature for throughput and a hazard for recovery protocols. If the program promises crash recovery, the design must include fsync or fdatasync at the correct boundary, and it must handle fsync failure -- on older kernels, a failed writeback could be silently dropped, leaving the application believing data was durable when it was not.',
      ],
    },
    {
      heading: 'Observability and debugging',
      paragraphs: [
        'Page-cache behavior explains performance swings that look like application logic changes. A cold cache after reboot turns reads into disk I/O. A warm cache turns the same reads into memory copies. A workload that fits in RAM during testing may thrash under production data sizes.',
        {
          type: 'code',
          language: 'bash',
          label: 'Key observability commands for page cache state',
          body: [
            '# How much memory is the page cache using?',
            'grep -E "^(Cached|Dirty|Writeback):" /proc/meminfo',
            '',
            '# Per-file cache residency (which pages of a file are cached?)',
            'vmtouch /path/to/file',
            '',
            '# Page faults and I/O per process',
            'perf stat -e page-faults,major-faults ./my_program',
            '',
            '# Watch writeback and reclaim in real time',
            'vmstat 1  # columns: si/so (swap), bi/bo (block I/O), wa (I/O wait)',
            '',
            '# Drop the entire page cache (requires root; useful for benchmarking)',
            'echo 3 > /proc/sys/vm/drop_caches',
          ].join('\n'),
        },
        {
          type: 'bullets',
          items: [
            'High "Dirty" in /proc/meminfo with low disk throughput: writeback is falling behind. Check dirty_ratio and dirty_background_ratio tunables.',
            'High major faults: the working set exceeds available RAM; pages are being evicted and re-read from disk. Either reduce the working set or add memory.',
            'fsync latency spikes: dirty data accumulated for too long before the fsync forced a flush. Reduce dirty_expire_centisecs or call fsync more frequently in smaller batches.',
            'Double caching (database + page cache): check if the database process RSS plus the page cache "Cached" value exceeds physical RAM. If so, consider O_DIRECT for data files.',
          ],
        },
      ],
    },
    {
      heading: 'Neighbors and relatives',
      paragraphs: [
        'The page cache pattern -- index cached data by application-level key, track dirty state, write back lazily, evict under pressure -- appears at every layer of the storage stack:',
        {
          type: 'table',
          headers: ['System', 'Cache unit', 'Index key', 'Eviction policy', 'Durability boundary'],
          rows: [
            ['Linux page cache', 'Folio (1+ pages)', 'File mapping + page index', 'LRU lists (active/inactive)', 'fsync / fdatasync'],
            ['PostgreSQL buffer pool', '8 KB page', 'Relation OID + block number', 'Clock sweep', 'WAL + checkpoint + fsync'],
            ['SQLite pager', 'Page (1-64 KB)', 'Database page number', 'LRU with pinning', 'Journal or WAL + fsync'],
            ['CPU L1/L2/L3 cache', 'Cache line (64 B)', 'Physical address', 'Pseudo-LRU / PLRU', 'Write-back to DRAM on eviction'],
            ['Browser HTTP cache', 'Response body', 'URL + Vary headers', 'LRU with size limits', 'Disk write on cache store'],
          ],
        },
        'The lesson is structural: every cache faces the same design decisions. What is the unit? What is the key? How do you find dirty entries? When do you write back? What does the caller assume about durability? The Linux page cache makes one set of choices. Understanding those choices makes it easier to evaluate any other cache.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Linux XArray documentation: https://docs.kernel.org/core-api/xarray.html -- the authoritative reference for XArray operations, marks, and multi-order entries.',
            'Linux address_space and i_pages: https://docs.kernel.org/filesystems/api-summary.html -- how filesystems interact with the page cache mapping.',
            'Linux memory management API: https://docs.kernel.org/core-api/mm-api.html -- folio allocation, locking, writeback, and reclaim interfaces.',
            'iomap buffered I/O: https://docs.kernel.org/filesystems/iomap/operations.html -- the modern path from file offset to block I/O through the page cache.',
            'Matthew Wilcox, "The XArray" (LWN.net, 2017-2018) -- the design rationale for replacing radix_tree with XArray, including mark propagation and RCU safety.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic to study next'],
          rows: [
            ['Prerequisite', 'Radix trees and tries -- the underlying tree structure that XArray generalizes'],
            ['Deeper into Linux VFS', 'VFS Dentry and Inode Cache -- the path from filename to inode to mapping'],
            ['Writeback policy', 'Readahead and Dirty Writeback -- how Linux decides when and how much to prefetch or flush'],
            ['Crash consistency', 'fsync, Rename, and Crash Consistency -- the durability contracts applications build on'],
            ['Application-level neighbor', 'PostgreSQL Buffer Pool Clock Sweep -- a buffer pool that manages its own pages with application-aware eviction'],
            ['Library-level neighbor', 'SQLite B-Tree Pager -- a user-space pager with its own dirty tracking and journaling'],
          ],
        },
      ],
    },
  ],
};
