// Video codec reference frames: a GOP is a small dependency graph where
// decoded frames are reused as predictors before they can be released.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'video-codec-reference-frame-dag-case-study',
  title: 'Video Codec Reference Frame DAG Case Study',
  category: 'Systems',
  summary: 'A video-compression case study: I/P/B frames, GOP dependency DAGs, decoded-picture buffers, reference slots, reorder delay, random access, and encoder-policy tradeoffs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['gop dag', 'dpb ledger'], defaultValue: 'gop dag' },
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

function gopGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'i0', label: 'I0', x: 0.9, y: 3.4, note: notes.i0 ?? 'anchor' },
      { id: 'b1', label: 'B1', x: 2.4, y: 2.0, note: notes.b1 ?? 'interp' },
      { id: 'b2', label: 'B2', x: 2.4, y: 4.8, note: notes.b2 ?? 'interp' },
      { id: 'p3', label: 'P3', x: 4.4, y: 3.4, note: notes.p3 ?? 'pred' },
      { id: 'b4', label: 'B4', x: 6.1, y: 2.0, note: notes.b4 ?? 'interp' },
      { id: 'b5', label: 'B5', x: 6.1, y: 4.8, note: notes.b5 ?? 'interp' },
      { id: 'p6', label: 'P6', x: 8.3, y: 3.4, note: notes.p6 ?? 'pred' },
    ],
    edges: [
      { id: 'e-i0-b1', from: 'i0', to: 'b1', weight: 'ref' },
      { id: 'e-p3-b1', from: 'p3', to: 'b1', weight: 'ref' },
      { id: 'e-i0-b2', from: 'i0', to: 'b2', weight: 'ref' },
      { id: 'e-p3-b2', from: 'p3', to: 'b2', weight: 'ref' },
      { id: 'e-i0-p3', from: 'i0', to: 'p3', weight: 'ref' },
      { id: 'e-p3-b4', from: 'p3', to: 'b4', weight: 'ref' },
      { id: 'e-p6-b4', from: 'p6', to: 'b4', weight: 'ref' },
      { id: 'e-p3-b5', from: 'p3', to: 'b5', weight: 'ref' },
      { id: 'e-p6-b5', from: 'p6', to: 'b5', weight: 'ref' },
      { id: 'e-p3-p6', from: 'p3', to: 'p6', weight: 'ref' },
    ],
  }, { title });
}

function* gopDag() {
  yield {
    state: gopGraph('A GOP is a reference-frame DAG'),
    highlight: { active: ['i0', 'p3', 'p6', 'e-i0-p3', 'e-p3-p6'], compare: ['b1', 'b2', 'b4', 'b5'] },
    explanation: 'A codec does not store every frame independently. It stores prediction anchors and residuals. The reference graph says which decoded frames must remain available before a dependent frame can be reconstructed.',
    invariant: 'Decode order must respect reference dependencies even when display order is different.',
  };

  yield {
    state: labelMatrix(
      'Frame roles',
      [
        { id: 'i', label: 'I' },
        { id: 'p', label: 'P' },
        { id: 'b', label: 'B' },
        { id: 'idr', label: 'IDR' },
      ],
      [
        { id: 'refs', label: 'refs' },
        { id: 'cost', label: 'cost' },
        { id: 'seek', label: 'seek' },
      ],
      [
        ['none', 'large', 'yes'],
        ['past', 'mid', 'no'],
        ['past+future', 'small', 'no'],
        ['reset', 'large', 'yes'],
      ],
    ),
    highlight: { active: ['i:seek', 'idr:seek'], found: ['p:refs', 'b:refs'] },
    explanation: 'I-like frames buy random access and decoder reset points. P and B frames buy compression by depending on decoded references, but they add state and sometimes delay.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'reference depth', min: 0, max: 6 }, y: { label: 'relative cost', min: 0, max: 100 } },
      series: [
        { id: 'bits', label: 'bits', points: [{ x: 0, y: 92 }, { x: 1, y: 63 }, { x: 2, y: 45 }, { x: 4, y: 35 }, { x: 6, y: 33 }] },
        { id: 'delay', label: 'delay', points: [{ x: 0, y: 5 }, { x: 1, y: 18 }, { x: 2, y: 35 }, { x: 4, y: 62 }, { x: 6, y: 80 }] },
      ],
      markers: [
        { id: 'live', label: 'live', x: 1.2, y: 20 },
        { id: 'vod', label: 'vod', x: 4.5, y: 40 },
      ],
    }, { title: 'Compression trades against reorder delay' }),
    highlight: { active: ['bits'], compare: ['delay'], found: ['live', 'vod'] },
    explanation: 'Deeper reference chains can reduce bits, but low-latency streams often cap B-frame depth because future references delay display.',
  };

  yield {
    state: gopGraph('Random access cuts the dependency graph', { i0: 'segment', p3: 'keep', p6: 'next' }),
    highlight: { active: ['i0', 'e-i0-p3', 'e-i0-b1', 'e-i0-b2'], found: ['p3', 'p6'], compare: ['b1', 'b2'] },
    explanation: 'Segmented streaming, trick play, and seeking need deliberate cut points. The encoder decides where to spend an intra frame so a player can start without fetching old references.',
  };
}

