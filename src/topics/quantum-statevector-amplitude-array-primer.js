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
    { heading: 'How to read the animation', paragraphs: [
      'Read each row as one basis state, which is a bitstring such as 00 or 11. Active cells show the amplitudes currently being updated or read for probability.',
      {type: 'image', src: './assets/gifs/quantum-statevector-amplitude-array-primer.gif', alt: 'Animated walkthrough of the quantum statevector amplitude array primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
    ] },
    { heading: 'Why this exists', paragraphs: [
      'A quantum circuit changes amplitudes, not ordinary bits. An amplitude is a complex number, and its squared magnitude gives the chance of measuring that basis state.',
      {type: 'callout', text: 'A statevector simulator buys exactness by storing every joint basis amplitude, so each extra qubit doubles the array.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to store one small state for each qubit. That works only while the qubits stay independent.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is entanglement, where qubits have joint behavior that cannot be split into separate per-qubit records. A Bell state links 00 and 11, so the simulator needs entries for joint bitstrings.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'The core insight is that the array index is the basis state. For n qubits there are 2 to the n bitstrings, so the statevector stores 2 to the n complex amplitudes.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Riemann_Spin2States.jpg/330px-Riemann_Spin2States.jpg', alt: 'Bloch sphere representation of a two-state quantum system', caption: 'The Bloch sphere is a useful one-qubit picture, but a statevector must scale to joint basis states once qubits interact. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Riemann_Spin2States.jpg.'},
    ] },
    { heading: 'How it works', paragraphs: [
      'A one-qubit gate updates every pair of amplitudes whose indexes differ in the target bit. A two-qubit gate updates four related amplitudes, and measurement samples from squared magnitudes.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Matrix_multiplication_diagram.svg/250px-Matrix_multiplication_diagram.svg.png', alt: 'Matrix multiplication diagram showing rows and columns combining', caption: 'Gate application is structured matrix-vector multiplication; simulators exploit the local gate pattern instead of building the full dense matrix. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Matrix_multiplication_diagram.svg.'},
    ] },
    { heading: 'Why it works', paragraphs: [
      'Quantum gates are linear operators, so applying them to a full statevector is matrix-vector multiplication. The stride loops are correct because they apply the same local matrix to every affected basis-state pair.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'Memory doubles with every qubit. A 30-qubit state has 1,073,741,824 amplitudes, and complex128 storage needs about 17.2 GB before overhead.',
      'Gate cost grows with the same array because a local gate still touches many amplitude pairs. The behavior is dominated by exponential memory pressure.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'Statevectors are the clearest teaching and debugging baseline for small circuits. They expose phase, interference, and exact probabilities before measurement sampling.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Statevectors fail when qubit count or entanglement makes the full array too large. Tensor networks, stabilizer simulators, and approximate methods exploit structure that the flat array ignores.',
      {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with connected nodes and arrows', caption: 'Circuit simulators choose representations by structure: gate graph, entanglement shape, and the measurements the user needs. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
    ] },
    { heading: 'Worked example', paragraphs: [
      'For two qubits, the array indexes are 00, 01, 10, and 11. Start with amplitude 1 on 00, apply H to put amplitude 1/sqrt(2) on 00 and 10, then apply CX to move the 10 amplitude to 11.',
      'Measurement now returns 00 half the time and 11 half the time. It never returns 01 or 10 because those amplitudes are zero.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Start with Qiskit Statevector documentation and IBM Quantum circuit documentation. Then study complex numbers, eigenvectors, matrix-vector multiplication, tensor-network contraction, stabilizer simulation, sparse formats, and floating-point error.',
    ] },
  ],
};
