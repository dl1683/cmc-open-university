// Delta and bit-packing: turn large nearby integers into small offsets, choose
// a bit width for a block, then pack many values into dense machine words.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'delta-bit-packing-integer-compression',
  title: 'Delta Bit-Packing Integer Compression',
  category: 'Data Structures',
  summary: 'Compress integer blocks for search and analytics: subtract a base or previous value, choose the needed bit width, and pack dense streams for fast decode.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['frame of reference', 'exceptions and systems'], defaultValue: 'frame of reference' },
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

function packFlow(title) {
  return graphState({
    nodes: [
      { id: 'ints', label: 'ints', x: 0.8, y: 3.2, note: 'sorted block' },
      { id: 'delta', label: 'delta', x: 2.7, y: 3.2, note: 'small gaps' },
      { id: 'width', label: 'width', x: 4.6, y: 3.2, note: 'bits/value' },
      { id: 'pack', label: 'pack', x: 6.5, y: 3.2, note: 'bit stream' },
      { id: 'decode', label: 'decode', x: 8.4, y: 3.2, note: 'scan fast' },
    ],
    edges: [
      { id: 'e-ints-delta', from: 'ints', to: 'delta' },
      { id: 'e-delta-width', from: 'delta', to: 'width' },
      { id: 'e-width-pack', from: 'width', to: 'pack' },
      { id: 'e-pack-decode', from: 'pack', to: 'decode' },
    ],
  }, { title });
}

function* frameOfReference() {
  yield {
    state: packFlow('Compression starts by making integers small'),
    highlight: { active: ['delta', 'width'], found: ['pack', 'decode'] },
    explanation: 'Integer compression for indexes and column stores often starts with a block of nearby values. Subtract a base or previous value, then most numbers need far fewer bits.',
    invariant: 'Transform first, then pack; decoding reverses the transform.',
  };

  yield {
    state: labelMatrix(
      'Frame of reference block',
      [
        { id: 'v0', label: '1000' },
        { id: 'v1', label: '1003' },
        { id: 'v2', label: '1004' },
        { id: 'v3', label: '1012' },
        { id: 'v4', label: '1014' },
      ],
      [
        { id: 'offset', label: 'x - 1000' },
        { id: 'bits', label: 'bits needed' },
      ],
      [
        ['0', '0'],
        ['3', '2'],
        ['4', '3'],
        ['12', '4'],
        ['14', '4'],
      ],
    ),
    highlight: { active: ['v3:offset', 'v4:offset'], found: ['v4:bits'] },
    explanation: 'Instead of storing five 32-bit integers, store base = 1000 and offsets. The largest offset is 14, so this toy block needs only 4 bits per value.',
  };

  yield {
    state: labelMatrix(
      'Delta coding',
      [
        { id: 'x0', label: '1000' },
        { id: 'x1', label: '1003' },
        { id: 'x2', label: '1004' },
        { id: 'x3', label: '1012' },
        { id: 'x4', label: '1014' },
      ],
      [
        { id: 'delta', label: 'delta' },
        { id: 'rebuild', label: 'prefix sum' },
      ],
      [
        ['1000', '1000'],
        ['3', '1003'],
        ['1', '1004'],
        ['8', '1012'],
        ['2', '1014'],
      ],
    ),
    highlight: { active: ['x1:delta', 'x2:delta', 'x4:delta'], found: ['x4:rebuild'] },
    explanation: 'Delta coding stores differences from the previous value. Decoding uses a running sum. It is excellent for sorted ids, timestamps, and offsets with small gaps.',
  };

  yield {
    state: labelMatrix(
      'Packed width decision',
      [
        { id: 'max', label: 'max delta' },
        { id: 'width', label: 'bit width' },
        { id: 'block', label: 'block cost' },
        { id: 'decode', label: 'decode loop' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'meaning', label: 'meaning' },
      ],
      [
        ['14', 'largest code'],
        ['4 bits', 'fits 0..15'],
        ['5*4 bits', 'plus metadata'],
        ['unpack + add', 'streaming'],
      ],
    ),
    highlight: { found: ['width:value', 'block:value'], active: ['decode:meaning'] },
    explanation: 'Bit-packing is simple but powerful: choose one width for the block, place codes back-to-back, and decode with shifts, masks, or SIMD kernels.',
  };

  yield {
    state: packFlow('Fast codecs optimize the hot decode loop'),
    highlight: { active: ['width', 'pack', 'decode'], found: ['delta'], compare: ['ints'] },
    explanation: 'Search engines and analytics engines care about decode speed as much as bytes. A slightly larger block that decodes with predictable vectorized operations can beat a denser but branchy encoding.',
  };
}

