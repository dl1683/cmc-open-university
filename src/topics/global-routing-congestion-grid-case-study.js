// Global routing abstracts detailed wires onto a coarse grid so routers can
// reason about demand, capacity, blockages, detours, and rip-up/reroute loops.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'global-routing-congestion-grid-case-study',
  title: 'Global Routing Congestion Grid Case Study',
  category: 'Systems',
  summary: 'A physical-design routing case study: G-cell grids, edge capacity, net demand, blockages, Steiner-style trees, maze routing, overflow heatmaps, rip-up/reroute queues, and detailed-router handoff.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['route grid', 'rip up reroute'], defaultValue: 'route grid' },
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

function routeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'p1', label: 'P1', x: 0.8, y: 1.6, note: 'pin' },
      { id: 'g1', label: 'g1', x: 2.2, y: 1.6, note: notes.g1 || 'free' },
      { id: 'g2', label: 'g2', x: 3.8, y: 1.6, note: notes.g2 || 'cap' },
      { id: 'g3', label: 'g3', x: 5.4, y: 1.6, note: notes.g3 || 'hot' },
      { id: 'p2', label: 'P2', x: 7.0, y: 1.6, note: 'pin' },
      { id: 'g4', label: 'g4', x: 2.2, y: 3.8, note: notes.g4 || 'free' },
      { id: 'blk', label: 'BLK', x: 3.8, y: 3.8, note: 'block' },
      { id: 'g5', label: 'g5', x: 5.4, y: 3.8, note: notes.g5 || 'detour' },
      { id: 'p3', label: 'P3', x: 7.0, y: 3.8, note: 'pin' },
      { id: 'via', label: 'via', x: 5.4, y: 5.7, note: 'layer' },
    ],
    edges: [
      { id: 'e-p1-g1', from: 'p1', to: 'g1', weight: 'nA' },
      { id: 'e-g1-g2', from: 'g1', to: 'g2', weight: 'nA' },
      { id: 'e-g2-g3', from: 'g2', to: 'g3', weight: 'hot' },
      { id: 'e-g3-p2', from: 'g3', to: 'p2', weight: 'nA' },
      { id: 'e-g1-g4', from: 'g1', to: 'g4', weight: '' },
      { id: 'e-g4-blk', from: 'g4', to: 'blk', weight: 'blocked' },
      { id: 'e-blk-g5', from: 'blk', to: 'g5', weight: 'blocked' },
      { id: 'e-g5-p3', from: 'g5', to: 'p3', weight: 'nB' },
      { id: 'e-g3-g5', from: 'g3', to: 'g5', weight: 'via' },
      { id: 'e-g5-via', from: 'g5', to: 'via', weight: 'layer' },
    ],
  }, { title });
}

function* routeGrid() {
  yield {
    state: routeGraph('Global routing uses a coarse capacity graph'),
    highlight: { active: ['p1', 'g1', 'g2', 'g3', 'p2'], compare: ['blk'], found: ['e-g2-g3'] },
    explanation: 'A global router abstracts routing resources into G-cells and edges with capacity. Nets reserve demand along coarse paths before detailed routing assigns real tracks and vias.',
    invariant: 'Demand, capacity, blockages, layers, and net ownership must be explicit so congestion can be traced back to specific nets.',
  };

  yield {
    state: labelMatrix(
      'Demand / capacity heatmap',
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
        ['1/4', '2/4', '5/4', '4/4'],
        ['1/4', 'block', '6/4', '5/4'],
        ['0/4', '1/4', '3/4', '2/4'],
        ['0/4', '0/4', 'via', '1/4'],
      ],
    ),
    highlight: { active: ['r0:c2', 'r1:c2', 'r1:c3'], compare: ['r1:c1'], found: ['r3:c2'] },
    explanation: 'Congestion is a ratio, not just a count. A demand of six is acceptable on a fat routing channel and impossible on an edge with capacity four.',
  };

  yield {
    state: routeGraph('Congestion can force a detour or layer change', { g3: 'overflow', g5: 'alt', g2: 'reroute' }),
    highlight: { active: ['g1', 'g4', 'g5', 'p3'], compare: ['g2', 'g3'], found: ['e-g3-g5', 'via'] },
    explanation: 'Routing around a hot edge may increase wirelength or via count, but it can make the final detailed route feasible. The route graph keeps that trade visible.',
  };

  yield {
    state: labelMatrix(
      'Router handoff',
      [
        { id: 'global', label: 'global' },
        { id: 'detail', label: 'detail' },
        { id: 'drc', label: 'DRC' },
        { id: 'timing', label: 'timing' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['G-cell guides', 'overflow'],
        ['tracks vias', 'pin access'],
        ['rule markers', 'manufacture'],
        ['parasitics', 'slack'],
      ],
    ),
    highlight: { active: ['global:owns', 'detail:owns'], found: ['drc:risk', 'timing:risk'] },
    explanation: 'Global routing produces guides and congestion evidence. Detailed routing turns guides into legal wires, then DRC and timing decide whether another repair loop is needed.',
  };
}

