// FRI: prove a committed evaluation table is close to a low-degree polynomial
// by repeated folding and random oracle queries.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'fri-low-degree-folding-proof-case-study',
  title: 'FRI Low-Degree Folding Proof Case Study',
  category: 'Security',
  summary: 'A STARK/FRI proof case study: Reed-Solomon evaluation domains, Merkle commitments, random queries, even/odd folding, low-degree tests, and verifier spot checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['folding rounds', 'query proof'], defaultValue: 'folding rounds' },
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

function friGraph(title) {
  return graphState({
    nodes: [
      { id: 'evals', label: 'evals', x: 1.0, y: 3.5, note: 'domain' },
      { id: 'merkle0', label: 'root0', x: 2.9, y: 2.0, note: 'commit' },
      { id: 'fold1', label: 'fold1', x: 4.6, y: 3.5, note: 'half' },
      { id: 'merkle1', label: 'root1', x: 5.8, y: 2.0, note: 'commit' },
      { id: 'fold2', label: 'fold2', x: 7.0, y: 3.5, note: 'half' },
      { id: 'small', label: 'small', x: 8.6, y: 3.5, note: 'poly' },
      { id: 'query', label: 'query', x: 4.8, y: 5.7, note: 'random' },
    ],
    edges: [
      { id: 'e-evals-merkle0', from: 'evals', to: 'merkle0' },
      { id: 'e-evals-fold1', from: 'evals', to: 'fold1' },
      { id: 'e-fold1-merkle1', from: 'fold1', to: 'merkle1' },
      { id: 'e-fold1-fold2', from: 'fold1', to: 'fold2' },
      { id: 'e-fold2-small', from: 'fold2', to: 'small' },
      { id: 'e-query-evals', from: 'query', to: 'evals' },
      { id: 'e-query-fold1', from: 'query', to: 'fold1' },
      { id: 'e-query-fold2', from: 'query', to: 'fold2' },
    ],
  }, { title });
}

function* foldingRounds() {
  yield {
    state: friGraph('FRI starts with a large evaluation table'),
    highlight: { active: ['evals', 'merkle0', 'e-evals-merkle0'], compare: ['fold1', 'small'] },
    explanation: 'A STARK prover commits to a Reed-Solomon style evaluation table. The verifier wants evidence that this table is close to evaluations of a low-degree polynomial.',
  };
  yield {
    state: labelMatrix(
      'Even/odd split',
      [
        { id: 'p', label: 'p(x)' },
        { id: 'even', label: 'even' },
        { id: 'odd', label: 'odd' },
        { id: 'fold', label: 'fold' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'size', label: 'size' },
      ],
      [
        ['full poly', 'n'],
        ['p_even', 'n/2'],
        ['p_odd', 'n/2'],
        ['even+a*odd', 'n/2'],
      ],
    ),
    highlight: { active: ['even:size', 'odd:size', 'fold:size'], found: ['fold:meaning'] },
    explanation: 'A FRI round folds the polynomial using a random challenge. Conceptually, the prover combines even and odd parts into a smaller table. Degree and domain size shrink together.',
    invariant: 'Every fold must be bound by a commitment before later challenges are known.',
  };
  yield {
    state: friGraph('Repeated folds shrink the proof obligation'),
    highlight: { active: ['fold1', 'fold2', 'small', 'e-evals-fold1', 'e-fold1-fold2', 'e-fold2-small'], found: ['merkle1'], compare: ['evals'] },
    explanation: 'After several rounds, the prover reaches a tiny polynomial that the verifier can inspect directly. The verifier then checks random positions across all layers to connect the folded tables.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'round', min: 0, max: 6 }, y: { label: 'table size', min: 0, max: 1024 } },
      series: [
        { id: 'size', label: 'size', points: [{ x: 0, y: 1024 }, { x: 1, y: 512 }, { x: 2, y: 256 }, { x: 3, y: 128 }, { x: 4, y: 64 }, { x: 5, y: 32 }] },
      ],
      markers: [
        { id: 'start', x: 0, y: 1024, label: 'root0' },
        { id: 'end', x: 5, y: 32, label: 'small' },
      ],
    }),
    highlight: { active: ['size', 'start', 'end'] },
    explanation: 'The table-size halving is why FRI resembles an FFT-style folding process. The verifier does not read every row; it uses commitments and random spot checks.',
  };
}

