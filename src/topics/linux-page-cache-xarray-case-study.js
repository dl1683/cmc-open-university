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
      heading: 'What it is',
      paragraphs: [
        'The Linux page cache keeps file contents in memory so reads, page faults, and many writes can be served without immediately touching storage. The cache is organized around file mappings: an inode address_space maps file offsets to cached folios.',
        'The XArray is the important data-structure hook. Kernel documentation describes it as a large sparse array of pointers, and notes that its most important user is the page cache.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For buffered reads, the kernel calculates the folio indexes covering the requested byte range, looks them up in the file mapping, and copies data from memory on a hit. A miss allocates a folio, reads storage into it, marks it uptodate, and inserts it so later reads or mmap faults can reuse it.',
        'For buffered writes, the kernel copies user bytes into cached folios and marks them dirty. The backing disk may still contain old bytes until writeback or fsync pushes the folios out.',
      ],
    },
    {
      heading: 'Case study: same page idea at three layers',
      paragraphs: [
        'SQLite has a pager that caches database pages inside the library. PostgreSQL has a database buffer pool. Linux has the page cache. All three index page-sized units and track dirty state, but they sit at different ownership boundaries. The database layer understands transactions and WAL; the kernel layer understands files, mappings, writeback, and reclaim.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Page-cache hits avoid disk latency and can collapse repeated reads into memory copies. The complexity is coherency: direct I/O, mmap, truncation, dirty writeback, fsync, memory pressure, and filesystem mappings all have to agree about which bytes are valid and durable.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A successful write() to a regular file usually means bytes reached the kernel page cache, not that they are durable on storage. fsync or an equivalent durability protocol is the explicit boundary. Another misconception is that the page cache is simply an LRU cache. Reclaim, dirty state, writeback, mappings, and filesystem rules make it a coordinated VM/filesystem structure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux XArray docs at https://docs.kernel.org/core-api/xarray.html, VFS address_space docs at https://docs.kernel.org/filesystems/vfs.html, filemap/writeback APIs at https://docs.kernel.org/core-api/mm-api.html, and iomap buffered I/O notes at https://docs.kernel.org/filesystems/iomap/operations.html. Study VFS Dentry & Inode Cache, File Descriptor Table & Open File Description, LRU Cache, Write-Through vs Write-Back, SQLite B-Tree & Pager, Adaptive Radix Tree, Readahead & Dirty Writeback, Linux Workingset Refault & Reclaim, fsync Rename Crash Consistency, and Filesystem Extent Tree & Delayed Allocation next.',
      ],
    },
  ],
};
