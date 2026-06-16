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
    explanation: 'The healthy RocksDB write path is fast because user writes append to the WAL and update a memtable. Flush and compaction pay the cleanup bill in the background.',
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
    explanation: 'When memtables become immutable faster than flush can write them out, RocksDB eventually has to slow or stop new writers. Otherwise memory pressure grows without a bound.',
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
    explanation: 'Level 0 is special: files can overlap. As L0 file count grows, reads may probe more files and compaction has a larger merge problem. A small local backlog becomes user-visible latency.',
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
    explanation: 'The official RocksDB write-stall docs name three major trigger families: too many immutable memtables, too many L0 files, and too many estimated bytes pending compaction. A trigger in one column family can stall writes for the whole DB.',
  };

  yield {
    state: debtPlot('Compaction debt becomes a latency incident'),
    highlight: { active: ['ingest', 'debt'], compare: ['compact'], found: ['stall', 'soft', 'hard'] },
    explanation: 'The incident shape is a feedback loop. Ingest climbs above flush and compaction capacity. Debt accumulates. Soft gates add delay. Hard gates stop writers until background work lowers the backlog.',
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
    explanation: 'Write stalls look like application latency, but the evidence lives in storage-engine counters, LOG messages, compaction stats, L0 file count, pending bytes, and disk write bandwidth.',
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
    explanation: 'The first move is measurement. RocksDB exposes LOG lines, compaction and DB stats, stall counters, Perf Context, IO stats, and ordinary host disk metrics. Tune the bottleneck you can name.',
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
    explanation: 'Recovery means background work catches up or foreground ingest slows down. More flush capacity, more compaction capacity, better rate limits, or lower ingest all reduce the same debt.',
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
    explanation: 'Mitigations are knob families, not magic constants: write buffers, L0 slowdown/stop thresholds, background worker counts, compaction priority, and rate limiters each change where pressure shows up.',
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
    explanation: 'Sometimes the fix is not a larger thread pool. The compaction style should match the table: read-heavy service, bulk ingest, cache-like expiration, or time-windowed data.',
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
    explanation: 'Backpressure belongs above RocksDB too. Batch ingest can obey a token bucket, tenants can have quotas, hot column families can be isolated, and alerts can fire before hard stalls hit users.',
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
    explanation: 'A good runbook distinguishes soft slowdown from hard stop. It names the source of load, the evidence that debt is draining, and the post-incident tuning question: did the LSM shape match the workload?',
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
      heading: 'What it is',
      paragraphs: [
        'A RocksDB write stall is a safety mechanism that slows or stops foreground writes when flush or compaction cannot keep up with incoming writes. It is not random database bad luck. It is the storage engine refusing to let an LSM backlog grow until disk space, read amplification, or memory pressure collapses the process.',
        'The data-structure lesson is that an LSM tree is a deferred-work machine. The WAL and memtable make the write path fast. SSTables and compaction make the write path eventually clean. Write stalls are what happen when the deferred work ledger gets too far behind.',
      ],
    },
    {
      heading: 'How the cascade forms',
      paragraphs: [
        'The normal path is simple: writers append to the Write-Ahead Log, update a mutable memtable, rotate full memtables into immutable memtables, flush them into L0 SSTables, and compact those files down the level hierarchy. Reads consult memtables, L0, lower levels, filters, indexes, and block cache.',
        'The cascade starts when the foreground write rate exceeds the background cleanup rate. Immutable memtables wait for flush. L0 files accumulate. Because L0 files overlap, reads become more expensive and compactions have more work to do. Estimated pending compaction bytes rise. RocksDB responds with soft slowdown or hard stop gates.',
        'The official RocksDB write-stall documentation names three trigger families: too many immutable memtables, too many level-0 SST files, and too many estimated bytes pending compaction. It also notes the operational edge case that the slowdown and stop triggers are per column family, but a triggered stall can affect writes to the whole DB.',
      ],
    },
    {
      heading: 'Production incident case study',
      paragraphs: [
        'Imagine a stream-processing state store using RocksDB for local durable keyed state. A new customer turns on a high-cardinality backfill. Foreground writes climb. Flush threads cannot drain immutable memtables fast enough. L0 files cross slowdown thresholds. Reads now touch more files, so checkpoint and query latency rise. Pending compaction bytes pass the soft limit, then the hard limit. The application sees write p99 spikes even though the root cause is compaction debt.',
        'The evidence should not be guessed from application logs alone. Look at RocksDB LOG lines, compaction stats, STALL_MICROS, number of L0 files, immutable memtable count, estimated pending compaction bytes, disk write bandwidth, block-cache hit rate, and Perf Context or IO Stats Context for queries that suddenly touch too many SST files.',
      ],
    },
    {
      heading: 'Recovery playbook',
      paragraphs: [
        'First, identify the active gate. A memtable stall points at flush capacity or write-buffer sizing. An L0-file stall points at flush-to-L0 rate versus L0-to-L1 compaction. A pending-byte stall points at deeper compaction debt. Disk saturation says the storage device is the bottleneck; idle disk with high debt says scheduling, worker counts, or configuration may be wrong.',
        'Second, choose the lever that matches the gate. You can add background flush or compaction capacity, adjust write buffers, tune L0 slowdown and stop thresholds, change compaction style, rate-limit compaction IO, rate-limit foreground ingest, split hot column families or instances, or reshape the workload so a burst enters through a bounded queue.',
        'Third, verify that the debt drains. L0 file count should fall, pending compaction bytes should fall, stall micros should stop accumulating, disk write bandwidth should make sense for the device, and user p99 should recover. If one metric improves while another explodes, the fix only moved the bottleneck.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat write stalls as a bug to disable. They prevent worse failure modes: unbounded L0 growth, space amplification, high read amplification, and memory pressure. The goal is to make stalls rare by matching cleanup capacity and workload shape, not to remove the safety valve.',
        'Do not blindly raise thresholds. Larger buffers and later L0 gates can absorb bursts, but they can also create larger compactions, longer recovery, more memory use, and worse tail latency when the burst is not temporary. Bigger cushions are not capacity.',
        'Do not confuse compaction style with a universal optimization. Leveled compaction, universal compaction, FIFO, and time-windowed patterns optimize different workloads. A cache-like table, a read-heavy table, and a backfill-heavy table should not automatically share one LSM shape.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RocksDB Write Stalls at https://github.com/facebook/rocksdb/wiki/Write-Stalls, RocksDB Tuning Guide at https://github.com/facebook/rocksdb/wiki/RocksDB-Tuning-Guide, RocksDB Rate Limiter at https://github.com/facebook/rocksdb/wiki/Rate-Limiter, and RocksDB Compaction at https://github.com/facebook/rocksdb/wiki/Compaction. Study RocksDB LSM Case Study, LSM Compaction Strategies Primer, SSTable Block Index & Filter, RocksDB MANIFEST & VersionSet, LSM Tombstones & Range Deletes, Write-Ahead Log, Rate Limiter, Backpressure & Flow Control, Tail Latency & p99 Thinking, and SLO Error-Budget Burn-Rate Alerting next.',
      ],
    },
  ],
};
