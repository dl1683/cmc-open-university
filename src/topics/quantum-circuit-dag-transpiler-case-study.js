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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the circuit-DAG view as a compiler graph. A quantum circuit is a program made of gates on qubits; a DAG is a directed acyclic graph where edges point from earlier dependencies to later operations. Active nodes show the operation or pass being inspected, and found nodes show legal compiler facts.',
        'In the routing-passes view, layout means the mapping from logical qubits in the program to physical qubits on the device. A SWAP exchanges the states of two qubits so later gates can fit hardware connectivity. The safe inference is that a pass may rewrite the graph only when it preserves the circuit meaning and updates the layout ledger.',
        {type:'callout', text:'Quantum transpilation works because circuit order becomes a dependency graph where each rewrite must preserve semantics before optimizing hardware fit.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/dc/Quantum_teleportation_circuit.svg', alt:'Quantum circuit diagram with qubit lines, gates, measurements, and classical control wires.', caption:'Quantum teleportation circuit, by Bender2k14, Wikimedia Commons, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A textbook quantum circuit names logical qubits and abstract gates. Real hardware has a native gate set, limited connectivity, timing rules, measurement behavior, and calibration data that changes. A mathematically valid circuit can still be impossible or poor to run on a target device.',
        'A transpiler is the compiler layer between the abstract circuit and the backend. It rewrites the program until operations fit the device while trying to reduce depth, two-qubit gate count, and expected error. The representation matters because the compiler must know what can move and what cannot.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store the circuit as a list of gates and rewrite from left to right. That works for a small drawing because the order is visible. It also matches how many people first read circuit diagrams.',
        'The list hides dependency freedom. Two adjacent gates on unrelated qubits may be reorderable, while two far-apart gates sharing a qubit may be locked. Measurements, resets, parameters, classical conditions, and calibrations make the real ordering constraints more specific than the drawing suggests.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Routing breaks local thinking. If a CX gate needs logical q0 and q3 but the hardware connects only neighbors, the compiler may insert SWAPs. Those SWAPs change where logical states live for every later gate.',
        'Optimization can also break correctness. Moving a gate across a measurement or dropping a classical condition can change the computation even if the final circuit is shorter. The wall is that hardware fit and semantic preservation must be reasoned about together.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent the circuit as a dependency DAG. Each operation node stores gate name, qubits, classical bits, parameters, conditions, and calibration hooks. Edges say that one operation must happen before another because they share a resource or information dependency.',
        'The DAG separates necessary order from accidental text order. Independent gates can move or schedule in parallel. Gates that commute can be rearranged. Inverse gates may cancel. A pass is legal only if the replacement graph has the same observable meaning.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The compiler builds the DAG by tracking the latest operation that touched each qubit and classical bit. A new operation depends on those latest operations, then becomes the latest operation for its resources. Edges always point forward, so the graph is acyclic.',
        'A pass manager runs analysis and transformation passes. Analysis computes facts such as critical path, interaction graph, basis violations, and connectivity violations. Transformation edits the DAG through basis decomposition, layout, routing, cancellation, commutation, or scheduling, then invalidates stale facts.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from dependency preservation and equivalence of rewrites. If two gates commute under the circuit rules, swapping them keeps the same unitary effect. If a gate is decomposed into native gates, the composition must equal the original operation on the same qubits.',
        'Routing correctness requires a layout invariant. After each SWAP, the compiler updates which physical qubit holds each logical state. Later gates are then applied to the updated physical locations, so the program meaning follows the logical qubits even while hardware placement changes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main costs are compile time, circuit depth, two-qubit gate count, schedule length, and expected error. Two-qubit gates are often the expensive part on current devices, so reducing one SWAP decomposition can matter more than removing several single-qubit rotations.',
        'Search grows quickly. With 20 logical qubits and a sparse device graph, initial layout alone has many possible mappings, and each routing choice changes future choices. Practical transpilers use heuristics, staged passes, pruning, and backend presets rather than exhaustive search.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Circuit-DAG transpilation is used by quantum SDKs and cloud backends before hardware execution. It lets the compiler fit a circuit to basis gates, coupling maps, timing constraints, and calibration-aware choices.',
        'The same idea appears in classical compilers, query planners, render graphs, and workflow engines. User intent becomes a dependency graph, analysis computes facts, and transformations improve cost while preserving meaning.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the backend is treated as a static gate machine. Calibration drift, crosstalk, readout errors, queue delay, pulse constraints, and timing rules can make the best compile at noon worse by execution time.',
        'It also fails when the pass pipeline is opaque. If users cannot inspect final layout, inserted SWAPs, basis gates, depth, and measurement mapping, they cannot tell whether a bad result came from the algorithm, compiler, device, or noise model.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the circuit needs CX(q0, q3), and the device has a line p0-p1-p2-p3. The initial layout maps q0 to p0 and q3 to p3, so the two qubits are distance 3 and cannot interact directly. A routing pass can insert SWAP(p0,p1) and SWAP(p1,p2), moving q0 to p2 before applying CX on adjacent p2 and p3.',
        'If one SWAP decomposes to three CX gates, two SWAPs add six extra CX gates before the intended CX. A different initial layout might have placed q0 and q3 adjacent and saved those gates, but perhaps made a later CX(q1, q2) worse. The cost is global because every local routing choice changes later layout.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Qiskit circuit documentation, Qiskit transpiler pass documentation, Qiskit PassManager documentation, and backend target documentation from the hardware provider. Verify current backend constraints before using specific gate sets or calibration fields.',
        'Study topological sort, compiler intermediate representations, control-flow graphs, render graphs, tensor-network circuit contraction, quantum statevectors, and error-correcting-code decoders next. The transferable idea is semantic rewriting under a dependency contract.',
      ],
    },
  ],
};
