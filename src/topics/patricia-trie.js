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
  const keys = ['000101', '001100', '101000', '101111'];
  const keyCount = keys.length;
  const bitLen = keys[0].length;
  const newKey = '101011';

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
        [keys[0], '1'],
        [keys[1], '2'],
        [keys[2], '1'],
        [keys[3], '4'],
      ],
    ),
    highlight: { active: ['a:first_diff', 'b:first_diff'], compare: ['c:first_diff', 'd:first_diff'] },
    explanation: `A plain binary trie stores one level per bit. With ${keyCount} keys of ${bitLen} bits each, most internal nodes have only one child when prefixes overlap. PATRICIA keeps only the bit positions where a real choice exists.`,
    invariant: `Branch nodes correspond to distinguishing bits, not all ${bitLen}.`,
  };

  yield {
    state: patriciaShape('PATRICIA removes non-branching paths'),
    highlight: { active: ['root', 'one', 'ten', 'ten1'], found: ['best'], compare: ['zero'] },
    explanation: `The compressed trie jumps from one meaningful decision bit to the next. With ${keyCount} keys, only the distinguishing bit positions produce branch nodes. Leaves still store full keys so lookup can verify the candidate after following compressed decisions.`,
  };

  yield {
    state: labelMatrix(
      `Insert ${newKey}`,
      [
        { id: 'walk', label: 'walk existing path' },
        { id: 'compare', label: 'compare full key' },
        { id: 'split', label: 'first mismatch' },
        { id: 'attach', label: 'attach new leaf' },
      ],
      [{ id: 'work', label: 'work' }, { id: 'result', label: 'result' }],
      [
        ['follow 1 -> 0 -> 1', `candidate ${keys[3]}`],
        [`${newKey} vs ${keys[3]}`, 'mismatch at bit 4'],
        ['create branch bit 4', 'two children'],
        ['old and new leaves', 'compressed again'],
      ],
    ),
    highlight: { active: ['compare:work', 'split:result'], found: ['attach:result'] },
    explanation: `Insertion of ${newKey} finds the first bit where it and the candidate ${keys[3]} differ, then inserts exactly one branch node for that bit. The tree grows to ${keyCount + 1} keys but remains compact because it does not materialize skipped bits.`,
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
    explanation: `PATRICIA is not just "a trie with fewer nodes." Its branch labels are bit positions -- unlike the character-level branching of a standard trie. With ${bitLen}-bit keys, it tests only the distinguishing positions, making it natural for routing tables and compact dictionaries.`,
  };
}

