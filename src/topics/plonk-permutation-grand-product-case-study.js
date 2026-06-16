// PLONK permutation argument: copy constraints become a permutation check over
// witness columns, compressed into a grand-product polynomial.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'plonk-permutation-grand-product-case-study',
  title: 'PLONK Permutation Grand Product Case Study',
  category: 'Security',
  summary: 'A PLONKish proof-system case study: advice columns, copy constraints, permutation cycles, beta/gamma challenges, grand-product accumulator, and verifier checks.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['copy cycles', 'grand product'], defaultValue: 'copy cycles' },
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

function permGraph(title) {
  return graphState({
    nodes: [
      { id: 'a1', label: 'a1', x: 1.2, y: 1.6, note: 'x' },
      { id: 'b2', label: 'b2', x: 4.6, y: 1.6, note: 'x' },
      { id: 'c4', label: 'c4', x: 8.0, y: 1.6, note: 'x' },
      { id: 'a2', label: 'a2', x: 1.2, y: 4.9, note: 'y' },
      { id: 'b3', label: 'b3', x: 4.6, y: 4.9, note: 'y' },
      { id: 'c1', label: 'c1', x: 8.0, y: 4.9, note: 'z' },
      { id: 'acc', label: 'Z', x: 4.6, y: 3.2, note: 'prod' },
    ],
    edges: [
      { id: 'e-a1-b2', from: 'a1', to: 'b2', weight: 'copy' },
      { id: 'e-b2-c4', from: 'b2', to: 'c4', weight: 'copy' },
      { id: 'e-c4-a1', from: 'c4', to: 'a1', weight: 'copy' },
      { id: 'e-a2-b3', from: 'a2', to: 'b3', weight: 'copy' },
      { id: 'e-b3-a2', from: 'b3', to: 'a2', weight: 'copy' },
      { id: 'e-a1-acc', from: 'a1', to: 'acc' },
      { id: 'e-a2-acc', from: 'a2', to: 'acc' },
      { id: 'e-acc-c4', from: 'acc', to: 'c4' },
    ],
  }, { title });
}

function* copyCycles() {
  yield {
    state: labelMatrix(
      'Advice columns',
      [
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
        { id: 'r4', label: 'r4' },
      ],
      [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
        { id: 'C', label: 'C' },
      ],
      [
        ['x', 'u', 'z'],
        ['y', 'x', 'v'],
        ['p', 'y', 'q'],
        ['m', 'n', 'x'],
      ],
    ),
    highlight: { active: ['r1:A', 'r2:B', 'r4:C'], found: ['r2:A', 'r3:B'] },
    explanation: 'PLONKish circuits often store witness values in advice columns. Copy constraints say that selected cells must hold the same value even though they appear in different rows or columns.',
  };
  yield {
    state: permGraph('Copy constraints become permutation cycles'),
    highlight: { active: ['a1', 'b2', 'c4', 'e-a1-b2', 'e-b2-c4', 'e-c4-a1'], found: ['a2', 'b3', 'e-a2-b3', 'e-b3-a2'] },
    explanation: 'Instead of checking every equality one by one, PLONK encodes copy constraints as a permutation. Cells in the same copy cycle must carry the same witness value.',
    invariant: 'A copy cycle is an equality contract over table cells.',
  };
  yield {
    state: labelMatrix(
      'Permutation map',
      [
        { id: 'a1', label: 'A1' },
        { id: 'b2', label: 'B2' },
        { id: 'c4', label: 'C4' },
        { id: 'a2', label: 'A2' },
      ],
      [
        { id: 'next', label: 'next' },
        { id: 'value', label: 'value' },
      ],
      [
        ['B2', 'x'],
        ['C4', 'x'],
        ['A1', 'x'],
        ['B3', 'y'],
      ],
    ),
    highlight: { active: ['a1:next', 'b2:next', 'c4:next'], compare: ['a2:next'] },
    explanation: 'The permutation table is a compact address map. It says which cell follows which in each equality cycle. The proof checks that witness values are consistent with that map.',
  };
  yield {
    state: permGraph('A bad copied value breaks the cycle'),
    highlight: { removed: ['c4', 'e-b2-c4'], active: ['a1', 'b2', 'e-a1-b2'], compare: ['acc'] },
    explanation: 'If one copied cell contains a different value, the permutation relationship should fail. The verifier does not learn the witness, but it should learn that the committed columns are internally consistent.',
  };
}