function* ripUpReroute() {
  yield {
    state: labelMatrix(
      'Rip-up queue',
      [
        { id: 'netA', label: 'netA' },
        { id: 'netB', label: 'netB' },
        { id: 'netC', label: 'netC' },
        { id: 'netD', label: 'netD' },
      ],
      [
        { id: 'overflow', label: 'oflow' },
        { id: 'owner', label: 'owner' },
        { id: 'action', label: 'action' },
      ],
      [
        ['2', 'g2-g3', 'rip'],
        ['1', 'g3-g5', 'reroute'],
        ['0', 'clean', 'keep'],
        ['3', 'macro edge', 'detour'],
      ],
    ),
    highlight: { active: ['netA:overflow', 'netA:action', 'netD:action'], compare: ['netC:action'], found: ['netB:owner'] },
    explanation: 'Congestion-driven routers keep a worklist of nets that own overflow. Rip-up/reroute removes selected paths, increases penalties on hot resources, and tries alternate topologies.',
    invariant: 'A router must remember which net consumed which resource; otherwise congestion is just a heatmap with no repair handle.',
  };

  yield {
    state: routeGraph('Reroute penalizes the hot edge and searches alternatives', { g2: 'cost+', g3: 'cost+', g5: 'use', g4: 'alt' }),
    highlight: { active: ['g1', 'g4', 'g5', 'p3'], compare: ['g2', 'g3'], found: ['e-g1-g4', 'e-g5-p3'] },
    explanation: 'A reroute pass changes edge costs based on overflow, blockages, via penalties, and historical congestion. The pathfinder should prefer an available detour when the central channel is saturated.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'round', min: 0, max: 6 }, y: { label: 'overflow', min: 0, max: 20 } },
      series: [
        { id: 'overflow', label: 'oflow', points: [{ x: 0, y: 18 }, { x: 1, y: 13 }, { x: 2, y: 9 }, { x: 3, y: 5 }, { x: 4, y: 3 }, { x: 6, y: 1 }] },
        { id: 'wire', label: 'wire', points: [{ x: 0, y: 8 }, { x: 1, y: 9 }, { x: 2, y: 11 }, { x: 3, y: 12 }, { x: 4, y: 13 }, { x: 6, y: 14 }] },
      ],
      markers: [
        { id: 'trade', label: 'trade', x: 3, y: 12 },
        { id: 'near', label: 'near', x: 6, y: 1 },
      ],
    }, { title: 'Overflow falls while detours raise wirelength' }),
    highlight: { active: ['overflow'], compare: ['wire'], found: ['trade', 'near'] },
    explanation: 'Routing closure is a tradeoff curve. Overflow should fall, but detours can increase wirelength, capacitance, delay, and via count.',
  };

  yield {
    state: labelMatrix(
      'Failure triage',
      [
        { id: 'pin', label: 'pin' },
        { id: 'macro', label: 'macro' },
        { id: 'density', label: 'density' },
        { id: 'rules', label: 'rules' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'route', label: 'route' },
      ],
      [
        ['no access', 'move/buffer'],
        ['blocked side', 'floorplan'],
        ['too hot', 'replace'],
        ['DRC marker', 'detail fix'],
      ],
    ),
    highlight: { active: ['pin:signal', 'macro:route'], compare: ['density:route'], found: ['rules:signal'] },
    explanation: 'A failed route is often not just a router problem. Pin access, macro placement, density, timing repair, and design rules can all create congestion symptoms.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'route grid') yield* routeGrid();
  else if (view === 'rip up reroute') yield* ripUpReroute();
  else throw new InputError('Pick a global-routing view.');
}

