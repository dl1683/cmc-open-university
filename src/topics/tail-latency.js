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
    explanation: `The plot shows why average latency is a weak safety signal. Most requests are fast, but one percent take a full second. The mean lands around 59.5 ms, which sounds healthy, while the slow users still waited 1,000 ms. With a single request the chance of hitting the 1% tail is ${(slowShare(1) * 100).toFixed(1)}%. Latency distributions are skewed, so the question is not "what is the average request?" but "how bad are the slow requests, and how often do real users hit them?" Percentiles answer that directly.`,
    invariant: `Means hide tails: a metric that averages a spinner with 99 fast clicks reports a fast click.`,
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
    explanation: `Now switch from requests to sessions. This table shows ${SESSIONS.length} session sizes: ${SESSIONS.join(', ')} requests. A page view may involve ${SESSIONS[2]} independent requests. If each has a 1% chance of hitting the tail, the chance that the user sees at least one slow response is 1 - 0.99^${SESSIONS[2]}, or ${(slowShare(SESSIONS[2]) * 100).toFixed(1)}%. A heavy session with ${SESSIONS[3]} requests hits the tail ${(slowShare(SESSIONS[3]) * 100).toFixed(1)}% of the time. p99 per request is not p99 per user experience once a user depends on many requests.`,
    invariant: `P(user hits the tail) = 1 − (1 − p)^n: rare per request becomes routine per session. With ${SESSIONS[3]} requests the chance is ${(slowShare(SESSIONS[3]) * 100).toFixed(1)}%.`,
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
    explanation: `Fan-out makes the same math architectural. This table covers ${FANOUT.length} fan-out levels: ${FANOUT.join(', ')}. If a search request waits for ${FANOUT[3]} shards, the page is slow when any shard is slow. With a 1% tail per shard, the page sees a tail about ${(slowShare(FANOUT[3]) * 100).toFixed(0)}% of the time. That is the tail-at-scale lesson: independently healthy backends can compose into a slow user experience when the frontend waits for the maximum of ${FANOUT[3]} latencies.`,
    invariant: `Wait-for-all fan-out: the page inherits the WORST of N draws — at fan-out ${FANOUT[3]} the tail probability is ${(slowShare(FANOUT[3]) * 100).toFixed(1)}%.`,
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
    explanation: `The source list is deliberately ordinary: GC pauses, compaction, queue spikes, cache misses, retries, and noisy neighbors. Across a ${FANOUT[3]}-shard fan-out the tail probability reaches ${(slowShare(FANOUT[3]) * 100).toFixed(1)}%. Tails are not one bug hiding in one service. They are the union of rare slow paths across the stack. You reduce them by shortening slow paths, avoiding queues, and masking stragglers; you do not permanently eliminate every rare event.`,
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
    explanation: `Hedging is controlled duplication. Send the request once; if it has not returned by a chosen delay, send a second copy to another replica and use the first answer. With two independent replicas each having a 1% tail, the chance both are slow is only ${(0.01 * 0.01 * 100).toFixed(2)}%. You pay extra load only on slow cases, and the user waits only if both copies are slow. This works when replicas fail independently and the operation is safe to duplicate. It is a tail tool, not a license to double every request.`,
    invariant: `Hedging trades a few percent of duplicate load for the product of two independent tail probabilities: ${(slowShare(1) * 100).toFixed(1)}% per replica becomes ${(0.01 * 0.01 * 100).toFixed(2)}% for both.`,
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
    explanation: `Retries can help a transient packet loss and hurt an overloaded service. If naive retries double traffic during overload, a ${(slowShare(1) * 100).toFixed(0)}%-tail service can cascade into failure. A useful retry has a deadline, a small budget, jittered backoff, and idempotency. A naive retry-on-timeout policy adds traffic exactly when queues are already too long. Once the system is past capacity, load shedding is often kinder: reject quickly instead of letting callers wait for work that cannot finish in time.`,
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
      format: (v) => ['', 'the mean of ten servers\'s p99s is not the fleet p99 — aggregate histograms, then read', 'server-side 50ms can be user-side 800ms (network, queues, redirects)', '"p99 < 200ms over 28 days" — a promise about the tail, with an error budget', 'a 1-minute p99 is noisy; a 1-day p99 hides incidents'][v],
    }),
    highlight: { active: ['avg:why'], compare: ['slo:why'] },
    explanation: `Good percentile work starts with measurement hygiene. Do not average server p99s; merge the histograms or sketches and compute the fleet percentile from the combined distribution. Remember: even a single request has a ${(slowShare(1) * 100).toFixed(1)}% chance of hitting the tail. Measure user-visible latency, not only handler time. Then turn the target into an SLO, such as "99% under 200ms," so latency has an error budget and incidents have evidence. Distributed tracing tells you which hop spent that budget.`,
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'why averages lie') yield* averagesLie();
  else if (view === 'taming the tail') yield* taming();
  else throw new InputError('Pick a view.');
}

