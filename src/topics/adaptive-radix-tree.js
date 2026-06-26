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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The node-growth view shows how a single logical trie lives inside different physical node types: Node4, Node16, Node48, or Node256. Watch the child count at each node and notice when the layout changes. The trie edges stay the same; only the container changes.',
        'The prefix-compression view shows how single-child chains collapse into stored prefixes. A lookup for "cart" skips the compressed "ar" bytes in one hop instead of visiting two intermediate nodes. The leaf still runs a full-key check, because compression hides interior bytes that could disagree.',
        {type: 'image', src: './assets/gifs/adaptive-radix-tree.gif', alt: 'Animated walkthrough of the adaptive radix tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A main-memory database index lives in RAM, so the bottleneck is not disk seeks. It is cache misses, unpredictable branches, pointer chasing, and wasted memory. Big-O notation treats all memory accesses as equal; CPUs do not. A structure that is O(log n) but chases a pointer on every level can be slower in practice than one that is O(m) but touches fewer cache lines.',
        'The Adaptive Radix Tree (ART), introduced by Leis, Kemper, and Neumann in 2013, is an ordered in-memory index for keys treated as byte strings. It keeps the trie properties that hash tables lack -- sorted traversal, prefix search, range queries -- but it changes the physical layout of each node to match that node\'s actual fanout, so sparse nodes stay small and dense nodes stay fast.',
        {type: 'callout', text: 'ART keeps trie order but treats each node as a cache-sensitive layout decision rather than a fixed array.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A hash table gives O(1) average lookup but destroys key order. You cannot do range queries, prefix searches, or ordered iteration without sorting the entire table. A comparison-based tree (BST, AVL, red-black) preserves order with O(log n) lookup, but each comparison examines the full key. For a 200-byte URL, every tree comparison drags through up to 200 bytes, and log n of those comparisons pile up.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in nodes', caption: 'A B-tree shows the competing idea of grouping many keys per node to reduce pointer hops and IO. Source: Wikimedia Commons, CyHawk, CC BY-SA 3.0 or GFDL.'},
        'A B-tree groups many keys per node to reduce pointer hops and exploit disk pages. In RAM, though, the wide node still compares full keys, and the fanout that helps on disk may not help when every byte is already a single-cycle read. A trie is the natural alternative: lookup takes O(m) time for key length m, independent of how many keys are stored. One million keys or one billion keys, the same key takes the same number of steps.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A plain byte trie allocates a 256-entry child-pointer array at every internal node. Each level consumes one byte of the key, and direct indexing into the array makes lookup trivial. Ordered traversal is natural: walk children 0x00 through 0xFF.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie containing words with shared prefixes', caption: 'A trie makes byte-by-byte branching explicit, which is the baseline ART compresses and resizes. Source: Wikimedia Commons, Booyabazooka, public domain.'},
        'The wall is sparsity. In practice, most nodes have far fewer than 256 children. A node with 3 children wastes 253 pointers -- over 2 KB on a 64-bit machine -- and that dead memory pollutes the CPU cache. Replacing the 256-slot array with a small sorted list saves space but makes dense nodes slow: scanning 48 labels on every level adds up. You cannot fix both ends with a single layout.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Instead of one node layout for all fanouts, ART uses four. Each is a different physical encoding of the same logical map from byte to child pointer. Node4 holds up to 4 children in a tiny sorted key array (4 bytes of keys, 4 pointers). Node16 holds up to 16 children in a SIMD-friendly array: a single SSE instruction compares 16 key bytes against the search byte in parallel. Node48 uses a 256-byte index array that maps each possible byte value to a slot in a compact 48-pointer child array -- one indirection, but no scanning. Node256 uses full direct indexing: the search byte is the array index.',
        'When a child is inserted and the node overflows its current type, ART allocates the next-larger type, copies the children, and swaps the pointer. When deletion shrinks a node below its current type\'s minimum useful load, it downgrades. The logical trie never changes; only the container at that node changes.',
        'Path compression handles the other source of waste. A chain of single-child nodes -- common in long shared prefixes like "https://api.example.com/" -- collapses into a stored prefix string inside one node. The trie branches only where keys actually diverge.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lookup starts at the root. At each node, compare the stored compressed prefix (if any) against the corresponding bytes of the search key. If the prefix disagrees, the key is absent. If it agrees, consume the next byte of the key and find the matching child using the node\'s current layout: scan for Node4, SIMD compare for Node16, index lookup for Node48, direct array access for Node256. Repeat until a leaf is reached. At the leaf, compare the full stored key against the search key -- this final check catches false matches created by prefix compression.',
        'Insertion descends to the point of divergence. If the search key diverges inside a compressed prefix, the prefix splits: a new internal node is created at the divergence byte, the old prefix is divided between the new node and the remaining path, and the new key branches off. If the divergence is at a child edge and the current node is full, the node grows to the next type (Node4 to Node16, Node16 to Node48, Node48 to Node256), copies its children, and adds the new child.',
        'Deletion removes the leaf and may shrink the parent node if the child count drops below the current type\'s useful threshold. If a node is left with a single child, that child\'s edge merges into the parent\'s compressed prefix, collapsing the one-child chain.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on the trie invariant: at depth d, every descendant shares the same first d key bytes (plus any compressed prefix bytes stored along the path). A child edge labeled with byte b can only lead to keys whose next unmatched byte is b. This holds regardless of which node type stores the edge, because all four types encode the same byte-to-child map.',
        'Path compression is safe because the compressed bytes are shared by every key in the subtree. If the search key disagrees with any compressed byte, no descendant can match. The final full-key check at the leaf prevents a compressed path from accepting a key that is a prefix of the stored key, or vice versa. "car" and "cart" share a path up to the fourth byte, but the leaf check distinguishes them.',
        'Node growth and shrink are safe because they preserve the mapping exactly. A Node4 with children {a, c, o} upgraded to a Node16 still maps \'a\' to the same child, \'c\' to the same child, \'o\' to the same child. The representation changes; the function does not.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Lookup, insert, and delete are O(m) where m is the key length in bytes, not O(log n) where n is the number of stored keys. For 8-byte integer keys (encoded in big-endian order-preserving form), the tree has at most 8 levels. For a 200-byte URL, at most 200 levels. Doubling the number of stored keys does not add a single level; doubling the key length does.',
        'Space per node depends on the type. Node4 uses roughly 52 bytes (4 key bytes + 4 pointers + header). Node16 uses about 160 bytes. Node48 uses about 656 bytes (256-byte index + 48 pointers + header). Node256 uses about 2,048 bytes (256 pointers + header). In the Leis et al. benchmarks on a 64-bit machine, ART used about 52 bytes per key for dense integer workloads -- comparable to a hash table and far less than a plain 256-way trie.',
        'The hidden costs are node transitions and implementation complexity. Growing a Node4 to Node16 allocates a new node, copies 4 children, and frees the old one. That is bounded work per insert, but it means ART insert is not in-place the way a hash table insert can be. Prefix splits during insertion are similar: bounded work, but careful pointer surgery. The payoff is that the structure never wastes memory on empty slots the way a fixed-width trie does, and it never loses order the way a hash table does.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Main-memory OLTP databases use ART as their primary index. HyPer (now part of Tableau\'s Hyper engine) used ART for its in-memory ordered index. DuckDB uses ART for its default index type. TigerBeetle uses ART for its internal data structures. The common pattern: the workload needs both point lookups and range scans, the data lives in RAM, and a B-tree\'s page-oriented layout brings overhead that buys nothing when there is no disk.',
        'Prefix-heavy key spaces are a natural fit. An in-memory index over URLs shares "https://api.example.com/" across thousands of entries. Path compression stores those 30 shared bytes once. An IP routing table shares long network prefixes. API key indexes share tenant-specific prefixes. In each case, ART reuses the shared bytes instead of comparing them on every lookup.',
        'Fixed-size numeric keys work if the byte encoding preserves sort order (big-endian for unsigned integers, or a sign-flip encoding for signed integers). ART then supports equality lookup, predecessor/successor queries, and range iteration in one index -- the combination that a hash table cannot provide.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Disk-resident data favors B-trees. A B-tree node is sized to fill a disk page (4 KB or 16 KB), so one IO reads dozens of keys. ART nodes are sized for cache lines (64 bytes), which is the wrong granularity for disk. Page-level recovery, write-ahead logging, and cold-scan performance are all mature in B-tree systems and largely absent from ART designs.',
        'Pure point-lookup workloads do not need order. If the application never does range queries, prefix searches, or ordered iteration, a hash table is simpler and often faster. ART\'s four node types and prefix-split logic add implementation weight that buys nothing when the only operation is "give me the value for this exact key."',
        'Concurrency is a hard engineering problem. Growing a Node4 to a Node16 replaces the node pointer. Concurrent readers that hold the old pointer see freed memory unless the system uses latching, epoch-based reclamation, read-copy-update, or optimistic lock coupling (as in the ART-OLC variant by Leis et al. 2016). Production-quality concurrent ART is significantly harder to implement than a concurrent hash table.',
        'Text ordering is another limit. ART orders keys by raw byte value. Human-readable text order requires collation rules, Unicode normalization, case folding, or locale-specific grapheme ordering. Those rules sit above the byte index and can dominate the clean trie model.',
      ],
    },
    {
      heading: 'Worked example',
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
        'Now trace the node types. After all four keys, the root has one child (\'a\'), so it is a Node4. The \'a\' node has one child (\'p\'), Node4. The first \'p\' node has two children (\'p\' and \'t\'), Node4 with sorted keys [p, t]. If we inserted 13 more keys diverging at this byte, the Node4 would grow to Node16 at the 5th child, then to Node48 at the 17th. The trie shape never changes -- only the container at that one node.',
        'Space accounting: four keys stored, seven internal nodes plus four leaf markers. Every internal node is a Node4 (52 bytes each), so the index uses roughly 364 bytes for the internal structure. A hash table for the same four keys uses about 128 bytes (4 slots times 32 bytes per entry), but it cannot answer "give me all keys starting with app" or "what key comes after apple in sorted order."',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Leis, Kemper, Neumann. "The Adaptive Radix Tree: ARTful Indexing for Main-Memory Databases," 2013 (https://db.in.tum.de/~leis/papers/ART.pdf). Defines Node4/Node16/Node48/Node256, benchmarks against B-trees and hash tables, and introduces path compression for ART. Follow-up: Leis et al. "The ART of Practical Synchronization," 2016, covers optimistic lock coupling for concurrent ART. Morrison, "PATRICIA -- Practical Algorithm to Retrieve Information Coded in Alphanumeric," 1968, is the original radix tree that ART extends.',
        'Study next by role. Foundation: Trie (the base invariant -- ART is a trie with adaptive node sizing). Ordered alternative: B-Tree (disk-oriented ordered index -- contrast with ART\'s RAM-oriented design). Unordered alternative: Hash Table (O(1) point lookup when order is unnecessary). Comparison-based alternative: Red-Black Tree (O(log n) full-key comparisons vs. ART\'s O(m) byte walks). Hardware context: SIMD (Node16 search uses SSE/AVX instructions to compare 16 bytes in one cycle). Research frontier: Learned Indexes (replace the index structure with a model that predicts key position).',
      ],
    },
  ],
};
