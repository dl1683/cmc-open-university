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
      heading: 'What it is',
      paragraphs: [
        'Readahead and dirty writeback are the policy loops around the Linux page cache. Readahead speculatively fills future file folios so sequential reads avoid waiting on every page. Dirty writeback pushes modified cached folios to storage before memory pressure or durability demands make the dirty set dangerous.',
        'Together they explain why buffered file I/O often feels much faster than storage: reads are predicted ahead, and writes are acknowledged into memory before the storage device has necessarily caught up.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Readahead is triggered by a miss or by touching a folio marked as part of an earlier readahead request. The kernel reads future folios that are not already in the cache, trying to keep storage I/O ahead of the application cursor.',
        'Dirty writeback tracks memory that has newer file data than storage. Background flusher threads start work at a lower dirty threshold. At a higher threshold, processes generating writes may be forced to participate in writeback, creating backpressure.',
      ],
    },
    {
      heading: 'Case study: the latency cliff',
      paragraphs: [
        'A service that writes logs or checkpoints may run smoothly while dirty memory grows. Then the device slows, the dirty limit is reached, or fsync forces pending data forward. Latency jumps because work that looked deferred has become foreground. The structural fix is to bound dirty data, batch commits intentionally, and measure fsync/writeback latency rather than only write() latency.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Readahead spends memory and I/O bandwidth now to reduce future waiting. Dirty writeback spends crash window and memory pressure now to batch writes later. Both policies are feedback systems. Too little readahead leaves the CPU waiting for storage; too much pollutes memory. Too little dirty buffering wastes I/O opportunities; too much creates long stalls and durability surprises.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat write() latency as durability latency. Buffered write() can be cheap because it dirties memory. fsync, writeback, or memory reclaim may pay the real bill later. Do not treat readahead as universally good either; random workloads can turn it into avoidable cache pollution.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux readahead docs in the memory-management API at https://docs.kernel.org/core-api/mm-api.html, VM dirty writeback sysctls at https://docs.kernel.org/admin-guide/sysctl/vm.html, VFS address_space docs at https://docs.kernel.org/filesystems/vfs.html, and readahead(2) at https://man7.org/linux/man-pages/man2/readahead.2.html. Study Linux Page Cache XArray, Linux Workingset Refault & Reclaim, Filesystem Extent Tree & Delayed Allocation, fsync Rename Crash Consistency, ext4 JBD2 Journal Modes, Write-Through vs Write-Back, Backpressure & Flow Control, LRU Cache, and Write-Ahead Log next.',
        'PostgreSQL Buffer Pool Clock Sweep and PostgreSQL WAL Checkpoint & Recovery show the database-level version of the same pressure: dirty shared buffers, checkpoint writeback, eviction stalls, and recovery-time bounds.',
      ],
    },
  ],
};
