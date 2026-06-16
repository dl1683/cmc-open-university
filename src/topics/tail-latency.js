// Tail latency: your average is 60ms and your users are furious. The 1%
// of slow requests rules user experience — and fan-out multiplies it until
// "rare" happens on most page loads. Computed live, tamed at the end.

import { plotState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'tail-latency',
  title: 'Tail Latency & p99 Thinking',
  category: 'Systems',
  summary: 'The average says 60ms; the tail says 1 second — and fan-out makes the rare 1% hit most page loads.',
  controls: [
    { id: 'view', label: 'Measure', type: 'select', options: ['why averages lie', 'taming the tail'], defaultValue: 'why averages lie' },
  ],
  run,
};

const slowShare = (n) => 1 - 0.99 ** n;

function* averagesLie() {
  yield {
    state: plotState({
      axes: { x: { label: 'response time (ms)' }, y: { label: 'share of requests' } },
      series: [{
        id: 'dist',
        label: 'latency distribution',
        points: [
          { x: 30, y: 0.1 }, { x: 40, y: 0.3 }, { x: 50, y: 0.35 }, { x: 60, y: 0.15 },
          { x: 80, y: 0.05 }, { x: 120, y: 0.02 }, { x: 300, y: 0.012 }, { x: 1000, y: 0.01 },
        ],
      }],
      markers: [
        { id: 'mean', x: 59.5, y: 0.36, label: 'mean: 59.5ms — "all good!"' },
        { id: 'p99', x: 1000, y: 0.03, label: 'p99: 1,000ms' },
      ],
    }),
    highlight: { found: ['mean'], removed: ['p99'] },
    explanation: 'A service answers 99% of requests in around 50ms — and 1% in a full second (a garbage-collection pause, a cold cache, a queue spike). The mean: 0.99·50 + 0.01·1000 ≈ 59.5ms. The dashboard glows green. But averages are DEMOCRACY AMONG MILLISECONDS, and the 1-second requests are real users staring at a spinner. Latency distributions are violently skewed — one long tail drags the mean a little and tells you NOTHING about how bad the bad cases are. That is why serious systems report PERCENTILES: p50 (the median experience), p99 (one user in a hundred), p999 — the tail, looked at directly.',
    invariant: 'Means hide tails: a metric that averages a spinner with 99 fast clicks reports a fast click.',
  };

  const SESSIONS = [1, 5, 20, 100];
  yield {
    state: matrixState({
      title: 'One user is many requests: P(session hits the 1% tail) — computed live',
      rows: SESSIONS.map((n) => ({ id: `s${n}`, label: `${n}-request session` })),
      columns: [{ id: 'p', label: 'chance of ≥1 slow request' }],
      values: SESSIONS.map((n) => [slowShare(n) * 100]),
      format: (v) => `${v.toFixed(1)}%`,
    }),
    highlight: { compare: ['s1:p'], removed: ['s100:p'] },
    explanation: 'Now stop thinking in requests and think in USERS. A page visit fires dozens of requests — HTML, API calls, images. With each independently carrying a 1% tail risk, a 20-request session hits at least one slow response with probability 1 − 0.99²⁰ = 18.2% — nearly ONE SESSION IN FIVE feels the one-second hang your dashboard called negligible. A hundred-request session: 63%. The arithmetic is merciless: per-request rarity times per-user volume equals per-user regularity. "p99" does not mean "1% of users" — it means "most of your heavy users, daily."',
    invariant: 'P(user hits the tail) = 1 − (1 − p)ⁿ: rare per request becomes routine per session.',
  };

  const FANOUT = [1, 10, 30, 100];
  yield {
    state: matrixState({
      title: 'Fan-out amplification: a page that waits on N parallel backends',
      rows: FANOUT.map((n) => ({ id: `f${n}`, label: `fan-out = ${n}` })),
      columns: [{ id: 'p', label: 'P(page waits on a tail request)' }],
      values: FANOUT.map((n) => [slowShare(n) * 100]),
      format: (v) => `${v.toFixed(1)}%`,
    }),
    highlight: { removed: ['f100:p'], compare: ['f1:p'] },
    explanation: 'And modern pages make it worse ARCHITECTURALLY. A search page fans out to 100 shards in parallel and must wait for ALL of them (Sharding & Partitioning\'s scatter-gather): the page is slow if ANY backend is slow — probability 1 − 0.99¹⁰⁰ = 63.4%. Read that again: every individual server has a beautiful 1% tail, and the page assembled from them is slow MOST of the time. This is the central result of Dean & Barroso\'s "The Tail at Scale" (2013), the paper that taught the industry that the p99 is not a corner case — at fan-out, the p99 IS the median.',
    invariant: 'Wait-for-all fan-out: the page inherits the WORST of N draws — server p99 becomes page p37.',
  };

  yield {
    state: matrixState({
      title: 'Where tails come from (every one familiar from this site)',
      rows: [
        { id: 'gc', label: 'GC / compaction pauses' },
        { id: 'queue', label: 'queueing spikes' },
        { id: 'cache', label: 'cache misses' },
        { id: 'retry', label: 'retries & timeouts' },
        { id: 'noisy', label: 'noisy neighbors' },
      ],
      columns: [{ id: 'seen', label: 'where you met it' }],
      values: [[1], [2], [3], [4], [5]],
      format: (v) => ['', 'the 94ms shard; LSM Tree background compaction', 'arrivals > service — Hot Rows & Append-and-Aggregate', 'the miss path: CDN Request Flow, LRU Cache eviction', 'retry storms — Message Queue\'s death spiral', 'shared hardware: someone else\'s batch job, your latency'][v],
    }),
    highlight: { compare: ['gc:seen', 'queue:seen'] },
    explanation: 'Where do tails COME from? Nowhere exotic — every culprit is a page you have already studied: stop-the-world pauses and LSM Tree compaction running at the wrong moment; queues breathing past their service rate; the unlucky request that missed every cache and paid the full origin price; a retry arriving exactly when the system is busiest; a neighbor\'s workload stealing your machine\'s cycles. The tail is not a bug to fix once — it is the SUM of every rare event in the stack, which is why it cannot be eliminated, only engineered around. The other view is that engineering.',
  };
}

