// Depth-first search on a graph: commit to one path, backtrack when stuck.
// The stack (or recursion) remembers where to resume.

import { graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'graph-dfs',
  title: 'Graph DFS',
  category: 'Data Structures',
  summary: 'Explore a graph by diving deep before backtracking — the stack decides the path.',
  controls: [
    { id: 'target', label: 'Search for node', type: 'select', options: ['G', 'F', 'H'], defaultValue: 'G' },
  ],
  run,
};

// Same network as Graph BFS so students can compare traversal orders directly.
const NODES = [
  { id: 'A', label: 'A', x: 1.0, y: 5.0 }, { id: 'B', label: 'B', x: 3.2, y: 7.5 },
  { id: 'C', label: 'C', x: 3.2, y: 2.5 }, { id: 'D', label: 'D', x: 5.6, y: 8.4 },
  { id: 'E', label: 'E', x: 5.6, y: 5.0 }, { id: 'F', label: 'F', x: 5.6, y: 1.4 },
  { id: 'G', label: 'G', x: 8.2, y: 6.6 }, { id: 'H', label: 'H', x: 8.2, y: 2.8 },
];
const EDGES = [
  ['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E'], ['C', 'E'], ['C', 'F'],
  ['D', 'G'], ['E', 'G'], ['F', 'H'], ['G', 'H'],
].map(([from, to]) => ({ id: `${from}${to}`, from, to }));

const neighbors = (id) => EDGES
  .filter((e) => e.from === id || e.to === id)
  .map((e) => (e.from === id ? e.to : e.from));
const edgeBetween = (a, b) => EDGES.find((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));

