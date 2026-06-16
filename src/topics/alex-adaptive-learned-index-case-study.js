// ALEX: an adaptive learned index that adds update machinery around learned
// position models so inserts and range queries remain practical.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'alex-adaptive-learned-index-case-study',
  title: 'ALEX Adaptive Learned Index Case Study',
  category: 'Data Structures',
  summary: 'A dynamic learned-index case study: model nodes route by key, data nodes keep gapped arrays, and hot regions split or retrain as writes arrive.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lookup and insert', 'adaptation'], defaultValue: 'lookup and insert' },
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

function* lookupAndInsert() {
  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.8, y: 4.0, note: '73' },
        { id: 'root', label: 'model', x: 2.5, y: 4.0, note: 'route' },
        { id: 'child', label: 'model', x: 4.3, y: 4.0, note: 'range' },
        { id: 'data', label: 'data', x: 6.2, y: 4.0, note: 'gapped' },
        { id: 'slot', label: 'slot', x: 8.2, y: 4.0, note: 'search' },
      ],
      edges: [
        { id: 'e-key-root', from: 'key', to: 'root' },
        { id: 'e-root-child', from: 'root', to: 'child' },
        { id: 'e-child-data', from: 'child', to: 'data' },
        { id: 'e-data-slot', from: 'data', to: 'slot' },
      ],
    }, { title: 'ALEX routes through models into gapped data nodes' }),
    highlight: { active: ['root', 'child', 'data'], found: ['slot'] },
    explanation: 'ALEX keeps the learned-index idea but adds update machinery. Model nodes predict which child or data node should hold a key; data nodes store sorted keys in arrays with gaps for future inserts.',
    invariant: 'The model chooses a neighborhood; comparisons preserve exactness.',
  };

  yield {
    state: labelMatrix(
      'Data node with gaps',
      [
        { id: 'p0', label: 'slot 0' },
        { id: 'p1', label: 'slot 1' },
        { id: 'p2', label: 'slot 2' },
        { id: 'p3', label: 'slot 3' },
        { id: 'p4', label: 'slot 4' },
      ],
      [
        { id: 'before', label: 'before' },
        { id: 'after', label: 'after insert 73' },
      ],
      [
        ['50', '50'],
        ['60', '60'],
        ['gap', '73'],
        ['80', '80'],
        ['gap', 'gap'],
      ],
    ),
    highlight: { found: ['p2:after'], active: ['p2:before'] },
    explanation: 'A data node is more than a dense sorted array. It reserves gaps so inserts near the predicted position can often land without shifting the entire node.',
  };

  yield {
    state: labelMatrix(
      'Lookup and insert contract',
      [
        { id: 'predict', label: 'predict' },
        { id: 'correct', label: 'correct' },
        { id: 'insert', label: 'insert' },
        { id: 'split', label: 'split' },
      ],
      [
        { id: 'step', label: 'step' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['model output', 'fast guess'],
        ['local search', 'exact key'],
        ['use gap', 'cheap write'],
        ['rebuild node', 'crowded'],
      ],
    ),
    highlight: { found: ['correct:reason', 'insert:reason'], compare: ['split:reason'] },
    explanation: 'The structure remains exact because every prediction is checked. The adaptive part is deciding when local inserts are cheap enough and when a node needs expansion, retraining, or splitting.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'node density', min: 0, max: 100 }, y: { label: 'insert cost', min: 0, max: 100 } },
      series: [
        { id: 'gap', label: 'with gaps', points: [{ x: 10, y: 8 }, { x: 40, y: 12 }, { x: 70, y: 26 }, { x: 95, y: 80 }] },
        { id: 'dense', label: 'dense array', points: [{ x: 10, y: 12 }, { x: 40, y: 38 }, { x: 70, y: 65 }, { x: 95, y: 95 }] },
      ],
    }),
    highlight: { active: ['gap'], compare: ['dense'] },
    explanation: 'Gaps delay expensive shifts, but they are not infinite. When a node becomes dense or the model error grows, ALEX pays a structural maintenance cost.',
  };
}

