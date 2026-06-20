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
        'The stall cascade view traces how a write enters RocksDB and where debt accumulates along the path from WAL through memtable, immutable memtable, L0, lower levels, and the compaction workers that service them. Active nodes are the current pressure point. Found nodes are outcomes the engine has committed to. The edge from stall back to writers is the backpressure signal that makes the whole system visible.',
        'The recovery loop view reverses the direction: measurement feeds diagnosis, diagnosis identifies the active gate, and the gate dictates which lever family to adjust. If you skip the first frame and jump to knobs, you are tuning blind.',
        {
          type: 'note',
          text: 'At each frame, ask: which queue is growing, which resource is saturated, and what evidence would prove the backlog is draining? If you cannot answer the third question, the stall has not been diagnosed.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'An LSM tree trades write speed for deferred cleanup. Foreground writes are fast because they only append to a write-ahead log and insert into an in-memory buffer. They do not reorganize the on-disk sorted structure at write time. That bargain creates an implicit contract: background flush and compaction must eventually pay the reorganization cost that writes deferred.',
        'When background work falls behind, the deferred cost accumulates as compaction debt. Without a safety mechanism, debt grows without bound: immutable memtables consume RAM, L0 files overlap and degrade reads, pending compaction bytes bloat disk, and recovery after crash takes longer. The engine needs a way to signal that the contract is in danger.',
        {
          type: 'quote',
          attribution: 'RocksDB Wiki, Write Stalls',
          text: 'Whenever write stalls are triggered, RocksDB reduces the write rate to delayed_write_rate and may eventually stop accepting writes entirely until compaction catches up.',
        },
        'Write stalls are that signal. They are not the disease. They are the immune response. The disease is a sustained imbalance between the rate at which foreground writes create work and the rate at which background compaction retires it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct when writes slow down is to raise the thresholds. If RocksDB stalls at 20 L0 files, set the limit to 40. If it stalls at 5 immutable memtables, allow 10. If it stalls at 64 GB of pending compaction bytes, set the soft limit to 128 GB. This is reasonable because it worked for short bursts: a higher threshold absorbs a bigger spike before the gate fires.',
        {
          type: 'table',
          headers: ['Knob raised', 'Short-term effect', 'Long-term risk'],
          rows: [
            ['level0_slowdown_writes_trigger', 'Absorbs more L0 files before throttling', 'Read amplification climbs because more overlapping files must be probed per lookup'],
            ['max_write_buffer_number', 'Absorbs more memtable rotations', 'RAM pressure grows; crash recovery replays more WAL'],
            ['soft_pending_compaction_bytes_limit', 'Delays throttle onset', 'Disk bloat continues; hard stall when it arrives is more severe'],
          ],
        },
        'Raising thresholds does not create disk bandwidth, CPU cycles, or compaction throughput. It borrows time. If the workload is bursty and the burst ends before the new threshold fires, the loan is repaid. If the workload is sustained, the higher threshold only makes the eventual stall deeper and the recovery longer.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is a sustained write rate that exceeds the compaction throughput of the hardware and configuration. No amount of threshold tuning changes this inequality. Consider the arithmetic: a 64 MB write buffer with 4 write buffers produces up to 256 MB of memtable data before stalling. If the flush rate is 200 MB/s but the sustained compaction throughput to lower levels is only 150 MB/s, the 50 MB/s surplus accumulates as debt every second.',
        {
          type: 'code',
          language: 'text',
          body: `Ingest rate:     200 MB/s (sustained)
Flush throughput: 200 MB/s (memtable -> L0 SST)
Compaction rate:  150 MB/s (L0 -> L1 -> L2 -> ...)
Surplus:           50 MB/s  accumulates as pending compaction bytes

After 60 seconds:  3 GB of compaction debt
After 300 seconds: 15 GB of compaction debt
Soft limit (64 GB): hit in ~21 minutes
Hard limit (256 GB): hit in ~85 minutes`,
        },
        'The arithmetic is simple but the failure is not. Each level of the LSM multiplies the write: with a size ratio of 10, one byte written to L0 may cause 10 bytes of I/O at L1, 10 more at L2, and so on. This is write amplification, and it means the effective cost of a foreground write is far larger than the foreground byte count suggests. The wall appears when write amplification times ingest rate exceeds sustained device bandwidth.',
        {
          type: 'note',
          text: 'Write amplification in leveled compaction is typically 10-30x for write-heavy workloads. A 100 MB/s foreground ingest rate can require 1-3 GB/s of sustained disk bandwidth for compaction alone. Most SSDs deliver 500 MB/s to 3 GB/s of sustained sequential write. The margin is often smaller than it appears.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RocksDB protects itself through three independent trigger families. Each monitors a different queue in the write-to-disk pipeline, and each can independently slow or stop writers.',
        {
          type: 'table',
          headers: ['Trigger family', 'What it monitors', 'Soft action', 'Hard action', 'Default soft / hard'],
          rows: [
            ['Immutable memtables', 'Count of full memtables waiting for flush', 'N/A', 'Stop all writes until flush completes', 'max_write_buffer_number (default 2)'],
            ['L0 file count', 'Number of L0 SST files', 'Delay writes (reduce to delayed_write_rate)', 'Stop writes until L0 compaction drains', '20 / 36'],
            ['Pending compaction bytes', 'Estimated bytes needing compaction across all levels', 'Delay writes proportionally', 'Stop writes', '64 GB / 256 GB'],
          ],
        },
        'The critical detail is that these gates are per-column-family but the effect is per-database. When one column family hits a stall condition, writes to every column family in the same DB instance are affected. A single hot column family running a bulk import can stall unrelated, well-behaved column families that share the instance. This is the blast-radius problem.',
        {
          type: 'diagram',
          alt: 'Three independent stall trigger queues feeding a single write gate',
          label: 'Stall trigger pipeline',
          body: `Writers ---> WAL ---> MemTable ---> Immutable MemTable(s) ---> Flush ---> L0
                                                       |                                  |
                                          Gate 1: too many immutables          Gate 2: too many L0 files
                                                                                          |
                                                                                    Compaction ---> L1 ---> L2 ---> ...
                                                                                          |
                                                                              Gate 3: pending bytes too high
                                                                                          |
                                                                                  All three gates --->  STALL / DELAY
                                                                                                            |
                                                                                                     backpressure to Writers`,
          text: `Writers ---> WAL ---> MemTable ---> Immutable MemTable(s) ---> Flush ---> L0
                                                       |                                  |
                                          Gate 1: too many immutables          Gate 2: too many L0 files
                                                                                          |
                                                                                    Compaction ---> L1 ---> L2 ---> ...
                                                                                          |
                                                                              Gate 3: pending bytes too high
                                                                                          |
                                                                                  All three gates --->  STALL / DELAY
                                                                                                            |
                                                                                                     backpressure to Writers`,
        },
        'The insight is not that stalls exist. It is that each gate monitors a different timescale. Immutable memtables measure seconds of flush lag. L0 file count measures minutes of compaction lag. Pending compaction bytes measure hours of structural debt. A fix that addresses the wrong timescale does not fix the incident.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The stall mechanism operates as a state machine with three states: normal, delayed, and stopped.',
        {
          type: 'table',
          headers: ['State', 'Condition', 'Behavior', 'Transition out'],
          rows: [
            ['Normal', 'All triggers below soft thresholds', 'Writes proceed at full speed', 'Any trigger crosses soft threshold -> Delayed'],
            ['Delayed', 'At least one trigger above soft, all below hard', 'Write rate reduced to delayed_write_rate (default 16 MB/s); rate decreases linearly as trigger approaches hard limit', 'All triggers below soft -> Normal; any trigger crosses hard -> Stopped'],
            ['Stopped', 'At least one trigger above hard threshold', 'All writes blocked; threads sleep on a condition variable', 'Compaction drains trigger below hard -> Delayed or Normal'],
          ],
        },
        'When a write thread calls DB::Put, the engine checks stall conditions before accepting the write. If the engine is in the stopped state, the write thread sleeps on a condition variable. When a compaction or flush job completes, it signals the condition variable, and sleeping writers re-check the stall conditions.',
        {
          type: 'code',
          language: 'cpp',
          body: `// Simplified from RocksDB column_family.cc RecalculateWriteStallConditions
if (imm()->NumNotFlushed() >= max_write_buffer_number) {
  write_controller->StopAll();  // Gate 1: hard stop
} else if (vstorage->l0_delay_trigger_count() >=
           level0_stop_writes_trigger) {
  write_controller->StopAll();  // Gate 2: hard stop
} else if (estimated_compaction_needed_bytes >=
           hard_pending_compaction_bytes_limit) {
  write_controller->StopAll();  // Gate 3: hard stop
} else if (l0_count >= level0_slowdown_writes_trigger) {
  // Gate 2: soft delay -- rate decreases linearly toward hard limit
  uint64_t rate = CalculateDelayedWriteRate(l0_count, ...);
  write_controller->DelayWrite(rate);
} else if (estimated_compaction_needed_bytes >=
           soft_pending_compaction_bytes_limit) {
  // Gate 3: soft delay
  uint64_t rate = CalculateDelayedWriteRate(bytes, ...);
  write_controller->DelayWrite(rate);
}`,
        },
        'The delayed write rate is not constant. Between the soft and hard thresholds, RocksDB interpolates: as the trigger value approaches the hard limit, the allowed write rate drops toward zero. This creates progressive backpressure rather than a cliff.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The stall mechanism preserves a fundamental invariant: the total amount of uncompacted data in the LSM tree remains bounded. Without this bound, three things break simultaneously.',
        {
          type: 'bullets',
          items: [
            'Read amplification: a point lookup in L0 must check every overlapping file. With 100 L0 files, a single Get may read 100 index blocks and 100 data blocks. The read path degrades linearly with L0 count.',
            'Space amplification: uncompacted data retains obsolete versions and tombstones. A key updated 50 times occupies 50 entries across levels until compaction merges them. Disk usage can reach multiples of the logical data size.',
            'Recovery time: after a crash, RocksDB replays the WAL from the last flushed memtable. More immutable memtables in flight means more WAL to replay. With 10 unflushed memtables of 64 MB each, recovery must replay 640 MB of WAL sequentially before the database is ready to serve.',
          ],
        },
        'The correctness argument is a conservation law. Every byte written to the memtable eventually reaches a stable level through flush and compaction. The stall gates bound the amount of data in transit at each stage. Because each gate independently bounds its queue, the total in-transit data is bounded by the sum of all gate limits. The system cannot accumulate unbounded debt as long as the gates are enforced.',
        {
          type: 'note',
          text: 'The stall does not guarantee that compaction will catch up. It only guarantees that writers cannot make the debt grow past a fixed bound. If the sustained compaction rate is truly below the sustained ingest rate even with full device bandwidth, the engine will spend an increasing fraction of time in the stopped state. The only resolution is reducing ingest, increasing device throughput, or changing the compaction style to reduce write amplification.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of write stalls is measured in latency variance, not throughput loss. A system averaging 100 MB/s writes over an hour may achieve that average with smooth 100 MB/s sustained, or with 200 MB/s for 30 minutes followed by 30 minutes of stall. The average is identical. The tail latency is not.',
        {
          type: 'table',
          headers: ['Metric', 'Normal state', 'Delayed state', 'Stopped state'],
          rows: [
            ['Write latency (p50)', '5-50 us', '50-500 us', 'Unbounded (seconds to minutes)'],
            ['Write throughput', 'Full device speed', 'delayed_write_rate (default 16 MB/s)', '0 MB/s'],
            ['Read latency impact', 'Minimal', 'L0 overlap growing', 'L0 overlap at maximum; compaction competing for I/O'],
            ['Memory pressure', 'Baseline', 'More immutable memtables buffered', 'Maximum immutable memtable count'],
            ['Recovery time after crash', 'WAL replay of 1-2 memtables', 'WAL replay of multiple memtables', 'Maximum WAL replay'],
          ],
        },
        'Write amplification dominates the practical cost. In leveled compaction with a size ratio of 10, a write to L0 may be rewritten log2(N/L0_size) / log2(10) times as it moves through levels. For a 1 TB database with 64 MB L0 files, that is roughly 4 levels, each amplifying by up to 10x. The total write amplification can reach 10-40x, meaning each byte of foreground write costs 10-40 bytes of disk I/O.',
        'The space cost of pending compaction is linear: every byte of pending compaction is a byte of disk occupied by data that will eventually be rewritten or deleted. A 50 GB pending compaction debt means 50 GB of disk space is consumed by transient data that the compaction pipeline has not yet processed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A Flink streaming job uses RocksDB as its state backend. Default configuration: 64 MB write buffer, 2 write buffers, leveled compaction, L0 slowdown trigger at 20, L0 stop trigger at 36, soft pending bytes limit at 64 GB, hard pending bytes limit at 256 GB. The state store holds 200 GB of keyed state, and normal traffic produces 30 MB/s of state updates.',
        {
          type: 'code',
          language: 'text',
          body: `T=0   Normal traffic. 30 MB/s ingest. Compaction keeps up at ~35 MB/s.
      L0 files: 4. Pending bytes: 2 GB. State: NORMAL.

T=5m  Backfill starts. Ingest jumps to 120 MB/s.
      Memtables rotate every 0.5s. Flush produces L0 files rapidly.
      L0 files: 8. Pending bytes: 5 GB. State: NORMAL.

T=10m L0 files accumulate because L0->L1 compaction cannot keep pace.
      L0 files: 15. Pending bytes: 18 GB. State: NORMAL (approaching soft).

T=15m L0 count crosses 20. Soft gate fires.
      Write rate reduced to 16 MB/s. Application sees p99 write latency
      jump from 200 us to 50 ms. Flink checkpoint duration increases.
      L0 files: 22. Pending bytes: 38 GB. State: DELAYED.

T=20m Backfill continues pushing at 120 MB/s but only 16 MB/s accepted.
      Application-side queue grows. Flink starts backpressuring upstream.
      L0 files: 28. Pending bytes: 55 GB. State: DELAYED.

T=25m L0 count crosses 36. Hard gate fires.
      All writes blocked. Flink checkpoint fails (timeout).
      L0 files: 37. Pending bytes: 62 GB. State: STOPPED.

T=28m Compaction drains L0 below 36. Writes resume at delayed rate.
      L0 files: 34. Pending bytes: 58 GB. State: DELAYED.

T=35m Operator pauses backfill. Ingest drops to 30 MB/s.
      Compaction works through debt. L0 files fall steadily.
      L0 files: 12. Pending bytes: 25 GB. State: DELAYED -> NORMAL.

T=50m Debt fully drained. System returns to steady state.
      L0 files: 4. Pending bytes: 3 GB. State: NORMAL.`,
        },
        {
          type: 'note',
          text: 'The incident lasted 35 minutes but the root cause appeared at T=5m when ingest rate exceeded compaction throughput. The stall at T=25m was 20 minutes of accumulated debt becoming visible. The fix was not a setting change -- it was pausing the backfill to let compaction catch up.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Write stalls appear wherever RocksDB is embedded, which means they surface inside systems that do not mention RocksDB in their user-facing documentation.',
        {
          type: 'table',
          headers: ['System', 'How RocksDB is used', 'How stalls manifest'],
          rows: [
            ['Apache Flink', 'State backend for keyed state in streaming jobs', 'Checkpoint timeouts, backpressure spikes, processing lag'],
            ['CockroachDB', 'Storage engine under each node (Pebble, a RocksDB-inspired Go engine)', 'Raft proposal latency spikes, leaseholder write stalls, follower apply lag'],
            ['TiKV (TiDB storage)', 'Key-value engine under Raft consensus', 'Region write latency spikes, scheduler pending counts, Raft log apply delays'],
            ['MyRocks (MySQL)', 'RocksDB as MySQL storage engine replacing InnoDB for write-heavy workloads', 'INSERT/UPDATE latency spikes, replication lag on replicas running compaction'],
            ['Kafka Streams', 'State store backend (optional RocksDB)', 'Consumer lag, rebalance storms triggered by slow state restoration'],
          ],
        },
        'The pattern generalizes beyond RocksDB. Any system that defers reorganization work to a background process has a version of this problem. B-tree databases defer page splits and vacuum. Log-structured file systems defer segment cleaning. Garbage-collected languages defer heap compaction. The specific triggers differ, but the shape is identical: fast foreground operations create cleanup debt, background capacity is finite, and when debt exceeds capacity, the system must throttle the foreground to survive.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The stall mechanism has known failure modes that operators must understand.',
        {
          type: 'bullets',
          items: [
            'Disabling stalls does not remove the problem. Setting level0_stop_writes_trigger to a very large number lets L0 files grow without bound. Read latency degrades continuously. Disk usage grows. Compaction falls further behind because merge cost grows with L0 file count. The incident reappears as a read latency or disk-full crisis instead of a write stall.',
            'Column family blast radius is unavoidable in a single DB instance. If one column family triggers a stall, all column families in the same DB are affected. The only isolation boundary is a separate DB instance, which means separate WAL, separate memtable pool, and separate file namespace.',
            'Rate limiter conflicts: RocksDB rate limiter (NewGenericRateLimiter) caps total I/O across compaction and flush. If set too low to protect foreground read I/O, it also throttles compaction, which increases debt, which eventually triggers stalls anyway. The rate limiter must be tuned alongside stall thresholds, not independently.',
            'Universal compaction trades write amplification for space amplification. It produces fewer write stalls under heavy ingest because it avoids the level-by-level merge cost, but it can cause sudden large compactions (full-sort merges) that temporarily consume large amounts of disk space and I/O bandwidth.',
            'Threshold tuning is non-portable. Optimal stall thresholds depend on device bandwidth, CPU count, memtable size, key-value size distribution, compression ratio, and workload burstiness. Settings that work on NVMe SSDs will stall immediately on network-attached storage. Settings tuned for 100-byte values will behave differently with 10 KB values.',
          ],
        },
        'The deepest failure is treating stalls as a tuning problem when they are a capacity problem. If sustained ingest rate times write amplification exceeds sustained device bandwidth, no configuration change can prevent stalls. The options are: reduce ingest rate, reduce write amplification (change compaction style or reduce size ratio), increase device bandwidth (faster disks, more instances), or accept periodic stalls as normal operating behavior and design the application to tolerate them.',
      ],
    },
    {
      heading: 'Worked example: diagnosis',
      paragraphs: [
        'Given an active write stall, the diagnosis procedure follows a fixed order.',
        {
          type: 'code',
          language: 'text',
          body: `Step 1: Identify the active gate
  $ grep -i "stall" LOG | tail -20
  > 2024-03-15T14:22:03 Stalling writes because we have 37 level-0 files
  Gate identified: L0 file count (hard stop at 36).

Step 2: Measure the debt
  $ ./ldb --db=/data/rocksdb dump_live_files | grep "^Level" | head
  > Level 0: 37 files, 2.3 GB
  > Level 1: 12 files, 640 MB
  > Level 2: 45 files, 6.1 GB
  > Level 3: 180 files, 58 GB
  L0 is 37 files (above 36 stop trigger). L1 is small relative to L2.
  This suggests L0->L1 compaction is the bottleneck.

Step 3: Check device saturation
  $ iostat -x 1 5 | grep nvme0n1
  > nvme0n1  95.2%  wMB/s=480  rMB/s=120
  Device is near saturation. Compaction I/O is competing with flush I/O.

Step 4: Check compaction stats
  $ ./ldb --db=/data/rocksdb get_property rocksdb.cfstats
  > Cumulative compaction: 12.5 GB written, 8.2 GB read
  > Stall time: 340 seconds (L0 file count)
  > Write amplification: 18.2

Step 5: Decision
  Device is saturated. Write amplification is 18x.
  Effective compaction cost = 120 MB/s ingest * 18 = 2.16 GB/s needed.
  Device delivers ~500 MB/s write bandwidth.
  This is a capacity problem, not a threshold problem.
  Fix: pace ingest to 25-30 MB/s, or split across 4 instances.`,
        },
        'The diagnosis reveals that no single knob change fixes this stall. The ingest rate multiplied by write amplification exceeds the device. The correct response is either reducing ingest or distributing the workload across more instances to bring each instance into the sustainable envelope.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: RocksDB Wiki "Write Stalls" page. Documents all three trigger families, their default thresholds, the delayed-write-rate interpolation, and the per-column-family blast radius.',
            'Implementation source: column_family.cc RecalculateWriteStallConditions in the RocksDB source code. The actual gate logic is roughly 200 lines and directly readable.',
            'Tuning guide: RocksDB Tuning Guide wiki page. Covers write buffer sizing, L0 trigger tuning, compaction thread count, rate limiter configuration, and compaction style selection.',
            'Production case study: "Optimizing RocksDB for Flink" by Ververica. Documents real stall incidents in streaming state backends, with before/after configurations and measurements.',
            'LSM-tree theory: "The Log-Structured Merge-Tree" by O\'Neil et al. (1996). The original paper defines the merge cost model that explains why write amplification is fundamental, not incidental.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'LSM Compaction Strategies Primer', 'Leveled, universal, and FIFO compaction produce different write amplification, which directly determines when stalls occur'],
            ['Prerequisite', 'Write-Ahead Log', 'The WAL is the durability mechanism that memtable rotation depends on; understanding WAL replay is necessary for the immutable-memtable gate'],
            ['Extension', 'Rate Limiter', 'The rate limiter shapes I/O between compaction, flush, and foreground reads; tuning it incorrectly causes the stalls this page diagnoses'],
            ['Extension', 'Backpressure & Flow Control', 'The stall mechanism is a specific instance of the general backpressure pattern; this topic generalizes the idea'],
            ['Sibling case study', 'RocksDB LSM Case Study', 'Covers the full LSM structure that this page assumes; start there if the level terminology is unfamiliar'],
            ['Application', 'Tail Latency & p99 Thinking', 'Write stalls are a primary source of tail latency in storage-backed services; this topic explains why p99 matters'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you name the three independent stall trigger families and the queue each one monitors?',
            'Can you explain why raising level0_stop_writes_trigger from 36 to 72 might make an incident worse rather than better?',
            'Can you calculate whether a given ingest rate is sustainable, given write amplification and device bandwidth?',
            'Can you explain why a stall in one column family affects writes to all column families in the same DB instance?',
            'Given a LOG line that says "Stalling writes because we have 5 immutable memtables," can you name the first three things to check?',
          ],
        },
      ],
    },
  ],
};

