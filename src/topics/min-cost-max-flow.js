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
  const nodeCount = 7; // s, A, B, X, Y, t, potentials
  const edgeCount = 10;
  const loopSteps = 4; // shortest path, augment, update residuals, stop

  yield {
    state: flowGraph('Pick the cheapest augmenting path'),
    highlight: { active: ['s', 'b', 'y', 't', 'e-s-b', 'e-b-y', 'e-y-t'], compare: ['a', 'x'] },
    explanation: `Min-cost max-flow augments flow through a residual network of ${nodeCount} nodes and ${edgeCount} edges. Instead of any available path, it chooses a path with minimum total cost, here source -> B -> Y -> sink.`,
    invariant: `Flow value increases while total cost is kept as low as possible for that value across all ${nodeCount} nodes.`,
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
    explanation: `Reverse edges are what make the algorithm corrective. A later cheaper global solution can cancel part of an earlier path by sending flow along a negative-cost reverse edge in the ${edgeCount}-edge residual network.`,
  };

  yield {
    state: flowGraph('Potentials make Dijkstra usable with reduced costs'),
    highlight: { active: ['pot', 'e-pot-a', 'e-pot-y'], found: ['s', 't'] },
    explanation: `Residual graphs can have negative-cost reverse edges. Successive shortest path implementations maintain node potentials across ${nodeCount} nodes so reduced costs stay nonnegative and Dijkstra can be used efficiently.`,
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
    explanation: `The ${loopSteps}-step loop is a cost-aware version of augmenting-path max flow. The residual graph across ${edgeCount} edges carries both capacity and price information.`,
  };
}

