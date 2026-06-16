// Standard-cell placement maps a netlist onto placement rows and sites while
// balancing wirelength, density, routability, and timing pressure.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'standard-cell-placement-row-legalization-case-study',
  title: 'Standard Cell Placement Row Legalization Case Study',
  category: 'Systems',
  summary: 'A physical-design placement case study: global placement bins, cell density, half-perimeter wirelength, timing weights, placement rows, site grids, legalizer displacement, and overlap repair.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['density bins', 'row legalization'], defaultValue: 'density bins' },
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

function placementGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'macro', label: 'MAC', x: 1.2, y: 2.0, note: 'fixed' },
      { id: 'u1', label: 'U1', x: 3.1, y: 1.4, note: notes.u1 || 'mov' },
      { id: 'u2', label: 'U2', x: 4.2, y: 2.4, note: notes.u2 || 'mov' },
      { id: 'u3', label: 'U3', x: 5.2, y: 1.6, note: notes.u3 || 'mov' },
      { id: 'u4', label: 'U4', x: 6.3, y: 3.4, note: notes.u4 || 'mov' },
      { id: 'pinA', label: 'A', x: 0.7, y: 5.2, note: 'IO' },
      { id: 'pinY', label: 'Y', x: 8.7, y: 1.8, note: 'IO' },
      { id: 'hot', label: 'hot', x: 4.8, y: 4.8, note: 'dense' },
    ],
    edges: [
      { id: 'e-pinA-u1', from: 'pinA', to: 'u1', weight: 'net' },
      { id: 'e-u1-u2', from: 'u1', to: 'u2', weight: 'net' },
      { id: 'e-u2-u3', from: 'u2', to: 'u3', weight: 'crit' },
      { id: 'e-u3-pinY', from: 'u3', to: 'pinY', weight: 'net' },
      { id: 'e-u2-u4', from: 'u2', to: 'u4', weight: 'fanout' },
      { id: 'e-macro-u4', from: 'macro', to: 'u4', weight: 'block' },
    ],
  }, { title });
}

function* densityBins() {
  yield {
    state: placementGraph('Global placement turns connectivity into coordinates'),
    highlight: { active: ['u1', 'u2', 'u3', 'u4'], compare: ['macro'], found: ['e-u2-u3', 'hot'] },
    explanation: 'Global placement gives movable cells approximate coordinates by trading wirelength, density, timing pressure, and congestion. It may overlap cells; legalization comes later.',
    invariant: 'Placement coordinates are useful only when tied to fixed macros, IO pins, rows, sites, blockages, and net weights.',
  };

  yield {
    state: labelMatrix(
      'Density bin grid',
      [
        { id: 'r0', label: 'r0' },
        { id: 'r1', label: 'r1' },
        { id: 'r2', label: 'r2' },
        { id: 'r3', label: 'r3' },
      ],
      [
        { id: 'c0', label: 'c0' },
        { id: 'c1', label: 'c1' },
        { id: 'c2', label: 'c2' },
        { id: 'c3', label: 'c3' },
      ],
      [
        ['ok', 'ok', 'hot', 'hot'],
        ['macro', 'block', 'hot', 'spill'],
        ['ok', 'ok', 'ok', 'spill'],
        ['free', 'free', 'ok', 'ok'],
      ],
    ),
    highlight: { active: ['r0:c2', 'r0:c3', 'r1:c2'], compare: ['r1:c0', 'r1:c1'], found: ['r1:c3', 'r2:c3'] },
    explanation: 'Density bins summarize how much cell area wants to occupy each region. A placer uses the bin map to push cells out of hot regions and around fixed macros.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'iteration', min: 0, max: 6 }, y: { label: 'score', min: 0, max: 100 } },
      series: [
        { id: 'wire', label: 'wire', points: [{ x: 0, y: 94 }, { x: 1, y: 74 }, { x: 2, y: 64 }, { x: 4, y: 58 }, { x: 6, y: 55 }] },
        { id: 'density', label: 'dens', points: [{ x: 0, y: 28 }, { x: 1, y: 55 }, { x: 2, y: 68 }, { x: 4, y: 79 }, { x: 6, y: 86 }] },
      ],
      markers: [
        { id: 'spread', label: 'spread', x: 2, y: 68 },
        { id: 'stable', label: 'stable', x: 6, y: 86 },
      ],
    }, { title: 'Placement optimizes multiple objectives at once' }),
    highlight: { active: ['wire'], compare: ['density'], found: ['spread', 'stable'] },
    explanation: 'Wirelength can improve while density worsens, or density can improve while timing paths stretch. Placement is a weighted optimization problem, not a sorting problem.',
  };

  yield {
    state: labelMatrix(
      'Global placement record',
      [
        { id: 'coord', label: 'coord' },
        { id: 'bin', label: 'bin' },
        { id: 'net', label: 'net' },
        { id: 'timing', label: 'timing' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['float x/y', 'overlap'],
        ['density', 'hotspot'],
        ['HPWL', 'fanout'],
        ['criticality', 'detour'],
      ],
    ),
    highlight: { active: ['coord:stores', 'bin:stores'], compare: ['timing:risk'], found: ['net:stores'] },
    explanation: 'The placement database needs both geometric state and netlist state: coordinates, utilization bins, net bounding boxes, criticality weights, and blockages.',
  };
}

