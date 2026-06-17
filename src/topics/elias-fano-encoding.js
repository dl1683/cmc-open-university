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
    explanation: 'Elias-Fano works because the input is monotone. Sorted document ids, graph neighbor ids, and timestamp offsets have order that ordinary variable-byte coding does not fully exploit.',
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
    explanation: 'Choose l lower bits. Store the low parts directly. The high parts are nondecreasing, so they can be stored compactly as a unary bitvector.',
    invariant: 'value(i) = high(i) * 2^l + low(i).',
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
    explanation: 'The high stream is encoded by placing the i-th 1 at position high(i) + i. Select on that bitvector recovers high(i).',
  };

  yield {
    state: efGraph('Low bits plus select over high bits reconstruct every value'),
    highlight: { active: ['low', 'high', 'rankselect', 'access', 'e-low-access', 'e-high-rs', 'e-rs-access'], found: ['split'] },
    explanation: 'The result is compressed but still searchable. Rank/select structures make the high bitvector navigable instead of a pile of bits.',
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
    explanation: 'Random access is not full decompression. You locate the i-th high marker, read the low part, and combine them.',
  };

  yield {
    state: efGraph('Predecessor search skips through high blocks'),
    highlight: { active: ['rankselect', 'access'], found: ['high', 'low'], compare: ['list'] },
    explanation: 'Search operations use the high bitvector to narrow the candidate region, then inspect lows inside that region. This is why Elias-Fano is useful inside indexes, not just archives.',
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
    explanation: 'Elias-Fano is at home when ids are sorted and queries need skipping, predecessor, successor, or random access.',
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
    explanation: 'The representation earns its power from sorted order. If the data is unsorted or changing constantly, the engineering answer may be a different structure.',
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
      heading: `Why This Exists`,
      paragraphs: [
        `Elias-Fano encoding exists for a specific but common shape: a sorted list of nonnegative integers drawn from a known universe. That shape appears in inverted-index postings, graph adjacency lists, sparse bitmap positions, column-store row ids, timestamp offsets, version positions, and file block offsets. These lists can be enormous, and storing every value as a 32-bit or 64-bit integer wastes memory and cache.`,
        `The list is usually not just stored for later decompression. A search engine still needs access(i), nextGEQ(x), predecessor, successor, and fast intersection. A graph engine may need to scan neighbors and test membership. An analytics engine may need to skip to the next row id. Elias-Fano is useful because it compresses a monotone sequence while preserving navigation.`,
        `This is the design tension: ordinary compression wants fewer bits, while an index wants operations. A byte string that saves space but forces a full prefix decode for every query may be slower overall than a larger array. Elias-Fano keeps enough structure exposed that the system can jump around inside the compressed representation.`,
      ],
    },
    {
      heading: `The Baseline And The Wall`,
      paragraphs: [
        `The naive baseline is a plain sorted array. It gives direct random access, binary search, simple scans, and easy implementation. Its cost is space: every value pays a full machine-word width even when the list is dense or the gaps are small. For postings lists and adjacency lists, memory movement can dominate arithmetic.`,
        `Delta coding improves space by storing gaps between consecutive values. Variable-byte, varint, and bit-packed gap encodings are strong for sequential scans. The wall is random access and skipping. If recovering value i requires decoding every previous gap, compression has moved cost from memory to query time. Indexes need to jump, skip, and intersect; they cannot afford long prefix decodes for every probe.`,
        `Bitmaps are another baseline. They support membership and rank-like operations well when the universe is dense, but they can waste space for sparse sets. Roaring Bitmaps handle density changes with containers. Elias-Fano sits in a different part of the design space: sorted monotone sequences with useful navigation and near-optimal space for many densities.`,
      ],
    },
    {
      heading: `Core Insight And Invariant`,
      paragraphs: [
        `The core insight is to split each value into low bits and high bits. The low bits are noisy, so store them directly in a packed array. The high parts are nondecreasing because the original values are sorted, so encode them as positions of 1 bits in a unary bitvector. This turns monotonicity into space savings without losing element order.`,
        `The invariant is exact reconstruction: value(i) = high(i) * 2^l + low(i). The bitvector places the i-th high marker at position high(i) + i. Adding i is the trick that makes equal high values distinct. Because high(i) never decreases and i strictly increases, marker positions strictly increase. select1(i) can recover the marker for element i, and marker - i gives high(i).`,
        `Choosing l controls the split. A common choice is near floor(log2(U / n)), where U is the universe size and n is the number of values. More low bits make the low array larger but shorten the high bitvector. Fewer low bits shrink the low array but expand the high side. The formula balances these costs for the list's density.`,
      ],
    },
    {
      heading: `Visualization Guide`,
      paragraphs: [
        `In the encode view, watch the sorted ids move through the split. The low-bit array is the easy half: it keeps the bottom l bits for each element in the same order as the input. The high bitvector is the compressed order skeleton: each 1 marks one element, and the zeros before it encode how far the high part has advanced.`,
        `In the query view, the important operation is select1. Selecting the i-th 1 gives the encoded high marker for element i; subtracting i removes the unary offset and recovers the stored high value. Search frames show why the representation is more than a small byte string: high bits narrow a region, lows finish the comparison, and the original sorted order is still usable.`,
        `The example uses l = 2 so the arithmetic is visible. Real systems choose l from the universe-to-count ratio, often per block or partition. The animation is small, but the same layout scales to millions of document ids or graph neighbors because access touches one select structure and one packed low value.`,
      ],
    },
    {
      heading: `How It Works`,
      paragraphs: [
        `For n values from universe U, choose l low bits. For each value x, store low(x) = x mod 2^l in lows[i]. Store high(x) = floor(x / 2^l), but not as an ordinary array. Instead, set a 1 in the high bitvector at position high(i) + i. The bitvector length is roughly n + floor(U / 2^l), because it contains one marker per value plus zeros representing high buckets.`,
        `To access value i, compute p = select1(i), high = p - i, and low = lows[i]. The reconstructed value is (high << l) | low. This is random access without decoding the previous i - 1 values. The low array is a packed fixed-width array, so reading lows[i] is direct. The high side depends on a select data structure over the bitvector.`,
        `To search for a value x, split x into targetHigh and targetLow. The high bitvector can identify the range of elements whose high part equals targetHigh, or the first marker at or after that high bucket. Then the search checks lows and reconstructed values in that narrowed range. Implementations add sampling, partitioning, or auxiliary indexes to speed nextGEQ and predecessor operations.`,
      ],
    },
    {
      heading: `Why It Works`,
      paragraphs: [
        `It works because sorted values make the high stream monotone. If two adjacent values have the same high part, adding the index places their markers in consecutive or later positions. If the high part increases, the marker moves even farther right. The result is a strictly increasing marker sequence, which can be represented as 1 bits in a bitvector.`,
        `Rank and select make the bitvector navigable. Select turns an element index into its marker position. Rank counts how many markers appear up to a high bucket. Together they let the compressed high stream behave like a searchable ordered structure rather than an opaque bitstring.`,
        `The low bits do not need compression through monotonicity because they are only l bits each. Storing them directly is what preserves fast access. The high bits are where sorted order pays off. Elias-Fano is powerful because it compresses the part that has order and leaves the small unordered part addressable.`,
      ],
    },
    {
      heading: `Worked Example`,
      paragraphs: [
        `Take the sorted list [3, 5, 8, 13, 21, 34] and choose l = 2. The low parts are the bottom two bits: [3, 1, 0, 1, 1, 2]. The high parts are floor(value / 4): [0, 1, 2, 3, 5, 8].`,
        `The marker positions are high(i) + i: 0, 2, 4, 6, 9, 13. To recover the value at index 4, select1(4) returns 9, so high = 9 - 4 = 5. lows[4] is 1. The value is 5 * 4 + 1 = 21.`,
        `For a search example, ask for the first value at least 20. Split 20 with l = 2: high = 5, low = 0. The high bitvector points to the bucket where high part 5 begins. The candidate with high 5 has low 1, reconstructing 21, so the answer is 21. A plain gap-coded stream might have to decode several earlier gaps to reach the same point.`,
      ],
    },
    {
      heading: `Operations`,
      paragraphs: [
        `access(i) is the simplest operation: select marker i, subtract i, read lows[i], and combine. nextGEQ(x) is the operation search engines care about: find the first encoded value greater than or equal to x. Implementations use high buckets to skip to a narrow candidate range, then compare lows. predecessor and successor are similar.`,
        `Intersection of postings lists uses nextGEQ repeatedly. If one list has a candidate document id, the other list can skip to that id or beyond. Elias-Fano helps because skipping does not require expanding the whole postings list. The representation can remain compressed while still supporting query-time movement.`,
        `Rank-like operations are also useful. If the high bitvector can count how many values have high part less than h, the search can jump to the beginning of a bucket. Select-like operations recover exact positions. The supporting bitvector index is therefore part of the data structure, not an optional afterthought.`,
      ],
    },
    {
      heading: `Cost And Tradeoffs`,
      paragraphs: [
        `Space is close to n * log2(U / n) + 2n bits, plus metadata for rank and select. This is attractive for sparse monotone lists because it approaches the information-theoretic shape while keeping operations. The low array costs n * l bits. The high bitvector costs about n plus U / 2^l bits before select metadata.`,
        `Access is constant time when select is constant time. Search costs depend on bucket sizes, sampling, and partitioning. Dense buckets may require scanning several lows. Sparse buckets are easy to skip. The real performance question is not only asymptotic; it is cache locality, branch behavior, memory bandwidth, and how often the query needs access versus sequential scan.`,
        `Updates are the weak point. Inserting in the middle changes indices and marker positions. Deleting can leave holes unless the structure is rebuilt or wrapped in another layer. This is why Elias-Fano often appears inside immutable segments, compressed blocks, or periodically rebuilt indexes rather than as a highly mutable online set.`,
      ],
    },
    {
      heading: `Implementation Guidance`,
      paragraphs: [
        `Keep the contract explicit: values must be nonnegative, sorted, and within a known universe bound. Decide whether duplicates are allowed; some uses encode nondecreasing sequences, while set-like uses expect strictly increasing values. Validate this at build time because one out-of-order value breaks the high-bit invariant.`,
        `Choose l per list or per partition rather than assuming one global value is always good. Real postings lists can have dense and sparse regions. Partitioned Elias-Fano encodes chunks separately so each chunk can use a better local universe and density. It also improves locality because query operations touch a smaller block.`,
        `Build the rank/select layer deliberately. A simple bitvector without select turns random access into scanning. Broadword tricks, sampled select positions, superblocks, and popcount support are common implementation tools. Also measure against alternatives: plain arrays for tiny lists, bitmaps for dense sets, Roaring containers for mixed densities, and SIMD gap codecs for scan-heavy workloads.`,
      ],
    },
    {
      heading: `Where It Wins`,
      paragraphs: [
        `Elias-Fano wins on large immutable monotone sequences where both space and navigation matter. Search postings are the classic case: sorted document ids must be intersected and skipped without inflating every list. Graph adjacency lists are another case, especially when neighbor ids are sorted and graph traversal touches many lists.`,
        `It also fits analytic indexes that store row positions, sparse columns, monotone offsets, and timestamp or block positions. The common theme is that the data is ordered, mostly static, and queried through access, skip, predecessor, successor, or intersection rather than only full decompression.`,
      ],
    },
    {
      heading: `Where It Fails`,
      paragraphs: [
        `It fails as a general-purpose compressor for unsorted integers. Sorting may change semantics, and without monotonicity the high-bit encoding does not work. It also fails when arbitrary inserts and deletes are the main workload. A mutable tree, skip list, B-tree, or log-structured segment design may be a better outer structure.`,
        `It may lose to bitmaps when the set is very dense, to plain arrays when the list is tiny, and to SIMD gap codecs when the workload is mostly sequential scan. The right choice depends on density, query mix, update pattern, CPU cache behavior, and whether the system needs random access or only streaming.`,
      ],
    },
    {
      heading: `Complete Case Study`,
      paragraphs: [
        `Consider an inverted index for the term "database." The postings list may contain millions of sorted document ids. A query for "database replication" intersects two sorted lists. Elias-Fano compresses each list while preserving the ability to skip to the next candidate id. The query engine can run nextGEQ on one compressed list based on a candidate from the other list, compare reconstructed ids, and avoid allocating the full postings list.`,
        `The same idea applies to a social graph. Store each user's neighbor ids sorted. Elias-Fano compresses the neighbor list and still allows iteration, successor search, and membership-like checks. If the graph is updated in batches, segments can be rebuilt periodically. If it changes on every request, a mutable front buffer plus compressed immutable base may be a better hybrid.`,
      ],
    },
    {
      heading: `Common Misconceptions`,
      paragraphs: [
        `The first misconception is that Elias-Fano is just another gap codec. Gap codecs are often optimized for sequential decode. Elias-Fano is designed to keep navigation available. The high bitvector and select structure are what make it an index representation, not just a compression format.`,
        `The second misconception is that smaller is always faster. A compressed structure can lose if every query pays extra branches, cache misses, or scans inside large buckets. Benchmark with the real operation mix: access, nextGEQ, intersection, full scan, and build time. The third misconception is that the universe bound is a detail. It controls l, high-bitvector size, and correctness of the encoding.`,
      ],
    },
    {
      heading: `Study Next`,
      paragraphs: [
        `Study Rank/Select Bitvector next, because Elias-Fano depends on select for random access and rank for bucket navigation. Then study Inverted Index, Roaring Bitmaps, Delta Bit Packing, Wavelet Tree, FM-Index, and Lucene Segments Case Study to see how compressed monotone sequences become real query-engine components.`,
        `Useful primary sources include Vigna's Quasi-Succinct Indices, Ottaviano and Venturini on partitioned Elias-Fano indexes, and lecture material on succinct data structures. Carry one question into each follow-up topic: does the encoding preserve the operation the system needs, or did it only save space?`,
      ],
    },
  ],
};
