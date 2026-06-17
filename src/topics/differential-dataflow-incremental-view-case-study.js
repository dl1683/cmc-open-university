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
      heading: 'Why this topic exists',
      paragraphs: [
        `Differential dataflow exists because many useful computations are too expensive to rerun from scratch after every small change. A dashboard, recommendation graph, fraud detector, search index, or materialized database view may receive a tiny update while depending on billions of older records. Recomputing the whole answer is easy to reason about, but it wastes work and creates latency that grows with total history rather than with the actual change.`,
        `The hard version is not just maintaining a simple count. Real computations join streams, retract old facts, run nested iteration, and need answers at logical times. A user can move from one region to another. An order can be corrected. A graph edge can appear and later disappear. Differential dataflow gives these systems a precise model: represent data as signed differences, route those differences through a dataflow graph, index reusable state, track progress with frontiers, and compact history when it is safe.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive batch approach stores tables, runs a query, writes the result, and runs the same query again after each update. This is correct if the input snapshot is correct, but it ignores the fact that most rows did not change. A one-row update can trigger a full scan, full join, and full aggregation. The user sees stale dashboards or the operator pays for constant recomputation.`,
        `The naive streaming approach pushes inserts forward but treats corrections and iteration as special cases. It can add new facts easily, but retractions are harder. If user 7 moves from California to New York, the view must undo all contributions that depended on the old region and add the new ones. If the system only knows current rows, it may not know which downstream results to retract. If it stores all history without progress information, memory grows without bound.`,
        `The naive materialized-view approach adds indexes and triggers by hand. That works for a few queries, but the logic becomes fragile when queries are composed. Each operator needs to know how to update its result from upstream changes, how to handle negative updates, and when old history can be forgotten. Differential dataflow turns that ad hoc trigger logic into a general computation model.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that a collection can be described by differences over time, not only by its current rows. A record with diff +1 inserts one copy. A record with diff -1 retracts one copy. The value of a collection at a logical time is the sum of all differences visible at that time. Operators do not need to rerun over full tables if they can transform input differences into output differences.`,
        `Time is part of the data structure. A difference is not just "row X changed." It is "row X changed at logical time t with weight d." Logical times can be partially ordered, which matters for loops and nested iteration. A dataflow can ask whether all inputs before some time are complete, whether old updates are still distinguishable, and whether two updates can be consolidated without changing future answers.`,
        `Arrangements complete the idea. An arrangement is an indexed trace of differences, usually keyed by the fields a downstream operator will need. Joins, reductions, and iterative operators can reuse arranged state instead of scanning all prior updates. Differential dataflow is therefore not only a timestamp trick. It is signed arithmetic plus indexed history plus progress tracking.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `Each input update enters the graph as a triple: data, time, diff. Stateless operators are simple. A map applies a function to the data and keeps the time and diff. A filter either forwards the same difference or drops it. Stateful operators need more structure. A join stores each side in an arrangement by key. When a difference arrives on one side, the join looks up matching records on the other side and emits the signed product of their differences.`,
        `A reduction maintains grouped state. If a user changes region and the view counts orders by region, the system retracts the old region contributions and adds the new region contributions. It does not need to recompute all regions. The update cost is proportional to the dependency fanout: how many downstream rows depend on the changed fact.`,
        `Frontiers describe progress. An input frontier says which logical times may still receive more updates. When the frontier has advanced beyond time t, operators know no future update for earlier times will arrive. This unlocks compaction. Old differences at times that no longer need to be distinguished can be merged into equivalent summaries. Without frontiers, the system would not know whether deleting or merging old history would break a future correction.`,
        `The runtime therefore maintains a ledger: differences for correctness, arrangements for lookup, frontiers for progress, and compaction rules for bounded memory. The user sees an incrementally maintained result. The operator sees a graph of indexed traces being updated over logical time.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `It works because the algebra is compositional. If every operator knows how to convert input differences into output differences, a whole dataflow graph can maintain its result by composition. Positive and negative weights let the system undo prior consequences instead of treating corrections as new special cases. Timestamps let the system keep multiple logical versions alive when necessary.`,
        `It also works because indexes turn history into a usable data structure. A join cannot be incremental if it must scan the entire opposite input for each update. An arrangement makes the relevant matches addressable by key. When multiple downstream operators need the same keyed view, the arrangement can be shared, which turns repeated query work into maintained state.`,
        `Compaction preserves the model over long-running workloads. Old differences are necessary only while future computation can still observe their exact times. Once a frontier proves that distinction no longer matters, the trace can consolidate equivalent records. The system keeps enough history to be correct and removes detail that no future answer can see.`,
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The visual proves that an incremental view is not one object. It is a chain of change propagation, indexed traces, and progress statements. The input-diffs node shows that changes are first-class records. The arrangements show that joins and reductions need reusable keyed state. The frontier node shows that memory management depends on knowing which times can still receive updates.`,
        `The compaction visual proves a subtle correctness point. The system cannot compact history merely because records are old in wall-clock time. It can compact only when the logical frontier has passed them. If a reader, loop, or delayed input holds the frontier back, old trace entries may remain necessary. That is why a production differential dataflow system needs progress diagnostics, not just throughput metrics.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Differential dataflow trades recomputation for maintained state. That is a good trade when updates are small, arrangements are reused, and frontiers advance. It can be a bad trade when one update has huge fanout, when many distinct arrangements must be maintained, or when old logical times cannot compact. The system saves CPU by spending memory and bookkeeping.`,
        `The worst surprise is delta fanout. If user 7 has two orders, moving the user between regions emits two output corrections. If user 7 has ten million orders, the same logical update emits ten million corrections. Incremental maintenance makes the dependency explicit; it does not make the dependency disappear. Bad keys, skewed joins, and hot groups are still hard.`,
        `Operational cost also appears in compaction and diagnostics. Trace size, arrangement count, frontier lag, consolidation work, and operator queue depth all matter. A system can process input quickly but accumulate memory because one frontier is stuck. Another can compact aggressively but spend too much CPU merging old updates. The production question is whether the maintained view beats periodic recompute under the real workload.`,
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        `Differential dataflow is useful for streaming databases, materialized view maintenance, graph analytics, iterative algorithms, incremental search indexes, and interactive analytics over changing data. Materialize popularized the database version of the idea: users write SQL-like queries and the engine maintains results as sources change.`,
        `The model is especially strong when users want low-latency answers over changing inputs. A risk dashboard can update as events arrive. A social graph computation can revise recommendations after edge changes. A development tool can maintain analysis results as code changes. In each case, the system tries to pay for the change, not for the whole world.`,
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        `The first failure mode is assuming incremental means constant time. It does not. Work is proportional to the consequences of the update, and those consequences can be large. The second is stuck frontiers. A delayed input, long-running read, or iterative loop can prevent compaction and grow memory. The third is arrangement explosion, where many keys and query shapes require many maintained indexes.`,
        `The fourth is semantic mismatch. Differential dataflow maintains exact logical results for the dataflow it was given. If the query is poorly keyed, the data has extreme skew, or the product only needs approximate answers, the exact incremental engine may be more expensive than a simpler approximation or scheduled batch rebuild. The fifth is debugging complexity. A wrong result may come from an incorrect diff, a bad timestamp, an operator bug, or compaction before the frontier allowed it.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Differential Dataflow with Timely Dataflow because progress tracking is part of the design, not an afterthought. Then study Streaming Watermarks, the Google Dataflow Model, MillWheel, Flink Checkpointing, Distributed Snapshot and Consistent Cut, Database Indexing, Materialized Views, and Join Algorithms.`,
        `For implementation practice, build a tiny maintained view for users(id, region) joined with orders(id, user_id), then update one user's region. Represent the change as one negative user tuple and one positive user tuple. Use an orders-by-user index to find affected orders. Emit negative counts for the old region and positive counts for the new region. Then add a frontier and ask when old updates can be compacted.`,
      ],
    },
  ],
};
