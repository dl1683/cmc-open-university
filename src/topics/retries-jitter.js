// Retries: the helpful reflex that burns systems down. This module runs a
// real outage simulation three times — naive retries, synchronized backoff,
// and backoff with jitter and a budget — and lets the load curves testify.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'retries-jitter',
  title: 'Retries, Backoff & Jitter',
  category: 'Systems',
  summary: 'Three retry policies face the same 10-second outage (simulated live): one melts down, one makes waves, one heals.',
  controls: [
    { id: 'view', label: 'Survive', type: 'select', options: ['one outage, three policies', 'the discipline'], defaultValue: 'one outage, three policies' },
  ],
  run,
};

// A 30-second day: capacity 100 req/s, steady demand 80 req/s, and a full
// outage from t=5 to t=15. Each policy decides when failures try again.
const CAP = 100;
const NEW = 80;
const T = 30;
const isDown = (t) => t >= 5 && t < 15;

function simulate(policy) {
  const pending = new Map();
  const add = (t, n, attempt) => {
    if (t >= T || n <= 0) return;
    const arr = pending.get(t) ?? [];
    arr.push({ n, attempt });
    pending.set(t, arr);
  };
  let seed = 11;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const loads = [];
  for (let t = 0; t < T; t++) {
    const cohorts = [{ n: NEW, attempt: 1 }, ...(pending.get(t) ?? [])];
    const demand = cohorts.reduce((a, c) => a + c.n, 0);
    loads.push(demand);
    const failFrac = isDown(t) ? 1 : demand <= CAP ? 0 : (demand - CAP) / demand;
    for (const c of cohorts) {
      const failed = c.n * failFrac;
      if (failed < 0.5 || c.attempt >= 3) continue;
      if (policy === 'naive') add(t + 1, failed, c.attempt + 1);
      else if (policy === 'backoff') add(t + 2 ** c.attempt, failed, c.attempt + 1);
      else {
        const window = 2 ** c.attempt * 2;
        const n = Math.min(failed, NEW * 0.2); // the retry budget
        for (let s = 0; s < 3; s++) add(t + 1 + Math.floor(rnd() * window), n / 3, c.attempt + 1);
      }
    }
  }
  return loads;
}
const NAIVE = simulate('naive');
const BACKOFF = simulate('backoff');
const JITTER = simulate('jitter');
const series = (id, label, loads) => ({ id, label, points: loads.map((y, t) => ({ x: t, y })) });
const capLine = { id: 'cap', label: 'capacity (100/s)', points: [{ x: 0, y: CAP }, { x: T - 1, y: CAP }] };

