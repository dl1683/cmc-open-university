// Backpressure: overload is a conversation. When servers can SIGNAL strain
// and clients LISTEN, the feedback loop dampens instead of amplifying —
// simulated live here with the same AIMD algorithm that runs the internet.

import { plotState, matrixState, graphState, InputError } from '../core/state.js';

export const topic = {
  id: 'backpressure',
  title: 'Backpressure & Flow Control',
  category: 'Systems',
  summary: 'Overload as a feedback loop: amplifying loops melt down, damping loops sawtooth around capacity — AIMD, live.',
  controls: [
    { id: 'view', label: 'Regulate', type: 'select', options: ['two feedback loops', 'backpressure in the wild'], defaultValue: 'two feedback loops' },
  ],
  run,
};

// AIMD, live: 10 clients, additive-increase (+1/s), multiplicative-decrease
// (×0.6 on overload signal), against capacity 100.
const CAP = 100;
function simulateAIMD(steps) {
  let rates = Array(10).fill(2);
  const loads = [];
  for (let t = 0; t < steps; t++) {
    const total = rates.reduce((a, b) => a + b, 0);
    loads.push(total);
    rates = total <= CAP ? rates.map((r) => r + 1) : rates.map((r) => r * 0.6);
  }
  return loads;
}
const AIMD = simulateAIMD(40);
// The deaf clients: retries amplify to the 3x saturation from Retries & Jitter.
const DEAF = Array.from({ length: 40 }, (_, t) => (t < 6 ? 80 : 240));

