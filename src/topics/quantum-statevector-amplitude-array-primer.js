// Statevector simulation: store 2^n complex amplitudes, apply gates as local
// linear transforms, and sample probabilities by squared magnitude.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'quantum-statevector-amplitude-array-primer',
  title: 'Quantum Statevector Amplitude Array Primer',
  category: 'Concepts',
  summary: 'A quantum simulation primer: basis-state indexing, complex amplitudes, single-qubit gate strides, entanglement, measurement probabilities, and exponential memory growth.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['amplitude array', 'gate stride'], defaultValue: 'amplitude array' },
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

function stateGraph(title) {
  return graphState({
    nodes: [
      { id: 'circuit', label: 'circuit', x: 1.0, y: 3.4, note: 'gates' },
      { id: 'state', label: 'state', x: 3.0, y: 3.4, note: '2^n' },
      { id: 'pair', label: 'pairs', x: 5.1, y: 2.0, note: 'stride' },
      { id: 'gate', label: 'gate', x: 5.1, y: 4.8, note: '2x2' },
      { id: 'prob', label: 'prob', x: 7.2, y: 3.4, note: '|a|^2' },
      { id: 'sample', label: 'sample', x: 8.8, y: 3.4, note: 'bits' },
    ],
    edges: [
      { id: 'e-circuit-state', from: 'circuit', to: 'state' },
      { id: 'e-state-pair', from: 'state', to: 'pair' },
      { id: 'e-pair-gate', from: 'pair', to: 'gate' },
      { id: 'e-gate-prob', from: 'gate', to: 'prob' },
      { id: 'e-prob-sample', from: 'prob', to: 'sample' },
    ],
  }, { title });
}

function* amplitudeArray() {
  yield {
    state: labelMatrix(
      'Two-qubit state',
      [
        { id: '00', label: '00' },
        { id: '01', label: '01' },
        { id: '10', label: '10' },
        { id: '11', label: '11' },
      ],
      [
        { id: 'amp', label: 'amp' },
        { id: 'prob', label: 'prob' },
      ],
      [
        ['1/sqrt2', '1/2'],
        ['0', '0'],
        ['0', '0'],
        ['1/sqrt2', '1/2'],
      ],
    ),
    highlight: { active: ['00:amp', '11:amp'], found: ['00:prob', '11:prob'] },
    explanation: `A ${topic.title.split(' ').slice(1, 3).join(' ').toLowerCase()} simulator stores one complex amplitude per computational basis state. Two qubits need ${2 ** 2} amplitudes; n qubits need 2^n amplitudes.`,
  };
  yield {
    state: stateGraph('Circuit operations mutate an amplitude array'),
    highlight: { active: ['circuit', 'state', 'e-circuit-state'], compare: ['sample'] },
    explanation: `The ${topic.title.split(' ')[0].toLowerCase()} simulator does not store one value per qubit after entanglement. It stores a full array of amplitudes indexed by bitstrings.`,
    invariant: `Statevector memory doubles for every additional qubit: n qubits require ${2}^n complex amplitudes.`,
  };
  yield {
    state: plotState({
      axes: { x: { label: 'qubits', min: 0, max: 35 }, y: { label: 'amps', min: 0, max: 34 } },
      series: [
        { id: 'growth', label: 'log2 amps', points: [{ x: 5, y: 5 }, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }] },
      ],
      markers: [
        { id: 'q30', x: 30, y: 30, label: '1B amps' },
      ],
    }),
    highlight: { active: ['growth', 'q30'] },
    explanation: `The exponential array is the central ${topic.title.split(' ')[0].toLowerCase()} simulation bottleneck. ${30} qubits already require roughly ${(2 ** 30 / 1e9).toFixed(1)} billion complex amplitudes.`,
  };
  yield {
    state: labelMatrix(
      'Measurement',
      [
        { id: 'amp', label: 'amp' },
        { id: 'square', label: 'square' },
        { id: 'sample', label: 'sample' },
        { id: 'collapse', label: 'collapse' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'note', label: 'note' },
      ],
      [
        ['complex', 'phase'],
        ['prob', 'real'],
        ['random', 'shots'],
        ['post', 'branch'],
      ],
    ),
    highlight: { found: ['square:role', 'sample:role'], compare: ['amp:note'] },
    explanation: `Measurements sample outcomes from squared magnitudes. Phase can affect later interference in the ${topic.title.split(' ').slice(1, 3).join(' ').toLowerCase()} even when immediate measurement probabilities look the same.`,
  };
}

