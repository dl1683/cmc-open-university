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
    {
      heading: 'Why this exists',
      paragraphs: [
        "Many program-analysis questions are not plain boolean questions. A symbolic executor may need to know whether an 8-bit addition can wrap. A compiler may need to know whether two expressions are equivalent under bit-vector semantics. A verifier may need to know whether an array read after a store must return the stored value. These questions contain booleans, but they also contain arithmetic, arrays, fixed-width words, equality, and functions.",
        "SMT means satisfiability modulo theories. It keeps the SAT idea of searching for a satisfying assignment, but adds background theories that understand richer objects. A modern SMT solver can combine boolean structure with linear arithmetic, bit-vectors, arrays, datatypes, uninterpreted functions, and sometimes quantifiers. The point is not to avoid logic. The point is to use the right logic for program-like values.",
        {type:"callout", text:"SMT solvers scale by letting a SAT search propose Boolean assignments while theory solvers reject impossible semantic combinations."},
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        "The first naive approach is brute force. Try concrete inputs until one hits the path or proves nothing useful. That works for tiny domains and shallow tests, but it collapses when inputs are large, structured, or guarded by exact relationships.",
        "The second naive approach is to encode everything as raw SAT. This can work, especially for bit-vectors after bit-blasting, but it throws away useful structure. Linear arithmetic has order. Arrays have select-store laws. Uninterpreted functions preserve equality. If the solver can reason at that level before falling back to bits, it can learn stronger conflicts and avoid blind search.",
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        "The wall is mixed reasoning. A single path condition can say `x > 0`, `x < 100`, `a[i] == y`, `f(y) == f(z)`, and `b + 1` wraps in eight bits. None of those facts is strange by itself. The hard part is that the answer depends on how they interact.",
        "A plain SAT solver sees propositional variables such as A, B, and C. It does not know that `x < 5` and `x > 10` cannot both be true, or that two equal array indices force related reads. A standalone arithmetic solver can check arithmetic facts, but it does not manage arbitrary boolean combinations. SMT exists at the boundary between those jobs.",
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        "The core insight is DPLL(T), often described as SAT plus theory solvers. The solver abstracts theory atoms into boolean variables. The SAT core proposes a boolean assignment. Specialized theory solvers check whether the active arithmetic, bit-vector, array, datatype, or equality constraints can coexist.",
        "If a theory solver finds a contradiction, it returns an explanation as a lemma. The SAT core learns that lemma and avoids the same bad combination later. If the active theory constraints are consistent and the boolean skeleton is satisfied, the solver can return `sat` with a model. If all boolean possibilities are blocked by clauses and theory lemmas, it returns `unsat`.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        "The input formula is parsed into an abstract syntax tree. Theory atoms are identified: arithmetic inequalities, bit-vector operations, array reads and writes, equalities over function terms, and so on. The boolean skeleton becomes the search space for the SAT core.",
        "During search, the SAT core assigns truth values to atoms. The theory solvers receive the currently active literals. An arithmetic solver may maintain bounds and detect impossible intervals. A bit-vector solver may bit-blast some operations into boolean clauses. An array solver applies select-store axioms. A congruence-closure engine handles equalities and uninterpreted functions.",
        "Combination is the hard part. Theories may share terms through equalities. Solver architectures use contracts such as Nelson-Oppen style communication, CDCL(T) integration, eager encodings, delayed theory combination, or solver-specific hybrids. A client usually does not control all of that machinery directly, but it pays the price when a formula mixes theories in a way that is hard to coordinate.",
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        "The first visual proves that SMT has two layers. The SAT core searches the boolean skeleton. The theory boxes act as semantic referees. A boolean assignment can look legal until arithmetic, bit-vectors, arrays, or uninterpreted functions reject the combination.",
        "The lemma arrow is the key. Theory conflict is not just a local failure. It becomes a learned clause that changes the future boolean search. The model-or-unsat view proves the client-facing contract: `sat` gives a witness model, `unsat` gives evidence that the encoded constraints cannot all hold, and `unknown` or timeout is neither of those.",
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        "The method works because the SAT core and theory solvers preserve a shared invariant: the current boolean assignment must be consistent with every active theory constraint. The SAT core is good at exploring boolean combinations and learning clauses. The theory solvers are good at rejecting combinations that violate their semantics.",
        "Soundness depends on the formula boundary. If the formula accurately models fixed-width arithmetic, memory, side effects, and path guards, then a satisfying model is a real witness for that encoded problem and an unsat result rules out that encoded path. If the client models an 8-bit value as an unbounded integer, the solver may be perfectly correct and still answer the wrong question for the program.",
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        "SMT cost is uneven. Some linear arithmetic and equality problems solve quickly. Bit-vector formulas can explode after bit-blasting. Arrays become hard when many symbolic indices interact. Nonlinear arithmetic, quantifiers, strings, floating point, and mixed theories can turn a neat query into a timeout.",
        "The main engineering tradeoff is precision versus tractability. A precise encoding may match the program but overwhelm the solver. A coarse abstraction may solve quickly but miss a bug or report an impossible one. Good clients log formulas, solver options, timeouts, simplifications, models, and unsat cores because the query itself is part of the evidence.",
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        "SMT wins in symbolic execution, bounded model checking, compiler optimization validation, refinement types, program synthesis, hardware checks, smart-contract analysis, database constraint reasoning, and configuration validation. It is useful whenever a concrete example or contradiction is more valuable than another warning.",
        "A classic case is overflow. Suppose a path has `x > 0`, `x < 100`, and a candidate bug says `x + 1` wraps. With unbounded integers, that looks impossible. With 8-bit bit-vectors, wraparound has different semantics. The solver can return a concrete model when the encoded bit width allows it, and that model can become a regression test.",
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        "Bad encodings create false confidence. Wrong bit widths, missing guards, skipped side effects, imprecise memory models, accidental integer semantics, and unsupported library behavior can all make a solver answer irrelevant. The result is only about the formula, not the code you meant to describe.",
        "Timeout and `unknown` are engineering results, not proofs. A verifier that treats timeout as safe has built a bug into its safety argument. The right response is to simplify, split the query, add bounds, change abstractions, cache subqueries, or route the case to a different analysis.",
        "Quantifiers are another common trap. They are expressive, but instantiation can be expensive or incomplete. Many production encodings avoid quantifiers when possible, use finite bounds, or rely on patterns and triggers carefully. More mathematical elegance can mean less predictable solving.",
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        "Study Symbolic Execution Path Constraints for the client that generates many SMT queries. Study SAT Solving for the boolean core, Union-Find and Unification for equality reasoning, Bitsets and Bit-Vectors for fixed-width encodings, and Abstract Interpretation for a faster conservative alternative.",
        "Then study TLA+ State-Space Model Checking for temporal systems, Alloy Relational Model Finder for bounded structural search, Property-Based Testing Shrinking for executable counterexamples, and Compiler Optimization Validation for solver-backed equivalence checks. The primary sources in this page point to Z3, Programming Z3, and the Z3 quantifier guide.",
      ],
    },
  ],
};
