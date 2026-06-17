// Cascades memo optimizer: equivalent expressions grouped and optimized by goals.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'cascades-memo-query-optimizer',
  title: 'Cascades Memo Query Optimizer',
  category: 'Systems',
  summary: 'Represent equivalent logical expressions in memo groups, fire rewrite and implementation rules, and search physical plans by required properties.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['memo groups', 'rules and enforcers'], defaultValue: 'memo groups' },
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

function memoGraph(title) {
  return graphState({
    nodes: [
      { id: 'g0', label: 'G0', x: 0.8, y: 3.5, note: 'ABC' },
      { id: 'g1', label: 'G1', x: 3.0, y: 2.0, note: 'AB' },
      { id: 'g2', label: 'G2', x: 3.0, y: 5.0, note: 'BC' },
      { id: 'scanA', label: 'A', x: 5.2, y: 1.0, note: 'scan group' },
      { id: 'scanB', label: 'B', x: 5.2, y: 3.5, note: 'scan group' },
      { id: 'scanC', label: 'C', x: 5.2, y: 6.0, note: 'scan group' },
      { id: 'impl', label: 'impl', x: 7.4, y: 3.5, note: 'ops' },
      { id: 'best', label: 'best', x: 9.0, y: 3.5, note: 'cost' },
    ],
    edges: [
      { id: 'e-g0-g1', from: 'g0', to: 'g1', weight: '' },
      { id: 'e-g0-g2', from: 'g0', to: 'g2', weight: '' },
      { id: 'e-g1-a', from: 'g1', to: 'scanA', weight: '' },
      { id: 'e-g1-b', from: 'g1', to: 'scanB', weight: '' },
      { id: 'e-g2-b', from: 'g2', to: 'scanB', weight: '' },
      { id: 'e-g2-c', from: 'g2', to: 'scanC', weight: '' },
      { id: 'e-g0-impl', from: 'g0', to: 'impl', weight: '' },
      { id: 'e-impl-best', from: 'impl', to: 'best', weight: '' },
    ],
  }, { title });
}

