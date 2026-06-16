// V8 hidden classes and inline caches: JavaScript object property access is
// fast when dynamic objects repeatedly share the same runtime shape.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'v8-hidden-classes-inline-caches',
  title: 'V8 Hidden Classes & Inline Caches',
  category: 'Data Structures',
  summary: 'How V8 turns dynamic JavaScript objects into runtime shapes, descriptor offsets, transition trees, and fast property-load caches.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['shape transitions', 'inline cache states'], defaultValue: 'shape transitions' },
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

function shapeGraph(title) {
  return graphState({
    nodes: [
      { id: 'empty', label: 'Map0', x: 0.9, y: 3.8, note: 'empty' },
      { id: 'x', label: 'Map1', x: 2.6, y: 2.4, note: '+x' },
      { id: 'xy', label: 'Map2', x: 4.4, y: 2.4, note: '+y' },
      { id: 'xyz', label: 'Map3', x: 6.2, y: 2.4, note: '+z' },
      { id: 'yx', label: 'MapA', x: 4.4, y: 5.4, note: 'y then x' },
      { id: 'desc', label: 'desc', x: 8.0, y: 2.4, note: 'offsets' },
      { id: 'obj', label: 'object', x: 9.4, y: 3.8, note: 'map ptr' },
    ],
    edges: [
      { id: 'e-empty-x', from: 'empty', to: 'x' },
      { id: 'e-x-xy', from: 'x', to: 'xy' },
      { id: 'e-xy-xyz', from: 'xy', to: 'xyz' },
      { id: 'e-empty-yx', from: 'empty', to: 'yx' },
      { id: 'e-xyz-desc', from: 'xyz', to: 'desc' },
      { id: 'e-desc-obj', from: 'desc', to: 'obj' },
    ],
  }, { title });
}

function icGraph(title) {
  return graphState({
    nodes: [
      { id: 'site', label: 'load site', x: 0.8, y: 3.8, note: 'obj.x' },
      { id: 'ic', label: 'IC', x: 2.6, y: 3.8, note: 'cache' },
      { id: 'mono', label: 'mono', x: 4.4, y: 2.0, note: '1 map' },
      { id: 'poly', label: 'poly', x: 4.4, y: 3.8, note: 'few maps' },
      { id: 'mega', label: 'mega', x: 4.4, y: 5.6, note: 'many' },
      { id: 'offset', label: 'offset', x: 6.6, y: 2.0, note: 'fast read' },
      { id: 'stub', label: 'stubs', x: 6.6, y: 3.8, note: 'cases' },
      { id: 'generic', label: 'generic', x: 6.6, y: 5.6, note: 'fallback' },
      { id: 'value', label: 'value', x: 8.5, y: 3.8, note: 'result' },
    ],
    edges: [
      { id: 'e-site-ic', from: 'site', to: 'ic' },
      { id: 'e-ic-mono', from: 'ic', to: 'mono' },
      { id: 'e-ic-poly', from: 'ic', to: 'poly' },
      { id: 'e-ic-mega', from: 'ic', to: 'mega' },
      { id: 'e-mono-offset', from: 'mono', to: 'offset' },
      { id: 'e-poly-stub', from: 'poly', to: 'stub' },
      { id: 'e-mega-generic', from: 'mega', to: 'generic' },
      { id: 'e-offset-value', from: 'offset', to: 'value' },
      { id: 'e-stub-value', from: 'stub', to: 'value' },
      { id: 'e-generic-value', from: 'generic', to: 'value' },
    ],
  }, { title });
}

