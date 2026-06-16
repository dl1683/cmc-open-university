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
    explanation: 'A B-tree index stores separators and pointers. A learned index starts from the observation that this is a model: given a key, predict where it should live in sorted data.',
  };

  yield {
    state: cdfPlot('A learned index approximates the key CDF'),
    highlight: { active: ['model', 'query', 'pred'], found: ['true'] },
    explanation: 'If keys are sorted, their cumulative distribution function maps key -> rank. A model can learn that mapping and predict the approximate position of a lookup key.',
    invariant: 'The prediction is useful only if the error is bounded or corrected.',
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
    explanation: 'The model does not need to be perfect. It only needs to put the search near the answer. The system then searches inside a bounded window to recover exact index semantics.',
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
    explanation: 'A learned index can be a hierarchy of models. The root chooses a specialized model for the key range; the leaf model predicts position; a fallback search preserves correctness.',
  };
}

function* errorBoundsAndFallback() {
  yield {
    state: cdfPlot('Model error decides the search window'),
    highlight: { active: ['model', 'pred'], compare: ['true'], found: ['query'] },
    explanation: 'The learned index is profitable only when prediction error is small relative to a traditional page search. A bad model just moves cost from pointer chasing to correction work.',
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
    explanation: 'The database cannot trust the model alone. It needs error bounds, retraining policy, update handling, and exact verification after prediction.',
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
    explanation: 'The broad idea is larger than B-trees: treat an index component as a learned predictor, then wrap it in systems machinery that preserves the original contract.',
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
    explanation: 'Learned indexes are a systems tradeoff, not a blanket replacement. The workload decides whether prediction beats a tuned B-tree.',
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
    {
      heading: 'What it is',
      paragraphs: [
        'A learned index treats an index as a prediction problem. For a sorted array, the model predicts the position of a key, usually by approximating the cumulative distribution of keys. The system then searches inside a bounded error window to recover exact behavior.',
        'The idea is important because it reframes core data structures as models with contracts. B-Trees, hash indexes, and Bloom filters can be seen as prediction mechanisms plus correction logic.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For range lookup, train a model that maps key to approximate rank. At query time, predict the position, use a known error bound to choose a local search window, and verify the result with ordinary comparison. A recursive learned index can route ranges to specialized submodels.',
        'The model is not the source of truth. The exact search window, fallback index, update buffer, and retraining policy preserve semantics when the model is imperfect.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Learned indexes can reduce memory and branchy pointer chasing when key distributions are stable and learnable. They can fail under distribution shift, heavy updates, adversarial keys, or tail-latency constraints. Training, error measurement, rebuild policy, and correctness fallback are part of the data structure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Learned indexing ideas influence database research, storage engines, learned Bloom filters, vector search routing, and hybrid systems where model predictions guide exact structures. They are most natural for mostly static, sorted, read-heavy datasets.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A learned index is not allowed to be "mostly correct" if it replaces a database index. The model can predict, but the system must verify. Another misconception is that neural networks are required; simple piecewise linear models are often the practical baseline.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: arXiv paper at https://arxiv.org/abs/1712.01208, ACM DOI at https://dl.acm.org/doi/10.1145/3183713.3196909, and Cambridge-hosted PDF at https://www.cl.cam.ac.uk/~ey204/teaching/ACS/R244_2018_2019/papers/Kraska_SIGMOD_2018.pdf. Study B-Trees (How Databases Read), Database Indexing, Bloom Filter, Quotient Filter, Logistic Regression, and K-Means Clustering next.',
      ],
    },
  ],
};
