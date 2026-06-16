// Differential dataflow: maintain query results as streams of signed
// differences indexed by time, key, and arrangement traces.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'differential-dataflow-incremental-view-case-study',
  title: 'Differential Dataflow Incremental View Case Study',
  category: 'Papers',
  summary: 'Maintain materialized results with signed differences, indexed arrangements, logical frontiers, and trace compaction instead of recomputing full views.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['arrangements and deltas', 'frontiers and compaction'], defaultValue: 'arrangements and deltas' },
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

function dataflowGraph(title) {
  return graphState({
    nodes: [
      { id: 'updates', label: 'input diffs', x: 0.7, y: 3.5, note: '(data,time,diff)' },
      { id: 'map', label: 'map/filter', x: 2.3, y: 2.0, note: 'stateless' },
      { id: 'orders', label: 'orders arrangement', x: 4.2, y: 1.4, note: 'keyed trace' },
      { id: 'users', label: 'users arrangement', x: 4.2, y: 4.9, note: 'keyed trace' },
      { id: 'join', label: 'join', x: 6.2, y: 3.1, note: 'indexed lookup' },
      { id: 'reduce', label: 'reduce/count', x: 7.7, y: 2.0, note: 'incremental' },
      { id: 'view', label: 'materialized view', x: 9.0, y: 3.5, note: 'current result' },
      { id: 'frontier', label: 'frontier', x: 6.4, y: 5.4, note: 'progress' },
    ],
    edges: [
      { id: 'e-updates-map', from: 'updates', to: 'map', weight: 'stream' },
      { id: 'e-map-orders', from: 'map', to: 'orders', weight: 'orders' },
      { id: 'e-map-users', from: 'map', to: 'users', weight: 'users' },
      { id: 'e-orders-join', from: 'orders', to: 'join', weight: 'lookup' },
      { id: 'e-users-join', from: 'users', to: 'join', weight: 'lookup' },
      { id: 'e-join-reduce', from: 'join', to: 'reduce', weight: 'diffs' },
      { id: 'e-reduce-view', from: 'reduce', to: 'view', weight: 'updates' },
      { id: 'e-frontier-join', from: 'frontier', to: 'join', weight: 'progress' },
      { id: 'e-frontier-reduce', from: 'frontier', to: 'reduce', weight: 'compact' },
    ],
  }, { title });
}

function compactionGraph(title) {
  return graphState({
    nodes: [
      { id: 'trace', label: 'arranged trace', x: 0.9, y: 3.6, note: 'history' },
      { id: 'old', label: 'old times', x: 2.7, y: 2.0, note: 'less than frontier' },
      { id: 'frontier', label: 'frontier', x: 4.8, y: 3.6, note: 'no earlier updates' },
      { id: 'merge', label: 'consolidate', x: 6.6, y: 2.0, note: 'same key/time' },
      { id: 'compact', label: 'compacted trace', x: 8.4, y: 3.6, note: 'smaller history' },
      { id: 'query', label: 'queries', x: 6.6, y: 5.4, note: 'still correct' },
    ],
    edges: [
      { id: 'e-trace-old', from: 'trace', to: 'old', weight: 'candidate' },
      { id: 'e-old-frontier', from: 'old', to: 'frontier', weight: 'safe?' },
      { id: 'e-frontier-merge', from: 'frontier', to: 'merge', weight: 'allow' },
      { id: 'e-merge-compact', from: 'merge', to: 'compact', weight: 'rewrite' },
      { id: 'e-compact-query', from: 'compact', to: 'query', weight: 'serve' },
      { id: 'e-query-frontier', from: 'query', to: 'frontier', weight: 'holds back' },
    ],
  }, { title });
}

