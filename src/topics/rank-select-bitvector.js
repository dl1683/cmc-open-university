// Rank/select bitvector: store sparse summaries over a bitstring so compressed
// indexes can count and locate bits without scanning.

import { matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'rank-select-bitvector',
  title: 'Rank/Select Bitvector',
  category: 'Data Structures',
  summary: 'The primitive behind succinct indexes: rank counts 1-bits up to a position, select locates the position of the k-th 1-bit.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['rank directory', 'select directory'], defaultValue: 'rank directory' },
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

function* rankDirectory() {
  const bitPositions = 16;
  const bits = ['1', '0', '1', '1', '0', '0', '1', '0', '1', '1', '1', '0', '0', '1', '0', '1'];
  const prefixCounts = ['1', '1', '2', '3', '3', '3', '4', '4', '5', '6', '7', '7', '7', '8', '8', '9'];
  const superblockEntries = ['0', '', '', '', '', '', '', '', '4', '', '', '', '', '', '', ''];
  const totalOnes = Number(prefixCounts[prefixCounts.length - 1]);
  const rows = [
    { id: 'bits', label: 'bits' },
    { id: 'rank', label: 'prefix 1s' },
    { id: 'block', label: 'superblock' },
  ];
  const columns = Array.from({ length: bitPositions }, (_, i) => ({ id: `p${i}`, label: String(i) }));
  yield {
    state: labelMatrix(
      'Bitvector B',
      rows,
      columns,
      [bits, prefixCounts, superblockEntries],
    ),
    highlight: { active: ['bits:p0', 'bits:p2', 'bits:p3', 'bits:p6'], found: ['block:p0', 'block:p8'] },
    explanation: `rank(i) asks how many 1 bits appear up to position i across ${bitPositions} bit positions. This ${rows.length}-row view stores sparse prefix counts so queries do not scan all ${totalOnes} ones from the beginning.`,
  };

  const queryPos = 10;
  const superblockVal = 4;
  const miniVal = 0;
  const popcountVal = 3;
  const rankAnswer = superblockVal + miniVal + popcountVal;
  const rankPieces = [
    { id: 'super', label: 'superblock count' },
    { id: 'mini', label: 'inside-block count' },
    { id: 'pop', label: 'popcount tail' },
    { id: 'answer', label: 'answer' },
  ];
  yield {
    state: labelMatrix(
      `Answer rank(${queryPos})`,
      rankPieces,
      [
        { id: 'value', label: 'value' },
        { id: 'work', label: 'work' },
      ],
      [
        [String(superblockVal), 'ones before position 8'],
        [String(miniVal), 'start of mini block'],
        [String(popcountVal), `popcount bits 8..${queryPos}`],
        [String(rankAnswer), `${superblockVal} + ${miniVal} + ${popcountVal}`],
      ],
    ),
    highlight: { active: ['super:value', 'pop:value'], found: ['answer:value'] },
    explanation: `A practical rank directory decomposes rank(${queryPos}) into ${rankPieces.length} additive pieces: coarse counters, local counters, and a machine popcount, yielding ${rankAnswer} in constant time.`,
    invariant: `Rank is prefix sum over ${bitPositions} bits, accelerated by sampled prefix sums plus popcount to answer rank(${queryPos}) = ${rankAnswer}.`,
  };

  const spaceApproaches = [
    { id: 'plain', label: 'plain prefix array' },
    { id: 'sampled', label: 'sampled rank directory' },
    { id: 'compressed', label: 'compressed variant' },
    { id: 'raw', label: 'raw bits' },
  ];
  yield {
    state: labelMatrix(
      'Why this is succinct',
      spaceApproaches,
      [
        { id: 'space', label: 'space' },
        { id: 'query', label: 'query' },
      ],
      [
        ['n integers', 'O(1)'],
        ['small overhead', 'O(1) with popcount'],
        ['near entropy', 'slightly more work'],
        ['n bits', 'O(n) scan alone'],
      ],
    ),
    highlight: { active: ['sampled:space', 'sampled:query'], compare: ['plain:space', 'raw:query'] },
    explanation: `The point is not that rank is hard. Across ${spaceApproaches.length} approaches, the goal is answering rank over ${bitPositions} positions while adding only o(n) bits beyond the original bitvector.`,
  };

  const useCases = [
    { id: 'wavelet', label: 'wavelet tree' },
    { id: 'fm', label: 'FM-index' },
    { id: 'bitmap', label: 'compressed bitmap' },
    { id: 'tree', label: 'succinct tree' },
  ];
  yield {
    state: labelMatrix(
      'Where rank appears',
      useCases,
      [
        { id: 'rankrole', label: 'rank role' },
        { id: 'selectrole', label: 'select role' },
      ],
      [
        ['route to child subsequence', 'recover positions'],
        ['LF-mapping counts symbols', 'locate samples'],
        ['count set bits in range', 'iterate set bits'],
        ['navigate parentheses', 'find matching structure'],
      ],
    ),
    highlight: { found: ['wavelet:rankrole', 'fm:rankrole'], active: ['bitmap:selectrole'] },
    explanation: `Rank/select is the hidden primitive inside ${useCases.length} compressed structures shown here. Once rank answers in O(1) over ${bitPositions} positions, indexes store topology as bits instead of pointers.`,
  };
}

function* selectDirectory() {
  const selectK = 6;
  const selectAnswer = 9;
  const selectSteps = [
    { id: 'goal', label: 'goal' },
    { id: 'coarse', label: 'coarse jump' },
    { id: 'scan', label: 'word scan' },
    { id: 'answer', label: 'answer' },
  ];
  yield {
    state: labelMatrix(
      `select(k) locates the k-th 1`,
      selectSteps,
      [
        { id: 'example', label: `select(${selectK})` },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        [`${selectK}th one`, `find position with rank = ${selectK}`],
        ['jump near rank bucket', 'avoid scanning all bits'],
        ['popcount words', 'locate exact bit'],
        [`position ${selectAnswer}`, `B[${selectAnswer}] is the ${selectK}th one`],
      ],
    ),
    highlight: { active: ['goal:example', 'coarse:example', 'scan:example'], found: ['answer:example'] },
    explanation: `select(${selectK}) is the inverse direction: find position ${selectAnswer} where the ${selectK}th 1 occurs. The ${selectSteps.length} steps -- goal, coarse jump, word scan, answer -- keep the final search local.`,
  };

  const densityVariants = [
    { id: 'dense', label: 'dense ones' },
    { id: 'sparse', label: 'sparse ones' },
    { id: 'clustered', label: 'clustered ones' },
    { id: 'random', label: 'random bits' },
  ];
  yield {
    state: labelMatrix(
      'Dense versus sparse bitvectors',
      densityVariants,
      [
        { id: 'rank', label: 'rank design' },
        { id: 'select', label: 'select design' },
      ],
      [
        ['superblocks + popcount', 'sample positions'],
        ['compressed positions', 'gap-coded select'],
        ['hybrid blocks', 'skip to cluster'],
        ['plain directory', 'plain directory'],
      ],
    ),
    highlight: { found: ['sparse:select', 'clustered:rank'], compare: ['random:rank'] },
    explanation: `Compressed rank/select dictionaries adapt across ${densityVariants.length} density profiles. Sparse sets store positions or gaps; dense sets keep raw bits plus small rank samples.`,
  };

  const queryContracts = [
    { id: 'rank1', label: 'rank1(i)' },
    { id: 'rank0', label: 'rank0(i)' },
    { id: 'select1', label: 'select1(k)' },
    { id: 'select0', label: 'select0(k)' },
  ];
  yield {
    state: labelMatrix(
      'Query contracts',
      queryContracts,
      [
        { id: 'answer', label: 'answer' },
        { id: 'formula', label: 'relationship' },
      ],
      [
        ['ones <= i', 'rank0(i) = i+1-rank1(i)'],
        ['zeros <= i', 'derived from rank1'],
        ['position of k-th one', 'inverse of rank1 milestones'],
        ['position of k-th zero', 'inverse of rank0 milestones'],
      ],
    ),
    highlight: { active: ['rank1:answer', 'select1:answer'], found: ['rank0:formula'] },
    explanation: `All ${queryContracts.length} query variants -- ${queryContracts.map(q => q.id).join(', ')} -- are exposed by most libraries. If rank1 is fast, rank0 is derived as i+1-rank1(i); select needs its own samples.`,
  };

  const tradeoffDimensions = [
    { id: 'space', label: 'extra space' },
    { id: 'latency', label: 'latency' },
    { id: 'build', label: 'build time' },
    { id: 'updates', label: 'updates' },
  ];
  yield {
    state: labelMatrix(
      'Engineering tradeoffs',
      tradeoffDimensions,
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'response', label: 'response' },
      ],
      [
        ['as close to n bits as possible', 'sample less or compress'],
        ['few cache misses', 'align blocks and use popcount'],
        ['large static index', 'linear construction'],
        ['dynamic edits', 'use different structure'],
      ],
    ),
    highlight: { active: ['space:response', 'latency:response'], compare: ['updates:response'] },
    explanation: `Rank/select bitvectors balance ${tradeoffDimensions.length} pressures: ${tradeoffDimensions.map(d => d.label).join(', ')}. They are built once so compressed indexes can query them millions of times.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'rank directory') yield* rankDirectory();
  else if (view === 'select directory') yield* selectDirectory();
  else throw new InputError('Pick a rank/select bitvector view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as navigation over a bitvector, which is an array of 0 and 1 values stored compactly. rank counts how many target bits appear up to a position, and select finds the position of the k-th target bit.',
        {type: 'callout', text: 'Rank and select make bitstrings navigable: rank counts how far you have gone, and select jumps to the position where a count first becomes true.'},
        {type: 'image', src: './assets/gifs/rank-select-bitvector.gif', alt: 'Animated walkthrough of the rank select bitvector visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is additive for rank: stored superblock count plus stored block count plus a small popcount tail equals the prefix count. Select runs the direction backward by using stored counts to jump near the desired occurrence.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Succinct data structures store trees, strings, and sets close to their information-theoretic size. That saves memory, but raw bits are hard to navigate without extra indexing.',
        'Rank and select exist because compressed structures still need pointer-like movement. A wavelet tree, FM-index, or LOUDS tree can be tiny only if it can answer prefix counts and occurrence positions quickly.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to scan the bitvector. rank1(i) counts ones from position 0 through i, and select1(k) scans until it has seen k ones.',
        'That uses almost no extra space and is correct for small inputs. It fails when the bitvector is large or when each higher-level query performs many rank and select calls.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is repeated linear work. If a text index performs 20 rank calls per search step on a 1-billion-bit vector, scanning from the beginning is not a query algorithm.',
        'A full prefix-count array fixes time but loses succinctness. Storing one 32-bit count beside every bit turns a 1-billion-bit vector into roughly 33 billion bits before the original data structure does any real work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to store sparse checkpoints and finish locally with fast machine operations. Superblocks store global counts, smaller blocks store local counts, and popcount counts ones in the remaining word-level tail.',
        'Select uses the same philosophy in reverse. It stores enough landmarks to jump near the k-th one, then scans a small local region instead of the whole bitvector.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Binary_Search_Depiction.svg/250px-Binary_Search_Depiction.svg.png', alt: 'Binary search narrowing a sorted array to a target value', caption: 'Select can fall back to binary search over rank milestones when a faster select directory is not stored. Source: Wikimedia Commons, Binary Search Depiction.svg.'},
        'For rank1(i), compute the superblock containing i, add the superblock total, add the local block total inside that superblock, and popcount the remaining bits up to i. Each term answers a different scale of the same prefix-count question.',
        'For select1(k), find a sampled count range that contains the k-th one, then search inside that range with block counts and word popcounts. Dense vectors can sample regularly, while sparse vectors often store positions for some occurrences directly.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness follows from prefix-count conservation. The number of ones up to i equals the number before the superblock, plus the number before the local block, plus the number in the tail; these ranges are disjoint and cover the prefix.',
        'Select is correct because rank is monotone. As positions move right, rank never decreases, so the k-th one is the first position whose rank reaches k.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'With a two-level directory, rank can run in O(1) time using a few table lookups and popcount. The extra space is sublinear when superblock and block sizes grow with n in the standard succinct construction.',
        'Cost behaves as a memory-locality trade. Smaller blocks reduce tail work but store more counters, while larger blocks save counters but make each query inspect more bits.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Succinct structures often replace pointer graphs with bitstrings, then recover navigation through rank and select. Source: Wikimedia Commons, David W., public domain.'},
        'Rank and select power FM-indexes for compressed text search, wavelet trees for sequence queries, LOUDS encodings for trees, and bitmap indexes for analytics. They replace pointer-heavy navigation with arithmetic over compact bits.',
        'They are useful when memory bandwidth is the bottleneck. A smaller representation can beat a pointer structure even when each query does more arithmetic.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Rank-select indexes are awkward for frequent updates. Inserting one bit can change every later rank, so dynamic variants need heavier trees, rebuilding, or buffered updates.',
        'They also fail when the bitvector is too small or query volume is low. The directory may cost more code and memory than a direct scan over a few machine words.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let B = 1 0 1 1 0 0 1 0 1 1 0 0 0 1 0 1, using zero-based positions. For rank1(10), there are 6 ones in positions 0 through 10: at 0, 2, 3, 6, 8, and 9.',
        'With an 8-bit superblock size, the count before position 8 is 4. The tail from positions 8 through 10 is 1 1 0, whose popcount is 2, so rank1(10)=4+2=6; select1(6) returns position 9.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read Jacobson, Space-efficient Static Trees and Graphs, and Raman, Raman, and Rao on succinct indexable dictionaries. Then read practical library documentation such as SDSL for implementation choices.',
        'Study bit operations, popcount, prefix sums, wavelet trees, FM-indexes, LOUDS, compressed bitmaps, and cache behavior next. These topics explain why a few counters can replace many pointers.',
      ],
    },
  ],
};
