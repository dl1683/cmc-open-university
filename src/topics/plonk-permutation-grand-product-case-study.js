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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each cell as a position in a proving table, not as a variable name from source code. A wire means several cell positions must hold the same hidden value, and a permutation cycle is the fixed route that names those positions.',
        'In the copy-cycles view, a cycle such as A1 to B2 to C4 says that the prover must make those addressed cells equal. In the grand-product view, the running product is the compact check that the addressed values still match after the permutation is applied.',
        {type:'callout', text:`PLONK makes global wiring cheap by turning copy constraints over table cells into one randomized grand product consistency check.`},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'PLONK is a zero-knowledge proof system, which means a prover convinces a verifier that a computation was done correctly without revealing the private witness values. The computation is laid out as a table of columns and rows, so equality between distant cells has to be proven as part of the circuit.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The direct approach is to add a separate equality constraint for every pair of cells that should match. If A1 equals B2, add one constraint; if B2 equals C4, add another constraint.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is global wiring. A circuit with 100,000 rows can have copy relationships that cross the whole table, while arithmetic gates only see their local row and selected rotations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Encode copy constraints as a permutation over cell addresses. Cells that represent the same logical value form a cycle, and the grand product turns that global equality relation into one running algebraic invariant.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The prover commits to witness columns, then receives random challenges that mix each witness value with its cell address. For each row, it updates an accumulator with a ratio between current addressed terms and permuted addressed terms.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is multiset equality over value-and-address terms. If every copy cycle contains the same value at each addressed cell, the numerator and denominator are the same collection in a different order.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost moves from many explicit equality gates to extra prover work for an accumulator polynomial and a compact verifier check. If a circuit grows from 50,000 to 100,000 rows, the prover does about twice the row work while the verifier still checks a small set of openings.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Permutation arguments support reusable column layouts, public-input binding, recursive verification layouts, custom gates, and circuits generated by higher-level languages. For auditors, the useful question is which permutation cycle proves that two appearances are the same value.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The argument only enforces the permutation it is given. If the circuit forgets that A7 and C12 should match, the proof system will not infer equality from names, comments, or host-language variables.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose A1 = 9, B2 = 9, and C4 should also be 9 because all three cells represent x. If the prover puts 11 in C4, local gates touching C4 may still pass, but the grand product cannot satisfy the transition and final boundary at the same time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PLONK at https://eprint.iacr.org/2019/953 and the Protocol Labs paper page at https://research.protocol.ai/publications/plonk-permutations-over-lagrange-bases-for-oecumenical-noninteractive-arguments-of-knowledge/gabizon2019a.pdf. Study R1CS Witness Constraint Matrix, ZK-SNARK Arithmetization, KZG Polynomial Commitments, and Lookup Arguments next.',
      ],
    },
  ],
};
