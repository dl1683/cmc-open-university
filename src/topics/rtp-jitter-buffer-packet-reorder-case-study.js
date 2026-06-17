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
      heading: 'Why this exists',
      paragraphs: [
        `Real-time media has a different goal from file transfer. A video call does not need every old packet eventually; it needs the next audio frame or video frame soon enough to keep conversation intelligible. Networks do not naturally provide that shape. UDP packets can arrive late, arrive out of order, arrive in bursts, or disappear. The decoder, however, wants media in timestamp order at a steady playout rhythm.`,
        `An RTP jitter buffer is the receiver-side structure that absorbs some of that disorder. It is not merely a queue. It is a bounded reorder window indexed by RTP sequence number, tied to RTP timestamps and a local playout clock. It waits long enough for normal delay variation, releases packets in media order, treats missing packets as loss when their deadline passes, and gives the decoder or concealment logic a controlled stream of frames.`,
        `The hard part is that every millisecond spent waiting has a cost. More delay hides more jitter, but it also makes conversation feel delayed. Less delay improves responsiveness, but it turns ordinary network variation into audible gaps or frozen video. The jitter buffer exists because real-time media is a control problem, not just a buffering problem.`,
      ],
    },
    {
      heading: 'The naive design and the wall',
      paragraphs: [
        `The simplest receiver feeds packets to the decoder in arrival order. That fails immediately when packet 102 arrives before packet 101. The network arrival order is not the media order. A decoder that receives frames out of sequence may produce artifacts, fail to decode dependent frames, or break synchronization between audio and video.`,
        `A second simple receiver uses a FIFO queue with a fixed delay. This is better, but brittle. If the delay is too small, ordinary jitter creates late loss. If the delay is too large, every participant feels lag even on a good network. Fixed delay can be acceptable in a controlled network, but the public internet changes from minute to minute as wireless links, queues, and routes shift.`,
        `A third simple receiver waits for every missing packet. That is correct for a file and wrong for a call. A packet that arrives after its playout deadline may be useless because the moment in the conversation has already passed. Waiting forever converts packet loss into latency. The wall is the playout clock: real-time systems must make decisions before all information is available.`,
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `RTP gives the receiver two essential coordinates. The sequence number tells packet order within an RTP stream and reveals gaps. The RTP timestamp tells media time according to the payload's clock. Local arrival time tells what the network did to this packet on this path. A jitter buffer combines these coordinates to answer three different questions: what order should packets be in, when should this media be played, and how much delay variation is the network adding?`,
        `The data structure is a bounded reorder map plus deadlines. Packets are inserted by sequence number. Adjacent packets form ranges. Gaps are tracked until the missing packet arrives or the deadline expires. At each playout tick, the buffer releases the packet or frame that corresponds to media time. If the needed packet is missing, the receiver uses packet loss concealment, requests repair when the application supports it, or skips forward.`,
        `The control policy chooses the playout delay. A fixed policy sets one delay and hopes the network fits. An adaptive policy estimates jitter and late loss, increases delay during unstable periods, and tries to shrink delay when the path improves. The best policy is not the one that preserves every packet. It is the one that produces acceptable media quality at acceptable interaction latency.`,
      ],
    },
    {
      heading: 'How the mechanism works',
      paragraphs: [
        `Consider packets with sequence numbers 100, 101, 102, and 103. Packet 100 arrives first. Packet 102 arrives second. Packet 101 arrives third. A FIFO receiver would deliver 102 before 101. A jitter buffer inserts 102 into the reorder window, notices the gap at 101, and waits until either 101 arrives or the playout deadline for 101 passes. When 101 arrives in time, the buffer can release 101 and 102 in the correct order.`,
        `The buffer must also understand media time. Audio packets might represent 20 milliseconds each. Video packets may be fragments of a frame. RTP timestamps let the receiver map packet contents to playout moments and synchronize streams. Sequence numbers alone do not say when to play media; they only say relative packet order. Timestamps and clock recovery provide the media timeline.`,
        `Delay estimation is usually based on variation between RTP timestamp progression and arrival-time progression. RFC 3550 defines an interarrival jitter estimate for RTP streams. Implementations then use their own control policies around that signal: target delay, maximum delay, burst handling, clock drift correction, and mode changes for voice versus video. A voice call often prefers low delay and tolerates concealment. A one-way live stream may accept more delay for smoother output.`,
        `RTCP closes part of the loop. Receiver reports and extended reports can expose loss, jitter, and de-jitter buffer behavior. A sender can respond by lowering bitrate, changing packetization, sending redundancy, requesting or sending key frames in video workflows, or adapting congestion control. The jitter buffer is local state, but its measurements influence the whole media session.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The mechanism works because it separates network order from media order. UDP arrival order is treated as evidence, not truth. RTP sequence numbers rebuild packet order. RTP timestamps rebuild media time. The local playout clock forces deadlines. Once those roles are separate, the receiver can make explicit choices: wait, play, conceal, request repair, or drop.`,
        `It also works because the window is bounded. An unbounded buffer can hide problems until latency becomes unacceptable. A bounded jitter buffer makes the tradeoff measurable. When packets arrive within the delay budget, they are reordered and played. When they arrive too late, they are counted as late loss. The system can then decide whether to increase delay, reduce bitrate, or accept concealment.`,
        `The design is especially important for audio. Humans notice conversational delay and gaps quickly. Audio concealment can hide short losses, but it cannot fix a receiver that lets latency grow without limit. Video has different failure patterns: a missing packet may damage a frame, and a missing reference frame may affect later frames until a clean frame arrives. The jitter buffer has to feed the decoder in a way that respects those codec dependencies.`,
      ],
    },
    {
      heading: 'Where it is used',
      paragraphs: [
        `Jitter buffers are central to VoIP, video conferencing, WebRTC media paths, SIP/RTP systems, broadcast contribution links, remote production, telemedicine sessions, and low-latency live streaming workflows that use RTP. Any system that receives packetized real-time media over a variable-delay network needs a version of this structure.`,
        `Different products tune the policy differently. A conference call favors low mouth-to-ear delay because participants interrupt and respond to each other. A live sports contribution feed may tolerate more buffering to avoid visible artifacts. A remote control session may prefer freshness over completeness. The data structure is similar, but the target delay, repair strategy, and acceptable loss differ by use case.`,
        `The same concepts appear outside RTP. Game networking uses sequence windows and deadlines. Adaptive bitrate streaming uses larger media buffers and segment-level decisions. TCP reassembly uses sequence-indexed intervals, but it does not have the same playout deadline because TCP is preserving a reliable byte stream. Comparing these systems is useful: the structure may look familiar, while the objective function changes.`,
      ],
    },
    {
      heading: 'Tradeoffs and failure modes',
      paragraphs: [
        `The main tradeoff is delay versus late loss. Raising the target delay gives reordered packets more time to arrive and reduces concealment, but increases interaction latency. Lowering delay makes the session feel responsive, but turns jitter spikes into drops. A controller that only reacts upward can slowly ratchet latency higher after each burst. A controller that shrinks too aggressively can oscillate and create repeated gaps.`,
        `Common failure modes are easy to name and hard to tune. Treating reordering as permanent loss causes unnecessary concealment or repair requests. Holding late packets after their deadline wastes memory and can confuse decoder timing. Ignoring clock drift slowly misaligns capture time and playout time. Mixing audio and video policies can either delay speech too much or damage video quality. Hiding jitter-buffer metrics inside the decoder prevents the sender from adapting.`,
        `Evaluation needs both media and control signals. Track packet loss, late loss, reorder depth, jitter estimate, target playout delay, actual buffer occupancy, high-water mark, concealment events, repair requests, RTCP reports, audio gap rate, video frame drops, freeze duration, and end-to-end latency. A healthy buffer is not one that is always full. It is one that keeps deadlines with enough slack and recovers after bursts.`,
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        `Primary sources: RTP RFC 3550 at https://datatracker.ietf.org/doc/html/rfc3550 and RTCP XR de-jitter buffer metrics RFC 7005 at https://www.rfc-editor.org/rfc/rfc7005.txt. Study Ring Buffer, TCP Reassembly + SACK Scoreboard, Backpressure, HTTP/3 QUIC Stream Multiplexing Case Study, Adaptive Bitrate Manifest Ladder Case Study, UDP, Congestion Control, and Packet Loss Concealment next.`,
      ],
    },
  ],
};
