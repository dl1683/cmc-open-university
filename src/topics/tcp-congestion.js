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
        'The first frame shows the three-way handshake: SYN, SYN-ACK, ACK. This is connection setup, not speed control. It establishes byte-stream numbering before any data moves.',
        'The plot frames track cwnd (congestion window) on the y-axis against round-trip times on the x-axis. The steep early curve is slow start: exponential growth while the sender knows nothing about the path. The gentler slope after ssthresh is congestion avoidance: linear probing near a guessed ceiling. The vertical drop at the loss marker is multiplicative decrease.',
        'The sawtooth shape is not noise. It is the control loop made visible: probe upward, hit a limit, cut back, probe again. Each cycle discovers whether the path has changed since the last loss event.',
        {type: 'callout', text: 'TCP congestion control is feedback control under blindness: the sender changes cwnd from ACK timing and loss, not from direct queue visibility.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'In October 1986, the internet suffered its first congestion collapse. Throughput on the NSFnet backbone dropped by a factor of nearly a thousand because senders responded to packet loss by retransmitting aggressively, flooding already saturated routers with duplicate traffic. More loss caused more retransmissions, which caused more loss.',
        'Van Jacobson diagnosed the problem in his 1988 paper "Congestion Avoidance and Control." The core observation: TCP senders had no mechanism to discover network capacity. They sent as fast as the receiver allowed, treating the network as a pipe with infinite bandwidth. When routers ran out of buffer space, the resulting drops triggered blind retransmission storms.',
        'Congestion control exists to solve two problems at once. It must let a single connection find and use available bandwidth efficiently. And it must ensure that many connections sharing a bottleneck link converge to fair shares without a central coordinator. The sender\'s only inputs are local: acknowledgements, timeouts, and round-trip time measurements.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious rule is: send bytes as fast as the application produces them, and retry anything the receiver has not acknowledged. This is what pre-1988 TCP did. It works on an unloaded network. On a shared network it is catastrophic, because retransmissions add load to a path that is already dropping packets. The system has positive feedback: congestion causes more traffic, which causes more congestion.',
        'A fixed send rate is slightly better but still wrong. A rate chosen for a fast LAN overloads a slow WAN link. A rate chosen for a slow link wastes capacity on a fast one. Even if you pick the right rate initially, network conditions change as other flows start and stop. TCP needs an adaptive control loop, not a static parameter.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The fundamental difficulty is that the sender cannot see the network. It cannot measure queue depths at intermediate routers. It cannot count how many other flows share the bottleneck link. It cannot read the link capacity. The only feedback is what comes back in acknowledgements: timing (round-trip delay) and gaps (missing sequence numbers imply loss).',
        'This makes congestion control a distributed inference problem. Each sender must guess the network state from delayed, noisy, indirect signals and adjust its sending rate without coordinating with other senders. If the adjustment rule is too aggressive, senders overshoot and cause oscillations. If too timid, bandwidth sits idle. The wall is the information gap between sender and network.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Jacobson\'s insight was AIMD: additive increase, multiplicative decrease. Probe capacity by adding one packet per round trip (additive increase). When loss signals congestion, cut the sending window in half (multiplicative decrease). The asymmetry is the key property. The small additive step tests capacity gently near the ceiling. The large multiplicative cut drains queues quickly when the path is overloaded.',
        'AIMD has a mathematical property that makes it special among linear control laws: when multiple flows share a bottleneck and each independently runs AIMD, their window sizes converge to equal shares. A flow with a larger window loses more absolute packets on each cut, shrinking faster than a smaller flow. Over repeated cycles, the shares equalize without any explicit fairness protocol. Chiu and Jain proved this convergence property in 1989.',
        'TCP also separates two kinds of capacity. The receive window (rwnd) says how much data the receiver can buffer. The congestion window (cwnd) says how much data the sender believes the network can carry. The effective window is the minimum of both. This separation lets flow control and congestion control operate independently.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A TCP connection begins with the three-way handshake: the client sends SYN with an initial sequence number, the server replies SYN-ACK with its own sequence number, and the client sends ACK. After this exchange, both sides have proven they can send and receive, and they share a starting point for byte-stream numbering.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/82/TCP_connection_establishment.svg', alt: 'TCP three way connection establishment sequence', caption: 'The handshake establishes sequence-number agreement before congestion control begins moving data. Source: Wikimedia Commons: https://commons.wikimedia.org/wiki/File:TCP_connection_establishment.svg.'},
        'Slow start (Jacobson 1988): cwnd begins at one segment. For each ACK received, cwnd increases by one segment. Because each RTT\'s worth of ACKs roughly doubles the window, growth is exponential: 1, 2, 4, 8, 16, 32 segments over six round trips. The name is ironic; "slow" means slower than blasting the path blind, not slower than linear. Slow start ends when cwnd reaches the slow-start threshold (ssthresh) or when loss occurs.',
        'Congestion avoidance: once cwnd reaches ssthresh, TCP switches from exponential to linear growth. The window increases by roughly one segment per round trip (specifically, cwnd increases by MSS * MSS / cwnd for each ACK, which sums to about one MSS per RTT). This is the additive-increase phase, probing for spare capacity one packet at a time.',
        'Fast retransmit and fast recovery (added by TCP Reno, 1990): when the sender receives three duplicate ACKs, it infers loss without waiting for a timeout. It retransmits the missing segment immediately (fast retransmit), halves cwnd, sets ssthresh to the new cwnd, and continues transmitting at the reduced rate (fast recovery). This avoids the expensive timeout-and-restart path, which would reset cwnd to 1 and re-enter slow start.',
        'Timeout-based recovery: if no ACKs arrive at all (the retransmission timer expires), the sender assumes severe congestion. It sets ssthresh to half the current cwnd, resets cwnd to 1, and re-enters slow start. This is the most aggressive backoff because silence means the path may be completely blocked.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument rests on a conservation principle Jacobson called "packet conservation." In equilibrium, a new packet enters the network only when an old packet leaves (signaled by an ACK). This means the number of packets in flight stays roughly constant once the pipe is full. Slow start and congestion avoidance are mechanisms to reach that equilibrium safely; AIMD is the mechanism to maintain it under changing conditions.',
        'AIMD converges to fairness because the multiplicative cut is proportional to window size. Consider two flows sharing a link, one with cwnd = 40 and another with cwnd = 10. After a loss event, they become 20 and 5. After another round of linear growth and loss, the ratio narrows. Over many cycles, the gap closes. This works without any router support or inter-flow communication.',
        'The system is stable because the feedback loop has negative gain: congestion causes loss, loss causes window reduction, window reduction reduces congestion. As long as the detection signal (loss or delay) correlates with actual congestion, the loop self-corrects.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The per-connection CPU cost is minimal: a few counters (cwnd, ssthresh, RTT estimator), timers, and arithmetic per ACK. The real cost is in convergence time and bandwidth utilization.',
        'Slow start reaches a window of W in log2(W) round trips. On a 100 ms RTT path, reaching cwnd = 1024 takes about 10 RTTs or one second. That is fast. Congestion avoidance is slower: recovering from a halving of cwnd = 1000 to cwnd = 500 takes 500 RTTs, or 50 seconds at 100 ms RTT. On high-bandwidth, high-delay paths, this linear recovery is painfully slow.',
        'Memory cost is the send and receive buffers. The bandwidth-delay product (BDP) sets the minimum buffer needed to fill the pipe: on a 10 Gbps link with 100 ms RTT, BDP is 125 MB. The sender needs at least that much buffer to keep the pipe full during congestion avoidance. On a 100 Gbps link, it is 1.25 GB.',
        'When the number of connections doubles, each connection\'s fair share halves, but the aggregate utilization should remain near 100%. The cost per connection stays O(1) in state. The convergence time to reach fair shares grows logarithmically with the number of flows.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Every HTTP request over TCP uses congestion control. A browser loading a web page opens connections that each independently run slow start and congestion avoidance. CDNs place servers closer to users partly to reduce RTT and therefore speed up slow start convergence.',
        'SSH, database connections (PostgreSQL, MySQL wire protocol), message brokers (Kafka replication), and internal service-to-service traffic all depend on TCP congestion control for reliable delivery without network collapse. QUIC runs over UDP but implements its own congestion control using the same AIMD principles.',
        'The pattern generalizes beyond packets. Rate limiters, load shedders, and backpressure systems all implement the same idea: probe capacity with gentle increases, cut aggressively when the downstream path signals overload. If you design a system that sends work into a shared resource, you are designing a congestion controller.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Loss-based congestion control (Reno, NewReno, CUBIC) treats packet loss as the congestion signal. On paths with large buffers, this means the sender fills the buffer completely before detecting congestion. The result is bufferbloat: throughput looks fine but latency spikes to hundreds of milliseconds because packets sit in long queues. BBR addresses this by estimating bandwidth and RTT directly instead of waiting for loss.',
        'Head-of-line blocking is a structural limitation. TCP delivers a single ordered byte stream. If one packet is lost, all later bytes are held even if they arrived. For multiplexed protocols like HTTP/2, one lost packet on one logical stream blocks all streams. HTTP/3 uses QUIC to give each stream independent loss recovery.',
        'High-bandwidth, high-delay networks ("long fat networks") expose Reno\'s linear recovery problem. After a loss on a 10 Gbps, 100 ms path, recovering 62,500 segments of window takes over 100 minutes with +1/RTT growth. CUBIC and BBR were designed specifically for these paths.',
        'Reno also conflates all loss with congestion. On wireless links, random bit errors cause packet loss that has nothing to do with queue overflow. Treating wireless loss as congestion reduces throughput unnecessarily. This mismatch motivated years of TCP-over-wireless research.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Trace a connection with ssthresh = 32, MSS = 1 segment, and a bottleneck that drops packets when cwnd reaches 44.',
        'Slow start phase: RTT 0: cwnd = 1. RTT 1: cwnd = 2. RTT 2: cwnd = 4. RTT 3: cwnd = 8. RTT 4: cwnd = 16. RTT 5: cwnd = 32. After 6 round trips, cwnd has reached ssthresh. The sender has probed from 1 to 32 segments in flight, doubling each RTT. Total segments sent during slow start: 1 + 2 + 4 + 8 + 16 + 32 = 63.',
        'Congestion avoidance phase: RTT 6: cwnd = 33. RTT 7: cwnd = 34. Each RTT adds roughly one segment. After 12 more RTTs (RTT 17), cwnd = 44. The sender is now probing one packet at a time near the bottleneck capacity.',
        'Loss event: at cwnd = 44, the bottleneck drops a packet. The sender receives three duplicate ACKs. Fast retransmit fires. ssthresh is set to 44 / 2 = 22. cwnd is set to 22 (Reno halving). The sender retransmits the lost segment and enters fast recovery.',
        'Recovery: from cwnd = 22, congestion avoidance resumes. RTT 19: cwnd = 23. RTT 20: cwnd = 24. The sender climbs linearly toward the bottleneck again. If no other flows have joined, it will reach 44 again in about 22 RTTs, and the sawtooth repeats. The average cwnd over the cycle is roughly 33, so average throughput is about 75% of the bottleneck capacity.',
        'Compare with a timeout instead of fast retransmit: cwnd resets to 1 and slow start restarts. The sender must climb from 1 back to 22 (6 RTTs of slow start), then from 22 to 44 (22 RTTs of congestion avoidance). Total recovery: 28 RTTs instead of 22. Fast retransmit saves 6 RTTs of slow start and avoids the throughput collapse during those rounds.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Jacobson, "Congestion Avoidance and Control" (SIGCOMM 1988) is the foundational paper. Chiu and Jain, "Analysis of the Increase and Decrease Algorithms for Congestion Avoidance in Computer Networks" (1989) proves AIMD fairness convergence. RFC 5681 defines the current TCP congestion control standard (slow start, congestion avoidance, fast retransmit, fast recovery). Ha, Rhee, and Xu, "CUBIC: A New TCP-Friendly High-Speed TCP Variant" (2008) describes the cubic growth function used by Linux since 2006. Cardwell et al., "BBR: Congestion-Based Congestion Control" (ACM Queue, 2016) explains the model-based alternative to loss-based control.',
        'Prerequisites: study Sliding Window for the byte-stream flow-control mechanic and How DNS Works for the step before the handshake. Extensions: study TCP Reassembly & SACK Scoreboard for selective acknowledgement and loss recovery internals, TCP Listen Backlog & Accept Queue for server-side connection admission, and QUIC Transport Streams & Loss Recovery for the UDP-based successor that solves head-of-line blocking. Contrasts: compare TCP\'s implicit network feedback with Rate Limiter (Token Bucket) and Circuit Breakers & Deadlines, which make throttling and failure policy explicit at the application layer.',
      ],
    },
  ],
};