function* threePolicies() {
  yield {
    state: plotState({
      axes: { x: { label: 'seconds' }, y: { label: 'requests arriving per second' } },
      series: [capLine, series('naive', 'naive: retry instantly, 3 attempts', NAIVE)],
      markers: [{ id: 'outage', x: 10, y: 250, label: 'outage: t = 5 → 15' }],
    }),
    highlight: { removed: ['naive'], visited: ['cap'] },
    explanation: `Policy 1 is the tempting reflex: retry immediately, up to three attempts. The simulation shows why that is dangerous. During the outage, failed cohorts return at once while new traffic keeps arriving, so offered load climbs from 80 to 160 to 240 requests per second. When capacity returns, the service is greeted by its own retry backlog and remains overloaded for ${NAIVE.filter((l, t) => t >= 15 && l > CAP).length} extra seconds. The original outage ended; client behavior kept it alive.`,
    invariant: 'Immediate retries multiply demand exactly when capacity is lowest: load triples while the service is at zero.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seconds' }, y: { label: 'requests arriving per second' } },
      series: [capLine, series('naive', 'naive', NAIVE), series('backoff', 'exponential backoff (no jitter)', BACKOFF)],
    }),
    highlight: { compare: ['backoff', 'naive'], visited: ['cap'] },
    explanation: 'Policy 2 adds exponential backoff, which is better but still incomplete. Every client waits the same 2 seconds, then the same 4 seconds, so retry cohorts come back in synchronized waves. The overload is postponed rather than smoothed. This is the same thundering-herd shape as synchronized cache expiry: identical timers create identical spikes.',
    invariant: 'Deterministic backoff synchronizes clients: the herd is not dispersed, only postponed.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seconds' }, y: { label: 'requests arriving per second' } },
      series: [capLine, series('naive', 'naive', NAIVE), series('jitter', 'backoff + jitter + budget', JITTER)],
    }),
    highlight: { found: ['jitter'], removed: ['naive'], visited: ['cap'] },
    explanation: `Policy 3 adds the missing pieces: jitter and a budget. Jitter spreads each retry over a window, so cohorts return as a drizzle instead of a wave. The budget caps total retry traffic, so clients cannot add unlimited load while the service is weak. In this simulation the peak is ${Math.round(Math.max(...JITTER))}/s, close enough to capacity that recovery actually sticks.`,
    invariant: 'Jitter desynchronizes, budgets cap amplification: retry load becomes bounded noise instead of a wave.',
  };

  yield {
    state: matrixState({
      title: 'The scoreboard: one outage, three recoveries (simulated live)',
      rows: [
        { id: 'naive', label: 'naive immediate' },
        { id: 'backoff', label: 'backoff, no jitter' },
        { id: 'jitterRow', label: 'backoff + jitter + budget' },
      ],
      columns: [{ id: 'peak', label: 'peak load' }, { id: 'recover', label: 'healthy again at' }],
      values: [
        [Math.round(Math.max(...NAIVE)), 15 + NAIVE.filter((l, t) => t >= 15 && l > CAP).length],
        [Math.round(Math.max(...BACKOFF)), 15 + BACKOFF.filter((l, t) => t >= 15 && l > CAP).length],
        [Math.round(Math.max(...JITTER)), 15],
      ],
      format: (v) => (v > 50 ? `${v}/s` : `t = ${v}s`),
    }),
    highlight: { removed: ['naive:peak', 'backoff:recover'], found: ['jitterRow:peak', 'jitterRow:recover'] },
    explanation: 'The scoreboard is the lesson in numbers. The same outage and same baseline demand produce three different recoveries because retry timing changes offered load. The severe failure mode is metastability: the trigger is gone, but the system remains down because retry traffic keeps it beyond capacity. Jitter and budgets do not fix the original failure; they keep the response from becoming a second failure.',
  };
}

