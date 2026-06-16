// CXL memory pooling: Type-3 devices, CXL.mem load/store access, switch
// topologies, fabric managers, hot-plug allocation, and tier-aware placement.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'cxl-memory-pooling-type3-fabric-case-study',
  title: 'CXL Memory Pooling & Type-3 Fabric Case Study',
  category: 'Systems',
  summary: 'A CXL memory-fabric primer: CXL.io, CXL.cache, CXL.mem, Type-3 memory devices, switch fanout, fabric managers, pooling, and tier-aware placement.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['type3 pool', 'fabric manager'], defaultValue: 'type3 pool' },
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

function poolGraph(title) {
  return graphState({
    nodes: [
      { id: 'h0', label: 'H0', x: 0.9, y: 2.0, note: 'CPU' },
      { id: 'h1', label: 'H1', x: 0.9, y: 5.0, note: 'CPU' },
      { id: 'rp0', label: 'RP0', x: 2.4, y: 2.0, note: 'root' },
      { id: 'rp1', label: 'RP1', x: 2.4, y: 5.0, note: 'root' },
      { id: 'sw', label: 'SW', x: 4.4, y: 3.5, note: 'CXL' },
      { id: 'm0', label: 'M0', x: 6.4, y: 1.5, note: 'Type3' },
      { id: 'm1', label: 'M1', x: 6.4, y: 3.5, note: 'Type3' },
      { id: 'm2', label: 'M2', x: 6.4, y: 5.5, note: 'Type3' },
      { id: 'fm', label: 'FM', x: 8.5, y: 3.5, note: 'mgr' },
    ],
    edges: [
      { id: 'e-h0-rp0', from: 'h0', to: 'rp0', weight: '' },
      { id: 'e-h1-rp1', from: 'h1', to: 'rp1', weight: '' },
      { id: 'e-rp0-sw', from: 'rp0', to: 'sw', weight: 'CXL' },
      { id: 'e-rp1-sw', from: 'rp1', to: 'sw', weight: 'CXL' },
      { id: 'e-sw-m0', from: 'sw', to: 'm0', weight: 'mem' },
      { id: 'e-sw-m1', from: 'sw', to: 'm1', weight: 'mem' },
      { id: 'e-sw-m2', from: 'sw', to: 'm2', weight: 'mem' },
      { id: 'e-fm-sw', from: 'fm', to: 'sw', weight: 'ctl' },
      { id: 'e-fm-m0', from: 'fm', to: 'm0', weight: 'part' },
      { id: 'e-fm-m1', from: 'fm', to: 'm1', weight: 'part' },
      { id: 'e-fm-m2', from: 'fm', to: 'm2', weight: 'part' },
    ],
  }, { title });
}

function managerGraph(title) {
  return graphState({
    nodes: [
      { id: 'need', label: 'need', x: 0.8, y: 3.5, note: 'app' },
      { id: 'os', label: 'OS', x: 2.1, y: 3.5, note: 'NUMA' },
      { id: 'fm', label: 'FM', x: 3.7, y: 3.5, note: 'policy' },
      { id: 'pool', label: 'pool', x: 5.2, y: 3.5, note: 'free' },
      { id: 'hot', label: 'hot', x: 6.8, y: 1.8, note: 'DRAM' },
      { id: 'warm', label: 'warm', x: 6.8, y: 3.5, note: 'CXL' },
      { id: 'cold', label: 'cold', x: 6.8, y: 5.2, note: 'SSD' },
      { id: 'ras', label: 'RAS', x: 8.5, y: 3.5, note: 'health' },
    ],
    edges: [
      { id: 'e-need-os', from: 'need', to: 'os', weight: '' },
      { id: 'e-os-fm', from: 'os', to: 'fm', weight: 'ask' },
      { id: 'e-fm-pool', from: 'fm', to: 'pool', weight: 'alloc' },
      { id: 'e-pool-hot', from: 'pool', to: 'hot', weight: '' },
      { id: 'e-pool-warm', from: 'pool', to: 'warm', weight: '' },
      { id: 'e-pool-cold', from: 'pool', to: 'cold', weight: '' },
      { id: 'e-warm-ras', from: 'warm', to: 'ras', weight: 'tele' },
      { id: 'e-ras-fm', from: 'ras', to: 'fm', weight: 'gate' },
    ],
  }, { title });
}

