// Quantum transpilation: represent a circuit as a DAG of operations, rewrite it
// for basis gates and hardware connectivity, and preserve measurement semantics.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'quantum-circuit-dag-transpiler-case-study',
  title: 'Quantum Circuit DAG Transpiler Case Study',
  category: 'Systems',
  summary: 'A quantum compiler case study: circuit DAGs, dependency edges, basis-gate rewriting, coupling-map routing, swap insertion, pass managers, and depth/error tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['circuit dag', 'routing passes'], defaultValue: 'circuit dag' },
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

function dag(title) {
  return graphState({
    nodes: [
      { id: 'h', label: 'H', x: 1.0, y: 2.0, note: 'q0' },
      { id: 'cx', label: 'CX', x: 3.0, y: 3.4, note: 'q0,q1' },
      { id: 'rz', label: 'RZ', x: 5.0, y: 2.0, note: 'q1' },
      { id: 'swap', label: 'SWAP', x: 5.0, y: 5.0, note: 'route' },
      { id: 'meas0', label: 'M0', x: 7.3, y: 2.0, note: 'bit0' },
      { id: 'meas1', label: 'M1', x: 7.3, y: 5.0, note: 'bit1' },
      { id: 'layout', label: 'layout', x: 3.0, y: 6.4, note: 'phys' },
    ],
    edges: [
      { id: 'e-h-cx', from: 'h', to: 'cx' },
      { id: 'e-cx-rz', from: 'cx', to: 'rz' },
      { id: 'e-cx-swap', from: 'cx', to: 'swap' },
      { id: 'e-rz-meas0', from: 'rz', to: 'meas0' },
      { id: 'e-swap-meas1', from: 'swap', to: 'meas1' },
      { id: 'e-layout-swap', from: 'layout', to: 'swap' },
    ],
  }, { title });
}

