// Kubernetes node-pressure eviction: the kubelet watches local resource signals,
// reclaims node resources, then evicts Pods when starvation risk crosses policy.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-node-pressure-eviction-signal-case-study',
  title: 'Kubernetes Node Pressure Eviction Signal Case Study',
  category: 'Systems',
  summary: 'How kubelet monitors memory, disk, imagefs, containerfs, inodes, soft and hard thresholds, local reclaim, QoS, priority, and replacement after eviction.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['signal ladder', 'eviction choice'], defaultValue: 'signal ladder' },
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

function evictionGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'kubelet', label: 'kubelet', x: 0.7, y: 3.8, note: notes.kubelet ?? 'monitor' },
      { id: 'mem', label: 'mem', x: 2.4, y: 2.0, note: notes.mem ?? 'avail' },
      { id: 'disk', label: 'disk', x: 2.4, y: 3.8, note: notes.disk ?? 'space' },
      { id: 'inode', label: 'inode', x: 2.4, y: 5.6, note: notes.inode ?? 'files' },
      { id: 'reclaim', label: 'reclaim', x: 4.5, y: 3.0, note: notes.reclaim ?? 'images' },
      { id: 'rank', label: 'rank', x: 4.5, y: 4.9, note: notes.rank ?? 'victims' },
      { id: 'podA', label: 'pod A', x: 6.6, y: 2.2, note: notes.podA ?? 'Burst' },
      { id: 'podB', label: 'pod B', x: 6.6, y: 4.0, note: notes.podB ?? 'Best' },
      { id: 'ctrl', label: 'ctrl', x: 8.5, y: 3.1, note: notes.ctrl ?? 'replace' },
      { id: 'sched', label: 'sched', x: 8.5, y: 5.1, note: notes.sched ?? 'resched' },
    ],
    edges: [
      { id: 'e-k-mem', from: 'kubelet', to: 'mem' },
      { id: 'e-k-disk', from: 'kubelet', to: 'disk' },
      { id: 'e-k-inode', from: 'kubelet', to: 'inode' },
      { id: 'e-mem-reclaim', from: 'mem', to: 'reclaim' },
      { id: 'e-disk-reclaim', from: 'disk', to: 'reclaim' },
      { id: 'e-reclaim-rank', from: 'reclaim', to: 'rank' },
      { id: 'e-rank-podA', from: 'rank', to: 'podA' },
      { id: 'e-rank-podB', from: 'rank', to: 'podB' },
      { id: 'e-podB-ctrl', from: 'podB', to: 'ctrl' },
      { id: 'e-ctrl-sched', from: 'ctrl', to: 'sched' },
    ],
  }, { title });
}