function* adaptation() {
  yield {
    state: graphState({
      nodes: [
        { id: 'node', label: 'data node', x: 0.8, y: 4.0, note: 'crowded' },
        { id: 'stats', label: 'stats', x: 2.6, y: 4.0, note: 'cost' },
        { id: 'expand', label: 'expand', x: 4.4, y: 5.2, note: 'more gaps' },
        { id: 'split', label: 'split', x: 4.4, y: 2.8, note: 'two nodes' },
        { id: 'model', label: 'retrain', x: 6.4, y: 4.0, note: 'better fit' },
        { id: 'root', label: 'parent', x: 8.4, y: 4.0, note: 'update' },
      ],
      edges: [
        { id: 'e-node-stats', from: 'node', to: 'stats' },
        { id: 'e-stats-expand', from: 'stats', to: 'expand' },
        { id: 'e-stats-split', from: 'stats', to: 'split' },
        { id: 'e-expand-model', from: 'expand', to: 'model' },
        { id: 'e-split-model', from: 'split', to: 'model' },
        { id: 'e-model-root', from: 'model', to: 'root' },
      ],
    }, { title: 'ALEX adapts nodes when the workload changes' }),
    highlight: { active: ['stats', 'expand', 'split'], found: ['model'] },
    explanation: 'Dynamic learned indexes need feedback. ALEX monitors data-node costs and can expand, split, or retrain when the node no longer matches the local key distribution.',
    invariant: 'Learning is useful only with repair machinery around it.',
  };

  yield {
    state: labelMatrix(
      'Adaptation triggers',
      [
        { id: 'density', label: 'high density' },
        { id: 'shifts', label: 'long shifts' },
        { id: 'error', label: 'model error' },
        { id: 'skew', label: 'hot range' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['few gaps', 'expand'],
        ['insert cost', 'split'],
        ['wide search', 'retrain'],
        ['many writes', 'rebalance'],
      ],
    ),
    highlight: { found: ['density:repair', 'error:repair'], active: ['shifts:symptom', 'skew:symptom'] },
    explanation: 'The system watches operational symptoms, not just model loss. Insert shifts, density, and local search cost decide whether the structure should change.',
  };

  yield {
    state: labelMatrix(
      'ALEX versus neighbors',
      [
        { id: 'btree', label: 'B-tree' },
        { id: 'rmi', label: 'static RMI' },
        { id: 'pgm', label: 'PGM' },
        { id: 'alex', label: 'ALEX' },
      ],
      [
        { id: 'read', label: 'read path' },
        { id: 'write', label: 'write path' },
      ],
      [
        ['page search', 'split pages'],
        ['model+window', 'limited'],
        ['segments+epsilon', 'variants'],
        ['models+gaps', 'adaptive'],
      ],
    ),
    highlight: { found: ['alex:read', 'alex:write'], compare: ['rmi:write', 'pgm:write'] },
    explanation: 'ALEX is important because it attacked the complaint against early learned indexes: static data is too easy. Real indexes need inserts, deletes, and changing distributions.',
  };

  yield {
    state: labelMatrix(
      'Engineering lessons',
      [
        { id: 'model', label: 'model' },
        { id: 'layout', label: 'layout' },
        { id: 'adapt', label: 'adapt' },
        { id: 'verify', label: 'verify' },
      ],
      [
        { id: 'lesson', label: 'lesson' },
        { id: 'mistake', label: 'mistake' },
      ],
      [
        ['predict locality', 'trust blindly'],
        ['reserve slack', 'dense only'],
        ['monitor cost', 'train once'],
        ['compare exact', 'approx answer'],
      ],
    ),
    highlight: { found: ['model:lesson', 'layout:lesson', 'adapt:lesson', 'verify:lesson'] },
    explanation: 'The pattern generalizes: learned data structures work when a model is wrapped by exact checks, local repair, and layout choices that match the workload.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lookup and insert') yield* lookupAndInsert();
  else if (view === 'adaptation') yield* adaptation();
  else throw new InputError('Pick an ALEX view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'ALEX, short for Adaptive Learned Index, is a dynamic range index that wraps learned position models in the machinery needed for real updates. Earlier learned-index demos often assumed static, read-only arrays. ALEX targets mixed workloads with point lookups, short range queries, inserts, updates, and deletes.',
        'The structure resembles a tree of model nodes and data nodes. Model nodes predict which child range should contain a key. Data nodes store sorted keys and payloads in arrays with gaps. The model gives a predicted position; local search and comparison preserve exact map semantics.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lookup descends through model nodes until it reaches a data node. Inside the data node, the local model predicts a slot, then the implementation searches nearby to find the exact key or insertion point. Insertions use reserved gaps when possible. When a data node becomes crowded or predictions become expensive to correct, ALEX can expand, split, or retrain.',
        'That adaptation is the case-study lesson. Learned indexes are not just models; they are model-guided storage layouts with cost monitors, repair policies, and exact fallback. The prediction is allowed to be wrong, but it must be bounded enough that correction remains cheap.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'ALEX trades traditional separator pages for models and gapped arrays. Reads can be fast when the key distribution is learnable and the local correction window stays small. Writes stay practical by using gaps and local adaptation, but maintenance is not free. Bad distributions, hot insert regions, frequent splits, or poor parameter choices can erase the advantage over a B-tree.',
      ],
    },
    {
      heading: 'Real-world case study',
      paragraphs: [
        'The SIGMOD 2020 ALEX paper presents it as an updatable learned index for read-write workloads and reports strong performance and memory results against B+ trees and earlier learned indexes on evaluated workloads. Microsoft released a C++ implementation whose README describes ALEX as an ML-enhanced range index similar in functionality to a B+ tree and close to a drop-in replacement for std::map or std::multimap.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'ALEX does not make learned indexes universally better. It works when prediction reduces enough search and memory work to pay for model evaluation, gap management, and adaptation. It also does not return approximate answers: exact comparison still decides lookup and insertion. Compare it with Bw-Tree Delta Chain & Mapping Table to separate learned placement from concurrency-control and page-publication design. The broader lesson is the same as PGM-Index: Piecewise Geometric Model and Learned Indexes: models help only when the data structure preserves its contract.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: ALEX arXiv paper at https://arxiv.org/abs/1905.08898, ACM DOI at https://dl.acm.org/doi/10.1145/3318464.3389711, Microsoft Research page at https://www.microsoft.com/en-us/research/publication/msr-alex-techreport/, and implementation at https://github.com/microsoft/ALEX. Study Learned Indexes, PGM-Index: Piecewise Geometric Model, B-Trees, Database Indexing, and Binary Search next.',
      ],
    },
  ],
};
