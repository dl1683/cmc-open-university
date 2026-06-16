// Adaptive Radix Tree: a trie-shaped main-memory index that changes node
// representation as fanout grows, so sparse prefixes stay compact and dense
// prefixes stay fast.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'adaptive-radix-tree',
  title: 'Adaptive Radix Tree',
  category: 'Data Structures',
  summary: 'A cache-aware trie for ordered keys: compress prefixes, resize nodes by fanout, and search byte by byte.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['node growth', 'prefix compression'], defaultValue: 'node growth' },
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

function artShape(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'root', x: 1.0, y: 4.0, note: 'prefix: ""' },
      { id: 'c', label: 'c', x: 2.9, y: 2.0, note: 'Node4' },
      { id: 'ca', label: 'ca', x: 4.8, y: 1.0, note: 'cat, car' },
      { id: 'co', label: 'co', x: 4.8, y: 3.0, note: 'cow' },
      { id: 'd', label: 'd', x: 2.9, y: 6.0, note: 'Node16' },
      { id: 'do', label: 'do', x: 4.8, y: 5.0, note: 'dog, dot' },
      { id: 'da', label: 'da', x: 4.8, y: 7.0, note: 'data' },
      { id: 'dense', label: 'api:*', x: 7.5, y: 4.0, note: 'Node48/256' },
    ],
    edges: [
      { id: 'e-root-c', from: 'root', to: 'c', weight: '0x63' },
      { id: 'e-c-ca', from: 'c', to: 'ca', weight: 'a' },
      { id: 'e-c-co', from: 'c', to: 'co', weight: 'o' },
      { id: 'e-root-d', from: 'root', to: 'd', weight: '0x64' },
      { id: 'e-d-do', from: 'd', to: 'do', weight: 'o' },
      { id: 'e-d-da', from: 'd', to: 'da', weight: 'a' },
      { id: 'e-root-dense', from: 'root', to: 'dense', weight: 'shared prefix' },
    ],
  }, { title });
}

