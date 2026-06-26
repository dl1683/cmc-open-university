// AI rack topology power thermal ledger: unify fabric topology, power feeds,
// thermal zones, and failure domains for placement and incident response.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'ai-rack-topology-power-thermal-ledger-case-study',
  title: 'AI Rack Topology Power Thermal Ledger',
  category: 'Systems',
  summary: 'A rack-scale operations case study: join GPU fabric topology, power feeds, cooling loops, failure domains, and placement scores into one scheduler-facing ledger.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['topology ledger', 'placement score'], defaultValue: 'topology ledger' },
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

function rackGraph(title, { degraded = false } = {}) {
  return graphState({
    nodes: [
      { id: 'g0', label: 'G0', x: 0.8, y: 1.5, note: 'GPU' },
      { id: 'g1', label: 'G1', x: 0.8, y: 5.5, note: 'GPU' },
      { id: 'sw', label: 'NVSw', x: 2.6, y: 3.5, note: degraded ? 'hot' : 'fabric' },
      { id: 'ib', label: 'IB', x: 4.1, y: 1.6, note: 'scale' },
      { id: 'pduA', label: 'PDU A', x: 4.1, y: 3.5, note: 'feed' },
      { id: 'cdu', label: 'CDU', x: 4.1, y: 5.4, note: 'cool' },
      { id: 'zone', label: 'zone', x: 6.0, y: 3.5, note: 'risk' },
      { id: 'score', label: 'score', x: 7.8, y: 3.5, note: 'place' },
      { id: 'sched', label: 'sched', x: 9.3, y: 3.5, note: 'job' },
    ],
    edges: [
      { id: 'e-g0-sw', from: 'g0', to: 'sw', weight: 'NVL' },
      { id: 'e-g1-sw', from: 'g1', to: 'sw', weight: 'NVL' },
      { id: 'e-sw-ib', from: 'sw', to: 'ib', weight: degraded ? 'slow' : 'uplink' },
      { id: 'e-g0-pduA', from: 'g0', to: 'pduA', weight: 'kW' },
      { id: 'e-g1-pduA', from: 'g1', to: 'pduA', weight: 'kW' },
      { id: 'e-g0-cdu', from: 'g0', to: 'cdu', weight: 'heat' },
      { id: 'e-g1-cdu', from: 'g1', to: 'cdu', weight: 'heat' },
      { id: 'e-ib-zone', from: 'ib', to: 'zone' },
      { id: 'e-pduA-zone', from: 'pduA', to: 'zone' },
      { id: 'e-cdu-zone', from: 'cdu', to: 'zone' },
      { id: 'e-zone-score', from: 'zone', to: 'score' },
      { id: 'e-score-sched', from: 'score', to: 'sched' },
    ],
  }, { title });
}

function placementGraph(title) {
  return graphState({
    nodes: [
      { id: 'job', label: 'job', x: 0.7, y: 3.5, note: 'needs' },
      { id: 'shape', label: 'shape', x: 2.0, y: 2.0, note: 'traffic' },
      { id: 'policy', label: 'policy', x: 2.0, y: 5.0, note: 'tenant' },
      { id: 'fabric', label: 'fabric', x: 3.8, y: 1.5, note: 'cost' },
      { id: 'power', label: 'power', x: 3.8, y: 3.5, note: 'head' },
      { id: 'thermal', label: 'thermal', x: 3.8, y: 5.5, note: 'head' },
      { id: 'score', label: 'score', x: 5.8, y: 3.5, note: 'sum' },
      { id: 'place', label: 'place', x: 7.6, y: 2.2, note: 'rank' },
      { id: 'spill', label: 'spill', x: 7.6, y: 4.8, note: 'wait' },
      { id: 'trace', label: 'trace', x: 9.2, y: 3.5, note: 'why' },
    ],
    edges: [
      { id: 'e-job-shape', from: 'job', to: 'shape' },
      { id: 'e-job-policy', from: 'job', to: 'policy' },
      { id: 'e-shape-fabric', from: 'shape', to: 'fabric' },
      { id: 'e-shape-power', from: 'shape', to: 'power' },
      { id: 'e-shape-thermal', from: 'shape', to: 'thermal' },
      { id: 'e-policy-score', from: 'policy', to: 'score' },
      { id: 'e-fabric-score', from: 'fabric', to: 'score' },
      { id: 'e-power-score', from: 'power', to: 'score' },
      { id: 'e-thermal-score', from: 'thermal', to: 'score' },
      { id: 'e-score-place', from: 'score', to: 'place' },
      { id: 'e-score-spill', from: 'score', to: 'spill' },
      { id: 'e-place-trace', from: 'place', to: 'trace' },
      { id: 'e-spill-trace', from: 'spill', to: 'trace' },
    ],
  }, { title });
}

