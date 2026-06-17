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
      heading: 'Why it exists',
      paragraphs: [
        'Spark Adaptive Query Execution is a runtime optimization layer for Spark SQL. It exists because a distributed SQL engine must choose a physical plan before it has seen the true runtime shape of the data. Catalog statistics, file statistics, sampled estimates, and user hints can be useful, but they are often incomplete or stale. Filters may be more selective than expected. Columns may be correlated. One key may be far hotter than the rest. A table that looks large at planning time may become small after a predicate.',
        'A static plan has to commit early. It chooses join strategies, shuffle partition counts, exchange boundaries, and task shapes before the shuffle output is materialized. If the estimate is wrong, the cluster pays: it can sort and shuffle data that should have been broadcast, create hundreds of tiny tasks that spend more time scheduling than computing, or leave one skewed partition running while the rest of the stage is idle.',
        'AQE adds a feedback loop. Spark still starts with an initial plan, but it treats completed query stages as new evidence. Once a shuffle stage finishes, Spark knows real output sizes and partition sizes. That evidence can be used to rewrite downstream parts of the physical plan before those parts run.',
      ],
    },
    {
      heading: 'Why the obvious planner fails',
      paragraphs: [
        'The obvious approach is to make the static optimizer better and trust it. That helps, but it cannot remove runtime uncertainty. Data changes between analysis runs. A file source may lack complete statistics. A user-defined function may hide selectivity. A filter on two correlated columns may be estimated as if the columns were independent. A single large customer, country, or event type can make one partition dominate a supposedly uniform distribution.',
        'Hints are not enough either. A broadcast hint can be wrong when a filtered table is larger than expected. A join hint can force a plan that was good last month and bad today. Static partition settings can be too high for one query and too low for another. AQE exists because the completed shuffle contains facts that the static planner did not have: actual bytes, actual row counts where available, and actual per-partition skew.',
        'The key limitation is timing. AQE can use evidence only after a boundary that materializes evidence, usually an exchange or query stage. It cannot go back in time and make an earlier scan, filter, or shuffle cheaper. This makes AQE a second chance for downstream planning, not a replacement for table statistics and good data layout.',
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        'Spark begins with a logical plan, applies analysis and optimization, and produces an initial physical plan. Exchange operators divide the plan into query stages. When a stage runs, shuffle writers produce data and record statistics about output sizes and partition sizes. The adaptive planner then reviews the remaining plan using those runtime statistics.',
        'The supported rewrites are specific. Spark can convert a sort-merge join into a broadcast hash join when one side is now known to be small enough. It can choose a shuffle hash join in cases where partition sizes make that attractive. It can coalesce many small post-shuffle partitions into fewer better-sized tasks. It can split skewed shuffle partitions and replicate the matching small-side data so one huge task becomes several smaller tasks. It can also use local shuffle readers to avoid unnecessary network reads after certain join changes.',
        'This is why exchange operators are central to the topic. A shuffle is not only a data movement step. Under AQE, it is also a planning checkpoint. The materialized shuffle output gives Spark a measured representation of the data distribution that can drive a safer physical choice for the work that remains.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'AQE works because some of the most expensive distributed-query mistakes are visible at stage boundaries. If a shuffled relation is small enough to broadcast, Spark can avoid a later distributed sort-merge path. If many partitions contain only tiny outputs, Spark can merge them and reduce scheduler overhead. If one partition is far larger than the median, Spark can split it and shorten the tail. These are local, evidence-backed repairs.',
        'The mechanism is bounded, which is also why it is safe enough to use. Spark does not rewrite arbitrary completed work. It changes plan fragments that have not yet executed and only through supported physical transformations. The correctness of the SQL result is preserved because the rewrites are alternative implementations of the same relational operators. The benefit is performance: less network movement, fewer tasks, less sorting, better parallelism, or less tail latency.',
        'The runtime-stats view in this module shows that loop directly: logical plan, static plan, first shuffle stage, runtime statistics, adaptive reoptimization, and revised physical work. The skew-and-coalesce view shows the two opposite task-shape repairs: merge tiny partitions to avoid overhead, and split huge partitions to avoid a long tail.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a retail query that joins a large orders fact table to a product dimension and then groups by region. The static catalog says the product dimension is 3 GB, so Spark chooses sort-merge join. The query has a predicate on product category, but the table statistics do not capture that the selected category is small. After the first stage, Spark observes that the filtered dimension side is only 40 MB.',
        'With AQE enabled and the broadcast threshold allowing it, Spark can convert the downstream join to broadcast hash join. The dimension is sent to executors, and the orders side can be joined without the same distributed sort-merge cost. That is the first repair: a join strategy change based on measured size rather than stale size.',
        'The same query has a second issue. One region has a much larger number of orders than the rest, so one shuffle partition is hundreds of megabytes while neighboring partitions are small. Without skew handling, most tasks finish quickly and the final task holds the stage open. AQE can mark that partition as skewed, split it into multiple pieces, and replicate the needed small-side data. The system spends some extra work to reduce the user-visible tail.',
        'Finally, the query has many tiny post-shuffle partitions after filtering. AQE can coalesce them into fewer tasks. That reduces scheduling overhead and improves task efficiency while still preserving enough parallelism. The final plan may contain a broadcast join, skew partition splits, local shuffle readers, and coalesced partitions, even though the initial plan did not.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'AQE matters most in ETL, analytics, and lakehouse workloads where the same SQL shape can see very different data sizes from day to day. A daily partition may be empty on one run and huge on another. A tenant filter may select a tiny customer or the largest customer. A dimension table may be small after filtering even if the full table is large. Static settings cannot perfectly cover all of these cases.',
        'It also matters in shared clusters. Hundreds of tiny tasks waste scheduler capacity. One skewed task wastes executor capacity by leaving most workers idle. A join strategy that shuffles large data unnecessarily consumes network and disk. AQE can reduce those costs without requiring every user to hand-tune every query.',
        'AQE is especially relevant when teaching distributed execution because it connects high-level SQL planning with concrete data structures: shuffle files, partition-size arrays, query-stage DAGs, exchange operators, task metrics, and physical operator choices. It shows that an optimizer is not only a compile-time component; in a distributed system, the runtime can feed the planner new facts.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'AQE cannot fix work that has already run. If the expensive part of the query is an early scan, an expensive UDF, a bad filter, or a shuffle that was already completed, adaptive planning may have little room left to help. It also cannot invent unsupported physical operators or change query semantics.',
        'It can make poor choices if thresholds are wrong for the cluster. A broadcast conversion can pressure executor memory if the supposedly small side is still too large for the workload. Partition coalescing can reduce scheduling overhead but remove useful parallelism. Skew splitting can add overhead by replicating data and creating more tasks. Local shuffle readers can help locality but must be understood in the final plan.',
        'Operational confusion is another failure mode. Spark explain output can show both the initial plan and the final adaptive plan. Engineers who look only at the initial plan may miss the operator that actually ran. Engineers who look only at the final plan may miss wasted early work. Debugging AQE requires reading the plan evolution and the task metrics together.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'When tuning a Spark SQL query, compare the initial physical plan with the final adaptive plan. Look for join strategy changes, broadcast decisions, coalesced shuffle partitions, skew partition splits, local shuffle readers, shuffle bytes, task duration distribution, spill, and executor memory pressure. The important question is not just whether AQE fired, but whether the rewrite addressed the dominant cost.',
        'Keep table statistics and data layout healthy. AQE is a second chance, not a license to ignore statistics, file sizing, partitioning, bucketing, or skew-aware keys. Better static estimates reduce wasted early stages. Good file sizes reduce scan overhead. Good partitioning reduces unnecessary shuffle. AQE is strongest when it starts from a reasonable plan and repairs the parts that only runtime evidence can reveal.',
        'Treat thresholds as workload controls. Broadcast thresholds, advisory partition sizes, skew detection thresholds, and shuffle partition settings should reflect executor memory, network bandwidth, task startup cost, and workload shape. A configuration that helps a small interactive query can hurt a large batch job. Validate with plan diffs and task metrics instead of relying on a single runtime number.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources for this topic are the Apache Spark SQL performance tuning and AQE documentation at https://spark.apache.org/docs/latest/sql-performance-tuning.html, the Spark 3.5 SQL performance tuning documentation at https://spark.apache.org/docs/3.5.6/sql-performance-tuning.html, and the Spark 3.2 release notes that describe AQE being enabled by default at https://spark.apache.org/releases/spark-release-3-2-0.html.',
        'Study next: Cardinality Estimation Error Propagation for why static estimates fail, Exchange Operator Parallel Query for the stage boundary that AQE uses, SQL Join Algorithms Primer for the physical join choices, Runtime Bloom Filter Join Pruning for another runtime filtering optimization, Volcano Iterator Query Execution for physical execution structure, Spark RDD Case Study for lineage and partitions, and Tail Latency for the skewed-task problem.',
      ],
    },
  ],
};
