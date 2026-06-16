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
    explanation: 'Spark SQL starts with a physical plan, but exchanges and query stages produce runtime statistics. AQE can then revise parts of the plan before downstream stages run.',
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
    explanation: 'AQE uses observed shuffle output sizes. It can turn a sort-merge join into broadcast hash join, coalesce small shuffle partitions, or split skewed partitions.',
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
    explanation: 'Coalescing post-shuffle partitions can reduce scheduler overhead when many partitions are tiny. The goal is fewer, better-sized tasks without destroying parallelism.',
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
    explanation: 'AQE can split a skewed partition and replicate the matching small-side partition so the join work is divided across more tasks.',
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
    explanation: 'A practical AQE win is a join where the static plan chose sort-merge join, but runtime stats reveal a broadcastable side and one skewed partition. AQE switches strategy and balances the tail.',
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
    { heading: 'What it is', paragraphs: [
      'Spark Adaptive Query Execution is a runtime optimization layer for Spark SQL. It uses statistics collected at query-stage boundaries, especially shuffle output sizes, to revise the remaining physical plan.',
      'AQE is useful because static cardinality estimates can be wrong and distributed execution exposes real sizes only after partial work has completed. It does not replace the optimizer; it adds a feedback loop after runtime evidence appears.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Spark starts with a logical plan and a static physical plan. When a shuffle stage completes, Spark knows partition sizes and output sizes. AQE can then switch join strategies, use local shuffle readers, coalesce post-shuffle partitions, or optimize skew joins.',
      'The important boundary is the query stage. AQE can change downstream work, but it cannot undo a completed stage. This makes exchange operators and shuffle data structures central to adaptive planning.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A sales query joins a large fact table to a filtered dimension. Static estimates choose sort-merge join. After the first shuffle, Spark sees the dimension side is small enough to broadcast and that one fact partition is skewed. AQE converts the join, coalesces tiny partitions, and splits the skewed partition so fewer tasks wait on the tail.',
      'The lesson is not that adaptive execution eliminates statistics. Better static estimates still help avoid wasted early stages. AQE is a second chance at physical planning once real stage sizes are visible.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Apache Spark SQL performance tuning and AQE documentation at https://spark.apache.org/docs/latest/sql-performance-tuning.html, Spark 3.5 AQE documentation at https://spark.apache.org/docs/3.5.6/sql-performance-tuning.html, and Spark 3.2 release notes enabling AQE by default at https://spark.apache.org/releases/spark-release-3-2-0.html. Study Cardinality Estimation Error Propagation, Exchange Operator Parallel Query, SQL Join Algorithms Primer, Volcano Iterator Query Execution, and Spark RDD Case Study next.',
    ] },
  ],
};
