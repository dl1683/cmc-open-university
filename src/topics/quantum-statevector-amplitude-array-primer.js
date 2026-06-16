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
    explanation: 'A statevector simulator stores one complex amplitude per computational basis state. Two qubits need four amplitudes; n qubits need 2^n amplitudes.',
  };
  yield {
    state: stateGraph('Circuit operations mutate an amplitude array'),
    highlight: { active: ['circuit', 'state', 'e-circuit-state'], compare: ['sample'] },
    explanation: 'The simulator does not store one value per qubit after entanglement. It stores a full array of amplitudes indexed by bitstrings.',
    invariant: 'Statevector memory doubles for every additional qubit.',
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
    explanation: 'The exponential array is the central simulation bottleneck. Thirty qubits already require roughly one billion complex amplitudes.',
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
    explanation: 'Measurements sample outcomes from squared magnitudes. Phase can affect later interference even when immediate measurement probabilities look the same.',
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
    explanation: 'A single-qubit gate updates amplitude pairs whose basis indexes differ in the target bit. The target bit defines the stride pattern through the flat array.',
  };
  yield {
    state: stateGraph('Gate kernels walk paired amplitudes'),
    highlight: { active: ['state', 'pair', 'gate', 'e-state-pair', 'e-pair-gate'], found: ['prob'] },
    explanation: 'The data-parallel kernel loads a pair, applies a 2x2 matrix, and writes the pair back. Two-qubit gates use four-amplitude blocks.',
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
    explanation: 'After an entangling gate, the state cannot generally be stored as independent per-qubit vectors. This is why tensor-network simulators try to exploit limited entanglement.',
  };
  yield {
    state: stateGraph('Sampling reads probabilities from the final vector'),
    highlight: { active: ['prob', 'sample', 'e-prob-sample'], compare: ['gate', 'pair'] },
    explanation: 'Statevector simulation is exact up to floating-point error, but repeated circuit shots are sampled from the final probability distribution.',
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
    { heading: 'What it is', paragraphs: ['A quantum statevector simulator stores the full wavefunction as an array of complex amplitudes. The index is a computational basis bitstring, and the value is the amplitude for that basis state.'] },
    { heading: 'How it works', paragraphs: ['Single-qubit gates update amplitude pairs whose indexes differ in one bit. Two-qubit gates update four-amplitude blocks. Measurement samples basis states according to squared amplitude magnitudes.'] },
    { heading: 'Case study', paragraphs: ['A Bell circuit applies H to one qubit and CX to entangle two qubits. The final state has nonzero amplitudes for 00 and 11, each with probability 1/2.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not think of the simulator as one scalar per qubit after entanglement. Do not ignore exponential memory growth. Do not confuse amplitude phase with probability.'] },
    { heading: 'Why it matters', paragraphs: ['Statevectors are the baseline data structure behind quantum simulation, debugging, and small-circuit education. They make the cost of quantum simulation explicit.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: IBM Quantum circuit docs at https://quantum.cloud.ibm.com/docs/api/qiskit/circuit and Qiskit Statevector docs at https://quantum.cloud.ibm.com/docs/api/qiskit/qiskit.quantum_info.Statevector. Study Eigenvectors, Complex-valued Neural Networks, Tensor Network Circuit Contraction, and Matrix Completion next.'] },
  ],
};
