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
      heading: 'Why this exists',
      paragraphs: [
        'Tail latency exists because users do not experience averages. They experience one concrete request path. A service can average 60 ms while one request in a hundred takes a full second. For the slow user, the average is irrelevant.',
        'The problem becomes larger when one user action depends on many requests. A page load can require browser work, network calls, cache lookups, database reads, service fan-out, and retries. If each component has a small slow tail, the user-facing path sees the maximum of many draws.',
        'Tail-latency thinking is the discipline of measuring the slow edge of the distribution and designing systems so rare slow paths do not dominate common user journeys.',
        {type: 'callout', text: 'The tail is where architecture leaks into user experience: one slow branch can dominate the whole request even when the average stays calm.'},
      ],
    },
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The obvious approach is to track average latency. That fails because latency distributions are usually skewed. A small number of very slow requests can hurt users while barely moving the mean.',
        'Another shortcut is to watch p99 for one service and assume the product is fine. That also fails because users experience composed latency. If a page waits on 20 services or a query waits on 100 shards, the probability of at least one slow dependency rises quickly.',
        'A third shortcut is to retry every timeout. Retries can help transient failures, but naive retries add traffic exactly when the system is overloaded, creating more queueing and a worse tail.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is max-of-many composition. If a user request waits for all dependencies, the slowest dependency sets the visible latency. The more dependencies there are, the more likely the user sees a tail event.',
        'For independent one-percent tail events, the chance of seeing at least one slow request across N calls is 1 - 0.99^N. With 20 calls, that is about 18 percent. With 100 calls, it is about 63 percent. Rare per request becomes routine per session.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/8/89/Log-normal-pdfs.png', alt: 'Log-normal distributions with long right tails', caption: 'Skewed latency distributions make rare slow observations visible instead of smoothing them into the mean. Source: Wikimedia Commons, public domain: https://commons.wikimedia.org/wiki/File:Log-normal-pdfs.png.'},
        'Tail latency is therefore both a measurement problem and an architecture problem. Percentiles tell you where the pain is. Architecture decides whether one straggler blocks everything.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A percentile is a rank statistic. p50 is the median request. p95 is slower than 95 percent of requests. p99 is slower than 99 percent. Deep percentiles need enough samples to mean anything, so request volume should be shown beside them.',
        'Fan-out amplifies the tail. A search request that queries 100 shards and waits for all of them is slow when any shard is slow. Even if each shard looks healthy alone, the user-facing request inherits the worst shard latency.',
        'Mitigations either shrink slow paths or avoid waiting on them. Hedged requests send a duplicate after a delay and use the first result. Timeouts and partial responses stop one dependency from holding the whole page. Load shedding rejects doomed work before queues explode. Retry budgets and jitter prevent retries from becoming overload multipliers.',
        'Measurement needs histograms or quantile sketches, not just averages. Fleet p99 must be computed from the combined distribution, not by averaging server p99s.',
      ],
    },
    {
      heading: 'How it works (2)',
      paragraphs: [
        'The distribution plot proves that the mean can look healthy while p99 is terrible. The slow edge is small by count but large by user pain.',
        'The session table proves the multiplication effect. A user who performs many dependent actions is much more likely to hit at least one slow request than a single request percentile suggests.',
        'The fan-out table proves the architecture version of the same math. Wait-for-all systems inherit the maximum latency of their branches. Server p99 can become a much lower user percentile once many branches are composed.',
        'The mitigation view proves that cures are tradeoffs. Hedging buys lower tail with extra load. Retry discipline protects overload. Load shedding preserves SLOs by refusing some work quickly instead of letting all work wait too long.',
        'The source table proves that tails are usually ordinary. Garbage collection, compaction, cold caches, queues, retries, and noisy neighbors are not exotic failures. Tail work is the practice of making those rare paths visible and limiting how far they propagate.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Percentiles work because they preserve distribution shape. They make the slow population visible instead of smoothing it into an average.',
        'Hedging works when slow replicas are not perfectly correlated. If one copy is delayed by a local queue, another replica may answer quickly. The user waits only if both copies are slow, while the system pays duplicate work only on requests that pass the hedge delay.',
        'Load shedding works because queues create latency nonlinearly. Once arrival rate exceeds service capacity, waiting time grows rapidly. Rejecting some work early can keep accepted work inside its deadline.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Tail reduction usually costs extra work, less completeness, or stricter admission. Hedging adds duplicate traffic. Timeouts and partial responses may return less data. Load shedding rejects some callers so others finish on time. Instrumentation costs storage and query complexity.',
        'The hard part is setting boundaries. Hedging needs independent replicas and idempotent or read-only operations. Retries need deadlines and idempotency keys. Scatter-gather needs a timeout and a policy for missing shards. SLO windows need enough sample volume without hiding short incidents.',
        'There is also a product tradeoff. Returning a partial but fast search result may be better than a complete slow one. For payments, the same tradeoff may be unacceptable. Tail policy belongs to the product, not only the infrastructure team.',
        'Measurement has a cost too. Deep percentiles need enough observations, correct aggregation, and retention of distribution data. If the system keeps only averages, the evidence needed to debug the tail has already been thrown away.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Tail thinking matters in search, social feeds, ad serving, recommendation systems, distributed databases, checkout flows, video startup, mobile APIs, and any system that fans out to many dependencies.',
        'It also matters inside one service. Garbage collection, compaction, cold caches, queue spikes, noisy neighbors, database locks, and retry storms can all create a tail without microservices.',
        'The practical workflow is simple: measure user-visible percentiles, trace slow paths, identify fan-out and queues, then choose whether to hedge, shed, cache, split work, reduce fan-out, or change the product fallback.',
        'It is especially useful for SLO design. A promise like "99 percent of checkouts finish under 300 ms" is clearer than an average latency target because it names the user population being protected and gives the team an error budget when the tail grows.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Do not average percentiles across hosts. A fleet p99 must be computed from merged histograms or a sketch designed for quantiles. Do not show p99 without sample count. Do not measure only server handler time if the user waits on network, browser work, redirects, or retries.',
        'Do not use hedging or retries without budgets. Hedging every request can overload replicas. Retrying non-idempotent writes can duplicate work. Retrying during overload can turn a slow system into a failing one.',
        'Do not optimize p99 in one service while ignoring the composed user path. The user sees the end-to-end distribution, not the nicest internal chart.',
        'Do not make p99 the only product truth either. A tiny but severe p999 population, a regional slice, or a single high-value workflow can matter more than a global percentile that looks acceptable.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Sharding & Partitioning for scatter-gather fan-out, Hot Rows & Append-and-Aggregate for queue-driven tails, Distributed Tracing for finding which hop spent the budget, Retries, Backoff & Jitter for disciplined retry policy, and Load Shedding & Graceful Degradation for overload behavior. For measurement, study DDSketch, t-digest, KLL Quantile Sketch, Greenwald-Khanna Quantile Summary, and SLO Error Budget Burn Rate Alert.',
      ],
    },
    {
      heading: 'Learning map',
      paragraphs: [
        'Before this topic, check your prerequisites and map what is assumed, what is computed, and where this mechanism first appears in real systems.',
        'After this topic, follow each unlock topic and test whether you can explain why this mechanism unlocks it.',
        'Use the frame order to prove one invariant per frame and one cost consequence per major operation.',
      ],
    },

    {
      heading: 'Frame-by-frame checkpoints',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Pause on each state change and name exactly what data moved, which references changed, and why the move is legal.',
            'State the invariant that must remain true before the next frame starts.',
            'Track what changed in size, order, ownership, or topology for the operation you are watching.',
            'Translate the active frame into a one-line explanation as if teaching a teammate.',
          ],
        },
      ],
    },

    {
      heading: 'Micro checks',
      paragraphs: [
        {
          type: 'bullets',
          items: [
            'Can you state one operation-level invariant in one sentence?',
            'Can you derive the time cost from the frame sequence without referencing external formulas?',
            'Can you name one hidden edge case where the naive implementation fails?',
            'Can you transfer this mechanism to one system from a different domain?',
          ],
        },
      ],
    },

    {
      heading: 'Try this now',
      paragraphs: [
        'Build one counterexample input by hand and predict every animation frame before running it; compare your prediction to the trace.',
        'Use this topic as a checkpoint: if you can explain why Tail Latency & p99 Thinking moves from input to output in the animation and where it fails, you are ready for the next topic.',
      ],
    }
  ],
};
