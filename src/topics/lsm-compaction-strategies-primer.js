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
    explanation: `The ${topic.title} graph shows why "LSM" is not one physical shape. After memtables flush, the compaction policy decides which files merge, how much overlap remains, and when old versions or tombstones can finally disappear — a core ${topic.category} design choice.`,
    invariant: `Compaction trades foreground write speed for future read, space, and cleanup behavior — every path through the ${topic.controls[0].options[0]} encodes a tradeoff.`,
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
    explanation: `The strategy table is a map of assumptions across ${topic.controls[0].options.length} views. Size-tiered and universal styles favor write throughput, leveled spends I/O to reduce overlap, and time-window/FIFO strategies win only when age predicts cleanup — all part of the ${topic.title}.`,
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
    explanation: `The leveled table explains the read benefit in this ${topic.category} design. Except for L0, each level is mostly non-overlapping, so a point lookup checks fewer candidate files. The cost is paid earlier as extra rewrite I/O — a central tradeoff in the ${topic.title}.`,
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
    explanation: `The age-window table shows the special case where compaction can avoid row-by-row cleanup. If data arrives by time and expires by time, whole files or windows can be dropped instead of repeatedly merged — a ${topic.category}-level optimization unique to time-aware strategies in the ${topic.title}.`,
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
    explanation: `The ${topic.controls[0].options[1]} plot is a frontier, not a benchmark. Tiered strategies usually write less and read more; leveled strategies write more and read less; time-aware strategies sit elsewhere only when the workload really expires by age.`,
    invariant: `There is no free compaction strategy in ${topic.category}; each one chooses which amplification to tolerate — the ${topic.title} makes this tradeoff explicit.`,
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
    explanation: `The vocabulary table is the ${topic.category} tuning checklist. If you cannot say whether you are protecting write amp, read amp, space amp, or stall risk, you are not tuning the ${topic.title} yet; you are guessing.`,
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
    explanation: `The tombstone table shows why deletes are not free in ${topic.category} storage. A delete marker hides older values immediately, but compaction needs the right files and safety point before it can drop the marker and the data it covers — a pressure the ${topic.title} must account for.`,
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
    explanation: `The cheat sheet is intentionally conditional. A hot key-value service, a range-heavy analytics table, a TTL time-series table, and an expiring cache are different physical-design problems in ${topic.category} even if they all use an LSM — the ${topic.title} maps each to its natural strategy.`,
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
    {heading: 'How to read the animation', paragraphs: ['Read the animation as a policy loop over sorted files. Flushes create new runs, a compaction strategy chooses inputs, and a merge rewrites them into a new physical layout.', {type: 'image', src: './assets/gifs/lsm-compaction-strategies-primer.gif', alt: 'Animated walkthrough of the lsm compaction strategies primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}, 'The key question in each frame is which cost was moved. Cleaner levels reduce future reads and space, while delayed merging preserves write throughput now.']},
    {heading: 'Why this exists', paragraphs: ['An LSM tree writes quickly by flushing sorted immutable files instead of updating disk pages in place. Compaction exists because those files accumulate overlap, stale versions, and delete markers.', {type: 'callout', text: 'Compaction is the LSM control loop that buys read shape, space cleanup, and tombstone safety with background rewrite I/O.'}, {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/LSM_Tree.png/250px-LSM_Tree.png', alt: 'Diagram illustrating compaction of data in a log structured merge tree', caption: 'The LSM shape shows why compaction is physical design: flushed sorted runs must be merged into levels or tiers. Source: Wikimedia Commons, LSM tree diagram.'}, 'Without compaction, reads check more files, range scans merge more streams, and tombstones keep hiding old values without reclaiming space. The write path looks fast until the debt reaches users.']},
    {heading: 'The obvious approach', paragraphs: ['The simplest plan is to flush every memtable and leave every SSTable alone. Writes stay cheap because each flush is sequential and no old file is rewritten.', 'A second simple plan is to merge everything immediately. Reads become clean, but write amplification destroys the LSM advantage.']},
    {heading: 'The wall', paragraphs: ['The wall is the read-write-space tradeoff. You can reduce read amplification by rewriting data sooner, but that raises write amplification.', 'You can delay rewrites to favor ingest, but old versions, overlap, and tombstones increase read and space amplification. No strategy removes the cost; it decides where the cost appears.']},
    {heading: 'The core insight', paragraphs: ['Compaction is physical design under a budget. A strategy decides how much overlap may remain, when sorted runs meet, and how soon obsolete versions can disappear.', 'The right policy depends on workload. A TTL metrics table, a user-profile store, and a bulk-ingest table should not pay the same amplification mix.']},
    {heading: 'How it works', paragraphs: ['Size-tiered compaction merges several similarly sized files into a larger run. It favors write throughput by waiting for enough peers, but it leaves more overlap for reads.', 'Leveled compaction keeps lower levels mostly non-overlapping. It pays more rewrite I/O to make point reads check fewer files per level.', 'Time-window and FIFO strategies use age as the cleanup boundary. They work when old files expire together and fail when late writes keep old windows active.']},
    {heading: 'Why it works', paragraphs: ['Compaction is safe because sorted runs can be merged sequentially. For each key, the merge can keep the newest visible value, preserve needed tombstones, and emit a new sorted file.', 'Leveled compaction works by buying a lookup promise: below L0, a key range appears in at most one file per level. Tiered strategies work by amortizing rewrite I/O over larger batches.']},
    {heading: 'Cost and complexity', paragraphs: ['Write amplification is extra bytes written by compaction beyond user writes. If users write 1 GB and the device writes 12 GB after cleanup, the storage engine paid 12x write amplification.', {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Hdd_and_ssd.JPG', alt: 'Hard disk drive and solid state drive hardware side by side', caption: 'Write amplification is paid by real storage hardware through bandwidth, wear, and queue contention. Source: Wikimedia Commons, Evan-Amos, public domain.'}, 'Read amplification is extra files or streams checked per query, and space amplification is old data kept on disk. Tuning compaction means choosing which amplification is cheapest for the workload.']},
    {heading: 'Real-world uses', paragraphs: ['RocksDB exposes leveled, universal, and FIFO-style controls because embedded workloads differ. Cassandra exposes size-tiered, leveled, and time-window strategies because tables in one cluster can have different read, write, and TTL patterns.', 'Bulk ingest often starts with tiered or universal behavior, then compacts more aggressively before serving reads. Time-series tables often prefer time-window policies when retention boundaries are real.']},
    {heading: 'Where it fails', paragraphs: ['Compaction fails when tuned by strategy name instead of metrics. L0 file count, pending compaction bytes, write-stall time, files checked per read, tombstone scan cost, and disk growth are the evidence.', 'Delete-heavy workloads are especially fragile. Dropping tombstones too early can resurrect data, while keeping them too long makes reads drag dead history through scans.']},
    {heading: 'Worked example', paragraphs: ['Suppose four 64 MB L0 files cover the same key range. Size-tiered compaction may merge them into one 256 MB run after all four exist, paying one batch rewrite but leaving overlap until then.', 'Leveled compaction may choose one L0 file earlier and merge it into the next level. That pays rewrite I/O sooner, but future point reads have fewer overlapping candidates.']},
    {heading: 'Sources and study next', paragraphs: ['Read the RocksDB compaction wiki, Cassandra compaction documentation, Monkey, and Dostoevsky for lookup-update-space tradeoffs. Study LSM Tree, SSTables, Bloom filters, tombstones, write stalls, and database indexing next.']},
  ],
};
