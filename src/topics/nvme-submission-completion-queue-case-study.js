// NVMe queue pairs: host-memory rings, doorbells, command identifiers,
// completion phase tags, and the data-structure shape under modern SSD I/O.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'nvme-submission-completion-queue-case-study',
  title: 'NVMe Submission/Completion Queue Case Study',
  category: 'Systems',
  summary: 'How NVMe turns SSD I/O into host-memory submission queues, completion queues, command IDs, doorbells, interrupts, and bounded queue depth.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['queue pair', 'doorbell lifecycle'], defaultValue: 'queue pair' },
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

function nvmeGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'app', label: 'app', x: 0.6, y: 4.0, note: notes.app ?? 'read' },
      { id: 'blk', label: 'blk', x: 2.1, y: 4.0, note: notes.blk ?? 'request' },
      { id: 'cmd', label: 'cmd', x: 3.7, y: 2.0, note: notes.cmd ?? '64B SQE' },
      { id: 'sq', label: 'SQ', x: 5.3, y: 2.0, note: notes.sq ?? 'host ring' },
      { id: 'door', label: 'door', x: 6.8, y: 2.0, note: notes.door ?? 'tail MMIO' },
      { id: 'ctrl', label: 'ctrl', x: 8.3, y: 4.0, note: notes.ctrl ?? 'SSD' },
      { id: 'flash', label: 'NAND', x: 9.6, y: 5.7, note: notes.flash ?? 'media' },
      { id: 'cq', label: 'CQ', x: 5.3, y: 6.0, note: notes.cq ?? 'host ring' },
      { id: 'irq', label: 'IRQ', x: 3.7, y: 6.0, note: notes.irq ?? 'or poll' },
      { id: 'done', label: 'done', x: 2.1, y: 6.0, note: notes.done ?? 'status' },
    ],
    edges: [
      { id: 'e-app-blk', from: 'app', to: 'blk', weight: 'bio' },
      { id: 'e-blk-cmd', from: 'blk', to: 'cmd', weight: 'map' },
      { id: 'e-cmd-sq', from: 'cmd', to: 'sq', weight: 'slot' },
      { id: 'e-sq-door', from: 'sq', to: 'door', weight: 'tail' },
      { id: 'e-door-ctrl', from: 'door', to: 'ctrl', weight: '' },
      { id: 'e-ctrl-sq', from: 'ctrl', to: 'sq', weight: 'DMA read' },
      { id: 'e-ctrl-flash', from: 'ctrl', to: 'flash', weight: 'I/O' },
      { id: 'e-ctrl-cq', from: 'ctrl', to: 'cq', weight: 'CQE' },
      { id: 'e-cq-irq', from: 'cq', to: 'irq', weight: '' },
      { id: 'e-irq-done', from: 'irq', to: 'done', weight: 'wake' },
      { id: 'e-done-app', from: 'done', to: 'app', weight: 'res' },
    ],
  }, { title });
}

