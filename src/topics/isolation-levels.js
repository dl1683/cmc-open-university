// Transaction isolation: two transactions run "at the same time" — but the
// database decides how much of each other's unfinished business they may
// see. Each level of blindness has a name, a price, and a famous accident.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'isolation-levels',
  title: 'Transaction Isolation Levels',
  category: 'Systems',
  summary: 'Dirty reads, phantoms, and write skew: what concurrent transactions may see of each other, level by level.',
  controls: [
    { id: 'view', label: 'Witness', type: 'select', options: ['the classic anomalies', 'the isolation ladder & MVCC'], defaultValue: 'the classic anomalies' },
  ],
  run,
};

// Timeline builder: rows of [txnA, txnB, truth] string-table indices.
const timeline = (title, rows, table, format) =>
  matrixState({
    title,
    rows: rows.map((_, i) => ({ id: `t${i + 1}`, label: `t${i + 1}` })),
    columns: [{ id: 'a', label: 'Transaction A' }, { id: 'b', label: 'Transaction B' }, { id: 'db', label: 'committed truth' }],
    values: rows,
    format: (v) => table[v] ?? '',
  });

function* anomalies() {
  const anomalyCount = 3;
  const timeSteps = 5;
  const txnColumns = 3;
  let anomalyNum = 0;

  anomalyNum++;
  yield {
    state: timeline(
      'Anomaly 1 — DIRTY READ: acting on money that never existed',
      [[1, 0, 2], [3, 0, 2], [0, 4, 2], [5, 0, 2], [0, 6, 2]],
      ['', 'BEGIN', 'balance = $100', 'UPDATE balance = $50 (uncommitted)', 'reads balance â†’ sees $50 âš ', 'ROLLBACK — never happened', 'approves a loan using $50…'],
    ),
    highlight: { removed: ['t3:b', 't5:b'], compare: ['t4:a'] },
    explanation: `Isolation exists because ${txnColumns - 1} concurrent transactions are allowed to overlap, but the application still wants facts it can trust. The first of ${anomalyCount} anomaly timelines shows the weakest promise. A writes balance = $50 but has not committed; B reads that uncommitted value and acts on it; then A rolls back. The $50 was never durable truth. Dirty reads are dangerous because they let one transaction base a decision on data that may be erased before anyone else can observe it.`,
    invariant: `Anomaly ${anomalyNum} of ${anomalyCount}: a dirty read sees data that can still be rolled back — a fact that may retroactively never have been true.`,
  };

  anomalyNum++;
  yield {
    state: timeline(
      'Anomaly 2 — NON-REPEATABLE READ: the same question, two answers',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — generating a report', 'balance = $100', 'page 1: reads balance â†’ $100', 'UPDATE to $50; COMMIT', 'balance = $50', 'page 2: re-reads balance â†’ $50 âš ', 'report disagrees with itself'],
    ),
    highlight: { compare: ['t2:a', 't4:a'], active: ['t3:b'] },
    explanation: `Anomaly ${anomalyNum} of ${anomalyCount} needs no rollback. A starts a report and reads $100. B commits a perfectly valid update to $50. A reads again inside the same transaction and gets a different answer. The write was real, but A needed a stable view while it was working. Non-repeatable reads are why reports, audits, and multi-step decisions often need more than "only committed data"; they need the same committed world for the whole ${timeSteps}-step transaction.`,
  };

  anomalyNum++;
  yield {
    state: timeline(
      'Anomaly 3 — PHANTOM READ: new rows haunt a repeated query',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — audit large payments', 'payments > $100: 2 rows', 'COUNT(payments > $100) â†’ 2', 'INSERT payment $150; COMMIT', 'payments > $100: 3 rows', 'repeat COUNT â†’ 3 âš ', 'a row APPEARED mid-audit'],
    ),
    highlight: { compare: ['t2:a', 't4:a'], removed: ['t3:b'] },
    explanation: `The ${anomalyNum}rd of ${anomalyCount} timelines moves from rows to predicates. A counts payments over $100 and sees 2. B inserts a new qualifying payment and commits. A repeats the same query and sees 3. No row A read changed; the set matched by the query changed. That is the hard part about phantoms: row locks protect existing rows, but a range query needs protection against future rows too. Predicate or gap locking is the expensive part of the promise.`,
    invariant: `Anomaly ${anomalyNum} of ${anomalyCount}: row locks guard rows that exist; phantoms require locking a predicate — rows that might yet be inserted.`,
  };
}