function* rowLegalization() {
  yield {
    state: labelMatrix(
      'Row site occupancy before legalization',
      [
        { id: 'row0', label: 'row0' },
        { id: 'row1', label: 'row1' },
        { id: 'row2', label: 'row2' },
        { id: 'row3', label: 'row3' },
      ],
      [
        { id: 's0', label: 's0' },
        { id: 's1', label: 's1' },
        { id: 's2', label: 's2' },
        { id: 's3', label: 's3' },
        { id: 's4', label: 's4' },
      ],
      [
        ['U1', 'U2', 'U2', 'overlap', 'free'],
        ['macro', 'macro', 'block', 'free', 'free'],
        ['free', 'U3', 'U4', 'U4', 'free'],
        ['free', 'free', 'free', 'free', 'free'],
      ],
    ),
    highlight: { active: ['row0:s1', 'row0:s2', 'row0:s3'], compare: ['row1:s0', 'row1:s1', 'row1:s2'], found: ['row2:s1', 'row2:s2'] },
    explanation: 'Legalization snaps floating global-placement coordinates onto legal rows and sites, removes overlaps, respects fixed blockages, and tries to minimize displacement.',
    invariant: 'Every movable cell must end on an allowed row/site with no overlap and legal orientation.',
  };

  yield {
    state: labelMatrix(
      'Abacus-style row repair',
      [
        { id: 'cluster', label: 'cluster' },
        { id: 'anchor', label: 'anchor' },
        { id: 'shift', label: 'shift' },
        { id: 'commit', label: 'commit' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['U1 U2', 'overlap'],
        ['nearest legal', 'wire delta'],
        ['spread right', 'disp'],
        ['row0 sites', 'legal'],
      ],
    ),
    highlight: { active: ['cluster:state', 'anchor:state'], found: ['shift:cost', 'commit:state'] },
    explanation: 'A row legalizer groups overlapping cells into clusters, shifts them to legal site positions, and chooses placements that keep displacement and wirelength damage small.',
  };

  yield {
    state: placementGraph('Legal placement is close, not identical, to global placement', { u1: 'row0', u2: 'row0', u3: 'row2', u4: 'row2' }),
    highlight: { active: ['u1', 'u2', 'u3', 'u4'], compare: ['macro'], found: ['e-u2-u3', 'e-u3-pinY'] },
    explanation: 'After legalization, cells sit on valid rows and sites. The placer must preserve the important net relationships while obeying manufacturing and design-grid constraints.',
  };

  yield {
    state: labelMatrix(
      'Route handoff',
      [
        { id: 'legal', label: 'legal' },
        { id: 'pin', label: 'pin' },
        { id: 'clock', label: 'clock' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'proof', label: 'proof' },
        { id: 'next', label: 'next' },
      ],
      [
        ['no overlap', 'CTS'],
        ['pin access', 'route'],
        ['skew targets', 'STA'],
        ['congestion', 'repair'],
      ],
    ),
    highlight: { active: ['legal:proof', 'pin:proof'], compare: ['clock:next'], found: ['route:next'] },
    explanation: 'Legal placement is not the finish line. It hands a manufacturable coordinate state to clock-tree synthesis, global routing, detailed routing, and timing closure.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'density bins') yield* densityBins();
  else if (view === 'row legalization') yield* rowLegalization();
  else throw new InputError('Pick a placement view.');
}

export const article = {
  references: [
    { title: 'OpenROAD Global Placement Documentation', url: 'https://openroad.readthedocs.io/en/latest/main/src/gpl/README.html' },
    { title: 'OpenROAD Detailed Placement Documentation', url: 'https://openroad.readthedocs.io/en/latest/main/src/dpl/README.html' },
    { title: 'RePlAce Repository', url: 'https://github.com/The-OpenROAD-Project/RePlAce' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['Standard-cell placement assigns physical coordinates to movable cells on a chip. Global placement optimizes approximate continuous positions. Detailed placement and legalization snap cells to legal rows and sites, remove overlaps, and respect fixed macros and blockages.', 'The data structures are placement rows, site grids, cell rectangles, net bounding boxes, density bins, timing weights, blockages, and displacement ledgers.'] },
    { heading: 'How it works', paragraphs: ['A global placer usually treats cells as movable objects connected by nets. It optimizes wirelength and density while considering timing and routability. Density bins estimate where area demand exceeds local capacity.', 'A legalizer then maps cells onto discrete legal sites. It repairs overlaps, handles fixed macros, preserves orientation rules, and minimizes displacement from the global-placement solution.'] },
    { heading: 'Cost and complexity', paragraphs: ['Placement is hard because every move changes several objectives at once. Pulling two connected cells together can improve wirelength but create density or routing congestion. Spreading cells out can reduce congestion but hurt timing.', 'The row legalizer has a narrower but still important job: it must make the placement legal without destroying the optimization that came before it.'] },
    { heading: 'Complete case study', paragraphs: ['A block is globally placed with a dense hotspot near a macro. The density bin grid identifies overflow. The placer spreads cells away from the macro while keeping a timing-critical chain short. The legalizer then snaps the cells onto rows, clusters overlapping cells, shifts them to open sites, and records displacement.', 'After legalization, static timing and global routing rerun. If congestion or slack regresses, the flow feeds that evidence back into placement weights or repair steps.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not celebrate low wirelength if density or pin access is broken. Do not treat legal placement as equivalent to routable placement. Do not let a legalizer move critical cells far enough to invalidate timing assumptions.', 'Another trap is losing the relationship between cell coordinates and netlist identity. Timing and routing reports must still point to the same instances and nets.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: OpenROAD global placement docs at https://openroad.readthedocs.io/en/latest/main/src/gpl/README.html, detailed placement docs at https://openroad.readthedocs.io/en/latest/main/src/dpl/README.html, and the RePlAce repository at https://github.com/The-OpenROAD-Project/RePlAce. Study Static Timing Analysis Timing Graph Case Study, Global Routing Congestion Grid Case Study, Dynamic AABB Tree Broadphase, R-Tree Spatial Index, and Interval Tree next.'] },
  ],
};
