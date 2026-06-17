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
    explanation: 'The first graph draws overload as a feedback loop. The server slows, clients time out, clients retry, load rises, and the server slows further. Each pass around the loop makes the original problem stronger. Retry budgets, breakers, and shedding all interrupt this loop. Backpressure goes one step better: it turns the loop into a stabilizing conversation.',
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
    explanation: 'The second graph rewires the loop. The server signals strain with a 429, Retry-After, smaller window, or full bounded queue. Clients slow down, load falls, the server recovers, and clients gradually increase again. The pressure travels backward from the congested point to the source of demand. That backward signal is the core of backpressure.',
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
    explanation: 'The live plot compares deaf clients with listening clients. Deaf clients keep offering too much load. Listening clients use AIMD: increase slowly while things are calm, cut sharply when the server signals strain. The sawtooth is not a bug; it is controlled probing around capacity. No client needs to know the true capacity. The feedback loop discovers it.',
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
    explanation: 'TCP uses the same shape. It increases the congestion window gradually and cuts it on congestion signals such as packet loss. The network does not centrally assign every sender a perfect rate; senders adapt from feedback. That is why the AIMD curve matters here: it is a proven control loop, not just a microservice pattern.',
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
    explanation: 'The stack examples all share one property: the consumer can limit the producer. TCP windows, HTTP 429, bounded queues, reactive-stream demand, and Kafka lag or quotas all carry pressure backward. A bounded queue is the simplest form: when full, it blocks or rejects the producer instead of silently hiding the overload.',
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
    explanation: 'Pull systems make backpressure natural because the consumer asks for work only when ready. Push systems need explicit windows, credits, acks, or demand counters. The design rule is practical: when you can, let the slowest stage set the pace. If you must push, make the credit system real and bounded.',
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
    explanation: 'Real backpressure reaches the source of demand. If a middle layer absorbs pressure into an unbounded buffer, the producer keeps running and the failure is merely delayed. Buffers also add delay to the control loop, and delayed feedback tends to oscillate. The practical rule is: short loops, bounded buffers, honest signals, and no hidden infinite queues.',
    invariant: 'Backpressure ends at the source or it ends in a burst buffer: every absorbing queue is deferred failure plus loop delay.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'two feedback loops') yield* twoLoops();
  else if (view === 'backpressure in the wild') yield* inTheWild();
  else throw new InputError('Pick a view.');
}

