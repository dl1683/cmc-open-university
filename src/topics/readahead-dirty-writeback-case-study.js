// Readahead and dirty writeback: the policy loops around the Linux page cache.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'readahead-dirty-writeback-case-study',
  title: 'Readahead & Dirty Writeback',
  category: 'Systems',
  summary: 'Buffered file I/O uses readahead to prefill likely future reads and dirty writeback thresholds to keep deferred writes bounded.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['readahead window', 'dirty writeback throttling'], defaultValue: 'readahead window' },
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

function ioGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.7, y: 4.0, note: notes.app ?? 'read/write' },
      { id: 'cursor', label: 'offset', x: 2.3, y: 4.0, note: notes.cursor ?? 'N' },
      { id: 'cache', label: 'cache', x: 4.2, y: 4.0, note: notes.cache ?? 'folios' },
      { id: 'window', label: 'ahead', x: 6.4, y: 2.0, note: notes.window ?? 'N+1..N+k' },
      { id: 'disk', label: 'storage', x: 9.0, y: 2.0, note: notes.disk ?? 'I/O' },
      { id: 'dirty', label: 'dirty', x: 6.4, y: 6.1, note: notes.dirty ?? 'deferred' },
      { id: 'flusher', label: 'flusher', x: 9.0, y: 6.1, note: notes.flusher ?? 'writeback' },
    ],
    edges: [
      { id: 'e-app-cursor', from: 'app', to: 'cursor', weight: '' },
      { id: 'e-cursor-cache', from: 'cursor', to: 'cache', weight: '' },
      { id: 'e-cache-window', from: 'cache', to: 'window', weight: '' },
      { id: 'e-window-disk', from: 'window', to: 'disk', weight: 'pread' },
      { id: 'e-disk-cache', from: 'disk', to: 'cache', weight: 'fill' },
      { id: 'e-cache-dirty', from: 'cache', to: 'dirty', weight: 'mark' },
      { id: 'e-dirty-flusher', from: 'dirty', to: 'flusher', weight: 'batch' },
      { id: 'e-flusher-disk', from: 'flusher', to: 'disk', weight: 'write' },
    ],
  }, { title });
}