function* dpbLedger() {
  yield {
    state: labelMatrix(
      'Decoded picture buffer',
      [
        { id: 's0', label: 'slot0' },
        { id: 's1', label: 'slot1' },
        { id: 's2', label: 'slot2' },
        { id: 's3', label: 'slot3' },
      ],
      [
        { id: 'frame', label: 'frame' },
        { id: 'use', label: 'use' },
        { id: 'keep', label: 'keep' },
      ],
      [
        ['I0', 'anchor', 'yes'],
        ['P3', 'future', 'yes'],
        ['B1', 'display', 'no'],
        ['B2', 'display', 'no'],
      ],
    ),
    highlight: { active: ['s0:keep', 's1:keep'], compare: ['s2:keep', 's3:keep'] },
    explanation: 'The decoded picture buffer is the working set. Frames needed as references stay resident; displayed non-reference frames can be released sooner.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'parse', label: 'parse', x: 0.9, y: 3.5, note: 'slice' },
        { id: 'refs', label: 'refs', x: 2.6, y: 2.0, note: 'lookup' },
        { id: 'motion', label: 'motion', x: 4.5, y: 2.0, note: 'predict' },
        { id: 'resid', label: 'resid', x: 4.5, y: 5.0, note: 'decode' },
        { id: 'recon', label: 'recon', x: 6.5, y: 3.5, note: 'frame' },
        { id: 'dpb', label: 'DPB', x: 8.3, y: 3.5, note: 'slots' },
      ],
      edges: [
        { id: 'e-parse-refs', from: 'parse', to: 'refs' },
        { id: 'e-refs-motion', from: 'refs', to: 'motion' },
        { id: 'e-motion-recon', from: 'motion', to: 'recon' },
        { id: 'e-resid-recon', from: 'resid', to: 'recon' },
        { id: 'e-recon-dpb', from: 'recon', to: 'dpb' },
        { id: 'e-dpb-refs', from: 'dpb', to: 'refs' },
      ],
    }, { title: 'Prediction reads old frames and writes a new one' }),
    highlight: { active: ['refs', 'motion', 'recon', 'dpb', 'e-dpb-refs', 'e-recon-dpb'], found: ['resid'] },
    explanation: 'Inter prediction is a data-structure loop. The decoder reads reference slots, applies motion compensation, adds residuals, reconstructs a frame, and updates the buffer policy.',
  };

  yield {
    state: labelMatrix(
      'DPB failure modes',
      [
        { id: 'missing', label: 'missing' },
        { id: 'evict', label: 'evict' },
        { id: 'corrupt', label: 'corrupt' },
        { id: 'drift', label: 'drift' },
      ],
      [
        { id: 'cause', label: 'cause' },
        { id: 'symptom', label: 'symptom' },
      ],
      [
        ['packet loss', 'blocky'],
        ['bad policy', 'decode fail'],
        ['bit error', 'propagates'],
        ['mismatch', 'ghosting'],
      ],
    ),
    highlight: { active: ['missing:symptom', 'corrupt:symptom'], compare: ['evict:symptom', 'drift:symptom'] },
    explanation: 'Reference mistakes propagate. A corrupted or missing anchor can damage many dependent frames until the next clean random-access point resets the graph.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'entropy', label: 'entropy' },
        { id: 'refs', label: 'refs' },
        { id: 'tiles', label: 'tiles' },
        { id: 'abr', label: 'ABR' },
      ],
      [
        { id: 'structure', label: 'struct' },
        { id: 'link', label: 'next' },
      ],
      [
        ['coder', 'ANS'],
        ['DAG', 'AV1'],
        ['grid', 'parallel'],
        ['ladder', 'player'],
      ],
    ),
    highlight: { active: ['refs:structure', 'tiles:link'], found: ['abr:link'] },
    explanation: 'A complete media pipeline connects entropy coding, reference graphs, tile layout, packet buffers, and adaptive streaming manifests. Each layer has its own state and failure modes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'gop dag') yield* gopDag();
  else if (view === 'dpb ledger') yield* dpbLedger();
  else throw new InputError('Pick a video-codec view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read each frame as a node in a dependency graph. Active edges show reference requirements, found nodes show decoded pictures available for prediction, and removed nodes show frames that can be released.',
      'A GOP is a group of pictures. An I frame is independent, a P frame predicts from earlier references, and a B frame may use references on both sides of its display time.',
      {type:'callout', text:`A GOP is a dependency graph: better compression comes from keeping decoded reference frames alive until every dependent frame can be reconstructed.`},
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/64/I_P_and_B_frames.svg', alt:'Diagram of I, P, and B video frames with arrows showing reference dependencies.', caption:'I, P, and B frames in a compressed video sequence. Image: Petteri Aimonen, Wikimedia Commons, public domain.'},
    ] },
    { heading: 'Why this exists', paragraphs: ['Video repeats itself across time. Reference frames let a codec store prediction plus residual error instead of resending every pixel in every frame.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious format stores each frame as an independent image. Seeking is simple and corruption is local, but bitrate is far too high for ordinary video.'] },
    { heading: 'The wall', paragraphs: ['The wall is raw pixel volume. A 1920 by 1080 RGB frame is about 6.2 MB, so 30 raw frames per second exceeds 180 MB per second before audio.'] },
    { heading: 'The core insight', paragraphs: ['The core insight is that compression creates a directed acyclic graph. A dependent frame cannot be reconstructed until every referenced frame has already been decoded and retained.'] },
    { heading: 'How it works', paragraphs: ['The encoder chooses anchors and predicts other frames from decoded references. The decoder keeps reconstructed reference pictures in the decoded picture buffer, reads them for motion compensation, adds residuals, and updates retention state.'] },
    { heading: 'Why it works', paragraphs: ['Correctness follows the dependency graph. If every frame decodes only after its references are reconstructed and retained, prediction reads the same pixels the encoder assumed.'] },
    { heading: 'Cost and complexity', paragraphs: ['More references usually reduce residual bits but raise encoder search, decoder memory, and reorder delay. Four 1080p 8-bit 4:2:0 reference pictures need roughly 12 MB of pixel storage before overhead.'] },
    { heading: 'Real-world uses', paragraphs: ['Reference DAGs shape H.264, HEVC, AV1, VP9, streaming startup, trick play, adaptive-bitrate segment boundaries, low-latency calls, and hardware decoder limits.'] },
    { heading: 'Where it fails', paragraphs: ['The DAG model is not the whole codec. Transform coding, quantization, entropy coding, rate control, filters, packets, and network loss all add separate behavior.'] },
    { heading: 'Worked example', paragraphs: ['Use display order I0, B1, B2, P3, B4, B5, P6. If I costs 90 units, P costs 45, and B costs 25, this GOP costs 255 units instead of 630 units for seven independent frames.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: RFC 6184 for H.264 RTP payload behavior at https://www.rfc-editor.org/rfc/rfc6184 and codec standard material for H.264, HEVC, AV1, and VP9 reference-picture rules. Study topological sort, ring buffers, entropy coding, and adaptive-bitrate manifests next.'] },
  ],
};
