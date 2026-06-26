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
  const shapeNodes = ['empty', 'x', 'xy', 'xyz', 'yx', 'desc', 'obj'];
  const shapeEdges = ['e-empty-x', 'e-x-xy', 'e-xy-xyz', 'e-empty-yx', 'e-xyz-desc', 'e-desc-obj'];
  const mainChain = ['empty', 'x', 'xy', 'xyz'];
  const branchNode = 'yx';

  yield {
    state: shapeGraph('Adding properties walks a hidden-class transition tree'),
    highlight: { active: ['empty', 'x', 'xy', 'xyz', 'e-empty-x', 'e-x-xy', 'e-xy-xyz'], compare: ['yx'] },
    explanation: `V8 calls hidden classes Maps. The transition tree has ${shapeNodes.length} nodes and ${shapeEdges.length} edges. When objects receive the same named properties in the same order, they share a Map. That Map tells the engine where properties live.`,
    invariant: `Same shape plus same order enables shared layout metadata across all ${mainChain.length} main-chain transitions.`,
  };

  const descriptorRows = [
    { id: 'x', label: 'x' },
    { id: 'y', label: 'y' },
    { id: 'z', label: 'z' },
  ];
  const descriptorCols = [
    { id: 'slot', label: 'slot' },
    { id: 'kind', label: 'kind' },
  ];
  const ySlot = '1';

  yield {
    state: labelMatrix(
      'Descriptor offsets for one shape',
      descriptorRows,
      descriptorCols,
      [
        ['0', 'in object'],
        [ySlot, 'in object'],
        ['2', 'in object'],
      ],
    ),
    highlight: { found: ['x:slot', 'y:slot', 'z:slot'] },
    explanation: `The descriptor array maps ${descriptorRows.length} properties across ${descriptorCols.length} columns. If the object has Map3, the engine can treat property y as slot ${ySlot} instead of doing a fresh hash-table lookup.`,
  };

  yield {
    state: shapeGraph('Different construction order creates a different shape'),
    highlight: { active: ['empty', 'yx', 'e-empty-yx'], compare: ['x', 'xy', 'xyz'] },
    explanation: `Two objects can have the same visible keys but different Maps if the keys were added in different orders. The ${branchNode} branch diverges from the ${mainChain.length}-node main chain. Hot code likes consistent construction because one property access site can reuse one cached shape.`,
  };

  const layoutCategories = ['stable object', 'late adds', 'deletes', 'dynamic keys'];
  const layoutCols = ['layout', 'cost'];

  yield {
    state: labelMatrix(
      'Fast properties versus dictionary properties',
      [
        { id: 'stable', label: layoutCategories[0] },
        { id: 'late', label: layoutCategories[1] },
        { id: 'delete', label: layoutCategories[2] },
        { id: 'dynamic', label: layoutCategories[3] },
      ],
      [
        { id: 'layout', label: layoutCols[0] },
        { id: 'cost', label: layoutCols[1] },
      ],
      [
        ['shared Map', 'offset read'],
        ['new transitions', 'IC churn'],
        ['dictionary risk', 'slower lookup'],
        ['name table', 'hash-like path'],
      ],
    ),
    highlight: { active: ['stable:layout', 'stable:cost'], compare: ['delete:layout', 'dynamic:cost'] },
    explanation: `Fast properties cover ${layoutCategories.length} categories compared across ${layoutCols.length} dimensions. Very dynamic objects can fall back toward dictionary-style storage, which is more flexible but loses some offset-read speed.`,
  };
}

