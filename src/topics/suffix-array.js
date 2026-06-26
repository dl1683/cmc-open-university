// Suffix array: sort every suffix of a string once, then use binary search
// and LCP structure to answer substring questions fast.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'suffix-array',
  title: 'Suffix Array & LCP',
  category: 'Data Structures',
  summary: 'Sort all suffixes of a string, then binary-search substrings and reuse longest-common-prefix structure.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['build and search banana', 'LCP table'], defaultValue: 'build and search banana' },
  ],
  run,
};

const TEXT = 'banana$';
const suffixes = Array.from({ length: TEXT.length }, (_, i) => ({
  index: i,
  suffix: TEXT.slice(i),
})).sort((a, b) => a.suffix.localeCompare(b.suffix));

function suffixTable(title, rowsData = suffixes) {
  return matrixState({
    title,
    rows: rowsData.map((s, i) => ({ id: `r${i}`, label: `rank ${i}` })),
    columns: [
      { id: 'start', label: 'start' },
      { id: 'suffix', label: 'suffix' },
      { id: 'note', label: 'note' },
    ],
    values: rowsData.map((s) => [s.index, s.index + 100, 999]),
    format: (v) => {
      if (v === 999) return 'sorted suffix';
      if (v >= 100) return TEXT.slice(v - 100);
      return String(v);
    },
  });
}

function* buildAndSearch() {
  const raw = Array.from({ length: TEXT.length }, (_, i) => ({ index: i, suffix: TEXT.slice(i) }));
  yield {
    state: suffixTable('All suffixes before sorting', raw),
    highlight: {},
    explanation: `A suffix array starts with a text and writes down every suffix: ${raw[0].suffix}, ${raw[1].suffix}, ${raw[2].suffix}, and so on. With ${raw.length} suffixes from a ${TEXT.length}-character text, the dollar sign is a sentinel smaller than normal characters, so every suffix has a unique ending.`,
  };

  yield {
    state: suffixTable('Suffix array: suffixes sorted lexicographically'),
    highlight: { active: suffixes.map((_, i) => `r${i}:suffix`) },
    explanation: `Sort those ${suffixes.length} suffixes lexicographically and keep only their start positions. For ${TEXT}, the suffix array is [${suffixes.map(s => s.index).join(', ')}]. This is a Trie flattened into a sorted array: common prefixes become neighboring rows.`,
    invariant: `Suffix array entry SA[i] is the start index of the i-th sorted suffix. SA[0] = ${suffixes[0].index} points to "${suffixes[0].suffix}", the lexicographically smallest.`,
  };

  yield {
    state: suffixTable('Binary search for pattern "ana"'),
    highlight: { compare: ['r3:suffix'], range: ['r1:suffix', 'r2:suffix', 'r3:suffix'] },
    explanation: `To search for "ana", binary-search the ${suffixes.length} sorted suffixes. Compare the pattern with the middle suffix at rank 3 ("${suffixes[3].suffix}"). If the suffix is too small, move right; if too large, move left. Then expand to the neighboring suffixes that share the same prefix.`,
  };

  yield {
    state: suffixTable('Matches are adjacent: anana$ and ana$'),
    highlight: { found: ['r2:suffix', 'r3:suffix'], active: ['r2:start', 'r3:start'] },
    explanation: `The matches for "ana" are adjacent in suffix-array order: starts ${suffixes[2].index} and ${suffixes[3].index}. That is the core power: substring search becomes Binary Search over ${suffixes.length} sorted suffixes. No hash collisions, no backtracking, and the original ${TEXT.length}-character text remains untouched.`,
  };
}

function lcp(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
  return n;
}

const lcps = suffixes.map((s, i) => i === 0 ? 0 : lcp(suffixes[i - 1].suffix, s.suffix));