function* ladder() {
  const levels = 4;
  const anomalyTypes = 3;
  const mvccVersions = 2;
  const engines = 4;

  yield {
    state: matrixState({
      title: 'The SQL isolation ladder: what each level still permits',
      rows: [
        { id: 'ru', label: 'READ UNCOMMITTED' },
        { id: 'rc', label: 'READ COMMITTED' },
        { id: 'rr', label: 'REPEATABLE READ' },
        { id: 'ser', label: 'SERIALIZABLE' },
      ],
      columns: [{ id: 'dirty', label: 'dirty read' }, { id: 'nonrep', label: 'non-repeatable' }, { id: 'phantom', label: 'phantom' }],
      values: [[1, 1, 1], [0, 1, 1], [0, 0, 2], [0, 0, 0]],
      format: (v) => ['blocked âœ“', 'POSSIBLE', 'depends*'][v],
    }),
    highlight: { removed: ['ru:dirty', 'rc:nonrep'], found: ['ser:dirty', 'ser:nonrep', 'ser:phantom'] },
    explanation: `Read the ${levels}-level ladder as a set of promises, not a vocabulary quiz. READ COMMITTED stops dirty reads but lets each statement see a newer committed snapshot. REPEATABLE READ gives the transaction a stable snapshot, and some engines also block phantoms there. SERIALIZABLE is the strong claim: the result must match some one-at-a-time ordering. Higher rungs buy simpler reasoning across all ${anomalyTypes} anomaly types, but the engine pays with locks, conflict checks, old versions, and sometimes aborts.`,
  };

  yield {
    state: timeline(
      'The anomaly the ladder almost misses — WRITE SKEW',
      [[1, 4, 2], [3, 6, 2], [5, 7, 2], [0, 0, 8]],
      ['', 'on-call check: count â‰¥ 2? yes (sees 2)', 'hospital rule: â‰¥1 doctor on call', 'I\'ll sign off â†’ on_call = false', 'on-call check: count â‰¥ 2? yes (sees 2)', 'COMMIT', 'I\'ll sign off too â†’ on_call = false', 'COMMIT', 'on-call doctors: ZERO âš âš '],
    ),
    highlight: { compare: ['t1:a', 't1:b'], removed: ['t4:db'] },
    explanation: `Write skew is the bug that makes isolation matter in real schema design. Both doctors read the same valid snapshot: ${mvccVersions} people are on call. Each updates only its own row, so there is no direct write conflict. Together they break the rule and leave nobody on call. Snapshot isolation — below SERIALIZABLE on the ${levels}-level ladder — can let this pass because each transaction was locally consistent. Serializable isolation rejects it because no serial ordering could have produced both successful checks.`,
    invariant: `Write skew: disjoint writes, overlapping reads — each of the ${mvccVersions} transactions is consistent alone, their combination is not.`,
  };

  yield {
    state: matrixState({
      title: 'MVCC: how modern databases read without blocking writers',
      rows: [
        { id: 'v1', label: 'balance, version 1' },
        { id: 'v2', label: 'balance, version 2' },
        { id: 'reader', label: 'reader txn (started at t5)' },
        { id: 'writer', label: 'writer txn (commits t8)' },
      ],
      columns: [{ id: 'state', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', '$100 — valid t0…t8', '$50 — valid t8…now', 'still sees version 1: $100', 'created version 2; blocked nobody'][v],
    }),
    highlight: { active: ['reader:state'], found: ['writer:state'] },
    explanation: `MVCC is how modern databases make the middle rungs of the ${levels}-level ladder practical. An update appends a new row version instead of overwriting the old one — the table above shows ${mvccVersions} such versions. A reader whose transaction started earlier simply ignores newer versions, so it gets a coherent snapshot while writers keep moving. The cost is cleanup: old versions stay on disk until no active snapshot can see them. This is why isolation levels and VACUUM are two sides of the same design.`,
  };

  yield {
    state: matrixState({
      title: 'What you are actually running (check before you assume)',
      rows: [
        { id: 'pg', label: 'PostgreSQL' },
        { id: 'mysql', label: 'MySQL (InnoDB)' },
        { id: 'oracle', label: 'Oracle' },
        { id: 'sqlite', label: 'SQLite' },
      ],
      columns: [{ id: 'def', label: 'default level' }, { id: 'ser', label: 'its SERIALIZABLE' }],
      values: [[1, 2], [3, 4], [1, 5], [6, 6]],
      format: (v) => ['', 'READ COMMITTED', 'true SSI (aborts on conflict)', 'REPEATABLE READ', 'locking reads (gap locks)', 'actually snapshot isolation!', 'SERIALIZABLE (file lock)'][v],
    }),
    highlight: { compare: ['pg:def', 'mysql:def'], removed: ['oracle:ser'] },
    explanation: `Do not design from the SQL names alone. Defaults differ across all ${engines} engines shown, and they attach different machinery to the same label. The practical rule is simple: use the default for ordinary single-row work, but upgrade any transaction that reads a shared invariant before writing. Seat inventory, overdraft prevention, on-call coverage, and allocation systems need either true serializable isolation, explicit locks, or a deliberately modeled alternative. If the engine aborts conflicts, the retry loop is part of the transaction.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the classic anomalies') yield* anomalies();
  else if (view === 'the isolation ladder & MVCC') yield* ladder();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {heading: 'How to read the animation', paragraphs: ['The animation shows two transactions interleaving over time. Warning markers show the moment a transaction sees a value or range that a stronger isolation level would hide.', {type: 'callout', text: 'Isolation levels are promises about which concurrent histories the database will refuse to expose.'}, {type: 'image', src: './assets/gifs/isolation-levels.gif', alt: 'Animated walkthrough of the isolation levels visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['A transaction is a group of database operations that should commit or roll back as one unit. Isolation exists because many transactions run at once, and their interleavings can expose states that could never happen in a serial run.']},
    {heading: 'The obvious approach', paragraphs: ['The obvious approach is to run one transaction at a time with a global lock. That is correct, but it makes unrelated users wait behind each other.']},
    {heading: 'The wall', paragraphs: ['A database needs concurrency for throughput, but concurrency creates dirty reads, non-repeatable reads, phantoms, write skew, and serialization failures. The wall is allowing overlap without breaking application invariants.']},
    {heading: 'The core insight', paragraphs: ['A schedule does not need to run serially; it needs to satisfy the chosen isolation promise. Engines enforce that promise with locks, snapshots, version chains, predicate protection, dependency tracking, or abort-and-retry.', {type: 'image', src: 'https://cwiki.apache.org/confluence/download/attachments/170266055/Screen%20Shot%202021-04-13%20at%206.40.18%20PM.png?api=v2&modificationDate=1618364438000&version=1', alt: 'Isolation level ladder from read uncommitted through serializable', caption: 'The isolation ladder places snapshot isolation between read committed and serializable, matching the tradeoff the article explains. Source: Apache Hudi RFC 22.'}]},
    {heading: 'How it works', paragraphs: ['Read Uncommitted may expose uncommitted writes, while Read Committed hides those writes but can change view between statements. Repeatable Read gives a stable transaction view, and Serializable rejects histories that cannot match any one-at-a-time order.']},
    {heading: 'Why it works', paragraphs: ['Serial execution is safe because each transaction sees a complete committed prefix of history. Serializable isolation preserves that reasoning under overlap, while weaker levels deliberately make smaller promises for more concurrency.']},
    {heading: 'Cost and complexity', paragraphs: ['Stronger isolation costs blocking, aborts, or metadata. MVCC keeps old row versions for readers, two-phase locking holds locks, and Serializable systems may force applications to retry.']},
    {heading: 'Real-world uses', paragraphs: ['Read Committed fits many request-response applications where each statement can see a fresh committed view. Serializable fits money movement, scheduling, inventory, and any invariant that application code reasons about as if transactions ran alone.']},
    {heading: 'Where it fails', paragraphs: ['Isolation does not roll back side effects outside the database, such as emails or payments. High-contention Serializable workloads can also collapse into retry storms unless the schema or workflow localizes the hot invariant.']},
    {heading: 'Worked example', paragraphs: ['Account A starts at 500. If T1 subtracts 100 but aborts, Read Uncommitted may let T2 display 400 even though that value never committed.', 'At Read Committed, T2 first sees 500, then after T1 commits may see 400 in the same transaction. At Serializable, the database must commit only outcomes equivalent to some serial order or abort one transaction.']},
    {heading: 'Sources and study next', paragraphs: ['Read Gray and Reuter on transaction processing, Berenson et al. on ANSI isolation anomalies, and Cahill, Roeth, and Fekete on Serializable Snapshot Isolation. Then study Write-Ahead Logging, MVCC Internals, Two-Phase Commit, Saga Pattern, Raft, and Paxos.']},
  ],
};
