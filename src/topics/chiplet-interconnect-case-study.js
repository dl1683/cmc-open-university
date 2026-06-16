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
      heading: 'What it is',
      paragraphs: [
        'Chiplet interconnect is the communication fabric inside a multi-die package. Instead of building one giant monolithic chip, a vendor can combine compute dies, HBM stacks, cache chiplets, I/O chiplets, and specialized accelerators in one package. The package then becomes a tiny distributed system where bandwidth density, latency, energy per bit, thermal coupling, yield, and supply chain all matter.',
        'The UCIe Consortium describes Universal Chiplet Interconnect Express as an open specification defining interconnect between chiplets within a package, with a goal of enabling an open chiplet ecosystem: https://www.uciexpress.org/why-choose-us. The local chiplet corpus framed the same pressure from the AI side: HBM-to-accelerator links need enormous routing density, and traditional interposer capacity can become a supply and cost bottleneck.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A chiplet package must move bits between dies over extremely short links. HBM stacks need wide, dense connections to compute. I/O chiplets need SerDes and protocol handling. Cache or SRAM chiplets need low-latency access. The interposer, bridge, or substrate provides the physical routing, while the die-to-die protocol provides framing, ordering, flow control, and sometimes coherency. The best link is not simply the fastest one; it is the link that meets bandwidth, power, reach, manufacturability, and cost targets together.',
        'Silicon interposers offer very fine routing and support dense HBM connections, but they add cost, process complexity, thermal constraints, and supply concentration. Organic substrates are cheaper and can be larger, but they historically provide lower routing density. Embedded bridges and advanced organic approaches try to localize dense routing where it is needed. UCIe and similar standards try to make the protocol side more reusable so chiplet ecosystems can form across vendors. Chiplet Link Budget & Repair Lane Case Study goes deeper on the lane budget, bump map, health telemetry, and repair ledger behind those choices.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The economics are brutal because every design force couples to the others. More HBM bandwidth needs more wires and more power. More compute dies need more package area and harder cooling. More advanced packaging can improve performance but reduce supply flexibility. If a package process is scarce, accelerators become scarce even when compute dies exist. Software teams experience this as GPU shortages, high rental prices, and pressure to squeeze more tokens from each installed accelerator.',
        'The engineering complexity is also distributed. The interconnect must handle data traffic, control messages, reset, test, debug, repair, clocking, and power states. Coherency can simplify software but adds protocol and verification cost. Non-coherent links can be simpler but push more burden onto runtime software and driver stacks.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'AI accelerators are the clearest case. HBM capacity and bandwidth determine how much model state and context can stay near compute. Multi-die designs can improve yield by avoiding one enormous die, mix process nodes by putting I/O and logic where each belongs, and scale memory bandwidth by placing several HBM stacks around compute. The same ideas appear in CPUs, networking ASICs, automotive systems, and high-performance computing packages.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'A common misconception is that chiplets are just cheaper Lego blocks. They can improve yield and specialization, but the interconnect becomes a first-order design problem. If the link is too slow, too power hungry, too hard to cool, or too expensive to package, the system loses. Another misconception is that standards alone solve integration. Standards define interfaces; they do not remove signal integrity, thermal, mechanical, verification, and capacity constraints.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources: UCIe overview at https://www.uciexpress.org/ and UCIe about page at https://www.uciexpress.org/why-choose-us. Study Chiplet Link Budget & Repair Lane Case Study, GPU All-Reduce, Transformer Inference Roofline, Heterogeneous AI Compute Workload Router, KV Cache, Weka Filesystem Case Study, Load Balancer, and Backpressure & Flow Control next.',
      ],
    },
  ],
};
