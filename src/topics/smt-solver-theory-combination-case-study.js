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
  references: [
    { title: 'Z3 Guide: Quantifiers', url: 'https://microsoft.github.io/z3guide/docs/logic/Quantifiers/' },
    { title: 'Programming Z3', url: 'https://theory.stanford.edu/~nikolaj/programmingz3.html' },
    { title: 'Z3: An Efficient SMT Solver', url: 'https://www.microsoft.com/en-us/research/publication/z3-an-efficient-smt-solver/' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['SMT means satisfiability modulo theories. It generalizes SAT by adding background theories such as arithmetic, bit-vectors, arrays, datatypes, and uninterpreted functions.', 'Microsoft Research describes Z3 as an SMT solver used in software verification and analysis applications, with theories such as arithmetic, bit-vectors, arrays, and uninterpreted functions: https://www.microsoft.com/en-us/research/publication/z3-an-efficient-smt-solver/.'] },
    { heading: 'How it works', paragraphs: ['In the DPLL(T) view, a SAT core guesses truth values for theory atoms. Theory solvers check whether those guesses can coexist. If not, they explain the conflict with a lemma. If yes, the solver may return a model.', 'Programming Z3 summarizes SMT as logical formulas with background theories and describes Z3 as an efficient SMT solver with specialized algorithms: https://theory.stanford.edu/~nikolaj/programmingz3.html.'] },
    { heading: 'Complete case study', paragraphs: ['A symbolic executor explores a branch where `x > 0`, `x < 100`, and a fixed-width addition overflows. If `x` is modeled as an unbounded integer, the bug may disappear. If it is modeled as an 8-bit vector, the solver can produce a concrete model such as `x = 255` for the wrapped path.', 'The generated model becomes a regression input. If the path is unsat, the unsat core explains which guards made it unreachable.'] },
    { heading: 'Data structures', paragraphs: ['Solver-facing data includes abstract syntax trees, boolean literals, theory atoms, congruence classes, bit-vector bitblasts, array select/store terms, learned lemmas, models, unsat cores, and timeout metadata.', 'Quantifiers are especially hard. The Z3 Guide describes quantified bit-vector formulas and the finite but potentially exponential expansion behind decidability in that fragment: https://microsoft.github.io/z3guide/docs/logic/Quantifiers/.'] },
    { heading: 'Pitfalls', paragraphs: ['A solver result is only as good as the encoding. Wrong bit width, missing path condition, unmodeled side effect, or accidental integer semantics can create false confidence.', 'Unknown and timeout need explicit handling. They should not be reported as safe. Reduce the formula, split the query, or change the abstraction.'] },
    { heading: 'Study next', paragraphs: ['Study Symbolic Execution Path Constraints, TLA+ State-Space Model Checking, Alloy Relational Model Finder, Abstract Interpretation, SAT Solving, and Property-Based Testing Shrinking next.'] },
  ],
};
