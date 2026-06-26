// PostgreSQL WAL checkpoint and crash recovery: checkpoints bound replay,
// page LSNs avoid duplicate redo, and dirty buffers determine recovery work.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-wal-checkpoint-recovery-case-study',
  title: 'PostgreSQL WAL Checkpoint & Recovery',
  category: 'Systems',
  summary: 'How PostgreSQL checkpoints bound WAL replay with redo pointers, dirty pages, page LSNs, checkpointer writes, crash restart, and recovery decisions.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['checkpoint cycle', 'crash replay'], defaultValue: 'checkpoint cycle' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function walGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'txn', label: 'txn', x: 0.5, y: 4.2, note: notes.txn ?? 'commit' },
      { id: 'wal', label: 'WAL', x: 2.1, y: 4.2, note: notes.wal ?? 'records' },
      { id: 'flush', label: 'flush', x: 3.7, y: 5.4, note: notes.flush ?? 'durable' },
      { id: 'buffer', label: 'buffer', x: 3.7, y: 3.0, note: notes.buffer ?? 'dirty page' },
      { id: 'ckpt', label: 'ckpt', x: 5.5, y: 4.2, note: notes.ckpt ?? 'redo ptr' },
      { id: 'disk', label: 'disk', x: 7.1, y: 3.0, note: notes.disk ?? 'page files' },
      { id: 'control', label: 'control', x: 7.1, y: 5.4, note: notes.control ?? 'state' },
      { id: 'redo', label: 'redo', x: 8.7, y: 4.2, note: notes.redo ?? 'restart' },
      { id: 'safe', label: 'ok', x: 9.7, y: 4.2, note: notes.safe ?? 'done' },
    ],
    edges: [
      { id: 'e-txn-wal', from: 'txn', to: 'wal', weight: '' },
      { id: 'e-wal-flush', from: 'wal', to: 'flush', weight: '' },
      { id: 'e-wal-buffer', from: 'wal', to: 'buffer', weight: '' },
      { id: 'e-flush-ckpt', from: 'flush', to: 'ckpt', weight: '' },
      { id: 'e-buffer-ckpt', from: 'buffer', to: 'ckpt', weight: '' },
      { id: 'e-ckpt-disk', from: 'ckpt', to: 'disk', weight: '' },
      { id: 'e-ckpt-control', from: 'ckpt', to: 'control', weight: '' },
      { id: 'e-control-redo', from: 'control', to: 'redo', weight: '' },
      { id: 'e-redo-safe', from: 'redo', to: 'safe', weight: '' },
    ],
  }, { title });
}

function* checkpointCycle() {
  yield {
    state: walGraph('A commit reaches WAL before dirty data pages are trusted'),
    highlight: { active: ['txn', 'wal', 'flush', 'e-txn-wal', 'e-wal-flush'], compare: ['buffer'] },
    explanation: 'The write-ahead rule is the core invariant: the log record must become durable before the corresponding dirty page can be relied on after a crash.',
    invariant: 'WAL orders intent; checkpoints bound how much intent recovery must replay.',
  };

  yield {
    state: walGraph('Dirty buffers can be written later than commit', { buffer: 'dirty P42', disk: 'old P42' }),
    highlight: { active: ['wal', 'buffer', 'e-wal-buffer'], compare: ['disk'] },
    explanation: 'A transaction can commit while the changed data page is still only in shared buffers. Readers see the buffer, not a magical read from WAL for every query.',
  };

  yield {
    state: walGraph('The checkpointer writes dirty pages and records a restart point', { ckpt: 'redo LSN', disk: 'flushed', control: 'checkpoint' }),
    highlight: { active: ['buffer', 'ckpt', 'disk', 'control', 'e-buffer-ckpt', 'e-ckpt-disk', 'e-ckpt-control'], found: ['flush'] },
    explanation: 'A checkpoint writes enough dirty buffers and durable metadata so crash recovery can start from a known redo location instead of replaying from the beginning of the log.',
  };

  yield {
    state: labelMatrix(
      'Checkpoint knobs',
      [
        { id: 'timeout', label: 'timeout' },
        { id: 'maxwal', label: 'max WAL' },
        { id: 'target', label: 'target' },
        { id: 'warning', label: 'warning' },
      ],
      [
        { id: 'effect' },
        { id: 'risk' },
      ],
      [
        ['time bound', 'too often'],
        ['space bound', 'bursts'],
        ['spread IO', 'lag'],
        ['alert', 'noise'],
      ],
    ),
    highlight: { active: ['timeout:effect', 'maxwal:effect', 'target:effect'], compare: ['maxwal:risk'] },
    explanation: 'Checkpoint tuning is a queueing problem. Too-frequent checkpoints increase write pressure. Too-infrequent checkpoints lengthen recovery and can grow WAL storage needs.',
  };

  yield {
    state: walGraph('The complete steady-state cycle batches commits and checkpoints', { txn: 'many txns', wal: 'segments', ckpt: 'periodic', safe: 'bounded' }),
    highlight: { active: ['txn', 'wal', 'flush', 'buffer', 'ckpt', 'disk', 'control'], found: ['safe'] },
    explanation: 'In steady state, commits append and flush WAL, dirty pages accumulate, the checkpointer spreads writes, and the redo pointer advances. The system trades write smoothing against recovery time.',
  };
}

