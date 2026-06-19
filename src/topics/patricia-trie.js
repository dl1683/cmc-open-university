// PATRICIA trie: a compressed binary trie that branches only where keys differ.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'patricia-trie',
  title: 'PATRICIA Trie',
  category: 'Data Structures',
  summary: 'Compress a binary trie by storing only real branch bits, making prefix lookup compact and fast.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['compressed bits', 'longest prefix match'], defaultValue: 'compressed bits' },
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

function patriciaShape(title) {
  return graphState({
    nodes: [
      { id: 'root', label: 'bit 1?', x: 1.1, y: 3.8, note: 'first real split' },
      { id: 'zero', label: '0*', x: 3.1, y: 1.8, note: 'prefix 0' },
      { id: 'one', label: '1*', x: 3.1, y: 5.8, note: 'prefix 1' },
      { id: 'ten', label: '10*', x: 5.2, y: 4.4, note: 'branch at bit 2' },
      { id: 'eleven', label: '11*', x: 5.2, y: 7.1, note: 'route 192/2' },
      { id: 'ten0', label: '100*', x: 7.3, y: 3.4, note: 'route 128/3' },
      { id: 'ten1', label: '101*', x: 7.3, y: 5.3, note: 'route 160/3' },
      { id: 'best', label: 'best prefix', x: 9.2, y: 4.3, note: 'last terminal on path' },
    ],
    edges: [
      { id: 'e-root-zero', from: 'root', to: 'zero', weight: '0' },
      { id: 'e-root-one', from: 'root', to: 'one', weight: '1' },
      { id: 'e-one-ten', from: 'one', to: 'ten', weight: '0' },
      { id: 'e-one-eleven', from: 'one', to: 'eleven', weight: '1' },
      { id: 'e-ten-ten0', from: 'ten', to: 'ten0', weight: '0' },
      { id: 'e-ten-ten1', from: 'ten', to: 'ten1', weight: '1' },
      { id: 'e-ten1-best', from: 'ten1', to: 'best', weight: 'remember' },
    ],
  }, { title });
}

function* compressedBits() {
  yield {
    state: labelMatrix(
      'Plain binary trie has many one-child chains',
      [
        { id: 'a', label: 'key A' },
        { id: 'b', label: 'key B' },
        { id: 'c', label: 'key C' },
        { id: 'd', label: 'key D' },
      ],
      [{ id: 'bits', label: 'bits' }, { id: 'first_diff', label: 'first differing bit' }],
      [
        ['000101', '1'],
        ['001100', '2'],
        ['101000', '1'],
        ['101111', '4'],
      ],
    ),
    highlight: { active: ['a:first_diff', 'b:first_diff'], compare: ['c:first_diff', 'd:first_diff'] },
    explanation: 'A plain binary trie stores one level per bit. If keys share long prefixes, most internal nodes have only one child. PATRICIA keeps only the bit positions where a real choice exists.',
    invariant: 'Branch nodes correspond to distinguishing bits, not every bit.',
  };

  yield {
    state: patriciaShape('PATRICIA removes non-branching paths'),
    highlight: { active: ['root', 'one', 'ten', 'ten1'], found: ['best'], compare: ['zero'] },
    explanation: 'The compressed trie jumps from one meaningful decision bit to the next. Leaves still store full keys or prefixes, so lookup can verify the candidate after following compressed decisions.',
  };

  yield {
    state: labelMatrix(
      'Insert 101011',
      [
        { id: 'walk', label: 'walk existing path' },
        { id: 'compare', label: 'compare full key' },
        { id: 'split', label: 'first mismatch' },
        { id: 'attach', label: 'attach new leaf' },
      ],
      [{ id: 'work', label: 'work' }, { id: 'result', label: 'result' }],
      [
        ['follow 1 -> 0 -> 1', 'candidate 101111'],
        ['101011 vs 101111', 'mismatch at bit 4'],
        ['create branch bit 4', 'two children'],
        ['old and new leaves', 'compressed again'],
      ],
    ),
    highlight: { active: ['compare:work', 'split:result'], found: ['attach:result'] },
    explanation: 'Insertion finds the first bit where the new key and the found key differ, then inserts exactly one branch node for that bit. The tree remains compact because it does not materialize skipped bits.',
  };

  yield {
    state: labelMatrix(
      'How it differs from related tries',
      [
        { id: 'trie', label: 'Trie' },
        { id: 'radix', label: 'Radix tree' },
        { id: 'patricia', label: 'PATRICIA' },
        { id: 'art', label: 'ART' },
      ],
      [{ id: 'unit', label: 'unit of branch' }, { id: 'best_for', label: 'best for' }],
      [
        ['character/byte', 'simple prefix search'],
        ['compressed string edge', 'general strings'],
        ['selected bit index', 'compact binary keys'],
        ['adaptive byte node', 'main-memory indexes'],
      ],
    ),
    highlight: { found: ['patricia:unit', 'art:best_for'], compare: ['trie:unit'] },
    explanation: 'PATRICIA is not just "a trie with fewer nodes." Its branch labels are bit positions, which makes it natural for routing tables, binary keys, and compact dictionaries.',
  };
}

