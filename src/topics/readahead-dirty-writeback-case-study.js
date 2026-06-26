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
        'The readahead view traces how sequential reads teach the kernel to fetch pages before the application asks. Active means the current page-cache lookup or storage request is in progress, visited means a page or threshold has already affected policy, and found means a prefetched page is now useful.',
        'The dirty-writeback view traces buffered writes from user memory into dirty folios and later to storage. The safe inference is that a dirty page is newer in RAM than on disk, so it can be batched for speed but cannot be reclaimed as clean memory.',
        {type:'callout', text:'The page cache is the shared structure; readahead speculates only when access patterns justify it, while dirty writeback batches writes without letting memory pressure escape its bounds.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/65/Simplified_Structure_of_the_Linux_Kernel.svg', alt:'Simplified Linux kernel structure diagram showing system calls, virtual file system, file systems, and device layers.', caption:'Simplified Linux kernel structure. Readahead and dirty writeback sit in the file I/O path between application calls, the page cache, and block storage. Source: Wikimedia Commons, ScotXW, CC BY-SA 4.0/GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A file system cannot treat every read and write as an isolated storage operation. A sequential scan exposes a pattern, and a stream of small writes exposes an opportunity to batch work.',
        'The page cache is the in-memory structure that makes both optimizations possible. It can hold recently read pages, speculatively fetch nearby pages, and delay dirty writes until flushers can send larger device I/O.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious read policy is demand-only I/O. Fetch exactly the 4 KB page the process asks for, return it, and wait for the next request.',
        'The obvious write policy is write-through. Copy the bytes to storage before write returns, so the application never confuses accepted data with durable data.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Demand-only reads waste sequential evidence. Reading a 1 GB file in 4 KB pages means about 262,144 page requests, and a storage round trip on each miss can dominate the scan.',
        'Write-through wastes batching and makes tiny writes pay full device latency. A process appending 200 byte log lines at 10,000 lines per second would ask the device to handle 10,000 small writes each second instead of merging them.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use the page cache as the shared structure, then add two bounded feedback loops. Readahead grows only when access looks sequential, and dirty writeback delays writes only while memory and age thresholds stay under control.',
        'The read-side invariant is that speculation must beat pollution. The write-side invariant is that dirty memory must stay bounded because a dirty page cannot be freed until it is written or discarded.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On a read miss, the kernel checks recent offsets. If the access follows the previous position, it reads the demanded page and a small window ahead, then marks a trigger page near the end of that window.',
        'When the process reaches the trigger page, the kernel submits the next window asynchronously. Sequential hits grow the window up to a device or policy cap, while a random jump resets the pattern.',
        'On a buffered write, the kernel copies data into page-cache folios and marks them dirty. Background thresholds wake flusher threads, hard thresholds throttle writers, expiry timers age out old dirty pages, and fsync forces the application-selected data to storage.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Readahead is correct because it changes performance, not the bytes returned for a requested offset. If a prefetched page is never used, it is just cold cache data that can be reclaimed later.',
        'Writeback is correct only under the right contract. A successful buffered write means the kernel accepted the data into memory, while durability requires fsync, fdatasync, sync, or a mode that makes each write wait for storage.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main read cost is wasted memory and bandwidth. Fifty sequential readers with 256 KB windows use only 12.5 MB of RAM, but the damage can be large if those prefetched pages evict hot database index pages.',
        'The main write cost is latency variance and crash exposure. A writer can see 1 us memory-copy writes until dirty memory crosses a hard threshold, then block for 10 ms to 50 ms while flushers catch up.',
        'Doubling RAM often doubles dirty thresholds when ratio settings are used. That can improve batching, but it can also increase the amount of data exposed to loss before explicit sync.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Readahead helps grep, backups, media streaming, package installation, log processing, and recovery scans. These workloads move mostly forward through files, so future offsets are predictable.',
        'Dirty writeback helps compilers, loggers, package managers, browsers, and media encoders that produce many small writes. The kernel turns those writes into larger device operations and absorbs short bursts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Readahead fails on random database lookups because neighboring pages are often useless. Speculation can evict useful cache pages and add I/O that the application never consumes.',
        'Dirty writeback fails when programs assume write means durable. A power loss before fsync can lose seconds of accepted writes, and sustained writers on slow storage can hit a throttling cliff.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A transcoder reads a 4 GB input file and writes a 2 GB output file on a machine with 8 GB of RAM. Default dirty ratios of 10 percent and 20 percent mean background flushers start around 800 MB dirty and writers throttle around 1.6 GB dirty.',
        'On the read side, the first few 4 KB misses grow the window until 128 KB is being prefetched. After that, the application usually reads from RAM while storage is already fetching the next pages.',
        'On the write side, a 60 MB/s encoder on a 40 MB/s disk accumulates dirty data at about 20 MB/s. After roughly 40 seconds it reaches the 800 MB background threshold, and after roughly 80 seconds it reaches the 1.6 GB throttle threshold unless flushers catch up.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux mm/readahead.c, Linux mm/page-writeback.c, Linux VM sysctl docs at https://docs.kernel.org/admin-guide/sysctl/vm.html, VFS docs at https://docs.kernel.org/filesystems/vfs.html, and readahead(2) at https://man7.org/linux/man-pages/man2/readahead.2.html. These define the kernel mechanisms and tunables.',
        'Study LRU Cache for eviction pressure, Write-Ahead Log for explicit durability, Backpressure for dirty throttling, io_uring for async I/O, O_DIRECT for bypassing the page cache, and database buffer pools for systems that manage caching themselves.',
      ],
    },
  ],
};
