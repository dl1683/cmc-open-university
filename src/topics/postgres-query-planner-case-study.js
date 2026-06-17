// PostgreSQL query planner: statistics, paths, cost estimates, and EXPLAIN.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'postgres-query-planner-case-study',
  title: 'PostgreSQL Query Planner Case Study',
  category: 'Systems',
  summary: 'How PostgreSQL chooses a plan: rewrite SQL, estimate cardinality from statistics, enumerate access paths, and inspect the result with EXPLAIN.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['planner pipeline', 'bad estimate'], defaultValue: 'planner pipeline' },
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

function plannerGraph(title) {
  return graphState({
    nodes: [
      { id: 'sql', label: 'SQL query', x: 0.8, y: 3.5, note: 'text' },
      { id: 'parse', label: 'parse tree', x: 2.2, y: 3.5, note: 'syntax' },
      { id: 'rewrite', label: 'rewrite', x: 3.6, y: 2.0, note: 'views/rules' },
      { id: 'stats', label: 'statistics', x: 3.6, y: 5.0, note: 'ANALYZE' },
      { id: 'paths', label: 'candidate paths', x: 5.6, y: 3.5, note: 'scan/join choices' },
      { id: 'cost', label: 'cost model', x: 7.2, y: 3.5, note: 'rows and IO' },
      { id: 'plan', label: 'chosen plan', x: 8.8, y: 3.5, note: 'executor tree' },
    ],
    edges: [
      { id: 'e-sql-parse', from: 'sql', to: 'parse', weight: 'parse' },
      { id: 'e-parse-rewrite', from: 'parse', to: 'rewrite', weight: 'rewrite' },
      { id: 'e-rewrite-paths', from: 'rewrite', to: 'paths', weight: 'logical query' },
      { id: 'e-stats-paths', from: 'stats', to: 'paths', weight: 'row estimates' },
      { id: 'e-paths-cost', from: 'paths', to: 'cost', weight: 'estimate' },
      { id: 'e-cost-plan', from: 'cost', to: 'plan', weight: 'pick cheapest' },
    ],
  }, { title });
}