function* taming() {
  yield {
    state: matrixState({
      title: 'Hedged requests: the 2% insurance policy (Dean & Barroso, BigTable)',
      rows: [
        { id: 'plain', label: 'no hedging' },
        { id: 'hedged', label: 'hedge: duplicate after 10ms' },
        { id: 'cost', label: 'price paid' },
      ],
      columns: [{ id: 'what', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'p999 for a 1000-key read: 1,800ms', 'p999: 74ms — 24× better', '~2% extra requests. That\'s all.'][v],
    }),
    highlight: { removed: ['plain:what'], found: ['hedged:what'] },
    explanation: 'The flagship cure: HEDGED REQUESTS. Send the query to one replica; if no reply arrives within the p95 latency, fire a duplicate at a second replica and take whichever answers first. The insight: you only pay the duplicate on the slowest 5% of requests, so total load rises ~2-5% — but the tail collapses, because BOTH replicas must stall for the user to wait. Dean & Barroso\'s production number: a BigTable batch read\'s p999 fell from 1,800ms to 74ms for 2% extra traffic. The refinement, TIED REQUESTS, sends both immediately but lets the first server to start cancel its twin — insurance with a no-double-pay clause.',
    invariant: 'Hedging trades a few percent of duplicate load for the product of two independent tail probabilities.',
  };

  yield {
    state: matrixState({
      title: 'The retry that helps vs the retry that kills',
      rows: [
        { id: 'good', label: 'disciplined retry' },
        { id: 'bad', label: 'naive retry' },
        { id: 'shed', label: 'load shedding' },
      ],
      columns: [{ id: 'how', label: '' }],
      values: [[1], [2], [3]],
      format: (v) => ['', 'budgeted (≤10% extra), jittered backoff, idempotent only', 'every timeout retries instantly → traffic doubles exactly when overloaded', 'past capacity: answer some fast, reject the rest fast — never queue forever'][v],
    }),
    highlight: { removed: ['bad:how'], found: ['good:how', 'shed:how'] },
    explanation: 'The dangerous medicine: RETRIES. A retry is a hedge after the fact — useful — but a naive retry-on-timeout policy DOUBLES traffic at the precise moment the system is slow because it is overloaded, feeding the spiral that melted the Hot Rows & Append-and-Aggregate queue. Discipline: retry budgets (clients may add at most ~10% extra), exponential backoff with jitter (so retries do not arrive in synchronized waves — Cache Invalidation\'s stampede lesson), and only for idempotent operations. Past the budget, LOAD SHEDDING is kinder than queueing: a fast "try later" beats a 30-second hang, for the user and for the queue behind them.',
  };

  yield {
    state: matrixState({
      title: 'Percentile hygiene: how to not fool yourself',
      rows: [
        { id: 'avg', label: 'never average percentiles' },
        { id: 'user', label: 'measure at the user' },
        { id: 'slo', label: 'SLOs on percentiles' },
        { id: 'window', label: 'watch the window' },
      ],
      columns: [{ id: 'why', label: '' }],
      values: [[1], [2], [3], [4]],
      format: (v) => ['', 'the mean of ten servers\' p99s is not the fleet p99 — aggregate histograms, then read', 'server-side 50ms can be user-side 800ms (network, queues, redirects)', '"p99 < 200ms over 28 days" — a promise about the tail, with an error budget', 'a 1-minute p99 is noisy; a 1-day p99 hides incidents'][v],
    }),
    highlight: { active: ['avg:why'], compare: ['slo:why'] },
    explanation: 'The measurement discipline that makes any of this real. The classic blunder: averaging each server\'s p99 — percentiles do not average (a quiet server\'s 40ms p99 and a struggling server\'s 2s p99 do not make a 1s fleet p99; merge the raw histograms, THEN read the percentile). Measure where the user is, not where your code is. And write the promise down as an SLO — "99% of requests under 200ms" — with an error budget that converts latency into an engineering currency (Distributed Tracing is how you find which hop spent it). The whole topic in one sentence: design for the distribution, not the average — because at scale, your users LIVE in the tail.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why averages lie') yield* averagesLie();
  else if (view === 'taming the tail') yield* taming();
  else throw new InputError('Pick a view.');
}

export const article = {
  sections: [
    {
      heading: `What it is`,
      paragraphs: [
        `Tail latency is the latency experienced by the slowest users — the 99th, 99.9th, or 99.99th percentile request — and it drives user experience far more than the average. A service might report an average response time of 59.5 milliseconds, yet one in every hundred requests takes a full second to respond, leaving users staring at a spinner. Averages hide tails because they are democracy among milliseconds: one slow request gets drowned out by ninety-nine fast ones, and the metric says "green" while the slowest users see nothing but delays. In large-scale systems, the tail is not a rare corner case — fan-out (waiting for multiple backends in parallel) amplifies it until "one-in-a-hundred" happens to most users on most page loads. This is why serious engineers report percentiles instead of means, write SLOs (service-level objectives) on p99 and p999, and design architectures to tame the tail.`,
        `The tail emerges from many sources: garbage-collection pauses that freeze a server, a cache miss that forces a trip to disk, retries arriving exactly when load is highest, or a noisy neighbor stealing your machine's CPU. No single fix eliminates it — tail latency is the sum of every rare event in the system. Instead, systems are engineered to mask it: duplicate requests sent in parallel (hedging), disciplined retry budgets, load shedding that rejects overload fast instead of queuing forever. Percentile hygiene — measuring at the user, aggregating histograms correctly, setting SLOs with error budgets — turns latency taming from folklore into a measurable discipline.`,
      ],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `Start by understanding latency distributions. Most requests finish fast — say, 50 milliseconds — but the distribution has a long right tail where a few requests take hundreds or thousands of milliseconds. The mean (59.5ms in our visualization) aggregates across this spread, but it masks the bad tail completely. A percentile-based view is honest: the p50 (median) tells you what a typical user sees, the p99 tells you what one user in a hundred experiences, and the p999 isolates the rarest, slowest cases. Percentiles do not average — if you have ten servers each with a p99 of 50ms, the fleet p99 is NOT 50ms. Instead, you must merge the raw latency histograms from all servers and compute the percentile across the combined data.`,
        `Fan-out amplification is the mechanic that makes the tail catastrophic. A modern page fires dozens of requests in parallel — API calls to different shards, fetch calls to CDNs, queries to different services. If each independently carries a 1% tail risk, a 20-request session hits at least one slow response with probability 1 − 0.99²⁰ = 18.2% — nearly one user in five feels a one-second hang. For fan-out to 100 backends (scatter-gather across shards), the page is slow if ANY backend is slow: probability 1 − 0.99¹⁰⁰ = 63.4%. This is the insight from Dean and Barroso's landmark paper "The Tail at Scale" (2013): at realistic fan-out, the page p99 becomes the median. The rare-at-server becomes routine-at-page.`,
        `Tail sources include GC/compaction pauses (LSM Tree background work), queue spikes (Hot Rows & Append-and-Aggregate arrivals overwhelming service), cache misses (the unlucky request that pays the origin cost), retries stacking on overload, and noisy neighbors stealing resources. These are not exotic; they appear throughout production systems. The response is not to eliminate any single source — impossible — but to mask the aggregate tail through three mechanisms: hedging (send the same request to two backends, take the faster reply), load shedding (reject overload fast instead of queueing), and retry discipline (budget retries, jitter backoff, only on idempotent ops, never let naive retries double traffic under load).`,
      ],
    },
    {
      heading: `Cost and complexity`,
      paragraphs: [
        `Tail latency has no fixed cost — it is the latency of the slowest percentile, measured in milliseconds. The COST of reducing it lies in the remedies. Hedged requests (duplicate after p95 latency, take the first reply) increase load by ~2-5% — Dean and Barroso's production number for BigTable batch reads: p999 fell from 1,800ms to 74ms for 2% extra traffic. Tied requests refine hedging by sending both in parallel but letting the first-to-start server cancel its twin — same benefit, no double-pay clause. Load shedding (rejecting requests when over capacity) costs latency for shedding decisions but eliminates the cost of infinite queueing. Retry budgets limit extra load to ~10% per client. Measuring at the user (not server) adds distributed instrumentation cost — every request path must record its end-to-end latency, not just the server's processing time. SLOs with error budgets add engineering overhead but convert latency into currency: if your SLO is "p99 < 200ms over 28 days" and you spend 50ms of that budget on a feature, you have 150ms left before you burn your error budget.`,
        `The architectural cost is higher. Scatter-gather fan-out amplifies tails, so some systems shift to asynchronous patterns: instead of waiting for all shards, fan out in waves or poll for results, accepting slightly stale answers. Hedging requires replica diversity (don't hedge the same replica twice). Retry discipline requires idempotency guarantees (see Message Queue). Distributed Tracing becomes essential — you must know which hop in a 20-hop request chain spent the tail latency, else you cannot fix it. Cache Invalidation & Versioning techniques (jittered expiry, probabilistic early refresh) prevent cache-miss storms when a popular entry expires.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Tail latency is non-negotiable in any system with users. Search engines rank by p99 because a user's page load time is determined by the slowest backend result, and a 99th-percentile slow result ruins the session. E-commerce sites prioritize tail latency because a checkout delay converts to cart abandonment. Mobile apps operate on unreliable networks with high variance, so percentile thinking is survival; a mean of 500ms is meaningless if p99 is 10 seconds. Cloud providers (AWS, Google, Azure) publish p99 and p999 latencies for storage, compute, and networking; customers build on those guarantees or face disasters. Social media feeds fan out to recommendation engines, ads services, and analytics in parallel; the page waits for all, so tail latency discipline is the difference between a snappy feed and a frustrating scroll. Payment processors and banking systems treat tail latency as a stability problem — a 10-second authorization request costs money and erodes trust. Video platforms buffer based on percentiles, not means; streaming to the p99 viewer requires a buffer that absorbs the jitter. Fraud detection systems run Naive Bayes or learned models at sub-100ms p99 to catch attacks in real time. Every large production system is haunted by tails.`,
      ],
    },
    {
      heading: `Pitfalls and misconceptions`,
      paragraphs: [
        `The cardinal mistake is trusting averages. A mean of 60ms sounds good; p99 of 1,000ms is the truth. Never report percentiles and averages together without percentiles in primary sight — humans default to averaging (the mean of my team's p99s is about 150ms), and that is a lie. Measuring at the wrong layer is a common trap: server-side latency can be 50ms while user-perceived latency is 800ms due to network round-trips, browser rendering, and queuing in front of your service. SLOs with bad windows hide incidents: a 1-minute p99 is noisy and misses slow requests that spike for 30 seconds; a 1-day p99 buries daily 3am batch jobs. Choose window granularity to match your user's perception — usually 1-hour or 1-day windows, never 1-minute.`,
        `Over-hedging is wasteful: hedging every request (not just the slow tail) raises load needlessly. Under-hedging is dangerous: if you hedge only at p99, requests at p90 stall while waiting for the slow replica. The hedging delay should be set to a low percentile of the fast path (p50 or p75), not high (p95). Naive retries are catastrophic: a retry-on-timeout policy can DOUBLE traffic exactly when the system is most overloaded (slowest is slowest), feeding the queue collapse described in Hot Rows & Append-and-Aggregate. Retries without idempotency guarantees create duplicates in the database. Finally, do not confuse percentile confidence with statistical significance: p99 < 200ms over a 1-hour window of 10 requests is noise; the same SLO over 10 million requests is signal. Measure volume alongside percentiles, and use error budgets to stay honest about tail performance over time.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `SLO Error Budget Burn Rate Alert turns percentile failures into a paging policy, Metric Label Cardinality Control explains how to keep latency metrics affordable enough to query during incidents, and PerformanceObserver Long Task Attribution shows the browser-side version of turning slow user-visible work into traceable evidence.`,
        `Read DDSketch Relative-Error Quantiles, t-digest Quantile Sketch, and KLL Quantile Sketch to understand how production systems summarize latency distributions without averaging p99s. Greenwald-Khanna Quantile Summary gives the deterministic rank-error baseline that makes the tradeoff explicit.`,
        `Tail latency emerges from distributed fan-out, so start with "Sharding & Partitioning" to understand how scatter-gather amplifies the tail. From there, "Hot Rows & Append-and-Aggregate" shows how queue buildup creates tail latencies in real time. Use "Distributed Tracing" to locate which service or network hop is burning your latency budget — you cannot fix what you cannot see. "Cache Invalidation & Versioning" teaches the refresh and expiry patterns that prevent cache-miss storms from spiking your tail. "Message Queue" discipline covers idempotency and retry budgets, the guardrails for safe hedging and retries. Finally, "LSM Tree" background compaction is a canonical tail source: understand why compaction pauses matter and how write-amplification couples to latency spikes.`,
      ],
    },
  ],
};
