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
      heading: 'Why this exists',
      paragraphs: [
        `A trie is a natural structure for prefix search, but a plain binary trie can spend most of its memory on decisions that are not decisions. If stored keys share long prefixes, the tree contains long chains where every internal node has exactly one child. Lookup still walks those nodes, and the structure still stores pointers for them, even though no key choice happens there.`,
        `PATRICIA, short for Practical Algorithm To Retrieve Information Coded in Alphanumeric, compresses that waste. In its binary form, it stores only the bit positions where keys actually differ. Internal nodes are not "next bit" nodes. They are "test this distinguishing bit" nodes. Everything between distinguishing bits is shared context and can be verified against the full key or prefix stored at a leaf.`,
        `That makes PATRICIA useful for binary keys and prefix-heavy domains: IP routing prefixes, CIDR policy tables, compact dictionaries, peer identifiers, sparse bitstring sets, and other places where prefix lookup matters but a full binary trie is too large. It preserves trie semantics while refusing to materialize one-child paths.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious prefix structure is a plain trie. For a binary trie, each level consumes one bit. A lookup reads the next bit, chooses the zero child or one child, and repeats until it reaches a key or discovers the path is missing. The invariant is simple: the path from the root spells the prefix shared by every key below that node.`,
        `This is a good starting point. It makes exact lookup, prefix lookup, insertion, and deletion easy to explain. It also avoids the comparison logic of balanced trees. If key length is short and the trie is dense, a plain trie may be fine.`,
        `The wall is sparse branching. Suppose the stored keys are 101000, 101011, and 101111. A plain binary trie walks through 1, then 0, then 1 before the keys even start to differ. Those first three levels carry no choice among the remaining keys. In a large table, these non-branching paths create memory overhead, pointer chasing, cache misses, and update work without adding information.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `A trie does not need to store every bit position as a node. It only needs to store the bit positions where the current candidate set splits. If all remaining keys share bits 3 through 15, the structure can skip directly to bit 16 and test the first bit that separates them.`,
        `That compression is safe only because the original key or prefix is still available for verification. The compressed path says "this candidate is plausible." The final comparison says "the skipped bits actually matched." Without that guardrail, a compressed trie could accept a key that merely took the same branch decisions.`,
        `PATRICIA is therefore a layout idea and a correctness contract at the same time: branch only at distinguishing bits, but keep enough original information to verify the candidate reached by those branches.`,
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        `Each internal node stores a bit index. Lookup tests that bit in the search key and follows the zero or one child. The bit indexes along a path increase, so lookup keeps moving deeper into more specific distinctions. A leaf stores the full key, value, or prefix entry. When lookup reaches a leaf, it compares the stored key or prefix with the search key to confirm the result.`,
        `Insertion starts with an ordinary lookup to find the closest existing leaf under the current branch decisions. The new key is compared with that leaf's full key. The first bit where they differ becomes the new branch bit. The algorithm inserts one internal node at the correct position in the increasing bit-index order and attaches the old leaf and new leaf on opposite sides.`,
        `Deletion removes a leaf and then cleans up any internal node that no longer represents a real choice. If a branch node has only one useful child after deletion, it can be merged away. That cleanup is what keeps the structure compressed over time.`,
        `Prefix entries add one more detail. A node or leaf may correspond to a terminal prefix, not only a full key. Longest-prefix lookup therefore tracks the best terminal prefix seen while traversing. Search can end at a missing branch, but the correct answer may be the deepest remembered prefix.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The main invariant is that every internal branch bit separates at least two stored keys or prefixes in that subtree. If no stored item differs at a bit position, storing that bit as a node cannot affect which item lookup should choose. Removing it changes shape, not meaning.`,
        `Lookup is correct because each branch decision eliminates keys whose distinguishing bit disagrees with the query. Skipped bits are shared by the candidate set represented under the branch. The final full-key or prefix check closes the proof: if the candidate's skipped bits do not match the query, lookup rejects or falls back to the best prefix instead of accepting the path blindly.`,
        `Insertion is correct because the first differing bit between the new key and its found candidate is exactly the earliest position where the two keys need separate branches. Inserting a branch there preserves all earlier shared prefix information and separates the old and new keys at the first point where they can be distinguished.`,
        `Deletion is correct when cleanup removes only non-branching structure. A branch with one child no longer represents a choice. Merging it preserves the represented set as long as terminal prefix markers and leaf verification are kept.`,
      ],
    },
    {
      heading: 'Concrete example',
      paragraphs: [
        `Store the keys 000101, 001100, 101000, and 101111. A plain binary trie can spend several nodes walking through shared prefixes. PATRICIA records the bit positions that actually split the set. One branch may separate keys beginning with 0 from keys beginning with 1. A later branch inside the 10 or 101 region separates only the keys that still share the earlier prefix.`,
        `Now insert 101011. Lookup follows the current branch decisions and may land on the existing key 101111. Comparing the full keys shows the first mismatch at bit 4. PATRICIA inserts a branch node for bit 4, then places 101011 and 101111 on different sides. No nodes are added for bits that both keys share.`,
        `For a routing example, store prefixes 1*, 10*, and 101*. A destination beginning 101101 should return 101* because it is the most specific matching prefix. The lookup walks destination bits and updates best_so_far whenever it passes a terminal prefix. If a later branch is missing, it returns best_so_far instead of treating the lookup as a miss.`,
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        `Lookup cost is proportional to the number of branch nodes visited plus the final verification, bounded by key length in bits. Compared with an uncompressed binary trie, the number of visited internal nodes can be much smaller when keys share long prefixes or differ at only a few positions.`,
        `Space is the main win. PATRICIA removes one-child internal nodes, so it stores real decisions rather than every prefix position. It still stores leaves, values, branch metadata, and enough key or prefix material for verification. Compression saves structure; it does not remove the need to know what key was actually stored.`,
        `Insertion and deletion are more delicate than in a plain trie. Insertion must find the first differing bit and place the new branch in the correct order. Deletion must preserve terminal prefixes and remove only branches that no longer distinguish anything. These operations are local, but off-by-one bit numbering and mistaken merges can corrupt many lookups.`,
        `The practical cost is pointer chasing and bit manipulation. PATRICIA is compact, but it is not automatically cache-optimal. Adaptive Radix Tree and other engineered tries use byte-oriented node layouts to improve main-memory behavior. Hash tables can beat PATRICIA for exact lookup when prefix order is irrelevant.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Define bit numbering once and test it hard. Network-prefix code must be explicit about big-endian bit order. Binary identifiers must decide whether bit 0 means the most significant or least significant bit. Mixed conventions create bugs that look like random lookup failures.`,
        `Store full keys or canonical prefixes at leaves. Path compression makes verification mandatory. If the structure stores only branch decisions, it cannot distinguish a true match from a key that happens to agree on tested bits and disagree on skipped bits.`,
        `Keep terminal prefix state separate from child existence. In longest-prefix match, an internal node can be both a routing entry and a branching point. Deleting one route should not delete child routes that are more specific. Similarly, merging a one-child branch must not lose a terminal marker that represents a valid prefix.`,
        `Use property tests with random keys, inserts, deletes, and comparisons against a slow reference implementation. PATRICIA bugs often survive hand-picked examples because the tree looks plausible. A slow sorted-list or plain-trie reference is cheap insurance.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `PATRICIA wins when keys are binary or can be treated as binary, prefixes matter, and shared prefixes are common enough that compression removes real work. IP route lookup is the classic example. The router needs the longest matching prefix, not just exact equality, and many prefixes share high-order bits.`,
        `It also fits compact dictionaries, access-control prefix tables, peer-to-peer routing structures, and sparse bitstring indexes. In these settings, a hash table loses prefix structure and a plain trie wastes nodes on non-branching paths.`,
        `The structure is also educational because it exposes a recurring data-structure move: remove redundant shape, but keep a verification step. The same idea appears in radix trees, compressed suffix structures, Merkle Patricia tries, and path-compressed indexes.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `PATRICIA is not the default answer for all strings. If the workload is exact lookup only, a hash table is simpler. If keys are short and dense, a plain trie may be simpler with little overhead. If range scans over byte strings dominate in a database, an Adaptive Radix Tree or B+ tree may have better cache and concurrency behavior.`,
        `It is also awkward when prefix semantics are not raw-bit semantics. Human text may require Unicode normalization, locale collation, case folding, or grapheme awareness. Those rules should be handled before keys enter the trie, or the bitwise order will not match user expectations.`,
        `Update-heavy systems need care. Split and merge code is easy to get subtly wrong, especially with terminal prefixes. Concurrent updates add another layer: readers must not observe a partially inserted branch or a removed leaf without the verification data they need.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Sources: Donald R. Morrison, "PATRICIA--Practical Algorithm To Retrieve Information Coded in Alphanumeric", https://oneofus.la/have-emacs-will-hack/files/PatriciaTrie-JACM1968.pdf, and "Hashed Patricia Trie: Efficient Longest Prefix Matching in Peer-to-Peer Systems", https://groups.uni-paderborn.de/fg-qi/courses/UPB_FUNDAMENTAL_ALGS/W2018/notes/KS_hashedPatricia.pdf.`,
        `Study Trie for the base prefix invariant, Adaptive Radix Tree for cache-aware byte-indexed compression, X-Fast and Y-Fast Tries for bit-prefix predecessor search, Verkle Trees and Sparse Merkle Trees for authenticated trie variants, Suffix Tree for compressed path ideas in string algorithms, and IP longest-prefix matching or eBPF LPM maps for operational routing and policy use cases.`,
      ],
    },
  ],
};
