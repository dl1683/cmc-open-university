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
      heading: 'What it is',
      paragraphs: [
        'High Bandwidth Memory is not just a larger DRAM attached to a GPU. It is a stacked memory system placed very close to compute, with a wide interface and many independently schedulable resources. The data-structure lesson is hierarchy: stack, channel, pseudo-channel, bank group, bank, row, and queue.',
        'Micron describes HBM3E as using a 1024 I/O pin interface and states that HBM3E offers 16 independent channels and 32 pseudo channels: https://www.micron.com/products/memory/hbm/hbm3e. Samsung describes HBM3E as a high-bandwidth memory product for data-center and AI workloads: https://semiconductor.samsung.com/dram/hbm/hbm3e/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The controller maps each memory request to a stack, channel, pseudo-channel, bank, and row. Good mappings spread sequential and tensor-block traffic across independent resources. Bad mappings alias too much traffic onto one pseudo-channel or bank group. Once mapped, the scheduler decides whether to issue a row hit, close and open another row, batch reads or writes, reserve refresh slots, or throttle under thermal pressure.',
        'Pseudo-channels are important because they expose more independent scheduling surfaces inside the stack. They do not automatically solve locality. A kernel that repeatedly hits one address range can still create a hot pseudo-channel. This is why the address hash and the request queue must be understood together.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'HBM buys enormous bandwidth by moving memory close to compute and widening the interface. That creates package routing, power, thermal, and capacity constraints. The memory controller has to squeeze useful bandwidth from the hierarchy while respecting refresh, row timing, write-drain policy, QoS, and thermal limits.',
        'The cost shows up in AI serving as memory-bound decode, KV-cache pressure, and HBM fragmentation. If a model is waiting on memory, adding more compute lanes does not help unless the memory scheduler, address map, and cache policy deliver bytes fast enough.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'HBM is central to AI accelerators because transformer weights, activations, attention blocks, and KV cache all create high bandwidth demand. Training stresses all-reduce and activation movement. Inference stresses repeated weight reads and KV-cache growth. Long-context serving makes HBM capacity and bandwidth a product constraint, not just a hardware specification.',
        'This module connects Chiplet Interconnect Case Study to Transformer Inference Roofline. The chiplet package explains why the memory is physically near compute. The roofline explains why decode can remain memory-bound. The scheduler explains why advertised HBM bandwidth is not the same as sustained workload bandwidth.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The first misconception is that HBM bandwidth is one scalar. A stack is a collection of resources, and collisions inside that hierarchy reduce sustained throughput. The second misconception is that row-buffer policy is an old DRAM detail that no longer matters. Row hits, bank conflicts, refresh, and write turns still influence whether a GPU kernel sees smooth bandwidth or bursty stalls.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Sources: Micron HBM3E at https://www.micron.com/products/memory/hbm/hbm3e, Samsung HBM3E at https://semiconductor.samsung.com/dram/hbm/hbm3e/, and Synopsys HBM3 overview at https://www.synopsys.com/glossary/what-is-high-bandwitdth-memory-3.html. Study Chiplet Interconnect Case Study, Transformer Inference Roofline, KV Cache, FlashAttention, and GPU Memory Pool Fragmentation Ledger next.',
      ],
    },
  ],
};
