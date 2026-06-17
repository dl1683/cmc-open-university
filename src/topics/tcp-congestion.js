// TCP: three packets to say hello, then a lifelong negotiation with the
// network about how fast to talk. Slow start, congestion avoidance, and
// the famous sawtooth — the algorithm that keeps the internet from melting.

import { arrayState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'tcp-congestion',
  title: 'TCP: Handshake & Congestion Control',
  category: 'Systems',
  summary: 'SYN, SYN-ACK, ACK — then the sawtooth: probe gently upward, back off hard, forever.',
  controls: [
    { id: 'view', label: 'Watch', type: 'select', options: ['one connection\'s life'], defaultValue: 'one connection\'s life' },
  ],
  run,
};

const SSTHRESH = 32;
const LOSS_AT = 44;

function trajectory() {
  const points = [];
  let cwnd = 1;
  let round = 0;
  // slow start: double per RTT
  while (cwnd <= SSTHRESH) {
    points.push({ x: round, y: cwnd, phase: 'slow-start' });
    if (cwnd === SSTHRESH) break;
    cwnd = Math.min(cwnd * 2, SSTHRESH);
    round += 1;
  }
  // congestion avoidance: +1 per RTT until loss
  while (cwnd < LOSS_AT) {
    cwnd += 1;
    round += 1;
    points.push({ x: round, y: cwnd, phase: 'avoidance' });
  }
  // loss: halve
  const lossRound = round + 1;
  cwnd = Math.floor(cwnd / 2);
  points.push({ x: lossRound, y: cwnd, phase: 'recovery' });
  // climb again
  for (let r = lossRound + 1; r <= lossRound + 11; r += 1) {
    cwnd += 1;
    points.push({ x: r, y: cwnd, phase: 'avoidance' });
  }
  return { points, lossRound };
}

export function* run(input) {
  if (String(input.view) !== "one connection's life") throw new InputError('Pick the walkthrough.');
  const { points, lossRound } = trajectory();
  const axes = { x: { label: 'round trips (RTTs)' }, y: { label: 'congestion window (packets in flight)' } };
  const slice = (upto) => [{ id: 'cwnd', label: 'cwnd', points: points.filter((p) => p.x <= upto).map(({ x, y }) => ({ x, y })) }];

  yield {
    state: arrayState(['SYN →', '← SYN+ACK', 'ACK →']),
    highlight: { active: ['i0', 'i1', 'i2'] },
    explanation: 'Before data moves, TCP proves both endpoints can talk. SYN proposes a starting sequence number, SYN+ACK confirms it and proposes the server\'s number, and ACK finishes the agreement. After this, both sides know the byte numbering for the stream.',
  };

  yield {
    state: arrayState(['?', '?', '?']),
    highlight: {},
    explanation: 'Now the sender has the harder problem: how many packets can it keep in flight without filling router queues it cannot see? Sending too little wastes capacity; sending too much causes drops. TCP uses cwnd, a congestion window over unacknowledged bytes, as the send-rate dial.',
  };

  yield {
    state: plotState({ axes, series: slice(5) }),
    highlight: { active: ['cwnd'] },
    explanation: `Slow start begins at one packet and doubles cwnd each round trip: 1, 2, 4, 8, 16, 32. It is "slow" only compared with blasting the path blind; exponential probing finds a usable range quickly when the sender knows nothing.`,
  };

  yield {
    state: plotState({ axes, series: slice(lossRound - 1) }),
    highlight: { active: ['cwnd'] },
    explanation: `At ssthresh (${SSTHRESH}) the animation changes slope. Congestion avoidance stops doubling and adds roughly one packet per RTT, so the sender probes near the ceiling instead of leaping past it.`,
    invariant: 'Additive increase: probe the unknown capacity one packet at a time.',
  };

  const lossPoint = points.find((p) => p.x === lossRound);
  yield {
    state: plotState({ axes, series: slice(points.at(-1).x), markers: [{ id: 'loss', x: lossRound - 1, y: LOSS_AT, label: 'packet loss!' }] }),
    highlight: { active: ['loss'] },
    explanation: `At ${LOSS_AT} packets in flight, loss marks the path as overfilled. Reno-style TCP halves cwnd (${LOSS_AT} -> ${lossPoint.y}) and resumes linear probing. That drop-and-climb shape is AIMD: additive increase, multiplicative decrease.`,
  };

  yield {
    state: plotState({ axes, series: slice(points.at(-1).x), markers: [{ id: 'loss', x: lossRound - 1, y: LOSS_AT, label: 'loss' }] }),
    highlight: {},
    explanation: 'The asymmetry is the point. A small increase tests capacity; a large decrease drains queues quickly. When multiple AIMD flows share a link, larger windows lose more absolute packets on each cut, nudging flows toward fairer shares without a coordinator.',
  };

  yield {
    state: plotState({ axes, series: slice(points.at(-1).x), markers: [{ id: 'loss', x: lossRound - 1, y: LOSS_AT, label: 'loss' }] }),
    highlight: {},
    explanation: 'This is classic Reno, not the whole modern internet. CUBIC grows differently on high-bandwidth paths; BBR models bandwidth and latency instead of waiting only for loss; ECN can signal congestion before packets drop. The shared lesson is still feedback control: every sender must discover a safe rate from imperfect signals.',
  };
}

