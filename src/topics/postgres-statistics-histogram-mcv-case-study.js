// PostgreSQL planner statistics: ANALYZE samples table data and stores
// null fraction, ndistinct, most-common values, histograms, and extended stats.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-statistics-histogram-mcv-case-study',
  title: 'PostgreSQL Statistics Histogram & MCV Case Study',
  category: 'Systems',
  summary: 'How ANALYZE turns sampled table data into planner-visible statistics: null fraction, ndistinct, most-common values, histograms, dependencies, and multivariate MCVs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['single column stats', 'extended stats'], defaultValue: 'single column stats' },
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

function statsGraph(title) {
  return graphState({
    nodes: [
      { id: 'table', label: 'table', x: 0.8, y: 4.0, note: 'rows' },
      { id: 'sample', label: 'sample', x: 2.5, y: 4.0, note: 'ANALYZE' },
      { id: 'mcv', label: 'MCV', x: 4.4, y: 2.4, note: 'hot vals' },
      { id: 'hist', label: 'hist', x: 4.4, y: 4.0, note: 'bounds' },
      { id: 'distinct', label: 'distinct', x: 4.4, y: 5.6, note: 'n_dist' },
      { id: 'select', label: 'select', x: 6.5, y: 4.0, note: 'eq/range' },
      { id: 'plan', label: 'plan', x: 8.4, y: 4.0, note: 'rows' },
    ],
    edges: [
      { id: 'e-table-sample', from: 'table', to: 'sample' },
      { id: 'e-sample-mcv', from: 'sample', to: 'mcv' },
      { id: 'e-sample-hist', from: 'sample', to: 'hist' },
      { id: 'e-sample-distinct', from: 'sample', to: 'distinct' },
      { id: 'e-mcv-select', from: 'mcv', to: 'select' },
      { id: 'e-hist-select', from: 'hist', to: 'select' },
      { id: 'e-distinct-select', from: 'distinct', to: 'select' },
      { id: 'e-select-plan', from: 'select', to: 'plan' },
    ],
  }, { title });
}

function extendedGraph(title) {
  return graphState({
    nodes: [
      { id: 'cols', label: 'columns', x: 0.8, y: 4.0, note: 'city,zip' },
      { id: 'create', label: 'CREATE', x: 2.6, y: 4.0, note: 'stats' },
      { id: 'deps', label: 'deps', x: 4.5, y: 2.4, note: 'x=>y' },
      { id: 'nd', label: 'n-dist', x: 4.5, y: 4.0, note: 'groups' },
      { id: 'multi', label: 'MCV list', x: 4.5, y: 5.6, note: 'pairs' },
      { id: 'estimate', label: 'estimate', x: 6.8, y: 4.0, note: 'joint sel' },
      { id: 'join', label: 'join plan', x: 8.8, y: 4.0, note: 'cost' },
    ],
    edges: [
      { id: 'e-cols-create', from: 'cols', to: 'create' },
      { id: 'e-create-deps', from: 'create', to: 'deps' },
      { id: 'e-create-nd', from: 'create', to: 'nd' },
      { id: 'e-create-multi', from: 'create', to: 'multi' },
      { id: 'e-deps-est', from: 'deps', to: 'estimate' },
      { id: 'e-nd-est', from: 'nd', to: 'estimate' },
      { id: 'e-multi-est', from: 'multi', to: 'estimate' },
      { id: 'e-est-join', from: 'estimate', to: 'join' },
    ],
  }, { title });
}

