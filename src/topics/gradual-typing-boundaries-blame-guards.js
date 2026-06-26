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
  const numNodes = 8;
  const numEdges = 8;
  const boundaryChoices = ['static API', 'guarded edge', 'Any edge', 'unknown edge'];

  yield {
    state: gradualGraph('Gradual typing is a boundary discipline'),
    highlight: { active: ['typed', 'api', 'guard', 'dyn', 'e-typed-api', 'e-api-guard', 'e-guard-dyn'], compare: ['any'] },
    explanation: `Gradual systems let typed and untyped code coexist across ${numNodes} nodes connected by ${numEdges} edges. The key data structure is the boundary: where values cross, what is checked, and who is blamed if the check fails.`,
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
    explanation: `This table presents ${boundaryChoices.length} boundary policies: ${boundaryChoices.join(', ')}. Any is convenient because it lets values flow freely. unknown is safer because code must narrow or check before using the value as something specific.`,
    invariant: `The boundary policy across ${boundaryChoices.length} choices is part of program correctness, not just developer ergonomics.`,
  };
  yield {
    state: gradualGraph('Blame names the failed side of the contract'),
    highlight: { active: ['guard', 'blame', 'e-dyn-blame'], compare: ['safe'], found: ['api'] },
    explanation: `When a guarded boundary fails among the ${numEdges} edges, blame should identify whether the typed side made an invalid promise or the dynamic side supplied an invalid value.`,
  };
}

