// ZK-SNARK arithmetization: turn a program claim into field constraints,
// commit to witness structure, and verify a succinct proof.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'zk-snark-arithmetization-case-study',
  title: 'ZK-SNARK Arithmetization',
  category: 'Security',
  summary: 'A zero-knowledge proof case study: translate a computation into arithmetic constraints, separate witness from public inputs, commit to polynomial columns, and verify a short proof.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['constraints', 'proof pipeline'], defaultValue: 'constraints' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function constraintGraph(title) {
  return graphState({
    nodes: [
      { id: 'code', label: 'code', x: 0.7, y: 3.9, note: 'x^3+x+5' },
      { id: 'circuit', label: 'gates', x: 2.6, y: 3.9, note: 'circuit' },
      { id: 'witness', label: 'witness', x: 3.9, y: 2.2, note: 'private x' },
      { id: 'public', label: 'public', x: 3.9, y: 5.6, note: 'y=35' },
      { id: 'constraints', label: 'rows', x: 5.9, y: 3.9, note: 'field eqs' },
      { id: 'satisfied', label: 'check', x: 7.4, y: 3.9, note: 'all zero' },
      { id: 'proof', label: 'proof', x: 9.2, y: 3.9, note: 'succinct' },
    ],
    edges: [
      { id: 'e-code-circuit', from: 'code', to: 'circuit' },
      { id: 'e-circuit-witness', from: 'circuit', to: 'witness' },
      { id: 'e-circuit-public', from: 'circuit', to: 'public' },
      { id: 'e-witness-constraints', from: 'witness', to: 'constraints' },
      { id: 'e-public-constraints', from: 'public', to: 'constraints' },
      { id: 'e-constraints-satisfied', from: 'constraints', to: 'satisfied' },
      { id: 'e-satisfied-proof', from: 'satisfied', to: 'proof' },
    ],
  }, { title });
}

function proofGraph(title) {
  return graphState({
    nodes: [
      { id: 'statement', label: 'statement', x: 0.7, y: 3.8, note: 'public' },
      { id: 'witness', label: 'witness', x: 0.7, y: 5.7, note: 'private' },
      { id: 'arith', label: 'arith', x: 2.7, y: 3.8, note: 'constraints' },
      { id: 'columns', label: 'columns', x: 4.5, y: 2.1, note: 'advice/fixed' },
      { id: 'commit', label: 'commits', x: 4.5, y: 5.4, note: 'poly' },
      { id: 'transcript', label: 'transcript', x: 6.5, y: 3.8, note: 'challenges' },
      { id: 'proof', label: 'proof', x: 8.0, y: 3.8, note: 'small' },
      { id: 'verify', label: 'verify', x: 9.3, y: 3.8, note: 'accept?' },
    ],
    edges: [
      { id: 'e-statement-arith', from: 'statement', to: 'arith' },
      { id: 'e-witness-arith', from: 'witness', to: 'arith' },
      { id: 'e-arith-columns', from: 'arith', to: 'columns' },
      { id: 'e-columns-commit', from: 'columns', to: 'commit' },
      { id: 'e-commit-transcript', from: 'commit', to: 'transcript' },
      { id: 'e-transcript-proof', from: 'transcript', to: 'proof' },
      { id: 'e-proof-verify', from: 'proof', to: 'verify' },
      { id: 'e-statement-verify', from: 'statement', to: 'verify' },
    ],
  }, { title });
}

