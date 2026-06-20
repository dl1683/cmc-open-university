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
        'The animation has two views. "Lookup and insert" traces a key from root model node through child models into a gapped data node, showing the predict-then-correct pipeline and a gap-based insert. "Adaptation" shows the feedback loop: a crowded data node triggers cost measurement, then either expansion, splitting, or model retraining.',
        {
          type: 'bullets',
          items: [
            'Active nodes are the current decision point: which model is routing, which slot is being searched, or which repair action is being selected.',
            'Found nodes are confirmed outcomes: the slot where a key lands, the retrained model, or the updated parent pointer.',
            'Compare nodes show the alternative being measured against: a dense array without gaps, a static RMI without repair, or a B-tree page split.',
          ],
        },
        'In the matrix views, rows are slots or adaptation triggers, and columns show before/after state or symptom/repair pairs. Watch the gap column: every gap that disappears is write capacity consumed.',
        {
          type: 'note',
          text: 'The animation uses small integer keys (50-100 range) for readability. Real ALEX deployments handle 64-bit keys with millions of records per data node. The data structure is the same -- linear models over gapped sorted arrays -- but the gap density, model error bounds, and split thresholds scale with node size.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'We propose a new framework for designing learned index structures that can effectively support modifications.',
          attribution: 'Ding et al., "ALEX: An Updatable Adaptive Learned Index" (SIGMOD 2020), Section 1',
        },
        'An ordered index maps keys to positions. A B-tree does this with separator keys at internal nodes and sorted records in leaf pages. A learned index replaces those separators with a model trained on the key distribution: given a key, predict its rank in sorted order, jump close, and correct with a short local search.',
        'The first learned index paper (Kraska et al., 2018) showed that models can be faster than B-trees for read-only lookups over static data. The catch: production indexes are not read-only or static. They receive inserts, deletes, updates, and distribution shifts. A dense sorted array has no spare slots for new keys. A model trained on yesterday\'s distribution predicts poorly after today\'s inserts. A static learned index is a fast snapshot, not a living data structure.',
        {
          type: 'table',
          headers: ['Problem', 'What a static learned index lacks', 'What ALEX adds'],
          rows: [
            ['Insert a new key', 'No free slots in dense array; must shift or rebuild', 'Gapped arrays with reserved write capacity'],
            ['Distribution shift', 'Model error grows; correction windows widen', 'Per-node retraining triggered by measured cost'],
            ['Hot region', 'One crowded area degrades entire node', 'Node splitting to isolate hot ranges'],
            ['Capacity exhaustion', 'No policy for when to restructure', 'Cost-based feedback: expand, split, or retrain'],
          ],
        },
        'ALEX exists to close the gap between a learned-index demo and a real data structure. It keeps the model-predicts-position idea but wraps it in gapped storage, adaptive repair, and exact verification -- the machinery any index needs to survive writes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Two baselines bracket the design space.',
        'The traditional baseline is a B+ tree. Internal nodes hold separator keys; leaves hold sorted records in fixed-size pages. When a page fills, it splits. The B+ tree makes no assumptions about key distribution. It handles inserts, deletes, range scans, concurrency, and recovery with decades of battle-tested engineering. The cost: every lookup traverses O(log_B n) levels of branchy comparisons, and the tree does not exploit distributional regularity even when keys are nearly uniform.',
        {
          type: 'diagram',
          text: 'B+ tree lookup for key 73:\n\n  [root: 50 | 80]\n       |         \\\n  [leaf: 50,60]  [leaf: 80,95]\n\n  Compare 73 > 50, 73 < 80 --> go right child\n  Scan leaf: 80, 95 --> 73 not found\n  3 comparisons, 2 pointer chases\n\nStatic learned index lookup for key 73:\n\n  model(73) = position 2.7 --> round to slot 3\n  array[3] = 80, array[2] = 60 --> 73 not found\n  1 model evaluation, 1 local search\n  But: where does 73 go if we want to insert it?',
          label: 'B+ tree handles inserts naturally; a dense learned array does not',
        },
        'The learned-index baseline is a Recursive Model Index (RMI): a hierarchy of models where each level narrows the prediction range, and the bottom level points into a dense sorted array. Lookups can be very fast -- model evaluation is arithmetic, and the final local search is cache-friendly. But the dense array has no room. Inserting key 73 between 60 and 80 means shifting every element after position 2, then rebuilding or patching every model whose predictions depended on the old positions.',
        'The first attempt works beautifully for static data and collapses on the first write-heavy workload.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is not "writes are hard." The wall is that a dense sorted array and a fixed model are coupled in a way that makes local repair impossible.',
        {
          type: 'diagram',
          text: 'Dense array before insert:\n  slot:  [0]  [1]  [2]  [3]  [4]\n  key:    50   60   80   95  100\n  model predicts: position(73) ~ 2.0\n\nInsert 73 into dense array:\n  slot:  [0]  [1]  [2]  [3]  [4]  [5]\n  key:    50   60   73   80   95  100\n  Every key after slot 2 moved right by 1.\n  Model trained on old positions now wrong for 80, 95, 100.\n  position(80) was ~3.0, now should be ~3.0 but 80 is at slot 3\n  after 1000 inserts: model error grows proportional to insert count.',
          label: 'One insert invalidates the model for all keys after it',
        },
        'In a B+ tree, an insert that splits a leaf page affects only that page and its parent. The cost is local. In a dense learned array, an insert shifts elements and invalidates model predictions globally. The model and the layout are rigidly coupled: every positional change requires either retraining the model or tolerating growing error.',
        {
          type: 'note',
          text: 'The deeper issue is that a learned index over a dense array conflates two functions: the model provides the routing decision, and the array provides the storage contract. When one changes (new key inserted), both break simultaneously. ALEX decouples them by giving the storage layer its own slack (gaps) and giving the model its own repair path (retraining).',
        },
        'The exactness requirement makes this harder. A search engine can return approximate results. An ordered-map index must return the exact key or prove absence. A stale model that predicts position 47 when the key is at position 63 is not "close enough" -- it forces a 16-slot linear scan that eliminates the advantage of learning.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'ALEX separates three concerns that a static learned index tangles together: routing (which region holds a key), storage (where keys physically sit and how space is managed), and repair (when and how to fix a degraded region).',
        {
          type: 'diagram',
          text: 'ALEX node architecture:\n\n  Model node (internal):\n    linear model: position = a * key + b\n    routes to child model nodes or data nodes\n    no data stored here -- pure routing\n\n  Data node (leaf):\n    linear model: slot = a * key + b\n    gapped sorted array: [50, _, 60, _, _, 73, _, 80, _, 95]\n    bitmap tracking which slots are occupied\n    stats: density, avg shift distance, search window, insert count\n\n  Key contract:\n    Model predicts a neighborhood.\n    Comparisons find the exact position.\n    Gaps absorb inserts without shifting.',
          label: 'Model nodes route; data nodes store; stats trigger repair',
        },
        'The core invariant: prediction selects a neighborhood; comparison-based search preserves exactness. A wrong prediction costs extra local search but never returns a wrong answer. This is the same contract a B-tree uses (separator keys select a page; in-page search finds the record), but with arithmetic replacing branchy comparisons.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Core ALEX lookup contract (simplified)\nfunction alexLookup(root, key) {\n  let node = root;\n  // Phase 1: model-based routing through internal nodes\n  while (node.type === "model") {\n    const childIndex = Math.floor(node.a * key + node.b);\n    node = node.children[clamp(childIndex, 0, node.children.length - 1)];\n  }\n  // Phase 2: model-based prediction within data node\n  const predicted = Math.floor(node.a * key + node.b);\n  const slot = clamp(predicted, 0, node.capacity - 1);\n  // Phase 3: comparison-based correction (NEVER skipped)\n  return exponentialSearch(node.array, node.bitmap, slot, key);\n}',
        },
        'The second invariant: gaps are managed write capacity, not wasted space. A data node with 50% density has room for roughly as many inserts as it has keys before it needs structural maintenance. The gap density is a tunable parameter that trades memory for insert throughput.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lookup descends through model nodes, each predicting which child range holds the key. At the data node, a local linear model predicts a slot. ALEX searches outward from that slot using exponential search -- checking positions 1, 2, 4, 8, ... slots away -- skipping gaps via a bitmap, until it finds the key or proves absence.',
        {
          type: 'table',
          headers: ['Operation', 'Mechanism', 'Cost when model is accurate', 'Cost when model is stale'],
          rows: [
            ['Point lookup', 'Model predicts slot, exponential search corrects', 'O(log(error)) comparisons, typically 1-3', 'O(log(error)) grows; at error > n/2, worse than binary search'],
            ['Insert', 'Find position, place in nearest gap, shift if needed', 'O(1) if gap is adjacent', 'O(shift_distance); grows as density approaches 1.0'],
            ['Range scan', 'Find start key, walk forward skipping gaps via bitmap', 'O(k + gaps_skipped) for k results', 'Same -- range cost depends on density, not model quality'],
            ['Delete', 'Find key, mark slot as gap, update bitmap', 'O(lookup_cost)', 'Same as lookup; deletion creates gaps (self-healing)'],
          ],
        },
        'An insert finds the lower-bound position, then tries to place the key in the nearest gap. If the gap is adjacent, zero shifts are needed. If the nearest gap is d slots away, d keys must shift by one position. The bitmap tracks occupied slots efficiently.',
        {
          type: 'diagram',
          text: 'Insert key 73 into gapped data node:\n\n  Before:\n  slot:  [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]\n  key:    50   __   60   __   __   80   __   95\n  bitmap:  1    0    1    0    0    1    0    1\n\n  Model predicts slot 4 for key 73.\n  Search finds: slot 3 and 4 are gaps, slot 5 holds 80.\n  73 < 80, so insert at slot 4. No shifts needed.\n\n  After:\n  slot:  [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]\n  key:    50   __   60   __   73   80   __   95\n  bitmap:  1    0    1    0    1    1    0    1\n  Density rose from 4/8 = 50% to 5/8 = 62.5%.',
          label: 'Gap-based insert: zero shifts when a gap is nearby',
        },
        'ALEX monitors four operational signals per data node to decide when repair is needed:',
        {
          type: 'table',
          headers: ['Signal', 'What it measures', 'Threshold triggers'],
          rows: [
            ['Density', 'Fraction of occupied slots', 'Above upper bound (~80%) --> expand or split'],
            ['Shift distance', 'Average keys moved per insert', 'Above cost target --> split the hot region'],
            ['Search window', 'Average correction from predicted slot', 'Above error bound --> retrain local model'],
            ['Insert count', 'Writes since last restructure', 'Sampled for cost estimation; not a direct trigger'],
          ],
        },
        'Expansion allocates a larger array for the same key range, redistributes keys with fresh gaps, and optionally retrains the local model. Splitting divides the key range into two or more new data nodes, each with its own model and gap budget, and updates the parent model node. Retraining fits a new linear model to the current key positions without changing the physical layout.',
        {
          type: 'note',
          text: 'ALEX uses a cost model to choose between expansion and splitting. It estimates the expected cost of future lookups and inserts under each option, given the current key distribution and write rate. The decision is not "is the node full?" but "which restructuring minimizes expected amortized cost per operation?"',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two layers: local exactness and global coverage.',
        'Local exactness: inside every data node, keys are sorted. The model predicts a starting slot, and exponential search with comparisons finds the true position. A wrong prediction widens the search window but cannot return a wrong answer. This is the same guarantee a B-tree leaf provides -- sorted data plus comparison-based search equals exact lookup -- with the model replacing the B-tree separator chain.',
        'Global coverage: model nodes partition the key space into ranges, and every range maps to exactly one data node. When a data node splits, the parent model node updates to reflect the new ranges. The union of all data node ranges covers the full key space without overlap. A key cannot "fall between" nodes.',
        {
          type: 'table',
          headers: ['Invariant', 'How ALEX maintains it', 'What breaks if violated'],
          rows: [
            ['Keys sorted within each data node', 'Inserts placed in correct sorted position; shifts preserve order', 'Lookup returns wrong key or misses existing key'],
            ['Ranges partition key space', 'Splits update parent routing; no range is lost or duplicated', 'Key routed to wrong node; lookup fails on existing key'],
            ['Gaps tracked by bitmap', 'Every insert/delete updates bitmap atomically with array', 'Search walks into uninitialized memory; silent corruption'],
            ['Model error bounded per node', 'Retraining triggered when search window exceeds threshold', 'Exponential search degrades to O(n); learned advantage lost'],
          ],
        },
        'The design works because errors are local. A bad model in one data node does not affect other nodes. A hot insert region can be split without rebuilding the index. A stale model can be retrained without moving data. This locality is the same property that makes B-trees practical: most maintenance is bounded to a path, not broadcast to the whole structure.',
        {
          type: 'quote',
          text: 'ALEX uses a cost model that considers both the short-term cost of the current data node layout and the long-term cost based on expected future operations.',
          attribution: 'Ding et al., "ALEX: An Updatable Adaptive Learned Index" (SIGMOD 2020), Section 5',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Operation', 'Best case', 'Typical case', 'Worst case', 'Condition for worst case'],
          rows: [
            ['Point lookup', 'O(1)', 'O(log(model_error))', 'O(n) per node', 'Model completely stale; error ~ node size'],
            ['Insert', 'O(1)', 'O(gap_distance)', 'O(n) shift + restructure', 'Node at 100% density; requires split'],
            ['Range scan (k results)', 'O(k)', 'O(k + gaps_skipped)', 'O(k + n) if very sparse', 'Low density means many gaps to skip'],
            ['Delete', 'O(lookup)', 'O(lookup)', 'O(lookup)', 'Delete just marks gap; no restructuring needed'],
            ['Expand node', '--', 'O(n) for node of size n', 'O(n)', 'Copies all keys to new array with gaps'],
            ['Split node', '--', 'O(n) for node of size n', 'O(n) + parent update', 'Divides keys and retrains both new models'],
          ],
        },
        'Memory footprint: each data node stores keys in a gapped array, so at 50% density the array is 2x the size of a dense array. The bitmap adds 1 bit per slot. Model nodes store two floats (slope and intercept) plus child pointers. For key-dense workloads, ALEX uses 1.5-3x the memory of a dense sorted array, trading space for insert throughput.',
        'When n doubles, the number of data nodes roughly doubles (each covers a fixed-size key range), and the model-node tree grows by one level. Lookup cost depends on model accuracy, not tree depth, so doubling n does not necessarily add a comparison -- it depends on whether the distribution remains learnable at the new scale.',
        {
          type: 'note',
          text: 'The ALEX paper benchmarks show 1.5-4.8x faster lookups than a B+ tree on datasets with learnable distributions (longitude, timestamps, log-normal), and comparable or slower performance on adversarial distributions (uniform random, highly skewed). Memory usage is 2-5x higher than a B+ tree. The tradeoff is explicit: ALEX spends memory to buy speed when the distribution cooperates.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a data node through its lifecycle: initial load, inserts, degradation, and repair.',
        {
          type: 'diagram',
          text: 'Phase 1: Bulk load\n  Keys to load: [50, 60, 80, 95]\n  Allocate array of size 8 (density target: 50%)\n  Train linear model: slot = 0.08 * key - 3.5\n\n  Result:\n  slot:  [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]\n  key:    50   __   60   __   __   80   __   95\n  Model predictions: 50-->0.5, 60-->1.3, 80-->2.9, 95-->4.1\n  Max error after rounding: 1 slot. Healthy.',
          label: 'Initial state: 50% density, model error within 1 slot',
        },
        {
          type: 'diagram',
          text: 'Phase 2: Six inserts near key 73\n  Insert 73: model predicts slot 2.3 --> slot 4 is gap --> placed at 4\n  Insert 70: model predicts slot 2.1 --> slot 3 is gap --> placed at 3\n  Insert 75: model predicts slot 2.5 --> no adjacent gap --> shift 80 right\n  Insert 71: model predicts slot 2.2 --> no gap near 2 --> shift needed\n  Insert 74: shift needed again\n  Insert 76: shift needed again\n\n  After 6 inserts:\n  slot:  [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]  [8]  [9]\n  key:    50   60   70   71   73   74   75   76   80   95\n  Density: 10/10 = 100%. No gaps remain.\n  Model error: predicts 73 at slot 2.3, actual slot is 4. Error = 2.\n  Avg shift distance on last 4 inserts: 2.5 slots.',
          label: 'After 6 clustered inserts: density 100%, model stale, shifts growing',
        },
        {
          type: 'table',
          headers: ['Signal', 'Value', 'Threshold', 'Status'],
          rows: [
            ['Density', '100%', '> 80%', 'TRIGGERED'],
            ['Avg shift distance', '2.5', '> 2.0', 'TRIGGERED'],
            ['Model error (max)', '2 slots', '> 3 slots', 'OK'],
            ['Insert count since restructure', '6', 'sampled', '--'],
          ],
        },
        'The cost model compares two options. Expansion: allocate a 20-slot array, redistribute 10 keys at 50% density, retrain the model. Estimated cost per future insert: 0.3 shifts. Splitting: divide at key 74 into two nodes of 5 keys each, each at 50% density in a 10-slot array. Estimated cost per future insert: 0.2 shifts, but two model evaluations per lookup that crosses the boundary.',
        'For a uniformly hot region, splitting is cheaper because it isolates the dense subrange. ALEX splits at key 74:',
        {
          type: 'diagram',
          text: 'Phase 3: Split at key 74\n\n  Node A (keys < 74):\n  slot:  [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]  [8]  [9]\n  key:    50   __   60   __   70   __   71   __   73   __\n  Model retrained: slot = 0.17 * key - 7.8\n  Density: 50%. Five gaps available.\n\n  Node B (keys >= 74):\n  slot:  [0]  [1]  [2]  [3]  [4]  [5]  [6]  [7]  [8]  [9]\n  key:    74   __   75   __   76   __   80   __   95   __\n  Model retrained: slot = 0.38 * key - 27.7\n  Density: 50%. Five gaps available.\n\n  Parent model node updated: keys < 74 --> Node A, keys >= 74 --> Node B.',
          label: 'After split: two healthy nodes, each at 50% density with fresh models',
        },
        'Total cost of the split: copy 10 keys into two new arrays, train two linear models (two least-squares fits over 5 points each), update one parent pointer. Future inserts in the 70-76 range now land in a node with room to absorb them.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['Use case', 'Why ALEX fits', 'Key distribution property'],
          rows: [
            ['In-memory timestamp index', 'Timestamps are monotonically increasing; linear model fits well; gapped arrays absorb append-heavy writes', 'Nearly linear CDF'],
            ['Geospatial key index (longitude/latitude)', 'Coordinates cluster by region; models learn regional density; splits isolate hot cities', 'Piecewise smooth CDF'],
            ['Log-structured merge tree read cache', 'Read-optimized layer over recently compacted data; model accelerates point lookups between compactions', 'Sorted post-compaction; stable between merges'],
            ['In-memory OLAP column index', 'Sorted column values for range predicates; learned model replaces binary search; read-dominant workload', 'Domain-specific but often learnable'],
          ],
        },
        'Microsoft released a C++ implementation (github.com/microsoft/ALEX) positioned as a drop-in replacement for std::map and std::multimap. The API is an ordered key-value map with insert, lookup, delete, lower_bound, upper_bound, and range iteration. The implementation is single-threaded and in-memory -- it targets the niche where B-tree overhead is measurable and the key distribution is learnable.',
        {
          type: 'note',
          text: 'The SIGMOD 2020 paper benchmarks ALEX against a B+ tree, a static RMI, and an ART (Adaptive Radix Tree) on four real-world datasets: longitudes, longlats, log-normal, and YCSB traces. ALEX wins on read-heavy and balanced workloads over learnable distributions. It loses on write-heavy adversarial distributions where the model provides no advantage and the gapped array wastes memory.',
        },
        'The broader lesson matters more than the specific system. ALEX demonstrated that learned indexes can handle writes, which changed the research conversation from "can models replace B-trees for static data?" to "what repair machinery makes learned placement practical?" Every subsequent updatable learned index (LIPP, FINEdex, updatable PGM variants) builds on or reacts to this framing.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Adversarial distributions: if keys are hashed, encrypted, or drawn from a distribution that no simple model can fit, prediction error is as large as the node. Every lookup degrades to linear scan, and the model is pure overhead compared to a B-tree separator.',
            'Moving hot spots: if the write-heavy region shifts continuously (e.g., a sliding time window that also receives out-of-order corrections), ALEX splits and retrains repeatedly. The restructuring cost can dominate throughput.',
            'Concurrency: the open-source ALEX implementation is single-threaded. A concurrent version needs latching or lock-free protocols for splits, expansions, and model retraining while readers are active. This is solvable (FINEdex and concurrent learned index papers address it) but not free.',
            'Crash recovery: ALEX does not log structural changes. A crash during a split can leave the index inconsistent. Production use requires write-ahead logging for splits, expansions, and model updates -- the same machinery a B-tree already has.',
            'Memory overhead: at 50% gap density, the array is 2x a dense layout. For large datasets where memory is the bottleneck, the learned advantage may not justify the memory cost compared to a well-tuned B+ tree with page compression.',
            'Tail latency: a foreground insert that triggers a split pays the full restructuring cost synchronously. In latency-sensitive systems, this spike can violate SLOs even if average insert time is fast.',
          ],
        },
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Mitigation'],
          rows: [
            ['Unlearnable keys', 'Search window ~ node size', 'Fall back to B-tree or ART for those key ranges'],
            ['Write avalanche', 'Continuous splits; throughput drops below B-tree', 'Buffer inserts in an append log; batch-apply to ALEX periodically'],
            ['Memory pressure', 'RSS 2-3x a dense index', 'Raise density threshold (trade insert speed for memory)'],
            ['Tail latency spikes', 'p99 >> p50 on inserts', 'Background restructuring with copy-on-write node replacement'],
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'table',
          headers: ['Source', 'What it covers'],
          rows: [
            ['Ding et al., "ALEX: An Updatable Adaptive Learned Index" (SIGMOD 2020), arxiv:1905.08898', 'Original paper: gapped array design, cost model, adaptation policy, benchmarks against B+tree and ART'],
            ['github.com/microsoft/ALEX', 'Reference C++ implementation: std::map-compatible API, single-threaded, in-memory'],
            ['Microsoft Research tech report (MSR-TR-2019-17)', 'Extended version with additional benchmarks and design rationale'],
            ['Kraska et al., "The Case for Learned Index Structures" (SIGMOD 2018)', 'The static learned index paper that ALEX extends -- required prerequisite'],
            ['Ding et al., ACM DOI: 10.1145/3318464.3389711', 'Published conference version with peer review context'],
          ],
        },
        {
          type: 'bullets',
          items: [
            'Prerequisite: study Learned Indexes for the static model-as-index idea that ALEX makes dynamic, and Binary Search for the comparison-based correction that every learned index still depends on.',
            'Storage layer: study Packed Memory Array Gapped Order for the gapped-array technique ALEX uses inside data nodes, and B-Trees for the traditional ordered-index design ALEX competes with.',
            'Alternatives: study PGM-Index: Piecewise Geometric Model for a different learned-index approach using piecewise linear segments with error guarantees, and Adaptive Radix Tree for a non-learned adaptive index that also avoids fixed-width nodes.',
            'Production context: study Database Indexing for the broader indexing landscape, B+ Tree Leaf Sibling Scan for the range-scan pattern ALEX preserves, and Bw-Tree Delta Chain and Mapping Table for a different approach to latch-free index updates.',
          ],
        },
      ],
    },
  ],
};

