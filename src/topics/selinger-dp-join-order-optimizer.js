// Selinger/System R style dynamic programming for join order optimization.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'selinger-dp-join-order-optimizer',
  title: 'Selinger DP Join Order Optimizer',
  category: 'Systems',
  summary: 'Use dynamic programming over relation subsets to keep the cheapest plan for each interesting output order, then assemble a low-cost join tree.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['subset DP table', 'interesting orders'], defaultValue: 'subset DP table' },
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

function dpGraph(title) {
  return graphState({
    nodes: [
      { id: 'A', label: 'A', x: 0.8, y: 1.6, note: 'scan' },
      { id: 'B', label: 'B', x: 0.8, y: 3.6, note: 'scan' },
      { id: 'C', label: 'C', x: 0.8, y: 5.6, note: 'scan' },
      { id: 'AB', label: 'AB', x: 3.0, y: 2.5, note: 'best' },
      { id: 'BC', label: 'BC', x: 3.0, y: 4.8, note: 'best' },
      { id: 'AC', label: 'AC', x: 3.0, y: 6.8, note: 'cross?' },
      { id: 'ABC', label: 'ABC', x: 5.5, y: 3.8, note: 'winner' },
      { id: 'cost', label: 'cost', x: 7.4, y: 3.8, note: 'rows+IO' },
      { id: 'plan', label: 'plan', x: 9.0, y: 3.8, note: 'join tree' },
    ],
    edges: [
      { id: 'e-A-AB', from: 'A', to: 'AB', weight: '' },
      { id: 'e-B-AB', from: 'B', to: 'AB', weight: '' },
      { id: 'e-B-BC', from: 'B', to: 'BC', weight: '' },
      { id: 'e-C-BC', from: 'C', to: 'BC', weight: '' },
      { id: 'e-A-AC', from: 'A', to: 'AC', weight: '' },
      { id: 'e-C-AC', from: 'C', to: 'AC', weight: '' },
      { id: 'e-AB-ABC', from: 'AB', to: 'ABC', weight: '' },
      { id: 'e-BC-ABC', from: 'BC', to: 'ABC', weight: '' },
      { id: 'e-ABC-cost', from: 'ABC', to: 'cost', weight: '' },
      { id: 'e-cost-plan', from: 'cost', to: 'plan', weight: '' },
    ],
  }, { title });
}

