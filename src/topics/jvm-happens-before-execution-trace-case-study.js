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
      heading: 'Why This Exists',
      paragraphs: [
        'Concurrent Java programs do not run under the simple story most beginners imagine. One thread can write a value, another thread can run later, and the second thread may still be allowed to see an older value unless the program created the right synchronization relationship.',
        'A JVM happens-before trace exists to make that relationship explicit. It records ordinary reads and writes, volatile accesses, monitor actions, thread lifecycle actions, program-order edges, synchronization edges, and the write observed by each read. The point is not just replaying source lines. The point is explaining which observations are legal under the Java Memory Model.',
        'This matters for debuggers, concurrency tests, deterministic replay, trace-based education, and code-world-model datasets. A model trained on value logs can memorize interleavings while missing the actual rule: visibility is controlled by happens-before relationships, not by wall-clock intuition.',
      ],
    },
    {
      heading: 'The Baseline And The Wall',
      paragraphs: [
        'The baseline trace is a line log: timestamp, thread id, source location, variable, and value. That log is useful. It can show that Thread 1 wrote `x = 1`, Thread 2 read `x = 0`, and the assertion failed. It can help reproduce a schedule.',
        'The wall is visibility. A value-only log cannot tell whether reading 0 was legal, surprising but allowed, impossible under the memory model, or allowed only because the program had a data race. It also cannot explain why adding `volatile`, `synchronized`, `Thread.start`, or `join` changes the result.',
        'Java does not define concurrency by a single global timeline of source lines. It defines legal executions through actions, synchronization order, happens-before edges, and constraints on which writes a read may observe. A serious trace has to carry those facts.',
      ],
    },
    {
      heading: 'Core Insight And Invariant',
      paragraphs: [
        'The core insight is that visibility is a graph property. Program order creates edges inside one thread. Synchronization creates edges across threads: a volatile write to a later volatile read of the same variable, an unlock to a later lock on the same monitor, a parent action to a started thread, a completed thread to a successful join, and final-field rules under safe construction.',
        'The transitive closure of those edges is the happens-before graph. If action A happens-before action B, then the effects of A must be visible to B where the variable rules require it. If there is no path, the read may have more freedom than a timestamp log suggests.',
        'The invariant for the trace is this: every read must name the write it observed, and the trace must preserve enough happens-before structure to decide whether that observation is legal. A value without an observed-write relation is only a symptom.',
      ],
    },
    {
      heading: 'How The Visual Model Teaches It',
      paragraphs: [
        'The happens-before graph view highlights the difference between a schedule and a proof. The volatile flag, monitor edge, start edge, and program-order edges are not decoration. They are the reasons one action can force visibility at another action.',
        'The read-validity view compares a value-only record with a memory-model record. A value-only record can say that a read returned 0. The richer record can say whether 0 was legal, illegal, or legal because no synchronization ruled it out.',
        'The useful habit is to follow paths, not screen position. If a write reaches a read through happens-before edges, the read is constrained. If the path is missing, the read may be allowed to observe an older write, and the trace should label that fact instead of treating it as random behavior.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'First, the trace records actions. Ordinary reads and writes matter. Volatile reads and writes matter. Lock and unlock actions matter. Thread start and join events matter. Final-field facts matter when safe publication is part of the explanation. Each action receives an ID so later proof steps can refer to it.',
        'Second, a verifier builds edges. Program order links actions in the same thread. Synchronization rules create cross-thread edges. The verifier computes the happens-before closure or an equivalent reachability structure so it can answer whether one action must be visible to another.',
        'Third, the verifier checks the read-from map. Each read points to the write it observed. For each variable, the verifier asks whether that write is allowed or whether another write is forced between the observed write and the read. The trace can then mark the observation legal, illegal, or racy.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'It works because it follows the shape of the Java Memory Model. The JMM is not merely an implementation note about CPUs. It is the language-level contract that says which executions are legal. By storing actions, edges, and observed writes, the trace becomes a checkable object under that contract.',
        'A read is not validated only by the value it returned. It is validated by the set of writes that the memory model allows it to observe. If a later write to the same variable is ordered between the observed write and the read, the older observed write may be forbidden. If no ordering exists, the read may be unconstrained by happens-before.',
        'Data races are not swept under the rug. If two conflicting ordinary accesses are not ordered by happens-before, the trace should label the race. That label is essential because racy examples can be legal while still teaching a different lesson from properly synchronized examples.',
      ],
    },
    {
      heading: 'Concrete Example',
      paragraphs: [
        'Consider two fields, `data` and `ready`. Thread 1 writes `data = 42`, then writes `ready = true`. Thread 2 loops until it sees `ready`, then reads `data`. This is the classic publication pattern.',
        'If `ready` is an ordinary field, Thread 2 may observe `ready = true` and still read an old value of `data` in a racy program. A line log makes that look strange because the data write appears earlier. The happens-before trace explains the gap: there is no synchronization edge carrying the data write to the data read.',
        'If `ready` is volatile, the write to `ready` synchronizes with the read of `ready` that sees it. Program order puts `data = 42` before the volatile write, and program order puts the volatile read before the data read. The transitive happens-before path now carries the data write, so reading the old data value is not a valid observation for that synchronized execution.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The cost grows with the number of actions, variables, synchronization events, and read checks. A small concurrent program with many locks or volatile fields can produce a dense proof graph. A long single-threaded log can be large but conceptually simple.',
        'A practical trace format needs compact action IDs, per-variable write histories, synchronization edges, race labels, source spans, and enough thread context to explain the result. It should avoid storing redundant closure data when reachability can be computed, but it must not drop the facts that define visibility.',
        'The tradeoff is between size and explanation power. A value-only log is smaller and easier to collect. A memory-model trace is heavier, but it can answer the question that matters: was this read allowed, and why?',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'It wins for concurrency debuggers and race explainers. When a test fails, the developer needs to know whether the surprising value came from missing synchronization, a bad assumption about volatile, an incorrect lock, or an impossible trace produced by instrumentation error.',
        'It wins for deterministic replay and test-case reduction because it separates schedule from memory legality. A replay tool can reproduce a sequence of actions, while the verifier explains which observations have to be preserved for the replay to remain meaningful.',
        'It also wins for education and model training. Students and models both tend to overuse temporal intuition. A happens-before trace teaches the actual contract: "ran later" is not the same thing as "must see."',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails if instrumentation is incomplete. Missing a volatile access, monitor action, thread start, join, interrupt ordering fact, or final-field publication fact can change the legality result. The verifier may reject a legal run or accept an impossible one because the trace omitted a decisive edge.',
        'It fails if racy examples are not labeled. Races can be valuable data, but they teach different lessons from synchronized executions. If a dataset treats them as ordinary deterministic traces, a model may learn that stale reads are arbitrary quirks instead of consequences of missing happens-before edges.',
        'It also fails when applied outside its contract. Python, JavaScript, C++, Rust, and JVM languages have different memory and execution rules. A JVM trace format can inspire other systems, but each language needs its own verifier semantics.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Capture synchronization as first-class events, not as comments on reads and writes. Give every action a stable ID. Store the variable, thread, source span, action kind, and observed-write link. Keep enough metadata to reconstruct or query happens-before reachability.',
        'Validate traces before using them as training data. Build the happens-before graph, check read observations, label races, and reject traces that contradict the memory model. A trace corpus is only useful if illegal observations are filtered or clearly marked.',
        'Compress carefully. You can summarize repeated reads, collapse unimportant source context, or store sparse edges, but do not erase volatile actions, monitor edges, lifecycle edges, final-field facts, or read-from links. Those are the explanation.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Code World Models Case Study for execution-grounded training data and Execution Trace State Diff Case Study for state-transition records. Study Rust Borrow Checker Ownership Trace to compare a different language safety contract. Study Distributed Snapshot and Consistent Cut for graph-based reasoning about concurrent systems.',
        'Then study Sequence Lock, Hazard Pointers, and Epoch Reclamation. They show the same broader lesson from another angle: memory correctness is often a protocol over events, not a local property of one line of code. The primary language reference is JLS section 17 on threads, locks, and the Java Memory Model.',
      ],
    },
  ],
};
