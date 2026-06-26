// Cardinality estimation errors: row-count mistakes compound through join
// enumeration, join algorithm choice, memory sizing, and plan stability.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'cardinality-estimation-error-propagation-case-study',
  title: 'Cardinality Estimation Error Propagation',
  category: 'Systems',
  summary: 'See how small predicate errors become large join-size errors, how q-error exposes the damage, and why optimizers can choose bad plans from good algorithms.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['q-error cascade', 'join order trap'], defaultValue: 'q-error cascade' },
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

function cascadeGraph(title) {
  return graphState({
    nodes: [
      { id: 'stats', label: 'stats', x: 0.8, y: 4.0, note: 'sample' },
      { id: 'sel', label: 'select', x: 2.5, y: 4.0, note: 'preds' },
      { id: 'join1', label: 'join AB', x: 4.4, y: 2.8, note: 'est rows' },
      { id: 'join2', label: 'join ABC', x: 6.4, y: 4.0, note: 'bigger' },
      { id: 'memory', label: 'memory', x: 8.2, y: 2.8, note: 'hash size' },
      { id: 'plan', label: 'plan', x: 8.2, y: 5.2, note: 'chosen' },
    ],
    edges: [
      { id: 'e-stats-sel', from: 'stats', to: 'sel' },
      { id: 'e-sel-join1', from: 'sel', to: 'join1' },
      { id: 'e-join1-join2', from: 'join1', to: 'join2' },
      { id: 'e-join2-memory', from: 'join2', to: 'memory' },
      { id: 'e-join2-plan', from: 'join2', to: 'plan' },
    ],
  }, { title });
}

function planGraph(title) {
  return graphState({
    nodes: [
      { id: 'A', label: 'A', x: 0.8, y: 2.2, note: 'fact' },
      { id: 'B', label: 'B', x: 0.8, y: 5.8, note: 'dim' },
      { id: 'C', label: 'C', x: 2.6, y: 4.0, note: 'dim' },
      { id: 'AB', label: 'AB', x: 4.8, y: 2.8, note: 'est tiny' },
      { id: 'BC', label: 'BC', x: 4.8, y: 5.2, note: 'actual tiny' },
      { id: 'winner', label: 'winner', x: 7.2, y: 4.0, note: 'wrong?' },
    ],
    edges: [
      { id: 'e-A-AB', from: 'A', to: 'AB' },
      { id: 'e-B-AB', from: 'B', to: 'AB' },
      { id: 'e-B-BC', from: 'B', to: 'BC' },
      { id: 'e-C-BC', from: 'C', to: 'BC' },
      { id: 'e-AB-win', from: 'AB', to: 'winner' },
      { id: 'e-BC-win', from: 'BC', to: 'winner' },
    ],
  }, { title });
}