function* arrangementsAndDeltas() {
  yield {
    state: labelMatrix(
      'Collections are streams of signed differences',
      [
        { id: 'u0', label: 'u1' },
        { id: 'u1', label: 'u2' },
        { id: 'u2', label: 'u3' },
        { id: 'u3', label: 'u4' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'time', label: 'time' },
        { id: 'diff', label: 'diff' },
      ],
      [
        ['u7=CA', 't10', '+1'],
        ['o91->u7', 't11', '+1'],
        ['u7=NY', 't12', '+1'],
        ['u7=CA', 't12', '-1'],
      ],
    ),
    highlight: { active: ['u0:diff', 'u3:diff'], found: ['u2:data'], compare: ['u1:time'] },
    explanation: 'Differential dataflow represents change directly. A collection is not just a set of rows; it is a multiset of signed differences at logical times. Insertions are positive, deletions or retractions are negative.',
    invariant: 'The current value is the sum of differences visible at the query time.',
  };

  yield {
    state: dataflowGraph('Operators transform differences instead of full tables'),
    highlight: { active: ['updates', 'map', 'orders', 'users', 'e-updates-map'], compare: ['view'] },
    explanation: 'A dataflow graph receives differences and pushes only the consequences of those differences through map, filter, join, and reduce operators. Work scales with the change when the plan and indexes cooperate.',
  };

  yield {
    state: labelMatrix(
      'Arrangements are indexed traces for reuse',
      [
        { id: 'a0', label: 'OU' },
        { id: 'a1', label: 'UI' },
        { id: 'a2', label: 'OR' },
        { id: 'a3', label: 'VR' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'payload', label: 'value' },
        { id: 'reuse', label: 'reuse' },
      ],
      [
        ['uid', 'ord,t', 'join'],
        ['uid', 'reg,t', 'join'],
        ['reg', 'ord,t', 'group'],
        ['reg', 'cnt', 'serve'],
      ],
    ),
    highlight: { active: ['a0:key', 'a1:key', 'a0:reuse', 'a1:reuse'], found: ['a3:reuse'] },
    explanation: 'An arrangement is an indexed trace of a collection. Joins and reductions need repeated lookup by key, so the system stores differences in an index rather than scanning all history every time.',
  };

  yield {
    state: labelMatrix(
      'One changed user updates the downstream view',
      [
        { id: 'old', label: 'O' },
        { id: 'new', label: 'N' },
        { id: 'joinOld', label: 'JO' },
        { id: 'joinNew', label: 'JN' },
      ],
      [
        { id: 'inputDiff', label: 'input' },
        { id: 'outputDiff', label: 'view' },
      ],
      [
        ['CA -1', 'CA -2'],
        ['NY +1', 'NY +2'],
        ['2 ord', 'undo'],
        ['2 ord', 'add'],
      ],
    ),
    highlight: { active: ['old:outputDiff', 'new:outputDiff'], found: ['joinOld:inputDiff', 'joinNew:inputDiff'] },
    explanation: 'If user 7 moves from CA to NY and has two orders, the maintained view does not recompute all regions. It retracts the two CA contributions and adds two NY contributions.',
  };
}

