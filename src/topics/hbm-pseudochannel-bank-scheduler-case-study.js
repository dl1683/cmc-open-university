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
      heading: 'How to read the animation',
      paragraphs: [
        'Read every memory request as an address that must be mapped to physical resources before bytes can move. The visual path from stack to channel to pseudo-channel to bank to row is the path where parallelism is either created or destroyed.',
        'Active banks or pseudo-channels are schedulable now. A safe inference is that two requests can overlap only when the address map and timing rules put them on independent resources, or when they hit the same open row without forcing a row switch.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'High Bandwidth Memory, or HBM, exists because accelerators can consume data faster than ordinary off-package memory can feed them. Transformer inference, training, graph analytics, and simulations often wait on bytes before they wait on arithmetic.',
        'HBM is not one giant fast bucket. A request is routed through stacks, channels, pseudo-channels, bank groups, banks, rows, controller queues, refresh windows, and thermal limits.',
        {type:'callout', text:'HBM bandwidth is earned by scheduling independent resources well: address maps, queues, banks, rows, refresh, and thermals decide whether peak throughput appears.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/6/62/AMD%4028nm%40GCN_3th_gen%40Fiji%40Radeon_R9_Nano%40SPMRC_REA0356A-1539_215-0862120_DSC04466_%2829461603171%29.jpg', alt:'Radeon R9 Nano graphics card showing GPU package and HBM memory stacks.', caption:'AMD Radeon R9 Nano package with HBM memory. Fritzchens Fritz, Wikimedia Commons, CC0.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to read the bandwidth number on the datasheet and treat it as the speed the kernel will see. If the package advertises enormous bandwidth, then a memory-bound kernel appears to be solved by buying that package.',
        'Another reasonable first attempt is to optimize only for locality. Keeping a row open helps, so a scheduler might keep serving row hits from one stream before considering other queues.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is resource skew. A stride pattern, tensor layout, allocator, or hash function can send too much traffic to one pseudo-channel or bank while the rest of the stack has idle capacity.',
        'Pure locality also hits a wall because fairness and maintenance are real. A scheduler that serves row hits forever can starve other streams, delay writes, miss refresh timing, or push the stack into thermal throttling.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is independent-resource utilization under physical timing rules. HBM gives many lanes, but the controller must expose enough address diversity and issue work without violating row, bank, refresh, power, and temperature constraints.',
        'The scheduler is a priority queue with hardware rules attached. Each request carries address, operation type, age, row-hit status, bank conflict status, quality-of-service context, and sometimes stream ownership.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A memory request enters the controller as a read, write, DMA transfer, page fill, prefetch, or kernel-generated access. Address mapping assigns it to a stack, channel, pseudo-channel, bank, and row.',
        'If the target row is already open, the request can be a row hit and is cheaper to serve. If a different row is open in the same bank, the controller must close one row and activate another before the access can proceed.',
        'Pseudo-channels split scheduling resources so more independent work can be issued. They help only when the workload distributes requests across them rather than concentrating traffic on one hot path.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'HBM works when the controller has enough independent ready work to hide the waiting time of any one bank or row. While one bank is activating a row, another bank or pseudo-channel can serve a compatible request.',
        'Row locality works because an open row avoids repeated activation. Bank-level parallelism works because separate banks have separate timing state, so a stall in one bank does not always stall the stack.',
        'The correctness argument is a scheduling invariant: every issued command must respect DRAM timing and ownership rules, and every queued request must eventually either issue, be cancelled, or be throttled by a declared policy. Bandwidth is the result of satisfying that invariant while keeping many resources busy.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The cost is package complexity, power density, capacity limits, and scheduler sophistication. HBM gives high bandwidth near compute, but it is not as cheap, deep, or thermally forgiving as simpler memory paths.',
        'Behaviorally, doubling compute lanes does not double throughput when the address stream is skewed. If 80 percent of requests land on one pseudo-channel, then the bottleneck is the hot pseudo-channel, not the arithmetic units waiting downstream.',
        'Scheduler policy has visible cost. Favoring row hits improves local efficiency, draining writes reduces read/write turnaround penalties, and strict quality of service protects latency-sensitive streams, but each choice can reduce aggregate throughput under another workload.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HBM is central to GPUs and AI accelerators because weights, activations, attention blocks, and key-value cache all move large amounts of data. Training stresses activation movement and collectives, while inference often stresses repeated weight reads and growing cache state.',
        'It also fits high-performance computing, graphics, simulation, analytics, and bandwidth-heavy vector search. The shared pattern is high arithmetic capacity that becomes useless unless bytes arrive on time.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'HBM fails as a mental model when engineers treat it as a single scalar bandwidth number. Collisions inside banks, rows, pseudo-channels, refresh windows, and thermal envelopes can hold sustained throughput far below peak.',
        'It also fails when software layout fights the hardware map. A stride, shard boundary, page placement, or tensor layout can look parallel at the kernel level while concentrating requests inside the memory hierarchy.',
        'More compute is not a fix for a memory-bound path. If the kernel is waiting on bytes, additional arithmetic lanes sit idle unless layout, prefetching, caching, or scheduling changes the byte stream.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume an HBM stack has 16 pseudo-channels and a kernel issues 1,600 equal read bursts. If the address map spreads them evenly, each pseudo-channel receives 100 bursts and the controller can keep many lanes busy.',
        'Now assume a bad stride maps 1,200 of those bursts to four pseudo-channels and the remaining 400 to the other twelve. The hot pseudo-channels each carry 300 bursts, so completion time follows the hot group even though most pseudo-channels are underused.',
        'The correction is not abstract tuning. Changing tensor layout, page coloring, shard placement, or address hashing can move the same 1,600 bursts from a 300-burst hot lane to a 100-burst balanced lane, which changes observed bandwidth without changing the math kernel.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the JEDEC HBM specifications, vendor HBM3 and HBM3E product briefs from Micron and Samsung, and accelerator architecture papers that discuss memory bandwidth and controller behavior. Use those sources to separate advertised peak bandwidth from sustained workload bandwidth.',
        'Study Transformer Inference Roofline, KV Cache, FlashAttention, GPU Memory Pool Fragmentation Ledger, Tensor Parallelism, Chiplet Interconnect Case Study, and Cache-Friendly Blocking next. They all ask the same question: which resource is actually limiting progress.',
      ],
    },
  ],
};
