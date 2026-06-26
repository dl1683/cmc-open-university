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
        'The visualization has two views. "Synthesize vs check" shows a graph where type information flows in two directions through a syntax tree, plus a table classifying expression forms by mode. "Annotations" traces how an explicit type annotation turns a checking expression back into a synthesizing one.',
        'Each frame highlights the active nodes and edges. Green marks the current operation; blue marks the result. Step through slowly the first time to follow the direction of information flow, then replay at speed to see the full pipeline.',
        {type: 'image', src: './assets/gifs/bidirectional-type-checking-synthesis-checking.gif', alt: 'Animated walkthrough of the bidirectional type checking synthesis checking visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A type checker assigns types to every expression in a program so the compiler can catch mismatches before the code runs. The simplest approach is to infer a type for every expression from the bottom up, using only local syntax and a context (a mapping from variable names to types). That works for small languages but breaks down as the type system grows.',
        'Modern languages add subtyping (a Student is a Person), higher-rank polymorphism (functions that are themselves generic), typed holes (placeholders the programmer has not filled yet), effect annotations, gradual dynamic types, and dependent function types. In those systems, bottom-up inference alone faces expressions that genuinely do not carry enough information to determine a unique type. The language either rejects them, guesses globally, or asks the programmer for help.',
        'Bidirectional type checking is the structured answer. It splits the typing judgment into two modes so that type information flows in whichever direction it is available, rather than forcing a single global solver to reconstruct missing intent from distant clues.',
        {type: 'callout', text: 'Bidirectional checking makes type information flow where it is available instead of forcing a global solver to guess missing intent.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/da/BNF_of_Simply_Typed_Lambda_Calculus.svg', alt: 'BNF grammar of the simply typed lambda calculus showing term and type syntax', caption: 'The simply typed lambda calculus: the minimal formal system where bidirectional checking was first applied. Types annotate lambda parameters so inference stays local. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious design is pure bottom-up inference. Every expression synthesizes (produces) a type from its own syntax and the typing context. A variable x synthesizes its type by looking up x in the context. A literal 42 synthesizes int. An application f(x) synthesizes the return type of f after confirming that the argument type matches the parameter type.',
        'This works cleanly for expressions where all type information is local. Given a context {f: int -> bool, x: int}, the expression f(x) synthesizes bool in one step: look up f, confirm x has type int, return bool. No guessing required.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall appears with expressions that lack local type information. A bare lambda x => x + 1 does not say what type x has. A polymorphic empty list [] does not say which element type it holds. A higher-rank function that expects a polymorphic argument needs to know the expected shape before it can inspect the body.',
        'A global constraint solver (like Hindley-Milner\'s Algorithm W) can sometimes recover the missing types by collecting constraints from the entire program and solving them simultaneously. But that has costs: error messages point to unification failures far from the real mistake, the solver may be undecidable for richer type features, and incremental checking in an editor becomes expensive because changing one expression can invalidate constraints across the file.',
        'The bidirectional insight is that you do not need to guess globally when the surrounding context already knows the answer. If a lambda sits where int -> int is expected, the expected type tells you the parameter type. The question is how to wire that information flow into the checker systematically.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the typing judgment into two modes. Synthesis (synth) means the expression produces a type from local information: synth(ctx, e) = A. Checking (check) means the expression is verified against a type supplied by the surrounding context: check(ctx, e, A) succeeds or fails. These two functions call each other recursively as the checker walks the syntax tree.',
        'The classification of expression forms follows naturally. Variables, literals, and function applications synthesize because they carry enough information locally. Lambdas, object literals, and pattern-match branches check because they need external context to determine missing types. An annotation (e : A) bridges the two modes: the inner expression e is checked against A, and the annotated expression as a whole synthesizes A for the outside world.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Simple_syntax_tree.svg', alt: 'A simple syntax tree showing how expressions decompose into sub-expressions', caption: 'A syntax tree. Bidirectional checking walks this tree: synthesizing types upward from leaves, and pushing expected types downward from annotations and call sites. (Source: Wikimedia Commons)'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The implementation has two mutually recursive functions. synth(ctx, expr) pattern-matches on the expression form and returns a type. check(ctx, expr, expectedType) pattern-matches on the expression form, uses the expected type to fill in missing information, and either succeeds or reports an error.',
        'Variable rule (synth): look up the variable name in ctx. If found, return the bound type. If not found, report an unbound-variable error. Literal rule (synth): return the type determined by the literal\'s syntax (42 -> int, true -> bool, "hello" -> string).',
        'Application rule (synth): first synth the callee expression to get its type. If that type is A -> B, then check the argument against A. If the check succeeds, the application synthesizes B. If the callee\'s type is not a function type, report "cannot apply non-function." Lambda rule (check): if the expected type is A -> B, extend the context with the parameter bound to A, then check the body against B. If no function type is expected, report that the lambda needs an annotation.',
        'Subsumption rule (the bridge): if an expression synthesizes type A and the context expects type B, compare A against B using a compatibility relation. In the simplest case, compatibility is type equality. In richer languages, it is subtyping, effect compatibility, or gradual consistency.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Soundness is local. A synthesized type is justified entirely by the expression\'s syntax and the current context. A checked expression is accepted only because the checker verified it against an expected type that was itself justified by the surrounding context. There is no global constraint pool that might silently change meaning when a distant expression changes.',
        'Error locality follows from the same property. When synthesis fails, the error points at the expression that could not produce a type. When checking fails, the error points at the mismatch between the expression and the expected type. When subsumption fails, the error points at the compatibility check. Each failure mode has a distinct location and a distinct explanation.',
        'Incremental checking also benefits. An editor can push the declared type of a function parameter into the body and check the body without re-analyzing the entire file. This is why TypeScript, Rust, Scala 3, and many other modern language servers use bidirectional checking internally.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The runtime cost of bidirectional checking is proportional to the size of the syntax tree, since each node is visited once in either synth or check mode. The compatibility check at each subsumption point adds cost proportional to the depth of the types being compared. For most programs this is fast; deeply nested generic types or large union types can make individual comparisons expensive.',
        'The design cost is in rule engineering. The language designer must decide which forms synthesize and which check. If too many forms require checking, programmers drown in mandatory annotations. If too many forms try to synthesize, the checker drifts back toward global inference and loses the locality that makes errors clear. The sweet spot is language-specific and usually evolves over time as the type system grows.',
        'Subtyping and effects add implementation cost to the compatibility relation. That relation must be decidable, antisymmetric (or at least well-founded), and predictable enough that programmers can anticipate whether a given expression will pass the check. An overly clever compatibility relation can make the checker technically local while producing errors that feel as mysterious as a global solver\'s.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TypeScript uses bidirectional checking to push expected types into arrow functions, object literals, and array literals. When you write [1, 2, 3].map(x => x + 1), the expected type of the callback (number) => number flows from the signature of Array.map into the arrow function, so x gets type number without an annotation.',
        'Rust\'s type checker pushes expected types into closures, match arms, and the ? operator. The expected return type of a function flows into the last expression of its body, which is how Rust infers the type of Ok(value) without an explicit generic parameter. Scala 3\'s DOT calculus and Agda\'s elaborator are both explicitly bidirectional.',
        'Editor tooling benefits directly. Language servers use the expected type at the cursor position to offer completions, show typed holes, and validate partial expressions before the surrounding code is finished.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when programmers expect full inference everywhere. A bidirectional checker will reject a bare lambda in a position where no expected type is available, even if a global solver could reconstruct the type from a later use site. The fix is an annotation, but the error message must explain why the annotation is needed rather than just saying "cannot infer type."',
        'Nested context loss is a subtler failure. If function g calls function f and passes a lambda, the expected type for the lambda depends on f\'s signature. If f is itself polymorphic or overloaded, the checker may not have a concrete expected type to push down, and the lambda will fail to check even though the programmer\'s intent is unambiguous. Languages handle this with local type argument inference or by falling back to constraint solving for specific forms.',
        'Poor diagnostics can also undermine the system. When a subsumption check fails deep inside a nested expression, the error should trace back to the point where the expected type was introduced, not just report "int is not compatible with string" at the leaf.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace the expression let inc: int -> int = x => x + 1 step by step. The declaration says inc has type int -> int, so the right-hand side x => x + 1 is checked against int -> int.',
        'Step 1: check(ctx, x => x + 1, int -> int). The expected type is a function type, so the lambda rule fires. Extend the context with x: int. Check the body x + 1 against int. Step 2: check(ctx + {x: int}, x + 1, int). The expression x + 1 can synthesize: look up x (got int), look up the + operator for int (got int -> int -> int), apply to x and 1 (both int), synthesize int. Step 3: subsumption. The synthesized type int is compared against the expected type int. They are equal, so the check succeeds.',
        'Now consider the same lambda without a declaration: (x => x + 1). The checker tries synth on the lambda. There is no expected function type, so the lambda rule for synth fails. The error says "lambda requires a type annotation or an expected function type." The programmer adds (x: int) => x + 1, which makes x\'s type local, and the lambda can now synthesize int -> int.',
        'For a subtyping example, suppose Student <: Person. The expression let p: Person = makeStudent() checks makeStudent() against Person. Synthesis of makeStudent() yields Student. Subsumption compares Student against Person. Since Student <: Person, the check succeeds. If the subtyping direction were reversed, the checker would report "Person is not a subtype of Student" at exactly this point.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Pierce and Turner, "Local Type Inference" (2000), introduced the bidirectional framework for System F with subtyping: https://www.cis.upenn.edu/~bcpierce/papers/lti-toplas.pdf. Dunfield and Krishnaswami, "Bidirectional Typing" (2021), is the comprehensive survey covering extensions for polymorphism, dependent types, and effects: https://arxiv.org/pdf/1908.05839. David Christiansen\'s tutorial walks through a complete implementation from scratch: https://davidchristiansen.dk/tutorials/bidirectional.pdf.',
        'Study Hindley-Milner inference (Algorithm W) next to understand the global constraint approach that bidirectional checking partially replaces. Then look at unification and union-find for type constraints, gradual typing for the compatibility relation between static and dynamic types, and dependent type elaboration (Agda, Idris) for the most demanding application of bidirectional checking.',
      ],
    },
  ],
};
