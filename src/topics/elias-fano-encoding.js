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
      heading: 'What it is',
      paragraphs: [
        'Elias-Fano encoding is a succinct representation for monotone integer sequences. Monotone means the numbers are sorted and never decrease. That sounds narrow, but sorted integers are everywhere: search-engine postings lists, graph adjacency lists, row-id lists in analytics systems, compressed bitmaps, and offsets into large files. The representation splits each value into high bits and low bits, stores the low bits directly, and stores the high bits in a unary bitvector that supports select.',
        'Sebastiano Vigna popularized Elias-Fano in modern inverted indexes through quasi-succinct indexes: https://vigna.di.unimi.it/ftp/papers/QuasiSuccinctIndices.pdf. Partitioned Elias-Fano indexes further improve compression and query tradeoffs for postings lists: https://dl.acm.org/doi/10.1145/2600428.2609615.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Suppose the sequence has n integers drawn from a universe up to U. Choose a number l of low bits, often around floor(log2(U/n)). For each value x, store low(x) as the bottom l bits and high(x) as the remaining upper bits. The low parts form a plain packed array. The high parts are nondecreasing, so the i-th high value can be encoded by setting a 1-bit at position high(i) + i in a bitvector.',
        'To recover value i, run select1(i) on the high bitvector. If the selected position is p, then high(i) = p - i. Read low[i] from the low array, then combine high and low. Rank/select is the primitive that makes this compressed layout usable. Without it, the high bitvector would have to be scanned linearly.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Space is close to n * log2(U/n) + 2n bits, plus lower-order indexing overhead for rank/select. Access can be constant time with a suitable select structure. Predecessor, successor, and nextGEQ-style operations are efficient because high bits narrow the region and lows finish the comparison. This is exactly the shape needed by search engines that intersect sorted postings lists.',
        'The tradeoff is update behavior. Elias-Fano is usually used for immutable or batched segments. Inserting one value into the middle of a packed monotone encoding is not cheap. Systems such as Lucene-like indexes solve this by writing new immutable segments and merging them later.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Take an inverted index for the term database. The postings list might contain millions of sorted document ids. A query for database AND replication needs to intersect two sorted lists. Elias-Fano compresses each postings list while preserving fast access and skipping. The query engine can jump to the next candidate doc id, reconstruct values as needed, and avoid inflating the whole list into memory.',
        'The same design generalizes to social graphs. A user id maps to a sorted neighbor list. Elias-Fano compresses neighbor ids and still supports membership-like checks, iteration, and successor search. The compression win matters because graph and search workloads often spend more money moving postings and adjacency lists through memory than doing arithmetic.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Elias-Fano is not a general-purpose integer compressor for arbitrary order. It needs monotone order. It is also not automatically the fastest representation for every density. Dense sets may prefer bitmaps or Roaring Bitmaps. Tiny lists may prefer plain arrays. Frequently updated lists may prefer a mutable index plus periodic compaction. The right choice depends on density, query mix, update pattern, and cache behavior.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Quasi-Succinct Indices at https://vigna.di.unimi.it/ftp/papers/QuasiSuccinctIndices.pdf, Partitioned Elias-Fano indexes at https://dl.acm.org/doi/10.1145/2600428.2609615, and lecture slides by Ottaviano and Venturini at https://jermp.github.io/assets/pdf/slides/elias-fano.pdf. Study Rank/Select Bitvector, Inverted Index, Wavelet Tree, Roaring Bitmaps, FM-Index, and Lucene Segments Case Study next.',
      ],
    },
  ],
};
