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
      heading: 'The real problem',
      paragraphs: [
        'A zk-SNARK is useful when a verifier needs confidence that a computation was done correctly, but the prover should not reveal the private inputs and the verifier should not rerun the whole computation. The public statement might be "this transaction is valid", "this committed balance is nonnegative", or "I know a preimage of this hash."',
        'Proof systems do not verify source code directly. They verify algebra. Arithmetization is the translation from program intent into finite-field constraints, witness columns, public inputs, fixed tables, and polynomial relations.',
        {type: 'callout', text: 'Arithmetization is the security boundary where a human program claim becomes finite-field constraints that the proof system can actually check.'},
      ],
    },
    {
      heading: 'What the proof actually checks',
      paragraphs: [
        'A SNARK proof says that there exists a witness satisfying an agreed constraint system for the public inputs. It does not say the original Rust, JavaScript, Solidity, or Circom source was correct in a human sense. It says the compiled algebraic contract was satisfied.',
        'That distinction is the security boundary. If the circuit forgets a range check, binds the wrong public input, allows an unconstrained advice cell, or encodes a branch incorrectly, the proof system can still produce a valid proof for the wrong language.',
      ],
    },
    {
      heading: 'Finite-field arithmetic',
      paragraphs: [
        'The field is not ordinary integer arithmetic. Values live modulo a large prime or inside another finite field. Addition and multiplication are cheap native operations for the proof system, but comparison, bit decomposition, overflow rules, and byte encodings must be added as constraints.',
        'This is why "x is between 0 and 255" is not implied by a field element named x. The circuit must constrain x as a byte, usually through bit constraints, lookup tables, or range-check gadgets.',
      ],
    },
    {
      heading: 'A small arithmetization',
      paragraphs: [
        'For the claim y = x^3 + x + 5 with public y = 35 and private x = 3, the circuit introduces intermediate wires x2 and x3. It constrains x * x = x2, x2 * x = x3, and x3 + x + 5 = y.',
        'The prover supplies the witness assignment: x = 3, x2 = 9, x3 = 27. The verifier sees y = 35. The proof should convince the verifier that some private assignment makes every row true, without revealing x.',
      ],
    },
    {
      heading: 'R1CS and PLONKish tables',
      paragraphs: [
        'In an R1CS-style model, each constraint has the shape A(w) * B(w) = C(w), where A, B, and C are linear combinations over the witness vector. Multiplication is explicit, and additions are folded into linear expressions.',
        'In a PLONKish model such as halo2, values sit in a rectangular matrix of rows and columns over a finite field. Advice columns hold witness values, fixed columns hold circuit constants or selector data, instance columns usually hold public inputs, equality constraints copy values, and lookup arguments prove membership in fixed tables.',
      ],
    },
    {
      heading: 'Proof pipeline',
      paragraphs: [
        'The prover builds witness columns, commits to polynomial encodings of those columns, receives transcript challenges through a Fiat-Shamir transform, and opens selected polynomial relationships. Different SNARK families use different commitment schemes and setup assumptions, but the high-level flow is commitment, challenge, opening, verification.',
        'The verifier checks a short proof against the public inputs and a verification key for the circuit. Succinct verification is the payoff: the verifier does not replay the whole private computation or read every witness value.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Soundness comes from making cheating equivalent to breaking the algebraic protocol assumptions. A prover should not be able to commit to columns that satisfy the verifier checks unless those columns encode a valid witness for the circuit.',
        'Zero knowledge is a separate property. It hides witness information beyond what the public statement and proof system intentionally reveal. It does not hide public inputs, circuit shape, proof timing, transaction metadata, or information leaked outside the circuit.',
      ],
    },
    {
      heading: 'Complete case study: private solvency',
      paragraphs: [
        'A wallet wants to prove it controls committed balances whose total covers a withdrawal, without revealing individual balances. The public statement includes commitments, the withdrawal amount, and the account identifier. The witness includes balances, blinding factors, ownership keys, and signature material.',
        'The circuit must constrain commitment openings, ownership, nonnegative ranges, uniqueness of notes, and the sum relation. If balances are field elements without range checks, a value that behaves like a negative number modulo the field may pass. If the account identifier is not bound to the public input, the proof may describe the wrong account.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Verification can be tiny while proving is expensive. Provers may spend significant CPU, memory, GPU, or specialized hardware time generating witness data, evaluating polynomials, running FFT-like routines, building commitments, and opening equations.',
        'Custom gates and lookup tables can reduce rows, but they add their own soundness obligations. A lookup only proves membership in the table relation that was actually constrained. A custom gate only enforces the polynomial identity that was written.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Arithmetized SNARKs fit high-value statements that can be expressed as constraints: rollup validity, private payments, membership proofs with hidden paths, credentials, solvency checks, bridge validity, and outsourced computation.',
        'They are strongest when verification must be cheap or public, while proving can be done by a specialized prover. On-chain verification is the classic case, because the verifier is expensive and public data is permanent.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fits poorly when the computation is huge, branchy, string-heavy, floating-point-heavy, or full of operations that are unnatural over a finite field. The circuit may become too large, too slow to prove, or too hard to audit.',
        'It also fails organizationally when teams treat the circuit as a generated artifact nobody reviews. The circuit is the program the verifier trusts. It deserves the same scrutiny as consensus code or cryptographic protocol code.',
      ],
    },
    {
      heading: 'What the diagram emphasizes',
      paragraphs: [
        'The constraints view follows the translation from code to gates, witness, public input, rows, and proof. The matrix frame makes the hidden assignment concrete: private values, derived values, and public values must satisfy every row together.',
        'The proof pipeline view separates roles. Statement and witness enter arithmetization differently; columns are committed before challenges; the verifier receives only the proof, public inputs, and verification key. That separation is the reason the proof can be both private and succinct.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Write the public statement before writing the circuit. List every value the verifier must bind: commitments, roots, amounts, nullifiers, chain ids, domain separators, timestamps, or program hashes. If a value matters outside the proof, it should be either public input or cryptographically linked to a public input.',
        'Treat unconstrained advice as a bug until proven otherwise. Add tests that mutate each witness column and expect verification to fail. Add range-check tests around field wraparound, byte decomposition, and boundary values such as 0, 1, maximum allowed value, and one above maximum.',
        'Keep circuit metrics in review: row count, column count, lookup table size, proving time, memory, verification cost, setup assumptions, and trusted parameters. A circuit can be logically correct and still too expensive for the product path.',
      ],
    },
    {
      heading: 'Primary references',
      paragraphs: [
        'Zcash describes zk-SNARKs as zero-knowledge, succinct, non-interactive arguments of knowledge where a prover can show possession of information without revealing it: https://z.cash/learn/what-are-zk-snarks/.',
        'The halo2 book describes PLONKish arithmetization as rows, columns, finite-field cells, fixed/advice/instance columns, equality constraints, polynomial constraints, and lookup arguments: https://zcash.github.io/halo2/concepts/arithmetization.html.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Zcash zk-SNARK overview at https://z.cash/learn/what-are-zk-snarks/, halo2 PLONKish arithmetization at https://zcash.github.io/halo2/concepts/arithmetization.html, and the PLONK paper at https://eprint.iacr.org/2019/953.',
        'Study Shamir Secret Sharing, KZG Polynomial Commitment Opening Case Study, Binary Exponentiation, Verkle Trees & Stateless Clients, Sparse Merkle Tree Non-Membership, and Software Supply Chain Provenance Graph next.',
      ],
    },
  ],
};
