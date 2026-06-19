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
      heading: 'How to read the animation',
      paragraphs: [
        'The witness-rows view shows a computation being flattened into field elements. Active cells are the witness values currently being assigned. Found cells mark the public output that the verifier will see. Compared cells show visibility labels -- which values are private, which are derived, and which are public.',
        'The constraint-check view shows each R1CS row evaluating under a single shared witness assignment. Found cells confirm that the left-hand product equals the right-hand side. Removed cells flag a bad witness or a missing constraint -- the two failure modes you must learn to distinguish.',
        {
          type: 'diagram',
          label: 'Witness vector satisfying A*w . B*w = C*w',
          text: [
            '  w = [1, x, x2, x3, y]        (witness vector)',
            '',
            '  For each constraint row i:',
            '',
            '    A_i * w  -->  left linear combination   (e.g. x)',
            '    B_i * w  -->  right linear combination  (e.g. x)',
            '    C_i * w  -->  output linear combination (e.g. x2)',
            '',
            '    check:  (A_i . w) * (B_i . w) = (C_i . w)',
            '',
            '  Row 1:  [0,1,0,0,0].w * [0,1,0,0,0].w = [0,0,1,0,0].w',
            '          x * x = x2                                    ',
            '  Row 2:  [0,0,1,0,0].w * [0,1,0,0,0].w = [0,0,0,1,0].w',
            '          x2 * x = x3                                   ',
            '  Row 3:  [5,1,0,1,0].w * [1,0,0,0,0].w = [0,0,0,0,1].w',
            '          (x3+x+5) * 1 = y                              ',
            '',
            '  All rows share one w. Change one slot, break a row.',
          ].join('\n'),
        },
        'At each animation frame, ask: what relationship does this row enforce, and what could a cheating prover exploit if this row were missing?',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A zero-knowledge proof lets a prover convince a verifier that a statement is true without revealing private inputs. But proof systems do not understand programs. They understand equations over finite fields. Something has to translate "I know x such that x^3 + x + 5 = 35" into algebra that a cryptographic protocol can check. That translation layer is called arithmetization, and R1CS -- rank-1 constraint systems -- is the most widely taught form of it.',
        'R1CS was popularized by the Groth16 proving system (Groth, 2016), which remains the most gas-efficient SNARK for on-chain verification on Ethereum. Groth16 requires its input as an R1CS instance. Every Circom circuit, every snarkjs proof, and every Groth16-based rollup component compiles down to R1CS constraints before the cryptography begins.',
        'The constraint system is the security boundary. The cryptography guarantees that a valid proof implies a satisfying witness exists. But if the constraints do not encode the intended computation, the proof proves the wrong thing. Understanding R1CS is understanding what a zero-knowledge proof actually promises.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to express the entire computation as one equation and prove it directly. For y = x^3 + x + 5, just check that the claimed output matches the polynomial evaluated at the secret input. One equation, one check, done.',
        'This works for toy expressions, but it hides all intermediate structure. The verifier cannot tell whether the prover actually computed x^2 before x^3, or whether the prover just picked values that happen to satisfy the final equation. There is no place to enforce range constraints, no way to bind public inputs to specific wire positions, and no mechanism to catch a prover who uses different values for "x" in different parts of the computation.',
        'A second natural idea is to send the full execution trace to the verifier. That proves everything, but it reveals the private inputs. The entire point of zero-knowledge is that the verifier learns the statement is true without seeing the witness.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that multiplication over a field is not linear. Addition and scalar multiplication can be checked with a single linear equation, but the moment you multiply two unknown variables together, you need a fundamentally different kind of constraint. A system of purely linear equations cannot express x * x = x2 because both x and x2 are unknowns.',
        'This is not a minor inconvenience. Every interesting computation involves multiplications: squaring, polynomial evaluation, hash functions (which mix bits via AND, equivalent to multiplication modulo 2), signature verification, and comparison operations (which decompose into bit multiplications). A constraint system that cannot isolate multiplications cannot express real programs.',
        'The wall also has a security face. If you allow unconstrained intermediate values, the prover can satisfy the final output equation by choosing internally inconsistent values. The constraint system must force every intermediate wire to be consistent with the wires that feed into it. One missing constraint can make a proof meaningless.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'R1CS solves the multiplication wall by isolating every multiplication into its own constraint row. Each row has the form (A_i . w) * (B_i . w) = (C_i . w), where w is the witness vector and A_i, B_i, C_i are sparse row vectors that select linear combinations of witness elements. Addition and scalar multiplication are free -- they fold into the linear combinations on either side of the multiplication.',
        'The witness vector w holds every value the prover needs: a constant 1 wire at position 0, private inputs, public inputs, and all intermediate values. For y = x^3 + x + 5 with x = 3, the witness is w = [1, 3, 9, 27, 35]. The prover fills in every slot; the constraint rows check that the slots are mutually consistent.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Flattening x^3 + x + 5 into R1CS constraints',
            '// Witness vector: w = [1, x, x2, x3, y]',
            '//                      w0 w1  w2  w3  w4',
            '',
            '// Step 1: Introduce intermediate wires',
            '//   x2 = x * x',
            '//   x3 = x2 * x',
            '//   y  = x3 + x + 5  (addition is free, folded into a row)',
            '',
            '// Step 2: Write each multiplication as a rank-1 constraint',
            '// Row 0:  A=[0,1,0,0,0]  B=[0,1,0,0,0]  C=[0,0,1,0,0]',
            '//         x * x = x2',
            '',
            '// Row 1:  A=[0,0,1,0,0]  B=[0,1,0,0,0]  C=[0,0,0,1,0]',
            '//         x2 * x = x3',
            '',
            '// Row 2:  A=[5,1,0,1,0]  B=[1,0,0,0,0]  C=[0,0,0,0,1]',
            '//         (5*1 + x + x3) * 1 = y',
            '',
            '// Step 3: Verify with w = [1, 3, 9, 27, 35]',
            '//   Row 0: 3 * 3 = 9    check',
            '//   Row 1: 9 * 3 = 27   check',
            '//   Row 2: (5+3+27)*1 = 35  check',
          ].join('\n'),
        },
        'The A, B, C matrices are sparse because each row typically references only 1-3 witness entries. A circuit with m constraints and n witness variables stores three m-by-n matrices, but the total number of nonzero entries is proportional to the number of wires referenced, not m*n. Implementations use compressed sparse row (CSR) format.',
        'Circuit compilation from a high-level language like Circom automates this flattening. The Circom compiler parses a domain-specific language with templates and signals, flattens every multiplication into a constraint, generates the A/B/C matrices as an R1CS file, and produces a witness-generation program (usually in WASM or C++) that computes all intermediate values from the inputs. The developer writes logic; the compiler produces the constraint system and the witness generator.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'R1CS works because of two properties: completeness of decomposition and shared-witness consistency. Any polynomial-time computation can be decomposed into a sequence of additions and multiplications over a field. Since additions fold into the linear combinations and each multiplication gets its own row, R1CS can represent any such computation. This is the completeness argument -- nothing computable is out of reach.',
        'The shared-witness property provides soundness. Every row references the same vector w. If row 0 uses w[1] as "x" and row 1 also uses w[1], the prover cannot use x=3 in one row and x=4 in another. The single assignment forces global consistency. A satisfying witness is a single coherent execution trace, not a collection of independently satisfied equations.',
        'When R1CS feeds into Groth16, the constraint system is converted to a Quadratic Arithmetic Program (QAP) by interpolating the A/B/C matrices into polynomials. The prover then proves polynomial divisibility, which compresses the check from m individual row equations into one pairing-based verification. The R1CS structure is what makes this polynomial encoding possible -- each row is degree-2, and the rank-1 form maps cleanly to the QAP polynomial identity.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Constraint count is the primary cost metric. Each multiplication in the original computation requires one R1CS row. A SHA-256 hash takes roughly 25,000 constraints. An EdDSA signature verification takes roughly 7,000. A Merkle proof with depth 20 using Poseidon hashes takes roughly 12,000. Doubling the computation roughly doubles the constraint count.',
        {
          type: 'table',
          headers: ['Operation', 'Approximate R1CS constraints', 'Why'],
          rows: [
            ['Field multiplication', '1', 'One rank-1 row per multiplication'],
            ['Field addition', '0', 'Folded into linear combinations for free'],
            ['Range check (n bits)', 'n', 'One boolean constraint per bit'],
            ['SHA-256 hash', '~25,000', 'Bitwise ops become field arithmetic'],
            ['Poseidon hash', '~250', 'Designed for field-native efficiency'],
            ['EdDSA verify', '~7,000', 'Scalar multiplication over an elliptic curve'],
          ],
        },
        'Groth16 proving time scales roughly linearly with constraint count, dominated by two multi-scalar exponentiations (MSMs) over the constraint matrices. Verification is constant-time: three pairings regardless of circuit size, which is why Groth16 is popular for on-chain verification where gas matters. The trusted setup is circuit-specific -- changing the circuit requires a new ceremony.',
        {
          type: 'note',
          text: 'Constraint count is not the only cost. Witness generation time, memory for the proving key (which grows with constraints), and trusted setup complexity all scale with circuit size. A circuit with 2^20 constraints needs a proving key of several hundred megabytes.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'R1CS paired with Groth16 remains the gold standard for succinct on-chain verification. The proof is 3 group elements (~128 bytes on BN254), and verification costs ~230,000 gas on Ethereum. No other proving system matches this verification cost. Zcash Sapling, Tornado Cash, and many ZK-rollup components use Groth16 over R1CS for exactly this reason.',
        'R1CS is also the best entry point for learning zero-knowledge proof systems. The constraint structure is concrete and auditable -- you can print the A/B/C matrices, substitute witness values, and check each row by hand. This transparency makes bugs visible in a way that polynomial IOPs and lookup arguments do not.',
        'The Circom ecosystem built around R1CS is the most mature circuit development toolchain. circomlib provides audited templates for hashing (Poseidon, MiMC), signatures (EdDSA), Merkle proofs, and comparators. snarkjs handles trusted setup, proving, and verification in JavaScript. This ecosystem lowers the barrier from "understand the math" to "compose existing templates."',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'R1CS is verbose for operations that are not naturally arithmetic. Bitwise operations (AND, XOR, shift) require decomposing field elements into individual bits, constraining each bit to be boolean (b * (1 - b) = 0), performing the operation bit by bit, and reconstructing the result. SHA-256 costs ~25,000 constraints primarily because of this bit decomposition overhead. Newer arithmetizations with lookup tables (Plonkish, AIR) handle bitwise operations far more efficiently.',
        {
          type: 'table',
          headers: ['Constraint system', 'Gate shape', 'Custom gates', 'Lookups', 'Copy constraints', 'Primary proving systems'],
          rows: [
            ['R1CS', 'A*w . B*w = C*w (bilinear)', 'No', 'No', 'Implicit (shared witness)', 'Groth16, Marlin, Spartan'],
            ['QAP', 'Polynomial form of R1CS', 'No', 'No', 'Via polynomial identity', 'Groth16 (internal)'],
            ['Plonkish', 'q_L*a + q_R*b + q_M*a*b + q_O*c + q_C = 0', 'Yes (custom selectors)', 'Yes (Plookup)', 'Permutation argument', 'PLONK, Halo2, UltraPLONK'],
            ['AIR', 'Transition polynomials over trace columns', 'Yes (any degree)', 'Yes (LogUp)', 'Boundary constraints', 'STARKs (Stone, Winterfell)'],
          ],
        },
        'The Groth16 trusted setup is circuit-specific. Every time the circuit changes -- even adding one constraint -- the setup must be repeated. The setup ceremony requires multi-party computation to ensure that no single participant knows the toxic waste. Universal setups (PLONK, Marlin) and transparent setups (STARKs) avoid this entirely.',
        'The most dangerous failure mode is underconstrained circuits. If a developer forgets a range check, omits a public-input binding, or leaves an intermediate wire unconstrained, the proof system will happily produce valid proofs for false statements. The cryptography is sound; the circuit is not. Circom does not catch all underconstraint bugs -- they require manual audit or formal verification tools like Ecne or Picus.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'The prover creates a proof that convinces the verifier that there exists a witness w such that A*w . B*w = C*w for all constraint rows simultaneously.',
          attribution: 'Jens Groth, "On the Size of Pairing-based Non-interactive Arguments," EUROCRYPT 2016',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Groth, "On the Size of Pairing-based Non-interactive Arguments," EUROCRYPT 2016. Defines the R1CS-to-QAP pipeline and the Groth16 construction.',
            'Implementation reference: Circom documentation, https://docs.circom.io/ -- the standard toolchain for R1CS circuit development.',
            'Tutorial: Vitalik Buterin, "Quadratic Arithmetic Programs: from Zero to Hero," 2016. Walks through R1CS flattening and QAP conversion with worked examples.',
            'Underconstraint analysis: Pailoor et al., "Automated Detection of Under-Constrained Circuits," IEEE S&P 2023. Formalizes the class of bugs that R1CS audits must catch.',
          ],
        },
        'Study Finite Field Arithmetic first if modular arithmetic is unfamiliar -- R1CS lives over a prime field and integer intuition breaks at the field boundary. Study Sparse Matrix formats to understand the A/B/C storage layout. After R1CS, study the QAP transformation to see how constraint rows become polynomial divisibility, then PLONK permutation arguments to see how a newer arithmetization handles copy constraints and custom gates without the R1CS bilinear restriction.',
      ],
    },
  ],
};