function* frontiersAndCompaction() {
  yield {
    state: dataflowGraph('Frontiers describe progress through logical time'),
    highlight: { active: ['frontier', 'join', 'reduce', 'e-frontier-join', 'e-frontier-reduce'], compare: ['updates'] },
    explanation: 'A frontier says which logical times might still receive more input. When the frontier advances beyond time t, operators know no more updates for times before t can arrive.',
  };

  yield {
    state: labelMatrix(
      'Frontier interpretation',
      [
        { id: 'f0', label: 'F10' },
        { id: 'f1', label: 'F13' },
        { id: 'f2', label: 'F13x' },
        { id: 'f3', label: 'end' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'safeAction', label: 'safe' },
      ],
      [
        ['may >=10', 'hold'],
        ['none <13', 'compact'],
        ['partial', 'both'],
        ['closed', 'final'],
      ],
    ),
    highlight: { active: ['f1:means', 'f1:safeAction'], found: ['f2:means'], compare: ['f0:safeAction'] },
    explanation: 'Frontiers generalize watermarks. They are precise enough for partially ordered logical times, loops, and nested iteration, where a single scalar timestamp may not capture progress.',
    invariant: 'Compaction is safe only for times the frontier has passed.',
  };

  yield {
    state: compactionGraph('Trace compaction keeps history useful but bounded'),
    highlight: { active: ['trace', 'old', 'frontier', 'merge', 'compact'], found: ['query'] },
    explanation: 'Arranged traces can grow without bound if every old difference remains distinct. Once frontiers advance, equivalent old times can be consolidated so future queries still get correct answers with less history.',
  };

  yield {
    state: labelMatrix(
      'Materialized view maintenance ledger',
      [
        { id: 'correctness', label: 'ok' },
        { id: 'latency', label: 'lat' },
        { id: 'memory', label: 'mem' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'trackedBy', label: 'trk' },
        { id: 'failureMode', label: 'fail' },
      ],
      [
        ['D+F', 'miss'],
        ['deltas', 'fanout'],
        ['arr', 'grow'],
        ['diag', 'stuck'],
      ],
    ),
    highlight: { found: ['correctness:trackedBy', 'memory:trackedBy'], active: ['ops:failureMode'], compare: ['latency:failureMode'] },
    explanation: 'A production incremental view is a ledger: signed diffs for correctness, arrangements for fast lookup, frontiers for progress, compaction for memory, and diagnostics for stuck operators.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'arrangements and deltas') yield* arrangementsAndDeltas();
  else if (view === 'frontiers and compaction') yield* frontiersAndCompaction();
  else throw new InputError('Pick a differential-dataflow view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Differential dataflow is an incremental computation model for maintaining results as inputs change. Instead of recomputing a complete query result, the system represents inputs and intermediate collections as streams of signed differences at logical times, then updates downstream results by propagating only the consequences of those differences.',
        'This case study connects Streaming Watermarks, Google Dataflow Model Case Study, MillWheel Streaming Case Study, Distributed Snapshot & Consistent Cut, Flink Checkpointing Case Study, and Database Indexing. The new ideas are signed difference collections, partially ordered logical times, indexed arrangements, frontiers, and trace compaction.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A collection is represented by triples such as data, time, and diff. The diff is often +1 for an insertion and -1 for a retraction. The value of a collection at a time is recovered by summing the relevant differences. Operators such as map and filter transform diffs directly; joins and reductions usually need indexed state.',
        'Arrangements are the key data structure. An arrangement is an indexed trace of differences by key and time. A join can look up matching records in the opposing arrangement instead of scanning the full input. A reduce can maintain grouped state and emit only the changed aggregate result.',
        'Frontiers track progress. When an input frontier advances, the system learns that no more updates before that logical time can arrive. That unlocks compaction: old differences can be consolidated while preserving query answers for future times.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The system trades recomputation for maintained indexed history. That is powerful when changes are small and queries reuse arrangements, but it can be expensive when one input change fans out to many joined rows or when frontiers get stuck and prevent compaction.',
        'Memory is the operational edge. Arrangements and traces must retain enough history to answer future updates correctly. If a downstream reader, long-running transaction, or iterative computation holds back a frontier, traces cannot compact as aggressively. The result can be rising memory even when input rate is stable.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A streaming database maintains a materialized view: count orders by customer region. Inputs are users(id, region) and orders(id, user_id). If a user changes region, the system emits a negative diff for the old user-region row and a positive diff for the new row. The orders-by-user arrangement finds that user\'s orders, and the output view receives negative counts for the old region and positive counts for the new region.',
        'The view changes immediately without recomputing all users and orders. If the user has two orders, the update is small. If the user has ten million orders, the update has huge fanout. Differential dataflow makes the dependency explicit; it does not make bad keys free.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is that incremental means always cheap. Incremental maintenance can be dramatically faster than full recompute, but worst-case delta fanout still exists. Another mistake is treating frontiers like wall-clock time. A frontier is a logical progress statement made by the dataflow, and a single stuck input can hold back compaction for large parts of the graph.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Differential Dataflow paper at https://www.cidrdb.org/cidr2013/Papers/CIDR13_Paper111.pdf, Microsoft Research publication page at https://www.microsoft.com/en-us/research/publication/differential-dataflow/, Differential Dataflow project documentation at https://timelydataflow.github.io/differential-dataflow/, and Materialize\'s explanatory build-from-scratch article at https://materialize.com/blog/differential-from-scratch/. Study Streaming Watermarks, Google Dataflow Model Case Study, MillWheel Streaming Case Study, Flink Checkpointing Case Study, Database Indexing, and Materialized View concepts next.',
      ],
    },
  ],
};
