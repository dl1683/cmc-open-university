// Advanced packaging routing and thermal map: interposer, bridge, organic
// substrate, PDN, HBM placement, hot spots, and routing-density ledgers.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'advanced-packaging-routing-thermal-map-case-study',
  title: 'Advanced Packaging Routing & Thermal Map Case Study',
  category: 'Systems',
  summary: 'A package-design primer: map HBM, logic, bridges, interposers, organic fanout, power delivery, keep-out zones, thermal coupling, and route-density limits.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['package map', 'thermal routing'], defaultValue: 'package map' },
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

function packageMap(title, { hot = false } = {}) {
  return graphState({
    nodes: [
      { id: 'xpu', label: 'XPU', x: 4.7, y: 3.5, note: hot ? 'hot' : 'logic' },
      { id: 'hbm0', label: 'HBM0', x: 1.0, y: 1.5, note: 'mem' },
      { id: 'hbm1', label: 'HBM1', x: 1.0, y: 5.5, note: 'mem' },
      { id: 'hbm2', label: 'HBM2', x: 8.4, y: 1.5, note: 'mem' },
      { id: 'hbm3', label: 'HBM3', x: 8.4, y: 5.5, note: 'mem' },
      { id: 'io', label: 'I/O', x: 4.7, y: 6.6, note: 'SerDes' },
      { id: 'int', label: 'intp', x: 4.7, y: 1.0, note: 'route' },
      { id: 'br', label: 'brdg', x: 2.8, y: 3.5, note: 'local' },
      { id: 'pdn', label: 'PDN', x: 6.6, y: 3.5, note: hot ? 'IR' : 'power' },
      { id: 'cool', label: 'cool', x: 4.7, y: 0.3, note: 'sink' },
    ],
    edges: [
      { id: 'e-hbm0-xpu', from: 'hbm0', to: 'xpu', weight: 'wide' },
      { id: 'e-hbm1-xpu', from: 'hbm1', to: 'xpu', weight: 'wide' },
      { id: 'e-hbm2-xpu', from: 'hbm2', to: 'xpu', weight: 'wide' },
      { id: 'e-hbm3-xpu', from: 'hbm3', to: 'xpu', weight: 'wide' },
      { id: 'e-io-xpu', from: 'io', to: 'xpu', weight: 'escape' },
      { id: 'e-int-xpu', from: 'int', to: 'xpu', weight: 'RDL' },
      { id: 'e-br-xpu', from: 'br', to: 'xpu', weight: 'local' },
      { id: 'e-pdn-xpu', from: 'pdn', to: 'xpu', weight: 'V' },
      { id: 'e-cool-xpu', from: 'cool', to: 'xpu', weight: hot ? 'limit' : 'heat' },
      { id: 'e-pdn-hbm2', from: 'pdn', to: 'hbm2', weight: 'V' },
    ],
  }, { title });
}

function tradeGraph(title) {
  return graphState({
    nodes: [
      { id: 'need', label: 'need', x: 0.8, y: 3.5, note: 'AI' },
      { id: 'route', label: 'route', x: 2.4, y: 2.0, note: 'density' },
      { id: 'area', label: 'area', x: 2.4, y: 5.0, note: 'size' },
      { id: 'sil', label: 'Si', x: 4.3, y: 1.4, note: 'fine' },
      { id: 'org', label: 'org', x: 4.3, y: 3.5, note: 'large' },
      { id: 'bridge', label: 'brdg', x: 4.3, y: 5.6, note: 'spot' },
      { id: 'therm', label: 'therm', x: 6.4, y: 2.1, note: 'hot' },
      { id: 'pdn', label: 'PDN', x: 6.4, y: 4.9, note: 'drop' },
      { id: 'choice', label: 'choice', x: 8.4, y: 3.5, note: 'pkg' },
    ],
    edges: [
      { id: 'e-need-route', from: 'need', to: 'route' },
      { id: 'e-need-area', from: 'need', to: 'area' },
      { id: 'e-route-sil', from: 'route', to: 'sil' },
      { id: 'e-area-org', from: 'area', to: 'org' },
      { id: 'e-route-bridge', from: 'route', to: 'bridge' },
      { id: 'e-sil-therm', from: 'sil', to: 'therm' },
      { id: 'e-org-pdn', from: 'org', to: 'pdn' },
      { id: 'e-bridge-pdn', from: 'bridge', to: 'pdn' },
      { id: 'e-therm-choice', from: 'therm', to: 'choice' },
      { id: 'e-pdn-choice', from: 'pdn', to: 'choice' },
      { id: 'e-sil-choice', from: 'sil', to: 'choice' },
      { id: 'e-org-choice', from: 'org', to: 'choice' },
    ],
  }, { title });
}

