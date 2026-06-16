// Min-cost max-flow: send as much flow as possible while minimizing total
// edge cost, usually with residual graphs and shortest augmenting paths.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'min-cost-max-flow',
  title: 'Min-Cost Max-Flow',
  category: 'Data Structures',
  summary: 'Optimize flow with costs: augment along cheapest residual paths, use potentials for Dijkstra, and model assignments with capacities.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['residual costs', 'assignment model'], defaultValue: 'residual costs' },
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

function flowGraph(title) {
  return graphState({
    nodes: [
      { id: 's', label: 'source', x: 0.8, y: 4.0, note: 'supply' },
      { id: 'a', label: 'A', x: 3.0, y: 2.4, note: 'cap 1' },
      { id: 'b', label: 'B', x: 3.0, y: 5.6, note: 'cap 1' },
      { id: 'x', label: 'X', x: 6.2, y: 2.4, note: 'demand' },
      { id: 'y', label: 'Y', x: 6.2, y: 5.6, note: 'demand' },
      { id: 't', label: 'sink', x: 8.7, y: 4.0, note: 'collect flow' },
      { id: 'pot', label: 'potentials', x: 5.0, y: 7.3, note: 'reweighted costs' },
    ],
    edges: [
      { id: 'e-s-a', from: 's', to: 'a', weight: '1/0' },
      { id: 'e-s-b', from: 's', to: 'b', weight: '1/0' },
      { id: 'e-a-x', from: 'a', to: 'x', weight: '1/2' },
      { id: 'e-a-y', from: 'a', to: 'y', weight: '1/6' },
      { id: 'e-b-x', from: 'b', to: 'x', weight: '1/4' },
      { id: 'e-b-y', from: 'b', to: 'y', weight: '1/1' },
      { id: 'e-x-t', from: 'x', to: 't', weight: '1/0' },
      { id: 'e-y-t', from: 'y', to: 't', weight: '1/0' },
      { id: 'e-pot-a', from: 'pot', to: 'a', weight: 'pi' },
      { id: 'e-pot-y', from: 'pot', to: 'y', weight: 'pi' },
    ],
  }, { title });
}

function* residualCosts() {
  yield {
    state: flowGraph('Pick the cheapest augmenting path'),
    highlight: { active: ['s', 'b', 'y', 't', 'e-s-b', 'e-b-y', 'e-y-t'], compare: ['a', 'x'] },
    explanation: 'Min-cost max-flow augments flow through a residual network. Instead of any available path, it chooses a path with minimum total cost, here source -> B -> Y -> sink.',
    invariant: 'Flow value increases while total cost is kept as low as possible for that value.',
  };

  yield {
    state: labelMatrix(
      'Residual edges after one unit',
      [
        { id: 'forward', label: 'used forward edge' },
        { id: 'reverse', label: 'reverse edge' },
        { id: 'unused', label: 'unused edge' },
        { id: 'path', label: 'next path' },
      ],
      [{ id: 'capacity', label: 'residual cap' }, { id: 'cost', label: 'residual cost' }],
      [
        ['0 left', 'original cost'],
        ['1 back', 'negative original cost'],
        ['still available', 'original cost'],
        ['may reroute previous flow', 'uses reverse edges'],
      ],
    ),
    highlight: { active: ['reverse:capacity', 'reverse:cost'], found: ['path:cost'] },
    explanation: 'Reverse edges are what make the algorithm corrective. A later cheaper global solution can cancel part of an earlier path by sending flow along a negative-cost reverse edge.',
  };

  yield {
    state: flowGraph('Potentials make Dijkstra usable with reduced costs'),
    highlight: { active: ['pot', 'e-pot-a', 'e-pot-y'], found: ['s', 't'] },
    explanation: 'Residual graphs can have negative-cost reverse edges. Successive shortest path implementations often maintain node potentials so reduced costs stay nonnegative and Dijkstra can be used efficiently.',
  };

  yield {
    state: labelMatrix(
      'Algorithm loop',
      [
        { id: 'shortest', label: 'shortest path' },
        { id: 'augment', label: 'augment' },
        { id: 'update', label: 'update residuals' },
        { id: 'stop', label: 'stop' },
      ],
      [{ id: 'work', label: 'work' }, { id: 'condition', label: 'condition' }],
      [
        ['find cheapest s-t path', 'residual capacity exists'],
        ['push bottleneck flow', 'respect capacities'],
        ['add reverse edges/costs', 'allow correction'],
        ['no path or demand met', 'return flow and cost'],
      ],
    ),
    highlight: { active: ['shortest:work', 'augment:work'], found: ['stop:condition'] },
    explanation: 'The loop is a cost-aware version of augmenting-path max flow. The residual graph carries both capacity and price information.',
  };
}

