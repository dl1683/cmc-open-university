// RRT*: incrementally sample states, connect collision-free edges, rewire nearby
// nodes, and improve a path through continuous configuration space.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rrt-star-motion-planning-tree-case-study',
  title: 'RRT* Motion Planning Tree Case Study',
  category: 'Systems',
  summary: 'A motion-planning case study: random state sampling, nearest-neighbor search, steering, collision checks, parent pointers, rewiring, cost-to-come, and anytime path improvement.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['tree growth', 'rewire optimize'], defaultValue: 'tree growth' },
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

function rrtGraph(title) {
  return graphState({
    nodes: [
      { id: 'start', label: 'S', x: 1.0, y: 5.2, note: 'start' },
      { id: 'n1', label: 'n1', x: 2.5, y: 4.0, note: 'cost 2' },
      { id: 'n2', label: 'n2', x: 4.0, y: 5.3, note: 'cost 4' },
      { id: 'n3', label: 'n3', x: 5.3, y: 3.3, note: 'cost 5' },
      { id: 'sample', label: 'q', x: 6.8, y: 2.0, note: 'sample' },
      { id: 'goal', label: 'G', x: 8.5, y: 2.8, note: 'goal' },
      { id: 'obs', label: 'obs', x: 4.7, y: 1.6, note: 'blocked' },
    ],
    edges: [
      { id: 'e-start-n1', from: 'start', to: 'n1', weight: 'parent' },
      { id: 'e-n1-n2', from: 'n1', to: 'n2', weight: 'parent' },
      { id: 'e-n2-n3', from: 'n2', to: 'n3', weight: 'parent' },
      { id: 'e-n3-sample', from: 'n3', to: 'sample', weight: 'steer' },
      { id: 'e-sample-goal', from: 'sample', to: 'goal', weight: 'near' },
      { id: 'e-obs-sample', from: 'obs', to: 'sample', weight: 'collision?' },
    ],
  }, { title });
}

function* treeGrowth() {
  yield {
    state: rrtGraph('RRT grows a tree through free space'),
    highlight: { active: ['start', 'n1', 'n2', 'n3', 'e-start-n1', 'e-n1-n2', 'e-n2-n3'], compare: ['sample', 'goal'] },
    explanation: 'RRT samples random states, finds the nearest existing node, steers toward the sample, collision-checks the edge, and inserts a new node if valid.',
  };
  yield {
    state: labelMatrix(
      'Insert step',
      [
        { id: 'sample', label: 'sample' },
        { id: 'nearest', label: 'nearest' },
        { id: 'steer', label: 'steer' },
        { id: 'check', label: 'check' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'result', label: 'result' },
      ],
      [
        ['q_rand', 'target'],
        ['n3', 'parent?'],
        ['q_new', 'edge'],
        ['free', 'insert'],
      ],
    ),
    highlight: { found: ['nearest:result', 'steer:result', 'check:result'] },
    explanation: 'The key data structures are nearest-neighbor index, parent pointers, costs-to-come, and a collision checker over the robot footprint.',
    invariant: 'Every tree edge must be collision-free under the current map.',
  };
  yield {
    state: rrtGraph('Samples near obstacles are rejected or clipped'),
    highlight: { active: ['sample', 'obs', 'e-obs-sample'], removed: ['e-n3-sample'], compare: ['goal'] },
    explanation: 'The planner does not just connect points. It checks the continuous path segment against occupancy or costmap geometry.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'samples', min: 0, max: 1000 }, y: { label: 'path cost', min: 0, max: 100 } },
      series: [
        { id: 'rrt', label: 'RRT', points: [{ x: 50, y: 90 }, { x: 200, y: 80 }, { x: 500, y: 78 }, { x: 900, y: 77 }] },
        { id: 'rrts', label: 'RRT*', points: [{ x: 50, y: 90 }, { x: 200, y: 72 }, { x: 500, y: 58 }, { x: 900, y: 49 }] },
      ],
      markers: [
        { id: 'better', x: 900, y: 49, label: 'improves' },
      ],
    }),
    highlight: { active: ['rrts', 'better'], compare: ['rrt'] },
    explanation: 'RRT often finds a path quickly. RRT* keeps improving toward lower-cost paths by rewiring the tree as more samples arrive.',
  };
}

