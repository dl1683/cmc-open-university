// Sequence locks: a version counter lets readers detect torn reads and retry
// without taking a read-side lock.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'sequence-lock-seqlock',
  title: 'Sequence Locks (Seqlocks)',
  category: 'Data Structures',
  summary: 'A read-mostly consistency pattern: writers bump an odd/even version counter, while readers copy data and retry if the version changed.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['reader retry', 'writer discipline'], defaultValue: 'reader retry' },
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

function* readerRetry() {
  yield {
    state: graphState({
      nodes: [
        { id: 's1', label: 'read seq', x: 0.9, y: 4.0, note: 'even?' },
        { id: 'copy', label: 'copy', x: 2.7, y: 4.0, note: 'fields' },
        { id: 's2', label: 'read seq', x: 4.5, y: 4.0, note: 'same?' },
        { id: 'ok', label: 'accept', x: 6.3, y: 4.0, note: 'stable' },
        { id: 'retry', label: 'retry', x: 8.2, y: 4.0, note: 'changed' },
      ],
      edges: [
        { id: 'e-s1-copy', from: 's1', to: 'copy' },
        { id: 'e-copy-s2', from: 'copy', to: 's2' },
        { id: 'e-s2-ok', from: 's2', to: 'ok' },
        { id: 'e-s2-retry', from: 's2', to: 'retry' },
      ],
    }, { title: 'The read path is copy, validate, maybe retry' }),
    highlight: { found: ['ok'], active: ['s1', 's2'], compare: ['retry'] },
    explanation: 'A seqlock reader samples a sequence counter, copies the protected fields, then samples the counter again. If the counter was even and unchanged, the copy was consistent.',
    invariant: 'The reader does not block the writer; it validates the snapshot afterward.',
  };

  yield {
    state: labelMatrix(
      'Even unchanged sequence accepts',
      [
        { id: 'begin', label: 'begin' },
        { id: 'copy', label: 'copy data' },
        { id: 'end', label: 'end' },
      ],
      [
        { id: 'seq', label: 'seq' },
        { id: 'data', label: 'data' },
      ],
      [
        ['42 even', 'start ok'],
        ['42', 'x=10 y=20'],
        ['42 even', 'same -> accept'],
      ],
    ),
    highlight: { found: ['end:data'], active: ['begin:seq', 'end:seq'] },
    explanation: 'The accepted path is just two version reads around a local copy. The first even value says no writer was already active; the matching ending value says no writer overlapped this read.',
    invariant: 'Same even sequence means one coherent version.',
  };

  yield {
    state: labelMatrix(
      'Changed sequence forces retry',
      [
        { id: 'begin', label: 'begin' },
        { id: 'copy', label: 'copy data' },
        { id: 'end', label: 'end' },
      ],
      [
        { id: 'seq', label: 'seq' },
        { id: 'data', label: 'data' },
      ],
      [
        ['42 even', 'start ok'],
        ['43 odd', 'writer active'],
        ['44 even', 'changed -> retry'],
      ],
    ),
    highlight: { active: ['copy:seq', 'end:seq'], removed: ['end:data'] },
    explanation: 'If the sequence changes, or if the reader observes an odd value, a writer may have split the read across two versions. The reader throws away the copy and tries again.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'write rate', min: 0, max: 100 }, y: { label: 'reader retries', min: 0, max: 100 } },
      series: [
        { id: 'seqlock', label: 'seqlock', points: [{ x: 0, y: 0 }, { x: 20, y: 5 }, { x: 50, y: 24 }, { x: 80, y: 62 }, { x: 100, y: 96 }] },
        { id: 'lock', label: 'reader lock wait', points: [{ x: 0, y: 12 }, { x: 20, y: 18 }, { x: 50, y: 38 }, { x: 80, y: 70 }, { x: 100, y: 90 }] },
      ],
    }),
    highlight: { active: ['seqlock'], compare: ['lock'] },
    explanation: 'A seqlock trades blocking for retry work. That is excellent for short writes and tiny copied state; it is dangerous for large structures or frequent writers.',
  };
}

