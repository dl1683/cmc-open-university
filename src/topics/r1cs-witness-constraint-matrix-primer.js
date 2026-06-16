// R1CS: encode a computation as witness variables plus rank-1 bilinear
// constraints of the form <A,w> * <B,w> = <C,w>.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'r1cs-witness-constraint-matrix-primer',
  title: 'R1CS Witness Constraint Matrix Primer',
  category: 'Security',
  summary: 'A zero-knowledge arithmetization primer: witness vectors, public inputs, A/B/C sparse matrices, multiplication gates, constraint satisfaction, and bad-witness rejection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['witness rows', 'constraint check'], defaultValue: 'witness rows' },
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

function r1csGraph(title) {
  return graphState({
    nodes: [
      { id: 'expr', label: 'expr', x: 1.0, y: 3.4, note: 'x^3+x+5' },
      { id: 'wires', label: 'wires', x: 3.0, y: 3.4, note: 'w' },
      { id: 'abc', label: 'A/B/C', x: 5.1, y: 3.4, note: 'sparse' },
      { id: 'dot', label: 'dots', x: 7.0, y: 2.1, note: 'linear' },
      { id: 'mul', label: 'mul', x: 7.0, y: 4.8, note: 'rank 1' },
      { id: 'ok', label: 'ok?', x: 8.8, y: 3.4, note: 'zero' },
    ],
    edges: [
      { id: 'e-expr-wires', from: 'expr', to: 'wires' },
      { id: 'e-wires-abc', from: 'wires', to: 'abc' },
      { id: 'e-abc-dot', from: 'abc', to: 'dot' },
      { id: 'e-dot-mul', from: 'dot', to: 'mul' },
      { id: 'e-mul-ok', from: 'mul', to: 'ok' },
    ],
  }, { title });
}

function* witnessRows() {
  yield {
    state: r1csGraph('Program becomes field wires'),
    highlight: { active: ['expr', 'wires', 'e-expr-wires'], compare: ['abc', 'ok'] },
    explanation: 'R1CS starts by assigning every intermediate value in a computation to a witness vector. The proof system will reason about field elements and constraints, not the original source program.',
  };
  yield {
    state: labelMatrix(
      'Witness vector',
      [
        { id: 'one', label: '1' },
        { id: 'x', label: 'x' },
        { id: 'x2', label: 'x2' },
        { id: 'x3', label: 'x3' },
        { id: 'y', label: 'y' },
      ],
      [
        { id: 'val', label: 'val' },
        { id: 'vis', label: 'vis' },
      ],
      [
        ['1', 'fixed'],
        ['3', 'priv'],
        ['9', 'deriv'],
        ['27', 'deriv'],
        ['35', 'public'],
      ],
    ),
    highlight: { active: ['x:val', 'x2:val', 'x3:val'], found: ['y:val'], compare: ['x:vis'] },
    explanation: 'For y = x^3 + x + 5, the witness contains one constant, the hidden x, derived wires x2 and x3, and the public output y.',
    invariant: 'Derived wires must be constrained, not merely written down.',
  };
  yield {
    state: labelMatrix(
      'Gate rows',
      [
        { id: 'g1', label: 'g1' },
        { id: 'g2', label: 'g2' },
        { id: 'g3', label: 'g3' },
        { id: 'out', label: 'out' },
      ],
      [
        { id: 'left', label: 'left' },
        { id: 'right', label: 'right' },
        { id: 'result', label: 'result' },
      ],
      [
        ['x', 'x', 'x2'],
        ['x2', 'x', 'x3'],
        ['x3+x+5', '1', 'y'],
        ['y', '1', '35'],
      ],
    ),
    highlight: { active: ['g1:left', 'g1:right', 'g1:result', 'g2:result'], found: ['out:result'] },
    explanation: 'Each row represents a rank-1 equation. Multiplication rows are direct. Linear additions are folded into one side and multiplied by the constant wire 1.',
  };
  yield {
    state: r1csGraph('Sparse A/B/C matrices select witness terms'),
    highlight: { active: ['wires', 'abc', 'dot', 'e-wires-abc', 'e-abc-dot'], found: ['mul'], compare: ['expr'] },
    explanation: 'Implementations store A, B, and C as sparse matrices. Each row selects linear combinations from the same witness vector, then checks whether Arow(w) * Brow(w) equals Crow(w).',
  };
}

