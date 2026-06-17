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
      heading: 'Why this exists',
      paragraphs: [
        `Chiplet interconnect exists because the old "one product, one monolithic die" assumption stopped being the only practical path for high-end systems. A giant die can be expensive, hard to yield, and forced onto one process node even when logic, SRAM, analog I/O, and memory-facing circuits want different manufacturing tradeoffs. Splitting the product into chiplets lets designers mix nodes, reuse blocks, and scale memory bandwidth.`,
        `The split creates a new problem: the package becomes a network. Compute dies, HBM stacks, cache slices, I/O chiplets, interposers, bridges, organic substrates, bumps, power delivery, and cooling all share one physical envelope. The interconnect is the data structure that makes the pieces act like one product.`,
        `For AI accelerators, this is not packaging trivia. Model throughput depends on getting weights, activations, KV cache blocks, and collective traffic to the right compute engines at the right time. A compute die with excellent arithmetic units can stall if HBM bandwidth, die-to-die reach, package escape, or thermal limits choke the feed path.`,
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first attempt is to treat chiplets as modular blocks connected by very fast wires. The intuition is attractive. Smaller dies can yield better than one large die. A mature I/O chiplet can be reused across products. A compute chiplet can use a leading logic node while analog or SerDes circuitry stays on a cheaper or better-suited node. Short in-package links can use less energy per bit than board-level links.`,
        `This view is useful, but incomplete. A fast wire is not enough. The link has width, reach, clocking, equalization, error handling, flow control, retry behavior, test hooks, lane repair, and power states. The physical implementation consumes bump pitch, routing tracks, edge length, keep-out area, package layers, and thermal margin. If the link contract does not match the workload, modularity becomes a bottleneck instead of a benefit.`,
        `A second naive approach is to optimize each die independently and leave integration for the package team. That fails because the best local die floorplan may put high-bandwidth ports on the wrong edge, create hot spots next to HBM, or require more package routing density than the substrate can provide.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is bandwidth density under physical constraints. HBM wants many short, dense connections near compute. Scale-out I/O wants routes that escape the package. Cache or SRAM chiplets want low latency and predictable ownership. Power delivery wants metal and bumps too. Heat from compute, memory, and PHY circuits changes timing margin and reliability. All of these demands compete in the same package.`,
        `The system also faces a semantic wall. Chiplets have to agree on what the link means. Is the traffic raw packet data, cache-coherent memory traffic, memory controller traffic, test access, or a private accelerator protocol? What ordering is guaranteed? What happens when a lane is weak? Without a clear contract, the package may be electrically connected but architecturally awkward.`,
        `Standards such as UCIe help by defining common die-to-die layers and expectations. They do not erase the package budget. A standard link still has to meet signal-integrity, latency, power, bump, reach, test, and thermal constraints in a particular product. Interoperability is a contract; integration is still engineering.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to model the package as a constrained graph. Dies are vertices. Die-to-die PHY lanes, HBM interfaces, interposer routes, embedded bridges, substrate traces, sideband links, test paths, and power-delivery regions are edges or shared resources. Each edge has capacity, latency, energy per bit, reach, routing density, repair options, and failure modes.`,
        `The invariant is not "maximize bandwidth." The package is healthy only when bandwidth, latency, energy, thermal margin, routability, manufacturing yield, testability, and protocol semantics close together. A topology that looks excellent on bandwidth can still overheat, lack repair margin, or force expensive software movement.`,
        `This is why chiplet interconnect feels like distributed systems inside a package. The designer must decide where state lives, how ownership moves, how congestion is handled, how faults are isolated, how much topology software can see, and which links are on the critical path. The distances are millimeters, but the questions are systems questions.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `A chiplet architecture starts by partitioning the product. Compute may sit on one or more logic dies. HBM stacks sit close to memory controllers. I/O or SerDes functions may move to a separate chiplet. SRAM, cache, security, or management logic can become separate dies when reuse or process-node economics justify it. The package topology then decides which edges must be wide, which must be low latency, and which can tolerate more protocol overhead.`,
        `The physical layer maps that topology onto bumps, lanes, routes, bridges, interposers, or substrate traces. Designers budget energy per bit, clocking, lane count, reach, equalization, redundancy, and margin. A short dense HBM interface is a different object from a longer package escape path. Both are links, but they live under different constraints.`,
        `Above the physical layer sits the protocol. It may expose memory semantics, cache coherency, packet transport, accelerator commands, debug traffic, or test modes. Flow control prevents one chiplet from overrunning another. Error detection, retry, repair, and binning protect data integrity and preserve sellable product tiers.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The package-network view proves that the important object is the edge, not only the die. HBM edges are short and wide because memory bandwidth is the accelerator feed path. I/O edges need escape and protocol support. Cache or SRAM edges need latency discipline. The interposer or substrate is not a passive background; it is the routing fabric that decides which edges can physically exist.`,
        `The tradeoff-map view proves that there is no universal best package technology. Silicon interposers buy fine routing density and HBM adjacency, but they cost money and consume scarce advanced-packaging capacity. Organic substrates can be larger and cheaper, but they cannot always provide the same dense routing. Embedded bridges concentrate fine routing where it is needed, but they impose placement constraints. Standard links improve ecosystem reuse, but they still pay the physical budget.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Chiplet systems work when the partition and the interconnect preserve the product-level invariants. A memory-side chiplet must deliver enough bandwidth with acceptable latency and energy. A coherent compute topology must preserve ordering and visibility rules. A repairable link must expose enough test information to identify weak lanes and enough redundancy to route around them. A package topology must fit within thermal and manufacturing limits.`,
        `The correctness argument is a contract argument. Each chiplet can be designed and tested against an interface contract, then integrated through a package topology that satisfies the electrical and protocol assumptions of that contract. The contract reduces the cross-product of possible interactions, but it only works if the physical implementation meets the contract margins. A protocol guarantee without signal margin is not a guarantee in silicon.`,
        `The economic reason it works is reuse and yield. A smaller die may have better defect economics than one huge die. A reusable I/O or management chiplet can amortize design cost across products. These benefits require interconnect tax below modularity gain.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `The main costs are link area, package routing, energy per bit, latency, verification, test, and supply. Wider links consume more edge length and bumps. Longer links need more signaling effort. Coherent protocols can simplify software but increase state space and verification burden. Non-coherent protocols can be simpler in hardware but push data-placement and synchronization work into drivers, runtimes, compilers, or application code.`,
        `When the product scales, topology matters as much as aggregate bandwidth. Doubling compute chiplets can more than double communication pressure if all dies need all-to-all sharing. Adding HBM stacks raises capacity and bandwidth but also increases routing density, package size, and thermal coupling. Every "more" has a package bill.`,
        `A useful rule is to separate bandwidth, locality, and ownership. Bandwidth says how many bits can move. Locality says how far and how often they need to move. Ownership says which chiplet is allowed to treat the state as current. Many bad chiplet designs buy bandwidth to compensate for poor locality or unclear ownership.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Chiplet interconnect wins when modularity lines up with real workload boundaries. AI packages are a strong fit because compute, HBM, I/O, management, and sometimes cache have different physical needs. Server CPUs can use chiplets when cores, I/O, memory controllers, and cache scale better as separate dies. Networking and accelerator products can reuse I/O chiplets while changing the compute die across generations.`,
        `It also wins when supply and yield dominate. A company may build more sellable units by assembling several tested smaller dies than by waiting for one enormous die to yield well. It may also ship product variants by binning chiplets and disabling weak lanes or dies. In that sense, the interconnect is tied to manufacturing strategy, not just architecture.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Chiplets fail when the interconnect is treated as a back-end detail. If a workload needs tight shared state and the chosen link adds too much latency, the partition is wrong. If HBM bandwidth cannot reach compute at low enough energy, the arithmetic units stall. If thermal coupling forces lower clocks, the package can lose the performance it was meant to unlock. If advanced packaging capacity is scarce, a technically elegant topology can miss its business target.`,
        `They also fail when standards are mistaken for integration. UCIe-style contracts help the ecosystem, but they do not remove signal integrity, mechanical stress, warpage, power delivery, cooling, test escape, firmware, or software scheduling problems. A standard interface can still be used in a product whose topology is poor for the workload.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Chiplet Link Budget and Repair Lane next to understand how weak physical lanes become yield and reliability decisions. Study Known-Good-Die Yield Ledger to connect interconnect repair with manufacturing economics. Study GPU All-Reduce and Transformer Inference Roofline to see why bandwidth and communication topology shape AI throughput. Study cache coherence, backpressure, load balancing, and KV-cache placement to connect package links to software behavior.`,
        `Primary and official sources for this page are the UCIe overview at https://www.uciexpress.org/ and the UCIe about page at https://www.uciexpress.org/why-choose-us. Read them as interface-contract material, then return to the package graph: a common contract is useful only when the product topology, physical link, thermal envelope, and manufacturing flow can honor it.`,
      ],
    },
  ],
};