function* twoLoops() {
  yield {
    state: graphState({
      nodes: [
        { id: 'slow', label: 'server slows', x: 2, y: 5.5, note: 'queue grows' },
        { id: 'timeout', label: 'clients time out', x: 8, y: 5.5, note: 'no answer came' },
        { id: 'retry', label: 'clients RETRY', x: 8, y: 1.3, note: 'more requests' },
        { id: 'load', label: 'load rises', x: 2, y: 1.3, note: 'queue grows faster' },
      ],
      edges: [
        { id: 'e1', from: 'slow', to: 'timeout' },
        { id: 'e2', from: 'timeout', to: 'retry' },
        { id: 'e3', from: 'retry', to: 'load' },
        { id: 'e4', from: 'load', to: 'slow' },
      ],
    }),
    highlight: { removed: ['e1', 'e2', 'e3', 'e4'] },
    explanation: 'Draw the overload stories from Retries, Backoff & Jitter and Load Shedding & Graceful Degradation as a CIRCUIT and the villain appears: a LOOP. Server slows → clients time out → clients retry → load rises → server slows MORE. Each trip around the circle amplifies the signal — engineers borrow the control-theory name POSITIVE FEEDBACK, the same loop that turns a microphone near its speaker into a shriek. Every metastable failure is this circle spinning; every fix you have studied (budgets, shedding, breakers) is an attempt to cut one of its wires. Backpressure asks a better question: what if we rewired the loop to spin the OTHER way?',
    invariant: 'Positive feedback: the response to overload creates more overload — gain > 1 around the loop.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'slow', label: 'server strains', x: 2, y: 5.5, note: 'queue passes threshold' },
        { id: 'signal', label: 'server SIGNALS', x: 8, y: 5.5, note: '429 / Retry-After / window' },
        { id: 'ease', label: 'clients slow down', x: 8, y: 1.3, note: 'rate × 0.6' },
        { id: 'recover', label: 'load falls, server heals', x: 2, y: 1.3, note: 'signal clears, rates creep up' },
      ],
      edges: [
        { id: 'e1', from: 'slow', to: 'signal' },
        { id: 'e2', from: 'signal', to: 'ease' },
        { id: 'e3', from: 'ease', to: 'recover' },
        { id: 'e4', from: 'recover', to: 'slow' },
      ],
    }),
    highlight: { found: ['e1', 'e2', 'e3', 'e4'] },
    explanation: 'The rewired circle: server strains → server SAYS SO (an HTTP 429/503 with Retry-After, a shrinking TCP window, a queue refusing the next item) → clients EASE OFF → load falls → server heals → clients gently speed back up. Same four corners, opposite gain: each trip around now SHRINKS the disturbance — NEGATIVE feedback, the thermostat\'s loop, the steam governor\'s loop, the loop that makes systems settle instead of shriek. That is all backpressure is: giving the pressure a wire to travel BACKWARD, from the choked to the chokers.',
    invariant: 'Negative feedback: the response to overload reduces overload — gain < 1, disturbances decay.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seconds' }, y: { label: 'offered load (requests/s)' } },
      series: [
        { id: 'cap', label: 'capacity', points: [{ x: 0, y: CAP }, { x: 39, y: CAP }] },
        { id: 'deaf', label: 'deaf clients (retry loop)', points: DEAF.map((y, t) => ({ x: t, y })) },
        { id: 'aimd', label: 'listening clients (AIMD)', points: AIMD.map((y, t) => ({ x: t, y })) },
      ],
    }),
    highlight: { removed: ['deaf'], found: ['aimd'], visited: ['cap'] },
    explanation: 'Both loops, run live. The DEAF clients (no feedback channel) pin the system at the 3× retry saturation from Retries, Backoff & Jitter and hold it underwater indefinitely. The LISTENING clients run AIMD — Additive Increase, Multiplicative Decrease: creep your rate up by +1 each calm second, cut it ×0.6 the moment the server signals strain. Watch the shape it draws: a SAWTOOTH that climbs to capacity, overshoots a hair, backs off sharply, and climbs again — hugging the capacity line forever without anyone knowing what that capacity IS. Ten clients, zero coordination, no shared state: the fairness and the stability both emerge from the loop.',
    invariant: 'AIMD converges to fair shares at capacity: gentle probing up, decisive backing off, no global knowledge.',
  };

  yield {
    state: matrixState({
      title: 'You have seen this sawtooth before',
      rows: [
        { id: 'tcpRow', label: 'TCP congestion control' },
        { id: 'here', label: 'this page\'s AIMD clients' },
      ],
      columns: [{ id: 'inc', label: 'probe up' }, { id: 'dec', label: 'back off' }, { id: 'signal', label: 'the strain signal' }],
      values: [[1, 2, 3], [4, 5, 6]],
      format: (v) => ['', '+1 segment per RTT', 'halve the window', 'a dropped packet', '+1 req/s per second', '×0.6 the rate', 'a 429 / Retry-After'][v],
    }),
    highlight: { compare: ['tcpRow:signal', 'here:signal'] },
    explanation: 'The reveal for anyone who read TCP: Handshake & Congestion Control — that sawtooth IS TCP\'s congestion window, beat for beat — additive increase per round trip, multiplicative decrease on packet loss, the loss itself serving as the network\'s backpressure signal. Every byte you have ever downloaded traveled under this exact feedback law, negotiated among millions of strangers\' connections sharing links nobody measures centrally. The internet is the existence proof that backpressure scales: not a clever trick for your microservice, but the most successful distributed control loop ever deployed.',
  };
}

