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
    { heading: 'How to read the animation', paragraphs: [
      'Read the lattice as V8 losing assumptions about an array. Active nodes show the current elements kind, and removed nodes show fast-path promises that are no longer safe.',
      'An elements kind is V8 metadata for indexed array storage. Smi means small integer, double means numeric storage, object means general values, packed means no gaps, and holey means a missing own element may need prototype lookup.',
      {type:'callout', text:'Elements kinds make array performance a guarded layout contract: dense and type-stable data keeps fast paths alive, while holes or mixed values force safer representations.'},
    ] },
    { heading: 'Why this exists', paragraphs: ['JavaScript gives arrays one API, but engines see different physical cases. A dense numeric vector and a sparse keyed collection should not pay the same access cost.'] },
    { heading: 'The obvious approach', paragraphs: ['The simple implementation stores every index as a general property. That handles all language cases, but it wastes the common case where values are dense and type-stable.'] },
    { heading: 'The wall', paragraphs: ['The wall is JavaScript flexibility. One floating-point value, one object value, or one missing index can invalidate the narrow representation that made earlier reads cheap.'] },
    { heading: 'The core insight', paragraphs: ['The core insight is to guard indexed access with a layout tag. When stores break that tag, V8 moves the array toward a more general representation instead of reusing unsafe assumptions.'] },
    { heading: 'How it works', paragraphs: ['A dense small-integer literal can start as packed Smi elements. A floating-point store moves it toward double elements, an object store moves it toward object elements, and a gap moves it toward a holey kind.'] },
    { heading: 'Why it works', paragraphs: ['Correctness comes from guards and transitions. Optimized code uses a narrow path only while the object map and elements kind still prove the expected backing layout.'] },
    { heading: 'Cost and complexity', paragraphs: ['A scan remains O(n), but the constant cost changes. Scanning 10,000 packed numbers can stay near a tight numeric loop, while 10,000 holey or mixed elements add checks and generic handling.'] },
    { heading: 'Real-world uses', paragraphs: ['Elements kinds matter in hot loops over chart data, animation state, parsed numeric columns, and repeated transformations. The useful habit is to build hot arrays densely and keep their value type stable.'] },
    { heading: 'Where it fails', paragraphs: ['Elements kinds are V8 internals, not a JavaScript API. Use this model to interpret profiles, not to write unreadable code for a guessed engine state.'] },
    { heading: 'Worked example', paragraphs: ['Start with four dense small integers and sum indexes 0 through 3. The loop can use a packed Smi path; after storing 2.5, then an object, then making a hole at index 0, the same read must handle broader cases.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: V8 Elements Kinds at https://v8.dev/blog/elements-kinds, V8 Fast Properties at https://v8.dev/blog/fast-properties, and V8 Hidden Classes at https://v8.dev/docs/hidden-classes. Study hidden classes, inline caches, typed arrays, and hash tables next.'] },
  ],
};
