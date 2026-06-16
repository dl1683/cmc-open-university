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
    { heading: 'What it is', paragraphs: ['A tensor-network quantum simulator represents a circuit as tensors connected by shared indices. It contracts the network to compute amplitudes, probabilities, samples, or observables.'] },
    { heading: 'How it works', paragraphs: ['Each gate is a tensor. Each wire is an index. A contraction plan chooses an order for multiplying tensors and summing shared indices. The peak intermediate tensor size drives memory cost.'] },
    { heading: 'Case study', paragraphs: ['A shallow nearest-neighbor circuit may contract cheaply as an MPS-like network. A random all-to-all circuit grows large bond dimensions and can become as hard as statevector simulation.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not judge cost only by qubit count. Entanglement, circuit topology, contraction order, slicing, and output type can dominate. A bad contraction path can exhaust memory.'] },
    { heading: 'Why it matters', paragraphs: ['Tensor networks are graph algorithms for quantum simulation. They connect linear algebra, hypergraph contraction, scheduling, memory planning, and parallel execution.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: PennyLane tensor-network demo at https://pennylane.ai/demos/tutorial_How_to_simulate_quantum_circuits_with_tensor_networks and Jet paper at https://quantum-journal.org/papers/q-2022-05-09-709/. Study Statevector Amplitude Array, Sparse Format Selection, Tensor Parallelism, and GraphBLAS next.'] },
  ],
};
