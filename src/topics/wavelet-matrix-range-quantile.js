// A wavelet matrix stores a sequence by stable bit-level partitions, avoiding
// explicit wavelet-tree pointers while preserving rank/select/range queries.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'wavelet-matrix-range-quantile',
  title: 'Wavelet Matrix Range Quantile',
  category: 'Data Structures',
  summary: 'Represent integer sequences with bit-level stable partitions and zero counts so range quantile, rank, and predecessor queries walk compact arrays.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bit levels', 'range quantile'], defaultValue: 'bit levels' },
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

function matrixGraph(title) {
  return graphState({
    nodes: [
      { id: 'input', label: 'input', x: 1.0, y: 3.5, note: 'sequence' },
      { id: 'b2', label: 'bit 2', x: 3.1, y: 5.6, note: 'msb level' },
      { id: 'z2', label: 'zeros', x: 5.0, y: 5.6, note: 'first bucket' },
      { id: 'o2', label: 'ones', x: 7.0, y: 5.6, note: 'second bucket' },
      { id: 'b1', label: 'bit 1', x: 3.1, y: 3.5, note: 'next level' },
      { id: 'b0', label: 'bit 0', x: 3.1, y: 1.4, note: 'low bit' },
      { id: 'rank', label: 'rank', x: 7.0, y: 2.4, note: 'map interval' },
      { id: 'answer', label: 'queries', x: 8.9, y: 3.5, note: 'rank/quantile' },
    ],
    edges: [
      { id: 'e-input-b2', from: 'input', to: 'b2' },
      { id: 'e-b2-z2', from: 'b2', to: 'z2' },
      { id: 'e-b2-o2', from: 'b2', to: 'o2' },
      { id: 'e-z2-b1', from: 'z2', to: 'b1' },
      { id: 'e-o2-b1', from: 'o2', to: 'b1' },
      { id: 'e-b1-b0', from: 'b1', to: 'b0' },
      { id: 'e-b1-rank', from: 'b1', to: 'rank' },
      { id: 'e-b0-rank', from: 'b0', to: 'rank' },
      { id: 'e-rank-answer', from: 'rank', to: 'answer' },
    ],
  }, { title });
}

function* bitLevels() {
  const inputSeq = '3 1 4 1 5 0 2 6';
  const seqLen = 8;
  const bitLevelCount = 3;
  const zeroCounts = [5, 5, 4];
  const zeroCountStr = zeroCounts.join(', ');
  const nodeCount = 8;
  const edgeCount = 9;

  yield {
    state: matrixGraph('Stable partitions replace explicit tree nodes'),
    highlight: { active: ['input', 'b2', 'z2', 'o2', 'e-input-b2'], found: ['rank'] },
    explanation: `A wavelet matrix processes ${seqLen} integer values from the most significant bit downward. At each of ${bitLevelCount} levels, it records a bitvector and stably moves zero-bit values before one-bit values.`,
    invariant: `The zero count at each level (here ${zeroCountStr}) tells where the one bucket begins.`,
  };

  yield {
    state: labelMatrix(
      'Build levels for 3 1 4 1 5 0 2 6',
      [
        { id: 'level2', label: 'bit 2' },
        { id: 'level1', label: 'bit 1' },
        { id: 'level0', label: 'bit 0' },
        { id: 'meta', label: 'metadata' },
      ],
      [
        { id: 'bitvector', label: 'bitvector' },
        { id: 'next_order', label: 'next order' },
      ],
      [
        ['0 0 1 0 1 0 0 1', '3 1 1 0 2 | 4 5 6'],
        ['1 0 0 0 1 0 0 1', '1 1 0 4 5 | 3 2 6'],
        ['1 1 0 0 1 1 0 0', '0 4 2 6 | 1 1 5 3'],
        ['zero counts', '5, 5, 4'],
      ],
    ),
    highlight: { active: ['level2:bitvector', 'level1:bitvector', 'level0:bitvector'], found: ['meta:next_order'] },
    explanation: `The matrix stores one bitvector per level (${bitLevelCount} total) plus zero counts ${zeroCountStr}. Rank on those bitvectors maps intervals into the zero or one bucket at the next level.`,
  };

  yield {
    state: matrixGraph('Rank maps a position through each level'),
    highlight: { active: ['b2', 'b1', 'b0', 'rank', 'e-b1-rank', 'e-b0-rank'], compare: ['z2', 'o2'], found: ['answer'] },
    explanation: `To access or rank a value, carry a position through ${bitLevelCount} levels. Rank0 keeps the position in the zero bucket; zeroCount + rank1 moves it into the one bucket for the sequence ${inputSeq}.`,
  };

  yield {
    state: labelMatrix(
      'Why use a matrix layout',
      [
        { id: 'tree', label: 'Wavelet Tree' },
        { id: 'matrix', label: 'Wavelet Matrix' },
        { id: 'alphabet', label: 'large integers' },
        { id: 'cache', label: 'cache behavior' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'effect' },
      ],
      [
        ['explicit recursive nodes', 'simple concept'],
        ['flat bit levels', 'simple arrays'],
        ['fixed bit width', 'no pointer-heavy tree'],
        ['contiguous bitvectors', 'implementation-friendly'],
      ],
    ),
    highlight: { active: ['matrix:shape', 'alphabet:effect'], compare: ['tree:shape'], found: ['cache:effect'] },
    explanation: `The matrix is not a different problem. It is a layout refinement that replaces a pointer-heavy tree with ${bitLevelCount} flat bitvectors, making wavelet-style queries practical for integer alphabets and array-centric implementations.`,
  };
}