function* grandProduct() {
  yield {
    state: permGraph('Random challenges compress the copy check'),
    highlight: { active: ['a1', 'b2', 'c4', 'acc', 'e-a1-acc', 'e-acc-c4'], found: ['e-a1-b2', 'e-b2-c4'] },
    explanation: 'The prover and verifier use transcript challenges such as beta and gamma to compress values and cell positions into products. Randomness prevents the prover from faking a different multiset except with tiny probability.',
  };
  yield {
    state: plotState({
      axes: { x: { label: 'row', min: 0, max: 5 }, y: { label: 'Z', min: 0, max: 2 } },
      series: [
        { id: 'good', label: 'good Z', points: [{ x: 0, y: 1 }, { x: 1, y: 1.1 }, { x: 2, y: 0.9 }, { x: 3, y: 1.05 }, { x: 4, y: 1 }] },
        { id: 'bad', label: 'bad Z', points: [{ x: 0, y: 1 }, { x: 1, y: 1.1 }, { x: 2, y: 1.45 }, { x: 3, y: 1.6 }, { x: 4, y: 1.7 }] },
      ],
      markers: [
        { id: 'endok', x: 4, y: 1, label: 'ends 1' },
        { id: 'endbad', x: 4, y: 1.7, label: 'fail' },
      ],
    }),
    highlight: { active: ['good', 'endok'], removed: ['bad', 'endbad'] },
    explanation: 'The grand-product polynomial Z accumulates a ratio row by row. For a valid permutation, the boundary and transition checks line up. A bad copy relation changes the product path.',
  };
  yield {
    state: labelMatrix(
      'Verifier checks',
      [
        { id: 'start', label: 'start' },
        { id: 'step', label: 'step' },
        { id: 'end', label: 'end' },
        { id: 'open', label: 'open' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'why', label: 'why' },
      ],
      [
        ['Z(1)=1', 'anchor'],
        ['ratio ok', 'copy map'],
        ['Z(last)=1', 'closed'],
        ['commit', 'bind cols'],
      ],
    ),
    highlight: { found: ['start:check', 'step:check', 'end:check', 'open:check'] },
    explanation: 'The verifier checks boundary conditions, transition equations, and polynomial openings. The actual witness values stay hidden inside committed columns.',
  };
  yield {
    state: labelMatrix(
      'What PLONK adds',
      [
        { id: 'r1cs', label: 'R1CS' },
        { id: 'plonk', label: 'PLONK' },
        { id: 'lookup', label: 'lookup' },
        { id: 'custom', label: 'custom' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['rows', 'many wires'],
        ['columns', 'perm check'],
        ['tables', 'range cheap'],
        ['wide gate', 'less rows'],
      ],
    ),
    highlight: { active: ['plonk:shape', 'lookup:shape', 'custom:shape'], compare: ['r1cs:cost'] },
    explanation: 'PLONKish systems move from raw rank-1 rows to columnar tables, permutation arguments, selectors, and lookups. The data structure looks more like a constrained spreadsheet.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'copy cycles') yield* copyCycles();
  else if (view === 'grand product') yield* grandProduct();
  else throw new InputError('Pick a PLONK permutation view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'PLONK is a universal SNARK design built around polynomial commitments, Lagrange-basis evaluations, custom gates, and a permutation argument. The permutation argument is what enforces copy constraints: this cell must equal that cell.',
        'The key data structure is a table of witness columns plus a permutation map over cell addresses. Equality constraints become cycles in that map.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The circuit stores values in columns. When two cells are meant to contain the same wire value, the permutation map places them in the same cycle. A grand-product polynomial checks that the committed witness values are consistent with the committed permutation.',
        'Transcript challenges such as beta and gamma compress cell values and positions into products. A valid witness makes the product satisfy boundary and transition checks. A bad copied value breaks the product relationship.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'Suppose A row 1, B row 2, and C row 4 all represent the same hidden value x. A copy-cycle map links A1 to B2 to C4 and back to A1. The grand-product check lets the verifier enforce that equality without reading x.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Copy constraints are everywhere: reused variables, public input binding, lookup arguments, range-check decompositions, and state transitions. If equality is wrong, a prover can mix incompatible witness values across the circuit.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not confuse a gate constraint with a copy constraint. A multiplication gate can be correct while the same logical wire is not actually tied to its later uses. Do not forget boundary checks for the grand product.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PLONK paper at https://eprint.iacr.org/2019/953 and Protocol Labs PDF at https://research.protocol.ai/publications/plonk-permutations-over-lagrange-bases-for-oecumenical-noninteractive-arguments-of-knowledge/gabizon2019a.pdf. Study R1CS Witness Constraint Matrix, KZG Polynomial Commitments, ZK-SNARK Arithmetization, and Sparse Format Selection next.',
      ],
    },
  ],
};
