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
  const modes = ['synth', 'check'];
  const forms = ['variable', 'literal', 'apply', 'lambda'];
  yield {
    state: bidiGraph('Types move in two directions'),
    highlight: { active: ['expr', 'synth', 'check', 'e-expr-synth', 'e-expr-check'], compare: ['ok'] },
    explanation: `A ${modes[0]}esizing expression produces its type from local information. A ${modes[1]}ing expression is validated against a type supplied by the surrounding context.`,
  };
  const synthForms = [forms[0], forms[1], forms[2]];
  const checkForms = [forms[3]];
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
    explanation: `${synthForms.join(', ')}s usually synthesize. ${checkForms[0]}s usually check against an expected function type, because their parameter type is otherwise missing.`,
    invariant: `When inference gets stuck, require an annotation at the boundary instead of guessing globally — ${modes.length} modes keep the search local.`,
  };
  const activeNodes = ['check', 'expect', 'ann'];
  yield {
    state: bidiGraph('Local checking reduces global solver pressure'),
    highlight: { active: [...activeNodes, 'e-check-expect', 'e-expect-ann'], found: ['ok'] },
    explanation: `Bidirectional checking is popular because it keeps inference local. The expected type at ${activeNodes[1]} guides the inside of a term, so the checker needs fewer whole-program guesses.`,
  };
}

