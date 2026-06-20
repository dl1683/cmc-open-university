// Kubernetes garbage collection: owner references create a dependency graph,
// finalizers delay deletion, and propagation policy controls cleanup order.

import { graphState, matrixState, InputError } from '../core/state.js';

export const topic = {
  id: 'kubernetes-owner-reference-garbage-collection-case-study',
  title: 'Kubernetes Owner Reference Garbage Collection Case Study',
  category: 'Systems',
  summary: 'How ownerReferences form a dependency graph, finalizers block deletion for cleanup, and foreground, background, or orphan propagation decide dependent-object collection.',
  controls: [
    { id: 'view', label: 'View', type: 'select', options: ['owner graph', 'finalizer cleanup'], defaultValue: 'owner graph' },
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

function gcGraph(title, notes = {}) {
  return graphState({
    nodes: [
      { id: 'owner', label: 'owner', x: 0.7, y: 4.2, note: notes.owner ?? 'Deployment' },
      { id: 'rs', label: 'RS', x: 2.6, y: 2.8, note: notes.rs ?? 'dependent' },
      { id: 'pod', label: 'Pod', x: 4.4, y: 2.8, note: notes.pod ?? 'child' },
      { id: 'svc', label: 'Svc', x: 2.6, y: 5.6, note: notes.svc ?? 'separate' },
      { id: 'oref', label: 'ownerRef', x: 4.4, y: 5.6, note: notes.oref ?? 'uid' },
      { id: 'delete', label: 'delete', x: 6.2, y: 4.2, note: notes.delete ?? 'timestamp' },
      { id: 'gc', label: 'GC', x: 7.8, y: 4.2, note: notes.gc ?? 'sweep' },
      { id: 'done', label: 'done', x: 9.3, y: 4.2, note: notes.done ?? 'removed' },
    ],
    edges: [
      { id: 'e-owner-rs', from: 'owner', to: 'rs' },
      { id: 'e-rs-pod', from: 'rs', to: 'pod' },
      { id: 'e-rs-oref', from: 'rs', to: 'oref' },
      { id: 'e-pod-oref', from: 'pod', to: 'oref' },
      { id: 'e-svc-oref', from: 'svc', to: 'oref' },
      { id: 'e-oref-delete', from: 'oref', to: 'delete' },
      { id: 'e-delete-gc', from: 'delete', to: 'gc' },
      { id: 'e-gc-done', from: 'gc', to: 'done' },
    ],
  }, { title });
}

function* ownerGraph() {
  yield {
    state: gcGraph('Owner references turn objects into a cleanup graph'),
    highlight: { active: ['owner', 'rs', 'pod', 'oref', 'e-owner-rs', 'e-rs-pod'], compare: ['svc'] },
    explanation: 'Kubernetes ownerReferences record which object owns another object. Garbage collection uses that graph to clean dependents when their owner is deleted.',
    invariant: 'Labels select related objects; ownerReferences express cleanup authority.',
  };

  yield {
    state: labelMatrix(
      'Owner reference fields',
      [
        { id: 'uid', label: 'uid' },
        { id: 'kind', label: 'kind' },
        { id: 'name', label: 'name' },
        { id: 'ctrl', label: 'ctrl' },
      ],
      [
        { id: 'value', label: 'value' },
        { id: 'why', label: 'why' },
      ],
      [
        ['abc123', 'identity'],
        ['ReplicaSet', 'type'],
        ['web-7cc', 'debug'],
        ['true', 'main owner'],
      ],
    ),
    highlight: { active: ['uid:why', 'ctrl:why'], found: ['kind:why', 'name:why'] },
    explanation: 'The UID matters because names can be reused. A dependent should point at the exact owner instance, not merely another object that later received the same name.',
  };

  yield {
    state: labelMatrix(
      'Propagation policy',
      [
        { id: 'fg', label: 'foreground' },
        { id: 'bg', label: 'background' },
        { id: 'orphan', label: 'orphan' },
        { id: 'default', label: 'default' },
      ],
      [
        { id: 'order', label: 'order' },
        { id: 'effect', label: 'effect' },
      ],
      [
        ['children first', 'wait'],
        ['owner first', 'GC later'],
        ['keep kids', 'detach'],
        ['resource', 'varies'],
      ],
    ),
    highlight: { active: ['fg:effect', 'bg:effect', 'orphan:effect'], compare: ['default:order'] },
    explanation: 'Deletion propagation controls order. Foreground deletion waits on dependents, background deletion lets garbage collection continue after the owner is gone, and orphaning leaves dependents behind.',
  };

  yield {
    state: gcGraph('Complete case: deleting a Deployment cleans ReplicaSets and Pods', { delete: 'foreground', gc: 'children first', done: 'tree gone' }),
    highlight: { active: ['owner', 'rs', 'pod', 'delete', 'gc', 'done'], found: ['e-delete-gc', 'e-gc-done'] },
    explanation: 'Deleting a Deployment can cascade to ReplicaSets and Pods through the owner graph. The garbage collector follows references rather than guessing from labels alone.',
  };
}

function* finalizerCleanup() {
  yield {
    state: gcGraph('A finalizer turns delete into a two-phase operation', { delete: 'timestamp', gc: 'blocked', done: 'wait' }),
    highlight: { active: ['delete', 'gc'], removed: ['done'], found: ['owner'] },
    explanation: 'When an object has finalizers, deletion sets deletionTimestamp but does not remove the object immediately. A controller must finish cleanup and remove its finalizer key.',
  };

  yield {
    state: labelMatrix(
      'Finalizer ledger',
      [
        { id: 'mark', label: 'mark' },
        { id: 'clean', label: 'clean' },
        { id: 'remove', label: 'remove' },
        { id: 'collect', label: 'collect' },
      ],
      [
        { id: 'state', label: 'state' },
        { id: 'owner', label: 'actor' },
      ],
      [
        ['timestamp', 'API'],
        ['external', 'ctrl'],
        ['finalizer', 'ctrl'],
        ['object', 'GC'],
      ],
    ),
    highlight: { active: ['mark:state', 'clean:state', 'remove:state'], found: ['collect:state'] },
    explanation: 'Finalizers are not callbacks executed by Kubernetes. They are keys that tell controllers to do cleanup before the API server is allowed to complete deletion.',
  };

  yield {
    state: gcGraph('Stuck finalizers are visible but require ownership review', { delete: 'old mark', gc: 'blocked', done: 'stuck' }),
    highlight: { active: ['delete', 'gc'], removed: ['done'], compare: ['svc'] },
    explanation: 'A stale finalizer can leave objects terminating forever. Removing it manually may leak external resources, so operators need to know which controller owns the key and what cleanup is pending.',
  };

  yield {
    state: labelMatrix(
      'Pitfalls',
      [
        { id: 'label', label: 'label' },
        { id: 'uid', label: 'name only' },
        { id: 'cross', label: 'cross-ns' },
        { id: 'final', label: 'finalizer' },
      ],
      [
        { id: 'bad', label: 'bad' },
        { id: 'fix', label: 'fix' },
      ],
      [
        ['not ownership', 'ownerRef'],
        ['wrong object', 'use UID'],
        ['invalid owner', 'scope rules'],
        ['stuck delete', 'controller'],
      ],
    ),
    highlight: { active: ['label:bad', 'uid:bad'], found: ['cross:fix', 'final:fix'] },
    explanation: 'The cleanup graph is only as good as its edges. Confusing labels with ownership, ignoring UID, or adding finalizers without a reliable controller creates deletion debt.',
  };
}

export function* run(input) {
  const view = String(input.view);
  if (view === 'owner graph') yield* ownerGraph();
  else if (view === 'finalizer cleanup') yield* finalizerCleanup();
  else throw new InputError('Pick a Kubernetes garbage-collection view.');
}

export const article = {
  sections: [
    {
      heading: 'Why this exists',
      paragraphs: [
        'Kubernetes objects rarely live alone. A Deployment creates ReplicaSets. A ReplicaSet creates Pods. A custom resource can create Jobs, Secrets, ConfigMaps, and cloud-side resources through a controller.',
        'Deletion needs the same structure as creation. If the parent disappears and the cluster has no durable ownership record, children can leak forever or be deleted by guesswork. Owner references give Kubernetes a cleanup graph that survives controller restarts.',
        {type:'callout', text:'Owner references encode cleanup authority as UID edges, while finalizers preserve deletion work that garbage collection cannot perform alone.'},
      ],
    },
    {
      heading: 'The baseline approach',
      paragraphs: [
        'The easy approach is to clean children by label or name. A controller could delete every Pod with app=web when the Deployment is deleted. That works in tiny examples because labels often look like ownership.',
        'Labels are selectors, not lifetime contracts. A Service selects Pods by label without owning them. A monitor, policy engine, rollout controller, and human operator can all use the same labels for different reasons. Names are also unsafe because Kubernetes can reuse a name after the old object is gone.',
      ],
    },
    {
      heading: 'The wall',
      paragraphs: [
        'Cleanup by convention fails when relationships overlap. The same Pod can be selected by a Service, observed by a monitor, matched by a NetworkPolicy, and owned by a ReplicaSet. Only one of those relationships should decide lifetime.',
        'Deletion also crosses time. A controller can crash after creating children. An owner can be deleted while children still exist. A new object can later reuse an old name. The cleanup system needs immutable identity and an explicit edge, not a fresh search over labels.',
      ],
    },
    {
      heading: 'Core insight',
      paragraphs: [
        'The data structure is a directed dependency graph. The edge is stored on the dependent object in metadata.ownerReferences. Each reference names the owner API version, kind, name, UID, controller flag, and blockOwnerDeletion flag.',
        'UID is the important field. Names help humans debug, but UID identifies the exact owner instance. A Pod should point to the ReplicaSet that actually created it, not to whatever object later receives the same name.',
        'Finalizers are a separate deletion ledger. A finalizer is a string key on an object that says physical removal must wait. It is not a callback. It is durable state that a controller must observe, act on, and remove when cleanup is complete.',
        'The insight is that cleanup needs two different records: ownership edges for in-cluster dependents and finalizer keys for work outside ordinary garbage collection. Mixing them up creates either leaks or unsafe deletion.',
      ],
    },
    {
      heading: 'How it works',
      paragraphs: [
        'A delete request usually marks the object with a deletionTimestamp before storage removes it. Garbage collection then applies the propagation policy. Background deletion lets the owner disappear first and removes dependents afterward. Foreground deletion keeps the owner visible until blocking dependents are gone. Orphan deletion detaches dependents instead of deleting them.',
        'The garbage collector watches owners and dependents, builds the graph from ownerReferences, and follows explicit edges. It does not infer ownership from labels, selectors, or name prefixes.',
        'Finalizers turn deletion into a two-phase operation. First the API server records deletionTimestamp and keeps the object. Then the responsible controller sees the object is terminating, performs cleanup, and removes its finalizer key. Only after all finalizers are gone can the object be physically removed.',
      ],
    },
    {
      heading: 'Concrete examples',
      paragraphs: [
        'A Deployment owns ReplicaSets, and ReplicaSets own Pods. Deleting the Deployment can cascade through those owner edges. A Service that selects the same Pods is not an owner, so it should not be deleted just because the Pods match its selector.',
        'A database custom resource may create a cloud disk. An ownerReference can clean up child Kubernetes objects, but it cannot delete the external disk by itself. The database controller needs a finalizer so it can delete or detach the disk before Kubernetes removes the custom resource record.',
      ],
    },
    {
      heading: 'Why it is reliable',
      paragraphs: [
        'The correctness argument starts with identity. Owner edges target UID, so name reuse does not transfer ownership to a different object. The garbage collector follows the graph that existed in object metadata rather than recomputing a relationship from mutable labels.',
        'The deletion state is monotonic. Once deletionTimestamp is set, the object is on its way out. Controllers should make cleanup idempotent because they may observe the terminating object more than once. Removing the finalizer is the commit point that says cleanup no longer needs the object to remain stored.',
        'Propagation policy makes ordering explicit. Foreground deletion is useful when the owner should not vanish until dependents are gone. Background deletion is faster for the caller but cleanup continues after the owner disappears. Orphaning is a deliberate escape hatch, not an accident.',
      ],
    },
    {
      heading: 'Cost and behavior',
      paragraphs: [
        'Garbage collection costs watches, graph maintenance, and eventual cleanup work. The cost grows with object count and reference churn, not with a single local pointer update.',
        'Foreground deletion trades caller latency for stronger ordering. Background deletion returns sooner but leaves cleanup visible later. Finalizers add another delay because Kubernetes must wait for user-space controller code.',
        'A finalizer is only as reliable as the controller that owns it. If the controller is gone, misconfigured, or blocked by permissions, the object can remain in Terminating forever.',
      ],
    },
    {
      heading: 'Where it wins and fails',
      paragraphs: [
        'Owner references work well for in-cluster lifetime relationships: Deployment to ReplicaSet, ReplicaSet to Pod, Job to Pod, and custom resources to child Kubernetes objects. They make cleanup automatic when the parent truly owns the child.',
        'They fail when engineers use them as a general relationship model. Selection, observation, routing, and policy are not ownership. Cross-namespace owner references have scope rules. External resources need finalizers and reliable controller code; ownerReferences alone cannot delete a DNS record, S3 bucket, database, or load balancer.',
      ],
    },
    {
      heading: 'Failure modes',
      paragraphs: [
        'The common failure is confusing labels with ownership. Deleting by selector can remove objects that another owner still needs, or leave objects that changed labels before deletion.',
        'The dangerous failure is manual finalizer removal. It can unblock a stuck object, but it also skips the cleanup the finalizer was protecting. That can leak external infrastructure or leave a child system in an inconsistent state.',
        'The quiet failure is an invalid or stale owner reference. Scope violations, wrong UID, missing RBAC for blockOwnerDeletion, or a controller that forgets to set ownerReferences all create deletion debt that appears later.',
      ],
    },
    {
      heading: 'Animation notes',
      paragraphs: [
        'The owner-graph view separates selection from ownership. A Service may point at matching Pods, but that is not a cleanup edge. The Deployment-to-ReplicaSet-to-Pod chain is a cleanup graph because dependents store ownerReferences with UIDs.',
        'The finalizer view shows why deletion is a state machine. The object is marked for deletion, controller cleanup runs while the object is still visible, and physical removal waits until finalizer keys are gone.',
      ],
    },
    {
      heading: 'Implementation guidance',
      paragraphs: [
        'Controllers should set ownerReferences on child Kubernetes objects at creation time and use finalizers for external resources they must clean up. Cleanup should be idempotent because the controller may crash and retry after deletionTimestamp is already set.',
        'Runbooks should never say "remove the finalizer" without naming the resource leak that might result. First identify the owning controller, check its logs and permissions, verify external cleanup state, and only then decide whether manual finalizer removal is safe.',
      ],
    },
    {
      heading: 'Complete case study',
      paragraphs: [
        'A custom database operator creates a StatefulSet, Services, Secrets, and a cloud backup bucket for each Database object. The StatefulSet and Secrets can use ownerReferences because they are in-cluster dependents. The backup bucket needs a finalizer because Kubernetes garbage collection cannot delete it by following an API object edge.',
        'When the user deletes the Database, the API server sets deletionTimestamp. The operator sees the terminating object, finalizes backups, deletes or archives the bucket according to policy, removes the finalizer, and then garbage collection can finish the Kubernetes object cleanup.',
      ],
    },
    {
      heading: 'Operational guidance',
      paragraphs: [
        'When an object is stuck terminating, inspect finalizers, ownerReferences, events, and the controller responsible for the finalizer key. The question is not only "how do I delete this object?" It is "what cleanup was this object keeping alive?"',
        'For custom controllers, make deletion paths part of the normal test suite. Create the parent, verify child ownerReferences, delete the parent, simulate controller restarts during cleanup, and assert that external resources are either removed or intentionally retained according to policy.',
      ],
    },
    {
      heading: 'Study next',
      paragraphs: [
        'Primary sources: Kubernetes garbage collection at https://kubernetes.io/docs/concepts/architecture/garbage-collection/, owners and dependents at https://kubernetes.io/docs/concepts/overview/working-with-objects/owners-dependents/, and finalizers at https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/.',
        'Study Kubernetes Reconciliation for controller cleanup, Kubernetes Deployment Rolling Update State Machine for owner chains, Write-Ahead Log for deletion durability, Reference Counting for the simpler in-process analogy, and Saga Pattern for cleanup when the dependent is outside the cluster.',
      ],
    },
  ],
};
