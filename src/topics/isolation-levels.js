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
  yield {
    state: timeline(
      'Anomaly 1 — DIRTY READ: acting on money that never existed',
      [[1, 0, 2], [3, 0, 2], [0, 4, 2], [5, 0, 2], [0, 6, 2]],
      ['', 'BEGIN', 'balance = $100', 'UPDATE balance = $50 (uncommitted)', 'reads balance → sees $50 ⚠', 'ROLLBACK — never happened', 'approves a loan using $50…'],
    ),
    highlight: { removed: ['t3:b', 't5:b'], compare: ['t4:a'] },
    explanation: 'Isolation exists because concurrent transactions are allowed to overlap, but the application still wants facts it can trust. The first timeline shows the weakest promise. A writes balance = $50 but has not committed; B reads that uncommitted value and acts on it; then A rolls back. The $50 was never durable truth. Dirty reads are dangerous because they let one transaction base a decision on data that may be erased before anyone else can observe it.',
    invariant: 'A dirty read sees data that can still be rolled back — a fact that may retroactively never have been true.',
  };

  yield {
    state: timeline(
      'Anomaly 2 — NON-REPEATABLE READ: the same question, two answers',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — generating a report', 'balance = $100', 'page 1: reads balance → $100', 'UPDATE to $50; COMMIT', 'balance = $50', 'page 2: re-reads balance → $50 ⚠', 'report disagrees with itself'],
    ),
    highlight: { compare: ['t2:a', 't4:a'], active: ['t3:b'] },
    explanation: 'This one needs no rollback. A starts a report and reads $100. B commits a perfectly valid update to $50. A reads again inside the same transaction and gets a different answer. The write was real, but A needed a stable view while it was working. Non-repeatable reads are why reports, audits, and multi-step decisions often need more than "only committed data"; they need the same committed world for the whole transaction.',
  };

  yield {
    state: timeline(
      'Anomaly 3 — PHANTOM READ: new rows haunt a repeated query',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — audit large payments', 'payments > $100: 2 rows', 'COUNT(payments > $100) → 2', 'INSERT payment $150; COMMIT', 'payments > $100: 3 rows', 'repeat COUNT → 3 ⚠', 'a row APPEARED mid-audit'],
    ),
    highlight: { compare: ['t2:a', 't4:a'], removed: ['t3:b'] },
    explanation: 'The third timeline moves from rows to predicates. A counts payments over $100 and sees 2. B inserts a new qualifying payment and commits. A repeats the same query and sees 3. No row A read changed; the set matched by the query changed. That is the hard part about phantoms: row locks protect existing rows, but a range query needs protection against future rows too. Predicate or gap locking is the expensive part of the promise.',
    invariant: 'Row locks guard rows that exist; phantoms require locking a predicate — rows that might yet be inserted.',
  };
}

