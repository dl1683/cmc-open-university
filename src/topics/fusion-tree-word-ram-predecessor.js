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
  yield {
    state: fusionNode('Fusion tree node: high degree, constant-time routing'),
    highlight: { active: ['query', 'node', 'sketch'], found: ['rank', 'c2'] },
    explanation: 'A fusion tree is a word-RAM predecessor structure. Each internal node stores more keys than a binary node, then uses bit tricks to choose the correct child in constant time.',
    invariant: 'The node degree is small enough to pack sketches into one word, but large enough to reduce tree height.',
  };

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
        ['2', 'O(log n)'],
        ['page-sized', 'IO-friendly'],
        ['w^epsilon', 'O(log_w n)'],
      ],
    ),
    highlight: { active: ['fusion:fanout', 'fusion:height'], compare: ['binary:height', 'btree:fanout'] },
    explanation: 'Fusion trees are conceptually B-trees for the word RAM. The key difference is that routing inside a node is not a linear scan or ordinary binary search; it is packed parallel comparison.',
  };

  yield {
    state: fusionNode('One node comparison selects a child interval'),
    highlight: { active: ['sketch', 'rank'], found: ['c2'], compare: ['c0', 'c1', 'c3', 'c4'] },
    explanation: 'The packed comparison computes the rank of the query sketch among the node sketches. That rank names the child interval that could contain the predecessor.',
  };

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
    highlight: { found: ['bits:purpose', 'packed:purpose', 'route:purpose'] },
    explanation: 'The node works because only a few bit positions are needed to distinguish the separator keys inside that node. Those positions create short sketches that preserve enough order to route.',
  };
}

