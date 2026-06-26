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
  const witnessSize = 5; // [1, x, x2, x3, y]
  const gateCount = 4; // g1, g2, g3, out
  const expression = 'x^3 + x + 5';
  const xValue = 3;
  const yValue = 35;

  yield {
    state: r1csGraph('Program becomes field wires'),
    highlight: { active: ['expr', 'wires', 'e-expr-wires'], compare: ['abc', 'ok'] },
    explanation: `R1CS starts by assigning every intermediate value in a computation to a witness vector of ${witnessSize} elements. The proof system will reason about field elements and constraints, not the original source program.`,
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
    explanation: `For y = ${expression} with x = ${xValue}, the witness contains ${witnessSize} slots: one constant, the hidden x, derived wires x2 and x3, and the public output y = ${yValue}.`,
    invariant: `Derived wires in a ${witnessSize}-element witness must be constrained, not merely written down.`,
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
    explanation: `Each of the ${gateCount} rows represents a rank-1 equation. Multiplication rows are direct. Linear additions are folded into one side and multiplied by the constant wire 1.`,
  };
  yield {
    state: r1csGraph('Sparse A/B/C matrices select witness terms'),
    highlight: { active: ['wires', 'abc', 'dot', 'e-wires-abc', 'e-abc-dot'], found: ['mul'], compare: ['expr'] },
    explanation: `Implementations store A, B, and C as sparse matrices. Each of the ${gateCount} rows selects linear combinations from the same ${witnessSize}-element witness vector, then checks whether Arow(w) * Brow(w) equals Crow(w).`,
  };
}

