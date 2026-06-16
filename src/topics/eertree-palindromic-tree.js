// Eertree / palindromic tree: online index of distinct palindromic substrings.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'eertree-palindromic-tree',
  title: 'Eertree Palindromic Tree',
  category: 'Data Structures',
  summary: 'Store every distinct palindrome in a string online: two special roots, character-extension edges, and suffix links between palindromic suffixes.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['online insertions', 'roots and suffix links', 'palindrome analytics'], defaultValue: 'online insertions' },
  ],
  run,
};

function labelMatrix(title, rowLabels, columnLabels, labelsByRow) {
  const labels = [''];
  const byLabel = new Map();
  const code = (label) => {
    if (!byLabel.has(label)) {
      byLabel.set(label, labels.length);
      labels.push(label);
    }
    return byLabel.get(label);
  };
  return matrixState({
    title,
    rows: rowLabels.map(([id, label]) => ({ id, label })),
    columns: columnLabels.map(([id, label]) => ({ id, label })),
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

const PREFIX_STEPS = [
  ['s1', 'a', 'a', 'root -1', '1'],
  ['s2', 'ab', 'b', 'root -1', '2'],
  ['s3', 'aba', 'aba', 'b', '3'],
  ['s4', 'abab', 'bab', 'a', '4'],
  ['s5', 'ababa', 'ababa', 'bab', '5'],
];

function eertreeGraph(title) {
  return graphState({
    nodes: [
      { id: 'oddRoot', label: '-1 root', x: 0.8, y: 4.7, note: 'odd anchor' },
      { id: 'evenRoot', label: '0 root', x: 0.8, y: 2.6, note: 'empty' },
      { id: 'a', label: 'a', x: 2.8, y: 2.0, note: 'len 1' },
      { id: 'b', label: 'b', x: 2.8, y: 4.0, note: 'len 1' },
      { id: 'aba', label: 'aba', x: 4.9, y: 3.0, note: 'len 3' },
      { id: 'bab', label: 'bab', x: 4.9, y: 5.0, note: 'len 3' },
      { id: 'ababa', label: 'ababa', x: 7.2, y: 4.0, note: 'len 5' },
    ],
    edges: [
      { id: 'e-odd-a', from: 'oddRoot', to: 'a', weight: 'a' },
      { id: 'e-odd-b', from: 'oddRoot', to: 'b', weight: 'b' },
      { id: 'e-b-aba', from: 'b', to: 'aba', weight: 'a + b + a' },
      { id: 'e-a-bab', from: 'a', to: 'bab', weight: 'b + a + b' },
      { id: 'e-bab-ababa', from: 'bab', to: 'ababa', weight: 'a + bab + a' },
      { id: 's-a-even', from: 'a', to: 'evenRoot', weight: 'suffix' },
      { id: 's-b-even', from: 'b', to: 'evenRoot', weight: 'suffix' },
      { id: 's-aba-a', from: 'aba', to: 'a', weight: 'suffix' },
      { id: 's-bab-b', from: 'bab', to: 'b', weight: 'suffix' },
      { id: 's-ababa-aba', from: 'ababa', to: 'aba', weight: 'suffix' },
    ],
  }, { title });
}

function* onlineInsertions() {
  yield {
    state: labelMatrix(
      'Building eertree for ababa',
      PREFIX_STEPS.map(([id, prefix]) => [id, prefix]),
      [
        ['newSuffix', 'new'],
        ['extendedFrom', 'from'],
        ['distinct', '#'],
      ],
      PREFIX_STEPS.map(([, , newSuffix, extendedFrom, distinct]) => [newSuffix, extendedFrom, distinct]),
    ),
    highlight: { found: ['s5:newSuffix', 's5:distinct'], active: ['s3:newSuffix', 's4:newSuffix'] },
    explanation: 'An eertree is built online. After each appended character, it finds the longest palindromic suffix that can be extended by that character. For ababa, every step creates one new distinct palindrome.',
    invariant: 'Each non-root node represents one distinct palindrome.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'last', label: 'last = bab', x: 0.8, y: 4.0, note: 'longest suffix' },
        { id: 'check', label: 'add a', x: 2.6, y: 4.0, note: 'wrap?' },
        { id: 'match', label: 'a + bab + a', x: 4.8, y: 4.0, note: 'match' },
        { id: 'new', label: 'ababa', x: 7.2, y: 4.0, note: 'new node' },
      ],
      edges: [
        { id: 'e-last-check', from: 'last', to: 'check' },
        { id: 'e-check-match', from: 'check', to: 'match' },
        { id: 'e-match-new', from: 'match', to: 'new' },
      ],
    }, { title: 'Append a: extend the longest palindromic suffix' }),
    highlight: { active: ['last', 'check'], found: ['new'] },
    explanation: 'At prefix abab, the longest palindromic suffix is bab. Appending a checks whether the character before bab is also a. It is, so a + bab + a creates ababa.',
  };

  yield {
    state: labelMatrix(
      'What if extension fails?',
      [
        ['try1', 'try last palindrome'],
        ['try2', 'follow suffix link'],
        ['try3', 'try shorter suffix'],
        ['done', 'create or reuse edge'],
      ],
      [
        ['action', 'action'],
        ['why', 'why'],
      ],
      [
        ['wrap with new char', 'longest first'],
        ['jump to pal suffix', 'still a palindrome'],
        ['wrap again', 'shorter candidate'],
        ['add node or reuse', 'online update'],
      ],
    ),
    highlight: { active: ['try2:action'], found: ['done:action'] },
    explanation: 'Suffix links are the recovery mechanism. If the current longest palindromic suffix cannot be wrapped by the new character, follow suffix links until one can. This is the palindrome version of fallback links in KMP and Aho-Corasick.',
  };
}