function* plannerPipeline() {
  yield {
    state: plannerGraph('PostgreSQL turns SQL into an executable plan'),
    highlight: { active: ['sql', 'parse', 'rewrite', 'paths', 'e-sql-parse', 'e-parse-rewrite', 'e-rewrite-paths'], compare: ['stats'] },
    explanation: 'PostgreSQL does not execute SQL text directly. It parses and rewrites the query, builds candidate scan and join paths, estimates their costs, and chooses an executor tree.',
  };

  yield {
    state: labelMatrix(
      'Planner inputs',
      [
        { id: 'schema', label: 'schema' },
        { id: 'indexes', label: 'indexes' },
        { id: 'stats', label: 'statistics' },
        { id: 'settings', label: 'cost settings' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['tables, columns, constraints', 'valid plans'],
        ['B-tree, GIN, BRIN', 'access paths'],
        ['histograms, MCVs, ndistinct', 'cardinality estimates'],
        ['random_page_cost', 'cost comparison'],
      ],
    ),
    highlight: { active: ['stats:effect', 'indexes:effect'], compare: ['settings:effect'] },
    explanation: 'Indexes only matter if the planner believes they reduce cost. Statistics tell the planner how many rows a predicate or join is likely to produce.',
    invariant: 'The planner optimizes estimates; EXPLAIN ANALYZE reveals actuals.',
  };

  yield {
    state: plannerGraph('Candidate paths compete by estimated cost'),
    highlight: { active: ['paths', 'cost', 'plan', 'e-paths-cost', 'e-cost-plan'], found: ['stats'] },
    explanation: 'The same query may have a sequential scan path, an index scan path, a bitmap scan path, and many join orders. The chosen plan is the estimated cheapest path, not necessarily the one a human expected.',
  };

  yield {
    state: labelMatrix(
      'EXPLAIN fields to read first',
      [
        { id: 'node', label: 'node type' },
        { id: 'rows', label: 'rows' },
        { id: 'actual', label: 'actual rows/time' },
        { id: 'buffers', label: 'buffers' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'diagnosis', label: 'diagnosis' },
      ],
      [
        ['scan/join/sort kind', 'plan shape'],
        ['planner estimate', 'bad stats clue'],
        ['runtime measurement', 'estimation gap'],
        ['page IO evidence', 'cache and disk pressure'],
      ],
    ),
    highlight: { found: ['rows:diagnosis', 'actual:diagnosis', 'buffers:diagnosis'], compare: ['node:meaning'] },
    explanation: 'EXPLAIN is the planner debugger. When estimated rows and actual rows diverge by orders of magnitude, the rest of the plan may be wrong even if each operator is implemented correctly.',
  };
}

function* badEstimate() {
  yield {
    state: labelMatrix(
      'Correlated predicate example',
      [
        { id: 'independent', label: 'independent guess' },
        { id: 'real', label: 'real data' },
        { id: 'plan', label: 'chosen plan' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'assumption', label: 'assumption' },
        { id: 'outcome', label: 'outcome' },
      ],
      [
        ['city and zip unrelated', 'tiny row estimate'],
        ['city determines zip', 'many rows'],
        ['nested loop looks cheap', 'loops explode'],
        ['extended statistics', 'dependency learned'],
      ],
    ),
    highlight: { active: ['independent:outcome', 'real:outcome', 'plan:outcome'], found: ['fix:outcome'] },
    explanation: 'A classic bad plan starts with a bad cardinality estimate. If predicates are correlated but the planner treats them as independent, it may choose a nested loop that becomes expensive at runtime.',
  };

  yield {
    state: plannerGraph('Statistics refresh changes the cost landscape'),
    highlight: { active: ['stats', 'paths', 'cost', 'e-stats-paths'], compare: ['plan'] },
    explanation: 'ANALYZE samples table data and updates planner statistics. Extended statistics can capture dependencies, most-common value combinations, and ndistinct information across columns.',
  };

  yield {
    state: labelMatrix(
      'Bad-plan triage loop',
      [
        { id: 'explain', label: 'EXPLAIN ANALYZE' },
        { id: 'compare', label: 'compare rows' },
        { id: 'inspect', label: 'inspect indexes' },
        { id: 'change', label: 'change one thing' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'move', label: 'move' },
      ],
      [
        ['what actually happened?', 'capture actuals and buffers'],
        ['where did estimate break?', 'find first big skew'],
        ['was a path available?', 'check index and predicate shape'],
        ['stats/index/query rewrite?', 're-run and compare'],
      ],
    ),
    highlight: { found: ['explain:move', 'compare:move'], active: ['change:move'] },
    explanation: 'Good planner debugging is disciplined. Start from the first bad estimate, not from the slowest-looking node at the top of the plan.',
  };

  yield {
    state: labelMatrix(
      'Complete production case study',
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'cause', label: 'cause' },
        { id: 'repair', label: 'repair' },
        { id: 'guardrail', label: 'guardrail' },
      ],
      [
        { id: 'detail', label: 'detail' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['query jumps from 50ms to 8s', 'plan changed'],
        ['stale stats after bulk load', 'estimates lied'],
        ['ANALYZE plus partial index', 'make cheap path visible'],
        ['plan regression capture', 'watch row-estimate drift'],
      ],
    ),
    highlight: { active: ['cause:lesson', 'repair:lesson'], found: ['guardrail:lesson'] },
    explanation: 'The production story is not "add an index" blindly. It is: expose the actual plan, find the estimate failure, make a better path visible, and keep evidence for future regressions.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'planner pipeline') yield* plannerPipeline();
  else if (view === 'bad estimate') yield* badEstimate();
  else throw new InputError('Pick a PostgreSQL planner view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A SQL query describes the result, not the procedure. The same query can be a sequential scan, an index scan, a bitmap scan, a nested-loop join, a hash join, a merge join, a parallel plan, or some mixture of those choices. The PostgreSQL planner exists because picking that procedure by hand would make SQL brittle and unportable.',
        'The planner is a decision system over imperfect information. It knows table definitions, index definitions, constraints, sampled statistics, and cost constants. It does not know the exact future cache state, every parameter value, or every correlation in the data unless those facts are represented in statistics or query shape.',
      ],
    },
    {
      heading: 'The tempting wrong answer',
      paragraphs: [
        'A common beginner instinct is to ask why PostgreSQL does not simply use the index. The answer is that an index is only an access path, not a guarantee of lower cost. If the predicate is broad, the table is small, rows are scattered, or the index does not match the expression, scanning can be cheaper.',
        'Another tempting answer is to force the plan that worked yesterday. That can hide the real failure: the estimate drifted, a data distribution changed, a join input grew, or a newly selective predicate was invisible to the planner.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Planning is a search over paths under a cost model. PostgreSQL parses and rewrites SQL, enumerates scan and join alternatives, estimates row counts from statistics, prices CPU and page IO, then sends the cheapest estimated tree to the executor.',
        'The fragile number is cardinality. A small row-estimate error near the leaves can select the wrong join order, which can multiply into a bad nested loop, sort, hash-table size, or memory spill. Correlated columns are especially dangerous when the planner treats predicates as independent.',
      ],
    },
    {
      heading: 'How to inspect a plan',
      paragraphs: [
        'The pipeline animation separates facts from choices. Schema and indexes define what plans are legal. Statistics shape row estimates. Cost settings translate those estimates into a price. The chosen plan is not the only possible plan; it is the cheapest plan according to the information PostgreSQL has.',
        'The bad-estimate view shows the failure mode to look for in EXPLAIN ANALYZE. Estimated rows and actual rows diverge first; the slow operator often appears later as a consequence. Debug from the first large estimate error, not from the most dramatic runtime number at the top.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'PostgreSQL first turns SQL into a query tree, applies rewrites, and builds possible paths. A path might scan a table sequentially, use an index, build a bitmap, join with nested loops, hash, or merge, sort rows, aggregate, or run parallel workers. The planner prices these alternatives with row estimates and cost constants.',
        'Statistics are the planner evidence. Histograms, most-common values, null fractions, distinct counts, and extended statistics help estimate selectivity. If those statistics are stale or cannot express a correlation, the chosen path can be rational according to the planner and still terrible at runtime.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The planner works because SQL is declarative. Users describe the result; the database chooses a physical procedure. That separation lets the same query benefit from new indexes, updated statistics, better join choices, and different hardware without rewriting application code.',
        'Cost-based planning is also why a database can choose not to use an index. An index scan can be slower when it touches many random heap pages or when the table is small enough that a sequential scan is cheaper. The planner is choosing estimated total cost, not checking an index-use checkbox.',
      ],
    },
    {
      heading: 'What to do about bad plans',
      paragraphs: [
        'Start with EXPLAIN ANALYZE and BUFFERS. Compare estimated rows with actual rows at each node. Find the first place the estimate goes badly wrong, then ask what the planner could not see: stale statistics, skew, correlation, a missing partial index, an expression mismatch, or a cost model that does not match the hardware.',
        'Repairs should change the planner evidence or the available paths. ANALYZE refreshes samples. Extended statistics can teach dependencies, most-common value combinations, and ndistinct facts across columns. Partial and expression indexes can expose selective paths. Query rewrites can make predicates visible. Cost settings should reflect real storage and memory behavior.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A multi-tenant events table powers a dashboard. The query filters tenant_id, event_time, and event_type. After a bulk load, one tenant becomes much larger than the rest. The planner still estimates as if the distribution is modest, picks a nested loop, and the query jumps from 50 ms to 8 seconds.',
        'The fix is not blindly adding indexes. The team runs EXPLAIN ANALYZE BUFFERS, finds the first row-estimate gap, refreshes statistics, adds extended statistics for correlated columns, and creates a partial index for the dashboard slice. The next plan uses the visible selective path, and the team stores the plan evidence as a regression guard.',
      ],
    },
    {
      heading: 'Where it fits',
      paragraphs: [
        'This case study connects data structures to optimization. A B-tree, BRIN index, GIN index, or hash table matters only when the optimizer can see why it helps. The planner is the layer that turns structures into execution choices.',
        'A complete production example is a multi-tenant events table. A dashboard filters tenant_id, event_time, and event_type. If statistics miss tenant skew, PostgreSQL may choose a broad scan or a nested loop that explodes. Extended statistics plus a partial index can make the intended path visible and keep the plan stable as data grows.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The planner fails when its evidence is wrong or incomplete. Stale statistics, correlated predicates, parameter-sensitive plans, misleading cost settings, expression mismatch, and missing indexes can all lead to bad choices. The database is not being irrational; it is optimizing from a distorted map.',
        'It also fails when teams debug from intuition instead of evidence. "Use the index" is not a diagnosis. The plan needs actual rows, buffers, timing, and the first estimate error. That discipline prevents random index sprawl and plan hints that hide the real problem.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track slow-query fingerprints, plan changes, row-estimate error, buffer reads, temp spills, sequential-scan surprises, autovacuum and ANALYZE freshness, index usage, and p95/p99 latency by query pattern. These signals tell whether planner evidence is drifting before users report a regression.',
        'For course design, teach this after indexes and join algorithms. Students should see that an index is only a possible path. The planner needs statistics and a cost model to decide whether that path is actually useful.',
      ],
    },
    {
      heading: 'What to remember',
      paragraphs: [
        'The planner is not trying to be clever for its own sake. It is searching for the cheapest physical way to produce a declarative SQL result. When it chooses badly, the first question is what evidence was missing or wrong.',
        'The most important habit is to compare estimated rows with actual rows. That single habit explains many plan regressions. Bad cardinality near the leaves can poison join order, memory sizing, sort choice, and index choice farther up the tree.',
        'A curriculum should make students debug plans with evidence. Read EXPLAIN, find the first bad estimate, change one piece of planner evidence, and compare again. That is a better lesson than memorizing that indexes are good or sequential scans are bad.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL planner statistics documentation at https://www.postgresql.org/docs/current/planner-stats.html, EXPLAIN documentation at https://www.postgresql.org/docs/current/using-explain.html, PostgreSQL executor documentation at https://www.postgresql.org/docs/current/executor.html, and extended statistics examples at https://www.postgresql.org/docs/current/multivariate-statistics-examples.html. Study PostgreSQL Statistics Histogram & MCV for selectivity inputs, Cardinality Estimation Error Propagation for q-error and join-order failure, Selinger DP Join Order Optimizer for subset enumeration, Cascades Memo Query Optimizer for memoized rule search, SQL Join Algorithms Primer for nested-loop/hash/merge choices, and Volcano Iterator Query Execution for how the chosen plan actually runs.',
      ],
    },
  ],
};
