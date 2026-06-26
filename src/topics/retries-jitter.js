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
      
        {type: 'image', src: './assets/gifs/retries-jitter.gif', alt: 'Animated walkthrough of the retries jitter visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
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
        'Read offered load as the total traffic the dependency receives, including new user work and retry work. Capacity is the line the service can handle. When offered load stays above capacity after the original outage ends, the retry policy has created a second failure.',
        'Compare the three policies by shape. Immediate retry piles failed requests onto current traffic. Deterministic backoff spreads attempts in time but keeps clients synchronized. Jitter and a retry budget turn the wave into bounded noise.',
        {type: 'callout', text: 'A retry policy is a load-shaping policy: timing, jitter, and budget decide whether recovery creates a second outage.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Distributed systems have transient failures. A packet drops, a leader election finishes, a rate-limit window resets, or a deployment restarts a process. Retrying can hide those short failures from the user.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Packet_Switching.gif', alt: 'Packet switching animation with packets moving through network nodes', caption: 'Packet-switched systems already absorb small losses and delays; retry policy decides how clients react when that loss clusters. Source: https://commons.wikimedia.org/wiki/File:Packet_Switching.gif.'},
        'The danger is that a retry is extra work sent to a system that just failed. One caller retrying is harmless. Thousands of callers retrying together can keep the service overloaded after it would otherwise recover.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is immediate retry. If the call failed, send it again. For one user and one brief packet loss, that often succeeds and costs almost nothing.',
        'The next obvious improvement is fixed delay or exponential backoff. Waiting reduces tight retry loops. Without randomness, though, clients that failed together still return together.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is synchronized recovery. A shared outage creates a shared failure time, and a deterministic policy creates a shared return time. The clients become a traffic generator aimed at a weak dependency.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Data_Queue.svg/250px-Data_Queue.svg.png', alt: 'Queue diagram showing input and output ends', caption: 'Retry bursts behave like a queue whose arrivals exceed service capacity: backlog keeps the system unhealthy after the trigger is gone. Source: https://commons.wikimedia.org/wiki/File:Data_Queue.svg.'},
        'The second wall is semantic correctness. Retrying a write can charge twice, send two emails, or apply the same mutation twice. Timing controls do not make duplicate work safe.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Retries need three controls. Backoff gives the dependency time, jitter prevents synchronized return, and a budget caps total amplification. Idempotency decides whether the operation is safe to repeat at all.',
        'A retry policy is therefore not only a latency feature. It is a load contract between clients and dependencies. The policy must protect the shared system while still helping individual requests survive brief faults.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A safe client first checks whether the operation can be repeated. Reads are often repeatable. Writes need idempotency keys, request IDs, or server-side deduplication before retry is correct.',
        'After a retryable failure, the client computes a delay window such as 100 ms, 200 ms, 400 ms, then samples a random delay inside the current window. Full jitter samples between zero and the cap. The budget stops retries when the request deadline or global amplification limit is spent.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with arrows between nodes', caption: 'A request path is a directed dependency graph; retry ownership should be clear so every layer does not multiply the same user action. Source: https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Jitter works because independent random delays turn one shared failure time into many return times. The total retry volume may be similar, but the peak load falls because clients no longer align on the same millisecond or second.',
        'Budgets work because they bound amplification. If normal demand is 80 requests per second and the retry budget is 20 percent, sustained retry traffic should not exceed about 16 extra requests per second. That bound keeps recovery within capacity planning.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The CPU cost is tiny: timers, counters, random numbers, and metadata. The behavioral cost is duplicate work. A retry system often needs idempotency-key storage, response replay, deadline propagation, and metrics that separate original traffic from retry traffic.',
        'Layering is the expensive failure mode. Three layers with three attempts each can turn one user action into 27 downstream attempts. Doubling retries at two layers multiplies load; it does not merely add a little latency.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HTTP clients, cloud SDKs, service meshes, queue consumers, mobile upload clients, and database drivers all need retry policy. The settings depend on operation deadline, dependency capacity, and whether the operation is idempotent.',
        'Payment APIs use idempotency keys because duplicate writes are dangerous. Background sync can wait minutes and retry slowly. Interactive checkout needs a short deadline and clear failure once the budget is gone.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Retries fail on persistent outages. If the dependency is down for minutes, more attempts only add load. Circuit breakers and load shedding should stop the flow until health evidence changes.',
        'Retries also fail when every layer owns the policy independently. The browser, gateway, service, and database driver may each look reasonable alone while together they multiply attempts. One layer should own the user deadline and the retry budget.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose normal demand is 80 requests per second and capacity is 100 requests per second. A dependency is completely down for 10 seconds, so 800 original requests fail during the outage. If every failed request retries immediately twice, the client population can offer hundreds of extra requests per second right when the service returns.',
        'With deterministic exponential backoff at 1 second, 2 seconds, and 4 seconds, the waves move later but stay aligned. If 800 clients share the same timer, a large cohort returns together. The outage has ended, but offered load can still exceed 100 requests per second.',
        'With full jitter and a 20 percent retry budget, extra traffic is capped near 16 requests per second over the 80 request baseline. Offered load stays near 96 requests per second, which is below the 100 request capacity. Some calls still fail, but the system recovers instead of feeding a retry storm.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Marc Brooker, Exponential Backoff and Jitter, AWS Architecture Blog; Google SRE Book, Handling Overload; Google SRE Book, Addressing Cascading Failures. These sources connect retry timing to overload behavior.',
        'Study next: circuit breakers for stopping persistent failure, deadlines for bounding user work, backpressure for explicit slowdown, load shedding for server-side protection, and tail latency for choosing retry windows from real latency distributions.',
      ],
    },
  ],
};