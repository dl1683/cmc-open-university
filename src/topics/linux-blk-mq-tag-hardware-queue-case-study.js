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
    explanation: 'blk-mq gives each CPU a nearby software staging context and then maps those contexts onto one or more hardware dispatch queues. That removes the old single-queue bottleneck for fast devices.',
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
    explanation: 'The vocabulary matters. bios describe memory ranges and disk ranges, requests are schedulable block-layer units, ctx and hctx route them, and tags identify inflight requests until completion.',
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
      heading: 'What it is',
      paragraphs: [
        'blk-mq is the Linux multi-queue block layer. It was built so fast storage devices could receive many I/O requests in parallel without forcing every CPU and every request through one shared queue. The design separates per-CPU software staging queues from hardware dispatch queues.',
        'The core data structures are practical queueing objects: software contexts, hardware contexts, requests, tag sets, scheduler queues, and driver dispatch callbacks. Together they form the path between page-cache writeback or reads and the device driver.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A filesystem or memory-management path submits bios. The block layer merges or turns them into requests. blk-mq places work in a software context near the submitting CPU, optionally lets an I/O scheduler order it, allocates an inflight tag, and dispatches the request through a hardware context to the driver.',
        'The tag is critical. It identifies request state while the operation is inflight and limits queue depth. When the device completes the request, the completion path uses the tag to find the request, complete it, clear the tag, and let waiting work move forward.',
      ],
    },
    {
      heading: 'Complete case study: NVMe read',
      paragraphs: [
        'A page-cache miss needs a disk read. The request enters blk-mq, receives a tag, and dispatches to an NVMe hardware queue. The NVMe driver converts it into a submission queue entry and rings the SSD doorbell. When the completion queue entry arrives, the driver completes the tagged request, blk-mq frees the tag, and the page cache can mark the folio uptodate.',
        'This is the bridge between Linux Page Cache XArray and NVMe Submission/Completion Queue Case Study. The page cache thinks in file offsets and folios; NVMe thinks in queues and commands; blk-mq translates pressure and identity between them.',
      ],
    },
    {
      heading: 'Pitfalls',
      paragraphs: [
        'Queue depth is both performance and risk. If it is too small, the SSD idles. If it is too large, tail latency can rise, cgroups and fairness can suffer, timeouts become noisy, and memory is consumed by inflight state. The right policy depends on device, workload, scheduler, and latency target.',
        'A second trap is assuming one scheduler fits every device. For fast NVMe, no scheduler can be a good default because the device already has parallel hardware queues. For slower or fairness-sensitive workloads, an I/O scheduler may matter more than raw dispatch speed.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux blk-mq documentation at https://docs.kernel.org/block/blk-mq.html and the Linux block multi-queue paper at https://kernel.dk/blk-mq.pdf. Study Queue, Ring Buffer, Backpressure & Flow Control, Linux Fair Scheduler Run Queue, Linux Page Cache XArray, Readahead & Dirty Writeback, NVMe Submission/Completion Queue, and io_uring Submission & Completion Rings next.',
      ],
    },
  ],
};
