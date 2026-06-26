// Elastic Sketch: a network telemetry sketch that separates elephant and mice flows.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'elastic-sketch-network-telemetry-case-study',
  title: 'Elastic Sketch Network Telemetry Case Study',
  category: 'Systems',
  summary: 'A production sketch design for high-speed traffic measurement: keep elephant flows in a heavy part and summarize mice in a light sketch.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['heavy light split', 'traffic surge case study'], defaultValue: 'heavy light split' },
  ],
  run,
};

function labelMatrix(title, rows, columns, labelsByRow) {
  const labels = [''];
  const codes = new Map([['', 0]]);
  const code = (label) => {
    if (!codes.has(label)) {
      codes.set(label, labels.length);
      labels.push(label);
    }
    return codes.get(label);
  };
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function splitGraph(title) {
  return graphState({
    nodes: [
      { id: 'pkt', label: 'packet', x: 0.6, y: 3.5, note: 'flow key' },
      { id: 'hash', label: 'hash', x: 2.1, y: 3.5, note: 'bucket' },
      { id: 'heavy', label: 'heavy', x: 4.0, y: 2.2, note: 'elephants' },
      { id: 'guard', label: 'guard', x: 4.0, y: 4.8, note: 'vote' },
      { id: 'light', label: 'light', x: 6.2, y: 4.8, note: 'mice sketch' },
      { id: 'query', label: 'query', x: 8.6, y: 3.5, note: 'combine' },
    ],
    edges: [
      { id: 'e-pkt-hash', from: 'pkt', to: 'hash', weight: '' },
      { id: 'e-hash-heavy', from: 'hash', to: 'heavy', weight: '' },
      { id: 'e-hash-guard', from: 'hash', to: 'guard', weight: '' },
      { id: 'e-guard-light', from: 'guard', to: 'light', weight: '' },
      { id: 'e-heavy-query', from: 'heavy', to: 'query', weight: '' },
      { id: 'e-light-query', from: 'light', to: 'query', weight: '' },
    ],
  }, { title });
}

function measurementGraph(title) {
  return graphState({
    nodes: [
      { id: 'switch', label: 'switch', x: 0.7, y: 3.5, note: 'line rate' },
      { id: 'elastic', label: 'elastic', x: 2.8, y: 3.5, note: 'SRAM' },
      { id: 'collector', label: 'collect', x: 4.9, y: 3.5, note: 'merge' },
      { id: 'tasks', label: 'tasks', x: 7.0, y: 2.5, note: 'HH/card/entropy' },
      { id: 'ops', label: 'ops', x: 8.9, y: 3.5, note: 'mitigate' },
    ],
    edges: [
      { id: 'e-switch-elastic', from: 'switch', to: 'elastic', weight: '' },
      { id: 'e-elastic-collector', from: 'elastic', to: 'collector', weight: '' },
      { id: 'e-collector-tasks', from: 'collector', to: 'tasks', weight: '' },
      { id: 'e-tasks-ops', from: 'tasks', to: 'ops', weight: '' },
    ],
  }, { title });
}

function* heavyLightSplit() {
  yield {
    state: splitGraph('Elastic Sketch separates elephants from mice'),
    highlight: { active: ['pkt', 'hash', 'heavy', 'light'], found: ['query'] },
    explanation: 'Network traffic is skewed. A few elephant flows carry much of the bytes, while many mice flows appear briefly. Elastic Sketch exploits that shape with a heavy part for likely elephants and a light sketch for the long tail.',
    invariant: 'Do not spend the same memory shape on elephants and mice if the workload is not symmetric.',
  };

  yield {
    state: labelMatrix(
      'Heavy part buckets',
      [
        { id: 'b0', label: 'bucket 0' },
        { id: 'b1', label: 'bucket 1' },
        { id: 'b2', label: 'bucket 2' },
        { id: 'b3', label: 'bucket 3' },
      ],
      [
        { id: 'flow', label: 'flow' },
        { id: 'count', label: 'count' },
        { id: 'vote', label: 'vote' },
      ],
      [
        ['10.4.7.9:443', '91k', 'locked'],
        ['203.0.113.8:53', '44k', 'strong'],
        ['empty', '0', '-'],
        ['198.51.100.2:80', '17k', 'weak'],
      ],
    ),
    highlight: { active: ['b0:count', 'b1:count'], compare: ['b3:vote'] },
    explanation: 'The heavy part stores flow identities with counters. It behaves more like a guarded candidate table than a pure matrix. Strong elephant flows stay resident; weak buckets can be displaced as traffic changes.',
  };

  yield {
    state: labelMatrix(
      'Light part sketch',
      [
        { id: 'r0', label: 'row 0' },
        { id: 'r1', label: 'row 1' },
        { id: 'r2', label: 'row 2' },
      ],
      [
        { id: 'c0', label: '0' },
        { id: 'c1', label: '1' },
        { id: 'c2', label: '2' },
        { id: 'c3', label: '3' },
      ],
      [
        ['4k', '8k', '1k', '2k'],
        ['5k', '6k', '1k', '3k'],
        ['3k', '7k', '2k', '2k'],
      ],
    ),
    highlight: { active: ['r0:c1', 'r1:c1', 'r2:c1'] },
    explanation: 'The light part summarizes mice flows without storing their identities in every cell. When a flow is not resident in the heavy part, the light part still provides an approximate estimate and distribution signal.',
  };

  yield {
    state: splitGraph('Eviction moves displaced mass into the light part'),
    highlight: { active: ['guard', 'light', 'e-guard-light'], compare: ['heavy'], found: ['query'] },
    explanation: 'When a bucket collision shows the newcomer is becoming more important, the heavy part can swap or evict. Displaced traffic is not thrown away; it is folded into the light sketch so frequency and distribution estimates remain usable.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'flow rank', min: 1, max: 100 }, y: { label: 'bytes', min: 0, max: 100 } },
      series: [
        { id: 'traffic', label: 'flow size curve', points: [{ x: 1, y: 95 }, { x: 3, y: 72 }, { x: 10, y: 35 }, { x: 30, y: 10 }, { x: 100, y: 2 }] },
        { id: 'split', label: 'heavy cutoff', points: [{ x: 10, y: 0 }, { x: 10, y: 100 }] },
      ],
      markers: [
        { id: 'ele', x: 3, y: 72, label: 'elephants' },
        { id: 'mice', x: 55, y: 5, label: 'mice' },
      ],
    }),
    highlight: { active: ['traffic', 'split', 'ele'], compare: ['mice'] },
    explanation: 'The design fits a Zipf-like traffic curve: reserve identity-bearing space for the head of the distribution and use compact approximate counters for the tail. This is why the page belongs after Count-Min, Count Sketch, and Heavy Hitters.',
  };
}