function* assignmentModel() {
  const workers = 2; // A, B
  const tasks = 2; // X, Y
  const totalAssignments = 4; // A->X, A->Y, B->X, B->Y
  const optimalCost = 3; // A->X (cost 2) + B->Y (cost 1)

  yield {
    state: flowGraph('Assignment as a flow network'),
    highlight: { active: ['s', 'a', 'b', 'x', 'y', 't'], found: ['e-a-x', 'e-b-y'] },
    explanation: `A bipartite assignment of ${workers} workers to ${tasks} tasks can be modeled with source-to-worker capacity, worker-to-task cost edges, and task-to-sink capacity. Sending ${workers} units assigns both tasks.`,
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
    explanation: `The cheapest complete assignment is A -> X and B -> Y with total cost ${optimalCost}. The flow model across ${totalAssignments} candidate edges also handles capacities, optional tasks, and side constraints better than a pure matching view.`,
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
    explanation: `The complete use case is dispatch: maximize fulfilled jobs while minimizing ETA or penalty across ${workers} drivers and ${tasks} jobs. Hopcroft-Karp can maximize count; min-cost max-flow adds the cost objective.`,
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
    explanation: `Min-cost flow is expressive, but that expressiveness costs implementation complexity. Use it when capacities and costs across ${totalAssignments} or more candidate edges are truly part of the problem.`,
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
    { heading: 'How to read the animation', paragraphs: [
      'Each edge label is capacity/cost: capacity is how many units can still move, and cost is the price per unit. Active edges are the current source to sink path in the residual graph, which stores both unused capacity and undo capacity. A reverse edge means earlier flow can be cancelled without breaking conservation.',
      'The safe inference rule is that a path using a reverse edge is revising a previous routing choice, not sending physical flow backward. Potentials are node prices used to make reduced costs nonnegative for shortest-path search. In the assignment view, found worker-to-task edges are the chosen assignment.',
      {type: 'callout', text: 'Min-cost max-flow becomes reliable only when old routing choices can be undone through residual edges.'},
      {type: 'image', src: './assets/gifs/min-cost-max-flow.gif', alt: 'Animated walkthrough of the min cost max flow visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'Many systems must move limited resources through a network. Drivers go to jobs, packets cross links, goods leave warehouses, and workers cover tasks. Maximum flow asks how much can move from source to sink under capacity limits.',
      'Min-cost max-flow adds a price to each unit on each edge. Among all plans that send the maximum amount, it chooses the cheapest one. The price can represent distance, latency, penalty, energy, or assignment mismatch, as long as total cost is additive.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious method is greedy: pick the cheapest available path, push as much as the bottleneck allows, and repeat. For small examples, this feels right because every unit takes the best route currently visible. For assignment, the same instinct picks the cheapest worker-task pair first.',
    ] },
    { heading: 'The wall', paragraphs: [
      'Local cheap choices can block a cheap complete plan. Suppose A to X costs 1, A to Y costs 2, B to X costs 2, and B to Y costs 100, with each worker and task used once. Greedy picks A to X, then must pick B to Y for total 101, while A to Y plus B to X costs 4.',
      'The wall is irreversibility. Pure greedy cannot undo A to X after it discovers the consequence. Flow needs a representation where earlier choices can be cancelled and rerouted when the global picture changes.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The residual graph records what can still happen. A forward residual edge means more flow can go that way; a reverse residual edge means existing flow can be cancelled. For a cost c edge, the reverse edge has cost -c because cancelling refunds the earlier cost.',
      'Min-cost max-flow repeatedly finds the cheapest augmenting path in that residual graph. The path can mix forward edges that add flow and reverse edges that revise old flow. That is the step that turns local augmentations into a correctable search.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A residual network is a directed graph whose edges encode both remaining capacity and undo choices. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
    ] },
    { heading: 'How it works', paragraphs: [
      'Start with zero flow. Build residual edges, find a cheapest residual path from source to sink, push the bottleneck amount, then update forward and reverse capacities. Repeat until no path remains or the desired flow has been sent.',
      'Reverse edges create negative costs, so implementations often use node potentials. Reduced cost equals original cost plus potential[u] minus potential[v]. With valid potentials, Dijkstra can find shortest residual paths while preserving the true ordering of path costs.',
      'The assignment reduction adds source-to-worker edges, worker-to-task cost edges, and task-to-sink edges, all with capacity 1 where each worker or task can be used once. Sending k units chooses k assignments with minimum total cost.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Simple_bipartite_graph%3B_two_layers.svg/500px-Simple_bipartite_graph%3B_two_layers.svg.png', alt: 'Bipartite graph drawn as two layers with edges only crossing between them', caption: 'The assignment reduction is a bipartite graph with source and sink edges added around the two layers. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Simple_bipartite_graph;_two_layers.svg.'},
    ] },
    { heading: 'Why it works', paragraphs: [
      'Feasibility comes from conservation. Each augmentation adds the same amount along a full path, so intermediate nodes receive and send equal added flow. The bottleneck rule prevents any edge from exceeding capacity.',
      'Maximum flow follows the residual-graph cut argument: if no augmenting path remains, the source cannot reach the sink through unused capacity, and the reachable side defines a cut equal to the current flow. Minimum cost follows because any cheaper same-value flow would imply an improving residual reroute or negative-cost correction.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph arranged in topological order', caption: 'Many flow applications start from dependency or assignment graphs; the algorithm then adds capacity, cost, and residual edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Topological_Ordering.svg.'},
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Successive shortest path with Dijkstra and potentials costs about O(F * E log V), where F is the total flow, E is edge count, and V is vertex count. More required flow means more augmentations when bottlenecks are small. More edges make every shortest-path search more expensive.',
      'Memory is O(E) for forward and reverse residual edges plus O(V) for distances, potentials, and predecessors. The reverse edges are not removable overhead; they are the mechanism that allows correction. Dense graphs, huge flow values, and online re-solving are the expensive cases.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Min-cost flow fits dispatch, assignment, scheduling, routing, resource allocation, and matching where count and price both matter. Courier dispatch can maximize completed deliveries while minimizing ETA or lateness penalty. Ad allocation and warehouse routing use the same shape when capacities and additive costs are explicit.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when the real constraints are not flow constraints. Time windows, precedence, fairness, nonlinear penalties, and stability rules often need integer programming or domain search. Encoding them as flow can create a graph that is correct in pieces but wrong for the product.',
      'It also fails as a low-latency online controller when the whole network changes after each event. Re-solving can cost more than the decision is worth. Negative residual cycles usually mean the model is missing a constraint or the objective is unbounded.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'Use two workers A and B and two tasks X and Y. Costs are A to X = 2, A to Y = 6, B to X = 4, and B to Y = 1. Source-to-worker and task-to-sink edges have capacity 1 and cost 0.',
      'The cheapest first path is source to B to Y to sink with cost 1, so assign B to Y. The next cheapest useful path is source to A to X to sink with cost 2, so assign A to X. Total flow is 2 and total cost is 3, while A to Y plus B to X costs 10.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study Ford and Fulkerson for augmenting paths and max-flow min-cut, Edmonds and Karp for shortest augmenting paths, Dinic for blocking flows, and Goldberg-Tarjan for push-relabel and cost-scaling. These sources make the residual graph central rather than incidental.',
      'Study BFS, Dijkstra, and graph representation first. Then study Bipartite Matching, Hungarian Algorithm, Linear Programming Duality, and Min Cut so you can choose the simplest optimizer that matches the problem structure.',
    ] },
  ],
};