function* rootsAndSuffixLinks() {
  yield {
    state: eertreeGraph('Eertree nodes for ababa'),
    highlight: { active: ['oddRoot', 'evenRoot'], found: ['a', 'b', 'aba', 'bab', 'ababa'] },
    explanation: 'The two roots are special. The length -1 root makes single-character palindromes easy to create. The length 0 root represents the empty palindrome. Every real node stores a palindrome length and outgoing character-extension edges.',
    invariant: 'At most n distinct non-empty palindromes exist, so the eertree is linear size.',
  };

  yield {
    state: eertreeGraph('Suffix links connect palindromic suffixes'),
    highlight: { active: ['ababa', 'aba', 'a', 'evenRoot'], compare: ['bab', 'b'] },
    explanation: 'A suffix link points to the longest proper palindromic suffix. For ababa, the suffix-link chain goes ababa -> aba -> a -> empty. These links power online fallback and also expose nested palindrome structure.',
  };

  yield {
    state: labelMatrix(
      'Eertree versus neighboring string structures',
      [
        ['kmp', 'KMP'],
        ['aho', 'Aho-Corasick'],
        ['suffix', 'Suffix Automaton'],
        ['eertree', 'Eertree'],
      ],
      [
        ['stores', 'stores'],
        ['link', 'fallback link'],
        ['best', 'best at'],
      ],
      [
        ['one pattern border table', 'border fallback', 'single pattern search'],
        ['dictionary trie', 'failure link', 'many pattern search'],
        ['all substrings automaton', 'suffix link', 'substring queries'],
        ['all distinct palindromes', 'pal suffix link', 'palindrome queries'],
      ],
    ),
    highlight: { found: ['eertree:stores', 'eertree:link', 'eertree:best'], compare: ['suffix:stores'] },
    explanation: 'Eertree belongs in the same family as suffix automata and Aho-Corasick: compact states plus fallback links. Its specialty is palindromic substrings, which ordinary suffix indexes can answer but do not expose as directly.',
  };
}

