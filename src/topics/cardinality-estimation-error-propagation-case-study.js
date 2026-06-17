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
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQL lets a user describe the result, not the physical path. The database has to choose scan methods, join order, join algorithms, memory grants, parallelism, and sometimes distributed shuffle plans before it has executed the query. Those choices need a shared unit of comparison. In relational optimizers, that unit is usually estimated row count plus a cost model built on top of it.',
        'Cardinality estimation is the row-count prediction layer. It asks how many rows a predicate will keep, how many rows a join will produce, how many groups an aggregate will make, and how large each intermediate result will be. The answer is not a cosmetic number in an EXPLAIN plan. It is the input that makes one physical strategy look cheap and another look expensive.',
        'This topic exists because many query failures are not caused by a bad hash join, a bad B-tree, or a bad dynamic-programming enumerator. The optimizer can have strong algorithms and still choose a terrible plan when the estimates describe a different database from the one that will run. Plan debugging often starts by finding the first large gap between estimated and actual rows.',
      ],
    },
    {
      heading: 'The naive baseline and the wall',
      paragraphs: [
        'The naive mental model is that the optimizer can inspect the tables and know the right plan. That is not how production databases work. Full inspection would be too expensive, and the optimizer must plan before it has read the full result. Instead it relies on table statistics, histograms, most-common-value lists, null fractions, distinct counts, constraints, indexes, and assumptions about predicate independence.',
        'The wall is composition. A base predicate estimate feeds a join estimate. That join estimate feeds the next join estimate. The later plan nodes are reasoning over estimated intermediate relations that do not exist yet. When an early estimate is wrong, every downstream comparison can be made in a false world.',
        'A second wall is that overestimates and underestimates fail differently. An underestimate can choose a nested loop that repeats millions of times or a hash table that spills because memory was sized for a tiny build side. An overestimate can reject a good index path, allocate too much memory, or choose a broad parallel plan for a small result. Both are serious, so q-error treats them symmetrically as multiplicative misses.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Cardinality errors are not local defects. They propagate through the plan search. A wrong selectivity estimate can make the wrong join order look optimal. The wrong join order creates the wrong intermediate size. That size changes memory, join algorithm choice, sort cost, network shuffle cost, and whether pipelining still works.',
        'Q-error is useful because it makes that hidden damage visible as a factor. If the optimizer estimated 100 rows and execution produced 50,000, the q-error is 500. If it estimated 1,000,000 rows and execution produced 10,000, the q-error is 100. The direction matters for repair, but the factor tells you how far the planner was from reality.',
        'The deeper lesson is that optimization quality is limited by evidence quality. A Selinger DP table, Cascades memo, or modern rule-based search can enumerate excellent alternatives, but it still needs credible cardinalities to rank them. Enumeration answers "what could we do?" Estimation answers "which one is likely to be cheap?"',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simple single-table estimate begins with relation size and predicate selectivity. For equality predicates, an optimizer may use distinct-count estimates or most-common-value statistics. For range predicates, it may use histograms. For null checks, it uses null fractions. For combined predicates, many systems multiply selectivities unless they have extended statistics that describe correlation.',
        'Join estimates add another layer. The planner uses join predicates, uniqueness, foreign-key information when available, distinct counts, and assumptions about value overlap. A foreign-key join can be easier to estimate than an arbitrary expression join. A join on two skewed columns without useful statistics can be badly wrong.',
        'The cost model then consumes those row counts. A hash join has build-side memory needs. A nested loop repeats inner work for each outer row. A sort scales with row count and row width. A distributed shuffle moves bytes across the network. The same physical operator can be cheap or disastrous depending on the cardinality it was sized for.',
        'During execution, EXPLAIN ANALYZE or similar tooling can show estimated rows and actual rows per node. Comparing those numbers reveals where the plan stopped matching the data. The first large miss is often more important than the final slow node because it explains why later choices looked reasonable during planning.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'The q-error cascade view shows the row estimate moving through later decisions. A predicate estimate becomes a join-size estimate. The join-size estimate becomes another join-size estimate. The final estimate affects memory and plan choice. The damage comes from reuse: later components trust earlier guesses as if they were facts.',
        'The join-order trap view shows a different failure. The optimizer can enumerate both AB then C and BC then A. If AB is estimated tiny but is actually huge, the estimated winner becomes the actual loser. The plan search did not fail to see the better shape; it failed to value the shapes with true row counts.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Row-count errors compound because each plan node changes the data distribution seen by the next node. After a selective join, later predicates may run on a much smaller relation. After a bad first join, later predicates may run on a huge intermediate that has to be materialized, sorted, hashed, or shuffled.',
        'The multiplicative nature of the error is why q-error is more informative than an absolute row difference. Missing by 10,000 rows may be harmless if both estimates are near a billion, and catastrophic if the plan expected 10 rows. Optimizers make threshold decisions: use an index or scan, hash or nested loop, keep in memory or spill. Multiplicative misses cross those thresholds.',
        'Plan stability also depends on estimates. When a small statistics change makes two candidate costs swap order, a query can flip from fast to slow even though the SQL text did not change. That looks mysterious until you inspect the estimated intermediate sizes that made the new plan look cheaper.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'More statistics are not free. Histograms, most-common-value lists, extended dependency statistics, and high statistics targets consume storage, ANALYZE time, planning time, and operational attention. The goal is not to model every distribution perfectly. The goal is to spend statistics budget where wrong estimates change plan choices.',
        'Hints and forced plans are a tempting repair, but they treat one symptom. They can be useful during an incident or for a narrow vendor limitation, yet they also freeze assumptions. If the data distribution changes again, a forced join order can become the next outage. A better long-term fix usually improves the estimate, exposes a constraint, or changes the query shape so the optimizer has better evidence.',
        'Adaptive execution is another tradeoff. Systems such as Spark can change decisions after seeing runtime shuffle sizes. That helps when planning-time estimates are weak, but it adds complexity, barriers, and sometimes late-stage reoptimization costs. It does not remove the need for good statistics near the leaves of the plan.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Correlation is the classic failure. If country and currency are correlated, multiplying independent selectivities can predict far fewer rows than actually match. Extended statistics or rewritten predicates can help the optimizer see that the columns are not independent.',
        'Skew is another failure. A predicate on a common tenant, hot customer, or popular status value behaves differently from a predicate on a rare value. Most-common-value lists and parameter-sensitive planning can help, but generic prepared plans may still choose a compromise that is wrong for important parameter values.',
        'Stale statistics create a simpler but common failure. Bulk loads, deletes, tenant growth, seasonal traffic, or feature launches can change distributions before automatic statistics refresh catches up. The optimizer may be faithfully using evidence from yesterday against data from today.',
        'Opaque expressions also hurt. User-defined functions, casts, JSON paths, non-sargable predicates, and complex expressions may hide selectivity from the planner. An expression index, generated column, constraint, or query rewrite can sometimes turn an opaque predicate into a visible one.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'When a query regresses, collect the plan text, estimated rows, actual rows, join order, join algorithms, row widths, memory spills, sort spills, statistics age, and the data event that changed the distribution. The slowest node is not enough. You need the evidence trail that explains why the optimizer selected that node.',
        'Compute q-error per node and look for the first large miss. If the first large miss is a base predicate, inspect table statistics, histograms, MCVs, null fraction, and whether the predicate is visible to the planner. If the miss first appears at a join, inspect distinct counts, uniqueness, foreign keys, skew, and correlation across join keys.',
        'Separate estimator repairs from executor repairs. Increasing work memory may reduce a spill, but it does not explain why the plan expected a tiny build side. Adding an index may make a different plan possible, but it may not be chosen until the cardinality estimate changes. Good incident notes say whether the fix changed estimates, changed available paths, or merely forced one plan.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A three-way join has alternatives AB then C and BC then A. The planner estimates AB at 100 rows and BC at 1,000,000 rows, so AB looks like the obvious first join. In reality AB produces 5,000,000 rows and BC produces 5,000 rows. The chosen plan creates a huge intermediate, spills a hash table, and sorts far more data than expected.',
        'The wrong repair would be "never use that join algorithm." The right repair starts by asking why AB was estimated so small and why BC was estimated so large. Maybe A.status and B.tenant_id are correlated. Maybe B-C has a foreign-key relationship that was not declared. Maybe statistics were stale after a bulk load. Maybe a prepared statement hid a hot parameter value behind a generic plan.',
        'After repair, the same optimizer machinery can pick the better order. If the estimate for BC becomes close to 5,000 rows, the DP or memo search can choose BC first, keep the intermediate small, size memory correctly, and avoid the spill. The optimizer did not need a new search algorithm. It needed a less false cardinality story.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Leis et al., "How Good Are Query Optimizers, Really?", https://www.vldb.org/pvldb/vol9/p204-leis.pdf and ACM DOI https://dl.acm.org/doi/10.14778/2850583.2850594; PostgreSQL row estimation examples at https://www.postgresql.org/docs/current/row-estimation-examples.html; System R access path selection at https://web.eecs.umich.edu/~michjc/eecs584/Papers/selinger_1979.pdf.',
        'Study PostgreSQL Statistics Histogram & MCV, PostgreSQL Query Planner Case Study, Selinger DP Join Order Optimizer, Cascades Memo Query Optimizer, SQL Join Algorithms Primer, Volcano Iterator Query Execution, Runtime Bloom Filter Join Pruning, and Spark Adaptive Query Execution next. The recurring pattern is evidence, search, physical cost, and feedback when runtime reality disagrees.',
      ],
    },
  ],
};
