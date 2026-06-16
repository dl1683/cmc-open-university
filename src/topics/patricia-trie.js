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
    { heading: 'What it is', paragraphs: [
      'PATRICIA, short for Practical Algorithm To Retrieve Information Coded in Alphanumeric, is a compressed trie. In its binary form, it does not branch at every bit position. It stores only the bit positions where keys actually differ, so long one-child paths disappear.',
      'That makes it useful when keys have shared prefixes: IP routes, binary identifiers, compact dictionaries, and peer-to-peer lookup structures. A normal trie spends memory representing every prefix character or bit. A PATRICIA trie preserves the decision points that matter.',
    ] },
    { heading: 'How it works', paragraphs: [
      'Each internal node stores a bit index to test. Lookup follows left or right according to that bit and eventually reaches a candidate leaf. Because path compression skips information, the leaf must store the full key or prefix so the lookup can verify that the compressed path really matches.',
      'Insertion first searches for the closest existing key. It then finds the first bit where the existing key and new key differ, inserts one branch node at that bit, and attaches the old and new leaves below it. Deletion removes a leaf and may merge away a now-useless branch.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The height is bounded by the number of relevant branch bits, not by the number of inserted keys alone. Lookup often behaves like O(length of key in branch decisions), but with far fewer nodes than an uncompressed binary trie. The same bit-prefix lens reappears in X-Fast & Y-Fast Tries, where prefixes are hashed by level for predecessor search. The tradeoff is implementation care: bit numbering, terminal-prefix handling, and full-key verification must all be precise.',
      'Compared with Adaptive Radix Tree, PATRICIA is more bit-oriented and conceptually leaner. ART is engineered for byte-key indexing in main memory; PATRICIA is the classic compressed trie idea that makes binary prefix search compact.',
    ] },
    { heading: 'Complete case study', paragraphs: [
      'A router performing longest-prefix match can store route prefixes in a PATRICIA-like trie. During lookup, it walks the destination bits and remembers the deepest terminal prefix seen so far. If the next branch is absent, the router returns the remembered prefix rather than failing the lookup. This separates path traversal from answer selection.',
      'That case study also shows why compressed data structures need explicit correctness checks. A compressed branch may skip several bits, but route matching still depends on exact prefix semantics. The data structure is fast only because the omitted shape is redundant, not because the semantics are relaxed.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Sources: Donald R. Morrison, "PATRICIA--Practical Algorithm To Retrieve Information Coded in Alphanumeric", https://oneofus.la/have-emacs-will-hack/files/PatriciaTrie-JACM1968.pdf, and "Hashed Patricia Trie: Efficient Longest Prefix Matching in Peer-to-Peer Systems", https://groups.uni-paderborn.de/fg-qi/courses/UPB_FUNDAMENTAL_ALGS/W2018/notes/KS_hashedPatricia.pdf. Study IP FIB Longest-Prefix Match Case Study, eBPF LPM Trie CIDR Policy Case Study, Trie, Hierarchical Heavy Hitters: Prefix Sketch, Adaptive Radix Tree, X-Fast & Y-Fast Tries, Suffix Tree, and Database Indexing next.',
    ] },
  ],
};
