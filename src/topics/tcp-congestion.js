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
        `TCP congestion control is a decentralized agreement between your computer and the network about how fast you are allowed to send data. You do not ask anyone for permission — instead, you probe upward and listen for the network's answer: dropped packets mean back off. The congestion window (cwnd) is a moving slider that caps how many unacknowledged bytes may be in flight at once. Start with 1 packet, grow exponentially during slow start, then linearly during congestion avoidance, and halve brutally when loss arrives. This multiplicative decrease + additive increase (AIMD) sawtooth repeats for the life of the connection.`,
        `The three-way handshake (SYN, SYN-ACK, ACK) happens first: both sides prove they can send and receive, and both learn where the other's sequence numbers begin. Only after that agreement does the real conversation start. The entire internet runs on this same loop, repeated across trillions of concurrent connections. In 1986, before congestion control existed, the early internet actually collapsed under its own weight, with throughput dropping roughly 1000×. TCP's answer to that catastrophe — this algorithm — has kept the network standing for 40 years.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The journey has three phases. Slow start is exponential: begin at 1 packet and double the window every round trip (RTT). With ssthresh set to 32 in this visualization, you race from 1 to 2 to 4 to 8 to 16 to 32 in six rounds. Exponential growth lets a new connection find the network's capacity in a handful of RTTs rather than minutes. Once you hit ssthresh, congestion avoidance takes over: add just 1 packet per RTT. Linear probing is gentler and safer once you are near the ceiling.`,
        `When a router's buffer overflows and a packet drops, TCP receives a duplicate ACK and treats it as a screaming alarm: the network is saying no. Immediately halve cwnd (44 becomes 22) and resume the +1 climb. This asymmetry is the engine of stability and fairness. Stability comes because gentle probing rarely overshoots far, and halving instantly relieves congestion. Fairness is automatic: when competing flows share a link, a flow with a larger window loses more packets in each halving, so flows converge toward equal bandwidth without any coordinator, no negotiation, no knowledge of each other.`,
        `Modern TCP evolved beyond Reno. CUBIC (Linux's default since 2.6.19) reclaims lost bandwidth faster after a drop by following a cubic function rather than a linear one, suiting high-speed, high-latency links. BBR (deployed by Google for YouTube and other services) abandons loss detection entirely and instead directly measures the path's bandwidth and minimum latency, responding to queue buildup before packets drop. This avoids bufferbloat — the condition where deep router buffers hide congestion, so loss arrives too late to guide the sender. cwnd is always a Sliding Window over the unacknowledged bytes, enforcing a hard cap on in-flight data.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The CPU cost is almost zero — a few arithmetic operations per RTT. The memory cost is negligible: a single counter (cwnd) and a timer per connection. The real cost is delay: to be conservative and discover capacity safely, congestion avoidance's linear probing wastes time. On a fresh connection, slow start's exponential climb is fast, but probing beyond a router's true capacity and then halving creates a sawtooth that you must live with. If you know the network's capacity in advance, you could start at the right window immediately — but you do not know, and TCP refuses to assume.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every TCP socket uses this algorithm implicitly. Your web browser, SSH session, file downloads, video streaming — all use congestion control. Most internet traffic is TCP (or QUIC, which runs the same or similar control algorithms). Streaming services rely on it to share WiFi with your email and video calls without making all three unusable. Data centers use it between servers, and it is why a clogged link does not simply stop — it distributes pain fairly. CDN edge servers (see CDN Request Flow) use congestion control to manage inbound requests from peers without overwhelming any one path. Load balancers and Message Queues depend on TCP's backpressure: if the receiver cannot keep up, the sender's window closes, and the sender is forced to slow down.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `Myth: TCP is slow. Reality: TCP is slow on high-latency, high-capacity links (satellites, transcontinental fiber) because congestion avoidance's +1 per RTT becomes a crawl. Slow start's exponential phase is actually fast. A 100ms RTT and 100 Gbps capacity means you need roughly 10 million packets in flight to saturate the link — and linear probing would take millions of RTTs to reach that. CUBIC and BBR address this.`,
        `Myth: packet loss is bad. Reality: loss is TCP's only signal that the network is congested, so it must happen. Zero loss means you are underutilizing the link. The goal is to lose packets at exactly the right rate to stay fair and stable.`,
        `Myth: congestion control is negotiated. Reality: there is no negotiation. The receiver does not tell the sender what to do. The sender unilaterally decides its window size and prays the packets make it through. Loss is the only feedback. This decentralization is why TCP scales — no centralized controller is needed.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Understand Sliding Window to see how cwnd bounds the unacknowledged bytes over a stream. Learn How DNS Works to appreciate that the TCP handshake happens after DNS completes, so the latency cost is always paid. Explore Message Queues and Rate Limiter (Token Bucket) to see active flow control — where the receiver or a middle agent explicitly limits the sender. Study CDN Request Flow to see congestion control in action across multiple links. Finally, revisit this topic: the sawtooth you are watching here repeats every day across billions of connections, and it is one of humanity's most elegant decentralized algorithms.`,
      ],
    },
  ],
};

