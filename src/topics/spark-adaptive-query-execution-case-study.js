// Spark Adaptive Query Execution: runtime shuffle statistics let Spark SQL
// replan joins, coalesce partitions, and split skewed work after stages finish.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'spark-adaptive-query-execution-case-study',
  title: 'Spark Adaptive Query Execution Case Study',
  category: 'Systems',
  summary: 'Spark SQL AQE uses runtime shuffle statistics to revise physical plans: switch join strategies, coalesce partitions, and split skewed tasks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['runtime stats', 'skew and coalesce'], defaultValue: 'runtime stats' },
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

function aqeGraph(title) {
  return graphState({
    nodes: [
      { id: 'logical', label: 'logical', x: 0.8, y: 4.0, note: 'SQL' },
      { id: 'static', label: 'static', x: 2.4, y: 4.0, note: 'plan' },
      { id: 'stage1', label: 'stage 1', x: 4.2, y: 2.6, note: 'shuffle' },
      { id: 'stats', label: 'stats', x: 4.2, y: 5.4, note: 'sizes' },
      { id: 'reopt', label: 'reopt', x: 6.2, y: 4.0, note: 'AQE' },
      { id: 'plan2', label: 'new plan', x: 8.0, y: 4.0, note: 'execute' },
    ],
    edges: [
      { id: 'e-logical-static', from: 'logical', to: 'static' },
      { id: 'e-static-stage1', from: 'static', to: 'stage1' },
      { id: 'e-stage1-stats', from: 'stage1', to: 'stats' },
      { id: 'e-stats-reopt', from: 'stats', to: 'reopt' },
      { id: 'e-reopt-plan2', from: 'reopt', to: 'plan2' },
    ],
  }, { title });
}

function* runtimeStats() {
  yield {
    state: aqeGraph('AQE replans after runtime statistics arrive'),
    highlight: { active: ['logical', 'static', 'stage1', 'stats', 'e-static-stage1', 'e-stage1-stats'], compare: ['reopt'] },
    explanation: 'Spark starts with a static physical plan, but shuffle stages produce real size information. AQE uses those stage statistics to revise downstream work before it runs.',
  };
  yield {
    state: labelMatrix(
      'AQE decisions',
      [
        { id: 'broadcast', label: 'broadcast' },
        { id: 'shuffleHash', label: 'shuf hash' },
        { id: 'coalesce', label: 'coalesce' },
        { id: 'skew', label: 'skew join' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['small side', 'BHJ'],
        ['small parts', 'SHJ'],
        ['tiny parts', 'merge parts'],
        ['hot part', 'split'],
      ],
    ),
    highlight: { active: ['broadcast:action', 'coalesce:action', 'skew:action'], compare: ['shuffleHash:action'] },
    explanation: 'Read the decisions as supported rewrites, not arbitrary magic. Observed shuffle sizes can justify a broadcast join, a shuffle-hash join, partition coalescing, or skew splitting.',
    invariant: 'AQE improves a plan after stage boundaries; it cannot change work that has already run.',
  };
  yield {
    state: aqeGraph('Runtime stats make a static estimate less final'),
    highlight: { active: ['stats', 'reopt', 'plan2', 'e-stats-reopt', 'e-reopt-plan2'], found: ['stage1'] },
    explanation: 'This is the distributed execution answer to cardinality uncertainty: wait until a shuffle materializes real sizes, then make a better physical choice for remaining work.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'partition', min: 1, max: 8 }, y: { label: 'MB', min: 0, max: 900 } },
      series: [
        { id: 'before', label: 'before', points: [{ x: 1, y: 80 }, { x: 2, y: 70 }, { x: 3, y: 65 }, { x: 4, y: 90 }, { x: 5, y: 75 }, { x: 6, y: 60 }, { x: 7, y: 80 }, { x: 8, y: 70 }] },
        { id: 'small', label: 'after', points: [{ x: 1, y: 150 }, { x: 2, y: 155 }, { x: 3, y: 135 }, { x: 4, y: 145 }] },
      ],
    }),
    highlight: { active: ['before'], found: ['small'] },
    explanation: 'The plot shows coalescing. Many tiny partitions create scheduling overhead; AQE merges them into fewer better-sized tasks, while trying not to remove useful parallelism.',
  };
  yield {
    state: labelMatrix(
      'Static vs adaptive',
      [
        { id: 'static', label: 'static plan' },
        { id: 'runtime', label: 'runtime stats' },
        { id: 'adaptive', label: 'AQE plan' },
        { id: 'explain', label: 'explain' },
      ],
      [
        { id: 'has', label: 'has' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['estimates', 'wrong size'],
        ['actual bytes', 'late only'],
        ['revised ops', 'stage bound'],
        ['both plans', 'read diff'],
      ],
    ),
    highlight: { active: ['runtime:has', 'adaptive:has'], compare: ['static:risk'] },
    explanation: 'AQE is not magic. It is a runtime feedback loop with specific boundaries and supported rewrites. Understanding those boundaries explains when it helps and when it cannot.',
  };
}

