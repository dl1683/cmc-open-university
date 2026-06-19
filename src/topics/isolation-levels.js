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
      ['', 'BEGIN', 'balance = $100', 'UPDATE balance = $50 (uncommitted)', 'reads balance â†’ sees $50 âš ', 'ROLLBACK — never happened', 'approves a loan using $50…'],
    ),
    highlight: { removed: ['t3:b', 't5:b'], compare: ['t4:a'] },
    explanation: 'Isolation exists because concurrent transactions are allowed to overlap, but the application still wants facts it can trust. The first timeline shows the weakest promise. A writes balance = $50 but has not committed; B reads that uncommitted value and acts on it; then A rolls back. The $50 was never durable truth. Dirty reads are dangerous because they let one transaction base a decision on data that may be erased before anyone else can observe it.',
    invariant: 'A dirty read sees data that can still be rolled back — a fact that may retroactively never have been true.',
  };

  yield {
    state: timeline(
      'Anomaly 2 — NON-REPEATABLE READ: the same question, two answers',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — generating a report', 'balance = $100', 'page 1: reads balance â†’ $100', 'UPDATE to $50; COMMIT', 'balance = $50', 'page 2: re-reads balance â†’ $50 âš ', 'report disagrees with itself'],
    ),
    highlight: { compare: ['t2:a', 't4:a'], active: ['t3:b'] },
    explanation: 'This one needs no rollback. A starts a report and reads $100. B commits a perfectly valid update to $50. A reads again inside the same transaction and gets a different answer. The write was real, but A needed a stable view while it was working. Non-repeatable reads are why reports, audits, and multi-step decisions often need more than "only committed data"; they need the same committed world for the whole transaction.',
  };

  yield {
    state: timeline(
      'Anomaly 3 — PHANTOM READ: new rows haunt a repeated query',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — audit large payments', 'payments > $100: 2 rows', 'COUNT(payments > $100) â†’ 2', 'INSERT payment $150; COMMIT', 'payments > $100: 3 rows', 'repeat COUNT â†’ 3 âš ', 'a row APPEARED mid-audit'],
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
      format: (v) => ['blocked âœ“', 'POSSIBLE', 'depends*'][v],
    }),
    highlight: { removed: ['ru:dirty', 'rc:nonrep'], found: ['ser:dirty', 'ser:nonrep', 'ser:phantom'] },
    explanation: 'Read the ladder as a set of promises, not a vocabulary quiz. READ COMMITTED stops dirty reads but lets each statement see a newer committed snapshot. REPEATABLE READ gives the transaction a stable snapshot, and some engines also block phantoms there. SERIALIZABLE is the strong claim: the result must match some one-at-a-time ordering. Higher rungs buy simpler reasoning, but the engine pays with locks, conflict checks, old versions, and sometimes aborts.',
  };

  yield {
    state: timeline(
      'The anomaly the ladder almost misses — WRITE SKEW',
      [[1, 4, 2], [3, 6, 2], [5, 7, 2], [0, 0, 8]],
      ['', 'on-call check: count â‰¥ 2? yes (sees 2)', 'hospital rule: â‰¥1 doctor on call', 'I\'ll sign off â†’ on_call = false', 'on-call check: count â‰¥ 2? yes (sees 2)', 'COMMIT', 'I\'ll sign off too â†’ on_call = false', 'COMMIT', 'on-call doctors: ZERO âš âš '],
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows two transactions running concurrently against the same database. Each row is a moment in time. The three columns show what Transaction A does, what Transaction B does, and what the committed truth in the database actually is.',
        'Warning markers flag the dangerous moment: a transaction acting on data it should not trust. Compare markers highlight the two reads or checks that disagree. The gap between what a transaction sees and what is actually committed is the anomaly.',
        'Switch between "the classic anomalies" view (dirty read, non-repeatable read, phantom read) and "the isolation ladder & MVCC" view (the four SQL levels, write skew, version mechanics, and engine defaults). Each frame is one clock tick in a concurrent schedule.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Jim Gray formalized the transaction concept at IBM in the 1970s and received the 1998 Turing Award for it. The problem he solved: multiple users changing the same database at the same time need guarantees that their work will not corrupt each other. A bank cannot let two ATM withdrawals overdraw an account because they both checked the balance before either deducted. A hospital cannot let two doctors sign off shift because both saw two people on call.',
        'The solution is ACID: Atomicity (a transaction either fully commits or fully rolls back), Consistency (committed data satisfies all declared constraints), Isolation (concurrent transactions behave as if they ran alone), and Durability (committed data survives crashes). Isolation is the hardest property because it directly trades correctness for throughput. The other three are binary promises; isolation is a spectrum.',
        'Isolation levels name points on that spectrum. Each level blocks certain anomalies and permits others. Choosing a level means deciding which kinds of concurrent interference the application can tolerate and which would break a business rule.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Run every transaction one at a time. Transaction A finishes completely before Transaction B begins. No overlap, no interference, no anomalies. This is serialized execution, and it is perfectly correct.',
        'Most databases could implement this with a single global lock: acquire the lock at BEGIN, release it at COMMIT. Every transaction sees a consistent, complete view. Every schedule is trivially serializable because it is literally serial.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Serialized execution kills throughput. If Transaction A holds the global lock for 50 ms while it reads ten rows, computes, and writes three rows, every other transaction on the system waits. A web application serving 1,000 requests per second cannot serialize them through a single lock. Disk I/O, network round trips, and application logic all happen inside the lock window, and none of them need exclusivity for unrelated data.',
        'The database needs concurrency. But concurrency means two transactions can interleave their reads and writes, and interleaving is where anomalies appear. The entire field of transaction isolation exists to answer one question: how much interleaving can the engine permit before the application observes a state that could not have arisen from any serial ordering?',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ACID properties divide the problem. Atomicity uses a write-ahead log (WAL): every change is written to a durable log before modifying data pages, so a crash can replay committed changes or discard uncommitted ones. Consistency is enforced by constraints (PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK) evaluated at commit time. Durability uses the same WAL plus fsync: the log record hits stable storage before the transaction reports success. Isolation is the complex one and uses concurrency control.',
        'The SQL standard defines four isolation levels by the anomalies they permit. READ UNCOMMITTED allows dirty reads: a transaction can see another transaction\'s uncommitted writes, which may be rolled back. READ COMMITTED blocks dirty reads but allows non-repeatable reads: the same row queried twice in one transaction can return different committed values. REPEATABLE READ blocks non-repeatable reads but may allow phantom reads: a range query can return new rows inserted by a concurrent committed transaction. SERIALIZABLE blocks all three anomalies and adds protection against write skew.',
        'Two major implementation strategies exist. Two-Phase Locking (2PL) acquires locks as it accesses data and releases them only after commit. Strict 2PL holds write locks until commit, preventing dirty reads. Predicate locks or gap locks (as in MySQL InnoDB) protect against phantoms by locking index ranges, not just existing rows. The cost is blocking: readers wait for writers and writers wait for each other.',
        'Multi-Version Concurrency Control (MVCC) takes a different approach. Each update creates a new version of the row. Readers see a snapshot defined by their transaction\'s start time and ignore newer versions. Writers still conflict with each other on the same row, but readers never block writers and writers never block readers. PostgreSQL, Oracle, MySQL InnoDB, and CockroachDB all use MVCC. The cost is version storage and cleanup: old versions linger until no active snapshot can see them (PostgreSQL VACUUM, InnoDB purge thread).',
        'Serializable Snapshot Isolation (SSI), introduced by Cahill, Roeth, and Fekete in 2008 and implemented in PostgreSQL 9.1, extends MVCC to detect serialization anomalies. SSI tracks read and write dependencies between concurrent transactions and aborts any transaction that would create a dangerous cycle (two consecutive rw-antidependency edges). It provides true serializability without the blocking of 2PL, at the cost of occasional aborts that the application must retry.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The serializability guarantee is the theoretical anchor. A concurrent execution is correct if and only if its committed results are equivalent to some serial ordering of the same transactions. The database does not need to actually run transactions serially; it only needs to ensure that no observable outcome could distinguish the concurrent execution from some serial one.',
        'This works as a correctness criterion because serial execution is trivially safe: each transaction sees the complete, committed results of all transactions that finished before it and none of the changes from transactions that have not committed. Any property that holds under serial execution (account balances never negative, seat counts never exceed capacity, at least one doctor on call) also holds under serializable concurrent execution.',
        'Weaker isolation levels relax this by permitting specific deviations from serial equivalence. READ COMMITTED allows each statement to see a different committed snapshot, which is equivalent to reordering the serial schedule between statements. REPEATABLE READ fixes the snapshot for the whole transaction but may not detect conflicts involving rows that did not exist when the snapshot was taken. Each relaxation is a controlled sacrifice of reasoning simplicity for throughput.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Stricter isolation costs more. READ COMMITTED needs only short-duration row locks for writes; each statement can release read context immediately. REPEATABLE READ via MVCC holds a snapshot for the transaction lifetime, keeping old row versions alive and increasing VACUUM or purge pressure. SERIALIZABLE via 2PL adds predicate locks that can block concurrent inserts into index ranges. SERIALIZABLE via SSI adds dependency tracking and raises abort rates under contention.',
        'The practical numbers: PostgreSQL under SSI typically sees 5-20% throughput reduction compared to READ COMMITTED for read-heavy OLTP workloads, with higher abort rates when transactions frequently read and write overlapping data. MySQL InnoDB REPEATABLE READ with gap locks can cause lock-wait timeouts when concurrent transactions scan and insert into adjacent index ranges. The overhead is workload-dependent: if transactions touch disjoint data, serializable costs almost nothing; if they contend on the same rows or ranges, blocking and aborts dominate.',
        'MVCC trades lock contention for storage overhead. Every update creates a new row version. PostgreSQL stores old versions in the main table (heap) and relies on autovacuum to reclaim them. A long-running transaction at REPEATABLE READ or SERIALIZABLE prevents cleanup of any version it might see, which can cause table bloat. InnoDB stores old versions in a separate undo log, which has its own size pressure. Neither approach is free; both shift the cost from blocking to storage management.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'PostgreSQL defaults to READ COMMITTED and offers true SERIALIZABLE via SSI. This makes PostgreSQL the strongest off-the-shelf choice for applications that need serializability without manual locking. The retry cost is the only tax: wrap the transaction in a loop that catches serialization_failure (SQLSTATE 40001) and retries.',
        'MySQL InnoDB defaults to REPEATABLE READ and implements it with MVCC plus next-key locks (gap locks on index ranges). This blocks phantoms in most practical cases, making InnoDB\'s REPEATABLE READ stronger than the SQL standard requires. InnoDB SERIALIZABLE adds shared locks on all reads, which increases blocking but catches more anomalies.',
        'CockroachDB defaults to SERIALIZABLE for all transactions, using a timestamp-ordering protocol across distributed nodes. This simplifies application reasoning at the cost of higher abort rates and cross-node coordination latency. For distributed systems that need strong consistency, paying the serializable cost everywhere avoids the complexity of per-transaction isolation tuning.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Distributed transactions across multiple databases or services require Two-Phase Commit (2PC), which adds a coordinator, a prepare phase, and blocking if the coordinator crashes between prepare and commit. The latency and availability cost of 2PC often pushes systems toward eventual consistency, sagas, or single-database designs that avoid the problem entirely.',
        'SERIALIZABLE isolation at high contention creates a tension between correctness and availability. If many transactions read and write overlapping data, abort rates climb, retry storms amplify load, and throughput collapses. The fix is usually schema redesign: partition the hot resource, replace a read-check-write pattern with an atomic UPDATE ... WHERE condition, or introduce a single-writer queue for the contended invariant.',
        'Application-level invariants that span data outside the database (an email was sent, a payment was charged, an API was called) cannot be protected by database isolation alone. If a SERIALIZABLE transaction sends a side effect before commit and then aborts, the side effect is not rolled back. The standard mitigation is the transactional outbox pattern: write side-effect intents to a database table inside the transaction, and process them after commit.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Two transactions run concurrently. T1 transfers $100 from account A (balance $500) to account B. T2 reads the balance of account A to display on a dashboard.',
        'At READ UNCOMMITTED: T1 writes A = $400 but has not committed. T2 reads A and sees $400. T1 aborts. T2 displayed a balance that never existed. The dirty read caused a false report.',
        'At READ COMMITTED: T2 cannot see T1\'s uncommitted write; it reads A = $500. T1 commits, setting A = $400. If T2 reads again in the same transaction, it now sees $400. The two reads of the same row returned different values within one transaction. For a simple dashboard display this is fine. For a report that computes totals across multiple reads, the shifting snapshot can produce an internally inconsistent result.',
        'At REPEATABLE READ: T2 gets a snapshot at transaction start showing A = $500. Even after T1 commits A = $400, T2 still sees A = $500 for the rest of its transaction. The view is stable. But if T2 also checks a range query (all accounts with balance > $300), a concurrent insert of a new qualifying account could appear as a phantom, depending on the engine.',
        'At SERIALIZABLE: T2\'s snapshot is stable and the engine also tracks dependencies. If T2 reads data that T1 writes, and T1 reads data that another transaction writes, the engine checks for cycles in the dependency graph. Any cycle means the schedule is not equivalent to a serial ordering, and one transaction is aborted. The application catches the serialization failure and retries. The committed result is always equivalent to running the transactions one at a time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Jim Gray and Andreas Reuter, "Transaction Processing: Concepts and Techniques" (1993) for the ACID formalization. Hal Berenson et al., "A Critique of ANSI SQL Isolation Levels" (SIGMOD 1995) for the anomaly taxonomy including snapshot isolation and write skew. Michael Cahill, Uwe Roeth, and Alan Fekete, "Serializable Isolation for Snapshot Databases" (SIGMOD 2008) for SSI. The PostgreSQL documentation on Transaction Isolation is the best freely available engine-specific reference.',
        'Study Write-Ahead Logging next to understand how atomicity and durability are implemented physically. Study MVCC Internals to see how snapshots are constructed from version chains and transaction visibility maps. Study Two-Phase Commit for distributed atomicity across databases. Study the Saga Pattern for an alternative that replaces distributed isolation with compensating actions. Study Raft or Paxos to see how CockroachDB and Spanner maintain serializable isolation across distributed nodes.',
      ],
    },
  ],
};

