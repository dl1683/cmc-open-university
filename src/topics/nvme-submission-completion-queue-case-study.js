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
      heading: 'Problem',
      paragraphs: [
        'NVMe exists because a modern SSD is not a slow peripheral that should be fed one request at a time. It is a parallel storage controller connected over PCIe, with many flash channels, internal schedulers, DMA engines, and enough media parallelism to keep dozens or hundreds of operations in flight. If the host sends one read, waits for it, then sends the next read, most of that device capacity sits idle.',
        'The operating system also has a multicore problem. Many application threads can issue I/O at once, and a single global request queue would force them through one lock-heavy choke point. NVMe turns the host-device boundary into paired rings in host memory. The host posts submission queue entries, notifies the controller with a doorbell register, then later consumes completion queue entries that report status and command identity.',
      ],
    },
    {
      heading: 'Naive approach',
      paragraphs: [
        'The simplest storage interface looks like a function call: submit a command to the disk, block until the answer comes back, return bytes or an error. That model is easy to reason about because request order, completion order, and caller state are almost the same thing. It also matches older mental models from spinning disks, where one mechanical head made a single ordered path feel natural.',
        'A slightly better version uses one shared software queue and lets the driver issue multiple commands. That improves throughput, but it still makes every CPU contend for one dispatch point. It also hides an important distinction: the queue used by the operating system is not the same as the queue the hardware controller can fetch directly by DMA.',
        {type:'callout', text:'NVMe makes storage concurrency explicit by splitting host-produced command rings from controller-produced completion rings.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/7/75/Samsung_980_PRO_PCIe_4.0_NVMe_SSD_1TB-top_PNr%C2%B00915.jpg', alt:'Top view of an M.2 NVMe solid-state drive.', caption:'Samsung 980 PRO M.2 NVMe SSD photo by D-Kuru/Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is queue depth and ownership. Queue depth 1 gives great simplicity but poor device utilization. A single shared queue gives some parallelism but causes CPU contention and makes NUMA locality worse. A storage stack also cannot assume completions arrive in the same order as submissions, because the controller may finish a cache hit, a short read, or a command from a less busy NAND path first.',
        'The host therefore needs more than a list of pending requests. It needs bounded slots that can be reused safely, an identity for each command, a way to distinguish old entries from new entries after ring wrap, and a notification protocol that tells hardware when new work is ready without forcing a syscall-like handshake for every byte of metadata.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Use host-memory producer/consumer rings as the hardware contract. A submission queue is a ring of fixed-size command descriptors written by the host and read by the controller. A completion queue is a ring of fixed-size status descriptors written by the controller and read by the host. The pair separates the direction of ownership: host produces commands, controller produces completions.',
        'The important data-structure ideas are command IDs, phase tags, and doorbells. A command ID maps a completion back to the software request state. A phase tag tells the host whether a completion slot belongs to the current pass through the ring or is stale data from the previous pass. A doorbell is an MMIO register update that publishes a new queue head or tail to the other side.',
      ],
    },
    {
      heading: 'Mechanics',
      paragraphs: [
        'A read begins in application code but quickly becomes a block-layer request. The driver allocates a tag or command identifier, maps the data buffer for DMA, fills an SQE with opcode, namespace, logical block address, transfer length, command ID, and physical or I/O virtual addresses, then writes that SQE into the next free submission queue slot.',
        'After the SQE is visible in memory, the driver advances the submission tail doorbell. The controller observes the new tail, fetches SQEs from host memory, executes commands, and writes CQEs into the completion queue. Each CQE includes status, command ID, queue metadata, and a phase bit. The host can learn about CQEs by interrupt, by polling, or by hybrid schemes that poll briefly before sleeping.',
        'Once the host consumes a valid CQE, it checks the command ID, completes the original request, releases any DMA mapping, frees the software tag, and advances the completion queue head doorbell. That final doorbell matters: it tells the controller which completion slots are free for reuse.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The design works because each queue slot has a clear owner at each moment. The host owns free SQ slots until it publishes the tail. The controller owns submitted SQEs after it has seen that tail. The controller owns free CQ slots until it writes a completion. The host owns completed CQ slots until it advances the CQ head.',
        'This ownership protocol avoids a lock across the PCIe boundary. The host and controller coordinate through memory, queue indices, phase bits, and doorbells. The ring gives O(1) insertion and consumption. The command ID gives O(1) lookup into request state. The phase bit turns a reused memory slot into a safe cyclic buffer rather than a guessing game.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a process reads block 9000 into a page cache buffer. The block layer gives the request tag 17. The NVMe driver writes an SQE at submission slot 5 with command ID 17, a read opcode, namespace 1, LBA 9000, a length, and a PRP or scatter-gather pointer to the DMA-visible buffer. The driver then rings the submission tail doorbell with value 6.',
        'The controller later writes a CQE into completion slot 12 with command ID 17, success status, and the current phase bit. The host interrupt handler or polling loop sees the phase bit matches the expected phase for slot 12. It indexes request tag 17, marks the page cache buffer valid, wakes the waiting task, frees tag 17, and advances the completion head doorbell. Notice that slot 5 and slot 12 did not need to match; command ID 17 carried the identity.',
        'Now imagine the queue wraps. Completion slot 12 already contains old bytes from a previous round. The phase bit prevents the host from treating that old memory as a new completion. Only when the controller writes the slot with the expected phase does the host accept it.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The "queue pair" view emphasizes the split between request construction and device completion. Follow the command from app to block layer to SQE, then across the doorbell boundary into controller execution, and back through CQE, interrupt or polling, and request completion. The important transition is not a function return. It is a change in queue ownership.',
        'The "doorbell lifecycle" view emphasizes publication. Writing an SQE prepares work, but ringing the submission doorbell publishes it. Reading a CQE observes completion, but ringing the completion head doorbell releases the slot. The throughput curve shows why queue depth matters: enough depth hides device latency and exposes parallelism, while excessive depth can turn a fast device into a long waiting room.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The asymptotic cost of enqueueing and reaping is O(1), but storage performance is dominated by constants and batching choices. MMIO doorbell writes are more expensive than normal memory stores and may require ordering barriers. DMA mapping has setup cost and lifetime rules. Interrupts reduce CPU burn but add latency. Polling can reduce tail latency but spends CPU even when no completion is ready.',
        'Queue depth is both a capacity knob and a latency risk. More depth lets the controller reorder and parallelize work, but it can also increase waiting time for each individual request. Deep queues are good for bulk throughput. Shallow or carefully managed queues are better for latency-sensitive work, fairness, and fast cancellation.',
        'There is also memory and isolation cost. Each queue consumes host memory, controller resources, tags, and interrupt vectors. Multiple queues can reduce contention, but too many queues can waste scarce hardware state or make load balancing harder.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'NVMe queue pairs win on fast SSDs, high core counts, and software stacks that can keep many independent operations in flight. They fit Linux blk-mq hardware queues, user-space poll-mode drivers such as SPDK, database storage engines that batch asynchronous reads, and io_uring workloads that submit many operations before waiting.',
        'They also make the storage system modular. A higher layer can reason about request batching, tags, priorities, and completion handling without pretending the SSD is a blocking function. The same queue vocabulary appears in other high-performance devices too: network cards, RDMA adapters, and GPUs all rely on bounded host-device work queues with explicit completion paths.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'NVMe queues do not solve ordering semantics for the caller. Filesystems still need flushes, barriers, journaling, and careful write ordering. Databases still need WAL discipline. Applications still need to know whether they require durable completion or merely device acceptance. A fast completion path can make consistency bugs happen faster.',
        'The model also fails when buffer ownership is wrong. The controller reads and writes host memory by DMA, so the pointed-to buffers must remain valid until completion. Bugs in DMA mapping, IOMMU address lifetime, cache synchronization, command cancellation, or request reuse can corrupt data even if the ring indices are correct.',
        'Another failure mode is interrupt and polling misconfiguration. Too many interrupts can dominate CPU time. Too much polling can waste cores. Poor queue-to-CPU affinity can bounce completions across cores and erase the benefit of multiple queues.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common implementation bugs are off-by-one queue-full checks, ringing the doorbell before the SQE is fully visible, forgetting to update the completion head, accepting a CQE with the wrong phase, reusing a command ID before the old request is complete, or freeing a DMA buffer while the controller can still write into it.',
        'Operational failures include saturated queue depth, thermal throttling inside the SSD, slow media hiding behind large queues, controller reset, lost interrupts, unhealthy NAND causing long-tail completions, and firmware behavior that changes under mixed read/write pressure. A useful monitor separates host queueing delay, controller service time, retry counts, reset counts, and completion latency percentiles.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary references for deeper study are the NVM Express specifications page at https://nvmexpress.org/specifications/, the SPDK NVMe overview at https://spdk.io/doc/nvme.html, and operating-system material on Linux blk-mq, interrupt moderation, DMA mapping, and poll-mode I/O. Treat the specification as the authority for field layout and ordering rules, and treat kernel or SPDK code as examples of how the contract is implemented.',
        'Inside this curriculum, study Ring Buffer for wrap mechanics, Queue for producer/consumer basics, io_uring Submission and Completion Rings for user/kernel queueing, Linux blk-mq Tag and Hardware Queue for dispatch, DMA/IOMMU IOVA Mapping for device-visible memory, Readahead and Dirty Writeback for demand shaping, and Filesystem Extent Tree and Delayed Allocation for filesystem-level planning.',
      ],
    },
  ],
};