function* singleColumnStats() {
  yield {
    state: statsGraph('ANALYZE turns a sample into planner statistics'),
    highlight: { active: ['table', 'sample', 'e-table-sample'], compare: ['plan'] },
    explanation: 'PostgreSQL ANALYZE samples table data and writes statistics the planner can consult without scanning the table during planning.',
  };
  yield {
    state: labelMatrix(
      'pg_stats fields',
      [
        { id: 'null', label: 'null_frac' },
        { id: 'nd', label: 'n_distinct' },
        { id: 'mcv', label: 'MCV' },
        { id: 'hist', label: 'histogram' },
      ],
      [
        { id: 'captures', label: 'captures' },
        { id: 'used_for', label: 'used for' },
      ],
      [
        ['null share', 'IS NULL'],
        ['unique-ish', 'rare eq'],
        ['hot values', 'eq sel'],
        ['bucket cut', 'range sel'],
      ],
    ),
    highlight: { active: ['mcv:used_for', 'hist:used_for'], found: ['nd:used_for'] },
    explanation: 'Most-common values handle equality estimates for frequent values. Histograms approximate range predicates over the non-MCV tail.',
    invariant: 'A planner statistic is a compact model of data, not the data itself.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'value', min: 0, max: 100 }, y: { label: 'freq', min: 0, max: 100 } },
      series: [
        { id: 'mcv', label: 'MCV', points: [{ x: 10, y: 70 }, { x: 20, y: 62 }, { x: 35, y: 48 }, { x: 50, y: 12 }] },
        { id: 'tail', label: 'tail', points: [{ x: 55, y: 10 }, { x: 70, y: 9 }, { x: 85, y: 8 }, { x: 100, y: 6 }] },
      ],
    }),
    highlight: { active: ['mcv'], compare: ['tail'] },
    explanation: 'A skewed column cannot be summarized by uniform selectivity alone. Hot values need explicit MCV entries; the long tail can be approximated more coarsely.',
  };
  yield {
    state: statsGraph('Selectivity functions choose which statistic to read'),
    highlight: { active: ['mcv', 'hist', 'distinct', 'select', 'e-mcv-select', 'e-hist-select'], found: ['plan'] },
    explanation: 'The predicate operator matters. Equality, range, pattern matching, and null checks use different selectivity functions and different pieces of stored statistics.',
  };
  yield {
    state: labelMatrix(
      'Complete case study',
      [
        { id: 'old', label: 'stale stats' },
        { id: 'fresh', label: 'fresh stats' },
        { id: 'hot', label: 'hot tenant' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'estimate', label: 'estimate' },
        { id: 'plan', label: 'plan' },
      ],
      [
        ['too small', 'nested loop'],
        ['closer', 'hash join'],
        ['MCV entry', 'index path'],
        ['ANALYZE', 'stable plan'],
      ],
    ),
    highlight: { active: ['old:plan', 'fresh:plan'], found: ['fix:plan'] },
    explanation: 'After a bulk load, stale statistics can make a hot tenant look rare. Refreshing stats can change row estimates enough to flip join method and access path.',
  };
}

