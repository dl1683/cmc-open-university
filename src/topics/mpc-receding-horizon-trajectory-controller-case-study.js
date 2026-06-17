// MPC receding-horizon control: estimate state, roll a model forward across a
// finite horizon, solve a constrained QP, apply the first command, and repeat.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'mpc-receding-horizon-trajectory-controller-case-study',
  title: 'MPC Receding Horizon Trajectory Controller Case Study',
  category: 'Systems',
  summary: 'A model-predictive-control primer for robot path tracking: state estimates, horizon buffers, vehicle models, constraints, QP solve, warm starts, first-control application, and solver diagnostics.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['horizon rollout', 'qp ledger'], defaultValue: 'horizon rollout' },
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

function mpcGraph(title) {
  return graphState({
    nodes: [
      { id: 'estimate', label: 'estimate', x: 0.7, y: 3.6, note: 'x0' },
      { id: 'ref', label: 'ref path', x: 2.0, y: 1.8, note: 'N steps' },
      { id: 'model', label: 'model', x: 2.0, y: 5.4, note: 'vehicle' },
      { id: 'horizon', label: 'horizon', x: 3.8, y: 3.6, note: 'states' },
      { id: 'constraints', label: 'constraints', x: 5.5, y: 1.8, note: 'bounds' },
      { id: 'qp', label: 'QP solve', x: 5.5, y: 5.4, note: 'opt' },
      { id: 'u0', label: 'u0', x: 7.2, y: 3.6, note: 'first cmd' },
      { id: 'plant', label: 'robot', x: 8.6, y: 3.6, note: 'move' },
      { id: 'warm', label: 'warm', x: 8.6, y: 5.8, note: 'shift' },
    ],
    edges: [
      { id: 'e-est-horizon', from: 'estimate', to: 'horizon' },
      { id: 'e-ref-horizon', from: 'ref', to: 'horizon' },
      { id: 'e-model-horizon', from: 'model', to: 'horizon' },
      { id: 'e-horizon-constraints', from: 'horizon', to: 'constraints' },
      { id: 'e-horizon-qp', from: 'horizon', to: 'qp' },
      { id: 'e-constraints-qp', from: 'constraints', to: 'qp' },
      { id: 'e-qp-u0', from: 'qp', to: 'u0' },
      { id: 'e-u0-plant', from: 'u0', to: 'plant' },
      { id: 'e-plant-est', from: 'plant', to: 'estimate' },
      { id: 'e-qp-warm', from: 'qp', to: 'warm' },
      { id: 'e-warm-qp', from: 'warm', to: 'qp' },
    ],
  }, { title });
}

function controlPlot() {
  return plotState({
    axes: {
      x: { label: 'horizon step', min: 0, max: 12 },
      y: { label: 'steering', min: -0.5, max: 0.5 },
    },
    series: [
      { id: 'prev', label: 'warm start', points: [{ x: 0, y: 0.04 }, { x: 2, y: 0.12 }, { x: 4, y: 0.20 }, { x: 6, y: 0.16 }, { x: 8, y: 0.08 }] },
      { id: 'new', label: 'new solve', points: [{ x: 0, y: 0.02 }, { x: 2, y: 0.09 }, { x: 4, y: 0.15 }, { x: 6, y: 0.12 }, { x: 8, y: 0.04 }] },
    ],
    markers: [
      { id: 'apply', x: 0, y: 0.02, label: 'apply' },
    ],
  });
}