function* memoGroups() {
  yield {
    state: memoGraph('The memo groups equivalent expressions'),
    highlight: { active: ['g0', 'g1', 'g2', 'e-g0-g1', 'e-g0-g2'], found: ['best'] },
    explanation: 'A Cascades optimizer stores equivalent logical expressions in memo groups. One group means one logical result, even if many expression trees can produce it.',
    invariant: 'A memo group represents equivalence of result, not one specific physical algorithm.',
  };

  yield {
    state: labelMatrix(
      'Memo contents',
      [
        { id: 'g0', label: 'G0' },
        { id: 'g1', label: 'G1' },
        { id: 'g2', label: 'G2' },
        { id: 'gA', label: 'GA' },
      ],
      [
        { id: 'logical', label: 'logical exprs' },
        { id: 'physical', label: 'physical exprs' },
        { id: 'best', label: 'best by goal' },
      ],
      [
        ['(AB)C, A(BC)', 'hash/merge/loop', 'cost map'],
        ['A join B', 'hash or merge', 'by order'],
        ['B join C', 'hash or loop', 'by rows'],
        ['scan A', 'seq/index', 'by order'],
      ],
    ),
    highlight: { active: ['g0:logical', 'g0:physical', 'g0:best'], found: ['gA:physical'] },
    explanation: 'The memo avoids duplicating common subexpressions. It also stores best-known physical implementations for different optimization goals.',
  };

  yield {
    state: memoGraph('Optimization is goal-directed search through the memo'),
    highlight: { active: ['g0', 'impl', 'best', 'e-g0-impl', 'e-impl-best'], compare: ['g1', 'g2'] },
    explanation: 'A request such as "produce G0 sorted by date" becomes an optimization goal. The optimizer explores expressions in G0, asks child groups for required properties, and caches the best result.',
  };

  yield {
    state: labelMatrix(
      'Why memo beats raw tree enumeration',
      [
        { id: 'reuse', label: 'reuse' },
        { id: 'rules', label: 'rules' },
        { id: 'goals', label: 'goals' },
        { id: 'prune', label: 'prune' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['shared subplans', 'memo memory'],
        ['extensible', 'rule control'],
        ['properties', 'more states'],
        ['bounds', 'estimate risk'],
      ],
    ),
    highlight: { active: ['reuse:benefit', 'rules:benefit', 'goals:benefit'], compare: ['prune:cost'] },
    explanation: 'Cascades is useful when the optimizer has many rewrite rules and physical implementations. The memo turns that search into a structured, cached exploration.',
  };

  yield {
    state: memoGraph('Complete case: ORCA-style extensible optimizer'),
    highlight: { active: ['g0', 'g1', 'g2', 'impl', 'best'], found: ['scanA', 'scanB', 'scanC'] },
    explanation: 'An extensible optimizer can add a new physical operator or rewrite rule without hard-coding a new enumerator for every query shape. The memo is the shared search space.',
  };
}

function* rulesAndEnforcers() {
  yield {
    state: labelMatrix(
      'Rule types',
      [
        { id: 'assoc', label: 'join assoc' },
        { id: 'commute', label: 'join commute' },
        { id: 'push', label: 'filter pushdown' },
        { id: 'impl', label: 'implementation' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['(A join B) join C', 'A join (B join C)'],
        ['A join B', 'B join A'],
        ['filter over join', 'filter near scan'],
        ['logical join', 'hash/merge/loop join'],
      ],
    ),
    highlight: { active: ['assoc:output', 'push:output', 'impl:output'], compare: ['commute:output'] },
    explanation: 'Transformation rules create logically equivalent expressions. Implementation rules turn logical expressions into physical operators. Both enter the memo.',
    invariant: 'Rules must preserve semantics; costing decides whether their results are useful.',
  };

  yield {
    state: memoGraph('Enforcers provide required physical properties'),
    highlight: { active: ['impl', 'best'], found: ['g0'], compare: ['scanA', 'scanB'] },
    explanation: 'If a parent needs sorted output and the cheapest child is unordered, the optimizer can add an enforcer such as Sort. Enforcers satisfy properties at a cost.',
  };

  yield {
    state: labelMatrix(
      'Optimization goals',
      [
        { id: 'unordered', label: 'any order' },
        { id: 'sorted', label: 'sorted by key' },
        { id: 'partitioned', label: 'partitioned' },
        { id: 'limited', label: 'first N rows' },
      ],
      [
        { id: 'candidate', label: 'candidate' },
        { id: 'enforcer', label: 'enforcer?' },
      ],
      [
        ['hash join', 'none'],
        ['merge join', 'sort maybe'],
        ['local join', 'shuffle maybe'],
        ['index path', 'top-N maybe'],
      ],
    ),
    highlight: { active: ['sorted:candidate', 'sorted:enforcer'], found: ['partitioned:enforcer'] },
    explanation: 'Physical properties turn "same rows" into multiple possible delivered forms. Cascades tracks those forms explicitly instead of hiding them in ad hoc planner code.',
  };

  yield {
    state: labelMatrix(
      'Search failure modes',
      [
        { id: 'rules', label: 'too many rules' },
        { id: 'cycle', label: 'rewrite cycle' },
        { id: 'cost', label: 'bad cost' },
        { id: 'timeout', label: 'timeout' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'guardrail', label: 'guardrail' },
      ],
      [
        ['memo blowup', 'promise/order rules'],
        ['same expr returns', 'dedupe group'],
        ['wrong best', 'stats tests'],
        ['partial search', 'fallback plan'],
      ],
    ),
    highlight: { active: ['rules:guardrail', 'cycle:guardrail'], compare: ['cost:symptom'], found: ['timeout:guardrail'] },
    explanation: 'A memo optimizer is powerful but needs engineering guardrails: rule promises, duplicate detection, cost bounds, timeouts, and explainability.',
  };

  yield {
    state: memoGraph('Complete case: add a new vectorized hash join'),
    highlight: { active: ['impl', 'best'], found: ['g0'], compare: ['g1', 'g2'] },
    explanation: 'A new vectorized hash join can be added as an implementation rule for logical joins. The memo lets it compete with merge and nested-loop joins under the same goals and cost model.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'memo groups') yield* memoGroups();
  else if (view === 'rules and enforcers') yield* rulesAndEnforcers();
  else throw new InputError('Pick a Cascades optimizer view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQL asks for rows, not a procedure. For a three-table query, the engine may scan tables in different orders, push filters below joins, choose hash joins or merge joins, preserve sort order, repartition data, or add a sort before the final result. A real optimizer needs a disciplined way to explore those choices.',
        'Cascades exists for optimizers that are too large for a fixed hand-written search. It represents the search space as memo groups, fires logical and physical rules into those groups, and asks each group for the cheapest plan that satisfies a required goal.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious optimizer is a custom enumerator. Generate a few join orders, apply some if-statements for predicate pushdown, pick physical operators, and add another special case whenever a query regresses. That approach is simple while the engine has few operators and few rewrites.',
        'The wall is repeated work and tangled control flow. The same logical subplan can be reached through many rewrite paths. The same child may be needed unordered for one parent and sorted for another. A new physical operator should compete everywhere it is valid, but a hand-coded planner often requires edits across many unrelated branches.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A memo group represents a logical equivalence class. Every expression in the group produces the same rows, even if it has a different tree shape. The group can contain logical alternatives, physical implementations, and cached best plans for different property requirements.',
        'That single separation changes the optimizer. Rules can add possibilities without choosing them immediately. Costing can compare implementations later. Required properties such as sort order, partitioning, or rewindability become part of the optimization goal instead of hidden planner state.',
      ],
    },
    {
      heading: 'How memo optimization works',
      paragraphs: [
        'The optimizer starts with an initial logical expression and inserts it into a memo group. Transformation rules add equivalent logical expressions, such as join associativity, join commutativity, predicate pushdown, projection pruning, and common-subexpression factoring. Implementation rules add physical expressions, such as hash join, merge join, nested loop, sequential scan, index scan, vectorized scan, or distributed exchange.',
        'Optimization is goal directed. A parent asks a group for the cheapest way to produce its rows with a required property. The group explores its expressions, asks child groups for their own required properties, inserts enforcers such as Sort or Exchange when needed, computes costs, and caches the result for that goal.',
        'The memo does not mean every plan is materialized as a full tree. It stores shared groups and references between them, so alternatives reuse the same subproblems. That is why the animation shows G0, G1, and G2 as shared nodes rather than a forest of repeated trees.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because query optimization has both equivalence and choice. Relational algebra gives legal rewrites: many expressions can describe the same result. Physical planning adds implementation choices: many algorithms can produce that result with different costs and delivered properties.',
        'The memo is a dynamic-programming table for a rule-based search space. When a child group has already found the best unordered plan, another parent can reuse it. When a sorted plan is needed, the same group can optimize under a different goal and cache that answer separately.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'In the memo-groups view, read each G node as a set of equivalent ways to produce the same relation. G0 is the whole query, while G1 and G2 are reusable join subresults. The edges are not execution edges yet; they are references inside the search space.',
        'In the rules-and-enforcers view, watch the distinction between transformations, implementations, and property repair. Associativity and commutativity add logical equivalents. Implementation rules add algorithms. Enforcers add work, such as sorting or shuffling, only when a parent goal requires a property the child did not naturally deliver.',
      ],
    },
    {
      heading: 'Worked example: a three-table query',
      paragraphs: [
        'Suppose a dashboard query joins Orders, Customers, and Regions, filters Orders by date, filters Regions by country, and asks for output sorted by order date. The first expression may look like `(Orders join Customers) join Regions`, but the optimizer can also consider `Orders join (Customers join Regions)` and can push the date filter down to Orders before either join.',
        'The memo puts the full three-table result in one group. It puts each two-table subresult in its own group. The Orders scan group may contain a sequential scan, an index scan by date, and a bitmap path. If the final goal asks for rows sorted by date, the optimizer can prefer an index path that preserves order, a merge join that keeps order, or a cheaper unordered plan plus a final Sort.',
        'Now add a new vectorized hash join. In a Cascades optimizer, it enters as an implementation rule for logical joins. It can compete in every join group without writing a new enumerator for every query shape. The cost model decides when it wins.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The memo prevents duplicate search, but it does not make search free. Rule explosion can fill the memo with alternatives that will never win. Practical Cascades systems need rule promises, duplicate detection, top-down bounds, timeouts, and fallback plans.',
        'The other hard cost is cardinality estimation. A beautiful memo over bad row estimates can still choose the wrong plan. If the optimizer thinks a filter returns 100 rows when it returns 10 million, the best cached plan may be confidently bad.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Cascades wins in extensible SQL engines with many rewrites, many physical operators, and interesting physical properties. It is especially useful when an engine evolves over time and new rules or operators must compose with old ones.',
        'It also wins for explainability. A memo gives the optimizer a structured search space that can be inspected: which rules fired, which groups formed, which properties were requested, which enforcers were inserted, and why one plan won.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the rule set is undisciplined. Cyclic rewrites, overly broad rules, and weak pruning can make the memo huge before useful costing happens. It also fails when timeout behavior returns unstable plans under load.',
        'It is not a replacement for statistics, runtime feedback, or engineering judgment. Cascades organizes the search. It does not guarantee that the cost model understands skew, correlation, network cost, cache effects, or memory spills.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Treat every rule as a contract. A transformation rule must prove semantic equivalence for its input pattern. An implementation rule must state required child properties, delivered output properties, and cost components. If that metadata is vague, the memo fills with plans that cannot be compared cleanly.',
        'Put limits around exploration from the beginning. Track rule fire counts, group count, expression count, best-cost bounds, timeout reason, and fallback plan. A planner that times out silently is hard to debug; a planner that can explain which group consumed the budget can be improved.',
        'Test the optimizer with paired queries that should share a group and adversarial queries that should not. Include outer joins, null semantics, volatile functions, limits, sort requirements, distribution requirements, and correlated predicates. Many optimizer bugs come from a rule that is valid for inner joins but wrong for a richer SQL feature.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Selinger DP Join Order Optimizer for the older dynamic-programming baseline, PostgreSQL Query Planner Case Study for a production planner pipeline, Cardinality Estimation Error Propagation for why bad row counts spread, SQL Join Algorithms Primer for physical operators, Spark Adaptive Query Execution Case Study for runtime plan repair, and Volcano Iterator Query Execution for how a chosen plan runs.',
      ],
    },
  ],
};
