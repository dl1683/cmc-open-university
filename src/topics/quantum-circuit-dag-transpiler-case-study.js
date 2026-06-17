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
      heading: 'Why this exists',
      paragraphs: [
        'A quantum circuit drawn in a textbook is an abstract program. It names logical qubits and gates, but real hardware has a small native gate set, limited qubit connectivity, timing constraints, measurement rules, and calibration data that changes over time. A circuit that is mathematically valid can still be impossible or poor to run on a particular machine.',
        'A transpiler is the compiler layer between the abstract circuit and the device. It rewrites the circuit until every operation is expressible in the backend basis, every two-qubit interaction fits the coupling map, and every measurement or classical dependency keeps the same meaning. The hard part is doing that while avoiding unnecessary depth and error.',
        'This topic belongs in a data-structures curriculum because the compiler is not mainly a list rewriter. Its central representation is a dependency graph. Once the circuit is a DAG, ordinary compiler questions become graph questions: what depends on what, what can move, what can cancel, what sits on the critical path, and where hardware routing adds work.',
      ],
    },
    {
      heading: 'Why the obvious approach fails',
      paragraphs: [
        'The obvious approach is to keep the circuit as an ordered list and rewrite it from left to right. That is fine for tiny examples, but it hides the real structure. Two adjacent lines in the list may touch unrelated qubits and be freely reorderable. Two far-apart operations may be locked together by a shared qubit, measurement bit, reset, or condition.',
        'A flat list also makes hardware routing look local when it is not. Inserting a SWAP before one CX changes where logical states live for every later operation. A local fix can create or remove future routing costs. The compiler needs a representation that can show dependencies, layout state, and critical-path consequences at the same time.',
        'The failure mode is not only performance. A rewrite can silently change behavior if it ignores measurements, classical bits, parameterized gates, or calibrations. Quantum transpilation must preserve semantics before it tries to improve anything.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The circuit DAG is the central invariant. Each operation node carries gate name, qubits, classical bits, parameters, conditions, and calibration metadata. Edges say that one operation must happen before another because they share a resource or dependency. A pass may rewrite the graph only if the new graph has the same observable circuit meaning.',
        'That invariant separates legal freedom from accidental textual order. Gates on independent qubits can often move or schedule in parallel. Rotations on the same axis may merge. Neighboring inverse gates may cancel. Measurements, resets, and classical control usually constrain movement because they expose or use information outside the unitary part of the circuit.',
        'A good mental model is compiler IR plus physics. The graph is not just a prettier circuit diagram. It is the object that lets the compiler prove what it is allowed to change.',
      ],
    },
    {
      heading: 'DAG mechanism',
      paragraphs: [
        'The transpiler first parses the circuit into operation nodes and dependency edges. For each qubit and classical bit, it remembers the latest operation that touched that resource. A new operation depends on those latest operations, then becomes the new latest operation for its resources. The result is acyclic because every edge points from earlier dependency to later use.',
        'Analysis passes compute facts over the DAG: which nodes are on the critical path, which operations commute, which qubits interact, which gates violate the backend basis, which two-qubit operations violate connectivity, and which measurements block movement. Transformation passes then rewrite regions of the graph and must preserve the recorded dependencies or replace them with equivalent ones.',
        'This is why the visual shows operation nodes, metadata, and a pass manager. The compiler is carrying two kinds of state at once: the circuit graph itself and the property set learned by analysis passes. If those facts go stale after a transformation, later passes can make bad decisions.',
      ],
    },
    {
      heading: 'Pass pipeline',
      paragraphs: [
        'Transpilation is a pipeline, not one magic optimization. A basis-decomposition pass rewrites arbitrary gates into native operations such as RZ, SX, X, CZ, or CX depending on the target. A layout pass maps logical qubits to physical qubits. A routing pass inserts SWAPs or changes layout when two-qubit gates need adjacent hardware qubits. Optimization passes cancel, commute, merge, or reschedule operations.',
        'A pass manager gives that pipeline structure. Analysis passes read the DAG and publish facts. Transformation passes edit the DAG. Validation passes check that the output still obeys basis gates, coupling constraints, timing constraints, and measurement semantics. The order matters: optimizing before routing can remove work, but routing can introduce new gates that need another optimization round.',
        'Real pipelines often repeat phases. A layout choice affects routing. Routing affects depth. Depth affects scheduling and error exposure. Scheduling can expose new cancellation opportunities or new timing conflicts. Treat the pass manager as a feedback-controlled compiler, not a one-way pretty-printer.',
      ],
    },
    {
      heading: 'Routing and layout',
      paragraphs: [
        'The routing problem starts when a two-qubit gate refers to logical qubits that are not adjacent on the device coupling graph. The mathematical operation is valid, but the hardware cannot apply it directly. The transpiler can choose a better initial layout, insert SWAPs along a path, reverse a direction if the backend permits a cheaper decomposition, or use a more global search strategy.',
        'SWAPs are not harmless plumbing. A SWAP is normally decomposed into multiple two-qubit gates, and two-qubit gates are often the noisiest operations in current devices. They also increase circuit depth, which gives decoherence more time to damage the state. A routing pass that makes the circuit executable can still make the final experiment worse.',
        'Layout is therefore a prediction problem. The compiler is trying to place logical qubits so that future interactions are cheap on the physical graph. It has to balance graph distance, error rates, readout quality, calibration freshness, and compile time. The best mapping for the next gate may be a poor mapping for the whole circuit.',
      ],
    },
    {
      heading: 'Correctness contract',
      paragraphs: [
        'A transpiled circuit is correct only if it preserves the original unitary behavior and the same measurement/classical behavior, up to the chosen hardware representation. Lower depth, fewer gates, or a nicer drawing do not matter if a measurement moves across an operation it should constrain or if a classical condition is dropped.',
        'The DAG helps because every legal rewrite can be checked against dependencies. If two gates commute under the circuit rules, moving them does not change the result. If two rotations merge into one equivalent rotation, the new node can replace the old nodes while preserving incoming and outgoing dependencies. If a gate is decomposed into basis gates, the composition must equal the original operation on the same qubits.',
        'This contract also explains why calibration-aware optimization is delicate. Using fresh error rates can improve expected success, but the rewrite must still be semantically valid. Calibration data is an objective input, not a license to change the computation.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The main cost dimensions are compile time, circuit depth, two-qubit gate count, expected error, scheduling length, and portability. Optimizing all of them at once is impossible. A pass that reduces depth may increase use of noisy qubits. A pass that minimizes estimated error may overfit a calibration snapshot. A fast preset may be the right choice for iteration and the wrong choice for a final hardware run.',
        'Search cost grows quickly because layout and routing decisions interact. A circuit with many two-qubit interactions has a large space of possible mappings and SWAP placements. Practical transpilers use heuristics, staged passes, pruning, and backend-specific presets because exhaustive search is rarely acceptable.',
        'The output should be judged by the target workload. A teaching circuit might prioritize readability. A variational algorithm might compile many similar parameterized circuits and care about reuse. A one-shot hardware experiment may spend more compile time for a better error estimate. A service compiling user circuits may need predictable latency and guardrails more than perfect optimization.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an algorithm asks for CX(q0, q3), but the device only connects physical neighbors p0-p1-p2-p3. If layout maps q0 to p0 and q3 to p3, the gate is not directly executable. The routing pass can move logical state along the path with SWAPs, perhaps making q0 and q3 adjacent at p2 and p3 before applying the CX.',
        'That fix changes the rest of the circuit. If q0 is now represented at a different physical qubit, every later operation on q0 must follow the updated layout ledger. The compiler cannot simply insert SWAP boxes and forget them. It has to update the logical-to-physical mapping, rebuild or maintain dependencies, and revalidate later two-qubit gates.',
        'A different initial layout may have avoided the SWAPs for this CX but made another interaction worse. This is the essential trade: local validity is easy; global quality is hard.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Store enough metadata on each DAG node to make rewrites auditable: operation name, ordered qubit arguments, classical arguments, parameters, conditions, calibration hooks, and measurement targets. Keep a property set for analysis results, and invalidate or recompute it when a transformation changes the graph region those results describe.',
        'Separate semantic passes from cost-model passes. Basis decomposition and dependency preservation are correctness obligations. Error-aware layout, scheduling, and cancellation are optimization choices. Mixing those concerns makes bugs harder to diagnose because a bad output might be invalid, merely suboptimal, or overfit to stale backend facts.',
        'Test passes with small circuits that stress boundaries: independent gates that can commute, gates sharing one qubit, measurements followed by classical control, resets, parameterized rotations, unsupported basis gates, non-adjacent two-qubit gates, and circuits where a SWAP changes every later layout decision.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Circuit DAG transpilation is the bridge between algorithm design and physical execution. It works well when backend constraints are explicit, calibration data is available, and the pass pipeline matches the hardware family. It also gives researchers a way to compare compilation strategies using concrete outputs: depth, two-qubit count, estimated error, and schedule length.',
        'The same idea appears outside quantum computing. Many compilers, render graphs, workflow systems, and query planners turn user intent into a dependency DAG, then run analysis and transformation passes. Quantum transpilation is a sharp case study because the cost of a bad rewrite is not just slowness; it can destroy the computation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when developers treat the backend as an abstract gate machine. Real devices have directionality, crosstalk, readout behavior, queue delay, timing constraints, and calibration drift. A circuit that looked best at compile time may be a poor fit by execution time.',
        'It also fails when the pass pipeline is opaque. If a user cannot inspect the final layout, inserted SWAPs, basis gates, depth, and measurement mapping, they cannot tell whether a bad hardware result came from the algorithm, the compiler, the device, or the noise model.',
        'Finally, the DAG abstraction has limits. Some optimizations need pulse-level or analog knowledge that is not visible in the circuit graph. The DAG is the right middle layer for many compiler passes, but it is not the entire hardware stack.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Qiskit circuit docs at https://quantum.cloud.ibm.com/docs/api/qiskit/circuit, custom transpiler pass guide at https://quantum.cloud.ibm.com/docs/guides/custom-transpiler-pass, and PassManager docs at https://quantum.cloud.ibm.com/docs/api/qiskit/qiskit.transpiler.PassManager.',
        'Study Quantum Statevector Amplitude Array for simulation, Tensor Network Circuit Contraction for alternative execution models, Surface Code Syndrome Matching for the classical control side of fault tolerance, Control Flow Graph Dominator Tree for compiler graph reasoning, Topological Sort for dependency ordering, and Render Graph Framegraph Resource Lifetimes for another pass-based DAG system.',
      ],
    },
  ],
};