function* constraintCheck() {
  const rowCount = 4;
  const xValue = 3;
  const yValue = 35;
  const badWitnessTypes = 4;

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
    explanation: `With x = ${xValue} and y = ${yValue}, all ${rowCount} rows evaluate to true. The verifier eventually checks a compressed cryptographic version of these row relationships.`,
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
    explanation: `R1CS only proves what the ${rowCount} rows encode. The ${badWitnessTypes} bad-witness scenarios shown here should all fail, but a missing constraint is a circuit bug. The constraint system is the security boundary.`,
  };
  yield {
    state: r1csGraph('All rows share one witness assignment'),
    highlight: { active: ['wires', 'abc', 'dot', 'mul', 'ok', 'e-wires-abc', 'e-abc-dot', 'e-dot-mul', 'e-mul-ok'], compare: ['expr'] },
    explanation: `The assignment must satisfy all ${rowCount} rows at once. This shared-witness property prevents the prover from using x = ${xValue} in one gate and a different value for x in another.`,
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
    explanation: `The hard part is not only building ${rowCount} rows. You must also constrain ranges, copied values, divisions, public inputs like y = ${yValue}, and all assumptions that ordinary code would leave implicit.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the witness as the full list of values a prover claims were produced by a computation. A witness slot can be private, public, constant, or derived from earlier slots.',
        { type: 'callout', text: 'R1CS security lives in rows: every private wire can be hidden, but every relationship it relies on must be constrained.' },
        'Each constraint row checks one equation of the form left times right equals output. The animation highlights which witness values a row selects and whether the row accepts or rejects the assignment.',
        'The safe inference is row satisfaction under one shared witness. A bad witness is rejected when any required row fails; a missing row is a circuit bug because the proof system cannot enforce a relationship it was never given.',
      
        {type: 'image', src: './assets/gifs/r1cs-witness-constraint-matrix-primer.gif', alt: 'Animated walkthrough of the r1cs witness constraint matrix primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A zero-knowledge proof lets a prover show that a statement is true without revealing private inputs. The proof system does not execute normal source code; it checks algebraic constraints over a finite field.',
        'R1CS means rank-1 constraint system. It is a way to turn a computation into rows of equations that proving systems such as Groth16 can compress into a small proof.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to prove the final equation directly. For y = x^3 + x + 5, the verifier could check the formula if it knew x.',
        'That reveals the private input, which defeats zero knowledge. If the verifier does not know x, it also cannot see whether intermediate values such as x^2 and x^3 were computed consistently.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is multiplication between unknowns. Linear equations can add known multiples of witness values, but x times x is not linear when x is hidden.',
        'There is also a security wall. If an intermediate wire is written into the witness but never constrained, a prover can choose a convenient fake value and still satisfy whatever rows remain.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'R1CS isolates every multiplication into one rank-1 row. The row computes a linear combination A dot w, another linear combination B dot w, and requires their product to equal C dot w.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A directed graph is a compact way to read circuit dependencies: each derived wire must be justified by rows that consume it. Source: Wikimedia Commons, Directed graph no background.svg, public domain: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg' },
        'Addition is folded into the linear combinations, while multiplication gets its own row. The circuit becomes a shared witness plus sparse A, B, and C matrices.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Choose witness slots, usually starting with a constant 1. For y = x^3 + x + 5 with x = 3, use w = [1, x, x2, x3, y] = [1, 3, 9, 27, 35].',
        'Create one row for x * x = x2 and one row for x2 * x = x3. Then create one row for (x3 + x + 5) * 1 = y, where the addition lives inside the left linear combination.',
        'A compiler such as Circom generates the witness program and the sparse matrices. The prover supplies values, and the constraint system checks that all selected relationships hold at once.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on shared-witness consistency. Every row reads from the same vector w, so the prover cannot use x = 3 in one row and x = 4 in another without changing the same slot for all rows.',
        'If every multiplication and public binding is represented by a row, satisfying all rows means the witness is a valid execution trace for the circuit. If a relationship is missing, the proof remains valid for the written rows but may prove the wrong statement.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Constraint count is the main cost. Each unknown-times-unknown multiplication usually adds one row, while additions are cheap because they fold into linear combinations.',
        'Doubling the number of multiplications roughly doubles proving work and key material. A field-native hash can be far cheaper than SHA-256 in R1CS because bit operations require many boolean and reconstruction constraints.',
        'The matrices are sparse, so storage scales with nonzero terms rather than full m by n density. The proving system still pays for the number of constraints, witness size, and any trusted setup tied to the circuit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'R1CS is used in Groth16-based SNARK systems, including many Circom and snarkjs workflows. It is common when tiny proofs and cheap verification are more important than circuit-update flexibility.',
        'It is also a useful audit format. Engineers can inspect witness slots and constraint rows to see whether public inputs, ranges, copies, and nonzero assumptions were actually enforced.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'R1CS is awkward for bit-heavy programs. XOR, shifts, comparisons, and range checks must be encoded with field arithmetic, often adding many constraints.',
        'The most dangerous failure is underconstraint. A missing range check, copy constraint, or public input binding can let a prover satisfy the rows while violating the intended program.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let x = 3 and y = 35. The witness is [1, 3, 9, 27, 35], where slot 0 is the constant 1, slot 1 is x, slot 2 is x2, slot 3 is x3, and slot 4 is y.',
        'Row 1 checks x * x = x2, so 3 * 3 = 9. Row 2 checks x2 * x = x3, so 9 * 3 = 27. Row 3 checks (x3 + x + 5) * 1 = y, so (27 + 3 + 5) * 1 = 35.',
        'If a prover sets x2 = 10 while keeping x = 3, row 1 fails because 3 * 3 is not 10. If the circuit forgets row 1, the fake x2 can pass into later rows, which is why row coverage is the security boundary.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Jens Groth, On the Size of Pairing-based Non-interactive Arguments, EUROCRYPT 2016; Vitalik Buterin, Quadratic Arithmetic Programs: from Zero to Hero; Circom documentation for practical R1CS generation.',
        'Study finite fields, sparse matrix formats, arithmetic circuits, QAP conversion, Groth16, PLONK-style arithmetization, and underconstrained-circuit analysis. The next question is not only how to prove rows, but how to know the rows encode the intended program.',
      ],
    },
  ],
};