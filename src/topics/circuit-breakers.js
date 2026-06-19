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
    explanation: 'The cascade starts with a dependency that hangs instead of failing. Every B thread waiting on C holds memory, a socket, and a place in the pool for 30 seconds. Soon B has no workers left for any request, including requests that do not really need C. A then blocks on B. The important idea is resource capture: a slow dependency can behave like a leak in every caller upstream.',
    invariant: 'Hangs propagate upstream through exhausted thread pools: a slow dependency is a resource leak, not just a delay.',
  };

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
    explanation: 'The breaker is a small state machine around the risky call. CLOSED means traffic flows and failures are counted. OPEN means the threshold was crossed, so calls fail immediately without touching the dependency. HALF-OPEN means the cooldown ended and one probe is allowed through. The point is not to hide failure; it is to stop spending scarce caller resources on a dependency that is unlikely to answer.',
    invariant: 'OPEN converts a 30-second hang into a microsecond failure: the breaker trades availability of one call for survival of the pool.',
  };

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
    explanation: 'With the breaker installed, the incident becomes bounded. A few threads block while the failure window fills, then the breaker trips and the pool drains. Calls that need C get a fast fallback or fast error; calls that do not need C keep moving. C also gets a recovery gift: less traffic. Overloaded systems often need silence more than they need enthusiastic retries.',
  };

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
    explanation: 'An open breaker is only useful if the caller knows what to do next. The fallback ladder is practical: serve marked stale data, return a neutral default, degrade the feature, or give an honest fast error. The best time to decide that behavior is when adding the dependency call. During an outage, "what should this page do without recommendations?" is too late a question.',
  };
}

