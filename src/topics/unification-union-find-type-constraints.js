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
        "Read the animation as the execution trace for Unification Union-Find Type Constraints. Solve type equations with substitutions: fresh variables, equality constraints, union-find classes, occurs checks, and most-general unifiers..",
        {type: "callout", text: "Unification delays guesses: it records forced equalities, merges equivalent variables, and binds structures only when the occurs check says the type stays finite."},
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      
        {type: 'image', src: './assets/gifs/unification-union-find-type-constraints.gif', alt: 'Animated walkthrough of the unification union find type constraints visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
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
      heading: 'Where it fails',
      paragraphs: [
        'The missing structure is equality between unknowns. If b and c are the same result type, solving them separately can duplicate work and produce inconsistent errors.',
        'The other missing guard is the occurs check. If the solver accepts a = a -> b, it has said that a type contains itself. Ordinary Hindley-Milner inference rejects that infinite type rather than hiding it inside a substitution.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Do not guess a type. Create fresh variables, collect equality constraints from program use, and solve only what the constraints force.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Dsu_disjoint_sets_init.svg', alt: 'Initial disjoint-set forest with every element in its own set', caption: 'Union-Find starts with separate equivalence classes; type inference begins the same way when each unknown gets a fresh variable. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Dsu_disjoint_sets_init.svg.'},
        'Union-Find stores equal type variables as one equivalence class. Structured type terms store constructors such as int, bool, list a, and a -> b. A class can be bound to a structure only when doing so passes the occurs check.',
        'The target is the most-general unifier. If the program only proves a = b, the solver should merge a and b, not invent int. More specific answers can come later from more constraints.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inference first walks the expression tree. It gives fresh variables to unknown expressions and emits equations from usage: applying f to x emits f = a -> b, using a value as an int emits a = int, and returning two branch values emits left = right.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/Dsu_disjoint_sets_final.svg', alt: 'Final disjoint-set forest after several union operations', caption: 'After unions, equivalent unknowns share representatives; the type solver can then attach one structure to the class instead of repeating the same substitution. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Dsu_disjoint_sets_final.svg.'},
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
    }
  ],
};