const legacyArticle = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `TCP: Handshake & Congestion Control is two lessons in one. First, the three-way handshake, SYN, SYN-ACK, ACK, proves both sides can send and receive and establishes sequence numbers. That happens after How DNS Works finds an IP address. Second, congestion control decides how much data may be in flight. The sender keeps a congestion window, cwnd, which acts like a Sliding Window over unacknowledged bytes.`,
        `The visualization uses classic Reno-style behavior: start at 1 packet, grow quickly, probe gently, and cut hard when loss appears. This is the sawtooth that kept the internet from repeating the congestion-collapse failures observed in the 1980s, when senders retransmitted aggressively into already overloaded routers.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `In the demo, slow start doubles cwnd along the plotted points 1, 2, 4, 8, 16, 32. The name is historical; exponential growth is fast, but it starts cautiously because the path capacity is unknown. At ssthresh, congestion avoidance takes over and adds about one packet per round trip. When the demo reaches 44 packets and marks a loss, cwnd is halved to 22 and the linear climb resumes.`,
        `That rule is AIMD: additive increase, multiplicative decrease. It is stable because probes are gentle near the ceiling and backoff is large when congestion appears. It is also roughly fair: bigger flows lose more absolute window during halving. Real TCP also respects the receiver's advertised window, so the usable send window is limited by both receiver flow control and sender congestion control.`,
        `Modern defaults refine the signal. CUBIC, long used by Linux, grows according to a cubic curve that works better on high-bandwidth, high-latency paths. BBR estimates bottleneck bandwidth and round-trip propagation delay instead of waiting only for packet loss. ECN can mark congestion without dropping packets. The visualization is Reno-shaped because it teaches the core feedback loop clearly.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `Treat the first frame as connection setup, not speed control. SYN, SYN-ACK, and ACK establish the byte stream; they do not answer how fast the sender should transmit after the connection opens.`,
        `On the plot, the y-axis is cwnd: packets allowed in flight before acknowledgments return. The early curve doubles because the sender is learning quickly. The straight-line climb is cautious probing near a guessed limit. The marked loss is the feedback signal, and the sudden cut is the safety response.`,
        `The key visual pattern is the sawtooth. It is not noise in the chart; it is the control loop. TCP repeatedly searches for available capacity, crosses a boundary, backs off, and searches again.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The CPU cost is tiny: a few counters, timers, acknowledgments, and arithmetic per connection. The cost users feel is latency and underfilled bandwidth while the sender discovers capacity. On a 100 ms round trip, every window adjustment takes at least a tenth of a second to observe. On a 100 Gbps path with a 100 ms RTT, the bandwidth-delay product is about 1.25 GB, or roughly 850,000 full-size 1460-byte packets in flight, so naive +1-per-RTT probing would be far too slow without modern algorithms.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Browsers, SSH, database clients, CDNs, and API calls rely on congestion control whenever they use TCP. QUIC runs over UDP but still needs similar congestion-control ideas. CDN Request Flow depends on it between user and edge and again between edge and origin. Load Balancer, Message Queues, and Backpressure & Flow Control all build higher-level reliability on top of the same pressure signal: if the downstream path cannot keep up, the sender must slow down or shed work.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Do not say "TCP is slow" without naming the path. Slow start is fast; high-latency, high-bandwidth links are hard because feedback arrives late. Do not say loss is always required. Classic Reno treats loss as a signal, but ECN and BBR-style models can react before loss. Do not confuse congestion control with receiver flow control: the receiver advertises how much it can buffer, while congestion control estimates what the network can carry.`,
        `Rate Limiter (Token Bucket) and Circuit Breakers & Deadlines are application-level protections; they do not replace TCP. They decide whether to admit work. TCP decides how quickly admitted bytes cross a path.`,
      ],
    },
    {
      heading: `Practical guidance`,
      paragraphs: [
        `When diagnosing a slow transfer, separate the questions: DNS latency, handshake latency, RTT, loss, receiver window, congestion algorithm, and application backpressure. A single "download is slow" symptom can come from any of those layers.`,
        `For systems design, copy the shape rather than the packet details: increase cautiously while feedback is good, cut aggressively when the shared resource pushes back, and make the feedback signal visible enough that operators can tell overload from ordinary latency.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study NIC RX Ring & NAPI Poll Case Study for the packet receive path below TCP, TCP Listen Backlog & Accept Queue Case Study for server-side admission before application code sees a socket, TCP Reassembly & SACK Scoreboard for the byte-range repair state behind loss recovery, Sliding Window for the byte-stream mechanic, How DNS Works for the step before the handshake, and CDN Request Flow for the multi-hop delivery path. Then compare TCP's implicit feedback with QUIC Transport Streams & Loss Recovery, Rate Limiter (Token Bucket), Message Queues, Backpressure & Flow Control, and Circuit Breakers & Deadlines, where systems make throttling and failure policy explicit.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'TCP exists to turn unreliable IP packets into a reliable byte stream, and congestion control exists because reliability alone can destroy the network. If every sender retransmits aggressively when packets drop, the network can collapse under duplicate traffic.',
        'The protocol therefore has two jobs. It must recover lost data for one connection, and it must share the network with many other connections. The handshake, sequence numbers, acknowledgements, retransmission, flow control, and congestion window all serve those two jobs.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious sender rule is send as fast as the application produces bytes and retry anything missing. That fills buffers, increases queueing delay, causes drops, and then adds retransmissions on top. A network under stress receives more traffic precisely because it is dropping traffic.',
        'Another tempting rule is a fixed send rate. That wastes capacity on fast paths and overloads slow paths. TCP needs a sender-side control loop that discovers available capacity from feedback while backing off when the path signals congestion.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'TCP separates receiver capacity from network capacity. The receive window says how much data the receiver can buffer. The congestion window says how much data the sender believes the network can tolerate in flight. The sender is limited by the smaller of the two.',
        'Congestion control is additive optimism plus multiplicative humility. Slow start grows quickly to find capacity. Congestion avoidance grows more carefully. Loss, ECN, or other congestion signals reduce the sending window so the connection stops contributing as much pressure.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A connection starts with the three-way handshake: SYN, SYN-ACK, ACK. The handshake establishes initial sequence numbers and proves both sides can send and receive. After that, TCP sends bytes labeled by sequence number and receives acknowledgements for contiguous data.',
        'The sender keeps data in flight up to the allowed window. ACKs advance the left edge of the send window. Duplicate ACKs or timeouts suggest loss. Retransmission resends missing bytes. The exact behavior depends on the congestion-control algorithm, but the feedback loop is always about controlling in-flight data.',
        'Slow start increases the congestion window rapidly as ACKs arrive. Once it reaches a threshold or sees congestion, the connection moves into a more cautious mode. Modern TCP variants differ in how they interpret delay, loss, bandwidth, and delivery rate, but they all try to avoid persistent overload.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The handshake view proves that a TCP connection is stateful before application bytes flow. The sequence-number view proves that TCP is a byte stream protocol, not a message protocol. Boundaries between writes are not preserved unless the application adds framing.',
        'The congestion-window view proves that throughput is governed by bytes in flight. A sender may have unlimited data ready, but it cannot responsibly pour all of it into the path. ACKs are the clock that let new bytes enter the network.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Reliability works because sequence numbers and ACKs let the sender detect missing ranges and retransmit them. The receiver can reorder data internally and deliver a clean byte stream to the application once gaps are filled.',
        'Congestion control works because packet delivery is feedback. When ACKs arrive, the path has delivered data and likely has room for more. When loss or delay signals appear, the sender reduces pressure. The protocol is a distributed control system built from local observations.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'TCP pays latency for connection setup unless reuse, Fast Open, or QUIC-like alternatives reduce it. It pays memory for send and receive buffers. It pays complexity for retransmission timers, congestion control, flow control, and edge cases such as reordering.',
        'The tradeoff is fairness versus utilization. Conservative algorithms share politely but may underuse high-bandwidth, high-latency paths. Aggressive algorithms fill pipes faster but can hurt competing flows or create queueing delay. The right behavior depends on the network and workload.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'TCP is excellent for reliable ordered byte streams: HTTP/1.1 and HTTP/2, database connections, SSH, file transfer, many message brokers, and internal service traffic. Applications get reliable delivery without implementing their own loss recovery.',
        'It is also a valuable mental model for other systems. Backpressure, retry budgets, queue congestion, and streaming flow control all ask the same question: how much work should be in flight before feedback says slow down?',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Head-of-line blocking is a key failure for multiplexed protocols over one TCP stream. If one packet is lost, later bytes cannot be delivered to the application even if they arrived. This is one reason HTTP/3 uses QUIC over UDP with stream-level handling.',
        'Bufferbloat is another failure. Large buffers can hide congestion by delaying packets instead of dropping them. Throughput may look fine while latency becomes terrible. Delay-sensitive systems need to watch queueing delay, not only loss.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Imagine a sender with a congestion window of ten segments. It can place ten segments in flight before waiting for acknowledgements. As ACKs return, the sender opens slots for more data. The ACK stream becomes the pacing signal for new bytes.',
        'Now suppose a burst of loss occurs. If the sender keeps the same window, it adds retransmissions to an already stressed path. Congestion control reduces the window, sends less, and then cautiously grows again as delivery evidence returns.',
        'The same idea explains why throughput depends on round-trip time. With a larger RTT, the sender waits longer for ACK feedback. To fill a high-bandwidth long-distance path, the connection needs enough safe in-flight data, not merely a fast application loop.',
      ],
    },
    {
      heading: 'Operational checklist',
      paragraphs: [
        'When debugging TCP behavior, separate receiver limits, congestion limits, and application limits. A small receive window points to the receiver. A small congestion window points to network feedback. An idle sender may mean the application is not producing data.',
        'Look at retransmissions, round-trip time, advertised receive window, congestion window if available, and socket buffer sizes together. One number rarely explains the connection. A packet capture, kernel metrics, and application timing usually need to be read as one story.',
        'For service design, remember that TCP gives a stream, not message boundaries. Protocols need framing, length prefixes, delimiters, or higher-level message formats. Many application bugs come from assuming one read equals one write.',
      ],
    },
    {
      heading: 'How to choose the abstraction',
      paragraphs: [
        'Use TCP when the application wants reliable ordered bytes and can tolerate stream-level head-of-line blocking. Use UDP or QUIC-shaped protocols when the application needs custom recovery, independent streams, lower handshake cost, or user-space transport evolution.',
        'Do not blame TCP for every latency problem. A slow application reader, small receive buffer, server backlog, DNS delay, TLS handshake, or overloaded event loop can all appear as network slowness. TCP metrics should be joined with application traces.',
        'At the architecture level, TCP is one control loop inside many others. Load balancers, retries, queues, circuit breakers, and rate limiters also shape traffic. A stable service aligns those loops instead of letting each one fight the others.',
        'For high-throughput services, tune only after measuring. Larger buffers, different congestion algorithms, keepalive settings, and connection pooling can help or hurt depending on RTT, loss, request shape, and server memory. The protocol is adaptive, but the deployment still sets the boundaries it adapts within.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Sliding Window, Backpressure, Retries and Jitter, Tail Latency, QUIC, Load Shedding, Rate Limiting, and Message Queues. A useful exercise is to plot congestion window over time for slow start, loss, and recovery, then ask which signals the sender actually observes.',
        'Then compare a clean LAN transfer with a lossy mobile transfer. The same TCP machinery behaves differently because ACK timing, loss, RTT variance, and buffer behavior are different. That comparison makes congestion control feel like measurement, not folklore.',
      ],
    },
  ],
};
