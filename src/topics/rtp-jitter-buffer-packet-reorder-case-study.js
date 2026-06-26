// RTP jitter buffer: reorder RTP packets by sequence number and hold them long
// enough to absorb delay variation before decoder playout.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'rtp-jitter-buffer-packet-reorder-case-study',
  title: 'RTP Jitter Buffer Packet Reorder Case Study',
  category: 'Systems',
  summary: 'A real-time media case study: RTP sequence numbers, timestamp clocks, packet reordering, jitter estimates, adaptive playout delay, loss concealment, and RTCP feedback.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['packet reorder', 'playout control'], defaultValue: 'packet reorder' },
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

function rtpGraph(title) {
  return graphState({
    nodes: [
      { id: 'net', label: 'net', x: 0.9, y: 3.6, note: 'UDP' },
      { id: 'seq', label: 'seq', x: 2.5, y: 2.0, note: 'order' },
      { id: 'buf', label: 'buffer', x: 4.5, y: 3.6, note: 'delay' },
      { id: 'loss', label: 'loss', x: 4.5, y: 5.7, note: 'gap' },
      { id: 'dec', label: 'decode', x: 6.6, y: 3.6, note: 'frames' },
      { id: 'rtcp', label: 'RTCP', x: 8.5, y: 2.0, note: 'stats' },
      { id: 'play', label: 'play', x: 8.5, y: 5.0, note: 'clock' },
    ],
    edges: [
      { id: 'e-net-seq', from: 'net', to: 'seq' },
      { id: 'e-seq-buf', from: 'seq', to: 'buf' },
      { id: 'e-buf-dec', from: 'buf', to: 'dec' },
      { id: 'e-loss-dec', from: 'loss', to: 'dec' },
      { id: 'e-dec-play', from: 'dec', to: 'play' },
      { id: 'e-buf-rtcp', from: 'buf', to: 'rtcp' },
    ],
  }, { title });
}

function* packetReorder() {
  yield {
    state: rtpGraph('RTP receiver restores playout order'),
    highlight: { active: ['net', 'seq', 'buf', 'e-net-seq', 'e-seq-buf'], found: ['dec', 'play'] },
    explanation: 'RTP packets arrive over an unreliable network. The receiver uses sequence numbers to detect gaps and reorder packets before decoding media at the playout clock.',
    invariant: 'The decoder should see media time order, not raw network arrival order.',
  };

  yield {
    state: labelMatrix(
      'Arrival window',
      [
        { id: 'p10', label: '100' },
        { id: 'p11', label: '101' },
        { id: 'p12', label: '102' },
        { id: 'p13', label: '103' },
      ],
      [
        { id: 'arr', label: 'arr' },
        { id: 'seq', label: 'seq' },
        { id: 'action', label: 'act' },
      ],
      [
        ['1st', '100', 'play'],
        ['3rd', '101', 'wait'],
        ['2nd', '102', 'hold'],
        ['late', '103', 'drop?'],
      ],
    ),
    highlight: { active: ['p11:action', 'p12:action'], compare: ['p13:action'] },
    explanation: 'A jitter buffer is a bounded reorder map plus a playout deadline. Waiting too little causes gaps; waiting too long adds conversational latency.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'packet', min: 0, max: 8 }, y: { label: 'arrival ms', min: 0, max: 160 } },
      series: [
        { id: 'arrival', label: 'arrival', points: [{ x: 1, y: 22 }, { x: 2, y: 70 }, { x: 3, y: 52 }, { x: 4, y: 95 }, { x: 5, y: 84 }, { x: 6, y: 125 }] },
        { id: 'playout', label: 'playout', points: [{ x: 1, y: 80 }, { x: 2, y: 100 }, { x: 3, y: 120 }, { x: 4, y: 140 }, { x: 5, y: 160 }, { x: 6, y: 180 }] },
      ],
      markers: [
        { id: 'spike', label: 'spike', x: 2, y: 70 },
        { id: 'late', label: 'late', x: 6, y: 125 },
      ],
    }, { title: 'Jitter turns arrival time into a control problem' }),
    highlight: { active: ['arrival'], found: ['spike', 'late'], compare: ['playout'] },
    explanation: 'The receiver estimates delay variation and moves the playout point. The goal is enough slack for common jitter without growing latency forever.',
  };

  yield {
    state: labelMatrix(
      'Receiver state',
      [
        { id: 'seq', label: 'seq map' },
        { id: 'ts', label: 'RTP ts' },
        { id: 'clock', label: 'clock' },
        { id: 'nack', label: 'NACK' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['packets', 'order'],
        ['media time', 'sync'],
        ['wall time', 'play'],
        ['gaps', 'repair'],
      ],
    ),
    highlight: { active: ['seq:stores', 'ts:stores'], found: ['nack:why'] },
    explanation: 'The useful abstraction is a small indexed window, not an unbounded queue. Sequence numbers, RTP timestamps, and local time all answer different questions.',
  };
}

