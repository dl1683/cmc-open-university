// Power grid Y-bus: buses and branches become a sparse complex admittance
// matrix used by power-flow, state-estimation, and contingency tools.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'power-grid-bus-admittance-sparse-matrix-case-study',
  title: 'Power Grid Bus Admittance Sparse Matrix Case Study',
  category: 'Systems',
  summary: 'A power-systems data-structure case study: buses, branches, shunts, transformer taps, Y-bus assembly, sparse row/column storage, island detection, and topology-version ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['ybus assembly', 'topology ledger'], defaultValue: 'ybus assembly' },
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

function gridGraph(title) {
  return graphState({
    nodes: [
      { id: 'b1', label: 'B1', x: 1.0, y: 2.2, note: 'slack' },
      { id: 'b2', label: 'B2', x: 3.2, y: 1.5, note: 'PV' },
      { id: 'b3', label: 'B3', x: 5.2, y: 3.0, note: 'PQ' },
      { id: 'b4', label: 'B4', x: 3.2, y: 5.0, note: 'PQ' },
      { id: 'tap', label: 'tap', x: 6.8, y: 1.8, note: 'xfmr' },
      { id: 'ybus', label: 'Ybus', x: 7.5, y: 3.5, note: 'CSR' },
    ],
    edges: [
      { id: 'e-b1-b2', from: 'b1', to: 'b2', weight: 'line' },
      { id: 'e-b2-b3', from: 'b2', to: 'b3', weight: 'line' },
      { id: 'e-b3-b4', from: 'b3', to: 'b4', weight: 'line' },
      { id: 'e-b4-b1', from: 'b4', to: 'b1', weight: 'line' },
      { id: 'e-b3-tap', from: 'b3', to: 'tap', weight: 'tap' },
      { id: 'e-tap-ybus', from: 'tap', to: 'ybus', weight: '' },
      { id: 'e-b2-ybus', from: 'b2', to: 'ybus', weight: '' },
    ],
  }, { title });
}

function* ybusAssembly() {
  yield {
    state: gridGraph('Network topology assembles into Y-bus'),
    highlight: { active: ['b1', 'b2', 'b3', 'b4', 'e-b1-b2', 'e-b2-b3', 'e-b3-b4', 'e-b4-b1'], found: ['ybus'] },
    explanation: 'A transmission grid is a graph, but most numerical tools consume a sparse admittance matrix. Branch admittances add off-diagonal entries; connected equipment adds diagonal terms.',
    invariant: 'The matrix must match the exact topology version used by measurements and injections.',
  };

  yield {
    state: labelMatrix(
      'Y-bus pattern',
      [
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' },
        { id: 'b3', label: 'B3' },
        { id: 'b4', label: 'B4' },
      ],
      [
        { id: 'b1', label: 'B1' },
        { id: 'b2', label: 'B2' },
        { id: 'b3', label: 'B3' },
        { id: 'b4', label: 'B4' },
      ],
      [
        ['diag', '-y12', '', '-y14'],
        ['-y21', 'diag', '-y23', ''],
        ['', '-y32', 'diag', '-y34'],
        ['-y41', '', '-y43', 'diag'],
      ],
    ),
    highlight: { active: ['b1:b2', 'b2:b3', 'b3:b4', 'b4:b1'], found: ['b1:b1', 'b2:b2', 'b3:b3', 'b4:b4'] },
    explanation: 'The sparsity pattern mirrors electrical adjacency. Off-diagonal terms record branch coupling; diagonal terms collect connected branch admittances and shunts.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'buses', min: 0, max: 10000 }, y: { label: 'nnz', min: 0, max: 100 } },
      series: [
        { id: 'dense', label: 'dense', points: [{ x: 500, y: 5 }, { x: 2000, y: 30 }, { x: 5000, y: 75 }, { x: 10000, y: 100 }] },
        { id: 'sparse', label: 'CSR', points: [{ x: 500, y: 2 }, { x: 2000, y: 8 }, { x: 5000, y: 18 }, { x: 10000, y: 35 }] },
      ],
      markers: [
        { id: 'ops', label: 'ops', x: 2000, y: 8 },
        { id: 'big', label: 'big', x: 10000, y: 35 },
      ],
    }, { title: 'Sparse storage is not optional at grid scale' }),
    highlight: { active: ['sparse'], compare: ['dense'], found: ['big'] },
    explanation: 'Operational networks are sparse. Dense matrices waste memory and make factorization expensive before the solver even starts.',
  };

  yield {
    state: labelMatrix(
      'Assembly checks',
      [
        { id: 'tap', label: 'tap' },
        { id: 'shunt', label: 'shunt' },
        { id: 'open', label: 'open' },
        { id: 'island', label: 'island' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['asym', 'xfmr'],
        ['diag', 'limit'],
        ['remove', 'status'],
        ['split', 'slack'],
      ],
    ),
    highlight: { active: ['tap:guard', 'open:guard'], found: ['island:guard'] },
    explanation: 'Topology processing is where many solver failures start. Transformer taps, shunts, open switches, and islands need explicit handling before the matrix feeds a power-flow run.',
  };
}

