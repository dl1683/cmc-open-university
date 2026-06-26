// Fusion trees: word-RAM predecessor search by packing many key sketches into
// one machine word and comparing them in parallel inside a high-degree node.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'fusion-tree-word-ram-predecessor',
  title: 'Fusion Tree Word-RAM Predecessor',
  category: 'Data Structures',
  summary: 'A high-degree search tree for integer keys: choose distinguishing bits, pack sketches into words, and use parallel comparison to route in O(log_w n).',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['packed node', 'sketch comparison', 'predecessor path'], defaultValue: 'packed node' },
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

function fusionNode(title) {
  return graphState({
    nodes: [
      { id: 'query', label: 'q', x: 0.9, y: 3.8, note: '101101' },
      { id: 'node', label: 'packed node', x: 3.5, y: 3.8, note: 'many keys' },
      { id: 'sketch', label: 'sketches', x: 5.9, y: 2.2, note: 'one word' },
      { id: 'rank', label: 'rank', x: 5.9, y: 5.4, note: 'parallel' },
      { id: 'c0', label: 'child 0', x: 8.5, y: 1.2 },
      { id: 'c1', label: 'child 1', x: 8.5, y: 2.6 },
      { id: 'c2', label: 'child 2', x: 8.5, y: 4.0 },
      { id: 'c3', label: 'child 3', x: 8.5, y: 5.4 },
      { id: 'c4', label: 'child 4', x: 8.5, y: 6.8 },
    ],
    edges: [
      { id: 'e-query-node', from: 'query', to: 'node', weight: '' },
      { id: 'e-node-sketch', from: 'node', to: 'sketch', weight: '' },
      { id: 'e-sketch-rank', from: 'sketch', to: 'rank', weight: '' },
      { id: 'e-rank-c0', from: 'rank', to: 'c0', weight: '' },
      { id: 'e-rank-c1', from: 'rank', to: 'c1', weight: '' },
      { id: 'e-rank-c2', from: 'rank', to: 'c2', weight: '' },
      { id: 'e-rank-c3', from: 'rank', to: 'c3', weight: '' },
      { id: 'e-rank-c4', from: 'rank', to: 'c4', weight: '' },
    ],
  }, { title });
}

function* packedNode() {
  const nodeGraph = fusionNode('Fusion tree node: high degree, constant-time routing');
  const activeNodes = ['query', 'node', 'sketch'];
  const foundNodes = ['rank', 'c2'];
  yield {
    state: nodeGraph,
    highlight: { active: activeNodes, found: foundNodes },
    explanation: `A fusion tree is a word-RAM predecessor structure. Each internal node stores more keys than a binary node (this node has ${nodeGraph.nodes.length} elements: ${activeNodes.length} active stages plus ${foundNodes.length} resolved outputs), then uses bit tricks to choose the correct child in constant time.`,
    invariant: `The node degree is small enough to pack sketches into one word, but large enough to reduce tree height (${nodeGraph.edges.filter(e => e.from === 'rank').length} child pointers from the rank stage).`,
  };

  const treeTypes = ['binary tree', 'B-tree', 'fusion tree'];
  const fusionFanout = 'w^epsilon';
  const fusionHeight = 'O(log_w n)';
  const binaryHeight = 'O(log n)';
  yield {
    state: labelMatrix(
      'Why high degree helps',
      [
        { id: 'binary', label: 'binary tree' },
        { id: 'btree', label: 'B-tree' },
        { id: 'fusion', label: 'fusion tree' },
      ],
      [
        { id: 'fanout', label: 'fanout' },
        { id: 'height', label: 'height' },
      ],
      [
        ['2', binaryHeight],
        ['page-sized', 'IO-friendly'],
        [fusionFanout, fusionHeight],
      ],
    ),
    highlight: { active: ['fusion:fanout', 'fusion:height'], compare: ['binary:height', 'btree:fanout'] },
    explanation: `Fusion trees are conceptually B-trees for the word RAM. Across ${treeTypes.length} tree types, a binary tree has height ${binaryHeight} while a fusion tree achieves ${fusionHeight} with fanout ${fusionFanout}. The key difference is that routing inside a node is not a linear scan or ordinary binary search; it is packed parallel comparison.`,
  };

  const childIds = ['c0', 'c1', 'c2', 'c3', 'c4'];
  const foundChild = 'c2';
  const comparedChildren = childIds.filter(c => c !== foundChild);
  yield {
    state: fusionNode('One node comparison selects a child interval'),
    highlight: { active: ['sketch', 'rank'], found: [foundChild], compare: comparedChildren },
    explanation: `The packed comparison computes the rank of the query sketch among the node sketches. That rank selects ${foundChild} from ${childIds.length} children, naming the child interval that could contain the predecessor (the other ${comparedChildren.length} children are ruled out).`,
  };

  const contractRows = ['keys', 'bits', 'packed word', 'route'];
  const contractCols = ['stores', 'purpose'];
  const foundPurposes = ['bits:purpose', 'packed:purpose', 'route:purpose'];
  yield {
    state: labelMatrix(
      'Node contract',
      [
        { id: 'keys', label: 'keys' },
        { id: 'bits', label: 'bits' },
        { id: 'packed', label: 'packed word' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'purpose', label: 'purpose' },
      ],
      [
        ['sorted separators', 'child ranges'],
        ['distinguishing positions', 'short sketches'],
        ['all sketches', 'parallel compare'],
        ['rank result', 'pick child'],
      ],
    ),
    highlight: { found: foundPurposes },
    explanation: `The node contract has ${contractRows.length} rows (${contractRows.join(', ')}) across ${contractCols.length} columns. The node works because only a few bit positions are needed to distinguish the separator keys inside that node. ${foundPurposes.length} purpose cells are highlighted: those positions create short sketches that preserve enough order to route.`,
  };
}