function* constraintCheck() {
  yield {
    state: labelMatrix(
      'Row evaluation',
      [
        { id: 'g1', label: 'g1' },
        { id: 'g2', label: 'g2' },
        { id: 'g3', label: 'g3' },
        { id: 'out', label: 'out' },
      ],
      [
        { id: 'lhs', label: 'lhs' },
        { id: 'rhs', label: 'rhs' },
        { id: 'ok', label: 'ok?' },
      ],
      [
        ['3*3', '9', 'yes'],
        ['9*3', '27', 'yes'],
        ['35*1', '35', 'yes'],
        ['35*1', '35', 'yes'],
      ],
    ),
    highlight: { found: ['g1:ok', 'g2:ok', 'g3:ok', 'out:ok'] },
    explanation: 'With the correct witness, every row evaluates to true. The verifier eventually checks a compressed cryptographic version of these row relationships.',
  };
  yield {
    state: labelMatrix(
      'Bad witness',
      [
        { id: 'wrongx', label: 'x=4' },
        { id: 'fakex2', label: 'fake x2' },
        { id: 'wrongy', label: 'bad y' },
        { id: 'omit', label: 'omit row' },
      ],
      [
        { id: 'firstbad', label: 'bad row' },
        { id: 'result', label: 'result' },
      ],
      [
        ['g3/out', 'reject'],
        ['g1', 'reject'],
        ['out', 'reject'],
        ['circuit bug', 'unsafe'],
      ],
    ),
    highlight: { removed: ['wrongx:result', 'fakex2:result', 'wrongy:result', 'omit:result'] },
    explanation: 'R1CS only proves what the rows encode. A bad witness should fail, but a missing constraint is a circuit bug. The constraint system is the security boundary.',
  };
  yield {
    state: r1csGraph('All rows share one witness assignment'),
    highlight: { active: ['wires', 'abc', 'dot', 'mul', 'ok', 'e-wires-abc', 'e-abc-dot', 'e-dot-mul', 'e-mul-ok'], compare: ['expr'] },
    explanation: 'The assignment must satisfy every row at once. This shared-witness property prevents the prover from using one value for one gate and a different value for another gate.',
  };
  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'range', label: 'range' },
        { id: 'copy', label: 'copy' },
        { id: 'zero', label: 'zero' },
        { id: 'public', label: 'public' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['field wrap', 'range gate'],
        ['wire drift', 'copy check'],
        ['div by 0', 'nonzero gate'],
        ['wrong input', 'bind inst'],
      ],
    ),
    highlight: { found: ['range:fix', 'copy:fix', 'zero:fix', 'public:fix'] },
    explanation: 'The hard part is not only building rows. You must also constrain ranges, copied values, divisions, public inputs, and all assumptions that ordinary code would leave implicit.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'witness rows') yield* witnessRows();
  else if (view === 'constraint check') yield* constraintCheck();
  else throw new InputError('Pick an R1CS view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'A Rank-1 Constraint System, or R1CS, encodes a computation as equations over a finite field. Each row has the form A(w) times B(w) equals C(w), where w is a shared witness vector and A, B, and C are sparse linear forms.',
        'R1CS is a bridge between programs and zero-knowledge proof systems. The prover knows a witness. The verifier wants assurance that the witness satisfies all constraints without learning the private witness values.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The circuit builder creates witness variables for inputs and intermediate values. Multiplication gates become rank-1 rows. Additions and constants become linear combinations inside A, B, or C. Public inputs are included in the witness structure but marked as public instance values.',
        'The same witness vector is used for every row. That is the key data-structure invariant: rows do not carry separate local assignments. If a derived value is used twice, copy constraints or shared variable IDs must force equality.',
      ],
    },
    {
      heading: 'Case study',
      paragraphs: [
        'For the claim y = x^3 + x + 5 with public y = 35, the witness can be [1, x, x2, x3, y] = [1, 3, 9, 27, 35]. Rows enforce x*x=x2, x2*x=x3, x3+x+5=y, and y=35. A prover using x=4 or a fake x2 fails one of those rows.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'R1CS proves only the constraints you wrote. If you forget a range check, nonzero check, copy check, or public-input binding, the proof can be valid for the wrong statement. Field arithmetic also wraps, so ordinary integer assumptions need explicit constraints.',
      ],
    },
    {
      heading: 'Why it matters',
      paragraphs: [
        'Many proof systems no longer expose raw R1CS directly, but the mental model remains useful. It teaches how witness assignment, constraints, and public inputs become the true contract between prover and verifier.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study sources: R1CS overview at https://alinush.github.io/r1cs, the Bulletproofs R1CS explanation at https://tlu.tarilabs.com/cryptography/rank-1.html, and the existing ZK-SNARK Arithmetization topic. Next study KZG Polynomial Commitments, PLONK Permutation Grand Product, Sparse Matrix formats, and Finite State Machine.',
      ],
    },
  ],
};
