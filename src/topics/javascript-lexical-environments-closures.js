// JavaScript lexical environments: identifier bindings live in environment
// records, linked by outer references, and closures keep those records alive.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'javascript-lexical-environments-closures',
  title: 'JavaScript Lexical Environments & Closures',
  category: 'Data Structures',
  summary: 'A runtime data-structure view of scope: environment records, outer links, identifier lookup, TDZ, closure capture, and GC lifetime.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['scope chain lookup', 'closure lifetime'], defaultValue: 'scope chain lookup' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function scopeGraph(title) {
  return graphState({
    nodes: [
      { id: 'global', label: 'global', x: 1.0, y: 3.8, note: 'outer null' },
      { id: 'outer', label: 'outer', x: 3.1, y: 3.8, note: 'count' },
      { id: 'block', label: 'block', x: 5.2, y: 5.3, note: 'let tmp' },
      { id: 'inner', label: 'inner', x: 5.2, y: 2.3, note: 'local' },
      { id: 'fn', label: 'fn', x: 7.2, y: 3.8, note: '[[Env]]' },
      { id: 'lookup', label: 'lookup', x: 9.0, y: 3.8, note: 'name' },
    ],
    edges: [
      { id: 'e-outer-global', from: 'outer', to: 'global' },
      { id: 'e-block-outer', from: 'block', to: 'outer' },
      { id: 'e-inner-outer', from: 'inner', to: 'outer' },
      { id: 'e-fn-outer', from: 'fn', to: 'outer' },
      { id: 'e-lookup-inner', from: 'lookup', to: 'inner' },
      { id: 'e-lookup-block', from: 'lookup', to: 'block' },
    ],
  }, { title });
}

function lifetimeGraph(title) {
  return graphState({
    nodes: [
      { id: 'call', label: 'call frame', x: 0.8, y: 3.8, note: 'returns' },
      { id: 'env', label: 'env record', x: 2.8, y: 3.8, note: 'captured' },
      { id: 'closure', label: 'closure', x: 4.8, y: 3.8, note: 'function' },
      { id: 'timer', label: 'timer queue', x: 6.8, y: 2.4, note: 'later' },
      { id: 'listener', label: 'listener', x: 6.8, y: 5.2, note: 'DOM' },
      { id: 'gc', label: 'GC roots', x: 8.7, y: 3.8, note: 'reachable' },
    ],
    edges: [
      { id: 'e-call-env', from: 'call', to: 'env' },
      { id: 'e-env-closure', from: 'env', to: 'closure' },
      { id: 'e-closure-timer', from: 'closure', to: 'timer' },
      { id: 'e-closure-listener', from: 'closure', to: 'listener' },
      { id: 'e-timer-gc', from: 'timer', to: 'gc' },
      { id: 'e-listener-gc', from: 'listener', to: 'gc' },
    ],
  }, { title });
}

function* scopeChainLookup() {
  yield {
    state: scopeGraph('Lexical environments form an outer-link chain'),
    highlight: { active: ['inner', 'outer', 'global', 'e-inner-outer', 'e-outer-global'], found: ['fn'] },
    explanation: 'A lexical environment is an environment record plus a reference to an outer environment. Identifier lookup starts local and follows outer links until the name is found or the chain ends.',
    invariant: 'Scope lookup is lexical: the chain comes from where code is written, not where it is called.',
  };

  yield {
    state: labelMatrix(
      'Environment record contents',
      [
        { id: 'global', label: 'global' },
        { id: 'outer', label: 'outer fn' },
        { id: 'block', label: 'block' },
        { id: 'inner', label: 'inner fn' },
      ],
      [
        { id: 'bindings', label: 'bindings' },
        { id: 'outer', label: 'outer ref' },
      ],
      [
        ['app, config', 'null'],
        ['count, inc', 'global'],
        ['tmp', 'outer'],
        ['local', 'outer'],
      ],
    ),
    highlight: { active: ['inner:outer', 'outer:outer', 'global:bindings'], found: ['outer:bindings'] },
    explanation: 'The environment record is the binding table for one scope. It is not the same as an object you can freely inspect; the spec defines it as internal execution state.',
  };

  yield {
    state: scopeGraph('A closure stores the environment where it was created'),
    highlight: { active: ['fn', 'outer', 'e-fn-outer'], compare: ['global', 'inner'] },
    explanation: 'When a function is created, it carries a reference to its surrounding lexical environment. Later calls use that saved environment chain even if the caller is somewhere else.',
  };

  yield {
    state: labelMatrix(
      'TDZ and hoisting are binding states',
      [
        { id: 'var', label: 'var' },
        { id: 'let', label: 'let' },
        { id: 'const', label: 'const' },
        { id: 'func', label: 'function' },
      ],
      [
        { id: 'scope', label: 'scope' },
        { id: 'before', label: 'before init' },
      ],
      [
        ['function', 'undefined'],
        ['block', 'TDZ error'],
        ['block', 'TDZ error'],
        ['scope', 'callable'],
      ],
    ),
    highlight: { active: ['let:before', 'const:before'], compare: ['var:before', 'func:before'] },
    explanation: 'Temporal dead zone behavior is easier to understand as binding state. The name exists in the environment, but let and const cannot be read before initialization.',
  };
}

