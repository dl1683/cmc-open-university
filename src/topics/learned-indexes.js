// Learned indexes: treat an index as a model that predicts where a key should
// appear in sorted data, then bound the model error with a local search.

import { matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'learned-indexes',
  title: 'Learned Indexes',
  category: 'Data Structures',
  summary: 'Replace part of a B-tree with a model: predict a key position in sorted data, then search inside the model error bound.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['CDF model index', 'error bounds and fallback'], defaultValue: 'CDF model index' },
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

function cdfPlot(title) {
  return plotState({
    axes: {
      x: { label: 'key', min: 0, max: 100 },
      y: { label: 'position', min: 0, max: 10 },
    },
    series: [
      {
        id: 'true',
        label: 'true CDF',
        points: [
          { x: 3, y: 0 },
          { x: 10, y: 1 },
          { x: 18, y: 2 },
          { x: 33, y: 3 },
          { x: 40, y: 4 },
          { x: 58, y: 5 },
          { x: 61, y: 6 },
          { x: 78, y: 7 },
          { x: 86, y: 8 },
          { x: 95, y: 9 },
        ],
      },
      {
        id: 'model',
        label: 'learned model',
        points: [
          { x: 3, y: 0.2 },
          { x: 18, y: 1.9 },
          { x: 40, y: 4.1 },
          { x: 61, y: 6.0 },
          { x: 86, y: 8.3 },
          { x: 95, y: 9.1 },
        ],
      },
    ],
    markers: [
      { id: 'query', x: 58, y: 5.2, label: 'key 58' },
      { id: 'pred', x: 58, y: 5.5, label: 'predicted slot' },
    ],
  }, { title });
}

function* cdfModelIndex() {
  yield {
    state: labelMatrix(
      'Traditional index maps key ranges to pages',
      [
        { id: 'page0', label: 'page 0' },
        { id: 'page1', label: 'page 1' },
        { id: 'page2', label: 'page 2' },
        { id: 'page3', label: 'page 3' },
      ],
      [
        { id: 'low', label: 'low key' },
        { id: 'high', label: 'high key' },
        { id: 'pointer', label: 'page pointer' },
      ],
      [
        ['3', '18', 'P0'],
        ['33', '40', 'P1'],
        ['58', '61', 'P2'],
        ['78', '95', 'P3'],
      ],
    ),
    highlight: { active: ['page2:low', 'page2:high', 'page2:pointer'], compare: ['page0:pointer'] },
    explanation: `A B-tree index stores separators and pointers. A ${topic.title.toLowerCase()} starts from the observation that this is a model: given a key, predict where it should live in sorted data.`,
  };

  yield {
    state: cdfPlot('A learned index approximates the key CDF'),
    highlight: { active: ['model', 'query', 'pred'], found: ['true'] },
    explanation: `If keys are sorted, their cumulative distribution function maps key -> rank. ${topic.title} can learn that mapping and predict the approximate position of a lookup key.`,
    invariant: `For ${topic.title.toLowerCase()}, the prediction is useful only if the error is bounded or corrected.`,
  };

  yield {
    state: labelMatrix(
      'Lookup key 58',
      [
        { id: 'predict', label: 'predict' },
        { id: 'bound', label: 'error bound' },
        { id: 'search', label: 'local search' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'position', label: 'position' },
      ],
      [
        ['model(key)', '5.5'],
        ['known max error', '+/- 2 slots'],
        ['binary/linear search', 'slots 4-7'],
        ['find lower bound', 'slot 5'],
      ],
    ),
    highlight: { active: ['predict:position', 'bound:position'], found: ['result:position'] },
    explanation: `The model does not need to be perfect — for key ${58} it predicts slot ${'5.5'} with error bound ${'±2'}. The system then searches inside a bounded window to recover exact ${topic.category.toLowerCase()} semantics.`,
  };

  yield {
    state: labelMatrix(
      'Recursive learned index idea',
      [
        { id: 'root', label: 'root model' },
        { id: 'expert1', label: 'expert model 1' },
        { id: 'expert2', label: 'expert model 2' },
        { id: 'fallback', label: 'fallback index' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['route key range', 'bad routing if distribution shifts'],
        ['predict local CDF', 'needs error bound'],
        ['predict local CDF', 'needs error bound'],
        ['exact search structure', 'more memory'],
      ],
    ),
    highlight: { found: ['root:job', 'expert1:job', 'fallback:job'], compare: ['root:risk'] },
    explanation: `A ${topic.title.toLowerCase().replace('indexes', 'index')} can be a hierarchy of models. The ${'root'} chooses a specialized model for the key range; the leaf model predicts position; a ${'fallback'} search preserves correctness.`,
  };
}

function* errorBoundsAndFallback() {
  yield {
    state: cdfPlot('Model error decides the search window'),
    highlight: { active: ['model', 'pred'], compare: ['true'], found: ['query'] },
    explanation: `The ${topic.title.toLowerCase().replace('indexes', 'index')} is profitable only when prediction error is small relative to a traditional page search. A bad model just moves cost from ${'pointer chasing'} to correction work.`,
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'shift', label: 'distribution shift' },
        { id: 'updates', label: 'many inserts' },
        { id: 'tail', label: 'rare key range' },
        { id: 'guarantee', label: 'exact guarantee' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['error grows', 'retrain or fallback'],
        ['model becomes stale', 'buffer + rebuild'],
        ['large local error', 'specialized model'],
        ['model can be wrong', 'bounded local search'],
      ],
    ),
    highlight: { active: ['shift:symptom', 'updates:symptom'], found: ['guarantee:repair'] },
    explanation: `The database cannot trust the model alone. ${topic.title} need error bounds, retraining policy, update handling, and exact verification after prediction.`,
  };

  yield {
    state: labelMatrix(
      'Learned structures family',
      [
        { id: 'range', label: 'range index' },
        { id: 'hash', label: 'hash index' },
        { id: 'filter', label: 'learned filter' },
        { id: 'traditional', label: 'traditional fallback' },
      ],
      [
        { id: 'model', label: 'model predicts' },
        { id: 'must_preserve', label: 'must preserve' },
      ],
      [
        ['key rank', 'lower_bound correctness'],
        ['bucket/position', 'collision handling'],
        ['membership probability', 'false-negative control'],
        ['exact rules', 'semantic contract'],
      ],
    ),
    highlight: { found: ['range:model', 'filter:model'], compare: ['traditional:must_preserve'] },
    explanation: `The broad ${topic.category.toLowerCase()} idea is larger than B-trees: treat an index component as a learned predictor, then wrap it in systems machinery that preserves the original ${'semantic contract'}.`,
  };

  yield {
    state: labelMatrix(
      'When it is worth considering',
      [
        { id: 'static', label: 'mostly static keys' },
        { id: 'smooth', label: 'smooth distribution' },
        { id: 'hot', label: 'hot updates' },
        { id: 'strict', label: 'strict latency SLO' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'model stays valid'],
        ['strong', 'small error windows'],
        ['weak', 'retraining and buffers'],
        ['measure first', 'tail errors matter'],
      ],
    ),
    highlight: { found: ['static:fit', 'smooth:fit'], compare: ['hot:reason', 'strict:reason'] },
    explanation: `${topic.title} are a systems tradeoff, not a blanket replacement. The workload decides whether prediction beats a tuned B-tree.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'CDF model index') yield* cdfModelIndex();
  else if (view === 'error bounds and fallback') yield* errorBoundsAndFallback();
  else throw new InputError('Pick a learned-index view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
        'The CDF-model view compares a traditional page index with a learned model that predicts the rank of a key in sorted data. The query marker for key 58 shows the predicted slot, and the correction window shows how far the model may be wrong.',
        {
          type: 'callout',
          text: 'A learned index is a fast position guess wrapped by an exact bounded search.',
        },
        'The error-bounds view is the important one. Active marks show a prediction, compare marks show the true curve or fallback, and found marks show the exact answer after local search.',
        'Read the sequence as predict, bound, search. If the bound is small, the model saved work; if the bound is large, the model became overhead.',
      
        {type: 'image', src: './assets/gifs/learned-indexes.gif', alt: 'Animated walkthrough of the learned indexes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},], },
    { heading: 'Why this exists', paragraphs: [
        'An index maps a key to where that key should be found. A B-tree stores separators and pointers explicitly, but on smooth key distributions those separators can be a verbose encoding of a simple pattern.',
        'A learned index exists because many sorted key sets have structure: timestamps increase, IDs are nearly linear, and strings share prefixes. A model can predict approximate position, while exact search preserves the database contract.',
      ], },
    { heading: 'The obvious approach', paragraphs: [
        'The obvious approach is a B-tree. It stores wide nodes of separator keys and child pointers, walks from root to leaf, and supports lookup, range scan, insert, and delete.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: 'B-tree diagram with keys grouped into wide nodes',
          caption: 'A B-tree stores separator keys and child pointers explicitly; a learned index asks whether a model can compress that navigation. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.',
        },
        'B-trees are strong because they make few assumptions. Uniform keys, skewed keys, inserts, deletes, and adversarial orderings all preserve the contract through rebalancing.',
      ], },
    { heading: 'The wall', paragraphs: [
        'The wall is memory and pointer chasing. A B-tree over hundreds of millions of sorted keys can spend gigabytes on internal pages, and each lookup may pay multiple cache misses before reaching data.',
        'If the key-rank function is almost a straight line, those internal pages are describing a pattern that a few parameters could approximate. The challenge is that approximate position is not enough for an exact index.',
      ], },
    { heading: 'The core insight', paragraphs: [
        'Sorted keys define an empirical cumulative distribution function, or CDF. For key k, the CDF tells what fraction of keys are less than or equal to k, and multiplying by n gives an approximate rank.',
        'The model is allowed to be wrong only inside a known error window. Correctness comes from searching that window, not from trusting the model.',
      ], },
    { heading: 'How it works', paragraphs: [
        'Train a model to map key to position in a sorted array. At lookup, evaluate the model, clamp the predicted position to array bounds, and search from predicted minus maxError to predicted plus maxError.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Empirical_CDF%2C_CDF_and_Confidence_Interval_plots_for_various_sample_sizes_of_Normal_Distribution.png/250px-Empirical_CDF%2C_CDF_and_Confidence_Interval_plots_for_various_sample_sizes_of_Normal_Distribution.png',
          alt: 'Empirical CDF step plots approaching a smooth cumulative distribution curve',
          caption: 'A learned index models the key CDF: key values on x, sorted rank on y, with exact search correcting the prediction error. Source: Wikimedia Commons, File:Empirical CDF CDF and confidence interval plots for normal distribution.',
        },
        'A Recursive Model Index adds a root model that routes keys to specialized leaf models. Each leaf has its own error bound, so smooth regions use tiny windows and difficult regions get tighter local treatment or fallback.',
      ], },
    { heading: 'Why it works', paragraphs: [
        'The correctness invariant is that the true lower_bound position lies inside the recorded window. Binary search inside that interval returns the same answer as binary search over the full array, just with fewer comparisons when the interval is small.',
        'The speedup comes from compressing navigation. A multiply-add or small model evaluation can replace several pointer chases, and the model may fit in cache even when the B-tree internal nodes do not.',
      ], },
    { heading: 'Cost and complexity', paragraphs: [
        'Lookup cost is model evaluation plus O(log maxError) local search. If maxError is 64, the correction search needs about 7 comparisons; if maxError is 1,000,000, the model is worse than a good tree.',
        'Build cost includes scanning keys, training or fitting models, measuring worst-case error, and storing fallback metadata. Update cost is the hard part because inserts change the CDF and can make error bounds stale.',
      ], },
    { heading: 'Real-world uses', paragraphs: [
        'Learned indexes fit mostly static sorted data with smooth distributions: time-series stores, analytic column stores, sorted string tables, dense numeric primary keys, and memory-constrained read-heavy systems. They are attractive when the ordinary index consumes cache space that could hold data.',
        'ALEX, PGM-index, FITing-Tree, and related systems show different ways to add update handling or provable error. The common move is the same: model the CDF and bound the correction.',
      ], },
    { heading: 'Where it fails', paragraphs: [
        'It fails when the distribution shifts quickly or writes dominate. Frequent inserts, deletes, tenant migrations, and backfills change the CDF faster than a static model can follow.',
        'It also fails when tail error matters more than average error. A model with average error 4 but one segment error 50,000 can violate a strict latency SLO even if most lookups look excellent.',
      ], },
    { heading: 'Worked example', paragraphs: [
        'Suppose 1,000,000 sorted keys are nearly linear: key 0 maps near slot 0 and key 1,000,000 maps near slot 999,999. A model predicts position = 0.999 x key, and measured max error for its segment is 32 slots.',
        'For key 500,000, the model predicts slot 499,500. The index searches slots 499,468 through 499,532, a window of 65 positions, so binary search needs at most 7 comparisons.',
        'A B-tree with fanout 128 over 1,000,000 keys has about 3 to 4 tree levels. If those levels miss cache and the learned model fits in cache, the learned lookup can win; if the error window grows to 50,000 slots, it loses.',
      ], },
    { heading: 'Sources and study next', paragraphs: [
        'Sources: Kraska et al., "The Case for Learned Index Structures"; Ding et al., "ALEX"; Ferragina and Vinciguerra on PGM-index; FITing-Tree; and learned-index benchmarking work. Read them around the correction window, not just the model architecture.',
        'Study B-trees, binary search, piecewise linear regression, LSM trees, learned Bloom filters, calibration, and workload benchmarking. The question is when statistical regularity is cheaper than storing explicit navigation.',
      ], },
  ],
};
