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
      heading: 'What it is',
      paragraphs: [
        'Elastic Sketch is a network-measurement sketch designed around traffic skew. It splits memory into a heavy part and a light part. The heavy part stores candidate elephant flows with identities and counters. The light part summarizes the long tail of mice flows with compact sketch counters. Queries combine the two pieces to support tasks such as heavy hitter detection, heavy change detection, flow-size distribution, and entropy estimation.',
        'The design is a case study in choosing data structures that match the workload. Network traffic is not uniform: a few flows dominate, many flows are tiny, and conditions can shift during congestion or attacks. A single flat Count-Min matrix spends the same shape of memory on every flow. Elastic Sketch spends richer state on likely elephants and cheaper approximate state on the tail.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Incoming packets are classified by flow key, such as a five-tuple or source-destination pair. A hashed bucket in the heavy part may already contain the flow; if so, its counter increases. If the bucket contains another flow, the algorithm uses guard or vote logic to decide whether the resident should remain, whether the newcomer should be folded into the light part, or whether a swap should occur. Displaced or tail traffic is preserved in the light sketch.',
        'The light part is sketch-like: it keeps compact counters for flows that are not resident in the heavy part. This preserves approximate information about the long tail without storing every flow identity. The split lets the structure answer multiple measurement tasks from one shared synopsis.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Elastic Sketch targets line-rate updates under tight memory, so update work must be bounded and cache-friendly. The heavy part costs more per bucket because it stores identities and metadata; the light part is cheaper but less exact. Distributed deployment also adds a parameter-alignment cost: summaries from different switches or workers are meaningful together only when they use compatible dimensions, hashes, and interpretation rules.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A network operator detects congestion and possible scan traffic. Each switch updates an Elastic Sketch in fast memory. A collector periodically receives sketches, rolls them up, and asks several questions: which flows are heavy, which flows changed sharply, what does the flow-size distribution look like, and did entropy drop in a way that suggests concentration or attack? Heavy-part identities explain the top talkers, while the light part preserves enough tail mass to reason about distribution shifts.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'Elastic Sketch is not magic exact telemetry. It is a carefully engineered approximate synopsis. Severe actions such as blocking traffic, customer notification, or routing changes should be backed by packet samples, exact flow logs, or independent counters. Also avoid assuming one parameter setting fits every deployment. The right heavy/light split depends on traffic skew, update rate, memory budget, and the measurement tasks you care about.',
        'The heavy part can make the design look like a cache, but the goal is measurement, not serving requests. Eviction or swapping preserves measurement information by folding displaced mass into the light part, whereas a cache eviction may simply discard the object. Keep those mental models separate.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary source: Yang et al., "Elastic Sketch: Adaptive and Fast Network-wide Measurements", ACM SIGCOMM 2018: https://yangzhou1997.github.io/paper/elastic-sigcomm18.pdf and ACM page: https://dl.acm.org/doi/10.1145/3230543.3230544. Study Count-Min Sketch for the matrix-sketch baseline, Conservative Count-Min Sketch for positive-stream bias reduction, Count Sketch for signed updates, Heavy Hitters: Space-Saving Summaries for candidate retention, Hierarchical Heavy Hitters: Prefix Sketch for the prefix-level explanation layer used in network operations, and IP FIB Longest-Prefix Match Case Study for the forwarding-table side of network prefixes.',
      ],
    },
  ],
};
