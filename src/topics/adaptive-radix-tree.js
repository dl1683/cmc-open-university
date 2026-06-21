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
  const graph = artShape('ART is a radix trie tuned for CPU caches');
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;

  yield {
    state: graph,
    highlight: { active: ['root', 'c', 'e-root-c'], found: ['ca'] },
    explanation: `An Adaptive Radix Tree indexes keys byte by byte like a trie across ${nodeCount} example nodes linked by ${edgeCount} edges, but it is engineered as a main-memory database index. It preserves sorted order like a tree and supports prefix/range work that a hash table cannot.`,
  };

  const nodeTypeRows = [
    { id: 'n4', label: 'Node4' },
    { id: 'n16', label: 'Node16' },
    { id: 'n48', label: 'Node48' },
    { id: 'n256', label: 'Node256' },
  ];
  const nodeTypeCols = [
    { id: 'children', label: 'children' },
    { id: 'representation', label: 'representation' },
    { id: 'fit', label: 'fit' },
  ];
  const capacities = [4, 16, 48, 256];

  yield {
    state: labelMatrix(
      'ART node types grow with fanout',
      nodeTypeRows,
      nodeTypeCols,
      [
        ['up to 4', 'small key array', 'very sparse'],
        ['up to 16', 'SIMD-friendly scan', 'small branch fanout'],
        ['up to 48', 'byte -> slot indirection', 'medium fanout'],
        ['up to 256', 'direct child array', 'dense fanout'],
      ],
    ),
    highlight: { found: ['n4:fit', 'n16:fit', 'n48:fit'], active: ['n256:representation'] },
    explanation: `The adaptive part is literal. A sparse node should not pay for ${capacities[3]} child pointers. A dense node should not linearly scan dozens of labels. ART offers ${nodeTypeRows.length} node types across ${nodeTypeCols.length} attributes, changing representation as the local fanout changes.`,
    invariant: `Use the smallest of the ${nodeTypeRows.length} node layouts (capacity ${capacities[0]} to ${capacities[capacities.length - 1]}) that can represent the current fanout efficiently.`,
  };

  const insertRows = [
    { id: 'before', label: 'before' },
    { id: 'insert', label: 'insert p' },
    { id: 'after', label: 'after' },
    { id: 'future', label: 'future growth' },
  ];
  const insertData = [
    ['2 children', 'Node4'],
    ['3 children', 'still Node4'],
    ['cat/car/cape', 'compact'],
    ['5th child', 'grow to Node16'],
  ];

  yield {
    state: labelMatrix(
      'Insert "cape" into a small c/a prefix',
      insertRows,
      [
        { id: 'fanout', label: 'fanout' },
        { id: 'node', label: 'node type' },
      ],
      insertData,
    ),
    highlight: { active: ['insert:fanout', 'after:node'], compare: ['future:node'] },
    explanation: `Insertion is not tree rotation. It is local node replacement: when a ${insertData[0][1]} gets a ${insertData[3][0].split(' ')[0]}th child, allocate a ${insertData[3][1].split('grow to ')[1]}, copy children, and continue across all ${insertRows.length} stages. The logical trie stays the same.`,
  };

  const compareRows = [
    { id: 'btree', label: 'B-tree' },
    { id: 'hash', label: 'hash table' },
    { id: 'trie', label: 'plain trie' },
    { id: 'art', label: 'ART' },
  ];

  yield {
    state: labelMatrix(
      'How ART compares',
      compareRows,
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
    explanation: `ART sits between ${compareRows.length} familiar structures: trie semantics, tree ordering, hash-table-like point lookup speed on suitable workloads, and enough compactness to work as a database index.`,
  };
}

