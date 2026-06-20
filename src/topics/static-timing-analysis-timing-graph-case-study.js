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
      heading: 'Why this exists',
      paragraphs: [
        'Static timing analysis exists because a digital design can be logically correct and still fail in silicon. Signals must arrive early enough for setup, not too early for hold, with acceptable slew and load, across process, voltage, temperature, clock, and mode corners.',
        'Exhaustive simulation cannot cover every input vector and timing path in a large chip. STA turns the design into a timing graph and checks timing constraints without simulating functional behavior. It asks whether every modeled path has enough timing margin.',
        {type:'callout', text:'STA turns timing closure into graph propagation, where every slack number is evidence from arrival, required time, constraints, and corner state.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/6b/SPI_timing_diagram2.svg', alt:'SPI digital timing diagram showing clock and data waveforms over time.', caption:'SPI bus timing diagram. Cburnett; derivative by Jordsan, Wikimedia Commons, CC BY-SA 3.0 or GFDL.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to simulate a few important paths and inspect waveforms. That misses rare paths, false assumptions about clocks, and corner cases where a cell delay changes under load or process variation.',
        'Another beginner approach is to add up one launch-to-capture path by hand. Real timing closure has millions of arcs, generated clocks, clock uncertainty, exceptions, reconvergent paths, slew propagation, and incremental design changes. The hand path becomes a graph problem.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A timing graph represents pins or timing points as vertices and cell or net delay arcs as edges. Arrival times propagate forward from launch points. Required times propagate backward from capture constraints. Slack is the difference between required and arrival.',
        'Setup and hold are different checks. Setup asks whether data arrives before the capture edge with enough margin. Hold asks whether data stays stable long enough after the launch edge. Fixing one can hurt the other, so timing closure tracks both separately.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The tool reads a netlist, timing libraries, parasitics, clock definitions, and constraints. Library arcs describe how input slew and output load affect delay. Parasitics describe wire resistance and capacitance. Constraints describe clocks, generated clocks, exceptions, and uncertainty.',
        'Forward propagation computes arrival times through data arcs. Backward propagation computes required times from endpoints. Slack reports identify the worst paths, including launch clock, data path delay, capture clock, uncertainty, and exception effects.',
        'Incremental STA updates only affected regions after an engineering change order. Resizing a cell, inserting a buffer, or changing placement dirties timing values in related cones. Correct invalidation is central because stale timing data can make optimization chase the wrong path.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The arrival-required view proves that STA is two waves over one graph. Arrival moves forward with data. Required time moves backward from constraints. Negative slack appears where the data wave arrives later than the requirement permits.',
        'The incremental view proves why timing tools behave like worklist algorithms. A small edit can dirty a local cone rather than the whole design, but only if the dependency keys include mode, corner, clock edge, slew, load, and exception state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'STA works because synchronous timing paths can be conservatively modeled between sequential boundaries. If the graph, library models, parasitics, and constraints are accurate, propagation can prove timing margins without trying every logical input sequence.',
        'Path reports work because they preserve provenance. An engineer can see which clock launched the data, which arcs contributed delay, which net loads mattered, which clock captured the data, and which constraint created the required time.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'STA is computationally heavy because every timing value is keyed by multiple dimensions: mode, corner, transition direction, clock edge, slew, load, and path type. A signoff run may analyze many corners and produce many path reports.',
        'The tradeoff is conservatism versus design effort. Too much pessimism wastes area and power because engineers over-fix safe paths. Too little pessimism risks silicon failure. Good constraints and accurate extraction matter as much as the graph algorithm.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'STA wins in chip implementation, FPGA closure, ECO loops, physical design signoff, and any flow where timing must be checked across many paths and corners. It gives engineers a prioritized list of violations instead of a pile of waveforms.',
        'It is also a useful general data-structures case study. The timing engine is graph propagation, caching, invalidation, priority queues, and provenance reporting under industrial constraints.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The first failure is bad constraints. A false path that is not actually false can hide a real violation. A missing generated clock can make an entire domain meaningless. A careless multicycle exception can make a report look clean while the chip is unsafe.',
        'The second failure is model mismatch. Liberty arcs, parasitics, voltage corners, clock uncertainty, and physical placement must match reality closely enough. STA proves timing for the model it was given, not for the chip you wish you had modeled.',
      ],
    },
    {
      heading: 'Implementation checklist',
      paragraphs: [
        'Keep setup, hold, slew, capacitance, and clock-domain findings separate. A setup repair that upsizes a cell can increase load or create hold risk elsewhere. Timing closure is a ledger of interacting constraints.',
        'Treat incremental timing as a cache-invalidation problem. If a change affects delay, slew, load, clock, or exception applicability, the dirty cone must include every value that depended on the old fact.',
        'Read a path report as evidence, not as a score. Check launch, capture, clocks, arc delays, net delays, uncertainty, exceptions, and physical context before deciding whether to resize, buffer, move, or change constraints.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Consider a setup path from FF1 through two logic gates and a long net into FF2. Arrival starts at the launch clock edge, adds clock-to-Q, cell delays, wire delay, and setup requirement at the capture flop. If arrival exceeds required time, slack is negative.',
        'A repair might upsize the slow gate, insert a buffer on the long net, move cells closer, or adjust placement congestion. Each repair changes delay and load. The timing engine must recompute affected arrivals and required times before the next path report is trusted.',
        'Now consider hold. The shortest path, not the longest path, may be dangerous. A setup fix that speeds the data path can create a hold violation elsewhere. This is why timing closure is a balancing process rather than a single shortest or longest path calculation.',
      ],
    },
    {
      heading: 'How to choose repairs',
      paragraphs: [
        'Use cell sizing when logic delay dominates and power or area budget allows it. Use buffering when wire delay or fanout dominates. Use placement changes when physical distance or congestion is the root cause. Use constraint changes only when the original constraint was genuinely wrong.',
        'Do not repair from the worst slack number alone. Check path commonality, number of endpoints affected, hold risk, routing congestion, and whether the violation appears in one corner or many. A local fix can make global closure harder.',
        'The best timing reports teach causality. They show not only that slack is negative, but where time was spent and which model assumption made the requirement tight. That is what turns STA from a red-number generator into an engineering tool.',
      ],
    },
    {
      heading: 'What to watch in production',
      paragraphs: [
        'A production timing flow is only as good as its constraint hygiene. Treat exceptions as source code: reviewed, justified, versioned, and tied to design intent. A stale false path can be more dangerous than a visible violation because it removes the path from attention.',
        'Watch the difference between local improvement and closure progress. A repair that improves one endpoint but worsens many neighbors is a bad trade unless it unlocks a larger route. Useful dashboards show violation count, total negative slack, worst negative slack, affected endpoints, hold risk, and corner coverage together.',
        'The most educational path reports are reproducible. If an engineer cannot connect a timing number back to a cell arc, net, clock, exception, and parasitic model, the report is not yet a teaching tool. It may still be correct, but it will not help the team make better fixes.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Data-Flow Worklist Analysis, Standard Cell Netlist Hypergraph, Global Routing Congestion Grid, GraphBLAS Sparse Matrix Graph Case Study, Priority Queue, and Cache Invalidation. A useful exercise is to compute arrival, required, and slack by hand on a three-gate path, then add one resized cell and mark what must be recomputed.',
      ],
    },
  ],
};
