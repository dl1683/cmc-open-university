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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. In "memo groups," each G node is an equivalence class -- a set of expressions that produce the same rows. Edges between groups are references inside the search space, not data-flow edges in a running query. In "rules and enforcers," watch transformation rules add logical alternatives and implementation rules add physical operators into those groups.',
        {type: 'callout', text: 'The memo is the optimizer data structure that makes every equivalent expression compete once per required property.'},
        {
          type: 'table',
          headers: ['Marker', 'Meaning in this animation'],
          rows: [
            ['Active (highlighted)', 'The group or rule the optimizer is currently exploring'],
            ['Compare (dimmed alternate)', 'A sibling alternative the optimizer has not yet chosen between'],
            ['Found (goal marker)', 'The best physical plan cached for a specific required property'],
          ],
        },
        'At each frame: identify which group is being explored, what rule just fired, and whether the result is a new logical equivalent or a new physical implementation. The "impl" and "best" nodes in the graph represent the transition from logical search to physical costing -- the moment equivalence becomes a concrete algorithm with a cost.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQL describes what rows to return, not how to fetch them. A three-table join query has multiple legal join orders, each combinable with different physical algorithms (hash join, merge join, nested loop), different scan methods (sequential, index, bitmap), and different delivered properties (sorted, partitioned, unordered). The optimizer must explore that space and pick the cheapest plan.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph arranged in topological order with arrows flowing from earlier to later nodes', caption: 'Logical query alternatives form a DAG-shaped search space before physical costing chooses one execution plan. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Topological_Ordering.svg.'},
        {
          type: 'diagram',
          label: 'Search space explosion for a 3-table join',
          text: 'Tables: Orders (O), Customers (C), Regions (R)\n\nJoin orders:        Physical choices per join:    Properties:\n  (O join C) join R   hash / merge / loop            sorted?\n  O join (C join R)   hash / merge / loop            partitioned?\n  (O join R) join C   hash / merge / loop            unordered?\n  ...                 ...                            ...\n\n3 orders x 3 algorithms x 2 joins x 3 scan types x property goals\n= hundreds of candidate plans for just 3 tables',
        },
        'With five tables the count reaches thousands; with ten it reaches millions. An optimizer needs a structure that prevents re-deriving the same subplan, shares work across goals, and lets new operators compete without rewriting the search code.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first optimizer is a hand-coded enumerator. Generate join orders with nested loops, apply if-statements for predicate pushdown, hard-code physical operator selection per pattern, and add a new special case whenever a query regresses.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Hand-coded optimizer: simple but brittle\nfunction optimize(query) {\n  const joins = enumerateJoinOrders(query.tables);\n  let bestPlan = null;\n  let bestCost = Infinity;\n  for (const order of joins) {\n    // Hard-coded: always try hash join first\n    let plan = applyHashJoin(order);\n    if (query.hasOrderBy) plan = addSort(plan);\n    // Special case: merge join if both sides sorted\n    if (bothSidesSorted(order)) plan = applyMergeJoin(order);\n    // Special case added after regression #347\n    if (hasSkewedFilter(order)) plan = addBitmapScan(plan);\n    const cost = estimate(plan);\n    if (cost < bestCost) { bestPlan = plan; bestCost = cost; }\n  }\n  return bestPlan;\n}',
        },
        'This works while the engine has few operators and few rewrite patterns. Teams can hold the full decision tree in their heads, and new features arrive slowly enough that each can be wired in by hand.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hand-coded approach breaks on three fronts simultaneously:',
        {
          type: 'bullets',
          items: [
            'Duplicated subplans. The subexpression (Orders join Customers) appears in multiple join orders. A hand-coded enumerator re-derives and re-costs it each time, because there is no shared structure to detect the duplicate.',
            'Tangled property logic. The same child may be needed unordered for one parent and sorted for another. Without explicit property tracking, the planner either misses the enforcer or adds one unconditionally, wasting work.',
            'Combinatorial rule interaction. Adding a new physical operator (vectorized hash join) or a new rewrite (predicate transitive closure) requires edits across every enumerator branch. Ten operators and ten rewrites do not add linearly -- they multiply into code paths no one can audit.',
          ],
        },
        {
          type: 'note',
          text: 'The wall is not plan count. It is the inability to share subresults, compose rules, and track properties in one coherent structure. A system with 50 rules and 12 physical operators cannot be maintained as if-else branches -- the cross-product of interactions is too large to hold in code review.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Cascades organizes the search into four mechanisms: memo groups, transformation rules, implementation rules, and goal-directed optimization.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg', alt: 'Directed acyclic graph with arrows showing dependencies between nodes', caption: 'A memo group graph shares subexpressions across alternatives so parents can reuse optimized child goals. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph.svg.'},
        {
          type: 'diagram',
          label: 'Cascades memo structure for (O join C) join R',
          text: 'G0  [full result: O-C-R]\n |--- logical: (O join C) join R\n |--- logical: O join (C join R)      <-- added by associativity rule\n |--- physical: hash(G1, G2)          <-- added by implementation rule\n |--- best(unsorted): hash(G1, G2) cost=450\n |--- best(sorted by date): merge(G1, G2) cost=520\n |\nG1  [O join C]\n |--- logical: O join C\n |--- logical: C join O               <-- added by commutativity rule\n |--- physical: hash(GA, GB)\n |--- physical: merge(GA, GB)\n |\nG2  [C join R]  (or R, depending on rewrite)\nGA  [scan O]  -- seq scan, index scan by date, bitmap scan\nGB  [scan C]  -- seq scan, index scan by id',
        },
        'Step 1: Insert the initial logical expression into memo group G0. Child subexpressions get their own groups (G1, G2, GA, GB, etc.). If a subexpression already exists in a group, the memo detects the duplicate and reuses the group.',
        'Step 2: Fire transformation rules. Join associativity rewrites (A join B) join C into A join (B join C) and inserts the new expression into G0. Join commutativity rewrites A join B into B join A and inserts into G1. Predicate pushdown moves a filter from above a join to below it, into the scan group. Each new expression enters the memo; it does not replace the old one.',
        'Step 3: Fire implementation rules. A logical join becomes candidate physical operators: hash join, merge join, nested loop. A logical scan becomes sequential scan, index scan, or bitmap scan. Each physical expression records its cost formula and delivered properties.',
        'Step 4: Optimize by goal. A parent asks G0 for the cheapest plan delivering rows sorted by date. G0 explores its physical expressions, asks child groups for their own cheapest plans under required child properties, and inserts enforcers (Sort, Exchange) when a child does not naturally deliver what the parent needs. The result is cached: G0 now knows its best sorted plan and its best unsorted plan separately.',
        {
          type: 'code',
          language: 'text',
          text: 'optimizeGroup(G0, goal={sorted: date}):\n  for each physical expr P in G0:\n    childGoals = P.requiredChildProperties(goal)\n    childCost  = sum(optimizeGroup(child, childGoal) for each child)\n    totalCost  = P.localCost + childCost\n    if P does not deliver goal.sorted:\n      totalCost += enforcer(Sort).cost\n    if totalCost < G0.best[goal].cost:\n      G0.best[goal] = {plan: P, cost: totalCost}',
        },
        'The recursion terminates because groups are finite, goals are finite, and each (group, goal) pair is computed at most once. Memoization across goals is the core of the efficiency gain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Query optimization has two kinds of structure that Cascades exploits:',
        {
          type: 'table',
          headers: ['Structure', 'What it provides', 'Cascades mechanism'],
          rows: [
            ['Equivalence', 'Many expressions produce the same rows (relational algebra laws)', 'Memo groups: all equivalents share one group'],
            ['Optimal substructure', 'The best plan for a group depends only on the best plans of its children', 'Goal-directed search with memoized (group, goal) answers'],
            ['Property decomposition', 'A parent\'s required property decomposes into child requirements', 'Enforcers bridge the gap when a child cannot deliver a property natively'],
          ],
        },
        'The memo is a dynamic-programming table for a rule-based search space. When G1 has already found its best unsorted plan, any parent needing G1 unsorted reuses that cached answer. When a different parent needs G1 sorted, G1 optimizes under a new goal and caches that answer separately. No subplan is derived twice for the same goal.',
        {
          type: 'quote',
          text: 'The Cascades optimizer framework uses top-down, goal-directed search with memoization to avoid redundant optimization of shared subexpressions.',
          attribution: 'Goetz Graefe, "The Cascades Framework for Query Optimization," IEEE Data Engineering Bulletin, 1995',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Dimension', 'Cost', 'What drives it'],
          rows: [
            ['Memo space', 'O(groups x expressions per group)', 'Number of transformation rules and join orders'],
            ['Optimization time', 'O(groups x goals x physical exprs)', 'Property combinations (sort keys, partitioning schemes)'],
            ['Rule firing', 'Bounded by rule promises + duplicate detection', 'Undisciplined rules cause exponential blowup'],
            ['Cardinality estimation', 'Dominates plan quality', 'Bad row estimates make the best cached plan wrong'],
          ],
        },
        'The memo prevents duplicate search but does not make search free. A join of N tables has O(4^N / N^(3/2)) join orderings by Catalan number growth. Cascades does not reduce that count -- it shares the subproblems across orderings.',
        'Rule explosion is the operational risk. A rewrite that fires into its own output creates a cycle. A rule that matches too broadly fills the memo with alternatives that will never win. Practical systems defend with rule promises (a rule declares its output pattern will not re-trigger itself), duplicate group detection, upper-bound pruning, and hard timeouts.',
        {
          type: 'note',
          text: 'The other hard cost is invisible: cardinality estimation. A perfect memo over wrong row-count estimates produces a confidently bad plan. If the optimizer thinks a filter returns 100 rows when it returns 10 million, it may choose a nested-loop join that is catastrophic at scale. Cascades organizes the search; it does not fix the statistics.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Extensible SQL engines (SQL Server, Greenplum/ORCA, CockroachDB, Apache Calcite). Adding a new physical operator or rewrite rule does not require rewriting the enumerator -- the rule fires into the memo and competes under the cost model.',
            'Engines with rich physical properties: sort order, partitioning, compression, row vs. columnar format. Cascades tracks these explicitly instead of hiding them in planner branches.',
            'Distributed query engines where exchange operators (shuffle, broadcast) are physical choices that interact with join order. The memo lets exchange decisions compose with join decisions in a single search.',
            'Optimizer explainability. The memo is an inspectable search space: which rules fired, which groups formed, which goals were requested, which enforcers were inserted, and why one plan beat another.',
          ],
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/52/OLAP_Cube.svg', alt: 'OLAP cube with product, city, and time dimensions', caption: 'Analytical query engines optimize across dimensions, joins, and aggregation paths; Cascades keeps those physical choices comparable. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:OLAP_Cube.svg.'},
        {
          type: 'diagram',
          label: 'Adding a new operator without changing the search',
          text: 'Before:  G1 physical exprs = {hash_join, merge_join, nested_loop}\nAfter:   G1 physical exprs = {hash_join, merge_join, nested_loop, vectorized_hash}\n\nThe new implementation rule fires into every join group automatically.\nNo enumerator code was modified. The cost model decides when it wins.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Guardrail'],
          rows: [
            ['Cyclic rewrites', 'Same expression re-derived indefinitely, memo grows without bound', 'Rule promises: each rule declares its output will not re-trigger itself'],
            ['Overly broad rules', 'Memo fills with alternatives that never win, search time explodes', 'Pattern specificity requirements and rule priority ordering'],
            ['Bad cardinality estimates', 'Optimizer picks confidently wrong plan (e.g., nested loop on 10M rows)', 'Runtime feedback, adaptive re-optimization, histogram maintenance'],
            ['Timeout instability', 'Different plans chosen under load depending on when the timeout fires', 'Deterministic fallback plan, timeout logging, budget-per-group limits'],
            ['Property combinatorics', 'Too many (group, goal) combinations with compound sort keys', 'Property subsumption: sorted-by-(a,b) satisfies sorted-by-a'],
          ],
        },
        'Cascades is not a replacement for statistics, runtime feedback, or engineering judgment. It organizes the search. It does not guarantee that the cost model understands data skew, column correlation, network latency, cache effects, or memory spill behavior. A well-structured search over a bad cost model finds the best wrong answer efficiently.',
        {
          type: 'note',
          text: 'Many production optimizer bugs come from a transformation rule that is valid for inner joins but wrong for outer joins, anti-joins, or correlated subqueries. Null semantics, volatile functions, and LIMIT propagation are common sources of incorrect rewrites that the memo faithfully caches and reuses.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Goetz Graefe, "The Cascades Framework for Query Optimization," IEEE Data Engineering Bulletin 18(3), 1995 -- the original Cascades paper defining memo groups, rules, properties, and enforcers.',
            'Goetz Graefe, "The Volcano Optimizer Generator: Extensibility and Efficient Search," IEEE ICDE 1993 -- the predecessor to Cascades; Cascades improved Volcano with top-down goal-directed search and better memoization.',
            'P. Griffith Selinger et al., "Access Path Selection in a Relational Database Management System," SIGMOD 1979 -- the System R dynamic-programming optimizer that Cascades generalizes.',
            'Mohamed A. Soliman et al., "Orca: A Modular Query Optimizer Architecture for Big Data," SIGMOD 2014 -- Greenplum/ORCA, a production Cascades implementation with multi-threaded search.',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic', 'Why'],
          rows: [
            ['Prerequisite', 'Selinger DP Join Order Optimizer', 'The dynamic-programming baseline that Cascades extends with rules and properties'],
            ['Physical detail', 'SQL Join Algorithms Primer', 'Hash, merge, and nested-loop joins -- the physical operators that compete inside memo groups'],
            ['Downstream', 'Volcano Iterator Query Execution', 'How the chosen plan actually runs once the optimizer finishes'],
            ['Failure mode', 'Cardinality Estimation Error Propagation', 'Why bad row-count estimates make even a perfect search choose the wrong plan'],
            ['Runtime repair', 'Spark Adaptive Query Execution Case Study', 'What happens when the optimizer gets it wrong and the engine must fix the plan mid-execution'],
            ['Production case', 'PostgreSQL Query Planner Case Study', 'A production planner pipeline that uses bottom-up DP instead of Cascades -- the contrasting design choice'],
          ],
        },
      ],
    },
  ],
};