function* prefixCompression() {
  const graph = artShape('Prefix compression collapses single-child paths');
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const denseNode = graph.nodes.find(n => n.id === 'dense');

  yield {
    state: graph,
    highlight: { active: ['root', 'dense', 'e-root-dense'], found: ['ca', 'co'] },
    explanation: `Plain tries waste memory on long paths where each node has one child. ART stores a compressed prefix in a node (the graph has ${nodeCount} nodes and ${edgeCount} edges), then branches only where keys actually diverge, as the "${denseNode.label}" node illustrates.`,
  };

  const lookupRows = [
    { id: 'root', label: 'root' },
    { id: 'prefix', label: 'compressed prefix' },
    { id: 'branch', label: 'branch byte' },
    { id: 'leaf', label: 'leaf check' },
  ];
  const lookupData = [
    ['compare c', 'choose first edge'],
    ['match ar', 'skip two levels'],
    ['read t', 'select child'],
    ['compare full key', 'guard against compression shortcut'],
  ];

  yield {
    state: labelMatrix(
      'Lookup "cart"',
      lookupRows,
      [
        { id: 'work', label: 'work' },
        { id: 'why', label: 'why it matters' },
      ],
      lookupData,
    ),
    highlight: { active: ['prefix:work', 'branch:work'], found: ['leaf:why'] },
    explanation: `Compression speeds successful searches across ${lookupRows.length} steps but still needs a final full-key check ("${lookupData[3][0]}"). The tree can skip internal nodes; it cannot skip correctness.`,
  };

  const updateRows = [
    { id: 'insert_shared', label: 'same prefix' },
    { id: 'insert_split', label: 'prefix split' },
    { id: 'delete_sparse', label: 'delete child' },
    { id: 'delete_merge', label: 'single child left' },
  ];
  const updateData = [
    ['add child', 'maybe grow node'],
    ['new divergence', 'split compressed prefix'],
    ['lower fanout', 'maybe shrink node'],
    ['long chain', 'merge prefix'],
  ];

  yield {
    state: labelMatrix(
      'What changes under updates',
      updateRows,
      [
        { id: 'effect', label: 'effect' },
        { id: 'repair', label: 'repair' },
      ],
      updateData,
    ),
    highlight: { active: ['insert_split:repair', 'delete_merge:repair'], compare: ['delete_sparse:repair'] },
    explanation: `ART update logic covers ${updateRows.length} cases of local surgery: ${updateData[1][1]}, grow or shrink a node type, and ${updateData[3][1]} after deletion. The cost is careful engineering, not new asymptotic magic.`,
  };

  const fitRows = [
    { id: 'oltp', label: 'main-memory OLTP' },
    { id: 'range', label: 'ordered range scans' },
    { id: 'prefix', label: 'prefix keys' },
    { id: 'disk', label: 'cold disk pages' },
  ];
  const fitData = [
    ['strong', 'cache-aware point lookup'],
    ['strong', 'keys remain ordered'],
    ['strong', 'trie structure reuses prefixes'],
    ['weaker', 'B-trees page better'],
  ];
  const strongCount = fitData.filter(r => r[0] === 'strong').length;

  yield {
    state: labelMatrix(
      'When ART is a good fit',
      fitRows,
      [
        { id: 'fit', label: 'fit' },
        { id: 'reason', label: 'reason' },
      ],
      fitData,
    ),
    highlight: { found: ['oltp:fit', 'range:fit', 'prefix:fit'], compare: ['disk:reason'] },
    explanation: `The paper is a reminder that "O(log n)" is not the whole story. ${strongCount} of ${fitRows.length} use-case rows rate "${fitData[0][0]}"; in main memory, cache misses, branches, SIMD scans, and pointer count become part of the data-structure design.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  const views = ['node growth', 'prefix compression'];
  if (view === views[0]) yield* nodeGrowth();
  else if (view === views[1]) yield* prefixCompression();
  else throw new InputError(`Pick an ART view from ${views.length} options: ${views.join(', ')}.`);
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `A main-memory database index has a different bottleneck from a disk index. The data is already in RAM, so the cost shifts to cache misses, unpredictable branches, pointer chasing, and wasted memory. Big-O alone hides those costs.`,
        `An Adaptive Radix Tree, or ART, is an ordered in-memory index for keys that can be treated as byte strings. It keeps trie-style prefix search and sorted traversal, but it changes each node layout to match that node\'s fanout.`,
        {type: `callout`, text: `ART keeps trie order but treats each node as a cache-sensitive layout decision rather than a fixed array.`},
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `A plain byte trie is the natural baseline. Each level consumes one byte of the key, and a 256-entry child array gives direct access to the next edge. Lookup is simple and ordered traversal is natural.`,
        {type: `image`, src: `https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg`, alt: `Trie containing words with shared prefixes`, caption: `A trie makes byte-by-byte branching explicit, which is the baseline ART compresses and resizes. Source: Wikimedia Commons, Booyabazooka, public domain.`},
        `The wall is sparsity. Most nodes lack 256 children. Allocating 256 pointers for every node wastes memory and cache. Replacing the array with a small child list saves space, but dense nodes become slow scans. A hash table gives fast exact lookup, but it loses sorted order and prefix scans.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `ART stores keys as byte sequences. Internal nodes represent prefixes. Leaves store full keys or references to records, and a final full-key check protects correctness when prefixes are compressed.`,
        `The adaptive layouts are the core idea. Node4 stores up to 4 children with a tiny key array. Node16 stores up to 16 children and can use SIMD-friendly label checks. Node48 uses a 256-byte index from key byte to child slot, pointing into a compact child array. Node256 uses direct indexing for dense fanout.`,
        `Path compression removes long chains of one-child nodes. A node can store a shared prefix and branch only where keys diverge. That saves memory and reduces the number of pointer hops during lookup.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Lookup compares the compressed prefix at the current node, consumes the next byte of the key, and finds the matching child using the node\'s current representation. A sparse node scans a few labels. A dense node uses an indirection table or direct array access.`,
        `Insertion descends to the divergence point. If a compressed prefix no longer matches, the prefix splits and a new branch is inserted. If a node outgrows its layout, ART replaces it with the next larger layout and copies the child set. Deletion can shrink a node or merge a single-child path back into a compressed prefix.`,
        `The logical trie stays the same when a node grows from Node4 to Node16 or shrinks from Node48 to Node16. Only the physical representation changes.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `Correctness comes from the trie invariant. At depth d, the path has matched the first d bytes, plus any compressed prefix stored along the way. A child edge labeled with byte b can only contain keys whose next byte is b.`,
        `Path compression is safe because the compressed bytes are shared by every descendant. If the lookup key disagrees with those bytes, no descendant can match. If the prefix agrees, the search can skip the removed one-child nodes without changing the represented key set.`,
        `Adaptive node growth is safe because it preserves the same mapping from edge byte to child pointer. Node4, Node16, Node48, and Node256 are different encodings of the same child map. The final full-key check prevents a compressed path from accepting a prefix as a complete key.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Lookup, insert, and delete are proportional to key length, not to the number of stored keys in the comparison-tree sense. For fixed-width keys such as 64-bit integers encoded in order-preserving byte form, lookup has a small bounded number of levels.`,
        `The practical cost is memory layout. Node4 saves space but does a tiny scan. Node16 spends more local comparison work to avoid a larger array. Node48 pays one indirection to avoid 256 child pointers. Node256 spends memory to make dense lookup direct.`,
        `Updates can allocate and copy a local node during growth or shrink. That cost is bounded by the node representation size, but it makes implementation more complex than a simple hash table or plain trie.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `ART fits main-memory OLTP indexes, ordered key-value stores, prefix-heavy keys, and systems that need both point lookup and ordered scans. It is especially useful when a hash table is too unordered and a page-oriented B-tree carries unnecessary RAM overhead.`,
        `A concrete example is an in-memory index over URLs or API keys. Many keys share prefixes such as https://, /users/, or api:. Path compression stores those shared bytes once, while adaptive nodes avoid paying for dense arrays at sparse branch points.`,
        `ART also works for fixed-size numeric keys if the bytes preserve sort order. That lets the structure support equality lookup, predecessor/successor operations, and range iteration in one index.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `ART isn\'t automatically better than a B-tree. Disk-resident data, page-level recovery, long scans over cold storage, and mature concurrency control can favor B-tree or B+ tree designs.`,
        `It also isn\'t a drop-in replacement for a hash table. If the workload only needs exact lookup and doesn\'t care about order, prefix queries, or range scans, hashing may be simpler and faster.`,
        `Text keys bring another limit. ART orders bytes. User-facing text order may need collation, normalization, case folding, or grapheme rules above the raw byte index. Those rules can dominate the clean trie model.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `The node-growth view is about local fanout. Watch how the same logical trie edge map can live inside Node4, Node16, Node48, or Node256 depending on how many children the node has.`,
        `The prefix-compression view is about skipped one-child paths. The compressed prefix saves nodes, but the leaf still needs a full-key check so a prefix match does not become a false positive record lookup.`,
      
        {type: 'image', src: './assets/gifs/adaptive-radix-tree.gif', alt: 'Animated walkthrough of the adaptive radix tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Keep node growth and shrink logic isolated. Replacing a Node4 with a Node16 should preserve the exact child-byte mapping. Path split and merge code should be tested with keys that diverge at the first byte, middle byte, and final byte.`,
        `Decide the byte ordering for every key type. Integers, floats, strings, and composite keys need encodings that preserve the intended sort order, or range scans will be wrong even when point lookup appears to work.`,
      ],
    },
    {
      heading: `Worked example`,
      paragraphs: [
        `A main-memory database stores customer records keyed by tenant id plus user id. A hash table can answer exact lookup, but range scans by tenant and ordered pagination need key order. A B-tree works, but its page-oriented layout is not ideal when all nodes live in RAM.`,
        `ART stores the encoded composite key byte by byte. Shared tenant prefixes compress naturally, sparse branch points use small nodes, and dense byte positions grow into larger nodes. The index supports exact lookup, prefix scans for one tenant, and ordered iteration without switching data structures.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Concurrency is a hard part of production ART. Node replacement during growth or shrink must coordinate with readers that may still hold old pointers. Implementations need latching, epoch reclamation, copy-on-write, or another memory-safety strategy.`,
        `Prefix compression can also create subtle bugs around keys that are prefixes of other keys. The leaf/full-key check and terminal marker policy must distinguish "car" from "cart" even when the path shares every byte of the shorter key.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Primary source: "The Adaptive Radix Tree: ARTful Indexing for Main-Memory Databases" at https://db.in.tum.de/~leis/papers/ART.pdf. Study Trie for the base invariant, B-Trees (How Databases Read) for page-oriented ordered indexes, Hash Table and Cuckoo Hashing for exact lookup alternatives, Database Indexing for query-planner context, and Learned Indexes for another main-memory index design.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Index keys for fast lookup. Hash table: O(1) average but no order — can\'t do range queries or prefix searches. BST/AVL/Red-Black: O(log n) with order, but each comparison examines the entire key. For long keys (URLs, file paths): comparison cost dominates.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in nodes', caption: 'A B-tree shows the competing idea of grouping many keys per node to reduce pointer hops and IO. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
        'Trie: O(m) lookup for key length m — independent of n. But each node needs space for all possible children (256 for bytes). Sparse nodes waste memory. Radix tree (Patricia trie): compress single-child chains into one node. Saves space but node types vary.',
        'ART (Adaptive Radix Tree, Leis et al. 2013): radix tree with four node types that adapt to density: Node4 (≤4 children, sorted array), Node16 (≤16, SIMD-searchable array), Node48 (≤48, 256-entry index → 48 child pointers), Node256 (full 256-pointer array). As children are added or removed, nodes grow or shrink between types. Result: space-efficient like a hash table, order-preserving like a tree, O(m) per lookup. Height = key length in bytes, not log(n). Used in: database indexes (HyPer, DuckDB, TigerBeetle), IP routing tables, file system path lookup.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Leis et al. 2013: "The Adaptive Radix Tree: ARTful Indexing for Main-Memory Databases" — the original paper defining Node4/Node16/Node48/Node256 and benchmarking against B-trees and hash tables for main-memory workloads. Morrison 1968: "PATRICIA — Practical Algorithm to Retrieve Information Coded in Alphanumeric" — the original radix tree that ART extends.',
        'Study next: Trie (the conceptual foundation — ART is a trie with adaptive node sizing), B-Tree (disk-oriented ordered alternative — contrast with ART\'s RAM-oriented design), Hash Table (unordered O(1) alternative — wins when order and prefix queries are unnecessary), Red-Black Tree (comparison-based ordered alternative — O(log n) key comparisons vs. ART\'s O(m) byte walks), SIMD (Node16 search uses SIMD instructions to compare 16 bytes in parallel).',
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Insert keys: "app", "apple", "application", "apt". After "app": root→a→p→p (leaf). After "apple": the p node gets child l→e (leaf). The "app" prefix is shared. After "application": l node path compression — "le" becomes a prefix node, then e leaf and i→"cation" leaf. After "apt": p node now has 2 children (p and t). It is a Node4 (≤4 children, sorted array [p, t]).',
            'Search "apple": root→a→p→p→l→e. 5 byte comparisons, found. Search "api": root→a→p→? No i child → not found. 3 byte comparisons. Search cost depends on key length, not on the number of stored keys. 1 million keys or 1 billion keys: same lookup time for the same key.',
            'Invariant: at depth d, every descendant shares the same first d key bytes (plus any compressed prefix). A child edge labeled b can only lead to keys whose next byte is b.',
            'Edge case: inserting "app" when "apple" already exists forces a prefix split — the compressed "le" prefix must become a branch node so "app" can terminate as a leaf at the divergence point.',
          ],
        },
      ],
    },
    {
      heading: 'Try this now',
      paragraphs: [
        'Node type transitions. Start with Node4 for a node\'s children: keys [l, t]. Add r (for "apr"): [l, r, t]. Add s: [l, r, s, t]. Full! Add u: grow to Node16. Node16 stores 16 keys in a SIMD-friendly array. Lookup: load all 16 keys into a SIMD register, compare against search byte in parallel — one instruction, constant time for up to 16 children.',
        'At 17 children: grow to Node48. Node48 uses a 256-byte index (one byte per possible child value) pointing into 48 child slots. Index lookup: O(1). At 49 children: grow to Node256. Full 256-pointer array — one pointer per possible byte value. No search needed, direct index.',
        'Space: Node4 uses 52 bytes. Node256 uses 2048 bytes. Adaptive sizing means sparse nodes (most nodes in practice) use 40x less memory than fixed-256 nodes. Predict the node type at each step, then run the animation to check.',
      ],
    },
  ],
};