const legacyArticle = {
  sections: [
    {
      heading: `Why this exists`,
      paragraphs: [
        `Tail latency is the slow end of the latency distribution: p95, p99, p999, and beyond. It matters because users do not experience your average; they experience one concrete request path. A service can average 60ms while one request in a hundred takes a full second. If each page depends on many requests, that "rare" second becomes common for users.`,
        `This topic exists because large systems compose latencies by waiting for many things at once. A fan-out request waits on the slowest shard. A browser waits on the slowest critical resource. A checkout waits on the slowest required service. Tail work is therefore part measurement, part architecture: measure percentiles correctly, then design so stragglers do not dominate the whole user path.`,
      ],
    },
    {
      heading: `How to read the animation`,
      paragraphs: [
        `In the averages view, do not follow the peak of the distribution; follow the right edge. The mean marker shows why averages can look fine, while the p99 marker shows what the slowest real users feel. The session and fan-out tables then multiply the same one-percent tail across many requests. The invariant is max-of-many latency: when a page waits for every dependency, one slow draw can set the whole user experience.`,
        `In the taming view, each row is a different way to change either the distribution or the composition rule. Hedging duplicates only slow cases, retries need budgets and jitter, and shedding rejects doomed work before it becomes tail work. The hygiene table explains how to read the measurements: aggregate histograms before percentiles, measure at the user, and attach SLOs to the tail rather than the average.`,
      
        {type: 'image', src: './assets/gifs/tail-latency.gif', alt: 'Animated walkthrough of the tail latency visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: `How it works`,
      paragraphs: [
        `The animation first shows a skewed distribution: 99 percent of requests finish near 50ms, and one percent take 1,000ms. The mean barely moves, so an average-based dashboard can look healthy while a real slice of users waits. Percentiles are rank questions: p50 is the median request, p99 is the request slower than 99 percent of the sample, and p999 is deeper tail evidence.`,
        `Then the animation multiplies tail risk by session size and fan-out. If a user action requires 20 independent requests, the chance of at least one p99 event is 1 - 0.99^20. If a backend query waits for 100 shards, it inherits the maximum of 100 draws. This is why scatter-gather systems care about p99 even when each shard looks fine by itself.`,
        `Mitigations change either the distribution or the composition rule. Hedging sends a duplicate after a delay and takes the faster answer, reducing straggler impact when duplicate work is safe. Load shedding rejects overload before queues turn all requests into tail requests. Retry discipline prevents clients from creating a new tail with synchronized retries. Distributed tracing and histogram sketches make the slow path visible enough to improve.`,
      ],
    },
    {
      heading: `Cost and behavior`,
      paragraphs: [
        `Tail reduction usually costs extra work, less completeness, or stricter admission. Hedging adds duplicate traffic. Timeouts and partial responses may return less data. Load shedding rejects some callers so others finish on time. Retry budgets trade some availability during blips for protection during overload. Instrumentation costs storage and query complexity because you need histograms or quantile sketches, not just averages.`,
        `The hard part is setting boundaries. Hedging needs independent replicas and idempotent or read-only operations. Retries need deadlines and idempotency keys. Scatter-gather needs a timeout and a policy for missing shards. SLO windows need enough sample volume to mean something without hiding short incidents. Tail work is engineering with constraints, not just lowering a number on a dashboard.`,
      ],
    },
    {
      heading: `Real-world uses`,
      paragraphs: [
        `Search, social feeds, ad serving, recommendation systems, and distributed databases all face fan-out tails because one user request waits on many backends. E-commerce and payments care because slow checkout becomes lost revenue or duplicate attempts. Mobile and video systems care because network variance dominates the user path. Cloud services publish percentile latencies because downstream systems compose those guarantees into their own SLOs.`,
        `The same thinking applies inside a single service. A thread pool queue, garbage collector, compaction job, cold cache path, or overloaded database connection pool can create a tail even without microservices. If the user waits on it, it belongs in the latency distribution.`,
      ],
    },
    {
      heading: `Where it fails`,
      paragraphs: [
        `Do not average percentiles across hosts. A fleet p99 must be computed from the combined distribution, or from a sketch designed for that purpose. Do not measure only server handler time if the user waits on network, queueing, browser work, redirects, or retries. Do not trust p99 from tiny samples. Always show request volume next to deep percentiles.`,
        `Also be careful with the cures. Hedging every request can overload replicas. Retrying non-idempotent writes can duplicate work. Cutting fan-out by returning partial answers may be the right product choice, but it should be explicit. A tail-latency plan is credible only when it names the slow path, the duplicate-work budget, the timeout, and the user-visible fallback.`,
      ],
    },
    {
      heading: `Study next`,
      paragraphs: [
        `Read Sharding & Partitioning for scatter-gather fan-out, Hot Rows & Append-and-Aggregate for queue-driven tails, and Distributed Tracing for finding which hop spent the budget. Retries, Backoff & Jitter and Load Shedding & Graceful Degradation are the overload companions.`,
        `For measurement, study DDSketch Relative-Error Quantiles, t-digest Quantile Sketch, KLL Quantile Sketch, and Greenwald-Khanna Quantile Summary. SLO Error Budget Burn Rate Alert turns percentile misses into an operational paging policy.`,
      ],
    },
      {
      heading: 'The wall',
      paragraphs: [
        'The wall is using average latency as a proxy for user experience.',
        '98 successful requests at 80ms and 2 slow requests at 1,200ms yields an excellent average, but users still hit a painful 99th-percentile response.',
        'Tail-aware systems optimize for p95/p99 by capping queue depth, controlling slow paths, and setting hard deadlines on optional work.',
      ],
    },

    {
      heading: 'Worked example',
      paragraphs: [
        'Service A: auth 10ms, profile 15ms, recommender 300ms worst-case.',
        'Most requests complete in ~50ms, but occasional lock contention adds 300ms; user-visible p99 becomes ~350ms while mean stays deceptively low.',
        'Tail control: isolate the contender path, add fallback values, and protect the fast path with concurrency limits and timeouts.',
      ],
    },
],
};

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the distribution by its right edge, not by its center. The mean marker shows what an average reports; the p99 marker shows what the slowest one percent of requests experience.',
        'The session and fan-out frames apply the same formula to different systems. If a user waits for many calls, one slow call can set the visible latency for the whole action.',
        {
          type: 'callout',
          text: 'The tail is where architecture leaks into user experience: one slow branch can dominate the whole request even when the average stays calm.',
        },
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Tail latency is the slow end of a latency distribution. p95, p99, and p999 are percentiles, meaning rank positions after all request times are ordered.',
        'This exists because users experience one concrete request path, not the average of all requests. A service can average 60 ms while one request in 100 takes 1,000 ms.',
        {
          type: 'image',
          src: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Log-normal-pdfs.png',
          alt: 'Log-normal distributions with long right tails',
          caption: 'Skewed latency distributions make rare slow observations visible instead of smoothing them into the mean. Source: Wikimedia Commons, public domain: https://commons.wikimedia.org/wiki/File:Log-normal-pdfs.png.',
        },
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to watch average latency. It is easy to compute, easy to graph, and useful when distributions are tight.',
        'Latency distributions in real systems are often skewed. A few slow requests can barely move the mean while still hurting real users.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is max-of-many composition. A page load, search query, or checkout often waits for several independent pieces of work.',
        'If any required branch is slow, the whole user action is slow. A one-percent tail per component is no longer rare when a user action depends on many components.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use rank statistics and composition math. The chance of at least one slow request across N independent calls is 1 - (1 - p)^N, where p is the per-call tail probability.',
        'With p = 0.01 and N = 20, the chance is 1 - 0.99^20 = 18.2 percent. Rare per request becomes common per user action.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Measurement starts with histograms or quantile sketches, not averages. Fleet p99 must come from the combined distribution, not from averaging host p99 values.',
        'Mitigation changes either the distribution or the waiting rule. Hedging duplicates only slow requests, timeouts stop unbounded waiting, partial responses avoid wait-for-all behavior, and load shedding rejects excess work before queues grow.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Percentiles work because they keep the slow population visible. A p99 target says 99 percent of requests must finish below a threshold, which directly names the protected user group.',
        'Hedging works when slow replicas are not perfectly correlated. If each replica has a one-percent slow tail, the chance that two independent copies are both slow is 0.01 * 0.01 = 0.0001, or 0.01 percent.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Tail reduction spends resources. Hedging adds duplicate traffic, tracing adds storage and analysis cost, and load shedding rejects some work to protect the rest.',
        'The cost also changes product behavior. A partial search result may be acceptable after 200 ms, while a partial payment result is usually not acceptable at all.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Search, ads, databases, microservice APIs, CDNs, payments, and mobile apps all care about tail latency because user actions fan out across many dependencies. The technique is strongest when the product has a clear latency promise.',
        'SLOs often use tail targets such as 99 percent under 300 ms. That turns latency into an error budget and makes incidents measurable.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when percentiles are computed incorrectly. Averaging server p99 values, hiding sample count, or measuring only server handler time can make the dashboard lie.',
        'It also fails when cures are applied blindly. Retrying non-idempotent writes can duplicate work, and hedging every request can overload replicas.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a backend request has p99 = 1,000 ms and the other 99 percent finish near 50 ms. A page that waits on 20 such calls has a chance of at least one tail event equal to 1 - 0.99^20 = 18.2 percent.',
        'For a 100-shard scatter-gather query, the chance is 1 - 0.99^100 = 63.4 percent. If hedging sends a duplicate only after a delay and the two replicas are independent, the chance both copies are slow is 0.01 percent, but the system pays extra traffic on hedged calls.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study Dean and Barroso, The Tail at Scale, plus service-level objective guidance from Google SRE. Next study distributed tracing, t-digest, DDSketch, load shedding, retries with jitter, and sharding fan-out.',
      ],
    },
  ],
};
