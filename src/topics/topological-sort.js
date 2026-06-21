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
      heading: 'How to read the animation',
      paragraphs: [
        'Each node is a course in a prerequisite graph. An arrow from X to Y means "take X before Y." The label on each node shows either its remaining in-degree ("needs 2" means two prerequisites are still unscheduled) or its position in the final output ("#3" means it was the third course scheduled).',
        'Highlighted nodes are the ready queue: courses whose in-degree just hit zero. Green nodes are already placed in the output. Highlighted edges are outgoing dependencies being erased because their source was just scheduled.',
        'The inference rule to watch: when a node shows "needs 0," every prerequisite is already in the output, so scheduling it next is safe. Watch the counts drop each time a predecessor is scheduled. In the circular scenario, an extra edge from CAP back to CS1 creates a cycle. The ready queue empties while nodes remain unscheduled, and their positive in-degrees prove the cycle.',
        {
          type: 'callout',
          text: 'Topological sort is scheduling by proof: a zero in-degree node has no unmet prerequisite left.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Topological sort produces a linear ordering of vertices in a directed acyclic graph (DAG) such that for every edge u -> v, u appears before v. Kahn introduced the idea in 1962 as "topological sorting of large networks."',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Directed_acyclic_graph_2.svg/500px-Directed_acyclic_graph_2.svg.png', alt: 'Directed acyclic graph used to illustrate topological ordering', caption: 'A DAG can admit many valid topological orders; the algorithm only needs one order that points every edge forward. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph_2.svg.' },
        'The problem appears whenever work has prerequisites. A build system must compile generated files before code that imports them. A package manager must install dependencies before dependents. A spreadsheet must recalculate cells that feed formulas before recalculating the formulas. A course planner must place prerequisites before advanced classes.',
        'The algorithm answers one question: what is a legal execution order? It does not pick the best order by priority or cost. It separates legality from optimization. Once the legal ready set exists, a scheduler can rank by priority, deadline, or resource capacity.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Try all n! permutations and check each against every edge. For 20 tasks, 20! is roughly 2.4 * 10^18 permutations. At one check per nanosecond, that takes 76 years. The approach is correct but absurd.',
        'A more natural instinct is repeated scanning: walk the task list, pick any task whose prerequisites are done, mark it done, scan again. For a dozen items this works. It respects dependencies and always finds a valid order when one exists.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Repeated scanning rescans the entire list after every selection. With V nodes and E edges, each scan walks all edges to check prerequisites across V rounds. That is O(V * E). For a class schedule, tolerable. For a build graph with millions of files, wasteful.',
        'The deeper wall is correctness. If A waits for B, B waits for C, and C waits for A, no linear order exists. A naive scanner hangs or silently outputs a partial list. A correct algorithm must detect the cycle and return evidence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Two algorithms solve topological sort in O(V + E). Both exploit the DAG structure directly instead of brute-forcing permutations.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Simple directed graph with arrows between nodes', caption: 'Direction is the contract: topological sort is only meaningful because every edge has a before-after interpretation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.' },
        'Kahn\'s algorithm (BFS-based). Count the in-degree of every node by scanning all edges. Enqueue every node with in-degree zero. Main loop: dequeue a node, append it to the output, and walk its outgoing edges. For each neighbor, decrement the neighbor\'s in-degree. When a count hits zero, enqueue that neighbor. Repeat until the queue is empty. If the output contains all V nodes, it is a valid topological order. If fewer than V nodes were processed, the remaining nodes form a cycle.',
        'DFS-based alternative (reverse postorder). Run a depth-first search from every unvisited node. When a node finishes -- all its descendants are fully explored -- push it onto a stack. Pop the stack to get a topological order. Cycle detection uses edge coloring: if DFS reaches a node currently on the call stack (a "gray" node), that back edge proves a cycle.',
        'Kahn\'s algorithm is naturally BFS-flavored and produces nodes in level order of the dependency DAG. The DFS approach produces a different valid ordering and integrates naturally with other DFS-based algorithms like strongly connected components. The ready container in Kahn\'s can be a FIFO queue, a stack, or a priority queue. The choice affects which valid order appears but not correctness.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Kahn\'s correctness rests on induction. A DAG always has at least one node with in-degree zero. Proof: if every node had a positive in-degree, follow incoming edges backward through the finite graph. The walk must revisit a node, forming a cycle, contradicting the DAG assumption. So at least one zero-in-degree node exists.',
        'A zero-in-degree node has no unscheduled prerequisite. Placing it next cannot violate any edge. Removing it and its outgoing edges yields a smaller DAG, which again must have a zero-in-degree node. By induction, the process produces a complete ordering that respects every edge.',
        'Cycle detection is the contrapositive. If the ready queue empties while unscheduled nodes remain, every remaining node has a positive in-degree. Each is waiting on another remaining node. That mutual waiting is a certificate of a directed cycle.',
        'For the DFS variant: in a DAG, no back edges exist. Without back edges, the reverse of the DFS finish order respects every edge. A back edge -- one that points from a descendant to an ancestor on the current DFS path -- is the exact signature of a cycle.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Both algorithms run in O(V + E) time. Kahn\'s initialization scans all edges once to build in-degree counts. The main loop processes each node once and traverses each outgoing edge once. No work is repeated.',
        'Space is O(V) beyond the graph: in-degree counters, the ready queue, and the output list. The DFS variant uses O(V) for the recursion stack in the worst case (a single chain).',
        'Doubling V doubles initialization work. Doubling E doubles edge processing. For sparse graphs where E is near V (common in build and package graphs), total work scales linearly with nodes. For dense graphs where E approaches V^2, edge processing dominates. Either way, each node and each edge is touched exactly once.',
        'Compare to brute force: a build graph with 100,000 files and 500,000 edges finishes in one pass. The repeated-scan approach would take 10^10 operations. The permutation approach would not finish before the heat death of the universe.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Build systems. Make (1976) topologically sorts source files, object files, and targets to decide compilation order. Bazel, Gradle, and Ninja do the same at larger scale, feeding the ready queue to parallel workers. The build is a live Kahn\'s algorithm with worker threads consuming ready tasks.',
        'Package managers. npm, pip, and apt resolve installation order by topologically sorting the dependency DAG. A cyclic dependency is a hard error -- the manager refuses because no valid installation order exists.',
        'Spreadsheet recalculation. When a user edits cell B2, the spreadsheet recomputes every cell that depends on B2, in an order where each formula sees updated inputs. Excel, Google Sheets, and LibreOffice maintain a dependency DAG internally for this.',
        'Compiler instruction scheduling. Data dependencies between machine instructions form a DAG. The scheduler picks among ready instructions to minimize pipeline stalls, but dependency order constrains legality. Legality first, optimization second.',
        'Workflow engines (Airflow, dbt), migration runners, CI/CD pipelines, and course prerequisite planners all solve the same problem: given a DAG of tasks with precedence constraints, find a linear order that respects every constraint.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Topological sort only works on DAGs. Cyclic dependencies require SCC-based analysis (Tarjan\'s algorithm) to decompose the graph into strongly connected components, condense them into a DAG, and then topologically sort the condensation.',
        'It does not handle weighted constraints. If tasks have durations and you need the earliest possible completion time, you need critical path analysis, which runs topological sort first and then relaxes edges in that order.',
        'Multiple valid orderings can mislead. Topological sort produces one legal ordering of potentially many. A production scheduler still needs to optimize for priorities, resource limits, cache locality, and fairness among teams.',
        'Kahn\'s algorithm identifies the stuck remainder when a cycle exists, but does not reconstruct the actual cycle path. A production build tool should run a second DFS over the stuck subgraph to extract a representative cycle. Users need "A -> B -> C -> A" not "3 tasks could not be scheduled."',
        'It assumes the dependency graph is known, complete, and static. In dynamic systems where tasks discover new dependencies at runtime, incremental topological sort algorithms exist but add complexity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Seven courses: CS1 (Intro CS), M1 (Intro Math), DS (Data Structures), AL (Algorithms), DB (Databases), ML (Machine Learning), CAP (Capstone). Prerequisites: CS1 -> DS, M1 -> AL, M1 -> ML, DS -> AL, DS -> DB, AL -> ML, DB -> CAP, ML -> CAP.',
        'Compute in-degrees. CS1: 0, M1: 0, DS: 1 (from CS1), AL: 2 (from M1 and DS), DB: 1 (from DS), ML: 2 (from M1 and AL), CAP: 2 (from DB and ML). Ready queue: [CS1, M1].',
        'Dequeue CS1, output [CS1]. Remove CS1 -> DS. DS drops from 1 to 0, enters queue. Queue: [M1, DS].',
        'Dequeue M1, output [CS1, M1]. Remove M1 -> AL, M1 -> ML. AL: 2 -> 1. ML: 2 -> 1. Queue: [DS].',
        'Dequeue DS, output [CS1, M1, DS]. Remove DS -> AL, DS -> DB. AL: 1 -> 0, enters queue. DB: 1 -> 0, enters queue. Queue: [AL, DB].',
        'Dequeue AL, output [CS1, M1, DS, AL]. Remove AL -> ML. ML: 1 -> 0, enters queue. Queue: [DB, ML]. Dequeue DB, output [..., DB]. Remove DB -> CAP. CAP: 2 -> 1. Queue: [ML]. Dequeue ML, output [..., ML]. Remove ML -> CAP. CAP: 1 -> 0, enters queue. Dequeue CAP. Final order: CS1, M1, DS, AL, DB, ML, CAP.',
        'Every prerequisite edge points forward in this list. Another valid order is M1, CS1, DS, DB, AL, ML, CAP -- swapping independent courses. Topological sort guarantees a valid order, not a unique one.',
        'Now add the cycle edge CAP -> CS1. CS1\'s in-degree becomes 1. No node starts at zero. The queue is immediately empty, zero nodes are output, and the algorithm reports all 7 courses as mutually stuck. The cycle CS1 -> DS -> DB -> CAP -> CS1 makes the catalog impossible.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Kahn, A.B. (1962), "Topological Sorting of Large Networks," Communications of the ACM. Tarjan, R.E. (1976), "Edge-disjoint spanning trees and depth-first search." Knuth, D.E. (1997), The Art of Computer Programming, Volume 1, Section 2.2.3. Cormen et al. (2009), Introduction to Algorithms, Chapter 22.',
        'Prerequisites: DFS (powers the DFS-based topological sort and back-edge cycle detection), BFS (Kahn\'s algorithm is BFS mechanics applied to the in-degree graph).',
        'Extensions: DAG shortest path (topological sort enables O(V + E) single-source shortest paths on DAGs by relaxing edges in topological order), strongly connected components (Tarjan\'s SCC algorithm decomposes a directed graph into maximal SCCs whose condensation is a DAG that can then be topologically sorted), critical path analysis (longest path in a DAG, found by negating edge weights and running DAG shortest path in topological order).',
        'Contrasting alternatives: for weighted shortest paths in general graphs, use Dijkstra or Bellman-Ford. For undirected components, use Union-Find or BFS/DFS connected components. Topological sort applies only to directed acyclic graphs.',
      ],
    },
  ],
};