function* shapeTransitions() {
  yield {
    state: shapeGraph('Adding properties walks a hidden-class transition tree'),
    highlight: { active: ['empty', 'x', 'xy', 'xyz', 'e-empty-x', 'e-x-xy', 'e-xy-xyz'], compare: ['yx'] },
    explanation: 'V8 calls hidden classes Maps. When objects receive the same named properties in the same order, they share a Map. That Map tells the engine where properties live.',
    invariant: 'Same shape plus same order enables shared layout metadata.',
  };

  yield {
    state: labelMatrix(
      'Descriptor offsets for one shape',
      [
        { id: 'x', label: 'x' },
        { id: 'y', label: 'y' },
        { id: 'z', label: 'z' },
      ],
      [
        { id: 'slot', label: 'slot' },
        { id: 'kind', label: 'kind' },
      ],
      [
        ['0', 'in object'],
        ['1', 'in object'],
        ['2', 'in object'],
      ],
    ),
    highlight: { found: ['x:slot', 'y:slot', 'z:slot'] },
    explanation: 'The descriptor array is the lookup table behind the fast path. If the object has Map3, the engine can treat property y as slot 1 instead of doing a fresh hash-table lookup.',
  };

  yield {
    state: shapeGraph('Different construction order creates a different shape'),
    highlight: { active: ['empty', 'yx', 'e-empty-yx'], compare: ['x', 'xy', 'xyz'] },
    explanation: 'Two objects can have the same visible keys but different Maps if the keys were added in different orders. Hot code likes consistent construction because one property access site can reuse one cached shape.',
  };

  yield {
    state: labelMatrix(
      'Fast properties versus dictionary properties',
      [
        { id: 'stable', label: 'stable object' },
        { id: 'late', label: 'late adds' },
        { id: 'delete', label: 'deletes' },
        { id: 'dynamic', label: 'dynamic keys' },
      ],
      [
        { id: 'layout', label: 'layout' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['shared Map', 'offset read'],
        ['new transitions', 'IC churn'],
        ['dictionary risk', 'slower lookup'],
        ['name table', 'hash-like path'],
      ],
    ),
    highlight: { active: ['stable:layout', 'stable:cost'], compare: ['delete:layout', 'dynamic:cost'] },
    explanation: 'Fast properties are optimized layout metadata. Very dynamic objects can fall back toward dictionary-style storage, which is more flexible but loses some offset-read speed.',
  };
}

function* inlineCacheStates() {
  yield {
    state: icGraph('Inline caches remember shapes seen at a property access site'),
    highlight: { active: ['site', 'ic', 'mono', 'offset', 'e-site-ic', 'e-ic-mono', 'e-mono-offset'], found: ['value'] },
    explanation: 'A monomorphic inline cache has seen one Map at this load site. The fast path checks the Map pointer and reads the property from the cached offset.',
    invariant: 'The cache is attached to the access site, not globally to the property name.',
  };

  yield {
    state: icGraph('Polymorphic sites keep a few shape-specific fast paths'),
    highlight: { active: ['poly', 'stub', 'e-ic-poly', 'e-poly-stub'], compare: ['mono'] },
    explanation: 'A polymorphic site has seen a small set of Maps. It can still be fast by checking a short list of shape-specific handlers. The cost rises with shape diversity.',
  };

  yield {
    state: icGraph('Megamorphic sites fall back to generic lookup machinery'),
    highlight: { active: ['mega', 'generic', 'e-ic-mega', 'e-mega-generic'], removed: ['offset'] },
    explanation: 'When too many shapes reach the same access site, the engine stops specializing that local cache. That is the megamorphic shape: flexible but harder to optimize.',
  };

  yield {
    state: labelMatrix(
      'Arrays have shape-like element kinds too',
      [
        { id: 'smi', label: 'SMI ints' },
        { id: 'double', label: 'doubles' },
        { id: 'object', label: 'objects' },
        { id: 'holey', label: 'holey' },
      ],
      [
        { id: 'trigger', label: 'trigger' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['small ints', 'tight path'],
        ['NaN or -0', 'double path'],
        ['object value', 'boxed path'],
        ['missing index', 'extra checks'],
      ],
    ),
    highlight: { active: ['smi:effect'], compare: ['double:trigger', 'holey:effect'] },
    explanation: 'V8 also tracks elements kinds for arrays. Packed integer arrays can use a specialized path. Adding doubles, objects, or holes forces transitions that make later operations more general.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'shapes at one access site', min: 1, max: 10 }, y: { label: 'relative lookup work', min: 0, max: 100 } },
      series: [
        { id: 'work', label: 'lookup work', points: [
          { x: 1, y: 10 }, { x: 2, y: 18 }, { x: 4, y: 35 }, { x: 6, y: 72 }, { x: 10, y: 92 },
        ] },
      ],
      markers: [
        { id: 'mono', x: 1, y: 10, label: 'mono' },
        { id: 'poly', x: 4, y: 35, label: 'poly' },
        { id: 'mega', x: 6, y: 72, label: 'mega' },
      ],
    }),
    highlight: { active: ['work', 'mono', 'poly'], compare: ['mega'] },
    explanation: 'This is the runtime lesson. A property access site that sees stable shapes can become a guarded offset read. A site that sees many unrelated shapes keeps paying for generality.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'shape transitions') yield* shapeTransitions();
  else if (view === 'inline cache states') yield* inlineCacheStates();
  else throw new InputError('Pick a V8 hidden-class view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'V8 hidden classes, called Maps in V8 internals, are runtime shape descriptors for JavaScript objects. JavaScript lets objects gain and lose properties dynamically, but optimized code wants fixed offsets like a normal struct. Hidden classes bridge that gap: objects with the same property layout share a Map, and the Map describes where each property is stored.',
        'V8 documentation explains that each Map has a list of properties associated with objects of that Map and describes the exact location of each property: https://v8.dev/docs/hidden-classes. This is a data-structure story inside the JavaScript engine: transition trees, descriptor arrays, property stores, elements stores, and caches cooperate to make dynamic property access fast.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Start with an empty object. Add property x and V8 transitions from the initial Map to a new Map. Add y and it transitions again. Objects that add x then y share the same transition path and can share descriptor metadata. Objects that add y then x may have the same visible keys but a different shape, because the transition path and offsets differ.',
        'Inline caches build on this. A property load site such as obj.x remembers the Maps it has seen. If it is monomorphic, meaning one shape, the optimized path checks the object Map and reads x from a cached offset. If it is polymorphic, the site checks a small set of shapes. If it becomes megamorphic, too many shapes have reached the same site, and the engine falls back to more generic lookup machinery. The engine-fundamentals article on shapes and inline caches gives the cross-engine version of this idea: https://mathiasbynens.be/notes/shapes-ics.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Fast property access is not free. The engine maintains transition metadata, descriptors, object backing stores, IC state, and deoptimization paths. Stable construction patterns let those structures pay for themselves. Highly dynamic objects, frequent deletes, inconsistent property order, and access sites that receive many unrelated shapes can push the engine toward dictionary-like lookup and less specialized code.',
        'V8\'s fast-properties article separates named properties from integer-indexed elements and explains that objects can use fast or dictionary properties: https://v8.dev/blog/fast-properties. This is why a JavaScript object sometimes behaves like a struct and sometimes like a hash table. The language abstraction is one object; the engine may choose several internal layouts.',
      ],
    },
    {
      heading: 'Array elements case study',
      paragraphs: [
        'Arrays have their own shape-like metadata called elements kinds. A packed array of small integers can use a tight representation. Add NaN, Infinity, -0, an object, or a hole, and the array may transition to a more general elements kind. V8\'s elements-kinds article explains how these transitions affect optimized array operations: https://v8.dev/blog/elements-kinds.',
        'The practical rule is not to write unnatural micro-optimized JavaScript everywhere. It is to understand why hot loops prefer predictable shapes: initialize fields consistently, avoid deleting properties in performance-critical objects, keep arrays packed when possible, and separate dictionary-like bags of dynamic keys from hot record-like objects.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat hidden classes as JavaScript classes. They are engine metadata, not language-level types. Different engines use different names and strategies, though the shape-plus-cache pattern is widespread. Also, do not assume every property access is optimized forever. Runtime feedback can change, code can deoptimize, and modern engines balance speed, memory, and correctness across many cases.',
        'Another trap is overfitting to old microbenchmarks. V8 changes over time. The durable lesson is structural: stable object shapes make a dynamic language look more static to the optimizer. That same idea appears in SwissTable control bytes, database indexes, and cache-friendly data layouts: move repeated lookup work into compact metadata.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 Maps / Hidden Classes docs at https://v8.dev/docs/hidden-classes, V8 Fast Properties at https://v8.dev/blog/fast-properties, JavaScript Engine Fundamentals: Shapes and Inline Caches at https://mathiasbynens.be/notes/shapes-ics, and V8 Elements Kinds at https://v8.dev/blog/elements-kinds. Study V8 Array Elements Kinds, JavaScript Proxy Trap & Inline Cache, WeakRef & FinalizationRegistry, V8 Ignition Bytecode Pipeline Case Study, Interpreter Dispatch Table & Threaded Code, Hash Table, SwissTable Hash Map, LRU Cache, The Event Loop, Web Workers, and Cache Invalidation & Versioning next.',
      ],
    },
  ],
};
