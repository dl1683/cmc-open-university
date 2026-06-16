// LSM compaction strategy primer: compaction is the policy engine that trades
// write amplification, read amplification, space amplification, and tombstone cleanup.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'lsm-compaction-strategies-primer',
  title: 'LSM Compaction Strategies Primer',
  category: 'Systems',
  summary: 'A practical map of size-tiered, leveled, universal/tiered, FIFO, and time-window compaction, with the read/write/space amplification tradeoffs exposed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['strategy map', 'amplification tradeoffs'], defaultValue: 'strategy map' },
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

function* strategyMap() {
  yield {
    state: graphState({
      nodes: [
        { id: 'mem', label: 'memtable', x: 0.8, y: 4.0, note: 'flush' },
        { id: 'l0', label: 'L0 runs', x: 2.6, y: 4.0, note: 'overlap' },
        { id: 'policy', label: 'policy', x: 4.5, y: 4.0, note: 'pick files' },
        { id: 'merge', label: 'merge', x: 6.4, y: 4.0, note: 'rewrite' },
        { id: 'shape', label: 'tree shape', x: 8.3, y: 4.0, note: 'tradeoff' },
      ],
      edges: [
        { id: 'e-mem-l0', from: 'mem', to: 'l0' },
        { id: 'e-l0-policy', from: 'l0', to: 'policy' },
        { id: 'e-policy-merge', from: 'policy', to: 'merge' },
        { id: 'e-merge-shape', from: 'merge', to: 'shape' },
      ],
    }, { title: 'Compaction policy decides the physical shape of an LSM' }),
    highlight: { active: ['policy', 'merge'], found: ['shape'] },
    explanation: 'An LSM tree is not fully specified by memtable plus SSTables. The compaction strategy decides which files get merged, how much overlap remains, and when obsolete versions can disappear.',
    invariant: 'Compaction trades foreground write speed for future read, space, and cleanup behavior.',
  };

  yield {
    state: labelMatrix(
      'Strategy families',
      [
        { id: 'stcs', label: 'size-tiered' },
        { id: 'leveled', label: 'leveled' },
        { id: 'universal', label: 'universal' },
        { id: 'time', label: 'time-window/FIFO' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'bestFit', label: 'best fit' },
      ],
      [
        ['merge similar sizes', 'write-heavy'],
        ['non-overlap levels', 'read-heavy'],
        ['tiered runs', 'bulk write'],
        ['age windows', 'TTL/time series'],
      ],
    ),
    highlight: { active: ['stcs:shape', 'leveled:shape', 'universal:shape'], found: ['time:bestFit'] },
    explanation: 'Size-tiered compaction waits for similarly sized SSTables. Leveled compaction aggressively controls overlap. Universal compaction is RocksDB terminology for a tiered style. Time-window and FIFO strategies exploit age-based deletion.',
  };

  yield {
    state: labelMatrix(
      'Leveled layout promise',
      [
        { id: 'l0', label: 'L0' },
        { id: 'l1', label: 'L1' },
        { id: 'l2', label: 'L2' },
        { id: 'l3', label: 'L3' },
      ],
      [
        { id: 'overlap', label: 'overlap' },
        { id: 'readCost', label: 'point read' },
      ],
      [
        ['yes', 'many probes'],
        ['no within level', 'one file'],
        ['no within level', 'one file'],
        ['no within level', 'one file'],
      ],
    ),
    highlight: { found: ['l1:readCost', 'l2:readCost', 'l3:readCost'], compare: ['l0:overlap'] },
    explanation: 'Leveled compaction spends write I/O to keep most levels non-overlapping. A point lookup usually checks at most one SSTable per level, which is why leveled layouts are attractive for read-heavy workloads.',
  };

  yield {
    state: labelMatrix(
      'Age-based cleanup',
      [
        { id: 'hot', label: 'hot window' },
        { id: 'warm', label: 'warm window' },
        { id: 'cold', label: 'expired window' },
      ],
      [
        { id: 'writes', label: 'writes' },
        { id: 'cleanup', label: 'cleanup' },
      ],
      [
        ['active', 'compact within window'],
        ['mostly closed', 'few rewrites'],
        ['none', 'drop whole file'],
      ],
    ),
    highlight: { found: ['cold:cleanup'], active: ['hot:cleanup'] },
    explanation: 'For mostly immutable time-series data with TTL, time-window or FIFO-style compaction can avoid rewriting cold data repeatedly. Once a whole window expires, the engine can delete files instead of merging rows out.',
  };
}

