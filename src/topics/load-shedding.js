// Load shedding: the discipline of saying NO on purpose. An overloaded
// server that accepts everything serves no one — the queue does the killing.
// Simulated live: the honest 503 beats the six-second spinner every time.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'load-shedding',
  title: 'Load Shedding & Graceful Degradation',
  category: 'Systems',
  summary: 'Accept everything and serve no one: the unbounded queue simulated live, and the art of rejecting with taste.',
  controls: [
    { id: 'view', label: 'Shed', type: 'select', options: ['the queue that kills', 'shedding with taste'], defaultValue: 'the queue that kills' },
  ],
  run,
};

// Live overload arithmetic: capacity 100/s, demand 120/s, client timeout 2s.
const CAP = 100;
const DEMAND = 120;
const TIMEOUT = 2;
const T = 30;
const QUEUE_CAP = 50;

function simulateNoShed() {
  const rows = [];
  let q = 0;
  for (let t = 0; t < T; t++) {
    q += DEMAND - CAP;
    const wait = q / CAP;
    rows.push({ t, q, wait, goodput: wait <= TIMEOUT ? CAP : 0 });
  }
  return rows;
}
function simulateShed() {
  const rows = [];
  let q = 0;
  for (let t = 0; t < T; t++) {
    q = Math.min(QUEUE_CAP, q + DEMAND - CAP);
    const wait = q / CAP;
    rows.push({ t, q, wait, goodput: CAP, shed: DEMAND - CAP });
  }
  return rows;
}
const NOSHED = simulateNoShed();
const SHED = simulateShed();

function* queueKills() {
  yield {
    state: plotState({
      axes: { x: { label: 'seconds of overload (demand 120/s, capacity 100/s)' }, y: { label: 'queued requests' } },
      series: [{ id: 'queue', label: 'queue depth (accept everything)', points: NOSHED.map((r) => ({ x: r.t, y: r.q })) }],
      markers: [{ id: 'doom', x: 10, y: NOSHED[10].q, label: 'wait crosses the 2s timeout' }],
    }),
    highlight: { removed: ['doom'], active: ['queue'] },
    explanation: `The setup is mild overload: ${DEMAND} requests per second arrive, ${CAP} can be served. If the server accepts everything, the excess becomes a queue that grows by ${DEMAND - CAP} every second. Queue depth turns directly into wait time, so after a short while accepted requests are already older than the ${TIMEOUT}s client timeout. The server is busy, but much of that work can no longer produce useful answers.`,
    invariant: `Demand (${DEMAND}/s) > capacity (${CAP}/s) with an unbounded queue: depth grows linearly at +${DEMAND - CAP}/s, wait grows with it, and every request eventually outlives its caller.`,
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seconds of overload' }, y: { label: 'GOODPUT: answers delivered in time (/s)' } },
      series: [
        { id: 'bad', label: 'accept everything', points: NOSHED.map((r) => ({ x: r.t, y: r.goodput })) },
        { id: 'good', label: 'shed past queue depth 50', points: SHED.map((r) => ({ x: r.t, y: r.goodput })) },
      ],
    }),
    highlight: { removed: ['bad'], found: ['good'] },
    explanation: `The important metric is goodput: responses delivered before callers give up. The accept-everything policy keeps processing but eventually delivers almost nothing in time. The shedding policy caps the queue at ${QUEUE_CAP}, rejects overflow immediately, and keeps useful throughput at ${CAP}/s. Same hardware, different admission rule. Saying no preserves the meaning of yes.`,
    invariant: `Goodput = served before ${TIMEOUT}s timeout: past saturation, accepting more work strictly reduces it.`,
  };

  yield {
    state: matrixState({
      title: 'The user\'s view of the same 30 seconds',
      rows: [
        { id: 'noshed', label: 'accept everything' },
        { id: 'shed', label: 'shed the excess' },
      ],
      columns: [{ id: 'lucky', label: 'most users get…' }, { id: 'unlucky', label: 'the rest get…' }],
      values: [[1, 1], [2, 3]],
      format: (v) => ['', 'a 6-second spinner, then an error — 100% of users', 'fast success — 83% of users', 'an INSTANT "busy, retry shortly" — 17%'][v],
    }),
    highlight: { removed: ['noshed:lucky'], found: ['shed:lucky', 'shed:unlucky'] },
    explanation: `From the user side, no shedding means slow universal failure: everyone waits, then errors. With shedding (queue capped at ${QUEUE_CAP}), most users get fast success and the rest get a fast, honest 503 with Retry-After. That rejected user can retry later with jitter instead of wasting ${TIMEOUT}+ seconds on a doomed request. Load shedding is useful because it makes overload explicit and quick.`,
  };
}

