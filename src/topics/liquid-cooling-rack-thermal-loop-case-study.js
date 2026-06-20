// Liquid cooling rack thermal loop: model direct-to-chip cooling as a graph of
// heat sources, cold plates, manifolds, CDUs, facility water, and guardrails.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'liquid-cooling-rack-thermal-loop-case-study',
  title: 'Liquid Cooling Rack Thermal Loop',
  category: 'Systems',
  summary: 'A rack-scale thermal case study: direct-to-chip cold plates, manifolds, CDUs, facility water, flow telemetry, heat-rejection budgets, and derating policy.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['thermal loop', 'failure guards'], defaultValue: 'thermal loop' },
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

function loopGraph(title) {
  return graphState({
    nodes: [
      { id: 'gpu', label: 'GPU', x: 0.8, y: 2.2, note: 'heat' },
      { id: 'cpu', label: 'CPU', x: 0.8, y: 4.8, note: 'heat' },
      { id: 'plate', label: 'plate', x: 2.3, y: 3.5, note: 'cold' },
      { id: 'manifold', label: 'mani', x: 3.8, y: 3.5, note: 'flow' },
      { id: 'cdu', label: 'CDU', x: 5.2, y: 3.5, note: 'exchange' },
      { id: 'facility', label: 'water', x: 6.8, y: 2.2, note: 'loop' },
      { id: 'heat', label: 'reject', x: 6.8, y: 4.8, note: 'plant' },
      { id: 'sensor', label: 'sense', x: 8.3, y: 2.2, note: 'tele' },
      { id: 'policy', label: 'policy', x: 8.3, y: 4.8, note: 'derate' },
      { id: 'sched', label: 'sched', x: 9.6, y: 3.5, note: 'quota' },
    ],
    edges: [
      { id: 'e-gpu-plate', from: 'gpu', to: 'plate' },
      { id: 'e-cpu-plate', from: 'cpu', to: 'plate' },
      { id: 'e-plate-manifold', from: 'plate', to: 'manifold' },
      { id: 'e-manifold-cdu', from: 'manifold', to: 'cdu' },
      { id: 'e-cdu-facility', from: 'cdu', to: 'facility' },
      { id: 'e-cdu-heat', from: 'cdu', to: 'heat' },
      { id: 'e-facility-sensor', from: 'facility', to: 'sensor' },
      { id: 'e-heat-sensor', from: 'heat', to: 'sensor' },
      { id: 'e-sensor-policy', from: 'sensor', to: 'policy' },
      { id: 'e-policy-sched', from: 'policy', to: 'sched' },
    ],
  }, { title });
}

function guardGraph(title) {
  return graphState({
    nodes: [
      { id: 'tele', label: 'tele', x: 0.7, y: 3.5, note: 'read' },
      { id: 'flow', label: 'flow', x: 2.1, y: 1.6, note: 'LPM' },
      { id: 'press', label: 'press', x: 2.1, y: 3.5, note: 'drop' },
      { id: 'leak', label: 'leak', x: 2.1, y: 5.4, note: 'detect' },
      { id: 'temp', label: 'temp', x: 3.8, y: 3.5, note: 'delta' },
      { id: 'gate', label: 'gate', x: 5.5, y: 3.5, note: 'rule' },
      { id: 'normal', label: 'run', x: 7.1, y: 1.8, note: 'full' },
      { id: 'derate', label: 'derate', x: 7.1, y: 3.5, note: 'slow' },
      { id: 'drain', label: 'drain', x: 7.1, y: 5.2, note: 'safe' },
      { id: 'audit', label: 'audit', x: 8.8, y: 3.5, note: 'row' },
    ],
    edges: [
      { id: 'e-tele-flow', from: 'tele', to: 'flow' },
      { id: 'e-tele-press', from: 'tele', to: 'press' },
      { id: 'e-tele-leak', from: 'tele', to: 'leak' },
      { id: 'e-flow-temp', from: 'flow', to: 'temp' },
      { id: 'e-press-temp', from: 'press', to: 'temp' },
      { id: 'e-temp-gate', from: 'temp', to: 'gate' },
      { id: 'e-leak-gate', from: 'leak', to: 'gate' },
      { id: 'e-gate-normal', from: 'gate', to: 'normal' },
      { id: 'e-gate-derate', from: 'gate', to: 'derate' },
      { id: 'e-gate-drain', from: 'gate', to: 'drain' },
      { id: 'e-normal-audit', from: 'normal', to: 'audit' },
      { id: 'e-derate-audit', from: 'derate', to: 'audit' },
      { id: 'e-drain-audit', from: 'drain', to: 'audit' },
    ],
  }, { title });
}

