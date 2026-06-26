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
  const hmStages = ['AST', 'env', 'fresh', 'rules', 'unify', 'scheme', 'inst', 'type'];
  const coreRules = ['variable', 'lambda', 'apply', 'let'];

  yield {
    state: hmGraph('Algorithm W walks the expression tree once'),
    highlight: { active: ['ast', 'env', 'fresh', 'rules', 'e-ast-env', 'e-ast-fresh'], compare: ['type'] },
    explanation: `Algorithm W traverses the AST through ${hmStages.length} stages (${hmStages.join(' → ')}), looks up variables in a type environment, creates fresh type variables, and sends usage constraints to unification.`,
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
    explanation: `Among the ${coreRules.length} core HM rules (${coreRules.join(', ')}), the application rule is where constraints appear: if f is applied to x, then f must have a function type from x to a fresh result variable.`,
    invariant: `Every use of a polymorphic scheme gets fresh variables across the ${hmStages.length}-stage pipeline, not the original variables.`,
  };
  yield {
    state: hmGraph('The final type is principal when inference succeeds'),
    highlight: { active: ['unify', 'type', 'e-unify-type'], found: ['scheme'], visited: ['rules'] },
    explanation: `After unification through the ${hmStages.length}-stage pipeline, the principal type is the most general type that explains the expression. More specific valid types can be obtained by instantiating it via the ${coreRules.length} core rules.`,
  };
}

function* letPolymorphism() {
  const idScheme = 'forall a. a -> a';
  const uses = ['id 1', 'id true'];
  const instantiatedTypes = ['int -> int', 'bool -> bool'];

  yield {
    state: hmGraph('Let-binding generalizes values into schemes'),
    highlight: { active: ['unify', 'scheme', 'e-unify-scheme'], found: ['env'], compare: ['fresh'] },
    explanation: `For let id = fun x -> x, the inferred type a -> a is generalized into ${idScheme} before id is stored in the environment for ${uses.length} later uses.`,
    invariant: `Generalize variables that are free in the inferred type but not free in the surrounding environment — producing ${idScheme}.`,
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
    explanation: `The same let-bound identity function (${idScheme}) can be used at ${uses.length} different types (${instantiatedTypes.join(' and ')}) because each lookup instantiates the scheme with fresh variables.`,
  };
  yield {
    state: hmGraph('Mutation and effects complicate generalization'),
    highlight: { active: ['scheme', 'env'], compare: ['inst'], removed: ['type'] },
    explanation: `Real ML-family languages restrict generalization around mutable references and effects. Without a value restriction, one polymorphic cell with scheme ${idScheme} could be used at ${uses.length} incompatible types like ${instantiatedTypes.join(' and ')}.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read a type variable such as a as an unknown type. A substitution records a solved equation for an unknown. A scheme such as forall a. a -> a is a reusable polymorphic type, not one fixed type.',
        {type: 'image', src: './assets/gifs/hindley-milner-algorithm-w-let-polymorphism.gif', alt: 'Animated walkthrough of the hindley milner algorithm w let polymorphism visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A typed language wants static safety without forcing programmers to annotate every expression. Hindley-Milner inference gives ML-style languages principal types for variables, lambdas, applications, and let-bindings. Principal means every other valid type is a specialization.',
        {type: 'callout', text: 'Algorithm W separates discovery from reuse: infer one principal type, generalize safe variables, then instantiate fresh copies at each use.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Abstract_syntax_tree_for_Euclidean_algorithm.svg/500px-Abstract_syntax_tree_for_Euclidean_algorithm.svg.png', alt: 'Abstract syntax tree diagram for the Euclidean algorithm', caption: 'Algorithm W walks syntax-tree structure while accumulating type information. Source: Wikimedia Commons, Abstract syntax tree for Euclidean algorithm.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious checker stores one type per name. If x is int, every x must be int. Function application just checks that the function input type matches the argument type.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is let id = fun x -> x in (id 1, id true). The definition of id works for any type, but one shared unknown would force int and bool to become the same type. The checker needs safe reuse, not ad hoc overloading.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A let-bound value is stored as a type scheme. Generalization quantifies variables that are free in the inferred type but not free in the surrounding environment. Instantiation replaces those quantified variables with fresh unknowns at each use.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between labeled nodes', caption: 'Inference constraints form directional dependencies between expression nodes and type variables. Source: Wikimedia Commons, Directed graph.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a variable, instantiate its scheme. For a lambda, give the parameter a fresh unknown and infer the body. For an application, infer function and argument, create a result unknown, and unify functionType with argumentType -> resultType.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Directed_acyclic_graph.svg', alt: 'Directed acyclic graph with multiple dependency paths', caption: 'The occurs check protects the inferred type graph from cycles that would imply infinite types. Source: Wikimedia Commons, Directed acyclic graph.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each recursive call returns a type plus substitutions that make the expression well typed. Application is sound because unification proves the function can accept the argument. Let-polymorphism is sound because only environment-independent variables are generalized, and each use gets fresh copies.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The syntax-tree walk is linear in expression count, but unification cost depends on type-term size and substitution sharing. Good implementations use representatives and avoid repeatedly copying large types. Poor ones can be slow and produce errors far from the bad expression.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HM inference is the core model behind ML-family languages and many typed functional cores. It works well with lexical scope, algebraic data types, pattern matching, and many small helpers. It is also a clean compiler architecture lesson.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Pure Algorithm W does not cover subtyping, type classes, overloaded methods, higher-rank polymorphism, GADTs, dependent types, objects, or gradual typing. Effects also require restrictions; mutable references motivate the ML value restriction.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Infer let id = fun x -> x in (id 1, id true). The lambda gives x fresh type a and returns a -> a. At the let, a is not fixed by the environment, so generalize to forall a. a -> a.',
        'For id 1, instantiate with fresh b and unify b with int, producing int. For id true, instantiate again with fresh c and unify c with bool, producing bool. Two fresh instantiations give pair type (int, bool) without forcing int = bool.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Damas and Milner on principal type-schemes, Cornell inference notes, Cornell let-polymorphism notes, and OCaml polymorphism documentation. Study abstract syntax trees, lambda calculus, unification, union-find, bidirectional checking, gradual typing, and type classes next.',
      ],
    },
  ],
};