function* queuePair() {
  yield {
    state: nvmeGraph('NVMe exposes I/O as paired host-memory rings'),
    highlight: { active: ['sq', 'cq', 'ctrl'], found: ['cmd', 'door'] },
    explanation: 'An NVMe I/O queue pair has a submission queue and completion queue in host memory. The driver writes commands into SQ slots, and the controller writes completion entries into CQ slots.',
    invariant: 'The host and controller share queue memory but coordinate through head, tail, and phase state.',
  };

  yield {
    state: nvmeGraph('A block request becomes one command slot', { blk: 'read req', cmd: 'cid=17', sq: 'tail=9' }),
    highlight: { active: ['app', 'blk', 'cmd', 'sq', 'e-app-blk', 'e-blk-cmd', 'e-cmd-sq'], compare: ['cq'] },
    explanation: 'The Linux block layer hands the driver a request. The NVMe driver chooses a command identifier, fills an SQ entry with opcode, namespace, logical block range, and memory pointers, then publishes it in the ring.',
  };

  yield {
    state: nvmeGraph('The controller fetches SQEs and later writes CQEs', { ctrl: 'fetch+exec', flash: 'read LBA', cq: 'cid=17 ok', irq: 'vector' }),
    highlight: { active: ['ctrl', 'flash', 'cq', 'irq', 'e-ctrl-sq', 'e-ctrl-flash', 'e-ctrl-cq', 'e-cq-irq'], found: ['cmd'] },
    explanation: 'After the doorbell, the controller DMAs command entries from host memory, performs the storage operation, writes a completion entry with the command identifier and status, and optionally interrupts the CPU.',
  };

  yield {
    state: labelMatrix(
      'NVMe queue objects',
      [
        { id: 'sqe', label: 'SQE' },
        { id: 'cqe', label: 'CQE' },
        { id: 'cid', label: 'CID' },
        { id: 'phase', label: 'phase' },
        { id: 'db', label: 'db' },
      ],
      [
        { id: 'holds', label: 'holds' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['cmd', 'bad ptr'],
        ['status', 'missed'],
        ['join key', 'reuse'],
        ['wrap bit', 'stale'],
        ['tail/head', 'MMIO cost'],
      ],
    ),
    highlight: { active: ['sqe:holds', 'cqe:holds', 'cid:holds'], found: ['phase:holds'], compare: ['db:risk'] },
    explanation: 'The core data structures are small but strict. SQEs describe work, CQEs report work, command IDs join them, phase tags distinguish wrapped completion slots, and doorbells make the device observe progress.',
  };
}

function* doorbellLifecycle() {
  yield {
    state: labelMatrix(
      'One read through the queue',
      [
        { id: 'alloc', label: 'alloc' },
        { id: 'fill', label: 'fill' },
        { id: 'ring', label: 'ring' },
        { id: 'fetch', label: 'fetch' },
        { id: 'complete', label: 'CQE' },
      ],
      [
        { id: 'host', label: 'host' },
        { id: 'ctrl', label: 'ctrl' },
      ],
      [
        ['tag+CID', 'idle'],
        ['SQE+PRP', 'idle'],
        ['tail db', 'notice'],
        ['wait', 'DMA SQE'],
        ['reap', 'write CQE'],
      ],
    ),
    highlight: { active: ['fill:host', 'ring:host', 'fetch:ctrl'], found: ['complete:ctrl'] },
    explanation: 'The lifecycle is a handshake. The host owns allocation and SQ publication, the controller owns command execution and CQ production, then the host reaps and frees the tag or command slot.',
    invariant: 'Queue depth is a hard capacity, not a performance suggestion.',
  };

  yield {
    state: nvmeGraph('Doorbells are tiny writes with large consequences', { sq: 'tail=10', door: 'MMIO write', ctrl: 'new work' }),
    highlight: { active: ['sq', 'door', 'ctrl', 'e-sq-door', 'e-door-ctrl'], compare: ['cq'] },
    explanation: 'A doorbell is a memory-mapped register write telling the controller that a queue head or tail changed. Drivers batch work partly because each MMIO doorbell has cost and ordering requirements.',
  };

  yield {
    state: labelMatrix(
      'Queue-depth pressure',
      [
        { id: 'qd1', label: 'QD1' },
        { id: 'qd8', label: 'QD8' },
        { id: 'qd64', label: 'QD64' },
        { id: 'full', label: 'full' },
      ],
      [
        { id: 'lat', label: 'lat' },
        { id: 'through', label: 'ops' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['low', 'low', 'simple'],
        ['ok', 'more', 'track'],
        ['tail', 'high', 'fairness'],
        ['stall', 'zero', 'backpressure'],
      ],
    ),
    highlight: { active: ['qd8:through', 'qd64:through'], compare: ['full:risk', 'qd64:lat'] },
    explanation: 'NVMe performance often needs multiple outstanding commands, but full queues turn into backpressure. The driver and block layer must limit depth, time out stuck commands, and avoid starving latency-sensitive work.',
  };

  yield {
    state: nvmeGraph('Completion reaping advances the CQ head doorbell', { cq: 'head=6', irq: 'poll', done: 'free tag', door: 'CQ head' }),
    highlight: { active: ['cq', 'irq', 'done', 'door', 'e-cq-irq', 'e-irq-done'], found: ['app'], compare: ['flash'] },
    explanation: 'After reading completion entries, the host advances the completion queue head doorbell so the controller can reuse those slots. Forgetting this is a capacity leak in ring-buffer form.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'queue pair') yield* queuePair();
  else if (view === 'doorbell lifecycle') yield* doorbellLifecycle();
  else throw new InputError('Pick an NVMe queue view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'NVMe is a storage protocol designed around parallel queues. Instead of one shared disk command line, the host creates submission queues and completion queues in memory. The driver writes commands into submission slots, rings a doorbell, and the controller later writes completion entries back to host memory.',
        'The data-structure lesson is direct: modern SSD I/O is a set of bounded producer/consumer rings with command IDs, phase tags, memory pointers, and hardware-visible head/tail movement.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A read request becomes an NVMe command. The command contains an opcode, namespace identifier, logical block address, block count, command identifier, and physical-region or scatter-gather pointers that tell the device where the data buffer lives. The driver places that command in a submission queue slot and updates the submission tail doorbell.',
        'The controller fetches new submission entries with DMA, executes them against flash media, writes completion entries into the completion queue, and notifies the host by interrupt or polling. The host matches the CQE back to the original request through the command identifier and then advances the CQ head doorbell.',
      ],
    },
    {
      heading: 'Complete case study: one read',
      paragraphs: [
        'An application calls read. VFS and the page cache decide that storage is needed. The block layer creates a request, blk-mq assigns an inflight tag, the NVMe driver fills an SQE, and the controller fetches it after the doorbell. When the device finishes the flash read and DMA transfer, it writes a CQE. The interrupt or poll loop completes the block request, wakes the waiter, and releases the tag.',
        'That path connects Ring Buffer, io_uring Submission/Completion Rings, Linux Page Cache XArray, Linux blk-mq Tag & Hardware Queue, and DMA/IOMMU IOVA Mapping. The same queue vocabulary repeats at every layer, but ownership changes at each boundary.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Queue depth is not free. Too little depth leaves a fast SSD idle; too much depth can increase tail latency, hide timeouts, consume tags, and make fairness harder. Doorbell writes are tiny but not invisible, so batching and memory ordering matter. Completion phase bits are easy to misunderstand because reused ring slots can look valid unless the wrap state is checked.',
        'The memory pointers in an SQE must be valid for device DMA. That makes DMA mapping, IOMMU translation, cache synchronization, and buffer lifetime part of storage correctness, not a separate concern.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: NVM Express specifications page at https://nvmexpress.org/specifications/, SPDK NVMe command processing overview at https://spdk.io/doc/nvme_spec.html, and Oracle Linux NVMe architecture overview at https://blogs.oracle.com/linux/overview-of-nvme-architecture. Study Ring Buffer, Queue, io_uring Submission & Completion Rings, Linux blk-mq Tag & Hardware Queue, DMA/IOMMU IOVA Mapping, Readahead & Dirty Writeback, and Filesystem Extent Tree & Delayed Allocation next.',
      ],
    },
  ],
};
