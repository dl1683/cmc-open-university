// Standard-cell netlists are typed hypergraphs: cells own pins, nets connect
// pins, and timing arcs turn the same connectivity into analysis edges.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'standard-cell-netlist-hypergraph-primer',
  title: 'Standard Cell Netlist Hypergraph Primer',
  category: 'Systems',
  summary: 'A chip-design primer: cells, pins, nets, Liberty timing arcs, Verilog instances, fanin/fanout indexes, cones of influence, and levelized netlist traversal.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['netlist hypergraph', 'cone index'], defaultValue: 'netlist hypergraph' },
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

function netlistGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'a', label: 'A', x: 0.6, y: 2.0, note: 'port' },
      { id: 'b', label: 'B', x: 0.6, y: 4.4, note: 'port' },
      { id: 'n1', label: 'n1', x: 2.1, y: 3.1, note: 'net' },
      { id: 'u1', label: 'U1', x: 3.7, y: 3.1, note: notes.u1 || 'NAND2' },
      { id: 'n2', label: 'n2', x: 5.3, y: 3.1, note: 'net' },
      { id: 'u2', label: 'U2', x: 6.9, y: 2.2, note: notes.u2 || 'INV' },
      { id: 'ff', label: 'FF', x: 6.9, y: 4.2, note: notes.ff || 'DFF' },
      { id: 'y', label: 'Y', x: 8.7, y: 3.2, note: 'out' },
      { id: 'clk', label: 'CLK', x: 5.2, y: 5.8, note: 'clock' },
    ],
    edges: [
      { id: 'e-a-n1', from: 'a', to: 'n1', weight: 'pin' },
      { id: 'e-b-n1', from: 'b', to: 'n1', weight: 'pin' },
      { id: 'e-n1-u1', from: 'n1', to: 'u1', weight: 'A/B' },
      { id: 'e-u1-n2', from: 'u1', to: 'n2', weight: 'Y' },
      { id: 'e-n2-u2', from: 'n2', to: 'u2', weight: 'A' },
      { id: 'e-u2-y', from: 'u2', to: 'y', weight: 'Y' },
      { id: 'e-n2-ff', from: 'n2', to: 'ff', weight: 'D' },
      { id: 'e-clk-ff', from: 'clk', to: 'ff', weight: 'CK' },
      { id: 'e-ff-y', from: 'ff', to: 'y', weight: 'Q' },
    ],
  }, { title });
}

function* netlistHypergraph() {
  yield {
    state: netlistGraph('Cells, pins, and nets form a typed hypergraph'),
    highlight: { active: ['u1', 'u2', 'ff'], compare: ['n1', 'n2'], found: ['e-a-n1', 'e-b-n1', 'e-n1-u1'] },
    explanation: 'A Verilog netlist is not just a graph of gates. Each net is a hyperedge that connects one driver pin to many load pins, and every pin has direction, capacitance, and timing meaning.',
    invariant: 'Cell instance, pin, net, and timing-arc IDs must remain stable across synthesis, placement, timing, and routing reports.',
  };

  yield {
    state: labelMatrix(
      'Netlist tables',
      [
        { id: 'cell', label: 'cell' },
        { id: 'pin', label: 'pin' },
        { id: 'net', label: 'net' },
        { id: 'arc', label: 'arc' },
      ],
      [
        { id: 'key', label: 'key' },
        { id: 'payload', label: 'payload' },
        { id: 'index', label: 'index' },
      ],
      [
        ['U1', 'NAND2_X1', 'by id'],
        ['U1/A', 'dir cap', 'by net'],
        ['n2', 'driver loads', 'fanout'],
        ['A->Y', 'delay slew', 'Liberty'],
      ],
    ),
    highlight: { active: ['cell:key', 'pin:payload'], found: ['net:index', 'arc:index'] },
    explanation: 'Real tools keep several indexes over the same design: instance tables, pin tables, net driver/load lists, and Liberty timing arcs. The point is not one perfect graph; it is synchronized views.',
  };

  yield {
    state: netlistGraph('A timing view or cone walk reuses connectivity', { u1: 'arc', u2: 'arc', ff: 'seq' }),
    highlight: { active: ['a', 'b', 'n1', 'u1', 'n2'], compare: ['ff', 'clk'], found: ['y', 'e-u2-y'] },
    explanation: 'A fanin cone for output Y starts from an endpoint and walks backward through nets and cell arcs. Sequential elements stop or restart the walk depending on the analysis mode.',
  };

  yield {
    state: labelMatrix(
      'Study map',
      [
        { id: 'netlist', label: 'netlist' },
        { id: 'timing', label: 'timing' },
        { id: 'place', label: 'place' },
        { id: 'route', label: 'route' },
      ],
      [
        { id: 'data', label: 'data' },
        { id: 'next', label: 'next' },
      ],
      [
        ['cells pins nets', 'STA'],
        ['arcs slack', 'closure'],
        ['rows bins', 'legalize'],
        ['G-cells', 'DRC'],
      ],
    ),
    highlight: { active: ['netlist:data', 'timing:next'], found: ['place:next', 'route:data'] },
    explanation: 'The netlist is the shared identity layer. Timing, placement, routing, and DRC all attach their own state to the same cells, pins, and nets.',
  };
}