function* exceptionsAndSystems() {
  yield {
    state: labelMatrix(
      'PFOR-style exception idea',
      [
        { id: 'normal', label: 'most values' },
        { id: 'outlier', label: 'outlier' },
        { id: 'main', label: 'main stream' },
        { id: 'patch', label: 'patch list' },
      ],
      [
        { id: 'choice', label: 'choice' },
        { id: 'result', label: 'result' },
      ],
      [
        ['fit 5 bits', 'pack dense'],
        ['needs 13 bits', 'mark exception'],
        ['small width', 'fast scan'],
        ['positions+high bits', 'repair decode'],
      ],
    ),
    highlight: { active: ['normal:choice', 'main:choice'], compare: ['outlier:result'], found: ['patch:result'] },
    explanation: 'A single large delta can force a whole block to use a large bit width. Patched schemes keep the common width small and store outliers separately.',
    invariant: 'Compression format is a contract between encoder density and decoder speed.',
  };

  yield {
    state: labelMatrix(
      'System map',
      [
        { id: 'parquet', label: 'Parquet' },
        { id: 'lucene', label: 'Lucene' },
        { id: 'gorilla', label: 'Gorilla' },
        { id: 'fastpfor', label: 'FastPFOR' },
      ],
      [
        { id: 'pattern', label: 'pattern' },
        { id: 'job', label: 'job' },
      ],
      [
        ['RLE/bit-pack', 'column pages'],
        ['FOR blocks', 'postings/numerics'],
        ['delta-of-delta', 'timestamps'],
        ['SIMD packing', 'integer arrays'],
      ],
    ),
    highlight: { found: ['parquet:pattern', 'lucene:pattern'], active: ['gorilla:pattern', 'fastpfor:pattern'] },
    explanation: 'Different systems tune the same primitives for different access patterns: column scans, postings intersections, time-series ingestion, or raw integer-array decode speed.',
  };

  yield {
    state: labelMatrix(
      'Choosing a codec',
      [
        { id: 'sorted', label: 'sorted ids' },
        { id: 'repeats', label: 'repeats' },
        { id: 'timestamps', label: 'timestamps' },
        { id: 'random', label: 'random ints' },
      ],
      [
        { id: 'good fit', label: 'good fit' },
        { id: 'why', label: 'why' },
      ],
      [
        ['delta/FOR', 'small gaps'],
        ['RLE', 'long runs'],
        ['delta-of-delta', 'regular interval'],
        ['varint/plain', 'weak structure'],
      ],
    ),
    highlight: { found: ['sorted:good fit', 'timestamps:good fit'], compare: ['random:why'] },
    explanation: 'Compression wins when the transform exposes structure. If the integers are already random across the full range, no block codec can magically remove entropy. Base-128 Varint & ZigZag Encoding is the message-format cousin: it compresses each integer independently instead of choosing one packed width for a block.',
  };

  yield {
    state: packFlow('The whole block must be designed for the query path'),
    highlight: { active: ['ints', 'delta', 'pack'], found: ['decode'], compare: ['width'] },
    explanation: 'A database codec is not just storage. It decides how much data the CPU must unpack for filters, joins, intersections, skips, and vectorized scans.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'frame of reference') yield* frameOfReference();
  else if (view === 'exceptions and systems') yield* exceptionsAndSystems();
  else throw new InputError('Pick a delta-bit-packing view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Delta bit-packing is a family of integer-compression techniques used in search engines, column stores, time-series databases, and graph systems. The central move is to transform large integers into small integers before packing. Frame-of-reference subtracts a block base. Delta coding subtracts the previous value. Delta-of-delta coding subtracts the previous delta. Once values are small, the encoder chooses a bit width and packs many codes into dense machine words.',
        'This is not archive compression like gzip. It is query-path compression. The format must decode quickly, skip predictably, and often feed SIMD or vectorized operators. A few extra bits per integer can be worth it if decoding becomes branch-free and cache-friendly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For a frame-of-reference block, store a base such as the minimum value. Replace each integer x with x - base. If the largest offset is 14, every offset fits in 4 bits. For delta coding, store the first value and then gaps. Sorted document ids or timestamps often have small gaps, so the deltas fit in fewer bits than the raw 32-bit or 64-bit values.',
        'Patched frame-of-reference handles outliers. If most values fit in 5 bits but one needs 13 bits, the codec can keep a 5-bit main stream and store exception positions plus extra bits separately. Decoding unpacks the dense stream and patches the exceptions back in. Fast codecs tune block size, width selection, exception format, and SIMD layout together.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Encoding scans a block to compute the base, deltas, maximum code, and sometimes exception positions. Decoding is usually linear in the number of integers and optimized around shifts, masks, table lookups, or vector instructions. Random access inside a packed block is possible but less direct than plain arrays; many systems decode one block at a time because scans and intersections dominate.',
      ],
    },
    {
      heading: 'Complete case studies',
      paragraphs: [
        'Apache Parquet uses encodings such as RLE/bit-packing and delta encodings inside data pages, because analytical columns often contain repeated dictionary ids, small deltas, or monotone-ish values. Lucene uses frame-of-reference-style packed integer blocks in codecs for postings and numeric data, where decode speed affects every search query. Gorilla-style time-series compression uses delta-of-delta timestamps because most samples arrive at regular intervals.',
        'The FastPFOR and SIMD-BP128 line of work shows the performance target: compressed integer arrays can decode at billions of integers per second when the layout cooperates with modern CPUs. That matters for inverted indexes, OLAP scans, graph adjacency lists, and telemetry stores where memory bandwidth is often the bottleneck.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Bit-packing is not always smaller. One outlier can raise the block width unless exceptions are handled. Delta coding also assumes useful locality or sorted order; random integers do not compress much. Another mistake is optimizing only compression ratio. A denser format that is slow to decode can make a query engine worse. Storage systems care about bytes, CPU, branch predictability, vectorization, skip support, and update granularity at the same time.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Apache Parquet encodings at https://parquet.apache.org/docs/file-format/data-pages/encodings/, Lucene ForUtil API notes at https://lucene.apache.org/core/10_1_0/core/org/apache/lucene/codecs/lucene101/ForUtil.html, Lemire and Boytsov integer compression paper at https://arxiv.org/abs/1209.2137, FastPFOR library notes at https://github.com/fast-pack/FastPFOR, and Gorilla time-series paper at https://www.vldb.org/pvldb/vol8/p1816-teller.pdf. Study Base-128 Varint & ZigZag Encoding, Elias-Fano Encoding, Roaring Bitmaps, Inverted Index, Parquet Columnar Format Case Study, Block-Max WAND, and Prometheus TSDB Case Study next.',
      ],
    },
  ],
};