function* withTaste() {
  yield {
    state: matrixState({
      title: 'Shed in priority order — not all requests are equal',
      rows: [
        { id: 'tier4', label: 'tier 4: analytics beacons' },
        { id: 'tier3', label: 'tier 3: recommendations' },
        { id: 'tier2', label: 'tier 2: search, browse' },
        { id: 'tier1', label: 'tier 1: checkout, auth' },
      ],
      columns: [{ id: 'when', label: 'shed when' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'load > 80% — nobody notices for hours', 'load > 90% — the page renders without the rail', 'load > 98% — visible but survivable', 'NEVER shed — this is why the site exists'][v],
    }),
    highlight: { removed: ['tier4:when'], found: ['tier1:when'] },
    explanation: `Shedding should be ordered by value. Dropping an analytics beacon is cheap; dropping checkout is expensive. A production shedder needs request priority, endpoint class, or criticality metadata so it can shed the least valuable work first. Under overload at ${DEMAND}/s against ${CAP}/s capacity, the system deliberately becomes smaller: it keeps the work that matters most and discards the rest quickly.`,
    invariant: `Shed by priority, lowest first: when ${DEMAND - CAP} excess requests/s must go, overload should cost the business the least valuable work it has.`,
  };

  yield {
    state: matrixState({
      title: 'Brownout: degrade the WORK, not just the queue',
      rows: [
        { id: 'full', label: 'normal: full recommendations' },
        { id: 'brown1', label: 'brownout 1: cached recs' },
        { id: 'brown2', label: 'brownout 2: popularity list' },
        { id: 'brown3', label: 'brownout 3: rail hidden' },
      ],
      columns: [{ id: 'cost', label: 'cost per request' }],
      values: [[80], [12], [3], [0]],
      format: (v) => (v === 0 ? '~0ms — feature off' : `${v}ms compute`),
    }),
    highlight: { compare: ['full:cost', 'brown2:cost'] },
    explanation: `Brownout keeps the request but reduces its cost. Instead of full recommendations, serve cached recommendations, then a popularity list, then hide the rail. Each level lowers CPU, model, database, or network work per request. This is graceful degradation used proactively: stretch ${CAP}/s capacity before the queue becomes fatal under ${DEMAND}/s demand.`,
  };

  yield {
    state: matrixState({
      title: 'Where and when to shed',
      rows: [
        { id: 'where', label: 'WHERE: the front door' },
        { id: 'trigger', label: 'TRIGGERS: leading indicators' },
        { id: 'cheap', label: 'the rejection must be CHEAP' },
      ],
      columns: [{ id: 'how', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'load balancer / gateway — before auth, parsing, DB work', 'queue depth, p99 latency, concurrent in-flight — not CPU alone', 'a 503 must cost microseconds, or shedding itself overloads'][v],
    }),
    highlight: { active: ['where:how'] },
    explanation: `Placement matters. Shed at the front door, before auth, parsing, database calls, and fan-out make the request expensive. Trigger on leading indicators like queue depth (cap at ${QUEUE_CAP}), in-flight count, and p99 latency, not CPU alone. The rejection path must be cheaper than the work it rejects. Admission control asks "can this request still become goodput within ${TIMEOUT}s?" before spending on it.`,
    invariant: `Shed early, trigger on queues not CPU, and make the no cheaper than the hello — a ${DEMAND - CAP}/s excess leaves no room for slow rejections.`,
  };

  yield {
    state: matrixState({
      title: 'The overload doctrine, complete',
      rows: [
        { id: 'shed', label: 'shed (this page)' },
        { id: 'degrade', label: 'degrade / brownout' },
        { id: 'scale', label: 'autoscale' },
      ],
      columns: [{ id: 'speed', label: 'reacts in' }, { id: 'role', label: 'role' }],
      values: [[1, 2], [3, 4], [5, 6]],
      format: (v) => ['', 'microseconds', 'survive the spike RIGHT NOW', 'milliseconds', 'stretch capacity without dropping users', 'minutes', 'fix the capacity for real — too slow for the spike itself'][v],
    }),
    highlight: { found: ['shed:speed'], compare: ['scale:speed'] },
    explanation: `The doctrine is ordered by reaction time. Shedding reacts in microseconds and protects current ${CAP}/s capacity from ${DEMAND}/s demand. Brownout reacts in milliseconds and makes each request cheaper. Autoscaling reacts in minutes and fixes capacity after the spike has already arrived. Over the ${T}-second simulation, a reliable system uses all three: survive now, degrade gracefully, and add capacity when it is ready.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the queue that kills') yield* queueKills();
  else if (view === 'shedding with taste') yield* withTaste();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Follow the visualization step by step. Each frame shows one operation with the current state highlighted. Use the slider or play button to control playback.',
        {type: 'image', src: './assets/gifs/load-shedding.gif', alt: 'Animated walkthrough of the load shedding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Load shedding exists because an overloaded system that accepts every request can serve nobody well. When demand exceeds capacity, the excess becomes queued work. If the queue grows past client deadlines, the server keeps spending CPU, memory, database connections, or GPU time on requests whose callers have already given up.',
        {type: 'callout', text: 'Load shedding protects goodput by rejecting doomed work before it consumes the capacity needed by useful work.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation showing packets moving across a network', caption: 'Overload begins as an arrival-rate problem: more packets and requests enter than the service can finish before deadlines. Source: Wikimedia Commons, Oddbodz, public domain.'},
        'The useful metric is goodput: responses delivered before the caller gives up. A system can report high throughput while producing low goodput if most answers arrive too late. Load shedding protects goodput by rejecting some work quickly so accepted work still finishes inside its deadline.',
        'This is an uncomfortable but central reliability idea. A fast 503 with Retry-After can be better than a slow timeout. Saying no on purpose preserves the meaning of yes.',
        'That makes shedding a product decision as much as an infrastructure decision. The system has to know which work is expendable, which work is sacred, and which users should see degradation rather than silence.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to accept everything and let the queue absorb the spike. That feels polite because no request is rejected at the door. Under sustained overload it is usually the least polite behavior: everyone waits, then many or all users time out.',
        'Another obvious approach is to rely on autoscaling. Autoscaling is useful, but it reacts on the order of seconds to minutes. The first overload wave has already hit by then. Load shedding reacts in microseconds or milliseconds at the admission point.',
        'A third weak approach is to shed randomly. That may protect capacity, but it ignores business value and user impact. A good shedder rejects lower-priority, lower-value, or more expensive work first while preserving the requests the system exists to serve.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is deadline-aware admission. Before accepting work, ask whether this request can still become useful output given current queues, in-flight work, and downstream pressure. If the answer is no, reject early and cheaply.',
        'This changes the objective from "process every request" to "maximize useful completed requests under overload." That is why the animation compares goodput, not raw server busyness. A saturated server doing doomed work is not healthy.',
        'Graceful degradation adds a second lever. Instead of rejecting a request, the system may make it cheaper: cached recommendations instead of live model inference, simpler ranking, smaller response payloads, disabled noncritical widgets, or read-only mode. Load shedding says no; brownout says yes, but less expensively.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A simple shedder watches leading indicators: queue depth, in-flight requests, p99 latency, worker-pool saturation, connection-pool pressure, GPU queue length, or deadline miss probability. When the signal crosses a threshold, the admission path rejects or downgrades selected work.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state diagram with transitions between states', caption: 'Admission control changes state before expensive work begins: accepted, queued, downgraded, rejected, or retried later. Source: Wikimedia Commons, CC BY-SA 3.0.'},
        'The rejection must happen early. Shedding after authentication, parsing, database fanout, and downstream RPCs wastes the resources it was supposed to protect. The front door, gateway, load balancer, queue consumer, or model-serving admission gate is usually the right place.',
        'Production shedding should be prioritized. Drop analytics beacons before recommendations, recommendations before search, search before checkout. Return a clear status, often 503 with Retry-After or a domain-specific busy response, and make sure clients retry with jitter rather than rebuilding the storm.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The queue view proves the basic arithmetic. Capacity is 100 requests per second and demand is 120. Without shedding, the queue grows by 20 per second. Wait time grows with queue depth, so accepted requests eventually exceed the client timeout. The server is busy, but useful output collapses.',
        'The goodput view proves why rejection can improve user experience. The shedder caps the queue and rejects overflow quickly. Accepted requests stay within the latency budget. Most users get fast success; the rest get fast, honest rejection instead of a long spinner and failure.',
        'The taste view proves that shedding is a policy design, not just a threshold. Priority shedding decides which work loses first. Brownout decides how kept work becomes cheaper. The doctrine table explains reaction time: shedding survives the current spike, brownout stretches capacity, and autoscaling fixes capacity later.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because queues convert overload into latency, and latency converts accepted work into wasted work once deadlines pass. By bounding queues, the system bounds waiting time. By rejecting early, it avoids spending scarce resources on requests unlikely to complete in time.',
        'It also works because not all work has equal value. Analytics, personalization, previews, suggestions, background sync, and optional enrichment are often less important than checkout, authentication, payment, or emergency operations. Priority shedding lets overload degrade the least important behavior first.',
        'Brownout works for the same reason from the cost side. If each request becomes cheaper, the same capacity can serve more useful work. Degradation is not failure when the reduced behavior is planned and understandable.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The mechanism can be simple: counters, thresholds, priority labels, and a cheap rejection path. The hard part is policy. Teams must decide which work is safe to reject, what response clients should receive, whether clients honor Retry-After, and whether goodput improves under load tests.',
        'Thresholds are risky. Too aggressive wastes capacity and rejects users unnecessarily. Too loose lets the queue grow until goodput collapses. Static thresholds may fail under changing dependency latency, traffic mix, or client behavior. Adaptive policies are better but harder to reason about.',
        'Brownout adds product complexity because each feature needs cheaper modes that still make sense. Autoscaling adds capacity but reacts too slowly for the first spike. Shedding is the fast guardrail that keeps the system alive while brownout and autoscaling do slower work.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Gateways, load balancers, API platforms, search systems, recommendation systems, payment processors, queue consumers, and LLM serving stacks all use some form of admission control. They reject or defer low-priority requests when queues, token budgets, connection pools, GPU slots, or downstream latency indicate that accepted work would miss its deadline.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'A fleet can look healthy while queues are already growing; shedding protects the useful work those machines can still finish. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
        'It is especially important in fanout systems. One accepted request may create many downstream calls. Shedding at the edge can prevent a single overload wave from multiplying through databases, caches, model servers, and third-party APIs.',
        'The pattern is also old outside software: busy signals, call-center callbacks, emergency-room triage, and rate-limited ticket queues all preserve useful service by refusing or deferring lower-priority work during overload.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The biggest mistake is shedding too late, after the system already paid for parsing, auth, fanout, or database work. The second is shedding on CPU alone; queue depth, in-flight count, p99 latency, dependency saturation, and deadline miss risk usually move earlier.',
        'The third is treating any rejection as failure. A small fast-rejection rate can be the reason the rest of the users succeed. The fourth is creating a retry storm. If clients immediately retry every 503 without jitter or respect for Retry-After, the shedder protects one layer while the client layer rebuilds overload.',
        'Another failure is shedding the wrong class of work. If low-priority requests keep flowing while high-value operations starve, the policy has protected hardware metrics while harming the product. Load shedding must be tied to service value, not just queue math.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Retries, Backoff & Jitter is the client side of handling 503 and Retry-After. Backpressure & Flow Control is the cooperative version where clients slow down before rejection. Circuit Breakers & Deadlines explains doomed work and fallback design.',
        'Tail Latency & p99 Thinking explains why p99 and queue depth make better triggers than averages. Bulkheads & Resource Isolation gives the priority boundaries that make tiered shedding possible. LLM Serving Admission-Control Goodput Gate applies the same idea to token budgets, KV pressure, and GPU queues.',
      ],
    },
  ],
};
