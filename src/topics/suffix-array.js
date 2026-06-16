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
      heading: 'What it is',
      paragraphs: [
        'A suffix array is a sorted list of every suffix of a string, stored by start index. For the text banana$, the suffixes are banana$, anana$, nana$, ana$, na$, a$, and $. Sort them lexicographically and store the starting positions. That compact array becomes a full-text index: any substring occurs in a contiguous interval of sorted suffixes.',
        'The LCP array, or longest-common-prefix array, stores how many characters adjacent sorted suffixes share. Suffix array plus LCP gives much of the power of a suffix tree with a simpler, more memory-friendly representation.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The naive construction is simple: generate every suffix, sort them, and record their start positions. That costs O(n^2 log n) if implemented literally because suffix comparisons can scan many characters. Production constructions use doubling, induced sorting, or SA-IS-style algorithms to build in O(n log n) or O(n). The educational invariant stays the same: sorted suffix order groups common prefixes together.',
        'To search for a pattern of length m, binary-search the suffix array. Compare the pattern to the suffix at the middle rank. Once you find the lower and upper bounds, every suffix in that interval begins with the pattern. LCP accelerates repeated queries and enables range-minimum tricks for deeper string questions.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space is O(n) for the suffix array and O(n) for the LCP array. Pattern search is O(m log n) with straightforward binary search, and can be improved with LCP-aware search. Construction cost depends on the algorithm: naive construction is fine for teaching, but serious text indexes use specialized linear or near-linear algorithms. The structure is static: updates usually require rebuilding or using a different index.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Suffix arrays are used in full-text search, genome sequence matching, compression pipelines, repeated-substring detection, plagiarism checks, and deduplication. They connect naturally to Burrows-Wheeler transform indexes, which power tools in bioinformatics and compressed search. The reason is structural: all occurrences of the same substring become neighbors after sorting all suffixes.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A suffix array is not a hash table for strings. It preserves lexicographic order, supports range queries, and can answer prefix intervals without collision risk. It is also not a dynamic text editor structure. If the text changes constantly, a Rope or balanced tree of chunks may be better. Suffix arrays shine when the text is large, mostly static, and queried many times.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Read Trie (Prefix Tree) to compare pointer-heavy prefix search with sorted-suffix search. Study Binary Search for the query loop, Sparse Table for LCP range-minimum queries, and Entropy & Information for the compression connection. Then revisit Huffman Coding to see a different kind of text structure optimized for bits instead of substring search.',
      ],
    },
  ],
};
