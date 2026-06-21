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
    explanation: 'The graph shows why "LSM" is not one physical shape. After memtables flush, the compaction policy decides which files merge, how much overlap remains, and when old versions or tombstones can finally disappear.',
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
    explanation: 'The strategy table is a map of assumptions. Size-tiered and universal styles favor write throughput, leveled spends I/O to reduce overlap, and time-window/FIFO strategies win only when age predicts cleanup.',
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
    explanation: 'The leveled table explains the read benefit. Except for L0, each level is mostly non-overlapping, so a point lookup checks fewer candidate files. The cost is paid earlier as extra rewrite I/O.',
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
    explanation: 'The age-window table shows the special case where compaction can avoid row-by-row cleanup. If data arrives by time and expires by time, whole files or windows can be dropped instead of repeatedly merged.',
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
    explanation: 'The plot is a frontier, not a benchmark. Tiered strategies usually write less and read more; leveled strategies write more and read less; time-aware strategies sit elsewhere only when the workload really expires by age.',
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
    explanation: 'The vocabulary table is the tuning checklist. If you cannot say whether you are protecting write amp, read amp, space amp, or stall risk, you are not tuning yet; you are guessing.',
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
    explanation: 'The tombstone table shows why deletes are not free. A delete marker hides older values immediately, but compaction needs the right files and safety point before it can drop the marker and the data it covers.',
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
    explanation: 'The cheat sheet is intentionally conditional. A hot key-value service, a range-heavy analytics table, a TTL time-series table, and an expiring cache are different physical-design problems even if they all use an LSM.',
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
      heading: 'Why compaction exists',
      paragraphs: [
        'An LSM tree gets its write speed by refusing to update disk pages in place. A write is appended to a log, inserted into a memory table, and later flushed as a sorted immutable file. That is the good part: random user updates become sequential writes. The cost is that the disk gradually fills with many sorted files, old versions, delete markers, and overlapping key ranges. Compaction is the background policy that turns that pile of files back into a usable index.',
        {type: 'callout', text: 'Compaction is the LSM control loop that buys read shape, space cleanup, and tombstone safety with background rewrite I/O.'},
        'Without compaction, the write path would still look fast for a while, but every other part of the system would degrade. Point reads would have to search more files. Range scans would merge more runs. Disk space would hold duplicate history. Deletes would leave tombstones that hide old values but do not reclaim space. Eventually the database would slow or stop writes because background cleanup could not catch up.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/LSM_Tree.png/250px-LSM_Tree.png', alt: 'Diagram illustrating compaction of data in a log structured merge tree', caption: 'The LSM shape shows why compaction is physical design: flushed sorted runs must be merged into levels or tiers. Source: Wikimedia Commons, LSM tree diagram.'},
        'The word compaction can sound like simple compression, but in an LSM it means much more. It is physical design. A compaction strategy decides which SSTables are merged, which output level receives them, how much overlap remains, when old versions can disappear, and which amplification the system is willing to pay.',
      ],
    },
    {
      heading: 'The naive approach and the wall',
      paragraphs: [
        'The naive approach is to flush every full memtable into a new sorted file and leave the file alone forever. It is easy to implement. Each flush is sequential. Each file has its own index and Bloom filter. The problem appears after enough flushes. A key might be present in the newest file, absent from several older files, and present again in a much older file. The reader must prove which version is visible.',
        'A second naive approach is to merge everything all the time. That gives clean reads, but it destroys the write advantage. If every update repeatedly rewrites large regions of the database, the LSM starts behaving like an expensive copy machine. The correct question is not whether to compact. The question is how much order to buy, when to buy it, and with whose latency budget.',
        'This is why compaction strategy is a workload choice. A time-series table with one-day TTL, a user-profile store with hot point lookups, a bulk-ingest analytics table, and a cache full of expiring entries all want different physical shapes even if they all use the same LSM codebase.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The visual model treats compaction as a policy loop, not as a background broom. The memtable flush creates new L0 runs. The policy chooses files. The merge rewrites sorted inputs into sorted outputs. The resulting tree shape determines read cost, write cost, space use, and cleanup delay.',
        'The strategy tables are also teaching an invariant: no compaction strategy removes cost. Size-tiered policies leave more overlap and pay later in reads or space. Leveled policies pay earlier in rewrite I/O to buy cleaner lookup paths. Time-window and FIFO policies win only when age is a real cleanup boundary. The animation is useful because it keeps the policy decision attached to the physical layout it creates.',
      ],
    },
    {
      heading: 'Core insight, mechanism, and strategies',
      paragraphs: [
        'The core insight is that an LSM tree moves the write problem from foreground page updates into background merge policy. The mechanism is sorted-run merging: each component remains sorted, while compaction decides how many overlapping sorted components are allowed to coexist. A strategy is therefore a choice about which amplification the system will tolerate.',
        'Size-tiered compaction groups several files of similar size and merges them into a larger file. Cassandra STCS is the classic example. The strategy favors write throughput because a file can sit untouched until enough peer files exist. The tradeoff is overlap. A key range may appear in many runs, so reads and space usage can suffer. Size-tiered compaction is attractive for heavy ingest and workloads where read amplification is tolerable or mitigated by filters.',
        'Leveled compaction spends more I/O to keep most levels non-overlapping. RocksDB leveled compaction and LevelDB-style layouts are the usual model. L0 can overlap because it receives direct flushes, but lower levels are organized so a key range maps to a small number of files per level. Point reads improve because there are fewer candidate files. Space amplification improves because obsolete values meet newer values sooner. The price is write amplification: data is rewritten as it moves through levels.',
        'Universal compaction, often described as a tiered strategy in RocksDB, is built for write-heavy and bulk-load patterns. It keeps multiple sorted runs and periodically merges chosen groups based on size and age rules. It can reduce write amplification relative to strict leveling, but it usually accepts more read and space amplification. FIFO compaction is more radical: old files are dropped when total size or age rules say they can go. Time-window compaction uses the fact that data arrives and expires by time, allowing whole windows to become cold and eventually disappear.',
      ],
    },
    {
      heading: 'Amplification vocabulary',
      paragraphs: [
        'Write amplification is the extra data written because compaction rewrites bytes that users did not modify. If the user writes 1 GB but the device writes 12 GB after flushes and compactions, the write amplification is high. This matters for SSD wear, ingest throughput, and tail latency. Leveled compaction often pays more write amplification than tiered compaction because it keeps the structure cleaner.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Hdd_and_ssd.JPG', alt: 'Hard disk drive and solid state drive hardware side by side', caption: 'Write amplification is paid by real storage hardware through bandwidth, wear, and queue contention. Source: Wikimedia Commons, Evan-Amos, public domain.'},
        'Read amplification is the extra work a lookup or scan performs because data is spread across files. Bloom filters can reduce unnecessary data-block reads for point lookups, but they do not remove every cost. Range scans still have to merge ordered streams. L0 overlap is especially painful because each L0 file may cover the same key range. A compaction policy that leaves many overlapping runs is borrowing read cost from the future.',
        'Space amplification is old or redundant data that remains on disk. It includes overwritten values, tombstones, files that cannot yet be dropped, and partially overlapped output during compaction. Stall risk is the operational version of the same debt. If flush and compaction fall behind, L0 files and pending compaction bytes can trip write slowdowns or hard stalls.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Compaction works because sorted files can be merged sequentially. When two input files are sorted by key, the compactor can walk them in order, choose the newest visible version, drop shadowed versions when it is safe, preserve delete markers that still have work to do, and emit new sorted files. The operation is expensive in bytes, but friendly to storage devices because it is mostly sequential read and write I/O.',
        'Leveled compaction works by buying a simple lookup promise: below L0, a level should not contain overlapping files for the same key range. A point lookup can check memtables, then L0 files, then at most one file per lower level if the metadata and filters agree. This does not make reads free, but it makes them bounded enough for latency-sensitive services.',
        'Tiered and universal strategies work by delaying rewrites until the batch is large enough to amortize I/O. They keep the write path cheaper by tolerating several runs. Time-window and FIFO strategies work only when the workload has a real age boundary. If old files can be dropped as a unit, cleanup avoids row-by-row merging. If the workload violates that assumption, age-based policies can keep the wrong data or harm query locality.',
      ],
    },
    {
      heading: 'Concrete examples',
      paragraphs: [
        'A user-profile store usually wants predictable point reads and controlled space usage. Users update the same keys many times, and the application expects the latest profile quickly. Leveled compaction is a natural starting point because it limits overlap and helps old versions meet new versions. The cost is more background I/O. If the device cannot sustain that write amplification, the service will see stalls during bursts.',
        'A metrics table with hourly partitions and thirty-day retention has a different shape. Most writes arrive in time order, recent windows receive updates, and old windows expire together. Time-window compaction can keep hot windows active and let cold windows age out. The win comes from dropping whole files when the retention boundary passes. The danger is late-arriving data. If old windows continue receiving writes, the clean age model breaks.',
        'A bulk-ingest analytics table may prefer universal or tiered compaction during loading, then switch or compact more aggressively before serving read-heavy queries. Many systems use this idea even when the exact names differ: accept read debt while ingest is king, then pay for order before users ask hard questions.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Start tuning from measurements, not from strategy names. Track bytes written per user byte, L0 file count, pending compaction bytes, compaction queue age, files checked per read, Bloom filter hit and false-positive rates, tombstone scan counts, disk space amplification, and write-stall time. These metrics tell you whether the chosen policy is paying the intended cost.',
        'Choose compaction per table when the engine allows it. A TTL metrics table, a user-profile table, and an ingest staging table should not inherit the same defaults just because they run in the same cluster. Align partitioning, TTL, range-scan patterns, and expected late data with the compaction policy. Time-window compaction is strong only when writes and expiration really follow time windows.',
        'Plan capacity for cleanup. A storage engine needs enough background I/O to keep up with the incoming write rate plus rewrite work. If compaction can only catch up during quiet hours, bursts will accumulate debt and eventually hit foreground latency. For delete-heavy workloads, test tombstone-heavy scans directly because average read latency often hides the worst cases.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The first failure mode is tuning by name. Saying a table uses leveled compaction or universal compaction is not enough. The real evidence is L0 file count, pending compaction bytes, bytes written per user write, number of files consulted per read, tombstone scan cost, disk space growth, and stall time.',
        'The second failure mode is delete-heavy data. A delete writes a tombstone. The tombstone must remain until compaction can prove that older covered values are gone from all relevant files and that replication or snapshot rules allow cleanup. Dropping tombstones too early can resurrect data. Keeping them too long makes reads drag dead history through the query path.',
        'The third failure mode is pretending compaction is free background work. Background work uses disk bandwidth, CPU, cache, and sometimes the same device queue as foreground requests. A compaction strategy that looks correct on paper can still fail if the hardware cannot provide enough sustained cleanup capacity.',
      ],
    },
    {
      heading: 'Where it wins and where it is used',
      paragraphs: [
        'RocksDB exposes leveled, universal, FIFO, and related compaction controls because it is embedded in many higher-level systems: stream processors, metadata stores, queues, caches, blockchain nodes, and distributed databases. Cassandra exposes size-tiered, leveled, time-window, and unified strategies because different tables in the same cluster can have very different read, write, and TTL patterns.',
        'The common lesson is that an LSM is not one fixed tree. It is a family of layouts connected by the same write path. The compaction strategy is the part that turns a fast ingest buffer into a long-lived storage engine.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources worth reading are the RocksDB Compaction wiki, RocksDB Universal Compaction, RocksDB FIFO compaction style, Cassandra compaction documentation, Cassandra TimeWindowCompactionStrategy documentation, and the Dostoevsky paper on lazy leveling. For the theoretical side, study Monkey and Dostoevsky to see how merge policy, level sizing, and Bloom filter allocation form a lookup-update-space tradeoff.',
        'Next topics in this curriculum: LSM Tree, RocksDB LSM Case Study, RocksDB Write Stalls & Compaction Debt, SSTable Block Index & Filter, RocksDB MANIFEST & VersionSet, LSM Tombstones & Range Deletes, Bloom Filter, SuRF Range Filter, Write-Ahead Log, Backpressure, and Database Indexing.',
      ],
    },
  ],
};
