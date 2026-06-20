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
      heading: 'Why this exists',
      paragraphs: [
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/AMD_Instinct_MI300.jpg/640px-AMD_Instinct_MI300.jpg', alt:'AMD Instinct MI300 multi-die accelerator package showing chiplet and HBM integration', caption:'AMD Instinct MI300 — a multi-die package integrating compute chiplets and HBM stacks in a single module. The physical routing between these dies determines memory bandwidth, thermal limits, and ultimately cost per token. Source: Wikimedia Commons, AMD, CC BY-SA 4.0'},
        {type:'callout', text:'The package is where the abstract system diagram becomes physical constraints. A route is not just a wire — it spends area, metal layers, signal-integrity margin, power-delivery space, thermal headroom, yield, and packaging capacity. These budgets are coupled: widening a bus for bandwidth costs thermal headroom and yield.'},
        'Advanced packaging exists because the old board-level story is too slow and too power hungry for modern accelerators. A large AI processor is not just a die surrounded by memory. It is a physical system that has to place compute, HBM, I/O, power delivery, cooling, test access, and mechanical support close enough to work, while still being manufacturable at scale.',
        'The package floorplan is now part of the architecture. It decides how many HBM stacks can sit near the logic die, how wide the routes can be, how much voltage drop the power network suffers, where heat can escape, and which suppliers can actually build the product. A software team may experience this as memory bandwidth, thermal throttling, accelerator availability, or cost per token, but the root constraint can be a physical routing and thermal map.',
        'That makes this a data-structure topic. The map has nodes, edges, capacities, keep-out zones, and coupled budgets. A route is not just a wire; it spends area, metal, signal-integrity margin, power-delivery space, thermal headroom, yield, and packaging capacity. The package is where the abstract system diagram becomes a set of physical constraints that cannot all be optimized independently.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to pick the densest available packaging technology and route everything as tightly as possible. If the accelerator needs HBM bandwidth, then a silicon interposer or another high-density option can look like the straightforward answer. More density seems to mean more bandwidth and less distance.',
        'That fails because routing density is only one budget. Dense signal routing competes with power delivery metal, decoupling, bumps, thermal paths, keep-out zones, and test structures. Moving HBM close to logic improves energy per bit, but it can also put heat-sensitive memory near the hottest die. A route that closes electrically can still fail because the product cannot be cooled or yields poorly.',
        'A second shortcut is to treat packaging as a late implementation detail. That is no longer safe. HBM placement, chiplet edge bandwidth, power-delivery impedance, and package substrate limits feed back into model serving, accelerator scale-up, and data-center deployment. The physical design can become visible all the way up at workload throughput.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is budget closure across coupled physical resources. The package is not optimized by one scalar score. It is a constrained optimizer where each placement and routing decision spends multiple budgets at once: signal route density, power delivery, thermal resistance, mechanical stability, yield, test access, and supply availability.',
        'Different packaging approaches move those budgets around. A silicon interposer can provide fine routing density and tight HBM integration, but it costs area and capacity. Organic substrates can be larger and cheaper, but routing pitch and signal integrity become harder. Embedded bridges can provide local dense connectivity without turning the entire package into a high-cost interposer, but bridge placement and escape routing become central constraints.',
        'A good mental model is a graph embedded in a heat map. The graph asks what must connect to what, at what bandwidth, voltage, and latency. The heat map asks where power is consumed and how heat leaves. The package succeeds only when both views close together.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A package design starts from workload needs: memory bandwidth, capacity, compute power, I/O bandwidth, sustained operating temperature, product cost, and supplier capacity. Those needs become a floorplan: logic die placement, HBM stack placement, I/O location, bridge or interposer choice, power-delivery network, decoupling strategy, and cooling path.',
        'The designer then checks coupled constraints. Can HBM routes be wide and short enough? Can I/O escape the package without crossing impossible congestion? Does the power network deliver current with acceptable IR drop and transient response? Does the thermal path keep logic and memory inside safe limits during sustained workloads? Does the mechanical stack avoid warpage and reliability failures?',
        'The answer is iterative. Moving one component to improve routing can worsen thermal coupling. Adding power metal can reduce room for signal routes. Spreading dies can improve cooling but increase wire length and latency. Advanced packaging is therefore closer to physical systems planning than to drawing neat boxes around chiplets.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The package-map view proves that the floorplan is a constraint graph. HBM wants short, wide links to compute. I/O needs escape routes. The power-delivery network must reach both logic and memory. Cooling has to remove heat from the same neighborhood where bandwidth wants proximity. No element is isolated.',
        'The package-choice table proves that interposer, organic substrate, bridge, and fanout are not a simple ranking. Each option wins a different budget. The right answer depends on the product target, not on a universal packaging hierarchy.',
        'The thermal-routing view proves why routing, PDN, and heat must be solved together. An electrically valid link can still be a product failure if it creates too much voltage drop, traps heat, lowers yield, or depends on packaging capacity that cannot be purchased in time.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'Advanced packaging works by shortening and widening the paths that matter most. Bringing memory closer to compute reduces energy per bit and exposes more bandwidth. Placing chiplets on an interposer or bridge can provide edge bandwidth that would be impossible through an ordinary board-level interface.',
        'It also works by letting one product combine dies that do not need to be manufactured as one giant monolith. Chiplets can separate compute, cache, I/O, and memory-adjacent functions into pieces that may have different process nodes, yields, and reuse patterns. Known-good die strategies can improve economics, but only if package assembly yield and test coverage cooperate.',
        'The gain is real because physical distance and wire density are architectural facts. A model-serving stack may talk about tokens per second, but the accelerator underneath is constrained by how many bytes and joules move through a tiny physical neighborhood.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'The costs are not only unit cost. Advanced packaging spends engineering time, supplier capacity, verification effort, thermal design margin, and manufacturing risk. It can increase product value by making high-bandwidth systems possible, but it can also become the scarce resource that limits shipments.',
        'Silicon interposers offer density but can be expensive and capacity constrained. Organic substrates can be attractive for size and cost but may struggle with the finest routing requirements. Bridges can target density where it is needed, but they add placement and validation complexity. Stacking can improve proximity while raising thermal and test difficulty.',
        'There is also a software tradeoff. A package that exposes more memory bandwidth may reward algorithms that stream aggressively, while a package limited by thermal or power behavior may need scheduling, batching, or placement policies that avoid sustained hot spots. Hardware packaging decisions can change which software optimizations matter.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'The clearest use is AI accelerators with HBM. Training and inference both need high memory bandwidth, and HBM placement controls whether the compute die can actually consume the advertised bandwidth. Power delivery controls sustained frequency. Thermal placement controls throttling during long runs.',
        'Advanced packaging also matters in high-performance computing, network processors, cache-stacked CPUs, and chiplet systems that need more bandwidth than package pins or board traces can provide. It is especially useful when the workload repeatedly moves large volumes of data between a few nearby functions.',
        'TSMC describes CoWoS as wafer-level system integration for ultra-high-performance computing, with a silicon interposer supporting logic chiplets and HBM cubes: https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm. TSMC 3DFabric for HPC describes 3D stacking and CoWoS technologies for high memory bandwidth and cloud/data-center requirements: https://www.tsmc.com/english/dedicatedFoundry/technology/platform_HPC_tech_WLSI.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The abstraction fails when packaging is treated as a final mechanical wrapper. It is now an architectural constraint that can decide memory bandwidth, accelerator availability, cost, and software-visible performance.',
        'Another failure is optimizing the headline interconnect while ignoring power and heat. A wide link that cannot run at target frequency under sustained workload is not a useful product feature. A floorplan that looks compact but thermally couples HBM to hot logic can lose the bandwidth it was built to deliver.',
        'A third failure is assuming a cheaper packaging alternative is automatically equivalent. Moving from silicon interposer to organic substrate or bridge-based routing can be sensible, but the alternative must still meet route density, signal integrity, energy per bit, thermal, reliability, and supply goals.',
        'AMD describes 3D V-Cache as a stacking technology that increases interconnect density compared with on-package 2D chiplets: https://www.amd.com/en/products/processors/technologies/3d-v-cache.html. The product class is different from HBM-heavy AI packages, but the shared lesson is physical proximity as an architectural choice, not decoration.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: TSMC CoWoS at https://3dfabric.tsmc.com/english/dedicatedFoundry/technology/cowos.htm, TSMC 3DFabric for HPC at https://www.tsmc.com/english/dedicatedFoundry/technology/platform_HPC_tech_WLSI, AMD 3D V-Cache at https://www.amd.com/en/products/processors/technologies/3d-v-cache.html, and IEEE IRDS Packaging Integration at https://irds.ieee.org/images/files/pdf/2020/2020IRDS_PI.pdf. Study Chiplet Interconnect Case Study, HBM Pseudo-Channel Scheduler, UCIe Flit/Credit/Retry, and Known-Good-Die Yield Ledger next.',
      ],
    },
  ],
};
