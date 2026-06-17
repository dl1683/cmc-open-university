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
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many allocation problems are not just about whether something can be routed. They also ask which feasible routing is cheapest. A delivery platform wants to serve as many jobs as possible, but among those maximum-service plans it wants the least lateness. A scheduler wants to place every job it can, but it prefers cheaper machines. A transport network wants throughput, but fuel, tolls, and congestion matter.',
        'Plain max flow answers the capacity question and ignores price. Shortest path answers one cheapest route and ignores competition for shared capacity. Min-cost max-flow combines both: send as much flow as possible, then among all flows of that value, choose the one with minimum total edge cost.',
        'That extra objective is why the structure is useful. It turns matching, transportation, assignment, circulation with lower bounds, and many scheduling problems into one graph model with a small set of rules: capacities limit how much can pass, costs price each unit, and conservation keeps the accounting honest.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to solve max flow, get the largest feasible amount, and then try to improve the cost afterward. That separates two goals that are actually coupled. The cheap edge choices made early can determine which later capacity is even available.',
        'The second instinct is greedy assignment: repeatedly choose the cheapest available source-to-sink path or the cheapest worker-task pair. That works only when choices do not interact. Flow choices do interact because an edge can be saturated, and a later unit may need a route that passes through the reverse of an earlier choice.',
        'A third option is to enumerate feasible assignments and pick the cheapest one. That is useful for tiny examples and useless for real inputs. The number of feasible flows can explode even when the graph itself is modest.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that a locally cheap unit of flow can be globally wrong. Suppose driver A can do delivery X for cost 1 or Y for cost 2, while driver B can do X for cost 2 or Y for cost 100. Greedy picks A-X first because it costs 1. The second delivery then forces B-Y, for total cost 101. The best maximum assignment is A-Y and B-X, total cost 4.',
        'The hard part is not noticing that the first decision was wrong. The hard part is representing a legal repair without tearing the whole solution down. Once A-X has been chosen, the algorithm needs a way to say: cancel A-X, move A to Y, and give X to B.',
        'That repair is exactly what a residual graph can express. Without reverse edges, the search can only add new flow. With reverse edges, the search can add flow and undo earlier flow as part of the same path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Keep a residual network that records both remaining capacity and the cost of undoing current flow. A forward residual edge means more flow can still be sent that way. A reverse residual edge means some existing flow can be cancelled, and its cost is the negative of the original edge cost because cancelling refunds that earlier decision.',
        'Then each augmentation asks a precise question: what is the cheapest residual source-to-sink path that increases the total flow? That path may use ordinary forward edges, reverse edges that cancel prior assignments, or both. The result is not greedy in the naive sense; it is greedy over the current space of legal corrections.',
        'Potentials are the other key idea in efficient implementations. Reverse edges introduce negative costs. Potentials reweight edges into nonnegative reduced costs so Dijkstra can be used repeatedly while preserving which residual path is cheapest in the original cost model.',
      ],
    },
    {
      heading: 'Reading the residual-cost view',
      paragraphs: [
        'In the residual-cost view, read every edge as an option still available to the optimizer. A forward edge with capacity is unused room. A reverse edge is a refund button for flow that has already been sent. If a shortest residual path crosses a reverse edge, the algorithm is not sending physical material backward; it is revising the current plan.',
        'Watch how the total cost changes after each augmenting path. The path cost is the marginal price of increasing the flow by the pushed amount. When the path includes a negative reverse edge, that negative term is the value recovered by cancelling an older choice.',
        'The important question after each frame is: what did this path make possible that was not possible before? In min-cost flow, the answer is often a reroute. A small local cancellation can unlock a much cheaper global assignment.',
      ],
    },
    {
      heading: 'Reading the assignment view',
      paragraphs: [
        'In the assignment view, the source connects to supply nodes such as drivers, workers, machines, or warehouses. Demand nodes such as jobs or deliveries connect to the sink. Middle edges carry the pairwise cost of assigning one supply unit to one demand unit. Unit capacities enforce one-to-one matching; larger capacities model pooled supply.',
        'The model maximizes how many demands can be served before it worries about which maximum assignment is cheapest. If serving fewer jobs is allowed, add dummy jobs or dummy workers with explicit penalty costs. That keeps tradeoffs inside the graph instead of hiding them in special-case code.',
        'When a later augmenting path uses a reverse assignment edge, read it as a swap. The algorithm is saying that an existing worker should give up one job because another worker can cover it more cheaply once the whole plan is considered.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with zero flow. Build residual edges for every original edge: a forward edge with the original capacity and cost, and a reverse edge with zero residual capacity and negative cost. Repeatedly find the cheapest source-to-sink path in the residual graph. Push as much flow as the bottleneck capacity allows. Update forward and reverse residual capacities.',
        'If all capacities are one, each augmentation adds one unit of flow. With larger capacities, one path may push many units. The accounting is the same: total flow increases by the pushed amount, and total cost increases by pathCost * pushedAmount.',
        'With potentials, each edge cost is replaced during shortest-path search by reducedCost(u, v) = cost(u, v) + potential[u] - potential[v]. After a shortest-path run, potentials are updated by the computed distances. That keeps reduced costs nonnegative when the invariant is maintained, so binary-heap Dijkstra is available even though the true residual graph contains negative reverse edges.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'For a fixed current flow, every legal way to increase that flow by one or more units corresponds to a path or set of paths in the residual graph. Reverse edges encode the cancellation parts of the change. So the cheapest residual augmenting path is the cheapest local change that raises the flow value.',
        'After each augmentation, the residual graph represents the new space of legal changes. If there is no source-to-sink residual path, no more flow can be sent, so the flow is maximum. If the algorithm always augments along cheapest residual paths and maintains valid potentials, the flow after each value increase is minimum-cost among flows of that value.',
        'Another way to say the invariant: a cheaper flow of the same value would imply a negative-cost cycle in the residual graph. Correct min-cost-flow algorithms either avoid such cycles or cancel them. Successive shortest path with potentials maintains the shortest-path structure needed for that guarantee.',
      ],
    },
    {
      heading: 'Worked example: repairing a bad dispatch',
      paragraphs: [
        'Use the two-driver example. A-X costs 1, A-Y costs 2, B-X costs 2, and B-Y costs 100. The first cheapest path is source -> A -> X -> sink, so A gets X and the current cost is 1.',
        'For the second unit, the residual graph contains X -> A with cost -1 because A-X can be cancelled. The cheapest augmenting path is source -> B -> X -> A -> Y -> sink. Its cost is 2 + (-1) + 2 = 3. Pushing through it assigns B to X, cancels A-X, and assigns A to Y.',
        'The final cost is 1 + 3 = 4. That matches the true optimum A-Y plus B-X. The example is small, but it shows the reason residual reverse edges exist: they let the algorithm improve a maximum assignment by expressing a swap as one path.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The common successive-shortest-path implementation costs roughly O(F * shortestPathCost), where F is the amount of flow sent. With Dijkstra and potentials, that is often written as O(F * E log V). Other min-cost-flow algorithms have different bounds and are better for some dense or high-capacity cases.',
        'The implementation is easy to get subtly wrong. Reverse-edge indices must stay paired. Costs should use a numeric type large enough for path cost times flow. Initial potentials require care if negative original costs exist. A wrong reduced-cost update can produce a feasible flow that is not actually minimum-cost.',
        'The modeling cost matters too. A graph with every worker connected to every task may be too dense. A graph that encodes soft business rules as arbitrary edge costs may be misleading. Min-cost flow is strongest when capacities, conservation, and additive costs are genuinely the structure of the problem.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'It wins in assignment with penalties, transportation, crew scheduling, warehouse picking, ad allocation, balancing supply across regions, and network routing where each unit consumes capacity and adds a measurable cost.',
        'It is also a good modeling language for contest and interview problems that combine matching with weights, quotas, lower bounds, or multiple resource layers. Once the graph is correct, the same residual machinery handles many cases that would otherwise need custom exchange arguments.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is not the right first tool for unweighted matching or plain reachability. Hopcroft-Karp, ordinary max flow, BFS, or Dijkstra may solve the real problem with less machinery.',
        'It also fails when the desired constraints are not additive edge costs. Time windows, fairness, stability, precedence constraints, batching, and nonlinear penalties may require integer programming, specialized scheduling algorithms, or a richer optimizer. For online systems, a full re-solve after every event may be too slow, so min-cost flow may become a batch planner rather than the live control loop.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study max flow first, then Dijkstra, Bellman-Ford, potentials, bipartite matching, and the transportation problem. The main habit to build is modeling: identify supplies, demands, capacities, costs, and the exact meaning of one unit of flow before choosing an implementation.',
      ],
    },
  ],
};
