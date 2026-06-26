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
        'The newton-loop view shows a solver for alternating current, or AC, power flow. AC power flow means finding voltage magnitudes and voltage angles that make generated power, consumed power, and network losses balance at every bus. Watch the loop as a feedback system: mismatch is measured, the Jacobian is built, a correction is solved, and the voltage estimate moves.',
        'The jacobian-blocks view shows the matrix used by Newton-Raphson, an iterative method that replaces a hard nonlinear problem with a local linear one. A Jacobian is a table of derivatives: each entry says how one mismatch changes when one voltage variable changes. Active cells are the derivatives being used in the current solve, while masked cells show variables that are not legal for that bus type.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'callout', text:'AC power flow is the computational foundation under every grid operation — fault analysis, stability assessment, optimal dispatch, expansion planning, and real-time monitoring all require a converged power-flow solution as their starting point. Without it, no other power systems analysis can begin.'},
        'Grid operators need a consistent electrical snapshot before they can make dispatch, outage, or safety decisions. The inputs are a network model, generator set points, loads, transformer taps, and limits. The output is a voltage magnitude and angle at each non-reference bus, plus implied branch flows and losses.',
        'The equations are nonlinear because AC power depends on products of voltages and trigonometric functions of angle differences. A bus is a connection point in the grid, and a slack bus is the reference point that absorbs the remaining active and reactive power mismatch. Without a solved power-flow case, later studies are reasoning from guesses.',
      ],


   },
    {
      heading: 'The obvious approach',
      paragraphs: [




       'The first attempt is a single linear solve. Build the bus-admittance matrix, assume voltage magnitudes stay near 1.0 per unit, assume angle differences are small, ignore reactive power, and solve for voltage angles. This is the direct current, or DC, power-flow approximation.',
        'That approximation is useful because it is sparse, fast, and often good enough for rough active-power screening. One factorization can solve a large case quickly, and contingency tools can reuse the same structure. It is a good engineering shortcut when voltage and reactive effects are not the decision point.',

     ],
    },
    {



     heading: 'The wall',
      paragraphs: [
        'The wall appears when voltage magnitude, reactive power, transformer controls, losses, or stressed operating points matter. A PV bus fixes active power and voltage magnitude, a PQ bus fixes active and reactive load, and the slack bus fixes the reference angle. Each type contributes different unknowns and equations.',

       'That means the state vector is not just all buses pasted into a matrix. The solver must keep the same bus masks in the mismatch vector, Jacobian rows, Jacobian columns, update step, and output reconstruction. A PV bus that hits a reactive limit may need to become a PQ bus mid-solve, changing the equations while the iteration is running.',

     ],
    },


   {
      heading: 'The core insight',


     paragraphs: [
        'Newton-Raphson power flow keeps the full AC equations but solves them through local linear corrections. At iteration k, the solver computes the mismatch f(x_k), builds the Jacobian J(x_k), solves J dx = -f, and applies dx to the voltage angles and magnitudes. The process repeats until the largest mismatch is below tolerance.',

       'The insight is that grid physics gives the Jacobian a sparse pattern. A bus derivative is nonzero mostly for the bus itself and its electrical neighbors, so the matrix is far smaller in practice than a dense all-to-all table. Newton supplies the correction rule; sparsity makes it affordable; bus masks make it physically legal.',

     ],

   },

   {

     heading: 'How it works',

     paragraphs: [

       'The solver starts by assembling Y-bus, the sparse admittance matrix that encodes lines, transformers, and shunts. It creates specified net injections, chooses bus masks, and initializes voltage magnitudes and angles. A flat start uses 1.0 per unit magnitudes and zero angles, while a warm start uses a nearby solved case.',

       'Each iteration computes calculated complex power from the current voltages, subtracts it from specified power, and builds the mismatch vector. Active-power mismatches are included for PV and PQ buses, while reactive-power mismatches are included only for PQ buses. The slack bus is not solved because it defines the reference frame.',

       'The Jacobian is assembled in four blocks: dP by angle, dP by voltage magnitude, dQ by angle, and dQ by voltage magnitude. The sparse linear solve produces angle updates for non-slack buses and magnitude updates for PQ buses. The convergence gate checks the largest absolute mismatch, not whether the update merely looks small.',

     ],

   },

   {

     heading: 'Why it works',

     paragraphs: [

       'The correctness argument is local linearization plus an invariant. The invariant is that every mismatch row and every state column matches the current bus-type masks. When that invariant holds, the linear solve computes a correction in exactly the variables the AC model allows to move.',

       'Near a true solution, a differentiable function is well approximated by its first derivative. If the Jacobian is nonsingular and the starting point is close enough, Newton corrections reduce the error rapidly. A converged solve means the modeled injections balance under the modeled topology and tolerance; it does not prove the field system or input data are correct.',

     ],

   },

   {

     heading: 'Cost and complexity',

     paragraphs: [

       'The dominant cost is sparse factorization of the Jacobian at each iteration. For n buses and m branches, the number of Jacobian nonzeros grows roughly with n + m, but factorization creates fill-in. Good ordering can make a 10,000-bus case practical; poor ordering can make the same case much slower.',

       'Cost behaves through iterations and fill-in, not through bus count alone. A normal warm-started case may converge in 3 to 5 iterations, while a stressed case near a voltage-collapse boundary may need many more or fail. Doubling the grid roughly doubles the raw nonzeros, but factorization cost can grow faster because the eliminated matrix becomes denser.',

     ],

   },

   {

     heading: 'Real-world uses',

     paragraphs: [

       'Energy management systems use AC power flow to evaluate the current operating point and run contingency studies. Planning tools use it to test new lines, generator retirements, load growth, and voltage-support devices. Optimal power flow uses the same balance equations as constraints while optimizing cost, losses, or emissions.',

       'The method is appropriate when steady-state phasor behavior is the right model. It is not a substitute for protection studies, electromagnetic transients, harmonics, or fast rotor-angle dynamics. The solved case is a foundation for those workflows, not an answer to every grid question.',

     ],

   },

   {

     heading: 'Where it fails',

     paragraphs: [

       'Newton can fail when the case is infeasible, islanded without a slack bus, initialized badly, or too close to a singular Jacobian. Reactive-limit cycling can also cause trouble when a generator repeatedly switches between PV and PQ status. These failures should be logged as diagnoses, not hidden behind a generic nonconvergence flag.',

       'A converged result can still be operationally bad. Voltages may violate limits, branches may overload, and a generator may sit at a reactive limit. Correct numerical balance is only the first gate; engineering constraints still need separate checks.',

     ],

   },

   {

     heading: 'Worked example',

     paragraphs: [

       'Take a 5-bus case with bus 1 as slack, bus 2 as PV, and buses 3 through 5 as PQ. A line outage changes Y-bus and the warm-start mismatch begins at max |dP| = 0.42 per unit and max |dQ| = 0.18 per unit. The tolerance is 1e-6 per unit.',

       'Iteration 1 reduces the mismatch to 0.073 and 0.031. Iteration 2 reaches 0.0018 and 0.0009, but bus 2 computes Q = 1.52 per unit against a Qmax of 1.50, so the solver fixes Q at the limit and remasks bus 2 from PV to PQ. After reassembly, iteration 3 reaches 4.1e-5 and iteration 4 reaches 2.3e-8, so the case converges.',

       'The useful run record includes the topology hash, bus masks, tolerance, iteration count, max mismatches, Q-limit event, and final violations. That record turns a numerical answer into an inspectable operating artifact. If a downstream contingency report flags branch 4-5 at 102 percent of rating, the operator can trace exactly which solved state produced that alarm.',

     ],

   },

   {

     heading: 'Sources and study next',

     paragraphs: [

       'Study MATPOWER AC power-flow documentation for a production-grade reference implementation. Read Stott and Alsac on fast-decoupled load flow to see how the P-angle and Q-voltage coupling can be approximated. Read Tinney and Walker on sparse network factorization to understand why matrix ordering is a first-class performance issue.',

       'Study next: Power Grid Bus Admittance Sparse Matrix for Y-bus construction, CSC Column Sparse Matrix for sparse storage, SCADA State Estimation for measurement reconciliation, and Distribution Feeder Outage Restoration Switching for a workflow that consumes power-flow solves.',

     ],

   },

 ],
}
;
