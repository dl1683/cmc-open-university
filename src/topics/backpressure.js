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
  const r2 = (v) => Math.round(v * 100) / 100;
  const ampNodes = [
    { id: 'slow', label: 'server slows', x: 2, y: 5.5, note: 'queue grows' },
    { id: 'timeout', label: 'clients time out', x: 8, y: 5.5, note: 'no answer came' },
    { id: 'retry', label: 'clients RETRY', x: 8, y: 1.3, note: 'more requests' },
    { id: 'load', label: 'load rises', x: 2, y: 1.3, note: 'queue grows faster' },
  ];
  const ampEdges = [
    { id: 'e1', from: 'slow', to: 'timeout' },
    { id: 'e2', from: 'timeout', to: 'retry' },
    { id: 'e3', from: 'retry', to: 'load' },
    { id: 'e4', from: 'load', to: 'slow' },
  ];
  yield {
    state: graphState({ nodes: ampNodes, edges: ampEdges }),
    highlight: { removed: ['e1', 'e2', 'e3', 'e4'] },
    explanation: `The first graph draws overload as a feedback loop with ${ampNodes.length} nodes and ${ampEdges.length} edges. "${ampNodes[0].label}" leads to "${ampNodes[1].label}," which leads to "${ampNodes[2].label}," which leads to "${ampNodes[3].label}" — and back to the start. Each pass around the loop makes the original problem stronger (note: "${ampNodes[0].note}" at the first node becomes "${ampNodes[3].note}" at the last). Retry budgets, breakers, and shedding all interrupt this loop. Backpressure goes one step better: it turns the loop into a stabilizing conversation.`,
    invariant: 'Positive feedback: the response to overload creates more overload — gain > 1 around the loop.',
  };

  const dampNodes = [
    { id: 'slow', label: 'server strains', x: 2, y: 5.5, note: 'queue passes threshold' },
    { id: 'signal', label: 'server SIGNALS', x: 8, y: 5.5, note: '429 / Retry-After / window' },
    { id: 'ease', label: 'clients slow down', x: 8, y: 1.3, note: 'rate × 0.6' },
    { id: 'recover', label: 'load falls, server heals', x: 2, y: 1.3, note: 'signal clears, rates creep up' },
  ];
  const dampEdges = [
    { id: 'e1', from: 'slow', to: 'signal' },
    { id: 'e2', from: 'signal', to: 'ease' },
    { id: 'e3', from: 'ease', to: 'recover' },
    { id: 'e4', from: 'recover', to: 'slow' },
  ];
  yield {
    state: graphState({ nodes: dampNodes, edges: dampEdges }),
    highlight: { found: ['e1', 'e2', 'e3', 'e4'] },
    explanation: `The second graph rewires the loop. The server signals strain via ${dampNodes[1].note}. "${dampNodes[2].label}" at a multiplicative decrease factor of ${0.6}, load falls, "${dampNodes[3].label}," and clients gradually increase again. The pressure travels backward from the congested point to the source of demand. That backward signal — carried by ${dampEdges.length} edges forming a closed cycle — is the core of backpressure.`,
    invariant: 'Negative feedback: the response to overload reduces overload — gain < 1, disturbances decay.',
  };

  const aimdMin = r2(Math.min(...AIMD));
  const aimdMax = r2(Math.max(...AIMD));
  const deafSteady = DEAF[DEAF.length - 1];
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
    explanation: `The live plot compares deaf clients with listening clients over ${AIMD.length} simulation steps. Deaf clients flatline at ${deafSteady} req/s after ${DEAF.length} steps — well above the capacity line at ${CAP}. Listening clients use AIMD and oscillate between ${aimdMin} and ${aimdMax} req/s, sawing around ${CAP}. The sawtooth is not a bug; it is controlled probing around capacity. No client needs to know the true capacity. The feedback loop discovers it.`,
    invariant: 'AIMD converges to fair shares at capacity: gentle probing up, decisive backing off, no global knowledge.',
  };

  const addInc = 1;
  const mulDec = 0.6;
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
    explanation: `TCP uses the same shape. It increases the congestion window by +${addInc} segment per RTT and halves it on congestion signals such as packet loss. Our AIMD clients add +${addInc} req/s and multiply by ${mulDec} on overload — probing capacity at ${CAP}. The network does not centrally assign every sender a perfect rate; senders adapt from feedback. That is why the AIMD curve matters here: it is a proven control loop, not just a microservice pattern.`,
  };
}

