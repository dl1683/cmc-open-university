// RocksDB write stalls: compaction debt turns a local LSM backlog into global
// write latency through memtable, L0, and pending-byte safety triggers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rocksdb-write-stall-compaction-debt-case-study',
  title: 'RocksDB Write Stalls & Compaction Debt',
  category: 'Systems',
  summary: 'A production LSM case study: immutable memtables, L0 files, pending compaction bytes, delayed writes, hard stalls, and recovery levers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stall cascade', 'recovery loop'], defaultValue: 'stall cascade' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function stallGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'writers', label: 'writers', x: 0.7, y: 3.8, note: notes.writers ?? 'puts' },
      { id: 'wal', label: 'WAL', x: 2.2, y: 2.1, note: notes.wal ?? 'append' },
      { id: 'mem', label: 'mem', x: 2.2, y: 5.3, note: notes.mem ?? 'mutable' },
      { id: 'imm', label: 'immut', x: 4.0, y: 5.3, note: notes.imm ?? 'flush' },
      { id: 'l0', label: 'L0', x: 5.6, y: 2.1, note: notes.l0 ?? 'overlap' },
      { id: 'l1', label: 'L1+', x: 7.0, y: 3.8, note: notes.l1 ?? 'levels' },
      { id: 'compact', label: 'compact', x: 7.0, y: 6.0, note: notes.compact ?? 'workers' },
      { id: 'debt', label: 'debt', x: 8.6, y: 2.1, note: notes.debt ?? 'bytes' },
      { id: 'stall', label: 'stall', x: 9.4, y: 4.9, note: notes.stall ?? 'delay' },
    ],
    edges: [
      { id: 'e-w-wal', from: 'writers', to: 'wal', weight: notes.ewal ?? '' },
      { id: 'e-w-mem', from: 'writers', to: 'mem', weight: notes.emem ?? '' },
      { id: 'e-mem-imm', from: 'mem', to: 'imm', weight: notes.eimm ?? 'full' },
      { id: 'e-imm-l0', from: 'imm', to: 'l0', weight: notes.el0 ?? 'flush' },
      { id: 'e-l0-l1', from: 'l0', to: 'l1', weight: notes.el1 ?? 'merge' },
      { id: 'e-l1-debt', from: 'l1', to: 'debt', weight: notes.edebt ?? 'size' },
      { id: 'e-compact-l0', from: 'compact', to: 'l0', weight: notes.ecomp ?? 'pick' },
      { id: 'e-debt-stall', from: 'debt', to: 'stall', weight: notes.estall ?? 'gate' },
      { id: 'e-stall-writers', from: 'stall', to: 'writers', weight: notes.back ?? 'slow' },
    ],
  }, { title });
}

function debtPlot(title) {
  return plotState({
    axes: {
      x: { label: 'minutes', min: 0, max: 12 },
      y: { label: 'relative load', min: 0, max: 110 },
    },
    series: [
      { id: 'ingest', label: 'ingest', points: [{ x: 0, y: 25 }, { x: 2, y: 35 }, { x: 4, y: 65 }, { x: 6, y: 88 }, { x: 8, y: 92 }, { x: 10, y: 55 }, { x: 12, y: 35 }] },
      { id: 'compact', label: 'compact', points: [{ x: 0, y: 38 }, { x: 2, y: 40 }, { x: 4, y: 43 }, { x: 6, y: 45 }, { x: 8, y: 48 }, { x: 10, y: 66 }, { x: 12, y: 72 }] },
      { id: 'debt', label: 'debt', points: [{ x: 0, y: 8 }, { x: 2, y: 12 }, { x: 4, y: 26 }, { x: 6, y: 58 }, { x: 8, y: 92 }, { x: 10, y: 70 }, { x: 12, y: 38 }] },
      { id: 'stall', label: 'stall', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 6 }, { x: 6, y: 28 }, { x: 8, y: 72 }, { x: 10, y: 32 }, { x: 12, y: 8 }] },
    ],
    markers: [
      { id: 'soft', x: 6, y: 58, label: 'soft gate' },
      { id: 'hard', x: 8, y: 92, label: 'hard gate' },
    ],
  }, { title });
}