function* longestPrefixMatch() {
  const dest = '101101';
  const prefixes = ['1*', '10*', '101*'];
  const bestPrefix = prefixes[prefixes.length - 1];

  yield {
    state: patriciaShape('Router lookup remembers the last terminal prefix'),
    highlight: { active: ['root', 'one', 'ten', 'ten1', 'e-ten-ten1'], found: ['best'], compare: ['eleven'] },
    explanation: `Longest-prefix match walks the destination bits of ${dest}. Every time the path crosses a terminal route, remember it. With ${prefixes.length} candidate prefixes, the goal is to return the deepest match.`,
    invariant: `Correct lookup returns the most specific matching prefix (${bestPrefix}), not just the last node reached.`,
  };

  yield {
    state: labelMatrix(
      `Lookup destination ${dest}`,
      [
        { id: 'p1', label: prefixes[0] },
        { id: 'p2', label: prefixes[1] },
        { id: 'p3', label: prefixes[2] },
        { id: 'stop', label: 'next bit missing' },
      ],
      [{ id: 'status', label: 'status' }, { id: 'best', label: 'best so far' }],
      [
        ['matches', `default for ${prefixes[0]}`],
        ['matches', `more specific ${prefixes[1]}`],
        ['matches', `most specific ${prefixes[2]}`],
        ['stop', `return ${bestPrefix}`],
      ],
    ),
    highlight: { active: ['p1:status', 'p2:status', 'p3:status'], found: ['stop:best'] },
    explanation: `Looking up ${dest}, the walk crosses ${prefixes.length} matching prefixes before hitting a missing branch. The key detail is that the answer (${bestPrefix}) is an ancestor, not the last node reached. Prefix data structures need this "best so far" variable because successful search and best route are different events.`,
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
    explanation: `In a routing table with prefixes like ${prefixes.join(', ')}, updates are local but correctness is unforgiving. The trie can be small and fast, yet a single bad split or merge can route a whole prefix like ${bestPrefix} incorrectly.`,
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
    explanation: `PATRICIA teaches a recurring data-structure lesson: compression removes redundant shape, but you must keep enough original data (the full ${dest.length}-bit key at each leaf) to verify the compressed path.`,
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
        'Read each internal node as a bit test, not as one character of a word. Active nodes are the branch bits being inspected, and found nodes are candidate leaves or remembered prefixes reached by those compressed decisions.',
        { type: 'callout', text: 'PATRICIA keeps only branch bits, then verifies the full key so compression cannot invent a match.' },
        'In longest-prefix matching, found means the best terminal prefix seen so far, not necessarily the last node visited. The safe inference is that a missing child ends the walk but does not erase the last matching ancestor.',
        {type: 'image', src: './assets/gifs/patricia-trie.gif', alt: 'Animated walkthrough of the patricia trie visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A trie stores keys by following their symbols from the root. For binary keys, a plain trie can spend one level per bit, even when many consecutive bits do not distinguish any stored key.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg',
          alt: 'Trie containing words with shared prefixes',
          caption: 'A plain trie materializes prefix structure directly; PATRICIA compresses the one-child paths between real choices. Source: Wikimedia Commons, Booyabazooka, public domain.',
        },
        'PATRICIA, short for Practical Algorithm To Retrieve Information Coded In Alphanumeric, exists to remove those non-decisions. It stores only bit positions where at least two keys in the subtree actually branch.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is a plain binary trie. At level i, test bit i of the query key, go left for 0 or right for 1, and repeat until a key or missing path is reached.',
        'This is easy to reason about because the path spells the key prefix. Insertions and deletions are local, and prefix lookup is natural because every ancestor corresponds to a prefix of the key.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Sparse keys create long one-child chains. With keys 101000, 101011, and 101111, the first bits 1, 0, and 1 do not distinguish the keys, yet a plain trie still walks and stores those levels.',
        'The cost grows with key length, not just with useful choices. IPv6 has 128-bit addresses, so a tiny set of prefixes can still force many pointer hops unless the trie compresses paths that carry no branch decision.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Only branch where the stored keys disagree. An internal PATRICIA node stores a bit index, and the bit indexes on a root-to-leaf path strictly increase, so each step jumps to the next meaningful decision.',
        'Leaves store full keys or full prefixes, because compressed paths skipped some bits. The final key verification is the guardrail that prevents two keys agreeing on tested bits from being confused when they differ on skipped bits.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Lookup starts at the root and tests the bit index stored in each internal node. A 0 bit selects the left child, a 1 bit selects the right child, and skipped bit positions are not inspected during the walk.',
        'Insertion first follows the existing compressed path to a candidate leaf. It compares the new full key with that leaf, finds the first differing bit, and inserts one new branch node at the correct position in increasing bit-index order.',
        'For longest-prefix match, nodes or leaves can carry terminal route data. The lookup remembers the deepest terminal prefix encountered, then returns that remembered prefix when the walk ends or a branch is missing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that every internal node separates at least two keys in its subtree. If no stored key differs at a bit position, testing that bit cannot change which stored key should be selected.',
        'Exact lookup is correct because each tested bit eliminates keys that disagree with the query at a distinguishing position. The leaf comparison then verifies all skipped bits, so the structure either returns the true key or rejects the false candidate.',
        'Insertion is correct because the first differing bit is the earliest point where the new key and candidate must separate. Adding a branch exactly there preserves all earlier shared prefix facts and creates the minimum new distinction needed.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A plain binary trie lookup costs O(W) bit tests for W-bit keys. A PATRICIA lookup costs the number of branch nodes visited plus the final full-key or prefix verification.',
        'Space is O(n) branch nodes for n stored keys, because each internal node represents a real split. That contrasts with a sparse plain trie, which can approach O(nW) nodes when keys share long paths with few decisions.',
        'The practical cost is pointer chasing and bit extraction. PATRICIA saves nodes, but heap-allocated branch nodes can still miss cache, which is why adaptive radix trees use wider cache-aware node layouts for main-memory database indexes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'IP routing is the classic use case. A router stores prefixes and returns the longest matching prefix for each destination address, so remembering the deepest terminal ancestor is exactly the needed behavior.',
        'Compact dictionaries over binary keys also fit the structure. Access-control prefix tables, peer identifiers, sparse bitstring sets, and cryptographic-key indexes benefit when long shared prefixes would waste ordinary trie nodes.',
        'Authenticated storage systems use related Patricia-style compression. Ethereum combines a modified Merkle Patricia trie with hashes so clients can prove membership without downloading the entire state trie.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'For exact lookup with no prefix queries, a hash table is usually simpler and faster. PATRICIA pays for prefix structure and final verification even when the caller only needs equality.',
        'Human text is a poor raw input unless normalization is already solved. Unicode normalization, case folding, locale rules, and grapheme boundaries must be handled before treating strings as binary keys.',
        'Concurrent updates are difficult because insertion splices a new branch between existing nodes. Production implementations often need read-copy-update, epochs, or another snapshot discipline so readers never see a partially installed path.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Store three 6-bit keys: 101000, 101011, and 101111. The first three bits are the same, so PATRICIA does not build three separate levels for bits 0, 1, and 2 before making a real choice.',
        'The first useful split is bit 3: key 101000 has 0 there, while 101011 and 101111 have 0 at bit 3 but differ later, so the next useful split is bit 4 or bit 5 depending on numbering. Each branch node is introduced only where two stored keys need separate children.',
        'Lookup for 101010 follows the tested bits to a candidate leaf, then compares the full key. If the candidate is 101011, the verification fails for exact lookup, but longest-prefix lookup may still return the best terminal prefix remembered along the path.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Donald R. Morrison, PATRICIA, Practical Algorithm To Retrieve Information Coded In Alphanumeric, Journal of the ACM 15(4), 1968. Sedgewick also gives a clear implementation-oriented treatment in Algorithms in C.',
        'Study Trie for the base prefix invariant, Adaptive Radix Tree for cache-aware successors, X-Fast and Y-Fast Tries for predecessor search over bit prefixes, and Merkle Trees for authenticated storage. Then study Ethereum Modified Merkle Patricia Trie to see compression combined with hash commitments.',
      ],
    },
  ],
};
