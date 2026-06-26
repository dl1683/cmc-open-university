// Type unification: solve equality constraints between type expressions by
// binding variables, merging equivalence classes, and rejecting recursive types.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'unification-union-find-type-constraints',
  title: 'Unification Union-Find Type Constraints',
  category: 'Concepts',
  summary: 'Solve type equations with substitutions: fresh variables, equality constraints, union-find classes, occurs checks, and most-general unifiers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['unify variables', 'occurs check'], defaultValue: 'unify variables' },
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

function unifyGraph(title) {
  return graphState({
    nodes: [
      { id: 'ast', label: 'AST', x: 0.8, y: 3.8, note: 'expr' },
      { id: 'fresh', label: 'fresh', x: 2.3, y: 2.4, note: 'a,b,c' },
      { id: 'eqs', label: 'eqs', x: 2.5, y: 5.3, note: 'constraints' },
      { id: 'uf', label: 'UF', x: 4.4, y: 3.8, note: 'classes' },
      { id: 'bind', label: 'bind', x: 6.1, y: 2.5, note: 'a=int' },
      { id: 'occurs', label: 'check', x: 6.1, y: 5.2, note: 'a in t?' },
      { id: 'subst', label: 'subst', x: 8.0, y: 3.8, note: 'MGU' },
      { id: 'type', label: 'type', x: 9.4, y: 3.8, note: 'result' },
    ],
    edges: [
      { id: 'e-ast-fresh', from: 'ast', to: 'fresh' },
      { id: 'e-ast-eqs', from: 'ast', to: 'eqs' },
      { id: 'e-fresh-uf', from: 'fresh', to: 'uf' },
      { id: 'e-eqs-uf', from: 'eqs', to: 'uf' },
      { id: 'e-uf-bind', from: 'uf', to: 'bind' },
      { id: 'e-uf-occurs', from: 'uf', to: 'occurs' },
      { id: 'e-bind-subst', from: 'bind', to: 'subst' },
      { id: 'e-occurs-subst', from: 'occurs', to: 'subst' },
      { id: 'e-subst-type', from: 'subst', to: 'type' },
    ],
  }, { title });
}

function* unifyVariables() {
  const graphTitle1 = 'Type inference reduces usage to equations';
  const freshNote = 'a,b,c';
  const eqsNote = 'constraints';
  yield {
    state: unifyGraph(graphTitle1),
    highlight: { active: ['ast', 'fresh', 'eqs', 'e-ast-fresh', 'e-ast-eqs'], compare: ['subst'] },
    explanation: `A type inferencer assigns fresh type variables (${freshNote}) to unknown expressions and emits equality ${eqsNote} from how those expressions are used.`,
  };
  const constraintRows = [
    { id: 'lit', label: 'x = 1' },
    { id: 'arg', label: 'f(x)' },
    { id: 'ret', label: 'f returns' },
    { id: 'use', label: 'use as bool' },
  ];
  const constraintActions = [
    ['a = int', 'bind a'],
    ['f = a -> b', 'decompose'],
    ['b = c', 'union b,c'],
    ['c = bool', 'bind class'],
  ];
  const substNote = 'MGU';
  yield {
    state: labelMatrix(
      'Constraint solving',
      constraintRows,
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'action', label: 'solver action' },
      ],
      constraintActions,
    ),
    highlight: { active: ['arg:constraint', 'ret:action'], found: ['use:action'], compare: ['lit:action'] },
    explanation: `Unification repeatedly solves the simplest equation across ${constraintRows.length} constraint cases. Equal variables are merged. A variable equal to a concrete type becomes a binding for its whole class.`,
    invariant: `The solver should return the ${substNote} (most general unifier), not an over-specific guess — ${constraintActions.length} actions show the minimal forced moves.`,
  };
  const graphTitle2 = 'Union-Find stores equal type variables compactly';
  const ufNote = 'classes';
  const bindNote = 'a=int';
  yield {
    state: unifyGraph(graphTitle2),
    highlight: { active: ['uf', 'bind', 'subst', 'e-uf-bind', 'e-bind-subst'], found: ['type'] },
    explanation: `Union-Find groups type variables into equivalence ${ufNote}. A class may later receive a binding like ${bindNote}, or a structure such as bool, list a, or a function type.`,
  };
}