function* type3Pool() {
  yield {
    state: labelMatrix(
      'CXL protocol roles',
      [
        { id: 'io', label: 'IO' },
        { id: 'cache', label: 'cache' },
        { id: 'mem', label: 'mem' },
        { id: 'type3', label: 'T3' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'use', label: 'use' },
      ],
      [
        ['disc', 'PCIe'],
        ['host', 'coh'],
        ['load', 'dev'],
        ['mem', 'pool'],
      ],
    ),
    highlight: { active: ['io:job', 'mem:job', 'type3:use'], compare: ['cache:job'] },
    explanation: 'CXL is three protocols over a PCIe physical base: CXL.io for discovery and device control, CXL.cache for coherent host-memory caching, and CXL.mem for load/store access to device-attached memory.',
  };

  yield {
    state: poolGraph('Type-3 devices expose memory to hosts'),
    highlight: { active: ['h0', 'rp0', 'sw', 'm0', 'm1', 'e-rp0-sw', 'e-sw-m0', 'e-sw-m1'], found: ['fm'], compare: ['h1'] },
    explanation: 'A Type-3 CXL device is a memory expander. The host can use CXL.mem transactions to read and write device-backed memory, making capacity appear closer than ordinary network storage.',
    invariant: 'Pooling is allocation of memory capacity, not a promise that all memory has identical latency.',
  };

  yield {
    state: poolGraph('A switch turns memory expansion into a pool'),
    highlight: { active: ['h0', 'h1', 'sw', 'm0', 'm1', 'm2', 'e-rp0-sw', 'e-rp1-sw', 'e-sw-m2'], found: ['fm'] },
    explanation: 'CXL switching lets multiple hosts and devices form a managed hierarchy. The fabric manager can partition memory devices so capacity is assigned where it is needed.',
  };

  yield {
    state: labelMatrix(
      'Memory tiers',
      [
        { id: 'dram', label: 'DRAM' },
        { id: 'cxl', label: 'CXL' },
        { id: 'ssd', label: 'SSD' },
        { id: 'net', label: 'net' },
      ],
      [
        { id: 'lat', label: 'lat' },
        { id: 'cap', label: 'cap' },
        { id: 'fit', label: 'fit' },
      ],
      [
        ['best', 'low', 'hot'],
        ['med', 'high', 'warm'],
        ['high', 'huge', 'cold'],
        ['var', 'pool', 'remote'],
      ],
    ),
    highlight: { active: ['dram:fit', 'cxl:fit', 'ssd:fit'], found: ['cxl:cap'], compare: ['cxl:lat'] },
    explanation: 'The useful mental model is tiered memory. CXL can add byte-addressable capacity with load/store semantics, but placement still matters because latency and bandwidth differ from local DRAM.',
  };
}