function* coneIndex() {
  yield {
    state: netlistGraph('Levelized traversal turns connectivity into worklists', { u1: 'level 1', u2: 'level 2', ff: 'stop' }),
    highlight: { active: ['a', 'b', 'n1', 'u1', 'n2', 'u2'], compare: ['ff'], found: ['y'] },
    explanation: 'A topological level order lets analysis visit drivers before loads for combinational paths. Flip-flops and latches create timing boundaries that stop pure combinational propagation.',
  };

  yield {
    state: labelMatrix(
      'Traversal indexes',
      [
        { id: 'fanin', label: 'fanin' },
        { id: 'fanout', label: 'fanout' },
        { id: 'level', label: 'level' },
        { id: 'cone', label: 'cone' },
      ],
      [
        { id: 'shape', label: 'shape' },
        { id: 'use', label: 'use' },
      ],
      [
        ['loads -> driver', 'backtrace'],
        ['driver -> loads', 'propagate'],
        ['topo buckets', 'STA'],
        ['bitset / mark', 'debug'],
      ],
    ),
    highlight: { active: ['fanin:use', 'fanout:use'], found: ['level:shape', 'cone:use'] },
    explanation: 'Fanin and fanout indexes are cheap compared with repeated graph scans. Large tools also cache cones, levels, and dirty marks for incremental analysis.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'logic depth', min: 0, max: 8 }, y: { label: 'visited', min: 0, max: 120 } },
      series: [
        { id: 'local', label: 'cone', points: [{ x: 0, y: 1 }, { x: 2, y: 8 }, { x: 4, y: 23 }, { x: 6, y: 42 }, { x: 8, y: 60 }] },
        { id: 'full', label: 'full', points: [{ x: 0, y: 1 }, { x: 2, y: 22 }, { x: 4, y: 55 }, { x: 6, y: 88 }, { x: 8, y: 118 }] },
      ],
      markers: [
        { id: 'cut', label: 'cut', x: 4, y: 23 },
        { id: 'all', label: 'all', x: 8, y: 118 },
      ],
    }, { title: 'Cone indexes keep debug local' }),
    highlight: { active: ['local'], compare: ['full'], found: ['cut', 'all'] },
    explanation: 'A cone query should touch the relevant neighborhood, not the entire chip. That is why design databases invest in fanin, fanout, and hierarchy indexes.',
  };

  yield {
    state: labelMatrix(
      'Debug ledger',
      [
        { id: 'source', label: 'source' },
        { id: 'dirty', label: 'dirty' },
        { id: 'name', label: 'name' },
        { id: 'hier', label: 'hier' },
      ],
      [
        { id: 'check', label: 'check' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['Verilog + LEF/DEF', 'mismatch'],
        ['changed cell/net', 'stale cache'],
        ['stable ids', 'report join'],
        ['module path', 'flattening'],
      ],
    ),
    highlight: { active: ['source:check', 'dirty:check'], found: ['name:risk', 'hier:check'] },
    explanation: 'The useful netlist database is report-friendly: every timing, placement, and routing finding can be joined back to a hierarchical instance path and source object.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'netlist hypergraph') yield* netlistHypergraph();
  else if (view === 'cone index') yield* coneIndex();
  else throw new InputError('Pick a netlist view.');
}

export const article = {
  references: [
    { title: 'OpenROAD OpenSTA Documentation', url: 'https://openroad.readthedocs.io/en/latest/main/src/sta/README.html' },
    { title: 'OpenSTA API Notes', url: 'https://github.com/The-OpenROAD-Project/OpenSTA/blob/master/doc/StaApi.txt' },
    { title: 'OpenROAD Flow Overview', url: 'https://openroad.readthedocs.io/en/latest/' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['A standard-cell netlist is a circuit database made from instances, pins, nets, and library cells. It is best understood as a typed hypergraph: a net can connect one driver to many loads, and each cell contributes timing arcs from input pins to output pins.', 'The same identity layer feeds static timing, placement, routing, power analysis, ECO repair, DRC debugging, and final signoff reports.'] },
    { heading: 'How it works', paragraphs: ['Verilog gives the instance and net connectivity. Liberty describes cell timing, power, pin capacitance, and timing arcs. LEF/DEF-like physical data adds placement rows, pin shapes, blockages, and routing layers. Constraints such as SDC define clocks and path exceptions.', 'Tools build fanin and fanout lists, driver/load maps, levelized traversal buckets, hierarchy paths, and dirty sets. Those indexes keep later analyses from repeatedly parsing the whole design.'] },
    { heading: 'Cost and complexity', paragraphs: ['A large chip can have millions or billions of pins and timing arcs. Full graph traversal is too expensive for every small change, so incremental caches and stable object IDs matter as much as asymptotic graph theory.', 'The hard part is synchronization: synthesis, timing repair, placement, routing, and ECO edits all mutate related state. A stale netlist-to-physical mapping can make a clean report meaningless.'] },
    { heading: 'Complete case study', paragraphs: ['A timing report flags endpoint Y. The debugger starts from Y, walks the fanin cone through net n2 and cell U1, stops at the launching flip-flop, joins each arc to Liberty delay data, then joins each physical net to placement and routing estimates.', 'The report is only actionable because the graph IDs survive across views: U1/A in the netlist, the Liberty A-to-Y timing arc, the DEF instance location, and the routing net segment all remain joinable.'] },
    { heading: 'Pitfalls', paragraphs: ['Do not model a net as a simple pairwise edge unless the fanout semantics are still represented. Do not lose hierarchy names during flattening if humans need to debug reports. Do not let physical ECOs and timing caches drift apart.', 'A second trap is treating the netlist alone as enough. Delay depends on library arcs, slew, load, parasitics, clock constraints, and physical placement. Connectivity is the skeleton, not the whole chip.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: OpenROAD OpenSTA docs at https://openroad.readthedocs.io/en/latest/main/src/sta/README.html and OpenSTA API notes at https://github.com/The-OpenROAD-Project/OpenSTA/blob/master/doc/StaApi.txt. Study Static Timing Analysis Timing Graph Case Study, Standard Cell Placement Row Legalization Case Study, Global Routing Congestion Grid Case Study, Control Flow Graph & Dominator Tree, and GraphBLAS Sparse Matrix Graph Case Study next.'] },
  ],
};
