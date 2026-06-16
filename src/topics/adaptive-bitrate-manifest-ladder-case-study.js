// Adaptive bitrate streaming: manifests expose variant ladders and media
// segment indexes; the player chooses a representation from buffer evidence.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'adaptive-bitrate-manifest-ladder-case-study',
  title: 'Adaptive Bitrate Manifest Ladder Case Study',
  category: 'Systems',
  summary: 'A streaming-video case study: HLS/DASH manifests, variant ladders, media playlists, segment indexes, buffer occupancy, throughput estimation, rendition switching, and live-window gaps.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['variant ladder', 'switch policy'], defaultValue: 'variant ladder' },
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

function abrGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'master', label: 'manifest', x: 0.9, y: 3.5, note: notes.master ?? 'variants' },
      { id: 'low', label: '360p', x: 2.9, y: 1.6, note: 'low' },
      { id: 'mid', label: '720p', x: 2.9, y: 3.5, note: 'mid' },
      { id: 'high', label: '1080p', x: 2.9, y: 5.4, note: 'high' },
      { id: 'seg', label: 'segments', x: 5.2, y: 3.5, note: notes.seg ?? 'seq' },
      { id: 'buf', label: 'buffer', x: 7.0, y: 3.5, note: notes.buf ?? 'secs' },
      { id: 'player', label: 'player', x: 8.7, y: 3.5, note: notes.player ?? 'choose' },
    ],
    edges: [
      { id: 'e-master-low', from: 'master', to: 'low' },
      { id: 'e-master-mid', from: 'master', to: 'mid' },
      { id: 'e-master-high', from: 'master', to: 'high' },
      { id: 'e-low-seg', from: 'low', to: 'seg' },
      { id: 'e-mid-seg', from: 'mid', to: 'seg' },
      { id: 'e-high-seg', from: 'high', to: 'seg' },
      { id: 'e-seg-buf', from: 'seg', to: 'buf' },
      { id: 'e-buf-player', from: 'buf', to: 'player' },
    ],
  }, { title });
}

function* variantLadder() {
  yield {
    state: abrGraph('Manifest exposes a bitrate ladder'),
    highlight: { active: ['master', 'low', 'mid', 'high', 'e-master-low', 'e-master-mid', 'e-master-high'], found: ['seg', 'player'] },
    explanation: 'An ABR manifest is a routing table for the player. It names renditions, bandwidth estimates, codecs, resolution, frame rate, and the media playlist or segment template behind each option.',
    invariant: 'Every switchable rendition must stay aligned enough that the player can move without a visible timeline break.',
  };

  yield {
    state: labelMatrix(
      'Variant ladder',
      [
        { id: 'v0', label: '360p' },
        { id: 'v1', label: '540p' },
        { id: 'v2', label: '720p' },
        { id: 'v3', label: '1080p' },
      ],
      [
        { id: 'bw', label: 'bw' },
        { id: 'res', label: 'res' },
        { id: 'codec', label: 'codec' },
      ],
      [
        ['0.8M', '640x360', 'avc1'],
        ['1.6M', '960x540', 'avc1'],
        ['3.0M', '1280x720', 'av01'],
        ['5.5M', '1920x1080', 'av01'],
      ],
    ),
    highlight: { active: ['v1:bw', 'v2:bw'], compare: ['v3:bw'] },
    explanation: 'The ladder is a sorted catalog. Bandwidth is not decoration: inaccurate values can cause stalls or hide playable quality.',
  };

  yield {
    state: labelMatrix(
      'Media playlist',
      [
        { id: 's100', label: '100' },
        { id: 's101', label: '101' },
        { id: 's102', label: '102' },
        { id: 's103', label: '103' },
      ],
      [
        { id: 'dur', label: 'dur' },
        { id: 'uri', label: 'URI' },
        { id: 'state', label: 'state' },
      ],
      [
        ['2.0s', 'seg100', 'cached'],
        ['2.0s', 'seg101', 'fetch'],
        ['2.0s', 'seg102', 'next'],
        ['2.0s', 'seg103', 'live'],
      ],
    ),
    highlight: { active: ['s101:state', 's102:state'], found: ['s103:state'] },
    explanation: 'A live playlist is an append-like window. Sequence numbers, durations, discontinuities, gaps, and target duration define what the player can fetch next.',
  };

  yield {
    state: abrGraph('ABR links CDN, codec, and player buffer', { seg: 'HTTP', buf: 'health', player: 'policy' }),
    highlight: { active: ['seg', 'buf', 'player', 'e-seg-buf', 'e-buf-player'], compare: ['high'] },
    explanation: 'The manifest is only the starting index. The player policy combines measured throughput, buffer health, device limits, DRM constraints, codec support, and user preferences.',
  };
}

