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
      heading: 'Why this exists',
      paragraphs: [
        'Real codebases are rarely all static or all dynamic. A typed module imports an untyped library, a JavaScript service consumes JSON from another team, a Python package has partial hints, or a migration leaves old and new modules side by side.',
        'Gradual typing is the discipline for that mixed world. It lets typed and untyped regions coexist, but it must answer a concrete question at every crossing: what evidence lets this value be treated as this type?',
        {type: 'callout', text: 'A gradual type boundary is honest only when it records what was checked, what remains unknown, and who owns a failed contract.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'One obvious approach is to rewrite everything before trusting the type checker. That is clean on paper and usually impossible in production. Another approach is to annotate the easy parts and let unchecked values flow as Any.',
        'The wall is misplaced trust. If typed code accepts unvalidated dynamic data, the checker may approve a field access that still crashes at runtime. If Any spreads through core logic, the program can look typed while the checker has stopped protecting the important paths.',
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious approach is to make a codebase fully typed before trusting it. That is rarely viable for real migrations. The opposite shortcut is to mark hard values as Any and move on.',
        'The wall is that unchecked values can cross into typed code and make the static model lie. Gradual typing is useful only when the boundary tells the truth about what has and has not been checked.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Treat the boundary as executable structure, not as a comment. A value crossing from dynamic to typed code can be checked by a runtime contract, wrapped by a proxy, parsed by an adapter, accepted as Any, or received as unknown and narrowed before use.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A typed boundary is an edge with policy: values can cross only with the amount of evidence the destination side requires. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg'},
        'Any and unknown are different policies. Any says "stop checking this value and trust the programmer." unknown says "there is a value here, but prove its shape before using it." Guards and narrowing are the mechanism that turns runtime evidence back into static facts.',
      ],
    },
    {
      heading: 'Invariant and proof idea',
      paragraphs: [
        'The useful invariant is local trust: typed code should use a value as type T only when the checker has a static proof, the boundary has produced a runtime proof, or the code is deliberately inside an unchecked region such as Any.',
        'Blame is the debugging version of that invariant. When a guarded boundary fails, the system should report which side broke the contract: the provider that supplied a bad value, or the typed side that promised an invalid shape to dynamic code.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a typed TypeScript module reads provider JSON for a user profile. If the response is typed as Any, code can immediately call user.email.toLowerCase(), even when email is missing. The crash happens later and far from the boundary.',
        {type: 'image', src: 'https://www.json.org/img/json160.gif', alt: 'JSON logo', caption: 'JSON inputs are the everyday boundary case: a parser can confirm syntax, but the application still needs shape evidence. Source: JSON.org, https://www.json.org/json-en.html'},
        'If the response is received as unknown, the module must parse or guard it first. After a predicate proves that email is a string, the checker can allow string methods in the dominated branch. The runtime check and static narrowing now point to the same fact.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'In the typed-untyped-boundary view, follow the API edge. The guarded path represents a boundary that checks before allowing typed use; the Any path represents a faster migration path that moves risk inward. The blame node is not an error decoration; it is the location where a failed contract should be explained.',
        'In the narrowing-and-any view, watch how the narrow node turns a dynamic value into a scoped safe use. Compare it with the Any path, where the checker has less information and the failure can move deeper into runtime behavior.',
      ],
    },
    {
      heading: 'Runtime and static behavior',
      paragraphs: [
        'Gradual systems differ. Typed Racket-style systems can enforce contracts at typed/untyped boundaries. TypeScript and Python type hints mostly add static analysis and leave runtime behavior unchanged unless the program uses explicit parsers, guards, assertions, or validation libraries.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Typescript.svg/250px-Typescript.svg.png', alt: 'TypeScript logo', caption: 'TypeScript represents the static-analysis side of gradual typing: it tracks evidence at compile time but needs explicit guards for runtime data. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Typescript.svg'},
        'Flow-sensitive narrowing is scoped by control flow. A typeof check, discriminant check, predicate function, or parser result can refine a value only along paths where the check is known to hold. Once control merges with paths where the predicate may be false, the checker must weaken the fact.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Runtime contracts add checking cost, wrapper complexity, and sometimes proxy overhead. Static-only annotations are cheaper at runtime but cannot prove that external data actually has the annotated shape. Any is fastest to adopt but easiest to misuse.',
        'The engineering rule is containment. Validate at IO, API, plugin, and module edges, then pass typed values inward. Every Any that escapes those edges expands the unchecked region and makes later failures harder to localize.',
      ],
    },
    {
      heading: 'Useful contexts',
      paragraphs: [
        'Gradual typing is useful for migrations, public APIs, plugin systems, JSON adapters, mixed-language services, notebook-to-library hardening, and teams that need better editor feedback before they can afford full static coverage.',
        'It also helps design conversations. A boundary forces the team to decide which modules are trusted, which data is external, which adapters own validation, and where blame should land when a contract fails.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'Gradual typing fails when annotations are treated as validation. A TypeScript interface for provider JSON does not inspect the response. Without a parser or guard, the interface is a claim, not evidence.',
        'It also fails socially when Any becomes normal in core code. The codebase can accumulate a typed surface and a dynamic interior, which is worse than being honest about the remaining untyped region.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Put validators at IO and module boundaries, not deep inside business logic. Parse JSON, plugin payloads, CLI arguments, environment variables, and database rows into typed internal records before they spread.',
        'Track Any as debt. A temporary Any at an adapter can be acceptable during migration; an exported Any in a core type turns the checker off for every caller that touches it.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A payments service migrates one endpoint from JavaScript to TypeScript. The external payment provider still returns untyped JSON. If the response is cast to PaymentResult, the compiler trusts fields that may not exist. A malformed provider response can then break reconciliation hours later.',
        'A better adapter receives unknown, validates the provider schema, converts it into an internal PaymentResult, and records blame when validation fails. The rest of the service sees a typed object because the boundary created evidence, not because an annotation wished the evidence into existence.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Measure migration health by unchecked boundary count, not by percentage of files with annotations. A small number of exported Any types can poison a large typed surface, while many private migration shims may be low risk if they are contained.',
        'Prefer narrow escape hatches. If a library has no types, wrap the handful of functions you use and validate their outputs. Do not let the library Any flow through the application as a substitute for an adapter.',
      ],
    },
    {
      heading: 'Failure analysis',
      paragraphs: [
        'When a runtime type failure appears inside typed code, trace the value backward to the last unchecked boundary. The bug is often not the line that crashed; it is the earlier cast, Any export, unchecked JSON parse, or dynamic callback that let an unproved value enter the typed region.',
        'Good blame messages shorten that search. They should name the boundary, the expected shape, the actual value, and the side that supplied the bad value. Without that information, gradual typing can turn runtime bugs into archaeology.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Siek and Taha gradual typing at https://scheme2006.cs.uchicago.edu/13-siek.pdf, Python typing concepts at https://typing.python.org/en/latest/spec/concepts.html, mypy dynamic typing at https://mypy.readthedocs.io/en/stable/dynamic_typing.html, TypeScript narrowing at https://www.typescriptlang.org/docs/handbook/2/narrowing.html, TypeScript any at https://www.typescriptlang.org/docs/handbook/basic-types.html, and Typed Racket at https://docs.racket-lang.org/ts-guide/.',
        'Study Bidirectional Type Checking: Synthesis and Checking for checker structure, Data-Flow Worklist Analysis for fact propagation, Taint Analysis Source-to-Sink Case Study for boundary tracking, and JavaScript Lexical Environments and Closures for runtime scope mechanics.',
      ],
    },
  ],
};
