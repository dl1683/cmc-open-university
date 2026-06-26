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