function thermalPlot() {
  return plotState({
    axes: {
      x: { label: 'loop flow', min: 0, max: 100 },
      y: { label: 'thermal margin', min: 0, max: 10 },
    },
    series: [
      { id: 'steady', label: 'std', points: [
        { x: 15, y: 2.2 }, { x: 30, y: 4.5 }, { x: 50, y: 6.8 }, { x: 75, y: 8.0 }, { x: 95, y: 8.4 },
      ] },
      { id: 'burst', label: 'bst', points: [
        { x: 15, y: 0.8 }, { x: 30, y: 2.8 }, { x: 50, y: 5.2 }, { x: 75, y: 6.5 }, { x: 95, y: 7.1 },
      ] },
    ],
    markers: [
      { id: 'min', x: 40, y: 4.0, label: 'min flow' },
      { id: 'safe', x: 75, y: 6.5, label: 'safe' },
    ],
  });
}

function incidentPlot() {
  return plotState({
    axes: {
      x: { label: 'minutes after anomaly', min: 0, max: 30 },
      y: { label: 'risk', min: 0, max: 10 },
    },
    series: [
      { id: 'ignore', label: 'ign', points: [
        { x: 0, y: 2.0 }, { x: 5, y: 3.5 }, { x: 10, y: 5.5 }, { x: 20, y: 8.0 }, { x: 30, y: 9.3 },
      ] },
      { id: 'derate', label: 'derate', points: [
        { x: 0, y: 2.0 }, { x: 5, y: 2.5 }, { x: 10, y: 2.2 }, { x: 20, y: 1.8 }, { x: 30, y: 1.6 },
      ] },
    ],
    markers: [
      { id: 'alert', x: 5, y: 3.5, label: 'alert' },
      { id: 'stable', x: 20, y: 1.8, label: 'stable' },
    ],
  });
}

function* thermalLoop() {
  yield {
    state: loopGraph('Liquid cooling is a thermal graph'),
    highlight: { active: ['gpu', 'cpu', 'plate', 'manifold', 'cdu', 'e-gpu-plate', 'e-cpu-plate', 'e-plate-manifold', 'e-manifold-cdu'], found: ['sched'] },
    explanation: 'Direct-to-chip liquid cooling moves heat through cold plates, manifolds, and coolant distribution units before the facility loop rejects it. The scheduler should see the thermal state, not just GPU count.',
    invariant: 'The rack is available only if heat removal, power delivery, and serving SLO agree.',
  };

  yield {
    state: labelMatrix(
      'Thermal telemetry',
      [
        { id: 'inlet', label: 'inlet' },
        { id: 'outlet', label: 'outlet' },
        { id: 'flow', label: 'flow' },
        { id: 'press', label: 'press' },
        { id: 'heat', label: 'heat' },
        { id: 'leak', label: 'leak' },
      ],
      [
        { id: 'track', label: 'track' },
        { id: 'action', label: 'action' },
      ],
      [
        ['temp', 'raise'],
        ['temp', 'alarm'],
        ['LPM', 'derate'],
        ['drop', 'inspect'],
        ['kW', 'quota'],
        ['sensor', 'drain'],
      ],
    ),
    highlight: { active: ['inlet:track', 'outlet:track', 'flow:track', 'heat:track'], compare: ['leak:action', 'press:action'] },
    explanation: 'The thermal loop is controlled by telemetry. Inlet temperature, outlet temperature, flow rate, pressure drop, heat load, and leak detection all become guard predicates for workload placement.',
  };

  yield {
    state: thermalPlot(),
    highlight: { active: ['burst', 'min', 'safe'], compare: ['steady'] },
    explanation: 'Higher flow and better heat exchange restore thermal margin, but bursty AI workloads need margin for synchronized power draw. The control problem is dynamic, not a one-time rack certification.',
  };

  yield {
    state: loopGraph('Thermal policy feeds the serving scheduler'),
    highlight: { active: ['sensor', 'policy', 'sched', 'e-sensor-policy', 'e-policy-sched'], compare: ['facility', 'heat'], found: ['gpu'] },
    explanation: 'Thermal policy should feed the same placement and quota systems that see reservations and SLOs. A hot rack may still run background batch, but it should stop receiving latency-critical decode traffic.',
  };
}

