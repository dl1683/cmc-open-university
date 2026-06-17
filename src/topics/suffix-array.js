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
      heading: 'Why this exists',
      paragraphs: [
        `A suffix array exists because a static text often needs many substring questions answered against the same content. Does this pattern occur? Where are all occurrences? What is the longest repeated substring? How many distinct substrings are in the text? Which genome read, log fragment, or document block shares the longest prefix with this one? Scanning the whole text from the beginning for every question repeats work that the text itself could have organized once.`,
        `The key observation is that every substring is a prefix of some suffix. If you can search the suffixes of the text, you can search for any substring. A suffix array takes all suffixes, sorts them lexicographically, and stores only their starting positions. The original text remains the source of characters. The array is the index.`,
        `This makes suffix arrays a compact alternative to pointer-heavy suffix trees and suffix tries. They support full-text search, repeated-substring analysis, compression transforms, bioinformatics matching, plagiarism detection, and deduplication. They are especially attractive when the text is mostly static and will be queried many times.`,
      ],
    },
    {
      heading: 'Why the obvious approach fails',
      paragraphs: [
        `The simplest search algorithm checks the pattern at every position in the text. For one short pattern, that can be fine. For thousands of queries over a large corpus, it is wasteful. The same prefixes are compared again and again, and every query pays for a fresh pass over the text.`,
        `The next idea is to build a trie containing every suffix. Then a substring query follows characters from the root and finds all suffixes below the matching node. That gives a clean conceptual index, but the explicit pointer structure can be huge. A naive suffix trie can have quadratic-size behavior, and even compressed suffix trees carry implementation complexity and pointer overhead.`,
        `A third naive idea is to copy every suffix string into an array and sort those strings. That is a useful teaching picture but a poor implementation for large text. Copying suffixes literally can use quadratic total space because the suffixes overlap heavily. A real suffix array stores integer start positions and compares through the original text.`,
      ],
    },
    {
      heading: 'Core structure',
      paragraphs: [
        `For a text T of length n, the suffix starting at position i is T[i..n). The suffix array SA is a permutation of positions 0 through n - 1. SA[r] is the start position of the r-th suffix in sorted lexicographic order. If SA[0] is 6, the smallest suffix starts at index 6. If SA[1] is 5, the next suffix starts at index 5, and so on.`,
        `Most examples append a sentinel character such as $ that is smaller than ordinary text characters and occurs nowhere else. The sentinel gives every suffix a unique ending and makes lexicographic comparisons clean. In the teaching text banana$, the sorted suffixes start at positions [6, 5, 3, 1, 0, 4, 2]. The array stores those numbers, not seven copied suffix strings.`,
        `Sorted order is the entire power of the structure. Suffixes that share a prefix are neighbors or occupy a contiguous interval. The array turns substring search into lower-bound and upper-bound searches over suffix order. It also turns repeated-substring analysis into a question about neighboring suffixes.`,
      ],
    },
    {
      heading: 'Searching with binary bounds',
      paragraphs: [
        `To search for a pattern P, compare P with suffixes in sorted order. A suffix is less than P if it is lexicographically smaller than the pattern prefix. A suffix is greater if it passes the pattern's possible interval. Binary search can find the first suffix that is not less than P. A second binary search can find the first suffix greater than all strings beginning with P. The interval between those bounds contains every occurrence.`,
        `The reason this works is a standard property of lexicographic order: all strings with the same prefix are contiguous. If two suffixes begin with P, then any suffix sorted between them must also lie inside the range of strings with prefix P. Otherwise the sorted order would be violated. The suffix array therefore converts many substring occurrences into one adjacent range.`,
        `The cost of basic search is O(m log n) character comparisons for pattern length m and text length n, although the exact cost depends on how much repeated comparison the implementation avoids. Even the basic form is often strong enough for teaching and moderate data. More advanced indexes build on the same order to reduce comparisons or compress the index.`,
      ],
    },
    {
      heading: 'LCP array',
      paragraphs: [
        `The longest-common-prefix array, usually called LCP, stores how many initial characters each sorted suffix shares with its previous neighbor. If SA[r - 1] points to anana$ and SA[r] points to ana$, their LCP value is 3 because both begin with ana. One number records the shared prefix that would otherwise be rediscovered by repeated character comparisons.`,
        `LCP makes suffix arrays useful for more than exact pattern lookup. The longest repeated substring is the maximum LCP value. The number of distinct substrings can be computed by summing the number of new prefixes contributed by each suffix, subtracting overlaps recorded by LCP. Range-minimum queries over LCP can answer suffix-tree-style lowest-common-ancestor questions between suffixes.`,
        `This is one of the cleanest examples of data structures composing. The suffix array supplies sorted suffix order. The LCP array supplies adjacency information. A Sparse Table or segment tree over LCP supplies fast range minima. Together they recover many capabilities associated with suffix trees while keeping array-based memory layout.`,
      ],
    },
    {
      heading: 'Construction methods',
      paragraphs: [
        `The teaching construction is direct: list every suffix, sort the suffixes, and keep the starting indexes. It is the right mental model. It is not the right large-scale algorithm if it copies substrings or compares long suffixes naively. Serious builders avoid materializing suffix strings and avoid repeating the same comparisons too much.`,
        `A common family of algorithms uses prefix doubling. At first, rank suffixes by their first character. Then rank them by pairs of ranks representing the first 2 characters, then 4, then 8, and so on. Each round sorts integer rank pairs instead of full strings. After enough rounds, the ranks determine full suffix order.`,
        `Linear-time algorithms such as SA-IS use induced sorting and more subtle classification of suffixes. They are harder to teach but important in production libraries and very large texts. Regardless of construction method, the finished structure is the same: an array of start positions in lexicographic suffix order, usually with an accompanying LCP array.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Take banana$. The raw suffixes are banana$ at 0, anana$ at 1, nana$ at 2, ana$ at 3, na$ at 4, a$ at 5, and $ at 6. Sorting them lexicographically gives $, a$, ana$, anana$, banana$, na$, nana$. The suffix array is therefore [6, 5, 3, 1, 0, 4, 2].`,
        `Search for ana. The suffixes beginning with ana are ana$ at start 3 and anana$ at start 1. In sorted order, those rows are adjacent. Binary search finds the interval where suffixes have prefix ana, and the starts inside that interval are the answer positions. The original text has not moved. The array simply points into it.`,
        `The LCP array for the same sorted suffixes records repeated prefixes between neighbors. The LCP between a$ and ana$ is 1. The LCP between ana$ and anana$ is 3. That value immediately reveals ana as a repeated substring. On a larger text, scanning LCP values finds the longest repeated runs without comparing every substring pair.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Every occurrence of a pattern starts at some text position. That position defines a suffix. The pattern occurs there exactly when the suffix beginning at that position has the pattern as a prefix. Therefore pattern search over the text is equivalent to prefix search over the set of suffixes.`,
        `Lexicographic sorting supplies contiguity. All suffixes with prefix P occupy one interval because no string outside the prefix range can be ordered between two strings inside it. Binary search is valid because comparisons with the pattern tell which side of the sorted order can still contain the lower or upper bound.`,
        `LCP works because repeated substrings become shared prefixes of suffixes. If a substring appears in two places, the two suffixes starting at those places share that substring as a prefix. In sorted order, the strongest shared-prefix evidence appears among neighboring suffixes, and range minima over neighboring LCP values describe shared prefixes across wider intervals.`,
      ],
    },
    {
      heading: 'Costs and behavior',
      paragraphs: [
        `The suffix array itself uses O(n) integers. The LCP array also uses O(n) integers. The text is stored once. This is the main memory advantage over naive suffix tries and over teaching implementations that copy suffix strings. In practice, integer width, encoding, and cache locality matter because large texts can make even O(n) structures substantial.`,
        `Basic pattern search costs O(m log n) comparisons in the simple implementation. With LCP-aware binary search, enhanced suffix arrays, or compressed indexes, repeated character comparisons can be reduced. Construction cost depends on the algorithm: naive suffix sorting can be much too slow, doubling is practical and understandable, and induced-sorting algorithms can reach linear time.`,
        `Updates are the weak spot. A suffix array is built for a static text. Inserting one character can change the order of many suffixes. Text editors, collaborative documents, and streaming logs often use ropes, piece tables, chunks, or periodic rebuilds instead of trying to mutate one monolithic suffix array after every edit.`,
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        `Keep suffixes as indexes into the original text. Do not build an array of substring copies for large input. In JavaScript, substring behavior and memory retention can be surprising across engines, so an educational implementation should be explicit: store numbers, compare by reading characters from the source, and avoid hidden quadratic memory use.`,
        `Be precise about character model. Many string algorithms are described over arrays of symbols, not necessarily JavaScript UTF-16 code units or user-visible grapheme clusters. If the index is for human text, decide whether you search bytes, UTF-16 code units, Unicode code points, normalized text, or grapheme clusters. The suffix array only preserves the order of the chosen symbol sequence.`,
        `Choose a sentinel that cannot collide with real input and has a defined order. In examples, $ is convenient. In production, the sentinel may be an integer symbol outside the alphabet. Also decide whether returned positions are byte offsets, code-unit offsets, code-point offsets, or application-level token offsets. Search results are only useful when their coordinate system is clear.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The biggest teaching failure is mistaking the displayed suffix text for the stored structure. The table may show banana$ or anana$ so the order is visible, but the structure stores starts such as 0 and 1. Copying every displayed suffix is how a clean idea becomes a memory problem.`,
        `Another failure is assuming lexicographic search equals natural-language search. Case folding, accents, normalization, token boundaries, punctuation, stemming, and locale collation are application concerns. A suffix array over raw symbols will find exact symbol substrings. It will not automatically understand words, languages, or document semantics.`,
        `Construction can also fail through comparator cost. Sorting suffix starts with a comparator that scans characters from scratch can degrade badly on texts with long repeated prefixes, such as genomic data or repeated logs. That is exactly where LCP and better construction algorithms matter. The data structure is elegant, but the builder must respect adversarial or repetitive input.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `Suffix arrays are useful anywhere the same static sequence gets searched or analyzed repeatedly. Full-text search components use the sorted suffix idea directly or in compressed descendants. Bioinformatics tools use suffix order and related indexes to find reads and repeated sequences. Deduplication systems use long common prefixes to discover repeated blocks. Compression pipelines use suffix order in the Burrows-Wheeler transform.`,
        `They are also valuable pedagogically because they connect many topics. Binary search explains query intervals. Tries explain the prefix-search alternative. Sparse Tables explain fast LCP range minima. Burrows-Wheeler and FM-indexes show how sorted suffix order can become compressed search. Entropy coding shows why repeated substrings matter to compression.`,
      ],
    },
    {
      heading: 'When to choose something else',
      paragraphs: [
        `Use a hash table or rolling hash when you only need membership for fixed-size shingles and can tolerate or manage collision behavior. Use a trie when the indexed set is a dictionary of separate keys and prefix enumeration is the main operation. Use a rope or piece table when text changes constantly and editing performance is more important than global substring analysis.`,
        `Use a suffix tree or enhanced suffix array when you need richer tree-shaped operations and can afford the implementation complexity. Use an FM-index when memory is tight and compressed full-text search is the goal. The suffix array is often the conceptual bridge: simple enough to teach from sorted arrays, powerful enough to lead into the production indexes built on the same suffix order.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Trie and Compressed Trie to compare pointer-based prefix search with sorted suffix order. Study Binary Search for lower and upper bounds, Sparse Table for LCP range-minimum queries, and Segment Tree if you want an update-capable range-query contrast. Then read Burrows-Wheeler Transform and FM-Index to see how suffix order becomes compressed full-text search.`,
        `For adjacent application topics, study Rolling Hash and Rabin-Karp for probabilistic substring matching, KMP for single-pattern linear search, Rope and Piece Table for mutable text, Huffman Coding and Entropy and Information for compression context, and Compressed Sparse Row as another example of replacing pointer-heavy structure with compact arrays of offsets.`,
      ],
    },
  ],
};