function* topologyLedger() {
  yield {
    state: labelMatrix(
      'Topology version row',
      [
        { id: 'breaker', label: 'break' },
        { id: 'line', label: 'line' },
        { id: 'bus', label: 'bus' },
        { id: 'ybus', label: 'Ybus' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
      ],
      [
        ['open/closed', 'topo'],
        ['in/out', 'branch'],
        ['type', 'solver'],
        ['hash', 'reuse'],
      ],
    ),
    highlight: { active: ['breaker:value', 'line:value', 'ybus:value'], compare: ['bus:why'] },
    explanation: 'Operators need to know which topology built a matrix. A stale breaker state can make a perfect solver produce the wrong answer.',
  };

  yield {
    state: gridGraph('Topology changes invalidate cached matrices'),
    highlight: { active: ['tap', 'ybus', 'e-tap-ybus'], compare: ['b1', 'b2', 'b3', 'b4'] },
    explanation: 'A tap move, switch operation, outage, or model correction changes matrix values or structure. The cache key should include topology, equipment parameters, and bus ordering.',
  };

  yield {
    state: labelMatrix(
      'Storage formats',
      [
        { id: 'csr', label: 'CSR' },
        { id: 'csc', label: 'CSC' },
        { id: 'coo', label: 'COO' },
        { id: 'blk', label: 'block' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'use', label: 'use' },
      ],
      [
        ['row scans', 'build'],
        ['factor', 'solve'],
        ['triplets', 'assemble'],
        ['phases', 'multi'],
      ],
    ),
    highlight: { active: ['coo:use', 'csc:use'], found: ['csr:fit'] },
    explanation: 'Power tools often assemble in triplet form, convert to compressed sparse storage, and then feed sparse factorization or iterative kernels.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'ybus', label: 'Ybus' },
        { id: 'pf', label: 'flow' },
        { id: 'se', label: 'state' },
        { id: 'restore', label: 'restore' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'next', label: 'next' },
      ],
      [
        ['matrix', 'Newton'],
        ['Jacobian', 'SCADA'],
        ['WLS', 'bad data'],
        ['graph', 'switches'],
      ],
    ),
    highlight: { active: ['ybus:data', 'pf:next', 'se:next'], found: ['restore:data'] },
    explanation: 'The power-grid learning path is matrix first, nonlinear solve second, measurement reconciliation third, and switching/restoration logic after that.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'ybus assembly') yield* ybusAssembly();
  else if (view === 'topology ledger') yield* topologyLedger();
  else throw new InputError('Pick a Y-bus view.');
}