function* qErrorCascade() {
  yield {
    state: cascadeGraph('Cardinality estimates feed every later planner choice'),
    highlight: { active: ['stats', 'sel', 'join1', 'join2', 'e-stats-sel', 'e-sel-join1'], compare: ['plan'] },
    explanation: 'A row-count estimate is not just a display field in EXPLAIN. It decides join order, join method, memory sizing, parallelism, and whether an index path looks worthwhile.',
  };
  yield {
    state: labelMatrix(
      'q-error examples',
      [
        { id: 'good', label: 'good' },
        { id: 'low', label: 'under est' },
        { id: 'high', label: 'over est' },
        { id: 'bad', label: 'catastrophic' },
      ],
      [
        { id: 'est', label: 'est' },
        { id: 'actual', label: 'actual' },
        { id: 'qerr', label: 'q-error' },
      ],
      [
        ['1k', '1.2k', '1.2x'],
        ['100', '50k', '500x'],
        ['1M', '10k', '100x'],
        ['10', '1M', '100k x'],
      ],
    ),
    highlight: { active: ['low:qerr', 'bad:qerr'], found: ['good:qerr'] },
    explanation: 'Q-error is max(estimate/actual, actual/estimate), so underestimates and overestimates are penalized symmetrically. Large q-error is a warning that the optimizer was reasoning from a false world.',
    invariant: 'The first large row-estimate error often matters more than the slowest-looking top plan node.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'plan node', min: 1, max: 5 }, y: { label: 'rows', min: 1, max: 1000000 } },
      series: [
        { id: 'est', label: 'est', points: [{ x: 1, y: 1000 }, { x: 2, y: 100 }, { x: 3, y: 800 }, { x: 4, y: 3000 }, { x: 5, y: 5000 }] },
        { id: 'actual', label: 'actual', points: [{ x: 1, y: 1200 }, { x: 2, y: 50000 }, { x: 3, y: 250000 }, { x: 4, y: 600000 }, { x: 5, y: 900000 }] },
      ],
    }),
    highlight: { active: ['actual'], compare: ['est'] },
    explanation: 'Once a leaf predicate is underestimated, later joins inherit and amplify that mistake. The plan shape may be wrong long before execution reaches the final node.',
  };
  yield {
    state: cascadeGraph('Errors change memory and join-method choices'),
    highlight: { active: ['join2', 'memory', 'plan', 'e-join2-memory', 'e-join2-plan'], compare: ['stats'] },
    explanation: 'A hash join sized for 10k rows can spill if the build side is actually 10 million rows. A nested loop chosen for a tiny outer side can explode when the outer side is huge.',
  };
  yield {
    state: labelMatrix(
      'Repair menu',
      [
        { id: 'stale', label: 'stale stats' },
        { id: 'corr', label: 'correlation' },
        { id: 'skew', label: 'hot keys' },
        { id: 'runtime', label: 'runtime drift' },
      ],
      [
        { id: 'fix', label: 'fix' },
        { id: 'topic', label: 'topic' },
      ],
      [
        ['ANALYZE', 'PG stats'],
        ['ext stats', 'deps'],
        ['MCV or split', 'skew'],
        ['AQE', 'Spark'],
      ],
    ),
    highlight: { active: ['stale:fix', 'corr:fix'], found: ['runtime:fix'] },
    explanation: 'Cardinality problems have different repairs. Refreshing stale stats is not the same as modeling correlation, handling skew, or adapting after runtime shuffle sizes are known.',
  };
}