function* skewAndCoalesce() {
  yield {
    state: plotState({
      axes: { x: { label: 'partition', min: 1, max: 8 }, y: { label: 'rows', min: 0, max: 1000000 } },
      series: [
        { id: 'skew', label: 'skew', points: [{ x: 1, y: 90000 }, { x: 2, y: 110000 }, { x: 3, y: 85000 }, { x: 4, y: 780000 }, { x: 5, y: 100000 }, { x: 6, y: 95000 }, { x: 7, y: 87000 }, { x: 8, y: 97000 }] },
      ],
    }),
    highlight: { active: ['skew'] },
    explanation: 'A single hot shuffle partition can dominate a distributed join. Without skew handling, most workers finish while one task drags the whole stage tail.',
  };
  yield {
    state: labelMatrix(
      'Skew join repair',
      [
        { id: 'detect', label: 'detect' },
        { id: 'split', label: 'split hot' },
        { id: 'replicate', label: 'rep small' },
        { id: 'join', label: 'join pieces' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['part sizes', 'find outlier'],
        ['big bucket', 'parallelize'],
        ['small side', 'match splits'],
        ['subtasks', 'shorter tail'],
      ],
    ),
    highlight: { active: ['detect:effect', 'split:effect', 'join:effect'], compare: ['replicate:effect'] },
    explanation: 'Skew repair splits the big partition and replicates the matching small-side data. That spends some extra work to shorten the long tail that would otherwise hold the whole stage open.',
  };
  yield {
    state: aqeGraph('Skew handling lives at exchange boundaries'),
    highlight: { active: ['stage1', 'stats', 'reopt', 'e-stage1-stats', 'e-stats-reopt'], found: ['plan2'] },
    explanation: 'Exchange boundaries are where Spark has materialized partition sizes. That is why AQE is closely tied to shuffle and query-stage execution.',
  };
  yield {
    state: labelMatrix(
      'Coalesce vs split',
      [
        { id: 'tiny', label: 'tiny parts' },
        { id: 'normal', label: 'normal' },
        { id: 'hot', label: 'hot part' },
        { id: 'limit', label: 'limit' },
      ],
      [
        { id: 'move', label: 'move' },
        { id: 'goal', label: 'goal' },
      ],
      [
        ['merge', 'less overhead'],
        ['keep', 'parallelism'],
        ['split', 'less tail'],
        ['respect deps', 'correctness'],
      ],
    ),
    highlight: { active: ['tiny:move', 'hot:move'], found: ['normal:move'] },
    explanation: 'AQE is balancing two opposite moves: merge small tasks to reduce overhead and split huge tasks to reduce skew. Both are guided by runtime stats.',
  };
  yield {
    state: labelMatrix(
      'Complete case study',
      [
        { id: 'before', label: 'before AQE' },
        { id: 'stats', label: 'shuffle stats' },
        { id: 'after', label: 'after AQE' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        { id: 'plan', label: 'plan' },
        { id: 'runtime', label: 'runtime' },
      ],
      [
        ['SMJ 200p', 'long tail'],
        ['dim+skew', 'new facts'],
        ['BHJ + splits', 'shorter tail'],
        ['stage bound', 'not free'],
      ],
    ),
    highlight: { active: ['before:runtime', 'after:runtime'], found: ['lesson:runtime'] },
    explanation: 'The complete case shows AQE at its best: runtime facts reveal a broadcastable side and a skewed partition, so Spark changes the remaining join strategy and balances the tail.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'runtime stats') yield* runtimeStats();
  else if (view === 'skew and coalesce') yield* skewAndCoalesce();
  else throw new InputError('Pick a Spark AQE view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the runtime-stats graph as a Spark SQL plan getting new evidence. Spark starts with a logical plan, chooses a static physical plan, runs a shuffle stage, records real sizes, and rewrites downstream work. Active nodes are the current stage, found nodes are completed evidence, and compare nodes are plan parts that may change.',
        'The skew view uses partition plots. A partition is a slice of data assigned to a task. Tiny partitions waste scheduler overhead, while one huge partition creates tail latency because the whole stage waits for the slow task.',
        {type:'callout', text:'AQE treats completed shuffle stages as evidence, then changes only the downstream physical work that has not run yet.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/f/f3/Apache_Spark_logo.svg', alt:'Apache Spark wordmark with orange star.', caption:'Apache Spark logo by Apache Software Foundation, Wikimedia Commons, Apache License 2.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Spark SQL must choose a physical plan before it has seen the actual runtime data. A physical plan decides join algorithms, shuffles, partition counts, and task boundaries. Static statistics are often stale, absent, or wrong because filters, correlation, and data skew change the shape of a query.',
        'Adaptive Query Execution, or AQE, exists because shuffle stages reveal facts. After a stage finishes, Spark knows actual byte sizes and partition sizes. It can use those facts to change remaining work instead of trusting the first guess forever.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to improve static planning. Collect table statistics, estimate row counts, pick a join strategy, set shuffle partitions, and run the plan. This is necessary and often good enough.',
        'Static planning breaks when the estimate is wrong. A table estimated at 3 GB may filter down to 40 MB and should have been broadcast. A hash key may look uniform but send half the rows to one partition. A fixed setting of 200 shuffle partitions may be too many for one query and too few for another.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is timing. The planner needs real data sizes before execution, but those sizes are produced by execution. A static optimizer has to choose before the most useful evidence exists.',
        'AQE cannot repair everything because it only sees evidence at stage boundaries. If an early scan, UDF, or shuffle already consumed the cost, adaptive planning cannot make that work disappear. It can only improve plan fragments that have not run yet.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat completed shuffle stages as planning checkpoints. A shuffle is data movement between tasks, but it also materializes partition-size evidence. Spark can reoptimize the downstream physical plan using measured data instead of estimated data.',
        'The supported moves are concrete. Spark can switch to broadcast hash join, choose shuffle hash join, coalesce small partitions, split skewed partitions, and use local shuffle readers. AQE is a bounded feedback loop, not arbitrary runtime magic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Spark first builds an initial physical plan with exchange operators. An exchange is a boundary where data is redistributed, usually by hash or range. Each exchange can define a query stage, and the stage writes shuffle data plus metrics.',
        'After a query stage completes, the adaptive planner reads those metrics. If one side of a join is below the broadcast threshold, it can replace a sort-merge join with a broadcast hash join. If many partitions are tiny, it can merge them. If one partition is far larger than the median, it can split that partition and replicate the matching small side.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is preserved because AQE swaps physical implementations of the same relational operators. A join is still a join, a shuffle partition is still part of the same result, and coalescing changes task shape rather than SQL semantics. The rewrites are applied only where Spark has an equivalent operator rule.',
        'The performance argument is local and evidence-based. A broadcast join avoids sorting and shuffling one side when the measured side is small. Coalescing saves scheduler overhead when partitions are too small. Skew splitting trades some replicated work for a shorter stage tail.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'AQE adds planning overhead and can spend extra work to save more expensive work later. Splitting a skewed partition may replicate 80 MB of small-side data, but it can turn one 900-second task into six 180-second tasks. Coalescing 600 tiny partitions into 80 tasks can save task launch overhead while preserving enough parallelism.',
        'The cost is configuration-sensitive. A broadcast threshold that is too high can pressure executor memory. A coalesce target that is too large can reduce parallelism. A skew threshold that is too eager can create needless splits and more shuffle reads.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AQE helps lakehouse ETL, dashboard queries, and shared-cluster analytics where data size changes by partition, tenant, date, or filter. The same SQL text may process 10 MB on Monday and 600 GB on Friday. Runtime feedback lets Spark avoid baking one data shape into every run.',
        'It is useful in teams that cannot hand-tune every query. Users still need good file sizes, statistics, and partitioning, but AQE covers common mistakes caused by late cardinality facts. It is a runtime safety net for distributed SQL execution.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'AQE fails when the expensive work has already happened. Bad file layout, a slow UDF, a huge early shuffle, or a scan with no pruning may dominate before adaptive decisions are available. It also cannot invent a new algorithm outside supported Spark rewrites.',
        'It can confuse debugging. Spark explain output may show an initial plan and a final adaptive plan. Engineers who read only one side can miss wasted early work or the operator that actually ran.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A query joins 1.2 billion orders to a product table. The catalog says products is 3 GB, so Spark chooses sort-merge join with 200 shuffle partitions. After filtering to category = batteries, the product side is measured at 38 MB.',
        'AQE changes the remaining join to broadcast hash join. It also sees that 140 post-shuffle partitions are under 2 MB and coalesces them to 35 tasks near 8 MB each. One region partition is 760 MB while the median is 70 MB, so AQE splits it into 8 pieces; the stage tail drops from about 11 minutes to about 2 minutes while using extra replicated small-side reads.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with the Apache Spark SQL performance tuning documentation and release notes for the Spark versions you use. AQE defaults and thresholds are product facts, so verify them against the current docs before teaching exact settings.',
        'Study cardinality estimation, exchange operators, broadcast hash join, sort-merge join, shuffle internals, Spark RDDs, and tail latency next. AQE makes sense when query planning and distributed task behavior are learned together.',
      ],
    },
  ],
};
