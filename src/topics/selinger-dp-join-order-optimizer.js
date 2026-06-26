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
  const relations = ['A', 'B', 'C'];
  const relationCount = relations.length;
  const totalSubsets = 6;
  const fullSet = relations.join('');
  const bestCost = 230;
  const costs = [12, 80, 30, 140, 190, bestCost];
  const rowEstimates = ['1k', '50k', '3k', '4k', '9k', '600'];
  const decompositionCount = 3;

  yield {
    state: dpGraph('Dynamic programming keeps best plans by relation subset'),
    highlight: { active: ['A', 'B', 'C', 'AB', 'BC', 'e-A-AB', 'e-B-AB', 'e-B-BC', 'e-C-BC'], compare: ['AC'] },
    explanation: `Selinger-style join ordering decomposes the search by relation subset. First choose best single-table access paths for each of the ${relationCount} base relations (${relations.join(', ')}), then best two-table joins, then larger joins built from smaller winners.`,
    invariant: `For a cost model with optimal substructure, a best plan for a set like ${fullSet} is built from best plans for its ${relationCount - 1}-relation subsets.`,
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
    explanation: `The table stores the cheapest known plan for each of the ${totalSubsets} subsets and its estimated output size. The final subset ${fullSet} has cost ${bestCost} — larger candidates reuse smaller table entries instead of rediscovering their internal join orders.`,
  };

  yield {
    state: dpGraph('Competing decompositions produce candidates for the full set'),
    highlight: { active: ['AB', 'BC', 'ABC', 'e-AB-ABC', 'e-BC-ABC'], found: ['cost', 'plan'], compare: ['AC'] },
    explanation: `For ${fullSet}, the optimizer tries ${decompositionCount} competing decompositions: AB joined with C, AC joined with B, and BC joined with A. Each candidate's cost comes from its child plans (already stored in the ${totalSubsets}-entry DP table) plus join cost and output estimate.`,
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
    explanation: `The optimizer is managing combinatorial explosion across ${totalSubsets} subsets of ${relationCount} relations. It may restrict plan shapes, prune dominated plans, and rely on statistics — row estimates like ${rowEstimates[0]} or ${rowEstimates[1]} that can still be wrong.`,
  };

  yield {
    state: dpGraph('Complete case: star-schema dashboard query'),
    highlight: { active: ['A', 'B', 'C', 'AB', 'ABC', 'cost', 'plan'], compare: ['BC'] },
    explanation: `A dashboard query joining fact, customer, and date tables becomes a subset DP problem over ${relationCount} relations. The best first join — costing as little as ${costs[0]} — is usually the one that shrinks the fact table most before later joins and aggregation.`,
  };
}

