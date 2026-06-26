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
    explanation: 'The controller does not optimize the whole path. It chooses one reachable target ahead on the reference line, then asks for the curvature of the arc that would intersect that target.',
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
    explanation: 'The table shows why pure pursuit is easy to run and easy to audit. Pose, velocity, nearest index, target point, lookahead, curvature, and timestamp are enough to explain the next steering command.',
  };

  yield {
    state: pursuitGraph('Speed and curvature regulate the lookahead target'),
    highlight: { active: ['look', 'curv', 'speed', 'steer', 'e-speed-steer'], compare: ['path3'] },
    explanation: 'The highlighted target moves because lookahead is the stability knob. Long lookahead damps steering but cuts corners; short lookahead tracks tightly but can oscillate, so regulated controllers slow down around high curvature or obstacles.',
  };

  yield {
    state: lookaheadPlot(),
    highlight: { active: ['adaptive', 'corner'], compare: ['fixed'] },
    explanation: 'The plot makes the policy visible. Fixed lookahead treats a slow corner and a fast straightaway the same; adaptive lookahead grows with speed and tightens near turns so the controller does not overreact at speed or miss the corner.',
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
    explanation: 'The error ledger prevents one vague "bad tracking" label. Cross-track error, heading error, curvature error, and command latency point to different fixes, so they must be measured separately.',
  };

  yield {
    state: pursuitGraph('Corner overshoot is a data-structure problem'),
    highlight: { active: ['path1', 'path2', 'path3', 'look', 'curv', 'speed'], found: ['e-path1-path2', 'e-path2-path3', 'e-path2-look'] },
    explanation: 'Corner overshoot comes from data choices as much as control math. Path density, target search, speed profile, and latency decide where the target lands when the robot needs to turn.',
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
    explanation: 'The aisle-turn rows show a healthy state transition. Lookahead and speed shrink before the corner so the arc fits, then grow on exit so the robot stops chasing tiny path deviations.',
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
    explanation: 'These failures are not edge trivia. A wrong frame, sparse path, stale command timestamp, or reversed motion mode can make a mathematically simple controller chase the wrong point.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lookahead point') yield* lookaheadPoint();
  else if (view === 'tracking errors') yield* trackingErrors();
  else throw new InputError('Pick a pure-pursuit view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the lookahead view as a geometry pipeline. Pose means the vehicle position and heading; a path is an ordered curve the vehicle should follow; lookahead distance is how far forward along that path the controller chooses a target. Active nodes show target selection and command computation.',
        'In the tracking-errors view, watch cross-track error, heading error, lookahead, curvature, and speed cap together. Curvature is how sharply the vehicle should turn. A stable controller is not the one with the smallest instant error; it is the one whose target and curvature change smoothly enough for the vehicle to execute.',
        {type:'callout', text:'Pure pursuit compresses path tracking into one auditable geometry decision: choose a forward target, then command the arc that reaches it.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A planner can produce a path, but a robot still needs steering commands at every control tick. The controller must translate a geometric path into motion while localization noise, sparse waypoints, timing delays, and actuator limits are present.',
        'Pure pursuit exists as a simple path-tracking controller. It chooses a point ahead on the path and computes the circular arc that would reach it from the current pose. The method is popular because its state is small enough to debug during motion.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to steer toward the nearest waypoint. That looks natural on a drawing because the nearest point measures current error. In motion, it can oscillate because the nearest point moves sideways as the robot crosses the path.',
        'Another obvious approach is to optimize a full future trajectory at every tick. Model predictive control can do that, but it needs a model, constraints, costs, and more compute. Pure pursuit keeps the runtime problem local and geometric.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Nearest-point chasing reacts to error instead of creating a forward goal. On a curve, the nearest point can sit beside or behind the vehicle, so steering toward it may create sharp corrections that the vehicle cannot execute cleanly.',
        'Full optimization has the opposite wall. It can be better, but it is harder to tune, harder to explain, and more expensive. Many warehouse robots, small autonomous vehicles, and teaching systems need a controller whose bad decisions can be inspected from a few numbers.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The controller should pursue a point ahead of the vehicle, not the nearest point. If the target is forward by a chosen lookahead distance, the vehicle can steer along an arc that reduces tracking error while maintaining motion.',
        'Lookahead is the design knob. Longer lookahead smooths steering but cuts corners. Shorter lookahead follows tightly but can oscillate. Real systems often adapt lookahead using speed, curvature, and lateral error.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The controller stores the path with cumulative arc length. At each tick, it finds the nearest path location, advances by the lookahead distance, and selects the target point. Starting the search near the previous nearest index avoids scanning the whole path from scratch.',
        'The target is transformed into the vehicle frame. In a common bicycle-model form, curvature is about 2*y / L^2, where y is the target lateral offset and L is lookahead distance. The system then converts curvature into steering angle or angular velocity and applies speed limits.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is geometric. A wheeled vehicle cannot move sideways; it follows arcs under steering limits. Choosing a reachable forward point and commanding the arc toward it makes the local target compatible with the vehicle motion primitive.',
        'The method is stable within its assumptions because the target moves ahead rather than jumping across the nearest lateral error. The same mechanism explains the tax: too much smoothing lets the arc cut inside corners, while too little smoothing makes the controller chase noise.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The computation per tick is small. With a remembered nearest index, target search is usually proportional to the number of path segments advanced, not the whole path. Curvature computation is constant time once the target is selected.',
        'The real cost is behavior tuning. At 2 m/s, a 1 m lookahead gives about 0.5 seconds of forward target horizon; a 6 m lookahead gives 3 seconds. The first can twitch on noisy paths, while the second can cut a tight aisle turn before the robot reaches it.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Pure pursuit is used in mobile robots, warehouse vehicles, low-speed autonomous driving stacks, agricultural robots, and teaching simulators. It fits systems with a planned path, reliable localization, and a vehicle model that can follow curvature commands.',
        'It is also a strong baseline. If pure pursuit cannot follow a clean path at low speed, the team should inspect transforms, localization, path density, timing, and actuator limits before adding a more complex controller.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when local geometry is not enough. Obstacles, dynamic constraints, reverse maneuvers, tire limits, and future curvature may require a trajectory optimizer. Pure pursuit assumes the path is already safe and locally followable.',
        'Common failures are long-lookahead corner cutting, short-lookahead oscillation, sparse waypoint jumps, stale transforms, high speed over curvature limits, and sign errors during reverse motion. The fix depends on which state field produced the command, so logging is part of the controller.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A warehouse robot drives at 1.5 m/s toward a 90-degree aisle turn. With lookahead L = 4 m, the selected target lands around the corner while the robot is still on the straight segment. If the target lateral offset in the robot frame is y = 1.2 m, curvature is 2*1.2/16 = 0.15 1/m, a smooth turn that may cut inside the shelf corner.',
        'When curvature ahead rises, the controller shortens lookahead to L = 2 m and caps speed at 0.8 m/s. If y = 0.9 m, curvature becomes 2*0.9/4 = 0.45 1/m, a tighter command at lower speed. The behavior change is not magic; it is the cost of trading smoothness for corner accuracy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Coulter 1992 on pure pursuit, Autoware pure pursuit controller documentation, and Nav2 Regulated Pure Pursuit controller documentation. Check current robotics-stack documentation before relying on parameter names because controller packages change.',
        'Study coordinate frames, bicycle models, path interpolation, Kalman filtering, A* route planning, dynamic window approaches, and model predictive control next. Pure pursuit is the bridge between planned geometry and executable steering.',
      ],
    },
  ],
};
