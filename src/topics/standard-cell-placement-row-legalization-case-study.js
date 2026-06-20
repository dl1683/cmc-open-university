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
    {
      heading: 'Why this exists',
      paragraphs: [
        `A synthesized netlist tells us which standard cells and macros exist and which pins are connected. It does not tell the foundry where those cells sit. Placement turns logical connectivity into coordinates on a real chip floorplan: rows have fixed heights, sites have legal x positions, macros and blockages occupy space, power rails impose orientation rules, and routing layers above the cells have limited capacity.`,
        `The placement stage matters because later tools inherit its geometry. Static timing sees wire delay from physical distance. Clock-tree synthesis sees where sequential elements live. Global routing sees crowded macro channels. Power and thermal analysis see whether switching activity has been packed into one region.`,
        `The reason placement is split into phases is that one phase cannot solve every constraint at full detail. Global placement uses approximate continuous coordinates and coarse density models. Legalization and detailed placement convert those targets into manufacturable row and site assignments.`,
        {type:'callout', text:`Placement succeeds by separating continuous optimization from discrete row legality, then measuring how much the repair moved the design.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/a/aa/Silicon_chip_3d.png', alt:'3D rendering of metal and polysilicon structures in a small standard cell.', caption:'3D view of a small integrated circuit standard cell. David Carron, Wikimedia Commons, public domain.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first attempt is to put connected cells close together. If a net connects U1, U2, and U3, bringing those instances near each other usually reduces half-perimeter wirelength, lowers capacitance, and helps timing.`,
        `That approach breaks when thousands or millions of movable instances all follow the same local rule. Connected cells pile into the same region, especially near high-fanout logic, IO pin clusters, SRAM macros, or timing-critical datapaths. A placement that optimizes only net length creates density overflow, pin-access pressure, routing congestion, and local hot spots.`,
        `A second naive approach is to legalize greedily as each cell is placed: scan for the nearest free row site and drop the cell there. This commits too early. A locally nearest site for one cell may push a more critical neighbor far away, fragment a row, or preserve a bad global shape.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is that the best mathematical position is often not a legal physical position. Global placement can represent a cell at x = 103.7 in the middle of another cell because that continuous coordinate helps the optimizer express force, density, and net-length gradients. Silicon cannot use that coordinate. The final instance must start on an allowed site, fit within a row, respect orientation, avoid fixed objects, and not overlap another instance.`,
        `Legalization is hard because every repair has side effects. Sliding a cell right may fix one overlap and create another. Moving a cell to a new row may reduce row overflow and stretch a critical net. Spreading a dense region may relieve routing pressure and increase clock skew risk. Macro blockages break the simple model of one long free row.`,
        `The most important failure mode is treating legalization as cleanup. It is part of the optimization loop. If legalization changes the design too much, the global placement was misleading. If it changes too little, the design may stay illegal. A good flow keeps displacement, timing impact, density, and routability visible while it repairs overlaps.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to use two representations of the same design. The global placer sees a coarse geometric optimization problem: movable cells have target coordinates, nets have bounding boxes, density bins have capacity, and timing or routability weights modify the force on each instance. The legalizer sees a row/site packing problem: each row contains ordered intervals, blocked sites, fixed cells, and movable cells with preferred x positions.`,
        `That separation gives each phase the right data structure. Density bins answer the question, "Which regions are overfull?" Net bounding boxes answer, "Which movements probably shorten wire?" Row occupancy structures answer, "Where can this cell legally start?" Clusters answer, "Which overlapping cells should move together because separating them one at a time would create unnecessary displacement?"`,
        `An Abacus-style row legalizer is a useful mental model. Sort cells by global x target within a row. When a new cell overlaps the previous occupant, merge the touching cells into a cluster. Shift the cluster to the nearest legal span, then split or merge clusters as needed. The invariant is simple: committed cells are ordered, non-overlapping, and site-aligned while staying close to their global targets.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `A placement flow starts from a floorplan. Rows, sites, macros, IO pins, blockages, voltage areas, and keep-out margins define the legal region. The netlist supplies movable standard cells and connectivity. The global placer assigns approximate coordinates by minimizing a weighted objective, often combining wirelength, density overflow, timing pressure, and routability estimates. The output is useful but not manufacturable.`,
        `Density bins give global placement its pressure field. If too much cell area wants to occupy a bin, the placer pushes instances away from that region. If a timing-critical chain is stretched too far, timing weights pull related cells back together. These forces compete. The score curve in the visualization shows why there is no single monotonic win: improving density can hurt wirelength, and improving wirelength can create overflow.`,
        `Legalization then snaps cells to rows and sites. It chooses candidate rows near each cell target, checks blockages and row compatibility, builds clusters when cells overlap, and measures displacement cost. Detailed placement may follow with local swaps, shifts, and reordering to recover wirelength or timing without violating legality.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The density-bins view proves that placement is not sorting cells into empty boxes. The highlighted hot bins are evidence that local connectivity decisions have created regional pressure. The macro is not just another cell; it removes legal placement and routing area around it. The plot view shows the tradeoff directly: one objective can improve while another gets worse, so the placement database must carry all relevant evidence instead of one score.`,
        `The row-legalization view proves the handoff from approximate geometry to legal occupancy. Floating cell centers become row intervals. Overlaps become cluster repairs. Blocked sites become hard constraints. The final graph keeps the important net relationships close to the original placement, but it also admits the truth: a legal placement is close to the global solution, not identical to it.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness argument for legalization is an invariant argument. Within each processed row segment, cells are kept in legal order, aligned to sites, and non-overlapping. When cells or clusters overlap, merging them preserves relative order and computes a nearby legal cluster position. Boundary shifts restore legality without changing the ordering that prevents crossings inside the row.`,
        `The reason this does not destroy global placement quality is locality. Most legal moves are small compared with the chip scale. The global stage already placed related cells near each other and spread density across regions. The legalizer mainly removes discretization and overlap errors. When displacement becomes large, that is a signal, not a harmless repair: the global placement may be overfull, the floorplan may be too tight, or a macro channel may need a different shape.`,
        `The whole flow works because feedback connects phases. Timing analysis can increase weights on critical nets. Global routing can mark congested regions. Pin-access checks can penalize dense cell arrangements near macros. Legalization is not trusted blindly; it produces a manufacturable state that later analyses can challenge.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Global placement is dominated by repeated passes over cells, nets, and density bins. More cells increase force computation, more nets increase wirelength and timing updates, and finer bins increase density work. Good implementations keep these operations near linear or near-linear per iteration with sparse connectivity and incremental updates.`,
        `Legalization is cheaper than global placement but still important at scale. Sorting cells by row or x position costs roughly O(n log n) when done directly, though flows can reduce this with existing order and partitioning. Row repair then walks ordered cells and clusters mostly linearly within row segments. Memory is spent on placement records, row occupancy, blockage intervals, net bounding boxes, bin maps, and analysis annotations.`,
        `The tradeoff is that the phase split hides exact constraints from global optimization. A smoother model is easier to optimize, but it can lie near hard physical boundaries. A more exact model catches legality earlier, but it is harder to solve globally. Production flows choose a middle path: approximate early, legalize locally, analyze, and repair.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Row legalization is the right tool whenever a standard-cell block has a plausible global placement that must be made manufacturable. It wins because standard cells share row structure: same-height cells fit into repeated placement rows, site grids give discrete x positions, and most repairs are local. The data layout matches the physical fabric.`,
        `It is also useful as a diagnostic surface. Large displacement points to overfull regions. Repeated row failures point to floorplan blockages or utilization that is too aggressive. Timing damage after legalization points to critical cells that need stronger constraints, buffering, or local refinement. The legalizer is both a repair algorithm and a measurement tool for placement quality.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Legal placement is not the same as routable placement. A design can have no overlaps and still fail because pins are inaccessible, macro channels are saturated, via resources are scarce, or timing paths cannot tolerate the needed detours. Legalization also struggles when global placement is too compressed; no local algorithm can place more cell area into a row segment than the segment physically holds.`,
        `The technique is the wrong mental model for large fixed macros, analog blocks, memories, and floorplanning choices that change the shape of the available space. It also becomes more complex with multi-height cells, power domains, mixed threshold-voltage constraints, scan-chain ordering, and local clocking rules. In those cases, row legalization is one component inside a broader physical-design loop, not a complete placement answer.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study global routing next because routability is one of the strongest feedback signals into placement. Study static timing analysis to understand why two placements with similar wirelength can have different slack. Study interval trees and sweep-line algorithms for row occupancy and overlap detection. Study dynamic AABB trees or R-trees for spatial indexing around macros and blockages.`,
        `Primary sources for this page are OpenROAD global placement documentation at https://openroad.readthedocs.io/en/latest/main/src/gpl/README.html, OpenROAD detailed placement documentation at https://openroad.readthedocs.io/en/latest/main/src/dpl/README.html, and the RePlAce repository at https://github.com/The-OpenROAD-Project/RePlAce. Read them with the phase split in mind: continuous placement creates a target; legalization turns the target into a legal row/site state; later routing and timing decide whether the target was good enough.`,
      ],
    },
  ],
};
