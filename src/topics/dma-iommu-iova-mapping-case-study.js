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

