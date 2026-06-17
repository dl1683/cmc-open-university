// Distribution outage restoration: feeder sections, normally-open ties,
// protective devices, load priorities, and safe switching sequences.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'distribution-feeder-outage-restoration-switching-case-study',
  title: 'Distribution Feeder Outage Restoration Switching Case Study',
  category: 'Systems',
  summary: 'A distribution-grid case study: radial feeder graphs, fault isolation, normally-open tie switches, load blocks, crew and DER constraints, safe switching sequences, and restoration objective ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['fault isolate', 'restore sequence'], defaultValue: 'fault isolate' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function feederGraph(title) {
  return graphState({
    nodes: [
      { id: 'subA', label: 'SubA', x: 0.8, y: 3.5, note: 'source' },
      { id: 's1', label: 'S1', x: 2.4, y: 2.0, note: 'closed' },
      { id: 'load1', label: 'L1', x: 4.0, y: 2.0, note: 'crit' },
      { id: 'fault', label: 'F', x: 5.5, y: 3.5, note: 'fault' },
      { id: 'load2', label: 'L2', x: 7.0, y: 2.0, note: 'shed' },
      { id: 'tie', label: 'tie', x: 7.0, y: 5.2, note: 'open' },
      { id: 'subB', label: 'SubB', x: 8.8, y: 5.2, note: 'source' },
    ],
    edges: [
      { id: 'e-subA-s1', from: 'subA', to: 's1' },
      { id: 'e-s1-load1', from: 's1', to: 'load1' },
      { id: 'e-load1-fault', from: 'load1', to: 'fault' },
      { id: 'e-fault-load2', from: 'fault', to: 'load2' },
      { id: 'e-load2-tie', from: 'load2', to: 'tie' },
      { id: 'e-tie-subB', from: 'tie', to: 'subB' },
    ],
  }, { title });
}

function* faultIsolate() {
  yield {
    state: feederGraph('Fault isolation cuts the feeder graph'),
    highlight: { active: ['subA', 's1', 'load1', 'e-subA-s1', 'e-s1-load1'], compare: ['fault', 'load2'], found: ['tie'] },
    explanation: 'Distribution feeders are often operated radially. A fault must be isolated before alternate sources or tie switches restore unfaulted load.',
    invariant: 'Never close a tie into an uncleared fault or an unsafe paralleling condition.',
  };

  yield {
    state: labelMatrix(
      'Section status',
      [
        { id: 'src', label: 'src' },
        { id: 'crit', label: 'crit' },
        { id: 'fault', label: 'fault' },
        { id: 'cold', label: 'cold' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'action', label: 'action' },
      ],
      [
        ['energized', 'hold'],
        ['served', 'protect'],
        ['locked', 'isolate'],
        ['dark', 'restore'],
      ],
    ),
    highlight: { active: ['fault:action', 'cold:action'], found: ['crit:action'] },
    explanation: 'The outage engine partitions the graph into energized, faulted, safely isolated, and restorable blocks.',
  };

  yield {
    state: graphState({
      nodes: [
        { id: 'alarm', label: 'alarm', x: 0.8, y: 3.5, note: 'SCADA' },
        { id: 'loc', label: 'locate', x: 2.6, y: 3.5, note: 'section' },
        { id: 'open', label: 'open', x: 4.4, y: 2.0, note: 'cut' },
        { id: 'safe', label: 'safe', x: 6.2, y: 2.0, note: 'verify' },
        { id: 'close', label: 'close', x: 7.8, y: 3.5, note: 'tie' },
        { id: 'crew', label: 'crew', x: 4.4, y: 5.0, note: 'repair' },
      ],
      edges: [
        { id: 'e-alarm-loc', from: 'alarm', to: 'loc' },
        { id: 'e-loc-open', from: 'loc', to: 'open' },
        { id: 'e-open-safe', from: 'open', to: 'safe' },
        { id: 'e-safe-close', from: 'safe', to: 'close' },
        { id: 'e-loc-crew', from: 'loc', to: 'crew' },
      ],
    }, { title: 'Restoration is a guarded action sequence' }),
    highlight: { active: ['alarm', 'loc', 'open', 'safe', 'e-loc-open', 'e-open-safe'], found: ['close'] },
    explanation: 'The sequence matters. Detection, location, isolation, verification, and re-energization are different state transitions with different permissions.',
  };

  yield {
    state: labelMatrix(
      'Safety guards',
      [
        { id: 'radial', label: 'radial' },
        { id: 'thermal', label: 'thermal' },
        { id: 'volt', label: 'voltage' },
        { id: 'crew', label: 'crew' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'fail', label: 'fail' },
      ],
      [
        ['no loop', 'block'],
        ['ampacity', 'shed'],
        ['limits', 'step'],
        ['clearance', 'hold'],
      ],
    ),
    highlight: { active: ['radial:check', 'thermal:check', 'crew:fail'], compare: ['volt:fail'] },
    explanation: 'A switch plan is not valid just because it reconnects load. It must satisfy radiality, thermal limits, voltage limits, protection settings, and crew clearance.',
  };
}

