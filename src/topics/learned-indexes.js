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
      heading: `Why learned indexes exist`,
      paragraphs: [
        `A sorted index answers one question again and again: where should this key appear in sorted order? A B-tree answers by walking separator keys and child pointers. Binary search answers by repeated comparisons. Those are general tools, and they work even when the key distribution is ugly.`,
        `A learned index exists because many real key sets are not ugly. User ids, timestamps, monotonically assigned document ids, and dense numeric keys often have a rank curve that is easy to approximate. If key 40 is usually near the fortieth percent of the array and key 80 is usually near the eightieth percent, the index is carrying a statistical pattern. A model can use that pattern to jump near the answer.`,
        `The important promise is modest. The model is not the database. It is a fast guess for the starting position. The exact data structure is still the sorted array, the searched page, or a fallback index that checks the guess and returns the correct lower_bound result.`,
      ],
    },
    {
      heading: `The baseline and the wall`,
      paragraphs: [
        `The safe baseline is a B-tree or a sorted array with binary search. A B-tree stores separator keys and pointers, keeps leaves in sorted order, and gives O(log n) lookup with good update behavior. It is hard to beat as a general-purpose index because it makes no assumption about the shape of the data.`,
        `The wall appears when that generality is expensive. Pointer chasing hurts caches. Internal nodes consume memory. Branches are hard for the CPU to predict. A tree may store thousands or millions of separators for a key distribution that a tiny line, spline, or piecewise model could describe.`,
        `There is a second wall that learned indexes cannot ignore: exactness. A normal index has a semantic contract. Given a key, it returns the matching row or the insertion position where that row would belong. A model may be wrong, so the design must explain where the mistake is repaired.`,
      ],
    },
    {
      heading: `Core insight and invariant`,
      paragraphs: [
        `The core insight is that a sorted set of keys defines a cumulative distribution function. For every key value, there is an expected rank: how many stored keys are less than or equal to it. A learned index approximates that key-to-rank function.`,
        `The invariant is simple and strict: the final answer must match the answer from the sorted data itself. Prediction can choose a page, a slot, or a short search interval. Comparison still decides the result. If the model predicts slot 5000 and the real lower_bound is slot 5007, the lookup must search far enough to find 5007.`,
        `That makes a learned index a hybrid: model plus correction. Without correction it is only a classifier or regressor. With bounded correction it becomes an index component.`,
      ],
    },
    {
      heading: `How the visual model teaches it`,
      paragraphs: [
        `The first view puts the old idea and the new idea next to each other. The page table shows a traditional range index: a key range points to a page. The plot shows the same problem as a curve: key on the x-axis, sorted position on the y-axis. The true CDF is the exact curve. The learned model is a compressed approximation of it.`,
        `The query marker matters because it separates guessing from verification. The model predicts a slot for key 58, but the exact lookup is not finished at that point. The system searches around that predicted slot and checks the real keys.`,
        `The error-bound view is the practical lesson. The distance between the predicted slot and the true slot becomes a local search budget. If that distance is small and bounded, the model saves work. If it is large or unstable, the fallback index is doing the real job and the learned component is just overhead.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `For a sorted array of n keys, fit a model f(key) that predicts a rank from 0 to n - 1. The simplest model might be a line. A stronger design might use many small piecewise-linear models. A recursive learned index uses a root model to choose a specialized child model for a key range, then uses the child model to predict a local rank.`,
        `Lookup has three steps. First, evaluate the model and clamp the predicted rank to valid array bounds. Second, choose a correction interval using a known maximum error, a per-segment error bound, or a conservative fallback rule. Third, run ordinary lower_bound search inside that interval.`,
        `Updates need separate machinery. Many learned indexes are strongest on static or mostly static data. Inserts can go into a delta buffer, a small side tree, slack space inside pages, or a newly trained segment. Periodic rebuilds fold those changes back into the model. The model should not be allowed to silently age out of its error contract.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The speedup comes from replacing many comparisons and pointer loads with one cheap prediction plus a short local search. If the rank curve is smooth, a small model stands in for many separators. If the model is cache-resident, the CPU may spend less time waiting on memory.`,
        `Correctness comes from a different place. It comes from the correction interval. If the true lower_bound is guaranteed to lie inside the searched interval, then searching that interval gives the same result as searching the whole array. The model can be biased, approximate, and statistically trained; the final comparison step is still exact.`,
        `This split is the main idea to remember. Learning improves navigation. Data-structure invariants preserve semantics.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `Suppose the stored keys are [3, 10, 18, 33, 40, 58, 61, 78, 86, 95]. A model predicts that key 58 belongs near slot 5.5. During training or validation, the index recorded that this model segment is never more than 2 slots wrong.`,
        `The lookup searches slots 4 through 7. Slot 4 holds 40. Slot 5 holds 58. The exact answer is slot 5. If the query is 59, the same interval contains 58 and 61, so lower_bound returns slot 6. The model did not need to understand equality, insertion positions, or database semantics. It only needed to land close enough for normal comparison to finish the job.`,
        `Now change the example. If a rare key range makes the model 2000 slots wrong, the local interval becomes huge. That is not a correctness bug if the bound is honest, but it is a performance failure. The design either needs a better local model for that range or a fallback index that handles it directly.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `A good learned index can reduce index memory, cache misses, branch mispredictions, and tree height. Its lookup cost is roughly model evaluation plus correction search. With a tiny model and a small error bound, that can be very low.`,
        `The hidden costs are training, validation, metadata for error bounds, update buffers, rebuild policy, and fallback code. Tail latency matters more than average error. A model with an average error of 4 slots but a rare error of 50,000 slots can be hard to use under a strict service-level objective.`,
        `Model size is part of the data structure. A neural network that misses cache may lose to a B-tree. A line with a bad fit may make every query search too much. Piecewise-linear models are common because they can capture skew while keeping inference and error accounting simple.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Learned indexes are strongest on read-heavy, mostly static, sorted data with stable distributions. Analytic tables, dense identifiers, time-like keys, sorted object stores, and embedded indexes with tight memory budgets are natural candidates.`,
        `They also work well when the index is large enough that pointer chasing dominates but the key distribution is regular enough for a compact model. In that setting, the model is not a fancy addition. It is a compressed representation of the search path.`,
        `They are especially attractive when the access pattern is dominated by lower_bound, range starts, or page selection. Once the first matching position is found, range scan behavior can be handled by the normal sorted layout.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Learned indexes struggle with heavy writes, sudden distribution shifts, adversarial keys, sparse tails, mixed key types, and workloads where worst-case latency matters more than average speed. If every hour brings a new key distribution, the model is always behind reality.`,
        `They can also fail organizationally. A team may see a benchmark win on a static dataset and then deploy into a mutable table with deletes, late-arriving records, and skewed tenants. The first version still answers correctly if the fallback is sound, but the performance story may collapse.`,
        `A learned index is not a magic replacement for B-trees. It is a bet that prediction is cheaper than navigation for this data and this workload.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Measure error distribution, not only average lookup time. Track max error, percentile error, fallback rate, rebuild frequency, model bytes per key, correction-window bytes read, and tail latency under realistic key mixes.`,
        `Prefer simple models until the workload proves they are not enough. Keep an exact path in the design. Treat retraining as a storage operation with versioning, validation, rollback, and canary checks. If the index serves writes, decide where inserts live before they are absorbed into the learned layout.`,
        `The best mental checklist is: What is the exact contract? Where can the model be wrong? How large is the repair window? What happens after distribution shift? If those questions are fuzzy, the learned index is not production-ready.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study B-Trees and Database Indexing first, because those topics define the exact lookup contract. Then study ALEX Adaptive Learned Index, Learned Bloom Filter, Bloom Filter, Quotient Filter, Piecewise Linear Regression, Logistic Regression, and LSM Tree.`,
        `The main paper is The Case for Learned Index Structures. Read it with one question in mind: where is the learned component allowed to be wrong, and which conventional data-structure component repairs that error?`,
      ],
    },
  ],
};
