// Known-good-die and chiplet yield: test, bin, assemble, screen, and record
// yield risks before one bad die ruins an expensive package.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'chiplet-known-good-die-yield-ledger-case-study',
  title: 'Chiplet Known-Good-Die Yield Ledger Case Study',
  category: 'Systems',
  summary: 'A chiplet manufacturing primer: wafer sort, known-good-die testing, binning, assembly yield, package screens, escape risk, and cost ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['yield pipeline', 'bin ledger'], defaultValue: 'yield pipeline' },
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

function yieldGraph(title, { escape = false } = {}) {
  return graphState({
    nodes: [
      { id: 'wafer', label: 'wafer', x: 0.7, y: 3.5, note: 'lots' },
      { id: 'sort', label: 'sort', x: 2.0, y: 3.5, note: 'test' },
      { id: 'kgd', label: 'KGD', x: 3.4, y: 2.0, note: 'pass' },
      { id: 'scrap', label: 'scrap', x: 3.4, y: 5.0, note: 'fail' },
      { id: 'bin', label: 'bin', x: 4.8, y: 2.0, note: 'speed' },
      { id: 'assy', label: 'assy', x: 6.1, y: 2.0, note: 'pkg' },
      { id: 'screen', label: 'screen', x: 7.4, y: 2.0, note: escape ? 'miss' : 'stress' },
      { id: 'ship', label: 'ship', x: 8.8, y: 2.0, note: 'SKU' },
      { id: 'fail', label: 'fail', x: 7.4, y: 5.0, note: 'loss' },
      { id: 'ledger', label: 'ledger', x: 8.8, y: 5.0, note: 'cost' },
    ],
    edges: [
      { id: 'e-wafer-sort', from: 'wafer', to: 'sort' },
      { id: 'e-sort-kgd', from: 'sort', to: 'kgd', weight: 'pass' },
      { id: 'e-sort-scrap', from: 'sort', to: 'scrap', weight: 'fail' },
      { id: 'e-kgd-bin', from: 'kgd', to: 'bin', weight: 'grade' },
      { id: 'e-bin-assy', from: 'bin', to: 'assy', weight: 'kit' },
      { id: 'e-assy-screen', from: 'assy', to: 'screen', weight: 'test' },
      { id: 'e-screen-ship', from: 'screen', to: 'ship', weight: escape ? 'risk' : 'pass' },
      { id: 'e-screen-fail', from: 'screen', to: 'fail', weight: 'fail' },
      { id: 'e-fail-ledger', from: 'fail', to: 'ledger', weight: 'loss' },
      { id: 'e-ship-ledger', from: 'ship', to: 'ledger', weight: 'COGS' },
    ],
  }, { title });
}

function packageGraph(title) {
  return graphState({
    nodes: [
      { id: 'cpu', label: 'logic', x: 1.2, y: 2.0, note: 'die' },
      { id: 'io', label: 'I/O', x: 1.2, y: 5.0, note: 'die' },
      { id: 'hbm0', label: 'HBM0', x: 3.3, y: 1.2, note: 'stack' },
      { id: 'hbm1', label: 'HBM1', x: 3.3, y: 5.8, note: 'stack' },
      { id: 'sub', label: 'sub', x: 5.3, y: 3.5, note: 'pkg' },
      { id: 'test', label: 'test', x: 7.1, y: 2.0, note: 'post' },
      { id: 'sku', label: 'SKU', x: 8.7, y: 2.0, note: 'bin' },
      { id: 'rework', label: 'hold', x: 7.1, y: 5.0, note: 'debug' },
      { id: 'cost', label: 'cost', x: 8.7, y: 5.0, note: 'rollup' },
    ],
    edges: [
      { id: 'e-cpu-sub', from: 'cpu', to: 'sub', weight: 'place' },
      { id: 'e-io-sub', from: 'io', to: 'sub', weight: 'place' },
      { id: 'e-hbm0-sub', from: 'hbm0', to: 'sub', weight: 'place' },
      { id: 'e-hbm1-sub', from: 'hbm1', to: 'sub', weight: 'place' },
      { id: 'e-sub-test', from: 'sub', to: 'test', weight: 'screen' },
      { id: 'e-test-sku', from: 'test', to: 'sku', weight: 'pass' },
      { id: 'e-test-rework', from: 'test', to: 'rework', weight: 'fail' },
      { id: 'e-rework-cost', from: 'rework', to: 'cost', weight: 'loss' },
      { id: 'e-sku-cost', from: 'sku', to: 'cost', weight: 'ASP' },
    ],
  }, { title });
}

