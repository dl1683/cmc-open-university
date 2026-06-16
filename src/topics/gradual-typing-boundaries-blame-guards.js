// Gradual typing: typed and untyped regions interoperate through dynamic
// boundaries, unknown/Any escape hatches, guards, narrowing, and blame.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'gradual-typing-boundaries-blame-guards',
  title: 'Gradual Typing Boundaries & Blame Guards',
  category: 'Concepts',
  summary: 'Bridge static and dynamic code with Any or unknown, runtime guards, boundary checks, narrowing facts, and blame when a contract fails.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['typed untyped boundary', 'narrowing and any'], defaultValue: 'typed untyped boundary' },
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

function gradualGraph(title) {
  return graphState({
    nodes: [
      { id: 'typed', label: 'typed', x: 0.9, y: 3.8, note: 'static' },
      { id: 'api', label: 'API', x: 2.6, y: 3.8, note: 'edge' },
      { id: 'guard', label: 'guard', x: 4.3, y: 2.4, note: 'check' },
      { id: 'any', label: 'Any', x: 4.3, y: 5.3, note: 'escape' },
      { id: 'dyn', label: 'dyn', x: 6.1, y: 3.8, note: 'runtime' },
      { id: 'narrow', label: 'narrow', x: 7.8, y: 2.4, note: 'flow' },
      { id: 'blame', label: 'blame', x: 7.8, y: 5.3, note: 'fail' },
      { id: 'safe', label: 'safe', x: 9.3, y: 3.8, note: 'use' },
    ],
    edges: [
      { id: 'e-typed-api', from: 'typed', to: 'api' },
      { id: 'e-api-guard', from: 'api', to: 'guard' },
      { id: 'e-api-any', from: 'api', to: 'any' },
      { id: 'e-guard-dyn', from: 'guard', to: 'dyn' },
      { id: 'e-any-dyn', from: 'any', to: 'dyn' },
      { id: 'e-dyn-narrow', from: 'dyn', to: 'narrow' },
      { id: 'e-dyn-blame', from: 'dyn', to: 'blame' },
      { id: 'e-narrow-safe', from: 'narrow', to: 'safe' },
    ],
  }, { title });
}

