// DMA and IOMMU mapping: CPU virtual buffers, dma_addr_t device addresses,
// streaming map/unmap, scatter-gather lists, cache sync, and lifetime rules.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'dma-iommu-iova-mapping-case-study',
  title: 'DMA/IOMMU IOVA Mapping Case Study',
  category: 'Systems',
  summary: 'How Linux maps CPU buffers into device-visible DMA addresses through the DMA API, IOMMU page tables, scatter-gather lists, and cache-sync rules.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['map path', 'scatter gather'], defaultValue: 'map path' },
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
  return matrixState({ title, rows, columns, values: labelsByRow.map((row) => row.map(code)), format: (value) => labels[value] });
}

function dmaGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'drv', label: 'drv', x: 0.8, y: 4.0, note: notes.drv ?? 'driver' },
      { id: 'buf', label: 'buf', x: 2.5, y: 2.0, note: notes.buf ?? 'CPU ptr' },
      { id: 'api', label: 'DMA API', x: 4.2, y: 2.0, note: notes.api ?? 'map' },
      { id: 'iova', label: 'IOVA', x: 5.9, y: 2.0, note: notes.iova ?? 'dma_addr' },
      { id: 'iommu', label: 'IOMMU', x: 7.6, y: 2.0, note: notes.iommu ?? 'page table' },
      { id: 'ram', label: 'RAM', x: 9.2, y: 2.0, note: notes.ram ?? 'pages' },
      { id: 'dev', label: 'dev', x: 5.9, y: 5.8, note: notes.dev ?? 'NVMe/NIC' },
      { id: 'cache', label: 'cache', x: 2.5, y: 5.8, note: notes.cache ?? 'sync' },
      { id: 'unmap', label: 'unmap', x: 7.6, y: 5.8, note: notes.unmap ?? 'release' },
    ],
    edges: [
      { id: 'e-drv-buf', from: 'drv', to: 'buf', weight: 'owns' },
      { id: 'e-buf-api', from: 'buf', to: 'api', weight: 'map' },
      { id: 'e-api-iova', from: 'api', to: 'iova', weight: 'addr' },
      { id: 'e-iova-iommu', from: 'iova', to: 'iommu', weight: '' },
      { id: 'e-iommu-ram', from: 'iommu', to: 'ram', weight: 'phys' },
      { id: 'e-iova-dev', from: 'iova', to: 'dev', weight: 'give' },
      { id: 'e-dev-iommu', from: 'dev', to: 'iommu', weight: 'DMA' },
      { id: 'e-api-cache', from: 'api', to: 'cache', weight: 'sync' },
      { id: 'e-dev-unmap', from: 'dev', to: 'unmap', weight: 'done' },
      { id: 'e-unmap-iommu', from: 'unmap', to: 'iommu', weight: 'free' },
    ],
  }, { title });
}

function* mapPath() {
  yield {
    state: dmaGraph('A CPU pointer is not automatically a device address'),
    highlight: { active: ['drv', 'buf', 'api'], compare: ['dev'] },
    explanation: 'A driver starts with a CPU-visible buffer. A device usually needs a DMA address, not a JavaScript-like pointer and not necessarily the CPU physical address. The DMA API creates the device-visible view.',
    invariant: 'The driver gives the device only DMA addresses returned by the DMA API.',
  };

  yield {
    state: dmaGraph('dma_map_single creates a dma_addr_t view', { api: 'dma_map', iova: '0xI0VA', iommu: 'map PTEs' }),
    highlight: { active: ['buf', 'api', 'iova', 'iommu', 'ram', 'e-buf-api', 'e-api-iova', 'e-iova-iommu', 'e-iommu-ram'], found: ['cache'] },
    explanation: 'On systems with an IOMMU, mapping can allocate I/O virtual address space and install translations from IOVA to real memory pages. On simpler systems, the returned DMA address may be closer to a bus physical address.',
  };

  yield {
    state: dmaGraph('The device DMAs through the IOMMU into RAM', { dev: 'SSD/NIC', iova: 'rx buf', ram: 'page data', cache: 'device owns' }),
    highlight: { active: ['dev', 'iova', 'iommu', 'ram', 'e-iova-dev', 'e-dev-iommu', 'e-iommu-ram'], compare: ['buf'] },
    explanation: 'The driver programs the device with the DMA address. The device issues reads or writes against that address, and the IOMMU translates it to the real memory pages the driver mapped.',
  };

  yield {
    state: dmaGraph('Completion must be followed by sync or unmap as required', { unmap: 'dma_unmap', cache: 'CPU sees', api: 'lifetime end' }),
    highlight: { active: ['dev', 'unmap', 'iommu', 'cache', 'e-dev-unmap', 'e-unmap-iommu', 'e-api-cache'], found: ['drv'] },
    explanation: 'A streaming mapping is not permanent ownership. When I/O completes, the driver synchronizes if the CPU needs to read or write the buffer, then unmaps so IOVA space and debug accounting are correct.',
  };
}

