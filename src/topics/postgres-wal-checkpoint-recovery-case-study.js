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
        'The "checkpoint cycle" view traces steady-state operation: a transaction emits WAL, the WAL is flushed for durability, dirty buffers accumulate, and the checkpointer periodically writes those buffers and records a redo pointer. Active nodes are the current stage of the write path. Found nodes are durable state. Compare nodes are surfaces whose freshness is in question.',
        'The "crash replay" view traces recovery after a power loss. Shared buffers vanish (removed nodes). The durable artifacts remain: WAL segments, checkpoint control state, and data pages with page LSNs. Active nodes are recovery stages. The key question at each frame is whether a given data page already includes the WAL record being considered.',
        {
          type: 'note',
          text: 'The graph separates two clocks. Transaction order is the WAL clock -- it advances with every commit. Data-file writeback is the storage clock -- it advances when dirty pages reach disk. Checkpoints keep these two clocks close enough that the distance recovery must replay stays bounded.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          attribution: 'PostgreSQL WAL introduction (docs)',
          text: 'Using WAL results in a significantly reduced number of disk writes, because only the log file needs to be flushed to disk to guarantee that a transaction is committed, rather than every data file modified by the transaction.',
        },
        'A single UPDATE to a row in PostgreSQL can dirty a heap page, one or more index pages, a visibility map page, and a free-space map page. If every commit had to wait for all those pages to reach their final positions on disk, a 100-byte row update would trigger four or more scattered synchronous writes. Commit latency would depend on the slowest page, and group commit -- batching multiple transactions into one fsync -- would be nearly impossible.',
        'At the same time, ACID requires that a committed transaction survive a crash. Shared buffers (in-memory copies of data pages) vanish on restart. Data files on disk may be arbitrarily behind the last commit. The database must reconstruct a consistent state before accepting connections.',
        'WAL and checkpoints solve both problems at once. A commit becomes durable when a compact, sequential log record is flushed. The scattered data pages can be written later, in any order, by background processes. If the server crashes before those pages reach disk, the log contains enough information to rebuild them. Checkpoints bound how far back in the log recovery must start.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest durability story is force-in-place: before returning from COMMIT, write every modified page to its relation file and fsync. This couples commit latency to random I/O -- one transaction touching a heap page, a TOAST page, and three index pages requires five scattered writes before the application gets a response.',
        {
          type: 'code',
          language: 'text',
          body: '-- Force-in-place commit (hypothetical)\nBEGIN;\nUPDATE orders SET status = \'shipped\' WHERE id = 42;\n-- Must fsync: heap page 117, index page 8, index page 203, vm page 4\n-- 4 random writes, each ~0.5-2ms on SSD, serialized\nCOMMIT;  -- returns after all 4 fsyncs complete (~2-8ms)',
        },
        'Force-in-place also wastes work. Ten transactions may update ten different rows on the same heap page. Forcing the page after each commit writes ten intermediate versions of a page whose final state could be captured in one write. Under high concurrency, the same page may be dirtied and flushed dozens of times per second.',
        'The opposite extreme is pure deferred writeback: return from COMMIT the instant memory changes and let the OS flush pages whenever it wants. This gives sub-microsecond commit latency until a power loss turns committed rows into missing rows. No log, no recovery, no guarantees.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between commit durability and data-page durability. Force-in-place closes it at unacceptable cost. Pure deferral ignores it and hopes for the best. Any intermediate approach must answer one question: when the server crashes with dirty pages in memory, which committed changes have reached disk and which have not?',
        {
          type: 'table',
          headers: ['Approach', 'Commit latency', 'Crash behavior', 'Fundamental problem'],
          rows: [
            ['Force-in-place', 'Random I/O bound (ms per dirty page)', 'No recovery needed', 'Couples commit speed to page scatter; kills throughput'],
            ['Pure deferred', 'Sub-microsecond', 'Committed data lost', 'No durability guarantee at all'],
            ['WAL + checkpoint', 'Sequential log fsync (~0.1-0.5ms batched)', 'Redo from checkpoint', 'Must maintain ordering invariants and manage WAL retention'],
          ],
        },
        'Without a log, there is no way to distinguish a page that was dirtied by a committed transaction from one dirtied by an aborted transaction. There is no way to know which pages are behind and which are current. The database cannot recover because it has no record of intent.',
        {
          type: 'note',
          text: 'The invariant that makes WAL work: no data page may reach disk unless every WAL record describing that page is already durable. This is the write-ahead rule. It guarantees that if a page is on disk, the log can explain it. If a page is not on disk, the log can rebuild it.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate the "what happened" log from the "where it lives" data files. Make the log sequential and durable at commit time. Let the data files catch up later under rules that recovery can verify.',
        {
          type: 'diagram',
          alt: 'PostgreSQL WAL checkpoint and recovery data flow',
          label: 'Two paths from transaction to durable state',
          body: 'Transaction\n    |\n    v\nWAL buffer --> WAL flush (sequential fsync)\n    |                |\n    v                v\nShared buffers    Durable log on disk\n(dirty pages)        |\n    |                v\n    v          Checkpoint: redo pointer\nCheckpointer        |\n    |                v\n    v          Recovery reads from here\nData files on disk',
          text: 'Transaction\n    |\n    v\nWAL buffer --> WAL flush (sequential fsync)\n    |                |\n    v                v\nShared buffers    Durable log on disk\n(dirty pages)        |\n    |                v\n    v          Checkpoint: redo pointer\nCheckpointer        |\n    |                v\n    v          Recovery reads from here\nData files on disk',
        },
        'Three ordering stamps tie the system together. Every WAL record has a Log Sequence Number (LSN) -- a byte offset into the WAL stream. Every data page header carries a page LSN -- the LSN of the last WAL record applied to that page. Every checkpoint records a redo LSN -- the WAL position where recovery must begin. Recovery compares page LSNs against WAL record LSNs to decide what to redo and what to skip.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a transaction modifies a page, PostgreSQL constructs one or more WAL records describing the change and copies them into the WAL buffer. The buffer in shared memory is marked dirty. At commit, the server calls XLogFlush to ensure all WAL records up to and including the commit record are flushed to disk. Group commit batches this: if multiple transactions are committing simultaneously, one fsync can cover all of them.',
        {
          type: 'code',
          language: 'c',
          body: '/* Simplified from src/backend/access/transam/xlog.c */\n/* The write-ahead contract in two lines: */\nif (page->pd_lsn > LogwrtResult.Flush)\n    XLogFlush(page->pd_lsn);\n/* Translation: before writing a data page to disk,\n   ensure the WAL up to that page\'s LSN is already flushed. */',
        },
        {
          type: 'bullets',
          items: [
            'WAL segments: WAL is split into 16 MB segment files (default). Segments are named by their starting LSN. pg_wal/ holds the active segments. Old segments are recycled or archived.',
            'Dirty buffer writes: the background writer and checkpointer write dirty pages from shared buffers to data files. They obey the write-ahead rule -- checking that the page LSN has been flushed to WAL before writing the page.',
            'Page LSN update: when a WAL record is applied to a buffer, the page header\'s pd_lsn is set to that record\'s LSN. This stamp persists to disk when the page is eventually written.',
            'Full-page images (FPI): after a checkpoint, the first modification to any page logs the entire 8 KB page image into WAL. This protects against torn pages -- a partial write where the OS writes half an 8 KB page before crashing. FPIs are expensive (they inflate WAL volume) but they close the torn-page hole.',
          ],
        },
        'The checkpoint process runs periodically (every checkpoint_timeout seconds, default 300) or when WAL volume approaches max_wal_size. It iterates all dirty buffers, writes them to disk respecting the write-ahead rule, then writes a checkpoint record to WAL and updates pg_control with the new redo LSN.',
        {
          type: 'code',
          language: 'text',
          body: '-- Key checkpoint parameters (PostgreSQL 16 defaults)\ncheckpoint_timeout       = 300s    -- max time between checkpoints\nmax_wal_size             = 1GB     -- WAL triggers checkpoint when exceeded\ncheckpoint_completion_target = 0.9 -- spread writes over 90% of interval\nfull_page_writes         = on      -- log full page after checkpoint',
        },
        'checkpoint_completion_target controls I/O smoothing. With a 300-second timeout and a target of 0.9, the checkpointer spreads its dirty-page writes over 270 seconds instead of blasting them all at once. This reduces latency spikes but means dirty pages live longer in shared buffers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on three properties that together make crash recovery safe:',
        {
          type: 'table',
          headers: ['Property', 'What it guarantees', 'What breaks without it'],
          rows: [
            ['Write-ahead rule', 'Every data page on disk is backed by durable WAL', 'A page on disk could contain changes with no log to explain them'],
            ['Page LSN ordering', 'Recovery can tell whether a page already includes a WAL record', 'Redo might apply a change twice, corrupting the page'],
            ['Redo pointer bound', 'Recovery starts from a known consistent point', 'Recovery would have to replay from the beginning of WAL history'],
          ],
        },
        'The write-ahead rule ensures that if a page reached disk before the crash, the WAL can explain every change on that page. If a page did not reach disk, the WAL can rebuild it from the last known good state. There is no third case.',
        'Page LSNs make redo idempotent. A WAL record says "change page P at LSN L." If page P on disk already has pd_lsn >= L, the change is already present and redo skips it. If pd_lsn < L, redo applies the change. This means recovery can safely re-encounter records whose effects were partially flushed before the crash.',
        {
          type: 'note',
          text: 'PostgreSQL does not use undo logging. Uncommitted transactions leave their tuple versions on disk, but MVCC visibility rules (clog/pg_xact) ensure those versions are invisible to readers after recovery. Redo makes the physical pages correct; visibility decides which tuple versions count.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Cost axis', 'What you pay', 'What controls it'],
          rows: [
            ['Commit latency', 'One sequential WAL fsync per commit group', 'commit_delay, wal_sync_method, storage latency'],
            ['WAL volume', '~1-3x the modified data size; more with full-page writes', 'full_page_writes, checkpoint frequency, wal_compression'],
            ['Checkpoint write pressure', 'All dirty pages flushed over the completion target window', 'shared_buffers size, checkpoint_completion_target, I/O bandwidth'],
            ['Recovery time', 'Proportional to WAL distance between redo pointer and crash point', 'checkpoint_timeout, max_wal_size'],
            ['WAL storage', 'Retained segments from redo pointer to current position', 'max_wal_size, replication slots, archiving'],
          ],
        },
        'The dominant steady-state cost is WAL fsync latency. Every committed transaction waits for its WAL records to be durable. On a server doing 10,000 TPS with group commit batching 20 transactions per fsync, that is 500 fsyncs/second. Each fsync on a fast NVMe SSD takes 50-200 microseconds. On a slow cloud volume with 1-2ms fsync, the same workload can stall.',
        'Full-page images are the largest WAL amplification factor. Immediately after a checkpoint, every first-modified page logs an extra 8 KB. On a write-heavy system with 32 GB of shared_buffers and a 5-minute checkpoint interval, the post-checkpoint FPI burst can temporarily double WAL generation rate.',
        'Recovery time scales linearly with the WAL distance between the redo pointer and the crash point. A 1 GB WAL gap with mostly heap updates recovers in roughly 10-30 seconds on modern hardware. A 10 GB gap after a long checkpoint interval or a missed checkpoint can mean minutes of downtime.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An e-commerce order service runs PostgreSQL 16 with 8 GB shared_buffers, checkpoint_timeout = 300s, and max_wal_size = 2 GB. The system processes 5,000 orders per second, each touching a heap page, two index pages, and a free-space map page.',
        {
          type: 'table',
          headers: ['Time', 'Event', 'WAL position', 'Dirty pages', 'Redo pointer'],
          rows: [
            ['T+0s', 'Checkpoint completes', '0/A000000', '0', '0/A000000'],
            ['T+30s', '150K commits, FPI burst subsides', '0/A800000', '~12,000', '0/A000000'],
            ['T+120s', '600K commits, steady WAL rate', '0/C000000', '~48,000', '0/A000000'],
            ['T+120s', 'Power failure -- crash', '--', 'Lost (RAM)', '0/A000000'],
            ['T+120s', 'Recovery starts at redo 0/A000000', '0/C000000', '--', '--'],
            ['T+128s', 'Redo complete, DB opens', '0/C000000', '0', '0/C000000'],
          ],
        },
        'Recovery replays ~512 MB of WAL (from 0/A000000 to 0/C000000). For each WAL record, it reads the target page from disk, compares pd_lsn against the record LSN, applies the change if the page is behind, and skips it if the page is current. Pages that the checkpointer had already flushed before the crash are skipped. Pages still dirty only in lost shared buffers are rebuilt from the log.',
        {
          type: 'code',
          language: 'text',
          body: '-- Recovery decides per-record, per-page:\n-- Record LSN: 0/A123456, targets page (1663, 16384, 12345), block 7\n-- Read page from disk, check pd_lsn:\n--   pd_lsn = 0/A100000  -->  0/A100000 < 0/A123456  -->  apply\n--   pd_lsn = 0/A200000  -->  0/A200000 > 0/A123456  -->  skip',
        },
        'After recovery, PostgreSQL performs an immediate checkpoint to advance the redo pointer past the crash point. Future recovery will not replay the same WAL again.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'WAL plus checkpoints is the durability backbone of every PostgreSQL deployment, from single-node developer databases to multi-terabyte production clusters. The same mechanism also enables features far beyond crash recovery:',
        {
          type: 'bullets',
          items: [
            'Streaming replication: standbys receive and replay WAL segments from the primary in near-real-time. The same redo logic used for crash recovery powers continuous replication. A standby is a permanently-recovering server.',
            'Point-in-time recovery (PITR): by archiving WAL segments to object storage, an operator can restore a base backup and replay WAL up to any specific timestamp. This turns the WAL stream into a time machine for the entire database.',
            'pg_basebackup: takes a filesystem-level backup while the server runs. The backup is consistent because WAL records captured during the backup window can repair any pages that were mid-write.',
            'Logical replication and change data capture: logical decoding reads committed WAL records and translates them into row-level change events. Tools like Debezium consume these events for CDC pipelines.',
            'pg_rewind: after a failover, pg_rewind uses WAL to "rewind" a former primary to a point where it can follow the new primary, avoiding a full re-sync.',
          ],
        },
        'The design also explains why database performance tuning often starts with WAL. Commit latency, checkpoint write spikes, replication lag, backup speed, and recovery time are all aspects of the same WAL pipeline.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Cause', 'Consequence', 'Mitigation'],
          rows: [
            ['Dishonest fsync', 'Storage says "flushed" but data is in volatile cache', 'Committed WAL lost on power failure; silent data loss', 'Use batteries (BBU), disable write cache, or use data-integrity-capable storage'],
            ['Torn page without FPI', 'full_page_writes = off and OS writes half an 8 KB page', 'Page is internally inconsistent; recovery cannot fix it', 'Never disable full_page_writes in production'],
            ['Unbounded WAL growth', 'Stale replication slot holds back WAL recycling', 'pg_wal fills disk; server halts to avoid corruption', 'Monitor slot lag; set max_slot_wal_keep_size'],
            ['Checkpoint storm', 'checkpoint_completion_target too low or I/O too slow', 'All dirty pages flushed at once; latency spike for transactions', 'Spread checkpoints; provision adequate I/O bandwidth'],
            ['Long recovery after crash', 'Large max_wal_size and infrequent checkpoints', 'Minutes of downtime replaying WAL', 'Tighten checkpoint_timeout or max_wal_size based on recovery SLA'],
          ],
        },
        'The most dangerous failure is dishonest fsync. In 2018, the PostgreSQL community discovered that some Linux filesystem configurations silently dropped fsync errors, meaning the database believed WAL was durable when it was not. PostgreSQL 12 added additional fsync error handling, but the root issue is hardware and OS behavior outside the database.',
        {
          type: 'note',
          text: 'A checkpoint is not a backup. It advances the redo pointer and allows old WAL to be recycled. Once old WAL is gone, the state before the checkpoint is unrecoverable. For point-in-time recovery, you need WAL archiving -- a separate mechanism that copies segments to durable storage before they are recycled.',
        },
        'Another subtle failure: if shared_buffers is much larger than the system can flush in one checkpoint cycle, the checkpointer falls behind. When that happens, PostgreSQL can trigger an "immediate" checkpoint, which writes all dirty pages as fast as possible and causes visible latency spikes. This shows up in logs as "checkpoints are occurring too frequently."',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL WAL introduction at https://www.postgresql.org/docs/current/wal-intro.html, WAL configuration at https://www.postgresql.org/docs/current/wal-configuration.html, WAL internals at https://www.postgresql.org/docs/current/wal-internals.html, runtime WAL settings at https://www.postgresql.org/docs/current/runtime-config-wal.html, and pg_waldump documentation at https://www.postgresql.org/docs/current/pgwaldump.html. The ARIES paper by Mohan et al. (1992) is the foundational work on write-ahead logging with physiological redo.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Write-Ahead Log (WAL) -- the general principle of logging intent before modifying data.',
            'Prerequisite: PostgreSQL Buffer Pool Clock Sweep -- how shared buffers are managed and how dirty pages are selected for eviction.',
            'Extension: PostgreSQL Streaming Replication -- how standbys continuously replay WAL from the primary.',
            'Extension: MVCC Internals and VACUUM -- how PostgreSQL handles visibility of uncommitted and aborted transactions without undo logs.',
            'Contrast: InnoDB double-write buffer -- MySQL/InnoDB uses a different torn-page protection mechanism instead of full-page images in WAL.',
            'Contrast: SQLite rollback journal -- SQLite logs the original page before modification (undo) rather than the change (redo), a fundamentally different recovery model.',
          ],
        },
        'The engineering question for WAL tuning is not "should I use WAL?" -- you have no choice. The useful questions are: how much WAL am I generating, how fast can my storage fsync it, how long can I tolerate recovery, and are my archiving and replication slots keeping up with the generation rate.',
      ],
    },
  ],
};

