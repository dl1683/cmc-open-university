// SMT solving: combine a SAT search with theory solvers for arithmetic,
// bit-vectors, arrays, datatypes, and uninterpreted functions.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'smt-solver-theory-combination-case-study',
  title: 'SMT Solver Theory Combination Case Study',
  category: 'Concepts',
  summary: 'A solver-internals primer: boolean skeletons, DPLL(T), theory atoms, bit-vectors, arrays, arithmetic, uninterpreted functions, lemmas, models, and unsat cores.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['sat plus theories', 'model or unsat'], defaultValue: 'sat plus theories' },
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

function solverGraph(title) {
  return graphState({
    nodes: [
      { id: 'formula', label: 'formula', x: 0.7, y: 3.5, note: 'SMT' },
      { id: 'atoms', label: 'atoms', x: 2.2, y: 1.8, note: 'theory' },
      { id: 'sat', label: 'SAT core', x: 2.2, y: 5.2, note: 'bool' },
      { id: 'arith', label: 'arith', x: 4.0, y: 1.4, note: 'linear' },
      { id: 'bv', label: 'bitvec', x: 4.0, y: 3.5, note: 'fixed' },
      { id: 'array', label: 'array', x: 4.0, y: 5.6, note: 'select' },
      { id: 'lemma', label: 'lemma', x: 5.9, y: 3.5, note: 'learn' },
      { id: 'model', label: 'model', x: 7.6, y: 2.0, note: 'sat' },
      { id: 'unsat', label: 'unsat', x: 7.6, y: 5.0, note: 'core' },
      { id: 'client', label: 'client', x: 9.0, y: 3.5, note: 'test/proof' },
    ],
    edges: [
      { id: 'e-formula-atoms', from: 'formula', to: 'atoms' },
      { id: 'e-formula-sat', from: 'formula', to: 'sat' },
      { id: 'e-atoms-arith', from: 'atoms', to: 'arith' },
      { id: 'e-atoms-bv', from: 'atoms', to: 'bv' },
      { id: 'e-atoms-array', from: 'atoms', to: 'array' },
      { id: 'e-arith-lemma', from: 'arith', to: 'lemma' },
      { id: 'e-bv-lemma', from: 'bv', to: 'lemma' },
      { id: 'e-array-lemma', from: 'array', to: 'lemma' },
      { id: 'e-lemma-sat', from: 'lemma', to: 'sat' },
      { id: 'e-sat-model', from: 'sat', to: 'model' },
      { id: 'e-sat-unsat', from: 'sat', to: 'unsat' },
      { id: 'e-model-client', from: 'model', to: 'client' },
      { id: 'e-unsat-client', from: 'unsat', to: 'client' },
    ],
  }, { title });
}

function solverPlot() {
  return plotState({
    axes: {
      x: { label: 'decisions', min: 0, max: 14 },
      y: { label: 'active clauses', min: 0, max: 140 },
    },
    series: [
      { id: 'plain', label: 'boolean', points: [{ x: 0, y: 20 }, { x: 3, y: 34 }, { x: 6, y: 52 }, { x: 9, y: 74 }, { x: 12, y: 95 }] },
      { id: 'theory', label: 'with lemmas', points: [{ x: 0, y: 20 }, { x: 3, y: 44 }, { x: 6, y: 63 }, { x: 9, y: 70 }, { x: 12, y: 72 }] },
    ],
    markers: [
      { id: 'conflict', x: 6, y: 63, label: 'conflict' },
    ],
  });
}

function* satPlusTheories() {
  yield {
    state: solverGraph('SMT is SAT plus background theories'),
    highlight: { active: ['formula', 'atoms', 'sat', 'arith', 'bv', 'array', 'e-formula-atoms', 'e-formula-sat', 'e-atoms-arith', 'e-atoms-bv', 'e-atoms-array'], found: ['lemma'] },
    explanation: 'An SMT solver searches a boolean skeleton while specialized theory solvers reason about arithmetic, bit-vectors, arrays, datatypes, and uninterpreted functions.',
    invariant: 'The SAT assignment must be consistent with every active theory constraint.',
  };

  yield {
    state: labelMatrix(
      'Theory atoms',
      [
        { id: 'arith', label: 'arith' },
        { id: 'bv', label: 'bitvec' },
        { id: 'array', label: 'array' },
        { id: 'uf', label: 'UF' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'example', label: 'example' },
      ],
      [
        ['linear', 'x+1<y'],
        ['fixed bits', 'b & 7'],
        ['select/store', 'a[i]'],
        ['equalities', 'f(x)=f(y)'],
      ],
    ),
    highlight: { active: ['arith:example', 'bv:example', 'array:example'], found: ['uf:shape'] },
    explanation: 'Theories let symbolic tools ask about program-like values instead of pure booleans. That is why SMT is central to symbolic execution and verification.',
  };

  yield {
    state: solverGraph('Theory conflicts learn boolean lemmas'),
    highlight: { active: ['arith', 'bv', 'array', 'lemma', 'sat', 'e-arith-lemma', 'e-bv-lemma', 'e-array-lemma', 'e-lemma-sat'], compare: ['model'] },
    explanation: 'When a theory solver finds the current boolean assignment impossible, it returns an explanation. The SAT core learns a lemma that blocks the bad combination.',
  };

  yield {
    state: solverPlot(),
    highlight: { active: ['theory', 'conflict'], compare: ['plain'] },
    explanation: 'Theory lemmas add clauses, but they prune impossible regions. The solver trades more learned structure for less blind boolean search.',
  };
}