function* readaheadWindow() {
  yield {
    state: ioGraph('Sequential reads teach the kernel to prefetch later folios'),
    highlight: { active: ['app', 'cursor', 'cache', 'window'], found: ['disk'] },
    explanation: 'Readahead fills the page cache with file folios before the application explicitly asks for them. It is a bet that nearby future offsets will be read soon.',
    invariant: 'Readahead is useful only when prediction beats cache pollution.',
  };

  yield {
    state: labelMatrix(
      'One sequential scan',
      [
        { id: 'p0', label: 'read p0' },
        { id: 'p1', label: 'read p1' },
        { id: 'p2', label: 'read p2' },
        { id: 'rand', label: 'jump p900' },
      ],
      [
        { id: 'hit', label: 'cache result' },
        { id: 'policy', label: 'policy response' },
      ],
      [
        ['miss', 'start window'],
        ['prefetch hit', 'grow window'],
        ['prefetch hit', 'keep ahead'],
        ['miss', 'reset pattern'],
      ],
    ),
    highlight: { active: ['p1:hit', 'p2:policy'], compare: ['rand:policy'] },
    explanation: 'A sequential scan gives the kernel evidence to grow a readahead window. A random jump breaks that evidence, so the policy should reset instead of filling memory with the wrong neighbors.',
  };

  yield {
    state: ioGraph('The readahead flag turns one prefetched hit into the next prefetch', { cursor: 'touch p1', window: 'p2..p9', disk: 'async reads', cache: 'p1 hit' }),
    highlight: { active: ['cursor', 'cache', 'window', 'disk', 'e-cache-window', 'e-window-disk', 'e-disk-cache'] },
    explanation: 'Kernel documentation describes readahead as being triggered by misses or by touching a folio that carries a readahead flag. That flag is the breadcrumb that says the previous prefetch is now being consumed.',
  };

  yield {
    state: labelMatrix(
      'Readahead tradeoffs',
      [
        { id: 'seq', label: 'large sequential read' },
        { id: 'small', label: 'small random read' },
        { id: 'mmap', label: 'mmap fault stream' },
        { id: 'repair', label: 'filesystem scan' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['hide disk latency', 'read too far'],
        ['little benefit', 'pollute cache'],
        ['faults overlap I/O', 'wrong stride'],
        ['metadata scan faster', 'memory pressure'],
      ],
    ),
    highlight: { active: ['seq:benefit', 'mmap:benefit'], compare: ['small:risk'] },
    explanation: 'Readahead is a policy, not a law. The data structure underneath can find folios by offset; the policy decides which missing offsets are worth fetching before demand arrives.',
  };
}

function* dirtyWritebackThrottling() {
  yield {
    state: ioGraph('Buffered writes create dirty folios and defer storage I/O', { app: 'write()', cache: 'copy bytes', dirty: 'dirty folios', flusher: 'later', disk: 'old data' }),
    highlight: { active: ['app', 'cache', 'dirty', 'e-cache-dirty'], compare: ['flusher', 'disk'] },
    explanation: 'Buffered writes usually return after copying data into the page cache and marking folios dirty. The expensive write to storage is deferred, batched, and scheduled by writeback policy.',
    invariant: 'Dirty memory is useful batching until it becomes too much risk or pressure.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 0, max: 10 }, y: { label: 'dirty memory %', min: 0, max: 40 } },
      series: [
        { id: 'dirty', label: 'dirty pages', points: [{ x: 0, y: 2 }, { x: 2, y: 8 }, { x: 4, y: 14 }, { x: 6, y: 22 }, { x: 8, y: 30 }, { x: 10, y: 18 }] },
        { id: 'background', label: 'background threshold', points: [{ x: 0, y: 10 }, { x: 10, y: 10 }] },
        { id: 'throttle', label: 'writer threshold', points: [{ x: 0, y: 25 }, { x: 10, y: 25 }] },
      ],
    }),
    highlight: { active: ['dirty'], compare: ['background', 'throttle'] },
    explanation: 'The sysctl controls express the shape: a background threshold starts flusher work, while a higher dirty threshold can make writers participate in writeback instead of letting dirty memory grow forever.',
  };

  yield {
    state: labelMatrix(
      'Dirty writeback controls',
      [
        { id: 'bg', label: 'background limit' },
        { id: 'dirty', label: 'dirty limit' },
        { id: 'expire', label: 'expire age' },
        { id: 'period', label: 'wake period' },
      ],
      [
        { id: 'trigger', label: 'trigger' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['dirty memory high', 'flusher starts'],
        ['writer too dirty', 'writer throttles'],
        ['old dirty data', 'eligible for writeout'],
        ['timer wakeup', 'periodic scan'],
      ],
    ),
    highlight: { active: ['bg:effect', 'dirty:effect'], found: ['expire:trigger'] },
    explanation: 'Linux exposes this as knobs such as dirty_background_bytes, dirty_bytes, dirty_expire_centisecs, and dirty_writeback_centisecs. The important idea is not the exact default; it is the feedback loop.',
  };

  yield {
    state: ioGraph('Writeback turns dirty folios into clean, reclaimable folios', { dirty: 'batch by mapping', flusher: 'writeback I/O', disk: 'new data', cache: 'clean after done' }),
    highlight: { active: ['dirty', 'flusher', 'disk', 'cache', 'e-dirty-flusher', 'e-flusher-disk'], found: ['app'] },
    explanation: 'Writeback walks dirty folios, submits I/O through the filesystem and block layer, and clears dirty state after completion. Clean folios can remain cached for future reads or be reclaimed under memory pressure.',
  };

  yield {
    state: labelMatrix(
      'Production failure modes',
      [
        { id: 'burst', label: 'write burst' },
        { id: 'slowdisk', label: 'slow disk' },
        { id: 'fsync', label: 'fsync storm' },
        { id: 'memory', label: 'memory pressure' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'structural fix', label: 'structural fix' },
      ],
      [
        ['dirty spike', 'backpressure earlier'],
        ['writers stall', 'limit dirty set'],
        ['latency cliff', 'batch commits'],
        ['reclaim waits', 'clean proactively'],
      ],
    ),
    highlight: { active: ['burst:structural fix', 'slowdisk:structural fix'], compare: ['fsync:symptom'] },
    explanation: 'The case-study value is operational: a page cache can make writes look instant until the dirty set hits a threshold, a disk slows down, or fsync forces hidden work into the foreground.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'readahead window') yield* readaheadWindow();
  else if (view === 'dirty writeback throttling') yield* dirtyWritebackThrottling();
  else throw new InputError('Pick a readahead/writeback view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Buffered file I/O sits between applications and storage. The application asks to read or write file offsets. The kernel page cache holds file-backed memory so repeated reads can hit RAM and writes can be batched before they reach the device.',
        'Readahead and dirty writeback are the policy loops around that cache. Readahead asks which nearby file ranges should be fetched before demand arrives. Dirty writeback asks how long modified cached data may stay ahead of storage before background flushers, sync, or writer throttling force it out.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'The simplest read policy is demand-only I/O: read exactly the requested page or folio when the application asks for it. The simplest write policy is immediate write-through: every modified range reaches storage before write returns. Both are easy to reason about.',
        'They are too conservative for real machines. Sequential reads would wait one storage round trip per page even though the next offsets are predictable. Small buffered writes would become device-latency events instead of memory copies followed by efficient batched IO.',
        'The opposite mistake is unbounded optimism. Prefetching far ahead can fill memory with pages nobody reads. Deferring every write can create a large crash window, memory pressure, and long stalls when the system finally has to clean dirty data.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is latency hiding without lying about durability. A kernel wants sequential readers to find data already in memory, but it cannot know the future. It wants writers to return quickly, but it cannot let dirty memory grow forever or pretend write has the same durability promise as fsync.',
        'The second wall is shared memory. Readahead and dirty pages compete with anonymous memory, executables, filesystem metadata, and other cached files. A policy that helps one streaming reader can evict useful pages for another workload. A policy that buffers one writer can throttle unrelated tasks when dirty limits are shared.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep the page cache as the common data structure, then add feedback loops. Readahead is speculative read scheduling based on observed access pattern. Dirty writeback is delayed write scheduling bounded by thresholds, age, memory pressure, and explicit sync operations.',
        'The invariant for readahead is prediction must beat pollution. Growing the window is useful only while the application consumes nearby offsets. The invariant for writeback is dirty memory must remain bounded. A dirty folio is newer than storage; the kernel can batch it, but it cannot forget that it is debt.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'A file mapping is indexed by file offset. Modern Linux describes cached file memory with folios, which may contain one or more pages. When an application reads a missing folio, the kernel can submit IO for that folio plus an ahead window. When a later access touches a folio marked as part of the previous readahead, that touch can trigger the next window.',
        'The policy state is small but meaningful. Linux tracks readahead state for a file, including where the most recent window started, how large it was, how much was asynchronous, and what previous position was observed. Sequential evidence grows or maintains the window. Random jumps weaken the evidence and reset the guess.',
        'For writes, the application copies data into cached file memory and the kernel marks the affected folios dirty. Later, writeback code walks dirty folios, submits writes through the filesystem and block layer, and clears dirty state after IO completes. Clean folios can remain cached for reads or be reclaimed under memory pressure.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The main structure is the page cache index for an address_space. It maps file offsets to cached folios and their state bits: uptodate, dirty, under writeback, readahead, locked, and related flags. The cache answers whether a file range is already resident and whether it can be reclaimed.',
        'Readahead adds a per-file policy state and a window over future offsets. It does not change the meaning of the file. It only schedules extra reads into the same cache. The risk is that the guessed offsets are wrong and occupy memory that could have held useful data.',
        'Dirty writeback adds queues and accounting. The kernel tracks dirty memory globally, per backing device, and in cgroup-aware paths. Thresholds such as dirty_background_bytes, dirty_bytes, dirty_background_ratio, and dirty_ratio decide when background writeback starts and when writers may have to slow down or participate in cleaning.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Readahead works when access has locality. A sequential scan of p0, p1, p2 gives evidence that p3 and p4 are likely. If storage can fetch those pages while the application processes current data, the next read becomes a memory hit instead of a device wait.',
        'The policy is safe because it is speculative only in performance terms. Fetching an unused page wastes bandwidth and memory, but it does not change the application result. The correctness boundary remains the page cache: a read returns the bytes for the requested offset, whether they arrived by demand IO or earlier readahead.',
        'Dirty writeback works because write and durability are different contracts. A successful buffered write means the kernel accepted the data into memory. Durability requires fsync, fdatasync, sync, filesystem journal rules, or later writeback completion. The policy can batch dirty folios as long as limits and explicit durability calls are honored.',
      ],
    },
    {
      heading: 'Threshold feedback',
      paragraphs: [
        'Dirty memory has two broad thresholds. The background threshold starts flusher activity while applications can often continue. The higher dirty threshold applies backpressure to writers so dirty memory does not grow without bound. Byte-based knobs and ratio-based knobs express the same idea in different units.',
        'Age also matters. Dirty data that has been sitting too long becomes eligible for writeout even if the system is not at the highest dirty limit. Periodic writeback wakes up to move old dirty folios toward storage. Explicit sync calls bypass patience and force the foreground to wait for the requested durability boundary.',
        'This makes write latency uneven. A stream of write calls may look cheap while the dirty set is below thresholds. The same workload can later stall when the dirty set crosses a limit, the backing device slows, reclaim needs clean pages, or fsync has to wait for hidden buffered work.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Readahead wins for sequential file scans, media streaming, backups, compaction jobs, database checkpoint reads, filesystem metadata walks, and mmap fault streams with predictable movement. It turns idle storage time into useful future reads.',
        'Dirty writeback wins for small writes, append-heavy logs, build artifacts, checkpoints, package installs, and workloads where batching turns many small updates into fewer larger IOs. It lets applications proceed after copying to memory while the kernel chooses a better device schedule.',
        'The shared lesson is that the page cache is not a passive map. It is a cache plus policy. Correct tuning depends on access pattern, memory pressure, device speed, filesystem behavior, and durability requirements.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Readahead fails on random reads, sparse access, competing streams, tight memory, and workloads where the next offset is not close to the previous offset. In those cases it can read data that is never used and evict data that would have been useful.',
        'Dirty writeback fails when applications confuse write latency with durable persistence. A program that writes important data and never calls fsync may lose recently written bytes after a crash. The page cache improved apparent latency, not the durability contract.',
        'It also fails operationally when dirty limits are too loose for the device. Fast writers can fill dirty memory faster than slow storage can clean it. The visible symptom is not only lower throughput; it is foreground stalls, reclaim waits, fsync latency cliffs, and noisy-neighbor effects in shared systems.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'For reads, watch cache hit rate, major page faults, readahead hits, wasted prefetch where available, read throughput, IO queue depth, and memory reclaim. A sequential job with low cache benefit may have disabled or ineffective readahead, wrong access hints, or competing memory pressure.',
        'For writes, watch dirty pages, writeback pages, time spent in writeback, fsync latency, balance_dirty_pages stalls, backing-device congestion, cgroup writeback behavior, and reclaim waiting on writeback. These signals explain why write calls that were cheap a minute ago are now slow.',
        'Tuning should start from the workload contract. A database with its own buffer pool and WAL durability path may use direct IO or careful fsync policy. A file-copy job may want large sequential throughput. A desktop workload may prefer responsiveness over long dirty bursts. One set of dirty knobs is not right for every machine.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study LRU Cache, Write Caching, Write-Ahead Log, PostgreSQL Buffer Pool Clock Sweep, PostgreSQL WAL Checkpoint Recovery, Backpressure, fsync crash consistency, filesystem extents, and block-device queues. These topics separate cache policy, durability policy, and storage scheduling.',
        'Official sources: Linux memory-management API readahead documentation at https://docs.kernel.org/core-api/mm-api.html, VM dirty writeback sysctls at https://docs.kernel.org/admin-guide/sysctl/vm.html, VFS documentation at https://docs.kernel.org/filesystems/vfs.html, filesystem API summaries at https://docs.kernel.org/filesystems/api-summary.html, and readahead(2) at https://man7.org/linux/man-pages/man2/readahead.2.html.',
      ],
    },
  ],
};