function* signalLadder() {
  yield {
    state: evictionGraph('The kubelet watches local pressure signals'),
    highlight: { active: ['kubelet', 'mem', 'disk', 'inode', 'e-k-mem', 'e-k-disk', 'e-k-inode'], compare: ['rank'] },
    explanation: 'Node-pressure eviction is local. The kubelet monitors node resources such as memory, disk space, and inodes and acts before the node starves.',
    invariant: 'Eviction is a kubelet survival mechanism, not a voluntary disruption budget flow.',
  };

  yield {
    state: labelMatrix(
      'Signals',
      [
        { id: 'mem', label: 'mem' },
        { id: 'nodefs', label: 'nodefs' },
        { id: 'imagefs', label: 'imgfs' },
        { id: 'inode', label: 'inode' },
      ],
      [
        { id: 'watch', label: 'watch' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['avail', 'OOM'],
        ['bytes', 'write'],
        ['bytes', 'pull'],
        ['free', 'create'],
      ],
    ),
    highlight: { active: ['mem:watch', 'nodefs:watch', 'inode:watch'], found: ['imagefs:risk'] },
    explanation: 'The signals are resource-specific. A node can be fine on memory while failing image pulls because imagefs is full, or fail file creation because inodes are exhausted.',
  };

  yield {
    state: evictionGraph('Kubelet tries node-level reclaim before evicting Pods', { reclaim: 'GC images', rank: 'if still bad' }),
    highlight: { active: ['reclaim', 'rank', 'e-reclaim-rank'], found: ['disk'] },
    explanation: 'Before evicting end-user Pods, kubelet tries reclaim such as deleting unused images when disk pressure is the issue. If pressure remains, it ranks Pods for eviction.',
  };

  yield {
    state: labelMatrix(
      'Threshold policy',
      [
        { id: 'soft', label: 'soft' },
        { id: 'hard', label: 'hard' },
        { id: 'grace', label: 'grace' },
        { id: 'poll', label: 'poll' },
      ],
      [
        { id: 'job', label: 'job' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['warn', 'delay'],
        ['stop', '0s'],
        ['bound', 'late'],
        ['sample', 'miss'],
      ],
    ),
    highlight: { active: ['soft:job', 'hard:job', 'grace:job'], compare: ['poll:risk'] },
    explanation: 'Soft thresholds allow a grace period. Hard thresholds act immediately. The exact policy changes how much time a Pod has after the node crosses danger levels.',
  };
}

function* evictionChoice() {
  yield {
    state: evictionGraph('When reclaim fails, kubelet ranks victim Pods', { rank: 'choose', podA: 'keep?', podB: 'evict' }),
    highlight: { active: ['rank', 'podB', 'e-rank-podB'], compare: ['podA'] },
    explanation: 'The kubelet is choosing the cheapest Pod loss that relieves the breached local resource. Requests, QoS, priority, and actual usage decide which eviction best preserves node survival.',
  };

  yield {
    state: labelMatrix(
      'Victim ledger',
      [
        { id: 'qos', label: 'QoS' },
        { id: 'req', label: 'req' },
        { id: 'use', label: 'use' },
        { id: 'prio', label: 'prio' },
      ],
      [
        { id: 'helps', label: 'helps' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['protect', 'Best'],
        ['right', 'zero'],
        ['low', 'spike'],
        ['high', 'abuse'],
      ],
    ),
    highlight: { active: ['qos:helps', 'req:helps', 'prio:helps'], compare: ['use:risk'] },
    explanation: 'Good requests are eviction hygiene. A workload with no requests is easier to classify as expendable under pressure, and bursty usage can make it the cheapest way to save the node.',
  };

  yield {
    state: evictionGraph('Evicted Pods become Failed and controllers replace them', { podB: 'Failed', ctrl: 'new pod', sched: 'elsewhere' }),
    highlight: { active: ['podB', 'ctrl', 'sched', 'e-podB-ctrl', 'e-ctrl-sched'], found: ['rank'] },
    explanation: 'During node-pressure eviction, selected Pods are failed and terminated. If a Deployment or StatefulSet owns them, the control plane creates replacements that re-enter scheduling.',
  };

  yield {
    state: labelMatrix(
      'Complete case: imagefs full',
      [
        { id: 'sig', label: 'sig' },
        { id: 'gc', label: 'GC' },
        { id: 'evict', label: 'evict' },
        { id: 'fix', label: 'fix' },
      ],
      [
        { id: 'event', label: 'event' },
        { id: 'lesson', label: 'lesson' },
      ],
      [
        ['imgfs', 'watch'],
        ['images', 'first'],
        ['batch', 'last'],
        ['quota', 'root'],
      ],
    ),
    highlight: { active: ['sig:event', 'gc:lesson', 'evict:event'], found: ['fix:lesson'] },
    explanation: 'If imagefs fills, kubelet first removes unused images. If pressure stays above threshold, it evicts lower-value Pods. The durable fix is right-sized disk, image cleanup, requests, and workload admission controls.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'signal ladder') yield* signalLadder();
  else if (view === 'eviction choice') yield* evictionChoice();
  else throw new InputError('Pick a Kubernetes node-pressure eviction view.');
}

export const article = {
  sections: [
    {
      heading: 'How to read the animation',
      paragraphs: [
        'The signal-ladder view shows the kubelet, which is the Kubernetes agent on each node, acting as a local controller. Active nodes are being sampled or acted on. The path means observe a resource signal, compare it with thresholds, reclaim cheap resources, and evict a Pod only if pressure remains.',
        'The eviction-choice view separates local survival from global replacement. The kubelet evicts on the bad node; controllers and the scheduler later create and place replacement Pods. The safe inference is that a highlighted ranking step means the kubelet is choosing the least costly candidate for the breached resource, not rescheduling the workload itself.',
        {type:'callout', text:'Node pressure eviction is a local survival ladder: observe the breached resource, reclaim what is cheap, then evict the lowest value Pod that relieves it.'},
        {type:'image', src:'https://upload.wikimedia.org/wikipedia/commons/b/be/Kubernetes.png', alt:'Diagram of a Kubernetes control plane connected to worker nodes with kubelet components and Pods.', caption:'High level Kubernetes architecture diagram by Khtan66, Wikimedia Commons, CC BY-SA 4.0.'},
      ],
    },
    {
      heading: 'Why this exists',
      paragraphs: [
        'The Kubernetes scheduler makes an admission decision before a Pod runs. It compares requests, which are declared resource needs, with node capacity. After placement, real memory use, logs, writable layers, image pulls, inode use, and process counts can diverge from what was requested.',
        'A node can fail while the rest of the cluster has spare capacity. If memory, disk, or process IDs run out, the kubelet and runtime may lose the ability to manage Pods. Node-pressure eviction exists so the kubelet can protect the node before Linux or the filesystem fails in an unranked way.',
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'The obvious approach is to trust the scheduler and the operating system. The scheduler already avoids admitting requests above capacity, and Linux already has memory reclaim, cgroups, and an OOM killer. For quiet clusters with honest requests, this can look sufficient.',
        'Another approach is to overprovision every node. That buys headroom, but it does not say which workload should lose first when pressure still arrives. It also does not cover local disk and inode pressure caused by images, logs, and writable container layers.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The wall is the gap between requested resources and actual node pressure. A Pod can request 256 MiB and use 1.5 GiB. Forty such Pods can create a memory incident even though scheduling looked legal.',
        'The operating system does not know Kubernetes intent. The OOM killer ends a process, not a workload ranked by priority, request honesty, and QoS behavior. A disk-full error hits whichever write arrives next, not the Pod whose writable layer caused the pressure.',
      ],
    },
    {
      heading: 'The core insight',
      paragraphs: [
        'Node-pressure eviction is a resource-specific survival ladder. The kubelet observes signals such as memory.available, nodefs.available, imagefs.available, inode availability, and pid availability. Each breached signal points to reclaim or eviction work that can actually relieve that resource.',
        'The invariant is node survival with ranked loss. The kubelet should either recover the pressured resource by reclaiming unused local state or evict the lowest-value Pod whose removal helps that exact pressure. Removing a random Pod is cheaper to implement but may not free the scarce resource.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'The kubelet samples local signals on its housekeeping loop. Hard thresholds trigger action immediately on the next pass. Soft thresholds require the signal to remain bad for a configured grace period, which avoids evicting for short spikes.',
        'Before evicting live Pods, the kubelet tries reclaim where reclaim exists. Under disk pressure it can garbage-collect dead containers and unused images. Under memory pressure there is no equivalent cheap pile of dead memory, so eviction usually becomes the reclaim mechanism.',
      ],
    },    {
      heading: 'Why it works',
      paragraphs: [
        'Correctness comes from preserving a ranking rule tied to the scarce resource. For memory, Pods above their memory requests are considered before Pods within their requests, then lower priority loses before higher priority, and usage above request breaks ties. That protects a 2 GiB Pod that asked for 2 GiB from a 0-request Pod bursting to 800 MiB.',
        'The event and status update complete the control loop. The evicted Pod is marked Failed with reason Evicted, and its owner can create a replacement. The replacement is a new scheduling problem, which keeps local node protection separate from cluster-level recovery.',
      ],
    },
    {
      heading: 'Cost and complexity',
      paragraphs: [
        'Steady-state CPU cost is small because each kubelet reads local cgroup and filesystem statistics periodically. The larger cost is latency and availability after eviction. A replacement Pod may need image pull time, volume attach time, container start time, and readiness probe time before it serves traffic.',
        'Cost behaves differently for hard and soft thresholds. A hard memory threshold can act within one housekeeping interval, often around seconds. A soft threshold with a 90 second grace period avoids churn from short spikes but waits longer before protecting the node.',
      ],
    },    {
      heading: 'Real-world uses',
      paragraphs: [
        'Node-pressure eviction fits mixed clusters where services, batch jobs, system agents, and build tasks share nodes. Priority and requests let the platform express that monitoring agents and user-facing services should survive longer than low-priority batch Pods. It is also central for CI runners and ML nodes that pull large images and write large temporary files.',
        'It is useful for incident forensics because the eviction event names the signal and chosen Pod. A good report says imagefs.available crossed 15 percent, image garbage collection freed 2 GiB, pressure remained, and the kubelet evicted the low-priority Pod with 6 GiB of writable layer. That is more useful than a mystery restart.',
      ],
    },
    {
      heading: 'Where it fails',
      paragraphs: [
        'Eviction is not capacity planning. If a 60 GiB image filesystem normally holds 55 GiB of images, the kubelet will keep reclaiming and evicting. Automation hides the sizing error by spending workload availability.',
        'PodDisruptionBudgets do not protect against node-pressure eviction because the disruption is involuntary. Eviction can also lose races to sudden memory spikes; the kernel can end a container before kubelet observes and ranks the pressure. Bad or missing requests make the ranking less meaningful.',
      ],
    },    {
      heading: 'Worked example',
      paragraphs: [
        'A node has 16 GiB allocatable memory and a hard eviction threshold of memory.available below 500 MiB. It runs service-a at priority 100 with request 4 GiB and usage 4.2 GiB, service-b at priority 100 with request 2 GiB and usage 2.1 GiB, and batch-c at priority 10 with request 0 and usage 5 GiB. Daemons and other Pods use the remaining memory, leaving 300 MiB available.',
        'The kubelet sees 300 MiB below 500 MiB, so memory pressure is breached. There is no cheap image-style memory reclaim, so it ranks Pods. batch-c is 5 GiB above request and has lower priority, so evicting it can restore about 5 GiB and bring memory.available near 5.3 GiB.',
        'The correctness argument is visible in the numbers. service-a is larger than batch-c only in declared importance and request honesty; it is only 200 MiB above request. Evicting batch-c punishes burst over request and relieves the breached resource more directly.',
      ],
    },
    {
      heading: 'Sources and study next',
      paragraphs: [
        'Primary sources: Kubernetes node-pressure eviction at https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/, Pod disruptions at https://kubernetes.io/docs/concepts/workloads/pods/disruptions/, and resource management at https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/.',
        'Study Linux cgroups, Kubernetes requests and limits, QoS classes, PriorityClass, PodDisruptionBudget, kubelet configuration, image garbage collection, and load shedding next. The recurring idea is controlled loss before uncontrolled failure.',
      ],
    },
  ],
};