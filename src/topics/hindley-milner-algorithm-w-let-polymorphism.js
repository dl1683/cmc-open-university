// Hindley-Milner inference: traverse expressions, instantiate schemes,
// generate constraints, unify them, and generalize let-bound values.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'hindley-milner-algorithm-w-let-polymorphism',
  title: 'Hindley-Milner Algorithm W & Let Polymorphism',
  category: 'Concepts',
  summary: 'Infer principal types with Algorithm W: environments, fresh variables, unification, type schemes, instantiation, and let-generalization.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['algorithm w', 'let polymorphism'], defaultValue: 'algorithm w' },
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

function hmGraph(title) {
  return graphState({
    nodes: [
      { id: 'ast', label: 'AST', x: 0.8, y: 3.8, note: 'expr' },
      { id: 'env', label: 'env', x: 2.4, y: 2.4, note: 'schemes' },
      { id: 'fresh', label: 'fresh', x: 2.4, y: 5.2, note: 'vars' },
      { id: 'rules', label: 'rules', x: 4.2, y: 3.8, note: 'W' },
      { id: 'unify', label: 'unify', x: 5.9, y: 3.8, note: 'solve' },
      { id: 'scheme', label: 'forall', x: 7.5, y: 2.4, note: 'gen' },
      { id: 'inst', label: 'inst', x: 7.5, y: 5.2, note: 'fresh' },
      { id: 'type', label: 'type', x: 9.2, y: 3.8, note: 'principal' },
    ],
    edges: [
      { id: 'e-ast-env', from: 'ast', to: 'env' },
      { id: 'e-ast-fresh', from: 'ast', to: 'fresh' },
      { id: 'e-env-rules', from: 'env', to: 'rules' },
      { id: 'e-fresh-rules', from: 'fresh', to: 'rules' },
      { id: 'e-rules-unify', from: 'rules', to: 'unify' },
      { id: 'e-unify-scheme', from: 'unify', to: 'scheme' },
      { id: 'e-scheme-inst', from: 'scheme', to: 'inst' },
      { id: 'e-inst-type', from: 'inst', to: 'type' },
      { id: 'e-unify-type', from: 'unify', to: 'type' },
    ],
  }, { title });
}

function* algorithmW() {
  yield {
    state: hmGraph('Algorithm W walks the expression tree once'),
    highlight: { active: ['ast', 'env', 'fresh', 'rules', 'e-ast-env', 'e-ast-fresh'], compare: ['type'] },
    explanation: 'Algorithm W traverses the AST, looks up variables in a type environment, creates fresh type variables, and sends usage constraints to unification.',
  };
  yield {
    state: labelMatrix(
      'Core HM rules',
      [
        { id: 'var', label: 'variable' },
        { id: 'lam', label: 'lambda' },
        { id: 'app', label: 'apply' },
        { id: 'let', label: 'let' },
      ],
      [
        { id: 'data', label: 'data used' },
        { id: 'result', label: 'result' },
      ],
      [
        ['env scheme', 'instantiate'],
        ['fresh arg', 'arg -> body'],
        ['fn = arg -> r', 'unify'],
        ['generalize', 'scheme'],
      ],
    ),
    highlight: { active: ['app:data', 'app:result'], found: ['let:result'], compare: ['var:result'] },
    explanation: 'The application rule is where constraints appear: if f is applied to x, then f must have a function type from x to a fresh result variable.',
    invariant: 'Every use of a polymorphic scheme gets fresh variables, not the original variables.',
  };
  yield {
    state: hmGraph('The final type is principal when inference succeeds'),
    highlight: { active: ['unify', 'type', 'e-unify-type'], found: ['scheme'], visited: ['rules'] },
    explanation: 'The principal type is the most general type that explains the expression. More specific valid types can be obtained by instantiating it.',
  };
}