export const article = {
  references: [
    { title: 'OpenROAD Global Routing Documentation', url: 'https://openroad.readthedocs.io/en/latest/main/src/grt/README.html' },
    { title: 'OpenROAD Detailed Routing Documentation', url: 'https://openroad.readthedocs.io/en/latest/main/src/drt/README.html' },
    { title: 'TritonRoute Paper', url: 'https://vlsicad.ucsd.edu/Publications/Journals/j133.pdf' },
  ],
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `After placement, the chip has legal cell coordinates but not physical wires. Every signal net needs metal shapes, vias, spacing, shielding where needed, and connections to pins. Exact detailed routing for the whole chip from scratch is too large and rule-heavy: tracks, layers, design-rule spacing, macro obstructions, antenna effects, and pin access all interact.`,
        `Global routing creates a coarse plan before exact geometry. It divides the chip into routing regions, often called G-cells, and models the boundaries between regions as edges with capacity. Each net receives a coarse route tree through this grid. The result is not final metal. It is a guide that says which regions and layers a net should use and where the design is likely to run out of routing resources.`,
        `The point is early evidence. If a macro channel has demand six and capacity four, detailed routing does not need to spend hours proving the obvious. Placement, buffering, layer assignment, or macro planning may need to change. Global routing gives the flow a congestion map with ownership and available detours.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first attempt is shortest-path routing. For each net, connect its pins with the shortest Manhattan path. If a net has more than two pins, build a simple tree that keeps total length low. This works on toy grids because empty space is abundant and every path has similar cost.`,
        `The approach fails because routing resources are shared and limited. Early nets can consume the easiest channels. Later nets inherit the leftovers. A route through the center of a block may be short, but if many nets choose the same edge, that edge overflows. Macros remove routing resources or restrict access around their boundaries. Layers have different preferred directions and via costs. Pins can be harder to access than open channel space.`,
        `A second naive approach is to draw a heatmap after routing and call the hottest area the problem. That is only half useful. A heatmap without net ownership cannot repair itself. The router needs to know which nets created overflow, which can detour, and whether the cause is routing choice, placement density, macro blockage, or pin access.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is capacity under interaction. Routing one net changes the graph for every other net because it consumes demand on shared edges. A route that is legal alone can be illegal in the population. The router must optimize a collection of route trees, not independent paths.`,
        `The second wall is that overflow is not the only metric. A detour can reduce congestion while increasing wirelength, capacitance, delay, coupling risk, and via count. A route that satisfies coarse capacity can still fail detailed routing because exact pin shapes, spacing rules, or via placement are tighter than the abstraction.`,
        `The third wall is responsibility. Routing congestion may be a symptom of placement, not a routing mistake. If standard cells are too dense near a macro, no routing algorithm can create enough channel capacity out of nothing. Global routing has to produce evidence that other tools can act on.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to represent routing as a capacity graph before representing it as exact metal. G-cells are vertices or regions. Edges between neighboring cells carry capacity, demand, layer information, blockage information, historical cost, and net ownership. A net owns a tree over this graph. Congestion is demand greater than capacity on one or more edges.`,
        `This abstraction turns detailed geometry into a tractable planning problem. The router can run maze search, Steiner-style tree construction, pattern routing, or negotiated-congestion methods over a smaller graph. It can ask, "If this edge is overused, which nets should leave it?" rather than trying to move exact wires immediately.`,
        `Rip-up/reroute is the repair loop. Select nets that own overflow, remove their current demand from the grid, raise the cost of hot edges, and search for alternate route trees. Historical costs remember that an edge has been contested before, so the router does not bounce all nets back to the same cheap-looking channel. The invariant is that demand accounting and net ownership stay explicit after every change.`,
      ],
    },
    {
      heading: 'Mechanism: how the system works',
      paragraphs: [
        `The flow starts with placed pins, blockages, routing layers, preferred directions, and capacity estimates. The chip is partitioned into a grid. Each edge receives a capacity derived from available tracks, layer resources, blockages, and technology assumptions. Nets become routing problems, often with multi-pin trees rather than one independent path per pin pair.`,
        `An initial routing pass assigns each net to a coarse route. Simple nets may use pattern routes. Harder nets may use maze search or negotiated cost. Demand is accumulated on edges and layers. The router then computes overflow: demand minus capacity where demand is too high. It also records which nets own the demand, so repair has a handle.`,
        `Repair proceeds by ripping up selected nets and rerouting them with updated costs. Hot edges become more expensive. Blocked regions remain unavailable. Via penalties discourage excessive layer changes. Timing-critical nets may receive protection from large detours, while less critical nets may move first. The loop stops when overflow is gone or when remaining violations require help from other tools.`,
        `The handoff to detailed routing is a set of guides. Detailed routing turns those guides into exact tracks, vias, wire widths, spacing-compliant shapes, and pin connections. If it fails, its markers show whether pin access, guides, placement density, or macro channels need repair.`,
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        `The route-grid view proves that congestion is a ratio, not a color. Six units of demand on capacity four is overflow. The same six units might be fine on a wider channel. The blocked macro cell shows why shortest geometric distance is not the same as route availability. The via marker shows that layer changes have costs.`,
        `The rip-up-reroute view proves that ownership makes congestion actionable. Nets with overflow enter a worklist because the router knows who consumed the hot resources. Raising edge costs and searching detours can reduce overflow, but the plot shows the tax: wirelength can rise while congestion falls. That is routing closure in miniature, not a pure shortest-path problem.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Global routing works because coarse capacity pressure is a reliable early warning for many detailed-routing failures. It does not need exact shapes to know that too many nets want the same macro channel. It does not need final vias to know that layer transitions are being overused. The abstraction throws away detail, but it preserves the facts needed for planning: demand, capacity, blockage, cost, and ownership.`,
        `The repair loop works by monotonic pressure, not by guaranteeing that every individual reroute is better. When an edge overflows, its cost rises. Nets searching later see that cost and prefer alternatives when alternatives are reasonable. Historical cost prevents the system from repeatedly choosing the same contested edge after each rip-up. The invariant is that the grid accounting stays consistent: ripping up a net removes its demand; rerouting adds demand along the new tree.`,
        `The handoff works because detailed routing receives a narrowed search space. Instead of exploring the whole chip for every connection, it starts from global guides that are likely to have capacity. Detailed routing can then spend its effort on exact design rules, pin access, vias, and local conflicts.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The cost of global routing depends on grid size, net count, pin count, and the search method. Demand accumulation is roughly proportional to total route-tree length on the grid. Maze search is more expensive because it explores alternatives, especially in congested regions. Rip-up/reroute multiplies this work across repair rounds.`,
        `Memory is spent on grid edges, capacities, layer data, blockage maps, route trees, ownership lists, costs, and work queues. Finer grids improve spatial accuracy but add vertices and edges. Coarser grids are faster but can hide pin-access and local channel problems.`,
        `When input size doubles, the pain is not only more nets. More nets create more interaction. Congestion can make search harder because many reasonable paths are already expensive. The dominant cost in practice is often the repeated repair loop around contested regions, not the first clean pass over easy nets.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Global routing wins in digital physical-design flows where exact detailed routing is too expensive to start blindly. It gives placement a routability signal, gives timing a more realistic wire estimate, gives detailed routing guide regions, and gives engineers a map of structural congestion. It is the right tool when the design has enough regular routing fabric for capacity abstraction to predict the main failures.`,
        `It also wins as a diagnosis tool. If overflow clusters around macro edges, floorplanning may be the problem. If overflow follows a dense standard-cell region, placement spreading may help. If timing-critical nets cannot detour, buffering or cell movement may be needed. If detailed routing fails despite clean global capacity, pin access or design-rule detail may be the missing model.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `A clean global route is not proof of a clean detailed route. The abstraction can miss exact spacing rules, odd pin shapes, antenna fixes, via enclosure rules, cut spacing, local track coloring, and cell-internal access limits.`,
        `The technique also fails when it is asked to fix impossible floorplans. If a macro channel has too little physical capacity, negotiated cost can move nets around the symptom but cannot create tracks. If placement density is too high, routing detours may only push congestion elsewhere. If timing is already tight, the detours needed for congestion relief may be unacceptable.`,
        `The common mistake is optimizing overflow alone. A design with zero coarse overflow can still be too slow, too noisy, too via-heavy, or too fragile under detailed rules. Routing closure means congestion, timing, manufacturability, and analysis feedback agree enough to finish.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Standard Cell Placement because placement creates most of the geometry that routing must repair or confirm. Study Static Timing Analysis because routing choices change capacitance, delay, and slack. Study A* and Dijkstra for path search, Steiner tree heuristics for multi-pin nets, min-cost flow for capacity tradeoffs, and interval or spatial indexes for geometry queries.`,
        `Sources: OpenROAD global routing docs at https://openroad.readthedocs.io/en/latest/main/src/grt/README.html, OpenROAD detailed routing docs at https://openroad.readthedocs.io/en/latest/main/src/drt/README.html, and the TritonRoute paper at https://vlsicad.ucsd.edu/Publications/Journals/j133.pdf.`,
      ],
    },
  ],
};