function* crashReplay() {
  yield {
    state: walGraph('After a crash, disk pages may lag behind committed WAL', { txn: 'crashed', buffer: 'lost RAM', disk: 'stale', redo: 'needed' }),
    highlight: { active: ['wal', 'control', 'redo'], removed: ['buffer'], compare: ['disk'] },
    explanation: 'Shared buffers disappear on crash. Recovery trusts durable WAL and durable checkpoint metadata, then repairs data files by replaying records whose effects may not be present.',
    invariant: 'Recovery replays from the redo pointer, not from whatever dirty buffer happened to exist before crash.',
  };

  yield {
    state: walGraph('Page LSNs tell redo whether a page already includes a change', { disk: 'pageLSN', redo: 'compare' }),
    highlight: { active: ['disk', 'redo', 'e-control-redo'], compare: ['wal'] },
    explanation: 'A page LSN is a small ordering stamp inside the data page. If the page already has a sufficiently new LSN, redo can skip that record for that page.',
  };

  yield {
    state: labelMatrix(
      'Replay cases',
      [
        { id: 'committed', label: 'commit' },
        { id: 'pageold', label: 'old page' },
        { id: 'pagenew', label: 'new page' },
        { id: 'partial', label: 'partial' },
      ],
      [
        { id: 'action' },
        { id: 'why' },
      ],
      [
        ['redo', 'durable'],
        ['apply', 'LSN low'],
        ['skip', 'LSN high'],
        ['repair', 'torn?'],
      ],
    ),
    highlight: { active: ['committed:action', 'pageold:action', 'pagenew:action'], compare: ['partial:why'] },
    explanation: 'Crash recovery is not blind replay. It compares log order, commit state, and page state so it can redo safely without corrupting pages that already include a change.',
  };

  yield {
    state: walGraph('A checkpoint after recovery makes the repaired state ordinary again', { ckpt: 'restart', disk: 'cleaner', control: 'new redo', safe: 'open' }),
    highlight: { active: ['redo', 'disk', 'ckpt', 'control', 'safe', 'e-redo-safe'], found: ['wal'] },
    explanation: 'Once recovery reaches consistency, PostgreSQL can accept connections. A fresh checkpoint later shortens future recovery by advancing the restart point.',
  };

  yield {
    state: walGraph('The complete incident is a power loss during heavy writes', { txn: 'orders', wal: 'flushed', disk: 'mixed', redo: 'startup', safe: 'orders ok' }),
    highlight: { active: ['txn', 'wal', 'control', 'redo', 'disk', 'safe'], found: ['flush'] },
    explanation: 'An order service loses power after commit records reach WAL but before every heap and index page is flushed. On startup, PostgreSQL reads checkpoint state, replays WAL, skips pages with newer page LSNs, and returns committed orders.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'checkpoint cycle') yield* checkpointCycle();
  else if (view === 'crash replay') yield* crashReplay();
  else throw new InputError('Pick a PostgreSQL WAL recovery view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the checkpoint view as two clocks. The WAL clock advances when transactions create durable log records, and the data-file clock advances when dirty pages are written to relation files. Active nodes show the current write or recovery step, found nodes show durable state, compare nodes show a page or checkpoint whose freshness is being tested, and removed nodes show memory lost in the crash.',
        'The safe inference is the write-ahead rule. If a data page reaches disk with page LSN 500, WAL through 500 must already be durable. Recovery can then decide record by record whether the disk page is stale enough to need redo.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/PostgreSQL%27s_Internal_Architecture.svg',
          alt: 'PostgreSQL internal architecture showing processes, shared memory, and disk files',
          caption: 'PostgreSQL internal architecture: backend processes, shared buffers, WAL buffers, and on-disk storage. WAL sits between transaction intent and durable data files.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A database must make commit durable without forcing every changed heap and index page to disk before returning to the client. Shared buffers are memory and vanish on crash. Data files can be behind the last committed transaction by many seconds.',
        'WAL means write-ahead log: a sequential record of changes that reaches durable storage before the affected data page is trusted. Checkpoints bound recovery by recording a redo pointer, which is the WAL position where crash replay can safely begin.',
        {
          type: 'callout',
          text: 'ACID requires that a committed transaction survive a crash. Shared buffers vanish on restart. Data files on disk may be arbitrarily behind the last commit. The database needs a way to reconstruct consistent state before accepting connections.',
        },
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/4/42/PostgreSQL_processes_1.svg',
          alt: 'PostgreSQL processes, memory buffers, and disk access paths',
          caption: 'Processes, memory, and files in PostgreSQL. The WAL writer and checkpointer are background processes that bridge the gap between in-memory dirty pages and durable on-disk state.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious durable design is force-in-place commit. When a transaction changes four pages, write all four pages to their final files and fsync them before reporting commit. That makes recovery simple because the data files are current at each commit boundary.',
        'The opposite simple design is deferred writeback. Return commit after memory changes and let the operating system flush pages later. That is fast until a power loss turns acknowledged commits into missing or half-written data.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Disk-structure2.svg',
          alt: 'Hard disk structure showing tracks, sectors, and clusters',
          caption: 'Disk geometry: tracks (A), sectors (B, C), and clusters (D). Random I/O forces the disk head to seek between scattered sectors. Sequential WAL writes stay on contiguous sectors, avoiding seek latency entirely.',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Force-in-place couples commit latency to random I/O. A 100 byte row update can dirty a heap page and two index pages, so the client waits for several scattered writes instead of one sequential log flush. Under concurrency, the same hot page may be written repeatedly before its final state is stable.',
        'Deferred writeback has no recovery proof. After a crash, the server cannot tell which pages contain committed changes, which contain aborted changes, and which are half old. The system needs a durable intent record that can explain or rebuild every page.',
        {
          type: 'callout',
          text: 'The invariant that makes WAL work: no data page may reach disk unless every WAL record describing that page is already durable. This is the write-ahead rule. If a page is on disk, the log can explain it. If a page is not on disk, the log can rebuild it.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the record of what happened from the files that store the current page images. Commit only needs durable WAL through the commit record. Data pages can be written later as long as every page write obeys the write-ahead rule.',
        'Page LSNs make this separation checkable. Each page stores the LSN of the newest WAL record reflected on that page. During redo, PostgreSQL compares the page LSN with the WAL record LSN and applies the record only when the page is behind.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A transaction modifies buffers and emits WAL records. At commit, PostgreSQL flushes WAL through the commit record, often batching several commits into one fsync. Background writer and checkpointer processes later write dirty pages to data files after ensuring the page LSN is covered by flushed WAL.',
        'A checkpoint writes enough dirty pages and metadata to publish a new redo pointer. After a crash, recovery reads checkpoint state, starts at that redo pointer, and scans WAL forward. For each record, it reads the target page, checks the page LSN, applies redo if needed, and skips work already present.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/PostgreSQL_pageLayout.svg',
          alt: 'PostgreSQL data page layout showing header with page LSN, line pointers, and tuple data',
          caption: 'Physical layout of a PostgreSQL data page. The page header contains pd_lsn -- the Log Sequence Number of the last WAL record applied to this page. Recovery uses this stamp to decide whether a page needs redo.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two parts. First, the write-ahead rule guarantees that any data page found on disk is backed by durable WAL that can explain it. Second, page LSN comparison makes redo idempotent, so seeing the same WAL record again cannot apply the same change twice.',
        'The checkpoint does not prove that all later data pages are current. It proves recovery can start from a known earlier point and reach a consistent state by replaying the WAL suffix. Once replay reaches the end of durable WAL, committed physical changes have been restored and uncommitted versions remain invisible under MVCC rules.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/PostgreSQL_mvcc.svg',
          alt: 'PostgreSQL MVCC showing multiple tuple versions visible to different transactions',
          caption: 'PostgreSQL MVCC: multiple tuple versions coexist on the same page. WAL recovery restores page contents physically; MVCC visibility rules (clog/pg_xact) decide which versions are logically visible. Recovery does not need undo logging because uncommitted versions are simply invisible.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main steady-state cost is WAL flush latency and WAL volume. If a workload commits 10,000 transactions per second and group commit batches 25 transactions per fsync, storage must handle about 400 WAL fsyncs per second. Full-page images after checkpoints can add 8 KB per first-modified page, which can temporarily multiply WAL generation.',
        'Recovery time grows with the WAL distance from the redo pointer to the crash point. A 512 MB gap may replay in seconds on fast storage, while a 20 GB gap can mean minutes of startup delay. Shorter checkpoint intervals reduce recovery time but increase background write pressure.',
        {
          type: 'callout',
          text: 'Full-page images are the largest WAL amplification factor. Immediately after a checkpoint, every first-modified page logs an extra 8 KB. On a write-heavy system with 32 GB of shared_buffers, the post-checkpoint FPI burst can temporarily double WAL generation rate.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'WAL and checkpoints power ordinary PostgreSQL crash recovery, physical base backups, point-in-time recovery, and streaming replication. A standby is effectively a server that keeps running recovery as new WAL arrives from the primary.',
        'The same design lesson appears outside PostgreSQL. Durable logs let systems acknowledge compact sequential writes first and repair scattered state later. The hard part is preserving the ordering stamps that make replay safe.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/9/99/PostgreSQL_dump_restore.svg',
          alt: 'PostgreSQL backup and restore flow showing pg_dump and pg_restore paths',
          caption: 'PostgreSQL backup and recovery paths. Physical backups (pg_basebackup) rely on WAL replay to reach consistency. Logical backups (pg_dump/pg_restore) are self-contained but cannot provide point-in-time recovery between snapshots.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'WAL cannot protect against storage that lies about fsync. If the disk or filesystem says WAL is durable while data remains only in volatile cache, the database can acknowledge a commit that disappears after power loss. Hardware and operating system behavior are part of the correctness boundary.',
        'Checkpoints can also become a latency hazard. If dirty pages accumulate faster than storage can flush them, requested checkpoints write aggressively and foreground transactions feel the I/O pressure. Replication slots or broken archiving can hold old WAL and fill pg_wal until the server stops accepting writes.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Unaligned_write_on_512e_HDD.svg',
          alt: 'Unaligned write on Advanced Format disk showing read-modify-write penalty',
          caption: 'Torn write hazard: when the OS writes an 8 KB page across physical sector boundaries, a power failure mid-write can leave the page half-old and half-new. Full-page images (FPI) in WAL protect against this by logging the entire pre-modification page so recovery can restore a known-good copy.',
        },
        {
          type: 'callout',
          text: 'A checkpoint is not a backup. It advances the redo pointer and allows old WAL to be recycled. Once old WAL is gone, the state before the checkpoint is unrecoverable. For point-in-time recovery, you need WAL archiving -- a separate mechanism that copies segments to durable storage before they are recycled.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an order service commits 5,000 orders per second for 120 seconds after a checkpoint. WAL advances from 0/A000000 to 0/C000000, roughly 512 MB, while 48,000 data pages remain dirty in memory. A power loss removes shared buffers but leaves WAL and the last checkpoint record on disk.',
        'On restart, PostgreSQL begins at redo LSN 0/A000000 and scans forward. A WAL record at 0/A123456 for page P is applied if P has page LSN 0/A100000 and skipped if P has page LSN 0/A200000. After replay reaches 0/C000000, committed orders are present again and a later checkpoint advances the redo pointer.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/PostgreSQL_xid_cycle.svg',
          alt: 'PostgreSQL transaction ID cycle showing wraparound behavior',
          caption: 'PostgreSQL transaction IDs are 32-bit and wrap around. Each WAL record is stamped with the transaction that generated it. Recovery uses these stamps plus commit status (clog) to determine which transactions were committed at crash time.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL WAL introduction at https://www.postgresql.org/docs/current/wal-intro.html, WAL configuration at https://www.postgresql.org/docs/current/wal-configuration.html, WAL internals at https://www.postgresql.org/docs/current/wal-internals.html, runtime WAL settings at https://www.postgresql.org/docs/current/runtime-config-wal.html, and pg_waldump at https://www.postgresql.org/docs/current/pgwaldump.html.',
        'Study ARIES for the classic recovery model, PostgreSQL buffer management for dirty-page behavior, PostgreSQL streaming replication for continuous WAL replay, MVCC internals for visibility after recovery, and SQLite rollback journal as a contrasting undo-style design.',
      ],
    },
  ],
};