function* restoreSequence() {
  yield {
    state: feederGraph('Normally-open ties create alternate paths'),
    highlight: { active: ['tie', 'subB', 'e-tie-subB'], found: ['load2'], compare: ['fault'] },
    explanation: 'Tie switches are graph edges held open during normal radial operation. During restoration, closing one can energize an unfaulted island from another source.',
  };

  yield {
    state: labelMatrix(
      'Objective ledger',
      [
        { id: 'crit', label: 'critical' },
        { id: 'load', label: 'load' },
        { id: 'ops', label: 'ops' },
        { id: 'risk', label: 'risk' },
      ],
      [
        { id: 'score', label: 'score' },
        { id: 'watch', label: 'watch' },
      ],
      [
        ['high', 'hospitals'],
        ['MW', 'served'],
        ['switches', 'wear'],
        ['safety', 'crew'],
      ],
    ),
    highlight: { active: ['crit:score', 'load:score'], compare: ['risk:watch'] },
    explanation: 'Restoration is multi-objective: restore critical load, maximize served load, minimize switching, respect crews, and keep the network within limits.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'step', min: 0, max: 5 }, y: { label: 'load %', min: 0, max: 100 } },
      series: [
        { id: 'planA', label: 'plan A', points: [{ x: 0, y: 40 }, { x: 1, y: 45 }, { x: 2, y: 70 }, { x: 3, y: 86 }, { x: 4, y: 88 }] },
        { id: 'planB', label: 'plan B', points: [{ x: 0, y: 40 }, { x: 1, y: 62 }, { x: 2, y: 68 }, { x: 3, y: 70 }, { x: 4, y: 72 }] },
      ],
      markers: [
        { id: 'safe', label: 'safe', x: 3, y: 86 },
        { id: 'fast', label: 'fast', x: 1, y: 62 },
      ],
    }, { title: 'Fast restoration is not always the best plan' }),
    highlight: { active: ['planA'], compare: ['planB'], found: ['safe', 'fast'] },
    explanation: 'A fast first step can block later safe service. The planner should score full sequences, not only the next closed switch.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'ybus', label: 'Ybus' },
        { id: 'state', label: 'state' },
        { id: 'switch', label: 'switch' },
        { id: 'crew', label: 'crew' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['model', 'limits'],
        ['visibility', 'SCADA'],
        ['action', 'sequence'],
        ['field', 'clearance'],
      ],
    ),
    highlight: { active: ['switch:role', 'switch:proof'], found: ['crew:proof'] },
    explanation: 'Restoration connects graph search to operational proof: every recommended switch needs model support, measurements, constraints, and human/field state.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'fault isolate') yield* faultIsolate();
  else if (view === 'restore sequence') yield* restoreSequence();
  else throw new InputError('Pick a feeder restoration view.');
}

