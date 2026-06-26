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
        'Read the log as the durable timeline. Active highlights show log records being appended, found highlights show state that recovery can reconstruct, and removed highlights show uncommitted work that recovery discards.',
        {type: "callout", text: "WAL makes the log the durable timeline, so recovery can reconstruct committed state even when data pages are stale or half-applied."},
        {type: 'image', src: './assets/gifs/write-ahead-log.gif', alt: 'Animated walkthrough of the write ahead log visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is log-before-data. If the log record and commit record reached stable storage before the data page changed, recovery can redo the change. If the commit record is missing, recovery must treat the transaction as unfinished.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Useful updates often require multiple physical writes. A bank transfer subtracts from one account and adds to another. A crash between those writes can leave money missing or duplicated unless the system has a recovery record.',
        {type: "image", src: "https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg", alt: "Rows of server racks in a datacenter", caption: "Durability is a physical promise made on real storage systems, not an abstract database slogan. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Wikimedia_Foundation_Servers-8055_35.jpg."},
        'A write-ahead log, or WAL, exists so the system can recover committed transactions and erase incomplete ones. It records intent in an append-only file before applying changes to the main data pages.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write the data pages directly. For a transfer, update account A, then update account B, then return success. This is simple and seems efficient because it avoids extra log writes.',
        'Another obvious approach is to copy the whole database or whole page before every change. That can recover state, but it writes too much data for small transactions.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Direct page writes fail because storage can crash after any write, and pages can be torn or stale. The system may know that account A changed but not whether account B changed. The transaction boundary is not visible in the data pages alone.',
        'Full copying fails because it makes small logical updates pay large physical costs. A transaction that changes 200 bytes should not require copying gigabytes or even full files just to be recoverable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the sequential log authoritative for recovery. Before dirty data pages reach the main structure, append enough log records to redo or undo the transaction. A commit record becomes the durable boundary between real work and discarded work.',
        'The log changes the hard problem from random in-place repair to sequential replay. Storage is much better at appending than at forcing many scattered pages in exact transaction order.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On update, the database appends a log record describing the change and its transaction. On commit, it flushes the commit record to stable storage before acknowledging success. Dirty data pages may flush later in any convenient order.',
        'After a crash, recovery scans the log. It redoes committed changes that may not have reached data pages and undoes or ignores changes from transactions without commit records. Checkpoints shorten the scan by recording a known recovery starting point.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on the write-ahead invariant: no data page may be considered durable for a change unless the log record for that change is durable first. Therefore recovery never sees an unexplained page change that it cannot reason about from the log.',
        'The commit record defines atomicity. If it is durable, every logged change in that transaction must appear after recovery. If it is absent, the transaction did not commit, so recovery can remove its partial effects.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Appending a log record is O(1) per record and sequential, which is cheaper than forcing many random data pages. Recovery is O(size of log since checkpoint), so checkpoint frequency controls crash-restart time.',
        'The cost is write amplification and operational complexity. Every logical update writes log bytes, later writes data pages, and may force fsync or equivalent durability calls. Doubling transaction volume roughly doubles log bandwidth and replay work.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'WAL is used by PostgreSQL, InnoDB, SQLite journaling variants, filesystems, queues, and LSM-tree memtable designs. It fits systems that need fast acknowledgements plus crash recovery.',
        'The access pattern is many small updates to larger persistent structures. The log absorbs random change as sequential intent, while background flushing, checkpointing, and compaction optimize the main structure later.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'WAL fails if the durability boundary lies. If the system acknowledges commit before the log is actually stable, a power loss can erase a promised transaction. Disk caches, controller caches, and missing fsync calls can create that gap.',
        'It also fails operationally when logs grow without checkpoints or backups. Recovery time can become too long, storage can fill, and replication lag can increase because every follower must consume the same durable history.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with balances A=100 and B=50. Transfer 30 from A to B. The log receives subtract(A,30), add(B,30), and commit(T1), then the database acknowledges the transaction.',
        'If the crash happens after A was written as 70 but before B was written as 80, recovery reads commit(T1) and redoes both records. If the crash happens before commit(T1), recovery discards the partial subtract and restores the pre-transaction state.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL WAL documentation at https://www.postgresql.org/docs/current/wal-intro.html and ARIES by Mohan et al., at https://cs.stanford.edu/people/chrismre/cs345/rl/aries.pdf. For storage behavior, read Operating Systems: Three Easy Pieces chapters on crash consistency.',
        'Study Transactions, fsync, Buffer Pool, Checkpointing, ARIES Recovery, LSM Trees, and Replication Logs next. The central question is always what the system is allowed to promise before a crash.',
      ],
    },
  ],
};
