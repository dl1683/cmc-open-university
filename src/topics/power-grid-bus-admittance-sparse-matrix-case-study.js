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
      heading: 'Why this exists',
      paragraphs: [
        `A transmission grid is built from physical equipment: buses, lines, transformers, breakers, shunts, generators, and loads. Operators see topology. Numerical tools need equations. The bus admittance matrix, usually called Y-bus, is the data structure that turns the network graph into the electrical model used by solvers.`,
        `Y-bus connects bus voltages to current injections. Once assembled, it becomes the common foundation for AC power flow, state estimation, contingency analysis, optimal power flow, voltage studies, and many planning workflows. If the matrix is wrong, every downstream result can look mathematically polished while describing the wrong grid.`,
      ],
    },
    {
      heading: 'The obvious representation',
      paragraphs: [
        `The natural first model is a graph. Buses are nodes. Lines and transformers are edges. Breakers, switches, tap ratios, status flags, limits, and ownership metadata are attributes. That graph is the right shape for topology processing, island detection, switching studies, and operator displays.`,
        `Power-flow and state-estimation solvers need a different shape. They repeatedly evaluate equations, build Jacobians, and solve sparse linear systems. A graph tells you what is connected; a matrix lets the numerical engine compute currents, powers, sensitivities, residuals, and corrections. The engineering task is to preserve the graph truth while producing the matrix truth.`,
      ],
    },
    {
      heading: 'Why dense matrices fail',
      paragraphs: [
        `A dense n by n matrix is the simplest thing to imagine, but a real grid is sparse. A bus connects to a small number of neighboring buses, not to every bus in the interconnection. Most off-diagonal entries are zero because most bus pairs have no direct branch between them.`,
        `Dense storage wastes memory immediately and damages every later step. Factorization sees unnecessary zeros. Cache lines are spent on empty structure. Large studies become slower before the solver even reaches the electrical difficulty. Sparse storage is not a micro-optimization in this domain; it is the representation that matches the physics.`,
      ],
    },
    {
      heading: 'The core equation',
      paragraphs: [
        `In the nodal admittance view, bus current injections are related to bus voltages through I = YV. Each Y-bus row describes how current at one bus depends on that bus voltage and neighboring bus voltages. The diagonal entry collects the admittances connected to the bus. Off-diagonal entries describe coupling through branches.`,
        `For a simple line between bus i and bus j, the off-diagonal entries receive negative branch admittance terms, and the two diagonal entries receive positive self-admittance contributions. Shunts add to diagonals. Transformers with taps and phase shifts alter the pattern of values and may make the matrix asymmetric in practical formulations. The pattern is sparse, but the details matter.`,
      ],
    },
    {
      heading: 'Assembly mechanism',
      paragraphs: [
        `A typical assembler starts from equipment records, not from a finished matrix. It assigns internal bus numbers, filters out out-of-service branches, expands transformer models, applies tap settings, adds line charging and shunts, and emits triplets such as row, column, complex value. Duplicate triplets are summed because multiple devices can contribute to the same matrix entry.`,
        `After assembly, the triplets are converted to a compressed sparse format. COO-style triplets are convenient while building. CSR is convenient for row-oriented operations. CSC is often convenient for sparse factorization and column-oriented solver internals. Good systems distinguish the assembly format from the solver format instead of pretending one sparse layout is ideal for every stage.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The bus-admittance matrix works because it preserves Kirchhoff current balance in a sparse algebraic form. Each transmission line contributes equal and opposite relationships between the two buses it connects, and each bus diagonal accumulates the admittance touching that bus. The resulting row structure is a direct encoding of network topology, not an arbitrary table.',
        'That structure is why solvers can trust the matrix. A voltage estimate multiplied by Ybus produces current injections consistent with the modeled branches, shunts, and transformer terms. When topology changes, the safe update is to rebuild or patch the exact affected sparse entries so the algebra still matches the physical network.',
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        `The Y-bus assembly view follows the conversion from network graph to sparse matrix. The highlighted branches become off-diagonal nonzeros, while the diagonal cells accumulate local effects. The point is not that the graph disappears. The point is that the graph has been compiled into the algebraic form that solvers consume.`,
        `The topology ledger view shows the operational side. A matrix should carry provenance: topology version, breaker and branch status, transformer tap positions, bus ordering, island policy, equipment parameter version, and assembly options. Without that record, a solver result is hard to audit. You may know a voltage estimate, but not which grid it was estimated against.`,
      ],
    },
    {
      heading: 'Topology versioning',
      paragraphs: [
        `A Y-bus matrix is correct only for one exact snapshot. Open a breaker, move a tap, switch a shunt, split a bus, retire a line, or correct an equipment parameter, and either the values or the sparsity can change. The matrix is not a timeless property of the utility. It is a compiled artifact from a particular topology and model version.`,
        `This is why matrix caching must be tied to a serious key. The key should include bus ordering, branch statuses, parameters that affect admittance, tap settings, phase shifts, and any options that change assembly. Reusing a stale matrix is worse than failing fast because it can produce plausible numbers from the wrong model.`,
      ],
    },
    {
      heading: 'Island handling',
      paragraphs: [
        `Topology processing must detect islands before the solver trusts the matrix. An island with no source, no slack reference, or an impossible bus type assignment can make the numerical problem singular or meaningless. The sparse pattern can reveal disconnected components, but the operational decision is larger than graph connectivity.`,
        `A robust pipeline records which buses belong to which island, which islands are energized, which slack or reference bus was assigned, and which measurements or injections were excluded. This matters in restoration and contingency work, where switching can intentionally create or remove islands. The matrix should not hide that topology event.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a four-bus system has lines B1-B2, B2-B3, B3-B4, and B4-B1, plus a transformer near B3. The sparse pattern has off-diagonal nonzeros for the electrically adjacent pairs and diagonal nonzeros for all four buses. If the B2-B3 line opens, the entries for that branch must be removed or changed, and the diagonal contributions at B2 and B3 must be adjusted.`,
        `A control center should store the new topology version beside the rebuilt Y-bus. A power-flow run then records that matrix hash with the solution. If a state-estimation residual later flags a measurement near B3, engineers can compare measurement time, breaker status, tap position, and matrix version before concluding that the sensor is bad. A stale topology can make a good measurement look impossible.`,
      ],
    },
    {
      heading: 'Solver consumers',
      paragraphs: [
        `AC power flow uses Y-bus to compute complex power injections from voltage magnitudes and angles. Newton-Raphson methods then build a Jacobian around those equations and solve correction steps. State estimation uses the same network model to compare SCADA or PMU measurements against a physically consistent state. Contingency analysis repeats this process across many outage scenarios.`,
        `The matrix also affects performance. If the bus ordering is stable, sparse factorization can reuse symbolic analysis when the nonzero pattern does not change. If topology changes alter the pattern, the solver may need a more expensive rebuild. This is where data-structure choices become operational latency choices.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Keep three layers separate: topology graph, assembly ledger, and solver matrix. The graph should answer what is connected and energized. The assembly ledger should explain exactly how the matrix was built. The solver matrix should be in the sparse format required by the numerical kernel. Mixing these layers makes debugging slow because an electrical error, a stale topology, and a sparse-format bug can look similar.`,
        `Build validation around invariants. Check that branch statuses were applied, shunts landed on diagonals, transformer taps were modeled with the intended convention, bus ordering matches measurement ordering, islands have reference handling, and duplicate triplets are summed. Log the number of buses, branches, islands, nonzeros, and matrix hash for every study run.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Y-bus does not know whether measurements are fresh, whether a switching action was authorized, whether a model parameter is wrong, or whether a contingency case is plausible. It is a compiled electrical model, not an operations brain. Treating it as complete state is a common source of false confidence.`,
        `Common implementation failures include stale matrix caches, wrong tap-ratio convention, forgotten line-charging terms, shunt sign errors, unsorted or duplicated sparse entries, bus-order mismatch between matrix and injections, missing island detection, and reusing a symbolic factorization after the nonzero pattern changed. Each failure can survive basic type checks because the matrix still has the right shape.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `Y-bus matters whenever a grid tool needs repeatable numerical studies over a large sparse network: load flow, voltage stability, optimal power flow, contingency screening, short-circuit variants, state estimation, restoration planning, and model validation. The larger the network, the more important it is that sparse structure and topology provenance are treated as first-class data.`,
        `It is also a good teaching bridge between graph algorithms and numerical linear algebra. The network begins as a graph, becomes a sparse matrix, feeds a nonlinear solver, and then returns to operational decisions. Students who understand that pipeline can debug both algorithmic and systems failures more effectively.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: MATPOWER manual at https://matpower.org/docs/MATPOWER-manual-8.0.pdf, MATPOWER newtonpf documentation at https://matpower.org/docs/ref/matpower5.0/newtonpf.html, and MATPOWER AC power flow documentation at https://matpower.app/manual/matpower/ACPowerFlow.html.`,
        `Study CSC Column Sparse Matrix Primer and GraphBLAS Sparse Matrix Graph Case Study for storage and sparse computation. Then study AC Power Flow Newton-Raphson Jacobian for the nonlinear solve, SCADA State Estimation for measurement reconciliation, Sherman-Morrison Rank-One Update for update intuition, and Disjoint Set Union for island-detection basics.`,
      ],
    },
  ],
};
