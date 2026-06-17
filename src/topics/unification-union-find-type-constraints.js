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
      heading: 'Why this exists',
      paragraphs: [
        'A type checker often knows how a value is used before it knows what the value is. In f(x), the argument type, function type, and return type may all start unknown.',
        'The compiler needs one set of type assignments that makes every use agree. If x is tested in an if condition, x must be bool. If f(x) is added to 1, the result of f must be int. Those facts must meet in one solver.',
        'Unification is the equality solver for this problem. It takes equations between type terms and returns the most general substitution that makes the equations true.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first attempt is local checking. Give 1 the type int, give true the type bool, check each function call against the function annotation, and report an error when a local rule fails.',
        'That works for annotated code. It breaks down when the program leaves types implicit and lets one unknown flow through several expressions. A local checker either guesses too early or keeps rediscovering that several variables are really the same unknown.',
      ],
    },
    {
      heading: 'Where the naive approach breaks',
      paragraphs: [
        'The missing structure is equality between unknowns. If b and c are the same result type, solving them separately can duplicate work and produce inconsistent errors.',
        'The other missing guard is the occurs check. If the solver accepts a = a -> b, it has said that a type contains itself. Ordinary Hindley-Milner inference rejects that infinite type rather than hiding it inside a substitution.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Do not guess a type. Create fresh variables, collect equality constraints from program use, and solve only what the constraints force.',
        'Union-Find stores equal type variables as one equivalence class. Structured type terms store constructors such as int, bool, list a, and a -> b. A class can be bound to a structure only when doing so passes the occurs check.',
        'The target is the most-general unifier. If the program only proves a = b, the solver should merge a and b, not invent int. More specific answers can come later from more constraints.',
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        'Inference first walks the expression tree. It gives fresh variables to unknown expressions and emits equations from usage: applying f to x emits f = a -> b, using a value as an int emits a = int, and returning two branch values emits left = right.',
        'The solver keeps a worklist of equations. If the equation is a = a, it is done. If it is a = b, the two classes are unioned. If it is a = int, the class for a is bound to int. If it is a -> b = int -> c, the solver decomposes it into a = int and b = c.',
        'Different constructors fail immediately. int cannot unify with bool, and list a cannot unify with a function type. A variable can bind to a structure only if that variable does not occur inside the structure.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every solver rule preserves the set of possible substitutions. Merging a = b is safe because any solution must assign them the same type. Binding a = int is safe when no previous binding conflicts. Decomposing function equality is safe because two function types are equal only when their argument and result types are equal.',
        'The occurs check preserves finite types. If a occurs inside t, binding a := t would require expanding a forever. Rejecting that equation prevents the solver from manufacturing a recursive type the language did not ask for.',
        'Generality comes from restraint. Union-Find records equalities without choosing concrete types until a concrete type is forced. That is why the result can be reused in more call sites.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the unify-variables view, follow the path from AST to fresh variables to equality constraints. The important state change is when separate unknowns become one Union-Find class; after that, every later binding applies to the whole class.',
        'In the constraint table, the solver action column is the rule being applied. "bind a" narrows one representative. "decompose" replaces one structural equation with smaller equations. "union b,c" says the two names no longer carry separate information.',
        'In the occurs-check view, the highlighted self-reference is the boundary between a valid substitution and an infinite type. The rejected row is not an implementation detail; it is what keeps ordinary inference sound.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose the compiler sees f(x) + 1. Give x the fresh type a, give f(x) the fresh type b, and introduce a fresh result type c for f. The function call gives the equation f = a -> c. The addition gives c = int and the whole expression has type int.',
        'If x is also used in if x then ..., the condition emits a = bool. The solver binds the class for a to bool and the class for c to int, so f must have type bool -> int.',
        'No guess was needed. The program uses forced each binding. If a later constraint says f = string -> int, unification reaches bool = string and reports the conflict at the source spans that produced those constraints.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Union-Find makes repeated equality between variables cheap. With path compression and union by rank or size, find and union are amortized inverse-Ackermann time, effectively constant for normal compiler inputs.',
        'The expensive work is usually structural: walking type terms during decomposition, running occurs checks, normalizing representatives, and carrying source provenance for diagnostics.',
        'A teaching compiler can use maps and recursive type trees. A production compiler usually uses compact arenas, representative IDs, binding records, levels for generalization, and delayed normalization so the solver does not rebuild large trees on every lookup.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Unification is the core mechanism behind Hindley-Milner inference, many logic-programming systems, symbolic term solving, and equality-heavy static analyses.',
        'It fits when the relation is equality and the answer should stay as general as possible. It also fits compiler diagnostics when each constraint carries provenance; the solver can explain which expression forced int = bool instead of exposing internal variable names.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'Plain first-order unification solves equality. It does not by itself solve subtyping, overload resolution, type classes, effects, row polymorphism, higher-rank polymorphism, ownership, lifetimes, or gradual type boundaries.',
        'Languages with explicit recursive types need different rules than ordinary HM inference. In those languages, the question is not whether a variable occurs in a type, but whether the recursive type is introduced through an allowed form.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Skipping the occurs check is the classic unsound shortcut. It may make easy programs pass, then produce infinite types or crashes when recursive constraints appear.',
        'Guessing concrete types too early loses the most-general unifier. That can make a valid program fail later because the solver committed to int where the constraints only required a shared unknown.',
        'Poor provenance turns a correct solver into a bad user experience. The compiler should report the source expressions that created the conflicting constraints, not only the final internal equation.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Union-Find (Disjoint Sets) for the representative data structure, Pratt Parser Expression AST for where constraints come from, Hindley-Milner Algorithm W & Let Polymorphism for full inference, Symbolic Execution Path Constraints for another constraint-solving workflow, and Gradual Typing Boundaries for a contrasting type relation that is not just equality.',
        'Good references: Robinson resolution paper at https://www.cs.tufts.edu/~nr/cs257/archive/john-alan-robinson/resolution.pdf, Cornell type inference and unification notes at https://www.cs.cornell.edu/courses/cs3110/2011sp/Lectures/lec26-type-inference/type-inference.htm, Cornell type inference summary at https://www.cs.cornell.edu/courses/cs3110/2016fa/l/17-inference/notes.html, and Aarhus type analysis notes on union-find unification at https://cs.au.dk/~amoeller/spa/2-type-analysis.pdf.',
      ],
    },
  ],
};
