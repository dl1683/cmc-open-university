// Pure pursuit path tracking: choose a lookahead point on the reference path,
// compute curvature, and turn that into steering or angular velocity.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'pure-pursuit-lookahead-path-tracking-case-study',
  title: 'Pure Pursuit Lookahead Path Tracking Case Study',
  category: 'Systems',
  summary: 'A path-tracking primer: nearest path search, lookahead distance, target point selection, curvature command, speed regulation, cross-track error, and corner overshoot.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lookahead point', 'tracking errors'], defaultValue: 'lookahead point' },
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

function pursuitGraph(title) {
  return graphState({
    nodes: [
      { id: 'pose', label: 'pose', x: 0.8, y: 4.8, note: 'ego' },
      { id: 'nearest', label: 'nearest', x: 2.4, y: 4.0, note: 'path idx' },
      { id: 'look', label: 'lookahead', x: 4.1, y: 2.7, note: 'target' },
      { id: 'circle', label: 'arc', x: 5.5, y: 4.5, note: 'curve' },
      { id: 'curv', label: 'curvature', x: 7.0, y: 2.7, note: 'kappa' },
      { id: 'speed', label: 'speed', x: 7.0, y: 5.5, note: 'regulate' },
      { id: 'steer', label: 'steer', x: 8.8, y: 4.0, note: 'cmd' },
      { id: 'path1', label: 'p1', x: 2.5, y: 2.0, note: 'ref' },
      { id: 'path2', label: 'p2', x: 4.0, y: 1.8, note: 'ref' },
      { id: 'path3', label: 'p3', x: 5.5, y: 2.1, note: 'ref' },
    ],
    edges: [
      { id: 'e-pose-nearest', from: 'pose', to: 'nearest' },
      { id: 'e-nearest-look', from: 'nearest', to: 'look' },
      { id: 'e-look-circle', from: 'look', to: 'circle' },
      { id: 'e-circle-curv', from: 'circle', to: 'curv' },
      { id: 'e-curv-steer', from: 'curv', to: 'steer' },
      { id: 'e-speed-steer', from: 'speed', to: 'steer' },
      { id: 'e-path1-path2', from: 'path1', to: 'path2' },
      { id: 'e-path2-path3', from: 'path2', to: 'path3' },
      { id: 'e-path2-look', from: 'path2', to: 'look' },
    ],
  }, { title });
}

function lookaheadPlot() {
  return plotState({
    axes: {
      x: { label: 'speed', min: 0, max: 16 },
      y: { label: 'lookahead', min: 0, max: 22 },
    },
    series: [
      { id: 'fixed', label: 'fixed', points: [{ x: 0, y: 6 }, { x: 5, y: 6 }, { x: 10, y: 6 }, { x: 14, y: 6 }] },
      { id: 'adaptive', label: 'adaptive', points: [{ x: 0, y: 4 }, { x: 5, y: 8 }, { x: 10, y: 13 }, { x: 14, y: 17 }] },
    ],
    markers: [
      { id: 'corner', x: 10, y: 13, label: 'turn' },
    ],
  });
}

