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
    explanation: 'The core structures are small but strict. SQEs describe work, CQEs report work, command IDs join them, phase tags reject stale wrapped slots, and doorbells make the device observe progress.',
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
    explanation: 'NVMe performance often needs multiple outstanding commands, but queue depth is still a bounded resource. Too little depth idles flash parallelism; too much can inflate tail latency and tag pressure.',
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
      heading: 'How to read the animation',
      paragraphs: [
        'Read the queue-pair view as an ownership trace. The host writes submission queue entries, the controller reads them, the controller writes completion queue entries, and the host reads those completions. Active means the current side owns the slot and is allowed to update it. Visited means the slot has already crossed an ownership boundary.',
        {type:'callout', text:'NVMe makes storage concurrency explicit by splitting host-produced command rings from controller-produced completion rings.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/75/Samsung_980_PRO_PCIe_4.0_NVMe_SSD_1TB-top_PNr%C2%B00915.jpg', alt:'Top view of an M.2 NVMe solid-state drive.', caption:'Samsung 980 PRO M.2 NVMe SSD photo by D-Kuru/Wikimedia Commons, CC BY-SA 4.0.'},
        'In the doorbell view, a doorbell is a memory-mapped register write that publishes a new queue head or tail to the device. A safe inference rule is this: a command is not visible to the controller until the entry is written and the submission tail doorbell is advanced.',
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'NVMe exists because solid-state drives can run many operations in parallel. A blocking disk call that sends one command and waits wastes flash channels, controller queues, DMA engines, and CPU cores. The device needs enough outstanding work to hide media latency.',
        'The operating system also needs multicore submission. If every thread contends for one global lock before issuing I/O, the host becomes the bottleneck. NVMe exposes many queue pairs so CPUs and controllers coordinate through bounded rings in host memory.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious storage API is a function call: read this block, wait, and return bytes or an error. That model is easy to teach because request order and completion order look identical. It also matched older disk intuition where one mechanical path dominated service time.',
        'A better first improvement is one shared asynchronous queue. The host can submit several requests before waiting. That helps throughput, but it still mixes CPU contention, command identity, completion ordering, and hardware publication into one crowded abstraction.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is queue depth and completion order. Queue depth one underuses a fast SSD. A deep shared queue can keep the device busy but force CPUs through one hot point and make it unsafe to assume completions return in submission order.',
        'A controller may finish command 18 before command 17 because their NAND paths, cache hits, or internal scheduling choices differ. The host needs command IDs, phase bits, and reusable slots. Without those pieces, ring wrap and out-of-order completion become data-corruption risks.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'The core insight is to split the contract by direction of production. A submission queue is produced by the host and consumed by the controller. A completion queue is produced by the controller and consumed by the host. Each ring slot has one valid owner at a time.',
        'Command IDs connect completions back to software requests. Phase bits distinguish a newly written completion from old bytes left in the same slot after wraparound. Doorbells publish index movement without turning every command into a synchronous handshake.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The driver allocates a request tag, maps the data buffer for DMA, and fills a submission queue entry with opcode, namespace, logical block address, length, command ID, and buffer pointers. DMA means the device can read or write host memory directly through addresses the I/O memory manager permits.',
        'After the entry is visible in memory, the driver writes the submission tail doorbell. The controller fetches entries, executes them, and writes completion queue entries with status and command ID. The host sees completions by interrupt, polling, or a hybrid loop.',
        'When the host accepts a completion, it uses the command ID to find the original request, completes the software operation, releases the DMA mapping, and advances the completion head doorbell. That last publication tells the controller which completion slots can be reused.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument is the queue ownership invariant. The host may write a submission slot only while that slot is free. The controller may execute it only after the tail is published. The host may consume a completion only when the phase bit says the controller wrote it for the current ring pass.',
        'This invariant separates concurrency from identity. Commands may complete out of order, but command IDs map each completion to the right request. Slots may wrap, but phase bits prevent old memory from being accepted as new work.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Enqueue and completion handling are O(1) per command because each operation writes or reads one ring slot and updates an index. The real cost is in constants: MMIO doorbell writes, memory barriers, DMA mapping, interrupts, polling time, and cache locality. Doubling the number of commands doubles queue traffic, but not the search cost per command.',
        'Queue depth behaves like a latency-throughput knob. With depth 1 and 80 microsecond service time, one queue can finish at most about 12,500 operations per second. With enough independent depth to keep 64 operations in flight, the device can expose much more internal parallelism, but individual requests may wait longer in line.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'NVMe queue pairs fit operating-system block layers, databases, filesystems, and user-space storage stacks that issue many independent I/O operations. Linux blk-mq maps software work onto hardware queues. SPDK uses polling and user-space drivers to reduce kernel and interrupt overhead for low-latency storage.',
        'The same pattern appears in network cards, RDMA adapters, and GPUs. A host writes work descriptors into a ring, rings a doorbell, and later consumes completions. The reusable idea is device coordination through bounded producer-consumer queues.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'NVMe queues do not solve durability or application ordering. Filesystems still need journaling, barriers, flushes, and writeback discipline. Databases still need a write-ahead log and must know whether a completion means accepted by the controller or durable on media.',
        'The model also fails when buffer ownership is wrong. If the host frees or reuses a DMA buffer before completion, the controller can write into memory now owned by another object. Bad queue affinity, interrupt storms, excessive polling, or stale phase handling can erase the benefit of the queue design.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a process reads logical block address 9000 into a 16 KB page-cache buffer. The driver assigns command ID 17 and writes a submission entry at slot 5. It then rings the submission tail doorbell with value 6, so the controller knows slot 5 is ready.',
        'The controller later writes a completion at slot 12 with command ID 17 and success status. The host checks that the phase bit matches the current pass, looks up request 17, marks the 16 KB buffer valid, wakes the waiting task, and advances the completion head. Slot 5 and slot 12 do not need to match because command ID 17 carries identity.',
        'If the ring has 64 slots, slot 12 will be reused after wraparound. Old bytes may still be present before the controller writes a new completion. The phase bit is the one-bit proof that the memory belongs to the current round.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Start with the NVM Express specifications at https://nvmexpress.org/specifications/ and the SPDK NVMe documentation at https://spdk.io/doc/nvme.html. Use the specification for field layout and ordering rules, then use kernel or SPDK code to see how drivers implement the contract.',
        'Next, study ring buffers, producer-consumer queues, DMA and IOMMU address mapping, Linux blk-mq tags, interrupts, polling, io_uring, and write-ahead logging. The reusable lesson is that hardware concurrency needs explicit ownership transfer, not just a larger list of requests.',
      ],
    },
  ],
};
