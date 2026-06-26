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
        'Each node is a task in a directed dependency graph. Directed means an edge has an arrow, and the arrow X -> Y means X must happen before Y. The node label shows remaining in-degree, which is the number of prerequisite arrows still pointing into that node.',
        'Highlighted nodes are ready: their in-degree is zero, so no unscheduled prerequisite remains. Green nodes are already in the output order, and highlighted edges are being removed because their source task has just been scheduled.',
        'The safe inference is local but strong: a zero-in-degree node can be emitted next without breaking any dependency edge. In the circular view, the queue becomes empty while nodes still show positive in-degree, which proves a cycle rather than just a failed search.',
        {
          type: 'callout',
          text: 'Topological sort is scheduling by proof: a zero in-degree node has no unmet prerequisite left.',
        },
        {type: 'image', src: './assets/gifs/topological-sort.gif', alt: 'Animated walkthrough of the topological sort visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Topological sort turns a dependency graph into a legal linear order. Legal means every arrow points forward in the final list, so every prerequisite appears before the work that needs it.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Directed_acyclic_graph_2.svg/500px-Directed_acyclic_graph_2.svg.png', alt: 'Directed acyclic graph used to illustrate topological ordering', caption: 'A DAG can admit many valid topological orders; the algorithm only needs one order that points every edge forward. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_acyclic_graph_2.svg.' },
        'Build systems, package managers, spreadsheets, course planners, and workflow engines all face this problem. They do not merely need to visit tasks; they need to know which tasks are allowed to run now and whether the dependency set is impossible.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The brute-force approach is to try every possible order and reject any order with a backward edge. With 20 tasks there are about 2.4e18 permutations, so even checking a billion orders per second would take decades.',
        'A more reasonable approach repeatedly scans all unscheduled tasks and picks one whose prerequisites are already done. This is correct on small inputs, and it is easy to write, but it keeps rediscovering the same blocked tasks.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Repeated scanning pays for the whole graph again after each scheduled node. With V vertices and E edges, that can become O(V * E), which is painful for a build graph with 100,000 files and 500,000 dependency edges.',
        'The larger wall is cycle detection. If A waits on B, B waits on C, and C waits on A, there is no legal order, so an algorithm must return evidence of impossibility rather than a partial schedule that looks useful.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Track the number of unmet prerequisites for each node. When that count reaches zero, the node is ready forever because scheduling other nodes can only remove incoming edges, not create new unmet prerequisites.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Simple directed graph with arrows between nodes', caption: 'Direction is the contract: topological sort is only meaningful because every edge has a before-after interpretation. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.' },
        'Kahn\'s algorithm makes this insight concrete with a ready queue. The queue is not a guess about priority; it is the set of nodes whose prerequisites have already been proven satisfied.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'First compute in-degree for every vertex by scanning all edges once. Put every zero-in-degree vertex into a queue, remove one ready vertex at a time, append it to the output, and decrement the in-degree of each neighbor reached by an outgoing edge.',
        'When a neighbor\'s count drops to zero, enqueue it. If the output contains all vertices, the output is a topological order. If the queue empties early, every remaining vertex is still waiting on another remaining vertex, so the remaining subgraph contains a directed cycle.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the queue contains exactly the unscheduled nodes with no unmet prerequisites. Scheduling one of them cannot violate an edge because no incoming edge from an unscheduled node exists.',
        'A directed acyclic graph always has at least one zero-in-degree node. If every node had a positive in-degree, following incoming edges backward in a finite graph would eventually revisit a node, which is a cycle. Removing a zero-in-degree node leaves a smaller directed acyclic graph, so induction gives a complete legal order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Kahn\'s algorithm runs in O(V + E) time because it counts each edge once and later removes each edge once. It stores O(V) extra state for in-degree counts, the queue, and the output order.',
        'When the number of tasks doubles and the average number of dependencies stays the same, the running time roughly doubles. When each task depends on many other tasks, edge count dominates, so the cost follows dependency density rather than the label names on the nodes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Build tools use topological ordering to compile generated files before files that import them. Package managers use it to install dependencies before dependents and to report cycles as configuration errors.',
        'Spreadsheets use the same idea when a changed cell forces formulas to recalculate in dependency order. Workflow engines and CI pipelines use a ready set so independent jobs can run in parallel while dependency edges still enforce legality.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Topological sort only applies to directed acyclic graphs. If the graph has cycles, it can identify a stuck remainder, but a production tool usually needs an extra DFS pass to print a readable cycle such as A -> B -> C -> A.',
        'It also does not optimize duration, priority, machine placement, or cost. Once the ready set exists, a scheduler still needs a policy for deadlines, resources, fairness, and cache locality.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use courses CS1, M1, DS, AL, DB, ML, and CAP. The edges are CS1 -> DS, M1 -> AL, M1 -> ML, DS -> AL, DS -> DB, AL -> ML, DB -> CAP, and ML -> CAP.',
        'Initial in-degrees are CS1:0, M1:0, DS:1, AL:2, DB:1, ML:2, CAP:2. The queue starts as [CS1, M1]. Remove CS1, append it, and DS drops to zero, so the queue becomes [M1, DS].',
        'Remove M1, then DS. AL drops from 2 to 0 and DB drops from 1 to 0, so both become ready. One valid final order is CS1, M1, DS, AL, DB, ML, CAP, and every listed edge points forward.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: A. B. Kahn, Topological Sorting of Large Networks, Communications of the ACM, 1962. Standard references include Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, and Knuth, The Art of Computer Programming.',
        'Study graph DFS for the reverse-postorder version, graph BFS for queue discipline, strongly connected components for cycle condensation, and critical path analysis when tasks have durations.',
      ],
    },
  ],
};
