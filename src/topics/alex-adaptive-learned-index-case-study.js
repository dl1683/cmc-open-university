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
        'The animation shows a learned ordered index, which means an index that uses a small model to guess where a key belongs in sorted order. Active nodes are the current routing or repair decision. Found nodes are confirmed slots, repaired models, or updated parent links.',
        'In the lookup view, the model does not answer the query by itself. It predicts a neighborhood, then ordinary comparisons prove the exact position. In the adaptation view, density, shift distance, and model error decide whether a data node expands, splits, or retrains.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/4/46/B-tree.svg', alt:'B-tree index structure', caption:'Traditional B-trees use separator keys at internal nodes. ALEX replaces these with learned linear models that predict position directly. Source: Wikimedia Commons, CC BY-SA 3.0'},
        {type:'callout', text:'The first learned index paper (Kraska et al., 2018) showed models can be faster than B-trees for static reads — but production indexes are not static. ALEX is the answer: a learned index that adapts to inserts, deletes, and distribution shifts.'},
        'An ordered index maps a key, such as user id 73, to a position in sorted data. B-trees do this with separator keys and pages. A learned index uses the cumulative distribution of keys, meaning the curve from key value to sorted rank, to predict a position directly.',
        'ALEX exists because static learned indexes break when writes arrive. A model trained on one sorted array can guess well today and drift tomorrow after clustered inserts. A practical index needs spare space, exact correction, and repair rules.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious production approach is a B+ tree. It stores separator keys in internal nodes and sorted records in leaves, then splits a leaf when the leaf fills. It handles inserts reliably because each change is mostly local.',
        'The obvious learned-index approach is a static recursive model index. Train models over a dense sorted array, predict a rank, and search nearby. That can be fast for read-only data, but the dense array has no cheap place to put a new key.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the coupling between model position and physical position. Insert 73 between 60 and 80 in a dense array [50, 60, 80, 95], and every key after the insertion point shifts right. A model that predicted old ranks now has stale targets.',
        'Exact lookup makes this more than a performance problem. An index cannot return a nearby key and call it good. It must find the exact key or prove absence, so every model guess needs a comparison-based correction path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'ALEX separates routing, storage, and repair. Model nodes route keys to a region. Data nodes store sorted keys in arrays with gaps. Local statistics decide when a region should expand, split, or retrain.',
        'The invariant is simple: the model may be wrong about the slot, but it must send the key to a region where comparisons can finish the search. Gaps are not wasted space; they are prepaid write capacity. Repair keeps model error and shift cost local instead of global.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A lookup evaluates one or more linear models, such as slot = a * key + b, until it reaches a data node. The data node predicts a slot, then searches around that slot while respecting the sorted order and occupancy bitmap. The bitmap says which array positions hold real keys and which are gaps.',
        'An insert first finds the sorted lower-bound position. If a nearby gap exists, ALEX shifts only the short local run needed to place the key. If gaps are gone or search windows grow, the node pays a larger maintenance action: expand the array, split the key range, or retrain the model.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from sorted local storage plus verified comparisons. The model chooses a starting point, not a final answer. If key 73 is predicted near slot 4, comparisons against 60, 73, and 80 establish whether 73 exists and where it belongs.',
        'Global correctness comes from range coverage. Every data node owns a key range, and splits update the parent so the ranges still cover the key space without overlap. A bad local model can make one node slower, but it cannot make another node lose its keys.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A good point lookup costs a few model evaluations plus a short local search. If the prediction error is 2 slots, correction may take 1 or 2 comparisons; if the error grows to 500 slots, the learned advantage disappears. Insert cost behaves like distance to the nearest gap, so density is the operational knob.',
        'Memory is the price of write speed. A node with 1,000 keys at 50 percent density allocates about 2,000 slots plus a bitmap, so it spends roughly 2x dense-array space before values and pointers are counted. Doubling the dataset mostly adds nodes; it does not automatically double lookup work unless the key distribution becomes harder to model.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ALEX fits in-memory ordered maps when keys have learnable distributions: timestamps, monotonically increasing ids, geospatial keys, or sorted analytical columns. It is useful when point lookups and range scans dominate but writes still arrive often enough to break a static model.',
        'It also teaches a broader systems pattern. Learned components become reliable when wrapped by exact checks, local state, and repair triggers. The model buys a cheaper guess; the data structure keeps the correctness contract.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ALEX fails on keys that are effectively random, encrypted, hashed, or adversarial. The model then predicts no better than a generic guess, while gaps and maintenance still cost memory and code complexity. A B-tree or adaptive radix tree is usually simpler in that case.',
        'It also struggles with concurrency, crash recovery, and tail latency. A split or expansion can be expensive if it happens on the foreground insert path. Production use needs latching, logging, copy-on-write repair, and clear fallback behavior.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with keys [50, 60, 80, 95] in an 8-slot data node at 50 percent density: [50, gap, 60, gap, gap, 80, gap, 95]. A local model predicts key 73 near slot 4. Slot 4 is a gap before 80, so inserting 73 takes zero shifts and raises density to 5/8, or 62.5 percent.',
        'Now insert 70, 71, 74, 75, and 76 into the same neighborhood. The node reaches 10 keys in 10 slots, density becomes 100 percent, and the last few inserts shift about 2 or 3 keys each. If the policy threshold is 80 percent density or average shift above 2, ALEX splits around 74 into two 5-key nodes with 10 slots each, returning both nodes to 50 percent density.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Ding et al., ALEX: An Updatable Adaptive Learned Index, SIGMOD 2020; Kraska et al., The Case for Learned Index Structures, SIGMOD 2018; and the Microsoft ALEX repository. Study B-trees first, then recursive model indexes, packed memory arrays, PGM-indexes, and adaptive radix trees.',
        'The useful exercise is to implement one data node with a sorted gapped array, a bitmap, and a linear prediction function. Measure lookup error, density, and average shift length after clustered inserts. Those three numbers explain the whole design.',
      ],
    },
  ],
};