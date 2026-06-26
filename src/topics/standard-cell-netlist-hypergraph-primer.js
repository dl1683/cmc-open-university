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
  const graph1 = netlistGraph('Cells, pins, and nets form a typed hypergraph');
  const nodeCount = graph1.nodes.length;
  const edgeCount = graph1.edges.length;
  const nandNote = graph1.nodes.find(n => n.id === 'u1').note;
  const invNote = graph1.nodes.find(n => n.id === 'u2').note;
  const dffNote = graph1.nodes.find(n => n.id === 'ff').note;
  yield {
    state: graph1,
    highlight: { active: ['u1', 'u2', 'ff'], compare: ['n1', 'n2'], found: ['e-a-n1', 'e-b-n1', 'e-n1-u1'] },
    explanation: `A Verilog netlist is not just a graph of gates. This circuit has ${nodeCount} nodes and ${edgeCount} edges, with cells like ${nandNote}, ${invNote}, and ${dffNote}. Each net is a hyperedge that connects one driver pin to many load pins, and every pin has direction, capacitance, and timing meaning.`,
    invariant: `Cell instance, pin, net, and timing-arc IDs across all ${nodeCount} objects must remain stable across synthesis, placement, timing, and routing reports.`,
  };

  const matrixRows1 = [
    { id: 'cell', label: 'cell' },
    { id: 'pin', label: 'pin' },
    { id: 'net', label: 'net' },
    { id: 'arc', label: 'arc' },
  ];
  const matrixCols1 = [
    { id: 'key', label: 'key' },
    { id: 'payload', label: 'payload' },
    { id: 'index', label: 'index' },
  ];
  const mat1 = labelMatrix('Netlist tables', matrixRows1, matrixCols1, [
    ['U1', 'NAND2_X1', 'by id'],
    ['U1/A', 'dir cap', 'by net'],
    ['n2', 'driver loads', 'fanout'],
    ['A->Y', 'delay slew', 'Liberty'],
  ]);
  yield {
    state: mat1,
    highlight: { active: ['cell:key', 'pin:payload'], found: ['net:index', 'arc:index'] },
    explanation: `Real tools keep ${matrixRows1.length} synchronized tables (${matrixRows1.map(r => r.label).join(', ')}), each with ${matrixCols1.length} columns. The point is not one perfect graph; it is synchronized views over the same design.`,
  };

  const arcNotes = { u1: 'arc', u2: 'arc', ff: 'seq' };
  const graph2 = netlistGraph('A timing view or cone walk reuses connectivity', arcNotes);
  const seqNode = graph2.nodes.find(n => n.id === 'ff');
  yield {
    state: graph2,
    highlight: { active: ['a', 'b', 'n1', 'u1', 'n2'], compare: ['ff', 'clk'], found: ['y', 'e-u2-y'] },
    explanation: `A fanin cone for output Y starts from an endpoint and walks backward through the ${graph2.edges.length} edges. U1 and U2 are re-labeled "${arcNotes.u1}" while ${seqNode.label} is marked "${arcNotes.ff}" — sequential elements stop or restart the walk depending on the analysis mode.`,
  };

  const studyRows = [
    { id: 'netlist', label: 'netlist' },
    { id: 'timing', label: 'timing' },
    { id: 'place', label: 'place' },
    { id: 'route', label: 'route' },
  ];
  const studyCols = [
    { id: 'data', label: 'data' },
    { id: 'next', label: 'next' },
  ];
  const mat2 = labelMatrix('Study map', studyRows, studyCols, [
    ['cells pins nets', 'STA'],
    ['arcs slack', 'closure'],
    ['rows bins', 'legalize'],
    ['G-cells', 'DRC'],
  ]);
  yield {
    state: mat2,
    highlight: { active: ['netlist:data', 'timing:next'], found: ['place:next', 'route:data'] },
    explanation: `The netlist is the shared identity layer across ${studyRows.length} domains (${studyRows.map(r => r.label).join(', ')}). Each domain attaches its own ${studyCols.length}-column state to the same cells, pins, and nets.`,
  };
}

