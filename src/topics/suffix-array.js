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
    explanation: 'A suffix array starts with a text and writes down every suffix: banana$, anana$, nana$, and so on. The dollar sign is a sentinel smaller than normal characters, so every suffix has a unique ending.',
  };

  yield {
    state: suffixTable('Suffix array: suffixes sorted lexicographically'),
    highlight: { active: suffixes.map((_, i) => `r${i}:suffix`) },
    explanation: 'Sort those suffixes lexicographically and keep only their start positions. For banana$, the suffix array is [6, 5, 3, 1, 0, 4, 2]. This is a Trie flattened into a sorted array: common prefixes become neighboring rows.',
    invariant: 'Suffix array entry SA[i] is the start index of the i-th sorted suffix.',
  };

  yield {
    state: suffixTable('Binary search for pattern "ana"'),
    highlight: { compare: ['r3:suffix'], range: ['r1:suffix', 'r2:suffix', 'r3:suffix'] },
    explanation: 'To search for "ana", binary-search the sorted suffixes. Compare the pattern with the middle suffix. If the suffix is too small, move right; if too large, move left. Then expand to the neighboring suffixes that share the same prefix.',
  };

  yield {
    state: suffixTable('Matches are adjacent: anana$ and ana$'),
    highlight: { found: ['r2:suffix', 'r3:suffix'], active: ['r2:start', 'r3:start'] },
    explanation: 'The matches for "ana" are adjacent in suffix-array order: starts 3 and 1. That is the core power: substring search becomes Binary Search over sorted suffixes. No hash collisions, no backtracking, and the original text remains untouched.',
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
    explanation: 'The LCP array stores how many characters each sorted suffix shares with the previous sorted suffix. For banana$, "ana$" and "anana$" share 3 characters. Neighboring suffixes expose repeated substrings.',
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
    explanation: 'LCP turns the suffix array from a search index into a string-analysis tool. Range-minimum queries over LCP answer suffix-tree-style questions, so Sparse Table becomes a natural companion. This is one of the cleanest examples of data structures composing.',
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
    explanation: 'Suffix arrays sit behind search engines, genome tooling, compression, plagiarism detection, and large-scale deduplication. They are what happens when you take every possible substring entry point and make it searchable with one sorted index.',
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
        'Each row is one suffix of the input text. The "start" column is the integer position where that suffix begins in the original string. The "suffix" column shows the characters from that position to the end. Before sorting, rows appear in text order (0, 1, 2, ...). After sorting, they appear in lexicographic order. That permutation of starting positions is the suffix array.',
        {type: 'callout', text: 'A suffix array flattens the suffix tree idea into sorted integers: every substring search becomes a prefix search over neighboring suffixes.'},
        'During the search steps, highlighted cells mark the active binary-search window. The compared cell is the midpoint. When matches appear, notice that they occupy a contiguous block of rows -- no gaps. That contiguity is the structural guarantee that makes binary search over suffixes correct: all suffixes sharing a prefix are neighbors in sorted order.',
        'In the LCP view, each row carries the count of leading characters shared with the previous sorted suffix. A high LCP value means a long repeated substring. The operations table shows what the LCP array unlocks beyond basic search: longest repeated substring, distinct substring count, and suffix-tree-equivalent queries via range-minimum.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Any text that will be searched many times deserves a one-time index. The human genome is 3 billion characters. A log corpus can be terabytes. Scanning the text from scratch for every query wastes the structure that sorting could expose.',
        'Suffix trees (Weiner 1973, Ukkonen 1995) solve this: build a compressed trie of every suffix in O(n) time, then search for any pattern of length m in O(m) time. The catch is memory. Each node needs child pointers, suffix links, and edge labels -- roughly 20 bytes per input character. A suffix tree for the human genome eats about 60 GB of RAM.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Suffix_tree_BANANA.svg/250px-Suffix_tree_BANANA.svg.png', alt: 'Suffix tree for the text BANANA with suffix links and leaves', caption: 'Suffix arrays keep the suffix order that a tree exposes, but store it as a flat integer array instead of pointer-heavy topology. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Suffix_tree_BANANA.svg.'},
        'Manber and Myers introduced the suffix array in 1993 to get the same substring-search power in far less space. A suffix array stores just n integers -- the starting positions of every suffix, sorted lexicographically. At 4 bytes per integer (32-bit indices), the human genome needs about 12 GB. Same query ability, five times less memory. The core observation: every substring of a text is a prefix of some suffix, so sorting suffixes makes every substring binary-searchable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Suffix trees. Ukkonen algorithm builds one in O(n) time and supports O(m) pattern search, longest repeated substring, longest common substring of two texts, and many other operations through tree traversal. For moderate-sized texts that fit in memory, suffix trees work well and the implementation (while nontrivial) is well-documented.',
        'An even simpler first attempt: store all n suffixes as separate strings in a sorted array. Binary search then finds any pattern as a prefix match. For "banana$", that means storing "$", "a$", "ana$", "anana$", "banana$", "na$", "nana$" as seven independent strings.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie containing words with shared prefixes', caption: 'The suffix tree begins from the trie idea: share common prefixes, then compress paths and finally flatten order into an array. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Trie_example.svg.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Storing suffixes as separate strings costs O(n^2) total characters: n + (n-1) + ... + 1 = n(n+1)/2. For n = 1,000,000, that is half a trillion characters just for the string copies. Sorting them is worse -- each comparison scans O(n) characters on average, so O(n log n) comparisons cost O(n^2 log n) total work.',
        'Suffix trees avoid the copy problem but pay a pointer tax. Each internal node carries child pointers (often one per alphabet symbol), a suffix link, and edge label indices. In practice this is 20+ bytes per character. For the human genome at 3 billion characters, the tree needs roughly 60 GB -- more RAM than most machines have. Ukkonen construction is O(n) but the output itself is too large.',
        'The problem is not algorithmic speed. It is physical memory. You need the search power of a suffix tree in the memory footprint of a flat array. The suffix array stores neither copied strings nor tree pointers -- just n integers pointing back into the original text.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Sort all n suffixes of the text lexicographically. Store only their starting positions in an array SA of n integers. SA[0] is the start of the lexicographically smallest suffix, SA[1] the next, and so on. The text itself is stored once; suffixes are never copied. Any comparison during construction reads characters directly from the text at the stored positions.',
        'Construction has three tiers. Naive: generate start positions 0..n-1, sort them with a comparator that compares the corresponding suffixes character by character. Cost: O(n^2 log n) worst case. Prefix doubling (Karp, Miller, Rosenberg): rank suffixes by their first character, then iteratively rank by the first 2, 4, 8, ... characters using pairs of previously computed ranks. After ceil(log n) rounds, ranks are final. Cost: O(n log^2 n) with comparison sort, O(n log n) with radix sort. SA-IS (Nong, Zhang, Chan 2009): classify each suffix as S-type or L-type, identify leftmost-S-type (LMS) suffixes, recursively sort a reduced problem of at most n/2 symbols, then induce all remaining positions. Cost: O(n) time, O(n) space.',
        'Search. To find pattern P of length m, binary search SA for the leftmost suffix that has P as a prefix and the rightmost suffix that has P as a prefix. Every position in between is an occurrence. Each comparison checks at most m characters, and there are O(log n) comparisons, so the total is O(m log n).',
        'The LCP array accelerates this. LCP[i] is the length of the longest common prefix between the suffix at SA[i] and the suffix at SA[i-1]. Kasai algorithm builds the LCP array in O(n) time from the suffix array and the text. With LCP information cached at binary-search boundaries, search drops to O(m + log n): the m characters of P are compared only once total, and log n steps navigate the suffix array using precomputed prefix lengths to skip redundant character comparisons.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Every occurrence of pattern P at position j means the suffix starting at j has P as its prefix. Searching for a substring in the text is therefore searching for a prefix among the suffixes. Sorting the suffixes makes prefix search reducible to binary search.',
        'Contiguity guarantee: if suffix A and suffix B both start with "ana", every suffix sorted between A and B must also start with "ana". Otherwise the lexicographic order would be violated -- a suffix without the "ana" prefix would be interleaved between two that have it, which contradicts sorted order. This means all occurrences of any pattern form a contiguous interval in SA, and binary search finds the interval boundaries.',
        'The LCP array recovers the tree structure that was discarded when moving from suffix trees to suffix arrays. In a suffix tree, the lowest common ancestor of two leaves tells you their longest shared prefix. In the suffix array, the longest common prefix between any two suffixes SA[i] and SA[j] equals the minimum value in LCP[i+1..j]. Range-minimum queries over the LCP array therefore answer the same questions as tree ancestor queries, at O(1) per query with a Sparse Table.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Construction: O(n) with SA-IS, O(n log n) with optimized prefix doubling, O(n^2 log n) with naive sorting. SA-IS is the standard choice in production -- linear time, linear space, and small constants.',
        'Search: O(m log n) with plain binary search, O(m + log n) with LCP-accelerated search. Once the matching interval [lo, hi] is found, the occurrence count is hi - lo + 1, and listing all positions costs O(k) where k is the count.',
        'Space: the suffix array is n integers. With 32-bit indices, that is 4n bytes. The LCP array adds another 4n bytes. The text itself takes n bytes (one byte per character for ASCII). Total: about 9n bytes. A suffix tree for the same text costs 20n bytes or more. For the human genome (n = 3 x 10^9): suffix array + LCP + text is roughly 27 GB; a suffix tree is roughly 60 GB. The suffix array fits in commodity RAM where the tree does not.',
        'Scaling behavior: doubling the text doubles the array sizes and SA-IS construction time (both linear). Search time grows by one binary-search step because log n increases by 1. The structure is cache-friendlier than a suffix tree because arrays are contiguous in memory while trees chase scattered pointers.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Bioinformatics is the dominant consumer. BWA (Burrows-Wheeler Aligner) and Bowtie build FM-indexes, which are compressed suffix arrays, to align billions of short DNA reads against a reference genome. The suffix array provides the sorted suffix order that the Burrows-Wheeler Transform needs. Without suffix-array-based indexing, mapping a single sequencing run against the human genome would take weeks instead of hours.',
        'Full-text search uses suffix arrays when queries are arbitrary substrings rather than whole words. This matters for languages without whitespace separators (Chinese, Japanese, Thai) and for code search tools that match arbitrary byte sequences. Inverted word indexes cannot handle these cases.',
        'Data compression. The Burrows-Wheeler Transform reorders the text by suffix-array order: BWT[i] = text[SA[i] - 1], the character preceding each sorted suffix. This clusters characters with similar contexts, making the result highly compressible. bzip2 applies BWT followed by move-to-front coding and Huffman coding.',
        'Deduplication and plagiarism detection use longest common substrings via LCP maxima to find shared content blocks between documents, without comparing every pair of positions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Construction complexity. SA-IS is O(n) and elegant in theory, but the implementation is subtle. Bugs in suffix classification (S-type vs L-type), LMS identification, or the induction step are hard to catch because they produce plausible-looking but incorrect arrays. Most practitioners rely on a tested library (libdivsufsort, SDSL) rather than reimplementing.',
        'Static text only. Inserting or deleting a character can change the relative order of many suffixes. Suffix arrays must be rebuilt from scratch after edits. For text editors, collaborative documents, or streaming logs, ropes, piece tables, or periodic rebuilds are more practical.',
        'Some operations are easier with suffix trees. Suffix links in trees allow O(1) transitions when shortening a pattern, which suffix arrays do not natively support. Algorithms that traverse suffix links heavily (some variants of Ukkonen-style online matching) do not translate cleanly to suffix arrays.',
        'For very short patterns with simple matching needs, inverted word indexes or hash-based approaches (Rabin-Karp) may be simpler to build, query, and maintain. The suffix-array power is substring-level generality; if you only need word-level lookup, simpler tools suffice.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Text: "banana$". The sentinel $ is lexicographically smaller than any letter, guaranteeing every suffix is unique. List the 7 suffixes with their starting positions: 0: banana$, 1: anana$, 2: nana$, 3: ana$, 4: na$, 5: a$, 6: $.',
        'Sort them lexicographically: $ (start 6), a$ (5), ana$ (3), anana$ (1), banana$ (0), na$ (4), nana$ (2). The suffix array is SA = [6, 5, 3, 1, 0, 4, 2]. Seven integers, not seven strings.',
        'Build the LCP array by comparing each sorted suffix with its predecessor. LCP[0] = 0 (no predecessor). LCP[1] = 0 ("$" vs "a$": no shared characters). LCP[2] = 1 ("a$" vs "ana$": share "a"). LCP[3] = 3 ("ana$" vs "anana$": share "ana"). LCP[4] = 0 ("anana$" vs "banana$": nothing shared). LCP[5] = 0 ("banana$" vs "na$": nothing). LCP[6] = 2 ("na$" vs "nana$": share "na"). The full LCP array is [0, 0, 1, 3, 0, 0, 2]. The maximum value is 3, so "ana" is the longest repeated substring.',
        'Search for "ana". Binary search the suffix array. The midpoint is rank 3, suffix "anana$". Compare the first 3 characters: "ana" matches "ana". Now find the boundaries. Rank 2, suffix "ana$", also starts with "ana". Rank 1, suffix "a$", does not (only 1 character matches). Rank 4, suffix "banana$", does not (0 characters match). The match interval is ranks 2-3, corresponding to SA values 3 and 1. Pattern "ana" occurs at text positions 1 and 3.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Manber & Myers, "Suffix Arrays: A New Method for On-Line String Searches," SIAM Journal on Computing, 1993 -- the original suffix array paper introducing the structure and O(n log n) construction. Karkkäinen & Sanders, "Simple Linear Work Suffix Array Construction," ICALP 2003 -- the DC3 algorithm, a clean linear-time construction. Nong, Zhang, Chan, "Two Efficient Algorithms for Linear Time Suffix Array Construction," 2009 -- SA-IS, the most widely used O(n) algorithm. Kasai et al., "Linear-Time Longest-Common-Prefix Computation in Suffix Arrays and Its Applications," 2001. Burrows & Wheeler, "A Block-sorting Lossless Data Compression Algorithm," 1994.',
        'Prerequisites: Binary Search (the query mechanism over the sorted array), sorting algorithms (construction foundation), Trie (the tree structure that suffix arrays flatten).',
        'Extensions: Burrows-Wheeler Transform (suffix-array-derived reordering for compression), FM-index (compressed suffix array enabling search in space proportional to the compressed text), suffix trees (pointer-heavy alternative with O(m) search and suffix links).',
        'Alternatives: KMP and Rabin-Karp for single-pattern search without indexing the text, Aho-Corasick for multi-pattern search, Sparse Table for O(1) range-minimum queries over the LCP array, inverted indexes for word-level rather than substring-level search.',
      ],
    },
  ],
};
