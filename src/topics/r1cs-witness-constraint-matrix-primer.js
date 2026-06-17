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
      heading: 'Why R1CS exists',
      paragraphs: [
        'A proof system cannot verify a normal program directly. It needs a mathematical statement over a field. R1CS, rank-1 constraint systems, is one classic way to turn a computation into equations that a prover can satisfy and a verifier can check through a cryptographic protocol.',
        'The goal is not to run the program again. The goal is to prove that there exists a witness containing private inputs and intermediate values such that every constraint is true. Public inputs are bound to the statement, while private values remain hidden.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The obvious approach is to prove only the final expression. For example, say that y equals x^3 + x + 5 and stop there. That sounds compact, but it hides all intermediate values and all assumptions about field arithmetic, ranges, copying, and public binding.',
        'A malicious or buggy prover does not need to satisfy the intention in your head. It only needs to satisfy the equations you wrote. If the circuit omits a row, forgets to bind a public output, or leaves a derived value unconstrained, the proof can be valid for the wrong statement.',
      ],
    },
    {
      heading: 'The witness vector',
      paragraphs: [
        'R1CS starts by flattening computation into a witness vector. The vector usually contains a fixed one wire, private inputs, public inputs, and derived intermediate values. In the example y = x^3 + x + 5, the witness can hold one, x, x2, x3, and y.',
        'The witness is not trusted because the prover writes it down. It becomes meaningful only when the rows constrain it. The same witness slots are shared across all rows, so a value used in one multiplication is the same value referenced later by an output check.',
        'This shared slot discipline is the data-structure idea behind the circuit. If two expressions should use the same value, they must point at the same witness index or be connected by an explicit equality constraint. Names in source code do not matter after compilation unless they become constrained witness positions.',
      ],
    },
    {
      heading: 'A/B/C rows',
      paragraphs: [
        'Each R1CS row has the form A(w) * B(w) = C(w). A, B, and C are sparse linear forms over the same witness vector w. A row can select one wire, add several wires, multiply by constants, or represent a fixed value by using the one wire.',
        'The word rank-1 points to the bilinear shape: one linear combination times another linear combination equals a third. Multiplication is isolated into rows, while additions and constants are packed inside the linear combinations. That is why x3 + x + 5 can appear on one side of a row.',
        'Implementations usually store these forms as sparse matrices because most rows mention only a few witness entries. A large circuit may have many thousands or millions of rows, but each row is still a compact recipe for choosing witness terms and checking one equation.',
      ],
    },
    {
      heading: 'Building the example',
      paragraphs: [
        'For public y = 35 and private x = 3, the witness is [1, 3, 9, 27, 35]. The rows enforce x * x = x2, x2 * x = x3, (x3 + x + 5) * 1 = y, and y * 1 = 35. Every intermediate claim is tied to a row.',
        'This decomposition looks tedious, but the tedium is the security boundary. If x2 is not constrained, the prover could choose a fake square. If y is not bound to the public input, the prover could prove a private computation that says nothing about the value the verifier cares about.',
        'A useful way to review the example is to try to cheat it. Change x while keeping y fixed. Change x2 without changing x. Change y but leave the intermediate rows alone. Each attempt should break at least one row. If no row breaks, the circuit is missing part of the intended statement.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The witness-rows view shows source code becoming field wires. The table is not decorative bookkeeping. It is the private and public assignment that the prover claims can satisfy the circuit. Derived rows must be constrained because a derived value written into a witness is still just a claim.',
        'The constraint-check view shows the verifier-facing invariant: every row evaluates under one shared assignment. The bad-witness table separates two cases that are easy to confuse. A wrong assignment should reject. A missing constraint is worse because it may allow a proof to pass.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'R1CS works because local equations compose into a global statement. Each row checks one small relationship, and all rows reference the same witness. If every row is true at once, the witness satisfies the computation encoded by the constraint system.',
        'A zero-knowledge proof system then commits to the witness and proves satisfaction without revealing private slots. The cryptography can compress the check, but it does not repair the circuit. The proof is only as meaningful as the exact rows and public bindings that were encoded.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'R1CS is simple and widely taught, but it can be verbose. Range checks, bit decomposition, lookups, memory, and VM-style execution traces may require many rows unless the proving system has custom gates or a better arithmetization for that workload.',
        'The model also lives over a finite field. Normal integer intuition can fail because values wrap modulo the field prime. If a variable must be a byte, boolean, timestamp, array index, or nonzero divisor, the circuit must constrain that fact explicitly.',
        'There is also a maintenance cost. The circuit, witness generator, and public-input encoding must agree exactly. A witness generator bug can hide until a boundary case appears, and a public API change can silently change the statement unless tests include serialized public inputs and negative witnesses.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'R1CS is excellent for learning how zero-knowledge programs become algebra. It makes the witness, multiplication gates, sparse matrices, public inputs, and missing constraints visible. That makes it useful even when the final production system uses a different proof backend.',
        'It also fits computations that naturally decompose into arithmetic circuits. Hash preimage checks, signature verification components, small arithmetic programs, and educational circuits are good examples. The row structure gives reviewers a concrete object to audit.',
        'The format is also useful for debugging because each failed row can point back to a local relationship. That locality helps developers separate witness-generation mistakes from missing circuit constraints.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The most dangerous failure is proving the wrong thing. Common bugs include missing range checks, unconstrained advice values, forgotten copy constraints, unbound public inputs, division by zero, accepting field-wrapped integers, and assuming source-language control flow survived compilation.',
        'Another failure is treating the circuit compiler as magic. A compiler can generate rows, but the developer still needs to understand the statement. Circuit tests should include honest witnesses, bad witnesses, boundary values, and attempts to exploit every implicit assumption.',
        'Good audits ask what the verifier learns, not what the developer meant. They trace every public input into the rows, every private input into constrained use, and every branch condition into algebra. If the proof should imply a business rule, the rows must imply that rule too.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: the R1CS overview at https://alinush.github.io/r1cs and the Bulletproofs R1CS explanation at https://tlu.tarilabs.com/cryptography/rank-1.html. Read them with the witness vector in mind, not only the final equations.',
        'Study Sparse Matrix formats for storage, PLONK Permutation Grand Product for copy constraints, KZG Polynomial Commitments for compact openings, Finite Field Arithmetic for wraparound behavior, and Finite State Machine for transition-style constraint design.',
      ],
    },
  ],
};