function* yieldPipeline() {
  yield {
    state: yieldGraph('Known-good die moves screening upstream'),
    highlight: { active: ['wafer', 'sort', 'kgd', 'e-wafer-sort', 'e-sort-kgd'], compare: ['assy'] },
    explanation: 'A chiplet package can contain many expensive dies. Known-good-die discipline tries to catch bad dies before assembly so one defect does not waste the entire package.',
  };

  yield {
    state: labelMatrix(
      'Yield multiplication',
      [
        { id: 'one', label: '1 die' },
        { id: 'four', label: '4 dies' },
        { id: 'eight', label: '8 dies' },
        { id: 'plus', label: 'pkg' },
      ],
      [
        { id: 'risk', label: 'risk' },
        { id: 'control', label: 'control' },
      ],
      [
        ['local', 'sort'],
        ['mult', 'KGD'],
        ['exp', 'bin'],
        ['assy', 'screen'],
      ],
    ),
    highlight: { active: ['four:risk', 'eight:risk', 'plus:risk'], found: ['four:control', 'plus:control'] },
    explanation: 'Multi-die packages multiply risk. If each component has an escape probability, adding more components increases the chance that an assembled package contains one weak die, weak bond, or weak route.',
    invariant: 'A chiplet yield model is a product of parts and process steps.',
  };

  yield {
    state: yieldGraph('Binning turns variation into sellable SKUs'),
    highlight: { active: ['kgd', 'bin', 'assy', 'ship', 'e-kgd-bin', 'e-bin-assy', 'e-screen-ship'], compare: ['scrap'] },
    explanation: 'Not every passing die is equal. Binning records speed, voltage, thermal behavior, memory health, and link margin so the assembly kit matches the intended product tier.',
  };

  yield {
    state: yieldGraph('A missed screen becomes an expensive escape', { escape: true }),
    highlight: { active: ['screen', 'ship', 'ledger', 'e-screen-ship', 'e-ship-ledger'], compare: ['fail', 'e-screen-fail'] },
    explanation: 'The worst failure is not always the die that fails early. It is the weak die that passes cheap tests, consumes assembly capacity, ships into a high-value SKU, and fails under real thermal or workload stress.',
  };
}

