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
      heading: 'Why this exists',
      paragraphs: [
        'Network operators need measurements while the network is busy, degraded, or under attack. They want to know which flows are heavy, which flows changed, whether traffic entropy shifted, and how the flow-size distribution looks across switches. The hard part is that measurement must happen at packet speed with limited fast memory.',
        'A full flow log is too expensive for the data plane. A pure matrix sketch is compact, but it hides the identities of important flows behind hashed counters. Elastic Sketch exists because real traffic is skewed. A few elephant flows carry much of the byte volume, while many mice flows appear briefly and contribute mostly through aggregate tail mass.',
        'The design spends rich state where identity matters and cheap approximate state where aggregate signal is enough. That is the educational point: the data structure follows the workload shape instead of pretending every flow deserves the same representation.',
        {type:'callout', text:'Elastic Sketch works because the memory layout follows traffic skew: keep identity for elephants and approximate the long tail instead of treating every flow alike.'},
      ],
    },
    {
      heading: 'The naive baselines and their wall',
      paragraphs: [
        'The first baseline is an exact flow table. Store every five-tuple or flow key with counters, update it for every packet, and query the table during incidents. This gives beautiful answers when the table fits. It fails when line-rate traffic creates too many short-lived flows, when SRAM is limited, or when attack traffic intentionally expands the key set.',
        'The second baseline is a flat Count-Min or Count Sketch style matrix. That gives bounded memory and predictable update cost, but it treats elephants and mice as anonymous updates into the same counter grid. Heavy-hitter questions then need extra machinery to recover names, and tail-distribution questions can be distorted by a few large colliding flows.',
        'The wall is that network measurement tasks are mixed. Heavy hitters need identities. Flow-size distribution and entropy need the tail. Heavy change detection needs continuity across intervals. Network-wide aggregation needs compatible summaries from many devices. A single exact table or a single anonymous sketch makes one of those tasks awkward.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Split the synopsis into a heavy part and a light part. The heavy part stores candidate elephant flow identities with counters and guard metadata. The light part stores compact approximate counters for displaced flows and the long tail. Query logic combines them.',
        'This is not just a memory optimization. It is a semantic split. Elephant flows are worth naming because operators may route, rate-limit, debug, or sample them directly. Mice flows are often too numerous to name individually at line rate, but their aggregate mass still reveals scans, DDoS shape, entropy changes, and capacity pressure.',
        'Elastic Sketch is "elastic" because flows can move between these roles as traffic changes. A resident heavy flow can stay. A weak resident can lose its slot. Displaced mass is not discarded; it is folded into the light part so the global measurement remains useful.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Each packet is reduced to a flow key and a weight such as packet count or byte count. A hash maps the key to a heavy bucket. If the bucket already holds that flow, the heavy counter increases. If the bucket is empty, the flow can be installed as a candidate elephant.',
        'If the bucket holds a different flow, the sketch uses guard or vote logic to decide whether the resident is still strong enough to keep identity. A newcomer that does not displace the resident contributes to the light part. If the newcomer becomes more important, the resident can be swapped or evicted, and the displaced mass is inserted into the light sketch.',
        'The light part behaves like a compact sketch over the tail. It does not store every flow identity in every cell. It keeps approximate counter evidence so a query for a nonresident flow can still estimate frequency and so distribution tasks can account for the mass outside the heavy table.',
        'At query time, a resident flow can be answered mainly from the heavy part. A nonresident flow is estimated from the light part. For network-wide measurements, collectors combine summaries from multiple switches or workers, but only when dimensions, hash choices, epochs, and interpretation rules are aligned.',
      ],
    },
    {
      heading: 'What the visual shows',
      paragraphs: [
        'The heavy-light split view shows two memory roles. The packet enters through a flow-key hash. Large, repeated flows try to stay in identity-bearing heavy buckets. Weak or displaced traffic moves through guard logic into the light sketch. The query side joins both answers because neither part is sufficient alone.',
        'The traffic-surge case study shows the operational loop. Switches update sketches at line rate, collectors merge compatible summaries, analysis tasks ask heavy-hitter, heavy-change, flow-size, and entropy questions, and operators use the result to investigate or mitigate. The sketch is evidence under pressure, not perfect accounting.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works when traffic has a heavy head and a long tail. Elephant flows return often enough to win identity slots. Mice flows are numerous but individually small, so approximate counters preserve enough information without spending a full table entry per flow.',
        'The split also reduces collision damage. A huge flow that stays in the heavy part is not constantly polluting the anonymous tail counters. Tail flows still collide with one another, but the largest head flows are represented explicitly. That improves heavy-hitter accuracy and helps distribution estimates because the head and tail can be treated separately.',
        'The guard mechanism matters because traffic changes. A static top-k table can become stale during a surge. Elastic replacement lets the synopsis adapt when a new elephant appears, while the light part keeps displaced contribution visible enough for later queries.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The heavy part is more expensive than the light part because it stores flow identities, counters, and guard state. The light part is cheaper but approximate. The memory budget is therefore a policy choice: too small a heavy part churns under ordinary skew; too large a heavy part wastes scarce fast memory on flows that could have remained anonymous.',
        'Update cost must be bounded. A switch cannot run a long search per packet. Hashes, bucket probes, guard updates, and light-sketch writes need predictable work. That constraint shapes the algorithm as much as the mathematical error model.',
        'Distributed use has its own cost. To roll up telemetry, devices must agree on hash seeds, sketch dimensions, epochs, key normalization, counter semantics, and byte-versus-packet interpretation. A collector cannot safely merge summaries that were built with incompatible parameters.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Elastic Sketch fails when the workload does not have a useful heavy head. If many flows have similar size, the heavy table can churn and the head-tail split loses much of its advantage. In that case a different sketch or more exact sampling path may fit better.',
        'It also fails when the flow key is wrong. Aggregating by source IP, prefix, five-tuple, tenant, service, or application label answers different operational questions. A poor key can make the sketch look accurate while hiding the actual incident boundary.',
        'Adversarial collisions are another risk. If key choice and hashing are predictable to an attacker, approximate counters can be manipulated. Keyed hashes, salt rotation, sampling, and corroborating evidence matter in hostile settings.',
        'The most serious failure is operational overreach. Approximate telemetry can identify a likely top talker or entropy drop quickly, but blocking customer traffic, paging a team, or rerouting flows should use stronger evidence when the action has high cost.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'Start from the measurement question. Heavy hitters need identity retention. Flow-size distribution needs tail mass. Heavy change needs interval alignment and deltas. Entropy needs a defensible key and enough tail visibility. Do not deploy one sketch and assume every dashboard question is equally supported.',
        'Treat the sketch as a fast triage layer. A good incident workflow records sketch parameters, collection epoch, top heavy entries, tail estimates, switch locations, packet or byte basis, and verification evidence. Verification can come from sampled packets, exact counters, flow logs, ACL counters, service metrics, or short-term higher-fidelity capture.',
        'For production, monitor the sketch itself. Track heavy-table occupancy, replacement rate, guard pressure, counter saturation, merge compatibility, dropped epochs, and query error against sampled ground truth. A sketch with no self-observation can silently drift from useful telemetry into decorative numbers.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'During a DDoS event, one rack switch sees several source prefixes sending most bytes and a long tail of one-off flows. The heavy part retains the dominant flow keys, so the collector can name the top talkers and locate the switches where they appear. The light part still records tail mass and entropy shift, so the incident is not reduced to a few named elephants.',
        'The first operator action should be explanation, not blind blocking. The sketch can say that a few flows dominate bytes, that the tail widened, or that entropy collapsed. A safer mitigation path verifies with packet samples, exact interface counters, load balancer logs, or service-level errors before installing broad deny rules.',
        'After the incident, the team should keep the sketch evidence with the timeline: epoch boundaries, parameters, heavy entries, tail estimates, mitigation decisions, and independent verification. That makes the sketch useful for tuning thresholds instead of merely producing a dramatic graph during the outage.',
      ],
    },
    {
      heading: 'Where to place it in the curriculum',
      paragraphs: [
        'Study Count-Min Sketch before this page so the light part feels familiar. Study Conservative Count-Min Sketch to understand positive-stream overcount bias. Study Count Sketch for signed updates and Heavy Hitters: Space-Saving Summaries for identity-retaining candidate logic. Elastic Sketch combines those instincts into a network telemetry design with hardware and operations constraints.',
        'Then connect it to network systems topics. IP FIB Longest-Prefix Match explains prefix-based forwarding, Hierarchical Heavy Hitters explains prefix-level incident reporting, and telemetry case studies explain how approximate signals become operational evidence. The data structure is only useful when the surrounding measurement pipeline understands its limits.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary source: Yang et al., "Elastic Sketch: Adaptive and Fast Network-wide Measurements", ACM SIGCOMM 2018, https://yangzhou1997.github.io/paper/elastic-sigcomm18.pdf and ACM page https://dl.acm.org/doi/10.1145/3230543.3230544.',
        'Study Count-Min Sketch, Conservative Count-Min Sketch, Count Sketch, Heavy Hitters: Space-Saving Summaries, Hierarchical Heavy Hitters: Prefix Sketch, IP FIB Longest-Prefix Match Case Study, BGP Route Selection RIB Case Study, and Cache Admission sketches next. The recurring question is how much identity to keep under fixed memory and high update rate.',
      ],
    },
  ],
};
