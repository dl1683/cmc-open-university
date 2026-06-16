// PGM-index: approximate the sorted-key CDF with error-bounded line segments,
// then correct inside a small search window.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'pgm-index-piecewise-geometric-model',
  title: 'PGM-Index: Piecewise Geometric Model',
  category: 'Data Structures',
  summary: 'A learned-index structure with guarantees: fit piecewise linear models to sorted keys, predict rank within epsilon, then search a bounded window.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['epsilon search', 'recursive model'], defaultValue: 'epsilon search' },
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

const points = [
  { x: 10, y: 0 }, { x: 20, y: 1 }, { x: 28, y: 2 }, { x: 40, y: 3 },
  { x: 90, y: 4 }, { x: 105, y: 5 }, { x: 120, y: 6 }, { x: 200, y: 7 },
  { x: 230, y: 8 }, { x: 260, y: 9 },
];

function cdfPlot() {
  return plotState({
    axes: { x: { label: 'key', min: 0, max: 280 }, y: { label: 'rank', min: 0, max: 10 } },
    series: [
      { id: 'keys', label: 'sorted keys', points },
      { id: 'seg1', label: 'segment 1', points: [{ x: 10, y: 0 }, { x: 40, y: 3 }] },
      { id: 'seg2', label: 'segment 2', points: [{ x: 90, y: 4 }, { x: 260, y: 9 }] },
      { id: 'hi', label: '+epsilon', points: [{ x: 10, y: 1 }, { x: 40, y: 4 }, { x: 90, y: 5 }, { x: 260, y: 10 }] },
      { id: 'lo', label: '-epsilon', points: [{ x: 10, y: 0 }, { x: 40, y: 2 }, { x: 90, y: 3 }, { x: 260, y: 8 }] },
    ],
    markers: [{ id: 'q', label: 'query', x: 112, y: 5.3 }],
  });
}

function* epsilonSearch() {
  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.8, y: 4.0, note: '112' },
        { id: 'model', label: 'line', x: 2.6, y: 4.0, note: 'predict' },
        { id: 'rank', label: 'rank', x: 4.4, y: 4.0, note: '5 +/- e' },
        { id: 'window', label: 'window', x: 6.3, y: 4.0, note: 'local' },
        { id: 'search', label: 'search', x: 8.2, y: 4.0, note: 'exact' },
      ],
      edges: [
        { id: 'e-key-model', from: 'key', to: 'model' },
        { id: 'e-model-rank', from: 'model', to: 'rank' },
        { id: 'e-rank-window', from: 'rank', to: 'window' },
        { id: 'e-window-search', from: 'window', to: 'search' },
      ],
    }, { title: 'PGM predicts position, then verifies locally' }),
    highlight: { active: ['model', 'rank', 'window'], found: ['search'] },
    explanation: 'A PGM-index does not trust a model blindly. The model predicts where a key should sit in sorted order, and the data structure searches only the guaranteed error window around that prediction.',
    invariant: 'Prediction narrows the search; comparison preserves exactness.',
  };

  yield {
    state: cdfPlot(),
    highlight: { active: ['seg1', 'seg2'], compare: ['hi', 'lo'], found: ['q'] },
    explanation: 'Sorted keys form a CDF-like curve: key to rank. The PGM-index covers that curve with the minimum number of linear segments that stay within epsilon error.',
  };

  yield {
    state: labelMatrix(
      'Epsilon search window',
      [
        { id: 'predict', label: 'predict rank' },
        { id: 'window', label: 'window' },
        { id: 'verify', label: 'verify' },
        { id: 'miss', label: 'miss' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'guarantee', label: 'guarantee' },
      ],
      [
        ['line(key)', 'approx rank'],
        ['rank +/- epsilon', 'bounded'],
        ['binary search', 'exact'],
        ['insertion point', 'predecessor'],
      ],
    ),
    highlight: { found: ['window:guarantee', 'verify:guarantee'], active: ['predict:operation'] },
    explanation: 'The error bound is the contract. If epsilon is 64, the correction search never needs to inspect more than a small local window around the predicted position.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'epsilon', min: 4, max: 256 }, y: { label: 'segments needed', min: 0, max: 120 } },
      series: [
        { id: 'space', label: 'index space', points: [{ x: 4, y: 110 }, { x: 16, y: 52 }, { x: 64, y: 18 }, { x: 256, y: 6 }] },
        { id: 'search', label: 'search work', points: [{ x: 4, y: 8 }, { x: 16, y: 15 }, { x: 64, y: 32 }, { x: 256, y: 80 }] },
      ],
    }),
    highlight: { active: ['space'], compare: ['search'] },
    explanation: 'Epsilon is the main knob. Larger epsilon means fewer segments and less index memory, but a wider correction window. Smaller epsilon spends more model space to search less locally.',
  };
}

