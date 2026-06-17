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
      heading: 'Why this exists',
      paragraphs: [
        'A rack-scale AI system is not only a pile of accelerators. It is a shared physical machine made from GPU trays, NVLink or Ethernet fabrics, scale-out NICs, PDUs, breakers, power shelves, liquid loops, CDUs, fans, switches, maintenance zones, tenant boundaries, and failure domains. A scheduler that sees only healthy nodes sees only a thin slice of the system that will actually carry the workload.',
        'The ledger exists because free GPU count is an unsafe proxy. A rack can have idle accelerators and still be the wrong place for a tensor-parallel group because the best fabric path is degraded. It can be the wrong place for a replica set because every replica would share one PDU or coolant loop. It can be the wrong place for bursty prefill because thermal headroom is already gone. Placement needs a record of physical constraints, not a count of empty slots.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive scheduler asks for N GPUs on nodes that pass a health check. If there are enough devices, it launches the job. That can work in a small homogeneous cluster where jobs are loose and any GPU is close enough to any other GPU. It fails when a model depends on high-bandwidth local collectives, balanced scale-out rails, predictable power draw, or strict blast-radius separation.',
        'The next naive version adds a few labels: node type, GPU model, and maybe rack ID. That is still too shallow. Tensor parallelism cares about the fastest local fabric. MoE all-to-all cares about bisection and rail balance. Prefill-heavy serving can create sharp power and thermal spikes. Decode-heavy serving can be latency-sensitive but less bandwidth-heavy. Batch embedding can fill background capacity without needing the same locality. One label cannot capture these different shapes.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat the rack as a graph plus a set of ledgers. The graph says what is connected, powered, cooled, colocated, isolated, allowed, or under maintenance. The ledgers say how much capacity, headroom, derate, risk, and observed stress each object currently carries. A placement decision is then a query over typed relationships rather than a guess based on node names.',
        'The output must be explainable. A candidate should not only receive a score. It should show why it passed or failed: fabric fit, rail balance, PDU headroom, breaker margin, thermal headroom, CDU state, maintenance window, tenant policy, replica spread, and fallback reason. This turns scheduling into a shared contract between facilities, platform, networking, and model-serving teams.',
      ],
    },
    {
      heading: 'How the ledger works',
      paragraphs: [
        'Model the rack as typed nodes: GPU, host, tray, switch, NIC, port, PDU, breaker, power shelf, CDU, cooling loop, rack, row, site, tenant boundary, and maintenance window. Then add typed edges: connected-to, near, powered-by, cooled-by, shares-failure-domain-with, depends-on, allowed-for-tenant, under-maintenance, and observed-degraded. Each edge has a meaning that a placement rule can test.',
        'The ledger stores live and planned state against those objects. Fabric state includes link health, expected bandwidth, oversubscription, rail membership, and route cost. Power state includes draw, cap, breaker margin, PDU feed, redundancy mode, and derate. Thermal state includes supply temperature, return temperature, coolant flow, CDU capacity, fan state, and local hot spots. Policy state includes tenant placement rules, maintenance freezes, reserved capacity, and incident overrides.',
        'A placement request brings its own shape. It can ask for a tensor-parallel island, data-parallel replicas, expert-parallel exchange, inference prefill pool, decode pool, embedding batch pool, or mixed reservation. The scorer translates that shape into required edges. Tensor-parallel ranks need strong local GPU fabric. Data-parallel replicas need fault spread and scale-out bandwidth. Serving replicas need policy separation and enough thermal margin for bursts. The same rack can score high for one request and low for another.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The topology-ledger view is proving that the same physical object has several operational meanings. A GPU tray is not only compute. It is attached to fabric routes, fed by power paths, cooled by a loop, and grouped into failure domains. When the overlay changes from fabric to power to thermal to blast radius, the object does not move. The question changes. This is the central point: correct placement needs all overlays at once.',
        'The placement-score view is proving that a score without reasons is not usable. A candidate that fails thermal headroom should look different from one that fails NIC locality. A spill caused by maintenance policy should look different from one caused by low PDU margin. Operators need the reason because the fix belongs to different teams. Networking can repair a rail. Facilities can inspect a CDU. Platform can change policy. Serving can choose a less demanding workload shape.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The ledger works because many rack incidents are constraint mismatches, not pure compute shortages. A scheduler can avoid bad placements when it knows that two groups share a PDU, that a switch tray is degraded, that a coolant loop is near derate, or that a maintenance window makes a high-priority reservation risky. The system can also choose a good fallback instead of merely saying no.',
        'It also works because it gives each team a common language. Facilities telemetry is often measured in power, flow, and temperature. Network telemetry is measured in links, counters, drops, marks, and rail health. Model-serving telemetry is measured in latency, throughput, queue depth, and replica health. The ledger binds these facts to the same rack objects, so an incident can be traced from SLO failure to physical cause.',
      ],
    },
    {
      heading: 'Real uses',
      paragraphs: [
        'The first real use is admission control. Before launching a large training run, the platform checks that the requested rank groups fit the intended GPU fabric, that scale-out rails have capacity, that power draw will stay inside policy, and that cooling can absorb the expected load. The launch can fail before it creates a slow or unsafe job. That is better than discovering the problem after a long warmup or during a customer incident.',
        'The second use is serving placement. A router can steer prefill-heavy requests away from a hot rack, keep decode replicas spread across power domains, and place background batch work where fabric locality is less valuable. The third use is maintenance. When a PDU, CDU, or switch tray enters maintenance, the ledger tells which reservations are affected and which workloads can safely remain. The fourth use is post-incident analysis: every placement and spill has a trace.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The ledger has real cost. It needs accurate inventory, fresh telemetry, stable object identity, and a clear ownership model. Bad data can be worse than missing data because it gives the scheduler false confidence. If power readings lag, thermal derates are hidden, or topology edges are stale after repair work, the scorer can choose placements that look safe on paper and fail in production.',
        'There is also a control-plane tradeoff. A rich scorer can become hard to understand, especially if every team adds its own rule. Keep the model typed and inspectable. Separate hard constraints from soft preferences. Version policy changes. Store the evidence used for each decision. Accept that the best placement for a single job may not be best for fleet efficiency, and make that priority explicit.',
      ],
    },
    {
      heading: 'Failure modes and limits',
      paragraphs: [
        'The most dangerous failure mode is hiding shared fate. Replicas can appear spread across hosts while sharing one PDU, coolant loop, row event, or switch tray. Another failure is generic health. A node can be healthy while the route that matters to a collective is slow. A rack can be under power cap while one feed has too little margin. A cooling loop can be nominal while one zone is already hot enough to trigger derate under burst.',
        'The ledger cannot solve every problem. It cannot create capacity that does not exist. It cannot make an unsafe thermal state safe through clever placement. It cannot fix a bad model of workload power draw. It can be bypassed by emergency overrides, and those overrides must be logged because they change the risk profile. The limit is not the graph abstraction; the limit is the quality and timeliness of the physical evidence.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study NVLink and NVSwitch fabric, multi-node NVLink rack systems, liquid cooling loops, CDU behavior, power capping, rack redundancy, Kubernetes scheduling, topology-aware placement, SLO-aware request routing, and collective communication. Then connect this topic to the GPU Collective Topology Placement Planner, NCCL Algorithm Protocol Selector, RoCE PFC ECN DCQCN, Liquid Cooling Rack Thermal Loop, RDMA Queue Pair and Work Request, and LLM Inference Cost Stack. The useful mental model is simple: a GPU placement is a physical promise, not only a software allocation.',
      ],
    },
  ],
};
