// FM-index: backward search over the Burrows-Wheeler transform.

import { matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'fm-index-bwt',
  title: 'FM-Index & Burrows-Wheeler Transform',
  category: 'Data Structures',
  summary: 'A compressed full-text index: use the BWT, C table, and Occ/rank counts to shrink a suffix-array interval by scanning the pattern backward.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bwt table', 'backward search'], defaultValue: 'bwt table' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function bwtMatrix(title) {
  return labelMatrix(
    title,
    [
      { id: 'r0', label: 'SA 6' },
      { id: 'r1', label: 'SA 5' },
      { id: 'r2', label: 'SA 3' },
      { id: 'r3', label: 'SA 1' },
      { id: 'r4', label: 'SA 0' },
      { id: 'r5', label: 'SA 4' },
      { id: 'r6', label: 'SA 2' },
    ],
    [
      { id: 'F', label: 'first column' },
      { id: 'L', label: 'BWT last column' },
      { id: 'suffix', label: 'suffix of banana$' },
    ],
    [
      ['$', 'a', '$'],
      ['a', 'n', 'a$'],
      ['a', 'n', 'ana$'],
      ['a', 'b', 'anana$'],
      ['b', '$', 'banana$'],
      ['n', 'a', 'na$'],
      ['n', 'a', 'nana$'],
    ],
  );
}

function indexGraph(title) {
  return graphState({
    nodes: [
      { id: 'text', label: 'banana$', x: 0.8, y: 4.0, note: 'text' },
      { id: 'sa', label: 'suffix array', x: 2.6, y: 2.2, note: 'sorted suffixes' },
      { id: 'bwt', label: 'BWT annb$aa', x: 4.7, y: 4.0, note: 'last column' },
      { id: 'c', label: 'C table', x: 6.8, y: 2.2, note: '$:0 a:1 b:4 n:5' },
      { id: 'occ', label: 'Occ/rank', x: 6.8, y: 5.8, note: 'counts in BWT prefix' },
      { id: 'interval', label: 'SA interval', x: 9.0, y: 4.0, note: 'matches pattern' },
    ],
    edges: [
      { id: 'e-text-sa', from: 'text', to: 'sa', weight: 'sort suffixes' },
      { id: 'e-sa-bwt', from: 'sa', to: 'bwt', weight: 'char before suffix' },
      { id: 'e-bwt-c', from: 'bwt', to: 'c', weight: 'first positions' },
      { id: 'e-bwt-occ', from: 'bwt', to: 'occ', weight: 'rank support' },
      { id: 'e-c-int', from: 'c', to: 'interval', weight: 'update left/right' },
      { id: 'e-occ-int', from: 'occ', to: 'interval', weight: 'update left/right' },
    ],
  }, { title });
}

