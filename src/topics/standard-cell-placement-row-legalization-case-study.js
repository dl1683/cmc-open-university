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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as two coordinate systems for the same chip block. Global placement gives movable standard cells continuous x and y targets, while row legalization snaps those cells onto fixed rows and discrete placement sites. Active bins or cells are the current pressure points.',
        'Visited row sites are occupancy facts already accounted for. Found markers show a legal or high-pressure state that the next phase must respect. The safe inference is that a legalizer may move cells, but it must preserve non-overlap, row compatibility, site alignment, and fixed blockages.',
        {type:'callout', text:`Placement succeeds by separating continuous optimization from discrete row legality, then measuring how much the repair moved the design.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/aa/Silicon_chip_3d.png', alt:'3D rendering of metal and polysilicon structures in a small standard cell.', caption:'3D view of a small integrated circuit standard cell. David Carron, Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A synthesized netlist says which logic cells exist and which pins must connect. It does not say where those cells should sit on silicon. Placement turns logical connectivity into physical coordinates that routing, timing, power, and manufacturing rules can use.',
        'The split between global placement and legalization exists because the useful optimization problem is smoother than the legal manufacturing problem. Global placement can reason about wirelength, density, congestion, and timing with approximate coordinates. Legalization then repairs the result into rows and sites that can actually be fabricated.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to place connected cells close together. If U1 drives U2, and U2 drives U3, short distances usually reduce wire capacitance and timing delay. That local rule works in a small hand layout.',
        'At chip scale, the same rule creates piles. High-fanout logic, macro edges, IO regions, and timing-critical paths can pull too many cells into one area. A placement that minimizes local wirelength can be unroutable or illegal because physical area is finite.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the best continuous coordinate can be illegal. A global placer may put a cell at x = 103.7 because that is where the force model balances, but the row grid may allow only integer site starts such as x = 100 or x = 104. Worse, another cell or macro blockage may already occupy that span.',
        'Repair is not free. Moving one cell right can overlap another cell, moving it to a new row can stretch a critical net, and spreading a dense region can increase routing detours. Legalization is a constrained optimization step, not cosmetic cleanup.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use different data structures for different phases. Density bins summarize regional area pressure, net bounding boxes estimate wirelength, timing weights pull critical paths, and row occupancy intervals answer what physical sites are free. No single structure captures all of those facts cheaply.',
        'An Abacus-style legalizer makes the row problem concrete. Sort cells assigned to a row by target x, merge overlapping neighbors into clusters, shift each cluster to a legal span, and keep committed clusters ordered and non-overlapping. The invariant is legal occupancy with minimal local displacement.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The flow starts from a floorplan with rows, sites, macros, blockages, power domains, and IO pins. The global placer assigns approximate locations by repeatedly adjusting cells against wirelength, density, timing, and routability costs. The output is a strong hint, not a legal layout.',
        'Legalization maps each movable cell to candidate rows near its target. It checks blocked intervals, row compatibility, site grid alignment, and overlap. Detailed placement can then perform small swaps or shifts to recover wirelength and timing while preserving legality.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness for legalization is an invariant argument. After each row segment is processed, committed cells are site-aligned, inside legal row intervals, and non-overlapping. When two cells or clusters overlap, merging them preserves their relative order and computes a new legal cluster location.',
        'Quality comes from locality, not from a proof of global optimality. The global placer has already found a useful shape for the netlist. If legalization displacement stays small, the repaired layout remains close to that shape. Large displacement is evidence that the floorplan, density target, or global placement needs another pass.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Global placement is dominated by repeated passes over cells, nets, and density bins. If cell count doubles with similar net degree, each iteration roughly doubles its graph work and bin updates. More timing corners and congestion estimates add heavier constants.',
        'Legalization usually sorts or buckets cells by row and x position, then walks row segments and clusters. Direct sorting is O(n log n), while the repair walk is close to linear after ordering. Memory is spent on cell records, row intervals, bin maps, net bounding boxes, timing annotations, and blockage data.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'This is the standard shape of digital physical design. OpenROAD, commercial EDA tools, and research placers all separate approximate global placement from legal and detailed placement because chip blocks are too large for one exact solve.',
        'The access pattern is iterative analysis. Timing analysis can raise weights on critical nets, routing estimates can mark congested regions, and legalizer displacement can signal overfull areas. Placement is useful because it produces a physical state that later tools can challenge.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the global model lies too much. If bins are too coarse, macro channels are too tight, pin access is ignored, or timing weights arrive late, legalization can produce a legal layout that is still unroutable or too slow. A legal coordinate is not a closed design.',
        'It also fails near hard constraints. Fixed macros, voltage-area boundaries, clock cells, multi-height cells, and power-grid rules break the simple picture of identical cells in long rows. Production flows need special cases and feedback loops for those boundaries.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume one row has sites 0 through 19, and each site is 1 unit wide. U1 has width 4 and target x = 5.2, U2 has width 3 and target x = 7.0, and U3 has width 5 and target x = 10.1. Rounding alone gives spans 5..8, 7..9, and 10..14, so U1 and U2 overlap.',
        'A cluster legalizer merges U1 and U2 into a 7-site cluster and places it near the weighted target, for example 5..11 with U1 at 5..8 and U2 at 9..11. U3 at 12..16 then avoids overlap with 1.9 sites of displacement from its target. The row becomes legal, and the cost is the measured displacement and any wirelength damage.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with OpenROAD global placement at https://openroad.readthedocs.io/en/latest/main/src/gpl/README.html. Then read OpenROAD detailed placement at https://openroad.readthedocs.io/en/latest/main/src/dpl/README.html and the RePlAce repository at https://github.com/The-OpenROAD-Project/RePlAce.',
        'Study Half-Perimeter Wirelength for net cost and Static Timing Analysis Timing Graph for timing pressure. Then connect placement to Global Routing, Clock Tree Synthesis, and Interval Scheduling for the constraints that appear after legalization.',
      ],
    },
  ],
};