function* extendedStats() {
  yield {
    state: extendedGraph('Extended statistics model multi-column facts'),
    highlight: { active: ['cols', 'create', 'deps', 'multi', 'e-cols-create'], compare: ['estimate'] },
    explanation: 'Single-column stats miss correlations. Extended statistics let PostgreSQL model dependencies, multivariate ndistinct counts, and most-common combinations across columns.',
  };
  yield {
    state: labelMatrix(
      'Correlation trap',
      [
        { id: 'city', label: 'city' },
        { id: 'zip', label: 'zip' },
        { id: 'indep', label: 'indep guess' },
        { id: 'deps', label: 'with deps' },
      ],
      [
        { id: 'sel', label: 'selectivity' },
        { id: 'rows', label: 'rows' },
      ],
      [
        ['1%', '10k'],
        ['1%', '10k'],
        ['0.01%', '100'],
        ['1%', '10k'],
      ],
    ),
    highlight: { active: ['indep:rows'], found: ['deps:rows'] },
    explanation: 'If zip is mostly determined by city, multiplying selectivities invents selectivity that does not exist. Dependency statistics can correct that estimate.',
  };
  yield {
    state: extendedGraph('CREATE STATISTICS makes the dependency visible'),
    highlight: { active: ['create', 'deps', 'multi', 'estimate', 'e-deps-est', 'e-multi-est'], found: ['join'] },
    explanation: 'CREATE STATISTICS plus ANALYZE gives the planner a stored object it can consult for predicates involving the chosen column set.',
    invariant: 'Extended stats help only for modeled column groups and supported predicate shapes.',
  };
  yield {
    state: labelMatrix(
      'Extended-stat kinds',
      [
        { id: 'deps', label: 'deps' },
        { id: 'nd', label: 'ndistinct' },
        { id: 'mcv', label: 'MCV pairs' },
        { id: 'miss', label: 'missing' },
      ],
      [
        { id: 'helps' , label: 'helps' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['corr pred', 'not magic'],
        ['group count', 'sampled'],
        ['hot combos', 'size cap'],
        ['unknown corr', 'bad est'],
      ],
    ),
    highlight: { active: ['deps:helps', 'mcv:helps'], compare: ['miss:limit'] },
    explanation: 'Extended statistics are targeted repairs. They improve estimates for known correlations but do not replace query design, indexes, or runtime measurement.',
  };
  yield {
    state: labelMatrix(
      'Production workflow',
      [
        { id: 'find', label: 'find skew' },
        { id: 'model', label: 'model cols' },
        { id: 'analyze', label: 'ANALYZE' },
        { id: 'watch', label: 'watch' },
      ],
      [
        { id: 'tool', label: 'tool' },
        { id: 'result', label: 'result' },
      ],
      [
        ['EXPLAIN', 'bad rows'],
        ['CREATE STATS', 'joint facts'],
        ['refresh', 'new est'],
        ['regression', 'drift alert'],
      ],
    ),
    highlight: { active: ['find:result', 'model:result', 'analyze:result'], found: ['watch:result'] },
    explanation: 'A good stats fix is auditable: capture the bad estimate, add a statistic that models the missing data fact, refresh, and compare the new plan.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'single column stats') yield* singleColumnStats();
  else if (view === 'extended stats') yield* extendedStats();
  else throw new InputError('Pick a PostgreSQL statistics view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'PostgreSQL planner statistics are compact data summaries collected by ANALYZE. The planner uses them to estimate predicate selectivity and row counts before it chooses scans, joins, sorts, and aggregation strategies.',
      'Single-column statistics include null fraction, number of distinct values, most-common values, and histogram bounds. Extended statistics add selected multi-column facts such as dependencies, ndistinct counts, and multivariate most-common values.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Equality predicates usually consult most-common values first. If the queried value is not in the MCV list, the planner estimates from the remaining mass and ndistinct count. Range predicates use histogram bounds to estimate what fraction of values fall inside the range.',
      'For correlated predicates, multiplying single-column selectivities can be badly wrong. CREATE STATISTICS lets the database collect multi-column statistics so the planner can see that, for example, city and zip code are not independent.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A SaaS events table has tenant_id, event_type, and event_time. One enterprise tenant is much larger than the rest. Without fresh MCV statistics, a tenant filter may look selective enough for a nested-loop plan. After ANALYZE, tenant_id appears in the MCV list, and the planner chooses a hash join or a better index path.',
      'A location table has city and zip. The predicate city = "Boston" AND zip LIKE "021%" should not be estimated by naive independence. Extended dependency or multivariate MCV stats make the joint selectivity closer to reality.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: PostgreSQL planner statistics documentation at https://www.postgresql.org/docs/current/planner-stats.html, row-estimation examples at https://www.postgresql.org/docs/current/row-estimation-examples.html, ANALYZE documentation at https://www.postgresql.org/docs/current/sql-analyze.html, and CREATE STATISTICS at https://www.postgresql.org/docs/current/sql-createstatistics.html. Study PostgreSQL Query Planner Case Study, Cardinality Estimation Error Propagation, Selinger DP Join Order Optimizer, SQL Join Algorithms Primer, HyperLogLog, and Reservoir Sampling next.',
    ] },
  ],
};
