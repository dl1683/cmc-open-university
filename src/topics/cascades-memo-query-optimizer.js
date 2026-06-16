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
    { heading: 'What it is', paragraphs: [
      'Cascades is a query optimization framework built around a memo. The memo groups equivalent expressions so the optimizer can explore rewrites, physical implementations, and physical properties without duplicating the same search over and over.',
      'A group is a logical equivalence class. Inside it, there may be many logical expressions and many physical expressions. A best-plan cache maps optimization goals to the cheapest known implementation for that group and property requirement.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Rewrite rules add equivalent logical expressions: join associativity, join commutativity, predicate pushdown, projection pruning, and other transformations. Implementation rules turn logical operators into physical operators: hash join, merge join, nested loop, index scan, vectorized scan, distributed exchange.',
      'An optimization goal asks a group to produce its result with required physical properties, such as sort order or distribution. If a child cannot deliver the property directly, an enforcer such as Sort or Exchange can be inserted at a cost.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The memo controls duplicate work, but rule search can still explode. Practical systems use rule promises, top-down goal-directed search, cost bounds, duplicate detection, timeouts, and fallback plans.',
      'The key risk is still estimate quality. A powerful search over wrong cardinalities can confidently choose a bad plan. The memo makes alternatives visible; it does not make the cost model omniscient.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'An analytical engine adds a new vectorized hash join. In a Cascades-style optimizer, that operator can enter as an implementation rule for logical joins. It competes with merge joins, nested loops, and distributed exchange plans under the same memo groups. The engine does not need a one-off enumerator for every query shape.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Graefe, "The Cascades Framework for Query Optimization", SIGMOD record listing https://www.sigmod.org/publications/dblp/db/journals/debu/Graefe95a.html and PDF mirror https://dsl.cds.iisc.ac.in/~course/TIDS/papers/cascades.pdf; CMU Cascades lecture notes, https://15799.courses.cs.cmu.edu/spring2025/notes/05-cascades.pdf; Orca CTE optimization paper, https://www.vldb.org/pvldb/vol8/p1704-elhelw.pdf. Study Cardinality Estimation Error Propagation, Selinger DP Join Order Optimizer, PostgreSQL Query Planner Case Study, Spark Adaptive Query Execution, SQL Join Algorithms Primer, and Volcano Iterator Query Execution next.',
    ] },
  ],
};
