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
    { heading: 'What it is', paragraphs: ['Global routing plans approximate wire paths on a coarse routing-resource graph before detailed routing assigns exact tracks, vias, and geometries. The graph is usually a grid of G-cells with edge capacity, layer information, blockages, and demand.', 'The data structures are net-to-resource ownership maps, demand/capacity heatmaps, congestion penalties, Steiner-like route trees, rip-up queues, and detailed-router guide regions.'] },
    { heading: 'How it works', paragraphs: ['The router estimates a topology for each net, maps it onto grid edges, increments demand, and compares demand against capacity. Congested edges receive higher cost so later passes prefer detours or different layers.', 'Rip-up/reroute loops remove selected nets from hot resources, update penalties, and search alternate paths. The final output is not a manufactured wire; it is a guide for detailed routing.'] },
    { heading: 'Cost and complexity', paragraphs: ['Routing is hard because local choices interact globally. A short path for one net can block many later nets. A detour can fix overflow but increase capacitance and timing delay. Blockages, pin access, macro channels, and layer capacities make the search space uneven.', 'The heatmap must be explainable. Operators and repair tools need to trace overflow back to nets, pins, macros, placement density, and routing layers.'] },
    { heading: 'Complete case study', paragraphs: ['A placed design has a macro channel with demand six and capacity four. The global router identifies overflow on the central edge, records which nets own that demand, rips up two high-impact nets, raises the edge cost, and reroutes one net around the macro through a less congested edge.', 'Detailed routing then receives guides. If pin access or DRC still fails, the result feeds back to placement, buffering, macro movement, or routing-layer adjustment.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not confuse a clean global route with a clean detailed route. Global routing ignores many exact geometry constraints. Do not treat congestion as anonymous heat; repair requires net ownership and path provenance. Do not optimize only overflow if the detour breaks timing or via limits.', 'A serious route dashboard separates overflow, DRC markers, pin access, antenna, timing, and macro-channel issues.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: OpenROAD global routing docs at https://openroad.readthedocs.io/en/latest/main/src/grt/README.html, detailed routing docs at https://openroad.readthedocs.io/en/latest/main/src/drt/README.html, and the TritonRoute paper at https://vlsicad.ucsd.edu/Publications/Journals/j133.pdf. Study Standard Cell Placement Row Legalization Case Study, Static Timing Analysis Timing Graph Case Study, A*, Min-Cost Max-Flow, Dynamic AABB Tree Broadphase, and Interval Tree next.'] },
  ],
};
