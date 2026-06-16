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
    { heading: 'What it is', paragraphs: ['AV1 organizes its bitstream into open bitstream units, or OBUs. Those OBUs carry sequence metadata, frame syntax, temporal delimiter data, tile group data, and other structures needed by a decoder.', 'Tiles and superblocks are the practical data-structure layer inside a frame. Tiles define spatial regions and scheduling boundaries. Superblocks hold the local prediction, transform, and residual choices that reconstruct pixels.'] },
    { heading: 'How it works', paragraphs: ['A decoder parses sequence headers, then frame headers, then tile group data. Each tile group covers a range of tile indexes. Within the tile, superblock syntax chooses partitions, prediction modes, motion vectors, transform information, and entropy-coded coefficients.', 'The AV1 spec describes frame OBUs and tile group OBUs explicitly: a frame OBU can pack the frame header and tile group together, while tile group syntax names the tile range.'] },
    { heading: 'Cost and complexity', paragraphs: ['Tiles give parallelism and random access to spatial regions, but strong boundaries are not free. They constrain prediction and context sharing, add syntax overhead, and require careful scheduling so workers stay busy without breaking bitstream order.'] },
    { heading: 'Complete case study', paragraphs: ['A 4K live encoder chooses tile columns so phone, browser, and TV decoders can use multiple cores. The conformance ledger records sequence-header hash, frame header facts, tile ranges, superblock counts, reference slots, decode timing, and whether any tile failed independent validation.', 'That ledger makes failures actionable: a tile-boundary artifact is different from a missing reference, a corrupted OBU, or a bad manifest segment.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not treat tiles as a generic crop feature. They are coded regions inside a frame with syntax, context, and decoder scheduling consequences. Do not assume more tiles always improve playback; parallel decode and compression ratio move in opposite directions after a point.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: AV1 Bitstream and Decoding Process Specification at https://aomediacodec.github.io/av1-spec/, AV1 bitstream semantics source at https://github.com/AOMediaCodec/av1-spec/blob/master/07.bitstream.semantics.md, and AV1 technical overview at https://arxiv.org/pdf/2008.06091. Study Video Codec Reference Frame DAG Case Study, Arithmetic & ANS Coding, Huffman Coding, Adaptive Bitrate Manifest Ladder Case Study, and Data Structure Design Patterns Primer next.'] },
  ],
};
