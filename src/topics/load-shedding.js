// Load shedding: the discipline of saying NO on purpose. An overloaded
// server that accepts everything serves no one â€” the queue does the killing.
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
      columns: [{ id: 'lucky', label: 'most users getâ€¦' }, { id: 'unlucky', label: 'the rest getâ€¦' }],
      values: [[1, 1], [2, 3]],
      format: (v) => ['', 'a 6-second spinner, then an error â€” 100% of users', 'fast success â€” 83% of users', 'an INSTANT "busy, retry shortly" â€” 17%'][v],
    }),
    highlight: { removed: ['noshed:lucky'], found: ['shed:lucky', 'shed:unlucky'] },
    explanation: `From the user side, no shedding means slow universal failure: everyone waits, then errors. With shedding (queue capped at ${QUEUE_CAP}), most users get fast success and the rest get a fast, honest 503 with Retry-After. That rejected user can retry later with jitter instead of wasting ${TIMEOUT}+ seconds on a doomed request. Load shedding is useful because it makes overload explicit and quick.`,
  };
}

function* withTaste() {
  yield {
    state: matrixState({
      title: 'Shed in priority order â€” not all requests are equal',
      rows: [
        { id: 'tier4', label: 'tier 4: analytics beacons' },
        { id: 'tier3', label: 'tier 3: recommendations' },
        { id: 'tier2', label: 'tier 2: search, browse' },
        { id: 'tier1', label: 'tier 1: checkout, auth' },
      ],
      columns: [{ id: 'when', label: 'shed when' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'load > 80% â€” nobody notices for hours', 'load > 90% â€” the page renders without the rail', 'load > 98% â€” visible but survivable', 'NEVER shed â€” this is why the site exists'][v],
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
      format: (v) => (v === 0 ? '~0ms â€” feature off' : `${v}ms compute`),
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
      format: (v) => ['', 'load balancer / gateway â€” before auth, parsing, DB work', 'queue depth, p99 latency, concurrent in-flight â€” not CPU alone', 'a 503 must cost microseconds, or shedding itself overloads'][v],
    }),
    highlight: { active: ['where:how'] },
    explanation: `Placement matters. Shed at the front door, before auth, parsing, database calls, and fan-out make the request expensive. Trigger on leading indicators like queue depth (cap at ${QUEUE_CAP}), in-flight count, and p99 latency, not CPU alone. The rejection path must be cheaper than the work it rejects. Admission control asks "can this request still become goodput within ${TIMEOUT}s?" before spending on it.`,
    invariant: `Shed early, trigger on queues not CPU, and make the no cheaper than the hello â€” a ${DEMAND - CAP}/s excess leaves no room for slow rejections.`,
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
      format: (v) => ['', 'microseconds', 'survive the spike RIGHT NOW', 'milliseconds', 'stretch capacity without dropping users', 'minutes', 'fix the capacity for real â€” too slow for the spike itself'][v],
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
        'Read queue depth as unfinished accepted work. Goodput means responses delivered before the client timeout, not raw work performed by the server. The key inference is that accepting a request after the queue is too deep can turn capacity into wasted effort.',
        {type: 'image', src: './assets/gifs/load-shedding.gif', alt: 'Animated walkthrough of the load shedding visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
        {type: 'callout', text: 'Load shedding protects goodput by rejecting doomed work before it consumes the capacity needed by useful work.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Load shedding exists because overloaded systems can become busy serving nobody. When demand exceeds capacity, excess work queues up. Once waiting time exceeds client deadlines, accepted requests still consume resources but can no longer produce useful responses.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation showing packets moving across a network', caption: 'Overload begins as an arrival-rate problem: more packets and requests enter than the service can finish before deadlines. Source: Wikimedia Commons, Oddbodz, public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to accept everything and let a queue absorb the spike. That feels fair because every request gets admitted. Under sustained overload, it is often unfair because users wait, time out, and retry.',
        'Another obvious approach is to rely on autoscaling. Autoscaling is useful, but new capacity arrives after measurement, provisioning, warmup, and routing. Shedding is the fast admission decision that protects current capacity while slower mechanisms catch up.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is queueing delay. If 120 requests per second arrive and the service can finish 100 per second, the queue grows by 20 per second. At 200 queued requests, a 100-per-second server already implies about 2 seconds of waiting before service begins.',
        'If clients time out at 2 seconds, many accepted requests are already doomed. The server is doing work, dashboards may show throughput, and users still see failure. Load shedding changes the goal from accepting all work to preserving useful completed work.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Admission should ask whether a request can still become goodput. Goodput is completed work delivered before the caller gives up. If current queue depth, in-flight work, or downstream pressure makes success unlikely, the cheaper and more honest action is to reject early.',
        'Graceful degradation adds a second option. The system can keep a request but make it cheaper by serving cached data, disabling optional features, reducing response detail, or switching to read-only mode. Shedding says no; brownout says yes with less work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A shedder watches leading indicators such as queue depth, in-flight count, p99 latency, worker saturation, connection-pool pressure, GPU queue length, or deadline miss probability. When the signal crosses a threshold, it rejects, defers, or downgrades selected work. The rejection path must run before expensive parsing, fanout, database work, or model inference.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Process_states.svg', alt: 'Process state diagram with transitions between states', caption: 'Admission control changes state before expensive work begins: accepted, queued, downgraded, rejected, or retried later. Source: Wikimedia Commons, CC BY-SA 3.0.'},
        'Priority matters. Analytics beacons, recommendations, search, checkout, and authentication do not have the same business value or user impact. A useful policy sheds the least valuable work first and returns a clear response such as 503 with Retry-After.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'It works because bounding queue depth bounds waiting time. If the queue cap is 50 and capacity is 100 per second, queue wait is bounded near 0.5 seconds before service time. Accepted requests remain more likely to finish before a 2-second client timeout.',
        'Correctness is a service-level property, not a per-request promise. The system deliberately rejects some requests so accepted requests can complete within their deadlines. Priority shedding is correct when the rejected class has lower value or lower urgency than the protected class.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The mechanism is cheap: counters, thresholds, priority labels, and fast rejection paths. The policy is hard because thresholds can be too aggressive or too loose. Too aggressive wastes capacity; too loose lets queues grow until goodput collapses.',
        'Behavior changes when demand doubles. If capacity stays at 100 per second and demand rises from 120 to 240, excess rises from 20 to 140 per second. A fixed queue cap fills much faster, so the rejection rate must rise or the latency guarantee breaks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Gateways, load balancers, API services, search systems, queue consumers, payment systems, and LLM serving stacks use admission control. The common condition is a finite downstream resource: worker threads, database connections, token budget, GPU memory, or third-party quota. Shedding protects the work those resources can still finish.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt: 'Rows of servers in a datacenter', caption: 'A fleet can look healthy while queues are already growing; shedding protects the useful work those machines can still finish. Source: Wikimedia Commons, Victorgrigas, CC BY-SA 3.0.'},
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Shedding fails when it happens too late. If the system rejects only after authentication, parsing, fanout, and database calls, it already spent the resources it meant to preserve. It also fails when clients ignore Retry-After and retry immediately, rebuilding the overload wave.',
        'It fails as product design when the wrong work is rejected. Protecting low-value background calls while checkout or authentication starves is bad policy even if CPU graphs look better. Good shedding must know service value, not only machine load.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Capacity is 100 requests per second, demand is 120, and clients time out after 2 seconds. Without shedding, the queue grows by 20 per second. After 10 seconds, about 200 requests are queued, which implies 2 seconds of waiting before service begins.',
        'With a queue cap of 50, the system rejects the 20 excess requests per second once the cap is reached. Accepted requests wait about 0.5 seconds plus service time, so most can still finish before timeout. The rejected 17% receive fast failure while the accepted 83% keep producing useful responses.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study queueing theory for the relationship between utilization and waiting time, then read reliability material on overload control, backpressure, and graceful degradation. Production docs for Envoy, Kubernetes, and cloud gateways show the same ideas as request limits, circuit breaking, and outlier handling.',
        'Study retries and jitter for client behavior, backpressure for cooperative slowing, circuit breakers for failed dependencies, bulkheads for priority isolation, and tail latency for trigger design. The next exercise is to compute queue growth and timeout risk from arrival rate, service rate, and deadline.',
      ],
    },
  ],
};
