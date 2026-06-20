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
  intro: {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/bb/Eiffel_Tower_and_electrical_grid.jpg', alt:'Electrical power grid infrastructure', caption:'Power flow analysis computes voltages and currents across a grid — the Newton-Raphson method solves the nonlinear equations that govern AC networks. Source: Wikimedia Commons, Taxiarchos228, CC BY-SA 3.0'},
  references: [
    { title: 'MATPOWER Manual 8.0', url: 'https://matpower.org/docs/MATPOWER-manual-8.0.pdf' },
    { title: 'MATPOWER AC Power Flow', url: 'https://matpower.app/manual/matpower/ACPowerFlow.html' },
    { title: 'MATPOWER newtonpf Reference', url: 'https://matpower.org/docs/ref/matpower5.0/newtonpf.html' },
    { title: 'Stott & Alsac, "Fast Decoupled Load Flow," IEEE Trans. Power Apparatus and Systems, 1974', url: 'https://doi.org/10.1109/TPAS.1974.293985' },
    { title: 'Tinney & Walker, "Direct solutions of sparse network equations by optimally ordered triangular factorization," Proc. IEEE, 1967', url: 'https://doi.org/10.1109/PROC.1967.6011' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "newton loop" view shows the full solver cycle: case data feeds an initial voltage guess, mismatches are computed, the Jacobian is assembled, a linear step is solved, and a convergence gate decides whether to stop or iterate. Active nodes are the current stage of the loop. The "found" marker on the convergence gate means the tolerance test has been reached.',
        'The "jacobian blocks" view focuses on the four-block structure of the Newton Jacobian and how sparsity, bus-type masks, and factorization interact. Active blocks are the diagonal partials (dP/dang, dQ/dV); compared blocks are the off-diagonal cross-partials.',
        'In both views, the matrix displays show bus-type masks and run-record fields. Green-highlighted cells are the quantities the solver actively modifies; blue-highlighted cells are diagnostic or constraint data that shapes but does not participate in the Newton update.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'The load flow problem is the backbone problem of power system analysis. Its solution is required before any other analysis -- fault studies, stability studies, optimal dispatch, and expansion planning -- can proceed.',
          attribution: 'Stott & Alsac, "Fast Decoupled Load Flow," IEEE Trans. PAS, 1974',
        },
        'A power grid operator needs a steady-state operating point before asking harder questions. Given a network model -- generators, loads, transformer taps, shunts, and branch impedances -- what are the voltage magnitudes and angles at every bus? Are active and reactive power balanced? Are voltages within limits? Will a proposed outage or dispatch change leave the system in a plausible state?',
        'AC power flow answers that baseline question. It solves for bus voltages that satisfy nonlinear active-power and reactive-power balance equations. Nearly every other grid study starts from this result: contingency analysis, voltage-security assessment, transfer-limit studies, optimal power flow, state-estimation comparisons, restoration planning, and operator-training simulations.',
        {
          type: 'note',
          text: 'The word "flow" is misleading. Power on an AC network depends on complex voltages, admittances, angle differences, and reactive behavior. The solver finds a physically consistent electrical state, not a routing assignment. Kirchhoff and Ohm, not shortest paths.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first reasonable approach is to write one big linear system and solve it once. Grid topology assembles into a sparse bus-admittance matrix (Y-bus). Sparse linear algebra is mature. If power depended linearly on the unknown voltages, a single factorization-and-solve would be enough.',
        'A simplified DC power-flow approximation follows that spirit. It assumes voltage magnitudes are 1.0 p.u., angle differences are small (so sin(theta) is approximately theta), and reactive power can be ignored. Under those assumptions the active-power balance becomes a linear system in voltage angles alone:',
        {
          type: 'code',
          language: 'text',
          text: 'P = B_dc * theta\n\nwhere:\n  P     = vector of net active injections (generation - load) at non-slack buses\n  B_dc  = susceptance submatrix of Y-bus (real, sparse, symmetric)\n  theta = vector of voltage angles at non-slack buses\n\nOne LU factorization of B_dc, one back-substitution, done.',
        },
        'DC power flow is useful for some planning and market-clearing studies, but it cannot answer the full AC question. Voltage magnitudes, reactive power, losses, transformer controls, and stressed operating conditions matter in real grids. The full AC equations are nonlinear: the injection at each bus depends on products of voltage magnitudes and trigonometric functions of angle differences. A one-shot linear solve misses the mechanism that makes the network electrical rather than purely topological.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not just nonlinearity. It is constrained nonlinearity with state-dependent equation structure. Different bus types expose different unknowns and contribute different equations:',
        {
          type: 'table',
          headers: ['Bus type', 'Fixed quantities', 'Solved quantities', 'Equations contributed'],
          rows: [
            ['Slack (reference)', 'V, angle', 'P, Q (absorbs residual)', 'None -- sets the reference frame'],
            ['PV (generator)', 'P, |V|', 'angle, Q', 'One P-mismatch equation'],
            ['PQ (load)', 'P, Q', '|V|, angle', 'One P-mismatch + one Q-mismatch'],
            ['Isolated', 'None', 'Excluded', 'Removed from system'],
          ],
        },
        'The solver must respect those masks everywhere. The state vector, mismatch vector, Jacobian rows, Jacobian columns, update step, convergence check, and output reconstruction all need the same bus ordering. One off-by-one error in the PV/PQ mask can produce a numerical answer that looks precise and means nothing.',
        'Reactive-power limits add a state transition mid-solve. A generator bus starts as PV because its automatic voltage regulator controls voltage magnitude. If the reactive output hits a physical limit (turbine rating, field current, stability margin), the bus must switch to PQ with Q fixed at the limit. That remasking changes the equations being solved. Treating it as a cosmetic post-check is a common way to produce wrong but converged results.',
        {
          type: 'note',
          text: 'The mask contract is a data-structure problem, not a physics footnote. Most Newton power-flow bugs are not formula errors. They are row-and-column membership errors: a PV bus contributing a Q-mismatch row it should not, or a slack bus appearing in the state vector.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Newton-Raphson power flow turns the nonlinear problem into a sequence of sparse linear problems. At each iteration: compute the mismatch between specified and calculated injections, build the Jacobian (local derivative map from voltage-state changes to mismatch changes), solve the resulting linear system for a correction, and update the voltage state.',
        'The Jacobian has four main blocks, each a sparse matrix whose sparsity mirrors the grid topology:',
        {
          type: 'diagram',
          label: 'Newton Jacobian block structure',
          text: '         |  d(angle)   d(|V|)  \n    -----+------------------------\n    dP   |   J11        J12     \n         | dP/d(ang)  dP/d|V|   \n    -----+------------------------\n    dQ   |   J21        J22     \n         | dQ/d(ang)  dQ/d|V|   \n\n    J11 rows: PV + PQ buses    J11 cols: non-slack buses\n    J12 rows: PV + PQ buses    J12 cols: PQ buses only\n    J21 rows: PQ buses only    J21 cols: non-slack buses\n    J22 rows: PQ buses only    J22 cols: PQ buses only\n\n    Nonzero pattern follows Y-bus: entry (i,j) is nonzero\n    only if bus i connects to bus j or i == j.',
        },
        'The insight is local linearization plus sparse structure plus bus-type masking. Newton supplies the correction direction. The grid topology supplies sparsity. Bus-type masks decide which rows and columns exist in the assembled system. Convergence gates decide whether the correction has actually reached a balance point.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A typical run starts by assembling Y-bus from branch impedances, transformer taps, and shunt admittances. It prepares specified net injections (P_gen - P_load, Q_gen - Q_load) and bus-type lists. It sets an initial voltage vector -- often a flat start (all |V| = 1.0 p.u., all angles = 0) for a new case, or a warm start from a nearby solved case. The slack bus angle sets the reference frame.',
        {
          type: 'code',
          language: 'python',
          text: '# Core Newton loop (polar coordinates, simplified)\ndef newton_pf(Ybus, Sspec, V0, pv, pq, tol=1e-6, max_iter=20):\n    V = V0.copy()\n    for k in range(max_iter):\n        # Calculated complex power: S_calc = diag(V) * conj(Ybus * V)\n        S_calc = V * np.conj(Ybus @ V)\n        # Mismatch: specified minus calculated\n        dP = Sspec[pv_pq].real - S_calc[pv_pq].real\n        dQ = Sspec[pq].imag   - S_calc[pq].imag\n        mismatch = np.concatenate([dP, dQ])\n        if np.max(np.abs(mismatch)) < tol:\n            return V, k, "converged"\n        # Build Jacobian blocks J11, J12, J21, J22\n        J = build_jacobian(Ybus, V, pv, pq)\n        # Solve J @ dx = mismatch\n        dx = spsolve(J, mismatch)\n        # Update angles (all non-slack) and magnitudes (PQ only)\n        V[pv_pq] *= np.exp(1j * dx[:len(pv_pq)])\n        V[pq]    *= (1 + dx[len(pv_pq):])\n    return V, max_iter, "did not converge"',
        },
        'At each iteration, the solver computes calculated bus injections from the current complex voltages and Y-bus, then forms the mismatch. Active-power mismatches appear for PV and PQ buses; reactive-power mismatches appear for PQ buses only. The slack bus is never solved as an unknown.',
        'The solver builds Jacobian blocks using the same masks, solves J * dx = mismatch, and applies the correction. It checks the infinity norm of the mismatch against tolerance. If the solution is good enough, it stops. Otherwise it repeats until convergence or a maximum-iteration guard fires.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Newton-Raphson works because a differentiable nonlinear function is locally close to its first-order Taylor expansion. Near a valid solution, the mismatch function f(x) can be approximated by f(x) + J * dx. Choosing dx = -J^{-1} * f(x) aims to drive that local approximation toward zero.',
        'When the starting point is close enough and the Jacobian is nonsingular, Newton converges quadratically: the error roughly squares each iteration. For power systems, that typically means 3-6 iterations for a normal operating point. A 10,000-bus network that starts with mismatches around 1.0 p.u. often reaches 1e-8 tolerance in 4-5 iterations.',
        {
          type: 'bullets',
          items: [
            'Quadratic convergence: if the error at iteration k is epsilon, the error at k+1 is roughly C * epsilon^2. This is why Newton typically needs far fewer iterations than first-order methods like Gauss-Seidel.',
            'Warm starts exploit this: a nearby solved case puts the initial guess close to the solution, so the quadratic regime begins immediately.',
            'The convergence condition is practical, not absolute. A converged result means modeled injections balance under modeled topology and solver tolerances. It does not prove the field system is in that state.',
          ],
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a contingency-analysis tool studying a single line outage on a 5-bus system. The base case has already converged in 4 iterations. The tool removes branch 2-4 from the topology, rebuilds Y-bus, and uses the base-case voltages as a warm start.',
        {
          type: 'table',
          headers: ['Iteration', 'Max |dP| (p.u.)', 'Max |dQ| (p.u.)', 'Max |dx_angle| (rad)', 'Event'],
          rows: [
            ['0', '0.42', '0.18', '--', 'Warm start from base case'],
            ['1', '0.073', '0.031', '0.015', 'Bus 3 Q near upper limit'],
            ['2', '0.0018', '0.0009', '3.2e-4', 'Bus 3 hits Q_max, switches PV -> PQ'],
            ['3', '4.1e-5', '2.8e-5', '7.6e-6', 'Re-masked Jacobian, new PQ bus 3'],
            ['4', '2.3e-8', '1.1e-8', '4.0e-9', 'Converged (tol = 1e-6)'],
          ],
        },
        'The warm start saves iterations: a flat start on this contingency case would need 7 iterations. The PV-to-PQ switch at iteration 2 changes the equation structure mid-solve. The run record should log the switch reason (Q_max = 1.5 p.u., actual Q = 1.52 p.u.), the iteration where it happened, and the fact that the Jacobian was reassembled with a new mask.',
        'If the run had not converged, the trace should point to candidate causes: islanding after the outage, an impossible load pocket, a generator hitting reactive limits with nowhere to remask, or an ill-conditioned Jacobian near voltage collapse. A failed solve with a useful diagnosis is more valuable than a silent non-converged result that downstream tools accidentally consume.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The dominant cost per iteration is the sparse linear solve. For a grid with n buses and m branches, the Jacobian has O(n + m) nonzeros. Sparse LU factorization with good ordering (approximate minimum degree, nested dissection) typically costs O(n^{1.2} to n^{1.5}) for planar-like power grids -- far below the O(n^3) of dense factorization.',
        {
          type: 'table',
          headers: ['Network size', 'Jacobian dimension', 'Typical nonzeros', 'Iterations (normal)', 'Iterations (stressed)'],
          rows: [
            ['IEEE 14-bus', '23 x 23', '~100', '3-4', '5-7'],
            ['IEEE 118-bus', '181 x 181', '~900', '4-5', '6-10'],
            ['Polish 2383-bus', '~3,700 x 3,700', '~18,000', '4-6', '8-15'],
            ['ERCOT ~8,000-bus', '~13,000 x 13,000', '~65,000', '4-6', '10-20+'],
          ],
        },
        'Warm starts change behavior. A flat start is fine for small or normal cases. A warm start from a nearby solved operating point can cut iterations in half across contingency sweeps. A bad warm start -- where topology or bus roles changed enough that the old state is misleading -- can increase iterations or cause divergence.',
        {
          type: 'note',
          text: 'Sparsity is not free. Fill-in during factorization can grow significantly for poorly ordered or meshed networks. The ordering strategy (AMD, COLAMD, nested dissection) can change factorization cost by 2-10x on large grids. Production solvers often reuse symbolic factorization across related cases, paying the ordering cost once.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AC power flow is the steady-state engine behind most grid analysis tools:',
        {
          type: 'bullets',
          items: [
            'Energy Management Systems (EMS): operators solve power flow every few minutes to evaluate the current operating point and test "what if" contingencies.',
            'Contingency analysis (N-1, N-2): remove one or two elements, re-solve, check for voltage or thermal violations. A 10,000-bus grid with 2,000 contingencies means 2,000 Newton solves, often warm-started from the base case.',
            'Optimal Power Flow (OPF): the AC power-flow equations become equality constraints inside an optimization that minimizes cost, losses, or emissions.',
            'Planning studies: test proposed transmission upgrades, generation retirements, or load growth scenarios against AC feasibility before committing capital.',
            'State estimation: uses the same Y-bus and injection model but adds measurement reconciliation on top of the power-balance equations.',
          ],
        },
        'It is the wrong tool for fast electromechanical transients, protection-relay dynamics, harmonics, electromagnetic transients, and any study where the steady-state phasor model is insufficient. It is also too detailed for some high-level screening tasks where a DC approximation is acceptable and the missing reactive or voltage detail does not affect the decision.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Non-convergence is evidence, not just an error code. It can mean the physical case has no feasible operating point under the assumptions, or it can mean the model is wrong. Common failure modes and their diagnostic signals:',
        {
          type: 'table',
          headers: ['Failure mode', 'Diagnostic signal', 'Typical action'],
          rows: [
            ['Island without slack', 'Singular Jacobian at iteration 1', 'Run topology processor, split islands, assign slack per island'],
            ['Bad initial guess', 'Large oscillating dx, no mismatch reduction', 'Switch to flat start or use a closer warm-start case'],
            ['Reactive limit cycling', 'Repeated PV <-> PQ switching', 'Review Q-limit settings, enforce minimum iterations between switches'],
            ['Voltage collapse proximity', 'Jacobian near-singular, small eigenvalue', 'Reduce loading, check PV curves, review reactive reserves'],
            ['Bad model data', 'Converged but voltages at 2.0 p.u. or angles at 90 degrees', 'Audit impedance data, transformer taps, shunt values'],
          ],
        },
        'A converged result can still fail operationally. The voltage profile may violate limits. A branch may overload. A generator may sit at a reactive limit that requires operator action. A downstream study may require a stricter tolerance than the default run used. The power-flow result is an input to engineering judgment, not the end of the workflow.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Keep the indexing contract explicit. Store external bus IDs, internal ordering, slack/PV/PQ masks, isolated-bus list, and the mapping back to user-facing IDs. Build tests around mask alignment because most solver bugs are row-and-column membership bugs, not formula bugs.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Run record: what a production solver should log per solve\nconst runRecord = {\n  caseId:        "contingency-line-24-outage",\n  topoHash:      "a3f7c1...",       // hash of Y-bus structure\n  baseMVA:       100,\n  solverMethod:  "polar-newton",\n  tolerance:     1e-6,\n  maxIterations: 20,\n  initSource:    "warm-start-base-case-v3",\n  qLimitPolicy:  "switch-at-limit-then-restart",\n  iterations: [\n    { k: 0, maxDP: 0.42,   maxDQ: 0.18,   event: null },\n    { k: 1, maxDP: 0.073,  maxDQ: 0.031,  event: "bus3-Q-near-limit" },\n    { k: 2, maxDP: 0.0018, maxDQ: 0.0009, event: "bus3-PV-to-PQ" },\n    { k: 3, maxDP: 4.1e-5, maxDQ: 2.8e-5, event: null },\n    { k: 4, maxDP: 2.3e-8, maxDQ: 1.1e-8, event: "converged" },\n  ],\n  converged:     true,\n  stoppingReason: "mismatch < tol",\n  violations:    { voltage: [], thermal: ["branch-5-7: 102% rating"] },\n};',
        },
        'Treat reactive-limit handling as a state machine. If a PV bus switches to PQ, record the reason, the limit hit, and the iteration. Decide whether to restart the Newton loop or continue with re-masked equations. The important part is that the decision is explicit and reproducible.',
        {
          type: 'note',
          text: 'A failed solve with a useful diagnosis is more valuable than a silent non-converged result that downstream tools accidentally consume. The run record is the mechanism that turns a numerical loop into an operational system.',
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the MATPOWER manual (version 8.0) documents a mature open-source implementation. Stott and Alsac (1974) introduced the fast-decoupled variant that exploits weak coupling between P-angle and Q-voltage subsystems. Tinney and Walker (1967) established sparse factorization ordering for power networks.',
        {
          type: 'bullets',
          items: [
            'Prerequisite: Power Grid Bus Admittance Sparse Matrix -- if Y-bus assembly is unfamiliar, study this first.',
            'Prerequisite: CSC Column Sparse Matrix -- the storage format that makes Jacobian factorization practical.',
            'Extension: SCADA State Estimation -- adds measurement reconciliation on top of the power-balance model.',
            'Extension: Sherman-Morrison Rank-One Update -- low-rank Y-bus updates for branch outages without full reassembly.',
            'Alternative: Fast-Decoupled Load Flow -- trades quadratic convergence for cheaper iterations by exploiting P-angle / Q-voltage decoupling.',
            'Downstream: Distribution Feeder Outage Restoration Switching -- an operational workflow that consumes power-flow results.',
          ],
        },
      ],
    },
  ],
};