function* discipline() {
  yield {
    state: matrixState({
      title: 'The retry checklist (every production client)',
      rows: [
        { id: 'idem', label: '1. idempotent only' },
        { id: 'backoffRow', label: '2. exponential backoff' },
        { id: 'jitterRow', label: '3. full jitter' },
        { id: 'budget', label: '4. retry budget' },
        { id: 'breaker', label: '5. breaker above it all' },
      ],
      columns: [{ id: 'why', label: 'because' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'retrying a non-idempotent write can charge a card TWICE', 'space attempts so the sick get breathing room', 'random delay in [0, window] — desynchronize the herd', '≤10-20% extra traffic, globally — caps the amplification', 'when failures persist, stop retrying entirely (Circuit Breakers & Deadlines)'][v],
    }),
    highlight: { removed: ['idem:why'], active: ['jitterRow:why'] },
    explanation: 'The checklist starts with correctness. A retry is a duplicate request, so non-idempotent writes need idempotency keys or another dedupe mechanism before retries are safe. Backoff, jitter, and budgets only solve load timing; they do not prevent double charges or duplicate emails. Persistent failure belongs to the circuit breaker, not to infinite retries.',
    invariant: 'A retry is a duplicate: without idempotency, every retry policy is a correctness bug with good intentions.',
  };

  yield {
    state: matrixState({
      title: 'Where retries belong (and where they multiply)',
      rows: [
        { id: 'edge', label: 'retry at ONE layer (the edge)' },
        { id: 'every', label: 'retry at EVERY layer' },
      ],
      columns: [{ id: 'math', label: 'the arithmetic' }],
      values: [[1], [2]],
      format: (v) => ['', '3 attempts, total amplification ×3 — bounded and known', '3 layers × 3 attempts each = up to 27 requests from ONE user click'][v],
    }),
    highlight: { found: ['edge:math'], removed: ['every:math'] },
    explanation: 'Stacked retries are the hidden multiplier. Three attempts at the browser, three at the gateway, and three in the service can turn one click into 27 database attempts. Pick one retry owner for the request path, usually the layer that understands the user deadline. Inner layers should fail fast and propagate the error upward.',
  };

  yield {
    state: matrixState({
      title: 'The resilience stack, complete',
      rows: [
        { id: 'r1', label: 'timeouts + deadlines' },
        { id: 'r2', label: 'retries (this page)' },
        { id: 'r3', label: 'circuit breakers' },
        { id: 'r4', label: 'bulkheads' },
        { id: 'r5', label: 'load shedding + hedging' },
      ],
      columns: [{ id: 'role', label: 'handles' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'doomed work', 'transient blips', 'persistent sickness', 'blast-radius containment', 'overload and stragglers'][v],
    }),
    highlight: { active: ['r2:role'] },
    explanation: 'Retries belong in a stack, not alone. Deadlines stop work that can no longer help. Retries handle short blips. Breakers stop persistent sickness. Bulkheads contain blast radius. Shedding handles overload. Retries are the unusual member because they add load to a system that may already be struggling, so they need ownership, timing, and a hard budget.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'one outage, three policies') yield* threePolicies();
  else if (view === 'the discipline') yield* discipline();
  else throw new InputError('Pick a view.');
}

const legacyArticle = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A retry is a duplicate request. It is useful when a failure is brief, such as a dropped packet or a restarted connection. It is dangerous when the service is overloaded, because the retry adds more work to the system that is already failing. Good retry policy is therefore not "try harder." It is "try again only when the operation is safe, the caller still has budget, and the extra traffic is bounded."`,
        `Backoff spaces attempts. Jitter randomizes those attempts so clients do not return in waves. A retry budget caps amplification. Idempotency keys or server-side dedupe make duplicate writes safe. Circuit breakers stop retries when the problem is no longer a blip.`,
      ],
    },
    {
      heading: `Legacy visual note`,
      paragraphs: [
        `In the outage view, keep your eye on offered load versus the capacity line. The outage is identical in all three plots; only client timing changes. Immediate retries stack failed cohorts on top of new demand, deterministic backoff creates synchronized waves, and jitter plus a budget turns retries into bounded noise. The invariant is that retries change load, not just success probability.`,
        `In the discipline view, the checklist separates correctness from pacing. Idempotency makes duplicates safe; backoff and jitter spread them out; the budget caps amplification; the breaker says when to stop. The layer table is the warning for outsiders: three harmless-looking retry loops can multiply into one user's click becoming dozens of downstream attempts.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The animation simulates 80 new requests per second, 100 requests per second of capacity, and a 10-second outage. Immediate retries stack failed cohorts on top of new traffic, so the service sees up to 240 requests per second and stays overloaded after recovery. Exponential backoff spaces the attempts, but without jitter every client uses the same schedule and comes back in waves.`,
        `Backoff plus jitter plus a budget changes the shape. Jitter spreads each retry randomly across its window. The budget limits total extra traffic, here to 20 percent. The same outage now produces a small bump instead of a recovery storm. The mechanism is simple: failed work asks again later, at different times, and only up to a known amplification limit.`,
        `The second view adds the production rules. Retry only idempotent work or work protected by an idempotency key. Retry at one layer, not every layer. Stop retrying when the deadline is gone or the circuit breaker opens. Log enough metadata to know whether the retry helped or amplified the incident.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The CPU cost is tiny: counters, timers, and random delay selection. The real cost is semantic. A duplicate payment request without an idempotency key can charge twice. A duplicate email can send twice. A duplicate database mutation can violate an invariant. Reliable retry systems often need request IDs, dedupe storage, response replay, and clear expiration rules for those IDs.`,
        `The other cost is coordination across layers. If clients, gateways, services, and database drivers all retry independently, amplification becomes multiplicative. A retry budget should be shared or enforced at the layer that owns the user deadline. Inner layers should prefer small timeouts and clear errors over hidden retry loops.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Retries appear in browsers, mobile apps, SDKs, service clients, database drivers, message queues, and batch jobs. The configuration depends on the domain. A mobile upload may retry over minutes. A checkout authorization may have a short deadline and strict idempotency. A background sync may retry for hours but must avoid synchronized wakeups.`,
        `Cloud SDKs and service meshes commonly include exponential backoff with jitter because the thundering-herd problem is universal. Payment APIs use idempotency keys because correctness matters more than raw retry success. Message queues combine retry delay with dead-letter queues when work keeps failing.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is treating retry as harmless. It is not; it is duplicate work. The second is deterministic backoff without jitter, which schedules the herd for later. The third is no budget, which lets clients add unlimited traffic during the worst moment. The fourth is stacked retries, where every layer believes it is being helpful and the database receives the product of all attempts.`,
        `The simulation is not a precise model of your system. Its value is the shape: immediate retries spike, deterministic backoff waves, jitter plus budget smooths. Your actual policy should be tied to deadlines, operation idempotency, dependency capacity, and a breaker that stops retries when the failure is persistent.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Circuit Breakers & Deadlines explains when to stop retrying. Load Shedding & Graceful Degradation explains what the overloaded server should send back. Backpressure & Flow Control shows the healthier version of the conversation: the server signals strain and clients slow down.`,
        `Tail Latency & p99 Thinking helps choose retry delays from real latency distributions. Cache Invalidation & Versioning gives the synchronized-expiry lesson behind jitter. Message Queue covers delayed retries, dead-letter queues, and idempotent processing.`,
      ],
    },
  ],
};

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Retries exist because distributed systems fail in ways that are often temporary. A packet drops, a leader changes, a rate limit resets, a dependency restarts, or a queue drains. Retrying can turn a transient failure into a successful user request.',
        'Retries also create outages when used carelessly. If thousands of clients retry at the same fixed times, they can amplify load on the recovering service. Backoff and jitter exist to make retries helpful without turning them into synchronized traffic spikes.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is immediate retry: if a request fails, send it again right away. That is fine for a single client and disastrous at fleet scale. When the dependency is overloaded, immediate retry adds more work at the exact moment it needs less.',
        'The next obvious approach is fixed delay: retry after one second, then again after one second. That avoids a tight loop but synchronizes clients. If many clients fail at once, they retry together, fail together, and retry together again.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Exponential backoff reduces pressure by spacing later attempts farther apart. Jitter randomizes each delay so clients spread out instead of forming waves. The system is not only delaying work; it is de-correlating clients.',
        'The retry policy must be tied to a deadline and an idempotency story. Retrying forever is not resilience. Retrying a non-idempotent payment without a key can duplicate side effects. A good retry plan says when to stop and how duplicate attempts are made safe.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A basic policy chooses a base delay, a multiplier, a maximum delay, and a maximum attempt count or deadline. After each retryable failure, it computes the next backoff. With jitter, the actual wait is sampled from a range rather than using the same deterministic value for every client.',
        'Full jitter samples between zero and the exponential cap. Equal jitter keeps part of the delay fixed and randomizes the rest. Decorrelated jitter uses the previous delay to choose the next range. The exact variant matters less than the principle: avoid synchronized retry waves.',
        'The client should retry only errors that are plausibly transient: timeouts, connection resets, 429s, 503s, leader-not-ready responses, and similar conditions. Validation errors, permission failures, malformed requests, and most 4xx errors should not be retried blindly.',
        'A deadline should wrap the whole operation, not only each attempt. Without a total deadline, three attempts with long per-attempt timeouts can exceed the user budget by a large margin. The caller should know when the answer is no longer useful.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The retry-wave view proves why deterministic backoff is not enough. Even if attempts are farther apart, a whole fleet can still line up on the same schedule. That creates bursts against the dependency and can keep it from recovering.',
        'The jitter view proves that randomness is a coordination tool. Each client has a slightly different retry time, so load becomes a smear instead of a spike. The average retry pressure may be similar, but the peak pressure is lower and recovery is more likely.',
        'The timeline should be read across clients, not down one client. A single request with backoff may look reasonable. The system risk appears when many clients follow the same schedule and accidentally behave like one synchronized load generator.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Backoff works because many failures clear with time: a queue drains, a deployment finishes, a lock releases, or a leader election completes. Waiting gives the dependency a chance to recover before receiving more work.',
        'Jitter works because independent random delays reduce correlation. The service sees a smoother arrival process rather than synchronized batches. In distributed systems, correlated behavior is often the real enemy; jitter breaks that correlation cheaply.',
        'Deadlines make the policy honest. Without a deadline, every retry can be locally reasonable while the whole operation violates the caller latency budget. Backoff answers when to try again; the deadline answers whether trying again is still worth it.',
        'Idempotency makes the policy safe. A retry is a duplicate by definition, so the receiver must be able to recognize the original operation or make the operation naturally repeatable. Without that property, better timing only creates cleaner duplicate damage.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Retries spend time and capacity. A successful third attempt may save a user request, but the first two attempts still consumed client sockets, server work, logs, and queue slots. Under overload, a high retry budget can multiply traffic several times.',
        'Backoff also increases latency. A policy that is gentle on the server may be too slow for user-facing requests. A policy that is fast for the user may be too aggressive for batch clients. Different routes need different retry budgets.',
        'The multiplier effect is easy to underestimate. If three layers each try three times, one original request can become 27 downstream attempts in the worst case. Good systems put the retry budget near the edge or pass retry context through the stack.',
        'Timeout choice is part of the same tradeoff. A timeout that is too short creates false failures and unnecessary retries. A timeout that is too long holds resources and leaves no budget for a useful retry. Retry policy and timeout policy should be designed together.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Retries with jitter win for transient network failures, rate-limit recovery, service restarts, leader elections, lock contention, optimistic transaction retries, cloud API calls, and background jobs. They are a basic hygiene feature for any distributed client.',
        'They work best with idempotency keys, deadlines, circuit breakers, hedged requests used carefully, and server-provided retry-after hints. The retry loop should be part of a larger resilience policy rather than a hidden while loop.',
        'They are also valuable in batch and queue workers because a failed job can be rescheduled without blocking the whole worker. In that setting, jitter prevents every failed job from waking up on the same second after an outage.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is retrying unsafe side effects. Creating an order, charging a card, or sending an email needs idempotency or a deduplication key before retries are safe. Otherwise a transient timeout can become duplicate real-world action.',
        'The second failure is retry amplification. If every layer retries three times, a frontend, backend, and database client can turn one user request into dozens of attempts. Retry budgets should be coordinated across layers.',
        'The third failure is ignoring server signals. A 429 with Retry-After, a permanent validation error, or a circuit-breaker open state should change client behavior. Blind retry loops are not robust; they are load generators.',
        'Observability is part of the design. Track attempts per original request, retry reasons, final outcome, delay distribution, and dependency status. Without those dimensions, retries disappear into generic latency and make incidents harder to explain.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Rate Limiter Token Bucket, Circuit Breaker, Bulkheads and Resource Isolation, Idempotency Keys, Tail Latency, Queue Backpressure, Hedged Requests, and Distributed Tracing. Then inspect a real client library and ask which errors it retries, what deadline bounds it, and whether jitter is enabled by default.',
        'A useful exercise is to graph 1,000 clients retrying with fixed backoff, exponential backoff, and full jitter. The average number of attempts may be similar, but the peak concurrent load will explain why jitter is a systems primitive.',
        'Then add a retry budget and a circuit breaker to the simulation. The moment the dependency starts failing broadly, the best client behavior is often to send fewer attempts, not more determined attempts.',
      ],
    },
  ],
};
