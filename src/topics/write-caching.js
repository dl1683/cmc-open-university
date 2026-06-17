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
      heading: `Why this exists`,
      paragraphs: [
        `Read caching asks whether a copy is fresh enough to use. Write caching asks a sharper question: when is the system allowed to tell the caller "done"? Memory can absorb a write quickly. A disk, SSD, remote database, or replicated service is slower. The acknowledgement point becomes a promise about durability, visibility, and recovery.`,
        `Write-through, write-back, and write-around are three ways to place that promise. They are not just performance settings. They define what an acknowledged write means. If the system crashes one millisecond later, the user does not care that the cache was fast. The user cares whether the write that was acknowledged can be recovered.`,
      ],
    },
    {
      heading: `The reasonable first attempt`,
      paragraphs: [
        `The safest first attempt is write-through. On every write, update the cache and also update the backing store before sending the acknowledgement. The rule is easy to explain: if the caller received success, both copies have the value. A crash after the acknowledgement should not lose that write because the durable copy was already updated.`,
        `The fastest first attempt is write-back. Update the cache, mark the entry dirty, acknowledge immediately, and flush to the backing store later. This makes the write path feel like RAM. It also coalesces repeated updates: a counter changed one thousand times in memory may become one later durable write of the final value. The policy is attractive because it attacks the real bottleneck, which is waiting for slow media or slow replication on every small change.`,
      ],
    },
    {
      heading: `Where those attempts break`,
      paragraphs: [
        `Write-through breaks on latency and write amplification. If each small update must wait for the backing store, the cache does little to accelerate writes. Hot keys, counters, metadata updates, and small random writes all pay the slow path repeatedly. The policy is honest, but it can waste the main advantage of caching: absorbing bursts and batching expensive work.`,
        `Write-back breaks on the crash test. If the system acknowledges after the cache update but before durable storage changes, then the acknowledged write lives only in volatile state during the dirty window. A power loss, process crash, or controller failure can erase data the caller was told had been saved. That is not an implementation bug. It is the meaning of acknowledging before durability unless another recovery mechanism exists.`,
        `Write-around solves a different problem. It sends writes directly to the backing store and does not populate the cache. That protects the cache from bulk imports and write-once data, but it makes read-after-write cold. The first read of the newly written data misses because the cache intentionally skipped it.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `The core insight is that the acknowledgement point is the real policy. Write-through says the ack means the cache and backing store both hold the data. Write-back without a safety net says the ack means the cache holds the data and the backing store will catch up later. Write-around says the cache is not involved in the write path at all.`,
        `A serious write-back design adds a recovery invariant: record the intent durably before acknowledging, then let the main structure flush lazily. That durable intent is usually a write-ahead log, journal, append-only file, replicated quorum entry, or battery-protected controller memory. The cache can be fast only if the system has decided what survives the crash.`,
      ],
    },
    {
      heading: `How the mechanism works`,
      paragraphs: [
        `In write-through, the path is app to cache to backing store, and the acknowledgement waits until the backing store confirms the write. Reads after writes are simple because the cache and store agree. Recovery is simple because the acknowledged update reached durable state. The cost is that every write waits for the slowest required durable step.`,
        `In write-back, the path is app to cache, mark dirty, acknowledge, and flush later. The cache maintains a dirty set: keys or pages whose cached value is newer than the backing store. A background flusher writes dirty entries out in batches, often ordered by age, pressure, or checkpoint policy. Repeated updates to the same dirty entry may collapse into one backing-store write. The backing store is temporarily stale by design.`,
        `In write-around, the path is app to backing store, with the cache bypassed. This is useful when the write is unlikely to be read soon or would evict valuable hot data. A later read must load the value from the backing store and may then populate the cache according to normal read policy.`,
        `With write-back plus a log, the path changes again: append the intent to durable sequential storage, update the cache and dirty metadata, then acknowledge. The expensive structure can flush later. If the system crashes, recovery reads the last durable checkpoint and replays log records that had been acknowledged but not yet folded into the main structure.`,
      ],
    },
    {
      heading: `What the visual is proving`,
      paragraphs: [
        `The three-policy view proves that the same write can mean three different promises. In write-through, success waits for both cache and durable store. In write-back, success arrives while the backing store is knowingly stale. In write-around, the cache is protected from a write that may never be read. The boxes are simple because the hard part is not routing. The hard part is the promise attached to the acknowledgement.`,
        `The crash-test view proves why write-back needs a safety net. The application receives success while the dirty value is still only in volatile cache. A power loss before the flush leaves the backing store with the old value. The WAL step changes the proof: the main structure may still be stale, but recovery has a durable record of the acknowledged write and can replay it.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Write-through works because it keeps the cache and backing store synchronized at the acknowledgement boundary. After success, either copy can be used to reconstruct the value. The invariant is simple and expensive: the slow copy is already current.`,
        `Write-back with a log works because it separates durable ordering from expensive placement. The log is sequential, so it is cheaper to append than to update arbitrary pages or structures in place. The cache and backing store can then optimize layout, batching, and flushing without changing the recovery promise. The invariant is: every acknowledged write appears either in the flushed main structure or in the durable log that recovery will replay.`,
        `Write-around works because it treats cache space as scarce. If a workload writes a huge amount of data that will not be read soon, caching those writes would evict the working set. Skipping the cache preserves read performance for the data that actually benefits from memory.`,
      ],
    },
    {
      heading: `Cost and tradeoffs`,
      paragraphs: [
        `Write-through costs latency on every write. It also costs throughput because it misses chances to batch and coalesce. Its reward is a small recovery story and clear read-after-write behavior.`,
        `Write-back costs complexity. The system needs dirty metadata, flush scheduling, memory pressure handling, checkpointing, recovery, and policy for what happens when dirty data cannot be flushed. It can also create surprising durability gaps if operators assume "acknowledged" means "on stable storage" when the configuration says otherwise.`,
        `Write-around costs first-read latency and can surprise code that expects a just-written value to be hot in cache. It is best for bulk loads, migrations, append-heavy cold data, and write-once data. It is poor for workloads with immediate read-after-write locality.`,
        `Layering is the hidden tradeoff. A database buffer pool, operating-system page cache, SSD firmware cache, storage controller, and cloud block device may each buffer writes. A durability guarantee is only as strong as the path from the application acknowledgement to media, replica quorum, or another failure-resistant record.`,
      ],
    },
    {
      heading: `Real use cases`,
      paragraphs: [
        `Write-through fits configuration records, low-rate metadata, and systems where simple recovery matters more than write latency. It is also useful when the cache is an optimization and the backing store must remain authoritative after every acknowledged operation.`,
        `Write-back with a log fits databases, filesystems, LSM-tree memtables, persistent queues, and storage controllers. PostgreSQL and InnoDB use write-ahead logging so dirty pages can flush later without losing acknowledged transactions. LSM-tree designs write to an in-memory memtable while also appending to a log, then flush sorted files later. Filesystems journal metadata or data to make lazy updates recoverable.`,
        `Write-around fits bulk import, analytics staging, backup restore, and large cold writes. If a million rows are being loaded once and will not be read immediately, filling the cache with them can evict the hot working set. Bypassing the cache keeps memory for the reads that matter.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The most serious failure is lying about the acknowledgement. If the application treats success as durable, but the cache policy only made the value dirty in RAM, a crash can violate the application contract. This is especially dangerous for payments, orders, queue acknowledgements, identity changes, and metadata updates.`,
        `Another failure is uncontrolled dirty growth. If the flusher cannot keep up, dirty data consumes memory, later writes stall, and recovery time grows because more log records or dirty pages must be processed. Write-back needs backpressure. At some point the system must slow writers, flush more aggressively, or reject work.`,
        `A third failure is cache pollution. Write-through and write-back can both populate the cache with data that has no near-term reads. That is why write-around exists. A cache is not just a faster place to put every byte. It is a limited working-set budget.`,
      ],
    },
    {
      heading: `What to study next`,
      paragraphs: [
        `Study write-ahead logging to see how durable intent makes lazy data structures crash-safe. Study LSM trees to see write-back, memtables, logs, and compaction working together. Study cache invalidation for the read-side version of the problem. Study LRU and TinyLFU admission to understand cache pollution and working sets. Study Linux page cache, dirty writeback, fsync, rename-based crash consistency, and message queues to see how acknowledgement semantics show up in operating systems and distributed systems.`,
      ],
    },
  ],
};
