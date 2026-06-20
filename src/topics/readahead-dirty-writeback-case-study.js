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
      heading: 'How to read the animation',
      paragraphs: [
        'The "readahead window" view traces how sequential reads teach the kernel to prefetch. Active nodes are the current stage of the I/O path -- the application offset, the cache lookup, and the ahead window. Found nodes mark storage completing a prefetch. Compare nodes highlight policy resets when the access pattern breaks.',
        'The "dirty writeback throttling" view traces the lifecycle of a buffered write: data enters the page cache, folios are marked dirty, thresholds trigger background flushers, and writers may be throttled. Active nodes are the dirty-to-clean pipeline. Compare nodes are the threshold lines on the dirty memory plot.',
        {
          type: 'note',
          text: 'The safe inference at each frame: if a node is active and the edge leading to it is highlighted, data has reached that stage. If a downstream node is not yet active, the data has not propagated there. Watch how readahead flags turn one prefetch hit into the trigger for the next prefetch window.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'Linux kernel readahead.c comment',
          text: 'The readahead code tries to predict what pages will be needed next and read them in advance. The idea is to overlap I/O latency with processing time.',
        },
        'Every file read or write passes through the kernel page cache -- a memory-resident mirror of recently accessed file data. Without policy, the cache is reactive: it fetches a page on demand, hands it to the application, and hopes the same page is needed again soon.',
        'That reactive model wastes a predictable resource. A sequential scan of a 1 GB file on a disk with 100 us random-read latency would stall once per 4 KB page -- roughly 262,000 round trips. If the kernel can see the pattern after two or three sequential hits and start fetching the next 128 KB while the application processes the current page, the stalls collapse into overlapped I/O.',
        'The same problem appears on the write side. A small buffered write -- 100 bytes of a log line -- could wait for a full storage round trip if the kernel wrote through immediately. Instead, the kernel copies the bytes into a cached folio, marks it dirty, and returns. The actual device write happens later, batched with neighboring dirty folios into a single large I/O. The policy question is how long and how much dirty data to accumulate before that batch fires.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest read policy is demand-only I/O: fetch exactly the requested page when the application asks for it. The simplest write policy is write-through: push every modified byte to storage before the write call returns.',
        {
          type: 'code',
          language: 'c',
          body: `// Demand-only read: one page per syscall, one device round trip per miss.
ssize_t demand_read(struct file *f, char *buf, size_t count) {
    struct page *pg = find_get_page(f->f_mapping, offset >> PAGE_SHIFT);
    if (!pg) {
        pg = page_cache_alloc();
        submit_bio_wait(READ, pg);   // block until device responds
    }
    copy_to_user(buf, page_address(pg), count);
    return count;
}
// Sequential scan of 1 GB: ~262,144 synchronous device reads.`,
        },
        'Both policies are correct and easy to reason about. Demand-only never wastes memory on pages the application did not request. Write-through never risks data loss from a crash between write and storage.',
        'They are too conservative for real machines. A sequential read stalls once per page even though the pattern is obvious after two accesses. A log writer issuing 200-byte appends at 10,000 lines per second would generate 10,000 device round trips per second instead of one merged 2 MB write.',
        {
          type: 'note',
          text: 'The opposite extreme is equally broken. Prefetching the entire file on the first read can fill memory with data nobody uses. Deferring all writes indefinitely creates an unbounded crash window and eventually forces the kernel into emergency writeback under memory pressure, stalling every process on the machine.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is prediction under shared resources. The kernel must guess the future access pattern from a short history, and that guess competes with every other memory user on the system.',
        {
          type: 'table',
          headers: ['Dimension', 'Read side', 'Write side'],
          rows: [
            ['Prediction', 'Which offsets will be read next?', 'How long can dirty data wait?'],
            ['Resource', 'Prefetched pages consume memory', 'Dirty pages consume memory and defer I/O'],
            ['Wrong guess cost', 'Wasted bandwidth, evicted useful pages', 'Crash window grows, reclaim stalls writers'],
            ['Shared impact', 'One reader evicts another workload cache', 'One writer dirty set throttles unrelated processes'],
            ['Durability', 'Not affected (reads are side-effect free)', 'write() returns before data is on disk'],
          ],
        },
        'A single readahead policy cannot serve both a 10 GB sequential backup and a database doing 4 KB random lookups. The backup wants a 256 KB window that stays ahead of consumption. The database wants no prefetch at all -- every speculative page would evict a useful index page.',
        'On the write side, the wall is that buffered writes decouple the write() syscall from storage durability. An application that writes critical data and never calls fsync can lose arbitrarily many seconds of work after a crash. The page cache made writes fast by making them lie about persistence -- and the lie is invisible until power fails.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use the page cache as a shared data structure, then layer two feedback loops on top. Readahead is speculative read scheduling gated by observed sequential evidence. Dirty writeback is deferred write scheduling bounded by memory thresholds, age limits, and explicit sync.',
        {
          type: 'diagram',
          alt: 'Readahead and writeback feedback loops around the page cache',
          label: 'The two policy loops share the page cache',
          body: `         Application
          |       |
       read()   write()
          |       |
          v       v
     +------------------+
     |   Page Cache      |
     |  (folio index)    |
     +------------------+
        /            \\
       v              v
  READAHEAD LOOP    WRITEBACK LOOP
  observe pattern   track dirty set
  grow/shrink       background flush
    window          throttle writers
       |                |
       v                v
     Storage Device (block I/O)`,
          text: `         Application
          |       |
       read()   write()
          |       |
          v       v
     +------------------+
     |   Page Cache      |
     |  (folio index)    |
     +------------------+
        /            \\
       v              v
  READAHEAD LOOP    WRITEBACK LOOP
  observe pattern   track dirty set
  grow/shrink       background flush
    window          throttle writers
       |                |
       v                v
     Storage Device (block I/O)`,
        },
        'The readahead invariant: prediction must beat pollution. A prefetch is useful only if the application actually reads the prefetched folio before reclaim evicts it. If the prediction is wrong, the prefetch consumed memory and I/O bandwidth for nothing.',
        'The writeback invariant: dirty memory must remain bounded. A dirty folio represents data that is newer in memory than on disk. The kernel can batch it for efficiency, but it cannot let dirty pages grow without limit -- eventually memory runs out, reclaim cannot free dirty pages without writing them, and the system stalls.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The readahead state machine tracks a window of file offsets that should be fetched ahead of demand. Linux stores this state per file descriptor in struct file_ra_state.',
        {
          type: 'code',
          language: 'c',
          body: `// Simplified from linux/include/linux/fs.h
struct file_ra_state {
    pgoff_t start;       // where current readahead window begins
    unsigned int size;   // total pages in current window
    unsigned int async_size;  // pages in the async (trigger) portion
    unsigned int ra_pages;    // maximum window size (from backing_dev)
    loff_t prev_pos;     // previous read position (for pattern detection)
};`,
        },
        'On a cache miss, the kernel checks whether the miss looks sequential. If the missed offset follows the previous read position, readahead begins: the kernel submits I/O for the requested page plus an initial window of nearby pages. It marks the last page in the window with a readahead flag.',
        'When the application later touches the flagged page, that touch triggers an async readahead -- the kernel submits the next window before the application reaches the end of the current one. If the application keeps consuming sequentially, the window doubles on each trigger, up to the backing device maximum (typically 128 KB or 256 KB). A random jump resets the state.',
        {
          type: 'table',
          headers: ['Access', 'Cache result', 'Policy action', 'Window state'],
          rows: [
            ['read page 0', 'miss', 'Synchronous readahead: fetch pages 0-3', 'start=0, size=4, flag on page 3'],
            ['read page 1', 'hit (prefetched)', 'No action', 'Unchanged'],
            ['read page 2', 'hit (prefetched)', 'No action', 'Unchanged'],
            ['read page 3', 'hit (flagged)', 'Async readahead: fetch pages 4-11', 'start=4, size=8, flag on page 11'],
            ['read page 4', 'hit (prefetched)', 'No action', 'Unchanged'],
            ['jump to page 900', 'miss', 'Reset: new sync readahead at 900', 'start=900, size=4, flag on page 903'],
          ],
        },
        'Dirty writeback is driven by thresholds, timers, and explicit sync. When an application writes to a cached folio, the kernel marks the folio dirty and returns immediately. Four mechanisms trigger actual device writes.',
        {
          type: 'bullets',
          items: [
            'Background threshold (dirty_background_ratio or dirty_background_bytes): when total dirty memory exceeds this level, the kernel wakes flusher threads to start writing dirty folios. Applications continue unthrottled.',
            'Hard threshold (dirty_ratio or dirty_bytes): when a process dirty memory exceeds this level, the kernel forces the writing process to participate in writeback -- balance_dirty_pages() blocks the writer until dirty pages drop. This is the backpressure mechanism.',
            'Expiry timer (dirty_expire_centisecs): dirty folios older than this age become eligible for writeback even if global dirty memory is below the background threshold. Default is 3000 centisecs (30 seconds).',
            'Periodic wakeup (dirty_writeback_centisecs): flusher threads wake at this interval to scan for expired dirty folios. Default is 500 centisecs (5 seconds).',
          ],
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Readahead is safe because it is speculative only in performance terms. Prefetching an unused page wastes bandwidth and memory, but it never changes the data the application reads. The correctness boundary is the page cache lookup: a read returns bytes for the requested offset, regardless of whether those bytes arrived by demand I/O or earlier readahead. If the speculative pages are never touched, they are reclaimed like any other cold cache page.',
        'The doubling window is effective because sequential access is self-reinforcing evidence. After two consecutive hits on prefetched pages, the probability that the next offset is sequential is high enough that doubling the window is a good bet. The maximum window cap prevents a single reader from monopolizing memory or I/O bandwidth.',
        {
          type: 'note',
          text: 'The readahead flag is the key mechanism that makes the pipeline work. Without it, the kernel would have to check readahead state on every page access. With it, only the specific flagged page triggers the next async prefetch -- and by the time the application reaches that page, the I/O for the next window is already in flight.',
        },
        'Dirty writeback works because write() and fsync() are different contracts. A successful buffered write means the kernel accepted data into memory. Durability requires an explicit fsync, fdatasync, or sync call. The kernel can batch dirty folios freely as long as (1) dirty memory stays within thresholds, (2) explicit sync calls flush the requested data to storage, and (3) the filesystem journal provides crash consistency for metadata.',
        {
          type: 'quote',
          attribution: 'POSIX specification',
          text: 'A write() that returns successfully does not guarantee that the data has been committed to permanent storage. An explicit fsync() or fdatasync() is required to ensure data integrity.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'Readahead', 'Dirty writeback'],
          rows: [
            ['Memory', 'Prefetched pages occupy RAM until consumed or evicted', 'Dirty pages are pinned until written back'],
            ['I/O bandwidth', 'Speculative reads may compete with demand I/O', 'Batched writes are efficient but can burst'],
            ['Latency (good case)', 'Sequential read hits RAM: ~100 ns', 'Buffered write copies to RAM: ~1 us'],
            ['Latency (bad case)', 'Random miss after wrong prefetch: full device RTT', 'Writer throttled at dirty limit: 10-100+ ms stall'],
            ['CPU', 'Pattern detection per miss is O(1)', 'Dirty accounting and threshold checks per write are O(1)'],
            ['Crash window', 'None (reads are idempotent)', 'Up to dirty_expire_centisecs of unflushed writes'],
          ],
        },
        'The dominant cost of readahead is memory. On a machine with 64 GB of RAM running 50 concurrent sequential scans, each with a 256 KB window, the readahead footprint is 50 x 256 KB = 12.5 MB -- negligible. But if those scans evict hot database index pages from the page cache, the indirect cost is orders of magnitude higher.',
        'The dominant cost of dirty writeback is latency variance. A log writer producing 50 MB/s of dirty data on a disk that sustains 200 MB/s sees no throttling. The same writer on a disk that sustains 40 MB/s hits the hard dirty threshold and stalls in balance_dirty_pages(). The stall is not gradual -- it is a cliff. Write latency jumps from microseconds to tens of milliseconds when the threshold is crossed.',
        {
          type: 'code',
          language: 'bash',
          body: `# Check current dirty thresholds on a Linux system
cat /proc/sys/vm/dirty_background_ratio   # default: 10 (percent of RAM)
cat /proc/sys/vm/dirty_ratio              # default: 20 (percent of RAM)
cat /proc/sys/vm/dirty_expire_centisecs   # default: 3000 (30 seconds)
cat /proc/sys/vm/dirty_writeback_centisecs # default: 500 (5 seconds)

# Check current dirty memory state
grep -E 'Dirty|Writeback' /proc/meminfo
# Dirty:              12340 kB   <-- data in cache, not yet on disk
# Writeback:           4096 kB   <-- data currently being written to disk`,
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A video transcoding pipeline reads a 4 GB input file sequentially, writes a 2 GB output file sequentially, and the machine has 8 GB of RAM with default kernel settings (dirty_background_ratio=10, dirty_ratio=20).',
        {
          type: 'table',
          headers: ['Time', 'Read side', 'Write side', 'Dirty memory'],
          rows: [
            ['t=0', 'read(input, 0): cache miss, sync readahead 0-3', 'No writes yet', '0 MB'],
            ['t=1', 'read(input, 1-3): cache hits on prefetched pages', 'write(output, 0): copies to cache, marks dirty', '4 KB'],
            ['t=2', 'read(input, 3): touches RA flag, async prefetch 4-11', 'write(output, 1-7): fast memory copies', '32 KB'],
            ['t=10', 'read(input, 50): window grown to 128 KB, I/O fully overlapped', 'write(output, 0-50): all in dirty cache', '200 KB'],
            ['t=300', 'read(input, 500K): window at max, reads never stall', 'write(output, 250K): dirty set at 600 MB', '600 MB (7.5% of 8 GB)'],
            ['t=400', 'read continues, pages recycled after read', 'dirty hits 800 MB (10%): flusher thread wakes', '800 MB, flushers active'],
            ['t=500', 'read continues without impact', 'write rate > flush rate: dirty climbs to 1.2 GB', '1.2 GB'],
            ['t=600', 'read continues without impact', 'dirty hits 1.6 GB (20%): writer throttled in balance_dirty_pages', '1.6 GB, writer stalls'],
          ],
        },
        'The read side performs well throughout: after the initial miss, the doubling window reaches 128 KB and stays ahead of the application. The application never blocks on a read after the first few pages.',
        'The write side shows the threshold cliff. For the first 400 seconds, every write() returns after a fast memory copy. When dirty memory crosses 10% (800 MB), flusher threads start cleaning, but if the write rate exceeds the device write bandwidth, dirty memory keeps climbing. At 20% (1.6 GB), the writing process is forced to block in balance_dirty_pages() until flushers reduce the dirty set. Write latency jumps from ~1 us to 10-50 ms.',
        {
          type: 'note',
          text: 'At no point during this example is any output data durable on disk until the flusher completes or the application calls fsync(). A power failure at t=500 would lose up to 1.2 GB of output data. The pipeline must call fsync() on the output file after transcoding completes, and should consider periodic fsync() for crash recovery of partial progress.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Sequential file scans (grep, backup, log processing): readahead overlaps I/O with text processing. A grep across a 10 GB log file with readahead completes in roughly the sequential read time of the disk; without readahead, it takes up to 10x longer on rotational storage.',
            'Media streaming and transcoding: video decoders read input frames sequentially. Readahead keeps the decode pipeline fed. Output writes are batched by dirty writeback into large sequential writes that maximize disk throughput.',
            'Database checkpoint reads: PostgreSQL checkpoint reads dirty buffers and writes them to WAL and data files. The kernel readahead on WAL replay can significantly speed recovery by prefetching WAL segments.',
            'Package installation and builds: compilers and package managers write many small files. Dirty writeback batches thousands of small writes into fewer large I/Os, reducing install time by 2-5x compared to write-through on rotational disks.',
            'Filesystem metadata walks (find, du, ls -R): the kernel can readahead directory entries and inode tables. ext4 inode readahead is a separate mechanism tuned for metadata locality.',
          ],
        },
        'The shared lesson is that the page cache is not a passive lookup table. It is a cache plus policy. The same physical RAM serves both read and write caching, and the policies interact: a large dirty set reduces the memory available for read caching, and aggressive readahead can evict dirty pages that have not been written back yet.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Scenario', 'What breaks', 'Structural fix'],
          rows: [
            ['Random 4 KB database reads', 'Readahead fetches neighbors that are never read, evicts useful index pages', 'Use O_DIRECT or posix_fadvise(POSIX_FADV_RANDOM) to disable readahead'],
            ['Multiple competing sequential streams', 'Each stream readahead window evicts the other stream cached pages', 'Limit ra_pages per stream, use fadvise hints, or use O_DIRECT for bulk scans'],
            ['Fast writer on slow disk', 'Dirty set hits hard threshold, writer stalls for 10-100 ms', 'Lower dirty_ratio, use dedicated I/O scheduler, or use O_DIRECT with application-level batching'],
            ['Application assumes write = durable', 'Power loss loses all dirty data since last fsync', 'Call fsync() after critical writes; use O_DSYNC for per-write durability'],
            ['fsync storm after long dirty accumulation', 'Single fsync waits for all dirty data to reach disk', 'Periodic fsync to bound flush size; sync_file_range() for fine-grained control'],
            ['Cgroup dirty throttling mismatch', 'Container dirty limits interact with global limits unpredictably', 'Set per-cgroup dirty limits with cgroup v2 memory.dirty_* knobs'],
          ],
        },
        'The most dangerous failure is the durability confusion. Buffered writes return successfully in microseconds. Developers test on local SSDs where dirty writeback is invisible. In production, a crash loses 30 seconds of writes because nobody called fsync(). The page cache made writes feel reliable by making them fast, but speed and durability are independent properties.',
        {
          type: 'code',
          language: 'c',
          body: `// The dangerous pattern: write() without fsync()
int fd = open("important.dat", O_WRONLY | O_CREAT, 0644);
write(fd, data, len);   // returns immediately -- data is in page cache only
close(fd);              // does NOT guarantee data is on disk
// Power failure here: data may be lost.

// The safe pattern: write() + fsync()
int fd = open("important.dat", O_WRONLY | O_CREAT, 0644);
write(fd, data, len);
fsync(fd);              // blocks until data + metadata reach storage
close(fd);
// Power failure here: data survives.`,
        },
        'The second most common failure is the dirty throttling cliff. Applications benchmark writes under light load and see microsecond latency. Under sustained load, dirty memory accumulates until balance_dirty_pages() blocks the writer. The latency jumps from 1 us to 50 ms with no gradual degradation. Load testing must run long enough to hit the dirty threshold.',
      ],
    },
    {
      heading: 'Observability and tuning',
      paragraphs: [
        'Readahead and writeback are kernel-internal policies with no application-level API for detailed feedback. Diagnosis relies on /proc, /sys, tracepoints, and fadvise hints.',
        {
          type: 'code',
          language: 'bash',
          body: `# Read-side diagnostics
cat /sys/block/sda/queue/read_ahead_kb        # current readahead window max
blockdev --getra /dev/sda                      # same, in 512-byte sectors

# Tune readahead for a backup workload
blockdev --setra 2048 /dev/sda                 # set to 1 MB (2048 sectors)

# Application-level hints (in C, via posix_fadvise)
# POSIX_FADV_SEQUENTIAL: double the readahead window
# POSIX_FADV_RANDOM: disable readahead entirely
# POSIX_FADV_DONTNEED: evict pages after processing (streaming)

# Write-side diagnostics
grep -E 'Dirty|Writeback' /proc/meminfo        # current dirty/writeback pages
cat /proc/sys/vm/dirty_background_ratio         # flusher trigger (% of RAM)
cat /proc/sys/vm/dirty_ratio                    # writer throttle (% of RAM)

# Trace writeback events
echo 1 > /sys/kernel/debug/tracing/events/writeback/enable
cat /sys/kernel/debug/tracing/trace_pipe        # watch flusher activity live`,
        },
        {
          type: 'table',
          headers: ['Signal', 'What it tells you', 'Where to find it'],
          rows: [
            ['Dirty in /proc/meminfo', 'Total dirty memory system-wide', '/proc/meminfo'],
            ['Writeback in /proc/meminfo', 'Pages currently being written to disk', '/proc/meminfo'],
            ['pgpgin/pgpgout in /proc/vmstat', 'Pages read from / written to disk', '/proc/vmstat'],
            ['nr_dirty_threshold', 'Current computed dirty threshold', '/proc/vmstat'],
            ['kworker/flush CPU', 'Flusher thread is busy', 'top or perf'],
            ['D-state processes', 'Processes blocked on I/O (possibly balance_dirty_pages)', 'ps aux or /proc/[pid]/status'],
          ],
        },
        'Tuning should start from the workload contract, not from knob twiddling. A database with its own buffer pool and WAL protocol may bypass the page cache entirely with O_DIRECT. A file-copy tool wants maximum sequential throughput and benefits from large readahead. A latency-sensitive web server may lower dirty_ratio to prevent write stalls during log rotation. One set of defaults is not right for every machine.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the Linux kernel readahead implementation in mm/readahead.c, writeback implementation in mm/page-writeback.c, the VM dirty writeback sysctls documented at https://docs.kernel.org/admin-guide/sysctl/vm.html, the VFS page cache API at https://docs.kernel.org/filesystems/vfs.html, and the readahead(2) man page at https://man7.org/linux/man-pages/man2/readahead.2.html. Fengguang Wu\'s LWN articles on adaptive readahead (2007) describe the design rationale for the current algorithm.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: LRU Cache -- the eviction policy that decides which cached pages to discard under memory pressure.',
            'Prerequisite: Write-Ahead Log -- the durability mechanism that databases use instead of relying on page cache writeback.',
            'Extension: Backpressure -- the general pattern of slowing producers when consumers cannot keep up, of which dirty throttling is one instance.',
            'Extension: PostgreSQL WAL Checkpoint Recovery -- a real system that layers its own buffer pool and checkpoint logic on top of kernel page cache behavior.',
            'Contrast: O_DIRECT and io_uring -- bypassing the page cache entirely for applications that manage their own caching and I/O scheduling.',
            'Contrast: ZFS ARC -- an alternative page cache design with adaptive replacement that resists scan pollution better than Linux LRU.',
          ],
        },
        'The engineering question is not whether readahead and writeback are good ideas -- they clearly are for most workloads. The useful question is whether your specific access pattern matches the kernel\'s prediction model, whether your durability requirements are met by your fsync discipline, and whether your dirty thresholds match your device\'s sustained write bandwidth.',
      ],
    },
  ],
};

