// Linux blk-mq: software staging queues, hardware dispatch queues, inflight
// tags, schedulers, and the routing layer between filesystems and NVMe.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'linux-blk-mq-tag-hardware-queue-case-study',
  title: 'Linux blk-mq Tag & Hardware Queue Case Study',
  category: 'Systems',
  summary: 'How Linux blk-mq maps per-CPU software queues to hardware dispatch queues, assigns inflight tags, applies optional schedulers, and feeds fast SSDs.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['queue routing', 'tag pressure'], defaultValue: 'queue routing' },
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

function blkGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'cpu0', label: 'CPU0', x: 0.8, y: 1.8, note: notes.cpu0 ?? 'bio' },
      { id: 'cpu1', label: 'CPU1', x: 0.8, y: 3.7, note: notes.cpu1 ?? 'bio' },
      { id: 'cpu2', label: 'CPU2', x: 0.8, y: 5.6, note: notes.cpu2 ?? 'bio' },
      { id: 'ctx0', label: 'ctx0', x: 2.7, y: 1.8, note: notes.ctx0 ?? 'sw q' },
      { id: 'ctx1', label: 'ctx1', x: 2.7, y: 3.7, note: notes.ctx1 ?? 'sw q' },
      { id: 'ctx2', label: 'ctx2', x: 2.7, y: 5.6, note: notes.ctx2 ?? 'sw q' },
      { id: 'sched', label: 'sched', x: 4.5, y: 3.7, note: notes.sched ?? 'none/mq' },
      { id: 'tag', label: 'tag', x: 5.9, y: 3.7, note: notes.tag ?? 'slot' },
      { id: 'hctx0', label: 'hctx0', x: 7.4, y: 2.6, note: notes.hctx0 ?? 'hw q' },
      { id: 'hctx1', label: 'hctx1', x: 7.4, y: 4.8, note: notes.hctx1 ?? 'hw q' },
      { id: 'drv', label: 'drv', x: 9.0, y: 3.7, note: notes.drv ?? 'NVMe' },
    ],
    edges: [
      { id: 'e-cpu0-ctx0', from: 'cpu0', to: 'ctx0', weight: '' },
      { id: 'e-cpu1-ctx1', from: 'cpu1', to: 'ctx1', weight: '' },
      { id: 'e-cpu2-ctx2', from: 'cpu2', to: 'ctx2', weight: '' },
      { id: 'e-ctx0-sched', from: 'ctx0', to: 'sched', weight: '' },
      { id: 'e-ctx1-sched', from: 'ctx1', to: 'sched', weight: '' },
      { id: 'e-ctx2-sched', from: 'ctx2', to: 'sched', weight: '' },
      { id: 'e-sched-tag', from: 'sched', to: 'tag', weight: 'get' },
      { id: 'e-tag-hctx0', from: 'tag', to: 'hctx0', weight: '' },
      { id: 'e-tag-hctx1', from: 'tag', to: 'hctx1', weight: '' },
      { id: 'e-hctx0-drv', from: 'hctx0', to: 'drv', weight: 'dispatch' },
      { id: 'e-hctx1-drv', from: 'hctx1', to: 'drv', weight: 'dispatch' },
    ],
  }, { title });
}

