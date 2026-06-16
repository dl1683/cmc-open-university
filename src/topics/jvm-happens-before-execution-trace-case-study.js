// JVM happens-before traces: for concurrent Java, the trace must record
// synchronization actions and the writes each read is allowed to observe.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'jvm-happens-before-execution-trace-case-study',
  title: 'JVM Happens-Before Execution Trace',
  category: 'Systems',
  summary: 'A domain-trace case study for code world models: Java concurrency traces must record memory actions, synchronization edges, and read validity.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['happens-before graph', 'read validity'], defaultValue: 'happens-before graph' },
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

function hbGraph(title) {
  return graphState({
    nodes: [
      { id: 't1w', label: 'T1 w', x: 0.8, y: 2.0, note: 'x=1' },
      { id: 't1v', label: 'V write', x: 2.4, y: 2.0, note: 'flag=1' },
      { id: 'unlock', label: 'unlock', x: 4.0, y: 1.3, note: 'monitor' },
      { id: 'start', label: 'start', x: 4.0, y: 3.0, note: 'thread' },
      { id: 'lock', label: 'lock', x: 5.7, y: 1.3, note: 'monitor' },
      { id: 't2v', label: 'V read', x: 5.7, y: 3.0, note: 'flag' },
      { id: 't2r', label: 'T2 r', x: 7.3, y: 2.0, note: 'x?' },
      { id: 'obs', label: 'observes', x: 8.6, y: 3.6, note: 'write id' },
      { id: 'ledger', label: 'trace', x: 9.5, y: 2.0, note: 'JMM' },
    ],
    edges: [
      { id: 'e-t1w-t1v', from: 't1w', to: 't1v' },
      { id: 'e-t1v-t2v', from: 't1v', to: 't2v' },
      { id: 'e-unlock-lock', from: 'unlock', to: 'lock' },
      { id: 'e-start-t2r', from: 'start', to: 't2r' },
      { id: 'e-lock-t2r', from: 'lock', to: 't2r' },
      { id: 'e-t2v-t2r', from: 't2v', to: 't2r' },
      { id: 'e-t2r-obs', from: 't2r', to: 'obs' },
      { id: 'e-obs-ledger', from: 'obs', to: 'ledger' },
      { id: 'e-t1w-ledger', from: 't1w', to: 'ledger' },
    ],
  }, { title });
}

function verifierGraph(title) {
  return graphState({
    nodes: [
      { id: 'actions', label: 'actions', x: 0.8, y: 3.4, note: 'reads/writes' },
      { id: 'po', label: 'program', x: 2.3, y: 1.8, note: 'order' },
      { id: 'sync', label: 'sync', x: 2.3, y: 5.0, note: 'locks/vol' },
      { id: 'hb', label: 'HB graph', x: 4.1, y: 3.4, note: 'closure' },
      { id: 'read', label: 'read map', x: 5.9, y: 2.0, note: 'sees' },
      { id: 'race', label: 'race set', x: 5.9, y: 4.8, note: 'unsafe' },
      { id: 'valid', label: 'validity', x: 7.6, y: 3.4, note: 'JMM' },
      { id: 'train', label: 'train set', x: 9.1, y: 3.4, note: 'filtered' },
    ],
    edges: [
      { id: 'e-actions-po', from: 'actions', to: 'po' },
      { id: 'e-actions-sync', from: 'actions', to: 'sync' },
      { id: 'e-po-hb', from: 'po', to: 'hb' },
      { id: 'e-sync-hb', from: 'sync', to: 'hb' },
      { id: 'e-hb-read', from: 'hb', to: 'read' },
      { id: 'e-hb-race', from: 'hb', to: 'race' },
      { id: 'e-read-valid', from: 'read', to: 'valid' },
      { id: 'e-race-valid', from: 'race', to: 'valid' },
      { id: 'e-valid-train', from: 'valid', to: 'train' },
    ],
  }, { title });
}

