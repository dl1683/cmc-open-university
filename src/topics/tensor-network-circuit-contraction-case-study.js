// Tensor-network circuit simulation: convert gates to tensors, wire shared
// indices, choose a contraction order, and avoid full statevector explosion.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tensor-network-circuit-contraction-case-study',
  title: 'Tensor Network Circuit Contraction Case Study',
  category: 'Systems',
  summary: 'A quantum simulation case study: gate tensors, wire indices, contraction graphs, path search, treewidth, slicing, memory peaks, and statevector-vs-tensor tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['network graph', 'contraction plan'], defaultValue: 'network graph' },
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

function tn(title) {
  return graphState({
    nodes: [
      { id: 'h', label: 'H', x: 1.0, y: 2.0, note: 'tensor' },
      { id: 'cx', label: 'CX', x: 3.2, y: 3.4, note: 'rank4' },
      { id: 'rz', label: 'RZ', x: 5.4, y: 2.0, note: 'tensor' },
      { id: 'mps', label: 'MPS', x: 5.4, y: 5.2, note: 'cut' },
      { id: 'contract', label: 'contract', x: 7.5, y: 3.4, note: 'order' },
      { id: 'amp', label: 'amp', x: 9.0, y: 3.4, note: 'result' },
    ],
    edges: [
      { id: 'e-h-cx', from: 'h', to: 'cx', weight: 'q0' },
      { id: 'e-cx-rz', from: 'cx', to: 'rz', weight: 'q1' },
      { id: 'e-cx-mps', from: 'cx', to: 'mps', weight: 'bond' },
      { id: 'e-rz-contract', from: 'rz', to: 'contract' },
      { id: 'e-mps-contract', from: 'mps', to: 'contract' },
      { id: 'e-contract-amp', from: 'contract', to: 'amp' },
    ],
  }, { title });
}

function* networkGraph() {
  yield {
    state: tn('A circuit becomes tensors and shared indices'),
    highlight: { active: ['h', 'cx', 'rz', 'e-h-cx', 'e-cx-rz'], compare: ['contract'] },
    explanation: 'Tensor-network simulation replaces a flat 2^n statevector with a graph of tensors. Gates are tensors; wires are shared indices.',
  };
  yield {
    state: labelMatrix(
      'Tensor objects',
      [
        { id: 'gate1', label: '1q gate' },
        { id: 'gate2', label: '2q gate' },
        { id: 'wire', label: 'wire' },
        { id: 'bond', label: 'bond' },
      ],
      [
        { id: 'rank', label: 'rank' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['2', 'small'],
        ['4', 'bigger'],
        ['index', 'connect'],
        ['dim chi', 'memory'],
      ],
    ),
    highlight: { found: ['gate1:rank', 'gate2:rank', 'wire:rank', 'bond:cost'] },
    explanation: 'The graph can be compact when entanglement is limited. Bond dimensions grow when the circuit creates strong nonlocal correlations.',
    invariant: 'Contraction cost depends on graph structure, not only qubit count.',
  };
  yield {
    state: tn('Entangling gates increase bond pressure'),
    highlight: { active: ['cx', 'mps', 'e-cx-mps'], compare: ['h', 'rz'] },
    explanation: 'A chain of local gates may be cheap for tensor networks. Entangling gates across cuts increase bond dimensions and can erase the advantage.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'depth', min: 0, max: 10 }, y: { label: 'bond', min: 0, max: 64 } },
      series: [
        { id: 'local', label: 'local', points: [{ x: 0, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 8 }, { x: 6, y: 8 }, { x: 8, y: 16 }] },
        { id: 'all', label: 'all2all', points: [{ x: 0, y: 2 }, { x: 2, y: 8 }, { x: 4, y: 24 }, { x: 6, y: 48 }, { x: 8, y: 64 }] },
      ],
      markers: [
        { id: 'boom', x: 8, y: 64, label: 'peak' },
      ],
    }),
    highlight: { active: ['local'], compare: ['all', 'boom'] },
    explanation: 'Tensor networks are excellent when circuit topology and entanglement stay structured. Random all-to-all circuits quickly become expensive.',
  };
}