function* modelOrUnsat() {
  yield {
    state: labelMatrix(
      'Solver outcomes',
      [
        { id: 'sat', label: 'sat' },
        { id: 'unsat', label: 'unsat' },
        { id: 'unknown', label: 'unknown' },
        { id: 'timeout', label: 'timeout' },
      ],
      [
        { id: 'means', label: 'means' },
        { id: 'client', label: 'client action' },
      ],
      [
        ['model exists', 'make test'],
        ['no model', 'trust core'],
        ['not solved', 'simplify'],
        ['budget hit', 'bound'],
      ],
    ),
    highlight: { active: ['sat:client', 'unsat:client'], compare: ['unknown:client'] },
    explanation: 'A symbolic-execution client wants either a model for a feasible path or unsat evidence that a path cannot happen. Unknown and timeout are engineering outcomes, not proofs.',
  };

  yield {
    state: solverGraph('Models and unsat cores feed verification clients'),
    highlight: { active: ['model', 'unsat', 'client', 'e-model-client', 'e-unsat-client'], found: ['formula'] },
    explanation: 'A model can become a concrete test input. An unsat core can explain which constraints made the path impossible.',
  };

  yield {
    state: labelMatrix(
      'Complete case: overflow guard',
      [
        { id: 'path', label: 'path' },
        { id: 'guard', label: 'guard' },
        { id: 'bug', label: 'bug' },
        { id: 'solve', label: 'solve' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'result', label: 'result' },
      ],
      [
        ['x > 0', 'active'],
        ['x < 100', 'active'],
        ['x+1 wraps', 'ask BV'],
        ['sat x=255', 'test'],
      ],
    ),
    highlight: { active: ['bug:constraint', 'solve:result'], found: ['guard:constraint'] },
    explanation: 'Bit-vector theory catches fixed-width overflow semantics that integer arithmetic would miss. The model becomes a concrete input for a failing test.',
  };

  yield {
    state: labelMatrix(
      'Solver pitfalls',
      [
        { id: 'mix', label: 'mixed theory' },
        { id: 'quant', label: 'quant' },
        { id: 'nonlin', label: 'nonlinear' },
        { id: 'encode', label: 'bad encode' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['slow', 'split'],
        ['unknown', 'instantiate'],
        ['timeout', 'linearize'],
        ['wrong model', 'audit'],
      ],
    ),
    highlight: { active: ['quant:symptom', 'encode:symptom'], found: ['mix:fix', 'encode:fix'] },
    explanation: 'SMT solving is powerful but sensitive to encoding. The client must log formulas, solver options, timeout, model, unsat core, and simplifications.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'sat plus theories') yield* satPlusTheories();
  else if (view === 'model or unsat') yield* modelOrUnsat();
  else throw new InputError('Pick an SMT solver view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the SAT core, the boolean satisfiability search engine, as the search engine and the theory boxes as semantic checkers. Active literals are the current boolean choices, visited conflicts have already taught clauses, and a found model is only for the encoded formula. The safe inference is that satisfiable means the formula has a witness, not that the original program was modeled perfectly.',
        {type:"callout", text:"SMT solvers scale by letting a SAT search propose Boolean assignments while theory solvers reject impossible semantic combinations."},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'SMT means satisfiability modulo theories. It answers whether a formula can be true when booleans are mixed with arithmetic, arrays, bit-vectors, datatypes, and equality over functions. Program analysis needs this because real path conditions talk about values, not only true and false variables.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is brute force testing. Try inputs until one hits the path or stop after enough failures. That works for tiny domains, but an 8-bit variable already has 256 values and four such variables have more than 4 billion combinations.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is mixed reasoning. A path can require x > 0, x < 100, a[i] = y, f(y) = f(z), and 8-bit overflow. A plain SAT solver does not know arithmetic order, while a standalone arithmetic solver does not manage arbitrary boolean combinations.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use DPLL(T): a SAT-style search over boolean structure plus theory solvers for semantics. The SAT core guesses which atoms are true. Theory solvers check whether the active arithmetic, array, bit-vector, and equality facts can coexist, then return conflicts as learned lemmas.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The solver parses a formula, abstracts theory atoms into boolean variables, and starts conflict-driven search. When a partial assignment says x < 5 and x > 10, the arithmetic solver rejects it and explains the conflict. If all active theory facts are consistent and the boolean formula is satisfied, the solver returns sat with a model.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness depends on a shared invariant: every accepted boolean assignment must be consistent with every active theory constraint. Theory lemmas are sound consequences of the theories, so adding them removes impossible combinations without removing real solutions. The client must still encode program semantics accurately, including bit width and memory behavior.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost is uneven. Linear arithmetic and equality can solve quickly, but bit-vector formulas may explode when operations are bit-blasted, and arrays become hard with many symbolic indices. Doubling variables can more than double search because boolean combinations and theory interactions both grow.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'SMT solvers appear in symbolic execution, bounded model checking, compiler optimization validation, smart-contract analysis, hardware verification, database constraints, and configuration checking. They are useful when a concrete witness or an unsat proof for the encoded constraints is more valuable than another warning.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Bad encodings create false confidence. Modeling an 8-bit program value as an unbounded integer can make overflow disappear. Timeout and unknown are not proofs, and quantifiers, nonlinear arithmetic, strings, floating point, and mixed theories can make solving unpredictable.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Ask whether an 8-bit unsigned x can satisfy x > 250 and x + 10 < 5. Over ordinary integers this is impossible, because x + 10 is greater than 260. Over 8-bit bit-vectors, x = 251 gives x + 10 = 5 modulo 256, and x = 252 gives 6, so the exact comparison determines whether the solver returns a witness.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Z3: An Efficient SMT Solver, Programming Z3, the Z3 Guide, SAT solving, union-find, congruence closure, bit-vector encodings, array select-store axioms, symbolic execution, abstract interpretation, Alloy, and TLA+. The next habit is to inspect formulas, not just solver answers.',
      ],
    },
  ],
};