function* bwtTable() {
  yield {
    state: indexGraph('FM-index stores enough to emulate suffix-array search'),
    highlight: { active: ['sa', 'bwt'], found: ['c', 'occ'], compare: ['text'] },
    explanation: 'The FM-index starts from a suffix array but stores a compressed representation based on the Burrows-Wheeler transform. The BWT groups similar contexts and still lets search move through suffix-array intervals.',
  };

  yield {
    state: bwtMatrix('BWT of banana$ is annb$aa'),
    highlight: { active: ['r2:L', 'r3:L', 'r4:L'], found: ['r2:suffix', 'r3:suffix'] },
    explanation: 'Sort all suffixes. The BWT last column stores the character immediately before each suffix in sorted order. For banana$, the last column is annb$aa.',
    invariant: 'Rows in the first column and last column represent the same cyclic rotations in different orders.',
  };

  yield {
    state: labelMatrix(
      'Search support tables',
      [
        { id: 'dollar', label: '$' },
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
        { id: 'n', label: 'n' },
      ],
      [
        { id: 'C', label: 'C[c]' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['0', 'first row starting with $'],
        ['1', 'first row starting with a'],
        ['4', 'first row starting with b'],
        ['5', 'first row starting with n'],
      ],
    ),
    highlight: { found: ['a:C', 'n:C'], compare: ['b:meaning'] },
    explanation: 'C[c] tells where suffixes beginning with character c start in the sorted suffix array. Occ(c, i) tells how many c characters occur in BWT positions before i.',
  };

  yield {
    state: labelMatrix(
      'Why compression and indexing meet',
      [
        { id: 'bwt', label: 'BWT' },
        { id: 'rank', label: 'rank/Occ' },
        { id: 'samples', label: 'SA samples' },
        { id: 'locate', label: 'locate positions' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['clusters contexts', 'compressible text shrinks'],
        ['counts symbols fast', 'needs succinct data structure'],
        ['store some SA rows', 'space versus locate time'],
        ['walk LF mapping', 'count is faster than locate'],
      ],
    ),
    highlight: { active: ['rank:role', 'samples:tradeoff'], found: ['bwt:tradeoff'] },
    explanation: 'Counting occurrences can be very compact. Locating positions usually samples suffix-array entries and walks through LF-mapping steps, trading space for locate speed.',
  };
}

function* backwardSearch() {
  yield {
    state: bwtMatrix('Start with pattern ana, scan right to left'),
    highlight: { active: ['r1:F', 'r2:F', 'r3:F'], compare: ['r5:F', 'r6:F'] },
    explanation: 'Backward search starts from the last pattern character. For ana, start with a. All suffixes beginning with a occupy the suffix-array interval [1,4).',
  };

  yield {
    state: labelMatrix(
      'Interval update formula',
      [
        { id: 'step1', label: 'start a' },
        { id: 'step2', label: 'prepend n' },
        { id: 'step3', label: 'prepend a' },
        { id: 'answer', label: 'final interval' },
      ],
      [
        { id: 'range', label: 'SA interval' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['[1,4)', 'suffixes starting a'],
        ['[5,7)', 'suffixes starting na'],
        ['[2,4)', 'suffixes starting ana'],
        ['SA rows 2,3', 'occurs at positions 3 and 1'],
      ],
    ),
    highlight: { active: ['step2:range', 'step3:range'], found: ['answer:meaning'] },
    explanation: 'Each character shrinks the interval using C and Occ. The result is an interval in the suffix array containing exactly the suffixes prefixed by the pattern.',
    invariant: 'After processing suffix P[i..], the interval contains suffixes beginning with P[i..].',
  };

  yield {
    state: indexGraph('C and Occ update the interval; SA samples locate positions'),
    highlight: { active: ['c', 'occ', 'interval'], compare: ['sa'] },
    explanation: 'The formula is left = C[c] + Occ(c, left) and right = C[c] + Occ(c, right). After counting, locating positions uses stored suffix-array samples plus LF steps.',
  };

  yield {
    state: labelMatrix(
      'FM-index neighbors',
      [
        { id: 'suffix', label: 'Suffix Array' },
        { id: 'wavelet', label: 'Wavelet Tree' },
        { id: 'bio', label: 'genome index' },
        { id: 'search', label: 'full-text search' },
      ],
      [
        { id: 'connection', label: 'connection' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['same sorted suffix interval', 'compressed emulation'],
        ['rank over BWT', 'succinct Occ support'],
        ['huge repetitive text', 'count and locate reads'],
        ['compressed corpus', 'index can be smaller than text'],
      ],
    ),
    highlight: { found: ['wavelet:connection', 'bio:lesson'], compare: ['suffix:lesson'] },
    explanation: 'FM-index is the compressed full-text index that ties suffix arrays, BWT, rank/select, and bioinformatics search into one data-structure story.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bwt table') yield* bwtTable();
  else if (view === 'backward search') yield* backwardSearch();
  else throw new InputError('Pick an FM-index view.');
}

export const article = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Full-text search over a huge static string has two jobs. Count how many suffixes start with a pattern. Locate the positions of those suffixes when the caller needs coordinates. A suffix array solves both jobs exactly, but it stores one integer position for every suffix.`,
        `The FM-index exists for the cases where that position array is too expensive: genomes, compressed archives, read aligners, and large static text collections. It keeps the suffix-array search model but stores most of the index through the Burrows-Wheeler transform, rank data, and sparse samples.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The simplest exact method is scanning the text. For each candidate position, compare the pattern against the text. This uses little extra space, but every query can touch the whole string.`,
        `The next method is a suffix array. Sort all suffixes once, then binary-search the sorted suffixes for the pattern. This is clean and exact. It becomes expensive because the index stores n positions for a text of length n, usually 4 or 8 bytes per suffix before auxiliary structures.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is keeping suffix-array behavior without keeping the whole suffix array in memory. Counting only needs the size of the matching suffix-array interval. Locating needs actual text positions.`,
        `A compressed full-text index has to split those jobs. It should count by moving intervals inside compressed data, then pay extra only when positions are requested.`,
      ],
    },
    {
      heading: `The obvious approach and the wall`,
      paragraphs: [
        `The design pressure is the gap between suffix-array clarity and suffix-array space. A suffix array gives exact sorted-suffix intervals, but the raw position array can dominate memory. A scan uses little space, but every query can touch the whole text.`,
        `The FM-index solves that wall by keeping the interval semantics of a suffix array while replacing most of the raw position table with BWT navigation, rank queries, and sparse samples.`,
      ],
    },
    {
      heading: `Core insight`,
      paragraphs: [
        `The Burrows-Wheeler transform stores the character that appears immediately before each suffix in suffix-array order. The sorted first column F and the BWT last column L contain the same characters, just in different orders.`,
        `The FM-index adds two pieces of navigation data. C[c] gives the first suffix-array row whose suffix starts with c. Occ(c, i) gives the number of c characters in L before position i. Together they implement LF-mapping, which moves from a row to the row for the suffix with one more preceding character.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Build the BWT by sorting suffixes of text T plus a unique sentinel, then writing the character before each sorted suffix. Store C and an Occ/rank structure over the BWT. Store some suffix-array samples if locating positions is required.`,
        `To search pattern P, scan P from right to left. Maintain a half-open suffix-array interval [left, right) for the part already processed. When the next character is c, update left = C[c] + Occ(c, left) and right = C[c] + Occ(c, right). If the interval becomes empty, the pattern is absent.`,
        `For banana$ and pattern ana, the search starts with a and gets the interval for suffixes beginning with a. Prepending n moves to suffixes beginning with na. Prepending a moves to suffixes beginning with ana. The final interval contains the suffix-array rows for positions 1 and 3.`,
      ],
    },
    {
      heading: `The interval invariant`,
      paragraphs: [
        `After processing P[i..], the interval contains exactly the suffixes that start with P[i..]. That is the invariant backward search preserves.`,
        `To prepend c, the index selects rows in the current interval whose preceding BWT character is c. Occ counts how many such c characters appear before the interval boundaries. C[c] moves those counts into the block of suffixes that start with c. The new interval therefore contains exactly the suffixes that start with cP[i..].`,
        `Induction over the pattern gives correctness. The base case is the interval for the last character. Each LF step preserves the invariant for one longer suffix of the pattern. When all characters are processed, interval length is the occurrence count.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Counting a pattern of length m takes O(m) rank operations. If rank is constant time for the chosen alphabet representation, the count query is linear in pattern length and independent of text length after the index is built.`,
        `Locating is slower than counting. The index walks LF steps until it reaches a stored suffix-array sample, then reconstructs the position. Denser samples use more memory and make locate faster. Sparse samples make the index smaller and make locate slower.`,
        `Space comes from the compressed BWT, the Occ/rank representation, and suffix-array samples. Wavelet trees, wavelet matrices, and succinct bitvectors are common ways to store Occ for larger alphabets. Construction can be the expensive phase; the FM-index is usually best for static or mostly static text.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `FM-indexes win when exact substring search must fit near compressed-text space. Genome indexes use them to find exact seed intervals before alignment. Compressed search tools use them to count and locate matches without expanding the whole corpus. Archives use the same split: count cheaply, locate only when needed.`,
        `The fit is strongest when the text is large, queries are many, and updates are rare. The index pays a construction cost once, then answers exact pattern counts from compact navigation data.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `The FM-index is awkward for frequent edits because the BWT and rank structures are global. It is also not a magic fast locator: returning millions of positions can dominate query time even when counting is cheap.`,
        `Approximate matching adds branching, backtracking, or separate verification. Very large alphabets need careful Occ structures. Workloads that need fast random text extraction, frequent mutation, or rich scoring may prefer suffix arrays, suffix automata, inverted indexes, or specialized search engines.`,
      ],
    },
    {
      heading: `Animation notes`,
      paragraphs: [
        `The BWT-table view shows the compression trick: suffix-array order is still present, but the stored column is the character before each suffix. The C and Occ tables are the navigation layer that turns that compressed column back into searchable intervals.`,
        `The backward-search view is the algorithm in its most compact form. Each pattern character shrinks a suffix-array interval. Count is just interval length; locate adds suffix-array sampling and LF steps.`,
      ],
    },
    {
      heading: `Implementation guidance`,
      paragraphs: [
        `Choose the Occ representation for the alphabet and workload. DNA can use compact bitvectors and small alphabets. General text often needs wavelet trees or wavelet matrices. Dense suffix-array samples speed locate queries but increase memory.`,
        `Keep construction, count, and locate benchmarks separate. A build pipeline can be slow if the index is static. Count queries should be measured by pattern length and rank cost. Locate queries should report LF steps per occurrence because returning positions can dominate the work.`,
      ],
    },
    {
      heading: `Complete case study`,
      paragraphs: [
        `A read aligner indexes a reference genome and receives millions of short sequencing reads. The first task is not full alignment; it is finding exact seed intervals quickly. The FM-index counts where a seed occurs, then locates candidate positions only for seeds worth extending.`,
        `This split matters. A repetitive seed can have a huge interval, so locating every position may be wasteful. A rare seed has a small interval and can be extended immediately. The index gives the aligner a compact way to decide which seeds are informative before spending dynamic-programming work.`,
      ],
    },
    {
      heading: `Limits and failure modes`,
      paragraphs: [
        `FM-indexes are excellent for static text, but updates are hard because the BWT is a global permutation. If text changes continuously, a dynamic suffix structure, inverted index, or batch rebuild may be simpler.`,
        `The sentinel and alphabet order must be consistent. A bad sentinel choice, Unicode normalization mismatch, or inconsistent case-folding rule can make counts look correct on tests and wrong on production text. Index construction should record normalization and alphabet metadata with the index artifact.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Suffix Array & LCP to understand the uncompressed index the FM-index emulates. Study Rank/Select Bitvector and Wavelet Tree to understand Occ. Study KMP Prefix Function and Aho-Corasick Automaton for contrasting pattern-matching models. Then read Ferragina and Manzini, Opportunistic Data Structures with Applications: https://people.unipmn.it/manzini/papers/focs00draft.pdf.`,
      ],
    },
  ],
};
