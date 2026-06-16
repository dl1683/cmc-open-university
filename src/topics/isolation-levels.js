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
    explanation: 'Two transactions share a database; the question of ISOLATION is what each may see of the other\'s half-finished work. Watch the worst case. Transaction A starts moving money: it writes balance = $50 but has NOT committed — it might still abort. Transaction B peeks at that uncommitted value, sees $50, and makes a decision. Then A rolls back: the $50 retroactively NEVER EXISTED — yet B already acted on it. That is a DIRTY READ: reading another transaction\'s uncommitted writes. Decisions built on data that can be un-written are decisions built on sand, which is why essentially every real database forbids this by default.',
    invariant: 'A dirty read sees data that can still be rolled back — a fact that may retroactively never have been true.',
  };

  yield {
    state: timeline(
      'Anomaly 2 — NON-REPEATABLE READ: the same question, two answers',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — generating a report', 'balance = $100', 'page 1: reads balance → $100', 'UPDATE to $50; COMMIT', 'balance = $50', 'page 2: re-reads balance → $50 ⚠', 'report disagrees with itself'],
    ),
    highlight: { compare: ['t2:a', 't4:a'], active: ['t3:b'] },
    explanation: 'Anomaly two is subtler — no rollbacks, everyone honest, still chaos. Transaction A is building a financial report: page 1 reads the balance, $100. Mid-report, B updates the balance to $50 and properly COMMITS — perfectly legal. A then re-reads for page 2: $50. Same transaction, same query, two different answers — a NON-REPEATABLE READ. The report now contradicts itself across pages. The fix requires the database to promise A a frozen view of the world for its whole lifetime — and notice that B did nothing wrong; the anomaly lives entirely in what A was ALLOWED to observe.',
  };

  yield {
    state: timeline(
      'Anomaly 3 — PHANTOM READ: new rows haunt a repeated query',
      [[1, 0, 2], [3, 0, 2], [0, 4, 5], [6, 0, 5], [7, 0, 5]],
      ['', 'BEGIN — audit large payments', 'payments > $100: 2 rows', 'COUNT(payments > $100) → 2', 'INSERT payment $150; COMMIT', 'payments > $100: 3 rows', 'repeat COUNT → 3 ⚠', 'a row APPEARED mid-audit'],
    ),
    highlight: { compare: ['t2:a', 't4:a'], removed: ['t3:b'] },
    explanation: 'Anomaly three is the non-repeatable read\'s spookier sibling. A audits payments over $100: the count says 2. B INSERTS a brand-new $150 payment and commits. A repeats the identical query: 3. No existing row changed — a NEW row materialized inside A\'s range: a PHANTOM. The distinction matters mechanically: protecting an existing row needs a lock on that row, but protecting a QUERY needs a lock on rows that do not exist yet — a range (predicate) lock on "payments > $100". That is a different and far more expensive kind of promise, which is why phantoms survive at isolation levels that already stopped anomalies one and two.',
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
    explanation: 'The SQL standard\'s ladder, one anomaly retired per rung. READ UNCOMMITTED permits everything (almost nobody uses it). READ COMMITTED — the default in PostgreSQL and Oracle — only ever shows committed data, killing dirty reads, but each statement sees a fresh snapshot, so repeated reads can disagree. REPEATABLE READ freezes your view of existing rows (*and in PostgreSQL\'s implementation, blocks phantoms too — implementations routinely exceed the standard). SERIALIZABLE makes the full promise: the outcome equals SOME serial one-at-a-time ordering of the transactions. Climb the ladder and anomalies die; so does concurrency — each rung historically meant more locks held longer.',
  };

  yield {
    state: timeline(
      'The anomaly the ladder almost misses — WRITE SKEW',
      [[1, 4, 2], [3, 6, 2], [5, 7, 2], [0, 0, 8]],
      ['', 'on-call check: count ≥ 2? yes (sees 2)', 'hospital rule: ≥1 doctor on call', 'I\'ll sign off → on_call = false', 'on-call check: count ≥ 2? yes (sees 2)', 'COMMIT', 'I\'ll sign off too → on_call = false', 'COMMIT', 'on-call doctors: ZERO ⚠⚠'],
    ),
    highlight: { compare: ['t1:a', 't1:b'], removed: ['t4:db'] },
    explanation: 'The famous near-miss (Kleppmann\'s on-call doctors): two doctors, a rule that at least one must stay on call. Both transactions CHECK the rule against the same snapshot — two on call, safe — and each removes only ITSELF. Neither touched the row the other read; no dirty read, no non-repeatable read, no phantom. Both commit. On-call count: zero. This is WRITE SKEW: two reads of a shared invariant, two disjoint writes that jointly break it. Snapshot-based REPEATABLE READ waves it through; only true SERIALIZABLE — which checks whether the interleaving could have happened serially (one check would have seen the other\'s signoff) — catches it. If your constraint spans multiple rows, the comfortable middle rungs are not enough.',
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
    explanation: 'How the ladder got cheap: MVCC — Multi-Version Concurrency Control. Instead of overwriting, every UPDATE creates a NEW VERSION stamped with its transaction\'s time; old versions linger. A reader simply ignores versions newer than its own start time — it reads a consistent snapshot of history while writers race ahead, NEITHER BLOCKING THE OTHER. PostgreSQL, MySQL/InnoDB, Oracle: all MVCC at the core (this is what VACUUM cleans up — expired versions). Notice the family resemblance: keep immutable versions, never mutate in place — Git Internals\' commits and Cache Invalidation\'s versioned filenames, here applied per-row, per-transaction.',
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
    explanation: 'The field guide. Defaults differ (PostgreSQL ships READ COMMITTED, MySQL ships REPEATABLE READ) and even the words lie: Oracle\'s "SERIALIZABLE" is actually snapshot isolation — write skew included. The working engineer\'s protocol: know your engine\'s default; let it handle the easy 95% of traffic; and for any transaction that checks a multi-row invariant before writing (the doctors, account balances that must not co-overdraft, seat inventory), explicitly request SERIALIZABLE and write a retry loop — serializable engines ABORT conflicting transactions rather than block them, and the retry is the price of the guarantee. The same theme that runs through Write-Through vs Write-Back and the CAP Theorem closes here: every consistency guarantee is bought with concurrency — choose per transaction, not per religion.',
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
        `Transaction isolation is the database's promise about what each transaction may see of the others' half-finished work. When you run two transactions at the same time, the question of isolation is: how blind is each transaction to the other's uncommitted changes? Every database ships with isolation levels — SQL names them READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, and SERIALIZABLE — each a rung on a ladder of blindness. Climb the ladder and anomalies die, one per step. The price: concurrency fades. The art is choosing the rung that kills your problems without killing your throughput.`,
        `The cost of the highest rung — SERIALIZABLE — is that transactions must abort and retry if they conflict. Many modern applications accept this price by writing retry loops; others pick a lower rung and live with write skew, the anomaly the ladder almost misses. The choice is per-transaction, not per religion: an audit needs SERIALIZABLE; a page view needs only READ COMMITTED. Real databases implement isolation via row locks, range locks (for phantoms), and MVCC — Multi-Version Concurrency Control — which lets readers see the past while writers race ahead.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with the three classic anomalies. DIRTY READ: Transaction A updates balance to $50 but does not commit yet (it might still ROLLBACK). Transaction B peeks and sees $50. A then aborts; the $50 retroactively never existed. B acted on data that can be un-written — a phantom fact. READ UNCOMMITTED permits this nightmare; everyone else forbids it. NON-REPEATABLE READ: A is building a report, page 1 reads balance = $100. B commits an update to balance = $50. A reads for page 2: now $50. Same query, two answers, one report contradicting itself. REPEATABLE READ freezes A's view of the database at A's start time, so page 1 and page 2 see the same version. PHANTOM READ: A audits large payments (over $100), finds 2 rows. B inserts a $150 payment. A repeats the same query: 3 rows. A new row materialized mid-query. Protecting phantoms requires locking rows that do not exist yet — a predicate lock on the range "payments > $100" — far costlier than locking single rows.`,
        `The ladder works like this: READ UNCOMMITTED permits all three. READ COMMITTED (PostgreSQL's default, and Oracle's) blocks dirty reads only; each statement gets a fresh snapshot, so repeated reads can disagree. REPEATABLE READ freezes your snapshot for the whole transaction, blocking non-repeatable reads and (in PostgreSQL's implementation) phantoms too — implementations routinely exceed the SQL standard. SERIALIZABLE promises the outcome equals *some* serial one-at-a-time order of the transactions. But the ladder almost misses WRITE SKEW: two transactions each read a shared invariant (on-call doctors: count ≥ 2? yes, sees 2), then each writes a disjoint row (one removes itself, the other removes itself), neither touching what the other read. No dirty read, no non-repeatable read, no phantom. Both commit. On-call count: zero. Snapshot isolation (REPEATABLE READ) waves this through; only true SERIALIZABLE catches it by checking whether the interleaving could have happened serially.`,
        `Modern databases use MVCC to buy concurrency: instead of overwriting data, every UPDATE creates a new version stamped with its transaction time. Readers simply ignore versions newer than their own start time, reading a consistent snapshot of history while writers race ahead without blocking anyone. PostgreSQL, MySQL/InnoDB, and Oracle all use MVCC. The family resemblance is striking: Git commits are immutable versions; cache names are versioned; here, every row keeps multiple versions, and VACUUM deletes expired ones — the same principle as garbage collection.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `READ COMMITTED is cheap: each statement sees a fresh snapshot; locking is brief. READ UNCOMMITTED is cheaper but almost never used outside textbooks. REPEATABLE READ costs more: you hold your snapshot longer, so more old versions linger. SERIALIZABLE costs the most: the database must detect conflicts (has another transaction read or written overlapping data?) and abort one of you if so. The price is a retry loop in your application code — the price of the guarantee. MVCC itself is neither cheap nor expensive; it is the mechanism. Versioning adds storage (old versions linger until VACUUM) and CPU (scanning versions for visibility). But the payoff is huge: readers and writers do not block each other. A writer just creates a new version; a reader sees the past. On a busy system, this is the only way to get good throughput.`,
        `Predicate locks for phantoms are expensive: they require the database to understand your query's range (payments > $100) and lock not just existing rows but any rows that could satisfy that range. Some databases use gap locks (MySQL/InnoDB) to approximate this; others use true predicate locks (PostgreSQL's SERIALIZABLE). The cost grows with the breadth of your predicate: "all rows" is the worst case. This is why many applications with multi-row constraints run at REPEATABLE READ, write a retry loop for the hard cases, and avoid the cost of true SERIALIZABLE for every transaction.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Financial transactions (wire transfers, loan approvals) demand high isolation because errors are expensive and regulatory. Banks run near-SERIALIZABLE, accepting retry loops. E-commerce uses a mix: inventory updates use REPEATABLE READ with explicit row locks ("SELECT FOR UPDATE") to block overselling; payment processing uses SERIALIZABLE with retries. Medical records often demand SERIALIZABLE to ensure no two admissions double-book a bed. Audit logs must be SERIALIZABLE to ensure no audit entry is lost; the phantom check is critical. Social media — likes, shares, comments — can tolerate READ COMMITTED; eventual consistency is fine and throughput is king.`,
        `The working protocol: know your database's default (PostgreSQL: READ COMMITTED, MySQL: REPEATABLE READ), let it handle the easy 95% of traffic at that level, and for any transaction that checks a multi-row invariant before writing (doctors who must stay on call, accounts that must not co-overdraft, seats that must not oversell), explicitly upgrade to SERIALIZABLE and write a retry loop. If your constraint spans a range (payments > threshold), use predicate locks (PostgreSQL SERIALIZABLE) or gap locks (MySQL InnoDB) to avoid write skew.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is assuming your database's default level is enough. MySQL ships REPEATABLE READ; PostgreSQL ships READ COMMITTED. If you port from one to the other, your isolation assumptions change. The second trap is confusing REPEATABLE READ with SERIALIZABLE: REPEATABLE READ freezes your snapshot of existing rows but permits write skew because it does not check if the interleaving was actually serial. Kleppmann's on-call doctors (both check ≥2, both sign off, zero on call) break REPEATABLE READ but not SERIALIZABLE. The third trap is ignoring the cost of retries: SERIALIZABLE transactions must abort and retry on conflict. If two transactions collide, one loses — the retry loop is not optional. Code it or live with data corruption.`,
        `A subtle misconception: Oracle's "SERIALIZABLE" is actually snapshot isolation (the academic name for REPEATABLE READ). Write skew is not caught. The field guide: check your engine's actual default and what its "SERIALIZABLE" actually does. PostgreSQL's true SERIALIZABLE uses SSI (Serializable Snapshot Isolation) and aborts conflicting transactions — the standard textbook behavior. MySQL's REPEATABLE READ uses gap locks to prevent some phantoms but not all write skew. Never assume the SQL standard name means the standard implementation; read the manual.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `For PostgreSQL-specific concurrency internals, study PostgreSQL Lock Manager & Deadlock Detector for lock tags, wait queues, pg_locks, and wait-for graph cycles. Then study PostgreSQL Advisory Lock Keyspace for application-defined lock keys, and Transaction Savepoint Stack for partial rollback inside one outer transaction.`,
        `Isolation levels live inside transactions, which are guaranteed by Write-Ahead Logging: the database writes changes to a log before applying them to the main data, so if the power dies mid-update, the log can reconstruct the truth. Learn WAL to understand why SERIALIZABLE retries are safe and why ROLLBACK is always possible. Two-Phase Commit extends isolation to *multiple* databases at once: two banks need to agree on a fund transfer before either commits, or both abort. The isolation level you choose here is called a consistency model; the CAP Theorem explains the tradeoff between Consistency, Availability, and Partition tolerance — you pick two, and the choice shapes your isolation strategy. Write-Through vs Write-Back sits at a similar decision point: do you wait for the database to confirm the write (write-through, safer, slower) or fire-and-forget (write-back, faster, riskier)? Finally, if you want to understand how MVCC avoids blocking, study Git Internals to see how git never overwrites a commit — every change is a new object — and compare that mental model to how PostgreSQL keeps old row versions alive.`,
      ],
    },
  ],
};
