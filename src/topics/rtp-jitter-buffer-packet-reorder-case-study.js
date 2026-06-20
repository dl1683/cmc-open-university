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
        'The "packet reorder" view shows the RTP receiver pipeline: packets arrive from the network, get sorted by sequence number, wait in the jitter buffer, and release to the decoder at playout time. Active nodes are the stage currently processing a packet. Found nodes mark stages where media has been successfully delivered or measured. The plot frame shows arrival times versus the playout schedule -- any arrival dot above the playout line arrived too late and becomes late loss.',
        'The "playout control" view shows the adaptive delay policy. Active cells mark the benefit of each strategy; compare cells mark the risk. The RTCP feedback frame highlights the control loop that connects receiver measurements back to the sender.',
        {type:'callout', text:'A jitter buffer is a bounded sequence-indexed reorder window that trades added latency for in-order media before each playout deadline.'},
        {
          type: 'note',
          text: 'At each frame, ask: did this packet arrive before its playout deadline? If yes, the buffer absorbs the jitter. If no, the receiver must conceal or skip. That single question drives every design decision in the system.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'File transfer and real-time media have opposite contracts with time. TCP can retransmit a lost segment and make the application wait -- correctness is worth the delay. A video call cannot. If an audio frame for the word "hello" arrives 400 ms late, the conversation has moved on. The moment is gone. Playing it now would overlay speech that already happened.',
        'UDP gives the sender freedom to pace packets at media rate, but it gives the network freedom to reorder, duplicate, delay, or drop them. The receiver gets a disordered stream of datagrams with no delivery guarantee. The decoder, however, needs frames in timestamp order at a steady rhythm. Something must sit between the network and the decoder to absorb disorder and enforce a playout schedule.',
        {
          type: 'quote',
          attribution: 'RFC 3550, Section 6.4.1',
          text: 'The interarrival jitter is an estimate of the statistical variance of the RTP data packet interarrival time, measured in timestamp units.',
        },
        'That something is the jitter buffer. It is not a FIFO queue. It is a bounded reorder window indexed by RTP sequence number, tied to RTP timestamps and a local playout clock. It trades latency for order: every millisecond the buffer waits gives late packets more time to arrive, but adds that millisecond to the mouth-to-ear delay every participant feels. The jitter buffer exists because real-time media is a control problem, not a buffering problem.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first thing most engineers try is a fixed-delay FIFO. Hold every packet for a constant number of milliseconds, then release in arrival order. This is easy to implement and easy to reason about: one parameter, one queue, no adaptation logic.',
        {
          type: 'code',
          language: 'javascript',
          body: [
            '// Fixed-delay FIFO: simple, brittle.',
            'class FixedBuffer {',
            '  constructor(delayMs) {',
            '    this.delay = delayMs;',
            '    this.queue = [];',
            '  }',
            '  insert(packet) {',
            '    packet.playAt = packet.arrivalTime + this.delay;',
            '    this.queue.push(packet);',
            '  }',
            '  release(now) {',
            '    // Releases in arrival order, NOT media order.',
            '    // Reordered packets play out of sequence.',
            '    return this.queue.filter(p => now >= p.playAt);',
            '  }',
            '}',
          ].join('\n'),
        },
        'This breaks in two independent ways. First, it does not reorder. If packet 102 arrives before 101, the decoder gets 102 first. An audio decoder playing 20 ms Opus frames out of order produces a click; a video decoder receiving a P-frame before its reference I-frame cannot decode it at all. Second, the fixed delay is wrong for every network that changes. On a good Wi-Fi link, 40 ms of buffering wastes latency. On a congested cellular path, 40 ms is not enough and packets arrive late constantly. The fixed-delay FIFO forces a choice between wasting latency on good networks and dropping packets on bad ones.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fundamental tension is that waiting and not-waiting are both expensive. More delay hides more jitter but makes conversation feel sluggish. Less delay makes the call feel responsive but turns ordinary network variation into audible gaps. There is no fixed delay that is correct for a path whose characteristics change every few seconds.',
        {
          type: 'table',
          headers: ['Approach', 'What it gets right', 'Where it breaks'],
          rows: [
            ['Pass-through (no buffer)', 'Zero added latency', 'Any reordering produces artifacts; any jitter produces gaps'],
            ['Fixed-delay FIFO', 'Simple implementation', 'Does not reorder; wrong delay for changing networks'],
            ['Unbounded wait', 'Never drops a late packet', 'Latency grows without bound; converts loss into delay'],
            ['Fixed-delay + sort', 'Correct order within window', 'Still wrong delay; cannot adapt to bursts or path changes'],
          ],
        },
        'The wall is the playout clock. Real-time systems must make irrevocable decisions before all information is available. When the playout moment for sequence number 101 arrives, the receiver must either play it, conceal the gap, or stall. It cannot wait indefinitely. This deadline transforms the buffering problem from "collect everything" into "collect enough, in order, before the clock forces a decision."',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'RTP gives the receiver three independent coordinates, and the jitter buffer uses each one for a different job.',
        {
          type: 'table',
          headers: ['Coordinate', 'Source', 'What it answers'],
          rows: [
            ['Sequence number', '16-bit counter, increments per packet', 'What order should packets be in? Where are gaps?'],
            ['RTP timestamp', 'Media clock (e.g. 48 kHz for Opus, 90 kHz for video)', 'When should this media be rendered?'],
            ['Local arrival time', 'Receiver wall clock', 'How much delay variation is the network adding?'],
          ],
        },
        'The data structure is a bounded reorder map keyed by sequence number, not a FIFO queue. Packets are inserted at their sequence position. Adjacent packets form contiguous ranges. Gaps are tracked explicitly. At each playout tick, the buffer releases the packet whose RTP timestamp maps to the current media time. If that packet is missing, the receiver conceals, requests repair via NACK, or skips forward.',
        {
          type: 'note',
          text: 'The key invariant: the buffer never releases a packet out of sequence-number order, and it never holds a packet past its playout deadline. These two rules -- order and timeliness -- are the entire contract.',
        },
        'The control policy is what separates a working jitter buffer from a fixed-delay queue. An adaptive policy estimates jitter from the gap between expected and actual arrival times, adjusts the target playout delay upward during unstable periods, and shrinks it during stable ones. The goal is not to save every packet. It is to produce acceptable media quality at acceptable interaction latency.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'diagram',
          alt: 'RTP jitter buffer data flow from network to decoder',
          label: 'Jitter buffer pipeline',
          body: [
            'UDP socket',
            '    |',
            '    v',
            'RTP demux (SSRC routing)',
            '    |',
            '    v',
            'Sequence check -----> gap detected? ---> start NACK timer',
            '    |',
            '    v',
            'Insert into reorder window [seq -> packet]',
            '    |',
            '    v',
            'Playout scheduler (media clock tick)',
            '    |',
            '    +---> packet present? ---> release to decoder',
            '    |',
            '    +---> packet missing, deadline passed? ---> conceal or skip',
            '    |',
            '    v',
            'Decoder (Opus / VP8 / H.264)',
            '    |',
            '    v',
            'Render to speaker / display',
          ].join('\n'),
          text: [
            'UDP socket',
            '    |',
            '    v',
            'RTP demux (SSRC routing)',
            '    |',
            '    v',
            'Sequence check -----> gap detected? ---> start NACK timer',
            '    |',
            '    v',
            'Insert into reorder window [seq -> packet]',
            '    |',
            '    v',
            'Playout scheduler (media clock tick)',
            '    |',
            '    +---> packet present? ---> release to decoder',
            '    |',
            '    +---> packet missing, deadline passed? ---> conceal or skip',
            '    |',
            '    v',
            'Decoder (Opus / VP8 / H.264)',
            '    |',
            '    v',
            'Render to speaker / display',
          ].join('\n'),
        },
        'The reorder window is typically implemented as a circular array or hash map sized to hold a few hundred packets. For Opus audio at 20 ms per frame, a 200 ms buffer holds 10 slots. For VP8 video at 30 fps, a 200 ms buffer holds about 6 frames, though each frame may span multiple RTP packets.',
        'Delay estimation follows RFC 3550. The receiver tracks the difference between RTP timestamp progression and local clock progression for each packet. The interarrival jitter J is updated with an exponential moving average:',
        {
          type: 'code',
          language: 'text',
          body: [
            'D(i) = (arrival_i - arrival_{i-1}) - (rtp_ts_i - rtp_ts_{i-1})',
            'J(i) = J(i-1) + (|D(i)| - J(i-1)) / 16',
            '',
            'The factor 1/16 smooths spikes. J converges toward the mean',
            'absolute deviation of interarrival times from expected spacing.',
          ].join('\n'),
        },
        'Implementations build a target delay from J and their own policy. WebRTC uses a histogram-based estimator: it tracks the distribution of network delays and sets the target at a percentile that catches most packets without over-buffering. The target delay moves up fast (one bad burst raises it) and down slowly (several good intervals lower it). This asymmetry protects against oscillation.',
        'RTCP closes the feedback loop. Receiver Reports (RR) carry cumulative loss count, loss fraction, jitter estimate, and round-trip timing. Extended Reports (XR, RFC 3611) can expose de-jitter buffer metrics: nominal delay, current delay, maximum delay, and concealment statistics. A sender receiving degraded RR/XR data can lower bitrate, add forward error correction, change packetization interval, or request a key frame to let the video decoder resynchronize.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The mechanism works because it separates three concerns that naive approaches conflate.',
        {
          type: 'bullets',
          items: [
            'Ordering is handled by the sequence-number index, not by arrival time. UDP arrival order is treated as evidence, not truth.',
            'Timing is handled by mapping RTP timestamps to a local playout clock. The buffer knows when each packet should play, independent of when it arrived.',
            'Adaptation is handled by the jitter estimator and delay controller. The buffer depth is a tunable parameter, not a fixed constant.',
          ],
        },
        'The bounded window provides the correctness guarantee. Every packet either arrives within the delay budget and gets played in order, or arrives too late and is counted as late loss. There is no middle state. This binary outcome makes the tradeoff measurable: raise the target delay and late loss decreases; lower it and interaction latency improves. The system has a single knob (target delay) with a clear cost function (late loss rate versus added latency).',
        'For audio, the design is especially critical. Humans detect conversational delay above about 150 ms one-way and find it disruptive above 300 ms. They also detect audio gaps of 20 ms or more as clicks or breaks. The jitter buffer must keep total one-way delay (network + buffer + decode) low while concealing gaps that occur. Opus PLC (packet loss concealment) can hide isolated 20 ms losses, but it degrades quickly with consecutive losses. The buffer must minimize consecutive late-loss runs, not just total late-loss count.',
        'For video, the dependency structure matters more than gap concealment. A missing I-frame corrupts every subsequent P-frame until the next I-frame or a PLI/FIR triggers one. The video jitter buffer must track frame boundaries (RTP marker bit), detect missing reference frames, and request repairs before the corruption cascade spreads. This is why video jitter buffers are frame-aware, not just packet-aware.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The jitter buffer itself is cheap. Insertion into the reorder window is O(1) by sequence number (direct index into a circular array or hash map lookup). Release at playout time is O(1) -- read the slot for the next expected sequence number. Gap detection is O(1) per packet arrival. Memory is O(W) where W is the window size in packets, typically 10-200.',
        {
          type: 'table',
          headers: ['Operation', 'Cost', 'What dominates in practice'],
          rows: [
            ['Insert packet', 'O(1)', 'Memory copy of packet payload into buffer slot'],
            ['Release at playout', 'O(1)', 'Sequence number lookup; decoder invocation dominates'],
            ['Gap detection', 'O(1)', 'Comparison of received sequence vs expected sequence'],
            ['Jitter estimation', 'O(1) per packet', 'One subtraction, one absolute value, one EMA update'],
            ['Delay adaptation', 'O(1) per playout tick', 'Policy evaluation; histogram update in WebRTC is O(1) amortized'],
            ['NACK generation', 'O(gaps)', 'Typically 0-3 gaps; bounded by window size'],
          ],
        },
        'The real cost is not computational. It is the latency budget. Every millisecond of buffer depth is a millisecond of added one-way delay. In a two-party call, this appears doubled in round-trip conversational delay. A 60 ms jitter buffer adds 60 ms one-way; combined with 50 ms network delay and 10 ms codec delay, total one-way is 120 ms. The ITU G.114 recommendation is to keep one-way mouth-to-ear delay below 150 ms for toll quality. The jitter buffer typically consumes the largest single chunk of that budget.',
        'Doubling the buffer depth roughly halves the late-loss rate (assuming jitter is roughly exponentially distributed), but adds a fixed latency cost to every packet, including those that arrived early. The buffer penalizes the common case to protect against the rare case. The adaptive controller exists to minimize that penalty by keeping the buffer only as deep as recent network conditions require.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'An Opus audio stream sends 20 ms frames. The receiver has an adaptive jitter buffer with a current target delay of 60 ms. Six packets arrive:',
        {
          type: 'table',
          headers: ['Seq', 'RTP timestamp', 'Expected arrival', 'Actual arrival', 'Network jitter'],
          rows: [
            ['100', '0', 't+0 ms', 't+5 ms', '+5 ms'],
            ['101', '960', 't+20 ms', 't+22 ms', '+2 ms'],
            ['103', '2880', 't+60 ms', 't+48 ms', '-12 ms'],
            ['102', '1920', 't+40 ms', 't+55 ms', '+15 ms'],
            ['104', '3840', 't+80 ms', 't+83 ms', '+3 ms'],
            ['105', '4800', 't+100 ms', 't+140 ms', '+40 ms'],
          ],
        },
        {
          type: 'note',
          text: 'RTP timestamps use the Opus clock rate of 48,000 Hz. Each 20 ms frame advances the timestamp by 960 ticks (48000 * 0.020 = 960).',
        },
        'Step by step through the buffer:',
        {
          type: 'bullets',
          items: [
            'Seq 100 arrives at t+5. Insert at slot 100. No gap. Playout scheduled at t+65 (arrival + 60 ms target delay). Jitter estimate initialized.',
            'Seq 101 arrives at t+22. Insert at slot 101. Contiguous with 100. Playout at t+82.',
            'Seq 103 arrives at t+48. Insert at slot 103. Gap detected: seq 102 is missing. Start NACK timer for 102. Do not release 103 until 102 is resolved.',
            'Seq 102 arrives at t+55. Insert at slot 102. Gap filled. Slots 102 and 103 are now contiguous. Both can release at their scheduled times.',
            'At t+65: playout tick for seq 100. Packet present. Release to Opus decoder. Audio plays.',
            'Seq 104 arrives at t+83. Insert at slot 104. Contiguous.',
            'At t+82: playout tick for seq 101. Release. At t+115: release 102. At t+108: release 103 (arrived early, waits for its turn).',
            'Seq 105 arrives at t+140. Its scheduled playout is t+160. Jitter estimate spikes: D(105) = (140-83) - (4800-3840)/48000*1000 = 57 - 20 = +37 ms. The adaptive controller raises the target delay from 60 ms toward 80 ms to absorb the burst.',
          ],
        },
        'The critical moment is seq 103 arriving before 102. A FIFO would play 103 first, producing a click. The jitter buffer held 103 in its slot, waited for 102, and released both in order. The late arrival of 105 caused the controller to widen the buffer, trading 20 ms of extra latency for better coverage of future bursts.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        {
          type: 'table',
          headers: ['System', 'Buffer depth', 'Policy', 'Why this tuning'],
          rows: [
            ['WebRTC (Chrome)', '20-500 ms adaptive', 'Histogram percentile, fast up / slow down', 'Conversational: low delay matters more than perfection'],
            ['VoIP (Opal/Ooh323)', '60-200 ms adaptive', 'EMA jitter + headroom multiplier', 'Business telephony: stability over minimum latency'],
            ['Twitch low-latency', '500-2000 ms', 'Fixed large buffer', 'One-way broadcast: no conversational penalty for delay'],
            ['Zoom', '~40-160 ms adaptive', 'Proprietary multi-factor', 'Hybrid: low delay for speech, separate video buffer'],
            ['Discord voice', '~20-120 ms adaptive', 'Opus-specific, aggressive concealment', 'Gaming: ultra-low latency tolerated with aggressive PLC'],
          ],
        },
        'Different products make different bets. A conference call favors low mouth-to-ear delay because participants interrupt and respond to each other -- the ITU calls this "conversational quality" and recommends under 150 ms one-way. A live sports contribution feed may tolerate 500 ms of buffering to avoid visible artifacts on a broadcast that millions see. A cloud gaming session prefers freshness over completeness: a stale frame is worse than a missing one.',
        'The same structural pattern appears outside RTP. Game engines use sequence-windowed input buffers with rollback for late inputs. TCP reassembly uses sequence-indexed segments, but without a playout deadline because TCP preserves a reliable byte stream. Adaptive bitrate streaming (DASH/HLS) uses segment-level buffers with quality switching instead of concealment. In each case, the structure is a bounded reorder window with a release policy, but the objective function -- what counts as "good enough" -- changes.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The central tradeoff -- delay versus late loss -- cannot be eliminated, only managed. Every failure mode traces back to the controller making the wrong bet about future network behavior.',
        {
          type: 'table',
          headers: ['Failure mode', 'Symptom', 'Root cause'],
          rows: [
            ['Latency ratchet', 'Delay grows after each burst, never shrinks', 'Controller raises target on spikes but has no decay policy'],
            ['Oscillation', 'Alternating glitches and bloated delay', 'Controller shrinks too aggressively after each stable interval'],
            ['Clock drift', 'Buffer slowly empties or overflows over minutes', 'Sender and receiver clocks differ by tens of ppm; no drift correction'],
            ['Burst blindness', 'Entire burst lost despite adequate average jitter', 'EMA jitter estimator smooths away short high-variance episodes'],
            ['Cross-stream desync', 'Audio leads or trails video by 40+ ms', 'Separate jitter buffers per media type with independent delay targets'],
            ['NACK storm', 'Retransmit requests flood the return path', 'NACK timer too aggressive on a high-loss link; no rate limiting'],
          ],
        },
        'Clock drift is subtle and common. A sender with a 48,000.5 Hz crystal and a receiver with a 47,999.8 Hz crystal differ by about 14 ppm. Over a 10-minute call, this accumulates to roughly 8 ms of drift. Without correction, the buffer slowly empties (sender clock faster) or slowly fills and overflows (sender clock slower). Production systems detect drift by comparing RTP timestamp progression to local clock progression over long windows and adjust the playout rate by resampling audio or dropping/duplicating video frames.',
        'Evaluation requires both media-quality metrics and control-system metrics. Late loss rate and concealment duration measure what the listener hears. Target delay and buffer occupancy measure what the controller is doing. A buffer that reports 0% loss but 300 ms of delay has failed for conversation. A buffer that reports 40 ms delay but 5% late loss has failed for quality. The system is healthy only when both sides of the tradeoff are within acceptable bounds for the application.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Primary: RFC 3550 (RTP specification, sections 6.4.1 on jitter and A.8 on the reference algorithm) -- https://datatracker.ietf.org/doc/html/rfc3550',
            'Extended metrics: RFC 3611 (RTCP XR) and RFC 7005 (de-jitter buffer metrics) -- https://www.rfc-editor.org/rfc/rfc7005.txt',
            'Implementation: WebRTC NetEq source in Chromium -- modules/audio_coding/neteq/ -- the production adaptive jitter buffer for Chrome, Android, and Opal',
            'Research: Y. J. Liang et al., "Adaptive Playout Scheduling Using Time-Scale Modification in Packet Voice Communications," IEEE ICASSP 2001 -- the foundational paper on time-scale modification for adaptive playout',
          ],
        },
        {
          type: 'table',
          headers: ['Role', 'Topic'],
          rows: [
            ['Prerequisite', 'Ring Buffer -- the circular array that underlies most jitter buffer implementations'],
            ['Prerequisite', 'UDP -- the transport layer that makes jitter buffers necessary'],
            ['Sibling', 'TCP Reassembly + SACK Scoreboard -- same reorder-window structure, different release policy (reliable vs real-time)'],
            ['Extension', 'Adaptive Bitrate Manifest Ladder Case Study -- segment-level buffer control for HTTP streaming'],
            ['Extension', 'Congestion Control -- the sender-side counterpart; jitter buffer is receiver-side adaptation'],
            ['Contrast', 'HTTP/3 QUIC Stream Multiplexing Case Study -- QUIC eliminates head-of-line blocking but adds its own buffering tradeoffs'],
          ],
        },
      ],
    },
    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'State the jitter buffer invariant in one sentence. (The buffer never releases a packet out of sequence-number order, and it never holds a packet past its playout deadline.)',
            'Given packets arriving in order [5, 3, 4, 6], predict the buffer contents after each arrival and the release order. (Insert 5; insert 3, gap at 4; insert 4, gap filled, release 3-4-5 in order at their playout times; insert 6.)',
            'Name one failure mode that a fixed-delay buffer handles correctly but an adaptive buffer can get wrong. (A fixed buffer never oscillates. An adaptive buffer with an aggressive decay policy can oscillate between too-short and too-long delay.)',
            'Where else does the bounded-reorder-window-with-deadline pattern appear? (Game netcode input buffers, TCP out-of-order queues with retransmit timers, sensor fusion pipelines with arrival-time deadlines.)',
          ],
        },
      ],
    },
  ],
};

