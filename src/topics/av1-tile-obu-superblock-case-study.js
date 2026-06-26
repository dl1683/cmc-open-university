// AV1 bitstream layout: OBUs wrap sequence headers, frame headers, tile groups,
// and tile data; superblocks organize local prediction and transform work.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'av1-tile-obu-superblock-case-study',
  title: 'AV1 Tile OBU Superblock Case Study',
  category: 'Systems',
  summary: 'An AV1 bitstream case study: open bitstream units, sequence headers, frame headers, tile groups, superblock partitions, entropy contexts, and parallel decode boundaries.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['bitstream layout', 'tile decode'], defaultValue: 'bitstream layout' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function obuGraph(title) {
  return graphState({
    nodes: [
      { id: 'seq', label: 'seq', x: 0.8, y: 2.0, note: 'OBU' },
      { id: 'fh', label: 'frame', x: 2.6, y: 2.0, note: 'header' },
      { id: 'tg', label: 'tiles', x: 4.5, y: 2.0, note: 'groups' },
      { id: 'sb', label: 'SB', x: 6.3, y: 2.0, note: 'blocks' },
      { id: 'ctx', label: 'ctx', x: 6.3, y: 5.0, note: 'entropy' },
      { id: 'recon', label: 'recon', x: 8.3, y: 3.5, note: 'pixels' },
    ],
    edges: [
      { id: 'e-seq-fh', from: 'seq', to: 'fh' },
      { id: 'e-fh-tg', from: 'fh', to: 'tg' },
      { id: 'e-tg-sb', from: 'tg', to: 'sb' },
      { id: 'e-sb-recon', from: 'sb', to: 'recon' },
      { id: 'e-ctx-sb', from: 'ctx', to: 'sb' },
      { id: 'e-fh-ctx', from: 'fh', to: 'ctx' },
    ],
  }, { title });
}

function* bitstreamLayout() {
  yield {
    state: obuGraph('AV1 packets syntax as OBUs'),
    highlight: { active: ['seq', 'fh', 'tg', 'e-seq-fh', 'e-fh-tg'], found: ['sb', 'recon'] },
    explanation: 'AV1 wraps high-level syntax in open bitstream units. Sequence headers set stream-wide rules, frame headers set frame state, and tile group OBUs carry coded tile data.',
    invariant: 'The parser must know which syntax state is active before decoding tile payloads.',
  };

  yield {
    state: labelMatrix(
      'OBU inventory',
      [
        { id: 'seq', label: 'seq' },
        { id: 'temp', label: 'temp' },
        { id: 'frame', label: 'frame' },
        { id: 'tile', label: 'tile' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'scope', label: 'scope' },
      ],
      [
        ['profile', 'stream'],
        ['layers', 'stream'],
        ['state', 'frame'],
        ['coeffs', 'tiles'],
      ],
    ),
    highlight: { active: ['seq:role', 'frame:role'], found: ['tile:role'] },
    explanation: 'A useful decoder log separates stream-level metadata from per-frame and per-tile syntax. That separation makes conformance bugs diagnosable.',
  };

  yield {
    state: labelMatrix(
      'Frame packet ledger',
      [
        { id: 'show', label: 'show' },
        { id: 'ref', label: 'ref' },
        { id: 'upd', label: 'update' },
        { id: 'tile', label: 'tile' },
      ],
      [
        { id: 'fact', label: 'fact' },
        { id: 'guard', label: 'guard' },
      ],
      [
        ['display?', 'timing'],
        ['slots', 'DPB'],
        ['replace', 'policy'],
        ['range', 'bounds'],
      ],
    ),
    highlight: { active: ['ref:guard', 'upd:guard'], compare: ['tile:guard'] },
    explanation: 'Frame headers connect codec syntax to the reference-frame DAG. Tile groups connect the same frame to parallel decode ranges and entropy state.',
  };

  yield {
    state: obuGraph('A valid stream is a nested state machine'),
    highlight: { active: ['seq', 'fh', 'tg', 'sb', 'ctx', 'e-fh-ctx', 'e-ctx-sb'], found: ['recon'] },
    explanation: 'The data-structure lesson is nesting: container OBUs, frame state, tile ranges, superblock partitions, local prediction context, and reconstructed pixels.',
  };
}

