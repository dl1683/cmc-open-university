// Chiplet link-budget and repair lanes: turn package routing into a table of
// physical margins, protocol layers, telemetry, repair, and supply constraints.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'chiplet-link-budget-repair-lane-case-study',
  title: 'Chiplet Link Budget & Repair Lane Case Study',
  category: 'Systems',
  summary: 'A deeper chiplet interconnect case study: lane budgets, bump pitch, organic fanout, protocol layers, telemetry, repair lanes, and DFx ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['link budget', 'routing fabric', 'health repair'], defaultValue: 'link budget' },
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

function linkGraph(title) {
  return graphState({
    nodes: [
      { id: 'asic', label: 'ASIC', x: 0.8, y: 3.7, note: 'compute' },
      { id: 'tx', label: 'TX PHY', x: 2.2, y: 3.7, note: 'drive' },
      { id: 'bump', label: 'bumps', x: 3.6, y: 3.7, note: 'pitch' },
      { id: 'rdl', label: 'RDL', x: 5.0, y: 3.7, note: 'route' },
      { id: 'rx', label: 'RX PHY', x: 6.4, y: 3.7, note: 'sample' },
      { id: 'hbm', label: 'HBM', x: 7.8, y: 3.7, note: 'stack' },
      { id: 'power', label: 'power', x: 3.6, y: 1.4, note: 'IR drop' },
      { id: 'heat', label: 'heat', x: 5.0, y: 1.4, note: 'derate' },
      { id: 'test', label: 'test', x: 6.4, y: 1.4, note: 'DFx' },
      { id: 'repair', label: 'repair', x: 5.0, y: 5.9, note: 'spares' },
      { id: 'ledger', label: 'ledger', x: 9.0, y: 3.7, note: 'margin' },
    ],
    edges: [
      { id: 'e-asic-tx', from: 'asic', to: 'tx' },
      { id: 'e-tx-bump', from: 'tx', to: 'bump' },
      { id: 'e-bump-rdl', from: 'bump', to: 'rdl' },
      { id: 'e-rdl-rx', from: 'rdl', to: 'rx' },
      { id: 'e-rx-hbm', from: 'rx', to: 'hbm' },
      { id: 'e-power-bump', from: 'power', to: 'bump' },
      { id: 'e-heat-rdl', from: 'heat', to: 'rdl' },
      { id: 'e-test-rx', from: 'test', to: 'rx' },
      { id: 'e-repair-rdl', from: 'repair', to: 'rdl' },
      { id: 'e-hbm-ledger', from: 'hbm', to: 'ledger' },
      { id: 'e-test-ledger', from: 'test', to: 'ledger' },
      { id: 'e-repair-ledger', from: 'repair', to: 'ledger' },
    ],
  }, { title });
}

function fabricGraph(title) {
  return graphState({
    nodes: [
      { id: 'proto', label: 'proto', x: 0.8, y: 2.1, note: 'UCIe/BoW' },
      { id: 'txn', label: 'txn', x: 2.2, y: 2.1, note: 'streams' },
      { id: 'link', label: 'link', x: 3.6, y: 2.1, note: 'bits' },
      { id: 'phy', label: 'PHY', x: 5.0, y: 2.1, note: 'signals' },
      { id: 'wires', label: 'wires', x: 6.4, y: 2.1, note: 'bumps' },
      { id: 'organic', label: 'organic', x: 2.2, y: 5.1, note: 'large' },
      { id: 'bridge', label: 'bridge', x: 4.1, y: 5.1, note: 'local' },
      { id: 'interposer', label: 'silicon', x: 6.0, y: 5.1, note: 'fine' },
      { id: 'package', label: 'package', x: 8.0, y: 3.6, note: 'SiP' },
      { id: 'supply', label: 'supply', x: 9.0, y: 5.5, note: 'capacity' },
    ],
    edges: [
      { id: 'e-proto-txn', from: 'proto', to: 'txn' },
      { id: 'e-txn-link', from: 'txn', to: 'link' },
      { id: 'e-link-phy', from: 'link', to: 'phy' },
      { id: 'e-phy-wires', from: 'phy', to: 'wires' },
      { id: 'e-organic-package', from: 'organic', to: 'package' },
      { id: 'e-bridge-package', from: 'bridge', to: 'package' },
      { id: 'e-interposer-package', from: 'interposer', to: 'package' },
      { id: 'e-wires-package', from: 'wires', to: 'package' },
      { id: 'e-supply-package', from: 'supply', to: 'package' },
    ],
  }, { title });
}

