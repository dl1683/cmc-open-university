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
  if (String(input.view) !== "one connection\'s life") throw new InputError('Pick the walkthrough.');
  const { points, lossRound } = trajectory();
  const axes = { x: { label: 'round trips (RTTs)' }, y: { label: 'congestion window (packets in flight)' } };
  const slice = (upto) => [{ id: 'cwnd', label: 'cwnd', points: points.filter((p) => p.x <= upto).map(({ x, y }) => ({ x, y })) }];

  yield {
    state: arrayState(['SYN â†’', 'â† SYN+ACK', 'ACK â†’']),
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

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the first frame as connection setup. SYN, SYN-ACK, and ACK establish byte-stream numbering; they do not decide how fast the sender should transmit.',
        'Read the plot as cwnd over round trips. cwnd is the congestion window, the sender-side limit on packets in flight based on inferred network capacity.',
        {
          type: 'callout',
          text: 'TCP congestion control is feedback control under blindness: the sender changes cwnd from ACK timing and loss, not from direct queue visibility.',
        },
        {
          type: 'image',
          src: './assets/gifs/tcp-congestion.gif',
          alt: 'Animated walkthrough of the tcp congestion visualization',
          caption: 'Animation preview: the full visualization plays through each step at reading pace.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'TCP congestion control exists because a shared network can collapse when senders treat packet loss as only a reason to retransmit. More retransmission can add load to routers that are already dropping packets.',
        'The sender cannot see router queues or competing flows. It must infer a safe rate from acknowledgements, timeouts, duplicate acknowledgements, and round-trip timing.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to send as fast as the application and receiver allow, then retransmit anything not acknowledged. That works on an unloaded path but fails when many senders share a bottleneck.',
        'A fixed send rate is also wrong. A rate that is safe on a slow path wastes a fast path, and a rate that fills a fast path overloads a slow path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is blind feedback control. The sender needs high throughput and fairness, but its signals are delayed and indirect.',
        'If it increases too aggressively, it builds queues and loss. If it backs off too much, available bandwidth sits idle.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use additive increase and multiplicative decrease, or AIMD. Add a small amount of in-flight data each round trip to probe for spare capacity, then cut the window hard when loss signals congestion.',
        'The asymmetry matters. Gentle growth avoids large overshoot near the ceiling, while halving drains queues quickly after the sender discovers it went too far.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/82/TCP_connection_establishment.svg',
          alt: 'TCP three way connection establishment sequence',
          caption: 'The handshake establishes sequence-number agreement before congestion control begins moving data. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:TCP_connection_establishment.svg.',
        },
        'Slow start begins with a small cwnd and roughly doubles it each round trip: 1, 2, 4, 8, 16, 32. It finds a usable range quickly when the sender has no prior path estimate.',
        'After cwnd reaches ssthresh, congestion avoidance grows linearly by about one segment per round trip. On loss, Reno-style TCP halves cwnd, updates ssthresh, retransmits, and resumes probing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The control invariant is packet conservation. In steady state, a new packet should enter the network when an old packet leaves and produces an ACK.',
        'AIMD also tends toward fairness. A flow with a larger window loses more absolute packets when all flows halve, and repeated additive growth plus multiplicative cuts pushes competing flows toward similar shares.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Per connection, the state is small: cwnd, ssthresh, timers, sequence numbers, and round-trip estimates. The behavioral cost is convergence time.',
        'Slow start reaches window W in about log2(W) round trips. Congestion avoidance recovers from a cut of 1,000 packets to 500 packets by adding about one packet per round trip, so a 100 ms RTT path needs about 50 seconds to climb back.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every HTTP request over TCP relies on congestion control unless another transport such as QUIC is used. SSH, database connections, message brokers, and service-to-service calls inherit the same feedback loop.',
        'The pattern generalizes to application systems. Rate limiters, backpressure, and load shedding also probe capacity and reduce input when downstream signals overload.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Loss-based control can create bufferbloat. If routers have large buffers, loss arrives only after queues are full, so throughput looks high while latency becomes terrible.',
        'Reno also struggles on high-bandwidth, high-delay paths because linear recovery is too slow. CUBIC and BBR were designed to handle paths where classic AIMD leaves capacity unused or reacts to the wrong signal.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Let ssthresh = 32 and the bottleneck drop packets when cwnd reaches 44. Slow start goes 1, 2, 4, 8, 16, 32 in six round trips, sending 63 total segments during that phase.',
        'Congestion avoidance then grows 33, 34, and so on until cwnd = 44. Loss halves cwnd to 22, and the sender climbs linearly again; returning from 22 to 44 takes about 22 round trips.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Jacobson 1988, Congestion Avoidance and Control, Chiu and Jain 1989 for AIMD fairness, RFC 5681 for TCP congestion control, and the CUBIC and BBR papers for modern alternatives. Next study sliding windows, TCP SACK, listen backlogs, QUIC loss recovery, and token-bucket rate limiting.',
      ],
    },
  ],
};
