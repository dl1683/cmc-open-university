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
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The variant-ladder view shows adaptive bitrate streaming, or ABR, as a set of aligned video routes. A rendition is one encoded version of the same media timeline, usually at a specific resolution, codec, and bitrate. Active rows show which rendition and segment the player can choose next.',
        'The switch-policy view shows the feedback loop between throughput, buffer, and selected quality. Buffer means seconds of future media already downloaded. The safe inference is that a lower bitrate can be correct when it prevents the buffer from reaching zero.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg', alt: 'Streaming service icon', caption: 'Adaptive bitrate streaming enables buffer-free video at any connection speed. Source: Wikimedia Commons, Netflix, Public domain' },
        {type:'callout', text:'The key insight of adaptive bitrate: instead of one file at one quality, the server publishes a ladder of renditions and lets the player switch segment-by-segment. This turns a binary outcome (plays vs. stalls) into a continuous quality dial the client controls in real time based on network evidence.'},
        'Video playback consumes time steadily, but networks deliver bytes unevenly. A phone changes cells, Wi-Fi competes with other devices, a CDN cache misses, or a browser shares bandwidth. If the next segment does not arrive before playback reaches it, the viewer sees a stall.',
        'ABR exists to turn unstable delivery into a smooth timeline. The server publishes a manifest, which is an index of playable variants and segments. The player uses the manifest plus local measurements to choose the next segment quality.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Stack_Overflow_icon.svg', alt: 'Network bandwidth variation', caption: 'Fixed-bitrate streaming fails when bandwidth fluctuates. Source: Wikimedia Commons' },
        'The obvious design is one video file at one bitrate. That is easy to encode, cache, test, and reason about. It works when the viewer downloads before playback or when the network is stable enough to sustain the chosen bitrate.',
        'It also feels fair to choose a middle bitrate. A 5 Mbps file may play on many home connections and look acceptable on many screens. The server stays simple because there is no ladder and no switching policy.',
        { type: 'callout', text: 'A 4K stream at 25 Mbps consumes 11 GB per hour. Encoding at every quality level multiplies storage linearly — a 10-rung ladder means 10x the origin storage for every title.' },
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is heterogeneity plus change. A bitrate that is safe on a train wastes quality on fiber, and a bitrate that looks good on a TV stalls on weak cellular. Even one viewer can move between those states during the same session.',
        'A single file gives the player no local control. When bandwidth drops, it can wait, pause, or fail, but it cannot trade resolution for continuity. Internet video needs several valid futures at each playback time.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        { type: 'callout', text: 'The client, not the server, chooses quality. Only the client knows its buffer level, screen resolution, and recent throughput measurements. Server-side quality decisions always arrive too late.' },
        'ABR divides the same timeline into aligned segments across a ladder of renditions. If segment 101 is the next two seconds of the movie, the player can request the 360p, 720p, or 1080p version and still continue the same timeline. The manifest is the routing table for those choices.',
        'The invariant is timeline compatibility. Renditions must align closely enough that switching does not create missing frames, audio drift, decoder failure, or visible discontinuity. The controller is not chasing the highest bitrate; it is preserving future playback.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching network', caption: 'Video segments travel as packets through variable-bandwidth network paths. Source: Wikimedia Commons, Oddbodz, Public domain' },
        'A top-level HLS or DASH manifest lists variants with bandwidth, resolution, codec, frame rate, audio groups, subtitle groups, and URLs. Each variant points to segment lists or templates. The player treats those lists as indexes into CDN objects.',
        'At startup, the player usually chooses a conservative rendition because it has little evidence. After each segment download, it measures bytes over time, updates a throughput estimate, checks buffer seconds, filters unsupported variants, and chooses the next segment. Downshifts are fast because a stall is worse than a temporary quality drop; upshifts are slower because one good sample may be noise.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        { type: 'callout', text: 'ABR works because human perception is forgiving: viewers tolerate gradual quality drops far better than rebuffering pauses. Trading resolution for continuity is almost always the right call.' },
        'The correctness argument is a timing argument. Playback consumes one media second per wall-clock second. Downloads add future media to the buffer; if each chosen segment arrives before buffer reaches zero, playback continues.',
        'Switching works because aligned renditions represent the same media interval. If the codec and decoder constraints also match, the viewer sees quality change instead of a timeline break. Buffer is the slack that lets the controller absorb short network drops.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'CDN server infrastructure', caption: 'Each bitrate ladder rung multiplies storage and CDN costs. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },
        'ABR moves cost from playback time to packaging time. The publisher encodes multiple renditions, stores more objects, generates manifests, aligns segments, tests codec combinations, and monitors a larger CDN footprint. Ten ladder rungs can mean roughly ten stored video versions before audio, subtitles, DRM, and packaging overhead.',
        'Segment duration changes behavior. Two-second segments react faster and reduce live latency, but they increase request overhead and make throughput samples noisy. Six-second segments are easier to cache and estimate, but they react more slowly and increase live delay.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map', caption: 'ABR algorithms must adapt to diverse network conditions across the global internet. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
        'ABR is the default model for large-scale internet video, live events, mobile playback, smart TVs, and browser streaming. It lets one catalog serve many devices and networks while the client makes local choices. CDNs like it because segments are cacheable HTTP objects.',
        'It also gives operators useful evidence. A player log can record manifest version, selected variant, measured throughput, buffer seconds, dropped frames, gap handling, device filters, and switch reason. Those fields turn viewer complaints into debuggable control decisions.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'ABR fails when the manifest lies. Bad bandwidth labels can push players too high or keep them too low. Misaligned segments, codec mismatches, DRM differences, discontinuities, and missing segments can make listed variants non-interchangeable.',
        'It also fails when the controller chases noise. Instantaneous throughput includes CDN cache behavior, TCP or QUIC dynamics, device scheduling, and competing traffic. Without smoothing and hysteresis, a player can bounce between qualities while improving neither quality nor stall risk.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A player has a ladder with 360p at 1 Mbps, 720p at 3 Mbps, 1080p at 6 Mbps, and 4K at 15 Mbps. Segments are 2 seconds long, so a 1080p segment is about 12 megabits and a 720p segment is about 6 megabits. The buffer starts at 8 seconds.',
        'The last three downloads measure 8, 7, and 4 Mbps, so the smoothed estimate falls to about 5.8 Mbps. The player does not pick 1080p at 6 Mbps because the margin is thin and buffer is only 8 seconds. It chooses 720p for the next segment, which downloads in about 1.0 second at 6 Mbps and grows buffer instead of risking a stall.',
        'After five stable samples above 10 Mbps and buffer above 20 seconds, the controller can move back to 1080p. It still avoids 4K because 15 Mbps would consume the buffer if the network dips again. The behavior is conservative because the cost of a stall is visible to the viewer immediately.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources are RFC 8216 for HLS, the HLS second-edition draft, Apple HLS authoring guidance, and DASH-IF timing-model guidelines. Read manifest rules and timing rules before tuning a controller because switch safety depends on packaging facts.',
        'Study next: CDN Request Flow for object fetch behavior, HTTP/3 QUIC Stream Multiplexing for transport effects, Backpressure for control intuition, Video Codec Reference Frame DAG for decoder constraints, RTP Jitter Buffer for real-time smoothing, and Cache Status HTTP Observability for segment-fetch evidence.',
      ],
    },
  ],
};
