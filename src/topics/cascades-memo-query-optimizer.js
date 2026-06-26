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
  const groupNodes = ['g0', 'g1', 'g2'];
  const groupEdges = ['e-g0-g1', 'e-g0-g2'];
  yield {
    state: memoGraph('The memo groups equivalent expressions'),
    highlight: { active: [...groupNodes, ...groupEdges], found: ['best'] },
    explanation: `A Cascades optimizer stores equivalent logical expressions in memo groups. ${groupNodes.length} groups are shown here. One group means one logical result, even if many expression trees can produce it.`,
    invariant: `A memo group (like ${groupNodes[0]}) represents equivalence of result, not one specific physical algorithm.`,
  };

  const memoRows = [
    { id: 'g0', label: 'G0' },
    { id: 'g1', label: 'G1' },
    { id: 'g2', label: 'G2' },
    { id: 'gA', label: 'GA' },
  ];
  yield {
    state: labelMatrix(
      'Memo contents',
      memoRows,
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
    explanation: `The memo avoids duplicating common subexpressions across ${memoRows.length} groups. It also stores best-known physical implementations for different optimization goals.`,
  };

  const searchActive = ['g0', 'impl', 'best', 'e-g0-impl', 'e-impl-best'];
  const childGroups = ['g1', 'g2'];
  yield {
    state: memoGraph('Optimization is goal-directed search through the memo'),
    highlight: { active: searchActive, compare: childGroups },
    explanation: `A request such as "produce ${searchActive[0].toUpperCase()} sorted by date" becomes an optimization goal. The optimizer explores expressions in ${searchActive[0].toUpperCase()}, asks ${childGroups.length} child groups for required properties, and caches the best result.`,
  };

  const benefitHighlights = ['reuse:benefit', 'rules:benefit', 'goals:benefit'];
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
    highlight: { active: benefitHighlights, compare: ['prune:cost'] },
    explanation: `Cascades is useful when the optimizer has many rewrite rules and physical implementations. The memo turns that search into a structured, cached exploration with ${benefitHighlights.length} key benefits.`,
  };

  const scanGroups = ['scanA', 'scanB', 'scanC'];
  yield {
    state: memoGraph('Complete case: ORCA-style extensible optimizer'),
    highlight: { active: ['g0', 'g1', 'g2', 'impl', 'best'], found: scanGroups },
    explanation: `An extensible optimizer can add a new physical operator or rewrite rule without hard-coding a new enumerator for every query shape. The memo is the shared search space across ${scanGroups.length} scan groups.`,
  };
}

