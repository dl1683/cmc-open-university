// NIC receive rings and NAPI: packet arrival as bounded descriptor queues,
// DMA ownership, interrupt moderation, and poll-budgeted kernel work.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'nic-rx-ring-napi-poll-case-study',
  title: 'NIC RX Ring & NAPI Poll Case Study',
  category: 'Systems',
  summary: 'A Linux receive-path case study: the NIC fills a descriptor ring with DMA, the driver schedules NAPI, and a poll budget turns interrupt storms into bounded batches.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['RX descriptor ring', 'NAPI poll budget'], defaultValue: 'RX descriptor ring' },
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

function rxGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'wire', label: 'pkt', x: 0.45, y: 4.0, note: notes.wire ?? 'frames' },
      { id: 'nic', label: 'NIC', x: 2.25, y: 4.0, note: notes.nic ?? 'rx' },
      { id: 'ring', label: 'RX ring', x: 4.2, y: 2.5, note: notes.ring ?? 'descs' },
      { id: 'dma', label: 'DMA buf', x: 4.2, y: 5.6, note: notes.dma ?? 'bytes' },
      { id: 'irq', label: 'IRQ', x: 6.2, y: 4.0, note: notes.irq ?? 'schedule' },
      { id: 'napi', label: 'NAPI', x: 7.8, y: 4.0, note: notes.napi ?? 'budget' },
      { id: 'stack', label: 'TCP/IP', x: 9.45, y: 4.0, note: notes.stack ?? 'skb' },
    ],
    edges: [
      { id: 'e-wire-nic', from: 'wire', to: 'nic', weight: '' },
      { id: 'e-nic-ring', from: 'nic', to: 'ring', weight: '' },
      { id: 'e-nic-dma', from: 'nic', to: 'dma', weight: '' },
      { id: 'e-ring-irq', from: 'ring', to: 'irq', weight: '' },
      { id: 'e-irq-napi', from: 'irq', to: 'napi', weight: '' },
      { id: 'e-napi-stack', from: 'napi', to: 'stack', weight: '' },
      { id: 'e-dma-stack', from: 'dma', to: 'stack', weight: '' },
    ],
  }, { title });
}

function* rxDescriptorRing() {
  yield {
    state: rxGraph('A packet starts as device work, not JavaScript work'),
    highlight: { active: ['wire', 'nic', 'e-wire-nic'], compare: ['ring', 'dma'] },
    explanation: 'A network packet first hits the NIC. The application is not involved yet. The device owns a receive engine, a descriptor ring, and DMA buffers prepared by the driver.',
    invariant: 'The hot path starts as ownership transfer over descriptors, not as a system call.',
  };

  yield {
    state: labelMatrix(
      'RX descriptor ring snapshot',
      [
        { id: 'd0', label: 'desc 0' },
        { id: 'd1', label: 'desc 1' },
        { id: 'd2', label: 'desc 2' },
        { id: 'd3', label: 'desc 3' },
        { id: 'd4', label: 'desc 4' },
      ],
      [
        { id: 'owner', label: 'owner' },
        { id: 'state', label: 'state' },
        { id: 'next', label: 'next action' },
      ],
      [
        ['kernel', 'empty buf', 'NIC may fill'],
        ['kernel', 'empty buf', 'NIC may fill'],
        ['NIC', 'done', 'driver reads'],
        ['NIC', 'done', 'driver reads'],
        ['kernel', 'empty buf', 'reserve'],
      ],
    ),
    highlight: { active: ['d2:state', 'd3:state'], found: ['d0:next', 'd1:next'] },
    explanation: 'The ring holds descriptors, not the whole networking stack. Empty descriptors point at receive buffers. When packets arrive, the NIC DMA-writes bytes into buffers and marks descriptors done.',
  };

  yield {
    state: rxGraph('DMA writes packet bytes; descriptors publish completion', { ring: 'done bits', dma: 'filled', irq: 'edge' }),
    highlight: { active: ['nic', 'ring', 'dma', 'e-nic-ring', 'e-nic-dma'], found: ['irq'] },
    explanation: 'The key data structure is a bounded circular queue of descriptors. The NIC advances the completion side, and the driver advances the consume/refill side, so ownership moves without allocating a new queue node per packet.',
  };

  yield {
    state: labelMatrix(
      'Driver consume and replenish loop',
      [
        { id: 'read', label: 'read done desc' },
        { id: 'build', label: 'build skb' },
        { id: 'pass', label: 'pass up stack' },
        { id: 'refill', label: 'refill desc' },
      ],
      [
        { id: 'data', label: 'data touched' },
        { id: 'why', label: 'why it matters' },
      ],
      [
        ['status + length', 'find packet boundary'],
        ['DMA buffer', 'packet becomes kernel object'],
        ['skb pointer', 'TCP/IP can parse'],
        ['fresh buffer', 'ring does not starve'],
      ],
    ),
    highlight: { active: ['read:data', 'refill:why'], found: ['pass:data'] },
    explanation: 'The driver must both drain and refill. A receive ring that is not replenished runs out of empty descriptors, so the NIC has nowhere to put new frames.',
  };

  yield {
    state: rxGraph('The packet finally enters the protocol stack', { ring: 'reused', dma: 'skb data', irq: 'masked', napi: 'poll done', stack: 'TCP/IP' }),
    highlight: { active: ['napi', 'stack', 'e-napi-stack', 'e-dma-stack'], found: ['ring'] },
    explanation: 'Only after the driver turns completed descriptors into socket buffers does the packet move through IP, TCP, routing, filtering, and eventually socket receive queues.',
  };
}