function* stallCascade() {
  yield {
    state: stallGraph('Normal writes pay WAL now and compaction later'),
    highlight: { active: ['writers', 'wal', 'mem', 'e-w-wal', 'e-w-mem'], found: ['compact'] },
    explanation: 'The healthy path is fast because foreground writes only append to the WAL and update a memtable. The graph already shows the bargain: flush and compaction must later pay the cleanup bill that writers deferred.',
    invariant: 'Fast foreground writes are a promise that background cleanup will keep up.',
  };

  yield {
    state: stallGraph('Immutable memtables pile up when flush is behind', {
      imm: 'many',
      compact: 'busy',
      stall: 'watch',
      eimm: 'rotate',
      el0: 'wait',
    }),
    highlight: { active: ['mem', 'imm', 'compact', 'e-mem-imm'], compare: ['stall'] },
    explanation: 'The immutable-memtable step shows the first backlog. A full memtable is normal; too many full memtables waiting for flush means foreground ingest is outrunning the path to L0, so RocksDB has to slow or stop writers.',
    invariant: 'A full memtable is not the stall; too many unflushed memtables are.',
  };

  yield {
    state: stallGraph('Too many L0 files make reads and compaction worse', {
      l0: 'many',
      l1: 'overlap',
      compact: 'behind',
      debt: 'rising',
      el0: 'spill',
      el1: 'fanout',
    }),
    highlight: { active: ['l0', 'l1', 'compact', 'e-imm-l0', 'e-l0-l1'], compare: ['debt'] },
    explanation: 'L0 is special because files can overlap. As the highlighted L0 pile grows, reads may probe more files and compaction has a harder merge. A local file-count problem becomes user-visible latency.',
  };

  yield {
    state: labelMatrix(
      'Write-stall triggers',
      [
        { id: 'mem', label: 'immut mem' },
        { id: 'l0', label: 'L0 files' },
        { id: 'bytes', label: 'debt bytes' },
        { id: 'cf', label: 'one CF' },
      ],
      [
        { id: 'soft', label: 'slow path' },
        { id: 'hard', label: 'hard path' },
      ],
      [
        ['stall writes', 'stop flush'],
        ['delay writes', 'stop L0'],
        ['delay rate', 'stop debt'],
        ['hits all DB', 'global pain'],
      ],
    ),
    highlight: { active: ['mem:hard', 'l0:hard', 'bytes:hard'], found: ['cf:soft'] },
    explanation: 'The trigger table names the gates RocksDB uses to protect itself: immutable memtables, L0 files, and estimated pending compaction bytes. One hot column family can trip a gate that hurts writes to the whole DB.',
  };

  yield {
    state: debtPlot('Compaction debt becomes a latency incident'),
    highlight: { active: ['ingest', 'debt'], compare: ['compact'], found: ['stall', 'soft', 'hard'] },
    explanation: 'The plot is the incident shape. Ingest rises above cleanup capacity, compaction debt accumulates, soft gates add delay, and hard gates stop writers until background work drains enough backlog.',
    invariant: 'The stall is a safety valve, not the root cause.',
  };

  yield {
    state: labelMatrix(
      'User symptoms',
      [
        { id: 'write', label: 'writes' },
        { id: 'read', label: 'reads' },
        { id: 'disk', label: 'disk' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['p99 spikes', 'stall gate'],
        ['more probes', 'L0 overlap'],
        ['busy writes', 'merge IO'],
        ['LOG lines', 'trigger named'],
      ],
    ),
    highlight: { active: ['write:signal', 'ops:signal'], compare: ['read:reason', 'disk:reason'] },
    explanation: 'The symptom table separates user pain from root evidence. Applications see write p99 spikes; operators need RocksDB LOG lines, stall counters, L0 file counts, pending bytes, compaction stats, and disk bandwidth.',
  };
}

function* recoveryLoop() {
  yield {
    state: graphState({
      nodes: [
        { id: 'log', label: 'LOG', x: 1.0, y: 2.0, note: 'stall text' },
        { id: 'stats', label: 'stats', x: 1.0, y: 3.8, note: 'STALL us' },
        { id: 'io', label: 'iostat', x: 1.0, y: 5.6, note: 'disk MB/s' },
        { id: 'perf', label: 'perf', x: 1.0, y: 7.1, note: 'probes' },
        { id: 'gate', label: 'gate', x: 3.4, y: 2.9, note: 'which?' },
        { id: 'amount', label: 'amount', x: 3.4, y: 4.7, note: 'how bad' },
        { id: 'disk', label: 'disk', x: 5.7, y: 4.0, note: 'full?' },
        { id: 'amp', label: 'read amp', x: 5.7, y: 6.2, note: 'SST count' },
        { id: 'tune', label: 'tune', x: 8.1, y: 4.9, note: 'target' },
      ],
      edges: [
        { id: 'e-log-gate', from: 'log', to: 'gate' },
        { id: 'e-stats-amount', from: 'stats', to: 'amount' },
        { id: 'e-io-disk', from: 'io', to: 'disk' },
        { id: 'e-perf-amp', from: 'perf', to: 'amp' },
        { id: 'e-gate-tune', from: 'gate', to: 'tune' },
        { id: 'e-amount-tune', from: 'amount', to: 'tune' },
        { id: 'e-disk-tune', from: 'disk', to: 'tune' },
        { id: 'e-amp-tune', from: 'amp', to: 'tune' },
      ],
    }, { title: 'Diagnose before tuning' }),
    highlight: { found: ['gate', 'amount', 'disk'], active: ['amp', 'tune'] },
    explanation: 'The recovery view starts with measurement on purpose. RocksDB gives LOG lines, DB stats, stall counters, Perf Context, IO stats, and host disk metrics. If you cannot name the active gate, tuning is just pressure roulette.',
    invariant: 'A blind RocksDB tuning change is just moving pressure somewhere else.',
  };

  yield {
    state: stallGraph('Recovery makes cleanup capacity visible to writers', {
      writers: 'paced',
      imm: 'drain',
      l0: 'falling',
      compact: 'more work',
      debt: 'lower',
      stall: 'clear',
      back: 'resume',
    }),
    highlight: { active: ['compact', 'imm', 'l0', 'debt', 'e-compact-l0'], found: ['writers'], removed: ['stall'] },
    explanation: 'The cleared-stall graph shows the only real recovery: debt drains. That can happen because background work catches up, foreground ingest slows down, or both. A cosmetic knob that leaves debt rising has not fixed the incident.',
  };

  yield {
    state: labelMatrix(
      'Knob families',
      [
        { id: 'buffer', label: 'buffers' },
        { id: 'l0', label: 'L0 gates' },
        { id: 'threads', label: 'workers' },
        { id: 'rate', label: 'rate limit' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['burst room', 'more RAM'],
        ['early signal', 'more delay'],
        ['catch up', 'IO fight'],
        ['smooth IO', 'less peak'],
      ],
    ),
    highlight: { active: ['buffer:helps', 'threads:helps', 'rate:helps'], compare: ['buffer:risk', 'threads:risk'] },
    explanation: 'The knob table is a set of lever families, not magic constants. Buffers, L0 gates, workers, compaction priority, and rate limits each move pressure between RAM, disk, CPU, and foreground latency.',
  };

  yield {
    state: labelMatrix(
      'Shape the LSM',
      [
        { id: 'leveled', label: 'leveled' },
        { id: 'univ', label: 'universal' },
        { id: 'fifo', label: 'FIFO' },
        { id: 'ttl', label: 'time win' },
      ],
      [
        { id: 'good', label: 'good for' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['reads/space', 'more write'],
        ['bulk ingest', 'space/read'],
        ['cache data', 'query limits'],
        ['TTL data', 'age rules'],
      ],
    ),
    highlight: { found: ['leveled:good', 'univ:good', 'fifo:good', 'ttl:good'], compare: ['univ:cost'] },
    explanation: 'The LSM-shape table is the deeper fix. If the compaction style does not match the table, adding workers may only make the wrong policy run faster and hurt another metric.',
  };

  yield {
    state: labelMatrix(
      'Protect the service',
      [
        { id: 'ingest', label: 'ingest' },
        { id: 'cf', label: 'CF split' },
        { id: 'tenant', label: 'tenants' },
        { id: 'alert', label: 'alerts' },
      ],
      [
        { id: 'control', label: 'control' },
        { id: 'why', label: 'why' },
      ],
      [
        ['token cap', 'source slows'],
        ['isolate hot', 'blast radius'],
        ['quota', 'fair share'],
        ['burn rate', 'early page'],
      ],
    ),
    highlight: { active: ['ingest:control', 'tenant:control'], found: ['cf:why', 'alert:why'] },
    explanation: 'This table moves the boundary upward. RocksDB can protect itself, but the service should also pace ingest, isolate hot column families, enforce tenant quotas, and alert before hard stalls reach users.',
  };

  yield {
    state: labelMatrix(
      'Runbook gates',
      [
        { id: 'soft', label: 'soft gate' },
        { id: 'hard', label: 'hard gate' },
        { id: 'after', label: 'after fix' },
        { id: 'review', label: 'review' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['pace load', 'STALL us'],
        ['shed writes', 'hard logs'],
        ['watch debt', 'L0 falls'],
        ['retune', 'shape fits'],
      ],
    ),
    highlight: { active: ['soft:action', 'hard:action'], found: ['after:evidence', 'review:evidence'] },
    explanation: 'The runbook table is the operational close. It separates soft slowdown from hard stop, names the evidence that debt is draining, and forces the post-incident question: did the LSM shape fit the workload?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stall cascade') yield* stallCascade();
  else if (view === 'recovery loop') yield* recoveryLoop();
  else throw new InputError('Pick a RocksDB write-stall view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation is a pressure gauge for a log-structured merge tree (LSM tree). An LSM tree accepts new writes into memory, flushes sorted files to disk, and merges those files in the background. The foreground write path looks fast until the background merge work, called compaction, falls behind. When it does, the gauge enters yellow (delayed) or red (stopped).',
        'Watch three counters. Immutable memtables counts how many full memory buffers are waiting to be flushed to disk. Level-zero files counts how many freshly flushed files overlap the same key ranges. Pending compaction bytes estimates how much rewrite work remains across deeper levels. Each counter has a slow-down threshold and a stop threshold. When any counter crosses its slow-down threshold, new writes sleep briefly before proceeding. When any crosses its stop threshold, writers block entirely until a background job reduces the pressure.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'RocksDB is an embedded key-value storage engine. Embedded means the application links RocksDB into its own process as a library instead of talking to a separate server over the network. It is built for high write rates by turning random key-value updates into mostly sequential appends: the write path appends to a log and inserts into sorted memory, and a background loop converts memory into sorted disk files and later merges those files.',
        'That design moves cost from the foreground write into later compaction. A write stall exists because the engine must protect itself from accepting more foreground work than its background workers and storage device can clean up. Without backpressure, the number of overlapping files would grow, reads would probe too many files, disk space would balloon with old versions, and crash recovery would take longer. The stall is not a failure; it is admission control that makes overload visible instead of silent.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious fix is to raise the limits. A team sees stalls, increases the level-zero file trigger from 20 to 36, allows more pending compaction bytes, or doubles the write buffer size. The latency graph improves for the next burst because RocksDB is now willing to hold more unpaid work before slowing writers.',
        'That fix works only when the burst is short and the system has spare cleanup capacity waiting to catch up. Raising a threshold does not create more disk bandwidth, more CPU time, or more compaction threads. It only moves the point where the application first feels the debt. If the sustained ingest rate exceeds the sustained cleanup rate, the debt still grows -- it just grows invisibly for longer before the stall hits.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a conservation law. If foreground writes add data faster than compaction can rewrite and discard old versions, the backlog must grow. No threshold setting changes this arithmetic; thresholds only control when the engine admits the debt exists.',
        'Suppose a data import writes 120 MB/s and measured write amplification is 18x, meaning every user byte eventually causes about 18 bytes of physical device writes across flushes and level-to-level compactions. Staying even requires 2,160 MB/s of sustained write throughput from the storage device. If the device can supply only 500 MB/s after reads, checksums, and operating system overhead, the system is not slightly mistuned; it is accumulating 1,660 MB/s of cleanup demand that must be paid before level-zero files stop growing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A write stall is backpressure from compaction debt. The key is to treat each stall reason as a specific queue-control signal, not as generic latency. Each reason names the internal queue that crossed its limit, and the correct fix depends on which queue it is.',
        'Immutable memtable stalls mean memory is filling faster than flush can write sorted files to disk. The bottleneck is flush throughput: too few flush threads, too slow a device, or too many column families competing for the same flush pipeline. Level-zero stalls mean too many freshly flushed files overlap the same key ranges, which makes point lookups expensive because each L0 file must be checked. Pending compaction byte stalls mean the engine estimates that deeper levels have accumulated too much merge work. Each diagnosis points to a different lever.',
        {type:'callout', text:'A RocksDB write stall is backpressure from accumulated compaction debt, not a random pause in the write path. Each stall reason names the internal queue that overflowed.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Before accepting a write, RocksDB checks whether the target column family is in normal, delayed, or stopped state. A column family is a named key-value namespace with its own memtables, SST files, and compaction settings, similar to a table in a relational database. If the state is delayed, the writer sleeps for a calculated interval proportional to how close the counter is to the stop threshold. If the state is stopped, the writer blocks on a condition variable until a background flush or compaction job finishes and lowers the pressure.',
        'The engine transitions between states by checking three counters after every background job completes. If the number of immutable memtables exceeds max_write_buffer_number minus one, the flush pipeline is full. If L0 file count exceeds level0_slowdown_writes_trigger, the top of the LSM tree is congested. If estimated pending compaction bytes exceeds soft_pending_compaction_bytes_limit, deeper levels have accumulated too much merge debt. When a background job finishes, RocksDB recomputes all three and may wake sleeping writers.',
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/f2/LSM_Tree.png', alt:'Diagram of an LSM tree with data moving from memory into multiple sorted on-disk levels.', caption:'LSM tree diagram showing memory, L0, and deeper levels. Write stalls trigger when any of the three queues -- immutable memtables, L0 files, or pending compaction bytes -- exceeds its configured threshold. Source: Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is straightforward. A stall does not change the order or content of any committed write. Writes already accepted still follow their normal path through WAL, memtable, flush, and compaction. A stall only delays future writes before they enter that path. No data is lost, reordered, or corrupted.',
        'The control argument is separate. By blocking new write admission when internal queues exceed known limits, RocksDB keeps the file layout within ranges where reads remain fast (fewer overlapping files), space use stays bounded (old versions get compacted away), and crash recovery completes quickly (fewer WAL segments to replay). The cost is visible write latency. The alternative is invisible growth in deferred work that eventually produces the same latency spike, but without warning and potentially with data loss if the system runs out of disk space.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost appears as behavior, not just as resource counters. Users see higher p99 write latency, lower throughput, and sometimes synchronized slowdowns across tasks sharing the same disk. Operators see compaction CPU saturation, disk write bandwidth at capacity, and level-zero file counts hovering near the stop threshold. The stall itself is cheap (a sleep or a condition-variable wait), but the debt that caused it represents real device work that must be done.',
        'The complexity is that every local fix has a side effect. More write buffer memory reduces flush frequency but increases crash-recovery time and memory pressure. More compaction threads clear debt faster but steal CPU and I/O bandwidth from reads. Higher slow-down triggers reduce short stalls but make each eventual stall worse when the capacity mismatch is real. Tuning without measuring write amplification and device throughput is guessing.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Write-stall analysis matters anywhere RocksDB serves as a local state engine. Apache Flink uses a RocksDB state backend where every windowed aggregation and keyed-state update is a RocksDB put; a stall during a backfill freezes the entire Flink task. TiKV stores Raft-replicated key ranges in RocksDB; a stall on one node delays Raft apply and propagates latency to the distributed transaction layer. MyRocks replaces InnoDB with RocksDB as a MySQL storage engine; a stall surfaces as elevated query latency for write-heavy tables.',
        'The general lesson extends beyond RocksDB. Many systems make the fast path cheap by deferring cleanup: log-structured file systems defer garbage collection, write-behind caches defer flushing, and event queues defer processing. A stall is the moment where deferred work stops being an implementation detail and becomes the dominant workload. The diagnostic habit is the same: identify which internal queue overflowed, measure the ingest rate against the drain rate, and check whether a sustainable operating point exists.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Stall tuning fails when the workload has no sustainable operating point on the available hardware. If user write rate multiplied by write amplification exceeds the device write throughput available after reads and other work, the only durable fixes are lower ingest rate, lower amplification (different compaction style, smaller values, better key locality), more device capacity, or a fundamentally different storage layout. Raising thresholds only changes when the pain arrives.',
        'It also fails when operators treat all stalls the same. An immutable-memtable stall points at flush throughput and write buffer sizing. A level-zero stall points at top-of-tree compaction bandwidth. A pending-byte stall points at deeper compaction shape, compression CPU cost, or sustained device bandwidth. Applying the wrong fix -- such as adding compaction threads for a flush bottleneck -- wastes resources and leaves the real queue untouched.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Flink job normally writes 30 MB/s of state updates into RocksDB. During a backfill, the rate jumps to 120 MB/s for ten minutes. Measured write amplification is 15x, meaning every user byte eventually causes 15 bytes of physical device writes across flushes and compactions. Staying even during the backfill requires 120 * 15 = 1,800 MB/s of sustained device write throughput.',
        'The local NVMe SSD can give RocksDB about 900 MB/s of write bandwidth while reads and Flink checkpoints are running. Compaction debt accumulates at 1,800 - 900 = 900 MB/s. After 60 seconds, the unpaid work is roughly 54 GB. Level-zero file count climbs past level0_slowdown_writes_trigger (default 20), and writes begin sleeping. Seconds later, it passes level0_stop_writes_trigger (default 36), and writers block entirely. The Flink task freezes until compaction drains enough L0 files.',
        'Now change one number: reduce the backfill rate to 45 MB/s. Required physical throughput becomes 45 * 15 = 675 MB/s, well within the 900 MB/s budget. L0 files stay below the slow-down trigger. The stall disappears not because a threshold changed, but because the offered work now fits inside the available cleanup capacity. The diagnostic question is always: does ingest times amplification exceed device throughput?',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with the RocksDB Wiki pages on Write Stalls, Leveled Compaction, and Tuning RocksDB. These document the exact threshold names (level0_slowdown_writes_trigger, level0_stop_writes_trigger, soft_pending_compaction_bytes_limit, hard_pending_compaction_bytes_limit) and their defaults. Then read the RocksDB source around ColumnFamilyData::RecalculateWriteStallConditions to see how the three counters feed into the delayed/stopped state machine.',
        'For the underlying data structure, read the original LSM-tree paper by O\'Neil, Cheng, Gawlick, and O\'Neil (1996). For production experience, study the FAST 2021 paper on RocksDB at scale, and tuning notes from Flink state backends, MyRocks, and TiKV. From here, study LSM Compaction and SSTable Layout to understand the merge machinery that write stalls are protecting.',
      ],
    },
  ],
};

