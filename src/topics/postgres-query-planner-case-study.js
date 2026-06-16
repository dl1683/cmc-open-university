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
      heading: 'What it is',
      paragraphs: [
        'The PostgreSQL query planner chooses how a SQL statement should run. It considers scans, indexes, join orders, join algorithms, sorts, aggregates, parallelism, and cost settings, then emits a plan for the executor.',
        'This case study sits between Database Indexing, B-Trees, SQLite B-Tree Pager Case Study, and analytical engine topics. It shows that a good data structure is only useful if the optimizer can prove that using it is cheaper than the alternatives.',
        'The planner is therefore a decision system over imperfect information. It knows table definitions, index definitions, constraints, statistics samples, and cost constants. It does not know the future parameter distribution, the exact cache state, or every correlation in the data unless those facts have been modeled.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'PostgreSQL parses and rewrites SQL, then enumerates possible paths. Table statistics from ANALYZE estimate selectivity and row counts. Index definitions expose access paths. The cost model compares CPU work and page IO using configurable parameters.',
        'The output is a tree of executor nodes. EXPLAIN shows estimated cost and estimated rows. EXPLAIN ANALYZE runs the query and adds actual time and row counts. With BUFFERS enabled, it also shows page activity, which often separates CPU problems from IO problems.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Planning is hard because row estimates compound. A small selectivity error near the leaves can choose the wrong join order, which can multiply into a bad nested loop, sort, or hash-table size. Correlated columns are especially dangerous when statistics treat predicates independently.',
        'Extended statistics, fresh ANALYZE data, partial indexes, expression indexes, and query rewrites all help by changing what the planner knows or what paths it can legally choose. The strongest debugging habit is comparing estimated rows to actual rows at every plan node.',
        'Cost settings can also encode deployment reality. Storage with very low random-read cost should not be modeled like spinning disks, and a memory-starved instance should not be tuned like a large analytical server. Planner behavior is partly data structure theory and partly honest hardware economics.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every production PostgreSQL system eventually becomes a planner case study: a query regresses after a data distribution shift, an index is ignored, a join order flips, or a bulk load leaves statistics stale. The fix is evidence-driven EXPLAIN work, not folklore.',
        'A complete case study is a multi-tenant events table. A dashboard query filters tenant_id, event_time, and event_type. If statistics miss tenant skew, PostgreSQL may choose a broad scan. A partial index and extended statistics can make the selective path visible.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The planner is not a mind reader. An index can exist and still be ignored if the estimated cost is higher, if the predicate does not match, or if stale statistics hide selectivity. Conversely, forcing an index can mask the real problem and hurt different parameter values.',
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