function tileGrid(title) {
  return labelMatrix(
    title,
    [
      { id: 'r0', label: 'row0' },
      { id: 'r1', label: 'row1' },
      { id: 'r2', label: 'row2' },
      { id: 'r3', label: 'row3' },
    ],
    [
      { id: 'c0', label: 't0' },
      { id: 'c1', label: 't1' },
      { id: 'c2', label: 't2' },
      { id: 'c3', label: 't3' },
    ],
    [
      ['SB', 'SB', 'SB', 'SB'],
      ['SB', 'skip', 'mv', 'SB'],
      ['SB', 'coeff', 'pred', 'SB'],
      ['SB', 'SB', 'SB', 'SB'],
    ],
  );
}

function* tileDecode() {
  yield {
    state: tileGrid('Tiles split the frame into decode regions'),
    highlight: { active: ['r0:c0', 'r0:c1', 'r1:c0', 'r1:c1'], compare: ['r2:c2', 'r3:c3'] },
    explanation: 'Tiles give the bitstream spatial boundaries. A decoder can process independent tile regions with less cross-region dependency than an arbitrary scanline stream.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'tile0', label: 't0', x: 1.0, y: 2.0, note: 'job' },
        { id: 'tile1', label: 't1', x: 1.0, y: 5.0, note: 'job' },
        { id: 'q0', label: 'q0', x: 3.0, y: 2.0, note: 'worker' },
        { id: 'q1', label: 'q1', x: 3.0, y: 5.0, note: 'worker' },
        { id: 'ctx', label: 'ctx', x: 5.3, y: 3.5, note: 'local' },
        { id: 'frame', label: 'frame', x: 8.0, y: 3.5, note: 'merge' },
      ],
      edges: [
        { id: 'e-tile0-q0', from: 'tile0', to: 'q0' },
        { id: 'e-tile1-q1', from: 'tile1', to: 'q1' },
        { id: 'e-q0-ctx', from: 'q0', to: 'ctx' },
        { id: 'e-q1-ctx', from: 'q1', to: 'ctx' },
        { id: 'e-ctx-frame', from: 'ctx', to: 'frame' },
      ],
    }, { title: 'Tile jobs map onto decoder workers' }),
    highlight: { active: ['tile0', 'tile1', 'q0', 'q1', 'e-tile0-q0', 'e-tile1-q1'], found: ['frame'] },
    explanation: 'A tile scheduler is a small work queue. It balances parallelism against coding efficiency because strong boundaries can limit prediction across tile edges.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'tile count', min: 1, max: 16 }, y: { label: 'relative value', min: 0, max: 100 } },
      series: [
        { id: 'parallel', label: 'par', points: [{ x: 1, y: 10 }, { x: 2, y: 35 }, { x: 4, y: 65 }, { x: 8, y: 82 }, { x: 16, y: 88 }] },
        { id: 'eff', label: 'coding', points: [{ x: 1, y: 92 }, { x: 2, y: 88 }, { x: 4, y: 80 }, { x: 8, y: 66 }, { x: 16, y: 50 }] },
      ],
      markers: [
        { id: 'phone', label: 'phone', x: 2, y: 72 },
        { id: 'server', label: 'server', x: 8, y: 72 },
      ],
    }, { title: 'Tile count is an engineering knob' }),
    highlight: { active: ['parallel'], compare: ['eff'], found: ['phone', 'server'] },
    explanation: 'More tiles can raise hardware parallelism but may reduce compression efficiency or increase overhead. The best choice depends on resolution, decoder cores, and latency target.',
  };

  yield {
    state: labelMatrix(
      'Superblock choices',
      [
        { id: 'part', label: 'part' },
        { id: 'pred', label: 'pred' },
        { id: 'tx', label: 'tx' },
        { id: 'ctx', label: 'ctx' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['split tree', 'rate'],
        ['mode+mv', 'drift'],
        ['coeffs', 'noise'],
        ['counts', 'sync'],
      ],
    ),
    highlight: { active: ['part:stores', 'pred:stores', 'tx:stores'], compare: ['ctx:risk'] },
    explanation: 'Inside a tile, superblocks carry partition decisions, prediction modes, motion vectors, transforms, and entropy-coded residuals. The tile boundary is only the outer scheduling shape.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'bitstream layout') yield* bitstreamLayout();
  else if (view === 'tile decode') yield* tileDecode();
  else throw new InputError('Pick an AV1 layout view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation from the outside inward. An OBU, or Open Bitstream Unit, is a packet-like container in the AV1 bitstream. A tile is a rectangular region of a video frame that can be decoded mostly independently, and a superblock is the large pixel block that AV1 recursively partitions into smaller prediction and transform units.',
        'The safe inference rule is local independence with boundaries. If the visual puts work into separate tiles, those tile jobs can run on separate workers because each tile carries enough coded data for that region. If the visual descends into a superblock, the decoder is choosing how much spatial detail that part of the image needs.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'AV1 exists because internet video is a bandwidth problem wearing a quality mask. A 4K stream at 60 frames per second contains about 497 million pixels per second before compression. No consumer network or storage system wants to move that raw signal.',
                { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg', alt: 'YouTube logo', caption: 'YouTube adopted AV1 for bandwidth savings — AV1 achieves 30-50%% bitrate reduction over H.264 at equivalent quality. Source: Wikimedia Commons, Google, Public domain' },,
                { type: 'callout', text: 'AV1 is royalty-free by design. The Alliance for Open Media created it specifically to break the patent licensing barriers that made H.265/HEVC adoption slow and expensive.' },,
        'The format has to serve phones, browsers, TVs, encoders in data centers, and hardware decoders in chips. That means compression ratio is not enough. The bitstream also needs restart points, parallel work units, and block choices that let devices trade compute for bandwidth.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to encode the frame as one long sequence of pixels or small fixed blocks. A decoder could read left to right and reconstruct the picture in order. This is easy to imagine because it matches how a raw bitmap is stored.',
        'A better first attempt is motion compensation: describe a block by pointing to similar pixels in a previous or nearby frame, then store only the difference. That is the core idea behind most video codecs. It saves many bits, but by itself it creates dependency chains that are hard to parallelize.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that compression creates dependencies, and dependencies serialize work. If every block can refer freely to every other nearby block, many CPU cores sit idle while one chain finishes. For high-resolution playback, waiting on one serial decode path is visible as stutter.',
        'Fixed small blocks also waste bits. A blue sky can be described with one large smooth region, while grass or text needs smaller partitions. A codec that uses one block size everywhere pays too much overhead on smooth regions or loses detail on complex regions.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to separate container boundaries, parallel regions, and adaptive block shape. OBUs package the bitstream so a decoder knows what kind of data it is reading. Tiles carve a frame into independent rectangular jobs, and superblocks give each tile a recursive unit for adapting to image detail.',
                { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Data packet structure', caption: 'OBU (Open Bitstream Unit) packets carry AV1 frame data, sequence headers, and metadata in a self-describing binary format. Source: Wikimedia Commons, Oddbodz, Public domain' },,
                { type: 'callout', text: 'Tiles enable parallel encoding and decoding. Each tile is independently decodable, so a 4K frame split into 4 tiles can use 4 CPU cores simultaneously.' },,
        'This is a data-layout idea as much as a compression idea. The bitstream names coarse units that machines can schedule, then lets the codec spend more precision only where pixels need it. The format is not just asking what picture to draw; it is asking how work should be divided.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A sequence header OBU gives global rules such as profile, dimensions, and coding features. A frame OBU carries frame-level information. Tile group data then contains encoded tile bytes, and inside each tile the decoder walks superblocks and their partitions.',
                { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'CPU die showing hardware complexity', caption: 'AV1 decode complexity is 3-4x higher than H.264 — hardware decode support is essential for mobile and embedded devices. Source: Wikimedia Commons, Intel/KL, Public domain' },,
        'Within a superblock, AV1 can split a large block into smaller rectangles when detail requires it. The encoder chooses prediction modes, transform sizes, quantization, and residual data. The decoder follows those choices exactly, reconstructs pixels, and writes them into the output frame.',
                { type: 'callout', text: 'Superblocks in AV1 can be 128x128 pixels — four times the area of H.264\'s largest macroblock. Larger blocks capture smooth regions efficiently; recursive partitioning handles detail.' },,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is contractual. The bitstream syntax tells the decoder how to parse each OBU, which frame state is available, where tile boundaries sit, and how each superblock is partitioned. If an encoder emits a conforming stream, a conforming decoder follows the same parse and reconstructs the same pixel values within the chosen precision.',
        'Tiles work because the format restricts the dependencies that would cross the tile boundary. That restriction is a tax on compression, but it gives the scheduler a proof that tile workers do not need to wait on one another for ordinary reconstruction. Superblocks work because every recursive split covers the original region exactly once, so no pixels are lost or decoded twice.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'AV1 spends compute to save bandwidth. More prediction modes, larger superblocks, loop filters, and partition choices let the encoder find smaller descriptions, but search gets expensive. When input duration doubles, an exhaustive encoder has roughly twice as many frames to analyze, and each frame still carries a large decision tree.',
                { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ssd-cache-benchmark.png', alt: 'Storage and bandwidth benchmarks', caption: 'AV1 encoding is 10-100x slower than H.264 but produces files 30-50%% smaller — a classic compute-vs-bandwidth tradeoff. Source: Wikimedia Commons' },,
        'Tile count is also a cost knob. Four tiles can use four workers, but each boundary limits prediction across that boundary and can slightly increase bitrate. A streaming service may accept slower encoding once in a data center because every later viewer saves network bytes.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AV1 fits large-scale video distribution, browser playback, conferencing, cloud gaming, screen sharing, and stored media where bandwidth or licensing cost matters. The access pattern is encode once or a few times, then decode many times. That favors a codec that spends extra compute during production to reduce repeated delivery cost.',
        'Tiles matter in devices that have several CPU cores or hardware decode blocks. A phone does not only need the frame to be smaller; it needs the work to fit a power and latency budget. Parallel regions let the decoder finish a frame before the display deadline.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'AV1 is the wrong answer when encode latency is the main constraint and bandwidth savings are small. A live low-latency workflow may prefer a simpler codec or a faster preset because a late frame is a bad frame. Compression efficiency cannot pay back if the user waits for the encoder.',
        'It also fails as a mental model if tiles are treated as free speed. Too many tiles can damage compression and create overhead. Hardware support, browser support, power use, and content type decide whether AV1 is an engineering win for a specific product.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take a 3840 by 2160 frame and split it into a 2 by 2 tile grid. Each tile is 1920 by 1080 pixels, so four workers can decode four rectangular regions. If a frame budget is 16.7 ms for 60 fps, parallel tile work can be the difference between meeting the display deadline and missing it.',
        'Inside one tile, use 128 by 128 superblocks. A 1920-wide tile has 15 superblocks across, and a 1080-high tile needs 9 rows rounded up to cover the edge, for about 135 superblock positions. Smooth sky regions may stay as large blocks, while text or tree edges split into smaller partitions.',
        'Now compare payload behavior. If AV1 reduces a 12 Mbps H.264 stream by 35 percent, the stream becomes about 7.8 Mbps and saves 4.2 megabits every second per viewer. For 10,000 concurrent viewers, that is about 42 gigabits per second less delivery traffic, bought with more encode and decode complexity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: the AV1 bitstream specification from the Alliance for Open Media, libaom documentation, dav1d decoder notes, and browser media documentation for playback support. Read those sources for syntax, then return to this page for the data-structure view of containers, tiles, and superblocks.',
        'Study next by role. For compression, study entropy coding and transform coding. For systems, study video segment manifests, adaptive bitrate ladders, and hardware decode pipelines. For data layout, compare AV1 tiles with image tiling and matrix tiling in cache-aware kernels.',
      ],
    },
  ],
};
