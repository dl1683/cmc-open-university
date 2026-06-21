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
      heading: 'How to read the animation',
      paragraphs: [
        'The shape-transitions view shows a transition tree. Each node is a hidden class (V8 calls them Maps). Edges are property additions: Map0 is the empty object, Map1 adds x, Map2 adds y. The main chain is the happy path; the side branch (MapA) shows what happens when properties arrive in a different order. The descriptor table shows the fixed offsets that make the fast path possible.',
        {
          type: 'callout',
          text: 'A dynamic property access becomes fast only after the engine can guard it with a stable shape and a cached offset.',
        },
        'The inline-cache view shows one property access site (obj.x) and the three IC states it can reach. Monomorphic: the site has seen exactly one Map, so the fast path is a single pointer comparison plus an offset read. Polymorphic: two to four Maps, each with its own handler stub. Megamorphic: too many Maps, so the site falls back to generic dictionary lookup.',
        'Watch which nodes light up. Active nodes are the current execution path. Compared nodes are the slower alternative the optimization avoids.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript objects are open dictionaries. Code can add properties at any time, delete them, reorder them, or pass unrelated objects through the same function. The language spec promises property semantics, not fixed layouts.',
        'Without optimization, every property access is a dictionary lookup: hash the name, probe the table, follow the chain. A hot loop reading obj.x a million times would repeat that work every iteration, even if every object has exactly the same properties in exactly the same order.',
        'V8 recovers near-static-language speed by discovering structure at runtime. Hidden classes capture the shape; inline caches attach that shape to hot access sites so property reads become guarded offset loads instead of dictionary probes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store each object as a hash map from property names to values. This is how early JavaScript engines worked: SpiderMonkey in 1995 used a property table per object. It correctly handles arbitrary keys, late additions, deletions, and unusual objects without a separate layout system.',
        'The representation matches the language. If JavaScript promises dynamic properties, a dictionary delivers dynamic properties. For small scripts and cold code, it is simple and correct.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Dictionary lookup on every obj.x is slow. Hashing the property name, probing the table, and following the result chain costs tens of nanoseconds per access. In a tight loop over an array of points, that overhead dominates actual computation.',
        'The deeper problem is that a JIT compiler cannot emit efficient machine code when the shape is unknown at compile time. Without a fixed offset, the compiler cannot inline the load. Without inlining, it cannot eliminate redundant loads, hoist invariants, or allocate values in registers. The dictionary wall is not just a constant-factor cost; it blocks the entire optimization pipeline.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Make the offset assumption conditional on shape. A hidden class records which named properties exist and at which offsets their values live. Objects that receive the same properties in the same order share the same hidden class and the same descriptor metadata.',
        {type: 'image', src: 'https://v8.dev/_img/fast-properties/adding-properties.png', alt: 'V8 hidden class transition tree while adding object properties', caption: 'The transition tree shows why property order matters: the same additions in the same order share one final hidden class. Source: V8 blog, Fast properties in V8, CC BY 3.0.'},
        'An inline cache is shape feedback attached to one access site. At obj.x in a particular function, the IC records the last Map it saw and the offset for x on that Map. The fast path is: compare the object Map pointer to the cached Map; if they match, read the cached offset directly. If they do not match, fall back or update.',
        'The key move is that shapes form a deterministic transition tree. Adding x, then y always produces the same sequence of Maps. This makes the transition predictable, the descriptor shareable, and the IC check cheap.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An object starts with an initial Map (the empty shape). Adding property x transitions to Map1. Adding y transitions to Map2. Any other object that adds x then y walks the same transitions and arrives at Map2, sharing its descriptor array. The descriptors record each property name, offset, and attributes.',
        'Some properties are stored in-object (slots allocated directly inside the object). Others overflow into a backing store. Very dynamic objects -- those that suffer deletions or receive many late additions -- can be demoted to dictionary mode, where the Map is abandoned and each object carries its own property table.',
        'At each property access site, the inline cache starts uninitialized. The first execution observes the object Map, looks up the property in the descriptor array, and caches the Map-offset pair. On the next call with the same Map, the IC skips the lookup entirely. A monomorphic IC has cached one Map (fastest). A polymorphic IC has cached two to four Maps, each with its own handler stub. A megamorphic IC has seen too many Maps and falls back to a generic lookup that checks the full descriptor chain.',
        'Array elements follow a parallel system. V8 tracks elements kinds: packed SMI (small integers), packed doubles, packed objects, and holey variants of each. Transitions go from specific to general and never reverse: storing a double in a SMI array widens it permanently.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Most JavaScript code is de facto typed. Constructors add the same fields in the same order. Factory functions return objects with the same shape. Hot loops process arrays of structurally identical records. The IC amortizes the shape check to a single pointer comparison because the Map pointer encodes the entire property layout.',
        'The fast path is correct because it is guarded. The cached offset is used only after the Map pointer proves the descriptor layout is the one the IC learned. If the Map differs, the cached offset is not trusted: the engine checks another polymorphic handler, updates feedback, or triggers deoptimization of compiled code that assumed a particular shape.',
        'Shape transitions are deterministic: adding properties in the same order always produces the same Map. This means the transition tree is a DAG, not a random graph, and sharing is the common case rather than a lucky accident.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A monomorphic IC hit costs one pointer comparison (roughly 2-3 ns on modern hardware) plus a direct offset read. An IC miss -- seeing an unexpected Map -- costs roughly 100 ns to fall back through the lookup chain, update feedback, and possibly patch the IC.',
        'The engine pays memory for Maps, descriptor arrays, transition tree metadata, IC feedback vectors, compiled code, and deoptimization metadata. Stable shapes let that metadata amortize across millions of property reads. Shape diversity wastes it: each new Map costs memory, and each IC transition costs time.',
        'Deoptimization is the hidden cost. When optimized code assumed a monomorphic site and a new shape arrives, the JIT must discard the compiled code, reconstruct the interpreter frame from on-stack replacement metadata, and eventually recompile with broader feedback. A single megamorphic site in a hot function can force the entire function back to unoptimized code.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Hot loops accessing objects with consistent shapes: point clouds, parsed JSON rows, AST nodes, UI component models, HTTP request records. Any code path where a constructor or factory always adds the same properties in the same order produces monomorphic IC sites.',
        'The practical rule: initialize all fields in the constructor, always in the same order. Keep configuration bags and dynamic key-value maps in separate objects from performance-critical records. A hot function that only ever sees Point objects stays monomorphic; the IC check is a single compare-and-branch before a direct memory read.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Adding properties in different orders creates different Maps, even if the final set of property names is identical. function Point(x,y) {this.x=x; this.y=y} and function Point(x,y) {this.y=y; this.x=x} produce two different transition chains. Code that mixes them at one access site pays polymorphic or megamorphic cost.',
        'The delete operator destroys the fast path. Deleting a property from an object can force it into dictionary mode, where it no longer shares a Map with other objects and every property access goes through the slow hash-table path.',
        'Megamorphic sites never fully optimize. A generic utility function like serialize(obj) that accepts dozens of unrelated object shapes will see its IC degrade to the generic fallback. The fix is architectural: narrow the set of shapes reaching hot code paths.',
        'Too many shapes also create memory pressure on the transition tree itself. Each unique construction order spawns a new chain of Maps. In extreme cases (code-generated objects with randomized property order), the transition tree grows without bound.',
        'This lens is wrong for cold code, I/O-bound code, or code whose bottleneck is algorithmic. A better data structure or fewer DOM operations will matter far more than shape stability.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with function Point(x, y) { this.x = x; this.y = y; }. Calling new Point(1, 2) produces three shape transitions: {} (Map0, the initial empty shape) then {x: offset 0} (Map1, after this.x = x) then {x: 0, y: 1} (Map2, after this.y = y). Every Point created by this constructor shares Map2.',
        'A hot distance function -- function dist(p) { return Math.sqrt(p.x*p.x + p.y*p.y); } -- accesses p.x and p.y. At the p.x site, the IC caches Map2 with offset 0. At the p.y site, the IC caches Map2 with offset 1. Both sites are monomorphic: one pointer compare, one offset read, no dictionary lookup.',
        'Now introduce a variant: function PointYX(x, y) { this.y = y; this.x = x; }. Objects from PointYX have {y: 0, x: 1} -- a different Map (MapA) with the same property names but different offsets. Passing both Point and PointYX objects through dist makes the p.x site polymorphic: it must check two Maps and dispatch to two different offsets. Pass five or more unrelated shapes and the site goes megamorphic, falling back to generic lookup on every call.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The hidden-class idea descends from the Self language: Chambers, Ungar, and Lee, "An Efficient Implementation of SELF, a Dynamically-Typed Object-Oriented Language Based on Prototypes" (1989), introduced Maps as a way to share layout metadata across prototype-based objects. V8 adapted the same concept for JavaScript.',
        'Primary sources: V8 blog "Fast Properties in V8" (https://v8.dev/blog/fast-properties), V8 blog "Elements Kinds in V8" (https://v8.dev/blog/elements-kinds), Mathias Bynens and Benedikt Meurer "JavaScript Engine Fundamentals: Shapes and Inline Caches" (https://mathiasbynens.be/notes/shapes-ics), and the V8 source code (https://github.com/nicolevanderhoeven/v8).',
        'Study next: V8 Array Elements Kinds for the parallel optimization on indexed storage. V8 Ignition Bytecode Pipeline for how feedback flows between interpreter and JIT tiers. Deoptimization Stack Maps & Safepoints for what happens when JIT shape assumptions break. Hash Table for the generic lookup path that hidden classes replace. Cache Invalidation & Versioning for the broader pattern of guarded cached assumptions.',
      ],
    },
  ],
};
