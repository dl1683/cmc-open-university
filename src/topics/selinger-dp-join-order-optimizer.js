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
    { heading: 'What it is', paragraphs: [
      'Selinger-style optimization is the classic dynamic-programming approach behind System R and many descendants. It treats join ordering as a search over relation subsets. For each subset, keep the cheapest known plan, then build larger subsets from smaller ones.',
      'The important data structure is the DP table. A key names a set of relations, and the value stores a plan, estimated rows, estimated cost, and sometimes useful physical properties such as output order.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Start with single-relation access paths: sequential scan, index scan, bitmap scan, or other scan variants. Then enumerate two-way joins, then three-way joins, and so on. A candidate for A,B,C can reuse the best A,B plan plus C, or best B,C plan plus A, depending on allowed join shape.',
      'System R also introduced interesting orders. A plan that is not cheapest immediately may preserve a sort order useful for a later merge join, GROUP BY, or ORDER BY. That means a subset may keep multiple nondominated plans.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The search grows quickly with relation count, so optimizers prune, restrict plan shapes, use connected-subgraph enumeration, or switch strategies for large joins. The DP is only as good as the cost model and cardinality estimates feeding it.',
      'A bad row estimate can make a bad plan look cheap. That is why this topic links directly to PostgreSQL Query Planner Case Study: the DP machinery may be correct while its inputs are wrong.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A star-schema dashboard joins a sales fact table with date, customer, and product dimensions. The optimizer estimates which dimension filters shrink the fact table most and chooses early joins that reduce intermediate rows. If an index scan preserves date order, the optimizer may keep that ordered plan because it can avoid a later ORDER BY sort.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Selinger et al., "Access Path Selection in a Relational Database Management System", https://web.eecs.umich.edu/~michjc/eecs584/Papers/selinger_1979.pdf; ACM DOI listing, https://dl.acm.org/doi/10.1145/582095.582099; DuckDB internals overview, https://duckdb.org/docs/current/internals/overview.html. Study Cardinality Estimation Error Propagation, PostgreSQL Statistics Histogram & MCV, Cascades Memo Query Optimizer, PostgreSQL Query Planner Case Study, SQL Join Algorithms Primer, and Volcano Iterator Query Execution next.',
    ] },
  ],
};
