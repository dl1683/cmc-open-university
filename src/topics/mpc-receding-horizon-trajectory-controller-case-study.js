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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows model predictive control, or MPC, for trajectory control. MPC uses a model of the system to optimize several future steps, executes only the first control action, then repeats from the next measured state.',
        'Active cells show the current predicted horizon, compare marks constraints or solver residuals, and found marks the first command that is safe to apply now. The safe inference rule is this: the controller trusts the first action because the whole future plan was checked against constraints, but it replans before trusting the next action.',
        {type:'callout', text:'MPC makes one safe command by optimizing a short future, executing only the first step, and replanning from fresh state.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/11/MPC_scheme_basic.svg', alt:'Diagram showing measured output, reference trajectory, predicted output, and manipulated variable over a model predictive control horizon.', caption:'Basic model predictive control scheme. Image by Martin Behrendt, CC BY-SA 3.0 or GFDL, Wikimedia Commons.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Robots, vehicles, drones, and industrial plants must choose actions while respecting limits. Steering angle, acceleration, temperature, torque, lane boundaries, actuator delay, and comfort all matter at the same time.',
        'MPC exists because a controller that only reacts to the current error can choose an action that looks good now and violates a future constraint. It turns control into repeated constrained planning.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is feedback control: measure the error between current state and target, then push back proportionally or with a PID controller. That works well for many stable systems with simple constraints.',
        'For trajectory problems, immediate error is not enough. A car may need to start braking before it reaches a curve, and a drone may need to avoid a future obstacle while its current position still looks safe.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coupled future constraints. One command changes future position, velocity, and available control authority, so a locally good action can make the next few seconds impossible.',
        'Hard limits make this worse. If the controller discovers too late that it needs more braking force than the actuator can provide, no clever feedback gain can recover the missed feasibility window.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'MPC keeps a rolling horizon. At time t, it predicts states t+1 through t+N, optimizes a sequence of controls, applies only the first control, then shifts the horizon forward after a new measurement.',
        'This is why it can be both planned and reactive. The plan sees constraints ahead, while replanning absorbs model error, disturbances, and new goals.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The controller stores a dynamics model, current state estimate, reference trajectory, constraints, and a cost function. The cost usually penalizes tracking error, control effort, and rapid changes in control.',
        'At each tick, the solver builds an optimization problem over the horizon. For linear dynamics and quadratic cost, this is often a quadratic program; for nonlinear vehicles or robots, it may be a nonlinear program solved approximately under a time budget.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on feasibility and receding-horizon feedback. If the optimization problem includes the real constraints and returns a feasible sequence, then the first command satisfies the immediate constraints and belongs to a plan that can continue safely across the horizon.',
        'Replanning handles the fact that the model is imperfect. The controller does not commit to all future commands; it only uses the future sequence as a proof that the first command is not painting the system into a corner.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost grows with horizon length, state dimension, control dimension, and constraint count. A horizon of 20 with 6 state variables and 2 controls already creates hundreds of decision and constraint terms before nonlinear effects.',
        'Doubling the horizon usually more than doubles solve time because the optimization problem grows and coupling constraints stretch farther. The behavioral cost is latency: a perfect command that arrives after the control deadline is not useful.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'MPC fits autonomous driving, drone flight, robotic manipulation, chemical process control, building HVAC, power systems, and motion planning near constraints. The access pattern is repeated control with a reliable model and strict limits.',
        'It is strongest when constraints are part of the product. Comfort, safety margins, actuator bounds, energy use, and obstacle clearance can all be expressed in one optimization problem.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'MPC fails when the model is too wrong, the solver is too slow, or constraints are missing. It can also behave poorly when the horizon is too short to see a necessary maneuver.',
        'It is often the wrong tool for tiny embedded loops where a simple PID controller meets the spec with less compute and easier verification. The extra optimizer is only justified when future constraints matter.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A small vehicle travels at 12 m/s and must stay below 4 m/s before a curve 30 m ahead. With maximum braking of 3 m/s per second, stopping the excess speed needs (144 - 16) / 6 = 21.33 m, so the controller cannot wait until the curve begins.',
        'A reactive controller that waits until the curve marker may be too late after sensor and actuator delay. MPC with a 3-second horizon sees the curve, schedules braking now, applies the first braking command, then replans 100 ms later from the measured speed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: classic model predictive control texts by Rawlings, Mayne, and Diehl; survey papers on MPC for autonomous vehicles; and solver documentation for quadratic programming and nonlinear programming.',
        'Study next: state-space models, PID control, Kalman filtering, quadratic programming, constrained optimization, vehicle bicycle models, trajectory planning, and real-time scheduling.',
      ],
    },
  ],
};
