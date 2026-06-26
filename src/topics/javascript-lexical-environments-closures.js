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
  const envCount = 4;  // global, outer, block, inner environments
  const bindingTypes = 4;  // var, let, const, function

  yield {
    state: scopeGraph('Lexical environments form an outer-link chain'),
    highlight: { active: ['inner', 'outer', 'global', 'e-inner-outer', 'e-outer-global'], found: ['fn'] },
    explanation: `A lexical environment is an environment record plus a reference to an outer environment. Across ${envCount} nested environments, identifier lookup starts local and follows outer links until the name is found or the chain ends.`,
    invariant: `Scope lookup is lexical across all ${envCount} environments: the chain comes from where code is written, not where it is called.`,
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
    explanation: `Each of the ${envCount} environment records is a binding table for one scope. It is not the same as an object you can freely inspect; the spec defines it as internal execution state.`,
  };

  yield {
    state: scopeGraph('A closure stores the environment where it was created'),
    highlight: { active: ['fn', 'outer', 'e-fn-outer'], compare: ['global', 'inner'] },
    explanation: `When a function is created, it carries a reference to its surrounding lexical environment. Later calls use that saved chain of ${envCount} environments even if the caller is somewhere else.`,
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
    explanation: `Temporal dead zone behavior is easier to understand as binding state across ${bindingTypes} declaration kinds. The name exists in the environment, but let and const cannot be read before initialization.`,
  };
}

function* closureLifetime() {
  const gcRoots = 2;  // timer and listener
  const captureStrategies = 2;  // narrow vs wide

  yield {
    state: lifetimeGraph('A returned function can keep an environment alive'),
    highlight: { active: ['call', 'env', 'closure', 'e-call-env', 'e-env-closure'], found: ['gc'] },
    explanation: `A function call frame can return, but a captured environment can stay alive if a closure still points to it via ${gcRoots} possible GC roots. That is why closures can remember private state after the outer function finishes.`,
    invariant: `Captured environments live while reachable closures live, anchored through ${gcRoots} root types (timer and listener).`,
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
    explanation: `The classic loop-closure bug is not mystical. With var, callbacks share one function-scoped binding. With let, each iteration gets a fresh binding, so each of the ${captureStrategies} capture strategies (shared vs per-iteration) determines what each closure sees.`,
  };

  yield {
    state: lifetimeGraph('Timers and listeners can accidentally retain state'),
    highlight: { active: ['closure', 'timer', 'listener', 'gc', 'e-closure-timer', 'e-closure-listener', 'e-timer-gc', 'e-listener-gc'], compare: ['call'] },
    explanation: `Either of the ${gcRoots} GC roots (a timer callback or DOM listener) can keep a closure reachable. If that closure captures a large object graph, the garbage collector must keep that graph too.`,
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
    explanation: `Closures are powerful because they keep the right state alive. Comparing ${captureStrategies} capture strategies (narrow vs wide), they become leaks when the captured state is broader than the callback actually needs or when the callback is never unregistered.`,
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
    {heading: 'How to read the animation', paragraphs: ['The animation treats scope as linked environment records. Active nodes are lookup steps, found nodes contain the winning binding, and outer links show where lookup goes next.', {type: 'image', src: './assets/gifs/javascript-lexical-environments-closures.gif', alt: 'Animated walkthrough of the javascript lexical environments closures visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'}]},
    {heading: 'Why this exists', paragraphs: ['JavaScript needs a precise answer whenever code reads a name such as count or user. Lexical environments are the specification model for mapping names to binding cells.', { type: 'callout', text: 'A closure is a function plus a saved lexical environment reference, so name lookup follows the creation site even when execution happens later.' }, { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/JavaScript-logo.png', alt: 'Unofficial JavaScript logo', caption: 'JavaScript makes lexical closure behavior visible in everyday callbacks and modules. Source: https://commons.wikimedia.org/wiki/File:JavaScript-logo.png.' }]},
    {heading: 'The obvious approach', paragraphs: ['The obvious model is that variables live in braces and closures copy the values they use. That model works briefly, then fails when callbacks run later or several functions share one mutable binding.']},
    {heading: 'The wall', paragraphs: ['The wall is time and lifetime. A function can run after its creator returned, and var, let, const, hoisting, and the temporal dead zone all need binding rules more precise than braces.']},
    {heading: 'The core insight', paragraphs: ['A function is created with an internal reference to the lexical environment current at creation time. Identifier lookup follows that saved chain, not the location where the function is later called.']},
    {heading: 'How it works', paragraphs: ['Scripts, modules, functions, and blocks create environment records for their declarations. Function creation stores a reference to the current environment, and escaping functions keep needed records reachable.', { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Call_stack_layout.svg', alt: 'Call stack layout showing stack frames and frame pointer', caption: 'The call stack explains active execution frames; closures explain why some environment records outlive those frames. Source: https://commons.wikimedia.org/wiki/File:Call_stack_layout.svg.' }]},
    {heading: 'Why it works', paragraphs: ['The correctness rule is nearest visible binding wins. If a block has a let binding named x, lookup stops there even if that binding is still in the temporal dead zone.']},
    {heading: 'Cost and complexity', paragraphs: ['Captured variables may need heap-reachable storage instead of short-lived stack slots. The practical cost is accidental retention: a long-lived callback can keep a large object graph alive.']},
    {heading: 'Real-world uses', paragraphs: ['Closures power callbacks, event listeners, promises, modules, memoization, private state, factories, and React hooks. They let behavior travel with the state it needs without making that state global.']},
    {heading: 'Where it fails', paragraphs: ['It fails when programmers assume closures snapshot values. Several callbacks closing over the same mutable binding will observe later writes to that same cell.']},
    {heading: 'Worked example', paragraphs: ['makeCounter creates let count = 0 and returns a function that increments count. The returned function keeps the count environment alive, so calls produce 1, then 2, then 3.', 'A var loop with three timeout callbacks shares one i binding and often prints 3, 3, 3. A let loop creates a fresh per-iteration binding, so the callbacks print 0, 1, 2.']},
    {heading: 'Sources and study next', paragraphs: ['Read the ECMAScript sections on execution contexts, lexical environments, and environment records, plus MDN Closures and MDN let. Then study Stack, Linked List, Event Loop, Garbage Collection, JavaScript Proxy, and Inline Cache topics.']},
  ],
};