function* packageMapView() {
  yield {
    state: packageMap('Package floorplan is a routing graph'),
    highlight: { active: ['xpu', 'hbm0', 'hbm1', 'hbm2', 'hbm3', 'e-hbm0-xpu', 'e-hbm2-xpu'], compare: ['io'] },
    explanation: 'A high-end AI package is a floorplan graph. HBM stacks want short wide paths to compute, I/O needs package escape, power delivery needs low impedance, and cooling needs a path out.',
  };

  yield {
    state: labelMatrix(
      'Package choices',
      [
        { id: 'sil', label: 'Si intp' },
        { id: 'org', label: 'organic' },
        { id: 'br', label: 'bridge' },
        { id: 'fan', label: 'fanout' },
      ],
      [
        { id: 'win', label: 'win' },
        { id: 'limit', label: 'limit' },
      ],
      [
        ['dense', 'cost'],
        ['large', 'pitch'],
        ['local', 'place'],
        ['area', 'verify'],
      ],
    ),
    highlight: { active: ['sil:win', 'org:win', 'br:win'], compare: ['sil:limit', 'org:limit'] },
    explanation: 'Interposer, organic substrate, bridge, and fanout are not ranked on one axis. They trade routing density, area, cost, mechanical risk, thermal path, and supply availability.',
    invariant: 'The package is where memory bandwidth meets manufacturability.',
  };

  yield {
    state: packageMap('Power delivery competes with signal routing'),
    highlight: { active: ['pdn', 'xpu', 'hbm2', 'e-pdn-xpu', 'e-pdn-hbm2'], compare: ['int', 'br'] },
    explanation: 'Power delivery is not separate from routing. PDN metal, decoupling, bumps, and keep-out zones consume package resources that signal routes also want.',
  };

  yield {
    state: packageMap('Thermal placement constrains the fastest links', { hot: true }),
    highlight: { active: ['cool', 'xpu', 'hbm0', 'hbm2', 'e-cool-xpu', 'e-hbm0-xpu', 'e-hbm2-xpu'], found: ['pdn'] },
    explanation: 'Placing memory close to hot logic improves bandwidth and energy per bit, but it can also thermally couple heat-sensitive HBM to the hottest die. The floorplan must satisfy both link and cooling constraints.',
  };
}

