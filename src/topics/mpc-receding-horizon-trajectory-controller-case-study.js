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
    explanation: 'Model predictive control uses the current state and a vehicle model to predict a finite future horizon, solve for the best control sequence, apply only the first command, then repeat on the next cycle.',
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
    explanation: 'The horizon is a structured buffer: predicted states, reference points, control variables, and constraints at each time step.',
  };

  yield {
    state: mpcGraph('Warm starts shift the previous solution'),
    highlight: { active: ['qp', 'warm', 'e-qp-warm', 'e-warm-qp'], found: ['constraints'], compare: ['plant'] },
    explanation: 'The next optimization can start from the previous control sequence shifted forward. Warm starts reduce solve time and smooth commands when the world changes gradually.',
  };

  yield {
    state: controlPlot(),
    highlight: { active: ['new', 'apply'], compare: ['prev'] },
    explanation: 'The first control is applied now; the rest is only a forecast. On the next cycle, new state, path, and obstacle information can change the whole planned sequence.',
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
    explanation: 'A controller should log the optimization problem, not just the output command. Objectives, dynamics, constraints, status, iterations, and solve time explain behavior.',
  };

  yield {
    state: mpcGraph('Constraints turn control into safe optimization'),
    highlight: { active: ['constraints', 'qp', 'u0', 'e-constraints-qp', 'e-qp-u0'], compare: ['ref'] },
    explanation: 'MPC can encode steering limits, acceleration limits, jerk penalties, lateral error bounds, velocity limits, and obstacle-related constraints in the same horizon.',
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
    explanation: 'On a lane bend, the MPC sees curvature ahead and begins steering smoothly before pure cross-track error becomes large. The command is proactive because the horizon contains future reference points.',
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
    explanation: 'MPC failures are often solver and model failures: too slow, infeasible, badly weighted, or built on a model that no longer matches the vehicle.',
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
    { heading: 'What it is', paragraphs: ['Model predictive control, or MPC, is a receding-horizon controller. It predicts future states with a model, solves a constrained optimization problem, applies the first control, then repeats with fresh state.', 'For robot and vehicle path tracking, MPC is useful because it can reason about future curvature, steering limits, acceleration limits, smoothness, and tracking error in one horizon.'] },
    { heading: 'How it works', paragraphs: ['At each control cycle, estimate the current state, select reference path points across the horizon, linearize or apply a vehicle model, build objectives and constraints, solve a QP or nonlinear program, apply the first command, and shift the solution as the next warm start.', 'Autoware documents a linear MPC lateral controller whose optimization is formulated as a Quadratic Program: https://autowarefoundation.github.io/autoware_universe/main/control/autoware_mpc_lateral_controller/. Its MPC algorithm note describes solving an optimization problem during each control cycle and using the resulting command sequence to control the system: https://autowarefoundation.github.io/autoware.universe_planning/pr-5583/control/mpc_lateral_controller/model_predictive_control_algorithm/.'] },
    { heading: 'Complete case study', paragraphs: ['An autonomous vehicle approaches a lane bend. Pure pursuit reacts to a lookahead point. MPC sees several path points ahead, predicts where the vehicle will be after each steering command, penalizes large steering changes, respects steering bounds, and begins a smooth turn before cross-track error grows.', 'If the QP is solved in 8 ms and the control cycle is 30 ms, the controller has budget. If it sometimes takes 45 ms, the command arrives late and the car tracks stale state. Solver latency belongs in the control ledger.'] },
    { heading: 'Data structures', paragraphs: ['The controller stores state vector, covariance or state quality, reference horizon, vehicle-model matrices, objective weights, constraint bounds, previous solution, solver status, iteration count, solve time, selected command, and fallback command.', 'The QP ledger is the debugging object. It tells whether the car turned because the path demanded it, because weights favored smoothness, because constraints bound the solution, or because the solver failed and fallback took over. The do-mpc theory guide gives the general receding-horizon framing: https://www.do-mpc.com/en/latest/theory_mpc.html.'] },
    { heading: 'Pitfalls', paragraphs: ['A longer horizon can improve foresight but increase solve time and model error. Hard constraints can make the problem infeasible. Soft constraints improve robustness but must be penalized clearly. Bad vehicle parameters turn a mathematically clean QP into wrong motion.', 'Do not hide solver failures. Log infeasible status, max-iteration exits, stale state, warm-start resets, and fallback commands.'] },
    { heading: 'Study next', paragraphs: ['Study Pure Pursuit Lookahead Path Tracking, DWB Velocity Lattice Trajectory Critic, Kalman Filter Sensor Fusion, RRT* Motion Planning Tree, Nav2 Costmap Inflation Layer, and Value Iteration next.'] },
  ],
};
