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
    explanation: 'Eviction selection considers local resource pressure and Pod characteristics. Requests, QoS, priority, and actual usage all matter to the outcome.',
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
      heading: 'What it is',
      paragraphs: [
        'Node-pressure eviction is kubelet-side protection. The kubelet watches local resource signals such as memory, disk, image filesystem, container filesystem, and inodes. When thresholds are crossed, it tries local reclaim and may terminate Pods to prevent node starvation.',
        'The official node-pressure eviction documentation says the kubelet proactively terminates Pods to reclaim resources, monitors memory, disk space, and filesystem inodes, marks selected Pods Failed, and distinguishes node-pressure eviction from API-initiated eviction: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/. The disruptions documentation lists node-pressure eviction as a kubelet termination cause distinct from API eviction and preemption: https://kubernetes.io/docs/concepts/workloads/pods/disruptions/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The useful data structure is a signal ladder. Each node keeps observed values, thresholds, grace periods, reclaim options, and a victim ranking. The kubelet tries node-level reclaim first where possible. If pressure persists, it chooses Pods based on the pressure type and Pod attributes such as requests, QoS, priority, and usage.',
        'This is different from PodDisruptionBudget and drain behavior. The official docs state that node-pressure eviction is not the same as API-initiated eviction and that kubelet does not respect configured PDBs or normal terminationGracePeriodSeconds in the same way. Under hard thresholds, termination can be immediate.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A node fills its image filesystem after repeated deploys. Kubelet observes imagefs pressure and first deletes unused images. The pressure remains because several large images are still referenced by running Pods. Kubelet ranks victims and evicts a low-priority batch Pod. The Pod enters Failed, the owning Job or controller sees the loss, and future work may be scheduled on another node after capacity is available.',
        'The root fix is not just "raise priority." The operator needs image garbage collection policy, disk sizing, ephemeral-storage requests and limits, namespace quota, alerts on pressure signals, and workload designs that can survive local eviction.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes Priority and Preemption Nomination for scheduler-side scarcity, Kubernetes PodDisruptionBudget Eviction Budget for voluntary eviction, Kubernetes ResourceQuota and LimitRange Admission for namespace limits, Linux Page Cache XArray and Linux Working Set Refault Reclaim for lower-level memory pressure, and Load Shedding for the general survival pattern.',
      ],
    },
  ],
};
