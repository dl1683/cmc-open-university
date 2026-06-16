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
      heading: 'What it is',
      paragraphs: [
        'Power of two choices is a randomized load-balancing rule. For each request, choose two candidate backends at random, inspect their current load, and send the request to the less loaded one. It is a small change from random placement, but the effect is large: one random choice can keep hitting an already-busy server, while two choices usually include at least one reasonable alternative.',
        'The idea comes from the balls-into-bins literature. Throwing n balls independently into n bins produces a maximum load around log n / log log n with high probability. If every ball gets two random bins and goes to the less loaded one, the maximum-load scale falls to about log log n. In systems language, one extra counter read buys an outsized reduction in queue imbalance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The balancer maintains or observes a load signal for each backend, often active requests or active connections. On arrival, it samples two healthy backends. If one has fewer active requests, it wins; if tied, break the tie randomly or by a stable local rule. The selection cost stays constant because the balancer reads two counters, not every backend counter.',
        'This is different from full least-connections. Full least-connections tries to find the global minimum, which can require scanning the fleet, coordinating shared counters, or maintaining a heap. Power of two choices accepts a local comparison. The local answer is not always globally best, but it is good enough often enough to keep the tallest queues from growing unchecked.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Selection is O(1): two samples and one comparison. The memory cost is the backend list plus whatever load counters the balancer already needs. The operational cost is freshness. In a distributed proxy, workers may have local or delayed views of active requests. That can sound bad, but random sampling is partly why the algorithm works well under imperfect information: it avoids every worker stampeding toward the same single best-looking backend.',
        'There are still caveats. If requests have wildly different durations, active-request count is only a proxy for work. If servers have different capacity, the sampling or comparison must account for weights. If a backend is unhealthy, it should not be sampled. If the whole fleet is overloaded, routing cannot create capacity; Load Shedding and Backpressure decide what happens next.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'Consider an Envoy or service-mesh cluster with hundreds of identical application replicas. A full least-request scan per HTTP request would be expensive, especially when many workers route concurrently. Envoy documents an O(1) least-request strategy for equal weights: sample N hosts, two by default, and choose the one with the fewest active requests. That is power of two choices in production form.',
        'The same logic appears in HAProxy and NGINX discussions of random-two load balancing. It is especially useful when backends change quickly and load balancer instances have incomplete views. The goal is not perfect fairness per request. The goal is to make it unlikely that a busy backend keeps receiving new work while quieter backends are available.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Do not confuse power of two choices with magic fairness. It can still make unlucky choices, especially in small pools or with stale counters. It also does not understand request cost unless the load signal represents cost. A streaming request, a cache hit, and a five-second export may all count as one active request even though their impact is different. SLO-Aware LLM Request Router extends the idea by adding prefix/KV locality, SLO class, policy gates, and fallback to the selection score.',
        'Do not use it as a substitute for placement algorithms. Consistent Hashing, Jump Consistent Hash, Rendezvous Hashing, and Maglev preserve affinity across membership changes. Power of two choices balances live load. If a cache must keep a key on the same backend, you need a placement rule first and a load-balancing rule around it only where movement is allowed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Mitzenmacher survey at https://www.eecs.harvard.edu/~michaelm/postscripts/handbook2001.pdf, Balanced Allocations by Azar, Broder, Karlin, and Upfal at https://homes.cs.washington.edu/~karlin/papers/AzarBKU99.pdf, Envoy least-request documentation at https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers, F5/NGINX discussion at https://www.f5.com/company/blog/nginx/nginx-power-of-two-choices-load-balancing-algorithm, and HAProxy discussion at https://www.haproxy.com/blog/power-of-two-load-balancing. Study Load Balancer first, then Tail Latency & p99 Thinking, Load Shedding & Graceful Degradation, Maglev Load Balancer Case Study, Consistent Hashing, Jump Consistent Hash Case Study, Rendezvous Hashing (HRW), SLO-Aware LLM Request Router, and Queue.',
      ],
    },
  ],
};
