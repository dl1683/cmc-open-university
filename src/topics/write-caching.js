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
  const diskLatency = 5;
  const ramLatency = 0.1;
  const speedup = diskLatency / ramLatency;
  const bulkRows = '10M';

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
    explanation: `Cache Invalidation handled the READ side: is the copy fresh? Now the harder half: a WRITE arrives — count = 43 — and the cache must decide when to tell the application "done." Policy 1: WRITE-THROUGH. The write lands in the cache AND travels through to disk before the ack. Both copies always agree, a crash can never lose an acknowledged write, and reads after writes are instantly consistent. The bill: every single write pays full disk latency (~${diskLatency}ms against RAM's ~${ramLatency}ms) — the cache accelerates nothing on the write path. Honest, simple, slow.`,
    invariant: `Write-through: the ack means BOTH copies hold the data — durability bought with ~${diskLatency}ms latency.`,
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
    explanation: `Policy 2: WRITE-BACK (write-behind). The write lands in the cache, the entry is stamped DIRTY, and the app gets its ack IMMEDIATELY — disk will hear about it later, when the flusher batches dirty entries out. ${speedup} times lower write latency, and a subtler superpower: WRITE COALESCING. A hot counter incremented 1,000 times produces 1,000 cache writes but ONE disk write — the flusher only ships the final value. The cache is no longer a copy of the truth; for dirty entries, the cache IS the truth and disk is the stale follower. Hold that sentence for the crash test.`,
    invariant: `Write-back: the ack means the CACHE holds the data — ack at ~${ramLatency}ms, disk flush deferred.`,
  };

  yield {
    state: writeGraph({
      appNote: 'bulk import: 10M rows',
      cacheNote: 'untouched — hot keys stay hot',
      diskNote: 'rows land directly',
      edges: [{ id: 'around', from: 'app', to: 'disk' }],
    }),
    highlight: { active: ['around'], visited: ['cache'] },
    explanation: `Policy 3: WRITE-AROUND. The write skips the cache entirely and lands on disk; the cache learns about the data only if someone later READS it. Why would you dodge your own cache? Pollution: a ${bulkRows}-row bulk import written through the cache would evict every genuinely hot key (the LRU Cache's working set) to make room for rows nobody will read this year. Write-around keeps write-once-read-maybe data out of precious RAM. The cost is symmetric: the first read of anything just written is a guaranteed miss.`,
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
    explanation: `The decision table. Read the latency column against the safety column and the structure of the choice appears: write-back is ${speedup} times faster precisely BECAUSE it acknowledges before durability — the speed is not cleverness, it is borrowed risk. Which raises the only question that matters in production: what exactly happens to those dirty entries when the power dies? The other view runs that experiment.`,
  };
}

