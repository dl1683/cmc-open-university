// HBM pseudo-channel and bank scheduling: a stack is not one pipe, it is a
// hierarchy of channels, pseudo-channels, bank groups, rows, refresh, and QoS.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'hbm-pseudochannel-bank-scheduler-case-study',
  title: 'HBM Pseudo-Channel & Bank Scheduler Case Study',
  category: 'Systems',
  summary: 'A memory-controller primer for HBM: map requests across stacks, channels, pseudo-channels, bank groups, row buffers, refresh windows, and QoS queues.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['stack hierarchy', 'bank scheduler'], defaultValue: 'stack hierarchy' },
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

function stackGraph(title) {
  return graphState({
    nodes: [
      { id: 'gpu', label: 'XPU', x: 0.8, y: 3.5, note: 'compute' },
      { id: 'ctl', label: 'ctrl', x: 2.2, y: 3.5, note: 'MC' },
      { id: 's0', label: 'S0', x: 3.9, y: 1.5, note: 'HBM' },
      { id: 's1', label: 'S1', x: 3.9, y: 5.5, note: 'HBM' },
      { id: 'c0', label: 'ch0', x: 5.5, y: 0.9, note: 'chan' },
      { id: 'c1', label: 'ch1', x: 5.5, y: 2.1, note: 'chan' },
      { id: 'c2', label: 'ch2', x: 5.5, y: 4.9, note: 'chan' },
      { id: 'c3', label: 'ch3', x: 5.5, y: 6.1, note: 'chan' },
      { id: 'p0', label: 'pc0', x: 7.0, y: 1.5, note: 'sub' },
      { id: 'p1', label: 'pc1', x: 7.0, y: 5.5, note: 'sub' },
      { id: 'bank', label: 'banks', x: 8.6, y: 3.5, note: 'rows' },
    ],
    edges: [
      { id: 'e-gpu-ctl', from: 'gpu', to: 'ctl', weight: 'req' },
      { id: 'e-ctl-s0', from: 'ctl', to: 's0', weight: 'route' },
      { id: 'e-ctl-s1', from: 'ctl', to: 's1', weight: 'route' },
      { id: 'e-s0-c0', from: 's0', to: 'c0' },
      { id: 'e-s0-c1', from: 's0', to: 'c1' },
      { id: 'e-s1-c2', from: 's1', to: 'c2' },
      { id: 'e-s1-c3', from: 's1', to: 'c3' },
      { id: 'e-c0-p0', from: 'c0', to: 'p0' },
      { id: 'e-c3-p1', from: 'c3', to: 'p1' },
      { id: 'e-p0-bank', from: 'p0', to: 'bank', weight: 'open' },
      { id: 'e-p1-bank', from: 'p1', to: 'bank', weight: 'open' },
    ],
  }, { title });
}

function schedulerGraph(title, { conflict = false } = {}) {
  return graphState({
    nodes: [
      { id: 'q0', label: 'Q0', x: 0.8, y: 1.4, note: 'read' },
      { id: 'q1', label: 'Q1', x: 0.8, y: 3.5, note: 'write' },
      { id: 'q2', label: 'Q2', x: 0.8, y: 5.6, note: 'DMA' },
      { id: 'hash', label: 'map', x: 2.5, y: 3.5, note: 'addr' },
      { id: 'arb', label: 'arb', x: 4.1, y: 3.5, note: conflict ? 'stall' : 'issue' },
      { id: 'row', label: 'row', x: 5.8, y: 2.1, note: conflict ? 'miss' : 'hit' },
      { id: 'bank', label: 'bank', x: 5.8, y: 4.9, note: 'busy' },
      { id: 'ref', label: 'ref', x: 7.4, y: 1.7, note: 'refresh' },
      { id: 'bus', label: 'bus', x: 7.4, y: 3.5, note: 'burst' },
      { id: 'qos', label: 'QoS', x: 7.4, y: 5.3, note: 'fair' },
      { id: 'done', label: 'done', x: 9.0, y: 3.5, note: 'data' },
    ],
    edges: [
      { id: 'e-q0-hash', from: 'q0', to: 'hash' },
      { id: 'e-q1-hash', from: 'q1', to: 'hash' },
      { id: 'e-q2-hash', from: 'q2', to: 'hash' },
      { id: 'e-hash-arb', from: 'hash', to: 'arb', weight: 'pc/bank' },
      { id: 'e-arb-row', from: 'arb', to: 'row', weight: conflict ? 'miss' : 'hit' },
      { id: 'e-arb-bank', from: 'arb', to: 'bank', weight: 'lock' },
      { id: 'e-ref-arb', from: 'ref', to: 'arb', weight: 'block' },
      { id: 'e-qos-arb', from: 'qos', to: 'arb', weight: 'prio' },
      { id: 'e-row-bus', from: 'row', to: 'bus', weight: 'burst' },
      { id: 'e-bank-bus', from: 'bank', to: 'bus' },
      { id: 'e-bus-done', from: 'bus', to: 'done', weight: 'ret' },
    ],
  }, { title });
}