function* amplificationTradeoffs() {
  yield {
    state: plotState({
      axes: { x: { label: 'write amplification', min: 0, max: 100 }, y: { label: 'read amplification', min: 0, max: 100 } },
      series: [
        { id: 'tiered', label: 'tiered/STCS', points: [{ x: 18, y: 82 }, { x: 26, y: 66 }, { x: 35, y: 56 }] },
        { id: 'leveled', label: 'leveled/LCS', points: [{ x: 62, y: 26 }, { x: 75, y: 18 }, { x: 88, y: 12 }] },
        { id: 'time', label: 'time/FIFO', points: [{ x: 14, y: 42 }, { x: 22, y: 34 }, { x: 31, y: 28 }] },
      ],
    }),
    highlight: { active: ['tiered', 'leveled'], found: ['time'] },
    explanation: 'This is a conceptual frontier. Tiered strategies usually write less but leave more runs to read. Leveled strategies spend more write I/O to reduce overlap. Time-aware strategies win only when the workload matches their assumptions.',
    invariant: 'There is no free compaction strategy; each one chooses which amplification to tolerate.',
  };

  yield {
    state: labelMatrix(
      'Amplification vocabulary',
      [
        { id: 'write', label: 'write amp' },
        { id: 'read', label: 'read amp' },
        { id: 'space', label: 'space amp' },
        { id: 'stall', label: 'stall risk' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'symptom', label: 'symptom' },
      ],
      [
        ['bytes rewritten', 'SSD wear'],
        ['files probed', 'slow reads'],
        ['extra old data', 'disk bloat'],
        ['compaction lag', 'write pauses'],
      ],
    ),
    highlight: { active: ['write:meaning', 'read:meaning', 'space:meaning'], compare: ['stall:symptom'] },
    explanation: 'Compaction tuning should name the metric being protected. A read-heavy service, a write-heavy ingestion pipeline, and a TTL time-series table should not necessarily use the same policy.',
  };

  yield {
    state: labelMatrix(
      'Tombstone pressure',
      [
        { id: 'delete', label: 'delete' },
        { id: 'older', label: 'older value' },
        { id: 'safe', label: 'safe point' },
        { id: 'compact', label: 'compact' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['write marker', 'more bytes'],
        ['hidden', 'resurrection if dropped early'],
        ['replicas know', 'wait cost'],
        ['drop both', 'I/O burst'],
      ],
    ),
    highlight: { active: ['delete:state', 'older:state', 'safe:state'], found: ['compact:state'] },
    explanation: 'Deletes in LSM systems are usually tombstones. Compaction reclaims them only when it is safe to discard older values. Too many tombstones can poison reads until compaction catches up.',
  };

  yield {
    state: labelMatrix(
      'Strategy selection cheat sheet',
      [
        { id: 'kv', label: 'hot KV store' },
        { id: 'analytics', label: 'range analytics' },
        { id: 'timeseries', label: 'TTL time series' },
        { id: 'cache', label: 'expiring cache' },
      ],
      [
        { id: 'strategy', label: 'likely strategy' },
        { id: 'why', label: 'why' },
      ],
      [
        ['leveled or hybrid', 'read bound'],
        ['leveled', 'range locality'],
        ['time-window', 'drop by age'],
        ['FIFO', 'low overhead'],
      ],
    ),
    highlight: { found: ['kv:strategy', 'timeseries:strategy', 'cache:strategy'], compare: ['analytics:why'] },
    explanation: 'A good default is not universal. Match the policy to the table: update-heavy point reads, immutable time windows, cache-like expiration, or range-heavy analytical scans each stress a different part of the LSM.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'strategy map') yield* strategyMap();
  else if (view === 'amplification tradeoffs') yield* amplificationTradeoffs();
  else throw new InputError('Pick an LSM compaction view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An LSM compaction strategy is the policy that decides when immutable SSTables are rewritten into new SSTables. The basic LSM Tree page explains the write path: WAL, memtable, flush, SSTables. The compaction strategy explains the long-term shape of those SSTables and therefore the real performance profile of the database.',
        'The policy matters because LSM trees move work through time. A write can be cheap now because cleanup happens later. Later, compaction may rewrite bytes many times, remove overwritten values, purge tombstones, reduce file overlap, improve range locality, or delete expired time windows. That background work is not optional; it is the bill for fast ingest.',
      ],
    },
    {
      heading: 'Strategy families',
      paragraphs: [
        'Size-tiered compaction merges several SSTables of similar size. It often gives low write amplification because it waits for enough similarly sized runs before rewriting them. The downside is read and space amplification: many overlapping files may contain versions of the same key.',
        'Leveled compaction spends more write I/O to keep levels structured and mostly non-overlapping. That tends to help point reads and space efficiency because a lookup checks fewer files per level. Universal compaction in RocksDB is a tiered-style strategy optimized for high write throughput and bulk ingest patterns. FIFO and time-window strategies exploit data age, especially when entire files can expire through TTL.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The three core metrics are write amplification, read amplification, and space amplification. Write amplification is how many extra bytes the engine rewrites per user byte. Read amplification is how many structures a lookup or range scan must check. Space amplification is how much old, duplicate, deleted, or not-yet-compacted data occupies disk.',
        'A fourth operational metric is stall risk. If compaction cannot keep up, L0 files pile up, reads slow down, and writes may be throttled or stalled to prevent the system from collapsing under its own backlog. Backpressure is therefore part of compaction design, not merely an application-layer concern.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'RocksDB documents leveled, universal, and FIFO compaction styles. Cassandra documents size-tiered, leveled, time-window, and newer unified compaction strategy choices. Research systems such as Monkey and Dostoevsky study how merge policy, buffer sizing, and Bloom filter allocation shape the lookup-update-space tradeoff. The common lesson is that the LSM is a design space, not one fixed tree.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not say "LSM is write optimized" and stop there. An LSM can be misconfigured into terrible reads, huge space use, write stalls, or tombstone-heavy scans. The workload determines the strategy: read-heavy key-value service, append-only event log, TTL time series, analytical range scans, and delete-heavy workloads want different compaction behavior.',
        'Also be careful with tombstones. A delete marker may need to remain until old replicas, old SSTables, or snapshot readers can no longer expose the previous value. Dropping tombstones too early risks resurrecting data; keeping them too long makes reads drag dead history through the query path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RocksDB compaction wiki at https://github.com/facebook/rocksdb/wiki/Compaction, RocksDB universal compaction page at https://github.com/facebook/rocksdb/wiki/Universal-Compaction, RocksDB FIFO compaction page at https://github.com/facebook/rocksdb/wiki/FIFO-compaction-style, Cassandra compaction docs at https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/index.html, Cassandra time-window docs at https://cassandra.apache.org/doc/4.1/cassandra/operating/compaction/twcs.html, and Dostoevsky paper PDF at https://nivdayan.github.io/dostoevsky.pdf. Study LSM Tree, RocksDB LSM Case Study, RocksDB Write Stalls & Compaction Debt, SSTable Block Index & Filter, RocksDB MANIFEST & VersionSet, LSM Tombstones & Range Deletes, Bloom Filter, SuRF Range Filter, Write-Ahead Log, Backpressure, and Database Indexing next.',
      ],
    },
  ],
};