function* joinOrderTrap() {
  yield {
    state: planGraph('The estimated winner can be the actual loser'),
    highlight: { active: ['AB', 'winner', 'e-AB-win'], compare: ['BC', 'e-BC-win'] },
    explanation: 'A join-order optimizer can enumerate the right alternatives and still choose the wrong one if AB looks tiny in estimates but BC is the real selective join.',
  };
  yield {
    state: labelMatrix(
      'Candidate comparison',
      [
        { id: 'AB', label: 'A join B' },
        { id: 'BC', label: 'B join C' },
        { id: 'ABC1', label: 'AB then C' },
        { id: 'ABC2', label: 'BC then A' },
      ],
      [
        { id: 'est', label: 'est rows' },
        { id: 'actual', label: 'actual' },
        { id: 'cost', label: 'effect' },
      ],
      [
        ['100', '5M', 'bad first'],
        ['1M', '5k', 'good first'],
        ['cheap est', 'huge temp', 'spill'],
        ['costly est', 'small temp', 'fast'],
      ],
    ),
    highlight: { active: ['ABC1:actual', 'ABC1:cost'], found: ['ABC2:actual', 'ABC2:cost'] },
    explanation: 'This is the optimizer trap that Join Order Benchmark-style studies made concrete: plan enumeration is not enough when cardinalities are brittle.',
  };
  yield {
    state: planGraph('A better estimate changes the chosen subset order'),
    highlight: { active: ['BC', 'winner', 'e-BC-win'], found: ['B', 'C'], compare: ['AB'] },
    explanation: 'When the planner learns the selective relationship between B and C, the DP or memo search can choose the smaller intermediate first.',
  };
  yield {
    state: labelMatrix(
      'Evidence to keep',
      [
        { id: 'plan', label: 'plan text' },
        { id: 'rows', label: 'est/actual' },
        { id: 'stats', label: 'stats state' },
        { id: 'data', label: 'data event' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'use', label: 'use' },
      ],
      [
        ['shape', 'diff plans'],
        ['q-error', 'find break'],
        ['ANALYZE age', 'root cause'],
        ['bulk load', 'timeline'],
      ],
    ),
    highlight: { active: ['rows:use', 'stats:use'], found: ['data:use'] },
    explanation: 'Plan regressions are easier to fix when row estimates, stats freshness, and data-distribution events are captured together.',
  };
  yield {
    state: cascadeGraph('The lesson connects estimates, enumeration, and execution'),
    highlight: { active: ['stats', 'sel', 'join1', 'join2', 'plan'], found: ['memory'] },
    explanation: 'Cardinality estimation is the handshake between logical optimization and physical execution. When it lies, every later data structure may be selected or sized incorrectly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'q-error cascade') yield* qErrorCascade();
  else if (view === 'join order trap') yield* joinOrderTrap();
  else throw new InputError('Pick a cardinality-estimation view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      {type:'callout', text:'Cardinality estimates are planner evidence; once the first row-count guess is badly wrong, every downstream join, memory, and cost choice can look rational but run terribly.'},
      'Read cardinality as row count. Active nodes are estimates the optimizer trusts, and compare nodes are places where execution proves the estimate wrong. The safe inference rule is to find the first large estimate miss, not only the slowest final operator.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'SQL describes a result, not the physical path. The database must choose scans, joins, sorts, memory, parallelism, and shuffles before reading the full result. Cardinality estimation supplies the row-count evidence for those choices.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to inspect the data and know the true cheapest plan. That would often cost as much as running the query. Optimizers instead use statistics such as histograms, most-common values, distinct counts, null fractions, constraints, and index metadata.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is propagation. A base predicate estimate feeds a join estimate, which feeds the next join, memory grant, sort cost, and network shuffle estimate. Once an early row count is wrong, later choices can be rational inside a false world.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Cardinality errors change plan ranking, not just plan labels. A dynamic-programming or memo optimizer can enumerate the right join orders and still choose the wrong one if row counts invert the costs. Q-error makes the miss visible as max(estimate / actual, actual / estimate).',
    ] },
    { heading: 'How it works', paragraphs: [
      'Single-table estimates start with table size and predicate selectivity. Equality predicates may use distinct counts or most-common-value lists, while range predicates use histograms. Join estimates add uniqueness, foreign keys, distinct counts, and assumptions about value overlap.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The debugging method works because each plan node has an estimated world and an executed world. Comparing estimated rows to actual rows reveals where the optimizer lost contact with data. Better estimates improve ranking because the same enumerator can choose the smaller intermediate first.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'More statistics cost storage, analyze time, planning time, and attention. Extended statistics on every column group are not free. When correlated predicates multiply, error can grow faster than data size, so the useful spend is on statistics that change plan choices.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Engineers use estimate-versus-actual rows to debug plan regressions in PostgreSQL, SQL Server, Oracle, MySQL, Spark SQL, DuckDB, and warehouses. Incident notes should keep query text, plan, statistics age, estimates, actual rows, spills, and recent data changes together.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails under correlation, skew, stale statistics, hidden expressions, and generic prepared plans. A hot tenant or popular status value can behave unlike the average value. Casts, JSON paths, and user-defined functions can hide selectivity from the planner.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A query can join AB first or BC first. The planner estimates AB at 100 rows and BC at 1,000,000 rows, so it chooses AB. Execution shows AB is 5,000,000 rows and BC is 5,000 rows; AB q-error is 50,000, while BC q-error is 200, so the estimate inverted the plan choice.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: Leis et al., "How Good Are Query Optimizers, Really?" at https://www.vldb.org/pvldb/vol9/p204-leis.pdf, PostgreSQL row estimation examples at https://www.postgresql.org/docs/current/row-estimation-examples.html, and System R optimizer paper at https://web.eecs.umich.edu/~michjc/eecs584/Papers/selinger_1979.pdf.',
      'Study PostgreSQL Statistics Histogram and MCV, Selinger DP Join Order Optimizer, Cascades Memo Query Optimizer, SQL Join Algorithms Primer, Volcano Iterator Query Execution, Runtime Bloom Filter Join Pruning, and Spark Adaptive Query Execution.',
    ] },
  ],
};