function* writerDiscipline() {
  yield {
    state: labelMatrix(
      'Writer makes the counter odd while data is unstable',
      [
        { id: 'start', label: 'start write' },
        { id: 'mutate', label: 'mutate' },
        { id: 'finish', label: 'finish write' },
      ],
      [
        { id: 'seq', label: 'seq' },
        { id: 'reader', label: 'reader sees' },
      ],
      [
        ['43 odd', 'retry'],
        ['43 odd', 'unstable'],
        ['44 even', 'new stable'],
      ],
    ),
    highlight: { active: ['start:seq', 'mutate:seq'], found: ['finish:reader'] },
    explanation: 'The writer serializes with other writers, increments the sequence to an odd value, mutates the fields, then increments again to the next even value. Odd means a write is in progress.',
    invariant: 'Only writers take the writer lock; readers validate with the counter.',
  };

  yield {
    state: labelMatrix(
      'What can be protected',
      [
        { id: 'time', label: 'time pair' },
        { id: 'stats', label: 'stats tuple' },
        { id: 'pointer', label: 'pointer graph' },
        { id: 'slow', label: 'slow copy' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['good', 'small'],
        ['good', 'bounded'],
        ['bad', 'lifetime'],
        ['bad', 'retry cost'],
      ],
    ),
    highlight: { found: ['time:fit', 'stats:fit'], removed: ['pointer:fit', 'slow:fit'] },
    explanation: 'Seqlocks protect small, copyable groups of fields. They are not a safe way to chase pointers whose target can be freed while a reader is copying.',
  };

  yield {
    state: labelMatrix(
      'Compare read-mostly patterns',
      [
        { id: 'seqlock', label: 'seqlock' },
        { id: 'rcu', label: 'RCU' },
        { id: 'rwlock', label: 'rw lock' },
      ],
      [
        { id: 'reader', label: 'reader' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['retry loop', 'torn read detect'],
        ['old version', 'grace period'],
        ['takes lock', 'contention'],
      ],
    ),
    highlight: { active: ['seqlock:reader'], compare: ['rcu:reader', 'rwlock:reader'] },
    explanation: 'Seqlocks, Read-Copy-Update (RCU), and reader-writer locks solve neighboring problems. Pick the mechanism by mutation frequency, object lifetime, and whether readers can afford to retry.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'wlock', label: 'writer lock', x: 0.8, y: 4.0, note: 'serialize' },
        { id: 'odd', label: 'seq odd', x: 2.7, y: 4.0, note: 'dirty' },
        { id: 'store', label: 'stores', x: 4.5, y: 4.0, note: 'fields' },
        { id: 'even', label: 'seq even', x: 6.4, y: 4.0, note: 'clean' },
        { id: 'readers', label: 'readers', x: 8.3, y: 4.0, note: 'accept' },
      ],
      edges: [
        { id: 'e-wlock-odd', from: 'wlock', to: 'odd' },
        { id: 'e-odd-store', from: 'odd', to: 'store' },
        { id: 'e-store-even', from: 'store', to: 'even' },
        { id: 'e-even-readers', from: 'even', to: 'readers' },
      ],
    }, { title: 'Correctness depends on strict writer ordering' }),
    highlight: { active: ['wlock', 'odd', 'even'], found: ['readers'] },
    explanation: 'The memory-ordering details matter. Readers must not reorder validation around the copied data, and writers must publish the odd/even transitions around the mutation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'reader retry') yield* readerRetry();
  else if (view === 'writer discipline') yield* writerDiscipline();
  else throw new InputError('Pick a seqlock view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A sequence lock, often called a seqlock, is a read-mostly consistency mechanism for small pieces of shared state. A writer owns the write side and bumps a sequence counter before and after mutation. Readers do not take a read lock; they copy the data and check whether the sequence counter stayed even and unchanged.',
        'The idea is simple but sharp: a reader may see a racing write, but it can detect that race afterward. If the version changed or was odd, the reader discards the snapshot and retries. This makes seqlocks a close cousin of Read-Copy-Update (RCU), MVCC Internals & VACUUM, and optimistic database validation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The writer path is serialized. At the start of a write, the sequence becomes odd, marking the protected fields unstable. The writer changes the fields, then increments the sequence again to an even value. Readers sample the sequence, copy the fields, then sample the sequence again. Same even number means the copied fields belong to one coherent version.',
        'This differs from RCU. RCU lets an old reader continue on an old published version and uses a grace period before reclamation. A seqlock usually has one current copy. Readers racing a writer do not keep using an old version; they retry until the counter proves the copy was not torn.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The common read path is tiny: read a counter, copy a bounded amount of data, read the counter again. The cost appears when writers are frequent or the copied state is large, because readers may spin and retry. Seqlocks are therefore best for small, read-mostly values such as timekeeping pairs, counters, and compact statistics, not pointer-rich structures with tricky lifetime rules.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The Linux kernel documentation describes sequence counters and seqlocks as mechanisms for data rarely written to, such as system time, where readers want a consistent set of information and are willing to retry. Kernel source exposes seqcount and seqlock variants, including latch sequence counters for double-buffered cases.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A seqlock does not make arbitrary pointer traversal safe. If a writer can free or repurpose an object while a reader is following it, use a lifetime discipline such as Hazard Pointers & Epoch Reclamation or RCU. A seqlock also does not eliminate writer synchronization: writers still need to serialize with one another and preserve memory-ordering around the sequence increments.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel sequence counter documentation at https://docs.kernel.org/locking/seqlock.html, kernel seqlock source at https://github.com/torvalds/linux/blob/master/include/linux/seqlock.h, and Rust seqlock documentation at https://docs.rs/seqlock. Study Linearizability History Checker, Nonblocking Progress Guarantees, Read-Copy-Update (RCU), Hazard Pointers & Epoch Reclamation, MCS Queue Lock, Futex Wait Queue, and MVCC Internals & VACUUM next.',
      ],
    },
  ],
};