function* rulesAndEnforcers() {
  const ruleRows = [
    { id: 'assoc', label: 'join assoc' },
    { id: 'commute', label: 'join commute' },
    { id: 'push', label: 'filter pushdown' },
    { id: 'impl', label: 'implementation' },
  ];
  const activeOutputs = ['assoc:output', 'push:output', 'impl:output'];
  yield {
    state: labelMatrix(
      'Rule types',
      ruleRows,
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
    highlight: { active: activeOutputs, compare: ['commute:output'] },
    explanation: `Transformation rules create logically equivalent expressions across ${ruleRows.length} rule types. Implementation rules turn logical expressions into physical operators. Both enter the memo.`,
    invariant: `Rules must preserve semantics; costing decides whether their ${activeOutputs.length} highlighted results are useful.`,
  };

  const enforcerFound = ['g0'];
  const enforcerCompare = ['scanA', 'scanB'];
  yield {
    state: memoGraph('Enforcers provide required physical properties'),
    highlight: { active: ['impl', 'best'], found: enforcerFound, compare: enforcerCompare },
    explanation: `If a parent needs sorted output and the cheapest child is unordered, the optimizer can add an enforcer such as Sort. Enforcers satisfy properties at a cost, bridging ${enforcerCompare.length} scan alternatives to group ${enforcerFound[0].toUpperCase()}.`,
  };

  const goalRows = [
    { id: 'unordered', label: 'any order' },
    { id: 'sorted', label: 'sorted by key' },
    { id: 'partitioned', label: 'partitioned' },
    { id: 'limited', label: 'first N rows' },
  ];
  yield {
    state: labelMatrix(
      'Optimization goals',
      goalRows,
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
    explanation: `Physical properties turn "same rows" into ${goalRows.length} possible delivered forms. Cascades tracks those forms explicitly instead of hiding them in ad hoc planner code.`,
  };

  const failureRows = [
    { id: 'rules', label: 'too many rules' },
    { id: 'cycle', label: 'rewrite cycle' },
    { id: 'cost', label: 'bad cost' },
    { id: 'timeout', label: 'timeout' },
  ];
  yield {
    state: labelMatrix(
      'Search failure modes',
      failureRows,
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
    explanation: `A memo optimizer is powerful but needs engineering guardrails against ${failureRows.length} failure modes: rule promises, duplicate detection, cost bounds, timeouts, and explainability.`,
  };

  const newRuleFound = ['g0'];
  const competingGroups = ['g1', 'g2'];
  yield {
    state: memoGraph('Complete case: add a new vectorized hash join'),
    highlight: { active: ['impl', 'best'], found: newRuleFound, compare: competingGroups },
    explanation: `A new vectorized hash join can be added as an implementation rule for logical joins. The memo lets it compete with merge and nested-loop joins under the same goals and cost model, affecting ${competingGroups.length} child groups below ${newRuleFound[0].toUpperCase()}.`,
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
        'Three markers appear throughout both views. Active (highlighted) marks the group or rule the optimizer is currently exploring. Compare (dimmed alternate) marks a sibling alternative the optimizer has not yet chosen between. Found (goal marker) marks the best physical plan cached for a specific required property.',
        'At each frame: identify which group is being explored, what rule just fired, and whether the result is a new logical equivalent or a new physical implementation. The "impl" and "best" nodes in the graph represent the transition from logical search to physical costing -- the moment equivalence becomes a concrete algorithm with a cost.',
        {type: 'image', src: './assets/gifs/cascades-memo-query-optimizer.gif', alt: 'Animated walkthrough of the cascades memo query optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQL describes what rows to return, not how to fetch them. A three-table join query has multiple legal join orders, each combinable with different physical algorithms (hash join, merge join, nested loop), different scan methods (sequential, index, bitmap), and different delivered properties (sorted, partitioned, unordered). The optimizer must explore that space and pick the cheapest plan.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph arranged in topological order with arrows flowing from earlier to later nodes', caption: 'Logical query alternatives form a DAG-shaped search space before physical costing chooses one execution plan. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Topological_Ordering.svg.'},
        'Consider three tables: Orders (O), Customers (C), Regions (R). The join orders include (O join C) join R, O join (C join R), (O join R) join C, and more. Each join can be implemented as hash, merge, or nested loop. Each scan can be sequential, index, or bitmap. The result can be sorted, partitioned, or unordered. Multiply these together: 3 orders times 3 algorithms times 2 joins times 3 scan types times property goals yields hundreds of candidate plans for just 3 tables.',
        'With five tables the count reaches thousands; with ten it reaches millions. An optimizer needs a structure that prevents re-deriving the same subplan, shares work across goals, and lets new operators compete without rewriting the search code.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The natural first optimizer is a hand-coded enumerator. Generate join orders with nested loops, apply if-statements for predicate pushdown, hard-code physical operator selection per pattern, and add a new special case whenever a query regresses.',
        'The logic looks like this: enumerate all join orders, always try hash join first, add a sort if the query has ORDER BY, try merge join if both sides are already sorted, add a bitmap scan for skewed filters -- each pattern wired in as a special case. Every regression spawns a new branch. The optimizer function is a decision tree grown by bug reports.',
        'This works while the engine has few operators and few rewrite patterns. Teams can hold the full decision tree in their heads, and new features arrive slowly enough that each can be wired in by hand.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hand-coded approach breaks on three fronts simultaneously.',
        'First, duplicated subplans. The subexpression (Orders join Customers) appears in multiple join orders. A hand-coded enumerator re-derives and re-costs it each time, because there is no shared structure to detect the duplicate.',
        'Second, tangled property logic. The same child may be needed unordered for one parent and sorted for another. Without explicit property tracking, the planner either misses the enforcer or adds one unconditionally, wasting work.',
        'Third, combinatorial rule interaction. Adding a new physical operator (vectorized hash join) or a new rewrite (predicate transitive closure) requires edits across every enumerator branch. Ten operators and ten rewrites do not add linearly -- they multiply into code paths no one can audit.',
        'The wall is not plan count. It is the inability to share subresults, compose rules, and track properties in one coherent structure. A system with 50 rules and 12 physical operators cannot be maintained as if-else branches -- the cross-product of interactions is too large to hold in code review.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every logically equivalent expression produces the same rows, but different physical implementations of the same logical expression deliver different properties at different costs. If you group all equivalent expressions together and cache the best physical plan per required property, you never re-derive the same subplan for the same goal.',
        'This is the memo: a table indexed by (equivalence group, required property) whose cells hold the cheapest known physical plan. Transformation rules add new logical equivalents to a group. Implementation rules add new physical candidates. Goal-directed search fills in the cells top-down, and once a cell is filled, every parent that needs the same (group, property) pair reuses it. The memo turns a combinatorial explosion into a structured, cached search.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Cascades organizes the search into four mechanisms: memo groups, transformation rules, implementation rules, and goal-directed optimization.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg', alt: 'Directed acyclic graph with arrows showing dependencies between nodes', caption: 'A memo group graph shares subexpressions across alternatives so parents can reuse optimized child goals. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph.svg.'},
        'Consider the query (O join C) join R. The memo creates group G0 for the full result. G0 contains the logical expression (O join C) join R. Its children get their own groups: G1 for (O join C), G2 for R\'s side, GA for scan O, GB for scan C. Each group holds logical expressions, physical expressions, and a map of best plans keyed by optimization goal. When the associativity rule rewrites (O join C) join R into O join (C join R), the new expression enters G0 alongside the original -- it does not replace it. When commutativity rewrites O join C into C join O, the new expression enters G1.',
        'Step 1: Insert the initial logical expression into memo group G0. Child subexpressions get their own groups (G1, G2, GA, GB, etc.). If a subexpression already exists in a group, the memo detects the duplicate and reuses the group.',
        'Step 2: Fire transformation rules. Join associativity rewrites (A join B) join C into A join (B join C) and inserts the new expression into G0. Join commutativity rewrites A join B into B join A and inserts into G1. Predicate pushdown moves a filter from above a join to below it, into the scan group. Each new expression enters the memo; it does not replace the old one.',
        'Step 3: Fire implementation rules. A logical join becomes candidate physical operators: hash join, merge join, nested loop. A logical scan becomes sequential scan, index scan, or bitmap scan. Each physical expression records its cost formula and delivered properties.',
        'Step 4: Optimize by goal. A parent asks G0 for the cheapest plan delivering rows sorted by date. G0 explores its physical expressions, asks child groups for their own cheapest plans under required child properties, and inserts enforcers (Sort, Exchange) when a child does not naturally deliver what the parent needs. The result is cached: G0 now knows its best sorted plan and its best unsorted plan separately.',
        'The optimization procedure for a single group works as follows: for each physical expression P in the group, compute the child goals that P requires, recursively optimize each child group under those goals, sum the child costs with P\'s local cost, and if P does not deliver the parent\'s required property (say, sorted output), add the cost of an enforcer (Sort). If the total cost beats the current best for this (group, goal) pair, update the cache. The recursion terminates because groups are finite, goals are finite, and each (group, goal) pair is computed at most once. Memoization across goals is the core of the efficiency gain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Query optimization has three kinds of structure that Cascades exploits.',
        'The first is equivalence: many expressions produce the same rows because of relational algebra laws (associativity, commutativity, predicate pushdown). Cascades captures this by placing all equivalent expressions in one memo group, so they share a single identity in the search.',
        'The second is optimal substructure: the best plan for a group depends only on the best plans of its children, not on the path through the search that reached it. Cascades captures this with goal-directed search -- each (group, goal) pair is optimized once and cached.',
        'The third is property decomposition: a parent\'s required property (sorted output, partitioned data) decomposes into child requirements. Cascades captures this with enforcers -- explicit operators like Sort or Exchange that bridge the gap when a child cannot deliver a property natively.',
        'The memo is a dynamic-programming table for a rule-based search space. When G1 has already found its best unsorted plan, any parent needing G1 unsorted reuses that cached answer. When a different parent needs G1 sorted, G1 optimizes under a new goal and caches that answer separately. No subplan is derived twice for the same goal.',
        'As Goetz Graefe wrote in the original 1995 paper: "The Cascades optimizer framework uses top-down, goal-directed search with memoization to avoid redundant optimization of shared subexpressions." The top-down direction matters -- it means the optimizer only explores groups that are actually reachable from the query\'s root goal, unlike bottom-up approaches that precompute every possible subplan.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Memo space is O(groups times expressions per group), driven by the number of transformation rules and join orders. Optimization time is O(groups times goals times physical expressions), driven by property combinations such as sort keys and partitioning schemes. Rule firing is bounded by rule promises and duplicate detection -- undisciplined rules cause exponential blowup. Cardinality estimation dominates plan quality: bad row estimates make the best cached plan wrong.',
        'The memo prevents duplicate search but does not make search free. A join of N tables has O(4^N / N^(3/2)) join orderings by Catalan number growth. Cascades does not reduce that count -- it shares the subproblems across orderings.',
        'Rule explosion is the operational risk. A rewrite that fires into its own output creates a cycle. A rule that matches too broadly fills the memo with alternatives that will never win. Practical systems defend with rule promises (a rule declares its output pattern will not re-trigger itself), duplicate group detection, upper-bound pruning, and hard timeouts.',
        'The other hard cost is invisible: cardinality estimation. A perfect memo over wrong row-count estimates produces a confidently bad plan. If the optimizer thinks a filter returns 100 rows when it returns 10 million, it may choose a nested-loop join that is catastrophic at scale. Cascades organizes the search; it does not fix the statistics.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Extensible SQL engines are the primary home. SQL Server, Greenplum/ORCA, CockroachDB, and Apache Calcite all use Cascades-style optimizers. Adding a new physical operator or rewrite rule does not require rewriting the enumerator -- the rule fires into the memo and competes under the cost model.',
        'Engines with rich physical properties benefit especially: sort order, partitioning, compression, row vs. columnar format. Cascades tracks these explicitly instead of hiding them in planner branches.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/52/OLAP_Cube.svg', alt: 'OLAP cube with product, city, and time dimensions', caption: 'Analytical query engines optimize across dimensions, joins, and aggregation paths; Cascades keeps those physical choices comparable. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:OLAP_Cube.svg.'},
        'Distributed query engines benefit where exchange operators (shuffle, broadcast) are physical choices that interact with join order. The memo lets exchange decisions compose with join decisions in a single search.',
        'Optimizer explainability is a side benefit. The memo is an inspectable search space: which rules fired, which groups formed, which goals were requested, which enforcers were inserted, and why one plan beat another. Adding a new operator is straightforward: write an implementation rule, and the memo places it into every join group automatically. The cost model decides when it wins -- no enumerator code is modified.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Cyclic rewrites are the first failure mode: the same expression is re-derived indefinitely and the memo grows without bound. The guardrail is rule promises, where each rule declares that its output will not re-trigger itself.',
        'Overly broad rules cause the memo to fill with alternatives that will never win, and search time explodes. Pattern specificity requirements and rule priority ordering are the defense.',
        'Bad cardinality estimates cause the optimizer to pick a confidently wrong plan -- for example, nested loop on 10 million rows. Runtime feedback, adaptive re-optimization, and histogram maintenance help, but the memo itself cannot detect statistical errors.',
        'Timeout instability produces different plans under load depending on when the timeout fires. Deterministic fallback plans, timeout logging, and budget-per-group limits mitigate this.',
        'Property combinatorics can overwhelm the search when compound sort keys create too many (group, goal) combinations. Property subsumption helps: a plan sorted by (a, b) satisfies a goal that needs sorted-by-a, reducing the number of distinct goals.',
        'Cascades is not a replacement for statistics, runtime feedback, or engineering judgment. It organizes the search. It does not guarantee that the cost model understands data skew, column correlation, network latency, cache effects, or memory spill behavior. A well-structured search over a bad cost model finds the best wrong answer efficiently.',
        'Many production optimizer bugs come from a transformation rule that is valid for inner joins but wrong for outer joins, anti-joins, or correlated subqueries. Null semantics, volatile functions, and LIMIT propagation are common sources of incorrect rewrites that the memo faithfully caches and reuses.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose we have three tables: Orders (O, 100K rows), Customers (C, 10K rows), and Regions (R, 50 rows). The query is SELECT * FROM O JOIN C ON O.cid = C.id JOIN R ON C.rid = R.id ORDER BY O.date.',
        'The optimizer creates G0 for the full three-table join, G1 for (O join C), G2 for (C join R), GA for scan O, GB for scan C, GC for scan R. Associativity fires: G0 now contains both (O join C) join R and O join (C join R). Commutativity fires on G1: it now contains both O join C and C join O.',
        'Implementation rules fire. G1 gets three physical candidates: hash(GA, GB) with estimated cost 120, merge(GA, GB) with cost 180, and nested-loop(GA, GB) with cost 950. GA gets sequential scan (cost 100) and index scan on O.date (cost 60, delivers sorted-by-date).',
        'The root goal arrives: produce G0 sorted by O.date. G0 tries hash(G1, G2): G1\'s cheapest unsorted plan is hash at 120, G2\'s cheapest is hash at 15, local join cost is 50, total so far 185. Hash does not deliver sorted output, so add Sort enforcer at cost 80: total 265. G0 tries merge(G1, G2): G1 needs to deliver sorted-by-cid, which costs 180 (merge join uses sort-merge). G2\'s cheapest sorted-by-cid is merge at 18. Local cost 30, total 228. Merge delivers sorted-by-cid, not sorted-by-date, so add Sort: total 308. Hash with Sort wins at 265.',
        'But consider the other join order: O join (C join R). G2\' = (C join R) has only 50 * 10K = potential matches, but the filter is tight -- say 500 rows. Hash(GA, G2\') costs index-scan-O (60, delivers sorted-by-date) + hash-C-R (15) + join cost (20) = 95. This delivers sorted-by-date from the index scan on O, so no Sort enforcer is needed. Total: 95. The memo caches this as G0\'s best plan for sorted-by-date.',
        'Without the memo, the optimizer would re-derive and re-cost the (C join R) subplan every time it appeared in a different join order. With the memo, G2\'s best unsorted plan is computed once and reused. The savings compound: with 5 tables, the same subplan might appear in dozens of orderings.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Goetz Graefe, "The Cascades Framework for Query Optimization," IEEE Data Engineering Bulletin 18(3), 1995 -- the original Cascades paper defining memo groups, rules, properties, and enforcers. Goetz Graefe, "The Volcano Optimizer Generator: Extensibility and Efficient Search," IEEE ICDE 1993 -- the predecessor to Cascades; Cascades improved Volcano with top-down goal-directed search and better memoization. P. Griffith Selinger et al., "Access Path Selection in a Relational Database Management System," SIGMOD 1979 -- the System R dynamic-programming optimizer that Cascades generalizes. Mohamed A. Soliman et al., "Orca: A Modular Query Optimizer Architecture for Big Data," SIGMOD 2014 -- Greenplum/ORCA, a production Cascades implementation with multi-threaded search.',
        'For prerequisite context, study the Selinger DP Join Order Optimizer -- the dynamic-programming baseline that Cascades extends with rules and properties. For physical detail, study SQL Join Algorithms (hash, merge, and nested-loop joins are the physical operators that compete inside memo groups). For downstream understanding, look at Volcano Iterator Query Execution to see how the chosen plan actually runs once the optimizer finishes.',
        'For failure modes, study Cardinality Estimation Error Propagation to understand why bad row-count estimates make even a perfect search choose the wrong plan. For runtime repair, study Spark Adaptive Query Execution to see what happens when the optimizer gets it wrong and the engine must fix the plan mid-execution. For contrast, study the PostgreSQL Query Planner, a production pipeline that uses bottom-up DP instead of Cascades.',
      ],
    },
  ],
};
