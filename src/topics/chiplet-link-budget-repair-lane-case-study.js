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
      heading: 'Why this exists',
      paragraphs: [
        `A chiplet link budget exists because package bandwidth is not a number you get by multiplying advertised lane rate by advertised lane count. A bit has to leave a transmit PHY, cross bumps, travel through redistribution layers, bridges, interposers, or organic traces, arrive at a receive PHY, satisfy timing and voltage margins, and keep doing that across temperature, process variation, aging, and field conditions. The link budget is the engineering ledger that says how much of the theoretical bandwidth survives that journey.`,
        `Chiplet systems need this ledger because the package is now part of the computer architecture. When a compute die talks to HBM, an I/O chiplet, or another accelerator tile, the path is constrained by bump pitch, beachfront width, route density, power delivery, thermal behavior, test coverage, repair lanes, and supply-chain availability. A product can have excellent compute silicon and still miss its system target if the package fabric cannot deliver enough reliable payload bandwidth.`,
        `This case study goes one layer deeper than a general chiplet interconnect overview. It treats the die-to-die link as a system with physical margin, protocol overhead, health telemetry, repair state, and decision history. That is the level at which architecture choices become shippable hardware rather than diagrams with arrows between dies.`,
        {type:'callout', text:'The usable bandwidth of a chiplet link is the raw lane promise minus every physical, protocol, thermal, and repair margin the package must spend.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/b5/High_Bandwidth_Memory_schematic.svg', alt:'Schematic showing a GPU connected to stacked DRAM through a silicon interposer and package substrate', caption:'High Bandwidth Memory schematic showing the interposer, package substrate, DRAM stack, and solder-ball path that constrain link budgets. Source: Wikimedia Commons, ScotXW/Shmuel Csaba Otto Traian, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why the obvious approach hits a wall',
      paragraphs: [
        `The tempting shortcut is to start with lane count times gigabits per second and call the result bandwidth. That calculation is useful for a napkin estimate because it tells you the maximum payload if every lane is usable, every lane runs at target speed, overhead is negligible, and the package channel behaves exactly as hoped.`,
        `Those assumptions collapse in a real chiplet package. Some wires are not payload lanes because the link needs clocks, training, sideband, redundancy, control, or test access. Some lanes cannot run at nominal rate because the eye diagram is too small, crosstalk is too high, timing skew is too large, or power and heat force derating. Some lanes are intentionally held in reserve as spares because a product that fails when one bump or lane is weak is not a manufacturable product.`,
        `The shortcut also hides topology. Two packages can have the same nominal aggregate bandwidth and very different risk. A short dense silicon bridge, a large organic substrate, and a custom fanout route spend margin in different places. Without a link budget, the team may discover too late that the advertised bandwidth only works on golden samples, at low temperature, with limited yield, or without enough repair capacity.`,
      ],
    },
    {
      heading: 'Core insight: the budget is the architecture',
      paragraphs: [
        `The core model is a layered path with a margin ledger. At the top, a protocol or memory interface describes what the communicating dies are trying to exchange. Below that, transaction and link layers may packetize, order, retry, or stream data. The PHY turns those bits into electrical signaling. The package route carries the signals across bumps, traces, redistribution layers, bridges, interposers, or organic fanout. The receiver samples, trains, deskews, detects errors, and reports health.`,
        `The budget records the fields that decide whether the path works: bump pitch, beachfront width, lane count, lane rate, reach, insertion loss, crosstalk, skew, equalization, voltage swing, energy per bit, bit-error target, power delivery, thermal derate, repair lanes, test hooks, and manufacturing assumptions. The goal is not to collect numbers for documentation. The goal is to decide which constraint is binding and what tradeoff buys the most reliable payload bandwidth.`,
        `The repair model is part of the same data structure. A link that can detect a weak lane, map traffic away from it, record the change, and keep operating has a different usable budget from a link that treats every lane as mandatory. Spare lanes, lane remapping, retraining, error counters, firmware versions, and qualification results belong in the budget because they define how the link behaves after first silicon, not just how it behaves in an ideal simulation.`,
      ],
    },
    {
      heading: 'Core mechanism',
      paragraphs: [
        `A design begins with a workload requirement: for example, a compute die needs a certain number of gigabytes per second to HBM or to another chiplet under a latency and power limit. The architecture team translates that into payload bandwidth, then the physical team translates payload bandwidth into lanes, pitch, placement, and package route. Every translation spends margin. Encoding, protocol overhead, retry policy, training, clocking, spares, and guard bands all reduce the portion of raw signaling that the workload can use.`,
        `Signal integrity and power integrity then push back. A longer route may require stronger drive, more equalization, or lower speed. Stronger drive raises energy per bit and heat. Heat can shrink timing margin or force derating. Power noise can close the eye. Narrower bump pitch can increase density but may raise manufacturing and assembly risk. A link budget is the place where those couplings are made visible instead of being argued separately by different teams.`,
        `Health repair closes the loop. During bring-up and production test, the system measures eye margin, lane failures, skew, error rates, temperature sensitivity, and training behavior. During operation, it can count errors, retrain, derate, remap to spares, or flag a part as unhealthy. The repair lane ledger records what happened and which map version or firmware decision owns the change. Without that record, field failures become anecdotes instead of diagnosable patterns.`,
      ],
    },
    {
      heading: 'Uses across design and operations',
      paragraphs: [
        `The link budget is used before package commit, during implementation, during silicon bring-up, in qualification, and in field operations. Before commit, it decides whether the topology can meet the workload target at acceptable cost and yield. During implementation, it coordinates package routing, PHY configuration, power delivery, thermal planning, and test access. During bring-up, it provides the expected values that lab measurements must confirm or falsify.`,
        `Standards help by defining contracts, but they do not remove the budget. UCIe describes die-to-die physical layer, protocols, software stack, and compliance testing at https://www.uciexpress.org/specifications. The Open Compute Project BoW PHY page lists physical-interface concerns such as wire ordering, timing, electrical specifications, calibration, bump patterns, signal integrity, test, and conformance at https://www.opencompute.org/chiplets/26/bunch-of-wires-bow-phy-specification-20. Those contracts make interoperability and verification more tractable, but the product still has to prove its route, power, thermal, repair, and supply assumptions.`,
        `The budget is also a communication object. Architects can see why adding compute may not help if memory bandwidth is capped. Package engineers can see which routes are critical. Firmware engineers can see which training and repair states must exist. Operations teams can see which telemetry values indicate an aging link rather than a software slowdown. The table prevents bandwidth from becoming an unowned promise.`,
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose an AI accelerator tile needs an HBM-class connection. The first estimate says 1024 lanes at a target lane rate can deliver enough raw bandwidth. The link budget immediately asks what portion of those lanes are payload, how much beachfront exists, whether the bump pitch fits, how far the signals must travel, what energy per bit is acceptable, and how many spare lanes are needed to protect yield. A design that looks sufficient on raw bandwidth may fail after control lanes, repair reservation, thermal derate, and signal-integrity guard bands are applied.`,
        `Now compare package choices. A silicon interposer or bridge can offer fine routing and short local paths, which helps density and margin. It can also add cost, area limits, fragility, and supply constraints. Organic substrates can offer larger package area and better cost or supply flexibility, but they historically have less routing density. The question is not which substrate is universally best. The question is which substrate plus PHY plus repair plan meets the measured margin requirement for the system target.`,
        `The local vendor example in this file is Eliyan. Eliyan frames NuLink-SP as a standard-organic-package path that aims to reach bandwidth, power, and latency similar to silicon-substrate implementations while saving cost and improving supply continuity: https://eliyan.com/technology/. Its 2023 first-silicon announcement reported 40 Gbps per bump, more than 2.2 Tbps/mm beachfront bandwidth at 130 um pitch on standard organic packaging, and a path toward 3 Tbps/mm at finer pitch: https://eliyan.com/press-release/eliyan-achieves-first-silicon-in-record-time/. Treat those as vendor claims, not independent proof. The transferable systems lesson is that PHY innovation can move the package frontier and therefore change architecture and supply-chain options.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `A link budget works because it separates raw capability from usable capability. Raw capability is the optimistic frontier: how many bits could move if the channel and implementation were ideal. Usable capability is the conservative promise after overhead, derating, variation, and repair. Hardware teams need the second number because shipped systems live in corners, not in typical-case marketing diagrams.`,
        `It also works because it gives every failure a coordinate. If bit errors rise at high temperature, the ledger points to thermal derate, eye margin, equalization, or power noise. If a package lot has weak lanes, the ledger points to bump map, route class, spare use, and manufacturing data. If firmware remaps lanes differently across revisions, the repair ledger tells the team which decision changed. The budget turns a high-dimensional physical system into inspectable rows.`,
        `Layering helps for the same reason. BoW describes protocol, transaction, link, and physical layers: protocol packets become transaction streams, transaction streams become a bitstream, and the physical layer transmits that stream across the BoW electrical interface: https://www.opencompute.org/chiplets/25/transaction-and-link-layer-specification-for-bunch-of-wires-bow-interfaces. The layer model lets teams assign contracts, but the margin ledger keeps those contracts honest against the physical package.`,
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `The common failure is counting nominal bandwidth twice and subtracting real-world cost zero times. Teams may budget payload using all lanes, forget sideband and spares, assume perfect training, omit thermal derating, and leave no margin for crosstalk or manufacturing variation. The result is a package that only meets target in simulation or only at a narrow operating point.`,
        `Another failure is comparing package technologies without normalizing the route. Organic, bridge, and silicon options must be compared with pitch, reach, loss, energy, test access, repair policy, yield, volume supply, and total cost. A denser route that cannot be sourced at volume may be worse than a lower-density route with better availability. A cheaper route that needs too much PHY power may lose at the system level.`,
        `A third failure is poor observability. If the link has no usable health counters, no way to distinguish bad lanes from protocol errors, no persisted remap history, or no field telemetry, repair becomes guesswork. That is especially dangerous for AI accelerators and memory-rich systems where a marginal package path can masquerade as software instability, workload variance, or random machine failure.`,
      ],
    },
    {
      heading: 'Operational and implementation guidance',
      paragraphs: [
        `Keep the link budget as a versioned artifact, not a slide. It should identify the target workload bandwidth, protocol overhead, physical route, lane plan, repair reservation, thermal and voltage assumptions, BER target, test coverage, and the evidence behind each number. When a parameter changes, the artifact should say which system promise changed with it.`,
        `Design repair from the beginning. Spare lanes are useful only if the package route, PHY, training sequence, firmware state machine, test flow, and telemetry schema can actually use them. A repair feature that is not visible in production logs will not help diagnose field failures. A repair feature that is not tied to qualification data may improve bring-up demos without improving shipped reliability.`,
        `Make standards and proprietary tuning coexist deliberately. UCIe, BoW, memory interfaces, and custom links each create different contracts. Standard layers help reuse and interoperability; custom tuning may be needed for a particular package or performance point. In both cases, the implementation must still satisfy the physical budget and preserve enough telemetry for field operation.`,
      ],
    },
    {
      heading: 'Where it matters',
      paragraphs: [
        `This pattern matters in AI accelerators, chiplet CPUs, memory expansion packages, network processors, mobile SoCs, and any system where multiple dies have to behave like one coherent product. It matters most when bandwidth demand, package area, and supply pressure rise together. In that regime, the interconnect is not a back-end detail; it is one of the main constraints on product shape.`,
        `It also matters for cost. A product that can use a larger or more available package technology without missing bandwidth may avoid a scarce advanced-packaging bottleneck. A product that over-promises on organic routing and then compensates with excessive PHY power may lose the savings elsewhere. The budget is where those tradeoffs become explicit enough to decide.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary and official sources: UCIe specifications at https://www.uciexpress.org/specifications, Open Compute Project BoW PHY Specification 2.0 at https://www.opencompute.org/chiplets/26/bunch-of-wires-bow-phy-specification-20, Open Compute Project BoW transaction and link layer specification at https://www.opencompute.org/chiplets/25/transaction-and-link-layer-specification-for-bunch-of-wires-bow-interfaces, Eliyan technology overview at https://eliyan.com/technology/, and Eliyan first-silicon announcement at https://eliyan.com/press-release/eliyan-achieves-first-silicon-in-record-time/.`,
        `Study Chiplet Interconnect Case Study for the broader package topology, GPU All-Reduce and Tensor Parallelism for workloads that stress interconnects, Transformer Inference Roofline for bandwidth-bound accelerator reasoning, Heterogeneous AI Compute Workload Router for system placement, Accelerator Kernel Compatibility Matrix for hardware-software matching, Backpressure & Flow Control for link behavior under load, Distributed Tracing for cross-component diagnosis, and Feature Flag Control Plane for the operational pattern of controlled rollout and repair decisions.`,
      ],
    },
  ],
};