function* annotations() {
  const annotExpr = '(e : A)';
  const typeVar = 'A';
  yield {
    state: bidiGraph('Annotations switch checking back into synthesis'),
    highlight: { active: ['ann', 'synth', 'rules', 'e-rules-ann'], compare: ['expect'], found: ['sub'] },
    explanation: `An annotated expression ${annotExpr} can synthesize ${typeVar} after the checker verifies that e checks against ${typeVar}. This is the bridge between explicit programmer intent and local inference.`,
  };
  const paramType = 'int';
  const fnType = `${paramType}->${paramType}`;
  const steps = [
    { label: 'x => x+1', input: 'no expected type', output: 'cannot synth' },
    { label: `: ${fnType}`, input: 'expected fn', output: 'check lambda' },
    { label: `x+1`, input: `x:${paramType}`, output: `body:${paramType}` },
    { label: 'result', input: fnType, output: 'typed' },
  ];
  yield {
    state: labelMatrix(
      'Example: lambda',
      [
        { id: 'raw', label: steps[0].label },
        { id: 'ann', label: steps[1].label },
        { id: 'body', label: steps[2].label },
        { id: 'result', label: steps[3].label },
      ],
      [
        { id: 'input', label: 'input' },
        { id: 'output', label: 'output' },
      ],
      [
        [steps[0].input, steps[0].output],
        [steps[1].input, steps[1].output],
        [steps[2].input, steps[2].output],
        [steps[3].input, steps[3].output],
      ],
    ),
    highlight: { active: ['ann:input', 'body:input', 'body:output'], found: ['result:output'], compare: ['raw:output'] },
    explanation: `The annotation supplies the function type. The checker pushes ${paramType} down to the parameter, checks the body, and accepts the lambda as ${fnType}.`,
  };
  const compatRelations = ['subtyping', 'unions', 'effects', 'gradual dynamic types'];
  yield {
    state: bidiGraph('Subtyping and gradual systems add compatibility checks'),
    highlight: { active: ['sub', 'ok', 'e-ann-sub', 'e-sub-ok'], compare: ['rules'], found: ['ann'] },
    explanation: `In richer languages, synthesis may produce a type that only needs to be compatible with the expected type. That compatibility relation may include ${compatRelations.join(', ')}.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/bidirectional-type-checking-synthesis-checking.gif', alt: 'Animated walkthrough of the bidirectional type checking synthesis checking visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why This Exists',
      paragraphs: [
        'A type checker has two jobs that pull in opposite directions. Programmers want to omit obvious type annotations, but they also want precise errors, fast editor feedback, and language features that make types more expressive than the terms alone.',
        'Full inference works well for small ML-style cores, but modern languages often include subtyping, overloaded operations, higher-rank functions, typed holes, effects, gradual dynamic values, or dependent function types. In those languages, guessing every missing type globally can become expensive, unpredictable, or impossible to explain.',
        'Bidirectional type checking exists to make the flow of type information explicit. Some expressions produce a type from syntax and the environment. Other expressions are checked against a type that the surrounding context already knows.',
        {type: 'callout', text: 'Bidirectional checking makes type information flow where it is available instead of forcing a global solver to guess missing intent.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/da/BNF_of_Simply_Typed_Lambda_Calculus.svg', alt: 'BNF grammar of the simply typed lambda calculus showing term and type syntax', caption: 'The simply typed lambda calculus: the minimal formal system where bidirectional checking was first applied. Types annotate lambda parameters so inference stays local. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'The Obvious Approach and the Wall',
      paragraphs: [
        'The obvious implementation is bottom-up inference: infer a type for every expression, then combine the results. Variables synthesize from the environment. Literals synthesize from their syntax. If f has type int -> bool and x has type int, then f(x) has type bool.',
        'The wall appears with terms that need context. A bare lambda like x => x + 1 does not carry the type of x. A polymorphic empty list does not tell you which element type it should have. A higher-rank function may require the checker to know the expected shape before it can inspect the body.',
        'A global constraint solver can sometimes recover the missing information, but that pushes complexity into distant call sites and often produces errors far from the real cause. The bidirectional approach says: when local syntax does not carry enough information, get direction from the surrounding expected type or require an annotation at that boundary.',
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'Split typing into two judgments. In synthesis mode, an expression produces a type: infer(expr) returns A. In checking mode, an expression is verified against an expected type: check(expr, A) succeeds or reports why the expression does not fit A.',
        'The split changes the shape of the implementation. Variables, literals, field access, and many applications synthesize. Lambdas, object literals, pattern branches, and other context-sensitive forms often check. An annotation is the bridge: after e checks against A, the annotated expression (e : A) can synthesize A for the outside world.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Simple_syntax_tree.svg', alt: 'A simple syntax tree showing how expressions decompose into sub-expressions', caption: 'A syntax tree. Bidirectional checking walks this tree: synthesizing types upward from leaves, and pushing expected types downward from annotations and call sites. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the synthesize vs check view, read the arrows as type information moving through the syntax tree. The synth path moves upward from expression to type. The check path moves downward from an expected type into the expression. The table shows why variables and literals are easy, while lambdas need an expected function type.',
        'In the annotations view, focus on the mode switch. The annotation supplies the missing type, the inside expression is checked against it, and the outer expression can now synthesize it. The subtyping node is the place where a synthesized type is compared with the expected one.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'A checker usually keeps two mutually recursive functions. synth(context, expr) returns a type when the expression can determine one locally. check(context, expr, expected) verifies that the expression has the expected type.',
        'Variables synthesize by lookup in the context. Literals synthesize from their syntax. An application can synthesize by first synthesizing the callee, confirming that the callee has a function type, checking the argument against the parameter type, and returning the result type.',
        'A lambda usually checks. If the expected type is int -> int, the checker binds x : int while checking the body, then verifies that the body checks against int. If no expected function type is available, the checker asks for an annotation instead of guessing the parameter type from the whole program.',
        'A common rule connects the two modes: if an expression synthesizes A, it can check against B when A is compatible with B. In a simple language, compatible means equal. In richer languages, it may mean subtype, assignable, effect-compatible, or dynamically guarded.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The soundness story is local. A synthesized type is justified by syntax and the current context. A checked expression is accepted only because the checker has verified it against an expected type. The compatibility relation is explicit, so the implementation has a named place to handle subtyping or other language-specific rules.',
        'The practical win is that the checker uses information at the point where it is available. A function parameter type may be absent inside a lambda expression, but present in the annotation, variable declaration, function argument position, or branch target surrounding that lambda.',
        'This does not make inference more magical. It makes the boundary between inference and required programmer intent visible.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Consider x => x + 1. By itself, the lambda does not synthesize a type because x has no type in the environment. Now put it where int -> int is expected, for example let inc: int -> int = x => x + 1.',
        'The declaration pushes int -> int down into the lambda. The checker binds x : int, checks x + 1 against int, and accepts the lambda. The full declaration can now synthesize or expose int -> int to later code.',
        'The same pattern explains application checking. If map expects a function A -> B and a list of A, then the expected parameter type can flow into the lambda passed to map. The programmer gets local inference without asking the checker to solve every lambda from scratch.',
      ],
    },
    {
      heading: 'Costs and Tradeoffs',
      paragraphs: [
        'Bidirectional checking keeps many decisions local, which helps compilers, interpreters, and IDEs. The checker can often report a useful error as soon as synthesis, checking, or compatibility fails.',
        'The tradeoff is rule design. If too many forms require checking, users drown in annotations. If too many forms try to synthesize, the implementation drifts back toward global inference and weaker diagnostics. The language designer has to choose where annotations are expected and make those points feel natural.',
        'Subtyping and effects add another cost. The compatibility relation must be decidable, predictable, and explainable. Otherwise the checker may still be local but the errors will feel mysterious.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'Bidirectional checking wins in languages with expressive type features: higher-rank polymorphism, typed holes, dependent function types, object and record literals, union and intersection types, gradual typing, effects, and typed macro or DSL boundaries.',
        'It also wins in editor tooling. Expected types from declarations and call sites let the editor check a nested expression even while the surrounding file is incomplete.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'It fails when users expect full inference everywhere. Some expressions really need annotations, and a bidirectional checker should say that plainly instead of pretending the missing information can always be reconstructed.',
        'It can also fail through poor diagnostics. A nested lambda may fail because the outer expression did not provide an expected function type. Good errors should identify whether synthesis failed, checking failed, or a synthesized type failed compatibility with the expected type.',
        'The repair is often an annotation at the boundary where human intent is clearer than syntax.',
      ],
    },
    {
      heading: 'Sources and Study Next',
      paragraphs: [
        'Primary sources: Pierce and Turner, Local Type Inference, at https://www.cis.upenn.edu/~bcpierce/papers/lti-toplas.pdf, David Christiansen bidirectional typing tutorial at https://davidchristiansen.dk/tutorials/bidirectional.pdf, and Bidirectional Typing survey at https://arxiv.org/pdf/1908.05839. Study Hindley-Milner Algorithm W & Let Polymorphism, Unification Union-Find Type Constraints, Gradual Typing Boundaries & Blame Guards, and Data-Flow Worklist Analysis next.',
      ],
    },
  ],
};
