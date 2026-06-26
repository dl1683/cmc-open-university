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
  const numKeys = points.length;
  const minKey = points[0].x;
  const maxKey = points[points.length - 1].x;
  const queryKey = 112;

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
    explanation: `A PGM-index over ${numKeys} sorted keys (${minKey} to ${maxKey}) does not trust a model blindly. The model predicts where key ${queryKey} should sit in sorted order, and the data structure searches only the guaranteed error window around that prediction.`,
    invariant: `Prediction narrows the search across ${numKeys} keys; comparison preserves exactness.`,
  };

  yield {
    state: cdfPlot(),
    highlight: { active: ['seg1', 'seg2'], compare: ['hi', 'lo'], found: ['q'] },
    explanation: `${numKeys} sorted keys from ${minKey} to ${maxKey} form a CDF-like curve: key to rank. The PGM-index covers that curve with the minimum number of linear segments that stay within epsilon error.`,
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
    explanation: `The error bound is the contract. If epsilon is 64, the correction search for key ${queryKey} among ${numKeys} keys never needs to inspect more than a small local window around the predicted position.`,
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
    explanation: `Epsilon is the main knob. For ${numKeys} keys spanning ${minKey} to ${maxKey}, larger epsilon means fewer segments and less index memory, but a wider correction window. Smaller epsilon spends more model space to search less locally.`,
  };
}

function* recursiveModel() {
  const numKeys = points.length;
  const minKey = points[0].x;
  const maxKey = points[points.length - 1].x;

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
    explanation: `The first level over ${numKeys} keys (${minKey} to ${maxKey}) may need many segments. A recursive PGM builds another PGM over those segment start keys, producing a compact hierarchy of learned models.`,
    invariant: `The index can model its own model list — segments over ${numKeys} keys become data for the next level.`,
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
    explanation: `The PGM-index is geometry plus verification. Fit an error-bounded piecewise-linear approximation over ${numKeys} sorted keys, recurse over segment keys, then keep exact search as the final safety net.`,
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
    explanation: `PGM is a learned-index member, but the word learned should not distract from the data-structure guarantee: every segment over the ${numKeys} keys from ${minKey} to ${maxKey} is chosen to stay within an explicit rank error.`,
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
    explanation: `A PGM-index is strongest when sorted keys have structure the model can compress. Our ${numKeys} keys spanning ${minKey} to ${maxKey} have learnable slope changes; random keys with no such shape look more like traditional index territory.`,
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
    { heading: 'How to read the animation', paragraphs: [
        'Read the plot as a function from key to rank. Active line segments are approximate models, and the search window shows the bounded repair work after prediction.',
        {type: 'image', src: './assets/gifs/pgm-index-piecewise-geometric-model.gif', alt: 'Animated walkthrough of the pgm index piecewise geometric model visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ], },
    { heading: 'Why this exists', paragraphs: [
        'A sorted array already maps each key to a rank. PGM exists because that curve is often simpler than a full tree of explicit separators.',
        {type: 'callout', text: `PGM is useful because its model is approximate but its correction window is guaranteed.`},
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a B-tree, B+ tree, or binary search over a sorted array. These are reliable because comparisons, not predictions, decide the final position.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: `Small B-tree diagram with grouped keys in internal nodes`,
          caption: `A B-tree stores explicit separators; PGM replaces many separators with error-bounded line segments over sorted keys. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.`,
        },
      ], },
    { heading: 'The wall', paragraphs: [
        'A B-tree stores separators even when the key distribution is almost linear. A single learned line is unsafe, though, because clusters and gaps can make the predicted rank far from the truth.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Cover the key-to-rank curve with line segments whose vertical error is at most epsilon ranks. The model narrows the search, and exact comparison inside the epsilon window preserves correctness.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Construction scans sorted keys and extends a segment while the covered points fit inside the epsilon band. When the next key violates the band, the builder emits the current segment and starts another.',
        'Lookup finds the segment for the query key, evaluates its line, clamps rank plus or minus epsilon to array bounds, and searches that local window exactly. A recursive PGM builds the same kind of model over the segment start keys.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'A segment is valid only if every covered key has true rank within epsilon of the predicted rank. Therefore the true lower bound or predecessor is inside the correction window, where ordinary comparison returns the exact answer.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Lookup cost is segment lookup plus one line evaluation plus search inside the epsilon window. Larger epsilon means fewer segments and more local search; smaller epsilon means more index memory and less repair work.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'PGM fits read-heavy sorted arrays, immutable table runs, compressed indexes, and analytic stores where memory is tight. It also supports range queries because the source array remains sorted and exact after the starting position is found.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It fails under heavy writes because maintaining error-bounded segments is harder than updating a mutable tree. It also fails when the key distribution is too irregular to compress at a useful epsilon.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Use keys [10, 20, 28, 40, 90, 105, 120, 200, 230, 260] with ranks 0 through 9. A query for 112 might be predicted near rank 5.3 by the segment covering 90 to 120.',
        'With epsilon 2, the correction window covers roughly ranks 3 through 7. Exact search there finds predecessor 105 at rank 5, so the model can be wrong by a little without making the index wrong.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Primary sources are the PGM-index paper at https://arxiv.org/abs/1910.06169, the VLDB version at https://www.vldb.org/pvldb/vol13/p1162-ferragina.pdf, the project site at https://pgm.di.unipi.it/, and the implementation repository at https://github.com/gvinciguerra/PGM-index.',
        'Study Binary Search, B-Trees, Database Indexing, Learned Indexes, Eytzinger Layout Binary Search, ALEX Adaptive Learned Index, and Packed Memory Array next.',
      ], },
  ],
};