function* assignmentModel() {
  yield {
    state: flowGraph('Assignment as a flow network'),
    highlight: { active: ['s', 'a', 'b', 'x', 'y', 't'], found: ['e-a-x', 'e-b-y'] },
    explanation: 'A bipartite assignment can be modeled with source-to-worker capacity, worker-to-task cost edges, and task-to-sink capacity. Sending two units assigns both tasks.',
  };

  yield {
    state: labelMatrix(
      'Candidate assignments',
      [
        { id: 'ax', label: 'A -> X' },
        { id: 'ay', label: 'A -> Y' },
        { id: 'bx', label: 'B -> X' },
        { id: 'by', label: 'B -> Y' },
      ],
      [{ id: 'capacity', label: 'capacity' }, { id: 'cost', label: 'cost' }],
      [
        ['1', '2'],
        ['1', '6'],
        ['1', '4'],
        ['1', '1'],
      ],
    ),
    highlight: { found: ['ax:cost', 'by:cost'], compare: ['ay:cost'] },
    explanation: 'The cheapest complete assignment is A -> X and B -> Y with total cost 3. The flow model also handles capacities, optional tasks, and side constraints better than a pure matching view.',
  };

  yield {
    state: labelMatrix(
      'Case study: courier dispatch',
      [
        { id: 'drivers', label: 'drivers' },
        { id: 'jobs', label: 'jobs' },
        { id: 'costs', label: 'costs' },
        { id: 'flow', label: 'flow' },
      ],
      [{ id: 'meaning', label: 'meaning' }, { id: 'model' }],
      [
        ['available couriers', 'source capacity'],
        ['orders to deliver', 'sink demand'],
        ['ETA, priority, penalty', 'edge cost'],
        ['chosen assignments', 'min total cost'],
      ],
    ),
    highlight: { active: ['costs:model'], found: ['flow:model'] },
    explanation: 'The complete use case is dispatch: maximize fulfilled jobs while minimizing ETA or penalty. Hopcroft-Karp can maximize count; min-cost max-flow adds the cost objective.',
  };

  yield {
    state: labelMatrix(
      'When to avoid it',
      [
        { id: 'huge', label: 'huge dense graph' },
        { id: 'online', label: 'online changes' },
        { id: 'simple', label: 'unweighted matching' },
        { id: 'negative', label: 'negative cycles' },
      ],
      [{ id: 'issue', label: 'issue' }, { id: 'response' }],
      [
        ['too many edges', 'exploit domain structure'],
        ['full re-solve costly', 'incremental heuristic'],
        ['cost not needed', 'Hopcroft-Karp'],
        ['unbounded improvement', 'model is invalid'],
      ],
    ),
    highlight: { compare: ['huge:issue', 'online:issue'], found: ['simple:response'] },
    explanation: 'Min-cost flow is expressive, but that expressiveness costs implementation complexity. Use it when capacities and costs are truly part of the problem.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'residual costs') yield* residualCosts();
  else if (view === 'assignment model') yield* assignmentModel();
  else throw new InputError('Pick a min-cost max-flow view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: [
      'Min-cost max-flow asks for the maximum possible flow through a network while minimizing total cost. Edges have capacities and costs. A unit of flow sent through an edge consumes capacity and adds cost. This generalizes matching, assignment, transportation, scheduling, and routing problems.',
      'The common algorithmic shape is successive shortest augmenting paths in a residual graph. Each iteration finds the cheapest available source-to-sink path, pushes as much flow as allowed, and updates residual capacities and reverse edges.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The residual graph records what can still be done and what can be undone. Forward edges represent unused capacity. Reverse edges represent the ability to cancel previous flow, with negative cost. That cancellation is essential because the first locally cheap path may need to be rerouted after more flow is required.',
      'Because reverse edges can have negative costs, efficient implementations often use potentials. Potentials reweight edges so shortest paths can be found with Dijkstra while preserving the identity of the cheapest path in the original cost model.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The exact complexity depends on the algorithm variant, capacities, and shortest-path method. Successive shortest path is conceptually approachable and works well for many moderate-size graphs, but it is not the only min-cost-flow algorithm. The engineering details include residual edge bookkeeping, overflow-safe costs, and negative-cycle avoidance.',
      'The modeling cost is just as important as runtime. If the graph is dense because every worker can do every task, the edge count may dominate. If the problem is unweighted, Hopcroft-Karp or ordinary max flow is often simpler.',
      'Potentials are another implementation boundary. They make repeated Dijkstra searches possible after negative reverse edges appear, but only if reduced costs and distance updates are maintained consistently. A wrong potential update can silently produce a non-minimal assignment.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'Courier dispatch is a clean example. Drivers connect to deliveries they can reach, each edge has a cost such as estimated arrival time or lateness penalty, and capacities enforce one driver per job. Max-flow maximizes the number of served deliveries; min-cost chooses the cheapest feasible assignment among those maximum-cardinality choices.',
      'The same model appears in ad allocation, train scheduling, warehouse picking, and batch job placement. It is a structure for turning local pair costs plus global capacity constraints into one optimization problem.',
      'A practical dispatch system may also add dummy jobs or dummy drivers with penalty costs. That lets the model represent unserved work or idle capacity explicitly instead of hiding those cases outside the graph.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: CP-Algorithms Minimum Cost Flow, https://cp-algorithms.com/graph/min_cost_flow.html, and USACO Guide Min Cost Flow, https://usaco.guide/adv/min-cost-flow. Study Hopcroft-Karp Bipartite Matching, Dijkstra, Binary Heap, Graph BFS, and Two-Phase Commit next.',
    ] },
  ],
};
