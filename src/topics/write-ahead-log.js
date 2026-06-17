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
      heading: 'Why This Exists',
      paragraphs: [
        "A write-ahead log solves a simple but brutal problem: a useful update is often made of several smaller writes, and the machine can crash between any two of them. If a bank transfer subtracts money from account A and adds it to account B, a crash after the first write can destroy money. If a database page is half-written, the on-disk file can contain a state no transaction ever meant to create.",
        "The write-ahead log, or WAL, gives the system an ordered source of truth. Before the database trusts a data-page update, it appends a durable log record describing the intended change. If power fails, recovery reads the log and decides which changes must be replayed and which incomplete changes must disappear. The rule is simple: record intent first, apply data changes second.",
      ],
    },
    {
      heading: 'Naive Approach',
      paragraphs: [
        "The naive approach is to update the data pages directly. For a transfer, write account A with the lower balance, then write account B with the higher balance. If nothing fails, the result looks correct. The code is short, the data file is current, and there is no extra log file to manage.",
        "That approach confuses success in the common case with correctness under failure. Disks, kernels, controllers, and databases can reorder or delay writes. A process can crash after changing memory but before flushing a page. A power loss can happen after one page reaches storage but before the matching page does. Without a separate ordered record, recovery cannot tell whether it is seeing old state, new state, or an impossible mixture.",
      ],
    },
    {
      heading: 'The Wall',
      paragraphs: [
        "The wall is atomic durability. Atomicity says a transaction happens completely or not at all. Durability says a committed transaction survives a crash. Direct page updates cannot provide both unless every related page is forced to stable storage together, which is expensive and often impossible. A database needs to acknowledge a commit without synchronously rewriting every page touched by the transaction.",
        "The wall is also performance. Random data-page writes are expensive, and forcing many pages at commit time would destroy throughput. Databases want to modify pages in memory, flush them later, batch disk work, and still recover exactly. WAL is the trick that allows lazy page flushing without giving up a precise commit boundary.",
      ],
    },
    {
      heading: 'Core Insight',
      paragraphs: [
        "The core insight is to make the log the durable ordering spine of the database. A log append is sequential, easy to checksum, easy to flush, and easy to scan after a crash. Data pages can become a cache of the logged history. They are allowed to lag behind because the log can bring them forward during recovery.",
        "A transaction is considered committed only after its commit record, and the log records before it that describe its changes, reach durable storage under the chosen durability settings. Data pages changed by the transaction may still be dirty in memory. That is safe because the committed intent is durable even if the pages are not.",
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        "A typical WAL record includes a transaction id, a log sequence number, the affected page or logical object, enough redo information to repeat the change, and sometimes undo information or a pointer to undo state. The exact format depends on the engine, but the important feature is order. Later records have later sequence numbers, and data pages remember the newest log sequence number whose change they contain.",
        "During normal execution, the database appends log records as it changes pages in memory. At commit, it forces the commit record to stable storage before telling the client success. A background writer can flush dirty pages later. A checkpoint periodically records a position in the log and pushes enough dirty pages so recovery can start near that point instead of replaying from the beginning of time.",
        "During recovery, the engine scans the log. In ARIES-style recovery, analysis reconstructs which transactions were active and which pages were dirty at the crash. Redo repeats changes that may not have reached data pages. Undo removes the effects of transactions that did not commit. Page sequence numbers make redo safe: if a page already includes a change, recovery skips that record.",
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        "WAL works because it changes the dangerous question. Instead of asking whether every data page is current at crash time, the database asks whether the ordered log contains enough information to reconstruct the committed state. That is a much easier invariant to maintain. The log can be appended and flushed before scattered data pages are written.",
        "The design also separates commit latency from page-cleaning work. The client waits for a small ordered log force, not for every touched page to be written. Later, the storage engine can batch page writes, reorder them for efficiency, and checkpoint in the background. As long as the write-ahead rule is preserved, dirty-page freedom does not break durability.",
        "The invariant is exact: no data page should reach durable storage with a change whose corresponding log record is not durable. If that invariant holds, recovery never sees an unexplained page update. It can always redo committed work and remove or ignore incomplete work.",
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        "The animation uses two accounts. Initially account A has 100 dollars and account B has 50 dollars. Transaction T1 transfers 40 dollars from A to B. The unsafe direct-update path would write A as 60, then write B as 90. WAL first appends the intent: T1 subtracts 40 from A, T1 adds 40 to B, and T1 commits.",
        "Only after the commit record is durable can the database safely acknowledge T1. If the data pages are later written and no crash happens, the balances become A equals 60 and B equals 90. If the crash happens before the pages are written, recovery scans the log, sees that T1 committed, and redoes the two changes. The final state is still A equals 60 and B equals 90.",
        "Now consider T2. It starts to transfer 25 dollars, but only the first log record is present before the crash. There is no commit record. Recovery treats T2 as incomplete. Depending on the engine design, it either ignores T2 because its page changes never reached disk, or undoes any partial changes it finds. The recovered state includes T1 and excludes T2.",
      ],
    },
    {
      heading: 'What The Animation Teaches',
      paragraphs: [
        "The crash-mid-transaction path teaches the commit boundary. A record that says T2 started is not enough. A committed transaction has a durable commit marker; an incomplete transaction does not. Recovery is not guessing from balances. It is reading the durable order of intent.",
        "The no-crash path teaches why the log still matters when everything succeeds. The system can append records sequentially, acknowledge after the commit record is safe, and let checkpointing clean up later. The balances look like the main state, but the log is the structure that lets the database survive interruptions between ordinary writes.",
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        "The algorithmic append cost is small, but the durability cost is real. Forcing a log record to stable storage can add hundreds of microseconds or several milliseconds depending on the storage stack. High-throughput systems use group commit, batching, preallocated segments, checksums, compression, and careful fsync scheduling to amortize that cost.",
        "Checkpoints trade recovery time against foreground work. Frequent checkpoints reduce the amount of log to replay after a crash, but they increase write pressure while the system is running. Infrequent checkpoints improve steady-state throughput, but recovery may take longer. Engines tune this balance differently for embedded databases, OLTP systems, and distributed storage.",
        "Durability settings are part of the contract. Turning synchronous commit off can reduce latency, but it knowingly risks losing recently acknowledged transactions after a power loss. Using storage that lies about flushes can break WAL correctness even if the database code is careful. Hardware, operating system, filesystem, and engine settings all participate in the promise.",
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        "WAL wins in database storage engines because it allows fast commits, lazy page flushing, crash recovery, replication, point-in-time restore, and logical decoding. PostgreSQL WAL, InnoDB redo logs, and SQLite WAL mode all use the same core idea with different file formats and concurrency choices.",
        "The pattern also appears outside traditional databases. LSM-tree engines use a commit log to rebuild memtables after a crash. Message queues expose an append-only log to consumers. Raft uses a replicated log to make state-machine commands durable and ordered across nodes. Event sourcing makes the log the application record rather than an internal recovery structure.",
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        "A WAL does not solve every transaction problem. It provides local crash recovery and durable ordering. It does not by itself provide isolation between concurrent transactions; locking, optimistic concurrency, or MVCC decides what readers and writers can see. It does not by itself provide distributed atomic commit; two-phase commit or consensus is needed when several participants must agree.",
        "WAL also fails when the implementation breaks the write-ahead rule. Torn writes, missing checksums, incorrect page sequence numbers, stale checkpoints, log recycling bugs, or unsafe storage caching can corrupt recovery. The design is simple at the idea level and unforgiving at the byte-ordering level.",
      ],
    },
    {
      heading: 'Failure Modes',
      paragraphs: [
        "Common failure modes include missing commit records, partial log segments, corrupted records, a data page written before its log record is durable, checkpoints that claim more than was safely flushed, and replay logic that is not idempotent. Production engines use checksums, segment boundaries, page sequence numbers, and conservative recovery rules to detect and contain these cases.",
        "Operational failure modes matter too. A full WAL disk can stop writes. Slow archiving can create storage pressure. Replication slots can retain old segments. Aggressive checkpoint settings can cause latency spikes. A replica that applies WAL too slowly can lag far behind primary state. WAL is a correctness mechanism, but it becomes an operational workload.",
      ],
    },
    {
      heading: 'Sources And Study Next',
      paragraphs: [
        "PostgreSQL documentation explains the central rule: data file changes are written only after WAL records describing those changes have reached permanent storage. SQLite documentation explains WAL mode as appending changes to a separate WAL file and checkpointing them back later. InnoDB documentation describes redo logs as the crash-recovery structure for changes not yet present in data files. The ARIES recovery paper provides the classic analysis, redo, and undo model.",
        "Study B-Trees, LSM Trees, PostgreSQL WAL Checkpoint and Recovery, Message Queues, Raft Log Replication, Transaction Isolation Levels, MVCC Internals and VACUUM, Two-Phase Commit, Write-Through versus Write-Back, and Filesystem Journaling next. Those topics separate durability, visibility, replication, atomic commit, and storage-cache behavior.",
      ],
    },
  ],
};
