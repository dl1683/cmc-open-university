// Chiplet interconnect case study: the package becomes a network where
// bandwidth density, energy per bit, standards, thermals, and supply chain all
// constrain AI accelerator design.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'chiplet-interconnect-case-study',
  title: 'Chiplet Interconnect Case Study',
  category: 'Systems',
  summary: 'Modern AI packages are tiny distributed systems: compute dies, HBM stacks, interposers, organic substrates, and UCIe-style links.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['package network', 'tradeoff map'], defaultValue: 'package network' },
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
  return matrixState({
    title,
    rows,
    columns,
    values: labelsByRow.map((row) => row.map(code)),
    format: (value) => labels[value],
  });
}

function packageGraph(title) {
  return graphState({
    nodes: [
      { id: 'gpu', label: 'compute die', x: 4.9, y: 3.6, note: 'AI accelerator' },
      { id: 'hbm0', label: 'HBM stack A', x: 1.0, y: 1.5, note: 'high bandwidth memory' },
      { id: 'hbm1', label: 'HBM stack B', x: 1.0, y: 5.7, note: 'high bandwidth memory' },
      { id: 'io', label: 'I/O chiplet', x: 8.5, y: 1.5, note: 'network and PCIe' },
      { id: 'cache', label: 'cache chiplet', x: 8.5, y: 5.7, note: 'SRAM or logic' },
      { id: 'interposer', label: 'interposer/substrate', x: 4.9, y: 6.9, note: 'routing fabric' },
      { id: 'package', label: 'package boundary', x: 4.9, y: 0.7, note: 'power, heat, yield' },
    ],
    edges: [
      { id: 'e-hbm0-gpu', from: 'hbm0', to: 'gpu', weight: 'wide memory link' },
      { id: 'e-hbm1-gpu', from: 'hbm1', to: 'gpu', weight: 'wide memory link' },
      { id: 'e-gpu-io', from: 'gpu', to: 'io', weight: 'die-to-die' },
      { id: 'e-gpu-cache', from: 'gpu', to: 'cache', weight: 'die-to-die' },
      { id: 'e-interposer-gpu', from: 'interposer', to: 'gpu', weight: 'routing density' },
      { id: 'e-package-gpu', from: 'package', to: 'gpu', weight: 'power and thermals' },
    ],
  }, { title });
}

function* packageNetwork() {
  yield {
    state: packageGraph('A chiplet package is a network in miniature'),
    highlight: { active: ['gpu', 'hbm0', 'hbm1', 'io', 'cache'], found: ['interposer'] },
    explanation: 'A modern AI accelerator package is not one simple chip. It is compute, memory, I/O, cache, routing, power delivery, and thermal design packed into one physical system.',
  };

  yield {
    state: packageGraph('HBM links create extreme routing pressure'),
    highlight: { active: ['hbm0', 'hbm1', 'gpu', 'e-hbm0-gpu', 'e-hbm1-gpu'], compare: ['interposer'] },
    explanation: 'High-bandwidth memory needs many short, dense, low-energy connections to the compute die. That is why interposers and advanced packaging matter: the package wiring is part of the memory hierarchy.',
    invariant: 'The memory wall is also a package-routing wall.',
  };

  yield {
    state: packageGraph('Standards try to make chiplets composable'),
    highlight: { active: ['gpu', 'io', 'cache', 'e-gpu-io', 'e-gpu-cache'], found: ['package'] },
    explanation: 'UCIe-style die-to-die standards aim to make heterogeneous chiplets easier to connect. The standard does not erase physical constraints, but it gives the ecosystem a common link contract.',
  };

  yield {
    state: labelMatrix(
      'Package-level design forces',
      [
        { id: 'bandwidth', label: 'bandwidth density' },
        { id: 'energy', label: 'energy per bit' },
        { id: 'thermal', label: 'thermal coupling' },
        { id: 'supply', label: 'supply chain' },
      ],
      [
        { id: 'pressure', label: 'pressure' },
        { id: 'design', label: 'design response' },
      ],
      [
        ['many wires per edge', 'short dense die-to-die links'],
        ['every bit costs power', 'low-swing local signaling'],
        ['hot logic near memory', 'placement and cooling constraints'],
        ['limited packaging capacity', 'standardization and alternatives'],
      ],
    ),
    highlight: { active: ['bandwidth:pressure', 'thermal:pressure'], found: ['supply:design'] },
    explanation: 'The important lesson is multidimensional. A link can be fast but too power hungry, dense but thermally awkward, or technically excellent but trapped behind scarce packaging capacity.',
  };
}

