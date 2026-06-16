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
    highlight: { active: ['lockfree:promise', 'waitfree:promise'], compare: ['blocking:risk', 'obfree:risk'] },
    explanation: 'Progress terms describe what happens under pauses and contention. They are liveness guarantees, not performance guarantees. Wait-free is stronger than lock-free; lock-free is stronger than obstruction-free.',
    invariant: 'Safety says the answer is correct. Progress says some answer eventually happens.',
  };

  yield {
    state: progressGraph('A paused lock owner can block every waiter'),
    highlight: { active: ['t1', 'lock', 'e-t1-lock'], removed: ['t2', 'done'] },
    explanation: 'Blocking code can be perfectly safe and still fail progress when a thread pauses while holding the lock. Other threads may be unable to complete even though CPUs are available.',
  };

  yield {
    state: progressGraph('Lock-free code lets some thread finish'),
    highlight: { active: ['t2', 'cas', 'object', 'done', 'e-t2-cas', 'e-cas-object', 'e-object-done'], compare: ['t1'] },
    explanation: 'Lock-free means system-wide progress. If one thread stalls, another can still complete operations. A specific unlucky thread may starve under contention.',
  };

  yield {
    state: progressGraph('Wait-free code bounds each operation', 'bounded'),
    highlight: { found: ['t2', 'done'], compare: ['cas'] },
    explanation: 'Wait-free is stronger: every operation completes in a finite number of its own steps, regardless of other thread speeds. That often requires helping, per-thread slots, or bounded algorithms.',
  };

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
    highlight: { active: ['fastLock:truth', 'slowLF:truth'], found: ['rt:lesson'] },
    explanation: 'A mutex can be faster than a lock-free structure when contention is low. The progress guarantee matters when pauses, failures, priority inversion, or hard latency bounds dominate.',
  };
}

function* contentionCase() {
  yield {
    state: plotState({
      axes: { x: { label: 'contenders', min: 1, max: 32 }, y: { label: 'tail latency', min: 0, max: 100 } },
      series: [
        { id: 'lock', label: 'lock', points: [{ x: 1, y: 5 }, { x: 4, y: 15 }, { x: 8, y: 35 }, { x: 16, y: 70 }, { x: 32, y: 95 }] },
        { id: 'lf', label: 'LF', points: [{ x: 1, y: 8 }, { x: 4, y: 18 }, { x: 8, y: 26 }, { x: 16, y: 44 }, { x: 32, y: 78 }] },
        { id: 'wf', label: 'WF', points: [{ x: 1, y: 12 }, { x: 4, y: 18 }, { x: 8, y: 24 }, { x: 16, y: 31 }, { x: 32, y: 42 }] },
      ],
    }),
    highlight: { active: ['lock', 'lf', 'wf'] },
    explanation: 'This stylized curve shows why the words are not enough. Lock-free often improves system progress, but tail latency can still rise under contention. Wait-free targets bounded per-operation latency at extra implementation cost.',
  };

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
    highlight: { found: ['cas:progress'], compare: ['retry:progress'] },
    explanation: 'A CAS increment loop is lock-free: each successful CAS completes one operation. But one unlucky thread can keep losing and retrying, so the loop is not wait-free by itself.',
  };

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
    highlight: { active: ['helper', 'apply'], found: ['ack1', 'ack2'] },
    explanation: 'Many wait-free constructions publish each thread operation in a slot. Threads help finish pending operations, so a slow owner does not prevent its operation from completing.',
  };

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
    highlight: { active: ['rt:fit', 'metrics:fit'], compare: ['batch:fit'] },
    explanation: 'The right guarantee is workload-specific. Real-time audio needs per-thread bounds. Telemetry wants throughput. Batch systems may prefer a simple lock if it is easier to prove and fast enough.',
  };

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
    highlight: { found: ['linear:topic', 'aba:topic', 'reclaim:topic'], compare: ['order:topic'] },
    explanation: 'Progress is only half the proof. A nonblocking object also needs linearizable behavior, ABA defense, safe reclamation, and correct memory ordering.',
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
      heading: 'What it is',
      paragraphs: [
        'Nonblocking progress guarantees describe who is allowed to wait forever. Blocking code can stop everyone if a lock owner stalls. Obstruction-free code completes if a thread eventually runs alone. Lock-free code guarantees system-wide progress: some operation completes. Wait-free code guarantees per-thread progress: every operation completes in a finite number of its own steps.',
        'Maurice Herlihy introduced wait-free synchronization as a strong progress condition for concurrent objects: https://dl.acm.org/doi/10.1145/114005.102808. A PDF is available at https://cs.brown.edu/people/mph/Herlihy91/p124-herlihy.pdf.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A CAS retry loop around a shared counter is a good first example. If many threads contend, each successful CAS completes one increment, so the system makes progress. But one unlucky thread may repeatedly lose and retry. That is lock-free, not wait-free. A wait-free design must bound each caller work, often by publishing per-thread descriptors and helping other operations finish.',
        'These are liveness properties. They do not prove the object returns correct values. Correctness still needs a safety condition such as linearizability, plus ABA protection, safe memory reclamation, and memory-ordering discipline.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A metrics pipeline uses a lock-free multi-producer queue because throughput matters and one paused producer should not block all consumers. The team accepts possible individual retries. A real-time audio callback uses a bounded single-producer single-consumer ring because it needs predictable per-callback work. A batch importer uses a mutex-protected queue because the simpler code is easier to verify and the lock is not on a hot path.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not use lock-free as a synonym for fast. Do not claim wait-free unless every operation has a bound independent of other thread speeds. Do not ignore starvation: lock-free permits an individual thread to lose forever in the abstract model. Do not chase stronger progress while leaving safety unproved.',
        'Study Linearizability History Checker, ABA Tagged Pointer Stack, Lock-Free Queue, Hazard Pointers & Epoch Reclamation, Bw-Tree Delta Chain & Mapping Table, Read-Copy-Update, Sequence Locks, MCS Queue Lock, Futex Wait Queue, and SharedArrayBuffer & Atomics next.',
      ],
    },
  ],
};