function* lcpView() {
  yield {
    state: matrixState({
      title: 'LCP: common prefix with the previous sorted suffix',
      rows: suffixes.map((s, i) => ({ id: `r${i}`, label: `rank ${i}` })),
      columns: [
        { id: 'suffix', label: 'suffix' },
        { id: 'prev', label: 'previous' },
        { id: 'lcp', label: 'LCP' },
      ],
      values: suffixes.map((s, i) => [s.index + 100, i === 0 ? 999 : suffixes[i - 1].index + 100, lcps[i]]),
      format: (v) => {
        if (v === 999) return '-';
        if (v >= 100) return TEXT.slice(v - 100);
        return String(v);
      },
    }),
    highlight: { active: ['r2:lcp', 'r3:lcp'] },
    explanation: `The LCP array stores how many characters each sorted suffix shares with the previous sorted suffix. For ${TEXT}, "${suffixes[2].suffix}" and "${suffixes[3].suffix}" share ${lcps[3]} characters. Neighboring suffixes expose repeated substrings.`,
  };

  yield {
    state: matrixState({
      title: 'What LCP unlocks',
      rows: [
        { id: 'repeat', label: 'longest repeat' },
        { id: 'count', label: 'distinct substrings' },
        { id: 'lca', label: 'tree queries' },
        { id: 'search', label: 'pattern search' },
      ],
      columns: [
        { id: 'operation', label: 'operation' },
        { id: 'structure', label: 'structure' },
        { id: 'cost', label: 'cost idea' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'max LCP', 'LCP array', 'scan once',
        'sum suffix lengths minus LCP', 'suffix array + LCP', 'count without duplicates',
        'range minimum over LCP', 'Sparse Table', 'O(1) RMQ',
        'lower and upper bound', 'Binary Search', 'O(m log n)',
      ][v],
    }),
    highlight: { found: ['lca:structure', 'search:structure'] },
    explanation: `LCP turns the suffix array from a search index into a string-analysis tool. The max LCP value is ${Math.max(...lcps)}, revealing the longest repeated substring. Range-minimum queries over the ${lcps.length}-entry LCP array answer suffix-tree-style questions, so Sparse Table becomes a natural companion.`,
  };

  yield {
    state: matrixState({
      title: 'Where suffix arrays show up',
      rows: [
        { id: 'text', label: 'full-text search' },
        { id: 'bio', label: 'bioinformatics' },
        { id: 'compress', label: 'compression' },
        { id: 'diff', label: 'deduplication' },
      ],
      columns: [
        { id: 'problem', label: 'problem' },
        { id: 'why_sa', label: 'why suffix array helps' },
        { id: 'neighbor', label: 'related topic' },
      ],
      values: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      format: (v) => [
        '',
        'find substrings', 'sorted suffixes', 'Trie',
        'match DNA reads', 'shared prefixes', 'Huffman Coding',
        'Burrows-Wheeler transform', 'suffix order', 'Entropy & Information',
        'repeated blocks', 'long LCP runs', 'Rope',
      ][v],
    }),
    highlight: { active: ['bio:why_sa', 'compress:why_sa'] },
    explanation: `Suffix arrays sit behind search engines, genome tooling, compression, plagiarism detection, and large-scale deduplication. For a text of length ${TEXT.length}, you get ${suffixes.length} sorted entry points -- every possible substring becomes searchable with one sorted index.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'build and search banana') yield* buildAndSearch();
  else if (view === 'LCP table') yield* lcpView();
  else throw new InputError('Pick a suffix-array view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Each row is one suffix of the text, which means the substring that starts at a position and continues to the end. The suffix array is the list of starting positions after those suffixes are sorted lexicographically. In the search frames, the active range is the binary-search interval over sorted suffixes.',
        {type: 'callout', text: 'A suffix array flattens the suffix tree idea into sorted integers: every substring search becomes a prefix search over neighboring suffixes.'},
        'A green match means the pattern is a prefix of that suffix. The safe inference is contiguity: if two sorted suffixes start with the same pattern, every suffix between them starts with that pattern too. The LCP view adds longest-common-prefix lengths between neighboring sorted suffixes.',
        {type: 'image', src: './assets/gifs/suffix-array.gif', alt: 'Animated walkthrough of the suffix array visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A long text is often searched many times. Scanning the whole text for each query costs O(nm) for text length n and pattern length m, and it repeats the same comparisons across queries. An index pays preprocessing once so later substring searches can skip most of the text.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Suffix_tree_BANANA.svg/250px-Suffix_tree_BANANA.svg.png', alt: 'Suffix tree for the text BANANA with suffix links and leaves', caption: 'Suffix arrays keep the suffix order that a tree exposes, but store it as a flat integer array instead of pointer-heavy topology. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Suffix_tree_BANANA.svg.'},
        'Suffix trees already give fast substring queries, but their pointer-heavy layout is expensive. A suffix array keeps the essential sorted-suffix order as integers. The original text is stored once, and each array entry points back into it.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to store every suffix as a separate string and sort those strings. Then a pattern query is a binary search for suffixes that start with the pattern. For banana$, the stored strings would include banana$, anana$, nana$, ana$, na$, a$, and $.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie containing words with shared prefixes', caption: 'The suffix tree begins from the trie idea: share common prefixes, then compress paths and finally flatten order into an array. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
        'That approach is easy to understand because every row is a real string. It is also a reasonable bridge from tries, where shared prefixes are represented explicitly. The problem is that the string copies are far larger than the text they came from.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Storing all suffix strings takes 1 + 2 + ... + n characters, which is n(n+1)/2. A one-million-character text would require about 500 billion copied characters. Sorting those copies also compares long overlapping prefixes again and again.',
        'A suffix tree avoids copies but pays in pointers, maps, suffix links, and edge metadata. The wall is physical memory and cache behavior, not only Big-O notation. The index needs the search power of suffix order without carrying a tree full of heap objects.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every substring occurrence begins at some text position, so every substring is a prefix of some suffix. If all suffixes are sorted, finding a substring becomes finding a range of suffixes with that prefix. The array only has to store the starting positions in sorted order.',
        'This trades pointer topology for order. Binary search finds the left and right boundary of the matching prefix range. The LCP array restores some lost tree information by recording how much neighboring suffixes share.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build starts from positions 0 through n-1 and sorts the suffixes beginning at those positions. Practical algorithms do not copy suffix strings; they compare or rank positions against the original text. Prefix-doubling ranks suffixes by 1, then 2, then 4 characters, while SA-IS builds the order in linear time by inducing sorted groups.',
        'Search compares the pattern with the suffix at the middle array position. If the suffix is lexicographically smaller than the pattern prefix, move right; if it is larger, move left. A second boundary search finds the first and last suffix whose prefix equals the pattern.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness starts from the suffix fact: an occurrence of pattern P at position i means suffix text[i..] has P as its prefix. Therefore the answer positions are exactly the suffix-array entries whose suffixes begin with P. No other position can contain the occurrence because every position has exactly one suffix.',
        'The matching entries form one contiguous interval. If suffix A and suffix B both begin with P, any sorted suffix between them must also lie between strings with prefix P. A suffix without that prefix would compare either before the whole P block or after it, so binary search can find the interval boundaries safely.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Construction cost depends on the algorithm: naive sorting can be quadratic or worse, prefix doubling is commonly O(n log n), and SA-IS is O(n). Space for the suffix array is n integers, often 4n or 8n bytes. The LCP array adds another n integers when longest-common-prefix queries are needed.',
        'A plain search costs O(m log n) character comparisons for pattern length m because each binary-search step can inspect up to m characters. With LCP acceleration, repeated comparisons are skipped and the cost approaches O(m + log n). When the text doubles, the array doubles in memory and binary search adds one comparison level.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Bioinformatics indexes use suffix-array order inside compressed structures such as FM-indexes. Genome alignment needs to search billions of short reads against a large reference without scanning the reference for each read. The suffix order is the base that lets backward search and compression work.',
        'Full-text search, compression, deduplication, and plagiarism detection use the same sorted-suffix view. The Burrows-Wheeler Transform reads characters preceding sorted suffixes, which clusters similar contexts. LCP maxima expose long repeats without comparing every pair of positions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Suffix arrays are static. Inserting one character can change the relative order of many suffixes, so mutable editors and live logs usually need periodic rebuilds or different structures. The array is excellent for read-heavy text and awkward for frequent middle edits.',
        'They also lose explicit branching topology. Some suffix-tree algorithms use suffix links and tree nodes directly, while a suffix array needs LCP and range-minimum structures to recover similar information. For one pattern against one text, KMP or Boyer-Moore is simpler and avoids index construction.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For banana$, list suffixes by start: 0 banana$, 1 anana$, 2 nana$, 3 ana$, 4 na$, 5 a$, and 6 $. Sorting gives $, a$, ana$, anana$, banana$, na$, nana$. The suffix array is [6, 5, 3, 1, 0, 4, 2].',
        'Search for ana. The matching sorted suffixes are ana$ at rank 2 and anana$ at rank 3. Their starting positions are 3 and 1, so ana occurs at text positions 1 and 3 after sorting the answer positions.',
        'The LCP array with previous suffixes is [0, 0, 1, 3, 0, 0, 2]. The value 3 between ana$ and anana$ means the longest neighboring repeat has length 3. That repeat is ana, found from the suffixes starting at 3 and 1.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Manber and Myers, "Suffix Arrays: A New Method for On-Line String Searches," 1993, for the original structure. Then study Kasai et al. for linear-time LCP construction and Nong, Zhang, and Chan for SA-IS construction.',
        'Study binary search and tries before this topic. Afterward, study suffix trees, suffix automata, Burrows-Wheeler Transform, FM-indexes, and range-minimum queries over LCP arrays.',
      ],
    },
  ],
};