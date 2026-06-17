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
      heading: `Why This Exists`,
      paragraphs: [
        `A bitvector is the simplest compressed set representation: one bit per possible position. That is attractive until the code needs to navigate it. Succinct indexes constantly ask two questions: rank1(i), how many 1 bits appear up to a position, and select1(k), where the k-th 1 bit lives.`,
        `Those two operations let larger structures replace pointers with bits. LOUDS uses rank/select to move through tree topology. Wavelet structures use rank to remap ranges. FM-indexes use rank for the LF-mapping step that walks backward through a text. The bitvector is small; rank/select makes it usable.`,
      ],
    },
    {
      heading: `Naive Baseline`,
      paragraphs: [
        `The smallest baseline stores only the bits and scans from the beginning for every query. rank1(10) counts every 1 bit from position 0 through 10. select1(6) scans until it has seen six 1 bits. This keeps the representation at n bits, but each query can cost O(n).`,
        `The opposite baseline stores a prefix count at every position. Then rank is O(1), but the directory stores n machine integers next to n bits. That can use 32 or 64 times more space than the original bitvector, so the compressed representation stops being compressed.`,
      ],
    },
    {
      heading: `The Wall`,
      paragraphs: [
        `The wall is that compressed indexes need navigation at pointer speed but cannot afford pointer-sized metadata per bit. A scan is too slow when a wavelet matrix or FM-index performs rank at every level. A full prefix array is too large when the goal is to stay close to the information-theoretic size.`,
        `Rank/select is therefore an engineering compromise, not just a mathematical primitive. It must answer many tiny queries, avoid cache misses, and add only a small overhead beyond the raw bit string.`,
      ],
    },
    {
      heading: `Core Insight`,
      paragraphs: [
        `Store checkpoints, not every prefix. A rank directory samples the prefix count at coarse superblocks, optionally stores smaller local block counts, and leaves the final few bits to hardware popcount. A select directory samples occurrence positions, jumps close to the desired occurrence, and finishes inside a small local region.`,
        `The invariant is additivity. The number of 1 bits before position i equals the number before its superblock, plus the number before its local block, plus the number in the remaining word prefix. Select uses the same monotone prefix counts in reverse: the k-th 1 must be inside the first sampled region whose cumulative count reaches k.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `In the "rank directory" view, the first matrix separates raw bits, prefix counts, and superblock samples. The highlighted superblock entries are the stored shortcuts. The answer frame for rank(10) shows the actual formula: coarse count 4, local count 0, tail popcount 3, answer 7.`,
        `In the "select directory" view, follow the query in the opposite direction. The goal row says select(6); the coarse jump row narrows the search to the right rank bucket; the word scan row finds the exact bit; the answer row confirms that position 9 is where the sixth 1 occurs. The later frames compare dense, sparse, clustered, and random layouts because select sampling is strongly affected by bit density.`,
      ],
    },
    {
      heading: `Mechanics`,
      paragraphs: [
        `A common rank layout splits the bitvector into superblocks and blocks. Each superblock stores the absolute number of 1 bits before it. Each block stores the number of 1 bits since the superblock began. The query masks the current machine word so only positions up to i remain, then calls popcount.`,
        `select1(k) usually needs different metadata. One design stores the position of every t-th 1 bit, then searches locally from the nearest sample. More elaborate designs treat dense and sparse regions differently: dense regions keep raw bits and popcount; sparse regions may store positions, gaps, or compressed lists.`,
        `rank0 and select0 are not separate ideas. rank0(i) is derived from the length prefix minus rank1(i). select0 can use a corresponding zero directory or a transformed search over rank0, depending on the performance target.`,
      ],
    },
    {
      heading: `Correctness`,
      paragraphs: [
        `rank1 is correct because it is just a prefix sum decomposed into disjoint ranges. The superblock range, local block range, and masked tail range do not overlap and together cover exactly the prefix requested by the query.`,
        `select1 is correct because rank1 is monotone. As positions increase, the number of 1 bits seen never decreases. If a sample says the k-th 1 is after one sampled position and before the next, then a local scan inside that interval cannot miss it. Counting local 1 bits until the residual rank reaches zero gives the unique position of that occurrence.`,
      ],
    },
    {
      heading: `Cost and Tradeoffs`,
      paragraphs: [
        `The practical target is O(1) rank and select with small extra space. The constant factors matter: a query may touch a superblock counter, a block counter, and one or two machine words. Good layouts align these pieces so the CPU can use cache lines and hardware popcount efficiently.`,
        `Sampling more frequently lowers query latency and raises memory overhead. Sampling less frequently saves space and increases local work. Sparse bitvectors often benefit from compressed positions or gaps; dense bitvectors often benefit from raw words plus counters. There is no single best directory without knowing density, query mix, and update cadence.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `For the displayed bitvector, positions 0 through 10 contain seven 1 bits: 1 at 0, 2 at 2, 3 at 3, 4 at 6, 5 at 8, 6 at 9, and 7 at 10. rank1(10) is therefore 7.`,
        `The directory does not recount all eleven positions. It reads the stored count before position 8, which is 4, adds the local count for the block, then popcounts bits 8 through 10. Those three bits are 1, 1, 1, so the tail contributes 3. The answer is 4 + 0 + 3 = 7.`,
        `For select1(6), the sixth 1 in the same list is at position 9. A select directory jumps near the occurrence bucket and only counts enough local 1 bits to distinguish positions 8, 9, and 10.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Rank/select wins when a static structure can encode shape or membership as bits and then query those bits many times. Succinct trees, LOUDS tries, wavelet matrices, FM-indexes, compressed suffix arrays, and compressed bitmaps all use this pattern.`,
        `It is especially strong when the bitvector is built once, stays mostly unchanged, and sits on a hot query path. The build cost is then paid once, while the compact layout improves memory locality for every later lookup.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `Rank/select is not a general-purpose dynamic set. Inserting one bit changes the ranks of every later position, so frequent edits require a dynamic bitvector, a log-structured rebuild strategy, or a different data structure.`,
        `It also does not make every query one memory access. The asymptotic cost may be constant, but branch behavior, sample placement, word width, and cache layout decide whether the implementation is actually fast.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study LOUDS Succinct Trie next to see rank/select turn tree topology into navigable bits. Study Wavelet Matrix Range Quantile to see rank remap index intervals through value bits. Then study FM-Index and Burrows-Wheeler Transform for a text-indexing use, and Roaring Bitmaps or Elias-Fano Encoding for nearby compressed-set tradeoffs.`,
        `Useful primary sources include Practical Entropy-Compressed Rank/Select Dictionary at https://arxiv.org/abs/cs/0610001, SPIDER rank/select at https://arxiv.org/abs/2405.05214, and Theory Meets Practice for Bit Vectors Supporting Rank and Select at https://arxiv.org/html/2509.17819.`,
      ],
    },
  ],
};