function* happensBeforeGraph() {
  yield {
    state: hbGraph('JVM traces need synchronization edges'),
    highlight: { active: ['t1w', 't1v', 't2v', 't2r', 'e-t1w-t1v', 'e-t1v-t2v', 'e-t2v-t2r'], found: ['ledger'] },
    explanation: 'For Java concurrency, a useful trace is not just interleaved lines. It records memory actions, program-order edges, synchronization actions, and which write each read observes.',
  };

  yield {
    state: labelMatrix(
      'Common happens-before edge sources',
      [
        { id: 'po', label: 'program' },
        { id: 'mon', label: 'monitor' },
        { id: 'vol', label: 'volatile' },
        { id: 'start', label: 'start' },
        { id: 'join', label: 'join' },
      ],
      [
        { id: 'source', label: 'source' },
        { id: 'edge', label: 'edge' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['same T', 'a before b', 'ordered'],
        ['unlock', 'to lock', 'visible'],
        ['write', 'to read', 'visible'],
        ['parent', 'to child', 'ordered'],
        ['child', 'to joiner', 'ordered'],
      ],
    ),
    highlight: { active: ['mon:edge', 'vol:edge', 'start:edge', 'join:edge'], found: ['vol:effect'] },
    explanation: 'The trace must distinguish ordinary program order from synchronization order. A volatile write-to-read edge means the later read must see effects that happened before the write.',
    invariant: 'Visibility is a graph property, not a timestamp guess.',
  };

  yield {
    state: hbGraph('Volatile flag publication carries prior writes'),
    highlight: { active: ['t1w', 't1v', 't2v', 't2r', 'e-t1w-t1v', 'e-t1v-t2v', 'e-t2v-t2r', 'e-t1w-ledger'], found: ['obs'] },
    explanation: 'If T1 writes x and then writes a volatile flag, T2 reading that flag creates a happens-before path. A world-model trace should show why T2 reading x is no longer unconstrained.',
  };

  yield {
    state: labelMatrix(
      'Read observations need proof context',
      [
        { id: 'r1', label: 'read x' },
        { id: 'r2', label: 'read flag' },
        { id: 'r3', label: 'read list' },
        { id: 'r4', label: 'read final' },
      ],
      [
        { id: 'sees', label: 'sees' },
        { id: 'proof', label: 'proof' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['write id', 'HB path', 'ok'],
        ['vol write', 'sync', 'ok'],
        ['old write', 'no HB', 'race'],
        ['ctor write', 'final rule', 'safe pub'],
      ],
    ),
    highlight: { active: ['r1:proof', 'r2:proof', 'r4:proof'], removed: ['r3:risk'] },
    explanation: 'A read value alone is ambiguous. The trace should store the write id it observed and the proof that the observation is valid under the memory model.',
  };

  yield {
    state: verifierGraph('The verifier filters impossible concurrent traces'),
    highlight: { active: ['actions', 'po', 'sync', 'hb', 'read', 'valid', 'train', 'e-actions-po', 'e-actions-sync', 'e-po-hb', 'e-sync-hb', 'e-read-valid', 'e-valid-train'], compare: ['race'] },
    explanation: 'A JVM trace factory needs a memory-model verifier. It builds the happens-before graph, checks each read-observed-write relation, marks data races, and only promotes traces whose observations are legal.',
  };
}

function* readValidity() {
  yield {
    state: plotState({
      axes: { x: { label: 'trace fields captured', min: 0, max: 6 }, y: { label: 'bugs explained', min: 0, max: 6 } },
      series: [
        { id: 'values', label: 'value-only trace', points: [{ x: 1, y: 1 }, { x: 2, y: 1.2 }, { x: 3, y: 1.4 }, { x: 4, y: 1.5 }] },
        { id: 'memory', label: 'JMM trace', points: [{ x: 1, y: 1 }, { x: 2, y: 2.2 }, { x: 3, y: 3.5 }, { x: 4, y: 4.7 }, { x: 5, y: 5.4 }] },
      ],
      markers: [
        { id: 'gap', x: 4, y: 4.7, label: 'visibility gap' },
      ],
    }),
    highlight: { active: ['memory', 'gap'], compare: ['values'] },
    explanation: 'A value-only trace can say a read returned 0. It cannot explain whether returning 0 was legal, surprising, racy, or impossible. The JMM trace adds synchronization and observed-write structure.',
  };

  yield {
    state: labelMatrix(
      'Classic stale-read case',
      [
        { id: 'wdata', label: 'write data' },
        { id: 'wflag', label: 'write flag' },
        { id: 'rflag', label: 'read flag' },
        { id: 'rdata', label: 'read data' },
      ],
      [
        { id: 'nohb', label: 'no HB' },
        { id: 'withhb', label: 'with HB' },
      ],
      [
        ['T1 data=42', 'T1 data=42'],
        ['plain flag', 'volatile flag'],
        ['may see true', 'sees volatile'],
        ['may see 0', 'must see 42'],
      ],
    ),
    highlight: { removed: ['rdata:nohb'], found: ['rdata:withhb'], active: ['wflag:withhb', 'rflag:withhb'] },
    explanation: 'The same source code shape can produce different guarantees depending on synchronization. A trace should encode the flag as plain or volatile, because that changes the valid read set.',
  };

  yield {
    state: hbGraph('No happens-before path leaves reads unconstrained'),
    highlight: { active: ['t1w', 't2r', 'obs', 'e-t2r-obs'], compare: ['t1v', 't2v'], removed: ['e-t1v-t2v'] },
    explanation: 'If the synchronization edge is absent, the read may observe an older write. That is not a renderer artifact or an unlucky schedule; it is exactly the kind of memory-model fact the trace must teach.',
  };

  yield {
    state: labelMatrix(
      'Do not compress away synchronization',
      [
        { id: 'volatile', label: 'volatile' },
        { id: 'lock', label: 'lock' },
        { id: 'start', label: 'start' },
        { id: 'join', label: 'join' },
        { id: 'final', label: 'final' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'keep', label: 'keep as' },
      ],
      [
        ['visibility', 'sync edge'],
        ['mutual excl', 'monitor'],
        ['spawn edge', 'event'],
        ['finish edge', 'event'],
        ['safe pub', 'field fact'],
      ],
    ),
    highlight: { active: ['volatile:keep', 'lock:keep', 'final:keep'], found: ['join:keep'] },
    explanation: 'Trace compression that drops synchronization can turn a legal trace into nonsense. Volatile accesses, monitor edges, thread lifecycle events, and final-field facts belong in the compressed representation.',
  };

  yield {
    state: verifierGraph('A concurrent trace is a candidate plus a legality proof'),
    highlight: { active: ['actions', 'hb', 'read', 'race', 'valid', 'train', 'e-hb-read', 'e-hb-race', 'e-read-valid', 'e-race-valid', 'e-valid-train'] },
    explanation: 'For JVM world models, the example is not "thread 2 read 42." The example is the action graph plus a legal-observation proof. That is what makes concurrent traces trainable rather than folklore.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'happens-before graph') yield* happensBeforeGraph();
  else if (view === 'read validity') yield* readValidity();
  else throw new InputError('Pick a JVM trace view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A JVM happens-before execution trace is a domain-specific trace for concurrent Java programs. It records reads, writes, volatile accesses, monitor locks and unlocks, thread start and join events, program-order edges, synchronization edges, and the write observed by each read. The point is to teach a model what concurrent code can legally observe, not merely which line happened to run next.',
        'The Java Language Specification defines the memory model in exactly this trace-oriented way: given a program and an execution trace, decide whether the trace is a legal execution by checking what writes reads may observe. The relevant specification is JLS 17.4: https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The trace first records actions: normal reads and writes, volatile reads and writes, lock and unlock actions, and thread lifecycle actions. It then builds happens-before edges from program order and synchronization. A volatile write happens-before a subsequent volatile read of the same variable. An unlock happens-before a subsequent lock on the same monitor. A thread start orders the parent before the child. A join orders the child before the joiner.',
        'Each read is then checked against the write it observed. A value-only trace is not enough, because the same read value can be legal, racy, stale, or impossible depending on the happens-before graph. Java concurrency package documentation also exposes memory-consistency effects to users: https://docs.oracle.com/javase/tutorial/essential/concurrency/memconsist.html.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Thread 1 writes data = 42 and then writes ready = true. Thread 2 waits until ready and then reads data. If ready is a plain field, Thread 2 can observe ready as true while still seeing old data. If ready is volatile, the volatile write-to-read edge carries prior writes, so Thread 2 must observe the data write. The source text looks nearly identical. The trace differs by one synchronization edge.',
        'A concurrent world-model dataset should store that edge. Without it, a model can memorize examples and still fail at the real concept: visibility. With it, the model can learn that the verifier checks observed-write legality under the memory model.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not turn concurrent traces into wall-clock order. Wall-clock order does not define visibility. Do not drop volatile, lock, start, join, final-field, or interrupt facts during compression. Do not train on racy traces without labeling them as racy. Do not expect Python execution traces to transfer to JVM concurrency without a memory-model verifier.',
        'Primary sources: JLS 17 Threads and Locks at https://docs.oracle.com/javase/specs/jls/se8/html/jls-17.html and Oracle Java Tutorials on memory consistency errors at https://docs.oracle.com/javase/tutorial/essential/concurrency/memconsist.html. Study Code World Models Case Study, Execution Trace State Diff Case Study, Rust Borrow Checker Ownership Trace, Logical Clocks, Lock-Free Queue, Sequence Locks, Distributed Snapshot & Consistent Cut, and Hazard Pointers & Epoch Reclamation next.',
      ],
    },
  ],
};