export const article = {
  references: [
    { title: 'EPRI OpenDSS Documentation', url: 'https://opendss.epri.com/' },
    { title: 'OpenDSS Tutorial and Cases', url: 'https://wzy.ece.iastate.edu/PPT/EE653%20OpenDSS%20Tutorial%20and%20Cases.pdf' },
    { title: 'PNNL 9500-Node Distribution Test System', url: 'https://www.pnnl.gov/main/publications/external/technical_reports/PNNL-33471.pdf' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `A distribution outage is not solved by finding any path from a source to a dark load. The utility must isolate the fault, avoid energizing unsafe equipment, preserve protection assumptions, respect crews in the field, and restore as much priority load as possible. Reachability is only the first layer.`,
        `That makes restoration a constrained graph-control problem. The graph contains substations, feeder sections, load blocks, protective devices, normally-open ties, switches, faulted sections, DERs, ratings, voltage constraints, telemetry confidence, and crew clearance. A useful planner has to reason about topology and electrical state at the same time.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The obvious algorithm marks the faulted edge, searches for alternate paths, and reconnects the disconnected customers. This is a good sketch for the graph part of the problem. It identifies islands, possible ties, and candidate paths from healthy sources to unfaulted load blocks.`,
        `It fails as an operating procedure because a feeder switch is not just a graph edge. Closing it can create an unintended loop, overload a line, violate voltage limits, defeat protection coordination, backfeed a work zone, or energize the fault again. Electrical safety dominates pure graph reachability.`,
      ],
    },
    {
      heading: 'Why the naive plan fails',
      paragraphs: [
        `Distribution feeders are commonly operated radially even when the physical network has tie points. The open ties give operators flexibility during restoration, but they are open for a reason. A restoration path that looks valid on paper can be invalid because it would parallel sources, exceed feeder capacity, or change fault-current paths.`,
        `The action sequence matters too. A switch close that is safe after one isolating device opens may be unsafe before that opening. Crew location, lockout tags, SCADA confidence, field reports, and operator approval can change which transitions are allowed at a given moment.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `Model restoration as state-space search over guarded switching actions. Each action changes the network state: a device opens, a tie closes, a section becomes isolated, a load block becomes energized, or a crew clearance changes. After each action, constraints decide whether the state is allowed.`,
        `The objective is multi-criteria rather than a single shortest path. A good plan serves critical loads, maximizes safe restored load, minimizes switching operations, preserves repair access, avoids fragile temporary configurations, respects DER behavior, and leaves a defensible rollback path if a later step is rejected.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `A restoration engine usually starts with an outage hypothesis from protection operations, SCADA alarms, smart-meter pings, calls, and field reports. It partitions the feeder graph into energized sections, suspected faulted sections, isolated sections, and dark but restorable islands.`,
        `Then it generates candidate switch sequences. For each candidate, topology checks enforce radiality and isolation, load-flow checks estimate voltage and thermal limits, protection checks look for unsafe coordination changes, and operating checks confirm crews, permissions, switching order, and source capacity. Candidates that fail any guard are discarded.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The fault-isolate view proves the first priority: cut the graph so the faulted section is not energized. The upstream critical load can remain served, but the downstream dark section is only a restoration candidate after the fault is isolated and the relevant devices are in safe states.`,
        `The restore-sequence view proves why normally-open ties matter. They are alternate graph edges held in reserve. The plotted plans show that a fast first restoration step is not always the best plan. Operators care about the whole sequence because early choices can block safer or larger restoration later.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The method works because it couples graph search with physics and operating rules. The graph proposes candidates quickly. Electrical validation rejects candidates that violate ampacity, voltage, source capacity, radiality, or protection assumptions. Human and field constraints reject candidates that are not operationally legal.`,
        `The sequence ledger makes the recommendation auditable. Operators do not only need the final switch state. They need to know why step 1 made step 2 safe, which measurements supported the plan, which constraints passed, which loads remain out, and how to reverse or stop the sequence safely.`,
      ],
    },
    {
      heading: 'Case study sequence',
      paragraphs: [
        `A storm faults a feeder section downstream of a critical load. Protection opens a device, alarms arrive, and the outage engine marks the suspected section. The planner keeps the upstream critical load served, opens isolating devices around the suspected fault, verifies the faulted block is not in the restoration path, and marks the downstream unfaulted island as restorable.`,
        `Next it evaluates a normally-open tie from a neighboring feeder. Plan A restores less load at first but stays within thermal and voltage limits after a later step. Plan B restores more load immediately but overloads the neighboring feeder if the next island is added. The safer sequence wins because the planner scores the full plan, not only the next close.`,
      ],
    },
    {
      heading: 'Operator record',
      paragraphs: [
        `A restoration recommendation should leave a clear record. The record should include the fault hypothesis, switch steps, operator approvals, crews and clearances, load restored, load still out, constraints checked, DER assumptions, rollback path, and the measurement and topology version used by the plan.`,
        `That record matters during the outage and after it. During the outage, it helps the operator decide whether a recommendation is still valid when a new alarm or field report arrives. After the outage, it lets engineers compare the recommended sequence with what actually happened and improve the model without guessing.`,
        `The record also protects against stale automation. If a crew reports a changed field condition, the planner can invalidate only the affected recommendation instead of treating every previous calculation as equally current.`,
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `The computational cost depends on how many switch states and candidate sequences the planner explores. Exhaustively trying every combination can grow too quickly. Practical systems prune impossible actions, prioritize high-value loads, use feeder sections rather than every conductor span, and run electrical checks only on promising candidates.`,
        `The engineering cost is model quality. A beautiful optimizer is dangerous if the topology is stale, device states are wrong, load estimates are poor, DER behavior is unknown, or field crew status is missing. Restoration planning is only as good as the measurements and operating data it is allowed to trust.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `This model is useful for outage management systems, distribution management systems, storm restoration planning, DER-aware switching studies, operator training simulators, and post-event review. It gives operators a structured way to compare restoration sequences instead of relying on one-step intuition.`,
        `It is also a strong curriculum bridge from algorithms to real systems. BFS and Dijkstra teach reachability and path cost. Restoration adds constraints, finite state transitions, physical validation, human approval, and consequences. The result is a graph problem where the legal move set matters as much as the graph itself.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `A graph-only restoration planner is unsafe. Common mistakes include closing a tie because a path exists, trusting stale SCADA, ignoring voltage and thermal limits, failing to model crew clearance, forgetting DER backfeed, optimizing immediate megawatts restored, or assuming protection still behaves correctly after topology changes.`,
        `Another failure mode is unauditable automation. If the system recommends a switch without recording the fault hypothesis, topology version, measurements, constraints, approvals, and rollback path, operators cannot defend the action later. Restoration recommendations must be explainable enough for real-time control and after-action review.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: EPRI OpenDSS documentation at https://opendss.epri.com/, the OpenDSS tutorial overview at https://wzy.ece.iastate.edu/PPT/EE653%20OpenDSS%20Tutorial%20and%20Cases.pdf, and the PNNL 9500-node distribution test system report at https://www.pnnl.gov/main/publications/external/technical_reports/PNNL-33471.pdf.`,
        `Next topics: SCADA State Estimation for visibility, Graph BFS and Dijkstra for topology search, Finite State Machine for guarded switching sequences, Min-Cost Max-Flow for optimization framing, Constraint Satisfaction for legal action filtering, and Ybus Power Flow for the electrical checks behind the graph plan.`,
      ],
    },
  ],
};
