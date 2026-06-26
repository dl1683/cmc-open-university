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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as a proof of visibility, not as a wall-clock timeline. A node is a memory or synchronization action. An edge means one action happens-before another under the Java Memory Model, which is the language rule that defines legal visibility between threads.',
        'Active edges are the ordering facts currently being used. Found nodes mark reads whose observed write can be explained. Compare nodes show what a value-only trace misses when it records values but not the synchronization edges that make those values legal or illegal.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Concurrent Java programs do not run under the simple rule that later code must see earlier writes from another thread. A thread can write a value, another thread can run later, and the second thread may still legally see an old value if the program did not create the right synchronization relationship.',
        'A happens-before trace records ordinary reads and writes, volatile accesses, monitor lock and unlock actions, thread start and join actions, program-order edges, synchronization edges, and the write observed by each read. The goal is to explain which observations are legal under the Java Memory Model.',
        {type:'callout', text:'A happens-before trace explains concurrency by recording the synchronization edges that make a read legal, not just the wall-clock order that made it surprising.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a line log: timestamp, thread id, source location, variable, and value. That can show Thread 1 wrote x = 1, Thread 2 read x = 0, and an assertion failed. It can help reproduce a schedule.',
        'The log still cannot say whether the read was legal. It cannot explain why adding volatile, synchronized, Thread.start, or join changes the result. It records symptoms but not the memory-model proof.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is visibility. Java does not define concurrency by one global timeline of source lines. It defines legal executions through actions, synchronization order, happens-before edges, and constraints on which writes a read may observe.',
        'A value-only trace cannot distinguish a surprising but legal stale read from an impossible observation caused by bad instrumentation. It also cannot label data races, where conflicting ordinary accesses are not ordered by happens-before.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Visibility is a graph property. Program order creates edges inside one thread. Synchronization creates edges across threads, such as volatile write to later volatile read of the same variable, unlock to later lock on the same monitor, start edges into a new thread, and join edges from a completed thread.',
        'The transitive closure of those edges is the happens-before relation. If write A happens-before read B and no allowed intervening write changes the variable, B is constrained by A. If no path exists, the read may be freer than timestamp intuition suggests.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First, instrumentation records actions with stable ids: ordinary reads and writes, volatile reads and writes, monitor enters and exits, thread lifecycle events, and source spans. Each read also records the write it observed, often called the read-from relation.',
        'Second, a verifier builds edges. Program order links actions in the same thread. Synchronization rules add cross-thread edges. The verifier then answers reachability questions in the happens-before graph and checks whether each read-from choice is allowed.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because the trace stores the same kinds of facts the Java Memory Model uses. A read is not justified only by the value it returned. It is justified by whether the observed write is one the memory model permits that read to see.',
        'Correctness depends on a trace invariant: every read names its observed write, and the graph preserves enough ordering facts to decide legality. If a later write is ordered between the observed write and the read, the older write may be forbidden. If the accesses are unordered and conflicting, the trace should label the race.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost grows with action count, synchronization count, variables, and read checks. A trace with 100,000 actions and 20,000 reads needs compact action ids, per-variable write histories, synchronization edges, and enough reachability support to validate reads.',
        'Cost behaves like explanation power. A value log is smaller, but it cannot answer whether a read was allowed. A memory-model trace is heavier, but it can support debuggers, test reducers, replay systems, and training datasets that need the reason, not only the value.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This trace helps concurrency debuggers explain stale reads, incorrect locks, volatile mistakes, and bad publication. It helps deterministic replay systems preserve the observations that matter, not just a rough thread schedule.',
        'It also helps education and code-world-model datasets. Students and models often overuse temporal intuition. A happens-before trace teaches the actual rule: ran later is not the same thing as must see.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when instrumentation misses a decisive event such as a volatile access, monitor action, start, join, interrupt ordering fact, or final-field publication fact. One missing edge can change whether a read is legal.',
        'It also fails outside its language contract. Java, C++, Rust, JavaScript, and Python have different memory and execution rules. A JVM trace design can inspire other systems, but each language needs its own verifier semantics.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Thread 1 writes data = 42 and then writes ready = true. Thread 2 reads ready and, if it sees true, reads data. If ready is an ordinary field, Thread 2 may see ready = true and still read old data in a racy program, because no synchronization edge carries the data write to the data read.',
        'Now make ready volatile. The write to ready synchronizes with the read of ready that sees true. Program order puts data = 42 before the volatile write, and program order puts the volatile read before the data read. By transitivity, data = 42 happens-before the data read, so reading the old data value is not legal for that synchronized execution.',
        'The trace needs four key facts: the data write, the volatile write, the volatile read that observed it, and the data read. A timestamp log with only values would miss the edge that makes 42 required.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Java Language Specification section 17, especially the memory model and happens-before rules, plus JVM and concurrency testing documentation. Study data races, volatile, monitor locks, thread lifecycle edges, final-field safe publication, deterministic replay, and distributed snapshots next.',
        'A useful exercise is to draw the graph for the data/ready example twice: once with ordinary ready and once with volatile ready. Then mark which reads are constrained by a happens-before path and which remain racy.',
      ],
    },
  ],
};