function* typedUntypedBoundary() {
  yield {
    state: gradualGraph('Gradual typing is a boundary discipline'),
    highlight: { active: ['typed', 'api', 'guard', 'dyn', 'e-typed-api', 'e-api-guard', 'e-guard-dyn'], compare: ['any'] },
    explanation: 'Gradual systems let typed and untyped code coexist. The key data structure is the boundary: where values cross, what is checked, and who is blamed if the check fails.',
  };
  yield {
    state: labelMatrix(
      'Boundary choices',
      [
        { id: 'static', label: 'static API' },
        { id: 'guarded', label: 'guarded edge' },
        { id: 'any', label: 'Any edge' },
        { id: 'unknown', label: 'unknown edge' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['early errors', 'adoption cost'],
        ['runtime proof', 'check cost'],
        ['migration speed', 'unsound use'],
        ['safe receipt', 'must narrow'],
      ],
    ),
    highlight: { active: ['guarded:benefit', 'unknown:risk'], compare: ['any:risk'], found: ['static:benefit'] },
    explanation: 'Any is convenient because it lets values flow freely. unknown is safer because code must narrow or check before using the value as something specific.',
    invariant: 'The boundary policy is part of program correctness, not just developer ergonomics.',
  };
  yield {
    state: gradualGraph('Blame names the failed side of the contract'),
    highlight: { active: ['guard', 'blame', 'e-dyn-blame'], compare: ['safe'], found: ['api'] },
    explanation: 'When a guarded boundary fails, blame should identify whether the typed side made an invalid promise or the dynamic side supplied an invalid value.',
  };
}

function* narrowingAndAny() {
  yield {
    state: gradualGraph('Narrowing turns runtime checks into static facts'),
    highlight: { active: ['dyn', 'narrow', 'safe', 'e-dyn-narrow', 'e-narrow-safe'], compare: ['any'] },
    explanation: 'A type guard such as typeof x === "string" or a predicate check can refine a broad type inside the guarded control-flow region.',
  };
  yield {
    state: labelMatrix(
      'Flow-sensitive facts',
      [
        { id: 'start', label: 'x: unknown' },
        { id: 'check', label: 'typeof x' },
        { id: 'then', label: 'then branch' },
        { id: 'else', label: 'else branch' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'allowed', label: 'allowed use' },
      ],
      [
        ['none', 'no props'],
        ['string?', 'split CFG'],
        ['x:string', 'x.trim()'],
        ['not string', 'fallback'],
      ],
    ),
    highlight: { active: ['check:fact', 'then:fact', 'then:allowed'], compare: ['start:allowed'], found: ['else:fact'] },
    explanation: 'TypeScript narrowing and Typed Racket occurrence typing both make runtime predicates inform later static checking. The fact is scoped by control flow.',
  };
  yield {
    state: gradualGraph('Any bypasses the checker and moves risk to runtime'),
    highlight: { active: ['any', 'dyn', 'blame', 'e-any-dyn', 'e-dyn-blame'], compare: ['guard', 'narrow'] },
    explanation: 'Any is useful during migration, but it erases static obligations. A robust codebase treats Any as technical debt that should be contained behind checked adapters.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'typed untyped boundary') yield* typedUntypedBoundary();
  else if (view === 'narrowing and any') yield* narrowingAndAny();
  else throw new InputError('Pick a gradual-typing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Gradual typing lets a language or codebase mix statically typed and dynamically typed regions. The promise is incremental adoption: add types where they help without rewriting the whole program at once.',
        'The data-structure view is a graph of boundaries. Values cross from typed code to untyped code and back. At each crossing, the system either checks a contract, marks the value as dynamic, requires narrowing, or lets Any bypass static checking.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Some gradual systems enforce runtime contracts at boundaries and assign blame when a value violates the promised type. Other practical systems, such as Python type hints and TypeScript, mostly use static checkers and leave ordinary runtime behavior unchanged unless the application adds explicit guards.',
        'Flow-sensitive narrowing is the bridge from dynamic checks back to static facts. After a predicate succeeds, the checker can refine a value inside that branch. When control flow merges, the refined fact may be weakened again.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine migrating a JavaScript payment adapter into TypeScript. The untyped adapter returns JSON from a provider. If the result is typed as any, callers can immediately read result.card.last4 and crash later if the provider changed shape. If the result is unknown, callers must validate the shape before use.',
        'A boundary adapter can parse the JSON, check that card exists, check that last4 is a string, and return a typed object. If validation fails, the adapter owns the blame and reports a provider-contract error. The rest of the typed application no longer has to treat every field access as a gamble.',
      ],
    },
    {
      heading: 'Engineering notes',
      paragraphs: [
        'The safest migration pattern is to keep dynamic values near the edge. Parse, validate, and narrow at boundaries, then pass typed values inward. Do not let Any spread through core logic, because every use of Any suppresses useful checker feedback.',
        'This module connects to Data-Flow Worklist Analysis because narrowing facts are flow-sensitive. It also connects to Bidirectional Type Checking: Synthesis & Checking because expected types and annotations often define where a dynamic value must become specific.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Siek and Taha gradual typing paper at https://scheme2006.cs.uchicago.edu/13-siek.pdf, Python typing concepts at https://typing.python.org/en/latest/spec/concepts.html, mypy dynamic typing docs at https://mypy.readthedocs.io/en/stable/dynamic_typing.html, TypeScript narrowing handbook at https://www.typescriptlang.org/docs/handbook/2/narrowing.html, TypeScript basic types any discussion at https://www.typescriptlang.org/docs/handbook/basic-types.html, and Typed Racket guide at https://docs.racket-lang.org/ts-guide/. Study Bidirectional Type Checking: Synthesis & Checking, Data-Flow Worklist Analysis, Taint Analysis Source-to-Sink Case Study, and JavaScript Lexical Environments & Closures next.',
      ],
    },
  ],
};
