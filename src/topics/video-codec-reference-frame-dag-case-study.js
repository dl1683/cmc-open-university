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
    {
      heading: 'What the reference graph is',
      paragraphs: [
        `A modern video codec does not treat a movie as a folder of unrelated pictures. It treats many frames as predictions from other decoded frames plus a residual that fixes the prediction error. The reference-frame graph records those dependencies. A node is a frame or picture. An edge means the target frame cannot be reconstructed until the referenced frame has already been decoded and kept available.`,
        `This graph is usually discussed through a group of pictures, or GOP. I-like frames are intra frames that can be decoded without earlier pictures. P-like frames predict from past references. B-like frames may use references before and after their display time, which means decode order and display order can differ. The GOP is therefore both a compression plan and a scheduling constraint.`,
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        `The obvious video format is a sequence of complete images. That design is simple. Seeking is easy, corruption is local, and each frame can be decoded independently. The wall is bitrate. Adjacent frames often share a background, object shapes, camera motion, lighting, and texture. Re-sending all of that information thirty or sixty times per second wastes the main structure in the data.`,
        `Inter-frame prediction breaks through that wall. Instead of storing the whole next image, the encoder says which blocks can be predicted from already decoded pictures and stores the remaining error. Motion vectors describe where similar content came from. Residual coefficients describe what the prediction missed. The better the reference choice, the fewer bits the residual needs.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is that compression creates dependencies, and dependencies need a data structure. A frame that predicts from another frame is no longer an isolated record. It is a node in a directed acyclic graph. The graph must stay acyclic because decoding cannot depend on a future reconstruction that itself depends back on the current frame. A valid decode schedule is a topological order of that graph.`,
        `This explains why file order, decode timestamp, and presentation timestamp are separate ideas. A B frame can be displayed between two anchor frames while being decoded after the future anchor it references. Players and decoders must respect decode order to build the needed pictures, then use presentation order to show them at the right time. Confusing those orders is a common source of media bugs.`,
      ],
    },
    {
      heading: 'The decoded picture buffer',
      paragraphs: [
        `The decoded picture buffer, usually called the DPB, is the working set for the reference graph. When a frame is reconstructed, the decoder may display it, keep it as a future reference, or both. A displayed frame is not automatically dead. If a later frame still references it, the DPB must keep it until the last dependent picture has been decoded or until the bitstream marks it no longer needed.`,
        `A useful DPB ledger tracks frame identity, reference slot, decode timestamp, presentation timestamp, frame type, reference list, output status, and release status. It also tracks whether a frame is a random-access point, whether it came from a clean segment boundary, and whether error concealment was used. The ledger is small compared with the pixels, but it is what keeps decoder state coherent.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Video has temporal redundancy. If the camera is still and a person moves across a background, most pixels are predictable from nearby frames after motion compensation. If the camera pans, large regions can still be predicted by shifted references. Reference frames let the encoder spend bits on what changed instead of resending what stayed predictable.`,
        `The graph also gives the encoder a controlled way to trade bitrate against latency and robustness. More references and deeper search can reduce residual bits, but they increase encoder work, decoder memory, and reorder delay. Shorter chains, more frequent intra frames, and smaller GOPs cost more bits but improve seeking, startup, live latency, and recovery after loss.`,
      ],
    },
    {
      heading: 'Encoder policy',
      paragraphs: [
        `The encoder chooses the graph shape. It decides how often to place random-access frames, how far references may reach, how many B frames to use, whether references cross segment boundaries, how many reference slots the target decoder can support, and how aggressively to spend compute on motion search. Those choices are product decisions as much as coding decisions.`,
        `Offline video-on-demand encoders can tolerate long lookahead, expensive search, and deeper reference patterns because the viewer pays only the decode cost later. A video call, cloud game, remote desktop, or live stream has a tighter latency budget. It may avoid or limit B frames, shorten GOPs, constrain lookahead, and accept higher bitrate to keep glass-to-glass delay low.`,
      ],
    },
    {
      heading: 'Random access and segmentation',
      paragraphs: [
        `Random access cuts the dependency graph. A player that starts in the middle of a stream cannot decode frames that depend on references from minutes earlier unless it first fetches and decodes those references. Intra or IDR-style access points give the player a place to begin with bounded history. Adaptive streaming systems place segment boundaries around these constraints so a new rendition can be fetched and decoded cleanly.`,
        `There is a cost. Every random-access point spends bits because intra prediction is less efficient than temporal prediction for most ordinary motion. A short GOP improves seeking and channel change time but raises bitrate. A long GOP improves compression but makes starts, scrubs, rendition switches, and error recovery more expensive. Good media systems choose this interval deliberately instead of inheriting a default.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Reference mistakes propagate. If a packet loss, corrupt slice, wrong reference index, bad timestamp, or premature DPB eviction damages an anchor, every dependent frame can inherit visible errors until a clean access point resets the state. The symptom may be blockiness, smearing, ghosting, frozen regions, decode failure, or long recovery time.`,
        `Another failure mode is hidden latency. A stream may report a healthy average bitrate while using a GOP structure that forces reorder delay or decoder buffering the product cannot afford. A stream may also look fine in a local player but fail on constrained devices if reference-slot count, level limits, memory bandwidth, or hardware-decoder support were ignored.`,
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        `Evaluate a reference-frame policy with more than average bitrate. Track bitrate at equal quality, objective or perceptual quality scores such as PSNR, SSIM, or VMAF when appropriate, encode speed, decoder memory, DPB occupancy, reference-slot pressure, startup latency, seek latency, rendition-switch delay, dropped frames, decode errors, and recovery distance after loss. For live systems, include end-to-end latency and jitter under network stress.`,
        `For debugging, log frame id, frame type, decode time, presentation time, reference list, DPB slot, output status, and segment id. When playback breaks, ask whether the referenced pictures existed, whether they were decoded before use, whether they were retained long enough, and whether the player tried to start from a frame that was not actually independently decodable.`,
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        `Reference-frame DAGs are central to video codecs, but the mental model travels. Any system that compresses state by referring to earlier state inherits a dependency graph and a retention policy. Delta files, incremental checkpoints, database snapshots, content-addressed build caches, and predictive telemetry all need to know which base objects must stay alive for dependents to be useful.`,
        `In media specifically, this model explains GOP design, B-frame delay, DPB sizing, trick play, random access, adaptive-bitrate segment alignment, hardware-decoder constraints, and corruption recovery. It gives curriculum builders a concrete way to connect compression, graphs, buffers, scheduling, and product metrics.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `The DAG model is not the whole codec. It does not replace transform coding, quantization, entropy coding, in-loop filtering, rate control, tiling, packetization, or transport behavior. It also hides codec-specific details: reference-picture marking, frame types, refresh rules, prediction modes, and hardware limits differ across standards and implementations.`,
        `It is also easy to overfit to average visual quality. A deep reference graph can be efficient for pristine on-demand playback and still be wrong for a lossy mobile network, a low-latency call, or a device with a small hardware DPB. The right graph is the one that satisfies the product constraints, not the one that minimizes bits in isolation.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Entropy & Information, Arithmetic & ANS Coding, LZ77 Compression, and Quantization to understand why residuals become cheaper to store. Then study Graph Topological Sort for dependency scheduling, Ring Buffer and RTP Jitter Buffer for streaming state, AV1 Tile OBU Superblock for codec structure, and Adaptive Bitrate Manifest Ladder for the player-side decisions that sit on top of GOP boundaries.`,
      ],
    },
  ],
};
