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
      heading: 'What it is',
      paragraphs: [
        'PostgreSQL uses WAL for durability and checkpoints to bound recovery work. WAL records describe changes before data pages are trusted. A checkpoint records a restart position and writes dirty pages so crash recovery can begin near recent work rather than scanning all history.',
        'PostgreSQL WAL configuration documentation explains that the checkpointer begins checkpoints based on checkpoint_timeout or max_wal_size pressure: https://www.postgresql.org/docs/current/wal-configuration.html. The WAL introduction states the write-ahead rule for changes to data files: https://www.postgresql.org/docs/current/wal-intro.html.',
      ],
    },
    {
      heading: 'Core mental model',
      paragraphs: [
        'Think in three structures: the append-only WAL, the shared-buffer dirty page set, and the checkpoint control state. Commits make WAL durable. Dirty pages can reach disk later. Checkpoints advance the safe replay start point.',
        'Crash recovery is guided by ordering stamps. Page LSNs let redo skip work already present in a data page. The checkpoint redo pointer tells recovery where replay must begin.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An order service commits thousands of transactions per second. WAL commit records flush in batches. Heap and index buffers become dirty. The checkpointer spreads writes so foreground backends rarely wait on every dirty page. During a power loss, shared buffers disappear but flushed WAL remains.',
        'On restart, PostgreSQL reads checkpoint metadata, replays WAL from the redo pointer, compares page LSNs, repairs stale pages, and opens only after reaching a consistent state.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not assume a committed transaction means every data page has been written to the main relation file. The durable promise is made by WAL first.',
        'Do not tune checkpoints only for throughput. Large intervals can improve write smoothing but increase WAL retention and recovery time. Tiny intervals can create constant write pressure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL WAL configuration at https://www.postgresql.org/docs/current/wal-configuration.html, PostgreSQL WAL introduction at https://www.postgresql.org/docs/current/wal-intro.html, PostgreSQL runtime WAL settings at https://www.postgresql.org/docs/current/runtime-config-wal.html, and pg_waldump documentation at https://www.postgresql.org/docs/current/pgwaldump.html.',
        'Study Write-Ahead Log (WAL), Readahead & Dirty Writeback, PostgreSQL Streaming Replication, PostgreSQL Buffer Pool Clock Sweep, Transaction Savepoint Stack, and MVCC Internals & VACUUM next.',
      ],
    },
  ],
};
