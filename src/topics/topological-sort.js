// Topological sort (Kahn's algorithm): turn a dependency graph into a legal
// execution order, and certify a cycle when no ready node exists.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'topological-sort',
  title: 'Topological Sort',
  category: 'Data Structures',
  summary: 'Order tasks so every prerequisite comes first, and detect circular dependencies for free.',
  controls: [
    { id: 'scenario', label: 'Prerequisites', type: 'select', options: ['valid plan', 'circular (deadlock!)'], defaultValue: 'valid plan' },
  ],
  run,
};

// A course catalog as a dependency graph: edge X -> Y means "X before Y".
const NODES = [
  { id: 'CS1', x: 1.0, y: 2.8 }, { id: 'M1', x: 1.0, y: 7.2 },
  { id: 'DS', x: 3.6, y: 2.6 }, { id: 'AL', x: 5.6, y: 5.4 },
  { id: 'DB', x: 5.6, y: 1.4 }, { id: 'ML', x: 7.4, y: 7.4 },
  { id: 'CAP', x: 9.2, y: 4.0 },
];
const BASE_EDGES = [
  ['CS1', 'DS'], ['M1', 'AL'], ['M1', 'ML'], ['DS', 'AL'],
  ['DS', 'DB'], ['AL', 'ML'], ['DB', 'CAP'], ['ML', 'CAP'],
];
const CYCLE_EDGE = ['CAP', 'CS1']; // the capstone is incorrectly required before intro

