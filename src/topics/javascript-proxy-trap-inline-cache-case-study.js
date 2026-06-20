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
      heading: 'What a Proxy actually changes',
      paragraphs: [
        'A JavaScript Proxy changes the path an object operation takes. Instead of a property read, write, function call, construction, enumeration, or descriptor operation going straight to the target object, it first reaches a handler. The handler can intercept that operation through traps such as get, set, has, apply, construct, ownKeys, and defineProperty.',
        'That makes Proxy an interposition primitive. It is not just a nicer getter or setter. It can stand in front of the object protocol itself. The target still exists, but the caller no longer talks to it directly.',
        'This is powerful at boundaries: logging, validation, compatibility shims, lazy objects, access control, membranes, and test doubles. It is also dangerous as a default data model because it makes ordinary object operations run user code.',
        {type:'callout', text:'A Proxy makes object access programmable, so the same hook that enables membranes and validation can also defeat the assumptions behind fast property access.'},
      ],
    },
    {
      heading: 'The obvious approach and its wall',
      paragraphs: [
        'The obvious way to add policy is to wrap methods manually: create a facade with functions that validate, log, or forward. That works when the API is explicit and small.',
        'The wall is that JavaScript object behavior is not limited to method calls. Code can read a property, assign a property, use `in`, enumerate keys, call a function, construct with `new`, inspect descriptors, or interact with the prototype chain. A method wrapper does not see all of those operations.',
        'Proxy solves the coverage problem by interposing at the protocol layer. The price is that the engine must treat the operation as potentially arbitrary. A property read on a proxy can allocate, throw, mutate unrelated objects, call back into the same proxy, or synthesize a value that never existed on the target.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the trap-path view, follow the operation from call site to proxy to handler. The important fact is that `obj.x` no longer means "load a slot from this object." It means "ask the proxy handler what this property read should do."',
        'When Reflect appears, read it as deliberate forwarding. A trap can enforce policy, log access, or transform arguments, then use Reflect.get, Reflect.set, or another Reflect method to preserve the ordinary object operation. Reflect keeps the trap from hand-implementing the language semantics poorly.',
        'In the engine-cost view, compare the proxy path with the shape and inline-cache path. Plain objects give the engine stable structure. Proxies replace that predictable structure with user-code dispatch, which is exactly the feature and exactly the cost.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For `proxy.x`, the engine checks whether the handler defines a get trap. If it does, the trap receives the target, property key, and receiver. The trap can return a synthetic value, deny access, lazily compute a value, or forward with Reflect.get.',
        'For `proxy.x = value`, the set trap can validate, redirect, or reject the write. For function proxies, apply and construct traps intercept calls and `new`. For enumeration and reflection, ownKeys and getOwnPropertyDescriptor participate.',
        'The language still enforces invariants. A trap cannot pretend a non-configurable property vanished, report impossible descriptors, or violate non-extensible object constraints. Proxy virtualizes behavior, but it does not erase the object model underneath.',
        'That invariant enforcement is why Reflect is common in serious proxy code. It delegates the ordinary operation back to the engine after the handler has made its policy decision. Hand-written forwarding often gets receiver binding, accessors, prototypes, or descriptor rules wrong.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Proxy moves the decision point from object layout to operation dispatch. A normal property load can be optimized around a known hidden class and offset. A proxied load must ask the handler what the operation means.',
        'That is the whole trade. It enables membranes because every read, write, and call can pass through policy. It hurts hot paths because the engine loses the stable assumptions that make inline caches fast.',
        'Reflect is the controlled path back to normal semantics. It lets a trap say: "run my policy first, then perform the operation the language would have performed." But Reflect is not a bypass for correctness. Bad receiver handling or recursive forwarding can still create loops.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A plugin host exposes a project object to untrusted plugins. The host wraps the object in a membrane. Reads are allowed, writes to protected paths are rejected, functions are wrapped so arguments and return values stay inside the membrane, and access can be revoked when the plugin unloads.',
        'In that case the proxy cost is justified because the boundary is the product. The host wants interposition more than raw property speed.',
        'Now put a proxy around every row in a 100,000-row table and render `row.name`, `row.status`, and `row.total` in a tight loop. The code may become much slower because every read runs through traps and the engine cannot treat the rows as plain stable objects. The better design is plain row data plus validation when data enters the table model.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Proxy wins when interposition is the point: plugin boundaries, security membranes, compatibility adapters, observability wrappers, lazy remote objects, deprecation warnings, test doubles, and schema guards at API edges.',
        'It is also useful when you need to virtualize an object whose full property set is not known up front. The handler can synthesize values, hide implementation details, or bridge to another storage layer.',
        'A good proxy design is explicit about the boundary it protects. If the boundary can be named, tested, and documented, Proxy may be the right primitive. If the goal is only convenience inside ordinary application data, plain objects plus normal functions are usually easier to optimize and debug.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Proxy fails when used as a blanket data model for hot code. Tight render loops, numeric data, array-heavy algorithms, stable domain objects, and frequently read table rows usually want plain structures that engines can optimize.',
        'It also fails when handlers lie casually. Invariant violations can throw. Overly broad traps can hide real bugs. A default get trap that returns undefined for everything can make missing-property errors harder to find.',
        'The rule of thumb is simple: use Proxy where the boundary has value. Do not use it just to make ordinary objects feel clever.',
      ],
    },
    {
      heading: 'Costs and debugging',
      paragraphs: [
        'The visible cost is runtime overhead. The less visible cost is debugging. Stack traces may point into handler code rather than the call site that looked like a normal property access. Logging every get trap can also create noise because ordinary libraries inspect objects more often than humans expect.',
        'Proxies can also interact badly with identity assumptions. A membrane may wrap the same target multiple times unless it keeps a WeakMap from target to proxy. Without that cache, equality and object graph traversal become confusing.',
        'There is also a maintenance cost. A proxy can make simple-looking code depend on hidden handler behavior. Teams should document proxy boundaries the same way they document network or security boundaries: what is intercepted, what is forwarded, what can throw, and what invariants callers may rely on.',
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
