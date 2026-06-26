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
  const pipelineNodes = 5;    // ints, delta, width, pack, decode
  const pipelineEdges = 4;    // edges in packFlow
  const blockSize = 5;        // number of values in the example block
  const baseValue = 1000;     // frame-of-reference base
  const maxOffset = 14;       // largest offset value
  const bitsNeeded = 4;       // bits to represent maxOffset
  const rawBitsPerInt = 32;   // original bits per integer
  const totalRawBits = blockSize * rawBitsPerInt;
  const totalPackedBits = blockSize * bitsNeeded;

  yield {
    state: packFlow('Compression starts by making integers small'),
    highlight: { active: ['delta', 'width'], found: ['pack', 'decode'] },
    explanation: `Integer compression for indexes and column stores often starts with a block of nearby values. The ${pipelineNodes}-stage pipeline subtracts a base or previous value, then most numbers need far fewer than ${rawBitsPerInt} bits.`,
    invariant: `Transform first, then pack across all ${pipelineEdges} edges; decoding reverses the transform.`,
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
    explanation: `Instead of storing ${blockSize} ${rawBitsPerInt}-bit integers, store base = ${baseValue} and offsets. The largest offset is ${maxOffset}, so this toy block needs only ${bitsNeeded} bits per value.`,
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
    explanation: `Delta coding stores differences from the previous value across all ${blockSize} entries. Decoding uses a running sum to reconstruct the original ${rawBitsPerInt}-bit integers.`,
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
    explanation: `Bit-packing is simple but powerful: choose one ${bitsNeeded}-bit width for the block of ${blockSize} values, place codes back-to-back into ${totalPackedBits} packed bits, and decode with shifts, masks, or SIMD kernels.`,
  };

  yield {
    state: packFlow('Fast codecs optimize the hot decode loop'),
    highlight: { active: ['width', 'pack', 'decode'], found: ['delta'], compare: ['ints'] },
    explanation: `Search engines and analytics engines care about decode speed as much as bytes. Compressing ${totalRawBits} raw bits to ${totalPackedBits} packed bits helps, but a slightly larger block that decodes with predictable vectorized operations can beat a denser but branchy encoding.`,
  };
}

