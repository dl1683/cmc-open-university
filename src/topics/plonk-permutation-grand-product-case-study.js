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
      heading: 'Why this exists',
      paragraphs: [
        `A proving circuit is not only a list of arithmetic gates. It is also a wiring diagram. The same hidden value may appear in a multiplication gate, a range-check decomposition, a lookup input, a public-input binding row, and a later state-transition row. If those appearances are meant to be the same logical value, the proof system must enforce that fact.`,
        `Local gate constraints are not enough. A row can satisfy its arithmetic equation while using the wrong copy of a value. In a normal program, a variable name carries identity. In a PLONKish table, values live in cells: column A row 1, column B row 2, column C row 4, and so on. The proof system needs an efficient way to say that selected cells are the same wire even when they are far apart in the table.`,
      ],
    },
    {
      heading: 'Why local checks fail',
      paragraphs: [
        `Imagine a circuit that proves a private balance was updated correctly. One row checks the old balance, another row checks a withdrawal amount, and a later row checks the new balance. Each row can be locally valid. The bug appears if the old balance used in one row is not actually the old balance used in the next row. The circuit has proved several true statements about unrelated values.`,
        `This is the separation that makes PLONK permutation arguments important. Arithmetic constraints describe what each row computes. Copy constraints describe which cells are the same logical variable across the whole witness table. A circuit without correct copy constraints is like a spreadsheet whose formulas are right but whose cell references point to the wrong places.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The direct method is to add an equality constraint every time two cells should match. If A1 must equal B2, add a constraint. If B2 must equal C4, add another constraint. For a small hand-written circuit this is easy to understand, and it matches the way many people first learn constraint systems.`,
        `The approach does not scale cleanly in a universal columnar proving system. A real circuit may have many advice columns, repeated rotations, copied intermediate values, public input bindings, selector-controlled custom gates, and lookup arguments. Equality is not a small side note; it is a global relation over cell addresses. Encoding every equality as a separate gate bloats the layout and makes reviews harder because wiring is mixed into arithmetic.`,
      ],
    },
    {
      heading: 'The data model',
      paragraphs: [
        `A PLONKish circuit is often best pictured as a constrained spreadsheet. Advice columns hold witness values chosen by the prover. Fixed columns and selectors describe the circuit shape. Rows give a shared evaluation domain. A cell address is not just a value; it is a position in this table.`,
        `Copy constraints are then a relation over addresses. If A1, B2, and C4 all represent x, those three addresses belong to one equality class. If A2 and B3 represent y, they belong to another class. The prover is free to choose witness values, but once the columns are committed, the proof must show that every equality class is internally consistent.`,
      ],
    },
    {
      heading: 'The core mechanism',
      paragraphs: [
        `PLONK encodes equality classes as cycles in a permutation. In the small example, the permutation sends A1 to B2, B2 to C4, and C4 back to A1. A second cycle might send A2 to B3 and B3 back to A2. The map is fixed by the circuit, not invented by the prover after seeing the witness.`,
        `The check is not that the verifier opens every cell and compares values. That would reveal the witness and cost too much. Instead, the prover commits to the witness columns, receives random transcript challenges, and proves a polynomial relationship showing that the witness values line up with the permutation. The equality check becomes a compact algebraic claim about a grand-product accumulator.`,
      ],
    },
    {
      heading: 'Grand product in plain terms',
      paragraphs: [
        `A grand product is a running product over many small ratios. For each row, the numerator represents the current cell-value-address terms. The denominator represents the permuted cell-value-address terms. If the permutation really only rearranges equal values inside each copy cycle, the products telescope and the accumulator returns to the required boundary value.`,
        `If one copied cell is wrong, the ratio changes. The accumulator no longer follows a path that can satisfy the transition rule and the final boundary condition at the same time. The verifier does not need to inspect every equality. It checks the committed accumulator polynomial, the boundary constraints, and a few openings tied to the transcript challenges.`,
      ],
    },
    {
      heading: 'Why beta and gamma matter',
      paragraphs: [
        `The random challenges usually called beta and gamma mix a witness value with its cell identity. This matters because a bare multiset of values would be too weak. If two cycles both contain the value 7, the prover should not be able to swap addresses between them and still pass. The address terms make the claim about value-at-position, not just value count.`,
        `Randomness also blocks a prover from crafting a fake collision after the fact. The columns are committed before beta and gamma are known. Once the challenges arrive, a wrong permutation would need an unlikely algebraic coincidence to make the products match. That is the soundness intuition: many equality contracts are compressed into one random linearized product check.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Use the cells in the visual model. A1, B2, and C4 are meant to hold x. A2 and B3 are meant to hold y. The permutation cycles are A1 -> B2 -> C4 -> A1 and A2 -> B3 -> A2. If the witness table stores x at A1 and B2 but stores x-prime at C4, every local gate touching C4 may still be satisfied. The wiring claim is the part that fails.`,
        `The grand product catches the problem because the term for C4 no longer matches the term that should appear when the cycle is permuted. The accumulator can start at 1 or satisfy the row transitions or return to 1 at the end, but not all of them for the committed data. That is why the failure shows up as a polynomial consistency failure rather than a visible value comparison.`,
      ],
    },
    {
      heading: 'Prover and verifier roles',
      paragraphs: [
        `The prover builds the witness columns, commits to them, computes the permutation accumulator Z, and opens the relevant polynomials at verifier-selected points. The prover also supplies quotient-polynomial pieces that combine the gate constraints, permutation transition, and boundary constraints into the proof system's main algebraic check.`,
        `The verifier checks commitments, transcript-derived challenges, polynomial openings, the starting condition for Z, the row-by-row transition identity, and the final condition that says the cycles closed correctly. The verifier is not replaying the circuit row by row. It is checking that a small number of polynomial identities are consistent with committed tables.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `For circuit builders, the practical rule is simple: every logical reuse of a value needs an explicit equality mechanism. Column labels, variable names in host code, and comments do not create copy constraints. If the circuit DSL has an enable_equality step, a copy_advice call, or an assignment API that returns cell handles, review where those handles are constrained.`,
        `Keep copy-cycle construction close to the circuit's logical dataflow. Public inputs should be wired deliberately. Range-check limbs should be tied back to the original value. State-machine rows should carry previous and next state through explicit cells. When debugging a failed proof, separate arithmetic failures from permutation failures; the same bad witness can trigger both, but the fixes are different.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The permutation argument only enforces the map it was given. If the circuit forgot that two cells should be equal, the proof system will not infer that equality from their names. If the circuit maps the wrong cells into the same cycle, it may enforce an unintended equality and reject valid witnesses or, worse, accept a proof for the wrong statement.`,
        `Other common errors are missing boundary checks for the grand product, using the wrong selector around the transition identity, mixing columns with different rotations incorrectly, mishandling public-input rows, and confusing a lookup argument with a copy argument. Lookups prove membership in a table. Permutations prove equality across addressed cells. They often work together, but they are not the same check.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `Permutation arguments are one reason PLONKish systems are ergonomic. They let circuit authors use a reusable column layout while still tying values together across distant rows. That supports custom gates, lookup-heavy circuits, recursive-verification layouts, state machines, and circuits generated from higher-level languages.`,
        `They also give reviewers a concrete audit question. When the circuit says two appearances are the same value, ask which copy cycle proves it. If the answer is a gate equation, check whether that equation really binds both addresses. If the answer is only a source-level variable name, the proof may be missing a wiring constraint.`,
      ],
    },
    {
      heading: 'Connections',
      paragraphs: [
        `The older R1CS model exposes wiring differently because variables are shared across constraint rows. PLONK moves more of the shape into columns, selectors, rotations, and permutation maps. That shift makes the data structure richer: the witness is a table, the wiring is a permutation over cell addresses, and the verifier's work is a collection of polynomial opening checks.`,
        `The same design habit appears in other systems. Sparse matrices separate values from row and column positions. Database indexes separate key order from row payload. Here the position is cryptographic: the proof must bind a hidden value to the exact cell where the circuit says it lives.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: PLONK at https://eprint.iacr.org/2019/953 and the Protocol Labs paper page at https://research.protocol.ai/publications/plonk-permutations-over-lagrange-bases-for-oecumenical-noninteractive-arguments-of-knowledge/gabizon2019a.pdf.`,
        `Study R1CS Witness Constraint Matrix for the older row-oriented model, ZK-SNARK Arithmetization for the translation from computation to constraints, KZG Polynomial Commitments for the opening checks, FRI Low-Degree Folding for a different proof-family backend, and Sparse Format Selection for intuition about storing large structured constraint systems.`,
      ],
    },
  ],
};
