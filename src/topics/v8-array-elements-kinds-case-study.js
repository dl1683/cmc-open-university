// V8 array elements kinds: packed vs holey, Smi/double/object transitions,
// backing stores, dictionary mode, and practical hot-loop advice.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'v8-array-elements-kinds-case-study',
  title: 'V8 Array Elements Kinds',
  category: 'Data Structures',
  summary: 'How V8 classifies JavaScript arrays with packed, holey, Smi, double, object, and dictionary-style element layouts for optimized indexed access.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['kind lattice', 'holey pitfalls'], defaultValue: 'kind lattice' },
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

function latticeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'smi', label: 'SMI', x: 1.0, y: 2.3, note: notes.smi ?? 'small int' },
      { id: 'dbl', label: 'DOUBLE', x: 3.1, y: 2.3, note: notes.dbl ?? 'number' },
      { id: 'obj', label: 'OBJECT', x: 5.2, y: 2.3, note: notes.obj ?? 'any value' },
      { id: 'hsmi', label: 'H_SMI', x: 1.0, y: 5.4, note: notes.hsmi ?? 'holes' },
      { id: 'hdbl', label: 'H_DBL', x: 3.1, y: 5.4, note: notes.hdbl ?? 'holes' },
      { id: 'hobj', label: 'H_OBJ', x: 5.2, y: 5.4, note: notes.hobj ?? 'holes' },
      { id: 'dict', label: 'dict', x: 7.7, y: 4.0, note: notes.dict ?? 'sparse' },
      { id: 'store', label: 'store', x: 9.0, y: 4.0, note: notes.store ?? 'backing' },
    ],
    edges: [
      { id: 'e-smi-dbl', from: 'smi', to: 'dbl', weight: '+3.14' },
      { id: 'e-dbl-obj', from: 'dbl', to: 'obj', weight: '+obj' },
      { id: 'e-smi-hsmi', from: 'smi', to: 'hsmi', weight: 'hole' },
      { id: 'e-dbl-hdbl', from: 'dbl', to: 'hdbl', weight: 'hole' },
      { id: 'e-obj-hobj', from: 'obj', to: 'hobj', weight: 'hole' },
      { id: 'e-hsmi-hdbl', from: 'hsmi', to: 'hdbl', weight: '+3.14' },
      { id: 'e-hdbl-hobj', from: 'hdbl', to: 'hobj', weight: '+obj' },
      { id: 'e-hobj-dict', from: 'hobj', to: 'dict', weight: 'sparse' },
      { id: 'e-dict-store', from: 'dict', to: 'store', weight: '' },
    ],
  }, { title });
}

function backingGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'arr', label: 'array', x: 0.8, y: 4.0, note: notes.arr ?? 'JS object' },
      { id: 'map', label: 'map', x: 2.4, y: 2.5, note: notes.map ?? 'kind tag' },
      { id: 'len', label: 'length', x: 2.4, y: 5.5, note: notes.len ?? 'visible' },
      { id: 'store', label: 'store', x: 4.4, y: 4.0, note: notes.store ?? 'elements' },
      { id: 'slot0', label: '0', x: 6.1, y: 2.3, note: notes.slot0 ?? 'value' },
      { id: 'hole', label: 'hole', x: 6.1, y: 4.0, note: notes.hole ?? 'missing' },
      { id: 'proto', label: 'proto', x: 7.8, y: 4.0, note: notes.proto ?? 'lookup?' },
      { id: 'loop', label: 'loop', x: 9.0, y: 4.0, note: notes.loop ?? 'checks' },
    ],
    edges: [
      { id: 'e-arr-map', from: 'arr', to: 'map', weight: '' },
      { id: 'e-arr-len', from: 'arr', to: 'len', weight: '' },
      { id: 'e-arr-store', from: 'arr', to: 'store', weight: '' },
      { id: 'e-store-slot0', from: 'store', to: 'slot0', weight: '' },
      { id: 'e-store-hole', from: 'store', to: 'hole', weight: '' },
      { id: 'e-hole-proto', from: 'hole', to: 'proto', weight: '' },
      { id: 'e-proto-loop', from: 'proto', to: 'loop', weight: '' },
    ],
  }, { title });
}

