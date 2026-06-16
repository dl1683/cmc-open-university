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
    explanation: 'The key data structure is a bounded circular queue of descriptors. The NIC advances one side by completing descriptors; the driver advances the other side by consuming and replenishing them.',
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
    explanation: 'If the driver exhausts the budget while packets remain, it returns budget work done so the NAPI instance can be polled again. That keeps one busy queue from monopolizing the CPU forever.',
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
      heading: 'What it is',
      paragraphs: [
        'A NIC receive path is a hardware-software queueing system. The driver prepares a ring of descriptors that point to memory buffers. The NIC receives frames from the wire, DMA-writes packet bytes into those buffers, marks descriptors complete, and signals the CPU. Linux NAPI then lets the driver poll completed descriptors in bounded batches.',
        'The practical lesson is that packet receive performance is mostly ownership and batching. The ring buffer names which buffers the NIC may fill. Completion bits name which buffers the driver may consume. NAPI decides how much receive work can run before the kernel gives other work a chance.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The receive ring is a circular descriptor array. Empty descriptors are owned by the device and point to available buffers. When a packet arrives, the NIC writes bytes into memory, updates status and length fields, and advances its completion side. The driver consumes completed descriptors, builds socket-buffer objects, passes them into the network stack, and posts fresh buffers back to the ring.',
        'NAPI changes the interrupt model. An interrupt schedules a NAPI poll handler. The handler receives a budget and may process only that many receive packets in one poll pass. If the budget is exhausted while work remains, the instance is serviced again. If all work is complete, the driver completes NAPI and receive interrupts can be reenabled.',
      ],
    },
    {
      heading: 'Complete case study: a bursty API server',
      paragraphs: [
        'A server receives a burst of packets on one receive queue. The NIC fills descriptors 0 through 9. The interrupt handler schedules NAPI. With a budget of 4, the driver processes descriptors 0 through 3, creates four socket buffers, sends them toward IP/TCP, refills those descriptors, and returns because the budget is spent. Six packets remain ready, so the kernel schedules another poll pass instead of taking a separate interrupt for every packet.',
        'If the application stops reading, pressure moves upward: TCP receive buffers fill, advertised windows shrink, socket queues grow, and eventually drops appear. The ring is only the first bounded queue in the path.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'The structure is fast because it avoids allocation on every packet and turns many arrivals into a batch. The complexity is in visibility and tuning. Bigger rings absorb bursts but can add latency. Larger poll budgets improve throughput but can starve other work. Interrupt moderation reduces CPU overhead but can delay packets. CPU affinity and receive-side scaling decide whether work spreads across cores.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Linux kernel NAPI documentation at https://docs.kernel.org/networking/napi.html and Linux networking scaling documentation at https://docs.kernel.org/networking/scaling.html. Study Ring Buffer, Queue, Backpressure & Flow Control, TCP Reassembly & SACK Scoreboard, IP FIB Longest-Prefix Match, eBPF Ring Buffer Telemetry Case Study, Cilium eBPF Datapath Case Study, and epoll Interest & Ready List next.',
      ],
    },
  ],
};