function* stackHierarchy() {
  yield {
    state: stackGraph('HBM is a hierarchy, not one giant pipe'),
    highlight: { active: ['gpu', 'ctl', 's0', 's1', 'e-gpu-ctl', 'e-ctl-s0', 'e-ctl-s1'], compare: ['bank'] },
    explanation: 'An accelerator sees HBM bandwidth, but the controller sees a hierarchy: stacks, channels, pseudo-channels, banks, rows, refresh windows, and data buses.',
  };

  yield {
    state: labelMatrix(
      'HBM address map',
      [
        { id: 'stack', label: 'stack' },
        { id: 'chan', label: 'chan' },
        { id: 'pc', label: 'pc' },
        { id: 'bank', label: 'bank' },
        { id: 'row', label: 'row' },
      ],
      [
        { id: 'select', label: 'select' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['top bits', 'hot stack'],
        ['hash', 'skew'],
        ['split', 'alias'],
        ['low bits', 'busy'],
        ['tag', 'miss'],
      ],
    ),
    highlight: { active: ['stack:select', 'chan:select', 'pc:select'], found: ['bank:risk', 'row:risk'] },
    explanation: 'The address map is a data structure. It decides whether adjacent tensor blocks spread across channels or collide on one pseudo-channel and bank group.',
    invariant: 'Bandwidth appears only when requests are distributed across independent resources.',
  };

  yield {
    state: stackGraph('Pseudo-channels expose more scheduling slots'),
    highlight: { active: ['c0', 'c3', 'p0', 'p1', 'e-c0-p0', 'e-c3-p1'], found: ['bank'], compare: ['ctl'] },
    explanation: 'Pseudo-channels split channel resources so the controller has more independent places to schedule work. That helps only when the request stream gives the scheduler enough parallelism.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'streams', min: 0, max: 64 }, y: { label: 'GB/s', min: 0, max: 1400 } },
      series: [
        { id: 'spread', label: 'spread', points: [{ x: 4, y: 180 }, { x: 16, y: 610 }, { x: 32, y: 1050 }, { x: 64, y: 1240 }] },
        { id: 'skew', label: 'skew', points: [{ x: 4, y: 170 }, { x: 16, y: 360 }, { x: 32, y: 470 }, { x: 64, y: 510 }] },
        { id: 'row', label: 'row hit', points: [{ x: 4, y: 220 }, { x: 16, y: 650 }, { x: 32, y: 1110 }, { x: 64, y: 1300 }] },
      ],
      markers: [
        { id: 'wall', x: 32, y: 470, label: 'hot pc' },
      ],
    }),
    highlight: { active: ['spread', 'row'], compare: ['skew', 'wall'] },
    explanation: 'The simplified curve shows the scheduler story. More streams help when they spread. If address hashing sends them to the same pseudo-channel or bank, the advertised stack bandwidth stays theoretical.',
  };
}

