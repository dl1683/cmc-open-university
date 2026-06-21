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
      heading: 'Why this exists',
      paragraphs: [
        `A learned index is only useful in a database if its guesses come with a repair budget. The PGM-index exists to make that budget explicit. It compresses a sorted key array into line segments, and every segment promises that its predicted rank is within epsilon of the true rank.`,
        {type: 'callout', text: `PGM is useful because its model is approximate but its correction window is guaranteed.`},
        `The result is not a neural network pretending to be an index. It is a geometric data structure. It observes that a sorted array already defines a function from key to rank, approximates that function with bounded error, and then uses ordinary comparison to finish the query exactly.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The standard solution is a B-tree, a B+ tree, or a sorted array with binary search. These are robust because comparisons decide routing. They handle arbitrary key distributions and do not require a model of the data.`,
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: `Small B-tree diagram with grouped keys in internal nodes`,
          caption: `A B-tree stores explicit separators; PGM replaces many separators with error-bounded line segments over sorted keys. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.`,
        },
        `They can also store more routing information than the distribution deserves. If keys rise almost linearly with rank, many separators are just a verbose way to describe a line. A page directory, fanout tree, or binary-search structure spends memory and cache misses even when the key-to-rank relationship is simple.`,
      ],
    },
    {
      heading: 'Where the obvious approach fails',
      paragraphs: [
        `A single global line fails when different key ranges have different slopes, gaps, or clusters. Real data often has dense regions, sparse regions, and abrupt jumps. A small model without a bound is unsafe because it can predict a rank far from the truth.`,
        `An exact model can also fail by becoming the original index in disguise. If the structure stores too many pieces, it loses the memory advantage. PGM sits at this wall: compress the curve, but keep a worst-case correction window that makes every query exact after local verification.`,
      ],
    },
    {
      heading: 'Core invariant',
      paragraphs: [
        `View sorted keys as points (key, rank). Cover that curve with line segments that stay inside an epsilon-wide vertical band. For any key covered by a segment, the line's predicted rank is at most epsilon positions away from the true rank.`,
        `That is the invariant: prediction narrows the search, comparison preserves exactness. The model is allowed to be approximate only because the data structure keeps a hard correction window around every prediction.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Construction scans the sorted points and keeps the current segment while all covered ranks remain within epsilon of some line. When the next key would violate that band, the algorithm emits a segment and starts a new one. The output is a sorted list of segment start keys and linear models.`,
        `A lookup first finds the segment responsible for the query key. It evaluates the line to predict a rank. It then searches inside the bounded interval around that rank. For predecessor search, the final step is ordinary comparison inside the window. For range search, the index finds the lower-bound position and then scans forward through the sorted array.`,
      ],
    },
    {
      heading: 'Recursive structure',
      paragraphs: [
        `The first-level PGM may still contain many segments. Those segment start keys are sorted, so PGM applies the same idea again: build another PGM over the segment list. The top model predicts which lower-level segment should contain the query.`,
        `This recursion turns a flat segment table into a compact hierarchy. Each level narrows the next lookup, and the final data-level search remains protected by the epsilon guarantee. The index can model its own routing table because that table is also ordered data.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The guarantee is geometric. Each emitted segment is valid only while every covered key stays within the vertical error band. Therefore the true rank of any covered key lies inside the correction window. Ordinary comparison inside that window restores exact lookup, predecessor, and insertion-position behavior.`,
        `This is the important difference from vague learned-index claims. PGM does not ask the database to trust a model because it performed well on average. It builds only segments that satisfy a worst-case error bound, then verifies inside that bound. Approximation is used to save memory and cache misses, not to replace correctness.`,
      ],
    },
    {
      heading: 'Epsilon as the main knob',
      paragraphs: [
        `Epsilon controls the memory and search tradeoff. Larger epsilon stores fewer segments and searches a wider local window. Smaller epsilon stores more segments and searches less locally. The right value depends on cache behavior, branch prediction, local-search implementation, and whether point lookups or range scans dominate.`,
        `The key distribution controls compressibility. Dense linear regions need few segments. Clusters, gaps, and abrupt slope changes need more. The same epsilon can create a tiny index for one table and a much larger one for another, even when both tables have the same row count.`,
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        `A PGM lookup has three costs: find the segment, evaluate the segment line, and search the epsilon window. A recursive PGM reduces segment lookup cost by indexing the segment list. The line evaluation is cheap arithmetic. The final search is bounded by epsilon and can use binary search, linear scan, SIMD search, or a tuned hybrid.`,
        `Space is often the reason to consider PGM. A segment stores a start key and line parameters instead of many individual separators. When the key-to-rank curve is smooth enough, one segment can replace many comparison-tree boundaries.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Keep the sorted array as the source of truth. The PGM should predict positions into that array, not replace it. Clamp predicted windows to array bounds and define duplicate-key behavior carefully: lower bound, upper bound, exact match, and predecessor are different operations.`,
        `Choose the correction search deliberately. For tiny epsilon, a linear scan can beat binary search because it is branch-light and cache-local. For larger windows, binary search or SIMD-assisted search may win. Measure with the actual key distribution rather than assuming one local search strategy is universal.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose a sorted array stores keys [10, 20, 28, 40, 90, 105, 120, 200, 230, 260]. The key-to-rank curve is not one perfect line: the gap between 40 and 90 changes the slope. PGM covers the curve with separate line segments, each required to stay within epsilon ranks of the true positions.`,
        `A query for 112 evaluates the segment that covers the 90 to 120 region and predicts a rank near 5. If epsilon is 2, the exact search checks only a small neighborhood around ranks 3 through 7. Even if the model is slightly wrong, the true predecessor or insertion point is inside that window by construction.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `PGM is strongest for huge sorted arrays whose key-to-rank curve is compressible. It fits immutable table runs, read-heavy analytic stores, search structures, compressed indexes, and memory-sensitive systems where a small learned directory can replace a larger comparison directory.`,
        `It also fits range queries because the sorted array remains intact. The model finds the starting position, then the range scan proceeds in key order. That keeps PGM connected to classic ordered-index behavior instead of making it a point-lookup-only trick.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `If keys look random, the curve needs many segments or wide windows. If writes dominate, dynamic maintenance and rebuilding become the hard problem. PGM is not a neural network dropped into a database; its strength is simple geometry plus explicit verification.`,
        `It is also not automatically better than a B-tree. B-trees are excellent under mixed writes, pages, latches, recovery, and storage hierarchy constraints. PGM is most compelling when a sorted array or immutable run already exists and the index can trade comparison-heavy navigation for model-guided local search.`,
      ],
    },
    {
      heading: 'Relationship to learned indexes',
      paragraphs: [
        `The original learned-index idea framed an index as a model that predicts where a key should be. PGM keeps the attractive part of that idea but makes the contract sharper. The model is not judged only by average error; it is accepted only where its worst-case rank error is bounded.`,
        `That makes PGM easier to reason about as a data structure. A database engineer can ask concrete questions: what is epsilon, how many segments were emitted, how wide is the final correction window, how are updates handled, and what happens when the distribution shifts?`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: PGM-index paper at https://arxiv.org/abs/1910.06169, VLDB PDF at https://www.vldb.org/pvldb/vol13/p1162-ferragina.pdf, project site at https://pgm.di.unipi.it/, and implementation repository at https://github.com/gvinciguerra/PGM-index.`,
        `Study Learned Indexes, B-Trees, B+ Tree Leaf Sibling Scan Case Study, Database Indexing, Binary Search, Eytzinger Layout Binary Search, ALEX Adaptive Learned Index Case Study, Packed Memory Array, and Range Tree topics next. They show the surrounding choices: comparison trees, cache-aware arrays, dynamic learned structures, and ordered range search.`,
      ],
    },
  ],
};
