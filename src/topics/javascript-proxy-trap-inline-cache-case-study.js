// JavaScript Proxy as an object-operation interposer: target, handler, traps,
// Reflect forwarding, invariants, hidden classes, and inline-cache fallout.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'javascript-proxy-trap-inline-cache-case-study',
  title: 'JavaScript Proxy Trap & Inline Cache',
  category: 'Data Structures',
  summary: 'How Proxy intercepts object operations with handler traps, Reflect forwarding, invariants, membranes, and performance costs around hidden classes and inline caches.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['trap path', 'engine cost'], defaultValue: 'trap path' },
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

function proxyGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'site', label: 'site', x: 0.8, y: 4.7, note: notes.site ?? 'obj.x' },
      { id: 'proxy', label: 'proxy', x: 2.6, y: 4.7, note: notes.proxy ?? 'wrapper' },
      { id: 'handler', label: 'handler', x: 4.5, y: 5.8, note: notes.handler ?? 'traps' },
      { id: 'trap', label: 'trap', x: 6.3, y: 5.8, note: notes.trap ?? 'get' },
      { id: 'reflect', label: 'Reflect', x: 6.3, y: 3.5, note: notes.reflect ?? 'forward' },
      { id: 'target', label: 'target', x: 8.2, y: 4.7, note: notes.target ?? 'real obj' },
      { id: 'shape', label: 'shape', x: 9.6, y: 5.8, note: notes.shape ?? 'hidden cls' },
      { id: 'ic', label: 'IC', x: 9.6, y: 3.5, note: notes.ic ?? 'cache' },
    ],
    edges: [
      { id: 'e-site-proxy', from: 'site', to: 'proxy', weight: '' },
      { id: 'e-proxy-handler', from: 'proxy', to: 'handler', weight: '' },
      { id: 'e-handler-trap', from: 'handler', to: 'trap', weight: '' },
      { id: 'e-trap-reflect', from: 'trap', to: 'reflect', weight: '' },
      { id: 'e-reflect-target', from: 'reflect', to: 'target', weight: '' },
      { id: 'e-target-shape', from: 'target', to: 'shape', weight: '' },
      { id: 'e-target-ic', from: 'target', to: 'ic', weight: '' },
    ],
  }, { title });
}

