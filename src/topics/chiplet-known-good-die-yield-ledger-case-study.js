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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the yield-pipeline view as a cost timeline. A die is a small piece of silicon cut from a wafer, and a package is the assembled product that connects several dies to substrate, memory, and cooling. The earlier a bad die is rejected, the less good material it can waste.',
        'Read the bin-ledger view as a record system, not as a pass/fail badge. Active rows show the evidence being added: wafer test, speed bin, voltage curve, link margin, memory repair, assembly result, or field return. The safe inference is that a die is known-good only for a specific product envelope.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Known-good-die discipline exists because multi-die packages multiply risk before they multiply value. If a package contains four logic chiplets, eight HBM stacks, thousands of microbumps, and many package routes, one weak component can ruin the finished unit. Final test still matters, but it happens after expensive assembly has already been spent.',
        'The goal is to move evidence upstream. Before assembly, each die should carry records for lot, wafer position, functional tests, speed bin, voltage behavior, thermal behavior, memory repair, link margin, and traceability. The package planner uses those records to build a compatible kit rather than discovering obvious failures at the end.',
        {type:'callout', text:'Known-good-die is a structured evidence ledger that moves yield risk upstream before assembly multiplies the cost of a weak component.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/d/dc/Probe_card.JPG', alt:'Probe card used for wafer-level semiconductor testing', caption:'Probe card used in wafer testing, the upstream screen behind known-good-die workflows. Source: Wikimedia Commons, Ajoones, CC BY 3.0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to assemble the package and test the final product. That is not foolish because the final package is what customers receive, and some defects only appear after bonding, routing, thermal interface, and power delivery are present. Final screen is mandatory.',
        'Another obvious approach is to label each incoming die as simply good or bad. That is also tempting because it simplifies inventory. It fails because a die can be good for a low-voltage SKU, bad for a high-frequency SKU, acceptable with one repaired lane, or unacceptable in a topology that needs full link margin.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is multiplicative yield. If a package needs six components and each has a 98 percent chance of being good, the component-only probability is about 0.98^6, or 88.6 percent, before assembly defects. At twelve components, the same per-component yield gives about 78.5 percent.',
        'There is also an information wall. If a finished package fails without die-level history, engineers cannot tell whether the loss came from wafer lot, probe escape, assembly damage, weak HBM, link margin drift, thermal stress, or substrate defect. Without traceability, yield learning turns into guessing.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to treat manufacturing evidence as a data structure that travels with the die. A die is not just a part in a tray; it is identity plus measured behavior plus allowed uses. Assembly consumes those records to make package kits whose combined margins match a product target.',
        'The invariant is evidence continuity. The system should never lose die identity, test condition, bin assignment, repair state, or package relationship as material moves from wafer to die to kit to finished SKU. If that chain breaks, a later pass or failure cannot be explained.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline begins at wafer sort, where probe cards contact dies before dicing. Tests reject obvious failures and classify passing dies by frequency, voltage, leakage, memory repair, link margin, and temperature behavior. The output is a set of bins, not a pile of identical good parts.',
        'Planning then builds a kit. A top SKU may require strong logic dies, healthy HBM stacks, high link margin, and compatible thermal curves. A lower tier may tolerate disabled lanes or reduced frequency. After assembly, package screen validates the interaction and updates the ledger with final SKU, margins, failures, and suspected causes.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Known-good-die works because it reduces uncertainty before irreversible cost is added. Wafer sort removes the cheapest failures. Binning routes weaker but usable dies into products that can tolerate them. Assembly planning avoids combinations that are unlikely to pass.',
        'The correctness argument is a conservation argument. Every downstream decision must be justified by preserved upstream evidence. If a die has a weak lane, the record must show whether that lane was repaired, avoided by topology, assigned to a lower SKU, or rejected. The factory cannot make correct matching decisions from a lost or flattened record.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Testing costs probe time, equipment, engineering effort, and sometimes yield. A deeper stress screen can catch more escapes, but it can also slow the line, consume scarce testers, and reject parts that would have worked in lower tiers. The economic question is how much downstream package loss each extra screen prevents.',
        'The ledger itself has cost. It must store die identity, measurements, test conditions, assembly relationships, package outcomes, field feedback, and query paths by lot, wafer position, SKU, failure mode, and package kit. When chiplet count doubles, escape risk compounds, so the value of good upstream evidence rises faster than the value of one final pass/fail bit.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Known-good-die workflows win in heterogeneous AI accelerators, multi-chiplet CPUs, 2.5D interposer packages, HBM systems, 3D stacks, and reliability-sensitive automotive or industrial electronics. These products put high value behind each package assembly slot. A bad incoming die can waste scarce advanced-packaging capacity.',
        'They also support product binning. A die that misses the top frequency can still be valuable in a lower SKU, and a package with one disabled link can still be sold if the product tier allows it. The ledger turns manufacturing variation into controlled inventory instead of surprise scrap.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when tests do not match real operating stress. A die can pass probe at one temperature and fail after package heat changes timing. A link can pass a short pattern and fail under long high-traffic workloads. Cheap screens reduce risk only for the failures they actually cover.',
        'It also fails when the ledger is too shallow. A single pass/fail flag cannot support compatibility planning, root-cause analysis, warranty investigation, or SKU recovery. Incoming dies can all be good and the package can still fail because assembly created a new defect.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a package needs four compute chiplets and four HBM stacks. Incoming compute dies have 97 percent good probability, HBM stacks have 96 percent, and assembly has 98 percent probability. Without better screening, final yield is 0.97^4 * 0.96^4 * 0.98, or about 71 percent.',
        'Now add upstream screening that removes most weak HBM stacks and raises effective HBM input probability to 99 percent, while adding 2 percent probe cost to each HBM stack. The package probability becomes 0.97^4 * 0.99^4 * 0.98, or about 81 percent. If each failed package wastes hundreds of dollars in companion dies and assembly time, the extra probe cost is buying sellable output, not just prettier test data.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with IEEE IRDS Packaging Integration at https://irds.ieee.org/images/files/pdf/2020/2020IRDS_PI.pdf, TSMC CoWoS at https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm, and TSMC 3DFabric for HPC at https://www.tsmc.com/english/dedicatedFoundry/technology/platform_HPC_tech_WLSI. Read them for the manufacturing and packaging constraints behind the ledger, especially where test, assembly, and yield evidence meet.',
        'Study Chiplet Interconnect to understand the topology that the die records must serve. Study Chiplet Link Budget and Repair Lane to see how lane health becomes a binning decision. Then study reliability engineering, burn-in, statistical process control, and supply-chain traceability for the factory systems around known-good die.',
      ],
    },
  ],
};