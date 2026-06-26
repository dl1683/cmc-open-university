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
        'The animation follows the Linux page cache, which is memory used to store file contents so repeated file access can avoid storage I/O. A folio is the kernel unit that holds one or more pages of cached file data, and an XArray is a sparse ordered index from file offset to folio. Active nodes mark the current lookup or writeback step; found nodes mark a folio or tag whose state is now known.',
        {type: 'callout', text: 'The page cache works because each file mapping owns a sparse ordered index of folios, while dirty and writeback tags turn lookup state into reclaim and durability policy.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Radix_tree.svg', alt: 'Radix tree diagram with word prefixes branching from a root node', caption: 'Radix tree example for sparse ordered indexing. Cmglee, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Storage is far slower than memory. A cached 4 KB file range can be copied from RAM in nanoseconds to microseconds, while a storage read can take microseconds on NVMe and milliseconds on spinning disk. The page cache exists so reads, memory-mapped faults, and buffered writes share one file-data layer instead of repeating storage work.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a hash table keyed by file identity and page index. It answers the first question quickly: is this page cached. It feels right until the kernel also needs ordered walks for readahead, tag scans for dirty writeback, and range removal for truncate or hole punch.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that page-cache operations are not only point lookups. The kernel must find the next cached folio, find all dirty folios in file order, skip empty regions in sparse files, and remove ranges without allocating slots for every possible offset. A flat array wastes memory, a list makes lookup linear, and a plain hash table loses order.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Each file mapping owns an XArray indexed by page-sized file offsets. The structure behaves like a huge sparse array of pointers, but internally it is a radix-style tree with marks that can propagate upward. That means the same container supports point lookup, ordered traversal, dirty scans, writeback scans, and sparse storage.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a read at byte offset 1,048,576 with 4 KB pages, the kernel computes page index 256 and searches the file mapping XArray. If the folio exists and is uptodate, the read can copy from memory. If it misses, the kernel allocates a folio, inserts it, submits I/O, marks it uptodate when the data arrives, and then completes the read.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is built on state bits. A folio at index N represents bytes starting at N times page size, so lookup cannot return data from the wrong offset. A dirty folio is newer than storage and cannot be discarded until writeback succeeds; a writeback folio has I/O in flight and must be coordinated with concurrent writers.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'XArray lookup is O(log64 m), where m is the largest page index in the file, because each tree level consumes about 6 index bits. A 1 GB file has 262,144 possible 4 KB page indices, so lookup is about three levels; a 1 TB file is about five levels. On a cache miss, storage I/O dominates; on a hit, memory copy or page-table work usually dominates the tree walk.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The page cache helps program startup, shared libraries, build systems, static web serving, container image layers, grep-style scans, and buffered writes. It also lets several processes map the same file-backed folio instead of reading separate copies. The access pattern is shared or repeated file data whose lifetime is better managed by the kernel than by each process alone.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The page cache fails as the main cache when an application already has a better buffer manager, such as a database that tracks pages by transaction and workload. It can also hurt one-pass scans, which fill memory with data that will not be reused. A successful write means data reached kernel memory, not stable storage, so crash-safe applications still need fsync or fdatasync at the right boundary.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A process calls pread for 8 KB at offset 1,048,576. With 4 KB pages, the kernel checks indices 256 and 257; if 256 hits and 257 misses, half the read is a memory copy and half waits for storage I/O. A later pwrite of 2 KB at the same offset updates folio 256 in memory and marks it dirty while storage still has the old bytes.',
        'When fsync runs, the kernel scans the XArray dirty marks for that file mapping and finds index 256 without walking every clean folio. It submits writeback, waits for completion, clears dirty and writeback state, and only then can reclaim drop the folio freely. The cost behavior is visible: the XArray makes the search small, while the device write controls latency.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Linux XArray documentation, Linux filesystems address_space documentation, Linux memory-management folio APIs, and iomap buffered I/O documentation. Then study radix trees, tries, readahead, dirty writeback, fsync and crash consistency, PostgreSQL buffer pools, SQLite pager design, and cache eviction. The key exercise is tracing one read miss and one dirty write from file offset to XArray entry to reclaim decision.',
      ],
    },
  ],
};