function* switchPolicy() {
  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 0, max: 10 }, y: { label: 'Mbps', min: 0, max: 8 } },
      series: [
        { id: 'net', label: 'net', points: [{ x: 0, y: 5.8 }, { x: 2, y: 5.0 }, { x: 4, y: 2.4 }, { x: 6, y: 2.0 }, { x: 8, y: 4.5 }, { x: 10, y: 5.2 }] },
        { id: 'choice', label: 'chosen', points: [{ x: 0, y: 3.0 }, { x: 2, y: 3.0 }, { x: 4, y: 1.6 }, { x: 6, y: 1.6 }, { x: 8, y: 3.0 }, { x: 10, y: 3.0 }] },
      ],
      markers: [
        { id: 'down', label: 'down', x: 4, y: 2.4 },
        { id: 'up', label: 'up', x: 8, y: 4.5 },
      ],
    }, { title: 'Switching smooths network variance' }),
    highlight: { active: ['net'], compare: ['choice'], found: ['down', 'up'] },
    explanation: 'The controller should not chase every throughput sample. It switches down quickly to avoid stalls and switches up more cautiously to avoid oscillation.',
  };

  yield {
    state: labelMatrix(
      'Switch inputs',
      [
        { id: 'thr', label: 'thru' },
        { id: 'buf', label: 'buf' },
        { id: 'dev', label: 'dev' },
        { id: 'gap', label: 'gap' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'action', label: 'action' },
      ],
      [
        ['EWMA', 'cap bw'],
        ['seconds', 'protect'],
        ['codec', 'filter'],
        ['EXT-X-GAP', 'skip'],
      ],
    ),
    highlight: { active: ['thr:action', 'buf:action'], found: ['dev:action', 'gap:action'] },
    explanation: 'ABR selection is a constrained choice over the ladder. Network throughput is only one input; codec support, screen size, DRM, and known gaps can remove variants.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'sample', label: 'sample', x: 0.9, y: 3.5, note: 'bytes/s' },
        { id: 'est', label: 'est', x: 2.5, y: 3.5, note: 'EWMA' },
        { id: 'ladder', label: 'ladder', x: 4.3, y: 2.0, note: 'sorted' },
        { id: 'rules', label: 'rules', x: 4.3, y: 5.0, note: 'filters' },
        { id: 'choice', label: 'choice', x: 6.5, y: 3.5, note: 'next seg' },
        { id: 'tele', label: 'telemetry', x: 8.4, y: 3.5, note: 'QoE' },
      ],
      edges: [
        { id: 'e-sample-est', from: 'sample', to: 'est' },
        { id: 'e-est-choice', from: 'est', to: 'choice' },
        { id: 'e-ladder-choice', from: 'ladder', to: 'choice' },
        { id: 'e-rules-choice', from: 'rules', to: 'choice' },
        { id: 'e-choice-tele', from: 'choice', to: 'tele' },
        { id: 'e-tele-rules', from: 'tele', to: 'rules' },
      ],
    }, { title: 'The player is a closed-loop controller' }),
    highlight: { active: ['sample', 'est', 'ladder', 'rules', 'choice'], found: ['tele'] },
    explanation: 'Good players record why a rendition was chosen. Without that trace, a stall can be caused by bad bandwidth labels, CDN variance, codec mismatch, or an overaggressive upswitch.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'stall', label: 'stall' },
        { id: 'osc', label: 'osc' },
        { id: 'gap', label: 'gap' },
        { id: 'drm', label: 'DRM' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['buf zero', 'downshift'],
        ['flip-flop', 'hysteresis'],
        ['missing', 'alt var'],
        ['blocked', 'filter'],
      ],
    ),
    highlight: { active: ['stall:fix', 'osc:fix'], found: ['gap:fix', 'drm:fix'] },
    explanation: 'A complete ABR data structure is operational: manifest facts, segment observations, buffer state, device constraints, and playback outcomes all belong in the same trace.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'variant ladder') yield* variantLadder();
  else if (view === 'switch policy') yield* switchPolicy();
  else throw new InputError('Pick an adaptive-bitrate view.');
}

export const article = {
  sections: [
    { heading: 'What it is', paragraphs: ['Adaptive bitrate streaming splits media into segments and publishes a manifest that describes multiple playable renditions. The player chooses which rendition to fetch next based on measured throughput, buffer health, device support, and presentation rules.', 'HLS uses Multivariant Playlists and Media Playlists. MPEG-DASH uses an MPD with periods, adaptation sets, representations, and segment addressing. The shared data-structure idea is a manifest-backed ladder plus a time-indexed segment catalog.'] },
    { heading: 'How it works', paragraphs: ['The client loads the manifest, filters renditions by codec, resolution, DRM, captions, and device constraints, then fetches media segments. After each fetch it updates throughput estimates and buffer occupancy before choosing the next segment.', 'For live streams, the manifest can change as the live window advances. Sequence numbers, target duration, gaps, discontinuities, and period boundaries become correctness facts, not just text tags.'] },
    { heading: 'Cost and complexity', paragraphs: ['The ladder trades storage and encoding cost for playback resilience. More variants can improve quality matching, but they increase encoding work, CDN footprint, manifest complexity, and testing matrix size. Smaller segments reduce latency but raise request overhead.'] },
    { heading: 'Complete case study', paragraphs: ['A player starts at 720p, measures a throughput drop, and chooses 540p for the next segment before the buffer drains. Later the network recovers; the player waits for buffer health and stable estimates before returning to 720p. If one variant has a gap, it tries another variant for the same rendition instead of stalling on a known-missing segment.', 'The trace records manifest version, variant id, bandwidth label, measured bytes per second, selected segment, buffer seconds, dropped frames, stall events, and switch reason.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not let the manifest lie. Bad BANDWIDTH or average bandwidth values can cause stalls or unnecessarily low quality. Do not switch on instantaneous throughput alone. Do not assume every variant is interchangeable unless segment timing, codec support, captions, encryption, and discontinuities line up.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: RFC 8216 HTTP Live Streaming at https://datatracker.ietf.org/doc/html/rfc8216, current HLS 2nd Edition draft at https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis-22, Apple HLS authoring specification at https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices, and DASH-IF timing model guidelines at https://dashif.org/Guidelines-TimingModel/. Study CDN Request Flow, HTTP/3 QUIC Stream Multiplexing Case Study, Backpressure, Video Codec Reference Frame DAG Case Study, AV1 Tile OBU Superblock Case Study, and RTP Jitter Buffer Packet Reorder Case Study next.'] },
  ],
};
