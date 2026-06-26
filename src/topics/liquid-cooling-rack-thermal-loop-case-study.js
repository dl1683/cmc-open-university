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
      heading: 'How to read the animation',
      paragraphs: [
        'The animation treats a dense AI rack as a thermal graph. Heat starts at chips, crosses cold plates, moves through rack manifolds, reaches a coolant distribution unit, and finally leaves through the facility loop. Active nodes show the current heat-transfer dependency, and found states show guardrail actions such as run, derate, drain, or service.',
        {type: 'callout', text: 'A dense AI rack is schedulable only when the full heat path from chip to facility loop has enough measured capacity.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Post_-_Whitepaper_DC_of_the_Future_-_Temperature_Chaining.jpg', alt: 'Diagram showing temperature chaining across data center cooling stages', caption: 'Temperature chaining diagram for datacentre heat flow. Rolf Brink, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Dense accelerator racks can have enough GPUs and power but still be unable to run a job safely. Cooling capacity becomes a compute constraint when each tray can produce kilowatts of heat. Liquid cooling exists because air alone becomes inefficient when heat is concentrated in tightly packed accelerators.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to certify the rack once and watch average temperature. That feels reasonable because facilities teams already use design envelopes, thresholds, and acceptance tests. It fails because thermal risk is local and dynamic: one manifold, tray, valve, or pump can lose margin while the rack average looks acceptable.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that heat moves through a chain, and the weakest edge sets safe capacity. A GPU can be cool at idle and unsafe under synchronized training load if flow rate drops, inlet temperature rises, or pressure drop changes. Treating cooling as a building-only problem hides the software consequence: scheduling must know which compute depends on which cooling path.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Model the rack as a capacity graph plus a telemetry ledger. The graph records dependencies from tray to cold plate, manifold, coolant distribution unit, facility water, and heat rejection equipment. The ledger records sensor evidence over time so scheduler decisions are based on measured margin rather than a static nameplate.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Direct-to-chip liquid cooling carries heat from chips into cold plates, then through coolant loops to a heat exchanger. Sensors track inlet temperature, outlet temperature, flow, pressure drop, leak state, pump state, and coolant distribution unit margin. A control policy turns those measurements into actions: keep running, reduce power, stop admitting hot jobs, drain work, or service the rack.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation with guardrails. A tray may run a workload only if every edge in its cooling path has enough capacity to carry the expected heat. If any required edge loses margin, reducing compute behind that edge preserves the invariant that generated heat does not exceed removable heat.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Liquid cooling adds plumbing, sensors, leak detection, service procedures, facility dependencies, and scheduler integration. The behavior cost is capacity derating: a rack that physically contains 72 accelerators may only be schedulable at 60 percent during a cooling event. Doubling rack density without doubling heat-removal capacity raises incident probability rather than useful compute.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This pattern fits AI training clusters, dense inference racks, high-performance computing, and any datacenter where thermal headroom changes faster than procurement cycles. Schedulers can treat thermal margin like power or network topology: a condition on where work can safely run. Capacity planners can use incident rows to identify workload shapes and rack positions that consume margin fastest.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'The model fails when telemetry is incomplete, stale, or hidden from the scheduler. It also fails when operators rely only on hard shutdown thresholds; by then the policy has lost the chance to derate gracefully. Liquid cooling does not remove failure modes, it changes them into pumps, valves, seals, filters, quick disconnects, and facility-loop dependencies.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a rack is rated for 120 kW of IT load with 20 percent thermal headroom. A training job would add 18 kW to a tray group whose manifold normally has 24 kW of remaining capacity, so it can run. If flow loss cuts that remaining capacity to 10 kW, admitting the job would exceed the local path by 8 kW even if the whole room still looks under its average thermal limit.',
        'The scheduler should reject or move the job, or admit a lower-power workload that fits the new margin. If derating drops rack capacity from 120 kW to 95 kW for two hours, the cost is not abstract: 25 kW of compute budget is unavailable, queued jobs move elsewhere, and neighboring racks may inherit pressure. The thermal ledger records why that capacity disappeared.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study NVIDIA DGX GB200 hardware documentation, Open Compute Project advanced cooling guidance, OAI liquid cooling guidelines, and facility water-loop design references. Then study power and thermal ledgers, GPU rack topology, capacity reservation, AIOps incident response, pump redundancy, leak detection, and workload-aware scheduling. A useful exercise is to map one tray to every cooling dependency that must pass before a hot job can start.',
      ],
    },
  ],
};