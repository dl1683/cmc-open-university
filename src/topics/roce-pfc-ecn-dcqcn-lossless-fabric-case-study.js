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
  references: [
    { title: 'NVIDIA Ethernet Network RoCE configuration', url: 'https://docs.nvidia.com/networking/display/winof2v310/ethernet+network' },
    { title: 'Juniper DCQCN documentation', url: 'https://www.juniper.net/documentation/us/en/software/junos/traffic-mgmt-qfx/topics/topic-map/cos-qfx-series-DCQCN.html' },
    { title: 'NVIDIA RoCE lossless fabric support article', url: 'https://enterprise-support.nvidia.com/s/article/how-to-configure-roce-over-a-lossless-fabric--pfc---ecn--end-to-end-using-connectx-4-and-spectrum--trust-l2-x' },
  ],
  sections: [
    {
      heading: 'Why this fabric exists',
      paragraphs: [
        'RoCE lets RDMA traffic run over Ethernet. That is useful for AI clusters because the same Ethernet switching ecosystem can carry storage, control traffic, and high-speed GPU communication. With GPUDirect RDMA, a NIC can move data close to GPU memory paths without the same CPU involvement as ordinary socket traffic. Training and inference systems can then use Ethernet for all-reduce, all-to-all, parameter movement, KV cache movement, or storage reads.',
        'The hard part is that RDMA reacts badly to ordinary loss. A dropped packet can trigger recovery paths that are much more expensive than a normal TCP retransmission story, and collective communication makes tail latency contagious. One slow rank can stall the whole group. RoCE lossless fabric exists to keep RDMA queues from dropping under normal operation while still preventing congestion from spreading without control.',
      ],
    },
    {
      heading: 'The naive approach',
      paragraphs: [
        'The first naive plan is to enable PFC and declare the network lossless. Priority Flow Control can pause a priority class before a queue overflows, so it sounds like the whole answer. It is not. PFC is a blunt hop-by-hop brake. If it fires often, congestion can move upstream, unrelated flows in the same priority can be blocked, and a local queue problem can become a wider pause storm.',
        'The second naive plan is to rely on ECN marks alone. ECN is early feedback, but feedback takes time. Packets already in flight still arrive after marking begins. If thresholds, headroom, host settings, or switch mappings are wrong, queues can still hit the PFC line or drop line before senders reduce rate. Lossless Ethernet is not one switch setting. It is an end-to-end queue-control system.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'A healthy RoCE design uses ordered defenses. ECN should warn first. DCQCN-style rate control should make senders slow down after marks are observed. PFC should sit higher as emergency protection. Headroom should absorb packets that arrive after pause is sent. Drop should be outside normal operation. The order matters because each mechanism has a different cost.',
        'ECN is cheap compared with pause because it keeps traffic moving while signaling congestion. DCQCN connects the signal to sender behavior, lowering rate when congestion appears and recovering when queues drain. PFC protects the no-drop promise, but it pays by stopping a priority on an upstream link. The goal is not to show many pause frames. The goal is stable queues with rare pause.',
      ],
    },
    {
      heading: 'How the system works',
      paragraphs: [
        'The system starts with classification. Hosts and switches must agree which traffic belongs to the RoCE no-drop class. That can involve DSCP, PCP, trust mode, priority groups, and queue mapping. If one hop maps traffic differently, the control loop breaks. A packet might avoid the protected queue, lose ECN marking, miss PFC protection, or interfere with traffic that should have been isolated.',
        'Next come thresholds. The ECN threshold is placed below the PFC threshold. When queue occupancy crosses the ECN line, packets are marked instead of dropped. Endpoints receive congestion information and generate feedback that causes senders to reduce rate. In DCQCN, the sender maintains rate-control state, reacts to congestion notifications, and later increases rate when conditions improve.',
        'The PFC threshold is higher. If a queue keeps rising despite ECN feedback, the switch sends a pause frame for that priority to its upstream neighbor. The upstream device stops sending that priority for the pause duration. Headroom buffers packets that were already on the wire and cannot be stopped instantly. If headroom is too small, the queue can still overflow after pause is sent. If headroom is too large or PFC fires too often, usable buffering and fairness suffer.',
      ],
    },
    {
      heading: 'What the visual is proving',
      paragraphs: [
        'The threshold view is proving that the queue has a designed sequence of events. ECN is the early line, PFC is the emergency line, headroom is the absorption zone, and drop is the failure boundary. The lines should not be treated as arbitrary knobs. They encode propagation delay, link speed, packet-in-flight volume, receiver behavior, and how fast senders can respond.',
        'The feedback-loop view is proving the desired shape over time. Queue depth rises, ECN marks appear, sender rate falls, and the queue drains before PFC is needed. If the plot jumps straight to PFC, the feedback loop is late or the burst is too large. If pause stays high after the queue drains, recovery is broken or traffic is mapped into the wrong class. If the queue repeatedly touches headroom, the fabric is technically lossless but operationally unhealthy.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The method works because it separates prevention from protection. ECN and DCQCN prevent persistent congestion by changing source rates. PFC protects the no-drop queue when prevention is too slow. Headroom protects against physical delay. This layered design is stronger than relying on a single mechanism because each layer covers the timing gap left by the previous layer.',
        'It also works because the behavior is observable. Operators can read queue occupancy, ECN mark counters, congestion notifications, PFC pause and resume counters, drops, per-priority rates, and NIC rate-control state. A good fabric has bounded queues, visible ECN activity under load, rare PFC, no drops in the protected class, and no pause spreading into unrelated priorities. Those counters turn lossless from a claim into an audited property.',
      ],
    },
    {
      heading: 'Costs and tradeoffs',
      paragraphs: [
        'Lossless Ethernet trades drops for backpressure. That trade can be correct for RDMA, but it creates new failure modes. Pause can spread congestion upstream. A paused priority can block innocent flows in the same class. Low ECN thresholds can throttle too early and leave bandwidth unused. High ECN thresholds can make PFC do too much work. Large headroom reserves protect against overflow but consume buffer that could have served other queues.',
        'The operational cost is configuration consistency. Hosts, NIC firmware, switch ASICs, DSCP or PCP mappings, trust mode, priority groups, ECN thresholds, PFC thresholds, pause enablement, cable speeds, and DCQCN parameters all have to agree. The system can look correct on one switch and still fail across a real path. That is why per-hop validation is part of the algorithm, not an optional deployment checklist.',
      ],
    },
    {
      heading: 'Real uses and limits',
      paragraphs: [
        'AI clusters use this design when Ethernet carries large collectives, tensor-parallel traffic, MoE all-to-all, storage-to-GPU reads, or KV cache movement. A real incident often looks like intermittent p99 spikes rather than obvious packet loss. The investigation should ask whether RoCE traffic stayed in the protected class end to end, whether ECN appeared before pause, whether pause counters were rare, whether any hop showed drops, and whether one rail or queue became the hotspot.',
        'The limits are strict. RoCE cannot rescue a fabric that is badly oversubscribed for the workload. PFC cannot safely be used as a normal congestion-control strategy. ECN cannot help if endpoints ignore marks or feedback arrives too late. DCQCN cannot stabilize a path with inconsistent marking. Lossless does not mean low latency. A network can drop no packets and still be too slow because backpressure, head-of-line blocking, or bad traffic placement dominates the tail.',
        'A useful production gate therefore tests behavior, not only configuration. Run traffic that resembles the real workload, such as all-reduce, all-to-all, or mixed storage and collective bursts. Record queue depth, ECN marks, pause duration, sender-rate response, drops, and p99 collective time on each hop. The gate should fail when pause is sustained, when one class steals headroom from another, when marks are asymmetric, or when no-drop behavior is bought by unacceptable latency.',
      ],
    },
    {
      heading: 'What to study next',
      paragraphs: [
        'Study RDMA queue pairs, completion queues, work requests, GPUDirect RDMA, priority flow control, explicit congestion notification, DCQCN, switch buffer headroom, traffic classes, NCCL transport selection, and collective communication. Then connect this topic to the NCCL Algorithm Protocol Selector, GPU Collective Topology Placement Planner, AI Rack Topology Power Thermal Ledger, Backpressure, TCP Congestion Control, and SLO-aware LLM Request Router. The practical skill is to explain every pause, mark, and queue rise as part of one control loop.',
        'For deeper work, practice the threshold arithmetic. Given link speed, cable distance, propagation delay, packet size, and reaction time, estimate how much data can arrive after a pause decision. That calculation explains why headroom is a safety budget, not spare throughput capacity.',
      ],
    },
  ],
};
