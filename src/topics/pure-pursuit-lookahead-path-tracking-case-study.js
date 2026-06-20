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
  references: [
    { title: 'Autoware Pure Pursuit Controller', url: 'https://autowarefoundation.github.io/autoware_universe/main/control/autoware_pure_pursuit/' },
    { title: 'Nav2 Regulated Pure Pursuit Controller', url: 'https://docs.nav2.org/configuration/packages/configuring-regulated-pp.html' },
    { title: 'Implementation of the Pure Pursuit Path Tracking Algorithm', url: 'https://publications.ri.cmu.edu/storage/publications/pub_files/pub3/coulter_r_craig_1992_1/coulter_r_craig_1992_1.pdf' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Pure pursuit is a geometric path-tracking controller. It chooses a target point ahead of the robot on the reference path, transforms that point into the robot frame, and computes the curvature of an arc that would drive the robot toward it.',
        'The appeal is that the runtime state is small and inspectable: current pose, path, nearest path index, lookahead distance, target point, curvature command, speed command, and timing. That makes it useful in robots, autonomous vehicles, warehouse platforms, and teaching systems where a controller should be easy to debug under motion.',
        {type:'callout', text:'Pure pursuit compresses path tracking into one auditable geometry decision: choose a forward target, then command the arc that reaches it.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious path-following approach is to point the robot at the nearest waypoint or at the next waypoint in the list. That feels reasonable until the path is sparse, noisy, or curved. A robot that chases the nearest point can oscillate because the nearest point moves sideways as the robot crosses the path.',
        'The other obvious approach is to optimize a full future trajectory at every control tick. That can be powerful, but it asks for a model, constraints, obstacle costs, and more compute. Pure pursuit sits between those extremes. It keeps the geometry simple, but it looks far enough ahead to produce a smooth steering target.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to turn tracking into one local geometry problem. Instead of asking where the whole future trajectory should go, ask which point on the path lies one lookahead distance ahead and what circular arc reaches that point from the current pose.',
        'Lookahead is the main design knob. A longer lookahead smooths commands and makes the robot less sensitive to small path noise, but it can cut corners. A shorter lookahead follows tightly, but it can oscillate or overreact. Real systems often adapt lookahead by speed, curvature, and lateral error.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect pure pursuit as a chain of decisions: find the nearest path position, walk forward by lookahead distance, transform the target into the robot frame, compute curvature, apply speed or steering limits, and emit the command. If the robot behaves badly, locate which step produced the wrong state.',
        'The target point is the compressed control problem. If it jumps, the command jumps. If it is behind the robot because of a frame error, the command becomes nonsense. If it lies around a sharp corner at high speed, the robot may cut the corner even though the math is internally consistent.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The controller stores the path as an ordered sequence of poses with arc length. At each tick, it starts near the previous nearest index, finds the closest path location, then advances along path distance until it reaches the lookahead point. This avoids searching the whole path from scratch and reduces backward jumps.',
        'After selecting the target, the controller transforms it into the robot coordinate frame. In the common bicycle-model form, curvature is proportional to the lateral offset divided by squared lookahead distance. The command is then converted into steering angle or angular velocity depending on the vehicle model.',
        'Autoware describes a pure pursuit controller that computes steering angle for a desired trajectory and exposes lookahead parameters based on velocity, lateral error, and curvature: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_pure_pursuit/. Nav2 Regulated Pure Pursuit adds practical speed regulation around obstacles, curvature, and approach behavior: https://docs.nav2.org/configuration/packages/configuring-regulated-pp.html.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The path should not be only an array of x-y points. A useful controller path stores pose, heading, cumulative arc length, curvature, speed target, frame id, timestamp, and optional lane or route metadata. Those fields let the controller select a target by distance and diagnose whether geometry is stale or in the wrong frame.',
        'The controller state should include the last nearest index, selected target index, lookahead distance, cross-track error, heading error, curvature command, speed cap, transform age, and command timestamp. Keeping this ledger makes failures replayable. A path-tracking bug is often not in the formula; it is in stale transforms, sparse waypoints, or a target selection jump.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A warehouse robot approaches a ninety-degree aisle turn. With fixed long lookahead, the selected target lies around the corner while the robot is still on the straight approach. The resulting arc is smooth, but it cuts inside the turn and risks clipping a shelf.',
        'A better configuration shortens lookahead as curvature and lateral error rise, caps speed before the turn, and lengthens lookahead again after the robot exits onto the straight segment. The debug record shows nearest index, lookahead distance, target point, curvature, speed cap, cross-track error, heading error, and transform age at each tick.',
        'This is why pure pursuit is useful for education. Students can see how one number, the lookahead distance, changes behavior. They can also see that a mathematically simple controller still needs serious engineering around frames, timing, path density, and speed policy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Pure pursuit works because it uses geometry that matches the motion primitive. A wheeled robot cannot usually teleport sideways; it follows arcs and constrained turns. Choosing a forward point and fitting an arc gives the robot a reachable local goal rather than a raw error vector.',
        'The method also stabilizes tracking by not chasing the nearest path point. The lookahead point moves ahead of the robot, so small lateral errors do not immediately flip the command. That is the same reason too much lookahead can be dangerous: smoothing and corner-cutting are two sides of the same mechanism.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Pure pursuit wins when the path is already planned, the vehicle model is simple enough for curvature control, and the platform needs a fast and explainable tracker. It is common in mobile robotics, warehouse vehicles, low-speed autonomous driving, teaching simulators, and systems where a full optimizer is unnecessary or too expensive.',
        'It is especially good as a baseline. If a robot cannot follow a clean path with pure pursuit under mild conditions, the team should inspect localization, transforms, path density, controller timing, and actuator limits before blaming a more advanced planner.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pure pursuit is not a full trajectory optimizer. It does not reason over obstacle cost, dynamic constraints, multi-step feasibility, reverse maneuvers, or future curvature the way MPC can. It also assumes the selected path is valid and that following it locally is safe.',
        'Common failures are predictable: long lookahead cuts corners, short lookahead oscillates, sparse paths create target jumps, stale transforms point to the wrong target, high speed overwhelms curvature limits, and reversed motion changes the sign convention. Each failure needs a different fix, so the controller should log the state that produced the command.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track cross-track error, heading error, lookahead distance, curvature command, speed cap reason, target-index jump size, transform age, command age, actuator saturation, and path-density gaps. Those metrics reveal whether the controller is failing because of geometry, timing, vehicle limits, or upstream planning.',
        'A rollout should include replay traces for cornering, straight tracking, start/stop, reverse if supported, sparse paths, localization noise, and stale transforms. The controller is simple enough that unexplained behavior is a process failure, not an acceptable mystery.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study DWB Velocity Lattice Trajectory Critic for sampled velocity scoring, MPC Receding Horizon Trajectory Controller for horizon optimization, Nav2 Costmap Inflation Layer for obstacle-aware cost fields, Kalman Filter Sensor Fusion for pose estimates, A* Search for global route planning, and RRT* Motion Planning Tree for sampling-based planning.',
        'In a course, place pure pursuit after coordinate frames and before MPC. It shows how far a compact geometric data structure can go, and it prepares students to understand why more expensive controllers add constraints, costs, and horizons.',
      ],
    },
  ],
};