function scorePlot() {
  return plotState({
    axes: {
      x: { label: 'rack health score', min: 0, max: 100 },
      y: { label: 'expected p99 ms', min: 0, max: 180 },
    },
    series: [
      { id: 'decode', label: 'dec', points: [
        { x: 20, y: 150 }, { x: 40, y: 105 }, { x: 60, y: 72 }, { x: 80, y: 45 }, { x: 95, y: 36 },
      ] },
      { id: 'batch', label: 'bch', points: [
        { x: 20, y: 90 }, { x: 40, y: 76 }, { x: 60, y: 64 }, { x: 80, y: 58 }, { x: 95, y: 55 },
      ] },
    ],
    markers: [
      { id: 'route', x: 80, y: 45, label: 'route' },
      { id: 'hold', x: 40, y: 105, label: 'hold' },
    ],
  });
}

function blastPlot() {
  return plotState({
    axes: {
      x: { label: 'shared dependency count', min: 0, max: 10 },
      y: { label: 'blast radius', min: 0, max: 10 },
    },
    series: [
      { id: 'spread', label: 'spr', points: [
        { x: 1, y: 1.2 }, { x: 3, y: 2.0 }, { x: 5, y: 3.2 }, { x: 8, y: 4.5 },
      ] },
      { id: 'packed', label: 'pack', points: [
        { x: 1, y: 1.5 }, { x: 3, y: 3.8 }, { x: 5, y: 6.2 }, { x: 8, y: 8.8 },
      ] },
    ],
    markers: [
      { id: 'pdu', x: 5, y: 6.2, label: 'PDU' },
    ],
  });
}

function* topologyLedger() {
  yield {
    state: rackGraph('A rack is several graphs overlaid'),
    highlight: { active: ['g0', 'g1', 'sw', 'ib', 'pduA', 'cdu', 'e-g0-sw', 'e-g0-pduA', 'e-g0-cdu'], found: ['score'] },
    explanation: 'A GPU rack is not one topology. It is a fabric graph, power-feed graph, cooling graph, maintenance graph, and tenant-policy graph over the same physical objects.',
    invariant: 'Placement should consume topology, power, thermal, and failure-domain state together.',
  };

  yield {
    state: labelMatrix(
      'Ledger dimensions',
      [
        { id: 'gpu', label: 'GPU' },
        { id: 'fabric', label: 'fabric' },
        { id: 'power', label: 'power' },
        { id: 'cool', label: 'cool' },
        { id: 'maint', label: 'maint' },
        { id: 'tenant', label: 'tenant' },
      ],
      [
        { id: 'identity', label: 'identity' },
        { id: 'state', label: 'state' },
        { id: 'why', label: 'why' },
      ],
      [
        ['serial', 'health', 'route'],
        ['link', 'error', 'collective'],
        ['feed', 'headroom', 'derate'],
        ['loop', 'temp', 'quota'],
        ['window', 'lock', 'avoid'],
        ['policy', 'allow', 'isolate'],
      ],
    ),
    highlight: { active: ['fabric:identity', 'power:state', 'cool:state', 'tenant:why'], compare: ['maint:state'] },
    explanation: 'Each dimension needs stable identity and current state. Without identity, incidents cannot be linked back to a rack. Without current state, the scheduler cannot react to degraded power, cooling, or fabric conditions.',
  };

  yield {
    state: blastPlot(),
    highlight: { active: ['packed', 'pdu'], compare: ['spread'] },
    explanation: 'Topology affects blast radius. Packing replicas onto racks that share the same PDU, CDU, ToR, or switch tray can make a small infrastructure event look like an application outage.',
  };

  yield {
    state: rackGraph('A degraded path changes the score'),
    highlight: { active: ['sw', 'ib', 'zone', 'score', 'e-sw-ib', 'e-ib-zone', 'e-zone-score'], compare: ['pduA', 'cdu'] },
    explanation: 'When a fabric path is slow, a PDU is near limit, or a cooling zone is hot, the rack score changes. The placement system should explain which dependency caused the score, not merely reject the job.',
  };
}

