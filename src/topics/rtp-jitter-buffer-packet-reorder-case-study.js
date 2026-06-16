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
    { heading: 'What it is', paragraphs: ['An RTP jitter buffer is the receiver-side data structure that reorders packets, absorbs network delay variation, detects loss, and releases media to the decoder at a playout clock.', 'It is not a generic FIFO. It is a time-indexed and sequence-indexed window with deadlines. Some packets are held, some are repaired or concealed, and some are dropped because they missed their useful playout time.'] },
    { heading: 'How it works', paragraphs: ['RTP sequence numbers detect gaps and out-of-order delivery. RTP timestamps map packets to media time. Local arrival time estimates network delay variation. The buffer chooses a nominal delay, releases packets in media order, and reports quality through RTCP.', 'Adaptive de-jitter buffers increase delay when jitter spikes and reduce it when the path stabilizes. The policy must avoid both underrun glitches and runaway latency.'] },
    { heading: 'Cost and complexity', paragraphs: ['The core operations are bounded insert by sequence number, gap detection, deadline checks, playout pop, loss concealment handoff, and metric reporting. The hard part is control: how fast to adapt, how to handle clock drift, how to separate burst loss from reordering, and how to interact with congestion control.'] },
    { heading: 'Complete case study', paragraphs: ['A video call receives packets 100, 102, 101, then 103. The receiver holds 102 until 101 arrives, updates jitter estimates, and releases media in timestamp order. Later, packet 140 misses its playout deadline, so the decoder conceals the loss and RTCP reports the event.', 'The production ledger records sequence number, RTP timestamp, arrival time, release time, loss status, concealment, buffer delay, high-water mark, and RTCP feedback.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not optimize only for packet retention. Keeping every late packet can make a call unusably delayed. Do not treat RTP timestamp order and network arrival order as the same thing. Do not hide packet loss metrics inside the decoder if the sender needs feedback.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: RTP RFC 3550 at https://datatracker.ietf.org/doc/html/rfc3550 and RTCP XR de-jitter buffer metrics RFC 7005 at https://www.rfc-editor.org/rfc/rfc7005.txt. Study Ring Buffer, TCP Reassembly + SACK Scoreboard, Backpressure, HTTP/3 QUIC Stream Multiplexing Case Study, and Adaptive Bitrate Manifest Ladder Case Study next.'] },
  ],
};
