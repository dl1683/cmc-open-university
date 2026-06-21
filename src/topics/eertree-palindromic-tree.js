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
    explanation: `An eertree is built online. After each appended character, it finds the longest palindromic suffix that can be extended by that character. For ababa, all ${PREFIX_STEPS.length} steps each create one new distinct palindrome.`,
    invariant: `Each of the ${PREFIX_STEPS.length} non-root nodes represents one distinct palindrome.`,
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
    explanation: `At prefix abab, the longest palindromic suffix is bab. Appending a checks whether the character before bab is also a. It is, so a + bab + a creates ababa — the ${PREFIX_STEPS.length}th distinct palindrome.`,
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
    explanation: `Suffix links are the recovery mechanism. If the current longest palindromic suffix cannot be wrapped by the new character, follow suffix links until one can — up to ${PREFIX_STEPS.length} fallback attempts in this example. This is the palindrome version of fallback links in KMP and Aho-Corasick.`,
  };
}

function* rootsAndSuffixLinks() {
  yield {
    state: eertreeGraph('Eertree nodes for ababa'),
    highlight: { active: ['oddRoot', 'evenRoot'], found: ['a', 'b', 'aba', 'bab', 'ababa'] },
    explanation: `The two roots are special among the ${7} nodes shown. The length -1 root makes single-character palindromes easy to create. The length 0 root represents the empty palindrome. The remaining ${PREFIX_STEPS.length} real nodes each store a palindrome length and outgoing character-extension edges.`,
    invariant: `At most n distinct non-empty palindromes exist (here ${PREFIX_STEPS.length} for a ${PREFIX_STEPS.length}-character string), so the eertree is linear size.`,
  };

  yield {
    state: eertreeGraph('Suffix links connect palindromic suffixes'),
    highlight: { active: ['ababa', 'aba', 'a', 'evenRoot'], compare: ['bab', 'b'] },
    explanation: `A suffix link points to the longest proper palindromic suffix. For ababa, the suffix-link chain goes ababa -> aba -> a -> empty — ${3} hops through ${PREFIX_STEPS.length} palindrome nodes. These links power online fallback and also expose nested palindrome structure.`,
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
    explanation: `Eertree belongs in the same family as suffix automata and Aho-Corasick: compact states plus fallback links. Compared across ${4} structures in the matrix, its specialty is palindromic substrings, which ordinary suffix indexes can answer but do not expose as directly.`,
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
    explanation: `A production-style use case is scanning a stream of text, IDs, or DNA bases through ${5} pipeline stages while maintaining the inventory of distinct palindromic substrings and the longest palindromic suffix after every append.`,
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
    explanation: `Eertree is strongest for append-only or batched strings. The fit matrix scores ${5} use cases from excellent to weaker — arbitrary middle edits are a different problem; use a Rope, Piece Table, or a rebuilt index when text changes everywhere.`,
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
    explanation: `The eertree is an online index service with ${5} pipeline nodes and ${5} edges: append characters, update the current longest palindromic suffix, create a node only for a new distinct palindrome, and answer inventory queries without rescanning the whole text.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has three views. "Online insertions" shows the eertree growing character by character: each row is one append, and the columns show which new palindrome was created, which existing node it extended from, and how many distinct palindromes exist so far. "Roots and suffix links" draws the full node-and-edge graph after construction, separating extension edges (which build longer palindromes) from suffix links (which chain palindromic suffixes). "Palindrome analytics" traces the streaming pipeline from character input to query output.',
        {
          type: 'callout',
          text: 'The eertree works because a new character can create only one new distinct palindrome: the longest new palindromic suffix.',
        },
        'Active highlights mark the node or link the algorithm is currently testing. Found highlights mark a node that has just been created or a query that has been answered. Compare highlights show a parallel structure worth contrasting, such as the suffix-link chain alongside the extension-edge chain.',
        'Follow the suffix-link arrows carefully. They are the fallback mechanism: when the current longest palindromic suffix cannot be extended by a new character, the algorithm walks suffix links to shorter candidates. This is the same idea as failure links in KMP and Aho-Corasick, applied to palindromes.',
      
        {type: 'image', src: './assets/gifs/eertree-palindromic-tree.gif', alt: 'Animated walkthrough of the eertree palindromic tree visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Palindromes appear in string problems constantly: longest palindromic substring, counting distinct palindromic substrings, palindromic factorization, detecting symmetry in DNA sequences, and competitive-programming queries that ask "how many palindromes end at position i?" These are not exotic questions. They come up in bioinformatics, text analytics, and contest problem sets every year.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Enigmatic_inscription_of_St_Peter_ad_Oratorium_400.jpg/250px-Enigmatic_inscription_of_St_Peter_ad_Oratorium_400.jpg',
          alt: 'Ancient square palindrome inscription carved in stone',
          caption: 'Historical palindromes show why symmetry in strings became a recurring object of study. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Enigmatic_inscription_of_St_Peter_ad_Oratorium_400.jpg',
        },
        'General substring structures like suffix trees, suffix arrays, and suffix automata can answer palindrome queries, but palindromes are not first-class citizens in those structures. You need extra work to extract them. The eertree (palindromic tree), introduced by Rubinchik and Shur in 2015, flips the priority: every node is a distinct palindromic substring, every edge extends a palindrome, and every suffix link connects palindromic suffixes. The structure you build is the answer.',
        'The name "eertree" is itself a palindrome. The structure contains at most n + 2 nodes for a string of length n (n real palindromes plus two sentinel roots), so it is always linear in size. It builds online, one character at a time, which means it works on streams and can answer queries after every append.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing anyone tries is brute force: enumerate all O(n^2) substrings, check each one for palindromicity in O(n) time, and collect the distinct ones in a hash set. This costs O(n^3) and is fine for short strings.',
        'The next step up is Manacher\'s algorithm, which finds all maximal palindromic radii in O(n) time. Manacher is elegant and fast, but it answers a different question: it tells you the longest palindrome centered at each position. It does not directly give you the set of distinct palindromic substrings, their nesting structure, or their occurrence counts. To extract distinct palindromes from Manacher output, you still need post-processing.',
        {
          type: 'table',
          headers: ['Approach', 'Build time', 'Distinct count', 'Online', 'Suffix structure'],
          rows: [
            ['Brute force + hash set', 'O(n^3)', 'Yes', 'No', 'No'],
            ['Manacher\'s algorithm', 'O(n)', 'Needs post-processing', 'No', 'No'],
            ['Suffix tree + LCA queries', 'O(n)', 'Yes, with work', 'No', 'Yes'],
            ['Eertree', 'O(n) amortized', 'Yes, directly', 'Yes', 'Yes'],
          ],
        },
        'Suffix trees can answer palindrome queries, but extracting all distinct palindromic substrings requires combining the suffix tree with its reverse and performing LCA computations. The eertree collapses all of that into one pass.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is online distinctness tracking. After appending one character to a string of length i, some new palindromic substrings may appear. But which ones? Only palindromic suffixes of the new prefix can be new, because a new palindrome must end at the newly appended character. And only suffixes that are themselves palindromes qualify, because wrapping a non-palindrome with matching characters does not produce a palindrome.',
        'The key constraint is that at most one new distinct palindrome appears per character append. Rubinchik and Shur proved this: the longest new palindromic suffix is either already in the structure (in which case no new palindrome appears) or it is genuinely new (in which case every shorter palindromic suffix of this new palindrome already existed at an earlier position). This bound of at most n distinct palindromic substrings in a string of length n is tight (consider "abcde...") and is the reason the eertree stays linear.',
        'Without this structural insight, you are stuck rescanning the entire prefix after every append, or maintaining a hash set that cannot answer nesting or suffix-chain queries.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The eertree has two sentinel roots. The odd root has length -1 and is a trick: when you wrap it with a character c, you get c + (nothing) + c = c, a single-character palindrome of length 1. The even root has length 0 and represents the empty string, anchoring even-length palindromes. Every real palindrome node has a length, outgoing character-extension edges, and a suffix link to its longest proper palindromic suffix.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/c/c2/Palindrome_Tree_TACOCAT_Example.png',
          alt: 'Palindrome tree example for the word TACOCAT',
          caption: 'A palindromic tree stores each distinct palindrome as a node and connects suffix structure explicitly. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Palindrome_Tree_TACOCAT_Example.png',
        },
        {
          type: 'diagram',
          label: 'Eertree root structure and suffix links for "ababa"',
          text: [
            '  odd root (len -1)',
            '    |--a--> [a] (len 1) --suffix--> even root',
            '    |--b--> [b] (len 1) --suffix--> even root',
            '',
            '  even root (len 0)',
            '',
            '  Extension edges:',
            '    [b] --a--> [aba] (len 3) --suffix--> [a]',
            '    [a] --b--> [bab] (len 3) --suffix--> [b]',
            '    [bab] --a--> [ababa] (len 5) --suffix--> [aba]',
            '',
            '  Suffix-link chain for ababa:',
            '    [ababa] --> [aba] --> [a] --> even root',
          ].join('\n'),
        },
        'To append character c: take the current "last" node (the longest palindromic suffix of the previous prefix). Check whether s[i - last.len - 1] == c, meaning the character just before this palindrome matches the character being appended. If yes, the palindrome can be wrapped: c + palindrome + c. If not, follow the suffix link to a shorter palindromic suffix and try again. Repeat until a match is found or you reach the odd root (which always matches, producing a single-character palindrome).',
        {
          type: 'code',
          language: 'javascript',
          text: [
            'function appendChar(c, i, s, nodes, last) {',
            '  // Walk suffix links to find a palindrome that c can wrap',
            '  let cur = last;',
            '  while (s[i - cur.len - 1] !== c) cur = cur.suffLink;',
            '',
            '  // If edge already exists, palindrome was seen before',
            '  if (cur.edges.has(c)) {',
            '    last = cur.edges.get(c);',
            '    return last;  // no new node',
            '  }',
            '',
            '  // Create new node for the palindrome c + cur + c',
            '  const newNode = { len: cur.len + 2, edges: new Map(), suffLink: null };',
            '  cur.edges.set(c, newNode);',
            '',
            '  // Compute suffix link: find next shorter wrappable palindrome',
            '  let q = cur.suffLink;',
            '  while (s[i - q.len - 1] !== c) q = q.suffLink;',
            '  newNode.suffLink = q.edges.get(c) || evenRoot;',
            '',
            '  nodes.push(newNode);',
            '  last = newNode;',
            '  return last;',
            '}',
          ].join('\n'),
        },
        'Once the wrappable palindrome is found, either the c-edge already exists (the palindrome was seen before, no new node) or a new node is created. The new node\'s suffix link is computed by continuing the same fallback search from the wrappable node\'s suffix link. This guarantees the suffix-link chain is always correct.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on three facts. First, any new palindrome introduced by appending character c must be a suffix of the new prefix ending at position i, and it must be a palindrome, so it must be a palindromic suffix. The suffix-link chain enumerates all palindromic suffixes from longest to shortest, so the search is complete.',
        'Second, at most one new distinct palindrome is created per append. Suppose the longest new palindromic suffix P is new. Every shorter palindromic suffix of the new prefix is also a palindromic suffix of P (by the nesting property of palindromes), and P contains each of them as a substring. Since P ends at position i but has length less than i+1, each shorter palindromic suffix also occurred at an earlier position. Therefore it was already in the eertree.',
        'Third, the suffix-link computation for the new node is correct because it follows the same fallback logic one level down. The suffix link of a palindrome P = cXc is the longest proper palindromic suffix of P that is itself a palindrome. That suffix must be of the form cYc where Y is a palindromic suffix of X, which is exactly what the continued fallback search finds.',
        {
          type: 'note',
          text: 'The amortized O(n) time bound follows from a potential argument: the "last" pointer can only increase the suffix-link depth by 1 per append, and each suffix-link traversal step decreases the depth. Total suffix-link steps across all appends is therefore O(n).',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'table',
          headers: ['Resource', 'Bound', 'Detail'],
          rows: [
            ['Nodes', 'At most n + 2', 'n real palindromes + 2 sentinel roots'],
            ['Edges (extension)', 'At most n', 'One per new palindrome'],
            ['Suffix links', 'n + 2', 'One per node'],
            ['Build time', 'O(n) amortized', 'Potential argument on suffix-link depth'],
            ['Space', 'O(n * |alphabet|) worst case', 'Or O(n) with hash maps for edges'],
            ['Per-append query', 'O(1) amortized', 'Current longest palindromic suffix'],
          ],
        },
        'When n doubles, the eertree roughly doubles in nodes and edges. There are no hidden quadratic costs. The amortized O(n) bound means individual appends may take more than O(1) when the suffix-link chain is long, but the total work across all appends is linear.',
        'Occurrence counting adds a post-processing pass: after building the full eertree, propagate counts from each node through its suffix link (from longest palindromes to shortest). This is O(n) total. For online occurrence counts, you need a more careful bookkeeping scheme, but the asymptotic cost remains linear.',
        'The alphabet matters for edge storage. With a fixed small alphabet (DNA: 4 characters), arrays work. With Unicode or large alphabets, hash maps keep space proportional to actual edges rather than alphabet size times node count.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Competitive programming is the eertree\'s home territory. Problems that ask for the number of distinct palindromic substrings, the longest palindromic suffix after each prefix, or palindromic factorization with minimum cuts are all natural fits. Codeforces problems 906E, 17E, and many ICPC regionals feature eertree solutions.',
        'Bioinformatics uses palindromes in DNA analysis (restriction enzyme sites are palindromic sequences). An eertree over a genome stream gives the distinct palindrome inventory without buffering the entire sequence.',
        {
          type: 'bullets',
          items: [
            'Count distinct palindromic substrings in O(n): just count the non-root nodes.',
            'Longest palindromic suffix after every prefix: maintained as the "last" pointer, available in O(1) amortized per append.',
            'Palindromic factorization (minimum palindrome partition): dynamic programming over eertree nodes with "series links" gives O(n log n) or O(n) solutions.',
            'Occurrence counting: build the eertree, propagate counts through suffix links in reverse order, read off counts per palindrome.',
            'Online streaming: the append-only construction handles character streams without needing the full string in memory.',
          ],
        },
        'The structure is also surprisingly easy to implement once you understand the two-root trick. A clean implementation is under 50 lines in most languages.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The standard eertree is append-only. If your text undergoes arbitrary insertions and deletions (a text editor, a collaborative document), the eertree cannot maintain itself incrementally. You need either a double-ended palindromic tree (which handles appends and prepends but not middle edits) or a complete rebuild.',
        'It does not replace general substring indexes. If you need arbitrary substring search, longest common substring, or suffix-array-style queries, the eertree is the wrong tool. Its suffix links connect palindromic suffixes only, not all suffixes. It knows nothing about non-palindromic substrings.',
        {
          type: 'note',
          text: 'A common mistake in competitive programming is confusing "distinct palindromic substrings" with "palindromic substrings counted with multiplicity." The eertree node count gives distinct palindromes. For total occurrences, you need the propagation step through suffix links.',
        },
        'For the single question "what is the longest palindromic substring?", Manacher\'s algorithm is simpler, faster in practice (smaller constant), and requires no auxiliary data structure. Reach for the eertree when you need the full palindrome inventory, not just the longest one.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'quote',
          text: 'A string of length n contains at most n + 1 distinct non-empty palindromic substrings.',
          attribution: 'Rubinchik and Shur, "EERTREE: An Efficient Data Structure for Processing Palindromes in Strings" (2015)',
        },
        {
          type: 'bullets',
          items: [
            'Primary source: Rubinchik and Shur, "EERTREE: An Efficient Data Structure for Processing Palindromes in Strings", European Symposium on Algorithms 2015. arXiv: https://arxiv.org/abs/1506.04862',
            'Double-ended extension: "Double-Ended Palindromic Trees" (2022), arXiv: https://arxiv.org/abs/2210.02292',
            'Palindromic factorization: Kosolobov, Rubinchik, and Shur, "Palindromic Factorization Revisited" (2020)',
          ],
        },
        'Study Manacher\'s algorithm for the simpler longest-palindrome problem and to build intuition about palindrome radii. Study KMP and Aho-Corasick for the failure-link / suffix-link pattern that the eertree borrows. Study the suffix automaton for the closest structural cousin: both are compact online automata over substrings, but the suffix automaton indexes all substrings while the eertree indexes only palindromes.',
        'For the mutable-text contrast, study rope data structures and piece tables. For static full-text indexing beyond palindromes, study suffix arrays with LCP and the FM-index.',
      ],
    },
  ],
};
