// Pose-graph SLAM: robot poses are variables, odometry and loop closures are
// factors, and optimization finds the most consistent trajectory.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'pose-graph-slam-factor-graph-case-study',
  title: 'Pose Graph SLAM Factor Graph Case Study',
  category: 'Systems',
  summary: 'A SLAM case study: pose variables, odometry factors, loop closures, priors, sparse normal equations, residuals, robust kernels, and map-consistency audits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['factor graph', 'loop closure'], defaultValue: 'factor graph' },
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

function slamGraph(title) {
  return graphState({
    nodes: [
      { id: 'x0', label: 'x0', x: 1.0, y: 4.8, note: 'pose' },
      { id: 'x1', label: 'x1', x: 2.8, y: 3.2, note: 'pose' },
      { id: 'x2', label: 'x2', x: 4.8, y: 2.0, note: 'pose' },
      { id: 'x3', label: 'x3', x: 6.8, y: 3.2, note: 'pose' },
      { id: 'x4', label: 'x4', x: 8.4, y: 5.0, note: 'pose' },
      { id: 'prior', label: 'prior', x: 0.8, y: 2.2, note: 'anchor' },
      { id: 'loop', label: 'loop', x: 4.8, y: 6.2, note: 'closure' },
    ],
    edges: [
      { id: 'e-prior-x0', from: 'prior', to: 'x0', weight: 'prior' },
      { id: 'e-x0-x1', from: 'x0', to: 'x1', weight: 'odom' },
      { id: 'e-x1-x2', from: 'x1', to: 'x2', weight: 'odom' },
      { id: 'e-x2-x3', from: 'x2', to: 'x3', weight: 'odom' },
      { id: 'e-x3-x4', from: 'x3', to: 'x4', weight: 'odom' },
      { id: 'e-x4-loop', from: 'x4', to: 'loop', weight: 'match' },
      { id: 'e-loop-x0', from: 'loop', to: 'x0', weight: 'same place' },
    ],
  }, { title });
}

function* factorGraph() {
  yield {
    state: slamGraph('Poses and measurements form a factor graph'),
    highlight: { active: ['x0', 'x1', 'x2', 'x3', 'x4', 'e-x0-x1', 'e-x1-x2', 'e-x2-x3', 'e-x3-x4'], compare: ['loop'] },
    explanation: 'Pose-graph SLAM stores robot poses as variables and odometry constraints as factors. Optimization adjusts all poses to minimize residuals.',
  };
  yield {
    state: labelMatrix(
      'Factor table',
      [
        { id: 'prior', label: 'prior' },
        { id: 'odom', label: 'odom' },
        { id: 'loop', label: 'loop' },
        { id: 'robust', label: 'robust' },
      ],
      [
        { id: 'connects', label: 'vars' },
        { id: 'role', label: 'role' },
      ],
      [
        ['x0', 'anchor'],
        ['xi,xj', 'motion'],
        ['x4,x0', 'close'],
        ['factor', 'downweight'],
      ],
    ),
    highlight: { found: ['prior:role', 'odom:role', 'loop:role'], compare: ['robust:role'] },
    explanation: 'A factor graph is explicit about which variables each measurement constrains. Priors anchor the map, odometry links neighbors, and loop closures correct drift.',
    invariant: 'A SLAM graph is an evidence graph, not only a trajectory drawing.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'step', min: 0, max: 5 }, y: { label: 'drift', min: 0, max: 5 } },
      series: [
        { id: 'odom', label: 'odom', points: [{ x: 0, y: 0 }, { x: 1, y: 0.6 }, { x: 2, y: 1.4 }, { x: 3, y: 2.2 }, { x: 4, y: 3.4 }] },
        { id: 'opt', label: 'opt', points: [{ x: 0, y: 0 }, { x: 1, y: 0.4 }, { x: 2, y: 0.8 }, { x: 3, y: 0.9 }, { x: 4, y: 0.5 }] },
      ],
      markers: [
        { id: 'close', x: 4, y: 0.5, label: 'loop' },
      ],
    }),
    highlight: { active: ['opt', 'close'], compare: ['odom'] },
    explanation: 'Odometry drift grows over time. A valid loop closure can pull the trajectory back into a globally consistent shape.',
  };
  yield {
    state: labelMatrix(
      'Sparse solve',
      [
        { id: 'jac', label: 'Jacobian' },
        { id: 'normal', label: 'normal eq' },
        { id: 'order', label: 'ordering' },
        { id: 'update', label: 'update' },
      ],
      [
        { id: 'why', label: 'why' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['linearize', 'wrong lin'],
        ['least sq', 'ill cond'],
        ['reduce fill', 'slow'],
        ['poses', 'bad loop'],
      ],
    ),
    highlight: { found: ['jac:why', 'normal:why', 'order:why'], compare: ['update:risk'] },
    explanation: 'SLAM optimization is sparse nonlinear least squares. Variable ordering and robust handling of bad factors matter for scale and correctness.',
  };
}