function* queueRouting() {
  yield {
    state: blkGraph('blk-mq splits request staging from hardware dispatch'),
    highlight: { active: ['ctx0', 'ctx1', 'ctx2', 'hctx0', 'hctx1'], found: ['sched', 'tag'] },
    explanation: 'blk-mq splits CPU-local staging from device dispatch. That lets ordinary request building stay near the submitting CPU while hardware queues receive enough work to keep fast devices busy.',
    invariant: 'Software queueing is about CPU locality; hardware queueing is about device parallelism.',
  };

  yield {
    state: blkGraph('Per-CPU contexts reduce shared lock contention', { cpu0: 'read A', cpu1: 'read B', cpu2: 'write C', ctx0: 'local', ctx1: 'local', ctx2: 'local' }),
    highlight: { active: ['cpu0', 'cpu1', 'cpu2', 'ctx0', 'ctx1', 'ctx2', 'e-cpu0-ctx0', 'e-cpu1-ctx1', 'e-cpu2-ctx2'], compare: ['drv'] },
    explanation: 'Incoming bios and requests first land close to the CPU that submitted them. This keeps ordinary request building from fighting over one global queue lock.',
  };

  yield {
    state: blkGraph('Hardware contexts feed real device queues', { hctx0: 'NVMe SQ0', hctx1: 'NVMe SQ1', drv: 'doorbells' }),
    highlight: { active: ['tag', 'hctx0', 'hctx1', 'drv', 'e-tag-hctx0', 'e-tag-hctx1', 'e-hctx0-drv', 'e-hctx1-drv'], found: ['sched'] },
    explanation: 'A hardware context represents a dispatch lane toward the driver. For NVMe, hardware queues often map naturally to controller queue pairs, so blk-mq can keep several SSD queues busy at once.',
  };

  yield {
    state: labelMatrix(
      'blk-mq layers',
      [
        { id: 'bio', label: 'bio' },
        { id: 'req', label: 'req' },
        { id: 'ctx', label: 'ctx' },
        { id: 'hctx', label: 'hctx' },
        { id: 'tag', label: 'tag' },
      ],
      [
        { id: 'role', label: 'role' },
        { id: 'owner', label: 'owner' },
      ],
      [
        ['I/O vec', 'fs/mm'],
        ['sched unit', 'block'],
        ['CPU stage', 'CPU'],
        ['dispatch', 'driver'],
        ['inflight id', 'tagset'],
      ],
    ),
    highlight: { active: ['ctx:role', 'hctx:role', 'tag:role'], compare: ['bio:owner'] },
    explanation: 'The vocabulary is the mechanism. bios describe memory and disk ranges, requests are schedulable block-layer units, ctx and hctx route them, and tags identify inflight requests until completion.',
  };
}

