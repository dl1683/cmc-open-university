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
        "Read the animation as the execution trace for RocksDB Write Stalls & Compaction Debt. A production LSM case study: immutable memtables, L0 files, pending compaction bytes, delayed writes, hard stalls, and recovery levers..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why write stalls exist',
      paragraphs: [
        'A RocksDB write stall exists because an LSM tree is a deferred-work machine. Foreground writes are fast because they append to the WAL and update a memtable. They do not immediately reorganize the whole on-disk index. That bargain only works if flush and compaction later clean up the files created by those writes.',
        'When cleanup falls behind, RocksDB has to protect itself. It can slow writers, delay writes, or stop writes temporarily. This is painful for applications, but the alternative is worse: unbounded immutable memtables, too many overlapping L0 files, runaway pending compaction bytes, disk bloat, read amplification, and eventually an engine that cannot make progress.',
        'A write stall is not the root cause. It is the safety valve. The root cause is compaction debt: work that the foreground write path created but the background system has not yet paid.',
      ],
    },
    {
      heading: 'The normal write path',
      paragraphs: [
        'A write enters RocksDB through a write batch. The engine appends it to the write-ahead log for durability and applies it to the current mutable memtable. When the memtable fills, RocksDB makes it immutable and creates a new mutable memtable for incoming writes. A background flush turns the immutable memtable into an L0 SST file.',
        'L0 is special. Files in lower levels are usually organized with limited overlap, depending on the compaction style. L0 files come directly from flushes and can overlap heavily. If too many L0 files accumulate, a point lookup may have to check many files, and compaction from L0 to lower levels becomes more urgent and more expensive.',
        'Compaction then merges files, discards obsolete versions when safe, preserves needed tombstones, and writes new SST files. This background work consumes disk bandwidth, CPU, cache, and file metadata capacity. The healthy system keeps ingest and cleanup in rough balance.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The naive assumption is that background compaction will eventually catch up because it is background work. That is only true when the device, CPU, thread configuration, and compaction policy have enough sustained capacity. A short ingest burst may be absorbed by buffers. A long burst becomes debt.',
        'Another naive assumption is that a stall can be fixed by raising thresholds. Larger write buffers, more L0 files before slowdown, or larger pending-byte limits can hide the symptom for longer. They do not create disk bandwidth. If the workload keeps producing debt faster than RocksDB can compact it, larger cushions only make the eventual incident bigger.',
        'The wall appears when the engine can no longer pretend that deferred work is safely deferred. Immutable memtables queue up. L0 file count rises. Estimated pending compaction bytes rise. Reads become more expensive. Disk runs hot. Then RocksDB gates foreground writes to stop the backlog from becoming unrecoverable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The first trigger family is immutable memtables. If too many full memtables wait for flush, memory pressure and recovery risk rise. A full memtable is normal. Too many unflushed immutable memtables mean the flush path is behind the write path. The relevant levers include write-buffer size, number of write buffers, flush threads, and device throughput.',
        'The second trigger family is L0 files. Too many L0 files can cause write slowdown and eventually write stop. This protects the system from unbounded overlap. L0 pressure often means flush is creating files faster than compaction can move them into lower levels. It can also mean files are too small, compaction is underprovisioned, or the lower-level shape is expensive for the workload.',
        'The third trigger family is estimated pending compaction bytes. This is the deeper debt signal. It says the engine estimates that too much data must be compacted to restore healthy level sizes. A pending-byte stall is not just a memtable problem or a local L0 count problem. It means the lower tree has accumulated work.',
      ],
    },
    {
      heading: 'Concrete incident path',
      paragraphs: [
        'Consider a stream-processing job that keeps keyed state in RocksDB. During normal traffic, each task writes updates into its local state store, and compaction keeps up. A backfill starts. The write rate doubles, then triples. Memtables rotate faster. Flush creates L0 files faster. L0 files overlap because each flush covers a broad key range. Reads and checkpoints begin touching more files.',
        'At first, the service only sees mild latency. Then RocksDB begins delaying writes because L0 count or pending compaction bytes passed a soft threshold. The application sees p99 spikes. If ingest continues, a hard threshold stops writes until compaction drains enough debt. The stream processor reports backpressure or missed checkpoints, but RocksDB did exactly what it was designed to do: protect the storage engine from collapse.',
        'The incident is solved only when debt drains. That may happen because the backfill is paced, because compaction capacity is increased, because write buffers are adjusted, because hot state is split across column families or instances, or because the workload changes. A setting that clears the stall counter while pending bytes keep rising has not solved the incident.',
      ],
    },
    {
      heading: 'Diagnosis before tuning',
      paragraphs: [
        'Start by naming the active gate. RocksDB LOG messages, statistics, stall counters, `rocksdb.num-immutable-mem-table`, L0 file count, estimated pending compaction bytes, compaction stats, write-stall micros, Perf Context, and host I/O metrics are the evidence. Without that evidence, tuning is guesswork.',
        'If immutable memtables are the gate, inspect flush capacity and write-buffer configuration. If L0 file count is the gate, inspect L0 slowdown and stop thresholds, file size, flush rate, compaction from L0 to L1, and whether lower levels are blocking progress. If pending compaction bytes are the gate, inspect deeper level sizing, compaction style, disk bandwidth, compaction priority, and whether the workload has changed shape.',
        'Also look above RocksDB. A single hot column family can affect writes to the whole DB. One tenant, partition, backfill, or bulk load can create debt that spills into unrelated requests. The fix may need service-level admission control, tenant quotas, source pacing, or isolation, not only storage-engine knobs.',
      ],
    },
    {
      heading: 'Recovery levers',
      paragraphs: [
        'Buffer levers change burst absorption. Larger write buffers and more write buffers can reduce how often memtables rotate, but they use more memory and can create larger flushes. They help when bursts are temporary. They hurt when they hide a sustained capacity mismatch.',
        'Compaction levers change cleanup capacity and shape. More background jobs can help if CPU and disk have headroom. A rate limiter can smooth I/O and protect foreground reads, but it can also slow debt repayment if set too low. Changing leveled, universal, FIFO, or time-windowed compaction changes the amplification tradeoff. This is a table design decision, not a cosmetic setting.',
        'Service levers reduce incoming debt. Pace backfills. Bound queues. Reject or defer low-priority writes. Split hot data. Isolate tenants or column families when blast radius matters. The cleanest RocksDB incident response is often outside RocksDB: stop feeding the engine more work than the hardware and compaction policy can digest.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not disable or bypass stalls as if they were the bug. Stalls are unpleasant because they reveal a real limit. Removing the guard can trade visible write latency for invisible corruption of performance: huge L0 overlap, disk exhaustion, read amplification, or recovery that takes too long after restart.',
        'Do not blindly raise thresholds. Larger limits can be correct when the device has headroom and the workload is bursty. They are dangerous when the workload is sustained. More pending bytes mean more future compaction. More L0 files mean more overlap. More immutable memtables mean more memory pressure.',
        'Do not optimize one metric alone. Lower write amplification may increase read amplification. More compaction workers may fight foreground reads for I/O. Larger buffers may improve ingest while increasing recovery time. Better p50 write latency may hide worse p99 when hard stalls arrive. The target is a stable operating envelope, not one heroic benchmark number.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RocksDB appears inside stream processors, distributed databases, metadata services, blockchains, caches, search infrastructure, and embedded applications. In all of those places, write stalls can surface as something else: request latency, checkpoint delay, replica lag, ingestion backpressure, or noisy-neighbor behavior.',
        'The same pattern applies beyond RocksDB. Any LSM-based system has a version of this problem. Fast appends create cleanup debt. Background merge capacity is finite. When the debt grows faster than repayment, the system must either slow writers, degrade reads, grow space usage, or fail operationally.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary RocksDB sources are the Write Stalls wiki page, the RocksDB Tuning Guide, the Rate Limiter page, and the Compaction wiki. Read them with one question in mind: which backlog is the engine protecting itself from, and what evidence proves that the backlog is draining?',
        'Next topics in this curriculum: RocksDB LSM Case Study, LSM Compaction Strategies Primer, SSTable Block Index & Filter, RocksDB MANIFEST & VersionSet, LSM Tombstones & Range Deletes, Write-Ahead Log, Rate Limiter, Backpressure & Flow Control, Tail Latency & p99 Thinking, SLO Error-Budget Burn-Rate Alerting, and Database Indexing.',
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
      heading: 'How it works',
      paragraphs: [
        "Describe the mechanism as a sequence of state transitions, not as a story.",
        "Each step should say what changes, what stays true, and why the move is legal.",
        "The animation should look like this section made concrete.",
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
      heading: 'Worked example',
      paragraphs: [
        "Trace one representative example end-to-end so readers can watch state evolve across every step.",
        "Keep the walkthrough concise and precise: at each step, write current state, action taken, and resulting output.",
        "The goal is prediction, not a one-off demonstration.",
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
          'If your predicted final state matches the animation for rocksdb-write-stall-compaction-debt-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

