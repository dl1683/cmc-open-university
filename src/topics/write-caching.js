// Write caching: reads were the easy half. When a WRITE hits a cache, you
// must decide — push it through to disk now, or promise now and pay later?
// The ack point is a durability dial, and crashes audit your choice.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'write-caching',
  title: 'Write-Through vs Write-Back',
  category: 'Systems',
  summary: 'When a write hits the cache: pay the disk now (through), promise and batch (back), or skip the cache (around).',
  controls: [
    { id: 'view', label: 'Test', type: 'select', options: ['three ways to handle a write', 'the crash test'], defaultValue: 'three ways to handle a write' },
  ],
  run,
};

const writeGraph = ({ cacheNote, diskNote, appNote, edges }) =>
  graphState({
    nodes: [
      { id: 'app', label: 'APP', x: 1.2, y: 3.5, note: appNote },
      { id: 'cache', label: 'CACHE (RAM)', x: 5, y: 3.5, note: cacheNote },
      { id: 'disk', label: 'DISK / DB', x: 8.8, y: 3.5, note: diskNote },
    ],
    edges,
  });

function* threeWays() {
  yield {
    state: writeGraph({
      appNote: 'ack after BOTH land (~5ms)',
      cacheNote: 'count = 43 ✓',
      diskNote: 'count = 43 ✓',
      edges: [
        { id: 'toCache', from: 'app', to: 'cache' },
        { id: 'toDisk', from: 'cache', to: 'disk' },
      ],
    }),
    highlight: { active: ['toCache', 'toDisk'], found: ['cache', 'disk'] },
    explanation: 'Cache Invalidation handled the READ side: is the copy fresh? Now the harder half: a WRITE arrives — count = 43 — and the cache must decide when to tell the application "done." Policy 1: WRITE-THROUGH. The write lands in the cache AND travels through to disk before the ack. Both copies always agree, a crash can never lose an acknowledged write, and reads after writes are instantly consistent. The bill: every single write pays full disk latency (~5ms against RAM\'s ~0.1ms) — the cache accelerates nothing on the write path. Honest, simple, slow.',
    invariant: 'Write-through: the ack means BOTH copies hold the data — durability bought with latency.',
  };

  yield {
    state: writeGraph({
      appNote: 'ack instantly (~0.1ms)',
      cacheNote: 'count = 43 — DIRTY',
      diskNote: 'still count = 42 (stale, knowingly)',
      edges: [
        { id: 'toCache', from: 'app', to: 'cache' },
        { id: 'later', from: 'cache', to: 'disk' },
      ],
    }),
    highlight: { active: ['toCache'], compare: ['later'], removed: ['disk'] },
    explanation: 'Policy 2: WRITE-BACK (write-behind). The write lands in the cache, the entry is stamped DIRTY, and the app gets its ack IMMEDIATELY — disk will hear about it later, when the flusher batches dirty entries out. Fifty times lower write latency, and a subtler superpower: WRITE COALESCING. A hot counter incremented 1,000 times produces 1,000 cache writes but ONE disk write — the flusher only ships the final value. The cache is no longer a copy of the truth; for dirty entries, the cache IS the truth and disk is the stale follower. Hold that sentence for the crash test.',
    invariant: 'Write-back: the ack means the CACHE holds the data — the dirty window is borrowed durability.',
  };

  yield {
    state: writeGraph({
      appNote: 'bulk import: 10M rows',
      cacheNote: 'untouched — hot keys stay hot',
      diskNote: 'rows land directly',
      edges: [{ id: 'around', from: 'app', to: 'disk' }],
    }),
    highlight: { active: ['around'], visited: ['cache'] },
    explanation: 'Policy 3: WRITE-AROUND. The write skips the cache entirely and lands on disk; the cache learns about the data only if someone later READS it. Why would you dodge your own cache? Pollution: a 10-million-row bulk import written through the cache would evict every genuinely hot key (the LRU Cache\'s working set) to make room for rows nobody will read this year. Write-around keeps write-once-read-maybe data out of precious RAM. The cost is symmetric: the first read of anything just written is a guaranteed miss.',
  };

  yield {
    state: matrixState({
      title: 'The three policies, priced',
      rows: [
        { id: 'through', label: 'write-through' },
        { id: 'back', label: 'write-back' },
        { id: 'around', label: 'write-around' },
      ],
      columns: [{ id: 'lat', label: 'write latency' }, { id: 'safe', label: 'crash-safe?' }, { id: 'best', label: 'best for' }],
      values: [[5, 1, 2], [0.1, 3, 4], [5, 1, 6]],
      format: (v) => (v === 5 ? '~5ms (disk)' : v === 0.1 ? '~0.1ms (RAM)' : ['', 'yes — ack = on disk', 'read-heavy, must-not-lose', 'NO — dirty window', 'write-hot keys, counters', '', 'bulk loads, write-once data'][v]),
    }),
    highlight: { compare: ['through:lat', 'back:lat'], removed: ['back:safe'] },
    explanation: 'The decision table. Read the latency column against the safety column and the structure of the choice appears: write-back is fifty times faster precisely BECAUSE it acknowledges before durability — the speed is not cleverness, it is borrowed risk. Which raises the only question that matters in production: what exactly happens to those dirty entries when the power dies? The other view runs that experiment.',
  };
}

