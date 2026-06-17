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
      heading: `Why this exists`,
      paragraphs: [
        `Distributed systems fail through waiting as often as through explicit errors. A clean error returns quickly. A hang keeps a thread, socket, database connection, memory allocation, queue slot, and user-visible request budget occupied while the caller hopes for an answer. Enough waiting calls can exhaust a healthy service even when the original failure is in a dependency several hops away.`,
        `A circuit breaker exists to convert repeated slow failure into fast, controlled failure. It is a small state machine around a risky call. When recent evidence says the dependency is unlikely to answer, the breaker stops sending traffic for a while and returns a fallback or fast error instead. The goal is not to make the dependency healthy. The goal is to prevent one sick dependency from consuming every caller upstream.`,
        `Deadlines solve the companion problem: doomed work. If the user has already timed out, finishing the request is not service. It is waste. A propagated deadline lets every hop know how much budget remains and refuse work that cannot finish in time. Circuit breakers protect shared resources from sick dependencies; deadlines protect the system from work whose answer can no longer be used.`,
      ],
    },
    {
      heading: `The obvious approach`,
      paragraphs: [
        `The obvious approach is to set timeouts on remote calls. If a dependency does not respond within 30 seconds, the caller gives up. This is better than waiting forever, and it is usually the first safety rule a service team adds.`,
        `The next obvious approach is to retry. Maybe the dependency had a transient network blip. Maybe one replica was slow and another will answer. Retries are useful when failures are rare and independent. They are dangerous when the dependency is already overloaded, because every retry turns one user request into more backend work.`,
        `A plain timeout plus retries feels reasonable because it handles individual requests. The wall appears when the incident is collective. Hundreds of calls wait at the same time. Every caller holds resources while waiting. Retries amplify the traffic. The system needs a shared memory of recent failure, not only per-request impatience.`,
      ],
    },
    {
      heading: `The wall`,
      paragraphs: [
        `The wall is resource capture. A dependency that hangs for 30 seconds does not merely add 30 seconds of latency. It captures workers for 30 seconds. If the caller has a fixed thread pool or connection pool, enough captured workers make the caller unavailable for unrelated requests. The dependency's slowness becomes the caller's outage.`,
        `The second wall is positive feedback. Overloaded systems become slower. Slowness causes callers to wait longer, retry more, and queue more work. That extra work makes the overloaded system slower again. Local timeouts end individual waits, but they do not necessarily reduce incoming traffic quickly enough to let the dependency recover.`,
        `The third wall is stale work. A service may continue computing an answer after the upstream caller has gone away. During overload, this doomed work can become a large fraction of total load. The system looks busy, but much of the work cannot improve user outcomes.`,
      ],
    },
    {
      heading: `The core insight`,
      paragraphs: [
        `A circuit breaker makes dependency health part of the call path. Instead of treating every request as independent, the caller remembers recent outcomes in a rolling window. If failures, timeouts, or slow responses cross a threshold, the breaker opens and new calls fail immediately without touching the dependency.`,
        `The state machine is small because the policy should be understandable during an incident. CLOSED means traffic flows and outcomes are measured. OPEN means traffic is blocked for a cooldown period. HALF-OPEN means the caller allows a small number of probes to test recovery. A successful probe closes the breaker. A failed probe opens it again.`,
        `The key invariant is resource preservation. When the breaker is OPEN, the caller spends almost no scarce dependency-call resources on a path that is currently unlikely to work. That controlled degradation keeps unrelated work alive and gives the dependency a quieter recovery window.`,
      ],
    },
    {
      heading: `Mechanism`,
      paragraphs: [
        `A practical breaker wraps one dependency operation, not an entire service by default. The wrapper records successes, failures, timeout outcomes, and often latency. The failure window can be count-based, time-based, or a combination. The trip rule might require a minimum request volume plus an error rate, timeout rate, or slow-call rate above a threshold.`,
        `When CLOSED, the wrapper checks the current state, sends the call, records the result, and possibly trips the breaker. When OPEN, it does not send the call. It returns a fallback, cached value, degraded response, queued task, or explicit fast error. When the cooldown expires, the breaker enters HALF-OPEN and lets through a limited number of probes.`,
        `HALF-OPEN is where many implementations fail. If the system allows too many probes, recovery becomes a traffic flood. If it allows one unlucky probe to decide everything, recovery can flap. A good implementation keeps probe concurrency small, records probe outcomes separately, and changes state based on a deliberate success rule.`,
        `Deadlines should travel beside the breaker state. The caller should pass an absolute deadline or remaining budget downstream. Each service subtracts time already spent and refuses work it cannot complete before the deadline. Cancellation should propagate too, so in-progress database queries, RPCs, and background tasks stop when the caller no longer needs the answer.`,
      ],
    },
    {
      heading: `Why it works`,
      paragraphs: [
        `The breaker works because it changes the failure mode from unbounded waiting to bounded refusal. While CLOSED, the caller samples real outcomes. Once the evidence crosses the trip rule, OPEN stops new resource capture. Existing blocked calls still need to drain, but the pool is no longer accepting more work on the broken path. That is why the incident table in the animation shows peak damage followed by recovery.`,
        `The proof sketch is a resource argument. Suppose each hanging call occupies a worker for 30 seconds. If calls continue to enter faster than they complete, the occupied-worker count grows until the pool is exhausted. Opening the breaker changes the service time for new calls on that path from 30 seconds to near zero. That lets the pool drain and preserves capacity for other paths.`,
        `Deadlines work for the same reason. If a request has 80 ms left and a downstream call normally needs 400 ms, the service can prove the work is doomed before starting. Refusing early saves CPU, queue capacity, database slots, and downstream calls. The user still sees a failure, but the system avoids spending scarce resources on an answer nobody can receive.`,
      ],
    },
    {
      heading: `Costs and tradeoffs`,
      paragraphs: [
        `The runtime overhead is small: a state check, a few counters, a clock read, and a deadline comparison. The real cost is policy. Thresholds that are too sensitive create false outages. Thresholds that are too slow let pools fill before the breaker reacts. Cooldowns that are too short hammer a recovering dependency. Cooldowns that are too long extend degraded service after recovery.`,
        `Fallbacks are product decisions, not implementation details. A feed may serve stale recommendations. A checkout flow may need an honest fast error. A risk system may be unsafe with stale data and should fail closed. A search page might drop personalization while keeping keyword search. The breaker can protect resources without a fallback, but the user experience depends on choosing the right degraded behavior.`,
        `A breaker also reduces traffic to the dependency, which can hide partial recovery if probes are too conservative or metrics are too coarse. Operators need dashboards that distinguish dependency failure, breaker OPEN, fallback served, deadline refused, and user-visible error. Otherwise a successful containment policy can be mistaken for a new outage.`,
      ],
    },
    {
      heading: `Where it wins`,
      paragraphs: [
        `Use circuit breakers around remote calls whose slowness can exhaust caller resources: RPCs, database queries, search clusters, payment providers, identity services, personalization systems, queue producers, third-party APIs, and internal services with limited pools. The stronger the shared resource constraint, the more valuable fast refusal becomes.`,
        `Use deadlines across request chains with user-visible budgets. API gateways, RPC clients, worker queues, database drivers, and async jobs should know when the caller no longer needs the result. This matters even for background systems: a batch job can also have a deadline if late output is useless or harmful.`,
        `Breakers are especially useful when paired with bulkheads. A breaker reacts after evidence of sickness. A bulkhead limits how much damage that sickness can do before the breaker reacts. Together they keep one dependency path from consuming the entire process, pod, host, or queue.`,
      ],
    },
    {
      heading: `Failure modes`,
      paragraphs: [
        `A breaker is not a retry policy. Retries add load; breakers remove load. If an OPEN breaker triggers another layer to retry immediately against the same dependency, the protection is leaking. Retries need budgets, backoff, jitter, and respect for breaker state.`,
        `A local timeout is not a propagated deadline. Local timeouts can still leave downstream work running after the caller has gone away. The deadline must travel with the request, and cancellation must reach the actual expensive work. Canceling the wrapper while the database query continues only moves the waste out of sight.`,
        `Breaker metrics can lie when traffic is low. A 100% failure rate over one request may not be enough evidence to open. A 40% failure rate over thousands of requests may be severe. Good trip rules use minimum volume, rolling windows, and separate treatment for slow calls, hard errors, and caller cancellations.`,
        `Fallbacks can also be unsafe. Stale exchange rates, old inventory, cached permission checks, or default fraud scores may be worse than a fast error. The fallback ladder should be chosen per operation, tested, and documented before the incident.`,
      ],
    },
    {
      heading: `Concrete example`,
      paragraphs: [
        `Service B calls service C for recommendations. C starts hanging for 30 seconds because its database pool is exhausted. Without a breaker, B's workers accumulate blocked calls. Soon B cannot answer unrelated requests, and service A begins timing out while calling B. The original problem was recommendations, but the visible incident becomes a broader outage.`,
        `With a breaker, B counts C timeouts over a short window. Once the threshold is crossed, the breaker opens. Recommendation calls return an empty module or stale cache in a few milliseconds. B's pool drains. C receives less traffic, which gives its own queue and database pool a chance to recover. After the cooldown, B allows a small HALF-OPEN probe. If it succeeds, traffic resumes gradually. If it hangs, the breaker opens again.`,
        `Deadlines add another guard. If A sends B a request with 1000 ms of budget, and B spends 900 ms waiting in a queue, B should not ask C to do 400 ms of work. It should refuse or degrade immediately because the result cannot arrive before the user timeout. That refusal is not laziness; it is conservation of useful work.`,
      ],
    },
    {
      heading: `Operational guidance`,
      paragraphs: [
        `Instrument the state transitions. Each call should be traceable as normal, fallback, fast error, deadline refusal, HALF-OPEN probe, or cancellation. Store the dependency name, operation, breaker state, deadline remaining, fallback chosen, and observed latency. During review, those fields show whether the system failed open, failed closed, or contained the blast radius as designed.`,
        `Tune breakers with load tests and failure drills, not only production intuition. Simulate hard errors, slow responses, partial failures, high latency with success, and dependency recovery. Verify that probes are bounded, retry layers do not bypass the breaker, dashboards do not page on expected fast-fails alone, and fallbacks preserve product semantics.`,
        `Keep breaker scope narrow enough to be useful. One endpoint on a dependency may be sick while another is healthy. One tenant, region, shard, or operation may have a different failure pattern. A single global breaker can be too blunt; thousands of per-key breakers can be too complex. Choose the boundary that matches resource risk and operational understanding.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Study Finite State Machine for the CLOSED, OPEN, and HALF-OPEN shape. Study Tail Latency and p99 Thinking to see why slow failure hurts more than fast failure. Study Retries, Backoff, and Jitter to understand how clients can either relieve or amplify an outage.`,
        `Then study Bulkheads and Resource Isolation, Load Shedding and Graceful Degradation, Deadline Propagation, and Distributed Tracing. Those topics complete the resilience kit: isolate scarce resources, reject excess work, stop doomed work, and preserve the evidence needed to debug the incident.`,
      ],
    },
  ],
};