function* ladder() {
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
      format: (v) => ['blocked ✓', 'POSSIBLE', 'depends*'][v],
    }),
    highlight: { removed: ['ru:dirty', 'rc:nonrep'], found: ['ser:dirty', 'ser:nonrep', 'ser:phantom'] },
    explanation: 'Read the ladder as a set of promises, not a vocabulary quiz. READ COMMITTED stops dirty reads but lets each statement see a newer committed snapshot. REPEATABLE READ gives the transaction a stable snapshot, and some engines also block phantoms there. SERIALIZABLE is the strong claim: the result must match some one-at-a-time ordering. Higher rungs buy simpler reasoning, but the engine pays with locks, conflict checks, old versions, and sometimes aborts.',
  };

  yield {
    state: timeline(
      'The anomaly the ladder almost misses — WRITE SKEW',
      [[1, 4, 2], [3, 6, 2], [5, 7, 2], [0, 0, 8]],
      ['', 'on-call check: count ≥ 2? yes (sees 2)', 'hospital rule: ≥1 doctor on call', 'I\'ll sign off → on_call = false', 'on-call check: count ≥ 2? yes (sees 2)', 'COMMIT', 'I\'ll sign off too → on_call = false', 'COMMIT', 'on-call doctors: ZERO ⚠⚠'],
    ),
    highlight: { compare: ['t1:a', 't1:b'], removed: ['t4:db'] },
    explanation: 'Write skew is the bug that makes isolation matter in real schema design. Both doctors read the same valid snapshot: two people are on call. Each updates only its own row, so there is no direct write conflict. Together they break the rule and leave nobody on call. Snapshot isolation can let this pass because each transaction was locally consistent. Serializable isolation rejects it because no serial ordering could have produced both successful checks.',
    invariant: 'Write skew: disjoint writes, overlapping reads — each transaction is consistent alone, their combination is not.',
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
    explanation: 'MVCC is how modern databases make the middle rungs practical. An update appends a new row version instead of overwriting the old one. A reader whose transaction started earlier simply ignores newer versions, so it gets a coherent snapshot while writers keep moving. The cost is cleanup: old versions stay on disk until no active snapshot can see them. This is why isolation levels and VACUUM are two sides of the same design.',
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
    explanation: 'Do not design from the SQL names alone. Defaults differ, and engines attach different machinery to the same label. The practical rule is simple: use the default for ordinary single-row work, but upgrade any transaction that reads a shared invariant before writing. Seat inventory, overdraft prevention, on-call coverage, and allocation systems need either true serializable isolation, explicit locks, or a deliberately modeled alternative. If the engine aborts conflicts, the retry loop is part of the transaction.',
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
    {
      heading: `What it is`,
      paragraphs: [
        `Transaction isolation is the database rulebook for overlapping work. Two transactions can run at the same time, but each one still needs a view of the data that is coherent enough for the decision it is making. Isolation levels name bundles of visibility promises: whether uncommitted writes are hidden, whether a repeated row read stays stable, whether a range query can grow underneath the transaction, and whether the final result could have happened one transaction at a time.`,
        `The topic matters because application code often reads a condition and then writes based on that condition. A bank checks a balance before approving a transfer. A booking system checks remaining seats before inserting an order. A hospital roster checks on-call coverage before letting a doctor sign off. If two transactions make individually reasonable choices against unstable views, the combined result can violate the rule the business actually cares about.`,
        `Isolation is therefore not just a database setting. It is a correctness tool for shared invariants. Lower isolation can improve throughput and reduce blocking, but it can expose states the application should not trust. Higher isolation can make reasoning simpler, but the engine pays with locks, old row versions, conflict checks, and sometimes aborted transactions that the application must retry.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The simple approach is to run transactions concurrently and only prevent the most obvious conflict: two writers trying to modify the same row at the same time. That feels natural. If transaction A updates account 7 and transaction B updates account 8, why should they block each other? If every transaction touches a single row and all rules are local to that row, this can be enough.`,
        `The approach breaks when reads matter. Most real transactions do not only write; they inspect a condition first. "Is the balance still positive?" "Are fewer than 100 seats sold?" "Are at least two doctors on call?" Those reads define the transaction's safety boundary. If the database lets the read view shift, include uncommitted values, or miss concurrent inserts, the write may be based on a false premise.`,
        `This is why isolation levels are described as anomalies rather than only lock modes. The bug is not that a lock was absent in the abstract. The bug is that the application observed a world that was not safe for the decision it made.`,
      ],
    },
    {
      heading: `Classic anomalies`,
      paragraphs: [
        `A dirty read is the weakest failure. Transaction A writes a value but has not committed. Transaction B reads it and acts on it. Then A rolls back. B made a decision using a value that never became durable truth. This is dangerous because rollback is allowed behavior, not an exceptional disaster. Any isolation level that permits dirty reads lets one transaction depend on another transaction's unfinished private work.`,
        `A non-repeatable read is subtler. Transaction A reads a row and sees $100. Transaction B updates that row to $50 and commits. Transaction A reads the same row again inside the same transaction and sees $50. Both values were committed at the moment they were read, but A did not have a stable view for a multi-step decision. Reports, audits, and business workflows often need the same committed world from start to finish.`,
        `A phantom read moves from rows to predicates. A transaction asks for all payments greater than $100 and sees two rows. Another transaction inserts a new $150 payment and commits. The first transaction repeats the query and sees three rows. No previously read row changed. The matched set changed. This is why range and predicate protection are harder than row protection: the database may need to guard rows that do not exist yet.`,
      ],
    },
    {
      heading: `Isolation ladder`,
      paragraphs: [
        `READ UNCOMMITTED permits dirty reads. It is rarely the right choice for application data because it allows facts to disappear retroactively. READ COMMITTED blocks dirty reads. Each statement sees committed data, but two statements in the same transaction may see different committed snapshots. That makes it a common default for simple web requests and single-row updates, but not a complete answer for multi-step invariants.`,
        `REPEATABLE READ aims to give a transaction a stable view for rows it reads. In MVCC systems this often means a transaction-level snapshot. Repeating the same row read gives the same answer. Depending on the engine, phantom protection may or may not be included under this label. MySQL InnoDB and PostgreSQL use the same SQL vocabulary differently enough that relying on the name alone is a mistake.`,
        `SERIALIZABLE is the strong claim: the committed result must be equivalent to some one-at-a-time ordering of the transactions. The database may still run transactions concurrently, but it must reject or block histories that cannot be explained as serial. This is the isolation level that directly protects reasoning about shared invariants, but it usually requires conflict detection, predicate protection, wider locks, or application retry loops.`,
      ],
    },
    {
      heading: `Write skew`,
      paragraphs: [
        `Write skew is the anomaly that separates "stable snapshot" from "serial history." Imagine a hospital rule: at least one doctor must remain on call. Two doctors are currently on call. Each doctor starts a transaction, reads the roster, sees two doctors, and sets only their own row to off call. The writes do not conflict at the row level because each doctor updates a different row. Both transactions commit, and the roster ends with zero doctors on call.`,
        `Each transaction was locally reasonable against its snapshot. The combined result is impossible under any serial ordering. If doctor A had committed first, doctor B would have seen only one doctor on call and should not have signed off. If doctor B had committed first, doctor A should not have signed off. Snapshot isolation can allow this because it detects write-write conflicts but may not detect the read predicate that both transactions depended on.`,
        `The invariant is the important part: disjoint writes can still be coupled by overlapping reads. If correctness depends on a count, absence, sum, range, uniqueness rule, capacity limit, or "at least one" condition, a transaction can be unsafe even when it updates a different row from every concurrent transaction.`,
      ],
    },
    {
      heading: `MVCC mechanics`,
      paragraphs: [
        `MVCC, or multi-version concurrency control, is the common mechanism that makes stronger read views practical. An update creates a new version of a row instead of overwriting the old version in place. A reader uses transaction metadata to decide which version is visible to its snapshot. This lets old readers continue without blocking many writers, and it lets writers create new versions without waiting for every reader to finish.`,
        `The price is version management. Old row versions cannot be removed while an active transaction might still see them. Long-running transactions therefore keep history alive and can create storage bloat, vacuum pressure, or undo-log pressure depending on the engine. Isolation policy is tied to cleanup policy: the stronger and longer the snapshots, the more old state the system may need to preserve.`,
        `MVCC also does not automatically mean serializable. It is a way to provide snapshots. The engine still needs rules for write conflicts, predicate conflicts, gap locks, serializable snapshot isolation, or aborts. When a database says "snapshot isolation" or "repeatable read," ask what conflicts it detects, what it blocks, and what anomalies remain possible.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The cost rises with the strength of the promise. READ COMMITTED can keep locks short and let each statement choose a fresh committed snapshot. Transaction-level snapshots keep older versions alive longer. Serializable execution adds more bookkeeping: predicate locks, gap locks, read/write dependency tracking, validation, or blocking. The user-visible cost is slower transactions, more contention, or aborted transactions that must be retried.`,
        `Predicate protection is the expensive corner. Locking account 7 is a concrete operation. Protecting "all future payments over $100" or "the absence of a booking for this seat" requires range protection or conflict detection over a set that may not have a row yet. Different engines implement this differently. Some lock index gaps. Some track predicate-like dependencies. Some provide snapshot isolation under a label that sounds stronger than it is.`,
        `The application cost is as real as the engine cost. If a serializable transaction can abort, the whole transaction body must be retryable. If the transaction sent an email, charged a card, or called an external API before commit, retrying becomes dangerous. High-isolation workflows should keep side effects after commit or make them idempotent through an outbox or ledger.`
      ],
    },
    {
      heading: `Where it is useful`,
      paragraphs: [
        `Use weaker isolation for work whose correctness is local: page views, simple profile edits, cache refreshes, approximate counters, and reads that tolerate seeing fresh committed changes between statements. The default level of a mature database is often chosen for this broad middle of application work, where short transactions and high throughput matter.`,
        `Use stronger isolation, explicit locks, constraints, or single-writer routing when a transaction reads a shared condition before writing. Seat inventory, account overdraft prevention, entitlement grants, medical schedules, quota allocation, uniqueness across a filtered set, and audit cutoffs are common examples. In these workflows, the cost of a rare anomaly can exceed the cost of blocking or retrying.`,
        `A practical design process is to list invariants first, not isolation levels first. For each invariant, ask which rows or predicates the transaction reads, what it writes, what concurrent transaction could make the read stale, and whether the database will detect that conflict at the chosen level. Then test the conflict path deliberately.`
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `The first misconception is treating isolation as a global virtue. Raising every transaction to SERIALIZABLE can waste throughput and create avoidable aborts. Leaving everything at the default can corrupt the few workflows where a shared invariant matters. The right isolation boundary is often per transaction or per workflow, not a slogan applied to the whole system.`,
        `The second misconception is treating a stable snapshot as a serial proof. Snapshot isolation is useful, but write skew shows that it can preserve each transaction's private view while allowing the combined result to break a rule. If the database does not provide true serializable conflict detection, model the invariant with a locked aggregate row, exclusion constraint, unique index, materialized guard row, or single-writer queue.`,
        `The third failure is ignoring engine semantics. PostgreSQL READ COMMITTED, PostgreSQL SERIALIZABLE, MySQL InnoDB REPEATABLE READ, Oracle SERIALIZABLE, and SQLite transaction modes are not interchangeable. The SQL names are a starting point. The real contract is the engine's implementation under your schema, indexes, and transaction statements.`
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Keep transactions short and explicit. Open the transaction, read the data needed for the invariant, perform the writes, commit, and then run external side effects. Long transactions hold snapshots open, increase conflict windows, and delay version cleanup. Hidden transaction boundaries inside ORMs are a common source of surprises, so inspect what SQL actually runs.`,
        `For read-modify-write logic, prefer database-enforced invariants where possible. Unique constraints, foreign keys, exclusion constraints, check constraints, and atomic update conditions are easier to reason about than application-only checks. When the invariant spans several rows and cannot be expressed as a constraint, choose serializable isolation or deliberately lock a guard row that represents the shared resource.`,
        `Build retry as part of the transaction API. Retrying only the failed statement is often wrong because the decision was based on earlier reads. Retrying the whole transaction closure is safer. Log serialization failures separately from application errors so you can see whether contention is normal, a sign of a hot invariant, or a schema design problem.`
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Consider a ticketing table with one row per purchase and a venue capacity of 100. At READ COMMITTED, two transactions can both run SELECT count(*) WHERE event_id = 9, each see 99, and each insert a new ticket. If neither transaction locks a shared capacity row or runs under a level that protects the predicate, the final count can be 101.`,
        `A robust design has several options. One option is a single event row with remaining_capacity and an atomic update such as decrement only where remaining_capacity > 0. Another is SERIALIZABLE isolation around the count and insert, with a retry loop for serialization failures. Another is a reservation service that serializes all writes for an event. The right answer depends on throughput, latency, operational complexity, and how expensive overselling is.`,
        `The lesson is that isolation is not chosen by memorizing the anomaly table. It is chosen by finding the shared fact the transaction relies on and making that fact protected by the database, the schema, or an intentionally serialized workflow.`
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study MVCC Internals and VACUUM next to see how snapshots are represented physically and why long transactions create bloat. PostgreSQL Lock Manager and Deadlock Detector explains the locks that remain even in MVCC systems. PostgreSQL Advisory Lock Keyspace shows how applications sometimes create their own lock domains when row locks are not the right shape.`,
        `Then connect isolation to durability and distribution. Write-Ahead Logging explains why commit and rollback survive crashes. Two-Phase Commit shows what happens when one transaction boundary crosses resource managers. Saga Pattern shows a deliberately weaker alternative built from local commits and compensating actions. CAP Theorem broadens the same tradeoff: stronger consistency is useful only when you know which availability, latency, or concurrency cost you are choosing to pay.`
      ],
    },
  ],
};