function* inTheWild() {
  yield {
    state: matrixState({
      title: 'The backpressure ladder: one idea at every layer',
      rows: [
        { id: 'tcp', label: 'transport: TCP windows' },
        { id: 'http', label: 'application: 429 + Retry-After' },
        { id: 'queue', label: 'infrastructure: bounded queues' },
        { id: 'stream', label: 'in-process: reactive streams' },
        { id: 'kafka', label: 'pipelines: consumer lag' },
      ],
      columns: [{ id: 'how', label: 'how pressure travels backward' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'receiver advertises how much it can take; sender may not exceed it', 'server names the wait; disciplined clients honor it', 'a FULL queue BLOCKS (or rejects) the producer — the queue itself is the wire', 'the SUBSCRIBER requests n items; the publisher may send no more', 'lag metrics throttle producers before the topic drowns'][v],
    }),
    highlight: { active: ['queue:how'], compare: ['stream:how'] },
    explanation: 'The same idea wearing every uniform in the stack. The deepest entry is the humble BOUNDED QUEUE: where Load Shedding & Graceful Degradation showed unbounded queues absorbing pressure until everyone drowns, a bounded queue REFUSES — and that refusal travels backward to the producer as blocking or rejection, making the queue itself the backpressure wire (this is why Go channels block, why Kafka topics have quotas, and why the Message Queue page\'s buffering is a feature only when finite). Reactive streams (RxJava, Project Reactor, Node streams\' highWaterMark) move the idea in-process: the consumer REQUESTS n items, and the producer may not exceed the demand.',
    invariant: 'A bounded buffer is a backpressure device: its refusal is the signal, delivered to exactly the right party.',
  };

  yield {
    state: matrixState({
      title: 'Pull vs push: who sets the pace?',
      rows: [
        { id: 'pull', label: 'PULL (consumer-paced)' },
        { id: 'push', label: 'PUSH (producer-paced)' },
      ],
      columns: [{ id: 'bp', label: 'backpressure' }, { id: 'ex', label: 'examples' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'built in — you cannot pull faster than you process', 'Kafka consumers, generators, GraphQL pagination', 'must be BOLTED ON (windows, acks, demand signals)', 'webhooks, push notifications, raw UDP firehoses'][v],
    }),
    highlight: { found: ['pull:bp'], removed: ['push:bp'] },
    explanation: 'The architectural fork that decides how hard your life will be: PULL systems have backpressure by construction — a Kafka consumer fetches when ready, a generator computes the next value only when asked (the same lazy pull as this site\'s own step generators) — the consumer\'s pace IS the flow control. PUSH systems must retrofit it: windows, acknowledgment credits, demand counters, and every retrofit is a place to get it wrong. The rule of thumb when designing a pipeline: make the slowest party the one who sets the pace, and most overload problems never get born.',
  };

  yield {
    state: matrixState({
      title: 'The cardinal rule: pressure must reach the SOURCE',
      rows: [
        { id: 'good', label: 'signal → source' },
        { id: 'buffer', label: 'signal → a buffer absorbs it' },
        { id: 'theory', label: 'the control-theory reading' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'the user sees "uploading paused…" — demand actually falls', 'some queue quietly grows… until it bursts, all at once, later', 'every buffer between signal and source is DELAY in the loop — and delay makes feedback oscillate'][v],
    }),
    highlight: { found: ['good:what'], removed: ['buffer:what'] },
    explanation: 'The rule that separates real backpressure from decorative: the pressure must propagate ALL THE WAY to whoever creates the demand — the user\'s upload pauses, the batch job slows, the producer thread blocks. If any layer in between absorbs the signal into an unbounded buffer instead of passing it back, the system has not been protected, only given a delayed detonation (the buffer bloats, then bursts). Control theory has a name for the deeper problem: every buffer between the signal and the source adds DELAY to the feedback loop, and delayed feedback oscillates — overshooting and undershooting like a shower whose hot water lags the knob. Short loops, bounded buffers, honest signals: the overload trilogy — shedding (the server protects itself), retry discipline (the client behaves), backpressure (they actually talk) — closes here, as a conversation.',
    invariant: 'Backpressure ends at the source or it ends in a burst buffer: every absorbing queue is deferred failure plus loop delay.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'two feedback loops') yield* twoLoops();
  else if (view === 'backpressure in the wild') yield* inTheWild();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Backpressure is a signal traveling backward. When a server is drowning under load, it sends a message to its clients: "I am overloaded, please slow down." The clients LISTEN and ease off their requests. The feedback loop flips from amplifying to damping — the same positive-feedback shriek you saw in Retries, Backoff & Jitter becomes a negative-feedback thermostat. No one is perfect; everyone does not have to be. The server only needs to say "I strain" and the clients need to hear it, and the overload problem stops being a collapse and becomes a conversation.`,
        `The core idea runs on every scale: HTTP 429 (Too Many Requests) with a Retry-After header, a TCP sender respecting the receiver's advertised window size, a Kafka consumer requesting only as many messages as it can handle, a Go channel blocking the writer when full. In every case, the pressure — the strain at the point of congestion — travels backward to whoever is causing the demand. That backward wire is the whole secret.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start with the positive-feedback amplifier: the server slows (queue grows) → clients time out (no answer comes) → clients retry (more requests) → load rises (queue grows faster) → the server slows even more. Each loop tightens the knot. This is the circuit you drew in Retries, Backoff & Jitter: overload begets timeouts beget retries beget worse overload, the same spiral that turns a microphone near its speaker into a shriek.`,
        `Backpressure redraws the circuit: the server strains (queue passes a threshold) → the server SIGNALS (sends back 429, or advertises a shrinking TCP window, or refuses the next item from a bounded queue) → clients slow down (cut their rate, honor Retry-After, request fewer messages) → load falls → the server heals → signal clears → clients gently speed back up. Same four corners, opposite gain. Each loop now SHRINKS the disturbance instead of amplifying it. This is the thermostat's loop, the steam governor's loop, the negative-feedback law that makes systems settle instead of shriek.`,
        `The live AIMD simulation on this page shows the effect. Ten uncoordinated clients with zero knowledge of the server's true capacity run Additive Increase, Multiplicative Decrease: creep your rate up by +1 request per second each calm second, multiply it by 0.6 the instant the server signals strain (a 429 response). Without any centralized coordination, they converge on a sawtooth pattern that hugs the capacity line, overshooting slightly, backing off sharply, and climbing again — fair, stable, emergent. The deaf clients in the same simulation (who get a 429 but retry anyway, like the retry-storm from Retries, Backoff & Jitter) pin the system at 3× overload and hold it underwater. The difference is one wire: the ability to hear.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Implementation cost: low. HTTP has 429; TCP windows are ancient and built into every OS; bounded queues are trivial data structures. The hard cost is DISCIPLINE. Clients must listen to the signal (honor Retry-After, respect TCP window shrinkage, request only what they can process). Many systems send the signal but no one respects it, wasting the wire.`,
        `Latency cost: minimal. A bounded queue adds one rejection check (a pointer comparison). A TCP window announcement costs nothing new (it is already in every packet). An HTTP 429 costs one HTTP roundtrip more than the blocked request cost you were already paying. Throughput: slightly lower peak because the system does not allow itself to overshoot as far before easing off, but far more predictable and lower tail latency (no sudden collapses).`,
        `The control-theory cost: delay. Every buffer between the signal and the SOURCE is added latency in the feedback loop, and delayed feedback oscillates — overshooting and undershooting like a shower whose hot water lags the knob. The cardinal rule is absolute: pressure must reach the SOURCE (the producer, the user, the batch job) or it ends in a burst buffer. An absorbing queue that hides the signal is deferred failure plus loop delay. This is why Message Queue systems that refuse new messages when full are backpressure; systems that silently buffer to disk are not.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `TCP: every byte you have ever downloaded traveled under TCP congestion control, the same AIMD law shown in this visualization, negotiated among millions of strangers sharing a single network link with zero global knowledge. The packet loss IS the network's backpressure signal; the sender's congestion window IS the sawtooth. You read about it in TCP: Handshake & Congestion Control — now you see the internet is the existence proof that backpressure scales.`,
        `HTTP request throttling: a service under siege sends 429 with Retry-After and disciplined clients (browsers, SDKs that honor Retry-After) back off. Undisciplined clients (retry immediately in a loop) turn the wire into copper and make the collapse worse. Load Shedding & Graceful Degradation may refuse to accept low-priority requests outright, a more aggressive signal.`,
        `Bounded queues in infrastructure: Go channels block when full (or panic if unbuffered). RabbitMQ and Kafka enforce quotas per topic or consumer group. The queue's refusal to accept the next item IS the backpressure wire, forcing the producer to block (Go) or batch smaller (Kafka). No invisible buffering on disk that explodes later.`,
        `In-process reactive streams: RxJava, Project Reactor, Node.js streams use highWaterMark or demand signals. The consumer requests N items; the producer may not exceed N. The subscriber is in control, pulling at its pace, and the producer respects that demand. This is pull-based backpressure, the architecture where the slowest party sets the tempo and overload never gets born.`,
        `Consumer lag monitoring: Kafka metrics like consumer_lag_seconds tell producers "your subscribers are falling behind; if this creeps toward your retention window, they starve and lose data." A backpressure signal woven into the metrics themselves, for humans and alerts to respect.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest misconception: confusing backpressure with a slow server. A slow server may trigger backpressure signals, but backpressure is the discipline of HONORING them. If the server sends 429 and the client ignores it and retries immediately, there is no backpressure — only a client that does not listen. The wire carries no current if the receiver is deaf.`,
        `A second trap: the absorbing buffer. A service receives a request, says "OK" (202 Accepted), and enqueues it to a job queue with unlimited depth. The client is happy; the server appears responsive. But the queue grows silently until it explodes, and the true bottleneck (the job processor far downstream) never had a chance to signal. The signal never reached the source; only the delayed detonation did. This is Load Shedding & Graceful Degradation's mistake.`,
        `Confusing pull with push: a push-based system (webhooks, push notifications, raw UDP firehoses) forces backpressure to be bolted on — windows, ack counters, demand signals, all fragile retro-fits. A pull-based system (Kafka consumers, generators, lazy evaluation) has backpressure by construction: you cannot pull faster than you process. When designing pipelines, prefer pull; if you must push, retrofit honestly.`,
        `Lagging feedback: if the backpressure signal is "I am full" but by the time it reaches the source, the producer has already queued 100 more requests in a buffer, the loop has lag and will oscillate. The shower-knob metaphor: hot water is slow to arrive, so you keep turning up the temperature, then suddenly it scalds you. Short loops, bounded buffers, honest signals. This is why Message Queue shows how queues work — a queue with a lid stops the producer right at the source.`,
        `Misunderstanding fairness: AIMD is fair (all clients converge to equal shares), but only if all clients run it. If some clients are aggressive and others disciplined, the aggressive ones take more. TCP faces this every second with bittorrent and other protocols. Fairness is not automatic; it emerges only when everyone plays by the same rule.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Backpressure is the third pillar of the overload trilogy, closing a conversation you began in Retries, Backoff & Jitter (the client behaves) and Load Shedding & Graceful Degradation (the server protects itself). Together, they answer the question: when demand exceeds capacity, what happens? Retry discipline buys time; shedding protects the core; backpressure makes them actually talk.`,
        `LLM Serving Admission-Control Goodput Gate brings that same feedback loop into model serving: the gate reads token budget, KV pressure, queue age, and deadlines, then admits, defers, sheds, or degrades before the GPU spends work on a request that can no longer finish.`,
        `Read TCP: Handshake & Congestion Control to see the sawtooth in real life — AIMD was not invented for this page; it is how the internet's most successful protocol has worked since 1988. Understand Message Queue to see how bounded buffers close the loop at different scales — the queue IS the backpressure wire.`,
        `For producer-consumer pipelines, learn about Retries, Backoff & Jitter again to see why exponential backoff respects signals, and Load Shedding & Graceful Degradation to understand when to drop instead of queue. Exchange Operator Parallel Query shows the same bounded-queue discipline inside parallel database execution. If you are building reactive code, study how RxJava and Project Reactor implement demand: that is pull-based backpressure in real codebases.`,
      ],
    },
  ],
};