function* longestPrefixMatch() {
  yield {
    state: patriciaShape('Router lookup remembers the last terminal prefix'),
    highlight: { active: ['root', 'one', 'ten', 'ten1', 'e-ten-ten1'], found: ['best'], compare: ['eleven'] },
    explanation: 'Longest-prefix match walks the destination bits. Every time the path crosses a terminal route, remember it. If the exact path later stops, return the deepest remembered prefix.',
    invariant: 'Correct lookup returns the most specific matching prefix, not just the last node reached.',
  };

  yield {
    state: labelMatrix(
      'Lookup destination 101101',
      [
        { id: 'p1', label: '1*' },
        { id: 'p2', label: '10*' },
        { id: 'p3', label: '101*' },
        { id: 'stop', label: 'next bit missing' },
      ],
      [{ id: 'status', label: 'status' }, { id: 'best', label: 'best so far' }],
      [
        ['matches', 'default for 1*'],
        ['matches', 'more specific 10*'],
        ['matches', 'most specific 101*'],
        ['stop', 'return 101*'],
      ],
    ),
    highlight: { active: ['p1:status', 'p2:status', 'p3:status'], found: ['stop:best'] },
    explanation: 'The key detail is that lookup can end at a missing branch while the answer is an ancestor. Prefix data structures need this "best so far" variable because successful search and best route are different events.',
  };

  yield {
    state: labelMatrix(
      'Case study: route table updates',
      [
        { id: 'insert', label: 'insert route' },
        { id: 'delete', label: 'delete route' },
        { id: 'lookup', label: 'lookup packet' },
        { id: 'rebuild', label: 'bulk rebuild' },
      ],
      [{ id: 'touches', label: 'touches' }, { id: 'risk', label: 'risk' }],
      [
        ['one search path', 'split at wrong bit'],
        ['one leaf + cleanup', 'merge too much'],
        ['branch bits only', 'forget terminal ancestor'],
        ['all prefixes sorted', 'pause if not incremental'],
      ],
    ),
    highlight: { active: ['lookup:touches', 'insert:touches'], compare: ['delete:risk'] },
    explanation: 'In a routing table, updates are local but correctness is unforgiving. The trie can be small and fast, yet a single bad split or merge can route a whole prefix incorrectly.',
  };

  yield {
    state: labelMatrix(
      'Design tradeoffs',
      [
        { id: 'memory', label: 'memory' },
        { id: 'branch', label: 'branching' },
        { id: 'cache', label: 'cache' },
        { id: 'verify', label: 'verification' },
      ],
      [{ id: 'effect', label: 'effect' }, { id: 'lesson', label: 'lesson' }],
      [
        ['fewer internal nodes', 'compact structure'],
        ['bit tests replace char fanout', 'good for binary keys'],
        ['pointer chasing remains', 'layout still matters'],
        ['full key at leaf', 'compression needs guardrail'],
      ],
    ),
    highlight: { found: ['memory:lesson', 'verify:lesson'], compare: ['cache:effect'] },
    explanation: 'PATRICIA teaches a recurring data-structure lesson: compression removes redundant shape, but you must keep enough original data around to verify the compressed path.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'compressed bits') yield* compressedBits();
  else if (view === 'longest prefix match') yield* longestPrefixMatch();
  else throw new InputError('Pick a PATRICIA-trie view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "compressed bits" view shows four keys and their first differing bit positions, then builds the PATRICIA trie that stores only those distinguishing bits. Active (highlighted) cells mark the bit positions being tested. Found markers indicate the leaf or prefix reached after following compressed branch decisions. The second frame shows the compressed trie shape: each internal node is labeled with a bit index, not a character or full prefix.',
        'The "longest prefix match" view walks a destination address through a routing trie. Active nodes trace the path taken. Found marks the deepest terminal prefix remembered along that path. The key detail: lookup can end at a missing branch, but the answer is the last terminal ancestor, not the last node visited.',
        'In both views, the matrix frames show the logical steps (compare, split, attach) that produce each structural change. Read the "work" column for what the algorithm does, and the "result" column for what the structure becomes.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A trie is a natural structure for prefix search, but a plain binary trie wastes most of its memory on non-decisions. If stored keys share long prefixes, the tree contains long chains where every internal node has exactly one child. Lookup still walks those nodes, and the structure still stores pointers for them, even though no key choice happens there. For a router with thousands of IP prefixes sharing common high-order bits, a plain binary trie can have ten or twenty one-child nodes for every real branch.',
        {type: 'quote', text: 'PATRICIA is a particular form of digital search tree in which each node has two exits... the algorithm for inserting and retrieving information is practical, fast, and uncomplicated.', attribution: 'Donald R. Morrison, JACM (1968)'},
        'PATRICIA -- Practical Algorithm To Retrieve Information Coded In Alphanumeric -- compresses that waste. In its binary form, it stores only the bit positions where keys actually differ. Internal nodes are not "next bit" nodes. They are "test this distinguishing bit" nodes. Everything between distinguishing bits is shared context, verified against the full key stored at a leaf.',
        'That makes PATRICIA useful for binary keys and prefix-heavy domains: IP routing prefixes, CIDR policy tables, compact dictionaries, peer identifiers, and sparse bitstring sets. It preserves trie semantics while refusing to materialize one-child paths.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The plain binary trie stores one level per bit. A lookup reads the next bit, chooses the zero child or one child, and repeats until it reaches a key or discovers the path is missing. The invariant is direct: the path from the root spells the prefix shared by every key below that node. Insertion picks the next open branch. Deletion removes a leaf and cleans up empty parents. The code is short and the logic is transparent.',
        'This works well when keys are short and the trie is dense -- when most internal nodes have two children and the tree is shallow. A set of all 8-bit values in a binary trie has 255 internal nodes, each with two children, and 256 leaves. No node is wasted.',
        'The approach also avoids comparison logic. Unlike a balanced BST, a trie never needs to compare entire keys against each other. Each level tests one bit, and the path to a leaf encodes the key itself. For dense key sets, this is both fast and simple.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sparse branching kills the plain trie. Suppose the stored keys are 101000, 101011, and 101111. A plain binary trie walks through bit 0 (always 1), bit 1 (always 0), bit 2 (always 1) before the keys even start to differ. Those first three levels carry no choice among the remaining keys. Each one-child node costs a pointer, a memory allocation, and a cache line on lookup -- all for information that could be inferred from any stored key.',
        'In a routing table with 800,000 IPv4 prefixes, the top bits of most prefixes overlap heavily. A plain binary trie for 32-bit addresses can have 32 levels, but the first 8-10 levels might contain long one-child chains for common network blocks. The structure stores millions of internal nodes, most of which have exactly one child and contribute nothing to any branch decision.',
        'The wall is not just memory. Lookup time is proportional to key length in bits, not to the number of stored keys. A 128-bit IPv6 address forces 128 levels of traversal even if only three prefixes are stored. Every level is a pointer chase, a potential cache miss, and wasted work when the node has no real decision to make.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each internal node stores a bit index -- the position in the key where this node makes its branching decision. Lookup tests that bit in the search key and follows the zero or one child. The bit indexes along any root-to-leaf path strictly increase, so lookup moves deeper into more specific distinctions with each step. A leaf stores the full key (or prefix entry) and its value.',
        {type: 'diagram', text: '  [bit 0]                    skip count = 0\n   / \\\n  0   1\n  |   |\n [A] [bit 3]                 skip count = 2 (bits 1,2 shared)\n      / \\\n     0   1\n     |   |\n   [bit 5]  [C]              skip count = 1 (bit 4 shared)\n    / \\\n   0   1\n   |   |\n  [B] [D]                   leaves store full keys', label: 'PATRICIA node structure with skip counts between branch bits'},
        'When lookup reaches a leaf, it compares the stored key with the search key to verify the result. This verification step is mandatory. Because the trie skips bits between branch nodes, two keys that agree on all tested bits but disagree on a skipped bit would reach the same leaf. The final comparison catches that case.',
        {type: 'code', text: 'function testBit(key, bitIndex) {\n  // Big-endian bit numbering: bit 0 is the MSB\n  const byteIndex = bitIndex >>> 3;\n  const bitOffset = 7 - (bitIndex & 7);\n  return (key[byteIndex] >>> bitOffset) & 1;\n}\n\nfunction lookup(node, searchKey) {\n  let bestPrefix = null;\n  while (node && !node.isLeaf) {\n    if (node.isTerminal) bestPrefix = node.prefix;\n    const bit = testBit(searchKey, node.bitIndex);\n    node = bit ? node.right : node.left;\n  }\n  if (node && node.key === searchKey) return node;\n  return bestPrefix;  // longest prefix match fallback\n}', language: 'javascript'},
        'Insertion finds the closest existing leaf by following branch decisions, then compares the new key with that leaf. The first differing bit becomes the new branch index. A new internal node is inserted at the correct position in the increasing bit-index order, with the old leaf and new leaf as its two children. No nodes are created for the shared bits between the old branch and the new one.',
        'Deletion removes a leaf, then checks whether its parent still branches. If the parent now has only one child, it is merged away -- the grandparent links directly to the surviving child. This cleanup preserves compression. Terminal prefix markers must survive independently of branching structure: deleting a more-specific route must not destroy a less-specific one that shares the same branch node.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The main invariant is that every internal node separates at least two stored keys in its subtree. If no stored key differs at a bit position, that position cannot affect which key lookup should return. Omitting it changes tree shape without changing tree meaning.',
        'Lookup correctness follows from two properties. First, each branch decision eliminates keys whose distinguishing bit disagrees with the query. Second, the final full-key comparison verifies that the skipped bits actually match. Together, these guarantee that lookup either returns the correct key or correctly rejects a false match. For longest-prefix match, the "best prefix seen so far" variable ensures that a missing branch does not discard a valid ancestor prefix.',
        'Insertion correctness relies on the first-differing-bit being the earliest position where the new key and its found candidate need separate branches. Placing the new branch there preserves all earlier shared prefix information and creates the minimal new structure needed to distinguish the two keys.',
        'Deletion correctness requires that cleanup removes only non-branching structure. A branch with one child no longer represents a choice. Merging it preserves the represented set as long as terminal prefix markers and leaf keys are kept intact. The proof obligation is that no merge destroys a terminal marker that some other lookup depends on.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {type: 'table', headers: ['Property', 'Plain trie', 'PATRICIA trie', 'Radix tree'], rows: [
          ['Space (n keys, W-bit)', 'O(n * W) nodes', 'O(n) internal nodes', 'O(n) nodes, string edges'],
          ['Lookup', 'O(W) bit tests', 'O(branches on path) + verify', 'O(key length) char comparisons'],
          ['Branching unit', 'Every bit', 'Distinguishing bit index', 'Compressed string edge'],
          ['Insert', 'O(W) descent', 'O(branches) + 1 split', 'O(key length) + edge split'],
          ['Best for', 'Dense short keys', 'Sparse binary keys, IP prefixes', 'General variable-length strings'],
        ]},
        'Lookup cost is proportional to the number of branch nodes visited, not the key length in bits. For n keys of W bits, a plain trie visits up to W nodes. A PATRICIA trie visits at most min(W, n-1) branch nodes -- in practice far fewer, because most paths share early bits. The final verification adds one full-key comparison.',
        'Space is the main win. A plain binary trie for n keys of W bits can create up to n*W internal nodes. PATRICIA creates at most n-1 internal nodes regardless of key length, because each internal node separates at least two keys. For 800,000 IPv4 routes in a 32-bit space, that is the difference between potentially 25 million one-child nodes and fewer than 800,000 branch nodes.',
        'The practical cost is pointer chasing and bit manipulation. Each branch node requires extracting a single bit from the search key and following a pointer. The structure is compact in node count but not necessarily cache-friendly: nodes are heap-allocated and accessed in unpredictable order. Adaptive Radix Trees address this with byte-oriented node layouts and cache-line-sized structures.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'IP route lookup is the canonical application. A router stores prefixes like 192.168.0.0/16 and 10.0.0.0/8 and must find the longest matching prefix for each arriving packet. PATRICIA handles this naturally: each branch tests a distinguishing bit, terminal prefixes are marked at internal nodes, and lookup remembers the deepest terminal prefix seen. The Linux kernel used a PATRICIA-style structure (LC-trie) for FIB lookups for years.',
        'Compact dictionaries over binary keys benefit similarly. Cryptographic hash lookups (where keys are 256-bit SHA values with high entropy but occasional shared prefixes), peer-to-peer routing tables (Kademlia XOR distance operates on binary key prefixes), and access-control prefix tables all fit the pattern: binary keys, prefix semantics matter, and shared prefixes are common enough that compression removes real work.',
        'The structure also appears in authenticated data structures. Ethereum uses a Modified Merkle Patricia Trie to commit the entire world state into a single root hash. Each account address is a path through the trie, and the Merkle property lets any node prove membership without revealing the full tree. The PATRICIA compression keeps the proof paths short despite the 160-bit address space.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For exact-match-only workloads, a hash table is simpler, faster, and easier to implement correctly. PATRICIA pays for prefix structure that exact lookup does not need. If you never ask "what is the longest prefix that matches this key," the branch compression and verification overhead are pure cost.',
        'PATRICIA operates on raw bits. Human text requires Unicode normalization, locale-aware collation, case folding, or grapheme segmentation before it can be treated as a binary key. If those transformations are not applied before insertion, the bitwise order will not match user expectations. A radix tree over bytes or characters is usually a better fit for string workloads.',
        'Concurrent updates are difficult. Inserting a key requires reading a leaf, computing the first differing bit, and atomically splicing in a new branch node. A reader that arrives between the splice and the leaf attachment can see a partially constructed path. Production systems use read-copy-update (RCU) or epoch-based reclamation to let readers proceed on a consistent snapshot while writers prepare the next version.',
        'Cache behavior is mediocre. Each node is a separate heap allocation, and the access pattern depends on the search key, so prefetching is hard. For main-memory databases where cache performance dominates, engineered structures like ART (Adaptive Radix Tree) or HAT-trie outperform PATRICIA by packing multiple decisions into cache-line-sized node types.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {type: 'note', text: 'Morrison\'s 1968 paper remains the primary source. The structure he describes uses back-pointers (upward links from leaves to ancestors) for a single-pass search, which differs from the two-pass version (descend then verify) used in most modern implementations. Both are correct; the two-pass version is simpler to implement and reason about.'},
        {type: 'bullets', items: [
          'Donald R. Morrison, "PATRICIA -- Practical Algorithm To Retrieve Information Coded In Alphanumeric," Journal of the ACM 15(4), 1968. The original paper defining the structure and its insertion algorithm.',
          'Robert Sedgewick, Algorithms in C (3rd ed.), Chapter 15. Clear treatment of PATRICIA as a special case of digital search trees, with C implementation.',
          'Viktor Leis et al., "The Adaptive Radix Tree: ARTful Indexing for Main-Memory Databases," ICDE 2013. The modern successor that solves PATRICIA\'s cache problems with byte-granularity adaptive nodes.',
        ]},
        'Study Trie for the base prefix invariant that PATRICIA compresses. Study Adaptive Radix Tree for the cache-aware evolution that replaced bit-level branching with byte-level adaptive nodes. Study X-Fast and Y-Fast Tries for predecessor search over bit prefixes using hashing. For authenticated storage, study Merkle Trees and then Ethereum\'s Modified Merkle Patricia Trie to see how PATRICIA compression combines with hash commitments.',
      ],
    },
  ],
};
