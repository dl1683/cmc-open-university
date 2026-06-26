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