function* linkBudget() {
  yield {
    state: linkGraph('A die-to-memory link is a physical budget'),
    highlight: { active: ['asic', 'tx', 'bump', 'rdl', 'rx', 'hbm', 'e-asic-tx', 'e-tx-bump', 'e-bump-rdl', 'e-rdl-rx', 'e-rx-hbm'], compare: ['ledger'] },
    explanation: 'A chiplet link is not just an arrow between dies. The bit crosses a TX PHY, bumps, package traces, receive circuits, power noise, heat, timing skew, and test logic before it becomes usable bandwidth.',
  };

  yield {
    state: labelMatrix(
      'Link budget fields',
      [
        { id: 'pitch', label: 'pitch' },
        { id: 'reach', label: 'reach' },
        { id: 'rate', label: 'rate' },
        { id: 'energy', label: 'pJ/bit' },
        { id: 'skew', label: 'skew' },
        { id: 'ber', label: 'BER' },
        { id: 'heat', label: 'heat' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'control', label: 'control' },
      ],
      [
        ['wires/mm', 'bump map'],
        ['loss', 'equalize'],
        ['SI limit', 'lane plan'],
        ['power cap', 'swing'],
        ['timing', 'deskew'],
        ['bad bits', 'ECC/ret'],
        ['derate', 'telemetry'],
      ],
    ),
    highlight: { active: ['pitch:risk', 'rate:risk', 'energy:control', 'skew:control'], found: ['ber:control', 'heat:control'] },
    explanation: 'The link budget is the table that makes physical design inspectable. It records the knobs that decide whether more lanes, faster lanes, better equalization, lower swing, or a different package is the right move.',
    invariant: 'Bandwidth density is a budget, not a slogan.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'bump pitch', min: 20, max: 160 }, y: { label: 'bw/mm', min: 0, max: 4 } },
      series: [
        { id: 'org', label: 'organic', points: [{ x: 150, y: 0.7 }, { x: 120, y: 1.0 }, { x: 90, y: 1.4 }] },
        { id: 'silicon', label: 'silicon', points: [{ x: 80, y: 1.5 }, { x: 50, y: 2.2 }, { x: 25, y: 3.3 }] },
        { id: 'phy', label: 'PHY push', points: [{ x: 130, y: 2.2 }, { x: 100, y: 2.7 }, { x: 90, y: 3.0 }] },
      ],
      markers: [
        { id: 'hbm', x: 95, y: 2.6, label: 'HBM ask' },
      ],
    }),
    highlight: { active: ['phy', 'hbm'], compare: ['org', 'silicon'] },
    explanation: 'The simplified frontier shows the central tension from the local Eliyan source: organic packages are cheaper and larger, while silicon routes finer. Better PHY design tries to move the organic frontier upward.',
  };

  yield {
    state: linkGraph('Power, heat, and test reduce usable bandwidth'),
    highlight: { active: ['power', 'heat', 'test', 'bump', 'rdl', 'rx', 'e-power-bump', 'e-heat-rdl', 'e-test-rx'], compare: ['asic', 'hbm'] },
    explanation: 'Raw lane rate is only the starting point. IR drop, crosstalk, thermal derating, package variation, and test coverage decide how much of the theoretical link survives in a shipped accelerator.',
  };

  yield {
    state: labelMatrix(
      'Decision ledger',
      [
        { id: 'target', label: 'target' },
        { id: 'route', label: 'route' },
        { id: 'margin', label: 'margin' },
        { id: 'repair', label: 'repair' },
        { id: 'supply', label: 'supply' },
      ],
      [
        { id: 'stores', label: 'stores' },
        { id: 'why', label: 'why' },
      ],
      [
        ['GB/s', 'fit'],
        ['pkg', 'TCO'],
        ['eye', 'risk'],
        ['spare', 'life'],
        ['vendor', 'cap'],
      ],
    ),
    highlight: { active: ['target:stores', 'route:stores', 'margin:stores'], found: ['repair:why', 'supply:why'] },
    explanation: 'A chiplet design needs the same habit as production software: keep a ledger of the target, route, margin, repair policy, and supply assumption so later failures are diagnosable.',
  };
}

