// DWB velocity lattice: sample feasible velocity commands, roll out local
// trajectories, score them with critics, and publish the best cmd_vel.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'dwb-velocity-lattice-trajectory-critic-case-study',
  title: 'DWB Velocity Lattice Trajectory Critic Case Study',
  category: 'Systems',
  summary: 'A local-planner case study: dynamic-window velocity samples, acceleration limits, trajectory rollout, collision checks, critic plugins, score aggregation, and cmd_vel selection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['velocity lattice', 'critic scoring'], defaultValue: 'velocity lattice' },
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

function dwbGraph(title) {
  return graphState({
    nodes: [
      { id: 'odom', label: 'odom', x: 0.7, y: 2.0, note: 'v,w' },
      { id: 'path', label: 'path', x: 0.7, y: 5.0, note: 'global' },
      { id: 'costmap', label: 'costmap', x: 2.2, y: 3.5, note: 'local' },
      { id: 'window', label: 'window', x: 3.8, y: 2.0, note: 'limits' },
      { id: 'sample', label: 'sample', x: 3.8, y: 5.0, note: 'lattice' },
      { id: 'rollout', label: 'rollout', x: 5.5, y: 3.5, note: 'traj' },
      { id: 'critics', label: 'critics', x: 7.1, y: 2.0, note: 'score' },
      { id: 'select', label: 'select', x: 7.1, y: 5.0, note: 'min' },
      { id: 'cmd', label: 'cmd_vel', x: 8.8, y: 3.5, note: 'control' },
    ],
    edges: [
      { id: 'e-odom-window', from: 'odom', to: 'window' },
      { id: 'e-window-sample', from: 'window', to: 'sample' },
      { id: 'e-path-rollout', from: 'path', to: 'rollout' },
      { id: 'e-costmap-rollout', from: 'costmap', to: 'rollout' },
      { id: 'e-sample-rollout', from: 'sample', to: 'rollout' },
      { id: 'e-rollout-critics', from: 'rollout', to: 'critics' },
      { id: 'e-critics-select', from: 'critics', to: 'select' },
      { id: 'e-select-cmd', from: 'select', to: 'cmd' },
    ],
  }, { title });
}

function scorePlot() {
  return plotState({
    axes: {
      x: { label: 'candidate', min: 0, max: 6 },
      y: { label: 'total cost', min: 0, max: 90 },
    },
    series: [
      { id: 'safe', label: 'best', points: [{ x: 1, y: 72 }, { x: 2, y: 48 }, { x: 3, y: 31 }, { x: 4, y: 40 }] },
      { id: 'blocked', label: 'blocked', points: [{ x: 1, y: 86 }, { x: 2, y: 82 }, { x: 3, y: 88 }, { x: 4, y: 84 }] },
    ],
    markers: [
      { id: 'chosen', x: 3, y: 31, label: 'choose' },
    ],
  });
}

function* velocityLattice() {
  yield {
    state: dwbGraph('DWB samples feasible commands from a dynamic window'),
    highlight: { active: ['odom', 'window', 'sample', 'e-odom-window', 'e-window-sample'], found: ['costmap', 'path'] },
    explanation: 'The dynamic window restricts velocity samples to commands reachable from current velocity under acceleration limits. The local planner does not evaluate arbitrary motion.',
    invariant: 'A command is legal only if the robot can reach it and the rollout is collision-free.',
  };

  yield {
    state: labelMatrix(
      'Velocity lattice',
      [
        { id: 'slowL', label: 'slow L' },
        { id: 'fast', label: 'fast' },
        { id: 'turnR', label: 'turn R' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'cmd', label: 'cmd' },
        { id: 'reach', label: 'reach' },
        { id: 'valid', label: 'valid' },
        { id: 'score', label: 'score' },
      ],
      [
        ['v=.2 w=.4', 'yes', 'yes', '44'],
        ['v=.7 w=0', 'no', 'skip', '-'],
        ['v=.3 w=-.5', 'yes', 'near obs', '82'],
        ['v=0 w=0', 'yes', 'yes', '61'],
      ],
    ),
    highlight: { active: ['slowL:score', 'stop:score'], found: ['fast:valid'], compare: ['turnR:valid'] },
    explanation: 'The lattice is small but important: linear velocity, angular velocity, acceleration reachability, simulated pose sequence, collision validity, and critic scores.',
  };

  yield {
    state: dwbGraph('Rollouts connect the lattice to the costmap'),
    highlight: { active: ['sample', 'rollout', 'costmap', 'path', 'e-sample-rollout', 'e-costmap-rollout', 'e-path-rollout'], found: ['critics'] },
    explanation: 'Each velocity sample is simulated forward. The rollout is checked against the local costmap and compared with the global path and goal heading.',
  };

  yield {
    state: labelMatrix(
      'Command artifact',
      [
        { id: 'vel', label: 'velocity' },
        { id: 'traj', label: 'traj' },
        { id: 'map', label: 'map' },
        { id: 'weights', label: 'weights' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'why', label: 'why' },
      ],
      [
        ['v,w', 'control'],
        ['poses', 'inspect'],
        ['version', 'valid'],
        ['critics', 'tuning'],
      ],
    ),
    highlight: { found: ['vel:why', 'traj:why', 'weights:why'], active: ['map:stored'] },
    explanation: 'A good debug packet stores the selected command, rejected candidates, critic weights, costmap version, footprint model, and rollout horizon.',
  };
}

