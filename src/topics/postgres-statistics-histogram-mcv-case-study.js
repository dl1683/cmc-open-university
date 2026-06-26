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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read planner statistics as a compact model, not as a copy of table data. A most-common-values list stores unusually frequent values, and a histogram stores range boundaries for the remaining non-hot values.',
        'In the extended-stats view, a multi-column statistic is evidence that two predicates are related. Without it, the planner may multiply independent-looking selectivities and invent a row count that is far too small.',
        {type:'callout', text:'Planner statistics are a compact model of skew, ranges, nulls, and correlations, not a copy of the table.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/1d/Example_histogram.png', alt:'Histogram with frequency bars over numeric x values.', caption:'Example histogram generated from simulated data, by Visnut, Wikimedia Commons, CC BY-SA 3.0/GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The PostgreSQL planner must choose a plan before it reads all candidate rows. Statistics exist to give it cheap evidence about table size, predicate selectivity, join size, and group counts.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is uniform estimation. If a table has 10 million rows and a column has 1 million distinct values, an equality predicate might be guessed at about 10 rows.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is skew and correlation. If one tenant owns 40 percent of rows, an average-per-tenant estimate can be wrong by orders of magnitude.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep the distribution facts that change plan choice. Most-common-values, or MCVs, capture hot equality values, while histogram bounds capture range shape for the non-MCV population.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'ANALYZE samples table rows and refreshes statistics. Equality predicates check the MCV list first, range predicates use histogram bounds, and extended statistics can adjust estimates when repeated column combinations move together.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The planner does not need the exact number of rows for every predicate. It needs estimates close enough to choose a sane physical plan, and separating hot values from the tail prevents many catastrophic guesses.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Statistics cost sampling time, catalog space, and maintenance work. A query estimated at 100 rows but returning 1,000,000 rows can choose a nested loop, undersized hash table, or sort path that behaves badly under real volume.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MCV lists help with large tenants, common statuses, dominant countries, and common event types. Histograms help with time windows, price ranges, metric thresholds, and ordered text ranges.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Statistics fail when they are stale, too coarse, sampled unlucky, or unable to represent the query shape. Bulk loads, backfills, migrations, deletes, and seasonal traffic can change distributions faster than statistics refresh.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A table has 10 million events across 1,000 tenants. Uniform estimation says tenant_id = 42 returns about 10,000 rows, but tenant 42 actually owns 4 million rows; after ANALYZE records frequency 0.40, the estimate can move near 4 million.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL planner statistics at https://www.postgresql.org/docs/current/planner-stats.html, row estimation examples at https://www.postgresql.org/docs/current/row-estimation-examples.html, ANALYZE at https://www.postgresql.org/docs/current/sql-analyze.html, and CREATE STATISTICS at https://www.postgresql.org/docs/current/sql-createstatistics.html. Study Cardinality Estimation, PostgreSQL Query Planner, SQL Join Algorithms, Bitmap Scans, Selinger Dynamic Programming Join Optimization, reservoir sampling, functional dependencies, and EXPLAIN ANALYZE next.',
      ],
    },
  ],
};
