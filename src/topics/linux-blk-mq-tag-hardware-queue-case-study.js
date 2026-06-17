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
      heading: 'The problem',
      paragraphs: [
        'The Linux block layer sits between filesystems, memory management, and storage drivers. Higher layers submit bios that describe memory pages and disk ranges. Drivers need concrete requests that can be dispatched to hardware and completed later. The block layer has to merge, schedule, route, limit, and complete that work without becoming the bottleneck.',
        'The old single-queue model was built for a world where disks were slow and a central queue was a reasonable coordination point. Modern systems have many CPUs submitting I/O at the same time and devices such as NVMe SSDs that can process many commands in parallel. A single shared software queue makes the CPU side fight over locks and makes the device side look narrower than it really is.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The naive design has one request queue per block device. Filesystems submit bios, the block layer builds requests, a scheduler orders them, and the driver dispatches them. This gives one place to merge adjacent work, apply fairness, and decide the next request.',
        'That design is easy to reason about, but it serializes too much. Every CPU that submits I/O touches the same queue. Every dispatch decision flows through one coordination point. For spinning disks, careful ordering mattered more than raw parallel dispatch. For fast SSDs, the queue itself can become a larger cost than the media operation.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The first wall is lock contention. A multicore machine can have many application threads, page-cache misses, direct I/O calls, and writeback workers submitting block work at once. If they all mutate one queue, the queue becomes a shared hot spot. The storage stack burns CPU time coordinating before the driver even sees the request.',
        'The second wall is hardware shape. NVMe devices expose submission and completion queues, often with multiple queue pairs. Hardware can accept several independent dispatch streams. A block layer that only models one queue cannot map naturally onto that parallelism. The software path is narrow while the hardware path is wide.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'blk-mq splits the path into software staging and hardware dispatch. Software contexts are close to submitting CPUs. Hardware contexts represent dispatch lanes toward the device driver. The mapping between them lets the block layer preserve CPU locality while feeding the parallel queues that modern storage exposes.',
        'Tags are the other core idea. A tag is an inflight request identifier and a capacity token. A request must own a tag before dispatch. The tag gives the completion path a direct index back to request state, and the finite tag set prevents unlimited work from entering the device. No free tag means the block layer applies backpressure before the driver creates more inflight commands.',
      ],
    },
    {
      heading: 'Vocabulary',
      paragraphs: [
        'A bio is the lower-level description of an I/O operation: memory segments, disk sector ranges, operation type, and related flags. A request is the block-layer scheduling and dispatch unit that may contain one or more bios. The filesystem and memory layers often think in bios; the driver-facing path tends to think in requests.',
        'A ctx is a software queueing context, typically associated with CPU-local staging. An hctx is a hardware context, a dispatch structure mapped toward a hardware queue or group of queues. A tagset manages the identifiers available for inflight requests. These names are not decoration; they are the mechanism blk-mq uses to route work and bound pressure.',
      ],
    },
    {
      heading: 'Queue routing',
      paragraphs: [
        'When a thread submits I/O, blk-mq can stage the request in a context near that CPU. This reduces shared lock traffic during request construction and ordinary queueing. Later, requests are dispatched through a hardware context selected by the device mapping, CPU mapping, scheduler policy, and driver configuration.',
        'For NVMe, the hardware context often corresponds naturally to a controller submission queue path. The driver converts a block request into a device command, places it on a submission queue, and rings a doorbell. Completion comes back through the device completion path, where the tag identifies which request has finished.',
      ],
    },
    {
      heading: 'Tag lifecycle',
      paragraphs: [
        'The tag lifecycle is simple but central. A tag starts free. Dispatch allocates it to a request. While the request is inflight, the tag names the request state. When the device completes the command, blk-mq clears the tag, completes the bios attached to the request, and wakes or schedules more work that was waiting for capacity.',
        'This turns queue depth into an explicit ledger. The device can be kept busy without allowing infinite outstanding work. Completion lookup is direct instead of a search through all inflight requests. Backpressure is local and measurable: if the tag set is exhausted, dispatch stops until a completion returns capacity.',
      ],
    },
    {
      heading: 'Schedulers',
      paragraphs: [
        'blk-mq does not mean every device must run without scheduling policy. It supports optional multi-queue schedulers. Some fast NVMe workloads use none to reduce overhead. Other workloads use mq-deadline, BFQ, Kyber, or device-specific policy to control latency, fairness, starvation, or service guarantees.',
        'The scheduler decision is a tradeoff. Raw throughput favors minimal policy on devices that already reorder internally. Predictable latency and fairness may require a scheduler, especially when multiple cgroups, tenants, or request classes share a device. The queueing structure supplies the lanes; the scheduler decides how work enters them.',
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        'Suppose CPU0 submits a read, CPU1 submits another read, and CPU2 submits writeback. Each request can enter a nearby software context instead of contending on one global queue. The block layer may merge adjacent bios, apply scheduler policy, allocate tags, and route two requests through hardware context 0 and one through hardware context 1.',
        'The NVMe driver places commands on device submission queues. One command completes quickly. The completion reports the tag, blk-mq finds the request state, completes the attached bio, clears the tag bit, and allows another waiting request to dispatch. The important point is that completion both returns a result and returns capacity.',
      ],
    },
    {
      heading: 'What the animation teaches',
      paragraphs: [
        'The queue routing view separates three ideas that are easy to blur. CPUs create work. Software contexts stage that work with locality. Hardware contexts dispatch toward the device. The scheduler and tag allocator sit in the middle because routing is not enough; the layer also needs policy and pressure control.',
        'The tag pressure view shows why tags are more than labels. When tags are available, dispatch can continue. When all tags are owned by inflight requests, the block layer stops pushing new work to that hardware queue. Completion is therefore a scheduling event: clearing one tag may immediately wake the next request.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The locality invariant is that ordinary request staging should avoid unnecessary global contention. Per-CPU or CPU-near contexts keep hot submission paths from constantly fighting over one shared lock. That improves scalability on systems where many cores submit I/O concurrently.',
        'The capacity invariant is that every inflight request owns a tag until completion. That one rule gives blk-mq bounded queue depth, direct completion lookup, and a natural backpressure point. The hardware can stay busy, but the software stack still knows how much outstanding work exists and where each completion belongs.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'The multi-queue design has more moving parts than a single queue. It needs software contexts, hardware contexts, tag maps, scheduler integration, driver mappings, CPU affinity choices, timeout handling, and completion paths. The common path is optimized, but the mental model and tuning surface are larger.',
        'Queue depth is the central tradeoff. Too little depth leaves the device idle and underuses internal parallelism. Too much depth can raise tail latency, hide congestion until it is severe, consume memory, make timeouts harder to interpret, and reduce fairness between workloads. A fast benchmark can still be a poor interactive system if it wins by letting queues grow too deep.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'blk-mq wins on multicore systems with fast storage. It lets many CPUs submit work without routing every operation through a single hot queue, and it lets the driver feed devices that expose multiple dispatch queues. NVMe is the clean example, but the abstraction also helps other block devices that benefit from parallel dispatch and tag-based completion.',
        'It also provides a common bridge between different layers. Filesystems can submit bios, cgroups can apply policy, schedulers can manage fairness, and drivers can talk to hardware queues. blk-mq carries request identity, capacity, and routing across those boundaries.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'More queues do not automatically mean better performance. A slow single-queue device may not benefit much. A workload dominated by fairness policy may need scheduling more than raw dispatch speed. A latency-sensitive workload may need lower queue depth even if a deeper queue improves throughput.',
        'blk-mq also does not promise completion order. Devices and drivers can complete requests out of order, and higher layers must tolerate that where ordering matters. Barriers, flushes, filesystem journaling, and writeback policy are separate correctness mechanisms layered around the request path.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'Common failures include tag starvation, overloaded hardware contexts, mismatched CPU-to-queue affinity, scheduler choices that hurt the actual workload, queue depths that inflate tail latency, and timeout storms when a device stops completing requests. Observability has to distinguish CPU submission contention, scheduler delay, tag wait, driver dispatch, and device service time.',
        'Another failure is treating blk-mq as a magic accelerator. If the upper layer submits tiny random I/O with no locality, if writeback floods the device, or if cgroup policy is misconfigured, the queueing layer can only expose and control pressure. It cannot turn a hostile workload into an efficient storage pattern by itself.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Queue for the baseline abstraction, Ring Buffer for hardware queue shape, Backpressure and Flow Control for tag pressure, NVMe Submission and Completion Queue for the device side, and io_uring Submission and Completion Rings for the user-to-kernel analogue. Readahead and Dirty Writeback explain where many bios originate.',
        'Primary references are the Linux blk-mq documentation and the Linux block multi-queue design paper. A useful exercise is to trace one read from page-cache miss to bio, request, software context, scheduler, tag allocation, hardware context, driver submission, completion, tag release, and wakeup. That path is the whole system in miniature.',
      ],
    },
  ],
};