function* crashTest() {
  yield {
    state: matrixState({
      title: 'The crash, on a write-back timeline',
      rows: [
        { id: 't0', label: 't=0ms' },
        { id: 't1', label: 't=0.1ms' },
        { id: 't2', label: 't=40ms' },
        { id: 't3', label: 't=41ms' },
      ],
      columns: [{ id: 'event', label: 'event' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'app writes count = 43 → cache (dirty)', 'app receives ACK — "saved!"', '⚡ POWER LOSS — flush never ran', 'reboot: disk says count = 42'][v],
    }),
    highlight: { removed: ['t2:event', 't3:event'], compare: ['t1:event'] },
    explanation: 'The audit arrives as a power cut. At t=0.1ms the application was TOLD the write was saved; at t=40ms the dirty entry was still waiting for the flusher; at reboot, disk holds yesterday\'s value. The application did not crash, did nothing wrong, and lost an acknowledged write — the worst kind of loss, because upstream systems (a user shown "order placed", a Message Queue consumer that already deleted the message) acted on the ack. Write-back\'s dirty window is not a bug; it is the product working as designed. The design just needs one more piece.',
    invariant: 'An ack that precedes durability is a promise the crash is allowed to break.',
  };

  yield {
    state: writeGraph({
      appNote: 'ack after the LOG line (~0.5ms)',
      cacheNote: 'count = 43 — dirty, relaxed',
      diskNote: 'WAL: "set count=43" ✓ appended',
      edges: [
        { id: 'toCache', from: 'app', to: 'cache' },
        { id: 'toLog', from: 'app', to: 'disk' },
      ],
    }),
    highlight: { found: ['toLog', 'disk'], active: ['toCache'] },
    explanation: 'The rescue you have already studied: pair write-back with a WRITE-AHEAD LOG. Before the ack, append one line — "set count = 43" — to a sequential log file (sequential appends are the one thing disks do nearly as fast as RAM; that asymmetry is the whole WAL topic). THEN let the data structure be lazy: dirty pages flush whenever batching suits them. Crash? Replay the log over the last flushed state and every acknowledged write resurrects. Latency ~0.5ms, durability total: write-back\'s speed with write-through\'s conscience. This is not an exotic trick — it is the literal architecture of PostgreSQL, MySQL\'s InnoDB, and the LSM-Tree\'s memtable+log pairing.',
    invariant: 'Log the intent sequentially before the ack; batch the expensive structure lazily after it.',
  };

  yield {
    state: matrixState({
      title: 'Where each policy lives in the machine you are using right now',
      rows: [
        { id: 'cpu', label: 'CPU L1/L2 caches' },
        { id: 'page', label: 'OS page cache' },
        { id: 'redis', label: 'Redis persistence' },
        { id: 'db', label: 'database buffer pool' },
        { id: 'raid', label: 'RAID controller' },
      ],
      columns: [{ id: 'policy', label: 'policy' }, { id: 'guard', label: 'the safety net' }],
      values: [[1, 2], [1, 3], [4, 5], [1, 6], [1, 7]],
      format: (v) => ['', 'write-back', 'cache coherence (MESI) between cores', 'fsync() forces the flush — databases call it', 'configurable: AOF every write / every second / off', 'you CHOOSE the dirty window', 'WAL before ack (the rescue above)', 'battery-backed RAM rides out the power cut'][v],
    }),
    highlight: { active: ['db:guard'], found: ['raid:guard'] },
    explanation: 'The census: write-back wins almost everywhere — the latency gap is too valuable to refuse — but NEVER alone; every serious deployment bolts on a safety net matched to its failure model. Your CPU write-backs between cache levels with coherence protocols guarding correctness; your OS write-backs every file save until fsync insists; Redis lets you dial the dirty window per workload; databases log first and relax after; hardware RAID straps a battery to the RAM so the dirty window survives the outage itself. One idea threads every row, and it is the same one from Picking a Threshold with Real Costs: the ack point is a DIAL, not a default — set it by the price of a lost write, and make whoever moves it fast also pay for the net.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'three ways to handle a write') yield* threeWays();
  else if (view === 'the crash test') yield* crashTest();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Write caching is the second half of the cache decision: when a write command arrives at the cache, when do you tell the application "done"? Immediately, betting you will flush to disk later (write-back)? After both the cache and the disk have the data (write-through)? Or skip the cache altogether (write-around)? Each choice trades latency against durability — the risk that a power cut orphans a write you promised was saved. The ack point is a durability dial: you set it by the price of a lost write, and the crash is what audits your honesty.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Write-through: every write travels from app through cache to disk before the ack (~5ms). The ack is ironclad because data is already on stable media. Write-back: the write lands in cache, entry is marked DIRTY, and the app gets its ack instantly (~0.1ms) — disk hears about it later, when the flusher batches dirty entries out. The crash test shows the danger: at t=0.1ms the app receives the ack; at t=40ms the power dies with the dirty entry still only in RAM; at reboot, disk holds yesterday's stale value. Write-around skips the cache entirely (bulk imports, write-once data) so hot keys stay hot; the cost is a cache miss on the first read.`,
        `The rescue: pair write-back with a write-ahead log (WAL). Before the ack, append the intent ("set count = 43") to a sequential log file (~0.5ms — sequential appends are nearly as fast as RAM). The flush to the main data is lazy; crash? Replay the log and every acknowledged write resurrects. This is the literal architecture of PostgreSQL, MySQL, InnoDB, and LSM trees — write-back's speed plus write-through's conscience.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Write-through: ~5ms per write, simple, zero crash risk. Write-back (no log): ~0.1ms ack, 50× faster, but carries a crash window. A hot counter incremented 1,000 times produces one disk write, a 1000× reduction in disk traffic — the superpower is write coalescing. The window between ack and flush is the danger zone. Write-back with WAL: ~0.5ms, total durability, coalescing still applies. A WAL is a sequential append-only file; it grows until a checkpoint, then truncates. Real systems tune checkpoint intervals by recovery-time tolerance.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Write-through: safety-critical systems where a lost write costs human harm or massive money (ATM transactions, medical devices). Latency is acceptable when write rate is low. Write-back with WAL: everywhere else. PostgreSQL, MySQL, InnoDB, Redis (AOF dial), LSM trees (RocksDB, LevelDB), all pair write-back with a log. CPU caches use write-back with MESI coherence; OS page cache with fsync; SSD controllers and RAID batteries form a tower of write-back layers, each with a safety net. The pattern: write-back's 50× latency gain is too valuable to refuse, so every serious system bolts on durability matched to failure model.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Trap 1: confusing "ack means saved" with "ack before durability is dishonest." Write-back is not lying — it is a promise priced by failure model. If your system tolerates losing the last few seconds of writes (a video buffer), write-back is honest. If a lost write breaks the system (a payment confirmed but now lost), add a WAL or use write-through. The crash test shows the ack happened, the crash happened, the promise broke — that is the system running as specified. The fix: specify differently, add the log.`,
        `Trap 2: assuming the ack point you set is where durability lives. A database fsync does not reach physical disk on write-back SSDs without power-loss firmware; Redis AOF still faces OS page cache delays; RAID batteries only as good as their capacity. Every layer introduces its own ack point.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Learn Write-Ahead Logging to see real databases pair logs with lazy flushing. Cache Invalidation & Versioning addresses the read side (when is a cached value stale?). LRU Cache shows eviction when memory is full. LSM Tree weaves write-back, logging, and compaction into production databases. Message Queue teaches replication-based durability, a complementary strategy to acks and logs.`,
      ],
    },
  ],
};

