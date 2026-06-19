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
      heading: 'How to read the animation',
      paragraphs: [
        "Read the animation as the execution trace for ALEX Adaptive Learned Index Case Study. A dynamic learned-index case study: model nodes route by key, data nodes keep gapped arrays, and hot regions split or retrain as writes arrive..",
        "Active items are the current decision point. Visited markers are state that is already ruled out by proof, not by taste.",
        "Found markers are outcomes now guaranteed true. If this is not visible, the animation can mislead.",
        "At each frame, ask what changed, why that move is legal, and where the idea is strong or fragile.",
      ],
    },
    {
      heading: `Why this exists`,
      paragraphs: [
        `Learned indexes start from a provocative observation: an ordered index is partly a prediction problem. Given a key, the index predicts where that key should appear in sorted order. A B-tree predicts coarsely with separator keys. A learned index can predict with a model trained on the key distribution. If the model is accurate, lookup can jump close to the answer and use only a short local correction.`,
        `ALEX exists because the first version of that story was too static. It is impressive to learn positions in a sorted array, but production indexes receive inserts, updates, deletes, point lookups, and range scans while the data distribution changes. A static learned model over a dense sorted array has no good answer when new keys arrive. It can predict a position, but it cannot create space, update local error bounds, or decide when the layout is no longer healthy.`,
        `ALEX, the Adaptive Learned Index, is important because it treats the learned model as one part of an index rather than the whole index. It adds gapped data nodes, adaptive expansion, splitting, retraining, and exact verification around the model. The lesson is broader than ALEX itself: learned data structures become practical only when prediction is wrapped in storage machinery that survives change.`
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The robust baseline is a B+ tree or a balanced-tree ordered map. It does not assume keys are smooth, linear, or easy to learn. Internal nodes route by separators, leaf pages store sorted records, and page splits create space when a region fills. It is not glamorous, but it handles updates, range scans, recovery, and concurrency with a long history of engineering practice.`,
        `The obvious learned-index baseline is simpler: train a model from key to array position over a sorted dense array. A lookup evaluates the model, searches around the predicted position, and verifies the answer with comparisons. This can be very fast for read-mostly data with a learnable distribution. It also explains why learned indexes are attractive: the model can replace many branchy comparisons with arithmetic and cache-friendly local search.`,
        `The first attempt fails on writes. A dense array has no spare slots. Inserting a key near the middle requires shifting many items or rebuilding. The model also becomes stale as inserted keys change the local shape of the distribution. A fast static predictor is not enough; the index needs a layout and repair policy.`
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The wall is dynamic maintenance. An index must preserve exact ordered-map semantics while keys arrive in uneven patterns. If many inserts land near one predicted position, the local array region becomes crowded. If a model was trained on yesterday\'s distribution, its prediction error can grow today. If the repair policy is too aggressive, the index spends all its time rebuilding. If it is too lazy, lookup windows and insert shifts grow until the learned index loses its advantage.`,
        `This is a data-structure problem, not just a machine-learning problem. The model answers "where should this key probably be?" The storage layer must answer "where can it go now, how far must existing keys move, when should this node split, and how do range scans remain sorted?" ALEX\'s contribution is to make those storage answers part of the learned-index design.`,
        `The exactness requirement is also non-negotiable. A search index may rank approximate matches, but an ordered map cannot return the wrong key because the model guessed well on average. Every prediction needs a comparison-based correction path. The model can reduce work; it cannot replace the final proof that the key is present or absent.`
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `ALEX separates routing, storage, and repair. Model nodes route a key toward a child range. Data nodes store sorted records in arrays with deliberate gaps. Each data node has a local model that predicts a position inside that node, and the node uses local search plus comparisons to find the exact key or insertion point. When the node becomes crowded or the model becomes inaccurate, the index adapts the node instead of pretending the original prediction surface is permanent.`,
        `The core invariant is: prediction chooses a neighborhood; comparisons preserve exactness. That invariant keeps ALEX from becoming an approximate index. A wrong prediction costs extra local search, but it does not corrupt the answer. A crowded node costs shifts or repair, but it does not break sorted order.`,
        `The second invariant is slack must be managed as a resource. Gaps are not wasted space by accident. They are reserved write capacity. ALEX spends memory to reduce insert movement, then monitors whether that slack is still in the right places.`
      ],
    },
    {
      heading: `Lookup and insert path`,
      paragraphs: [
        `A lookup begins at the root model node. The model maps the search key to a child pointer or child range. The process repeats until it reaches a data node. Inside the data node, a local model predicts a slot. ALEX then searches around that slot to find the key or the lower-bound position where the key would belong.`,
        `An insert follows the same route. After the lower-bound position is found, the data node tries to place the new key into a nearby gap while preserving sorted order. If a gap is close, the insert can be much cheaper than shifting a dense array. If no useful gap remains, the node may expand, split, or rebuild its layout. This is why ALEX is not just a model: the gapped array is doing real data-structure work.`,
        `Range scans depend on the same sorted-node contract. Once the first key is found, the scan can walk forward through records and across neighboring data nodes. The model helps locate the start, but the sorted layout makes the range result exact and ordered.`
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `ALEX monitors operational symptoms rather than only model loss. Important signals include node density, insert shift distance, local search cost, model error, and hot ranges where many writes cluster. These symptoms tell the index whether the current bargain is still working: a little extra memory for gaps, a little local search for model error, and occasional repair for long-term health.`,
        `Expansion adds more space to a data node and redistributes records with gaps. It is useful when the model is still acceptable but the node is too dense. Splitting divides a node into smaller ranges, which can isolate a hot region or reduce search and shift costs. Retraining updates a model when the key-to-position relationship has changed enough that correction windows are too wide.`,
        `The hard part is choosing when to pay the repair cost. Rebuilding too late creates slow operations and bad tail latency. Rebuilding too early wastes CPU and memory bandwidth. ALEX is therefore a feedback-controlled index: it uses local cost measurements to decide when prediction, layout, or both need repair.`
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `ALEX works when the key distribution is learnable enough that predictions land near the true position and stable enough that repairs are not constant. In that regime, model evaluation can replace several pointer-heavy tree steps, and a gapped data node can absorb inserts without shifting a full dense array. The model gives locality; the gaps give write capacity; the comparisons give correctness.`,
        `The design also works because errors are local. A bad prediction in one data node does not poison the whole index. It widens local search or triggers local repair. A hot insert range can be split without rebuilding the entire structure. That locality is the same reason B-trees work well: most maintenance is bounded to a page or path. ALEX keeps that discipline while changing the routing and node layout.`,
        `The exactness proof is simple at the interface level. Keys remain sorted inside data nodes. Model nodes route to ranges that cover the key space. After prediction, local comparison finds the lower bound. As long as splits and expansions preserve range boundaries and sorted order, lookup and range scan semantics match an ordered index even when the model is imperfect.`
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `ALEX trades separator pages for models, gapped arrays, and repair policy. Reads can be fast when model error is low and data nodes stay cache-friendly. Writes can be fast when gaps are available near insert positions. Range scans can remain efficient because records are sorted inside and across data nodes.`,
        `The costs are memory slack, model storage, repair work, and policy complexity. Reserved gaps increase memory footprint. Model evaluation and correction add code paths that a plain B-tree does not have. Expansion and splitting consume CPU and memory bandwidth. Tail latency can suffer if a foreground operation triggers a large repair.`,
        `The engineering comparison with B-trees is sober. B-trees have decades of work on latching, logging, recovery, buffer management, compression, and concurrent scans. ALEX shows a promising in-memory range-index design, but bringing the pattern into a full database index means solving all the ordinary database problems in addition to learned placement.`
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `ALEX is strongest for in-memory ordered indexes where keys have a learnable distribution, reads and range scans are common, and writes are present but not so adversarial that every local model is constantly invalidated. It is a good fit when the workload benefits from cache-friendly arrays and when extra memory for gaps is acceptable.`,
        `The SIGMOD 2020 paper presents ALEX as an updatable learned index for read-write workloads. Microsoft released a C++ implementation that describes ALEX as an ML-enhanced range index with B+ tree-like functionality and a near drop-in role for std::map or std::multimap-style use cases. That framing is useful: ALEX is not a classifier bolted onto a database. It is an ordered range index with learned routing and adaptive storage.`,
        `It also wins as a teaching case. It shows the difference between a learned algorithm demo and a real data structure. The model is interesting, but the decisive ideas are exact correction, slack management, local repair, and feedback from measured operation cost.`
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `ALEX is not universally better than a B-tree. If keys are nearly random, highly jagged, encrypted, hashed, or distributed in a way the model cannot learn, prediction windows grow and the learned layer becomes overhead. If writes concentrate in a moving hot spot, the structure may spend too much time expanding, splitting, and retraining.`,
        `It also has production risks outside the core paper algorithm. Concurrent updates require careful synchronization. Recovery requires logging enough structure changes to rebuild a consistent index after a crash. Memory reclamation matters if nodes are replaced while readers are active. Tail latency matters if a user request pays for a repair. None of these problems disappear because the routing function is learned.`,
        `The most common misconception is to compare average lookup speed only. A serious comparison includes inserts, deletes, range scans, memory footprint, build time, update amplification, p99 latency, skewed workloads, and mixed read-write traces. Learned indexes are systems, not just curves on a static array.`
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Start with exact ordered-map behavior before optimizing. Implement lower-bound verification, sorted data-node invariants, range boundary checks, and tests that compare every operation against a reference map. The model path should be allowed to be wrong about position but never wrong about membership or order.`,
        `Make repair decisions observable. Track per-node density, average and maximum shift distance, local search window, insert count, split count, expansion count, and retraining cost. Without those metrics, tuning becomes guesswork. Expose them in benchmarks and logs so bad distributions are visible rather than hidden behind average throughput.`,
        `Keep repair operations safe and bounded. Splits must update parent routing atomically. Expansions must preserve sorted order and gap metadata. Retraining must not publish a model that routes outside the node\'s key range. If the implementation is concurrent, readers need a stable view while nodes are replaced or repaired.`
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `Suppose a data node covers keys from 50 to 100 and currently stores 50, 60, 80, and 95 with gaps between them. A lookup for 73 descends through model nodes, lands in that data node, predicts a slot near the gap between 60 and 80, and uses local comparison to decide that 73 is absent but should be inserted before 80.`,
        `If a gap is available near that position, the insert can move only a few records or none at all. Later, many new keys arrive near 73: 70, 71, 72, 74, 75, 76. The nearby gaps disappear, insert shifts grow, and the node\'s local model may become less accurate. ALEX now has evidence that the node\'s original layout is no longer healthy.`,
        `The repair choice depends on the measured pain. If the model still predicts well but slack is gone, expansion can redistribute records with fresh gaps. If the region is hot or the node has become too large, splitting can give the dense subrange its own data node. If the prediction error is the main issue, retraining the local model can shrink future correction windows.`
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary sources: the ALEX arXiv paper at https://arxiv.org/abs/1905.08898, the ACM DOI at https://dl.acm.org/doi/10.1145/3318464.3389711, the Microsoft Research page at https://www.microsoft.com/en-us/research/publication/msr-alex-techreport/, and the implementation at https://github.com/microsoft/ALEX.`,
        `Study Learned Indexes first for the static model-as-index idea. Then study PGM-Index: Piecewise Geometric Model, Packed Memory Array Gapped Order, B-Trees, B+ Tree Leaf Sibling Scan, Database Indexing, Adaptive Radix Tree, Bw-Tree Delta Chain and Mapping Table, and Binary Search. Those topics separate the model, the ordered layout, the update policy, and the production database concerns that ALEX brings together.`
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        "Every topic in this pattern has a hard boundary where a tempting shortcut fails; define that boundary first.",
        "State the exact invariant that must hold, show one operation sequence that can break it, and explain what changes after a failure and why.",
        "If you can reproduce this wall in one example, the rest of the page is motivated.",
      ],
    },


      {
        heading: 'Sources and study next',
        paragraphs: [
          'Read one primary source, one implementation source, and one production case where this idea appears.',
          'If they disagree on a detail, prefer the source with the clearest constraint and define the simplification for this animation.',
          'Then choose three study topics: one prerequisite, one extension, and one case study for your next session.',
        ],
      },

      {
        heading: 'Learning map',
        paragraphs: [
          'Before this topic, unlock all prerequisites and define the required preconditions.',
          'After this topic, trace where this idea appears in one larger path on this site.',
          'Use unlock relationships to keep one path and one checkpoint per review cycle.',
        ],
      },

      {
        heading: 'Micro checks',
        paragraphs: [
          {
            type: 'bullets',
            items: [
              'Can you state one invariant in one sentence?',
              'Can you prove one transition with pre and post state?',
              'Can you name one hidden edge case in one line?',
              'Can you transfer this mechanism to a neighboring domain?',
            ],
          },
        ],
      },

      {
        heading: 'Try this now',
        paragraphs: [
          'Build one input manually and predict every step before running the animation.',
          'If your predicted final state matches the animation for alex-adaptive-learned-index-case-study, continue to the next topic in the same track.'
  ],
      },
],
};

