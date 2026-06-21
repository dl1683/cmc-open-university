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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for Sequence Locks (Seqlocks). A read-mostly consistency pattern: writers bump an odd/even version counter, while readers copy data and retry if the version changed..",
        {
          type: 'callout',
          text: 'A seqlock makes readers cheap by turning coherence into a validation step instead of a read-side lock.',
        },
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Some shared state is read constantly and written rarely: clock values, compact statistics, routing metadata, configuration generation numbers, and small tuples that must be read as a coherent group. A reader-writer lock can protect that state, but every reader still participates in synchronization. On a hot read path, even cheap read-side locking can matter.',
        'The tempting alternative is to read the fields without coordination. That fails when a writer updates multiple fields and a reader observes a torn mix. For example, a reader might see seconds from before a time update and nanoseconds from after it. Each field is individually plausible, but the pair never existed as one coherent version.',
        'A sequence lock, or seqlock, exists for this narrow but important gap. It gives readers a very cheap optimistic path: copy the fields, then validate that no writer overlapped the copy. Readers do not block writers. They either accept a coherent snapshot or retry.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first baseline is a mutex. It is simple and correct, but it serializes readers with writers and often with other readers. If the data is read millions of times per second and written rarely, that can waste the shape of the workload.',
        'The second baseline is a reader-writer lock. It allows concurrent readers, but readers still enter and leave a synchronization protocol. Writers must wait for active readers. That is often right, but it is heavier than necessary for a tiny copyable snapshot.',
        'The third baseline is an unchecked lock-free read. It is fast but not safe for multi-field consistency. The wall is proving that all copied fields came from one version without making the common reader path take a real lock.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A seqlock uses a sequence counter as a version certificate. Writers make the counter odd while data is unstable and even when a coherent version is available. Readers accept a copy only if the counter was even and unchanged before and after the copy.',
        {
          type: 'image',
          src: 'https://image1.slideserve.com/2773571/seqlocks-l.jpg',
          alt: 'Lecture slide describing a seqlock as a spinlock plus a sequence counter',
          caption: 'The seqlock state is a writer lock plus a sequence counter that readers sample twice. Source: SlideServe CSC 660 lecture image https://www.slideserve.com/yuval/csc-660-advanced-os.',
        },
        'The reader may race a writer, but it can detect the race afterward. Same even sequence means the copied fields belong to one coherent version. Odd or changed sequence means discard the copy and retry.',
        'The important constraint is that readers must only copy data that remains safe to touch during the read attempt. A seqlock can detect a torn value; it cannot undo a use-after-free. If the protected data includes pointers whose targets can disappear, pair the design with RCU, hazard pointers, epochs, or another lifetime scheme instead.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The writer side is serialized. A writer takes the writer-side lock or otherwise excludes other writers. It increments the sequence counter to an odd value, mutates the protected fields, then increments the sequence counter again to the next even value. Odd means a write is in progress. Even means a stable version may be available.',
        'The reader samples the sequence counter, checks that it is even, copies the protected fields into local variables, and samples the counter again. If the two samples match and are even, the reader accepts the local copy. If the first value was odd or the two values differ, the reader throws away the copy and repeats.',
        'The sequence counter is not just an integer convention. Correct implementations use memory ordering so the reader cannot move the data copy outside the validation window and the writer cannot publish the even value before the data writes are visible. In low-level code, this is the difference between a useful seqlock and a decorative counter.',
        'There are related forms. A bare sequence counter can be used when external writer serialization already exists. A seqlock packages the sequence counter with a writer lock. Latch sequence counters use double buffering in some kernel designs so readers can switch between copies while a writer updates the other one.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        'The reader-retry view shows the optimistic loop. The reader reads the sequence, copies fields, reads the sequence again, and accepts only when the counter stayed the same even value. The retry path is not an error path; it is the ordinary cost paid when a writer overlaps a read.',
        'The writer-discipline view shows the contract writers must uphold. Writers serialize with one another, bracket mutation with odd and even sequence values, and leave readers to validate. If the writer does not keep that ordering, readers can accept impossible snapshots.',
        'The comparison view shows why seqlocks sit beside RCU and reader-writer locks rather than replacing them. RCU solves lifetime for old versions. Reader-writer locks block or coordinate readers. Seqlocks are for small copied state where retry is cheaper than read-side locking.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The sequence counter brackets the mutation. A writer changes the counter before and after changing data. A reader that overlaps the write should observe either the odd in-progress value or a different ending value. In both cases it rejects the copy. A reader that sees the same even value on both sides has evidence that no writer bracket crossed its copy window.',
        'This is a validation argument, not a magic atomic snapshot of every memory location. It relies on the writer making data writes between the odd and even publications, and it relies on the reader keeping the copied loads between its two sequence reads. That is why kernel documentation emphasizes the required read and write primitives around sequence counters.',
        'The design differs from RCU. RCU lets a reader continue on an old published version while writers publish a new version and delay reclamation. A seqlock usually exposes one current copy. Readers that collide with a writer retry until they copy a stable version.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The happy path is extremely small: two counter reads and a bounded data copy. That makes seqlocks attractive for read-mostly values where readers must be fast and writers are rare and short.',
        'The cost is retry work. If writers are frequent, long, preempted, or delayed while holding the write side, readers can spin and waste CPU. In real-time or latency-sensitive paths, unbounded retry loops need careful limits, fallback behavior, or a different synchronization primitive.',
        'Writers also pay discipline costs. They must serialize with one another, bracket updates correctly, and avoid sleeping or doing long work while the sequence is odd. The protected data must be small enough that repeated copying is acceptable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pointer lifetime is the most important failure mode. A seqlock can tell a reader that a copied pointer value was part of a coherent version, but it cannot guarantee that the object behind the pointer remains allocated while the reader dereferences it. Do not use seqlocks alone for pointer graphs that writers can free.',
        'Large data is another failure. If the protected structure is expensive to copy, retries become expensive and the read path can lose its advantage. A reader-writer lock, RCU, copy-on-write map, or snapshot structure may be better.',
        'Write-heavy workloads defeat the purpose. Frequent odd intervals force repeated retries. A seqlock chooses cheap readers by assuming writers are rare and short. When that assumption breaks, the retry curve can become worse than ordinary blocking.',
        'Counter wraparound and memory ordering are subtle low-level concerns. A very small counter can wrap between the two reader samples and make a changed version appear unchanged. Weak memory ordering can allow fields and counter reads to be observed out of the intended order. Production implementations use appropriate counter width and primitives.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Use a seqlock only for small, copyable state with rare, bounded writes. Good examples include a pair of time fields, a small statistics tuple, or a compact configuration snapshot. Bad examples include linked structures, resizable arrays, objects with independent lifetimes, and anything that requires blocking operations during write.',
        'Keep the write section tight. Compute expensive values before entering the writer critical section when possible. Once the sequence is odd, mutate the protected fields and publish the even value quickly.',
        'Make retry behavior explicit. Readers should copy into local variables, validate, and then use the local copy. They should not perform side effects inside the retry window. If a reader may loop for too long, add a fallback such as taking a real lock, yielding, or returning a stale cached value if the domain allows it.',
        'Document the memory-ordering primitive rather than the high-level idea only. In C, C++, Rust, or kernel code, the exact acquire, release, volatile, barrier, or helper API choices are part of correctness. Copying a seqlock sketch from pseudocode without those constraints is a common way to get a fast but wrong implementation.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A kernel exposes a time value split into seconds and nanoseconds. A writer updates both fields. Without validation, a reader could copy seconds before the update and nanoseconds after the update. The resulting pair could move time backward or produce a value that never existed.',
        'With a seqlock, the quiet read is straightforward. The reader sees sequence 42, copies seconds and nanoseconds, then sees sequence 42 again. Because 42 is even and unchanged, the pair is accepted.',
        'During a write, the writer changes the sequence to 43, updates the fields, and then changes the sequence to 44. A reader that sees 43 knows a write is active and retries. A reader that starts at 42 and ends at 44 also retries. Only a read entirely outside the write window accepts.',
      ],
    },
    {
      heading: 'Where it fits in the concurrency map',
      paragraphs: [
        'Use seqlocks when the core problem is torn reads of small data. Use RCU when readers need to traverse versions whose lifetime must be protected. Use hazard pointers or epochs when individual node reclamation is the central problem. Use reader-writer locks when readers cannot retry cheaply or when writes need to block readers for semantic reasons.',
        'The common theme is separating visibility, consistency, and lifetime. A seqlock proves that one copied value was not torn. It does not by itself prove that a referenced object will live, that an update is linearizable in the business sense, or that writers can ignore serialization.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Linux kernel sequence counter documentation at https://docs.kernel.org/locking/seqlock.html, kernel seqlock source at https://github.com/torvalds/linux/blob/master/include/linux/seqlock.h, and Rust seqlock documentation at https://docs.rs/seqlock.',
        'Study Linearizability History Checker, Nonblocking Progress Guarantees, Read-Copy-Update (RCU), Hazard Pointers & Epoch Reclamation, MCS Queue Lock, Futex Wait Queue, Atomic Compare-And-Swap, MVCC Internals & VACUUM, and Snapshot Isolation next. Seqlocks are one point in a broader design space of validation, versioning, blocking, and reclamation.',
      ],
    },
      {
      heading: 'The obvious approach',
      paragraphs: [
        "Name the reasonable first attempt and why teams reach for it.",
        "Then show the exact place that approach stops scaling or starts breaking.",
        "Treat this section as contrast, not a rejection.",
      ],
    },

    {
      heading: 'Real-world uses',
      paragraphs: [
        "Show where this approach appears in products, libraries, or service designs.",
        "Tie each use case to a workload shape, not a brand name.",
        "The learner should know exactly when this pattern should be chosen next.",
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Sequence Locks (Seqlocks) moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    },

      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },
],
};
