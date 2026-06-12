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
      heading: 'What it is',
      paragraphs: [
        `A write-ahead log (WAL) is a strict discipline: before you mutate any data, you must first append a complete description of that change to an immutable, append-only log file and flush it to disk. Only after the log entry is safely written do you apply the change to your actual data structures in memory or on disk. The log is the source of truth; the data itself is derivative. If the system crashes at any moment, the log survives unchanged, and recovery reads it to replay all committed work.`,
        `The core insight is deceptively simple: a crash is not a disaster if you know exactly what you were trying to do. By writing the intent first, you can always resume. The log makes atomicity possible even across multiple separate writes — there is no "both-or-neither" problem if every transaction is marked with a commit flag in the log before any of its changes are applied.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Every transaction begins by writing a sequence of log records — one per logical change — followed by a commit marker. These records are appended sequentially (cheap: just memcpy and disk append) and flushed via fsync. The cost of fsync is harsh: typically 5–20 milliseconds on spinning disks, even on SSDs 0.5–2 milliseconds, because fsync waits for the physical disk to acknowledge. Real databases batch multiple transactions' commits via group commit, allowing one fsync to durably persist dozens of transactions at once, amortizing the cost.`,
        `Once the commit marker is durable, the database applies the changes to its in-memory and on-disk data structures. If a crash occurs before the commit marker, the transaction never happened. If it crashes after, recovery simply re-reads the log, skips uncommitted records (no commit marker), and replays committed ones. Replay is idempotent: applying the same change twice produces the same result as applying it once, so it is safe to repeat on restart.`,
        `To prevent recovery from replaying the entire log for years on restart, databases use checkpoints: a background process writes a marker saying "all committed transactions up to timestamp T are now durably applied." Recovery can then skip those records and only replay from the checkpoint forward, keeping restart time bounded.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `The primary cost is I/O latency: every transaction write is blocked by fsync. Raw fsync throughput is measured in hundreds per second, not thousands, making write-heavy workloads sensitive to group-commit tuning and storage hardware. Writes must be sequential (to append to a log), so concurrent writes serialize through a single log mutex. Memory overhead is modest: the log itself occupies disk space but compresses well. The complexity of recovery — scanning the log, filtering by commit status, replaying all changes idempotently — is real but well-understood and critical: if recovery is buggy, your entire durability guarantee is broken.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `PostgreSQL uses WAL as its core durability mechanism. Every change to any table, index, or internal structure is logged before it hits disk; Postgres ships these log records to replicas for replication — replication is log-shipping, a direct application of WAL. MySQL InnoDB's redo log uses the same idea. SQLite's WAL mode (enabled with PRAGMA journal_mode=WAL) lets readers query the database while writes are being logged, because the log is separate from the main database file. LSM Trees (used in Cassandra, RocksDB, LevelDB) store a memtable — an in-memory write buffer — that is rebuilt from a log on crash recovery. Kafka is, at its core, a distributed write-ahead log: messages are appended, persisted, and replayed by consumers. Raft and other consensus protocols ship log entries between nodes: the log IS the replicated state machine. etcd (Kubernetes' configuration store) uses Raft logs.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `A common mistake is thinking the log and the data can be in separate transactions: they cannot. If the log commits but the data does not, or vice versa, atomicity breaks. They must be a single atomic write, or the log must be the only write and data is derived from it on restart. Another trap is forgetting idempotence: if your redo operation is not idempotent (e.g., incrementing instead of setting a value), recovery will silently corrupt state by re-applying an already-applied change. Finally, some systems log optimistically — buffering log records in memory and flushing periodically — which can lose recent transactions on crash. True WAL requires synchronous fsync at commit time, the whole point.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `To understand why logs are sequential and efficient, explore LSM Trees (How Cassandra Writes). To see how writes are ordered and how trees handle multiple updates, study B-Trees (How Databases Read). Write-ahead logs are the backbone of message durability — learn Queue to see how Kafka-like systems handle ordering. Understand Consistent Hashing to see how replicas are chosen (and where log records are sent). Study LRU Cache to see how databases manage memory and decide which data pages stay in RAM while the log grows.`,
      ],
    },
  ],
};