export function* run(input) {
  const target = String(input.target);
  if (!NODES.some((n) => n.id === target)) throw new InputError('Pick a node from the list.');

  const discovered = new Map(); // node -> discovery time
  const finished = new Map();   // node -> finish time
  const parent = new Map();
  let time = 0;

  const snapshot = () => graphState({
    nodes: NODES.map((n) => ({
      ...n,
      note: discovered.has(n.id)
        ? (finished.has(n.id)
          ? `${discovered.get(n.id)}/${finished.get(n.id)}`
          : `${discovered.get(n.id)}/–`)
        : '',
    })),
    edges: EDGES,
  });

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `DFS explores a graph by committing to one path as deep as possible before backtracking. The engine is a STACK — explicit or via the call stack in recursion. Mission: find ${target} starting from A. Watch the discovery/finish timestamps: they reveal the structure of the search.`,
  };

  // Iterative DFS using an explicit stack.
  // We push {node, neighborIndex} frames to simulate the recursive call stack,
  // which lets us compute accurate discovery and finish times.
  const stack = [{ node: 'A', ni: 0 }];
  const visited = new Set(['A']);
  time++;
  discovered.set('A', time);
  const done = []; // fully finished nodes

  yield {
    state: snapshot(),
    highlight: { active: ['A'] },
    explanation: `Push A onto the stack and mark it discovered (time ${time}). The stack is the memory of where to backtrack. Unlike BFS's queue, LIFO order means we always continue the deepest unfinished path.`,
    invariant: 'Every node on the stack is on the current exploration path from the source.',
  };

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const current = frame.node;
    const nbrs = neighbors(current);

    // Find next unvisited neighbor
    let pushed = false;
    while (frame.ni < nbrs.length) {
      const next = nbrs[frame.ni];
      frame.ni++;
      if (!visited.has(next)) {
        visited.add(next);
        parent.set(next, current);
        time++;
        discovered.set(next, time);
        stack.push({ node: next, ni: 0 });

        if (next === target) {
          // Found the target — reconstruct path
          const pathNodes = [];
          let walk = target;
          while (walk !== undefined) { pathNodes.unshift(walk); walk = parent.get(walk); }
          const pathEdges = pathNodes.slice(1).map((n, i) => edgeBetween(pathNodes[i], n).id);

          yield {
            state: snapshot(),
            highlight: { found: [target], active: [current], visited: done },
            explanation: `Discovered ${target} (time ${discovered.get(target)}) — found it via the path ${pathNodes.join(' → ')}.`,
          };
          yield {
            state: snapshot(),
            highlight: { found: [...pathNodes, ...pathEdges], visited: done },
            explanation: `DFS found a path, but unlike BFS, this path is NOT guaranteed to be the shortest by hop count. DFS commits to depth, so it may find a longer route than necessary. The path ${pathNodes.join(' → ')} has ${pathNodes.length - 1} edge${pathNodes.length - 1 === 1 ? '' : 's'}. For shortest paths in unweighted graphs, use BFS. DFS shines for cycle detection, topological sorting, and problems where you need to explore all reachable nodes with minimal memory.`,
            invariant: 'DFS visits every reachable node exactly once. The stack height never exceeds V.',
          };
          return;
        }

        const edge = edgeBetween(current, next);
        yield {
          state: snapshot(),
          highlight: {
            active: [next],
            compare: [edge.id],
            visited: done,
          },
          explanation: `From ${current}, dive deeper to ${next} (discovery time ${discovered.get(next)}). Push ${next} onto the stack. DFS always picks the deepest unexplored frontier — the stack enforces this by making the most recent push the next to process. Stack: [${stack.map((f) => f.node).join(', ')}].`,
          invariant: 'The stack represents the current path from A to the active node.',
        };
        pushed = true;
        break;
      }
    }

    if (!pushed) {
      // All neighbors visited — backtrack
      stack.pop();
      time++;
      finished.set(current, time);
      done.push(current);
      yield {
        state: snapshot(),
        highlight: {
          active: stack.length > 0 ? [stack[stack.length - 1].node] : [],
          visited: done,
        },
        explanation: `All of ${current}'s neighbors are visited. Finish ${current} (time ${finished.get(current)}) and pop it off the stack — backtrack${stack.length > 0 ? ` to ${stack[stack.length - 1].node}` : ''}. The discovery/finish interval [${discovered.get(current)}, ${finished.get(current)}] captures everything reachable from ${current}. ${stack.length > 0 ? `Stack: [${stack.map((f) => f.node).join(', ')}].` : 'Stack is empty — search is complete.'}`,
        invariant: 'A node is finished only when all its descendants are finished first (parenthesis property).',
      };
    }
  }

  yield {
    state: snapshot(),
    highlight: { visited: done },
    explanation: `DFS explored all reachable nodes without finding ${target}. Every node has a discovery/finish timestamp pair. These timestamps encode the entire DFS tree structure: if [d_u, f_u] contains [d_v, f_v], then v is a descendant of u in the DFS tree.`,
  };
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the graph as vertices connected by directed edges. Discovery time is when depth-first search first reaches a node; finish time is when every outgoing edge from that node has been handled. A discovered node without a finish time is active on the stack.',
        {type: 'callout', text: 'DFS is a stack invariant: every active node is on the current path, and finishing a node proves its whole unexplored subtree is exhausted.'},
        'The safe inference is about ancestors. An edge to an active node points back to an ancestor and proves a cycle. An edge to a finished node points into work already closed.',
        {type: 'image', src: './assets/gifs/graph-dfs.gif', alt: 'Animated walkthrough of the graph dfs visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Many graph problems are about structure, not distance. A package manager needs to detect circular dependencies, and a compiler needs to know which blocks are reachable. DFS exists because the current path and finish order expose that structure.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Depth-First-Search.gif', alt: 'Animated depth-first search trace through a small graph', caption: 'The animation shows DFS committing to one branch before backtracking, the same behavior the topic trace exposes with timestamps. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Depth-First-Search.gif.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious traversal is breadth-first search. It uses a queue, visits all nodes one edge away, then all nodes two edges away, and finds shortest unweighted paths. It is the right tool when distance is the question.',
        'A simpler visited-set walk also feels enough at first. It prevents infinite loops, but it loses whether a seen node is still active or already finished. DFS keeps that distinction.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A queue gives levels, not ancestry. When BFS sees an already visited node, it does not know whether the node is on the current path. Cycle detection and topological sorting need that fact.',
        'A plain visited set cannot explain finish order. Topological order needs a node to finish only after all reachable descendants below it have finished. That is a stack property.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'DFS keeps one unfinished path alive. The stack bottom is the start, the stack top is the frontier, and every active node is an ancestor of the frontier. Backtracking happens only when the frontier has no unvisited neighbor.',
        'The invariant is that a node finishes after all work below it finishes. That makes reverse finish order useful for dependency scheduling and makes active-back-edge detection a cycle proof.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Push a source node and mark its discovery time. If the top node has an unvisited neighbor, push that neighbor and mark it discovered. If it has none, pop it and assign its finish time.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Depth-first-tree.svg', alt: 'Tree labeled by the order in which depth-first search expands nodes', caption: 'The numbered tree makes preorder visible: DFS follows a path until it cannot continue, then returns to the latest unfinished fork. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Depth-first-tree.svg.'},
        'Recursive DFS uses the language call stack for the same behavior. An explicit stack is safer for very deep graphs because the heap can hold more frames than the call stack.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every vertex is discovered once because DFS marks it before expanding it. Every edge is examined from its source adjacency list. Therefore no reachable edge or vertex is silently skipped.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/5/57/Tree_edges.svg', alt: 'DFS tree showing tree, back, forward, and cross edges', caption: 'Edge classes are a timestamp consequence, not an extra data structure. Back edges point to an active ancestor and prove a cycle. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Tree_edges.svg.'},
        'The timestamp proof is the parenthesis property. For two nodes, discovery-finish intervals either nest or do not overlap. Partial overlap cannot occur because DFS will not finish an ancestor while a descendant is active.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With adjacency lists, DFS costs O(V + E), where V is vertices and E is edges. Each vertex is pushed and popped once, and each directed edge is inspected once. In an undirected graph, each edge appears twice but the bound stays O(V + E).',
        'Space is O(V) for visited state and O(V) worst-case stack depth. A chain of 1,000,000 nodes can require 1,000,000 stack entries. A balanced binary tree with about 1,000,000 nodes has path depth about 20, while BFS may hold hundreds of thousands of frontier nodes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Build systems and package managers use DFS to find dependency cycles before work starts. Reverse finish order gives a valid build order when no cycle exists. Compilers use DFS over control-flow graphs for reachability and loop-related structure.',
        'DFS is also the base pass for strongly connected components, bridges, articulation points, and many backtracking searches. In each case, the useful state is the current path plus what has already finished.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DFS does not find shortest paths. It can reach a target through a long detour even when a two-edge path exists. Use BFS for shortest unweighted paths and Dijkstra for nonnegative weighted paths.',
        'Recursive DFS can overflow on deep graphs, and DFS is not naturally parallel because the stack chooses one path at a time. Explicit stacks and iterative deepening address some failures but add implementation detail.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use edges A -> B, A -> D, B -> C, C -> A, C -> D, D -> E, E -> F, and F -> D. Visit neighbors alphabetically. Start at A with d(A)=1, then B with d(B)=2, then C with d(C)=3.',
        'From C, edge C -> A points to active ancestor A, so A -> B -> C -> A is a cycle. Then C discovers D at 4, E at 5, and F at 6. From F, edge F -> D points to active ancestor D, so D -> E -> F -> D is another cycle.',
        'Finishing unwinds as F=7, E=8, D=9, C=10, B=11, A=12. The intervals A[1,12], B[2,11], C[3,10], D[4,9], E[5,8], F[6,7] nest perfectly. That nesting is the proof that DFS kept one active path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Tarjan, Depth-First Search and Linear Graph Algorithms, for linear-time graph applications. CLRS covers DFS timestamps, edge classes, topological sort, and strongly connected components. Tremaux maze search is the older maze-walking form of the idea.',
        'Study BFS next to contrast queue order with stack order. Then study topological sort, Tarjan strongly connected components, articulation points, bridges, stacks, and recursion.',
      ],
    },
  ],
};