function* contractionPlan() {
  yield {
    state: tn('Contraction order controls memory peak'),
    highlight: { active: ['contract', 'amp', 'e-contract-amp'], found: ['h', 'cx', 'rz'], compare: ['mps'] },
    explanation: 'A contraction order says which tensors to multiply and sum first. The same network can be easy or impossible depending on intermediate tensor sizes.',
  };
  yield {
    state: labelMatrix(
      'Plan choices',
      [
        { id: 'left', label: 'left' },
        { id: 'greedy', label: 'greedy' },
        { id: 'tree', label: 'tree' },
        { id: 'slice', label: 'slice' },
      ],
      [
        { id: 'memory', label: 'mem' },
        { id: 'time', label: 'time' },
      ],
      [
        ['high', 'ok'],
        ['mid', 'fast plan'],
        ['low?', 'search'],
        ['lower', 'more jobs'],
      ],
    ),
    highlight: { active: ['greedy:memory', 'tree:memory', 'slice:memory'], compare: ['left:memory'] },
    explanation: 'Path search, slicing, and task scheduling trade memory for more contractions. The best plan depends on hardware and circuit shape.',
  };
  yield {
    state: labelMatrix(
      'Statevector vs TN',
      [
        { id: 'sv', label: 'statevec' },
        { id: 'tn', label: 'tensor net' },
        { id: 'mps', label: 'MPS' },
        { id: 'slice', label: 'sliced TN' },
      ],
      [
        { id: 'best', label: 'best for' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['small n', '2^n mem'],
        ['structured', 'path hard'],
        ['1D low ent', 'bad cuts'],
        ['large jobs', 'many tasks'],
      ],
    ),
    highlight: { found: ['tn:best', 'mps:best', 'slice:best'], compare: ['sv:risk'] },
    explanation: 'There is no universally best simulator. Statevectors are simple and exact for small n; tensor networks exploit structure but need contraction planning.',
  };
  yield {
    state: tn('Final result may be one amplitude, sample, or observable'),
    highlight: { active: ['contract', 'amp', 'e-contract-amp'], compare: ['h', 'cx'] },
    explanation: 'A tensor-network simulator can compute selected amplitudes or observables without materializing the full statevector, which is often the entire point.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'network graph') yield* networkGraph();
  else if (view === 'contraction plan') yield* contractionPlan();
  else throw new InputError('Pick a tensor-network view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'A full statevector stores one complex amplitude for every basis state. That is exact and simple, but memory doubles with each qubit. A 40-qubit vector is already far beyond a laptop. The brute-force representation treats every circuit as if it needs the full wavefunction at every step.',
        'Many circuits have more structure than that. Gates are local. Wires connect specific qubits. Some circuits create little entanglement across certain cuts. Tensor networks try to exploit that structure by representing the circuit as a graph of tensors and shared indices rather than one flat 2^n array.',
        'The goal is not to make quantum simulation easy in general. It is to avoid the statevector explosion when the circuit graph and the requested output allow the sums to be rearranged cheaply.',
        {type:'callout', text:'Tensor-network simulation replaces qubit-count panic with a contraction-order problem over graph structure and requested outputs.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/79/Tensor_train.png', alt:'Tensor train diagram showing a high-order tensor decomposed into a chain of smaller tensors.', caption:'Tensor train technique. Image: AtellK, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Each gate is a tensor. Each wire is an index. Connecting tensors says that the shared index must be summed over. Simulation becomes a contraction-order problem: multiply and sum tensors in an order that keeps intermediate tensors small.',
        'The cost is not just qubit count. It depends on circuit topology, entanglement, contraction path, slicing strategy, and what output you ask for.',
        'This is why tensor networks are a systems topic as much as a quantum topic. The mathematical expression is fixed, but the runtime depends on graph layout, memory peaks, scheduling, and whether the requested result lets the simulator avoid materializing the whole state.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the network-graph view, read gates as tensors and wires as shared indices. A connected wire means "sum over this index when the neighboring tensors are contracted." The graph is a compact way to write the same linear algebra the circuit would perform on a statevector.',
        'In the contraction-plan view, watch the order. The same network can be cheap or impossible depending on which tensors are multiplied first. The animation is teaching a data-structure lesson: graph shape and elimination order determine intermediate memory.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build the network from the circuit. Pick a contraction plan. Contract tensors pair by pair or in groups. When an index is internal to the contracted region, sum it out. Keep open only the indices needed for the requested result.',
        'A shallow nearest-neighbor circuit may contract like a matrix product state with small bonds. A random all-to-all circuit can create large intermediate tensors and lose the advantage.',
        'If the target is one amplitude, many output indices can be fixed early. If the target is an expectation value, the network may include the circuit, its conjugate, and the observable. If the target is samples, the simulator may contract conditionally as bits are sampled. The requested output changes the best contraction strategy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Tensor contraction is the same linear algebra as statevector simulation, just factored differently. Instead of materializing the whole vector after every gate, the simulator delays and rearranges sums. If the rearranged sums keep intermediates small, memory drops.',
        'This is exact up to numerical error when no approximation is introduced. Approximate tensor-network methods add truncation, which buys speed and memory by discarding small singular values or low-weight structure.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The peak intermediate tensor size is the practical memory bill. A bad contraction path can exhaust memory even when a better path would fit. Slicing reduces peak memory by splitting an index into many independent subproblems, but it increases total work.',
        'This is why contraction planning is part of the algorithm, not a preprocessing detail. The same circuit graph can be easy or impossible depending on the chosen path.',
        'Treewidth is the rough graph concept behind the cost. Low-treewidth networks can be contracted with small intermediates. High-treewidth networks force large tensors no matter how clever the implementation is. Real systems also care about GPU memory, distributed scheduling, contraction reuse, and numeric precision.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Tensor networks work well for low-depth, low-entanglement, local, or structured circuits and for queries that need selected amplitudes or observables instead of a full statevector.',
        'They also win when the circuit has a natural geometry: one-dimensional chains, shallow two-dimensional grids, repeated local layers, or circuits where a cut separates weakly entangled regions. In those cases the tensor graph keeps the useful locality that the statevector flattens away.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tensor networks fail to save much when the circuit creates broad entanglement across the graph. In that case the network contracts into large dense tensors, and statevector simulation may be simpler or faster.',
        'They can also fail operationally. Path search can be expensive, memory estimates can be wrong, slicing can create too many jobs, and approximations can bias results. A tensor-network simulator needs a contraction ledger: path, peak memory estimate, slices, floating-point type, truncation policy, and validation target.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious simulator stores the entire statevector and applies every gate directly. That baseline is excellent for small qubit counts because it is simple, exact, and has predictable memory layout.',
        'The wall is exponential memory. Adding one qubit doubles the state. Tensor networks try to avoid that wall by keeping the circuit factored and contracting only the pieces needed for the requested output.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Treat contraction planning as a first-class artifact. Store the chosen path, estimated FLOPs, peak intermediate size, slicing dimensions, task count, precision, and any truncation thresholds. Without that ledger, performance and accuracy problems are hard to reproduce.',
        'Validate on small circuits where statevector results are available, then scale. Compare amplitudes, observables, or sample statistics depending on the output mode. If approximation is used, report the truncation policy and an error diagnostic rather than only runtime.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'Imagine a circuit on a line of qubits with nearest-neighbor gates. The tensor graph is also close to a line. Contracting left to right can keep the bond dimension modest if entanglement stays local. The simulator avoids materializing a full 2^n state because it only carries the boundary tensor across the cut.',
        'Now add many long-range entangling gates. The graph becomes highly connected. Any cut crosses many wires, so the intermediate tensor needs many open indices. The tensor network has not failed mathematically; the circuit has removed the structure the method depends on.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A simulator is asked for one amplitude of a 60-qubit shallow grid circuit. A statevector would need the full 2^60 state, which is impossible on ordinary hardware. A tensor-network plan can fix input and output indices, contract local patches, and slice a few high-pressure bonds into many smaller jobs.',
        'The same simulator may fail on a deeper all-to-all random circuit. Entanglement spreads across many cuts, the contraction path produces huge intermediates, and slicing creates too many tasks. The lesson is not that tensor networks are weak; it is that their strength depends on exploitable structure.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Do not compare simulators only by qubit count. Depth, topology, entanglement, observable type, output count, and allowed approximation often dominate. A 50-qubit structured circuit can be easy while a 35-qubit dense circuit is hard.',
        'Approximate contraction can hide error if the truncation ledger is missing. Path search can also overfit to an estimate that ignores hardware communication. A production simulator should report memory peaks, contraction path, slice count, precision, and validation evidence with the result.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PennyLane tensor-network simulation demo at https://pennylane.ai/demos/tutorial_How_to_simulate_quantum_circuits_with_tensor_networks and the Jet paper at https://quantum-journal.org/papers/q-2022-05-09-709/.',
        'Study Quantum Statevector Amplitude Array for the baseline simulator, Sparse Format Selection for representation tradeoffs, Tensor Parallelism for distributed tensor work, GraphBLAS Sparse Matrix Graph Case Study for graph-linear-algebra structure, and Matrix Chain Multiplication for the simpler contraction-order analogy.',
      ],
    },
  ],
};