function* routingFabric() {
  yield {
    state: fabricGraph('The package fabric has layers'),
    highlight: { active: ['proto', 'txn', 'link', 'phy', 'wires', 'e-proto-txn', 'e-txn-link', 'e-link-phy', 'e-phy-wires'], compare: ['organic', 'interposer'] },
    explanation: 'BoW makes the layering explicit: protocols become transactions, transactions become link streams, link streams become physical bits, and the bits cross wires and bumps. UCIe also spans physical layer, protocols, software model, and compliance.',
  };

  yield {
    state: labelMatrix(
      'Package route choices',
      [
        { id: 'organic', label: 'organic' },
        { id: 'bridge', label: 'bridge' },
        { id: 'silicon', label: 'silicon' },
        { id: 'hybrid', label: 'hybrid' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'cost', label: 'cost' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['large', 'lower', 'density'],
        ['local', 'med', 'placement'],
        ['fine', 'high', 'supply'],
        ['mixed', 'complex', 'verify'],
      ],
    ),
    highlight: { active: ['organic:cost', 'silicon:win', 'bridge:win'], compare: ['hybrid:risk'] },
    explanation: 'The substrate choice is a routing data-structure problem in physical form. Organic fanout buys area and supply flexibility. Silicon buys pitch and density. Bridges localize fine routing where it matters.',
  };

  yield {
    state: fabricGraph('Organic fanout changes the topology question'),
    highlight: { active: ['organic', 'package', 'supply', 'e-organic-package', 'e-supply-package'], compare: ['interposer', 'bridge'] },
    explanation: 'The local Eliyan article frames the strategic question clearly: if HBM-class links require scarce advanced packaging, AI accelerator supply is constrained by the package. Organic fanout plus stronger PHYs tries to move that bottleneck.',
  };

  yield {
    state: labelMatrix(
      'Standards and layers',
      [
        { id: 'ucie', label: 'UCIe' },
        { id: 'bow', label: 'BoW' },
        { id: 'mem', label: 'mem link' },
        { id: 'prop', label: 'custom' },
      ],
      [
        { id: 'owns', label: 'owns' },
        { id: 'value', label: 'value' },
      ],
      [
        ['stack', 'mix dies'],
        ['PHY/TLL', 'open D2D'],
        ['read/write', 'HBM path'],
        ['full ctrl', 'tune hard'],
      ],
    ),
    highlight: { active: ['ucie:owns', 'bow:owns', 'mem:value'], compare: ['prop:owns'] },
    explanation: 'Standards do not eliminate link budgets. They define contracts. The product still has to choose protocol, transaction, link, PHY, package, memory interface, and test strategy together.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'pkg area', min: 0, max: 10 }, y: { label: 'route need', min: 0, max: 10 } },
      series: [
        { id: 'phone', label: 'edge AI', points: [{ x: 2, y: 4 }, { x: 3, y: 5.4 }, { x: 4, y: 6.0 }] },
        { id: 'xpu', label: 'AI XPU', points: [{ x: 5, y: 7 }, { x: 7, y: 8.5 }, { x: 9, y: 9.2 }] },
      ],
      markers: [
        { id: 'wall', x: 6.5, y: 8.1, label: 'pkg wall' },
      ],
    }),
    highlight: { active: ['xpu', 'wall'], compare: ['phone'] },
    explanation: 'As package area and routing need rise together, the interconnect stops being a back-end detail. It becomes part of the accelerator architecture and supply-chain strategy.',
  };
}

