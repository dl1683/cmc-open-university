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
      heading: `Why this exists`,
      paragraphs: [
        `A retry is a duplicate request. It is useful when a failure is brief, such as a dropped packet or a restarted connection. It is dangerous when the service is overloaded, because the retry adds more work to the system that is already failing. Good retry policy is therefore not "try harder." It is "try again only when the operation is safe, the caller still has budget, and the extra traffic is bounded."`,
        `Backoff spaces attempts. Jitter randomizes those attempts so clients do not return in waves. A retry budget caps amplification. Idempotency keys or server-side dedupe make duplicate writes safe. Circuit breakers stop retries when the problem is no longer a blip.`,
      ],
    },
    {
      heading: `How to read the animation`,
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
      heading: `Cost and behavior`,
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
      heading: `Where it fails`,
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
      {
      heading: 'The wall',
      paragraphs: [
        'The wall is synchronized recovery: a clean initial failure becomes another synchronized spike.',
        'If five clients all fail at t=0 and retry in lockstep at 100ms, 200ms, 400ms, they can hammer the same saturated shard repeatedly.',
        'Retry strategies work only when attempts spread over time and respect a budget, otherwise they reproduce the same overload pattern they were meant to escape.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Start with `baseDelay=100ms`, `maxAttempts=3`, jitter +/-20%, and one request failure at t=0.',
        'Attempt 1 fails, then waits 80ms-120ms; Attempt 2 fails, then waits 160ms-240ms.',
        'If the upstream recovers by 180ms, only the attempt after recovery should succeed; earlier synchronized attempts should not be allowed to amplify the burst.',
      ],
    },
],
};

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The "one outage, three policies" view simulates 80 requests per second of steady demand against 100 requests per second of capacity, with a complete outage from t = 5 to t = 15. The capacity line is the ceiling. When offered load exceeds it, the service is overloaded regardless of whether the outage is still active. Watch the gap between offered load and capacity after t = 15: that gap is the retry damage.',
        {type: 'callout', text: 'A retry policy is a load-shaping policy: timing, jitter, and budget decide whether recovery creates a second outage.'},
        'The first plot shows naive immediate retry. Failed cohorts return immediately and stack on top of new traffic. The second plot overlays exponential backoff without jitter: the retries are spaced further apart but still synchronized, creating waves. The third plot shows backoff with jitter and a retry budget: load stays close to capacity and recovery sticks.',
        'In "the discipline" view, the checklist and layer table are the production rules. The checklist starts with idempotency because a retry is a duplicate request by definition. The layer table shows the multiplicative danger: three layers retrying three times each can turn one user click into 27 downstream attempts.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems fail in ways that clear themselves. A packet drops and the next one arrives. A leader election finishes in two seconds. A rate-limit window resets. A deployment rolls forward. A queue drains its backlog. These are transient failures, and retrying turns them into successful requests without human intervention.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation with packets moving through network nodes', caption: 'Packet-switched systems already absorb small losses and delays; retry policy decides how clients react when that loss clusters. Source: https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.'},
        'The problem is that retries are extra load aimed at a system that just demonstrated weakness. One client retrying is harmless. Ten thousand clients retrying at the same instant after a shared failure is a second outage caused by the recovery from the first. Retry policy exists to make retries helpful to the individual caller without being destructive to the shared dependency.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The first instinct is immediate retry: the call failed, so try again. For a single client talking to a healthy server, this works and feels free. The failure was a blip, the retry succeeds, and the user never notices.',
        'The next refinement is a fixed delay: wait one second, then retry. This avoids a tight spin loop but introduces no randomness. If a thousand clients all fail at the same moment, they all wait one second and retry together. The delay postpones the herd; it does not disperse it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is synchronized recovery. A clean initial failure becomes a second synchronized spike when many clients follow the same retry schedule. Immediate retries amplify load during the outage. Deterministic backoff moves that amplification later without spreading it out.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram showing input and output ends', caption: 'Retry bursts behave like a queue whose arrivals exceed service capacity: backlog keeps the system unhealthy after the trigger is gone. Source: https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'The deeper failure is metastability. The dependency may be healthy again, but retry load can keep offered traffic above capacity. The incident persists because the client population became part of the overload loop.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Backoff gives the service time to recover. Jitter keeps clients from returning in lockstep. A retry budget caps total amplification so callers cannot add unbounded work to a weak dependency.',
        'Those three controls solve different problems. Backoff changes delay, jitter changes synchronization, and the budget changes volume. Removing any one of them leaves a path to overload.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A practical client starts by checking whether the operation is safe to repeat. Reads are often safe. Writes need idempotency keys, request identifiers, or server-side dedupe before retry can be correct.',
        'After a retryable failure, the client computes an exponential window such as 100ms, 200ms, 400ms, and so on, then picks a random delay inside that window. Full jitter means the delay is uniform from zero to the current cap, which spreads the cohort rather than moving it as one block.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A request path is a directed dependency graph; retry ownership should be clear so every layer does not multiply the same user action. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'The budget can be local, such as at most two retries per request, and global, such as no more than 10 to 20 percent extra traffic over baseline. When the budget is spent or the deadline is gone, the client stops retrying and returns the error.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Jitter works because independent random delays turn one shared failure time into many return times. The expected retry volume can stay similar, but the peak offered load drops because clients no longer align on the same second.',
        'Budgets work because they make amplification measurable. If the base request rate is 80 per second and the budget is 20 percent, retry traffic cannot exceed 16 extra requests per second for long. That bound is what lets capacity planning survive client behavior.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The CPU cost is small: timers, counters, random delay selection, and metadata. The semantic cost is larger. Duplicate writes can charge twice, send two emails, or apply a database mutation twice unless idempotency is part of the design.',
        'Stacked retries are the operational cost. Three attempts in the browser, gateway, service, and database driver can turn one user action into many downstream attempts. Pick the layer that owns the user deadline and let inner layers fail clearly.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HTTP clients, cloud SDKs, service meshes, queue consumers, mobile upload clients, and database drivers all need retry policy. The right settings depend on the operation deadline, dependency capacity, idempotency model, and whether the retry owner can observe global load.',
        'Payment APIs lean on idempotency keys. Background sync can tolerate long retry windows. Interactive checkout cannot. Message queues combine delayed retry with dead-letter queues when work keeps failing.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Retries fail on persistent sickness. If a dependency is down for minutes, retrying harder only adds load. The circuit breaker should stop attempts until health evidence changes.',
        'They also fail when the operation is not repeatable. A policy that retries non-idempotent writes is a correctness bug with a timer attached. Backoff and jitter make duplicate work smoother; they do not make duplicate work safe.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Start with 80 requests per second, 100 requests per second capacity, and a 10-second outage. Immediate retry with three attempts stacks failed cohorts onto new demand, so offered load can rise far above capacity just when the service returns.',
        'With deterministic backoff, clients wait longer but still return together. With full jitter and a 20 percent retry budget, the same failed cohort spreads over the retry window and cannot exceed the configured extra load. The service sees noise instead of a wave.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Marc Brooker, "Exponential Backoff and Jitter" at https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/; Google SRE Book, "Handling Overload" at https://sre.google/sre-book/handling-overload/; and Google SRE Book, "Addressing Cascading Failures" at https://sre.google/sre-book/addressing-cascading-failures/.',
        'Study next: Circuit Breakers and Deadlines for stopping persistent failure, Load Shedding and Graceful Degradation for server-side overload response, Backpressure and Flow Control for explicit slowdown, and Tail Latency and p99 Thinking for choosing retry windows from real latency distributions.',
      ],
    },
  ],
};