function* rewireOptimize() {
  yield {
    state: labelMatrix(
      'Rewire step',
      [
        { id: 'near', label: 'near set' },
        { id: 'cost', label: 'cost' },
        { id: 'parent', label: 'parent' },
        { id: 'children', label: 'children' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['n1,n2,n3', 'check'],
        ['12.4', '9.1'],
        ['n2', 'n1'],
        ['unchanged', 'propagate'],
      ],
    ),
    highlight: { active: ['cost:after', 'parent:after'], compare: ['cost:before'] },
    explanation: 'RRT* evaluates nearby nodes and may choose a cheaper parent for the new node. It can also rewire existing neighbors through the new node.',
  };
  yield {
    state: rrtGraph('Rewiring changes parent pointers, not samples'),
    highlight: { active: ['n1', 'n3', 'sample', 'e-n3-sample'], compare: ['n2'] },
    explanation: 'The tree topology changes while the sampled states remain the same. Cost-to-come values must be updated through affected descendants.',
  };
  yield {
    state: labelMatrix(
      'Planning constraints',
      [
        { id: 'nn', label: 'NN idx' },
        { id: 'coll', label: 'collision' },
        { id: 'dyn', label: 'dynamics' },
        { id: 'time', label: 'time cap' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['log n?', 'metric'],
        ['expensive', 'map stale'],
        ['hard', 'invalid path'],
        ['anytime', 'subopt'],
      ],
    ),
    highlight: { found: ['nn:cost', 'coll:cost', 'time:cost'], compare: ['dyn:risk'] },
    explanation: 'Sampling-based planning performance is shaped by nearest-neighbor search, collision-check cost, dynamics constraints, and time budget.',
  };
  yield {
    state: labelMatrix(
      'Plan artifact',
      [
        { id: 'path', label: 'path' },
        { id: 'cost', label: 'cost' },
        { id: 'map', label: 'map' },
        { id: 'seed', label: 'seed' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'why', label: 'why' },
      ],
      [
        ['states', 'execute'],
        ['length', 'rank'],
        ['version', 'valid'],
        ['rng', 'replay'],
      ],
    ),
    highlight: { found: ['path:why', 'map:why', 'seed:why'] },
    explanation: 'A real planner output should include path, cost, map version, robot model, planner parameters, random seed, and validity timestamp.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'tree growth') yield* treeGrowth();
  else if (view === 'rewire optimize') yield* rewireOptimize();
  else throw new InputError('Pick an RRT* view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the tree as a record of legal local motions, not as decorative lines. A node is a robot state, an edge is a collision-checked move between two states, and the active node is the state being tested against nearby parents.',
        'The important visual event is rewiring. When a new state gives an old neighbor a cheaper path from the start, the parent pointer changes and the cost stored at that neighbor drops without invalidating any checked edge.',
        {type:'callout', text:'RRT* converts random exploration into improving motion plans by rewiring the tree whenever a cheaper local connection becomes available.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/62/Rapidly-exploring_Random_Tree_%28RRT%29_500x373.gif', alt:'Animated rapidly exploring random tree growing through a two-dimensional space.', caption:'Animated RRT growth by Javed Hossain, CC BY-SA 3.0, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Motion planning asks for a path through configuration space, the set of all states a robot can occupy. A two-joint arm already has a two-dimensional space, a six-joint arm has six dimensions, and a mobile robot with heading has position plus orientation.',
        'The planner must find a collision-free path before the world changes or the control system needs a command. RRT*, short for Rapidly-exploring Random Tree star, exists because continuous spaces are too large to enumerate but can often be sampled.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to draw a grid over the space and run A* or Dijkstra on the grid cells. That is reasonable in a small two-dimensional map because each cell has a few neighbors and collision checks are simple.',
        'It also gives a clean correctness story: if the grid resolution is accepted as the world, graph search can find the cheapest grid path. The hidden assumption is that the grid is small enough and fine enough at the same time.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is dimensionality. If one dimension uses 100 bins, two dimensions use 10,000 cells, six dimensions use 1,000,000,000,000 cells, and most of those cells may never matter to the final path.',
        'A second wall is geometry. Narrow passages, robot footprints, joint limits, and obstacles make the useful states a thin subset of the full space, so a uniform grid spends most work proving that irrelevant cells are empty or blocked.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RRT* replaces exhaustive enumeration with a growing tree of feasible motions. Random samples pull the tree into unexplored free space, and nearby-neighbor searches decide where the new state should connect.',
        'The star in RRT* is the cost invariant. Each node stores the cheapest known path cost through the current tree, and rewiring repairs earlier parent choices when a later sample exposes a cheaper local route.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each iteration samples a candidate state, finds nearby tree nodes, steers from one of those nodes toward the sample, and collision-checks that local edge. If the edge is valid, the candidate enters the tree with a parent and a cost-to-come, which means total cost from the start.',
        'RRT* then checks nearby existing nodes. If routing one of them through the new node is cheaper and the connecting edge is valid, that old node changes parent and its descendants inherit lower path costs.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The feasibility argument is an invariant: every edge in the tree has passed the collision checker, so every root-to-node path is collision-free in the modeled world. Rewiring never breaks that invariant because it only installs a new parent after checking the replacement edge.',
        'The improvement argument is monotonic for stored best-known tree costs. A node keeps its old parent unless a valid cheaper route appears, so rewiring can lower known cost but cannot make a recorded node path invalid.',
        'The optimality claim is asymptotic, which means it appears as sample count grows under the required assumptions. In a real robot, a timeout returns the best valid path found so far, not proof that no better physical path exists.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With n samples, the expensive work is nearest-neighbor search, neighborhood scans, and collision checking. A naive nearest-neighbor search costs O(n) per sample, while a spatial index can reduce typical lookup cost but adds maintenance and metric limits.',
        'Cost behaves like a budget trade. Doubling the sample count can improve path quality, but it also roughly doubles collision-check opportunities and increases the number of neighbors considered during rewiring.',
        'Memory is O(n) for nodes, parent pointers, costs, and edge metadata. In practice, collision checking often dominates CPU time because it touches robot geometry, obstacle maps, and joint constraints.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'RRT* fits robot arms, warehouse robots, drones, and autonomous-vehicle subsystems when the state space is continuous and a collision checker is available. It is useful when a quick feasible path is valuable and extra planning time can improve path length or clearance.',
        'It also appears in simulation and planning benchmarks because it separates two hard problems cleanly: sampling the space and validating local motion. A stack can use RRT* for global geometric planning, then pass the result to smoothing, time-parameterization, and control.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RRT* fails when the distance metric lies about the robot. A car, drone, or arm with dynamics may be unable to execute a geometrically short connection even though the edge is collision-free.',
        'It also struggles in narrow passages because random samples may rarely land in the small region that matters. Bad obstacle inflation, stale map frames, wrong joint limits, or an incomplete collision model can make the tree prove safety in the wrong world.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A warehouse robot must move from (0, 0) to (10, 0) around a shelf that blocks x from 4 to 6 and y from -1 to 1. A first feasible tree might route through (2, 3), (7, 3), and (10, 0), for a path length near 12.2 meters.',
        'After 500 samples, a new node at (5, 1.4) connects two old branches with valid clearance. Rewiring changes the route to (0, 0), (3.8, 1.5), (6.2, 1.5), and (10, 0), lowering length to about 10.6 meters while preserving the collision-checked edge invariant.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OMPL RRTstar class reference at https://ompl.kavrakilab.org/classompl_1_1geometric_1_1RRTstar.html and the RRT* paper by Karaman and Frazzoli at https://arxiv.org/abs/1105.1186. Study A* search for the discrete contrast, probabilistic roadmaps for another sampling planner, and collision broadphase structures for the cost hidden inside each edge check.',
      ],
    },
  ],
};
