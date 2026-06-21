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
        'The "rank directory" view shows a 16-bit bitvector with three rows: raw bits, prefix 1-counts at every position, and stored superblock counters. Active highlights mark 1-bits the directory cares about. Found highlights mark the two superblock entries that are actually stored. The second frame decomposes a rank(10) query into its three additive pieces: superblock count, local block count, and popcount tail.',
        {type: 'callout', text: 'Rank and select make bitstrings navigable: rank counts how far you have gone, and select jumps to the position where a count first becomes true.'},
        'The "select directory" view works in the opposite direction. The first frame traces select(6) from goal through coarse jump through word scan to the final answer position. Later frames compare how density affects directory design: dense, sparse, clustered, and random layouts demand different sampling strategies.',
        'At each frame, notice what is stored versus what is recomputed. The entire point of the structure is that almost nothing is stored, yet queries never scan from the beginning.',
      
        {type: 'image', src: './assets/gifs/rank-select-bitvector.gif', alt: 'Animated walkthrough of the rank select bitvector visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        {
          type: 'quote',
          text: 'A bitvector of n bits with o(n) additional bits can support rank and select in constant time.',
          attribution: 'Guy Jacobson, "Space-efficient static trees and graphs" (FOCS 1989)',
        },
        'Compressed data structures encode trees, sets, and strings as raw bitstrings. A LOUDS trie stores an entire tree as one bit per node. A wavelet matrix stores a permutation as one bit per level per element. An FM-index stores a full-text index as one character-alphabet worth of bitvectors. All of them are tiny -- until the code needs to navigate.',
        'Navigation always asks the same two questions. rank1(i): how many 1-bits appear in positions 0 through i? select1(k): which position holds the k-th 1-bit? Without fast answers, every tree traversal, every range query, every backward search step costs O(n). With fast answers, compressed structures match pointer-based ones in query time while using a fraction of the memory.',
        'Jacobson showed in 1989 that both operations can be answered in O(1) time using only o(n) extra bits -- sublinear overhead on top of the n-bit string itself. That result created the field of succinct data structures.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest rank implementation stores nothing beyond the raw bits. rank1(i) walks from position 0 to i, counting ones. select1(k) walks until it has seen k ones. Storage is n bits. Query time is O(n). For a wavelet matrix with log(sigma) levels, every single access triggers log(sigma) rank calls, each costing O(n). That makes the whole structure O(n log sigma) per query -- worse than an unsorted scan.',
        'The opposite extreme precomputes every prefix count. Store an array P where P[i] = rank1(i). Now rank is a single lookup: O(1). But P has n entries, each needing log(n) bits. For a bitvector of one million bits, the prefix array uses roughly 20 million bits -- twenty times the original data. The compressed structure is no longer compressed.',
        {
          type: 'diagram',
          text: 'Approach 1: scan every time\n  B = [1 0 1 1 0 0 1 0 1 1 1 0 0 1 0 1]\n  rank1(10) -> walk positions 0..10, count ones -> 7\n  Cost: O(n) per query, 0 extra space\n\nApproach 2: full prefix array\n  P = [1 1 2 3 3 3 4 4 5 6 7 7 7 8 8 9]\n  rank1(10) -> P[10] = 7\n  Cost: O(1) per query, n * ceil(log n) extra bits',
          label: 'Two extremes: zero storage or zero query time, never both',
        },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The constraint is simultaneous: the directory must answer rank and select in O(1) time while adding only o(n) bits -- strictly sublinear in the bitvector length. Scanning is too slow because every parent structure (wavelet tree, FM-index, LOUDS trie) calls rank on its inner loop. A full prefix array is too large because the entire reason for using a bitvector is that it is small.',
        'This is not a vague scalability worry. An FM-index over a 3-billion-character human genome stores about 3 billion bits per wavelet level. A prefix array at 64 bits per entry would add 24 gigabytes of overhead per level. That overhead exceeds the size of the uncompressed text. The rank directory must use megabytes, not gigabytes, or the succinct approach fails at the point where it matters most.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The rank directory uses a two-level sampling hierarchy. Divide the n-bit string into superblocks of s bits each. For each superblock, store the absolute rank (total 1-count) up to its start. That costs (n/s) * log(n) bits. Then divide each superblock into blocks of b bits. For each block, store the local rank since its superblock. That costs (n/b) * log(s) bits. The remaining bits inside one block are resolved by masking and calling the hardware popcount instruction.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Binary_Search_Depiction.svg/250px-Binary_Search_Depiction.svg.png', alt: 'Binary search narrowing a sorted array to a target value', caption: 'Select can fall back to binary search over rank milestones when a faster select directory is not stored. Source: Wikimedia Commons, Binary Search Depiction.svg.'},
        {
          type: 'diagram',
          text: 'Bitvector B (n bits):\n|<--- superblock 0 (s bits) --->|<--- superblock 1 (s bits) --->| ...\n| blk0 | blk1 | blk2 | blk3    | blk4 | blk5 | blk6 | blk7    | ...\n\nStored:  R[0]=0          R[1]=cumulative 1s up to position s\n         r[0]=0  r[1]=local  r[2]=local  r[3]=local  ...\n\nrank1(i):\n  1. superblock_count = R[ i / s ]         -- one table lookup\n  2. block_count     = r[ i / b ]         -- one table lookup\n  3. tail_count      = popcount(word & mask)  -- one CPU instruction\n  4. answer          = superblock_count + block_count + tail_count',
          label: 'Two-level rank directory with popcount finish',
        },
        'Jacobson set s = log^2(n) and b = log(n)/2 to achieve o(n) total overhead. In practice, modern implementations set s and b to multiples of the machine word width (often s = 512 or 256 bits, b = 64 bits) so that every lookup and popcount aligns with cache lines and registers.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Rank query using precomputed directory + popcount\nfunction rank1(B, superRank, blockRank, i) {\n  const s = 512;               // superblock width in bits\n  const b = 64;                // block width = one 64-bit word\n  const si = Math.floor(i / s); // superblock index\n  const bi = Math.floor(i / b); // block index\n  const superCount = superRank[si];\n  const blockCount = blockRank[bi];\n  // Mask: keep only bits 0..rem within the word\n  const rem = i % b;\n  const word = B[bi];           // 64-bit word (BigInt or pair of 32-bit)\n  const mask = (1n << BigInt(rem + 1)) - 1n;\n  const tailCount = popcount64(word & mask);\n  return superCount + blockCount + tailCount;\n}\n\nfunction popcount64(x) {\n  // Hamming weight via bit-parallel reduction\n  x = x - ((x >> 1n) & 0x5555555555555555n);\n  x = (x & 0x3333333333333333n) + ((x >> 2n) & 0x3333333333333333n);\n  x = (x + (x >> 4n)) & 0x0f0f0f0f0f0f0f0fn;\n  return Number((x * 0x0101010101010101n) >> 56n);\n}',
        },
        'Select works differently. select1(k) asks: where is the k-th one? One approach stores sampled positions: record the position of every t-th one. To answer select1(k), jump to the nearest sample, then scan forward with popcount until the residual count reaches zero. More advanced designs (Clark 1996) combine sparse and dense cases to guarantee O(1) worst-case select with o(n) space, but the constant factors are large enough that many practical libraries use binary search over the rank directory instead.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Rank is a prefix sum. Prefix sums decompose additively: the count over [0, i] equals the count over [0, superblock_start) plus [superblock_start, block_start) plus [block_start, i]. The three pieces are disjoint and exhaustive, so no bit is counted twice or missed. Each piece is either precomputed (table lookup) or small enough to compute in a single popcount instruction.',
        'Select is correct because rank is monotone non-decreasing. If rank1(a) < k and rank1(b) >= k with a < b, then the k-th one is in [a+1, b]. The sampled positions narrow this interval to at most one superblock. Within that region, popcount over successive words finds the exact word containing the target, and a final bit-scan locates the precise position. Monotonicity guarantees the search never skips the answer.',
        {
          type: 'note',
          text: 'The o(n) space bound is the key theoretical contribution. The directory adds strictly fewer bits than the bitvector itself -- under Jacobson original parameters, the overhead is O(n * log(log(n)) / log(n)) bits, which vanishes relative to n as n grows.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Naive scan: rank O(n), select O(n), and zero extra space. It keeps the bitvector small but makes every navigation step linear.',
            'Full prefix array: rank O(1), select O(log n) by binary search, and O(n log n) extra bits. It answers fast but defeats compression.',
            'Two-level Jacobson directory: rank O(1), select O(log log n) or O(1) depending on samples, and o(n) extra bits. Superblocks, blocks, and popcount make this the practical standard.',
            'Broadword and hardware popcount variants: rank O(1) and practical select O(1) with o(n) extra bits, using CPU bit instructions for the tail.',
            'RRR compression: rank and select O(1) with nH0 + o(n) bits. It adapts space to bit density but pays extra decoding cost.',
          ],
        },
        'The two-level directory with hardware popcount is the workhorse. On x86, the POPCNT instruction counts the set bits in a 64-bit register in one cycle. ARM has equivalent instructions (CNT + ADDV). This makes the tail step essentially free, and the whole query costs two table lookups plus one instruction -- typically 2-3 cache line touches.',
        'RRR compression goes further: it encodes each block as a (class, offset) pair where the class is the popcount of the block and the offset identifies which specific bit pattern within that class. For bitvectors far from 50% density, this can shrink the representation to near the zeroth-order entropy H0, plus o(n) bits for the directory. The tradeoff is slower queries due to table lookups for decoding.',
        {
          type: 'note',
          text: 'Hardware popcount changed the landscape. Before POPCNT (introduced in Intel Nehalem, 2008, and AMD Barcelona, 2007), the tail step used lookup tables or broadword tricks. After it, the practical speed of rank queries roughly doubled, and simpler two-level designs became competitive with more complex layouts.',
        },
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Rank and select are the load-bearing primitives inside nearly every succinct and compressed data structure. The structures themselves are diverse, but they all reduce to "store topology or membership as bits, then navigate those bits with rank/select."',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'Succinct structures often replace pointer graphs with bitstrings, then recover navigation through rank and select. Source: Wikimedia Commons, David W., public domain.'},
        {
          type: 'bullets',
          items: [
            'Wavelet tree or matrix: rank routes queries left or right at each level by counting 0s and 1s in a prefix; select helps recover original positions from leaf-level results.',
            'FM-index over the Burrows-Wheeler transform: rank drives LF-mapping backward through the text; select helps locate sampled suffix-array positions.',
            'LOUDS trie: rank on the level-order bitstring finds child ranges; select navigates from child positions back toward parents.',
            'Compressed bitmap: rank counts set bits in a range for aggregation; select iterates set bits for intersection, union, or sparse-position recovery.',
            'Succinct binary tree: rank and select navigate left child, right child, and parent relationships without explicit node pointers.',
          ],
        },
        'In bioinformatics, a single FM-index over a human genome may call rank billions of times during read alignment. In web search, wavelet trees over posting lists use rank to intersect and count term occurrences. In databases, compressed bitmaps use rank to translate between dense logical row IDs and sparse physical positions. The structure is invisible to end users but sits on the hottest loop of each system.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Rank/select bitvectors are static. Inserting or deleting a single bit shifts every position after it, invalidating every stored rank. Dynamic bitvectors exist (balanced trees of small bitvectors with local rank tables), but they are O(log n) per operation instead of O(1), and significantly more complex to implement.',
        'The O(1) query time hides real constants. A rank query touches a superblock entry, a block entry, and a word -- potentially three different cache lines. On a cold cache, that is three memory round-trips. For bitvectors that fit in L2, this is fast. For bitvectors spanning gigabytes (genome-scale), cache misses dominate and the "constant time" label is misleading without prefetching.',
        {
          type: 'bullets',
          items: [
            'Dynamic updates: inserting one bit invalidates all subsequent ranks. Use a dynamic bitvector or rebuild.',
            'Small n: for bitvectors under a few thousand bits, a plain scan is faster than the directory lookup overhead.',
            'High-entropy workloads: RRR compression helps sparse or dense bitvectors but cannot shrink a 50%-density bitvector below n bits.',
            'Multi-threaded construction: building the directory is sequential (prefix sums). Parallel construction requires careful segmentation.',
            'Variable-width elements: rank/select counts bits, not variable-length records. Pairing it with Elias-Fano or other encodings adds a translation layer.',
          ],
        },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Guy Jacobson, "Space-efficient static trees and graphs" (FOCS 1989) -- the founding paper that introduced o(n)-space rank/select.',
            'Raman, Raman, Rao, "Succinct indexable dictionaries with applications to encoding k-ary trees and multisets" (SODA 2002) -- RRR entropy-compressed bitvectors.',
            'Navarro and Providel, "Fast, small, simple rank/select on bitmaps" (SEA 2012) -- practical engineering of two-level directories.',
            'Vigna, "Broadword implementation of rank/select queries" (WEA 2008) -- popcount-free broadword tricks and benchmarks: https://sux.di.unimi.it/',
            'Zhou, Andersen, Kaminsky, "Space-efficient, high-performance rank and select structures on uncompressed bit sequences" (SEA 2013) -- cache-aligned layouts for modern CPUs.',
          ],
        },
        'Prerequisites: understand prefix sums and bitwise operations (popcount, masks, shifts). If those are unfamiliar, study them first.',
        'Extensions: study LOUDS Succinct Trie to see rank/select navigate tree topology as a flat bitstring. Study Wavelet Matrix to see rank remap ranges through value bits level by level. Study FM-Index to see rank power full-text backward search over a BWT.',
        'Alternatives: for compressed sets without the rank/select interface, study Roaring Bitmaps (hybrid run-length + array containers) and Elias-Fano Encoding (monotone integer sequences with nearly optimal space). Both solve overlapping problems with different tradeoff profiles.',
      ],
    },
  ],
};
