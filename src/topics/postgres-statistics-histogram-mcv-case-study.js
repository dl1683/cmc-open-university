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
      heading: 'Why this exists',
      paragraphs: [
        'The PostgreSQL planner has to choose a plan before the query runs. It has to decide whether to use an index, scan a table, build a hash table, sort rows, or drive a nested loop without first reading all candidate rows.',
        'Planner statistics are the cheap data model that makes that possible. They summarize table size, value frequency, nulls, ranges, and selected multi-column relationships so the planner can estimate row counts before committing to a plan.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest planner could use table size, index presence, and uniform assumptions. If a table has 10 million rows and a column looks like it has 1 million distinct values, an equality filter might be guessed at about 10 rows.',
        'That approach is not foolish. Uniform estimates are cheap and often good enough for synthetic data, unique keys, and columns with flat distributions. They fail on real production data because real data is skewed and correlated.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A bad row estimate changes the physical plan. If the planner thinks a predicate returns 10 rows when it returns 500,000, it may choose a nested loop that repeats an index lookup 500,000 times.',
        'Single-column estimates also break when predicates are correlated. `city = Boston` and `zip LIKE 021%` are not independent facts. Multiplying their separate selectivities invents a much smaller row count than the query will actually return.',
      ],
    },
    {
      heading: 'Core insight: a small model for planning',
      paragraphs: [
        'PostgreSQL stores table and index size estimates in catalogs such as `pg_class`, then stores per-column distribution summaries in `pg_statistic`. The readable view is `pg_stats`.',
        'A single-column statistic can include `null_frac`, `n_distinct`, `most_common_vals`, `most_common_freqs`, `histogram_bounds`, and correlation information. The planner chooses which fields matter based on the predicate operator.',
        'Extended statistics add selected multi-column facts. A `CREATE STATISTICS` object can ask PostgreSQL to collect functional dependencies, multivariate distinct counts, and multivariate most-common-value lists for a chosen column group.',
        'The planner is not trying to learn the full table. It is trying to keep the few distribution facts that change plan choice. Hot values, range boundaries, null rate, table size, and selected correlations are enough to prevent many catastrophic guesses.',
      ],
    },
    {
      heading: 'How ANALYZE builds the model',
      paragraphs: [
        '`ANALYZE` samples table rows and refreshes the planner statistics. It does not store the table; it stores enough shape for planning: which values are unusually frequent, how many distinct values probably exist, where range bucket boundaries fall, and which selected columns move together.',
        'The default statistics target limits how many entries can be stored in arrays such as `most_common_vals` and `histogram_bounds`. Raising the target can improve estimates for irregular distributions, but it costs more catalog space and more time to compute statistics.',
      ],
    },
    {
      heading: 'How estimates use it',
      paragraphs: [
        'Equality predicates consult the MCV list first. If the value is listed, the planner can use its stored frequency. If the value is not listed, the planner estimates from the remaining probability mass and the remaining distinct count.',
        'Range predicates use histogram bounds. The histogram divides the non-MCV population into buckets with roughly equal frequency, then estimates how much of the bucket range falls inside the predicate.',
        'For columns that have both MCVs and a histogram, the histogram excludes the MCV portion. That separation matters: hot values are handled explicitly, and the tail is approximated more coarsely.',
      ],
    },
    {
      heading: 'Extended statistics',
      paragraphs: [
        'Regular statistics are per column, so the planner normally assumes multiple conditions are independent. That assumption is often wrong for location, tenant, status, time, product, and workflow columns.',
        'Dependency statistics can model that one column mostly determines another. Multivariate MCV lists can store frequent combinations such as `(tenant_id, event_type)`. Multivariate ndistinct statistics help estimate group counts and distinct combinations.',
        'Extended statistics are targeted repairs, not global truth. PostgreSQL does not build every possible column combination automatically because the number of combinations is too large.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Statistics work because they preserve the parts of the distribution that most affect plan choice. Hot values get explicit frequencies. The non-hot tail gets bucket boundaries. Known correlations get separate multi-column summaries.',
        'The result is still approximate. Fresh statistics can be wrong because they are sampled, because the target is too low, or because the query shape uses an expression or relationship the statistics object does not model.',
        'The estimate does not need to be perfect to be useful. A planner usually needs to distinguish orders of magnitude: one row, hundreds of rows, millions of rows. Good statistics turn impossible guesses into estimates close enough for the cost model to choose a sane physical plan.',
      ],
    },
    {
      heading: 'Costs and production behavior',
      paragraphs: [
        'Stale statistics are a production plan risk. Bulk loads, tenant growth, seasonal traffic, deletes, migrations, and backfills can all change value distributions faster than autovacuum or manual `ANALYZE` refreshes them.',
        'More statistics are not free. Higher targets increase analysis work and catalog data. More extended-stat objects add maintenance overhead and can make the system harder to reason about if nobody can connect a statistic to a real bad estimate.',
        'The practical workflow is evidence driven: capture the bad plan with `EXPLAIN`, identify the wrong row estimate, decide whether the missing fact is single-column skew or multi-column correlation, add or refresh the right statistic, and compare the new estimate.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'MCV lists win on skewed equality predicates: large tenants, hot statuses, common event types, dominant countries, and other values that appear far more often than the average value.',
        'Histograms win on range predicates: time windows, numeric ranges, lexicographic ranges, and price or metric filters where ordering carries selectivity information.',
        'Extended stats win when a query repeatedly combines correlated columns. They fail when the correlation is unmodeled, when the query hides the column behind an unsupported expression, or when the data changes before statistics refresh.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'When a query regresses, compare estimated rows with actual rows at every plan node. The first large mismatch is the clue. Then ask whether the missing fact is stale table size, a hot value absent from the MCV list, a range distribution problem, or a correlation between columns.',
        'Do not raise statistics targets everywhere by reflex. Use higher targets on columns where estimates affect important plans, create extended statistics for repeated correlated predicates, and schedule ANALYZE after bulk changes. The goal is targeted planner evidence, not catalog bloat or ritual tuning.',
        'Keep query shape in the investigation. A statistic on a raw column may not help if the predicate wraps the column in a function, compares incompatible types, or hides the relationship inside an expression. Sometimes the fix is an expression index or query rewrite, not another statistic.',
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        'A SaaS events table has `tenant_id`, `event_type`, and `event_time`. One enterprise tenant owns 40 percent of the rows. Without a fresh MCV entry, `tenant_id = 42` may look like an ordinary rare tenant, so the planner chooses a nested loop built for a small result.',
        '`ANALYZE` samples the table and records tenant 42 in the MCV list with a high frequency. The same query now estimates many more rows, which can flip the plan toward a hash join, bitmap scan, or sequential scan depending on indexes and filters.',
        'A location table has `city` and `zip`. Single-column stats may multiply two 1 percent filters into 0.01 percent. A dependency or multivariate MCV statistic can show that the predicates describe the same population, not two independent cuts.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study cardinality estimation next, because row-count error is the link between statistics and bad plans. Then study join algorithms, index access paths, bitmap scans, and the Selinger dynamic-programming join optimizer.',
        'For the statistics side, study reservoir sampling, HyperLogLog-style distinct estimation, functional dependencies, and multivariate selectivity. For operations, study autovacuum, `ANALYZE`, `EXPLAIN (ANALYZE, BUFFERS)`, and statistics targets.',
        'Primary sources: https://www.postgresql.org/docs/current/planner-stats.html, https://www.postgresql.org/docs/current/row-estimation-examples.html, https://www.postgresql.org/docs/current/sql-analyze.html, and https://www.postgresql.org/docs/current/sql-createstatistics.html.',
      ],
    },
  ],
};