function* closureLifetime() {
  yield {
    state: lifetimeGraph('A returned function can keep an environment alive'),
    highlight: { active: ['call', 'env', 'closure', 'e-call-env', 'e-env-closure'], found: ['gc'] },
    explanation: 'A function call frame can return, but a captured environment can stay alive if a closure still points to it. That is why closures can remember private state after the outer function finishes.',
    invariant: 'Captured environments live while reachable closures live.',
  };

  yield {
    state: labelMatrix(
      'for-loop capture shape',
      [
        { id: 'var', label: 'var i' },
        { id: 'let', label: 'let i' },
        { id: 'callback', label: 'callback' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'binding', label: 'binding' },
        { id: 'result', label: 'result' },
      ],
      [
        ['one shared cell', 'all see final'],
        ['per iteration', 'each sees own'],
        ['closes over cell', 'reads later'],
        ['new binding', 'stable value'],
      ],
    ),
    highlight: { active: ['var:binding', 'let:binding'], found: ['fix:result'] },
    explanation: 'The classic loop-closure bug is not mystical. With var, callbacks share one function-scoped binding. With let, each iteration gets a fresh binding, so each closure sees its own value.',
  };

  yield {
    state: lifetimeGraph('Timers and listeners can accidentally retain state'),
    highlight: { active: ['closure', 'timer', 'listener', 'gc', 'e-closure-timer', 'e-closure-listener', 'e-timer-gc', 'e-listener-gc'], compare: ['call'] },
    explanation: 'A timer callback or DOM listener can keep a closure reachable. If that closure captures a large object graph, the garbage collector must keep that graph too.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'captured objects', min: 0, max: 1000 }, y: { label: 'retained memory', min: 0, max: 100 } },
      series: [
        { id: 'narrow', label: 'capture needed values', points: [
          { x: 0, y: 0 }, { x: 100, y: 8 }, { x: 300, y: 16 }, { x: 600, y: 28 }, { x: 1000, y: 40 },
        ] },
        { id: 'wide', label: 'capture large graph', points: [
          { x: 0, y: 0 }, { x: 100, y: 22 }, { x: 300, y: 48 }, { x: 600, y: 78 }, { x: 1000, y: 96 },
        ] },
      ],
      markers: [
        { id: 'listener', x: 600, y: 78, label: 'listener' },
        { id: 'drop', x: 300, y: 16, label: 'drop refs' },
      ],
    }),
    highlight: { active: ['narrow', 'drop'], compare: ['wide', 'listener'] },
    explanation: 'Closures are powerful because they keep the right state alive. They become leaks when the captured state is broader than the callback actually needs or when the callback is never unregistered.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'scope chain lookup') yield* scopeChainLookup();
  else if (view === 'closure lifetime') yield* closureLifetime();
  else throw new InputError('Pick a lexical-environment view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript programs constantly ask the runtime one basic question: when code says `name`, which binding should that name mean? Lexical environments are the data structure behind that answer. They connect identifiers to storage cells and connect each scope to the scope outside it.',
        'Closures matter because functions often outlive the call that created them. Event handlers, timers, promises, factories, modules, and React callbacks all depend on a function remembering the environment where it was created. This topic treats scope as a linked structure and closures as references into that structure, not as a vague language feature.',
      ],
    },
    {
      heading: 'The naive model and its wall',
      paragraphs: [
        'A beginner model says variables live in the nearest pair of braces and a closure copies whatever value it needs. That model works for a few examples, but it breaks on `var`, hoisting, the temporal dead zone, loop callbacks, nested functions, and memory retention.',
        'The wall appears when time enters the program. A callback runs later, after the outer function returned. A `let` binding exists before it can be read. A `var` loop callback sees the final loop value because every callback shares the same function-scoped cell. The correct model has to describe binding creation, binding lookup, and binding lifetime separately.',
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        'The invariant is simple: identifier lookup starts in the current environment record and follows outer links fixed by lexical nesting. The caller does not choose the outer chain. The source location where the function was created chooses it.',
        'A closure stores a reference to the environment chain it needs. It does not copy every value by default. It preserves access to bindings, so later reads observe the current contents of those bindings unless a fresh binding was created for that execution or iteration.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the scope-chain view, treat each graph node as one lexical environment. The edges are outer references. The lookup node is asking for a name; the highlighted path shows the chain the engine must search before it can resolve that name. The matrix then makes the hidden binding table explicit: which names exist in each environment and which outer record is next.',
        'In the closure-lifetime view, separate the call frame from the environment record. The frame can return while a captured environment remains reachable through a function object, timer queue, or listener. In the final plot, compare narrow capture with broad capture: the point is not that closures are bad, but that captured reachability controls retained memory.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'When execution enters a script, module, function, or block, the runtime creates environment records for the declarations that belong there. A function environment can hold parameters, `var` declarations, and function declarations. A block environment can hold `let`, `const`, and class declarations. Each record also knows its outer environment.',
        'When a function object is created, it receives an internal reference to the current lexical environment. The specification describes this through lexical environments and environment records: https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html. Engines can optimize the representation, but they must preserve the same observable lookup, TDZ, and closure behavior.',
        'Hoisting is binding creation, not always usable initialization. `var` creates a function-scoped binding initialized to `undefined`; function declarations are callable according to their declaration-instantiation rules; `let` and `const` create block-scoped bindings that cannot be read until initialized.',
      ],
    },
    {
      heading: 'Correctness rules',
      paragraphs: [
        'A read is correct only if it finds the nearest visible binding in the lexical chain and respects the binding state. If the nearest binding is a `let` or `const` binding still in the temporal dead zone, the result is a `ReferenceError`; the engine does not skip it to use an outer binding with the same name.',
        'A closure is correct only if it keeps the environment needed by the function reachable. That is why a returned counter can keep its private `count` cell alive, and why removing a DOM listener can release a captured object graph once no other root points to it.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The semantic model is uniform, but the implementation is optimized. Locals that never escape can often stay in stack slots, registers, or optimized frames. Variables captured by escaping closures need storage the closure can reach later, commonly an engine-specific context object.',
        'The tradeoff is expressiveness versus lifetime. Closures let code package behavior with private state, but they can retain more memory than intended when a callback captures a large object or when a long-lived listener is never unregistered. Narrow captured values, clear timers, remove listeners, and avoid closing over broad request or component objects when only one field is needed.',
      ],
    },
    {
      heading: 'Debugging method',
      paragraphs: [
        'When closure behavior is surprising, ask three questions in order. Where was the function created? Which binding record contains the name being read? Is that binding a fresh cell for this call or iteration, or a shared cell that later writes can change?',
        'For memory issues, ask a reachability question instead of a syntax question. What root keeps the callback alive: a timer, event listener, promise chain, cache, module singleton, or DOM node? Then inspect what the callback captured. The leak is often not the closure itself, but an unnecessarily large object graph reachable through it.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose `makeCounter` declares `let count = 0` and returns `() => ++count`. Calling `makeCounter` creates a function environment with a `count` binding. Returning the inner function lets the call frame finish, but the returned function still points to the environment that contains `count`. Each call follows that saved environment reference and increments the same cell.',
        'Now compare `for (var i = 0; i < 3; i++) setTimeout(() => console.log(i))` with the same loop using `let i`. The `var` version has one shared function-scoped binding, so the callbacks read the final value. The `let` loop creates a fresh per-iteration binding, so each callback reads the value from its own iteration.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'This model wins whenever JavaScript code crosses time or ownership boundaries: callbacks, memoized functions, event listeners, module state, factory functions, private state, async handlers, and UI component closures. It turns confusing behavior into ordinary graph reachability and name lookup.',
        'It fails as a performance prediction if treated too literally. The specification explains behavior, not storage layout. V8, SpiderMonkey, and JavaScriptCore are free to inline, allocate, elide, and rewrite internal structures as long as the program observes the same scope and closure semantics.',
      ],
    },
    {
      heading: 'Limits and failure modes',
      paragraphs: [
        'The biggest pitfall is accidental reachability. A closure that captures a whole request object, DOM subtree, cache, or component instance can keep that graph alive as long as the callback is registered. The fix is boring and effective: capture only the fields needed, clear timers, remove listeners, and drop references when ownership ends.',
        'The second pitfall is assuming closures snapshot values. They usually preserve access to bindings. If several callbacks close over the same mutable binding, they will observe later writes to that cell. Use `let` per iteration, pass values as parameters, or create a small factory when each callback needs its own stable binding.',
        'The third pitfall is confusing lexical scope with dynamic call order. Calling a function from a different object or module does not change its saved outer environment. `this` has its own binding rules, but ordinary identifier lookup follows the lexical chain created where the function was written.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: ECMAScript execution contexts and environment records at https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html, MDN Closures at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures, MDN let and TDZ at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let, JavaScript.info closures at https://javascript.info/closure, and V8 closure internals at https://mrale.ph/blog/2012/09/23/grokking-v8-closures-for-fun.html.',
        'Then study Stack for call frames, Linked List for outer-chain intuition, The Event Loop for callbacks that run later, V8 Ignition Bytecode Pipeline Case Study for engine execution, V8 Generational Garbage Collection for retained reachability, WeakRef & FinalizationRegistry for lifetime edges, JavaScript Proxy Trap & Inline Cache for runtime lookup optimization, and Web Workers for closures crossing concurrency boundaries.',
      ],
    },
  ],
};