function* healthRepair() {
  yield {
    state: linkGraph('Health monitoring makes the link operable'),
    highlight: { active: ['test', 'repair', 'ledger', 'rx', 'hbm', 'e-test-rx', 'e-test-ledger', 'e-repair-ledger'], compare: ['tx', 'rdl'] },
    explanation: 'A high-bandwidth link needs bring-up tests, lane status, error counters, repair decisions, and field telemetry. The UCIe roadmap explicitly points toward health monitoring, repair, manageability, and DFx.',
  };

  yield {
    state: labelMatrix(
      'Repair lane ledger',
      [
        { id: 'lane', label: 'lane' },
        { id: 'bump', label: 'bump' },
        { id: 'eye', label: 'eye' },
        { id: 'temp', label: 'temp' },
        { id: 'spare', label: 'spare' },
        { id: 'fw', label: 'fw' },
      ],
      [
        { id: 'signal', label: 'signal' },
        { id: 'action', label: 'action' },
        { id: 'record', label: 'record' },
      ],
      [
        ['errors', 'mask', 'lane id'],
        ['open', 'remap', 'bump id'],
        ['margin', 'train', 'eye log'],
        ['hot', 'derate', 'temp log'],
        ['avail', 'swap', 'map ver'],
        ['event', 'patch', 'fw ver'],
      ],
    ),
    highlight: { active: ['lane:action', 'bump:action', 'eye:action', 'spare:action'], found: ['temp:record', 'fw:record'] },
    explanation: 'The repair ledger is the hardware analog of an incident log. It records which lane failed, which margin collapsed, which spare or derate was applied, and which firmware or map version owns the fix.',
  };

  yield {
    state: labelMatrix(
      'Failure modes',
      [
        { id: 'open', label: 'open' },
        { id: 'short', label: 'short' },
        { id: 'skew', label: 'skew' },
        { id: 'noise', label: 'noise' },
        { id: 'heat', label: 'heat' },
        { id: 'aging', label: 'aging' },
      ],
      [
        { id: 'seen', label: 'seen' },
        { id: 'control', label: 'control' },
      ],
      [
        ['dead lane', 'spare'],
        ['bad eye', 'mask'],
        ['late bit', 'deskew'],
        ['BER rise', 'equalize'],
        ['hot spot', 'derate'],
        ['drift', 'retrain'],
      ],
    ),
    highlight: { active: ['open:control', 'skew:control', 'noise:control', 'heat:control'], compare: ['aging:seen'] },
    explanation: 'Repair is not one feature. It is a collection of controls: spare lanes, remapping, deskew, equalization, derating, retraining, and observability to decide which control is justified.',
  };

  yield {
    state: fabricGraph('DFx must span the stack'),
    highlight: { active: ['proto', 'link', 'phy', 'wires', 'package', 'e-link-phy', 'e-phy-wires', 'e-wires-package'], found: ['supply'] },
    explanation: 'Design-for-test, debug, telemetry, and manageability have to cross the same layers as data. A standard can help, but the package still needs physical hooks and the firmware still needs a state machine.',
  };

  yield {
    state: labelMatrix(
      'When organic wins',
      [
        { id: 'area', label: 'area' },
        { id: 'cost', label: 'cost' },
        { id: 'supply', label: 'supply' },
        { id: 'rugged', label: 'rugged' },
        { id: 'margin', label: 'margin' },
      ],
      [
        { id: 'need', label: 'need' },
        { id: 'proof', label: 'proof' },
      ],
      [
        ['many', 'fit'],
        ['TCO', 'BOM'],
        ['2nd', 'cap'],
        ['shock', 'qual'],
        ['HBM', 'eye'],
      ],
    ),
    highlight: { active: ['area:need', 'cost:need', 'supply:need'], found: ['margin:proof'] },
    explanation: 'Organic packaging wins only if the measured link margin supports the system target. The business case needs area, cost, supply, reliability, and bandwidth proof together.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'link budget') yield* linkBudget();
  else if (view === 'routing fabric') yield* routingFabric();
  else if (view === 'health repair') yield* healthRepair();
  else throw new InputError('Pick a chiplet link-budget view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'Read the routing-fabric view as a bandwidth budget. Raw lane rate is the advertised number before overhead, margin, repair, and derating. Usable bandwidth is what remains after the physical route, protocol, temperature, voltage, and spare-lane policy have taken their share.',
        'Read the health-repair view as a history of link state. A lane is one parallel signaling path, and a repair lane is reserved capacity used when a normal lane is weak. The safe inference is that a link budget is valid only with its test evidence, thermal assumptions, and repair map.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'A chiplet link budget exists because package bandwidth is not lane count times advertised speed. A bit must leave a transmit PHY, cross bumps and package routes, survive loss and crosstalk, arrive at a receive PHY, and meet timing and voltage margin across process, temperature, aging, and field conditions. The budget records how much of the theoretical link survives that journey.',
        'This matters because the package is part of the computer architecture. Compute, HBM, I/O, and accelerator tiles all depend on paths constrained by bump pitch, beachfront width, routing density, power delivery, test coverage, repair lanes, and heat. A product can have strong silicon and still miss its target if the package fabric cannot deliver reliable payload bandwidth.',
        {type:'callout', text:'The usable bandwidth of a chiplet link is the raw lane promise minus every physical, protocol, thermal, and repair margin the package must spend.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b5/High_Bandwidth_Memory_schematic.svg', alt:'Schematic showing a GPU connected to stacked DRAM through a silicon interposer and package substrate', caption:'High Bandwidth Memory schematic showing the interposer, package substrate, DRAM stack, and solder-ball path that constrain link budgets. Source: Wikimedia Commons, ScotXW/Shmuel Csaba Otto Traian, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to multiply lanes by gigabits per second and call the result bandwidth. That is a useful first estimate because it gives the ceiling if every lane is payload, every lane runs at target speed, and the channel behaves perfectly. Early architecture sketches often start there.',
        'A second shortcut is to compare package options by one headline number such as bandwidth per millimeter. That hides route length, energy per bit, equalization, temperature, supply availability, and repair. Two packages can share the same nominal bandwidth while having very different yield and field reliability.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is that real links spend margin. Some lanes carry clocks, training, sideband, redundancy, or test access instead of payload. Some lanes derate because the eye diagram is too small, crosstalk is too high, skew is too large, or heat and power noise close timing margin.',
        'Repair creates another wall. A product that fails when one bump is weak is not manufacturable at volume. Spare lanes and remapping protect yield, but they reduce the raw capacity that can be promised as payload.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is that the link budget is the architecture, not a spreadsheet after the architecture. It records lane count, lane rate, overhead, reach, insertion loss, crosstalk, skew, energy per bit, bit-error target, power noise, thermal derate, spare lanes, and test coverage. Those fields decide whether the workload sees bandwidth or stalls.',
        'The invariant is conservative usable bandwidth. A link is healthy only if the promised payload still holds after overhead, guard bands, failed-lane repair, and worst-case operating conditions. Raw bandwidth is a hope; usable bandwidth is a contract backed by evidence.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The process starts with a workload requirement, such as a compute tile needing 900 GB/s to local memory under a latency and power limit. Architecture translates that into payload bandwidth. Physical design translates payload bandwidth into lanes, pitch, placement, route class, equalization, and power. Each translation spends margin.',
        'Bring-up and production test close the loop. The system measures eye margin, lane failures, skew, error rates, temperature sensitivity, and training behavior. Firmware can retrain, derate, remap to spares, or mark a part unhealthy. The repair ledger records which lane map and firmware decision produced the current link state.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'A link budget works because it separates raw capability from usable capability. Raw capability assumes an ideal channel. Usable capability subtracts the physical and protocol taxes that shipped systems actually pay. Hardware teams need the second number because customers run corner cases, not typical simulations.',
        'The correctness argument is traceability. If bit errors rise at high temperature, the budget points to thermal derate, eye margin, equalization, power noise, or lane health. If a lot has weak lanes, the repair ledger points to route class, spare use, bump map, and manufacturing data. Failures become diagnosable coordinates instead of anecdotes.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Suppose a link has 1024 lanes at 32 Gb/s. Raw bandwidth is 32,768 Gb/s, or 4,096 GB/s before encoding and overhead. If protocol overhead consumes 10 percent, thermal derate removes 15 percent, and 3 percent of lanes are reserved as spares, usable payload is about 4,096 * 0.90 * 0.85 * 0.97 = 3,039 GB/s.',
        'That 1,057 GB/s gap is not waste; it is the cost of shipping the link. Wider links consume edge length and bumps, stronger drive raises energy per bit and heat, and more repair lanes protect yield while reducing nominal payload. The budget makes those tradeoffs explicit before tapeout.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Link budgets matter in AI accelerators, chiplet CPUs, memory expansion packages, network processors, and mobile SoCs. They matter most when bandwidth demand, package area, and supply pressure rise together. In that regime, the interconnect is a first-order product constraint.',
        'They are used before package commit, during implementation, during silicon bring-up, in qualification, and in field operations. Architects use the budget to see whether more compute will help, package engineers use it to prioritize routes, and firmware teams use it to own training and repair states. Operations teams use telemetry to separate aging links from software slowdowns.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when teams count nominal bandwidth and subtract real-world cost zero times. A plan that uses every lane for payload, assumes perfect training, ignores spares, and omits thermal derating may work only on golden samples. The first production lot then turns an architecture promise into a yield problem.',
        'It also fails when observability is weak. If the link has no health counters, no persisted remap history, and no way to distinguish lane errors from protocol errors, repair becomes guesswork. A marginal package path can look like workload variance or random machine failure.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose an accelerator needs at least 2.5 TB/s of usable die-to-die bandwidth. A proposed link has 768 lanes at 32 Gb/s, which is 24,576 Gb/s, or 3,072 GB/s raw. Subtract 8 percent packet overhead, 10 percent guard band, and 4 percent spare-lane reservation, and usable bandwidth is about 3,072 * 0.92 * 0.90 * 0.96 = 2,443 GB/s.',
        'The design misses the 2.5 TB/s target by about 57 GB/s. The team can add lanes, raise lane rate, reduce overhead, accept less guard band, improve the package route, or change the workload placement. The budget turns a vague bandwidth concern into specific knobs and shows which choice spends area, power, yield, or reliability.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary and official sources include UCIe specifications at https://www.uciexpress.org/specifications, Open Compute Project BoW PHY Specification 2.0 at https://www.opencompute.org/chiplets/26/bunch-of-wires-bow-phy-specification-20, and Open Compute Project BoW transaction and link layer material at https://www.opencompute.org/chiplets/25/transaction-and-link-layer-specification-for-bunch-of-wires-bow-interfaces. Read these as interface and layer contracts, then map each claim back to the physical budget.',
        'Study Chiplet Interconnect for package topology, Known-Good-Die Yield Ledger for manufacturing evidence, and Backpressure and Flow Control for link behavior under load. Then connect the idea to transformer inference rooflines, GPU all-reduce, distributed tracing, and feature-flag rollout patterns for operational repair decisions.',
      ],
    },
  ],
};
