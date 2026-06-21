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
    {
      heading: 'Why this exists',
      paragraphs: [
        'A chip implementation flow needs one shared identity layer. Synthesis, static timing, placement, routing, power analysis, ECO repair, and signoff reports must all point at the same cells, pins, nets, clocks, hierarchy paths, and library arcs. If those views disagree, the flow can produce a clean report for a design that is not the design being manufactured.',
        {type: 'callout', text: 'A netlist is the identity ledger that lets timing, placement, routing, power, and ECO tools argue about the same physical circuit.'},
        'A standard-cell netlist is that identity layer. It is the gate-level circuit database after logic has been mapped into library cells such as NANDs, inverters, flip-flops, buffers, adders, and clock cells. The netlist says which instances exist and which pins are connected. Later tools attach timing delay, load, placement coordinates, routing parasitics, power activity, congestion, violations, and repair history to the same objects.',
      ],
    },
    {
      heading: 'The naive model and wall',
      paragraphs: [
        'The first model most people reach for is a simple directed graph: gates are nodes and wires are edges. That is useful for small logic diagrams, but it hides the feature that makes real netlists awkward. One net can connect a driver pin to many load pins, a clock can fan out to thousands of sinks, and a bus can become many scalar nets after elaboration. A pairwise edge loses the fact that these loads share one electrical object.',
        'The next wall is that connectivity alone does not answer timing or physical questions. A path delay depends on the cell timing arc from one input pin to one output pin, the input slew, the output load, the library corner, the clock constraint, the placement distance, and the routed parasitic network. A graph of gates can show reachability, but it cannot explain why endpoint Y missed setup by 80 picoseconds or which resize would repair it.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The better model is a typed hypergraph with stable object IDs. Cells own pins. Nets connect pins. Liberty timing arcs connect input pins to output pins inside a cell. Hierarchy names tell humans where an object came from. Physical views attach rows, coordinates, shapes, blockages, and routing resources. Timing views attach clocks, required times, arrivals, slews, loads, and slack.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Silicon_chip_3d.png', alt: 'Three-dimensional rendering of metal and polysilicon structures in a small integrated circuit cell', caption: 'A standard-cell database has to preserve both logical pins and physical shapes; later analyses attach timing and routing facts to those same objects. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Silicon_chip_3d.png.'},
        'The hypergraph part matters because a net is not just many independent edges. All loads on the same net share one driver, one parasitic network, one naming identity, and one place where buffering or routing changes propagate. The typed part matters because U1/A as a pin, n2 as a net, U1 as an instance, and A-to-Y as a timing arc answer different questions even when they sit next to each other in the diagram.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'The implementation flow begins with inputs such as Verilog for instances and net connectivity, Liberty for cell timing and pin properties, SDC for clocks and timing exceptions, and LEF/DEF-style physical data for rows, layers, pins, blockages, and placed locations. The database normalizes those inputs into objects that other tools can join. That joinability is the practical value of the netlist.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A timing or cone query is a directed walk over typed connectivity; stable IDs decide which physical and timing records travel with each edge. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Tools then build indexes over the graph instead of reparsing the whole design for every query. Driver-to-load maps answer fanout questions. Load-to-driver maps support fanin backtraces. Levelized buckets let timing visit combinational logic in a safe order. Cone marks keep debug local. Dirty sets tell incremental engines which arrivals, loads, parasitics, or reports became stale after a change.',
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        'The netlist-hypergraph view makes the fanout semantics visible. Ports A and B feed net n1, n1 enters cell U1, U1 drives net n2, and n2 reaches both a combinational inverter and a flip-flop. Drawing n2 as ordinary independent edges would miss the shared electrical object that timing, routing, and buffering must treat as one net.',
        'The cone-index view shows why production tools invest in fanin and fanout indexes. A timing endpoint can be traced backward through nets and cell arcs without visiting unrelated logic. Sequential elements act as boundaries for a combinational cone, so the analysis knows where one timing path stops and where a new clocked path begins.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an identity invariant. Every derived view must remain attached to the same source objects. If U1/A is the input pin in the netlist, then the timing arc, load calculation, placement record, routed segment, and report line for U1/A must all refer to that same pin. When that invariant holds, tools can exchange evidence rather than hand-wave across incompatible files.',
        'The traversal indexes are correct because they preserve the direction and boundary rules of the circuit. Fanout propagation follows drivers to loads. Fanin debug walks loads back to drivers. Levelization visits a combinational cell only after its drivers are known. Flip-flops, latches, clocks, generated clocks, and path exceptions define where ordinary combinational propagation must stop or change rules.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'The raw sizes are large. A modern design can have millions of instances, far more pins, and many timing arcs per cell. A full scan of every object after every ECO is wasteful, so runtime often depends less on textbook graph complexity and more on how much of the design became dirty. Incremental updates are valuable because a small resize should not force a complete timing rebuild.',
        'The costs are memory, synchronization, and cache invalidation. Driver/load indexes, cone caches, hierarchy maps, and level buckets consume space. They also must be repaired when synthesis rewrites logic, placement moves instances, routing updates parasitics, or ECO scripts reconnect nets. The database earns its keep only if those indexes remain current enough for signoff decisions, and if stale derived data is cheap to detect before it misleads a repair loop.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'This model wins anywhere several analyses need to discuss the same circuit. Static timing can flag an endpoint, placement can show where the critical cells sit, routing can show the parasitic burden, and ECO repair can ask which legal cell swaps are available. The shared netlist object lets one debug path cross all those domains.',
        'It also wins in human workflows. Engineers read reports through hierarchy names, instance names, pin names, and source modules. Flattening may improve optimization, but debug still needs a path back to the design intent. A typed netlist lets tools optimize a low-level circuit while preserving enough provenance for a person to fix it.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A netlist is not the whole chip. Delay depends on library arcs, process corners, slew, load, parasitics, clocks, exceptions, power state, placement, and routing. Treating connectivity as the final answer leads to false confidence. The netlist is the skeleton that lets other facts attach; it is not a substitute for those facts.',
        'The model also fails when names and views drift. A physical ECO that changes connectivity but leaves stale timing caches can produce a clean-looking report with bad evidence. Flattening can destroy hierarchy that debug teams need. Modeling a high-fanout net as many unrelated pairwise edges can hide buffering and load problems. The tax is database discipline.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: OpenROAD OpenSTA documentation explains gate-level timing inputs such as Verilog, Liberty, SDC, SDF, and SPEF, plus the incremental timing-engine role. The OpenSTA API notes are useful for seeing how a timing engine connects to host netlist data structures without duplicating every object.',
        'Study Static Timing Analysis Timing Graph Case Study next for arrival and required time propagation. Study Standard Cell Placement Row Legalization for the physical side, Global Routing Congestion Grid for net-resource pressure, Control Flow Graph and Dominator Tree for another graph-plus-analysis identity layer, and GraphBLAS Sparse Matrix Graph for high-throughput graph computation patterns.',
      ],
    },
  ],
};
