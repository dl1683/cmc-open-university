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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the planner pipeline as a search over legal physical plans. SQL describes the result, while scan choices, join choices, sort choices, and aggregation choices describe how PostgreSQL might produce it.',
        'In the bad-estimate view, estimated rows and actual rows are the important comparison. The slow node near the top is often a consequence of an earlier cardinality error near a table scan.',
        {type:'callout', text:'The planner is a search engine over legal execution paths, and cardinality estimates are the evidence that makes one path look cheaper than another.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQL is declarative, which means the user states what result is wanted rather than the exact procedure. PostgreSQL needs a planner because one query can be answered by many legal procedures with very different costs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to use an index whenever one exists. Indexes sound like the fast path because they avoid scanning the whole table for selective lookups.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is plan interaction. A bad estimate for one filter can choose the wrong join order, which can choose the wrong join algorithm, which can create a sort, spill, or nested loop explosion.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Planning is cost-based search. PostgreSQL builds possible paths, estimates row counts, prices CPU and IO, and chooses the cheapest estimated tree.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'PostgreSQL parses SQL, applies rewrites, enumerates access paths, considers join orders and join algorithms, and prices plan nodes. Statistics supply evidence such as histograms, most-common values, null fractions, distinct counts, and extended statistics.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness is separate from optimality. A bad plan can still return the right result; it is wrong as an engineering choice because the cost model was misled or the search space lacked a useful path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Planning cost grows with tables, joins, indexes, predicates, and alternatives. A 10x underestimate on one table and a 20x underestimate on another can make a join look 200x smaller than it is, which may choose nested loops where a hash join was needed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The planner is the layer that turns data structures into query behavior. B-trees, BRIN indexes, GIN indexes, bitmap scans, hash joins, and merge joins matter only when the planner can see when they help.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when evidence is wrong or incomplete. Stale statistics, correlated predicates, parameter-sensitive plans, expression mismatch, misleading cost settings, and missing indexes can all distort the map.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A tenant events table has 100 million rows. The planner estimates tenant_id = 42 and event_type = purchase will return 1,000 rows, but EXPLAIN ANALYZE shows 800,000 rows because tenant 42 is a large customer.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PostgreSQL planner statistics documentation at https://www.postgresql.org/docs/current/planner-stats.html, EXPLAIN documentation at https://www.postgresql.org/docs/current/using-explain.html, PostgreSQL executor documentation at https://www.postgresql.org/docs/current/executor.html, and extended statistics examples at https://www.postgresql.org/docs/current/multivariate-statistics-examples.html. Study PostgreSQL Statistics Histogram and MCV, Cardinality Estimation Error Propagation, Selinger DP Join Order Optimizer, Cascades Memo Query Optimizer, SQL Join Algorithms Primer, and Volcano Iterator Query Execution next.',
      ],
    },
  ],
};