function* coneIndex() {
  const levelNotes = { u1: 'level 1', u2: 'level 2', ff: 'stop' };
  const graph3 = netlistGraph('Levelized traversal turns connectivity into worklists', levelNotes);
  const stopNode = graph3.nodes.find(n => n.note === 'stop');
  yield {
    state: graph3,
    highlight: { active: ['a', 'b', 'n1', 'u1', 'n2', 'u2'], compare: ['ff'], found: ['y'] },
    explanation: `A topological level order across ${graph3.nodes.length} nodes lets analysis visit drivers before loads for combinational paths. ${stopNode.label} is marked "${levelNotes.ff}" — flip-flops and latches create timing boundaries that stop pure combinational propagation.`,
  };

  const travRows = [
    { id: 'fanin', label: 'fanin' },
    { id: 'fanout', label: 'fanout' },
    { id: 'level', label: 'level' },
    { id: 'cone', label: 'cone' },
  ];
  const travCols = [
    { id: 'shape', label: 'shape' },
    { id: 'use', label: 'use' },
  ];
  const mat3 = labelMatrix('Traversal indexes', travRows, travCols, [
    ['loads -> driver', 'backtrace'],
    ['driver -> loads', 'propagate'],
    ['topo buckets', 'STA'],
    ['bitset / mark', 'debug'],
  ]);
  yield {
    state: mat3,
    highlight: { active: ['fanin:use', 'fanout:use'], found: ['level:shape', 'cone:use'] },
    explanation: `${travRows.length} traversal indexes (${travRows.map(r => r.label).join(', ')}) are cheap compared with repeated graph scans. Large tools also cache cones, levels, and dirty marks for incremental analysis.`,
  };

  const coneSeries = [
    { id: 'local', label: 'cone', points: [{ x: 0, y: 1 }, { x: 2, y: 8 }, { x: 4, y: 23 }, { x: 6, y: 42 }, { x: 8, y: 60 }] },
    { id: 'full', label: 'full', points: [{ x: 0, y: 1 }, { x: 2, y: 22 }, { x: 4, y: 55 }, { x: 6, y: 88 }, { x: 8, y: 118 }] },
  ];
  const coneMarkers = [
    { id: 'cut', label: 'cut', x: 4, y: 23 },
    { id: 'all', label: 'all', x: 8, y: 118 },
  ];
  const plot1 = plotState({
    axes: { x: { label: 'logic depth', min: 0, max: 8 }, y: { label: 'visited', min: 0, max: 120 } },
    series: coneSeries,
    markers: coneMarkers,
  }, { title: 'Cone indexes keep debug local' });
  yield {
    state: plot1,
    highlight: { active: ['local'], compare: ['full'], found: ['cut', 'all'] },
    explanation: `Comparing ${coneSeries.length} traversal strategies: at depth ${coneMarkers[0].x} the cone query visits only ${coneMarkers[0].y} nodes while a full scan reaches ${coneMarkers[1].y} by depth ${coneMarkers[1].x}. That is why design databases invest in fanin, fanout, and hierarchy indexes.`,
  };

  const debugRows = [
    { id: 'source', label: 'source' },
    { id: 'dirty', label: 'dirty' },
    { id: 'name', label: 'name' },
    { id: 'hier', label: 'hier' },
  ];
  const debugCols = [
    { id: 'check', label: 'check' },
    { id: 'risk', label: 'risk' },
  ];
  const mat4 = labelMatrix('Debug ledger', debugRows, debugCols, [
    ['Verilog + LEF/DEF', 'mismatch'],
    ['changed cell/net', 'stale cache'],
    ['stable ids', 'report join'],
    ['module path', 'flattening'],
  ]);
  yield {
    state: mat4,
    highlight: { active: ['source:check', 'dirty:check'], found: ['name:risk', 'hier:check'] },
    explanation: `The useful netlist database tracks ${debugRows.length} concerns (${debugRows.map(r => r.label).join(', ')}), each evaluated for ${debugCols.map(c => c.label).join(' and ')}. Every timing, placement, and routing finding can be joined back to a hierarchical instance path and source object.`,
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read each box as a typed circuit object. A cell is a placed logic instance, a pin is a named connection point on a cell, and a net is one electrical connection that can touch many pins. The highlighted net shows why this is a hypergraph: one driver can feed several loads without becoming several unrelated wires.',
        'In the cone view, active nodes are the objects reached by a fanin or fanout walk. A sequential cell such as a flip-flop acts as a boundary because timing paths normally start or stop at clocked storage. The safe inference is local: if the walk follows driver-to-load edges and stops at the declared boundary, every highlighted object belongs to that timing cone.',
        {type: 'image', src: './assets/gifs/standard-cell-netlist-hypergraph-primer.gif', alt: 'Animated walkthrough of the standard cell netlist hypergraph primer visualization', caption: 'Animation preview: the full visualization plays through each step at reading pace.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A chip flow needs one shared identity layer after logic has been mapped to standard cells. A standard cell is a reusable physical implementation of a small logic function, such as NAND, inverter, buffer, latch, or flip-flop. Synthesis, timing, placement, routing, power, and repair tools must all refer to the same cells, pins, nets, and hierarchy names.',
        {type: 'callout', text: 'A netlist is the identity ledger that lets timing, placement, routing, power, and ECO tools argue about the same physical circuit.'},
        'The netlist exists because a circuit is not only a drawing of gates. It is a database where later analyses attach arrival times, load, parasitics, coordinates, violations, and engineering-change history to stable objects. If those object identities drift, a clean report can describe a circuit that is no longer the circuit on silicon.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious model is a directed graph where gates are vertices and wires are edges. That works for a classroom circuit with one output feeding one input, and it explains reachability well enough. A learner can follow A into a NAND and then out to the next gate.',
        'Real standard-cell netlists break that picture quickly. One net can drive five loads, a clock net can drive thousands of sinks, and one cell has typed input and output pins with timing arcs between them. Turning that into pairwise edges hides the shared electrical object that routing and timing must update as one thing.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Connectivity alone does not answer physical questions. A timing path depends on the source pin, destination pin, library delay table, input slew, output load, clock constraint, placement distance, and routed parasitics. A plain graph can say that U1 reaches U7, but it cannot say why U7 missed setup by 80 picoseconds.',
        'The wall is identity across views. Timing may name U1/Y, placement may store a coordinate for U1, routing may store metal segments for net n2, and power may store switching activity on the same net. Without a shared object model, each tool has to guess how its evidence lines up with the others.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The useful model is a typed hypergraph with stable IDs. A net is a hyperedge connecting one driver pin to zero or more load pins, and a cell owns pins with library-defined timing arcs. Physical and timing facts attach to those objects instead of replacing them.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Silicon_chip_3d.png', alt: 'Three-dimensional rendering of metal and polysilicon structures in a small integrated circuit cell', caption: 'A standard-cell database has to preserve both logical pins and physical shapes; later analyses attach timing and routing facts to those same objects. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Silicon_chip_3d.png.'},
        'This is the move from a sketch to an implementation database. The graph gives reachability, the types say which moves are legal, and the stable IDs let every analysis talk about the same object. The netlist is small enough to traverse but rich enough to join with timing and physical data.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The flow reads logical connectivity from gate-level Verilog, cell behavior and timing from Liberty, constraints from SDC, and physical data from LEF and DEF style files. The database interns each cell, pin, net, port, and hierarchy path into a stable object. Later tools store derived facts beside those objects rather than reparsing the whole design.',
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Directed_graph_no_background.svg', alt: 'Directed graph with nodes connected by arrows', caption: 'A timing or cone query is a directed walk over typed connectivity; stable IDs decide which physical and timing records travel with each edge. Source: Wikimedia Commons, https://commons.wikimedia.org/wiki/File:Directed_graph_no_background.svg.'},
        'Indexes make common walks cheap. A driver-to-load map supports fanout propagation, a load-to-driver map supports fanin debug, and level buckets let timing visit combinational cells after their inputs are known. Dirty sets record which arrivals, loads, or parasitics became stale after a resize, move, or reconnect.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is an identity invariant. If a report line says U1/A, every attached fact must refer to the same pin object: connectivity, timing arc, placement location, routed load, and repair history. When that invariant holds, a timing violation can be traced across tools without changing names midstream.',
        'Traversal is correct because it respects circuit direction and boundaries. Fanout walks move from a driver through a net to load pins, while fanin walks reverse that relation. Sequential cells, clocks, generated clocks, and timing exceptions mark where ordinary combinational propagation must stop or change rule.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A full design can have millions of cells and many more pins, so a complete scan after every small change is too expensive. When instance count doubles, raw storage roughly doubles, but bad invalidation can make runtime behave as if every edit touches the whole chip. The practical cost is dominated by how much of the graph becomes dirty after an ECO, not by the size of the edited gate alone.',
        'The memory tax is real. Driver maps, load maps, hierarchy tables, cone caches, level orders, and timing objects duplicate navigational facts to avoid repeated searches. The database wins only if those indexes stay synchronized and make common debug or timing queries much cheaper than rebuilding evidence from text files.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Static timing analysis uses the netlist to propagate arrivals from clocked starts to clocked endpoints. Placement uses the same instances to choose legal rows and reduce wirelength, while routing uses the same nets to allocate tracks and vias. ECO repair uses all of those facts together when it resizes a cell, inserts a buffer, or reconnects a net.',
        'The same model supports human debug. An engineer can start from a failing endpoint, walk backward through fanin, inspect cell choices, look at physical distance, and check whether a false-path exception applies. That workflow only works when the logical, timing, and physical views share object identity.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'A netlist is not a timing proof by itself. Delay still depends on library corners, slew, load, parasitic extraction, clocks, and path exceptions. Treating connectivity as the final answer gives false confidence because the hardest evidence lives in the attached views.',
        'The model also fails when names or caches drift. Flattening can erase hierarchy that debug teams need, stale parasitics can make a repaired path look clean, and pairwise modeling of high-fanout nets can hide shared load. The tax is database discipline: every transform must update IDs, indexes, and derived facts together.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take input port A and B feeding NAND cell U1, with U1/Y driving net n2. Net n2 feeds inverter U2/A and flip-flop U3/D, so n2 has one driver and two loads. In a pairwise graph that looks like two edges, but in the netlist it is one electrical object with shared capacitance.',
        'Suppose U1 has 30 ps cell delay, U2 has 20 ps delay, and the routed net n2 adds 45 ps because it drives two loads. The path through U1 and U2 costs 95 ps before clock setup is considered. If an ECO inserts buffer B1 and splits n2 into n2a and n2b, every timing and routing fact attached to old n2 must be invalidated or remapped.',
        'A cone query from U3/D walks backward from the load pin to net n2, then to driver U1/Y, then through the U1 input arcs to A and B. It stops at input ports or sequential boundaries, so unrelated logic is never visited. The cost is proportional to the cone size, not the full design.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study OpenROAD OpenSTA documentation for the timing-engine view of Verilog, Liberty, SDC, SPEF, and host netlist adapters. Pair it with a gate-level Verilog example and a Liberty cell definition so the object types become concrete.',
        'Next, study static timing analysis for arrival and required times, standard-cell placement for physical legality, global routing for congestion, and graph traversal for cone queries so the identity invariant transfers to real implementation work.',
      ],
    },
  ],
};