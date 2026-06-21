// Power of two choices: sample two backends and route to the less loaded one.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'power-of-two-choices-load-balancing',
  title: 'Power of Two Choices Load Balancing',
  category: 'Systems',
  summary: 'A randomized load-balancing primer: compare two sampled backends, choose the less loaded one, and get most of least-connections without scanning the fleet.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['two sampled queues', 'balls into bins', 'production caveats'], defaultValue: 'two sampled queues' },
  ],
  run,
};

function labelMatrix(title, rowLabels, columnLabels, labelsByRow) {
  const labels = [''];
  const byLabel = new Map();
  const code = (label) => {
    if (!byLabel.has(label)) {
      byLabel.set(label, labels.length);
      labels.push(label);
    }
    return byLabel.get(label);
  };
  return matrixState({
    title,
    rows: rowLabels.map(([id, label]) => ({ id, label })),
    columns: columnLabels.map(([id, label]) => ({ id, label })),
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

const REQUESTS = [
  { one: 0, pair: [0, 1] },
  { one: 0, pair: [0, 2] },
  { one: 1, pair: [1, 3] },
  { one: 0, pair: [0, 4] },
  { one: 2, pair: [2, 5] },
  { one: 0, pair: [0, 1] },
  { one: 3, pair: [3, 4] },
  { one: 0, pair: [0, 5] },
  { one: 4, pair: [4, 2] },
  { one: 0, pair: [0, 3] },
  { one: 5, pair: [5, 1] },
  { one: 0, pair: [0, 4] },
];

function simulate(limit) {
  const randomLoads = Array(6).fill(0);
  const twoLoads = Array(6).fill(0);
  const steps = [];

  for (let index = 0; index < limit; index += 1) {
    const request = REQUESTS[index];
    randomLoads[request.one] += 1;
    const [a, b] = request.pair;
    const chosen = twoLoads[a] <= twoLoads[b] ? a : b;
    twoLoads[chosen] += 1;
    steps.push({
      request,
      chosen,
      randomLoads: [...randomLoads],
      twoLoads: [...twoLoads],
    });
  }

  return {
    randomLoads,
    twoLoads,
    steps,
    randomMax: Math.max(...randomLoads),
    twoMax: Math.max(...twoLoads),
  };
}

function loadRows(result) {
  return Array.from({ length: 6 }, (_, index) => [
    `s${index}`,
    `S${index + 1}`,
    String(result.randomLoads[index]),
    String(result.twoLoads[index]),
    result.twoLoads[index] < result.randomLoads[index] ? 'relieved' : result.twoLoads[index] > result.randomLoads[index] ? 'more' : 'same',
  ]);
}

function* twoSampledQueues() {
  yield {
    state: graphState({
      nodes: [
        { id: 'req', label: 'request', x: 0.8, y: 4.0, note: 'new work' },
        { id: 'rng', label: 'sample', x: 2.5, y: 4.0, note: '2 hosts' },
        { id: 's1', label: 'S1', x: 4.6, y: 2.7, note: '4 active' },
        { id: 's4', label: 'S4', x: 4.6, y: 5.3, note: '1 active' },
        { id: 'pick', label: 'choose S4', x: 7.1, y: 4.0, note: 'less loaded' },
      ],
      edges: [
        { id: 'e-req-rng', from: 'req', to: 'rng' },
        { id: 'e-rng-s1', from: 'rng', to: 's1', weight: 'sample' },
        { id: 'e-rng-s4', from: 'rng', to: 's4', weight: 'sample' },
        { id: 'e-s4-pick', from: 's4', to: 'pick', weight: 'min' },
      ],
    }, { title: 'Sample two, choose the shorter queue' }),
    highlight: { active: ['s1', 's4'], found: ['s4', 'pick'], compare: ['s1'] },
    explanation: 'Power of two choices samples two available backends and sends the request to whichever has fewer active requests. It is the smallest useful amount of load information: one random choice ignores queues, while two choices usually avoid an already-busy server.',
    invariant: 'Two local measurements beat one blind random decision by a large margin.',
  };

  yield {
    state: labelMatrix(
      'Decision table for one request',
      [
        ['sampleA', 'sample A'],
        ['sampleB', 'sample B'],
        ['winner', 'winner'],
        ['cost', 'work'],
      ],
      [
        ['value', 'observed value'],
        ['reason', 'reason'],
      ],
      [
        ['S1 has 4 active', 'candidate'],
        ['S4 has 1 active', 'candidate'],
        ['S4', 'shorter queue'],
        ['2 counters read', 'not full scan'],
      ],
    ),
    highlight: { active: ['sampleA:value', 'sampleB:value'], found: ['winner:value'], compare: ['cost:value'] },
    explanation: 'The algorithm does not need a perfect global answer. It only needs enough signal to avoid obvious bad placements. That matters when the backend set is large or many load balancer workers are making decisions in parallel.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'servers', min: 10, max: 100000 }, y: { label: 'counters read/request', min: 0, max: 100 } },
      series: [
        { id: 'full', label: 'least-connections full scan', points: [{ x: 10, y: 10 }, { x: 100, y: 40 }, { x: 1000, y: 70 }, { x: 100000, y: 100 }] },
        { id: 'p2c', label: 'power of two choices', points: [{ x: 10, y: 2 }, { x: 100, y: 2 }, { x: 1000, y: 2 }, { x: 100000, y: 2 }] },
        { id: 'rr', label: 'round-robin', points: [{ x: 10, y: 0.5 }, { x: 100, y: 0.5 }, { x: 1000, y: 0.5 }, { x: 100000, y: 0.5 }] },
      ],
    }),
    highlight: { found: ['p2c'], compare: ['full'], active: ['rr'] },
    explanation: 'Full least-connections can be more exact, but it reads many counters or maintains a shared data structure. Power of two choices keeps selection O(1), which is why it is attractive inside high-throughput proxies and service meshes.',
  };
}

function* ballsIntoBins() {
  for (const checkpoint of [3, 6, 9, 12]) {
    const result = simulate(checkpoint);
    const rows = loadRows(result);
    yield {
      state: labelMatrix(
        `After ${checkpoint} requests`,
        rows.map(([id, label]) => [id, label]),
        [
          ['random', 'one choice'],
          ['two', 'two choices'],
          ['effect', 'effect'],
        ],
        rows.map(([, , random, two, effect]) => [random, two, effect]),
      ),
      highlight: {
        active: rows.filter((row) => row[4] === 'relieved').map((row) => `${row[0]}:effect`),
        found: rows.filter((row) => row[4] === 'same').map((row) => `${row[0]}:effect`),
        compare: rows.filter((row) => row[3] === String(result.twoMax)).map((row) => `${row[0]}:two`),
        removed: rows.filter((row) => row[2] === String(result.randomMax)).map((row) => `${row[0]}:random`),
      },
      explanation: `This deterministic toy stream compares blind one-choice placement with two choices. After ${checkpoint} requests, one-choice peak load is ${result.randomMax}; two-choice peak load is ${result.twoMax}. The full theorem is stronger than the toy: for n balls into n bins, two choices cuts the maximum-load scale from about log n / log log n to about log log n.`,
      invariant: checkpoint === 12 ? 'A tiny amount of live feedback prevents the tallest queue from getting much taller.' : undefined,
    };
  }

  yield {
    state: labelMatrix(
      'Why the theorem feels surprising',
      [
        ['one', 'one random choice'],
        ['two', 'two choices'],
        ['three', 'three+ choices'],
      ],
      [
        ['signal', 'signal'],
        ['maxload', 'max load scale'],
        ['extra', 'extra benefit'],
      ],
      [
        ['none', 'log n / log log n', 'baseline'],
        ['one comparison', 'log log n', 'huge drop'],
        ['more comparisons', 'constant-factor', 'smaller gain'],
      ],
    ),
    highlight: { found: ['two:signal', 'two:maxload'], compare: ['one:maxload'], active: ['three:extra'] },
    explanation: 'The second sample is the dramatic part. It usually finds at least one not-awful queue. More samples help, but the biggest jump in quality comes from moving from one blind choice to two informed choices.',
  };
}

function* productionCaveats() {
  yield {
    state: labelMatrix(
      'Real balancer choices',
      [
        ['rr', 'round-robin'],
        ['lc', 'least-connections'],
        ['p2c', 'two choices'],
        ['maglev', 'Maglev table'],
      ],
      [
        ['state', 'state read'],
        ['strength', 'strength'],
        ['risk', 'risk'],
      ],
      [
        ['counter', 'simple', 'blind to work'],
        ['all counters', 'accurate', 'coordination cost'],
        ['2 counters', 'cheap feedback', 'sample noise'],
        ['table slot', 'packet speed', 'rebuilds'],
      ],
    ),
    highlight: { found: ['p2c:state', 'p2c:strength'], compare: ['lc:state', 'rr:risk'] },
    explanation: 'Power of two choices is a middle path. It is much more load-aware than round-robin or random, but it avoids scanning every backend on every request. That is the same systems instinct as sampling, sketching, and probabilistic data structures: spend a tiny amount of information to avoid a large amount of work.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'lb1', label: 'LB1', x: 0.8, y: 3.0, note: 'worker' },
        { id: 'lb2', label: 'LB2', x: 0.8, y: 5.0, note: 'worker' },
        { id: 's1', label: 'S1', x: 3.1, y: 2.2, note: 'hot' },
        { id: 's2', label: 'S2', x: 3.1, y: 4.0, note: 'ok' },
        { id: 's3', label: 'S3', x: 3.1, y: 5.8, note: 'ok' },
        { id: 'feedback', label: 'counters', x: 5.8, y: 4.0, note: 'stale' },
        { id: 'choice', label: 'sample', x: 7.8, y: 4.0, note: 'bounded' },
      ],
      edges: [
        { id: 'e-lb1-s1', from: 'lb1', to: 's1' },
        { id: 'e-lb1-s2', from: 'lb1', to: 's2' },
        { id: 'e-lb2-s2', from: 'lb2', to: 's2' },
        { id: 'e-lb2-s3', from: 'lb2', to: 's3' },
        { id: 'e-s1-feedback', from: 's1', to: 'feedback' },
        { id: 'e-s2-feedback', from: 's2', to: 'feedback' },
        { id: 'e-s3-feedback', from: 's3', to: 'feedback' },
        { id: 'e-feedback-choice', from: 'feedback', to: 'choice' },
      ],
    }, { title: 'Distributed workers have partial load truth' }),
    highlight: { active: ['lb1', 'lb2'], compare: ['feedback'], found: ['choice'] },
    explanation: 'In real proxies, many workers choose backends at the same time. Their counters can be delayed or local. Random sampling reduces herd behavior: not every worker chases the same globally best-looking backend.',
  };

  yield {
    state: labelMatrix(
      'Implementation checklist',
      [
        ['health', 'health first'],
        ['weights', 'weights'],
        ['long', 'long requests'],
        ['stats', 'observability'],
        ['fallback', 'fallback'],
      ],
      [
        ['rule', 'rule'],
        ['why', 'why'],
      ],
      [
        ['sample healthy hosts', 'avoid dead picks'],
        ['bias by capacity', 'big hosts take more'],
        ['count active work', 'requests are unequal'],
        ['watch p99 and skew', 'mean hides pain'],
        ['shed when full', 'routing is not capacity'],
      ],
    ),
    highlight: { active: ['health:rule', 'long:rule'], found: ['stats:why'], compare: ['fallback:rule'] },
    explanation: 'The algorithm is not the whole balancer. You still need health checks, capacity weights, connection draining, overload behavior, and metrics. Power of two choices is the selection rule inside a larger reliability system.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'two sampled queues') yield* twoSampledQueues();
  else if (view === 'balls into bins') yield* ballsIntoBins();
  else if (view === 'production caveats') yield* productionCaveats();
  else throw new InputError('Pick a power-of-two-choices view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The two-sampled-queues view shows one routing decision. A request arrives, the balancer samples two backends, reads their active-request counts, and sends the request to the shorter queue. Green highlights mark the chosen server; blue marks the rejected candidate. The comparison node is the entire algorithm: not a full scan, not blind random, just one comparison between two random samples.',
        {type: 'callout', text: 'Two choices add one comparison, but they create negative feedback: a busy server becomes less likely to receive the next request.'},
        'The balls-into-bins view replays the same fixed request stream under one-choice (blind random) and two-choice routing side by side. Watch the "effect" column: "relieved" means two choices placed fewer jobs on that server than random did. The production-caveats view adds the operational wrapper: health checks, weights, stale counters, zone locality, and fallback behavior that surround the simple core in any real deployment.',
      
        {type: 'image', src: './assets/gifs/power-of-two-choices-load-balancing.gif', alt: 'Animated walkthrough of the power of two choices load balancing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A load balancer makes the same small decision thousands of times per second: which backend gets the next request? Send too much work to one server and its queue grows, latency rises, retries cascade, and tail behavior degrades for bystander requests. Spend too much effort finding the globally optimal server and the selection logic itself becomes a bottleneck.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Elasticsearch_Cluster_August_2014.png/250px-Elasticsearch_Cluster_August_2014.png', alt: 'Load balancer distributing user requests across several server groups', caption: 'Load balancing spreads incoming work across a backend pool; two-choice routing changes how the next backend is selected. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Elasticsearch_Cluster_August_2014.png.'},
        'In 1994, Azar, Broder, Karlin, and Upfal proved a startling result about balls into bins (published at STOC 1994, journal version in SIAM J. Computing 1999). If you throw n balls into n bins by picking one bin uniformly at random, the fullest bin holds about log n / log log n balls with high probability. If instead you pick two bins at random and place the ball in the less full one, the maximum drops to log log n / log 2 + O(1). One extra probe produces an exponential improvement in the worst-case load. Mitzenmacher independently developed the same result in his 1996 PhD thesis and later wrote the definitive survey, "The Power of Two Choices in Randomized Load Balancing" (2001). The idea is now a standard building block in production load balancers.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Random assignment is the simplest option. Pick one healthy backend uniformly at random and route the request. It is fast, stateless, decentralized, and needs no shared counter. The average load per server is perfect: n/n = 1 ball per bin. The problem is variance. By the birthday-paradox family of arguments, some bins collect about log n / log log n balls. With 1,000 servers that worst case is roughly 4-5 times the average, which means one server is handling several times the work of the luckiest server.',
        'The opposite extreme is full least-connections. Read every backend\'s active-request count, pick the minimum, and route there. This produces near-perfect balance but requires O(n) counter reads per request or a shared, continuously updated data structure. In large proxy fleets with many independent load-balancer workers, that coordination cost becomes a real bottleneck. The question is whether there is a middle path: more aware than random, cheaper than a full scan.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Random assignment hits a hard probabilistic wall: max load of Theta(log n / log log n) with high probability. No amount of tuning changes this. The birthday paradox guarantees collisions; some servers will be hammered while others sit idle. For latency-sensitive services, the worst-loaded server sets the tail latency.',
        'Full least-connections hits a different wall: concurrency and partial truth. Many load-balancer workers route requests simultaneously. Their counters may be local, delayed, or updated after a request is already in flight. If every worker chases the same globally best-looking backend based on stale information, they create a thundering-herd stampede onto that server. The load signal itself is imperfect: a one-second API call and a one-minute streaming connection may both count as one active request. The algorithm must remain useful even when its measurements are proxies, not truth.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'One random sample gives zero load signal. Two random samples plus one comparison gives just enough signal to reject most bad placements. The Azar-Broder-Karlin-Upfal theorem says this precisely: for n balls into n bins, one random choice gives max load Theta(log n / log log n); two choices gives max load log log n / log d + O(1) where d = 2 is the number of choices. That is an exponential improvement from a single extra probe.',
        'The intuition is that even weak load information breaks symmetry. A tall queue can still receive work, but only if both sampled candidates are also tall or if the tall queue wins a tie. As a queue grows, the probability that it is the better of two random samples shrinks. This creates self-correcting negative feedback: the taller a queue gets, the harder it is for that queue to attract more work. That feedback loop is entirely absent in pure random routing.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The algorithm is short. (1) Filter the backend set to healthy, eligible hosts. (2) Sample two candidates uniformly at random. (3) Read a load signal for each, typically active requests or active connections. (4) Route to the candidate with the lower load. (5) Break ties randomly or round-robin. (6) Increment the chosen server\'s counter; decrement it when the request completes.',
        'Production implementations layer additional concerns around this core. Health checking removes bad hosts before sampling. Capacity weights make larger servers appear more often in the sample or compare more favorably. Locality routing restricts the candidate pool to a region or availability zone before the two choices happen. Retry logic avoids re-sending to the same failed host. Panic or fail-open modes define behavior when too few healthy hosts remain. The two-choice selection is the routing kernel inside a larger reliability system.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The formal proof uses a layered potential argument. Define layers: layer i contains all bins with load at least i. As you place balls with two choices, the number of bins in layer i shrinks doubly-exponentially with i, because a ball only lands in layer i if both sampled bins are already in layer i-1. The probability of both samples being heavily loaded drops fast, which is why the maximum load is log log n instead of log n / log log n.',
        'The result has a surprising diminishing-returns property. Going from d = 1 choice to d = 2 choices produces an exponential improvement. Going from d = 2 to d = 3 gives only a constant-factor improvement (log log n / log 3 vs. log log n / log 2). The first extra probe is the dramatic one. Mitzenmacher calls this "the power of two choices" precisely because the jump from one to two is where almost all the gain lives. More probes help, but the cost-benefit ratio drops sharply.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Selection cost is O(1) per request: two random samples and one comparison, regardless of pool size. Memory is the backend list plus one counter per server, which the balancer already maintains. Doubling the backend pool adds zero per-request selection work. Network cost is two extra counter reads (or local memory reads) compared to blind random. This is why the rule is attractive inside high-throughput proxies, service meshes, and client-side RPC balancers where millions of routing decisions happen per second.',
        'The hidden cost is signal quality. Active-request count is a proxy for load, not a direct measure of CPU, memory pressure, or response time. Weighted pools require weighted sampling or weighted comparison. Long-lived requests can pin counters high for minutes. Very small pools (fewer than 5 servers) get less statistical benefit because the two samples frequently overlap or cover the whole pool. Observability should report tail queue depth, not just average requests per host, because the average can look balanced while one server drowns.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Nginx uses two-choice least-connections as a built-in upstream balancing method. Envoy\'s least-request load balancer samples two (or configurable d) hosts by default. HAProxy documents the technique as an alternative to full least-connections for large backend pools. gRPC client-side load balancing in several implementations uses two-choice or pick-first-of-two internally. Memcached consistent-hashing rings sometimes add a two-choice probe to smooth hot-key imbalance.',
        'The pattern fits whenever the backend pool is large, replicas are roughly interchangeable, and full scans are expensive or coordination-heavy. It is especially valuable under high request rates where each load-balancer worker must decide independently without synchronizing with every other worker. The system gets most of the practical value of least-connections while paying O(1) instead of O(n) per decision.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Stale counters degrade the comparison. If the load signal is delayed by even a few hundred milliseconds under high request rates, both candidates may look equally light when one is actually overloaded. Heterogeneous servers break the uniform-random assumption: a 2-core machine and a 64-core machine should not be sampled with equal probability unless weights compensate. Requests with wildly different durations (a 1ms cache hit vs. a 30s report generation) make active-request count a poor proxy for actual server stress.',
        'The technique is not an affinity or placement algorithm. Consistent hashing, rendezvous hashing, and Maglev-style tables preserve key-to-server mapping across membership changes. Power of two choices balances live load but does not preserve session affinity, cache locality, or connection mapping. In many systems, affinity logic selects the candidate subset and two-choice balancing operates within it. Diminishing returns also matter: going from d = 2 to d = 3 barely helps, so tuning the sample count is rarely worth the complexity.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Eight servers, labeled S1 through S8, start empty. Sixteen jobs arrive. Under random assignment, each job picks one server uniformly. After 16 jobs into 8 servers, the birthday paradox predicts a max load around 4-5. Suppose the random sequence hits S3 four times and S7 zero times: max load is 4, min load is 0.',
        'Under two-choice, each job samples two servers and picks the less loaded one. Job 1 samples S2 (load 0) and S5 (load 0), ties broken randomly, say S2. Job 2 samples S3 (load 0) and S8 (load 0), picks S3. Job 3 samples S2 (load 1) and S6 (load 0), picks S6. Job 4 samples S3 (load 1) and S2 (load 1), tie, picks S3. Job 5 samples S3 (load 2) and S1 (load 0), picks S1. Already the feedback is visible: S3 reached load 2 and immediately became less attractive. After all 16 jobs, two-choice typically produces a max load of 2-3 instead of 4-5. The invariant holds: the taller a queue gets, the harder it is for that queue to win a comparison.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'The foundational paper is "Balanced Allocations" by Azar, Broder, Karlin, and Upfal (STOC 1994; SIAM J. Computing 29(1), 1999). Mitzenmacher\'s PhD thesis (1996, UC Berkeley) independently developed the analysis for dynamic settings. His survey "The Power of Two Choices in Randomized Load Balancing" (2001) is the standard reference and is available at https://www.eecs.harvard.edu/~michaelm/postscripts/handbook2001.pdf. For production implementations, see the Envoy least-request balancer documentation at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers and the Nginx two-choice discussion at https://www.f5.com/company/blog/nginx/nginx-power-of-two-choices-load-balancing-algorithm.',
        'Study next by role. Prerequisites: Queue (the data structure being balanced), Hash Table (uniform hashing foundation). Extensions: Consistent Hashing and Rendezvous Hashing HRW (affinity-preserving placement), Maglev Load Balancer Case Study (production ring-based balancing). Production concerns: Rate Limiter and Circuit Breakers (overload protection), Load Shedding and Graceful Degradation (what happens when routing alone is not enough), Tail Latency (what two-choice is ultimately optimizing). Contrasting alternatives: Work Stealing Deque Scheduler (pull-based instead of push-based balancing), SLO-Aware LLM Request Router (load balancing with heterogeneous request costs).',
      ],
    },
  ],
};
