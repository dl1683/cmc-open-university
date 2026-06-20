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
    explanation: 'A StorageClass is the policy edge in the binding graph. It chooses the provisioner and sets reclaim, expansion, mount, topology, and binding-time behavior.',
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
    explanation: 'Binding mode chooses when the system commits to a volume location. Immediate is fast but can pick the wrong zone; WaitForFirstConsumer delays that choice until Pod placement is known.',
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
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes is good at replacing Pods. That is exactly why storage needs a separate contract. If a database Pod dies, the replacement should not get a fresh empty directory just because the compute object was disposable.',
        'PersistentVolumeClaims give workloads a stable storage request. PersistentVolumes represent the concrete durable asset. StorageClasses describe the provisioning policy: which driver creates the volume, which parameters it uses, how deletion is handled, whether expansion is allowed, and when topology is chosen.',
        {type:'callout', text:'PV and PVC binding separates the durable storage request from the replaceable Pod, so compute churn does not become data loss.'},
      ],
    },
    {
      heading: 'The obvious approach',
      paragraphs: [
        'A first Kubernetes storage demo often uses hostPath, emptyDir, a manually attached disk, or data baked into an image. Those choices are understandable. They remove the control-plane ceremony and make the first Pod run.',
        'They break when the workload becomes real. A replacement Pod may land on another node. A disk may live in one zone while the scheduler picks another. A manually created volume may not match the requested capacity, access mode, retention rule, or backup policy. The cluster needs a durable identity for the request and a policy for satisfying it.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'The hard part is not mounting a path into a container. The hard part is preserving the storage contract across scheduling, replacement, deletion, resizing, and zone constraints.',
        'Two failures dominate. The first is identity failure: the new Pod does not get the same data. The second is placement failure: the volume is valid, but it cannot attach to the node where the Pod was scheduled. A storage system that ignores either one will look fine in a demo and fail during recovery.',
      ],
    },
    {
      heading: 'The core idea',
      paragraphs: [
        'PV/PVC binding turns storage into a small graph of contracts. A Pod references a PVC. The PVC records the requested capacity, access mode, class, and volume mode. The binder matches it to a PV or asks a provisioner to create one. The PV records the actual backing asset, claim reference, node affinity, reclaim policy, and lifecycle state.',
        'The StorageClass is the policy node in that graph. Kubernetes does not need every application author to know a cloud provider disk API. The application asks for "fast-retain" or "standard-delete"; the class points to the provisioner and carries the cluster policy.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A workload declares a volume that points at a PVC. The PVC either binds to an existing compatible PV or triggers dynamic provisioning through its StorageClass. Once bound, the Pod can mount the claim. The Pod depends on the claim name, not on the provider-specific volume handle.',
        'Binding is stateful. Pending means the request has not found or created usable supply. Bound means the claim and volume are paired. Mounted means the kubelet and storage driver have attached or mounted the backing asset for a Pod. Released means the claim is gone and the reclaim policy decides whether the underlying storage is retained or deleted.',
        'The official Kubernetes docs describe the PV/PVC lifecycle, reclaim policy, node affinity, access modes, and dynamic provisioning through StorageClass. The StorageClass docs also define `volumeBindingMode`, including `Immediate` and `WaitForFirstConsumer`: https://kubernetes.io/docs/concepts/storage/persistent-volumes/, https://kubernetes.io/docs/concepts/storage/storage-classes/, https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/.',
      ],
    },
    {
      heading: 'How the visual model teaches it',
      paragraphs: [
        'In the claim-binding view, follow the edge that becomes active. Pod to PVC is the workload contract. PVC to StorageClass is the policy choice. StorageClass to CSI is the provisioning path. PVC to PV is the durable binding that should survive Pod replacement.',
        'The lifecycle matrix is not decoration. Pending, Bound, Mounted, and Released are different operational questions. A Running Pod is not enough; you need to know which claim it mounted, which PV backs it, whether the reclaim policy matches the data risk, and whether the volume can attach where the scheduler placed the Pod.',
        'In the topology view, watch when the system commits to a zone. Immediate binding chooses storage before the scheduler has all placement facts. `WaitForFirstConsumer` delays binding or provisioning until a Pod exists, so scheduling constraints and storage topology can be solved together.',
      ],
    },
    {
      heading: 'Why it works',
      paragraphs: [
        'The stable object is the claim, not the Pod. If the Pod is replaced, the claim can remain bound to the same PV. For StatefulSets, a volumeClaimTemplate gives each ordinal its own claim identity, so db-0 can return to data-db-0 instead of silently starting with empty state.',
        'Topology-aware binding works because it delays an irreversible choice. A zone-specific volume cannot always move to match a later scheduling decision. With `WaitForFirstConsumer`, the scheduler has the Pod constraints before the storage system selects or provisions the volume.',
        'The correctness argument is a contract argument. If the claim is bound to a PV that satisfies class, capacity, access mode, volume mode, and topology constraints, then the Pod can depend on the claim without knowing the provider-specific storage handle. If any of those fields are wrong, the graph may still bind, but the workload contract is wrong.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'PV/PVC binding adds control-plane work. Dynamic provisioning may call a CSI driver and an external storage API. Attachment and mount can take much longer than creating a container. Expansion depends on the class, driver, filesystem, and whether the workload can tolerate the resize path.',
        'The storage object also has cleanup behavior. `Delete` can remove the backing asset when the claim is deleted. `Retain` leaves manual recovery work, but it protects against accidental data loss. Neither choice is universally right; the workload risk decides.',
        'Access modes are not a database concurrency protocol. They describe how the volume may be mounted. The application still needs its own locking, replication, write-ahead logging, backup, and recovery semantics.',
      ],
    },
    {
      heading: 'Where it wins',
      paragraphs: [
        'PV/PVC binding fits durable volumes attached to Kubernetes workloads: databases, queues, search indexes, model checkpoints, build caches, stateful operators, and systems that need stable per-replica storage identity.',
        'StorageClass is valuable when platform teams want reusable policy. One namespace can request encrypted SSD with Retain, another can request cheap ephemeral-looking volumes with Delete, and neither application needs to call the provider API directly.',
      ],
    },
    {
      heading: 'Where it is the wrong tool',
      paragraphs: [
        'A PVC is the wrong default for stateless services, rebuildable caches, static assets, large shared object datasets, cross-region data products, or anything better served by object storage and application-level replication.',
        'It also does not solve backup, schema migration, quorum, failover, or corruption recovery. Kubernetes can preserve the volume. It cannot prove the bytes inside are correct or recoverable.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A database StatefulSet has three replicas: db-0, db-1, and db-2. Its volumeClaimTemplate creates data-db-0, data-db-1, and data-db-2. The `fast-retain` StorageClass uses a CSI driver, SSD-backed parameters, `Retain` reclaim policy, expansion enabled, and `WaitForFirstConsumer`.',
        'When db-0 is deleted, the replacement Pod still references data-db-0. That claim remains bound to pv-0, so the replacement mounts the same database files. If the cluster scales to db-3, a new claim is created through the same class and waits for scheduling facts before the volume is provisioned in a compatible zone.',
        'The review checklist is concrete: PVC is Bound, PV points at the expected claim, reclaim policy is Retain for critical data, access mode matches the workload, node affinity and zone match placement, expansion is supported if the runbook needs it, and backups prove recovery outside Kubernetes object state.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The dangerous failures are often configuration choices that look harmless: a default StorageClass that points to slow or disposable storage, `Delete` reclaim policy on critical data, `Immediate` binding in a topology-constrained cluster, missing backups, unsupported expansion, or static pre-binding that bypasses the placement you expected.',
        'Debug from the contract outward. Start with the PVC status and events. Check the bound PV, StorageClass, reclaim policy, access modes, capacity, node affinity, CSI provisioner events, attachment events, and the Pod scheduling decision. Do not stop at "the Pod is Pending"; find which edge in the graph could not be satisfied.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Study StatefulSets for stable Pod and claim identity, Kubernetes Scheduler PriorityQueue and Preemption for placement mechanics, ResourceQuota and LimitRange for namespace policy, S3 Object Storage for object durability without Pod attachment, and Write-Ahead Log for the application-level recovery layer a PVC does not provide.',
        'For primary references, use the Kubernetes Persistent Volumes, Storage Classes, and Dynamic Volume Provisioning documentation. Those pages define the binding lifecycle, StorageClass fields, reclaim behavior, topology-aware binding, and dynamic provisioning path.',
      ],
    },
  ],
};
