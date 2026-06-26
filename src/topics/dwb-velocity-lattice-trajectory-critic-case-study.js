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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a local robot controller choosing one command for the next control cycle. DWB means Dynamic Window Based controller, a velocity lattice is a sampled grid of possible linear and angular velocities, and a critic is a scoring function that rewards or penalizes a simulated trajectory. Active state is the candidate command under evaluation, visited state is a rollout already checked, and found state is the lowest-cost valid command.',
        'The safe inference is bounded. If a candidate trajectory collides with the current local costmap, it is invalid for this cycle. Among the sampled valid candidates, the lowest weighted critic score wins; that is not a proof of global optimal motion.',
        {type: 'callout', text: `DWB makes local navigation inspectable by sampling only reachable velocity commands, rolling out their futures, and ranking the collision-free candidates with separate critics.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A mobile robot needs a global route and a local command. The global planner can choose a path through the building, but the controller must decide the immediate velocity while respecting robot shape, acceleration limits, nearby obstacles, and sensor delay. That local decision happens many times per second.',
        'DWB exists because driving straight toward the next path point is not enough. The robot has inertia and width, and the world near the robot can change after the global path was planned. The controller needs a fast, inspectable way to choose a safe command now.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is pure path following. Pick the next point on the path, turn toward it, and drive forward. In an empty simulator with perfect localization, that can look fine.',
        'Another obvious approach is to replan globally whenever an obstacle appears. That is too slow and too coarse for local control. A map-scale planner does not naturally answer whether this exact forward-left command clears the inflated robot footprint over the next second.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is physical reachability. A command may point in a good direction but require acceleration the robot cannot produce before the next cycle. A center point may pass through a gap while the robot footprint clips a shelf.',
        'The wall is also time. The controller must decide within a control-loop budget, often tens of milliseconds. It cannot simulate every possible continuous velocity and path; it needs a bounded search over commands that are reachable from current odometry.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'DWB scores possible futures rather than headings. It samples reachable velocity commands, rolls each command forward through the robot motion model, checks the resulting poses against the costmap and footprint, and scores the valid trajectories with critics. The selected command is the best visible candidate in this local table.',
        'The dynamic window keeps the table small and physically meaningful. Critics separate concerns so obstacle clearance, path alignment, goal progress, and oscillation behavior can be tuned independently. The result is an evidence pipeline rather than a hidden steering rule.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A control cycle starts with current pose, odometry, velocity limits, acceleration limits, the local costmap, the robot footprint, the nearby global path, and sampling parameters. The trajectory generator creates candidate velocity pairs reachable soon. Each pair is integrated over a short horizon into a sequence of poses.',
        'Each rollout is checked for collision and validity before ranking. Valid trajectories receive critic scores, each score is multiplied by its weight, and the totals are compared. The command with the lowest valid total is sent to the robot base for this cycle.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The safety argument is local and model-based. For the simulated horizon, the selected trajectory has passed collision checks against the current costmap and footprint. If the map, pose, footprint, and motion model are accurate enough over that horizon, the command is locally safe by the checks the controller performed.',
        'The quality argument is comparative. DWB does not prove that no better continuous command exists. It proves only that, among sampled reachable commands that passed validity checks, the selected command had the best weighted critic score.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is samples times rollout poses times critic work. If the controller samples 20 linear velocities and 20 angular velocities, it has 400 candidates. If each candidate simulates 20 poses and runs 6 critics, the cycle can involve up to 48,000 critic-pose evaluations before early rejection.',
        'More samples can improve available choices, but they increase latency. A longer horizon sees farther, but it may trust stale obstacle data. A dense lattice with slow scoring can miss the control deadline, which is itself a safety problem.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'DWB fits differential-drive and holonomic robots moving through offices, labs, hospitals, warehouses, and classrooms. The access pattern is a known global path plus a local costmap that changes as sensors observe people, carts, doors, and shelves. Operators can inspect critic scores when behavior looks wrong.',
        'It is also useful as a control-plane teaching case. The system turns continuous motion into a finite lattice, future geometry into rollout rows, and behavior preferences into weighted scores. A failed command can be debugged by asking which stage rejected or overvalued it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DWB fails when its world model is wrong. Bad localization, stale costmaps, incorrect footprints, missing moving-obstacle prediction, or actuator behavior that differs from the simulation can make a high-scoring command unsafe. The controller can only score the candidates and world it sees.',
        'It also fails in local traps. If the lattice lacks backing up, rotating in place, or a wider arc, the controller cannot choose that behavior. Recovery behaviors and global replanning exist because a local sampled controller can run out of valid candidates.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose DWB samples 7 forward speeds and 9 angular speeds, giving 63 candidate commands. The horizon is 2.0 seconds with a simulation step of 0.1 seconds, so each candidate has 20 poses. Before critics, collision checking can inspect up to 1,260 poses.',
        'Candidate A drives at 0.4 m/s and 0.2 rad/s, stays 0.35 m from obstacles, and scores 8 obstacle, 4 path, and 3 goal for total 15. Candidate B stays closer to the path but passes 0.08 m from an obstacle and scores 40 obstacle, 1 path, and 2 goal for total 43. Candidate A wins because the weighted future is safer even though it deviates from the path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the Nav2 DWB controller documentation at https://docs.nav2.org/configuration/packages/configuring-dwb-controller.html and DWB parameter reference at https://docs.nav2.org/configuration/packages/dwb-params/controller.html. Study costmap inflation, footprint collision checking, A* or NavFn global planning, pure pursuit, model predictive control, velocity obstacles, and robot recovery behaviors next.',
      ],
    },
  ],
};