function* failureGuards() {
  yield {
    state: guardGraph('Guardrails turn telemetry into actions'),
    highlight: { active: ['tele', 'flow', 'press', 'leak', 'temp', 'gate', 'e-tele-flow', 'e-tele-press', 'e-tele-leak'], found: ['audit'] },
    explanation: 'A liquid loop needs explicit guardrails. Low flow, pressure anomalies, fast temperature rise, and leak detection should route to run, derate, drain, or maintenance states with an audit trail.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'pump', label: 'pump' },
        { id: 'filter', label: 'filter' },
        { id: 'valve', label: 'valve' },
        { id: 'plate', label: 'plate' },
        { id: 'quick', label: 'quick' },
        { id: 'water', label: 'water' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'response', label: 'response' },
      ],
      [
        ['flow low', 'derate'],
        ['drop high', 'service'],
        ['stuck', 'isolate'],
        ['delta T', 'drain'],
        ['leak', 'shut'],
        ['quality', 'flush'],
      ],
    ),
    highlight: { active: ['pump:signal', 'filter:signal', 'quick:response', 'water:response'], compare: ['plate:response'] },
    explanation: 'The operational data structure is a failure-mode table: each signal maps to a safe action, blast radius, and recovery runbook. The point is to keep a cooling anomaly from becoming a cluster-wide outage.',
  };

  yield {
    state: incidentPlot(),
    highlight: { active: ['derate', 'alert', 'stable'], compare: ['ignore'] },
    explanation: 'Derating early can preserve the rack and the customer SLO. Waiting until temperature crosses a hard shutdown threshold turns a controllable thermal event into abrupt capacity loss.',
  };

  yield {
    state: guardGraph('Every cooling action should leave evidence'),
    highlight: { active: ['normal', 'derate', 'drain', 'audit', 'e-normal-audit', 'e-derate-audit', 'e-drain-audit'], compare: ['gate'] },
    explanation: 'The audit row should capture telemetry, threshold, action, jobs affected, capacity removed, capacity restored, and whether the incident should change future placement policy.',
    invariant: 'Cooling incidents are scheduler evidence, not facilities-only notes.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'thermal loop') yield* thermalLoop();
  else if (view === 'failure guards') yield* failureGuards();
  else throw new InputError('Pick a liquid-cooling view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dense AI racks turn heat into a scheduling constraint. The rack can have enough GPUs and enough power, but a job is still unsafe if the cooling path cannot carry the heat out under sustained load.',
        'Air cooling becomes difficult when power density rises and heat must be removed from tightly packed accelerators. Liquid cooling moves heat through cold plates, manifolds, coolant distribution units, facility water, and heat rejection equipment. That loop is now part of the compute system.',
        'A liquid-cooling thermal loop models that path explicitly: chips, cold plates, manifolds, CDU, facility water, heat rejection, sensors, and derating policy. NVIDIA GB200 rack documentation treats liquid cooling and rack-level infrastructure as part of the system design, not an optional add-on: https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html.',
        {type: 'callout', text: 'A dense AI rack is schedulable only when the full heat path from chip to facility loop has enough measured capacity.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Post_-_Whitepaper_DC_of_the_Future_-_Temperature_Chaining.jpg', alt: 'Diagram showing temperature chaining across data center cooling stages', caption: 'Temperature chaining diagram for datacentre heat flow. Rolf Brink, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The easy answer is to certify the rack once and monitor average temperature. That feels reasonable because thermal design starts with envelopes, thresholds, and facility acceptance tests.',
        'It breaks because AI load is bursty and local. Flow rate, pressure drop, inlet temperature, delta temperature, leak signals, pump state, and CDU margin can change faster than a quarterly facility model. Average temperature can hide the tray or loop that is about to lose margin.',
        'Another shortcut is treating cooling as a facilities-only system. That misses the software consequence: thermal margin changes placement, quotas, job admission, and whether latency-sensitive serving should continue on a hot rack.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'Store two things: a dependency graph and a telemetry ledger. The graph says which trays depend on which cold plates, manifolds, CDUs, facility loops, pumps, valves, and heat-rejection equipment. The ledger records the sensor evidence over time.',
        'The invariant is heat conservation with guardrails. A tray can receive work only while its cooling path has enough flow, acceptable inlet temperature, safe pressure drop, leak-free state, CDU headroom, and facility-side rejection capacity. When any guard weakens, placement shifts from run to derate, drain, or maintenance.',
        'The cooling loop is therefore a capacity graph, not just a monitoring chart. Heat generated at a GPU must travel through every edge. If any edge loses capacity, the safe compute capacity behind that edge drops too.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Direct-to-chip cooling starts at the heat source. Cold plates absorb heat from GPUs, CPUs, or accelerator modules. Coolant carries that heat through a rack manifold to a CDU, where heat is exchanged with a facility-side loop or other rejection path.',
        'Sensors measure inlet temperature, outlet temperature, flow rate, pressure drop, leak detection, pump state, CDU state, and sometimes component-level thermal margin. Those values feed guardrails that decide whether the rack can run normally, derate, drain jobs, or require maintenance.',
        'A scheduler can consume this information as conditional capacity. A rack with reduced thermal margin may still run low-priority batch jobs but should avoid synchronized training bursts or latency-critical decode traffic that would push it past the guardrail.',
        'The operational loop closes when incidents update placement policy. If a rack repeatedly derates under one workload shape, that evidence should feed future quota, reservation, and placement decisions.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'In the thermal-loop view, follow heat out of the compute tray. It moves from package to cold plate, manifold, CDU, facility loop, and heat rejection. The important lesson is that each edge is a capacity-limited dependency.',
        'In the failure-guards view, each signal maps to an action. Low flow derates, high pressure drop creates a service ticket, leak detection drains or isolates, high inlet temperature reduces quota, and repeated thermal events change future placement scores.',
        'The thermal-margin plot proves why load shape matters. A rack that is safe for steady work can have less margin for bursty synchronized workloads. The guardrail is dynamic, not a one-time certification.',
        'The incident plot proves why early derating can be the safer product decision. Waiting for a hard shutdown turns a controllable event into sudden capacity loss.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Liquid cooling works because it carries heat away more effectively than air across dense local heat sources. The coolant path can be engineered around high-power chips instead of relying only on air movement through a crowded rack.',
        'The control layer works because thermal risk has observable precursors. Flow loss, rising delta temperature, abnormal pressure drop, leak signals, and CDU margin all change before a catastrophic shutdown. Good policy acts on those precursors.',
        'The scheduler integration works because thermal state is just another capacity constraint. Like power, memory, and network topology, cooling margin decides which jobs can safely run where.',
        'The graph model works because it localizes blast radius. A rack, manifold, or CDU issue does not have to become a cluster-wide mystery if the scheduler knows exactly which compute capacity depends on the affected cooling path.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'Liquid cooling adds plumbing, leak detection, service procedures, facility dependencies, sensor integration, and operational training. It can unlock denser compute, but it also creates new failure modes and maintenance workflows.',
        'Derating protects equipment and SLOs, but it reduces available capacity. Draining a rack protects hardware, but it can move pressure to neighboring racks. Running through a warning preserves capacity briefly, but it risks a larger incident.',
        'There is also a data tradeoff. Facilities telemetry must be exposed to compute schedulers without overloading operators with noise. The right abstraction is not every raw sensor; it is thermal capacity, guard state, confidence, and recommended action.',
        'Maintenance windows become part of capacity planning. Filters, valves, pumps, CDUs, and quick-disconnect inspections all remove or reduce compute capacity, so the thermal ledger should feed reservation and failover plans before service work begins.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The scheduler should consume thermal state as conditional capacity. A rack with low thermal margin can keep running background work while avoiding latency-critical decode traffic, large synchronized training bursts, or jobs whose communication pattern heats one topology island.',
        'The Open Compute Project Advanced Cooling Solutions work publishes guidance for liquid-cooled datacenter environments and OAI-style rack cooling: https://www.opencompute.org/documents/ocp-acs-dc-cooling-environment-2nd-edition-pdf and https://www.opencompute.org/documents/oai-system-liquid-cooling-guidelines-version-1-0-pdf. NVIDIA also contributed DGX GB200 NVL72 design materials to OCP: https://www.opencompute.org/blog/nvidia-contributes-dgx-gb200-nvl72-design-to-open-compute-project-to-accelerate-ai-infrastructure-innovation.',
        'This pattern wins in AI training clusters, dense inference racks, high-performance computing, and any environment where thermal headroom changes faster than procurement or facility planning can respond.',
        'It also wins for capacity planning. Thermal incident rows reveal which workload shapes, rack positions, and facility loops consume margin fastest, giving planners evidence for future rack layout and reservation policy.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The loop fails as an abstraction when cooling is treated as a building problem that ends before software starts. For AI clusters, cooling state changes placement, SLO, utilization, and capacity claims.',
        'It also fails when incident evidence is separate from the capacity model. Cooling incidents should update the same ledgers used by AI Datacenter Power Interconnection Queue and AI Rack Topology Power Thermal Ledger, otherwise the scheduler keeps repeating the same bad placement.',
        'Another failure is threshold-only thinking. A hard shutdown threshold is the last line of defense, not the control policy. Useful systems act on trend, flow, pressure, and margin before the rack reaches emergency state.',
        'A final failure is hiding thermal derates from users of the cluster. Capacity that exists physically but cannot run a workload safely should not be sold as available capacity.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: NVIDIA DGX GB200 hardware guide at https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html, OCP Cooling Environments guidance at https://www.opencompute.org/documents/ocp-acs-dc-cooling-environment-2nd-edition-pdf, OCP OAI System Liquid Cooling Guidelines at https://www.opencompute.org/documents/oai-system-liquid-cooling-guidelines-version-1-0-pdf, and NVIDIA OCP contribution note at https://www.opencompute.org/blog/nvidia-contributes-dgx-gb200-nvl72-design-to-open-compute-project-to-accelerate-ai-infrastructure-innovation. Study AI Datacenter Power Interconnection Queue, NVLink/NVSwitch GPU Fabric, GPU Cloud Capacity Reservation Orderbook, and AIOps Incident Response next.',
      ],
    },
  ],
};