function* napiPollBudget() {
  yield {
    state: rxGraph('NAPI turns many interrupts into scheduled polling', { irq: 'mask irq', napi: 'scheduled' }),
    highlight: { active: ['irq', 'napi', 'e-irq-napi'], compare: ['wire', 'nic'] },
    explanation: 'Without batching, a busy NIC could interrupt the CPU for every packet. NAPI schedules a poll handler, commonly masks further receive interrupts for that queue, and lets the kernel drain a bounded batch.',
    invariant: 'The poll budget caps receive work per service pass.',
  };

  yield {
    state: labelMatrix(
      'One NAPI poll with budget 4',
      [
        { id: 'before', label: 'before poll' },
        { id: 'take1', label: 'take desc 0' },
        { id: 'take2', label: 'take desc 1' },
        { id: 'take3', label: 'take desc 2' },
        { id: 'take4', label: 'take desc 3' },
        { id: 'after', label: 'after poll' },
      ],
      [
        { id: 'ring', label: 'ring state' },
        { id: 'budget', label: 'budget left' },
      ],
      [
        ['10 ready', '4'],
        ['9 ready', '3'],
        ['8 ready', '2'],
        ['7 ready', '1'],
        ['6 ready', '0'],
        ['work remains', 'reschedule'],
      ],
    ),
    highlight: { active: ['take4:budget', 'after:ring'], found: ['after:budget'] },
    explanation: 'If the driver exhausts the budget while packets remain, it reports budget work done so the NAPI instance can be polled again. The budget is the fairness guard that stops one hot receive queue from monopolizing the CPU.',
  };

  yield {
    state: labelMatrix(
      'Interrupt mode versus polling mode',
      [
        { id: 'idle', label: 'idle link' },
        { id: 'burst', label: 'short burst' },
        { id: 'flood', label: 'sustained flood' },
        { id: 'recover', label: 'ring empty' },
      ],
      [
        { id: 'mode', label: 'mode' },
        { id: 'tradeoff', label: 'tradeoff' },
      ],
      [
        ['interrupts', 'low idle latency'],
        ['schedule NAPI', 'batch work'],
        ['poll again', 'avoid irq storm'],
        ['complete NAPI', 'reenable irq'],
      ],
    ),
    highlight: { active: ['burst:mode', 'flood:mode'], found: ['recover:mode'] },
    explanation: 'NAPI is adaptive. Interrupts wake the CPU when work appears, but heavy receive traffic shifts into polling batches until the queue is drained.',
  };

  yield {
    state: rxGraph('Budgeted polling is backpressure inside the kernel', { ring: 'bounded', irq: 'coalesce', napi: '4 packets', stack: 'next queues' }),
    highlight: { active: ['ring', 'napi', 'stack'], found: ['e-napi-stack'], compare: ['irq'] },
    explanation: 'The driver cannot process infinite packets in one turn. Descriptor ring capacity, poll budget, softirq time, socket buffers, and application reads form a chain of bounded queues.',
  };

  yield {
    state: labelMatrix(
      'Operational signals',
      [
        { id: 'drops', label: 'rx drops' },
        { id: 'budget', label: 'budget hits' },
        { id: 'softirq', label: 'softirq CPU' },
        { id: 'latency', label: 'tail latency' },
      ],
      [
        { id: 'means', label: 'what it suggests' },
        { id: 'next', label: 'next question' },
      ],
      [
        ['rings or stack full', 'which queue overflowed?'],
        ['poll is saturated', 'increase queues or reduce load?'],
        ['CPU receive bound', 'RSS/RPS/XDP tuning?'],
        ['batching delay', 'budget/coalescing too high?'],
      ],
    ),
    highlight: { active: ['drops:means', 'budget:means'], compare: ['latency:next'] },
    explanation: 'Receive-path tuning is queue archaeology. The symptom is often one number, but the cause can be descriptor ring pressure, poll budget, CPU affinity, socket buffers, or an application that is not reading.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'RX descriptor ring') yield* rxDescriptorRing();
  else if (view === 'NAPI poll budget') yield* napiPollBudget();
  else throw new InputError('Pick a NIC receive-path view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        `A server can receive packets at a rate that would overwhelm a naive CPU path. A 10, 25, 100, or 400 Gbit link can deliver bursts where every packet needs memory, metadata, protocol parsing, filtering, routing decisions, and eventual delivery to a socket or forwarding path. If the kernel treated each packet as a fresh, interrupt-driven event with no batching, receive work could consume the machine before the application sees a byte.`,
        `The receive path needs a contract between hardware and software. The NIC must know where it is allowed to DMA packet bytes. The driver must know which buffers have been filled. The kernel must limit how much receive work one hot queue can do before other work gets CPU time. The application should not need to know any of that machinery; it should eventually read from a socket or packet interface.`,
        `NIC RX rings and Linux NAPI solve that problem as a bounded queueing system. The driver gives the device a circular array of descriptors that point at receive buffers. The NIC fills buffers with DMA and marks descriptors complete. NAPI schedules driver polling so bursts are drained in batches instead of one hard interrupt per packet.`,
        {type:'callout', text:`RX rings and NAPI turn packet arrival into bounded batches: descriptors transfer ownership from device to driver, while polling budgets keep receive work schedulable.`},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9e/Network_card.jpg', alt:'Ethernet network interface card with connectors and controller chip.', caption:'A network interface card is the device side of the RX ring contract, filling DMA buffers before the driver drains completions. Source: Wikimedia Commons, Nixdorf, CC BY-SA 3.0'},
      ],
    },
    {
      heading: 'The reasonable first attempt',
      paragraphs: [
        `The simplest design is interrupt-per-packet processing. A packet arrives, the NIC interrupts the CPU, the driver handles the packet immediately, the kernel builds a packet object, and the protocol stack runs. On a quiet link, this design feels ideal. Idle latency is low because the first packet wakes the CPU right away.`,
        `The next simple design is to allocate packet buffers as packets arrive. That is also intuitive because each packet is a separate piece of data. If a packet needs memory, allocate memory. If the stack needs an object, create one. This model resembles normal application programming, where work arrives and code allocates the objects it needs.`,
        `Both designs fail on a busy receive path. Interrupt-per-packet turns packet arrival into CPU overhead. Allocation-on-arrival puts memory management on the hottest path. The system needs prepared buffers, cheap ownership transfer, and batching that adapts between idle and flood conditions.`
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        `The wall is bounded capacity. A NIC cannot put an infinite number of packets into memory. A driver cannot process infinite completions in one turn. The protocol stack cannot enqueue infinite socket buffers. An application cannot fall behind forever without creating backpressure or drops. Every stage in the receive path has a queue, ring, budget, or buffer limit.`,
        `An interrupt storm is one visible failure. If every packet causes a hard interrupt, the CPU spends too much time switching into interrupt handling and too little time draining useful work. A ring starvation failure is different: the driver fails to replenish receive descriptors, so the NIC has no empty buffers for new packets. A softirq saturation failure is different again: the driver drains packets, but network processing consumes a core and latency rises elsewhere.`,
        `This is why receive-path debugging is queue archaeology. The symptom may be "rx drops" or "high packet latency," but the cause can be descriptor pressure, interrupt moderation, NAPI budget exhaustion, CPU affinity, RSS steering, socket buffer limits, TCP flow control, or an application that is simply not reading.`
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        `The core insight is to separate packet arrival from packet processing with two boundaries. The descriptor ring is the ownership boundary between NIC and driver. NAPI is the scheduling boundary between urgent device notification and bounded kernel work. Together they turn a stream of packets into batches of completed descriptors.`,
        `A receive descriptor does not contain the whole networking stack. It usually points to a buffer and carries status fields the device and driver understand. When the descriptor is owned by the NIC, the device may DMA packet bytes into the buffer. When the descriptor is complete, the driver may read status and length, turn the buffer into an skb or page-backed packet representation, pass it upward, and replenish the ring with a fresh buffer.`,
        `NAPI changes the interrupt model. The first interrupt says "work is available." After that, the kernel can poll the queue and drain a bounded number of packets. The budget is the fairness guard. It prevents one busy RX queue from monopolizing CPU time forever while still letting bursts be processed more efficiently than one interrupt per packet.`
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        `The driver initializes an RX queue by allocating or attaching receive buffers, mapping them for DMA, and placing descriptors in a ring. The device and driver maintain producer and consumer positions. The exact register names depend on hardware, but the pattern is stable: one side posts empty buffers, the other side completes buffers after packets arrive.`,
        `When a frame arrives from the wire, the NIC chooses an available descriptor, writes packet bytes into the associated memory buffer with DMA, records metadata such as length and checksum status, and marks the descriptor done. The packet has not yet reached TCP or the application. It is only a completed hardware-software handoff.`,
        `The NIC raises an interrupt or uses an interrupt moderation policy to notify the host that work is available. The driver schedules a NAPI poll instance for that RX queue, commonly masking further receive interrupts while polling is active. The poll function walks completed descriptors, builds packet objects, sends them into the networking stack, and replenishes descriptors with fresh buffers.`,
        `The poll function receives a budget. If it processes fewer packets than the budget and the queue is empty, it completes the NAPI cycle and interrupts can be reenabled. If it consumes the full budget while work remains, it reports that condition so the kernel can schedule another poll pass. The queue keeps draining, but not as unbounded work in one service turn.`
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        `The correctness invariant is ownership. A descriptor is either available for the NIC to fill, completed for the driver to consume, or being replenished before it returns to the NIC. The driver must not hand a buffer to the device and then modify it as if it still owns the contents. The NIC must not write outside the buffers described by the ring. The stack receives packets only after the driver has consumed completion metadata and transferred ownership upward.`,
        `The performance invariant is bounded work. The ring bounds how much receive memory the device can consume. The NAPI budget bounds how much packet work one poll pass can do. Interrupt moderation bounds how often the CPU is disturbed under load. These limits do not remove overload, but they make overload observable and schedulable.`,
        `The abstraction works because each layer sees the right object. The NIC sees descriptors and DMA addresses. The driver sees completions and buffers. The network stack sees skbs or page-backed packet data. The application sees socket bytes or datagrams. No layer needs to parse the private state of every other layer to move a packet forward.`
      ],
    },
    {
      heading: 'Worked example',
      paragraphs: [
        `Suppose an RX ring has ten completed descriptors and the NAPI budget is four. The poll function starts with ten ready packets and four units of receive budget. It consumes descriptor 0, builds a packet object, passes it upward, and replenishes the descriptor. The budget drops to three. It repeats for descriptors 1, 2, and 3. After four packets, six completions remain.`,
        `Because the driver exhausted the budget while work remains, it does not claim the queue is fully drained. The kernel can run another poll pass later. This is not wasted work. It is the fairness rule that keeps one hot queue from blocking unrelated softirq work, timers, scheduler activity, or other receive queues.`,
        `If the next pass drains the remaining six with a larger or repeated budget and the ring becomes empty, the driver completes the NAPI cycle and receive interrupts for that queue can be reenabled. The system returns to low-idle-latency interrupt mode until the next burst arrives.`
      ],
    },
    {
      heading: 'What the animation shows',
      paragraphs: [
        `The RX descriptor ring view follows ownership transfer. Packets arrive at the NIC, packet bytes land in DMA buffers, descriptors publish completion, and the driver turns completed buffers into stack-visible packet objects. The matrix is a snapshot of the ring: some descriptors hold empty buffers the NIC may fill, while others are done and waiting for the driver.`,
        `The NAPI poll-budget view shows the scheduling side. An interrupt schedules polling, the poll handler drains a bounded number of ready descriptors, and remaining work causes another pass instead of an infinite loop. The operational-signal table connects this mechanism to real debugging: drops, budget hits, softirq CPU, and tail latency point to different bottlenecks.`
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        `Processing cost is roughly proportional to packets drained, plus the per-packet work done by checksum handling, GRO, filtering, routing, TCP, socket queuing, and application wakeups. Space cost is proportional to ring size and receive-buffer memory. Bigger rings absorb bursts but can increase queueing latency because packets can wait longer before the driver reaches them.`,
        `Larger NAPI budgets improve throughput under load but can delay other work. Smaller budgets improve fairness but may increase overhead when traffic is heavy. Interrupt moderation reduces CPU cost by coalescing notifications, but it can add latency for packets that wait for the next interrupt or poll cycle. Receive-side scaling can spread queues across cores, but poor steering can make one queue hot while others are idle.`,
        `Zero-copy and page-recycling techniques can reduce memory cost, but they add their own complexity around buffer lifetime. XDP and driver-level filtering can drop or redirect packets before the full stack, but only when the application logic fits that early decision point. Every optimization moves the boundary where packet work becomes visible.`
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        `Descriptor rings and NAPI win on busy Linux servers, gateways, load balancers, storage nodes, packet processors, and container hosts where packet bursts are normal. They let hardware and software exchange buffers without allocating a new queue node per packet, and they turn receive storms into batches that the scheduler can meter.`,
        `They also win as a mental model. When a server drops packets, you can ask where the bounded queue filled: NIC ring, driver backlog, softirq processing, qdisc, socket receive buffer, TCP window, or application loop. The descriptor ring is the first visible queue in that chain, and NAPI is the first fairness control after device notification.`
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        `This mechanism does not make overload disappear. If packets arrive faster than the host can process them, some queue eventually fills or latency grows. Increasing ring size can hide drops for a while but may add delay. Increasing budget can improve throughput but hurt fairness. Reducing interrupt moderation can lower latency but raise CPU overhead.`,
        `It also fails when the bottleneck is above the driver. If the application stops reading, socket buffers fill no matter how well the NIC ring is tuned. If TCP receive windows close, upstream senders slow or retransmit. If a firewall or eBPF program is expensive, softirq CPU can dominate. If RSS is misconfigured, one core can saturate while others have spare capacity.`
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        `Ring exhaustion means the NIC lacks empty descriptors and may drop incoming frames. Budget exhaustion means the queue remains hot after a poll pass and needs more service. Interrupt misconfiguration can cause either too many interrupts under load or too much latency at low traffic. DMA mapping mistakes can corrupt data or force slow paths. Cache and NUMA mismatches can make the CPU spend more time moving packet memory than processing protocol logic.`,
        `Operational counters should be read together. RX drops ask which queue overflowed. NAPI budget hits ask whether the poller is saturated. Softirq CPU asks whether packet processing is consuming a core. Tail latency asks whether batching or queueing is too aggressive. Socket receive drops ask whether the application or protocol stack is the true bottleneck.`
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        `Primary sources: Linux kernel NAPI documentation at https://docs.kernel.org/networking/napi.html and Linux networking scaling documentation at https://docs.kernel.org/networking/scaling.html.`,
        `Study Ring Buffer for circular queue mechanics, Queue for bounded worklists, Backpressure for overload propagation, TCP Reassembly and SACK Scoreboard for higher-level receive ordering, eBPF Ring Buffer Telemetry Case Study for kernel-to-user event queues, Cilium eBPF Datapath Case Study for early packet processing, and epoll Interest and Ready List for the application-facing readiness model.`
      ],
    },
  ],
};
