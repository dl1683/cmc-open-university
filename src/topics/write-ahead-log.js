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
      heading: `What it is`,
      paragraphs: [
        `A write-ahead log is the promise that intent reaches durable storage before the data page it describes is trusted. If a database wants to update page 42 from value A to value B, it first appends a log record saying what changed, assigns it a log sequence number, and only then lets the dirty page be written later. After a crash, recovery uses the log to redo committed work and undo or ignore incomplete work.`,
        `This is the foundation of durable transactions. The ARIES recovery paper from 1992 made the pattern canonical: log records, page LSNs, checkpoints, redo, and undo. The log is not just a backup file; it is the ordering spine that lets memory, disk, and crash recovery agree on what happened.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `During a transaction, the database modifies pages in memory and appends log records describing those changes. At commit, it must force the commit record, and all earlier log records for that transaction, to durable storage before acknowledging success under full durability settings. The data pages themselves do not need to be forced at commit; they can flush later because the log can reconstruct them.`,
        `Recovery has three jobs. Analysis finds the last checkpoint and identifies dirty pages and active transactions. Redo repeats logged changes whose effects may not have reached disk. Undo rolls back transactions that had not committed. Page LSNs keep redo safe: if a page already contains a change, recovery sees that its LSN is new enough and skips reapplying it. That is more precise than hoping every operation is naturally idempotent.`,
        `Group commit makes the cost practical. Instead of one fsync per transaction, PostgreSQL, MySQL InnoDB, and SQLite can persist many commit records with one flush. Durability knobs change the contract: turning synchronous commit off can improve latency but knowingly risks the last few transactions after a power loss.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Appending a log record is O(1), but forcing it to stable storage is a latency event. NVMe may flush in hundreds of microseconds; networked storage or spinning disks can take milliseconds. High-throughput systems batch, preallocate segments, compress records, and separate log devices from data devices. The complexity lives in correctness: torn writes, checksums, partial segments, checkpoints, log recycling, and replication all need exact ordering.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `PostgreSQL WAL powers crash recovery, streaming replication, point-in-time restore, and logical decoding. InnoDB's redo log protects pages and works alongside undo logs for MVCC Internals & VACUUM-style visibility. SQLite's WAL mode lets readers continue while a writer appends to a separate log. LSM Trees (How Cassandra Writes) use a commit log to rebuild memtables after a crash. Message Queues such as Kafka expose the append-only log directly to consumers, while Raft Log Replication turns log agreement into replicated state-machine safety.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The log and data page do not have to be one atomic disk write; the whole point is that the log reaches disk first and page state can catch up later. What is forbidden is a data page reaching disk with changes whose log records are not durable. Another misconception is that a log makes every distributed operation atomic. Two-Phase Commit (2PC) needs each participant's local log, but the coordinator decision is still a separate distributed protocol. Transaction Isolation Levels also are not provided by the log alone; locking or MVCC decides what concurrent readers are allowed to see.`,
        `Write caching is dangerous if hardware lies about flushes. A database can call fsync correctly and still lose data if the storage stack reorders writes without battery-backed cache. Write-Through vs Write-Back is therefore an operational durability choice, not just a performance tuning checkbox.`,
      ],
    },
    {
      heading: `Sources and engine details`,
      paragraphs: [
        `PostgreSQL's WAL introduction states the central rule directly: changes to data files are written only after WAL records describing those changes have been flushed to permanent storage: https://www.postgresql.org/docs/current/wal-intro.html. The PostgreSQL WAL configuration documentation shows the operational side: segment size, checkpoints, archiving pressure, and runtime tuning: https://www.postgresql.org/docs/current/runtime-config-wal.html.`,
        `SQLite's WAL documentation explains the alternate commit path where changes append to a separate WAL file and checkpoints later move frames into the main database: https://sqlite.org/wal.html. For low-level details, SQLite also documents the WAL-mode file format and wal-index behavior: https://sqlite.org/walformat.html. InnoDB's redo log documentation describes the redo log as the crash-recovery structure for replaying changes that had not reached data files before shutdown: https://dev.mysql.com/doc/refman/9.7/en/innodb-redo-log.html.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read B-Trees (How Databases Read) and LSM Trees (How Cassandra Writes) to see what the log protects. Then study Message Queues and Raft Log Replication for systems where the log becomes the public interface or consensus object. Finish with Transaction Isolation Levels, MVCC Internals & VACUUM, Two-Phase Commit (2PC), and Write-Through vs Write-Back to separate durability, visibility, atomic commit, and storage-cache behavior.`,
        `For the PostgreSQL-specific continuation, study PostgreSQL WAL Checkpoint & Recovery. It turns the general WAL invariant into checkpoint redo pointers, page LSN comparisons, dirty-buffer flushing, and crash restart behavior.`,
      ],
    },
  ],
};