function* playoutControl() {
  yield {
    state: labelMatrix(
      'Delay policy',
      [
        { id: 'fixed', label: 'fixed' },
        { id: 'adapt', label: 'adapt' },
        { id: 'low', label: 'lowlat' },
        { id: 'lossy', label: 'lossy' },
      ],
      [
        { id: 'benefit', label: 'benefit' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['simple', 'stalls'],
        ['smooth', 'lag'],
        ['fast', 'drops'],
        ['conceal', 'quality'],
      ],
    ),
    highlight: { active: ['adapt:benefit', 'low:benefit'], compare: ['adapt:risk', 'low:risk'] },
    explanation: 'Fixed buffers are predictable but brittle. Adaptive buffers track jitter, high-water marks, and late loss so calls stay intelligible under changing networks.',
  };

  yield {
    state: rtpGraph('RTCP reports close the control loop'),
    highlight: { active: ['buf', 'rtcp', 'e-buf-rtcp'], found: ['loss', 'dec'], compare: ['play'] },
    explanation: 'RTCP feedback exposes packet loss, jitter, and jitter-buffer behavior. Senders can lower bitrate, change packetization, or request key frames when receiver state degrades.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'network jitter', min: 0, max: 100 }, y: { label: 'delay budget', min: 0, max: 180 } },
      series: [
        { id: 'nom', label: 'nom', points: [{ x: 0, y: 40 }, { x: 20, y: 55 }, { x: 40, y: 75 }, { x: 70, y: 115 }, { x: 100, y: 150 }] },
        { id: 'loss', label: 'loss', points: [{ x: 0, y: 5 }, { x: 20, y: 10 }, { x: 40, y: 22 }, { x: 70, y: 48 }, { x: 100, y: 82 }] },
      ],
      markers: [
        { id: 'voice', label: 'voice', x: 20, y: 55 },
        { id: 'video', label: 'video', x: 60, y: 100 },
      ],
    }, { title: 'Adaptive buffers trade delay for fewer misses' }),
    highlight: { active: ['nom'], compare: ['loss'], found: ['voice', 'video'] },
    explanation: 'The controller should track both sides: higher delay reduces late loss, but excessive delay hurts interaction. Voice and video often choose different targets.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'rtp', label: 'RTP' },
        { id: 'tcp', label: 'TCP' },
        { id: 'abr', label: 'ABR' },
        { id: 'cdn', label: 'CDN' },
      ],
      [
        { id: 'structure', label: 'struct' },
        { id: 'link', label: 'link' },
      ],
      [
        ['seq win', 'jitter'],
        ['reasm', 'stream'],
        ['buffer', 'switch'],
        ['cache', 'edge'],
      ],
    ),
    highlight: { active: ['rtp:structure', 'abr:structure'], found: ['cdn:link'] },
    explanation: 'Real-time RTP and HTTP adaptive streaming solve different transport problems, but both are buffer-control systems with explicit state and feedback.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'packet reorder') yield* packetReorder();
  else if (view === 'playout control') yield* playoutControl();
  else throw new InputError('Pick an RTP jitter-buffer view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a receiver-side deadline system. RTP means Real-time Transport Protocol, a packet format for audio and video streams; each packet carries a sequence number for order and a timestamp for media time.',
        'The active packet is the one being inserted, released, or declared too late. A found packet is playable because it arrived before its playout deadline, which is the scheduled moment when the decoder needs that media frame.',
        {type:'callout', text:'A jitter buffer is a bounded sequence-indexed reorder window that trades added latency for in-order media before each playout deadline.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Real-time calls use packets, and packet networks do not deliver every packet at the same delay. Jitter means variation in delay, so packet 102 can arrive before packet 101 even when the sender emitted 101 first.',
        'A decoder needs media in timestamp order at a steady rate. The jitter buffer exists between the network and decoder so short delay variation becomes waiting time instead of clicks, frozen frames, or out-of-order decode errors.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to play packets as soon as they arrive. That minimizes added latency and can work on a lab network where packet delay barely varies.',
        'A slightly better first attempt is a fixed FIFO queue, which waits 40 ms and then releases packets in arrival order. FIFO means first in, first out, so it does not understand RTP sequence numbers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the playout clock. When the clock reaches the media time for packet 101, the receiver must play it, conceal it, or skip it; waiting forever would turn loss into conversation delay.',
        'Fixed delay also fails because networks change. A 40 ms buffer wastes time on a stable wired link and drops late packets on a congested cellular link where delay spikes to 120 ms.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The buffer must be keyed by sequence number, not by arrival order. Sequence number defines media order, RTP timestamp defines when the media should play, and local arrival time measures how unstable the network path is.',
        'The policy is a trade between latency and loss. More waiting absorbs more jitter but makes conversation sluggish; less waiting feels responsive but turns ordinary delay variation into late loss.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'On arrival, the receiver checks the packet sequence number, rejects duplicates, inserts the packet into a bounded reorder map, and records arrival time. Missing sequence numbers create gaps that can trigger repair, such as NACK, which is a negative acknowledgement asking the sender to retransmit if time remains.',
        'On each playout tick, the scheduler asks for the packet whose timestamp maps to the current media time. If the packet is present, it goes to the decoder; if it is missing and the deadline has passed, the receiver conceals the loss or advances.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from two invariants. The buffer never releases packets out of sequence order, and it never holds a packet after the playout deadline where it could no longer help the decoder.',
        'Adaptation works because arrival measurements estimate how much delay variation the path is producing. Raising target delay during bursts converts some late packets into playable packets, while lowering it during stable periods returns latency to the user.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Insertion and lookup are O(1) with an array or ring buffer sized to the reorder window, and O(log n) if a tree map is used. Memory is bounded by bitrate times target delay, so a 2 Mbps stream buffered for 100 ms holds about 25 KB of media payload plus packet overhead.',
        'The behavioral cost is latency. Increasing target delay from 40 ms to 100 ms may save packets during jitter bursts, but it also adds 60 ms to every mouth-to-ear path, even when the network is healthy.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Jitter buffers sit inside WebRTC calls, VoIP phones, video conferencing clients, game voice chat, live streaming receivers, and broadcast contribution links. They are most useful when the application values timeliness more than perfect delivery.',
        'They also feed congestion and quality control loops. Late loss, jitter estimates, and concealment events tell the sender whether to reduce bitrate, change codec settings, or request fewer packets per second.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A jitter buffer cannot recover packets that arrive after their media moment unless the application is willing to add more latency. It also cannot fix sustained congestion, bad clocks, codec dependency chains, or loss bursts longer than the buffer window.',
        'It can make quality worse when adaptation chases noise. Raising delay too aggressively makes calls feel delayed, while shrinking delay too quickly can create repeated late loss after every burst.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume 20 ms audio packets with sequence numbers 100, 101, 102, and 103. Packet 100 arrives at 0 ms, 102 at 38 ms, 101 at 44 ms, and 103 at 61 ms; with a 60 ms playout delay, packet 100 plays at 60 ms, 101 at 80 ms, 102 at 100 ms, and 103 at 120 ms.',
        'The reorder is harmless because 101 arrives before its 80 ms deadline even though 102 arrived first. If packet 101 arrived at 95 ms instead, the buffer would conceal 101 at 80 ms and discard or ignore the late packet when it finally arrived.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: RFC 3550 RTP at https://www.rfc-editor.org/rfc/rfc3550 and the WebRTC jitter buffer design notes in the WebRTC source tree. Study UDP versus TCP, sequence numbers, congestion control, packet loss concealment, and adaptive bitrate control next.',
      ],
    },
  ],
};