function* constraintsView() {
  yield {
    state: constraintGraph('Start with a statement about a hidden value'),
    highlight: { active: ['code', 'circuit', 'e-code-circuit'], compare: ['proof'] },
    explanation: 'A ZK proof begins by turning a computation into arithmetic over a finite field. Example statement: I know x such that y = x^3 + x + 5, and the public output is y = 35. The witness is x = 3.',
    invariant: 'The proof system checks arithmetic constraints, not source code directly.',
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
        { id: 'value', label: 'value' },
        { id: 'visibility', label: 'visibility' },
      ],
      [
        ['1', 'fixed'],
        ['3', 'private'],
        ['9', 'derived'],
        ['27', 'derived'],
        ['35', 'public'],
      ],
    ),
    highlight: { active: ['x:value', 'x2:value', 'x3:value'], found: ['y:value'], compare: ['x:visibility'] },
    explanation: 'The witness vector stores the values that make the computation true. Some entries are public inputs; others remain private. Derived wires must still be constrained so the prover cannot invent them.',
  };

  yield {
    state: labelMatrix(
      'Arithmetic constraints',
      [
        { id: 'mul1', label: 'x*x' },
        { id: 'mul2', label: 'x2*x' },
        { id: 'sum', label: 'sum' },
      ],
      [
        { id: 'left', label: 'left' },
        { id: 'right', label: 'right' },
        { id: 'out', label: 'out' },
      ],
      [
        ['x', 'x', 'x2'],
        ['x2', 'x', 'x3'],
        ['x3+x+5', '1', 'y'],
      ],
    ),
    highlight: { active: ['mul1:left', 'mul1:right', 'mul1:out', 'mul2:out'], found: ['sum:out'] },
    explanation: 'A rank-1 style constraint has the shape left * right = out. Multiplication gates are direct. Additions can be folded into a linear expression multiplied by 1. With x = 3, the rows become 3*3=9, 9*3=27, and 27+3+5=35.',
  };

  yield {
    state: constraintGraph('All constraints must vanish for one shared assignment'),
    highlight: { active: ['witness', 'public', 'constraints', 'satisfied', 'e-witness-constraints', 'e-public-constraints', 'e-constraints-satisfied'], found: ['proof'] },
    explanation: 'The same witness must satisfy every row. That shared assignment is the real data structure: wires, public inputs, private advice, fixed constants, and row constraints all have to line up.',
  };

  yield {
    state: labelMatrix(
      'Bad witness fails',
      [
        { id: 'x3', label: 'x=3' },
        { id: 'x4', label: 'x=4' },
        { id: 'fake', label: 'fake x2' },
        { id: 'wrongy', label: 'wrong y' },
      ],
      [
        { id: 'rows', label: 'rows pass' },
        { id: 'result', label: 'result' },
      ],
      [
        ['all', 'prove ok'],
        ['sum fails', 'reject'],
        ['mul1 fails', 'reject'],
        ['public miss', 'reject'],
      ],
    ),
    highlight: { found: ['x3:result'], removed: ['x4:result', 'fake:result', 'wrongy:result'] },
    explanation: 'A ZK proof hides the witness; it does not let the prover skip constraints. If one row fails, the algebraic proof should fail even when the final public value looks plausible.',
  };
}

