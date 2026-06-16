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
      heading: 'What it is',
      paragraphs: [
        'A JavaScript Proxy virtualizes another object. The proxy has a target and a handler. The handler defines traps for fundamental operations such as get, set, has, apply, construct, ownKeys, and defineProperty.',
        'The data structure is an interposition node. Every operation flows through the proxy, then either custom trap code answers it or Reflect forwards it to the target with ordinary semantics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For obj.x, if obj is a proxy and the handler defines get, the engine calls the trap with target, property, and receiver. The trap can return a synthetic value, enforce policy, or call Reflect.get. Required invariants are checked against the target.',
        'This interposition changes performance expectations. Ordinary objects can benefit from hidden classes, property descriptors, and inline caches. A proxy trap can run arbitrary JavaScript, so hot proxy access often loses the predictability that engines need for fast paths.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A plugin API exposes a project object through a membrane. The membrane proxies every reachable object, blocks writes outside the plugin sandbox, logs path reads, and can revoke access. The proxy overhead is acceptable because this is a trust boundary.',
        'The same proxy wrapped around every row in a large table is a different story. A render loop reading row.name thousands of times now pays trap overhead and may defeat inline-cache assumptions. The correct structure there is plain data plus explicit validation at the boundary.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Proxy is not a free way to make every object magical. It is a boundary tool. It also does not let you violate core object invariants. A handler that lies about non-configurable or non-extensible properties can throw.',
        'Reflect does not remove proxy behavior. If Reflect is called on a proxy from inside a trap, it can route back through traps and recurse if the handler is not written carefully.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: MDN Proxy at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy, MDN handler.get at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get, V8 fast properties at https://v8.dev/blog/fast-properties, and JavaScript engine fundamentals on shapes and inline caches at https://mathiasbynens.be/notes/shapes-ics. Study V8 Hidden Classes & Inline Caches, V8 Array Elements Kinds, Capability Security & Attenuation, WeakRef & FinalizationRegistry, and JavaScript Lexical Environments & Closures next.',
      ],
    },
  ],
};