function* exceptionsAndSystems() {
  const pipelineNodes = 5;
  const pipelineEdges = 4;
  const pforRows = 4;         // rows in PFOR matrix
  const systemCount = 4;      // Parquet, Lucene, Gorilla, FastPFOR
  const codecChoices = 4;     // rows in choosing a codec matrix
  const normalBits = 5;       // bits for most values in PFOR example
  const outlierBits = 13;     // bits the outlier needs

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
    explanation: `A single large delta needing ${outlierBits} bits can force a whole block to use a large bit width. Patched schemes keep the common width at ${normalBits} bits and store outliers separately across the ${pforRows} categories shown.`,
    invariant: `Compression format is a contract between encoder density and decoder speed across all ${pipelineNodes} pipeline stages.`,
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
    explanation: `${systemCount} major systems tune the same ${pipelineEdges} primitives for different access patterns: column scans, postings intersections, time-series ingestion, or raw integer-array decode speed.`,
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
    explanation: `Compression wins when the transform exposes structure across ${codecChoices} data patterns shown. If the integers are already random across the full range, no block codec can magically remove entropy. Base-128 Varint & ZigZag Encoding is the message-format cousin: it compresses each integer independently instead of choosing one packed width for a block.`,
  };

  yield {
    state: packFlow('The whole block must be designed for the query path'),
    highlight: { active: ['ints', 'delta', 'pack'], found: ['decode'], compare: ['width'] },
    explanation: `A database codec spanning ${pipelineNodes} stages and ${pipelineEdges} transitions is not just storage. It decides how much data the CPU must unpack for filters, joins, intersections, skips, and vectorized scans.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'The visualization has two views. The frame-of-reference view walks through a five-stage pipeline: raw integers enter, a base or previous value is subtracted to produce small codes, a bit width is chosen, codes are packed back-to-back, and the decoder reverses the process. Active nodes (highlighted) show the current stage; found nodes show stages that have already completed. Watch how large absolute values shrink to small offsets after the transform step.',
        {type: 'image', src: './assets/gifs/delta-bit-packing-integer-compression.gif', alt: 'Animated walkthrough of the delta bit packing integer compression visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'The exceptions view shows what happens when one outlier value is too large for the chosen bit width. The matrix splits values into a main stream (packed at the common width) and a patch list (positions and extra bits for outliers). Pay attention to the contrast between normal values that fit the common width and the outlier that would force the entire block wider without patching.',
        'The system map matrix shows how four production systems (Parquet, Lucene, Gorilla, FastPFOR) each tune the same primitives for their specific access patterns. The codec-choice matrix matches data shapes to encoding strategies, making the design space concrete.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A Lucene search index for a corpus of 100 million documents stores postings lists: for every word that appears in the corpus, a sorted array of document IDs where that word occurs. A popular word might appear in 10 million documents. Storing 10 million 32-bit integers costs 40 MB for one word. A search engine has millions of words, so raw storage is hundreds of gigabytes of integer arrays alone. The machine must move those arrays through memory to answer a single query.',
        {type: 'callout', text: 'Delta bit-packing wins by turning smooth integer runs into narrow local codes that fit the memory hierarchy better than raw machine words.'},
        'The bottleneck is not disk capacity. It is memory bandwidth during query execution. A modern CPU can sustain roughly 50 GB/s from main memory, but an L1 cache read is 100 times faster. If a codec can shrink a 40 MB postings list to 5 MB and the decoder runs at cache speed, the query runs faster despite the extra CPU work for unpacking. Delta bit-packing exists because integer arrays in databases, search engines, and time-series systems have local structure that compression can exploit without adding unpredictable branches.',
        'The same pressure appears in column stores (Parquet, Arrow), graph databases (adjacency lists of sorted node IDs), time-series databases (monotonically increasing timestamps), and analytics engines (dictionary-encoded column indices). Every system that scans or intersects large integer arrays benefits from packing them smaller.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest encoding stores each integer in a fixed-width machine word, typically 32 or 64 bits. This supports O(1) random access by index: the i-th value lives at byte offset i * 4. It requires no metadata, no decode step, and no special CPU instructions. For small arrays or arrays whose values genuinely span the full 32-bit range, this is hard to beat.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Rotate_left_logically.svg/250px-Rotate_left_logically.svg.png', alt: 'Bit positions moving through a logical rotate operation', caption: 'Packed codecs live at the bit-position level: shifts, masks, and lane movement replace wasteful fixed-width storage. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Rotate_left_logically.svg/250px-Rotate_left_logically.svg.png'},
        'The other obvious option is general-purpose compression: gzip, LZ4, or Zstandard applied to the byte stream. These can achieve good ratios because sorted integers produce redundant byte patterns. LZ4 can decompress at 4+ GB/s, which sounds fast. But general compressors treat the data as an opaque byte stream. To read value number 5,000, the decoder must decompress from the start of the compression unit. There is no block-level skip, no vectorized decode of just the next 128 integers, and no way to intersect two compressed lists without fully inflating both.',
        'Fixed-width wastes bits. General compression loses random access and block-level decode. Neither approach gives a query engine what it actually needs: compact data that can be decoded in small, cache-friendly chunks at predictable speed.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'A search engine answering "cache AND memory" must intersect two postings lists. The standard algorithm decodes blocks from each list, compares document IDs, advances whichever list is behind, and skips ahead when the gap is large. This loop runs billions of times per second in a busy engine. Every branch miss, every cache miss, and every wasted byte matters inside that loop.',
        'General compressors add serial data dependencies (each byte depends on prior context), branch-heavy decode tables, and decompression units that are too large for the skip granularity the query needs. LZ4 decompresses fast but cannot hand the engine exactly the next 128 document IDs without decompressing a larger window. Snappy and Zstandard have the same problem. The codec and the query loop are adversaries: the codec wants large context for better ratios; the query loop wants small blocks for fine-grained access.',
        'Fixed-width storage avoids these problems but wastes 28 of 32 bits per value when the actual gaps between sorted document IDs fit in 4 bits. For a postings list of 10 million IDs, that waste is 35 MB of unnecessary memory traffic. The wall is that neither extreme (general compression or no compression) serves the query hot path.',
        'What the query engine wants is a codec that is designed around its access pattern: decode a block of 128 or 256 integers in one tight loop, skip blocks by reading a small header, and never introduce unpredictable branches during the decode.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Sorted or locally smooth integer sequences carry most of their information in the differences between consecutive values, not in the values themselves. Document IDs 1000, 1003, 1004, 1012, 1014 look like they need 11 bits each (to represent values up to 1014). But the gaps (3, 1, 8, 2) need only 4 bits each. The transform from absolute values to local differences removes the large common component and exposes the actual entropy.',
        'Once the transform produces small codes, a single bit width covers an entire block. If the largest code in a block of 128 values is 14, every code fits in 4 bits. The encoder writes 128 four-bit fields back-to-back into 64 bytes. The decoder reads those 64 bytes and unpacks 128 integers with shifts and masks, no branches, no lookup tables, no serial dependencies between values.',
        'The insight has two parts that must work together. First, the transform (delta, frame-of-reference, or delta-of-delta) must shrink the effective range. Second, the packing must use a single width per block so that decode is a tight, predictable loop. Neither part alone is enough: deltas without packing still waste high bits; packing without a transform chooses a width based on the largest absolute value, which is no better than fixed-width.',
        'This is why the technique is called delta bit-packing: the delta (or frame-of-reference) transform and the bit-packing step are a single design, not two independent choices.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Frame-of-reference (FOR) encoding processes integers in fixed-size blocks, typically 128 or 256 values. For each block, the encoder computes a base value (usually the block minimum), subtracts the base from every value to produce offsets, finds the maximum offset, and chooses the smallest bit width w such that 2^w - 1 covers the maximum offset. It then writes a header (base, count, bit width) followed by the packed offsets: value 0 occupies bits 0 through w-1, value 1 occupies bits w through 2w-1, and so on. For a block of 128 values at 4 bits each, the packed payload is exactly 64 bytes, which fits in one cache line.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg', alt: 'Row-major and column-major memory layout diagrams', caption: 'Memory layout matters because packed integer blocks are designed to be decoded in cache-friendly contiguous runs. Source: https://upload.wikimedia.org/wikipedia/commons/4/4c/Row_and_column_major_order.svg'},
        'Delta encoding replaces the frame-of-reference subtraction with consecutive differences. Given sorted values v0, v1, v2, ..., the encoder stores v0 directly and then stores d1 = v1 - v0, d2 = v2 - v1, and so on. The decoder rebuilds the original sequence by prefix sum: v_i = v0 + d1 + d2 + ... + d_i. Delta encoding is strictly better than FOR when the gaps are more uniform than the offsets from the minimum; FOR is better when values cluster around a base but do not increase monotonically.',
        'Patched encoding (PFOR, NewPFOR, OptPFOR) handles outliers. If 127 of 128 deltas fit in 5 bits but one delta needs 13 bits, naive packing uses 13 bits for every value, wasting 8 bits on 127 of them. Patched encoding packs the main stream at 5 bits and stores the outlier positions and extra bits in a side list. The decoder unpacks the main stream first, then patches the exceptions. The tradeoff is a small branch in the decode loop for exception handling, versus a much wider main width without patching.',
        'The decode loop for unpacked FOR or delta blocks is branchless: load a machine word, shift right by the current bit offset, mask with (1 << w) - 1, store the result. Modern SIMD implementations (SIMD-BP128, TurboPFOR) unpack 128 values in a single unrolled function using 128-bit or 256-bit vector registers, achieving decode rates above 4 billion integers per second.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is straightforward. FOR encoding is lossless because subtraction is invertible: if offset = value - base, then value = offset + base. Delta encoding is lossless because prefix sum inverts differencing: if d_i = v_i - v_{i-1}, then v_i = v_0 + sum(d_1 ... d_i). Patching is lossless because the exception list records exactly which positions need extra bits and what those bits are.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/0...15_AND.svg/250px-0...15_AND.svg.png', alt: 'Bitwise AND operation over four-bit values from zero to fifteen', caption: 'Masks are the decoder counterpart to packing: they recover fixed-width fields from dense bit streams. Source: https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/0...15_AND.svg/250px-0...15_AND.svg.png'},
        'The compression works because of a property of sorted or locally smooth sequences: their differences have lower entropy than their absolute values. Information theory gives a lower bound: if the maximum delta in a block is D, each delta carries at most ceil(log2(D+1)) bits of information. Packing at that width stores no more bits per value than the entropy demands. Contrast this with fixed-width 32-bit storage, which allocates 32 bits regardless of D.',
        'The speed works because the decode loop has no data-dependent branches. Every value in a non-patched block undergoes the same shift-and-mask sequence, which means the CPU branch predictor is never wrong, the instruction pipeline never stalls on a misprediction, and SIMD vectorization is natural. Even patched variants keep the main loop branchless and handle exceptions in a short cleanup pass.',
        'The cache behavior works because packed blocks are physically smaller. A 128-value block at 4 bits per value occupies 64 bytes, exactly one x86 cache line. The same block at 32 bits per value occupies 512 bytes, spanning 8 cache lines. Reading one cache line instead of eight means the decode loop is 8 times less likely to stall on a cache miss when blocks are accessed in sequence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Encoding is O(n) per block: one pass to compute deltas or offsets, one pass to find the maximum, one pass to pack. For a block of 128 values, encoding touches the data three times, each time in a tight sequential scan. The practical cost is dominated by the packing pass, which writes ceil(128 * w / 64) machine words. At w = 4, that is 8 writes. At w = 16, that is 32 writes.',
        'Decoding is also O(n) per block but faster than encoding because there is no max-finding pass. The decoder reads the header, then unpacks 128 values with shifts and masks. SIMD-BP128 benchmarks show decode throughput of 4 to 8 billion 32-bit integers per second on a single core, depending on bit width and CPU generation. That is faster than memcpy for the equivalent uncompressed data because the compressed block is smaller and generates fewer cache misses.',
        'Random access within a block requires decoding the entire block (or at least up to the target index for delta encoding, because of the prefix-sum dependency). Between blocks, skipping is O(1): each block header states the block size in bytes, so the decoder can jump to block k by summing k header-size fields. Systems that need finer random access use smaller blocks (32 or 64 values) at the cost of higher metadata overhead.',
        'Space overhead per block is the header: base value (4 or 8 bytes), bit width (1 byte), and possibly exception metadata (variable). For a 128-value block at 4 bits, the payload is 64 bytes and the header is roughly 5 bytes, so metadata is about 7% of the block. For very narrow widths (1 or 2 bits), metadata overhead is proportionally larger. For wide widths (24+ bits), the compression ratio is poor regardless of metadata.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Apache Lucene (the search library behind Elasticsearch and Solr) uses FOR-encoded blocks of 128 integers for postings lists. Each posting block stores a bit width and packed document-ID deltas. The postings intersection loop decodes one block at a time and advances through the skip list when blocks can be entirely skipped. Lucene\'s ForUtil class uses unrolled pack/unpack methods generated for each bit width from 1 to 32.',
        'Apache Parquet (the columnar file format used in Spark, Hive, Presto, and BigQuery) uses delta binary packing for integer columns and RLE/bit-packing hybrid encoding for dictionary-encoded columns. A Parquet data page header specifies the encoding, and the reader decodes blocks of values without inflating an entire row group. This keeps memory usage proportional to the block size, not the column length.',
        'Facebook\'s Gorilla time-series database uses delta-of-delta encoding for timestamps. Timestamps in a time series are roughly evenly spaced, so deltas are nearly constant and delta-of-deltas are nearly zero. Gorilla encodes a delta-of-delta of zero in a single bit, achieving 1.37 bytes per timestamp-value pair on their production workload. The technique was published at VLDB 2015 and adopted widely in Prometheus, InfluxDB, and TimescaleDB.',
        'FastPFOR, TurboPFOR, and SIMD-BP128 are research-grade integer compression libraries that pack 128 or 256 values per block and decode using SIMD intrinsics. Lemire and Boytsov (2015) benchmarked these at over 4 billion integers/second decode throughput, making them competitive with raw memory copy for compressed data. These libraries are used in academic IR systems, genomics pipelines, and specialized analytics engines.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Random integers drawn uniformly from the full 32-bit range have deltas that span the full range too. The maximum delta in a block of 128 random values is close to 2^32 / 128, which is about 33 million, requiring 25 bits. At 25 bits per value, compression is only 22% smaller than 32-bit storage, and the decode overhead may not be worth it. Delta bit-packing is not a general compressor; it exploits local smoothness that random data does not have.',
        'Outlier sensitivity is the second failure mode. If a single delta in a block of 128 values is 2^20 while the other 127 are under 2^4, naive packing wastes 16 bits on 127 values. Patched encoding fixes this but adds complexity to the decoder. Choosing the right exception threshold involves a tradeoff between main-stream width and exception-list size, which is data-dependent and not always worth the engineering cost.',
        'Update hostility is the third failure mode. Packed blocks are designed for immutable or append-only data. Inserting a value into the middle of a delta-encoded block changes every subsequent delta, potentially changing the maximum and the bit width. Deleting a value has the same cascading effect. Systems that need frequent in-place updates (OLTP databases, mutable key-value stores) use B-trees or LSM trees with different compression strategies at the page or SSTable level.',
        'Finally, the technique requires careful tuning per workload. Block size, delta vs. FOR vs. delta-of-delta, patched vs. unpatched, and SIMD width all interact. A codec tuned for Lucene postings (sorted IDs, monotone, large blocks) performs poorly on Gorilla timestamps (nearly constant deltas, small blocks). There is no universal configuration.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a block of 5 sorted document IDs from a postings list: [1000, 1003, 1004, 1012, 1014]. Storing them as 32-bit integers costs 5 * 32 = 160 bits. Frame-of-reference encoding sets base = 1000 and computes offsets: [0, 3, 4, 12, 14]. The maximum offset is 14, which fits in ceil(log2(15)) = 4 bits. The packed block is a 32-bit base (32 bits) plus 5 * 4 = 20 packed bits, totaling 52 bits. Compression ratio: 160 / 52 = 3.1x.',
        'Delta encoding of the same block: store the first value 1000 (32 bits) and then deltas [3, 1, 8, 2]. The maximum delta is 8, requiring ceil(log2(9)) = 4 bits. Total: 32 + 4 * 4 = 48 bits. Compression ratio: 160 / 48 = 3.3x. Delta is slightly better here because the deltas (max 8) are smaller than the FOR offsets (max 14). To decode, compute the prefix sum: 1000, 1000+3=1003, 1003+1=1004, 1004+8=1012, 1012+2=1014.',
        'Now add an outlier: [1000, 1003, 1004, 5000, 5002]. Deltas are [3, 1, 4996, 2]. The maximum delta is 4996, requiring 13 bits. Without patching: 32 + 4 * 13 = 84 bits. With patching at width 2: main deltas [3, 1, 0, 2] packed at 2 bits (32 + 4*2 = 40 bits) plus one exception entry (position 2, residual 4996, costing about 16 bits for position and 13 bits for value), totaling roughly 69 bits. Patching saves 15 bits in this toy example; at block size 128, the savings scale because 127 values benefit from the narrow width.',
        'At production scale with block size 128 and typical postings-list deltas fitting in 8 bits: uncompressed is 128 * 32 = 4096 bits = 512 bytes. Packed is 128 * 8 = 1024 bits = 128 bytes plus a ~5-byte header. That is a 4x reduction, and the 128-byte payload fits in two cache lines instead of eight. The decode loop processes two cache lines instead of eight, which is where the real performance win comes from.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Lemire and Boytsov, "Decoding billions of integers per second through vectorization" (2015), https://arxiv.org/abs/1209.2137, which benchmarks SIMD-BP128 and related codecs. Apache Parquet encoding specification at https://parquet.apache.org/docs/file-format/data-pages/encodings/ for production delta-binary-packing. Lucene ForUtil source and API at https://lucene.apache.org/core/10_1_0/core/org/apache/lucene/codecs/lucene101/ForUtil.html for postings-list packing. The Gorilla time-series paper (Pelkonen et al., VLDB 2015) at https://www.vldb.org/pvldb/vol8/p1816-teller.pdf for delta-of-delta timestamp encoding. FastPFOR library at https://github.com/fast-pack/FastPFOR for reference implementations.',
        'For prerequisites, study Base-128 Varint & ZigZag Encoding, which compresses individual integers without blocking. For the data structure that consumes packed postings, study Inverted Index and Block-Max WAND. For alternative compressed integer representations, study Elias-Fano Encoding (optimal for sparse sorted sets) and Roaring Bitmaps (hybrid run/array/bitmap containers). For the column-store context, study Parquet Columnar Format Case Study. For the time-series context, study Prometheus TSDB Case Study.',
        'The field is active. Recent work includes Panacea (adaptive block-level codec selection), SIMD-FastPFOR (AVX-512 variants), and dictionary-RLE hybrids in Arrow and Velox. Each new CPU generation changes the SIMD width and cache hierarchy, which shifts the optimal block size and bit-width thresholds.',
      ],
    },
  ],
};
