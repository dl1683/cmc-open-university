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
    explanation: 'The cascade that motivates everything: service C sickens — not dead, WORSE: it hangs, answering in 30 seconds instead of 30 milliseconds. Every B thread that calls C now sits blocked for 30s holding its memory, its socket, its place in the pool. B\'s 200 threads fill in seconds; now B cannot answer anyone — including requests that never needed C. A blocks on B the same way. One slow leaf has frozen the whole tree, because a HANG holds resources hostage while an ERROR releases them instantly. This is the cascading failure behind most large outages, and Tail Latency & p99 Thinking\'s retries pour gasoline on it.',
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
    explanation: 'The cure is a three-state Finite State Machines classic wrapped around every risky call. CLOSED (normal): calls flow through, failures are counted in a sliding window. TRIP: when the failure rate crosses a threshold (say, 50% over 10 seconds), snap OPEN — and now every call FAILS IMMEDIATELY without touching C: no thread blocks, no timeout burns, the error returns in microseconds. After a cooldown, HALF-OPEN: allow exactly one probe request through. Probe succeeds → CLOSED, business as usual; probe fails → back to OPEN for another cooldown. Named after the electrical panel in your wall, and doing the same job: sacrifice the circuit to save the house.',
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
    explanation: 'The same incident, replayed with the breaker installed. Ten seconds of climbing failures cost 38 blocked threads — then the trip, and B\'s pool drains back to healthy while every C-dependent request fails fast instead of hanging. Notice the second-order gift: C, drowning in a retry storm a moment ago, suddenly receives SILENCE — the load removal that overloaded systems actually need to recover (the lesson from Hot Rows & Append-and-Aggregate\'s death spiral, inverted into a cure). Thirty-one seconds later a single probe confirms recovery and traffic resumes. Total user pain: 42 seconds of degraded answers instead of a multi-hour cascading outage.',
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
    explanation: 'An open breaker raises the product question: fail to WHAT? The fallback ladder, best to worst: serve stale data clearly marked (most reads tolerate yesterday); return a neutral default so the page composes without the feature (Netflix pioneered this — a missing recommendations row, not a missing homepage); degrade the feature visibly; and when nothing else fits, an honest instant error — which still beats the hang, because users and Tail Latency & p99 Thinking agree: fast failure is a feature. The discipline: decide the fallback when you WRITE the call, not during the outage.',
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
    explanation: 'The second protection attacks a subtler waste. A user\'s request carries an implicit 1,000ms patience budget. A spends 50ms; on a bad day B\'s queue eats 870 more; by the time C starts work, 80ms remain — and C\'s computation takes 400ms. C dutifully computes a beautiful answer and ships it upstream… where the user timed out 320ms ago. The work was DOOMED before it started: real CPU, real database load, spent on a response with no recipient — and during an overload spike, doomed work is most of the load, which is precisely when you can least afford it.',
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
    explanation: 'The fix: make the budget EXPLICIT and pass it along — each hop receives the remaining deadline in a header (gRPC bakes this in as grpc-timeout; Go\'s context carries it in-process), subtracts its own spending, and forwards the remainder. Now C can act intelligently: 610ms remaining against a 400ms job → proceed; 60ms remaining → refuse in a microsecond, before touching the database. And the companion move, CANCELLATION, propagates the other way: when the user disconnects or the deadline passes mid-flight, the signal travels DOWN the chain and in-progress work stops — queries killed, loops exited. Refuse doomed work at the door; abandon it the moment it becomes doomed.',
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
    explanation: 'The full kit on one card — five guards, five distinct failure modes, no redundancy: breakers handle sickness, deadlines handle waste, hedges handle stragglers, budgets handle storms, shedding handles overload. Production stacks bundle them (Netflix\'s Hystrix popularized the breaker; resilience4j, Envoy, and Istio ship the kit as configuration; gRPC carries deadlines natively), and Distributed Tracing is how you watch them work — a trace showing a breaker fast-fail or a deadline refusal is the system SUCCEEDING at failing. The closing creed of this whole Systems tour: in distributed systems you do not prevent failure, you choreograph it — and well-choreographed failure is indistinguishable from resilience.',
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
      heading: `What it is`,
      paragraphs: [
        `A circuit breaker is a tiny state machine that sits between your service and a dependency. Its job is brutal simplicity: when the dependency sickens—not dies, sickens, producing timeouts and failures—the breaker TRIPS, failing every request instantly instead of letting threads pile up waiting for an answer that will never arrive. A dead dependency returns an error in microseconds; a hanging dependency returns an error in thirty seconds and paralyzes your thread pool in the meantime. The breaker converts hangs into fast failures, rescuing the threads upstream before the cascade spreads. It is named after the electrical panel in your wall: when current spiked, the breaker flipped a switch to break the circuit and save the house. Same principle, applied to distributed systems where a hung dependency is the circuit that burns.`,
        `The second protection, deadline propagation, travels with every request: a budget of time that each hop consumes and forwards downstream. When the user's patience runs out, the deadline travels backward and stops in-flight work. Together—the breaker and the deadline—form the foundation of Tail Latency & p99 Thinking at scale: fast failures are features, not bugs, because they let the system recover instead of drowning in cascades.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The breaker wraps three states in a Finite State Machines loop. CLOSED (normal state): calls pass through to the dependency; failures are counted in a sliding window. When the failure rate climbs—say, 50 percent of calls fail within a 10-second window—the breaker TRIPS and snaps OPEN. While OPEN, every incoming call fails immediately without touching the downstream service: no thread blocks, no timeout burns, the error bubbles back in microseconds. After a cooldown period (often 30 seconds), the breaker transitions to HALF-OPEN: a single probe request is allowed through. If the probe succeeds, the dependency has recovered, and CLOSED resumes normal flow; if the probe fails, the breaker relapses to OPEN for another cooldown. This loop repeats until the dependency is healthy again.`,
        `In the demo's cascade scenario, service C sickens with 30-second hangs. Service B calls C; its 200 threads fill with blocked requests in seconds, exhausting its pool. Service A blocks on B the same way. One slow leaf freezes the tree—not because of cascading retries, but because hangs hold thread-pool resources hostage while the thread sits waiting. The breaker's solution: CLOSED counts failures; when 50 percent of calls to C fail in 10 seconds, TRIP to OPEN. Now B's threads stop calling C; instead, they fail fast. C, drowning in traffic a moment ago, suddenly receives silence—the load removal it needs to recover. Thirty seconds later, HALF-OPEN probes C once; the probe succeeds; CLOSED resumes traffic. Total degradation: 42 seconds of fast errors and fallbacks instead of a multi-hour cascade.`,
        `Deadline propagation works parallel: each request carries a deadline in a header (gRPC bakes in grpc-timeout; Go's context carries it in-process). Each hop subtracts its own time and forwards the remainder. A service can check: "I need 400ms to compute this answer; only 60ms remain before the deadline expires." Smart move—refuse instantly, before queuing or touching the database. Cancellation propagates backward: when the user disconnects or the deadline passes mid-flight, the signal travels down the call chain and kills in-progress queries.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `A circuit breaker is a tiny state machine—just three states and a rolling window counter. Memory: a few integers tracking success count, failure count, window start time, current state, and cooldown deadline. CPU: on each call, check the state; if CLOSED, update the window counter; if HALF-OPEN, allow one probe; otherwise fail instantly. All O(1) operations with microsecond latency. Production libraries (Hystrix, resilience4j, Envoy) implement these machines as building blocks you wire into your request path with a few lines of configuration—no rewriting your service.`,
        `Deadline propagation adds a single header per request: a Unix timestamp of when the deadline expires, computed once at the entry point and checked at each hop. Checking the deadline—comparing current time to deadline—is a single integer comparison. Cancellation requires propagating a signal down the call stack or killing a query mid-execution; most modern frameworks (gRPC, Go's context, async frameworks with timeout awareness) have this built in.`,
        `The real cost is operational: you must tune the breaker's thresholds (failure percentage, window size, cooldown, probe interval) to your dependency's characteristics. Too aggressive and you'll trip the breaker on normal jitter; too lenient and you'll cascade. The tool Distributed Tracing is how you watch the breaker and deadline in action—a trace showing a fast-fail from an OPEN breaker or a deadline refusal is the system SUCCEEDING at failing.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Circuit breakers are mandatory in any system with microservices and synchronized calls: a service talks to ten dependencies; one sickens; the breaker fails its calls fast while C recovers. Netflix popularized this pattern with Hystrix (2011), then open-sourced it; resilience4j and resilience frameworks built on it. Envoy and Istio ship circuit breakers as service-mesh primitives—you do not even need to change application code. They guard at the RPC level, protecting each service from cascading failures.`,
        `Deadlines are equally critical: every large system has them. A user's web request times out after 30 seconds; a mobile app after 5. A single slow query that consumes most of a request's budget should not spawn retries from desperate timeouts upstream—that multiplies load exactly when you need to shed it. Google built deadline propagation into their infrastructure (Stubby, their RPC framework, was deadline-aware); gRPC inherited it; Go's context became the reference design. Amazon and Netflix enforce deadlines at service boundaries; Uber's Ringpop gossip protocol carries deadlines; every serious web system has them.`,
        `The five-guard kit pairs breakers with deadlines, hedged requests, retry budgets, and load shedding (shedding rejects excess requests at the door, protecting overloaded services from the garbage in Hot Rows & Append-and-Aggregate death spirals). Together they form the resilience architecture: not preventing failure, but choreographing it. Well-choreographed failure is indistinguishable from resilience.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is mistaking a breaker for a retry mechanism. Retries make cascades worse: if C is hanging, retrying harder just fills the queue faster. The breaker stops retries by failing fast, cutting off the demand that is drowning C. Do not add retries inside an OPEN breaker; the combination is a death spiral.`,
        `The second trap is tuning the breaker on code-happy days. A failure threshold of 50 percent over 10 seconds might work when your infrastructure is healthy, but during the load spike where you most need the breaker, legitimate slow requests mix with timeouts; you'll trip the breaker and hurt the very users you intended to shield. Simulate failures in production (chaos testing) to calibrate thresholds.`,
        `Misunderstanding deadline deadline semantics: a deadline is not a "soft timeout for this operation." It is a global budget that cascades: if A burns 100ms of the user's 1000ms budget, and forwards the request to B, B sees 900ms remaining. If B queues for 800ms, C sees 100ms. If C needs 400ms and has 100ms, refusing is the right answer; proceeding is waste. Many systems implement deadlines only at leaf services and miss the compounding waste at interior hops.`,
        `Fallback decisions made during the outage instead of at code-write time. The demo lists the fallback ladder—stale cache (marked clearly), sensible defaults (empty recommendation rows), degraded features, honest errors. Decide WHEN YOU WRITE THE CALL. "What should we return if the user-preferences service fails?" Answer it before it fails, not during the incident.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `The breaker is a Finite State Machines classic: three states, explicit transitions, context-dependent behavior—go there to see the pattern in depth. Tail Latency & p99 Thinking explains why hangs are worse than fast failures and why retrying slow requests burns down systems. Hot Rows & Append-and-Aggregate shows a death spiral in action (a single hot row drowning a database, hammered by retries) and how load removal (the breaker's gift to the dependency) breaks the cycle. Distributed Tracing is how you see the breaker and deadline in the wild—a trace showing the transition from CLOSED to OPEN, or a deadline refusal mid-call, reveals the system protecting itself. Cache Invalidation & Versioning covers serve-stale fallbacks for when the breaker is OPEN. Finally, Saga Pattern extends these ideas to multi-step operations: choreographing failure across a transaction. The resilience kit—breakers, deadlines, hedges, budgets, shedding—is where systems become reliable.`,
      ],
    },
  ],
};

