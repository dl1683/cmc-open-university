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
      heading: 'What it is',
      paragraphs: [
        'A chiplet link budget is the engineering table behind a die-to-die connection. It records how many wires or bumps are available, how far the signal travels, which PHY drives it, what data rate is safe, how much energy each bit costs, how much skew and crosstalk can be tolerated, which thermal derates apply, and what repair strategy exists when lanes fail.',
        'Chiplet Interconnect Case Study gives the package-level overview. This case study goes one layer deeper. The key lesson is that HBM-to-accelerator connectivity is constrained by physical routing density, package supply, signal integrity, and repairability. The local Eliyan PDF in the provided corpus emphasizes that an HBM3E stack can require more than a thousand wires between an XPU and HBM, which is why the package fabric becomes part of the memory architecture.',
      ],
    },
    {
      heading: 'How the link works',
      paragraphs: [
        'A bit leaving a compute die passes through a transmit PHY, bump map, redistribution layer or interposer route, package channel, receive PHY, training logic, and often error-management circuitry. The protocol stack above that physical route may be UCIe, BoW, a memory-specific interface, or a proprietary link. The physical layer determines whether the promised protocol bandwidth can actually be shipped at the required power and yield.',
        'UCIe describes its specifications as covering die-to-die physical layer, protocols, software stack, and compliance testing. UCIe 1.1 highlights health monitoring and repair for high-reliability applications, while UCIe 2.0 and 3.0 add more manageability, DFx, 3D packaging, and higher data rates: https://www.uciexpress.org/specifications. The Open Compute Project BoW PHY page lists the physical-interface concerns directly: operating modes, chip-to-chip wire signals, wire ordering, timing, electrical specs, calibration, bump patterns, signal integrity, test, and conformance: https://www.opencompute.org/chiplets/26/bunch-of-wires-bow-phy-specification-20.',
      ],
    },
    {
      heading: 'Organic substrate case study',
      paragraphs: [
        'The hard strategic question is whether all high-bandwidth die-to-die links must ride scarce advanced packaging. Silicon interposers offer fine routing, short direct paths, and high bandwidth density, but they create cost, area, fragility, and supply constraints. Organic substrates are larger and cheaper but historically cannot provide the same routing density. A stronger PHY can move that frontier by extracting more bandwidth from coarser bump pitch and longer package routes.',
        'Eliyan frames NuLink-SP as a standard-organic-package path that aims to reach bandwidth, power, and latency similar to silicon-substrate implementations while saving cost and improving supply continuity: https://eliyan.com/technology/. In its 2023 first-silicon announcement, Eliyan reported 40 Gbps per bump, more than 2.2 Tbps/mm beachfront bandwidth at 130 um pitch on standard organic packaging, and a path toward 3 Tbps/mm at finer pitch: https://eliyan.com/press-release/eliyan-achieves-first-silicon-in-record-time/. Treat vendor claims as claims, but the systems idea is valuable: physical-link innovation can change package topology and supply-chain economics.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'There are three important data structures. First is the bump map: a physical adjacency table that says which pads, lanes, spares, clocks, sideband signals, and power pins exist at the beachfront. Second is the route ledger: a link-budget record with pitch, reach, data rate, energy, BER, margin, skew, temperature, and derate. Third is the repair ledger: lane IDs, failed bump IDs, eye margin logs, remap versions, firmware revisions, and field telemetry.',
        'The protocol stack is also a set of data structures. BoW describes protocol, transaction, link, and physical layers: protocol packets become transaction streams, transaction streams become a bitstream, and the physical layer transmits that stream across the BoW electrical interface: https://www.opencompute.org/chiplets/25/transaction-and-link-layer-specification-for-bunch-of-wires-bow-interfaces. That layered model is why interconnect is not only a wire. It is a state machine, a flow-control contract, a test interface, and a repairable physical network.',
      ],
    },
    {
      heading: 'Complete case study: HBM-class link on organic package',
      paragraphs: [
        'Suppose an AI accelerator team wants HBM-class bandwidth but cannot rely entirely on silicon interposer capacity. The link-budget process starts with the model requirement: target GB/s, context length pressure, batch size, and acceptable latency. Physical design maps that target to lane count, bump pitch, package reach, energy per bit, thermal envelope, and BER target. Architecture then decides whether to use a standard UCIe/BoW-compatible route, a memory-specific link, a bridge, or a custom PHY.',
        'The decision is not "organic is cheap, silicon is fast." The team needs proof that organic routing plus PHY margin can meet the HBM bandwidth target after heat, variation, aging, spare-lane reservation, and test coverage. If the proof holds, the business gains a larger package area, broader supplier set, and potentially better cost and cycle time. If it does not hold, the system pays with lower effective bandwidth, fragile repair policy, or a software-visible memory bottleneck.',
      ],
    },
    {
      heading: 'Pitfalls and study next',
      paragraphs: [
        'Do not confuse nominal data rate with usable system bandwidth. Do not count every bump as payload if clocks, power, control, sideband, training, and spare lanes consume beachfront. Do not compare substrates without pitch, reach, loss, energy, yield, and supply assumptions. Do not treat standards as magic: standards improve interoperability, but physics still decides margin. Do not ship a link without repair and telemetry if the application expects automotive, data-center, or long-life reliability.',
        'Primary and official sources: UCIe specifications at https://www.uciexpress.org/specifications, Open Compute Project BoW PHY Specification 2.0 at https://www.opencompute.org/chiplets/26/bunch-of-wires-bow-phy-specification-20, Open Compute Project BoW transaction and link layer specification at https://www.opencompute.org/chiplets/25/transaction-and-link-layer-specification-for-bunch-of-wires-bow-interfaces, Eliyan technology overview at https://eliyan.com/technology/, and Eliyan first-silicon announcement at https://eliyan.com/press-release/eliyan-achieves-first-silicon-in-record-time/. Study Chiplet Interconnect Case Study, GPU All-Reduce, Tensor Parallelism, Transformer Inference Roofline, Heterogeneous AI Compute Workload Router, Accelerator Kernel Compatibility Matrix, KV Cache, Weka Filesystem Case Study, Backpressure & Flow Control, Distributed Tracing, and Feature Flag Control Plane next.',
      ],
    },
  ],
};