function* gateStride() {
  yield {
    state: labelMatrix(
      'Apply X on q0',
      [
        { id: 'p0', label: '00/01' },
        { id: 'p1', label: '10/11' },
        { id: 'stride', label: 'stride' },
        { id: 'write', label: 'write' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after' },
      ],
      [
        ['a00,a01', 'swap'],
        ['a10,a11', 'swap'],
        ['bit mask', 'pairs'],
        ['in place?', 'careful'],
      ],
    ),
    highlight: { active: ['p0:after', 'p1:after', 'stride:after'], compare: ['write:after'] },
    explanation: `A single-qubit gate updates amplitude pairs whose basis indexes differ in the target bit. The target bit defines the stride pattern through the flat ${topic.title.split(' ').slice(1, 3).join(' ').toLowerCase()} array.`,
  };
  yield {
    state: stateGraph('Gate kernels walk paired amplitudes'),
    highlight: { active: ['state', 'pair', 'gate', 'e-state-pair', 'e-pair-gate'], found: ['prob'] },
    explanation: `The data-parallel kernel loads a pair, applies a ${2}x${2} matrix, and writes the pair back. Two-qubit gates use ${2 ** 2}-amplitude blocks.`,
  };
  yield {
    state: labelMatrix(
      'Entangling gate',
      [
        { id: 'h', label: 'H q0' },
        { id: 'cx', label: 'CX' },
        { id: 'state', label: 'state' },
        { id: 'factor', label: 'factor?' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'note', label: 'note' },
      ],
      [
        ['superpose', 'local'],
        ['correlate', '2q'],
        ['00+11', 'Bell'],
        ['no', 'entangled'],
      ],
    ),
    highlight: { found: ['state:effect', 'factor:effect'], active: ['h:effect', 'cx:effect'] },
    explanation: `After an entangling gate, the ${topic.title.split(' ')[0].toLowerCase()} state cannot generally be stored as independent per-qubit vectors. This is why tensor-network simulators try to exploit limited entanglement.`,
  };
  yield {
    state: stateGraph('Sampling reads probabilities from the final vector'),
    highlight: { active: ['prob', 'sample', 'e-prob-sample'], compare: ['gate', 'pair'] },
    explanation: `${topic.title.split(' ').slice(1, 3).join(' ')} simulation is exact up to floating-point error, but repeated circuit shots are sampled from the final probability distribution.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'amplitude array') yield* amplitudeArray();
  else if (view === 'gate stride') yield* gateStride();
  else throw new InputError('Pick a quantum statevector view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/quantum-statevector-amplitude-array-primer.gif', alt: 'Animated walkthrough of the quantum statevector amplitude array primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A quantum circuit describes operations on amplitudes, not ordinary bits. A classical simulator therefore needs a data structure for the whole wavefunction, including phase and interference. A per-qubit record is not enough once qubits become entangled.',
        {type: 'callout', text: 'A statevector simulator buys exactness by storing every joint basis amplitude, so each extra qubit doubles the array.'},
        'The statevector is the direct representation: one complex amplitude for each computational basis state. It is simple, exact, and brutally expensive as qubit count increases.',
        'The obvious classical shortcut is to store one state per qubit. That works only while the state is separable. Entanglement is the wall. After an H gate and a controlled operation create a Bell state, the two qubits no longer have independent local descriptions. The simulator needs amplitudes for joint bitstrings such as 00 and 11.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The array index is a bitstring. For n qubits there are 2^n indexes. The value at each index is a complex amplitude. Squared magnitude gives measurement probability, while phase affects interference when later gates combine amplitudes.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Riemann_Spin2States.jpg/330px-Riemann_Spin2States.jpg', alt: 'Bloch sphere representation of a two-state quantum system', caption: 'The Bloch sphere is a useful one-qubit picture, but a statevector must scale to joint basis states once qubits interact. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Riemann_Spin2States.jpg.'},
        'After entanglement, the simulator usually cannot store one independent value per qubit. It needs the joint state. That is why the vector grows exponentially.',
      ],
    },
    {
      heading: 'What the views show',
      paragraphs: [
        'In the amplitude-array view, read each row as one basis state. The value is a complex amplitude. The probability column is the squared magnitude. If two rows have nonzero amplitude, that does not mean the computer stores two classical possibilities; it stores one vector whose entries can later interfere.',
        'In the gate-stride view, watch which amplitude pairs are updated together. A single-qubit gate does not touch one slot. It touches every pair of basis states that differ in the target bit. The stride pattern is how a local gate becomes a whole-array operation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A single-qubit gate updates amplitude pairs whose indexes differ in the target bit. A two-qubit gate updates four-amplitude blocks. Measurement samples basis states from the final probability distribution.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing rows and columns combining', caption: 'Gate application is structured matrix-vector multiplication; simulators exploit the local gate pattern instead of building the full dense matrix. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
        'A Bell circuit shows the shape. Apply H to one qubit to create superposition. Apply CX to correlate the second qubit with the first. The final state has amplitude on 00 and 11, not on 01 and 10.',
        'Implementation is mostly careful indexing. For a target qubit q, the simulator walks the flat array in blocks and pairs entries whose indexes differ by bit q. It loads the old pair, applies the 2-by-2 gate matrix, and writes the new pair back. Two-qubit gates use four related entries. The flat array never stores gates; it stores the current state after applying them.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Quantum gates are linear operators. Applying a gate to the statevector is matrix-vector multiplication with a special sparse pattern. The pair and block updates are the efficient way to apply that operator without building a giant dense matrix.',
        'The simulator is exact up to floating-point error because it stores every amplitude. It is not sampling the computation internally unless the algorithm asks for measurement shots.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Memory doubles with every extra qubit. A 30-qubit state has about one billion amplitudes. With complex doubles, that is roughly 16 GB before overhead. A few more qubits can push the simulation beyond one machine.',
        'Gate cost scales with the vector size because the simulator must touch many amplitudes. That is why statevectors are excellent for small circuits and poor for large, highly entangled ones.',
        'Sampling cost is different from simulation cost. Once the final vector exists, measurement probabilities come from squared magnitudes. Repeated shots sample from that distribution. The expensive part was evolving the amplitudes; the shots are a readout procedure unless measurements occur mid-circuit and branch the simulation.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Statevectors are the best teaching and debugging baseline. They make amplitudes, phase, interference, and measurement probabilities visible. They are also useful for exact simulation of small circuits.',
        'They also win when you need exact amplitudes, a simple reference implementation, or small-circuit validation for a more specialized simulator. Many quantum libraries expose statevectors because they are the clearest way to inspect what a circuit actually did.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Statevectors fail when qubit count or memory dominates. Tensor networks, stabilizer simulators, decision diagrams, and approximate methods exist because many circuits have structure that a flat statevector cannot exploit.',
        'They also fail as a mental model if you treat amplitudes like ordinary probabilities. Phase can cancel or reinforce later paths even when immediate measurement probabilities look the same. A simulator that drops phase is no longer simulating general quantum computation.',
      ],
    },
    {
      heading: 'A worked case',
      paragraphs: [
        'For two qubits, the array has four entries: 00, 01, 10, and 11. Start in 00 with amplitude 1. Apply H to the first qubit. The amplitudes on 00 and 10 become 1/sqrt(2). Apply CX with the first qubit as control. The amplitude on 10 moves to 11. The final vector has amplitude on 00 and 11.',
        'Measurement now returns 00 half the time and 11 half the time. It never returns 01 or 10. That correlation is the point. The simulator needed the joint four-entry vector to represent it.',
      ],
    },
    {
      heading: 'Indexing convention',
      paragraphs: [
        'A statevector simulator must choose how qubit labels map onto array bits. Some libraries treat qubit 0 as the least significant bit. Others present diagrams in an order that can feel reversed. The math is the same, but the printed bitstrings and memory strides differ.',
        'This convention affects every gate kernel. If target qubit q is represented by bit q in the integer index, then paired amplitudes differ by 1 << q. A bug in this convention can produce a valid-looking vector that represents the wrong circuit.',
        'Good implementations make the convention explicit in tests and documentation. A Bell-state test, a single X gate on each qubit, and a controlled gate with swapped control and target catch many indexing mistakes.',
      ],
    },
    {
      heading: 'Gate kernel details',
      paragraphs: [
        'A single-qubit gate applies a 2-by-2 complex matrix to every pair of amplitudes whose indexes differ only in the target bit. The kernel must load both old amplitudes before writing either new amplitude, otherwise an in-place update can overwrite a value that is still needed.',
        'For a target bit with stride s, the loop walks blocks of size 2s. In each block, the first s entries pair with the next s entries. This produces predictable memory access for low-index qubits and wider strides for high-index qubits.',
        'Two-qubit gates generalize the same idea to four related amplitudes. The simulator can avoid constructing a 2^n by 2^n matrix because each local gate has a structured sparse action on the flat vector.',
      ],
    },
    {
      heading: 'Numerical behavior',
      paragraphs: [
        'Statevector simulation is exact in representation, not exact in arithmetic. The amplitudes are usually floating-point complex numbers. Repeated gates can accumulate rounding error, and the total probability may drift slightly away from 1.',
        'Simulators often renormalize after measurement or expose tolerances in tests. A small norm error is expected. A large norm error usually means a non-unitary gate was applied by mistake, a kernel overwrote values in place, or invalid floating-point values entered the vector.',
        'Precision choice matters. Complex64 halves memory compared with complex128 and can be much faster on accelerators, but it gives less numerical headroom. Debugging and reference runs often use higher precision before moving to faster kernels.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Start with a clear array layout, a tested complex-number representation, and simple gate kernels. Optimize only after the indexing contract is locked down. Most wrong simulators fail on bit order, control-target logic, or in-place writes before they fail on advanced performance issues.',
        'Use small circuits as golden tests. X should swap the right pairs. H followed by H should return the original state. A Bell circuit should produce only 00 and 11 probabilities. Controlled gates should do nothing when the control bit is 0.',
        'For performance, focus on memory bandwidth and parallel partitioning. A statevector gate kernel streams through a large array. Cache locality, SIMD, GPU memory coalescing, and distributed partition boundaries dominate once the vector no longer fits comfortably in cache.',
      ],
    },
    {
      heading: 'Choosing another simulator',
      paragraphs: [
        'Use a stabilizer simulator when the circuit is mostly Clifford gates and measurements. It can handle far more qubits because it tracks a compact algebraic description instead of every amplitude.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with connected nodes and arrows', caption: 'Circuit simulators choose representations by structure: gate graph, entanglement shape, and the measurements the user needs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Use tensor networks when the circuit has limited entanglement or a geometry that contracts cheaply. They can be excellent for shallow circuits, one-dimensional layouts, and cases where only a few amplitudes or probabilities are needed.',
        'Use a statevector when the circuit is small enough and you want the full wavefunction. It is the most direct baseline, the clearest teaching representation, and the easiest reference for checking more specialized methods.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: IBM Quantum circuit docs at https://quantum.cloud.ibm.com/docs/api/qiskit/circuit and Qiskit Statevector docs at https://quantum.cloud.ibm.com/docs/api/qiskit/qiskit.quantum_info.Statevector.',
        'Study Eigenvectors for linear-operator intuition, Complex-valued Neural Networks for complex arithmetic, Tensor Network Circuit Contraction for structured simulation, Matrix Completion for low-rank structure, and Sparse Format Selection for representation tradeoffs.',
      ],
    },
  ],
};