function* binLedger() {
  yield {
    state: packageGraph('A package kit is a compatibility graph'),
    highlight: { active: ['cpu', 'io', 'hbm0', 'hbm1', 'sub', 'e-cpu-sub', 'e-hbm0-sub', 'e-hbm1-sub'], compare: ['test'] },
    explanation: 'A chiplet bill of materials is a graph: logic dies, I/O dies, HBM stacks, substrate or interposer, bumps, routes, power, and thermal constraints all have to be compatible before assembly.',
  };

  yield {
    state: labelMatrix(
      'Die bin record',
      [
        { id: 'speed', label: 'speed' },
        { id: 'volt', label: 'volt' },
        { id: 'temp', label: 'temp' },
        { id: 'link', label: 'link' },
        { id: 'mem', label: 'mem' },
        { id: 'trace', label: 'trace' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'use', label: 'use' },
      ],
      [
        ['GHz', 'SKU'],
        ['Vmin', 'power'],
        ['curve', 'cool'],
        ['margin', 'route'],
        ['repair', 'cap'],
        ['lot', 'audit'],
      ],
    ),
    highlight: { active: ['speed:value', 'volt:value', 'link:value'], found: ['trace:use'] },
    explanation: 'The bin record is the manufacturing data structure. It lets a package planner choose dies that meet performance, power, link, memory, and audit requirements together.',
    invariant: 'Known-good die is not one bit. It is a structured certificate.',
  };

  yield {
    state: packageGraph('Post-assembly screens protect the final product'),
    highlight: { active: ['sub', 'test', 'sku', 'rework', 'e-sub-test', 'e-test-sku', 'e-test-rework'], compare: ['cpu', 'hbm0'] },
    explanation: 'Pre-assembly tests reduce risk, but final package screens still matter because assembly can introduce opens, shorts, thermal stress, warpage, link margin loss, and subtle interactions between dies.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'chiplets', min: 1, max: 12 }, y: { label: 'good pkg', min: 0, max: 100 } },
      series: [
        { id: 'weak', label: 'loose', points: [{ x: 1, y: 94 }, { x: 4, y: 78 }, { x: 8, y: 58 }, { x: 12, y: 43 }] },
        { id: 'kgd', label: 'KGD', points: [{ x: 1, y: 94 }, { x: 4, y: 88 }, { x: 8, y: 80 }, { x: 12, y: 73 }] },
        { id: 'pkg', label: 'pkg loss', points: [{ x: 1, y: 92 }, { x: 4, y: 84 }, { x: 8, y: 72 }, { x: 12, y: 61 }] },
      ],
      markers: [
        { id: 'knee', x: 8, y: 58, label: 'escape tax' },
      ],
    }),
    highlight: { active: ['kgd', 'pkg'], compare: ['weak', 'knee'] },
    explanation: 'The illustrative curve shows why upstream screening has leverage. As chiplet count rises, untested or weakly tested components make final package yield fall quickly.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'yield pipeline') yield* yieldPipeline();
  else if (view === 'bin ledger') yield* binLedger();
  else throw new InputError('Pick a known-good-die yield view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `Known-good-die discipline exists because a multi-die package multiplies risk before it multiplies value. A package can contain logic chiplets, I/O dies, HBM stacks, bumps, package routes, and thermal interfaces. If one component is weak, the finished package may fail even though every other component was expensive and good.`,
        `A monolithic die has a simpler failure boundary: test the die, package it, test the package, then bin the result. A chiplet product has more combinations. A bad die can waste good companion dies. A weak bond can ruin a kit made from good dies. A marginal link can pass a cheap test and fail under heat or workload stress.`,
        `The goal is to move evidence upstream. Before assembly, each die should carry a structured record: lot, wafer position, test conditions, speed bin, voltage curve, thermal behavior, memory repair state, link margin, and traceability. The package planner uses those records to build a compatible kit instead of treating assembly as a guess followed by one final exam.`,
        {type:'callout', text:'Known-good-die is a structured evidence ledger that moves yield risk upstream before assembly multiplies the cost of a weak component.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/dc/Probe_card.JPG', alt:'Probe card used for wafer-level semiconductor testing', caption:'Probe card used in wafer testing, the upstream screen behind known-good-die workflows. Source: Wikimedia Commons, Ajoones, CC BY 3.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        `The reasonable first attempt is to test the finished package and let final screen decide. This is not foolish. The final package is the product the customer will receive, and it includes every die, connection, thermal path, and power-delivery condition. Some failures only appear after assembly, so final test is mandatory.`,
        `The wall is that final-package test is too late for many decisions. If an HBM stack, logic die, or I/O chiplet was already bad before assembly, final test discovers the truth after the product has consumed substrate area, assembly time, other good dies, and tester capacity. The cost of one bad component has been amplified into the cost of a bad package.`,
        `A second naive approach is to reduce known-good die to one pass/fail bit. That also fails. A die can be good for a lower-voltage SKU and bad for a high-frequency SKU. It can have enough memory repair for one product tier and not another. It can pass functional tests while carrying weak link margin that only matters in a package topology with long routes or high temperature. Known-good die is a certificate, not a boolean.`,
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is multiplicative yield. If a package needs several components and each component or assembly step has a chance of failure, the probability of a good final package is the product of those probabilities. Even high individual yields can combine into a painful final yield when many chiplets, stacks, and process steps are involved. Weak screening makes the product curve fall faster as chiplet count rises.`,
        `There is also an information wall. Without traceability, a failed package is hard to explain. Was the loss caused by a specific wafer lot, a probe escape, an assembly process window, a bad HBM stack, link-margin drift, thermal stress, or a substrate defect? If the ledger does not preserve enough evidence, yield learning turns into guessing.`,
        `The economic wall is opportunity cost. Advanced package assembly and test capacity can be scarce. A bad kit does not merely lose material; it occupies a slot that could have produced a sellable accelerator. Yield ledgers connect engineering risk to cost of goods and supply commitments.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to treat manufacturing evidence as a data structure that flows with the die. A die is not just an object in a tray. It is an object plus a ledger: identity, origin, measured behavior, limits, repair state, and permitted uses. Assembly consumes those records to form a package kit whose combined margins match a target product.`,
        `The invariant is multiplicative yield with traceability. Every package outcome should be explainable as the combination of component records and process records. If a package passes, the ledger should support SKU assignment and warranty confidence. If it fails, the ledger should help localize the loss to incoming die quality, assembly, package routing, thermal behavior, or test escape.`,
        `This changes the role of testing. Wafer sort is not only a gate that rejects bad dies. It is also a classifier that creates bins. Package screen validates that the chosen kit, assembly process, and operating envelope work together. Field returns feed future screening and binning thresholds.`,
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        `The pipeline begins at wafer sort. Probe tests measure functionality and parametric behavior before the wafer is diced. Dies that fail are marked out. Dies that pass are classified into bins: frequency, voltage, leakage, thermal behavior, memory repair, link margin, redundancy use, and sometimes workload-specific stress behavior. The result is a set of candidates, not a pile of identical parts.`,
        `Planning then builds a package kit. A high-end SKU may require fast logic dies, strong link margin, healthy memory repair, and compatible thermal curves. A lower-tier SKU may accept weaker frequency, disabled lanes, or reduced memory capacity. The planner is solving a matching problem: combine dies so the package has enough margin without wasting top-bin parts.`,
        `Assembly creates new risks. Microbumps can open or short. Warpage can change contact quality. Interposer or substrate routes can be defective. Thermal interface quality can vary. Dies that were individually good can interact badly in the package. Final screen exists because KGD reduces risk; it does not eliminate package-level failure.`,
        `The ledger updates after every stage. A failed screen records loss type and suspected cause. A passing screen records SKU, margins, disabled resources, and test conditions. Field data connects failures back to lots, bins, assembly windows, or stress patterns.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The yield-pipeline view proves that where a failure is discovered changes its cost. A die rejected at wafer sort costs probe time and one die. A weak die discovered after assembly can cost the companion dies, package substrate, assembly process, final test time, and an allocation slot. A weak die that escapes into shipment also costs warranty, reputation, and fleet debugging.`,
        `The bin-ledger view proves that the record is the real data structure. Speed, voltage, temperature behavior, link margin, memory repair, and traceability are not decoration. They decide which dies are compatible, which SKU can be sold, and which failures can be learned from. The plotted curve shows the yield lesson: as chiplet count rises, upstream screening has more influence because each unchecked component becomes another multiplier in the final package probability.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `Known-good-die discipline works because it reduces uncertainty before irreversible cost is added. Wafer sort removes obvious bad dies. Binning separates strong dies from weaker but still useful dies. Assembly planning avoids incompatible combinations. Package screen catches failures introduced by integration. Each stage narrows the remaining risk while preserving evidence about what was tested and under which conditions.`,
        `The correctness argument is a conservation argument. The system should never lose identity or test context as material moves from wafer to die to kit to package to SKU. If a die has a weak lane, that fact must be repaired, matched to a product tier that tolerates it, or rejected. Without record continuity, the flow cannot distinguish a real process problem from random noise.`,
        `This is also why KGD is not just quality control. It is scheduling and inventory control. A pool of known bins lets planners reserve high-margin dies for high-value packages, route weaker dies into lower SKUs, and avoid building kits that are unlikely to pass. Good evidence makes the factory less random.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `Testing costs time, equipment, engineering effort, and sometimes yield. Probe time is finite. Burn-in and stress screens can be expensive. More tests can catch more failures, but they can also slow the line, create false rejects, and consume capacity that might be better spent on higher-risk products. The right screen is an economic choice, not a moral choice to test everything forever.`,
        `The data cost matters too. A serious ledger must store die identity, bins, measurements, conditions, assembly relationships, package outcomes, and field feedback. It must be queryable by lot, wafer position, package kit, SKU, failure type, and test condition. If data is inconsistent or trapped in separate systems, engineers cannot close the loop.`,
        `When chiplet count doubles, unchecked escape risk compounds. Stronger KGD screening can flatten the loss curve, but it cannot make assembly yield free. The product still pays for package defects, handling damage, thermal interaction, weak routes, and final-screen coverage gaps. KGD moves risk earlier and makes it measurable; it does not repeal probability.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `KGD workflows win in products where package value is high and component count is large: heterogeneous AI accelerators, multi-chiplet CPUs, 2.5D interposer packages, HBM-based systems, 3D stacks, and reliability-sensitive automotive, aerospace, industrial, or defense electronics. The more expensive the package and the scarcer the assembly capacity, the more valuable early evidence becomes.`,
        `They also win when binning creates product flexibility. A die that cannot meet the top SKU may still be valuable in a lower tier. A package with one disabled link or reduced memory capacity may be sellable. The ledger converts variation into controlled SKU planning instead of treating all non-perfect parts as identical scrap.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `Known-good-die systems fail when tests do not match real stress. A die can pass at probe temperature and fail after assembly heat. A link can pass a short pattern and fail under long high-traffic workloads. A memory repair scheme can look sufficient until a product tier needs more capacity. Testing only cheap corners creates escape risk; testing every possible corner is usually too expensive.`,
        `The ledger also fails when it is too shallow. A single pass/fail flag cannot support compatibility planning, root-cause analysis, field-return correlation, or SKU recovery. Another failure is overconfidence: incoming dies can all be good and the package can still fail because assembly introduced defects or because the system-level interaction was not covered by component tests.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study Chiplet Interconnect next because link margin, repair lanes, and package topology are major entries in the yield ledger. Study Chiplet Link Budget and Repair Lane to see how physical link evidence becomes a binning decision. Study reliability engineering, burn-in, statistical process control, and supply-chain traceability to understand how manufacturing evidence becomes an operational system.`,
        `Sources: IEEE IRDS Packaging Integration at https://irds.ieee.org/images/files/pdf/2020/2020IRDS_PI.pdf, TSMC CoWoS at https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm, and TSMC 3DFabric for HPC at https://www.tsmc.com/english/dedicatedFoundry/technology/platform_HPC_tech_WLSI.`,
      ],
    },
  ],
};
