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
        'The balls-into-bins view replays the same fixed request stream under one-choice and two-choice routing side by side. A relieved server is one that avoided load because the second sample offered a better destination. The production view adds the real wrapper: health checks, weights, stale counters, locality, and fallback behavior.',
      
        {type: 'image', src: './assets/gifs/power-of-two-choices-load-balancing.gif', alt: 'Animated walkthrough of the power of two choices load balancing visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A load balancer chooses which backend receives the next request. If too much work lands on one server, its queue grows, latency rises, and retries can spread pain to other services. If the balancer spends too much time finding the best server, routing becomes its own bottleneck.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Elasticsearch_Cluster_August_2014.png/250px-Elasticsearch_Cluster_August_2014.png', alt: 'Load balancer distributing user requests across several server groups', caption: 'Load balancing spreads incoming work across a backend pool; two-choice routing changes how the next backend is selected. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Elasticsearch_Cluster_August_2014.png.'},
        'The power of two choices exists as a middle path. It uses one extra random sample and one comparison to avoid most bad placements. The result is much closer to least-loaded behavior without scanning the whole backend pool.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'Blind random routing is the simplest approach. Pick one healthy backend uniformly and send the request there. It is fast, stateless, and cheap enough for many independent balancers.',
        'Full least-connections is the opposite approach. Read every backend count and choose the minimum. It balances well, but O(n) reads per request and shared counter freshness become expensive in large fleets.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Random routing has a collision wall. With n requests into n servers, the average load is one, but the fullest server is much larger with high probability. Tail latency follows that hot server, not the average.',
        'Full least-connections has a coordination wall. Many balancers act at the same time with stale or local counters. If everyone chases the same best-looking backend, the measurement creates a stampede.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'One random sample gives no load signal. Two random samples create a local contest, and a busy server usually loses when it is paired with a lighter one. That is enough to create negative feedback.',
        'The theorem is sharp: one random choice gives maximum load about log n / log log n, while two choices give about log log n / log 2 plus a constant. The first extra probe does most of the work; later probes have diminishing returns.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Filter to healthy and eligible backends, sample two candidates, compare their active-request counts, and route to the smaller count. Break ties randomly or with a stable rule. Increment the chosen count when the request starts and decrement it when the request finishes.',
        'Production systems add weights, zones, panic modes, and retry rules around that kernel. Larger servers should be sampled more often or compared after normalizing by capacity. Locality rules may choose a region first, then apply two choices within that subset.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The layered proof tracks how many servers have load at least i. A new request reaches layer i only if both sampled servers were already in layer i - 1. That squares the fraction of heavily loaded servers at each layer, so the heavy tail collapses quickly.',
        'This proves the negative-feedback story in probability language. The taller a queue gets, the less likely it is to be the better of two random samples. Randomness keeps coordination cheap, and the comparison stops most collisions from compounding.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The per-request selection cost is O(1): two samples and one comparison. Memory is the backend list plus counters that the balancer likely maintains anyway. Doubling the backend pool does not double routing work.',
        'The hidden cost is measurement quality. Active-request count is only a proxy for CPU, memory pressure, queueing time, or request duration. If counters are stale or request costs vary wildly, the comparison can route to the wrong server while still looking mathematically clean.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Envoy least-request balancing samples two or more hosts by default. Nginx and HAProxy document two-choice variants for large upstream pools. Client-side RPC balancers use the same pattern when they need cheap independent decisions.',
        'The method fits large pools of roughly interchangeable replicas. It is strongest under high request rates where a full scan is too expensive and blind random leaves hot servers. It can also smooth cache or shard load when combined with an affinity mechanism.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Two choices fails when the load signal is stale, misleading, or not normalized for capacity. A 30-second report and a 1-millisecond cache hit may both count as one active request. Heterogeneous machines need weights or the smallest server is overused.',
        'It is not a session-affinity algorithm. Consistent hashing, rendezvous hashing, or Maglev-style tables preserve key mapping across membership changes. Two-choice routing balances live load, so it usually sits inside or after a separate affinity decision.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Eight servers start at load 0, and 16 jobs arrive. Random routing might hit S3 four times, S5 three times, and S7 zero times, so the max load is 4 while another server is idle. That imbalance is ordinary collision behavior.',
        'With two choices, suppose job 1 samples S2 and S5 and picks S2. Job 2 samples S3 and S8 and picks S3. Job 3 samples S2 at load 1 and S6 at load 0, so it picks S6.',
        'The feedback appears once a server gets tall. If job 5 samples S3 at load 2 and S1 at load 0, S1 wins. After 16 jobs, the typical max is 2 or 3 rather than 4 or 5 because tall servers keep losing local comparisons.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Azar, Broder, Karlin, and Upfal, Balanced Allocations, STOC 1994 and SIAM Journal on Computing 1999; Mitzenmacher, The Power of Two Choices in Randomized Load Balancing, 2001. Production references include Envoy least-request load balancing and Nginx documentation on two-choice routing.',
        'Study next: Queue for the state being balanced, Consistent Hashing and Rendezvous Hashing for affinity, Circuit Breakers and Load Shedding for overload protection, and Tail Latency for the behavior this technique is trying to improve.',
      ],
    },
  ],
};