function* horizonRollout() {
  yield {
    state: mpcGraph('MPC solves a short future, then repeats'),
    highlight: { active: ['estimate', 'ref', 'model', 'horizon', 'qp', 'u0', 'plant', 'e-est-horizon', 'e-ref-horizon', 'e-model-horizon', 'e-horizon-qp', 'e-qp-u0', 'e-u0-plant'], found: ['warm'] },
    explanation: 'MPC turns one control tick into a short optimization problem. The solver predicts a finite future with the current state and vehicle model, chooses a command sequence, executes only u0, then throws the rest back into the next cycle as context.',
    invariant: 'The optimized sequence is a plan; only the first control is executed before replanning.',
  };

  yield {
    state: labelMatrix(
      'Horizon buffer',
      [
        { id: 'k0', label: 'k0' },
        { id: 'k1', label: 'k1' },
        { id: 'k2', label: 'k2' },
        { id: 'k3', label: 'k3' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'ref', label: 'ref' },
        { id: 'ctrl', label: 'ctrl' },
        { id: 'bound', label: 'bound' },
      ],
      [
        ['x0', 'p0', 'u0', 'apply'],
        ['x1', 'p1', 'u1', 'steer'],
        ['x2', 'p2', 'u2', 'accel'],
        ['x3', 'p3', 'u3', 'lat err'],
      ],
    ),
    highlight: { active: ['k0:ctrl', 'k0:bound'], found: ['k1:state', 'k2:state'] },
    explanation: 'The horizon table is the controller memory for one solve. Each column binds predicted state, reference point, control variable, and constraint so the optimizer can trade tracking, smoothness, and limits at the same time step.',
  };

  yield {
    state: mpcGraph('Warm starts shift the previous solution'),
    highlight: { active: ['qp', 'warm', 'e-qp-warm', 'e-warm-qp'], found: ['constraints'], compare: ['plant'] },
    explanation: 'The warm-start edge reuses yesterday\'s plan for today\'s solve. Shifting the previous sequence gives the optimizer a good first guess, which reduces latency and avoids command jumps when the world changes gradually.',
  };

  yield {
    state: controlPlot(),
    highlight: { active: ['new', 'apply'], compare: ['prev'] },
    explanation: 'The marker at step zero is the only control that reaches the robot. Every later point is provisional, so the next state estimate, path update, or obstacle can reshape the whole remaining sequence.',
  };
}

function* qpLedger() {
  yield {
    state: labelMatrix(
      'QP solve ledger',
      [
        { id: 'obj', label: 'objective' },
        { id: 'dyn', label: 'dynamics' },
        { id: 'bounds', label: 'bounds' },
        { id: 'status', label: 'status' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'debug', label: 'debug' },
      ],
      [
        ['track+smooth', 'weights'],
        ['A,B,c', 'model'],
        ['u,x limits', 'infeasible'],
        ['iters', 'latency'],
      ],
    ),
    highlight: { active: ['obj:stores', 'dyn:stores', 'bounds:stores'], found: ['status:debug'] },
    explanation: 'The ledger logs the problem, not just the answer. Objectives, dynamics, constraints, status, iterations, and solve time are the evidence needed to tell a good control choice from a lucky fallback.',
  };

  yield {
    state: mpcGraph('Constraints turn control into safe optimization'),
    highlight: { active: ['constraints', 'qp', 'u0', 'e-constraints-qp', 'e-qp-u0'], compare: ['ref'] },
    explanation: 'Constraints are the reason MPC exists here. Steering limits, acceleration limits, jerk penalties, lateral error bounds, velocity limits, and obstacle margins can all shape the same planned sequence before u0 is chosen.',
  };

  yield {
    state: labelMatrix(
      'Complete case: lane bend',
      [
        { id: 'state', label: 'state' },
        { id: 'path', label: 'path' },
        { id: 'solve', label: 'solve' },
        { id: 'cmd', label: 'cmd' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'result', label: 'result' },
      ],
      [
        ['pose+vel', 'x0'],
        ['curve ahead', 'horizon'],
        ['QP ok 8ms', 'u seq'],
        ['steer .08', 'apply'],
      ],
    ),
    highlight: { active: ['solve:result', 'cmd:result'], found: ['path:result'] },
    explanation: 'The lane-bend case shows foresight. Because the horizon already contains future curvature, MPC can begin a smooth turn before cross-track error becomes large.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'late', label: 'late solve' },
        { id: 'badmodel', label: 'bad model' },
        { id: 'infeas', label: 'infeas' },
        { id: 'jerk', label: 'jerk' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['miss cycle', 'shorter N'],
        ['drifts', 'calibrate'],
        ['no cmd', 'soft bounds'],
        ['harsh', 'penalty'],
      ],
    ),
    highlight: { active: ['late:symptom', 'infeas:symptom'], found: ['late:fix', 'jerk:fix'] },
    explanation: 'The failure rows name the usual tax. MPC can be too slow, infeasible, badly weighted, or built on a vehicle model that no longer matches the real plant.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'horizon rollout') yield* horizonRollout();
  else if (view === 'qp ledger') yield* qpLedger();
  else throw new InputError('Pick an MPC controller view.');
}

