// Circuit breakers: a hanging dependency is WORSE than a dead one — errors
// return instantly, hangs hold threads hostage. The breaker is a tiny state
// machine that converts hangs into fast failures and probes its way back.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'circuit-breakers',
  title: 'Circuit Breakers & Deadlines',
  category: 'Systems',
  summary: 'A three-state machine that fails fast when a dependency sickens — plus deadlines that travel with the request.',
  controls: [
    { id: 'view', label: 'Protect', type: 'select', options: ['the breaker state machine', 'deadlines that travel'], defaultValue: 'the breaker state machine' },
  ],
  run,
};

function* breaker() {
  const bThreadsTotal = 200;
  const bThreadsBlocked = 200;
  const aThreadsBlocked = 198;
  const aThreadsTotal = 200;
  const hangDuration = 30;

  yield {
    state: graphState({
      nodes: [
        { id: 'a', label: 'SERVICE A', x: 1.3, y: 3.5, note: 'threads: 198/200 blocked' },
        { id: 'b', label: 'SERVICE B', x: 5, y: 3.5, note: 'threads: 200/200 blocked' },
        { id: 'c', label: 'SERVICE C', x: 8.7, y: 3.5, note: 'sick: 30s hangs, not errors' },
      ],
      edges: [
        { id: 'ab', from: 'a', to: 'b' },
        { id: 'bc', from: 'b', to: 'c' },
      ],
    }),
    highlight: { removed: ['c', 'bc'], compare: ['b', 'ab'] },
    explanation: `The cascade starts with a dependency that hangs instead of failing. Every B thread waiting on C holds memory, a socket, and a place in the pool for ${hangDuration} seconds. B has ${bThreadsBlocked}/${bThreadsTotal} threads blocked, so no workers remain for any request, including requests that do not need C. A blocks on B with ${aThreadsBlocked}/${aThreadsTotal} threads captured. The important idea is resource capture: a slow dependency can behave like a leak in every caller upstream.`,
    invariant: 'Hangs propagate upstream through exhausted thread pools: a slow dependency is a resource leak, not just a delay.',
  };

  const stateClosed = 'CLOSED';
  const stateOpen = 'OPEN';
  const stateHalfOpen = 'HALF-OPEN';
  const stateCount = 3;
  const transitionCount = 4;

  yield {
    state: graphState({
      nodes: [
        { id: 'closed', label: 'CLOSED', x: 2, y: 5.5, note: 'calls flow; failures counted' },
        { id: 'open', label: 'OPEN', x: 8, y: 5.5, note: 'fail INSTANTLY, no calls' },
        { id: 'half', label: 'HALF-OPEN', x: 5, y: 1.2, note: 'one probe allowed' },
      ],
      edges: [
        { id: 'trip', from: 'closed', to: 'open', weight: 1 },
        { id: 'cool', from: 'open', to: 'half', weight: 2 },
        { id: 'heal', from: 'half', to: 'closed', weight: 3 },
        { id: 'relapse', from: 'half', to: 'open', weight: 4 },
      ],
    }),
    highlight: { active: ['closed'], compare: ['trip'], found: ['heal'] },
    explanation: `The breaker is a ${stateCount}-state machine with ${transitionCount} transitions around the risky call. ${stateClosed} means traffic flows and failures are counted. ${stateOpen} means the threshold was crossed, so calls fail immediately without touching the dependency. ${stateHalfOpen} means the cooldown ended and one probe is allowed through. The point is not to hide failure; it is to stop spending scarce caller resources on a dependency that is unlikely to answer.`,
    invariant: 'OPEN converts a 30-second hang into a microsecond failure: the breaker trades availability of one call for survival of the pool.',
  };

  const failThreshold = 50;
  const failWindow = 10;
  const cooldownSecs = 30;
  const peakBlocked = 38;
  const healthyBlocked = 3;
  const poolSize = 200;

  yield {
    state: matrixState({
      title: 'An incident, minute by minute, with the breaker installed',
      rows: [
        { id: 't0', label: '12:00:00' },
        { id: 't1', label: '12:00:10' },
        { id: 't2', label: '12:00:11' },
        { id: 't3', label: '12:00:41' },
        { id: 't4', label: '12:00:42' },
      ],
      columns: [{ id: 'event', label: 'event' }, { id: 'pool', label: 'B\'s thread pool' }],
      values: [[1, 2], [3, 4], [5, 6], [7, 6], [8, 2]],
      format: (v) => ['', 'C starts hanging; failures climb', '12/200 blocked', '50% failures over 10s → breaker TRIPS', '38/200 — peak damage', 'all C-calls fail fast; C gets silence to recover', '3/200 (healthy!)', 'cooldown over → HALF-OPEN probe → success', 'CLOSED — full traffic resumes'][v],
    }),
    highlight: { removed: ['t1:event'], found: ['t4:event'], compare: ['t2:pool'] },
    explanation: `With the breaker installed, the incident becomes bounded. ${failThreshold}% failures over ${failWindow}s trips the breaker, and the pool drains from ${peakBlocked}/${poolSize} blocked threads to ${healthyBlocked}/${poolSize}. After a ${cooldownSecs}s cooldown, a ${stateHalfOpen} probe tests recovery. Calls that need C get a fast fallback or fast error; calls that do not need C keep moving. C also gets a recovery gift: silence instead of enthusiastic retries.`,
  };

  const fallbackCount = 4;

  yield {
    state: matrixState({
      title: 'What to return while the breaker is OPEN',
      rows: [
        { id: 'cache', label: 'stale cache' },
        { id: 'default', label: 'sensible default' },
        { id: 'degrade', label: 'degraded feature' },
        { id: 'error', label: 'honest fast error' },
      ],
      columns: [{ id: 'ex', label: 'example' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'yesterday\'s exchange rate, marked stale (Cache Invalidation & Versioning\'s serve-stale)', 'empty recommendations row — the page still renders', 'search without personalization', '"try again shortly" in 2ms — beats a spinner in 30s'][v],
    }),
    highlight: { found: ['cache:ex', 'degrade:ex'] },
    explanation: `An open breaker is only useful if the caller knows what to do next. The ${fallbackCount} fallback strategies form a practical ladder: serve marked stale data, return a neutral default, degrade the feature, or give an honest fast error. The best time to decide that behavior is when adding the dependency call. During an outage, "what should this page do without recommendations?" is too late a question.`,
  };
}

function* deadlines() {
  const r2 = (v) => Math.round(v * 100) / 100;
  const userBudget = 1000;
  const authSpend = 50;
  const queueWait = 870;
  const cNeed = 400;
  const budgetAfterQueue = r2(userBudget - authSpend - queueWait);

  yield {
    state: matrixState({
      title: 'Doomed work: the answer nobody will receive',
      rows: [
        { id: 'user', label: 'user timeout budget' },
        { id: 'a', label: 'A: auth + routing' },
        { id: 'queue', label: 'B: queue wait (bad day)' },
        { id: 'c', label: 'C: computes the answer' },
        { id: 'arrive', label: 'answer arrives upstream' },
      ],
      columns: [{ id: 't', label: 'time spent' }, { id: 'left', label: 'budget left' }],
      values: [[1000, 1000], [50, 950], [870, 80], [400, 0], [0, 0]],
      format: (v) => (v === 0 ? 'GONE — user already saw the error' : `${v}ms`),
    }),
    highlight: { removed: ['c:left', 'arrive:t'], compare: ['queue:t'] },
    explanation: `Deadlines protect against work that can no longer help the caller. The user budget is ${userBudget}ms. Auth spends ${authSpend}ms, the queue wait consumes ${queueWait}ms, leaving only ${budgetAfterQueue}ms. C needs ${cNeed}ms but only ${budgetAfterQueue}ms remain, so doing the work is waste: CPU, database time, and queue capacity spent on an answer the user will never receive. During overload, doomed work can become a large share of total load.`,
    invariant: 'Work on a request whose deadline has passed is pure waste — and it concentrates exactly during overload.',
  };

  const initialDeadline = 1000;
  const aSpend = 50;
  const bRemaining = 930;
  const cGoodRemaining = 610;
  const cBadRemaining = 60;

  yield {
    state: matrixState({
      title: 'Deadline propagation: the budget travels with the request',
      rows: [
        { id: 'a', label: 'A receives: deadline = now + 1000ms' },
        { id: 'b', label: 'B receives: 930ms remain' },
        { id: 'cGood', label: 'C receives: 610ms remain' },
        { id: 'cBad', label: 'C receives (queue day): 60ms remain' },
      ],
      columns: [{ id: 'act', label: 'decision' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'spend 50ms, forward the REMAINDER in the request header', 'spend, forward remainder — every hop subtracts', 'needs 400ms < 610ms budget → do the work', 'needs 400ms > 60ms → REFUSE instantly, no work done'][v],
    }),
    highlight: { found: ['cGood:act'], removed: ['cBad:act'] },
    explanation: `Deadline propagation makes the budget visible at every hop. A receives ${initialDeadline}ms, spends ${aSpend}ms, and forwards ${bRemaining}ms. On a good day C gets ${cGoodRemaining}ms remaining, enough for its ${cNeed}ms of work. On a queue day C gets only ${cBadRemaining}ms, less than the ${cNeed}ms it needs, so it refuses instantly before touching the database. Cancellation is the reverse signal: when the caller is gone, stop in-progress work instead of finishing a response nobody can use.`,
    invariant: 'Each hop forwards deadline − own spending: any service can prove a request is doomed before working on it.',
  };

  const toolCount = 5;

  yield {
    state: matrixState({
      title: 'The resilience kit, assembled (one guard per failure mode)',
      rows: [
        { id: 'breakers', label: 'circuit breaker' },
        { id: 'deadline', label: 'deadline propagation' },
        { id: 'hedge', label: 'hedged requests' },
        { id: 'budget', label: 'retry budgets + jitter' },
        { id: 'shed', label: 'load shedding' },
      ],
      columns: [{ id: 'guards', label: 'guards against' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'a SICK dependency freezing your pool', 'doomed work consuming overloaded services', 'the occasional slow replica (Tail Latency & p99 Thinking)', 'retry storms amplifying outages', 'queues growing without bound past capacity'][v],
    }),
    highlight: { active: ['breakers:guards', 'deadline:guards'] },
    explanation: `The resilience kit assembles ${toolCount} guards, each for a different failure mode. Breakers handle persistent dependency sickness. Deadlines stop doomed work. Hedging masks stragglers. Retry budgets prevent storms. Load shedding protects overloaded front doors. Traces that show a breaker fast-fail or a deadline refusal are not necessarily bad news; they can be evidence that the system chose a controlled failure over a cascade.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'the breaker state machine') yield* breaker();
  else if (view === 'deadlines that travel') yield* deadlines();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Select "the breaker state machine" to see CLOSED, OPEN, and HALF-OPEN rendered as graph nodes. Each step advances the incident: a dependency sickens, failures pile up, the breaker trips, traffic stops, a probe tests recovery, and normal flow resumes. The highlighted node is the current state. Edges marked "found" show recovery transitions; edges marked "removed" show trip or relapse transitions. Watch the state node that lights up at each step -- transitions fire because of accumulated evidence across many calls, never because of a single failure.',
        {type: 'callout', text: 'A circuit breaker protects the caller by turning collective failure evidence into a fast state transition before the dependency consumes the whole resource pool.'},
        'Select "deadlines that travel" to see a timeline matrix. Each row is a clock-time moment during an outage. The "event" column describes what happened; the "pool" column shows how many of the caller\'s worker threads are blocked right now. Red ("removed") marks peak damage. Green ("found") marks recovery. Blue ("compare") marks the turning point where the breaker trips.',
        'Focus on the pool column. Before the trip, the number climbs as hanging calls pile up. At the trip instant, the number begins falling because no new calls reach the sick dependency. If you see the pool drain after the trip, the breaker is doing its job. If you do not, something is wrong -- the animation confirms the drain happens.',
        {type: 'image', src: './assets/gifs/circuit-breakers.gif', alt: 'Animated walkthrough of the circuit breakers visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A service that calls another service over a network faces two kinds of failure. The dependency can return an error, or it can hang -- accept the connection but never respond. Errors are fast: the caller gets an HTTP 500 or a connection-refused in under a millisecond, frees the thread, and moves on. Hangs are slow: the caller\'s thread sits blocked on a socket read for the full timeout duration, often 5 to 30 seconds. During that wait, the thread, its stack memory (typically 512 KB to 1 MB), its TCP socket, and its slot in the worker pool are all captured -- unavailable for any other request.',
        'A thread pool is a bounded resource. Suppose service B has 200 worker threads and dependency C starts hanging with a 5-second timeout. At 100 incoming requests per second aimed at C, each thread is held for 5 seconds, so you need 500 concurrent threads -- but you only have 200. The pool fills in about 2 seconds. After that, B cannot serve anything, including requests that never touch C. Service A, which calls B, now sees B as unresponsive, so A\'s pool fills too. One sick leaf node cascades upward through every caller in the graph. Michael Nygard identified this failure mode and named the circuit breaker pattern in "Release It!" (Pragmatic Bookshelf, 2007), borrowing the metaphor from electrical breakers that cut a circuit before current causes a fire.',
        'A circuit breaker is a three-state machine -- CLOSED, OPEN, HALF-OPEN -- that wraps a dependency call. It watches recent outcomes. When failures cross a threshold, it stops forwarding calls and returns a fast rejection or fallback instead. The breaker does not fix the dependency. It stops one broken path from draining the caller\'s entire resource pool.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first defense is a timeout. Instead of waiting indefinitely, the caller abandons the call after a fixed deadline -- say 5 seconds. This caps the worst-case hold time per thread and prevents infinite resource capture. Every networked call should have a timeout; without one, a single hung connection can hold a thread forever.',
        'The second defense is retries. If the failure was a transient glitch -- a dropped packet, a momentary garbage-collection pause on the server -- sending the request again will probably succeed. A retry with exponential backoff handles rare, independent failures well. Together, timeout plus retry feels like a complete answer: each call protects itself with a deadline and gets a second chance if the first attempt fails.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Timeouts and retries treat each request in isolation. They break down when the failure is correlated -- when the dependency is down, overloaded, or misconfigured, and every call to it will fail. In that regime, each timeout still holds a thread for the full deadline duration, and retries multiply the load. If 10 callers each retry 3 times, the dependency now sees 30 requests instead of 10. The retries become a retry storm that deepens the overload.',
        'Run the numbers. Service B has 200 threads. Healthy calls to C take 100 ms, so one thread handles roughly 10 calls/second and the pool stays mostly free. Now C hangs. With a 5-second timeout, each thread is held 50x longer (5 s instead of 0.1 s). At 100 req/s arriving, steady-state occupancy jumps to 500 concurrent threads. The pool has 200. It fills in 2 seconds, and B stops serving everything -- requests to healthy dependency D included. Add 3 retries per caller and arrival rate triples to 300 req/s, meaning the pool fills in under a second.',
        'The root cause is that per-request protections do not control the rate of new calls aimed at a sick dependency. Each request decides on its own, so the aggregate behavior is unbounded. The pool fills faster than it drains, and no per-request mechanism can change that.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Replace per-request independence with a shared verdict. Keep a rolling record of recent call outcomes to this dependency. When the failure rate in that window crosses a threshold, make a single global decision: stop all calls. This converts hundreds of individual per-request timeout-and-retry decisions into one binary gate -- traffic flows or it does not. That gate is the circuit breaker.',
        {type: 'image', src: 'https://martinfowler.com/bliki/images/circuitBreaker/state.png', alt: 'Circuit breaker closed open and half-open state diagram', caption: 'The three states make the protection rule concrete: normal calls flow, failures open the circuit, and half-open probes test recovery. Source: Martin Fowler, https://martinfowler.com/bliki/CircuitBreaker.html.'},
        'The machine has three states. CLOSED means traffic flows normally and the breaker records every outcome -- success, failure, timeout -- into a sliding window. When the failure rate in that window exceeds a threshold (say 50% over the last 10 seconds), the breaker trips to OPEN. OPEN means every call is rejected instantly -- no socket opened, no thread blocked, response returned in microseconds. A cooldown timer starts (typically 15-60 seconds). When the timer expires, the breaker enters HALF-OPEN: it permits exactly one probe call through to the real dependency. If the probe succeeds, the breaker resets to CLOSED and normal traffic resumes. If the probe fails, the breaker returns to OPEN and the cooldown restarts.',
        'The key invariant: an OPEN breaker converts a multi-second hang into a sub-millisecond rejection. Per-call resource hold time drops from seconds to nearly zero, so the caller\'s pool stays available for all other work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The breaker is a wrapper around a single dependency call. Every invocation hits the wrapper first. The wrapper checks its current state and either forwards the call to the real dependency or rejects it immediately.',
        {type: 'image', src: 'https://martinfowler.com/bliki/images/circuitBreaker/sketch.png', alt: 'Circuit breaker wrapper sitting between caller and supplier', caption: 'The wrapper is the architectural boundary: every protected call passes through policy before it can reach the dependency. Source: Martin Fowler, https://martinfowler.com/bliki/CircuitBreaker.html.'},
        'In CLOSED state, the wrapper forwards the call, waits for the result, and records the outcome into a sliding window. The window can be count-based (last N calls) or time-based (last T seconds). After each recording, the trip rule evaluates: "are there at least M requests in the window, and is the failure rate above P percent?" The minimum-volume gate M is critical -- without it, a single unlucky call on a low-traffic path would trip the breaker. What counts as a failure is configurable: connection refused, timeout, HTTP 5xx, or latency above a threshold (a "slow call" breaker).',
        'In OPEN state, the wrapper never contacts the dependency. It returns immediately with a fallback -- a cached value from the last successful call, a sensible default, a degraded feature rendering, or an explicit fast error. The choice of fallback is a product decision, not a library default. A cooldown timer starts at the moment the breaker trips.',
        'When the cooldown expires, the breaker enters HALF-OPEN and permits exactly one probe request through. If the probe returns a success, the breaker closes, resets all failure counters, and restores full traffic. If the probe fails, the breaker reopens and restarts the cooldown. Probe concurrency is kept at one (or a very small configured number) to avoid flooding a dependency that might be in early recovery.',
        'Nygard\'s 2007 version used a simple consecutive-failure counter. Modern libraries -- Resilience4j in Java, Polly in .NET, Envoy\'s outlier detection at the proxy layer -- use sliding windows with separate thresholds for failure rate and slow-call rate, configurable minimum-volume gates, and metrics integration for dashboard visibility.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is about flow rates. Model the thread pool as a queue with a fixed number of servers (threads). While the breaker is CLOSED and the dependency hangs, threads are captured at the arrival rate and released at the timeout rate. If arrivals exceed the release rate, the pool fills monotonically toward exhaustion. Opening the breaker drops the per-call hold time from seconds (the timeout) to microseconds (a local state check and return). The release rate jumps by orders of magnitude, so the pool drains immediately and capacity returns for all non-broken paths. The breaker converts total pool exhaustion into single-path degradation.',
        'An open breaker also helps the sick dependency. An overloaded service needs incoming traffic to drop so it can drain its own backlog. Retry storms do the opposite -- they pile more work on. An open breaker gives the dependency silence: zero inbound calls during the cooldown window. Silence is often the most effective recovery mechanism, because it lets the dependency\'s internal queues empty without new arrivals refilling them.',
        'HALF-OPEN makes recovery safe. A naive approach would reopen after a fixed timer, flooding the dependency with full traffic. If the dependency has not recovered, it collapses again -- creating an open/close oscillation that is worse than staying open. HALF-OPEN avoids this by testing a single probe. If the probe succeeds, the dependency is plausibly healthy and full traffic resumes. If it fails, the breaker stays open. The oscillation is eliminated because the gate only opens on positive evidence.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Runtime cost per call is negligible: one atomic state read, one counter increment, one clock read. On modern hardware this is under 100 nanoseconds. The real costs are in tuning the parameters and in designing the fallback behavior.',
        'Tuning has four failure modes, each with concrete consequences. (1) Threshold too sensitive: the breaker trips on a brief network hiccup, causing artificial degraded service when the dependency is actually fine -- effectively a self-inflicted outage. (2) Threshold too conservative: the pool fills with hanging calls before the failure rate reaches the trip point, so the breaker never fires and the cascade proceeds. (3) Cooldown too short: the breaker reopens, traffic floods back, the dependency collapses again, producing an open-close oscillation with worse p99 latency than a sustained outage. (4) Cooldown too long: the dependency recovered 20 seconds ago but users get degraded responses for the remaining cooldown. Each dependency needs its own tuning based on its traffic volume, typical latency, timeout duration, and the business cost of degraded service.',
        'Fallback design is a product decision that must be made before the incident. A recommendation service can serve stale cached results safely. A payment service cannot -- serving stale prices could charge the wrong amount, so a fast error with "try again shortly" is the correct fallback. A permissions service is trickier: a cached "allow" during an outage could be a security hole. Each protected call needs a documented fallback, and the fallback itself must be reviewed for correctness.',
        'Monitoring must expose four distinct states to operators: dependency healthy, dependency sick but breaker still closed (failure rate climbing), breaker open and serving fallback, and breaker open and user seeing an error. Without this granularity, a breaker doing its job looks identical to a new outage on an aggregate error-rate dashboard. Teams that lack this distinction often disable breakers after the first false alarm.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Netflix built Hystrix in 2012 to wrap every inter-service call in their microservice fleet. A single back-end failure in a system with hundreds of services could cascade through dozens of callers in seconds. Hystrix breakers isolated the blast radius to the one path touching the sick dependency. The library is now in maintenance mode, but the architectural pattern it proved is standard practice.',
        'Resilience4j is the dominant Java implementation today, offering count-based and time-based sliding windows, separate failure-rate and slow-call-rate thresholds, minimum-volume gates, and Micrometer metrics integration. Polly fills the same role in .NET. At the infrastructure layer, Envoy proxy implements outlier detection: it ejects unhealthy upstream hosts from the load-balancing pool based on consecutive 5xx responses or success-rate drops. Application code behind Envoy gets breaker behavior without writing any breaker logic.',
        'The pattern applies anywhere a caller holds a bounded resource pool -- threads, connections, file descriptors -- and talks to a dependency that can hang. Concrete deployment points: database connection pools where a full pool blocks all queries, payment gateway integrations where a hung payment provider freezes checkout threads, third-party API calls with unpredictable latency, search cluster queries during index rebuilds, cross-region RPCs subject to network partitions, and any internal service call in a microservice architecture.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Gradual degradation defeats failure-rate breakers. If a dependency slows from 100 ms to 3 seconds but never actually times out or returns an error, the failure rate stays at 0% and the breaker never trips -- even though the slow calls are filling the thread pool just as effectively as a full hang. Slow-call-rate thresholds address this, but they require choosing a latency cutoff that separates "slow but tolerable" from "slow enough to be dangerous." That boundary is unclear until the incident is already happening.',
        'Distributed state is unsolved. If service B runs 20 instances, each with its own local breaker, they trip at different times depending on local traffic. Instance B1 might open its breaker while B2 is still sending requests to the sick dependency, undermining recovery. Centralizing the breaker state across instances introduces a new single point of failure and adds a network round-trip to every call decision. Most teams accept per-instance breakers and rely on the fact that when the dependency is truly down, all instances converge to OPEN within one sliding-window period.',
        'False trips cause real damage. An open breaker means every request on that path gets degraded service or an error. If the breaker tripped because of a 2-second network partition that already resolved, users are unnecessarily degraded for the entire cooldown duration. Minimum-volume gates and sliding windows reduce false trips but cannot eliminate them. In low-traffic paths (say 2 requests per minute), a single timeout can represent 100% failure rate in a short window.',
        'Breakers can mask chronic under-provisioning. If a dependency is undersized and the breaker trips every afternoon during peak traffic, the team may accept daily degradation as normal instead of fixing the root cause. The breaker becomes a crutch that absorbs the pain signal before it reaches the people who allocate capacity, delaying the real fix indefinitely.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Setup: service B calls service C for product recommendations. B has a 200-thread worker pool. Healthy calls to C complete in 80 ms. The breaker uses a 10-second time-based sliding window, 50% failure-rate threshold, minimum volume of 5 requests, and 30-second cooldown. The per-call timeout to C is 5 seconds.',
        'At t=0, C\'s database connection pool exhausts and C stops responding -- connections are accepted but no bytes return. Request 1 arrives at B, B forwards it to C, and the thread blocks. At t=5, the 5-second timeout fires and request 1 is recorded as a failure. Requests 2 through 5 follow the same pattern, each capturing a thread for 5 seconds. By t=10, the sliding window contains 5 requests, all failures: 100% failure rate, well above the 50% threshold. The minimum volume of 5 is met. The breaker trips to OPEN. During these 10 seconds, 5 threads were held for 5 seconds each -- 25 thread-seconds consumed on a dead path.',
        'At t=10.001, request 6 arrives. The breaker is OPEN. B returns a stale cached recommendation list in 0.2 ms. No socket is opened, no thread blocks. Requests 7 through 300 over the next 30 seconds all get the same fast fallback. B\'s thread pool sits at 3/200 occupied -- normal background work unrelated to C. Meanwhile, C receives zero traffic from B, so its database connection pool drains and recovers.',
        'At t=40, the 30-second cooldown expires. The breaker moves to HALF-OPEN. Request 301 is the probe: B sends it to C over a real connection. C\'s database has recovered, so it returns fresh recommendations in 75 ms. The breaker records a success, closes, resets its failure counters to zero, and all subsequent requests flow to C normally. Total user-visible degradation: 30 seconds of stale recommendations. Without the breaker, those same 300 requests would each occupy a thread for 5 seconds, requiring a sustained 50 threads on a dead path and likely exhausting the pool.',
        'Now consider a failed probe. If request 301 at t=40 had timed out, the breaker would reopen and restart a 30-second cooldown. The next probe fires at t=70. The system stays in degraded-but-stable mode -- stale recommendations, pool healthy, no cascade -- until C actually recovers. This is strictly better than the alternative: full traffic, pool exhaustion, and cascade to A.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Michael Nygard, "Release It!" (Pragmatic Bookshelf, 2007) -- the book that introduced the circuit breaker pattern to software engineering, borrowing the metaphor from electrical breakers that trip before current causes a fire. Martin Fowler, "CircuitBreaker" (martinfowler.com, 2014) -- a widely-read blog post with clear state diagrams and pseudocode that brought the pattern to a broad engineering audience. Netflix, "Hystrix" (GitHub, 2012) -- the production library that proved the pattern works at scale across hundreds of microservices, now in maintenance mode but architecturally influential.',
        'Prerequisites: study Finite State Machines to understand the three-state structure formally. Study thread pools and connection pools to see the bounded resource the breaker protects -- without understanding pool exhaustion, the breaker\'s purpose is unclear. Study tail latency (p99/p999) to see why slow failures are worse than fast ones: a 30-second hang at p99 captures threads 300x longer than a 100 ms p50 call. Next topics: Retries with Exponential Backoff and Jitter for retry policies that respect breaker state instead of fighting it. Bulkheads for isolating resource pools per dependency so one sick path cannot consume the shared pool even before the breaker trips. Load Shedding for the server-side complement -- rejecting excess work at the front door rather than accepting it and slowing down. Deadline Propagation (covered in this visualization\'s second view) for passing a time budget across multi-hop call chains so downstream services can abandon doomed work before starting.',
      ],
    },
  ],
};