function* loopClosure() {
  yield {
    state: slamGraph('Loop closure adds a long-range constraint'),
    highlight: { active: ['x4', 'loop', 'x0', 'e-x4-loop', 'e-loop-x0'], compare: ['e-x0-x1', 'e-x1-x2'] },
    explanation: 'A loop closure says the robot revisited a known place. That long-range factor can correct accumulated odometry drift.',
  };
  yield {
    state: labelMatrix(
      'Closure gate',
      [
        { id: 'scan', label: 'scan' },
        { id: 'score', label: 'score' },
        { id: 'geom', label: 'geom' },
        { id: 'accept', label: 'accept' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['match', 'maybe'],
        ['0.92', 'pass'],
        ['ICP ok', 'pass'],
        ['factor', 'add'],
      ],
    ),
    highlight: { found: ['score:gate', 'geom:gate', 'accept:gate'], compare: ['scan:gate'] },
    explanation: 'False loop closures can bend the whole map. A gate should check appearance match, geometric consistency, covariance, and downstream residuals.',
  };
  yield {
    state: slamGraph('Bad closures need robust kernels or rejection'),
    highlight: { removed: ['loop', 'e-x4-loop', 'e-loop-x0'], active: ['x1', 'x2', 'x3'], compare: ['x0', 'x4'] },
    explanation: 'A robust kernel can reduce the influence of suspicious factors, but catastrophic false closures should be rejected before optimization.',
  };
  yield {
    state: labelMatrix(
      'SLAM audit',
      [
        { id: 'poses', label: 'poses' },
        { id: 'factors', label: 'factors' },
        { id: 'resid', label: 'resid' },
        { id: 'map', label: 'map' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'why', label: 'why' },
      ],
      [
        ['x,y,yaw', 'replay'],
        ['edges', 'evidence'],
        ['error', 'debug'],
        ['version', 'compare'],
      ],
    ),
    highlight: { found: ['poses:why', 'factors:why', 'resid:why', 'map:why'] },
    explanation: 'SLAM failures are explainable only when the graph, factor provenance, residuals, and optimized trajectory are kept together.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'factor graph') yield* factorGraph();
  else if (view === 'loop closure') yield* loopClosure();
  else throw new InputError('Pick a pose-graph SLAM view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['Pose-graph SLAM estimates a robot trajectory from odometry, priors, and loop closures. It represents poses as variables and measurements as factors in a sparse graph.'] },
    { heading: 'How it works', paragraphs: ['Build a factor graph, linearize measurement residuals around the current estimate, solve a sparse least-squares problem, and update pose estimates. Loop closures add long-range constraints that can correct drift.'] },
    { heading: 'Case study', paragraphs: ['A robot drives a loop and returns near the start. Odometry says it drifted several meters. A strong loop closure between the last pose and first pose pulls the whole path into consistency.'] },
    { heading: 'Pitfalls', paragraphs: ['False loop closures can destroy a map. Poor noise models overtrust bad sensors. Bad variable ordering increases solve cost. Keeping only the final map hides the evidence needed to debug failures.'] },
    { heading: 'Why it matters', paragraphs: ['Pose-graph SLAM is a practical factor-graph data structure. It connects robotics, sparse matrices, graph optimization, uncertainty, and replayable evidence.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: GTSAM factor graph tutorial at https://gtsam.org/tutorials/intro.html and PoseSLAM docs at https://gtsam-jlblanco-docs.readthedocs.io/en/latest/PoseSLAM.html. Study Occupancy Grid Mapping, Kalman Filter Sensor Fusion, Sparse Matrix formats, and Graph BFS next.'] },
  ],
};