export const article = {
  references: [
    { title: 'Autoware MPC Lateral Controller', url: 'https://autowarefoundation.github.io/autoware_universe/main/control/autoware_mpc_lateral_controller/' },
    { title: 'Autoware MPC Algorithm', url: 'https://autowarefoundation.github.io/autoware.universe_planning/pr-5583/control/mpc_lateral_controller/model_predictive_control_algorithm/' },
    { title: 'do-mpc Theory', url: 'https://www.do-mpc.com/en/latest/theory_mpc.html' },
  ],
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Model predictive control, or MPC, is a receding-horizon controller. It predicts future states with a model, solves a constrained optimization problem over a short horizon, applies only the first control, then repeats with fresh state at the next control tick.',
        'For robot and vehicle path tracking, MPC is useful because it can reason about future curvature, steering limits, acceleration limits, smoothness, tracking error, and actuator bounds in one problem. Pure pursuit chooses a target point. MPC chooses a feasible sequence and then trusts only the first command.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious path tracker reacts to the current error: steer toward the path when lateral error grows, slow down when the turn looks sharp, and clamp commands when limits are exceeded. That can work at low speed, but it is always reacting after the state has already changed.',
        'The wall is foresight. A vehicle entering a bend needs to start turning before cross-track error becomes large. It must also avoid commands that would violate steering rate, acceleration, comfort, or tire limits a few steps later. MPC turns those future consequences into the current optimization problem.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is to solve a temporary proof of feasibility. The solver proposes a sequence of future controls and states that track the reference while respecting dynamics and constraints. The controller executes only the first command because the world will be measured again before the next command is chosen.',
        'That receding-horizon structure is the algorithm. MPC is not a precomputed route. It is repeated model-based replanning under time budget. The horizon gives foresight; feedback keeps the plan from becoming stale.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'Inspect MPC as three ledgers: state, optimization, and command. The state ledger says what the controller believes now. The optimization ledger says which model, weights, constraints, status, solve time, and active bounds produced the solution. The command ledger says what was applied and whether it came from the solver or fallback.',
        'Solver status is as important as the command value. A smooth steering command is useful only if it came from a feasible, timely solve over fresh state. If the solve missed the control deadline, hit max iterations, or used stale localization, the command belongs to a fallback story, not an optimal-control story.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At each control cycle, estimate the current state, select reference path points across the horizon, linearize or apply a vehicle model, build objectives and constraints, solve a quadratic program or nonlinear program, apply the first command, and shift the solution as the next warm start.',
        'Autoware documents a linear MPC lateral controller whose optimization is formulated as a Quadratic Program: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_mpc_lateral_controller/. Its MPC algorithm note describes solving an optimization problem during each control cycle and using the resulting command sequence to control the system: https://autowarefoundation.github.io/autoware.universe_planning/pr-5583/control/mpc_lateral_controller/model_predictive_control_algorithm/.',
        'The do-mpc theory guide gives the general receding-horizon framing: https://www.do-mpc.com/en/latest/theory_mpc.html. The practical lesson is that the model, objective, constraints, horizon length, and solver budget are all part of the controller, not implementation details.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The controller stores state vector, state quality, reference horizon, vehicle-model matrices, objective weights, constraint bounds, previous solution, solver status, iteration count, solve time, selected command, and fallback command. Those fields are the control-plane equivalent of a trace.',
        'The QP ledger is the debugging object. It tells whether the car turned because the path demanded it, because weights favored smoothness, because constraints bound the solution, or because the solver failed and fallback took over. Without that ledger, MPC becomes an opaque box that emits steering numbers.',
        'The reference horizon is itself a data structure. It aligns future path poses, speeds, curvature, and time offsets with predicted vehicle states. If the horizon points are sparse, stale, or expressed in the wrong frame, the optimization may solve the wrong problem perfectly. The controller should log the reference slice it solved against, not only the final command.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'An autonomous vehicle approaches a lane bend. Pure pursuit reacts to a lookahead point. MPC sees several path points ahead, predicts where the vehicle will be after each steering command, penalizes large steering changes, respects steering bounds, and begins a smooth turn before cross-track error grows.',
        'If the QP is solved in 8 ms and the control cycle is 30 ms, the controller has budget. If it sometimes takes 45 ms, the command arrives late and the car tracks stale state. Solver latency belongs in the control ledger because timing is part of correctness for a real controller.',
        'Suppose the optimization chooses steering commands u0 through u9. The controller applies u0 only, then discards most of the plan after the next localization update. That can look wasteful, but it is the point. The remaining planned controls proved that u0 was part of a feasible near future; feedback decides whether that proof still applies on the next tick.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'MPC works because it combines prediction with feedback. Prediction lets the controller account for future path curvature and constraints. Feedback prevents the plan from drifting too far from reality because the next cycle starts from a new measured state.',
        'The method also makes tradeoffs explicit. Tracking error, steering smoothness, acceleration, jerk, and constraint violations appear as weights or bounds. That does not make tuning easy, but it makes the control philosophy inspectable.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'MPC wins when future constraints matter: vehicle path tracking, robotics, process control, drone trajectory tracking, energy systems, and systems where actuator limits and smoothness cannot be bolted on after a reactive command.',
        'It is especially valuable when the same controller needs to explain why it chose a conservative command. Active constraints and objective terms can show that the command was limited by steering rate, lateral acceleration, obstacle envelope, comfort, or model confidence.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A longer horizon can improve foresight but increase solve time and model error. Hard constraints can make the problem infeasible. Soft constraints improve robustness but must be penalized clearly. Bad vehicle parameters turn a mathematically clean QP into wrong motion.',
        'MPC is also vulnerable to stale state and hidden fallbacks. Do not hide infeasible status, max-iteration exits, missed deadlines, warm-start resets, model mismatch, or fallback commands. If the controller is late, the optimal solution may already be irrelevant.',
        'The subtle failure is bad objective design. If the controller penalizes lateral error heavily but underweights steering rate, the vehicle may track the centerline with harsh commands. If it overweights comfort, it may drift wide in tight curves. Weights are product decisions encoded as math, so they need road tests and review, not blind tuning.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Track solve time, deadline misses, solver status, active constraints, warm-start reuse, fallback rate, model residual, cross-track error, heading error, steering saturation, jerk, and command age. Those signals tell whether the controller is operating as MPC or merely pretending after frequent fallbacks.',
        'For course design, teach MPC after pure pursuit and before full autonomy stacks. Students should see why the added complexity exists: not to be mathematically fancy, but to put future constraints into the present command.',
        'A useful classroom exercise is to change one weight at a time. Increase smoothness and the vehicle cuts less aggressively but may lag the path. Tighten steering bounds and the solver may become infeasible on sharp turns. Extend the horizon and foresight improves until solve time or model error becomes the limiting factor.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Pure Pursuit Lookahead Path Tracking, DWB Velocity Lattice Trajectory Critic, Kalman Filter Sensor Fusion, RRT* Motion Planning Tree, Nav2 Costmap Inflation Layer, Value Iteration, Quadratic Programming, and Constraint Satisfaction next.',
        'A good learning sequence is geometric tracking first, constrained optimization second, and full planning third. Pure pursuit shows the value of one lookahead point. MPC shows why a horizon and constraints matter. Motion planning shows where the reference itself comes from.',
      ],
    },
  ],
};
