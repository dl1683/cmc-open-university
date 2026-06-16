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
    {
      heading: 'What it is',
      paragraphs: [
        'An AI rack topology power thermal ledger joins the identities and state of GPUs, NVLink switches, scale-out NICs, PDUs, power shelves, CDUs, cooling zones, maintenance windows, tenant policies, and failure domains. It turns a rack from a count of accelerators into a scheduler-facing graph.',
        'This module builds on NVLink/NVSwitch GPU Fabric, Liquid Cooling Rack Thermal Loop, and GPU Cloud Capacity Reservation Orderbook. The point is to make placement decisions aware of the physical system that will carry the workload.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The ledger stores multiple overlays over the same physical objects. The fabric overlay stores GPUs, switches, NICs, links, and collective costs. The power overlay stores feed, shelf, PDU, breaker, and headroom. The thermal overlay stores manifold, CDU, inlet, outlet, and derate state. The failure-domain overlay stores shared dependencies that should not host all replicas of the same service.',
        'A derived scoring index answers placement questions. For each job, the scheduler scores candidate rack groups by fabric fit, power headroom, thermal headroom, tenant policy, maintenance state, and blast-radius risk. The score is not just a number; it must include an explanation vector.',
      ],
    },
    {
      heading: 'Why AI racks make this necessary',
      paragraphs: [
        'Rack-scale AI systems bind compute, networking, power, and cooling tightly. NVIDIA describes NVLink and NVLink Switch as scale-up networking for high-bandwidth GPU communication: https://www.nvidia.com/en-us/data-center/nvlink/. NVIDIA Multi-Node NVLink documentation describes rack-level systems where compute trays and switch trays form a shared NVLink domain: https://docs.nvidia.com/multi-node-nvlink-systems/mnnvl-user-guide/overview.html.',
        'The same rack can be healthy enough for batch but wrong for a latency-critical decode group. It can have enough GPUs but a degraded link. It can have enough network but a thermal derate. A flat capacity counter loses exactly the state operators need.',
      ],
    },
    {
      heading: 'Data structure design',
      paragraphs: [
        'Represent the physical world as typed nodes and typed edges. Nodes include GPU, tray, switch, NIC, power feed, CDU, rack, row, site, and tenant boundary. Edges include connected-to, powered-by, cooled-by, shares-failure-domain-with, allowed-for-tenant, and scheduled-maintenance.',
        'Maintain a versioned snapshot for scheduling plus an append-only event log for evidence. The snapshot must be fast enough for placement. The log must be rich enough for incident review, capacity forecasting, and postmortem reconstruction.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Do not let the scheduler see only free GPU count. Do not pack replicas across one shared PDU or CDU unless the blast radius is intentional. Do not hide degraded fabric paths behind generic node health. Do not make facilities telemetry unreachable from model-serving incidents.',
        'Also avoid hard-coding one workload shape. Tensor parallelism, MoE all-to-all, prefill-heavy RAG, decode-heavy chat, batch embedding, and training checkpoint I/O all stress different edges.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVIDIA NVLink overview at https://www.nvidia.com/en-us/data-center/nvlink/, NVIDIA Multi-Node NVLink user guide at https://docs.nvidia.com/multi-node-nvlink-systems/mnnvl-user-guide/overview.html, and NVIDIA DGX GB200 hardware guide at https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html. Study NVLink/NVSwitch GPU Fabric, Liquid Cooling Rack Thermal Loop, RDMA Queue Pair and Work Request, Kubernetes Scheduler PriorityQueue Preemption, and SLO-Aware LLM Request Router next.',
      ],
    },
  ],
};