function* placementScore() {
  yield {
    state: placementGraph('Job shape selects which constraints matter'),
    highlight: { active: ['job', 'shape', 'fabric', 'power', 'thermal', 'e-job-shape', 'e-shape-fabric', 'e-shape-power', 'e-shape-thermal'], found: ['score'] },
    explanation: 'A tensor-parallel decode job, an MoE all-to-all job, and a background batch job stress different parts of the rack. The scoring function should start from traffic shape and thermal profile.',
  };

  yield {
    state: labelMatrix(
      'Workload fit',
      [
        { id: 'tp', label: 'TP' },
        { id: 'moe', label: 'MoE' },
        { id: 'decode', label: 'decode' },
        { id: 'prefill', label: 'prefill' },
        { id: 'batch', label: 'batch' },
      ],
      [
        { id: 'needs', label: 'needs' },
        { id: 'avoid', label: 'avoid' },
      ],
      [
        ['NVLink', 'bad path'],
        ['bisection', 'hot zone'],
        ['p99 head', 'derate'],
        ['memory BW', 'crowd'],
        ['cheap slack', 'SLO rack'],
      ],
    ),
    highlight: { active: ['tp:needs', 'moe:needs', 'decode:avoid'], compare: ['batch:needs'] },
    explanation: 'The same rack can be excellent for one workload and wrong for another. Batch work can consume slack; latency-critical decode should avoid racks with reduced thermal or power headroom.',
  };

  yield {
    state: scorePlot(),
    highlight: { active: ['decode', 'route'], compare: ['batch', 'hold'] },
    explanation: 'Health score matters more for latency-sensitive decode than for batch. The router can reserve the cleanest racks for interactive service and push elastic work into lower-scoring capacity.',
  };

  yield {
    state: placementGraph('Placement decisions need a trace'),
    highlight: { active: ['score', 'place', 'spill', 'trace', 'e-score-place', 'e-score-spill', 'e-place-trace', 'e-spill-trace'], compare: ['policy'] },
    explanation: 'Every placement or spill should leave a trace: topology match, power headroom, thermal headroom, policy gate, and fallback reason. That trace is the debugging bridge between facilities, platform, and model-serving teams.',
    invariant: 'A rack score without a reason is not operationally useful.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'topology ledger') yield* topologyLedger();
  else if (view === 'placement score') yield* placementScore();
  else throw new InputError('Pick an AI rack topology view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the topology-ledger view as several graphs over the same rack. The same GPU belongs to fabric, power, cooling, failure-domain, and tenant-policy graphs.',
      'Active nodes show the constraint under test, compare nodes show another physical constraint, and found nodes show the score passed to placement. Free GPUs are usable only when the relevant edges also pass.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/69/Wikimedia_Foundation_Servers-8055_35.jpg', alt:'Server racks in a datacenter showing dense cabling and cooling infrastructure', caption:'Server racks in a datacenter. An AI rack is not just GPUs â€” it is a shared physical machine where fabric topology, power feeds, cooling loops, and failure domains all constrain what the scheduler can safely place. Source: Wikimedia Commons, Victor Grigas, CC BY-SA 3.0'},
      {type:'callout', text:'Free GPU count is an unsafe placement proxy. A rack can have idle accelerators and still be wrong for a tensor-parallel group because the best NVLink path is degraded, wrong for a replica set because every replica would share one PDU, or wrong for bursty prefill because thermal headroom is already consumed. Placement needs physical constraints, not slot counts.'},
      'AI racks are shared physical machines. A scheduler that sees only healthy GPU devices misses the fabric path, power feed, coolant loop, failure domain, maintenance state, and tenant boundary that decide whether placement is safe.',
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious scheduler asks for N free GPUs of the right type. If enough devices pass health checks, it launches the job.',
      'That works for loose workloads on homogeneous hardware. It fails for tensor-parallel, expert-parallel, low-latency serving, and replica placement because those workloads depend on physical relationships.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is shared fate. Two replicas can run on different hosts but still share one PDU, one coolant loop, one switch tray, or one maintenance window.',
      'A rack can have 16 idle GPUs and still be a bad target if the NVLink path is degraded, PDU headroom is 6 kW, or coolant return temperature is near derate. Slot count does not encode those limits.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'Represent the rack as typed objects and typed edges. Objects include GPUs, trays, switches, NICs, PDUs, breakers, CDUs, cooling loops, racks, rows, tenants, and maintenance windows.',
      'The invariant is reasoned placement. Every placement or spill should be explainable by fabric fit, rail balance, power headroom, thermal headroom, failure-domain spread, policy, or maintenance state.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The ledger stores identity and live state for each physical object. Fabric rows track link health and route cost, power rows track draw and margin, thermal rows track temperature and flow, and policy rows track tenant and maintenance restrictions.',
      'A job brings a workload shape. Tensor parallelism needs tight local fabric, data-parallel replicas need fault spread, prefill needs burst power, and decode needs clean low-latency capacity.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'The correctness argument is constraint satisfaction. If every required edge is checked against current state, the scheduler does not place a workload on a resource that violates a declared physical requirement.',
      'The ledger also improves diagnosis. A latency incident can be traced from serving replica to rack score, then to degraded fabric, hot cooling zone, low power margin, or policy override.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is inventory truth. A stale topology edge, hidden derate, missing PDU mapping, or lagging temperature reading can make the scorer confidently wrong.',
      'Cost behaves like control-plane complexity. A richer scorer prevents more bad placements, but every rule must be inspectable, versioned, and separated into hard constraints and soft preferences.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'The ledger fits GPU training clusters, dense inference racks, multi-tenant AI clouds, and maintenance planning. It is strongest when workload performance depends on collective communication or thermal stability.',
      'It also helps incident response. If a CDU enters maintenance or a switch rail degrades, the ledger can identify affected reservations and move elastic work before customers see latency.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'It fails when generic health is treated as enough. A node can be healthy while the route needed by a collective is slow, or while one power feed has too little margin.',
      'It also fails under unlogged emergency bypass. Overrides may be necessary, but they must be recorded because they change the placement risk and future incident explanation.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A decode pool requests 8 GPUs with p99 latency below 45 ms. Rack A has 8 free GPUs but a hot zone at 82 percent thermal limit and 4 kW PDU headroom; Rack B has 10 free GPUs, 18 kW headroom, and clean fabric.',
      'The scorer holds Rack A and places on Rack B even if Rack A has better locality. If Rack B later drops from score 86 to 52 after a rail fault, batch work can remain while interactive decode moves away.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Study NVLink and NVSwitch, InfiniBand or Ethernet fabrics, rack power distribution, liquid cooling CDUs, thermal derating, Kubernetes topology-aware scheduling, and collective communication libraries. Use hardware and platform docs for current constraints.',
      'Next study GPU collective topology placement, NCCL protocol selection, RoCE congestion control, liquid cooling rack thermal loops, SLO-aware routing, and inference cost stacks.',
    ] },
  ],
};
