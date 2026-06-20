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
      heading: 'Why this exists',
      paragraphs: [
        `A video codec is not just a way to store pictures smaller. It is a contract between an encoder, a decoder, a network, hardware blocks, browser pipelines, and conformance tests. The bitstream must say which state applies, which references are available, which regions can be decoded, and how local prediction decisions reconstruct pixels. AV1 uses OBUs, tiles, and superblocks to make that contract explicit.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg', alt: 'YouTube logo', caption: 'YouTube adopted AV1 for bandwidth savings — AV1 achieves 30-50%% bitrate reduction over H.264 at equivalent quality. Source: Wikimedia Commons, Google, Public domain' },
        `The design has competing goals. Compression improves when nearby pixels and nearby syntax can share prediction, entropy context, and reference information. Playback improves when the decoder can split work across cores, recover from localized damage, and know exactly which syntax object failed. AV1's nested structure is the compromise: global containers establish state, tiles make spatial work schedulable, and superblocks carry the local coding choices.`,
        { type: 'callout', text: 'AV1 is royalty-free by design. The Alliance for Open Media created it specifically to break the patent licensing barriers that made H.265/HEVC adoption slow and expensive.' },
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The naive model is a folder of compressed images. Decode frame 1, then frame 2, then frame 3. If that were true, the bitstream could be a simple list of image blobs. But inter-frame video depends on reference frames, loop filters, probability contexts, prediction modes, motion vectors, temporal layers, and display timing. The decoder is not reading pictures. It is walking a state machine.`,
        `A second naive answer is to divide every frame into many independent rectangles. That sounds perfect for parallelism: one tile per worker, merge the results, and move on. The problem is that compression likes shared context. Every boundary can limit prediction or context adaptation. More tiles may reduce wall-clock decode time on one device while increasing bitrate, overhead, or artifacts on another.`,
      ],
    },
    {
      heading: 'Where the naive model breaks',
      paragraphs: [
        `The image-list model breaks at the first reference. Many frames are predicted from earlier or later decoded frames. A frame header does not merely describe pixels; it also selects reference slots, update rules, order hints, segmentation state, loop filter parameters, quantization, and tile layout. If that state is wrong, the tile data cannot be interpreted correctly.`,
        `The rectangle model breaks at context. A tile is a coded region with syntax consequences, not a crop tool. Inside the tile, superblocks choose partition trees, intra or inter prediction, motion vectors, transform sizes, coefficient syntax, and entropy-coded residuals. Those choices must be decoded in a legal order and then reconstructed into the final frame. The hierarchy exists because the decoder needs both state and boundaries.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that the bitstream is a nested state machine. Sequence OBUs set stream-level facts such as profile and operating points. Frame headers set per-frame state and connect the current frame to the reference-frame graph. Tile group syntax names a range of tiles. Superblock syntax inside a tile describes the local decisions needed to reconstruct pixels.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Data packet structure', caption: 'OBU (Open Bitstream Unit) packets carry AV1 frame data, sequence headers, and metadata in a self-describing binary format. Source: Wikimedia Commons, Oddbodz, Public domain' },
        `That nesting is a data structure. It tells a parser what vocabulary is legal at each point. It tells a scheduler which work units can be handed to workers. It tells a conformance test where a stream broke. It tells an engineer whether a failure is a missing sequence header, an invalid reference update, a bad tile range, an entropy desynchronization, or a local superblock decision.`,
      ],
    },
    {
      heading: 'Mechanism and decode flow',
      paragraphs: [
        `A decoder first establishes stream context from OBUs such as sequence headers and temporal delimiters. Then it parses frame-level syntax. Only after frame state is known can tile group data be interpreted. A tile group covers a range of tile indexes, and each tile contains coded superblocks. The superblock is where high-level bitstream structure meets the local image model.`,
        { type: 'callout', text: 'Tiles enable parallel encoding and decoding. Each tile is independently decodable, so a 4K frame split into 4 tiles can use 4 CPU cores simultaneously.' },
        `Inside a superblock, the decoder follows syntax for partitioning, prediction, transform, and residual coefficients. Some blocks are predicted from neighboring pixels. Some use motion vectors into reference frames. Some skip residuals; some carry transformed coefficient data. Entropy contexts and probability adaptation make the local syntax compact, but they also make state alignment critical. One wrong read can poison later symbols.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/4/4f/KL_Intel_i7_die.jpg', alt: 'CPU die showing hardware complexity', caption: 'AV1 decode complexity is 3-4x higher than H.264 — hardware decode support is essential for mobile and embedded devices. Source: Wikimedia Commons, Intel/KL, Public domain' },
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        `The bitstream-layout view proves the ordering constraint. Sequence state comes before frame state, frame state comes before tile groups, and tile groups lead into superblock reconstruction. The arrows are not decorative. They mean later syntax is only meaningful after earlier syntax has established the active state. A tile payload without the right frame context is not a self-contained image.`,
        `The tile-decode view proves that tile count is an engineering knob. The grid shows spatial regions, the worker graph shows scheduling, and the plot shows the tradeoff: parallel value can rise with tile count while coding efficiency falls. The superblock table then zooms into what the tile contains. The tile boundary is the outer scheduling shape; the superblock decisions are the local compression substance.`,
        { type: 'callout', text: 'Superblocks in AV1 can be 128x128 pixels — four times the area of H.264\'s largest macroblock. Larger blocks capture smooth regions efficiently; recursive partitioning handles detail.' },
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `The method works because each layer narrows ambiguity. The sequence layer tells the decoder which stream rules apply. The frame layer tells it which references, probabilities, dimensions, and tile layout apply. The tile layer bounds a region of coded data. The superblock layer reconstructs local pixels from legal prediction and residual choices. Each layer is smaller than "decode the video" and larger than "read the next bit."`,
        `This layered contract also helps correctness. A conformance decoder can reject invalid syntax at the layer where it becomes invalid. A production player can attach logs to the same layers: sequence header hash, frame number, reference slots, tile range, superblock coordinates, decode time, and error code. That is how a codec bitstream becomes observable enough to debug.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Tiles buy parallelism, bounded work units, and sometimes better error isolation. They can also cost bitrate because they restrict prediction and context sharing across boundaries. They add syntax and scheduling overhead. They can make load balancing harder if one tile contains much more complex motion or residual data than another. A tile layout that helps a server encoder may not be best for a small phone decoder.`,
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Ssd-cache-benchmark.png', alt: 'Storage and bandwidth benchmarks', caption: 'AV1 encoding is 10-100x slower than H.264 but produces files 30-50%% smaller — a classic compute-vs-bandwidth tradeoff. Source: Wikimedia Commons' },
        `Superblocks buy local flexibility. AV1 can split, predict, transform, and code residuals in ways that fit local image structure. That flexibility improves compression, but it increases decoder complexity and test burden. Hardware decoders need fixed pipelines and bounded buffers. Software decoders need careful memory locality. Bitstream designers are constantly trading compression efficiency against parallelism, complexity, and predictability.`,
      ],
    },
    {
      heading: 'Real use cases',
      paragraphs: [
        `High-resolution playback is the obvious use. A 4K or 8K frame has enough pixels that a single serial decode path can waste available cores. Tiles let encoders create regions that browser, TV, phone, or hardware decoders can schedule in parallel. Live systems also care because decode delay affects glass-to-glass latency, not just average throughput.`,
        `Tiles and OBUs also matter in diagnostics. A media service can keep a ledger of sequence-header facts, frame-header facts, tile ranges, superblock counts, reference slots, decode timing, and tile validation failures. That ledger separates different classes of bugs. A tile-boundary artifact is different from a missing reference frame, a corrupted OBU, a bad adaptive-bitrate segment, or a decoder worker starvation problem.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Do not treat OBUs as harmless wrappers. If the parser loses OBU boundaries, length fields, or header state, the rest of the stream can become nonsense. Do not treat tile artifacts as purely visual. They may indicate invalid tile ranges, entropy context mismatch, broken reference state, worker ordering bugs, or data corruption. Do not treat superblocks as ordinary fixed blocks either; their partition trees and prediction decisions are part of the compressed syntax.`,
        `The most common design mistake is asking one knob to solve every problem. More tiles do not always improve playback. Fewer tiles do not always improve quality enough to justify slower decode. Larger superblocks do not remove the need for careful partitioning. A codec pipeline has to choose for resolution, latency, decoder cores, content type, bitrate ladder, and conformance risk together.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Video Codec Reference Frame DAG Case Study next to understand why frame headers carry reference-state consequences. Study Arithmetic & ANS Coding and Huffman Coding to understand why entropy context matters inside tile and superblock syntax. Study Adaptive Bitrate Manifest Ladder Case Study to connect bitstream choices to streaming delivery, and Data Structure Design Patterns Primer to recognize the nested-state-machine pattern.`,
        `Primary sources: AV1 Bitstream and Decoding Process Specification at https://aomediacodec.github.io/av1-spec/, AV1 bitstream semantics source at https://github.com/AOMediaCodec/av1-spec/blob/master/07.bitstream.semantics.md, and AV1 technical overview at https://arxiv.org/pdf/2008.06091.`,
      ],
    },
  ],
};
