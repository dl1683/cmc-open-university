// Topological sort (Kahn's algorithm): turn a web of dependencies into a
// legal order — take what has no prerequisites, cross it off, repeat.
// And if the queue ever runs dry early, you've PROVEN a circular dependency.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'topological-sort',
  title: 'Topological Sort',
  category: 'Data Structures',
  summary: 'Order tasks so every prerequisite comes first — and detect circular dependencies for free.',
  controls: [
    { id: 'scenario', label: 'Prerequisites', type: 'select', options: ['valid plan', 'circular (deadlock!)'], defaultValue: 'valid plan' },
  ],
  run,
};

// A course catalog as a dependency graph: edge X → Y means "X before Y".
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
const CYCLE_EDGE = ['CAP', 'CS1']; // the capstone "required" before intro…

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
    explanation: `Seven courses, where an arrow X → Y means "take X before Y" — a dependency graph (a DAG, if it's honest). The question every build system, package manager, and degree planner must answer: in WHAT ORDER? Kahn's algorithm: count each node's incoming arrows ("needs N"), repeatedly take anything that needs 0, and cross it off.${circular ? ' (Someone also made the capstone a prerequisite for the intro course — watch what that does.)' : ''}`,
  };

  const queue = NODES.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id);
  yield {
    state: snapshot(),
    highlight: { active: queue.map((id) => id) },
    explanation: `Start: ${queue.length ? `${queue.join(' and ')} need${queue.length === 1 ? 's' : ''} nothing — into the Queue they go` : 'NOTHING has zero prerequisites'}. The queue holds exactly the courses you could start right now.`,
    invariant: 'The queue contains every node whose prerequisites are all already in the order.',
  };

  while (queue.length > 0) {
    const id = queue.shift();
    order.push(id);
    position.set(id, order.length);
    const unlocked = [];
    for (const [from, to] of edges) {
      if (from !== id) continue;
      inDegree.set(to, inDegree.get(to) - 1);
      if (inDegree.get(to) === 0) { unlocked.push(to); queue.push(to); }
    }
    yield {
      state: snapshot(),
      highlight: {
        found: order.map((o) => o),
        active: unlocked,
        compare: edges.filter(([from]) => from === id).map(([from, to]) => `${from}-${to}`),
      },
      explanation: `Take ${id} (slot #${order.length}) and erase its outgoing arrows — each target now needs one less. ${unlocked.length ? `That UNLOCKS ${unlocked.join(' and ')}: zero prerequisites remaining, into the queue.` : 'Nothing newly unlocked.'} Queue: [${queue.join(', ') || 'empty'}].`,
    };
  }

  if (order.length < NODES.length) {
    const stuck = NODES.filter((n) => !position.has(n.id)).map((n) => n.id);
    yield {
      state: snapshot(),
      highlight: { swap: stuck, compare: [`${CYCLE_EDGE[0]}-${CYCLE_EDGE[1]}`] },
      explanation: `DEADLOCK: the queue is empty but ${stuck.join(', ')} were never taken — every one of them still "needs" something. That is a PROOF of a circular dependency: ${stuck.length} courses each waiting on another in an endless loop (follow CAP → CS1 → DS → … around). Kahn's algorithm doesn't just sort — it certifies the graph is sortable. This exact check is why npm yells "circular dependency" and why spreadsheets flag "circular reference" instead of hanging forever.`,
    };
    return;
  }

  yield {
    state: snapshot(),
    highlight: { found: order.map((o) => o) },
    explanation: `Done: ${order.join(' → ')} — every arrow in the graph points forward in this list, guaranteed. This is how make, npm, and cargo order builds, how spreadsheets decide which cells to recompute first, how Airflow schedules data pipelines, and how compilers order declarations. Linear time: O(nodes + edges), one queue (see Queue and Graph BFS — same engine, different question).`,
  };
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A topological ordering lists the nodes of a directed acyclic graph so every prerequisite appears before the thing that depends on it. If edge A -> B means A must happen before B, then A must be earlier in the output. The graph must be a DAG: directed, because edges have prerequisite direction; acyclic, because a cycle would demand that something happen before itself.`,
        `Kahn's 1962 algorithm gives both an order and a certificate of failure. Count incoming edges for every node. Anything with zero incoming edges has no unmet prerequisites, so it can be scheduled now. Remove it, lower the counts of its outgoing neighbors, and repeat. If work remains but no zero-in-degree node exists, the remaining subgraph contains a cycle. The output is a legal schedule, not a ranking of importance.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `First compute in-degree for every node. Put all zero-in-degree nodes into a Queue. Then repeatedly dequeue one ready node, append it to the result, and conceptually delete its outgoing edges. Each deleted edge reduces a neighbor's in-degree by one. When a neighbor reaches zero, enqueue it because all of its prerequisites have now appeared in the result.`,
        `The invariant is practical: the queue contains exactly the tasks that can legally start now. Different queue orders can produce different valid results because independent tasks have no required relative order. A Stack or priority queue can be used instead if you want a different but still legal tie-breaker, such as lexicographic order.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Time is O(V + E): one pass to count incoming edges, and one pass over outgoing edges as nodes are removed. Space is O(V) for in-degree counts, the ready queue, and the output, plus the graph representation. This is dramatically better than testing all permutations; even 20 tasks have about 2.4 quintillion possible orders.`,
        `The algorithm does not find shortest paths or minimum costs. It only respects partial order constraints. Dijkstra's Shortest Path optimizes weighted routes; Graph BFS optimizes unweighted hop distance. Big-O Growth Rates helps explain why a linear dependency pass is the only acceptable answer for million-node build graphs.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Build systems such as make, Bazel, npm, Cargo, and Buck schedule compilation and packaging steps this way. Spreadsheets recompute cells after their dependencies. Airflow, Dagster, and other workflow engines schedule data pipelines over DAGs. Compilers order declarations and optimization passes. Course planners use it for prerequisites. Message Queues often carry the ready tasks after dependency analysis has decided what may run.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first mistake is expecting a unique answer. Many DAGs have many valid orders. The second is ignoring cycles until runtime. If the ready queue empties early, the remaining nodes are not merely delayed; they are mutually blocked. That is the same family of bug as a circular spreadsheet reference or a package cycle.`,
        `Another misconception is that undirected cycle detection is the same problem. Union-Find (Disjoint Sets) is excellent for connectivity and undirected-cycle questions, but directed dependency cycles require edge direction. Recursion can implement a depth-first topological ordering too, but Kahn's queue-based version exposes ready work naturally for schedulers.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Queue and Graph BFS for the frontier mechanics. Recursion shows the depth-first alternative. Union-Find (Disjoint Sets) contrasts directed dependency logic with undirected connectivity. Dijkstra's Shortest Path and Graph BFS explain what changes when the graph question is route cost or hop count instead of legal execution order.`,
      ],
    },
  ],
};