function* tagPressure() {
  yield {
    state: labelMatrix(
      'Inflight tag lifecycle',
      [
        { id: 'free', label: 'free' },
        { id: 'alloc', label: 'alloc' },
        { id: 'send', label: 'send' },
        { id: 'done', label: 'done' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'queue', label: 'queue' },
      ],
      [
        ['bit 0', 'start'],
        ['bit 1', 'owns'],
        ['busy', 'hctx'],
        ['clear', 'wake'],
      ],
    ),
    highlight: { active: ['alloc:state', 'send:state', 'done:state'], found: ['free:queue'] },
    explanation: 'Tags are the block layer capacity ledger. A request must own a tag while it is inflight so the completion path can find request state and so the device queue is not overfilled.',
    invariant: 'No tag, no dispatch. Backpressure starts before the SSD sees the request.',
  };

  yield {
    state: blkGraph('A full tag set stops dispatch before the driver', { tag: 'none free', sched: 'wait', hctx0: 'full', hctx1: 'full' }),
    highlight: { active: ['sched', 'tag', 'hctx0', 'hctx1', 'e-sched-tag'], compare: ['drv'] },
    explanation: 'When every tag is allocated, blk-mq cannot dispatch another request to that queue. The waiting work stays in software queues or scheduler structures instead of becoming unbounded device work.',
  };

  yield {
    state: labelMatrix(
      'Scheduler choices',
      [
        { id: 'none', label: 'none' },
        { id: 'mqdead', label: 'mq-dl' },
        { id: 'bfq', label: 'bfq' },
        { id: 'kyber', label: 'kyber' },
      ],
      [
        { id: 'best', label: 'best for' },
        { id: 'cost', label: 'cost' },
      ],
      [
        ['fast SSD', 'less fair'],
        ['lat cap', 'order'],
        ['desktop', 'policy'],
        ['lat token', 'tune'],
      ],
    ),
    highlight: { active: ['none:best', 'mqdead:best', 'bfq:best'], compare: ['kyber:cost'] },
    explanation: 'blk-mq supports optional schedulers. NVMe often runs with no scheduler, while other devices or workloads may use mq-deadline, BFQ, or another policy to control latency and fairness.',
  };

  yield {
    state: blkGraph('Completion releases the tag and wakes queued work', { tag: 'free one', hctx0: 'CQE', drv: 'complete', sched: 'next req' }),
    highlight: { active: ['drv', 'hctx0', 'tag', 'sched', 'e-hctx0-drv', 'e-sched-tag'], found: ['ctx0', 'ctx1'] },
    explanation: 'The completion path clears the tag, completes the request, and may immediately let another software-queued request move into dispatch. That is why tag accounting directly shapes throughput and tail latency.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'queue routing') yield* queueRouting();
  else if (view === 'tag pressure') yield* tagPressure();
  else throw new InputError('Pick a blk-mq view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The animation shows the Linux block multi-queue path, usually called blk-mq. A bio is a low-level I/O description, a request is the block-layer dispatch unit, a software context stages work near a CPU, and a hardware context feeds a device queue. Active nodes are the current staging or dispatch point, and a found tag means a request now owns an inflight identity and capacity token.',
        {type: 'callout', text: 'blk-mq scales storage by separating CPU-local request staging from hardware dispatch capacity, with tags acting as both inflight identity and backpressure.'},
        {type: 'image', src: 'https://upload.wikimedia.org/wikipedia/commons/6/68/SATA_Express_interface.svg', alt: 'Diagram of storage software layers showing applications, filesystem, AHCI, NVMe, PCIe, and SATA paths', caption: 'SATA Express software architecture showing AHCI and NVMe paths. V4711, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The block layer sits between filesystems, memory management, and storage drivers. Modern CPUs can submit many I/O operations at once, and NVMe devices can accept many commands in parallel. blk-mq exists because one shared queue wastes both shapes of parallelism.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is one request queue per block device. All CPUs submit to that queue, the scheduler orders requests, and the driver dispatches them. This is easy to understand and worked well when disks were slow enough that one software queue was not the bottleneck.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is contention plus device mismatch. Many CPUs mutate the same hot queue, so the kernel spends time coordinating before the device sees work. At the same time, an NVMe controller may expose multiple submission and completion queues, so the software path is narrow while the hardware path is wide.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'blk-mq separates CPU-local staging from hardware dispatch. Software contexts reduce submission contention, while hardware contexts model the device-facing lanes. Tags connect the two: a tag is both the inflight request id used on completion and the finite token that prevents unlimited dispatch.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A filesystem or direct-I/O path submits a bio, and the block layer builds or merges it into a request. The request is staged through a software context, routed to a hardware context, and dispatched only after it obtains a free tag. When the device completes the command, the tag indexes back to the request, the attached bios complete, and the tag returns to the free pool.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The correctness argument has two invariants. First, every inflight request owns exactly one tag until completion, so completion lookup is direct and capacity is bounded. Second, staging can be local without losing device-level control because dispatch still passes through the hardware context and tag allocator before a command reaches the driver.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Submission cost is close to O(1) per request on the common path, but it includes scheduler policy, tag allocation, and driver mapping. More queues reduce lock contention as CPU count grows, but they add state: software contexts, hardware contexts, tag bitmaps, timeouts, affinity maps, and scheduler hooks. Doubling queue depth can improve throughput until the device is saturated, then it mostly increases tail latency and memory pressure.',
      ],
    },
    {
      heading: 'Real-world uses',
      paragraphs: [
        'blk-mq is the normal shape for modern Linux block devices, especially NVMe SSDs. It helps database servers, build machines, virtualized storage, and high-throughput file services where many cores issue I/O at the same time. It also gives cgroups and schedulers a common place to apply fairness and latency policy before work reaches the driver.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'More queues do not fix a workload that issues tiny random I/O with poor locality, nor do they make a slow device fast. Deep queues can hide congestion, inflate p99 latency, and make timeouts harder to interpret. blk-mq also does not provide filesystem ordering by itself; flushes, barriers, journaling, and writeback policy supply those correctness rules.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose a device has two hardware contexts and 64 tags per context. CPU0 submits a read, CPU1 submits a read, and CPU2 submits writeback; each request can be staged near its CPU, then routed to a hardware context. If hardware context 0 has 63 used tags, it can accept one more request; if context 1 has 20 used tags, it has 44 free slots.',
        'When the first read completes, the completion reports tag 17 on hardware context 0. blk-mq uses that tag to find the request without searching all inflight work, completes the bio, clears the tag, and wakes a waiter if one exists. The cost is visible: a completion returns both data status and one unit of dispatch capacity.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Study the Linux blk-mq documentation, the Linux block multi-queue design paper, and the NVMe specification sections on submission and completion queues. Then study queues, ring buffers, backpressure, io_uring rings, readahead, dirty writeback, and cgroup I/O control. A useful trace exercise is page-cache miss to bio, request, tag, hardware queue, driver command, completion, tag release.',
      ],
    },
  ],
};