function* crashTest() {
  const ackTime = 0.1;
  const crashTime = 40;
  const walLatency = 0.5;
  const oldValue = 42;
  const newValue = 43;

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
    explanation: `The audit arrives as a power cut. At t=${ackTime}ms the application was TOLD the write was saved; at t=${crashTime}ms the dirty entry was still waiting for the flusher; at reboot, disk holds yesterday's value (count = ${oldValue} instead of ${newValue}). The application did not crash, did nothing wrong, and lost an acknowledged write — the worst kind of loss, because upstream systems (a user shown "order placed", a Message Queue consumer that already deleted the message) acted on the ack. Write-back's dirty window is not a bug; it is the product working as designed. The design just needs one more piece.`,
    invariant: `An ack at t=${ackTime}ms that precedes durability is a promise the crash at t=${crashTime}ms is allowed to break.`,
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
    explanation: `The rescue you have already studied: pair write-back with a WRITE-AHEAD LOG. Before the ack, append one line — "set count = ${newValue}" — to a sequential log file (sequential appends are the one thing disks do nearly as fast as RAM; that asymmetry is the whole WAL topic). THEN let the data structure be lazy: dirty pages flush whenever batching suits them. Crash? Replay the log over the last flushed state and every acknowledged write resurrects. Latency ~${walLatency}ms, durability total: write-back's speed with write-through's conscience. This is not an exotic trick — it is the literal architecture of PostgreSQL, MySQL's InnoDB, and the LSM-Tree's memtable+log pairing.`,
    invariant: `Log the intent sequentially before the ack (~${walLatency}ms); batch the expensive structure lazily after it.`,
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
    explanation: `The census: write-back wins almost everywhere — the latency gap (${ackTime}ms vs ${walLatency}ms vs full disk) is too valuable to refuse — but NEVER alone; every serious deployment bolts on a safety net matched to its failure model. Your CPU write-backs between cache levels with coherence protocols guarding correctness; your OS write-backs every file save until fsync insists; Redis lets you dial the dirty window per workload; databases log first and relax after; hardware RAID straps a battery to the RAM so the dirty window survives the outage itself. One idea threads every row, and it is the same one from Picking a Threshold with Real Costs: the ack point is a DIAL, not a default — set it by the price of a lost write, and make whoever moves it fast also pay for the net.`,
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
        'Read each policy by the acknowledgement point. An acknowledgement, or ack, is the moment the system tells the caller that the write succeeded. Active highlights show the write path, found highlights show durable state, and removed highlights show data lost by a crash window.',
        {type: 'callout', text: 'Write caching is an acknowledgement policy: the moment the system says done defines what a crash is allowed to lose.'},
        {type: 'image', src: './assets/gifs/write-caching.gif', alt: 'Animated walkthrough of the write caching visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is contract first. If the ack happens after stable storage, the crash must preserve the write. If the ack happens while the value is only dirty in memory, the crash is allowed to lose it unless another durable record exists.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A cache is faster than the backing store, so writes can be acknowledged at different points. RAM may absorb a write in nanoseconds, while a disk or remote replica may take milliseconds. The policy chooses whether speed or durability gets priority at the ack boundary.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg',
          alt: 'Computer memory hierarchy from fast CPU cache to slower storage',
          caption: 'Write policy exists because every cache layer is faster and less durable than the authority below it. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.',
        },
        'Write caching exists because systems need to absorb bursts, batch slow writes, and avoid polluting hot read caches. It is not just an optimization; it is a promise about what survives failure.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is write-through. Every write updates the cache and the backing store before returning success. That gives a simple recovery story because the authority is current when the caller sees success.',
        'The other obvious approach is write-back. The cache records the new value, marks it dirty, and returns before the backing store is updated. That is fast, but the dirty window becomes part of the system contract.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Write-through hits the latency wall. If each durable write takes 5 ms, a single thread can acknowledge only about 200 writes per second before batching or parallelism. Every caller waits for the slow layer.',
        'Write-back hits the crash wall. If memory loses power before dirty entries flush, acknowledged writes disappear. The system needs a write-ahead log, battery-backed cache, replication, or a weaker durability promise.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the serving copy from the authority copy, then define the ack boundary explicitly. Write-through says the authority changes before the ack. Write-back says memory may acknowledge early, but then another mechanism must make that safe if durability is required.',
        'Write-around adds a third choice: write directly to the backing store and skip the cache. That protects cache space when the written data has little chance of being read soon.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'In write-through, the system updates cache and store on the request path. In write-back, it updates cache, marks the entry dirty, and lets a background flusher write dirty entries later. In write-around, it writes the store and invalidates or leaves the cache cold.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg',
          alt: 'State transition diagram with arrows between process states',
          caption: 'A write-back entry has lifecycle state too: clean, dirty, flushing, durable, or lost after a crash. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Process_states.svg.',
        },
        'A durable write-back design usually adds a WAL. The system appends intent to a sequential log before acking, marks cache state dirty, and later flushes the main structure. Recovery replays the log after a crash.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Write-through works because the backing store is current at the ack boundary. The invariant is simple: after success, the authority already has the value.',
        'Write-back plus WAL works because every acknowledged write exists in either the flushed data structure or the durable log. Recovery can replay the log, so lazy placement does not break the promise.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Write-through pays backing-store latency per write unless the store batches internally. Write-back pays memory latency on the foreground path, plus background flush cost, dirty metadata, log bandwidth if durable, and recovery work after crashes.',
        'Doubling write rate doubles dirty pressure. If the flusher cannot keep up, memory fills, latency spikes, and writers need backpressure. The dominant cost becomes managing the dirty set, not just writing bytes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Write-through fits low-rate metadata, configuration, and safety-critical state where simple recovery matters. Write-back plus WAL fits databases, filesystems, queues, LSM-tree memtables, and storage controllers because batching and sequential logging save throughput.',
        'Write-around fits bulk imports, backup restores, analytics loads, and write-once data. The access pattern is many new writes with little near-term read locality, so caching them would evict useful resident data.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The dangerous failure is an ack that means less than the caller thinks. If an order system returns success while the write is only dirty RAM, a crash can erase a purchase after downstream systems acted on it.',
        'Write caching also fails through uncontrolled dirty growth and cache pollution. A dirty set that grows without bound increases recovery time and memory pressure. A bulk load that enters the cache can evict the working set for data nobody will read.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a durable disk write takes 5 ms and a RAM cache write takes 0.001 ms. With write-through, 1,000 writes take about 5 seconds on one serialized path. With write-back, foreground acks take about 1 ms total, but 1,000 dirty writes still must flush later.',
        'If the system appends a WAL record in 0.2 ms before each ack, the 1,000 foreground writes take about 200 ms and survive a crash. That is slower than unsafe write-back and much faster than forcing every final page update immediately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL WAL documentation at https://www.postgresql.org/docs/current/wal.html, Linux fsync documentation at https://man7.org/linux/man-pages/man2/fsync.2.html, and Operating Systems: Three Easy Pieces chapters on persistence at https://pages.cs.wisc.edu/~remzi/OSTEP/.',
        'Study Write-Ahead Logging, Cache Invalidation, LRU Cache, fsync, Buffer Pools, LSM Trees, and Filesystem Journaling next. The core question is what the ack promises about the next crash.',
      ],
    },
  ],
};
