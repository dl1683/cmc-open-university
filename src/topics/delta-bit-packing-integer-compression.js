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
      heading: 'Why this exists',
      paragraphs: [
        'Search engines, column stores, graph systems, and time-series databases move enormous integer arrays through CPU caches. Raw 32-bit or 64-bit values waste bandwidth when the values are sorted, nearby, or regularly spaced. Delta bit-packing exists to make those arrays smaller without making query-time decoding slow.',
        {type: 'callout', text: 'Delta bit-packing wins by turning smooth integer runs into narrow local codes that fit the memory hierarchy better than raw machine words.'},
        'The central resource is memory bandwidth. If a query can read half as many bytes and decode them predictably, it may run faster even after paying CPU instructions for unpacking. Compression and execution are part of the same design.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first approach stores each integer in a machine word. That is simple and supports direct indexing. It becomes wasteful for sorted document ids, timestamps, offsets, dictionary codes, and adjacency lists whose local gaps are much smaller than their absolute values.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Rotate_left_logically.svg/250px-Rotate_left_logically.svg.png', alt: 'Bit positions moving through a logical rotate operation', caption: 'Packed codecs live at the bit-position level: shifts, masks, and lane movement replace wasteful fixed-width storage. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Rotate_left_logically.svg/250px-Rotate_left_logically.svg.png'},
        'The opposite approach is to use a general compressor around the whole file. That may save space at rest, but it often forces large decompression units and does not give the query engine cheap access to the next block of ids or timestamps.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'General compression can shrink bytes but add branches, tables, and serial dependencies. Query engines need predictable decode, skipping, vectorization, and block-level access. The wall is not just compression ratio; it is compression that still belongs on the hot path.',
        'A search engine intersecting postings lists may decode millions of integers only to discard most of them. A column store may decode a block to apply a filter. In both cases, the codec has to cooperate with scans and skips instead of behaving like an opaque blob.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Transform large integers into small local codes, then pack those codes back-to-back. Frame-of-reference subtracts a block base. Delta coding stores gaps. Delta-of-delta stores changes in gaps. The encoder then chooses the bit width needed by the largest code in the block.',
        'The transform is reversible and local. A decoder does not need a statistical model or a dictionary learned elsewhere; it needs the block metadata and the packed bits. That simplicity is why these codecs remain common in systems that care about predictable latency.',
      ],
    },
    {
      heading: 'Mechanism',
      paragraphs: [
        'In the frame-of-reference view, look for the moment large absolute values become small local codes. That transform is the compression. Bit-packing only cashes in after the transform has exposed smaller numbers.',
        'In the exceptions view, watch the outlier. One large value can force a whole block to use too many bits. Patched schemes keep the common path fast and store exceptional values separately.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For frame-of-reference, store a base such as the block minimum and replace x with x - base. If the largest offset is 14, every offset fits in 4 bits. For deltas, store the first value and then gaps. Patched schemes keep a small main width and store outlier positions plus extra bits separately.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row-major and column-major memory layout diagrams', caption: 'Memory layout matters because packed integer blocks are designed to be decoded in cache-friendly contiguous runs. Source: https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg'},
        'The decoder reverses a tiny contract: decode codes at the block width, restore exceptions if the format has them, then add the base or compute the prefix sum. Search systems design that contract around the query path because decoded integers often feed intersections, filters, joins, or vectorized scans immediately.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Sorted or locally smooth sequences have lower entropy after differencing or base subtraction. Bit-packing then removes unused high bits while preserving exact reconstruction: add the base back, or take the running sum of deltas. Exceptions keep one large value from forcing the whole block to a wasteful width.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/0...15_AND.svg/250px-0...15_AND.svg.png', alt: 'Bitwise AND operation over four-bit values from zero to fifteen', caption: 'Masks are the decoder counterpart to packing: they recover fixed-width fields from dense bit streams. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/0...15_AND.svg/250px-0...15_AND.svg.png'},
        'It also works with CPU architecture. Packed blocks use straight-line shifts and masks, often vectorized. The best implementations are designed so the decoder can run in tight loops with few unpredictable branches.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Encoding scans a block to compute bases, deltas, widths, and exceptions. Decoding is linear and tuned around shifts, masks, table lookups, or SIMD. Random access inside a packed block is less direct than a plain array, so many systems decode blocks because scans, filters, and intersections dominate.',
        'Block size is a tradeoff. Larger blocks amortize metadata and improve compression when values are smooth, but one outlier has wider impact and random access gets coarser. Smaller blocks adapt to local changes but pay more headers and more loop overhead.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Parquet uses RLE/bit-packing and delta encodings inside data pages. Lucene uses packed integer blocks for postings and numeric data. Gorilla-style time-series compression uses delta-of-delta timestamps. FastPFOR and SIMD-BP128-style codecs target billions of decoded integers per second when memory bandwidth is the bottleneck.',
        'Graph engines use the same idea for adjacency lists when node ids are sorted. Analytics systems use it for dictionary-encoded columns. Metrics systems use it for timestamps. The shared condition is local regularity: nearby values have small differences.',
      ],
    },
    {
      heading: 'Worked production example',
      paragraphs: [
        'A search index stores a postings list for the word "cache": document ids 1000, 1003, 1004, 1012, and many more. Storing every id as 32 bits wastes space because the ids are sorted and close together. The codec stores a base and small gaps or offsets instead.',
        'At query time, the postings intersection loop decodes one block, compares doc ids with another postings list, and skips ahead when possible. The codec is successful only if this whole loop is faster or smaller, not merely if the compressed file is pretty.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Random integers across the full range do not compress much. One outlier can raise block width unless patched. A denser but branchy codec can slow the query engine. Storage systems care about bytes, CPU, branch predictability, vectorization, skip support, and update granularity together.',
        'It also fails when updates are frequent and in-place mutation is required. Packed blocks are happiest as immutable or append-oriented data. Changing one value can require rewriting a block because the maximum width, exception list, or delta chain may change.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'For values 1000, 1003, 1004, 1012, and 1014, frame-of-reference stores base 1000 and offsets 0, 3, 4, 12, 14. The largest offset is 14, so four bits per value are enough. Five 32-bit integers become a base plus 20 packed bits in the toy version.',
        'With delta coding, the same sequence becomes 1000, 3, 1, 8, 2. The decoder rebuilds by prefix sum. That is why sorted document ids and timestamps compress well: their gaps are usually much smaller than their absolute values.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Choose the unit of compression deliberately: page, block, posting-list chunk, time-series segment, or column batch. The block size controls metadata overhead, vectorization, random access, and how much damage one outlier can do.',
        'Keep metadata close to the packed data: base value, count, bit width, exception count, exception positions, and any delta mode. A decoder should be able to skip or decode a block without consulting scattered side structures.',
        'Benchmark the actual query path. Measure decode throughput, filter throughput, branch misses, cache behavior, and tail latency for representative data. The best ratio on a synthetic file may lose once the decoded integers feed joins or postings intersections.',
      ],
    },
    {
      heading: 'Rule of thumb',
      paragraphs: [
        'Use delta or frame-of-reference packing when nearby integers are much closer together than their absolute values suggest. Sorted ids, monotonically increasing timestamps, offsets, and dictionary codes are natural fits.',
        'Switch to patched, variable, or plain encodings when local smoothness breaks. Compression should make the hot path simpler or cheaper. If it creates branchy exception handling on every query, it may be optimizing the wrong number.',
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
