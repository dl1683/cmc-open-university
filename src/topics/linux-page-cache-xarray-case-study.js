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
        "Read the animation as the execution trace for Linux Page Cache XArray. Linux indexes cached file folios by file offset through an address_space XArray, then tracks clean, dirty, writeback, and reclaim states around it..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why the page cache exists',
      paragraphs: [
        `A general-purpose operating system cannot afford to treat every file read as a fresh trip to storage. Programs reread shared libraries, configuration files, database pages, package indexes, source trees, container layers, and executable text. Even on fast NVMe, storage latency and queueing are much slower than a memory hit. Linux therefore keeps file contents in memory in the page cache, so buffered reads and memory-mapped page faults can often be satisfied by copying from RAM or by mapping an already-resident folio into a process.`,
        `The page cache is not just a performance trick. It is the coordination layer between ordinary file APIs, mmap, filesystems, writeback, reclaim, and crash-consistency boundaries such as fsync. A write can update cached memory before the backing device changes. A read can find a clean cached folio without touching disk. Memory pressure can drop unused clean folios, but it must not discard dirty ones. Filesystems can map logical file offsets to disk blocks while the memory manager decides which cached ranges deserve RAM. The data structure has to serve all of those paths without becoming a global bottleneck.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The simplest design is a hash table keyed by (file, pageIndex). That is enough to answer one question: do we already have this page? But the kernel routinely asks richer questions. During readahead it wants to walk neighboring cached ranges. During writeback it wants to find dirty folios. During reclaim it wants to distinguish clean, dirty, mapped, under-writeback, and referenced pages. During truncate it may need to remove a range. During huge sparse-file access it must represent high offsets without allocating empty slots for every missing page before them.`,
        `A resizable array also fails. File offsets can be sparse and enormous, so an array indexed directly by page number would waste memory or require copying and remapping as it grows. A linked list preserves order but makes random lookup expensive. A plain hash table gives fast exact lookup but loses ordered traversal and indexed marks. The page cache wants the shape of a huge sparse array, the lookup cost of an index, and the ability to mark and scan special entries. That is the reason Linux uses the XArray in each file mapping rather than a simpler container.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The central object is the file mapping, represented in the kernel by an address_space. For ordinary file data, the mapping belongs to an inode. Inside that mapping, ` + "`i_pages`" + ` is an XArray from page-sized file indices to cached folios. The key is not merely a byte offset; it is a mapping plus an index derived from the offset. Offset 0 in one file and offset 0 in another file are different cache entries because they live under different mappings.`,
        `The value is a folio, which is the modern Linux abstraction for one or more physically contiguous pages managed as a unit. A folio can be absent, present but not yet uptodate, uptodate and clean, dirty, under writeback, mapped into userspace, locked for I/O, or eligible for reclaim. Those states are as important as the pointer lookup. A cached folio is useful only if the kernel knows whether its bytes are valid, whether storage already has the same contents, and whether anyone can safely drop or reuse the memory.`,
        `The most important invariant is simple: a dirty cached folio is newer than the backing store. That state changes the reclaim rule. A clean unused folio can be evicted because the disk or remote filesystem already has the data. A dirty folio cannot be thrown away without losing writes. It must be written back, invalidated under careful rules, or kept until an operation such as fsync forces the durability boundary the application needs.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The file-offset lookup path starts outside the cache. A process calls read, or it faults on a memory-mapped file. VFS reaches the file\'s inode and therefore its address_space. The kernel converts the byte range into folio indices and looks in the mapping\'s XArray. On a hit, if the folio is uptodate, the kernel can copy bytes to userspace or map the page into the process. On a miss, it allocates a folio, inserts or coordinates insertion, asks the filesystem and block layer to fill it, marks it uptodate after successful I/O, and leaves it indexed for future reads.`,
        `The dirty-state path shows why the XArray also needs marks and range walks. A buffered write copies user bytes into a cached folio and marks it dirty. The syscall may return before storage has the new contents. Later, background writeback, memory pressure, fsync, or sync policy finds dirty folios, submits I/O through the filesystem, and marks them clean after completion. Reclaim can then evict unused clean folios. The same mapping therefore supports point lookup for reads, marked scans for writeback, and removal or invalidation for truncation and reclaim.`,
        `The LRU node in the visualizer is deliberately separate from the XArray. The XArray answers "which cached folio belongs to this file offset?" The reclaim machinery answers "which memory should be reclaimed under pressure?" Real page-cache behavior is the combination of both: a folio is indexed by file position, participates in replacement policy, and carries state that determines whether it can be reused immediately.`,
      ],
    },
    {
      heading: 'Why XArray fits',
      paragraphs: [
        `The Linux XArray behaves like a very large sparse array of pointers. That phrase matters. It preserves an integer index space, so the page cache can talk naturally in file-page numbers. It does not require memory for every missing slot in a sparse file. It supports finding the next or previous populated entry, which a hash table cannot do cleanly. It supports marks, so subsystems can tag entries as dirty, under writeback, or otherwise interesting and later search for those tags without scanning every cached folio in the machine.`,
        `Concurrency is another reason the choice matters. File data lookup is a hot path. Many readers may be checking cached pages while writers, reclaim, truncate, and writeback change state around them. The surrounding kernel code uses locking and RCU-oriented patterns to keep read-heavy paths fast while preserving correctness for updates. The data structure is not responsible for all synchronization by itself, but it has to be usable in that environment.`,
        `The cost model is asymmetric. If a folio is missing and the kernel must wait for storage, the XArray lookup cost is negligible compared with I/O. If a workload is mostly cache hits, the lookup path, memory copying, page fault handling, and cacheline behavior matter. If memory is tight, writeback and reclaim policy dominate. The page cache is fast when it converts expensive storage operations into cheap memory operations, but it is not free: it consumes RAM, creates writeback work, and can interfere with applications that already manage their own cache.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The page cache is excellent for shared, repeated, and unpredictable file access. Program startup benefits because executable pages and shared libraries stay warm. Build systems benefit because source files and headers are reread. Search tools benefit because directory and file scans reuse cached data. mmap-heavy applications benefit because file-backed pages can be faulted and shared without each process issuing independent I/O. Buffered writes benefit because the kernel can batch and reorder writeback instead of forcing each small write to storage immediately.`,
        `The same mechanism can be the wrong abstraction for databases, storage engines, and high-throughput systems that already have a buffer manager. A database may want its own replacement policy, checksum discipline, write-ahead log ordering, prefetch strategy, and direct control over fsync. If it uses buffered I/O, it may cache the same data once in the database buffer pool and again in the kernel page cache. Direct I/O is one answer, but it moves responsibility back to the application: alignment, scheduling, caching, and durability become application concerns.`,
        `The page cache also does not make writes durable by itself. A successful write syscall can mean "copied into kernel memory," not "committed to stable storage." Applications that care about crash recovery must understand fsync, fdatasync, rename, filesystem journaling, and storage flush behavior. The page cache can improve throughput, but it sharpens the distinction between visibility to later reads and durability after power loss.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a process reads 8 KB from a file at offset 1 MB. With 4 KB base pages, that covers two indices in the file mapping. The kernel asks the address_space XArray for those indices. If both folios are present and uptodate, the read is a memory operation. If the first is present and the second is missing, the kernel can return or schedule I/O depending on the path, allocate the missing folio, map the file offset to storage blocks through the filesystem, and fill the folio from the device.`,
        `Now suppose the process overwrites 2 KB in the first folio. The cached folio is modified and marked dirty. A later read of the same range sees the new bytes from memory. The disk may still hold the old bytes until writeback. If memory pressure arrives, reclaim cannot simply drop that dirty folio. If fsync arrives, the kernel must push the dirty data and the metadata needed to make it durable. This is the same object passing through lookup, modification, writeback, and reclaim roles.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `When you build software on top of the page cache, decide who owns caching policy. A command-line tool, web server, package manager, or build system can usually rely on buffered I/O because the kernel already shares hot file data across processes and reclaims it under memory pressure. A database or log-structured storage engine may need its own buffer pool, checksum path, write ordering, and eviction policy. In that case, buffered I/O can duplicate memory and hide durability boundaries the application wants to control.`,
        `Choose the I/O mode around invariants, not fashion. Buffered I/O gives simple APIs and a strong default cache. mmap gives convenient shared file-backed memory but turns missing cached folios into page faults and changes where errors surface. Direct I/O can reduce double caching and make latency more explicit, but it makes alignment, batching, prefetch, and writeback the application\'s problem. The right choice depends on whether the kernel\'s policy is close enough to the workload\'s policy.`,
        `Be explicit about durability. If the program promises that data survives a crash, the design must include fsync or fdatasync at the correct boundary, and it must account for metadata such as directory entries after rename. The page cache makes writes visible to later reads before they are durable. That is a feature for throughput and a hazard for recovery protocols that confuse visibility with persistence.`,
      ],
    },
    {
      heading: 'Observability and debugging',
      paragraphs: [
        `Page-cache behavior often explains performance swings that look like application logic changes. A cold cache turns reads into storage I/O. A warm cache turns the same reads into memory copies and page-table work. A workload that fits in memory during a small test may thrash under production data. A background writeback storm can add latency to unrelated requests because dirty folios, reclaim, and block I/O compete for shared resources.`,
        `Useful signals include cache hit and miss behavior, major and minor page faults, dirty memory, writeback memory, reclaim activity, I/O queue depth, fsync latency, and memory pressure. Tools vary by kernel and distribution, but the questions stay stable: are reads missing the cache, are writes piling up as dirty pages, is reclaim waiting on writeback, are mmap faults stalling, and is the application accidentally caching the same data in two layers?`,
        `Debugging should keep the file mapping invariant in mind. A byte range maps to indices inside one address_space. If truncate, hole punching, invalidation, direct I/O, mmap, and buffered I/O touch the same range, correctness depends on coordinated cache invalidation and state transitions. Most application programmers do not manipulate those internals directly, but understanding the invariant helps explain why mixed I/O modes and crash-recovery code deserve special care.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Linux XArray documentation at https://docs.kernel.org/core-api/xarray.html, Linux filesystem API notes for address_space and ` + "`i_pages`" + ` at https://docs.kernel.org/filesystems/api-summary.html, Linux memory-management API notes at https://docs.kernel.org/core-api/mm-api.html, and iomap buffered I/O notes at https://docs.kernel.org/filesystems/iomap/operations.html. The exact internals change across kernel releases, so use the docs and source tree for the version you are studying.`,
        `Next, study VFS Dentry and Inode Cache for the path from pathname to inode, File Descriptor Table and Open File Description for the path from process handle to file object, Readahead and Dirty Writeback for policy, fsync Rename Crash Consistency for durability, Postgres Buffer Pool Clock Sweep for an application-owned neighbor, SQLite B-Tree Pager for a library-level pager, and Filesystem Extent Tree Delayed Allocation for how logical file offsets eventually become disk placement decisions.`,
      ],
    },
      {
      heading: 'Why this exists',
      paragraphs: [
        "State the real constraint this topic fixes before introducing the mechanism.",
        "A good opening says what gets too slow, too fragile, or too hard to reason about under baseline behavior.",
        "Without that, every optimization appears decorative.",
      ],
    },

    {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Why it works',
      paragraphs: [
        "Give the proof sketch as a preservation argument: invariant before, move, invariant after.",
        "If there is a nontrivial corner case, name it explicitly.",
        "When correctness is explicit, readers can transfer the method to new inputs.",
      ],
    },

    {
      heading: 'Cost and behavior',
      paragraphs: [
        "Cost is both asymptotic and practical.",
        "State what grows, what stays flat, and what setup cost dominates before the method becomes useful.",
        "If possible, convert cost into an intuition: doubling, halving, or crossing a fixed bound.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for linux-page-cache-xarray-case-study, continue to the next topic in the same track.'
  ],
      },
],
};
