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
  yield {
    state: labelMatrix(
      'Bitvector B',
      [
        { id: 'bits', label: 'bits' },
        { id: 'rank', label: 'prefix 1s' },
        { id: 'block', label: 'superblock' },
      ],
      Array.from({ length: 16 }, (_, i) => ({ id: `p${i}`, label: String(i) })),
      [
        ['1', '0', '1', '1', '0', '0', '1', '0', '1', '1', '1', '0', '0', '1', '0', '1'],
        ['1', '1', '2', '3', '3', '3', '4', '4', '5', '6', '7', '7', '7', '8', '8', '9'],
        ['0', '', '', '', '', '', '', '', '4', '', '', '', '', '', '', ''],
      ],
    ),
    highlight: { active: ['bits:p0', 'bits:p2', 'bits:p3', 'bits:p6'], found: ['block:p0', 'block:p8'] },
    explanation: 'rank(i) asks how many 1 bits appear up to position i. A succinct bitvector stores sparse prefix counts so queries do not scan from the beginning.',
  };

  yield {
    state: labelMatrix(
      'Answer rank(10)',
      [
        { id: 'super', label: 'superblock count' },
        { id: 'mini', label: 'inside-block count' },
        { id: 'pop', label: 'popcount tail' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'work', label: 'work' },
      ],
      [
        ['4', 'ones before position 8'],
        ['0', 'start of mini block'],
        ['3', 'popcount bits 8..10'],
        ['7', '4 + 0 + 3'],
      ],
    ),
    highlight: { active: ['super:value', 'pop:value'], found: ['answer:value'] },
    explanation: 'A practical rank directory combines coarse counters, smaller local counters, and a machine popcount over the final word. That gives constant-time counting with tiny overhead.',
    invariant: 'Rank is prefix sum over bits, accelerated by sampled prefix sums plus popcount.',
  };

  yield {
    state: labelMatrix(
      'Why this is succinct',
      [
        { id: 'plain', label: 'plain prefix array' },
        { id: 'sampled', label: 'sampled rank directory' },
        { id: 'compressed', label: 'compressed variant' },
        { id: 'raw', label: 'raw bits' },
      ],
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
    explanation: 'The point is not that rank is hard. The point is answering rank while adding only a small number of bits beyond the original bitvector.',
  };

  yield {
    state: labelMatrix(
      'Where rank appears',
      [
        { id: 'wavelet', label: 'wavelet tree' },
        { id: 'fm', label: 'FM-index' },
        { id: 'bitmap', label: 'compressed bitmap' },
        { id: 'tree', label: 'succinct tree' },
      ],
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
    explanation: 'Rank/select is the hidden primitive inside many compressed structures. Once rank is fast, indexes can store topology as bits instead of pointers.',
  };
}

function* selectDirectory() {
  yield {
    state: labelMatrix(
      'select(k) locates the k-th 1',
      [
        { id: 'goal', label: 'goal' },
        { id: 'coarse', label: 'coarse jump' },
        { id: 'scan', label: 'word scan' },
        { id: 'answer', label: 'answer' },
      ],
      [
        { id: 'example', label: 'select(6)' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['6th one', 'find position with rank = 6'],
        ['jump near rank bucket', 'avoid scanning all bits'],
        ['popcount words', 'locate exact bit'],
        ['position 9', 'B[9] is the 6th one'],
      ],
    ),
    highlight: { active: ['goal:example', 'coarse:example', 'scan:example'], found: ['answer:example'] },
    explanation: 'select(k) is the inverse direction: find the position where the k-th 1 occurs. Directories store sampled positions so the final search is local.',
  };

  yield {
    state: labelMatrix(
      'Dense versus sparse bitvectors',
      [
        { id: 'dense', label: 'dense ones' },
        { id: 'sparse', label: 'sparse ones' },
        { id: 'clustered', label: 'clustered ones' },
        { id: 'random', label: 'random bits' },
      ],
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
    explanation: 'Compressed rank/select dictionaries adapt to density. Sparse sets can store positions or gaps; dense sets often keep raw bits plus small rank samples.',
  };

  yield {
    state: labelMatrix(
      'Query contracts',
      [
        { id: 'rank1', label: 'rank1(i)' },
        { id: 'rank0', label: 'rank0(i)' },
        { id: 'select1', label: 'select1(k)' },
        { id: 'select0', label: 'select0(k)' },
      ],
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
    explanation: 'Most libraries expose both 0 and 1 variants. If rank1 is fast and the length is known, rank0 is usually derived. Select needs its own samples for speed.',
  };

  yield {
    state: labelMatrix(
      'Engineering tradeoffs',
      [
        { id: 'space', label: 'extra space' },
        { id: 'latency', label: 'latency' },
        { id: 'build', label: 'build time' },
        { id: 'updates', label: 'updates' },
      ],
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
    explanation: 'Rank/select bitvectors are usually static. They are built once so compressed indexes can query them millions of times.',
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
      heading: 'What it is',
      paragraphs: [
        'A rank/select bitvector is the primitive that makes many succinct data structures practical. Given a bitvector B, rank1(i) returns the number of 1 bits up to position i. select1(k) returns the position of the k-th 1 bit. With these two operations, a structure can represent sets, trees, strings, and graph topology as compact bits while still navigating them quickly.',
        'SPIDER defines the same operations and frames rank/select as preprocessing a bitvector to answer count and locate queries quickly while using far less space than ordinary auxiliary arrays: https://arxiv.org/abs/2405.05214. Okanohara and Sadakane practical rank/select dictionaries target entropy-compressed representations close to nH0 bits in practice: https://arxiv.org/abs/cs/0610001.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The simplest rank directory stores prefix counts every fixed-size superblock, smaller counts inside each superblock, and raw bits. To answer rank(i), read the superblock count, add the local count, then popcount the remaining machine word bits. Hardware popcount makes the final step fast. This replaces an O(i) scan with a few memory reads and arithmetic operations.',
        'Select goes the other direction. A select directory stores sampled positions of every k-th one, jumps near the target, then scans or uses small tables and popcount to find the exact bit. Dense and sparse bitvectors use different layouts: sparse dictionaries may store gaps or positions, while dense dictionaries often keep raw bits plus compact samples.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The ideal is constant-time queries with small overhead beyond the bitvector itself. A plain prefix array gives O(1) rank but uses far too much space. A raw bitvector uses n bits but rank is a scan. Practical rank/select dictionaries choose sample rates and block layouts to minimize cache misses while keeping overhead low. Recent work continues to close the gap between theoretical succinctness and implementation speed; Theory Meets Practice for Bit Vectors Supporting Rank and Select reports a worst-case constant-time implementation with 0.78 percent overhead: https://arxiv.org/html/2509.17819.',
        'Updates are the hard part. Most succinct rank/select structures are static because inserting a bit changes ranks after that position. Dynamic compressed bitvectors exist, but they are more complex and slower. For many indexes, static is acceptable: build the index once for an immutable file or snapshot, then query it heavily.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Wavelet Tree uses rank to route a position down bitvectors. FM-Index & Burrows-Wheeler Transform uses rank for LF-mapping over compressed text. Roaring Bitmaps and other compressed bitmap structures use related rank/select ideas to count and iterate set bits. Succinct trees encode parentheses or balanced bitstrings, then navigate parent, child, next sibling, and subtree boundaries with rank and select.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse rank/select with compression alone. The raw bitvector can be compressed, but the key achievement is keeping navigation fast after compression. Do not assume O(1) means one memory access; the constant is cache layout, sample rate, popcount, and branch behavior. Also do not use a static succinct bitvector when frequent edits are the dominant operation.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: SPIDER rank/select at https://arxiv.org/abs/2405.05214, Practical Entropy-Compressed Rank/Select Dictionary at https://arxiv.org/abs/cs/0610001, and Theory Meets Practice for Bit Vectors Supporting Rank and Select at https://arxiv.org/html/2509.17819. Study Wavelet Tree, FM-Index & Burrows-Wheeler Transform, Roaring Bitmaps, Succinct data structures in general, and Binary Fuse Filter next.',
      ],
    },
  ],
};
