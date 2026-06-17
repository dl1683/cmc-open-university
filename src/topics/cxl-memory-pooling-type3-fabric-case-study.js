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
      heading: 'Why this exists',
      paragraphs: [
        `CXL memory pooling exists because memory capacity is usually bought in the wrong shape. A server can run out of DRAM while the next rack has idle memory trapped behind another CPU socket. A fleet owner can buy enough local DRAM for every peak, but then most of that memory sits dark when the workload mix changes.`,
        `The useful promise is not magic remote RAM. The promise is a managed warm tier: byte-addressable memory that can be assigned, resized, and monitored through a fabric instead of being soldered permanently to one host. That turns memory from a fixed per-server bill into a capacity pool with ownership, placement, health, and policy metadata.`,
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        `The first answer is to keep adding local DRAM to every server. That is simple, predictable, and fast. It works while the application footprint is stable and the expensive memory is used most of the time.`,
        `The wall appears in mixed fleets. One service needs a large heap during a burst, another needs a big in-memory index only at load time, and a third needs warm CPU-side state near accelerators but not on the accelerator itself. Local DRAM cannot move across hosts, so utilization falls even when total installed memory looks generous.`,
        `A second shortcut is to treat all extra capacity as storage. SSDs and network stores are excellent for cold data, but many workloads want load/store access, page granularity, and memory semantics. Rewriting every warm-state access as an object-store or block-device access changes the application, the latency profile, and the failure model.`,
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        `The core insight is to separate memory capacity from permanent host attachment while keeping enough hardware semantics that software can still use ordinary memory paths. CXL rides a PCIe physical base but defines protocol roles for device control, coherent caching, and memory access. The memory-pooling story is mainly about CXL.mem and Type-3 devices.`,
        `A Type-3 device exposes memory rather than compute. A host can receive a slice of that memory, map it as a tier, and access it with load/store transactions. The invariant is explicit ownership: a slice belongs to a host or partition under fabric-manager control. Pooling is allocation of capacity, not a claim that every byte has local-DRAM latency.`,
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The protocol stack has different jobs. CXL.io covers discovery, configuration, register access, interrupts, and PCIe-like management. CXL.cache lets a device cache host memory coherently. CXL.mem lets a host read and write device-attached memory. A real platform may use more than one role, but Type-3 pooling is easiest to understand as memory capacity made visible through CXL.mem.`,
        `A simple expansion topology attaches one host to one Type-3 memory device. A pooled topology adds a switch and a fabric manager. The switch provides fanout. The fabric manager owns configuration: which host can see which logical device, how capacity is partitioned, which paths are valid, and which health or QoS constraints apply.`,
        `The operating system then needs a placement policy. It may expose CXL memory as a NUMA node or a distinct memory tier. Hot latency-sensitive pages stay in local DRAM. Warm pages that need capacity but tolerate extra latency can move to CXL memory. Cold data belongs in SSD or object storage. The hard part is not allocating bytes once; it is keeping the right bytes in the right tier as the workload changes.`,
      ],
    },
    {
      heading: 'What the visual proves',
      paragraphs: [
        `The Type-3 pool view shows the mental shift from device attachment to fabric allocation. The memory modules are not just larger DIMMs. They sit behind a CXL path, and the host reaches them through root ports, switching, and assigned slices. That path becomes part of the cost model.`,
        `The fabric-manager view shows why a control plane is unavoidable. A pool without a ledger is just shared hardware with no accountability. The ledger records host ownership, slice ranges, NUMA distance, QoS, health, and movement rules. Those fields are the difference between a useful memory tier and an operational mystery.`,
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The design works when the allocation boundary is clear. A host can safely treat its assigned slice as memory because the fabric configuration, address mapping, and device state agree about ownership. The OS can make tiering decisions because the extra capacity appears in a form it can page, migrate, measure, and isolate.`,
        `The correctness argument is operational rather than mathematical. Every usable byte must have one current owner, one reachable path, one health state, and one placement meaning. If those records drift, the system can place hot pages on a slow path, expose memory to the wrong host, or keep using a failing device. The fabric manager exists to keep that metadata coherent enough for the hosts to trust their view.`,
      ],
    },
    {
      heading: 'Cost and tradeoffs',
      paragraphs: [
        `CXL memory is still not local DRAM. A load can cross a root complex, switch, and memory device instead of staying on the local memory controller. That adds latency, changes bandwidth sharing, and makes topology visible. When the input footprint doubles, the application may keep running instead of paging to storage, but its hot path can still slow down if placement is careless.`,
        `The pool also introduces fragmentation and contention. A large free total does not guarantee that one host can receive the exact slice shape it wants. Several hosts can contend for switch bandwidth or for a memory device behind the same fabric path. QoS metadata helps only if the platform measures pressure and enforces the policy.`,
        `Reliability becomes a fabric problem. Local DIMM faults are already serious, but pooled memory adds device hot-plug, link errors, path changes, firmware control, partitioning bugs, and security boundaries between hosts. A serious design needs RAS telemetry, isolation, auditing, and a conservative answer for what happens when a device disappears while pages still refer to it.`,
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `CXL pooling fits capacity-bound services whose working sets are larger than local DRAM but not uniformly latency-critical. In-memory databases, analytics engines, virtual-machine fleets, feature stores, graph indexes, search systems, and cache-heavy services can use it as a warm tier when access patterns have locality.`,
        `It is also relevant in AI infrastructure, but not as a replacement for accelerator memory. HBM remains the hot compute-adjacent tier. CXL memory is more plausible for CPU-side model-serving metadata, request state, feature caches, vector index partitions, replay buffers, checkpoint staging, and overflow tiers when the application can separate hot tensors from warm support state.`,
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `It fails when the workload treats every pointer chase as latency critical. If a tight loop needs local-DRAM behavior, moving those pages to CXL memory can erase the capacity win. It also fails when an organization buys pooling but does not build placement policy, monitoring, and rollback paths. More memory without tier awareness is just a larger place to put the wrong pages.`,
        `Pooling is not the same as arbitrary shared memory. Assigning distinct slices to hosts is cleaner than letting multiple hosts mutate the same bytes with unclear consistency and security rules. If the design really needs cross-host shared state, study distributed consistency, leases, logging, and message passing before assuming a memory fabric removes those problems.`,
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Study NUMA placement, Linux page migration, buddy allocator free lists, slab allocators, memory-mapped files, RDMA, peer memory, HBM, KV cache tiered offload, and heterogeneous workload routing. For CXL itself, read the CXL Consortium materials at https://computeexpresslink.org/ and the memory-pooling overview at https://computeexpresslink.org/wp-content/uploads/2023/12/CXL-2.0-Memory-Pooling.pdf, then compare Type-3 pooling with storage disaggregation and ordinary networked caches.`,
      ],
    },
  ],
};
