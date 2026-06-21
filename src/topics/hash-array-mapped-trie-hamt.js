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
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/hash-array-mapped-trie-hamt.gif', alt: 'Animated walkthrough of the hash array mapped trie hamt visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'What It Is',
      paragraphs: [
        'A hash array mapped trie, usually shortened to HAMT, is an associative-map data structure built from hash bits. It behaves like a hash map at the API level, but internally it is a wide trie over chunks of each key hash.',
        {type: 'callout', text: 'A HAMT makes immutable maps cheap by copying only the hash-prefix path that changed and sharing every untouched branch.'},
        'The structure is famous because it makes persistent maps practical. Updating a persistent HAMT returns a new root while sharing most of the old structure. The old map still works because the update copies only the nodes on the edited path.',
        'HAMTs sit between Hash Table and Trie. They hash arbitrary keys like a hash table, descend through prefix chunks like a trie, and use bitmaps to avoid allocating a mostly empty 32-child array at every internal node.',
      ],
    },
    {
      heading: 'The Baseline and the Wall',
      paragraphs: [
        'The obvious mutable baseline is a flat hash table. It hashes a key, indexes a bucket array, resolves collisions, and mutates a bucket in place. That is excellent when there is only one current table and no old version must remain valid.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Hash_table_5_0_1_1_1_1_1_LL.svg', alt: 'Hash table with chaining showing keys mapped to buckets', caption: 'A flat hash table is the mutable baseline: hash once, choose a bucket, and update in place. HAMT keeps the hash idea but turns hash chunks into a trie path. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Hash_table_5_0_1_1_1_1_1_LL.svg.'},
        'The naive immutable baseline copies the whole table on every set or delete. That preserves old versions, but it turns a one-key change into O(n) bucket copying. A second baseline, a plain trie, avoids whole-table copies but wastes memory when the alphabet is large and most branches are empty.',
        'The wall is snapshot cost. Persistent maps need old roots to stay valid, but a full copy per update is too expensive for UI state, undo, speculative transforms, and functional programming workloads.',
      ],
    },
    {
      heading: 'Core Insight and Invariant',
      paragraphs: [
        'Use the hash as a path. At level 0, read one chunk of hash bits. At level 1, read the next chunk, and so on until a leaf or collision node is reached. With 5-bit chunks, each internal node has 32 logical slots.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie containing words with shared prefixes', caption: 'A trie shows the path-sharing idea directly. HAMT replaces character prefixes with hash-bit chunks and compresses sparse child arrays with bitmaps. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'The invariant is that a hash-prefix chunk sequence selects a unique logical path. If an update changes one key, only the nodes on that path can change. Every sibling branch is independent of that key and can be shared with the old version.',
        'The bitmap is a compression layer, not a different logical trie. A bit says whether a logical slot exists. Popcount of the bits before that slot gives the index in the compact child array. This preserves 32-way branching without paying for 32 pointers per sparse node.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the "lookup and bitmap" view, follow the data path from key to hash to 5-bit chunk. The active bitmap node is the compression trick: it tells the lookup whether a logical child exists and where that child lives in the dense array.',
        'The rank row in the bitmap frame is the key calculation. For logical slot 9, the implementation counts occupied bits before 9. That count becomes the dense-array index. If the bit for 9 is off, lookup can fail without scanning children.',
        'In the "persistent update" view, compare root v0 with root v1. The copied nodes form only the edited root-to-leaf path. Shared branches remain reachable from both versions, which is the whole reason immutable maps can be cheap.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'Lookup computes the key hash, reads the current chunk, checks the bitmap, maps the logical slot to a dense-array index with popcount, and descends. At a leaf, it still checks key equality because hashes are not identities.',
        'Set follows the same path. In a mutable HAMT it can edit nodes in place. In a persistent HAMT it allocates fresh nodes along the path, installs the changed child pointer, and returns a new root. Delete also path-copies and may collapse sparse nodes when a branch becomes unnecessary.',
        'Collisions need explicit handling. Implementations may store a small collision list, use a collision node keyed by full hash, or continue with deeper hash material. A correct HAMT never assumes equal hashes imply equal keys.',
      ],
    },
    {
      heading: 'Why It Is Correct',
      paragraphs: [
        'Correct lookup follows from the path invariant. Every inserted key is placed according to the chunks of its hash, so a future lookup for the same key will visit the same logical slots until it reaches the stored leaf or collision node.',
        'Correct persistence follows from immutability of shared nodes. A new root points to copied nodes on the changed path, while old roots still point to old nodes. Since untouched branches are not modified, sharing them cannot change any old version.',
        'Correct bitmap indexing follows from rank. The number of occupied logical slots before a slot is exactly the position where that slot would appear in the compact child array. The bitmap therefore compresses storage without changing the logical child order.',
      ],
    },
    {
      heading: 'Cost and Tradeoffs',
      paragraphs: [
        'The depth is O(log_b n) with branching factor b, and b is commonly 32. That makes ordinary maps shallow: a million keys need only a few chunk levels before leaf or collision checks. The practical cost often feels close to constant.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/65/B-tree.svg', alt: 'Small B-tree diagram with grouped keys in internal nodes', caption: 'Wide branching is the shared performance idea: a B-tree uses wide page nodes for storage locality, while a HAMT uses wide hash chunks for shallow immutable lookup. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:B-tree.svg.'},
        'The constants matter. Each operation pays for hashing, bit extraction, bitmap checks, popcount, pointer chasing, allocation on persistent updates, and possible collision handling. A flat mutable hash table often wins on raw locality when versioning is not needed.',
        'Memory use is the central tradeoff. HAMTs avoid full copies and avoid empty 32-pointer nodes, but persistent versions retain old paths as long as old roots are reachable. Batch builders or transient mutation APIs can reduce allocation when many updates are staged before publishing a new immutable map.',
      ],
    },
    {
      heading: 'Worked Example',
      paragraphs: [
        'Suppose key "user42" hashes to chunks 00101, then 11010. Lookup at the root tests logical slot 5. If the bitmap has bit 5 set, popcount before bit 5 gives the child-array index, and lookup descends to the next node.',
        'At the next level, chunk 11010 selects logical slot 26. Again the bitmap decides whether that child exists and rank maps it into the compact array. If a leaf is reached, the stored key is compared with "user42" before returning the value.',
        'To update "user42" from x=1 to x=2 in a persistent map, the implementation copies the root, copies the node for slot 5, copies the node for slot 26 if needed, and installs a new leaf. All other branches are shared by root v0 and root v1.',
      ],
    },
    {
      heading: 'Where It Wins and Fails',
      paragraphs: [
        'HAMTs win when versioning is a feature: immutable language collections, undo stacks, UI app-state snapshots, speculative compiler passes, transactional transformations, and concurrent readers that should keep using an older map safely.',
        'They fail when a single private mutable table is enough. In that setting a conventional hash table can have better cache locality, less allocation, and simpler collision handling. HAMTs also suffer when hash functions are poor or adversarial unless the implementation has robust collision strategy.',
        'They are not ordered maps. Iteration order depends on hash layout unless the library adds a separate ordering layer. For range queries or sorted traversal, Red-Black Tree, AVL Tree, B-tree, or Skip List is usually the better family.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: Bagwell Ideal Hash Trees at https://lampwww.epfl.ch/papers/idealhashtrees.pdf, Immutable.js Map docs at https://immutable-js.com/docs/v5/Map/, and a JavaScript HAMT implementation at https://github.com/mattbierner/hamt.',
        'Study Hash Table for the mutable baseline, Trie for prefix-path structure, PATRICIA Trie for compressed branching, Persistent Segment Tree for another path-copying persistent structure, Git Internals for structural sharing in content-addressed data, and MVCC Internals & VACUUM for versioned storage at database scale.',
      ],
    },
  ],
};