function* criticScoring() {
  yield {
    state: dwbGraph('Critic plugins turn rollouts into a ranking'),
    highlight: { active: ['rollout', 'critics', 'select', 'cmd', 'e-rollout-critics', 'e-critics-select', 'e-select-cmd'], compare: ['window'] },
    explanation: 'DWB scores each rollout with critic plugins. Typical critics care about obstacle cost, path alignment, goal alignment, distance to path, and oscillation behavior.',
  };

  yield {
    state: labelMatrix(
      'Critic score sheet',
      [
        { id: 'obs', label: 'obstacle' },
        { id: 'path', label: 'path' },
        { id: 'goal', label: 'goal' },
        { id: 'osc', label: 'oscill' },
      ],
      [
        { id: 'candA', label: 'A' },
        { id: 'candB', label: 'B' },
        { id: 'weight', label: 'weight' },
      ],
      [
        ['9', '55', 'high'],
        ['18', '10', 'med'],
        ['11', '9', 'med'],
        ['0', '14', 'low'],
      ],
    ),
    highlight: { active: ['obs:candA', 'path:candB'], found: ['obs:weight'], compare: ['osc:candB'] },
    explanation: 'Candidate A is obstacle-safe but a little off path. Candidate B follows the path but runs near an obstacle. Critic weights decide which failure mode matters more.',
  };

  yield {
    state: scorePlot(),
    highlight: { active: ['safe', 'chosen'], compare: ['blocked'] },
    explanation: 'The winner is the minimum total score after invalid candidates are removed. A low score is not meaningful if the rollout used a stale map or wrong footprint.',
  };

  yield {
    state: labelMatrix(
      'Tuning symptoms',
      [
        { id: 'wobble', label: 'wobble' },
        { id: 'hug', label: 'hug wall' },
        { id: 'stuck', label: 'stuck' },
        { id: 'late', label: 'late' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['osc critic', 'raise'],
        ['obs low', 'raise obs'],
        ['window tiny', 'accel params'],
        ['horizon slow', 'shorter'],
      ],
    ),
    highlight: { active: ['wobble:fix', 'hug:fix', 'stuck:fix'], compare: ['late:fix'] },
    explanation: 'Local-planner bugs often look like personality: wobbling, wall hugging, freezing, or delayed turns. Underneath, they are critic weights, velocity limits, horizon length, and costmap freshness.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'velocity lattice') yield* velocityLattice();
  else if (view === 'critic scoring') yield* criticScoring();
  else throw new InputError('Pick a DWB local-planner view.');
}

export const article = {
  references: [
    { title: 'Nav2 DWB Controller', url: 'https://docs.nav2.org/configuration/packages/configuring-dwb-controller.html' },
    { title: 'Nav2 DWB Controller Parameters', url: 'https://docs.nav2.org/configuration/packages/dwb-params/controller.html' },
    { title: 'Nav2 Costmap Inflation Layer Case Study', url: '#nav2-costmap-inflation-layer-case-study' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['DWB is a Nav2 local controller based on the Dynamic Window Approach. It samples velocity commands, simulates short trajectories, scores them with critic plugins, and publishes the best `cmd_vel`.', 'The data-structure view is a velocity lattice plus rollout table plus critic score sheet. Each candidate command becomes a small simulated future.'] },
    { heading: 'How it works', paragraphs: ['Start from current odometry. Build a dynamic window of reachable linear and angular velocities. Roll each candidate forward for a short horizon. Reject collisions. Score remaining rollouts against obstacle costs, path alignment, goal alignment, and behavior critics. Select the lowest-cost command.', 'Nav2 describes DWB as the default controller, modified for ROS 2 using the Dynamic Window Approach, with trajectory generators and critic plugins: https://docs.nav2.org/configuration/packages/configuring-dwb-controller.html.'] },
    { heading: 'Complete case study', paragraphs: ['A robot follows a global path through a warehouse aisle while a cart blocks one side. The velocity lattice includes slow-left, straight, slow-right, stop, and rotate commands. Rollouts near the cart get high obstacle cost. Commands far from the path get path cost. The selected command bends around the cart without leaving the aisle.', 'If the robot hugs walls, obstacle cost is too low or inflation is too weak. If it freezes, the dynamic window may be too small or all candidates collide under the current footprint.'] },
    { heading: 'Data structures', paragraphs: ['Store current velocity, velocity bounds, acceleration limits, sample grid, rollout horizon, simulated poses, collision flags, critic plugin names, critic weights, individual critic scores, total score, selected command, and map version.', 'The rejected candidates are as useful as the winner. They explain whether the controller had no feasible options, poor scoring weights, or a stale local map.'] },
    { heading: 'Pitfalls', paragraphs: ['The local controller is only as good as the costmap and footprint model. A perfect critic score over stale obstacle cells is still unsafe. A bad footprint can make the robot either too timid or too aggressive.', 'Another mistake is tuning by vibe. Record candidate rollouts and critic scores so wall hugging, oscillation, and freezing can be traced to concrete weights and constraints.'] },
    { heading: 'Study next', paragraphs: ['Study Nav2 Costmap Inflation Layer, Pure Pursuit Lookahead Path Tracking, MPC Receding Horizon Trajectory Controller, A* Search, RRT* Motion Planning Tree, and Kalman Filter Sensor Fusion next.'] },
  ],
};
