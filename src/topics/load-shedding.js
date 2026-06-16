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
    explanation: 'The setup every service eventually meets: demand 120/s, capacity 100/s — a mere 20% over. The polite instinct is to accept every request and queue the excess. Watch the live arithmetic: the queue grows by exactly 20 every second, FOREVER — Hot Rows & Append-and-Aggregate\'s unbounded-queue law again, now at the front door. And queue depth IS wait time (Little\'s law: wait = queue ÷ service rate), so by t = 10 every accepted request waits longer than the client\'s 2-second timeout. The server keeps working diligently. It is now a machine for manufacturing answers nobody is still waiting for.',
    invariant: 'Demand > capacity with an unbounded queue: depth grows linearly, wait grows with it, and every request eventually outlives its caller.',
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
    explanation: 'The metric that matters is not THROUGHPUT (requests processed) — it is GOODPUT: answers delivered before the caller gave up. Plotted live for both policies: the accept-everything server\'s goodput is a cliff — 100/s until the queue pushes waits past the timeout at t = 10, then ZERO, while its CPU stays pinned at 100% doing funeral work (Circuit Breakers & Deadlines called it doomed work; here the server dooms it personally). The shedding server caps its queue at 50, rejects the overflow instantly, and its goodput holds at 100/s for the entire storm. Same hardware. The only difference is the willingness to say no.',
    invariant: 'Goodput = served before timeout: past saturation, accepting more work strictly reduces it.',
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
    explanation: 'Translate to humans: without shedding, EVERY user stares at a spinner and then an error — universal failure, delivered slowly. With shedding, 83% get normal fast service and 17% get an immediate, honest "we\'re busy — try again in a moment" (HTTP 503 with a Retry-After header, which a disciplined client from Retries, Backoff & Jitter handles gracefully and a jittered retry usually lands seconds later). The phone network solved this in the 1950s: a BUSY SIGNAL is infinitely better than silence, because it tells you the truth instantly and lets you decide what to do. Load shedding is the busy signal, rediscovered.',
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
    explanation: 'Shedding indiscriminately wastes its own genius: a dropped checkout costs real money while a dropped analytics beacon costs literally nothing. So production shedding is TIERED — requests carry a priority (criticality header, endpoint class), and the shedder drops from the bottom: beacons first at 80% load, the recommendations rail at 90% (the page composes without it — Bulkheads & Resource Isolation\'s decorative/critical split, applied at admission), search degrades near the redline, and checkout is never shed while anything else remains. The overloaded system becomes, deliberately, a smaller system that does the important things perfectly.',
    invariant: 'Shed by priority, lowest first: overload should cost the business the least valuable work it has.',
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
    explanation: 'The refined sibling: BROWNOUT — instead of dropping requests, make each one CHEAPER. The recommendations rail normally costs 80ms of model inference; under pressure, serve yesterday\'s cached rail (12ms), then a plain popularity list (3ms), then hide the rail (0ms) — four quality levels, dialed by load, invisible to most users (this is also Circuit Breakers & Deadlines\' fallback ladder, used proactively). Brownout multiplies effective capacity exactly when needed: at level 2 the same hardware serves 26× the recommendation traffic. Netflix and Google both published brownout systems; every "lite mode" you have ever seen is this pattern wearing product clothes.',
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
    explanation: 'Mechanics that decide whether shedding works: reject at the FRONT DOOR (the Load Balancer or gateway), before the request costs anything — a rejection after auth, parsing, and two DB calls has already spent most of the work it was refusing. Trigger on leading indicators — queue depth and in-flight count move seconds before CPU pegs (and p99, per Tail Latency & p99 Thinking, moves before p50 knows anything is wrong). And keep the rejection path microsecond-cheap and allocation-free, or the shedder becomes the bottleneck it was hired to prevent. Production shorthand: admission control — the system asks "can I afford this?" before saying hello.',
    invariant: 'Shed early, trigger on queues not CPU, and make the no cheaper than the hello.',
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
    explanation: 'The complete doctrine, ordered by reaction time: SHEDDING answers in microseconds and buys survival; BROWNOUT answers in milliseconds and stretches what capacity means; AUTOSCALING answers in minutes — essential, and always late for the spike that triggered it (the gap between "alarm fires" and "new instances serve" is exactly the window shedding exists to cover). The closing creed pairs with Retries, Backoff & Jitter\'s: a resilient system is not one that never says no — it is one that says no QUICKLY, HONESTLY, and TO THE RIGHT REQUESTS, so that its yes still means something.',
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
      heading: `What it is`,
      paragraphs: [
        `Load shedding is the discipline of saying NO on purpose. An overloaded server that accepts every request serves no one — it spends its capacity on doomed work: requests queued so long that callers have already given up and timed out. The honest answer is immediate rejection: "we are busy, try again in a moment" (HTTP 503 with Retry-After). This is the busy signal, rediscovered. Load shedding is not about turning away customers; it is about serving the ones who *can still receive an answer* instead of serving nobody, slowly.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The visualization shows the live arithmetic: a server with capacity 100 requests/second faces demand of 120 requests/second — a 20 percent overload, mild by real-world standards. Without shedding, the queue grows by 20 requests every second, forever. By Little's law, queue depth equals wait time (wait = queue ÷ service rate), so at second 10 the queue reaches 200 requests and waits have crossed the 2-second client timeout. The server keeps working diligently on funeral work — answers nobody is still waiting for. Goodput (answers delivered before the caller times out) drops to zero, while CPU stays pinned at 100 percent, the final insult.`,
        `With shedding, the server caps the queue at 50 requests. Any excess is rejected instantly, before consuming auth, parsing, or database time. The rejection costs microseconds, not milliseconds. Now goodput holds steady at 100 requests/second for the entire overload. From the human side: 83 percent of users get fast success, while 17 percent receive an instant, honest "we are busy — retry shortly" with Retry-After guidance. A caller from "Retries, Backoff & Jitter" handles this gracefully, jitters a retry, and usually lands seconds later on an idle server. The phone network solved this in the 1950s: a *busy signal* is infinitely better than silence, because it tells you the truth and lets you decide.`,
        `Refined shedding adds priority. Not all requests are equal: analytics beacons shed at 80 percent load (nobody notices for hours), recommendation rails shed at 90 percent (the page renders without the rail — a Bulkheads & Resource Isolation pattern), search degrades near the redline, and checkout is *never* shed while anything else remains. The overloaded system becomes deliberately a smaller system that does important work perfectly. Brownout takes it further: instead of dropping requests, make each one cheaper. A recommendations rail normally costs 80ms of inference; under pressure, serve a cached version (12ms), then a popularity list (3ms), then hide the rail (0ms) — four quality levels, invisible to most. The same hardware serves 26 times the traffic at level 2. Netflix and Google both published brownout systems; every "lite mode" you have ever seen is this pattern. Mechanics matter: reject at the *front door* (Load Balancer or gateway), before any work is spent. Trigger on queue depth and p99 latency (Tail Latency & p99 Thinking), not CPU alone — queues and latency move seconds before CPU pegs. And keep the rejection path allocation-free and microsecond-cheap, or the shedder becomes the bottleneck.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Shedding itself is simple: track queue depth or in-flight request count, compare to a threshold, reject excess requests. The rejection path is allocation-free and costs microseconds — a single counter check and a 503 response. No parsing, no auth, no work. Configuration is minimal: set queue caps per priority tier (beacons at 50, recommendations at 100, general at 500) and load thresholds per tier (80 percent, 90 percent, 98 percent). Brownout adds a quality-ladder config: inference → cached → popularity → hidden, each with a load threshold. The entire system fits in hundreds of lines of code. Testing is critical: you must simulate overload, verify that shedding triggers correctly, confirm that rejected requests include Retry-After headers, and measure goodput under sustained overload. The cost of *not* shedding is severe: zero goodput under sustained overload, wasted CPU on funeral work, user frustration, and cascading failures in downstream systems waiting for responses that never come. Shedding costs almost nothing and buys survival.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Every major web service that survives overload uses shedding. Google services shed analytics work first (spare the core search and maps queries). Netflix published its brownout system for handling streaming spikes. Twitter sheds requests when the timeline graph database is overloaded. Credit-card processors shed low-priority merchant status checks during fraud-spike storms. Call centers have used priority sheds for decades: dropped calls routed to callback queues (lowest priority) while customer-retention calls stay in the queue. Cloud platforms (AWS, GCP, Azure) use priority-based shedding at the API gateway: internal system calls shed before customer workloads, customer workloads shed before burst traffic. The pattern is universal because the arithmetic is universal: sustained demand above capacity with an unbounded queue is a mathematical guarantee of zero goodput. Shedding is the only response that works.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The biggest pitfall is shedding too late. Shedding *after* parsing, auth, and database queries is shedding after wasting the work you are trying to save. Admission control — the question "can I afford this?" — must happen at the front door, before the request costs anything. Another misconception: "we can just scale." Autoscaling answers in minutes (from alarm to new instance serving). Shedding answers in microseconds. They are complementary: shedding survives the spike while autoscaling fixes the capacity for real. Do not shed on CPU utilization alone; CPU is a lagging indicator. Queue depth and p99 latency lead by seconds. A server pinned at 100 percent CPU might still be serving in-flight requests within their timeout window; queue depth growing means you are losing the race. Do not confuse rejection rate with failure. A 17 percent rejection rate with fast rejections is a win; 100 percent success rate with 6-second timeouts is a loss. The metric is goodput, not acceptance rate. Finally, do not implement shedding without tuning: thresholds that are too aggressive (rejecting at 50 percent load) waste capacity; thresholds too loose (shedding only at 99 percent load) let the queue grow too deep. Measure, iterate, and validate that goodput improves under your overload profile.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `LLM Serving Admission-Control Goodput Gate shows the same overload doctrine with token budgets, KV pressure, and prefill/decode deadlines. It is the LLM-serving version of asking whether a request can still become goodput before saying yes.`,
        `Load shedding is part of the overload doctrine alongside brownout and autoscaling — go to "Circuit Breakers & Deadlines" to see fallback ladders and how to handle errors from rejected requests. "Retries, Backoff & Jitter" teaches the client side: how to retry intelligently after a 503 and respect Retry-After headers. "Tail Latency & p99 Thinking" explains why p99 matters more than average latency for shedding triggers. "Bulkheads & Resource Isolation" shows how to partition requests by criticality — the foundation of priority-based shedding. "Load Balancer" covers the front-door architecture where shedding happens. Finally, "Hot Rows & Append-and-Aggregate" teaches the unbounded-queue law that makes shedding inevitable under sustained overload.`,
      ],
    },
  ],
};
