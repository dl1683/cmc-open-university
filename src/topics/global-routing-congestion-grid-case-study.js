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
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a coarse routing plan for an integrated circuit. A global router divides the chip into grid cells, a net is a required electrical connection, capacity is available routing resource, and demand is resource already claimed. Active edges are being routed or repaired, visited edges have accounted demand, and found edges are legal guide paths.',
        'The safe inference rule is demand minus capacity. An edge with demand 6 and capacity 4 has overflow 2, no matter how short or visually convenient that path looks.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Modern chips contain many pins, standard cells, macros, routing layers, and design rules. Exact detailed routing is too expensive to run blindly over the whole chip without a coarse plan.',
        'Global routing exists to predict congestion early and produce guide regions for detailed routing. It tells placement, timing, and routing tools where the fabric is likely to fail before exact wire shapes are chosen.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to route every net by shortest path. For each connection, choose the nearest geometric path around blockages and move to the next net.',
        'That works for one net in isolation. It is also a reasonable first mental model because wirelength and delay usually prefer shorter paths when resources are available.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is interaction. Routing one net consumes tracks that other nets also need, so legal local choices can create an illegal global population.',
        'The wall is also abstraction loss. A coarse grid can show congestion pressure, but detailed routing still has exact pin access, via, spacing, antenna, and manufacturing rules that the coarse model does not fully represent.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Represent routing as a capacity graph before choosing exact metal shapes. Grid edges store capacity, demand, blockage, layer cost, historical congestion, and net ownership.',
        'The invariant is explicit accounting. When a net is routed, its demand is added to the edges it uses; when it is ripped up, that demand is removed before a new path is searched.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The flow starts with placed cells, macros, pins, layers, blockages, and routing capacities. The router builds a grid and assigns each edge an estimated number of available tracks.',
        'Each net receives an initial route tree over the grid. Demand accumulates on edges, overflow is computed where demand exceeds capacity, and ownership lists identify which nets are responsible for hot edges.',
        'The repair loop rips up selected nets, raises the cost of congested edges, and reroutes those nets through alternatives. The final output is a guide for detailed routing, not the final legal wire geometry.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Global routing works because many detailed-routing failures have a coarse capacity cause. Too many nets in a macro channel can be detected before exact tracks and vias are assigned.',
        'Rip-up and reroute works by feedback. Increasing the cost of overused edges makes later searches prefer alternatives when alternatives exist, while demand accounting keeps the congestion map honest after each change.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Cost depends on grid size, net count, pin count, and search method. Demand accumulation is roughly proportional to total route-tree length, while maze search becomes expensive in congested regions because it explores alternatives.',
        'When net count doubles, runtime can grow by more than double because interactions increase and repair rounds multiply. Memory stores grid edges, capacities, costs, ownership lists, route trees, blockage maps, and work queues.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Global routing is used in digital physical-design flows between placement and detailed routing. It gives timing tools better wire estimates, gives detailed routers guide regions, and gives engineers congestion evidence.',
        'It is also a diagnosis tool. Congestion near macro edges can point to floorplan problems, while congestion in dense standard-cell regions can point to placement spreading or buffering needs.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A clean global route does not prove a clean detailed route. Exact pin shapes, local track coloring, via enclosure, spacing, antenna fixes, and cell-internal access can still fail.',
        'It also cannot fix impossible floorplans. If a channel physically lacks enough tracks, negotiated cost can move overflow around but cannot create routing fabric.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a grid edge has capacity 4 tracks. Nets A, B, C, D, E, and F all choose that edge in the initial route, so demand is 6 and overflow is 2.',
        'The router rips up E and F, raises the edge cost from 1 to 5, and reroutes them around a longer path that uses edges with capacity 4 and demand 2. Overflow drops to 0, but total wirelength rises by 18 grid steps, which may hurt timing.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study OpenROAD global routing documentation, OpenROAD detailed routing documentation, the TritonRoute paper, and classic negotiated-congestion routing papers. The important source idea is the split between coarse capacity planning and exact design-rule closure.',
        'Next study standard-cell placement, static timing analysis, Dijkstra or A* search, Steiner tree heuristics, min-cost flow, and design-rule checking. Routing closure is where graph search meets physical manufacturing constraints.',
      ],
    },
  ],
};
