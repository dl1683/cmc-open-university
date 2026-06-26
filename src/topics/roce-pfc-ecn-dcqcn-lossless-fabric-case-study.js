// RoCEv2 lossless Ethernet is a queue-control problem: ECN should slow flows
// before PFC pause frames freeze a priority and spread congestion.

import { graphState, matrixState, plotState, InputError } from '../core/state.js';

export const topic = {
  id: 'roce-pfc-ecn-dcqcn-lossless-fabric-case-study',
  title: 'RoCE PFC ECN DCQCN Lossless Fabric Case Study',
  category: 'Systems',
  summary: 'RoCE lossless-fabric control: priority queues, ECN thresholds, PFC headroom, pause frames, CNP rate feedback, and congestion-spread ledgers.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['queue thresholds', 'feedback loop'], defaultValue: 'queue thresholds' },
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

function queueGraph(title) {
  return graphState({
    nodes: [
      { id: 'gpu0', label: 'GPU0', x: 0.7, y: 2.2, note: 'sender' },
      { id: 'nic0', label: 'NIC0', x: 2.0, y: 2.2, note: 'RoCE' },
      { id: 'sw', label: 'switch', x: 4.3, y: 3.3, note: 'queue' },
      { id: 'ecn', label: 'ECN', x: 4.3, y: 1.4, note: 'mark' },
      { id: 'pfc', label: 'PFC', x: 4.3, y: 5.2, note: 'pause' },
      { id: 'nic1', label: 'NIC1', x: 6.7, y: 3.3, note: 'recv' },
      { id: 'gpu1', label: 'GPU1', x: 8.1, y: 3.3, note: 'target' },
      { id: 'rate', label: 'rate', x: 2.0, y: 5.2, note: 'DCQCN' },
    ],
    edges: [
      { id: 'e-g0-n0', from: 'gpu0', to: 'nic0', weight: 'DMA' },
      { id: 'e-n0-sw', from: 'nic0', to: 'sw', weight: 'RDMA' },
      { id: 'e-sw-n1', from: 'sw', to: 'nic1', weight: 'lossless' },
      { id: 'e-n1-g1', from: 'nic1', to: 'gpu1', weight: 'DMA' },
      { id: 'e-sw-ecn', from: 'sw', to: 'ecn', weight: 'mark' },
      { id: 'e-sw-pfc', from: 'sw', to: 'pfc', weight: 'pause' },
      { id: 'e-ecn-rate', from: 'ecn', to: 'rate', weight: 'CNP' },
      { id: 'e-rate-n0', from: 'rate', to: 'nic0', weight: 'slow' },
    ],
  }, { title });
}

function* queueThresholds() {
  yield {
    state: labelMatrix(
      'Queue gates',
      [
        { id: 'ecn', label: 'ECN' },
        { id: 'pfc', label: 'PFC' },
        { id: 'head', label: 'head' },
        { id: 'drop', label: 'drop' },
      ],
      [
        { id: 'when', label: 'when' },
        { id: 'action', label: 'action' },
      ],
      [
        ['early', 'mark'],
        ['late', 'pause'],
        ['reserved', 'absorb'],
        ['overflow', 'lost'],
      ],
    ),
    highlight: { active: ['ecn:action', 'pfc:action', 'head:action'], compare: ['drop:action'] },
    explanation: 'Read the rows as ordered queue gates. ECN should mark congestion early, PFC should pause a priority only when needed, and headroom must absorb packets already in flight before overflow becomes loss.',
    invariant: 'ECN must get a chance to slow the sender before PFC is forced to stop the priority class.',
  };

  yield {
    state: queueGraph('Packets enter a lossless priority queue'),
    highlight: { active: ['gpu0', 'nic0', 'sw', 'nic1', 'gpu1', 'e-n0-sw', 'e-sw-n1'], compare: ['ecn', 'pfc'] },
    explanation: 'The traffic class matters. PFC pauses a priority, not the whole link, so RDMA traffic needs correct QoS mapping across hosts and switches.',
  };

  yield {
    state: queueGraph('ECN marking starts before the pause threshold'),
    highlight: { active: ['sw', 'ecn', 'rate', 'e-sw-ecn', 'e-ecn-rate', 'e-rate-n0'], compare: ['pfc'] },
    explanation: 'With DCQCN-style control, ECN marking generates congestion feedback so the sender can reduce rate. The goal is to avoid hitting the PFC pause threshold during normal congestion.',
  };

  yield {
    state: queueGraph('PFC pause is the emergency brake'),
    highlight: { active: ['pfc', 'e-sw-pfc', 'nic0', 'rate'], compare: ['ecn'], found: ['sw'] },
    explanation: 'PFC prevents drops when the queue is too full, but it can spread congestion upstream. Treat pause counters as a warning signal, not as proof that the fabric is healthy.',
  };
}

function* feedbackLoop() {
  yield {
    state: plotState({
      axes: { x: { label: 'time', min: 0, max: 10 }, y: { label: 'queue %', min: 0, max: 100 } },
      series: [
        { id: 'q', label: 'queue', points: [{ x: 0, y: 20 }, { x: 2, y: 38 }, { x: 4, y: 58 }, { x: 6, y: 72 }, { x: 8, y: 52 }, { x: 10, y: 35 }] },
        { id: 'ecn', label: 'ECN', points: [{ x: 0, y: 55 }, { x: 10, y: 55 }] },
        { id: 'pfc', label: 'PFC', points: [{ x: 0, y: 82 }, { x: 10, y: 82 }] },
      ],
      markers: [
        { id: 'mark', x: 4, y: 58, label: 'mark' },
      ],
    }),
    highlight: { active: ['q', 'ecn', 'pfc', 'mark'] },
    explanation: 'Read the queue line against the two horizontal thresholds. A healthy plan marks ECN before the queue reaches PFC. If the line jumps straight to PFC, feedback is too late or the burst is larger than configured headroom.',
  };

  yield {
    state: labelMatrix(
      'Feedback ledger',
      [
        { id: 'pkt', label: 'pkt' },
        { id: 'mark', label: 'mark' },
        { id: 'cnp', label: 'CNP' },
        { id: 'rate', label: 'rate' },
      ],
      [
        { id: 'stored', label: 'stored' },
        { id: 'use', label: 'use' },
      ],
      [
        ['flow id', 'who'],
        ['ECN bit', 'signal'],
        ['fb', 'slow'],
        ['rate', 'shape'],
      ],
    ),
    highlight: { active: ['mark:stored', 'cnp:stored', 'rate:stored'], found: ['rate:use'] },
    explanation: 'The congestion-control data structure connects packets, marks, congestion notifications, and sender rate. Without that ledger, drops and pauses look like isolated switch events.',
  };

  yield {
    state: queueGraph('Mis-tuned PFC can spread congestion'),
    highlight: { active: ['pfc', 'sw', 'e-sw-pfc'], compare: ['rate', 'ecn'], found: ['nic0'] },
    explanation: 'If pause frames fire too often or too early, unrelated flows sharing that priority can be stopped. Lossless does not mean harmless; it means drops are traded for backpressure.',
  };

  yield {
    state: labelMatrix(
      'AI rack gate',
      [
        { id: 'class', label: '' },
        { id: 'ecn', label: '' },
        { id: 'pfc', label: '' },
        { id: 'obs', label: '' },
      ],
      [
        { id: 'data', label: 'item' },
        { id: 'gate', label: 'gate' },
      ],
      [
        ['class', 'DSCP'],
        ['ECN', 'below'],
        ['PFC', 'rare'],
        ['obs', 'alert'],
      ],
    ),
    highlight: { active: ['class:gate', 'ecn:gate', 'pfc:gate', 'obs:gate'] },
    explanation: 'An AI rack validates QoS mapping, ECN thresholds, PFC thresholds, headroom, pause counters, and queue histories before trusting large collective jobs on RoCE.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'queue thresholds') yield* queueThresholds();
  else if (view === 'feedback loop') yield* feedbackLoop();
  else throw new InputError('Pick a RoCE lossless-fabric view.');
}

export const article = {
  sections: [
    { heading: 'How to read the animation', paragraphs: [
      'Read the queue-threshold view from low queue occupancy to high queue occupancy. Active cells show the control currently firing, compare cells show the later emergency control, and the drop row is the failure boundary for the protected traffic class.',
      'In the feedback-loop view, the queue line should cross ECN before it reaches PFC. The safe inference rule is ordered control: mark early, slow senders, pause only when headroom protection is needed.',
    ] },
    { heading: 'Why this exists', paragraphs: [
      'RoCE means RDMA over Converged Ethernet. RDMA means remote direct memory access, where a network interface card can move data with less CPU involvement than ordinary socket traffic.',
      'AI clusters use RoCE for GPU collectives, storage paths, parameter movement, and key-value cache movement because Ethernet is widely deployable. The hard part is that RDMA traffic is sensitive to loss, while Ethernet normally assumes queues can drop when congested.',
      {type:'callout', text:'Lossless RoCE is an ordered queue-control loop where ECN and DCQCN should prevent congestion before PFC becomes emergency protection.'},
    ] },
    { heading: 'The obvious approach', paragraphs: [
      'The obvious approach is to enable Priority Flow Control, or PFC, and call the network lossless. PFC can pause one priority class before a switch queue overflows, so it looks like the direct fix for packet loss.',
      'Another obvious approach is to rely on Explicit Congestion Notification, or ECN, alone. ECN marks packets before dropping them, but sender reaction is delayed by packets already in flight and by feedback latency.',
    ] },
    { heading: 'The wall', paragraphs: [
      'The wall is timing. At 400 Gb/s, a link sends about 50 GB/s, or about 50 MB in one millisecond. If feedback arrives late, a large burst can fill a shallow queue before the sender slows down.',
      'PFC creates its own wall. A pause frame stops a priority on an upstream link, and innocent flows in the same priority can be blocked.',
    ] },
    { heading: 'The core insight', paragraphs: [
      'A healthy fabric uses ordered defenses. ECN marks first, DCQCN converts marks into sender-rate reduction, PFC sits higher as an emergency brake, headroom absorbs packets already in flight, and drops should stay outside normal operation.',
      'DCQCN means Data Center Quantized Congestion Notification. It is a rate-control loop: congestion marks create feedback, and the sender lowers its rate before the queue reaches the pause line.',
    ] },
    { heading: 'How it works', paragraphs: [
      'The system starts with classification. Hosts, NICs, and switches must agree which DSCP or PCP markings map RoCE traffic into the protected priority queue.',
      'The switch marks ECN when queue occupancy crosses the early threshold. Receivers or NIC logic generate congestion feedback, senders reduce rate, and PFC fires only if the queue keeps rising toward overflow.',
    ] },
    { heading: 'Why it works', paragraphs: [
      'It works because prevention and protection cover different timing gaps. ECN and DCQCN prevent persistent congestion by changing source rates, while PFC protects against short bursts that would overflow before feedback takes effect.',
      'The correctness argument is bounded queue occupancy for the no-drop class. If marks happen before pause, sender rates react, headroom covers in-flight packets, and PFC is rare, the protected class can avoid drops under the tested workload.',
    ] },
    { heading: 'Cost and complexity', paragraphs: [
      'The cost is backpressure and configuration coupling. Low ECN thresholds can throttle too early, high ECN thresholds can force PFC, large headroom reserves consume shared buffer, and frequent pause can block unrelated flows.',
      'Operational complexity is high because every hop must agree on traffic class, trust mode, priority group, ECN threshold, PFC threshold, headroom, NIC firmware behavior, and DCQCN parameters.',
    ] },
    { heading: 'Real-world uses', paragraphs: [
      'AI racks use this design for NCCL collectives, tensor-parallel traffic, mixture-of-experts all-to-all, storage-to-GPU reads, and cache movement where packet loss can turn into long stalls.',
      'A production gate should run traffic shaped like the real job and record queue depth, ECN marks, congestion notifications, PFC pause time, drops, sender-rate response, and p99 collective duration per hop.',
    ] },
    { heading: 'Where it fails', paragraphs: [
      'Lossless does not mean low latency. A fabric can drop no packets and still perform badly because pause spreads congestion, head-of-line blocking grows, or traffic is mapped into a crowded priority.',
      'It also fails when the workload is oversubscribed beyond what rate control can stabilize. ECN cannot help if endpoints ignore marks, DCQCN cannot fix inconsistent marking, and PFC cannot safely serve as the normal congestion-control mechanism.',
    ] },
    { heading: 'Worked example', paragraphs: [
      'A 400 Gb/s port has an ECN threshold at 8 MB, a PFC threshold at 20 MB, and 12 MB of headroom. A burst raises the queue from 4 MB to 10 MB, so ECN marks begin. If feedback reduces sender rate within 200 microseconds, about 10 MB can arrive during that delay at full line rate.',
      'Now move ECN to 18 MB with the same burst. The same 200 microseconds can add about 10 MB after marking starts, pushing the queue past 28 MB. PFC fires, upstream traffic pauses, and unrelated RoCE flows in the same priority see tail latency even though no packet dropped.',
    ] },
    { heading: 'Sources and study next', paragraphs: [
      'Primary sources: NVIDIA Ethernet Network RoCE configuration at https://docs.nvidia.com/networking/display/winof2v310/ethernet+network, Juniper DCQCN documentation at https://www.juniper.net/documentation/us/en/software/junos/traffic-mgmt-qfx/topics/topic-map/cos-qfx-series-DCQCN.html, and NVIDIA RoCE lossless fabric support at https://enterprise-support.nvidia.com/s/article/how-to-configure-roce-over-a-lossless-fabric--pfc---ecn--end-to-end-using-connectx-4-and-spectrum--trust-l2-x.',
      'Study RDMA Queue Pairs, GPUDirect RDMA, Priority Flow Control, Explicit Congestion Notification, DCQCN, Switch Buffer Headroom, NCCL Algorithm Protocol Selector, GPU Collective Topology Placement Planner, Backpressure, TCP Congestion Control, and SLO-aware LLM Request Router next.',
    ] },
  ],
};
