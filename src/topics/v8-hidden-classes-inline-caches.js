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
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript lets objects change shape at runtime. Code can add properties late, delete properties, construct objects in different orders, and pass unrelated objects through the same function.',
        'A simple engine could store every object as a dictionary from property names to values. That matches the language, but it is too slow for hot property access. A loop that reads obj.x a million times should not repeat a full name lookup if every object has the same layout.',
        'V8 uses hidden classes, called Maps inside V8, to recover structure from dynamic objects. Inline caches then attach that structure to hot access sites so property reads can become guarded offset loads.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious representation is one hash table per object. It handles arbitrary keys, late additions, deletes, and unusual objects without needing a separate layout system.',
        'That representation is good for dynamic key bags. It is wasteful for record-like objects. If many objects all have x, y, and z in the same order, the engine can share layout metadata instead of rediscovering the same property locations.',
      ],
    },
    {
      heading: 'Where the naive approach breaks',
      paragraphs: [
        'The engine wants fixed offsets, but JavaScript only promises property semantics. Two objects can both have x and y while storing them through different internal layouts because they were built differently.',
        'A global cache for the name x is not enough. The same property name can live at different offsets on different shapes, and the same access site can see one shape in a tight loop or many shapes in generic utility code.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'Make the offset assumption conditional on shape. A hidden class records which named properties exist and where their values live. Objects that add the same properties in the same order can share the same Map and descriptor metadata.',
        'An inline cache is feedback attached to one access site, such as obj.x in one function. It records the Maps seen at that site and the handler for each Map.',
        'The fast path is: check the object Map; if it matches the cached Map, read the cached offset. If it does not match, try another cached handler or fall back to generic lookup.',
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        'An object starts with an initial Map. Adding x follows a transition to a new Map. Adding y follows another transition. A second object that adds x then y can reuse the same transition path and reach the same layout.',
        'The Map points to descriptors that describe property locations. Some properties can live in-object, which makes access cheap. Others may live in a backing store. Very dynamic objects can move toward dictionary properties, which are more flexible but less specialized.',
        'When code first runs obj.x, the inline cache observes the object Map and records the offset. A monomorphic site has one Map. A polymorphic site has a small set. A megamorphic site has seen enough unrelated shapes that generic lookup becomes more attractive than local specialization.',
        'Array elements have a related but separate optimization story. V8 tracks elements kinds for indexed storage, and many transitions move from more specific representations to more general ones.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The fast path is correct because it is guarded. The cached offset is used only after the object Map proves that the descriptor layout is the one the inline cache learned.',
        'If the Map differs, the cached offset is not trusted. The engine can check another polymorphic handler, update feedback, deoptimize optimized code that depended on old feedback, or fall back to generic property lookup.',
        'Inline caches are local because feedback is local. One obj.x site may only see Point objects and stay monomorphic. Another obj.x site in a serializer may see dozens of shapes and become megamorphic.',
      ],
    },
    {
      heading: 'How to read the visualization',
      paragraphs: [
        'In the shape-transitions view, the main path is the construction order. Map0 to Map1 to Map2 means the object is accumulating properties in a predictable sequence. The side branch shows why y then x is not the same internal shape as x then y.',
        'In the descriptor table, the slot numbers are the payoff. Once the Map is known, y can be read as slot 1 instead of found by a fresh name search.',
        'In the inline-cache view, the state names describe how much diversity one access site has seen. Monomorphic means one shape and the cheapest guard. Polymorphic means a short set of guards. Megamorphic means the site stopped being a good candidate for a tiny local cache.',
        'In the elements-kind frame, read the arrows as widening. A packed small-integer array gives the engine a tight path. Adding doubles, objects, or holes forces checks that a narrower representation did not need.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Create many points with the same constructor: this.x = x; this.y = y. Those objects follow the same hidden-class transition path and share descriptor metadata.',
        'A hot distance function that reads p.x and p.y sees the same Map at each load site. The inline cache can check the Map pointer and read fixed slots. Optimized code can then build on that stable feedback.',
        'Now build half the points by assigning y before x, or delete x from some objects, or pass configuration bags into the same distance function. The visible property names may still overlap, but the access site now sees multiple shapes and pays more checks or a generic path.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The engine pays for Maps, descriptor arrays, transition metadata, backing stores, inline-cache feedback, optimized code, and deoptimization machinery. Stable hot shapes let that metadata pay for itself through repeated offset reads.',
        'Shape diversity shifts cost back toward generality. Inconsistent construction order, late property additions, deletes, dynamic keys, proxies, and generic functions that accept many unrelated records all make specialization harder.',
        'The exact thresholds and heuristics are engine details. The stable idea is not a magic number for polymorphism; it is that repeated structure can be cached only when the program presents repeated structure.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Hidden classes and inline caches win on record-like objects in hot code: points, parsed rows, AST nodes, UI models, request records, and other objects created by a small number of constructors or factory paths.',
        'The practical rule is boring: initialize hot fields consistently, avoid deleting properties from performance-critical records, keep dynamic key bags separate from fixed-shape records, and do not send unrelated shapes through the same hot accessor when a narrower path is easy.',
      ],
    },
    {
      heading: 'Where it is the wrong lens',
      paragraphs: [
        'Hidden classes are not JavaScript classes, and they are not an API. They are engine metadata. Different engines use different names and strategies, and V8 heuristics can change.',
        'This topic is the wrong lens for cold code, I/O-bound code, or code whose bottleneck is algorithmic. A better data structure or fewer DOM operations can matter far more than shape stability.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common performance failure is accidental shape diversity: constructing objects in different orders, adding fields after hot code has started, deleting fields instead of using sentinel values, or mixing records and dictionaries at one access site.',
        'The common learning failure is overfitting microbenchmarks. Engine internals are useful for mental models, not for cargo-culting old tricks. Measure real code and treat debug output as a diagnostic, not a contract.',
        'Proxies, accessors, prototype-chain surprises, sparse arrays, and out-of-bounds array reads can also push execution away from the simple guarded-offset story.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study V8 Array Elements Kinds for indexed storage, V8 Ignition Bytecode Pipeline Case Study for feedback and execution tiers, Deoptimization Stack Maps & Safepoints for what happens when optimized assumptions fail, Hash Table and SwissTable Hash Map for the generic lookup contrast, and Cache Invalidation & Versioning for the broader idea of guarded cached assumptions.',
        'Primary sources: V8 Maps / Hidden Classes docs at https://v8.dev/docs/hidden-classes, V8 Fast Properties at https://v8.dev/blog/fast-properties, V8 Elements Kinds at https://v8.dev/blog/elements-kinds, and JavaScript Engine Fundamentals: Shapes and Inline Caches at https://mathiasbynens.be/notes/shapes-ics.',
      ],
    },
  ],
};
