// The write-ahead log: why databases survive power cuts. Never change data
// until the INTENT is safely on disk — then a crash can always be replayed.

import { arrayState, InputError } from '../core/state.js';

export const topic = {
  id: 'write-ahead-log',
  title: 'Write-Ahead Log (WAL)',
  category: 'Systems',
  summary: 'Log the intent first, apply it second — so a crash at any moment can be replayed into a consistent state.',
  controls: [
    { id: 'crash', label: 'Scenario', type: 'select', options: ['crash mid-transaction', 'no crash'], defaultValue: 'crash mid-transaction' },
  ],
  run,
};

export function* run(input) {
  const crashing = String(input.crash) === 'crash mid-transaction';
  if (!['crash mid-transaction', 'no crash'].includes(String(input.crash))) {
    throw new InputError('Pick a scenario.');
  }

  const balances = { A: 100, B: 50 };
  const log = [];
  const balancesView = () => arrayState([`A: $${balances.A}`, `B: $${balances.B}`]);
  const logView = () => arrayState(log.length ? log : ['(empty log)']);

  yield {
    state: balancesView(),
    highlight: {},
    explanation: 'Two bank accounts on disk. The dangerous request: transfer $40 from A to B — which is TWO separate writes (A −40, then B +40). If the power dies between them, $40 simply vanishes: the books no longer balance, and nobody can tell what happened. Every database faces this exact problem on every multi-part update.',
  };

  yield {
    state: logView(),
    highlight: {},
    explanation: 'The fix is a discipline, not a structure: before touching ANY data, append your full intent to a WRITE-AHEAD LOG — an append-only file. Appends are sequential (fast, see LSM Trees) and ordered; data pages are only modified AFTER the log entry is safely flushed to disk. The rule in four words: log first, apply second.',
  };

  log.push('T1: A −$40', 'T1: B +$40', 'T1: COMMIT ✓');
  yield {
    state: logView(),
    highlight: { active: ['i0', 'i1', 'i2'] },
    explanation: 'Transaction T1 begins: all three records — both updates AND the commit marker — are appended to the log and flushed. Only the commit marker makes T1 real: a transaction without one never officially happened.',
    invariant: 'No data page changes before its log entry is durably on disk.',
  };

  balances.A -= 40;
  balances.B += 40;
  yield {
    state: balancesView(),
    highlight: { found: ['i0', 'i1'] },
    explanation: 'Now — and only now — the actual balances are updated: A $60, B $90. If the crash had come a moment earlier, the log alone could redo everything. The data pages have become, in a sense, just a cache of what the log says.',
  };

  log.push('T2: A −$25');
  yield {
    state: logView(),
    highlight: { active: [`i${log.length - 1}`] },
    explanation: `Transaction T2 begins (A −$25, B +$25): the first record lands in the log${crashing ? '…' : ', with the rest about to follow.'}`,
  };

  if (crashing) {
    yield {
      state: logView(),
      highlight: { removed: [`i${log.length - 1}`] },
      explanation: '⚡ CRASH. Power gone, RAM gone, mid-transaction. T2 wrote one log record but never its commit marker — and never touched the balances. On restart, the database does not panic; it READS THE LOG.',
    };

    yield {
      state: logView(),
      highlight: { found: ['i0', 'i1', 'i2'], removed: [`i${log.length - 1}`] },
      explanation: 'RECOVERY, the whole algorithm: scan the log; T1 has a COMMIT marker → REDO its writes (applying them twice is harmless — they set the same values). T2 has no commit marker → it never happened; discard it. Incomplete work disappears cleanly, complete work survives guaranteed.',
      invariant: 'After replay: every committed transaction is applied, every uncommitted one is gone.',
    };

    yield {
      state: balancesView(),
      highlight: { found: ['i0', 'i1'] },
      explanation: 'The recovered state: A $60, B $90 — exactly the books after T1, with T2\'s half-finished transfer erased as if never attempted. Total is $150, consistent. This is atomicity (the A in ACID), manufactured from nothing but an append-only file and a replay loop.',
    };
  } else {
    log.push('T2: B +$25', 'T2: COMMIT ✓');
    balances.A -= 25;
    balances.B += 25;
    yield {
      state: balancesView(),
      highlight: { found: ['i0', 'i1'] },
      explanation: 'No crash this time: T2 logs its remaining records, commits, and applies — A $35, B $115. The log quietly grows; a background CHECKPOINT periodically marks "everything before here is applied" so recovery never replays from the beginning of time.',
    };
  }

  yield {
    state: balancesView(),
    highlight: {},
    explanation: 'WAL is everywhere once you see it: Postgres ships these log records to replicas (replication IS log-shipping), SQLite\'s WAL mode lets readers run during writes, the LSM Tree\'s memtable is rebuilt from one after a crash — and Kafka is essentially a write-ahead log promoted to a whole product. One humble idea — write down what you are ABOUT to do — underwrites nearly all of durable computing.',
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        "The animation shows two bank accounts and an append-only log. Active (highlighted) items are log records being written right now. Found (green) items are durable state that survived recovery. Removed (red) marks a record belonging to an uncommitted transaction that recovery will discard.",
        "Watch the ordering: log records appear before any balance changes. The commit marker is the boundary. A transaction with a commit marker in the log is real; one without it never happened. When the crash fires, recovery reads the log top to bottom, redoes committed work, and erases incomplete work.",
        "At each frame, check: has the log been flushed before the data page changed? That single ordering rule is the entire correctness argument.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        "A useful database update often requires several writes. A bank transfer subtracts from one account and adds to another. If the machine loses power between those two writes, money vanishes and the books no longer balance. The on-disk state reflects a transaction that was never meant to exist half-finished.",
        "The write-ahead log exists to guarantee that committed transactions survive crashes and uncommitted ones leave no trace. Before modifying any data page, the database appends a record of intent to a sequential, append-only log file. If the system crashes, recovery replays the log and reconstructs exactly the committed state. The rule is four words: log first, apply second.",
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        "Write changes directly to the data pages on disk. When a transaction commits, force every modified page to stable storage before acknowledging success. This is correct: if every page is flushed, the on-disk state is consistent. Early systems worked this way.",
        "The approach is not stupid. It is simple, easy to reason about, and correct as long as every page flush completes atomically. For a single-user embedded database with small transactions, it can be adequate.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "Random I/O kills this approach. A spinning disk can do roughly 100 random writes per second but 100,000 sequential writes per second. A single transaction that touches 50 pages needs 50 random page flushes at commit time. At 100 random writes per second, that is 500 milliseconds per commit, which means two commits per second. No serious workload can survive that.",
        "Partial page writes make it worse. A power failure during a page flush can leave a page half-written: the first 4 KB is new data, the last 4 KB is old. The on-disk page is now a state that no transaction ever produced. Even with SSDs removing the rotational penalty, a page write is not atomic at the hardware level. Flushing every page on commit is both too slow and too dangerous.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "Make the log, not the data pages, the source of truth for durability. A log append is sequential, small, checksummable, and fast to flush. Data pages become a cache of what the log says. They can lag behind in memory because the log can always bring them forward during recovery.",
        "A transaction is committed only when its commit record reaches durable storage. The data pages it modified may still be dirty in memory. That is safe: the intent is durable even if the pages are not. The database trades one small sequential write (the log force) for dozens of random page writes, and defers the page writes to a convenient time.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "Each log record carries a log sequence number (LSN), a transaction ID, the affected page, redo information (new value), and optionally undo information (old value). LSNs increase monotonically. Every data page stores the LSN of the most recent log record applied to it, so recovery can tell whether a logged change already reached the page.",
        "During normal operation the database appends log records as it modifies pages in the buffer pool. At commit, it forces the log up through the commit record to stable storage (fsync), then tells the client success. A background writer flushes dirty pages later at its own pace. A checkpoint periodically records the current LSN and flushes enough dirty pages so that recovery need not replay from the beginning of time.",
        "Recovery follows the ARIES protocol (Mohan et al., 1992), the standard used by DB2, InnoDB, PostgreSQL, and SQL Server. It has three phases. Analysis: scan the log from the last checkpoint to find which transactions were active and which pages were dirty at crash time. Redo: replay every logged change from the checkpoint forward, skipping any change whose LSN shows the page already contains it. Undo: walk backward through the log and reverse every change made by transactions that never committed. After undo, the database is in exactly the last committed state.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "Sequential writes are roughly 1,000 times faster than random writes on spinning disks and still significantly faster on SSDs. By converting the commit path from many random page flushes into one sequential log force, WAL makes commits fast without sacrificing durability.",
        "The correctness invariant is precise: no data page may reach stable storage with a change whose log record is not already durable. If that rule holds, recovery never encounters a page update it cannot explain. Redo can safely repeat any committed change because the operation is idempotent (the LSN check skips already-applied records). Undo can safely reverse any uncommitted change because the undo information is in the log. The log is the single ordered timeline, and every other piece of state is derived from it.",
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        "Appending a log record is O(1). The real cost is the fsync that forces the record to durable storage: roughly 200 microseconds on a modern NVMe SSD, 5 milliseconds on a spinning disk. Group commit batches multiple transactions into one fsync, pushing throughput from roughly 200 TPS (one fsync per commit on HDD) to 50,000+ TPS.",
        "Checkpoints amortize recovery cost. Without checkpoints, recovery replays the entire log from the start. A checkpoint every 5 minutes means recovery replays at most 5 minutes of log, typically finishing in seconds. The tradeoff: checkpoints increase foreground write pressure while running because they force dirty pages to disk.",
        "The log itself must live on durable storage. If the log disk fills, the database stops accepting writes. Log segments before the oldest active transaction and the last checkpoint can be archived or recycled. Archiving enables point-in-time recovery; recycling reclaims space.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "PostgreSQL stores its WAL in pg_wal/ and ships log segments to replicas for streaming replication. The same log powers point-in-time recovery, logical decoding, and change data capture. SQLite offers two durability modes: the original rollback journal and WAL mode, where WAL mode allows concurrent readers during writes because readers see a consistent snapshot while the writer appends to the log. MySQL InnoDB uses a circular redo log (the InnoDB log) for crash recovery and an undo log for MVCC rollback.",
        "The pattern extends beyond traditional databases. etcd uses a Raft-replicated WAL to make key-value updates durable and consistently ordered across a cluster. Kafka's commit log is essentially a WAL promoted to a distributed data platform: producers append, consumers replay, and retention policies replace checkpointing. LSM-tree engines like RocksDB and LevelDB use a WAL to rebuild the in-memory memtable after a crash.",
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        "Log growth is the operational tax. Without archival or truncation, the WAL disk fills and writes stop. Replication slots in PostgreSQL can pin old segments if a replica falls behind, creating unbounded storage pressure. Aggressive checkpoint frequency causes write amplification and latency spikes; too-infrequent checkpoints make recovery slow.",
        "WAL does not provide transaction isolation. It handles durability and atomicity (the D and A of ACID), but deciding what concurrent readers and writers can see requires locking, MVCC, or optimistic concurrency control on top of the log. WAL also does not provide distributed atomicity: committing across multiple machines requires two-phase commit or a consensus protocol.",
        "Implementation bugs in the write-ahead rule are catastrophic. A page flushed before its log record, a torn write without a checksum, a checkpoint that claims more progress than actually flushed, or replay logic that is not idempotent can silently corrupt the database. The design is simple at the idea level and unforgiving at the byte level.",
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        "Three transactions run against two accounts (A = $100, B = $50). T1 transfers $40 from A to B. T2 transfers $25 from A to B. T3 inserts a new account C with $0. The log after normal execution would read: [LSN 1] T1: A 100 -> 60 / [LSN 2] T1: B 50 -> 90 / [LSN 3] T1 COMMIT / [LSN 4] T2: A 60 -> 35 / [LSN 5] T2: B 90 -> 115 / [LSN 6] T2 COMMIT / [LSN 7] T3: insert C = 0 / [LSN 8] T3 COMMIT.",
        "Now suppose the crash occurs after LSN 6 (T2 COMMIT) is flushed but before LSN 7 reaches durable storage. T1 committed at LSN 3 and T2 committed at LSN 6, so both survive. T3 has no commit record in the durable log, so it never happened.",
        "Recovery runs ARIES. Analysis: starting from the last checkpoint, the scan finds T1 and T2 committed, T3 active (no commit record). Redo: replay LSN 1 through 6, skipping any record whose page LSN shows the change is already applied. After redo, A = $35, B = $115. Undo: T3's partial work (if any page changes reached disk) is reversed using the undo information in its log records. Final state: A = $35, B = $115, no account C. Every committed dollar is accounted for; every uncommitted change is gone.",
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        "Mohan et al., 1992, 'ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging' -- the definitive WAL recovery protocol, used directly or adapted by DB2, InnoDB, PostgreSQL, and SQL Server. Gray and Reuter, 1993, 'Transaction Processing: Concepts and Techniques' -- the comprehensive textbook on transactional systems.",
        "Study next: B-tree (the page-organized index structure WAL protects), LSM tree (log-structured storage where the WAL idea becomes the entire engine), MVCC (the isolation mechanism that complements WAL's durability), checkpointing (the mechanism that bounds recovery time), Raft consensus (replicated WAL for distributed systems).",
      ],
    },
  ],
};
