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
      heading: 'How to read the animation',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/AMD_Instinct_MI300.jpg/640px-AMD_Instinct_MI300.jpg', alt:'AMD Instinct MI300 multi-die accelerator package showing chiplet and HBM integration', caption:'AMD Instinct MI300 — a multi-die package integrating compute chiplets and HBM stacks in a single module. The physical routing between these dies determines memory bandwidth, thermal limits, and ultimately cost per token. Source: Wikimedia Commons, AMD, CC BY-SA 4.0'},
        {type:'callout', text:'The package is where the abstract system diagram becomes physical constraints. A route is not just a wire — it spends area, metal layers, signal-integrity margin, power-delivery space, thermal headroom, yield, and packaging capacity. These budgets are coupled: widening a bus for bandwidth costs thermal headroom and yield.'},
        'Read the package-map view as a graph embedded in a physical floorplan. A node is a die, memory stack, power-delivery region, bridge, cooling path, or I/O escape region. An edge is a required physical connection that spends routing area, metal layers, power margin, and thermal headroom.',
        'Active nodes show the constraint currently being budgeted. Compare nodes show a competing use of the same physical space. If the HBM edge is active while the power-delivery network is also highlighted, the safe inference is that bandwidth and current delivery are contending for one local routing budget.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'Advanced packaging exists because a modern accelerator needs more memory bandwidth and chip-to-chip bandwidth than a normal board can provide at acceptable power. HBM means high-bandwidth memory: stacked DRAM placed beside logic so thousands of short connections can move data each cycle. The package is the physical platform that holds those dies, routes those connections, feeds power, removes heat, and survives manufacturing.',
        'This is a data-structure problem because the package has nodes, edges, capacities, and blocked regions. The logic die, HBM stacks, bridges, interposers, organic substrate layers, power bumps, and cooling path all compete inside one small space. A software team may see tokens per second, throttling, or accelerator shortage, but the bottleneck can be a routing and thermal map.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to choose the densest packaging option and put memory as close to compute as possible. If the product needs more bandwidth, a silicon interposer or dense bridge seems like the direct answer. Shorter wires reduce energy per bit, and wider buses make the headline bandwidth easier to reach.',
        'That approach is reasonable for a first pass because routing density is a real limiter. It fails when density is treated as the only limiter. The same neighborhood also needs power-delivery metal, decoupling, keep-out zones, test access, mechanical support, and a heat path.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is coupled budgets. A package can be electrically routable and still fail because the voltage drop is too high, the thermal resistance is too large, or the assembly yield is too low. IR drop means voltage lost through the power-delivery network as current flows through nonzero resistance.',
        'Moving HBM closer to logic can improve bandwidth and energy, but it can also place heat-sensitive memory near the hottest die. Spreading the dies improves cooling but lengthens wires and may require more package area. There is no independent local win; each move spends several budgets at once.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is budget closure across coupled physical resources. Budget closure means every required constraint is satisfied at the same time, not one at a time in isolation. A package is correct only if routing, power, heat, mechanics, test, yield, and supply all close together.',
        'The right mental model is a graph over a heat map. The graph says which components must connect and with what bandwidth, latency, and current. The heat map says where power is burned and where heat can leave the stack.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A package design starts with workload numbers: memory bandwidth, memory capacity, logic power, I/O bandwidth, maximum temperature, unit-cost target, and expected shipment volume. Those numbers become a floorplan with logic dies, HBM stacks, bridges or interposers, organic substrate routing, power delivery, and cooling structures. The designer then checks whether every required edge can be routed without breaking another budget.',
        'A silicon interposer gives fine routing and dense HBM attachment, but it spends silicon area and capacity. An organic substrate can be larger and cheaper, but its routing pitch is coarser. An embedded bridge can provide local dense routing, but placement and escape routing become harder because only some regions have fine connections.',
        'The process is iterative. If HBM links do not meet bandwidth, the floorplan may move memory closer or add routes. If temperature exceeds the limit, the floorplan may spread heat sources, improve cooling, or lower sustained power. If IR drop exceeds the limit, the power-delivery network needs more metal or bumps, which can steal area from signal routing.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is conservation of budgets. A proposed floorplan is valid only if every required connection has enough routing capacity, every load has enough delivered voltage, every hot region has a heat path, and every assembly step has acceptable yield. If any one budget is overspent, the package does not meet the product contract.',
        'Advanced packaging works because it changes physical distances and local wire density. Shorter memory paths reduce energy per transferred bit, and wider local interfaces expose more bandwidth than board-level traces. Chiplets also let a product combine dies from different process nodes, but that economic gain is real only if package assembly and test yield remain high enough.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The asymptotic cost is not a clean Big-O formula because the design is constrained by physics and supply. Still, the behavior is clear: doubling memory stacks roughly doubles the number of high-bandwidth local links, increases routing congestion near the logic die, raises package area, and adds thermal coupling. The dominant cost is often not one more wire; it is the package technology and verification needed to route many wires safely.',
        'Concrete numbers make the behavior visible. Suppose four HBM stacks each require 1,024 data connections to the logic region, for 4,096 high-speed signal paths before clocks, power, and control. Moving to eight stacks asks for about 8,192 such paths and also increases heat near the compute die, so the design may need a larger interposer, more bridge regions, or lower sustained power.',
        'The hidden costs are engineering time, package capacity, test coverage, and yield. A denser package can reduce energy per bit and improve throughput, but it can also become the scarce item that limits shipments. Cost is behavior here: tighter placement buys bandwidth while making thermal, power, and manufacturing failures more likely.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'The main use is AI accelerators with HBM. Training and inference both move large tensors between compute and memory, so the package decides how much of the advertised HBM bandwidth can be consumed under sustained power and temperature limits. Power delivery controls sustained frequency, and thermal design controls throttling during long runs.',
        'The same pattern appears in high-performance computing, network processors, chiplet CPUs, cache-stacked processors, and systems that need more local bandwidth than board traces can provide. The fit is strongest when a few nearby functions exchange large volumes of data repeatedly. Advanced packaging is less useful when the workload is dominated by remote I/O, storage, or software overhead outside the package.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when packaging is treated as decoration around the architecture. The package can decide memory bandwidth, accelerator availability, unit cost, and software-visible performance. A team that waits until late layout to discover the package constraint has already lost design freedom.',
        'It also fails when one metric dominates the design review. A wide interconnect that cannot run at target temperature is not a product feature. A cheaper substrate that cannot meet signal integrity, power delivery, or yield targets is not equivalent to the denser option it replaced.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Take an accelerator target with one 700 W logic region and four HBM stacks. Each HBM stack is planned for 1 TB/s of bandwidth, so the package target is 4 TB/s total. If each stack needs 1,024 local data paths, the routing ledger starts with 4,096 high-speed data paths before control, clocks, redundancy, and power structures.',
        'The first layout puts all four HBM stacks close to the logic die. Routing is short, but the thermal model shows HBM nearest the logic region running 7 C above the limit during a sustained workload. Moving two stacks outward lowers that HBM temperature by 5 C, but route length rises and the design needs an extra bridge region to keep timing and signal integrity.',
        'The chosen design is not the shortest-wire design. It is the design where bandwidth, voltage drop, peak temperature, yield, and package capacity all close. The final cost per token improves because the accelerator sustains its target frequency instead of throttling under the workload that matters.',
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