function* letPolymorphism() {
  yield {
    state: hmGraph('Let-binding generalizes values into schemes'),
    highlight: { active: ['unify', 'scheme', 'e-unify-scheme'], found: ['env'], compare: ['fresh'] },
    explanation: 'For let id = fun x -> x, the inferred type a -> a is generalized into forall a. a -> a before id is stored in the environment.',
    invariant: 'Generalize variables that are free in the inferred type but not free in the surrounding environment.',
  };
  yield {
    state: labelMatrix(
      'id used twice',
      [
        { id: 'def', label: 'let id' },
        { id: 'use1', label: 'id 1' },
        { id: 'use2', label: 'id true' },
        { id: 'pair', label: 'pair' },
      ],
      [
        { id: 'type', label: 'type' },
        { id: 'step', label: 'step' },
      ],
      [
        ['forall a. a->a', 'generalize'],
        ['int -> int', 'instantiate'],
        ['bool -> bool', 'instantiate'],
        ['int * bool', 'combine'],
      ],
    ),
    highlight: { active: ['use1:type', 'use2:type'], found: ['pair:type'], compare: ['def:step'] },
    explanation: 'The same let-bound identity function can be used at int and bool because each lookup instantiates the scheme with fresh variables.',
  };
  yield {
    state: hmGraph('Mutation and effects complicate generalization'),
    highlight: { active: ['scheme', 'env'], compare: ['inst'], removed: ['type'] },
    explanation: 'Real ML-family languages restrict generalization around mutable references and effects. Without a value restriction, one polymorphic cell could be used at incompatible types.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'algorithm w') yield* algorithmW();
  else if (view === 'let polymorphism') yield* letPolymorphism();
  else throw new InputError('Pick a Hindley-Milner view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Hindley-Milner inference is the classic algorithmic sweet spot for ML-style languages: many programs get precise principal types without writing annotations everywhere. Algorithm W is the common presentation of that inference process.',
        'The moving parts are an AST, a type environment, type schemes, fresh type variables, unification, substitution, instantiation, and let-generalization. It is not magic; it is a disciplined traversal plus Unification Union-Find Type Constraints.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A variable lookup instantiates its environment scheme with fresh variables. A lambda receives a fresh argument type and infers its body type. An application infers the function and argument, then unifies the function type with arg -> result. A let-binding infers the bound expression, generalizes eligible variables, and extends the environment with a scheme.',
        'The algorithm returns a substitution and a type. The substitution records everything learned while solving constraints. Applying it to the result produces the inferred type for the expression.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider let id = fun x -> x in (id 1, id true). The lambda fun x -> x first gets a fresh variable a for x and infers a -> a. The let rule generalizes that to forall a. a -> a. Later, id 1 instantiates the scheme as int -> int, while id true instantiates it again as bool -> bool.',
        'Without generalization, both uses would share one variable and the program would try to make int equal bool. The important data-structure lesson is that a type scheme is not just a type. It is a reusable template with quantified variables that are refreshed at every lookup.',
      ],
    },
    {
      heading: 'Implementation notes',
      paragraphs: [
        'A minimal implementation uses recursive AST traversal, a hash-map environment from names to schemes, a fresh variable counter, and a unifier. A better implementation also tracks source spans for every generated constraint so errors can report the expression that caused a mismatch.',
        'HM is intentionally limited. It does not infer every feature modern languages want: subtyping, overloaded methods, higher-rank polymorphism, dependent types, row polymorphism, mutation-heavy object systems, and gradual boundaries all require extra machinery or explicit annotations.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Damas and Milner principal type-schemes PDF at https://people.eecs.berkeley.edu/~necula/Papers/DamasMilnerAlgoW.pdf, Cornell inference notes at https://www.cs.cornell.edu/courses/cs3110/2016fa/l/17-inference/notes.html, Cornell let-polymorphism notes at https://courses.cs.cornell.edu/cs3110/2021sp/textbook/interp/letpoly.html, and OCaml polymorphism manual at https://ocaml.org/manual/polymorphism.html. Study Pratt Parser Expression AST, Unification Union-Find Type Constraints, Bidirectional Type Checking: Synthesis & Checking, and Gradual Typing Boundaries & Blame Guards next.',
      ],
    },
  ],
};