function* nodeGrowth() {
  yield {
    state: artShape('ART is a radix trie tuned for CPU caches'),
    highlight: { active: ['root', 'c', 'e-root-c'], found: ['ca'] },
    explanation: 'An Adaptive Radix Tree indexes keys byte by byte like a trie, but it is engineered as a main-memory database index. It preserves sorted order like a tree and supports prefix/range work that a hash table cannot.',
  };

  yield {
    state: labelMatrix(
      'ART node types grow with fanout',
      [
        { id: 'n4', label: 'Node4' },
        { id: 'n16', label: 'Node16' },
        { id: 'n48', label: 'Node48' },
        { id: 'n256', label: 'Node256' },
      ],
      [
        { id: 'children', label: 'children' },
        { id: 'representation', label: 'representation' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['up to 4', 'small key array', 'very sparse'],
        ['up to 16', 'SIMD-friendly scan', 'small branch fanout'],
        ['up to 48', 'byte -> slot indirection', 'medium fanout'],
        ['up to 256', 'direct child array', 'dense fanout'],
      ],
    ),
    highlight: { found: ['n4:fit', 'n16:fit', 'n48:fit'], active: ['n256:representation'] },
    explanation: 'The adaptive part is literal. A sparse node should not pay for 256 child pointers. A dense node should not linearly scan dozens of labels. ART changes representation as the local fanout changes.',
    invariant: 'Use the smallest node layout that can represent the current fanout efficiently.',
  };

  yield {
    state: labelMatrix(
      'Insert "cape" into a small c/a prefix',
      [
        { id: 'before', label: 'before' },
        { id: 'insert', label: 'insert p' },
        { id: 'after', label: 'after' },
        { id: 'future', label: 'future growth' },
      ],
      [
        { id: 'fanout', label: 'fanout' },
        { id: 'node', label: 'node type' },
      ],
      [
        ['2 children', 'Node4'],
        ['3 children', 'still Node4'],
        ['cat/car/cape', 'compact'],
        ['5th child', 'grow to Node16'],
      ],
    ),
    highlight: { active: ['insert:fanout', 'after:node'], compare: ['future:node'] },
    explanation: 'Insertion is not tree rotation. It is local node replacement: when a Node4 gets a fifth child, allocate a Node16, copy children, and continue. The logical trie stays the same.',
  };

  yield {
    state: labelMatrix(
      'How ART compares',
      [
        { id: 'btree', label: 'B-tree' },
        { id: 'hash', label: 'hash table' },
        { id: 'trie', label: 'plain trie' },
        { id: 'art', label: 'ART' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'weakness', label: 'weakness' },
      ],
      [
        ['ordered disk/page index', 'pointer and branch cost in RAM'],
        ['fast point lookup', 'no natural range order'],
        ['prefix search', 'too many sparse pointers'],
        ['ordered RAM index', 'implementation complexity'],
      ],
    ),
    highlight: { found: ['art:strength'], compare: ['hash:weakness', 'trie:weakness'] },
    explanation: 'ART sits between familiar structures: trie semantics, tree ordering, hash-table-like point lookup speed on suitable workloads, and enough compactness to work as a database index.',
  };
}

function* prefixCompression() {
  yield {
    state: artShape('Prefix compression collapses single-child paths'),
    highlight: { active: ['root', 'dense', 'e-root-dense'], found: ['ca', 'co'] },
    explanation: 'Plain tries waste memory on long paths where each node has one child. ART stores a compressed prefix in a node, then branches only where keys actually diverge.',
  };

  yield {
    state: labelMatrix(
      'Lookup "cart"',
      [
        { id: 'root', label: 'root' },
        { id: 'prefix', label: 'compressed prefix' },
        { id: 'branch', label: 'branch byte' },
        { id: 'leaf', label: 'leaf check' },
      ],
      [
        { id: 'work', label: 'work' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['compare c', 'choose first edge'],
        ['match ar', 'skip two levels'],
        ['read t', 'select child'],
        ['compare full key', 'guard against compression shortcut'],
      ],
    ),
    highlight: { active: ['prefix:work', 'branch:work'], found: ['leaf:why'] },
    explanation: 'Compression speeds successful searches but still needs a final full-key check. The tree can skip internal nodes; it cannot skip correctness.',
  };

  yield {
    state: labelMatrix(
      'What changes under updates',
      [
        { id: 'insert_shared', label: 'same prefix' },
        { id: 'insert_split', label: 'prefix split' },
        { id: 'delete_sparse', label: 'delete child' },
        { id: 'delete_merge', label: 'single child left' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['add child', 'maybe grow node'],
        ['new divergence', 'split compressed prefix'],
        ['lower fanout', 'maybe shrink node'],
        ['long chain', 'merge prefix'],
      ],
    ),
    highlight: { active: ['insert_split:repair', 'delete_merge:repair'], compare: ['delete_sparse:repair'] },
    explanation: 'ART update logic is mostly local surgery: split a prefix, grow or shrink a node type, and merge chains after deletion. The cost is careful engineering, not new asymptotic magic.',
  };

  yield {
    state: labelMatrix(
      'When ART is a good fit',
      [
        { id: 'oltp', label: 'main-memory OLTP' },
        { id: 'range', label: 'ordered range scans' },
        { id: 'prefix', label: 'prefix keys' },
        { id: 'disk', label: 'cold disk pages' },
      ],
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      [
        ['strong', 'cache-aware point lookup'],
        ['strong', 'keys remain ordered'],
        ['strong', 'trie structure reuses prefixes'],
        ['weaker', 'B-trees page better'],
      ],
    ),
    highlight: { found: ['oltp:fit', 'range:fit', 'prefix:fit'], compare: ['disk:reason'] },
    explanation: 'The paper is a reminder that "O(log n)" is not the whole story. In main memory, cache misses, branches, SIMD scans, and pointer count become part of the data-structure design.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'node growth') yield* nodeGrowth();
  else if (view === 'prefix compression') yield* prefixCompression();
  else throw new InputError('Pick an ART view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An Adaptive Radix Tree is a radix trie designed for main-memory indexes. It stores keys by bytes, compresses common prefixes, and changes node representation as local fanout grows or shrinks.',
        'It matters because memory-resident databases are often limited by CPU cache misses and branch mispredictions, not only by asymptotic comparisons. ART treats hardware layout as part of the structure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each internal node represents one key prefix and branches on the next byte. Instead of one fixed 256-way child array everywhere, ART uses Node4, Node16, Node48, and Node256 layouts. Sparse nodes stay compact; dense nodes become direct and fast.',
        'Path compression stores common prefixes inside nodes. During lookup, the index compares the compressed prefix, follows the next byte, and verifies the final leaf key. Insertions and deletions split prefixes and grow or shrink node layouts locally.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup, insert, and delete are proportional to key length, with local node scans or direct indexing depending on the node type. The hard part is not the big-O notation; it is memory layout, prefix handling, SIMD-friendly comparisons, and update correctness.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'ART-style indexes are relevant for in-memory OLTP engines, ordered key-value stores, prefix-heavy keys, and systems that need both point lookup and ordered scans. It is a useful sibling to B-Trees, Bw-Tree Delta Chain & Mapping Table, tries, hash tables, and learned indexes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'ART is not always a replacement for B-trees. Disk-resident pages, large scans, concurrency, and recovery can favor page-oriented structures. It is also not a hash table: it preserves order and prefix structure, which is exactly why it pays trie complexity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: "The Adaptive Radix Tree: ARTful Indexing for Main-Memory Databases" at https://db.in.tum.de/~leis/papers/ART.pdf. Study Trie, B-Trees (How Databases Read), Hash Table, Database Indexing, Learned Indexes, and Cuckoo Hashing next.',
      ],
    },
  ],
};