function* kindLattice() {
  yield {
    state: latticeGraph('V8 tracks array elements with a kind lattice'),
    highlight: { active: ['smi'], compare: ['dbl', 'obj', 'hsmi'] },
    explanation: 'V8 specializes arrays by the values they contain. A packed small-integer array is a different optimization case from a double array, object array, holey array, or sparse dictionary-like array.',
    invariant: 'More specific element kinds give the optimizer more leverage.',
  };

  yield {
    state: labelMatrix(
      'Common elements kinds',
      [
        { id: 'smi', label: 'SMI' },
        { id: 'double', label: 'DOUBLE' },
        { id: 'object', label: 'OBJECT' },
        { id: 'holey', label: 'HOLEY' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'fastPath', label: 'fast path' },
      ],
      [
        ['small ints', 'tight'],
        ['numbers', 'unboxed'],
        ['any value', 'general'],
        ['missing idx', 'checks'],
      ],
    ),
    highlight: { found: ['smi:fastPath', 'double:fastPath'], compare: ['holey:fastPath'] },
    explanation: 'SMI is V8 terminology for small integers. Doubles can be stored without boxing in specialized arrays. Object elements are more general. Holey variants need extra checks for missing entries.',
  };

  yield {
    state: latticeGraph('Adding a double moves down from SMI to DOUBLE'),
    highlight: { active: ['smi', 'dbl', 'e-smi-dbl'], compare: ['obj'] },
    explanation: 'Once a floating-point value enters an integer array, V8 can transition the elements kind to a double-oriented representation. That transition helps correctness while preserving a specialized numeric path.',
  };

  yield {
    state: latticeGraph('Adding an object moves to a more general kind'),
    highlight: { active: ['dbl', 'obj', 'e-dbl-obj'], compare: ['smi'] },
    explanation: 'A single object, string, or arbitrary JavaScript value forces a more general object-elements path. The array abstraction stays the same, but the backing representation changed.',
  };

  yield {
    state: labelMatrix(
      'Hot-loop advice',
      [
        { id: 'init', label: 'literals' },
        { id: 'mix', label: 'mixed' },
        { id: 'delete', label: 'delete' },
        { id: 'sparse', label: 'sparse' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'prefer', label: 'prefer' },
      ],
      [
        ['packed', 'push/fill'],
        ['general', 'split data'],
        ['holes', 'splice/null'],
        ['dict', 'Map/object'],
      ],
    ),
    highlight: { found: ['init:effect', 'init:prefer'], removed: ['delete:effect'], compare: ['sparse:prefer'] },
    explanation: 'The practical rule is simple: keep hot numeric arrays dense and type-stable. Use Map or ordinary objects for sparse dictionaries instead of pretending a sparse array is a dense vector.',
  };
}

