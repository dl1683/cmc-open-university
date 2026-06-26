// Elias-Fano encoding: split monotone integers into low bits and a unary high
// bitvector so compressed postings still support access and search.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'elias-fano-encoding',
  title: 'Elias-Fano Encoding',
  category: 'Data Structures',
  summary: 'Compress a sorted integer list by splitting low bits from unary-coded high bits, then use rank/select to recover values and search.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['encode monotone list', 'query operations'], defaultValue: 'encode monotone list' },
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

function efGraph(title) {
  return graphState({
    nodes: [
      { id: 'list', label: 'sorted ids', x: 0.7, y: 3.6, note: 'monotone sequence' },
      { id: 'split', label: 'split bits', x: 2.7, y: 3.6, note: 'high + low' },
      { id: 'low', label: 'low-bit array', x: 4.7, y: 2.1, note: 'dense tail bits' },
      { id: 'high', label: 'high bitvector', x: 4.7, y: 5.1, note: 'unary gaps' },
      { id: 'rankselect', label: 'rank/select', x: 6.9, y: 3.6, note: 'find 1-bits' },
      { id: 'access', label: 'access/search', x: 8.9, y: 3.6, note: 'reconstruct values' },
    ],
    edges: [
      { id: 'e-list-split', from: 'list', to: 'split', weight: 'choose l' },
      { id: 'e-split-low', from: 'split', to: 'low', weight: 'low l bits' },
      { id: 'e-split-high', from: 'split', to: 'high', weight: 'upper bits' },
      { id: 'e-low-access', from: 'low', to: 'access', weight: 'append low' },
      { id: 'e-high-rs', from: 'high', to: 'rankselect', weight: 'select1' },
      { id: 'e-rs-access', from: 'rankselect', to: 'access', weight: 'recover high' },
    ],
  }, { title });
}

