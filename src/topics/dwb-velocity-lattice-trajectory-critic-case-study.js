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
    explanation: 'The highlighted path starts with the current velocity, then clips the search to commands the robot can actually reach before the next control cycle. A naive planner would score impossible velocities; DWB first makes reachability an invariant.',
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
    explanation: 'Each row is one candidate command with its audit trail: velocity, reachability, collision status, and score. Invalid rows are not worse options; they are removed before critic weights can make them look attractive.',
  };

  yield {
    state: dwbGraph('Rollouts connect the lattice to the costmap'),
    highlight: { active: ['sample', 'rollout', 'costmap', 'path', 'e-sample-rollout', 'e-costmap-rollout', 'e-path-rollout'], found: ['critics'] },
    explanation: 'The rollout step turns a command into future poses. Only after those poses touch the local costmap and reference path can the planner know whether the command is safe, aligned, and worth scoring.',
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
    explanation: 'This packet is what makes controller behavior debuggable. The chosen cmd_vel alone hides whether the runner had no legal options, a stale map, a bad footprint, or critic weights that preferred the wrong risk.',
  };
}

function* criticScoring() {
  yield {
    state: dwbGraph('Critic plugins turn rollouts into a ranking'),
    highlight: { active: ['rollout', 'critics', 'select', 'cmd', 'e-rollout-critics', 'e-critics-select', 'e-select-cmd'], compare: ['window'] },
    explanation: 'Critics turn rollout geometry into a ranking. Obstacle cost, path alignment, goal alignment, path distance, and oscillation penalties are separate signals so tuning can move one failure mode without hiding the others.',
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
    explanation: 'The score sheet shows the tradeoff directly. Candidate A buys clearance with path error; candidate B buys path alignment with obstacle risk. Critic weights encode which mistake the robot should prefer under this map.',
  };

  yield {
    state: scorePlot(),
    highlight: { active: ['safe', 'chosen'], compare: ['blocked'] },
    explanation: 'The minimum matters only inside the validity boundary. A low score from a stale costmap or wrong footprint is not a good command; it is evidence that the ranking pipeline used the wrong world model.',
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
    explanation: 'The symptom rows map visible driving behavior back to parameters. Wobble, wall hugging, freezing, and late turns usually trace to critic weights, velocity limits, horizon length, or costmap freshness rather than mysterious robot temperament.',
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
    {
      heading: 'What it is',
      paragraphs: [
        `DWB is a local navigation controller used in the Nav2 ecosystem. It is based on the Dynamic Window Approach: instead of planning a complete route from start to goal, it chooses the next safe velocity command for the robot. The global planner may already have produced a path through the building. DWB's job is narrower and more urgent. Given the robot's current velocity, acceleration limits, footprint, local costmap, and nearby segment of the global path, decide what command should be sent now.`,
        `The controller can be understood as three linked data structures. The first is a velocity lattice: sampled linear and angular velocity pairs that are reachable soon. The second is a rollout table: for each sampled command, simulate the short trajectory it would create. The third is a critic score sheet: obstacle cost, path alignment, goal alignment, oscillation behavior, and other plugin scores are combined into a ranking. The lowest valid score becomes the next command.`,
      ],
    },
    {
      heading: 'The obvious approach and wall',
      paragraphs: [
        `The obvious approach is to follow the global path directly. Pick the next point on the path, turn toward it, and drive forward. That works in an empty simulator with perfect localization and smooth dynamics. It breaks when the robot has width, inertia, acceleration limits, sensor delay, and nearby obstacles. A command that aims at the path may be physically unreachable in the next control cycle, or it may clip a shelf while the center point looks safe.`,
        `The opposite obvious approach is to replan globally whenever something changes. That is too slow and too coarse for local motion. A global planner reasons over a map-scale graph or grid; it does not naturally answer whether this exact forward-left velocity for the next second clears the inflated footprint. DWB fills the gap by turning local control into a bounded search over commands the robot can actually execute right now.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to score possible futures, not just possible headings. A velocity command is not a point decision. It produces a curve through space over a short horizon. If the controller samples many commands, rolls each one forward with the robot's kinematics, and checks those poses against the costmap, it can reject commands that would collide and rank the survivors by how well they serve the navigation task.`,
        `The dynamic window makes this search practical. It does not sample every velocity the robot could ever drive. It samples velocities reachable from the current odometry under acceleration and speed limits. That keeps the lattice small and physically meaningful. Critics then separate concerns. One critic can punish obstacle proximity, another can reward staying near the global path, another can favor progress toward the goal, and another can discourage oscillation. Tuning changes the preference ordering without rewriting the controller.`,
      ],
    },
    {
      heading: 'Mechanism and data structures',
      paragraphs: [
        `A control cycle starts with current pose, odometry, local costmap, footprint, global path segment, velocity bounds, acceleration limits, and sampling parameters. The trajectory generator creates candidate velocity commands. For each command, the controller integrates motion over a short simulation time at fixed granularity, producing a sequence of poses. Each pose can be checked against the footprint and costmap. Candidates that collide, leave valid space, or violate constraints are invalid before ranking begins.`,
        `The score sheet should be stored as structured data, not just a final number. A candidate has command values, rollout poses, validity reason, critic scores, critic weights, total score, and selected-or-rejected status. The map version and timestamps matter too, because a good score over stale obstacle data is not evidence of safety. Rejected candidates are diagnostic artifacts. If every forward command is invalid, the robot is boxed in or the footprint is too conservative. If valid commands exist but the chosen one hugs a wall, the critic weights or inflation model may be wrong.`,
        `A warehouse aisle shows why the separation matters. The global path may run down the centerline, but a cart blocks part of the aisle. Some sampled commands stay near the path and pass too close to the cart. Others drift away from the path but maintain clearance. A stop command is valid but makes no progress. The controller does not need philosophical judgment; it needs candidate rows that expose this tradeoff in numbers the robot can act on this cycle.`,
      ],
    },
    {
      heading: 'Why it works and what it costs',
      paragraphs: [
        `DWB works when the local world model is accurate enough over the rollout horizon and the command lattice is dense enough to include useful behavior. The safety argument is bounded: for the simulated horizon, a selected trajectory has passed collision checks using the current costmap and footprint. The quality argument is comparative: among the valid candidates sampled this cycle, the selected command has the best weighted critic score. It is not proof of global optimality; it is a fast local decision.`,
        `The computational cost is roughly the number of velocity samples times the number of simulated poses times the cost of footprint and critic evaluation. More samples and longer horizons can improve available choices, but they raise latency and may make the controller react to stale information. A horizon that is too short misses upcoming turns. A horizon that is too long can overtrust a local costmap whose obstacle observations will change. Practical tuning is a latency, safety, and smoothness tradeoff.`,
        `The sampled nature of the method also creates blind spots. If no candidate represents backing up, rotating in place, or taking a wider arc, DWB cannot select that behavior no matter how useful it would be. Recovery behaviors and global replanning exist because a local lattice can become empty or locally trapped. A good system treats a failed lattice as information, not as an exception to hide.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `A DWB deployment should be evaluated with evidence from the lattice and critics. Useful signals include control-loop frequency, command latency, percentage of cycles with no valid trajectory, selected command score, best rejected score, per-critic contribution, minimum obstacle clearance, path-distance error, goal progress per second, oscillation resets, recovery triggers, and costmap age. These signals tell whether the robot is failing because it lacks feasible commands, ranks feasible commands poorly, or is seeing the wrong world.`,
        `Common symptoms map to concrete causes. Wall hugging can mean obstacle or inflation costs are too weak compared with path-following critics. Freezing can mean the dynamic window is too narrow, acceleration limits are too strict, the footprint is oversized, or all rollouts collide in the local map. Wobble can mean oscillation behavior is underweighted or the path alignment terms fight heading progress. Late turns can come from a short horizon, sparse angular samples, low maximum angular velocity, or a global path that enters the local window too abruptly.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `DWB is useful for robots where fast local obstacle avoidance and path tracking matter more than globally optimal motion. Differential-drive and holonomic mobile bases in offices, labs, warehouses, hospitals, and classrooms fit the pattern well. The robot has a global path, a local costmap, moderate dynamics, and a need for explainable tuning. Critic scores are attractive because operators can see which preference dominated a command.`,
        `It is also useful as a teaching case for control-plane design. The controller turns continuous motion into a sampled lattice, turns future geometry into a table of rollouts, and turns behavior preferences into composable scoring functions. That structure is easier to inspect than a black-box policy. When a run fails, engineers can replay the candidate set and ask which stage was wrong: reachable velocity generation, collision validity, critic weighting, or sensor-derived costmap state.`,
      ],
    },
    {
      heading: 'Where it fails and what to study next',
      paragraphs: [
        `DWB fails when its assumptions are violated. A stale costmap, bad localization, wrong footprint, poor inflation radius, moving obstacles that are not represented in time, or actuator behavior that does not match the simulated model can make the best-scored command unsafe. It can also struggle in tight spaces if the lattice does not include the maneuver needed to escape, or if the scoring weights punish temporary path deviation too strongly. Local controllers cannot repair a bad global plan by themselves.`,
        `Study the Nav2 DWB controller documentation, the DWB parameter reference, costmap inflation, footprint collision checking, A* or NavFn global planning, pure pursuit, model predictive control, velocity obstacles, and recovery behaviors. The deeper lesson is that local planning is an evidence pipeline. A command should be trusted only when the candidate set, validity checks, critic scores, and world model are all visible enough to explain why that command was chosen.`,
      ],
    },
  ],
};