function* holeyPitfalls() {
  yield {
    state: backingGraph('A hole is not the same as an undefined value'),
    highlight: { active: ['arr', 'store', 'hole', 'e-arr-store', 'e-store-hole'], compare: ['slot0'] },
    explanation: 'A hole means the array has no own element at that index. The engine may need to check the prototype chain before deciding the read is really missing.',
    invariant: 'Holes turn an indexed read into a guarded lookup.',
  };

  yield {
    state: labelMatrix(
      'Ways to make holes',
      [
        { id: 'new', label: 'new Array' },
        { id: 'skip', label: 'a[9]=x' },
        { id: 'delete', label: 'delete a[i]' },
        { id: 'literal', label: '[1,,3]' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['holey', 'empty slots'],
        ['holey', 'gap'],
        ['holey', 'proto chk'],
        ['holey', 'gap'],
      ],
    ),
    highlight: { removed: ['delete:risk'], active: ['new:shape', 'skip:shape'] },
    explanation: 'Creating a long empty array, assigning far past the end, deleting an index, or writing an elision literal can all create holes. Filling later may not recover the original packed fast path in the general case.',
  };

  yield {
    state: backingGraph('Holey reads need extra checks', { map: 'HOLEY', hole: 'missing?', proto: 'maybe', loop: 'slower' }),
    highlight: { active: ['map', 'hole', 'proto', 'loop', 'e-hole-proto', 'e-proto-loop'], compare: ['slot0'] },
    explanation: 'Packed arrays can often use tight loops. Holey arrays need guards because a missing own element can fall through to inherited properties or special cases.',
  };

  yield {
    state: latticeGraph('Very sparse arrays can become dictionary-like', { dict: 'hashy', store: 'entries' }),
    highlight: { active: ['hobj', 'dict', 'store', 'e-hobj-dict', 'e-dict-store'], compare: ['smi', 'dbl'] },
    explanation: 'If indexes are extremely sparse, a dense backing store would waste memory. Engines can switch to dictionary-style storage for indexed properties, trading dense-vector speed for space and generality.',
  };

  yield {
    state: labelMatrix(
      'Array vs dictionary',
      [
        { id: 'dense', label: 'dense nums' },
        { id: 'rows', label: 'rows' },
        { id: 'ids', label: 'id keys' },
        { id: 'holes', label: 'many gaps' },
      ],
      [
        { id: 'structure', label: 'structure' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['Array', 'scan fast'],
        ['Array', 'ordered list'],
        ['Map', 'key lookup'],
        ['Map/object', 'sparse'],
      ],
    ),
    highlight: { found: ['dense:structure', 'ids:structure'], compare: ['holes:structure'] },
    explanation: 'Use arrays for dense ordered sequences. Use Map or objects for keyed sparse data. That matches both the language semantics and the engine layouts.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'kind lattice') yield* kindLattice();
  else if (view === 'holey pitfalls') yield* holeyPitfalls();
  else throw new InputError('Pick a V8 array view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'JavaScript arrays have one surface API, but real arrays behave very differently. A dense list of small integers, a numeric vector with doubles, a mixed object array, and a sparse array with holes need different machine representations.',
        'V8 array elements kinds exist so the engine can specialize indexed access when the data is predictable, while still preserving JavaScript semantics when arrays become sparse, mixed, or holey.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simple implementation is to store every array element as a general JavaScript value in a dictionary-like structure. That handles every case: holes, inherited properties, objects, strings, numbers, and far-apart indexes.',
        'That representation wastes information for common hot paths. If an array is packed and numeric, the engine can scan it much more cheaply than a general dictionary of arbitrary values.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is semantic flexibility. A missing index is not always the same as a stored undefined value, because lookup may involve the prototype chain. A sparse index can make dense storage wasteful. A mixed value can invalidate a numeric fast path.',
        'Elements kinds let V8 keep a specialized path only while its assumptions are true. Writes that violate the assumptions move the array to a more general kind.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Classify indexed storage by two questions: what kind of values are stored, and are the indexes packed or holey? Small integers, doubles, and general objects each get different representations; packed and holey versions carry different lookup obligations.',
        'The lattice mostly moves from specific to general. A packed small-integer array can become a double array after a floating-point write, then an object array after an arbitrary value. Creating holes moves from packed to holey.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        "In the kind-lattice view, read each transition as the engine losing an assumption. A packed small-integer array gives V8 the strongest promise. Writing a double, writing an object, or creating a hole moves the array toward a more general representation.",
        "In the holey-pitfalls view, distinguish a stored value from a missing own property. `undefined` can be an element. A hole means the element is absent, so lookup may have to consider the prototype chain and cannot use the same tight path as a packed array.",
        "The animation is not trying to teach a trick for memorizing every V8 internal name. It is teaching the shape of the optimization contract: predictable dense data keeps specialized indexed access alive; mixed or sparse behavior forces safer, slower paths.",
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'V8 distinguishes Smi, double, and object elements, with packed and holey variants for common cases. Smi means small integer. Double arrays can store numbers in a specialized numeric backing store. Object arrays handle arbitrary JavaScript values.',
        'A hole is a missing own element. Holes can come from new Array(n), skipped indexes, delete a[i], or elision literals such as [1,,3]. Holey reads need extra checks because a missing own element may fall through to inherited behavior.',
        'Very sparse arrays can move toward dictionary-style indexed storage. That saves space for far-apart indexes but gives up dense-vector speed.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with `const xs = [1, 2, 3]`. This is the easy case: dense indexes, small integers, and no missing elements. A loop that sums `xs[i]` can be compiled around a compact representation and simple checks.',
        'Now assign `xs[1] = 2.5`. The array still has dense indexes, but the value class changed from small integers to doubles. The engine can still use a numeric representation, but it has lost the Smi-specific assumption. Then assign `xs[2] = { value: 3 }`. The array now needs a general element representation because not every value is a number.',
        'Finally run `delete xs[0]` or create `const ys = [1,,3]`. The array is no longer packed. The missing slot is not the same as a stored undefined. A read from that index must respect JavaScript property lookup semantics, which is why holey arrays are a different category.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The optimized path is safe because it is guarded by the elements kind. If the array is still packed numeric data, the engine can use the numeric path. If a write changes the representation, the kind changes and old assumptions must be rechecked or abandoned.',
        'Holey behavior is correct because the engine does not pretend a missing element is always an ordinary stored value. It preserves JavaScript lookup semantics even when that means extra checks.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The cost is metadata and transitions. Arrays carry kind information and backing stores. Optimized code can run tight loops when the kind is specific, but writes that violate assumptions can force transitions or deoptimization.',
        'When input size doubles, the asymptotic scan is still linear, but the constant factor can change sharply. Dense numeric arrays let each iteration do less work. Holey, mixed, or sparse arrays add checks, general value handling, or dictionary lookup.',
      ],
    },
    {
      heading: 'Developer guidance',
      paragraphs: [
        'For normal application code, the advice is simple: build arrays with `push`, keep hot arrays dense, avoid `delete` on array indexes, avoid far-apart numeric indexes, and do not mix record objects with numeric vectors in the same hot array. These habits also make code easier to read, so they are not engine-specific micro-optimizations masquerading as style.',
        'For performance-sensitive libraries, measure with the target engine and workload. V8 can change details over time, and modern optimizing compilers are complicated. The stable idea is that layout predictability gives the engine room to specialize. The unstable part is exactly which transition costs matter in a specific release.',
        'A practical profiling boundary helps. Do not redesign ordinary arrays because you once read about elements kinds. Start caring when a loop is high in a profile, when array construction happens at scale, or when tracing shows deoptimization near indexed access. At that point, simplify the data shape first: dense construction, consistent value type, no holes, and a separate structure for sparse keys.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Elements kinds matter in hot scans over dense data: chart points, numeric vectors, parsed columns, game state arrays, and repeated loops over record lists.',
        'A charting library is the clean example. If it builds y-values by pushing numbers into a dense array, V8 can keep a specialized path. If it creates holes, deletes entries, and mixes objects into the same array, the scan becomes more general.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not use arrays as sparse dictionaries and expect vector-like speed. Use Map or ordinary objects for keyed sparse data. Do not confuse [undefined] with [,]; the first stores a value, the second leaves a hole.',
        'Exact V8 transition details are not a JavaScript API. The durable lesson is the layout lattice: predictable dense data is easier to optimize than mixed sparse data.',
      ],
    },
    {
      heading: 'What not to overlearn',
      paragraphs: [
        'Elements kinds are not a reason to write strange JavaScript. A readable data model usually matters more than a guessed internal representation. Reach for this knowledge when a hot loop is actually hot, when a library processes large arrays repeatedly, or when profiling shows array access and deoptimization in the path.',
        'The concept also generalizes beyond V8. Databases, vector engines, GPU kernels, and columnar file formats all benefit when values have predictable types and dense layout. V8 elements kinds are one browser-engine version of a broader systems lesson: generic semantics are flexible, but specialization needs stable evidence.',
        'The final lesson is humility about abstraction layers. JavaScript promises array semantics, not a particular storage layout. V8 uses elements kinds to make common cases fast while preserving those semantics. Good code gives the engine clear evidence; it does not depend on undocumented internals as if they were part of the language.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: V8 Elements Kinds at https://v8.dev/blog/elements-kinds, V8 Fast Properties at https://v8.dev/blog/fast-properties, V8 Hidden Classes docs at https://v8.dev/docs/hidden-classes, and JavaScript Engine Fundamentals: Shapes and Inline Caches at https://mathiasbynens.be/notes/shapes-ics. Study V8 Hidden Classes & Inline Caches, Hash Table, SwissTable Hash Map, JavaScript Lexical Environments & Closures, V8 Generational Garbage Collection, and WebAssembly Linear Memory Case Study next.',
      ],
    },
  ],
};