function* trapPath() {
  yield {
    state: proxyGraph('A proxy stands in front of a target object'),
    highlight: { active: ['site', 'proxy', 'handler', 'e-site-proxy', 'e-proxy-handler'], found: ['target'] },
    explanation: 'A Proxy is a wrapper around a target object plus a handler object. Operations on the proxy are routed through handler traps before the target behavior is used or replaced.',
    invariant: 'The call site talks to the proxy, not directly to the target.',
  };

  yield {
    state: proxyGraph('The get trap intercepts property access', { site: 'user.name', trap: 'get(name)', handler: 'custom' }),
    highlight: { active: ['site', 'proxy', 'handler', 'trap', 'e-site-proxy', 'e-proxy-handler', 'e-handler-trap'], compare: ['target'] },
    explanation: 'For property reads, handler.get can log, validate, virtualize, or synthesize values. Other traps cover set, has, apply, construct, defineProperty, ownKeys, and more.',
  };

  yield {
    state: proxyGraph('Reflect forwards the operation with normal semantics', { reflect: 'Reflect.get', target: 'read slot' }),
    highlight: { found: ['reflect', 'target'], active: ['trap', 'e-trap-reflect', 'e-reflect-target'] },
    explanation: 'Reflect methods mirror object internal operations. A trap can do policy work, then call Reflect.get or Reflect.set to preserve ordinary behavior.',
  };

  yield {
    state: labelMatrix(
      'Proxy patterns',
      [
        { id: 'log', label: 'logging' },
        { id: 'guard', label: 'guard' },
        { id: 'memo', label: 'memo' },
        { id: 'membrane', label: 'membrane' },
      ],
      [
        { id: 'uses', label: 'uses' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['observe', 'overhead'],
        ['validate', 'throwing'],
        ['lazy read', 'stale'],
        ['deep cap', 'complex'],
      ],
    ),
    highlight: { found: ['guard:uses', 'membrane:uses'], compare: ['memo:risk'] },
    explanation: 'Proxies are strongest for boundaries: validation, capability membranes, logging, lazy objects, and compatibility layers. They are costly as a default object model.',
  };

  yield {
    state: proxyGraph('Invariants are still checked against the target', { trap: 'lie?', target: 'non-config', proxy: 'virtual' }),
    highlight: { active: ['trap', 'target', 'e-reflect-target'], removed: ['ic'] },
    explanation: 'A proxy cannot violate required object invariants. For example, a trap cannot pretend a non-configurable property disappeared. Engines throw when handler behavior breaks those rules.',
  };
}

function* engineCost() {
  yield {
    state: proxyGraph('Ordinary property loads can use shape and inline-cache data', { site: 'hot load', shape: 'offset x', ic: 'mono' }),
    highlight: { found: ['site', 'target', 'shape', 'ic', 'e-target-shape', 'e-target-ic'], compare: ['proxy'] },
    explanation: 'Engines optimize ordinary property access with object shapes or hidden classes and inline caches. A stable load site can become a direct offset lookup.',
    invariant: 'Fast property access depends on predictable structure.',
  };

  yield {
    state: proxyGraph('A proxy makes the operation user-code observable', { proxy: 'unknown', handler: 'maybe any', trap: 'user code', ic: 'bail?' }),
    highlight: { active: ['proxy', 'handler', 'trap', 'e-proxy-handler', 'e-handler-trap'], compare: ['shape', 'ic'] },
    explanation: 'A proxy trap can run arbitrary code and return arbitrary results. That makes many fast-path assumptions weaker, especially inside hot loops.',
  };

  yield {
    state: labelMatrix(
      'IC states',
      [
        { id: 'mono', label: 'mono' },
        { id: 'poly', label: 'poly' },
        { id: 'mega', label: 'mega' },
        { id: 'proxy', label: 'proxy' },
      ],
      [
        { id: 'site', label: 'site' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['one shape', 'low'],
        ['few shapes', 'ok'],
        ['many', 'high'],
        ['trap', 'high'],
      ],
    ),
    highlight: { found: ['mono:cost', 'poly:cost'], compare: ['mega:cost', 'proxy:cost'] },
    explanation: 'This is not a spec guarantee, but it is a useful runtime model: stable shapes make inline caches cheap, while proxies and megamorphic sites force more generic paths.',
  };

  yield {
    state: proxyGraph('Membranes trade speed for authority control', { handler: 'policy', trap: 'wrap all', target: 'object graph', proxy: 'membrane' }),
    highlight: { found: ['proxy', 'handler', 'trap', 'target'], active: ['e-site-proxy', 'e-handler-trap'] },
    explanation: 'A membrane deliberately proxies an object graph to attenuate or revoke authority. That is a valid trade at trust boundaries, even if it is the wrong choice for inner-loop data.',
  };

  yield {
    state: labelMatrix(
      'Use guide',
      [
        { id: 'schema', label: 'schema' },
        { id: 'plugin', label: 'plugin' },
        { id: 'loop', label: 'hot loop' },
        { id: 'plain', label: 'plain obj' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['maybe', 'DX'],
        ['good', 'boundary'],
        ['bad', 'slow path'],
        ['best', 'fast path'],
      ],
    ),
    highlight: { found: ['plugin:fit', 'plain:fit'], removed: ['loop:fit'] },
    explanation: 'Use proxies where interposition is the feature. For stable domain objects, arrays, and hot property reads, plain structures let engines do their best work.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'trap path') yield* trapPath();
  else if (view === 'engine cost') yield* engineCost();
  else throw new InputError('Pick a Proxy view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the trap-path view as one object operation crossing a boundary. A call site is the code that writes property access such as obj.x, the proxy is the wrapper, the handler stores traps, and the target is the real object behind the wrapper. Active nodes show the operation path; found nodes show the ordinary object path that remains available through Reflect.',
        'Read the engine-cost view as a contrast between predictable shape lookup and user-code dispatch. A hidden class is an engine record of object layout, and an inline cache is a small call-site cache that remembers how a previous property load was resolved. When the proxy path lights up, the animation is showing the moment where the engine must respect programmable behavior instead of assuming a direct slot load.',
        {type:'callout', text:'A Proxy makes object access programmable, so the same hook that enables membranes and validation can also defeat the assumptions behind fast property access.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript has many ways to touch an object: read a property, write a property, check a key with in, enumerate keys, call a function, construct with new, or inspect descriptors. A normal wrapper function sees only explicit calls, so it misses much of the object protocol. Proxy exists to interpose on those operations through traps.',
        'Interpose means to stand between caller and target. That is useful at boundaries where the boundary itself is the feature: validation, logging, compatibility shims, lazy objects, access control, test doubles, and membranes. A membrane is a wrapper around an object graph that can restrict, log, or revoke access across a trust boundary.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to write ordinary wrapper methods. If a user object has getName and setName, the wrapper can validate input, log calls, and forward to the real object. That works when the API is small and every operation is an explicit method call.',
        'The approach breaks down when callers use normal object syntax. A property read like user.name does not call getName, the in operator does not call a wrapper method, and Object.keys has its own protocol. A facade can cover the methods it knows about, but it cannot cover the object language itself unless every caller agrees to use the facade API.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coverage versus speed. To cover the full object protocol, Proxy must make ordinary-looking operations observable to user code. A property read can now log, allocate, throw, recurse, call another object, or synthesize a value that is not stored on the target.',
        'That destroys some of the assumptions engines use for fast property access. A plain object with stable layout lets the engine turn obj.x into a cached offset load after a few observations. A proxy forces the engine to ask the handler what the operation means, so the fast path is weaker even when the trap eventually forwards to the target.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Proxy moves the decision point from object layout to operation dispatch. Instead of asking only where property x lives in memory, the runtime asks whether the handler has a trap for this operation and what that trap returns. The target still matters, but the caller no longer reaches it directly.',
        'Reflect is the controlled path back to ordinary semantics. A trap can do policy work first and then call Reflect.get, Reflect.set, or another Reflect method to perform the language operation correctly. The insight is not to replace JavaScript semantics by hand; it is to intercept the decision and forward deliberately when normal behavior is desired.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A Proxy is created from a target object and a handler object. When code evaluates proxy.name, the engine checks whether handler.get exists. If it does, the trap receives the target, property key, and receiver; it can return a value, throw, or forward with Reflect.get.',
        'Writes use set, membership checks use has, function calls use apply, constructors use construct, key enumeration uses ownKeys, and descriptor operations use traps such as getOwnPropertyDescriptor and defineProperty. The handler can implement policy at each operation point. The target remains the reference object that invariants are checked against.',
        'Those invariants are not optional. A trap cannot claim that a non-configurable property disappeared, cannot report impossible descriptor state, and cannot violate non-extensible object rules. If handler behavior conflicts with required target facts, the engine throws instead of accepting the lie.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an invariant argument. For every trapped operation, the language still checks the result against the target invariants that protect object identity, non-configurable properties, and non-extensible objects. The handler can virtualize behavior only within those rules.',
        'Reflect helps preserve the ordinary operation when the trap is only adding policy. For example, Reflect.get uses the same receiver and prototype-chain semantics the language would have used. That makes a logging trap correct by construction: log first, forward with Reflect, return the result, and let the engine enforce invariants.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A plain hot property read can become close to constant-time offset access after the inline cache stabilizes. If one call site sees one object shape repeatedly, the engine can skip most generic lookup work. With a proxy, the call site must treat the read as programmable dispatch, so the constant factor can be much larger even though the source code still says obj.x.',
        'A real number example makes the behavior visible. Reading three fields from 100000 table rows is 300000 property reads. If those rows are plain objects with stable shapes, the engine can reuse cached loads; if each row is a proxy, those 300000 reads can become 300000 trap calls plus any work the trap performs. The Big-O notation is still O(n), but the behavior changes from a tight memory-friendly loop to a user-code dispatch loop.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Proxy is a strong fit when interposition is the product feature. A plugin host can expose a wrapped project object, log every operation, reject writes to protected fields, and revoke access when the plugin unloads. A validation layer can guard an API boundary without changing every caller method by method.',
        'Proxy is also useful for lazy remote objects and compatibility adapters. A property can be resolved on demand from another storage layer, or old field names can map to new ones while warning callers. In each case, the boundary is explicit and valuable enough to pay for the trap path.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Proxy fails when used as the default shape for ordinary application data. Hot render loops, numeric arrays, stable domain records, and table rows usually want plain structures so the engine can optimize predictable access. Hiding every field behind get and set traps makes simple data harder to reason about and slower to read.',
        'It also fails when traps lie casually. A broad get trap that returns undefined for missing properties can hide bugs. A trap that recursively reads the same proxy can loop. A membrane without a WeakMap cache can wrap the same target twice and break identity checks.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a plugin receives a project object with 40 fields and 12 methods. The host wraps it in a proxy. The get trap allows reads, the set trap rejects writes to billingPlan and ownerId, the apply trap wraps returned objects, and a revoked flag makes every later trap throw after unload.',
        'The cost is acceptable if a plugin performs 200 operations during a command because the boundary prevents unauthorized writes. The same design is bad for a grid that renders 100000 rows and reads name, status, and total on every frame. That grid turns 300000 stable field loads into 300000 trap dispatches, so validation should happen at data ingress and rendering should use plain rows.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Proxy at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy, MDN Reflect at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect, ECMA-262 Proxy Objects at https://tc39.es/ecma262/#sec-proxy-objects, V8 Fast Properties at https://v8.dev/blog/fast-properties, and JavaScript engine fundamentals on shapes and inline caches at https://mathiasbynens.be/notes/shapes-ics.',
        'Study next by layer. For language semantics, read Property Descriptors, Prototype Chain, Reflect API, and WeakMap. For engine behavior, read Hidden Classes, Inline Caches, Array Elements Kinds, and Megamorphic Call Sites. For boundary design, read Capability Security, Membranes, Object-Capability Patterns, and Plugin Sandbox Architecture.',
      ],
    },
  ],
};