function* palindromeAnalytics() {
  yield {
    state: labelMatrix(
      'Streaming palindrome analytics',
      [
        ['append', 'append char'],
        ['last', 'update last pal suffix'],
        ['new', 'new palindrome?'],
        ['count', 'update counts'],
        ['query', 'answer queries'],
      ],
      [
        ['state', 'state touched'],
        ['product', 'product value'],
      ],
      [
        ['current string', 'online stream'],
        ['suffix links', 'longest pal suffix'],
        ['edge map', 'distinct count'],
        ['node counters', 'occurrences'],
        ['tree walk', 'palindrome inventory'],
      ],
    ),
    highlight: { active: ['append:state', 'last:state', 'new:state'], found: ['query:product'] },
    explanation: 'A production-style use case is scanning a stream of text, IDs, or DNA bases while maintaining the inventory of distinct palindromic substrings and the longest palindromic suffix after every append.',
  };

  yield {
    state: labelMatrix(
      'Use-case fit',
      [
        ['longest', 'longest palindrome'],
        ['distinct', 'count distinct palindromes'],
        ['occurs', 'count occurrences'],
        ['factor', 'pal factorization'],
        ['edit', 'mutable editor text'],
      ],
      [
        ['fit', 'fit'],
        ['reason', 'reason'],
      ],
      [
        ['good', 'last/suffix links'],
        ['excellent', 'one node per palindrome'],
        ['good', 'propagate counts'],
        ['advanced', 'DP over nodes'],
        ['weaker', 'updates are hard'],
      ],
    ),
    highlight: { found: ['distinct:fit', 'occurs:fit'], compare: ['edit:fit'] },
    explanation: 'Eertree is strongest for append-only or batched strings. Arbitrary middle edits are a different problem; use a Rope, Piece Table, or a rebuilt index when text changes everywhere.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'stream', label: 'stream', x: 0.8, y: 4.0, note: 'characters' },
        { id: 'eertree', label: 'eertree', x: 2.8, y: 4.0, note: 'online index' },
        { id: 'counts', label: 'counts', x: 5.0, y: 2.8, note: 'occurrences' },
        { id: 'longest', label: 'longest suffix', x: 5.0, y: 5.2, note: 'current' },
        { id: 'alerts', label: 'analytics', x: 7.4, y: 4.0, note: 'queries' },
      ],
      edges: [
        { id: 'e-stream-eertree', from: 'stream', to: 'eertree' },
        { id: 'e-eertree-counts', from: 'eertree', to: 'counts' },
        { id: 'e-eertree-longest', from: 'eertree', to: 'longest' },
        { id: 'e-counts-alerts', from: 'counts', to: 'alerts' },
        { id: 'e-longest-alerts', from: 'longest', to: 'alerts' },
      ],
    }, { title: 'Complete case study: palindrome index service' }),
    highlight: { active: ['stream', 'eertree'], found: ['counts', 'longest', 'alerts'] },
    explanation: 'The eertree is an online index service: append characters, update the current longest palindromic suffix, create a node only for a new distinct palindrome, and answer inventory queries without rescanning the whole text.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'online insertions') yield* onlineInsertions();
  else if (view === 'roots and suffix links') yield* rootsAndSuffixLinks();
  else if (view === 'palindrome analytics') yield* palindromeAnalytics();
  else throw new InputError('Pick an eertree view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'An eertree, also called a palindromic tree, is an online data structure for all distinct palindromic substrings of a string. Each non-root node represents one palindrome. Edges represent wrapping an existing palindrome with the same character on both sides, and suffix links connect a palindrome to its longest proper palindromic suffix.',
        'The structure has two special roots: one with length -1 and one with length 0. The odd root makes single-character palindromes fall out uniformly, while the empty root anchors even-length palindromes. This two-root trick is what makes the online construction clean instead of full of boundary cases.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Maintain a pointer to the longest palindromic suffix of the current prefix. When a new character arrives, try to wrap that suffix with the new character. If the character before the suffix does not match, follow suffix links to shorter palindromic suffixes until one can be wrapped. If the wrapped palindrome already has an edge, reuse it; otherwise create a new node and set its suffix link.',
        'For ababa, the structure creates nodes a, b, aba, bab, and ababa. The suffix-link chain for ababa is ababa -> aba -> a -> empty. That chain is useful for fallback during construction and for later palindrome queries such as longest palindromic suffix, occurrence propagation, and nested palindrome analysis.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The eertree has O(n) nodes because a string of length n has at most n distinct non-empty palindromic substrings. Construction is online and linear up to alphabet-map costs: with hash maps or fixed arrays for outgoing character edges, each append is amortized efficient. Space is O(number of distinct palindromes plus edges and suffix links).',
        'This is different from storing every palindromic occurrence. A string can have many repeated palindrome occurrences, but the eertree stores each distinct palindrome once. Occurrence counts can be accumulated on nodes and propagated through suffix links after construction.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Imagine a telemetry job scanning product IDs, DNA bases, or normalized text and tracking palindrome structure as data arrives. The eertree updates after each character, exposes the current longest palindromic suffix, increments occurrence counters, and creates a node only when a new distinct palindrome appears. Downstream dashboards can show distinct palindrome growth, repeated palindromic motifs, or sudden changes in the distribution.',
        'A simpler algorithm such as Manacher finds palindromic radii in one finished string, but it does not maintain a reusable graph of distinct palindromes and suffix links. A suffix automaton stores all substrings, but palindromes are not first-class. Eertree is specialized: it gives palindrome questions the direct representation they deserve.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not use eertree for arbitrary mutable text unless you are ready for much harder dynamic variants or rebuilds. The standard structure is naturally append-online. For text editors, Rope, Piece Table, Gap Buffer, and Sequence CRDTs solve different update problems.',
        'Also do not confuse distinct palindromes with occurrences. The node count answers distinct inventory; occurrence counts need extra bookkeeping. Finally, suffix links are not suffix-array links. They move between palindromic suffixes only, which is exactly why the structure is small and targeted.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Rubinchik and Shur, "EERTREE: An Efficient Data Structure for Processing Palindromes in Strings", at https://arxiv.org/abs/1506.04862 and PDF at https://arxiv.org/pdf/1506.04862. For dynamic extensions, see Double-Ended Palindromic Trees at https://arxiv.org/abs/2210.02292. Study KMP Prefix Function and Aho-Corasick Automaton for fallback-link intuition, Suffix Automaton for all-substring structure, Suffix Array & LCP and FM-Index for static full-text indexing, and Text Rope Data Structure for the mutable-text contrast.',
      ],
    },
  ],
};
