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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the arrangement view as an incremental table, not as a full recomputation. Positive differences add rows, negative differences retract rows, and logical time says when the change is visible. The frontier view shows when no more earlier updates can arrive, which is the condition that makes compaction safe.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many systems maintain a result that changes a little while the total data set is huge. A dashboard, recommendation graph, fraud view, or search index may receive one correction while depending on billions of older records. Differential dataflow exists to update the result by processing the change, not by rerunning the whole query.',
        {type: 'callout', text: 'The maintained view is a ledger of signed changes plus indexed history, with frontiers deciding when old detail can safely disappear.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is full recomputation. When an input changes, run the query again over the current table and replace the old result. This is simple and correct, and it works while the table is small or updates are rare.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that latency grows with total history instead of with the size of the change. Updating one user region should not require rescanning every user and every order. Joins, reductions, and iterative graph computations make the waste worse because the same old state is rediscovered on every run.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent collections as signed differences at logical times. A row with weight +1 inserts a fact, and a row with weight -1 retracts it. Operators transform differences through the dataflow graph while arrangements, which are indexed traces, keep reusable history available by key.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each operator receives batches of differences and emits only the consequences of those differences. A join probes arranged state by key instead of scanning both inputs, and a reduce updates the affected group instead of all groups. Frontiers track progress so the system knows when old times can be consolidated without changing future answers.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant is summation. The value of a collection at time t is the sum of all signed differences visible at t. Compaction is correct only after the frontier has passed a time, because no future input can still distinguish the old detailed timestamps being merged.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The target cost is proportional to the changed keys and their affected joins, not to the full table size. If one user update touches 2 orders, the region summary should process 2 retractions and 2 insertions, not 100 million orders. The tax is memory for arrangements, bookkeeping for logical time, and complicated behavior when frontiers get stuck.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Differential dataflow fits materialized views, streaming analytics, incremental search indexes, graph algorithms, and systems where corrections and retractions matter. It is useful when queries reuse state by key and the workload needs low-latency updates. It is especially strong for joins and iterative computations where naive streaming systems lose track of old dependencies.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the maintained state is larger than the value of incremental updates. Random high-cardinality keys can make arrangements expensive, and stuck frontiers can prevent compaction so traces grow without bound. It also raises the implementation bar because negative differences, logical time, and partial orders are harder to debug than append-only streams.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the maintained view is orders by user region. User 7 moves from CA to NY and has 2 orders worth 30 and 70. The update emits -30 and -70 for CA, then +30 and +70 for NY, changing only the affected region totals.',
        'With concrete totals, CA was 1,000 and NY was 500. After the differences, CA becomes 900 and NY becomes 600. A full recompute over 10 million orders would still produce those numbers, but the incremental path did 4 contribution updates plus index lookups.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the Differential Dataflow paper, Timely Dataflow material, and Materialize documentation on arrangements and frontiers. Then study incremental view maintenance, multiset semantics, dataflow graphs, watermarks, logical time, and trace compaction. The key contrast is append-only stream processing versus signed updates that can correct prior results.',
      ],
    },
  ],
};