function* circuitDag() {
  yield {
    state: dag('Circuit order becomes dependency edges'),
    highlight: { active: ['h', 'cx', 'rz', 'meas0', 'e-h-cx', 'e-cx-rz', 'e-rz-meas0'], compare: ['swap'] },
    explanation: 'A quantum circuit can be represented as a DAG where operation nodes depend on earlier operations touching the same qubits or classical bits.',
  };
  yield {
    state: labelMatrix(
      'DAG node data',
      [
        { id: 'gate', label: 'gate' },
        { id: 'qargs', label: 'qargs' },
        { id: 'cargs', label: 'cargs' },
        { id: 'params', label: 'params' },
      ],
      [
        { id: 'value', label: 'val' },
        { id: 'role', label: 'role' },
      ],
      [
        ['CX', 'op'],
        ['q0,q1', 'deps'],
        ['bit0', 'meas'],
        ['theta', 'angle'],
      ],
    ),
    highlight: { found: ['gate:role', 'qargs:role', 'cargs:role', 'params:role'] },
    explanation: 'The compiler needs operation name, qubits, classical bits, parameters, conditions, and calibrations. Without that metadata, graph rewrites can silently change behavior.',
    invariant: 'Rewrites must preserve circuit semantics, not just graph shape.',
  };
  yield {
    state: dag('Independent gates can commute or schedule in parallel'),
    highlight: { active: ['rz', 'swap'], compare: ['meas0', 'meas1'], found: ['layout'] },
    explanation: 'The DAG exposes parallelism and rewrite opportunities. Passes can cancel gates, merge rotations, commute operations, or reschedule around hardware constraints.',
  };
  yield {
    state: labelMatrix(
      'Pass manager',
      [
        { id: 'basis', label: 'basis' },
        { id: 'layout', label: 'layout' },
        { id: 'route', label: 'route' },
        { id: 'opt', label: 'opt' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['any gates', 'native'],
        ['logical', 'physical'],
        ['bad edges', 'SWAPs'],
        ['deep', 'shorter'],
      ],
    ),
    highlight: { active: ['basis:output', 'layout:output', 'route:output'], found: ['opt:output'] },
    explanation: 'A pass manager is a pipeline of DAG analyses and transformations. Each pass reads properties and may rewrite the circuit.',
  };
}

function* routingPasses() {
  yield {
    state: dag('Hardware coupling map can force swaps'),
    highlight: { active: ['layout', 'swap', 'e-layout-swap', 'e-cx-swap'], compare: ['h'] },
    explanation: 'If a two-qubit gate uses logical qubits that are not adjacent on the device coupling graph, the transpiler inserts SWAPs or chooses a different layout.',
  };
  yield {
    state: labelMatrix(
      'Routing ledger',
      [
        { id: 'logical', label: 'logical' },
        { id: 'phys', label: 'phys' },
        { id: 'swap', label: 'SWAP' },
        { id: 'depth', label: 'depth' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['q0,q1', 'p2,p5'],
        ['far', 'adjacent'],
        ['0', '2'],
        ['5', '11'],
      ],
    ),
    highlight: { active: ['swap:after', 'depth:after'], compare: ['swap:before', 'depth:before'] },
    explanation: 'Routing improves hardware validity but can add depth and error. The output circuit is often worse by depth while better by executability.',
  };
  yield {
    state: dag('Measurement and classical bits constrain rewrites'),
    highlight: { active: ['meas0', 'meas1', 'e-rz-meas0', 'e-swap-meas1'], compare: ['rz', 'swap'] },
    explanation: 'Measurements, resets, and classical control create barriers for some transformations. A pass must respect dependencies beyond unitary gates.',
  };
  yield {
    state: labelMatrix(
      'Compile tradeoffs',
      [
        { id: 'depth', label: 'depth' },
        { id: 'error', label: 'error' },
        { id: 'time', label: 'compile' },
        { id: 'valid', label: 'valid' },
      ],
      [
        { id: 'goal', label: 'goal' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['lower', 'search cost'],
        ['lower', 'cal drift'],
        ['fast', 'worse circ'],
        ['required', 'overfit dev'],
      ],
    ),
    highlight: { found: ['valid:goal', 'depth:goal', 'error:goal'], compare: ['time:risk'] },
    explanation: 'Transpilation is multi-objective: basis validity, connectivity, depth, error rates, scheduling, and compile time all matter.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'circuit dag') yield* circuitDag();
  else if (view === 'routing passes') yield* routingPasses();
  else throw new InputError('Pick a quantum transpiler view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['A quantum transpiler rewrites an abstract circuit into a form that can run on a target backend. A circuit DAG is the central data structure: operation nodes, dependency edges, qubit wires, and classical-bit constraints.'] },
    { heading: 'How it works', paragraphs: ['Passes analyze and transform the DAG: decompose gates into a native basis, assign logical qubits to physical qubits, insert swaps for connectivity, optimize depth, and preserve measurement semantics.'] },
    { heading: 'Case study', paragraphs: ['A CX between non-adjacent logical qubits is valid mathematically but invalid on a particular chip. The routing pass inserts SWAPs or changes layout, increasing depth while satisfying the coupling map.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not optimize only gate count. On real hardware, calibration, connectivity, measurement order, and depth matter. Do not rewrite across measurements or classical conditions unless the semantics are preserved.'] },
    { heading: 'Why it matters', paragraphs: ['Quantum compilation is graph rewriting under hardware constraints. It links DAGs, scheduling, routing, optimization passes, and reliability economics.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: Qiskit circuit docs at https://quantum.cloud.ibm.com/docs/api/qiskit/circuit, custom transpiler pass guide at https://quantum.cloud.ibm.com/docs/guides/custom-transpiler-pass, and PassManager docs at https://quantum.cloud.ibm.com/docs/api/qiskit/qiskit.transpiler.PassManager. Study Statevector Amplitude Array, Control Flow Graph Dominator Tree, and Render Graph Framegraph next.'] },
  ],
};