function* encodeMonotoneList() {
  yield {
    state: efGraph('Elias-Fano starts with a sorted integer sequence'),
    highlight: { active: ['list', 'split', 'e-list-split'], compare: ['low', 'high'] },
    explanation: `Elias-Fano works because the input is monotone. The pipeline flows through ${6} stages from sorted ids to searchable access. Sorted document ids, graph neighbor ids, and timestamp offsets have order that ordinary variable-byte coding does not fully exploit.`,
  };

  yield {
    state: labelMatrix(
      'Split values with l = 2 low bits',
      [
        { id: 'v0', label: '3' },
        { id: 'v1', label: '5' },
        { id: 'v2', label: '8' },
        { id: 'v3', label: '13' },
        { id: 'v4', label: '21' },
        { id: 'v5', label: '34' },
      ],
      [
        { id: 'high', label: 'high' },
        { id: 'low', label: 'low' },
        { id: 'rebuild', label: 'rebuild' },
      ],
      [
        ['0', '3', '0*4+3'],
        ['1', '1', '1*4+1'],
        ['2', '0', '2*4+0'],
        ['3', '1', '3*4+1'],
        ['5', '1', '5*4+1'],
        ['8', '2', '8*4+2'],
      ],
    ),
    highlight: { active: ['v2:high', 'v2:low', 'v2:rebuild'], found: ['v5:high', 'v5:low'] },
    explanation: `Choose l = ${2} lower bits to split each of the ${6} values. Store the low parts directly. The high parts are nondecreasing, so they can be stored compactly as a unary bitvector.`,
    invariant: `value(i) = high(i) * 2^${2} + low(i) for all ${6} elements.`,
  };

  yield {
    state: labelMatrix(
      'High bitvector idea',
      [
        { id: 'h0', label: 'high 0' },
        { id: 'h1', label: 'high 1' },
        { id: 'h2', label: 'high 2' },
        { id: 'h3', label: 'high 3' },
        { id: 'h5', label: 'high 5' },
        { id: 'h8', label: 'high 8' },
      ],
      [
        { id: 'bit', label: 'bit placed' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['1 after 0 zeros', 'value 3'],
        ['1 after 1 zero', 'value 5'],
        ['1 after 2 zeros', 'value 8'],
        ['1 after 3 zeros', 'value 13'],
        ['1 after 5 zeros', 'value 21'],
        ['1 after 8 zeros', 'value 34'],
      ],
    ),
    highlight: { found: ['h5:bit', 'h8:bit'], active: ['h0:meaning', 'h1:meaning'] },
    explanation: `The high stream is encoded by placing the i-th 1-bit at position high(i) + i across ${6} marker positions. Select on that bitvector recovers high(i).`,
  };

  yield {
    state: efGraph('Low bits plus select over high bits reconstruct every value'),
    highlight: { active: ['low', 'high', 'rankselect', 'access', 'e-low-access', 'e-high-rs', 'e-rs-access'], found: ['split'] },
    explanation: `The result is compressed but still searchable. The ${6} pipeline nodes show how rank/select structures make the high bitvector navigable instead of a pile of bits.`,
  };
}

function* queryOperations() {
  yield {
    state: labelMatrix(
      'Access value i',
      [
        { id: 'select', label: 'select1(i)' },
        { id: 'high', label: 'high = pos - i' },
        { id: 'low', label: 'read low[i]' },
        { id: 'merge', label: 'merge bits' },
      ],
      [
        { id: 'operation', label: 'operation' },
        { id: 'result', label: 'result' },
      ],
      [
        ['find i-th high marker', 'bit position'],
        ['subtract index', 'upper bits'],
        ['array lookup', 'lower bits'],
        ['high << l | low', 'original integer'],
      ],
    ),
    highlight: { active: ['select:operation', 'high:result', 'merge:result'], found: ['low:operation'] },
    explanation: `Random access is not full decompression. The ${4}-step process locates the i-th high marker via select1, reads the low part, and combines them.`,
  };

  yield {
    state: efGraph('Predecessor search skips through high blocks'),
    highlight: { active: ['rankselect', 'access'], found: ['high', 'low'], compare: ['list'] },
    explanation: `Search operations use the high bitvector to narrow the candidate region among ${6} nodes, then inspect lows inside that region. This is why Elias-Fano is useful inside indexes, not just archives.`,
  };

  yield {
    state: labelMatrix(
      'Where monotone compression appears',
      [
        { id: 'postings', label: 'postings list' },
        { id: 'graph', label: 'graph adjacency' },
        { id: 'column', label: 'column positions' },
        { id: 'log', label: 'log offsets' },
      ],
      [
        { id: 'sequence', label: 'sequence' },
        { id: 'query', label: 'query need' },
      ],
      [
        ['sorted doc ids', 'nextGEQ / intersection'],
        ['sorted neighbor ids', 'membership and traversal'],
        ['row ids with value', 'bitmap-like scans'],
        ['monotone byte offsets', 'random access'],
      ],
    ),
    highlight: { found: ['postings:sequence', 'postings:query'], compare: ['graph:query', 'log:query'] },
    explanation: `Elias-Fano is at home when ids are sorted and queries need skipping, predecessor, successor, or random access — the matrix shows ${4} domains where this applies.`,
  };

  yield {
    state: labelMatrix(
      'Tradeoff map',
      [
        { id: 'dense', label: 'dense values' },
        { id: 'sparse', label: 'sparse values' },
        { id: 'unsorted', label: 'unsorted list' },
        { id: 'updates', label: 'frequent updates' },
      ],
      [
        { id: 'effect', label: 'effect' },
        { id: 'response', label: 'response' },
      ],
      [
        ['small gaps', 'very compact'],
        ['large universe', 'more high/low bits'],
        ['not monotone', 'sort or choose another code'],
        ['static encoding hurts', 'batch rebuild or use dynamic index'],
      ],
    ),
    highlight: { active: ['dense:effect', 'unsorted:response'], found: ['updates:response'] },
    explanation: `The representation earns its power from sorted order. The tradeoff map covers ${4} scenarios — if the data is unsorted or changing constantly, the engineering answer may be a different structure.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'encode monotone list') yield* encodeMonotoneList();
  else if (view === 'query operations') yield* queryOperations();
  else throw new InputError('Pick an Elias-Fano view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation has two views. The encode view splits a sorted integer list into a low-bit array and a high bitvector. The query view shows how select1, access, and predecessor search recover values from the compressed layout.',
        {
          type: 'callout',
          text: 'Elias-Fano keeps sorted order visible: high bits become a searchable marker vector while low bits stay directly addressable.',
        },
        {
          type: 'diagram',
          label: 'Color semantics across both views',
          text: 'Active (blue)   -- the element or bit currently being processed\nFound (green)    -- a recovered or matched value\nCompare (orange) -- structures being contrasted (low array vs. high bitvector)',
        },
        'In the encode view, watch each sorted value split into its bottom l bits (stored in the low array) and its upper bits (placed as a 1-marker in the high bitvector). The zeros before each marker encode how far the high part advanced since the last element.',
        'In the query view, the key operation is select1(i): find the i-th 1-bit in the high bitvector, subtract i to recover the high part, read lows[i], and combine. The search frames show why this is an index, not just a compressed byte string -- high bits narrow a region, lows finish the comparison, and sorted order stays usable.',
        {
          type: 'note',
          text: 'The example uses l = 2 so arithmetic stays visible. Real systems pick l from the universe-to-count ratio, often per partition. The same layout scales to millions of document ids because access touches one select structure and one packed low value.',
        },
        {type: 'image', src: './assets/gifs/elias-fano-encoding.gif', alt: 'Animated walkthrough of the elias fano encoding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Sorted integer lists appear everywhere: inverted-index postings, graph adjacency lists, column-store row ids, sparse bitmap positions, timestamp offsets, file block pointers. These lists hold millions of entries. Storing every value as a full 32-bit or 64-bit word wastes memory and cache.',
        'These lists are not write-once-read-sequential. A search engine needs access(i), nextGEQ(x), predecessor, successor, and fast intersection. A graph engine needs neighbor scans and membership tests. An analytics engine needs to skip to a specific row id. Compression that destroys navigation is useless here.',
        {
          type: 'quote',
          text: 'Quasi-succinct indices use roughly the information-theoretic minimum number of bits while supporting constant-time access.',
          attribution: 'Sebastiano Vigna, "Quasi-Succinct Indices" (WSDM 2013)',
        },
        'Elias-Fano resolves the tension between compression (fewer bits) and indexing (fast operations). It keeps enough structure exposed that the system can jump around inside the compressed representation without a full prefix decode.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing any engineer tries is a plain sorted array. It gives O(1) random access, O(log n) binary search, simple sequential scans, and trivial implementation. For small lists this is hard to beat.',
        'When space matters, the next move is delta coding: store the gap between consecutive values instead of the values themselves, then compress each gap with variable-byte or bit-packed encoding. Gap coding is strong for sequential scans and shrinks postings lists substantially.',
        {
          type: 'bullets',
          items: [
            'Plain sorted array: n * w bits (w = word width). O(1) random access, O(log n) binary search. Simple and cache-friendly, but space-hungry.',
            'Delta / varint coding: n * avg_gap_bits. Excellent compression, but access(i) requires decoding all i preceding gaps. No random access without skip tables.',
            'Bitmap: U bits (universe size). O(1) rank/select when augmented, but space is proportional to the universe, not the list. Wastes memory on sparse sets.',
          ],
        },
        'Each approach works well in its regime. The trouble starts when you need both compression and navigation on the same list.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Plain arrays waste space. Every value pays a full machine word even when gaps are small. For a postings list with 10 million document ids drawn from a universe of 100 million, a 32-bit array costs 40 MB. The information-theoretic minimum is closer to 5 MB.',
        'Delta coding saves space but kills random access. Recovering value i requires decoding every previous gap. Adding skip pointers every k entries restores partial navigation but introduces bookkeeping and loses the space advantage. The fundamental problem: gap codes destroy the positional structure that select and rank need.',
        {
          type: 'diagram',
          label: 'Gap coding forces sequential prefix decode',
          text: 'Sorted list:   [3,  5,  8, 13, 21, 34]\nGaps:           [3,  2,  3,  5,  8, 13]\n\naccess(4) = gap[0]+gap[1]+gap[2]+gap[3]+gap[4]\n          = 3 + 2 + 3 + 5 + 8 = 21\n\n--> Must decode 5 gaps to reach element 4.\n    With 10M elements, access(5M) decodes 5M gaps.',
        },
        'Bitmaps flip the problem: fast rank/select but space proportional to the universe, not the list. For sparse sets (n much less than U), a bitmap wastes orders of magnitude more than necessary.',
        {
          type: 'note',
          text: 'The wall is not "it does not scale." The wall is specific: gap codes lose O(1) positional access, plain arrays lose compression, and bitmaps lose space efficiency on sparse sets. Elias-Fano keeps all three.',
        },
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Every sorted integer has two parts: a slowly-growing upper portion and a noisy lower portion. Elias-Fano splits each value at a chosen bit boundary l. The upper bits form a nondecreasing sequence that compresses into a short unary bitvector. The lower bits are small enough to store directly in a packed array.',
        {
          type: 'callout',
          text: 'Split each sorted value into upper bits (compressed via unary coding because they are monotone) and lower bits (stored raw because they are small). The split turns one hard problem into two easy ones.',
        },
        'The key choice is l = floor(log2(U/n)), where U is the universe size and n is the element count. This balances the two components: the low array costs n * l bits, and the high bitvector costs roughly n + U/2^l bits. With l = floor(log2(U/n)), both terms are approximately n * log2(U/n), so neither dominates.',
        'The result is a representation that uses about n * log2(U/n) + 2n bits -- within 2n bits of the information-theoretic lower bound for encoding an n-element subset of {0, ..., U-1}. No other representation with O(1) access comes closer.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Split each value into low bits and high bits. The parameter l (number of low bits) controls the split.',
        {
          type: 'image',
          src: 'https://www.antoniomallia.it/uploads/Elias-Fano.png',
          alt: 'Diagram of an Elias Fano split into lower bits and upper bitvector',
          caption: 'The split layout stores low bits densely while upper bits become a navigable bitvector. Source: Antonio Mallia, https://www.antoniomallia.it/sorted-integers-compression-with-elias-fano-encoding.html',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Given: sorted list x[0] <= x[1] <= ... <= x[n-1], universe U\nChoose: l = floor(log2(U / n))  (balances low array and high bitvector)\n\nFor each x[i]:\n  low[i]  = x[i] mod 2^l          -- bottom l bits, stored in packed array\n  high[i] = floor(x[i] / 2^l)     -- upper bits, encoded in unary bitvector',
        },
        'The low array is straightforward: n entries of l bits each, packed contiguously. Reading lows[i] is a direct bit-offset calculation -- jump to bit position i * l and extract l bits.',
        'The high parts are nondecreasing (because the values are sorted). Encode them as a unary bitvector: place a 1-bit at position high(i) + i for each element i. Between consecutive 1-bits, zeros represent empty high buckets. The bitvector length is roughly n + U/2^l.',
        {
          type: 'diagram',
          label: 'High bitvector construction for [3, 5, 8, 13, 21, 34] with l = 2',
          text: 'Value:    3    5    8   13   21   34\nlow:      3    1    0    1    1    2     (bottom 2 bits)\nhigh:     0    1    2    3    5    8     (floor(value / 4))\n\nMarker position = high(i) + i:\n  i=0: 0+0=0    i=1: 1+1=2    i=2: 2+2=4\n  i=3: 3+3=6    i=4: 5+4=9    i=5: 8+5=13\n\nHigh bitvector (1 at marker positions, 0 elsewhere):\n  pos: 0  1  2  3  4  5  6  7  8  9 10 11 12 13\n  bit: 1  0  1  0  1  0  1  0  0  1  0  0  0  1',
        },
        'To access value i: compute p = select1(i) (the position of the i-th 1-bit), then high = p - i, read low = lows[i], and reconstruct value = (high << l) | low. No prefix decode required.',
        'To search for the first value >= x: split x into targetHigh and targetLow. Use select0 on the high bitvector to find the bucket boundary for targetHigh. Scan lows within that bucket. Implementations add sampling and partitioning to speed nextGEQ and predecessor.',
        {
          type: 'code',
          language: 'javascript',
          text: '// Access element i from Elias-Fano representation\nfunction access(i, highBV, lows, l) {\n  const p = select1(highBV, i);   // position of i-th 1-bit\n  const high = p - i;             // subtract index to undo unary offset\n  const low = readPacked(lows, i, l);  // l-bit value at position i\n  return (high << l) | low;\n}\n\n// Recover value at index 4:\n// select1(4) = 9, high = 9 - 4 = 5, low = lows[4] = 1\n// value = (5 << 2) | 1 = 20 | 1 = 21',
        },
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness rests on one invariant: sorted input makes the high stream nondecreasing, which makes marker positions strictly increasing.',
        {
          type: 'note',
          text: 'Invariant: value(i) = high(i) * 2^l + low(i), and marker positions high(i) + i are strictly increasing.',
        },
        'If two adjacent values share the same high part, adding the element index still pushes the second marker to a later position: marker(i+1) = high(i) + (i+1) = marker(i) + 1. If the high part increases, the marker jumps even further right. Either way, every element gets a unique bitvector position.',
        'Select1 turns an element index into its marker position. Rank1 counts how many markers appear up to a given position. Together they let the compressed high stream behave like a searchable ordered structure rather than an opaque bitstring.',
        'The low bits need no monotonicity-based compression because they are only l bits each. Storing them directly preserves O(1) access. The high bits are where sorted order pays off: nondecreasing values compress into a bitvector with n ones and roughly n zeros, navigable via rank/select.',
        {
          type: 'diagram',
          label: 'Why marker positions are strictly increasing',
          text: 'Element i:    high(i) is nondecreasing (sorted input)\n              i is strictly increasing (0, 1, 2, ...)\n\nmarker(i) = high(i) + i\n\nCase 1: high(i+1) = high(i)  -->  marker(i+1) = marker(i) + 1  (still increases)\nCase 2: high(i+1) > high(i)  -->  marker(i+1) > marker(i) + 1  (increases faster)\n\n--> Markers are always strictly increasing, so each has a unique bitvector position.',
        },
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Low array: n * l bits, where l = floor(log2(U/n)). Packed fixed-width entries.',
            'High bitvector: n + U/2^l bits. One 1-bit per element, zeros for empty buckets.',
            'Total space: n * log2(U/n) + 2n + o(n) bits. The o(n) term covers rank/select metadata.',
            'access(i): O(1) with constant-time select1.',
            'nextGEQ(x): O(1) amortized or O(log(U/n)), depending on select/rank implementation.',
            'Build: O(n). Single pass over sorted input.',
          ],
        },
        'The space bound n * log2(U/n) + 2n bits is within 2n bits of the information-theoretic minimum for representing an n-element subset of a universe of size U. The 2n additive term comes from the high bitvector carrying n 1-bits plus roughly n zeros.',
        {
          type: 'note',
          text: 'When n doubles, space roughly doubles (linear in n). When U doubles with n fixed, each value needs one more low bit, so total space grows by n bits. Dense lists (n close to U) get small high bitvectors; sparse lists (n much less than U) get longer low arrays.',
        },
        'Access is constant time when select is constant time, which requires an o(n)-bit auxiliary structure over the high bitvector. Search costs depend on bucket sizes and sampling. Dense buckets may require scanning several lows. Sparse buckets skip easily. Real performance depends on cache locality, branch prediction, and the workload mix of access versus sequential scan.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Elias-Fano wins on large, immutable, sorted integer sequences where both compression and navigation matter.',
        {
          type: 'image',
          src: 'https://iq.opengenus.org/content/images/2020/11/untitled--3--ink.png',
          alt: 'Inverted index diagram with terms pointing to document id lists',
          caption: 'Inverted-index postings lists are a natural home for monotone integer compression. Source: OpenGenus IQ, https://iq.opengenus.org/inverted-index/',
        },
        {
          type: 'bullets',
          items: [
            'Search-engine postings lists: millions of sorted document ids per term, queried via nextGEQ and intersection. Elias-Fano compresses each list while preserving skip-ahead without full decompression. Lucene adopted partitioned Elias-Fano for postings in 2015.',
            'Graph adjacency lists: sorted neighbor ids for each vertex. Compressed storage with iteration, successor search, and membership-like checks. WebGraph uses Elias-Fano for billion-edge web graphs.',
            'Column-store row positions: sparse columns store the row ids where a value appears. Elias-Fano provides bitmap-like scans at compressed size.',
            'Log and file offsets: monotone byte offsets into a log or archive. Random access to the i-th record without a separate index table.',
            'Inverted index intersection: two compressed postings lists can be intersected by alternating nextGEQ calls, never materializing the full lists.',
          ],
        },
        {
          type: 'code',
          language: 'text',
          text: '// Intersection of two Elias-Fano postings lists\n// (pseudocode -- never expands either list fully)\n\ni = 0; j = 0;\nwhile i < len(A) and j < len(B):\n  a = A.access(i)\n  b = B.access(j)\n  if a == b:\n    emit(a); i++; j++\n  elif a < b:\n    i = A.nextGEQ_index(b)   // skip inside compressed A\n  else:\n    j = B.nextGEQ_index(a)   // skip inside compressed B',
        },
        'The common pattern: the data is ordered, mostly static, and queried through access, skip, predecessor, or intersection rather than full sequential decompression.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Unsorted integers: the high-bit encoding requires monotonicity. Without sorted order the bitvector layout breaks. Sorting may change semantics.',
            'Frequent inserts and deletes: inserting in the middle shifts all subsequent marker positions. Deleting leaves holes. Mutable trees, skip lists, or LSM designs are better outer structures.',
            'Very dense sets (n close to U): a plain bitmap uses U bits with O(1) rank/select and no split overhead. Elias-Fano adds complexity for negligible compression gain.',
            'Tiny lists (n < 100): the overhead of the bitvector, select structure, and packed low array exceeds a plain sorted array. Measure before compressing.',
            'Scan-only workloads: SIMD-optimized delta or bit-packed gap codecs decompress sequentially faster because they avoid the select indirection.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'n close to U: use a plain bitmap + rank/select. The bitmap is already near-optimal; the split adds overhead.',
            'n < 100: use a sorted array. It fits in a cache line with no metadata cost.',
            'Sequential scan only: use SIMD varint or bit-packing. Branchless decode is faster than select for streaming.',
            'Frequent mutation: use a B-tree, skip list, or LSM. These provide amortized insert/delete.',
            'Unsorted data: use a hash set or sorted container. The monotonicity prerequisite is absent.',
          ],
        },
        {
          type: 'note',
          text: 'A common misconception is that Elias-Fano is just another gap codec. Gap codecs optimize for sequential decode speed. Elias-Fano optimizes for navigability: the high bitvector and select structure make it an index, not just a compression format.',
        },
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Encode the sorted list [2, 3, 5, 7, 11, 13, 24] into Elias-Fano form. The universe is U = 25 (values range from 0 to 24). There are n = 7 elements.',
        {
          type: 'code',
          language: 'text',
          text: 'Step 1: Choose l\n  l = floor(log2(U / n)) = floor(log2(25 / 7)) = floor(log2(3.57)) = floor(1.84) = 1\n  Each value splits at bit position 1: low = bottom 1 bit, high = remaining upper bits.',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Step 2: Split each value\n  Value   Binary   high (value >> 1)   low (value & 1)\n    2      010            1                 0\n    3      011            1                 1\n    5      101            2                 1\n    7      111            3                 1\n   11     1011            5                 1\n   13     1101            6                 1\n   24    11000           12                 0\n\nLow array (1 bit each): [0, 1, 1, 1, 1, 1, 0]  -->  7 bits total',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Step 3: Build the high bitvector\n  Marker position for element i = high(i) + i:\n    i=0: 1+0= 1     i=1: 1+1= 2     i=2: 2+2= 4\n    i=3: 3+3= 6     i=4: 5+4= 9     i=5: 6+5=11\n    i=6: 12+6=18\n\n  Place 1-bits at positions {1, 2, 4, 6, 9, 11, 18}, zeros elsewhere:\n  pos: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18\n  bit: 0  1  1  0  1  0  1  0  0  1  0  1  0  0  0  0  0  0  1\n\n  High bitvector length: 19 bits',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Step 4: Space accounting\n  Low array:       7 * 1 = 7 bits\n  High bitvector:  19 bits\n  Total:           26 bits\n\n  Plain 5-bit array: 7 * 5 = 35 bits\n  Savings:           35 - 26 = 9 bits (26% smaller)\n  Info-theoretic lower bound: floor(log2(C(25,7))) = floor(log2(480700)) ~ 19 bits\n  Elias-Fano overhead above lower bound: 26 - 19 = 7 bits = 2n = 2*7 - 7 = 7   (matches the 2n bound)',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Step 5: Access element 4 (should recover value 11)\n  select1(4) finds the 4th 1-bit (0-indexed) in the high bitvector.\n  The 1-bits are at positions: 1, 2, 4, 6, 9, ...\n  The 4th (0-indexed) is at position 9.\n\n  high = 9 - 4 = 5\n  low  = lows[4] = 1\n  value = (5 << 1) | 1 = 10 | 1 = 11   ✓',
        },
        {
          type: 'code',
          language: 'text',
          text: 'Step 6: nextGEQ(6) -- find first value >= 6\n  targetHigh = floor(6 / 2) = 3\n  targetLow  = 6 mod 2 = 0\n\n  Find the first element with high >= 3.\n  Use select0(3) to find the start of bucket 3 in the high bitvector.\n  select0(3) = position 5 (the 3rd 0-bit, 0-indexed).\n  The next 1-bit after position 5 is at position 6 --> element index = 6 - 3 = 3.\n  Element 3: high = 3, low = lows[3] = 1, value = (3 << 1) | 1 = 7.\n  7 >= 6, so nextGEQ(6) = 7.   ✓',
        },
        'This example shows the full round trip: split, encode, access, and search. With l = 1 the savings are modest (26 vs. 35 bits), but the same structure on a list of 10 million document ids from a 100-million universe uses l = floor(log2(10)) = 3, saving roughly 60% over a 27-bit plain array while keeping O(1) access.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Prerequisite -- Rank/Select Bitvector: Elias-Fano depends on select1 for access and rank for bucket navigation. Understand these primitives first.',
            'Extension -- Partitioned Elias-Fano: Ottaviano and Venturini (SIGIR 2014) split lists into chunks with local universes, improving cache locality. Used in Lucene and PISA.',
            'Alternative -- Roaring Bitmaps: compressed bitmap with containers for mixed-density integer sets. Different tradeoff surface: faster set operations, but no ordered-access guarantee.',
            'Alternative -- Delta Bit Packing: SIMD-friendly gap encoding optimized for sequential scan throughput. Faster streaming but no random access.',
            'Application -- Inverted Index: the primary consumer of Elias-Fano in production search engines.',
            'Deeper theory -- Wavelet Tree / FM-Index: succinct structures that use rank/select for richer queries over general sequences, not just monotone integers.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Peter Elias, "Efficient Storage and Retrieval by Content and Address of Static Files" (1974) -- the original two-part encoding for monotone sequences.',
            'Robert Fano, "On the Number of Bits Sufficient to Implement an Associative Memory" (1971) -- the complementary space analysis.',
            'Sebastiano Vigna, "Quasi-Succinct Indices" (WSDM 2013) -- modern practical treatment with broadword select and benchmark results.',
            'Giuseppe Ottaviano and Rossano Venturini, "Partitioned Elias-Fano Indexes" (SIGIR 2014) -- partitioned variant used in production search engines.',
          ],
        },
        'Carry one question into each follow-up: does the encoding preserve the operation the system needs, or did it only save space?',
      ],
    },
  ],
};