function* narrowingAndAny() {
  const flowSteps = ['x: unknown', 'typeof x', 'then branch', 'else branch'];
  const numNodes = 8;

  yield {
    state: gradualGraph('Narrowing turns runtime checks into static facts'),
    highlight: { active: ['dyn', 'narrow', 'safe', 'e-dyn-narrow', 'e-narrow-safe'], compare: ['any'] },
    explanation: `A type guard such as typeof x === "string" or a predicate check can refine a broad type inside the guarded control-flow region, turning dynamic evidence into static facts across ${numNodes} graph nodes.`,
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
    explanation: `TypeScript narrowing and Typed Racket occurrence typing both make runtime predicates inform later static checking. This table traces ${flowSteps.length} steps: ${flowSteps.join(' -> ')}. The fact is scoped by control flow.`,
  };
  yield {
    state: gradualGraph('Any bypasses the checker and moves risk to runtime'),
    highlight: { active: ['any', 'dyn', 'blame', 'e-any-dyn', 'e-dyn-blame'], compare: ['guard', 'narrow'] },
    explanation: `Any is useful during migration, but it erases static obligations across the ${numNodes}-node type graph. A robust codebase treats Any as technical debt that should be contained behind checked adapters.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The graph view shows eight nodes representing regions of a gradually typed program: typed, API, guard, Any, dyn, narrow, blame, and safe. Edges between them are boundary crossings. A highlighted edge means a value is crossing that boundary in the current step. Active nodes (bright) are the regions involved in the current policy decision; compare nodes (dimmed) show the alternative policy the step is contrasting against.',
        'The typed-untyped-boundary view traces a value from statically typed code through an API edge, then along two possible paths: through a guard (which checks the value at runtime before allowing typed use) or through Any (which skips the check and pushes risk downstream). When the guard path fails, the blame node lights up to show where the contract violation is reported.',
        'The narrowing-and-any view starts from the dyn node and follows the narrow path, showing how a runtime predicate like typeof x === \'string\' refines an unknown value into a statically known type within the guarded control-flow branch. Compare it with the Any path, where the checker has no runtime evidence and failures surface later.',
        {type: 'image', src: './assets/gifs/gradual-typing-boundaries-blame-guards.gif', alt: 'Animated walkthrough of the gradual typing boundaries blame guards visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Most production codebases are not fully typed or fully dynamic. A TypeScript service calls an untyped npm package. A Python module with type hints imports a legacy library that has none. A Java application deserializes JSON from an external API into objects whose fields the compiler has never verified. The boundary between typed and untyped code is everywhere, and it is where runtime type errors actually happen.',
        'Gradual typing is the formal framework for managing these mixed regions. The term comes from Siek and Taha (2006), who showed that a type system can include a special type (called Any or the dynamic type) that is compatible with every other type. This compatibility lets typed and untyped code coexist in one program without requiring a full rewrite of either side.',
        'The practical question at every boundary is evidence: what proof does the receiving code have that a value actually matches the type it claims? A type annotation is a claim. A runtime check is evidence. Gradual typing makes the distinction between claims and evidence explicit, and blame tracking identifies who is responsible when a claim turns out to be false.',
        {type: 'callout', text: 'A gradual type boundary is honest only when it records what was checked, what remains unknown, and who owns a failed contract.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The straightforward strategy for a mixed codebase is to add type annotations everywhere and let the checker enforce them. Annotate function parameters, return types, and data structures, then fix whatever the checker rejects. Once every file passes, the types are trustworthy.',
        'This works well for code that is self-contained. A sorting function whose inputs and outputs are all local can be annotated, checked, and trusted in one pass. The checker sees the full data flow, so the annotation is also the evidence.',
        'For external data, the same strategy feels natural: define an interface for the expected JSON shape, annotate the fetch call with that interface, and proceed as if the data is typed. TypeScript allows this with type assertions (response as UserProfile), and Python with cast(). The code compiles, the editor autocompletes field names, and the programmer moves on.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The strategy breaks at any boundary where the checker cannot see the actual data. A TypeScript interface for API JSON is a compile-time assertion, not a runtime check. If the server sends {name: \'Alice\', email: null} but the interface declares email: string, the checker approves user.email.toLowerCase() and the program crashes at runtime. The annotation lied, and the checker had no way to detect the lie because the data arrived after compilation.',
        'The scope of this problem is not small. Every JSON fetch, every database query result, every message from a queue, every plugin callback, every dynamically loaded module, and every deserialized object crosses a boundary where static analysis ends and runtime reality begins. In a typical web service, these boundaries outnumber internal function calls.',
        'Marking difficult values as Any is the common escape. It removes the type error by telling the checker to stop tracking the value. But Any is contagious: if a function returns Any, every caller receives an untracked value. A single Any at a popular adapter can silently disable type checking across hundreds of call sites. The codebase looks typed in the file count but is dynamically typed along the actual data paths that matter.',
        'The fundamental wall is that static annotations alone cannot create runtime evidence. A type system that pretends otherwise will produce programs that pass the checker and crash in production, which is worse than having no types at all because it creates false confidence.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Treat every typed/untyped boundary as an executable contract, not a passive annotation. When a value crosses from untyped to typed code, the boundary must either produce runtime evidence that the value matches the expected type, or explicitly mark the value as unchecked so downstream code knows the risk.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A typed boundary is an edge with policy: values can cross only with the amount of evidence the destination side requires. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg'},
        'The key distinction is between Any and unknown. Any means \'stop checking this value entirely\' -- the checker treats it as compatible with every type without proof. unknown means \'a value exists but its shape is unproven\' -- the checker forces the code to narrow or validate before using it. Any is an opt-out. unknown is a demand for evidence. Gradual typing becomes sound when boundaries use unknown and guards instead of Any and trust.',
        'Guards and narrowing are the mechanism. A guard is a runtime predicate (typeof x === \'string\', a schema validator, a parsing function) that produces evidence. Narrowing is the checker\'s ability to use that evidence: inside the branch where the guard succeeded, the type is refined from unknown to the proven shape. The runtime check and the static type now agree, and the agreement is backed by actual execution, not by an annotation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A gradual type system adds the dynamic type (usually called Any) to its type lattice. Any is consistent with every other type, meaning values can flow from Any to string or from number to Any without a type error. This consistency relation is weaker than subtyping: it allows flows that subtyping would reject, because it represents a deliberate decision to defer checking rather than a proven relationship.',
        'At a boundary, the system can insert a runtime contract. In Typed Racket, this happens automatically: when typed code calls an untyped function, the runtime wraps the return value in a contract that checks the declared type. If the check fails, the system raises a blame error naming the boundary and the violating side. In TypeScript, contracts are manual: the programmer writes a type guard function (function isUser(x: unknown): x is User) or uses a validation library like Zod, io-ts, or Ajv.',
        'Flow-sensitive narrowing extends the evidence inward. After a guard like if (typeof x === \'string\'), the checker knows x is a string inside the then-branch. After a discriminant check like if (msg.kind === \'error\'), the checker knows the full discriminated union variant. These facts are scoped by control flow: once execution reaches a path where the guard might not have run, the narrowed type reverts to the broader one.',
        'Blame assignment completes the contract model. Each boundary has two sides: the positive side (the code providing the value) and the negative side (the code consuming it). When a contract fails, blame goes to the side that violated its obligation. If the provider sent a malformed value, the provider is blamed. If the consumer declared an incorrect expectation, the consumer is blamed. Without blame, a contract failure is just a crash with no explanation of which side to fix.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on an invariant: every value used at type T in typed code was either (a) constructed under the checker\'s full control, (b) validated by a runtime contract that confirmed the T-shape, or (c) explicitly received through an Any path whose unchecked status is visible. If every boundary enforces this invariant, then runtime type errors inside typed code can only originate from Any paths, and those paths are marked and countable.',
        'Blame correctness follows from the contract structure. Wadler and Findler (2009) proved that in a system with properly assigned blame labels, a well-typed component is never blamed. If typed code sends a value of the declared type through a boundary, the typed side cannot be the source of a contract failure. Blame always lands on the side that violated the contract, which gives programmers a reliable signal for where to look.',
        'Narrowing preserves the invariant locally. A typeof guard produces a fact that holds on exactly the control-flow paths dominated by the guard. The checker does not guess or assume -- it tracks which branches have been tested and restricts the narrowed type to those branches. When branches merge at a join point, the checker takes the union of the possible types, which is always safe because it never claims more precision than the evidence supports.',
        'The overall system is sound in the checked region and honest about the unchecked region. Any is not a bug; it is a labeled escape hatch. The discipline is keeping the escape hatches at the edges and preventing them from spreading into core logic where type errors would be hardest to diagnose.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Runtime contracts have a direct cost. Checking that a JSON response matches a schema with 10 fields takes 10 field lookups and type comparisons. For a schema with nested objects, arrays, and union types, the cost scales with the size of the validated structure. A Zod schema validating a 50-field API response might take 2-5 microseconds -- negligible for a network call, but measurable if applied inside a hot loop processing millions of records.',
        'Typed Racket-style automatic contracts can add wrapper overhead on every boundary crossing. Wrapping a function in a higher-order contract means every call goes through a proxy that checks argument types on entry and return types on exit. If a small utility function is called from a typed module inside a tight loop, the contract overhead can dominate. The Typed Racket team measured slowdowns of 2-100x on micro-benchmarks, though most real programs see much less because hot paths tend to stay within one region.',
        'Static-only systems like TypeScript add zero runtime cost because annotations are erased during compilation. The tradeoff is that external data boundaries require the programmer to write and maintain guards manually. A project with 30 API endpoints, each returning a different schema, needs 30 validation functions. Libraries like Zod reduce the boilerplate by generating both the runtime validator and the static type from one schema definition, but they add a dependency and a learning curve.',
        'The migration cost is dominated by boundary count, not file count. A 500-file codebase with 5 clean API adapters can be migrated by typing the adapters first, then spreading types inward at leisure. A 50-file codebase with untyped values flowing through every module requires touching every file to contain the Any paths. The metric that matters is how many unchecked boundaries exist and how far their untyped values travel.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TypeScript is the largest-scale gradual type system in production. Every JavaScript project that adopts TypeScript enters a gradual phase where .js and .ts files coexist. The tsconfig strictness flags (strict, noImplicitAny, strictNullChecks) control how aggressively the checker enforces boundaries. Teams typically start with loose settings, fix the easy errors, then tighten incrementally. Google, Microsoft, Airbnb, and Stripe have all documented multi-year TypeScript migrations following this pattern.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Typescript.svg/250px-Typescript.svg.png', alt: 'TypeScript logo', caption: 'TypeScript represents the static-analysis side of gradual typing: it tracks evidence at compile time but needs explicit guards for runtime data. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Typescript.svg'},
        'Python\'s type hint system (PEP 484, mypy, pyright) is another major gradual system. Hints are optional, ignored at runtime by default, and checked by external tools. Libraries like Pydantic bridge the gap by generating runtime validators from type annotations, making the boundary between untyped input and typed internal data explicit. FastAPI relies on this pattern: route parameters are validated at the API boundary by Pydantic, and the handler receives typed objects.',
        'Gradual typing also appears in plugin architectures, where a host application defines typed interfaces but plugins are contributed by third parties without type guarantees. VS Code\'s extension API, Webpack\'s loader interface, and Babel\'s plugin system all face this: the host must validate plugin outputs at the boundary or accept the risk of untyped values propagating into core logic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Gradual typing fails when annotations are mistaken for validation. A TypeScript interface describing an API response does not check the response. If the server changes its schema, the interface still compiles, the code still runs, and the crash happens deep inside business logic where the wrong field shape is finally used. The programmer trusted the annotation as if it were a guard, and the checker had no way to warn them because the data arrived at runtime.',
        'It fails socially when Any becomes normalized in core code. During a migration, Any is a pragmatic tool for unblocking progress at the edges. But if Any appears in shared types, function signatures, or module exports, it spreads to every consumer. A codebase can reach 90% annotated files while the actual data paths that carry business logic are dynamically typed. The coverage metric gives false confidence.',
        'It fails architecturally when boundaries are drawn in the wrong places. Validating inside a deep utility function means the same data gets checked repeatedly. Validating nowhere means untyped data reaches core logic. The correct placement is at IO edges: API handlers, database query results, message consumers, plugin entry points, and deserialization sites. If the architecture does not have clean IO edges, gradual typing cannot be applied cleanly.',
        'It fails at scale when contract overhead is not budgeted. A Typed Racket program that wraps every cross-module call in a contract can slow down by orders of magnitude on fine-grained module boundaries. TypeScript avoids this by erasing types, but that means it also cannot catch runtime violations automatically. Neither extreme is free; the system designer must choose where to spend the checking budget.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A TypeScript service fetches user profiles from an external API. The naive implementation declares an interface and casts the response:',
        'interface UserProfile { name: string; email: string; age: number } -- const user = (await fetch(url).then(r => r.json())) as UserProfile. The checker now treats user.email as string. If the API returns {name: \'Alice\', email: null, age: 30}, the call user.email.toLowerCase() throws TypeError: Cannot read properties of null. The crash is on line 47 of the business logic, but the bug is on the line where the cast happened, possibly in a different file.',
        {type: 'image', src: 'https://www.json.org/img/json160.gif', alt: 'JSON logo', caption: 'JSON inputs are the everyday boundary case: a parser can confirm syntax, but the application still needs shape evidence. Source: JSON.org, https://www.json.org/json-en.html'},
        'The guarded version receives the response as unknown and validates it: const raw: unknown = await fetch(url).then(r => r.json()). A guard function checks each field: if typeof raw === \'object\' && raw !== null && typeof raw.name === \'string\' && typeof raw.email === \'string\' && typeof raw.age === \'number\', the value enters typed code as a proven UserProfile. If any field is missing or wrong-typed, the guard fails at the boundary with a blame message naming the API endpoint, the expected shape, and the actual value.',
        'With a validation library like Zod, the same logic is more compact: const UserProfile = z.object({ name: z.string(), email: z.string(), age: z.number() }). Calling UserProfile.parse(raw) either returns a typed value or throws a ZodError listing every field that failed validation. The static type is inferred from the schema, so the annotation and the guard are the same object -- no drift between what the checker believes and what the runtime checks.',
        'The cost difference is concrete. The cast version takes 0 microseconds of validation time and crashes unpredictably when the API changes. The Zod version takes roughly 3 microseconds per parse for a 3-field object and fails immediately at the boundary with a structured error. For a service handling 1,000 requests per second, the total validation overhead is about 3 milliseconds per second -- invisible against network latency, but it prevents every downstream type error caused by malformed API data.',
        'Blame tracking completes the picture. When the Zod parse fails, the error message says: expected string at path email, received null. The developer knows the API returned null for email, the boundary is the fetch adapter, and the fix is either to make email optional in the schema or to contact the API provider. Without blame, the same bug surfaces as a null dereference three function calls deep, and the developer must trace backward through the call stack to find the boundary that let the bad value through.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is Siek and Taha, "Gradual Typing for Functional Languages" (2006), available at https://scheme2006.cs.uchicago.edu/13-siek.pdf. It introduces the consistency relation and proves that gradual typing is a smooth continuum between static and dynamic typing. Wadler and Findler, "Well-Typed Programs Can\'t Be Blamed" (2009), formalizes blame tracking and proves that well-typed components are never blamed for contract failures.',
        'For TypeScript specifically, the narrowing documentation at https://www.typescriptlang.org/docs/handbook/2/narrowing.html covers control-flow analysis, type guards, and discriminated unions. The TypeScript handbook section on any at https://www.typescriptlang.org/docs/handbook/basic-types.html explains the opt-out semantics. For Python, the typing spec at https://typing.python.org/en/latest/spec/concepts.html and the mypy documentation on dynamic typing at https://mypy.readthedocs.io/en/stable/dynamic_typing.html cover the gradual typing model used by mypy and pyright.',
        'Typed Racket at https://docs.racket-lang.org/ts-guide/ is the reference implementation of contract-based gradual typing with automatic blame. Studying its contract system shows what full runtime enforcement looks like, including the performance costs and the blame error messages.',
        'Related topics on this site: Bidirectional Type Checking for how checkers propagate type information through expressions, Data-Flow Worklist Analysis for how flow-sensitive facts propagate through control-flow graphs, Taint Analysis for tracking untrusted values from sources to sinks (the security analog of boundary tracking), and JavaScript Lexical Environments and Closures for the runtime scope mechanics that narrowing depends on.',
      ],
    },
  ],
};