function* bankScheduler() {
  yield {
    state: schedulerGraph('Requests enter per-class queues'),
    highlight: { active: ['q0', 'q1', 'q2', 'hash', 'e-q0-hash', 'e-q1-hash', 'e-q2-hash'], compare: ['arb'] },
    explanation: 'The memory controller starts with queues: reads, writes, DMA, prefetches, page fills, and kernel-generated streams. Each request must be mapped to stack, channel, pseudo-channel, bank, and row.',
  };

  yield {
    state: schedulerGraph('Row hits and bank conflicts change issue order'),
    highlight: { active: ['arb', 'row', 'bank', 'e-arb-row', 'e-arb-bank'], found: ['bus'], compare: ['qos'] },
    explanation: 'A scheduler may prefer row hits because the bank already has the needed row open. But fairness and QoS can override pure locality when one stream would otherwise starve the others.',
    invariant: 'A memory scheduler is a priority queue under physical constraints.',
  };

  yield {
    state: schedulerGraph('Refresh and thermal limits steal slots', { conflict: true }),
    highlight: { active: ['ref', 'arb', 'bank', 'e-ref-arb', 'e-arb-bank'], compare: ['row', 'bus'] },
    explanation: 'DRAM cells need refresh, and HBM stacks operate inside thermal and power envelopes. Those maintenance windows reduce available issue slots even when the compute kernel is ready to consume data.',
  };

  yield {
    state: labelMatrix(
      'Scheduler ledger',
      [
        { id: 'hit', label: 'hit' },
        { id: 'turn', label: 'turn' },
        { id: 'ref', label: 'ref' },
        { id: 'fair', label: 'fair' },
        { id: 'temp', label: 'temp' },
      ],
      [
        { id: 'measure', label: 'measure' },
        { id: 'action', label: 'action' },
      ],
      [
        ['row%', 'keep row'],
        ['R/W', 'batch'],
        ['due', 'reserve'],
        ['age', 'boost'],
        ['C', 'limit'],
      ],
    ),
    highlight: { active: ['hit:measure', 'turn:measure', 'fair:action'], found: ['ref:action', 'temp:action'] },
    explanation: 'The visible ledger should track row-hit rate, read/write turns, refresh debt, fairness age, and thermal throttling. Without that ledger, HBM stalls look like generic GPU underutilization.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'stack hierarchy') yield* stackHierarchy();
  else if (view === 'bank scheduler') yield* bankScheduler();
  else throw new InputError('Pick an HBM scheduler view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'HBM exists because accelerators need far more memory bandwidth than ordinary off-package DRAM paths can provide. Transformer training, inference decode, graph analytics, stencil kernels, and vector databases can all become memory-bandwidth problems before they become arithmetic problems.',
        'The mistake is to imagine HBM as one giant fast bucket. A request is not sent to HBM in the abstract. It is mapped through a hierarchy: stack, channel, pseudo-channel, bank group, bank, row, and controller queue. Peak bandwidth appears only when requests spread across those independently schedulable resources.',
        'That makes this a data-structure topic, not just a hardware topic. The controller is maintaining queues, address maps, row state, refresh debt, fairness counters, and thermal limits. If those structures line up with the workload, the accelerator sees bandwidth. If they do not, advertised bandwidth stays theoretical.',
        {type:'callout', text:'HBM bandwidth is earned by scheduling independent resources well: address maps, queues, banks, rows, refresh, and thermals decide whether peak throughput appears.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/62/AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg', alt:'Radeon R9 Nano graphics card showing GPU package and HBM memory stacks.', caption:'AMD Radeon R9 Nano package with HBM memory. Fritzchens Fritz, Wikimedia Commons, CC0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to treat the memory datasheet as the performance model. If the package advertises huge bandwidth, the kernel should be fed. When the kernel stalls, the blame moves to compute, compiler, or model architecture.',
        'That fails because advertised bandwidth is a best-case aggregate. Bad address mapping can pin traffic to one pseudo-channel or bank group. Row misses, refresh, read/write turns, fairness, and thermal limits can all remove issue slots while compute is ready to consume data.',
        'Another shortcut is to optimize only for locality. Row hits are valuable, but a scheduler that serves one row-local stream forever can starve other queues. HBM performance is a balance between locality, spread, fairness, maintenance, and thermals.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The core insight is independent-resource utilization under timing rules. Pseudo-channels increase the number of places the controller can schedule work, but only if the address map and request stream expose enough parallelism.',
        'The controller first maps each request to stack, channel, pseudo-channel, bank, and row. Then the scheduler chooses whether to issue a row hit, precharge and activate another row, drain writes, reserve refresh, or throttle for temperature and power.',
        'A good HBM mental model is a priority queue under physical constraints. Every request has an address, type, age, row-hit status, bank conflict status, and quality-of-service context. The scheduler is constantly deciding which request can be issued now without violating DRAM timing or starving another class of work.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'An HBM request enters a memory-controller queue as a read, write, DMA transfer, prefetch, page fill, or kernel-generated stream. Address mapping assigns it to a stack, channel, pseudo-channel, bank, and row. That mapping decides whether many requests can proceed in parallel or collide on one hot resource.',
        'If the target row is already open in a bank, the request may be a row hit and can be cheap to serve. If another row is open, the controller may need precharge and activate operations before it can access the new row. Those timing rules make issue order matter.',
        'Pseudo-channels expose more scheduling slots by splitting channel resources. They help only when the request stream is diverse enough. A tensor layout, stride pattern, or hash function that concentrates traffic can underuse the stack even when many streams exist.',
        'Refresh and thermal management steal slots because DRAM cells need maintenance and HBM stacks operate inside power and temperature envelopes. These are not failures; they are part of the real schedule.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The stack-hierarchy view proves that HBM is a hierarchy, not one scalar bandwidth number. The path from request to stack, channel, pseudo-channel, bank, and row is the path where parallelism is either created or destroyed.',
        'The bandwidth plot proves the difference between spread and skew. More streams help when they distribute across independent resources. If address mapping sends them to the same pseudo-channel or bank, the curve flattens far below peak.',
        'The scheduler ledger proves what operators should measure: row-hit rate, read/write turns, refresh debt, fairness age, temperature, and throttling. Without that evidence, HBM stalls look like generic GPU underutilization.',
        'The row-hit frame also proves why order matters. Two requests to the same open row can be cheap together, while two requests to different rows in the same bank may force expensive turnarounds. The scheduler is trying to preserve locality without letting one stream monopolize the device.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'HBM works by putting many DRAM resources close to the accelerator and exposing enough independent lanes that the controller can keep several operations in flight. The wide interface matters, but the scheduler has to feed it with compatible requests.',
        'Row-buffer locality works because keeping a row open avoids some activation cost. Bank-level parallelism works because independent banks can make progress while another bank waits. Pseudo-channeling works because it gives the controller more granular scheduling resources.',
        'The speedup appears when software and hardware cooperate. Tensor layout, tiling, batching, prefetching, cache policy, and address mapping decide whether the memory stream is spread, row-friendly, and fair enough for the controller to exploit.',
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        'HBM is expensive in package complexity, capacity, power, and supply. It gives enormous bandwidth close to compute, but it is not as cheap or deep as external memory. That is why model serving still worries about KV-cache pressure, quantization, paging, and offload.',
        'Scheduler policy is also a tradeoff. Favoring row hits improves locality but can hurt fairness. Draining writes can improve bus turnaround behavior but delay reads. Strict QoS can protect latency-sensitive streams while reducing aggregate throughput.',
        'Thermal and power limits matter because HBM sits physically close to compute. A memory-bound kernel can become part of the thermal budget, and throttling can reduce throughput even when the code and address map look good.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'HBM is central to AI accelerators because transformer weights, activations, attention blocks, and KV cache all create high bandwidth demand. Training stresses activation movement and collectives. Inference stresses repeated weight reads and KV-cache growth.',
        'It also wins in HPC, graphics, simulation, analytics, and workloads where each byte must reach compute quickly and repeatedly. The common pattern is high arithmetic capacity waiting on data movement.',
        'Micron describes HBM3E as using a 1024 I/O pin interface and states that HBM3E offers 16 independent channels and 32 pseudo channels: https://www.micron.com/products/memory/hbm/hbm3e. Samsung describes HBM3E as a high-bandwidth memory product for data-center and AI workloads: https://semiconductor.samsung.com/dram/hbm/hbm3e/.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The abstraction fails when HBM is treated as one pool of bandwidth. Collisions inside the hierarchy reduce sustained throughput, and row-buffer behavior still matters even though the memory is close to compute.',
        'Another failure is ignoring layout. Strides, tensor sharding, page placement, and allocator behavior can create hot pseudo-channels or banks. The compute kernel may look parallel while the address stream is not.',
        'A third failure is adding compute for a memory-bound path. If a model is waiting on memory, more arithmetic lanes do not help unless the address map, scheduler, and cache policy deliver bytes fast enough.',
        'A fourth failure is hiding memory-controller evidence from performance tools. If profilers only show low GPU utilization, engineers may optimize kernels while the real issue is pseudo-channel skew, refresh windows, or thermal throttling.',
        'The practical debugging move is to change one axis at a time. Vary tensor layout, stride, batch shape, and placement while watching sustained bandwidth and stall counters. If performance moves sharply when addresses are remapped but not when arithmetic changes, the bottleneck is inside the memory hierarchy.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Sources: Micron HBM3E at https://www.micron.com/products/memory/hbm/hbm3e, Samsung HBM3E at https://semiconductor.samsung.com/dram/hbm/hbm3e/, and Synopsys HBM3 overview at https://www.synopsys.com/glossary/what-is-high-bandwitdth-memory-3.html. Study Chiplet Interconnect Case Study, Transformer Inference Roofline, KV Cache, FlashAttention, GPU Memory Pool Fragmentation Ledger, KV Cache Quantization & Compression, and Tensor Parallelism next.',
      ],
    },
  ],
};
