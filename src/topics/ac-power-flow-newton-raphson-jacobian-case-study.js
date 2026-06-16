// AC power flow: solve nonlinear bus power-balance equations with Newton
// iterations, sparse Jacobians, mismatch vectors, and bus-type constraints.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ac-power-flow-newton-raphson-jacobian-case-study',
  title: 'AC Power Flow Newton-Raphson Jacobian Case Study',
  category: 'Systems',
  summary: 'A grid-solver case study: slack/PV/PQ bus types, voltage magnitude and angle state, active/reactive mismatches, sparse Jacobian blocks, Newton steps, convergence gates, and contingency replay.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['newton loop', 'jacobian blocks'], defaultValue: 'newton loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'case', label: 'case', x: 0.8, y: 3.5, note: 'Ybus' },
      { id: 'v0', label: 'V0', x: 2.3, y: 2.0, note: 'guess' },
      { id: 'mis', label: 'mismatch', x: 4.2, y: 2.0, note: 'P/Q' },
      { id: 'jac', label: 'J', x: 5.9, y: 3.5, note: 'sparse' },
      { id: 'step', label: 'dx', x: 7.4, y: 2.0, note: 'solve' },
      { id: 'conv', label: 'gate', x: 8.6, y: 4.8, note: 'tol' },
    ],
    edges: [
      { id: 'e-case-v0', from: 'case', to: 'v0' },
      { id: 'e-v0-mis', from: 'v0', to: 'mis' },
      { id: 'e-mis-jac', from: 'mis', to: 'jac' },
      { id: 'e-jac-step', from: 'jac', to: 'step' },
      { id: 'e-step-v0', from: 'step', to: 'v0' },
      { id: 'e-step-conv', from: 'step', to: 'conv' },
    ],
  }, { title });
}

function* newtonLoop() {
  yield {
    state: loopGraph('Newton power flow iterates voltage state'),
    highlight: { active: ['case', 'v0', 'mis', 'jac', 'step', 'e-v0-mis', 'e-mis-jac', 'e-jac-step'], found: ['conv'] },
    explanation: 'AC power flow solves nonlinear power-balance equations. Newton-Raphson alternates between computing mismatches, building a sparse Jacobian, solving a linear step, and updating voltage angles and magnitudes.',
    invariant: 'The mismatch vector, state vector, Jacobian, and bus-type masks must use the same bus ordering.',
  };

  yield {
    state: labelMatrix(
      'Bus type state',
      [
        { id: 'slack', label: 'slack' },
        { id: 'pv', label: 'PV' },
        { id: 'pq', label: 'PQ' },
        { id: 'iso', label: 'iso' },
      ],
      [
        { id: 'known', label: 'known' },
        { id: 'unknown', label: 'unknown' },
      ],
      [
        ['V,ang', 'P,Q'],
        ['P,V', 'Q,ang'],
        ['P,Q', 'V,ang'],
        ['none', 'exclude'],
      ],
    ),
    highlight: { active: ['pv:unknown', 'pq:unknown'], compare: ['slack:unknown', 'iso:unknown'] },
    explanation: 'Bus types decide which quantities are fixed and which are solved. This mask is a data structure, not a footnote.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'iteration', min: 0, max: 6 }, y: { label: 'mis', min: 0, max: 1 } },
      series: [
        { id: 'good', label: 'good', points: [{ x: 0, y: 0.9 }, { x: 1, y: 0.32 }, { x: 2, y: 0.08 }, { x: 3, y: 0.01 }, { x: 4, y: 0.002 }] },
        { id: 'bad', label: 'bad', points: [{ x: 0, y: 0.9 }, { x: 1, y: 0.7 }, { x: 2, y: 0.75 }, { x: 3, y: 0.9 }, { x: 4, y: 1.0 }] },
      ],
      markers: [
        { id: 'tol', label: 'tol', x: 3, y: 0.02 },
        { id: 'div', label: 'div', x: 4, y: 1.0 },
      ],
    }, { title: 'Convergence is a measured trace' }),
    highlight: { active: ['good'], compare: ['bad'], found: ['tol', 'div'] },
    explanation: 'A solver run should emit iterations, mismatch norm, step norm, limit hits, and reason for stopping. Otherwise convergence failures become guesswork.',
  };

  yield {
    state: labelMatrix(
      'Run record',
      [
        { id: 'topo', label: 'topo' },
        { id: 'init', label: 'init' },
        { id: 'limit', label: 'limit' },
        { id: 'stop', label: 'stop' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['Y hash', 'reuse'],
        ['flat/warm', 'speed'],
        ['Q cap', 'PV->PQ'],
        ['tol/max', 'audit'],
      ],
    ),
    highlight: { active: ['topo:stores', 'stop:why'], found: ['limit:why'] },
    explanation: 'A complete run record links numerical output to topology, initialization, reactive limits, solver options, and convergence status.',
  };
}

