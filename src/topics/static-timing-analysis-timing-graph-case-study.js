// Static timing analysis propagates arrival and required times over a timing
// graph, then reports slack without simulating input vectors.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'static-timing-analysis-timing-graph-case-study',
  title: 'Static Timing Analysis Timing Graph Case Study',
  category: 'Systems',
  summary: 'An EDA timing case study: timing graph vertices, Liberty arcs, clocks, arrival time, required time, slack, setup/hold checks, incremental dirty cones, and timing-closure ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['arrival required slack', 'incremental update'], defaultValue: 'arrival required slack' },
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

function timingGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'clk', label: 'CLK', x: 0.8, y: 5.5, note: notes.clk || 'period' },
      { id: 'launch', label: 'FF1', x: 1.4, y: 3.0, note: notes.launch || 'Q' },
      { id: 'u1', label: 'U1', x: 3.3, y: 2.2, note: notes.u1 || 'arc' },
      { id: 'u2', label: 'U2', x: 5.1, y: 3.0, note: notes.u2 || 'arc' },
      { id: 'u3', label: 'U3', x: 6.7, y: 2.1, note: notes.u3 || 'load' },
      { id: 'capture', label: 'FF2', x: 8.4, y: 3.0, note: notes.capture || 'D' },
      { id: 'req', label: 'REQ', x: 8.4, y: 5.2, note: 'constraint' },
    ],
    edges: [
      { id: 'e-clk-launch', from: 'clk', to: 'launch', weight: 'launch' },
      { id: 'e-launch-u1', from: 'launch', to: 'u1', weight: 'clk->Q' },
      { id: 'e-u1-u2', from: 'u1', to: 'u2', weight: '+120ps' },
      { id: 'e-u2-u3', from: 'u2', to: 'u3', weight: '+210ps' },
      { id: 'e-u3-capture', from: 'u3', to: 'capture', weight: '+90ps' },
      { id: 'e-clk-req', from: 'clk', to: 'req', weight: 'period' },
      { id: 'e-req-capture', from: 'req', to: 'capture', weight: 'setup' },
    ],
  }, { title });
}

function timingTable(title) {
  return matrixState({
    title,
    rows: [
      { id: 'launch', label: 'FF1/Q' },
      { id: 'u1', label: 'U1/Y' },
      { id: 'u2', label: 'U2/Y' },
      { id: 'capture', label: 'FF2/D' },
    ],
    columns: [
      { id: 'arr', label: 'arr' },
      { id: 'req', label: 'req' },
      { id: 'slack', label: 'slack' },
    ],
    values: [
      [0.08, 0.68, 0.60],
      [0.20, 0.56, 0.36],
      [0.41, 0.35, -0.06],
      [0.50, 0.44, -0.06],
    ],
    format: (value) => `${Math.round(value * 1000)}ps`,
  });
}

function* arrivalRequiredSlack() {
  yield {
    state: timingGraph('Timing graph separates data and clock constraints'),
    highlight: { active: ['launch', 'u1', 'u2', 'u3', 'capture'], compare: ['clk', 'req'], found: ['e-u2-u3'] },
    explanation: 'Static timing analysis builds a directed timing graph from sequential endpoints, combinational arcs, clock definitions, and constraints. It checks every modeled path without simulating all vectors.',
    invariant: 'Every arrival, required, and slack value is indexed by vertex, timing sense, corner, and clock edge.',
  };

  yield {
    state: timingTable('Arrival, required, slack'),
    highlight: { active: ['launch:arr', 'u1:arr', 'u2:arr'], compare: ['u2:req', 'capture:req'], found: ['u2:slack', 'capture:slack'] },
    explanation: 'Arrival time propagates forward from launches. Required time propagates backward from constraints. Slack is required minus arrival, so negative slack marks a timing violation.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'path node', min: 0, max: 4 }, y: { label: 'ns', min: 0, max: 0.75 } },
      series: [
        { id: 'arr', label: 'arr', points: [{ x: 0, y: 0.08 }, { x: 1, y: 0.20 }, { x: 2, y: 0.41 }, { x: 3, y: 0.50 }] },
        { id: 'req', label: 'req', points: [{ x: 0, y: 0.68 }, { x: 1, y: 0.56 }, { x: 2, y: 0.35 }, { x: 3, y: 0.44 }] },
      ],
      markers: [
        { id: 'fail', label: 'slack<0', x: 2, y: 0.41 },
        { id: 'end', label: 'end', x: 3, y: 0.50 },
      ],
    }, { title: 'Violation appears where arrival crosses required' }),
    highlight: { active: ['arr'], compare: ['req'], found: ['fail', 'end'] },
    explanation: 'A timing report is a path explanation: the cumulative arrival curve overtakes the required curve, so timing closure needs buffering, resizing, placement movement, or constraint repair.',
  };

  yield {
    state: labelMatrix(
      'Timing closure ledger',
      [
        { id: 'setup', label: 'setup' },
        { id: 'hold', label: 'hold' },
        { id: 'slew', label: 'slew' },
        { id: 'cap', label: 'cap' },
      ],
      [
        { id: 'symptom', label: 'symptom' },
        { id: 'repair', label: 'repair' },
      ],
      [
        ['arrives late', 'resize/move'],
        ['arrives early', 'delay clk'],
        ['slow edge', 'resize'],
        ['too much load', 'split fanout'],
      ],
    ),
    highlight: { active: ['setup:symptom', 'setup:repair'], compare: ['hold:symptom'], found: ['cap:repair'] },
    explanation: 'Slack is not a single problem class. Setup, hold, slew, capacitance, and clock violations point to different repair moves and different risk.',
  };
}

