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
    {
      heading: 'Why this exists',
      paragraphs: [
        `A robot needs two things at the same time: a map of the world and an estimate of where it is inside that map. That is the SLAM problem. The hard part is that both estimates depend on each other. A bad pose makes the map wrong, and a bad map makes later poses harder to estimate.`,
        `Dead reckoning is not enough. Wheel odometry slips, inertial sensors drift, camera features vanish, lidar scans repeat in similar corridors, and small errors accumulate. A robot can drive a square and believe it ended two meters away from where it started. If the map keeps that drift, walls bend and landmarks duplicate.`,
        `Pose-graph SLAM exists to make the whole trajectory adjustable. Instead of treating each pose as final, the system stores poses and measurements in a graph. When new evidence arrives, especially a loop closure, the optimizer can distribute correction across the connected poses.`,
      ],
    },
    {
      heading: 'Baseline and wall',
      paragraphs: [
        `The baseline is incremental odometry. Start at pose x0, apply the measured motion to get x1, apply the next motion to get x2, and keep appending poses. This is fast, local, and easy to run in real time.`,
        `The wall is accumulated error. Every small mistake becomes the starting point for the next estimate. Patching the final pose after the fact creates a kink. Ignoring a loop closure leaves a globally inconsistent map. Rebuilding the whole path from scratch after every measurement is too expensive.`,
        `The better design is to remember why each pose was estimated. Odometry, scan matches, priors, GPS fixes, landmarks, and loop closures become constraints. The trajectory becomes a set of variables that can be optimized against those constraints.`,
      ],
    },
    {
      heading: 'Core model and invariant',
      paragraphs: [
        `Pose-graph SLAM stores robot poses as variables and measurements as factors. In 2D, a pose is often x, y, and yaw. In 3D, it is a rigid transform. A factor says how one or more poses should relate according to a sensor measurement and a noise model.`,
        `Common factors include a prior on the first pose, odometry between neighboring poses, scan-matching constraints, visual feature matches, GPS measurements, landmark observations, and loop closures between poses that appear to revisit the same place.`,
        `The invariant is that the graph is an evidence structure. A pose estimate without its factors is just a path drawing. A SLAM result should be explainable by the measurements, weights, residuals, and solver state that produced it.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `The graph grows as the robot moves. Odometry adds short-range factors between neighboring poses. A loop detector proposes long-range factors when appearance, scan geometry, or feature matches suggest that two poses see the same place. A prior anchors the coordinate frame so the whole map cannot slide or rotate freely.`,
        `For each factor, the solver computes a residual: the difference between what the measurement says and what the current pose estimates predict. It then linearizes those residuals around the current estimate, builds a sparse least-squares problem, solves for pose updates, applies the updates, and repeats.`,
        `The word sparse is doing real work. Most factors touch only one or two poses, so the Jacobian has many zeros. Good variable ordering reduces fill-in during factorization. Incremental solvers reuse previous work instead of starting from zero after every new measurement.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The factor-graph view shows poses as variable nodes and measurements as edges or factor nodes. The odometry chain says each pose should sit near the next pose according to measured motion. The prior fixes the first pose. The loop closure is different because it connects distant parts of the trajectory.`,
        `The drift plot shows the reason the graph is useful. Pure odometry accumulates error. Once a valid loop closure enters the graph, the optimized trajectory can reduce global drift without simply snapping the last pose to the first one.`,
        `The sparse-solve table points to the engineering cost. Linearization, normal equations, ordering, and updates are not decoration. They are the mechanism that turns a graph of local measurements into one globally consistent estimate.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `A warehouse robot drives around an aisle and returns near the starting point. Odometry says the final pose is close, but shifted and rotated. A scan matcher compares the current lidar scan with an earlier scan and proposes a loop closure between x4 and x0.`,
        `If the closure is valid, optimization spreads the correction across x1, x2, x3, and x4. The path becomes more consistent while still respecting odometry as much as the noise model allows. The robot does not have to discard the run or patch one endpoint by hand.`,
        `If the closure is false, the same mechanism can bend the map into a wrong but smooth-looking shape. Repeated shelves, long corridors, or similar parking-garage levels can fool a place recognizer. That is why loop closure gating is part of the algorithm, not an optional safety check.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The graph works because measurements share variables. If one pose moves, the residuals on neighboring odometry factors change. If a loop closure pulls a later pose toward an earlier pose, the optimizer must balance that demand against all intermediate odometry factors. Correction spreads through the graph.`,
        `Under the usual Gaussian noise assumptions, minimizing weighted squared residuals is the maximum-likelihood or maximum-a-posteriori estimate for the chosen model. That statement has a condition attached: the factors, data associations, and noise weights must be reasonable.`,
        `A gauge constraint is also required. Without a prior or fixed reference frame, the entire map can translate or rotate without changing relative residuals. The solver needs an anchor to choose one coordinate system.`,
      ],
    },
    {
      heading: 'Correctness and reliability',
      paragraphs: [
        `SLAM correctness is not like sorting correctness. The map is an estimate, not a proof. The reliability contract is that the graph represents the available evidence honestly, the optimizer minimizes the stated objective, and bad factors are detected or downweighted before they dominate the result.`,
        `Loop closures need gates. A production system should check appearance score, geometric consistency, covariance, residual after insertion, and compatibility with nearby constraints. Robust kernels can reduce the influence of suspicious residuals, but they are not a substitute for data association.`,
        `The audit artifact should keep poses, factors, residuals, covariances, solver status, graph version, and sensor provenance together. When the map fails, the graph is the evidence needed to explain why.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Cost grows with the number of poses, factors, graph connectivity, relinearization frequency, and fill-in during sparse factorization. A simple chain of odometry factors is cheap. Many long-range closures and landmark constraints create denser coupling and harder solves.`,
        `Real systems use keyframes, submaps, marginalization, sliding windows, and incremental solvers to stay real time. They do not optimize every raw sensor frame forever. They choose which states are worth keeping and which information can be compressed.`,
        `Those choices have consequences. Marginalization can make old information harder to revise. Submaps improve scale but add boundary decisions. A sliding window can track locally while losing global correction unless loop closures are handled elsewhere.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Pose graphs fit mobile robots, warehouse autonomy, drones, autonomous vehicles, lidar mapping backpacks, visual-inertial odometry, and AR systems that need a consistent map over time. They are especially useful when the system can collect many reliable relative measurements and occasional loop closures.`,
        `They also win when explainability matters. A pose graph can show which measurement moved the map, which residual stayed high, which factor was downweighted, and which loop closure was accepted. That is much easier to inspect than a black-box path smoother.`,
        `The approach scales well when the world can be summarized by key poses and sparse constraints rather than dense per-pixel state. That is why pose graphs often sit above lower-level odometry and mapping modules.`,
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        `Perceptual aliasing is the classic failure. Repeated corridors, shelves, parking garages, and office layouts can create false loop closures. Dynamic objects can corrupt scan matches. Feature-poor spaces can leave the graph underconstrained.`,
        `Bad calibration creates biased factors. Wrong noise models give the optimizer the wrong trust weights. Monocular vision can suffer scale ambiguity. A solver can converge to a local minimum if the initial estimate is too far from the truth.`,
        `The most dangerous failures are confident. A wrong loop closure can make the map look clean while being physically false. A clean residual plot does not prove the world model is right if the data association was wrong.`,
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        `Log the graph, not just the final map. Keep factor provenance, sensor timestamps, calibration versions, residual histories, accepted and rejected loop closures, robust-kernel weights, and solver status. Without those records, map debugging becomes guesswork.`,
        `Treat loop closure as a controlled write into a shared estimate. Gate it, test it against local geometry, watch the residuals after insertion, and keep a way to remove or quarantine a bad closure. A single false edge can damage a long run.`,
        `Choose graph size deliberately. Keyframe too often and the solver slows down. Keyframe too rarely and motion details vanish. Use submaps or sliding windows when real-time operation matters, but keep a global correction path for revisits.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Study Factor Graphs, Nonlinear Least Squares, Sparse Matrix Factorization, Robust Kernels, ICP, Visual Place Recognition, Occupancy Grids, Kalman Filtering, and RRT* Motion Planning. Those topics explain the optimizer, the sensor matching, and the planning layer that usually consumes the map.`,
        `Useful references include the GTSAM factor graph tutorial, PoseSLAM material, g2o papers, and modern visual-inertial SLAM systems. When reading them, keep one question in view: which variables are being estimated, and which measurement factors are trusted enough to move them?`,
      ],
    },
  ],
};
