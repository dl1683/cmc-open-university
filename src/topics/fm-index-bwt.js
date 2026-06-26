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
  const indexNodes = ['text', 'sa', 'bwt', 'c', 'occ', 'interval'];
  const indexEdges = ['e-text-sa', 'e-sa-bwt', 'e-bwt-c', 'e-bwt-occ', 'e-c-int', 'e-occ-int'];
  const text = 'banana$';
  const bwtStr = 'annb$aa';
  yield {
    state: indexGraph('FM-index stores enough to emulate suffix-array search'),
    highlight: { active: ['sa', 'bwt'], found: ['c', 'occ'], compare: ['text'] },
    explanation: `The FM-index for "${text}" uses ${indexNodes.length} components connected by ${indexEdges.length} edges. It starts from a suffix array but stores a compressed representation — the BWT "${bwtStr}" — that groups similar contexts and still lets search move through suffix-array intervals.`,
  };

  const numRotations = text.length;
  yield {
    state: bwtMatrix(`BWT of ${text} is ${bwtStr}`),
    highlight: { active: ['r2:L', 'r3:L', 'r4:L'], found: ['r2:suffix', 'r3:suffix'] },
    explanation: `Sort all ${numRotations} suffixes. The BWT last column stores the character immediately before each suffix in sorted order. For ${text}, the last column is ${bwtStr}.`,
    invariant: `All ${numRotations} rows in the first column and last column represent the same cyclic rotations in different orders.`,
  };

  const alphabet = [
    { id: 'dollar', label: '$', cVal: 0 },
    { id: 'a', label: 'a', cVal: 1 },
    { id: 'b', label: 'b', cVal: 4 },
    { id: 'n', label: 'n', cVal: 5 },
  ];
  yield {
    state: labelMatrix(
      'Search support tables',
      alphabet.map(({ id, label }) => ({ id, label })),
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
    explanation: `The C table has ${alphabet.length} entries for the alphabet {${alphabet.map(a => a.label).join(', ')}}. C[c] tells where suffixes beginning with character c start in the sorted suffix array; Occ(c, i) tells how many c characters occur in the ${bwtStr.length}-character BWT before position i.`,
  };

  const compressionParts = [
    { id: 'bwt', label: 'BWT' },
    { id: 'rank', label: 'rank/Occ' },
    { id: 'samples', label: 'SA samples' },
    { id: 'locate', label: 'locate positions' },
  ];
  yield {
    state: labelMatrix(
      'Why compression and indexing meet',
      compressionParts,
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
    explanation: `${compressionParts.length} components make the FM-index work: ${compressionParts.map(p => p.label).join(', ')}. Counting occurrences can be very compact; locating positions samples suffix-array entries and walks LF-mapping steps, trading space for locate speed.`,
  };
}

function* backwardSearch() {
  const pattern = 'ana';
  const patternChars = pattern.split('');
  yield {
    state: bwtMatrix(`Start with pattern ${pattern}, scan right to left`),
    highlight: { active: ['r1:F', 'r2:F', 'r3:F'], compare: ['r5:F', 'r6:F'] },
    explanation: `Backward search starts from the last character of the ${pattern.length}-character pattern "${pattern}". Start with '${patternChars[patternChars.length - 1]}' — all suffixes beginning with it occupy the suffix-array interval [1,4).`,
  };

  const searchSteps = [
    { id: 'step1', label: `start ${patternChars[2]}` },
    { id: 'step2', label: `prepend ${patternChars[1]}` },
    { id: 'step3', label: `prepend ${patternChars[0]}` },
    { id: 'answer', label: 'final interval' },
  ];
  const occurrences = 2;
  yield {
    state: labelMatrix(
      'Interval update formula',
      searchSteps,
      [
        { id: 'range', label: 'SA interval' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['[1,4)', 'suffixes starting a'],
        ['[5,7)', 'suffixes starting na'],
        ['[2,4)', 'suffixes starting ana'],
        ['SA rows 2,3', `occurs at positions 3 and 1`],
      ],
    ),
    highlight: { active: ['step2:range', 'step3:range'], found: ['answer:meaning'] },
    explanation: `Each of ${patternChars.length} characters shrinks the interval using C and Occ. The result for "${pattern}" is an interval containing exactly ${occurrences} suffixes prefixed by the pattern.`,
    invariant: `After processing ${patternChars.length} characters of P, the interval contains suffixes beginning with P[i..].`,
  };

  yield {
    state: indexGraph('C and Occ update the interval; SA samples locate positions'),
    highlight: { active: ['c', 'occ', 'interval'], compare: ['sa'] },
    explanation: `The formula is left = C[c] + Occ(c, left) and right = C[c] + Occ(c, right). After counting ${occurrences} occurrences of "${pattern}", locating positions uses stored suffix-array samples plus LF steps.`,
  };

  const neighbors = [
    { id: 'suffix', label: 'Suffix Array' },
    { id: 'wavelet', label: 'Wavelet Tree' },
    { id: 'bio', label: 'genome index' },
    { id: 'search', label: 'full-text search' },
  ];
  yield {
    state: labelMatrix(
      'FM-index neighbors',
      neighbors,
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
    explanation: `FM-index connects to ${neighbors.length} neighboring structures (${neighbors.map(n => n.label).join(', ')}) — tying suffix arrays, BWT, rank/select, and bioinformatics search into one data-structure story.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The BWT-table view shows every cyclic rotation of the text sorted lexicographically. The first column (F) is the sorted characters; the last column (L) is the Burrows-Wheeler transform -- a reversible permutation of the original text. Active cells highlight the BWT characters participating in the current search step. Found cells mark suffix-array rows inside the current match interval.',
        'The backward-search view walks through a pattern from right to left, one character per step. Each step narrows a suffix-array interval using two precomputed structures: the C table (where each character\'s block begins) and the Occ function (how many times a character appears in a prefix of the BWT). When the interval is non-empty at the end, its width equals the occurrence count.',
        {type: 'callout', text: 'The FM-index keeps suffix-array search but replaces random suffix access with BWT rank steps, so counting can happen inside compressed text.'},
        {
          type: 'diagram',
          text: [
            'Text: banana$',
            '',
            'Sorted rotations        F   L',
            '  $banana               $   a',
            '  a$banan               a   n',
            '  ana$ban               a   n',
            '  anana$b               a   b',
            '  banana$               b   $',
            '  na$bana               n   a',
            '  nana$ba               n   a',
            '',
            'BWT (last column): a n n b $ a a',
            'C table: $ -> 0, a -> 1, b -> 4, n -> 5',
          ].join('\n'),
          label: 'BWT construction for banana$: sort all rotations, read off the last column',
        },
        'The graph view shows data-flow between components. Text produces a suffix array; the suffix array produces the BWT; the BWT feeds the C table and the Occ/rank structure; C and Occ together update the suffix-array interval during each backward-search step.',
        {type: 'image', src: './assets/gifs/fm-index-bwt.gif', alt: 'Animated walkthrough of the fm index bwt visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'We [...] introduce a data structure which occupies space close to the one of the compressed text, and allows for efficient pattern search in time that is close to the optimal one.',
          attribution: 'Paolo Ferragina and Giovanni Manzini, Opportunistic Data Structures with Applications (FOCS 2000)',
        },
        'Full-text search over a large static string needs two operations: count how many times a pattern occurs, and locate the text positions of those occurrences. A suffix array solves both, but it stores one integer per character -- 4n or 8n bytes for a text of length n. For a 3-billion-character human genome, that is 12 to 24 GB of index before any auxiliary tables.',
        'The FM-index exists to keep the suffix-array search model while shrinking the index to near the size of the compressed text. Ferragina and Manzini showed in 2000 that the Burrows-Wheeler transform, combined with rank queries and a small amount of sampled suffix-array data, is enough to emulate backward search over the full suffix array. The name "FM" comes from their initials.',
        'This mattered immediately in bioinformatics. Tools like BWA and Bowtie index entire genomes and align billions of short reads against them, relying on the FM-index to keep memory within reach of a single machine.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest exact-match method is scanning: slide a window across the text and compare the pattern at every position. This uses O(1) extra space, but every query costs O(nm) in the worst case, where n is text length and m is pattern length. For millions of queries against a genome, scanning is hopeless.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/b/be/Trie_example.svg', alt: 'Trie with words sharing prefixes', caption: 'A trie shows the uncompressed prefix-search idea: explicit edges make lookup easy but spend pointer-heavy space. The FM-index keeps the search power without storing a full trie or suffix tree. Source: Wikimedia Commons, Booyabazooka, public domain.'},
        'The next step is a suffix array: sort all n suffixes, then binary-search for the pattern in O(m log n) time, or O(m) with an LCP array. The problem is space. The suffix array alone is n integers (4n or 8n bytes), and the LCP array adds another n integers. For large texts, the index dwarfs the data it indexes.',
        'A suffix tree solves the same search in O(m) time but uses even more memory -- typically 10n to 20n bytes due to node pointers, edge labels, and suffix links. Both structures pay a steep space tax for speed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between suffix-array search quality and suffix-array memory cost. A suffix array gives you exact sorted-suffix intervals, but the raw position table can use 4 to 8 times the text size. You cannot just throw it away -- binary search needs random access to suffix-array entries to compare suffixes against the pattern.',
        'A compressed full-text index must split the two jobs. Counting only needs interval boundaries; it never touches actual text positions. Locating needs positions, but only for rows inside the final interval, and the caller may not need all of them.',
        'So the question becomes: can you navigate suffix-array intervals without storing the suffix array? The BWT groups characters by their right context, making it compressible, and its LF-mapping property lets you step through the suffix array one character at a time. But turning that observation into a practical index requires the right combination of auxiliary structures.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The Burrows-Wheeler transform already encodes enough structure to simulate suffix-array search without storing the suffix array itself. The key is the LF-mapping property: the k-th occurrence of character c in the last column of the sorted rotation matrix corresponds to the k-th occurrence of c in the first column. This is true because both columns are permutations of the same multiset and the sort is stable within each character class.',
        'This property means that if you know where a suffix sits in the sorted order, you can find where the suffix one character longer sits -- without ever looking up the actual text position. A rank query (how many times does c appear in BWT[0..i)?) plus a simple offset (where do suffixes starting with c begin?) gives you the new row. That is the entire navigation primitive.',
        'Ferragina and Manzini\'s contribution was recognizing that this primitive is enough to run binary-search-style interval narrowing backward through the pattern, and that the BWT itself compresses to the k-th order empirical entropy of the text. Compression and indexing become the same structure. The more compressible the text, the smaller the index -- a property suffix arrays and suffix trees do not have.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Construction starts by appending a sentinel character $ (lexicographically smallest) to the text. Sort all cyclic rotations of the augmented text. The last column of this sorted matrix is the BWT. Equivalently, for each suffix in the suffix array, the BWT stores the character immediately before that suffix in the original text (wrapping around for position 0).',
        'From the BWT, build two navigation structures. The C table: for each character c in the alphabet, C[c] is the number of characters in the text that are lexicographically smaller than c. This tells you where the block of suffixes starting with c begins in the suffix array. The Occ function (also called rank): Occ(c, i) counts how many times character c appears in BWT[0..i). This can be implemented with wavelet trees, bitvector rank structures, or simple sampled cumulative counts.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Wavelet_tree.png', alt: 'Wavelet tree for the string abracadabra with bitvectors at internal nodes', caption: 'Wavelet trees are a common way to answer rank queries over the BWT for larger alphabets. Source: Wikimedia Commons, Wavelet tree example.'},
        {
          type: 'diagram',
          text: [
            'Backward search for pattern "ana" in text "banana$"',
            '',
            'Step 1: last char = a',
            '  left  = C[a]            = 1',
            '  right = C[a] + count(a) = 4',
            '  Interval [1,4) -- all suffixes starting with "a"',
            '',
            'Step 2: prepend n',
            '  left  = C[n] + Occ(n, 1) = 5 + 0 = 5',
            '  right = C[n] + Occ(n, 4) = 5 + 2 = 7',
            '  Interval [5,7) -- all suffixes starting with "na"',
            '',
            'Step 3: prepend a',
            '  left  = C[a] + Occ(a, 5) = 1 + 1 = 2',
            '  right = C[a] + Occ(a, 7) = 1 + 3 = 4',
            '  Interval [2,4) -- all suffixes starting with "ana"',
            '',
            'Count = 4 - 2 = 2 occurrences',
          ].join('\n'),
          label: 'Backward search narrows a suffix-array interval by one character per step',
        },
        'To locate positions after counting, the index stores a sparse sample of suffix-array values -- say, every 32nd entry. For a row that is not sampled, walk LF-mapping steps (each step moves to the row whose suffix is one character longer on the left) until you land on a sampled row, then add the number of steps taken. Denser samples trade memory for faster locate.',
        {
          type: 'code',
          language: 'javascript',
          text: [
            '// LF-mapping: given a row i in the BWT matrix,',
            '// find the row for the suffix one character longer.',
            'function lfMapping(bwt, C, Occ, i) {',
            '  const c = bwt[i];',
            '  return C[c] + Occ(c, i);',
            '}',
            '',
            '// Backward search: count occurrences of pattern in text.',
            'function fmCount(pattern, C, Occ, n) {',
            '  let left = 0;',
            '  let right = n;  // full SA interval',
            '  for (let i = pattern.length - 1; i >= 0; i--) {',
            '    const c = pattern[i];',
            '    left  = C[c] + Occ(c, left);',
            '    right = C[c] + Occ(c, right);',
            '    if (left >= right) return 0;  // pattern absent',
            '  }',
            '  return right - left;',
            '}',
          ].join('\n'),
          label: 'LF-mapping and backward search',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness invariant: after processing pattern characters P[i..m-1] (scanning right to left), the interval [left, right) contains exactly the suffix-array rows whose suffixes begin with P[i..m-1].',
        'Base case: before any character is processed, the interval is [0, n) -- all suffixes. After processing the last character P[m-1] = c, the interval becomes [C[c], C[c] + count(c)) -- exactly the suffixes starting with c.',
        'Inductive step: suppose [left, right) covers all suffixes starting with P[i+1..m-1]. To extend by one character c = P[i], we need only the rows in that interval whose BWT entry is c, because those correspond to suffixes starting with cP[i+1..m-1]. The LF-mapping property guarantees the k-th c in the last column maps to the k-th c in the first column. Occ(c, left) counts c-rows before the interval; Occ(c, right) counts c-rows before or within it. Offsetting by C[c] maps these counts into the first column. The new interval [C[c] + Occ(c, left), C[c] + Occ(c, right)) contains exactly the suffixes starting with P[i..m-1].',
        {
          type: 'note',
          text: 'The LF-mapping property holds because sorting is stable on equal characters. The i-th "a" in the last column and the i-th "a" in the first column are the same row, because both columns are permutations of the same multiset and the cyclic structure preserves relative order within each character class.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'FM-index: counting takes O(m) time using m rank queries, one per pattern character. Locating k results costs O(m + k * s) where s is the suffix-array sampling rate. Space is nH_k + o(n) bits for the compressed BWT plus O(n/s) integers for sampled suffix-array entries. Updates require a full rebuild.',
        'Suffix array: counting takes O(m + log n) via binary search, or O(m) with an LCP array. Locating is O(k) since positions are stored directly. Space is O(n) integers -- 4n to 8n bytes with no compression. Updates require a full rebuild.',
        'Suffix tree: counting takes O(m) by walking edges. Locating is O(k) after search. Space is O(n) but with a large constant -- typically 10n to 20n bytes due to pointers and edge labels. Incremental updates are possible but complex.',
        'Inverted index: both counting and locating cost O(posting list length) for a term. Space is O(total terms). Supports incremental appends, but only works for word-level or token-level search, not arbitrary substring search.',
        'The FM-index wins on space when the text is compressible. It trades locate speed (the s-factor walk) and update flexibility (full rebuild) for radical memory savings. For a 3 GB genome with s = 32, the index fits in 2 to 4 GB -- comparable to the compressed text itself.',
        {
          type: 'note',
          text: 'Construction cost is dominated by building the suffix array: O(n) with SA-IS or DC3, or O(n log n) with simpler algorithms. For static text, this is a one-time cost. The BWT and rank structures are derived from the suffix array in O(n) additional time.',
        },
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Bioinformatics is the FM-index home field. BWA (Li and Durbin, 2009) and Bowtie (Langmead et al., 2009) both use FM-indexes to align short DNA reads to reference genomes. The alphabet is small (A, C, G, T, N), rank structures are compact, and the text is static -- a reference genome rarely changes. A single workstation can hold the human genome index in memory and process billions of reads.',
        'Compressed text retrieval is the second major application. When a corpus is too large to decompress fully but you need exact substring search, the FM-index counts and locates matches directly in compressed space. The Pizza&Chili corpus and the SDSL library provide production-quality implementations and benchmarks.',
        'The general pattern: any workload where the text is large and mostly static, queries are exact substring matches (or seeds for approximate matching), and memory pressure is the binding constraint. The FM-index trades locate speed and update flexibility for space savings that can be an order of magnitude.',
        {
          type: 'bullets',
          items: [
            'Genome alignment: BWA, Bowtie, SOAP2 -- seed-and-extend over FM-index seeds.',
            'Compressed self-indexes: search directly inside compressed archives.',
            'Repetitive text collections: version-controlled documents, pan-genomes, log archives.',
            'Read-only full-text search on embedded or memory-constrained devices.',
          ],
        },
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The BWT is a global permutation of the text. Inserting, deleting, or modifying even a single character invalidates the entire transform and all rank structures. If the text changes frequently, an inverted index, a dynamic suffix structure, or periodic batch rebuilds will serve better.',
        'Locating can be expensive. Counting is O(m), but if a pattern occurs k = 1,000,000 times, returning all positions costs O(k * s) LF-mapping steps. Workloads that need all positions of common patterns may find a plain suffix array faster, since it stores positions directly.',
        'Approximate matching is not built in. FM-indexes handle exact seeds, but extending to mismatches or gaps requires backtracking with exponential branching in the worst case. Tools like BWA-MEM use the FM-index for exact seeds and Smith-Waterman for extension -- the FM-index does not replace the aligner, only the seed-finding stage.',
        {
          type: 'bullets',
          items: [
            'No incremental updates: the BWT and rank structures must be rebuilt from scratch.',
            'Large alphabets (Unicode text) need heavy Occ structures -- wavelet trees add O(log sigma) per rank query.',
            'Random text extraction requires decompression via LF-mapping steps, not random access.',
            'The sentinel character and alphabet ordering must be consistent; mismatches silently corrupt results.',
          ],
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Text: "banana$" (n = 7). Build the suffix array by sorting all suffixes: $, a$, ana$, anana$, banana$, na$, nana$. Their starting positions are SA = [6, 5, 3, 1, 0, 4, 2]. The BWT is the character before each suffix: BWT = "annb$aa" (position 0 wraps to the sentinel at the end).',
        'Build the C table by counting characters lexicographically smaller: C[$] = 0 (nothing is smaller), C[a] = 1 (one $ is smaller), C[b] = 4 (one $ plus three a\'s), C[n] = 5 (one $ plus three a\'s plus one b). Build the Occ function from the BWT "annb$aa": for example, Occ(a, 3) = 1 because only BWT[0] = \'a\' appears before position 3 among the a\'s.',
        'Search for "an". Start with the last character \'n\'. Set left = C[n] = 5, right = C[n] + (total n\'s) = 5 + 2 = 7. The interval [5, 7) covers rows 5 and 6, which are the suffixes "na$" and "nana$". Prepend \'a\': left = C[a] + Occ(a, 5) = 1 + 1 = 2, right = C[a] + Occ(a, 7) = 1 + 3 = 4. The interval [2, 4) covers rows 2 and 3, which are "ana$" (position 3) and "anana$" (position 1). Count = 4 - 2 = 2 occurrences.',
        'Now locate those positions. Suppose the sampling rate is s = 2, so we store SA values at even rows: SA[0] = 6, SA[2] = 3, SA[4] = 0, SA[6] = 2. Row 2 is sampled: SA[2] = 3, so one occurrence is at text position 3. Row 3 is not sampled, so walk LF-mapping: BWT[3] = \'b\', LF(3) = C[b] + Occ(b, 3) = 4 + 0 = 4. Row 4 is sampled: SA[4] = 0. We took 1 step, so the original position is 0 + 1 = 1. The pattern "an" occurs at positions 1 and 3, which is correct: b-an-an-a$.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Paolo Ferragina and Giovanni Manzini, "Opportunistic Data Structures with Applications," FOCS 2000. The original FM-index paper.',
            'Heng Li and Richard Durbin, "Fast and Accurate Short Read Alignment with Burrows-Wheeler Transform," Bioinformatics 25(14), 2009. Introduces BWA.',
            'Ben Langmead et al., "Ultrafast and Memory-Efficient Alignment of Short DNA Sequences to the Human Genome," Genome Biology 10, 2009. Introduces Bowtie.',
            'Michael Burrows and David Wheeler, "A Block-Sorting Lossless Data Compression Algorithm," DEC SRC Research Report 124, 1994. The original BWT paper.',
            'Simon Gog et al., "From Theory to Practice: Plug and Play with Succinct Data Structures," SEA 2014. The SDSL library for production FM-index implementations.',
          ],
        },
        {
          type: 'note',
          text: 'The FM-index paper introduced the term "opportunistic" because the index exploits the compressibility of the input: the more compressible the text, the smaller the index. This is not true of suffix arrays or suffix trees, whose size depends only on text length.',
        },
        'Study the Suffix Array to understand the uncompressed index the FM-index emulates. Study Rank/Select Bitvectors and the Wavelet Tree to understand how Occ queries work in O(1) or O(log sigma) time. Study the KMP algorithm and Aho-Corasick automaton for contrasting pattern-matching models that work online rather than via indexing. For approximate matching over FM-indexes, read about backtracking search in BWA and the D-array pruning heuristic.',
      ],
    },
  ],
};
