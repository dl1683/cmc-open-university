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
      heading: 'What it is',
      paragraphs: [
        `Topological sort is a linear ordering of nodes in a directed graph where every edge from A to B places A before B. It answers: in what legal order can I execute tasks given some depend on others? Kahn's algorithm: identify zero-in-degree nodes (no prerequisites), queue them, then repeatedly dequeue a node, reduce in-degree of its neighbors, and enqueue newly-freed neighbors. If the queue empties before all nodes process, you have proven a circular dependency — the remaining nodes are stuck in a cycle.`,
        `Why this works: at each step you process a node whose dependencies are satisfied, so downstream tasks are ready. A node trapped at non-zero in-degree must be part of a cycle that feeds back to itself.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `Three phases. First, initialize: compute each node's in-degree (count incoming edges) and queue all zeros. Second, process: dequeue a node, add it to the result, decrement in-degree of all outgoing targets, and re-queue any that hit zero. Third, check: if result has all nodes, you have a valid topological order; if not, the stuck nodes are caught in a cycle. The queue naturally enforces the partial order because you only process nodes whose dependencies are already in the result.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `O(V + E) time: one pass for in-degrees, one for queuing, one edge traversal per node. O(V) space for queue and map. This linear cost scales to millions of tasks and edges — exponentially cheaper than permutations.`,
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        `Build systems (make, npm, cargo) order compilation steps. Spreadsheets use it to recompute cells in dependency order. Data pipelines (Airflow) schedule tasks so outputs reach consumers in time. Compilers order declarations. Course planners respect prerequisites. In each case, circular dependencies cause an immediate deadlock — and Kahn's algorithm detects it automatically.`,
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        `Mistake one: a DAG may have many valid topological orders, not just one. Nodes with no dependency relationship can appear in any relative order. Mistake two: topological sort is simple, not complex — it is just Queue-based traversal where in-degree (not value) decides processing priority. Mistake three: many miss the free deadlock-detection property built into Kahn's algorithm. If the queue empties before all nodes are processed, you have mathematically proven a circular dependency exists — no separate cycle detector needed.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Learn Queue and Graph BFS to understand the traversal engine. Union-Find (Disjoint Sets) detects cycles in undirected graphs. Dijkstra's Shortest Path handles weighted dependencies. Recursion shows top-down dependency resolution (depth-first) versus Kahn's bottom-up approach — both answer the same question from different directions.`,
      ],
    },
  ],
};