function* queryProof() {
  yield {
    state: friGraph('Verifier samples random positions'),
    highlight: { active: ['query', 'evals', 'fold1', 'fold2', 'e-query-evals', 'e-query-fold1', 'e-query-fold2'], compare: ['small'] },
    explanation: 'The verifier samples positions after seeing commitments. For each sampled index, the prover opens values and Merkle paths from multiple FRI layers.',
  };
  yield {
    state: labelMatrix(
      'Query packet',
      [
        { id: 'idx', label: 'idx' },
        { id: 'sib', label: 'sib' },
        { id: 'fold', label: 'fold' },
        { id: 'root', label: 'root' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'check', label: 'check' },
      ],
      [
        ['i,j', 'paired'],
        ['Merkle', 'auth'],
        ['relation', 'algebra'],
        ['commit', 'bind'],
      ],
    ),
    highlight: { found: ['sib:check', 'fold:check', 'root:check'], active: ['idx:data'] },
    explanation: 'Each query packet proves two things at once: the opened values belong to committed tables, and adjacent layers satisfy the fold relation at that index.',
  };
  yield {
    state: labelMatrix(
      'FRI vs KZG',
      [
        { id: 'fri', label: 'FRI' },
        { id: 'kzg', label: 'KZG' },
        { id: 'merkle', label: 'Merkle' },
        { id: 'stark', label: 'STARK' },
      ],
      [
        { id: 'trust', label: 'trust' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['transparent', 'larger'],
        ['setup', 'compact'],
        ['hash path', 'bytes'],
        ['FRI+AIR', 'trace'],
      ],
    ),
    highlight: { active: ['fri:trust', 'stark:proof'], compare: ['kzg:trust', 'kzg:proof'] },
    explanation: 'FRI is attractive for transparent STARK systems: no trusted setup, hash-based commitments, and scalable proving. The tradeoff is larger proofs than pairing-based KZG systems.',
  };
  yield {
    state: friGraph('Bad tables fail with high probability'),
    highlight: { removed: ['fold1', 'fold2', 'e-query-fold1'], active: ['query', 'evals'], compare: ['small'] },
    explanation: 'FRI is probabilistic. A table far from low degree can pass a few unlucky queries, but enough random queries make the cheating probability small.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'folding rounds') yield* foldingRounds();
  else if (view === 'query proof') yield* queryProof();
  else throw new InputError('Pick a FRI view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'FRI means Fast Reed-Solomon Interactive Oracle Proof of Proximity. It is a protocol for proving that a committed evaluation table is close to a low-degree polynomial, using repeated folding and random queries.',
        'FRI is central to many STARK-style systems because it is transparent: it uses hash commitments and randomness rather than a trusted setup.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The prover commits to a large evaluation table with a Merkle root. A verifier challenge defines a fold that combines even and odd parts into a smaller table. The prover commits to that smaller table, repeats the process, and ends with a tiny polynomial.',
        'The verifier samples random positions and asks for values plus authentication paths across layers. The checks tie each opened value to a Merkle root and tie each layer to the next fold equation.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'A STARK proof for an execution trace first commits to trace-derived polynomial evaluations. FRI then proves those evaluations behave like low-degree polynomials. The verifier only opens a small number of random rows, but the commitments bind the prover to all rows.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Low-degree testing is the bridge between a giant execution table and a small verifier. Without it, the verifier would have to inspect the whole trace. With FRI, the verifier checks a few authenticated positions and a final small polynomial.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not confuse Merkle authentication with low-degree testing. Merkle paths only prove that values came from a committed table. FRI additionally checks that the committed table is close to a low-degree codeword.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: FRI paper PDF at https://drops.dagstuhl.de/storage/00lipics/lipics-vol107-icalp2018/LIPIcs.ICALP.2018.14/LIPIcs.ICALP.2018.14.pdf and RISC Zero FRI docs at https://dev.risczero.com/reference-docs/about-fri. Study Merkle Tree, KZG Polynomial Commitments, ZK-SNARK Arithmetization, and zkVM Execution Trace AIR next.',
      ],
    },
  ],
};
