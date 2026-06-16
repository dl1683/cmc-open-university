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
    { heading: 'What it is', paragraphs: ['The bus admittance matrix, usually called Y-bus, is the sparse complex matrix that connects bus voltages to current injections in a power network model. It is assembled from branches, transformers, shunts, bus ordering, and equipment status.', 'The same physical network can be viewed as a graph for topology and as a matrix for numerical solving. Reliable software keeps those views tied to the same topology version.'] },
    { heading: 'How it works', paragraphs: ['Each branch contributes negative off-diagonal admittance between connected buses and positive diagonal contributions at its endpoints. Shunts affect diagonal entries. Transformer taps can make entries asymmetric or change effective admittance.', 'After assembly, tools store the matrix sparsely and reuse it in AC power flow, optimal power flow, contingency analysis, and state estimation.'] },
    { heading: 'Cost and complexity', paragraphs: ['The matrix has many fewer nonzeros than a dense n by n table. Sparse structure controls memory, factorization time, and solver behavior. The hard engineering is topology hygiene: switch state, island handling, transformer model, bus numbering, and cache invalidation.'] },
    { heading: 'Complete case study', paragraphs: ['A control center receives a breaker update that opens one line. The topology processor updates branch status, rebuilds or patches Y-bus, checks for islands, assigns a slack bus for each solvable island, and stores a matrix hash. Power-flow and state-estimation runs record that hash beside their results.', 'If the state estimator later reports bad data, operators can separate measurement issues from stale topology issues by comparing measurement timestamps and topology version.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not treat Y-bus as static if breaker status, tap positions, or equipment models change. Do not ignore bus type and islanding. Do not assume the sparse format used for assembly is the best format for solving.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: MATPOWER manual at https://matpower.org/docs/MATPOWER-manual-8.0.pdf, MATPOWER newtonpf documentation at https://matpower.org/docs/ref/matpower5.0/newtonpf.html, and MATPOWER AC power flow docs at https://matpower.app/manual/matpower/ACPowerFlow.html. Study CSC Column Sparse Matrix Primer, GraphBLAS Sparse Matrix Graph Case Study, AC Power Flow Newton-Raphson Jacobian Case Study, and SCADA State Estimation Bad Data Residual Case Study next.'] },
  ],
};
