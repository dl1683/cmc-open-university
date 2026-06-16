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
    { heading: 'What it is', paragraphs: ['RRT* is a sampling-based motion planner. It grows a tree through continuous configuration space and rewires the tree to improve path cost over time.'] },
    { heading: 'How it works', paragraphs: ['Sample a state, find nearest nodes, steer toward the sample, collision-check the edge, insert the node, and rewire nearby nodes if the new route lowers cost.'] },
    { heading: 'Case study', paragraphs: ['A manipulator must reach around an obstacle. Early samples find a rough path. As more samples arrive, RRT* rewires segments through better parents and lowers path cost while preserving collision-free edges.'] },
    { heading: 'Pitfalls', paragraphs: ['Nearest-neighbor search and collision checking dominate runtime. A path valid on a stale map may be unsafe. Kinematic feasibility is not the same as dynamic feasibility.'] },
    { heading: 'Why it matters', paragraphs: ['RRT* is a tree data structure under continuous geometry constraints. It connects spatial indexes, parent pointers, cost propagation, and anytime optimization.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: OMPL RRTstar class reference at https://ompl.kavrakilab.org/classompl_1_1geometric_1_1RRTstar.html and MoveIt OMPL planner tutorial at https://moveit.picknik.ai/humble/doc/examples/ompl_interface/ompl_interface_tutorial.html. Study A* Search, Quadtree Spatial Index, Nav2 Costmap, and Delaunay/Voronoi next.'] },
  ],
};
