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
      heading: 'Why this exists',
      paragraphs: [
        'A robot motion plan lives in continuous configuration space. Grid search can work for small maps, but a robot arm, drone, or car may have many degrees of freedom. Discretizing every dimension finely becomes impossible.',
        'Sampling-based planners avoid filling the whole space. They probe it. RRT* grows a tree through valid states and improves that tree over time.',
      ],
    },
    {
      heading: 'The obvious wall',
      paragraphs: [
        'A grid planner discretizes space and searches cells. That works for small two-dimensional maps, but it breaks down when the robot has many joints or continuous constraints. Every extra degree of freedom multiplies the grid.',
        'A pure random search also fails because random valid states do not automatically form a usable path. RRT* solves the wall by growing a connected tree of valid local motions while using randomness to explore the continuous space.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RRT finds a path by pulling a tree toward random samples. RRT* adds a cost invariant: when a new node is inserted, choose the best nearby parent and then rewire nearby nodes if the new route is cheaper.',
        'The tree is both a search structure and a proof artifact. Every edge in the tree has been checked for collision, and every node knows its parent and accumulated cost.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        "In the tree-growth view, read every accepted edge as a collision-checked motion, not just a line. The tree is a record of feasible local motions from the start state.",
        "In the rewire view, watch parent pointers and cost-to-come. RRT* improves because it is willing to change earlier local decisions when a new sample creates a cheaper route through the same free space.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sample a state. Find nearby tree nodes. Steer from a candidate parent toward the sample. Collision-check the edge. Insert the new node if the motion is valid. Then inspect nearby nodes and change their parent when routing through the new node lowers cost without creating a collision.',
        'In the manipulator case, early samples may produce a rough path around an obstacle. More samples reveal shorter connections. Rewiring lowers path cost while preserving the collision-free edge invariant.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The planner is probabilistic. Random samples eventually cover more of the reachable free space. The nearest-neighbor and steering steps connect those samples into a tree. Collision checks prevent invalid edges from entering the plan.',
        'RRT* improves on RRT because rewiring can repair earlier greedy choices. As samples grow, the tree has more opportunities to route through cheaper local neighborhoods.',
        'The important guarantee is asymptotic, not immediate. With enough samples and the right conditions, RRT* approaches an optimal path. In a real robot, the planner usually stops early under a time budget, so the returned path is a best-so-far artifact with a validity timestamp.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Runtime is usually dominated by nearest-neighbor search and collision checking. A better spatial index can help, but collision checking against robot geometry and obstacles often remains the expensive part.',
        'RRT* is anytime: it can return a feasible path early and improve it with more time. That is useful in robotics, where a decent path now can be more valuable than an optimal path too late.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'RRT* works well in high-dimensional continuous spaces where grid planning is too expensive and where collision checking can answer whether a sampled edge is valid.',
        'It also wins when an anytime planner is useful. The system can take an early feasible path, keep improving while time remains, and hand the controller a path that is valid under the current map and robot model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'RRT* struggles with narrow passages, bad distance metrics, dynamic obstacles, stale maps, and systems where kinematic feasibility is not enough. A path that ignores velocity, acceleration, traction, or timing may be geometrically valid and physically useless.',
        'It can also fail quietly when the collision checker is wrong. If the robot footprint, map frame, obstacle inflation, or joint limits are stale, the tree may prove feasibility in the wrong world.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A warehouse robot starts on one side of a shelf and needs to reach a dock. RRT quickly finds a zig-zag path around the shelf by sampling free states and connecting valid edges. That path is feasible but long.',
        'As more samples arrive, one new sample near a corridor opening lets several old nodes rewire through a shorter route. The states did not change; the parent pointers did. That is the RRT* distinction: improve the tree, not only grow it.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Define the state space, distance metric, steering function, collision checker, and cost function before tuning sample counts. A beautiful tree in the wrong metric can still produce bad robot behavior.',
        'Use a nearest-neighbor index when sample counts grow. Keep collision checking conservative and frame-consistent. Store parent, cost-to-come, and edge validity for every accepted node so rewiring cannot create an invalid path.',
        'Smooth or time-parameterize the returned path before execution when the robot needs velocity, acceleration, or dynamic feasibility. RRT* solves geometric planning unless the state and cost model explicitly include dynamics.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use RRT* when the search space is continuous, high-dimensional, and collision checking is available, and when an anytime planner is acceptable. It is strongest when a quick feasible path is useful and extra time can improve cost.',
        'Do not confuse asymptotic optimality with a real-time guarantee. A planner stopped after 200 milliseconds returns the best tree it has, not a proof that no better path exists.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'The planner is only as good as its world model. Bad obstacle inflation, stale map frames, wrong robot footprint, or missing joint limits can make an invalid path look valid. Treat collision-checker configuration as safety-critical data.',
        'Monitor planning time, first-feasible time, final path cost, collision-check count, nearest-neighbor time, failure reason, and how much smoothing changed the path. Those metrics tell you whether the planner is exploring badly, checking too expensively, or returning rough paths that the controller has to repair.',
        'Also log seeds for failures. Sampling planners can be hard to debug because two runs differ. Reproducible seeds turn a rare bad plan into a case the team can inspect.',
      ],
    },
    {
      heading: 'Common misconception',
      paragraphs: [
        'The misconception is that RRT* is just RRT with a cleanup pass. The rewiring step changes the nature of the tree. Each new sample can improve old routes, so the structure is not only exploring free space; it is maintaining a cost-aware approximation of better paths through that space.',
        'Another misconception is that a prettier geometric path is automatically executable. Many robots need curvature limits, acceleration limits, dynamic feasibility, and controller tracking margin. RRT* can be part of that pipeline, but the state and edge checker must include the constraints the robot actually obeys.',
        'The planner should also be judged against alternatives. A* on a grid, PRM roadmaps, trajectory optimization, and lattice planners all have domains where they are cleaner. RRT* is strongest when sampling continuous free space is easier than enumerating it.',
        'That is why good robotics stacks treat RRT* as one component. The global planner proposes a route, local planners and controllers make it smooth and executable, and perception keeps updating whether the world still matches the assumptions behind the tree.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: OMPL RRTstar class reference at https://ompl.kavrakilab.org/classompl_1_1geometric_1_1RRTstar.html and MoveIt OMPL planner tutorial at https://moveit.picknik.ai/humble/doc/examples/ompl_interface/ompl_interface_tutorial.html.',
        'Study A* Search for discrete shortest paths, Quadtree Spatial Index for spatial pruning, Nav2 Costmap Inflation Layer for robot planning costs, Delaunay/Voronoi for geometric roadmaps, and Dynamic AABB Tree Broadphase for collision candidate pruning.',
      ],
    },
  ],
};
