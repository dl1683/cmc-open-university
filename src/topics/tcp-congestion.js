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
    explanation: 'Before any data: the THREE-WAY HANDSHAKE. You send SYN ("want to talk; my sequence numbers start at X"), the server answers SYN+ACK ("heard you; mine start at Y"), you answer ACK. Three packets, and now BOTH sides have proven they can send AND receive, and both know where the other\'s byte numbering begins. (This is the round trip that DNS resolution — see How DNS Works — already paid for before the connection even started.)',
  };

  yield {
    state: arrayState(['?', '?', '?']),
    highlight: {},
    explanation: 'Connected — now the hard question nobody can answer in advance: HOW FAST may this connection send? The path crosses unknown routers with unknown buffers shared with unknown strangers. Send too slowly: wasted capacity. Too fast: router queues overflow, packets drop — and in 1986 the early internet actually did this collectively, collapsing throughput ~1000× (congestion collapse). TCP\'s answer: probe, listen, adapt. The dial is cwnd — how many packets may fly unacknowledged (a Sliding Window over unACKed bytes).',
  };

  yield {
    state: plotState({ axes, series: slice(5) }),
    highlight: { active: ['cwnd'] },
    explanation: `Phase 1 — SLOW START (ironic name): begin at 1 packet, and DOUBLE the window every round trip: 1, 2, 4, 8, 16, 32. Exponential, because a fresh connection knows nothing and wants to find the network's capacity in a handful of RTTs rather than minutes.`,
  };

  yield {
    state: plotState({ axes, series: slice(lossRound - 1) }),
    highlight: { active: ['cwnd'] },
    explanation: `Phase 2 — at the threshold (here ${SSTHRESH}), doubling becomes reckless, so TCP shifts to CONGESTION AVOIDANCE: +1 packet per round trip. Gentle, linear probing — creeping toward the ceiling instead of vaulting past it. Watch the curve's slope change from exponential to a careful straight line.`,
    invariant: 'Additive increase: probe the unknown capacity one packet at a time.',
  };

  const lossPoint = points.find((p) => p.x === lossRound);
  yield {
    state: plotState({ axes, series: slice(points.at(-1).x), markers: [{ id: 'loss', x: lossRound - 1, y: LOSS_AT, label: 'packet loss!' }] }),
    highlight: { active: ['loss'] },
    explanation: `At ${LOSS_AT} packets in flight, a router queue overflows and a packet DROPS. TCP treats loss as the network screaming "too much!" — and responds drastically: HALVE the window (${LOSS_AT} → ${lossPoint.y}), then resume the patient +1 climb. There is the famous SAWTOOTH: additive increase, multiplicative decrease — AIMD — repeating for the connection's whole life.`,
  };

  yield {
    state: plotState({ axes, series: slice(points.at(-1).x), markers: [{ id: 'loss', x: lossRound - 1, y: LOSS_AT, label: 'loss' }] }),
    highlight: {},
    explanation: 'Why this exact asymmetry? STABILITY: gentle probing rarely overshoots far, and halving instantly relieves a congested router. And FAIRNESS, the beautiful part: when several AIMD flows share a link, the bigger window loses more in each halving — so flows CONVERGE toward equal shares with no coordinator, no negotiation, no knowledge of each other. Thousands of strangers self-organize into sharing, purely through this rule.',
  };

  yield {
    state: plotState({ axes, series: slice(points.at(-1).x), markers: [{ id: 'loss', x: lossRound - 1, y: LOSS_AT, label: 'loss' }] }),
    highlight: {},
    explanation: 'The sawtooth you watched is classic Reno. Modern defaults refine it: CUBIC (Linux\'s default) reclaims lost ground faster after a drop; BBR (Google, powering YouTube) stops waiting for loss entirely and MODELS the path\'s bandwidth and latency directly — because in deep router buffers, loss arrives too late (bufferbloat). Different probes, same forty-year-old contract: the network gives no permission slips; every sender must discover its fair share, forever. The internet stays standing because this loop runs in every connection on Earth — including the one that delivered this page.',
  };
}

export const article = {
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
      heading: `Study next`,
      paragraphs: [
        `Study Sliding Window for the byte-stream mechanic, How DNS Works for the step before the handshake, and CDN Request Flow for the multi-hop delivery path. Then compare TCP's implicit feedback with Rate Limiter (Token Bucket), Message Queues, Backpressure & Flow Control, and Circuit Breakers & Deadlines, where systems make throttling and failure policy explicit.`,
      ],
    },
  ],
};
