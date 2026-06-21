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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The first view shows a traditional page-table index and a learned CDF model side by side. The page table maps key ranges to pointers. The CDF plot maps every key to its rank in sorted order, with the learned model drawn as an approximation of the true curve. The query marker shows where the model predicts key 58 should live, and the gap between that prediction and the true position is the error the system must correct.',
        {
          type: 'callout',
          text: 'A learned index is a fast position guess wrapped by an exact bounded search.',
        },
        'The second view focuses on failure modes and the correction machinery. Active highlights mark the current prediction or decision. Found highlights mark results that are now confirmed correct. Compare highlights mark the baseline or fallback that would handle the same query without learning.',
        'Watch the error bound step carefully. The model guesses a slot; the bound defines a search window; the local search inside that window recovers the exact answer. That three-step sequence -- predict, bound, search -- is the entire mechanism. If the window is small, the model saved work. If the window is large, the model is overhead.',
      
        {type: 'image', src: './assets/gifs/learned-indexes.gif', alt: 'Animated walkthrough of the learned indexes visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Every database index answers the same question: given a key, where does it live in sorted data? B-trees answer by walking separator keys through a tree of pointers. Binary search answers by halving an array. Both are general -- they work on any key distribution, any data shape, any insert pattern. That generality is the product.',
        {
          type: 'quote',
          text: 'Indexes are models. A B-tree-Index can be seen as a model to map a key to the position of a record within a sorted array, a Hash-Index as a model to map a key to a position of a record within an unsorted array, and a BitMap-Index as a model to indicate if a data record exists or not.',
          attribution: 'Tim Kraska et al., "The Case for Learned Index Structures" (2018)',
        },
        'Kraska observed that most real key sets are not adversarial. Timestamps increase roughly linearly. User IDs cluster. Auto-incremented primary keys are nearly uniform. If 80% of the lookup work is navigating a pattern the data already contains, a model that learns the pattern can skip most of that navigation. The learned index exists because statistical regularity is free information that traditional indexes ignore.',
        'The important promise is modest. The model is not the database. It is a fast first guess. The sorted array, the page layout, or a fallback structure still holds the data and still answers the query. The model just gets you closer to the answer before comparison begins.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a B-tree. It stores separator keys at internal nodes, child pointers that partition the key space, and sorted records at the leaves. Lookup walks from root to leaf in O(log_B n) I/Os, where B is the node fanout. It handles inserts, deletes, and range scans. It is cache-friendly when nodes are sized to fit cache lines or disk pages. Every serious database engine ships one.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg',
          alt: 'B-tree diagram with keys grouped into wide nodes',
          caption: 'A B-tree stores separator keys and child pointers explicitly; a learned index asks whether a model can compress that navigation. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.',
        },
        'B-trees earn their place because they make no assumption about the data. Uniform keys, skewed keys, adversarial keys, keys arriving in any order -- the tree rebalances and the contract holds. That is why they survived fifty years of competition.',
        'The cost of that generality is structural. Every internal node stores separators that describe the key distribution, but it stores them as literal values and pointers, not as a compressed model. A B-tree over 200 million uniformly spaced 64-bit keys still builds millions of internal nodes even though the rank function is almost a straight line. The separators are doing real work, but they are also a verbose encoding of a simple pattern.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall has two faces. The first is memory. B-tree internal nodes consume space proportional to the number of separators. For read-heavy analytic workloads on hundreds of millions of keys, the index can be several gigabytes. Those bytes compete with data pages for cache and RAM. Pointer chasing through tree levels produces cache misses that dominate lookup latency on modern hardware, where a cache miss costs 50-100x more than an arithmetic operation.',
        'The second face is waste. If the key distribution follows a pattern -- nearly linear, piecewise smooth, or clusterable into a few segments -- the B-tree is storing millions of separators to describe something a handful of model parameters could capture. The tree does not know the pattern exists. It cannot exploit it. Every lookup still walks log_B(n) levels regardless of how predictable the next separator is.',
        'There is a third constraint that makes the problem harder: the index has a semantic contract. A lookup for key k must return the exact position of k if it exists, or the insertion point where k would go. A model that predicts "roughly slot 5000" is not an index. It is a guess. The wall is not just about speed -- it is about how to make a guess exact without losing the speed gain.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A learned index treats the sorted key array as defining a cumulative distribution function (CDF). For every key k, CDF(k) = rank(k) / n, a value between 0 and 1 that says what fraction of keys are less than or equal to k. Multiply by n and you get the array position. A model that approximates this CDF can predict the position of any key in one evaluation.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Empirical_CDF%2C_CDF_and_Confidence_Interval_plots_for_various_sample_sizes_of_Normal_Distribution.png/250px-Empirical_CDF%2C_CDF_and_Confidence_Interval_plots_for_various_sample_sizes_of_Normal_Distribution.png',
          alt: 'Empirical CDF step plots approaching a smooth cumulative distribution curve',
          caption: 'A learned index models the key CDF: key values on x, sorted rank on y, with exact search correcting the prediction error. Source: Wikimedia Commons, File:Empirical CDF CDF and confidence interval plots for normal distribution.',
        },
        {
          type: 'diagram',
          label: 'Recursive Model Index (RMI) architecture',
          text: [
            '              query key',
            '                 |',
            '          +------v------+',
            '          | Root Model  |   Stage 0: routes to submodel',
            '          +--+---+---+--+',
            '             |   |   |',
            '       +-----+   |   +-----+',
            '       v         v         v',
            '  +--------+ +--------+ +--------+',
            '  |Model 0 | |Model 1 | |Model 2 |  Stage 1: predicts local CDF',
            '  +---+----+ +---+----+ +---+----+',
            '      |          |          |',
            '      v          v          v',
            '  [keys 0..k] [keys k..m] [keys m..n]  Sorted data segments',
            '      |          |          |',
            '      v          v          v',
            '  error-bounded binary search on segment',
          ].join('\n'),
        },
        'The Recursive Model Index (RMI) from Kraska et al. organizes this into stages. The root model takes a key and predicts which submodel should handle it -- effectively routing the key to a specialist for its range. The leaf-level submodel predicts the position within its segment. Each submodel can be a simple linear regression, a small neural network, or a spline. After prediction, the system performs a local search within the model error bound to find the exact answer.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// Learned CDF lookup with error-bounded binary search',
            'function learnedLookup(key, models, data, maxErrors) {',
            '  // Stage 0: root model routes to submodel',
            '  let modelIdx = Math.min(',
            '    Math.floor(models[0].predict(key) * models.length),',
            '    models.length - 1',
            '  );',
            '',
            '  // Stage 1: submodel predicts position in sorted array',
            '  let predicted = Math.round(models[modelIdx].predict(key));',
            '  predicted = Math.max(0, Math.min(predicted, data.length - 1));',
            '',
            '  // Error-bounded binary search',
            '  let lo = Math.max(0, predicted - maxErrors[modelIdx]);',
            '  let hi = Math.min(data.length - 1, predicted + maxErrors[modelIdx]);',
            '  while (lo < hi) {',
            '    let mid = (lo + hi) >>> 1;',
            '    if (data[mid] < key) lo = mid + 1;',
            '    else hi = mid;',
            '  }',
            '  return data[lo] === key ? lo : -1;',
            '}',
          ].join('\n'),
        },
        'Lookup is three steps: evaluate the model to get a predicted position, clamp to valid bounds and compute the search window from the known maximum error for that segment, then run binary search inside the window. The window size is the key variable. If maxError is 32, the binary search examines at most 5 positions (log2(64)). If maxError is 1 million, the model is not helping.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness does not come from the model. It comes from the search. If the error bound is honest -- if the true position is guaranteed to lie within [predicted - maxError, predicted + maxError] -- then binary search over that interval returns the same answer as binary search over the entire array. The model can be biased, approximate, and trained on a sample. The comparison step is still exact. This is why the approach works even with imperfect models: learning handles navigation, data-structure invariants handle semantics.',
        'The speedup comes from compression. A B-tree over n keys uses O(n / B) internal nodes. A learned index over the same keys might use a root model with a few hundred parameters and a few thousand leaf models with a handful of parameters each -- total model size measured in kilobytes instead of megabytes. If the model fits in L1/L2 cache, prediction is a multiply-add that costs nanoseconds, replacing pointer chases that cost hundreds of nanoseconds each.',
        'The deeper reason this works is that real data has structure. Timestamps are monotonic. Auto-incremented IDs are near-uniform. ZIP codes cluster geographically. The CDF of these distributions is smooth and compressible. A piecewise-linear model with a few hundred segments can approximate a CDF over 200 million keys with maximum error under 128 positions. A B-tree cannot exploit that smoothness -- it stores every separator regardless.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'B-tree: lookup costs O(log_B n) pointer chases, space is O(n / B) internal nodes, and build or sorted insert work follows the tree update path.',
            'Learned index or RMI: lookup is O(1) model evaluation plus O(log maxErr) local search, space is mostly model parameters, and build is a data scan plus model training.',
            'ALEX: lookup is O(1) model evaluation plus local search in gapped arrays, with adaptive splits and higher implementation complexity for updates.',
            'PGM-index: lookup walks a compact tree of piecewise-linear models, space is O(n / epsilon), and build can be done in an optimal linear scan for the chosen error.',
          ],
        },
        'The practical cost of a learned index is model evaluation time plus correction search time. With a two-stage RMI, model evaluation is two multiply-adds -- essentially free. The correction search dominates, and its cost depends entirely on the error bound. If maxError is 64, the binary search takes 6-7 comparisons. If maxError is 8, it takes 3. Compare that to a B-tree over 100 million keys with fanout 128: about 4 levels of pointer chasing, each potentially a cache miss.',
        'The hidden costs are real. Training the model requires a pass over all keys. Maintaining error bounds requires tracking the worst-case prediction per segment. Update handling requires delta buffers, gap arrays, or periodic retraining. Tail latency depends on the worst segment, not the average. A model that averages 4 slots of error but occasionally misses by 50,000 slots is dangerous under a strict latency SLO.',
        'The PGM-index deserves special mention. It builds an optimal piecewise-linear approximation of the CDF with guaranteed maximum error epsilon, then recursively indexes the segment boundaries the same way. The result is a tree of linear models with O(log_epsilon n) lookup and provably minimal space for the chosen error. It combines the learned-index insight with worst-case guarantees that the original RMI lacked.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Learned indexes win on read-heavy workloads over mostly static, sorted data with smooth key distributions. Analytic column stores, time-series databases, dense numeric primary keys, and sorted string stores with predictable prefixes are natural fits. In these settings the model compresses the index by 100x or more while matching or beating B-tree lookup speed.',
        'They win when memory is the bottleneck. If the B-tree index is 4 GB and the learned index is 40 KB, the learned version leaves more RAM for data pages and buffer pool. On embedded devices or in-memory databases where every megabyte matters, that compression is not cosmetic -- it changes what fits in cache.',
        'ALEX, the adaptive learned index (Ding et al., 2020), extends the idea to read-write workloads. It uses gapped arrays that leave slack space for inserts, adaptive node splitting that retrains models when error grows too large, and a tree of model nodes that can restructure without rebuilding the whole index. ALEX demonstrated that learned indexes can handle millions of inserts per second while maintaining lookup performance competitive with B-trees, though at the cost of higher implementation complexity.',
        {
          type: 'note',
          text: 'Google adopted learned indexes in their Bigtable infrastructure. The key observation: for the specific key distributions in production, a few linear models replaced index blocks that consumed significant memory, reducing both space and lookup latency on sorted string tables (SSTables).',
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Learned indexes fail when their assumptions break. Heavy write workloads invalidate the model continuously -- every batch of inserts changes the CDF, growing the error bound until the model is worse than no model at all. The system must retrain, buffer, or restructure, and those operations have real cost. A write-heavy OLTP workload with random inserts will spend more time maintaining the model than a B-tree spends on splits and merges.',
        'Adversarial or pathological key distributions defeat the approach. If keys cluster into dense pockets separated by enormous gaps, the CDF has sharp jumps that no smooth model can approximate cheaply. The error bound for those segments explodes, and the correction search degenerates into scanning. Sparse tails, multi-modal distributions, and keys with no statistical pattern turn the learned index into overhead on top of a fallback structure.',
        {
          type: 'bullets',
          items: [
            'Distribution shift: if the key distribution changes over time (new tenant, schema migration, data backfill), the model becomes stale and error bounds grow silently.',
            'Worst-case latency: the p99 depends on the worst segment error, not the average. Tail-sensitive SLOs need per-segment guarantees, not aggregate metrics.',
            'Concurrency: learned indexes need careful concurrency control during model retraining -- readers must not see a half-trained model with invalid error bounds.',
            'Updatability: the original RMI from Kraska 2018 was read-only. ALEX and LIPP added update support but at significant implementation complexity.',
            'Complexity tax: a B-tree is one well-understood structure. A learned index is a model, a training pipeline, error tracking, a buffer for updates, a fallback structure, and a retraining policy. More can go wrong.',
          ],
        },
        'The organizational failure mode is common. A team benchmarks a learned index on a static dataset, sees a 2x speedup, and deploys it on a mutable table. The first week is fine. After a month of inserts, deletes, and distribution drift, the error bounds have grown, the buffer is large, retraining is expensive, and the system is slower than the B-tree it replaced. The benchmark was not wrong -- the workload assumption was.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Kraska, Beutel, Chi, Dean, Polyzotis. "The Case for Learned Index Structures." SIGMOD 2018. The founding paper. Read it asking: where is the model allowed to be wrong, and what repairs the error?',
            'Ding, Minhas, et al. "ALEX: An Updatable Adaptive Learned Index." SIGMOD 2020. Extends learned indexes to read-write workloads with gapped arrays and adaptive model retraining.',
            'Ferragina and Vinciguerra. "The PGM-index: a fully-dynamic compressed learned index with provable worst-case bounds." VLDB 2020. Optimal piecewise-linear CDF approximation with guaranteed error and O(n) build time.',
            'Galakatos, Markovitch, et al. "FITing-Tree: A Data-aware Index Structure." SIGMOD 2019. Piecewise-linear models with bounded error segments.',
            'Marcus, Kipf, et al. "Benchmarking Learned Indexes." VLDB 2020. Systematic comparison showing when learned indexes beat B-trees and when they do not.',
          ],
        },
        'Study B-trees first -- they define the lookup contract (exact lower_bound, range scan, insert, delete) that any replacement must honor. Then study piecewise linear regression, because that is the model inside most practical learned indexes. After that, study ALEX for the updatability problem, learned Bloom filters for the same idea applied to membership queries, and LSM trees for the write-optimized baseline that learned indexes compete against in write-heavy settings.',
        'The core question to carry forward: when is statistical regularity in data worth exploiting inside a systems primitive, and when does the complexity of exploitation exceed the cost of ignoring it?',
      ],
    },
  ],
};
