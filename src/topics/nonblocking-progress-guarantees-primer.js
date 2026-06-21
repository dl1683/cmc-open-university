// Nonblocking progress guarantees: blocking, obstruction-free, lock-free, and
// wait-free describe who can be forced to wait, not whether code is fast.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'nonblocking-progress-guarantees-primer',
  title: 'Nonblocking Progress Guarantees Primer',
  category: 'Data Structures',
  summary: 'A concurrency primer: distinguish blocking, obstruction-free, lock-free, and wait-free progress under pauses, contention, and retries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['progress ladder', 'contention case'], defaultValue: 'progress ladder' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function progressGraph(title, t2Note = 'running') {
  return graphState({
    nodes: [
      { id: 't1', label: 'T1', x: 0.8, y: 2.2, note: 'paused' },
      { id: 't2', label: 'T2', x: 0.8, y: 5.0, note: t2Note },
      { id: 'lock', label: 'lock', x: 3.0, y: 2.2, note: 'owner?' },
      { id: 'cas', label: 'CAS', x: 3.0, y: 5.0, note: 'retry' },
      { id: 'object', label: 'object', x: 5.2, y: 3.6, note: 'shared' },
      { id: 'done', label: 'done', x: 7.6, y: 3.6, note: 'return' },
    ],
    edges: [
      { id: 'e-t1-lock', from: 't1', to: 'lock' },
      { id: 'e-t2-cas', from: 't2', to: 'cas' },
      { id: 'e-lock-object', from: 'lock', to: 'object' },
      { id: 'e-cas-object', from: 'cas', to: 'object' },
      { id: 'e-object-done', from: 'object', to: 'done' },
    ],
  }, { title });
}

