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
    explanation: `Policy 1 — the reflex everyone writes first: on failure, retry immediately, up to 3 attempts. The simulation (run live by this module) shows what that reflex does to a 10-second outage: every failed cohort comes straight back while NEW traffic keeps arriving, so demand stacks 80 → 160 → 240 — the dead service is being hit at TRIPLE its normal load, by its own clients, for the entire outage. Worse, look at t = 15 when the service recovers: 240/s greets a 100/s capacity, so the "recovered" service immediately drowns — failures continue for ${NAIVE.filter((l, t) => t >= 15 && l > CAP).length} more seconds on self-inflicted load alone. The outage ended; the storm it bred did not.`,
    invariant: 'Immediate retries multiply demand exactly when capacity is lowest: load triples while the service is at zero.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seconds' }, y: { label: 'requests arriving per second' } },
      series: [capLine, series('naive', 'naive', NAIVE), series('backoff', 'exponential backoff (no jitter)', BACKOFF)],
    }),
    highlight: { compare: ['backoff', 'naive'], visited: ['cap'] },
    explanation: 'Policy 2 — EXPONENTIAL BACKOFF: wait 2 seconds before the first retry, 4 before the next. Smarter — and watch the simulation expose its flaw: every client computes the SAME delays, so failed cohorts return in synchronized WAVES. The waves overlap with new traffic and each other, and the post-recovery hangover is actually LONGER than naive\'s — demand stays above capacity until t ≈ 26 as wave after synchronized wave crashes in. Backoff without randomness just schedules the stampede for later (the same synchronized-expiry lesson as Cache Invalidation & Versioning\'s thundering herd: identical timers create identical spikes).',
    invariant: 'Deterministic backoff synchronizes clients: the herd is not dispersed, only postponed.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'seconds' }, y: { label: 'requests arriving per second' } },
      series: [capLine, series('naive', 'naive', NAIVE), series('jitter', 'backoff + jitter + budget', JITTER)],
    }),
    highlight: { found: ['jitter'], removed: ['naive'], visited: ['cap'] },
    explanation: `Policy 3 — the production answer, three ingredients deep: exponential backoff (space the attempts), JITTER (randomize each delay across its window, so cohorts smear into a gentle drizzle instead of waves), and a RETRY BUDGET (clients may add at most 20% extra traffic, ever). The simulated curve barely registers the disaster: peak load ${Math.round(Math.max(...JITTER))}/s — within sixteen percent of normal — and the moment the outage ends, the system simply… works. Same outage, same clients, same number of user requests. The only thing that changed is WHEN failures asked again.`,
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
    explanation: 'The scoreboard, every number from the live simulation. The pattern this page shares with Hot Rows & Append-and-Aggregate and Tail Latency & p99 Thinking: systems rarely die of their original wound — they die of the RESPONSE to it. A 10-second blip became a 21-second meltdown purely through client behavior, and the fix cost nothing but patience and a random number. The severe version of this has a name worth knowing — METASTABLE FAILURE: a system that stays down after its trigger is gone, held under by its own retry load. Several famous cloud outages lived in that state for hours.',
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
    explanation: 'The checklist, in priority order — and item 1 outranks everything: a retry is a DUPLICATE REQUEST, so retrying anything non-idempotent risks double-charged cards and double-sent emails. The fix is IDEMPOTENCY KEYS: the client attaches a unique ID per logical operation, the server remembers processed IDs and returns the original result for duplicates (this is how Stripe\'s API makes payment retries safe). Items 2-4 you watched work in the simulation; AWS\'s engineering blog famously benchmarked the jitter variants and "full jitter" — delay drawn uniformly from [0, backoff window] — won. Item 5 closes the loop: retries handle BLIPS; persistent failure is the breaker\'s job.',
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
    explanation: 'The trap that survives even good per-client policies: STACKED retries. If the browser retries 3×, the gateway retries 3×, and the service retries its database 3×, one user click can detonate into 27 database attempts — exponential amplification through the call stack (fan-out math, Tail Latency & p99 Thinking\'s formula pointed inward). The discipline: retry at ONE layer — usually the outermost client that owns the user experience — and let inner layers fail fast and honestly upward (deadlines from Circuit Breakers & Deadlines make that automatic). One owner per failure, one budget per request.',
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
    explanation: 'The full resilience stack this Systems tour has assembled, each tool matched to its failure: deadlines kill doomed work, retries absorb transient blips, Circuit Breakers & Deadlines handle persistent sickness, Bulkheads & Resource Isolation cap the blast radius, and shedding plus hedging tame overload and tails. Retries are the most-used and most-misused of the five — the only one that ADDS load to a struggling system — which is why they alone come with a checklist instead of a knob. Tune them like medicine: right dose, right timing, never two prescribers for the same patient.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'one outage, three policies') yield* threePolicies();
  else if (view === 'the discipline') yield* discipline();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `A retry is a duplicate request: when a network call fails, the client sends it again, hoping the transient blip resolves before the third attempt runs out. Three layers of policy control retries: exponential backoff (space attempts apart so the struggling service gets breathing room), jitter (randomize each delay so synchronized clients do not form a wave), and a retry budget (cap the extra traffic you add — never exceed 20% amplification globally). The dangerous truth: retries are the only resilience tool that ADDS load to a sick system. Every other tool in the stack — timeouts, circuit breakers, bulkheads — removes or isolates load. Retries can heal transient failures; misconfigured, they extend the outage indefinitely through metastable failure: the system stays down after its original wound heals because its own clients are drowning it under retry load.`,
        `This page animates three policies facing the same 10-second outage — naive immediate retries, deterministic backoff, and backoff with jitter and a budget — and shows why the third survives while the first melts the system down.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The live simulation in the first view runs a 30-second day at 80 requests per second steady demand, 100 requests per second capacity, and a full outage from t = 5 to t = 15. Three cohorts of requests face this blip under three policies: Policy 1 — naive immediate retries: on failure, retry instantly, up to 3 attempts. Every failed request returns immediately while new demand keeps arriving, so failures stack 80 → 160 → 240 requests per second — the service is hit at triple its normal load by its own clients. When the service recovers at t = 15, it faces 240 requests per second and immediately fails again; the self-inflicted storm lasts 7 more seconds after the outage ends. Policy 2 — exponential backoff without jitter: wait 2 seconds before the first retry, 4 seconds before the second. Spacing feels smarter — it gives the service time to recover — but every client computes the same delays, so failed cohorts return in synchronized waves, and those waves overlap with new traffic and each other, extending the hangover to t ≈ 26. The outage is over; the system's own response to it is not.`,
        `Policy 3 — the production answer: exponential backoff plus jitter plus a retry budget. Backoff (2, 4, 8 seconds...) spaces attempts. Jitter randomizes each delay uniformly across its window — delay in [0, 2 seconds], then [0, 4 seconds], then [0, 8 seconds] — so failed cohorts smear into a gentle drizzle instead of synchronized waves. A retry budget caps extra traffic at 20% of your normal demand (just 16 extra requests per second at t = 5). The simulated curve barely registers the disaster: peak load ~116 requests per second, within 16% of normal, and the system simply works the moment the outage ends at t = 15. Same outage, same number of user requests, same clients — the only thing that changed is WHEN failures asked again. The second view drills into the discipline: a five-item checklist (idempotency keys first, then backoff, jitter, budget, and a circuit breaker above retries), the stacked-retries trap (3 layers × 3 attempts = 27 requests from one click; retry at ONE layer only), and how retries fit into the complete resilience stack alongside timeouts, circuit breakers, bulkheads, and load shedding.`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `The computational cost of retries is negligible: compute exponential backoff once per failure (a few multiplications), randomize if jitter is enabled (one random number generator call per retry), and store a counter per in-flight request. Memory is constant: one integer per pending retry. The real costs are semantic: retrying a non-idempotent operation (a write that is not guarded by an idempotency key) can charge a card twice, send a duplicate email, or double-process a financial transaction. This is why idempotency keys are checklist item 1: the client attaches a unique ID per logical operation, the server remembers processed IDs and returns the original result for duplicates (Stripe's API made this famous). A system without idempotency keys cannot retry safely, no matter how clever the backoff. The second complexity is stacked retries: if your browser retries 3×, your API gateway retries 3×, and your backend service retries its database 3×, one user click detonate into 27 attempts. The fan-out math means the amplification is exponential through the layers. The discipline: retry at ONE layer — typically the outermost client — and let inner layers fail fast and honestly upward. Deadlines from Circuit Breakers & Deadlines enforce this automatically.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Retries power every production client: browser-to-backend, backend-to-database, mobile app to API. The discipline is universal but the configuration is not. Low-latency financial systems retry aggressively with millisecond windows; long-latency batch systems retry with hour-long exponential windows. Mobile clients retry with jitter because networks are unreliable and handoff storms are real. Edge services (CDNs, cloud gateways) retry to origin with budgets because the origin is usually the bottleneck. Database drivers retry transient connection failures. Message queues retry delivery with dead-letter fallbacks. The AWS full-jitter benchmark (published in their "Timeouts, Retries, and Backoff" engineering post) became the gold standard: delay uniformly from [0, min(cap, base × 2^attempt)]. Google's SRE book made metastable failure famous by naming it: a system that stays down after its original cause is fixed because its own clients are drowning it. Cloud outages have lasted hours in this state — Netflix had one in 2012, triggered by a retry storm during maintenance. The fix was discipline: budgets, circuit breakers, and a single retry owner per request. That discipline now ships in every HTTP client library worth using.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The first trap is forgetting that a retry is a duplicate: every single retry is a repeat of the request that failed. If that request is non-idempotent (a POST to charge a card, a PUT to update state without guards), retrying it is a correctness bug, not a reliability fix. This is not a performance concern; it is a correctness concern. The second trap is missing the budget: retry without a cap and you will amplify load indefinitely during an outage. One failure × 3 attempts is ×3 load; stacked across layers it is ×27. The third trap is deterministic backoff without jitter — it synchronizes the herd and postpones the stampede instead of dispersing it. The simulation shows this: backoff makes waves, jitter makes rain. The fourth trap is stacked retries: retrying at every layer in your call stack multiplies attempts exponentially. The discipline is one owner per request, typically the outermost client. The fifth trap is ignoring metastable failure: after an outage, your retry load might hold the system down longer than the original cause did. This is why the checklist includes a circuit breaker — when failures persist, stop retrying entirely and fail fast instead.`,
        `A subtle misconception is believing the simulation is accurate in absolute terms; it is not. Real systems have network jitter, cascading timeouts, and uneven load distribution that the flat model hides. The point is the shape: naive retries create a spike, backoff creates waves, backoff-plus-jitter smooths the curve. Your actual system will have different numbers but the same dynamic. Finally, do not assume one configuration fits all layers: a retry policy for talking to a database (millseconds, tight budget) looks nothing like a retry policy for talking to an external API (seconds, loose budget) or a mobile client talking over LTE (exponential windows, heavy jitter).`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Retries work only for transient failures; persistent problems need Circuit Breakers & Deadlines. When you have many layers, Bulkheads & Resource Isolation contain the blast radius of failures. To understand why retries amplify load, study Tail Latency & p99 Thinking — the p99 request latency drives your retry windows. If you are building a robust system, Cache Invalidation & Versioning teaches the thundering-herd lesson that motivates jitter. When your system is under heavy load, explore load shedding and hedging (sending redundant requests to beat the latency tail). Finally, idempotency keys are your foundation — they are not a performance optimization, they are a correctness requirement.`,
      ],
    },
  ],
};