function* proofPipeline() {
  yield {
    state: proofGraph('Arithmetization separates statement, witness, and circuit shape'),
    highlight: { active: ['statement', 'witness', 'arith', 'e-statement-arith', 'e-witness-arith'], compare: ['verify'] },
    explanation: 'The public statement goes to both prover and verifier. The witness stays with the prover. Arithmetization defines the field, columns, rows, selectors, equality constraints, and lookup tables that both sides agree on.',
    invariant: 'Zero knowledge hides the witness, not the public statement or circuit contract.',
  };

  yield {
    state: labelMatrix(
      'PLONKish table',
      [
        { id: 'advice', label: 'advice' },
        { id: 'fixed', label: 'fixed' },
        { id: 'instance', label: 'instance' },
        { id: 'selector', label: 'selector' },
        { id: 'lookup', label: 'lookup' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['witness', 'private vals'],
        ['constants', 'circuit data'],
        ['public', 'verifier input'],
        ['0/1 gate', 'enable row'],
        ['table', 'range/check'],
      ],
    ),
    highlight: { active: ['advice:holds', 'fixed:holds', 'instance:holds'], found: ['selector:purpose', 'lookup:purpose'] },
    explanation: 'PLONKish circuits organize values as a rectangular matrix. Advice columns hold witness values, fixed columns hold circuit constants/selectors, and instance columns hold public inputs. Constraints apply row by row.',
  };

  yield {
    state: proofGraph('Polynomial commitments bind the prover to columns'),
    highlight: { active: ['columns', 'commit', 'transcript', 'e-columns-commit', 'e-commit-transcript'], found: ['arith'], compare: ['witness'] },
    explanation: 'Many modern proof systems encode columns as polynomials. The prover commits to those polynomials, receives transcript challenges, and then opens selected relationships. KZG Polynomial Commitments are one way to make those openings compact.',
  };

  yield {
    state: proofGraph('The verifier checks a short proof against public inputs'),
    highlight: { active: ['statement', 'proof', 'verify', 'e-proof-verify', 'e-statement-verify'], found: ['transcript'], compare: ['witness'] },
    explanation: 'The verifier does not replay the whole private computation. It checks a short proof, public inputs, verification key, commitments, and challenge-derived equations. Succinctness is the reason these systems are useful on-chain.',
  };

  yield {
    state: labelMatrix(
      'What the proof says',
      [
        { id: 'knowledge', label: 'knowledge' },
        { id: 'sound', label: 'soundness' },
        { id: 'zk', label: 'zero know' },
        { id: 'succinct', label: 'succinct' },
      ],
      [
        { id: 'meaning', label: 'meaning' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['has witness', 'extract model'],
        ['hard to fake', 'assumptions'],
        ['hides extra', 'leaks public'],
        ['short verify', 'prover cost'],
      ],
    ),
    highlight: { found: ['knowledge:meaning', 'sound:meaning', 'zk:meaning', 'succinct:meaning'], compare: ['succinct:caveat'] },
    explanation: 'The words in zk-SNARK are separate promises: zero knowledge hides witness details, succinctness keeps proof and verification small, non-interactive means one message, and argument of knowledge is a computational soundness claim.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'constraints') yield* constraintsView();
  else if (view === 'proof pipeline') yield* proofPipeline();
  else throw new InputError('Pick a ZK arithmetization view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a translation path from program claim to algebra. Active rows are constraints currently being checked, compare rows are witness values that must agree with them, and found rows are public statements already bound to the proof. A safe inference is this: the verifier trusts only the constraints, not the source-code comment that inspired them.',
        'A zk-SNARK is a zero-knowledge succinct non-interactive argument of knowledge. In plain terms, a prover can convince a verifier that a statement has a valid hidden witness, the proof is small, and no back-and-forth conversation is needed. Arithmetization is the step that turns the statement into finite-field equations.',
        {type: 'callout', text: 'Arithmetization is the security boundary where a human program claim becomes finite-field constraints that the proof system can actually check.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A verifier may need confidence that a private computation was done correctly without seeing the private inputs. A payment system might need proof that a balance is nonnegative. A rollup might need proof that many transactions followed the rules.',
        'Proof systems do not verify JavaScript, Rust, or Solidity directly. They verify algebra over a finite field, which is arithmetic modulo a prime or inside a similar finite set. Arithmetization exists because human program intent has to become equations a verifier can check.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to rerun the computation. If the verifier has all inputs and enough time, replay is clear and cheap to reason about. It fails when inputs are private or when replay on-chain would cost too much.',
        'Another approach is to hash the output and trust an attestation. That proves someone produced bytes, not that the computation obeyed the intended rules. A zk-SNARK needs a stronger object: constraints that accept exactly the witnesses that satisfy the statement.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that ordinary program operations are not native field operations. Addition and multiplication are natural in the field. Comparisons, byte ranges, overflow behavior, conditionals, array bounds, and hash functions need extra constraints.',
        'This is where security bugs enter. A variable named byte is not a byte unless the circuit constrains it to 0 through 255. A public amount is not bound unless the circuit connects the witness calculation to the public input the verifier sees.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to express computation as a set of local algebraic obligations. A witness is the hidden assignment to all private and intermediate variables. A constraint system accepts the witness only when every required equation holds.',
        'Different systems arrange those obligations differently. R1CS uses equations shaped like A(w) * B(w) = C(w), where A, B, and C are linear expressions over the witness. PLONKish systems arrange values in rows and columns, then use gate constraints, equality constraints, and lookups.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a small arithmetic circuit, the compiler introduces wires for intermediate values. To prove y = x^3 + x + 5, it can create x2 and x3, then constrain x * x = x2, x2 * x = x3, and x3 + x + 5 = y. The prover supplies values for x, x2, and x3.',
        'In a PLONKish table, advice columns hold witness values, instance columns hold public inputs, and fixed columns hold selectors or constants. A selector can turn a gate on for one row and off for another. A lookup can prove that a value belongs to a fixed table, such as a byte table containing 0 through 255.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is constraint satisfaction. If the verifier accepts, then under the proof system assumptions the committed witness columns satisfy the agreed constraints for the public inputs. The proof is about the algebraic statement, so the statement must be written correctly.',
        'Zero knowledge is separate from correctness. It hides witness values beyond what the public inputs and proof reveal. It does not hide public inputs, circuit shape, metadata outside the proof, or bugs caused by missing constraints.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Verifier work can be small while prover work is large. A circuit with 1,000 rows may prove quickly, while a circuit with 10,000,000 rows may need serious CPU, memory, or GPU work. When rows double, witness generation and polynomial work usually grow roughly with the number of rows, even if verification stays compact.',
        'The hidden cost is unnatural operations. A field multiplication may be one gate, but a 32-bit comparison may require bit decomposition or lookup constraints. Custom gates and lookups reduce row count, but they create more circuit code that reviewers must audit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Arithmetized SNARKs fit private payments, rollup validity proofs, membership proofs, solvency proofs, bridge checks, and verifiable outsourced computation. The fit is strongest when verification is expensive or public, while proving can happen off the hot path. Blockchain verification is the standard example because on-chain work is costly and public forever.',
        'They also fit compliance and credential systems where the verifier needs a narrow fact rather than the raw data. For example, a proof can show an age is at least 18 if the circuit constrains the credential signature, the birth date, and the comparison. If any of those links is missing, the proof may verify the wrong claim.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams treat generated circuits as unreviewable build artifacts. The verifier trusts the circuit, not the prose description. An unconstrained advice cell can let a prover choose a convenient value that no real program execution would produce.',
        'It also fits poorly for computations with huge memory, complex strings, floating point, or branch-heavy logic that does not map cleanly into field constraints. The circuit may be correct but too slow to prove. A plain signature, audit log, or deterministic replay can be better when privacy and succinct verification are not needed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use the statement y = x^3 + x + 5 with public y = 35 and private x = 3. The witness sets x = 3, x2 = 9, and x3 = 27. The constraints check 3 * 3 = 9, 9 * 3 = 27, and 27 + 3 + 5 = 35.',
        'Now change the witness to x = 4 while keeping y = 35. The first constraints can set x2 = 16 and x3 = 64, but the final equation becomes 64 + 4 + 5 = 73, not 35. A valid proof cannot use that witness unless the circuit forgot to bind the final value to the public input.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with the Zcash zk-SNARK overview at https://z.cash/learn/what-are-zk-snarks/ and the halo2 PLONKish arithmetization chapter at https://zcash.github.io/halo2/concepts/arithmetization.html. Then read the PLONK paper at https://eprint.iacr.org/2019/953 for the protocol family behind many PLONKish systems.',
        'Study R1CS Witness Constraint Matrix Primer for the older constraint model, FRI Low-Degree Folding Proof Case Study for a STARK-side polynomial engine, Sparse Merkle Tree Non-Membership for a proof-friendly data structure, and Verkle Trees Stateless Clients for commitment-based verification.',
      ],
    },
  ],
};
