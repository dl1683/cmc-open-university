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
      heading: 'What it is',
      paragraphs: [
        'Known-good-die discipline is the manufacturing side of chiplet architecture. Before several dies are assembled into one expensive package, each die should carry evidence that it passed the right electrical, speed, voltage, thermal, memory, and link-margin checks. The package planner then builds a compatible kit instead of hoping every part works after assembly.',
        'The IEEE IRDS Packaging Integration white paper describes chiplet integration as assembling known good dies or chiplets onto high-density substrates: https://irds.ieee.org/images/files/pdf/2020/2020IRDS_PI.pdf. TSMC describes CoWoS as wafer-level system integration for AI and supercomputing with logic chiplets and HBM cubes on a silicon interposer: https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The pipeline is wafer sort, known-good-die classification, binning, assembly, package screen, SKU assignment, and field feedback. Each die receives a record: lot, wafer position, test conditions, speed bin, voltage curve, thermal behavior, link margin, memory repair status, and quality flags. Assembly consumes those records to create a package kit that matches the product target.',
        'Yield is multiplicative. A package with one logic die, several HBM stacks, an I/O die, and an interposer can fail because any one component was bad or because assembly introduced a new defect. That is why upstream screening and final package tests are both necessary.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'KGD testing costs money, takes time, and requires expensive probe and stress infrastructure. Skipping it can be worse: a bad die found after assembly wastes good companion dies, substrate capacity, HBM stacks, test time, and packaging allocation. The ledger turns that tradeoff into a visible economics problem.',
        'The local Eliyan/chiplet corpus framed interposer and package supply as a bottleneck for AI accelerators. That makes yield discipline strategic. If advanced packaging capacity is scarce, every preventable assembly loss is not just a cost item; it is lost accelerator supply.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'Known-good-die workflows are central to heterogeneous AI packages, CPUs with multiple chiplets, 2.5D interposer designs, 3D stacks, HBM assemblies, and automotive or defense packages that need stronger reliability screens. The same ledger logic also applies to repairable memory stacks and spare-lane interconnects.',
        'This module complements Chiplet Link Budget & Repair Lane Case Study. Link-budget telemetry says whether the physical connection is healthy. The KGD ledger says whether the dies were good enough to assemble in the first place and which final SKU they can support.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that KGD is a single pass/fail bit. In serious packages, the certificate must include operating corners, stress conditions, bin grades, and traceability. The second misconception is that small chiplets automatically improve yield. Smaller dies can help silicon yield, but assembly, substrate, interconnect, HBM, and test escapes still determine final package economics.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: IEEE IRDS Packaging Integration at https://irds.ieee.org/images/files/pdf/2020/2020IRDS_PI.pdf, TSMC CoWoS at https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm, and TSMC 3DFabric for HPC at https://www.tsmc.com/english/dedicatedFoundry/technology/platform_HPC_tech_WLSI. Study Chiplet Interconnect Case Study, Chiplet Link Budget & Repair Lane Case Study, UCIe Flit/Credit/Retry, and HBM Pseudo-Channel Scheduler next.',
      ],
    },
  ],
};
