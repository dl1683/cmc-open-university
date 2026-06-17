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
      heading: `Why This Exists`,
      paragraphs: [
        `An eertree exists because palindrome questions are more specific than general substring questions. A program may need the distinct palindromes in a text, the current longest palindromic suffix after every append, occurrence counts, or a compact view of how palindromes nest inside each other.`,
        `A suffix array, suffix tree, or suffix automaton can support many substring queries, but palindromes are not first-class in those structures. The eertree makes each distinct palindrome a node, so palindrome inventory becomes the main state rather than a derived calculation.`,
      ],
    },
    {
      heading: `Naive Baseline and Wall`,
      paragraphs: [
        `The baseline is to enumerate substrings and test whether each one reads the same forward and backward. Dynamic programming improves the test reuse, and Manacher's algorithm can find longest palindrome radii in linear time for a finished string.`,
        `The wall is online distinctness. After appending one character, only palindromic suffixes of the previous prefix can become new palindromes by being wrapped with that character. A structure that cannot jump through those suffixes either rescans too much or fails to maintain the distinct-palindrome graph as the stream grows.`,
      ],
    },
    {
      heading: `Core Insight and Invariant`,
      paragraphs: [
        `Store each distinct palindrome as one node. A suffix link points from a palindrome to its longest proper palindromic suffix. When a character arrives, start at the current longest palindromic suffix and follow suffix links until the new character can wrap that palindrome on both sides.`,
        `The invariant is one node per distinct non-empty palindrome, plus two artificial roots of length -1 and length 0. Each append creates at most one new node: the longest new palindromic suffix. All shorter palindromic suffixes already existed earlier.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the online insertions view, watch last as the current longest palindromic suffix. For ababa, appending a after abab extends bab into ababa. If an extension fails, the suffix-link frame shows the recovery path: try the next shorter palindromic suffix, not an arbitrary substring.`,
        `In the roots and suffix links view, separate extension edges from suffix links. Extension edges build larger palindromes by wrapping a known palindrome with matching characters. Suffix links move downward through proper palindromic suffixes. In the palindrome analytics view, the same nodes become an inventory for counts, longest suffix tracking, and query answers.`,
      ],
    },
    {
      heading: `Mechanics`,
      paragraphs: [
        `The structure starts with two roots. The length -1 root is an odd-length sentinel that lets a single character be treated as c + root + c. The length 0 root represents the empty palindrome and anchors even-length palindromes. Each real node stores its palindrome length, outgoing character-extension edges, a suffix link, and optional counters.`,
        `To append character c at position i, take the current last node and test whether the character just before that palindrome is also c. If yes, the palindrome can be wrapped. If not, follow suffix links and try again. Once a wrap candidate is found, either reuse the existing c edge or create a new node and compute its suffix link by continuing the same fallback search from the candidate's suffix link.`,
      ],
    },
    {
      heading: `Correctness`,
      paragraphs: [
        `Only a suffix of the previous prefix can become a new palindrome ending at the newly appended character. More specifically, it must be a palindromic suffix, because wrapping a non-palindrome cannot produce a palindrome. Suffix links enumerate exactly those palindromic suffix candidates from longest to shortest.`,
        `If the longest successful wrap already has an outgoing edge for c, the resulting palindrome has been seen before. If it does not, that wrapped palindrome is the unique new distinct palindrome introduced by this append. Any shorter palindromic suffix ending at the new character also appeared as a palindrome earlier, because it occurs inside the newly formed longest suffix or was found by the fallback chain.`,
      ],
    },
    {
      heading: `Cost and Tradeoffs`,
      paragraphs: [
        `A string of length n has at most n distinct non-empty palindromic substrings, so the eertree has O(n) real nodes. With suitable transition maps, online construction is O(n) amortized time plus alphabet lookup costs. Space is O(n) nodes, suffix links, counters, and extension edges.`,
        `The structure stores distinct palindromes, not every occurrence as a separate object. Occurrence counting is an added layer: increment the node for the longest suffix on each append, then propagate counts from longer palindromes through suffix links to shorter palindromic suffixes after construction or in a carefully maintained online variant.`,
      ],
    },
    {
      heading: `Implementation checklist`,
      paragraphs: [
        `Keep the two artificial roots explicit. The length -1 root is not a real palindrome, but it makes the first character extension work without special cases. The length 0 root is the empty palindrome and anchors even-length cases. Removing these sentinels usually creates more conditionals and more bugs.`,
        `Store enough source information to test extension. Each node length tells the algorithm which character position must match the newly appended character. The current last pointer tells where to begin the suffix-link search. Transition maps should be chosen for the alphabet size: arrays for small alphabets, maps for large or sparse alphabets.`,
        `If occurrence counts matter, decide when counts are final. Online increments record how often each node is the longest suffix at an append step. To count all occurrences, propagate counts from longer nodes to their suffix links after construction, or maintain an online equivalent carefully.`,
      ],
    },
    {
      heading: `Testing it`,
      paragraphs: [
        `For small strings, compare the eertree node set against a brute-force set of palindromic substrings. Test repeated characters such as aaaaa, alternating strings such as ababa, strings with no long palindromes, and mixed alphabets. The node count should never exceed the string length.`,
        `Also test suffix-link chains. Every suffix link from a real node should point to a shorter palindrome that is a proper suffix of the source palindrome, and repeated suffix-link traversal should eventually reach the empty root. Those tests catch wrong fallback logic even when distinct counts look plausible.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Build ababa one character at a time. After a, the node a is created. After ab, b is created. After aba, last is b; appending a wraps b into aba. After abab, appending b wraps a into bab. After ababa, appending a wraps bab into ababa.`,
        `The suffix links expose the nesting: ababa links to aba, which links to a, which links to the empty root. That chain is not just decorative. It is the exact sequence the insertion logic would use if a future appended character failed to extend the current longest palindromic suffix.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Eertree wins for append-only or batched strings where palindrome inventory matters: text streams, product or transaction IDs, DNA bases, motif analysis, distinct-palindrome counting, longest palindromic suffix tracking, and analytics over repeated palindromic structure.`,
        `It is especially useful when answers are needed after each append. The current last pointer gives the longest palindromic suffix immediately, and the node set gives the distinct-palindrome inventory without recomputing over the whole prefix.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `The standard eertree is not a general mutable text-editor index. Middle insertions and deletions break the append-only construction order and usually require advanced double-ended or dynamic variants, a rope-like outer structure, or rebuilds.`,
        `It is also easy to overread the structure. It does not replace suffix arrays or FM-indexes for arbitrary substring search. Its suffix links are not suffix-array positions; they move only among palindromic suffixes. Distinct palindrome count and occurrence count are related but not the same question.`,
      ],
    },
    {
      heading: `Sources and Study Next`,
      paragraphs: [
        `Primary source: Rubinchik and Shur, "EERTREE: An Efficient Data Structure for Processing Palindromes in Strings", at https://arxiv.org/abs/1506.04862. For dynamic extensions, see "Double-Ended Palindromic Trees" at https://arxiv.org/abs/2210.02292.`,
        `Study KMP Prefix Function and Aho-Corasick Automaton for fallback-link intuition, Suffix Automaton for compact all-substring state, Suffix Array & LCP and FM-Index for static full-text indexing, Manacher's Algorithm for longest-palindrome radii, and Text Rope Data Structure for the mutable-text contrast.`,
      ],
    },
  ],
};
