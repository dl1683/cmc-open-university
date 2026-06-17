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
      heading: 'Why this exists',
      paragraphs: [
        'A typed language has to answer a practical question: how much type information should programmers write by hand? Full annotations make the compiler simple but make ordinary functional code noisy. No static types make many mistakes appear only when the program runs.',
        'Hindley-Milner gives a strong middle ground for an ML-like core. It infers a principal type for expressions made from variables, lambdas, application, and let-binding. Principal means most general: every other valid type for the expression is a specialization of the one inferred.',
        'Algorithm W is the constructive version of that idea. It is not just a checker. It walks the expression, manufactures unknown type variables, gathers equations from how values are used, solves those equations with unification, and decides where polymorphism may safely enter the environment.',
      ],
    },
    {
      heading: 'The problem with one type per name',
      paragraphs: [
        'A simple checker can store one type for each name. If x has type int, every later use of x has type int. If f is applied to x, f must have a function type whose input matches the type of x. This handles many local mistakes.',
        'It breaks on a basic ML idiom: let id = fun x -> x in (id 1, id true). The source name id must behave like int -> int in the first call and bool -> bool in the second call. A monomorphic environment would force both calls to share one type variable and would eventually try to equate int with bool.',
        'The language feature is not ad hoc overloading. The definition of id is genuinely uniform. It works for any type because it never inspects its argument. The compiler needs a representation for that uniformity.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A let-bound value is stored as a type scheme, not as a raw type. The scheme forall a. a -> a says that a is quantified by the binding and may be replaced with a fresh type variable each time the name is used.',
        'That freshening step is instantiation. The reverse step is generalization. After inferring the type of a let-bound expression, Algorithm W quantifies the type variables that are free in the inferred type but not free in the surrounding environment.',
        'Everything else is unification. Application forces equations such as functionType = argumentType -> resultType. Unification solves those equations while preserving the weakest substitution that makes them true.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'The environment maps names to schemes. A fresh variable counter creates unknowns such as a, b, and c. The unifier maintains a substitution from unknowns to concrete types or larger type expressions.',
        'For a variable, look up its scheme and instantiate quantified variables with fresh unknowns. For a lambda, assign the parameter a fresh type, infer the body under the extended environment, and return parameterType -> bodyType. For an application, infer the function, infer the argument, create a fresh result type, and unify the function with argumentType -> resultType.',
        'For a let-binding, infer the bound expression first. Apply the current substitution to the environment and the inferred type. Then generalize only the variables that do not appear free in the environment. Store that scheme while inferring the body.',
      ],
    },
    {
      heading: 'Invariant and proof sketch',
      paragraphs: [
        'Each recursive call returns a substitution and a type. The invariant is that, after applying the returned substitution, the expression has the returned type under the returned environment assumptions.',
        'Application preserves the invariant because the unifier proves that the inferred function type can be viewed as argumentType -> resultType. If the equation cannot be solved, the program has no HM type. If it can be solved, the result type is justified by the application rule.',
        'Let-polymorphism is safe because generalization does not quantify variables that are already constrained by the surrounding environment. Instantiation is safe because each use receives fresh variables, so one use cannot accidentally rewrite the assumptions of another use.',
      ],
    },
    {
      heading: 'Occurs check and failure modes',
      paragraphs: [
        'The occurs check prevents infinite types. If unification tries to solve a = a -> b, accepting the equation would require a type that contains itself. HM rejects that shape unless the language has explicit recursive types.',
        'A common implementation bug is over-generalization. Quantifying a variable that came from the surrounding environment lets a later lookup treat an externally fixed type as polymorphic. Another bug is under-instantiation, where two uses of a scheme share the same unknown and falsely constrain each other.',
        'Effects add a language-level failure mode. In ML-family languages, mutable references and similar effects interact badly with unrestricted polymorphism. The value restriction limits generalization so a polymorphic cell cannot be written at one type and read at another.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The AST traversal is linear in the number of expression nodes. The real cost is the size and shape of the generated type terms and unification work. With sharing and union-find-style representatives, common programs behave close to linear in practice.',
        'Naive implementations can repeatedly copy large type trees when applying substitutions. They can also produce poor errors if they forget which source expression generated each equation. Production checkers keep source spans on constraints, compress representatives, and delay pretty-printing until the final type is known.',
        'The inferred type can be larger than the source expression when nested tuples, records, or generated functions duplicate structure. HM is elegant, but it is not free of engineering pressure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HM works well for functional languages with algebraic data types, pattern matching, lexical scope, and many small let-bound helpers. Users get strong static guarantees while writing code that often looks unannotated.',
        'It is also a good compiler architecture lesson. The algorithm has visible data structures: a map from names to schemes, a fresh-variable supply, type constructors, substitutions, and a unifier. Each part has a narrow responsibility.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pure Algorithm W is not a universal inference engine. Subtyping, overloaded methods, type classes, higher-rank polymorphism, GADTs, dependent types, row polymorphism, object systems, and gradual typing all require extra machinery or different inference boundaries.',
        'It also gives less guidance when error localization matters more than acceptance. A single bad equation can surface far from the expression a programmer thinks is wrong. Modern compilers layer constraint explanation and bidirectional checking on top of the core idea.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the algorithm-w view, follow the path from AST to environment, fresh variables, rules, unification, and final type. The important edge is the application rule feeding unification: this is where ordinary function calls become equations over unknown types.',
        'In the let-polymorphism view, watch the split between generalize and instantiate. The let id row shows the single scheme. The later id 1 and id true rows show two independent instantiations. If those rows shared one unknown, the example would fail.',
        'Treat the final mutation frame as a warning about the boundary of the model. The animation is showing the sound HM core first, then the reason real ML implementations restrict generalization around effects.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Damas and Milner principal type-schemes PDF at https://people.eecs.berkeley.edu/~necula/Papers/DamasMilnerAlgoW.pdf, Cornell inference notes at https://www.cs.cornell.edu/courses/cs3110/2016fa/l/17-inference/notes.html, Cornell let-polymorphism notes at https://courses.cs.cornell.edu/cs3110/2021sp/textbook/interp/letpoly.html, and OCaml polymorphism manual at https://ocaml.org/manual/polymorphism.html. Study Pratt Parser Expression AST, Unification Union-Find Type Constraints, Bidirectional Type Checking: Synthesis & Checking, and Gradual Typing Boundaries & Blame Guards next.',
      ],
    },
  ],
};
