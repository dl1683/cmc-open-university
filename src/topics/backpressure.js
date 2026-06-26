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
        'The "two feedback loops" view draws two directed graphs. The first graph is a positive feedback loop: server slows, clients time out, clients retry, load rises -- each edge feeds the next, and the loop amplifies the original problem. The second graph rewires those same four stages into a negative feedback loop: server signals strain, clients reduce rate, load falls, server recovers. Watch the edge highlights: red edges amplify, green edges damp.',
        'Below the graphs, the AIMD plot draws two live load curves against a capacity line at 100 req/s. The red "deaf clients" curve flatlines at 240 req/s, pure retry amplification with no feedback. The green "listening clients" curve produces a sawtooth that oscillates around 100. That sawtooth is the system working correctly: probing upward by adding 1 req/s each second, cutting rate to 60% on each overload signal, then probing again.',
        {type: 'image', src: 'https://sookocheff.com/post/networking/how-does-tcp-work/assets/congestion-control.png', alt: 'TCP congestion window sawtooth with multiplicative decrease and additive increase.', caption: 'The sawtooth makes AIMD visible: probe upward, cut sharply on strain, then probe again. (Source: sookocheff.com)'},
        'The "backpressure in the wild" view uses matrix tables. Each row names a layer -- TCP, HTTP, queues, reactive streams, Kafka -- and describes how pressure travels backward at that layer. Highlighted cells mark the simplest form (bounded queue that blocks the producer) and the most formally specified form (reactive-stream demand counters). The pull-vs-push table contrasts who sets the pace. The final table states the cardinal rule: pressure must reach the source of demand, or a buffer is just deferred failure.',
        {type: 'callout', text: 'Backpressure is negative feedback that makes overload travel backward to the producer before queues become hidden debt.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Any system where a producer can outrun a consumer has a flow-control problem. A web server handling 500 req/s behind a database that can sustain 200 req/s will, without intervention, pile up 300 requests per second into whatever buffer sits between them. That buffer grows without bound, latency climbs, and eventually something breaks -- memory exhaustion, timeouts, or cascading failures upstream.',
        'The deeper issue is that overload creates positive feedback. The server slows under load, so clients time out and retry. Retries add load, so the server slows further. Each trip around this loop makes the original problem worse. Retry storms, cascading failures, and thundering herds all trace back to this amplifying loop. Backpressure exists to break it: a signal that travels backward from the congested point to the source of demand, telling the producer to slow down before queues become hidden debt.',
        {type: 'image', src: 'https://sookocheff.com/post/networking/how-does-tcp-work/assets/slow-start.png', alt: 'TCP slow start diagram showing exponential congestion window growth.', caption: 'Slow start shows why uncontrolled growth needs a feedback signal before capacity is exceeded. (Source: sookocheff.com)'},
        'The term comes from fluid dynamics, where a downstream constriction exerts literal resistance on upstream flow. In computing, backpressure entered wide use through Van Jacobson\'s 1988 TCP congestion-control paper: senders increase rate cautiously, and when the network signals congestion (a dropped packet), they cut rate sharply. The same idea now appears at every layer of software systems.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is to buffer. If the producer is faster than the consumer, put a queue between them and let the queue absorb bursts. For short spikes this works: a 200-request burst against a 100 req/s consumer drains in two seconds if the queue can hold 200 items. Engineers reach for unbounded queues -- Java\'s LinkedBlockingQueue with no capacity argument, Python\'s asyncio.Queue with no maxsize, an SQS queue with no redrive policy -- because they never throw "queue full" exceptions and the code is simpler.',
        'The second instinct is to retry on timeout. If a request gets no response, send it again. For transient packet loss or a single crashed backend, retries are correct. They feel like a safety net that costs nothing.',
        'The third instinct is to monitor only the consumer. Dashboards show queue depth, p99 latency, and error rate. If something goes wrong, a human intervenes. The producer is not involved in the feedback loop at all -- it keeps sending at whatever rate it wants.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Unbounded buffers do not solve the problem; they hide it. Suppose a producer sends 150 req/s and a consumer drains 100 req/s. An unbounded queue absorbs the difference -- 50 items per second. After one minute, the queue holds 3,000 items. After ten minutes, 30,000. Each new request waits behind everything already in the queue, so latency grows linearly with time. The producer sees fast enqueue times and believes everything is fine. The consumer is drowning.',
        'Retries make it worse. When latency rises past the client\'s timeout, the client retries the original request. Now the queue holds the original request and the retry, doubling the load on a consumer that was already behind. If ten clients each retry once, the queue receives 20 requests where 10 would have sufficed. The amplification factor is unbounded because each retry can itself time out and trigger another retry.',
        'Monitoring alone cannot fix this in real time. By the time an alert fires on queue depth, thousands of requests are already stacked. Draining the backlog takes time the system does not have, because new requests keep arriving. The wall is the moment when accumulated hidden debt becomes visible -- latency spikes, memory pressure, timeouts cascading upstream -- and by then the only recovery option is to drop work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The fix is not a bigger buffer or a smarter retry. The fix is a signal that travels backward from the congested point to the source of demand and causes the source to reduce its sending rate. This is backpressure: negative feedback that makes overload travel upstream instead of accumulating downstream.',
        'The key property is directionality. In a positive feedback loop, the response to overload creates more overload -- gain around the loop is greater than 1, and disturbances grow. In a negative feedback loop, the response to overload reduces overload -- gain is less than 1, and disturbances decay. Backpressure converts a positive loop into a negative one by adding a backward edge: the congested consumer tells the producer to slow down, load falls, the consumer recovers, and the producer cautiously increases again.',
        'This is exactly what a thermostat does. The room gets too hot, the thermostat turns off the furnace, the room cools, the thermostat turns the furnace back on. The temperature oscillates around the setpoint. The oscillation is not a bug -- it is the signature of a stable control loop operating without perfect knowledge of the plant.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Backpressure needs three components: a capacity signal, a backward channel, and a compliant producer. The capacity signal tells someone that the consumer is at or near its limit. The backward channel carries that signal to the producer. The compliant producer actually reduces its rate when it receives the signal. Remove any one of the three and the mechanism breaks.',
        'The signal can be explicit or structural. An HTTP 429 response with a Retry-After header is an explicit signal: the server names the overload condition and tells the client exactly how long to wait. A bounded queue that blocks on enqueue is a structural signal: the producer cannot add more work because the queue is full, and the blocking itself is the backpressure. TCP\'s congestion window is both: the receiver advertises a window size (explicit), and the sender detects dropped packets as implicit evidence of network congestion.',
        'The compliance mechanism varies by layer. TCP senders halve their congestion window on loss. Reactive Streams subscribers call request(n) to pull exactly n items. Kafka consumers poll at their own pace. A Go channel blocks the goroutine that tries to send to a full channel. In each case the producer\'s rate is mechanically limited by the consumer\'s capacity to accept work.',
        'Pull-based systems have backpressure built in because the consumer asks for work only when ready. Push-based systems need it bolted on through windows, credits, acknowledgments, or demand counters. The design heuristic is: when you can, let the slowest stage set the pace. When you must push, make the credit system real and bounded.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backpressure works because it closes a negative feedback loop. In control theory, a negative feedback loop with gain less than 1 is stable: disturbances decay rather than grow. The producer probes capacity by increasing rate slowly (additive increase). When the consumer signals strain, the producer cuts rate sharply (multiplicative decrease). The result is a sawtooth that oscillates around the true capacity without ever needing to know that capacity in advance.',
        'AIMD (Additive Increase, Multiplicative Decrease) is the canonical algorithm. TCP uses it: increase the congestion window by 1 segment per round-trip time, halve it on a congestion signal. The animation on this page uses the same shape: 10 clients each add 1 req/s per second and multiply by 0.6 on overload. The sawtooth is mathematically guaranteed to converge to fair shares of capacity when all participants follow the same rule (Chiu and Jain, 1989).',
        'The fairness property matters. If two clients both use AIMD against the same server, they converge to equal shares of capacity regardless of their starting rates. The proof is geometric: additive increase moves the rate vector parallel to the equal-share line, and multiplicative decrease moves it toward the origin. The intersection of those two motions converges on the equal-share point. No central coordinator is required.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The mechanism itself is cheap. A bounded queue costs one integer comparison on enqueue. An HTTP 429 response costs one status code and one header. A reactive-stream demand counter costs one atomic integer per subscription. TCP\'s congestion window is a single variable per connection. The implementation overhead is negligible compared to the work being flow-controlled.',
        'The real cost is reduced peak throughput. A system with backpressure will not accept 500 req/s when its consumer can sustain 200 req/s. It will accept roughly 200, plus or minus the sawtooth oscillation. This is a feature, not a bug: the alternative is accepting 500, queueing the excess, watching latency climb, and eventually dropping everything when memory runs out. Backpressure trades uncontrolled throughput spikes for stable useful throughput and bounded tail latency.',
        'Latency shifts from unbounded to bounded. Without backpressure, queue depth grows linearly with time when the producer exceeds capacity, so latency also grows linearly -- after 10 minutes at 50 req/s excess, p99 latency may exceed 5 minutes. With backpressure and a bounded queue of size B, latency is at most B / service_rate. A queue of size 100 at 100 req/s caps wait time at 1 second.',
        'Complexity cost is in coordination. Every intermediate layer between producer and consumer must propagate the signal faithfully. If a message broker, API gateway, or load balancer absorbs pressure into its own unbounded buffer, the signal never reaches the producer. Each absorbing layer adds delay to the feedback loop, and delayed feedback causes larger oscillations -- the system overshoots further before it gets the correction signal.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'TCP congestion control is the foundational example. Every TCP connection uses a congestion window that the sender increases cautiously and cuts on loss or ECN (Explicit Congestion Notification) marks. The entire internet relies on this cooperative backpressure to share bandwidth without a central scheduler.',
        'HTTP APIs use 429 (Too Many Requests) with Retry-After headers. A well-behaved client reads the Retry-After value, waits that many seconds, and retries. Rate limiters at API gateways (Nginx, Envoy, AWS API Gateway) generate these signals. gRPC uses flow-control windows inherited from HTTP/2: each stream has a window, and the receiver must grant more window before the sender can continue.',
        'Streaming frameworks formalize backpressure as a protocol. Java\'s Reactive Streams (java.util.concurrent.Flow) and its implementations (Project Reactor, RxJava 2+, Akka Streams) use request(n) demand signals. Node.js streams use highWaterMark and the drain event. Kafka consumers pull at their own pace, and consumer-lag metrics let operators detect when consumers fall behind.',
        'At the infrastructure level, bounded queues (Go channels, Java ArrayBlockingQueue, Python queue.Queue with maxsize) act as structural backpressure: a full queue blocks or rejects the producer. Database connection pools do the same -- a pool of size 20 means the 21st request waits, propagating pressure back to the caller.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Backpressure fails when the signal does not reach the source. The most common failure is the absorbing buffer: an unbounded queue between producer and consumer that swallows the pressure signal. The producer sees fast enqueue and keeps sending. The consumer drowns silently. When the buffer eventually fills memory, the failure is sudden, total, and far removed from the root cause.',
        'It fails when the producer ignores the signal. An HTTP 429 that a client immediately retries without honoring Retry-After is wasted bytes. A TCP sender that ignores window updates breaks the congestion control contract. Compliance must be enforced, not assumed -- through admission control, quotas, or hard rejection at the boundary.',
        'Fairness breaks when participants do not follow the same rules. AIMD converges to equal shares only if all clients use the same additive-increase and multiplicative-decrease parameters. An aggressive client that increases faster or decreases less takes a disproportionate share. The server must enforce per-client rate limits or admission quotas to compensate.',
        'Multi-hop pipelines amplify delay. If pressure must traverse five services before reaching the true source, the feedback delay is the sum of all intermediate round-trip times. Long delays cause large oscillations: the system overshoots capacity further before the correction arrives. The fix is short feedback loops -- each stage should propagate pressure immediately to its upstream neighbor rather than waiting for the end-to-end signal.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: a producer sends at 150 req/s, a consumer processes at 100 req/s, and a bounded queue of size 200 sits between them. The producer uses AIMD: +1 req/s each second when the queue is below 80% full, multiply rate by 0.5 when the queue exceeds 80%.',
        'Second 0: producer sends at 150, consumer drains 100, net inflow 50. Queue depth: 50. Queue is at 25% capacity. AIMD says increase: next rate = 151.',
        'Second 1: producer sends 151, consumer drains 100, net inflow 51. Queue depth: 50 + 51 = 101. Queue at 50.5%. Still below 80%. Next rate = 152.',
        'Second 2: rate 152, drain 100, net 52. Queue: 101 + 52 = 153. At 76.5%. Still below threshold. Next rate = 153.',
        'Second 3: rate 153, drain 100, net 53. Queue: 153 + 53 = 206 -- but the queue caps at 200, so 6 items are rejected (the producer gets a FULL signal). Queue at 100%. AIMD triggers: next rate = 153 * 0.5 = 76.5, round to 77.',
        'Second 4: rate 77, drain 100. Net inflow = -23. Queue: 200 - 23 = 177. At 88.5% -- still above 80%, so AIMD triggers again: next rate = 77 * 0.5 = 38.5, round to 39.',
        'Second 5: rate 39, drain 100. Net inflow = -61. Queue: 177 - 61 = 116. At 58%. Below threshold. Next rate = 40. The queue is draining. Over the next 30 seconds, the rate creeps back up toward 100, the queue stabilizes near 160 (80% of 200), and the system oscillates in a stable sawtooth. Without the bounded queue and AIMD, the unbounded queue would have reached 1,500 items by second 10, with p99 latency over 15 seconds and growing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Jacobson, V. "Congestion Avoidance and Control" (1988) -- the paper that introduced AIMD-based congestion control to TCP and proved that cooperative backpressure can stabilize a shared network. Chiu, D. and Jain, R. "Analysis of the Increase and Decrease Algorithms for Congestion Avoidance in Computer Networks" (1989) -- the geometric proof that AIMD converges to fairness.',
        'RFC 6585 defines HTTP 429 (Too Many Requests). The Reactive Streams specification (reactive-streams.org) formalizes demand-based backpressure for in-process streaming. Akka Streams documentation provides worked examples of bounded-buffer backpressure in practice.',
        {type: 'image', src: './assets/gifs/backpressure.gif', alt: 'Animated walkthrough of the backpressure visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        'Study next: "Retries, Backoff & Jitter" shows what happens when clients do not listen to overload signals. "Load Shedding & Graceful Degradation" covers the server-side defense when pressure exceeds what backpressure can control. "Circuit Breakers & Deadlines" adds fast failure and cancellation for doomed requests. For the underlying math, study TCP Congestion Control and the AIMD convergence proof.',
      ],
    },
  ],
};