function* lookaheadPoint() {
  yield {
    state: pursuitGraph('Pure pursuit chases a point ahead on the path'),
    highlight: { active: ['pose', 'nearest', 'look', 'circle', 'curv', 'steer', 'e-pose-nearest', 'e-nearest-look', 'e-look-circle', 'e-circle-curv', 'e-curv-steer'], found: ['path2'] },
    explanation: 'Pure pursuit finds a target point on the reference trajectory at a lookahead distance, then computes the curvature needed to drive an arc toward that point.',
    invariant: 'The command follows the chosen lookahead point, not the whole path at once.',
  };

  yield {
    state: labelMatrix(
      'Tracking state',
      [
        { id: 'pose', label: 'pose' },
        { id: 'path', label: 'path idx' },
        { id: 'ld', label: 'lookahead' },
        { id: 'cmd', label: 'cmd' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
      ],
      [
        ['x,y,yaw,v', 'frame'],
        ['nearest+target', 'progress'],
        ['speed+curve', 'stability'],
        ['steer/kappa', 'control'],
      ],
    ),
    highlight: { active: ['pose:value', 'path:value', 'ld:value'], found: ['cmd:why'] },
    explanation: 'The controller state is compact: current pose, current velocity, nearest path index, target point, lookahead distance, curvature, and command timestamp.',
  };

  yield {
    state: pursuitGraph('Speed and curvature regulate the lookahead target'),
    highlight: { active: ['look', 'curv', 'speed', 'steer', 'e-speed-steer'], compare: ['path3'] },
    explanation: 'Long lookahead smooths motion but cuts corners. Short lookahead tracks tightly but can oscillate. Regulated variants slow down for high curvature and obstacles.',
  };

  yield {
    state: lookaheadPlot(),
    highlight: { active: ['adaptive', 'corner'], compare: ['fixed'] },
    explanation: 'Adaptive lookahead grows with speed, lateral error, or curvature. The goal is to avoid overreacting at speed while still turning tightly enough near corners.',
  };
}

function* trackingErrors() {
  yield {
    state: labelMatrix(
      'Error ledger',
      [
        { id: 'cross', label: 'cross track' },
        { id: 'head', label: 'heading' },
        { id: 'curv', label: 'curvature' },
        { id: 'delay', label: 'delay' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'knob', label: 'knob' },
      ],
      [
        ['off path', 'shorter Ld'],
        ['angle miss', 'yaw source'],
        ['corner cut', 'slow down'],
        ['late cmd', 'timestamp'],
      ],
    ),
    highlight: { active: ['cross:knob', 'curv:knob'], found: ['delay:knob'] },
    explanation: 'Tracking errors need separate labels. Cross-track error, heading error, curvature error, and control latency have different fixes.',
  };

  yield {
    state: pursuitGraph('Corner overshoot is a data-structure problem'),
    highlight: { active: ['path1', 'path2', 'path3', 'look', 'curv', 'speed'], found: ['e-path1-path2', 'e-path2-path3', 'e-path2-look'] },
    explanation: 'The path representation, target-point search, speed profile, and command latency decide whether a robot cuts a corner, oscillates, or tracks smoothly.',
  };

  yield {
    state: labelMatrix(
      'Complete case: aisle turn',
      [
        { id: 'entry', label: 'entry' },
        { id: 'corner', label: 'corner' },
        { id: 'exit', label: 'exit' },
        { id: 'log', label: 'log' },
      ],
      [
        { id: 'Ld', label: 'Ld' },
        { id: 'speed', label: 'speed' },
        { id: 'state', label: 'state' },
      ],
      [
        ['9m', '1.2m/s', 'smooth'],
        ['4m', '.5m/s', 'tight'],
        ['8m', '1.0m/s', 'recover'],
        ['saved', 'saved', 'replay'],
      ],
    ),
    highlight: { active: ['corner:Ld', 'corner:speed'], found: ['log:state'] },
    explanation: 'In a narrow warehouse turn, the controller shortens lookahead and slows down at the corner, then lengthens lookahead after the turn to avoid wobble.',
  };

  yield {
    state: labelMatrix(
      'Pitfalls',
      [
        { id: 'frame', label: 'frame' },
        { id: 'sparse', label: 'sparse path' },
        { id: 'fast', label: 'too fast' },
        { id: 'reverse', label: 'reverse' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['wrong target', 'TF check'],
        ['jump target', 'resample'],
        ['overshoot', 'speed cap'],
        ['wrong sign', 'mode flag'],
      ],
    ),
    highlight: { active: ['frame:bad', 'sparse:bad', 'fast:bad'], found: ['frame:fix', 'sparse:fix'] },
    explanation: 'Pure pursuit is simple enough to hide basic integration errors. Coordinate frames, path density, vehicle model, and timestamp alignment are not optional details.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lookahead point') yield* lookaheadPoint();
  else if (view === 'tracking errors') yield* trackingErrors();
  else throw new InputError('Pick a pure-pursuit view.');
}

export const article = {
  references: [
    { title: 'Autoware Pure Pursuit Controller', url: 'https://autowarefoundation.github.io/autoware_universe/main/control/autoware_pure_pursuit/' },
    { title: 'Nav2 Regulated Pure Pursuit Controller', url: 'https://docs.nav2.org/configuration/packages/configuring-regulated-pp.html' },
    { title: 'Implementation of the Pure Pursuit Path Tracking Algorithm', url: 'https://publications.ri.cmu.edu/storage/publications/pub_files/pub3/coulter_r_craig_1992_1/coulter_r_craig_1992_1.pdf' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Pure pursuit is a path-tracking controller. It chooses a point ahead of the robot on the reference path and computes a curvature command that drives toward that point.', 'It is popular because the runtime state is small and explainable: current pose, path, lookahead distance, target point, curvature, and speed command.'] },
    { heading: 'How it works', paragraphs: ['Find the nearest path location, walk forward along the path by the lookahead distance, transform that target into the robot frame, compute curvature, then output steering or angular velocity. Repeat at controller rate.', 'Autoware describes its pure pursuit controller as computing steering angle for a desired trajectory and exposes lookahead parameters based on velocity, lateral error, and curvature: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_pure_pursuit/.'] },
    { heading: 'Complete case study', paragraphs: ['A warehouse robot approaches a ninety-degree aisle turn. With a fixed long lookahead, the target point lies around the corner and the robot cuts into the inside wall. With adaptive lookahead and speed regulation, it shortens lookahead near high curvature, slows down, tracks the corner, then lengthens lookahead on the straight exit.', 'The debug record stores path index, target point, lookahead distance, curvature command, speed, cross-track error, heading error, and timestamp.'] },
    { heading: 'Data structures', paragraphs: ['The path should be a searchable sequence of poses with arc length, curvature, speed targets, and frame metadata. The controller maintains the last nearest index to avoid jumping backward and stores a command ledger for replay.', 'Path density matters. If waypoints are too sparse or arc length is not tracked, target selection can jump and create steering spikes.'] },
    { heading: 'Pitfalls', paragraphs: ['Long lookahead smooths but cuts corners. Short lookahead tracks tightly but oscillates. Wrong TF frames create target points behind or beside the robot. Control delay makes the robot chase stale geometry.', 'Pure pursuit is not a full optimizer. It does not reason over obstacle cost across a horizon the way DWB or MPC does. It is best treated as a clear, fast tracking primitive with explicit speed and safety regulation around it.'] },
    { heading: 'Study next', paragraphs: ['Study DWB Velocity Lattice Trajectory Critic, MPC Receding Horizon Trajectory Controller, Nav2 Costmap Inflation Layer, Kalman Filter Sensor Fusion, A* Search, and RRT* Motion Planning Tree next.'] },
  ],
};
