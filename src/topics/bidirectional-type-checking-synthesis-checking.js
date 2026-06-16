// Bidirectional type checking: split inference into expressions that synthesize
// a type upward and expressions that check against an expected type downward.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'bidirectional-type-checking-synthesis-checking',
  title: 'Bidirectional Type Checking: Synthesis & Checking',
  category: 'Concepts',
  summary: 'Implement local type inference by splitting expressions into synthesize-up and check-down modes, using annotations where inference needs direction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['synthesize vs check', 'annotations'], defaultValue: 'synthesize vs check' },
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

function bidiGraph(title) {
  return graphState({
    nodes: [
      { id: 'expr', label: 'expr', x: 0.9, y: 3.8, note: 'term' },
      { id: 'synth', label: 'synth', x: 2.7, y: 2.3, note: 'up' },
      { id: 'check', label: 'check', x: 2.7, y: 5.3, note: 'down' },
      { id: 'expect', label: 'expect', x: 4.7, y: 5.3, note: 'A' },
      { id: 'rules', label: 'rules', x: 4.7, y: 2.3, note: 'local' },
      { id: 'ann', label: 'ann', x: 6.5, y: 3.8, note: ': A' },
      { id: 'sub', label: '<:', x: 8.0, y: 2.4, note: 'compat' },
      { id: 'ok', label: 'ok', x: 9.2, y: 3.8, note: 'typed' },
    ],
    edges: [
      { id: 'e-expr-synth', from: 'expr', to: 'synth' },
      { id: 'e-expr-check', from: 'expr', to: 'check' },
      { id: 'e-check-expect', from: 'check', to: 'expect' },
      { id: 'e-synth-rules', from: 'synth', to: 'rules' },
      { id: 'e-expect-ann', from: 'expect', to: 'ann' },
      { id: 'e-rules-ann', from: 'rules', to: 'ann' },
      { id: 'e-ann-sub', from: 'ann', to: 'sub' },
      { id: 'e-sub-ok', from: 'sub', to: 'ok' },
    ],
  }, { title });
}

function* synthesizeVsCheck() {
  yield {
    state: bidiGraph('Types move in two directions'),
    highlight: { active: ['expr', 'synth', 'check', 'e-expr-synth', 'e-expr-check'], compare: ['ok'] },
    explanation: 'A synthesizing expression produces its type from local information. A checking expression is validated against a type supplied by the surrounding context.',
  };
  yield {
    state: labelMatrix(
      'Mode split',
      [
        { id: 'var', label: 'variable' },
        { id: 'lit', label: 'literal' },
        { id: 'app', label: 'apply' },
        { id: 'lam', label: 'lambda' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['synth', 'env lookup'],
        ['synth', 'known form'],
        ['synth', 'function type'],
        ['check', 'needs arg type'],
      ],
    ),
    highlight: { active: ['app:mode', 'lam:mode'], found: ['var:reason'], compare: ['lam:reason'] },
    explanation: 'Variables and literals usually synthesize. Lambdas usually check against an expected function type, because their parameter type is otherwise missing.',
    invariant: 'When inference gets stuck, require an annotation at the boundary instead of guessing globally.',
  };
  yield {
    state: bidiGraph('Local checking reduces global solver pressure'),
    highlight: { active: ['check', 'expect', 'ann', 'e-check-expect', 'e-expect-ann'], found: ['ok'] },
    explanation: 'Bidirectional checking is popular because it keeps inference local. The expected type guides the inside of a term, so the checker needs fewer whole-program guesses.',
  };
}

function* annotations() {
  yield {
    state: bidiGraph('Annotations switch checking back into synthesis'),
    highlight: { active: ['ann', 'synth', 'rules', 'e-rules-ann'], compare: ['expect'], found: ['sub'] },
    explanation: 'An annotated expression (e : A) can synthesize A after the checker verifies that e checks against A. This is the bridge between explicit programmer intent and local inference.',
  };
  yield {
    state: labelMatrix(
      'Example: lambda',
      [
        { id: 'raw', label: 'x => x+1' },
        { id: 'ann', label: ': int->int' },
        { id: 'body', label: 'x+1' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        ['no expected type', 'cannot synth'],
        ['expected fn', 'check lambda'],
        ['x:int', 'body:int'],
        ['int->int', 'typed'],
      ],
    ),
    highlight: { active: ['ann:input', 'body:input', 'body:output'], found: ['result:output'], compare: ['raw:output'] },
    explanation: 'The annotation supplies the function type. The checker pushes int down to the parameter, checks the body, and accepts the lambda as int -> int.',
  };
  yield {
    state: bidiGraph('Subtyping and gradual systems add compatibility checks'),
    highlight: { active: ['sub', 'ok', 'e-ann-sub', 'e-sub-ok'], compare: ['rules'], found: ['ann'] },
    explanation: 'In richer languages, synthesis may produce a type that only needs to be compatible with the expected type. That compatibility relation may include subtyping, unions, effects, or gradual dynamic types.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'synthesize vs check') yield* synthesizeVsCheck();
  else if (view === 'annotations') yield* annotations();
  else throw new InputError('Pick a bidirectional type-checking view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Bidirectional type checking splits type checking into two judgments. Synthesis asks an expression to produce a type. Checking asks an expression to conform to a type already known from context. This keeps inference local and makes annotation requirements predictable.',
        'The idea is especially useful when full Hindley-Milner Algorithm W & Let Polymorphism is either too global or too weak for the language features involved, such as subtyping, higher-rank polymorphism, dependent types, or gradual boundaries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Variables synthesize by environment lookup. Literals synthesize from their syntax. Function application synthesizes by first synthesizing the function type, then checking the argument against the parameter type. Lambdas usually check against an expected function type, because their parameter type is not locally visible unless annotated.',
        'Annotations are mode switches. If e checks against A, then (e : A) can synthesize A. That lets programmers place a small number of annotations at boundaries while the checker fills in local details inside each boundary.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'For x => x + 1, a checker with no expected type may not know whether x is int, float, bigint, or a custom numeric type. If the context expects int -> int, checking pushes int down to x, verifies x + 1 has type int, and accepts the lambda.',
        'For map(xs, x => x.id), the call expression may synthesize enough information from map and xs to check the lambda against an expected element type. The lambda did not need a full global solver; the application context supplied its missing shape.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'A bidirectional checker should make mode transitions explicit in code. Separate synth(expr) from check(expr, expected), and keep error messages tied to the mode that failed. A vague "cannot infer type" is much weaker than "lambda needs an expected function type or an annotation here."',
        'This style also fits IDEs. As users edit code, annotations and outer contexts create islands of stable expected types. The checker can produce useful local errors without solving the entire file perfectly after every keystroke.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Pierce and Turner, Local Type Inference, at https://www.cis.upenn.edu/~bcpierce/papers/lti-toplas.pdf, David Christiansen bidirectional typing tutorial at https://davidchristiansen.dk/tutorials/bidirectional.pdf, and Bidirectional Typing survey at https://arxiv.org/pdf/1908.05839. Study Hindley-Milner Algorithm W & Let Polymorphism, Unification Union-Find Type Constraints, Gradual Typing Boundaries & Blame Guards, and Data-Flow Worklist Analysis next.',
      ],
    },
  ],
};