function* sketchComparison() {
  const keyLabels = ['100011', '101100', '110010'];
  const queryLabel = '101101';
  const keepBits = '1,3,5';
  const sketches = ['001', '110', '100', '111'];
  const sketchHighlight = { active: ['q:sketch', 'k2:sketch'], found: ['k3:sketch'] };
  yield {
    state: labelMatrix(
      'Distinguishing-bit sketches',
      [
        { id: 'k1', label: keyLabels[0] },
        { id: 'k2', label: keyLabels[1] },
        { id: 'k3', label: keyLabels[2] },
        { id: 'q', label: queryLabel },
      ],
      [
        { id: 'bits', label: 'keep bits' },
        { id: 'sketch', label: 'sketch' },
      ],
      [
        [keepBits, sketches[0]],
        [keepBits, sketches[1]],
        [keepBits, sketches[2]],
        [keepBits, sketches[3]],
      ],
    ),
    highlight: sketchHighlight,
    explanation: `With ${keyLabels.length} keys (${keyLabels.join(', ')}) and query ${queryLabel}, keeping bit positions ${keepBits} yields sketches ${sketches.join(', ')}. The real construction is careful about false matches and rank correction, but the teaching picture is: keep the bits that separate node keys, pack the sketches, then compare ${sketches.length} fields at once.`,
    invariant: `A sketch is not a hash. The ${sketches.length} sketches (${sketches.join(', ')}) from positions ${keepBits} must preserve the order information needed for predecessor routing inside this node.`,
  };

  const parallelSteps = ['replicate q', 'subtract keys', 'mask signs', 'count lanes'];
  const activeOps = ['replicate:word', 'subtract:word', 'mask:word'];
  yield {
    state: labelMatrix(
      'Parallel comparison idea',
      [
        { id: 'replicate', label: parallelSteps[0] },
        { id: 'subtract', label: parallelSteps[1] },
        { id: 'mask', label: parallelSteps[2] },
        { id: 'rank', label: parallelSteps[3] },
      ],
      [
        { id: 'word', label: 'word op' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['q q q q', 'same query in lanes'],
        ['SIMD-ish', 'which keys below q'],
        ['high bits', 'lane outcomes'],
        ['pop/count', 'child rank'],
      ],
    ),
    highlight: { active: activeOps, found: ['rank:meaning'] },
    explanation: `Fusion trees predate commodity SIMD, but the mental model is similar: ${parallelSteps.length} steps (${parallelSteps.join(' -> ')}) use one machine word as several small lanes, with ${activeOps.length} active word operations, then do multiple comparisons through arithmetic and masking.`,
  };

  const correctionRows = ['sketch rank', 'full key check', 'branch bit'];
  const repairCells = ['full:repair', 'branch:repair'];
  yield {
    state: labelMatrix(
      'Why correction exists',
      [
        { id: 'sketch', label: correctionRows[0] },
        { id: 'full', label: correctionRows[1] },
        { id: 'branch', label: correctionRows[2] },
      ],
      [
        { id: 'problem', label: 'problem' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['may be approximate', 'candidate rank'],
        ['full separator', 'verify neighbor'],
        ['first difference', 'choose side'],
      ],
    ),
    highlight: { active: ['sketch:problem'], found: repairCells },
    explanation: `Correction has ${correctionRows.length} stages (${correctionRows.join(', ')}). The compact sketch can identify a near rank, then ${repairCells.length} repair steps (${repairCells.join(', ')}) check nearby full keys and the first differing bit to return the correct predecessor interval.`,
  };

  const routingGraph = fusionNode('Packed sketches make high-degree routing viable');
  const activeStages = ['query', 'sketch', 'rank'];
  yield {
    state: routingGraph,
    highlight: { active: activeStages, found: ['c2'] },
    explanation: `Without packed sketches, a high-degree node with ${routingGraph.edges.filter(e => e.from === 'rank').length} children would spend too much time searching its separators. With ${activeStages.length} active stages (${activeStages.join(', ')}), fusion trees make the node wide while keeping routing constant-time in the word-RAM model.`,
  };
}

function* predecessorPath() {
  const pathLevels = ['root', 'internal', 'leaf block', 'answer'];
  const constantCostLevels = ['root:cost', 'internal:cost'];
  const nodeCost = 'O(1)';
  const treeHeight = 'O(log_w n)';
  yield {
    state: labelMatrix(
      'Query path through a fusion tree',
      [
        { id: 'root', label: pathLevels[0] },
        { id: 'internal', label: pathLevels[1] },
        { id: 'leaf', label: pathLevels[2] },
        { id: 'answer', label: pathLevels[3] },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['packed rank', nodeCost],
        ['packed rank', nodeCost],
        ['local scan/check', 'small'],
        ['predecessor', 'done'],
      ],
    ),
    highlight: { active: constantCostLevels, found: ['answer:action'] },
    explanation: `A query traverses ${pathLevels.length} levels (${pathLevels.join(' -> ')}), repeating ${nodeCost} constant-time node routing at ${constantCostLevels.length} levels down a tree whose height is ${treeHeight}. The leaf or final neighborhood check gives the exact predecessor.`,
  };

  const caseStudyRows = ['timestamps', 'fusion node', 'floor(t)', 'scan window'];
  const foundCells = ['query:need', 'node:lesson'];
  yield {
    state: labelMatrix(
      'Case study: packet timestamp boundary',
      [
        { id: 'timestamps', label: caseStudyRows[0] },
        { id: 'node', label: caseStudyRows[1] },
        { id: 'query', label: caseStudyRows[2] },
        { id: 'scan', label: caseStudyRows[3] },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['fixed-width ints', 'word-RAM fit'],
        ['many separators', 'shorter height'],
        ['predecessor', 'hot path'],
        ['ordered leaves', 'iteration still needed'],
      ],
    ),
    highlight: { found: foundCells, compare: ['scan:lesson'] },
    explanation: `Like X-Fast & Y-Fast Tries, fusion trees fit fixed-width integer predecessor workloads across ${caseStudyRows.length} stages (${caseStudyRows.join(', ')}). ${foundCells.length} cells are highlighted as key takeaways. They do not remove the need for leaf storage and iteration once the boundary is found.`,
  };

  const structures = ['BST', 'vEB', 'Y-fast', 'fusion'];
  const bounds = ['O(log n)', 'O(log log U)', 'O(log log U)', 'O(log_w n)'];
  const ideas = ['comparisons', 'recursive universe', 'hashed prefixes', 'word parallelism'];
  const comparedIdeas = ['bst:bound', 'veb:idea', 'yfast:idea'];
  yield {
    state: labelMatrix(
      'Compare integer predecessor structures',
      [
        { id: 'bst', label: structures[0] },
        { id: 'veb', label: structures[1] },
        { id: 'yfast', label: structures[2] },
        { id: 'fusion', label: structures[3] },
      ],
      [
        { id: 'bound', label: 'bound' },
        { id: 'idea', label: 'idea' },
      ],
      [
        [bounds[0], ideas[0]],
        [bounds[1], ideas[1]],
        [bounds[2], ideas[2]],
        [bounds[3], ideas[3]],
      ],
    ),
    highlight: { active: ['fusion:bound', 'fusion:idea'], compare: comparedIdeas },
    explanation: `These ${structures.length} structures (${structures.join(', ')}) are a family. Fusion achieves ${bounds[3]} via ${ideas[3]}, compared against ${comparedIdeas.length} alternatives. Each escapes ordinary comparison-tree limits by using the representation of integer keys: universe recursion, prefixes, or packed word operations.`,
  };

  const lessonGraph = fusionNode('Engineering lesson: asymptotics can lose to locality');
  const activeStages = ['node', 'sketch', 'rank'];
  const comparedChildren = ['c0', 'c1', 'c3', 'c4'];
  yield {
    state: lessonGraph,
    highlight: { active: activeStages, compare: comparedChildren },
    explanation: `Fusion trees are a landmark result and a powerful design lesson. This graph has ${lessonGraph.nodes.length} nodes with ${activeStages.length} active stages and ${comparedChildren.length} compared children. In everyday systems, simpler B-trees, ART nodes, Eytzinger arrays, or sorted vectors may win because their memory layout is easier for hardware.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'packed node') yield* packedNode();
  else if (view === 'sketch comparison') yield* sketchComparison();
  else if (view === 'predecessor path') yield* predecessorPath();
  else throw new InputError('Pick a fusion-tree view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization offers three views. "Packed node" shows the internal layout of a single fusion-tree node: a query enters, sketches are compared in parallel inside one machine word, and a child pointer is selected. "Sketch comparison" walks through how distinguishing bits are extracted, packed, and compared. "Predecessor path" traces a full query from root to answer and compares fusion trees against other predecessor structures.',
        'Each frame highlights active elements, found results, and compared alternatives. Step through slowly the first time; the bit-level operations are the whole point.',
        {type: 'image', src: './assets/gifs/fusion-tree-word-ram-predecessor.gif', alt: 'Animated walkthrough of the fusion tree word ram predecessor visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The predecessor problem asks: given a set S of integers and a query q, find the largest element in S that is less than or equal to q. It is the backbone of range queries, interval lookups, IP routing tables, and timestamp indexes. A balanced binary search tree solves it in O(log n) comparisons, and for decades that seemed optimal.',
        'In 1990, Fredman and Willard proved it is not. Their fusion tree achieves O(log_w n) query time, where w is the machine word size in bits. On a 64-bit machine with a million keys, log_2(n) is about 20 but log_64(n) is about 3.3. The trick is to stop treating each key as an opaque object and start treating it as a bit string that fits inside a machine word.',
        'Fusion trees matter because they broke a fundamental barrier. The comparison-tree lower bound of Omega(log n) applies only when the algorithm uses pairwise comparisons. Once the algorithm is allowed to inspect bits and exploit word-level arithmetic, it can do better. This is the founding result of the word-RAM model of computation.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Store n keys in a balanced BST. Each internal node holds one separator and two children. A query walks from root to leaf, comparing at each level, paying O(1) per level and O(log n) total. This is clean, general, and well-understood.',
        'To reduce height, widen the nodes. A B-tree stores up to B keys per node, giving height O(log_B n). Each node search scans or binary-searches B separators, costing O(log B) comparisons. The total is O(log_B n * log B) = O(log n). The height shrank, but total comparison work stayed the same. B-trees win in practice because they reduce cache misses and disk I/O, not because they reduce comparisons.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is inside the node. If you pack B^(1/5) = w^(1/5) separators into a single node (the actual fusion-tree fanout), ordinary comparison-based search within that node costs O(log(w^(1/5))) = O(log w) comparisons. Over O(log_w n) levels, the total is O(log_w n * log w) = O(log n). You have gained nothing.',
        'To beat O(log n), you need to search inside a wide node in O(1) time, not O(log B) time. No comparison-based method can do that when B grows with w. The wall is the comparison model itself: it processes one pair of keys at a time, so it cannot exploit the fact that multiple separators and the query all live in the same machine word at the same time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A machine word is not just a number; it is a parallel comparison register. If you can pack the distinguishing bits of several separators into one w-bit word, then a single arithmetic operation (multiply, subtract, mask) acts on all of them simultaneously. The node search becomes O(1) word operations instead of O(log B) comparisons.',
        {type: 'callout', text: 'Fusion trees make fanout useful by making the node search word-parallel: many separator sketches are compared inside one machine word.'},
        'The key observation is that inside any single node, the separators are already sorted. You do not need to keep all w bits of each separator; you only need the bit positions where those particular separators differ from each other. There are at most k-1 such positions for k separators. Extracting just those bits from each separator produces a short "sketch" that preserves the ordering within that node.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'B-tree with grouped sorted keys inside nodes', caption: 'A B-tree reduces height with wide nodes. Fusion trees ask how wide an integer-search node can get when routing is done with packed word operations. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction: each node stores k = w^(1/5) sorted separator keys. The algorithm identifies the O(k) bit positions where adjacent separators differ. Each separator is compressed into a sketch of O(k) bits by extracting only those positions. With k = w^(1/5), each sketch has about w^(1/5) bits, so k sketches occupy about w^(2/5) bits total, which fits in one w-bit word.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'Intel CPU die showing processor circuitry', caption: 'Fusion trees are a word-RAM result: the machine word and its arithmetic operations are part of the algorithmic model. Source: Wikimedia Commons, KL and Intel, public domain.'},
        'Query: given a query q, extract its sketch using the same bit positions. Replicate that sketch into every field of a packed word (one multiplication does this). Subtract the packed-separators word from the packed-query word. Each field\'s high bit now indicates whether the query sketch was greater than or equal to that separator\'s sketch. Mask out those high bits and count them (popcount or a shift-and-add trick). The count is the approximate rank of q among the separators.',
        'Correction: the sketch rank may be off by one because sketches drop bits. The algorithm checks the full separator at the candidate rank and its neighbor. It finds the first bit where q and the nearest separator differ, and that bit determines which side q falls on. This correction runs in O(1) word operations. The result is the exact child pointer for the predecessor query.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on two properties. First, within a single node, the sketch function preserves the relative order of the separators. If separator A < separator B, then sketch(A) < sketch(B), because the distinguishing bits are exactly the positions where adjacent sorted separators differ. Any two separators that are out of order in the sketch would have been adjacent and identical at all distinguishing positions, contradicting the construction.',
        'Second, the query sketch may land between the wrong pair of separator sketches (because the query has bits that the separators do not share, and those bits are dropped). But it can land at most one position away from the correct rank. The correction step inspects at most two full separators and the first differing bit, which is enough to resolve the ambiguity.',
        'The height argument is arithmetic. With fanout k = w^(1/5) and n keys, the tree has height O(log_k n) = O(log n / log(w^(1/5))) = O(log n / ((1/5) log w)) = O(5 log n / log w) = O(log_w n). Each level costs O(1) word operations. Total: O(log_w n).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Query time is O(log_w n) in the word-RAM model. On a 64-bit machine, log_64(10^6) is about 3.3, versus log_2(10^6) which is about 20. For a billion keys, log_64(10^9) is about 5, versus log_2(10^9) which is about 30. The improvement is real but moderate for practical n; the constant factors from sketch construction and correction are non-trivial.',
        'Space is O(n). Each node stores k separators (full keys), their sketches (one packed word), and k+1 child pointers. With n/k nodes and k = w^(1/5), total space is linear in n. Updates (insert and delete) require rebalancing the tree and rebuilding the sketch word for affected nodes. The original paper achieves O(log_w n) amortized update time using standard B-tree rebalancing adapted to the fusion-tree fanout.',
        'The construction relies on multiplication for sketch extraction (a specific constant times each key extracts the right bits into adjacent fields). Finding that constant and verifying the field layout is the hardest part of a real implementation. The constant depends on the distinguishing bit positions, which change when the node\'s separator set changes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Direct implementations of fusion trees are rare in production systems. The constant factors, implementation complexity, and cache-unfriendly access patterns make simpler structures (B-trees, van Emde Boas trees, radix trees) more practical for most workloads.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Binary_tree.svg', alt: 'Binary tree diagram with parent and child nodes', caption: 'The comparison-tree baseline pays one branch decision at a time. Fusion trees beat that shape by routing across many child intervals per node. Source: Wikimedia Commons, Derrick Coetzee, public domain.'},
        'The indirect influence is large. The idea that a wide node can be searched in O(1) using word parallelism appears in modern index designs: ART (Adaptive Radix Tree) uses SIMD to scan 256-entry node headers; cache-line-aware B-trees pack keys for branchless comparison; Masstree uses fanout and key-prefix tricks inspired by the same principle. Fusion trees taught the field that the comparison model undersells what hardware can do.',
        'In theory, fusion trees are a building block for optimal predecessor structures. Combined with Y-fast tries, the "interpolation search" result of Beame and Fich achieves min(O(log_w n), O(log log U)) query time, which is provably optimal for the word-RAM model.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Fusion trees assume fixed-width integer keys. If keys are strings, floating-point values, or variable-length, the bit-packing trick does not apply. You would need to reduce to integer keys first (e.g., by hashing prefixes), which may lose the ordering property the structure depends on.',
        'Cache performance is poor. Each node access touches a packed word, a correction lookup, and a child pointer dereference. These are scattered memory accesses. A B-tree node that fits in one cache line and is scanned linearly will often beat a fusion tree node in wall-clock time, even though the fusion tree does fewer "operations" in the word-RAM model.',
        'Implementation complexity is high. The multiplication constant for sketch extraction, the correction logic, and the rebalancing code are each subtle and error-prone. A bug in any of them produces silent wrong answers (returning a predecessor that is not actually the largest key below q). For most engineering teams, the maintenance cost outweighs the asymptotic benefit.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a node with 4 separator keys stored as 16-bit integers: 5 (00000000 00000101), 19 (00000000 00010011), 42 (00000000 00101010), and 57 (00000000 00111001). We want to answer: what is the predecessor of query q = 35 (00000000 00100011)?',
        'Step 1, find distinguishing bits. Compare adjacent sorted separators. 5 vs 19: they differ at bit positions 1 and 4. 19 vs 42: they differ at positions 0, 1, 3, and 5. 42 vs 57: they differ at positions 0, 3, and 4. The union of distinguishing positions is {0, 1, 3, 4, 5}. That is 5 positions, so each sketch is 5 bits long.',
        'Step 2, build sketches. Extract bits at positions 5,4,3,1,0 from each key. Key 5 (00101) extracts to sketch 00101. Key 19 (10011) extracts to sketch 10010. Key 42 (101010) extracts to sketch 10101. Key 57 (111001) extracts to sketch 11100. Query 35 (100011) extracts to sketch 10001. Pack all four separator sketches into one 20-bit word: [00101][10010][10101][11100].',
        'Step 3, parallel compare. Replicate the query sketch into four fields: [10001][10001][10001][10001]. Subtract the separator word from the query word field by field. Fields where the result is non-negative (high bit = 0) indicate separators less than or equal to q. Here, 10001 >= 00101 (yes, 5 <= 35), 10001 >= 10010 (no, 19 > 17 in sketch... but sketch order can differ from key order at boundaries). The approximate rank says q falls near separator index 1 or 2.',
        'Step 4, correction. Check full keys at the candidate rank. Compare q = 35 against separator 19 (index 1) and separator 42 (index 2). Since 19 <= 35 < 42, the predecessor is in the child interval between separators 19 and 42. The correction resolved the sketch ambiguity using the actual keys. Total cost: O(1) word operations, and the query descends to the correct child.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The original paper is Fredman and Willard, "Surpassing the Information Theoretic Bound with Fusion Trees" (1990), available at https://dl.acm.org/doi/10.1145/73007.73010. The clearest exposition is in MIT 6.851 (Advanced Data Structures) lecture 12: scribe notes at https://courses.csail.mit.edu/6.851/spring12/scribe/lec12.pdf and video lectures at https://courses.csail.mit.edu/6.851/spring12/lectures/.',
        'For context on predecessor lower bounds, see Beame and Fich, "Optimal Bounds for the Predecessor Problem and Related Problems" (2002). For practical alternatives, study van Emde Boas Tree (universe-recursive predecessor in O(log log U)), X-Fast and Y-Fast Tries (hash-based predecessor), B-Trees (disk/cache-friendly wide nodes), Eytzinger Layout Binary Search (cache-optimal implicit trees), Adaptive Radix Tree (SIMD-accelerated radix nodes), and PATRICIA Trie (compressed prefix trees).',
      ],
    },
  ],
};
