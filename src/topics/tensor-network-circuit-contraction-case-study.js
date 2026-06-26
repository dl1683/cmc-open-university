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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each gate as a tensor, which is a multidimensional array, and each wire as an index shared between tensors. Contracting an edge means multiplying connected tensors and summing over the shared index.',
        'The safe inference rule is that the same circuit can have very different cost depending on contraction order. The graph is not just decoration; it is the data structure that decides intermediate tensor size.',
        {type:'callout', text:'Tensor-network simulation replaces qubit-count panic with a contraction-order problem over graph structure and requested outputs.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/79/Tensor_train.png', alt:'Tensor train diagram showing a high-order tensor decomposed into a chain of smaller tensors.', caption:'Tensor train technique. Image: AtellK, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A statevector simulator stores one complex amplitude for every basis state of n qubits. That needs 2^n amplitudes, so adding one qubit doubles memory.',
        'Tensor networks exist because many circuits have structure that a flat statevector ignores. Local gates, limited entanglement, geometry, and selected outputs can let the simulator rearrange sums without materializing the full state.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious simulator keeps the full statevector and applies each gate. It is exact, simple, and often fastest for small n because memory is contiguous and the algorithm is straightforward.',
        'For 30 qubits, the state has 1,073,741,824 amplitudes. With 16 bytes per complex amplitude, that is about 16 GiB before workspace overhead.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is exponential memory. A 40-qubit full state has about 1.1 trillion amplitudes, so even before gate work the representation can exceed ordinary machine memory.',
        'The wall is not only qubit count. Circuit depth, topology, entanglement across cuts, output type, and allowed approximation decide whether structure remains exploitable.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A quantum circuit is a tensor expression. Gates are tensors, wires are summed indices, inputs and requested outputs are fixed or open indices, and simulation is choosing how to evaluate that expression.',
        'The invariant is algebraic equivalence. Reordering contractions changes intermediate tensors and cost, but without approximation it computes the same scalar, amplitude, state slice, or observable up to floating-point error.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The simulator converts each one-qubit gate into a rank-2 tensor and each two-qubit gate into a rank-4 tensor. Shared indices connect outputs of earlier gates to inputs of later gates along the same qubit wire.',
        'A contraction planner chooses which tensors to combine first. Internal indices are summed away, while open indices remain for the requested amplitude, marginal, sample, or observable.',
        'Slicing can reduce peak memory by fixing one or more high-pressure indices and running many independent smaller contractions. That trades memory for more total work and more scheduling overhead.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Tensor contraction is the same linear algebra as applying gates to a statevector. The difference is that sums are delayed, grouped, and eliminated in an order chosen to keep intermediate arrays small.',
        'The method wins when the graph has low effective treewidth, meaning cuts through the graph expose relatively few open indices. It loses when entanglement and connectivity force large intermediate tensors no matter which path is chosen.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main cost is the largest intermediate tensor. If an intermediate has 30 binary indices, it has about 2^30 entries; if the planner keeps it to 20 binary indices, it has about 2^20 entries, which is 1,024 times smaller.',
        'Path search, slicing, GPU memory, distributed communication, precision, and optional truncation all matter. A plan that minimizes floating-point operations can still be bad if it creates a memory peak or too many tiny distributed jobs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Tensor-network contraction is used to simulate structured quantum circuits, compute selected amplitudes, estimate observables, study low-entanglement systems, and benchmark quantum devices beyond small statevector limits. It is also used in condensed matter and tensor decomposition methods such as matrix product states.',
        'It works best when the output is narrower than the full state. Asking for one amplitude or one observable can be much cheaper than asking for the entire final statevector.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Tensor networks fail when the circuit creates broad entanglement and high graph connectivity. Random deep all-to-all circuits can force huge intermediates, making statevector simulation simpler or both methods infeasible.',
        'They also fail operationally when the contraction ledger is missing. Without path, peak memory, slice count, precision, truncation policy, and validation target, a result is hard to reproduce or trust.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a 50-qubit line circuit has shallow nearest-neighbor gates and the largest cut exposes 12 binary indices. A tensor contraction can carry about 2^12 = 4,096 boundary states across that cut instead of storing 2^50 full amplitudes.',
        'Now add long-range entangling gates so the best cut exposes 32 binary indices. The intermediate has about 2^32 entries, which is about one million times larger than 2^12, so the advantage can disappear even though the qubit count did not change.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources include the PennyLane tensor-network simulation demo at https://pennylane.ai/demos/tutorial_How_to_simulate_quantum_circuits_with_tensor_networks and the Jet paper at https://quantum-journal.org/papers/q-2022-05-09-709/. Study statevector simulation, matrix chain multiplication, treewidth, tensor trains, matrix product states, slicing, and quantum circuit observables next.',
      ],
    },
  ],
};
