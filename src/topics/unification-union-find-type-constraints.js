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
  yield {
    state: unifyGraph('Type inference reduces usage to equations'),
    highlight: { active: ['ast', 'fresh', 'eqs', 'e-ast-fresh', 'e-ast-eqs'], compare: ['subst'] },
    explanation: 'A type inferencer assigns fresh type variables to unknown expressions and emits equality constraints from how those expressions are used.',
  };
  yield {
    state: labelMatrix(
      'Constraint solving',
      [
        { id: 'lit', label: 'x = 1' },
        { id: 'arg', label: 'f(x)' },
        { id: 'ret', label: 'f returns' },
        { id: 'use', label: 'use as bool' },
      ],
      [
        { id: 'constraint', label: 'constraint' },
        { id: 'action', label: 'solver action' },
      ],
      [
        ['a = int', 'bind a'],
        ['f = a -> b', 'decompose'],
        ['b = c', 'union b,c'],
        ['c = bool', 'bind class'],
      ],
    ),
    highlight: { active: ['arg:constraint', 'ret:action'], found: ['use:action'], compare: ['lit:action'] },
    explanation: 'Unification repeatedly solves the simplest equation. Equal variables are merged. A variable equal to a concrete type becomes a binding for its whole class.',
    invariant: 'The solver should return the most general unifier, not an over-specific guess.',
  };
  yield {
    state: unifyGraph('Union-Find stores equal type variables compactly'),
    highlight: { active: ['uf', 'bind', 'subst', 'e-uf-bind', 'e-bind-subst'], found: ['type'] },
    explanation: 'Union-Find groups type variables that must be equal. A class may later receive a structure such as int, bool, list a, or a function type.',
  };
}

function* occursCheck() {
  yield {
    state: unifyGraph('The occurs check rejects infinite self-reference'),
    highlight: { active: ['uf', 'occurs', 'e-uf-occurs'], compare: ['bind'], found: ['subst'] },
    explanation: 'The dangerous equation is a = a -> b. Binding a to a type that contains a would create an infinite type. The occurs check catches that before the substitution is accepted.',
    invariant: 'If variable a occurs inside type t, do not bind a := t unless the language intentionally supports recursive types.',
  };
  yield {
    state: labelMatrix(
      'Unification cases',
      [
        { id: 'same', label: 'a = a' },
        { id: 'var', label: 'a = int' },
        { id: 'func', label: 'a->b = int->c' },
        { id: 'bad', label: 'a = list a' },
      ],
      [
        { id: 'rule', label: 'rule' },
        { id: 'result', label: 'result' },
      ],
      [
        ['same rep', 'no-op'],
        ['bind var', 'a:=int'],
        ['decompose', 'a=int,b=c'],
        ['occurs', 'reject'],
      ],
    ),
    highlight: { active: ['func:rule', 'func:result'], removed: ['bad:result'], found: ['var:result'] },
    explanation: 'Structured types unify by matching their constructors and recursively unifying their fields. Different constructors fail. Self-containing bindings fail the occurs check.',
  };
  yield {
    state: unifyGraph('A good error points to the constraint source'),
    highlight: { active: ['ast', 'eqs', 'occurs'], compare: ['type'], found: ['e-ast-eqs'] },
    explanation: 'Production compilers keep source spans and blame paths for constraints. The user should see the expression that forced the impossible equation, not just a solver-internal variable name.',
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
      heading: 'What it is',
      paragraphs: [
        'Unification solves equations between symbolic terms. In type inference, those terms are types: int, bool, a, list a, or a -> b. The solver finds a substitution that makes every constraint true, such as a := int and b := bool.',
        'The important word is general. A most-general unifier keeps as much freedom as possible while satisfying the equations. That is why unification is the engine under Hindley-Milner style inference rather than just a pile of special-case casts.',
      ],
    },
    {
      heading: 'Data structure model',
      paragraphs: [
        'A practical solver stores type variables in Union-Find (Disjoint Sets), structured type nodes in an arena, and constraints in a queue or stack. Equal variables are merged. A representative can carry a binding to a concrete structure. When two function types unify, the solver adds constraints for their argument and return types.',
        'The occurs check is the safety rail. Before binding a variable to a structure, the solver asks whether that variable appears inside the structure. If it does, the binding would create an infinite type such as a = a -> b, so ordinary HM inference rejects it.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For f(x) where x is later used as an int and the result is used as a bool, the inferencer may create x:a, f:b, result:c, then emit a = int, b = a -> c, and c = bool. Unification solves those equations into f:int -> bool and x:int.',
        'If the program applies a value to itself, as in x(x), the solver gets a constraint like a = a -> b. The occurs check rejects it in a non-recursive type system. That failure is not a runtime problem; it is the type graph refusing to represent an infinite shape.',
      ],
    },
    {
      heading: 'Implementation notes',
      paragraphs: [
        'Good diagnostics require provenance. Every constraint should know which AST node produced it, and each unification failure should keep the chain of equations that led to the conflict. Without provenance, the type solver may be correct but unusable.',
        'A small language can implement substitutions with maps first. A larger compiler benefits from union-find representatives, path compression, rank or size heuristics, and compact arenas for type structures. Hash Table is usually used to map source names and type variable ids into those internal records.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Robinson resolution paper at https://www.cs.tufts.edu/~nr/cs257/archive/john-alan-robinson/resolution.pdf, Cornell type inference and unification notes at https://www.cs.cornell.edu/courses/cs3110/2011sp/Lectures/lec26-type-inference/type-inference.htm, Cornell type inference summary at https://www.cs.cornell.edu/courses/cs3110/2016fa/l/17-inference/notes.html, and Aarhus type analysis notes on union-find unification at https://cs.au.dk/~amoeller/spa/2-type-analysis.pdf. Study Union-Find (Disjoint Sets), Pratt Parser Expression AST, Hindley-Milner Algorithm W & Let Polymorphism, and Symbolic Execution Path Constraints next.',
      ],
    },
  ],
};
