// Hash array mapped trie: split a key hash into chunks, use each chunk as a
// trie level, and compress sparse child arrays with bitmaps.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hash-array-mapped-trie-hamt',
  title: 'Hash Array Mapped Trie (HAMT)',
  category: 'Data Structures',
  summary: 'The persistent hash-map engine behind immutable collections: hash chunks choose trie branches, bitmaps compress sparse nodes, and updates path-copy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['lookup and bitmap', 'persistent update'], defaultValue: 'lookup and bitmap' },
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

function* lookupAndBitmap() {
  const chunkBits = 5;
  const fanout = 1 << chunkBits; // 32
  const pipelineStages = ['key', 'hash', 'chunk', 'bitmap', 'array', 'leaf'];

  yield {
    state: graphState({
      nodes: [
        { id: 'key', label: 'key', x: 0.8, y: 4.0, note: 'user42' },
        { id: 'hash', label: 'hash', x: 2.3, y: 4.0, note: 'bits' },
        { id: 'chunk', label: '5-bit', x: 3.9, y: 4.0, note: 'level' },
        { id: 'bitmap', label: 'bitmap', x: 5.7, y: 4.0, note: 'occupied' },
        { id: 'array', label: 'array', x: 7.4, y: 4.0, note: 'dense' },
        { id: 'leaf', label: 'value', x: 9.0, y: 4.0, note: 'found' },
      ],
      edges: [
        { id: 'e-key-hash', from: 'key', to: 'hash' },
        { id: 'e-hash-chunk', from: 'hash', to: 'chunk' },
        { id: 'e-chunk-bitmap', from: 'chunk', to: 'bitmap' },
        { id: 'e-bitmap-array', from: 'bitmap', to: 'array' },
        { id: 'e-array-leaf', from: 'array', to: 'leaf' },
      ],
    }, { title: 'A HAMT walks chunks of the hash, not characters' }),
    highlight: { active: ['hash', 'chunk', 'bitmap'], found: ['leaf'] },
    explanation: `A HAMT starts like a Hash Table: hash the key. Then it reads the hash in ${chunkBits}-bit chunks, each selecting one of ${fanout} logical children, and uses those chunks as ${pipelineStages.length}-stage levels in a Trie.`,
    invariant: `Same hash prefix means shared trie path across the ${fanout}-way branching nodes.`,
  };

  yield {
    state: labelMatrix(
      'Bitmap compresses a sparse 32-way node',
      [
        { id: 'slots', label: 'logical slots' },
        { id: 'bitmap', label: 'bitmap' },
        { id: 'rank', label: 'rank' },
        { id: 'dense', label: 'dense array' },
      ],
      [
        { id: 'example', label: 'example' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['0..31', 'virtual fanout'],
        ['bits 2,9,27', 'occupied'],
        ['popcount before 9 = 1', 'array index'],
        ['[slot2, slot9, slot27]', 'compact'],
      ],
    ),
    highlight: { active: ['bitmap:example', 'rank:example'], found: ['dense:meaning'] },
    explanation: `The trick is not storing ${fanout} pointers in every node. A ${fanout}-bit bitmap marks which logical children exist, and popcount maps a logical slot to the compact child-array index.`,
  };

  yield {
    state: labelMatrix(
      'Lookup steps',
      [
        { id: 'l0', label: 'level 0' },
        { id: 'l1', label: 'level 1' },
        { id: 'leaf', label: 'leaf' },
      ],
      [
        { id: 'bits', label: 'hash bits' },
        { id: 'action', label: 'action' },
      ],
      [
        ['00101', 'child 5'],
        ['11010', 'child 26'],
        ['equals key', 'return value'],
      ],
    ),
    highlight: { found: ['leaf:action'], active: ['l0:bits', 'l1:bits'] },
    explanation: `A good hash spreads keys so the trie stays shallow. With ${chunkBits}-bit chunks giving ${fanout}-way branching, collisions are handled at leaves with key equality, collision nodes, or deeper chunks depending on implementation.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'keys', min: 1, max: 1000000 }, y: { label: 'levels at 32-way fanout', min: 0, max: 5 } },
      series: [
        { id: 'depth', label: 'log32 n', points: [{ x: 1, y: 1 }, { x: 1000, y: 2 }, { x: 32768, y: 3 }, { x: 1000000, y: 4 }] },
      ],
    }),
    highlight: { found: ['depth'] },
    explanation: `The branching factor of ${fanout} is why HAMT operations feel close to O(1) in practice. A million keys need only about ${Math.ceil(Math.log(1000000) / Math.log(fanout))} levels of ${chunkBits}-bit chunks before leaf checks.`,
  };
}

function* persistentUpdate() {
  const versions = 2;
  const pathDepth = 3; // root -> A -> B -> leaf
  const copiedNodes = ['root1', 'a1', 'b1', 'leaf1'];

  yield {
    state: graphState({
      nodes: [
        { id: 'root0', label: 'root v0', x: 0.8, y: 2.8, note: 'old map' },
        { id: 'a', label: 'node A', x: 2.8, y: 2.8, note: 'shared' },
        { id: 'b', label: 'node B', x: 4.8, y: 2.8, note: 'shared' },
        { id: 'leaf0', label: 'old val', x: 6.9, y: 2.8, note: 'x=1' },
        { id: 'root1', label: 'root v1', x: 0.8, y: 5.7, note: 'new map' },
        { id: 'a1', label: 'node A', x: 2.8, y: 5.7, note: 'copy' },
        { id: 'b1', label: 'node B', x: 4.8, y: 5.7, note: 'copy' },
        { id: 'leaf1', label: 'new val', x: 6.9, y: 5.7, note: 'x=2' },
      ],
      edges: [
        { id: 'e-r0-a', from: 'root0', to: 'a' },
        { id: 'e-a-b', from: 'a', to: 'b' },
        { id: 'e-b-leaf0', from: 'b', to: 'leaf0' },
        { id: 'e-r1-a1', from: 'root1', to: 'a1' },
        { id: 'e-a1-b1', from: 'a1', to: 'b1' },
        { id: 'e-b1-leaf1', from: 'b1', to: 'leaf1' },
      ],
    }, { title: 'Persistent update copies only the changed path' }),
    highlight: { active: ['root1', 'a1', 'b1', 'leaf1'], compare: ['root0', 'leaf0'] },
    explanation: `Updating an immutable HAMT does not copy the whole map. It copies the ${copiedNodes.length}-node root-to-leaf path selected by the key hash and reuses every untouched branch across ${versions} versions.`,
    invariant: `Old roots still point to old nodes — both ${versions} versions coexist safely.`,
  };

  yield {
    state: labelMatrix(
      'Update cost',
      [
        { id: 'lookup', label: 'lookup' },
        { id: 'set', label: 'set key' },
        { id: 'delete', label: 'delete key' },
        { id: 'iterate', label: 'iterate' },
      ],
      [
        { id: 'cost', label: 'cost' },
        { id: 'why', label: 'why' },
      ],
      [
        ['O(hash chunks)', 'shallow trie'],
        ['O(depth) copies', 'path copy'],
        ['O(depth) copies', 'maybe shrink'],
        ['O(n)', 'visit leaves'],
      ],
    ),
    highlight: { found: ['set:cost', 'delete:cost'], compare: ['iterate:cost'] },
    explanation: `Asymptotically, HAMT depth is logarithmic in the number of keys with a large base. A persistent set costs O(${pathDepth}) copies per update — dominated by hashing, popcount, allocation, and cache locality.`,
  };

  yield {
    state: labelMatrix(
      'Why immutable maps use HAMTs',
      [
        { id: 'undo', label: 'undo' },
        { id: 'state', label: 'app state' },
        { id: 'share', label: 'sharing' },
        { id: 'batch', label: 'batch build' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'caveat', label: 'caveat' },
      ],
      [
        ['old roots', 'memory retained'],
        ['cheap snapshots', 'allocation'],
        ['copy path only', 'pointer chasing'],
        ['transient mutation', 'API discipline'],
      ],
    ),
    highlight: { active: ['undo:benefit', 'state:benefit', 'share:benefit'], compare: ['batch:caveat'] },
    explanation: `Immutable collections want old ${versions} versions to remain usable. HAMTs make that affordable by copying only ${copiedNodes.length} nodes per update, while transient builders or batched mutation often recover construction speed when many updates happen together.`,
  };

  yield {
    state: labelMatrix(
      'Compare structures',
      [
        { id: 'hash', label: 'hash table' },
        { id: 'trie', label: 'trie' },
        { id: 'hamt', label: 'HAMT' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'trade', label: 'tradeoff' },
      ],
      [
        ['flat lookup', 'resize/mutate'],
        ['prefix lookup', 'alphabet nodes'],
        ['persistent map', 'hash+bitmap'],
      ],
    ),
    highlight: { found: ['hamt:strength'], compare: ['hash:strength', 'trie:strength'] },
    explanation: `A HAMT is not a replacement for every hash table. With ${pathDepth}-level path copying across ${versions} versions, it is the versioned-map answer when updates should return a new map and old maps must keep working.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'lookup and bitmap') yield* lookupAndBitmap();
  else if (view === 'persistent update') yield* persistentUpdate();
  else throw new InputError('Pick a HAMT view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. In "lookup and bitmap," the pipeline diagram traces a key from hashing through 5-bit chunk extraction, bitmap check, popcount-based indexing, and finally leaf retrieval. The matrix frames below it break down each step with concrete values. Watch for the highlighted bitmap and rank rows — they show how a 32-wide logical node compresses into a compact array.',
        {type: 'image', src: './assets/gifs/hash-array-mapped-trie-hamt.gif', alt: 'Animated walkthrough of the hash array mapped trie hamt visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'In "persistent update," two roots (v0 and v1) appear on screen simultaneously. The highlighted nodes are copies made during the update; everything else is shared structure. The matrix frames compare operation costs and list the practical reasons immutable maps use HAMTs.',
        'Use the play button for a paced walkthrough. Step manually with the slider when you want to study one frame in detail. The invariant line at the bottom gives the structural guarantee that holds after each step.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Programs that manage state often need both mutation and history. A text editor needs undo. A React app needs to compare old and new state trees without deep equality checks. A concurrent server needs multiple readers to see consistent snapshots while a writer prepares the next version. All of these require a map that can produce a new version cheaply without destroying the old one.',
        {type: 'callout', text: 'A HAMT makes immutable maps cheap by copying only the hash-prefix path that changed and sharing every untouched branch.'},
        'A hash array mapped trie (HAMT) solves this. It is an associative map — like a hash table, it stores key-value pairs and supports get, set, and delete — but its internal structure is a wide trie built from chunks of each key\'s hash. That trie structure is what makes cheap versioning possible: updating one key only affects the nodes on that key\'s hash-chunk path, so the update can copy just those nodes and share everything else with the old version.',
        'HAMTs sit between hash tables and tries. They hash arbitrary keys (like a hash table), descend through prefix chunks (like a trie), and use bitmaps to compress the sparse 32-child arrays that would otherwise waste memory at every internal node. The result is a practical persistent map used by Clojure, Scala, Immutable.js, and Haskell\'s unordered-containers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The mutable baseline is a flat hash table. Hash the key, index into a bucket array, resolve any collision, and mutate the bucket in place. This is O(1) amortized for get, set, and delete, and it uses memory proportional to the number of entries. When you only need one live version of the map, this is hard to beat.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg', alt: 'Hash table with chaining showing keys mapped to buckets', caption: 'A flat hash table is the mutable baseline: hash once, choose a bucket, and update in place. HAMT keeps the hash idea but turns hash chunks into a trie path. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.'},
        'The naive immutable approach is to copy the entire table on every update. If the table has n entries, a single set operation costs O(n) just to duplicate the bucket array. That preserves old versions perfectly — the old copy is untouched — but the cost is absurd for maps with thousands or millions of entries.',
        'A second baseline is a plain trie keyed on the characters or digits of each key. Tries support path-copying naturally (only the root-to-leaf path needs copying), but a trie over raw keys has two problems: the alphabet may be huge (256 byte values, or the full Unicode range), and key lengths vary wildly. Most internal nodes are nearly empty, wasting memory on null child pointers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the cost of snapshots. Any system that needs old map versions to remain valid — undo, time-travel debugging, concurrent readers, structural sharing in a UI framework — must either copy the whole map or find a way to share unchanged parts. Full-copy persistence is O(n) per update, which makes it useless for hot paths.',
        'The plain trie avoids full copies but creates a different wall: memory waste. A trie over byte-valued keys has 256 child slots per internal node, and most of them are null. A trie over hash bits with 1-bit chunks avoids waste but becomes extremely deep (32 levels for a 32-bit hash), which means 32 pointer dereferences per lookup — a cache-miss nightmare.',
        'The fundamental tension is between branching factor and sparsity. A wide branching factor (say 32) keeps the trie shallow, but most internal nodes have far fewer than 32 children. Allocating 32 pointers per node wastes memory. Allocating fewer makes the trie deeper. Neither extreme works.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use the hash as a trie path, and compress sparse nodes with bitmaps. Hash the key to get a fixed-width integer (say 32 bits). Read the first 5 bits to choose one of 32 logical children at the root. Read the next 5 bits for the next level, and so on. The hash turns arbitrary keys into fixed-length numeric paths, and the 5-bit chunking gives 32-way branching in a trie that is at most 7 levels deep.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie containing words with shared prefixes', caption: 'A trie shows the path-sharing idea directly. HAMT replaces character prefixes with hash-bit chunks and compresses sparse child arrays with bitmaps. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'The bitmap solves the sparsity problem. Each internal node stores a single 32-bit integer where bit i is 1 if logical child i exists. The actual children are stored in a compact array with no gaps. To find the array index for logical child i, count the number of 1-bits before position i (popcount). This maps a 32-wide logical node to an array holding only the children that actually exist.',
        'The invariant is: a hash-prefix chunk sequence selects a unique logical path through the trie. If an update changes one key, only the nodes on that key\'s path need to change. Every sibling branch is structurally independent and can be shared between the old and new versions. This is what makes path-copying cheap — in a tree with a million entries and a branching factor of 32, the path is only 4 nodes long.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lookup hashes the key, extracts the first 5-bit chunk, and checks the root\'s bitmap at that bit position. If the bit is 0, the key is not in the map. If it is 1, popcount of the lower bits gives the index into the compact child array. Descend to that child, extract the next 5-bit chunk, and repeat. At a leaf node, compare the stored key with the lookup key — hash equality does not guarantee key equality.',
        'Set (persistent) follows the same descent but copies each node on the path. At the target level, the implementation creates a new leaf (or updates an existing one), creates a new parent with the updated child pointer, and so on back to the root. The new root is the return value. The old root still points to the old nodes, so both versions coexist. Branches not on the edited path are shared by reference.',
        'Delete also path-copies. If removing a child leaves an internal node with only one remaining child that is a leaf, the node can be collapsed upward. Set and delete both cost O(depth) node allocations, which is O(log_32 n).',
        'Collisions require explicit handling. Two keys can have identical 32-bit hashes, so leaves must store the actual key for equality checks. Implementations use collision nodes (small lists of entries that share a hash prefix), or extend the hash with additional bits. A correct HAMT never assumes equal hashes imply equal keys.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correct lookup follows from the path invariant. Every key is placed at the trie position determined by its hash chunks. A future lookup for the same key computes the same hash, extracts the same chunks, and follows the same path to the same leaf. If the key was inserted, the lookup finds it. If not, a 0-bit in some bitmap terminates the search.',
        'Correct persistence follows from the immutability of shared nodes. A persistent set copies the root-to-leaf path and returns a new root. The old root still references the old nodes. Since the shared branches were never modified — only referenced — they are valid for both versions. This is the same structural-sharing principle that makes git\'s content-addressed tree work.',
        'Correct bitmap compression follows from the rank property of popcount. If k bits are set before position i in the bitmap, then logical child i is stored at index k in the compact array. The mapping is bijective: each set bit corresponds to exactly one array slot, and no slot is wasted. Inserting a new child means setting a bit, incrementing all later ranks by one, and splicing the child into the compact array at the correct position.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Depth is O(log_32 n). With 32-way branching, 32 keys need 1 level, 1024 need 2, about 33,000 need 3, and a million need 4. The maximum depth for a 32-bit hash is 7 (ceil(32/5)). In practice, most lookups touch 3-4 nodes. This is close enough to O(1) that HAMTs are often described as "effectively constant time."',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in internal nodes', caption: 'Wide branching is the shared performance idea: a B-tree uses wide page nodes for storage locality, while a HAMT uses wide hash chunks for shallow immutable lookup. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
        'The constant factors matter. Every lookup pays for hashing, bit shifting, bitmap testing, popcount, and pointer dereferencing. Every persistent update additionally pays for allocating new nodes along the copied path. A flat mutable hash table avoids all of this overhead: one hash, one array index, done. When you do not need versioning, the HAMT\'s structural overhead is pure cost.',
        'Memory is the central tradeoff. A bitmap node stores a 32-bit integer plus a compact child array, which is efficient for sparse nodes. But persistent versions retain old nodes as long as old roots are reachable. If you keep every version of a map that is updated a million times, you accumulate millions of path-copy nodes. Transient mutation APIs (Clojure\'s transient, Immutable.js\'s withMutations) let you batch many updates into a single version, reducing allocation pressure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Clojure\'s persistent hash map is a HAMT with 32-way branching. Every assoc returns a new map; the old map remains valid. This is the backbone of Clojure\'s immutable-by-default philosophy, enabling safe concurrency without locks. Scala\'s immutable.HashMap uses the same design.',
        'Immutable.js (used heavily in the React ecosystem before hooks) implements Map and Set as HAMTs. When a React component updates state with Immutable.js, the framework can detect changes via reference equality on the root — if the root pointer changed, something changed; if not, the subtree is unchanged. This enables O(1) shouldComponentUpdate checks.',
        'Git\'s content-addressed object store uses the same structural-sharing principle, though not literally a HAMT. Each commit points to a tree, and unchanged subtrees are shared across commits. The conceptual link is the same: copy only the changed path, share everything else.',
        'Compiler intermediate representations use HAMTs or similar persistent maps for symbol tables during speculative optimization passes. The compiler can try a transformation, check whether it improves the code, and discard the new version by simply dropping the new root. No rollback logic is needed.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'When you only need one mutable map, a HAMT is overhead. A flat hash table with open addressing has better cache locality (entries are contiguous in memory), no bitmap/popcount overhead, and no allocation per update. For a private map inside a tight loop, a conventional hash table wins.',
        'HAMTs are not ordered. Iteration order depends on hash values, not key order. If you need sorted iteration, range queries, or nearest-key lookups, use a balanced BST (red-black tree, AVL tree) or a B-tree. Some libraries layer an ordering index on top of a HAMT, but that adds complexity and memory.',
        'Poor hash functions degrade HAMT performance just as they degrade hash tables. If many keys share hash prefixes, those keys pile into the same subtree, increasing depth and collision-node usage. Adversarial inputs can exploit a known hash function to force worst-case behavior. The defense is the same as for hash tables: use a keyed hash like SipHash with a random seed.',
        'Memory retention can be surprising. Holding a reference to an old root prevents garbage collection of the entire path-copy chain leading to that root. In a long-running application that keeps many versions, old HAMT nodes can accumulate silently. Profiling memory by counting live roots is essential.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Insert key "user42" into an empty HAMT. Hash "user42" to get a 32-bit integer; suppose the first 5 bits are 00101 (decimal 5) and the next 5 bits are 11010 (decimal 26). The root starts empty: bitmap = 0, children = []. Set bit 5 in the root bitmap, creating a single-child node. The child array becomes [leaf("user42", value)]. The root bitmap is now 0b00000000000000000000000000100000.',
        'Now insert "admin7," whose hash starts with 00101 (also decimal 5). At the root, bit 5 is already set, so we descend to the child at popcount(bitmap & 0b00011111) = popcount(0) = index 0. That child is the "user42" leaf, not an internal node, so we must split: create a new internal node at level 1, place "user42" at the position given by its second chunk (11010 = slot 26), and place "admin7" at the position given by its second chunk (suppose 01001 = slot 9). The level-1 bitmap has bits 9 and 26 set, and the compact child array holds two leaves.',
        'To look up "user42" later: hash it, extract chunk 00101 = 5, check root bitmap bit 5 (set), compute popcount of lower bits (0 bits set below 5, so index 0), descend to the level-1 node. Extract chunk 11010 = 26, check bitmap bit 26 (set), compute popcount of lower bits (bit 9 is set, so 1 bit below 26, index 1), arrive at a leaf, compare stored key "user42" with lookup key "user42" — match, return the value.',
        'For a persistent update, changing "user42"\'s value from x=1 to x=2: copy the root (new bitmap, new child array pointing to a copy of the level-1 node), copy the level-1 node (new bitmap, new child array with a new leaf for "user42" holding x=2). The old root still points to the old level-1 node, which still points to the old leaf with x=1. Both versions coexist. Total allocation: 3 new objects (root, level-1 node, leaf). Everything else is shared.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Bagwell, P. (2001). "Ideal Hash Trees" (https://lampwww.epfl.ch/papers/idealhashtrees.pdf) — the original HAMT paper describing bitmap compression and the 32-way branching design. Hickey, R. "Clojure Persistent Data Structures" — the practical implementation that popularized HAMTs in production. Immutable.js documentation (https://immutable-js.com/docs/v5/Map/) and the hamt library for JavaScript (https://github.com/mattbierner/hamt) provide working implementations to study.',
        'Study Hash Table for the mutable baseline that HAMT extends. Study Trie for the prefix-path structure that HAMT inherits. PATRICIA Trie shows how tries compress long runs of single-child nodes. Persistent Segment Tree demonstrates path-copying in a different context (range queries). Git Internals illustrates structural sharing in a content-addressed tree. MVCC Internals shows how databases achieve versioned storage at scale using a similar copy-on-write philosophy.',
      ],
    },
  ],
};
