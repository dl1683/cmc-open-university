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
      heading: 'What it is',
      paragraphs: [
        'V8 array elements kinds are runtime layout tags for JavaScript arrays and integer-indexed properties. JavaScript exposes one Array abstraction, but the engine sees very different optimization cases: packed small integers, packed doubles, packed object values, holey variants, and sparse dictionary-style storage.',
        'This topic continues V8 Hidden Classes & Inline Caches. Hidden classes describe named properties. Elements kinds describe indexed elements. Together they explain why JavaScript objects can behave like flexible dictionaries while hot paths can still get specialized layouts.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'V8 distinguishes Smi, double, and object elements, and each common kind has packed and holey variants. Packed means indexes are present contiguously. Holey means some indexes are missing. V8 can transition from more specific kinds to more general kinds as values are written.',
        'The V8 elements-kinds article describes this as a lattice. A packed Smi array can transition to packed double after a floating-point value appears, then to packed object after an object appears. A packed kind can transition to its holey version after a hole appears. More general kinds reduce the optimizer assumptions available to fast array operations.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost of specificity is bookkeeping. Arrays carry metadata about element layout and backing stores. Optimized code can use that metadata to run tight loops, but writes that violate assumptions may force transitions or deoptimization.',
        'Holey arrays are the classic footgun. A hole is not an explicit undefined. It is a missing own element, so reads need extra checks and may consult the prototype chain. Sparse indexes can push storage away from dense vector-like layout toward dictionary-like storage.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider a charting library that repeatedly scans a million y-values. If the library builds the data as [1, 2, 3] and pushes numbers consistently, the engine can keep a specialized dense numeric path. If it creates new Array(n), leaves gaps, deletes entries, then mixes strings and objects into the same array, the scan path becomes more general and harder to optimize.',
        'The product-level rule is not to micro-optimize every array. It is to separate data roles. Dense numeric vectors should stay dense and numeric. Sparse lookup tables should be Map or object structures. Row objects should be constructed consistently so hidden classes and array elements both remain predictable.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not rely on old exact transition details as permanent API. V8 changes, and the 2025 update to Array.prototype.fill behavior in the V8 article is a reminder that implementation details evolve. The durable lesson is the layout lattice: predictable dense data is easier to optimize than mixed sparse data.',
        'Do not confuse a hole with undefined. [undefined] has an element. [,] has a missing element. Some JavaScript methods treat these cases differently, and engines do too.',
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