const legacyArticle = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Backpressure is a feedback signal from the congested part of a system back to the producer of work. The overloaded side says, directly or indirectly, "slow down." A client, producer, sender, or upstream stage honors that signal by reducing rate, blocking, requesting fewer items, or retrying later.`,
        `It is the cooperative counterpart to load shedding and retry discipline. Shedding protects the server by rejecting work. Retry discipline keeps clients from amplifying failure. Backpressure lets the two sides communicate so the system settles near capacity instead of collapsing into queues and retry storms.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `In the feedback-loop view, compare the direction of the loop. The first graph is positive feedback: slowness causes timeouts, timeouts cause retries, retries cause more slowness. The second graph inserts an overload signal that makes clients slow down. The AIMD plot turns that idea into behavior: the sawtooth is controlled probing around capacity, not instability.`,
        `In the wild view, each row shows where the pressure signal lives. TCP windows, 429 responses, bounded queues, stream demand, and consumer lag all let the consumer limit the producer. The pull-versus-push table tells you who sets the pace, and the final table gives the invariant: pressure must reach the source of demand, or an intermediate buffer only delays the failure.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Without backpressure, overload can become positive feedback: the server slows, clients time out, clients retry, and load rises. The response to the problem becomes more of the problem. With backpressure, the loop changes direction: the server signals strain, clients slow down, load falls, the server recovers, and clients cautiously increase again.`,
        `The AIMD plot shows one simple control law. Additive increase probes upward slowly while the service is healthy. Multiplicative decrease cuts rate sharply when the service signals overload. The result is a sawtooth around capacity. It is not perfectly smooth, but it is stable and fair enough without a central scheduler.`,
        `Backpressure can be explicit, such as HTTP 429 with Retry-After, or structural, such as a bounded queue that blocks the producer. It can be pull-based, where the consumer asks for more work only when ready, or push-based with credits and windows. The important requirement is that the signal reaches the source of demand.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The mechanism is often cheap: a queue cap, a semaphore, a request-n counter, a window size, or a Retry-After header. The hard part is discipline. Producers must actually respect the signal, and intermediate layers must not hide it behind unbounded buffers.`,
        `Backpressure may reduce peak offered load, but that is the point. It trades uncontrolled throughput spikes for stable useful throughput and lower tail latency. The main failure cost is delayed feedback: if pressure has to pass through several buffers before reaching the producer, the system can oscillate between too much and too little work.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `TCP congestion control is the classic example: senders increase cautiously and reduce on congestion signals. HTTP APIs use 429 and Retry-After. Streaming libraries use high-water marks and demand signals. Go channels and bounded executor queues block or reject producers. Kafka consumers pull at their own pace, while lag and quotas signal when producers or operators need to slow down.`,
        `Backpressure also shows up in databases, graphics pipelines, LLM serving queues, batch systems, and browser streams. Anywhere a producer can outrun a consumer, you either need a feedback signal or you are choosing where the buffer will explode.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `A slow server is not backpressure by itself. Backpressure requires a signal and a producer that honors it. A 429 ignored by a client that immediately retries is just wasted bytes.`,
        `The absorbing-buffer trap is the big one. If a service accepts everything into an unbounded queue, the caller believes work was accepted while the true bottleneck gets no relief. That is deferred failure, not backpressure. Prefer bounded queues, pull APIs, explicit credits, and clear refusal when the downstream cannot keep up.`,
        `Fairness also depends on participation. AIMD-style behavior is stable when clients follow the same rules. Aggressive clients can take more than their share unless the server enforces quotas or admission limits.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Retries, Backoff & Jitter shows what happens when clients do not listen carefully. Load Shedding & Graceful Degradation shows the server-side protection when pressure is too high. Circuit Breakers & Deadlines adds fast failure and cancellation for doomed work.`,
        `For deeper mechanics, study TCP Congestion Control, Message Queue, Semaphore Permit Counter, and Exchange Operator Parallel Query. LLM Serving Admission-Control Goodput Gate applies the same feedback idea to GPU serving capacity, token budgets, and queue age.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Backpressure exists because overload is a feedback problem. A server slows down, clients time out, clients retry, load rises, queues grow, and the server slows further. Without a signal that reaches the producer, the response to overload creates more overload.',
        'The core job is simple: let the congested part of the system tell upstream producers to slow down, pause, request less, or retry later. That signal can be a TCP window, a bounded queue, a stream demand counter, an HTTP 429, a Retry-After header, consumer lag, or an admission-control gate.',
        'Backpressure is the cooperative companion to load shedding and retry discipline. Shedding says "I cannot accept this." Retry discipline says "do not make failure worse." Backpressure says "change your sending rate because downstream is strained."',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to buffer more. If producers are faster than consumers, add a bigger queue and smooth the burst. That works for short bursts, but unbounded buffering hides the overload signal from the producer and converts a live control problem into delayed failure.',
        'Another shortcut is retrying on timeout. That is useful for transient loss but dangerous during overload. Instant retries add traffic exactly when the system is already slow.',
        'A third shortcut is monitoring the consumer only. If the producer never receives and honors the signal, the loop is incomplete. Backpressure must travel to the source of demand.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is negative feedback. In a positive feedback loop, overload causes behavior that increases overload. In a negative feedback loop, overload causes behavior that reduces overload.',
        'AIMD captures the shape: increase slowly while healthy, decrease sharply when congestion appears. No sender needs perfect knowledge of capacity. The feedback loop discovers a usable rate by probing upward and backing off when the receiver signals strain.',
        'The invariant is that pressure must not be absorbed silently by an infinite buffer. A bounded queue, window, credit count, or request-n signal is useful precisely because it refuses to hide the downstream limit.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'At the transport layer, TCP receivers advertise windows and congestion control changes send rate based on loss or other congestion signals. At the application layer, APIs can return 429 or Retry-After, and clients can honor those signals with budgets and backoff.',
        'Inside a process, a bounded queue can block or reject producers when consumers fall behind. In reactive streams, the subscriber requests a number of items and the publisher may not exceed that demand. In Kafka-like systems, consumer lag, quotas, and pull behavior tell producers and operators where pressure is accumulating.',
        'Backpressure can be pull-based or push-based. Pull systems make the consumer set the pace by asking for more work. Push systems need explicit windows, credits, acknowledgments, or rate signals. Push without credits is where overload usually becomes a surprise.',
        'A correct implementation also defines what happens when pressure persists. Some systems block producers, some reject new work, some drop low-priority messages, and some reduce quality. The important part is that the policy is explicit and visible instead of hidden in an expanding queue.',
        'Cancellation is part of the same story. If downstream no longer needs work, upstream should stop producing it. Deadlines, abort signals, and context cancellation prevent the system from spending capacity on results nobody will use.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The first feedback graph proves the retry spiral. Slowness creates timeouts, timeouts create retries, retries create load, and load creates more slowness.',
        'The second graph proves the repair: overload must create a signal that makes clients reduce demand. The system becomes damped rather than amplified.',
        'The AIMD plot proves why sawtooth behavior is acceptable. The system probes capacity, crosses it, backs off, and probes again. Smoothness is less important than stability around usable capacity.',
        'The ladder view proves that the same idea appears at many layers: TCP windows, 429 responses, bounded queues, stream demand, and consumer lag are all ways to push pressure backward.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backpressure works because it connects cause and effect. The producer is the only party that can reduce future work. A full queue or strained server can only help if that state changes producer behavior.',
        'AIMD works because additive increase avoids sudden overload during probing, while multiplicative decrease reacts strongly when capacity is exceeded. Many independent clients can converge toward fair shares without centralized rate assignment.',
        'Bounded buffers work because refusal is information. A full queue tells the producer the consumer is behind. An unbounded queue hides that information until latency, memory, or failure explodes.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Backpressure can reduce apparent throughput because it refuses work that would otherwise be queued. That is the right trade when queued work would miss deadlines or trigger retry storms. Useful throughput is more important than accepted-but-doomed work.',
        'The tradeoff is latency versus utilization. A very conservative limit protects latency but may underuse capacity. A very loose limit maximizes bursts but risks queue growth. Control loops need thresholds, hysteresis, and monitoring to avoid oscillation.',
        'Implementation also costs coordination. Clients must respect signals, libraries must expose bounded queues or demand APIs, and middle layers must not silently absorb pressure.',
        'There is a product tradeoff too. A video pipeline might lower quality, a search system might return partial results, and a payment system might reject quickly rather than risk duplicate work. Backpressure should name the acceptable degradation mode.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Backpressure matters in network protocols, HTTP APIs, message queues, streaming systems, databases, LLM serving, browser streams, file pipelines, and any producer-consumer chain where one side can outrun another.',
        'It is especially important in systems with retries. Without backpressure, retries can amplify a small slowdown into an outage. With backpressure, the same overload can become a controlled slowdown, fast rejection, or scheduled retry.',
        'It also wins in multi-stage pipelines. If stage three is slow, stage two should slow down, and stage one should eventually stop producing at the old rate. Otherwise every stage becomes a buffer for the same problem.',
        'It is also useful inside a single machine. Thread pools, file readers, network writers, GPU batchers, and browser streams all need a way for the slower stage to set the pace before memory grows without bound.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'A slow server is not backpressure by itself. Backpressure requires a signal and a producer that honors it. A 429 ignored by a client that immediately retries is just wasted traffic.',
        'The absorbing-buffer trap is the big one. If a service accepts everything into an unbounded queue, the caller believes work was accepted while the true bottleneck gets no relief. That is deferred failure, not control.',
        'Fairness also depends on enforcement. AIMD-style behavior works best when clients follow rules. Aggressive clients can take more than their share unless the server enforces quotas, windows, or admission limits.',
        'A final failure is signal ambiguity. If overload responses look like ordinary errors, clients may retry harder instead of slowing down. Backpressure signals should be machine-readable, documented, and tested under overload.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Retries, Backoff & Jitter for client behavior, Load Shedding & Graceful Degradation for server protection, Circuit Breakers & Deadlines for fast failure, TCP Congestion Control for transport feedback, Message Queue for buffering tradeoffs, Semaphore Permit Counter for bounded admission, and LLM Serving Admission-Control Goodput Gate for GPU-serving capacity control.',
        'When reviewing a design, ask where pressure is measured, where it is signaled, who changes rate, and what bounded resource enforces the answer.',
      ],
    },
  ],
};