export const article = {
  references: [
    { title: 'MATPOWER Manual 8.0', url: 'https://matpower.org/docs/MATPOWER-manual-8.0.pdf' },
    { title: 'MATPOWER AC Power Flow', url: 'https://matpower.app/manual/matpower/ACPowerFlow.html' },
    { title: 'MATPOWER newtonpf Reference', url: 'https://matpower.org/docs/ref/matpower5.0/newtonpf.html' },
  ],
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the Y-bus view as a compiler from grid topology to numerical state. Active branches are being translated into sparse matrix entries, found diagonal cells are self-admittance totals, and compare cells show places where topology or equipment status can change the result. A bus is an electrical node, and admittance is the complex conductance that relates voltage to current.',
        'The topology-ledger view adds provenance. A matrix hash is only meaningful with the breaker states, transformer tap settings, bus ordering, and equipment parameters that produced it. The safe inference is that a solver result is valid only for the exact topology version behind its Y-bus.',
        {type:'callout', text:`Y-bus is the compiled form of grid topology: a sparse matrix that lets numerical solvers operate on the same physical network operators see.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/8/8a/Finite_element_sparse_matrix.png', alt:'Sparse matrix pattern with black nonzero entries on a white background.', caption:`Finite element sparse matrix, by Oleg Alexandrov, Wikimedia Commons, public domain.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Operators see a grid as buses, lines, transformers, shunts, breakers, generators, and loads. Power-flow software needs equations. The bus admittance matrix, called Y-bus, turns the physical graph into the sparse linear object used inside nonlinear solvers.',
        'Y-bus is the shared foundation for AC power flow, state estimation, contingency analysis, and planning studies. If the matrix reflects a stale breaker state, the solver can return precise numbers for the wrong grid. That is worse than a visible failure because the result looks scientific.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious representation is a graph. Buses are nodes, lines and transformers are edges, and status flags live as attributes. That form is right for operator displays, island detection, and switching workflows.',
        'The next obvious representation is a dense n by n matrix because matrix equations are convenient. For n buses, every row and column pair gets a slot whether the buses are connected or not. That is simple for a four-bus example and wasteful for a real interconnection.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Real grids are sparse. A bus may connect to a handful of neighbors, not every other bus. A 10,000 bus dense complex matrix has 100,000,000 entries; if the average bus touches 4 branches, the useful nonzeros are closer to tens of thousands plus diagonals.',
        'Dense storage wastes memory before the solver starts and makes factorization touch empty structure. The wall is not only capacity. Wrong topology provenance means a cached sparse matrix can silently outlive the grid state that made it correct.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Y-bus stores only the electrical relationships that exist. Off-diagonal entries represent direct branch coupling between two buses, and diagonal entries collect the admittances connected to one bus. The sparsity pattern mirrors physical adjacency.',
        'The invariant is Kirchhoff current balance in matrix form. Multiplying Y by the voltage vector gives current injections consistent with the modeled branches, shunts, and transformer terms. Every topology edit must preserve that physical meaning or invalidate the matrix.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An assembler starts from equipment records and assigns internal bus numbers. It filters out out-of-service branches, expands transformer tap models, adds shunts and line charging, and emits triplets of row, column, and complex value. Duplicate triplets are summed because several devices can contribute to the same cell.',
        'The builder often uses coordinate form during assembly, then converts to compressed sparse row or compressed sparse column storage for numerical work. CSR is convenient for row operations; CSC is common for sparse factorization. The assembly ledger records the topology inputs so cached matrices can be reused only when the key still matches.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from local conservation. Each branch contributes a negative coupling term between its endpoint buses and positive self terms to the endpoint diagonals. Shunts add local diagonal terms. Summing all device contributions gives the nodal current equation for every bus.',
        'Sparse storage does not change the equation; it only omits zeros. If every nonzero contribution is inserted with the right bus ordering and sign convention, the sparse matrix represents the same linear operator as the dense matrix. Solver trust depends on that equality plus the recorded topology version.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Dense storage grows as n squared. Doubling buses from 10,000 to 20,000 quadruples slots from 100 million to 400 million. Sparse storage grows closer to buses plus branches, so doubling a similarly connected grid roughly doubles the stored nonzeros.',
        'The hard cost is sparse factorization, not reading the graph. Ordering, fill-in, island handling, and transformer conventions dominate runtime and correctness. A topology change that alters the nonzero pattern can force symbolic factorization again, while a value-only change may reuse more solver setup.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Y-bus is used by control-room state estimators, planning power-flow tools, contingency screeners, optimal power-flow workflows, and restoration studies. It is the bridge between network models and numerical linear algebra.',
        'MATPOWER, PYPOWER-style tools, commercial EMS platforms, and research solvers all rely on the same idea. They differ in device models and solver choices, but the sparse nodal admittance matrix remains the core compiled artifact.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Y-bus does not know whether SCADA measurements are fresh, whether a breaker indication is wrong, or whether a model parameter was entered with the wrong base. It can encode a false grid perfectly. Bad topology makes good numerical methods produce bad operations advice.',
        'Implementation failures include tap-ratio convention errors, missing line charging, shunt sign mistakes, bus-order mismatches, duplicate triplets that were not summed, islands without a reference bus, and stale cached matrices. Many of these bugs pass shape checks because the matrix still has legal dimensions.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take four buses with lines B1-B2, B2-B3, B3-B4, and B4-B1, each with series admittance 0.1 - j1.0. The sparse pattern has four diagonal entries and eight off-diagonal directed entries for the four undirected lines. A dense 4 by 4 view has 16 cells, but only 12 carry values here.',
        'If line B2-B3 opens, entries Y23 and Y32 are removed and the diagonal totals at B2 and B3 each lose that line contribution. The matrix hash and topology version must change. A state estimator using the old matrix would still compute a voltage solution, but it would solve for a line that is physically open.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MATPOWER manual at https://matpower.org/docs/MATPOWER-manual-8.0.pdf, MATPOWER AC power flow at https://matpower.app/manual/matpower/ACPowerFlow.html, and MATPOWER newtonpf reference at https://matpower.org/docs/ref/matpower5.0/newtonpf.html.',
        'Study sparse matrix storage, GraphBLAS-style sparse computation, Newton-Raphson AC power flow, weighted least-squares state estimation, disjoint set union for island detection, and contingency analysis for the operational loop around Y-bus.',
      ],
    },
  ],
};