function* scatterGather() {
  yield {
    state: labelMatrix(
      'One request, many pages',
      [
        { id: 'p0', label: 'page0' },
        { id: 'p1', label: 'page1' },
        { id: 'p2', label: 'page2' },
        { id: 'p3', label: 'page3' },
      ],
      [
        { id: 'phys', label: 'phys' },
        { id: 'sg', label: 'SG' },
        { id: 'dev', label: 'dev' },
      ],
      [
        ['far', 'seg0', 'addr0'],
        ['near', 'seg0', 'addr0+4k'],
        ['far', 'seg1', 'addr1'],
        ['far', 'seg2', 'addr2'],
      ],
    ),
    highlight: { active: ['p0:sg', 'p1:sg', 'p2:sg'], compare: ['p3:dev'] },
    explanation: 'Large I/O rarely sits in one physically contiguous run. Scatter-gather lists describe several memory segments so a device can transfer one logical request across many pages.',
    invariant: 'The logical buffer can be contiguous to software while fragmented in physical memory.',
  };

  yield {
    state: dmaGraph('dma_map_sg converts an SG list into device segments', { buf: 'SG list', api: 'map_sg', iova: 'nsegs', dev: 'PRP/SGL' }),
    highlight: { active: ['buf', 'api', 'iova', 'dev', 'e-buf-api', 'e-api-iova', 'e-iova-dev'], found: ['iommu'] },
    explanation: 'dma_map_sg can merge or translate scatter-gather entries for the device. The driver then builds hardware descriptors such as NVMe PRP/SGL entries or NIC descriptors from the mapped segments.',
  };

  yield {
    state: labelMatrix(
      'DMA direction rules',
      [
        { id: 'to', label: 'to dev' },
        { id: 'from', label: 'from dev' },
        { id: 'bidir', label: 'bidir' },
        { id: 'coh', label: 'coherent' },
      ],
      [
        { id: 'device', label: 'dev does' },
        { id: 'cpu', label: 'CPU rule' },
      ],
      [
        ['reads', 'flush'],
        ['writes', 'inval'],
        ['both', 'care'],
        ['shared', 'order'],
      ],
    ),
    highlight: { active: ['to:cpu', 'from:cpu', 'bidir:cpu'], compare: ['coh:cpu'] },
    explanation: 'The DMA direction is part of correctness. It tells the mapping layer and cache-sync code whether the device will read from memory, write to memory, or both.',
  };

  yield {
    state: labelMatrix(
      'Failure ledger',
      [
        { id: 'leak', label: 'leak' },
        { id: 'reuse', label: 'reuse' },
        { id: 'dir', label: 'dir' },
        { id: 'over', label: 'overrun' },
        { id: 'mask', label: 'mask' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'control', label: 'control' },
      ],
      [
        ['no unmap', 'dma dbg'],
        ['early', 'ref'],
        ['wrong', 'sync'],
        ['too long', 'bounds'],
        ['too high', 'mask'],
      ],
    ),
    highlight: { active: ['leak:control', 'reuse:control', 'dir:control'], compare: ['over:bad'] },
    explanation: 'The common failures are ownership failures: leaked mappings, buffers reused before completion, wrong direction, wrong length, or a device DMA mask that cannot address the mapped region.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'map path') yield* mapPath();
  else if (view === 'scatter gather') yield* scatterGather();
  else throw new InputError('Pick a DMA mapping view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'DMA is the mechanism that lets a device move bytes to or from main memory without asking the CPU to copy every byte. An NVMe controller can write disk data into page-cache pages. A NIC can fill receive buffers. A GPU or accelerator can read command buffers and write results. The CPU still sets up the operation, but the hot transfer path belongs to the device.',
        'The hard part is address meaning. A driver owns a CPU-visible buffer, usually reached through a kernel virtual address. The device cannot safely use that pointer. It needs an address in the device DMA address space, and on many machines that address is an I/O virtual address translated by an IOMMU. The Linux DMA API is the contract that turns a CPU buffer into a device-visible token with a direction, length, and lifetime.',
        {type: 'callout', text: 'A DMA mapping is a temporary device-side capability, not a CPU pointer handed to hardware.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/MMU_and_IOMMU.svg', alt: 'Diagram comparing CPU virtual-address translation through an MMU with device-address translation through an IOMMU.', caption: 'MMU and IOMMU address-translation diagram, DTR after Intgr, public domain, via Wikimedia Commons.'},
      ],
    },
    {
      heading: 'The obvious approach and the wall',
      paragraphs: [
        'The obvious design is to give the device whatever address the CPU is using. That can appear to work on simple systems, especially when examples run without an IOMMU and bus addresses resemble physical addresses. It also feels natural because the driver already has a pointer and the device descriptor only asks for an address and length.',
        'That shortcut breaks on real platforms. CPU virtual addresses are interpreted through CPU page tables. Devices issue bus transactions through a different path. Memory may be above a device DMA mask, fragmented across many pages, protected by an IOMMU, or cached in a way the device cannot see. A driver that skips the DMA API may pass an address the device cannot translate, let a device read stale data, or let a malicious or broken device write outside the intended buffer.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'A DMA mapping is an address-space object, not just a number. The map operation says that a particular device may access a particular memory range, in a particular direction, until the matching sync or unmap. On IOMMU systems, the mapping may allocate IOVA space and install IOVA-to-physical page-table entries. On simpler systems, it may validate addressability or choose a bounce buffer.',
        'The core invariant is that the device receives only DMA addresses returned by the DMA API. The CPU virtual pointer remains a CPU-side object. The dma_addr_t is the device-side capability. Mapping creates that capability; completion and unmap end it. This separation is what lets the same driver run across machines with different IOMMU, cache-coherency, and device-addressing rules.',
      ],
    },
    {
      heading: 'Data structures and mechanism',
      paragraphs: [
        'A streaming mapping is the common case for data buffers. The driver calls a mapping function such as dma_map_single or dma_map_page with a buffer, length, and direction. The call returns a dma_addr_t. The driver writes that address and length into a device descriptor, rings the device doorbell, and waits for an interrupt, poll completion, or queue entry that proves the device is finished.',
        'Scatter-gather is the data structure that makes large fragmented I/O practical. Software may see one logical request, but the backing memory can be many non-contiguous pages. A scatterlist records those memory pieces. dma_map_sg converts the list into device-visible segments and may merge adjacent entries, split entries, or translate them through the IOMMU. The segment count after mapping is the count the hardware descriptor builder must use.',
        'Several side structures matter. The IOVA allocator manages ranges in the I/O virtual address space. IOMMU page tables map those IOVAs to real pages. Device DMA masks describe which addresses the hardware can issue. Cache-maintenance rules decide whether CPU writes must be flushed before DMA_TO_DEVICE or CPU reads must wait for invalidation after DMA_FROM_DEVICE. Debug accounting can detect leaks, double unmaps, and direction mistakes.',
        'Coherent DMA allocations solve a related but different problem. They are useful for descriptor rings and shared control blocks that both CPU and device touch for a long time. Streaming mappings are better for payload buffers that have a clear ownership handoff per operation.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because it gives the device the narrowest useful view of memory. The mapping layer can install translations only for the pages in the request, enforce direction, choose addresses the device can reach, and tear the view down when the transfer finishes. An IOMMU also protects the rest of memory if the device attempts an unexpected access.',
        'The direction is part of correctness. If the device reads memory, the CPU writes that prepared the buffer must be visible before the device starts. If the device writes memory, the CPU must not read stale cache lines before synchronization. Coherent systems hide some of this, but portable drivers still use the DMA API because the same source may run on non-coherent platforms.',
      ],
    },
    {
      heading: 'Worked case study',
      paragraphs: [
        'Consider an NVMe read into the page cache. The kernel allocates one or more pages for file data and builds a block request. The NVMe path maps those pages for DMA_FROM_DEVICE, turns the mapped segments into PRP or SGL entries, places the command in the submission queue, and rings the SSD doorbell. The SSD writes data through the device DMA addresses, not through kernel pointers.',
        'When the completion queue entry arrives, the driver knows the device is finished with the mapped range. The unmap or sync path reconciles cache state so the CPU can safely read the data. The block layer can complete the bio, and the page cache can mark the folio uptodate. The same shape appears in NIC receive rings, USB transfers, RDMA registrations, and GPU peer-memory paths, even though each device has its own descriptor format.',
      ],
    },
    {
      heading: 'Where it is useful',
      paragraphs: [
        'DMA mapping is useful wherever copying bytes through the CPU would waste cycles and memory bandwidth. Storage, networking, audio, video capture, accelerators, RDMA, and GPU transfer paths all depend on it. It is also useful as a portability boundary because the driver does not need to know whether the platform uses identity mappings, IOMMU translations, bounce buffers, or explicit cache maintenance.',
        'The pattern is especially important for ring-based devices. A driver may allocate long-lived coherent memory for descriptor rings, then use streaming mappings for data buffers whose ownership moves per request. That split keeps stable control structures simple while preserving strict lifetime rules for payload buffers.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'DMA is not free. Mapping can allocate IOVA space, update IOMMU page tables, invalidate IOTLB entries, flush or invalidate caches, allocate bounce buffers, and build descriptors. For tiny transfers, those costs can exceed a CPU copy. Drivers often batch work, reuse descriptor rings, and use coherent allocations for long-lived control memory to avoid paying streaming-map costs in the wrong place.',
        'It also fails when the lifetime is vague. A buffer must not be freed, reused, or modified by the CPU while the device still owns the relevant direction. A scatter-gather list must respect hardware segment limits and alignment. A driver must handle mapping failure, shortened segment counts, DMA masks, and error completions. Ignoring any of those turns a performance feature into a corruption path.',
      ],
    },
    {
      heading: 'Operational signals',
      paragraphs: [
        'Useful signals start with correctness. Linux DMA debugging can report leaked mappings, wrong-direction syncs, double unmaps, and suspicious reuse. IOMMU fault logs can show a device touching an unmapped or disallowed IOVA. Device error counters, PCIe AER events, and driver timeout logs often point to descriptors that reference bad addresses or buffers whose ownership changed too early.',
        'Performance signals are mapping rate, IOMMU fault or invalidation activity, bounce-buffer use, small-I/O overhead, interrupt-to-completion latency, and descriptor-ring occupancy. If throughput is low while CPU time is high in mapping or sync paths, the system may need larger I/O, batching, different memory allocation, or a coherent ring plus streaming payload design.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Primary sources are the Linux DMA API documentation at https://docs.kernel.org/core-api/dma-api.html and the DMA API how-to at https://docs.kernel.org/core-api/dma-api-howto.html. They are worth reading because the rules are contract rules, not implementation trivia.',
        'Study Linux Page Cache XArray for the memory object that storage fills, NVMe Submission/Completion Queue and Linux blk-mq Tag & Hardware Queue for descriptor flow, RDMA Queue Pair & Work Request and GPUDirect RDMA Peer Memory for peer-device transfers, Buddy Allocator Free Lists for physical memory supply, and Backpressure & Flow Control for what happens when devices complete slower than software submits.',
      ],
    },
  ],
};