function* interestingOrders() {
  const dpKeyComponents = ['subset', 'physical property'];
  const physicalProperties = ['sort order', 'partitioning', 'location', 'materialized?'];
  const propertyCount = physicalProperties.length;
  const keyDescription = dpKeyComponents.join(' + ');
  const joinMethods = ['hash join', 'merge join', 'nested loop'];
  const debugChecks = ['row estimate', 'lost order', 'join method', 'spill risk'];
  const debugCheckCount = debugChecks.length;

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
    explanation: `System R kept more than one plan per subset when a plan produced an interesting order — such as ${physicalProperties[0]} — that could make later ${joinMethods[1]}s, grouping, or ORDER BY cheaper.`,
    invariant: `A locally more expensive plan can be globally cheaper if it preserves a useful property like ${physicalProperties[0]} — the DP key becomes (${keyDescription}).`,
  };

  yield {
    state: dpGraph('The DP key is subset plus physical property'),
    highlight: { active: ['AB', 'ABC', 'cost', 'plan'], found: ['B', 'C'], compare: ['BC'] },
    explanation: `The DP table is not only keyed by the set of relations. Practical optimizers track ${propertyCount} categories of physical properties — ${physicalProperties.slice(0, 3).join(', ')}, and more — making the key (${keyDescription}).`,
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
    explanation: `This is the bridge from simple DP to Cascades-style memo optimization: equivalent logical results can have many physical implementations across ${propertyCount} property dimensions (${physicalProperties.join(', ')}).`,
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
    explanation: `Join ordering is only visible indirectly through the chosen plan. Check all ${debugCheckCount} dimensions (${debugChecks.join(', ')}): which relation subsets got joined early, what row estimates justified that, and which of the ${propertyCount} physical properties were preserved or destroyed?`,
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
        'The animation shows a dynamic program over table subsets. A subset such as {A,B} means the optimizer has chosen a physical plan for joining those relations.',
        'Active nodes are subsets being decided, found nodes are costs already stored in the table, and compare nodes are candidate plans being tested against the current best. The safe inference is: a larger subset never recomputes a smaller join from scratch; it reuses the stored child plan and adds one join step.',
        {type: 'callout', text: 'Selinger DP wins by making join order a subset problem: solve each relation set once, then reuse it in larger plans.'},
      
        {type: 'image', src: './assets/gifs/selinger-dp-join-order-optimizer.gif', alt: 'Animated walkthrough of the selinger dp join order optimizer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SQL says what result is wanted, not which table should be joined first. The database optimizer must choose access paths, join methods, and join order before execution starts.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/en/9/9e/SQLServer_QueryPlan.png', alt: 'SQL Server graphical query plan with scan, nested loops join, index seek, and sort operators', caption: 'A query plan is the physical tree produced after optimization; Selinger DP is one way to choose the join portion of that tree. Source: Wikipedia, Microsoft SQL Server Management Studio screenshot.'},
        'The choice can change runtime by orders of magnitude. Joining a large fact table before applying selective dimension filters can create a huge intermediate result that a better order would avoid.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest approach is to join tables in the order written in the FROM clause. That is easy to implement, but SQL order is not meant to be a physical plan.',
        'A more serious approach is to enumerate every possible join tree and cost each one. For three tables this is fine; for ten tables, the number of candidate orders and tree shapes becomes enormous.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Join enumeration explodes because each added table multiplies the number of possible orders. Ten tables already produce millions of left-deep permutations and far more bushy tree candidates once tree shapes are included.',
        'The wall is not only search size. Each candidate also needs cardinality estimates, join-method choices, access paths, and physical properties such as sorted order.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The best plan for a larger join can be built from best plans for smaller relation sets. That is optimal substructure, the condition that makes dynamic programming useful.',
        'Selinger DP stores the cheapest known plan for each subset of relations, then reuses those subset winners when building larger subsets. Interesting orders extend the state by preserving useful physical properties such as sort order when a slightly more expensive subset plan may save a later sort.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First, compute base plans for each single table, including sequential scans and index scans. Store the cheapest useful access paths in the DP table.',
        'Then grow subsets by size. For each subset S, split it into two non-empty parts, retrieve the stored plans for those parts, estimate the cost of joining them with each join method, and keep the cheapest non-dominated result.',
        'The final answer is the stored plan for the subset containing all relations. Backpointers reconstruct the executable join tree from the DP table.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is substitution. If the best plan for S joins S1 and S2, and a cheaper equivalent plan for S1 existed, replacing S1 inside S would make S cheaper, contradicting optimality.',
        'That argument holds only when the DP state includes everything future costs depend on. If sorted order matters but the state stores only cost, the optimizer may throw away a plan that is slightly expensive now but cheaper later.',
        'Dominance is the safe pruning rule. A plan can be discarded only when another plan for the same subset costs no more and provides at least the same useful physical properties.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'General bushy subset DP is exponential, commonly described as O(3^n) over n relations because all subsets and subpartitions are considered. Left-deep variants reduce the search but still have O(n^2 * 2^n)-style growth.',
        'For 8 tables, 3^8 is 6,561. For 12 tables, 3^12 is 531,441. For 20 tables, 3^20 is about 3.5 billion, so optimizers use thresholds and heuristics.',
        'The dominant practical cost is often estimation quality. A perfect dynamic program over wrong cardinality estimates can choose a bad plan confidently.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Selinger-style optimization is used by relational databases for moderate-size joins. It is especially valuable for star-schema analytics, ad-hoc reporting, and queries where written table order is arbitrary.',
        'It prevents large intermediate results by discovering selective joins early. For example, joining two small dimension filters before a 100-million-row fact table can reduce the fact-table join from millions of rows to thousands.',
        'Modern optimizers generalize the idea with memo structures, transformation rules, connected-subgraph pruning, and heuristics for high table counts.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when relation counts are too high for exhaustive subset search. Many systems switch to greedy, genetic, or budgeted search after a threshold.',
        'It also fails when cardinality estimates are badly wrong. Correlated columns, stale statistics, skewed distributions, and missing histograms can make the cheapest estimated plan the worst actual plan.',
        'Outer joins, lateral references, semi-joins, anti-joins, and distributed execution properties restrict reordering. The simple subset model must be extended or constrained to stay correct.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose tables A, B, and C have base scan costs 10, 20, and 30. Estimated two-table join costs are {A,B}:50, {A,C}:300, and {B,C}:80, including child costs.',
        'The DP table first stores {A}:10, {B}:20, and {C}:30. For two-table subsets it stores {A,B}:50, {A,C}:300, and {B,C}:80.',
        'For {A,B,C}, it compares A + {B,C}, B + {A,C}, and C + {A,B}. If joining C with {A,B} adds 40, the full cost is 50 + 30 + 40 = 120, so the plan is (A join B) then join C.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: P. Griffiths Selinger et al., Access Path Selection in a Relational Database Management System, SIGMOD 1979, https://dl.acm.org/doi/10.1145/582095.582099. Cascades and Volcano are the main later optimizer frameworks.',
        'Study dynamic programming, bitmask subset enumeration, hash join, merge join, nested-loop join, cardinality estimation, Cascades memo optimization, PostgreSQL planner internals, and Volcano iterator execution.',
      ],
    },
  ],
};
