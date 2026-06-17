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
    {
      heading: 'Why this exists',
      paragraphs: [
        'A power grid operator needs a steady-state operating point before asking harder questions. Given a network model, generator settings, loads, transformer taps, and shunts, what are the voltage magnitudes and voltage angles at every bus? Are active and reactive power balanced? Are voltages within limits? Will a proposed outage or dispatch change leave the system in a plausible state?',
        'AC power flow answers that baseline question. It solves for bus voltages that satisfy nonlinear active-power and reactive-power balance equations. Many other grid studies start from this result: contingency analysis, voltage-security checks, transfer studies, optimal power flow, state estimation comparisons, restoration planning, and operator training simulations.',
        'The word "flow" can make the problem sound like routing. It is not. Power on an AC network depends on complex voltages, admittances, angle differences, and reactive behavior. The solver is finding a physically consistent electrical state, not sending packets along chosen paths.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is to write one big linear system and solve it once. Grid topology can be assembled into a sparse bus-admittance matrix, usually called Y-bus. Sparse linear algebra is mature. If power depended linearly on the unknown voltages, a single solve would be enough.',
        'A simplified DC power-flow approximation follows that spirit. It makes assumptions that remove voltage-magnitude and reactive-power complexity, then solves a linear angle problem. DC approximations are useful for some planning and market studies, but they cannot answer the full AC question. Voltage magnitudes, reactive power, losses, transformer controls, and stressed operating conditions matter in real grids.',
        'The full AC equations are nonlinear. The active and reactive injection at a bus depend on products of voltage magnitudes and trigonometric functions of angle differences. A one-shot linear solve is missing the mechanism that makes the network electrical rather than purely topological.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not just nonlinearity. It is constrained nonlinearity. Different bus types expose different unknowns and equations. The slack bus fixes voltage magnitude and reference angle while absorbing the residual active and reactive balance. A PV bus fixes active power and voltage magnitude, then solves for angle and reactive output. A PQ bus fixes active and reactive injection, then solves for voltage angle and magnitude. Isolated buses are excluded.',
        'The solver must respect those masks everywhere. The state vector, mismatch vector, Jacobian rows, Jacobian columns, update step, convergence check, and output reconstruction all need the same bus ordering. One off-by-one error in the PV/PQ mask can produce a numerical answer that looks precise and means nothing.',
        'Reactive power limits add another state transition. A generator bus may begin as PV because voltage magnitude is controlled. If its reactive output hits a limit, the bus may need to switch to PQ with reactive injection fixed at the limit. That remasking changes the equations being solved. Treating it as a cosmetic postcheck is a common way to hide bad results.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Newton-Raphson power flow turns the nonlinear problem into a sequence of sparse linear problems. At the current voltage guess, compute the mismatch between specified and calculated active and reactive power. Then build a Jacobian: the local derivative map from small voltage-state changes to small mismatch changes. Solve the linear system for a correction. Update the voltage state and repeat.',
        'The Jacobian is not an arbitrary matrix. Its four main blocks record partial derivatives: active power with respect to voltage angles, active power with respect to voltage magnitudes, reactive power with respect to voltage angles, and reactive power with respect to voltage magnitudes. The sparsity follows network connectivity because a bus injection depends directly on electrically connected buses through Y-bus terms.',
        'The insight is local linearization plus sparse structure. Newton supplies the correction direction. The grid topology supplies sparsity. Bus-type masks decide which parts of the correction exist. Convergence gates decide whether the local corrections have actually reached a balance point.',
      ],
    },
    {
      heading: 'How the solver works',
      paragraphs: [
        'A typical run starts by assembling or loading Y-bus, the complex bus-admittance matrix. It prepares specified net injections and bus-type lists. It chooses an initial voltage vector, often a flat start for a new case or a warm start from a nearby solved case. The slack angle sets the reference frame; all other angles are relative to it.',
        'At each iteration, the solver computes calculated bus injections from the current complex voltages and Y-bus. It subtracts calculated injections from specified injections to form the mismatch vector. For a standard polar Newton method, active-power mismatches are included for PV and PQ buses, while reactive-power mismatches are included for PQ buses. The slack bus is not solved as an unknown.',
        'The solver then builds the Jacobian blocks using the same masks. It solves `J dx = mismatch`, where `dx` contains angle corrections for non-slack buses and voltage-magnitude corrections for PQ buses. After applying `dx`, it checks the mismatch norm against tolerance and stops if the solution is good enough. If not, it repeats until convergence or a maximum-iteration guard fires.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Newton-Raphson works because a differentiable nonlinear function is locally close to its first-order Taylor expansion. Near a valid solution, the mismatch function can be approximated by `mismatch + J dx`. Choosing `dx` from the linear solve aims to drive that local approximation toward zero.',
        'When the starting point is close enough, the Jacobian is nonsingular, and the model is well conditioned, Newton updates can converge quickly. In power systems that often means only a few iterations for a normal operating point. Warm starts help because operators usually study related cases: a line outage, load change, dispatch change, or tap adjustment near a known solved base case.',
        'The correctness condition is practical rather than absolute. A converged solution means the modeled injections balance under the modeled topology and solver tolerances. It does not prove the field system is in that state. Bad telemetry, stale topology, wrong device parameters, or bad load assumptions can all produce a converged but misleading study.',
      ],
    },
    {
      heading: 'Worked case',
      paragraphs: [
        'Imagine a contingency tool studying a line outage. The base case has already solved. The tool removes one branch from the topology, rebuilds or updates Y-bus, and uses the base-case voltages as a warm start. It then runs Newton iterations on the changed network. Each iteration records mismatch norm, step norm, bus-type changes, factorization status, and stopping reason.',
        'If the run converges, downstream checks can inspect bus voltages, branch flows, generator reactive outputs, and thermal violations. If it does not converge, the result should not be a vague red badge. The trace should point to candidate causes: islanding after the outage, an impossible load pocket, a bad initial guess, a generator hitting reactive limits, an ill-conditioned Jacobian, or invalid model data.',
        'This is where the solver becomes an operational system. The numerical loop produces an answer, but the run record determines whether operators and planners can trust or debug that answer. A failed solve with a useful diagnosis is more valuable than a silent non-converged result that downstream tools accidentally consume.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The expensive step is the sparse linear solve. Mismatch evaluation is important, but factorization and ordering of the Jacobian usually dominate on large networks. The exact cost depends on network sparsity, ordering strategy, fill-in during factorization, bus masks, and whether related cases can reuse symbolic structure.',
        'When the network grows, cost does not scale like a dense matrix of all buses against all buses. The grid is sparse, so good solvers exploit sparse storage and sparse factorization. But sparsity is not free. Fill-in can still grow, and stressed or ill-conditioned cases can require more iterations or more careful damping and limit handling.',
        'Warm starts change behavior. A flat start may be fine for a small or normal case. A warm start from a nearby solved operating point can reduce iterations across contingency sweeps. A bad warm start can also hurt if topology or bus roles changed enough that the old state is misleading. Production solvers should record initialization source because it explains both speed and failure modes.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Non-convergence is evidence. It can mean the physical study case has no feasible operating point under the assumptions. It can also mean the model is wrong. Islanding, isolated buses, disconnected load pockets, impossible reactive requirements, bad transformer data, inconsistent generator limits, stale topology, and poor initialization can all surface as a failing Newton loop.',
        'A singular or nearly singular Jacobian is a strong warning. It may point to an island without a reference, a voltage-collapse-adjacent condition, or a modeling error. Large oscillating steps suggest that the local linear model is not guiding the solver toward a solution. Repeated PV-to-PQ switching can show reactive-limit stress or bad limit settings.',
        'A converged result can still fail operationally. The voltage profile may violate limits. A branch may overload. A generator may sit at a reactive limit that requires operator action. A downstream study may require a stricter tolerance than the default run used. The power-flow result is an input to engineering judgment, not the end of the workflow.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the indexing contract explicit. Store the external bus ids, internal ordering, slack/PV/PQ masks, isolated-bus list, and mapping back to user-facing ids. Build tests around mask alignment because many solver bugs are not formula bugs; they are row and column membership bugs.',
        'Record a run ledger. Useful fields include case id, topology hash, Y-bus version, base MVA, solver method, tolerance, maximum iterations, initialization source, Q-limit policy, iteration mismatch norms, step norms, factorization warnings, final convergence flag, stopping reason, final mismatch, voltage violations, flow violations, and whether downstream tools are allowed to use the result.',
        'Treat reactive limit handling as a state machine. If a PV bus switches to PQ, record the reason, the limit hit, and the iteration. Decide whether to restart the Newton loop, continue with remasked equations, or use a solver option from the chosen library. The important part is that the decision is explicit and reproducible.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'AC power flow is the steady-state engine behind many grid tools. Operators use it to evaluate base cases and contingencies. Planners use it to study upgrades and transfer limits. Market and reliability tools use it as a foundation for more constrained optimization. State estimation uses related equations to reconcile measurements with a network model.',
        'It is the wrong tool for fast electromechanical transients, protection dynamics, harmonics, electromagnetic transients, and any study where the steady-state phasor model is not enough. It is also too detailed for some high-level screening tasks where a DC approximation is acceptable and the missing reactive or voltage detail does not affect the decision.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MATPOWER manual at https://matpower.org/docs/MATPOWER-manual-8.0.pdf, MATPOWER AC power flow documentation at https://matpower.app/manual/matpower/ACPowerFlow.html, and the MATPOWER `newtonpf` reference at https://matpower.org/docs/ref/matpower5.0/newtonpf.html.',
        'Study Power Grid Bus Admittance Sparse Matrix before this topic if Y-bus is unfamiliar. Study CSC Column Sparse Matrix for sparse storage, Sherman-Morrison Rank-One Update for low-rank update intuition, SCADA State Estimation for measurement reconciliation, Sparse Format Selection Compiler Lowering for sparse-kernel tradeoffs, and Distribution Feeder Outage Restoration Switching for a downstream operational workflow.',
      ],
    },
  ],
};