function* sketchComparison() {
  yield {
    state: labelMatrix(
      'Distinguishing-bit sketches',
      [
        { id: 'k1', label: '100011' },
        { id: 'k2', label: '101100' },
        { id: 'k3', label: '110010' },
        { id: 'q', label: '101101' },
      ],
      [
        { id: 'bits', label: 'keep bits' },
        { id: 'sketch', label: 'sketch' },
      ],
      [
        ['1,3,5', '001'],
        ['1,3,5', '110'],
        ['1,3,5', '100'],
        ['1,3,5', '111'],
      ],
    ),
    highlight: { active: ['q:sketch', 'k2:sketch'], found: ['k3:sketch'] },
    explanation: 'The real construction is careful about false matches and rank correction, but the teaching picture is: keep the bits that separate node keys, pack the sketches, then compare many fields at once.',
    invariant: 'A sketch is not a hash. It must preserve the order information needed for predecessor routing inside this node.',
  };

  yield {
    state: labelMatrix(
      'Parallel comparison idea',
      [
        { id: 'replicate', label: 'replicate q' },
        { id: 'subtract', label: 'subtract keys' },
        { id: 'mask', label: 'mask signs' },
        { id: 'rank', label: 'count lanes' },
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
    highlight: { active: ['replicate:word', 'subtract:word', 'mask:word'], found: ['rank:meaning'] },
    explanation: 'Fusion trees predate commodity SIMD, but the mental model is similar: use one machine word as several small lanes, then do multiple comparisons through arithmetic and masking.',
  };

  yield {
    state: labelMatrix(
      'Why correction exists',
      [
        { id: 'sketch', label: 'sketch rank' },
        { id: 'full', label: 'full key check' },
        { id: 'branch', label: 'branch bit' },
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
    highlight: { active: ['sketch:problem'], found: ['full:repair', 'branch:repair'] },
    explanation: 'The compact sketch can identify a near rank, then the implementation checks nearby full keys and the first differing bit to return the correct predecessor interval.',
  };

  yield {
    state: fusionNode('Packed sketches make high-degree routing viable'),
    highlight: { active: ['query', 'sketch', 'rank'], found: ['c2'] },
    explanation: 'Without packed sketches, a high-degree node would spend too much time searching its separators. Fusion trees make the node wide while keeping routing constant-time in the word-RAM model.',
  };
}

function* predecessorPath() {
  yield {
    state: labelMatrix(
      'Query path through a fusion tree',
      [
        { id: 'root', label: 'root' },
        { id: 'internal', label: 'internal' },
        { id: 'leaf', label: 'leaf block' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'action', label: 'action' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['packed rank', 'O(1)'],
        ['packed rank', 'O(1)'],
        ['local scan/check', 'small'],
        ['predecessor', 'done'],
      ],
    ),
    highlight: { active: ['root:cost', 'internal:cost'], found: ['answer:action'] },
    explanation: 'A query repeats the same constant-time node routing down a tree whose height is O(log_w n). The leaf or final neighborhood check gives the exact predecessor.',
  };

  yield {
    state: labelMatrix(
      'Case study: packet timestamp boundary',
      [
        { id: 'timestamps', label: 'timestamps' },
        { id: 'node', label: 'fusion node' },
        { id: 'query', label: 'floor(t)' },
        { id: 'scan', label: 'scan window' },
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
    highlight: { found: ['query:need', 'node:lesson'], compare: ['scan:lesson'] },
    explanation: 'Like X-Fast & Y-Fast Tries, fusion trees fit fixed-width integer predecessor workloads. They do not remove the need for leaf storage and iteration once the boundary is found.',
  };

  yield {
    state: labelMatrix(
      'Compare integer predecessor structures',
      [
        { id: 'bst', label: 'BST' },
        { id: 'veb', label: 'vEB' },
        { id: 'yfast', label: 'Y-fast' },
        { id: 'fusion', label: 'fusion' },
      ],
      [
        { id: 'bound', label: 'bound' },
        { id: 'idea', label: 'idea' },
      ],
      [
        ['O(log n)', 'comparisons'],
        ['O(log log U)', 'recursive universe'],
        ['O(log log U)', 'hashed prefixes'],
        ['O(log_w n)', 'word parallelism'],
      ],
    ),
    highlight: { active: ['fusion:bound', 'fusion:idea'], compare: ['bst:bound', 'veb:idea', 'yfast:idea'] },
    explanation: 'These structures are a family. Each escapes ordinary comparison-tree limits by using the representation of integer keys: universe recursion, prefixes, or packed word operations.',
  };

  yield {
    state: fusionNode('Engineering lesson: asymptotics can lose to locality'),
    highlight: { active: ['node', 'sketch', 'rank'], compare: ['c0', 'c1', 'c3', 'c4'] },
    explanation: 'Fusion trees are a landmark result and a powerful design lesson. In everyday systems, simpler B-trees, ART nodes, Eytzinger arrays, or sorted vectors may win because their memory layout is easier for hardware.',
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
      heading: 'What it is',
      paragraphs: [
        'A fusion tree is an integer predecessor data structure in the word-RAM model. It stores many separator keys in each internal node and uses word-level bit operations to route a query in constant time per node. With high fanout, the tree height drops to O(log_w n), where w is the machine-word size.',
        'The obvious search tree asks one comparison per branch decision, so reducing height usually makes each node search more expensive. The wall is inside the node: a wide node is useless if routing across its separators takes linear time. Fusion trees solve that local routing problem by packing only the distinguishing bits of many separators into one word.',
        'The structure belongs next to van Emde Boas Tree and X-Fast & Y-Fast Tries. All three exploit the fact that keys are fixed-width integers, not arbitrary comparator objects. Fusion trees exploit the word itself: several key sketches are packed into one word and compared in parallel.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Inside one node, the keys are sorted separators. The construction identifies bit positions that distinguish those separators. Each separator is compressed into a short sketch made from those positions. The sketches are packed into fields of a machine word. A query builds its own sketch, replicates it across fields, and uses arithmetic and masking to estimate its rank among the separators.',
        'The full construction includes correction steps because sketches are not full keys. After the packed comparison finds a candidate rank, nearby full separators and the first differing bit decide the exact child interval. That correction is the difference between a nice diagram and a correct predecessor structure.',
        'The invariant is local order preservation, not hashing. A sketch may omit many bits, but it must keep enough distinguishing information for the correction step to recover the same child interval that full-key comparison would have chosen.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Read the packed word as parallel comparison hardware exposed through arithmetic. A fusion node stores sampled bits from several keys, packs them into machine words, and compares many candidates with a small number of word operations.',
        'The animation is not promising that ordinary JavaScript maps should become fusion trees. It is teaching the model: on the word RAM, bit layout can be an algorithm. The win comes from exploiting fixed-width machine words, so portability and implementation complexity matter as much as asymptotic bounds.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The classic headline is O(log_w n) predecessor search with linear space under word-RAM assumptions. The branching factor is a small power of w, often written w to some fixed epsilon, so one node can still fit the packed sketches needed for constant-time routing.',
        'This is a theoretical asymptotic result with real design intuition. It teaches why wide nodes matter, why bit-level representations can beat comparison bounds, and why local node-search cost matters as much as tree height. It is also implementation-heavy: multiplication tricks, sketch correction, and architecture details all matter.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A clean case study is an in-memory index over fixed-width packet timestamps or sequence numbers. The hot query is floor(t): find the largest stored boundary at or before t, then scan a small ordered leaf range. A balanced tree gives O(log n). X-Fast & Y-Fast Tries use prefix hashing. A fusion tree instead keeps a wide tree and makes each node decision word-parallel.',
        'The engineering verdict is cautious. If the index is small, a sorted array with Eytzinger layout or a B-tree-like node may be faster. If updates dominate, the complexity is hard to justify. Fusion trees matter because they expose a design frontier: when integer representation and word operations are part of the contract, the comparison-tree model is not the whole story.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not treat the sketch as a hash. A hash destroys order; a fusion-tree sketch preserves selected order information for separators in one node. Also do not read word-RAM bounds as portable performance promises. Real CPUs have cache lines, branch predictors, vector instructions, and memory hierarchies that may reward simpler layouts.',
        'Another pitfall is ignoring correction. The packed comparison gives a rank candidate. Correct code must still verify with full keys and the relevant distinguishing bit. This is the same lesson as PATRICIA Trie and compressed indexes: compression is safe only when the omitted information can be recovered or checked.',
        'It is also the wrong tool when keys are not fixed-width integers or when maintainability matters more than shaving a theoretical predecessor bound. In many systems, a B-tree node with branchless binary search or a sorted vector beats the elaborate word trick in wall-clock time.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Separate the abstract idea from a production predecessor index. A real implementation must define word size, key universe, separator fanout, sketch bit positions, packed field layout, correction logic, update policy, and fallback behavior for small nodes.',
        'Test sketches against full comparison. For every node, generate keys around each separator and verify that the packed route plus correction picks the same child interval as ordinary binary search. Without that oracle, bit tricks are too easy to get almost right.',
        'Benchmark against simpler layouts. Eytzinger arrays, B-tree nodes, branchless binary search, SIMD scans, and adaptive radix trees often have better constants. Fusion trees are important because they show what the word-RAM model permits, not because every index should use them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose one node stores separators whose important differences appear at bit positions 2, 7, and 13. The node extracts those bits from each separator to form short sketches, packs those sketches into a word, and does the same extraction for the query key.',
        'The packed comparison estimates how many separators are less than the query. Because omitted bits can matter near boundaries, the implementation then checks nearby full keys or the relevant distinguishing bit. The fast path narrows the child choice; the correction step makes it exact.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The structure works because integer keys expose their bits. A comparison tree treats each key as an opaque object and learns order one comparison at a time. A fusion node uses the word-RAM model to inspect several important bits from several separators in parallel.',
        'The sketch positions are chosen from bits where separators differ. Those bits are enough to narrow the query to a small neighborhood. The correction step then uses full keys so the data structure remains exact, not approximate.',
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        'Fusion trees matter most as a theoretical boundary marker. They show that predecessor search can beat ordinary comparison-tree intuition when keys are fixed-width integers and word operations are allowed.',
        'The idea also influenced practical indexes even when the exact structure is not used. Modern indexes routinely pack keys, use SIMD comparisons, exploit cache-line-wide nodes, and separate fast approximate routing from exact correction. Fusion trees are one ancestor of that design style.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Study fusion trees to understand what word-level parallelism can buy. Implement them only when the key universe, performance target, and maintenance budget justify bit-level complexity.',
        'For most software systems, the practical lesson is broader than the exact data structure: make node search cheap when you increase fanout, and always check compressed routing decisions against the full key when correctness matters.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Fredman and Willard, "Surpassing the Information Theoretic Bound with Fusion Trees", DOI page at https://dl.acm.org/doi/10.1145/73007.73010. Lecture references: MIT 6.851 notes on Fusion Trees at https://courses.csail.mit.edu/6.851/spring12/scribe/lec12.pdf and Erik Demaine lecture video resources at https://courses.csail.mit.edu/6.851/spring12/lectures/. Study X-Fast & Y-Fast Tries, van Emde Boas Tree, B-Trees, Eytzinger Layout Binary Search, Adaptive Radix Tree, and PATRICIA Trie next.',
      ],
    },
  ],
};
