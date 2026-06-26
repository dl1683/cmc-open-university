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
    { heading: 'How to read the animation', paragraphs: ['Read the ring as a circular ownership table between a network interface card and a driver. A descriptor is a small record that points to a receive buffer and carries completion status.', 'The active descriptor is the next handoff point. When the NIC owns it, packet bytes may be written by DMA; when the driver owns it, the kernel may build a packet object and replenish the buffer.', {type:'callout', text:`RX rings and NAPI turn packet arrival into bounded batches: descriptors transfer ownership from device to driver, while polling budgets keep receive work schedulable.`}, {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/9/9e/Network_card.jpg', alt:'Ethernet network interface card with connectors and controller chip.', caption:'A network interface card is the device side of the RX ring contract, filling DMA buffers before the driver drains completions. Source: Wikimedia Commons, Nixdorf, CC BY-SA 3.0'}] },
    { heading: 'Why this exists', paragraphs: ['A busy network link can deliver packets faster than a CPU should handle as separate interrupt events. Each packet needs memory, metadata, protocol processing, filtering, and delivery to a socket or forwarding path.', 'RX rings and NAPI make receive work bounded. The ring prepares memory before packets arrive, and NAPI polls completed descriptors in batches under a budget.'] },
    { heading: 'The obvious approach', paragraphs: ['The obvious approach is interrupt per packet. A packet arrives, the NIC interrupts the CPU, and the driver immediately processes it.', 'That gives low idle latency on a quiet link. Under load it turns packet arrival into interrupt overhead and can starve useful protocol work.'] },
    { heading: 'The wall', paragraphs: ['The wall is bounded capacity at every stage. The NIC has finite descriptors, the driver has finite poll budget, the kernel has finite backlog, and the application has finite socket buffers.', 'Different overloads look similar from the outside. RX drops can come from ring exhaustion, softirq saturation, wrong CPU affinity, socket pressure, or an application that stopped reading.'] },
    { heading: 'The core insight', paragraphs: ['The descriptor ring is an ownership boundary. The driver posts empty buffers, the NIC fills them with DMA, and completion marks when the driver may consume the packet.', 'NAPI is a scheduling boundary. The interrupt says work exists, and the poll loop drains a bounded batch instead of taking one hard interrupt per packet.'] },
    { heading: 'How it works', paragraphs: ['At setup time, the driver allocates receive buffers, maps them for DMA, and writes descriptors into a circular ring. Hardware and software track producer and consumer positions so neither side reuses a buffer too early.', 'When packets arrive, the NIC writes bytes into posted buffers and marks descriptors complete. The driver poll function walks completions, builds kernel packet objects, sends them upward, and posts fresh buffers back to the ring.', 'The poll function receives a budget. If it drains fewer packets than the budget, it completes the cycle and re-enables receive interrupts; if it uses the whole budget, the kernel can schedule another poll pass.'] },
    { heading: 'Why it works', paragraphs: ['The correctness invariant is exclusive ownership. A descriptor is available to the NIC, completed for the driver, or being replenished, but it is never safely mutated by both sides at once.', 'The performance invariant is bounded work. Ring size bounds device-visible receive memory, poll budget bounds one service turn, and interrupt moderation bounds notification rate under load.'] },
    { heading: 'Cost and complexity', paragraphs: ['Space cost is ring entries times buffer size. A 2,048-entry RX ring with 2 KB buffers reserves about 4 MB for that queue before extra packet metadata.', 'Time cost behaves with packets drained and per-packet stack work. Larger rings absorb bursts but can add queueing delay, while larger budgets improve throughput but can delay other kernel work.'] },
    { heading: 'Real-world uses', paragraphs: ['RX rings and NAPI are core receive-path machinery on Linux servers, routers, storage nodes, load balancers, and container hosts. They are the first bounded queue before packets enter the wider network stack.', 'They also guide debugging. Operators inspect RX drops, budget hits, softirq CPU, RSS queue balance, socket drops, and application read rate to find which bound filled first.'] },
    { heading: 'Where it fails', paragraphs: ['This design does not remove overload. If packets arrive faster than the host can process them, increasing ring size may delay drops while increasing latency.', 'It also fails when the bottleneck is above the driver. A slow firewall rule, expensive eBPF program, small socket buffer, or stalled application can dominate after the ring is healthy.'] },
    { heading: 'Worked example', paragraphs: ['An RX queue has 10 completed descriptors and a NAPI budget of 4. The first poll pass consumes descriptors 0 through 3, builds four packet objects, replenishes four buffers, and leaves six completions ready.', 'Because work remains after the budget is exhausted, the driver does not declare the queue idle. Two more passes with budget 4 can drain the remaining six packets while giving the scheduler chances to run other work between passes.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources are the Linux kernel NAPI documentation and Linux networking scaling documentation. Driver documentation for a specific NIC is needed when tuning descriptor counts and interrupt moderation.', 'Study ring buffers, queues, backpressure, RSS, TCP receive windows, eBPF/XDP, epoll readiness, and NUMA affinity next. The practical skill is finding the first full queue in the receive path.'] },
  ],
};