function* inlineCacheStates() {
  const icNodeCount = 9;
  const icEdgeCount = 10;
  const monoNote = '1 map';
  const polyNote = 'few maps';
  const megaNote = 'many';

  yield {
    state: icGraph('Inline caches remember shapes seen at a property access site'),
    highlight: { active: ['site', 'ic', 'mono', 'offset', 'e-site-ic', 'e-ic-mono', 'e-mono-offset'], found: ['value'] },
    explanation: `A monomorphic inline cache has seen ${monoNote} at this load site. The IC graph tracks ${icNodeCount} nodes across ${icEdgeCount} edges. The fast path checks the Map pointer and reads the property from the cached offset.`,
    invariant: `The cache is attached to the access site, not globally to the property name — each of the ${icNodeCount} IC nodes is site-specific.`,
  };

  yield {
    state: icGraph('Polymorphic sites keep a few shape-specific fast paths'),
    highlight: { active: ['poly', 'stub', 'e-ic-poly', 'e-poly-stub'], compare: ['mono'] },
    explanation: `A polymorphic site has seen ${polyNote} (a small set of Maps). It can still be fast by checking a short list of shape-specific handlers. The cost rises with shape diversity.`,
  };

  yield {
    state: icGraph('Megamorphic sites fall back to generic lookup machinery'),
    highlight: { active: ['mega', 'generic', 'e-ic-mega', 'e-mega-generic'], removed: ['offset'] },
    explanation: `When ${megaNote} shapes reach the same access site, the engine stops specializing that local cache. That is the megamorphic state: flexible but harder to optimize.`,
  };

  const elementKinds = ['SMI ints', 'doubles', 'objects', 'holey'];
  const elementCols = ['trigger', 'effect'];

  yield {
    state: labelMatrix(
      'Arrays have shape-like element kinds too',
      [
        { id: 'smi', label: elementKinds[0] },
        { id: 'double', label: elementKinds[1] },
        { id: 'object', label: elementKinds[2] },
        { id: 'holey', label: elementKinds[3] },
      ],
      [
        { id: 'trigger', label: elementCols[0] },
        { id: 'effect', label: elementCols[1] },
      ],
      [
        ['small ints', 'tight path'],
        ['NaN or -0', 'double path'],
        ['object value', 'boxed path'],
        ['missing index', 'extra checks'],
      ],
    ),
    highlight: { active: ['smi:effect'], compare: ['double:trigger', 'holey:effect'] },
    explanation: `V8 tracks ${elementKinds.length} element kinds for arrays. Packed ${elementKinds[0]} arrays use the tightest path. Adding ${elementKinds[1]}, ${elementKinds[2]}, or ${elementKinds[3]} values forces transitions that make later operations more general.`,
  };

  const monoWork = 10;
  const polyWork = 35;
  const megaWork = 72;
  const maxShapes = 10;
  const workPoints = [
    { x: 1, y: monoWork }, { x: 2, y: 18 }, { x: 4, y: polyWork }, { x: 6, y: megaWork }, { x: maxShapes, y: 92 },
  ];

  yield {
    state: plotState({
      axes: { x: { label: 'shapes at one access site', min: 1, max: maxShapes }, y: { label: 'relative lookup work', min: 0, max: 100 } },
      series: [
        { id: 'work', label: 'lookup work', points: workPoints },
      ],
      markers: [
        { id: 'mono', x: 1, y: monoWork, label: 'mono' },
        { id: 'poly', x: 4, y: polyWork, label: 'poly' },
        { id: 'mega', x: 6, y: megaWork, label: 'mega' },
      ],
    }),
    highlight: { active: ['work', 'mono', 'poly'], compare: ['mega'] },
    explanation: `This is the runtime lesson. A monomorphic site costs only ${monoWork}% relative work; a polymorphic site rises to ${polyWork}%. At ${megaWork}% the megamorphic fallback dominates across up to ${maxShapes} shapes. Stable shapes keep access fast; shape diversity keeps paying for generality.`,
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
        'The shape-transition view shows hidden classes, which V8 calls Maps. A hidden class is layout metadata: it says which properties exist and where their values live inside the object.',
        {
          type: 'callout',
          text: 'A dynamic property access becomes fast only after the engine can guard it with a stable shape and a cached offset.',
        },
        'The safe inference is guarded reuse. If an object still has the cached Map, the inline cache may read the cached offset; if the Map differs, the engine must take a slower path or update feedback.',
        'In the inline-cache view, monomorphic means one Map has been seen, polymorphic means a few Maps have been seen, and megamorphic means the access site has become too diverse for a tight fast path.',
      
        {type: 'image', src: './assets/gifs/v8-hidden-classes-inline-caches.gif', alt: 'Animated walkthrough of the v8 hidden classes inline caches visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript objects can gain and lose properties at runtime. The language behaves like every object is a flexible dictionary, but hot programs need property access that is closer to a fixed-offset load.',
        'Hidden classes and inline caches exist to recover stable structure from dynamic code. They let the engine say: this access is fast as long as the object shape is the one we already proved.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious representation is a hash table per object from property name to value. It handles dynamic keys, deletion, unusual prototypes, and late additions without needing a separate layout system.',
        'That representation is correct and often fine for cold code. A one-off configuration object does not need a transition tree or compiled fast path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated lookup at hot access sites. Reading obj.x one million times should not hash the string x and probe a table one million times if every object has the same layout.',
        'A compiler also needs a stable offset to produce good machine code. Without a guarded layout assumption, it cannot inline the load, keep values in registers, or remove redundant property checks.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to make layout assumptions explicit and cheap to check. Objects that receive the same properties in the same order share the same hidden class and descriptor metadata.',
        {type: 'image', src: 'https://v8.dev/_img/fast-properties/adding-properties.png', alt: 'V8 hidden class transition tree while adding object properties', caption: 'The transition tree shows why property order matters: the same additions in the same order share one final hidden class. Source: V8 blog, Fast properties in V8, CC BY 3.0.'},
        'An inline cache stores a Map pointer and an offset for one property access site. The Map pointer proves the layout, and the offset tells the engine where to load the value.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An empty object starts at an initial Map. Adding x transitions to a new Map with x at offset 0, and adding y transitions to another Map with y at offset 1.',
        'The first execution of obj.x performs the full lookup and records feedback. The next execution with the same Map performs one pointer comparison and then reads the value directly from the known offset.',
        'If a new Map appears, the site may become polymorphic and cache a small set of handlers. If too many unrelated Maps arrive, it becomes megamorphic and falls back to generic lookup.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The fast path is correct because it is guarded by identity of the hidden class. The offset is trusted only after the Map comparison proves that the object layout is the layout the cache learned.',
        'Shape transitions are deterministic for the same addition order. That means a constructor that always assigns x then y creates objects with the same final Map, so feedback collected on one instance applies to the next.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A monomorphic hit costs roughly a pointer comparison plus a memory load. A miss costs a slower lookup, feedback update, and sometimes deoptimization if compiled code assumed the narrower shape.',
        'Cost behaves badly when shape diversity grows. Two shapes add a small dispatch; many shapes can force a megamorphic fallback, so a hot loop that looked like O(n) arithmetic becomes O(n) generic property lookup with a much larger constant.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This is the reason constructors and factories should initialize the same fields in the same order. Point objects, AST nodes, parsed JSON rows, UI models, and request records all become faster when hot code sees stable shapes.',
        'The same idea extends to array element kinds. Packed integer arrays, double arrays, object arrays, and holey arrays each carry layout feedback that lets the engine choose specialized code until the program widens the representation.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Different property orders produce different Maps even when the final property names match. Deleting properties can push objects into dictionary mode, where the fast shared layout no longer applies.',
        'Generic utilities also defeat the cache. A serializer that accepts dozens of unrelated object shapes at one access site may be inherently megamorphic, and the right fix is often to move shape-normalization outside the hot loop.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'function Point(x, y) { this.x = x; this.y = y; } creates Map0 for empty, Map1 after x, and Map2 after y. In Map2, x is offset 0 and y is offset 1.',
        'A hot function dist(p) reads p.x twice and p.y twice. After warmup, each site can check Map2 and load offsets 0 and 1 directly, so 1,000,000 calls avoid 4,000,000 dictionary probes.',
        'Now add PointYX, which assigns y before x. It has a different Map where x is offset 1, so the same dist site becomes polymorphic; after five unrelated shapes, it is likely megamorphic and the offset proof no longer stays small.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are Chambers, Ungar, and Lee, An Efficient Implementation of SELF (1989); the V8 blog Fast Properties in V8; the V8 blog Elements Kinds in V8; and Mathias Bynens and Benedikt Meurer, JavaScript engine fundamentals: Shapes and Inline Caches. These explain Maps, descriptor arrays, elements kinds, and feedback-driven optimization.',
        'Study hash tables to understand the fallback path, then JIT compilation, deoptimization, array elements kinds, cache invalidation, and object layout. The general pattern is guarded speculation: make a fast assumption, prove it cheaply, and exit when the proof fails.',
      ],
    },
  ],
};