function* fabricManager() {
  yield {
    state: managerGraph('Fabric manager owns pool policy'),
    highlight: { active: ['need', 'os', 'fm', 'pool', 'e-need-os', 'e-os-fm', 'e-fm-pool'], compare: ['ras'] },
    explanation: 'A CXL memory pool needs a control plane. The OS sees a memory tier, the fabric manager assigns capacity, and policy decides which host receives which logical slice.',
  };

  yield {
    state: labelMatrix(
      'Pool allocation ledger',
      [
        { id: 'host', label: 'host' },
        { id: 'slice', label: 'slice' },
        { id: 'qos', label: 'QoS' },
        { id: 'numa', label: 'NUMA' },
        { id: 'ras', label: 'RAS' },
        { id: 'move', label: 'move' },
      ],
      [
        { id: 'track', label: 'track' },
        { id: 'why', label: 'why' },
      ],
      [
        ['id', 'owner'],
        ['base', 'range'],
        ['bw', 'fair'],
        ['dist', 'place'],
        ['err', 'safe'],
        ['hot', 'resize'],
      ],
    ),
    highlight: { active: ['host:track', 'slice:track', 'numa:track'], found: ['ras:why', 'move:why'] },
    explanation: 'The fabric manager needs a ledger: which host owns which memory slice, what QoS applies, where it sits in the NUMA hierarchy, whether it is healthy, and whether it can be resized or moved.',
    invariant: 'Disaggregated memory still needs local ownership records.',
  };

  yield {
    state: managerGraph('Tier-aware placement keeps hot pages local'),
    highlight: { active: ['hot', 'warm', 'cold', 'e-pool-hot', 'e-pool-warm', 'e-pool-cold'], found: ['os'], compare: ['ras'] },
    explanation: 'The operating system and runtime should place hot latency-sensitive pages in local DRAM, warmer capacity-heavy state in CXL memory, and colder data in SSD or object storage.',
  };

  yield {
    state: plotState({
      axes: { x: { label: 'GB', min: 0, max: 1024 }, y: { label: 'score', min: 0, max: 100 } },
      series: [
        { id: 'dram', label: 'DRAM', points: [{ x: 64, y: 95 }, { x: 128, y: 90 }, { x: 256, y: 72 }] },
        { id: 'cxl', label: 'CXL', points: [{ x: 128, y: 78 }, { x: 512, y: 72 }, { x: 1024, y: 64 }] },
        { id: 'ssd', label: 'SSD', points: [{ x: 256, y: 48 }, { x: 512, y: 44 }, { x: 1024, y: 40 }] },
      ],
      markers: [
        { id: 'knee', x: 512, y: 72, label: 'knee' },
      ],
    }),
    highlight: { active: ['cxl', 'knee'], compare: ['dram', 'ssd'] },
    explanation: 'The simplified capacity curve shows why CXL exists: local DRAM is fastest but scarce, SSD is huge but slow, and CXL can occupy the warm tier when applications need memory capacity without becoming storage workloads.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'type3 pool') yield* type3Pool();
  else if (view === 'fabric manager') yield* fabricManager();
  else throw new InputError('Pick a CXL memory-pooling view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'Compute Express Link, or CXL, is an open interconnect standard for processors, accelerators, memory buffers, and smart I/O devices. The memory-pooling story matters for data structures because CXL turns memory capacity into a fabric-managed resource with explicit ownership, placement, and health metadata.',
        'The CXL Consortium describes CXL as an open standard interconnect offering coherency and memory semantics using high-bandwidth, low-latency connectivity between host processors and devices such as accelerators, memory buffers, and smart I/O devices: https://computeexpresslink.org/webinars/introducing-the-compute-express-link-2-0-specification-341/.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'CXL has three protocol roles. CXL.io handles PCIe-like discovery, register access, interrupts, initialization, virtualization, and DMA. CXL.cache supports device caching of host memory with coherency management. CXL.mem supports load/store access to device-attached memory. A Type-3 device is the memory-expansion case: the host accesses memory behind the device, often through a CXL switch and fabric manager.',
        'The CXL 2.0 announcement highlights switching for fanout, memory pooling for better utilization and capacity on demand, and persistent memory support. The CXL memory-pooling material says CXL 2.0 defines a Fabric Manager API for configuration and control of pooling applications: https://computeexpresslink.org/wp-content/uploads/2023/12/CXL-2.0-Memory-Pooling.pdf.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The attraction is capacity utilization. Instead of stranding DRAM behind one host, a pool can assign memory slices where demand appears. This can help databases, analytics engines, virtualization hosts, and AI infrastructure that needs large memory footprints. The cost is that memory stops being uniform. Local DRAM, CXL memory, SSD, and remote storage have different latency, bandwidth, failure, and operational profiles.',
        'The control plane is not optional. A fabric manager must know host ownership, slice boundaries, switch paths, quality of service, hot-plug state, health, and error handling. The OS and runtime must then make tier-aware decisions so hot pages do not drift into a slower tier by accident.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CXL memory pooling is relevant to in-memory databases, cache-heavy services, analytics engines, virtual machines, memory expansion, and AI systems that need CPU-side capacity near accelerators. It also connects to KV Cache Tiered Offload Store and Weka Filesystem Case Study because all three ask where state should live when local HBM or DRAM is too expensive to hold everything.',
        'For AI infrastructure, CXL is not a replacement for HBM. HBM is still the hot compute-adjacent tier. CXL memory is more naturally a warm capacity tier: model-serving metadata, CPU-side KV spill, feature caches, vector indexes, replay buffers, and data-engine state can benefit when the access pattern fits.',
      ],
    },
    {
      heading: 'Pitfalls and misconceptions',
      paragraphs: [
        'The biggest misconception is that pooled memory is just more local memory. It is not. The load/store interface is convenient, but latency, bandwidth, switch contention, NUMA distance, and device health all matter. A memory-hungry workload can improve by getting more capacity, while a latency-sensitive hot loop can regress if hot pages move to the wrong tier.',
        'Another trap is ignoring ownership. Pooling and sharing are different ideas. A fabric can allocate distinct slices to hosts, but shared coherent memory has harder consistency and security questions. The module focuses on Type-3 pooling because that is the easiest place to see the allocation data structure.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: CXL 2.0 overview at https://computeexpresslink.org/webinars/introducing-the-compute-express-link-2-0-specification-341/, CXL memory pooling material at https://computeexpresslink.org/wp-content/uploads/2023/12/CXL-2.0-Memory-Pooling.pdf, and CXL Consortium homepage for current specification context at https://computeexpresslink.org/. Study Linux Page Cache XArray, Buddy Allocator Free Lists, GPU Memory Pool Fragmentation Ledger, KV Cache Tiered Offload Store, GPUDirect RDMA Peer Memory Case Study, and Heterogeneous AI Compute Workload Router next.',
      ],
    },
  ],
};