function* inTheWild() {
  const ladderRows = [
    { id: 'tcp', label: 'transport: TCP windows' },
    { id: 'http', label: 'application: 429 + Retry-After' },
    { id: 'queue', label: 'infrastructure: bounded queues' },
    { id: 'stream', label: 'in-process: reactive streams' },
    { id: 'kafka', label: 'pipelines: consumer lag' },
  ];
  yield {
    state: matrixState({
      title: 'The backpressure ladder: one idea at every layer',
      rows: ladderRows,
      columns: [{ id: 'how', label: 'how pressure travels backward' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'receiver advertises how much it can take; sender may not exceed it', 'server names the wait; disciplined clients honor it', 'a FULL queue BLOCKS (or rejects) the producer — the queue itself is the wire', 'the SUBSCRIBER requests n items; the publisher may send no more', 'lag metrics throttle producers before the topic drowns'][v],
    }),
    highlight: { active: ['queue:how'], compare: ['stream:how'] },
    explanation: `The stack spans ${ladderRows.length} layers — from "${ladderRows[0].label}" at the bottom to "${ladderRows[ladderRows.length - 1].label}" at the top — and all share one property: the consumer can limit the producer. Each layer carries pressure backward toward the source. A bounded queue (layer ${ladderRows.findIndex(r => r.id === 'queue') + 1} of ${ladderRows.length}) is the simplest form: when full at capacity ${CAP}, it blocks or rejects the producer instead of silently hiding the overload.`,
    invariant: 'A bounded buffer is a backpressure device: its refusal is the signal, delivered to exactly the right party.',
  };

  const paceRows = [
    { id: 'pull', label: 'PULL (consumer-paced)' },
    { id: 'push', label: 'PUSH (producer-paced)' },
  ];
  yield {
    state: matrixState({
      title: 'Pull vs push: who sets the pace?',
      rows: paceRows,
      columns: [{ id: 'bp', label: 'backpressure' }, { id: 'ex', label: 'examples' }],
      values: [[1, 2], [3, 4]],
      format: (v) => ['', 'built in — you cannot pull faster than you process', 'Kafka consumers, generators, GraphQL pagination', 'must be BOLTED ON (windows, acks, demand signals)', 'webhooks, push notifications, raw UDP firehoses'][v],
    }),
    highlight: { found: ['pull:bp'], removed: ['push:bp'] },
    explanation: `Two fundamental approaches set the pace: "${paceRows[0].label}" and "${paceRows[1].label}." Pull systems make backpressure natural because the consumer asks for work only when ready. Push systems need explicit windows, credits, acks, or demand counters bolted on. The design rule is practical: when you can, let the slowest stage set the pace. If you must push, make the credit system real and bounded.`,
  };

  const ruleRows = [
    { id: 'good', label: 'signal → source' },
    { id: 'buffer', label: 'signal → a buffer absorbs it' },
    { id: 'theory', label: 'the control-theory reading' },
  ];
  yield {
    state: matrixState({
      title: 'The cardinal rule: pressure must reach the SOURCE',
      rows: ruleRows,
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'the user sees "uploading paused…" — demand actually falls', 'some queue quietly grows… until it bursts, all at once, later', 'every buffer between signal and source is DELAY in the loop — and delay makes feedback oscillate'][v],
    }),
    highlight: { found: ['good:what'], removed: ['buffer:what'] },
    explanation: `Real backpressure reaches the source of demand ("${ruleRows[0].label}"). If a middle layer absorbs pressure into an unbounded buffer ("${ruleRows[1].label}"), the producer keeps running and the failure is merely delayed. The control-theory reading ("${ruleRows[2].label}") explains why: every buffer between signal and source adds delay to the feedback loop, and delayed feedback tends to oscillate. The practical rule is: short loops, bounded buffers, honest signals, and no hidden infinite queues.`,
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
      heading: `Why this exists`,
      paragraphs: [
        `Backpressure is a feedback signal from the congested part of a system back to the producer of work. The overloaded side says, directly or indirectly, "slow down." A client, producer, sender, or upstream stage honors that signal by reducing rate, blocking, requesting fewer items, or retrying later.`,
        `It is the cooperative counterpart to load shedding and retry discipline. Shedding protects the server by rejecting work. Retry discipline keeps clients from amplifying failure. Backpressure lets the two sides communicate so the system settles near capacity instead of collapsing into queues and retry storms.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `In the feedback-loop view, compare the direction of the loop. The first graph is positive feedback: slowness causes timeouts, timeouts cause retries, retries cause more slowness. The second graph inserts an overload signal that makes clients slow down. The AIMD plot turns that idea into behavior: the sawtooth is controlled probing around capacity, not instability.`,
        `In the wild view, each row shows where the pressure signal lives. TCP windows, 429 responses, bounded queues, stream demand, and consumer lag all let the consumer limit the producer. The pull-versus-push table tells you who sets the pace, and the final table gives the invariant: pressure must reach the source of demand, or an intermediate buffer only delays the failure.`,
      
        {type: 'image', src: './assets/gifs/backpressure.gif', alt: 'Animated walkthrough of the backpressure visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
      heading: `Cost and behavior`,
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
      heading: `Where it fails`,
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
      {
      heading: 'The wall',
      paragraphs: [
        'The wall is hidden queue debt: producers keep sending while the consumer backlog grows.',
        'With a cap of 3 and a consumer at 1 item/sec, a burst of 10 makes the first few items look fine, then creates unbounded wait and delayed collapse.',
        'Bounded queues plus explicit backpressure signals let the producer pause before the system turns latency into runaway memory growth.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Use queue cap 2. Producer emits 5 items instantly, consumer drains 1 item per second.',
        'After two emits the queue is full, so items 3–5 must wait and upstream should slow or drop with explicit policy.',
        'If the system drops silently with no signal, latency explodes and users experience timeout; if it respects backpressure, throughput stabilizes quickly.',
      ],
    },
],
};

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "two feedback loops" view shows two directed graphs side by side. The first graph is a positive feedback loop: server slows, clients time out, clients retry, load rises. Every edge is green-highlighted when active. The second graph rewires the same four stages into a negative feedback loop: server signals strain, clients reduce rate, load falls, server recovers. Watch the edge colors: red edges amplify, green edges damp.',
        'Below the graphs, the AIMD plot draws two live load curves against a capacity line at 100 req/s. The red "deaf clients" curve flatlines at 240 req/s -- pure retry amplification. The green "listening clients" curve produces a sawtooth that oscillates around 100. The sawtooth is the system working correctly: probing up, backing off, probing again.',
        {type: 'image', src: 'https://sookocheff.com/post/networking/how-does-tcp-work/assets/congestion-control.png', alt: 'TCP congestion window sawtooth with multiplicative decrease and additive increase.', caption: 'The sawtooth makes AIMD visible: probe upward, cut sharply on strain, then probe again. (Source: sookocheff.com)'},
        'The "backpressure in the wild" view uses matrix tables. Each row names a layer (TCP, HTTP, queues, reactive streams, Kafka) and describes how pressure travels backward at that layer. Highlighted cells mark the simplest form (bounded queue) and the most formally specified form (reactive-stream demand). The pull-vs-push table contrasts who sets the pace. The final table states the invariant: pressure must reach the source of demand, or a buffer is just deferred failure.',
        {type: 'callout', text: 'Backpressure is negative feedback that makes overload travel backward to the producer before queues become hidden debt.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Any system where a producer can outrun a consumer has a flow-control problem. Without a signal that travels backward from the congested point to the source of demand, the response to overload creates more overload: the server slows, clients time out and retry, retries add load, and the server slows further. This positive-feedback spiral is the root cause of most retry storms and cascading failures in distributed systems.',
        'The term "backpressure" comes from fluid dynamics -- literal resistance that a downstream constriction exerts on upstream flow. In computing it entered common use through TCP congestion control (Jacobson, 1988), where the network feeds loss signals back to senders so they reduce rate. The same idea now appears at every layer: HTTP 429 responses (RFC 6585, 2012), Reactive Streams demand signals (2013 specification, adopted into java.util.concurrent.Flow in Java 9), Kafka consumer lag, bounded Go channels, and Node.js stream highWaterMark.',
        {type: 'image', src: 'https://sookocheff.com/post/networking/how-does-tcp-work/assets/slow-start.png', alt: 'TCP slow start diagram showing exponential congestion window growth.', caption: 'Slow start shows why uncontrolled growth needs a feedback signal before capacity is exceeded. (Source: sookocheff.com)'},
        'Backpressure complements two related defenses. Load shedding protects the server by rejecting work it cannot finish. Retry discipline keeps clients from amplifying failure. Backpressure closes the loop: it lets the congested side tell the producer to change its sending rate before shedding or retries become necessary.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to buffer more. If the producer is faster than the consumer, put a queue between them and let the queue absorb bursts. For short spikes this works -- a 200-request burst against a 100 req/s consumer drains in two seconds if the queue can hold 200 items. Engineers reach for unbounded queues (Java LinkedBlockingQueue with no capacity, Python asyncio.Queue with no maxsize, an SQS queue with no redrive policy) because they never throw "queue full" exceptions and the code is simpler.',
        'A second instinct is to retry on timeout. If a request does not come back, send it again. For transient packet loss or a single crashed backend, retries are correct. They feel like a safety net.',
        'A third instinct is to monitor only the consumer. Dashboards show queue depth, p99 latency, error rate. If something goes wrong, an engineer can intervene. The producer is not involved in the feedback loop at all.',
      ],
    }
  ],
};