function* progressLadder() {
  const levels = 4;
  const dimensions = 2;
  const activePromises = ['lockfree:promise', 'waitfree:promise'];
  const risksHighlighted = ['blocking:risk', 'obfree:risk'];
  yield {
    state: labelMatrix(
      'Progress ladder',
      [
        { id: 'blocking', label: 'block' },
        { id: 'obfree', label: 'ob-free' },
        { id: 'lockfree', label: 'LF' },
        { id: 'waitfree', label: 'WF' },
      ],
      [
        { id: 'promise', label: 'promise' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['own', 'stall'],
        ['solo', 'live'],
        ['some', 'starv'],
        ['all', 'cost'],
      ],
    ),
    highlight: { active: activePromises, compare: risksHighlighted },
    explanation: `Progress terms describe what happens under pauses and contention across ${levels} guarantee levels and ${dimensions} dimensions (promise vs risk). They are liveness guarantees, not performance guarantees. ${activePromises.length} levels (LF and WF) are highlighted because their promises are strongest.`,
    invariant: `Safety says the answer is correct. Progress says some answer eventually happens — ${levels} rungs from blocking to wait-free.`,
  };

  const activeBlocking = ['t1', 'lock', 'e-t1-lock'];
  const removedBlocking = ['t2', 'done'];
  yield {
    state: progressGraph('A paused lock owner can block every waiter'),
    highlight: { active: activeBlocking, removed: removedBlocking },
    explanation: `Blocking code can be perfectly safe and still fail progress when a thread pauses while holding the lock. Here ${activeBlocking.length} elements (T1, lock, edge) are active while ${removedBlocking.length} elements (T2, done) are removed — T2 cannot complete.`,
  };

  const activeLF = ['t2', 'cas', 'object', 'done', 'e-t2-cas', 'e-cas-object', 'e-object-done'];
  const stalledThreads = ['t1'];
  yield {
    state: progressGraph('Lock-free code lets some thread finish'),
    highlight: { active: activeLF, compare: stalledThreads },
    explanation: `Lock-free means system-wide progress. ${activeLF.length} elements form T2's active path through CAS to done, while ${stalledThreads.length} thread (T1) is stalled. A specific unlucky thread may starve under contention.`,
  };

  const t2Note = 'bounded';
  const foundNodes = ['t2', 'done'];
  const comparedNodes = ['cas'];
  yield {
    state: progressGraph('Wait-free code bounds each operation', t2Note),
    highlight: { found: foundNodes, compare: comparedNodes },
    explanation: `Wait-free is stronger: every operation completes in a finite number of its own steps (T2 is marked "${t2Note}"), regardless of other thread speeds. ${foundNodes.length} nodes reached done state while ${comparedNodes.length} node (CAS) shows the retry mechanism is no longer unbounded.`,
  };

  const misconceptions = 4;
  const activeExamples = ['fastLock:truth', 'slowLF:truth'];
  const keyLesson = 'rt:lesson';
  yield {
    state: labelMatrix(
      'Do not read the words as speed claims',
      [
        { id: 'fastLock', label: 'fast lock' },
        { id: 'slowLF', label: 'slow LF' },
        { id: 'wf', label: 'WF algo' },
        { id: 'rt', label: 'real-time' },
      ],
      [
        { id: 'truth', label: 'truth' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['can be fastest', 'low contention'],
        ['can spin', 'retry cost'],
        ['can be heavy', 'bounded steps'],
        ['needs bounds', 'use WF'],
      ],
    ),
    highlight: { active: activeExamples, found: [keyLesson] },
    explanation: `A mutex can be faster than a lock-free structure when contention is low. ${misconceptions} rows debunk speed myths — ${activeExamples.length} truths are highlighted, and the key takeaway is ${keyLesson.split(':')[0]} (real-time): the progress guarantee matters when pauses, failures, priority inversion, or hard latency bounds dominate.`,
  };
}

function* contentionCase() {
  const seriesCount = 3;
  const maxContenders = 32;
  const maxLatency = 100;
  const lockAt32 = 95;
  const lfAt32 = 78;
  const wfAt32 = 42;
  yield {
    state: plotState({
      axes: { x: { label: 'contenders', min: 1, max: maxContenders }, y: { label: 'tail latency', min: 0, max: maxLatency } },
      series: [
        { id: 'lock', label: 'lock', points: [{ x: 1, y: 5 }, { x: 4, y: 15 }, { x: 8, y: 35 }, { x: 16, y: 70 }, { x: 32, y: lockAt32 }] },
        { id: 'lf', label: 'LF', points: [{ x: 1, y: 8 }, { x: 4, y: 18 }, { x: 8, y: 26 }, { x: 16, y: 44 }, { x: 32, y: lfAt32 }] },
        { id: 'wf', label: 'WF', points: [{ x: 1, y: 12 }, { x: 4, y: 18 }, { x: 8, y: 24 }, { x: 16, y: 31 }, { x: 32, y: wfAt32 }] },
      ],
    }),
    highlight: { active: ['lock', 'lf', 'wf'] },
    explanation: `This stylized curve compares ${seriesCount} strategies across 1 to ${maxContenders} contenders. At ${maxContenders} threads, lock tail latency reaches ${lockAt32}, LF reaches ${lfAt32}, and WF stays at ${wfAt32} — showing why wait-free targets bounded per-operation latency at extra implementation cost.`,
  };

  const casSteps = 4;
  const globalProgressStep = 'cas:progress';
  const retryStep = 'retry:progress';
  yield {
    state: labelMatrix(
      'CAS counter case',
      [
        { id: 'read', label: 'read x' },
        { id: 'calc', label: 'calc x+1' },
        { id: 'cas', label: 'CAS' },
        { id: 'retry', label: 'retry' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'progress', label: 'progress' },
      ],
      [
        ['snapshot', 'private'],
        ['new value', 'private'],
        ['one winner', 'global'],
        ['losers loop', 'not per-thread'],
      ],
    ),
    highlight: { found: [globalProgressStep], compare: [retryStep] },
    explanation: `A CAS increment loop has ${casSteps} steps: read, calc, CAS, retry. It is lock-free because ${globalProgressStep.split(':')[0]} makes global progress each round. But ${retryStep.split(':')[0]} shows losers loop indefinitely, so the loop is not wait-free by itself.`,
  };

  const threadSlots = 2;
  const helperNodes = ['helper', 'apply'];
  const ackNodes = ['ack1', 'ack2'];
  const totalGraphNodes = 6;
  const totalGraphEdges = 5;
  yield {
    state: graphState({
      nodes: [
        { id: 'slot1', label: 'slot 1', x: 0.8, y: 2.4, note: 'T1 op' },
        { id: 'slot2', label: 'slot 2', x: 0.8, y: 4.8, note: 'T2 op' },
        { id: 'helper', label: 'helper', x: 3.0, y: 3.6, note: 'scan' },
        { id: 'apply', label: 'apply', x: 5.2, y: 3.6, note: 'finish' },
        { id: 'ack1', label: 'ack T1', x: 7.3, y: 2.4, note: 'done' },
        { id: 'ack2', label: 'ack T2', x: 7.3, y: 4.8, note: 'done' },
      ],
      edges: [
        { id: 'e-s1-helper', from: 'slot1', to: 'helper' },
        { id: 'e-s2-helper', from: 'slot2', to: 'helper' },
        { id: 'e-helper-apply', from: 'helper', to: 'apply' },
        { id: 'e-apply-ack1', from: 'apply', to: 'ack1' },
        { id: 'e-apply-ack2', from: 'apply', to: 'ack2' },
      ],
    }, { title: 'Wait-free designs often use helping' }),
    highlight: { active: helperNodes, found: ackNodes },
    explanation: `This ${totalGraphNodes}-node, ${totalGraphEdges}-edge graph shows how ${threadSlots} thread slots feed into ${helperNodes.length} helper stages (${helperNodes.join(' and ')}), producing ${ackNodes.length} acknowledgments. Threads help finish pending operations, so a slow owner does not prevent its operation from completing.`,
  };

  const workloadCount = 4;
  const activeWorkloads = ['rt:fit', 'metrics:fit'];
  const simpleCase = 'batch:fit';
  yield {
    state: labelMatrix(
      'Choosing the guarantee',
      [
        { id: 'kernel', label: 'kernel read' },
        { id: 'metrics', label: 'metrics' },
        { id: 'rt', label: 'RT audio' },
        { id: 'batch', label: 'batch job' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['no stall', 'RCU/read path'],
        ['throughput', 'LF queue'],
        ['bounded time', 'wait-free ring'],
        ['simplicity', 'lock often ok'],
      ],
    ),
    highlight: { active: activeWorkloads, compare: [simpleCase] },
    explanation: `The right guarantee is workload-specific across ${workloadCount} scenarios. ${activeWorkloads.length} workloads (${activeWorkloads.map(w => w.split(':')[0]).join(', ')}) benefit from nonblocking fits, while ${simpleCase.split(':')[0]} may prefer a simple lock if it is easier to prove and fast enough.`,
  };

  const safetyConcerns = 4;
  const provenTopics = ['linear:topic', 'aba:topic', 'reclaim:topic'];
  const pendingTopic = 'order:topic';
  yield {
    state: labelMatrix(
      'Safety still required',
      [
        { id: 'linear', label: 'linearize' },
        { id: 'aba', label: 'ABA' },
        { id: 'reclaim', label: 'reclaim' },
        { id: 'order', label: 'ordering' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'topic', label: 'topic' },
      ],
      [
        ['what order?', 'linearize'],
        ['same addr?', 'tagged ptr'],
        ['free when?', 'hazard/epoch'],
        ['seen when?', 'memory model'],
      ],
    ),
    highlight: { found: provenTopics, compare: [pendingTopic] },
    explanation: `Progress is only half the proof. A nonblocking object needs ${safetyConcerns} safety properties: ${provenTopics.length} are well-established (${provenTopics.map(t => t.split(':')[0]).join(', ')}), while ${pendingTopic.split(':')[0]} (memory model) is often the subtlest to get right.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'progress ladder') yield* progressLadder();
  else if (view === 'contention case') yield* contentionCase();
  else throw new InputError('Pick a progress-guarantee view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/nonblocking-progress-guarantees-primer.gif', alt: 'Animated walkthrough of the nonblocking progress guarantees primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Concurrent code can be safe and still stop moving. A mutex-protected queue may preserve FIFO perfectly, but if the lock owner is paused, every other thread can wait behind it.',
        'The naive question is "is it thread-safe?" That is only a safety question. Progress guarantees answer a different question: under pauses, contention, or unlucky schedules, who is still guaranteed to finish?',
        {type: 'callout', text: 'Safety asks whether the result is legal; progress asks whether some thread can still reach a result under pauses and contention.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state diagram with running waiting and blocked states', caption: 'Process-state transitions make the stress case visible: runnable hardware does not help if the needed owner is blocked or paused. Source: Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Locks make mutual exclusion easy to explain, but they couple progress to the lock owner. If the owner is preempted, blocks in a signal-unsafe region, or dies without recovery, the other threads cannot complete through that lock.',
        'Replacing the lock with CAS loops does not automatically solve every liveness problem. A loop can let the system move while one unlucky thread loses forever. That distinction is why the ladder has several rungs instead of one label called nonblocking.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Progress terms are liveness contracts, not speed claims. Obstruction-free code completes if a thread eventually runs alone. Lock-free code guarantees system-wide progress: some operation completes. Wait-free code guarantees per-thread progress: every operation completes in a finite number of its own steps.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Processor die where atomic instructions execute in hardware', caption: 'CAS and other atomic primitives are hardware contracts, but the progress guarantee comes from the whole algorithm around them. Source: Wikimedia Commons, KL and Intel, public domain.'},
        'A CAS increment loop is the small example. Each successful CAS completes one increment, so the object is lock-free. A particular caller can keep losing the race and retrying, so the loop is not wait-free by itself.',
        'This vocabulary prevents vague claims. "Nonblocking" is a family. "Lock-free" does not mean no retries. "Wait-free" does not mean fastest. Each word says which thread, under which schedule, is guaranteed to finish.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the progress-ladder view, read the paused thread as the stress test. If T1 pauses while holding a lock, T2 can be correct but unable to finish. If the object is lock-free, T2 may still complete some operation through CAS or another nonblocking step. If it is wait-free, T2 has a bound on its own operation.',
        'In the contention-case view, the retry loop is the distinction. A successful CAS proves system-wide movement, but a losing thread may retry many times. Helping schemes change that story by letting active threads finish published operations for one another.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Blocking algorithms usually wait for an owner or condition. Obstruction-free algorithms avoid blocking once contention disappears. Lock-free algorithms arrange every infinite execution so some successful CAS, publish, or handoff keeps completing operations.',
        'Wait-free algorithms go further. They bound each caller work, often by publishing operation descriptors and helping pending operations finish. Helping converts another thread pause from a global blocker into work that active threads can complete.',
        'Many practical algorithms sit between theory and hardware. A design may be lock-free in the abstract model but still suffer from cache-line bouncing, memory allocator locks, reclamation stalls, or operating-system scheduling effects. The progress proof has to include the actual components on the path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The guarantee is quantified over schedules. Lock-free means no schedule can prevent all operations from completing forever. Wait-free means no schedule can starve one operation forever if its thread keeps taking steps.',
        'This proof is separate from correctness. A nonblocking object still needs linearizability, ABA defense, safe reclamation, and memory-ordering discipline. Progress says an answer eventually happens; safety says the answer is allowed.',
        'The mental separation is important. A lock-free stack can still be wrong if it loses a node or frees memory too early. A lock-based queue can still be the right engineering choice if its workload does not have the pause or priority-inversion risks this ladder is designed to expose.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A shared counter implemented as a CAS loop reads x, computes x + 1, and tries compare-and-swap. If T1 pauses, T2 can still read and increment, so the counter is not blocked by T1. Every successful CAS completes one caller operation, so the object is lock-free.',
        'But T2 might lose the CAS repeatedly to other threads and keep retrying. That is why the simple loop is not wait-free for each caller. A wait-free design would need a bound, often by publishing operations in slots and having threads help complete pending work.',
        'A queue shows the same difference at larger scale. A lock-based queue may be simplest and fastest under light contention. A lock-free queue can keep consumers moving when one producer pauses. A wait-free queue for a real-time path may require bounded slots and fixed capacity so allocation and helping are also bounded.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Stronger progress usually costs more design machinery. Lock-free code may pay retry and cache-coherence costs under contention. Wait-free code may need per-thread slots, helping arrays, descriptors, bounded scans, or fixed-size rings.',
        'A mutex can be faster than a lock-free object at low contention. Wait-free can be slower on average while still being the right choice for a hard deadline because it bounds each operation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Choose the guarantee by failure mode. A metrics pipeline may choose a lock-free multi-producer queue because one paused producer should not block all consumers. A real-time audio callback may choose a bounded wait-free ring because it needs predictable per-callback work.',
        'Kernel paths, signal-sensitive code, runtimes, and low-latency services often care about progress under pause or priority inversion. Batch jobs and simple admin paths may prefer a lock because the proof is easier and the risk is lower.',
        'The ladder is also a design-review tool. Before approving a complicated nonblocking structure, ask what failure it removes, what safety proof it adds, what reclamation method it uses, and what benchmarks show under contention.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use lock-free as a synonym for fast. Do not claim wait-free unless every operation has a bound independent of other thread speeds. Do not ignore starvation: lock-free permits an individual thread to lose forever in the abstract model.',
        'Do not chase stronger progress while leaving safety unproved. A wait-free structure that returns the wrong value, reuses freed memory, or violates memory ordering is still broken.',
        'Do not forget memory reclamation. Removing a node without a lock is only half of deletion. Another thread may still hold a pointer. Hazard pointers, epochs, RCU, reference counts, or garbage collection must be part of the proof.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Write the progress claim in one sentence before writing code. For example: "enqueue is lock-free but not wait-free" or "the single-producer audio ring is wait-free for push and pop." Then identify the linearization point, ABA defense, memory ordering, and reclamation scheme.',
        'Benchmark more than average throughput. Measure retries per operation, p99 latency, cache misses, allocator interaction, and behavior when one thread is paused. A nonblocking algorithm should be tested under the failure mode it claims to survive.',
        'Keep the public API honest. If resize, close, flush, or destroy can block, document that separately from the progress of push and pop. Many structures are nonblocking only for a subset of operations, and hiding that boundary leads to bad real-time or signal-handler use.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A telemetry library wants many threads to enqueue metrics without letting one paused thread block the process. A lock-free multi-producer queue is attractive because the system can keep accepting metrics even if one producer stalls mid-operation.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Circular_buffer.svg', alt: 'Circular buffer ring divided into slots', caption: 'A bounded ring buffer is a common shape for real-time paths because capacity and per-operation work can be fixed in advance. Source: Wikimedia Commons, Cburnett, CC BY-SA 3.0 or GFDL.'},
        'A real-time audio callback has a stricter need. It cannot spin for an unbounded number of CAS retries, allocate memory, or wait on a paused helper. That path usually wants a bounded wait-free single-producer/single-consumer ring or another design whose operation count is known in advance.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Maurice Herlihy introduced wait-free synchronization as a strong progress condition for concurrent objects: https://dl.acm.org/doi/10.1145/114005.102808. A PDF is available at https://cs.brown.edu/people/mph/Herlihy91/p124-herlihy.pdf.',
        'Study Linearizability History Checker, ABA Tagged Pointer Stack, Lock-Free Queue, Hazard Pointers & Epoch Reclamation, Bw-Tree Delta Chain & Mapping Table, Read-Copy-Update, Sequence Locks, MCS Queue Lock, Futex Wait Queue, and SharedArrayBuffer & Atomics next.',
      ],
    },
  ],
};