function* incrementalUpdate() {
  yield {
    state: timingGraph('An ECO dirties only part of the timing graph', { u2: 'resized', u3: 'dirty', capture: 'endpoint' }),
    highlight: { active: ['u2', 'u3', 'capture'], compare: ['launch', 'u1'], found: ['e-u2-u3', 'e-u3-capture'] },
    explanation: 'After a buffer is resized or a net parasitic changes, a good STA engine invalidates the affected fanout/fanin cone instead of recomputing the whole chip.',
    invariant: 'Dirty propagation must include both forward arrival effects and backward required-time effects.',
  };

  yield {
    state: labelMatrix(
      'Incremental timing queues',
      [
        { id: 'dirty', label: 'dirty' },
        { id: 'arrive', label: 'arr' },
        { id: 'require', label: 'req' },
        { id: 'report', label: 'report' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'order', label: 'order' },
      ],
      [
        ['U2 arc changed', 'enqueue'],
        ['fanout levels', 'forward'],
        ['endpoints', 'backward'],
        ['worst paths', 'refresh'],
      ],
    ),
    highlight: { active: ['dirty:state', 'arrive:order'], found: ['require:order', 'report:state'] },
    explanation: 'Incremental timing is a dependency graph problem: changed arcs invalidate cached arrival and required values, then level order recomputes only what can change.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'changed arcs', min: 0, max: 1000 }, y: { label: 'work %', min: 0, max: 100 } },
      series: [
        { id: 'incr', label: 'incr', points: [{ x: 10, y: 3 }, { x: 100, y: 11 }, { x: 500, y: 34 }, { x: 1000, y: 52 }] },
        { id: 'full', label: 'full', points: [{ x: 10, y: 100 }, { x: 100, y: 100 }, { x: 500, y: 100 }, { x: 1000, y: 100 }] },
      ],
      markers: [
        { id: 'eco', label: 'ECO', x: 100, y: 11 },
        { id: 'cap', label: 'full', x: 1000, y: 100 },
      ],
    }, { title: 'Dirty cones keep ECO timing interactive' }),
    highlight: { active: ['incr'], compare: ['full'], found: ['eco', 'cap'] },
    explanation: 'The whole point of incremental STA is human iteration speed. If every ECO recomputes every corner and every path from scratch, timing closure stalls.',
  };

  yield {
    state: labelMatrix(
      'STA data structures',
      [
        { id: 'graph', label: 'graph' },
        { id: 'arc', label: 'arc' },
        { id: 'corner', label: 'corner' },
        { id: 'cache', label: 'cache' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['vertices edges', 'bad topology'],
        ['delay tables', 'slew/load'],
        ['PVT views', 'missed mode'],
        ['arr req slack', 'stale values'],
      ],
    ),
    highlight: { active: ['graph:stores', 'arc:stores', 'cache:stores'], compare: ['corner:risk'], found: ['cache:risk'] },
    explanation: 'STA is graph propagation plus cache discipline. Multi-corner multi-mode analysis multiplies the state, so explicit keys and provenance matter.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'arrival required slack') yield* arrivalRequiredSlack();
  else if (view === 'incremental update') yield* incrementalUpdate();
  else throw new InputError('Pick a static-timing view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a graph of timing evidence. A timing graph has nodes for pins or timing points and edges for delays through cells or wires. Active nodes are the points whose arrival time, required time, or slack is being propagated.',
        'Visited nodes have stable timing values for the current pass. Found markers identify the path or endpoint that currently limits the design. The safe inference is that a negative slack endpoint proves at least one path arrives later than the clock constraint permits.',
        {type:'callout', text:'STA turns timing closure into graph propagation, where every slack number is evidence from arrival, required time, constraints, and corner state.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/6b/SPI_timing_diagram2.svg', alt:'SPI digital timing diagram showing clock and data waveforms over time.', caption:'SPI bus timing diagram. Cburnett; derivative by Jordsan, Wikimedia Commons, CC BY-SA 3.0 or GFDL.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A synchronous chip must deliver data from one storage element to the next before the receiving clock edge needs it. Simulation can test selected input vectors, but timing closure needs a structural guarantee across many paths, process corners, voltages, temperatures, and modes.',
        'Static timing analysis exists to compute that guarantee without enumerating every logic value. It treats the circuit as a graph of delays and constraints, then propagates worst-case arrival and required times. The result is a ledger of which paths meet the clock and which paths must be fixed.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to run simulations and watch waveforms. That can show a failing case when the test vector covers it. It cannot prove that every possible path and mode meets timing because the input space is enormous.',
        'Another obvious approach is to add all gate delays along every named path by hand. That fails because real chips have reconvergent fanout, generated clocks, setup checks, hold checks, false paths, multi-cycle paths, and corner-specific libraries. Timing needs a graph algorithm plus constraint semantics.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is path explosion. Even a modest combinational network can contain a huge number of source-to-sink paths. Enumerating each path separately wastes work because many paths share prefixes and subgraphs.',
        'The second wall is that a single delay number is not enough. Setup analysis wants late data and early capture, while hold analysis wants early data and late capture. Corners, clock uncertainty, slew, load, and derating all change the graph values.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use dynamic programming on a directed timing graph. Arrival time records the latest or earliest time a signal can reach a node. Required time records the deadline imposed by downstream clocks and checks. Slack is required time minus arrival time for setup, with analogous polarity for hold checks.',
        'The graph order matters. Once all predecessors of a node have valid arrivals, the node arrival is the maximum or minimum over predecessor arrival plus edge delay. Once all successors have valid required times, the required time propagates backward. Shared subgraphs are computed once per mode and corner.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The tool builds graph vertices for pins and timing arcs from standard-cell libraries, net parasitics, clock definitions, and constraints. Forward propagation computes arrival times from clock launches, input ports, and generated-clock sources. Backward propagation computes required times from captures, output ports, and timing exceptions.',
        'For setup, a path fails when data arrives after the allowed capture deadline. For hold, a path fails when data can arrive too early and overwrite old data before the hold window closes. Reports then rank endpoints, paths, and arcs so optimization can resize cells, move placement, buffer nets, or adjust constraints.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from the longest-path or shortest-path recurrence on an acyclic timing graph after sequential boundaries are cut by clock constraints. If every predecessor arrival is a conservative bound, then taking the worst predecessor plus edge delay gives a conservative bound at the current node. Induction over topological order carries that guarantee to endpoints.',
        'The backward pass is dual. If every successor required time is a valid deadline, subtracting edge delay gives the latest safe time at the current node for that successor. Taking the tightest successor deadline preserves safety for all downstream checks.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'A single propagation pass is roughly O(V + E) for vertices and timing arcs, but real STA multiplies that by modes, corners, clock analyses, and incremental update work. If edge count doubles, the core propagation work roughly doubles. The expensive constants are parasitic delay calculation, slew and load interpolation, and report generation.',
        'Memory holds graph topology, per-corner arrival and required times, slews, loads, constraints, exceptions, and path backpointers. Incremental STA saves time by recomputing only the affected fanin and fanout cones after a placement or sizing change. That is why timing tools are built around dependency tracking.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'STA is central to digital chip signoff. It is used after synthesis, placement, clock-tree synthesis, routing, engineering change orders, and final signoff because each stage changes delay. The useful output is not one score; it is a ranked map of failing checks and timing margin.',
        'It also guides optimization. A placer can pull critical cells together, a synthesis tool can resize gates, a router can reduce detours, and a clock-tree tool can manage skew. Timing analysis is the feedback signal that tells those tools whether the physical design still obeys the clock contract.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'STA fails when the model is wrong. Missing constraints, incorrect false paths, bad parasitics, wrong clock definitions, or unrealistic corners can produce clean reports for a broken chip. The algorithm can only prove properties of the graph and constraints it was given.',
        'It also abstracts away functional correlation. Static analysis may report paths that cannot occur in real operation unless constraints mark them false or multi-cycle. Over-constraining wastes area and power, while under-constraining risks silicon failure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a launch flip-flop clock edge is at 0 ns, clock-to-Q is 0.08 ns, combinational arcs are 0.22 ns, 0.31 ns, and 0.19 ns, and setup time at the capture flip-flop is 0.06 ns. Data arrival is 0.08 + 0.22 + 0.31 + 0.19 = 0.80 ns. With a 1.00 ns clock and 0.04 ns uncertainty, the required time is 1.00 - 0.06 - 0.04 = 0.90 ns.',
        'Slack is 0.90 - 0.80 = 0.10 ns, so the setup check passes by 100 ps. If routing later adds 0.14 ns to one net, arrival becomes 0.94 ns and slack becomes -0.04 ns. The path is now 40 ps late, and the report tells optimization where the margin was lost.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources start with OpenSTA documentation at https://openroad.readthedocs.io/en/latest/main/src/sta/README.html. Then inspect the OpenSTA repository at https://github.com/The-OpenROAD-Project/OpenSTA and Liberty timing-library documentation from EDA vendors.',
        'Study Directed Acyclic Graph Longest Path for propagation and Standard Cell Placement for physical delay. Then use Clock Tree Synthesis, Elmore Delay, and Constraint Graphs to connect graph timing to clock and wire behavior.',
      ],
    },
  ],
};
