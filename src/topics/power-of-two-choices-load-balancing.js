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
      heading: 'The problem',
      paragraphs: [
        'A load balancer has to make a small decision many times per second: which healthy backend should receive the next request? If it sends too much work to one backend, that backend builds a queue, latency rises, retries appear, and tail behavior gets worse for users who did nothing unusual. If the balancer spends too much effort finding the perfect backend, the selection logic itself becomes a bottleneck.',
        'Power of two choices is a deliberately modest rule. Sample two eligible backends, compare their load signals, and send the request to the less loaded one. The rule does not try to know the whole fleet. It uses one extra random sample to avoid many bad placements, which is exactly the kind of tradeoff that shows up in scalable systems: spend a tiny amount of information to avoid a large amount of coordination.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The simplest approach is random routing. Pick one healthy backend uniformly and send the request. It is fast, decentralized, and needs no shared counter. Its problem is variance. Randomness can keep hitting an already busy backend while quieter backends are available. Over many requests the average may look fine, but the tallest queue can still become painfully tall.',
        'The opposite approach is full least-connections. Inspect every backend, choose the one with the smallest active-request count, and route there. This can work well for small pools or when a centralized balancer already owns accurate counters. In large proxy fleets, however, full scans require many counter reads, shared state, or a hot data structure. The better systems question is not always "which backend is globally best?" Sometimes it is "can I cheaply avoid an obviously bad one?"',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is concurrency and partial truth. Many load-balancer workers may route requests at the same time. Their counters may be local, delayed, sampled, or updated after a request is already in flight. If every worker chases the same globally best-looking backend, stale state can create a stampede. If no worker looks at load at all, random placement creates avoidable hot spots.',
        'The load signal is also imperfect. Active requests, active connections, queue depth, outstanding bytes, CPU, and latency all describe different parts of load. A one-second request and a one-minute stream may both count as one active request. The algorithm must remain useful even when its measurements are proxies rather than truth.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'One random sample gives no live load signal. Two random samples plus one comparison gives just enough signal to reject many bad placements. The dramatic result from the balls-into-bins analysis is that, for n balls into n bins, one random choice gives a maximum-load scale around log n / log log n, while two choices reduce the scale to about log log n. The second choice is the big jump.',
        'In systems terms, one extra counter read buys a large reduction in queue skew. The rule does not need perfect fairness to improve tail behavior. It only needs to make a tall queue unlikely to receive more work unless the other sampled queue is also tall. That negative feedback is absent in pure random routing.',
      ],
    },
    {
      heading: 'What the visualization shows',
      paragraphs: [
        'The two-sampled-queues view shows the single-request decision. The request samples two hosts, reads their active counts, and chooses the shorter queue. The comparison node is the whole algorithm: not a full scan, not blind random placement, just enough feedback to avoid one visibly worse candidate.',
        'The balls-into-bins view compares the same fixed request stream under one choice and two choices. The exact toy numbers are less important than the pattern: blind placement lets one server accumulate a taller pile, while two choices spread load by repeatedly rejecting locally worse placements. The production-caveats view then shows why health, weights, stale counters, locality, and fallback behavior have to wrap the simple core.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'The basic algorithm is short. Filter the backend set to eligible hosts. Sample two candidates according to the desired distribution. Read a load signal for each candidate, commonly active requests or active connections. Choose the lower-load candidate. Break ties randomly, round-robin locally, or by a stable rule. Update counters when the request starts and finishes.',
        'Production implementations add layers around this core. Health checking removes bad hosts before sampling. Weights make larger or more capable hosts appear more often or compare more favorably. Locality routing may restrict the candidate set to a region or zone before the two choices happen. Retries should avoid sending repeated attempts to the same failed host. Panic modes or fail-open modes define what happens when too few healthy hosts remain.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose six servers have active-request counts [4, 2, 3, 1, 2, 2]. A pure random rule might pick server 1 again, raising the tallest queue from 4 to 5. Full least-connections would scan all six and choose server 4 with count 1. Power of two choices might sample server 1 and server 4, compare 4 with 1, and choose server 4. It got the same decision as the full scan in this request with only two reads.',
        'It will not always find the global minimum. If it samples servers with counts 3 and 2, it chooses 2 even though another server has count 1. That is acceptable. The goal is not perfect placement; the goal is to keep obvious hot spots from repeatedly winning. Over many requests, that local rejection rule sharply reduces the tallest queues.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The proof intuition is a feedback loop. A backend that is already loaded can still receive work, but only if both sampled candidates are also loaded or if the loaded backend wins a tie. As a queue grows taller, it becomes less likely to be the better of two random samples. The algorithm creates pressure against the tall tail without coordinating the entire fleet.',
        'It also reduces herd behavior. Full least-connections can make many workers converge on the same backend if they share stale information about the current minimum. Random pairs spread comparisons across the pool. Each worker makes a small local decision, and the aggregate effect is smoother than blind random placement without requiring a single global coordinator.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Selection cost is O(1): two samples and one comparison. Memory is the backend list plus whatever counters or signals the balancer already maintains. Doubling the backend pool does not increase per-request selection work. That is why the rule is attractive inside high-throughput proxies, service meshes, and client-side RPC balancers.',
        'The hidden cost is signal quality. Active-request count is a proxy, not a direct measure of CPU, memory pressure, downstream blocking, or response time. Weighted pools need weighted sampling or weighted comparison. Long-lived requests can pin counts. Very small pools get less statistical benefit. Observability should report not only average distribution but also tail queue depth, retries, outlier hosts, and how often candidate samples are unhealthy or tied.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'Power of two choices wins in large pools of roughly interchangeable replicas where full scans are expensive and blind random placement is too noisy. It is a good fit for reverse proxies, service meshes, RPC clients, stateless web services, and internal workers where many independent balancer instances need cheap local decisions.',
        'It is especially useful under high request rates. Each balancer can make a decision without synchronizing with every other balancer. The system gets most of the practical value of least-connections while avoiding the per-request cost and coordination pressure of a fleet-wide minimum search.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It is not magic fairness. Stale counters, unlucky samples, small pools, unequal request durations, and heterogeneous backends can still create skew. A cache hit, a database-blocked request, and a long stream may all count as one active request unless the signal is richer. If the signal does not match true load, the comparison can prefer the wrong host.',
        'It is also not an affinity or placement algorithm. Consistent hashing, rendezvous hashing, jump consistent hashing, and Maglev-style tables preserve key or connection mapping across membership changes. Power of two choices balances live load after the eligible candidate set is defined. In many systems, affinity chooses the candidate subset and two choices balances within it.',
      ],
    },
    {
      heading: 'Failure modes to test',
      paragraphs: [
        'Test stale counters, delayed decrement on request finish, health-check races, retry storms, very long requests, weighted hosts, zone-local routing, small backend pools, host flapping, and panic conditions where most hosts are unhealthy. A good test should show both distribution and tail behavior, not only average requests per host.',
        'Also test observability. Operators need to know which two candidates were sampled often enough to debug, how ties were broken, whether weights were applied, how many requests hit unhealthy fallback paths, and whether a few hosts carry a disproportionate number of long-running requests. Without these measurements, the algorithm can look balanced while user latency is not.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources for this topic include the Balanced Allocations paper by Azar, Broder, Karlin, and Upfal at https://homes.cs.washington.edu/~karlin/papers/AzarBKU99.pdf, Mitzenmacher survey material at https://www.eecs.harvard.edu/~michaelm/postscripts/handbook2001.pdf, Envoy least-request load-balancer documentation at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers, F5 NGINX discussion at https://www.f5.com/company/blog/nginx/nginx-power-of-two-choices-load-balancing-algorithm, and HAProxy discussion at https://www.haproxy.com/blog/power-of-two-load-balancing.',
        'Good next topics are Tail Latency, Queue, Rate Limiter, Circuit Breakers, Retries with Jitter, Consistent Hashing, Rendezvous Hashing HRW, Maglev Load Balancer Case Study, SLO-Aware LLM Request Router, Load Shedding and Graceful Degradation, and Work Stealing Deque Scheduler.',
      ],
    },
  ],
};
