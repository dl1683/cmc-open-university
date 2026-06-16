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
      heading: 'What it is',
      paragraphs: [
        'A JavaScript lexical environment is the runtime structure that connects names to values. The ECMAScript specification describes Environment Records as the mechanism for associating identifiers with variables and functions according to lexical nesting: https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html. A lexical environment combines that record with an outer environment reference.',
        'A closure is a function bundled with references to its surrounding state. MDN phrases this as a function enclosed with references to its lexical environment: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures. This topic treats that definition as a data-structure story: binding tables linked by outer pointers, plus function objects that retain those pointers.',
      ],
    },
    {
      heading: 'How lookup works',
      paragraphs: [
        'When code reads a name, the engine starts in the current environment record. If the name is not present, it follows the outer reference and tries again. That continues until the binding is found or the chain ends. This is why lexical scope is determined by where code is written, not by which function happened to call it.',
        'The environment record can be thought of as a binding table, but it is not just a normal JavaScript object. Spec environment records are internal mechanisms. Implementations are free to store optimized locals on stack frames, in registers, in context objects, or in other engine-specific layouts as long as observable behavior matches the spec.',
      ],
    },
    {
      heading: 'Closures and lifetime',
      paragraphs: [
        'When a function is created, it records the lexical environment in which it was created. If that function escapes, for example by being returned, stored in an object, used as a timer callback, or registered as an event listener, the captured environment may outlive the call frame that created it. That is how private counters, factories, and module patterns work.',
        'This is also a memory-management lesson. The Modern JavaScript Tutorial notes that a lexical environment dies when it becomes unreachable: https://javascript.info/closure. V8 garbage collection follows reachability too. If a closure remains reachable, everything it captures remains live, even if the original function call returned long ago.',
      ],
    },
    {
      heading: 'TDZ and binding states',
      paragraphs: [
        'Hoisting is easier to teach as binding creation plus initialization state. var creates a function-scoped binding initialized to undefined. let and const create block-scoped bindings, but they cannot be read before initialization. MDN calls this interval the temporal dead zone for let, const, and class declarations: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let.',
        'The famous loop callback bug follows the same model. var in a loop shares one function-scoped binding, so delayed callbacks often read the final value. let creates a fresh per-iteration binding, so each callback sees the value from its iteration.',
      ],
    },
    {
      heading: 'V8 implementation notes',
      paragraphs: [
        'Engine internals are more concrete than the spec but less stable. A V8-focused explanation by Vyacheslav Egorov describes V8 closures as JSFunction objects with an attached Context object for captured variables: https://mrale.ph/blog/2012/09/23/grokking-v8-closures-for-fun.html. Treat that as an implementation lens, not a portable guarantee.',
        'The important engineering point is optimization. Locals that do not escape can often stay cheap. Captured variables need a representation that closures can reach later. That representation can extend lifetime and influence garbage collection, especially for callbacks, listeners, and long-lived caches.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Closures are not copies of values by default. They close over bindings, so later reads see the current binding value unless a fresh binding was created. Also, closures do not leak by themselves. They retain memory only when reachable closures capture state that is no longer semantically needed. Removing listeners, clearing timers, and narrowing captured data are memory-management tools.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ECMAScript execution contexts and environment records at https://tc39.es/ecma262/multipage/executable-code-and-execution-contexts.html, MDN Closures at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures, MDN let and TDZ at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let, JavaScript.info closures at https://javascript.info/closure, and V8 closure internals at https://mrale.ph/blog/2012/09/23/grokking-v8-closures-for-fun.html. Study Stack, Hash Table, Linked List, Recursion, The Event Loop, V8 Ignition Bytecode Pipeline Case Study, V8 Generational Garbage Collection, WeakRef & FinalizationRegistry, JavaScript Proxy Trap & Inline Cache, Gradual Typing Boundaries & Blame Guards, and Web Workers next.',
      ],
    },
  ],
};