function* thermalRouting() {
  yield {
    state: tradeGraph('The package choice is a constrained optimizer'),
    highlight: { active: ['need', 'route', 'area', 'sil', 'org', 'bridge'], compare: ['choice'] },
    explanation: 'The design target starts as a workload need: bandwidth, capacity, area, and power. The package designer maps that need onto route density, package area, interposer or organic routing, bridges, thermal path, and PDN.',
  };

  yield {
    state: labelMatrix(
      'Constraint ledger',
      [
        { id: 'bw', label: 'bw' },
        { id: 'temp', label: 'temp' },
        { id: 'ir', label: 'IR' },
        { id: 'warp', label: 'warp' },
        { id: 'cap', label: 'cap' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['GB/s', 'route'],
        ['C', 'spread'],
        ['mV', 'PDN'],
        ['um', 'stiffen'],
        ['wafers', 'alt'],
      ],
    ),
    highlight: { active: ['bw:measure', 'temp:measure', 'ir:measure'], found: ['cap:fix'] },
    explanation: 'A useful package ledger tracks bandwidth demand, temperature, IR drop, warpage, and packaging capacity. The fix may be more routes, different placement, stronger PDN, mechanical changes, or a different packaging flow.',
    invariant: 'A packaging bottleneck becomes a software bottleneck when it limits shipped accelerators.',
  };

  yield {
    state: tradeGraph('Thermal and PDN limits close design doors'),
    highlight: { active: ['therm', 'pdn', 'choice', 'e-therm-choice', 'e-pdn-choice'], compare: ['sil', 'org', 'bridge'] },
    explanation: 'A route that works electrically can still fail the product if it creates an impossible thermal stack-up or too much voltage drop. Routing, power, and heat must be solved as one package problem.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'route dens', min: 0, max: 10 }, y: { label: 'pkg cost', min: 0, max: 10 } },
      series: [
        { id: 'org', label: 'organic', points: [{ x: 2, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 4 }] },
        { id: 'bridge', label: 'bridge', points: [{ x: 4, y: 4 }, { x: 6, y: 5.4 }, { x: 7, y: 6.2 }] },
        { id: 'sil', label: 'Si', points: [{ x: 6, y: 6 }, { x: 8, y: 8 }, { x: 9, y: 9.4 }] },
      ],
      markers: [
        { id: 'ask', x: 7.4, y: 5.3, label: 'ask' },
      ],
    }),
    highlight: { active: ['ask', 'sil'], compare: ['org', 'bridge'] },
    explanation: 'The simplified frontier captures the local chiplet source thesis: AI wants very high routing density near HBM, while cost and package capacity push designers toward alternatives that raise the organic or bridge frontier.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'package map') yield* packageMapView();
  else if (view === 'thermal routing') yield* thermalRouting();
  else throw new InputError('Pick an advanced-packaging view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Advanced packaging is where chiplets become a product. The package floorplan decides where logic dies, HBM stacks, I/O, bridges, interposers, organic fanout, power delivery, decoupling, keep-out zones, and cooling paths live. The data structure is a constrained map: every placement edge consumes routing, power, thermal, and manufacturing budget.',
        'TSMC describes CoWoS as wafer-level system integration for ultra-high-performance computing, with a silicon interposer supporting logic chiplets and HBM cubes: https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm. TSMC 3DFabric for HPC describes 3D stacking and CoWoS technologies for high memory bandwidth and cloud/data-center requirements: https://www.tsmc.com/english/dedicatedFoundry/technology/platform_HPC_tech_WLSI.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A package map starts with the workload. AI accelerators need HBM bandwidth, compute power, scale-out I/O, and serviceable cooling. The package designer chooses silicon interposer, organic substrate, bridge, fanout, or hybrid flows to satisfy route density and reach. Then the design must close power integrity, signal integrity, thermal, mechanical, test, and supply constraints.',
        'The local Eliyan article made the interposer tradeoff concrete: silicon interposers provide fine routing for HBM-class links, but cost, supply, thermal, mechanical, and proprietary packaging constraints can become strategic bottlenecks. This module turns that argument into a floorplan and ledger.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Routing density competes with everything. More HBM links need more wires and bumps. More power needs stronger PDN and decoupling. More thermal headroom needs better placement and cooling. More package area can improve placement but may increase yield and capacity risk. These constraints interact, so optimizing one in isolation can make the product worse.',
        'The hidden cost is capacity. Even if compute dies exist, package capacity, interposer supply, substrate availability, or test throughput can limit shipped accelerators. Software teams feel that as GPU scarcity, higher rental prices, smaller batch sizes, or pressure to optimize memory and inference costs.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The clearest use is AI accelerators with HBM. Package routing controls whether the model can get enough memory bandwidth. Power delivery controls whether the dies can run at target frequency. Thermal placement controls whether sustained workloads throttle. The same floorplan ideas appear in CPUs with 3D cache, networking ASICs, chiplet-based SoCs, and high-performance compute packages.',
        'AMD describes 3D V-Cache as a stacking technology that increases interconnect density compared with on-package 2D chiplets: https://www.amd.com/en/products/processors/technologies/3d-v-cache.html. That is a different product class from HBM-heavy AI packages, but the shared lesson is that physical proximity, interconnect density, power, and thermal design are architectural choices.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that advanced packaging is a back-end implementation detail. It now shapes memory bandwidth, accelerator availability, cost, and software performance. The second misconception is that moving from silicon interposer to organic substrate is simply cheaper. The alternative must still meet route density, energy per bit, signal integrity, thermal, reliability, and supply goals.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: TSMC CoWoS at https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm, TSMC 3DFabric for HPC at https://www.tsmc.com/english/dedicatedFoundry/technology/platform_HPC_tech_WLSI, AMD 3D V-Cache at https://www.amd.com/en/products/processors/technologies/3d-v-cache.html, and IEEE IRDS Packaging Integration at https://irds.ieee.org/images/files/pdf/2020/2020IRDS_PI.pdf. Study Chiplet Interconnect Case Study, HBM Pseudo-Channel Scheduler, UCIe Flit/Credit/Retry, and Known-Good-Die Yield Ledger next.',
      ],
    },
  ],
};