function* tradeoffMap() {
  yield {
    state: labelMatrix(
      'Interposer versus organic package substrate',
      [
        { id: 'silicon', label: 'silicon interposer' },
        { id: 'organic', label: 'organic substrate' },
        { id: 'bridge', label: 'embedded bridge' },
        { id: 'standard', label: 'standard link' },
      ],
      [
        { id: 'strength', label: 'strength' },
        { id: 'constraint', label: 'constraint' },
      ],
      [
        ['very fine routing', 'cost and capacity'],
        ['cheaper and larger', 'lower routing density'],
        ['local dense links', 'placement constraints'],
        ['ecosystem reuse', 'must meet physical budgets'],
      ],
    ),
    highlight: { active: ['silicon:strength', 'organic:constraint'], found: ['standard:strength'] },
    explanation: 'The case study is not silicon good, organic bad. It is about matching routing density, cost, reach, yield, thermals, and ecosystem needs to the chiplet topology.',
  };

  yield {
    state: labelMatrix(
      'What the interconnect must carry',
      [
        { id: 'data', label: 'data' },
        { id: 'control', label: 'control' },
        { id: 'coherence', label: 'coherence' },
        { id: 'test', label: 'test and repair' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'failure', label: 'if weak' },
      ],
      [
        ['high throughput', 'memory stalls'],
        ['low latency ordering', 'protocol bubbles'],
        ['shared view of state', 'software complexity rises'],
        ['manufacturing observability', 'yield losses stay opaque'],
      ],
    ),
    highlight: { active: ['data:need', 'coherence:need'], compare: ['test:failure'] },
    explanation: 'A die-to-die link is more than raw bits. Protocol, flow control, ordering, coherency, debug, and repair decide whether chiplets behave like one product instead of a pile of dies.',
  };

  yield {
    state: packageGraph('Chiplet systems inherit distributed-systems questions'),
    highlight: { active: ['package', 'interposer', 'gpu'], found: ['hbm0', 'io', 'cache'] },
    explanation: 'Inside one package, the questions sound familiar: where is state, who owns bandwidth, what happens on failure, how are hot spots isolated, and which interface becomes the bottleneck?',
  };

  yield {
    state: labelMatrix(
      'AI accelerator implications',
      [
        { id: 'hbm', label: 'HBM capacity' },
        { id: 'compute', label: 'compute chiplets' },
        { id: 'io', label: 'scale-out I/O' },
        { id: 'cost', label: 'unit economics' },
      ],
      [
        { id: 'system', label: 'system question' },
        { id: 'link', label: 'link pressure' },
      ],
      [
        ['how much context fits?', 'memory bandwidth density'],
        ['how many dies per package?', 'latency and coherency'],
        ['how fast to other nodes?', 'SerDes and package escape'],
        ['how many can be built?', 'yield and packaging supply'],
      ],
    ),
    highlight: { found: ['hbm:link', 'compute:link'], active: ['cost:system'] },
    explanation: 'The package now shapes the AI business model. If memory bandwidth, yield, or packaging supply constrains shipped accelerators, software teams feel it as price, availability, and context limits.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'package network') yield* packageNetwork();
  else if (view === 'tradeoff map') yield* tradeoffMap();
  else throw new InputError('Pick a chiplet interconnect view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the package-network view as a graph. A graph has nodes and edges; here the nodes are chiplets such as compute dies, memory stacks, I/O dies, and cache slices, while the edges are the physical and protocol links between them. The active edge is the resource currently being tested for bandwidth, latency, power, and routing pressure.',
        'The tradeoff-map view shows why package design is not one best technology. A silicon interposer, organic substrate, bridge, and standard die-to-die link each buy different routing density, cost, reach, and supply behavior. The safe inference is that a chiplet plan is only good when the workload traffic fits the package graph.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Chiplet interconnect exists because one large monolithic die is no longer the only practical way to build high-end systems. A monolithic die is a single piece of silicon; if it grows large, defects become more expensive and every function must use the same manufacturing process. Chiplets split the product into smaller dies that can be manufactured, tested, reused, and packaged together.',
        'That split creates a new architecture problem. The package becomes a network that must move weights, activations, cache lines, memory requests, and control traffic between dies. A compute die with excellent arithmetic units can still stall if the interconnect cannot feed it at the right bandwidth and latency.',
        {type:'callout', text:'A chiplet package should be designed as a constrained network whose links, not just dies, determine system performance.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/1/1f/Power5.jpg', alt:'Ceramic multi-chip module with several processor and cache dies on one package', caption:'IBM POWER5 ceramic multi-chip module showing multiple dies on one package. Source: Wikimedia Commons, Carsten Schulz, CC BY-SA 3.0/GFDL.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to treat chiplets as modular blocks connected by very fast wires. That intuition is useful because smaller dies can yield better, mature I/O chiplets can be reused, and leading-edge logic can be reserved for the parts that need it. Short in-package links can also use less energy per bit than board-level links.',
        'A second obvious approach is to optimize each die first and leave package integration for later. That feels efficient because each team can improve its own block. It breaks when the best local floorplan puts high-bandwidth ports on the wrong edge, creates hot spots beside HBM, or asks the substrate for more routing density than it can deliver.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that the package has finite edge length, bumps, routing layers, power delivery, and thermal headroom. HBM wants many short dense connections near compute, scale-out I/O wants escape routes, and cache traffic wants low latency. These demands compete in the same physical envelope.',
        'There is also a semantic wall. A link must define what traffic means: cache-coherent memory, raw packets, command streams, debug access, or test traffic. If two chiplets are electrically connected but disagree about ordering, retries, flow control, or failure handling, the package is wired but not architecturally sound.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to model the package as a constrained graph. Each edge has bandwidth, latency, energy per bit, reach, routability, repair margin, thermal coupling, and protocol meaning. The goal is not to maximize one edge; it is to close the whole graph under the workload.',
        'The invariant is system balance. A healthy topology keeps compute, memory, I/O, cache ownership, power, heat, manufacturing yield, and testability inside their limits at the same time. A design that wins on raw bandwidth can still fail if it overheats, cannot be tested, or forces software to move data constantly.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'Design starts by partitioning the product. Compute may live on one or more logic dies, HBM stacks sit close to memory controllers, I/O can move to a separate chiplet, and management logic may be reused across products. The topology then decides which edges need to be wide, which need to be low latency, and which can tolerate protocol overhead.',
        'The physical layer maps those edges onto bumps, bridges, interposers, redistribution layers, and substrate traces. Above it, the protocol layer defines flow control, ordering, errors, retries, coherency, and test access. The package works only when the physical route and the protocol contract agree.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Chiplet interconnect works when each interface contract is strong enough to limit cross-die uncertainty. A chiplet can be designed against a bandwidth, latency, voltage, ordering, and error-handling promise. Integration becomes tractable because each die does not need to know every internal detail of every other die.',
        'The correctness argument is a contract argument. If every transaction that crosses an edge obeys the protocol, and the physical implementation preserves timing and signal margin for that edge, then the receiving chiplet sees legal traffic. If either side of that contract fails, no amount of modular packaging makes the system correct.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The costs are edge area, bump count, package routing, PHY power, latency, verification state space, test flow, and supply capacity. Doubling compute chiplets can more than double traffic if the workload needs all-to-all sharing. Adding HBM raises bandwidth but also raises routing density, package area, and thermal coupling.',
        'The economic trade is yield and reuse versus interconnect tax. If splitting a 600 mm2 die into four 150 mm2 chiplets improves sellable die yield but adds 15 percent package cost and 8 percent communication overhead, the split can still win. If the workload spends most time waiting on cross-chiplet traffic, the modularity gain disappears.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Chiplet interconnect fits AI accelerators, server CPUs, networking chips, and memory-rich packages where functions have different process and bandwidth needs. AI packages are a strong example because compute, HBM, I/O, cache, and management logic each want different physical placement. The interconnect turns those pieces into one accelerator instead of separate chips on a board.',
        'It also fits product lines that reuse blocks. A company can pair a new compute die with an existing I/O die, or sell product tiers by combining different bins of chiplets. That only works if the die-to-die contracts and package graph were designed for reuse instead of one lucky assembly.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when partitioning ignores traffic locality. If two blocks exchange state every cycle, putting them on separate chiplets can add latency, energy, and verification cost. If HBM bandwidth cannot reach the compute die at low enough energy, arithmetic units sit idle despite impressive peak FLOPS.',
        'It also fails when standards are mistaken for integration. UCIe-style interfaces help with ecosystem contracts, but they do not remove signal-integrity, power-delivery, cooling, warpage, firmware, test, or scheduling work. A standard edge can still be the wrong edge for the workload.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an accelerator has four compute chiplets, each needing 1 TB/s of local memory bandwidth and 200 GB/s of peer traffic during tensor-parallel all-reduce. If each compute chiplet has an HBM edge that delivers 1.2 TB/s usable bandwidth, memory has 20 percent headroom. If the peer network offers only 100 GB/s per neighbor, the all-reduce path is the bottleneck even though the package advertises high aggregate bandwidth.',
        'Now compare two floorplans. In floorplan A, each compute die sits beside HBM but peer links cross long routes, adding latency and PHY power. In floorplan B, compute dies form a tighter mesh but two HBM stacks move farther away. The right answer depends on measured workload traffic: a memory-bound model prefers A, while a communication-heavy model may prefer B.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with the UCIe overview at https://www.uciexpress.org/ and the UCIe about page at https://www.uciexpress.org/why-choose-us. Read them as interface-contract sources, not as proof that integration is solved. The transferable lesson is that a common link contract helps only when the product topology can honor it physically and thermally.',
        'Study Chiplet Link Budget and Repair Lane for the physical margin view, and Known-Good-Die Yield Ledger for manufacturing evidence. Study GPU all-reduce, transformer inference rooflines, cache coherence, flow control, and KV-cache placement to see how software traffic turns package edges into system bottlenecks.',
      ],
    },
  ],
};