function* rangeQuantile() {
  const queryL = 1;
  const queryR = 7;
  const queryK = 3;
  const bitLevelCount = 3;
  const rangeValues = '1,4,1,5,0,2';
  const rangeLen = 6;
  const costPerQuery = 'O(log sigma)';

  yield {
    state: labelMatrix(
      '3rd smallest in range [1,7)',
      [
        { id: 'start', label: 'start range' },
        { id: 'bit2', label: 'bit 2' },
        { id: 'bit1', label: 'bit 1' },
        { id: 'bit0', label: 'bit 0' },
      ],
      [
        { id: 'decision', label: 'decision' },
        { id: 'answer_bits', label: 'answer bits' },
      ],
      [
        ['values 1,4,1,5,0,2', 'k=3'],
        ['zeros before ones; zero count is 4', 'choose 0'],
        ['inside zero bucket, enough zeroes', 'choose 0'],
        ['inside zero bucket, kth falls in one bucket', 'choose 1'],
      ],
    ),
    highlight: { active: ['bit2:decision', 'bit1:decision', 'bit0:decision'], found: ['bit0:answer_bits'] },
    explanation: `Range quantile carries [${queryL}, ${queryR}) through each of ${bitLevelCount} bit levels. Count how many of the ${rangeLen} elements in the range have bit 0. If k=${queryK} fits there, choose 0; otherwise choose 1 and subtract the zero count.`,
    invariant: `Every chosen bit narrows the value interval without sorting the ${rangeLen}-element query range.`,
  };

  yield {
    state: matrixGraph('Interval remapping is rank arithmetic'),
    highlight: { active: ['b2', 'b1', 'b0', 'rank'], found: ['answer'], compare: ['input'] },
    explanation: `The query does not extract values. It remaps l=${queryL} and r=${queryR} through ${bitLevelCount} bitvectors using rank, exactly as Wavelet Tree queries remap intervals through child nodes.`,
  };

  yield {
    state: labelMatrix(
      'Operations supported',
      [
        { id: 'access', label: 'access(i)' },
        { id: 'rank', label: 'rank(x,i)' },
        { id: 'quantile', label: 'kth in [l,r)' },
        { id: 'predecessor', label: 'pred/succ' },
      ],
      [
        { id: 'walk', label: 'walk' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['read bits down levels', 'O(log sigma)'],
        ['follow value bits', 'O(log sigma)'],
        ['branch by zero counts', 'O(log sigma)'],
        ['branch with bounds', 'O(log sigma)'],
      ],
    ),
    highlight: { active: ['quantile:walk', 'predecessor:walk'], found: ['access:cost', 'rank:cost'] },
    explanation: `The same rank/select support underlies all four query types, each costing ${costPerQuery}. Range quantile is the easiest to visualize because each of ${bitLevelCount} levels chooses one answer bit.`,
  };

  yield {
    state: labelMatrix(
      'Case study: static percentile windows',
      [
        { id: 'snapshot', label: 'snapshot' },
        { id: 'query', label: 'window query' },
        { id: 'matrix', label: 'wavelet matrix' },
        { id: 'result', label: 'result' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'reason' },
      ],
      [
        ['latency samples', 'static batch'],
        ['[l,r), p95', 'kth by rank'],
        ['bit-level index', 'no per-window sort'],
        ['quantile value', 'log sigma walk'],
      ],
    ),
    highlight: { active: ['query:role', 'matrix:reason'], found: ['result:role'], compare: ['snapshot:reason'] },
    explanation: `For static arrays of measurements, a wavelet matrix can answer percentile-style window queries in ${costPerQuery} per query without building a separate sorted catalog for every possible window.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bit levels') yield* bitLevels();
  else if (view === 'range quantile') yield* rangeQuantile();
  else throw new InputError('Pick a wavelet-matrix view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read each row as one bit level of the value alphabet. A bit level records whether each current value has a 0 or 1 in that bit position, then stably partitions the values so all zeros stay before all ones. Active highlights show the level being queried, and found highlights show answer bits already fixed.',
        {type: 'callout', text: 'A wavelet matrix turns range order into rank arithmetic: each bit level chooses one answer bit while keeping the query interval contiguous.'},
        {type: 'image', src: './assets/gifs/wavelet-matrix-range-quantile.gif', alt: 'Animated walkthrough of the wavelet matrix range quantile visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The safe inference rule is interval preservation. After a stable partition, the items from the query range still occupy a contiguous interval in the next level once rank tells how many zeros or ones came before them.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A range quantile query asks for the kth smallest value inside a positional range. For example, in an array of response times, you may need the 95th percentile between minute 10 and minute 20 without sorting that slice on every dashboard refresh.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'Range-query indexes can be read as directed navigation structures: each edge preserves enough order information to avoid sorting the query window. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The wavelet matrix exists because position order and value order are different axes. It stores enough bit-level routing information to answer value-order questions while keeping the original positions addressable.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to copy the range, sort it, and read index k. For a range length m, that costs O(m log m) time and O(m) temporary memory. It is acceptable for one small query.',
        'A second obvious approach is to pre-sort every possible range. That gives fast queries, but there are O(n^2) ranges, so the storage explodes before the data structure becomes useful.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that each query wants a sorted view of a slice, but the slice changes by position. Sorting from scratch repeats work, and storing all sorted slices stores the same evidence too many times.',
        'A merge-sort tree improves the baseline by storing sorted lists per segment, but range quantile still tends to pay extra logarithmic factors and pointer-heavy memory access. The wavelet matrix targets the same question with level-by-level bitvectors.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to decide the answer one bit at a time. At the most significant bit, count how many values in the range have 0. If k fits inside that count, the answer bit is 0; otherwise the answer bit is 1 and k skips the zero group.',
        'Stable partitioning makes this legal. Values keep their relative order within each bit group, so rank operations can translate the old range boundaries into the correct child interval at the next bit level.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Build one bitvector per bit position, from most significant to least significant. At each level, write a 0 or 1 for every current value, count the zeros, then reorder values by that bit while preserving order inside the zero group and the one group.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Cache_hierarchy.svg', alt: 'CPU cache hierarchy diagram', caption: 'The matrix layout matters because rank walks pay for memory movement; contiguous bitvectors make cache behavior part of the data-structure design. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Cache_hierarchy.svg.'},
        'To answer kth smallest in [l, r), use rank0 and rank1 on the current level to count zeros and ones in that interval. Choose the side containing k, append that bit to the answer, and remap [l, r) into the next level using the same rank counts.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The invariant is that the current interval contains exactly the original query elements that share the answer prefix chosen so far. At each bit level, rank counts how many of those elements go left or right. Choosing the side containing k cannot discard the kth value because the other side contains either all smaller prefix values already counted or all larger prefix values not yet needed.',
        'Induction over bit levels proves the result. Before the first level, the interval is the original range. After each level, stable partitioning and rank remap it to the correct subset. After the last bit, the accumulated bits are the value of the kth element.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Build time is O(n log sigma), where sigma is the number of distinct values after compression or the size of the value universe being represented. Query time is O(log sigma) because one rank step is performed per bit level. Doubling n doubles the bitvector length and build work, but it does not increase the number of levels unless the value alphabet also grows.',
        'Space is n bits per level plus rank support and zero counts. The hidden cost is memory movement: a query touches one rank structure per level, so a flat matrix layout usually behaves better than a pointer-heavy tree.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Wavelet matrices are used in static range-query indexes, compressed text indexes, telemetry percentile queries, and competitive-programming range quantile problems. They fit when the array is read many times and updated rarely or never.',
        'They are also useful in full-text indexing because suffix-array intervals need occurrence and range-count queries over compact symbol sequences. The matrix layout is attractive when the machine cost of chasing tree nodes matters.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The structure is a poor fit for frequent updates. Inserting one value can change routing across many levels and force updates to rank support. Dynamic variants exist, but they are much more complex.',
        'It also loses when the range is tiny or the number of queries is small. Copying and sorting 20 values may beat a sophisticated index because constants, cache misses, and build time dominate the theoretical bound.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Use values [3, 1, 4, 1, 5, 0, 2, 6] and ask for the 3rd smallest in [1, 7), the slice [1, 4, 1, 5, 0, 2]. Sorted, that slice is [0, 1, 1, 2, 4, 5], so the answer is 1 if k is 1-based. The wavelet matrix reaches the same answer without sorting the slice.',
        'At the top bit for values 0 through 7, the range contains four values with leading bit 0 and two with leading bit 1. Because k=3 fits in the zero group, the top answer bit is 0 and the interval remaps to only those four values. Repeating the count at lower bits chooses 0 then 1, giving binary 001, which is value 1.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Claude and Navarro, The Wavelet Matrix, at https://users.dcc.uchile.cl/~gnavarro/ps/spire12.4.pdf. For background, read Navarro, Wavelet Trees for All, at https://users.dcc.uchile.cl/~gnavarro/ps/jda12.1.pdf.',
        'Study Rank/Select Bitvectors first, then Wavelet Tree, Succinct Data Structures, FM-Index, Range Minimum Query, and Merge Sort Tree. The matrix is easiest after rank remapping feels mechanical.',
      ],
    },
  ],
};
