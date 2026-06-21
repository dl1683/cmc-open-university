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
      heading: 'How to read the animation',
      paragraphs: [
        'Each edge label shows capacity/cost. The highlighted path in the residual-cost view is the current augmenting path -- the route from source to sink that can carry more flow. Active nodes and edges trace the path being pushed. Compared nodes are alternatives the algorithm evaluated and rejected because the active path is cheaper.',
        'When flow is pushed along an edge, a reverse edge appears in the residual graph. Forward residual capacity means more flow can still go that direction. Reverse residual capacity means flow already sent can be cancelled. An augmenting path that uses a reverse edge is not sending flow backward through a pipe -- it is revising an earlier routing decision.',
        'The potentials node shows Johnson\'s reweighting trick. Reduced cost of edge (u, v) = original cost + potential[u] - potential[v]. This keeps all reduced costs nonnegative so Dijkstra works, even though the true residual graph has negative-cost reverse edges. In the assignment view, source connects to workers, workers connect to tasks with cost edges, tasks connect to sink. Found edges are the final assignments.',
        {type: 'callout', text: 'Min-cost max-flow becomes reliable only when old routing choices can be undone through residual edges.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In 1956, during the Cold War, the US Air Force funded a RAND Corporation study on Soviet railway capacity. Lester Ford and Delbert Fulkerson asked: given a network of links with limited capacity, what is the maximum throughput from one point to another? Their answer -- the augmenting-path method and the max-flow min-cut theorem -- became one of the most applied results in combinatorial optimization.',
        'The problem generalizes far beyond railways. Any situation where material, data, or assignments must pass through a network with capacity constraints is a max-flow problem: how much can the network carry, and which links are the bottleneck? When each link also has a per-unit cost, the problem becomes min-cost max-flow: among all maximum-throughput plans, find the cheapest one. The successive shortest path method solves this by augmenting along the cheapest residual path at each step.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Greedy: find any path from source to sink, push flow equal to the smallest edge capacity on that path (the bottleneck), repeat until no path exists. On simple networks this works. Graph S->A(10), A->T(10), S->B(10), B->T(10) has two independent paths, and greedy finds both for a total of 20 units.',
        'Adding costs to the greedy idea: always pick the cheapest available path. Each individual augmentation is locally optimal, so the total cost should be low. This feels reasonable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Greedy can get stuck at suboptimal total flow. Consider S->A(10), S->B(10), A->B(1), A->T(10), B->T(10). Greedy might pick path S->A->B->T first, pushing only 1 unit through the bottleneck A->B. Then S->A->T carries 9 and S->B->T carries 9, totaling 19. The optimum is 20: send 10 through S->A->T and 10 through S->B->T, ignoring A->B entirely. The greedy choice consumed a narrow bottleneck that blocked a better global plan.',
        'The cost version is worse. Driver A can serve job X for cost 1 or job Y for cost 2. Driver B can serve X for cost 2 or Y for cost 100. Greedy assigns A->X first (cheapest single edge), forcing B->Y, total cost 101. The true cheapest complete assignment is A->Y plus B->X, total cost 4. One locally cheap decision created a globally expensive plan, and pure greedy cannot undo it.',
        'The key insight: flow must be undoable. The algorithm needs a mechanism to reverse earlier choices when they turn out to be globally suboptimal.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The residual graph makes every decision reversible. After pushing flow along edge u->v, the algorithm creates a reverse edge v->u. The forward residual edge (remaining capacity) says "more flow can still go this way." The reverse residual edge (equal to flow already sent) says "cancel some of what already went this way." For min-cost flow, the reverse edge carries the negated cost -- cancelling flow refunds the price paid.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A residual network is a directed graph whose edges encode both remaining capacity and undo choices. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'An augmenting path through the residual graph can mix forward and reverse edges. When it uses a reverse edge, the algorithm is not physically sending flow backward. It is revising the plan: undo part of an earlier route, reroute that flow through a cheaper or higher-capacity combination. This turns a sequence of irrevocable greedy steps into a correctable search over all possible flow configurations.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Ford-Fulkerson method (capacity only): start with zero flow everywhere. Build the residual graph -- for each edge with capacity c, create a forward residual edge (capacity c) and a reverse residual edge (capacity 0). While there exists any path from source to sink in the residual graph: find the path, compute the bottleneck (minimum residual capacity along the path), push that much flow (subtract bottleneck from forward edges, add bottleneck to reverse edges). When no augmenting path exists, the current flow is maximum.',
        'Edmonds-Karp refinement: use BFS to find the shortest augmenting path (fewest edges). This single change guarantees O(VE^2) worst-case time regardless of capacity values, because each BFS augmentation increases the shortest-path distance from source to at least one node, and distances only grow.',
        'Min-cost max-flow (successive shortest paths): add costs to every edge. Instead of any augmenting path, find the cheapest one. Maintain node potentials so reduced costs stay nonnegative: reduced cost of (u, v) = cost(u, v) + potential[u] - potential[v]. After each shortest-path computation, update potentials by the distances found. This lets Dijkstra with a binary heap run in O(E log V) per augmentation, even with negative-cost reverse edges in the true residual graph.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Simple_bipartite_graph%3B_two_layers.svg/500px-Simple_bipartite_graph%3B_two_layers.svg.png', alt: 'Bipartite graph drawn as two layers with edges only crossing between them', caption: 'The assignment reduction is a bipartite graph with source and sink edges added around the two layers. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Simple_bipartite_graph;_two_layers.svg.'},
        'The assignment model is a direct application. Source connects to each worker (capacity 1, cost 0). Each worker connects to feasible tasks (capacity 1, assignment cost on each edge). Each task connects to sink (capacity 1, cost 0). Maximum flow assigns as many workers as possible; the min-cost objective picks the cheapest such assignment.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Max-flow min-cut theorem (Ford and Fulkerson, 1956): the maximum flow from source to sink equals the minimum cut capacity. A cut partitions nodes into a source-side set S and a sink-side set T. Cut capacity is the sum of edge capacities from S to T. When no augmenting path exists in the residual graph, the nodes reachable from the source form S, and the unreachable nodes form T. Every edge from S to T is fully saturated (no forward residual capacity), and every edge from T to S carries zero flow (no reverse residual capacity). The flow across this partition equals the cut capacity, so it is maximum.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Topological_Ordering.svg', alt: 'Directed acyclic graph arranged in topological order', caption: 'Many flow applications start from dependency or assignment graphs; the algorithm then adds capacity, cost, and residual edges. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Topological_Ordering.svg.'},
        'For the cost objective: if the current flow is not minimum-cost for its value, a negative-cost cycle exists in the residual graph -- rerouting flow around that cycle would reduce total cost without changing total flow. Augmenting along cheapest paths with valid potentials guarantees no negative-cost residual cycle at any step. By induction, the flow is minimum-cost at every intermediate value, so it remains minimum-cost when it reaches the maximum.',
        'Flow conservation enforces feasibility. At every node except source and sink, total flow in equals total flow out. Combined with capacity limits and the successive shortest path optimality, the result is both feasible and optimal.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Ford-Fulkerson with DFS: O(E * |f*|) where |f*| is the maximum flow value. Each augmentation sends at least 1 unit (with integer capacities), and each DFS costs O(E). Fine for small integer capacities. Pathological on large or irrational capacities -- the flow can increase by vanishingly small amounts, and the algorithm may not terminate.',
        'Edmonds-Karp with BFS: O(VE^2). At most O(VE) augmentations, each costing O(E) for the BFS. For a 100-node, 500-edge graph, worst case is about 25 million operations. Double the graph: roughly 8x slower, since V, E, and the product VE all grow.',
        'Dinic with level graphs and blocking flows: O(V^2 * E). On unit-capacity graphs, this drops to O(E * sqrt(V)), making it the standard choice for bipartite matching via flow reduction. Push-relabel (Goldberg and Tarjan, 1988): O(V^3), or O(V^2 * sqrt(E)) with highest-label selection. Avoids augmenting paths entirely by pushing excess flow locally and relabeling node heights.',
        'Min-cost max-flow with successive shortest paths: O(F * E * log V) using Dijkstra with potentials, where F is total flow. The cost-scaling algorithm (Goldberg and Tarjan, 1990) runs in O(VE * log(V) * log(VC)) where C is maximum cost, removing dependence on flow value. In practice, sparse graphs with small integer capacities favor Dinic for pure max-flow; dense graphs with large capacities favor push-relabel; cost-sensitive problems favor successive shortest paths or cost-scaling.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Bipartite matching reduces directly to max flow. Connect source to every node on the left, every node on the right to sink, all capacities 1. Each unit of flow is a matched pair. Hopcroft-Karp is faster for unweighted matching, but min-cost max-flow handles weighted matching (the assignment problem) with no extra machinery.',
        'Image segmentation (graph cuts). Pixels are nodes. Similar adjacent pixels share high-capacity edges. Source represents foreground, sink represents background. The minimum cut separates the image into two regions, minimizing the cost of cutting across similar pixels. GrabCut and related interactive segmentation tools used this as their backbone.',
        'Airline scheduling: maximize flights served by a fixed fleet, with connection-time and maintenance constraints modeled as capacities. Baseball elimination: can team X still win? Build a flow network where source-to-game edges have capacity equal to remaining games between other teams; the min-cut reveals whether enough wins can redistribute to keep X alive. Network routing, project selection (choose projects to maximize profit minus shared resource costs), courier dispatch, and ad allocation all reduce to flow problems.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Ford-Fulkerson with DFS and irrational capacities may never terminate. The flow increases by smaller and smaller amounts, converging to a value below the true maximum. Floating-point capacities trigger the same behavior in practice. Edmonds-Karp and Dinic avoid this by forcing shortest or level-graph augmenting paths, guaranteeing termination regardless of capacity type.',
        'Scale. On networks with millions of nodes, even polynomial algorithms need heuristics -- gap relabeling, global relabeling, and warm-starting -- to run in practical time. The theoretical bounds understate the constant factors. For dense complete bipartite graphs, the O(n^3) auction algorithm (Bertsekas, 1981) often beats successive shortest paths.',
        'Expressiveness limits. Min-cost max-flow handles capacity and additive cost. It cannot express time windows, precedence constraints, fairness rules, nonlinear penalties, or stability requirements. Those need integer programming, constraint programming, or domain-specific schedulers. For online problems where jobs arrive continuously, re-solving the entire network after each event is expensive; flow becomes a batch planner, not a real-time controller.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Network: 4 nodes S, A, B, T. Edges: S->A (cap 3), S->B (cap 2), A->B (cap 1), A->T (cap 2), B->T (cap 3). All reverse residual edges start at capacity 0.',
        'Augmentation 1: BFS finds path S->A->T (2 edges). Bottleneck = min(3, 2) = 2. Push 2 units. Residual: S->A has 1 forward remaining, A->T has 0 forward remaining, reverse edges A->S(2) and T->A(2) appear. Flow = 2.',
        'Augmentation 2: BFS finds path S->B->T (2 edges). Bottleneck = min(2, 3) = 2. Push 2 units. Residual: S->B has 0 remaining, B->T has 1 remaining, reverse edges B->S(2) and T->B(2) appear. Flow = 4.',
        'Augmentation 3: BFS finds path S->A->B->T (3 edges). Bottleneck = min(1, 1, 1) = 1. Push 1 unit. Residual: S->A has 0 remaining, A->B has 0 remaining, B->T has 0 remaining. Flow = 5.',
        'No more augmenting paths exist -- S has no outgoing edges with residual capacity. Maximum flow = 5.',
        'Verify with min-cut: partition {S} vs {A, B, T}. Cut capacity = cap(S->A) + cap(S->B) = 3 + 2 = 5, which equals the max flow. The max-flow min-cut theorem holds. Alternative cut {S, A} vs {B, T}: capacity = cap(S->B) + cap(A->B) + cap(A->T) = 2 + 1 + 2 = 5. Both cuts have the same capacity, confirming 5 is the minimum cut.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Ford and Fulkerson, "Maximal Flow Through a Network" (1956) -- the augmenting-path method and the max-flow min-cut theorem. Edmonds and Karp, "Theoretical Improvements in Algorithmic Efficiency for Network Flow Problems" (1972) -- BFS augmenting paths for O(VE^2), removing dependence on capacity values. Dinic, "Algorithm for Solution of a Problem of Maximum Flow in a Network" (1970) -- level graphs and blocking flows for O(V^2E). Goldberg and Tarjan, "A New Approach to the Maximum-Flow Problem" (1988) -- push-relabel. Goldberg and Tarjan, "Finding Minimum-Cost Circulations by Successive Approximation" (1990) -- cost scaling for min-cost flow.',
        'Prerequisites: BFS (Edmonds-Karp finds augmenting paths with BFS), Dijkstra\'s algorithm (successive shortest paths uses Dijkstra with potentials for each augmentation), graph representation (adjacency lists with forward/reverse edge pairs for efficient residual graph updates).',
        'Extensions: bipartite matching reduces to unit-capacity max flow; Hopcroft-Karp is the specialized O(E sqrt(V)) version. Min-cut problems are the dual of max flow -- same value by the MFMC theorem. Linear programming: max flow and min-cost flow are LP special cases; the LP dual gives the min-cut and potential interpretations. For weighted assignments, study the Hungarian algorithm (O(n^3) for dense bipartite graphs) as an alternative to the flow reduction.',
      ],
    },
  ],
};
