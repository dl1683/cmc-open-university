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
      heading: 'Why This Exists',
      paragraphs: [
        'Video playback wants a steady timeline, but the network does not provide one. Throughput changes as a phone moves between cells, Wi-Fi competes with other devices, a CDN cache misses, or a browser shares bandwidth with other tabs. The viewer experiences time continuously: if the next two seconds of video do not arrive before playback reaches them, the player stalls. Adaptive bitrate streaming exists to turn an unstable network into a mostly steady viewing experience.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Netflix_icon.svg', alt: 'Streaming service icon', caption: 'Adaptive bitrate streaming enables buffer-free video at any connection speed. Source: Wikimedia Commons, Netflix, Public domain' },
        {type:'callout', text:'The key insight of adaptive bitrate: instead of one file at one quality, the server publishes a ladder of renditions and lets the player switch segment-by-segment. This turns a binary outcome (plays vs. stalls) into a continuous quality dial the client controls in real time based on network evidence.'},
        'The system does that by publishing several encoded versions of the same content and letting the player choose segment by segment. A manifest describes the ladder of renditions, the codecs and resolutions they require, and the playlists or templates that address the media segments. The player then becomes a small controller. It observes download speed, buffer seconds, device limits, and manifest facts, then chooses the representation for the next segment.',
      ],
    },
    {
      heading: 'The Obvious Approach',
      paragraphs: [
        'The simplest server design is one video file at one bitrate. That worked when content was downloaded before playback or when the audience had predictable connections. It is still a reasonable first thought: one file is easy to cache, easy to test, and easy to reason about. The server does not need a ladder, and the player does not need a switching policy.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Stack_Overflow_icon.svg', alt: 'Network bandwidth variation', caption: 'Fixed-bitrate streaming fails when bandwidth fluctuates. Source: Wikimedia Commons' },
        'The wall is heterogeneity. A bitrate that looks fine on fiber can stall on a train. A bitrate that is safe on a weak connection wastes quality on a large screen with enough bandwidth. A single file also leaves the player with no local move when the network changes mid-session. It can wait, pause, or fail, but it cannot trade resolution for time. Internet video needs multiple valid futures at each point on the timeline.',
        { type: 'callout', text: 'A 4K stream at 25 Mbps consumes 11 GB per hour. Encoding at every quality level multiplies storage linearly — a 10-rung ladder means 10x the origin storage for every title.' },
      ],
    },
    {
      heading: 'The Core Insight',
      paragraphs: [
        'The core insight is to divide video into aligned segments across a bitrate ladder. Every rendition describes the same timeline, but at different quality, size, codec, or frame-rate choices. If segment 101 is the next two seconds of the movie, the player can request the 360p, 720p, or 1080p version of segment 101 and still continue the same playback timeline. The manifest is the routing table that makes those choices visible.',
        { type: 'callout', text: 'The client, not the server, chooses quality. Only the client knows its buffer level, screen resolution, and recent throughput measurements. Server-side quality decisions always arrive too late.' },
        'The invariant is timeline compatibility. Switchable renditions must line up closely enough that the player can move between them without a visible jump, audio drift, missing frames, or decoder break. ABR is not only picking the highest bitrate below the last speed sample. It is maintaining a buffer while moving through a constrained graph of playable segment choices.',
      ],
    },
    {
      heading: 'How It Works',
      paragraphs: [
        'A top-level HLS or DASH manifest lists variants. Each variant carries facts such as nominal bandwidth, resolution, codecs, frame rate, audio group, subtitles, DRM requirements, and the URL of a media playlist or segment template. A media playlist then lists segment sequence numbers, durations, URIs, discontinuities, and live-window markers. The player uses those lists as indexes into CDN objects.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching network', caption: 'Video segments travel as packets through variable-bandwidth network paths. Source: Wikimedia Commons, Oddbodz, Public domain' },
        'At startup, the player chooses an initial rendition, often conservatively, because it has little evidence. After each segment download, it measures bytes over time, updates a throughput estimate such as an EWMA, and updates buffer occupancy. It filters variants the device cannot decode, the screen cannot use, the DRM session cannot play, or the manifest marks as unavailable. Then it chooses the next segment representation.',
        'A stable switch policy is asymmetric. It should switch down quickly when buffer is at risk because a stall is worse than a temporary quality drop. It should switch up more cautiously because one good sample may be noise. Many controllers combine throughput estimates, buffer thresholds, hysteresis, startup rules, and quality caps. The best choice is not the highest row in the ladder; it is the row most likely to keep future playback smooth.',
      ],
    },
    {
      heading: 'What the Visual Proves',
      paragraphs: [
        'The variant-ladder visual shows the manifest as a routing table. One manifest fans out to 360p, 720p, and 1080p renditions, each leading to segment lists. The lesson is that a rendition is not just a prettier file. It is a compatible route through the same timeline. The bandwidth labels, codec strings, and segment indexes are control data the player needs for safe switching.',
        'The switch-policy visual shows the feedback loop. Network throughput moves up and down, while the chosen bitrate changes more slowly. That gap is deliberate. The controller is trying to absorb variance with buffer, not mirror every measurement. The failure ledger then connects visual behavior to operations: zero buffer means stall, flip-flopping means missing hysteresis, gaps need alternate segments or variants, and DRM or codec filters can remove rows from the ladder.',
      ],
    },
    {
      heading: 'Why It Works',
      paragraphs: [
        'The correctness argument is a timing argument. Playback consumes media seconds at a fixed rate. Download adds media seconds to the buffer at a rate determined by segment size and network throughput. If the player keeps choosing segments that download before the buffer reaches zero, playback continues. If a rendition switch preserves the media timeline and decoder constraints, the viewer sees a quality change instead of a discontinuity.',
        { type: 'callout', text: 'ABR works because human perception is forgiving: viewers tolerate gradual quality drops far better than rebuffering pauses. Trading resolution for continuity is almost always the right call.' },
        'The controller works because it uses buffer as slack. A short throughput drop does not have to cause a stall if the buffer already contains enough future media. A cautious upswitch protects that slack. A fast downshift rebuilds it. The manifest works because it offers precomputed alternatives, so the player can respond locally without asking the server to re-encode video during playback.',
      ],
    },
    {
      heading: 'Cost and Behavior',
      paragraphs: [
        'ABR moves cost from playback time to packaging time. The publisher has to encode multiple renditions, store more objects, generate manifests, align segments, test codec combinations, and monitor a larger CDN footprint. More ladder rungs improve matching to devices and networks, but every rung adds encoding cost, cache pressure, QA cases, and observability work. A ladder with too few rungs causes either stalls or visible quality waste.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'CDN server infrastructure', caption: 'Each bitrate ladder rung multiplies storage and CDN costs. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0' },
        'Segment duration is another tradeoff. Shorter segments reduce live latency and let the player react sooner, but they increase HTTP request overhead and make throughput samples noisier. Longer segments are easier to cache and estimate, but the player reacts more slowly and live latency grows. Low-latency modes add partial segments and preload hints, which reduce delay but make timing, cache behavior, and failure handling tighter.',
      ],
    },
    {
      heading: 'Where It Wins',
      paragraphs: [
        'ABR wins for internet video because it matches one catalog to many devices and networks. A phone on cellular, a TV on fiber, a laptop on hotel Wi-Fi, and a live viewer near the edge of the window can all use the same logical stream while selecting different renditions. CDNs like it because segments are ordinary HTTP objects. Players like it because the next decision is local.',
        { type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Internet_map_1024.jpg', alt: 'Internet topology map', caption: 'ABR algorithms must adapt to diverse network conditions across the global internet. Source: Wikimedia Commons, The Opte Project, CC BY 2.5' },
        'It also wins as an operational model. Startup delay, rebuffering, low quality, oscillation, and live-edge drift can be traced through manifest metadata, segment fetches, buffer health, and switch reasons. A useful ABR event log records manifest version, selected variant, bandwidth label, measured throughput, buffer seconds, dropped frames, gap handling, device filters, and the reason for each switch.',
      ],
    },
    {
      heading: 'Where It Fails',
      paragraphs: [
        'ABR fails when the ladder lies. Inaccurate BANDWIDTH values can push the player into a rendition it cannot sustain or keep it below quality it could have played. Misaligned segments make switching visible. Codec mismatches, DRM differences, discontinuities, missing segments, and live-window gaps can make variants non-interchangeable even though they appear in the same manifest.',
        'It also fails when the controller chases noise. Instantaneous throughput is a bad sole signal because each segment download includes CDN behavior, TCP or QUIC dynamics, cache misses, device scheduling, and competing traffic. A controller with no hysteresis can bounce between qualities and annoy the viewer without improving stall risk. ABR needs smoothing, guardrails, fallback behavior, and telemetry that explains bad choices after the fact.',
      ],
    },
    {
      heading: 'Study Next',
      paragraphs: [
        'Primary sources: RFC 8216 HLS at https://datatracker.ietf.org/doc/html/rfc8216, the HLS 2nd Edition draft at https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis-22, Apple HLS authoring guidance at https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices, and DASH-IF timing model guidelines at https://dashif.org/Guidelines-TimingModel/.',
        'Study CDN Request Flow for object fetch behavior, HTTP/3 QUIC Stream Multiplexing for transport effects, Backpressure for flow-control intuition, Video Codec Reference Frame DAG for why segments and decoder state must align, AV1 Tile OBU Superblock for codec structure, RTP Jitter Buffer for real-time packet smoothing, and Cache Status HTTP Observability for the CDN evidence behind segment fetches.',
      ],
    },
  ],
};
