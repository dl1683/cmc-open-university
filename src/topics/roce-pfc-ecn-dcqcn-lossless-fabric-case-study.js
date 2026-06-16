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
    explanation: 'RoCEv2 wants Ethernet to behave like a low-loss RDMA fabric. ECN should mark congestion early, PFC should pause a priority only when needed, and headroom must absorb packets already in flight.',
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
    explanation: 'A healthy threshold plan marks ECN before the queue reaches the PFC pause line. If the queue jumps straight to PFC, feedback is too late or traffic is too bursty for the configured headroom.',
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
  references: [
    { title: 'NVIDIA Ethernet Network RoCE configuration', url: 'https://docs.nvidia.com/networking/display/winof2v310/ethernet+network' },
    { title: 'Juniper DCQCN documentation', url: 'https://www.juniper.net/documentation/us/en/software/junos/traffic-mgmt-qfx/topics/topic-map/cos-qfx-series-DCQCN.html' },
    { title: 'NVIDIA RoCE lossless fabric support article', url: 'https://enterprise-support.nvidia.com/s/article/how-to-configure-roce-over-a-lossless-fabric--pfc---ecn--end-to-end-using-connectx-4-and-spectrum--trust-l2-x' },
  ],
  sections: [
    { heading: 'What it is', paragraphs: ['RoCEv2 runs RDMA over Ethernet. To behave like an RDMA fabric for AI traffic, the Ethernet fabric usually needs careful QoS, ECN, PFC, and congestion-control configuration.', 'The data-structure lesson is a queue-control ledger: traffic priority, queue occupancy, ECN threshold, PFC threshold, headroom, pause counters, congestion notifications, and sender rate all have to line up.'] },
    { heading: 'Data structures', paragraphs: ['A useful RoCE fabric record stores DSCP or PCP mapping, priority group, queue depth, ECN marks, PFC pause and resume events, headroom buffers, CNP feedback, rate state, and per-hop counters.', 'NVIDIA documentation says RoCE requires a form of flow control for reliable operation and describes PFC as the normal way to use RoCE. Juniper documentation describes DCQCN as combining ECN and PFC so ECN reduces rate before PFC has to pause traffic.'] },
    { heading: 'How it works', paragraphs: ['ECN is early feedback. When egress queue occupancy crosses the ECN threshold, packets can be marked so the receiver or network path sends congestion feedback and the sender slows down.', 'PFC is a link-level emergency brake. When a priority queue crosses the PFC threshold, a pause frame tells the upstream device to stop sending that priority. Headroom is reserved so packets already in flight do not overflow the queue after the pause is sent.'] },
    { heading: 'Complete case study', paragraphs: ['A GPU cluster shows intermittent all-reduce p99 spikes. The network team checks that RoCE traffic maps to the same no-drop priority end to end, ECN marks start before PFC, pause counters remain rare, and queue histograms do not show sustained headroom exhaustion.', 'The release gate is not just no packet drops. It is low pause rate, stable ECN feedback, bounded queue occupancy, and no congestion spreading into unrelated traffic classes.'] },
    { heading: 'Pitfalls', paragraphs: ['Lossless Ethernet can hide pain by converting drops into pauses. Too much PFC can create head-of-line blocking and congestion spreading. Too little headroom can still drop packets when pause arrives too late.', 'Another trap is configuring hosts without matching the switches, or switches without matching endpoints. ECN and PFC are path properties; one wrong hop can break the control loop.'] },
    { heading: 'Sources and study next', paragraphs: ['Primary sources: NVIDIA RoCE configuration at https://docs.nvidia.com/networking/display/winof2v310/ethernet+network, Juniper DCQCN documentation at https://www.juniper.net/documentation/us/en/software/junos/traffic-mgmt-qfx/topics/topic-map/cos-qfx-series-DCQCN.html, and NVIDIA lossless fabric guide at https://enterprise-support.nvidia.com/s/article/how-to-configure-roce-over-a-lossless-fabric--pfc---ecn--end-to-end-using-connectx-4-and-spectrum--trust-l2-x. Study RDMA Queue Pair, GPUDirect RDMA, NCCL Selector, Backpressure, and TCP Congestion next.'] },
  ],
};
