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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the animation as a shift from local attachment to fabric allocation. A host is a server that runs programs, a Type-3 CXL device is a memory device, and a fabric manager is the control plane that assigns memory slices. Active paths show which host can reach which slice at that moment.',
        'The safe inference rule is ownership before use. A byte is usable only when the fabric manager, address mapping, path health, and operating system view agree that one host owns that slice. Extra capacity without that ledger is not safe memory.',
        {type:'callout', text:'CXL pooling turns memory capacity into a managed fabric resource, but placement, ownership, and health metadata decide whether the extra bytes are useful.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'CXL means Compute Express Link, a protocol family for connecting CPUs, memory devices, and accelerators over a PCIe-based physical link. CXL memory pooling exists because fleet memory is often bought in the wrong shape. One server can run out of DRAM while another server has idle memory that cannot move.',
        'Buying every server for peak memory is simple but wasteful. A search index, in-memory database, virtual-machine host, or AI serving node may need a large warm working set only during part of its life. Pooling tries to turn some memory capacity into a managed fabric resource instead of a fixed per-server purchase.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to add more local DRAM to every machine. Local DRAM is fast, predictable, and controlled by the server\'s own memory controller. It is the right answer when the application uses most of that capacity most of the time.',
        'Another approach is to spill to SSDs, network storage, or object stores. Those systems are excellent for cold data. They are a poor fit when software expects byte-addressable load/store memory and page-granular movement rather than block or object access.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is stranded capacity. A fleet may have 100 TB of free DRAM in aggregate while a single host cannot allocate the 2 TB it needs for a burst. Local memory is attached to sockets, not to demand.',
        'The second wall is latency tiers. Remote memory is not local memory, and storage is not memory. A useful system must place hot pages in local DRAM, warm pages in CXL memory, and cold data in storage, while exposing enough metadata for software to know which tier it is using.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Separate capacity from permanent host attachment while keeping memory semantics. CXL.mem lets a host read and write memory exposed by a device, and Type-3 devices are built around memory expansion rather than compute. The fabric manager turns physical devices into assignable logical slices.',
        'The invariant is explicit ownership. A slice belongs to one host or one configured partition under fabric control. Pooling is not a claim that every byte has local-DRAM latency; it is a claim that capacity can be assigned, measured, isolated, and moved under policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The CXL protocol family splits jobs. CXL.io handles discovery and device management, CXL.cache handles coherent caching between host and device roles, and CXL.mem handles host access to device memory. Type-3 pooling mainly uses the memory-access role.',
        'A simple expansion setup attaches one host to one Type-3 device. A pooled setup adds a switch and a fabric manager. The switch provides paths, while the manager records which host sees which logical device, how large the slice is, which address ranges map to it, and what health or quality-of-service rules apply.',
        'The operating system then treats the assigned memory as a NUMA node or memory tier. NUMA means non-uniform memory access, where some memory is farther away and slower than other memory. Page placement policy decides which pages stay local and which move to the CXL tier.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works when all control-plane records describe the same reality. A host can safely load from a CXL slice because the device, switch, address map, and operating system agree about ownership and reachability. If any record drifts, the host can place data on the wrong tier or keep using a failing path.',
        'The correctness argument is operational. Every usable slice needs one owner, one current mapping, one health state, and one placement meaning. The fabric manager exists to keep those facts coherent enough that ordinary memory software can trust the exposed tier.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'CXL memory pays extra latency and shared-path cost. A local DRAM load may stay on the CPU memory controller, while a CXL load can cross a root complex, switch, and memory device. If a service moves hot pointer-chasing pages to the CXL tier, capacity improves and latency can get worse.',
        'Cost behaves like a tiering problem. If a host needs 768 GB but has 512 GB local DRAM, adding 256 GB of pooled memory may avoid paging to SSD. If the hot 100 GB remains local and the warm 256 GB moves to CXL, the service can improve; if the hot 100 GB migrates by mistake, the service slows down.',
        'The pool adds fragmentation, contention, and reliability work. A free total of 10 TB does not guarantee the right slice size, path, or bandwidth for one host. Link errors, device faults, firmware bugs, and partition mistakes become fleet incidents rather than local DIMM incidents.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'CXL pooling fits capacity-bound services with warm working sets. In-memory databases, analytics engines, virtual-machine fleets, search indexes, graph stores, caches, and feature stores can use it when access patterns have enough locality to keep the hottest pages local. The access pattern is not random hot access to all bytes.',
        'It is also relevant in AI infrastructure, but not as a replacement for accelerator high-bandwidth memory. CXL memory is more plausible for CPU-side request state, metadata, vector index partitions, checkpoint staging, feature caches, and overflow tiers. Hot tensors still belong near the compute engine.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'It fails when the workload treats every access as hot. A graph traversal or lock-heavy data structure that pointer-chases through remote pages can lose more to latency than it gains from capacity. More memory is not helpful if the placement policy moves the wrong pages.',
        'It also fails when teams confuse pooling with arbitrary shared memory. Assigning slices is cleaner than letting multiple hosts mutate the same bytes with unclear consistency and security rules. Cross-host shared state still needs distributed consistency, leases, logs, or message passing.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Assume a server has 512 GB of local DRAM and a workload needs 700 GB during a morning build of an in-memory index. Without pooling, the team buys 768 GB or 1 TB in every similar server, even if most run at 300 GB for the rest of the day. With a pool, the fabric manager assigns a 256 GB CXL slice for the burst.',
        'The placement policy keeps the hottest 400 GB in local DRAM and moves 220 GB of warm index pages to CXL memory. The remaining 80 GB is free headroom for the operating system and application churn. If the CXL path is 2 times slower than local DRAM for those warm pages but avoids SSD paging that is 100 times slower, the behavior can still improve.',
        'Now double the warm index from 220 GB to 440 GB. The service still fits only if the pool has a larger contiguous slice and the switch path has enough bandwidth. The cost is no longer just bytes; it is bytes plus topology, contention, and policy accuracy.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Read the CXL Consortium materials at https://computeexpresslink.org/ and the CXL 2.0 memory pooling overview at https://computeexpresslink.org/wp-content/uploads/2023/12/CXL-2.0-Memory-Pooling.pdf. Then study NUMA placement, Linux page migration, buddy allocation, slab allocation, RDMA, memory-mapped files, HBM, KV-cache tiering, and heterogeneous workload routing.',
      ],
    },
  ],
};