function* recursiveModel() {
  yield {
    state: graphState({
      nodes: [
        { id: 'root', label: 'top', x: 0.8, y: 4.0, note: 'model of models' },
        { id: 's0', label: 'seg A', x: 2.8, y: 5.4, note: 'keys low' },
        { id: 's1', label: 'seg B', x: 4.8, y: 4.0, note: 'keys mid' },
        { id: 's2', label: 'seg C', x: 6.8, y: 2.6, note: 'keys high' },
        { id: 'data', label: 'array', x: 8.5, y: 4.0, note: 'sorted' },
      ],
      edges: [
        { id: 'e-root-s0', from: 'root', to: 's0' },
        { id: 'e-root-s1', from: 'root', to: 's1' },
        { id: 'e-root-s2', from: 'root', to: 's2' },
        { id: 'e-s1-data', from: 's1', to: 'data' },
      ],
    }, { title: 'Recursive PGM indexes the segment list too' }),
    highlight: { active: ['root', 's1'], found: ['data'] },
    explanation: 'The first level stores many segments. A recursive PGM builds another PGM over those segment start keys, producing a compact hierarchy of learned models.',
    invariant: 'The index can model its own model list.',
  };

  yield {
    state: labelMatrix(
      'Build pipeline',
      [
        { id: 'sort', label: 'sorted keys' },
        { id: 'fit', label: 'fit segments' },
        { id: 'recurse', label: 'recurse' },
        { id: 'query', label: 'query' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'result', label: 'result' },
      ],
      [
        ['key -> rank', 'points'],
        ['epsilon PLA', 'segments'],
        ['index segments', 'levels'],
        ['predict+correct', 'exact'],
      ],
    ),
    highlight: { found: ['fit:result', 'query:result'], active: ['recurse:step'] },
    explanation: 'The PGM-index is geometry plus verification. Fit an error-bounded piecewise-linear approximation, recurse over segment keys, then keep exact search as the final safety net.',
  };

  yield {
    state: labelMatrix(
      'PGM versus neighbors',
      [
        { id: 'btree', label: 'B-tree' },
        { id: 'learned', label: 'learned index' },
        { id: 'pgm', label: 'PGM' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'contract', label: 'contract' },
      ],
      [
        ['separators', 'page search'],
        ['model', 'verify window'],
        ['segments', 'epsilon bound'],
      ],
    ),
    highlight: { found: ['pgm:stores', 'pgm:contract'], compare: ['btree:contract', 'learned:contract'] },
    explanation: 'PGM is a learned-index member, but the word learned should not distract from the data-structure guarantee: every segment is chosen to stay within an explicit rank error.',
  };

  yield {
    state: labelMatrix(
      'Where it fits',
      [
        { id: 'static', label: 'static sorted' },
        { id: 'range', label: 'range query' },
        { id: 'memory', label: 'memory tight' },
        { id: 'write', label: 'heavy writes' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['excellent', 'learn once'],
        ['good', 'predecessor'],
        ['excellent', 'few segments'],
        ['careful', 'dynamic variant'],
      ],
    ),
    highlight: { active: ['static:fit', 'memory:fit'], compare: ['write:fit'] },
    explanation: 'A PGM-index is strongest when sorted keys have structure the model can compress. Random keys with no learnable shape look more like traditional index territory.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'epsilon search') yield* epsilonSearch();
  else if (view === 'recursive model') yield* recursiveModel();
  else throw new InputError('Pick a PGM-index view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The PGM-index, or Piecewise Geometric Model index, is a learned index with explicit worst-case bounds. It indexes a sorted array by modeling the relationship between key value and rank. Instead of storing many B-tree separators, it stores line segments that predict where a key should be.',
        'The critical detail is epsilon. Each segment approximates the key-to-rank curve within a chosen error bound. At query time, the model predicts a position, then ordinary comparison searches inside the epsilon window. The model narrows the work; the correction search keeps the result exact.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Take sorted keys and view them as points: x is the key, y is its rank in the array. The construction covers those points with the fewest line segments that stay within epsilon vertical error. Each segment stores enough information to map a key to an approximate rank. If the key is absent, the local search returns the predecessor or insertion position.',
        'The index can be recursive. The segment start keys are themselves sorted, so another smaller PGM can index the segment list. This produces a hierarchy of simple models ending in a bounded local search over the original sorted data. The result is learned, but still fully checked.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The main knob is epsilon. A larger epsilon usually reduces the number of stored segments but increases the final correction window. A smaller epsilon stores more segments and searches less locally. The real performance depends on key distribution, cache behavior, branch prediction, SIMD-friendly searches, updates, and whether the workload is point-heavy or range-heavy.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'Ferragina and Vinciguerra present PGM as a compressed learned data structure for lookup, predecessor, range searches, and updates over huge sorted arrays. The project documentation emphasizes arrays of billions of items and the goal of orders-of-magnitude less space than traditional indexes while preserving worst-case query-time guarantees. This makes PGM a good bridge between Learned Indexes and production Database Indexing.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A PGM-index is not a neural network dropped into a database. Its power comes from geometry and an error contract. If the key distribution has little regularity, the index needs many segments or wider windows. If writes dominate, dynamic maintenance becomes the hard part. Also, a model prediction is not an answer: every lookup must verify by comparison inside the promised window.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: PGM-index paper at https://arxiv.org/abs/1910.06169, VLDB PDF at https://www.vldb.org/pvldb/vol13/p1162-ferragina.pdf, project site at https://pgm.di.unipi.it/, and implementation repository at https://github.com/gvinciguerra/PGM-index. Study Learned Indexes, B-Trees, Database Indexing, Binary Search, and ALEX-style dynamic learned indexes next.',
      ],
    },
  ],
};
