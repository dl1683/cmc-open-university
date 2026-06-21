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
      cacheNote: 'count = 43 âœ“',
      diskNote: 'count = 43 âœ“',
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
      format: (v) => ['', 'app writes count = 43 â†’ cache (dirty)', 'app receives ACK — "saved!"', 'âš¡ POWER LOSS — flush never ran', 'reboot: disk says count = 42'][v],
    }),
    highlight: { removed: ['t2:event', 't3:event'], compare: ['t1:event'] },
    explanation: 'The audit arrives as a power cut. At t=0.1ms the application was TOLD the write was saved; at t=40ms the dirty entry was still waiting for the flusher; at reboot, disk holds yesterday\'s value. The application did not crash, did nothing wrong, and lost an acknowledged write — the worst kind of loss, because upstream systems (a user shown "order placed", a Message Queue consumer that already deleted the message) acted on the ack. Write-back\'s dirty window is not a bug; it is the product working as designed. The design just needs one more piece.',
    invariant: 'An ack that precedes durability is a promise the crash is allowed to break.',
  };

  yield {
    state: writeGraph({
      appNote: 'ack after the LOG line (~0.5ms)',
      cacheNote: 'count = 43 — dirty, relaxed',
      diskNote: 'WAL: "set count=43" âœ“ appended',
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The first shows the same write flowing through three different policies: write-through, write-back, and write-around. Active edges are the write path the policy uses. Found nodes have received durable data. Removed nodes are knowingly stale. The second view replays a crash on a write-back timeline and then shows the WAL rescue.',
        {type: 'callout', text: 'Write caching is an acknowledgement policy: the moment the system says done defines what a crash is allowed to lose.'},
        'Watch the ack point in each frame. That is the real variable. Everything else -- latency, durability, consistency -- follows from when the system says "done." If the ack fires before the disk confirms, you are inside a dirty window. If the ack waits for disk, you paid full latency. If the ack skips the cache, you traded read warmth for cache protection.',
        'The matrix frames price each policy side by side. Read the latency column against the crash-safety column: the speed difference between write-through and write-back is not cleverness. It is borrowed risk.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Read caching asks whether a copy is fresh. Write caching asks something harder: when is the system allowed to tell the caller "done"? RAM absorbs a write in roughly 100 nanoseconds. A disk commit costs 5 milliseconds, a cross-region replica 50 milliseconds or more. Somewhere between the fast layer and the durable layer, the system must issue an acknowledgement, and that ack is a durability promise.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg',
          alt: 'Computer memory hierarchy from fast CPU cache to slower storage',
          caption: 'Write policy exists because every cache layer is faster and less durable than the authority below it. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.',
        },
        'The promise matters because upstream systems act on it. A user sees "order placed." A message queue deletes the consumed message. A distributed transaction marks its branch committed. If a crash erases data the ack said was safe, the system has lied to every downstream consumer. Write-caching policy is not a performance knob. It is a contract about what survives failure.',
        {
          type: 'diagram',
          label: 'Write flow through cache layers to storage',
          text: [
            'APP --write--> [CACHE (RAM)]',
            '                   |                     \\',
            '            write-through            write-back',
            '            (sync to disk             (mark dirty,',
            '             before ack)               ack now,',
            '                   |                   flush later)',
            '                   v                     v',
            '              [DISK / DB] <---flush--- [dirty set]',
            '',
            'APP --write-around--> [DISK / DB]   (cache bypassed)',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The safest first attempt is write-through: on every write, update the cache and push the value to the backing store before acknowledging. The rule is simple -- if the caller got success, both copies agree. A crash after the ack loses nothing because the durable copy was already current. No dirty metadata, no flush scheduling, no recovery log. Honest, correct, slow.',
        'The fastest first attempt is write-back: update the cache, stamp the entry DIRTY, acknowledge immediately, and let a background flusher ship dirty entries to disk in batches. This makes write latency feel like RAM. It also enables write coalescing: a hot counter incremented 1,000 times produces 1,000 cache writes but one disk write of the final value. The policy is attractive because it attacks the real bottleneck -- waiting for slow media on every small mutation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Write-through breaks on latency. Every small update -- a counter bump, a metadata flag, a session touch -- pays full disk round-trip latency. With a 5ms disk and a 0.1ms cache, write-through is 50x slower on the write path. For write-hot keys the cache accelerates nothing; it is just a read-side optimization watching every write crawl past.',
        'Write-back breaks on the crash. The application receives its ack at t=0.1ms. The flusher has not run. At t=40ms the power dies. On reboot, disk holds yesterday\'s value. The application did nothing wrong and lost an acknowledged write -- the worst kind of loss, because upstream consumers already acted on the promise. The dirty window is not a bug. It is the policy working as designed. The design just needs one more piece.',
        'Write-around avoids both walls by skipping the cache entirely, but it creates a different one: the first read of anything just written is a guaranteed cache miss. And if the write must go to disk synchronously anyway, the latency is the same as write-through without the read benefit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Write-through: the app sends a write; the cache stores the value and forwards it to the backing store; the ack waits until the backing store confirms. Read-after-write is trivially consistent because both copies agree at the ack boundary. Recovery is trivial because every acknowledged write already reached durable storage. The cost is that every write pays the slowest hop in the path.',
        'Write-back: the app sends a write; the cache stores the value, marks it dirty, and acks immediately. A background flusher periodically scans the dirty set and writes entries to the backing store in batches, ordered by age, memory pressure, or checkpoint policy. Repeated writes to the same dirty key collapse into one backing-store write. The backing store is temporarily stale by design -- for dirty entries, the cache IS the truth.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg',
          alt: 'State transition diagram with arrows between process states',
          caption: 'A write-back entry has lifecycle state too: clean, dirty, flushing, durable, or lost after a crash. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Process_states.svg.',
        },
        'Write-around: the app sends a write directly to the backing store, bypassing the cache. The cache only learns about the value if a later read fetches it. This protects the cache from bulk imports that would evict the genuinely hot working set to make room for data nobody will read soon.',
        'Write-back plus WAL: before acking, append one line to a sequential log -- "set count=43." Then mark the cache dirty and ack. The flusher ships dirty pages lazily. On crash, replay the log over the last checkpoint: every acknowledged write resurrects. Latency is roughly 0.5ms (a sequential append is the one thing disks do nearly as fast as RAM), durability is total. This is the literal architecture of PostgreSQL, InnoDB, and the LSM-tree memtable+log pairing.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Write-back cache with dirty-bit tracking',
            'class WriteBackCache {',
            '  constructor(backingStore, maxDirty = 100) {',
            '    this.cache = new Map();      // key -> value',
            '    this.dirty = new Set();      // keys needing flush',
            '    this.store = backingStore;',
            '    this.maxDirty = maxDirty;',
            '  }',
            '',
            '  write(key, value) {',
            '    this.cache.set(key, value);',
            '    this.dirty.add(key);         // mark dirty -- not yet on disk',
            '    if (this.dirty.size >= this.maxDirty) this.flush();',
            '    // ack returns HERE -- before disk write',
            '  }',
            '',
            '  read(key) {',
            '    if (this.cache.has(key)) return this.cache.get(key);',
            '    const val = this.store.read(key);   // cache miss',
            '    if (val !== undefined) this.cache.set(key, val);',
            '    return val;',
            '  }',
            '',
            '  flush() {',
            '    for (const key of this.dirty) {',
            '      this.store.write(key, this.cache.get(key));',
            '    }',
            '    this.dirty.clear();          // all clean now',
            '  }',
            '',
            '  // If crash happens before flush(), dirty entries are LOST.',
            '  // Production systems pair this with a WAL to close that gap.',
            '}',
          ].join('\n'),
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Write-through works because it keeps the cache and backing store synchronized at the ack boundary. After success, either copy can reconstruct the value. The invariant is simple: the slow copy is already current. The cost of that invariant is that every write pays for it.',
        'Write-back with a WAL works because it separates durable ordering from expensive placement. A sequential log append is cheap -- roughly one disk seek regardless of data layout -- so the intent can be recorded before the ack without paying the cost of updating the main data structure in place. The cache and the flusher then optimize layout, batching, and compaction without weakening the recovery promise. The invariant: every acknowledged write appears either in the flushed main structure or in the durable log that recovery will replay.',
        'Write-around works because it treats cache space as a scarce budget. If a workload dumps millions of rows that will not be read soon, caching them would evict the working set. Skipping the cache preserves read performance for the keys that actually benefit from memory residence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Write-through: roughly disk-round-trip latency per write; full crash durability because the ack means the backing store already has the value; best for low-rate metadata and simple recovery.',
            'Write-back without WAL: roughly RAM latency per write; no crash durability during the dirty window; best only when losing acknowledged writes is acceptable or another safety net exists.',
            'Write-back plus WAL: roughly sequential-log latency before ack; full durability because recovery can replay the log; best for databases, filesystems, queues, and LSM-tree memtables.',
            'Write-around: roughly backing-store latency per write; full durability if the store is forced stable; best for bulk loads and write-once data that would pollute the cache.',
          ],
        },
        'Write-through costs throughput because it cannot batch or coalesce. Its reward is no dirty metadata, no flush scheduling, and a one-line recovery story.',
        'Write-back costs complexity: dirty tracking, flush scheduling, memory-pressure backpressure, checkpoint coordination, and a recovery process that replays the log. It also creates subtle durability gaps when operators assume "acknowledged" means "on stable storage" but the configuration disagrees.',
        'The hidden tradeoff is layering. A database buffer pool, OS page cache, SSD firmware FTL, RAID controller, and cloud block device may each buffer writes independently. A durability guarantee is only as strong as the weakest link between the ack and stable media. Calling fsync() forces the OS page cache to flush; without it, even write-through code may be writing into a volatile OS buffer. Battery-backed RAID controllers close the gap at the hardware layer: dirty RAM survives a power cut because the battery keeps the controller alive long enough to flush.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Write-through wins for configuration records, low-rate metadata, and any system where simple recovery matters more than write latency. It is the right default when the backing store must be authoritative after every ack and the write rate is low enough that disk latency is not the bottleneck.',
        'Write-back with a WAL wins in databases, filesystems, LSM-tree memtables, persistent queues, and hardware storage controllers. PostgreSQL and InnoDB WAL-log every transaction so dirty pages can flush lazily without losing acknowledged commits. LSM-tree designs (LevelDB, RocksDB, Cassandra) write to an in-memory memtable plus a log, then flush sorted files in the background. Your CPU L1/L2 caches use write-back with MESI coherence as the safety net. RAID controllers strap a battery to RAM so the dirty window survives the outage itself.',
        'Write-around wins for bulk import, analytics staging, backup restore, and any workload where the written data has no near-term read locality. Loading a million rows through the cache would evict every hot key from the working set to make room for data nobody will query today.',
        {
          type: 'note',
          text: 'fsync semantics matter at the boundary. On Linux, write() puts data in the OS page cache (volatile). fsync() forces it to stable storage. A "write-through" application that never calls fsync is actually write-back into the OS page cache -- a common production surprise. Databases call fdatasync or use O_DIRECT + O_DSYNC to bypass the OS buffer entirely.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The most dangerous failure is lying about the ack. If the application treats success as durable but the cache policy only made the value dirty in RAM, a crash violates the contract. This is catastrophic for payments, order placement, queue consumption, and identity changes -- anywhere an upstream system already acted on the promise.',
        'Uncontrolled dirty growth is the second failure. If the flusher cannot keep up with write throughput, dirty data fills memory, new writes stall behind backpressure, and recovery time grows because the log or dirty set is enormous. Write-back needs an explicit policy for what happens when the dirty set exceeds its budget: slow writers, flush more aggressively, or reject work.',
        'Cache pollution is the third failure. Write-through and write-back both populate the cache with written data. If that data has no near-term reads, it evicts the hot working set for nothing. This is exactly why write-around exists. A cache is a scarce working-set budget, not a faster copy of every byte.',
        {
          type: 'quote',
          text: 'An ack that precedes durability is a promise the crash is allowed to break.',
          attribution: 'The invariant behind every write-caching policy',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Prerequisite: Cache Invalidation -- the read-side version of the freshness problem. Understand read caching before studying write caching.',
            'Prerequisite: LRU Cache -- eviction policy and working-set management. Write-around exists because cache space is finite.',
            'Extension: Write-Ahead Logging -- how durable sequential intent makes lazy data structures crash-safe. The WAL is the piece that rescues write-back.',
            'Extension: LSM Trees -- write-back, memtables, logs, and compaction working together in one design.',
            'Production study: PostgreSQL WAL and checkpoint architecture (pg_wal, wal_level, checkpoint_timeout) for a real write-back + WAL system.',
            'Production study: Linux dirty page writeback (vm.dirty_ratio, vm.dirty_expire_centisecs, fsync) for OS-level write-back policy.',
            'Hennessy & Patterson, "Computer Architecture: A Quantitative Approach" -- cache write policy taxonomy (write-through, write-back, write-allocate).',
            'Arpaci-Dusseau & Arpaci-Dusseau, "Operating Systems: Three Easy Pieces" -- crash consistency, journaling, and fsync semantics.',
          ],
        },
      ],
    },
  ],
};
