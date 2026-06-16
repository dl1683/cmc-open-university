// Kubernetes PersistentVolume and PersistentVolumeClaim: storage requests bind
// to durable volumes through StorageClass policy and topology-aware scheduling.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-pv-pvc-storage-binding-case-study',
  title: 'Kubernetes PV/PVC Storage Binding Case Study',
  category: 'Systems',
  summary: 'How PersistentVolumeClaims, StorageClasses, dynamic provisioners, PersistentVolumes, reclaim policies, and WaitForFirstConsumer coordinate durable storage.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['claim binding', 'topology binding'], defaultValue: 'claim binding' },
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

function storageGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'pod', label: 'Pod', x: 0.7, y: 3.8, note: notes.pod ?? 'mount' },
      { id: 'pvc', label: 'PVC', x: 2.4, y: 3.8, note: notes.pvc ?? 'request' },
      { id: 'sc', label: 'SC', x: 4.0, y: 2.3, note: notes.sc ?? 'policy' },
      { id: 'prov', label: 'CSI', x: 5.8, y: 2.3, note: notes.prov ?? 'provision' },
      { id: 'pv', label: 'PV', x: 5.8, y: 5.3, note: notes.pv ?? 'volume' },
      { id: 'node', label: 'node', x: 7.7, y: 3.8, note: notes.node ?? 'attach' },
      { id: 'zone', label: 'zone', x: 9.2, y: 2.3, note: notes.zone ?? 'topology' },
      { id: 'data', label: 'data', x: 9.2, y: 5.3, note: notes.data ?? 'durable' },
    ],
    edges: [
      { id: 'e-pod-pvc', from: 'pod', to: 'pvc' },
      { id: 'e-pvc-sc', from: 'pvc', to: 'sc' },
      { id: 'e-sc-prov', from: 'sc', to: 'prov' },
      { id: 'e-prov-pv', from: 'prov', to: 'pv' },
      { id: 'e-pvc-pv', from: 'pvc', to: 'pv' },
      { id: 'e-pv-node', from: 'pv', to: 'node' },
      { id: 'e-node-zone', from: 'node', to: 'zone' },
      { id: 'e-pv-data', from: 'pv', to: 'data' },
    ],
  }, { title });
}