function* deadlines() {
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
    explanation: 'Deadlines protect against work that can no longer help the caller. The timeline spends most of the user budget before C even starts. If C needs 400ms and only 80ms remain, doing the work is waste: CPU, database time, and queue capacity spent on an answer the user will never receive. During overload, doomed work can become a large share of total load.',
    invariant: 'Work on a request whose deadline has passed is pure waste — and it concentrates exactly during overload.',
  };

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
    explanation: 'Deadline propagation makes the budget visible at every hop. Each service receives the remaining time, spends some of it, and forwards the smaller remainder. A service can then refuse work it cannot finish before the deadline, before touching the database. Cancellation is the reverse signal: when the caller is gone, stop in-progress work instead of finishing a response nobody can use.',
    invariant: 'Each hop forwards deadline − own spending: any service can prove a request is doomed before working on it.',
  };

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
    explanation: 'The kit works because each guard handles a different failure mode. Breakers handle persistent dependency sickness. Deadlines stop doomed work. Hedging masks stragglers. Retry budgets prevent storms. Load shedding protects overloaded front doors. Traces that show a breaker fast-fail or a deadline refusal are not necessarily bad news; they can be evidence that the system chose a controlled failure over a cascade.',
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
        'The animation has two views. The first shows the breaker state machine: CLOSED, OPEN, and HALF-OPEN as graph nodes, with edges for each transition. Active (highlighted) marks the current state. Found marks a successful recovery path. Removed marks a sick dependency or a tripped transition.',
        'The second view shows an incident timeline as a matrix. Each row is a moment in the incident. The "event" column shows what happened; the "pool" column shows how many threads are blocked. Removed cells are the worst damage. Found cells are the recovery point. Compare cells mark peak resource capture.',
        'Watch the pool column across the timeline. The key inference: once the breaker trips (removed), the pool drains (compare drops), and the system recovers (found). If pool utilization stayed high after the trip, the breaker would not be working.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Microservices fail through waiting more often than through clean errors. When service C hangs for 30 seconds instead of returning an error, every caller thread in service B sits blocked -- holding a socket, a thread-pool slot, memory, and a database connection. If B has 200 worker threads and C hangs on enough of them, B becomes unavailable for all requests, including those that never needed C. Service A, which calls B, then blocks too. One sick dependency cascades into a system-wide outage.',
        'Michael Nygard named this pattern in "Release It!" (2007): a circuit breaker is a small state machine that sits between a caller and a dependency. When the dependency looks sick based on recent evidence, the breaker stops sending traffic and fails fast instead. The goal is not to fix the dependency. The goal is to stop one failing path from consuming every resource the caller has.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first defense most teams add is a timeout. If the dependency does not respond in 30 seconds, the caller gives up. This is better than waiting forever, but a 30-second timeout still captures a thread for 30 seconds.',
        'The next step is retries. If the failure was a transient blip -- a dropped packet, a single slow replica -- a second attempt often works. Retries handle independent, rare failures well.',
        'Together, timeouts and retries feel like enough: each request protects itself. Teams ship this and move on.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Timeouts and retries treat every request as independent. The wall appears when the failure is collective. If the dependency is overloaded rather than briefly glitching, every caller thread still blocks for the full timeout, and every retry adds more traffic to an already struggling system. Ten callers, three retries each, produce thirty requests where there were ten. The retries become a retry storm that amplifies the original problem.',
        'Resource capture is the core mechanism. A thread pool has a fixed size. A dependency hanging for 30 seconds captures workers 30x longer than a healthy 1-second call. At 100 requests per second with 200 threads, the pool fills in about 6 seconds of total hang. Once full, B rejects every request -- not just the ones going to C. The dependency\'s slowness becomes the caller\'s outage, and the caller\'s outage becomes everyone upstream\'s outage.',
        'Per-request timeouts end individual waits. They do not reduce the rate of incoming traffic fast enough to let the dependency recover.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Stop treating each request independently. Instead, track recent outcomes in a rolling window and make a collective decision: if enough recent calls failed, stop sending any traffic to that dependency.',
        'The breaker is a three-state machine. CLOSED means calls flow normally and the breaker counts outcomes. When failures cross a threshold, the breaker trips to OPEN. OPEN means every call to that dependency fails immediately -- no socket opened, no thread blocked, response in microseconds instead of 30 seconds. After a cooldown period, the breaker moves to HALF-OPEN and allows a small number of probe requests through. If the probe succeeds, the breaker closes and traffic resumes. If the probe fails, the breaker opens again.',
        'The key invariant is resource preservation. An OPEN breaker converts a 30-second hang into a sub-millisecond failure, so the caller\'s thread pool stays available for other work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The breaker wraps a single dependency operation. Each call passes through the wrapper, which checks the current state before deciding whether to forward or reject.',
        'In CLOSED state, the wrapper sends the call, records the outcome (success, failure, timeout, slow response), and updates a rolling failure window. The trip rule evaluates the window: for example, "at least 10 requests in the last 10 seconds, and more than 50% failed." Requiring a minimum volume prevents a single failed request from tripping the breaker on low-traffic paths.',
        'In OPEN state, the wrapper returns immediately without contacting the dependency. The caller gets a fallback value, a cached response, a degraded feature, or a fast error -- whatever the team configured for that operation. A cooldown timer starts when the breaker opens, typically 15-60 seconds.',
        'When the cooldown expires, the breaker enters HALF-OPEN and allows a small number of probe requests through (often just one). The probe hits the real dependency. If it succeeds, the breaker closes and resets its failure counters. If it fails, the breaker reopens and the cooldown restarts. Good implementations keep probe concurrency low to avoid flooding a recovering dependency.',
        'Nygard\'s original formulation in "Release It!" used a simple failure count threshold. Modern libraries like Resilience4j use sliding windows (count-based or time-based) with configurable failure-rate thresholds, slow-call-rate thresholds, and minimum call volumes before evaluation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The argument is about resource flow. While the breaker is CLOSED, each hanging call captures a worker for the full timeout duration. If calls arrive faster than they complete, the worker pool fills monotonically until exhaustion. Opening the breaker changes the per-call hold time from 30 seconds to near zero. New calls on the broken path release immediately, so the pool drains and capacity returns for healthy paths.',
        'The breaker also helps the dependency recover. An overloaded service needs reduced traffic to clear its queue. Retry storms do the opposite -- they pile more work on. An open breaker gives the dependency silence: no incoming calls during the cooldown period. That silence is often the most effective medicine.',
        'The HALF-OPEN probe provides a safe recovery signal. Rather than reopening the floodgates based on a timer alone, the breaker tests one real request. If the dependency can handle a probe, it is plausibly ready for traffic. If it cannot, the breaker stays open. This avoids the failure mode where traffic resumes too early and immediately overwhelms the dependency again.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Runtime overhead is minimal: a state check, a counter update, a clock read. The real cost is tuning. A threshold too sensitive trips the breaker on transient blips, creating artificial outages. A threshold too conservative lets the pool fill before the breaker reacts. A cooldown too short hammers a recovering dependency with repeated probe-then-flood cycles. A cooldown too long extends degraded service after the dependency has already recovered.',
        'Fallback design is a product decision that must happen before the incident. During an outage is too late to decide what a checkout page should do without the pricing service. Each protected operation needs a documented fallback: stale cache, sensible default, degraded feature, or honest fast error. Some fallbacks are unsafe -- stale exchange rates, cached permission checks, or default fraud scores can be worse than refusing the request.',
        'Monitoring adds complexity. Operators need dashboards that distinguish between "dependency is down," "breaker is open," "fallback is being served," and "user sees an error." Without this, a breaker doing its job (fast-failing to protect the system) looks identical to a new outage in coarse metrics.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Netflix built Hystrix in 2012 specifically to circuit-break calls between its hundreds of microservices. At Netflix\'s scale, a single downstream failure could cascade through dozens of services; Hystrix breakers contained blast radius to one dependency path. Hystrix is now in maintenance mode, but the pattern it popularized is standard practice.',
        'Resilience4j is the current standard in the Java ecosystem, offering count-based and time-based sliding windows, configurable slow-call thresholds, and integration with Micrometer metrics. Polly provides the same pattern for .NET with fluent policy configuration. Envoy proxy implements circuit breaking at the infrastructure layer through outlier detection -- it ejects unhealthy upstream hosts based on consecutive errors or success-rate thresholds, so application code does not need its own breaker for HTTP calls routed through the mesh.',
        'The pattern fits anywhere a caller has a bounded resource pool (threads, connections, file descriptors) and a dependency that can hang. Database connection pools, payment provider calls, third-party API integrations, search cluster queries, and cross-region RPC calls are all common deployment points.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Slow degradation trips breakers poorly. If a dependency gradually slows from 100ms to 2 seconds but never times out or errors, a failure-rate breaker will not trip. Slow-call-rate thresholds help, but they require tuning a latency threshold that distinguishes "slow but acceptable" from "slow and sickening the caller." The line is often unclear until the incident.',
        'Shared state in distributed deployments creates coordination problems. If each instance of service B runs its own breaker, they trip at different times based on local traffic. Instance B1 might trip while B2 is still sending traffic to C, preventing C from recovering. Conversely, centralizing breaker state introduces a single point of failure and network latency on every call. Most teams accept per-instance breakers and rely on the fact that all instances will converge quickly when the dependency is truly down.',
        'False trips are costly. An open breaker means every request on that path gets degraded service or an error. If the breaker tripped because of a brief network partition that already resolved, users suffer unnecessarily until the cooldown expires and a probe succeeds. Minimum-volume requirements and sliding windows reduce false trips but cannot eliminate them.',
        'Breakers can also mask the need for deeper fixes. If a dependency is chronically slow and the breaker trips daily, the team may accept the degraded state instead of fixing the root cause -- undersized connection pools, missing indexes, or inadequate capacity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Service B calls service C for recommendations. The breaker is configured with a 10-second sliding window, a 50% failure-rate threshold, a minimum of 5 requests, and a 30-second cooldown.',
        'At t=0, C\'s database pool exhausts and C starts hanging. Requests 1 through 5 each time out after 2 seconds. By t=10, the breaker has seen 5 requests in its window, all failed: 100% failure rate exceeds the 50% threshold. The breaker trips to OPEN.',
        'At t=10.001, request 6 arrives. The breaker is OPEN. B returns a stale cached recommendation set in 0.3ms. No thread blocks. No socket opens to C. Requests 7 through 200 over the next 30 seconds all get the same fast fallback. B\'s thread pool stays at 3/200 occupied (normal background work). C receives zero traffic, giving its database pool time to drain and recover.',
        'At t=40, the 30-second cooldown expires. The breaker moves to HALF-OPEN. Request 201 is the probe: B sends it to C. C\'s database pool has recovered. The request returns in 80ms with fresh recommendations. The breaker closes, resets its failure counters, and all subsequent requests flow to C normally.',
        'If the probe at t=40 had failed, the breaker would reopen and wait another 30 seconds before the next probe. The system stays degraded but stable rather than oscillating between full traffic and collapse.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Michael Nygard, "Release It!" (Pragmatic Bookshelf, 2007) -- introduced the circuit breaker pattern for software systems, modeled on the electrical engineering concept. Martin Fowler, "CircuitBreaker" (martinfowler.com, 2014) -- the widely-read blog post that brought the pattern to a broader engineering audience. Netflix, "Hystrix" (GitHub, 2012) -- the implementation that proved the pattern at scale in production microservices.',
        'Prerequisites: study Finite State Machine for the three-state structure. Study Tail Latency and p99 Thinking to understand why slow failures are worse than fast ones. Extensions: study Retries, Backoff, and Jitter to design retry policies that respect breaker state instead of fighting it. Study Bulkheads and Resource Isolation for limiting blast radius before the breaker trips. Study Load Shedding and Graceful Degradation for the server-side complement -- rejecting excess work at the front door. Alternatives: study Rate Limiter for controlling outbound request volume and Deadline Propagation for stopping doomed work across multi-hop request chains.',
      ],
    },
  ],
};
