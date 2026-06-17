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
      heading: 'The problem',
      paragraphs: [
        'PostgreSQL cannot make every commit wait until every changed heap page, index page, visibility map page, and metadata page has reached its final place on disk. That would turn many small transactions into scattered synchronous writes and would make commit latency depend on the slowest dirty page.',
        'At the same time, a committed transaction must survive a crash. Shared buffers vanish on restart, data files can be behind the last commit, and the server still has to reconstruct a consistent database before accepting traffic. WAL and checkpoints are the mechanism that separates fast durable commit from slower data-file writeback.',
        'The topic exists because storage engines need a controlled lie: a transaction can be durable before every final data page is durable, as long as the log contains enough information to rebuild the final page state later.',
      ],
    },
    {
      heading: 'Why direct page flushes lose',
      paragraphs: [
        'The simple durability story is force-in-place: before commit returns, write every modified page to its relation file. It is easy to explain, but it couples transaction latency to random data-page I/O and makes group commit much harder.',
        'It also wastes work. Many transactions may update the same page before the page is written. Forcing the page after each transaction would repeatedly write intermediate states that can be reconstructed from a compact log.',
        'The opposite simple story is unsafe buffering: return from commit when memory has changed and hope background writes catch up. That gives low latency until a power loss turns committed rows into missing rows. WAL is the middle path: commit follows a sequential durable log, while data pages are written later under rules that recovery can verify.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Write-ahead logging records enough information to redo a change before the changed data page is allowed to matter on disk. A commit becomes durable when the required WAL is durable. The corresponding data pages may still be dirty in shared buffers.',
        'A checkpoint does not mean no dirty work exists in the system. It establishes a restart point and writes enough state so crash recovery can begin at a bounded redo location rather than replaying from the beginning of history. The database trades steady writeback and WAL retention against restart time.',
        'The invariant is order. WAL records have log sequence numbers, data pages carry page LSNs, and checkpoint metadata records where redo must begin. Recovery can compare those durable stamps instead of guessing what was in RAM at the time of the crash.',
      ],
    },
    {
      heading: 'Animation Meaning',
      paragraphs: [
        'In the checkpoint cycle view, the WAL path and the dirty-buffer path diverge. Commit durability follows the WAL flush. Data-file freshness follows later buffer writes. The checkpoint node summarizes those streams into a new recovery starting point.',
        'In the crash replay view, shared buffers disappear and the durable artifacts remain: WAL, checkpoint control state, and data pages with page LSNs. The useful question at each step is not "was this page dirty before the crash?" but "does this durable page already include the WAL record being considered?"',
        'The graph also separates two clocks. Transaction order is the WAL clock. Data-file writeback is the storage clock. Checkpoints keep the two clocks close enough that restart work stays bounded.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'When a transaction changes a page, PostgreSQL emits WAL records describing the change and marks the buffer dirty. At commit, the server ensures the WAL needed for that commit is flushed according to the durability settings. The heap and index pages can be written later by background writer, checkpointer, or foreground backends under pressure.',
        'Each data page carries a page LSN, an ordering stamp that says which WAL position the page reflects. During normal operation, the write-ahead rule prevents a data page from reaching disk before the WAL needed to repair or justify that page is durable.',
        'Checkpoints are triggered by time and WAL volume pressure, including checkpoint_timeout and max_wal_size. The checkpointer writes dirty buffers, records checkpoint metadata, and advances the redo pointer so future recovery has less WAL to scan.',
        'Full-page images add another guard near checkpoint boundaries. After a checkpoint, the first modification to a page may log the whole page image so recovery can repair a page even if the storage device left a torn write. That costs WAL volume, but it protects the redo contract.',
      ],
    },
    {
      heading: 'Recovery logic',
      paragraphs: [
        'After a crash, PostgreSQL reads checkpoint state to find the redo starting point. It then scans WAL forward. If a WAL record affects a page whose on-disk page LSN is older than the record, redo applies the change. If the page LSN is already new enough, redo skips that page for that record.',
        'That page-LSN check makes redo idempotent. Recovery can safely encounter records whose effects already reached disk before the crash and records whose effects were only in lost shared buffers. The log order supplies the missing history.',
        'Crash recovery is therefore not a rollback of every in-flight detail. It is a controlled replay from a known point until the durable data files match the durable log rules closely enough to open the database.',
        'Undo is handled differently from systems that roll back uncommitted page changes with an undo log. PostgreSQL uses MVCC visibility and transaction status to decide which tuple versions are visible after recovery. Redo makes the physical page changes present; visibility rules decide which versions count for readers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The write-ahead rule ensures every data-page write is backed by durable history. If a page reaches disk before a crash, its page LSN proves how much log history it includes. If it does not reach disk, the log can supply the missing physical changes.',
        'The redo pointer bounds the search. Recovery does not need to know which buffers were dirty at crash time because any page older than the relevant WAL record can be repaired by replay. Any page new enough can be skipped without changing the final state.',
        'The design is robust because the same record can be considered more than once across failure scenarios. Applying a needed record advances the page state. Seeing a record whose effect is already present is harmless because the page LSN stops duplicate redo.',
      ],
    },
    {
      heading: 'Checkpoint tradeoffs',
      paragraphs: [
        'Frequent checkpoints shorten crash recovery and limit WAL retention, but they can create heavy write pressure because many dirty pages must be pushed out. Infrequent checkpoints smooth some steady-state cost but increase the WAL distance recovery must replay and can increase storage needs.',
        'checkpoint_completion_target spreads checkpoint writes across time, but it cannot defeat an undersized storage system. If dirty pages accumulate faster than the system can flush them, foreground transactions can still pay the cost through stalls, full-page writes, or buffer replacement pressure.',
        'The right settings depend on write rate, storage latency, recovery objective, replication slots, archiving, and available disk. A database with strict restart-time targets may accept more steady writeback. A write-heavy analytics system may prefer fewer checkpoints if storage can hold the extra WAL safely.',
      ],
    },
    {
      heading: 'What can go wrong',
      paragraphs: [
        'The write-ahead rule depends on honest flushes. If storage acknowledges a flush before data is actually durable, the database can lose a guarantee it carefully maintained. Filesystem, controller, cache, and cloud-volume behavior matter.',
        'Misreading checkpoints is another common error. A checkpoint is not a backup, not a user-visible transaction boundary, and not proof that every recent page is clean forever. It is a recovery optimization with a specific redo pointer contract.',
        'Large WAL distance can make restart slow, especially after bursts. Conversely, forcing checkpoints too often can make normal operation slow. The knob is operational, not just theoretical.',
        'Operational blind spots show up as checkpoint warnings, WAL directory growth, replica retention pressure, long startup replay, or sudden latency spikes during write bursts. Those symptoms should be tied back to WAL generation rate, dirty-buffer pressure, and checkpoint completion, not treated as independent alerts.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'WAL plus checkpoints is a strong fit for transactional storage engines where many small logical changes touch a smaller set of physical pages. The log gives durable ordering, while delayed page writes let the system batch, reorder, and smooth I/O.',
        'It is not the whole story for replication lag, point-in-time recovery policy, logical decoding, backup strategy, or corruption detection. Those build on WAL but add their own metadata, retention, and verification rules.',
        'It also explains why database performance work often starts by asking what is being forced to disk and when. Commit latency, checkpoint writeback, fsync behavior, and recovery time are one connected system.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An order service commits thousands of transactions per second. WAL records are appended and flushed in commit batches. Heap pages and index pages become dirty in shared buffers, and many of those pages receive several updates before a checkpointer writes them to disk.',
        'Power fails after commit records are durable but before every changed page is in its relation file. On restart, PostgreSQL reads checkpoint metadata, starts from the redo pointer, scans WAL, compares page LSNs, reapplies missing changes, skips changes already reflected on disk, and opens only after the data files reach a consistent state.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: PostgreSQL WAL configuration at https://www.postgresql.org/docs/current/wal-configuration.html, PostgreSQL WAL introduction at https://www.postgresql.org/docs/current/wal-intro.html, PostgreSQL runtime WAL settings at https://www.postgresql.org/docs/current/runtime-config-wal.html, and pg_waldump documentation at https://www.postgresql.org/docs/current/pgwaldump.html.',
        'Study Write-Ahead Log (WAL), Readahead & Dirty Writeback, PostgreSQL Streaming Replication, PostgreSQL Buffer Pool Clock Sweep, Transaction Savepoint Stack, and MVCC Internals & VACUUM next.',
      ],
    },
  ],
};