function* occursCheck() {
  const occursTitle = 'The occurs check rejects infinite self-reference';
  const occursNodeNote = 'a in t?';
  const dangerousEq = 'a = a -> b';
  yield {
    state: unifyGraph(occursTitle),
    highlight: { active: ['uf', 'occurs', 'e-uf-occurs'], compare: ['bind'], found: ['subst'] },
    explanation: `The dangerous equation is ${dangerousEq}. Binding a to a type that contains a would create an infinite type. The occurs check (${occursNodeNote}) catches that before the substitution is accepted.`,
    invariant: `If variable a occurs inside type t (${occursNodeNote}), do not bind a := t unless the language intentionally supports recursive types.`,
  };
  const caseRows = [
    { id: 'same', label: 'a = a' },
    { id: 'var', label: 'a = int' },
    { id: 'func', label: 'a->b = int->c' },
    { id: 'bad', label: 'a = list a' },
  ];
  const caseResults = [
    ['same rep', 'no-op'],
    ['bind var', 'a:=int'],
    ['decompose', 'a=int,b=c'],
    ['occurs', 'reject'],
  ];
  yield {
    state: labelMatrix(
      'Unification cases',
      caseRows,
      [
        { id: 'rule', label: 'rule' },
        { id: 'result', label: 'result' },
      ],
      caseResults,
    ),
    highlight: { active: ['func:rule', 'func:result'], removed: ['bad:result'], found: ['var:result'] },
    explanation: `Structured types unify by matching their constructors across ${caseRows.length} cases and recursively unifying their fields. Different constructors fail. Self-containing bindings like ${caseRows[3].label} ${caseResults[3][1]} via the occurs check.`,
  };
  const errorTitle = 'A good error points to the constraint source';
  const astLabel = 'AST';
  const typeNote = 'result';
  yield {
    state: unifyGraph(errorTitle),
    highlight: { active: ['ast', 'eqs', 'occurs'], compare: ['type'], found: ['e-ast-eqs'] },
    explanation: `Production compilers keep source spans from the ${astLabel} and blame paths for constraints. The user should see the expression that forced the impossible equation, not just a solver-internal variable name that hides the ${typeNote}.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'unify variables') yield* unifyVariables();
  else if (view === 'occurs check') yield* occursCheck();
  else throw new InputError('Pick a unification view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a type-equation solver. Active items are the current constraint, visited items are constraints already justified, and found items are type variables or structures whose equality is now guaranteed.',
        {
          type: 'callout',
          text: 'Unification delays guesses: it records forced equalities, merges equivalent variables, and binds structures only when the occurs check says the type stays finite.',
        },
        'A type variable is an unknown type, and union-find stores variables that must be equal in the same class. The safe inference rule is that a variable can bind to a structure only if the variable does not occur inside that structure.',
        {
          type: 'image',
          src: './assets/gifs/unification-union-find-type-constraints.gif',
          alt: 'Animated walkthrough of the unification union find type constraints visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A type checker must decide whether program expressions can consistently have types. A type is a description such as int, bool, list of int, or function from int to bool.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is local checking. Give literals fixed types, check each operation against its expected types, and report an error as soon as a local rule does not match.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is shared unknowns. If a and b are really the same type variable, solving them separately can duplicate work or produce inconsistent substitutions.',
        'A second wall is infinite types. If the solver accepts a = list a or a = a -> int, it has built a type that contains itself forever, which ordinary Hindley-Milner inference rejects.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent unknown types as variables and equal variables as union-find classes. Union-find is a data structure that maintains groups by parent pointers, so equivalent variables share one representative.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Dsu_disjoint_sets_init.svg',
          alt: 'Initial disjoint-set forest with every element in its own set',
          caption: 'Union-Find starts with separate equivalence classes; type inference begins the same way when each unknown gets a fresh variable. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Dsu_disjoint_sets_init.svg.',
        },
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The inference pass creates fresh variables for unknown expression types and emits equations from program use. Applying f to x emits a constraint like f = a -> b, where a is the argument type and b is the result type.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Dsu_disjoint_sets_final.svg',
          alt: 'Final disjoint-set forest after several union operations',
          caption: 'After unions, equivalent unknowns share representatives; the type solver can then attach one structure to the class instead of repeating the same substitution. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Dsu_disjoint_sets_final.svg.',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Each rule preserves exactly the solutions that could still type the program. If a = b is required, every valid substitution gives a and b the same type, so merging their classes loses no valid answer.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Union and find operations cost amortized O(alpha(n)), where alpha is the inverse Ackermann function and is effectively constant for real program sizes. Structural decomposition costs proportional to the size of the type terms being compared.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Hindley-Milner type inference uses unification to infer types without requiring every function argument to be annotated. The same idea appears in logic programming and theorem proving.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the language needs constraints beyond equality. Type classes, subtyping, row polymorphism, effects, and lifetimes require additional solvers or richer constraint systems.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Infer the type of function x => x + 1. Give x a fresh type a and the function result a fresh type b, then the plus operator creates constraints a = int and b = int.',
        'The solver binds class a to int and class b to int, so the function has type int -> int. For x => x(x), the constraint a = a -> b fails the occurs check because a appears inside the type it would become.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Robinson\'s unification algorithm, Hindley-Milner type inference, and Tarjan\'s union-find analysis. Then study abstract syntax trees, type terms, substitutions, occurs checks, Algorithm W, type classes, subtyping, and constraint-based inference.',
      ],
    },
  ],
};