function* jacobianBlocks() {
  yield {
    state: labelMatrix(
      'Jacobian blocks',
      [
        { id: 'j11', label: 'J11' },
        { id: 'j12', label: 'J12' },
        { id: 'j21', label: 'J21' },
        { id: 'j22', label: 'J22' },
      ],
      [
        { id: 'deriv', label: 'deriv' },
        { id: 'state', label: 'state' },
      ],
      [
        ['dP/dang', 'angle'],
        ['dP/dV', 'mag'],
        ['dQ/dang', 'angle'],
        ['dQ/dV', 'mag'],
      ],
    ),
    highlight: { active: ['j11:deriv', 'j22:deriv'], compare: ['j12:state', 'j21:state'] },
    explanation: 'The Newton Jacobian is a block matrix of partial derivatives. Its sparsity follows the grid topology plus bus-type masks.',
  };

  yield {
    state: loopGraph('Sparse factorization solves the Newton step'),
    highlight: { active: ['jac', 'step', 'e-jac-step'], compare: ['mis'], found: ['conv'] },
    explanation: 'At each iteration, the solver solves J dx = mismatch. Sparse ordering and factorization dominate performance on large grids.',
  };

  yield {
    state: labelMatrix(
      'Failure diagnosis',
      [
        { id: 'island', label: 'island' },
        { id: 'badinit', label: 'init' },
        { id: 'limit', label: 'Qlimit' },
        { id: 'model', label: 'model' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
      ],
      [
        ['singular', 'split'],
        ['large dx', 'warm'],
        ['PV fail', 'remask'],
        ['data err', 'audit'],
      ],
    ),
    highlight: { active: ['island:action', 'limit:action'], found: ['model:action'] },
    explanation: 'A non-converged run is data. The failure should point to topology, initial conditions, reactive-limit handling, or model quality.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'ybus', label: 'Ybus' },
        { id: 'jac', label: 'J' },
        { id: 'state', label: 'state' },
        { id: 'ops', label: 'ops' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'next', label: 'next' },
      ],
      [
        ['network', 'solve'],
        ['linearize', 'factor'],
        ['estimate', 'SCADA'],
        ['limits', 'restore'],
      ],
    ),
    highlight: { active: ['ybus:next', 'jac:role'], found: ['state:next'] },
    explanation: 'Power flow produces a physically consistent operating point. State estimation adds measurement reconciliation on top of that solver foundation.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'newton loop') yield* newtonLoop();
  else if (view === 'jacobian blocks') yield* jacobianBlocks();
  else throw new InputError('Pick an AC power-flow view.');
}

export const article = {
  references: [
    { title: 'MATPOWER Manual 8.0', url: 'https://matpower.org/docs/MATPOWER-manual-8.0.pdf' },
    { title: 'MATPOWER AC Power Flow', url: 'https://matpower.app/manual/matpower/ACPowerFlow.html' },
    { title: 'MATPOWER newtonpf Reference', url: 'https://matpower.org/docs/ref/matpower5.0/newtonpf.html' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['AC power flow solves for bus voltage magnitudes and angles that satisfy active and reactive power balance for a network model. It is one of the central computations in transmission planning and operations.', 'The data structures are bus-type masks, Y-bus, voltage state vectors, mismatch vectors, sparse Jacobian blocks, limit records, and convergence traces.'] },
    { heading: 'How it works', paragraphs: ['Newton-Raphson starts from an initial voltage estimate, computes active and reactive power mismatches, forms a Jacobian of derivatives, solves a sparse linear system for the state correction, updates voltages, and repeats until mismatches are small.', 'Slack, PV, PQ, and isolated buses determine which variables are fixed and which equations belong in the solve. Reactive power limits can force PV buses to become PQ-like during a run.'] },
    { heading: 'Cost and complexity', paragraphs: ['The expensive step is sparse linear solving. Matrix ordering, factorization reuse, topology changes, and warm starts all matter. The solver is also sensitive to bad models, islands, poor initialization, and limit handling.'] },
    { heading: 'Complete case study', paragraphs: ['A contingency tool studies a line outage. It updates topology, assembles Y-bus, warm-starts voltages from the base case, runs Newton iterations, records convergence, checks voltage and thermal violations, and stores the run trace for operator review.', 'If the run diverges, the trace records whether the issue is islanding, reactive limit switching, bad data, or numerical conditioning.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not treat a solved power flow as measured truth; it is model output. Do not hide convergence failures. Do not reuse a Jacobian or Y-bus after topology changes unless the cache key proves the structure is still valid.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: MATPOWER manual at https://matpower.org/docs/MATPOWER-manual-8.0.pdf, MATPOWER newtonpf documentation at https://matpower.org/docs/ref/matpower5.0/newtonpf.html, and MATPOWER AC power flow docs at https://matpower.app/manual/matpower/ACPowerFlow.html. Study Power Grid Bus Admittance Sparse Matrix Case Study, CSC Column Sparse Matrix Primer, Sherman-Morrison Rank-One Update Primer, and SCADA State Estimation Bad Data Residual Case Study next.'] },
  ],
};