function* claimBinding() {
  yield {
    state: storageGraph('A Pod mounts a claim, not a raw disk'),
    highlight: { active: ['pod', 'pvc', 'e-pod-pvc'], compare: ['pv', 'data'] },
    explanation: 'Persistent storage is split into request and supply. Pods reference PersistentVolumeClaims. Claims bind to PersistentVolumes that represent concrete durable storage.',
    invariant: 'The Pod should depend on the claim contract, not on provider-specific disk details.',
  };

  yield {
    state: storageGraph('StorageClass chooses the provisioner and policy', { sc: 'fast SSD', prov: 'csi driver' }),
    highlight: { active: ['pvc', 'sc', 'prov', 'e-pvc-sc', 'e-sc-prov'], found: ['pv'] },
    explanation: 'A StorageClass names the storage flavor and provisioner. It can carry parameters, reclaim policy, expansion support, mount options, and volumeBindingMode.',
  };

  yield {
    state: labelMatrix(
      'PV and PVC state',
      [
        { id: 'pending', label: 'Pend' },
        { id: 'bound', label: 'Bound' },
        { id: 'used', label: 'Mount' },
        { id: 'done', label: 'Rel' },
      ],
      [
        { id: 'meaning', label: 'mean' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['wait', 'sched'],
        ['match', 'class'],
        ['mount', 'attach'],
        ['gone', 'retain'],
      ],
    ),
    highlight: { active: ['pending:meaning', 'bound:meaning', 'used:meaning'], found: ['done:risk'] },
    explanation: 'The binding lifecycle is a state machine. The important production question is whether the claim is Pending, Bound to the expected PV, mounted on the right node, or Released under the intended reclaim policy.',
  };

  yield {
    state: labelMatrix(
      'Complete case: database data disk',
      [
        { id: 'claim', label: 'claim' },
        { id: 'class', label: 'class' },
        { id: 'pv', label: 'PV' },
        { id: 'pod', label: 'pod' },
      ],
      [
        { id: 'record', label: 'record' },
        { id: 'check', label: 'check' },
      ],
      [
        ['100Gi', 'RWO'],
        ['ssd', 'retain'],
        ['disk', 'bound'],
        ['db-0', 'mount'],
      ],
    ),
    highlight: { active: ['claim:record', 'class:check', 'pv:check'], compare: ['pod:record'] },
    explanation: 'For a database Pod, the claim is part of the durability contract. Access mode, reclaim policy, class, and backup procedure matter as much as whether the Pod becomes Running.',
  };
}

function* topologyBinding() {
  yield {
    state: storageGraph('Immediate binding can pick storage before the scheduler knows the node', { pv: 'zone-a', node: 'zone-b?' }),
    highlight: { active: ['pvc', 'sc', 'pv', 'e-pvc-sc', 'e-pvc-pv'], compare: ['node', 'zone'] },
    explanation: 'Storage has topology. If a volume is created in one zone but the Pod schedules elsewhere, attach can fail or force awkward rescheduling. The binding mode controls when that choice happens.',
  };

  yield {
    state: storageGraph('WaitForFirstConsumer lets scheduling and provisioning meet', { sc: 'Wait', node: 'zone-a', zone: 'chosen' }),
    highlight: { active: ['pod', 'pvc', 'sc', 'node', 'zone', 'e-node-zone'], found: ['prov', 'pv'] },
    explanation: 'With WaitForFirstConsumer, the system delays volume binding or provisioning until a Pod exists. Scheduler constraints and storage topology can be considered together.',
    invariant: 'Topology-aware storage binding is a joint scheduling problem.',
  };

  yield {
    state: labelMatrix(
      'Binding modes',
      [
        { id: 'imm', label: 'Imm' },
        { id: 'wait', label: 'Wait' },
        { id: 'local', label: 'Local' },
        { id: 'multi', label: 'MZ' },
      ],
      [
        { id: 'benefit', label: 'plus' },
        { id: 'risk', label: 'risk' },
      ],
      [
        ['fast', 'zone'],
        ['sched', 'later'],
        ['local', 'lock'],
        ['resil', 'cost'],
      ],
    ),
    highlight: { active: ['wait:benefit', 'local:risk'], compare: ['imm:risk'] },
    explanation: 'The storage class is an operational policy object. It expresses whether fast provisioning, topology alignment, retention, expansion, or cost control matters more for this workload class.',
  };

  yield {
    state: storageGraph('StatefulSet ordinals bind to stable claim identities', { pod: 'db-0', pvc: 'data-db-0', pv: 'pv-0', data: 'kept' }),
    highlight: { active: ['pod', 'pvc', 'pv', 'data', 'e-pod-pvc', 'e-pvc-pv', 'e-pv-data'], found: ['sc'] },
    explanation: 'StatefulSet volumeClaimTemplates create stable claim identities per ordinal. Replacing db-0 should remount data-db-0 rather than silently attaching a new empty disk.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'claim binding') yield* claimBinding();
  else if (view === 'topology binding') yield* topologyBinding();
  else throw new InputError('Pick a Kubernetes PV/PVC view.');
}

export const article = {
  sections: [
    {
      heading: 'What it is',
      paragraphs: [
        'The Kubernetes PersistentVolume subsystem separates storage requests from storage implementation. A PersistentVolumeClaim is a user request for storage. A PersistentVolume is a cluster storage resource. A StorageClass describes provisioner and policy for dynamic provisioning.',
        'The official Persistent Volumes documentation explains that PV and PVC abstract how storage is provided from how it is consumed and that PV lifecycle is independent of any individual Pod: https://kubernetes.io/docs/concepts/storage/persistent-volumes/. The StorageClass documentation describes provisioner, parameters, reclaimPolicy, allowVolumeExpansion, mountOptions, and volumeBindingMode: https://kubernetes.io/docs/concepts/storage/storage-classes/. Dynamic provisioning documentation explains that a PVC can trigger on-demand volume creation through a StorageClass: https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/.',
      ],
    },
    {
      heading: 'Data structures',
      paragraphs: [
        'The useful data structure is a binding graph. Pod points to PVC. PVC points to StorageClass and eventually PV. StorageClass points to a provisioner and policy fields. PV points to the underlying volume handle, reclaim behavior, access modes, capacity, and topology. Scheduler and CSI components use that graph to decide when and where storage can attach.',
        'For stateless workloads this graph is incidental. For databases, queues, search indexes, model checkpoints, and local caches, the graph is part of correctness. Losing the claim-to-volume relationship can mean data loss even when Kubernetes reports that replacement Pods are healthy.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A StatefulSet runs db-0, db-1, and db-2. Each ordinal has a claim created from a volumeClaimTemplate: data-db-0, data-db-1, and data-db-2. The fast-retain StorageClass uses a CSI driver, Retain reclaim policy, and WaitForFirstConsumer. When db-0 is recreated, it mounts data-db-0 again. When the cluster scales, new claims bind through the same class and topology policy.',
        'The operational review checks more than Running Pods. It checks PVC Bound status, PV reclaim policy, access mode, zone, attachment, expansion support, backup coverage, and whether the storage class defaults match the workload. A wrong default StorageClass can quietly place critical state on disposable or slow storage.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study Kubernetes StatefulSet Ordinal Rollout for stable claim identities, Kubernetes ResourceQuota and LimitRange Admission for namespace resource policy, Kubernetes Scheduler PriorityQueue and Preemption for Pod placement, S3 Object Storage for object-store durability tradeoffs, and Write-Ahead Log for why durable state needs careful recovery semantics.',
      ],
    },
  ],
};