function* trafficSurgeCaseStudy() {
  yield {
    state: measurementGraph('Case study: a switch must measure during a traffic surge'),
    highlight: { active: ['switch', 'elastic', 'collector'], found: ['tasks'] },
    explanation: 'During congestion, scan attacks, or DDoS, measurement becomes more important exactly when traffic is hardest to measure. Elastic Sketch was proposed for high-speed network-wide measurements where line-rate updates, memory limits, and multiple measurement tasks all matter.',
  };

  yield {
    state: labelMatrix(
      'Measurement tasks from one sketch',
      [
        { id: 'hh', label: 'heavy hitters' },
        { id: 'hc', label: 'heavy change' },
        { id: 'fsd', label: 'flow size dist' },
        { id: 'ent', label: 'entropy' },
      ],
      [
        { id: 'heavy', label: 'heavy part' },
        { id: 'light', label: 'light part' },
        { id: 'use', label: 'use' },
      ],
      [
        ['flow ids', 'tail counts', 'top talkers'],
        ['stable head', 'delta tail', 'incident diff'],
        ['large flows', 'mice mass', 'capacity view'],
        ['head mass', 'tail spread', 'anomaly'],
      ],
    ),
    highlight: { active: ['hh:heavy', 'fsd:light'], found: ['ent:use'] },
    explanation: 'The case-study value is generality. A single sketch layout can feed multiple network-measurement tasks instead of deploying a separate specialized sketch for every question.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'a', label: 'switch A', x: 0.9, y: 2.0, note: 'Elastic' },
        { id: 'b', label: 'switch B', x: 0.9, y: 5.0, note: 'Elastic' },
        { id: 'align', label: 'align', x: 3.1, y: 3.5, note: 'params' },
        { id: 'merge', label: 'merge', x: 5.4, y: 3.5, note: 'collector' },
        { id: 'global', label: 'global', x: 7.7, y: 3.5, note: 'network view' },
      ],
      edges: [
        { id: 'e-a-align', from: 'a', to: 'align', weight: '' },
        { id: 'e-b-align', from: 'b', to: 'align', weight: '' },
        { id: 'e-align-merge', from: 'align', to: 'merge', weight: '' },
        { id: 'e-merge-global', from: 'merge', to: 'global', weight: '' },
      ],
    }, { title: 'Network-wide rollup needs aligned sketch parameters' }),
    highlight: { active: ['align', 'merge'], found: ['global'] },
    explanation: 'As with other sketches, distributed use requires aligned parameters and hash choices. The collector can roll up summaries only if the sketches mean the same thing. Otherwise, merged telemetry is just a pile of incompatible counters.',
  };

  yield {
    state: labelMatrix(
      'Design checklist',
      [
        { id: 'rate', label: 'line rate' },
        { id: 'memory', label: 'SRAM' },
        { id: 'tasks', label: 'tasks' },
        { id: 'action', label: 'action' },
      ],
      [
        { id: 'question', label: 'question' },
        { id: 'check', label: 'check' },
      ],
      [
        ['updates cheap?', 'bounded probes'],
        ['head/tail split?', 'fit hardware'],
        ['one or many?', 'shared sketch'],
        ['safe enough?', 'verify before block'],
      ],
    ),
    highlight: { found: ['rate:check', 'memory:check', 'action:check'] },
    explanation: 'The safe operational pattern repeats: use the sketch to detect and explain, then verify before destructive mitigation. The more severe the action, the more exact evidence you need behind the approximate signal.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'heavy light split') yield* heavyLightSplit();
  else if (view === 'traffic surge case study') yield* trafficSurgeCaseStudy();
  else throw new InputError('Pick an Elastic Sketch view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the heavy table as identity-preserving memory and the light sketch as approximate tail memory. Active means a packet update is being placed, visited means a flow has touched a bucket or counter, and found means a query has enough evidence to answer a heavy-hitter or tail question.',
        'The safe inference rule is workload skew. If a few flows carry much of the traffic, keep names for those flows and use approximate counters for the long tail. If that skew disappears, the split loses power.',
        {type:'callout', text:'Elastic Sketch works because the memory layout follows traffic skew: keep identity for elephants and approximate the long tail instead of treating every flow alike.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Network telemetry is measurement about packets, flows, rates, and changes. Operators need it during congestion, attacks, and outages. The hard part is measuring at line rate with limited fast memory on switches or packet-processing hosts.',
        'A full flow table stores every flow key and exact counters, but real networks can create millions of short-lived flows. A sketch is a compact approximate data structure, but a flat sketch hides the names of important flows. Elastic Sketch exists because traffic often has a heavy head and a long tail.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is exact accounting. Store every five-tuple flow key and count packets or bytes. This gives clean answers when the table fits.',
        'Another approach is a Count-Min style sketch. Hash each flow into several counter arrays and estimate counts from those counters. This bounds memory, but collisions make flow identity and distribution questions harder.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The exact table wall is memory and update rate. If an attack creates 10,000,000 one-packet flows, exact state can exceed fast memory and churn caches. The data plane cannot run a slow allocation path per packet.',
        'The flat sketch wall is lost identity. A huge flow that collides with small flows can distort tail estimates, while the sketch alone may not name the top talkers. Operators need both identity for elephants and aggregate signal for mice.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split memory into a heavy part and a light part. The heavy part stores candidate elephant flow keys with counters and guard state. The light part stores approximate counters for displaced flows and the long tail.',
        'The invariant is role alignment. A flow that repeatedly proves large should keep an identity-bearing slot. A weak or displaced flow should still contribute mass to the light sketch so aggregate measurements remain useful.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'For each packet, the switch extracts a flow key and weight, such as one packet or 1,500 bytes. A hash sends the key to a heavy bucket. If the bucket is empty or already holds that flow, the heavy counter is updated.',
        'If the bucket holds a different flow, guard logic decides whether the resident should stay. A newcomer that cannot displace the resident updates the light sketch. If the newcomer becomes strong enough, the resident can be evicted and its mass folded into the light part.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works when traffic is skewed. Elephant flows revisit their buckets often enough to survive guard logic. Mice flows are numerous and individually small, so approximate counters can represent their aggregate mass without naming each one.',
        'It also reduces collision damage. Large resident flows are not constantly polluting anonymous counters, so the light part has a better chance of representing the tail. Queries combine heavy identity and light estimates instead of asking one structure to do both jobs.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Update cost must be bounded per packet. A typical update performs a small number of hashes, bucket checks, guard updates, and counter writes. It cannot search a long list because packets arrive at line rate.',
        'Memory is a budget split. If a switch has 1 MB for telemetry and spends 256 KB on the heavy part, those bytes retain identities but reduce light-sketch width. Doubling the heavy table can reduce churn for elephants, but it also reduces tail accuracy if total memory is fixed.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Elastic Sketch fits heavy-hitter detection, heavy-change detection, flow-size distribution, entropy shifts, DDoS triage, and network-wide aggregation. These tasks need fast approximate evidence before a slower exact capture is available.',
        'It is useful in switches, software datapaths, and telemetry collectors where updates must be cheap. The output should guide investigation, mitigation, and sampling. It should not be treated as perfect accounting.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when traffic has no useful heavy head. If many flows have similar size, the heavy table churns and the heavy-light split loses its advantage. A different sketch or more exact sampling may fit better.',
        'It also fails when keys or epochs are wrong. Source IP, five-tuple, tenant, service, and prefix keys answer different questions. Distributed merging requires compatible hash seeds, dimensions, time windows, and packet-versus-byte semantics.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'A switch sees 1,000,000 packets in one second. Flow A sends 300,000 packets, flow B sends 120,000, and 200,000 other flows send about three packets each. The heavy part should retain A and B by name while the light part tracks the tail mass.',
        'With a flat sketch, A can collide with tail flows and inflate their estimates. With Elastic Sketch, A stays in the heavy table, so tail counters receive less elephant pollution. An operator can name A and B, then still see that the tail widened during the incident.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Yang et al., "Elastic Sketch: Adaptive and Fast Network-wide Measurements", ACM SIGCOMM 2018, https://yangzhou1997.github.io/paper/elastic-sigcomm18.pdf and https://dl.acm.org/doi/10.1145/3230543.3230544. Read it for the heavy-light split and the network-wide query model.',
        'Study Count-Min Sketch, Conservative Count-Min Sketch, Count Sketch, Heavy Hitters Space-Saving Summaries, Hierarchical Heavy Hitters, IP FIB Longest-Prefix Match, and BGP Route Selection to connect approximate telemetry with network operations. The sketch topics explain error; the network topics explain actionability.',
      ],
    },
  ],
};