export function* run(input) {
  const circular = String(input.scenario) === 'circular (deadlock!)';
  if (!['valid plan', 'circular (deadlock!)'].includes(String(input.scenario))) {
    throw new InputError('Pick a scenario.');
  }
  const edges = circular ? [...BASE_EDGES, CYCLE_EDGE] : BASE_EDGES;

  const inDegree = new Map(NODES.map((n) => [n.id, 0]));
  for (const [, to] of edges) inDegree.set(to, inDegree.get(to) + 1);
  const order = [];
  const position = new Map();

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      label: n.id,
      note: position.has(n.id) ? `#${position.get(n.id)}` : `needs ${inDegree.get(n.id)}`,
    })),
    edges: edges.map(([from, to]) => ({ id: `${from}-${to}`, from, to })),
  });

  yield {
    state: snapshot(),
    highlight: circular ? { compare: [`${CYCLE_EDGE[0]}-${CYCLE_EDGE[1]}`] } : {},
    explanation: `Seven courses, where an arrow X -> Y means "take X before Y". Kahn's algorithm counts each node's incoming arrows, repeatedly schedules anything with zero unmet prerequisites, and deletes its outgoing edges.${circular ? ' The circular scenario also makes the capstone a prerequisite for the intro course, which should make the schedule impossible.' : ''}`,
  };

  const queue = NODES.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  yield {
    state: snapshot(),
    highlight: { active: queue.map((id) => id) },
    explanation: `Start with the ready queue: ${queue.length ? queue.join(', ') : 'nothing'}. A node is ready exactly when all of its prerequisites are already scheduled.`,
    invariant: 'The queue contains every node whose prerequisites are already in the output order.',
  };

  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    position.set(id, order.length);
    const unlocked = [];
    for (const [from, to] of edges) {
      if (from !== id) continue;
      inDegree.set(to, inDegree.get(to) - 1);
      if (inDegree.get(to) === 0) {
        unlocked.push(to);
        queue.push(to);
      }
    }
    yield {
      state: snapshot(),
      highlight: {
        found: order.map((o) => o),
        active: unlocked,
        compare: edges.filter(([from]) => from === id).map(([from, to]) => `${from}-${to}`),
      },
      explanation: `Schedule ${id} in slot #${order.length}, then erase its outgoing dependency edges. ${unlocked.length ? `${unlocked.join(', ')} now have zero unmet prerequisites and enter the queue.` : 'No new course became ready.'} Queue: [${queue.join(', ') || 'empty'}].`,
    };
  }

  if (order.length < NODES.length) {
    const stuck = NODES.filter((n) => !position.has(n.id)).map((n) => n.id);
    yield {
      state: snapshot(),
      highlight: { swap: stuck, compare: [`${CYCLE_EDGE[0]}-${CYCLE_EDGE[1]}`] },
      explanation: `Deadlock: the queue is empty but ${stuck.join(', ')} were never scheduled. That is a proof of a directed cycle: every remaining course is still waiting on another remaining course. Kahn's algorithm does not merely fail to find an order; it certifies that no topological order exists.`,
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { found: order.map((o) => o) },
    explanation: `Done: ${order.join(' -> ')}. Every dependency arrow points forward in this list. This is the same idea build systems, package managers, spreadsheets, compilers, and workflow engines use to decide what can run next.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'Why This Exists',
      paragraphs: [
        'Topological sort exists because many systems have work that is only partially ordered. Some tasks must happen before other tasks, but many tasks are independent. A build system must compile generated files before code that imports them. A package manager must install dependencies before dependents. A course planner must put prerequisites before advanced classes.',
        'The input is a directed graph. Each edge X -> Y means X must appear before Y. The output is a linear order that respects every edge. If no such order exists, the algorithm should not guess or hang. It should expose the cycle that makes the dependency plan impossible.',
        'This is why topological sort sits between graph theory and scheduling. It does not decide the best business priority. It decides what is legal. Once the legal ready set exists, a scheduler can choose by priority, worker capacity, deadline, or cost.',
      ],
    },
    {
      heading: 'The Baseline And The Wall',
      paragraphs: [
        'The baseline human method is repeated scanning. Look through the list, pick anything whose prerequisites are done, mark it done, and scan again. That works for a small checklist. It becomes wasteful and fragile when there are thousands of nodes and millions of edges.',
        'Sorting by name, priority, timestamp, or deadline is not enough. Those fields are tie-breakers among tasks that are already legal. They cannot override a hard dependency. If the graph says migration A must run before migration B, the final order must put A first even if B has a higher product priority.',
        'The wall is circular dependency. If A waits for B, B waits for C, and C waits for A, no linear order can satisfy the graph. A good algorithm should detect that condition and return evidence, not a misleading partial order.',
      ],
    },
    {
      heading: 'Core Insight And Invariant',
      paragraphs: [
        'The core insight is to count unmet prerequisites. The in-degree of a node is the number of incoming dependency edges that still block it. If a node has in-degree zero, nothing remaining must come before it, so it can be scheduled now.',
        'Kahn\'s algorithm keeps a ready queue of all zero-in-degree nodes. That queue is the live proof state. It contains exactly the tasks whose prerequisites have already been placed in the output. When a ready node is scheduled, its outgoing edges are removed from the remaining problem, lowering the in-degree of its dependents.',
        'The invariant is direct: every node in the output is legal, and every node in the ready queue has no unmet prerequisite. If the ready queue becomes empty while unscheduled nodes remain, those nodes are mutually blocked. That stuck remainder proves a directed cycle.',
      ],
    },
    {
      heading: 'Data Structures Used',
      paragraphs: [
        'The usual implementation uses four pieces. The adjacency list maps each node to its outgoing neighbors. The in-degree table stores how many prerequisites each node still has. The ready queue stores zero-in-degree nodes. The output list records the final order.',
        'The in-degree table is a compressed view of the remaining graph. Instead of asking "are all prerequisites done?" by scanning every incoming edge each time, the algorithm keeps a count and updates it exactly when a prerequisite is scheduled.',
        'The ready container can be FIFO, stack-like, or priority-based. That choice affects which valid order appears when multiple nodes are independent. It does not affect correctness. Correctness comes from only removing nodes whose in-degree is zero.',
      ],
    },
    {
      heading: 'Mechanism Step By Step',
      paragraphs: [
        'First, create an in-degree entry for every node and initialize it to zero. Scan every edge X -> Y and increment the count for Y. After this pass, the count for each node equals the number of prerequisites that must still appear before it.',
        'Second, enqueue every node whose count is zero. These are the tasks that can begin immediately. Third, repeatedly remove one node from the queue, append it to the output, and walk its outgoing edges. For each edge from the scheduled node to a neighbor, decrement the neighbor\'s count.',
        'When a neighbor\'s count reaches zero, enqueue it. The algorithm succeeds when the output contains every node. It fails with useful evidence when the queue is empty before that happens. The unscheduled nodes are exactly the part of the graph that never became ready.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'A zero-in-degree node has no unscheduled prerequisite. Placing it next cannot violate an incoming edge because no incoming edge remains in the unscheduled graph. That is the local reason each output step is safe.',
        'Decrementing neighbors is not a trick. It is the exact bookkeeping operation for "one of your prerequisites has now been completed." When the count reaches zero, all prerequisites for that neighbor have been completed, so the neighbor becomes legal.',
        'Cycle detection follows from a standard DAG fact: every finite directed acyclic graph has at least one node with in-degree zero. If the remaining graph has no zero-in-degree node, it cannot be acyclic. The empty ready queue is therefore a certificate, not just a symptom.',
      ],
    },
    {
      heading: 'Concrete Example',
      paragraphs: [
        'In the course graph, CS1 and M1 start with no prerequisites, so they enter the ready queue. Scheduling CS1 removes the edge from CS1 to DS. If that was DS\'s last unmet prerequisite, DS becomes ready. Scheduling M1 removes edges into AL and ML, but those courses may still wait for other prerequisites.',
        'A legal output might start CS1, M1, DS. Another legal output might start M1, CS1, DS. Both are valid if every edge points forward. Topological sort does not promise a unique order. It promises an order that respects the dependency relation.',
        'In the circular scenario, CAP points back to CS1. Now a later course is incorrectly required before the intro course. Eventually the ready queue empties while some nodes remain. The right answer is not to pick a stuck course anyway. The right answer is to report that the catalog contains a cycle.',
      ],
    },
    {
      heading: 'Costs And Tradeoffs',
      paragraphs: [
        'The runtime is O(V + E). The first pass scans all edges to compute in-degrees. The main loop schedules each node once and processes each outgoing edge once. That linear behavior is why topological sort works for build graphs and package graphs that would make permutation search impossible.',
        'The extra space is O(V) for in-degree counts, the ready queue, and the output, plus whatever storage the graph representation already uses. In practice, the adjacency list is usually the largest piece for sparse graphs.',
        'The main tradeoff is that topological sort is a legality engine, not an optimizer. It does not minimize total runtime, balance workers, find shortest paths, or choose the most valuable task. Those decisions can use the ready queue as input after dependency legality is satisfied.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'It wins anywhere work can start as soon as prerequisites are complete. Build systems use it to order compilation and packaging. Package managers use it to install dependencies. Spreadsheets use it to recompute cells. Workflow engines use it to launch DAG tasks. Migration runners use it to apply schema changes safely.',
        'It also wins for parallel execution. The ready queue can feed workers. When a worker finishes a node, the algorithm unlocks dependents. The dependency engine decides what may run; the scheduler decides which ready task gets a worker.',
        'It is useful in teaching because the state is visible. In-degree counts show why a task is blocked. The queue shows what can run now. The output shows the growing proof that every dependency has been respected.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails when the graph is not a directed prerequisite graph. Undirected connectivity, shortest routes, maximum flow, minimum spanning trees, and weighted optimization are different questions. Union-Find, BFS, Dijkstra\'s algorithm, and flow algorithms exist because those questions have different invariants.',
        'It also fails as a user-facing feature if it only says "cycle" without helping the user repair the graph. A build tool should report the stuck targets or reconstruct one representative cycle. A course planner should show the circular prerequisite chain. A workflow tool should explain why no task can launch.',
        'A subtler failure is treating the first valid order as the best order. In production schedulers, a valid order is only the start. After readiness is known, the system may still need priorities, resource limits, retry policy, cache locality, and fairness.',
      ],
    },
    {
      heading: 'How The Visual Model Teaches It',
      paragraphs: [
        'The valid-plan view uses each node note as the remaining in-degree. Nodes highlighted as ready have count zero. Nodes already placed in the order have position numbers. Edges highlighted during a step are the outgoing dependencies being removed because the source node has just been scheduled.',
        'The circular view teaches the negative result. The queue becomes empty, but unscheduled nodes still have positive counts. That means every remaining node is waiting on another remaining node. The visualization is not merely showing that the algorithm stopped; it is showing the proof that no legal order exists.',
        'The most important habit is to watch the counts, not the drawing layout. A node on the left side of the screen is not necessarily early. A node with zero unmet prerequisites is early enough to schedule. The counts carry the logic.',
      ],
    },
    {
      heading: 'Operational Guidance',
      paragraphs: [
        'Choose a deterministic tie-breaker if reproducibility matters. A FIFO queue may depend on input order. A priority queue can make builds, migrations, or generated files stable across machines. Determinism is not required for correctness, but it is often required for debugging.',
        'Store enough information to explain cycles. Kahn\'s algorithm identifies the stuck remainder, but users often need an actual cycle path. A second DFS over the stuck subgraph can reconstruct one. Production tools should make repair easy.',
        'For incremental systems, avoid recomputing the whole order when only one edge changes unless the graph is small. Build tools and spreadsheets often keep dependency indexes so they can update affected regions. The same invariant still applies: only zero-unmet-prerequisite nodes are ready.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Study Queue first, because the ready frontier is a queue of legal work. Study Graph BFS to compare frontier expansion in unweighted search. Study Recursion and DFS to see the depth-first topological-sort alternative. Study Union-Find to contrast directed prerequisites with undirected connectivity.',
        'Then study Dijkstra\'s Shortest Path for weighted route optimization and Narwhal Bullshark DAG Mempool Case Study for a distributed-systems use of topological ordering. The shift to notice is that topological sort answers "what can legally come next?" before any cost or priority policy runs.',
      ],
    },
  ],
};
