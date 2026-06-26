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
  const readSteps = 5;
  const exampleSeq = 42;
  const seriesCount = 2;

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
    explanation: `A ${topic.title.toLowerCase()} reader follows ${readSteps} steps: sample sequence counter, copy protected fields, sample counter again. If the counter was even and unchanged, the copy was consistent.`,
    invariant: `The reader does not block the writer; it validates the snapshot afterward across ${readSteps} read-path nodes.`,
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
    explanation: `The accepted path is just two version reads around a local copy. The first even value (${exampleSeq}) says no writer was already active; the matching ending value (${exampleSeq}) says no writer overlapped this read.`,
    invariant: `Same even sequence (${exampleSeq}) means one coherent version.`,
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
    explanation: `If the sequence changes from ${exampleSeq} to ${exampleSeq + 2}, or if the reader observes an odd value like ${exampleSeq + 1}, a writer may have split the read across two versions. The reader throws away the copy and tries again.`,
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
    explanation: `A seqlock trades blocking for retry work, as shown by ${seriesCount} series (seqlock vs lock). That is excellent for short writes and tiny copied state; it is dangerous for large structures or frequent writers.`,
  };
}

function* writerDiscipline() {
  const oddSeq = 43;
  const evenSeq = 44;
  const patternCount = 3;
  const writerSteps = 5;

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
    explanation: `The writer serializes with other writers, increments the sequence to an odd value (${oddSeq}), mutates the fields, then increments again to the next even value (${evenSeq}). Odd means a write is in progress.`,
    invariant: `Only writers take the writer lock; readers validate with the counter (odd ${oddSeq} signals dirty, even ${evenSeq} signals clean).`,
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
    explanation: `${topic.title} protect small, copyable groups of fields. They are not a safe way to chase pointers whose target can be freed while a reader is copying.`,
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
    explanation: `Comparing ${patternCount} read-mostly patterns: seqlocks, Read-Copy-Update (RCU), and reader-writer locks solve neighboring problems. Pick the mechanism by mutation frequency, object lifetime, and whether readers can afford to retry.`,
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
    explanation: `The memory-ordering details matter across all ${writerSteps} writer-path nodes. Readers must not reorder validation around the copied data, and writers must publish the odd (${oddSeq}) / even (${evenSeq}) transitions around the mutation.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a race between one writer and one optimistic reader. A seqlock, short for sequence lock, is a synchronization pattern where writers mark a version counter before and after a write, and readers accept copied data only when that counter stayed even and unchanged.',
        {
          type: 'callout',
          text: 'A seqlock makes readers cheap by turning coherence into a validation step instead of a read-side lock.',
        },
        'The active highlight marks the counter or field being touched right now. A visited field has already been copied or checked; a found state means the reader has proved that the copied fields came from one completed version.',
        'Use one rule while watching: an even counter can be stable, an odd counter means a writer is inside the update, and a changed counter means the reader must throw away the copy. The animation is safe to read only through that rule; without it, the reader path looks like an unchecked data race.',
      
        {type: 'image', src: './assets/gifs/sequence-lock-seqlock.gif', alt: 'Animated walkthrough of the sequence lock seqlock visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some shared values are read far more often than they are written. A kernel time pair, a routing epoch, or a compact statistics tuple may be read millions of times while the writer updates it rarely.',
        'A normal lock makes every reader enter the synchronization protocol. That is correct, but it spends coordination on the common path even when there is no writer.',
        'A seqlock exists for small, copyable state where retrying is cheaper than locking. Readers do not block writers; they copy the fields, validate the sequence number, and either keep the snapshot or try again.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach is a mutex around the shared fields. It is easy to reason about because one thread owns the state while it reads or writes.',
        'The next approach is a reader-writer lock. It allows many readers at once and blocks writers until readers leave, which is often a good fit for larger structures.',
        'Both approaches still make readers participate in locking. For tiny read-mostly state, the lock bookkeeping can cost more than the data copy itself.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Removing the lock entirely breaks multi-field consistency. A reader can copy field A before a writer update and field B after it, producing a pair that never existed together.',
        'For example, a time value split into seconds and nanoseconds can become impossible if seconds come from version 10 and nanoseconds from version 11. Each field may be valid alone, but the pair is torn.',
        'The wall is proving coherence without making every reader take a lock. The system needs evidence that no writer crossed the reader\'s copy window.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The sequence counter is a cheap certificate for one completed version. Writers make it odd before mutation and even after mutation; readers accept only if both samples are the same even number.',
        {
          type: 'image',
          src: 'https://image1.slideserve.com/2773571/seqlocks-l.jpg',
          alt: 'Lecture slide describing a seqlock as a spinlock plus a sequence counter',
          caption: 'The seqlock state is a writer lock plus a sequence counter that readers sample twice. Source: SlideServe CSC 660 lecture image https://www.slideserve.com/yuval/csc-660-advanced-os.',
        },
        'This converts synchronization into validation. The reader may race the writer, but it can detect that race before using the copied values.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The writer side is serialized by a writer lock or equivalent rule. A writer increments the counter from 42 to 43, changes the protected fields, then increments it to 44.',
        'The reader samples the counter, rejects immediately if it is odd, copies the protected fields into local variables, and samples the counter again. If the first and second samples are both 42, or both 44, the reader keeps the copy.',
        'Memory ordering is part of the mechanism. Correct implementations prevent the compiler or CPU from moving the data loads outside the two sequence reads, and prevent the writer from publishing the final even value before the data writes are visible.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every write is bracketed by one odd counter value and then a new even counter value. If a reader overlaps that write, it should see either the odd value or a different ending value.',
        'A reader that sees the same even value before and after its copy has evidence that no writer completed a bracket during the copy window. Under the required memory ordering, the copied fields therefore belong to one coherent version.',
        'This is not a lifetime guarantee. If a copied field is a pointer to an object that a writer can free, the seqlock can prove the pointer value was coherent, but not that the target object is still alive.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The successful read path is O(1) for a fixed-size tuple: two counter reads plus the data copy. Doubling the number of readers does not add writer-side waiting, because readers do not acquire the writer lock.',
        'The cost appears as retry behavior. If writers are frequent or stay in the odd state too long, readers spin, copy stale attempts, and burn CPU without making progress.',
        'Writers still pay ordinary serialization and ordering costs. The protected state must stay small enough that repeated copying is cheap, and the counter must be wide enough that wraparound cannot hide an intervening write.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Operating-system kernels use sequence counters and seqlock-like patterns for small read-mostly values such as timekeeping data and compact statistics. The workload fits because readers need a fast snapshot and writers are short.',
        'Runtime systems and low-level libraries use the same idea when a generation number can validate a copied configuration or routing table pointer. The common condition is a small snapshot whose fields must agree.',
        'Seqlocks sit beside reader-writer locks and RCU. Use the seqlock when coherence of copied values is the problem; use RCU or epochs when object lifetime is the problem.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails on write-heavy workloads because readers can retry without bound. A writer that is preempted after making the counter odd can stall many readers even though none of them holds a lock.',
        'It fails for pointer graphs unless another scheme protects lifetime. A reader can validate a pointer value and still dereference freed memory if reclamation is not handled separately.',
        'It also fails when side effects happen inside the retry window. A reader must copy, validate, and then act; logging, charging, sending, or mutating during an attempt can happen more than once.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the protected state is {seconds: 100, nanos: 900000000} with sequence 42. The writer wants to publish {seconds: 101, nanos: 100000000}.',
        'A clean read samples 42, copies 100 and 900000000, samples 42 again, and accepts. The same even number on both sides proves the copy did not cross a completed write.',
        'A racing read samples 42, copies seconds = 100, then the writer changes the counter to 43, writes both fields, and changes it to 44. The reader samples 44 at the end, rejects the mixed copy, retries, then reads 44, copies 101 and 100000000, reads 44 again, and accepts.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel sequence counter and seqlock documentation at https://docs.kernel.org/locking/seqlock.html, the Linux seqlock header at https://github.com/torvalds/linux/blob/master/include/linux/seqlock.h, and kernel timekeeping code that uses sequence-count style validation.',
        'Study reader-writer locks for the blocking alternative, RCU for read-side lifetime protection, hazard pointers and epochs for reclamation, atomic memory ordering for the acquire-release rules, and MVCC for the database versioning cousin.',
      ],
    },
  ],
};