function* subsetDpTable() {
  yield {
    state: dpGraph('Dynamic programming keeps best plans by relation subset'),
    highlight: { active: ['A', 'B', 'C', 'AB', 'BC', 'e-A-AB', 'e-B-AB', 'e-B-BC', 'e-C-BC'], compare: ['AC'] },
    explanation: 'Selinger-style join ordering decomposes the search by relation subset. First choose best single-table access paths, then best two-table joins, then larger joins built from smaller winners.',
    invariant: 'For a cost model with optimal substructure, a best plan for a set is built from best plans for smaller sets.',
  };

  yield {
    state: labelMatrix(
      'DP table',
      [
        { id: 'A', label: '{A}' },
        { id: 'B', label: '{B}' },
        { id: 'C', label: '{C}' },
        { id: 'AB', label: '{A,B}' },
        { id: 'BC', label: '{B,C}' },
        { id: 'ABC', label: '{A,B,C}' },
      ],
      [
        { id: 'best', label: 'best plan' },
        { id: 'rows', label: 'rows' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['index A', '1k', '12'],
        ['scan B', '50k', '80'],
        ['index C', '3k', '30'],
        ['A hash B', '4k', '140'],
        ['B hash C', '9k', '190'],
        ['AB then C', '600', '230'],
      ],
    ),
    highlight: { active: ['AB:best', 'BC:best', 'ABC:best'], found: ['ABC:cost'] },
    explanation: 'The table stores the cheapest known plan for each subset and its estimated output size. Larger candidates reuse smaller table entries instead of rediscovering their internal join orders.',
  };

  yield {
    state: dpGraph('Competing decompositions produce candidates for the full set'),
    highlight: { active: ['AB', 'BC', 'ABC', 'e-AB-ABC', 'e-BC-ABC'], found: ['cost', 'plan'], compare: ['AC'] },
    explanation: 'For ABC, the optimizer can try AB joined with C, AC joined with B, and BC joined with A. Each candidate has a cost from its child plans plus join cost and output estimate.',
  };

  yield {
    state: labelMatrix(
      'Plan explosion control',
      [
        { id: 'leftdeep', label: 'left-deep' },
        { id: 'bushy', label: 'bushy' },
        { id: 'prune', label: 'prune' },
        { id: 'stats', label: 'stats' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['smaller search', 'miss bushy win'],
        ['more options', 'more states'],
        ['drop costly plans', 'bad estimate'],
        ['cost guidance', 'correlation miss'],
      ],
    ),
    highlight: { active: ['leftdeep:helps', 'prune:helps'], compare: ['bushy:risk'], found: ['stats:risk'] },
    explanation: 'The optimizer is managing combinatorial explosion. It may restrict plan shapes, prune dominated plans, and rely on statistics that can still be wrong.',
  };

  yield {
    state: dpGraph('Complete case: star-schema dashboard query'),
    highlight: { active: ['A', 'B', 'C', 'AB', 'ABC', 'cost', 'plan'], compare: ['BC'] },
    explanation: 'A dashboard query joining fact, customer, and date tables becomes a subset DP problem. The best first join is usually the one that shrinks the fact table most before later joins and aggregation.',
  };
}

function* interestingOrders() {
  yield {
    state: labelMatrix(
      'Interesting orders',
      [
        { id: 'A', label: '{A}' },
        { id: 'ABnone', label: '{A,B} unordered' },
        { id: 'ABdate', label: '{A,B} by date' },
        { id: 'ABC', label: '{A,B,C}' },
      ],
      [
        { id: 'plan', label: 'plan' },
        { id: 'extra', label: 'extra cost' },
        { id: 'future', label: 'future use' },
      ],
      [
        ['index A', 'seek', 'join key'],
        ['hash join', 'cheap now', 'needs sort'],
        ['merge join', 'sort now', 'ORDER BY'],
        ['keep ordered', 'avoid final sort', 'winner'],
      ],
    ),
    highlight: { active: ['ABdate:future', 'ABC:future'], compare: ['ABnone:future'] },
    explanation: 'System R kept more than one plan per subset when a plan produced an interesting order that could make later joins, grouping, or ORDER BY cheaper.',
    invariant: 'A locally more expensive plan can be globally cheaper if it preserves a useful property.',
  };

  yield {
    state: dpGraph('The DP key is subset plus physical property'),
    highlight: { active: ['AB', 'ABC', 'cost', 'plan'], found: ['B', 'C'], compare: ['BC'] },
    explanation: 'The DP table is not only keyed by the set of relations. Practical optimizers also track physical properties such as sort order, partitioning, distribution, and required output format.',
  };

  yield {
    state: labelMatrix(
      'Physical properties',
      [
        { id: 'order', label: 'sort order' },
        { id: 'partition', label: 'partitioning' },
        { id: 'location', label: 'location' },
        { id: 'material', label: 'materialized?' },
      ],
      [
        { id: 'saves', label: 'can save' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['final sort', 'more states'],
        ['shuffle', 'enforcers'],
        ['network move', 'placement'],
        ['recompute', 'memory'],
      ],
    ),
    highlight: { active: ['order:saves', 'partition:saves'], found: ['material:saves'] },
    explanation: 'This is the bridge from simple DP to Cascades-style memo optimization: equivalent logical results can have many physical implementations and properties.',
  };

  yield {
    state: labelMatrix(
      'Debug checklist',
      [
        { id: 'estimate', label: 'row estimate' },
        { id: 'order', label: 'lost order' },
        { id: 'join', label: 'join method' },
        { id: 'spill', label: 'spill risk' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'evidence', label: 'evidence' },
      ],
      [
        ['is subset size wrong?', 'EXPLAIN ANALYZE'],
        ['did sort appear?', 'plan node'],
        ['is physical shape right?', 'hash/merge/loop'],
        ['does memory fit?', 'buffers/temp'],
      ],
    ),
    highlight: { active: ['estimate:evidence', 'order:evidence'], found: ['spill:evidence'] },
    explanation: 'Join ordering is only visible indirectly through the chosen plan. The practical read is: which relation subsets got joined early, what row estimates justified that, and what physical properties were preserved or destroyed?',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'subset DP table') yield* subsetDpTable();
  else if (view === 'interesting orders') yield* interestingOrders();
  else throw new InputError('Pick a Selinger optimizer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The subset-DP view shows a graph where each node is a relation subset ({A}, {B}, {A,B}, {A,B,C}) and edges connect smaller subsets to the larger plans they feed. The interesting-orders view shows the same DP table but tracks physical properties like sort order alongside cost.',
        {
          type: 'diagram',
          text: '  {A}  {B}  {C}        single-table access paths\n    \\  / \\  /\n   {A,B} {B,C}          two-table join candidates\n      \\   /\n     {A,B,C}            full join tree assembled from winners\n        |\n      cost -> plan      cheapest plan becomes the executable tree',
          label: 'Subset lattice: the optimizer builds bottom-up, reusing smaller winners',
        },
        'Active (highlighted) nodes are the subset currently being decided. Found markers show costs that are now locked in. Compare markers show alternatives being evaluated against the current best -- a plan marked "compare" lost or is being tested.',
        {
          type: 'note',
          text: 'Watch the cost column in the DP table. When a larger subset is built, its cost is never recomputed from scratch -- it adds one join cost on top of already-memoized child costs. That reuse is the entire point of the dynamic program.',
        },
        {type: 'callout', text: 'Selinger DP wins by making join order a subset problem: solve each relation set once, then reuse it in larger plans.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'Given a set of relations to be joined [...] the optimizer must choose the order of joins, the join method, and the access path for each relation.',
          attribution: 'P. Griffiths Selinger et al., "Access Path Selection in a Relational Database Management System", SIGMOD 1979',
        },
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/en/9/9e/SQLServer_QueryPlan.png', alt: 'SQL Server graphical query plan with scan, nested loops join, index seek, and sort operators', caption: 'A query plan is the physical tree produced after optimization; Selinger DP is one way to choose the join portion of that tree. Source: Wikipedia, Microsoft SQL Server Management Studio screenshot.'},
        'SQL is declarative: a query says which tables to join and what predicates to apply, but not the physical order of joins. The database engine must choose that order, and the choice matters enormously. Two logically equivalent join trees for the same five-table query can differ by 1,000x in intermediate row counts, memory consumption, and wall-clock time.',
        'The Selinger optimizer, introduced in IBM System R (1979), was the first to apply dynamic programming to this problem. It treats join ordering as a shortest-path search over the lattice of relation subsets, keeping the cheapest known plan for each subset and assembling larger plans from smaller winners.',
        {
          type: 'note',
          text: 'Every major SQL database today -- PostgreSQL, MySQL, SQL Server, Oracle, CockroachDB, DuckDB -- uses a direct descendant of the Selinger approach or its generalization (Cascades/Volcano). Understanding this algorithm is understanding how every SQL query you write actually runs.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest strategy is to join tables in the order the SQL query lists them. FROM orders JOIN customers ON ... JOIN products ON ... becomes orders-then-customers-then-products. This is easy to implement -- just walk the FROM clause left to right, accumulating joins.',
        'A slightly better approach: try all n! permutations of the join order and pick the cheapest. For 3 tables that is 6 plans. For 5 tables, 120. Manageable so far.',
        {
          type: 'bullets',
          items: [
            '3 tables: left-to-right has 1 plan, all permutations have 6, and bushy tree shapes reach 12 candidates.',
            '5 tables: left-to-right has 1 plan, all permutations have 120, and bushy tree shapes reach 1,680 candidates.',
            '8 tables: all permutations reach 40,320, and bushy tree shapes reach 2,027,025 candidates.',
            '10 tables: all permutations reach 3,628,800, and bushy tree shapes reach roughly 17.6 billion candidates.',
            '15 tables: all permutations are already around 1.3 trillion, and bushy enumeration becomes effectively astronomical.',
          ],
        },
        'Left-to-right ignores plan quality entirely. Exhaustive enumeration finds the best plan but the search space explodes factorially -- and that is before considering join methods (hash, merge, nested loop) and access paths (index scan, sequential scan) at each step.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Left-to-right ordering fails because SQL is declarative and the written order is arbitrary. A query that lists a 50-million-row fact table first and a 200-row dimension table second will build a 50-million-row intermediate before the dimension filter can shrink it. Reversing the order might produce a 200-row intermediate instead.',
        'Exhaustive enumeration fails because the number of distinct join trees grows faster than factorial. For n tables, the count of binary tree shapes alone is the (n-1)th Catalan number. Multiply by join method choices and access path variants, and 10 tables already exceed billions of candidates.',
        {
          type: 'note',
          text: 'The key structural observation: most of those billions of candidates share subproblems. The best way to join {A,B} does not depend on whether the outer query later joins {A,B} with {C} or with {D}. This is optimal substructure -- the signature of dynamic programming.',
        },
        'Selinger DP exploits that overlap. Instead of independently evaluating every full tree, it solves each subset once, bottom-up, and reuses those solutions when building larger subsets. The search space drops from "all trees" to "all subsets" -- from super-exponential to 2^n, which is still exponential but vastly smaller.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algorithm proceeds in three phases: base cases, bottom-up enumeration, and plan extraction.',
        {
          type: 'code',
          language: 'text',
          text: 'Phase 1 -- Base cases:\n  For each relation R:\n    For each access path (seq scan, index scan, ...):\n      Estimate cost and output rows.\n      Store cheapest plan in DP[{R}].\n\nPhase 2 -- Bottom-up enumeration:\n  For subset_size = 2 to n:\n    For each subset S of that size:\n      For each way to split S into (S1, S2) where S1 and S2 are non-empty:\n        For each join method (hash, merge, nested loop):\n          left_plan  = DP[S1]\n          right_plan = DP[S2]\n          candidate_cost = left_plan.cost + right_plan.cost + join_cost(S1, S2, method)\n          If candidate_cost < DP[S].cost:\n            DP[S] = new plan (left_plan, right_plan, method, candidate_cost)\n\nPhase 3 -- Extract:\n  Return DP[{all relations}].plan   // backpointers rebuild the full tree',
        },
        'Phase 1 seeds the DP table with single-table access paths. For a table with an index on the join column, the index scan might cost 12 I/O units versus 80 for a sequential scan; both are candidates, and the cheapest wins for each base relation.',
        'Phase 2 is the core loop. For each subset of size k, the optimizer tries every binary partition into two smaller subsets, retrieves their already-computed best plans, and evaluates the cost of joining them. Only the cheapest candidate survives in the table.',
        {
          type: 'diagram',
          text: '  Splitting {A,B,C} into pairs:\n\n  Split 1:  {A}   join  {B,C}    cost = DP[{A}] + DP[{B,C}] + join_cost\n  Split 2:  {B}   join  {A,C}    cost = DP[{B}] + DP[{A,C}] + join_cost\n  Split 3:  {C}   join  {A,B}    cost = DP[{C}] + DP[{A,B}] + join_cost\n\n  Cheapest split wins and is stored in DP[{A,B,C}].',
          label: 'Competing decompositions for the full relation set',
        },
        'System R added a critical refinement: interesting orders. A plan for {A,B} that costs 140 but produces output sorted by date might beat a plan costing 120 that produces unsorted output, because a later merge join or ORDER BY clause would need a sort costing 50. The DP table therefore stores multiple non-dominated plans per subset when they differ in useful physical properties.',
        {
          type: 'note',
          text: 'Practical optimizers also restrict the search. Many only consider left-deep trees (one input to each join is always a base table), which reduces the number of splits. Others enumerate only connected subgraphs of the join graph, avoiding cross products that are almost never useful.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on optimal substructure: the best plan for a set S that happens to join subsets S1 and S2 must use the best plans for S1 and S2 individually. If a cheaper plan for S1 existed, substituting it into the plan for S would reduce total cost -- contradicting the assumption that the plan for S was optimal.',
        {
          type: 'note',
          text: 'Optimal substructure holds only when the DP state captures everything that affects future cost. If sort order matters but is not tracked, the optimizer might discard a plan for {A,B} that is 5% more expensive but preserves date order, then pay 40% extra for a final sort. Interesting orders fix this by making the DP key (subset, physical property) rather than just (subset).',
        },
        'Dominance is the pruning rule. Plan P1 dominates plan P2 for the same subset if P1 costs no more and satisfies at least the same physical properties. A dominated plan can be safely dropped because no future use of the subset can prefer it. When two plans have different properties -- one is sorted, the other is cheaper but unsorted -- neither dominates, so both survive.',
        'Termination is guaranteed because the algorithm processes subsets in strictly increasing size order, and each subset is visited exactly once. The total number of subsets is 2^n, and each subset considers at most 2^(k-1) - 1 binary splits (where k is the subset size), giving a finite and bounded search.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'General time: O(3^n). Summing over all subsets and their sub-partitions gives Sum(C(n,k) * 2^k) = 3^n.',
            'Left-deep-only time: O(n^2 * 2^n), because each subset tries single-table extensions instead of every bushy split.',
            'Space: O(2^n) for one DP entry per subset, multiplied by the number of interesting physical properties kept.',
            'With p interesting orders: O(p * 2^n) space and O(p * 3^n) time when each subset may store p non-dominated plans.',
            'Practical limit: roughly 12-15 tables before most optimizers switch to heuristic or genetic planners.',
          ],
        },
        'For 8 tables: 3^8 = 6,561 subset evaluations. For 12 tables: 3^12 = 531,441. For 20 tables: 3^20 = 3.5 billion. The exponential growth is why PostgreSQL switches from exhaustive DP to its GEQO (genetic query optimizer) at 12 tables by default.',
        'Each subset evaluation involves a cost-model call that estimates output cardinality and I/O cost. The quality of those estimates dominates plan quality far more than the search strategy. A perfect search with wrong cardinality estimates picks the wrong plan; a heuristic search with accurate statistics often finds a good plan.',
        {
          type: 'code',
          language: 'sql',
          text: '-- PostgreSQL: check the DP-to-GEQO threshold\nSHOW geqo_threshold;          -- default: 12\nSET geqo_threshold = 14;      -- allow DP for up to 14 tables\n\n-- Examine the chosen plan and cost estimates\nEXPLAIN (ANALYZE, BUFFERS) SELECT ...',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Selinger DP is the right tool whenever the relation count is moderate (under ~15), the cost model is reasonably calibrated, and the query benefits from exploring join reordering.',
        {
          type: 'bullets',
          items: [
            'OLTP with 3-5 table joins: small subset count keeps planning cheap while still finding the best order.',
            'Star-schema analytics: joining selective dimensions early can shrink a large fact table before expensive joins.',
            'Ad-hoc reporting: users write arbitrary join order, so the optimizer must compensate without manual tuning.',
            'Views and subquery flattening: once views are inlined, the original written order is no longer a useful physical plan.',
          ],
        },
        'The real power is in what it prevents: without Selinger DP, a five-table dashboard query joining a 100M-row fact table could build a 100M-row intermediate in the first join. With it, the optimizer discovers that joining two small dimension tables first produces a 500-row intermediate that filters the fact table down to 10,000 rows before the expensive join.',
        {
          type: 'note',
          text: 'Interesting orders make Selinger DP especially valuable for queries with ORDER BY, GROUP BY, or DISTINCT on a join column. The optimizer can choose a merge join that preserves sorted order, eliminating a separate sort step that would otherwise dominate the query cost.',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'High relation counts (>15 tables): 2^n subsets make exhaustive DP too slow. Optimizers fall back to greedy heuristics, genetic algorithms (PostgreSQL GEQO), or randomized search (SQL Server exploration budget).',
            'Bad cardinality estimates: the DP correctly finds the cheapest plan according to its cost model, but if the model says a join produces 100 rows when it actually produces 10 million, the "optimal" plan is a disaster. Correlated columns, skewed distributions, and stale statistics are the usual culprits.',
            'Missing physical properties: if the cost model ignores memory pressure, network shuffles (distributed DBs), or NUMA locality, the DP key is incomplete and the optimizer may discard plans that would have been globally better.',
            'Outer joins and lateral references: Selinger DP assumes joins commute and associate freely. Outer joins, semi-joins, anti-joins, and lateral subqueries restrict reordering. Handling these correctly requires conflict-detection rules (e.g., the TPC-H rules in PostgreSQL) that complicate the subset enumeration.',
            'Plan rigidity: once a plan is chosen, it runs to completion. If runtime cardinality diverges wildly from estimates, adaptive execution (re-optimization mid-query) is needed -- something the original Selinger framework does not provide.',
          ],
        },
        {
          type: 'code',
          language: 'sql',
          text: '-- Diagnosing a Selinger DP failure in PostgreSQL:\nEXPLAIN (ANALYZE, BUFFERS) SELECT ...\n-- Compare "rows" (estimated) vs "actual rows" at each join node.\n-- A 100x mismatch at an early join means the optimizer chose\n-- this subtree based on a wrong cardinality estimate.\n-- Fix: UPDATE statistics, add extended statistics for\n-- correlated columns, or use pg_hint_plan to force order.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary source: P. Griffiths Selinger et al., "Access Path Selection in a Relational Database Management System", SIGMOD 1979. https://dl.acm.org/doi/10.1145/582095.582099',
            'Implementation reference: PostgreSQL source, src/backend/optimizer/path/joinrels.c -- the join enumeration loop that implements subset DP with connected-subgraph pruning.',
            'Modern generalization: Goetz Graefe, "The Cascades Framework for Query Optimization", IEEE Data Engineering Bulletin, 1995 -- extends Selinger DP to a rule-based, top-down memo search.',
            'DuckDB internals: https://duckdb.org/docs/internals/overview -- a modern columnar engine using Selinger-style join ordering with cardinality estimation from HyperLogLog sketches.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: Dynamic Programming -- subset DP pattern and bitmask enumeration.',
            'Prerequisite: SQL Join Algorithms Primer -- hash join, merge join, and nested loop.',
            'Extension: Cascades Memo Query Optimizer -- top-down generalization with rules and enforcers.',
            'Extension: Cardinality Estimation Error Propagation -- why wrong estimates cascade.',
            'Production case: PostgreSQL Query Planner Case Study -- Selinger-style DP in a real codebase.',
            'Contrast: Volcano Iterator Query Execution -- the execution model that consumes the plan Selinger produces.',
          ],
        },
      ],
    },
  ],
};
