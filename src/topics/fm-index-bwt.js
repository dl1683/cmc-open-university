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
      heading: 'What it is',
      paragraphs: [
        'The FM-index is a compressed full-text index based on the Burrows-Wheeler transform. It supports substring counting, and with sampling it can locate occurrence positions, while storing space related to the compressibility of the text.',
        'It can be read as a compressed suffix-array emulator. A normal suffix array stores every suffix position explicitly. The FM-index stores the BWT, a C table, rank/Occ support, and sampled suffix-array positions, then searches by narrowing suffix-array intervals.',
        'This distinction matters in practice: counting a pattern can be done entirely by interval shrinking, while locating exact positions needs enough sampled suffix-array information to walk back to coordinates. Count is the elegant core; locate is the engineered tradeoff.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The BWT is formed by sorting suffixes or rotations and taking the character that precedes each sorted suffix. This last column clusters similar contexts. The C table says where each character begins in the first column. Occ(c, i) counts how many c characters appear in the BWT prefix before i.',
        'Backward search scans the pattern right to left. After processing a suffix of the pattern, the algorithm maintains the suffix-array interval containing all suffixes with that prefix. Prepending character c updates the interval with C[c] and Occ(c, left/right).',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Counting a pattern of length m takes O(m) rank operations. Locating all positions adds time depending on suffix-array sampling distance and the number of matches. Space depends on the compressed BWT, rank data structure, and samples.',
        'The important engineering choice is the rank representation. Wavelet trees, bitvectors, and wavelet matrices decide the space/time tradeoff for Occ queries, especially on large alphabets.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'FM-indexes are central in bioinformatics, compressed text search, read alignment, genome indexing, archival search, and large text collections where storing a full suffix array is expensive. They are the data-structure answer to searching without fully decompressing or storing a large index beside the text.',
        'A complete case study is DNA read alignment. A reference genome is transformed and indexed. A short read is searched backward to find suffix-array intervals for exact seeds. Candidate positions are then verified or extended by downstream alignment logic.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The FM-index is not just compression and not just a suffix array. It is the interaction of BWT order, rank queries, and sampled locating. Counting can be fast and compact while locating positions may still need extra sampled data and LF-mapping walks.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Ferragina and Manzini, Opportunistic Data Structures with Applications, at https://people.unipmn.it/manzini/papers/focs00draft.pdf. Study Suffix Array & LCP, Wavelet Tree, KMP Prefix Function, Aho-Corasick Automaton, and Product Quantization next.',
      ],
    },
  ],
};
